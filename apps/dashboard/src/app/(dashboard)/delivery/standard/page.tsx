'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { Plus, Download, RefreshCw, Truck, Map, LayoutList, MapPin, User } from 'lucide-react';
import type { DeliveryMapShipment } from '../components/delivery-map-view';

// ── Types ─────────────────────────────────────────────────────

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  deliveryMethod?: string | null;
  deliveryDate?: string | null;
  estimatedArrival?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  recipientName?: string | null;
  deliveryLocation?: { lat: number; lng: number } | null;
  driverId?: string | null;
  driver?: { id: string; name: string; phone: string } | null;
  order?: {
    id: string;
    externalOrderNumber?: string | null;
    customerName?: string | null;
  } | null;
  createdAt: string;
}

const STATUS_DISPLAY: Record<string, string> = {
  PENDING: 'pending',
  PROCESSING: 'pending',
  READY_FOR_PICKUP: 'scheduled',
  PICKED_UP: 'in-transit',
  IN_TRANSIT: 'in-transit',
  OUT_FOR_DELIVERY: 'in-transit',
  ARRIVED: 'in-transit',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RETURNED: 'failed',
  CANCELLED: 'failed',
};

function displayStatus(s: string): string {
  return STATUS_DISPLAY[s] ?? s.toLowerCase();
}

function statusVariant(s: string): 'success' | 'primary' | 'warning' | 'danger' | 'default' {
  switch (displayStatus(s)) {
    case 'delivered': return 'success';
    case 'in-transit': return 'primary';
    case 'scheduled':
    case 'pending': return 'warning';
    case 'failed': return 'danger';
    default: return 'default';
  }
}

function formatAddress(s: Shipment): string {
  return [s.addressLine1, s.city, s.province].filter(Boolean).join(', ') || '—';
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Lazy map ──────────────────────────────────────────────────

const DeliveryMapView = dynamic(
  () => import('../components/delivery-map-view'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] rounded-xl bg-wl-bg-root border border-wl-border-strong flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-wl-border-default border-t-white animate-spin mx-auto mb-3" />
          <p className="text-sm text-wl-text-tertiary">Loading map…</p>
        </div>
      </div>
    ),
  },
);

// ── Status tabs config ────────────────────────────────────────

const STATUS_TABS = ['all', 'pending', 'scheduled', 'in-transit', 'delivered', 'failed'];

// ── Page ──────────────────────────────────────────────────────

type ViewMode = 'list' | 'map';

export default function StandardDeliveryPage() {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { items: shipments, loading, error, refetch } = useApiList<Shipment>(
    '/api/v4/shipments',
    { limit: 100, deliveryMethod: 'STANDARD' },
  );

  const filtered = useMemo(() =>
    filterStatus === 'all'
      ? shipments
      : shipments.filter((s) => displayStatus(s.status) === filterStatus),
    [shipments, filterStatus],
  );

  const statusCount = (label: string) =>
    label === 'all'
      ? shipments.length
      : shipments.filter((s) => displayStatus(s.status) === label).length;

  const mapShipments: DeliveryMapShipment[] = useMemo(() =>
    filtered.map((s) => ({
      id: s.id,
      shipmentNumber: s.shipmentNumber,
      status: s.status,
      recipientName: s.recipientName,
      addressLine1: s.addressLine1,
      city: s.city,
      deliveryLocation: s.deliveryLocation,
      order: s.order,
    })),
    [filtered],
  );

  return (
    <>
      <Header
        title="Standard Delivery"
        subtitle="Ground delivery operations"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-wl-border-subtle overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                  viewMode === 'list' ? 'bg-wl-primary text-white' : 'text-wl-text-secondary hover:text-wl-text-primary',
                )}
                aria-pressed={viewMode === 'list'}
              >
                <LayoutList className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={cn(
                  'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                  viewMode === 'map' ? 'bg-wl-primary text-white' : 'text-wl-text-secondary hover:text-wl-text-primary',
                )}
                aria-pressed={viewMode === 'map'}
              >
                <Map className="w-4 h-4" />
                <span className="hidden sm:inline">Map</span>
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
            <Button variant="secondary" size="sm">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Shipment</span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-4">

        {/* Status filter tabs */}
        <div className="flex gap-1 flex-wrap" role="tablist">
          {STATUS_TABS.map((status) => (
            <button
              key={status}
              role="tab"
              aria-selected={filterStatus === status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                filterStatus === status
                  ? 'bg-wl-primary text-white'
                  : 'bg-wl-bg-elevated text-wl-text-secondary hover:text-wl-text-primary border border-wl-border-subtle',
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
              {!loading && <span className="ml-1.5 text-xs opacity-60">({statusCount(status)})</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && shipments.length === 0 ? (
          <LoadingSkeleton />
        ) : error && shipments.length === 0 ? (
          <ErrorState
            title="Failed to load shipments"
            message={error.message}
            onRetry={refetch}
          />
        ) : viewMode === 'map' ? (
          <div className="h-[520px]">
            <DeliveryMapView
              shipments={mapShipments}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-wl-border-subtle bg-wl-bg-elevated">
            <Truck className="w-10 h-10 text-wl-text-tertiary" />
            <div className="text-center">
              <p className="text-sm font-medium text-wl-text-secondary">No shipments found</p>
              <p className="text-xs text-wl-text-tertiary mt-1">
                {filterStatus === 'all'
                  ? 'Create your first standard delivery shipment'
                  : `No ${filterStatus.replace('-', ' ')} shipments`}
              </p>
            </div>
          </div>
        ) : (
          <Card className="bg-wl-bg-surface border border-wl-border-default overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default bg-wl-bg-elevated">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">Shipment #</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">Address</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">Driver</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">Scheduled</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((shipment, idx) => (
                    <tr
                      key={shipment.id}
                      onClick={() => setSelectedId((prev) => (prev === shipment.id ? null : shipment.id))}
                      className={cn(
                        'border-b border-wl-border-default hover:bg-wl-bg-elevated transition-colors cursor-pointer',
                        idx % 2 === 0 ? 'bg-wl-bg-surface' : 'bg-wl-bg-sunken',
                        selectedId === shipment.id && 'bg-wl-primary/10',
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-white font-mono text-xs">
                        {shipment.shipmentNumber}
                      </td>
                      <td className="px-4 py-3 text-wl-text-secondary">
                        {shipment.order?.customerName ?? shipment.recipientName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-wl-text-secondary">
                        <span className="flex items-center gap-1">
                          {(shipment.addressLine1 || shipment.city) && (
                            <MapPin className="w-3 h-3 flex-shrink-0 text-wl-text-tertiary" />
                          )}
                          {formatAddress(shipment)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-wl-text-secondary">
                        {shipment.driver ? (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-wl-text-tertiary" />
                            {shipment.driver.name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="text-center px-4 py-3">
                        <Badge variant={statusVariant(shipment.status)} size="sm">
                          {displayStatus(shipment.status).replace('-', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-wl-text-secondary text-xs">
                        {formatDate(shipment.estimatedArrival ?? shipment.deliveryDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
