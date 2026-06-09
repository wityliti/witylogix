"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDriverHOS, useViolations, useELDDriverStatus, DutyStatus } from "@/hooks/use-eld";
import { HOSClock, MultiHOSGauge } from "@/components/eld/hos-clock";
import { ViolationTimeline } from "@/components/eld/violation-timeline";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  ChevronDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  Edit2,
  Download,
  RotateCw,
  TrendingDown,
} from "lucide-react";

interface DailyLogEntry {
  hour: number;
  status: DutyStatus | "NONE";
  label: string;
}

interface EightDayEntry {
  day: string;
  driving: number;
  onDuty: number;
  total: number;
}

const generateDailyLog = (): DailyLogEntry[] => {
  const log: DailyLogEntry[] = [];
  for (let i = 0; i < 24; i++) {
    if (i < 6) {
      log.push({ hour: i, status: "OFF_DUTY", label: "Off-Duty" });
    } else if (i < 10) {
      log.push({ hour: i, status: "DRIVING", label: "Driving" });
    } else if (i < 11) {
      log.push({ hour: i, status: "ON_DUTY", label: "Break" });
    } else if (i < 18) {
      log.push({ hour: i, status: "DRIVING", label: "Driving" });
    } else {
      log.push({ hour: i, status: "ON_DUTY", label: "On-Duty" });
    }
  }
  return log;
};

const generateEightDayRecap = (cycleHoursUsed = 0, drivingRemaining = 660): EightDayEntry[] => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Today"];
  const dailyAvg = cycleHoursUsed / 7;
  return days.map((day, i) => {
    const driving = i < 7 ? Math.round((dailyAvg * 0.7) * 10) / 10 : Math.round(((660 - drivingRemaining) / 60) * 10) / 10;
    const onDuty = i < 7 ? Math.round((dailyAvg * 0.3) * 10) / 10 : 0;
    return { day, driving, onDuty, total: Math.round((driving + onDuty) * 10) / 10 };
  });
};

