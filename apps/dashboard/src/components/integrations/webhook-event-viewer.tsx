"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

type WebhookStatus = "delivered" | "failed" | "pending";

interface WebhookEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  status: WebhookStatus;
  provider: string;
  payload?: Record<string, unknown>;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseStatus?: number;
  errorMessage?: string;
  attempts?: number;
}

interface WebhookEventViewerProps {
  events: WebhookEvent[];
  onReplay?: (eventId: string) => void;
  className?: string;
}

/**
 * Webhook Event Viewer Component
 * Displays list of recent webhook events with expandable payload inspector
 * Features: timestamp, event type, status, JSON pretty-print, request/response headers, replay button
 */
export function WebhookEventViewer({
  events,
  onReplay,
  className,
}: WebhookEventViewerProps) {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<WebhookStatus | "all">(
    "all",
  );
  const [filterEventType, setFilterEventType] = useState<string>("all");
  const [copiedPayloadId, setCopiedPayloadId] = useState<string | null>(null);

  // Get unique event types and statuses
  const eventTypes = useMemo(
    () => Array.from(new Set(events.map((e) => e.eventType))),
    [events],
  );

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(
      (event) =>
        (filterStatus === "all" || event.status === filterStatus) &&
        (filterEventType === "all" || event.eventType === filterEventType),
    );
  }, [events, filterStatus, filterEventType]);

  const getStatusConfig = (
    status: WebhookStatus,
  ): { color: string; bgColor: string; icon: string; label: string } => {
    switch (status) {
      case "delivered":
        return {
          color: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-100 dark:bg-green-900/30",
          icon: "✓",
          label: "Delivered",
        };
      case "failed":
        return {
          color: "text-red-600 dark:text-red-400",
          bgColor: "bg-red-100 dark:bg-red-900/30",
          icon: "✕",
          label: "Failed",
        };
      case "pending":
        return {
          color: "text-blue-600 dark:text-blue-400",
          bgColor: "bg-blue-100 dark:bg-blue-900/30",
          icon: "⧖",
          label: "Pending",
        };
    }
  };

  const copyToClipboard = (text: string, eventId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPayloadId(eventId);
    setTimeout(() => setCopiedPayloadId(null), 2000);
  };

  const formatJson = (obj: unknown): string => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Filter section */}
      <div className="mb-6 p-4 rounded-lg bg-wl-bg-surface border border-wl-border-subtle">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Status filter */}
          <div>
            <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as WebhookStatus | "all")
              }
              className={cn(
                "w-full px-3 py-2 rounded border text-sm",
                "bg-wl-bg-default text-wl-text-primary",
                "border-wl-border-subtle focus:border-wl-primary-500 focus:outline-none",
              )}
            >
              <option value="all">All Statuses</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Event type filter */}
          <div>
            <label className="block text-xs font-semibold text-wl-text-secondary mb-2 uppercase">
              Filter by Event Type
            </label>
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value)}
              className={cn(
                "w-full px-3 py-2 rounded border text-sm",
                "bg-wl-bg-default text-wl-text-primary",
                "border-wl-border-subtle focus:border-wl-primary-500 focus:outline-none",
              )}
            >
              <option value="all">All Event Types</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Events list */}
      <div className="space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-wl-text-secondary">
            <p className="text-sm">No webhook events found</p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const statusConfig = getStatusConfig(event.status);
            const isExpanded = expandedEventId === event.id;

            return (
              <div
                key={event.id}
                className="border border-wl-border-subtle rounded-lg bg-wl-bg-surface overflow-hidden"
              >
                {/* Event header (always visible) */}
                <button
                  onClick={() =>
                    setExpandedEventId(isExpanded ? null : event.id)
                  }
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors",
                    "hover:bg-wl-surface-hover",
                    isExpanded &&
                      "bg-wl-surface-hover border-b border-wl-border-subtle",
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Expand arrow */}
                    <div
                      className={cn(
                        "w-5 h-5 flex items-center justify-center transition-transform",
                        isExpanded && "rotate-90",
                      )}
                    >
                      <svg
                        className="w-4 h-4 text-wl-text-secondary"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>

                    {/* Status indicator */}
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        statusConfig.bgColor,
                      )}
                    />

                    {/* Event type and timestamp */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-wl-text-primary text-sm">
                        {event.eventType}
                      </div>
                      <div className="text-xs text-wl-text-secondary">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>

                    {/* Status badge */}
                    <div
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium whitespace-nowrap",
                        statusConfig.bgColor,
                        statusConfig.color,
                      )}
                    >
                      {statusConfig.icon} {statusConfig.label}
                    </div>

                    {/* Provider label */}
                    <div className="text-xs text-wl-text-secondary">
                      {event.provider}
                    </div>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-wl-border-subtle">
                    {/* Payload section */}
                    {event.payload && (
                      <div className="p-4 border-b border-wl-border-subtle">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm text-wl-text-primary">
                            Payload
                          </h4>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                formatJson(event.payload),
                                event.id,
                              )
                            }
                            className={cn(
                              "px-2 py-1 rounded text-xs transition-colors",
                              "text-wl-text-secondary hover:text-wl-text-primary",
                              "bg-wl-surface-hover hover:bg-wl-border-subtle",
                            )}
                          >
                            {copiedPayloadId === event.id ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <pre
                          className={cn(
                            "p-3 rounded text-xs overflow-x-auto",
                            "bg-wl-bg-default text-wl-text-secondary",
                            "border border-wl-border-subtle",
                            "font-mono",
                          )}
                        >
                          <code>{formatJson(event.payload)}</code>
                        </pre>
                      </div>
                    )}

                    {/* Request headers section */}
                    {event.requestHeaders &&
                      Object.keys(event.requestHeaders).length > 0 && (
                        <div className="p-4 border-b border-wl-border-subtle">
                          <h4 className="font-semibold text-sm text-wl-text-primary mb-2">
                            Request Headers
                          </h4>
                          <div className="space-y-1">
                            {Object.entries(event.requestHeaders).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="text-xs text-wl-text-secondary"
                                >
                                  <span className="font-mono font-semibold text-wl-text-primary">
                                    {key}:
                                  </span>{" "}
                                  <span className="font-mono">
                                    {String(value).substring(0, 50)}...
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                    {/* Response section */}
                    {(event.responseStatus !== undefined ||
                      event.errorMessage) && (
                      <div className="p-4 border-b border-wl-border-subtle">
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          {event.responseStatus !== undefined && (
                            <div>
                              <div className="text-xs text-wl-text-secondary mb-1">
                                Response Status
                              </div>
                              <div
                                className={cn(
                                  "text-sm font-semibold",
                                  event.responseStatus >= 200 &&
                                    event.responseStatus < 300
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400",
                                )}
                              >
                                {event.responseStatus}
                              </div>
                            </div>
                          )}
                          {event.attempts !== undefined && (
                            <div>
                              <div className="text-xs text-wl-text-secondary mb-1">
                                Attempts
                              </div>
                              <div className="text-sm font-semibold text-wl-text-primary">
                                {event.attempts}
                              </div>
                            </div>
                          )}
                        </div>
                        {event.errorMessage && (
                          <div
                            className={cn(
                              "p-2 rounded text-xs",
                              "bg-wl-danger-100 text-wl-danger-700",
                              "dark:bg-wl-danger-900/30 dark:text-wl-danger-300",
                            )}
                          >
                            {event.errorMessage}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="p-4 flex gap-2">
                      {event.status === "failed" && onReplay && (
                        <button
                          onClick={() => onReplay(event.id)}
                          className={cn(
                            "flex-1 px-3 py-2 rounded text-sm font-medium transition-colors",
                            "bg-wl-primary-100 text-wl-primary-700 hover:bg-wl-primary-200",
                            "dark:bg-wl-primary-900/30 dark:text-wl-primary-300 dark:hover:bg-wl-primary-900/50",
                          )}
                        >
                          Replay Event
                        </button>
                      )}
                      <button
                        onClick={() =>
                          copyToClipboard(
                            formatJson({
                              id: event.id,
                              timestamp: event.timestamp,
                              eventType: event.eventType,
                              status: event.status,
                              provider: event.provider,
                              payload: event.payload,
                            }),
                            event.id,
                          )
                        }
                        className={cn(
                          "flex-1 px-3 py-2 rounded text-sm font-medium transition-colors",
                          "bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle",
                          "dark:bg-wl-surface-hover dark:hover:bg-wl-border-default",
                        )}
                      >
                        Copy All
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
