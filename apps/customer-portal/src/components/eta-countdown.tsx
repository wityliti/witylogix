'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ETACountdownProps {
  eta: Date | null;
  routeProgress?: number; // 0-100 percentage
  lastUpdated?: Date;
}

interface ETAState {
  minutesRemaining: number;
  secondsRemaining: number;
  isDelayed: boolean;
  isEarly: boolean;
}

/**
 * ETA countdown display with progress bar and status indicator
 */
export function ETACountdown({
  eta,
  routeProgress = 0,
  lastUpdated,
}: ETACountdownProps) {
  const [etaState, setETAState] = useState<ETAState>({
    minutesRemaining: 0,
    secondsRemaining: 0,
    isDelayed: false,
    isEarly: false,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (!eta) return;

      const now = new Date();
      const diffMs = eta.getTime() - now.getTime();

      if (diffMs <= 0) {
        setETAState({
          minutesRemaining: 0,
          secondsRemaining: 0,
          isDelayed: false,
          isEarly: false,
        });
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      // Determine if delayed or early based on original estimate
      // This is a simplified logic; in production, compare with original ETA
      const isDelayed = minutes > 15; // More than 15 mins remaining = potential delay
      const isEarly = minutes < 3 && minutes > 0; // Less than 3 mins = early

      setETAState({
        minutesRemaining: minutes,
        secondsRemaining: seconds,
        isDelayed,
        isEarly,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [eta]);

  if (!eta) {
    return (
      <div className={cn(
        'rounded-lg border border-wl-border-subtle',
        'bg-wl-bg-surface p-4'
      )}>
        <div className="text-sm text-wl-text-secondary">Loading ETA...</div>
      </div>
    );
  }

  const { minutesRemaining, secondsRemaining, isDelayed, isEarly } = etaState;

  // Status indicator
  let statusIcon = <Clock className="w-5 h-5 text-wl-text-secondary" />;
  let statusText = 'On time';
  let statusColor = 'text-wl-text-secondary';

  if (isDelayed) {
    statusIcon = <AlertCircle className="w-5 h-5 text-wl-warning-500" />;
    statusText = 'Delayed';
    statusColor = 'text-wl-warning-500';
  } else if (isEarly) {
    statusIcon = <CheckCircle2 className="w-5 h-5 text-wl-success-500" />;
    statusText = 'Arriving soon';
    statusColor = 'text-wl-success-500';
  }

  return (
    <div className={cn(
      'rounded-lg border border-wl-border-subtle',
      'bg-wl-bg-surface p-6 space-y-4'
    )}>
      {/* Main ETA Display */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-bold text-wl-text-primary">
            {minutesRemaining}
          </span>
          <span className="text-xl text-wl-text-secondary">min</span>
        </div>
        <p className="text-sm text-wl-text-secondary">
          Arriving in{' '}
          <span className="font-medium text-wl-text-primary">
            {minutesRemaining}m {secondsRemaining}s
          </span>
        </p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-wl-text-secondary">
            Route Progress
          </span>
          <span className="text-xs font-semibold text-wl-text-primary">
            {routeProgress}%
          </span>
        </div>
        <div className={cn(
          'w-full h-2 rounded-full overflow-hidden',
          'bg-wl-bg-elevated'
        )}>
          <div
            className={cn(
              'h-full transition-all duration-500',
              'bg-wl-primary-500'
            )}
            style={{ width: `${Math.min(routeProgress, 100)}%` }}
          />
        </div>
      </div>

      {/* Status Indicator */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md',
        'bg-wl-bg-elevated'
      )}>
        {statusIcon}
        <span className={cn('text-sm font-medium', statusColor)}>
          {statusText}
        </span>
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-xs text-wl-text-tertiary text-right">
          Updated {formatTimeAgo(lastUpdated)}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  return `${Math.floor(diffSeconds / 3600)}h ago`;
}
