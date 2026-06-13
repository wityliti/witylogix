'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { ClipboardList, Plus, Search, X } from 'lucide-react';

type WorkOrderStatus = 'created' | 'scheduled' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled';
type WorkOrderPriority = 'low' | 'medium' | 'high' | 'urgent';
type WorkOrderType = 'installation' | 'maintenance' | 'repair' | 'inspection';

interface WorkOrder {
  id: string;
  jobNumber: string;
  customerName: string;
  customerPhone: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  serviceType: WorkOrderType;
  location: string;
  description: string;
  estimatedDuration: number;
  requiredSkills: string[];
  assignedTechName?: string | null;
  assignedTechId?: string | null;
  eta?: string | null;
  notes: string[];
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

const priorityVariant = (priority: WorkOrderPriority): 'danger' | 'warning' | 'info' | 'primary' | 'default' | 'success' => {
  const map: Record<WorkOrderPriority, 'danger' | 'warning' | 'info' | 'primary' | 'default' | 'success'> = {
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
  const [typeFilter, setTypeFilter] = useState<WorkOrderType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { items: allOrders, loading, error, refetch } = useApiList<WorkOrder>('/api/v4/field-service/jobs');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const filteredOrders = useMemo(() => {
    let result = [...allOrders];
    if (statusFilter !== 'all') result = result.filter((o) => o.status === statusFilter);
    if (priorityFilter !== 'all') result = result.filter((o) => o.priority === priorityFilter);
    if (typeFilter !== 'all') result = result.filter((o) => o.serviceType === typeFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((o) =>
        o.jobNumber.toLowerCase().includes(term) ||
        o.customerName.toLowerCase().includes(term) ||
        o.description.toLowerCase().includes(term)
      );
    }
    return result;
  }, [allOrders, statusFilter, priorityFilter, typeFilter, searchTerm]);

  const selectedJobData = selectedJob ? allOrders.find((o) => o.id === selectedJob) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Work Order Management</h1>
            <p className="text-gray-400">
              {filteredOrders.length} orders · {allOrders.filter((o) => o.status === 'completed').length} completed
            </p>
          </div>
          <Button variant="primary" size="md" onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
            <Plus size={16} /> Create Work Order
          </Button>
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
            <p className="text-3xl font-bold text-white">{allOrders.filter(o => o.status === 'in_progress').length}</p>
          </div>
        </Card>
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Completed</span>
              <div className="w-5 h-5 rounded-full bg-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-white">{allOrders.filter(o => o.status === 'completed').length}</p>
          </div>
        </Card>
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Urgent</span>
              <div className="w-5 h-5 rounded-full bg-red-500" />
            </div>
            <p className="text-3xl font-bold text-white">{allOrders.filter(o => o.priority === 'urgent').length}</p>
          </div>
        </Card>
      </div>

      {/* Create Work Order Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#12121a] border-[#1e1e2e]">
            <CardHeader className="border-b border-[#1e1e2e]">
              <div className="flex justify-between items-center">
                <CardTitle className="text-white">Create New Work Order</CardTitle>
                <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
            </CardHeader>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-400 block mb-1">Customer Name</label>
                  <input type="text" placeholder="John Smith" className="w-full px-3 py-2 rounded border border-[#1e1e2e] bg-[#0a0a0f] text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-400 block mb-1">Phone</label>
                  <input type="tel" placeholder="+1 555-0000" className="w-full px-3 py-2 rounded border border-[#1e1e2e] bg-[#0a0a0f] text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-400 block mb-1">Service Type</label>
                  <select className="w-full px-3 py-2 rounded border border-[#1e1e2e] bg-[#0a0a0f] text-white text-sm focus:border-blue-500 focus:outline-none transition-colors">
                    <option>Installation</option><option>Maintenance</option><option>Repair</option><option>Inspection</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-400 block mb-1">Priority</label>
                  <select className="w-full px-3 py-2 rounded border border-[#1e1e2e] bg-[#0a0a0f] text-white text-sm focus:border-blue-500 focus:outline-none transition-colors">
                    <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-400 block mb-1">Preferred Date</label>
                  <input type="date" className="w-full px-3 py-2 rounded border border-[#1e1e2e] bg-[#0a0a0f] text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400 block mb-1">Description</label>
                <textarea placeholder="Describe the work needed..." rows={4} className="w-full px-3 py-2 rounded border border-[#1e1e2e] bg-[#0a0a0f] text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400 block mb-1">Location</label>
                <input type="text" placeholder="123 Main St, New York, NY" className="w-full px-3 py-2 rounded border border-[#1e1e2e] bg-[#0a0a0f] text-white text-sm focus:border-blue-500 focus:outline-none transition-colors" />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="primary" className="flex-1">Create Work Order</Button>
                <Button variant="secondary" className="flex-1" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by job #, customer, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 rounded-lg border border-[#1e1e2e] bg-[#12121a] text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'created', 'scheduled', 'dispatched', 'in_progress', 'completed'] as const).map((status) => (
              <button key={status} onClick={() => setStatusFilter(status)}
                className={cn('px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border',
                  statusFilter === status ? 'bg-blue-500 text-white border-blue-500' : 'border-[#1e1e2e] bg-transparent text-gray-400 hover:border-[#2a2a3a]')}>
                {status === 'all' ? 'All Status' : status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'low', 'medium', 'high', 'urgent'] as const).map((priority) => (
              <button key={priority} onClick={() => setPriorityFilter(priority)}
                className={cn('px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border',
                  priorityFilter === priority ? 'bg-amber-500 text-white border-amber-500' : 'border-[#1e1e2e] bg-transparent text-gray-400 hover:border-[#2a2a3a]')}>
                {priority === 'all' ? 'All Priority' : priority}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'installation', 'maintenance', 'repair', 'inspection'] as const).map((type) => (
              <button key={type} onClick={() => setTypeFilter(type)}
                className={cn('px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border',
                  typeFilter === type ? 'bg-blue-400 text-white border-blue-400' : 'border-[#1e1e2e] bg-transparent text-gray-400 hover:border-[#2a2a3a]')}>
                {type === 'all' ? 'All Types' : type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Work Orders Table + Detail Panel */}
      <div className={cn('grid gap-5', selectedJobData ? 'grid-cols-1 lg:grid-cols-[1fr_450px]' : 'grid-cols-1')}>
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader className="border-b border-[#1e1e2e]">
            <CardTitle className="text-white">Work Orders ({filteredOrders.length})</CardTitle>
          </CardHeader>

          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <ClipboardList className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm">No work orders match your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#1e1e2e] bg-[#0f0f14]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Job #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Tech</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">ETA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedJob(order.id)}
                      className={cn('hover:bg-[#1a1a2e] transition-colors cursor-pointer', selectedJobData?.id === order.id && 'bg-[#1a1a2e]')}
                    >
                      <td className="px-4 py-3 text-white font-mono text-xs">{order.jobNumber}</td>
                      <td className="px-4 py-3 text-gray-300">
                        <div>{order.customerName}</div>
                        {order.customerPhone && <div className="text-xs text-gray-500">{order.customerPhone}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-300 capitalize text-xs">{order.serviceType.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3"><Badge variant={priorityVariant(order.priority)}>{order.priority}</Badge></td>
                      <td className="px-4 py-3"><Badge variant={statusVariant(order.status)}>{order.status.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{order.assignedTechName ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{order.eta ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Detail Drawer */}
        {selectedJobData && (
          <Card className="sticky overflow-y-auto bg-[#12121a] border-[#1e1e2e]" style={{ top: '24px', maxHeight: 'calc(100vh - 200px)' }}>
            <CardHeader className="border-b border-[#1e1e2e]">
              <div className="flex justify-between items-center">
                <CardTitle className="text-white">Job Details</CardTitle>
                <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
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
                {selectedJobData.customerPhone && <div className="text-xs text-gray-400 mt-1">{selectedJobData.customerPhone}</div>}
              </div>
              <div className="h-px bg-[#1e1e2e]" />
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Location</div>
                <div className="text-sm text-white">{selectedJobData.location}</div>
              </div>
              <div className="h-px bg-[#1e1e2e]" />
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Service Type</div>
                <div className="text-sm text-white capitalize">{selectedJobData.serviceType.replace(/_/g, ' ')}</div>
              </div>
              {selectedJobData.description && (
                <>
                  <div className="h-px bg-[#1e1e2e]" />
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Description</div>
                    <div className="text-sm text-gray-300">{selectedJobData.description}</div>
                  </div>
                </>
              )}
              {selectedJobData.assignedTechName && (
                <>
                  <div className="h-px bg-[#1e1e2e]" />
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Assigned To</div>
                    <div className="text-sm text-blue-400">{selectedJobData.assignedTechName}</div>
                    {selectedJobData.eta && <div className="text-xs text-gray-500 mt-1">ETA: {selectedJobData.eta}</div>}
                  </div>
                </>
              )}
              <div className="h-px bg-[#1e1e2e]" />
              <div className="space-y-2">
                <Button variant="primary" size="sm" className="w-full text-xs">Edit Details</Button>
                <Button variant="secondary" size="sm" className="w-full text-xs">Assign Technician</Button>
                {selectedJobData.status === 'in_progress' && (
                  <Button variant="primary" size="sm" className="w-full text-xs">Mark Complete</Button>
                )}
                <Button variant="ghost" size="sm" className="w-full text-xs">View History</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
