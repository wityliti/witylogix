'use client';

import { WLMap } from '@/components/map/wl-map';
import { PinLayer } from '@/components/map/pin-layer';
import type { PinStatus } from '@/components/map/pin-layer';

function toPinStatus(status: string): PinStatus {
  if (status === 'DELIVERED') return 'assigned';
  if (['IN_TRANSIT', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'].includes(status)) return 'in_transit';
  if (['FAILED', 'RETURNED', 'CANCELLED'].includes(status)) return 'delayed';
  return 'open';
}

interface ShipmentLocationMapProps {
  shipmentId: string;
  label: string;
  lat: number;
  lng: number;
  status: string;
}

export default function ShipmentLocationMap({
  shipmentId,
  label,
  lat,
  lng,
  status,
}: ShipmentLocationMapProps) {
  return (
    <WLMap
      center={[lng, lat]}
      zoom={14}
      className="h-full w-full rounded-xl overflow-hidden"
    >
      <PinLayer
        pins={[{ id: shipmentId, lng, lat, status: toPinStatus(status), label }]}
      />
    </WLMap>
  );
}
