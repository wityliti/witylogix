"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface RateData {
  carrier: string;
  contractedRate: number;
  spotRate: number;
  marketAvg: number;
  savings: number;
  trendPoints: number[];
}

export interface RateComparisonCardProps {
  lane: string;
  origin: string;
  destination: string;
  rates: RateData[];
  bestCarrier?: string;
  onAward?: (carrier: string) => void;
  className?: string;
}

/**
 * Rate Comparison Card Component
 * Displays freight rates across carriers with sparkline trends
 * Color-coded by market comparison and expandable accessorials
 */
export function RateComparisonCard({
  lane,
  origin,
  destination,
  rates,
  bestCarrier,
  onAward,
  className,
}: RateComparisonCardProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [view, setView] = useState<"contracted" | "spot">("contracted");

  // Calculate if rate is below market
  const isBelowMarket = (rate: RateData, rateType: "contracted" | "spot") => {
    const current = rateType === "contracted" ? rate.contractedRate : rate.spotRate;
    return current < rate.marketAvg;
  };

  // Get color class based on market comparison
  const getRateColor = (rate: RateData, rateType: "contracted" | "spot") => {
    if (isBelowMarket(rate, rateType)) {
      return "text-wl-success-400";
    }
    return "text-wl-danger-400";
  };

  // SVG sparkline for trend visualization
  const renderSparkline = (points: number[]) => {
    if (points.length < 2) return null;

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 60;
    const height = 24;
    const padding = 2;

    const pathData = points
      .map((point, i) => {
        const x = padding + (i / (points.length - 1)) * (width - padding * 2);
        const y = height - padding - ((point - min) / range) * (height - padding * 2);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="flex-shrink-0"
      >
        <path
          d={pathData}
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={width - padding - 2}
          cy={height - padding - ((points[points.length - 1] - min) / range) * (height - padding * 2)}
          r="1.5"
          fill="currentColor"
        />
      </svg>
    );
  };

  const sortedRates = [...rates].sort((a, b) => {
    const aRate = view === "contracted" ? a.contractedRate : a.spotRate;
    const bRate = view === "contracted" ? b.contractedRate : b.spotRate;
    return aRate - bRate;
  });

  return (
    <div
      className={cn(
        "rounded-lg border border-wl-border-default bg-wl-bg-elevated p-4 space-y-4",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-wl-text-primary">{lane}</h3>
          <p className="text-xs text-wl-text-secondary mt-1">
            {origin} → {destination}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0 ml-4">
          <button
            onClick={() => setView("contracted")}
            className={cn(
              "text-xs px-2 py-1 rounded transition-colors",
              view === "contracted"
                ? "bg-wl-primary-500/20 text-wl-primary-400"
                : "text-wl-text-secondary hover:bg-wl-bg-secondary"
            )}
          >
            Contracted
          </button>
          <button
            onClick={() => setView("spot")}
            className={cn(
              "text-xs px-2 py-1 rounded transition-colors",
              view === "spot"
                ? "bg-wl-primary-500/20 text-wl-primary-400"
                : "text-wl-text-secondary hover:bg-wl-bg-secondary"
            )}
          >
            Spot
          </button>
        </div>
      </div>

      {/* Table Headers */}
      <div className="border-t border-wl-border-default pt-3">
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-wl-text-secondary mb-3">
          <div className="col-span-3">Carrier</div>
          <div className="col-span-1.5">Rate</div>
          <div className="col-span-1.5">Mkt Avg</div>
          <div className="col-span-1.5">Savings %</div>
          <div className="col-span-3 text-right pr-2">Trend</div>
        </div>

        {/* Rate Rows */}
        <div className="space-y-2">
          {sortedRates.map((rate) => {
            const currentRate = view === "contracted" ? rate.contractedRate : rate.spotRate;
            const below = isBelowMarket(rate, view);
            const savings = ((rate.marketAvg - currentRate) / rate.marketAvg) * 100;
            const isAward = rate.carrier === bestCarrier;

            return (
              <div key={rate.carrier}>
                <div
                  className={cn(
                    "grid grid-cols-12 gap-2 items-center p-2 rounded-md transition-colors cursor-pointer",
                    isAward
                      ? "bg-wl-success-500/10 border border-wl-success-500/30"
                      : "hover:bg-wl-bg-secondary border border-transparent",
                    expanded === rate.carrier && "border-wl-border-default"
                  )}
                  onClick={() =>
                    setExpanded(expanded === rate.carrier ? null : rate.carrier)
                  }
                >
                  {/* Carrier */}
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-xs font-medium text-wl-text-primary">
                          {rate.carrier}
                        </p>
                        {isAward && (
                          <p className="text-xs text-wl-success-400 mt-0.5">
                            ⭐ Award
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Current Rate */}
                  <div className="col-span-1.5">
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        getRateColor(rate, view)
                      )}
                    >
                      ${currentRate.toFixed(2)}
                    </p>
                  </div>

                  {/* Market Avg */}
                  <div className="col-span-1.5">
                    <p className="text-xs text-wl-text-secondary">
                      ${rate.marketAvg.toFixed(2)}
                    </p>
                  </div>

                  {/* Savings % */}
                  <div className="col-span-1.5">
                    <p
                      className={cn(
                        "text-xs font-medium",
                        below ? "text-wl-success-400" : "text-wl-danger-400"
                      )}
                    >
                      {below ? "+" : "-"}
                      {Math.abs(savings).toFixed(1)}%
                    </p>
                  </div>

                  {/* Sparkline Trend */}
                  <div className="col-span-3 flex justify-end pr-2">
                    <div className={getRateColor(rate, view)}>
                      {renderSparkline(rate.trendPoints)}
                    </div>
                  </div>
                </div>

                {/* Expanded Accessorial Details */}
                {expanded === rate.carrier && (
                  <div className="bg-wl-bg-secondary rounded-md mt-1 p-3 text-xs border border-wl-border-default ml-2">
                    <p className="font-medium text-wl-text-primary mb-2">
                      Accessorials
                    </p>
                    <div className="space-y-1 text-wl-text-secondary">
                      <div className="flex justify-between">
                        <span>Fuel Surcharge</span>
                        <span>+3.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Detention</span>
                        <span>+$25/day</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Hazmat</span>
                        <span>+$150</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Residential Delivery</span>
                        <span>+$35</span>
                      </div>
                    </div>

                    {/* Award Button */}
                    {!isAward && onAward && (
                      <button
                        onClick={() => onAward(rate.carrier)}
                        className="mt-3 w-full text-xs px-3 py-1.5 rounded bg-wl-primary-500/20 text-wl-primary-400 hover:bg-wl-primary-500/30 transition-colors font-medium"
                      >
                        Award Freight
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="border-t border-wl-border-default pt-3 flex justify-between text-xs">
        <div>
          <p className="text-wl-text-secondary">Best Rate</p>
          <p className="text-wl-success-400 font-semibold mt-1">
            ${Math.min(...rates.map((r) => view === "contracted" ? r.contractedRate : r.spotRate)).toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-wl-text-secondary">Market Avg</p>
          <p className="text-wl-text-primary font-semibold mt-1">
            ${(rates.reduce((sum, r) => sum + r.marketAvg, 0) / rates.length).toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-wl-text-secondary">Potential Savings</p>
          <p className="text-wl-success-400 font-semibold mt-1">
            {(
              ((Math.max(...rates.map((r) => r.marketAvg)) -
                Math.min(...rates.map((r) => view === "contracted" ? r.contractedRate : r.spotRate))) /
                Math.max(...rates.map((r) => r.marketAvg))) *
              100
            ).toFixed(1)}
            %
          </p>
        </div>
      </div>
    </div>
  );
}
