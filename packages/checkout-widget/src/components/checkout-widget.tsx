/**
 * CheckoutWidget Component
 * Main widget combining all checkout steps
 */

import React, { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { AddressInput } from './address-input';
import { DeliveryOptions } from './delivery-options';
import { DatePicker } from './date-picker';
import { TimeSlotGrid } from './time-slot-grid';
import { ZoneRateDisplay } from './zone-rate-display';
import { useSlotAvailability } from '../hooks/use-slot-availability';
import { useZoneRates } from '../hooks/use-zone-rates';
import { formatDateISO } from '../utils/date-utils';
import type {
  WidgetConfig,
  CheckoutSelection,
  DeliveryMethod,
  TimeSlot,
  BlackoutDate,
  PickupLocation,
} from '../types';
import clsx from 'clsx';

type CheckoutStep = 'address' | 'delivery' | 'date' | 'time' | 'review';

interface CheckoutWidgetProps extends WidgetConfig {
  deliveryMethods: DeliveryMethod[];
  blackoutDates?: BlackoutDate[];
  pickupLocations?: PickupLocation[];
  defaultOrderValue?: number;
  defaultWeight?: number;
}

export const CheckoutWidget: React.FC<CheckoutWidgetProps> = ({
  apiBaseUrl,
  onSelectionChange,
  onComplete,
  onError,
  deliveryMethods,
  blackoutDates = [],
  pickupLocations = [],
  compactMode = false,
  maxDate,
  minDate,
  defaultDeliveryMethod,
  currency = 'USD',
  locale = 'en-US',
  darkMode = false,
  defaultOrderValue = 100,
  defaultWeight = 0,
}) => {
  // State management
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('address');
  const [selection, setSelection] = useState<Partial<CheckoutSelection>>({
    orderValue: defaultOrderValue,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<Map<string, { total: number; available: number }>>(new Map());

  // Zone rates hook
  const zoneRatesQuery = useZoneRates(
    selection.address?.zoneId || '',
    selection.orderValue || defaultOrderValue,
    { apiBaseUrl, enabled: !!selection.address?.zoneId },
    defaultWeight
  );

  // Slot availability hook
  const startDate = minDate ? formatDateISO(minDate) : formatDateISO(new Date());
  const endDate = maxDate
    ? formatDateISO(maxDate)
    : formatDateISO(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 days out

  const slotsQuery = useSlotAvailability(
    selection.address?.zoneId || '',
    startDate,
    endDate,
    selection.deliveryMethod || defaultDeliveryMethod || 'standard',
    { apiBaseUrl, enabled: !!selection.address?.zoneId }
  );

  // Effect: Call onSelectionChange when selection updates
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selection);
    }
  }, [selection, onSelectionChange]);

  // Effect: Update available dates when slots load
  useEffect(() => {
    if (slotsQuery.data && Array.isArray(slotsQuery.data)) {
      const dates = new Map();
      (slotsQuery.data as any[]).forEach((slot) => {
        const dateStr = formatDateISO(new Date(slot.date));
        dates.set(dateStr, slot.capacity);
      });
      setAvailableDates(dates);
    }
  }, [slotsQuery.data]);

  // Handlers
  const handleAddressSelect = useCallback(
    (address: any) => {
      setSelection((prev) => ({
        ...prev,
        address,
      }));
      setCurrentStep('delivery');
      setError(null);
    },
    []
  );

  const handleDeliveryMethodSelect = useCallback((methodId: string) => {
    setSelection((prev) => ({
      ...prev,
      deliveryMethod: methodId as any,
    }));
    setCurrentStep('date');
    setError(null);
  }, []);

  const handlePickupLocationSelect = useCallback((locationId: string) => {
    const location = pickupLocations.find((l) => l.id === locationId);
    setSelection((prev) => ({
      ...prev,
      pickupLocation: location,
    }));
  }, [pickupLocations]);

  const handleDateSelect = useCallback((date: Date) => {
    setSelection((prev) => ({
      ...prev,
      selectedDate: date,
    }));
    setCurrentStep('time');
    setError(null);
  }, []);

  const handleTimeSlotSelect = useCallback((slot: TimeSlot) => {
    setSelection((prev) => ({
      ...prev,
      selectedSlot: slot,
    }));
    setCurrentStep('review');
    setError(null);
  }, []);

  const handleComplete = useCallback(async () => {
    if (!isCompleteSelection(selection)) {
      setError('Please complete all required fields');
      return;
    }

    try {
      setIsLoading(true);
      const completeSelection = selection as CheckoutSelection;

      if (onComplete) {
        onComplete(completeSelection);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMsg));
      }
    } finally {
      setIsLoading(false);
    }
  }, [selection, onComplete, onError]);

  const handleBack = useCallback(() => {
    const steps: CheckoutStep[] = ['address', 'delivery', 'date', 'time', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
      setError(null);
    }
  }, [currentStep]);

  // Step progress
  const steps: CheckoutStep[] = ['address', 'delivery', 'date', 'time', 'review'];
  const currentStepIndex = steps.indexOf(currentStep);
  const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;

  // Render functions
  const isCompleteSelection = (sel: Partial<CheckoutSelection>): sel is CheckoutSelection => {
    return (
      !!sel.address &&
      !!sel.deliveryMethod &&
      !!sel.selectedDate &&
      !!sel.selectedSlot &&
      !!sel.zoneRate
    );
  };

  const canProceedToNext = (): boolean => {
    switch (currentStep) {
      case 'address':
        return !!selection.address?.valid;
      case 'delivery':
        return !!selection.deliveryMethod;
      case 'date':
        return !!selection.selectedDate;
      case 'time':
        return !!selection.selectedSlot;
      case 'review':
        return isCompleteSelection(selection);
      default:
        return false;
    }
  };

  return (
    <div
      className={clsx('wl-w-full wl-max-w-2xl wl-mx-auto wl-p-6', {
        'wl-dark': darkMode,
        'wl-max-w-sm': compactMode,
      })}
      style={{
        '--wl-accent': 'rgb(var(--color-accent))',
        '--wl-success': 'rgb(var(--color-success))',
        '--wl-warning': 'rgb(var(--color-warning))',
        '--wl-destructive': 'rgb(var(--color-destructive))',
      } as React.CSSProperties}
    >
      {/* Progress bar */}
      <div className="wl-mb-8">
        <div className="wl-flex wl-items-center wl-justify-between wl-mb-2">
          <h1 className="wl-text-2xl wl-font-bold wl-text-wl-foreground">
            Delivery Checkout
          </h1>
          <span className="wl-text-sm wl-text-wl-muted-foreground">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
        </div>
        <div className="wl-h-2 wl-bg-wl-muted wl-rounded-full wl-overflow-hidden">
          <div
            className="wl-h-full wl-bg-wl-accent wl-transition-all wl-duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="wl-mb-6 wl-p-4 wl-bg-wl-destructive/10 wl-border wl-border-wl-destructive/30 wl-rounded-lg wl-flex wl-items-start wl-gap-3">
          <AlertCircle className="wl-w-5 wl-h-5 wl-text-wl-destructive wl-flex-shrink-0 wl-mt-0.5" />
          <div>
            <p className="wl-font-medium wl-text-wl-destructive">Error</p>
            <p className="wl-text-sm wl-text-wl-destructive/80 wl-mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="wl-mb-8 wl-min-h-96">
        {currentStep === 'address' && (
          <div>
            <h2 className="wl-text-xl wl-font-semibold wl-text-wl-foreground wl-mb-6">
              Where should we deliver?
            </h2>
            <AddressInput
              apiBaseUrl={apiBaseUrl}
              onAddressSelect={handleAddressSelect}
              isLoading={isLoading || zoneRatesQuery.isLoading}
              compact={compactMode}
            />
          </div>
        )}

        {currentStep === 'delivery' && selection.address && (
          <div>
            <h2 className="wl-text-xl wl-font-semibold wl-text-wl-foreground wl-mb-6">
              Choose delivery method
            </h2>
            <DeliveryOptions
              methods={deliveryMethods}
              selectedMethod={selection.deliveryMethod}
              onMethodSelect={handleDeliveryMethodSelect}
              currency={currency}
              isLoading={isLoading}
              compact={compactMode}
              pickupLocations={pickupLocations}
              onPickupLocationSelect={handlePickupLocationSelect}
              selectedPickupLocation={selection.pickupLocation?.id}
            />
          </div>
        )}

        {currentStep === 'date' && selection.address && (
          <div>
            <h2 className="wl-text-xl wl-font-semibold wl-text-wl-foreground wl-mb-6">
              Select delivery date
            </h2>
            <DatePicker
              selectedDate={selection.selectedDate}
              onDateSelect={handleDateSelect}
              blackoutDates={blackoutDates}
              availableDates={availableDates}
              minDate={minDate}
              maxDate={maxDate}
              isLoading={slotsQuery.isLoading || isLoading}
              compact={compactMode}
            />
          </div>
        )}

        {currentStep === 'time' && selection.selectedDate && Array.isArray(slotsQuery.data) && (
          <div>
            <h2 className="wl-text-xl wl-font-semibold wl-text-wl-foreground wl-mb-6">
              Select delivery time
            </h2>
            <TimeSlotGrid
              slots={(slotsQuery.data as any[]).flatMap((day: any) => day.slots || [])}
              selectedSlot={selection.selectedSlot}
              onSlotSelect={handleTimeSlotSelect}
              currency={currency}
              isLoading={slotsQuery.isLoading || isLoading}
              compact={compactMode}
            />
          </div>
        )}

        {currentStep === 'review' && selection.zoneRate && (
          <div className="wl-space-y-6">
            <h2 className="wl-text-xl wl-font-semibold wl-text-wl-foreground">
              Review your order
            </h2>

            {/* Summary */}
            <div className="wl-grid wl-grid-cols-1 md:wl-grid-cols-2 wl-gap-6">
              {/* Delivery details */}
              <div className="wl-space-y-3">
                <div className="wl-p-4 wl-bg-wl-muted/30 wl-rounded-lg">
                  <p className="wl-text-xs wl-text-wl-muted-foreground wl-mb-2">Address</p>
                  <p className="wl-font-medium wl-text-wl-foreground">
                    {selection.address?.address}
                  </p>
                </div>

                <div className="wl-p-4 wl-bg-wl-muted/30 wl-rounded-lg">
                  <p className="wl-text-xs wl-text-wl-muted-foreground wl-mb-2">
                    Delivery Method
                  </p>
                  <p className="wl-font-medium wl-text-wl-foreground">
                    {deliveryMethods.find((m) => m.id === selection.deliveryMethod)?.name}
                  </p>
                </div>

                <div className="wl-p-4 wl-bg-wl-muted/30 wl-rounded-lg">
                  <p className="wl-text-xs wl-text-wl-muted-foreground wl-mb-2">
                    Date & Time
                  </p>
                  <p className="wl-font-medium wl-text-wl-foreground">
                    {selection.selectedDate && selection.selectedSlot
                      ? `${selection.selectedDate.toLocaleDateString(locale)} at ${selection.selectedSlot.startTime.toLocaleTimeString(
                          locale,
                          { hour: '2-digit', minute: '2-digit' }
                        )}`
                      : 'Not selected'}
                  </p>
                </div>
              </div>

              {/* Pricing */}
              <ZoneRateDisplay
                zoneRate={selection.zoneRate}
                orderValue={selection.orderValue || defaultOrderValue}
                compact={compactMode}
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="wl-flex wl-items-center wl-justify-between wl-gap-4 wl-mt-8">
        <button
          onClick={handleBack}
          disabled={currentStepIndex === 0 || isLoading}
          className={clsx(
            'wl-px-6 wl-py-2 wl-rounded-lg wl-font-medium wl-transition-colors',
            'wl-flex wl-items-center wl-gap-2',
            {
              'wl-bg-wl-muted wl-text-wl-muted-foreground wl-cursor-not-allowed wl-opacity-50':
                currentStepIndex === 0 || isLoading,
              'wl-bg-wl-muted wl-text-wl-foreground wl-hover:bg-wl-muted/80':
                currentStepIndex > 0 && !isLoading,
            }
          )}
        >
          <ChevronLeft className="wl-w-4 wl-h-4" />
          Back
        </button>

        {currentStep === 'review' ? (
          <button
            onClick={handleComplete}
            disabled={isLoading || !canProceedToNext()}
            className={clsx(
              'wl-px-8 wl-py-2 wl-rounded-lg wl-font-medium wl-transition-all',
              'wl-flex wl-items-center wl-gap-2',
              {
                'wl-bg-wl-accent wl-text-white wl-hover:bg-wl-accent/90 wl-active:scale-95':
                  !isLoading && canProceedToNext(),
                'wl-bg-wl-muted wl-text-wl-muted-foreground wl-cursor-not-allowed wl-opacity-50':
                  isLoading || !canProceedToNext(),
              }
            )}
          >
            <CheckCircle className="wl-w-4 wl-h-4" />
            {isLoading ? 'Processing...' : 'Complete Checkout'}
          </button>
        ) : (
          <button
            onClick={() => {
              const steps: CheckoutStep[] = ['address', 'delivery', 'date', 'time', 'review'];
              const nextIndex = currentStepIndex + 1;
              if (nextIndex < steps.length && canProceedToNext()) {
                setCurrentStep(steps[nextIndex]);
                setError(null);
              }
            }}
            disabled={isLoading || !canProceedToNext()}
            className={clsx(
              'wl-px-8 wl-py-2 wl-rounded-lg wl-font-medium wl-transition-all',
              'wl-flex wl-items-center wl-gap-2',
              {
                'wl-bg-wl-accent wl-text-white wl-hover:bg-wl-accent/90 wl-active:scale-95':
                  !isLoading && canProceedToNext(),
                'wl-bg-wl-muted wl-text-wl-muted-foreground wl-cursor-not-allowed wl-opacity-50':
                  isLoading || !canProceedToNext(),
              }
            )}
          >
            {isLoading ? 'Loading...' : 'Next'}
            <ChevronRight className="wl-w-4 wl-h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
