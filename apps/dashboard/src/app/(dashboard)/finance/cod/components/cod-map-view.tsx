'use client';

import { useState } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { CodCollectionLayer, type CodCollectionPoint } from '@/components/map/cod-collection-layer';
import { MapPin } from 'lucide-react';

interface Props {
  points: CodCollectionPoint[];
  driverFilter?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  collected: 'Collected',
  verified: 'Verified',
  reconciled: 'Reconciled',
  failed: 'Failed',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-500',
  collected: 'bg-green-500',
  verified: 'bg-amber-500',
  reconciled: 'bg-neutral-500',
  failed: 'bg-red-500',
};

export function CodMapView({ points, driverFilter }: Props) {
  const [selected, setSelected] = useState<CodCollectionPoint | null>(null);

  const visiblePoints = driverFilter
    ? points.filter((p) => p.driverName === driverFilter)
    : points;

  if (visiblePoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-wl-bg-surface rounded-lg border border-wl-border-default min-h-[400px]">
        <MapPin className="w-10 h-10 text-wl-text-tertiary" />
        <p className="text-wl-text-secondary text-sm">No delivery locations available</p>
        <p className="text-wl-text-tertiary text-xs max-w-xs text-center">
          Delivery coordinates will appear here once orders have location data.
        </p>
      </div>
    );
  }

  const statusCounts = visiblePoints.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  const firstPoint = visiblePoints[0];
  const defaultCenter: [number, number] = [firstPoint.deliveryLng, firstPoint.deliveryLat];

  return (
    <div className="relative w-full h-full min-h-[520px] rounded-lg overflow-hidden border border-wl-border-default">
      <WLMap center={defaultCenter} zoom={10} className="w-full h-full">
        <CodCollectionLayer
          points={visiblePoints}
          onPointClick={setSelected}
          autoFit
        />
      </WLMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-wl-bg-overlay/90 backdrop-blur rounded-lg p-3 border border-wl-border-default pointer-events-none">
        <p className="text-xs font-semibold text-wl-text-secondary mb-2 uppercase tracking-wide">Status</p>
        <div className="space-y-1.5">
          {Object.entries(STATUS_LABELS).map(([status, label]) => {
            const count = statusCounts[status] ?? 0;
            if (count === 0) return null;
            return (
              <div key={status} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_COLORS[status]}`} />
                <span className="text-xs text-wl-text-primary">{label}</span>
                <span className="text-xs text-wl-text-tertiary ml-auto pl-3">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats overlay */}
      <div className="absolute top-4 right-4 bg-wl-bg-overlay/90 backdrop-blur rounded-lg p-3 border border-wl-border-default pointer-events-none">
        <p className="text-xs text-wl-text-secondary">{visiblePoints.length} deliveries</p>
      </div>

      {/* Click popup */}
      {selected && (
        <div className="absolute top-4 left-4 bg-wl-bg-overlay/95 backdrop-blur rounded-lg p-4 border border-wl-border-default max-w-[220px] shadow-lg z-10">
          <button
            onClick={() => setSelected(null)}
            className="absolute top-2 right-2 text-wl-text-tertiary hover:text-wl-text-primary text-xs"
          >
            ✕
          </button>
          {selected.orderNumber && (
            <p className="text-xs text-wl-text-tertiary mb-1">#{selected.orderNumber}</p>
          )}
          <p className="text-base font-bold text-wl-text-primary">${selected.amount}</p>
          {selected.driverName && (
            <p className="text-xs text-wl-text-secondary mt-1">{selected.driverName}</p>
          )}
          <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium text-white ${STATUS_COLORS[selected.status]}`}>
            {STATUS_LABELS[selected.status]}
          </span>
        </div>
      )}
    </div>
  );
}
