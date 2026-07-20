'use client';

import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useOrders } from '@/hooks/use-orders';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

interface BulkOperationResult {
  success: number;
  failed: number;
  details: { orderId: string; status: 'success' | 'error'; message: string }[];
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'primary' | 'success' | 'danger' | 'default'> = {
  pending: 'warning',
  confirmed: 'info',
  in_transit: 'primary',
  delivered: 'success',
  cancelled: 'danger',
};

export default function BulkOperationsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [newStatus, setNewStatus] = useState('confirmed');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [operationResults, setOperationResults] = useState<BulkOperationResult | null>(null);

  const { items: orders, loading, error, refetch } = useOrders({
    search: searchTerm || undefined,
    status: filterStatus as any || undefined,
    limit: 100,
  });

  const filteredOrders = useMemo(() => {
    if (!searchTerm && !filterStatus) return orders;
    return orders.filter(order => {
      const matchesSearch = !searchTerm ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !filterStatus || order.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, filterStatus]);

  const toggleOrderSelection = (orderId: string) => {
    const next = new Set(selectedOrders);
    if (next.has(orderId)) {
      next.delete(orderId);
    } else {
      next.add(orderId);
    }
    setSelectedOrders(next);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length && selectedOrders.size > 0) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleBulkAction = () => {
    if (!bulkAction || selectedOrders.size === 0) return;
    if (bulkAction === 'export_csv') {
      exportCSV();
      return;
    }
    setShowConfirmation(true);
  };

  const exportCSV = () => {
    const selected = filteredOrders.filter(o => selectedOrders.has(o.id));
    const rows = [
      ['Order ID', 'Customer', 'Status', 'Total', 'Created'],
      ...selected.map(o => [
        o.id,
        o.customerName,
        o.status,
        o.totalAmount.toString(),
        new Date(o.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    resetOperations();
  };

  const confirmAction = async () => {
    setShowConfirmation(false);
    setProcessing(true);

    const orderIds = Array.from(selectedOrders);
    const details: BulkOperationResult['details'] = [];
    let success = 0;
    let failed = 0;

    const statusPayload = bulkAction === 'cancel' ? 'cancelled' : newStatus;

    for (const orderId of orderIds) {
      try {
        await api.patch(`/api/v4/orders/${orderId}/status`, { status: statusPayload });
        details.push({ orderId, status: 'success', message: 'Updated successfully' });
        success++;
      } catch (err) {
        details.push({
          orderId,
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed',
        });
        failed++;
      }
    }

    setOperationResults({ success, failed, details });
    setProcessing(false);
    refetch();
  };

  const resetOperations = () => {
    setBulkAction('');
    setSelectedOrders(new Set());
    setOperationResults(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-wl-bg-root p-6">
        <TableSkeleton rows={10} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-wl-bg-root p-6">
        <ErrorState message="Failed to load orders" onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wl-bg-root p-6 text-white">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Bulk Operations</h1>
        <p className="text-sm text-wl-text-secondary">Perform bulk actions on multiple orders at once</p>
      </div>

      {/* Search and Filter */}
      <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-6 mb-6">
        <p className="text-base font-semibold mb-4 text-white">Search & Filter Orders</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-wl-neutral-300">Search Order ID or Customer</label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-neutral-300 text-sm box-border focus:outline-none focus:border-wl-info-500"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-wl-neutral-300">Filter by Status</label>
            <select
              className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-neutral-300 text-sm box-border focus:outline-none focus:border-wl-info-500"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-wl-neutral-300">&nbsp;</label>
            <button
              onClick={() => { setSearchTerm(''); setFilterStatus(''); }}
              className="px-4 py-2.5 rounded bg-transparent text-wl-info-500 font-semibold text-sm border border-wl-info-500 transition-all hover:bg-wl-info-500 hover:text-white"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Selection bar */}
      {filteredOrders.length > 0 && (
        <div className="bg-wl-bg-root border border-wl-border-default rounded-lg p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-wl-text-secondary flex-1">
            {selectedOrders.size > 0
              ? `${selectedOrders.size} order${selectedOrders.size !== 1 ? 's' : ''} selected`
              : 'Select orders to perform bulk actions'}
          </p>
          <button
            onClick={toggleSelectAll}
            className="px-4 py-2.5 rounded bg-transparent text-wl-info-500 font-semibold text-sm border border-wl-info-500 transition-all hover:bg-wl-info-500 hover:text-white"
          >
            {selectedOrders.size === filteredOrders.length && selectedOrders.size > 0 ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-6 mb-6">
        <p className="text-base font-semibold mb-4 text-white">Orders ({filteredOrders.length})</p>
        {filteredOrders.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="bg-wl-bg-root border-b border-wl-border-default p-3 text-left">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={selectedOrders.size === filteredOrders.length && selectedOrders.size > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="bg-wl-bg-root border-b border-wl-border-default p-3 text-left text-xs font-semibold text-wl-text-secondary">Order ID</th>
                <th className="bg-wl-bg-root border-b border-wl-border-default p-3 text-left text-xs font-semibold text-wl-text-secondary">Customer</th>
                <th className="bg-wl-bg-root border-b border-wl-border-default p-3 text-left text-xs font-semibold text-wl-text-secondary">Total</th>
                <th className="bg-wl-bg-root border-b border-wl-border-default p-3 text-left text-xs font-semibold text-wl-text-secondary">Status</th>
                <th className="bg-wl-bg-root border-b border-wl-border-default p-3 text-left text-xs font-semibold text-wl-text-secondary">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id}>
                  <td className="border-b border-wl-border-default p-3">
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
                    />
                  </td>
                  <td className="border-b border-wl-border-default p-3 text-sm text-wl-neutral-300 font-mono">
                    #{order.id.slice(0, 8)}
                  </td>
                  <td className="border-b border-wl-border-default p-3 text-sm text-wl-neutral-300">{order.customerName}</td>
                  <td className="border-b border-wl-border-default p-3 text-sm text-wl-neutral-300">₹{order.totalAmount.toLocaleString()}</td>
                  <td className="border-b border-wl-border-default p-3 text-sm">
                    <Badge variant={STATUS_VARIANT[order.status] ?? 'default'}>
                      {order.status.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="border-b border-wl-border-default p-3 text-sm text-wl-neutral-300">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-center text-wl-text-secondary">No orders found</div>
        )}
      </div>

      {/* Bulk Actions Section */}
      {selectedOrders.size > 0 && (
        <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-6 mb-6">
          <p className="text-base font-semibold mb-4 text-white">Bulk Actions</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-wl-neutral-300">Select Action</label>
              <select
                className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-neutral-300 text-sm box-border focus:outline-none focus:border-wl-info-500"
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
              >
                <option value="">-- Select Action --</option>
                <option value="update_status">Update Status</option>
                <option value="cancel">Cancel Orders</option>
                <option value="export_csv">Export to CSV</option>
              </select>
            </div>

            {bulkAction === 'update_status' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-wl-neutral-300">New Status</label>
                <select
                  className="w-full px-3 py-2.5 bg-wl-bg-root border border-wl-border-default rounded text-wl-neutral-300 text-sm box-border focus:outline-none focus:border-wl-info-500"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.filter(o => o.value !== 'cancelled').map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-wl-neutral-300">&nbsp;</label>
              <button
                onClick={handleBulkAction}
                disabled={!bulkAction || processing}
                className={cn(
                  'px-4 py-2.5 rounded font-semibold text-sm transition-all',
                  !bulkAction || processing
                    ? 'bg-wl-info-500 text-white opacity-50 cursor-not-allowed'
                    : 'bg-wl-info-500 text-white cursor-pointer hover:bg-wl-primary-600'
                )}
              >
                {processing ? 'Processing...' : 'Execute Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-8 max-w-md w-11/12 text-white">
            <h2 className="text-lg font-bold mb-4">Confirm Bulk Action</h2>
            <div className="text-sm text-wl-neutral-300 mb-5 leading-relaxed space-y-2">
              <div>Action: <strong>{bulkAction === 'update_status' ? `Update Status → ${newStatus}` : 'Cancel Orders'}</strong></div>
              <div>Orders selected: <strong>{selectedOrders.size}</strong></div>
              <div className="mt-4 text-wl-text-tertiary">This will affect all selected orders. Continue?</div>
            </div>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2.5 rounded bg-transparent text-wl-info-500 font-semibold text-sm border border-wl-info-500 transition-all hover:bg-wl-info-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className="px-4 py-2.5 rounded bg-wl-info-500 text-white font-semibold text-sm transition-all hover:bg-wl-primary-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {operationResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-8 max-w-md w-11/12 text-white">
            <h2 className="text-lg font-bold mb-4">Operation Complete</h2>
            <div className="text-sm text-wl-neutral-300 mb-5 space-y-1">
              <div className="text-wl-success-500 font-semibold">
                {operationResults.success} order{operationResults.success !== 1 ? 's' : ''} updated successfully
              </div>
              {operationResults.failed > 0 && (
                <div className="text-wl-danger-500 font-semibold">
                  {operationResults.failed} order{operationResults.failed !== 1 ? 's' : ''} failed
                </div>
              )}
            </div>
            <div className="mt-4 max-h-48 overflow-y-auto space-y-2">
              {operationResults.details.filter(d => d.status === 'error').map((detail, idx) => (
                <div key={idx} className="bg-wl-bg-root border-l-4 border-l-red-500 rounded p-3">
                  <p className="font-semibold text-sm text-wl-neutral-300 font-mono">#{detail.orderId.slice(0, 8)}</p>
                  <p className="text-xs text-wl-text-secondary mt-1">{detail.message}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2.5 justify-end mt-5">
              <button
                onClick={resetOperations}
                className="px-4 py-2.5 rounded bg-wl-info-500 text-white font-semibold text-sm transition-all hover:bg-wl-primary-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
