"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingDown,
  TrendingUp,
  Fuel,
  DollarSign,
  BarChart3,
  Filter,
  Calendar,
} from "lucide-react";

interface FuelDataPoint {
  date: Date;
  gallons: number;
  cost: number;
  vehicle?: string;
  driver?: string;
  mpg?: number;
}

interface FleetFuelChartProps {
  data?: FuelDataPoint[];
  groupBy?: "vehicle" | "driver" | "none";
  comparisonEnabled?: boolean;
  onComparisonChange?: (enabled: boolean) => void;
  className?: string;
}

const defaultData: FuelDataPoint[] = [
  {
    date: new Date("2025-03-01"),
    gallons: 245,
    cost: 820,
    vehicle: "TR-2401",
    driver: "John Smith",
    mpg: 6.8,
  },
  {
    date: new Date("2025-03-02"),
    gallons: 218,
    cost: 728,
    vehicle: "TR-2405",
    driver: "Maria Garcia",
    mpg: 7.2,
  },
  {
    date: new Date("2025-03-03"),
    gallons: 251,
    cost: 835,
    vehicle: "TR-2312",
    driver: "Robert Wilson",
    mpg: 6.5,
  },
  {
    date: new Date("2025-03-04"),
    gallons: 232,
    cost: 774,
    vehicle: "TR-2401",
    driver: "John Smith",
    mpg: 6.9,
  },
  {
    date: new Date("2025-03-05"),
    gallons: 256,
    cost: 844,
    vehicle: "TR-2405",
    driver: "Maria Garcia",
    mpg: 6.3,
  },
  {
    date: new Date("2025-03-06"),
    gallons: 240,
    cost: 804,
    vehicle: "TR-2312",
    driver: "Robert Wilson",
    mpg: 7.1,
  },
  {
    date: new Date("2025-03-07"),
    gallons: 227,
    cost: 752,
    vehicle: "TR-2401",
    driver: "John Smith",
    mpg: 7.3,
  },
  {
    date: new Date("2025-03-08"),
    gallons: 248,
    cost: 812,
    vehicle: "TR-2405",
    driver: "Maria Garcia",
    mpg: 6.6,
  },
  {
    date: new Date("2025-03-09"),
    gallons: 235,
    cost: 784,
    vehicle: "TR-2312",
    driver: "Robert Wilson",
    mpg: 7.0,
  },
  {
    date: new Date("2025-03-10"),
    gallons: 260,
    cost: 858,
    vehicle: "TR-2401",
    driver: "John Smith",
    mpg: 6.4,
  },
];

