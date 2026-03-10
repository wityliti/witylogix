"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ComparisonCardProps {
  label: string;
  leftValue: number;
  leftLabel: string;
  rightValue: number;
  rightLabel: string;
  format?: "number" | "percent" | "currency";
  showRatio?: boolean;
}

/**
 * Side-by-side metric comparison with progress bar and delta badge
 */
export function ComparisonCard({
  label,
  leftValue,
  leftLabel,
  rightValue,
  rightLabel,
  format = "number",
  showRatio = true,
}: ComparisonCardProps) {
  const { total, leftPercent, rightPercent, delta, deltaPct, trend } = useMemo(
    () => {
      const total = leftValue + rightValue;
      const leftPercent = total > 0 ? (leftValue / total) * 100 : 0;
      const rightPercent = total > 0 ? (rightValue / total) * 100 : 0;
      const delta = rightValue - leftValue;
      const deltaPct =
        leftValue > 0 ? ((delta / leftValue) * 100).toFixed(1) : "0";
      const trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

      return {
        total,
        leftPercent,
        rightPercent,
        delta,
        deltaPct,
        trend,
      };
    },
    [leftValue, rightValue]
  );

  const formatValue = (value: number): string => {
    switch (format) {
      case "percent":
        return `${value.toFixed(1)}%`;
      case "currency":
        return `$${value.toLocaleString()}`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 pb-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-wl-text-primary">
              {label}
            </h4>
            <Badge
              variant={
                trend === "up"
                  ? "success"
                  : trend === "down"
                    ? "danger"
                    : "default"
              }
            >
              <span
                className={cn(
                  "inline-block",
                  trend === "down" && "rotate-180"
                )}
              >
                {trend === "up" ? "↑" : "↓"}
              </span>
              {trend === "flat" ? "No change" : `${Math.abs(Number(deltaPct))}%`}
            </Badge>
          </div>

          {/* Values */}
          <div className="grid grid-cols-2 gap-3">
            {/* Left value */}
            <div>
              <p className="text-xs text-wl-text-tertiary mb-1">
                {leftLabel}
              </p>
              <p className="text-xl font-bold text-wl-text-primary tabular-nums">
                {formatValue(leftValue)}
              </p>
              {showRatio && (
                <p className="text-xs text-wl-text-tertiary mt-1">
                  {leftPercent.toFixed(0)}%
                </p>
              )}
            </div>

            {/* Right value */}
            <div>
              <p className="text-xs text-wl-text-tertiary mb-1">
                {rightLabel}
              </p>
              <p className="text-xl font-bold text-wl-text-primary tabular-nums">
                {formatValue(rightValue)}
              </p>
              {showRatio && (
                <p className="text-xs text-wl-text-tertiary mt-1">
                  {rightPercent.toFixed(0)}%
                </p>
              )}
            </div>
          </div>

          {/* Progress bar showing ratio */}
          {showRatio && (
            <div className="space-y-2">
              <div className="flex h-2 rounded-full bg-wl-bg-surface overflow-hidden">
                {/* Left segment */}
                <div
                  className="bg-wl-primary-500"
                  style={{
                    width: `${leftPercent}%`,
                    transition: "width 400ms ease-out",
                  }}
                />
                {/* Right segment */}
                <div
                  className="bg-wl-success-500"
                  style={{
                    width: `${rightPercent}%`,
                    transition: "width 400ms ease-out",
                  }}
                />
              </div>

              {/* Ratio labels */}
              <div className="flex justify-between text-xs text-wl-text-tertiary">
                <span>{leftLabel}</span>
                <span>{rightLabel}</span>
              </div>
            </div>
          )}

          {/* Delta info */}
          <div className="pt-2 border-t border-wl-border-subtle">
            <p className="text-xs text-wl-text-tertiary">
              Δ{" "}
              <span
                className={cn(
                  "font-semibold",
                  trend === "up"
                    ? "text-wl-success-400"
                    : trend === "down"
                      ? "text-wl-danger-400"
                      : "text-wl-text-secondary"
                )}
              >
                {delta > 0 ? "+" : ""}
                {formatValue(Math.abs(delta))}
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
