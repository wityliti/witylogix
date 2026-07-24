"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { DemandForecastData, DemandForecastChartProps } from "./types";

/**
 * Demand forecast line chart component
 * Displays predicted vs actual delivery counts with confidence band and anomaly markers
 */
export function DemandForecastChart({
  data,
  onAnomalyClick,
  config = {},
  className,
}: DemandForecastChartProps) {
  const {
    height = 300,
    showGrid = true,
    showLegend = true,
    timeFormat = "hourly",
  } = config;

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Calculate chart dimensions and scales
  const {
    maxValue,
    minValue,
    canvasHeight,
    canvasWidth,
    padding,
    pointSpacing,
    timeLabels,
  } = useMemo(() => {
    const allValues = data.flatMap((d) => [
      d.predicted,
      d.actual || d.predicted,
    ]);
    const max = Math.max(...allValues);
    const min = Math.min(...allValues, 0);

    const padding = { top: 30, right: 40, bottom: 50, left: 50 };
    const canvasWidth = Math.max(800, data.length * 40);
    const canvasHeight = height;

    const pointSpacing =
      (canvasWidth - padding.left - padding.right) / (data.length - 1 || 1);

    const labels = data.map((d) => {
      const date = new Date(d.timestamp);
      if (timeFormat === "hourly") {
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else {
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }
    });

    return {
      maxValue: max,
      minValue: min,
      canvasHeight,
      canvasWidth,
      padding,
      pointSpacing,
      timeLabels: labels,
    };
  }, [data, height, timeFormat]);

  const valueRange = maxValue - minValue || 1;

  // Scale functions
  const scaleY = useCallback(
    (value: number): number => {
      const normalized = (value - minValue) / valueRange;
      return (
        canvasHeight -
        padding.bottom -
        normalized * (canvasHeight - padding.top - padding.bottom)
      );
    },
    [minValue, valueRange, canvasHeight, padding],
  );

  const scaleX = useCallback(
    (index: number): number => {
      return padding.left + index * pointSpacing;
    },
    [padding, pointSpacing],
  );

  // Generate path strings for lines
  const predictedPath = useMemo(() => {
    if (data.length === 0) return "";
    const points = data
      .map((d, i) => `${scaleX(i)},${scaleY(d.predicted)}`)
      .join("L");
    return `M${points}`;
  }, [data, scaleX, scaleY]);

  const actualPath = useMemo(() => {
    if (data.length === 0 || !data.some((d) => d.actual !== undefined))
      return "";
    const validData = data.filter((d) => d.actual !== undefined);
    if (validData.length === 0) return "";

    const points = validData
      .map((d, i) => {
        const originalIndex = data.indexOf(d);
        return `${scaleX(originalIndex)},${scaleY(d.actual!)}`;
      })
      .join("L");
    return `M${points}`;
  }, [data, scaleX, scaleY]);

  // Generate confidence band path
  const confidenceBand = useMemo(() => {
    if (data.length === 0) return "";
    const upperBound = data.map((d) => {
      const conf = d.confidence ?? 0.8;
      return d.predicted * (1 + (1 - conf) * 0.15);
    });

    const lowerBound = data.map((d) => {
      const conf = d.confidence ?? 0.8;
      return Math.max(0, d.predicted * (1 - (1 - conf) * 0.15));
    });

    const upperPath = upperBound
      .map((val, i) => `${scaleX(i)},${scaleY(val)}`)
      .join("L");

    const lowerPath = lowerBound
      .reverse()
      .map((val, i) => {
        const idx = data.length - 1 - i;
        return `${scaleX(idx)},${scaleY(val)}`;
      })
      .join("L");

    return `M${upperPath}L${lowerPath}Z`;
  }, [data, scaleX, scaleY]);

  // Get anomalies
  const anomalies = useMemo(() => {
    return data
      .map((d, i) => (d.anomaly ? { index: i, data: d } : null))
      .filter(Boolean) as Array<{ index: number; data: DemandForecastData }>;
  }, [data]);

  const handlePointHover = useCallback(
    (index: number, event: React.MouseEvent) => {
      setHoveredIndex(index);
      setTooltipPos({ x: event.clientX, y: event.clientY });
    },
    [],
  );

  const handlePointLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  const handleAnomalyClick = useCallback(
    (index: number) => {
      onAnomalyClick?.(index, data[index]);
    },
    [data, onAnomalyClick],
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col gap-4">
        {/* Chart container */}
        <div className="overflow-x-auto border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-4">
          <svg
            width={canvasWidth}
            height={canvasHeight}
            className="bg-transparent"
          >
            {/* Grid lines */}
            {showGrid && (
              <>
                {/* Vertical grid lines */}
                {data.map((_, i) => (
                  <line
                    key={`grid-v-${i}`}
                    x1={scaleX(i)}
                    y1={padding.top}
                    x2={scaleX(i)}
                    y2={canvasHeight - padding.bottom}
                    stroke="var(--wl-border-subtle)"
                    strokeWidth="1"
                    opacity="0.3"
                  />
                ))}

                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const y =
                    padding.top +
                    (1 - ratio) * (canvasHeight - padding.top - padding.bottom);
                  return (
                    <line
                      key={`grid-h-${i}`}
                      x1={padding.left}
                      y1={y}
                      x2={canvasWidth - padding.right}
                      y2={y}
                      stroke="var(--wl-border-subtle)"
                      strokeWidth="1"
                      opacity="0.3"
                    />
                  );
                })}
              </>
            )}

            {/* Confidence band */}
            {data.some((d) => d.confidence !== undefined) && (
              <path
                d={confidenceBand}
                fill="rgba(59, 130, 246, 0.1)"
                stroke="none"
              />
            )}

            {/* Actual line (dashed) */}
            {actualPath && (
              <path
                d={actualPath}
                stroke="var(--wl-warning-400)"
                strokeWidth="2"
                fill="none"
                strokeDasharray="5,5"
                opacity="0.7"
              />
            )}

            {/* Predicted line (solid) */}
            <path
              d={predictedPath}
              stroke="var(--wl-primary-500)"
              strokeWidth="2.5"
              fill="none"
            />

            {/* Data points for predicted */}
            {data.map((d, i) => (
              <g key={`predicted-${i}`}>
                <circle
                  cx={scaleX(i)}
                  cy={scaleY(d.predicted)}
                  r="3"
                  fill="var(--wl-primary-500)"
                  stroke="var(--wl-bg-surface)"
                  strokeWidth="1"
                  onMouseEnter={(e) => handlePointHover(i, e as any)}
                  onMouseLeave={handlePointLeave}
                  style={{ cursor: "pointer" }}
                />
              </g>
            ))}

            {/* Anomaly markers */}
            {anomalies.map(({ index }) => (
              <g
                key={`anomaly-${index}`}
                onClick={() => handleAnomalyClick(index)}
                style={{ cursor: "pointer" }}
              >
                {/* Outer circle */}
                <circle
                  cx={scaleX(index)}
                  cy={scaleY(data[index].predicted)}
                  r="8"
                  fill="none"
                  stroke="rgb(239, 68, 68)"
                  strokeWidth="2"
                  opacity="0.8"
                />
                {/* Center dot */}
                <circle
                  cx={scaleX(index)}
                  cy={scaleY(data[index].predicted)}
                  r="4"
                  fill="rgb(239, 68, 68)"
                />
              </g>
            ))}

            {/* Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const value = minValue + ratio * valueRange;
              const y =
                padding.top +
                (1 - ratio) * (canvasHeight - padding.top - padding.bottom);
              return (
                <text
                  key={`y-label-${i}`}
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--wl-text-tertiary)"
                >
                  {Math.round(value)}
                </text>
              );
            })}

            {/* X-axis labels (every 4th point to avoid clutter) */}
            {timeLabels.map((label, i) => {
              if (data.length > 20 && i % 4 !== 0) return null;
              if (data.length <= 20 && i % 2 !== 0) return null;
              return (
                <text
                  key={`x-label-${i}`}
                  x={scaleX(i)}
                  y={canvasHeight - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--wl-text-tertiary)"
                >
                  {label}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="flex items-center gap-6 px-4 py-3 border border-wl-border-subtle rounded-lg bg-wl-bg-surface">
            <div className="flex items-center gap-4">
              {/* Predicted line */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-gradient-to-r from-wl-primary-500 to-wl-primary-600" />
                <span className="text-xs text-wl-text-tertiary">Predicted</span>
              </div>

              {/* Actual line */}
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-0.5"
                  style={{
                    background: "var(--wl-warning-400)",
                    backgroundImage:
                      "repeating-linear-gradient(90deg, var(--wl-warning-400) 0px, var(--wl-warning-400) 5px, transparent 5px, transparent 10px)",
                  }}
                />
                <span className="text-xs text-wl-text-tertiary">Actual</span>
              </div>

              {/* Confidence band */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-4 bg-blue-500/10 rounded border border-blue-500/30" />
                <span className="text-xs text-wl-text-tertiary">
                  Confidence Band
                </span>
              </div>

              {/* Anomalies */}
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    fill="none"
                    stroke="rgb(239, 68, 68)"
                    strokeWidth="1"
                  />
                  <circle cx="8" cy="8" r="3" fill="rgb(239, 68, 68)" />
                </svg>
                <span className="text-xs text-wl-text-tertiary">Anomaly</span>
              </div>
            </div>
          </div>
        )}

        {/* Tooltip */}
        {hoveredIndex !== null && (
          <div
            className="fixed bg-wl-bg-elevated border border-wl-border-default rounded-md shadow-lg p-3 z-50 pointer-events-none"
            style={{
              left: `${tooltipPos.x + 10}px`,
              top: `${tooltipPos.y + 10}px`,
              maxWidth: "220px",
            }}
          >
            <p className="text-xs text-wl-text-tertiary font-medium">
              {timeLabels[hoveredIndex]}
            </p>
            <p className="text-sm font-semibold text-wl-text-primary mt-1">
              Predicted: {Math.round(data[hoveredIndex].predicted)} units
            </p>
            {data[hoveredIndex].actual !== undefined && (
              <p className="text-sm text-wl-text-secondary">
                Actual: {Math.round(data[hoveredIndex].actual!)} units
              </p>
            )}
            {data[hoveredIndex].confidence !== undefined && (
              <p className="text-xs text-wl-text-tertiary mt-1">
                Confidence: {Math.round(data[hoveredIndex].confidence! * 100)}%
              </p>
            )}
            {data[hoveredIndex].anomaly && (
              <p className="text-xs text-red-400 font-medium mt-1">
                Anomaly detected
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
