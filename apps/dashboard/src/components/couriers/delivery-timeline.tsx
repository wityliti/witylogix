"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  MapPin,
  Package,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { LocationInfo } from "@witylogix/core/integrations/couriers";

interface DeliveryEvent {
  id: string;
  type: "requested" | "assigned" | "pickup" | "in_transit" | "delivered";
  timestamp: Date;
  courierName?: string;
  location?: LocationInfo;
  notes?: string;
}

interface Delivery {
  id: string;
  orderId: string;
  status: string;
  createdAt: Date;
  assignedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  estimatedDeliveryTime?: Date;
  notes?: string;
  timeline: DeliveryEvent[];
}

interface DeliveryTimelineProps {
  delivery: Delivery;
}

interface TimelineStep {
  type: DeliveryEvent["type"];
  label: string;
  timestamp?: Date;
  courierName?: string;
  location?: LocationInfo;
  notes?: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

export function DeliveryTimeline({ delivery }: DeliveryTimelineProps) {
  const [expandedStep, setExpandedStep] = useState<
    DeliveryEvent["type"] | null
  >(null);

  // Build timeline steps
  const steps = useMemo<TimelineStep[]>(() => {
    const eventMap = new Map(delivery.timeline.map((e) => [e.type, e]));

    const statusOrder: DeliveryEvent["type"][] = [
      "requested",
      "assigned",
      "pickup",
      "in_transit",
      "delivered",
    ];
    const builtSteps: TimelineStep[] = [];

    statusOrder.forEach((type) => {
      const event = eventMap.get(type);
      const isCompleted = !!event;
      const isCurrent =
        delivery.timeline[delivery.timeline.length - 1]?.type === type;

      builtSteps.push({
        type,
        label: getLabelForType(type),
        timestamp: event?.timestamp,
        courierName: event?.courierName,
        location: event?.location,
        notes: event?.notes,
        isCompleted,
        isCurrent,
      });
    });

    return builtSteps;
  }, [delivery.timeline]);

  const isOverdue = useMemo(() => {
    if (!delivery.estimatedDeliveryTime || delivery.status === "delivered") {
      return false;
    }
    return new Date() > delivery.estimatedDeliveryTime;
  }, [delivery.estimatedDeliveryTime, delivery.status]);

  const formattedDeliveryTime = useMemo(() => {
    if (delivery.deliveredAt) {
      return formatTime(delivery.deliveredAt);
    }
    if (delivery.estimatedDeliveryTime) {
      const now = new Date();
      const diffMs = delivery.estimatedDeliveryTime.getTime() - now.getTime();
      const minutes = Math.floor(diffMs / 60000);
      if (minutes > 0) {
        return `${minutes} min`;
      }
      return "Soon";
    }
    return null;
  }, [delivery.deliveredAt, delivery.estimatedDeliveryTime]);

  return (
    <div className="space-y-3">
      {/* Delivery Status Header */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-wl-text-primary text-sm">
            Delivery Progress
          </h4>
          {delivery.estimatedDeliveryTime && (
            <p
              className={cn(
                "text-xs mt-1",
                isOverdue
                  ? "text-wl-danger-400 font-medium"
                  : "text-wl-text-secondary",
              )}
            >
              {isOverdue ? "⚠ Overdue" : "ETA"}:{" "}
              {formatTime(delivery.estimatedDeliveryTime)}
            </p>
          )}
        </div>
        {formattedDeliveryTime && delivery.status === "delivered" && (
          <Badge variant="success" dot>
            Delivered
          </Badge>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isExpanded = expandedStep === step.type;
          const hasNext = index < steps.length - 1;
          const nextStepCompleted = steps[index + 1]?.isCompleted;

          return (
            <div key={step.type}>
              {/* Timeline Item */}
              <div
                onClick={() => setExpandedStep(isExpanded ? null : step.type)}
                className={cn(
                  "flex gap-3 cursor-pointer p-2 rounded-lg transition-colors",
                  step.isCurrent && "bg-wl-primary-500/10",
                  isExpanded && "bg-wl-bg-overlay",
                )}
              >
                {/* Timeline Indicator */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold",
                      step.isCompleted
                        ? "bg-wl-success-400 text-wl-bg-primary"
                        : step.isCurrent
                          ? "bg-wl-primary-500 text-wl-text-inverse ring-2 ring-wl-primary-400 animate-pulse"
                          : "bg-wl-bg-overlay border border-wl-border-default text-wl-text-tertiary",
                    )}
                  >
                    {step.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  {hasNext && (
                    <div
                      className={cn(
                        "w-0.5 h-6 mt-2",
                        nextStepCompleted
                          ? "bg-wl-success-400"
                          : "bg-wl-border-subtle",
                      )}
                    />
                  )}
                </div>

                {/* Timeline Content */}
                <div className="flex-1 min-w-0 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          step.isCompleted
                            ? "text-wl-text-primary"
                            : "text-wl-text-secondary",
                        )}
                      >
                        {step.label}
                      </p>
                      {step.timestamp && (
                        <p className="text-xs text-wl-text-secondary mt-0.5">
                          {formatRelativeTime(step.timestamp)}
                        </p>
                      )}
                      {step.courierName && (
                        <p className="text-xs text-wl-text-secondary mt-0.5">
                          by {step.courierName}
                        </p>
                      )}
                    </div>
                    {(step.notes || step.location) && (
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-wl-text-tertiary flex-shrink-0 transition-transform",
                          isExpanded && "rotate-180",
                        )}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (step.notes || step.location) && (
                <div className="ml-9 mt-2 space-y-2 bg-wl-bg-overlay rounded-lg p-3 border border-wl-border-subtle">
                  {step.location && (
                    <div className="flex gap-2 text-xs text-wl-text-secondary">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-wl-text-primary">
                          {step.location.name || "Location"}
                        </p>
                        <p className="line-clamp-2">
                          {step.location.address ||
                            `${step.location.latitude}, ${step.location.longitude}`}
                        </p>
                      </div>
                    </div>
                  )}
                  {step.notes && (
                    <div className="text-xs text-wl-text-secondary pt-2 border-t border-wl-border-subtle">
                      <p className="font-medium text-wl-text-primary mb-1">
                        Notes
                      </p>
                      <p>{step.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overdue Warning */}
      {isOverdue && delivery.status !== "delivered" && (
        <div className="flex gap-2 p-3 rounded-lg bg-wl-danger-bg border border-wl-danger-400/20">
          <AlertCircle className="w-4 h-4 text-wl-danger-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-wl-danger-400">
            <p className="font-medium">Delivery overdue</p>
            <p className="text-wl-danger-400/80 mt-0.5">
              {delivery.estimatedDeliveryTime &&
                `Was due ${formatRelativeTime(delivery.estimatedDeliveryTime)} ago`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function getLabelForType(type: DeliveryEvent["type"]): string {
  switch (type) {
    case "requested":
      return "Order Placed";
    case "assigned":
      return "Courier Assigned";
    case "pickup":
      return "Picked Up";
    case "in_transit":
      return "In Transit";
    case "delivered":
      return "Delivered";
    default:
      return type;
  }
}

function formatTime(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateObj = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (dateObj.getTime() === today.getTime()) {
    return time;
  }

  return (
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    time
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${diffDays}d ago`;
}
