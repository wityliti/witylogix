'use client';

import { use, useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { WLMap } from '@/components/map/wl-map';
import { ZoneLayer } from '@/components/map/zone-layer';
import { ZoneInspector } from '@/components/zones/zone-inspector';
import { LegacyNotice } from '@/components/zones/legacy-notice';
import type { FeatureCollection } from 'geojson';

export default function ZoneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (process.env.NEXT_PUBLIC_FEATURE_ZONES_MAP !== '1') return <LegacyNotice />;
  const { id } = use(params);
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? '';
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [zone, setZone] = useState<{
    id: string;
    name: string;
    baseRate: number;
    perKmRate: number;
    minOrder: number;
    freeAbove: number | null;
    isActive: boolean;
    priority: number;
  } | null>(null);

  useEffect(() => {
    ;(async () => {
      const [zRes, gRes] = await Promise.all([
        fetch(`/api/v4/zones/${id}`).then((r) => r.json()),
        fetch('/api/v4/zones?format=geojson').then((r) => r.json()),
      ]);
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
    })();
  }, [id]);

  if (!zone || !geojson) {
    return (
      <div className="p-8" style={{ color: 'var(--wl-neutral-400)' }}>
        Loading…
      </div>
    );
  }

  return (
    <>
      <Header title={zone.name} subtitle="Zone detail" />
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
              await fetch(`/api/v4/zones/${id}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(patch),
              });
            }}
            onDelete={async () => {
              await fetch(`/api/v4/zones/${id}`, { method: 'DELETE' });
              location.assign('/zones');
            }}
            onEditGeometry={() => {
              location.assign(`/zones?edit=${id}`);
            }}
          />
        </div>
        <WLMap maptilerKey={maptilerKey} center={[77.12, 28.65]} zoom={12}>
          <ZoneLayer zones={geojson} selectedId={id} onSelect={() => {}} />
        </WLMap>
      </div>
    </>
  );
}
