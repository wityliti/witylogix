"use client";

import { type ReactNode, type CSSProperties } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

type EmptyStateVariant = "no-data" | "no-results" | "no-access";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary" | "ghost";
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  variant?: EmptyStateVariant;
  style?: CSSProperties;
  className?: string;
}

/**
 * Illustration variants for common empty states
 */
const illustrationVariants: Record<
  EmptyStateVariant,
  React.ComponentType<{ className?: string }>
> = {
  "no-data": function NoDataIllustration({
    className,
  }: {
    className?: string;
  }) {
    return (
      <svg
        className={cn("w-24 h-24", className)}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="15"
          y="25"
          width="70"
          height="50"
          rx="3"
          fill="var(--wl-bg-surface)"
          stroke="var(--wl-border-default)"
          strokeWidth="2"
        />
        <circle cx="35" cy="40" r="4" fill="var(--wl-border-subtle)" />
        <line
          x1="15"
          y1="50"
          x2="85"
          y2="50"
          stroke="var(--wl-border-subtle)"
          strokeWidth="1"
        />
        <circle
          cx="30"
          cy="65"
          r="5"
          fill="var(--wl-primary-500)"
          opacity="0.3"
        />
        <circle
          cx="50"
          cy="62"
          r="7"
          fill="var(--wl-primary-500)"
          opacity="0.3"
        />
        <circle
          cx="70"
          cy="68"
          r="4"
          fill="var(--wl-primary-500)"
          opacity="0.3"
        />
      </svg>
    );
  },
  "no-results": function NoResultsIllustration({
    className,
  }: {
    className?: string;
  }) {
    return (
      <svg
        className={cn("w-24 h-24", className)}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="35"
          cy="40"
          r="20"
          stroke="var(--wl-border-default)"
          strokeWidth="2"
        />
        <line
          x1="50"
          y1="55"
          x2="75"
          y2="75"
          stroke="var(--wl-border-default)"
          strokeWidth="2"
        />
        <line
          x1="25"
          y1="30"
          x2="45"
          y2="50"
          stroke="var(--wl-danger-400)"
          strokeWidth="2"
          opacity="0.6"
        />
        <line
          x1="45"
          y1="30"
          x2="25"
          y2="50"
          stroke="var(--wl-danger-400)"
          strokeWidth="2"
          opacity="0.6"
        />
      </svg>
    );
  },
  "no-access": function NoAccessIllustration({
    className,
  }: {
    className?: string;
  }) {
    return (
      <svg
        className={cn("w-24 h-24", className)}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="30"
          y="35"
          width="40"
          height="45"
          rx="2"
          stroke="var(--wl-border-default)"
          strokeWidth="2"
        />
        <path
          d="M35 40V35C35 28 40 25 50 25C60 25 65 28 65 35V40"
          stroke="var(--wl-border-default)"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="50" cy="60" r="4" fill="var(--wl-danger-400)" />
        <line
          x1="40"
          y1="75"
          x2="60"
          y2="75"
          stroke="var(--wl-border-default)"
          strokeWidth="2"
        />
      </svg>
    );
  },
};

/**
 * Empty state component for displaying no data, no results, or access denied states
 * Includes icon, message, and optional action buttons
 *
 * @example
 * <EmptyState
 *   title="No deliveries"
 *   description="Start by creating a new delivery route"
 *   action={{ label: 'Create Delivery', onClick: () => {} }}
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "no-data",
  style,
  className,
}: EmptyStateProps) {
  const DefaultIcon = illustrationVariants[variant];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        "p-12 min-h-80 text-center",
        className,
      )}
      style={style}
    >
      {/* Icon or illustration */}
      <div className="flex items-center justify-center mb-6 text-wl-text-secondary">
        {icon || <DefaultIcon />}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-wl-text-primary mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-wl-text-secondary mb-6 max-w-96">
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div
          className={cn(
            "flex flex-col gap-3",
            action && secondaryAction && "sm:flex-row",
          )}
        >
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || "primary"}
              size="md"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="secondary"
              size="md"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export { type EmptyStateVariant };
