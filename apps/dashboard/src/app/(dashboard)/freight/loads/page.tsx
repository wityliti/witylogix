'use client';

import { useApiList } from '@/hooks/use-api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { Package, Plus, Upload } from 'lucide-react';

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  addressLine1?: string | null;
  city?: string | null;
  recipientName?: string | null;
}

const statusBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'> = {
    Available: 'primary',
    Booked: 'success',
    PENDING: 'primary',
    'In-Transit': 'info',
    IN_TRANSIT: 'info',
    Delivered: 'success',
    DELIVERED: 'success',
    Exception: 'danger',
    FAILED: 'danger',
  };
  return map[status] ?? 'default';
};

export default function FreightLoadsPage() {
  const { items: shipments, pagination, loading, error, refetch, setPage } = useApiList<Shipment>('/api/v4/shipments?type=freight&view=loads');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const activeLoads = shipments.filter((s) => ['Booked', 'In-Transit', 'IN_TRANSIT', 'PICKED_UP'].includes(s.status)).length;

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-wl-text-primary">Load Board</h1>
            <p className="text-sm text-wl-text-secondary mt-0.5">
              {pagination.total} total loads · {activeLoads} active
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" size="md">
              <Plus className="w-4 h-4" /> Create Load
            </Button>
            <Button variant="secondary" size="md">
              <Upload className="w-4 h-4" /> Import
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">Total Loads</span>
              <Package className="text-wl-info-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-wl-text-primary">{pagination.total}</p>
            <p className="text-wl-text-tertiary text-xs mt-2">All shipments</p>
          </div>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">In Transit</span>
              <div className="w-5 h-5 rounded-full bg-wl-success-500" />
            </div>
            <p className="text-3xl font-bold text-wl-text-primary">{activeLoads}</p>
            <p className="text-wl-text-tertiary text-xs mt-2">Currently moving</p>
          </div>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">Available</span>
              <div className="w-5 h-5 rounded-full bg-wl-info-500" />
            </div>
            <p className="text-3xl font-bold text-wl-text-primary">
              {shipments.filter((s) => s.status === 'Available' || s.status === 'PENDING').length}
            </p>
            <p className="text-wl-text-tertiary text-xs mt-2">Ready to book</p>
          </div>
        </Card>
      </div>

      {/* Loads Table */}
      <Card className="bg-wl-bg-surface border-wl-border-default overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-wl-bg-overlay border-b border-wl-border-default">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-wl-text-secondary">Load ID</th>
                <th className="px-6 py-4 text-left font-semibold text-wl-text-secondary">Recipient</th>
                <th className="px-6 py-4 text-left font-semibold text-wl-text-secondary">Destination</th>
                <th className="px-6 py-4 text-center font-semibold text-wl-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-wl-text-tertiary">
                    No loads found
                  </td>
                </tr>
              ) : (
                shipments.map((shipment, idx) => (
                  <tr
                    key={shipment.id}
                    className={cn(
                      'border-b border-wl-border-default transition-colors hover:bg-wl-bg-overlay',
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-wl-bg-surface'
                    )}
                  >
                    <td className="px-6 py-4 text-wl-text-primary font-semibold">
                      {shipment.shipmentNumber || shipment.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 text-wl-text-secondary text-xs">
                      {shipment.recipientName ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-wl-text-secondary text-xs">
                      {shipment.addressLine1
                        ? `${shipment.addressLine1}${shipment.city ? `, ${shipment.city}` : ''}`
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={statusBadgeVariant(shipment.status)}>{shipment.status}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-wl-border-default bg-wl-bg-overlay text-sm text-wl-text-secondary">
          <div>
            Showing {shipments.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <span className="px-3 py-1 flex items-center text-wl-text-tertiary">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(Math.min(pagination.totalPages, pagination.page + 1))}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
