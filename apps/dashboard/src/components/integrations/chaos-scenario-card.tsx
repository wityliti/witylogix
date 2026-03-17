"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type FaultType =
  | "latency"
  | "error-rate"
  | "timeout"
  | "connection-loss"
  | "memory-leak";
export type Severity = "low" | "medium" | "high" | "critical";
export type ScenarioStatus = "draft" | "running" | "completed" | "failed";

export interface ChaosScenarioCardProps {
  id: string;
  name: string;
  faultType: FaultType;
  targetProvider: string;
  severity: Severity;
  status: ScenarioStatus;
  progress?: number; // 0-100 during execution
  executionStart?: Date;
  executionEnd?: Date;
  resultsSummary?: {
    assertionsPassed: number;
    assertionsFailed: number;
    metricsImpact: {
      latencyChangePercent: number;
      errorRateChangePercent: number;
      throughputChangePercent: number;
    };
  };
  onRun?: () => void;
  onEdit?: () => void;
  onClone?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function ChaosScenarioCard({
  id,
  name,
  faultType,
  targetProvider,
  severity,
  status,
  progress = 0,
  executionStart,
  executionEnd,
  resultsSummary,
  onRun,
  onEdit,
  onClone,
  onDelete,
  className,
}: ChaosScenarioCardProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const getSeverityColor = (sev: Severity): string => {
    switch (sev) {
      case "low":
        return "var(--wl-success-500)";
      case "medium":
        return "var(--wl-warning-500)";
      case "high":
        return "var(--wl-danger-500)";
      case "critical":
        return "#8b0000"; // Dark red
      default:
        return "var(--wl-border-subtle)";
    }
  };

  const getStatusColor = (stat: ScenarioStatus): string => {
    switch (stat) {
      case "draft":
        return "var(--wl-text-secondary)";
      case "running":
        return "var(--wl-primary-500)";
      case "completed":
        return "var(--wl-success-500)";
      case "failed":
        return "var(--wl-danger-500)";
      default:
        return "var(--wl-border-subtle)";
    }
  };

  const getStatusLabel = (stat: ScenarioStatus): string => {
    switch (stat) {
      case "draft":
        return "Draft";
      case "running":
        return "Running";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      default:
        return "Unknown";
    }
  };

  const getFaultTypeLabel = (type: FaultType): string => {
    return type
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const handleRun = async () => {
    setIsExecuting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      onRun?.();
    } finally {
      setIsExecuting(false);
    }
  };

  const formatDate = (date?: Date): string => {
    if (!date) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-4 hover:shadow-md transition-shadow">
        {/* Header with severity */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-wl-text-primary mb-2">
              {name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="px-2 py-1 rounded text-xs font-medium text-white"
                style={{ backgroundColor: getSeverityColor(severity) }}
              >
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </span>
              <span className="px-2 py-1 rounded text-xs font-medium bg-wl-surface-hover text-wl-text-secondary border border-wl-border-subtle">
                {getFaultTypeLabel(faultType)}
              </span>
              <span
                className="px-2 py-1 rounded text-xs font-medium text-white"
                style={{ backgroundColor: getStatusColor(status) }}
              >
                {getStatusLabel(status)}
              </span>
            </div>
          </div>
        </div>

        {/* Target and timing info */}
        <div className="mb-4 pb-4 border-b border-wl-border-subtle">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-wl-text-secondary mb-1">Target Provider</div>
              <div className="font-medium text-wl-text-primary">{targetProvider}</div>
            </div>
            {executionStart && (
              <div>
                <div className="text-wl-text-secondary mb-1">Started</div>
                <div className="font-medium text-wl-text-primary">
                  {formatDate(executionStart)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar (during execution) */}
        {status === "running" && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-wl-text-secondary">
                Execution Progress
              </span>
              <span className="text-xs font-semibold text-wl-primary-600">
                {progress}%
              </span>
            </div>
            <div className="relative h-2 bg-wl-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-wl-primary-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Results summary */}
        {resultsSummary && (
          <div className="mb-4 pb-4 border-b border-wl-border-subtle">
            <button
              onClick={() => setShowResults(!showResults)}
              className="text-sm font-medium text-wl-primary-500 hover:text-wl-primary-600 flex items-center gap-1 mb-2"
            >
              <span>{showResults ? "▼" : "▶"}</span>
              Results Summary
            </button>

            {showResults && (
              <div className="space-y-3">
                {/* Assertions */}
                <div className="bg-wl-surface-hover rounded p-3">
                  <div className="text-xs font-medium text-wl-text-secondary mb-2">
                    Assertions
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-wl-success-500" />
                        <span className="text-xs text-wl-text-secondary">Passed</span>
                        <span className="ml-auto text-sm font-semibold text-wl-success-600">
                          {resultsSummary.assertionsPassed}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-wl-danger-500" />
                        <span className="text-xs text-wl-text-secondary">Failed</span>
                        <span className="ml-auto text-sm font-semibold text-wl-danger-600">
                          {resultsSummary.assertionsFailed}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metrics Impact */}
                <div className="bg-wl-surface-hover rounded p-3">
                  <div className="text-xs font-medium text-wl-text-secondary mb-2">
                    Metrics Impact
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-wl-text-secondary">Latency</span>
                      <span
                        className={cn(
                          "font-semibold",
                          resultsSummary.metricsImpact.latencyChangePercent > 0
                            ? "text-wl-danger-600"
                            : "text-wl-success-600"
                        )}
                      >
                        {resultsSummary.metricsImpact.latencyChangePercent > 0
                          ? "+"
                          : ""}
                        {resultsSummary.metricsImpact.latencyChangePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-wl-text-secondary">Error Rate</span>
                      <span
                        className={cn(
                          "font-semibold",
                          resultsSummary.metricsImpact.errorRateChangePercent > 0
                            ? "text-wl-danger-600"
                            : "text-wl-success-600"
                        )}
                      >
                        {resultsSummary.metricsImpact.errorRateChangePercent > 0
                          ? "+"
                          : ""}
                        {resultsSummary.metricsImpact.errorRateChangePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-wl-text-secondary">Throughput</span>
                      <span
                        className={cn(
                          "font-semibold",
                          resultsSummary.metricsImpact.throughputChangePercent < 0
                            ? "text-wl-danger-600"
                            : "text-wl-success-600"
                        )}
                      >
                        {resultsSummary.metricsImpact.throughputChangePercent > 0
                          ? "+"
                          : ""}
                        {resultsSummary.metricsImpact.throughputChangePercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {status === "draft" && (
            <button
              onClick={handleRun}
              disabled={isExecuting}
              className={cn(
                "flex-1 px-3 py-2 rounded text-xs font-medium transition-colors",
                "bg-wl-primary-500 text-white hover:bg-wl-primary-600",
                isExecuting && "opacity-60 cursor-not-allowed"
              )}
            >
              {isExecuting ? "Starting..." : "Run"}
            </button>
          )}

          <button
            onClick={onEdit}
            className="px-3 py-2 rounded text-xs font-medium bg-wl-surface-hover text-wl-text-primary hover:bg-wl-surface-hover/80 border border-wl-border-subtle transition-colors"
          >
            Edit
          </button>

          <button
            onClick={onClone}
            className="px-3 py-2 rounded text-xs font-medium bg-wl-surface-hover text-wl-text-primary hover:bg-wl-surface-hover/80 border border-wl-border-subtle transition-colors"
          >
            Clone
          </button>

          <button
            onClick={onDelete}
            className="px-3 py-2 rounded text-xs font-medium bg-wl-danger-100 dark:bg-wl-danger-900/30 text-wl-danger-600 hover:bg-wl-danger-200 dark:hover:bg-wl-danger-900/50 border border-wl-danger-200 dark:border-wl-danger-800 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
