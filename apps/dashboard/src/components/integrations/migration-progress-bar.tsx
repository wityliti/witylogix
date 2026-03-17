"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type MigrationStep = "source" | "mapping" | "shadow" | "cutover" | "complete";

export interface StepStats {
  requestsProcessed: number;
  errors: number;
  duration: number; // in minutes
}

export interface MigrationProgressBarProps {
  currentStep: MigrationStep;
  completedSteps: MigrationStep[];
  stepStats: Record<MigrationStep, StepStats>;
  onRollback?: (step: MigrationStep) => void;
  className?: string;
}

export function MigrationProgressBar({
  currentStep,
  completedSteps,
  stepStats,
  onRollback,
  className,
}: MigrationProgressBarProps) {
  const [expandedStep, setExpandedStep] = useState<MigrationStep | null>(null);
  const [isRollingBack, setIsRollingBack] = useState<MigrationStep | null>(null);

  const steps: { id: MigrationStep; label: string }[] = [
    { id: "source", label: "Source" },
    { id: "mapping", label: "Mapping" },
    { id: "shadow", label: "Shadow" },
    { id: "cutover", label: "Cutover" },
    { id: "complete", label: "Complete" },
  ];

  const getStepStatus = (step: MigrationStep): "pending" | "current" | "completed" => {
    if (completedSteps.includes(step)) return "completed";
    if (step === currentStep) return "current";
    return "pending";
  };

  const getStepColor = (status: "pending" | "current" | "completed"): string => {
    switch (status) {
      case "completed":
        return "var(--wl-success-500)";
      case "current":
        return "var(--wl-primary-500)";
      case "pending":
        return "var(--wl-border-subtle)";
    }
  };

  const handleRollback = async (step: MigrationStep) => {
    setIsRollingBack(step);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      onRollback?.(step);
    } finally {
      setIsRollingBack(null);
    }
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className={cn("w-full", className)}>
      <div className="bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6">
        {/* Main progress bar */}
        <div className="mb-8">
          {/* Steps */}
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, idx) => {
              const status = getStepStatus(step.id);
              const color = getStepColor(status);
              const isClickable = completedSteps.includes(step.id);

              return (
                <div key={step.id} className="flex-1 flex items-center">
                  {/* Step circle */}
                  <button
                    onClick={() => isClickable && setExpandedStep(expandedStep === step.id ? null : step.id)}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                      isClickable && "cursor-pointer hover:shadow-md"
                    )}
                    style={{
                      backgroundColor:
                        status === "completed"
                          ? color
                          : status === "current"
                            ? color
                            : "transparent",
                      borderColor: color,
                      color:
                        status === "completed"
                          ? "white"
                          : status === "current"
                            ? color
                            : color,
                    }}
                  >
                    {status === "completed" ? "✓" : idx + 1}
                  </button>

                  {/* Connection line */}
                  {idx < steps.length - 1 && (
                    <div
                      className="flex-1 h-0.5 mx-2 transition-colors"
                      style={{
                        backgroundColor: completedSteps.includes(step.id)
                          ? "var(--wl-success-500)"
                          : "var(--wl-border-subtle)",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step labels */}
          <div className="flex items-center justify-between text-xs px-1">
            {steps.map((step) => (
              <div key={step.id} className="flex-1 text-center">
                <span className="text-wl-text-secondary">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mb-6 pb-6 border-b border-wl-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-wl-text-primary">
              Overall Progress
            </h4>
            <span className="text-sm font-semibold text-wl-primary-600">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="relative h-3 bg-wl-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-wl-primary-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step statistics */}
        <div className="space-y-3">
          {steps.map((step) => {
            const stats = stepStats[step.id];
            const status = getStepStatus(step.id);
            const isExpanded = expandedStep === step.id;

            return (
              <div
                key={step.id}
                className="rounded border border-wl-border-subtle bg-wl-surface-hover/50 overflow-hidden"
              >
                {/* Step header */}
                <button
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-wl-surface-hover/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getStepColor(status) }}
                    />
                    <span className="text-sm font-medium text-wl-text-primary">
                      {step.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {status === "completed" && (
                      <span className="text-xs text-wl-text-secondary">
                        {stats.requestsProcessed.toLocaleString()} requests • {stats.errors} errors
                      </span>
                    )}
                    <span
                      className={cn(
                        "transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    >
                      ▼
                    </span>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 py-3 border-t border-wl-border-subtle bg-wl-surface-hover/30 space-y-3">
                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-xs text-wl-text-secondary mb-1">
                          Requests Processed
                        </div>
                        <div className="text-sm font-semibold text-wl-text-primary">
                          {stats.requestsProcessed.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-wl-text-secondary mb-1">
                          Errors
                        </div>
                        <div className="text-sm font-semibold text-wl-danger-600">
                          {stats.errors}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-wl-text-secondary mb-1">
                          Duration
                        </div>
                        <div className="text-sm font-semibold text-wl-text-primary">
                          {formatDuration(stats.duration)}
                        </div>
                      </div>
                    </div>

                    {/* Error rate */}
                    {stats.requestsProcessed > 0 && (
                      <div>
                        <div className="text-xs text-wl-text-secondary mb-2">
                          Error Rate
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-wl-surface-hover rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all",
                                stats.errors === 0
                                  ? "bg-wl-success-500"
                                  : "bg-wl-danger-500"
                              )}
                              style={{
                                width: `${((stats.errors / stats.requestsProcessed) * 100).toFixed(1)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-wl-text-secondary">
                            {((stats.errors / stats.requestsProcessed) * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Rollback button */}
                    {status === "completed" && completedSteps.length > 1 && (
                      <button
                        onClick={() => handleRollback(step.id)}
                        disabled={isRollingBack === step.id}
                        className={cn(
                          "w-full px-3 py-2 rounded text-xs font-medium transition-colors",
                          "bg-wl-danger-100 dark:bg-wl-danger-900/30 text-wl-danger-600 hover:bg-wl-danger-200 dark:hover:bg-wl-danger-900/50",
                          "border border-wl-danger-200 dark:border-wl-danger-800",
                          isRollingBack === step.id && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        {isRollingBack === step.id ? "Rolling Back..." : "Rollback to This Step"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
