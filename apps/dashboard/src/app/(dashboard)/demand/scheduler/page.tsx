"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Download, Zap, CalendarX, MapPin, Lightbulb, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useZonesGeoJson } from "@/hooks/use-zones-geojson";

const WLMap = dynamic(
  () => import("@/components/map/wl-map").then((m) => m.WLMap),
  { ssr: false },
);
const SchedulerCoverageLayer = dynamic(
  () =>
    import("@/components/map/scheduler-coverage-layer").then(
      (m) => m.SchedulerCoverageLayer,
    ),
  { ssr: false },
);

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

interface CapacityData {
  zoneSummary: Array<{
    id: string;
    name: string;
    status: "understaffed" | "optimal" | "overstaffed";
    scheduledDrivers: number;
    requiredDrivers: number;
  }>;
}

export default function SchedulerPage() {
  const [viewMode, setViewMode] = useState<
    "schedule" | "scenarios" | "recommendations" | "map"
  >("schedule");
  const [selectedScenario, setSelectedScenario] = useState<number>(0);

  const { data, loading, error } = useApiQuery<SchedulerData>(
    "/api/v4/analytics/demand-scheduler",
  );
  const { data: capacityData } = useApiQuery<CapacityData>(
    "/api/v4/analytics/demand-capacity",
  );
  const { data: zonesGeojson } = useZonesGeoJson();

  const schedule = data?.schedule || [];
  const recommendations = data?.recommendations || [];
  const scenarios = data?.whatIfScenarios || [];
  const metrics = data?.metrics || null;
  const zoneCoverage = capacityData?.zoneSummary || [];

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
            {(
              [
                { key: "schedule", label: "Schedule" },
                { key: "scenarios", label: "What-If" },
                { key: "recommendations", label: "Recommendations" },
                { key: "map", label: "Map" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  viewMode === key
                    ? "bg-wl-primary-500 text-white"
                    : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary",
                )}
              >
                {label}
              </button>
            ))}
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
              {schedule.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <CalendarX className="w-12 h-12 text-wl-text-tertiary" />
                  <p className="text-wl-text-primary font-medium">
                    No drivers scheduled
                  </p>
                  <p className="text-sm text-wl-text-secondary max-w-xs">
                    Driver schedules will appear here once shifts are assigned.
                  </p>
                </div>
              ) : (
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
                            idx % 2 === 0
                              ? "bg-wl-bg-surface"
                              : "bg-transparent",
                          )}
                        >
                          <td className="px-4 py-3 font-medium text-wl-text-primary">
                            {driver.driverName}
                          </td>
                          {[0, 1, 2, 3, 4, 5].map((hour) => {
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
                                  <span className="text-wl-text-tertiary">
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* What-If Scenarios */}
          {viewMode === "scenarios" && (
            <div className="space-y-4">
              {scenarios.length === 0 ? (
                <Card className="p-12 bg-wl-bg-surface border-wl-border-default text-center">
                  <Zap className="w-12 h-12 text-wl-text-tertiary mx-auto mb-4" />
                  <p className="text-wl-text-primary font-medium mb-1">
                    No scenarios available
                  </p>
                  <p className="text-sm text-wl-text-secondary max-w-xs mx-auto">
                    What-if scenarios will appear once the demand model
                    generates zone projections.
                  </p>
                </Card>
              ) : (
                scenarios.map((scenario, idx) => (
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
                ))
              )}
            </div>
          )}

          {/* Recommendations */}
          {viewMode === "recommendations" && (
            <div className="space-y-4">
              {recommendations.length === 0 ? (
                <Card className="p-12 bg-wl-bg-surface border-wl-border-default text-center">
                  <Lightbulb className="w-12 h-12 text-wl-text-tertiary mx-auto mb-4" />
                  <p className="text-wl-text-primary font-medium mb-1">
                    No recommendations
                  </p>
                  <p className="text-sm text-wl-text-secondary max-w-xs mx-auto">
                    Scheduling recommendations will appear as the system
                    analyses demand patterns.
                  </p>
                </Card>
              ) : (
                recommendations.map((rec, idx) => (
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
                          <Badge
                            variant={getPriorityColor(rec.priority) as any}
                          >
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
                ))
              )}
            </div>
          )}

          {/* Map View */}
          {viewMode === "map" && (
            <div
              className="relative rounded-xl overflow-hidden border border-wl-border-default"
              style={{ height: 520 }}
            >
              {zonesGeojson ? (
                <WLMap
                  center={[77.12, 28.65]}
                  zoom={10}
                  className="h-full w-full"
                >
                  <SchedulerCoverageLayer
                    zones={zonesGeojson}
                    coverageData={zoneCoverage.map((z) => ({
                      id: z.id,
                      name: z.name,
                      status: z.status,
                      scheduledDrivers: z.scheduledDrivers,
                      requiredDrivers: z.requiredDrivers,
                    }))}
                  />
                </WLMap>
              ) : (
                <div className="h-full flex items-center justify-center bg-wl-bg-surface">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Map className="w-10 h-10 text-wl-text-tertiary" />
                    <p className="text-sm text-wl-text-secondary">
                      Loading zone map…
                    </p>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-wl-bg-surface/90 backdrop-blur border border-wl-border-default rounded-xl p-4 text-xs pointer-events-none">
                <p className="font-semibold text-wl-text-primary mb-2">
                  Driver Coverage
                </p>
                {[
                  { color: "#ef4444", label: "Understaffed" },
                  { color: "#10b981", label: "Optimal" },
                  { color: "#3b82f6", label: "Overstaffed" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2 mt-1">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ background: color }}
                    />
                    <span className="text-wl-text-secondary">{label}</span>
                  </div>
                ))}
              </div>

              {/* Zone summary panel */}
              {zoneCoverage.length > 0 && (
                <div className="absolute top-4 right-4 bg-wl-bg-surface/90 backdrop-blur border border-wl-border-default rounded-xl p-4 max-w-xs">
                  <p className="text-xs font-semibold text-wl-text-primary mb-3">
                    Zone Coverage
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {zoneCoverage.slice(0, 8).map((z) => (
                      <div
                        key={z.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-xs text-wl-text-secondary truncate">
                          {z.name}
                        </span>
                        <Badge
                          variant={
                            z.status === "understaffed"
                              ? "danger"
                              : z.status === "overstaffed"
                                ? "info"
                                : "success"
                          }
                          className="text-[10px] shrink-0"
                        >
                          {z.scheduledDrivers}/{z.requiredDrivers}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
