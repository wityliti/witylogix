'use client';

import { useMemo } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { PinLayer, type Pin } from '@/components/map/pin-layer';
import { useWLMap } from '@/components/map/wl-map-context';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import { RotateCcw } from 'lucide-react';
import type { Return } from '@/hooks/use-returns';

// ── Fit bounds to all pins ────────────────────────────────────────────────────

function FitToPins({ pins }: { pins: Pin[] }) {
  const map = useWLMap();
  const coords = useMemo(() => pins.map((p) => ({ lat: p.lat, lng: p.lng })), [pins]);
  useFitBounds(map, coords, 60);
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type NormStatus = 'pending' | 'approved' | 'rejected' | 'received' | 'inspected' | 'refunded';

function normalize(status: string): NormStatus {
  const s = status?.toLowerCase?.() ?? '';
  if (s === 'rejected') return 'rejected';
  if (s === 'approved') return 'approved';
  if (s === 'received' || s === 'picked_up' || s === 'in_transit') return 'received';
  if (s === 'inspected') return 'inspected';
  if (s === 'refunded') return 'refunded';
  return 'pending';
}

function statusToPin(status: NormStatus): Pin['status'] {
  if (status === 'refunded') return 'in_transit';
  if (status === 'rejected') return 'delayed';
  if (status === 'approved' || status === 'received' || status === 'inspected') return 'assigned';
  return 'open';
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReturnsMapViewProps {
  returns: Return[];
  onSelect?: (id: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [0, 20];

export default function ReturnsMapView({ returns }: ReturnsMapViewProps) {
  type ReturnWithOrder = Return & { order?: { deliveryLat?: number | null; deliveryLng?: number | null; customerName?: string | null } };

  const pins: Pin[] = useMemo(() =>
    (returns as ReturnWithOrder[])
      .filter((r) => r.order?.deliveryLat != null && r.order?.deliveryLng != null)
      .map((r) => ({
        id: r.id,
        lat: r.order!.deliveryLat!,
        lng: r.order!.deliveryLng!,
        status: statusToPin(normalize(r.status as string)),
        label: r.order?.customerName ?? r.customerName ?? 'Return',
      })),
    [returns],
  );

  const center: [number, number] = pins.length > 0 ? [pins[0].lng, pins[0].lat] : DEFAULT_CENTER;

  if (pins.length === 0) {
    return (
      <div className="w-full h-[480px] rounded-xl bg-wl-bg-elevated border border-wl-border-subtle flex flex-col items-center justify-center gap-3">
        <RotateCcw className="w-10 h-10 text-wl-text-tertiary" />
        <div className="text-center">
          <p className="text-sm font-medium text-wl-text-secondary">No location data</p>
          <p className="text-xs text-wl-text-tertiary mt-1">
            Returns with associated order coordinates will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-wl-border-subtle">
      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-wl-bg-elevated border-b border-wl-border-subtle text-xs text-wl-text-secondary flex-wrap">
        <span className="font-medium">Return Pickup Locations</span>
        {[
          { color: 'bg-[var(--wl-pin-open,#3b82f6)]',     label: 'Pending' },
          { color: 'bg-[var(--wl-pin-assigned,#f59e0b)]', label: 'Approved / Received' },
          { color: 'bg-[var(--wl-pin-in-transit,#10b981)]', label: 'Refunded' },
          { color: 'bg-[var(--wl-pin-delayed,#ef4444)]',  label: 'Rejected' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
            {label}
          </span>
        ))}
        <span className="ml-auto text-wl-text-tertiary">{pins.length} location{pins.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="h-[480px]">
        <WLMap center={center} zoom={11} className="w-full h-full">
          {pins.length > 0 && <FitToPins pins={pins} />}
          <PinLayer pins={pins} />
        </WLMap>
      </div>
    </div>
  );
}
