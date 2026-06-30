'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { WLMap } from '@/components/map/wl-map';
import { ZoneLayer } from '@/components/map/zone-layer';
import { HeatmapLayer } from '@/components/map/heatmap-layer';
import { PinLayer } from '@/components/map/pin-layer';
import { HubLayer } from '@/components/map/hub-layer';
import { DrawLayer } from '@/components/map/draw-layer';
import { ModeToggle, type ZoneMode } from '@/components/zones/mode-toggle';
import { OverlayControls, type OverlayState } from '@/components/zones/overlay-controls';
import { ZoneSearch } from '@/components/zones/zone-search';
import { KpiStrip } from '@/components/zones/kpi-strip';
import { ZoneInspector } from '@/components/zones/zone-inspector';
import { ErrorState } from '@/components/ui/error-state';
import { track } from '@/lib/track';
import { api } from '@/lib/api';
import { useZonesGeoJson } from '@/hooks/use-zones-geojson';
import { useZoneOverlays } from '@/hooks/use-zone-overlays';

const DEFAULT_OVERLAYS: OverlayState = {
  heatmap: true,
  sla: true,
  openOrders: true,
  hubs: true,
  window: '24h',
};
const DEFAULT_CENTER: [number, number] = [77.12, 28.65]; // per-org override to come later

export default function ZonesPage() {
  const router = useRouter();
  const { data: geojson, loading: zonesLoading, error: zonesError, refetch: refetchZones } = useZonesGeoJson();
  const [overlays, setOverlays] = useState<OverlayState>(DEFAULT_OVERLAYS);
  const { data: overlaysData, error: overlaysError } = useZoneOverlays(overlays.window);
  const [mode, setMode] = useState<ZoneMode>('monitor');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);

  const zones = useMemo(
    () =>
      geojson?.features.map((f) => ({
        id: String(f.properties?.id),
        name: String(f.properties?.name),
      })) ?? [],
    [geojson],
  );
  const overlay = overlaysData?.zones.find((z) => z.id === selectedId);
  const selectedZone = useMemo(() => {
    const f = geojson?.features.find((g) => g.properties?.id === selectedId);
    if (!f) return null;
    const p = f.properties as Record<string, unknown>;
    return {
      id: String(p.id),
      name: String(p.name),
      baseRate: Number(p.baseRate ?? 0),
      perKmRate: Number(p.perKmRate ?? 0),
      minOrder: 0,
      freeAbove: null as number | null,
      isActive: Boolean(p.isActive),
      priority: Number(p.priority ?? 0),
    };
  }, [geojson, selectedId]);

  const stats = {
    zones: overlaysData?.zones.length ?? 0,
    driversOnline: overlaysData?.zones.reduce((s, z) => s + z.drivers, 0) ?? 0,
    openOrders: overlaysData?.zones.reduce((s, z) => s + z.openOrders, 0) ?? 0,
    slipping: overlaysData?.zones.filter((z) => z.health === 'slipping').length ?? 0,
  };

  const fetchError = zonesError ?? overlaysError;

  useEffect(() => {
    track('zones.viewed', {
      mode,
      overlays: (Object.keys(overlays) as (keyof OverlayState)[]).filter(
        (k) => overlays[k] === true,
      ),
    });
    // snapshot initial values — fire once per mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={`${zones.length} zones · ${mode === 'monitor' ? 'Monitor' : 'Configure'}`}
      />
      <div
        className="relative h-[calc(100vh-64px)] w-full"
        style={{ background: 'var(--wl-bg-root)' }}
      >
        {/* Loading overlay — shown while zone geojson is fetching */}
        {zonesLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-wl-bg-root/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-wl-primary-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-wl-text-secondary text-sm">Loading zones…</span>
            </div>
          </div>
        )}
        {/* Error overlay — shown if zone data fails to load */}
        {fetchError && !zonesLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-wl-bg-root/90">
            <div className="max-w-sm w-full px-4">
              <ErrorState error={fetchError} onRetry={refetchZones} />
            </div>
          </div>
        )}
        <WLMap center={DEFAULT_CENTER} zoom={11}>
          {geojson && (
            <ZoneLayer zones={geojson} selectedId={selectedId} onSelect={setSelectedId} />
          )}
          {overlays.heatmap && overlaysData?.heatmap && (
            <HeatmapLayer points={overlaysData.heatmap} />
          )}
          {overlays.openOrders && <PinLayer pins={[]} />}
          {overlays.hubs && overlaysData?.hubs && <HubLayer hubs={overlaysData.hubs} />}
          {drawing && selectedZone && (
            <DrawLayer
              mode="polygon"
              value={null}
              onChange={async (shape) => {
                if (!shape || shape.type !== 'polygon') return;
                track('zones.geometry_edited', {
                  zoneId: selectedZone.id,
                  type: shape.type,
                });
                await api.patch(`/api/v4/zones/${selectedZone.id}`, { shape });
                setDrawing(false);
                await refetchZones();
              }}
            />
          )}
        </WLMap>

        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <ModeToggle value={mode} onChange={setMode} />
          <OverlayControls value={overlays} onChange={setOverlays} />
        </div>

        <div className="absolute top-4 right-4 flex gap-2 items-center">
          <ZoneSearch zones={zones} onSelect={setSelectedId} />
          <Button variant="primary" size="md" onClick={() => router.push('/zones/new')}>
            + New zone
          </Button>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <KpiStrip
            stats={stats}
            onClickSlipping={() => {
              const z = overlaysData?.zones.find((zone) => zone.health === 'slipping');
              if (z) setSelectedId(z.id);
            }}
          />
        </div>

        {selectedZone && (
          <div className="absolute top-0 right-0 h-full">
            <ZoneInspector
              zone={selectedZone}
              overlay={overlay}
              mode={mode}
              onSave={async (patch) => {
                await api.patch(`/api/v4/zones/${selectedZone.id}`, patch);
              }}
              onDelete={async () => {
                await api.delete(`/api/v4/zones/${selectedZone.id}`);
                setSelectedId(null);
                await refetchZones();
              }}
              onEditGeometry={() => setDrawing((d) => !d)}
            />
          </div>
        )}
      </div>
    </>
  );
}
