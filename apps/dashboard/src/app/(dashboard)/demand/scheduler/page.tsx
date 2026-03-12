"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Download,
  AlertTriangle,
  Plus,
  Minus,
  RotateCcw,
  Zap,
  Users,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ScheduleSlot {
  driverId: string;
  driverName: string;
  timeSlots: Array<{
    hour: number;
    zone: string;
    status: "scheduled" | "available" | "off";
  }>;
}

interface WhatIfScenario {
  zone: string;
  additionalDrivers: number;
  impact: {
    demandCoverage: number;
    costIncrease: number;
    efficiencyGain: number;
  };
}

interface ScheduleRecommendation {
  title: string;
  description: string;
  impact: string;
  priority: "high" | "medium" | "low";
}

/**
 * Smart Scheduler UI
 *
 * Features:
 * - Interactive schedule grid: drivers (rows) × time slots (columns)
 * - Color-coded zone assignments
 * - Drag zones to see rebalancing effect
 * - What-if panel: "Add N drivers to Zone X" → shows impact
 * - Schedule export button
 * - Schedule recommendation summary
 */
export default function SchedulerPage() {
  // State
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [whatIfScenario, setWhatIfScenario] = useState<WhatIfScenario | null>(null);
  const [recommendations, setRecommendations] = useState<ScheduleRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>("Downtown");
  const [additionalDrivers, setAdditionalDrivers] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [draggedSlot, setDraggedSlot] = useState<{ driverId: string; hour: number } | null>(null);

  // Zone color mapping
  const zoneColors: Record<string, string> = {
    Downtown: "bg-wl-primary-500",
    Midtown: "bg-wl-success-500",
    Uptown: "bg-wl-warning-500",
    Riverside: "bg-wl-danger-500",
    Westside: "bg-wl-info-500",
    Eastside: "bg-wl-neutral-600",
  };

  const zones = Object.keys(zoneColors);

  // Load schedule data
  useEffect(() => {
    const loadSchedule = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Mock schedule data
        const driverCount = 15;
        const mockSchedule: ScheduleSlot[] = [];

        for (let i = 0; i < driverCount; i++) {
          const driverId = `driver-${i + 1}`;
          const timeSlots = Array.from({ length: 16 }, (_, hourIdx) => {
            const hour = 6 + hourIdx;
            let zone = "off";
            let status: "scheduled" | "available" | "off" = "off";

            // Create varied schedules
            if (hour >= 8 && hour <= 18) {
              const zoneIdx = (i + Math.floor(hour / 3)) % zones.length;
              zone = zones[zoneIdx];
              status = "scheduled";
            } else if (hour === 7 || hour === 19) {
              status = "available";
              zone = "";
            }

            return { hour, zone, status };
          });

          mockSchedule.push({
            driverId,
            driverName: `Driver ${String(i + 1).padStart(2, "0")}`,
            timeSlots,
          });
        }

        // Mock recommendations
        const mockRecommendations: ScheduleRecommendation[] = [
          {
            title: "Increase Downtown Coverage",
            description: "Add 2 drivers during peak hours (12-14) in Downtown zone",
            impact: "Reduce wait time by 25%",
            priority: "high",
          },
          {
            title: "Optimize Riverside Shifts",
            description: "Shift 1 driver from Midtown to Riverside during 10-12",
            impact: "Better demand-supply balance",
            priority: "medium",
          },
          {
            title: "Implement Flexible Breaks",
            description: "Stagger driver breaks in off-peak hours to maintain coverage",
            impact: "Improve flexibility by 15%",
            priority: "low",
          },
        ];

        setSchedule(mockSchedule);
        setRecommendations(mockRecommendations);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load schedule";
        setError(errorMessage);
        console.error("Scheduler error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSchedule();
  }, []);

  // Calculate what-if scenario
  const calculateWhatIf = useCallback(() => {
    const baselineCoverage = 85;
    const baseCost = 2500;
    const baseCostPerDriver = baseCost / 15;

    const coverageImprovement = additionalDrivers * 3;
    const newCoverage = Math.min(100, baselineCoverage + coverageImprovement);
    const costIncrease = Math.round((additionalDrivers * baseCostPerDriver) / baseCost * 100);
    const efficiencyGain = Math.round((newCoverage - baselineCoverage) * 0.8);

    setWhatIfScenario({
      zone: selectedZone,
      additionalDrivers,
      impact: {
        demandCoverage: newCoverage,
        costIncrease,
        efficiencyGain,
      },
    });
  }, [selectedZone, additionalDrivers]);

  // Handle export
  const handleExportSchedule = useCallback(async () => {
    try {
      setIsExporting(true);

      // Simulate export
      const csvContent = "data:text/csv;charset=utf-8,Driver,Zone,Hours\n";
      schedule.forEach((slot) => {
        const zones = slot.timeSlots
          .filter((t) => t.status === "scheduled")
          .map((t) => `${t.zone} (${t.hour}h)`);

        if (zones.length > 0) {
          const row = `${slot.driverName},"${zones.join(", ")}"\n`;
          const encodedUri = encodeURI(csvContent + row);
          // In a real app, trigger download
        }
      });

      // Simulate download delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Create actual CSV download
      const csvData = [
        ["Driver", "Schedule"],
        ...schedule.map((s) => [
          s.driverName,
          s.timeSlots
            .filter((t) => t.status === "scheduled")
            .map((t) => `${t.zone} (${t.hour}:00)`)
            .join("; "),
        ]),
      ];

      const csvString = csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
      const blob = new Blob([csvString], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "schedule.csv");
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Export failed";
      setError(errorMessage);
    } finally {
      setIsExporting(false);
    }
  }, [schedule]);

  // Render schedule grid
  const renderScheduleGrid = () => {
    const hours = Array.from({ length: 16 }, (_, i) => 6 + i);

    return (
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex">
            {/* Driver column */}
            <div className="w-40 flex-shrink-0">
              <div className="h-14 bg-wl-bg-overlay border-b border-r border-wl-border-default flex items-center px-4">
                <span className="text-sm font-semibold text-wl-text-secondary">Driver</span>
              </div>
              {schedule.map((driver) => (
                <div
                  key={driver.driverId}
                  className="h-12 border-b border-r border-wl-border-default flex items-center px-4 bg-wl-bg-surface hover:bg-wl-bg-overlay transition-colors"
                >
                  <span className="text-sm font-medium text-wl-text-primary truncate">
                    {driver.driverName}
                  </span>
                </div>
              ))}
            </div>

            {/* Time slots */}
            <div className="flex-1 overflow-x-auto">
              <div className="flex">
                {hours.map((hour) => (
                  <div key={`hour-${hour}`} className="flex-shrink-0 w-16">
                    <div className="h-14 bg-wl-bg-overlay border-b border-r border-wl-border-default flex items-center justify-center">
                      <span className="text-xs font-semibold text-wl-text-secondary">{hour}h</span>
                    </div>

                    {schedule.map((driver) => {
                      const slot = driver.timeSlots.find((t) => t.hour === hour);
                      if (!slot) return null;

                      const bgColor =
                        slot.status === "scheduled"
                          ? zoneColors[slot.zone] || "bg-wl-bg-overlay"
                          : slot.status === "available"
                          ? "bg-wl-bg-surface"
                          : "bg-wl-bg-sunken";

                      const isHovered =
                        draggedSlot && draggedSlot.driverId === driver.driverId && draggedSlot.hour === hour;

                      return (
                        <div
                          key={`${driver.driverId}-${hour}`}
                          draggable
                          onDragStart={() => setDraggedSlot({ driverId: driver.driverId, hour })}
                          onDragEnd={() => setDraggedSlot(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => {
                            // Toggle slot status
                            if (slot.status === "off") {
                              slot.status = "scheduled";
                              slot.zone = selectedZone;
                            } else {
                              slot.status = "off";
                              slot.zone = "";
                            }
                            setSchedule([...schedule]);
                          }}
                          className={cn(
                            "h-12 w-16 border-b border-r border-wl-border-default",
                            "flex items-center justify-center cursor-move",
                            "hover:opacity-80 transition-all",
                            bgColor,
                            isHovered && "ring-2 ring-wl-primary-500 ring-inset"
                          )}
                          title={
                            slot.status === "scheduled"
                              ? `${slot.zone} ${hour}:00`
                              : slot.status === "available"
                              ? "Available"
                              : "Off"
                          }
                        >
                          {slot.status === "scheduled" && (
                            <span className="text-xs font-bold text-white truncate px-1">
                              {slot.zone.split(" ")[0]}
                            </span>
                          )}
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-wl-bg-primary">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-wl-primary-500/20 border-t-wl-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-wl-text-secondary">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-wl-bg-primary">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-wl-danger-500 mx-auto mb-4" />
          <p className="text-wl-text-primary font-medium">Error loading schedule</p>
          <p className="text-wl-text-secondary text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const totalScheduledSlots = schedule.reduce(
    (sum, s) => sum + s.timeSlots.filter((t) => t.status === "scheduled").length,
    0
  );

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">Smart Scheduler</h1>
              <p className="text-sm text-wl-text-secondary mt-1">
                Interactive schedule management and optimization
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleExportSchedule}
              disabled={isExporting}
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Exporting..." : "Export Schedule"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-full">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Total Drivers
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">{schedule.length}</p>
              <p className="text-xs text-wl-text-secondary mt-2">In current schedule</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Scheduled Shifts
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">{totalScheduledSlots}</p>
              <p className="text-xs text-wl-text-secondary mt-2">Total assignments</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Avg Utilization
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {Math.round((totalScheduledSlots / (schedule.length * 16)) * 100)}%
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">Per driver</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Coverage
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">85%</p>
              <p className="text-xs text-wl-text-secondary mt-2">Demand coverage</p>
            </Card>
          </div>

          {/* Zone Legend */}
          <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
            <p className="text-sm font-semibold text-wl-text-primary mb-3">Zone Colors</p>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {zones.map((zone) => (
                <div key={zone} className="flex items-center gap-2">
                  <div
                    className={cn("w-4 h-4 rounded", zoneColors[zone])}
                  />
                  <span className="text-xs text-wl-text-secondary">{zone}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Instructions */}
          <Card className="p-4 bg-wl-info-500/10 border border-wl-info-500/30">
            <p className="text-sm text-wl-info-300">
              Drag and drop schedule slots to reassign zones, or click to toggle assignments.
            </p>
          </Card>

          {/* Schedule Grid */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default overflow-hidden">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
              <Users className="w-5 h-5 inline mr-2" />
              Driver Schedule Grid
            </h2>
            {renderScheduleGrid()}
          </Card>

          {/* What-If Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
              <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
                <Zap className="w-5 h-5 inline mr-2" />
                What-If Analysis
              </h2>

              <div className="space-y-4">
                {/* Zone Selector */}
                <div>
                  <label htmlFor="whatif-zone" className="text-sm font-medium text-wl-text-secondary mb-2 block">
                    Zone
                  </label>
                  <select
                    id="whatif-zone"
                    value={selectedZone}
                    onChange={(e) => setSelectedZone(e.target.value)}
                    className={cn(
                      "w-full px-3 py-2 rounded-md text-sm font-medium",
                      "bg-wl-bg-overlay border border-wl-border-default",
                      "text-wl-text-primary",
                      "focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
                    )}
                  >
                    {zones.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Driver Count Adjuster */}
                <div>
                  <label htmlFor="additional-drivers" className="text-sm font-medium text-wl-text-secondary mb-2 block">
                    Additional Drivers
                  </label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAdditionalDrivers(Math.max(0, additionalDrivers - 1))}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <input
                      id="additional-drivers"
                      type="number"
                      value={additionalDrivers}
                      onChange={(e) => setAdditionalDrivers(Math.max(0, parseInt(e.target.value) || 0))}
                      min="0"
                      max="10"
                      className={cn(
                        "w-20 px-3 py-2 rounded-md text-sm font-semibold text-center",
                        "bg-wl-bg-overlay border border-wl-border-default",
                        "text-wl-text-primary",
                        "focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
                      )}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAdditionalDrivers(Math.min(10, additionalDrivers + 1))}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Calculate Button */}
                <Button
                  variant="primary"
                  size="md"
                  onClick={calculateWhatIf}
                  className="w-full"
                >
                  <TrendingUp className="w-4 h-4" />
                  Calculate Impact
                </Button>
              </div>
            </Card>

            {/* Impact Results */}
            {whatIfScenario && (
              <Card className="p-6 bg-wl-bg-surface border-wl-border-default border-l-4 border-l-wl-success-500">
                <h2 className="text-lg font-semibold text-wl-text-primary mb-4">Impact Analysis</h2>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide mb-2">
                      Zone
                    </p>
                    <p className="text-lg font-semibold text-wl-text-primary">
                      {whatIfScenario.zone}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide mb-2">
                      Additional Drivers
                    </p>
                    <p className="text-lg font-semibold text-wl-success-400">
                      +{whatIfScenario.additionalDrivers}
                    </p>
                  </div>

                  <div className="border-t border-wl-border-default pt-4">
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-wl-text-secondary">Demand Coverage</span>
                          <span className="text-sm font-semibold text-wl-text-primary">
                            {whatIfScenario.impact.demandCoverage}%
                          </span>
                        </div>
                        <div className="h-2 bg-wl-bg-overlay rounded-full overflow-hidden">
                          <div
                            className="h-full bg-wl-success-500 transition-all"
                            style={{
                              width: `${Math.min(100, whatIfScenario.impact.demandCoverage)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-wl-text-secondary">Cost Increase</span>
                          <Badge variant="warning">+{whatIfScenario.impact.costIncrease}%</Badge>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-wl-text-secondary">Efficiency Gain</span>
                          <Badge variant="success">+{whatIfScenario.impact.efficiencyGain}%</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button variant="primary" size="md" className="w-full">
                    Apply Changes
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Recommendations */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
              Schedule Recommendations
            </h2>

            {recommendations.length === 0 ? (
              <p className="text-wl-text-secondary text-sm">No recommendations available</p>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "border rounded-md p-4",
                      rec.priority === "high"
                        ? "border-wl-danger-500/50 bg-wl-danger-500/5"
                        : rec.priority === "medium"
                        ? "border-wl-warning-500/50 bg-wl-warning-500/5"
                        : "border-wl-info-500/50 bg-wl-info-500/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-wl-text-primary">{rec.title}</h3>
                      <Badge
                        variant={rec.priority === "high" ? "danger" : rec.priority === "medium" ? "warning" : "info"}
                      >
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-wl-text-secondary mb-2">{rec.description}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <TrendingUp className="w-4 h-4 text-wl-success-500" />
                      <span className="text-wl-success-400">{rec.impact}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
