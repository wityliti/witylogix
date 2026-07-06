"use client";

import {
  forwardRef,
  useState,
  useRef,
  useEffect,
  type HTMLAttributes,
} from "react";
import { TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FuelGaugeDataPoint {
  date: string;
  fuelSpend: number; // dollars
  mpg: number; // miles per gallon
}

interface FuelGaugeChartProps extends HTMLAttributes<HTMLDivElement> {
  data: FuelGaugeDataPoint[];
  period?: "daily" | "weekly" | "monthly";
  onPeriodChange?: (period: "daily" | "weekly" | "monthly") => void;
  fleetAverage?: number;
  comparisonMode?: boolean;
  vehicleName?: string;
}

interface TooltipData {
  date: string;
  fuelSpend: number;
  mpg: number;
  x: number;
  y: number;
}

const FuelGaugeChart = forwardRef<HTMLDivElement, FuelGaugeChartProps>(
  (
    {
      data,
      period = "weekly",
      onPeriodChange,
      fleetAverage,
      comparisonMode = false,
      vehicleName,
      className,
      ...props
    },
    ref,
  ) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(600);
    const [height] = useState(350);
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    // Responsive width
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver(() => {
        setWidth(container.clientWidth);
      });

      observer.observe(container);
      setWidth(container.clientWidth);

      return () => observer.disconnect();
    }, []);

    if (!data || data.length === 0) {
      return (
        <Card ref={ref} className={cn("p-6", className)} {...props}>
          <p className="text-center text-wl-text-secondary text-sm">
            No fuel data available
          </p>
        </Card>
      );
    }

    const padding = { top: 30, right: 40, bottom: 50, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate scales
    const fuelSpends = data.map((d) => d.fuelSpend);
    const mpgs = data.map((d) => d.mpg);

    const maxFuelSpend = Math.max(...fuelSpends, 100);
    const minMpg = Math.min(...mpgs, 10);
    const maxMpg = Math.max(...mpgs, 30);

    const xScale = (index: number) =>
      padding.left + (index / (data.length - 1 || 1)) * chartWidth;

    const yScaleFuel = (value: number) =>
      height - padding.bottom - (value / maxFuelSpend) * chartHeight;

    const yScaleMpg = (value: number) =>
      height -
      padding.bottom -
      ((value - minMpg) / (maxMpg - minMpg)) * chartHeight;

    // Generate bar positions
    const bars = data.map((d, i) => ({
      x: xScale(i),
      width: Math.max(chartWidth / (data.length * 2), 12),
      height: (d.fuelSpend / maxFuelSpend) * chartHeight,
      value: d.fuelSpend,
    }));

    // Generate line path for MPG
    const linePath = data
      .map((d, i) => `${xScale(i)},${yScaleMpg(d.mpg)}`)
      .join(" L ");

    // Stats
    const totalSpend = fuelSpends.reduce((a, b) => a + b, 0);
    const avgFuel = totalSpend / data.length;
    const avgMpg = mpgs.reduce((a, b) => a + b, 0) / data.length;
    const trend =
      data.length > 1 ? ((mpgs[mpgs.length - 1] - mpgs[0]) / mpgs[0]) * 100 : 0;

    return (
      <Card ref={ref} className={cn("p-6 space-y-6", className)} {...props}>
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-wl-text-primary">
                Fuel Spend vs Efficiency
              </h3>
              {vehicleName && (
                <p className="text-xs text-wl-text-secondary">{vehicleName}</p>
              )}
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-2 bg-wl-bg-surface rounded-lg p-1">
              {(["daily", "weekly", "monthly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => onPeriodChange?.(p)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-all",
                    period === p
                      ? "bg-wl-primary-500/20 text-wl-primary-400"
                      : "text-wl-text-secondary hover:text-wl-text-primary",
                  )}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-2 rounded-md bg-wl-bg-surface">
              <p className="text-xs text-wl-text-secondary">Total Spend</p>
              <p className="text-sm font-semibold text-wl-text-primary">
                ${totalSpend.toFixed(2)}
              </p>
            </div>
            <div className="p-2 rounded-md bg-wl-bg-surface">
              <p className="text-xs text-wl-text-secondary">Avg Spend</p>
              <p className="text-sm font-semibold text-wl-text-primary">
                ${avgFuel.toFixed(2)}
              </p>
            </div>
            <div className="p-2 rounded-md bg-wl-bg-surface">
              <p className="text-xs text-wl-text-secondary">Avg Efficiency</p>
              <p className="text-sm font-semibold text-wl-text-primary">
                {avgMpg.toFixed(1)} MPG
              </p>
            </div>
            <div className="p-2 rounded-md bg-wl-bg-surface">
              <p className="text-xs text-wl-text-secondary">MPG Trend</p>
              <p
                className={cn(
                  "text-sm font-semibold flex items-center gap-1",
                  trend > 0 ? "text-wl-success-400" : "text-wl-danger-400",
                )}
              >
                {trend > 0 ? "+" : ""}
                {trend.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div
          ref={containerRef}
          className="relative h-72 bg-wl-bg-surface rounded-lg p-4"
        >
          <svg
            ref={svgRef}
            width={width - 32}
            height={height}
            className="relative z-0"
          >
            {/* Y-axis labels - Fuel Spend (left) */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const value = maxFuelSpend * ratio;
              const y = height - padding.bottom - ratio * chartHeight;
              return (
                <g key={`fuel-label-${ratio}`}>
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="text-xs fill-wl-text-secondary"
                  >
                    ${value.toFixed(0)}
                  </text>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="var(--wl-border-subtle)"
                    strokeWidth={1}
                    strokeDasharray={ratio === 0 ? "0" : "4"}
                    opacity={0.3}
                  />
                </g>
              );
            })}

            {/* Y-axis labels - MPG (right) */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const value = minMpg + (maxMpg - minMpg) * ratio;
              const y = height - padding.bottom - ratio * chartHeight;
              return (
                <text
                  key={`mpg-label-${ratio}`}
                  x={width - padding.right + 10}
                  y={y + 4}
                  textAnchor="start"
                  className="text-xs fill-wl-text-secondary"
                >
                  {value.toFixed(1)} MPG
                </text>
              );
            })}

            {/* Bars (Fuel Spend) */}
            {bars.map((bar, i) => (
              <rect
                key={`bar-${i}`}
                x={bar.x - bar.width / 2}
                y={height - padding.bottom - bar.height}
                width={bar.width}
                height={bar.height}
                fill="var(--wl-primary-500)"
                opacity={hoveredIndex === i ? 1 : 0.6}
                style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                onMouseEnter={(e) => {
                  setHoveredIndex(i);
                  const rect = (e.target as SVGElement).getBoundingClientRect();
                  const container =
                    containerRef.current?.getBoundingClientRect();
                  if (container) {
                    setTooltip({
                      date: data[i].date,
                      fuelSpend: data[i].fuelSpend,
                      mpg: data[i].mpg,
                      x: rect.left - container.left,
                      y: rect.top - container.top,
                    });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredIndex(null);
                  setTooltip(null);
                }}
              />
            ))}

            {/* Line (MPG Trend) */}
            <polyline
              points={linePath}
              fill="none"
              stroke="var(--wl-warning-400)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Line points */}
            {data.map((d, i) => (
              <circle
                key={`point-${i}`}
                cx={xScale(i)}
                cy={yScaleMpg(d.mpg)}
                r={3}
                fill="var(--wl-warning-400)"
                opacity={hoveredIndex === i ? 1 : 0.7}
              />
            ))}

            {/* X-axis labels */}
            {data.map((d, i) => {
              if (data.length <= 7 || i % Math.ceil(data.length / 7) === 0) {
                return (
                  <text
                    key={`date-${i}`}
                    x={xScale(i)}
                    y={height - padding.bottom + 20}
                    textAnchor="middle"
                    className="text-xs fill-wl-text-secondary"
                  >
                    {new Date(d.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </text>
                );
              }
              return null;
            })}

            {/* Axes */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={height - padding.bottom}
              stroke="var(--wl-border-subtle)"
              strokeWidth={1}
            />
            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              stroke="var(--wl-border-subtle)"
              strokeWidth={1}
            />
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-2 shadow-lg text-xs z-10"
              style={{
                left: Math.min(tooltip.x + 10, width - 150),
                top: tooltip.y - 70,
                pointerEvents: "none",
              }}
            >
              <p className="text-wl-text-secondary">
                {new Date(tooltip.date).toLocaleDateString()}
              </p>
              <p className="font-semibold text-wl-text-primary">
                Fuel: ${tooltip.fuelSpend.toFixed(2)}
              </p>
              <p className="text-wl-warning-400">
                Efficiency: {tooltip.mpg.toFixed(1)} MPG
              </p>
              {comparisonMode && fleetAverage && (
                <p className="text-wl-text-secondary mt-1">
                  Fleet Avg: {fleetAverage.toFixed(1)} MPG
                </p>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-wl-primary-500" />
            <span className="text-wl-text-secondary">Fuel Spend (bars)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-wl-warning-400" />
            <span className="text-wl-text-secondary">
              MPG Efficiency (line)
            </span>
          </div>
        </div>
      </Card>
    );
  },
);

FuelGaugeChart.displayName = "FuelGaugeChart";

export { FuelGaugeChart };
export type { FuelGaugeChartProps, FuelGaugeDataPoint };
