"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, TrendingUpIcon, TrendingDownIcon, ActivityIcon } from "lucide-react";

interface VitalReading {
  timestamp: Date;
  heartRate: number;
  bpSystolic: number;
  bpDiastolic: number;
  temperature: number;
  spO2: number;
  weight: number;
}

interface VitalsChartProps {
  readings?: VitalReading[];
  onDateRangeChange?: (start: Date, end: Date) => void;
  className?: string;
}


interface VitalMetric {
  name: string;
  unit: string;
  normalMin: number;
  normalMax: number;
  color: string;
  value: number;
  trend: "up" | "down" | "stable";
  change: number;
}

const getMetricsFromLatest = (latest: VitalReading): VitalMetric[] => [
  { name: "Heart Rate", unit: "bpm", normalMin: 60, normalMax: 100, color: "wl-primary-400", value: latest.heartRate, trend: "stable", change: 0 },
  { name: "BP Systolic", unit: "mmHg", normalMin: 90, normalMax: 120, color: "wl-info-400", value: latest.bpSystolic, trend: "stable", change: 0 },
  { name: "BP Diastolic", unit: "mmHg", normalMin: 60, normalMax: 80, color: "wl-info-400", value: latest.bpDiastolic, trend: "stable", change: 0 },
  { name: "Temperature", unit: "°F", normalMin: 97, normalMax: 99, color: "wl-warning-400", value: latest.temperature, trend: "stable", change: 0 },
  { name: "SpO2", unit: "%", normalMin: 95, normalMax: 100, color: "wl-success-400", value: latest.spO2, trend: "stable", change: 0 },
  { name: "Weight", unit: "lbs", normalMin: 150, normalMax: 180, color: "wl-danger-400", value: latest.weight, trend: "stable", change: 0 },
];

const isNormal = (metric: VitalMetric): boolean => {
  return metric.value >= metric.normalMin && metric.value <= metric.normalMax;
};

const getChartDimensions = (metric: string): { min: number; max: number } => {
  switch (metric) {
    case "Heart Rate":
      return { min: 50, max: 110 };
    case "BP Systolic":
      return { min: 100, max: 160 };
    case "BP Diastolic":
      return { min: 50, max: 110 };
    case "Temperature":
      return { min: 96, max: 102 };
    case "SpO2":
      return { min: 90, max: 100 };
    case "Weight":
      return { min: 155, max: 175 };
    default:
      return { min: 0, max: 100 };
  }
};

const VitalsChart = ({
  readings = [],
  onDateRangeChange,
  className,
}: VitalsChartProps) => {
  const [timeRange, setTimeRange] = useState<"7d" | "14d" | "30d">("30d");
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

  const latestReading = readings[readings.length - 1] ?? readings[0];
  const metrics = latestReading ? getMetricsFromLatest(latestReading) : [];

  const now = Date.now();
  const rangeMs =
    timeRange === "7d"
      ? 7 * 24 * 60 * 60 * 1000
      : timeRange === "14d"
        ? 14 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

  const filteredReadings = readings.filter(
    (r) => now - r.timestamp.getTime() <= rangeMs
  );

  return (
    <Card className={cn("w-full p-6", className)}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-wl-text-primary mb-4">
          Vital Signs Chart
        </h3>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-wl-text-tertiary">Time Range:</span>
          {(["7d", "14d", "30d"] as const).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setTimeRange(range);
                if (onDateRangeChange) {
                  const end = new Date();
                  const start = new Date(
                    end.getTime() -
                      (range === "7d" ? 7 : range === "14d" ? 14 : 30) *
                        24 *
                        60 *
                        60 *
                        1000
                  );
                  onDateRangeChange(start, end);
                }
              }}
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {metrics.map((metric) => {
          const isExpanded = expandedMetric === metric.name;
          const dims = getChartDimensions(metric.name);
          const normalRange = (
            ((metric.normalMax - metric.normalMin) / (dims.max - dims.min)) *
            100
          ).toFixed(1);
          const normalStart = (
            ((metric.normalMin - dims.min) / (dims.max - dims.min)) *
            100
          ).toFixed(1);

          return (
            <div
              key={metric.name}
              className="p-3 rounded-lg border border-wl-border-default bg-wl-bg-overlay"
            >
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() =>
                  setExpandedMetric(isExpanded ? null : metric.name)
                }
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-1 h-8 rounded bg-${metric.color}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-wl-text-primary">
                      {metric.name}
                    </p>
                    <p className="text-xs text-wl-text-tertiary">{metric.unit}</p>
                  </div>
                </div>

                <div className="flex items-end gap-4">
                  <div className="text-right">
                    <p className="text-lg font-bold text-wl-text-primary">
                      {metric.value.toFixed(1)}
                    </p>
                    <div
                      className={cn(
                        "flex items-center gap-1 text-xs font-medium",
                        metric.change > 0 ? "text-wl-danger-400" : "text-wl-success-400"
                      )}
                    >
                      {metric.trend === "up" && (
                        <TrendingUpIcon className="w-3 h-3" />
                      )}
                      {metric.trend === "down" && (
                        <TrendingDownIcon className="w-3 h-3" />
                      )}
                      {metric.change !== 0 && (
                        <span>
                          {metric.change > 0 ? "+" : ""}
                          {metric.change}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button variant="ghost" size="sm" className="flex-shrink-0">
                    <ChevronDownIcon
                      className={cn(
                        "w-4 h-4 transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </Button>
                </div>
              </div>

              <div className="mt-2 relative h-1.5 bg-wl-bg-surface rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-wl-success-400/30"
                  style={{
                    left: `${normalStart}%`,
                    width: `${normalRange}%`,
                  }}
                />
                <div
                  className="absolute w-1 h-full rounded-full transition-all"
                  style={{
                    left: `${(
                      ((metric.value - dims.min) / (dims.max - dims.min)) *
                      100
                    ).toFixed(1)}%`,
                    backgroundColor: isNormal(metric)
                      ? "var(--wl-success-400)"
                      : "var(--wl-warning-400)",
                  }}
                />
              </div>

              <p className="text-xs text-wl-text-tertiary mt-2">
                Normal: {metric.normalMin} – {metric.normalMax}
                {!isNormal(metric) && (
                  <span className="ml-2 text-wl-warning-400">
                    ⚠ Outside normal range
                  </span>
                )}
              </p>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-wl-border-default">
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    {filteredReadings.slice(-4).map((reading, idx) => {
                      const value =
                        metric.name === "Heart Rate"
                          ? reading.heartRate
                          : metric.name === "BP Systolic"
                            ? reading.bpSystolic
                            : metric.name === "BP Diastolic"
                              ? reading.bpDiastolic
                              : metric.name === "Temperature"
                                ? reading.temperature
                                : metric.name === "SpO2"
                                  ? reading.spO2
                                  : reading.weight;

                      return (
                        <div key={idx}>
                          <p className="text-wl-text-tertiary">
                            {reading.timestamp.toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          <p className="font-semibold text-wl-text-primary">
                            {value.toFixed(1)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export { VitalsChart };
export type { VitalReading, VitalsChartProps };
