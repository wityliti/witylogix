"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  Circle,
  AlertCircle,
  Package,
  Truck,
  MapPin,
  Home,
  Clock,
} from "lucide-react";

type ShipmentStatus =
  | "label_created"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered";

interface StatusStepperProps extends HTMLAttributes<HTMLDivElement> {
  /** Current shipment status */
  currentStatus: ShipmentStatus;
  /** Estimated delivery date */
  estimatedDelivery?: Date;
  /** Carrier name */
  carrier?: string;
  /** Whether there's an exception/issue */
  hasException?: boolean;
  /** Exception message */
  exceptionMessage?: string;
}

const statusSteps: Array<{
  id: ShipmentStatus;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    id: "label_created",
    label: "Label Created",
    icon: <Package size={20} />,
    description: "Label generated",
  },
  {
    id: "picked_up",
    label: "Picked Up",
    icon: <Truck size={20} />,
    description: "In carrier possession",
  },
  {
    id: "in_transit",
    label: "In Transit",
    icon: <Truck size={20} />,
    description: "On the way",
  },
  {
    id: "out_for_delivery",
    label: "Out for Delivery",
    icon: <MapPin size={20} />,
    description: "On delivery vehicle",
  },
  {
    id: "delivered",
    label: "Delivered",
    icon: <Home size={20} />,
    description: "Delivered",
  },
];

const statusOrder: Record<ShipmentStatus, number> = {
  label_created: 0,
  picked_up: 1,
  in_transit: 2,
  out_for_delivery: 3,
  delivered: 4,
};

/**
 * Shipment lifecycle stepper component
 *
 * Shows progress through shipment lifecycle with visual indicators.
 * Supports exception states and responsive layout (horizontal on desktop, vertical on mobile).
 *
 * @example
 * ```tsx
 * <StatusStepper
 *   currentStatus="in_transit"
 *   estimatedDelivery={new Date('2024-03-20')}
 *   carrier="UPS"
 * />
 * ```
 */
const StatusStepper = forwardRef<HTMLDivElement, StatusStepperProps>(
  (
    {
      currentStatus,
      estimatedDelivery,
      carrier,
      hasException = false,
      exceptionMessage,
      className,
      ...props
    },
    ref,
  ) => {
    const currentIndex = statusOrder[currentStatus];

    const formatDate = (date: Date): string => {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(date);
    };

    return (
      <div ref={ref} className={cn("space-y-6", className)} {...props}>
        {/* Exception alert */}
        {hasException && (
          <div className="p-4 rounded-lg bg-wl-danger-bg border border-wl-danger-400/30">
            <div className="flex gap-3">
              <AlertCircle
                size={20}
                className="text-wl-danger-400 flex-shrink-0 mt-0.5"
              />
              <div>
                <h4 className="text-sm font-semibold text-wl-danger-400">
                  Delivery Exception
                </h4>
                {exceptionMessage && (
                  <p className="text-sm text-wl-danger-300 mt-1">
                    {exceptionMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Desktop horizontal stepper */}
        <div className="hidden sm:block">
          <div className="space-y-4">
            {/* Steps timeline */}
            <div className="flex gap-2 sm:gap-3">
              {statusSteps.map((step, index) => {
                const isCompleted = index < currentIndex;
                const isCurrent = index === currentIndex;

                return (
                  <div
                    key={step.id}
                    className="flex flex-col items-center flex-1"
                  >
                    {/* Step circle */}
                    <div
                      className={cn(
                        "relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full",
                        "transition-all duration-300 ease-default",
                        hasException && isCurrent
                          ? "bg-wl-danger-500 text-white ring-2 ring-wl-danger-500/30"
                          : isCompleted
                            ? "bg-wl-success-500 text-white"
                            : isCurrent
                              ? "bg-wl-primary-500 text-white ring-2 ring-wl-primary-500/30"
                              : "bg-wl-bg-overlay border-2 border-wl-border-subtle text-wl-text-secondary",
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle size={20} />
                      ) : isCurrent ? (
                        step.icon
                      ) : (
                        <Circle size={16} />
                      )}
                    </div>

                    {/* Connector line */}
                    {index < statusSteps.length - 1 && (
                      <div
                        className={cn(
                          "w-0.5 h-6 sm:h-8 my-1",
                          isCompleted
                            ? "bg-wl-success-500"
                            : isCurrent
                              ? "bg-wl-primary-500"
                              : "bg-wl-border-subtle",
                        )}
                      />
                    )}

                    {/* Step label */}
                    <p
                      className={cn(
                        "text-xs font-semibold mt-2 text-center",
                        isCompleted
                          ? "text-wl-success-400"
                          : isCurrent
                            ? "text-wl-primary-400"
                            : "text-wl-text-secondary",
                      )}
                    >
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Status info */}
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-wl-text-secondary" />
                <div>
                  <p className="text-xs text-wl-text-secondary font-medium">
                    Current Status
                  </p>
                  <p className="text-sm font-semibold text-wl-text-primary">
                    {statusSteps[currentIndex].label}
                  </p>
                </div>
              </div>

              {estimatedDelivery && (
                <div className="text-right">
                  <p className="text-xs text-wl-text-secondary font-medium">
                    Est. Delivery
                  </p>
                  <p className="text-sm font-semibold text-wl-text-primary">
                    {formatDate(estimatedDelivery)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile vertical stepper */}
        <div className="sm:hidden space-y-3">
          {statusSteps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={step.id} className="flex gap-3">
                {/* Step circle */}
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0",
                    "transition-all duration-300 ease-default",
                    hasException && isCurrent
                      ? "bg-wl-danger-500 text-white ring-2 ring-wl-danger-500/30"
                      : isCompleted
                        ? "bg-wl-success-500 text-white"
                        : isCurrent
                          ? "bg-wl-primary-500 text-white ring-2 ring-wl-primary-500/30"
                          : "bg-wl-bg-overlay border-2 border-wl-border-subtle text-wl-text-secondary",
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle size={18} />
                  ) : isCurrent ? (
                    step.icon
                  ) : (
                    <Circle size={14} />
                  )}
                </div>

                {/* Step info */}
                <div className="flex-1">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isCompleted
                        ? "text-wl-success-400"
                        : isCurrent
                          ? "text-wl-primary-400"
                          : "text-wl-text-secondary",
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-wl-text-tertiary mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Mobile status info */}
          <div className="mt-4 p-3 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle space-y-2">
            <div>
              <p className="text-xs text-wl-text-secondary font-medium">
                Current Status
              </p>
              <p className="text-sm font-semibold text-wl-text-primary">
                {statusSteps[currentIndex].label}
              </p>
            </div>

            {estimatedDelivery && (
              <div>
                <p className="text-xs text-wl-text-secondary font-medium">
                  Est. Delivery
                </p>
                <p className="text-sm font-semibold text-wl-text-primary">
                  {formatDate(estimatedDelivery)}
                </p>
              </div>
            )}

            {carrier && (
              <div>
                <p className="text-xs text-wl-text-secondary font-medium">
                  Carrier
                </p>
                <p className="text-sm font-semibold text-wl-text-primary">
                  {carrier}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

StatusStepper.displayName = "StatusStepper";

export { StatusStepper };
export type { ShipmentStatus };
