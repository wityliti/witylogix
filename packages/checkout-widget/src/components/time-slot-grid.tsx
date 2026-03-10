/**
 * TimeSlotGrid Component
 * Displays available time slots with capacity and pricing
 */

import React, { useMemo } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { formatTimeRangeDisplay, formatTimeDisplay, getAvailableSlotsText } from '../utils/date-utils';
import { formatPrice } from '../utils/rate-calculator';
import type { TimeSlot, CapacityInfo } from '../types';
import clsx from 'clsx';

interface TimeSlotGridProps {
  slots: TimeSlot[];
  selectedSlot?: TimeSlot;
  onSlotSelect: (slot: TimeSlot) => void;
  currency?: string;
  isLoading?: boolean;
  compact?: boolean;
}

const getCapacityStatus = (capacity: CapacityInfo): 'available' | 'limited' | 'full' => {
  if (capacity.available === 0) return 'full';
  if (capacity.available <= 3) return 'limited';
  return 'available';
};

const getCapacityColor = (status: 'available' | 'limited' | 'full'): string => {
  const colors = {
    available: 'wl-bg-wl-success/10 wl-text-wl-success wl-border-wl-success/30',
    limited: 'wl-bg-wl-warning/10 wl-text-wl-warning wl-border-wl-warning/30',
    full: 'wl-bg-wl-destructive/10 wl-text-wl-destructive wl-border-wl-destructive/30',
  };
  return colors[status];
};

export const TimeSlotGrid: React.FC<TimeSlotGridProps> = ({
  slots,
  selectedSlot,
  onSlotSelect,
  currency = 'USD',
  isLoading = false,
  compact = false,
}) => {
  const sortedSlots = useMemo(() => {
    return [...slots].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [slots]);

  if (sortedSlots.length === 0) {
    return (
      <div className="wl-w-full wl-text-center wl-py-8">
        <AlertCircle className="wl-w-8 wl-h-8 wl-mx-auto wl-text-wl-muted-foreground wl-mb-2" />
        <p className="wl-text-wl-muted-foreground">No available time slots for this date</p>
      </div>
    );
  }

  return (
    <div className={clsx('wl-space-y-3', { 'wl-max-w-md': compact })}>
      <div className="wl-flex wl-items-center wl-gap-2 wl-mb-4">
        <Clock className="wl-w-5 wl-h-5 wl-text-wl-muted-foreground" />
        <h3 className="wl-font-semibold wl-text-wl-foreground">Select a time slot</h3>
      </div>

      <div className="wl-space-y-2">
        {sortedSlots.map((slot) => {
          const isSelected = selectedSlot?.id === slot.id;
          const status = getCapacityStatus(slot.capacity);
          const statusColor = getCapacityColor(status);
          const isDisabled = status === 'full' || isLoading;

          return (
            <button
              key={slot.id}
              onClick={() => !isDisabled && onSlotSelect(slot)}
              disabled={isDisabled}
              className={clsx(
                'wl-w-full wl-p-4 wl-rounded-lg wl-border-2 wl-transition-all wl-text-left',
                'wl-hover:shadow-md wl-active:scale-[0.98]',
                {
                  'wl-border-wl-accent wl-bg-wl-accent/5 wl-shadow-md': isSelected,
                  'wl-border-wl-border wl-bg-wl-background wl-hover:border-wl-accent/50': !isSelected && !isDisabled,
                  'wl-border-wl-border wl-bg-wl-muted wl-opacity-50 wl-cursor-not-allowed': isDisabled,
                }
              )}
              aria-selected={isSelected}
              aria-disabled={isDisabled}
              aria-label={`${formatTimeRangeDisplay(slot.startTime, slot.endTime)} - ${getAvailableSlotsText(slot.capacity.available, slot.capacity.total)}`}
            >
              <div className="wl-flex wl-items-center wl-justify-between wl-mb-2">
                <div>
                  <div className="wl-font-semibold wl-text-wl-foreground">
                    {formatTimeRangeDisplay(slot.startTime, slot.endTime)}
                  </div>

                  {slot.prepTime && (
                    <div className="wl-text-xs wl-text-wl-muted-foreground wl-mt-1">
                      {slot.prepTime.message}
                    </div>
                  )}
                </div>

                <div className="wl-text-right">
                  <div className="wl-font-semibold wl-text-wl-foreground">
                    {formatPrice(slot.price, currency)}
                  </div>
                </div>
              </div>

              {/* Capacity indicator */}
              <div className={clsx('wl-inline-block wl-px-3 wl-py-1 wl-rounded wl-text-xs wl-font-medium wl-border', statusColor)}>
                {getAvailableSlotsText(slot.capacity.available, slot.capacity.total)}
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="wl-absolute wl-right-4 wl-top-4">
                  <div className="wl-w-5 wl-h-5 wl-rounded-full wl-bg-wl-accent wl-flex wl-items-center wl-justify-center">
                    <svg className="wl-w-3 wl-h-3 wl-text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Additional info */}
      <div className="wl-mt-6 wl-p-4 wl-bg-wl-muted/30 wl-rounded-lg wl-text-sm wl-text-wl-muted-foreground">
        <div className="wl-flex wl-gap-2">
          <AlertCircle className="wl-w-4 wl-h-4 wl-flex-shrink-0 wl-mt-0.5" />
          <div>
            <p className="wl-font-medium wl-text-wl-foreground wl-mb-1">Slot times may vary</p>
            <p>Actual delivery will be within the selected window. Driver will contact you to confirm arrival time.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
