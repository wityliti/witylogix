"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { PlatformLogo, type Platform } from "./platform-logo";

type ConnectionStatus = "connected" | "disconnected" | "error";

interface PlatformConnectionBadgeProps extends HTMLAttributes<HTMLDivElement> {
  /** E-commerce platform */
  platform: Platform;
  /** Connection status */
  status?: ConnectionStatus;
  /** Last sync timestamp */
  lastSyncAt?: Date | null;
  /** Callback when reconnect is clicked */
  onReconnect?: () => void;
}

const statusConfig: Record<
  ConnectionStatus,
  {
    bgColor: string;
    textColor: string;
    dotColor: string;
    label: string;
  }
> = {
  connected: {
    bgColor: "bg-green-50 dark:bg-green-500/10",
    textColor: "text-green-700 dark:text-green-400",
    dotColor: "bg-green-500",
    label: "Connected",
  },
  disconnected: {
    bgColor: "bg-wl-neutral-500/10",
    textColor: "text-wl-text-primary dark:text-wl-text-secondary",
    dotColor: "bg-wl-neutral-400",
    label: "Disconnected",
  },
  error: {
    bgColor: "bg-red-50 dark:bg-red-500/10",
    textColor: "text-red-700 dark:text-red-400",
    dotColor: "bg-red-500",
    label: "Error",
  },
};

const formatLastSync = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
};

/**
 * Platform connection badge showing connection status and last sync time
 *
 * @example
 * ```tsx
 * <PlatformConnectionBadge
 *   platform="shopify"
 *   status="connected"
 *   lastSyncAt={new Date()}
 * />
 * <PlatformConnectionBadge
 *   platform="woocommerce"
 *   status="error"
 *   onReconnect={() => handleReconnect()}
 * />
 * ```
 */
const PlatformConnectionBadge = forwardRef<
  HTMLDivElement,
  PlatformConnectionBadgeProps
>(
  (
    {
      platform,
      status = "connected",
      lastSyncAt,
      onReconnect,
      className,
      ...props
    },
    ref,
  ) => {
    const config = statusConfig[status];

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2",
          "px-3 py-2 rounded-lg",
          "border border-transparent",
          "transition-all duration-200 ease-default",
          config.bgColor,
          config.textColor,
          status === "error" &&
            "cursor-pointer hover:border-red-200 dark:hover:border-red-900",
          className,
        )}
        onClick={() => status === "error" && onReconnect?.()}
        aria-label={`${platform} connection status: ${status}`}
        {...props}
      >
        {/* Status indicator dot with pulse animation */}
        <div className="relative">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              config.dotColor,
              status === "connected" && "animate-pulse",
            )}
            aria-hidden="true"
          />
        </div>

        {/* Platform logo and name */}
        <PlatformLogo platform={platform} size="sm" showFallback />

        {/* Platform name and status */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="text-xs font-semibold truncate capitalize">
            {platform}
          </div>
          <div className="text-xs opacity-75">
            {status === "error" && "Click to reconnect"}
            {status !== "error" && lastSyncAt && (
              <>Synced {formatLastSync(lastSyncAt)}</>
            )}
            {status !== "error" && !lastSyncAt && "Never synced"}
          </div>
        </div>

        {/* Reconnect button hint for error state */}
        {status === "error" && (
          <div className="ml-auto text-xs font-semibold">→</div>
        )}
      </div>
    );
  },
);

PlatformConnectionBadge.displayName = "PlatformConnectionBadge";

export { PlatformConnectionBadge };
export type { ConnectionStatus };
