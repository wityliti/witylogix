'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useApiQuery, useApiList } from '@/hooks/use-api';
import { TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

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
  completedToday: number;
  inFieldCount: number;
  totalDrivers: number;
  completionRate: number;
  avgResponseMinutes: number;
  slaOnTimePercentage: number;
  overdueJobCount: number;
  totalScheduledToday: number;
  completedDelta: number;
}

interface ScheduleItem {
  jobId: string;
  jobNumber: string;
  customerName: string;
  location: string;
  startTime: string;
  endTime: string;
  status: WorkOrderStatus;
  technicianId: string | null;
  technicianName: string | null;
}

export default function FieldServicePage() {
  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } =
    useApiQuery<FieldServiceStats>('/api/v4/field-service/stats');

  const { items: schedule, loading: schedLoading, error: schedError, refetch: refetchSched } =
    useApiList<ScheduleItem>('/api/v4/field-service/schedule');

  const [selectedTech, setSelectedTech] = useState<string | null>(null);

  const loading = statsLoading || schedLoading;
  const error = statsError || schedError;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={() => { refetchStats(); refetchSched(); }} />;

  const technicians = useMemo(() => {
    const seen = new Set<string>();
    return schedule
      .filter((s) => s.technicianId && !seen.has(s.technicianId) && seen.add(s.technicianId))
      .map((s) => ({ id: s.technicianId!, name: s.technicianName ?? s.technicianId! }));
  }, [schedule]);

  const filteredSchedule = useMemo(
    () => (selectedTech ? schedule.filter((s) => s.technicianId === selectedTech) : schedule),
    [schedule, selectedTech]
  );

  const jobQueue = useMemo(
    () => schedule.filter((s) => ['created', 'scheduled'].includes(s.status)).slice(0, 5),
    [schedule]
  );

  const recentCompletions = useMemo(
    () => schedule.filter((s) => s.status === 'completed').slice(0, 8),
    [schedule]
  );

  const deltaSign = (stats?.completedDelta ?? 0) >= 0 ? '+' : '';

  return (
    <>
      <Header
        title="Field Service Overview"
        subtitle={`${stats?.inFieldCount ?? 0} technicians in field · ${stats?.activeJobs ?? 0} active jobs`}
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
                  <p className="text-xs text-gray-500 mt-2">{stats?.inFieldCount ?? 0} drivers in field</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border-[#1e1e2e] border-l-4 border-l-cyan-500">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Completed Today</p>
                  <p className="text-3xl font-bold text-white">{stats?.completedToday ?? 0}</p>
                  {typeof stats?.completedDelta === 'number' && (
                    <p className={cn('text-xs mt-2', stats.completedDelta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {deltaSign}{stats.completedDelta}% vs yesterday
                    </p>
                  )}
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
                  <p className="text-3xl font-bold text-white">{stats?.completionRate ?? 0}%</p>
                  <p className="text-xs text-gray-500 mt-2">7-day avg</p>
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
                  <p className="text-3xl font-bold text-white">{stats?.avgResponseMinutes ?? 0}m</p>
                  <p className="text-xs text-gray-500 mt-2">time to delivery</p>
                </div>
                <Clock className="w-8 h-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ Schedule + SLA ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-[#12121a] border-[#1e1e2e]">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Today's Schedule</CardTitle>
                  <select
                    value={selectedTech ?? 'all'}
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
                  <div className="text-center py-12 text-gray-500">No scheduled jobs for today</div>
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
                            {item.customerName} • {item.location}
                            {item.technicianName && (
                              <span className="ml-2 text-blue-400/70">({item.technicianName})</span>
                            )}
                          </div>
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

          {/* SLA Compliance */}
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white">SLA Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-sm font-medium text-gray-400">On-Time %</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    {stats?.slaOnTimePercentage ?? 0}%
                  </span>
                </div>
                <div className="w-full bg-[#1a1a2e] rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2.5 rounded-full transition-all"
                    style={{ width: `${stats?.slaOnTimePercentage ?? 0}%` }}
                  />
                </div>
              </div>

              <div className="h-px bg-[#1e1e2e]" />

              <div>
                <div className="text-sm text-gray-400 mb-2">Overdue Jobs</div>
                <div className="text-3xl font-bold text-red-400">{stats?.overdueJobCount ?? 0}</div>
                <div className="text-xs text-gray-500 mt-1">
                  of {stats?.totalScheduledToday ?? 0} scheduled today
                </div>
              </div>

              <div className="h-px bg-[#1e1e2e]" />

              <div>
                <div className="text-sm text-gray-400 mb-2">Avg Completion</div>
                <div className="text-3xl font-bold text-blue-400">
                  {stats?.avgResponseMinutes ?? 0}m
                </div>
              </div>

              <div className="h-px bg-[#1e1e2e]" />

              <div className="flex items-center gap-2 p-3 bg-[#1a1a2e] rounded-lg border border-[#1e1e2e]">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-gray-400">
                  {stats?.overdueJobCount && stats.overdueJobCount > 0
                    ? `${stats.overdueJobCount} job${stats.overdueJobCount !== 1 ? 's' : ''} need immediate attention`
                    : 'All jobs within SLA'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ Job Queue + Recent Completions ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      key={job.jobId}
                      className="p-4 bg-[#1a1a2e] rounded-lg border-l-4 border-amber-500 hover:border-amber-400 transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <div className="text-sm font-semibold text-white">{job.jobNumber}</div>
                          <div className="text-xs text-gray-400">{job.customerName}</div>
                        </div>
                        <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
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
                      key={job.jobId}
                      className="p-4 bg-[#1a1a2e] rounded-lg border-l-4 border-emerald-500"
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div>
                          <div className="text-sm font-semibold text-emerald-400">
                            ✓ {job.jobNumber}
                          </div>
                          <div className="text-xs text-gray-400">{job.customerName}</div>
                        </div>
                        <div className="text-xs text-gray-500">{job.endTime}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {job.location}
                        {job.technicianName && <span className="ml-2">· {job.technicianName}</span>}
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
