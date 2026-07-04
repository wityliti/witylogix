"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EfficiencyHeatmapProps } from "@witylogix/core/analytics";

/**
 * Efficiency Heatmap Component
 *
 * 7×24 grid showing delivery efficiency by day of week and hour of day.
 * Color intensity indicates efficiency percentage (red = low, green = high).
 */
export function EfficiencyHeatmap({
  data,
  dateRange,
  isLoading,
  onCellClick,
}: EfficiencyHeatmapProps) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Group data by day and hour
  const heatmapData = useMemo(() => {
    const grid: Record<string, Record<number, any>> = {};

    for (let day = 0; day < 7; day++) {
      grid[day] = {};
      for (let hour = 0; hour < 24; hour++) {
        grid[day][hour] = null;
      }
    }

    data.forEach((cell) => {
      grid[cell.dayOfWeek][cell.hour] = cell;
    });

    return grid;
  }, [data]);

  const getColor = (efficiency: number): string => {
    // Color scale: red (low) -> yellow (medium) -> green (high)
    if (efficiency < 60) {
      return "bg-wl-danger-700 hover:bg-wl-danger-600";
    } else if (efficiency < 70) {
      return "bg-wl-warning-700 hover:bg-wl-warning-600";
    } else if (efficiency < 85) {
      return "bg-wl-info-700 hover:bg-wl-info-600";
    } else {
      return "bg-wl-success-700 hover:bg-wl-success-600";
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Delivery Efficiency Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center text-wl-text-secondary">
            Loading heatmap...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Delivery Efficiency Heatmap</CardTitle>
            <p className="text-sm text-wl-text-secondary mt-1">
              Day of week × Hour of day efficiency pattern
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Hour labels (top) */}
            <div className="flex items-start gap-2 mb-2">
              <div className="w-12" />
              <div className="flex gap-0.5">
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    className="w-8 text-center text-xs text-wl-text-secondary"
                  >
                    {i}
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap grid */}
            <div className="flex flex-col gap-0.5">
              {dayNames.map((dayName, day) => (
                <div key={day} className="flex items-center gap-2">
                  <div className="w-12 text-xs font-medium text-wl-text-secondary">
                    {dayName}
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 24 }, (_, hour) => {
                      const cell = heatmapData[day]?.[hour];
                      const efficiency = cell?.efficiency || 0;

                      return (
                        <button
                          key={`${day}-${hour}`}
                          onClick={() => cell && onCellClick?.(cell)}
                          className={cn(
                            "w-8 h-8 rounded-sm transition-all cursor-pointer border border-wl-neutral-700",
                            "hover:scale-110 hover:shadow-lg",
                            cell ? getColor(efficiency) : "bg-wl-bg-secondary",
                          )}
                          title={
                            cell
                              ? `${dayName} ${hour}:00 - ${efficiency}% efficiency (${cell.deliveryCount} deliveries)`
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-wl-danger-700" />
                <span className="text-sm text-wl-text-secondary">&lt; 60%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-wl-warning-700" />
                <span className="text-sm text-wl-text-secondary">60-70%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-wl-info-700" />
                <span className="text-sm text-wl-text-secondary">70-85%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-wl-success-700" />
                <span className="text-sm text-wl-text-secondary">&gt; 85%</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
