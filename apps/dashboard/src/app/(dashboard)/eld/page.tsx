"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import { useFleetCompliance, useViolations, useELDEvents, DutyStatus, DriverComplianceStatus, DriverStatusInfo } from "@/hooks/use-eld";
import { useApiList, ApiFilters } from "@/hooks/use-api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";

/* ═══════════════════════════════════════════════════════════
   ELD OVERVIEW — Fleet-wide HOS compliance status dashboard
   Driver grid, violations summary, compliance score, DVIR rates
   ═══════════════════════════════════════════════════════════ */

import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  Activity,
  Users,
  Zap,
} from "lucide-react";

const statusVariant = (
  status: DriverComplianceStatus
): "success" | "warning" | "danger" | "info" | "default" => {
  const map: Record<DriverComplianceStatus, "success" | "warning" | "danger" | "info" | "default"> = {
    COMPLIANT: "success",
    WARNING: "warning",
    VIOLATION: "danger",
    OFFLINE: "default",
  };
  return map[status] ?? "default";
};

const dutyStatusIcon: Record<DutyStatus, string> = {
  OFF_DUTY: "⏸️",
  SLEEPER: "😴",
  DRIVING: "🚗",
  ON_DUTY: "📋",
};

interface ApiDriver {
  id: string;
  name: string;
  status: string;
  activeDeliveries?: number;
}

const dutyStatusColor = (duty: DutyStatus): string => {
  const colors: Record<DutyStatus, string> = {
    OFF_DUTY: "text-wl-text-secondary",
    SLEEPER: "text-wl-warning-400",
    DRIVING: "text-wl-danger-400",
    ON_DUTY: "text-wl-info-400",
  };
  return colors[duty];
};

function deriveDriverStatus(driver: ApiDriver, violationCounts: Record<string, number>): DriverComplianceStatus {
  const s = driver.status?.toLowerCase() ?? "";
  if (s === "offline" || s === "inactive") return "OFFLINE";
  const vCount = violationCounts[driver.id] ?? 0;
  if (vCount >= 2) return "VIOLATION";
  if (vCount === 1) return "WARNING";
  return "COMPLIANT";
}

