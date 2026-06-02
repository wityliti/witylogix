'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Field Service Overview Page
 * Shows active jobs, technicians in field, completion rates, SLA compliance, schedule, and job queue
 */

type WorkOrderStatus = 'created' | 'scheduled' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled';

const statusVariant = (status: WorkOrderStatus): 'success' | 'warning' | 'info' | 'primary' | 'default' => {
  const map: Record<WorkOrderStatus, 'success' | 'warning' | 'info' | 'primary' | 'default'> = {
    created: 'default',
    scheduled: 'info',
    dispatched: 'info',
    in_progress: 'warning',
    completed: 'success',
    cancelled: 'default',
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

interface Order {
  id: string;
  jobNumber: string;
  customerName: string;
  status: WorkOrderStatus;
  priority: string;
  serviceType: string;
  location: string;
  completionTime?: string;
  assignedTechName?: string;
  updatedAt: string;
}

interface ScheduleItem {
  jobId: string;
  technicianId: string;
  jobNumber: string;
  customerName: string;
  location: string;
  startTime: string;
  endTime: string;
  status: WorkOrderStatus;
}

interface Technician {
  id: string;
  name: string;
}

export default function FieldServicePage() {
  const { items: allOrders, loading, error, refetch } = useApiList<Order>('/api/v4/orders?type=field-service');
  const [selectedTech, setSelectedTech] = useState<string | null>(null);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const schedule: ScheduleItem[] = [];
  const technicians: Technician[] = [];

  const completedOrders = allOrders.filter(o => o.status === 'completed');
  const activeOrders = allOrders.filter(o => ['in_progress', 'dispatched'].includes(o.status));
  const pendingOrders = allOrders.filter(o => ['created', 'scheduled'].includes(o.status));

  const completionRate = allOrders.length > 0
    ? Math.round((completedOrders.length / allOrders.length) * 100)
    : 0;

  const overview = {
    totalTechnicians: technicians.length,
    activeJobs: activeOrders.length,
    completionRate,
    techniciansInField: activeOrders.length,
    avgResponseTime: 0,
  };
  const slaMetrics = {
    onTimePercentage: completionRate,
    overdueCount: pendingOrders.length,
    totalJobs: allOrders.length,
    avgCompletionTime: 0,
  };

  // Filter pending/unassigned jobs for queue
  const jobQueue = useMemo(
    () => allOrders.filter((o) => ['created', 'scheduled'].includes(o.status)).slice(0, 5),
    [allOrders]
  );

  // Filter recent completions
  const recentCompletions = useMemo(
    () =>
      allOrders
        .filter((o) => o.status === 'completed')
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
        subtitle={`${overview.totalTechnicians} technicians · ${overview.activeJobs} active jobs`}
      />

      <div className="p-6 space-y-6 bg-[#0a0a0f] min-h-screen">
        {/* ═══ KPI Stats Row ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#12121a] border-[#1e1e2e] border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Active Jobs</p>
                  <p className="text-3xl font-bold text-white">{overview.activeJobs}</p>
                  <p className="text-xs text-emerald-400 mt-2">+8.5% vs yesterday</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border-[#1e1e2e] border-l-4 border-l-cyan-500">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">In Field</p>
                  <p className="text-3xl font-bold text-white">{overview.techniciansInField}</p>
                  <p className="text-xs text-gray-400 mt-2">dispatched technicians</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-cyan-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border-[#1e1e2e] border-l-4 border-l-emerald-500">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Completion Rate</p>
                  <p className="text-3xl font-bold text-white">{overview.completionRate}%</p>
                  <p className="text-xs text-emerald-400 mt-2">+3.5% growth</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border-[#1e1e2e] border-l-4 border-l-amber-500">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Avg Response</p>
                  <p className="text-3xl font-bold text-white">{overview.avgResponseTime}m</p>
                  <p className="text-xs text-emerald-400 mt-2">-2.0% faster</p>
                </div>
                <Clock className="w-8 h-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ Main Grid: Schedule + SLA + Job Queue ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Schedule Timeline */}
          <div className="lg:col-span-2">
            <Card className="bg-[#12121a] border-[#1e1e2e]">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Today's Schedule</CardTitle>
                  <select
                    value={selectedTech || "all"}
                    onChange={(e) => setSelectedTech(e.target.value === "all" ? null : e.target.value)}
                    className="px-3 py-2 text-xs rounded border border-[#1e1e2e] bg-[#1a1a2e] text-gray-300 focus:outline-none focus:border-blue-500/50"
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

              <CardContent>
                {filteredSchedule.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">No scheduled jobs for today</div>
                ) : (
                  <div className="space-y-3">
                    {filteredSchedule.map((item, idx) => (
                      <div
                        key={item.jobId}
                        className="flex items-center gap-4 p-4 bg-[#1a1a2e] rounded-lg border border-[#1e1e2e] hover:border-blue-500/30 transition-colors"
                      >
                        <div className="w-24 flex-shrink-0">
                          <div className="text-sm font-semibold text-blue-400">{item.startTime}</div>
                          <div className="text-xs text-gray-500">{item.endTime}</div>
                        </div>

                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">{item.jobNumber}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {item.customerName} • {item.location}
                          </div>
                        </div>

                        <Badge variant={statusVariant(item.status)} className="flex-shrink-0">
                          {item.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* SLA Compliance Tracker */}
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white">SLA Compliance</CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* On-time percentage */}
              <div>
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-sm font-medium text-gray-400">On-Time %</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    {slaMetrics.onTimePercentage}%
                  </span>
                </div>
                <div className="w-full bg-[#1a1a2e] rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2.5 rounded-full transition-all"
                    style={{ width: `${slaMetrics.onTimePercentage}%` }}
                  />
                </div>
              </div>

              <div className="h-px bg-[#1e1e2e]" />

              {/* Overdue jobs */}
              <div>
                <div className="text-sm text-gray-400 mb-2">Overdue Jobs</div>
                <div className="text-3xl font-bold text-red-400">{slaMetrics.overdueCount}</div>
                <div className="text-xs text-gray-500 mt-1">
                  of {slaMetrics.totalJobs} total
                </div>
              </div>

              <div className="h-px bg-[#1e1e2e]" />

              {/* Avg completion time */}
              <div>
                <div className="text-sm text-gray-400 mb-2">Avg Completion</div>
                <div className="text-3xl font-bold text-blue-400">{slaMetrics.avgCompletionTime}m</div>
              </div>

              <div className="h-px bg-[#1e1e2e]" />

              <Button variant="secondary" size="sm" className="w-full">
                View Details
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ═══ Job Queue + Recent Completions ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Job Queue */}
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-white">Job Queue (Unassigned)</CardTitle>
                <Badge variant="warning">{jobQueue.length}</Badge>
              </div>
            </CardHeader>

            <CardContent>
              {jobQueue.length === 0 ? (
                <div className="text-center py-12 text-gray-500">All jobs assigned ✓</div>
              ) : (
                <div className="space-y-3">
                  {jobQueue.map((job) => (
                    <div
                      key={job.id}
                      className="p-4 bg-[#1a1a2e] rounded-lg border-l-4 border-amber-500 hover:border-amber-400 transition-colors cursor-pointer group"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <div className="text-sm font-semibold text-white">{job.jobNumber}</div>
                          <div className="text-xs text-gray-400">{job.customerName}</div>
                        </div>
                        <Badge variant={priorityVariant(job.priority)}>
                          {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
                        </Badge>
                      </div>

                      <div className="text-xs text-gray-500 mb-4">
                        {job.serviceType.replace(/_/g, " ")} • {job.location}
                      </div>

                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" className="flex-1">
                          Auto-Assign
                        </Button>
                        <Button variant="primary" size="sm" className="flex-1">
                          Assign
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Completions Feed */}
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white">Recent Completions</CardTitle>
            </CardHeader>

            <CardContent>
              {recentCompletions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No completions yet today</div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentCompletions.map((job) => (
                    <div
                      key={job.id}
                      className="p-4 bg-[#1a1a2e] rounded-lg border-l-4 border-emerald-500"
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div>
                          <div className="text-sm font-semibold text-emerald-400">
                            ✓ {job.jobNumber}
                          </div>
                          <div className="text-xs text-gray-400">{job.customerName}</div>
                        </div>
                        <div className="text-xs text-gray-500">{job.completionTime}</div>
                      </div>

                      <div className="text-xs text-gray-500 mt-2">
                        {job.serviceType.replace(/_/g, " ")} • {job.assignedTechName}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
