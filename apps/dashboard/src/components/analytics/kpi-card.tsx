"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "./sparkline";

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  sparklineData?: number[];
  format?: "number" | "percent" | "currency" | "duration";
  trend?: "up" | "down" | "flat";
  compareLabel?: string;
}

/**
 * Large value display with change indicator and optional sparkline
 */
export function KPICard({
  title,
  value,
  change,
  changeLabel,
  icon,
  sparklineData,
  format = "number",
  trend = "flat",
  compareLabel,
}: KPICardProps) {
  // Determine change direction if not explicitly set
  let displayTrend = trend;
  if (change !== undefined && change !== 0) {
    displayTrend = change > 0 ? "up" : "down";
  }

  // Format change value
  const formatChange = () => {
    if (change === undefined || change === null) return null;

    const sign = change > 0 ? "+" : "";
    const formatted =
      format === "percent" || format === "currency"
        ? `${sign}${Math.abs(change).toFixed(1)}${format === "percent" ? "%" : ""}`
        : `${sign}${Math.abs(change).toFixed(0)}`;

    return formatted;
  };

  return (
    <Card className="relative overflow-hidden">
      {/* Gradient accent */}
      <div
        className={cn(
          "absolute top-0 right-0 w-20 h-20 opacity-10 rounded-full blur-2xl",
          displayTrend === "up"
            ? "bg-wl-success-500"
            : displayTrend === "down"
              ? "bg-wl-danger-500"
              : "bg-wl-primary-500",
        )}
        aria-hidden="true"
      />

      <CardContent className="pt-6 pb-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 flex-1">
              <h4 className="text-xs font-semibold text-wl-text-secondary tracking-wider uppercase">
                {title}
              </h4>
              {compareLabel && (
                <p className="text-xs text-wl-text-tertiary">{compareLabel}</p>
              )}
            </div>

            {icon && (
              <div className="text-wl-text-secondary opacity-40 flex-shrink-0">
                {icon}
              </div>
            )}
          </div>

          {/* Main value with change */}
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-3xl font-bold tabular-nums",
                  "text-wl-text-primary",
                )}
              >
                {value}
              </span>

              {change !== undefined && change !== 0 && (
                <Badge
                  variant={
                    displayTrend === "up"
                      ? "success"
                      : displayTrend === "down"
                        ? "danger"
                        : "default"
                  }
                >
                  <span
                    className={cn(
                      "inline-block",
                      displayTrend === "up" && "rotate-180",
                    )}
                  >
                    {displayTrend === "up" ? "↓" : "↑"}
                  </span>
                  {formatChange()}
                </Badge>
              )}
            </div>

            {changeLabel && (
              <p className="text-xs text-wl-text-tertiary">{changeLabel}</p>
            )}
          </div>

          {/* Sparkline */}
          {sparklineData && sparklineData.length > 0 && (
            <div className="pt-2">
              <Sparkline
                data={sparklineData}
                width={300}
                height={48}
                trendColor
                showArea
                showDot
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
