"use client";

import {
  useEffect,
  useRef,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

interface LineChartSeries {
  name: string;
  data: number[];
  color?: string;
}

interface LineChartProps {
  data: { label: string }[];
  series: LineChartSeries[];
  xLabel?: string;
  yLabel?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  animate?: boolean;
  smooth?: boolean;
  showArea?: boolean;
}

/**
 * SVG-based line chart with multiple series support
 * Features: legend, grid, tooltips, responsive, animations
 */
export function LineChart({
  data,
  series,
  xLabel,
  yLabel,
  height = 300,
  showGrid = true,
  showLegend = true,
  animate = true,
  smooth = true,
  showArea = false,
}: LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const [tooltipData, setTooltipData] = useState<any>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
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

  // Calculate dimensions
  const padding = { top: 20, right: 20, bottom: 50, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find min and max Y values
  const allValues = series.flatMap((s) => s.data);
  const maxValue = Math.max(...allValues, 100);
  const minValue = Math.min(...allValues, 0);
  const yRange = maxValue - minValue || 1;

  // Cubic bezier curve interpolation for smooth lines
  const getControlPoint = (p1: number, p2: number, p3: number) => {
    return (p2 - p1) / 2;
  };

  const generatePath = (points: Array<[number, number]>, isClosed = false) => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;

    if (!smooth) {
      return (
        points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ") +
        (isClosed ? " Z" : "")
      );
    }

    let path = `M ${points[0][0]} ${points[0][1]}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || points[i + 1];

      const cp1x = p1[0] + getControlPoint(p0[0], p1[0], p2[0]);
      const cp1y = p1[1] + getControlPoint(p0[1], p1[1], p2[1]);
      const cp2x = p2[0] - getControlPoint(p1[0], p2[0], p3[0]);
      const cp2y = p2[1] - getControlPoint(p1[1], p2[1], p3[1]);

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
    }

    return isClosed ? path + " Z" : path;
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const relativeX = x - padding.left;

      if (relativeX < 0 || relativeX > chartWidth) {
        setTooltipVisible(false);
        return;
      }

      // Find nearest x-axis point
      const pointIndex = Math.round((relativeX / chartWidth) * (data.length - 1));
      if (pointIndex < 0 || pointIndex >= data.length) {
        setTooltipVisible(false);
        return;
      }

      // Collect values from all series at this index
      const seriesValues = series.map((s) => ({
        name: s.name,
        value: s.data[pointIndex],
        color: s.color || "#3b82f6",
      }));

      setTooltipData({
        label: data[pointIndex].label,
        series: seriesValues,
      });
      setTooltipPos({ x: e.clientX, y: e.clientY });
      setTooltipVisible(true);
    },
    [data, series, chartWidth, padding.left]
  );

  const handleMouseLeave = () => {
    setTooltipVisible(false);
  };

  // Default colors for series
  const defaultColors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ];

  const getSeries = () =>
    series.map((s, i) => ({
      ...s,
      color: s.color || defaultColors[i % defaultColors.length],
    }));

  const chartSeries = getSeries();

  // Generate chart paths
  const chartPaths = chartSeries.map((s) => {
    const points: Array<[number, number]> = s.data.map((value, i) => [
      (i / (data.length - 1 || 1)) * chartWidth,
      chartHeight - ((value - minValue) / yRange) * chartHeight,
    ]);
    return { ...s, points };
  });

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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="bg-transparent"
      >
        {/* Grid lines */}
        {showGrid && (
          <>
            {/* Horizontal grid lines */}
            {Array.from({ length: 5 }).map((_, i) => {
              const y = padding.top + (i / 4) * chartHeight;
              return (
                <line
                  key={`grid-h-${i}`}
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="var(--wl-border-subtle)"
                  strokeWidth={1}
                  strokeDasharray="4"
                  opacity={0.5}
                />
              );
            })}
          </>
        )}

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
          const value = minValue + (i / 4) * yRange;
          const y = padding.top + (i / 4) * chartHeight;
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
          if (data.length > 10 && i % Math.ceil(data.length / 8) !== 0) {
            return null;
          }
          const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
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

        {/* Series area and line */}
        {chartPaths.map((path, i) => {
          const animationDuration = animate ? 0.6 : 0;
          return (
            <g key={`series-${i}`}>
              {/* Area under line */}
              {showArea && (
                <path
                  d={generatePath([...path.points, [chartWidth, chartHeight]], true)}
                  fill={path.color}
                  fillOpacity={0.1}
                  style={{
                    animation: animate
                      ? `fadeIn ${animationDuration}s ease-out`
                      : "none",
                  }}
                />
              )}
              {/* Line */}
              <path
                d={generatePath(path.points)}
                stroke={path.color}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: animate
                    ? `strokeAnimation ${animationDuration}s ease-out forwards`
                    : "none",
                  strokeDasharray: animate ? "1000" : "0",
                  strokeDashoffset: animate ? "1000" : "0",
                }}
              />
              {/* Data points */}
              {path.points.map((point, j) => (
                <circle
                  key={`point-${i}-${j}`}
                  cx={point[0] + padding.left}
                  cy={point[1] + padding.top}
                  r={2}
                  fill={path.color}
                  opacity={0.6}
                  style={{
                    animation: animate
                      ? `fadeIn ${animationDuration}s ease-out`
                      : "none",
                  }}
                />
              ))}
            </g>
          );
        })}

        {/* Tooltip crosshair */}
        {tooltipVisible && (
          <g>
            <line
              x1={tooltipPos.x - (svgRef.current?.getBoundingClientRect().left || 0)}
              y1={padding.top}
              x2={tooltipPos.x - (svgRef.current?.getBoundingClientRect().left || 0)}
              y2={height - padding.bottom}
              stroke="var(--wl-border-focus)"
              strokeWidth={1}
              strokeDasharray="4"
              opacity={0.5}
            />
          </g>
        )}
      </svg>

      {/* Tooltip */}
      <ChartTooltip
        visible={tooltipVisible}
        x={tooltipPos.x}
        y={tooltipPos.y}
        data={tooltipData}
        renderContent={(data) => (
          <div className="space-y-1">
            <p className="font-semibold text-wl-text-primary">
              {data?.label}
            </p>
            {data?.series?.map((item: any) => (
              <div key={item.name} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-wl-text-secondary text-xs">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
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
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes strokeAnimation {
          from {
            stroke-dashoffset: 1000;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
