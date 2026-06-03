'use client';

import { useState } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { ShipmentMarkerLayer, type ShipmentMarker, type ShipmentMarkerStatus } from '@/components/map/shipment-marker-layer';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import { useWLMap } from '@/components/map/wl-map-context';
import { cn } from '@/lib/utils';

interface DeliveryShipment {
  id: string;
  shipmentNumber: string;
  status: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  recipientName?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  order?: { customerName?: string | null; externalOrderNumber?: string | null } | null;
}

const STATUS_LEGEND: { color: string; label: string; statuses: ShipmentMarkerStatus[] }[] = [
  { color: '#3b82f6', label: 'Pending / Processing', statuses: ['PENDING', 'PROCESSING', 'READY_FOR_PICKUP'] },
  { color: '#f59e0b', label: 'Picked Up / In Transit', statuses: ['PICKED_UP', 'IN_TRANSIT'] },
  { color: '#10b981', label: 'Out for Delivery', statuses: ['OUT_FOR_DELIVERY', 'ARRIVED'] },
  { color: '#059669', label: 'Delivered', statuses: ['DELIVERED'] },
  { color: '#ef4444', label: 'Failed / Returned', statuses: ['FAILED', 'FAILED_ATTEMPT', 'RETURNED', 'CANCELLED'] },
];

function normaliseStatus(s: string): ShipmentMarkerStatus {
  const upper = s.toUpperCase() as ShipmentMarkerStatus;
  const valid: ShipmentMarkerStatus[] = [
    'PENDING', 'PROCESSING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT',
    'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED', 'FAILED', 'FAILED_ATTEMPT',
    'RETURNED', 'CANCELLED',
  ];
  return valid.includes(upper) ? upper : 'PENDING';
}

function MapLayers({
  markers,
  selectedId,
  onShipmentClick,
}: {
  markers: ShipmentMarker[];
  selectedId: string | null;
  onShipmentClick: (id: string) => void;
}) {
  const map = useWLMap();
  const coords = markers.map((m) => ({ lng: m.lng, lat: m.lat }));
  useFitBounds(map, coords);

  return (
    <ShipmentMarkerLayer
      markers={markers}
      selectedId={selectedId}
      onShipmentClick={onShipmentClick}
    />
  );
}

const DEFAULT_CENTER: [number, number] = [77.12, 28.65];

export default function DeliveryMapView({ shipments }: { shipments: DeliveryShipment[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const markers: ShipmentMarker[] = shipments
    .filter((s) => s.deliveryLat != null && s.deliveryLng != null)
    .map((s) => ({
      id: s.id,
      lat: s.deliveryLat as number,
      lng: s.deliveryLng as number,
      status: normaliseStatus(s.status),
      label: s.shipmentNumber,
    }));

  const selected = shipments.find((s) => s.id === selectedId);

  return (
    <div className="relative w-full h-[560px] rounded-xl overflow-hidden border border-zinc-800">
      {markers.length === 0 ? (
        <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-300">No delivery locations available</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-64">
              Shipments with geocoded addresses will appear here. Locations are set when a shipment is created with coordinates.
            </p>
          </div>
        </div>
      ) : (
        <>
          <WLMap center={DEFAULT_CENTER} zoom={11} className="w-full h-full">
            <MapLayers
              markers={markers}
              selectedId={selectedId}
              onShipmentClick={setSelectedId}
            />
          </WLMap>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg p-3 z-10">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase mb-2">Shipment Status</p>
            <div className="space-y-1.5">
              {STATUS_LEGEND.map(({ color, label, statuses }) => {
                const count = markers.filter((m) => statuses.includes(m.status)).length;
                if (count === 0) return null;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs text-zinc-300">{label}</span>
                    <span className="text-xs font-mono text-zinc-500 ml-auto pl-2">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shipment count badge */}
          <div className="absolute top-4 left-4 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg px-3 py-1.5 z-10">
            <span className="text-xs font-semibold text-zinc-300">
              {markers.length} shipment{markers.length !== 1 ? 's' : ''} on map
            </span>
          </div>

          {/* Selected shipment popup */}
          {selected && (
            <div className="absolute top-4 right-4 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-lg p-4 z-10 min-w-52 max-w-64">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-semibold text-white">{selected.shipmentNumber}</p>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors ml-2"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              {(selected.order?.customerName ?? selected.recipientName) && (
                <p className="text-xs text-zinc-300 mb-1">
                  {selected.order?.customerName ?? selected.recipientName}
                </p>
              )}
              <p className={cn(
                'text-xs font-medium mb-1',
                selected.status === 'DELIVERED' ? 'text-emerald-400' :
                selected.status === 'FAILED' || selected.status === 'RETURNED' ? 'text-red-400' :
                selected.status === 'IN_TRANSIT' || selected.status === 'OUT_FOR_DELIVERY' ? 'text-amber-400' :
                'text-blue-400'
              )}>
                {selected.status.replace(/_/g, ' ')}
              </p>
              {(selected.addressLine1 ?? selected.city) && (
                <p className="text-xs text-zinc-500 truncate" title={`${selected.addressLine1}, ${selected.city}`}>
                  {[selected.addressLine1, selected.city].filter(Boolean).join(', ')}
                </p>
              )}
              {selected.order?.externalOrderNumber && (
                <p className="text-xs text-zinc-500 mt-1">
                  Order #{selected.order.externalOrderNumber}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
