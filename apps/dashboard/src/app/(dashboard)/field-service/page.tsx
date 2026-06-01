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

const priorityVariant = (priority: string): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
  const map: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    low: 'default',
    medium: 'info',
    high: 'warning',
    urgent: 'danger',
  };
  return map[priority] || 'default';
};

interface RawOrder {
  id: string;
  externalOrderNumber: string | null;
  customerName: string;
  customerPhone: string | null;
  status: string;
  addressLine1: string | null;
  city: string | null;
  deliveryDate: string | null;
  driver: { id: string; name: string; phone: string } | null;
  timeSlot: { id: string; name: string; startTime: string; endTime: string } | null;
  updatedAt: string;
}

interface RawDriver {
  id: string;
  name: string;
  status: 'OFFLINE' | 'AVAILABLE' | 'ON_ROUTE' | 'ON_BREAK';
  vehicleType: string | null;
  _count: { orders: number };
}

function normalizeStatus(raw: string): WorkOrderStatus {
  const map: Record<string, WorkOrderStatus> = {
    PENDING: 'created',
    PROCESSING: 'scheduled',
    ASSIGNED: 'dispatched',
    PICKED_UP: 'dispatched',
    OUT_FOR_DELIVERY: 'in_progress',
    ARRIVED: 'in_progress',
    SHIPPED: 'in_progress',
    DELIVERED: 'completed',
    CANCELLED: 'cancelled',
  };
  return map[raw] ?? 'created';
}

function priorityFromOrder(order: RawOrder): string {
  if (!order.deliveryDate) return 'medium';
  const hoursLeft = (new Date(order.deliveryDate).getTime() - Date.now()) / 3600000;
  if (hoursLeft < 0) return 'urgent';
  if (hoursLeft < 4) return 'high';
  if (hoursLeft < 24) return 'medium';
  return 'low';
}

function formatJobNumber(order: RawOrder): string {
  return order.externalOrderNumber || `#${order.id.slice(0, 8).toUpperCase()}`;
}

