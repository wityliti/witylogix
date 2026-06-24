'use client';

import { useMemo } from 'react';
import { WLMap, type WLMapMarker } from './wl-map';
import { useFitBounds } from './use-fit-bounds';
import { useGeocoder, type AddressInput } from './use-geocoder';
import { cn } from '@/lib/utils';
import { MapPin, Loader2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  accepted: '#3b82f6',
  confirmed: '#3b82f6',
  assigned: '#8b5cf6',
  picked_up: '#06b6d4',
  out_for_delivery: '#6C63FF',
  in_transit: '#6C63FF',
  arrived: '#10b981',
  delivered: '#22c55e',
  failed: '#ef4444',
  cancelled: '#6b7280',
  returned: '#f97316',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status.toLowerCase()] ?? '#6C63FF';
}

export interface OrderMapItem {
  id: string;
  orderNumber?: string;
  status: string;
  customerName?: string;
  city?: string;
  country?: string;
  addressLine1?: string;
  /** Precise coordinates from deliveryLocation JSON field */
  lat?: number | null;
  lng?: number | null;
}

interface OrderLayerProps {
  orders: OrderMapItem[];
  selectedId?: string | null;
  onOrderClick?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
  height?: number;
}

export function OrderLayer({
  orders,
  selectedId,
  onOrderClick,
  className,
  style,
  height = 400,
}: OrderLayerProps) {
  const addressInputs = useMemo<AddressInput[]>(
    () =>
      orders.map((o) => ({
        id: o.id,
        city: o.city ?? '',
        country: o.country ?? 'US',
        lat: o.lat ?? null,
        lng: o.lng ?? null,
      })),
    [orders]
  );

  const { results, loading: geocoding } = useGeocoder(addressInputs);

  const markers = useMemo<WLMapMarker[]>(() => {
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    return results
      .filter((r) => r.geoLat !== null && r.geoLng !== null)
      .map((r) => {
        const order = orderMap.get(r.id)!;
        return {
          id: r.id,
          lat: r.geoLat!,
          lng: r.geoLng!,
          color: statusColor(order.status),
          popup: [
            order.orderNumber ? `<strong>${order.orderNumber}</strong>` : '',
            order.customerName ? `<span>${order.customerName}</span>` : '',
            order.addressLine1 ? `<span style="color:#94a3b8">${order.addressLine1}</span>` : '',
            `<span style="text-transform:capitalize;color:#94a3b8">${order.status.replace(/_/g, ' ')}</span>`,
          ]
            .filter(Boolean)
            .join('<br/>'),
        };
      });
  }, [results, orders]);

  const { center, zoom, shouldFit } = useFitBounds(markers);

  const placedCount = markers.length;
  const totalCount = orders.length;

  return (
    <div className={cn('relative', className)} style={style}>
      <WLMap
        center={center}
        zoom={zoom}
        markers={markers}
        fitBounds={shouldFit}
        selectedId={selectedId}
        onMarkerClick={onOrderClick}
        theme="dark"
        style={{ height }}
      />

      {/* Status overlay */}
      <div className="absolute bottom-2 left-2 flex items-center gap-2 z-[400]">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-zinc-900/90 border border-zinc-700 text-zinc-300 backdrop-blur-sm">
          <MapPin className="w-3 h-3 text-violet-400" />
          <span>
            {placedCount} / {totalCount} located
          </span>
          {geocoding && <Loader2 className="w-3 h-3 animate-spin text-violet-400" />}
        </div>
      </div>

      {/* Status legend */}
      <div className="absolute top-2 right-2 z-[400] px-2.5 py-2 rounded-md bg-zinc-900/90 border border-zinc-700 backdrop-blur-sm space-y-1">
        {Object.entries({
          Pending: '#f59e0b',
          'In Transit': '#6C63FF',
          Delivered: '#22c55e',
          Failed: '#ef4444',
        }).map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full border border-white/30"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-zinc-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
