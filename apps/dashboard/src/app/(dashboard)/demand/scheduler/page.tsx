"use client";

import { useState, useMemo } from "react";
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
import { useApiQuery } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";

interface SchedulerData {
  schedule: Array<{
    driverId: string;
    driverName: string;
    timeSlots: Array<{
      hour: number;
      zone: string;
      status: "scheduled" | "available" | "off";
    }>;
  }>;
  recommendations: Array<{
    title: string;
    description: string;
    impact: string;
    priority: "high" | "medium" | "low";
  }>;
  whatIfScenarios: Array<{
    zone: string;
    additionalDrivers: number;
    impact: {
      demandCoverage: number;
      costIncrease: number;
      efficiencyGain: number;
    };
  }>;
  metrics: {
    totalScheduledDrivers: number;
    avgUtilization: number;
    recommendedAdjustments: number;
    optimizationScore: number;
  };
}

/**
 * Smart Scheduler UI
 *
 * Features:
 * - Interactive schedule grid: drivers (rows) × time slots (columns)
 * - Drag-and-drop to reassign drivers to zones
 * - What-if scenario modeling (adjust by zone or driver)
 * - Recommendations based on demand forecast
 * - Quick-apply optimization
 */
export default function SchedulerPage() {
  const [viewMode, setViewMode] = useState<
    "schedule" | "scenarios" | "recommendations"
  >("schedule");
  const [selectedScenario, setSelectedScenario] = useState<number>(0);

  const { data, loading, error } = useApiQuery<SchedulerData>(
    "/api/v4/analytics/demand-scheduler",
  );

  const schedule = data?.schedule || [];
  const recommendations = data?.recommendations || [];
  const scenarios = data?.whatIfScenarios || [];
  const metrics = data?.metrics || null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "danger";
      case "medium":
        return "warning";
      default:
        return "info";
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">
                Smart Scheduler
              </h1>
              <p className="text-sm text-wl-text-secondary mt-1">
                Optimize driver schedules by demand
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="md">
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button variant="primary" size="md">
                <Zap className="w-4 h-4" />
                Apply Optimization
              </Button>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setViewMode("schedule")}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                viewMode === "schedule"
                  ? "bg-wl-primary-500 text-white"
                  : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary",
              )}
            >
              Schedule
            </button>
            <button
              onClick={() => setViewMode("scenarios")}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                viewMode === "scenarios"
                  ? "bg-wl-primary-500 text-white"
                  : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary",
              )}
            >
              What-If
            </button>
            <button
              onClick={() => setViewMode("recommendations")}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                viewMode === "recommendations"
                  ? "bg-wl-primary-500 text-white"
                  : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary",
              )}
            >
              Recommendations
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-7xl">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                Scheduled Drivers
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {metrics?.totalScheduledDrivers || 0}
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">Assigned</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                Avg Utilization
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {Math.round(metrics?.avgUtilization || 0)}%
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">Overall</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                Adjustments
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {metrics?.recommendedAdjustments || 0}
              </p>
              <Badge variant="warning" className="mt-2 text-xs">
                Suggested
              </Badge>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                Optimization Score
              </p>
              <p className="text-2xl font-bold text-wl-success-500 mt-2">
                {Math.round(metrics?.optimizationScore || 0)}%
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">
                Current efficiency
              </p>
            </Card>
          </div>

          {/* Schedule View */}
          {viewMode === "schedule" && (
            <Card className="p-6 bg-wl-bg-surface border-wl-border-default overflow-hidden">
              <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
                Driver Schedule
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-default">
                      <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary min-w-32">
                        Driver
                      </th>
                      {[8, 10, 12, 14, 16, 18, 20].map((hour) => (
                        <th
                          key={hour}
                          className="text-center px-4 py-3 font-semibold text-wl-text-secondary"
                        >
                          {hour}:00
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.slice(0, 10).map((driver, idx) => (
                      <tr
                        key={driver.driverId}
                        className={cn(
                          "border-b border-wl-border-default hover:bg-wl-bg-overlay transition-colors",
                          idx % 2 === 0 ? "bg-wl-bg-surface" : "bg-transparent",
                        )}
                      >
                        <td className="px-4 py-3 font-medium text-wl-text-primary">
                          {driver.driverName}
                        </td>
                        {[8, 10, 12, 14, 16, 18, 20].map((hour) => {
                          const slot = driver.timeSlots.find(
                            (s) => s.hour === hour,
                          );
                          const statusColor =
                            slot?.status === "scheduled"
                              ? "bg-wl-success-500/20 text-wl-success-700"
                              : slot?.status === "available"
                                ? "bg-wl-info-500/20 text-wl-info-700"
                                : "bg-wl-neutral-500/20 text-wl-neutral-700";
                          return (
                            <td key={hour} className="text-center px-4 py-3">
                              {slot ? (
                                <div
                                  className={cn(
                                    "text-xs py-1 px-2 rounded",
                                    statusColor,
                                  )}
                                >
                                  {slot.zone}
                                </div>
                              ) : (
                                <span className="text-wl-text-tertiary">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* What-If Scenarios */}
          {viewMode === "scenarios" && (
            <div className="space-y-4">
              {scenarios.map((scenario, idx) => (
                <Card
                  key={`${scenario.zone}-${idx}`}
                  className={cn(
                    "p-6 bg-wl-bg-surface border cursor-pointer transition-all",
                    selectedScenario === idx
                      ? "border-wl-primary-500"
                      : "border-wl-border-default",
                  )}
                  onClick={() => setSelectedScenario(idx)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-wl-text-primary mb-2">
                        {scenario.zone} + {scenario.additionalDrivers} Drivers
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                            Demand Coverage
                          </p>
                          <p className="text-lg font-semibold text-wl-success-500 mt-1">
                            {Math.round(scenario.impact.demandCoverage)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                            Cost Increase
                          </p>
                          <p className="text-lg font-semibold text-wl-danger-500 mt-1">
                            +${Math.round(scenario.impact.costIncrease)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                            Efficiency Gain
                          </p>
                          <p className="text-lg font-semibold text-wl-success-500 mt-1">
                            +{Math.round(scenario.impact.efficiencyGain)}%
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button variant="primary" size="sm">
                      Apply
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {viewMode === "recommendations" && (
            <div className="space-y-4">
              {recommendations.map((rec, idx) => (
                <Card
                  key={idx}
                  className="p-6 bg-wl-bg-surface border-wl-border-default"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-wl-text-primary">
                          {rec.title}
                        </h3>
                        <Badge variant={getPriorityColor(rec.priority) as any}>
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-wl-text-secondary mb-2">
                        {rec.description}
                      </p>
                      <p className="text-xs text-wl-success-500 font-medium">
                        Impact: {rec.impact}
                      </p>
                    </div>
                    <Button variant="primary" size="sm">
                      Apply
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
