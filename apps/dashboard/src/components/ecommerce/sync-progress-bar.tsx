"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

type SyncState = "syncing" | "success" | "error" | "idle";

interface SyncProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Current sync state */
  state?: SyncState;
  /** Number of items synced */
  itemsSynced: number;
  /** Total number of items to sync */
  totalItems: number;
  /** Estimated time remaining (in seconds) */
  estimatedTimeRemaining?: number | null;
  /** Current operation label */
  operationLabel?: string;
  /** Error message */
  errorMessage?: string;
  /** Callback when cancel is clicked */
  onCancel?: () => void;
}

const formatTime = (seconds: number | null | undefined): string => {
  if (!seconds || seconds <= 0) return "";

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (minutes === 0) return `${secs}s`;
  if (minutes < 60) return `${minutes}m ${secs}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

/**
 * Sync progress bar showing live synchronization progress
 *
 * @example
 * ```tsx
 * <SyncProgressBar
 *   state="syncing"
 *   itemsSynced={25}
 *   totalItems={100}
 *   estimatedTimeRemaining={120}
 *   operationLabel="Syncing products..."
 * />
 * <SyncProgressBar
 *   state="success"
 *   itemsSynced={100}
 *   totalItems={100}
 * />
 * ```
 */
const SyncProgressBar = forwardRef<HTMLDivElement, SyncProgressBarProps>(
  (
    {
      state = "idle",
      itemsSynced,
      totalItems,
      estimatedTimeRemaining,
      operationLabel,
      errorMessage,
      onCancel,
      className,
      ...props
    },
    ref,
  ) => {
    const percentage = totalItems > 0 ? (itemsSynced / totalItems) * 100 : 0;
    const isComplete = itemsSynced === totalItems;

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-3",
          "p-4 rounded-lg",
          "bg-gray-50 dark:bg-gray-900/30",
          "border border-gray-200 dark:border-gray-800",
          state === "error" &&
            "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-900/50",
          state === "success" &&
            "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-900/50",
          className,
        )}
        {...props}
      >
        {/* Header with status and cancel */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {state === "syncing" && (
              <div
                className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0"
                aria-hidden="true"
              />
            )}
            {state === "success" && (
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            )}
            {state === "error" && (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            )}

            <div className="min-w-0 flex-1">
              <h3
                className={cn(
                  "text-sm font-semibold truncate",
                  state === "error" && "text-red-700 dark:text-red-400",
                  state === "success" && "text-green-700 dark:text-green-400",
                  state !== "error" &&
                    state !== "success" &&
                    "text-gray-700 dark:text-gray-300",
                )}
              >
                {operationLabel || "Synchronizing..."}
              </h3>
            </div>
          </div>

          {/* Cancel button */}
          {state === "syncing" && onCancel && (
            <button
              onClick={onCancel}
              className={cn(
                "inline-flex items-center justify-center",
                "w-6 h-6 p-1",
                "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
                "rounded transition-colors",
                "hover:bg-gray-200 dark:hover:bg-gray-800",
              )}
              aria-label="Cancel sync"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div
            className={cn(
              "w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden",
            )}
          >
            <div
              className={cn(
                "h-full transition-all duration-300 ease-default rounded-full",
                state === "syncing" && "bg-blue-500 dark:bg-blue-600",
                state === "success" && "bg-green-500 dark:bg-green-600",
                state === "error" && "bg-red-500 dark:bg-red-600",
                state === "idle" && "bg-gray-400",
              )}
              style={{
                width: `${Math.max(2, percentage)}%`,
              }}
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Sync progress: ${Math.round(percentage)}%`}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Items count */}
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {itemsSynced}
            </span>
            {" / "}
            <span>{totalItems}</span>
            {" items"}
          </div>

          {/* Progress percentage */}
          <div
            className="text-xs font-semibold text-gray-700 dark:text-gray-300"
            aria-live="polite"
            aria-atomic="true"
          >
            {Math.round(percentage)}%
          </div>

          {/* Estimated time remaining */}
          {state === "syncing" &&
            estimatedTimeRemaining &&
            estimatedTimeRemaining > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-semibold">
                  {formatTime(estimatedTimeRemaining)}
                </span>{" "}
                remaining
              </div>
            )}

          {/* Success message */}
          {state === "success" && (
            <div className="text-xs font-semibold text-green-700 dark:text-green-400">
              Sync completed
            </div>
          )}
        </div>

        {/* Error message */}
        {state === "error" && errorMessage && (
          <div className="text-xs text-red-700 dark:text-red-400 p-2 bg-red-100/50 dark:bg-red-500/10 rounded">
            {errorMessage}
          </div>
        )}
      </div>
    );
  },
);

SyncProgressBar.displayName = "SyncProgressBar";

export { SyncProgressBar };
export type { SyncState };
