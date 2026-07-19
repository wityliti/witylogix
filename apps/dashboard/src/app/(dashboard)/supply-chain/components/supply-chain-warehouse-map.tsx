'use client';

import { WLMap } from '@/components/map/wl-map';
import { WarehouseLayer, type WarehousePin } from '@/components/map/warehouse-layer';
import type { WarehouseUtilization } from '@/hooks/use-supply-chain';

interface SupplyChainWarehouseMapProps {
  warehouses: WarehouseUtilization[];
}

function toWarehousePin(wh: WarehouseUtilization): WarehousePin | null {
  if (wh.lat == null || wh.lng == null) return null;
  return {
    id: wh.warehouseId,
    name: wh.name,
    lat: wh.lat,
    lng: wh.lng,
    utilizationPercentage: wh.utilizationPercentage,
    totalQuantity: wh.totalQuantity ?? wh.utilization,
    itemCount: wh.itemCount ?? 0,
    city: wh.city,
  };
}

export function SupplyChainWarehouseMap({ warehouses }: SupplyChainWarehouseMapProps) {
  const pins = warehouses.map(toWarehousePin).filter((p): p is WarehousePin => p !== null);

  if (pins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3 bg-wl-bg-surface rounded-xl border border-wl-border-default p-12">
        <div className="w-12 h-12 rounded-full bg-wl-bg-elevated flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-wl-text-tertiary">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-wl-text-secondary">No geocoded warehouses</p>
          <p className="text-xs text-wl-text-tertiary mt-1">Set lat/lng coordinates on your locations to see them on the map.</p>
        </div>
      </div>
    );
  }

  const center: [number, number] = [pins[0].lng, pins[0].lat];

  return (
    <div className="relative h-full rounded-xl overflow-hidden border border-wl-border-default">
      <WLMap center={center} zoom={5} className="h-full w-full">
        <WarehouseLayer warehouses={pins} />
      </WLMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-wl-bg-elevated/90 backdrop-blur rounded-lg border border-wl-border-default p-3 text-xs space-y-1.5">
        <p className="font-semibold text-wl-text-secondary mb-1">Utilization</p>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-wl-info-500 flex-shrink-0" /><span className="text-wl-text-tertiary">&lt;60% — Low</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-wl-success-500 flex-shrink-0" /><span className="text-wl-text-tertiary">60–79% — Moderate</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-wl-warning-500 flex-shrink-0" /><span className="text-wl-text-tertiary">80–94% — High</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-wl-danger-500 flex-shrink-0" /><span className="text-wl-text-tertiary">≥95% — Critical</span></div>
      </div>

      {/* Count badge */}
      <div className="absolute top-4 right-4 bg-wl-bg-elevated/90 backdrop-blur rounded-lg border border-wl-border-default px-3 py-1.5 text-xs text-wl-text-secondary">
        {pins.length} warehouse{pins.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
