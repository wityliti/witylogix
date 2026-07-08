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
    color: "text-white",
    bgColor: "bg-red-600",
    borderColor: "border-red-500",
    icon: AlertTriangle,
  },
  high: {
    label: "High",
    description:
      "High priority, delivered soon. Time-sensitive information.",
    color: "text-white",
    bgColor: "bg-orange-500",
    borderColor: "border-orange-400",
    icon: AlertCircle,
  },
  normal: {
    label: "Normal",
    description: "Standard priority. Most common notification type.",
    color: "text-white",
    bgColor: "bg-blue-600",
    borderColor: "border-blue-500",
    icon: MessageSquare,
  },
  low: {
    label: "Low",
    description: "Low priority. Can be batched or delayed.",
    color: "text-[var(--wl-text-primary)]",
    bgColor: "bg-wl-bg-overlay",
    borderColor: "border-wl-border-subtle",
    icon: Clock,
  },
  digest: {
    label: "Digest",
    description: "Bundle with other digest notifications once per day.",
    color: "text-white",
    bgColor: "bg-purple-600",
    borderColor: "border-purple-500",
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
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wl-primary)]",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isSelected
                      ? cn(config.bgColor, config.color, config.borderColor)
                      : cn(
                          "bg-[var(--wl-bg-secondary)]",
                          "text-[var(--wl-text-primary)]",
                          "border-[var(--wl-border)]",
                          "hover:border-[var(--wl-primary)]"
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
            "bg-[var(--wl-bg-secondary)]",
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
