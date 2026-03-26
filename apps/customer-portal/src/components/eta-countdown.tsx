'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ETACountdownProps {
  eta: Date | null;
  routeProgress?: number;
  lastUpdated?: Date;
}

interface ETAState {
  minutesRemaining: number;
  secondsRemaining: number;
  isDelayed: boolean;
  isEarly: boolean;
}

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
        setETAState({ minutesRemaining: 0, secondsRemaining: 0, isDelayed: false, isEarly: false });
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const isDelayed = minutes > 15;
      const isEarly = minutes < 3 && minutes > 0;

      setETAState({ minutesRemaining: minutes, secondsRemaining: seconds, isDelayed, isEarly });
    }, 1000);

    return () => clearInterval(interval);
  }, [eta]);

  if (!eta) {
    return (
      <div className="section-card">
        <p className="text-sm text-wl-text-secondary">Loading ETA...</p>
      </div>
    );
  }

  const { minutesRemaining, secondsRemaining, isDelayed, isEarly } = etaState;

  const statusIcon = isDelayed
    ? <AlertCircle size={14} className="text-wl-warning-500" />
    : isEarly
    ? <CheckCircle2 size={14} className="text-wl-success-500" />
    : <Clock size={14} className="text-wl-text-tertiary" />;

  const statusText = isDelayed ? 'Delayed' : isEarly ? 'Arriving soon' : 'On time';
  const statusColor = isDelayed ? 'text-wl-warning-500' : isEarly ? 'text-wl-success-500' : 'text-wl-text-secondary';

  return (
    <div className="section-card space-y-4">
      {/* Main ETA */}
      <div>
        <p className="label mb-1">Estimated arrival</p>
        <div className="flex items-baseline gap-1.5">
          <span className="value">{minutesRemaining}</span>
          <span className="text-lg text-wl-text-tertiary font-medium">min</span>
        </div>
        <p className="text-xs text-wl-text-tertiary mt-1 mono">
          {minutesRemaining}m {secondsRemaining}s remaining
        </p>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-wl-text-tertiary">Route progress</span>
          <span className="text-wl-text-primary font-medium mono">{routeProgress}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-wl-bg-elevated overflow-hidden">
          <div
            className="h-full bg-wl-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(routeProgress, 100)}%` }}
          />
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        {statusIcon}
        <span className={cn('text-xs font-medium', statusColor)}>{statusText}</span>
      </div>

      {lastUpdated && (
        <p className="text-xs text-wl-text-tertiary text-right">
          Updated {formatTimeAgo(lastUpdated)}
        </p>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  return `${Math.floor(diffSeconds / 3600)}h ago`;
}
