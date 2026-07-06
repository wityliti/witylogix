"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui";
import type { RevenueDataPoint } from "./types";

interface RevenueChartProps {
  data: RevenueDataPoint[];
  height?: number;
  showLegend?: boolean;
  className?: string;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function RevenueChart({
  data,
  height = 350,
  showLegend = true,
  className,
}: RevenueChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipData, setTooltipData] = useState<RevenueDataPoint | null>(null);

  // Responsive width
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

  const padding = { top: 24, right: 24, bottom: 60, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.invoiced, d.collected, d.outstanding)),
  );
  const yScale = chartHeight / maxValue;
  const xScale = chartWidth / (data.length - 1 || 1);

  const yAxisSteps = 5;
  const yAxisInterval = Math.ceil(maxValue / yAxisSteps / 10000) * 10000;

  const handleMouseEnter = useCallback(
    (index: number, event: React.MouseEvent<SVGRectElement>) => {
      setHoveredIndex(index);
      const rect = event.currentTarget.getBoundingClientRect();
      const parentRect = containerRef.current?.getBoundingClientRect();
      if (parentRect) {
        setTooltipPos({
          x: rect.left - parentRect.left + rect.width / 2,
          y: rect.top - parentRect.top,
        });
      }
      setTooltipData(data[index]);
    },
    [data],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
    setTooltipData(null);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("w-full relative", className)}
      style={{ height: height + 40 }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="relative"
      >
        {/* Grid lines */}
        {Array.from({ length: yAxisSteps + 1 }).map((_, i) => {
          const y = padding.top + (chartHeight / yAxisSteps) * i;
          return (
            <line
              key={`grid-${i}`}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="var(--wl-border-subtle)"
              strokeWidth="1"
              strokeDasharray="4"
              opacity="0.5"
            />
          );
        })}

        {/* Y-axis labels */}
        {Array.from({ length: yAxisSteps + 1 }).map((_, i) => {
          const value = (yAxisSteps - i) * yAxisInterval;
          const y = padding.top + (chartHeight / yAxisSteps) * i;
          return (
            <text
              key={`y-label-${i}`}
              x={padding.left - 12}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-wl-text-tertiary text-xs"
            >
              {formatCurrency(value)}
            </text>
          );
        })}

        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="var(--wl-border-default)"
          strokeWidth="2"
        />

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="var(--wl-border-default)"
          strokeWidth="2"
        />

        {/* Grouped bars */}
        {data.map((point, index) => {
          const x = padding.left + index * xScale;
          const barGroupWidth = (chartWidth / data.length) * 0.8;
          const barWidth = barGroupWidth / 3;
          const barSpacing = (barGroupWidth - barWidth * 3) / 2;

          // Invoiced bar
          const invoicedHeight = point.invoiced * yScale;
          const invoicedY = height - padding.bottom - invoicedHeight;

          // Collected bar
          const collectedHeight = point.collected * yScale;
          const collectedY = height - padding.bottom - collectedHeight;

          // Outstanding bar
          const outstandingHeight = point.outstanding * yScale;
          const outstandingY = height - padding.bottom - outstandingHeight;

          return (
            <g key={`bar-group-${index}`}>
              {/* Invoiced */}
              <g>
                <rect
                  x={x - barGroupWidth / 2 + barSpacing}
                  y={invoicedY}
                  width={barWidth}
                  height={invoicedHeight}
                  fill="var(--wl-primary-500)"
                  opacity={hoveredIndex === index ? 1 : 0.8}
                  className="transition-opacity duration-fast cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnter(index, e)}
                  onMouseLeave={handleMouseLeave}
                />
              </g>

              {/* Collected */}
              <g>
                <rect
                  x={x - barGroupWidth / 2 + barSpacing + barWidth + barSpacing}
                  y={collectedY}
                  width={barWidth}
                  height={collectedHeight}
                  fill="var(--wl-success-500)"
                  opacity={hoveredIndex === index ? 1 : 0.8}
                  className="transition-opacity duration-fast cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnter(index, e)}
                  onMouseLeave={handleMouseLeave}
                />
              </g>

              {/* Outstanding */}
              <g>
                <rect
                  x={
                    x -
                    barGroupWidth / 2 +
                    barSpacing +
                    barWidth * 2 +
                    barSpacing * 2
                  }
                  y={outstandingY}
                  width={barWidth}
                  height={outstandingHeight}
                  fill="var(--wl-warning-500)"
                  opacity={hoveredIndex === index ? 1 : 0.8}
                  className="transition-opacity duration-fast cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnter(index, e)}
                  onMouseLeave={handleMouseLeave}
                />
              </g>

              {/* X-axis label */}
              <text
                x={x}
                y={height - padding.bottom + 24}
                textAnchor="middle"
                dominantBaseline="start"
                className="fill-wl-text-secondary text-sm"
              >
                {point.month}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltipData && (
        <div
          className="absolute pointer-events-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="relative -translate-x-1/2 -translate-y-full -mb-3">
            <div className="bg-wl-bg-elevated border border-wl-border-default rounded-lg px-3 py-2 shadow-lg">
              <p className="text-xs font-semibold text-wl-text-primary mb-1">
                {tooltipData.month}
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: "var(--wl-primary-500)" }}
                  />
                  <span className="text-wl-text-secondary">
                    Invoiced: {formatCurrency(tooltipData.invoiced)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: "var(--wl-success-500)" }}
                  />
                  <span className="text-wl-text-secondary">
                    Collected: {formatCurrency(tooltipData.collected)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: "var(--wl-warning-500)" }}
                  />
                  <span className="text-wl-text-secondary">
                    Outstanding: {formatCurrency(tooltipData.outstanding)}
                  </span>
                </div>
              </div>
            </div>
            <div
              className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45"
              style={{ backgroundColor: "var(--wl-bg-elevated)" }}
            />
          </div>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-6 px-4">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: "var(--wl-primary-500)" }}
            />
            <span className="text-xs text-wl-text-secondary">Invoiced</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: "var(--wl-success-500)" }}
            />
            <span className="text-xs text-wl-text-secondary">Collected</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: "var(--wl-warning-500)" }}
            />
            <span className="text-xs text-wl-text-secondary">Outstanding</span>
          </div>
        </div>
      )}
    </div>
  );
}
