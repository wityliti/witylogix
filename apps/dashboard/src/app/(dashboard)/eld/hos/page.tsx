"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDriverHOS, useDriverHOSDetails, useViolations, useELDDriverStatus, DutyStatus } from "@/hooks/use-eld";
import { api } from "@/lib/api";
import { MultiHOSGauge } from "@/components/eld/hos-clock";
import { ViolationTimeline } from "@/components/eld/violation-timeline";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Edit2,
  Download,
  RotateCw,
} from "lucide-react";

const dutyStatusColor = (status: DutyStatus): string => {
  const colors: Record<DutyStatus, string> = {
    OFF_DUTY: "bg-wl-neutral-600/40",
    SLEEPER: "bg-amber-500/40",
    DRIVING: "bg-red-500/40",
    ON_DUTY: "bg-blue-500/40",
  };
  return colors[status];
};

const dutyStatusLabel: Record<DutyStatus, string> = {
  OFF_DUTY: "Off-Duty",
  SLEEPER: "Sleeper",
  DRIVING: "Driving",
  ON_DUTY: "On-Duty",
};

export default function HOSPage() {
  const router = useRouter();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [personalConveyance, setPersonalConveyance] = useState(false);
  const [yardMove, setYardMove] = useState(false);
  const [requestingEdit, setRequestingEdit] = useState(false);
  const [editRequestSent, setEditRequestSent] = useState(false);

  const { items: driverList, loading: driversLoading, error: driversError, refetch: refetchDrivers } = useELDDriverStatus();
  const { data: hos, loading: isLoading } = useDriverHOS(selectedDriverId);
  const { data: hosDetails, loading: detailsLoading } = useDriverHOSDetails(selectedDriverId);
  const { items: violations, loading: violationsLoading } = useViolations({ search: selectedDriverId ?? undefined });

  // Auto-select first driver when loaded
  useEffect(() => {
    if (!selectedDriverId && driverList.length > 0) {
      setSelectedDriverId(driverList[0].driverId);
    }
  }, [driverList, selectedDriverId]);

  // Reset edit-request sent state when driver changes
  useEffect(() => {
    setEditRequestSent(false);
  }, [selectedDriverId]);

  const dailyLog = hosDetails?.dailyLog ?? [];
  const eightDayRecap = hosDetails?.eightDayRecap ?? [];

  const handleRequestEdit = useCallback(async () => {
    if (!selectedDriverId || requestingEdit) return;
    setRequestingEdit(true);
    try {
      await api.post(`/api/v4/eld/drivers/${selectedDriverId}/edit-request`, {
        reason: "Log edit requested via HOS dashboard",
      });
      setEditRequestSent(true);
    } finally {
      setRequestingEdit(false);
    }
  }, [selectedDriverId, requestingEdit]);

  const handleExportHOS = useCallback(() => {
    if (!hos || !selectedDriverId) return;
    const driver = driverList.find((d) => d.driverId === selectedDriverId);
    const lines = [
      `HOS Report — ${driver?.name ?? selectedDriverId}`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `Current Status: ${hos.currentStatus}`,
      `Driving Time Remaining: ${hos.drivingTimeRemaining.toFixed(1)}h`,
      `On-Duty Window Remaining: ${hos.onDutyWindowRemaining.toFixed(1)}h`,
      `Cycle Hours Used: ${hos.cycleHoursUsed.toFixed(1)}h / ${hos.cycleHours}h`,
      `Break Status: ${hos.breakStatus}`,
      `Last Status Change: ${new Date(hos.lastStatusChange).toLocaleString()}`,
      ``,
      `8-Day Recap:`,
      ...eightDayRecap.map((e) => `  ${e.day}: Driving ${e.driving.toFixed(1)}h  On-Duty ${e.onDuty.toFixed(1)}h  Total ${e.total.toFixed(1)}h`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hos-report-${driver?.name?.replace(/\s+/g, "-") ?? selectedDriverId}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [hos, selectedDriverId, driverList, eightDayRecap]);

  const selectedDriver = driverList.find((d) => d.driverId === selectedDriverId);
  const filteredDrivers = useMemo(() => {
    if (!searchQuery) return driverList;
    return driverList.filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, driverList]);

  if (driversLoading) return <TableSkeleton rows={10} columns={6} />;
  if (driversError) return <ErrorState message={driversError.message} onRetry={refetchDrivers} />;

  const getHosStatus = () => {
    if (!hos) return "unknown";
    if (hos.drivingTimeRemaining < 120) return "critical";
    if (hos.drivingTimeRemaining < 240) return "warning";
    return "compliant";
  };

  const hosStatus = getHosStatus();

  return (
    <div className="min-h-screen bg-wl-bg-root space-y-6 p-6">
      {/* Driver Selector */}
      <Card className="bg-wl-bg-surface border-wl-border-default">
        <CardHeader>
          <CardTitle className="text-lg text-white">Driver Selection</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="relative">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="w-full h-10 px-3 rounded-lg border border-wl-border-default bg-wl-bg-elevated text-white text-left flex items-center justify-between hover:bg-wl-bg-root transition-colors"
            >
              <span className="text-sm font-medium">{selectedDriver?.name}</span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-wl-text-secondary transition-transform",
                  showSearch && "rotate-180"
                )}
              />
            </button>

            {showSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-wl-bg-elevated border border-wl-border-default rounded-lg shadow-lg">
                <Input
                  placeholder="Search drivers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-0 rounded-t-lg rounded-b-none text-xs h-8 bg-wl-bg-elevated text-white placeholder-gray-500"
                  autoFocus
                />

                <div className="max-h-60 overflow-y-auto">
                  {filteredDrivers.map((driver) => (
                    <button
                      key={driver.driverId}
                      onClick={() => {
                        setSelectedDriverId(driver.driverId);
                        setShowSearch(false);
                        setSearchQuery("");
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs transition-colors border-b border-wl-border-default last:border-0",
                        selectedDriverId === driver.driverId
                          ? "bg-wl-info-500/10 text-wl-info-400"
                          : "text-wl-text-secondary hover:bg-wl-bg-root"
                      )}
                    >
                      {driver.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-wl-info-500/30 border-t-blue-500 animate-spin" />
        </div>
      ) : hos ? (
        <>
          {/* HOS Gauge Display */}
          <MultiHOSGauge
            driving={hos.drivingTimeRemaining}
            onDutyWindow={hos.onDutyWindowRemaining}
            cycle={{ used: hos.cycleHoursUsed, max: hos.cycleHours }}
            breakRemaining={hos.breakStatus === "REQUIRED" ? hos.breakTimeRemaining : 0}
            isViolation={hosStatus === "critical"}
          />

          {/* Status Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Current Status */}
            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardHeader>
                <CardTitle className="text-sm text-white">Current Status</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-wl-text-secondary uppercase tracking-wide font-semibold mb-1">Duty Status</p>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full",
                        hos.currentStatus === "DRIVING"
                          ? "bg-red-500 animate-pulse"
                          : hos.currentStatus === "ON_DUTY"
                            ? "bg-blue-500"
                            : hos.currentStatus === "SLEEPER"
                              ? "bg-amber-500"
                              : "bg-wl-neutral-400"
                      )}
                    />
                    <p className="text-sm font-semibold text-white">{hos.currentStatus.replace(/_/g, " ")}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-wl-text-secondary uppercase tracking-wide font-semibold mb-1">Break Status</p>
                  <Badge variant={hos.breakStatus === "TAKEN" ? "success" : "warning"}>
                    {hos.breakStatus === "TAKEN" ? "✓ Taken" : "⚠ Required"}
                  </Badge>
                </div>

                <div>
                  <p className="text-xs text-wl-text-secondary uppercase tracking-wide font-semibold mb-1">Last Updated</p>
                  <p className="text-xs text-white">
                    {new Date(hos.lastStatusChange).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Toggles */}
            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardHeader>
                <CardTitle className="text-sm text-white">HOS Exemptions</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-wl-bg-elevated transition-colors">
                  <input
                    type="checkbox"
                    checked={personalConveyance}
                    onChange={(e) => setPersonalConveyance(e.target.checked)}
                    className="w-4 h-4 rounded border-wl-border-default"
                  />
                  <span className="text-xs text-white font-medium">Personal Conveyance</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-wl-bg-elevated transition-colors">
                  <input
                    type="checkbox"
                    checked={yardMove}
                    onChange={(e) => setYardMove(e.target.checked)}
                    className="w-4 h-4 rounded border-wl-border-default"
                  />
                  <span className="text-xs text-white font-medium">Yard Move</span>
                </label>

                <p className="text-xs text-wl-text-secondary pt-2 border-t border-wl-border-default">
                  These HOS exemptions apply only with proper authorization
                </p>
              </CardContent>
            </Card>

            {/* Compliance Alert */}
            <Card
              className={cn(
                "bg-wl-bg-surface border-wl-border-default",
                hosStatus === "critical" && "border-wl-danger-500/50 bg-red-500/5"
              )}
            >
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-white">
                  {hosStatus === "compliant" && (
                    <>
                      <CheckCircle className="w-4 h-4 text-wl-success-500" />
                      Compliant
                    </>
                  )}
                  {hosStatus === "warning" && (
                    <>
                      <AlertTriangle className="w-4 h-4 text-wl-warning-500" />
                      Caution
                    </>
                  )}
                  {hosStatus === "critical" && (
                    <>
                      <AlertTriangle className="w-4 h-4 text-wl-danger-500" />
                      Critical
                    </>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent className="text-xs text-wl-text-secondary">
                {hosStatus === "compliant" && "Driver is within safe HOS limits. Continue monitoring."}
                {hosStatus === "warning" && "Driving hours approaching limit. Schedule break soon."}
                {hosStatus === "critical" && "URGENT: Driver must stop driving immediately. HOS violation imminent."}
              </CardContent>
            </Card>
          </div>

          {/* Daily Log Graph */}
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-white">24-Hour Daily Log</CardTitle>
                <span className="text-xs text-wl-text-secondary">
                  {detailsLoading ? "Loading…" : new Date().toLocaleDateString()}
                </span>
              </div>
            </CardHeader>

            <CardContent>
              {detailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                </div>
              ) : (
              <div className="space-y-2">
                {/* Hour labels */}
                <div className="flex text-xs text-wl-text-secondary">
                  <div className="w-16" />
                  <div className="flex-1 flex">
                    {Array.from({ length: 24 }, (_, i) => (
                      <div key={i} className="flex-1 text-center" style={{ fontSize: "9px" }}>
                        {String(i).padStart(2, "0")}
                      </div>
                    ))}
                  </div>
                </div>

                {/* One row per duty status — filled where the driver was in that status */}
                {(["OFF_DUTY", "SLEEPER", "DRIVING", "ON_DUTY"] as DutyStatus[]).map((statusType) => (
                  <div key={statusType} className="flex items-center gap-2">
                    <div className="w-16 text-xs font-semibold text-wl-text-secondary shrink-0">
                      {dutyStatusLabel[statusType]}
                    </div>
                    <div className="flex-1 flex h-6">
                      {(dailyLog.length === 24 ? dailyLog : Array.from({ length: 24 }, (_, i) => ({ hour: i, status: "OFF_DUTY" as DutyStatus, label: "Off-Duty" }))).map((entry) => (
                        <div
                          key={entry.hour}
                          className={cn(
                            "flex-1 border-r border-wl-bg-root last:border-r-0 transition-all hover:opacity-80",
                            entry.status === statusType ? dutyStatusColor(statusType) : "bg-white/3"
                          )}
                          title={`${String(entry.hour).padStart(2, "0")}:00 — ${entry.label}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Legend */}
                <div className="pt-4 flex flex-wrap gap-4 text-xs text-wl-text-secondary border-t border-wl-border-default">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-red-500/40" />
                    Driving
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-500/40" />
                    On-Duty
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-amber-500/40" />
                    Sleeper
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-wl-neutral-600/40" />
                    Off-Duty
                  </div>
                </div>
              </div>
              )}
            </CardContent>
          </Card>

          {/* 8-Day Recap Table */}
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-lg text-white">8-Day Cycle Recap</CardTitle>
            </CardHeader>

            <CardContent>
              {detailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                </div>
              ) : eightDayRecap.length === 0 ? (
                <p className="text-sm text-wl-text-secondary text-center py-6">
                  No HOS records found for the past 8 days.
                </p>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-wl-border-default">
                      <th className="text-left py-2 px-3 text-wl-text-secondary font-semibold">Day</th>
                      <th className="text-center py-2 px-3 text-wl-text-secondary font-semibold">Driving</th>
                      <th className="text-center py-2 px-3 text-wl-text-secondary font-semibold">On-Duty</th>
                      <th className="text-center py-2 px-3 text-wl-text-secondary font-semibold">Total Hours</th>
                      <th className="text-center py-2 px-3 text-wl-text-secondary font-semibold">Cycle Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eightDayRecap.map((entry, idx) => (
                      <tr key={idx} className="border-b border-wl-border-default hover:bg-wl-bg-elevated">
                        <td className="py-2 px-3 font-semibold text-white">{entry.day}</td>
                        <td className="py-2 px-3 text-center text-white">{entry.driving.toFixed(1)}h</td>
                        <td className="py-2 px-3 text-center text-white">{entry.onDuty.toFixed(1)}h</td>
                        <td className="py-2 px-3 text-center text-white font-semibold">
                          {entry.total.toFixed(1)}h
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${Math.min((entry.total / 70) * 100, 100)}%` }}
                              />
                            </div>
                            <span
                              className={cn(
                                "font-semibold",
                                entry.total > 70
                                  ? "text-wl-danger-500"
                                  : entry.total > 60
                                    ? "text-wl-warning-500"
                                    : "text-white"
                              )}
                            >
                              {entry.total.toFixed(1)}h
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </CardContent>
          </Card>

          {/* Violations Timeline */}
          <ViolationTimeline violations={violations} isLoading={violationsLoading} />

          {/* Edit Request Workflow */}
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Edit2 className="w-5 h-5 text-wl-info-500" />
                Edit Request Workflow
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-wl-bg-elevated border border-wl-border-default">
                  <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wide mb-2">How It Works</p>
                  <ol className="space-y-2 text-xs text-white">
                    <li>1. Driver submits log edit request with reason and time</li>
                    <li>2. Fleet manager reviews request and documentation</li>
                    <li>3. Manager approves or rejects with feedback</li>
                    <li>4. Approved edits are logged and auditable for compliance</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    className="h-9 flex-1"
                    onClick={handleRequestEdit}
                    disabled={requestingEdit || editRequestSent}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    {requestingEdit ? "Submitting…" : editRequestSent ? "Request Sent" : "Request Edit"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9 flex-1"
                    onClick={() => router.push("/eld")}
                  >
                    <RotateCw className="w-4 h-4 mr-2" />
                    View History
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export */}
          <div className="flex justify-end">
            <Button variant="secondary" className="h-9" onClick={handleExportHOS}>
              <Download className="w-4 h-4 mr-2" />
              Export HOS Report
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
