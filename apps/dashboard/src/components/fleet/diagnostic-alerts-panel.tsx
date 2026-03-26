"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { DiagnosticAlertsPanelProps, DiagnosticAlert } from "./types";

/**
 * Diagnostic Alerts Panel Component
 * Scrollable list of alerts with severity filtering and dismiss functionality
 */
export function DiagnosticAlertsPanel({
  alerts,
  onDismiss,
  filterBySeverity = "all",
  maxHeight = 400,
  className,
}: DiagnosticAlertsPanelProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Filter alerts by severity
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (filterBySeverity === "all") return true;
      return alert.severity === filterBySeverity;
    }).filter((alert) => !dismissedAlerts.has(alert.id) && !alert.dismissed);
  }, [alerts, filterBySeverity, dismissedAlerts]);

  // Count alerts by severity
  const alertCounts = useMemo(() => {
    const counts = { critical: 0, warning: 0, info: 0 };
    alerts.forEach((alert) => {
      if (!dismissedAlerts.has(alert.id) && !alert.dismissed) {
        counts[alert.severity]++;
      }
    });
    return counts;
  }, [alerts, dismissedAlerts]);

  const totalCount = Object.values(alertCounts).reduce((a, b) => a + b, 0);

  const handleDismiss = (alertId: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(alertId));
    onDismiss?.(alertId);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return (
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        );
      case "warning":
        return (
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          </svg>
        );
      default:
        return (
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
          </svg>
        );
    }
  };

  const getSeverityBadgeVariant = (
    severity: string
  ): "default" | "success" | "warning" | "danger" | "info" | "primary" => {
    switch (severity) {
      case "critical":
        return "danger";
      case "warning":
        return "warning";
      case "info":
        return "info";
      default:
        return "default";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-wl-danger-400";
      case "warning":
        return "text-wl-warning-400";
      case "info":
        return "text-wl-info-400";
      default:
        return "text-wl-text-secondary";
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-wl-bg-surface border border-wl-border-default rounded-lg overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="border-b border-wl-border-default p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-wl-text-primary text-sm mb-2">
            Diagnostic Alerts
          </h3>
          <div className="flex gap-2">
            <Badge variant="danger" className="text-xs">
              Critical: {alertCounts.critical}
            </Badge>
            <Badge variant="warning" className="text-xs">
              Warning: {alertCounts.warning}
            </Badge>
            <Badge variant="info" className="text-xs">
              Info: {alertCounts.info}
            </Badge>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-wl-text-primary">
            {totalCount}
          </div>
          <div className="text-xs text-wl-text-secondary">active</div>
        </div>
      </div>

      {/* Alerts list */}
      <div
        className="overflow-y-auto flex-1"
        style={{ maxHeight }}
      >
        {filteredAlerts.length > 0 ? (
          <div className="divide-y divide-wl-border-default">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 hover:bg-wl-bg-overlay transition-colors"
              >
                <div className="flex gap-3">
                  {/* Severity icon */}
                  <div className={cn("flex-shrink-0 mt-0.5", getSeverityColor(alert.severity))}>
                    {getSeverityIcon(alert.severity)}
                  </div>

                  {/* Alert content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-wl-text-primary truncate">
                        {alert.message}
                      </p>
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        className="flex-shrink-0 text-wl-text-secondary hover:text-wl-danger-400 transition-colors text-xs font-bold"
                        title="Dismiss alert"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge variant={getSeverityBadgeVariant(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        <span className="text-wl-text-secondary truncate">
                          {alert.vehicleName}
                        </span>
                      </div>
                      <span className="text-wl-text-secondary flex-shrink-0">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <svg
              className="w-12 h-12 mb-3 text-wl-text-secondary opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-wl-text-secondary">
              {alerts.length === 0 ? "No alerts" : "No alerts matching filter"}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {totalCount > 0 && (
        <div className="border-t border-wl-border-default px-4 py-2 bg-wl-bg-elevated text-xs text-wl-text-secondary flex justify-between">
          <span>{filteredAlerts.length} of {totalCount} alerts visible</span>
          {dismissedAlerts.size > 0 && (
            <button
              onClick={() => setDismissedAlerts(new Set())}
              className="text-wl-primary-400 hover:text-wl-primary-300 transition-colors"
            >
              Undo dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
