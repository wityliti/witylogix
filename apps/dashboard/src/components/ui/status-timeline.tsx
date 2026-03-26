"use client";

import { forwardRef, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TimelineOrientation = "vertical" | "horizontal";
export type TimelineStepStatus = "completed" | "active" | "pending";

export interface TimelineStep {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  icon?: ReactNode;
  status?: TimelineStepStatus;
  podImage?: string;
  podLabel?: string;
}

export interface StatusTimelineProps extends HTMLAttributes<HTMLDivElement> {
  steps: TimelineStep[];
  currentStep?: number;
  orientation?: TimelineOrientation;
  showPODImage?: boolean;
}

const statusConfig: Record<
  TimelineStepStatus,
  { dot: string; line: string; label: string }
> = {
  completed: {
    dot: "bg-wl-success-500 border-wl-success-500",
    line: "bg-wl-success-500",
    label: "Completed",
  },
  active: {
    dot: "bg-wl-primary-500 border-wl-primary-500 shadow-lg shadow-wl-primary-500/50",
    line: "bg-wl-primary-500",
    label: "Active",
  },
  pending: {
    dot: "bg-wl-neutral-400 border-wl-neutral-500",
    line: "bg-wl-neutral-400",
    label: "Pending",
  },
};

export const StatusTimeline = forwardRef<HTMLDivElement, StatusTimelineProps>(
  (
    {
      steps,
      currentStep = 0,
      orientation = "vertical",
      showPODImage = true,
      className,
      ...props
    },
    ref
  ) => {
    if (orientation === "horizontal") {
      return (
        <div ref={ref} className={cn("w-full", className)} {...props}>
          {/* Horizontal timeline */}
          <div className="relative">
            {/* Connection line */}
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-wl-border-default">
              {/* Filled portion */}
              <div
                className="h-full bg-wl-success-500 transition-all duration-500"
                style={{ width: `${(currentStep / (steps.length - 1 || 1)) * 100}%` }}
              />
            </div>

            {/* Steps */}
            <div className="relative flex justify-between items-start">
              {steps.map((step, index) => {
                const status = step.status || (index <= currentStep ? "completed" : "pending");
                const config = statusConfig[status];

                return (
                  <div key={step.id} className="flex flex-col items-center gap-2 flex-1">
                    {/* Dot */}
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2 bg-wl-bg-primary",
                        "relative z-10 flex items-center justify-center",
                        "transition-all duration-300",
                        index <= currentStep && "ring-4 ring-wl-success-100 dark:ring-wl-success-900",
                        config.dot
                      )}
                    >
                      {step.icon && (
                        <span className="text-wl-text-inverse text-xs">{step.icon}</span>
                      )}
                    </div>

                    {/* Title */}
                    <div className="text-center">
                      <p className="text-xs font-semibold text-wl-text-primary">
                        {step.title}
                      </p>
                      {step.timestamp && (
                        <p className="text-xs text-wl-text-tertiary">{step.timestamp}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Vertical timeline (default)
    return (
      <div ref={ref} className={cn("space-y-4", className)} {...props}>
        {steps.map((step, index) => {
          const status = step.status || (index <= currentStep ? "completed" : "pending");
          const config = statusConfig[status];
          const isLast = index === steps.length - 1;
          const isActive = index === currentStep;

          return (
            <div key={step.id} className="relative flex gap-4">
              {/* Timeline column */}
              <div className="flex flex-col items-center">
                {/* Dot */}
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 bg-wl-bg-primary",
                    "relative z-10 flex items-center justify-center",
                    "transition-all duration-300",
                    isActive && "ring-4 ring-wl-primary-100 dark:ring-wl-primary-900"
                  )}
                  style={{
                    borderColor: config.dot.match(/border-[\w-]+/)?.[0]?.replace("border-", ""),
                    backgroundColor: config.dot.match(/bg-[\w-]+/)?.[0]?.replace("bg-", ""),
                  }}
                >
                  {step.icon && (
                    <span className="text-wl-text-inverse text-xs">{step.icon}</span>
                  )}
                </div>

                {/* Line connecting to next item */}
                {!isLast && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 min-h-24",
                      status === "completed" ? config.line : "bg-wl-border-default"
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div className={cn("pb-8 flex-1 pt-1", !isLast && "pb-0")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-wl-text-primary text-base">
                      {step.title}
                    </p>
                    {step.description && (
                      <p className="text-sm text-wl-text-secondary mt-1">
                        {step.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap",
                      status === "completed"
                        ? "bg-wl-success-100 text-wl-success-700 dark:bg-wl-success-900 dark:text-wl-success-200"
                        : status === "active"
                          ? "bg-wl-primary-100 text-wl-primary-700 dark:bg-wl-primary-900 dark:text-wl-primary-200"
                          : "bg-wl-neutral-100 text-wl-neutral-700 dark:bg-wl-neutral-900 dark:text-wl-neutral-200"
                    )}
                  >
                    {config.label}
                  </span>
                </div>

                {/* Timestamp */}
                {step.timestamp && (
                  <p className="text-xs text-wl-text-tertiary mt-2">{step.timestamp}</p>
                )}

                {/* POD Image */}
                {showPODImage && step.podImage && status === "completed" && (
                  <div className="mt-3 relative">
                    <img
                      src={step.podImage}
                      alt={step.podLabel || "Proof of delivery"}
                      className="w-24 h-24 object-cover rounded-lg border border-wl-border-subtle shadow-sm"
                    />
                    {step.podLabel && (
                      <p className="text-xs text-wl-text-tertiary mt-1">{step.podLabel}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
);

StatusTimeline.displayName = "StatusTimeline";

