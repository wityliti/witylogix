"use client";

import { forwardRef, HTMLAttributes, useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent, Button } from "@/components/ui";
import type { AgingBucket } from "./types";

interface AgingBucketsProps extends HTMLAttributes<HTMLDivElement> {
  buckets: AgingBucket[];
  totalOutstanding: number;
  showTrend?: boolean;
  onCollect?: (bucketLabel: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

function getRiskLevel(percentage: number): { label: string; color: string } {
  if (percentage > 30) {
    return { label: "Critical", color: "var(--wl-danger-500)" };
  }
  if (percentage > 20) {
    return { label: "High", color: "var(--wl-warning-500)" };
  }
  if (percentage > 10) {
    return { label: "Medium", color: "var(--wl-info-500)" };
  }
  return { label: "Low", color: "var(--wl-success-500)" };
}

export const AgingBuckets = forwardRef<HTMLDivElement, AgingBucketsProps>(
  ({ buckets, totalOutstanding, showTrend = false, onCollect, className, ...props }, ref) => {
    const [expandedBucket, setExpandedBucket] = useState<string | null>(null);

    // Calculate overall risk
    const overallRisk = buckets.reduce((sum, b) => sum + b.percentage, 0) / buckets.length;
    const riskLevel = getRiskLevel(overallRisk);

    // Calculate collection opportunities (buckets over 60 days)
    const collectionOpportunities = buckets.filter(
      (b) => b.range.includes("61-90") || b.range.includes("90+")
    );

    return (
      <div ref={ref} className={cn("space-y-5", className)} {...props}>
        {/* Stacked bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-wl-text-primary">
              Accounts Receivable Aging
            </h3>
            <span className="text-sm font-semibold text-wl-text-primary">
              Total Outstanding: {formatCurrency(totalOutstanding)}
            </span>
          </div>

          {/* Horizontal stacked bar */}
          <div className="flex items-center gap-1 h-10 bg-wl-bg-surface rounded-lg overflow-hidden border border-wl-border-subtle">
            {buckets.map((bucket) => {
              const widthPercent = (bucket.amount / totalOutstanding) * 100;
              return (
                <Tooltip key={bucket.label}>
                  <TooltipTrigger asChild>
                    <div
                      className="h-full transition-opacity duration-fast cursor-pointer hover:opacity-80"
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: bucket.color,
                        minWidth: widthPercent > 0 ? "2px" : "0px",
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <p className="font-semibold text-wl-text-primary">{bucket.label}</p>
                      <p className="text-wl-text-secondary">{bucket.range}</p>
                      <p className="text-wl-text-primary font-semibold">
                        {formatCurrency(bucket.amount)}
                      </p>
                      <p className="text-wl-text-tertiary">{bucket.percentage.toFixed(1)}% of total</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Legend with amounts */}
        <div className="grid grid-cols-2 gap-3">
          {buckets.map((bucket) => (
            <div
              key={bucket.label}
              className="flex items-start gap-3 p-3 bg-wl-bg-surface rounded-lg border border-wl-border-subtle"
            >
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0 mt-1"
                style={{ backgroundColor: bucket.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-wl-text-primary">{bucket.label}</p>
                <p className="text-xs text-wl-text-tertiary">{bucket.range}</p>
                <p className="text-sm font-semibold text-wl-text-primary mt-1">
                  {formatCurrency(bucket.amount)}
                </p>
                <p className="text-xs text-wl-text-secondary">
                  {bucket.percentage.toFixed(1)}% of total
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Overall Risk Assessment */}
        <div
          className="rounded-lg px-4 py-3 border"
          style={{
            backgroundColor: `color-mix(in srgb, ${riskLevel.color} 8%, transparent)`,
            borderColor: `color-mix(in srgb, ${riskLevel.color} 19%, transparent)`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: riskLevel.color }}
              />
              <span className="text-sm font-semibold text-wl-text-primary">
                Risk Assessment: {riskLevel.label}
              </span>
            </div>
            <span className="text-sm font-bold" style={{ color: riskLevel.color }}>
              {overallRisk.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-wl-bg-overlay rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${Math.min(100, overallRisk * 3)}%`,
                backgroundColor: riskLevel.color,
              }}
            />
          </div>
        </div>

        {/* Collection Opportunities */}
        {collectionOpportunities.length > 0 && (
          <div className="bg-wl-warning-bg/20 border border-wl-warning-500/20 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-wl-warning-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <h4 className="text-sm font-semibold text-wl-text-primary">
                Collection Opportunities
              </h4>
            </div>
            <p className="text-xs text-wl-text-secondary">
              {formatCurrency(
                collectionOpportunities.reduce((sum, b) => sum + b.amount, 0)
              )}{" "}
              outstanding over 60 days
            </p>
            {onCollect && (
              <div className="flex gap-2">
                {collectionOpportunities.map((bucket) => (
                  <Button
                    key={bucket.label}
                    size="sm"
                    variant="secondary"
                    onClick={() => onCollect(bucket.label)}
                    className="text-xs"
                  >
                    Collect {bucket.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detailed breakdown with expand */}
        {showTrend && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
              Trend Analysis
            </p>
            <div className="space-y-1">
              {buckets.map((bucket) => (
                <div key={bucket.label} className="flex items-center gap-2">
                  <span className="text-xs text-wl-text-secondary flex-1">{bucket.label}</span>
                  <div className="w-24 h-1.5 bg-wl-bg-overlay rounded-full overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${bucket.percentage}%`, backgroundColor: bucket.color }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-wl-text-primary w-12 text-right">
                    {bucket.percentage.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

AgingBuckets.displayName = "AgingBuckets";
