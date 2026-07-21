'use client';

import { useState } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { DriverLayer, type DriverMarker, type DriverStatus } from '@/components/map/driver-layer';
import { OrderLayer, type OrderPin, type OrderPinStatus } from '@/components/map/order-layer';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import { useWLMap } from '@/components/map/wl-map-context';

interface DispatchDriver {
  id: string;
  name: string;
  status: string;
  vehicleType?: string;
  lat: number | null;
  lng: number | null;
  heading?: number | null;
  activeDeliveries?: number;
}

interface DispatchOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  address: string;
  status: string;
  priority: string;
  lat: number | null;
  lng: number | null;
}

const DRIVER_STATUS_MAP: Record<string, DriverStatus> = {
  available: 'available',
  busy: 'busy',
  break: 'break',
  offline: 'offline',
};

const ORDER_STATUS_MAP: Record<string, OrderPinStatus> = {
  PENDING: 'pending',
  ACCEPTED: 'assigned',
  ASSIGNED: 'assigned',
  PICKED_UP: 'in_transit',
  OUT_FOR_DELIVERY: 'in_transit',
};

function MapLayers({
  driverMarkers,
  orderPins,
  selectedDriverId,
  selectedOrderId,
  onDriverClick,
  onOrderClick,
}: {
  driverMarkers: DriverMarker[];
  orderPins: OrderPin[];
  selectedDriverId: string | null;
  selectedOrderId: string | null;
  onDriverClick: (id: string) => void;
  onOrderClick: (id: string) => void;
}) {
  const map = useWLMap();
  const allCoords = [
    ...driverMarkers.map((d) => ({ lng: d.lng, lat: d.lat })),
    ...orderPins.map((o) => ({ lng: o.lng, lat: o.lat })),
  ];
  useFitBounds(map, allCoords);

  return (
    <>
      <OrderLayer orders={orderPins} selectedOrderId={selectedOrderId} onOrderClick={onOrderClick} />
      <DriverLayer drivers={driverMarkers} selectedDriverId={selectedDriverId} onDriverClick={onDriverClick} />
    </>
  );
}

const STATUS_LEGEND = [
  { color: 'var(--wl-success-500)', label: 'Available' },
  { color: 'var(--wl-warning-500)', label: 'En Route / On Job' },
  { color: 'var(--wl-chart-purple)', label: 'On Break' },
  { color: 'var(--wl-neutral-500)', label: 'Offline' },
];

const JOB_LEGEND = [
  { color: 'var(--wl-info-400)', label: 'Pending' },
  { color: 'var(--wl-primary-500)', label: 'Assigned' },
  { color: 'var(--wl-success-500)', label: 'In Transit' },
  { color: 'var(--wl-danger-500)', label: 'Delayed' },
];

export default function FieldServiceDispatchMap({
  drivers,
  orders,
  onDriverSelect,
  onOrderSelect,
}: {
  drivers: DispatchDriver[];
  orders: DispatchOrder[];
  onDriverSelect?: (id: string) => void;
  onOrderSelect?: (id: string) => void;
}) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const driverMarkers: DriverMarker[] = drivers
    .filter((d) => d.lat != null && d.lng != null)
    .map((d) => ({
      id: d.id,
      name: d.name,
      status: (DRIVER_STATUS_MAP[d.status] ?? 'offline') as DriverStatus,
      lat: d.lat as number,
      lng: d.lng as number,
      heading: d.heading ?? null,
      activeDeliveries: d.activeDeliveries ?? 0,
      vehicleType: d.vehicleType ?? 'car',
    }));

  const orderPins: OrderPin[] = orders
    .filter((o) => o.lat != null && o.lng != null)
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      address: o.address,
      status: (ORDER_STATUS_MAP[o.status] ?? 'pending') as OrderPinStatus,
      lat: o.lat as number,
      lng: o.lng as number,
      priority: (o.priority as 'low' | 'medium' | 'high') ?? 'low',
    }));

  const defaultCenter: [number, number] = [0, 20];

  function handleDriverClick(id: string) {
    setSelectedDriverId(id === selectedDriverId ? null : id);
    onDriverSelect?.(id);
  }

  function handleOrderClick(id: string) {
    setSelectedOrderId(id === selectedOrderId ? null : id);
    onOrderSelect?.(id);
  }

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      {driverMarkers.length === 0 && orderPins.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center bg-wl-bg-elevated rounded-lg border border-wl-border-subtle">
          <div className="text-center text-wl-text-tertiary">
            <div className="text-3xl mb-2">📍</div>
            <p className="text-sm">No location data available</p>
            <p className="text-xs mt-1 text-wl-text-tertiary">Assign technicians to see them on the map</p>
          </div>
        </div>
      ) : (
        <WLMap center={defaultCenter} zoom={11} className="w-full h-full">
          <MapLayers
            driverMarkers={driverMarkers}
            orderPins={orderPins}
            selectedDriverId={selectedDriverId}
            selectedOrderId={selectedOrderId}
            onDriverClick={handleDriverClick}
            onOrderClick={handleOrderClick}
          />
        </WLMap>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-2 pointer-events-none">
        <div className="bg-wl-bg-overlay/90 backdrop-blur-sm rounded px-3 py-2 border border-wl-border-subtle text-xs space-y-1">
          <p className="text-wl-text-secondary font-semibold mb-1">Technicians</p>
          {STATUS_LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
              <span className="text-wl-text-tertiary">{l.label}</span>
            </div>
          ))}
        </div>
        <div className="bg-wl-bg-overlay/90 backdrop-blur-sm rounded px-3 py-2 border border-wl-border-subtle text-xs space-y-1">
          <p className="text-wl-text-secondary font-semibold mb-1">Jobs</p>
          {JOB_LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: l.color }} />
              <span className="text-wl-text-tertiary">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