export default function ELDOverviewPage() {
  const { items: apiDrivers, loading: driversLoading, error: driversError, refetch: driversRefetch } = useApiList<ApiDriver>('/api/v4/drivers');
  const complianceResult = useFleetCompliance();
  const violationsResult = useViolations(undefined);
  const eventsResult = useELDEvents(undefined);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  const compliance        = complianceResult.data;
  const complianceLoading = complianceResult.loading;
  const complianceError   = complianceResult.error;
  const violations        = violationsResult.items;
  const violationsLoading = violationsResult.loading;
  const events            = eventsResult.items;
  const eventsLoading     = eventsResult.loading;

  // Build violation count per driverId (computed before guards so useMemo below is valid)
  const violationCounts: Record<string, number> = {};
  for (const v of violations) {
    violationCounts[v.driverId] = (violationCounts[v.driverId] ?? 0) + 1;
  }

  const driverGrid: DriverStatusInfo[] = apiDrivers.map((d) => {
    const status = deriveDriverStatus(d, violationCounts);
    return {
      driverId: d.id,
      name: d.name,
      status,
      currentDuty: "ON_DUTY" as DutyStatus,
      drivingRemaining: 0,
      breakStatus: "TAKEN" as const,
      violations: violationCounts[d.id] ?? 0,
      lastUpdate: "—",
    };
  });

  const complianceScore = compliance?.compliancePercentage ?? 0;
  const scoreColor =
    complianceScore >= 90
      ? "text-wl-success-400"
      : complianceScore >= 75
        ? "text-wl-warning-400"
        : "text-wl-danger-400";

  const statusCounts = useMemo(() => ({
    compliant: driverGrid.filter((d) => d.status === "COMPLIANT").length,
    warning: driverGrid.filter((d) => d.status === "WARNING").length,
    violation: driverGrid.filter((d) => d.status === "VIOLATION").length,
    offline: driverGrid.filter((d) => d.status === "OFFLINE").length,
  }), [driverGrid]);

  if (driversLoading && !apiDrivers.length) return <TableSkeleton rows={10} columns={6} />;
  if (driversError) return <ErrorState message={driversError.message} onRetry={driversRefetch} />;

  return (
    <div className="min-h-screen bg-wl-bg-root space-y-6 p-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Fleet Compliance"
          value={complianceScore.toFixed(1)}
          unit="%"
          icon={<TrendingUp className="w-5 h-5 text-wl-success-400" />}
          isLoading={complianceLoading}
          className={cn(scoreColor)}
        />
        <StatCard
          label="Compliant Drivers"
          value={statusCounts.compliant}
          unit={`/ ${driverGrid.length}`}
          icon={<CheckCircle className="w-5 h-5 text-wl-success-400" />}
          trend={{ direction: "neutral", value: 0 }}
          isLoading={driversLoading}
        />
        <StatCard
          label="Active Violations"
          value={compliance?.activeViolations ?? 0}
          unit="drivers"
          icon={<AlertTriangle className="w-5 h-5 text-wl-danger-400" />}
          isLoading={complianceLoading}
        />
        <StatCard
          label="DVIR Completion"
          value={(compliance?.dvirCompletionRate ?? 0).toFixed(1)}
          unit="%"
          icon={<Wrench className="w-5 h-5 text-wl-info-400" />}
          isLoading={complianceLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Driver Status Grid */}
        <div className="lg:col-span-2">
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Driver Status Grid</CardTitle>
                  <p className="text-xs text-wl-text-secondary mt-1">
                    Real-time HOS compliance per driver
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="success" dot>
                    {statusCounts.compliant} Compliant
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {driverGrid.map((driver) => (
                  <button
                    key={driver.driverId}
                    onClick={() => setSelectedDriver(driver.driverId)}
                    className={cn(
                      "p-3 rounded-lg border transition-all text-left",
                      "hover:border-blue-500/30 hover:bg-[#1a1a2e]",
                      selectedDriver === driver.driverId
                        ? "border-blue-500/50 bg-blue-500/5"
                        : "border-[#1e1e2e]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">
                          {driver.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {driver.driverId}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs mb-2">
                        <span className={cn("text-lg", dutyStatusColor(driver.currentDuty))}>
                          {dutyStatusIcon[driver.currentDuty]}
                        </span>
                        <span className="text-gray-400">
                          {driver.currentDuty.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex-1">
                          <span className="text-gray-400">Driving: </span>
                          <span
                            className={cn(
                              "font-semibold",
                              driver.drivingRemaining > 4
                                ? "text-emerald-500"
                                : driver.drivingRemaining > 2
                                  ? "text-amber-500"
                                  : "text-red-500"
                            )}
                          >
                            {driver.drivingRemaining.toFixed(1)}h
                          </span>
                        </div>
                        {driver.violations > 0 && (
                          <Badge variant="danger" className="text-xs">
                            {driver.violations} violation
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-wl-border-default">
                        Updated {new Date(driver.lastUpdate).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Violations Summary */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-wl-danger-400" />
              Active Violations
            </CardTitle>
          </CardHeader>

          <CardContent>
            {violationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 rounded-full border-2 border-wl-primary-500/30 border-t-wl-primary-500 animate-spin" />
              </div>
            ) : violations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-wl-text-secondary">
                <CheckCircle className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm font-medium">No violations</p>
              </div>
            ) : (
              <div className="space-y-2">
                {violations.map((violation) => (
                  <div
                    key={violation.id}
                    className="p-2 rounded-lg bg-wl-bg-elevated border border-wl-border-default"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-white">
                        {violation.type.replace(/_/g, " ")}
                      </p>
                      <Badge
                        variant={
                          violation.severity === "CRITICAL"
                            ? "danger"
                            : violation.severity === "WARNING"
                              ? "warning"
                              : "info"
                        }
                        className="text-xs"
                      >
                        {violation.severity === "CRITICAL" ? "⚠" : "ℹ"}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400">
                      {violation.driverName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {violation.duration}m ago
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DVIR Status & Recent Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DVIR Summary */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Wrench className="w-5 h-5 text-blue-500" />
              DVIR Status
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-wl-bg-elevated border border-wl-border-default">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400">
                  Completion Rate
                </span>
                <span className="text-lg font-bold text-emerald-500">
                  {(compliance?.dvirCompletionRate ?? 0).toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${compliance?.dvirCompletionRate ?? 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Open Defects</span>
                <span className="font-semibold text-amber-500">
                  {compliance?.openDefects ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Critical Issues</span>
                <span className="font-semibold text-red-500">
                  {compliance?.criticalDefects ?? 0}
                </span>
              </div>
            </div>

            <Button variant="primary" className="w-full h-8 text-xs" href="/eld/dvir">
              <Wrench className="w-3 h-3 mr-2" />
              Manage DVIRs
            </Button>
          </CardContent>
        </Card>

        {/* Recent Events */}
        <div className="lg:col-span-2">
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Activity className="w-5 h-5 text-blue-500" />
                Recent ELD Events
              </CardTitle>
            </CardHeader>

            <CardContent>
              {eventsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-wl-text-secondary">
                  <Activity className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm font-medium">No ELD events yet</p>
                  <p className="text-xs mt-1">Events appear here as drivers update their status</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="p-2 rounded-lg bg-wl-bg-elevated border border-wl-border-default text-xs"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg mt-0.5">
                          {event.type === "STATUS_CHANGE"
                            ? "📝"
                            : event.type === "VIOLATION"
                              ? "⚠️"
                              : event.type === "EDIT_REQUEST"
                                ? "✏️"
                                : "✓"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white">
                            {event.driverName}
                          </p>
                          <p className="text-gray-400">{event.description}</p>
                          <p className="text-gray-500 mt-0.5">
                            {new Date(event.timestamp).toLocaleDateString()} at{" "}
                            {new Date(event.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="bg-wl-bg-surface border-wl-border-default">
        <CardHeader>
          <CardTitle className="text-lg text-white">Quick Actions</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button variant="secondary" className="h-10" href="/eld/hos">
              <Clock className="w-4 h-4 mr-2" />
              View HOS Details
            </Button>
            <Button variant="secondary" className="h-10" href="/drivers">
              <Users className="w-4 h-4 mr-2" />
              Driver Profiles
            </Button>
            <Button variant="secondary" className="h-10" href="/eld/dvir">
              <Wrench className="w-4 h-4 mr-2" />
              Submit DVIR
            </Button>
            <Button variant="secondary" className="h-10">
              <Zap className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
