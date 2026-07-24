"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CapacityData, CapacityBarChartProps } from "./types";

/**
 * Capacity comparison bar chart
 * Displays per-zone bars comparing current capacity vs recommended capacity
 * Color coded: green (adequate), yellow (tight), red (insufficient)
 */
export function CapacityBarChart({
  data,
  onBarClick,
  className,
}: CapacityBarChartProps) {
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Calculate dimensions
  const { maxCapacity, barWidth, barHeight, chartWidth, chartHeight, padding } =
    useMemo(() => {
      const capacities = data.flatMap((d) => [
        d.currentCapacity,
        d.recommendedCapacity,
      ]);
      const max = Math.max(...capacities);

      const padding = { top: 30, right: 40, bottom: 60, left: 60 };
      const barWidth = Math.max(40, 600 / data.length);
      const chartHeight = Math.max(
        300,
        data.length * 50 + padding.top + padding.bottom,
      );
      const chartWidth =
        data.length * (barWidth + 20) + padding.left + padding.right;

      return {
        maxCapacity: max,
        barWidth,
        barHeight: chartHeight - padding.top - padding.bottom,
        chartWidth,
        chartHeight,
        padding,
      };
    }, [data]);

  const scaleY = useCallback(
    (value: number): number => {
      const normalized = value / maxCapacity;
      return barHeight - normalized * barHeight;
    },
    [maxCapacity, barHeight],
  );

  const getStatusColor = (utilizationRate: number): string => {
    if (utilizationRate <= 0.7) return "rgb(34, 197, 94)"; // Green - adequate
    if (utilizationRate <= 0.9) return "rgb(234, 179, 8)"; // Yellow - tight
    return "rgb(239, 68, 68)"; // Red - insufficient
  };

  const getGapPercentage = (current: number, recommended: number): number => {
    if (recommended === 0) return 0;
    return ((recommended - current) / recommended) * 100;
  };

  const handleBarHover = useCallback(
    (zone: CapacityData | null, event?: React.MouseEvent) => {
      if (zone) {
        setHoveredZoneId(zone.zoneId);
        if (event) {
          setTooltipPos({ x: event.clientX, y: event.clientY });
        }
      } else {
        setHoveredZoneId(null);
      }
    },
    [],
  );

  const handleBarClick = useCallback(
    (zone: CapacityData) => {
      onBarClick?.(zone.zoneId);
    },
    [onBarClick],
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col gap-4">
        {/* Chart */}
        <div className="overflow-x-auto border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-4">
          <svg
            width={chartWidth}
            height={chartHeight}
            className="bg-transparent"
          >
            {/* Horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = padding.top + (1 - ratio) * barHeight;
              return (
                <g key={`grid-${i}`}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={chartWidth - padding.right}
                    y2={y}
                    stroke="var(--wl-border-subtle)"
                    strokeWidth="1"
                    opacity="0.3"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="var(--wl-text-tertiary)"
                  >
                    {Math.round(ratio * maxCapacity)}
                  </text>
                </g>
              );
            })}

            {/* Bars and labels */}
            {data.map((zone, idx) => {
              const xOffset =
                padding.left + idx * (barWidth + 20) + (barWidth + 20) / 2;
              const isHovered = hoveredZoneId === zone.zoneId;

              // Current capacity bar
              const currentHeight = scaleY(zone.currentCapacity);
              const currentY = padding.top + currentHeight;

              // Recommended capacity bar
              const recommendedHeight = scaleY(zone.recommendedCapacity);
              const recommendedY = padding.top + recommendedHeight;

              const statusColor = getStatusColor(zone.utilizationRate);
              const gapPct = getGapPercentage(
                zone.currentCapacity,
                zone.recommendedCapacity,
              );

              return (
                <g
                  key={zone.zoneId}
                  onMouseEnter={(e) => handleBarHover(zone, e)}
                  onMouseLeave={() => handleBarHover(null)}
                  onClick={() => handleBarClick(zone)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Current capacity bar */}
                  <rect
                    x={xOffset - barWidth / 3 - 2}
                    y={currentY}
                    width={barWidth / 3}
                    height={barHeight - currentHeight}
                    fill={statusColor}
                    opacity={isHovered ? 0.9 : 0.7}
                    rx="2"
                    style={{ transition: "all 0.2s ease" }}
                  />

                  {/* Recommended capacity bar (light outline) */}
                  <rect
                    x={xOffset + 2}
                    y={recommendedY}
                    width={barWidth / 3}
                    height={barHeight - recommendedHeight}
                    fill={statusColor}
                    opacity="0.3"
                    rx="2"
                    stroke={statusColor}
                    strokeWidth="1"
                    strokeDasharray="3,3"
                  />

                  {/* Gap indicator line */}
                  <line
                    x1={xOffset - barWidth / 6}
                    y1={recommendedY}
                    x2={xOffset + barWidth / 6}
                    y2={recommendedY}
                    stroke="var(--wl-border-default)"
                    strokeWidth="2"
                    strokeDasharray="2,2"
                    opacity="0.6"
                  />

                  {/* Gap percentage label */}
                  {gapPct > 0 && (
                    <text
                      x={xOffset}
                      y={recommendedY - 8}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill="var(--wl-text-secondary)"
                    >
                      +{Math.round(gapPct)}%
                    </text>
                  )}

                  {/* Zone name label */}
                  <text
                    x={xOffset}
                    y={chartHeight - padding.bottom + 20}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="500"
                    fill="var(--wl-text-secondary)"
                    style={{ maxWidth: barWidth }}
                  >
                    {zone.zoneName.length > 15
                      ? `${zone.zoneName.substring(0, 12)}...`
                      : zone.zoneName}
                  </text>

                  {/* Utilization percentage label */}
                  <text
                    x={xOffset}
                    y={chartHeight - padding.bottom + 35}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--wl-text-tertiary)"
                  >
                    {Math.round(zone.utilizationRate * 100)}%
                  </text>
                </g>
              );
            })}

            {/* Y-axis label */}
            <text
              x={15}
              y={padding.top - 10}
              fontSize="11"
              fontWeight="600"
              fill="var(--wl-text-tertiary)"
              textAnchor="start"
            >
              Capacity
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 px-4 py-3 border border-wl-border-subtle rounded-lg bg-wl-bg-surface">
          <div className="flex items-center gap-4">
            {/* Current capacity */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded" />
              <span className="text-xs text-wl-text-tertiary">
                Current Capacity
              </span>
            </div>

            {/* Recommended capacity */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500/30 rounded border border-green-500 border-dashed" />
              <span className="text-xs text-wl-text-tertiary">Recommended</span>
            </div>

            {/* Status indicators */}
            <div className="ml-4 flex items-center gap-4 pl-4 border-l border-wl-border-subtle">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-wl-text-tertiary">Adequate</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs text-wl-text-tertiary">Tight</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs text-wl-text-tertiary">
                  Insufficient
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {hoveredZoneId && (
          <div
            className="fixed bg-wl-bg-elevated border border-wl-border-default rounded-md shadow-lg p-3 z-50 pointer-events-none"
            style={{
              left: `${tooltipPos.x + 10}px`,
              top: `${tooltipPos.y + 10}px`,
              maxWidth: "240px",
            }}
          >
            {data.map((zone) => {
              if (zone.zoneId !== hoveredZoneId) return null;
              const gapPct = getGapPercentage(
                zone.currentCapacity,
                zone.recommendedCapacity,
              );
              return (
                <div key={zone.zoneId}>
                  <p className="text-sm font-semibold text-wl-text-primary">
                    {zone.zoneName}
                  </p>
                  <p className="text-xs text-wl-text-tertiary mt-1">
                    Current: {Math.round(zone.currentCapacity)} units
                  </p>
                  <p className="text-xs text-wl-text-tertiary">
                    Recommended: {Math.round(zone.recommendedCapacity)} units
                  </p>
                  <p className="text-xs text-wl-text-tertiary">
                    Utilization: {Math.round(zone.utilizationRate * 100)}%
                  </p>
                  {gapPct > 0 && (
                    <p className="text-xs font-medium text-yellow-400 mt-1">
                      Gap: +{Math.round(gapPct)}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
