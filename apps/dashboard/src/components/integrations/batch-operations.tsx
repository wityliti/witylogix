"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Batch Operations component
 * Bulk operation management panel with queue visualization
 * Features: operation queue states, progress bars, ETA, cancel/retry actions, summary stats
 */

export type OperationStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface BatchOperation {
  id: string;
  name: string;
  status: OperationStatus;
  progress: number; // 0-100
  processed: number;
  total: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface BatchOperationsProps {
  operations: BatchOperation[];
  onCancel?: (operationId: string) => void;
  onRetry?: (operationId: string) => void;
  className?: string;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function estimateETA(
  processed: number,
  total: number,
  elapsedMs: number,
): string {
  if (processed === 0) return "--";

  const ratePerMs = processed / elapsedMs;
  const remaining = total - processed;
  const estimatedRemainingMs = remaining / ratePerMs;

  return formatDuration(estimatedRemainingMs);
}

export function BatchOperations({
  operations,
  onCancel,
  onRetry,
  className,
}: BatchOperationsProps) {
  const [expandedOperationId, setExpandedOperationId] = useState<string | null>(
    null,
  );

  // Calculate summary stats
  const stats = {
    total: operations.length,
    pending: operations.filter((op) => op.status === "pending").length,
    running: operations.filter((op) => op.status === "running").length,
    completed: operations.filter((op) => op.status === "completed").length,
    failed: operations.filter((op) => op.status === "failed").length,
    processedTotal: operations.reduce((acc, op) => acc + op.processed, 0),
    totalItems: operations.reduce((acc, op) => acc + op.total, 0),
  };

  const getStatusColor = (status: OperationStatus): string => {
    switch (status) {
      case "pending":
        return "var(--wl-border-subtle)";
      case "running":
        return "var(--wl-primary-500)";
      case "completed":
        return "var(--wl-success-500)";
      case "failed":
        return "var(--wl-danger-500)";
      case "cancelled":
        return "var(--wl-warning-500)";
    }
  };

  const getStatusBadgeClass = (status: OperationStatus): string => {
    switch (status) {
      case "pending":
        return "bg-wl-border-subtle text-wl-text-secondary";
      case "running":
        return "bg-wl-primary-100 dark:bg-wl-primary-900/30 text-wl-primary-700 dark:text-wl-primary-300";
      case "completed":
        return "bg-wl-success-100 dark:bg-wl-success-900/30 text-wl-success-700 dark:text-wl-success-300";
      case "failed":
        return "bg-wl-danger-100 dark:bg-wl-danger-900/30 text-wl-danger-700 dark:text-wl-danger-300";
      case "cancelled":
        return "bg-wl-warning-100 dark:bg-wl-warning-900/30 text-wl-warning-700 dark:text-wl-warning-300";
    }
  };

  const getStatusLabel = (status: OperationStatus): string => {
    switch (status) {
      case "pending":
        return "Pending";
      case "running":
        return "Running";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "cancelled":
        return "Cancelled";
    }
  };

  return (
    <div
      className={cn(
        "border border-wl-border-subtle rounded-lg bg-wl-bg-surface overflow-hidden",
        className,
      )}
    >
      {/* Summary Stats Header */}
      <div className="bg-wl-surface-hover border-b border-wl-border-subtle p-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-wl-text-primary mb-3">
            Operation Queue
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div>
              <div className="text-xs text-wl-text-secondary mb-1">Total</div>
              <div className="text-lg font-semibold text-wl-text-primary">
                {stats.total}
              </div>
            </div>
            <div>
              <div className="text-xs text-wl-text-secondary mb-1">Pending</div>
              <div
                className="text-lg font-semibold"
                style={{ color: "var(--wl-border-subtle)" }}
              >
                {stats.pending}
              </div>
            </div>
            <div>
              <div className="text-xs text-wl-text-secondary mb-1">Running</div>
              <div
                className="text-lg font-semibold"
                style={{ color: "var(--wl-primary-500)" }}
              >
                {stats.running}
              </div>
            </div>
            <div>
              <div className="text-xs text-wl-text-secondary mb-1">
                Completed
              </div>
              <div
                className="text-lg font-semibold"
                style={{ color: "var(--wl-success-500)" }}
              >
                {stats.completed}
              </div>
            </div>
            <div>
              <div className="text-xs text-wl-text-secondary mb-1">Failed</div>
              <div
                className="text-lg font-semibold"
                style={{ color: "var(--wl-danger-500)" }}
              >
                {stats.failed}
              </div>
            </div>
            <div>
              <div className="text-xs text-wl-text-secondary mb-1">
                Processed
              </div>
              <div className="text-lg font-semibold text-wl-text-primary">
                {stats.processedTotal.toLocaleString()} /{" "}
                {stats.totalItems.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        {stats.running > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-wl-text-secondary">
                Overall Progress
              </span>
              <span className="text-xs text-wl-text-secondary">
                {Math.round((stats.processedTotal / stats.totalItems) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-wl-border-subtle overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-primary-600 transition-all duration-300"
                style={{
                  width: `${(stats.processedTotal / stats.totalItems) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Operations List */}
      <div className="divide-y divide-wl-border-subtle">
        {operations.length === 0 ? (
          <div className="p-8 text-center text-wl-text-tertiary">
            <div className="text-sm">No operations</div>
            <div className="text-xs mt-1">
              Start a batch operation to see it here
            </div>
          </div>
        ) : (
          operations.map((operation) => {
            const isExpanded = expandedOperationId === operation.id;
            const elapsedMs =
              (operation.completedAt || new Date()).getTime() -
              operation.startedAt.getTime();
            const eta = estimateETA(
              operation.processed,
              operation.total,
              elapsedMs,
            );

            return (
              <div key={operation.id}>
                <button
                  onClick={() =>
                    setExpandedOperationId(isExpanded ? null : operation.id)
                  }
                  className="w-full text-left p-4 hover:bg-wl-surface-hover transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-wl-text-primary">
                        {operation.name}
                      </h4>
                      <p className="text-xs text-wl-text-secondary mt-1">
                        Started: {operation.startedAt.toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium",
                        getStatusBadgeClass(operation.status),
                      )}
                    >
                      {getStatusLabel(operation.status)}
                    </span>
                  </div>

                  {/* Progress and stats */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-wl-text-secondary">
                        {operation.processed.toLocaleString()} /{" "}
                        {operation.total.toLocaleString()} items
                      </span>
                      <span className="text-xs text-wl-text-secondary">
                        {operation.progress}%
                        {operation.status === "running" &&
                          eta !== "--" &&
                          ` (ETA: ${eta})`}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-wl-border-subtle overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-300",
                          operation.status === "completed" &&
                            "bg-wl-success-500",
                          operation.status === "failed" && "bg-wl-danger-500",
                          operation.status === "running" &&
                            "bg-gradient-to-r from-wl-primary-500 to-wl-primary-600",
                          (operation.status === "pending" ||
                            operation.status === "cancelled") &&
                            "bg-wl-border-subtle",
                        )}
                        style={{ width: `${operation.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-wl-text-secondary">
                      Duration: {formatDuration(elapsedMs)}
                    </div>
                    <div className="flex gap-2">
                      {operation.status === "running" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancel?.(operation.id);
                          }}
                          className={cn(
                            "px-3 py-1 rounded text-xs font-medium transition-colors",
                            "bg-wl-danger-100 text-wl-danger-700 hover:bg-wl-danger-200",
                            "dark:bg-wl-danger-900/30 dark:text-wl-danger-300 dark:hover:bg-wl-danger-900/50",
                          )}
                        >
                          Cancel
                        </button>
                      )}
                      {operation.status === "failed" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetry?.(operation.id);
                          }}
                          className={cn(
                            "px-3 py-1 rounded text-xs font-medium transition-colors",
                            "bg-wl-primary-100 text-wl-primary-700 hover:bg-wl-primary-200",
                            "dark:bg-wl-primary-900/30 dark:text-wl-primary-300 dark:hover:bg-wl-primary-900/50",
                          )}
                        >
                          Retry
                        </button>
                      )}
                      <span
                        className="text-wl-text-tertiary transition-transform"
                        style={{ fontSize: "12px" }}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="bg-wl-surface-hover border-t border-wl-border-subtle p-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-wl-text-secondary mb-1">
                          Operation ID
                        </div>
                        <div className="text-xs font-mono text-wl-text-primary break-all">
                          {operation.id}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-wl-text-secondary mb-1">
                          Skipped
                        </div>
                        <div className="text-sm font-semibold text-wl-text-primary">
                          {operation.total - operation.processed}
                        </div>
                      </div>
                    </div>

                    {operation.error && (
                      <div className="p-3 rounded-lg bg-wl-danger-500/10 border border-wl-danger-500/20">
                        <div className="text-xs font-semibold text-wl-danger-700 dark:text-wl-danger-300 mb-1">
                          Error
                        </div>
                        <div className="text-xs text-wl-text-secondary font-mono">
                          {operation.error}
                        </div>
                      </div>
                    )}

                    {operation.completedAt && (
                      <div className="text-xs text-wl-text-secondary mt-3">
                        Completed: {operation.completedAt.toLocaleString()}
                      </div>
                    )}
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
