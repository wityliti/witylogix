"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { CarrierLogo, type CarrierCode } from "./carrier-logo";

interface ShippingRate {
  id: string;
  carrier: CarrierCode;
  serviceName: string;
  price: number;
  estimatedDays: number;
  deliveryDate: Date;
  trackingIncluded?: boolean;
  insuranceAvailable?: boolean;
  signatureRequired?: boolean;
}

interface RateComparisonCardProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSelect"
> {
  /** Shipping rate data */
  rate: ShippingRate;
  /** Whether this rate is selected */
  isSelected?: boolean;
  /** Whether this is the cheapest option */
  isCheapest?: boolean;
  /** Whether this is the fastest option */
  isFastest?: boolean;
  /** Whether this is the best value */
  isBestValue?: boolean;
  /** Callback when rate is selected */
  onSelect?: (rate: ShippingRate) => void;
}

/**
 * Rate comparison card component displaying shipping options
 *
 * Shows carrier logo, service name, price, delivery time and badges.
 * Hover state reveals additional details, selected state shows checkmark.
 *
 * @example
 * ```tsx
 * <RateComparisonCard
 *   rate={rate}
 *   isSelected={selectedId === rate.id}
 *   isCheapest={cheapestRate.id === rate.id}
 *   isFastest={fastestRate.id === rate.id}
 *   onSelect={handleSelect}
 * />
 * ```
 */
const RateComparisonCard = forwardRef<HTMLDivElement, RateComparisonCardProps>(
  (
    {
      rate,
      isSelected = false,
      isCheapest = false,
      isFastest = false,
      isBestValue = false,
      onSelect,
      className,
      ...props
    },
    ref,
  ) => {
    const formatPrice = (price: number): string => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(price);
    };

    const formatDeliveryDate = (date: Date): string => {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(date);
    };

    return (
      <div
        ref={ref}
        onClick={() => onSelect?.(rate)}
        className={cn(
          "relative rounded-lg border transition-all duration-200 ease-default",
          "cursor-pointer group",
          isSelected
            ? "border-wl-primary-500 bg-wl-primary-500/8 shadow-md"
            : "border-wl-border-subtle bg-wl-bg-elevated hover:border-wl-primary-400 hover:shadow-md",
          className,
        )}
        {...props}
      >
        {/* Selection checkmark */}
        {isSelected && (
          <div className="absolute top-3 right-3 flex items-center justify-center w-5 h-5 rounded-full bg-wl-primary-500 text-white">
            <Check size={16} strokeWidth={3} />
          </div>
        )}

        {/* Main content */}
        <div className="p-4">
          {/* Header with carrier and badges */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <CarrierLogo carrier={rate.carrier} size="md" />
              <div>
                <h4 className="text-sm font-semibold text-wl-text-primary">
                  {rate.serviceName}
                </h4>
                <p className="text-xs text-wl-text-tertiary">{rate.carrier}</p>
              </div>
            </div>

            {/* Badge section */}
            <div className="flex flex-wrap gap-1 justify-end">
              {isCheapest && (
                <Badge variant="success" className="text-xs">
                  Cheapest
                </Badge>
              )}
              {isFastest && (
                <Badge variant="info" className="text-xs">
                  Fastest
                </Badge>
              )}
              {isBestValue && (
                <Badge variant="primary" className="text-xs">
                  Best Value
                </Badge>
              )}
            </div>
          </div>

          {/* Price and delivery info */}
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-wl-text-primary">
                {formatPrice(rate.price)}
              </p>
              <p className="text-xs text-wl-text-tertiary mt-0.5">
                {rate.estimatedDays} business day
                {rate.estimatedDays !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm font-medium text-wl-text-primary">
                {formatDeliveryDate(rate.deliveryDate)}
              </p>
              <p className="text-xs text-wl-text-tertiary">
                Estimated delivery
              </p>
            </div>
          </div>

          {/* Additional details - shown on hover/expanded */}
          <div className="space-y-2 pt-3 border-t border-wl-border-subtle opacity-0 group-hover:opacity-100 transition-opacity duration-200 max-h-0 group-hover:max-h-24 overflow-hidden">
            <div className="flex items-center justify-between text-xs">
              <span className="text-wl-text-secondary">
                {rate.trackingIncluded ? "✓" : "○"} Tracking
              </span>
              <span
                className={cn(
                  rate.trackingIncluded
                    ? "text-wl-success-400"
                    : "text-wl-text-tertiary",
                )}
              >
                {rate.trackingIncluded ? "Included" : "Not included"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-wl-text-secondary">
                {rate.insuranceAvailable ? "✓" : "○"} Insurance
              </span>
              <span
                className={cn(
                  rate.insuranceAvailable
                    ? "text-wl-success-400"
                    : "text-wl-text-tertiary",
                )}
              >
                {rate.insuranceAvailable ? "Available" : "Not available"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-wl-text-secondary">
                {rate.signatureRequired ? "✓" : "○"} Signature
              </span>
              <span
                className={cn(
                  rate.signatureRequired
                    ? "text-wl-warning-400"
                    : "text-wl-text-tertiary",
                )}
              >
                {rate.signatureRequired ? "Required" : "Not required"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

RateComparisonCard.displayName = "RateComparisonCard";

export { RateComparisonCard };
export type { ShippingRate };
