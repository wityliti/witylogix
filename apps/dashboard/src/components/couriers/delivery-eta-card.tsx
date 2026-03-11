"use client";

import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Badge, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui";
import type { DeliveryETA } from "../invoicing/types";

interface DeliveryETACardProps extends HTMLAttributes<HTMLDivElement> {
  eta: DeliveryETA;
  lastUpdated?: string;
  onRefresh?: () => void;
  showFullDetails?: boolean;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${Math.max(1, Math.round(minutes))}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${Math.round(mins)}m`;
}

export const DeliveryETACard = forwardRef<HTMLDivElement, DeliveryETACardProps>(
  ({ eta, lastUpdated, onRefresh, showFullDetails = true, className, ...props }, ref) => {
    const confidenceRange = eta.confidenceInterval.high - eta.confidenceInterval.low;
    const confidencePercent = Math.max(0, Math.min(100, 100 - confidenceRange / 60 * 100));

    // Calculate ETA status indicator
    const isOnTrack = confidencePercent > 70 && eta.trafficCondition !== "heavy" && eta.weatherImpact === "none";
    const isAtRisk = confidencePercent < 40 || eta.trafficCondition === "heavy" || eta.weatherImpact === "major";

    return (
      <div
        ref={ref}
        className={cn(
          "bg-wl-bg-surface border rounded-lg p-6",
          "space-y-6 transition-all duration-300",
          isOnTrack && "border-wl-success-500/30 shadow-sm shadow-wl-success-500/10",
          isAtRisk && "border-wl-danger-500/30 shadow-sm shadow-wl-danger-500/10",
          !isOnTrack && !isAtRisk && "border-wl-border-subtle",
          className
        )}
        {...props}
      >
        {/* Header with status and refresh */}
        {(lastUpdated || onRefresh) && (
          <div className="flex items-center justify-between -mt-1 -mb-2">
            <div className="flex items-center gap-2">
              {isOnTrack && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-wl-success-500 animate-pulse" />
                  <span className="text-xs font-semibold text-wl-success-400">On Track</span>
                </div>
              )}
              {isAtRisk && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-wl-danger-500 animate-pulse" />
                  <span className="text-xs font-semibold text-wl-danger-400">At Risk</span>
                </div>
              )}
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="text-xs px-2 py-1 rounded hover:bg-wl-bg-overlay transition-colors"
                title="Refresh ETA"
              >
                <svg className="w-3 h-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Main ETA display */}
        <div className="text-center space-y-3">
          <p className="text-sm text-wl-text-secondary uppercase tracking-wider font-semibold">
            Estimated Delivery
          </p>
          <div className="text-5xl font-bold text-wl-primary-400">
            {formatMinutes(eta.estimatedMinutes)}
          </div>

          {/* Confidence interval */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="text-xs text-wl-text-secondary">
              {formatMinutes(eta.confidenceInterval.low)} -
            </span>
            <span className="text-xs font-semibold text-wl-primary-400">
              {formatMinutes(eta.confidenceInterval.high)}
            </span>
          </div>

          {/* Confidence indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="pt-2 cursor-help">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-wl-bg-overlay rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        confidencePercent > 70
                          ? "bg-wl-success-500"
                          : confidencePercent > 40
                            ? "bg-wl-warning-500"
                            : "bg-wl-danger-500"
                      )}
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-wl-text-secondary whitespace-nowrap">
                    {Math.round(confidencePercent)}%
                  </span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Confidence interval width: {confidenceRange} minutes</p>
              <p className="text-xs mt-1 text-wl-text-secondary">
                Wider interval = less accurate prediction
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* ML Model contribution */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
              Model Contribution
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <svg className="w-4 h-4 text-wl-text-tertiary cursor-help" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              </TooltipTrigger>
              <TooltipContent>
                How each ML model contributes to the ETA prediction
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="space-y-2">
            {eta.mlModelContribution.map((model) => (
              <div key={model.model} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-wl-text-secondary">{model.model}</span>
                  <span className="font-semibold text-wl-text-primary">
                    {Math.round(model.contribution)}%
                  </span>
                </div>
                <div className="h-1.5 bg-wl-bg-overlay rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-primary-600 rounded-full"
                    style={{ width: `${model.contribution}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conditions */}
        <div className="grid grid-cols-2 gap-3">
          {/* Traffic condition */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
              Traffic
            </p>
            <Badge
              variant={
                eta.trafficCondition === "clear"
                  ? "success"
                  : eta.trafficCondition === "moderate"
                    ? "warning"
                    : "danger"
              }
              className="w-full justify-center"
            >
              {eta.trafficCondition.charAt(0).toUpperCase() + eta.trafficCondition.slice(1)}
            </Badge>
          </div>

          {/* Weather impact */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
              Weather
            </p>
            <Badge
              variant={
                eta.weatherImpact === "none"
                  ? "success"
                  : eta.weatherImpact === "minor"
                    ? "warning"
                    : "danger"
              }
              className="w-full justify-center"
            >
              {eta.weatherImpact.charAt(0).toUpperCase() + eta.weatherImpact.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Historical accuracy */}
        <div className="bg-wl-primary-500/10 border border-wl-primary-500/20 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-wl-text-secondary">Historical Accuracy</p>
            <span className="text-sm font-bold text-wl-primary-400">
              {eta.historicalAccuracy.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-wl-primary-500/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-success-500"
              style={{ width: `${eta.historicalAccuracy}%` }}
            />
          </div>
          <p className="text-xs text-wl-text-tertiary mt-2">
            Based on {Math.round(eta.historicalAccuracy * 100 / 100)} similar deliveries
          </p>
        </div>

        {/* Info section */}
        {showFullDetails && (
          <div className="bg-wl-bg-overlay rounded-lg px-3 py-2 space-y-1">
            <p className="text-xs text-wl-text-secondary">
              <span className="font-semibold text-wl-text-primary">
                ✓ Green light:
              </span>
              {" "}All factors favor on-time delivery
            </p>
            <p className="text-xs text-wl-text-secondary">
              <span className="font-semibold text-wl-text-primary">
                ⚠ Yellow light:
              </span>
              {" "}Minor delays possible
            </p>
            <p className="text-xs text-wl-text-secondary">
              <span className="font-semibold text-wl-text-primary">
                ✗ Red light:
              </span>
              {" "}Significant delay expected
            </p>
          </div>
        )}

        {/* Last updated timestamp */}
        {lastUpdated && (
          <div className="text-center text-xs text-wl-text-tertiary border-t border-wl-border-subtle pt-3">
            Updated {new Date(lastUpdated).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
    );
  }
);

DeliveryETACard.displayName = "DeliveryETACard";

export { DeliveryETACard };
