"use client";

import { cn } from "@/lib/utils";

type ComplianceStatus = "compliant" | "warning" | "violation" | "exempt";
type BadgeSize = "sm" | "md" | "lg";

interface ComplianceBadgeProps {
  status: ComplianceStatus;
  label?: string;
  details?: string;
  size?: BadgeSize;
  showIcon?: boolean;
  pulse?: boolean;
  className?: string;
}

/**
 * Compliance Badge Component
 * Displays driver compliance status with configurable states and sizes
 * Includes tooltip with details on hover
 */
export function ComplianceBadge({
  status,
  label,
  details,
  size = "md",
  showIcon = true,
  pulse = status === "violation",
  className,
}: ComplianceBadgeProps) {
  // Size configuration
  const sizeClasses = {
    sm: "text-xs px-2 py-1 h-6",
    md: "text-sm px-3 py-1.5 h-7",
    lg: "text-base px-4 py-2 h-9",
  };

  const iconSize = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  // Status configuration
  const statusConfig = {
    compliant: {
      bg: "bg-wl-success-500/20",
      text: "text-wl-success-400",
      border: "border-wl-success-500/30",
      icon: "✓",
      defaultLabel: "Compliant",
      description: "Driver is in compliance with all HOS regulations",
    },
    warning: {
      bg: "bg-wl-warning-500/20",
      text: "text-wl-warning-400",
      border: "border-wl-warning-500/30",
      icon: "⚠",
      defaultLabel: "Warning",
      description: "Driver approaching HOS violation threshold",
    },
    violation: {
      bg: "bg-wl-danger-500/20",
      text: "text-wl-danger-400",
      border: "border-wl-danger-500/30",
      icon: "✕",
      defaultLabel: "Violation",
      description: "Driver is in HOS violation - immediate action required",
    },
    exempt: {
      bg: "bg-wl-text-secondary/10",
      text: "text-wl-text-secondary",
      border: "border-wl-text-secondary/20",
      icon: "ℹ",
      defaultLabel: "Exempt",
      description: "Driver exempt from HOS regulations",
    },
  };

  const config = statusConfig[status];
  const displayLabel = label || config.defaultLabel;

  return (
    <div className={cn("relative inline-block", className)}>
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border font-medium transition-all",
          sizeClasses[size],
          config.bg,
          config.text,
          config.border,
          pulse && "animate-pulse",
          details && "cursor-help",
        )}
        title={details || config.description}
      >
        {showIcon && (
          <span
            className={cn(iconSize[size], "flex items-center justify-center")}
          >
            {config.icon}
          </span>
        )}
        <span className="whitespace-nowrap">{displayLabel}</span>
      </div>

      {/* Tooltip on hover */}
      {details && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 hover:opacity-100 transition-opacity z-50 pointer-events-none hover:pointer-events-auto">
          <div
            className={cn(
              "bg-wl-bg-elevated border border-wl-border-default rounded-md p-2 shadow-lg",
              size === "sm"
                ? "text-xs w-40"
                : size === "md"
                  ? "text-xs w-48"
                  : "text-sm w-56",
            )}
          >
            <p className="text-wl-text-secondary">{details}</p>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-wl-bg-elevated border-r border-b border-wl-border-default" />
          </div>
        </div>
      )}
    </div>
  );
}
