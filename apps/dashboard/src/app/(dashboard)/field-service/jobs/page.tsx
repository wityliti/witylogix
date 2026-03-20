'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';

/**
 * Work Order Management Page
 * Table view with filters, create form, and detail drawer
 */

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
}

interface Technician {
  id: string;
  name: string;
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

const priorityVariant = (priority: WorkOrderPriority): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
  const map: Record<WorkOrderPriority, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
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

  const { items: allOrders, loading, error, refetch } = useApiList<WorkOrder>('/api/v4/orders?type=field-service&view=jobs');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  // Mock technicians for now
  const technicians: Technician[] = [];

  // Apply filters
  const filteredOrders = useMemo(() => {
    let result = [...allOrders];

    if (statusFilter !== 'all') {
      result = result.filter((o) => o.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      result = result.filter((o) => o.priority === priorityFilter);
    }

    if (typeFilter !== 'all') {
      result = result.filter((o) => o.serviceType === typeFilter);
    }

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

  return (
    <>
      <Header
        title="Work Order Management"
        subtitle={`${filteredOrders.length} orders · ${allOrders.filter((o) => o.status === "completed").length} completed today`}
        actions={<Button variant="primary" size="md" onClick={() => setShowCreateForm(true)}>+ Create Work Order</Button>}
      />

      <div className="p-6">
        {/* ═══ Create Work Order Form (Modal) ═══ */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Create New Work Order</CardTitle>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="text-slate-400 hover:text-slate-200 text-xl"
                  >
                    ✕
                  </button>
                </div>
              </CardHeader>

              <div className="p-6 space-y-4">
                {/* Customer Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      placeholder="John Smith"
                      className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="+1 555-0000"
                      className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Service Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1">
                      Service Type
                    </label>
                    <select className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:border-indigo-500">
                      <option>Installation</option>
                      <option>Maintenance</option>
                      <option>Repair</option>
                      <option>Inspection</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1">
                      Priority
                    </label>
                    <select className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:border-indigo-500">
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300 block mb-1">
                      Preferred Date
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-1">
                    Description
                  </label>
                  <textarea
                    placeholder="Describe the work needed..."
                    rows={4}
                    className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="123 Main St, New York, NY"
                    className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Required Skills */}
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2">
                    Required Skills
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {["electrical", "plumbing", "hvac", "appliances", "general"].map((skill) => (
                      <label key={skill} className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm text-slate-300 capitalize">{skill}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button variant="primary" className="flex-1">
                    Create Work Order
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ═══ Filters ═══ */}
        <div className="flex flex-col gap-4 mb-6">
          {/* Search */}
          <input
            type="text"
            placeholder="Search by job #, customer, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />

          {/* Filter Pills */}
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "created", "scheduled", "dispatched", "in_progress", "completed"] as const).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border",
                      statusFilter === status
                        ? "bg-indigo-500 text-slate-50 border-indigo-500"
                        : "border-slate-700 bg-transparent text-slate-400 hover:border-slate-600"
                    )}
                  >
                    {status === "all" ? "All Status" : status.replace(/_/g, " ")}
                  </button>
                )
              )}
            </div>

