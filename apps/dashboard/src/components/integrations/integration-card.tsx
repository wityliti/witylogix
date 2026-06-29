"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { IntegrationLogo } from "./integration-logo";
import { ConnectionStatusBadge } from "./connection-status-badge";

type ConnectionStatus = "available" | "connected" | "error" | "syncing";
type IntegrationCategory =
  | "ecommerce"
  | "payment"
  | "communication"
  | "automation"
  | "analytics"
  | "routing"
  | "maps";
type AuthMethod = "oauth" | "api-key" | "basic" | "bearer";

interface IntegrationCardProps {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  status: ConnectionStatus;
  authMethod?: AuthMethod;
  webhookSupport?: boolean;
  lastSyncAt?: Date;
  errorCount?: number;
  onConnect?: (integrationId: string) => void;
  onManage?: (integrationId: string) => void;
  onReconnect?: (integrationId: string) => void;
  className?: string;
}

/**
 * Integration Card Component
 * Displays a single integration with provider info, status, and quick actions
 * Features: logo, name, category badge, description, status indicator, auth method icon, webhook support
 * Responsive: full width on mobile, card layout on desktop
 */
export function IntegrationCard({
  id,
  name,
  category,
  description,
  status,
  authMethod,
  webhookSupport,
  lastSyncAt,
  errorCount = 0,
  onConnect,
  onManage,
  onReconnect,
  className,
}: IntegrationCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Truncate description to 2 lines
  const truncatedDescription = description.split("\n").slice(0, 2).join("\n");

  const statusConfig: Record<
    ConnectionStatus,
    { color: string; label: string; bgColor: string }
  > = {
    available: {
      color: "text-wl-text-tertiary dark:text-wl-text-secondary",
      label: "Available",
      bgColor: "bg-wl-bg-surface dark:bg-wl-bg-elevated",
    },
    connected: {
      color: "text-green-600 dark:text-green-400",
      label: "Connected",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
    error: {
      color: "text-red-600 dark:text-red-400",
      label: "Error",
      bgColor: "bg-red-100 dark:bg-red-900/30",
    },
    syncing: {
      color: "text-blue-600 dark:text-blue-400",
      label: "Syncing",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
  };

  const currentStatusConfig = statusConfig[status];

  const getActionButton = () => {
    switch (status) {
      case "available":
        return {
          label: "Connect",
          onClick: () => {
            setIsActionLoading(true);
            onConnect?.(id);
            setTimeout(() => setIsActionLoading(false), 300);
          },
        };
      case "connected":
        return {
          label: "Manage",
          onClick: () => {
            setIsActionLoading(true);
            onManage?.(id);
            setTimeout(() => setIsActionLoading(false), 300);
          },
        };
      case "error":
        return {
          label: "Reconnect",
          onClick: () => {
            setIsActionLoading(true);
            onReconnect?.(id);
            setTimeout(() => setIsActionLoading(false), 300);
          },
        };
      case "syncing":
        return {
          label: "Syncing...",
          onClick: undefined,
          disabled: true,
        };
      default:
        return { label: "Connect", onClick: () => onConnect?.(id) };
    }
  };

  const actionButton = getActionButton();

  return (
    <div
      className={cn(
        "w-full rounded-lg border transition-all duration-200",
        "bg-wl-bg-surface border-wl-border-subtle",
        isHovering && "border-wl-border-default shadow-md",
        className
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="p-4 sm:p-6">
        {/* Header section with logo and status badge */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <IntegrationLogo provider={name} category={category} size="md" />
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-wl-text-primary mb-1 truncate">
                {name}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium capitalize",
                    "bg-wl-surface-hover text-wl-text-secondary"
                  )}
                >
                  {category}
                </span>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className={cn(currentStatusConfig.bgColor, currentStatusConfig.color)}>
            <ConnectionStatusBadge
              status={
                status === "available"
                  ? "disconnected"
                  : status === "error"
                    ? "error"
                    : status === "syncing"
                      ? "syncing"
                      : "connected"
              }
              mode="compact"
              showTooltip={false}
              className="mt-0.5"
            />
          </div>
        </div>

        {/* Description section */}
        <p className="text-sm text-wl-text-secondary mb-4 line-clamp-2">
          {truncatedDescription || "No description provided"}
        </p>

        {/* Features section */}
        <div className="mb-4 flex flex-wrap gap-2">
          {authMethod && (
            <span
              className={cn(
                "px-2 py-1 rounded text-xs font-medium",
                "bg-wl-primary-100/50 text-wl-primary-700",
                "dark:bg-wl-primary-900/20 dark:text-wl-primary-300"
              )}
              title={`Authentication: ${authMethod}`}
            >
              🔐 {authMethod}
            </span>
          )}

          {webhookSupport && (
            <span
              className={cn(
                "px-2 py-1 rounded text-xs font-medium",
                "bg-wl-success-100/50 text-wl-success-700",
                "dark:bg-wl-success-900/20 dark:text-wl-success-300"
              )}
              title="Webhook support enabled"
            >
              🪝 Webhooks
            </span>
          )}
        </div>

        {/* Last sync info and error count */}
        {(lastSyncAt || errorCount > 0) && (
          <div className="mb-4 pb-4 border-t border-wl-border-subtle pt-3">
            <div className="flex items-center justify-between text-xs text-wl-text-secondary">
              {lastSyncAt && (
                <div>
                  Last sync: {new Date(lastSyncAt).toLocaleString()}
                </div>
              )}
              {errorCount > 0 && (
                <div className="text-wl-danger-600 dark:text-wl-danger-400">
                  {errorCount} error{errorCount !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action button */}
        <button
          onClick={actionButton.onClick}
          disabled={actionButton.disabled || isActionLoading}
          className={cn(
            "w-full px-4 py-2 rounded font-medium text-sm transition-all duration-200",
            status === "connected"
              ? cn(
                  "bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle",
                  "dark:bg-wl-surface-hover dark:hover:bg-wl-border-default"
                )
              : status === "error"
                ? cn(
                    "bg-wl-danger-100 text-wl-danger-700 hover:bg-wl-danger-200",
                    "dark:bg-wl-danger-900/30 dark:text-wl-danger-300 dark:hover:bg-wl-danger-900/50"
                  )
                : cn(
                    "bg-wl-primary-500 text-white hover:bg-wl-primary-600",
                    "dark:bg-wl-primary-600 dark:hover:bg-wl-primary-700"
                  ),
            (actionButton.disabled || isActionLoading) && "opacity-60 cursor-not-allowed"
          )}
        >
          {isActionLoading ? (
            <span className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "w-3 h-3 rounded-full animate-spin",
                  "border-2 border-current border-t-transparent"
                )}
              />
              {actionButton.label}
            </span>
          ) : (
            actionButton.label
          )}
        </button>
      </div>
    </div>
  );
}
