'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { WLMap } from '@/components/map/wl-map';
import { ZoneLayer } from '@/components/map/zone-layer';
import { ZoneInspector } from '@/components/zones/zone-inspector';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import type { FeatureCollection } from 'geojson';

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

export default function ZoneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [zone, setZone] = useState<ZoneData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/v4/zones/${id}`).then((r) => {
        if (!r.ok) throw new Error(`Zone fetch failed: HTTP ${r.status}`);
        return r.json();
      }),
      fetch('/api/v4/zones?format=geojson').then((r) => {
        if (!r.ok) throw new Error(`Zones GeoJSON fetch failed: HTTP ${r.status}`);
        return r.json();
      }),
    ])
      .then(([zRes, gRes]) => {
        setZone({
          id,
          name: zRes.data.name,
          baseRate: Number(zRes.data.baseRate),
          perKmRate: Number(zRes.data.perKmRate),
          minOrder: Number(zRes.data.minOrder),
          freeAbove: zRes.data.freeAbove == null ? null : Number(zRes.data.freeAbove),
          isActive: Boolean(zRes.data.isActive),
          priority: Number(zRes.data.priority ?? 0),
        });
        setGeojson({
          type: 'FeatureCollection',
          features: (gRes as FeatureCollection).features.filter(
            (f) => f.properties?.id === id,
          ),
        });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState title="Failed to load zone" message={error} onRetry={() => router.refresh()} />;
  if (!zone || !geojson) return null;

  return (
    <>
      <Header
        title={zone.name}
        subtitle={zone.isActive ? 'Active zone' : 'Inactive zone'}
        actions={
          <span
            className="text-xs px-2 py-1 rounded-full font-medium"
            style={{
              background: zone.isActive ? 'var(--wl-success-bg)' : 'var(--wl-neutral-800)',
              color: zone.isActive ? 'var(--wl-success-500)' : 'var(--wl-neutral-400)',
            }}
          >
            {zone.isActive ? 'Active' : 'Inactive'}
          </span>
        }
      />
      <div
        className="grid h-[calc(100vh-64px)]"
        style={{
          gridTemplateColumns: '320px 1fr',
          background: 'var(--wl-bg-root)',
        }}
      >
        <div
          className="border-r p-4 overflow-auto"
          style={{ borderColor: 'var(--wl-neutral-800)' }}
        >
          <ZoneInspector
            zone={zone}
            mode="configure"
            onSave={async (patch) => {
              const res = await fetch(`/api/v4/zones/${id}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(patch),
              });
              if (!res.ok) throw new Error(`Save failed: HTTP ${res.status}`);
            }}
            onDelete={async () => {
              const res = await fetch(`/api/v4/zones/${id}`, { method: 'DELETE' });
              if (!res.ok) throw new Error(`Delete failed: HTTP ${res.status}`);
              router.push('/zones');
            }}
            onEditGeometry={() => {
              router.push(`/zones?edit=${id}`);
            }}
          />
        </div>
        <WLMap center={[77.12, 28.65]} zoom={12}>
          <ZoneLayer zones={geojson} selectedId={id} onSelect={() => {}} />
        </WLMap>
      </div>
    </>
  );
}
