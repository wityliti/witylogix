"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Log Viewer component
 * Real-time integration event log viewer with filtering and search
 * Features: severity/provider/type filtering, expandable entries with JSON viewer, auto-scroll
 */

export type LogSeverity = 'info' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  timestamp: Date;
  severity: LogSeverity;
  provider: string;
  eventType: string;
  message: string;
  payload?: Record<string, unknown>;
}

export interface LogViewerProps {
  logs: LogEntry[];
  onLogSelect?: (logId: string) => void;
  className?: string;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const then = date.getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

export function LogViewer({ logs, onLogSelect, className }: LogViewerProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<LogSeverity | 'all'>('all');
  const [filterProvider, setFilterProvider] = useState<string | 'all'>('all');
  const [filterEventType, setFilterEventType] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Get unique providers and event types
  const providers = Array.from(new Set(logs.map((log) => log.provider)));
  const eventTypes = Array.from(new Set(logs.map((log) => log.eventType)));

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesSeverity = filterSeverity === 'all' || log.severity === filterSeverity;
    const matchesProvider = filterProvider === 'all' || log.provider === filterProvider;
    const matchesEventType = filterEventType === 'all' || log.eventType === filterEventType;
    const matchesSearch = searchQuery === '' || log.message.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSeverity && matchesProvider && matchesEventType && matchesSearch;
  });

  const getSeverityColor = (severity: LogSeverity): string => {
    switch (severity) {
      case 'info':
        return 'var(--wl-info-500)';
      case 'warning':
        return 'var(--wl-warning-500)';
      case 'error':
        return 'var(--wl-danger-500)';
    }
  };

  const getSeverityBgColor = (severity: LogSeverity): string => {
    switch (severity) {
      case 'info':
        return 'bg-wl-info-100 dark:bg-wl-info-900/30 text-wl-info-700 dark:text-wl-info-300';
      case 'warning':
        return 'bg-wl-warning-100 dark:bg-wl-warning-900/30 text-wl-warning-700 dark:text-wl-warning-300';
      case 'error':
        return 'bg-wl-danger-100 dark:bg-wl-danger-900/30 text-wl-danger-700 dark:text-wl-danger-300';
    }
  };

  return (
    <div
      className={cn(
        'border border-wl-border-subtle rounded-lg bg-wl-bg-surface overflow-hidden flex flex-col',
        className
      )}
      style={{ height: '600px' }}
    >
      {/* Header with filters */}
      <div className="border-b border-wl-border-subtle bg-wl-surface-hover p-4">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full px-3 py-2 rounded-lg border border-wl-border-subtle',
              'bg-wl-bg-surface text-wl-text-primary placeholder-wl-text-tertiary',
              'focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/20',
              'transition-colors'
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Severity Filter */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as LogSeverity | 'all')}
            className={cn(
              'px-3 py-2 rounded-lg border border-wl-border-subtle',
              'bg-wl-bg-surface text-wl-text-primary',
              'focus:outline-none focus:border-wl-primary-500',
              'transition-colors text-sm'
            )}
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>

          {/* Provider Filter */}
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className={cn(
              'px-3 py-2 rounded-lg border border-wl-border-subtle',
              'bg-wl-bg-surface text-wl-text-primary',
              'focus:outline-none focus:border-wl-primary-500',
              'transition-colors text-sm'
            )}
          >
            <option value="all">All Providers</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>

          {/* Event Type Filter */}
          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className={cn(
              'px-3 py-2 rounded-lg border border-wl-border-subtle',
              'bg-wl-bg-surface text-wl-text-primary',
              'focus:outline-none focus:border-wl-primary-500',
              'transition-colors text-sm'
            )}
          >
            <option value="all">All Events</option>
            {eventTypes.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-wl-text-secondary">
          <span>
            {filteredLogs.length} of {logs.length} logs
          </span>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              'px-2 py-1 rounded transition-colors',
              autoScroll
                ? 'bg-wl-primary-100 text-wl-primary-700 dark:bg-wl-primary-900/30 dark:text-wl-primary-300'
                : 'text-wl-text-secondary hover:text-wl-text-primary'
            )}
          >
            {autoScroll ? 'Auto-scroll: On' : 'Auto-scroll: Off'}
          </button>
        </div>
      </div>

      {/* Logs List */}
      <div
        ref={logsContainerRef}
        className={cn(
          'flex-1 overflow-y-auto',
          filteredLogs.length === 0 && 'flex items-center justify-center'
        )}
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center text-wl-text-tertiary">
            <div className="text-sm">No logs found</div>
            <div className="text-xs mt-1">Adjust filters or search criteria</div>
          </div>
        ) : (
          <div className="divide-y divide-wl-border-subtle">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;

              return (
                <div key={log.id} className="hover:bg-wl-surface-hover transition-colors">
                  <button
                    onClick={() => {
                      setExpandedLogId(isExpanded ? null : log.id);
                      onLogSelect?.(log.id);
                    }}
                    className="w-full text-left p-3 hover:bg-wl-surface-hover transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Severity dot */}
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                        style={{ backgroundColor: getSeverityColor(log.severity) }}
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium',
                              getSeverityBgColor(log.severity)
                            )}
                          >
                            {log.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-wl-text-secondary">{log.provider}</span>
                          <span className="text-xs text-wl-text-tertiary">{log.eventType}</span>
                          <span className="text-xs text-wl-text-tertiary ml-auto">
                            {formatRelativeTime(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-wl-text-secondary truncate">{log.message}</p>
                      </div>

                      {/* Expand indicator */}
                      <div className="flex-shrink-0 mt-1">
                        <span
                          className={cn(
                            'text-wl-text-tertiary transition-transform',
                            isExpanded && 'rotate-180'
                          )}
                        >
                          ▾
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded payload */}
                  {isExpanded && log.payload && (
                    <div className="bg-wl-surface-hover p-4 border-t border-wl-border-subtle">
                      <div className="text-xs font-semibold text-wl-text-primary mb-2">Payload:</div>
                      <pre
                        className={cn(
                          'text-xs overflow-x-auto rounded p-2',
                          'bg-wl-bg-surface border border-wl-border-subtle',
                          'text-wl-text-secondary'
                        )}
                      >
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                      <div className="text-xs text-wl-text-tertiary mt-2">
                        Timestamp: {log.timestamp.toISOString()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
