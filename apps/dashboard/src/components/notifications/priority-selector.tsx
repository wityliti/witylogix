"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { AlertTriangle, AlertCircle, MessageSquare, Clock, Zap } from "lucide-react";

export type NotificationPriority = "critical" | "high" | "normal" | "low" | "digest";

interface PrioritySelectorProps {
  value: NotificationPriority;
  onChange?: (priority: NotificationPriority) => void;
  disabled?: boolean;
  className?: string;
}

interface PriorityConfig {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIORITY_CONFIG: Record<NotificationPriority, PriorityConfig> = {
  critical: {
    label: "Critical",
    description:
      "Immediate delivery, interrupts user. Use for emergencies only.",
    color: "text-wl-text-inverse",
    bgColor: "bg-wl-danger-600",
    borderColor: "border-wl-danger-500",
    icon: AlertTriangle,
  },
  high: {
    label: "High",
    description:
      "High priority, delivered soon. Time-sensitive information.",
    color: "text-wl-text-inverse",
    bgColor: "bg-wl-warning-500",
    borderColor: "border-wl-warning-400",
    icon: AlertCircle,
  },
  normal: {
    label: "Normal",
    description: "Standard priority. Most common notification type.",
    color: "text-wl-text-inverse",
    bgColor: "bg-wl-info-500",
    borderColor: "border-wl-info-400",
    icon: MessageSquare,
  },
  low: {
    label: "Low",
    description: "Low priority. Can be batched or delayed.",
    color: "text-wl-text-primary",
    bgColor: "bg-wl-neutral-500",
    borderColor: "border-wl-neutral-400",
    icon: Clock,
  },
  digest: {
    label: "Digest",
    description: "Bundle with other digest notifications once per day.",
    color: "text-wl-text-inverse",
    bgColor: "bg-wl-primary-600",
    borderColor: "border-wl-primary-500",
    icon: Zap,
  },
};

const PRIORITY_ORDER: NotificationPriority[] = [
  "critical",
  "high",
  "normal",
  "low",
  "digest",
];

export const PrioritySelector = React.memo(
  ({
    value,
    onChange,
    disabled = false,
    className,
  }: PrioritySelectorProps) => {
    const currentConfig = useMemo(
      () => PRIORITY_CONFIG[value],
      [value]
    );

    return (
      <div className={cn("space-y-4", className)}>
        <label className="block text-sm font-semibold text-[var(--wl-text-primary)]">
          Priority Level
        </label>

        <div className="flex flex-wrap gap-2">
          {PRIORITY_ORDER.map((priority) => {
            const config = PRIORITY_CONFIG[priority];
            const Icon = config.icon;
            const isSelected = value === priority;

            return (
              <Tooltip key={priority} content={config.description}>
                <button
                  onClick={() => onChange?.(priority)}
                  disabled={disabled}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-md",
                    "transition-all duration-200 font-medium text-sm",
                    "border-2",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wl-primary-500",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isSelected
                      ? cn(config.bgColor, config.color, config.borderColor)
                      : cn(
                          "bg-wl-bg-elevated",
                          "text-[var(--wl-text-primary)]",
                          "border-wl-border-default",
                          "hover:border-wl-primary-500"
                        )
                  )}
                  aria-pressed={isSelected}
                  aria-label={`Priority: ${config.label}`}
                >
                  <Icon className="w-4 h-4" />
                  {config.label}
                </button>
              </Tooltip>
            );
          })}
        </div>

        {/* Current selection description */}
        <div
          className={cn(
            "px-4 py-3 rounded-md border-2",
            "bg-wl-bg-elevated",
            currentConfig.borderColor
          )}
        >
          <p className="text-sm font-semibold text-[var(--wl-text-primary)]">
            {currentConfig.label}
          </p>
          <p className="text-xs text-[var(--wl-text-secondary)] mt-1">
            {currentConfig.description}
          </p>
        </div>
      </div>
    );
  }
);

PrioritySelector.displayName = "PrioritySelector";
