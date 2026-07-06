"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface FuelDataPoint {
  date: string;
  consumption: number;
}

interface FuelSeriesData {
  name: string;
  color: string;
  data: FuelDataPoint[];
}

interface FuelConsumptionChartProps {
  series: FuelSeriesData[];
  range?: "7" | "14" | "30";
  showAverage?: boolean;
  height?: number;
  showLegend?: boolean;
  className?: string;
}

interface TooltipData {
  date: string;
  values: { name: string; consumption: number; color: string }[];
}

/**
 * Pure SVG area chart for fuel consumption over time
 * Features: multiple vehicles, average line, hover tooltip, gradient fills
 */
export function FuelConsumptionChart({
  series,
  range = "7",
  showAverage = true,
  height = 300,
  showLegend = true,
  className,
}: FuelConsumptionChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

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

  // Get all data points (assume all series have same dates)
  const allDates = series[0]?.data.map((d) => d.date) || [];
  const allValues = series.flatMap((s) => s.data.map((d) => d.consumption));
  const maxConsumption = Math.max(...allValues, 100);

  // Calculate average
  const averageConsumption = showAverage
    ? allValues.reduce((a, b) => a + b, 0) / allValues.length
    : 0;

  const xScale = (index: number) =>
    padding.left + (index / (allDates.length - 1 || 1)) * chartWidth;
  const yScale = (value: number) =>
    height - padding.bottom - (value / maxConsumption) * chartHeight;

  // Generate path for area
  const generatePath = (data: FuelDataPoint[]): string => {
    if (data.length === 0) return "";

    const points = data.map((d, i) => `${xScale(i)},${yScale(d.consumption)}`);
    const pathD = points.join(" L ");
    return `M ${pathD}`;
  };

  // Generate area path (closed)
  const generateAreaPath = (data: FuelDataPoint[]): string => {
    if (data.length === 0) return "";

    const points = data.map((d, i) => `${xScale(i)},${yScale(d.consumption)}`);
    const pathD = points.join(" L ");

    // Close the area
    const lastIndex = data.length - 1;
    const bottomRight = `${xScale(lastIndex)},${height - padding.bottom}`;
    const bottomLeft = `${xScale(0)},${height - padding.bottom}`;

    return `M ${pathD} L ${bottomRight} L ${bottomLeft} Z`;
  };

  const handlePointHover = useCallback(
    (dateIndex: number, event: React.MouseEvent) => {
      const date = allDates[dateIndex];
      const values = series.map((s) => ({
        name: s.name,
        consumption: s.data[dateIndex].consumption,
        color: s.color,
      }));

      setTooltipData({ date, values });
      setTooltipPos({ x: event.clientX, y: event.clientY });
      setTooltipVisible(true);
      setHoveredDate(date);
    },
    [allDates, series],
  );

  const handlePointLeave = () => {
    setTooltipVisible(false);
    setHoveredDate(null);
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
        <defs>
          {/* Gradients for area fills */}
          {series.map((s, i) => (
            <linearGradient
              key={`gradient-${i}`}
              id={`gradient-${i}`}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

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

        {/* Y-axis labels */}
        {Array.from({ length: 5 }).map((_, i) => {
          const value = (i / 4) * maxConsumption;
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
              {Math.round(value)}L
            </text>
          );
        })}

        {/* X-axis labels */}
        {allDates.map((date, i) => {
          if (allDates.length > 7 && i % Math.ceil(allDates.length / 6) !== 0) {
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
              {formatDate(date)}
            </text>
          );
        })}

        {/* Average line */}
        {showAverage && (
          <>
            <line
              x1={padding.left}
              y1={yScale(averageConsumption)}
              x2={width - padding.right}
              y2={yScale(averageConsumption)}
              stroke="var(--wl-warning-400)"
              strokeWidth={2}
              strokeDasharray="4"
              opacity="0.6"
            />
          </>
        )}

        {/* Area fills */}
        {series.map((s, seriesIndex) => (
          <path
            key={`area-${seriesIndex}`}
            d={generateAreaPath(s.data)}
            fill={`url(#gradient-${seriesIndex})`}
            opacity="0.5"
          />
        ))}

        {/* Lines */}
        {series.map((s, seriesIndex) => (
          <path
            key={`line-${seriesIndex}`}
            d={generatePath(s.data)}
            stroke={s.color}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Interactive points */}
        {allDates.map((date, dateIndex) => (
          <g key={`point-group-${dateIndex}`}>
            {series.map((s, seriesIndex) => {
              const x = xScale(dateIndex);
              const y = yScale(s.data[dateIndex].consumption);
              const isHovered = hoveredDate === date;

              return (
                <circle
                  key={`point-${seriesIndex}-${dateIndex}`}
                  cx={x}
                  cy={y}
                  r={isHovered ? 5 : 3}
                  fill={s.color}
                  opacity={isHovered ? 1 : 0.7}
                  style={{
                    cursor: "pointer",
                    transition: "r 200ms, opacity 200ms",
                  }}
                  onMouseEnter={(e) => handlePointHover(dateIndex, e)}
                  onMouseLeave={handlePointLeave}
                />
              );
            })}

            {/* Invisible hover area */}
            <circle
              cx={xScale(dateIndex)}
              cy={height / 2}
              r={Math.max(chartWidth / allDates.length / 2, 20)}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => handlePointHover(dateIndex, e)}
              onMouseLeave={handlePointLeave}
            />
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {tooltipVisible && tooltipData && (
        <div
          className="fixed bg-wl-bg-elevated border border-wl-border-default rounded-lg p-3 shadow-lg z-50 pointer-events-none"
          style={{
            left: `${Math.min(tooltipPos.x + 10, width - 200)}px`,
            top: `${Math.min(tooltipPos.y - 10, height - 100)}px`,
          }}
        >
          <p className="text-xs font-semibold text-wl-text-primary mb-2">
            {tooltipData.date}
          </p>
          <div className="space-y-1">
            {tooltipData.values.map((v) => (
              <div key={v.name} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: v.color }}
                />
                <span className="text-wl-text-secondary">{v.name}:</span>
                <span className="font-semibold text-wl-text-primary">
                  {v.consumption}L
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="mt-4 flex flex-wrap gap-4 px-4">
          {series.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-2 text-xs text-wl-text-secondary"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </div>
          ))}
          {showAverage && (
            <div className="flex items-center gap-2 text-xs text-wl-text-secondary">
              <span
                className="w-3 h-1 flex-shrink-0 bg-wl-warning-400"
                style={{ borderRadius: "1px" }}
              />
              Average
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
