"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export type CredentialType = "api-key" | "secret" | "oauth-token" | "certificate" | "password";
export type RotationStatus = "pending" | "completed" | "overdue";
export type RotationFilter = "provider" | "status" | "date-range";

export interface RotationEntry {
  id: string;
  provider: string;
  credentialType: CredentialType;
  scheduledDate: Date;
  actualDate?: Date;
  status: RotationStatus;
  daysUntilNext?: number;
}

export interface CredentialRotationTimelineProps {
  entries: RotationEntry[];
  onRotate?: (entryId: string) => void;
  className?: string;
}

export function CredentialRotationTimeline({
  entries,
  onRotate,
  className,
}: CredentialRotationTimelineProps) {
  const [filterStatus, setFilterStatus] = useState<RotationStatus | "all">("all");
  const [filterProvider, setFilterProvider] = useState<string | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState<string | null>(null);

  // Get unique providers
  const providers = useMemo(
    () => [...new Set(entries.map((e) => e.provider))],
    [entries]
  );

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const statusMatch = filterStatus === "all" || entry.status === filterStatus;
      const providerMatch = filterProvider === "all" || entry.provider === filterProvider;
      return statusMatch && providerMatch;
    });
  }, [entries, filterStatus, filterProvider]);

  // Sort entries by status priority and date
  const sortedEntries = useMemo(() => {
    const statusPriority = { overdue: 0, pending: 1, completed: 2 };
    return [...filteredEntries].sort((a, b) => {
      const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      return a.scheduledDate.getTime() - b.scheduledDate.getTime();
    });
  }, [filteredEntries]);

  const getStatusColor = (status: RotationStatus): string => {
    switch (status) {
      case "pending":
        return "var(--wl-primary-500)";
      case "completed":
        return "var(--wl-success-500)";
      case "overdue":
        return "var(--wl-danger-500)";
      default:
        return "var(--wl-border-subtle)";
    }
  };

  const getStatusLabel = (status: RotationStatus): string => {
    switch (status) {
      case "pending":
        return "Pending";
      case "completed":
        return "Completed";
      case "overdue":
        return "Overdue";
      default:
        return "Unknown";
    }
  };

  const getCredentialTypeLabel = (type: CredentialType): string => {
    return type
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const handleRotate = async (entryId: string) => {
    setIsRotating(entryId);
    try {
      await onRotate?.(entryId);
    } finally {
      setIsRotating(null);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6">
        {/* Header */}
        <h3 className="text-sm font-semibold text-wl-text-primary mb-6">
          Credential Rotation Timeline
        </h3>

        {/* Filters */}
        <div className="mb-6 pb-6 border-b border-wl-border-subtle space-y-3">
          {/* Status filter */}
          <div>
            <label className="text-xs font-medium text-wl-text-secondary mb-2 block">
              Filter by Status
            </label>
            <div className="flex items-center gap-2">
              {(["all", "pending", "completed", "overdue"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                    filterStatus === status
                      ? "bg-wl-primary-500 text-white"
                      : "bg-wl-surface-hover text-wl-text-secondary hover:text-wl-text-primary"
                  )}
                >
                  {status === "all" ? "All" : getStatusLabel(status as RotationStatus)}
                </button>
              ))}
            </div>
          </div>

          {/* Provider filter */}
          <div>
            <label className="text-xs font-medium text-wl-text-secondary mb-2 block">
              Filter by Provider
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilterProvider("all")}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  filterProvider === "all"
                    ? "bg-wl-primary-500 text-white"
                    : "bg-wl-surface-hover text-wl-text-secondary hover:text-wl-text-primary"
                )}
              >
                All Providers
              </button>
              {providers.map((provider) => (
                <button
                  key={provider}
                  onClick={() => setFilterProvider(provider)}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                    filterProvider === provider
                      ? "bg-wl-primary-500 text-white"
                      : "bg-wl-surface-hover text-wl-text-secondary hover:text-wl-text-primary"
                  )}
                >
                  {provider}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline */}
        {sortedEntries.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-wl-text-secondary text-sm mb-1">
                No credential rotations found
              </div>
              <div className="text-xs text-wl-text-secondary">
                Try adjusting your filters
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedEntries.map((entry, idx) => {
              const isExpanded = expandedId === entry.id;
              const color = getStatusColor(entry.status);

              return (
                <div key={entry.id} className="relative">
                  {/* Timeline connector */}
                  {idx < sortedEntries.length - 1 && (
                    <div
                      className="absolute left-6 top-12 w-0.5 h-12 -bottom-12"
                      style={{ backgroundColor: color, opacity: 0.3 }}
                    />
                  )}

                  {/* Timeline entry */}
                  <div className="flex gap-4">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className="w-4 h-4 rounded-full border-2 border-wl-bg-surface z-10"
                        style={{ backgroundColor: color }}
                      />
                    </div>

                    {/* Entry card */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="flex-1 text-left bg-wl-surface-hover/50 border border-wl-border-subtle rounded-lg p-4 hover:bg-wl-surface-hover transition-colors"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-sm font-semibold text-wl-text-primary">
                              {entry.provider}
                            </h4>
                            <span
                              className="px-2 py-1 rounded text-xs font-medium text-wl-text-primary"
                              style={{ backgroundColor: color }}
                            >
                              {getStatusLabel(entry.status)}
                            </span>
                          </div>
                          <div className="text-xs text-wl-text-secondary">
                            {getCredentialTypeLabel(entry.credentialType)}
                          </div>
                        </div>
                        {entry.status === "pending" && entry.daysUntilNext !== undefined && (
                          <div className="text-right">
                            <div className="text-xs font-medium text-wl-text-secondary mb-1">
                              Days Until Next
                            </div>
                            <div className="text-lg font-bold text-wl-primary-600">
                              {entry.daysUntilNext}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <div className="text-wl-text-secondary mb-1">Scheduled</div>
                          <div className="font-medium text-wl-text-primary">
                            {formatDate(entry.scheduledDate)}
                          </div>
                        </div>
                        {entry.actualDate && (
                          <div>
                            <div className="text-wl-text-secondary mb-1">Completed</div>
                            <div className="font-medium text-wl-text-primary">
                              {formatDate(entry.actualDate)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Expand arrow */}
                      <div className="absolute top-4 right-4 text-wl-text-secondary">
                        {isExpanded ? "▼" : "▶"}
                      </div>
                    </button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="ml-10 mt-2 p-4 bg-wl-surface-hover/30 rounded-lg border border-wl-border-subtle space-y-3 animate-in fade-in duration-200">
                      {/* Entry ID */}
                      <div>
                        <div className="text-xs font-medium text-wl-text-secondary mb-1">
                          Entry ID
                        </div>
                        <code className="text-xs text-wl-text-primary bg-wl-bg-surface px-2 py-1 rounded font-mono">
                          {entry.id}
                        </code>
                      </div>

                      {/* Rotation action button */}
                      {entry.status === "pending" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRotate(entry.id);
                          }}
                          disabled={isRotating === entry.id}
                          className={cn(
                            "w-full px-4 py-2 rounded text-xs font-medium transition-colors",
                            "bg-wl-primary-500 text-white hover:bg-wl-primary-600",
                            isRotating === entry.id && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          {isRotating === entry.id ? "Rotating..." : "Rotate Now"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Summary stats */}
        <div className="mt-6 pt-6 border-t border-wl-border-subtle">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded bg-wl-surface-hover border border-wl-border-subtle">
              <div className="text-xs text-wl-text-secondary mb-1">Pending</div>
              <div className="text-lg font-semibold text-wl-primary-600">
                {entries.filter((e) => e.status === "pending").length}
              </div>
            </div>
            <div className="p-3 rounded bg-wl-surface-hover border border-wl-border-subtle">
              <div className="text-xs text-wl-text-secondary mb-1">Overdue</div>
              <div className="text-lg font-semibold text-wl-danger-600">
                {entries.filter((e) => e.status === "overdue").length}
              </div>
            </div>
            <div className="p-3 rounded bg-wl-surface-hover border border-wl-border-subtle">
              <div className="text-xs text-wl-text-secondary mb-1">Completed</div>
              <div className="text-lg font-semibold text-wl-success-600">
                {entries.filter((e) => e.status === "completed").length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
