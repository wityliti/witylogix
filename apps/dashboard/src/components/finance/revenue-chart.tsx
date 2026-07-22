"use client";

import { memo, useMemo, useState, useCallback, Suspense } from "react";
import { Card } from "@/components/ui";
import {
  LazyBarChart as BarChart,
  LazyBar as Bar,
  LazyLine as Line,
  LazyComposedChart as ComposedChart,
  LazyXAxis as XAxis,
  LazyYAxis as YAxis,
  LazyCartesianGrid as CartesianGrid,
  LazyTooltip as Tooltip,
  LazyLegend as Legend,
  LazyResponsiveContainer as ResponsiveContainer,
} from "@/components/charts/lazy";

interface RevenueDataPoint {
  month: string;
  revenue: number;
  target?: number;
  previousYear?: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  title?: string;
  subtitle?: string;
  showComparison?: boolean;
  showTarget?: boolean;
  height?: number;
  currency?: string;
  tooltipFormat?: (value: number) => string;
}

function formatCurrency(value: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

const RevenueTooltip = memo(
  ({
    active,
    payload,
    label,
    currency,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
    currency: string;
  }) => {
    if (active && payload && label) {
      return (
        <div className="bg-wl-bg-elevated border border-wl-border-default rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold text-wl-text-primary mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry, index) => (
              <p key={index} className="text-xs" style={{ color: entry.color }}>
                {entry.name}: {formatCurrency(entry.value, currency)}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  }
);

RevenueTooltip.displayName = "RevenueTooltip";

export const RevenueChart = memo(function RevenueChart({
  data,
  title = "Monthly Revenue",
  subtitle,
  showComparison = true,
  showTarget = true,
  height = 300,
  currency = "USD",
  tooltipFormat,
}: RevenueChartProps) {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  const chartData = useMemo(() => data || [], [data]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;

    const currentYearTotal = chartData.reduce((sum, d) => sum + (d.revenue || 0), 0);
    const previousYearTotal = chartData.reduce(
      (sum, d) => sum + (d.previousYear || 0),
      0
    );
    const targetTotal = chartData.reduce((sum, d) => sum + (d.target || 0), 0);

    const growth =
      previousYearTotal > 0
        ? ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100
        : 0;

    const achievementRate =
      targetTotal > 0 ? (currentYearTotal / targetTotal) * 100 : 0;

    const lastMonth = chartData[chartData.length - 1];
    const previousMonth = chartData[chartData.length - 2];

    const monthlyGrowth =
      previousMonth && previousMonth.revenue > 0
        ? ((lastMonth.revenue - previousMonth.revenue) / previousMonth.revenue) *
          100
        : 0;

    return {
      currentYearTotal,
      previousYearTotal,
      targetTotal,
      growth,
      achievementRate,
      monthlyGrowth,
      lastMonth: lastMonth?.revenue || 0,
    };
  }, [chartData]);

  const handleMouseMove = useCallback((state: any) => {
    if (state.isTooltipActive) {
      setHoveredMonth(state.activeLabel);
    } else {
      setHoveredMonth(null);
    }
  }, []);

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <div className="flex items-center justify-center h-64 text-sm text-wl-text-tertiary">
          No revenue data available
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-wl-text-primary">{title}</h3>
        {subtitle && (
          <p className="text-sm text-wl-text-secondary mt-1">{subtitle}</p>
        )}
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-4 border-b border-wl-border-subtle">
          <div>
            <p className="text-xs text-wl-text-secondary mb-1">Current Year</p>
            <p className="text-base font-bold text-wl-text-primary">
              {formatCurrency(stats.currentYearTotal, currency)}
            </p>
          </div>

          {showComparison && (
            <div>
              <p className="text-xs text-wl-text-secondary mb-1">YoY Growth</p>
              <div className="flex items-center gap-1">
                <p
                  className={`text-base font-bold ${
                    stats.growth >= 0
                      ? "text-wl-success-400"
                      : "text-wl-danger-400"
                  }`}
                >
                  {stats.growth >= 0 ? "+" : ""}{stats.growth.toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-wl-text-secondary mb-1">Latest Month</p>
            <p className="text-base font-bold text-wl-text-primary">
              {formatCurrency(stats.lastMonth, currency)}
            </p>
          </div>

          {showTarget && (
            <div>
              <p className="text-xs text-wl-text-secondary mb-1">vs Target</p>
              <p
                className={`text-base font-bold ${
                  stats.achievementRate >= 100
                    ? "text-wl-success-400"
                    : "text-wl-warning-400"
                }`}
              >
                {stats.achievementRate.toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <Suspense fallback={<div className="w-full" style={{ height }}>
        <div className="w-full h-full bg-wl-bg-elevated animate-pulse rounded-lg border border-wl-neutral-800" />
      </div>}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={chartData}
            onMouseMove={handleMouseMove}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient
                id="revenueGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--wl-success-400)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--wl-success-400)"
                  stopOpacity={0.2}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--wl-border-subtle)"
              vertical={false}
            />

            <XAxis
              dataKey="month"
              stroke="var(--wl-text-tertiary)"
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: "var(--wl-border-subtle)" }}
              style={{ color: "var(--wl-text-tertiary)" }}
            />

            <YAxis
              stroke="var(--wl-text-tertiary)"
              tick={{ fontSize: 12 }}
              tickFormatter={(value: number) => formatCurrency(value, currency).replace(/\.0+K|M/, "")}
              axisLine={{ stroke: "var(--wl-border-subtle)" }}
              style={{ color: "var(--wl-text-tertiary)" }}
            />

            <Tooltip
              content={
                <RevenueTooltip currency={currency} />
              }
              cursor={{ fill: "var(--wl-primary-500)", fillOpacity: 0.05 }}
            />

            <Legend
              wrapperStyle={{
                paddingTop: "20px",
                color: "var(--wl-text-secondary)",
              }}
              iconType="line"
            />

            {/* Revenue Bars */}
            <Bar
              dataKey="revenue"
              fill="var(--wl-success-400)"
              radius={[8, 8, 0, 0]}
              name="Revenue"
              fillOpacity={0.8}
            />

            {/* Previous Year Line */}
            {showComparison && (
              <Line
                type="monotone"
                dataKey="previousYear"
                stroke="var(--wl-text-tertiary)"
                strokeWidth={2}
                name="Previous Year"
                dot={{ fill: "var(--wl-text-tertiary)", r: 4 }}
                activeDot={{ r: 6 }}
                opacity={0.6}
              />
            )}

            {/* Target Line */}
            {showTarget && (
              <Line
                type="monotone"
                dataKey="target"
                stroke="var(--wl-primary-400)"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Target"
                dot={{ fill: "var(--wl-primary-400)", r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Suspense>

      {/* Footer Info */}
      <div className="pt-4 border-t border-wl-border-subtle">
        <p className="text-xs text-wl-text-tertiary">
          Displaying revenue data for the last {chartData.length} months.
          {showComparison && " Comparison includes previous year data."}
        </p>
      </div>
    </Card>
  );
});

RevenueChart.displayName = "RevenueChart";
