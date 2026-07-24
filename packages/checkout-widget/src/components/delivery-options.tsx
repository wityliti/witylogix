/**
 * DeliveryOptions Component
 * Delivery method selector with pricing
 */

import React from "react";
import { Truck, Clock, Store, AlertCircle } from "lucide-react";
import { formatPrice } from "../utils/rate-calculator";
import type { DeliveryMethod, DeliveryMethodType } from "../types";
import clsx from "clsx";

interface DeliveryOptionsProps {
  methods: DeliveryMethod[];
  selectedMethod?: DeliveryMethodType;
  onMethodSelect: (method: DeliveryMethodType) => void;
  currency?: string;
  isLoading?: boolean;
  compact?: boolean;
  pickupLocations?: Array<{ id: string; name: string; address: string }>;
  onPickupLocationSelect?: (locationId: string) => void;
  selectedPickupLocation?: string;
}

const getMethodIcon = (methodId: string) => {
  switch (methodId) {
    case "standard":
      return <Truck className="wl-w-6 wl-h-6" />;
    case "express":
      return <Clock className="wl-w-6 wl-h-6" />;
    case "pickup":
      return <Store className="wl-w-6 wl-h-6" />;
    default:
      return <Truck className="wl-w-6 wl-h-6" />;
  }
};