            {/* Priority Filter */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "low", "medium", "high", "urgent"] as const).map((priority) => (
                <button
                  key={priority}
                  onClick={() => setPriorityFilter(priority)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border",
                    priorityFilter === priority
                      ? "bg-orange-500 text-slate-50 border-orange-500"
                      : "border-slate-700 bg-transparent text-slate-400 hover:border-slate-600"
                  )}
                >
                  {priority === "all" ? "All Priority" : priority}
                </button>
              ))}
            </div>

            {/* Type Filter */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "installation", "maintenance", "repair", "inspection"] as const).map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border",
                      typeFilter === type
                        ? "bg-blue-500 text-slate-50 border-blue-500"
                        : "border-slate-700 bg-transparent text-slate-400 hover:border-slate-600"
                    )}
                  >
                    {type === "all" ? "All Types" : type}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* ═══ Work Orders Table + Detail Panel ═══ */}
        <div
          className={cn(
            "grid gap-5",
            selectedJobData ? "grid-cols-1 lg:grid-cols-[1fr_450px]" : "grid-cols-1"
          )}
        >
          {/* Table Card */}
          <Card>
            <CardHeader>
              <CardTitle>Work Orders ({filteredOrders.length})</CardTitle>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700 bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Job #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Tech
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      ETA
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedJob(order.id)}
                      className={cn(
                        "hover:bg-slate-800 transition-colors cursor-pointer",
                        selectedJobData?.id === order.id && "bg-slate-800"
                      )}
                    >
                      <td className="px-4 py-3 text-slate-100 font-mono text-xs">
                        {order.jobNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <div>{order.customerName}</div>
                        <div className="text-xs text-slate-500">{order.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 capitalize text-xs">
                        {order.serviceType.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={priorityVariant(order.priority)}>
                          {order.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(order.status)}>
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {order.assignedTechName || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {order.eta || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Detail Drawer */}
          {selectedJobData && (
            <Card className="sticky overflow-y-auto" style={{ top: "24px", maxHeight: "calc(100vh - 200px)" }}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Job Details</CardTitle>
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="text-slate-400 hover:text-slate-200 text-xl"
                  >
                    ✕
                  </button>
                </div>
              </CardHeader>

              <div className="p-4 space-y-4">
                {/* Job Header */}
                <div>
                  <div className="text-lg font-bold text-slate-100 mb-1">
                    {selectedJobData.jobNumber}
                  </div>
                  <div className="flex gap-2 mb-3">
                    <Badge variant={statusVariant(selectedJobData.status)}>
                      {selectedJobData.status.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant={priorityVariant(selectedJobData.priority)}>
                      {selectedJobData.priority}
                    </Badge>
                  </div>
                </div>

                <div className="h-px bg-slate-700" />

                {/* Customer Info */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    Customer
                  </div>
                  <div className="text-sm text-slate-100 font-medium">
                    {selectedJobData.customerName}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {selectedJobData.customerPhone}
                  </div>
                </div>

                <div className="h-px bg-slate-700" />

                {/* Service Details */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    Service
                  </div>
                  <div className="text-sm text-slate-100 capitalize">
                    {selectedJobData.serviceType.replace(/_/g, " ")}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Est. {selectedJobData.estimatedDuration} minutes
                  </div>
                </div>

                <div className="h-px bg-slate-700" />

                {/* Location */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    Location
                  </div>
                  <div className="text-sm text-slate-100">
                    {selectedJobData.location}
                  </div>
                </div>

                <div className="h-px bg-slate-700" />

                {/* Description */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    Description
                  </div>
                  <div className="text-sm text-slate-300">
                    {selectedJobData.description}
                  </div>
                </div>

                <div className="h-px bg-slate-700" />

                {/* Required Skills */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    Required Skills
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedJobData.requiredSkills.map((skill) => (
                      <Badge key={skill} variant="info">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                {selectedJobData.assignedTechName && (
                  <>
                    <div className="h-px bg-slate-700" />

                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                        Assigned
                      </div>
                      <div className="text-sm text-slate-100">
                        {selectedJobData.assignedTechName}
                      </div>
                      {selectedJobData.eta && (
                        <div className="text-xs text-slate-400 mt-1">
                          ETA: {selectedJobData.eta}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="h-px bg-slate-700" />

                {/* Notes */}
                {selectedJobData.notes.length > 0 && (
                  <>
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                        Notes
                      </div>
                      <ul className="text-xs text-slate-300 space-y-1">
                        {selectedJobData.notes.map((note, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-slate-500">•</span>
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="h-px bg-slate-700" />
                  </>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button variant="primary" size="sm" className="w-full text-xs">
                    Edit Details
                  </Button>
                  <Button variant="secondary" size="sm" className="w-full text-xs">
                    Assign Technician
                  </Button>
                  {selectedJobData.status === "in_progress" && (
                    <Button variant="success" size="sm" className="w-full text-xs">
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
    </>
  );
}