function formatLocation(order: RawOrder): string {
  return [order.addressLine1, order.city].filter(Boolean).join(', ') || '—';
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function FieldServicePage() {
  const { items: rawOrders, loading: ordersLoading, error: ordersError, refetch: refetchOrders } =
    useApiList<RawOrder>('/api/v4/orders', { limit: 100 });
  const { items: drivers, loading: driversLoading, error: driversError, refetch: refetchDrivers } =
    useApiList<RawDriver>('/api/v4/drivers', { limit: 100 });

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
    () =>
      rawOrders
        .filter((o) => o.status === 'PENDING' && !o.driver)
        .slice(0, 5)
        .map((o) => ({
          id: o.id,
          jobNumber: formatJobNumber(o),
          customerName: o.customerName,
          priority: priorityFromOrder(o),
          serviceType: 'delivery',
          location: formatLocation(o),
          status: normalizeStatus(o.status),
        })),
    [rawOrders]
  );

  const recentCompletions = useMemo(
    () =>
      rawOrders
        .filter((o) => o.status === 'DELIVERED')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8)
        .map((o) => ({
          id: o.id,
          jobNumber: formatJobNumber(o),
          customerName: o.customerName,
          assignedTechName: o.driver?.name,
          completionTime: new Date(o.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })),
    [rawOrders]
  );

  const schedule = useMemo(
    () =>
      rawOrders
        .filter((o) => isToday(o.deliveryDate) && o.driver)
        .map((o) => ({
          jobId: o.id,
          technicianId: o.driver!.id,
          jobNumber: formatJobNumber(o),
          customerName: o.customerName,
          location: formatLocation(o),
          startTime: o.timeSlot?.startTime ?? '—',
          endTime: o.timeSlot?.endTime ?? '—',
          status: normalizeStatus(o.status),
        })),
    [rawOrders]
  );

  const loading = ordersLoading || driversLoading;
  const error = ordersError || driversError;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={() => { refetchOrders(); refetchDrivers(); }} />;

  // KPI calculations
  const activeJobs = rawOrders.filter((o) => ['PROCESSING', 'ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'].includes(o.status)).length;
  const completedJobs = rawOrders.filter((o) => o.status === 'DELIVERED').length;
  const totalJobs = rawOrders.length;
  const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
  const techniciansInField = drivers.filter((d) => d.status === 'ON_ROUTE').length;
  const totalTechnicians = drivers.length;
  const overdueCount = rawOrders.filter((o) => {
    if (!o.deliveryDate || o.status === 'DELIVERED' || o.status === 'CANCELLED') return false;
    return new Date(o.deliveryDate).getTime() < Date.now();
  }).length;
  const onTimePercentage = totalJobs > 0 ? Math.max(0, Math.round(((totalJobs - overdueCount) / totalJobs) * 100)) : 100;

  const techniciansInSchedule = drivers.filter((d) => schedule.some((s) => s.technicianId === d.id));
  const filteredSchedule = selectedTech ? schedule.filter((s) => s.technicianId === selectedTech) : schedule;

  return (
    <>
      <Header
        title="Field Service Overview"
        subtitle={`${totalTechnicians} technicians · ${activeJobs} active jobs`}
      />

      <div className="p-6 space-y-6 bg-[#0a0a0f] min-h-screen">
        {/* KPI Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#12121a] border-[#1e1e2e] border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Active Jobs</p>
                  <p className="text-3xl font-bold text-white">{activeJobs}</p>
                  <p className="text-xs text-gray-400 mt-2">in progress now</p>
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
                  <p className="text-3xl font-bold text-white">{techniciansInField}</p>
                  <p className="text-xs text-gray-400 mt-2">dispatched drivers</p>
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
                  <p className="text-3xl font-bold text-white">{completionRate}%</p>
                  <p className="text-xs text-gray-400 mt-2">{completedJobs} of {totalJobs} orders</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border-[#1e1e2e] border-l-4 border-l-red-500">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Overdue</p>
                  <p className={cn('text-3xl font-bold', overdueCount > 0 ? 'text-red-400' : 'text-emerald-400')}>{overdueCount}</p>
                  <p className="text-xs text-gray-400 mt-2">past delivery date</p>
                </div>
                <Clock className="w-8 h-8 text-red-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Schedule + SLA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    <option value="all">All Drivers</option>
                    {techniciansInSchedule.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredSchedule.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">No deliveries scheduled for today</div>
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
                        </div>
                        <Badge variant={statusVariant(item.status as WorkOrderStatus)} className="flex-shrink-0">
                          {item.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* SLA */}
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader><CardTitle className="text-white">SLA Compliance</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-sm font-medium text-gray-400">On-Time %</span>
                  <span className={cn('text-2xl font-bold', onTimePercentage >= 90 ? 'text-emerald-400' : onTimePercentage >= 70 ? 'text-amber-400' : 'text-red-400')}>
                    {onTimePercentage}%
                  </span>
                </div>
                <div className="w-full bg-[#1a1a2e] rounded-full h-2.5 overflow-hidden">
                  <div
                    className={cn('h-2.5 rounded-full transition-all', onTimePercentage >= 90 ? 'bg-emerald-500' : onTimePercentage >= 70 ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ width: `${onTimePercentage}%` }}
                  />
                </div>
              </div>
              <div className="h-px bg-[#1e1e2e]" />
              <div>
                <div className="text-sm text-gray-400 mb-2">Overdue Jobs</div>
                <div className={cn('text-3xl font-bold', overdueCount > 0 ? 'text-red-400' : 'text-emerald-400')}>{overdueCount}</div>
                <div className="text-xs text-gray-500 mt-1">of {totalJobs} total</div>
              </div>
              <div className="h-px bg-[#1e1e2e]" />
              <div>
                <div className="text-sm text-gray-400 mb-2">Drivers Available</div>
                <div className="text-3xl font-bold text-blue-400">
                  {drivers.filter((d) => d.status === 'AVAILABLE').length}
                </div>
                <div className="text-xs text-gray-500 mt-1">of {totalTechnicians} total</div>
              </div>
              <div className="h-px bg-[#1e1e2e]" />
              <Button variant="secondary" size="sm" className="w-full" onClick={() => window.location.href = '/field-service/dispatch'}>
                Open Dispatch
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Job Queue + Recent Completions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-white">Job Queue (Unassigned)</CardTitle>
                <Badge variant={jobQueue.length > 0 ? 'warning' : 'success'}>{jobQueue.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {jobQueue.length === 0 ? (
                <div className="text-center py-12 text-gray-500">All jobs assigned ✓</div>
              ) : (
                <div className="space-y-3">
                  {jobQueue.map((job) => (
                    <div key={job.id} className="p-4 bg-[#1a1a2e] rounded-lg border-l-4 border-amber-500 hover:border-amber-400 transition-colors cursor-pointer">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <div className="text-sm font-semibold text-white">{job.jobNumber}</div>
                          <div className="text-xs text-gray-400">{job.customerName}</div>
                        </div>
                        <Badge variant={priorityVariant(job.priority)}>
                          {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
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

          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader><CardTitle className="text-white">Recent Completions</CardTitle></CardHeader>
            <CardContent>
              {recentCompletions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No completions yet today</div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentCompletions.map((job) => (
                    <div key={job.id} className="p-4 bg-[#1a1a2e] rounded-lg border-l-4 border-emerald-500">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div>
                          <div className="text-sm font-semibold text-emerald-400">✓ {job.jobNumber}</div>
                          <div className="text-xs text-gray-400">{job.customerName}</div>
                        </div>
                        <div className="text-xs text-gray-500">{job.completionTime}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">{job.assignedTechName || '—'}</div>
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
