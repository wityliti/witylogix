"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Play,
  BarChart3,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface CapacitySlot {
  zone: string;
  hour: number;
  currentDrivers: number;
  recommendedDrivers: number;
  demandPredicted: number;
  utilizationRate: number;
  status: "overstaffed" | "optimal" | "understaffed";
}

interface ZoneCapacitySummary {
  zone: string;
  totalCurrent: number;
  totalRecommended: number;
  avgUtilization: number;
  gapPercentage: number;
  status: "overstaffed" | "optimal" | "understaffed";
}

interface UtilizationMetric {
  zone: string;
  utilizationRate: number;
  efficiency: number;
  idle: number;
}

/**
 * Capacity Planning Page
 *
 * Features:
 * - Recommended driver allocation table by zone × hour
 * - Current vs recommended capacity comparison
 * - Capacity gap visualization (understaffed/overstaffed)
 * - "Optimize Schedule" button → calls smart scheduler API
 * - Driver utilization chart
 */
export default function CapacityPage() {
  // State
  const [capacity, setCapacity] = useState<CapacitySlot[]>([]);
  const [summary, setSummary] = useState<ZoneCapacitySummary[]>([]);
  const [utilization, setUtilization] = useState<UtilizationMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeSuccess, setOptimizeSuccess] = useState(false);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Mock capacity data (hour slots for each zone)
        const mockCapacity: CapacitySlot[] = [];
        const zones = ["Downtown", "Midtown", "Uptown", "Riverside", "Westside", "Eastside"];

        zones.forEach((zone) => {
          for (let hour = 6; hour < 22; hour++) {
            const baseLoad = Math.sin((hour - 6) / 16 * Math.PI) * 0.5 + 0.5;
            const demandPredicted = Math.round(baseLoad * 1000 + Math.random() * 200);
            const currentDrivers = Math.round(demandPredicted / 150);
            const recommendedDrivers = Math.round(demandPredicted / 120);
            const utilizationRate = (demandPredicted / (currentDrivers * 150)) * 100;

            let status: "overstaffed" | "optimal" | "understaffed" = "optimal";
            if (utilizationRate > 95) status = "understaffed";
            if (utilizationRate < 60) status = "overstaffed";

            mockCapacity.push({
              zone,
              hour,
              currentDrivers,
              recommendedDrivers,
              demandPredicted,
              utilizationRate: Math.round(utilizationRate),
              status,
            });
          }
        });

        // Generate summary by zone
        const mockSummary = zones.map((zone) => {
          const zoneCapacity = mockCapacity.filter((c) => c.zone === zone);
          const totalCurrent = zoneCapacity.reduce((sum, c) => sum + c.currentDrivers, 0);
          const totalRecommended = zoneCapacity.reduce((sum, c) => sum + c.recommendedDrivers, 0);
          const avgUtilization = Math.round(
            zoneCapacity.reduce((sum, c) => sum + c.utilizationRate, 0) / zoneCapacity.length
          );
          const gapPercentage = Math.round(
            ((totalRecommended - totalCurrent) / totalCurrent) * 100
          );

          let status: "overstaffed" | "optimal" | "understaffed" = "optimal";
          if (gapPercentage > 5) status = "understaffed";
          if (gapPercentage < -5) status = "overstaffed";

          return {
            zone,
            totalCurrent,
            totalRecommended,
            avgUtilization,
            gapPercentage,
            status,
          };
        });

        // Driver utilization metrics
        const mockUtilization = zones.map((zone) => {
          const zoneData = mockCapacity.filter((c) => c.zone === zone);
          const avgUtil = Math.round(
            zoneData.reduce((sum, c) => sum + c.utilizationRate, 0) / zoneData.length
          );
          return {
            zone,
            utilizationRate: avgUtil,
            efficiency: Math.round(avgUtil * 0.95),
            idle: Math.round((100 - avgUtil) * 0.5),
          };
        });

        setCapacity(mockCapacity);
        setSummary(mockSummary);
        setUtilization(mockUtilization);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load capacity data";
        setError(errorMessage);
        console.error("Capacity error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle optimization
  const handleOptimizeSchedule = useCallback(async () => {
    try {
      setIsOptimizing(true);
      setOptimizeSuccess(false);

      // Simulate API call to smart scheduler
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setOptimizeSuccess(true);
      setTimeout(() => setOptimizeSuccess(false), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Optimization failed";
      setError(errorMessage);
    } finally {
      setIsOptimizing(false);
    }
  }, []);

  // Get unique zones in order
  const zones = useMemo(() => {
    return [...new Set(capacity.map((c) => c.zone))];
  }, [capacity]);

  // Render heatmap visualization
  const renderCapacityHeatmap = () => {
    if (zones.length === 0) return null;

    const hours = Array.from({ length: 16 }, (_, i) => 6 + i);

    const getStatusColor = (status: string): string => {
      if (status === "understaffed") return "var(--wl-danger-500)";
      if (status === "overstaffed") return "var(--wl-info-500)";
      return "var(--wl-success-500)";
    };

    return (
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex">
            <div className="w-32 flex-shrink-0">
              <div className="h-12 bg-wl-bg-overlay border-b border-r border-wl-border-default flex items-center px-3">
                <span className="text-xs font-semibold text-wl-text-secondary">Zone</span>
              </div>
              {zones.map((zone) => (
                <div
                  key={zone}
                  className="h-10 border-b border-r border-wl-border-default flex items-center px-3 bg-wl-bg-surface"
                >
                  <span className="text-xs font-medium text-wl-text-primary truncate">{zone}</span>
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-x-auto">
              <div className="flex">
                {hours.map((hour) => (
                  <div key={`hour-${hour}`} className="flex-shrink-0 w-14">
                    <div className="h-12 bg-wl-bg-overlay border-b border-r border-wl-border-default flex items-center justify-center">
                      <span className="text-xs font-semibold text-wl-text-secondary">{hour}h</span>
                    </div>
                    {zones.map((zone) => {
                      const slot = capacity.find((c) => c.zone === zone && c.hour === hour);
                      if (!slot) return null;

                      return (
                        <div
                          key={`${zone}-${hour}`}
                          className="h-10 w-14 border-b border-r border-wl-border-default flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                          style={{
                            background: `linear-gradient(135deg, ${getStatusColor(slot.status)}22 0%, transparent 100%)`,
                            borderColor: `${getStatusColor(slot.status)}44`,
                          }}
                          title={`${slot.zone} ${hour}:00 - ${slot.currentDrivers}/${slot.recommendedDrivers} drivers`}
                        >
                          <span className="text-xs font-semibold text-wl-text-primary">
                            {slot.currentDrivers}/{slot.recommendedDrivers}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render utilization chart
  const renderUtilizationChart = () => {
    if (utilization.length === 0) return null;

    const chartHeight = 280;
    const chartWidth = 600;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const barWidth = innerWidth / (utilization.length * 3 + utilization.length - 1);
    const barGap = barWidth;

    return (
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto"
        role="img"
        aria-label="Driver utilization by zone"
      >
        {/* Y-axis gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + innerHeight - ratio * innerHeight;
          return (
            <line
              key={`gridline-${ratio}`}
              x1={padding.left}
              y1={y}
              x2={chartWidth - padding.right}
              y2={y}
              stroke="var(--wl-border-default)"
              strokeDasharray="4,4"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + innerHeight - ratio * innerHeight;
          const value = Math.round(100 * ratio);
          return (
            <text
              key={`ylabel-${ratio}`}
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              className="text-xs"
              fill="var(--wl-text-secondary)"
            >
              {value}%
            </text>
          );
        })}

        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={chartHeight - padding.bottom}
          stroke="var(--wl-border-strong)"
          vectorEffect="non-scaling-stroke"
        />

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={chartHeight - padding.bottom}
          x2={chartWidth - padding.right}
          y2={chartHeight - padding.bottom}
          stroke="var(--wl-border-strong)"
          vectorEffect="non-scaling-stroke"
        />

        {/* Bars */}
        {utilization.map((metric, idx) => {
          const xStart = padding.left + idx * (barWidth * 3 + barGap);
          const utilizationHeight = (metric.utilizationRate / 100) * innerHeight;
          const efficiencyHeight = (metric.efficiency / 100) * innerHeight;
          const idleHeight = (metric.idle / 100) * innerHeight;

          const utilizationY = chartHeight - padding.bottom - utilizationHeight;
          const efficiencyY = chartHeight - padding.bottom - efficiencyHeight;
          const idleY = chartHeight - padding.bottom - idleHeight;

          return (
            <g key={metric.zone}>
              {/* Utilization bar */}
              <rect
                x={xStart}
                y={utilizationY}
                width={barWidth}
                height={utilizationHeight}
                fill="var(--wl-primary-500)"
                opacity="0.8"
              />
              {/* Efficiency bar */}
              <rect
                x={xStart + barWidth}
                y={efficiencyY}
                width={barWidth}
                height={efficiencyHeight}
                fill="var(--wl-success-500)"
                opacity="0.8"
              />
              {/* Idle bar */}
              <rect
                x={xStart + barWidth * 2}
                y={idleY}
                width={barWidth}
                height={idleHeight}
                fill="var(--wl-warning-500)"
                opacity="0.6"
              />
              {/* Label */}
              <text
                x={xStart + barWidth}
                y={chartHeight - padding.bottom + 20}
                textAnchor="middle"
                className="text-xs"
                fill="var(--wl-text-secondary)"
              >
                {metric.zone.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-wl-bg-primary">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-wl-primary-500/20 border-t-wl-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-wl-text-secondary">Loading capacity data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-wl-bg-primary">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-wl-danger-500 mx-auto mb-4" />
          <p className="text-wl-text-primary font-medium">Error loading capacity data</p>
          <p className="text-wl-text-secondary text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const totalCurrentDrivers = summary.reduce((sum, s) => sum + s.totalCurrent, 0);
  const totalRecommendedDrivers = summary.reduce((sum, s) => sum + s.totalRecommended, 0);
  const totalGapPercentage = Math.round(
    ((totalRecommendedDrivers - totalCurrentDrivers) / totalCurrentDrivers) * 100
  );

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">Capacity Planning</h1>
              <p className="text-sm text-wl-text-secondary mt-1">
                Driver allocation and utilization optimization
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleOptimizeSchedule}
              disabled={isOptimizing}
              className={cn(isOptimizing && "opacity-75")}
            >
              {isOptimizing ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-white animate-spin" />
                  Optimizing...
                </>
              ) : optimizeSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Schedule Optimized
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Optimize Schedule
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-7xl">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Current Drivers
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">{totalCurrentDrivers}</p>
              <p className="text-xs text-wl-text-secondary mt-2">Across all zones</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Recommended
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">{totalRecommendedDrivers}</p>
              <Badge
                variant={totalGapPercentage > 0 ? "warning" : "info"}
                className="mt-2 text-xs"
              >
                {totalGapPercentage > 0 ? "+" : ""}{totalGapPercentage}%
              </Badge>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Capacity Gap
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {Math.abs(totalGapPercentage)}%
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">
                {totalGapPercentage > 0 ? "Understaffed" : "Overstaffed"}
              </p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Avg Utilization
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {Math.round(utilization.reduce((sum, u) => sum + u.utilizationRate, 0) / utilization.length)}%
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">All zones combined</p>
            </Card>
          </div>

          {/* Capacity Heatmap */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default overflow-hidden">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
              <Users className="w-5 h-5 inline mr-2" />
              Capacity Allocation Heatmap
            </h2>
            <p className="text-sm text-wl-text-secondary mb-4">
              Current / Recommended drivers by zone and hour
            </p>
            {renderCapacityHeatmap()}
          </Card>

          {/* Zone Capacity Summary Table */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default overflow-hidden">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">Zone Summary</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Zone</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Current Drivers</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">
                      Recommended
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Gap</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">
                      Avg Utilization
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-wl-text-secondary">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((zone, idx) => (
                    <tr
                      key={zone.zone}
                      className={cn(
                        "border-b border-wl-border-default hover:bg-wl-bg-overlay transition-colors",
                        idx % 2 === 0 ? "bg-wl-bg-surface" : "bg-transparent"
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-wl-text-primary">{zone.zone}</td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">
                        {zone.totalCurrent}
                      </td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">
                        {zone.totalRecommended}
                      </td>
                      <td className="text-right px-4 py-3">
                        <Badge
                          variant={
                            zone.gapPercentage > 5
                              ? "warning"
                              : zone.gapPercentage < -5
                              ? "info"
                              : "success"
                          }
                        >
                          {zone.gapPercentage > 0 ? "+" : ""}{zone.gapPercentage}%
                        </Badge>
                      </td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">
                        {zone.avgUtilization}%
                      </td>
                      <td className="text-center px-4 py-3">
                        {zone.status === "understaffed" ? (
                          <Badge variant="warning">Understaffed</Badge>
                        ) : zone.status === "overstaffed" ? (
                          <Badge variant="info">Overstaffed</Badge>
                        ) : (
                          <Badge variant="success">Optimal</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Utilization Chart */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
              <BarChart3 className="w-5 h-5 inline mr-2" />
              Driver Utilization by Zone
            </h2>
            <div className="flex items-end gap-6">
              <div className="flex-1 overflow-x-auto">{renderUtilizationChart()}</div>
              <div className="flex flex-col gap-3 text-sm min-w-max">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ background: "var(--wl-primary-500)" }}
                  />
                  <span className="text-wl-text-secondary">Utilization</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ background: "var(--wl-success-500)" }}
                  />
                  <span className="text-wl-text-secondary">Efficiency</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ background: "var(--wl-warning-500)" }}
                  />
                  <span className="text-wl-text-secondary">Idle Time</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Recommendations */}
          {totalGapPercentage !== 0 && (
            <Card className="p-6 bg-wl-bg-surface border-wl-border-default border-l-4 border-l-wl-warning-500">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-wl-warning-500 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-wl-text-primary mb-2">Optimization Recommendation</h3>
                  <p className="text-sm text-wl-text-secondary mb-4">
                    {totalGapPercentage > 0
                      ? `Your current capacity is ${Math.abs(totalGapPercentage)}% below recommended levels. Consider recruiting ${totalRecommendedDrivers - totalCurrentDrivers} additional drivers to meet projected demand.`
                      : `You are ${Math.abs(totalGapPercentage)}% overstaffed. Consider redeploying drivers or adjusting schedules to optimize costs.`}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm">
                      View Scheduling Assistant
                    </Button>
                    <Button variant="secondary" size="sm">
                      Review Recommendations
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
