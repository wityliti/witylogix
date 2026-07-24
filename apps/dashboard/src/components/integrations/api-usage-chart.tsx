"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { ApiUsageChartProps } from "./types";

/**
 * API usage chart component
 * SVG line chart for API requests and errors over time
 */
export function ApiUsageChart({
  data,
  timeRange: initialTimeRange,
  onTimeRangeChange,
  className,
}: ApiUsageChartProps) {
  const [timeRange, setTimeRange] = useState(initialTimeRange);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleTimeRangeChange = (range: typeof initialTimeRange) => {
    setTimeRange(range);
    onTimeRangeChange?.(range);
  };

  // Calculate chart dimensions and scaling
  const chartData = useMemo(() => {
    const width = 600;
    const height = 300;
    const padding = 40;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    // Get max values for scaling
    const maxRequests = Math.max(...data.map((d) => d.requests), 100);
    const maxErrors = Math.max(...data.map((d) => d.errors), 10);

    // Generate points for both lines
    const requestPoints = data.map((d, idx) => {
      const x = padding + (idx / (data.length - 1 || 1)) * innerWidth;
      const normalized = d.requests / maxRequests;
      const y = height - padding - normalized * innerHeight;
      return { x, y, value: d.requests, timestamp: d.timestamp };
    });

    const errorPoints = data.map((d, idx) => {
      const x = padding + (idx / (data.length - 1 || 1)) * innerWidth;
      const normalized = d.errors / maxErrors;
      const y = height - padding - normalized * innerHeight;
      return { x, y, value: d.errors, timestamp: d.timestamp };
    });

    // Calculate average line
    const avgRequests =
      data.reduce((sum, d) => sum + d.requests, 0) / data.length;
    const avgY = height - padding - (avgRequests / maxRequests) * innerHeight;

    return {
      width,
      height,
      padding,
      innerWidth,
      innerHeight,
      requestPoints,
      errorPoints,
      avgY,
      maxRequests,
      maxErrors,
    };
  }, [data]);

  // Tooltip data
  const tooltipData = useMemo(() => {
    if (hoveredIndex === null) return null;
    return {
      requests: chartData.requestPoints[hoveredIndex],
      errors: chartData.errorPoints[hoveredIndex],
      data: data[hoveredIndex],
    };
  }, [hoveredIndex, chartData, data]);

  // Format time label
  const getTimeLabel = (): string => {
    switch (timeRange) {
      case "1h":
        return "Last Hour";
      case "6h":
        return "Last 6 Hours";
      case "24h":
        return "Last 24 Hours";
      case "7d":
        return "Last 7 Days";
      case "30d":
        return "Last 30 Days";
      default:
        return "API Usage";
    }
  };

  // Format tooltip time
  const formatTime = (date: Date): string => {
    switch (timeRange) {
      case "1h":
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      case "6h":
      case "24h":
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      case "7d":
      case "30d":
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      default:
        return date.toLocaleString();
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-wl-text-primary">
              {getTimeLabel()}
            </h3>
            <p className="text-sm text-wl-text-secondary mt-1">
              Request and error metrics
            </p>
          </div>

          {/* Time range selector */}
          <div className="flex gap-2">
            {(["1h", "6h", "24h", "7d", "30d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium transition-colors",
                  timeRange === range
                    ? "bg-wl-primary-500 text-white"
                    : "bg-wl-surface-hover text-wl-text-secondary hover:bg-wl-border-subtle",
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-6 pb-6 border-b border-wl-border-subtle">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-wl-primary-500" />
            <span className="text-sm text-wl-text-primary">Requests</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-wl-danger-500" />
            <span className="text-sm text-wl-text-primary">Errors</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-px w-4 bg-wl-warning-400" />
            <span className="text-sm text-wl-text-secondary">Average</span>
          </div>
        </div>

        {/* Chart */}
        <div className="relative mb-6">
          <svg
            width="100%"
            height="400"
            viewBox={`0 0 ${chartData.width} ${chartData.height}`}
            className="overflow-visible"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const svgX = (x / rect.width) * chartData.width;

              // Find nearest point
              let nearest = 0;
              let minDist = Infinity;
              chartData.requestPoints.forEach((point, idx) => {
                const dist = Math.abs(point.x - svgX);
                if (dist < minDist) {
                  minDist = dist;
                  nearest = idx;
                }
              });

              if (minDist < 30) setHoveredIndex(nearest);
            }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Grid lines - vertical */}
            {chartData.requestPoints.map((point, idx) => {
              if (idx % Math.max(1, Math.floor(data.length / 5)) !== 0)
                return null;
              return (
                <line
                  key={`grid-v-${idx}`}
                  x1={point.x}
                  y1={chartData.padding}
                  x2={point.x}
                  y2={chartData.height - chartData.padding}
                  stroke="var(--wl-border-subtle)"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
              );
            })}

            {/* Grid lines - horizontal */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y =
                chartData.height -
                chartData.padding -
                ratio * chartData.innerHeight;
              return (
                <line
                  key={`grid-h-${idx}`}
                  x1={chartData.padding}
                  y1={y}
                  x2={chartData.width - chartData.padding}
                  y2={y}
                  stroke="var(--wl-border-subtle)"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
              );
            })}

            {/* Average line */}
            <line
              x1={chartData.padding}
              y1={chartData.avgY}
              x2={chartData.width - chartData.padding}
              y2={chartData.avgY}
              stroke="var(--wl-warning-400)"
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.7"
            />

            {/* Request area fill */}
            {chartData.requestPoints.length > 1 && (
              <path
                d={`M ${chartData.padding} ${chartData.height - chartData.padding} L ${chartData.requestPoints
                  .map((p) => `${p.x} ${p.y}`)
                  .join(
                    " L ",
                  )} L ${chartData.width - chartData.padding} ${chartData.height - chartData.padding} Z`}
                fill="var(--wl-primary-400)"
                fillOpacity="0.1"
              />
            )}

            {/* Request line */}
            {chartData.requestPoints.length > 1 && (
              <polyline
                points={chartData.requestPoints
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill="none"
                stroke="var(--wl-primary-500)"
                strokeWidth="2"
              />
            )}

            {/* Error line */}
            {chartData.errorPoints.length > 1 && (
              <polyline
                points={chartData.errorPoints
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill="none"
                stroke="var(--wl-danger-500)"
                strokeWidth="2"
              />
            )}

            {/* Hover indicator */}
            {hoveredIndex !== null && (
              <>
                <circle
                  cx={chartData.requestPoints[hoveredIndex].x}
                  cy={chartData.requestPoints[hoveredIndex].y}
                  r="4"
                  fill="var(--wl-primary-500)"
                />
                <circle
                  cx={chartData.errorPoints[hoveredIndex].x}
                  cy={chartData.errorPoints[hoveredIndex].y}
                  r="4"
                  fill="var(--wl-danger-500)"
                />
                <line
                  x1={chartData.requestPoints[hoveredIndex].x}
                  y1={chartData.padding}
                  x2={chartData.requestPoints[hoveredIndex].x}
                  y2={chartData.height - chartData.padding}
                  stroke="var(--wl-border-subtle)"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              </>
            )}

            {/* Axis labels */}
            {/* Y-axis */}
            <text
              x={chartData.padding - 10}
              y={chartData.padding - 5}
              textAnchor="end"
              fontSize="10"
              fill="var(--wl-text-secondary)"
            >
              {Math.round(chartData.maxRequests)}
            </text>
            <text
              x={chartData.padding - 10}
              y={chartData.height - chartData.padding + 5}
              textAnchor="end"
              fontSize="10"
              fill="var(--wl-text-secondary)"
            >
              0
            </text>

            {/* X-axis labels */}
            {[0, data.length - 1].map((idx) => (
              <text
                key={`x-axis-${idx}`}
                x={chartData.requestPoints[idx].x}
                y={chartData.height - chartData.padding + 20}
                textAnchor="middle"
                fontSize="10"
                fill="var(--wl-text-secondary)"
              >
                {formatTime(data[idx].timestamp)}
              </text>
            ))}
          </svg>

          {/* Tooltip */}
          {tooltipData && hoveredIndex !== null && (
            <div
              className={cn(
                "absolute -top-24 -translate-x-1/2 bg-wl-text-primary text-white rounded-lg p-3 text-sm shadow-lg whitespace-nowrap pointer-events-none z-10",
                "dark:bg-wl-text-primary",
              )}
              style={{
                left: `calc(${(hoveredIndex / (data.length - 1 || 1)) * 100}% + ${(chartData.padding / chartData.width) * 100}%)`,
              }}
            >
              <div className="font-semibold">
                {formatTime(tooltipData.data.timestamp)}
              </div>
              <div className="text-xs text-white/90">
                Requests: {tooltipData.requests.value}
              </div>
              <div className="text-xs text-white/90">
                Errors: {tooltipData.errors.value}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 rounded bg-wl-surface-hover">
            <div className="text-xs text-wl-text-secondary mb-1">
              Total Requests
            </div>
            <div className="text-lg font-semibold text-wl-text-primary">
              {data.reduce((sum, d) => sum + d.requests, 0).toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded bg-wl-surface-hover">
            <div className="text-xs text-wl-text-secondary mb-1">
              Total Errors
            </div>
            <div className="text-lg font-semibold text-wl-danger-600">
              {data.reduce((sum, d) => sum + d.errors, 0).toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded bg-wl-surface-hover">
            <div className="text-xs text-wl-text-secondary mb-1">
              Avg Requests/Period
            </div>
            <div className="text-lg font-semibold text-wl-text-primary">
              {Math.round(
                data.reduce((sum, d) => sum + d.requests, 0) / data.length,
              )}
            </div>
          </div>
          <div className="p-3 rounded bg-wl-surface-hover">
            <div className="text-xs text-wl-text-secondary mb-1">
              Error Rate
            </div>
            <div className="text-lg font-semibold text-wl-warning-600">
              {(
                (data.reduce((sum, d) => sum + d.errors, 0) /
                  data.reduce((sum, d) => sum + d.requests, 0)) *
                100
              ).toFixed(2)}
              %
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
