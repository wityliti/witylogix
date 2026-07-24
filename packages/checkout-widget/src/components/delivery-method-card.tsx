"use client";

import { ReactNode } from "react";
import { cn } from "../utils/cn";
import type { DeliveryMethod } from "../types";

export interface DeliveryMethodCardProps {
  method: DeliveryMethod;
  isSelected?: boolean;
  isDisabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
  className?: string;
}

const methodIcons: Record<string, string> = {
  standard: "🚚",
  express: "⚡",
  pickup: "🏪",
};

const getIcon = (methodId: string): string => {
  return methodIcons[methodId] || "📦";
};

export function DeliveryMethodCard({
  method,
  isSelected = false,
  isDisabled = !method.enabled,
  disabledReason,
  onClick,
  className,
}: DeliveryMethodCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        "relative p-4 rounded-lg border-2 transition-all duration-200",
        "text-left w-full",
        isDisabled
          ? "bg-wl-bg-secondary border-wl-border-subtle opacity-50 cursor-not-allowed"
          : isSelected
            ? "bg-wl-primary-100 border-wl-primary-500 dark:bg-wl-primary-900 dark:border-wl-primary-400"
            : "bg-wl-bg-secondary border-wl-border-default hover:border-wl-primary-500 hover:shadow-sm",
        className,
      )}
      aria-pressed={isSelected}
      aria-disabled={isDisabled}
      role="radio"
    >
      <div className="space-y-3">
        {/* Header with icon and method name */}
        <div className="flex items-start gap-3">
          <span className="text-3xl">{getIcon(method.id)}</span>
          <div className="flex-1">
            <h3 className="font-semibold text-wl-text-primary">
              {method.name}
            </h3>
            <p className="text-sm text-wl-text-secondary">
              {method.description}
            </p>
          </div>
        </div>

        {/* Estimated time and price */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-wl-text-tertiary">⏱️</span>
            <span className="text-sm text-wl-text-secondary">
              {method.estimatedTime}
            </span>
          </div>
          <div className="text-lg font-bold text-wl-text-primary">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(method.price)}
          </div>
        </div>

        {/* Disabled reason */}
        {isDisabled && disabledReason && (
          <div className="text-xs text-wl-danger-600 dark:text-wl-danger-400 px-2 py-1 bg-wl-danger-50 dark:bg-wl-danger-900 rounded">
            {disabledReason}
          </div>
        )}
      </div>

      {/* Selection radio button */}
      <div
        className={cn(
          "absolute top-4 right-4 w-5 h-5 rounded-full border-2 transition-all",
          isSelected
            ? "border-wl-primary-500 bg-wl-primary-500"
            : "border-wl-border-default bg-wl-bg-primary",
        )}
      >
        {isSelected && (
          <div className="w-full h-full flex items-center justify-center text-white">
            <span className="text-xs font-bold">✓</span>
          </div>
        )}
      </div>
    </button>
  );
}
