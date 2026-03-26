"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface LatencyDataPoint {
  timestamp: Date;
  p50: number;
  p95: number;
  p99: number;
}

export interface LatencySparklineProps {
  data: LatencyDataPoint[];
  slaTargetMs?: number;
  timeRange?: "1h" | "24h" | "7d";
  width?: number;
  height?: number;
  onPointHover?: (point: LatencyDataPoint | null) => void;
  className?: string;
}

export function LatencySparkline({
  data,
  slaTargetMs = 200,
  timeRange = "24h",
  width = 400,
  height = 120,
  onPointHover,
  className,
}: LatencySparklineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<LatencyDataPoint | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className={cn("w-full flex items-center justify-center bg-wl-surface-hover rounded-lg p-8", className)}>
        <div className="text-wl-text-secondary text-sm">No latency data available</div>
      </div>
    );
  }

  // Calculate max value for scaling
  const allValues = data.flatMap((d) => [d.p50, d.p95, d.p99, slaTargetMs]);
  const maxValue = Math.max(...allValues) * 1.15; // Add 15% padding

  // Calculate points for SVG
  const pointSpacing = width / (data.length - 1);
  const yScale = height / maxValue;

  // Create path data for each percentile
  const createPathData = (percentile: "p50" | "p95" | "p99"): string => {
    return data
      .map(
        (d, idx) =>
          `${idx * pointSpacing},${height - (d[percentile] || 0) * yScale}`
      )
      .join(" ");
  };

  // Create SLA threshold line
  const slaY = height - slaTargetMs * yScale;

  // Handle hover
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const index = Math.round(x / pointSpacing);

    if (index >= 0 && index < data.length) {
      setHoveredIndex(index);
      setHoveredPoint(data[index]);
      onPointHover?.(data[index]);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setHoveredPoint(null);
    onPointHover?.(null);
  };

  const formatTime = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-wl-text-primary">
            Latency Distribution
          </h4>
          <span className="text-xs text-wl-text-secondary">{timeRange}</span>
        </div>

        {/* SVG Chart */}
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="cursor-crosshair mb-4"
        >
          {/* Background grid */}
          {[0.25, 0.5, 0.75].map((fraction) => (
            <line
              key={`grid-${fraction}`}
              x1="0"
              y1={height * (1 - fraction)}
              x2={width}
              y2={height * (1 - fraction)}
              stroke="var(--wl-border-subtle)"
              strokeWidth="0.5"
              strokeDasharray="4,2"
            />
          ))}

          {/* SLA Target line */}
          {slaY >= 0 && slaY <= height && (
            <g>
              <line
                x1="0"
                y1={slaY}
                x2={width}
                y2={slaY}
                stroke="var(--wl-danger-500)"
                strokeWidth="1.5"
                strokeDasharray="6,3"
              />
              <text
                x="5"
                y={slaY - 8}
                fontSize="10"
                fill="var(--wl-danger-500)"
                fontWeight="500"
              >
                SLA {slaTargetMs}ms
              </text>
            </g>
          )}

          {/* P50 (green) */}
          <polyline
            points={createPathData("p50")}
            fill="none"
            stroke="var(--wl-success-500)"
            strokeWidth="2"
            opacity="0.9"
          />

          {/* P95 (yellow) */}
          <polyline
            points={createPathData("p95")}
            fill="none"
            stroke="var(--wl-warning-500)"
            strokeWidth="2"
            opacity="0.8"
          />

          {/* P99 (red) */}
          <polyline
            points={createPathData("p99")}
            fill="none"
            stroke="var(--wl-danger-500)"
            strokeWidth="2"
            opacity="0.7"
          />

          {/* Hover tooltip background */}
          {hoveredIndex !== null && (
            <g>
              <line
                x1={hoveredIndex * pointSpacing}
                y1="0"
                x2={hoveredIndex * pointSpacing}
                y2={height}
                stroke="var(--wl-border-subtle)"
                strokeWidth="1"
                strokeDasharray="4,2"
              />
              <circle
                cx={hoveredIndex * pointSpacing}
                cy={height - (data[hoveredIndex].p50 || 0) * yScale}
                r="4"
                fill="var(--wl-success-500)"
              />
              <circle
                cx={hoveredIndex * pointSpacing}
                cy={height - (data[hoveredIndex].p95 || 0) * yScale}
                r="4"
                fill="var(--wl-warning-500)"
              />
              <circle
                cx={hoveredIndex * pointSpacing}
                cy={height - (data[hoveredIndex].p99 || 0) * yScale}
                r="4"
                fill="var(--wl-danger-500)"
              />
            </g>
          )}
        </svg>

        {/* Legend and Hover Data */}
        <div className="space-y-3">
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-wl-success-500" />
              <span className="text-wl-text-secondary">P50</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-wl-warning-500" />
              <span className="text-wl-text-secondary">P95</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-wl-danger-500" />
              <span className="text-wl-text-secondary">P99</span>
            </div>
          </div>

          {/* Hover tooltip */}
          {hoveredPoint && (
            <div className="bg-wl-surface-hover rounded p-3 border border-wl-border-subtle">
              <div className="text-xs text-wl-text-secondary mb-2">
                {formatTime(hoveredPoint.timestamp)}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-wl-text-secondary mb-1">P50</div>
                  <div className="text-sm font-semibold text-wl-success-600">
                    {hoveredPoint.p50.toFixed(0)}ms
                  </div>
                </div>
                <div>
                  <div className="text-xs text-wl-text-secondary mb-1">P95</div>
                  <div className="text-sm font-semibold text-wl-warning-600">
                    {hoveredPoint.p95.toFixed(0)}ms
                  </div>
                </div>
                <div>
                  <div className="text-xs text-wl-text-secondary mb-1">P99</div>
                  <div className="text-sm font-semibold text-wl-danger-600">
                    {hoveredPoint.p99.toFixed(0)}ms
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
