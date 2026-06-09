'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/header';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import Link from 'next/link';

interface ShipmentWithLabel {
  id: string;
  shipmentNumber: string;
  trackingNumber: string | null;
  carrier: string | null;
  deliveryMethod: string;
  status: string;
  recipientName: string | null;
  city: string | null;
  province: string | null;
  labelUrl: string | null;
  createdAt: string;
  weight: number | null;
}

const statusVariant = (
  s: string,
): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' => {
  const map: Record<
    string,
    'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'
  > = {
    DELIVERED: 'success',
    CANCELLED: 'default',
    FAILED: 'danger',
    PENDING: 'warning',
    PROCESSING: 'info',
    IN_TRANSIT: 'primary',
    OUT_FOR_DELIVERY: 'primary',
  };
  return map[s] ?? 'default';
};

export default function ShippingLabelsPage() {
  const {
    items: shipments,
    loading,
    error,
    refetch,
    pagination,
    setPage,
  } = useApiList<ShipmentWithLabel>('/api/v4/shipments', { limit: 20 });

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Shipping Labels"
        subtitle={`${pagination.total} shipments`}
        actions={
          <Link href="/shipping/labels/new">
            <Button variant="primary" size="md">+ Create Label</Button>
          </Link>
        }
      />

      <main className="min-h-screen bg-wl-bg-root p-6">
        <Card className="overflow-hidden p-0 bg-wl-bg-surface border border-wl-border-default">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-wl-border-default bg-wl-bg-elevated">
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Tracking #</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Shipment #</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Carrier</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Destination</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Status</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Label</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shipment, idx) => (
                  <tr
                    key={shipment.id}
                    className={`border-b border-wl-border-default transition-colors hover:bg-wl-bg-elevated ${idx % 2 === 0 ? 'bg-transparent' : 'bg-wl-bg-sunken'}`}
                  >
                    <td className="p-3 px-4 text-white font-mono text-xs">
                      {shipment.trackingNumber ?? '—'}
                    </td>
                    <td className="p-3 px-4 text-gray-400 text-sm">{shipment.shipmentNumber}</td>
                    <td className="p-3 px-4 text-gray-400 text-sm">{shipment.carrier ?? '—'}</td>
                    <td className="p-3 px-4 text-gray-400 text-sm">
                      {[shipment.city, shipment.province].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="p-3 px-4">
                      <Badge variant={statusVariant(shipment.status)}>
                        {shipment.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="p-3 px-4 text-center">
                      {shipment.labelUrl ? (
                        <Badge variant="success">Available</Badge>
                      ) : (
                        <Badge variant="default">None</Badge>
                      )}
                    </td>
                    <td className="p-3 px-4 text-center flex gap-1 justify-center">
                      {shipment.labelUrl ? (
                        <a href={shipment.labelUrl} target="_blank" rel="noreferrer">
                          <Button variant="secondary" size="sm">Print</Button>
                        </a>
                      ) : (
                        <Button variant="secondary" size="sm" disabled>Print</Button>
                      )}
                      <Link href={`/shipments/${shipment.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {shipments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500 text-sm">
                      No shipments found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPage(pagination.page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-400 self-center">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </main>
    </>
  );
}
