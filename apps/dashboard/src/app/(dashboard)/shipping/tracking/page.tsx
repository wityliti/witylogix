'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';

interface ShipmentTracking {
  id: string;
  shipmentNumber: string;
  trackingNumber: string | null;
  orderId: string;
  carrier: string | null;
  status: string;
  estimatedArrival: string | null;
  city: string | null;
  province: string | null;
  createdAt: string;
  recipientName: string | null;
  order: { id: string; shopifyOrderNumber: string | null } | null;
}

const IN_TRANSIT_STATUSES = ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ARRIVED', 'PICKED_UP'];

const getStatusColor = (
  status: string,
): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' => {
  if (status === 'DELIVERED') return 'success';
  if (status === 'OUT_FOR_DELIVERY' || status === 'ARRIVED') return 'info';
  if (status === 'IN_TRANSIT' || status === 'PICKED_UP') return 'primary';
  if (status === 'FAILED' || status === 'RETURNED') return 'danger';
  return 'warning';
};

const FILTER_OPTIONS = ['ALL', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'];

export default function TrackingPage() {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const {
    items: shipments,
    loading,
    error,
    refetch,
    pagination,
    setPage,
  } = useApiList<ShipmentTracking>('/api/v4/shipments', { limit: 50 });

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const filteredShipments =
    filterStatus === 'ALL'
      ? shipments
      : shipments.filter((s) => s.status === filterStatus);

  const inTransitCount = shipments.filter((s) =>
    IN_TRANSIT_STATUSES.includes(s.status),
  ).length;

  return (
    <>
      <Header
        title="Shipment Tracking"
        subtitle={`${inTransitCount} in transit · ${pagination.total} total`}
      />

      <main className="min-h-screen bg-[#0a0a0f] p-6 space-y-6">
        {/* Filter Tabs */}
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardContent className="pt-4">
            <div className="flex gap-2 flex-wrap">
              {FILTER_OPTIONS.map((status) => {
                const count =
                  status === 'ALL'
                    ? shipments.length
                    : shipments.filter((s) => s.status === status).length;
                return (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      filterStatus === status
                        ? 'bg-blue-500 text-white'
                        : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
                    }`}
                  >
                    {status.replace(/_/g, ' ')}
                    <span className="ml-1.5 text-xs opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tracking Table */}
        <Card className="overflow-hidden p-0 bg-[#12121a] border border-[#1e1e2e]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2e] bg-[#1a1a2e]">
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Tracking #</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Recipient</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Carrier</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Last Known Location</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Status</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">ETA</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipments.map((shipment, idx) => (
                  <tr
                    key={shipment.id}
                    className={`border-b border-[#1e1e2e] transition-colors hover:bg-[#1a1a2e] ${idx % 2 === 0 ? 'bg-transparent' : 'bg-[#0f0f14]'}`}
                  >
                    <td className="p-3 px-4 text-white font-mono text-xs">
                      {shipment.trackingNumber ?? shipment.shipmentNumber}
                    </td>
                    <td className="p-3 px-4 text-gray-400 text-sm">
                      {shipment.recipientName ?? '—'}
                    </td>
                    <td className="p-3 px-4 text-gray-400 text-sm">
                      {shipment.carrier ?? '—'}
                    </td>
                    <td className="p-3 px-4 text-gray-400 text-sm">
                      {[shipment.city, shipment.province].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="p-3 px-4 text-center">
                      <Badge variant={getStatusColor(shipment.status)}>
                        {shipment.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="p-3 px-4 text-center text-gray-400 text-sm">
                      {shipment.estimatedArrival
                        ? new Date(shipment.estimatedArrival).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="p-3 px-4 text-center">
                      <Link
                        href={
                          shipment.trackingNumber
                            ? `/shipping/tracking/${shipment.trackingNumber}`
                            : `/shipments/${shipment.id}`
                        }
                      >
                        <Button variant="secondary" size="sm">Track</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredShipments.length === 0 && (
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
          <div className="flex justify-center gap-2">
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
