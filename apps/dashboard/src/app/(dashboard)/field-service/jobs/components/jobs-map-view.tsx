'use client';

import { useContext } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { WLMapContext } from '@/components/map/wl-map-context';
import { OrderLayer } from '@/components/map/order-layer';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import type { OrderPin } from '@/components/map/order-layer';

function FitBoundsController({ coords }: { coords: { lat: number; lng: number }[] }) {
  const map = useContext(WLMapContext);
  useFitBounds(map, coords, 80);
  return null;
}

interface JobsMapViewProps {
  jobs: OrderPin[];
  selectedJobId: string | null;
  onJobClick: (id: string) => void;
}

export default function JobsMapView({ jobs, selectedJobId, onJobClick }: JobsMapViewProps) {
  const coords = jobs.map((j) => ({ lat: j.lat, lng: j.lng }));

  return (
    <div className="absolute inset-0">
      <WLMap center={[40.7128, -74.006]} zoom={10} className="h-full w-full">
        <FitBoundsController coords={coords} />
        {jobs.length > 0 && (
          <OrderLayer
            orders={jobs}
            selectedOrderId={selectedJobId}
            onOrderClick={onJobClick}
          />
        )}
      </WLMap>
    </div>
  );
}
