"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SLAComplianceProps } from "@witylogix/core/analytics";

/**
 * SLA Compliance Component
 *
 * Displays overall SLA compliance percentage with breakdown by service tier
 * and trend visualization.
 */
export function SLACompliance({ data, dateRange, isLoading }: SLAComplianceProps) {
  const pieData = useMemo(() => {
    const tiers = [
      { name: "Premium", value: data.byTier.premium.percentage, color: "var(--wl-success-500)" },
      {
        name: "Standard",
        value: data.byTier.standard.percentage,
        color: "var(--wl-primary-500)",
      },
      { name: "Economy", value: data.byTier.economy.percentage, color: "var(--wl-info-400)" },
    ];
    return tiers;
  }, [data]);

  const trendData = useMemo(() => {
    if (!data.trend || data.trend.length === 0) return [];
    return data.trend.slice(-14); // Show last 14 days
  }, [data]);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>SLA Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center text-wl-text-secondary">
            Loading compliance data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>SLA Compliance</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Overall compliance gauge */}
        <div className="mb-8">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-sm text-wl-text-secondary mb-2">Overall Compliance</p>
              <p className="text-4xl font-bold text-wl-text-primary">{data.overall}%</p>
            </div>
            <Badge
              variant={data.overall >= 95 ? "success" : data.overall >= 90 ? "info" : "warning"}
              className="text-base px-4 py-2"
            >
              {data.overall >= 95
                ? "Excellent"
                : data.overall >= 90
                  ? "Good"
                  : data.overall >= 85
                    ? "Fair"
                    : "Needs Improvement"}
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="w-full h-4 bg-wl-bg-secondary rounded-full overflow-hidden border border-wl-neutral-800">
            <div
              className={`h-full transition-all duration-300 ${
                data.overall >= 95
                  ? "bg-wl-success-500"
                  : data.overall >= 90
                    ? "bg-wl-primary-500"
                    : "bg-wl-warning-500"
              }`}
              style={{ width: `${Math.min(data.overall, 100)}%` }}
            />
          </div>
        </div>

        {/* Tier breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-wl-bg-secondary rounded-lg border border-wl-neutral-800">
            <p className="text-xs uppercase tracking-wide text-wl-success-400 font-semibold mb-2">
              Premium
            </p>
            <p className="text-2xl font-bold text-wl-text-primary">
              {data.byTier.premium.percentage}%
            </p>
            <p className="text-xs text-wl-text-secondary mt-1">
              {data.byTier.premium.count.toLocaleString()} deliveries
            </p>
          </div>

          <div className="p-4 bg-wl-bg-secondary rounded-lg border border-wl-neutral-800">
            <p className="text-xs uppercase tracking-wide text-wl-primary-400 font-semibold mb-2">
              Standard
            </p>
            <p className="text-2xl font-bold text-wl-text-primary">
              {data.byTier.standard.percentage}%
            </p>
            <p className="text-xs text-wl-text-secondary mt-1">
              {data.byTier.standard.count.toLocaleString()} deliveries
            </p>
          </div>

          <div className="p-4 bg-wl-bg-secondary rounded-lg border border-wl-neutral-800">
            <p className="text-xs uppercase tracking-wide text-wl-info-400 font-semibold mb-2">
              Economy
            </p>
            <p className="text-2xl font-bold text-wl-text-primary">
              {data.byTier.economy.percentage}%
            </p>
            <p className="text-xs text-wl-text-secondary mt-1">
              {data.byTier.economy.count.toLocaleString()} deliveries
            </p>
          </div>
        </div>

        {/* Trend chart */}
        {trendData.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-wl-text-primary mb-4">14-Day Trend</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={trendData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--wl-neutral-800)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--wl-text-secondary)"
                  style={{ fontSize: "12px" }}
                />
                <YAxis
                  stroke="var(--wl-text-secondary)"
                  label={{ value: "%", angle: -90, position: "insideLeft" }}
                  style={{ fontSize: "12px" }}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--wl-bg-secondary)",
                    border: "1px solid var(--wl-neutral-700)",
                    borderRadius: "var(--wl-radius-md)",
                    color: "var(--wl-text-primary)",
                  }}
                  formatter={(value: any) => [`${value}%`, ""]}
                  labelStyle={{ color: "var(--wl-text-primary)" }}
                />
                <Bar dataKey="overall" fill="var(--wl-primary-500)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
