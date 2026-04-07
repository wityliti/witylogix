'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertCircle, CheckCircle2, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';

interface ETACountdownProps {
  eta: Date | null;
  routeProgress?: number;
  lastUpdated?: Date;
  /** Confidence score 0–1 from the LightGBM residual model */
  etaConfidence?: number | null;
  /** ETA change vs previous (positive = later, negative = earlier) */
  etaDeltaMinutes?: number | null;
  /** Whether the ETA was produced by the WIT-204 predictive AI model */
  isAIPredicted?: boolean;
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
  etaConfidence = null,
  etaDeltaMinutes = null,
  isAIPredicted = false,
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

  // Confidence interval: ± Math.round((1 - confidence) * 5) minutes, min 1
  const confidenceIntervalMin =
    etaConfidence !== null
      ? Math.max(1, Math.round((1 - etaConfidence) * 5))
      : null;

  // Show delta badge when shift is >= 5 minutes
  const significantDelta =
    etaDeltaMinutes !== null && Math.abs(etaDeltaMinutes) >= 5
      ? etaDeltaMinutes
      : null;

  return (
    <div className="section-card space-y-4">
      {/* Main ETA */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="label">Estimated arrival</p>
          {isAIPredicted && etaConfidence !== null && etaConfidence >= 0.7 && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium text-wl-primary-500 bg-wl-primary-500/10 px-1.5 py-0.5 rounded"
              data-testid="ai-badge"
            >
              <Sparkles size={10} />
              AI
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="value">{minutesRemaining}</span>
          <span className="text-lg text-wl-text-tertiary font-medium">min</span>
          {confidenceIntervalMin !== null && (
            <span className="text-xs text-wl-text-tertiary font-normal" data-testid="confidence-interval">
              ± {confidenceIntervalMin}m
            </span>
          )}
        </div>
        <p className="text-xs text-wl-text-tertiary mt-1 mono">
          {minutesRemaining}m {secondsRemaining}s remaining
        </p>
      </div>

      {/* ETA delta badge — only shown when shift is significant */}
      {significantDelta !== null && (
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium rounded px-2 py-1',
            significantDelta > 0
              ? 'text-wl-warning-600 bg-wl-warning-500/10'
              : 'text-wl-success-600 bg-wl-success-500/10',
          )}
          data-testid="eta-delta-badge"
        >
          {significantDelta > 0
            ? <TrendingUp size={12} />
            : <TrendingDown size={12} />}
          ETA updated {significantDelta > 0 ? '+' : ''}{significantDelta}m
        </div>
      )}

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
