"use client";

import { cn } from "@/lib/utils";

type ProgressVariant = "primary" | "success" | "warning" | "danger";

interface ProgressProps {
  value: number;
  variant?: ProgressVariant;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

const variantClasses: Record<ProgressVariant, string> = {
  primary: "bg-gradient-to-r from-wl-primary-500 to-wl-primary-600",
  success: "bg-gradient-to-r from-wl-success-500 to-wl-success-600",
  warning: "bg-gradient-to-r from-wl-warning-500 to-wl-warning-600",
  danger: "bg-gradient-to-r from-wl-danger-500 to-wl-danger-600",
};

const Progress = ({
  value,
  variant = "primary",
  showLabel = false,
  label,
  className,
}: ProgressProps) => {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const displayLabel = label || `${clampedValue}%`;

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-wl-text-secondary">
            Progress
          </span>
          <span className="text-sm font-semibold text-wl-text-primary">
            {displayLabel}
          </span>
        </div>
      )}
      <div
        className={cn(
          "relative w-full h-2 rounded-full",
          "bg-wl-bg-overlay",
          "overflow-hidden",
        )}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full",
            "transition-all duration-300 ease-out",
            variantClasses[variant],
            "shadow-lg",
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};

export { Progress };
