'use client';

import { useState } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { CustomerDensityLayer, type CustomerLocation } from '@/components/map/customer-density-layer';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import { useWLMap } from '@/components/map/wl-map-context';
import { cn } from '@/lib/utils';
import { Map as MapIcon } from 'lucide-react';

const TIER_DOT: Record<string, string> = {
  enterprise: '#f59e0b',
  premium:    '#60a5fa',
  standard:   '#6b7280',
};

interface MapLayersProps {
  customers: CustomerLocation[];
  selectedId: string | null;
  onCustomerClick: (id: string) => void;
}

function MapLayers({ customers, selectedId, onCustomerClick }: MapLayersProps) {
  const map = useWLMap();
  const coords = customers.map((c) => ({ lng: c.lng, lat: c.lat }));
  useFitBounds(map, coords, 60);

  return (
    <CustomerDensityLayer
      customers={customers}
      selectedId={selectedId}
      onCustomerClick={onCustomerClick}
    />
  );
}

interface CustomersMapViewProps {
  customers: CustomerLocation[];
}

export default function CustomersMapView({ customers }: CustomersMapViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCustomer = customers.find((c) => c.id === selectedId);
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  // Center: centroid of all customers, or world view
  const defaultCenter: [number, number] = [-74.006, 40.7128];

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-wl-border-default">
      {customers.length === 0 ? (
        <div className="w-full h-full bg-wl-bg-root flex flex-col items-center justify-center gap-3">
          <MapIcon className="w-10 h-10 text-wl-text-tertiary" />
          <div className="text-center">
            <p className="text-sm font-medium text-wl-neutral-300">No geo-located customers yet</p>
            <p className="text-xs text-wl-text-tertiary mt-1 max-w-xs">
              Sync customers with addresses that include latitude/longitude to see the map
            </p>
          </div>
        </div>
      ) : (
        <>
          <WLMap center={defaultCenter} zoom={3} className="w-full h-full">
            <MapLayers
              customers={customers}
              selectedId={selectedId}
              onCustomerClick={setSelectedId}
            />
          </WLMap>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-wl-bg-root/90 backdrop-blur-sm border border-wl-border-default rounded-lg p-3 z-10">
            <p className="text-[10px] font-semibold text-wl-text-tertiary uppercase mb-2 tracking-wide">Tier</p>
            <div className="space-y-1.5">
              {(['enterprise', 'premium', 'standard'] as const).map((tier) => {
                const count = customers.filter((c) => c.tier === tier).length;
                if (count === 0) return null;
                return (
                  <div key={tier} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_DOT[tier] }} />
                    <span className="text-xs text-wl-neutral-300 capitalize">{tier}</span>
                    <span className="text-xs font-mono text-wl-text-tertiary ml-auto pl-3">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Count badge */}
          <div className="absolute top-4 left-4 bg-wl-bg-root/90 backdrop-blur-sm border border-wl-border-default rounded-lg px-3 py-1.5 z-10">
            <span className="text-xs font-semibold text-wl-neutral-300">
              {customers.length} customer{customers.length !== 1 ? 's' : ''} on map
            </span>
          </div>

          {/* Selected customer card */}
          {selectedCustomer && (
            <div className="absolute top-4 right-4 bg-wl-bg-root/95 backdrop-blur-sm border border-wl-border-default rounded-lg p-4 z-10 min-w-52">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-semibold text-white">{selectedCustomer.name}</p>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-wl-text-tertiary hover:text-wl-neutral-300 transition-colors ml-2 leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              {selectedCustomer.city && (
                <p className="text-xs text-wl-text-secondary mb-2">
                  {[selectedCustomer.city, selectedCustomer.country].filter(Boolean).join(', ')}
                </p>
              )}
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: TIER_DOT[selectedCustomer.tier] }}
                  />
                  <span className={cn('font-medium capitalize')}
                    style={{ color: TIER_DOT[selectedCustomer.tier] }}>
                    {selectedCustomer.tier}
                  </span>
                </div>
                <div className="flex justify-between text-wl-text-secondary">
                  <span>Orders</span>
                  <span className="text-wl-text-primary font-semibold">{selectedCustomer.totalOrders}</span>
                </div>
                <div className="flex justify-between text-wl-text-secondary">
                  <span>Spent</span>
                  <span className="text-wl-text-primary font-semibold">{fmt.format(selectedCustomer.totalSpent)}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
