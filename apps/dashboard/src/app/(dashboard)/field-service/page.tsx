'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiQuery, useApiList } from '@/hooks/use-api';
import { TrendingUp, Clock, CheckCircle2, Users, AlertCircle } from 'lucide-react';

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

const priorityVariant = (priority: string): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
  const m: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    low: 'default', medium: 'info', high: 'warning', urgent: 'danger',
  };
  return m[priority] ?? 'default';
};

interface FsStats {
  activeJobs: number;
  completionRate: number;
  techniciansInField: number;
  avgResponseMinutes: number;
  slaOnTimePercentage: number;
  overdueJobCount: number;
  completedToday: number;
}

interface ScheduleItem {
  jobId: string;
  technicianId: string;
  technicianName: string;
  jobNumber: string;
  customerName: string;
  location: string;
  startTime: string;
  endTime: string;
  status: WorkOrderStatus;
}

interface Job {
  id: string;
  jobNumber: string;
  customerName: string;
  status: WorkOrderStatus;
  priority: string;
  serviceType: string;
  location: string;
  assignedTechName?: string | null;
  updatedAt?: string;
}

export default function FieldServicePage() {
  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } =
    useApiQuery<FsStats>('/api/v4/field-service/stats');
  const { data: scheduleData, loading: schedLoading, error: schedError, refetch: refetchSched } =
    useApiQuery<ScheduleItem[]>('/api/v4/field-service/schedule');
  const { items: allJobs, loading: jobsLoading, error: jobsError, refetch: refetchJobs } =
    useApiList<Job>('/api/v4/field-service/jobs');

  const [selectedTech, setSelectedTech] = useState<string | null>(null);

  const loading = statsLoading || schedLoading || jobsLoading;
  const anyError = statsError || schedError || jobsError;

  const schedule = scheduleData ?? [];

  const filteredSchedule = useMemo(
    () => (selectedTech ? schedule.filter((s) => s.technicianId === selectedTech) : schedule),
    [schedule, selectedTech]
  );

  const jobQueue = useMemo(
    () => allJobs.filter((o) => ['created', 'scheduled'].includes(o.status)).slice(0, 5),
    [allJobs]
  );

  const recentCompletions = useMemo(
    () => allJobs.filter((o) => o.status === 'completed').slice(0, 8),
    [allJobs]
  );

  if (loading) return <LoadingSkeleton />;
  if (anyError) {
    return (
      <ErrorState
        message={(statsError ?? schedError ?? jobsError)?.message ?? 'Failed to load field service data'}
        onRetry={() => { refetchStats(); refetchSched(); refetchJobs(); }}
      />
    );
  }

  const technicians = Array.from(
    new Map(schedule.map((s) => [s.technicianId, { id: s.technicianId, name: s.technicianName }])).values()
  ).filter((t) => t.id);

  const overview = {
    totalTechnicians: technicians.length,
    activeJobs: stats?.activeJobs ?? 0,
    completionRate: stats?.completionRate ?? 0,
    techniciansInField: stats?.techniciansInField ?? 0,
    completedToday: stats?.completedToday ?? 0,
  };
  const slaMetrics = {
    onTimePercentage: stats?.slaOnTimePercentage ?? 0,
    overdueCount: stats?.overdueJobCount ?? 0,
    totalJobs: allJobs.length,
  };

  return (
    <>
      <Header
        title="Field Service Overview"
        subtitle={`${overview.techniciansInField} in field · ${overview.activeJobs} active jobs`}
      />

      <div className="p-6 space-y-6 bg-wl-bg-root min-h-screen">
        {/* KPI Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-wl-bg-surface border-wl-border-default border-l-4 border-l-wl-info-500">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-wl-text-secondary mb-2">Active Jobs</p>
                  <p className="text-3xl font-bold text-wl-text-primary">{overview.activeJobs}</p>
                  <p className="text-xs text-wl-text-secondary mt-2">in progress now</p>
                </div>
                <TrendingUp className="w-8 h-8 text-wl-info-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border-wl-border-default border-l-4 border-l-cyan-500">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-wl-text-secondary mb-2">In Field</p>
                  <p className="text-3xl font-bold text-wl-text-primary">{overview.techniciansInField}</p>
                  <p className="text-xs text-wl-text-secondary mt-2">dispatched technicians</p>
                </div>
                <Users className="w-8 h-8 text-wl-info-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border-wl-border-default border-l-4 border-l-emerald-500">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-wl-text-secondary mb-2">Completion Rate</p>
                  <p className="text-3xl font-bold text-wl-text-primary">{overview.completionRate}%</p>
                  <p className="text-xs text-wl-text-secondary mt-2">last 30 days</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-wl-success-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border-wl-border-default border-l-4 border-l-amber-500">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-wl-text-secondary mb-2">Completed Today</p>
                  <p className="text-3xl font-bold text-wl-text-primary">{overview.completedToday}</p>
                  <p className="text-xs text-wl-text-secondary mt-2">jobs finished</p>
                </div>
                <Clock className="w-8 h-8 text-wl-warning-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Schedule + SLA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-wl-text-primary">Today&apos;s Schedule</CardTitle>
                  <select
                    value={selectedTech ?? 'all'}
                    onChange={(e) => setSelectedTech(e.target.value === 'all' ? null : e.target.value)}
                    className="px-3 py-2 text-xs rounded border border-wl-border-default bg-wl-bg-elevated text-wl-neutral-300 focus:outline-none focus:border-wl-info-500/50"
                  >
                    <option value="all">All Technicians</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredSchedule.length === 0 ? (
                  <div className="text-center py-12 text-wl-text-tertiary">No scheduled jobs for today</div>
                ) : (
                  <div className="space-y-3">
                    {filteredSchedule.map((item) => (
                      <div
                        key={item.jobId}
                        className="flex items-center gap-4 p-4 bg-wl-bg-elevated rounded-lg border border-wl-border-default hover:border-wl-info-500/30 transition-colors"
                      >
                        <div className="w-24 flex-shrink-0">
                          <div className="text-sm font-semibold text-wl-info-400">{item.startTime}</div>
                          <div className="text-xs text-wl-text-tertiary">{item.endTime}</div>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-wl-info-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-wl-text-primary">{item.jobNumber}</div>
                          <div className="text-xs text-wl-text-secondary mt-0.5">
                            {item.customerName} · {item.location}
                          </div>
                          <div className="text-xs text-wl-text-tertiary mt-0.5">Tech: {item.technicianName}</div>
                        </div>
                        <Badge variant={statusVariant(item.status)} className="flex-shrink-0">
                          {item.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-wl-text-primary">SLA Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-sm font-medium text-wl-text-secondary">On-Time %</span>
                  <span className="text-2xl font-bold text-wl-success-400">{slaMetrics.onTimePercentage}%</span>
                </div>
                <div className="w-full bg-wl-bg-elevated rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-wl-success-500 h-2.5 rounded-full transition-all"
                    style={{ width: `${slaMetrics.onTimePercentage}%` }}
                  />
                </div>
              </div>
              <div className="h-px bg-wl-border-default" />
              <div>
                <div className="text-sm text-wl-text-secondary mb-2">Overdue Jobs</div>
                <div className="text-3xl font-bold text-wl-danger-400">{slaMetrics.overdueCount}</div>
                <div className="text-xs text-wl-text-tertiary mt-1">of {slaMetrics.totalJobs} total</div>
              </div>
              <div className="h-px bg-wl-border-default" />
              <Button variant="secondary" size="sm" className="w-full">
                View Details
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Job Queue + Recent Completions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-wl-text-primary">Job Queue (Unassigned)</CardTitle>
                <Badge variant="warning">{jobQueue.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {jobQueue.length === 0 ? (
                <div className="text-center py-12 text-wl-text-tertiary">All jobs assigned ✓</div>
              ) : (
                <div className="space-y-3">
                  {jobQueue.map((job) => (
                    <div
                      key={job.id}
                      className="p-4 bg-wl-bg-elevated rounded-lg border-l-4 border-wl-warning-500 hover:border-wl-warning-400 transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <div className="text-sm font-semibold text-wl-text-primary">{job.jobNumber}</div>
                          <div className="text-xs text-wl-text-secondary">{job.customerName}</div>
                        </div>
                        <Badge variant={priorityVariant(job.priority)}>
                          {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
                        </Badge>
                      </div>
                      <div className="text-xs text-wl-text-tertiary mb-4">
                        {job.serviceType.replace(/_/g, ' ')} · {job.location}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" className="flex-1">Auto-Assign</Button>
                        <Button variant="primary" size="sm" className="flex-1">Assign</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-wl-text-primary">Recent Completions</CardTitle>
            </CardHeader>
            <CardContent>
              {recentCompletions.length === 0 ? (
                <div className="text-center py-12 text-wl-text-tertiary">No completions yet today</div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentCompletions.map((job) => (
                    <div
                      key={job.id}
                      className="p-4 bg-wl-bg-elevated rounded-lg border-l-4 border-wl-success-500"
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div>
                          <div className="text-sm font-semibold text-wl-success-400">✓ {job.jobNumber}</div>
                          <div className="text-xs text-wl-text-secondary">{job.customerName}</div>
                        </div>
                      </div>
                      <div className="text-xs text-wl-text-tertiary mt-2">
                        {job.serviceType.replace(/_/g, ' ')} · {job.assignedTechName ?? 'Unassigned'}
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
