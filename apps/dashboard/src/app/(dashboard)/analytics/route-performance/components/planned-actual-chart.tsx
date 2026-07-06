"use client";

import { useMemo, Suspense } from "react";
import {
  LazyComposedChart as ComposedChart,
  LazyLine as Line,
  LazyXAxis as XAxis,
  LazyYAxis as YAxis,
  LazyCartesianGrid as CartesianGrid,
  LazyTooltip as Tooltip,
  LazyLegend as Legend,
  LazyResponsiveContainer as ResponsiveContainer,
  LazyArea as Area,
} from "@/components/charts/lazy";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PlannedActualChartProps } from "@witylogix/core/analytics";

/**
 * Planned vs Actual Chart Component
 *
 * Dual-line chart comparing planned vs actual delivery times with shaded variance area.
 * Visualizes the efficiency gap and on-time performance trends.
 */
export function PlannedActualChart({
  data,
  dateRange,
  isLoading,
  error,
}: PlannedActualChartProps) {
  const chartData = useMemo(() => {
    if (!data) return [];

    return data.map((point) => ({
      ...point,
      // Calculate the variance area boundaries
      varianceUpper: Math.max(point.plannedDuration, point.actualDuration) + 5,
      varianceLower: Math.min(point.plannedDuration, point.actualDuration) - 5,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle>Planned vs Actual Delivery Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-wl-text-secondary">
            Loading chart data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full h-full border-wl-danger-500">
        <CardHeader>
          <CardTitle>Planned vs Actual Delivery Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-wl-danger-400">
            {error}
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
            <CardTitle>Planned vs Actual Delivery Time</CardTitle>
            <p className="text-sm text-wl-text-secondary mt-1">
              Time trend analysis:{" "}
              {dateRange.from instanceof Date
                ? dateRange.from.toLocaleDateString()
                : dateRange.from}{" "}
              to{" "}
              {dateRange.to instanceof Date
                ? dateRange.to.toLocaleDateString()
                : dateRange.to}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full h-80">
          <Suspense
            fallback={
              <div className="h-80 bg-wl-bg-secondary animate-pulse rounded-lg border border-wl-neutral-800" />
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient
                    id="varianceGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--wl-warning-500)"
                      stopOpacity={0.15}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--wl-warning-500)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--wl-neutral-800)"
                  verticalPoints={chartData.map((_, i) => i)}
                />
                <XAxis
                  dataKey="timestamp"
                  stroke="var(--wl-text-secondary)"
                  style={{ fontSize: "12px" }}
                />
                <YAxis
                  stroke="var(--wl-text-secondary)"
                  label={{
                    value: "Minutes",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  style={{ fontSize: "12px" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--wl-bg-secondary)",
                    border: "1px solid var(--wl-neutral-700)",
                    borderRadius: "var(--wl-radius-md)",
                    color: "var(--wl-text-primary)",
                  }}
                  formatter={(value: unknown) =>
                    [`${value}m`, ""] as [string, string]
                  }
                  labelStyle={{ color: "var(--wl-text-primary)" }}
                />
                <Legend
                  wrapperStyle={{ color: "var(--wl-text-secondary)" }}
                  verticalAlign="top"
                  height={36}
                />

                {/* Variance area (background) */}
                <Area
                  type="monotone"
                  dataKey="varianceUpper"
                  fill="url(#varianceGradient)"
                  stroke="transparent"
                  isAnimationActive={false}
                />

                {/* Planned line */}
                <Line
                  type="monotone"
                  dataKey="plannedDuration"
                  stroke="var(--wl-primary-500)"
                  strokeWidth={2}
                  dot={{ fill: "var(--wl-primary-500)", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Planned Duration"
                  isAnimationActive={true}
                />

                {/* Actual line */}
                <Line
                  type="monotone"
                  dataKey="actualDuration"
                  stroke="var(--wl-info-400)"
                  strokeWidth={2}
                  dot={{ fill: "var(--wl-info-400)", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Actual Duration"
                  isAnimationActive={true}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Suspense>
        </div>

        {/* Summary stats below chart */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-wl-bg-secondary rounded-lg border border-wl-neutral-800">
            <p className="text-sm text-wl-text-secondary mb-1">
              Avg Planned Time
            </p>
            <p className="text-lg font-semibold text-wl-text-primary">
              {chartData.length > 0
                ? Math.round(
                    chartData.reduce((sum, d) => sum + d.plannedDuration, 0) /
                      chartData.length,
                  )
                : 0}
              m
            </p>
          </div>
          <div className="p-4 bg-wl-bg-secondary rounded-lg border border-wl-neutral-800">
            <p className="text-sm text-wl-text-secondary mb-1">
              Avg Actual Time
            </p>
            <p className="text-lg font-semibold text-wl-text-primary">
              {chartData.length > 0
                ? Math.round(
                    chartData.reduce((sum, d) => sum + d.actualDuration, 0) /
                      chartData.length,
                  )
                : 0}
              m
            </p>
          </div>
          <div className="p-4 bg-wl-bg-secondary rounded-lg border border-wl-neutral-800">
            <p className="text-sm text-wl-text-secondary mb-1">Avg On-Time %</p>
            <p className="text-lg font-semibold text-wl-text-primary">
              {chartData.length > 0
                ? Math.round(
                    chartData.reduce((sum, d) => sum + d.onTimePercentage, 0) /
                      chartData.length,
                  )
                : 0}
              %
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
