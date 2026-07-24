"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface WebhookDeliveryHour {
  hour: Date;
  successful: number;
  failed: number;
  pending: number;
  avgLatencyMs: number;
}

export interface WebhookDeliveryChartProps {
  data: WebhookDeliveryHour[];
  onHourHover?: (hour: WebhookDeliveryHour | null) => void;
  className?: string;
}

export function WebhookDeliveryChart({
  data,
  onHourHover,
  className,
}: WebhookDeliveryChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "w-full flex items-center justify-center bg-wl-surface-hover rounded-lg p-8",
          className,
        )}
      >
        <div className="text-wl-text-secondary text-sm">
          No webhook delivery data available
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalDelivered = data.reduce((sum, h) => sum + h.successful, 0);
  const totalFailed = data.reduce((sum, h) => sum + h.failed, 0);
  const totalPending = data.reduce((sum, h) => sum + h.pending, 0);
  const totalCount = totalDelivered + totalFailed + totalPending;
  const avgLatency =
    data.reduce((sum, h) => sum + h.avgLatencyMs, 0) / data.length;
  const failRate =
    totalCount > 0 ? ((totalFailed / totalCount) * 100).toFixed(2) : "0.00";

  // Chart dimensions
  const chartWidth = 600;
  const chartHeight = 200;
  const barWidth = chartWidth / data.length;
  const maxValue = Math.max(
    ...data.map((d) => d.successful + d.failed + d.pending),
  );
  const yScale = chartHeight / maxValue;

  // Calculate max latency for line chart
  const maxLatency = Math.max(...data.map((d) => d.avgLatencyMs)) * 1.1;
  const latencyScale = chartHeight / maxLatency;

  const formatHour = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const handleHover = (index: number) => {
    setHoveredIndex(index);
    onHourHover?.(data[index]);
  };

  const handleLeave = () => {
    setHoveredIndex(null);
    onHourHover?.(null);
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-4">
        {/* Header */}
        <h4 className="text-sm font-semibold text-wl-text-primary mb-4">
          Webhook Deliveries (24h)
        </h4>

        {/* Stacked Bar Chart */}
        <div className="relative mb-6 pb-6 border-b border-wl-border-subtle">
          <svg
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="xMidYMid meet"
            className="mb-2"
          >
            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line
                key={`grid-${fraction}`}
                x1="0"
                y1={chartHeight * (1 - fraction)}
                x2={chartWidth}
                y2={chartHeight * (1 - fraction)}
                stroke="var(--wl-border-subtle)"
                strokeWidth="0.5"
              />
            ))}

            {/* Bars and latency line */}
            {data.map((hour, idx) => {
              const x = idx * barWidth;
              const barHeight =
                (hour.successful + hour.failed + hour.pending) * yScale;
              const successHeight = hour.successful * yScale;
              const failedHeight = hour.failed * yScale;

              return (
                <g
                  key={idx}
                  onMouseEnter={() => handleHover(idx)}
                  onMouseLeave={handleLeave}
                  style={{ cursor: "pointer" }}
                >
                  {/* Stacked bar */}
                  <g>
                    {/* Success (green) */}
                    <rect
                      x={x + 2}
                      y={chartHeight - successHeight}
                      width={barWidth - 4}
                      height={successHeight}
                      fill="var(--wl-success-500)"
                      opacity={hoveredIndex === idx ? 1 : 0.8}
                    />
                    {/* Failed (red) */}
                    <rect
                      x={x + 2}
                      y={chartHeight - successHeight - failedHeight}
                      width={barWidth - 4}
                      height={failedHeight}
                      fill="var(--wl-danger-500)"
                      opacity={hoveredIndex === idx ? 1 : 0.8}
                    />
                    {/* Pending (yellow) */}
                    <rect
                      x={x + 2}
                      y={chartHeight - barHeight}
                      width={barWidth - 4}
                      height={hour.pending * yScale}
                      fill="var(--wl-warning-500)"
                      opacity={hoveredIndex === idx ? 1 : 0.6}
                    />
                  </g>

                  {/* Hover highlight */}
                  {hoveredIndex === idx && (
                    <rect
                      x={x}
                      y="0"
                      width={barWidth}
                      height={chartHeight}
                      fill="var(--wl-primary-500)"
                      opacity="0.05"
                    />
                  )}
                </g>
              );
            })}

            {/* Average latency line */}
            <polyline
              points={data
                .map(
                  (hour, idx) =>
                    `${idx * barWidth + barWidth / 2},${chartHeight - hour.avgLatencyMs * latencyScale}`,
                )
                .join(" ")}
              fill="none"
              stroke="var(--wl-primary-500)"
              strokeWidth="2"
              opacity="0.6"
            />
          </svg>

          {/* Hover tooltip */}
          {hoveredIndex !== null && (
            <div className="absolute top-0 left-0 bg-wl-surface-hover rounded p-3 border border-wl-border-subtle shadow-lg z-10 text-sm">
              <div className="text-xs font-medium text-wl-text-secondary mb-2">
                {formatHour(data[hoveredIndex].hour)}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-wl-success-500" />
                  <span className="text-wl-text-secondary">Success:</span>
                  <span className="font-semibold text-wl-success-600">
                    {data[hoveredIndex].successful}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-wl-danger-500" />
                  <span className="text-wl-text-secondary">Failed:</span>
                  <span className="font-semibold text-wl-danger-600">
                    {data[hoveredIndex].failed}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-wl-warning-500" />
                  <span className="text-wl-text-secondary">Pending:</span>
                  <span className="font-semibold text-wl-warning-600">
                    {data[hoveredIndex].pending}
                  </span>
                </div>
                <div className="border-t border-wl-border-subtle pt-1 mt-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-wl-primary-500" />
                    <span className="text-wl-text-secondary">Latency:</span>
                    <span className="font-semibold text-wl-primary-600">
                      {data[hoveredIndex].avgLatencyMs.toFixed(0)}ms
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs mb-6 pb-6 border-b border-wl-border-subtle">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-wl-success-500" />
            <span className="text-wl-text-secondary">Successful</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-wl-danger-500" />
            <span className="text-wl-text-secondary">Failed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-wl-warning-500" />
            <span className="text-wl-text-secondary">Pending</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-2 h-2 rounded-full bg-wl-primary-500" />
            <span className="text-wl-text-secondary">Avg Latency</span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-wl-text-secondary mb-1">
              Total Delivered
            </div>
            <div className="text-lg font-semibold text-wl-success-600">
              {totalDelivered.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-wl-text-secondary mb-1">Fail Rate</div>
            <div className="text-lg font-semibold text-wl-danger-600">
              {failRate}%
            </div>
          </div>
          <div>
            <div className="text-xs text-wl-text-secondary mb-1">
              Avg Latency
            </div>
            <div className="text-lg font-semibold text-wl-primary-600">
              {avgLatency.toFixed(0)}ms
            </div>
          </div>
          <div>
            <div className="text-xs text-wl-text-secondary mb-1">Pending</div>
            <div className="text-lg font-semibold text-wl-warning-600">
              {totalPending.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
