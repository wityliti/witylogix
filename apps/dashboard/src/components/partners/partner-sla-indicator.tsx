"use client";

import { forwardRef, useMemo, type HTMLAttributes } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface PartnerSLAIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  partnerName: string;
  onTimePercentage: number; // 0-100
  deliveriesMet: number;
  deliveriesMissed: number;
  trend?: "up" | "down" | "stable"; // 7-day trend
  sparklineData?: number[]; // Last 7 days percentages
}

/**
 * SLA compliance widget showing circular progress and trend
 */
const PartnerSLAIndicator = forwardRef<
  HTMLDivElement,
  PartnerSLAIndicatorProps
>(
  (
    {
      partnerName,
      onTimePercentage,
      deliveriesMet,
      deliveriesMissed,
      trend = "stable",
      sparklineData = [],
      className,
      ...props
    },
    ref
  ) => {
    const data = useMemo(() => {
      if (sparklineData.length > 0) return sparklineData;
      const base = onTimePercentage;
      return Array.from({ length: 7 }, (_, i) => {
        if (trend === "up") return Math.min(100, base - 5 + i);
        if (trend === "down") return Math.max(0, base + 5 - i);
        return base;
      });
    }, [onTimePercentage, sparklineData, trend]);

    const getTrendColor = (): string => {
      if (trend === "up") return "text-wl-success-400";
      if (trend === "down") return "text-wl-danger-400";
      return "text-wl-text-secondary";
    };

    const getTrendIcon = () => {
      if (trend === "up") return <TrendingUp className="w-4 h-4" />;
      if (trend === "down") return <TrendingDown className="w-4 h-4" />;
      return <Minus className="w-4 h-4" />;
    };

    const getScoreColor = (percentage: number): string => {
      if (percentage >= 95) return "#10b981";
      if (percentage >= 85) return "#f59e0b";
      if (percentage >= 75) return "#f97316";
      return "#ef4444";
    };

    const getScoreBgColor = (percentage: number): string => {
      if (percentage >= 95) return "bg-wl-success-500/10";
      if (percentage >= 85) return "bg-wl-warning-500/10";
      if (percentage >= 75) return "bg-wl-orange-500/10";
      return "bg-wl-danger-500/10";
    };

    // SVG dimensions
    const size = 120;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (onTimePercentage / 100) * circumference;

    // Sparkline dimensions
    const sparkWidth = 100;
    const sparkHeight = 32;
    const sparklinePoints = data.map((value, i) => {
      const x = (i / (data.length - 1)) * sparkWidth;
      const y = sparkHeight - (value / 100) * sparkHeight;
      return `${x},${y}`;
    });

    return (
      <Card
        ref={ref}
        className={cn("flex flex-col gap-4", className)}
        {...props}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-wl-text-primary">
              {partnerName}
            </h3>
            <p className="text-xs text-wl-text-secondary mt-1">SLA Compliance</p>
          </div>
          <div className={cn("flex items-center gap-1 px-2 py-1 rounded", getTrendColor())}>
            {getTrendIcon()}
            <span className="text-xs font-semibold">
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
            </span>
          </div>
        </div>

        {/* Circular progress */}
        <div className="flex items-center justify-center">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--wl-border-subtle)"
              strokeWidth="4"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={getScoreColor(onTimePercentage)}
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 500ms ease" }}
            />
          </svg>

          {/* Center text */}
          <div className="absolute flex flex-col items-center gap-1">
            <span
              className="text-2xl font-bold"
              style={{ color: getScoreColor(onTimePercentage) }}
            >
              {Math.round(onTimePercentage)}%
            </span>
            <span className="text-xs text-wl-text-secondary">On-Time</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className={cn("p-3 rounded-md", getScoreBgColor(onTimePercentage))}>
            <p className="text-xs text-wl-text-secondary font-medium mb-1">
              Deliveries Met
            </p>
            <p className="text-lg font-semibold text-wl-text-primary">
              {deliveriesMet}
            </p>
          </div>
          <div className="p-3 rounded-md bg-wl-danger-500/10">
            <p className="text-xs text-wl-text-secondary font-medium mb-1">
              Missed
            </p>
            <p className="text-lg font-semibold text-wl-danger-400">
              {deliveriesMissed}
            </p>
          </div>
        </div>

        {/* Sparkline - Last 7 days */}
        <div>
          <p className="text-xs text-wl-text-secondary font-medium mb-2">
            Last 7 Days
          </p>
          <svg
            width="100%"
            height="40"
            viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
            preserveAspectRatio="none"
            className="bg-wl-bg-surface rounded p-1"
          >
            {/* Grid */}
            {[25, 50, 75].map((line) => (
              <line
                key={`grid-${line}`}
                x1="0"
                y1={(sparkHeight * (100 - line)) / 100}
                x2={sparkWidth}
                y2={(sparkHeight * (100 - line)) / 100}
                stroke="var(--wl-border-subtle)"
                strokeWidth="0.5"
                opacity="0.3"
              />
            ))}

            {/* Sparkline path */}
            <path
              d={`M ${sparklinePoints.join(" L ")}`}
              fill="none"
              stroke="var(--wl-primary-400)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Points */}
            {sparklinePoints.map((point, i) => {
              const [x, y] = point.split(",").map(Number);
              return (
                <circle
                  key={`point-${i}`}
                  cx={x}
                  cy={y}
                  r="1.5"
                  fill="var(--wl-primary-400)"
                />
              );
            })}
          </svg>
        </div>

        {/* Status message */}
        <div className="text-xs text-wl-text-secondary text-center pt-2 border-t border-wl-border-subtle">
          {onTimePercentage >= 95 ? (
            <p className="text-wl-success-400 font-medium">
              Excellent SLA performance
            </p>
          ) : onTimePercentage >= 85 ? (
            <p className="text-wl-warning-400 font-medium">
              Good SLA performance
            </p>
          ) : (
            <p className="text-wl-danger-400 font-medium">
              SLA improvement needed
            </p>
          )}
        </div>
      </Card>
    );
  }
);

PartnerSLAIndicator.displayName = "PartnerSLAIndicator";

export { PartnerSLAIndicator };
export type { PartnerSLAIndicatorProps };
