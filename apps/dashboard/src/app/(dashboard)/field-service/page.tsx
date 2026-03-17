"use client";

import { useState, useMemo } from "react";
import { Header } from "../../../components/layout/header";
import { StatCard } from "../../../components/ui/stat-card";
import { Card, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import {
  useFieldServiceOverview,
  useJobSchedule,
  useSLAMetrics,
  useWorkOrders,
  useTechnicians,
  type WorkOrderStatus,
} from "../../../hooks/use-field-service";

/**
 * Field Service Overview Page
 * Shows active jobs, technicians in field, completion rates, SLA compliance, schedule, and job queue
 */

const statusVariant = (status: WorkOrderStatus): "success" | "warning" | "info" | "primary" | "default" => {
  const map: Record<WorkOrderStatus, "success" | "warning" | "info" | "primary" | "default"> = {
    created: "default",
    scheduled: "info",
    dispatched: "info",
    in_progress: "warning",
    completed: "success",
    cancelled: "default",
  };
  return map[status];
};

const priorityVariant = (priority: string): "default" | "success" | "warning" | "danger" | "info" | "primary" => {
  const map: Record<string, "default" | "success" | "warning" | "danger" | "info" | "primary"> = {
    low: "default",
    medium: "info",
    high: "warning",
    urgent: "danger",
  };
  return map[priority] || "default";
};

export default function FieldServicePage() {
  const overview = useFieldServiceOverview();
  const { schedule, isLoading: scheduleLoading } = useJobSchedule();
  const slaMetrics = useSLAMetrics();
  const { orders: allOrders } = useWorkOrders();
  const { technicians } = useTechnicians();

  const [selectedTech, setSelectedTech] = useState<string | null>(null);

  // Filter pending/unassigned jobs for queue
  const jobQueue = useMemo(
    () => allOrders.filter((o) => ["created", "scheduled"].includes(o.status)).slice(0, 5),
    [allOrders]
  );

  // Filter recent completions
  const recentCompletions = useMemo(
    () =>
      allOrders
        .filter((o) => o.status === "completed")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8),
    [allOrders]
  );

  // Schedule items filtered by selected technician
  const filteredSchedule = useMemo(
    () => (selectedTech ? schedule.filter((s) => s.technicianId === selectedTech) : schedule),
    [schedule, selectedTech]
  );

  return (
    <>
      <Header
        title="Field Service Overview"
        subtitle={`${overview.totalTechnicians} technicians · ${overview.activeJobs} active jobs · ${overview.completionRate}% completion rate`}
        actions={<Button variant="primary" size="md">+ Create Work Order</Button>}
      />

      <div className="p-6">
        {/* ═══ KPI Stats Row ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 auto-rows-max">
          <StatCard
            label="Active Jobs"
            value={overview.activeJobs}
            change={{ value: 8.5, label: "vs yesterday" }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="In Field"
            value={overview.techniciansInField}
            change={{ value: 2.0, label: "dispatched" }}
            accentColor="var(--wl-info-400)"
            index={1}
          />
          <StatCard
            label="Completion Rate"
            value={`${overview.completionRate}%`}
            change={{ value: 3.5, label: "growth" }}
            accentColor="var(--wl-success-400)"
            index={2}
          />
          <StatCard
            label="Avg Response"
            value={`${overview.avgResponseTime}m`}
            change={{ value: -2.0, label: "faster" }}
            accentColor="var(--wl-warning-400)"
            index={3}
          />
        </div>

        {/* ═══ Main Grid: Schedule + SLA + Job Queue ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          {/* Schedule Timeline */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Today's Schedule</CardTitle>
                  <select
                    value={selectedTech || "all"}
                    onChange={(e) => setSelectedTech(e.target.value === "all" ? null : e.target.value)}
                    className="px-3 py-1 text-xs rounded border border-slate-700 bg-slate-900 text-slate-100 focus:outline-none"
                  >
                    <option value="all">All Technicians</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </CardHeader>

              <div className="p-4">
                {scheduleLoading ? (
                  <div className="text-center py-8 text-slate-400">Loading schedule...</div>
                ) : filteredSchedule.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">No scheduled jobs</div>
                ) : (
                  <div className="space-y-3">
                    {filteredSchedule.map((item, idx) => (
                      <div
                        key={item.jobId}
                        className="flex items-center gap-4 p-3 bg-slate-800 rounded-md border border-slate-700 hover:border-slate-600 transition-colors opacity-0"
                        style={{
                          animation: `wl-fade-in var(--wl-duration-default) var(--wl-ease-default) ${idx * 50}ms forwards`,
                        }}
                      >
                        {/* Time */}
                        <div className="w-20 flex-shrink-0">
                          <div className="text-sm font-semibold text-indigo-400">
                            {item.startTime}
                          </div>
                          <div className="text-xs text-slate-400">
                            {item.endTime}
                          </div>
                        </div>

                        {/* Timeline dot */}
                        <div className="w-3 h-3 rounded-full bg-indigo-500 flex-shrink-0" />

                        {/* Job details */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-100">
                            {item.jobNumber}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {item.customerName} • {item.location}
                          </div>
                        </div>

                        {/* Status badge */}
                        <Badge variant={statusVariant(item.status)} className="flex-shrink-0">
                          {item.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* SLA Compliance Tracker */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>SLA Compliance</CardTitle>
              </CardHeader>

              <div className="p-4 space-y-4">
                {/* On-time percentage */}
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm font-medium text-slate-100">
                      On-Time Percentage
                    </span>
                    <span className="text-2xl font-bold text-green-400">
                      {slaMetrics.onTimePercentage}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${slaMetrics.onTimePercentage}%` }}
                    />
                  </div>
                </div>

                <div className="h-px bg-slate-700" />

                {/* Overdue jobs */}
                <div>
                  <div className="text-sm text-slate-400 mb-2">Overdue Jobs</div>
                  <div className="text-3xl font-bold text-red-400">
                    {slaMetrics.overdueCount}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    of {slaMetrics.totalJobs} total
                  </div>
                </div>

                <div className="h-px bg-slate-700" />

                {/* Avg completion time */}
                <div>
                  <div className="text-sm text-slate-400 mb-2">Avg Completion</div>
                  <div className="text-3xl font-bold text-blue-400">
                    {slaMetrics.avgCompletionTime}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">minutes</div>
                </div>

                <div className="h-px bg-slate-700" />

                <Button variant="secondary" size="sm" className="w-full">
                  View Details
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* ═══ Job Queue + Recent Completions ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Job Queue */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Job Queue (Unassigned)</CardTitle>
                <Badge variant="warning">{jobQueue.length}</Badge>
              </div>
            </CardHeader>

            <div className="p-4">
              {jobQueue.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  All jobs assigned! ✓
                </div>
              ) : (
                <div className="space-y-3">
                  {jobQueue.map((job, idx) => (
                    <div
                      key={job.id}
                      className="p-3 bg-slate-800 rounded-md border-l-4 border-slate-700 hover:border-indigo-500 transition-colors opacity-0 cursor-pointer group"
                      style={{
                        animation: `wl-fade-in var(--wl-duration-default) var(--wl-ease-default) ${idx * 50}ms forwards`,
                      }}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-100">
                            {job.jobNumber}
                          </div>
                          <div className="text-xs text-slate-400">
                            {job.customerName}
                          </div>
                        </div>
                        <Badge variant={priorityVariant(job.priority)}>
                          {job.priority}
                        </Badge>
                      </div>

                      <div className="text-xs text-slate-400 mb-2">
                        {job.serviceType.replace(/_/g, " ")} • {job.location}
                      </div>

                      <div className="flex gap-2">
                        <Button variant="ghost" size="xs" className="text-xs flex-1">
                          Auto-Assign
                        </Button>
                        <Button variant="secondary" size="xs" className="text-xs flex-1">
                          Assign
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Recent Completions Feed */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Completions</CardTitle>
            </CardHeader>

            <div className="p-4">
              {recentCompletions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No completions yet today
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {recentCompletions.map((job, idx) => (
                    <div
                      key={job.id}
                      className="p-3 bg-slate-800 rounded-md border-l-4 border-green-500 opacity-0"
                      style={{
                        animation: `wl-fade-in var(--wl-duration-default) var(--wl-ease-default) ${idx * 50}ms forwards`,
                      }}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div>
                          <div className="text-sm font-semibold text-green-400">
                            ✓ {job.jobNumber}
                          </div>
                          <div className="text-xs text-slate-400">
                            {job.customerName}
                          </div>
                        </div>
                        <div className="text-xs text-slate-400">
                          {job.completionTime}
                        </div>
                      </div>

                      <div className="text-xs text-slate-400 mt-1">
                        {job.serviceType.replace(/_/g, " ")} • {job.assignedTechName}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
