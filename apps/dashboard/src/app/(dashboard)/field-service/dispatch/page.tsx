"use client";

import { useState, useMemo } from "react";
import { Header } from "../../../../components/layout/header";
import { Card, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { cn } from "../../../../lib/utils";
import {
  useDispatchMap,
  useAutoAssign,
  useTechnicians,
  type TechnicianStatus,
} from "../../../../hooks/use-field-service";

/**
 * Dispatch Management Page
 * Map view with technician locations, job pins, and real-time status updates
 */

const techStatusVariant = (status: TechnicianStatus): "success" | "warning" | "info" | "primary" | "default" => {
  const map: Record<TechnicianStatus, "success" | "warning" | "info" | "primary" | "default"> = {
    available: "success",
    on_job: "info",
    break: "warning",
    offline: "default",
  };
  return map[status];
};

const jobStatusColor: Record<string, string> = {
  created: "#6b7280",
  scheduled: "#3b82f6",
  dispatched: "#8b5cf6",
  in_progress: "#f59e0b",
  completed: "#10b981",
};

const getJobStatusIcon = (status: string) => {
  const icons: Record<string, string> = {
    created: "📋",
    scheduled: "📅",
    dispatched: "🚗",
    in_progress: "⚙️",
    completed: "✓",
  };
  return icons[status] || "📍";
};

export default function DispatchPage() {
  const { technicians: allTechs, jobs } = useDispatchMap();
  const { suggestAssignment, isLoading: assignLoading } = useAutoAssign();
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TechnicianStatus | "all">("all");

  // Filter technicians by status
  const filteredTechs = useMemo(
    () =>
      statusFilter === "all"
        ? allTechs
        : allTechs.filter((t) => t.status === statusFilter),
    [allTechs, statusFilter]
  );

  const selectedTechData = selectedTech ? allTechs.find((t) => t.id === selectedTech) : null;

  return (
    <>
      <Header
        title="Dispatch Management"
        subtitle={`${allTechs.filter((t) => t.status === "on_job").length} in field · ${jobs.length} active jobs`}
        actions={<Button variant="primary" size="md">+ New Assignment</Button>}
      />

      <div className="p-6">
        {/* ═══ Main Grid: Map + Technician Panel ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 mb-6">
          {/* Map Card */}
          <Card>
            <CardHeader>
              <CardTitle>Live Dispatch Map</CardTitle>
            </CardHeader>

            <div className="p-4 bg-slate-800 rounded-b-lg" style={{ height: "500px" }}>
              {/* Map Placeholder */}
              <div className="w-full h-full rounded-md bg-slate-900 border border-slate-700 flex items-center justify-center relative overflow-hidden">
                {/* Background grid effect */}
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage:
                      "linear-gradient(0deg, transparent 24%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,0.05) 75%, rgba(255,255,255,0.05) 76%, transparent 77%, transparent)",
                    backgroundSize: "50px 50px",
                  }}
                />

                {/* Technician Markers */}
                {filteredTechs.map((tech, idx) => {
                  const x = (parseInt(tech.id.split("-")[1]) * 13 + 20) % 80 + 10;
                  const y = (parseInt(tech.id.split("-")[1]) * 17 + 30) % 80 + 10;
                  return (
                    <button
                      key={tech.id}
                      onClick={() => setSelectedTech(tech.id)}
                      className={cn(
                        "absolute w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all cursor-pointer",
                        selectedTech === tech.id
                          ? "border-indigo-400 ring-2 ring-indigo-400 scale-125 z-20"
                          : "border-slate-600 hover:border-slate-500 z-10"
                      )}
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        background: tech.status === "available" ? "#10b981" :
                                   tech.status === "on_job" ? "#3b82f6" :
                                   tech.status === "break" ? "#f59e0b" : "#6b7280",
                      }}
                      title={tech.name}
                    >
                      🧑
                    </button>
                  );
                })}

                {/* Job Pins */}
                {jobs.map((job, idx) => {
                  const x = (parseInt(job.id.split("-")[1]) * 19 + 25) % 90 + 5;
                  const y = (parseInt(job.id.split("-")[1]) * 23 + 35) % 90 + 5;
                  return (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job.id)}
                      className={cn(
                        "absolute w-8 h-8 rounded-full flex items-center justify-center text-xs border transition-all cursor-pointer z-10",
                        selectedJob === job.id
                          ? "border-indigo-400 ring-2 ring-indigo-400 scale-125 z-30"
                          : "border-slate-600 hover:border-slate-500"
                      )}
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        backgroundColor: jobStatusColor[job.status],
                      }}
                      title={job.jobNumber}
                    >
                      {getJobStatusIcon(job.status)}
                    </button>
                  );
                })}

                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center text-slate-500">
                    <div className="text-4xl mb-2">🗺️</div>
                    <div className="text-sm">Live Dispatch Map</div>
                    <div className="text-xs text-slate-600 mt-1">Click markers to select</div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#10b981" }} />
                  <span className="text-slate-400">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
                  <span className="text-slate-400">On Job</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
                  <span className="text-slate-400">Break</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#6b7280" }} />
                  <span className="text-slate-400">Offline</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Technician Panel */}
          <div className="space-y-4">
            {/* Status Filter */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Filter by Status</CardTitle>
              </CardHeader>

              <div className="p-3 space-y-2">
                {(["all", "available", "on_job", "break", "offline"] as const).map(
                  (status) => {
                    const count =
                      status === "all"
                        ? allTechs.length
                        : allTechs.filter((t) => t.status === status).length;
                    return (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={cn(
                          "w-full px-3 py-2 rounded text-xs font-medium text-left transition-all",
                          statusFilter === status
                            ? "bg-indigo-500 text-slate-50"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        )}
                      >
                        <div className="flex justify-between">
                          <span className="capitalize">{status === "all" ? "All" : status.replace(/_/g, " ")}</span>
                          <span className="text-slate-400">({count})</span>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </Card>

            {/* Selected Technician Detail */}
            {selectedTechData && (
              <Card className="sticky" style={{ top: "24px" }}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{selectedTechData.name}</CardTitle>
                      <div className="text-xs text-slate-400 mt-1">{selectedTechData.location}</div>
                    </div>
                    <Badge variant={techStatusVariant(selectedTechData.status)}>
                      {selectedTechData.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardHeader>

                <div className="p-4 space-y-3">
                  {/* Current Job */}
                  {selectedTechData.currentJobId && (
                    <>
                      <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase mb-1">
                          Current Job
                        </div>
                        <div className="text-sm text-slate-100 font-medium">
                          {selectedTechData.currentJobId}
                        </div>
                      </div>

                      <div className="h-px bg-slate-700" />
                    </>
                  )}

                  {/* Skills */}
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                      Skills
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedTechData.skillSet.map((skill) => (
                        <Badge key={skill} variant="primary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="h-px bg-slate-700" />

                  {/* Workload */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-slate-400 uppercase">
                        Workload
                      </span>
                      <span className="text-sm font-bold text-slate-100">
                        {selectedTechData.currentWorkload}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div
                        className={cn(
                          "h-2 rounded-full transition-all",
                          selectedTechData.currentWorkload > 80
                            ? "bg-red-500"
                            : selectedTechData.currentWorkload > 50
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        )}
                        style={{ width: `${selectedTechData.currentWorkload}%` }}
                      />
                    </div>
                  </div>

                  <div className="h-px bg-slate-700" />

                  {/* Rating & Performance */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Rating</div>
                      <div className="text-lg font-bold text-yellow-400">
                        {selectedTechData.ratings.toFixed(1)}★
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Response</div>
                      <div className="text-lg font-bold text-blue-400">
                        {selectedTechData.responseTime}m
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-slate-700" />

                  {/* Total Completed */}
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Jobs Completed</div>
                    <div className="text-2xl font-bold text-indigo-400">
                      {selectedTechData.jobsCompleted}
                    </div>
                  </div>

                  <div className="h-px bg-slate-700" />

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Button variant="primary" size="sm" className="w-full text-xs">
                      Send Assignment
                    </Button>
                    <Button variant="secondary" size="sm" className="w-full text-xs">
                      Send Message
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full text-xs">
                      Call
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* ═══ Auto-Assign & Optimization Section ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Active Assignments */}
          <Card>
            <CardHeader>
              <CardTitle>Active Assignments</CardTitle>
            </CardHeader>

            <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
              {jobs
                .filter((j) => j.assignedTechId)
                .map((job) => {
                  const tech = allTechs.find((t) => t.id === job.assignedTechId);
                  return (
                    <div
                      key={job.id}
                      className="p-3 bg-slate-800 rounded-md border-l-4 border-blue-500 hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-100">
                            {job.jobNumber}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {tech?.name || "Unknown Tech"}
                          </div>
                        </div>
                        <Badge variant="info">{job.status.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="text-xs text-slate-400">
                        {job.location}
                      </div>
                    </div>
                  );
                })}

              {jobs.filter((j) => j.assignedTechId).length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No active assignments
                </div>
              )}
            </div>
          </Card>

          {/* Route Optimization */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Dispatch</CardTitle>
            </CardHeader>

            <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
              {jobs
                .filter((j) => !j.assignedTechId && j.status !== "completed")
                .slice(0, 6)
                .map((job, idx) => (
                  <div
                    key={job.id}
                    className="p-3 bg-slate-800 rounded-md border-l-4 border-yellow-500 opacity-0"
                    style={{
                      animation: `wl-fade-in var(--wl-duration-default) var(--wl-ease-default) ${idx * 50}ms forwards`,
                    }}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100">
                          {job.jobNumber}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {job.customerName}
                        </div>
                      </div>
                      <Badge variant="warning">{job.priority}</Badge>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => suggestAssignment(job.id)}
                        className={cn(
                          "flex-1 px-2 py-1 text-xs bg-indigo-500 hover:bg-indigo-600 text-slate-50 rounded transition-colors",
                          assignLoading && "opacity-50 cursor-not-allowed"
                        )}
                        disabled={assignLoading}
                      >
                        {assignLoading ? "..." : "Auto"}
                      </button>
                      <button className="flex-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors">
                        Assign
                      </button>
                    </div>
                  </div>
                ))}

              {jobs.filter((j) => !j.assignedTechId && j.status !== "completed").length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  All jobs assigned!
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