export const DeliveryOptions: React.FC<DeliveryOptionsProps> = ({
  methods,
  selectedMethod,
  onMethodSelect,
  currency = "USD",
  isLoading = false,
  compact = false,
  pickupLocations = [],
  onPickupLocationSelect,
  selectedPickupLocation,
}) => {
  const selectedMethodData = methods.find((m) => m.id === selectedMethod);
  const showPickupSelect =
    selectedMethod === "pickup" && pickupLocations.length > 0;

  const enabledMethods = methods.filter((m) => m.enabled);

  return (
    <div className={clsx("wl-w-full wl-space-y-4", { "wl-max-w-md": compact })}>
      <div className="wl-space-y-3">
        <h3 className="wl-text-lg wl-font-semibold wl-text-wl-foreground">
          Delivery method
        </h3>

        {enabledMethods.length === 0 && (
          <div className="wl-p-4 wl-bg-wl-destructive/10 wl-border wl-border-wl-destructive/30 wl-rounded-lg wl-flex wl-items-start wl-gap-2">
            <AlertCircle className="wl-w-5 wl-h-5 wl-text-wl-destructive wl-flex-shrink-0 wl-mt-0.5" />
            <p className="wl-text-sm wl-text-wl-destructive">
              No delivery methods available
            </p>
          </div>
        )}

        <div className="wl-space-y-2">
          {enabledMethods.map((method) => {
            const isSelected = selectedMethod === method.id;
            const isDisabled = !method.enabled || isLoading;

            return (
              <button
                key={method.id}
                onClick={() => !isDisabled && onMethodSelect(method.id)}
                disabled={isDisabled}
                className={clsx(
                  "wl-w-full wl-p-4 wl-rounded-lg wl-border-2 wl-transition-all wl-text-left",
                  "wl-flex wl-items-center wl-gap-4",
                  {
                    "wl-border-wl-accent wl-bg-wl-accent/5": isSelected,
                    "wl-border-wl-border wl-bg-wl-background wl-hover:border-wl-accent/50":
                      !isSelected && !isDisabled,
                    "wl-border-wl-border wl-bg-wl-muted wl-opacity-50 wl-cursor-not-allowed":
                      isDisabled,
                  },
                )}
                aria-selected={isSelected}
                aria-disabled={isDisabled}
              >
                {/* Icon */}
                <div
                  className={clsx("wl-flex-shrink-0 wl-p-2 wl-rounded-lg", {
                    "wl-bg-wl-accent/20 wl-text-wl-accent": isSelected,
                    "wl-bg-wl-muted wl-text-wl-muted-foreground": !isSelected,
                  })}
                >
                  {getMethodIcon(method.id)}
                </div>

                {/* Content */}
                <div className="wl-flex-1 wl-min-w-0">
                  <h4 className="wl-font-semibold wl-text-wl-foreground">
                    {method.name}
                  </h4>
                  <p className="wl-text-sm wl-text-wl-muted-foreground wl-mt-0.5">
                    {method.description}
                  </p>
                  <p className="wl-text-xs wl-text-wl-muted-foreground wl-mt-1">
                    {method.estimatedTime}
                  </p>
                </div>

                {/* Price and radio */}
                <div className="wl-flex wl-items-center wl-gap-3 wl-flex-shrink-0">
                  <div className="wl-text-right">
                    <p className="wl-font-semibold wl-text-wl-foreground">
                      {formatPrice(method.price, currency)}
                    </p>
                  </div>

                  {/* Radio button */}
                  <div
                    className={clsx(
                      "wl-w-5 wl-h-5 wl-rounded-full wl-border-2 wl-flex wl-items-center wl-justify-center wl-transition-all",
                      {
                        "wl-border-wl-accent wl-bg-wl-accent": isSelected,
                        "wl-border-wl-border": !isSelected,
                      },
                    )}
                  >
                    {isSelected && (
                      <div className="wl-w-2 wl-h-2 wl-rounded-full wl-bg-white" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pickup location selector */}
      {showPickupSelect && (
        <div className="wl-space-y-3 wl-border-t wl-border-wl-border wl-pt-4">
          <label className="wl-block wl-text-sm wl-font-medium wl-text-wl-foreground">
            Select pickup location
          </label>

          <select
            value={selectedPickupLocation || ""}
            onChange={(e) => onPickupLocationSelect?.(e.target.value)}
            className={clsx(
              "wl-w-full wl-px-4 wl-py-2 wl-rounded-lg wl-border-2 wl-transition-colors",
              "wl-bg-wl-background wl-text-wl-foreground",
              "wl-focus:border-wl-accent wl-focus:ring-2 wl-focus:ring-wl-accent/20",
            )}
          >
            <option value="">Choose a location...</option>
            {pickupLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} - {location.address}
              </option>
            ))}
          </select>

          {/* Pickup location details */}
          {selectedPickupLocation && (
            <div className="wl-p-3 wl-bg-wl-muted/30 wl-rounded-lg">
              <p className="wl-text-sm wl-text-wl-muted-foreground">
                Pickup location:
              </p>
              <p className="wl-text-sm wl-font-medium wl-text-wl-foreground wl-mt-1">
                {
                  pickupLocations.find((l) => l.id === selectedPickupLocation)
                    ?.name
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Method details */}
      {selectedMethodData && (
        <div className="wl-p-4 wl-bg-wl-muted/30 wl-rounded-lg wl-border wl-border-wl-border">
          <h4 className="wl-text-sm wl-font-semibold wl-text-wl-foreground wl-mb-2">
            Estimated delivery
          </h4>
          <ul className="wl-space-y-1 wl-text-sm wl-text-wl-muted-foreground">
            <li>• {selectedMethodData.estimatedTime}</li>
            {selectedMethodData.estimatedMinutes && (
              <li>
                • Approximately {selectedMethodData.estimatedMinutes} minutes
                from now
              </li>
            )}
            <li>• Price: {formatPrice(selectedMethodData.price, currency)}</li>
          </ul>
        </div>
      )}

      {/* Info message */}
      <div className="wl-p-3 wl-bg-wl-blue/10 wl-border wl-border-wl-blue/30 wl-rounded-lg wl-flex wl-items-start wl-gap-2">
        <AlertCircle className="wl-w-4 wl-h-4 wl-text-wl-blue wl-flex-shrink-0 wl-mt-0.5" />
        <p className="wl-text-xs wl-text-wl-blue/80">
          Delivery times may vary. You will receive tracking information once
          your order is confirmed.
        </p>
      </div>
    </div>
  );
};
