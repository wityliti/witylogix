'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import { TrendingUp, Clock, CheckCircle2, Users } from 'lucide-react';

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

interface FieldServiceStats {
  activeJobs: number;
  techniciansInField: number;
  completionRate: number;
  avgResponseTime: number;
  totalJobs30d: number;
  completedToday: number;
  totalToday: number;
  sla: {
    onTimePercentage: number;
    overdueCount: number;
    totalJobs: number;
  };
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

interface ScheduleData {
  schedule: ScheduleItem[];
  technicians: Array<{ id: string; name: string }>;
}

export default function FieldServicePage() {
  const [selectedTech, setSelectedTech] = useState<string | null>(null);

  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useApiQuery<FieldServiceStats>('/api/v4/field-service/stats');
  const { data: scheduleData, loading: schedLoading, error: schedError, refetch: refetchSched } = useApiQuery<ScheduleData>('/api/v4/field-service/schedule');

  if (statsLoading || schedLoading) return <LoadingSkeleton />;
  if (statsError) return <ErrorState message={statsError.message} onRetry={refetchStats} />;
  if (schedError) return <ErrorState message={schedError.message} onRetry={refetchSched} />;

  const schedule = scheduleData?.schedule ?? [];
  const technicians = scheduleData?.technicians ?? [];

  const filteredSchedule = useMemo(
    () => (selectedTech ? schedule.filter((s) => s.technicianId === selectedTech) : schedule),
    [schedule, selectedTech]
  );

  // Jobs visible in queue (created/scheduled)
  const jobQueue = schedule.filter((s) => ['created', 'scheduled'].includes(s.status)).slice(0, 5);

  // Recent completions from schedule
  const recentCompletions = schedule
    .filter((s) => s.status === 'completed')
    .slice(0, 8);

  return (
    <>
      <Header
        title="Field Service Overview"
        subtitle={`${stats?.techniciansInField ?? 0} technicians in field · ${stats?.activeJobs ?? 0} active jobs`}
      />

      <div className="p-6 space-y-6 bg-[#0a0a0f] min-h-screen">
        {/* ═══ KPI Stats Row ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#12121a] border-[#1e1e2e] border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Active Jobs</p>
                  <p className="text-3xl font-bold text-white">{stats?.activeJobs ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-2">in progress right now</p>
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
                  <p className="text-3xl font-bold text-white">{stats?.techniciansInField ?? 0}</p>
                  <p className="text-xs text-gray-400 mt-2">dispatched technicians</p>
                </div>
                <Users className="w-8 h-8 text-cyan-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border-[#1e1e2e] border-l-4 border-l-emerald-500">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Completion Rate</p>
                  <p className="text-3xl font-bold text-white">{stats?.completionRate ?? 0}%</p>
                  <p className="text-xs text-gray-500 mt-2">last 30 days</p>
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
                  <p className="text-3xl font-bold text-white">
                    {stats?.avgResponseTime ? `${stats.avgResponseTime}m` : '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">ETA vs actual this week</p>
                </div>
                <Clock className="w-8 h-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ Main Grid: Schedule + SLA ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Schedule Timeline */}
          <div className="lg:col-span-2">
            <Card className="bg-[#12121a] border-[#1e1e2e]">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Today's Schedule</CardTitle>
                  <select
                    value={selectedTech || 'all'}
                    onChange={(e) => setSelectedTech(e.target.value === 'all' ? null : e.target.value)}
                    className="px-3 py-2 text-xs rounded border border-[#1e1e2e] bg-[#1a1a2e] text-gray-300 focus:outline-none focus:border-blue-500/50"
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
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                    <p className="text-sm">No scheduled jobs for today</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSchedule.map((item) => (
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
                            {item.customerName} · {item.location}
                          </div>
                          {item.technicianName && (
                            <div className="text-xs text-blue-400 mt-0.5">{item.technicianName}</div>
                          )}
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

          {/* SLA Compliance Tracker */}
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white">SLA Compliance</CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <div>
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-sm font-medium text-gray-400">On-Time %</span>
                  <span className={cn('text-2xl font-bold', (stats?.sla.onTimePercentage ?? 0) >= 90 ? 'text-emerald-400' : 'text-amber-400')}>
                    {stats?.sla.onTimePercentage ?? 0}%
                  </span>
                </div>
                <div className="w-full bg-[#1a1a2e] rounded-full h-2.5 overflow-hidden">
                  <div
                    className={cn('h-2.5 rounded-full transition-all', (stats?.sla.onTimePercentage ?? 0) >= 90 ? 'bg-emerald-500' : 'bg-amber-500')}
                    style={{ width: `${stats?.sla.onTimePercentage ?? 0}%` }}
                  />
                </div>
              </div>

              <div className="h-px bg-[#1e1e2e]" />

              <div>
                <div className="text-sm text-gray-400 mb-2">Overdue Jobs</div>
                <div className={cn('text-3xl font-bold', (stats?.sla.overdueCount ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400')}>
                  {stats?.sla.overdueCount ?? 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  of {stats?.sla.totalJobs ?? 0} active
                </div>
              </div>

              <div className="h-px bg-[#1e1e2e]" />

              <div>
                <div className="text-sm text-gray-400 mb-2">Completed Today</div>
                <div className="text-3xl font-bold text-blue-400">{stats?.completedToday ?? 0}</div>
                <div className="text-xs text-gray-500 mt-1">of {stats?.totalToday ?? 0} today</div>
              </div>

              <div className="h-px bg-[#1e1e2e]" />

              <Button variant="secondary" size="sm" className="w-full">
                View Full Report
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
                {jobQueue.length > 0 && <Badge variant="warning">{jobQueue.length}</Badge>}
              </div>
            </CardHeader>

            <CardContent>
              {jobQueue.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                  <p className="text-sm">All jobs assigned ✓</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobQueue.map((job) => (
                    <div
                      key={job.jobId}
                      className="p-4 bg-[#1a1a2e] rounded-lg border-l-4 border-amber-500 hover:border-amber-400 transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <div className="text-sm font-semibold text-white">{job.jobNumber}</div>
                          <div className="text-xs text-gray-400">{job.customerName}</div>
                        </div>
                        <Badge variant={statusVariant(job.status)}>
                          {job.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 mb-4">{job.location}</div>
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

          {/* Recent Completions Feed */}
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white">Recent Completions</CardTitle>
            </CardHeader>

            <CardContent>
              {recentCompletions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm">No completions yet today</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentCompletions.map((job) => (
                    <div key={job.jobId} className="p-4 bg-[#1a1a2e] rounded-lg border-l-4 border-emerald-500">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div>
                          <div className="text-sm font-semibold text-emerald-400">✓ {job.jobNumber}</div>
                          <div className="text-xs text-gray-400">{job.customerName}</div>
                        </div>
                        <div className="text-xs text-gray-500">{job.endTime}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {job.location} · {job.technicianName}
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
