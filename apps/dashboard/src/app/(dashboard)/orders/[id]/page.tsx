'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import dynamic from 'next/dynamic';
import type { Pin } from '@/components/map/pin-layer';

const WLMap = dynamic(() => import('@/components/map/wl-map').then((m) => m.WLMap), { ssr: false });
const PinLayer = dynamic(() => import('@/components/map/pin-layer').then((m) => m.PinLayer), { ssr: false });

// ─── API types (match the Prisma Order model returned by GET /api/v4/orders/:id) ───

interface NotificationLog {
  id: string;
  createdAt: string;
  event: string;
  message?: string | null;
  channel: string;
}

interface Driver {
  id: string;
  name: string;
  phone?: string;
  vehicleType?: string;
}

interface LineItemRaw {
  id?: string;
  name?: string;
  title?: string;
  sku?: string;
  quantity?: number;
  price?: number | string;
  unitPrice?: number;
  total?: number;
}

interface Order {
  id: string;
  externalOrderNumber: string | null;
  externalOrderId: string;
  source: string;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  deliveryLocation: { type: string; coordinates: [number, number] } | null;
  lineItems: LineItemRaw[];
  totalPrice: string | number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  driver: Driver | null;
  notificationLogs: NotificationLog[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  PENDING: '#8888a0',
  CONFIRMED: '#6C63FF',
  ASSIGNED: '#6C63FF',
  PICKED_UP: '#ffa500',
  IN_TRANSIT: '#ffa500',
  OUT_FOR_DELIVERY: '#4CAF50',
  DELIVERED: '#4CAF50',
  CANCELLED: '#ff4444',
  FAILED: '#ff4444',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  ASSIGNED: 'Assigned',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};

function extractCoords(
  loc: Order['deliveryLocation'],
): [number, number] | null {
  if (!loc) return null;
  if (loc.type === 'Point' && Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
    return [loc.coordinates[0], loc.coordinates[1]]; // [lng, lat]
  }
  return null;
}

function orderTitle(order: Order): string {
  return order.externalOrderNumber ?? order.externalOrderId ?? order.id;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(val: string | number | null | undefined): string {
  if (val == null) return '—';
  const num = Number(val);
  if (Number.isNaN(num)) return '—';
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [newNote, setNewNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const { data: order, loading, error, refetch } = useApiQuery<Order>(
    id ? `/api/v4/orders/${id}` : null,
  );

  const { execute: saveNoteApi } = useApiMutation<{ notes: string }>('PATCH', `/api/v4/orders/${id}`);

  const deliveryCoords = useMemo(() => extractCoords(order?.deliveryLocation ?? null), [order]);

  const deliveryPin: Pin | null = useMemo(() => {
    if (!deliveryCoords) return null;
    return {
      id: 'delivery',
      lng: deliveryCoords[0],
      lat: deliveryCoords[1],
      status: order?.status === 'DELIVERED' ? 'in_transit' : 'open',
      label: orderTitle(order as Order),
    };
  }, [deliveryCoords, order]);

  const mapCenter: [number, number] = deliveryCoords
    ? [deliveryCoords[0], deliveryCoords[1]]
    : [77.209, 28.6139]; // Default: New Delhi

  const lineItems: LineItemRaw[] = Array.isArray(order?.lineItems) ? order!.lineItems : [];

  const total = Number(order?.totalPrice ?? 0);
  const activities = order?.notificationLogs ?? [];

  const saveNote = async () => {
    if (!newNote.trim()) return;
    setNoteSaving(true);
    setNoteError(null);
    try {
      await saveNoteApi({ notes: newNote.trim() });
      setNewNote('');
      refetch();
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setNoteSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-6">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-6">
        <div className="text-center py-24 text-gray-400">Order not found</div>
      </div>
    );
  }

  const statusLabel = statusLabels[order.status] ?? order.status;
  const statusColor = statusColors[order.status] ?? '#8888a0';

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6 text-white">
      {/* Header */}
      <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white">{orderTitle(order)}</h1>
          <p className="text-sm text-gray-400 mt-2">
            Created {formatDate(order.createdAt)} · Source: {order.source}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button variant="secondary">Create Shipment</Button>
          <Button variant="secondary">Print Label</Button>
          <Button variant="danger">Cancel</Button>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <p className="font-semibold text-sm text-gray-300 mb-2">Order Status</p>
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase"
              style={{ background: statusColor + '26', color: statusColor, border: `1px solid ${statusColor}66` }}
            >
              {statusLabel}
            </span>
          </div>
          {order.driver && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Assigned Driver</p>
              <p className="text-sm font-semibold text-gray-200">{order.driver.name}</p>
              {order.driver.phone && (
                <p className="text-xs text-gray-400">{order.driver.phone}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
        {/* Customer Info */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6">
          <h3 className="font-semibold text-sm text-white mb-4">Customer Information</h3>
          {[
            { label: 'Name', value: order.customerName ?? '—' },
            { label: 'Email', value: order.customerEmail ?? '—' },
            { label: 'Phone', value: order.customerPhone ?? '—' },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-3 border-b border-[#1e1e2e] text-sm last:border-0">
              <span className="text-gray-400 font-medium">{row.label}</span>
              <span className="text-gray-300 font-semibold">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Delivery Address + Map */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6">
          <h3 className="font-semibold text-sm text-white mb-4">Delivery Address</h3>
          {[
            { label: 'Street', value: [order.addressLine1, order.addressLine2].filter(Boolean).join(', ') || '—' },
            { label: 'City', value: order.city ?? '—' },
            { label: 'State', value: order.province ?? '—' },
            { label: 'Postal Code', value: order.postalCode ?? '—' },
            { label: 'Country', value: order.country ?? '—' },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-2 border-b border-[#1e1e2e] text-sm last:border-0">
              <span className="text-gray-400 font-medium">{row.label}</span>
              <span className="text-gray-300 font-semibold">{row.value}</span>
            </div>
          ))}

          {/* Delivery location map */}
          <div className="mt-4 rounded-lg overflow-hidden" style={{ height: 200 }}>
            {deliveryPin ? (
              <WLMap center={mapCenter} zoom={13} className="w-full h-full">
                <PinLayer pins={[deliveryPin]} />
              </WLMap>
            ) : (
              <div className="w-full h-full bg-[#0a0a0f] border border-[#1e1e2e] flex flex-col items-center justify-center text-gray-500 text-sm gap-1">
                <span className="text-2xl">📍</span>
                <span>No coordinates available</span>
                <span className="text-xs">{[order.city, order.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-sm text-white mb-4">Line Items</h3>
        {lineItems.length === 0 ? (
          <p className="text-sm text-gray-400">No line items recorded</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Product', 'SKU', 'Qty', 'Unit Price', 'Total'].map((h) => (
                  <th key={h} className="bg-[#0a0a0f] border-b border-[#1e1e2e] p-3 text-left text-xs font-semibold text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => {
                const name = item.name ?? item.title ?? `Item ${i + 1}`;
                const sku = item.sku ?? '—';
                const qty = item.quantity ?? 1;
                const unitPrice = item.unitPrice ?? Number(item.price ?? 0);
                const rowTotal = item.total ?? unitPrice * qty;
                return (
                  <tr key={item.id ?? i}>
                    <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">{name}</td>
                    <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">{sku}</td>
                    <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">{qty}</td>
                    <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">{formatCurrency(unitPrice)}</td>
                    <td className="border-b border-[#1e1e2e] p-3 text-sm text-gray-300">{formatCurrency(rowTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="mt-4 flex justify-end">
          <div className="text-right">
            <p className="text-xs text-gray-400">Total Amount</p>
            <p className="text-xl font-bold text-blue-400">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Activity Timeline (from notification logs) */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6">
          <h3 className="font-semibold text-sm text-white mb-4">Activity Timeline</h3>
          {activities.length === 0 ? (
            <p className="text-sm text-gray-400">No activity recorded yet</p>
          ) : (
            <div className="relative pl-8 space-y-5">
              {activities.map((log, idx) => (
                <div key={log.id} className={`pb-5 ${idx < activities.length - 1 ? 'border-b border-[#1e1e2e]' : ''}`}>
                  <p className="text-xs text-gray-400">{formatDate(log.createdAt)}</p>
                  <p className="text-sm font-semibold text-gray-300 mt-1">
                    {log.event?.replace(/_/g, ' ').toUpperCase() ?? 'EVENT'}
                  </p>
                  {log.message && (
                    <p className="text-xs text-gray-400 mt-1">{log.message}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">via {log.channel}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Internal Notes */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6">
          <h3 className="font-semibold text-sm text-white mb-4">Internal Notes</h3>

          {order.notes && (
            <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded p-3 mb-4">
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{order.notes}</p>
              <p className="text-xs text-gray-500 mt-2">Last updated {formatDate(order.updatedAt)}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {order.notes ? 'Update Notes' : 'Add Notes'}
            </label>
            <textarea
              className="w-full p-3 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-gray-300 text-sm min-h-[80px] font-inherit box-border resize-none"
              placeholder="Add internal notes about this order..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
            {noteError && (
              <p className="text-xs text-red-400 mt-1">{noteError}</p>
            )}
            <Button
              variant="primary"
              className="w-full mt-2"
              onClick={saveNote}
              disabled={noteSaving || !newNote.trim()}
            >
              {noteSaving ? 'Saving…' : 'Save Note'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
