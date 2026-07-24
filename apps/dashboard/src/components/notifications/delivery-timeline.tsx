"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Eye,
  Zap,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

export type DeliveryStatus =
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "retrying";

export interface DeliveryAttempt {
  timestamp: Date;
  status: DeliveryStatus;
  duration?: number; // in ms
  errorMessage?: string;
  retryCount?: number;
}

interface DeliveryTimelineProps {
  attempts: DeliveryAttempt[];
  channel?: string;
  className?: string;
}

const STATUS_CONFIG: Record<
  DeliveryStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    label: string;
  }
> = {
  sent: {
    icon: Zap,
    color: "text-[var(--wl-primary)]",
    label: "Sent",
  },
  delivered: {
    icon: CheckCircle2,
    color: "text-[var(--wl-success)]",
    label: "Delivered",
  },
  read: {
    icon: Eye,
    color: "text-[var(--wl-info)]",
    label: "Read",
  },
  failed: {
    icon: AlertCircle,
    color: "text-[var(--wl-danger)]",
    label: "Failed",
  },
  retrying: {
    icon: RotateCcw,
    color: "text-[var(--wl-warning)]",
    label: "Retrying",
  },
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const TimelineItem = React.memo(
  ({
    attempt,
    index,
    isLast,
  }: {
    attempt: DeliveryAttempt;
    index: number;
    isLast: boolean;
  }) => {
    const config = STATUS_CONFIG[attempt.status];
    const Icon = config.icon;

    return (
      <div className="flex gap-4">
        {/* Timeline line */}
        <div className="flex flex-col items-center">
          <div className={cn("p-1.5 rounded-full", config.color)}>
            <Icon className="w-4 h-4" />
          </div>
          {!isLast && (
            <div
              className={cn(
                "w-0.5 h-12",
                attempt.status === "failed"
                  ? "bg-[var(--wl-danger)]/20"
                  : "bg-[var(--wl-border)]",
              )}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 pb-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-semibold text-[var(--wl-text-primary)]">
              {config.label}
              {attempt.retryCount && attempt.retryCount > 0 && (
                <span className="ml-2 text-xs font-medium text-[var(--wl-text-secondary)]">
                  (Retry #{attempt.retryCount})
                </span>
              )}
            </span>
            <span className="text-xs text-[var(--wl-text-secondary)]">
              {formatTime(attempt.timestamp)}
            </span>
          </div>

          {attempt.duration && (
            <p className="text-xs text-[var(--wl-text-secondary)] mb-2">
              Duration: {formatDuration(attempt.duration)}
            </p>
          )}

          {attempt.errorMessage && (
            <div
              className={cn(
                "mt-2 p-2 rounded-sm text-xs",
                "bg-[var(--wl-danger)]/10 border border-[var(--wl-danger)]/20",
                "text-[var(--wl-danger)]",
              )}
            >
              <strong>Error:</strong> {attempt.errorMessage}
            </div>
          )}
        </div>
      </div>
    );
  },
);

TimelineItem.displayName = "TimelineItem";

export const DeliveryTimeline = React.memo(
  ({ attempts, channel = "email", className }: DeliveryTimelineProps) => {
    const stats = useMemo(() => {
      const firstAttempt = attempts[0];
      const lastAttempt = attempts[attempts.length - 1];
      const totalDuration = lastAttempt?.timestamp.getTime()
        ? lastAttempt.timestamp.getTime() - firstAttempt.timestamp.getTime()
        : 0;

      const failureCount = attempts.filter((a) => a.status === "failed").length;
      const retryCount = attempts.filter(
        (a) => a.retryCount && a.retryCount > 0,
      ).length;

      return { totalDuration, failureCount, retryCount };
    }, [attempts]);

    if (attempts.length === 0) {
      return (
        <div
          className={cn(
            "flex items-center justify-center p-8 rounded-md",
            "bg-[var(--wl-bg-secondary)] border border-[var(--wl-border)]",
            className,
          )}
        >
          <p className="text-sm text-[var(--wl-text-secondary)]">
            No delivery attempts yet
          </p>
        </div>
      );
    }

    return (
      <div className={cn("space-y-6", className)}>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="px-4 py-3 rounded-md bg-[var(--wl-bg-secondary)] border border-[var(--wl-border)]">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase">
              Channel
            </p>
            <p className="text-sm font-medium text-[var(--wl-text-primary)] mt-1">
              {channel}
            </p>
          </div>
          <div className="px-4 py-3 rounded-md bg-[var(--wl-bg-secondary)] border border-[var(--wl-border)]">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase">
              Total Time
            </p>
            <p className="text-sm font-medium text-[var(--wl-text-primary)] mt-1">
              {formatDuration(stats.totalDuration)}
            </p>
          </div>
          <div className="px-4 py-3 rounded-md bg-[var(--wl-bg-secondary)] border border-[var(--wl-border)]">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase">
              Attempts
            </p>
            <p className="text-sm font-medium text-[var(--wl-text-primary)] mt-1">
              {attempts.length}
              {stats.retryCount > 0 && (
                <span className="text-xs text-[var(--wl-text-secondary)] ml-1">
                  (+{stats.retryCount})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {attempts.map((attempt, index) => (
            <TimelineItem
              key={`${attempt.timestamp.getTime()}-${index}`}
              attempt={attempt}
              index={index}
              isLast={index === attempts.length - 1}
            />
          ))}
        </div>

        {/* Error Summary */}
        {stats.failureCount > 0 && (
          <div
            className={cn(
              "px-4 py-3 rounded-md border",
              "bg-[var(--wl-danger)]/10 border-[var(--wl-danger)]/20",
            )}
          >
            <p className="text-sm font-semibold text-[var(--wl-danger)]">
              {stats.failureCount} Failed Attempt
              {stats.failureCount !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-[var(--wl-danger)]/80 mt-1">
              Check error details above to understand delivery failures.
            </p>
          </div>
        )}
      </div>
    );
  },
);

DeliveryTimeline.displayName = "DeliveryTimeline";