const dutyStatusColor = (status: DutyStatus): string => {
  const colors: Record<DutyStatus, string> = {
    OFF_DUTY: "bg-gray-600/40",
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
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [personalConveyance, setPersonalConveyance] = useState(false);
  const [yardMove, setYardMove] = useState(false);

  const { items: driverList, loading: driversLoading, error: driversError, refetch: refetchDrivers } = useELDDriverStatus();
  const { data: hos, loading: isLoading } = useDriverHOS(selectedDriverId);
  const { items: violations, loading: violationsLoading } = useViolations({ search: selectedDriverId ?? undefined });

  // Auto-select first driver when loaded
  useEffect(() => {
    if (!selectedDriverId && driverList.length > 0) {
      setSelectedDriverId(driverList[0].driverId);
    }
  }, [driverList, selectedDriverId]);

  const dailyLog = useMemo(() => generateDailyLog(), []);
  const eightDayRecap = useMemo(
    () => generateEightDayRecap(hos?.cycleHoursUsed, hos?.drivingTimeRemaining),
    [hos?.cycleHoursUsed, hos?.drivingTimeRemaining]
  );

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
                  "w-4 h-4 text-gray-400 transition-transform",
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
                          ? "bg-blue-500/10 text-blue-400"
                          : "text-gray-400 hover:bg-wl-bg-root"
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
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
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
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Duty Status</p>
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
                              : "bg-gray-400"
                      )}
                    />
                    <p className="text-sm font-semibold text-white">{hos.currentStatus.replace(/_/g, " ")}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Break Status</p>
                  <Badge variant={hos.breakStatus === "TAKEN" ? "success" : "warning"}>
                    {hos.breakStatus === "TAKEN" ? "✓ Taken" : "⚠ Required"}
                  </Badge>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Last Updated</p>
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

                <p className="text-xs text-gray-400 pt-2 border-t border-wl-border-default">
                  These HOS exemptions apply only with proper authorization
                </p>
              </CardContent>
            </Card>

            {/* Compliance Alert */}
            <Card
              className={cn(
                "bg-wl-bg-surface border-wl-border-default",
                hosStatus === "critical" && "border-red-500/50 bg-red-500/5"
              )}
            >
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-white">
                  {hosStatus === "compliant" && (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Compliant
                    </>
                  )}
                  {hosStatus === "warning" && (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Caution
                    </>
                  )}
                  {hosStatus === "critical" && (
                    <>
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      Critical
                    </>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent className="text-xs text-gray-400">
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
                <span className="text-xs text-gray-400">{new Date().toLocaleDateString()}</span>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-2">
                {/* Hour labels */}
                <div className="flex text-xs text-gray-400">
                  <div className="w-12" />
                  <div className="flex-1 flex gap-2">
                    {Array.from({ length: 24 }, (_, i) => (
                      <div key={i} className="flex-1 text-center text-gray-400">
                        {String(i).padStart(2, "0")}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status bars */}
                {[hos.currentStatus].map((statusType) => (
                  <div key={statusType} className="flex items-center gap-2">
                    <div className="w-12 text-xs font-semibold text-gray-400">{dutyStatusLabel[statusType]}</div>
                    <div className="flex-1 flex gap-2 h-8">
                      {dailyLog.map((entry) => (
                        <div
                          key={entry.hour}
                          className={cn(
                            "flex-1 rounded-sm transition-all hover:opacity-80",
                            entry.status === "NONE" ? "bg-white/3" : dutyStatusColor(entry.status)
                          )}
                          title={`${String(entry.hour).padStart(2, "0")}:00 - ${entry.label}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Legend */}
                <div className="pt-4 flex flex-wrap gap-4 text-xs text-gray-400 border-t border-wl-border-default">
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
                    <div className="w-3 h-3 rounded-sm bg-gray-600/40" />
                    Off-Duty
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 8-Day Recap Table */}
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-lg text-white">8-Day Cycle Recap</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-wl-border-default">
                      <th className="text-left py-2 px-3 text-gray-400 font-semibold">Day</th>
                      <th className="text-center py-2 px-3 text-gray-400 font-semibold">Driving</th>
                      <th className="text-center py-2 px-3 text-gray-400 font-semibold">On-Duty</th>
                      <th className="text-center py-2 px-3 text-gray-400 font-semibold">Total Hours</th>
                      <th className="text-center py-2 px-3 text-gray-400 font-semibold">Cycle Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eightDayRecap.map((entry, idx) => (
                      <tr key={idx} className="border-b border-wl-border-default hover:bg-wl-bg-elevated">
                        <td className="py-2 px-3 font-semibold text-white">{entry.day}</td>
                        <td className="py-2 px-3 text-center text-white">{entry.driving.toFixed(1)}h</td>
                        <td className="py-2 px-3 text-center text-white">{entry.onDuty.toFixed(1)}h</td>
                        <td className="py-2 px-3 text-center text-white font-semibold">
                          {(entry.driving + entry.onDuty).toFixed(1)}h
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${(entry.total / 70) * 100}%` }}
                              />
                            </div>
                            <span
                              className={cn(
                                "font-semibold",
                                entry.total > 70
                                  ? "text-red-500"
                                  : entry.total > 60
                                    ? "text-amber-500"
                                    : "text-white"
                              )}
                            >
                              {entry.total}h
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Violations Timeline */}
          <ViolationTimeline violations={violations} isLoading={violationsLoading} />

          {/* Edit Request Workflow */}
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Edit2 className="w-5 h-5 text-blue-500" />
                Edit Request Workflow
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-wl-bg-elevated border border-wl-border-default">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">How It Works</p>
                  <ol className="space-y-2 text-xs text-white">
                    <li>1. Driver submits log edit request with reason and time</li>
                    <li>2. Fleet manager reviews request and documentation</li>
                    <li>3. Manager approves or rejects with feedback</li>
                    <li>4. Approved edits are logged and auditable for compliance</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <Button variant="primary" className="h-9 flex-1">
                    <Edit2 className="w-4 h-4 mr-2" />
                    Request Edit
                  </Button>
                  <Button variant="secondary" className="h-9 flex-1">
                    <RotateCw className="w-4 h-4 mr-2" />
                    View History
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export */}
          <div className="flex justify-end">
            <Button variant="secondary" className="h-9">
              <Download className="w-4 h-4 mr-2" />
              Export HOS Report
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
