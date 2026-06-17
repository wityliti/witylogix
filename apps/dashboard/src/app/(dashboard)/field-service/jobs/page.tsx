'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { api } from '@/lib/api';
import type { OrderPin, OrderPinStatus } from '@/components/map/order-layer';
import { ClipboardList, Plus, Search, X, List, Map, MapPin } from 'lucide-react';

const JobsMapView = dynamic(() => import('./components/jobs-map-view'), { ssr: false });

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
  assignedTechName?: string;
  eta?: string;
  notes: string[];
  lat?: number | null;
  lng?: number | null;
}

function toJobPinStatus(status: WorkOrderStatus): OrderPinStatus {
  if (status === 'created' || status === 'scheduled') return 'pending';
  if (status === 'dispatched' || status === 'in_progress') return 'in_transit';
  if (status === 'cancelled') return 'delayed';
  return 'assigned';
}

function toJobPinPriority(priority: WorkOrderPriority): 'low' | 'medium' | 'high' {
  if (priority === 'urgent' || priority === 'high') return 'high';
  if (priority === 'medium') return 'medium';
  return 'low';
}

const statusVariant = (
  status: WorkOrderStatus
): 'success' | 'warning' | 'info' | 'primary' | 'default' => {
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

const priorityVariant = (
  priority: WorkOrderPriority
): 'danger' | 'warning' | 'info' | 'primary' | 'default' | 'success' => {
  const map: Record<
    WorkOrderPriority,
    'danger' | 'warning' | 'info' | 'primary' | 'default' | 'success'
  > = {
    low: 'default',
    medium: 'info',
    high: 'warning',
    urgent: 'danger',
  };
  return map[priority];
};

interface CreateWorkOrderForm {
  customerName: string;
  customerPhone: string;
  serviceType: WorkOrderType;
  priority: WorkOrderPriority;
  preferredDate: string;
  description: string;
  location: string;
}

const DEFAULT_FORM: CreateWorkOrderForm = {
  customerName: '',
  customerPhone: '',
  serviceType: 'installation',
  priority: 'medium',
  preferredDate: '',
  description: '',
  location: '',
};

export default function JobsPage() {
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<WorkOrderPriority | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<WorkOrderType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<CreateWorkOrderForm>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');

  const { items: allOrders, loading, error, refetch } = useApiList<WorkOrder>(
    '/api/v4/field-service/jobs'
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const filteredOrders = useMemo(() => {
    let result = [...allOrders];
    if (statusFilter !== 'all') result = result.filter((o) => o.status === statusFilter);
    if (priorityFilter !== 'all') result = result.filter((o) => o.priority === priorityFilter);
    if (typeFilter !== 'all') result = result.filter((o) => o.serviceType === typeFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (o) =>
          o.jobNumber.toLowerCase().includes(term) ||
          o.customerName.toLowerCase().includes(term) ||
          o.description.toLowerCase().includes(term)
      );
    }
    return result;
  }, [allOrders, statusFilter, priorityFilter, typeFilter, searchTerm]);

  const selectedJobData = selectedJob ? allOrders.find((o) => o.id === selectedJob) : null;

  const jobPins = useMemo<OrderPin[]>(() => {
    return allOrders
      .filter((o) => o.lat != null && o.lng != null)
      .map((o) => ({
        id: o.id,
        orderNumber: o.jobNumber,
        customerName: o.customerName,
        address: o.location,
        status: toJobPinStatus(o.status),
        lat: o.lat!,
        lng: o.lng!,
        priority: toJobPinPriority(o.priority),
      }));
  }, [allOrders]);

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerName.trim() || !form.description.trim() || !form.location.trim()) {
      setSubmitError('Customer name, description, and location are required.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post('/api/v4/orders', {
        customerName: form.customerName,
        customerPhone: form.customerPhone || undefined,
        serviceType: form.serviceType,
        priority: form.priority.toUpperCase(),
        deliveryDate: form.preferredDate || undefined,
        notes: form.description,
        addressLine1: form.location,
        type: 'field-service',
      });
      setForm(DEFAULT_FORM);
      setShowCreateForm(false);
      await refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create work order');
    } finally {
      setSubmitting(false);
    }
  }

  function updateForm(field: keyof CreateWorkOrderForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="min-h-screen bg-surface-primary p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-content-primary mb-2">Work Order Management</h1>
            <p className="text-content-secondary">
              {filteredOrders.length} orders ·{' '}
              {allOrders.filter((o) => o.status === 'completed').length} completed today
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded overflow-hidden border border-border-subtle">
              <button
                onClick={() => setView('list')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors',
                  view === 'list' ? 'bg-brand-primary text-white' : 'bg-transparent text-content-secondary hover:text-content-primary',
                )}
              >
                <List size={13} /> List
              </button>
              <button
                onClick={() => setView('map')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors border-l border-border-subtle',
                  view === 'map' ? 'bg-brand-primary text-white' : 'bg-transparent text-content-secondary hover:text-content-primary',
                )}
              >
                <Map size={13} /> Map
              </button>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setForm(DEFAULT_FORM);
                setSubmitError(null);
                setShowCreateForm(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus size={16} /> Create Work Order
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-content-secondary text-sm font-medium">Total Orders</span>
              <ClipboardList className="text-brand-primary" size={20} />
            </div>
            <p className="text-3xl font-bold text-content-primary">{allOrders.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-content-secondary text-sm font-medium">In Progress</span>
              <div className="w-5 h-5 rounded-full bg-warning" />
            </div>
            <p className="text-3xl font-bold text-content-primary">
              {allOrders.filter((o) => o.status === 'in_progress').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-content-secondary text-sm font-medium">Completed</span>
              <div className="w-5 h-5 rounded-full bg-success" />
            </div>
            <p className="text-3xl font-bold text-content-primary">
              {allOrders.filter((o) => o.status === 'completed').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-content-secondary text-sm font-medium">Urgent</span>
              <div className="w-5 h-5 rounded-full bg-danger" />
            </div>
            <p className="text-3xl font-bold text-content-primary">
              {allOrders.filter((o) => o.priority === 'urgent').length}
            </p>
          </div>
        </Card>
      </div>

      {/* Create Work Order Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-border-subtle">
              <div className="flex justify-between items-center">
                <CardTitle>Create New Work Order</CardTitle>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-content-tertiary hover:text-content-primary transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </CardHeader>
            <form onSubmit={handleCreateOrder} className="p-6 space-y-4">
              {submitError && (
                <div className="p-3 bg-danger-subtle border border-danger-border rounded text-sm text-danger">
                  {submitError}
                </div>
              )}

              {/* Customer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-content-secondary block mb-1">
                    Customer Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="John Smith"
                    value={form.customerName}
                    onChange={(e) => updateForm('customerName', e.target.value)}
                    className="w-full px-3 py-2 rounded border border-border-subtle bg-surface-primary text-content-primary text-sm focus:border-brand-primary focus:outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-secondary block mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 555-0000"
                    value={form.customerPhone}
                    onChange={(e) => updateForm('customerPhone', e.target.value)}
                    className="w-full px-3 py-2 rounded border border-border-subtle bg-surface-primary text-content-primary text-sm focus:border-brand-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Service Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-content-secondary block mb-1">
                    Service Type
                  </label>
                  <select
                    value={form.serviceType}
                    onChange={(e) =>
                      updateForm('serviceType', e.target.value as WorkOrderType)
                    }
                    className="w-full px-3 py-2 rounded border border-border-subtle bg-surface-primary text-content-primary text-sm focus:border-brand-primary focus:outline-none transition-colors"
                  >
                    <option value="installation">Installation</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="repair">Repair</option>
                    <option value="inspection">Inspection</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-content-secondary block mb-1">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      updateForm('priority', e.target.value as WorkOrderPriority)
                    }
                    className="w-full px-3 py-2 rounded border border-border-subtle bg-surface-primary text-content-primary text-sm focus:border-brand-primary focus:outline-none transition-colors"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-content-secondary block mb-1">
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    value={form.preferredDate}
                    onChange={(e) => updateForm('preferredDate', e.target.value)}
                    className="w-full px-3 py-2 rounded border border-border-subtle bg-surface-primary text-content-primary text-sm focus:border-brand-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-content-secondary block mb-1">
                  Description <span className="text-danger">*</span>
                </label>
                <textarea
                  placeholder="Describe the work needed..."
                  rows={4}
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border-subtle bg-surface-primary text-content-primary text-sm focus:border-brand-primary focus:outline-none transition-colors"
                  required
                />
              </div>

              {/* Location */}
              <div>
                <label className="text-sm font-medium text-content-secondary block mb-1">
                  Location <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="123 Main St, New York, NY"
                  value={form.location}
                  onChange={(e) => updateForm('location', e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border-subtle bg-surface-primary text-content-primary text-sm focus:border-brand-primary focus:outline-none transition-colors"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="primary"
                  className="flex-1"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Work Order'}
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
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
            className="w-full px-4 py-2 pl-10 rounded-lg border border-border-subtle bg-surface-secondary text-content-primary text-sm placeholder-content-muted focus:border-brand-primary focus:outline-none transition-colors"
          />
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
            size={16}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap">
            {(
              [
                'all',
                'created',
                'scheduled',
                'dispatched',
                'in_progress',
                'completed',
              ] as const
            ).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border',
                  statusFilter === status
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-border-subtle bg-transparent text-content-secondary hover:border-border-default'
                )}
              >
                {status === 'all' ? 'All Status' : status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {/* Priority Filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'low', 'medium', 'high', 'urgent'] as const).map((priority) => (
              <button
                key={priority}
                onClick={() => setPriorityFilter(priority)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border',
                  priorityFilter === priority
                    ? 'bg-warning text-white border-warning'
                    : 'border-border-subtle bg-transparent text-content-secondary hover:border-border-default'
                )}
              >
                {priority === 'all' ? 'All Priority' : priority}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <div className="flex gap-2 flex-wrap">
            {(
              ['all', 'installation', 'maintenance', 'repair', 'inspection'] as const
            ).map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border',
                  typeFilter === type
                    ? 'bg-info text-white border-info'
                    : 'border-border-subtle bg-transparent text-content-secondary hover:border-border-default'
                )}
              >
                {type === 'all' ? 'All Types' : type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map View */}
      {view === 'map' && (
        <div
          className="relative rounded-lg overflow-hidden border border-border-subtle mb-5"
          style={{ height: 'calc(100vh - 400px)', minHeight: '400px' }}
        >
          {jobPins.length === 0 ? (
            <div className="flex items-center justify-center h-full bg-surface-secondary text-content-tertiary text-sm">
              <div className="text-center">
                <MapPin size={28} className="mx-auto mb-2 opacity-40" />
                <p>No geocoded jobs to display</p>
                <p className="text-xs mt-1 opacity-60">Jobs need delivery coordinates to appear on the map</p>
              </div>
            </div>
          ) : (
            <JobsMapView
              jobs={jobPins}
              selectedJobId={selectedJob}
              onJobClick={setSelectedJob}
            />
          )}
        </div>
      )}

      {/* Work Orders Table + Detail Panel */}
      <div
        className={cn(
          'grid gap-5',
          selectedJobData ? 'grid-cols-1 lg:grid-cols-[1fr_450px]' : 'grid-cols-1'
        )}
      >
        {/* Table Card */}
        <Card>
          <CardHeader className="border-b border-border-subtle">
            <CardTitle>Work Orders ({filteredOrders.length})</CardTitle>
          </CardHeader>

          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-content-tertiary">
              <ClipboardList className="mx-auto mb-3 text-content-muted" size={32} />
              <p className="font-medium text-content-secondary">No work orders found</p>
              <p className="text-sm mt-1">Try adjusting your filters or create a new work order</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border-subtle bg-surface-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-content-tertiary">
                      Job #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-content-tertiary">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-content-tertiary">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-content-tertiary">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-content-tertiary">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-content-tertiary">
                      Tech
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-content-tertiary">
                      ETA
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedJob(order.id)}
                      className={cn(
                        'hover:bg-surface-secondary transition-colors cursor-pointer',
                        selectedJobData?.id === order.id && 'bg-surface-secondary'
                      )}
                    >
                      <td className="px-4 py-3 text-content-primary font-mono text-xs">
                        {order.jobNumber}
                      </td>
                      <td className="px-4 py-3 text-content-secondary">
                        <div>{order.customerName}</div>
                        <div className="text-xs text-content-tertiary">{order.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3 text-content-secondary capitalize text-xs">
                        {order.serviceType.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={priorityVariant(order.priority)}>
                          {order.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(order.status)}>
                          {order.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-content-secondary text-xs">
                        {order.assignedTechName || '—'}
                      </td>
                      <td className="px-4 py-3 text-content-secondary text-xs">
                        {order.eta || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Detail Drawer */}
        {selectedJobData && (
          <Card
            className="sticky overflow-y-auto"
            style={{ top: '24px', maxHeight: 'calc(100vh - 200px)' }}
          >
            <CardHeader className="border-b border-border-subtle">
              <div className="flex justify-between items-center">
                <CardTitle>Job Details</CardTitle>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-content-tertiary hover:text-content-primary transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </CardHeader>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-lg font-bold text-content-primary mb-1">
                  {selectedJobData.jobNumber}
                </div>
                <div className="flex gap-2 mb-3">
                  <Badge variant={statusVariant(selectedJobData.status)}>
                    {selectedJobData.status.replace(/_/g, ' ')}
                  </Badge>
                  <Badge variant={priorityVariant(selectedJobData.priority)}>
                    {selectedJobData.priority}
                  </Badge>
                </div>
              </div>

              <div className="h-px bg-border-subtle" />

              <div>
                <div className="text-xs font-semibold text-content-tertiary uppercase mb-2">
                  Customer
                </div>
                <div className="text-sm text-content-primary font-medium">
                  {selectedJobData.customerName}
                </div>
                <div className="text-xs text-content-secondary mt-1">
                  {selectedJobData.customerPhone}
                </div>
              </div>

              <div className="h-px bg-border-subtle" />

              <div>
                <div className="text-xs font-semibold text-content-tertiary uppercase mb-2">
                  Location
                </div>
                <div className="text-sm text-content-primary">{selectedJobData.location}</div>
              </div>

              <div className="h-px bg-border-subtle" />

              <div>
                <div className="text-xs font-semibold text-content-tertiary uppercase mb-2">
                  Description
                </div>
                <div className="text-sm text-content-secondary">{selectedJobData.description}</div>
              </div>

              <div className="h-px bg-border-subtle" />

              <div className="space-y-2">
                <Button variant="primary" size="sm" className="w-full text-xs">
                  Edit Details
                </Button>
                <Button variant="secondary" size="sm" className="w-full text-xs">
                  Assign Technician
                </Button>
                {selectedJobData.status === 'in_progress' && (
                  <Button variant="primary" size="sm" className="w-full text-xs">
                    Mark Complete
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  View History
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
