'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { ClipboardList, Search, X } from 'lucide-react';

type WorkOrderStatus = 'created' | 'scheduled' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled';
type WorkOrderPriority = 'low' | 'medium' | 'high' | 'urgent';

interface RawOrder {
  id: string;
  externalOrderNumber: string | null;
  customerName: string;
  customerPhone: string | null;
  status: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  deliveryDate: string | null;
  updatedAt: string;
  driver: { id: string; name: string; phone: string } | null;
  timeSlot: { id: string; name: string; startTime: string; endTime: string } | null;
}

interface WorkOrder {
  id: string;
  jobNumber: string;
  customerName: string;
  customerPhone: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  serviceType: string;
  location: string;
  assignedTechName?: string;
  eta?: string;
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

function normalizePriority(order: RawOrder): WorkOrderPriority {
  if (!order.deliveryDate) return 'medium';
  const hoursLeft = (new Date(order.deliveryDate).getTime() - Date.now()) / 3600000;
  if (hoursLeft < 0) return 'urgent';
  if (hoursLeft < 4) return 'high';
  if (hoursLeft < 24) return 'medium';
  return 'low';
}

function normalizeOrder(raw: RawOrder): WorkOrder {
  return {
    id: raw.id,
    jobNumber: raw.externalOrderNumber || `#${raw.id.slice(0, 8).toUpperCase()}`,
    customerName: raw.customerName,
    customerPhone: raw.customerPhone || '—',
    status: normalizeStatus(raw.status),
    priority: normalizePriority(raw),
    serviceType: 'delivery',
    location: [raw.addressLine1, raw.city, raw.state].filter(Boolean).join(', ') || '—',
    assignedTechName: raw.driver?.name,
    eta: raw.deliveryDate ? new Date(raw.deliveryDate).toLocaleDateString() : undefined,
  };
}

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

const priorityVariant = (priority: WorkOrderPriority): 'danger' | 'warning' | 'info' | 'default' | 'success' | 'primary' => {
  const map: Record<WorkOrderPriority, 'danger' | 'warning' | 'info' | 'default' | 'success' | 'primary'> = {
    low: 'default',
    medium: 'info',
    high: 'warning',
    urgent: 'danger',
  };
  return map[priority];
};

export default function JobsPage() {
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<WorkOrderPriority | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  const { items: rawOrders, loading, error, refetch } = useApiList<RawOrder>('/api/v4/orders', { limit: 100 });

  // All hooks before early returns
  const allOrders = useMemo(() => rawOrders.map(normalizeOrder), [rawOrders]);

  const filteredOrders = useMemo(() => {
    let result = [...allOrders];
    if (statusFilter !== 'all') result = result.filter((o) => o.status === statusFilter);
    if (priorityFilter !== 'all') result = result.filter((o) => o.priority === priorityFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (o) =>
          o.jobNumber.toLowerCase().includes(term) ||
          o.customerName.toLowerCase().includes(term) ||
          o.location.toLowerCase().includes(term)
      );
    }
    return result;
  }, [allOrders, statusFilter, priorityFilter, searchTerm]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const selectedJobData = selectedJob ? allOrders.find((o) => o.id === selectedJob) : null;
  const inProgressCount = allOrders.filter((o) => o.status === 'in_progress').length;
  const completedCount = allOrders.filter((o) => o.status === 'completed').length;
  const urgentCount = allOrders.filter((o) => o.priority === 'urgent').length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Work Order Management</h1>
            <p className="text-gray-400">{filteredOrders.length} orders · {completedCount} completed</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Total Orders</span>
              <ClipboardList className="text-blue-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{allOrders.length}</p>
          </div>
        </Card>
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">In Progress</span>
              <div className="w-5 h-5 rounded-full bg-amber-500" />
            </div>
            <p className="text-3xl font-bold text-white">{inProgressCount}</p>
          </div>
        </Card>
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Completed</span>
              <div className="w-5 h-5 rounded-full bg-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-white">{completedCount}</p>
          </div>
        </Card>
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Urgent</span>
              <div className="w-5 h-5 rounded-full bg-red-500" />
            </div>
            <p className="text-3xl font-bold text-white">{urgentCount}</p>
          </div>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by job #, customer, or location…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 rounded-lg border border-[#1e1e2e] bg-[#12121a] text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'created', 'scheduled', 'dispatched', 'in_progress', 'completed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border',
                  statusFilter === s
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'border-[#1e1e2e] bg-transparent text-gray-400 hover:border-[#2a2a3a]'
                )}
              >
                {s === 'all' ? 'All Status' : s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'low', 'medium', 'high', 'urgent'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border',
                  priorityFilter === p
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'border-[#1e1e2e] bg-transparent text-gray-400 hover:border-[#2a2a3a]'
                )}
              >
                {p === 'all' ? 'All Priority' : p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table + Detail */}
      <div className={cn('grid gap-5', selectedJobData ? 'grid-cols-1 lg:grid-cols-[1fr_450px]' : 'grid-cols-1')}>
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader className="border-b border-[#1e1e2e]">
            <CardTitle className="text-white">Work Orders ({filteredOrders.length})</CardTitle>
          </CardHeader>
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No orders match the current filters</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#1e1e2e] bg-[#0f0f14]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Job #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Driver</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">ETA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedJob(order.id === selectedJob ? null : order.id)}
                      className={cn('hover:bg-[#1a1a2e] transition-colors cursor-pointer', selectedJobData?.id === order.id && 'bg-[#1a1a2e]')}
                    >
                      <td className="px-4 py-3 text-white font-mono text-xs">{order.jobNumber}</td>
                      <td className="px-4 py-3 text-gray-300">
                        <div>{order.customerName}</div>
                        <div className="text-xs text-gray-500">{order.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={priorityVariant(order.priority)}>{order.priority}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(order.status)}>{order.status.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{order.assignedTechName || '—'}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{order.eta || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {selectedJobData && (
          <Card className="sticky overflow-y-auto bg-[#12121a] border-[#1e1e2e]" style={{ top: '24px', maxHeight: 'calc(100vh - 200px)' }}>
            <CardHeader className="border-b border-[#1e1e2e]">
              <div className="flex justify-between items-center">
                <CardTitle className="text-white">Job Details</CardTitle>
                <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
            </CardHeader>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-lg font-bold text-white mb-1">{selectedJobData.jobNumber}</div>
                <div className="flex gap-2 mb-3">
                  <Badge variant={statusVariant(selectedJobData.status)}>{selectedJobData.status.replace(/_/g, ' ')}</Badge>
                  <Badge variant={priorityVariant(selectedJobData.priority)}>{selectedJobData.priority}</Badge>
                </div>
              </div>
              <div className="h-px bg-[#1e1e2e]" />
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Customer</div>
                <div className="text-sm text-white font-medium">{selectedJobData.customerName}</div>
                <div className="text-xs text-gray-400 mt-1">{selectedJobData.customerPhone}</div>
              </div>
              <div className="h-px bg-[#1e1e2e]" />
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Location</div>
                <div className="text-sm text-white">{selectedJobData.location}</div>
              </div>
              {selectedJobData.assignedTechName && (
                <>
                  <div className="h-px bg-[#1e1e2e]" />
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Assigned Driver</div>
                    <div className="text-sm text-white">{selectedJobData.assignedTechName}</div>
                  </div>
                </>
              )}
              {selectedJobData.eta && (
                <>
                  <div className="h-px bg-[#1e1e2e]" />
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-2">ETA</div>
                    <div className="text-sm text-white">{selectedJobData.eta}</div>
                  </div>
                </>
              )}
              <div className="h-px bg-[#1e1e2e]" />
              <div className="space-y-2">
                <Button variant="secondary" size="sm" className="w-full text-xs">Assign Driver</Button>
                <Button variant="ghost" size="sm" className="w-full text-xs">View Order</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
