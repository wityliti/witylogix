"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { DriverBehaviorChartProps, DriverBehaviorEvent } from "./types";

/**
 * Driver Behavior Chart Component
 * SVG stacked bar chart showing behavior events per day
 * Events: harsh braking (red), rapid acceleration (orange), speeding (yellow), sharp turns (blue)
 */
export function DriverBehaviorChart({
  data,
  height = 300,
  showLegend = true,
  dateRange,
  onDateRangeChange,
  className,
}: DriverBehaviorChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const [tooltipData, setTooltipData] = useState<any>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

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

  const padding = { top: 30, right: 20, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Get max value for Y scale
  const maxValue = Math.max(
    ...data.map((d) => d.harshBraking + d.rapidAcceleration + d.speeding + d.sharpTurns),
    10
  );

  const eventTypes = [
    { key: "harshBraking", label: "Harsh Braking", color: "var(--wl-danger-500)" },
    { key: "rapidAcceleration", label: "Rapid Acceleration", color: "var(--wl-chart-orange)" },
    { key: "speeding", label: "Speeding", color: "var(--wl-warning-500)" },
    { key: "sharpTurns", label: "Sharp Turns", color: "var(--wl-info-500)" },
  ];

  // Bar dimensions
  const barWidth = Math.max((chartWidth / data.length) * 0.7, 20);
  const barGap = (chartWidth / data.length) - barWidth;

  // Draw bars
  const bars = data.map((day, i) => {
    const x = padding.left + (chartWidth / data.length) * i + barGap / 2;
    let y = padding.top + chartHeight;
    const barSegments: { x: number; y: number; width: number; height: number; color: string; label: string; value: number; date: string }[] = [];

    let totalEvents = 0;
    eventTypes.forEach((event) => {
      const value = (day as any)[event.key as keyof DriverBehaviorEvent];
      totalEvents += value;
    });

    eventTypes.forEach((event, idx) => {
      const value = (day as any)[event.key as keyof DriverBehaviorEvent];
      const segmentHeight = (value / maxValue) * chartHeight;

      barSegments.push({
        x,
        y: y - segmentHeight,
        width: barWidth,
        height: segmentHeight,
        color: event.color,
        label: event.label,
        value,
        date: day.date,
      });

      y -= segmentHeight;
    });

    return barSegments;
  });

  const handleBarHover = (date: string, segments: any[]) => {
    setHoveredBar(date);
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    setTooltipData({
      date,
      segments: segments.map((s) => ({ label: s.label, value: s.value, color: s.color })),
      total,
    });
  };

  const handleBarMove = (segment: any, e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 20,
    });
  };

  const handleBarLeave = () => {
    setHoveredBar(null);
    setTooltipData(null);
  };

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-wl-text-primary">Driver Behavior Events</h3>
        {dateRange && onDateRangeChange && (
          <div className="text-xs text-wl-text-secondary">
            {new Date(dateRange.start).toLocaleDateString()} -{" "}
            {new Date(dateRange.end).toLocaleDateString()}
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="drop-shadow-sm"
      >
        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1"
        />

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={width - padding.right}
          y2={padding.top + chartHeight}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1"
        />

        {/* Y-axis gridlines and labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = padding.top + chartHeight * (1 - ratio);
          const value = Math.round(maxValue * ratio);

          return (
            <g key={`gridline-${i}`}>
              <line
                x1={padding.left - 5}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="rgba(255, 255, 255, 0.6)"
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {bars.map((segments, i) => (
          <g key={`bar-${i}`}>
            {segments.map((segment, idx) => (
              <rect
                key={`segment-${i}-${idx}`}
                x={segment.x}
                y={segment.y}
                width={segment.width}
                height={segment.height}
                fill={segment.color}
                opacity={hoveredBar === segment.date ? 0.9 : 0.8}
                className="cursor-pointer transition-opacity"
                onMouseEnter={() => handleBarHover(segment.date, segments)}
                onMouseMove={(e) => handleBarMove(segment, e)}
                onMouseLeave={handleBarLeave}
              />
            ))}
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((day, i) => {
          const x = padding.left + (chartWidth / data.length) * i + (chartWidth / data.length) / 2;
          const date = new Date(day.date);
          const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

          return (
            <text
              key={`label-${i}`}
              x={x}
              y={padding.top + chartHeight + 20}
              textAnchor="middle"
              fontSize="11"
              fill="rgba(255, 255, 255, 0.6)"
            >
              {label}
            </text>
          );
        })}

        {/* Y-axis label */}
        <text
          x={15}
          y={padding.top + chartHeight / 2}
          textAnchor="middle"
          fontSize="11"
          fill="rgba(255, 255, 255, 0.6)"
          transform={`rotate(-90 15 ${padding.top + chartHeight / 2})`}
        >
          Events Count
        </text>

        {/* Tooltip */}
        {tooltipData && (
          <g>
            {/* Tooltip background */}
            <rect
              x={tooltipPos.x - 80}
              y={tooltipPos.y - 60}
              width="160"
              height="60"
              fill="rgba(15, 23, 42, 0.95)"
              stroke="rgba(96, 165, 250, 0.3)"
              strokeWidth="1"
              rx="4"
            />

            {/* Date */}
            <text
              x={tooltipPos.x}
              y={tooltipPos.y - 45}
              textAnchor="middle"
              fontSize="12"
              fontWeight="bold"
              fill="rgba(255, 255, 255, 0.9)"
            >
              {new Date(tooltipData.date).toLocaleDateString()}
            </text>

            {/* Event values */}
            {tooltipData.segments.map((segment: any, idx: number) => (
              <g key={`tooltip-segment-${idx}`}>
                <rect
                  x={tooltipPos.x - 75}
                  y={tooltipPos.y - 35 + idx * 15}
                  width="8"
                  height="8"
                  fill={segment.color}
                  rx="1"
                />
                <text
                  x={tooltipPos.x - 60}
                  y={tooltipPos.y - 28 + idx * 15}
                  fontSize="10"
                  fill="rgba(255, 255, 255, 0.7)"
                >
                  {segment.label}: {segment.value}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-4 mt-4 text-xs">
          {eventTypes.map((event) => (
            <div key={event.key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: event.color }}
              />
              <span className="text-wl-text-secondary">{event.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
