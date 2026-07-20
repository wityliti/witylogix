'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { LayoutList, Map } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   SHIPMENT TRACKING  — List / Map toggle, real data
   ═══════════════════════════════════════════════════════════ */

const ShipmentsMapView = dynamic(
  () => import('@/components/shipments/shipments-map-view'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full rounded-xl bg-wl-bg-overlay border border-wl-border-default flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-wl-border-strong border-t-blue-500 animate-spin" />
      </div>
    ),
  },
);

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
  postalCode: string | null;
  addressLine1: string | null;
  createdAt: string;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  deliveryMethod: string;
  weight: number | null;
  shippingCost: number | null;
  codAmount: number | null;
  notes: string | null;
  tags: string[];
  deliveryLocation: { lat: number; lng: number } | null;
  order: { id: string; shopifyOrderNumber: string | null; externalOrderNumber: string | null } | null;
  driver: { id: string; name: string; phone: string } | null;
  location: { id: string; name: string; city: string } | null;
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
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);

  const {
    items: shipments,
    loading,
    error,
    refetch,
    pagination,
    setPage,
  } = useApiList<ShipmentTracking>('/api/v4/shipments', { limit: 50 });

  const filteredShipments = useMemo(
    () =>
      filterStatus === 'ALL'
        ? shipments
        : shipments.filter((s) => s.status === filterStatus),
    [shipments, filterStatus],
  );

  const mappableCount = useMemo(
    () =>
      filteredShipments.filter(
        (s) =>
          s.deliveryLocation != null &&
          typeof s.deliveryLocation.lat === 'number' &&
          typeof s.deliveryLocation.lng === 'number',
      ).length,
    [filteredShipments],
  );

  const inTransitCount = shipments.filter((s) =>
    IN_TRANSIT_STATUSES.includes(s.status),
  ).length;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Shipment Tracking"
        subtitle={`${inTransitCount} in transit · ${pagination.total} total`}
      />

      <main className="min-h-screen bg-wl-bg-root p-6 space-y-6">
        {/* Toolbar: filters + view toggle */}
        <Card className="bg-wl-bg-surface border border-wl-border-default">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Status filters */}
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
                      className={cn(
                        'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                        filterStatus === status
                          ? 'bg-wl-info-500 text-white'
                          : 'bg-wl-bg-elevated text-wl-text-secondary hover:text-white',
                      )}
                    >
                      {status.replace(/_/g, ' ')}
                      <span className="ml-1.5 text-xs opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* List / Map toggle */}
              <div className="flex items-center gap-1 p-1 bg-wl-bg-overlay rounded-lg border border-wl-border-default">
                <button
                  onClick={() => setView('list')}
                  aria-label="List view"
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                    view === 'list'
                      ? 'bg-wl-primary text-white'
                      : 'text-wl-text-muted hover:text-wl-text-primary',
                  )}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  List
                </button>
                <button
                  onClick={() => setView('map')}
                  aria-label="Map view"
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                    view === 'map'
                      ? 'bg-wl-primary text-white'
                      : 'text-wl-text-muted hover:text-wl-text-primary',
                  )}
                >
                  <Map className="w-3.5 h-3.5" />
                  Map
                  {mappableCount > 0 && (
                    <span className="ml-1 text-[10px] opacity-60">{mappableCount}</span>
                  )}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {view === 'map' ? (
          /* ── Map view ────────────────────────────────────── */
          <div className="h-[600px] rounded-xl overflow-hidden">
            {mappableCount === 0 ? (
              <div className="w-full h-full bg-wl-bg-overlay border border-wl-border-default rounded-xl flex items-center justify-center">
                <div className="text-center text-wl-text-secondary">
                  <Map className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-semibold text-wl-text-primary mb-1">No location data</p>
                  <p className="text-xs">Shipments need delivery coordinates to appear on the map.</p>
                </div>
              </div>
            ) : (
              <ShipmentsMapView
                shipments={filteredShipments as any}
                selectedId={selectedShipmentId}
                onShipmentClick={(id) =>
                  setSelectedShipmentId((prev) => (prev === id ? null : id))
                }
              />
            )}
          </div>
        ) : (
          /* ── List view ───────────────────────────────────── */
          <>
            <Card className="overflow-hidden p-0 bg-wl-bg-surface border border-wl-border-default">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-default bg-wl-bg-elevated">
                      <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Tracking #</th>
                      <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Recipient</th>
                      <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Carrier</th>
                      <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Last Known Location</th>
                      <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Status</th>
                      <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">ETA</th>
                      <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShipments.map((shipment, idx) => (
                      <tr
                        key={shipment.id}
                        className={cn(
                          'border-b border-wl-border-default transition-colors hover:bg-wl-bg-elevated',
                          idx % 2 === 0 ? 'bg-transparent' : 'bg-wl-bg-sunken',
                        )}
                      >
                        <td className="p-3 px-4 text-white font-mono text-xs">
                          {shipment.trackingNumber ?? shipment.shipmentNumber}
                        </td>
                        <td className="p-3 px-4 text-wl-text-secondary text-sm">
                          {shipment.recipientName ?? '—'}
                        </td>
                        <td className="p-3 px-4 text-wl-text-secondary text-sm">
                          {shipment.carrier ?? '—'}
                        </td>
                        <td className="p-3 px-4 text-wl-text-secondary text-sm">
                          {[shipment.city, shipment.province].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="p-3 px-4 text-center">
                          <Badge variant={getStatusColor(shipment.status)}>
                            {shipment.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="p-3 px-4 text-center text-wl-text-secondary text-sm">
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
                        <td colSpan={7} className="p-8 text-center text-wl-text-tertiary text-sm">
                          No shipments found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

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
                <span className="text-sm text-wl-text-secondary self-center">
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
          </>
        )}
      </main>
    </>
  );
}
