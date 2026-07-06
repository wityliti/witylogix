"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ZoneHeatmapData, ZoneHeatmapProps } from "./types";

/**
 * Zone demand heatmap component
 * Displays zones as grid with color intensity based on predicted demand
 * Features: color gradient (green → yellow → red), hover tooltips, click selection
 */
export function ZoneHeatmap({
  data,
  onZoneSelect,
  cellSize = 120,
  showLegend = true,
  className,
}: ZoneHeatmapProps) {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipData, setTooltipData] = useState<ZoneHeatmapData | null>(null);

  // Calculate grid dimensions and min/max demand
  const { maxDemand, gridCols, zonesByPosition } = useMemo(() => {
    const demands = data.map((z) => z.predictedDemand);
    const max = Math.max(...demands);
    const count = data.length;
    const cols = Math.ceil(Math.sqrt(count));

    const posMap = new Map<string, { row: number; col: number }>();
    data.forEach((zone, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      posMap.set(zone.zone.id, { row, col });
    });

    return {
      maxDemand: max,
      gridCols: cols,
      zonesByPosition: posMap,
    };
  }, [data]);

  // Get color based on demand intensity
  const getDemandColor = useCallback(
    (demand: number): string => {
      const ratio = Math.min(demand / maxDemand, 1);

      if (ratio < 0.33) {
        // Green to yellow
        return `rgb(34, 197, 94)`;
      } else if (ratio < 0.66) {
        // Yellow
        const intensity = (ratio - 0.33) / 0.33;
        return `rgb(234, 179, 8)`;
      } else {
        // Yellow to red
        return `rgb(239, 68, 68)`;
      }
    },
    [maxDemand],
  );

  const getBoundingColor = (zoneId: string): string => {
    if (hoveredZoneId === zoneId) return "var(--wl-primary-500)";
    if (selectedZoneId === zoneId) return "var(--wl-primary-600)";
    return "var(--wl-border-subtle)";
  };

  const handleZoneClick = useCallback(
    (zone: ZoneHeatmapData) => {
      setSelectedZoneId(zone.zone.id);
      onZoneSelect?.(zone.zone.id);
    },
    [onZoneSelect],
  );

  const handleZoneHover = useCallback(
    (zone: ZoneHeatmapData | null, event?: React.MouseEvent) => {
      if (zone) {
        setHoveredZoneId(zone.zone.id);
        setTooltipData(zone);
        if (event) {
          setTooltipPos({ x: event.clientX, y: event.clientY });
        }
      } else {
        setHoveredZoneId(null);
        setTooltipData(null);
      }
    },
    [],
  );

  const maxRows = Math.ceil(data.length / gridCols);
  const svgWidth = gridCols * cellSize + 40;
  const svgHeight = maxRows * cellSize + 60;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col gap-4">
        {/* Heatmap */}
        <div className="overflow-auto border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-4">
          <svg width={svgWidth} height={svgHeight} className="bg-transparent">
            {/* Grid cells */}
            {data.map((zone) => {
              const pos = zonesByPosition.get(zone.zone.id);
              if (!pos) return null;

              const x = 20 + pos.col * cellSize;
              const y = 20 + pos.row * cellSize;
              const demandColor = getDemandColor(zone.predictedDemand);
              const borderColor = getBoundingColor(zone.zone.id);
              const isSelected = selectedZoneId === zone.zone.id;
              const isHovered = hoveredZoneId === zone.zone.id;

              return (
                <g
                  key={zone.zone.id}
                  onClick={() => handleZoneClick(zone)}
                  onMouseEnter={(e) => handleZoneHover(zone, e)}
                  onMouseLeave={() => handleZoneHover(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Main cell */}
                  <rect
                    x={x}
                    y={y}
                    width={cellSize - 8}
                    height={cellSize - 8}
                    fill={demandColor}
                    stroke={borderColor}
                    strokeWidth={isSelected ? 3 : 2}
                    rx={4}
                    opacity={isHovered ? 0.9 : 0.7}
                    style={{ transition: "all 0.2s ease" }}
                  />

                  {/* Zone name */}
                  <text
                    x={x + (cellSize - 8) / 2}
                    y={y + (cellSize - 8) / 2 - 8}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="600"
                    fill="var(--wl-text-inverse)"
                    pointerEvents="none"
                  >
                    {zone.zone.name}
                  </text>

                  {/* Demand value */}
                  <text
                    x={x + (cellSize - 8) / 2}
                    y={y + (cellSize - 8) / 2 + 12}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="700"
                    fill="var(--wl-text-inverse)"
                    pointerEvents="none"
                  >
                    {Math.round(zone.predictedDemand)} units
                  </text>

                  {/* Confidence percentage */}
                  <text
                    x={x + (cellSize - 8) / 2}
                    y={y + (cellSize - 8) / 2 + 28}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--wl-text-inverse)"
                    opacity="0.8"
                    pointerEvents="none"
                  >
                    {Math.round(zone.confidence * 100)}% confidence
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="flex items-center gap-6 px-4 py-3 border border-wl-border-subtle rounded-lg bg-wl-bg-surface">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide">
                Demand Intensity
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Low */}
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: "rgb(34, 197, 94)" }}
                />
                <span className="text-xs text-wl-text-tertiary">Low</span>
              </div>

              {/* Medium */}
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: "rgb(234, 179, 8)" }}
                />
                <span className="text-xs text-wl-text-tertiary">Medium</span>
              </div>

              {/* High */}
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: "rgb(239, 68, 68)" }}
                />
                <span className="text-xs text-wl-text-tertiary">High</span>
              </div>
            </div>
          </div>
        )}

        {/* Tooltip */}
        {tooltipData && hoveredZoneId && (
          <div
            className="fixed bg-wl-bg-elevated border border-wl-border-default rounded-md shadow-lg p-3 z-50 pointer-events-none"
            style={{
              left: `${tooltipPos.x + 10}px`,
              top: `${tooltipPos.y + 10}px`,
              maxWidth: "200px",
            }}
          >
            <p className="text-sm font-semibold text-wl-text-primary">
              {tooltipData.zone.name}
            </p>
            <p className="text-xs text-wl-text-tertiary mt-1">
              Predicted Volume: {Math.round(tooltipData.predictedDemand)} units
            </p>
            <p className="text-xs text-wl-text-tertiary">
              Confidence: {Math.round(tooltipData.confidence * 100)}%
            </p>
            {tooltipData.historicalAverage && (
              <p className="text-xs text-wl-text-tertiary">
                Historical Avg: {Math.round(tooltipData.historicalAverage)}{" "}
                units
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
