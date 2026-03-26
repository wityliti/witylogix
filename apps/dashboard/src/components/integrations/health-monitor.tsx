"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { HealthMonitorProps } from "./types";

/**
 * Health monitor component
 * Integration health monitoring dashboard with gauges and metrics
 * Features: health score, check breakdown, response time trend, error rate
 */
export function HealthMonitor({
  providerId,
  healthChecks,
  responseTimeHistory,
  errorRateHistory,
  onCheckNow,
  className,
}: HealthMonitorProps) {
  // Calculate overall health score
  const healthScore = useMemo(() => {
    if (healthChecks.length === 0) return 0;

    const healthyCount = healthChecks.filter((c) => c.status === 'healthy').length;
    const degradedCount = healthChecks.filter((c) => c.status === 'degraded').length;

    return Math.round((healthyCount * 100 + degradedCount * 50) / healthChecks.length);
  }, [healthChecks]);

  // Generate SVG donut chart for health score
  const generateHealthGauge = () => {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (healthScore / 100) * circumference;

    const getColor = () => {
      if (healthScore >= 80) return 'var(--wl-success-500)';
      if (healthScore >= 60) return 'var(--wl-warning-500)';
      return 'var(--wl-danger-500)';
    };

    return (
      <svg width="140" height="140" viewBox="0 0 140 140" className="mx-auto">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="var(--wl-border-subtle)"
          strokeWidth="8"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
          style={{
            transformOrigin: '70px 70px',
            transform: 'rotate(-90deg)',
          }}
        />
        <text
          x="70"
          y="75"
          textAnchor="middle"
          fontSize="32"
          fontWeight="600"
          fill="var(--wl-text-primary)"
        >
          {healthScore}
        </text>
        <text
          x="70"
          y="95"
          textAnchor="middle"
          fontSize="12"
          fill="var(--wl-text-secondary)"
        >
          Health
        </text>
      </svg>
    );
  };

  // Generate response time trend SVG
  const generateResponseTimeTrend = () => {
    const width = 300;
    const height = 100;
    const padding = 10;
    const max = Math.max(...responseTimeHistory, 100);
    const min = 0;
    const range = max - min;

    const points = responseTimeHistory.map((value, idx) => {
      const x = padding + (idx / (responseTimeHistory.length - 1 || 1)) * (width - padding * 2);
      const normalized = (value - min) / range;
      const y = height - padding - normalized * (height - padding * 2);
      return [x, y];
    });

    return (
      <svg width="100%" height="120" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Grid */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = height - padding - ratio * (height - padding * 2);
          return (
            <line
              key={idx}
              x1="0"
              y1={y}
              x2={width}
              y2={y}
              stroke="var(--wl-border-subtle)"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
          );
        })}

        {/* Fill area */}
        {points.length > 1 && (
          <path
            d={`M ${padding} ${height - padding} L ${points.map((p) => `${p[0]} ${p[1]}`).join(' L ')} L ${width - padding} ${height - padding} Z`}
            fill="var(--wl-primary-400)"
            fillOpacity="0.1"
          />
        )}

        {/* Line */}
        {points.length > 1 && (
          <polyline
            points={points.map((p) => `${p[0]},${p[1]}`).join(' ')}
            fill="none"
            stroke="var(--wl-primary-500)"
            strokeWidth="2"
          />
        )}

        {/* Axis labels */}
        <text x="5" y={height - padding + 15} fontSize="10" fill="var(--wl-text-secondary)">
          0ms
        </text>
        <text
          x={width - 30}
          y={height - padding + 15}
          fontSize="10"
          fill="var(--wl-text-secondary)"
        >
          {Math.round(max)}ms
        </text>
      </svg>
    );
  };

  // Generate error rate visualization
  const generateErrorRate = () => {
    const width = 300;
    const height = 30;
    const avgErrorRate =
      errorRateHistory.length > 0
        ? errorRateHistory.reduce((a, b) => a + b, 0) / errorRateHistory.length
        : 0;

    const getColor = () => {
      if (avgErrorRate < 1) return 'var(--wl-success-500)';
      if (avgErrorRate < 5) return 'var(--wl-warning-500)';
      return 'var(--wl-danger-500)';
    };

    return (
      <svg width="100%" height="40" viewBox={`0 0 ${width} ${height}`}>
        {/* Background bar */}
        <rect x="0" y="5" width={width} height="20" fill="var(--wl-border-subtle)" rx="4" />

        {/* Error rate bar */}
        <rect
          x="0"
          y="5"
          width={(avgErrorRate / 10) * width}
          height="20"
          fill={getColor()}
          rx="4"
          className="transition-all duration-500"
        />

        {/* Zones */}
        <line x1={(width * 0.6) / 10} y1="0" x2={(width * 0.6) / 10} y2={height} stroke="var(--wl-warning-500)" strokeWidth="1" opacity="0.5" />
        <line x1={(width * 0.8) / 10} y1="0" x2={(width * 0.8) / 10} y2={height} stroke="var(--wl-danger-500)" strokeWidth="1" opacity="0.5" />

        {/* Labels */}
        <text x="5" y={height + 15} fontSize="10" fill="var(--wl-text-secondary)">
          {avgErrorRate.toFixed(2)}%
        </text>
      </svg>
    );
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Health Score Card */}
        <div className="border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
          <h3 className="text-sm font-semibold text-wl-text-secondary mb-4">Overall Health</h3>
          {generateHealthGauge()}
        </div>

        {/* Health Checks Grid */}
        <div className="col-span-1 lg:col-span-2 border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
          <h3 className="text-sm font-semibold text-wl-text-secondary mb-4">Health Checks</h3>
          <div className="space-y-3">
            {healthChecks.map((check) => {
              const getStatusColor = () => {
                switch (check.status) {
                  case 'healthy':
                    return 'bg-wl-success-100 text-wl-success-700 dark:bg-wl-success-900/30 dark:text-wl-success-300';
                  case 'degraded':
                    return 'bg-wl-warning-100 text-wl-warning-700 dark:bg-wl-warning-900/30 dark:text-wl-warning-300';
                  case 'unhealthy':
                    return 'bg-wl-danger-100 text-wl-danger-700 dark:bg-wl-danger-900/30 dark:text-wl-danger-300';
                  default:
                    return 'bg-wl-surface-hover text-wl-text-secondary';
                }
              };

              return (
                <div key={check.name} className="flex items-center justify-between p-2 rounded bg-wl-surface-hover">
                  <div>
                    <div className="text-sm font-medium text-wl-text-primary">{check.name}</div>
                    {check.message && (
                      <div className="text-xs text-wl-text-secondary">{check.message}</div>
                    )}
                  </div>
                  <span className={cn('px-2 py-1 rounded text-xs font-medium', getStatusColor())}>
                    {check.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Response Time Trend */}
        <div className="col-span-1 lg:col-span-2 border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
          <h3 className="text-sm font-semibold text-wl-text-secondary mb-4">Response Time (24h)</h3>
          {generateResponseTimeTrend()}
        </div>

        {/* Error Rate */}
        <div className="border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
          <h3 className="text-sm font-semibold text-wl-text-secondary mb-4">Error Rate</h3>
          {generateErrorRate()}
        </div>

        {/* Last Check & Action */}
        <div className="col-span-1 lg:col-span-3 border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-wl-text-primary mb-1">Last Check</div>
              <div className="text-xs text-wl-text-secondary">
                {healthChecks.length > 0 ? healthChecks[0].checkedAt.toLocaleString() : 'Never'}
              </div>
            </div>
            <button
              onClick={() => onCheckNow?.(providerId)}
              className={cn(
                'px-4 py-2 rounded font-medium text-sm transition-colors',
                'bg-wl-primary-500 text-white hover:bg-wl-primary-600',
                'dark:bg-wl-primary-600 dark:hover:bg-wl-primary-700'
              )}
            >
              Check Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
