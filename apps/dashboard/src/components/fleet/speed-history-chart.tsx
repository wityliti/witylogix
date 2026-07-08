"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface SpeedDataPoint {
  timestamp: string;
  speed: number;
}

interface SpeedHistoryChartProps {
  data: SpeedDataPoint[];
  speedLimit?: number;
  height?: number;
  showLegend?: boolean;
  showViolations?: boolean;
  className?: string;
}

interface TooltipData {
  time: string;
  speed: number;
  isViolation: boolean;
}

/**
 * Pure SVG line chart for vehicle speed history
 * Features: speed limit line, violation highlighting, hover tooltip, zoom capability
 */
export function SpeedHistoryChart({
  data,
  speedLimit = 100,
  height = 300,
  showLegend = true,
  showViolations = true,
  className,
}: SpeedHistoryChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [zoomRange, setZoomRange] = useState({ start: 0, end: 1 });

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

  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Apply zoom
  const startIndex = Math.floor(data.length * zoomRange.start);
  const endIndex = Math.ceil(data.length * zoomRange.end);
  const zoomedData = data.slice(startIndex, endIndex);

  if (zoomedData.length === 0) {
    return (
      <div
        ref={containerRef}
        className={cn("w-full bg-wl-bg-elevated rounded-lg p-4", className)}
      >
        <p className="text-sm text-wl-text-secondary text-center">
          No speed data available
        </p>
      </div>
    );
  }

  // Calculate max speed (at least 120 km/h)
  const allSpeeds = data.map((d) => d.speed);
  const maxSpeed = Math.max(
    speedLimit * 1.2,
    Math.max(...allSpeeds) * 1.1,
    120,
  );

  const xScale = (index: number) =>
    padding.left + (index / (zoomedData.length - 1 || 1)) * chartWidth;
  const yScale = (speed: number) =>
    height - padding.bottom - (speed / maxSpeed) * chartHeight;

  // Generate main line path
  const generatePath = (): string => {
    if (zoomedData.length === 0) return "";

    const points = zoomedData.map((d, i) => `${xScale(i)},${yScale(d.speed)}`);
    return `M ${points.join(" L ")}`;
  };

  // Identify violation segments
  const violationSegments = zoomedData
    .map((d, i) => ({
      index: i,
      speed: d.speed,
      isViolation: d.speed > speedLimit,
    }))
    .reduce(
      (acc, point) => {
        if (point.isViolation) {
          const lastSegment = acc[acc.length - 1];
          if (lastSegment && lastSegment.end === point.index - 1) {
            lastSegment.end = point.index;
          } else {
            acc.push({ start: point.index, end: point.index });
          }
        }
        return acc;
      },
      [] as { start: number; end: number }[],
    );

  const handlePointHover = useCallback(
    (index: number, event: React.MouseEvent) => {
      const dataPoint = zoomedData[index];
      const isViolation = dataPoint.speed > speedLimit;

      setTooltipData({
        time: formatTime(dataPoint.timestamp),
        speed: dataPoint.speed,
        isViolation,
      });
      setTooltipPos({ x: event.clientX, y: event.clientY });
      setTooltipVisible(true);
      setHoveredIndex(index);
    },
    [zoomedData, speedLimit],
  );

  const handlePointLeave = () => {
    setTooltipVisible(false);
    setHoveredIndex(null);
  };

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="bg-transparent"
      >
        {/* Grid lines */}
        {Array.from({ length: 5 }).map((_, i) => {
          const y = padding.top + (i / 4) * chartHeight;
          return (
            <line
              key={`grid-${i}`}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="var(--wl-border-subtle)"
              strokeWidth={0.5}
              strokeDasharray="4"
            />
          );
        })}

        {/* Axes */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="var(--wl-border-default)"
          strokeWidth={1}
        />
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="var(--wl-border-default)"
          strokeWidth={1}
        />

        {/* Y-axis labels (speed) */}
        {Array.from({ length: 5 }).map((_, i) => {
          const value = (i / 4) * maxSpeed;
          const y = height - padding.bottom - (i / 4) * chartHeight;
          return (
            <text
              key={`y-label-${i}`}
              x={padding.left - 10}
              y={y + 4}
              textAnchor="end"
              fontSize="12"
              fill="var(--wl-text-tertiary)"
            >
              {Math.round(value)}
            </text>
          );
        })}

        {/* X-axis labels (time) */}
        {zoomedData.map((point, i) => {
          if (
            zoomedData.length > 10 &&
            i % Math.ceil(zoomedData.length / 5) !== 0
          ) {
            return null;
          }
          const x = xScale(i);
          return (
            <text
              key={`x-label-${i}`}
              x={x}
              y={height - padding.bottom + 20}
              textAnchor="middle"
              fontSize="12"
              fill="var(--wl-text-tertiary)"
            >
              {formatTime(point.timestamp)}
            </text>
          );
        })}

        {/* Speed limit line */}
        <line
          x1={padding.left}
          y1={yScale(speedLimit)}
          x2={width - padding.right}
          y2={yScale(speedLimit)}
          stroke="var(--wl-warning-400)"
          strokeWidth={2}
          strokeDasharray="4"
          opacity="0.7"
        />
        <text
          x={width - padding.right - 5}
          y={yScale(speedLimit) - 5}
          textAnchor="end"
          fontSize="11"
          fill="var(--wl-warning-400)"
          fontWeight="bold"
        >
          {speedLimit} km/h limit
        </text>

        {/* Violation highlights (red areas) */}
        {showViolations &&
          violationSegments.map((segment, idx) => {
            const x1 = xScale(segment.start);
            const x2 = xScale(segment.end);
            return (
              <rect
                key={`violation-${idx}`}
                x={x1}
                y={padding.top}
                width={x2 - x1 + 1}
                height={chartHeight}
                fill="var(--wl-danger-400)"
                opacity="0.05"
              />
            );
          })}

        {/* Main speed line */}
        <path
          d={generatePath()}
          stroke="var(--wl-primary-400)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Violation line segments overlay */}
        {showViolations &&
          violationSegments.map((segment, idx) => {
            const violationPoints = zoomedData
              .slice(segment.start, segment.end + 1)
              .map((d, i) => `${xScale(segment.start + i)},${yScale(d.speed)}`);
            return (
              <path
                key={`violation-line-${idx}`}
                d={`M ${violationPoints.join(" L ")}`}
                stroke="var(--wl-danger-400)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

        {/* Interactive points */}
        {zoomedData.map((point, i) => {
          const x = xScale(i);
          const y = yScale(point.speed);
          const isViolation = point.speed > speedLimit;
          const isHovered = hoveredIndex === i;

          return (
            <g key={`point-group-${i}`}>
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 6 : 3}
                fill={
                  isViolation ? "var(--wl-danger-400)" : "var(--wl-primary-400)"
                }
                opacity={isHovered ? 1 : 0.7}
                style={{
                  cursor: "pointer",
                  transition: "r 200ms, opacity 200ms",
                }}
                onMouseEnter={(e) => handlePointHover(i, e)}
                onMouseLeave={handlePointLeave}
              />

              {/* Invisible hover area */}
              <circle
                cx={x}
                cy={y}
                r={Math.max(chartWidth / zoomedData.length / 2, 15)}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => handlePointHover(i, e)}
                onMouseLeave={handlePointLeave}
              />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltipVisible && tooltipData && (
        <div
          className="fixed bg-wl-bg-elevated border border-wl-border-default rounded-lg p-3 shadow-lg z-50 pointer-events-none"
          style={{
            left: `${Math.min(tooltipPos.x + 10, width - 150)}px`,
            top: `${Math.min(tooltipPos.y - 10, height - 80)}px`,
          }}
        >
          <p className="text-xs font-semibold text-wl-text-primary mb-1">
            {tooltipData.time}
          </p>
          <p
            className={cn(
              "text-sm font-bold",
              tooltipData.isViolation
                ? "text-wl-danger-400"
                : "text-wl-success-400",
            )}
          >
            {tooltipData.speed} km/h
            {tooltipData.isViolation && (
              <span className="text-xs font-medium ml-2">
                +{tooltipData.speed - speedLimit} km/h over limit
              </span>
            )}
          </p>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="mt-4 flex gap-6 px-4 text-xs">
          <div className="flex items-center gap-2 text-wl-text-secondary">
            <span className="w-3 h-0.5 rounded-full bg-wl-primary-400" />
            Actual Speed
          </div>
          <div className="flex items-center gap-2 text-wl-text-secondary">
            <span
              className="w-3 h-0.5 rounded-full"
              style={{ borderTop: "2px dashed var(--wl-warning-400)" }}
            />
            Speed Limit
          </div>
          {showViolations && (
            <div className="flex items-center gap-2 text-wl-text-secondary">
              <span className="w-3 h-0.5 rounded-full bg-wl-danger-400" />
              Violation
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
