"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

interface HeatmapProps {
  data: number[][];
  rowLabels?: string[];
  colLabels?: string[];
  cellSize?: number;
  colorPalette?: string[];
  showLegend?: boolean;
}

/**
 * SVG-based heatmap with gradient color scaling
 * Features: row/col labels, color gradient, tooltips
 */
export function Heatmap({
  data,
  rowLabels = [],
  colLabels = [],
  cellSize = 30,
  colorPalette = ["#0f172a", "#1e293b", "#334155", "#64748b", "#cbd5e1"],
  showLegend = true,
}: HeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);
  const [tooltipData, setTooltipData] = useState<any>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Flatten data and find min/max
  const { min, max, flatData } = useMemo(() => {
    const flat = data.flat();
    return {
      min: Math.min(...flat),
      max: Math.max(...flat),
      flatData: flat,
    };
  }, [data]);

  const range = max - min || 1;

  // Get color for value
  const getColor = (value: number): string => {
    if (value === null || value === undefined) {
      return colorPalette[0];
    }
    const normalized = (value - min) / range;
    const index = Math.floor(normalized * (colorPalette.length - 1));
    return colorPalette[Math.max(0, Math.min(colorPalette.length - 1, index))];
  };

  const handleCellMouseEnter = useCallback(
    (row: number, col: number, value: number, event: React.MouseEvent) => {
      setHoveredCell([row, col]);
      setTooltipData({
        row: rowLabels[row] || `Row ${row}`,
        col: colLabels[col] || `Col ${col}`,
        value: value.toFixed(2),
      });
      setTooltipPos({ x: event.clientX, y: event.clientY });
      setTooltipVisible(true);
    },
    [rowLabels, colLabels],
  );

  const handleCellMouseLeave = () => {
    setHoveredCell(null);
    setTooltipVisible(false);
  };

  const rows = data.length;
  const cols = data[0]?.length || 0;

  const labelWidth = Math.max(
    rowLabels.length > 0 ? Math.max(...rowLabels.map((l) => l.length)) * 7 : 0,
    40,
  );
  const labelHeight = colLabels.length > 0 ? 50 : 20;

  return (
    <div className="flex flex-col gap-4">
      {/* Heatmap */}
      <div className="overflow-auto">
        <svg
          width={labelWidth + cols * cellSize + 10}
          height={labelHeight + rows * cellSize + 10}
          className="bg-transparent"
        >
          {/* Row labels */}
          {rowLabels.map((label, i) => (
            <g key={`row-label-${i}`}>
              <text
                x={labelWidth - 5}
                y={labelHeight + i * cellSize + cellSize / 2 + 4}
                textAnchor="end"
                fontSize="12"
                fill="var(--wl-text-tertiary)"
                className="select-none"
              >
                {label}
              </text>
            </g>
          ))}

          {/* Column labels */}
          {colLabels.map((label, i) => (
            <g key={`col-label-${i}`}>
              <text
                x={labelWidth + i * cellSize + cellSize / 2}
                y={labelHeight - 10}
                textAnchor="middle"
                fontSize="12"
                fill="var(--wl-text-tertiary)"
                className="select-none"
              >
                {label}
              </text>
            </g>
          ))}

          {/* Cells */}
          {data.map((row, rowIndex) =>
            row.map((value, colIndex) => (
              <rect
                key={`cell-${rowIndex}-${colIndex}`}
                x={labelWidth + colIndex * cellSize}
                y={labelHeight + rowIndex * cellSize}
                width={cellSize}
                height={cellSize}
                fill={getColor(value)}
                stroke="var(--wl-border-subtle)"
                strokeWidth={1}
                opacity={
                  hoveredCell === null ||
                  (hoveredCell[0] === rowIndex && hoveredCell[1] === colIndex)
                    ? 1
                    : 0.6
                }
                onMouseEnter={(e) =>
                  handleCellMouseEnter(rowIndex, colIndex, value, e)
                }
                onMouseLeave={handleCellMouseLeave}
                style={{
                  cursor: "pointer",
                  transition: "opacity 200ms, filter 200ms",
                  filter:
                    hoveredCell &&
                    hoveredCell[0] === rowIndex &&
                    hoveredCell[1] === colIndex
                      ? "drop-shadow(0 0 4px rgba(0, 0, 0, 0.5))"
                      : "none",
                }}
              />
            )),
          )}
        </svg>
      </div>

      {/* Tooltip */}
      <ChartTooltip
        visible={tooltipVisible}
        x={tooltipPos.x}
        y={tooltipPos.y}
        data={tooltipData}
        renderContent={(data) => (
          <div className="space-y-1">
            <p className="text-wl-text-secondary text-xs">
              {data?.row} × {data?.col}
            </p>
            <p className="font-semibold text-wl-text-primary">{data?.value}</p>
          </div>
        )}
      />

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center gap-2 text-xs text-wl-text-secondary">
          <span>Low</span>
          <div className="flex gap-1">
            {colorPalette.map((color, i) => (
              <div
                key={`legend-${i}`}
                className="w-3 h-3"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <span>High</span>
          <span className="ml-4">
            {min.toFixed(0)} - {max.toFixed(0)}
          </span>
        </div>
      )}
    </div>
  );
}
