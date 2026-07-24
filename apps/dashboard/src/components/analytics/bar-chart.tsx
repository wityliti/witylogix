"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

interface BarChartSeries {
  name: string;
  data: number[];
  color?: string;
}

interface BarChartProps {
  data: { label: string }[];
  series: BarChartSeries[];
  mode?: "grouped" | "stacked";
  orientation?: "vertical" | "horizontal";
  height?: number;
  showLegend?: boolean;
  animate?: boolean;
}

/**
 * SVG-based bar chart with grouped and stacked modes
 * Features: multiple series, animations, responsive, tooltips
 */
export function BarChart({
  data,
  series,
  mode = "grouped",
  orientation = "vertical",
  height = 300,
  showLegend = true,
  animate = true,
}: BarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const [tooltipData, setTooltipData] = useState<any>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
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

  const padding =
    orientation === "vertical"
      ? { top: 20, right: 20, bottom: 50, left: 60 }
      : { top: 20, right: 60, bottom: 20, left: 100 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate max value for Y scale
  const allValues =
    mode === "stacked"
      ? data.map((_, i) => series.reduce((sum, s) => sum + (s.data[i] || 0), 0))
      : series.flatMap((s) => s.data);
  const maxValue = Math.max(...allValues, 100);

  // Default colors
  const defaultColors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ];

  const chartSeries = series.map((s, i) => ({
    ...s,
    color: s.color || defaultColors[i % defaultColors.length],
  }));

  // Bar dimensions
  const categoryWidth = chartWidth / data.length;
  const barWidth =
    mode === "grouped"
      ? categoryWidth / (chartSeries.length + 1)
      : categoryWidth * 0.6;

  const handleBarMouseEnter = useCallback(
    (dataIndex: number, seriesIndex: number, event: React.MouseEvent) => {
      const value = chartSeries[seriesIndex].data[dataIndex];
      const stacked =
        mode === "stacked"
          ? series.reduce(
              (sum, s, i) =>
                sum + (i < seriesIndex ? s.data[dataIndex] || 0 : 0),
              0,
            )
          : 0;

      setTooltipData({
        label: data[dataIndex].label,
        series: chartSeries[seriesIndex].name,
        value,
        stacked,
      });
      setTooltipPos({ x: event.clientX, y: event.clientY });
      setTooltipVisible(true);
      setHoveredBar(`${seriesIndex}-${dataIndex}`);
    },
    [chartSeries, data, mode, series],
  );

  const handleBarMouseLeave = () => {
    setTooltipVisible(false);
    setHoveredBar(null);
  };

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height: `${height}px` }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="bg-transparent"
      >
        {/* Axes */}
        {orientation === "vertical" ? (
          <>
            {/* Y-axis */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={height - padding.bottom}
              stroke="var(--wl-border-default)"
              strokeWidth={1}
            />
            {/* X-axis */}
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
              const value = (i / 4) * maxValue;
              const y = height - padding.bottom - (i / 4) * chartHeight;
              return (
                <g key={`y-label-${i}`}>
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="12"
                    fill="var(--wl-text-tertiary)"
                  >
                    {Math.round(value)}
                  </text>
                </g>
              );
            })}
            {/* X-axis labels */}
            {data.map((point, i) => {
              const x = padding.left + categoryWidth * (i + 0.5);
              return (
                <g key={`x-label-${i}`}>
                  <text
                    x={x}
                    y={height - padding.bottom + 20}
                    textAnchor="middle"
                    fontSize="12"
                    fill="var(--wl-text-tertiary)"
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}
          </>
        ) : (
          <>
            {/* X-axis (horizontal orientation) */}
            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              stroke="var(--wl-border-default)"
              strokeWidth={1}
            />
            {/* Y-axis */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={height - padding.bottom}
              stroke="var(--wl-border-default)"
              strokeWidth={1}
            />
            {/* X-axis labels (values) */}
            {Array.from({ length: 5 }).map((_, i) => {
              const value = (i / 4) * maxValue;
              const x = padding.left + (i / 4) * chartWidth;
              return (
                <g key={`x-label-value-${i}`}>
                  <text
                    x={x}
                    y={height - padding.bottom + 20}
                    textAnchor="middle"
                    fontSize="12"
                    fill="var(--wl-text-tertiary)"
                  >
                    {Math.round(value)}
                  </text>
                </g>
              );
            })}
            {/* Y-axis labels (categories) */}
            {data.map((point, i) => {
              const y = padding.top + categoryWidth * (i + 0.5);
              return (
                <g key={`y-label-cat-${i}`}>
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="12"
                    fill="var(--wl-text-tertiary)"
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}
          </>
        )}

        {/* Bars */}
        {data.map((point, dataIndex) => {
          if (orientation === "vertical") {
            // Vertical bars
            if (mode === "grouped") {
              return chartSeries.map((s, seriesIndex) => {
                const value = s.data[dataIndex] || 0;
                const barHeight = (value / maxValue) * chartHeight;
                const x =
                  padding.left +
                  categoryWidth * (dataIndex + 0.1) +
                  barWidth * seriesIndex;
                const y = height - padding.bottom - barHeight;

                return (
                  <rect
                    key={`bar-${dataIndex}-${seriesIndex}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={s.color}
                    opacity={
                      hoveredBar === null ||
                      hoveredBar === `${seriesIndex}-${dataIndex}`
                        ? 1
                        : 0.4
                    }
                    onMouseEnter={(e) =>
                      handleBarMouseEnter(dataIndex, seriesIndex, e)
                    }
                    onMouseLeave={handleBarMouseLeave}
                    style={{
                      cursor: "pointer",
                      animation: animate
                        ? `barGrowth 0.5s ease-out ${seriesIndex * 50}ms backwards`
                        : "none",
                      transition: "opacity 200ms",
                    }}
                  />
                );
              });
            } else {
              // Stacked bars
              let stackedY = height - padding.bottom;
              return chartSeries.map((s, seriesIndex) => {
                const value = s.data[dataIndex] || 0;
                const barHeight = (value / maxValue) * chartHeight;
                const y = stackedY - barHeight;
                const x = padding.left + categoryWidth * (dataIndex + 0.2);
                stackedY = y;

                return (
                  <rect
                    key={`bar-stacked-${dataIndex}-${seriesIndex}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={s.color}
                    opacity={
                      hoveredBar === null ||
                      hoveredBar === `${seriesIndex}-${dataIndex}`
                        ? 1
                        : 0.4
                    }
                    onMouseEnter={(e) =>
                      handleBarMouseEnter(dataIndex, seriesIndex, e)
                    }
                    onMouseLeave={handleBarMouseLeave}
                    style={{
                      cursor: "pointer",
                      animation: animate
                        ? `barGrowth 0.5s ease-out ${seriesIndex * 50}ms backwards`
                        : "none",
                      transition: "opacity 200ms",
                    }}
                  />
                );
              });
            }
          } else {
            // Horizontal bars
            if (mode === "grouped") {
              return chartSeries.map((s, seriesIndex) => {
                const value = s.data[dataIndex] || 0;
                const barLength = (value / maxValue) * chartWidth;
                const y =
                  padding.top +
                  categoryWidth * (dataIndex + 0.1) +
                  barWidth * seriesIndex;
                const x = padding.left;

                return (
                  <rect
                    key={`bar-h-${dataIndex}-${seriesIndex}`}
                    x={x}
                    y={y}
                    width={barLength}
                    height={barWidth}
                    fill={s.color}
                    opacity={
                      hoveredBar === null ||
                      hoveredBar === `${seriesIndex}-${dataIndex}`
                        ? 1
                        : 0.4
                    }
                    onMouseEnter={(e) =>
                      handleBarMouseEnter(dataIndex, seriesIndex, e)
                    }
                    onMouseLeave={handleBarMouseLeave}
                    style={{
                      cursor: "pointer",
                      animation: animate
                        ? `barGrowthH 0.5s ease-out ${seriesIndex * 50}ms backwards`
                        : "none",
                      transition: "opacity 200ms",
                    }}
                  />
                );
              });
            } else {
              // Stacked horizontal
              let stackedX = padding.left;
              return chartSeries.map((s, seriesIndex) => {
                const value = s.data[dataIndex] || 0;
                const barLength = (value / maxValue) * chartWidth;
                const x = stackedX;
                const y = padding.top + categoryWidth * (dataIndex + 0.2);
                stackedX = x + barLength;

                return (
                  <rect
                    key={`bar-stacked-h-${dataIndex}-${seriesIndex}`}
                    x={x}
                    y={y}
                    width={barLength}
                    height={barWidth}
                    fill={s.color}
                    opacity={
                      hoveredBar === null ||
                      hoveredBar === `${seriesIndex}-${dataIndex}`
                        ? 1
                        : 0.4
                    }
                    onMouseEnter={(e) =>
                      handleBarMouseEnter(dataIndex, seriesIndex, e)
                    }
                    onMouseLeave={handleBarMouseLeave}
                    style={{
                      cursor: "pointer",
                      animation: animate
                        ? `barGrowthH 0.5s ease-out ${seriesIndex * 50}ms backwards`
                        : "none",
                      transition: "opacity 200ms",
                    }}
                  />
                );
              });
            }
          }
        })}
      </svg>

      {/* Tooltip */}
      <ChartTooltip
        visible={tooltipVisible}
        x={tooltipPos.x}
        y={tooltipPos.y}
        data={tooltipData}
        renderContent={(data) => (
          <div className="space-y-1">
            <p className="font-semibold text-wl-text-primary">{data?.label}</p>
            <p className="text-wl-text-secondary text-xs">
              {data?.series}: {data?.value}
            </p>
          </div>
        )}
      />

      {/* Legend */}
      {showLegend && (
        <div className="mt-3 flex flex-wrap gap-3 px-4">
          {chartSeries.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-2 text-xs text-wl-text-secondary"
            >
              <span
                className="w-2 h-2 flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes barGrowth {
          from {
            height: 0;
            transform: translateY(0);
          }
          to {
            height: var(--bar-height);
            transform: translateY(0);
          }
        }
        @keyframes barGrowthH {
          from {
            width: 0;
          }
          to {
            width: var(--bar-width);
          }
        }
      `}</style>
    </div>
  );
}
