'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';

interface Shipment {
  id: string;
  status: string;
}

const statusBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'> = {
    Available: 'primary',
    Booked: 'success',
    'In-Transit': 'info',
    Delivered: 'success',
    Exception: 'danger',
  };
  return map[status] ?? 'default';
};

export default function FreightLoadsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const { items: shipments, pagination, loading, error, refetch, setPage } = useApiList<Shipment>('/api/v4/shipments?type=freight&view=loads');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="p-6">
      {/* Header & Actions */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary">Load Board</h2>
          <p className="text-sm text-wl-text-secondary mt-1">{pagination.total} total loads</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" size="md">
            + Create Load
          </Button>
          <Button variant="secondary" size="md">
            📥 Import
          </Button>
        </div>
      </div>

      {/* Loads Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
                <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Load ID</th>
                <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Origin</th>
                <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Destination</th>
                <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment, idx) => (
                <tr key={shipment.id} className={cn('border-b border-wl-border-subtle transition-colors hover:bg-wl-bg-overlay', idx % 2 === 0 ? 'bg-transparent' : 'bg-wl-bg-overlay')}>
                  <td className="p-3 px-4 text-wl-text-primary font-semibold">{shipment.id}</td>
                  <td className="p-3 px-4 text-wl-text-secondary text-xs">Origin</td>
                  <td className="p-3 px-4 text-wl-text-secondary text-xs">Destination</td>
                  <td className="p-3 px-4 text-center">
                    <Badge variant={statusBadgeVariant(shipment.status)}>{shipment.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-wl-border-subtle bg-wl-bg-overlay text-sm text-wl-text-secondary">
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
            <span className="px-3 py-1 flex items-center">
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
