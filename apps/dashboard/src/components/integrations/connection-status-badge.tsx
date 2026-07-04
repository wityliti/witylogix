"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "syncing"
  | "pending";

type BadgeMode = "compact" | "full";

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  lastSyncAt?: Date;
  errorCount?: number;
  mode?: BadgeMode;
  showTooltip?: boolean;
  className?: string;
}

/**
 * Connection Status Badge Component
 * Displays integration connection status with visual indicators
 * States: connected (green pulse), disconnected (gray), error (red), syncing (blue animated), pending (yellow)
 * Supports compact mode for tables and full mode with labels
 */
export function ConnectionStatusBadge({
  status,
  lastSyncAt,
  errorCount = 0,
  mode = "full",
  showTooltip = true,
  className,
}: ConnectionStatusBadgeProps) {
  const [showingTooltip, setShowingTooltip] = useState(false);

  const getStatusConfig = (
    status: ConnectionStatus,
  ): {
    color: string;
    bgColor: string;
    dotClass: string;
    label: string;
  } => {
    switch (status) {
      case "connected":
        return {
          color: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-100 dark:bg-green-900/30",
          dotClass: "bg-green-500 animate-pulse",
          label: "Connected",
        };
      case "disconnected":
        return {
          color: "text-wl-text-tertiary dark:text-wl-text-secondary",
          bgColor: "bg-wl-bg-surface dark:bg-wl-bg-elevated",
          dotClass: "bg-wl-neutral-400",
          label: "Disconnected",
        };
      case "error":
        return {
          color: "text-red-600 dark:text-red-400",
          bgColor: "bg-red-100 dark:bg-red-900/30",
          dotClass: "bg-red-500",
          label: "Error",
        };
      case "syncing":
        return {
          color: "text-blue-600 dark:text-blue-400",
          bgColor: "bg-blue-100 dark:bg-blue-900/30",
          dotClass: "bg-blue-500 animate-spin",
          label: "Syncing",
        };
      case "pending":
        return {
          color: "text-yellow-600 dark:text-yellow-400",
          bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
          dotClass: "bg-yellow-500 animate-pulse",
          label: "Pending",
        };
      default:
        return {
          color: "text-wl-text-tertiary dark:text-wl-text-secondary",
          bgColor: "bg-wl-bg-surface dark:bg-wl-bg-elevated",
          dotClass: "bg-wl-neutral-400",
          label: "Unknown",
        };
    }
  };

  const config = getStatusConfig(status);

  const tooltipContent = () => {
    if (!showTooltip) return null;

    const lines: string[] = [];

    if (lastSyncAt) {
      const syncDate = new Date(lastSyncAt);
      lines.push(`Last sync: ${syncDate.toLocaleString()}`);
    }

    if (errorCount > 0) {
      lines.push(`Errors: ${errorCount}`);
    }

    if (lines.length === 0) {
      lines.push("No sync history");
    }

    return lines.join("\n");
  };

  if (mode === "compact") {
    return (
      <div
        className={cn("relative inline-flex items-center", className)}
        onMouseEnter={() => setShowingTooltip(true)}
        onMouseLeave={() => setShowingTooltip(false)}
        title={tooltipContent() || undefined}
      >
        <div
          className={cn("w-2.5 h-2.5 rounded-full", config.dotClass)}
          aria-label={config.label}
        />

        {showingTooltip && tooltipContent() && (
          <div
            className={cn(
              "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10",
              "px-2 py-1 rounded text-xs whitespace-nowrap",
              "bg-wl-bg-surface text-white dark:bg-wl-bg-elevated",
              "shadow-lg",
            )}
          >
            {tooltipContent()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
        config.bgColor,
        config.color,
        "transition-all duration-200",
        className,
      )}
      onMouseEnter={() => setShowingTooltip(true)}
      onMouseLeave={() => setShowingTooltip(false)}
    >
      <div className={cn("w-2 h-2 rounded-full", config.dotClass)} />
      <span>{config.label}</span>

      {errorCount > 0 && status === "error" && (
        <span className="ml-1 text-xs opacity-75">({errorCount})</span>
      )}

      {showingTooltip && tooltipContent() && (
        <div
          className={cn(
            "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10",
            "px-2 py-1 rounded text-xs whitespace-nowrap",
            "bg-wl-bg-surface text-white dark:bg-wl-bg-elevated",
            "shadow-lg",
          )}
        >
          {tooltipContent()}
        </div>
      )}
    </div>
  );
}
