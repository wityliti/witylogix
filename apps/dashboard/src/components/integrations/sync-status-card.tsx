"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { SyncStatusCardProps } from "./types";

/**
 * Sync status card component
 * Displays data sync status with records count, direction, and error details
 */
export function SyncStatusCard({
  syncStatus,
  lastSyncAt,
  nextSyncAt,
  recordsSynced,
  recordsFailed,
  recordsSkipped,
  syncDirection,
  errors,
  onTriggerSync,
  className,
}: SyncStatusCardProps) {
  const [showErrors, setShowErrors] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get status color and label
  const getStatusColor = (): string => {
    switch (syncStatus) {
      case 'success':
        return 'var(--wl-success-500)';
      case 'syncing':
        return 'var(--wl-primary-500)';
      case 'error':
        return 'var(--wl-danger-500)';
      case 'paused':
        return 'var(--wl-warning-500)';
      default:
        return 'var(--wl-border-subtle)';
    }
  };

  const getStatusLabel = (): string => {
    switch (syncStatus) {
      case 'success':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Error';
      case 'paused':
        return 'Paused';
      default:
        return 'Idle';
    }
  };

  // Get sync direction icon
  const getSyncDirectionIcon = (): string => {
    switch (syncDirection) {
      case 'inbound':
        return '←';
      case 'outbound':
        return '→';
      case 'bidirectional':
        return '↔';
      default:
        return '—';
    }
  };

  // Format relative time
  const formatRelativeTime = (date: Date | undefined): string => {
    if (!date) return 'Never';

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const handleTriggerSync = async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onTriggerSync?.();
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate success rate
  const totalRecords = recordsSynced + recordsFailed;
  const successRate = totalRecords > 0 ? Math.round((recordsSynced / totalRecords) * 100) : 0;

  return (
    <div className={cn('w-full', className)}>
      <div className="border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
        {/* Header with status */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-wl-text-primary mb-2">Data Sync Status</h3>
            <div className="flex items-center gap-2">
              <div
                className={cn('w-2 h-2 rounded-full', syncStatus === 'syncing' && 'animate-pulse')}
                style={{ backgroundColor: getStatusColor() }}
              />
              <span className="text-sm text-wl-text-secondary">{getStatusLabel()}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-wl-text-primary mb-1">
              {getSyncDirectionIcon()}
            </div>
            <div className="text-xs text-wl-text-secondary">
              {syncDirection.charAt(0).toUpperCase() + syncDirection.slice(1)}
            </div>
          </div>
        </div>

        {/* Timeline info */}
        <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-wl-border-subtle">
          <div>
            <div className="text-xs text-wl-text-secondary mb-1">Last Sync</div>
            <div className="text-sm font-medium text-wl-text-primary">
              {formatRelativeTime(lastSyncAt)}
            </div>
            {lastSyncAt && (
              <div className="text-xs text-wl-text-secondary mt-1">
                {lastSyncAt.toLocaleString()}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-wl-text-secondary mb-1">Next Sync</div>
            <div className="text-sm font-medium text-wl-text-primary">
              {nextSyncAt ? formatRelativeTime(nextSyncAt) : 'Not scheduled'}
            </div>
            {nextSyncAt && (
              <div className="text-xs text-wl-text-secondary mt-1">
                {nextSyncAt.toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Records breakdown */}
        <div className="mb-6 pb-6 border-b border-wl-border-subtle">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-wl-text-primary">Records</h4>
              <span className="text-sm font-medium text-wl-text-primary">{successRate}% success</span>
            </div>
            <div className="relative h-2 bg-wl-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-wl-success-500 transition-all duration-300"
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded bg-wl-surface-hover">
              <div className="text-xs text-wl-text-secondary mb-1">Synced</div>
              <div className="text-lg font-semibold text-wl-success-600">
                {recordsSynced.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded bg-wl-surface-hover">
              <div className="text-xs text-wl-text-secondary mb-1">Failed</div>
              <div className="text-lg font-semibold text-wl-danger-600">
                {recordsFailed.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded bg-wl-surface-hover">
              <div className="text-xs text-wl-text-secondary mb-1">Skipped</div>
              <div className="text-lg font-semibold text-wl-warning-600">
                {recordsSkipped.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Errors section */}
        {errors && errors.length > 0 && (
          <div className="mb-6 pb-6 border-b border-wl-border-subtle">
            <button
              onClick={() => setShowErrors(!showErrors)}
              className="flex items-center gap-2 text-sm font-medium text-wl-danger-500 hover:text-wl-danger-600 mb-3"
            >
              <span>{showErrors ? '▼' : '▶'}</span>
              {errors.length} Recent Error{errors.length !== 1 ? 's' : ''}
            </button>

            {showErrors && (
              <div className="space-y-2">
                {errors.slice(0, 5).map((error, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded bg-wl-danger-100 dark:bg-wl-danger-900/30 border border-wl-danger-200 dark:border-wl-danger-800"
                  >
                    <div className="text-xs font-medium text-wl-danger-700 dark:text-wl-danger-300 mb-1">
                      {error.timestamp.toLocaleTimeString()}
                    </div>
                    <div className="text-xs text-wl-danger-600 dark:text-wl-danger-400 break-words">
                      {error.message}
                    </div>
                  </div>
                ))}
                {errors.length > 5 && (
                  <div className="text-xs text-wl-text-secondary pt-2">
                    +{errors.length - 5} more errors
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action button */}
        <button
          onClick={handleTriggerSync}
          disabled={isLoading || syncStatus === 'syncing'}
          className={cn(
            'w-full px-4 py-2 rounded font-medium text-sm transition-colors',
            'bg-wl-primary-500 text-white hover:bg-wl-primary-600',
            'dark:bg-wl-primary-600 dark:hover:bg-wl-primary-700',
            (isLoading || syncStatus === 'syncing') && 'opacity-60 cursor-not-allowed'
          )}
        >
          {isLoading || syncStatus === 'syncing' ? 'Syncing...' : 'Trigger Sync Now'}
        </button>
      </div>
    </div>
  );
}
