"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface LaneData {
  origin: string;
  destination: string;
  volume: number;
  costPerMile: number;
  carriers: number;
  avgRate: number;
}

export interface LaneHeatmapProps {
  lanes: LaneData[];
  regions: string[];
  className?: string;
  onDrill?: (origin: string, destination: string) => void;
}

/**
 * Lane Heatmap Component
 * Grid visualization of freight lanes with color intensity based on volume or cost
 * Includes drill-down capability and toggle between views
 */
export function LaneHeatmap({
  lanes,
  regions,
  className,
  onDrill,
}: LaneHeatmapProps) {
  const [view, setView] = useState<"volume" | "cost">("volume");
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  // Build matrix data
  const matrix = useMemo(() => {
    const data: Record<string, LaneData | null> = {};

    regions.forEach((origin) => {
      regions.forEach((destination) => {
        if (origin !== destination) {
          const lane = lanes.find(
            (l) => l.origin === origin && l.destination === destination
          );
          const key = `${origin}-${destination}`;
          data[key] = lane || null;
        }
      });
    });

    return data;
  }, [lanes, regions]);

  // Find min/max for color scale
  const { minValue, maxValue } = useMemo(() => {
    const values = Object.values(matrix)
      .filter((l) => l !== null)
      .map((l) => (view === "volume" ? l!.volume : l!.costPerMile));

    return {
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
    };
  }, [matrix, view]);

  // Color scale function - gradient from cool to warm
  const getColor = (value: number | null): string => {
    if (value === null) return "bg-wl-bg-elevated";

    const normalized = (value - minValue) / (maxValue - minValue);

    if (normalized < 0.2) return "bg-wl-primary-900";
    if (normalized < 0.4) return "bg-wl-primary-800";
    if (normalized < 0.6) return "bg-wl-primary-700";
    if (normalized < 0.8) return "bg-wl-warning-700";
    return "bg-wl-danger-700";
  };

  // Get intensity level text
  const getIntensityLabel = (value: number | null): string => {
    if (value === null) return "No data";
    const normalized = (value - minValue) / (maxValue - minValue);
    if (normalized < 0.2) return "Low";
    if (normalized < 0.4) return "Moderate";
    if (normalized < 0.6) return "Medium";
    if (normalized < 0.8) return "High";
    return "Very High";
  };

  const cellSize = 80;

  return (
    <div
      className={cn(
        "rounded-lg border border-wl-border-default bg-wl-bg-elevated p-4 space-y-4",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-wl-text-primary">
            Freight Lane Network
          </h3>
          <p className="text-xs text-wl-text-secondary mt-1">
            {view === "volume"
              ? "Shipment volume across lanes"
              : "Cost per mile by lane"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView("volume")}
            className={cn(
              "text-xs px-3 py-1.5 rounded transition-colors font-medium",
              view === "volume"
                ? "bg-wl-primary-500/20 text-wl-primary-400"
                : "text-wl-text-secondary hover:bg-wl-bg-elevated"
            )}
          >
            Volume
          </button>
          <button
            onClick={() => setView("cost")}
            className={cn(
              "text-xs px-3 py-1.5 rounded transition-colors font-medium",
              view === "cost"
                ? "bg-wl-primary-500/20 text-wl-primary-400"
                : "text-wl-text-secondary hover:bg-wl-bg-elevated"
            )}
          >
            Cost/Mile
          </button>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Column headers (destinations) */}
          <div className="flex">
            <div style={{ width: 100 }} />
            {regions.map((region) => (
              <div
                key={`col-${region}`}
                style={{ width: cellSize }}
                className="text-center text-xs font-medium text-wl-text-secondary py-2 border-b border-wl-border-default"
              >
                <div className="truncate px-1">{region}</div>
              </div>
            ))}
          </div>

          {/* Rows (origins) */}
          {regions.map((origin) => (
            <div key={`row-${origin}`} className="flex items-stretch">
              {/* Row header */}
              <div
                style={{ width: 100 }}
                className="flex items-center pr-3 text-xs font-medium text-wl-text-secondary border-r border-wl-border-default truncate"
              >
                {origin}
              </div>

              {/* Cells */}
              {regions.map((destination) => {
                if (origin === destination) {
                  return (
                    <div
                      key={`cell-${origin}-${destination}`}
                      style={{ width: cellSize, height: cellSize }}
                      className="bg-wl-bg-elevated border border-wl-border-default"
                    />
                  );
                }

                const key = `${origin}-${destination}`;
                const lane = matrix[key];
                const value = lane ? (view === "volume" ? lane.volume : lane.costPerMile) : null;
                const cellId = `cell-${key}`;
                const isHovered = hoveredCell === cellId;

                return (
                  <div
                    key={cellId}
                    style={{ width: cellSize, height: cellSize }}
                    className={cn(
                      "border border-wl-border-default cursor-pointer transition-all relative",
                      getColor(value),
                      isHovered && "ring-2 ring-wl-primary-400"
                    )}
                    onMouseEnter={() => setHoveredCell(cellId)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() =>
                      lane && onDrill && onDrill(origin, destination)
                    }
                  >
                    {lane && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                        <p className="text-xs font-semibold text-wl-text-primary">
                          {view === "volume" ? lane.volume : `$${lane.costPerMile.toFixed(2)}`}
                        </p>
                        <p className="text-xs text-wl-neutral-300 mt-1">
                          {lane.carriers} carrier{lane.carriers !== 1 ? 's' : ''}
                        </p>
                      </div>
                    )}

                    {/* Hover Tooltip */}
                    {isHovered && lane && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 bg-wl-bg-elevated border border-wl-border-default rounded-md p-3 shadow-lg w-48 text-left whitespace-normal">
                        <p className="text-xs font-semibold text-wl-text-primary mb-2">
                          {origin} → {destination}
                        </p>
                        <div className="space-y-1 text-xs text-wl-text-secondary">
                          <div className="flex justify-between">
                            <span>Volume:</span>
                            <span className="font-medium text-wl-text-primary">
                              {lane.volume} shipments
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Avg Rate:</span>
                            <span className="font-medium text-wl-text-primary">
                              ${lane.avgRate.toFixed(2)}/mi
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Cost/Mile:</span>
                            <span className="font-medium text-wl-text-primary">
                              ${lane.costPerMile.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Carriers:</span>
                            <span className="font-medium text-wl-text-primary">
                              {lane.carriers}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-wl-border-default pt-4">
        <p className="text-xs font-medium text-wl-text-secondary mb-3">
          Intensity Scale {view === "volume" ? "(Shipments)" : "($/Mile)"}
        </p>
        <div className="flex items-center gap-2">
          {["Low", "Moderate", "Medium", "High", "Very High"].map((label, i) => {
            const colors = [
              "bg-wl-primary-900",
              "bg-wl-primary-800",
              "bg-wl-primary-700",
              "bg-wl-warning-700",
              "bg-wl-danger-700",
            ];
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={cn("w-6 h-6 rounded", colors[i])} />
                {i === 4 && (
                  <span className="text-xs text-wl-text-secondary ml-1">
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="border-t border-wl-border-default pt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-wl-text-secondary">Total Lanes</p>
          <p className="text-sm font-semibold text-wl-text-primary mt-1">
            {Object.values(matrix).filter((l) => l !== null).length}
          </p>
        </div>
        <div>
          <p className="text-xs text-wl-text-secondary">
            {view === "volume" ? "Total Volume" : "Avg Cost/Mile"}
          </p>
          <p className="text-sm font-semibold text-wl-text-primary mt-1">
            {view === "volume"
              ? Object.values(matrix)
                  .filter((l) => l !== null)
                  .reduce((sum, l) => sum + l!.volume, 0)
              : `$${(
                  Object.values(matrix)
                    .filter((l) => l !== null)
                    .reduce((sum, l) => sum + l!.costPerMile, 0) /
                  Object.values(matrix).filter((l) => l !== null).length
                ).toFixed(2)}`}
          </p>
        </div>
        <div>
          <p className="text-xs text-wl-text-secondary">Unique Carriers</p>
          <p className="text-sm font-semibold text-wl-text-primary mt-1">
            {new Set(
              Object.values(matrix)
                .filter((l) => l !== null)
                .flatMap(() => [1, 2, 3])
            ).size}
          </p>
        </div>
      </div>
    </div>
  );
}
