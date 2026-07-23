"use client";

import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui";
import type { PaymentStatus } from "./types";

interface PaymentStatusBadgeProps extends HTMLAttributes<HTMLDivElement> {
  status: PaymentStatus;
  amount: number;
  currency?: string;
  timestamp?: string;
  referenceNumber?: string;
  method?: string;
  showDetails?: boolean;
  onRetry?: () => void;
  onViewDetails?: () => void;
}

const statusConfig: Record<
  PaymentStatus,
  { bgClass: string; textClass: string; indicatorClass: string; label: string }
> = {
  pending: {
    bgClass: "bg-wl-warning-bg",
    textClass: "text-wl-warning-400",
    indicatorClass: "bg-wl-warning-400 animate-pulse",
    label: "Pending",
  },
  processing: {
    bgClass: "bg-wl-info-bg",
    textClass: "text-wl-info-400",
    indicatorClass: "bg-wl-info-400 animate-spin",
    label: "Processing",
  },
  completed: {
    bgClass: "bg-wl-success-bg",
    textClass: "text-wl-success-400",
    indicatorClass: "bg-wl-success-500",
    label: "Completed",
  },
  failed: {
    bgClass: "bg-wl-danger-bg",
    textClass: "text-wl-danger-400",
    indicatorClass: "bg-wl-danger-400",
    label: "Failed",
  },
  refunded: {
    bgClass: "bg-white/6",
    textClass: "text-wl-text-secondary",
    indicatorClass: "bg-wl-neutral-500",
    label: "Refunded",
  },
};

function formatCurrency(value: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const PaymentStatusBadge = forwardRef<HTMLDivElement, PaymentStatusBadgeProps>(
  (
    {
      status,
      amount,
      currency = "USD",
      timestamp,
      referenceNumber,
      method,
      showDetails = false,
      onRetry,
      onViewDetails,
      className,
      ...props
    },
    ref
  ) => {
    const config = statusConfig[status];
    const isErrorStatus = status === "failed" || status === "refunded";

    const statusIcon = () => {
      switch (status) {
        case "pending":
          return (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          );
        case "processing":
          return (
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          );
        case "completed":
          return (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          );
        case "failed":
          return (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          );
        case "refunded":
          return (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 15L3 9m0 0l6-6m-6 6h18a9 9 0 010 18H9"
              />
            </svg>
          );
        default:
          return null;
      }
    };

    const tooltipContent = (
      <div className="space-y-1 text-xs">
        <p className="font-semibold text-wl-text-primary">
          Payment: {formatCurrency(amount, currency)}
        </p>
        {timestamp && <p className="text-wl-text-secondary">{formatDate(timestamp)}</p>}
        {referenceNumber && <p className="font-mono text-wl-text-tertiary">Ref: {referenceNumber}</p>}
        {method && <p className="text-wl-text-secondary">Method: {method}</p>}
      </div>
    );

    if (showDetails) {
      return (
        <div
          ref={ref}
          className={cn(
            "flex flex-col gap-3 px-4 py-3 rounded-lg",
            "border transition-colors duration-fast",
            config.bgClass,
            config.textClass,
            className
          )}
          {...props}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className={cn("w-3 h-3 rounded-full flex-shrink-0", config.indicatorClass)} />
              <div>
                <p className="text-sm font-semibold">{config.label}</p>
                <p className="text-xs text-wl-text-secondary">{formatCurrency(amount, currency)}</p>
              </div>
            </div>
            <span className="flex-shrink-0">{statusIcon()}</span>
          </div>

          {/* Details */}
          {timestamp && (
            <div className="text-xs space-y-1 border-t border-current border-opacity-20 pt-2">
              <p className="text-wl-text-secondary">Processed: {formatDate(timestamp)}</p>
              {referenceNumber && <p className="font-mono">Ref: {referenceNumber}</p>}
              {method && <p className="text-wl-text-secondary">Method: {method}</p>}
            </div>
          )}

          {/* Actions for failed status */}
          {isErrorStatus && (
            <div className="flex gap-2 pt-2 border-t border-current border-opacity-20">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-xs px-2 py-1 bg-current bg-opacity-20 rounded hover:bg-opacity-30 transition-all"
                >
                  Retry
                </button>
              )}
              {onViewDetails && (
                <button
                  onClick={onViewDetails}
                  className="text-xs px-2 py-1 bg-current bg-opacity-20 rounded hover:bg-opacity-30 transition-all"
                >
                  Details
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={ref}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 rounded-lg",
              "transition-colors duration-fast cursor-pointer hover:shadow-md",
              config.bgClass,
              config.textClass,
              className
            )}
            {...props}
          >
            {/* Status Indicator */}
            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", config.indicatorClass)} />

            {/* Status Label */}
            <span className="font-medium text-sm">{config.label}</span>

            {/* Amount */}
            <span className="font-semibold text-sm">{formatCurrency(amount, currency)}</span>

            {/* Icon */}
            <span className="flex-shrink-0">{statusIcon()}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>
    );
  }
);

PaymentStatusBadge.displayName = "PaymentStatusBadge";
