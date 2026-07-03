"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { IdleTimeChartProps, IdleTimeEntry } from "./types";

/**
 * Idle Time Chart Component
 * SVG horizontal bar chart showing vehicle idle times
 * Color-coded: green < 1h, yellow 1-3h, red > 3h
 * Includes fleet average line
 */
export function IdleTimeChart({
  data,
  height = 300,
  fleetAverage,
  sortBy = "idle",
  className,
}: IdleTimeChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  // Responsive width observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      setWidth(container.clientWidth);
    });

    observer.observe(container);
    setWidth(container.clientWidth);

    return () => observer.disconnect();
  }, []);

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...data];
    if (sortBy === "idle") {
      sorted.sort((a, b) => b.idleHours - a.idleHours);
    } else {
      sorted.sort((a, b) => a.vehicleName.localeCompare(b.vehicleName));
    }
    return sorted;
  }, [data, sortBy]);

  const padding = { top: 30, right: 80, bottom: 20, left: 160 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Get max value for X scale
  const maxValue = Math.max(
    ...(data.map((d) => d.idleHours) || [10]),
    fleetAverage || 10
  );

  // Calculate bar heights
  const barHeight = Math.max((chartHeight / sortedData.length) * 0.7, 16);
  const barGap = (chartHeight / sortedData.length) - barHeight;

  // Get color based on idle hours
  const getBarColor = (hours: number) => {
    if (hours < 1) return "var(--wl-success-500)";
    if (hours < 3) return "var(--wl-warning-500)";
    return "var(--wl-danger-500)";
  };

  // Calculate average if not provided
  const calculatedAverage =
    fleetAverage || (sortedData.reduce((sum, d) => sum + d.idleHours, 0) / sortedData.length || 0);
  const averageX = padding.left + (calculatedAverage / maxValue) * chartWidth;

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-wl-text-primary">Vehicle Idle Time</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-wl-success-400" />
            <span className="text-wl-text-secondary">&lt; 1h</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-wl-warning-400" />
            <span className="text-wl-text-secondary">1-3h</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-wl-danger-400" />
            <span className="text-wl-text-secondary">&gt; 3h</span>
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="drop-shadow-sm"
      >
        {/* X-axis */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={width - padding.right}
          y2={padding.top + chartHeight}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1"
        />

        {/* X-axis gridlines and labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const x = padding.left + chartWidth * ratio;
          const value = Math.round(maxValue * ratio * 10) / 10;

          return (
            <g key={`gridline-${i}`}>
              <line
                x1={x}
                y1={padding.top}
                x2={x}
                y2={padding.top + chartHeight}
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="1"
              />
              <text
                x={x}
                y={padding.top + chartHeight + 15}
                textAnchor="middle"
                fontSize="11"
                fill="rgba(255, 255, 255, 0.6)"
              >
                {value}h
              </text>
            </g>
          );
        })}

        {/* Fleet average line */}
        {calculatedAverage > 0 && (
          <g>
            <line
              x1={averageX}
              y1={padding.top}
              x2={averageX}
              y2={padding.top + chartHeight}
              stroke="rgba(96, 165, 250, 0.6)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <rect
              x={averageX - 35}
              y={padding.top - 18}
              width="70"
              height="16"
              fill="rgba(15, 23, 42, 0.9)"
              stroke="rgba(96, 165, 250, 0.4)"
              strokeWidth="1"
              rx="2"
            />
            <text
              x={averageX}
              y={padding.top - 4}
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill="rgba(96, 165, 250, 1)"
            >
              Avg: {calculatedAverage.toFixed(1)}h
            </text>
          </g>
        )}

        {/* Bars */}
        {sortedData.map((vehicle, i) => {
          const y = padding.top + (chartHeight / sortedData.length) * i + barGap / 2;
          const barWidth = (vehicle.idleHours / maxValue) * chartWidth;
          const isHovered = hoveredBar === vehicle.vehicleId;

          return (
            <g key={`bar-${i}`}>
              {/* Bar */}
              <rect
                x={padding.left}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={getBarColor(vehicle.idleHours)}
                opacity={isHovered ? 0.9 : 0.8}
                className="cursor-pointer transition-opacity"
                onMouseEnter={() => setHoveredBar(vehicle.vehicleId)}
                onMouseLeave={() => setHoveredBar(null)}
                rx="2"
              />

              {/* Value label */}
              <text
                x={padding.left + barWidth + 8}
                y={y + barHeight / 2 + 4}
                fontSize="12"
                fontWeight="bold"
                fill="currentColor"
                className="text-wl-text-primary"
              >
                {vehicle.idleHours.toFixed(1)}h
              </text>

              {/* Vehicle name label */}
              <text
                x={padding.left - 8}
                y={y + barHeight / 2 + 4}
                textAnchor="end"
                fontSize="12"
                fill="currentColor"
                className={cn(
                  "text-wl-text-primary transition-opacity",
                  isHovered && "opacity-100",
                  !isHovered && "opacity-80"
                )}
              >
                {vehicle.vehicleName}
              </text>
            </g>
          );
        })}

        {/* X-axis label */}
        <text
          x={padding.left + chartWidth / 2}
          y={height - 2}
          textAnchor="middle"
          fontSize="11"
          fill="rgba(255, 255, 255, 0.6)"
        >
          Idle Hours
        </text>
      </svg>

      {/* Statistics footer */}
      {sortedData.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-wl-bg-overlay border border-wl-border-default">
            <div className="text-wl-text-secondary mb-1">Highest</div>
            <div className="text-lg font-bold text-wl-text-primary">
              {Math.max(...sortedData.map((d) => d.idleHours)).toFixed(1)}h
            </div>
            <div className="text-wl-text-secondary">
              {sortedData.reduce((max, d) => (d.idleHours > max.idleHours ? d : max)).vehicleName}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-wl-bg-overlay border border-wl-border-default">
            <div className="text-wl-text-secondary mb-1">Average</div>
            <div className="text-lg font-bold text-wl-text-primary">
              {calculatedAverage.toFixed(1)}h
            </div>
            <div className="text-wl-text-secondary">Fleet Wide</div>
          </div>
          <div className="p-3 rounded-lg bg-wl-bg-overlay border border-wl-border-default">
            <div className="text-wl-text-secondary mb-1">Lowest</div>
            <div className="text-lg font-bold text-wl-text-primary">
              {Math.min(...sortedData.map((d) => d.idleHours)).toFixed(1)}h
            </div>
            <div className="text-wl-text-secondary">
              {sortedData.reduce((min, d) => (d.idleHours < min.idleHours ? d : min)).vehicleName}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
