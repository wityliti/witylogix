"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IntegrationStatusRowProps, ConnectionStatus } from "./types";

/**
 * Integration status table row component
 * Shows provider icon, connection status, sync time, success rate, and error count
 */
export function IntegrationStatusRow({
  data,
  onTest,
  onReconfigure,
  className,
}: IntegrationStatusRowProps) {
  const [expanded, setExpanded] = useState(false);

  const statusColor: Record<ConnectionStatus, "success" | "default" | "danger" | "info"> = {
    connected: "success",
    disconnected: "default",
    error: "danger",
    syncing: "info",
  };

  const statusText: Record<ConnectionStatus, string> = {
    connected: "Connected",
    disconnected: "Disconnected",
    error: "Error",
    syncing: "Syncing",
  };

  const getProviderIcon = (provider: string): React.ReactNode => {
    const iconProps = {
      width: "20",
      height: "20",
      viewBox: "0 0 24 24",
      fill: "currentColor",
    };

    switch (provider) {
      case "shopify":
        return (
          <svg {...iconProps}>
            <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-3 18c-.551 0-1-.449-1-1s.449-1 1-1 1 .449 1 1-.449 1-1 1zm0-4c-.551 0-1-.449-1-1s.449-1 1-1 1 .449 1 1-.449 1-1 1zm4 4c-.551 0-1-.449-1-1s.449-1 1-1 1 .449 1 1-.449 1-1 1zm0-4c-.551 0-1-.449-1-1s.449-1 1-1 1 .449 1 1-.449 1-1 1zm4 4c-.551 0-1-.449-1-1s.449-1 1-1 1 .449 1 1-.449 1-1 1zm0-4c-.551 0-1-.449-1-1s.449-1 1-1 1 .449 1 1-.449 1-1 1z" />
          </svg>
        );
      case "stripe":
        return (
          <svg {...iconProps}>
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5 13c0 .564-.123 1.102-.343 1.588-.22.486-.544.921-.96 1.291-.416.37-.91.653-1.466.844-.556.19-1.155.286-1.785.286-.631 0-1.23-.096-1.786-.286-.556-.19-1.05-.473-1.466-.844-.416-.37-.74-.805-.96-1.291-.22-.486-.343-1.024-.343-1.588 0-.564.123-1.102.343-1.588.22-.486.544-.921.96-1.291.416-.37.91-.653 1.466-.844.556-.19 1.155-.286 1.786-.286.631 0 1.23.096 1.786.286.556.19 1.05.473 1.466.844.416.37.74.805.96 1.291.22.486.343 1.024.343 1.588z" />
          </svg>
        );
      case "slack":
        return (
          <svg {...iconProps}>
            <path d="M6.237 10.889c0 1.337-1.063 2.419-2.376 2.419-1.312 0-2.375-1.082-2.375-2.419 0-1.337 1.063-2.419 2.375-2.419h2.376v2.419zm1.188 0c0-1.337 1.063-2.419 2.375-2.419 1.313 0 2.376 1.082 2.376 2.419v6.044c0 1.337-1.063 2.419-2.376 2.419-1.312 0-2.375-1.082-2.375-2.419v-6.044zm2.375-8.47c-1.313 0-2.376-1.081-2.376-2.419 0-1.337 1.063-2.419 2.376-2.419 1.312 0 2.375 1.082 2.375 2.419v2.419h-2.375zm0 1.188h6.044c1.337 0 2.419 1.063 2.419 2.375 0 1.313-1.082 2.376-2.419 2.376h-6.044c-1.337 0-2.419-1.063-2.419-2.375 0-1.313 1.082-2.376 2.419-2.376z" />
          </svg>
        );
      case "twilio":
        return (
          <svg {...iconProps}>
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-3.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm3.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm3.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
          </svg>
        );
      default:
        return (
          <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path d="M12 6v6m0 0v6" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
    }
  };

  const lastSyncTime = data.lastSyncAt ? new Date(data.lastSyncAt) : null;
  const now = new Date();
  const diffMs = lastSyncTime ? now.getTime() - lastSyncTime.getTime() : 0;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  let relativeSync = "Never";
  if (lastSyncTime) {
    if (diffMins < 1) {
      relativeSync = "just now";
    } else if (diffMins < 60) {
      relativeSync = `${diffMins}m ago`;
    } else if (diffHours < 24) {
      relativeSync = `${diffHours}h ago`;
    } else {
      relativeSync = lastSyncTime.toLocaleDateString();
    }
  }

  return (
    <div
      className={cn(
        "border border-wl-border-subtle rounded-lg bg-wl-bg-surface transition-all duration-base",
        expanded && "shadow-md",
        className
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-wl-bg-elevated/50"
        onClick={() => setExpanded(!expanded)}>

        {/* Provider icon and name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="text-wl-text-secondary flex-shrink-0">
            {getProviderIcon(data.provider)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-wl-text-primary truncate">
              {data.name}
            </p>
            <p className="text-xs text-wl-text-tertiary">
              {data.provider.charAt(0).toUpperCase() + data.provider.slice(1)}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0">
          <Badge variant={statusColor[data.status]}>
            {statusText[data.status]}
          </Badge>
        </div>

        {/* Last sync */}
        <div className="flex-shrink-0 text-right">
          <p className="text-xs font-semibold text-wl-text-secondary">
            {relativeSync}
          </p>
          <p className="text-xs text-wl-text-tertiary">Last sync</p>
        </div>

        {/* Success rate bar */}
        <div className="flex-shrink-0 w-20">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-wl-bg-surface rounded-full overflow-hidden border border-wl-border-subtle">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  data.successRate >= 0.95
                    ? "bg-green-500"
                    : data.successRate >= 0.8
                    ? "bg-yellow-500"
                    : "bg-red-500"
                )}
                style={{ width: `${data.successRate * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-wl-text-secondary w-10">
              {Math.round(data.successRate * 100)}%
            </span>
          </div>
        </div>

        {/* Error count */}
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-semibold text-wl-text-primary">
            {data.errorCount}
          </p>
          <p className="text-xs text-wl-text-tertiary">errors</p>
        </div>

        {/* Expand indicator */}
        <div className="flex-shrink-0">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            className={cn(
              "text-wl-text-tertiary transition-transform duration-200",
              expanded && "transform rotate-180"
            )}
          >
            <path
              fill="currentColor"
              d="M8 12L2 6h12l-6 6z"
            />
          </svg>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-wl-border-subtle px-4 py-3 bg-wl-bg-elevated/30 space-y-3">
          {/* Sync info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">
                Success Rate
              </p>
              <p className="text-lg font-bold text-wl-text-primary mt-1">
                {Math.round(data.successRate * 100)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">
                Recent Errors
              </p>
              <p className="text-lg font-bold text-wl-text-primary mt-1">
                {data.errorCount}
              </p>
            </div>
          </div>

          {/* Error details */}
          {data.errors && data.errors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide mb-2">
                Recent Errors
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {data.errors.slice(0, 3).map((error, idx) => (
                  <div
                    key={idx}
                    className="bg-wl-danger-bg border border-wl-danger-400/20 rounded p-2"
                  >
                    <p className="text-xs font-medium text-wl-danger-400">
                      {error.code && `[${error.code}] `}
                      {error.message}
                    </p>
                    <p className="text-xs text-wl-danger-400/60 mt-1">
                      {new Date(error.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2 border-t border-wl-border-subtle">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onTest?.(data.id)}
              className="flex-1"
            >
              Test Connection
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReconfigure?.(data.id)}
              className="flex-1"
            >
              Reconfigure
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