export function FleetFuelChart({
  data = defaultData,
  groupBy = "none",
  comparisonEnabled = false,
  onComparisonChange,
  className,
}: FleetFuelChartProps) {
  const [selectedGroupBy, setSelectedGroupBy] = useState<
    "vehicle" | "driver" | "none"
  >(groupBy);
  const [showComparison, setShowComparison] = useState(comparisonEnabled);
  const [dateRange, setDateRange] = useState<"week" | "month" | "custom">(
    "month",
  );

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  const metrics = useMemo(() => {
    const totalGallons = sortedData.reduce((sum, d) => sum + d.gallons, 0);
    const totalCost = sortedData.reduce((sum, d) => sum + d.cost, 0);
    const avgMpg =
      sortedData
        .filter((d) => d.mpg)
        .reduce((sum, d) => sum + (d.mpg || 0), 0) /
      sortedData.filter((d) => d.mpg).length;
    const costPerMile =
      sortedData.length > 0 ? totalCost / (totalGallons * (avgMpg || 6.8)) : 0;

    return {
      totalGallons: totalGallons.toFixed(1),
      totalCost: totalCost.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      avgMpg: avgMpg.toFixed(2),
      costPerMile: costPerMile.toFixed(2),
    };
  }, [sortedData]);

  // Calculate chart dimensions
  const chartWidth = 600;
  const chartHeight = 250;
  const padding = { top: 20, right: 40, bottom: 40, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Scale data
  const maxGallons = Math.max(...sortedData.map((d) => d.gallons));
  const maxCost = Math.max(...sortedData.map((d) => d.cost));
  const minDate = sortedData[0]?.date || new Date();
  const maxDate = sortedData[sortedData.length - 1]?.date || new Date();
  const dateRange_ms = maxDate.getTime() - minDate.getTime();

  const scaleGallons = (gallons: number) => {
    return padding.top + innerHeight - (gallons / maxGallons) * innerHeight;
  };

  const scaleCost = (cost: number) => {
    return padding.top + innerHeight - (cost / maxCost) * innerHeight;
  };

  const scaleX = (date: Date) => {
    const ratio = (date.getTime() - minDate.getTime()) / dateRange_ms;
    return padding.left + ratio * innerWidth;
  };

  // Generate path data
  const gallonsPath = sortedData
    .map(
      (d, idx) =>
        `${idx === 0 ? "M" : "L"} ${scaleX(d.date)} ${scaleGallons(d.gallons)}`,
    )
    .join(" ");

  const costPath = sortedData
    .map(
      (d, idx) =>
        `${idx === 0 ? "M" : "L"} ${scaleX(d.date)} ${scaleCost(d.cost)}`,
    )
    .join(" ");

  // Trend calculation
  const firstHalf = sortedData.slice(0, Math.floor(sortedData.length / 2));
  const secondHalf = sortedData.slice(Math.floor(sortedData.length / 2));
  const firstHalfAvgCost =
    firstHalf.reduce((sum, d) => sum + d.cost, 0) / firstHalf.length;
  const secondHalfAvgCost =
    secondHalf.reduce((sum, d) => sum + d.cost, 0) / secondHalf.length;
  const costTrend = secondHalfAvgCost - firstHalfAvgCost;
  const trendPercentage = ((costTrend / firstHalfAvgCost) * 100).toFixed(1);

  const handleGroupByChange = (newGroupBy: typeof selectedGroupBy) => {
    setSelectedGroupBy(newGroupBy);
  };

  const handleComparisonToggle = () => {
    setShowComparison(!showComparison);
    onComparisonChange?.(!showComparison);
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-wl-bg-surface border border-wl-border-subtle rounded-lg overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-wl-border-subtle bg-wl-bg-overlay">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-wl-primary-500" />
            <div>
              <h3 className="text-base font-semibold text-wl-text-primary">
                Fleet Fuel Analytics
              </h3>
              <p className="text-xs text-wl-text-secondary mt-1">
                Consumption and cost trends
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
              className="px-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded text-sm text-wl-text-primary focus:outline-none focus:border-wl-primary-500"
            >
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-wl-text-secondary uppercase mb-2 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Group By
            </p>
            <div className="flex gap-2">
              {[
                { key: "none", label: "All Vehicles" },
                { key: "vehicle", label: "By Vehicle" },
                { key: "driver", label: "By Driver" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() =>
                    handleGroupByChange(key as typeof selectedGroupBy)
                  }
                  className={cn(
                    "px-3 py-1 rounded text-xs font-medium transition-all",
                    selectedGroupBy === key
                      ? "bg-wl-primary-500 text-white"
                      : "bg-wl-bg-surface border border-wl-border-subtle text-wl-text-secondary hover:border-wl-border-default",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="comparison"
              checked={showComparison}
              onChange={handleComparisonToggle}
              className="w-4 h-4"
            />
            <label
              htmlFor="comparison"
              className="text-sm text-wl-text-secondary cursor-pointer"
            >
              Compare with previous period
            </label>
          </div>
        </div>
      </div>

      {/* Metrics summary */}
      <div className="grid grid-cols-4 gap-3 p-4 border-b border-wl-border-subtle bg-wl-bg-overlay">
        <div className="p-3 bg-wl-bg-surface rounded-lg">
          <p className="text-xs text-wl-text-secondary mb-1 flex items-center gap-1">
            <Fuel className="w-3 h-3" />
            Total Gallons
          </p>
          <p className="text-lg font-bold text-wl-text-primary">
            {metrics.totalGallons}
          </p>
          <p className="text-xs text-wl-text-secondary mt-1">gal</p>
        </div>

        <div className="p-3 bg-wl-bg-surface rounded-lg">
          <p className="text-xs text-wl-text-secondary mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            Total Cost
          </p>
          <p className="text-lg font-bold text-wl-text-primary">
            ${metrics.totalCost}
          </p>
          <p className="text-xs text-wl-text-secondary mt-1">USD</p>
        </div>

        <div className="p-3 bg-wl-bg-surface rounded-lg">
          <p className="text-xs text-wl-text-secondary mb-1">Avg MPG</p>
          <p className="text-lg font-bold text-wl-text-primary">
            {metrics.avgMpg}
          </p>
          <p className="text-xs text-wl-success-400 mt-1">+0.2 trending</p>
        </div>

        <div className="p-3 bg-wl-bg-surface rounded-lg">
          <p className="text-xs text-wl-text-secondary mb-1">Cost per Mile</p>
          <p className="text-lg font-bold text-wl-text-primary">
            ${metrics.costPerMile}
          </p>
          <p
            className={cn(
              "text-xs mt-1 flex items-center gap-1",
              costTrend < 0 ? "text-wl-success-400" : "text-wl-danger-400",
            )}
          >
            {costTrend < 0 ? (
              <>
                <TrendingDown className="w-3 h-3" />
                {Math.abs(parseFloat(trendPercentage))}% improvement
              </>
            ) : (
              <>
                <TrendingUp className="w-3 h-3" />
                {trendPercentage}% increase
              </>
            )}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 p-4 overflow-auto">
        <svg
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="overflow-visible"
          style={{ minHeight: `${chartHeight}px` }}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={`grid-y-${ratio}`}
              x1={padding.left}
              y1={padding.top + ratio * innerHeight}
              x2={padding.left + innerWidth}
              y2={padding.top + ratio * innerHeight}
              stroke="var(--wl-border-subtle)"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
          ))}

          {/* Y-axis labels - Gallons */}
          {[0, 0.5, 1].map((ratio) => (
            <text
              key={`label-gallons-${ratio}`}
              x={padding.left - 10}
              y={padding.top + (1 - ratio) * innerHeight + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--wl-text-secondary)"
            >
              {Math.round(ratio * maxGallons)}
            </text>
          ))}

          {/* Y-axis labels - Cost */}
          {[0, 0.5, 1].map((ratio) => (
            <text
              key={`label-cost-${ratio}`}
              x={padding.left + innerWidth + 10}
              y={padding.top + (1 - ratio) * innerHeight + 4}
              textAnchor="start"
              fontSize="10"
              fill="var(--wl-text-secondary)"
            >
              ${Math.round(ratio * maxCost)}
            </text>
          ))}

          {/* Gallons area fill */}
          <path
            d={`${gallonsPath} L ${padding.left + innerWidth} ${padding.top + innerHeight} L ${padding.left} ${padding.top + innerHeight} Z`}
            fill="var(--wl-primary-400)"
            fillOpacity="0.1"
          />

          {/* Gallons line */}
          <path
            d={gallonsPath}
            fill="none"
            stroke="var(--wl-primary-500)"
            strokeWidth="2"
          />

          {/* Cost line */}
          <path
            d={costPath}
            fill="none"
            stroke="var(--wl-warning-500)"
            strokeWidth="2"
            strokeDasharray="4,4"
          />

          {/* Data points */}
          {sortedData.map((d, idx) => (
            <g key={`point-${idx}`}>
              <circle
                cx={scaleX(d.date)}
                cy={scaleGallons(d.gallons)}
                r="3"
                fill="var(--wl-primary-500)"
              />
              <circle
                cx={scaleX(d.date)}
                cy={scaleCost(d.cost)}
                r="3"
                fill="var(--wl-warning-500)"
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-wl-border-subtle bg-wl-bg-overlay flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-wl-primary-500" />
          <span className="text-wl-text-secondary">Gallons per day</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: "var(--wl-warning-500)" }}
          />
          <span className="text-wl-text-secondary">Cost per day</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="default" className="text-xs">
            Live data
          </Badge>
        </div>
      </div>
    </div>
  );
}
