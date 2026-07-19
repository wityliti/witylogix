'use client';

import { use, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { WLMap } from '@/components/map/wl-map';
import { useWLMap } from '@/components/map/wl-map-context';
import { fitBounds } from '@/components/map/use-fit-bounds';
import { ZoneLayer } from '@/components/map/zone-layer';
import { ZoneInspector } from '@/components/zones/zone-inspector';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api';
import type { FeatureCollection } from 'geojson';

function AutoFit({ zones }: { zones: FeatureCollection }) {
  const map = useWLMap();
  useEffect(() => {
    if (!zones.features.length) return;
    const coords: Array<{ lat: number; lng: number }> = [];
    for (const f of zones.features) {
      const g = f.geometry;
      if (g.type === 'Polygon') {
        for (const [lng, lat] of g.coordinates[0]) coords.push({ lat, lng });
      } else if (g.type === 'MultiPolygon') {
        for (const poly of g.coordinates)
          for (const [lng, lat] of poly[0]) coords.push({ lat, lng });
      }
    }
    if (!coords.length) return;
    const ready = () => fitBounds(map, coords, 60);
    if (map.isStyleLoaded()) ready();
    else map.once('load', ready);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, zones]);
  return null;
}

interface ZoneData {
  id: string;
  name: string;
  baseRate: number;
  perKmRate: number;
  minOrder: number;
  freeAbove: number | null;
  isActive: boolean;
  priority: number;
}

interface ZoneResponse {
  data: {
    id: string;
    name: string;
    baseRate: string | number;
    perKmRate: string | number;
    minOrder: string | number;
    freeAbove: string | number | null;
    isActive: boolean;
    priority: number | null;
  };
}

export default function ZoneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const {
    data: zoneRes,
    loading: zoneLoading,
    error: zoneError,
    refetch: refetchZone,
  } = useApiQuery<ZoneResponse>(`/api/v4/zones/${id}`);

  const {
    data: geoRes,
    loading: geoLoading,
    error: geoError,
  } = useApiQuery<FeatureCollection>('/api/v4/zones?format=geojson');

  const loading = zoneLoading || geoLoading;
  const error = zoneError || geoError;

  const zone = useMemo<ZoneData | null>(() => {
    if (!zoneRes?.data) return null;
    const d = zoneRes.data;
    return {
      id,
      name: d.name,
      baseRate: Number(d.baseRate),
      perKmRate: Number(d.perKmRate),
      minOrder: Number(d.minOrder),
      freeAbove: d.freeAbove == null ? null : Number(d.freeAbove),
      isActive: Boolean(d.isActive),
      priority: Number(d.priority ?? 0),
    };
  }, [id, zoneRes]);

  const geojson = useMemo<FeatureCollection | null>(() => {
    if (!geoRes) return null;
    return {
      type: 'FeatureCollection',
      features: geoRes.features.filter((f) => f.properties?.id === id),
    };
  }, [id, geoRes]);

  if (loading) return <LoadingSkeleton />;
  if (error)
    return (
      <ErrorState
        title="Failed to load zone"
        message={error.message}
        onRetry={refetchZone}
      />
    );
  if (!zone || !geojson) return null;

  return (
    <>
      <Header
        title={zone.name}
        subtitle={zone.isActive ? 'Active zone' : 'Inactive zone'}
        actions={
          <Badge variant={zone.isActive ? 'success' : 'default'}>
            {zone.isActive ? 'Active' : 'Inactive'}
          </Badge>
        }
      />
      <div className="grid h-[calc(100vh-64px)] bg-wl-bg-root" style={{ gridTemplateColumns: '320px 1fr' }}>
        <div className="border-r border-wl-border-default p-4 overflow-auto">
          <ZoneInspector
            zone={zone}
            mode="configure"
            onSave={async (patch) => {
              await api.patch(`/api/v4/zones/${id}`, patch);
              refetchZone();
            }}
            onDelete={async () => {
              await api.delete(`/api/v4/zones/${id}`);
              router.push('/zones');
            }}
            onEditGeometry={() => {
              router.push(`/zones?edit=${id}`);
            }}
          />
        </div>
        <WLMap center={[77.12, 28.65]} zoom={12}>
          <ZoneLayer zones={geojson} selectedId={id} onSelect={() => {}} />
          <AutoFit zones={geojson} />
        </WLMap>
      </div>
    </>
  );
}
