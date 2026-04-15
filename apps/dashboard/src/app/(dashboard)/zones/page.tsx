'use client';

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useApiList } from "@/hooks/use-api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   ZONES PAGE — Delivery zone management, production-ready
   Data: /api/v4/zones  (real Prisma / PostGIS backend)
   ═══════════════════════════════════════════════════════════ */

interface ApiZone {
  id: string;
  name: string;
  priority: number;
  baseRate: string | number;
  perKmRate: string | number;
  minOrder: string | number;
  freeAbove: string | number | null;
  isActive: boolean;
}

interface Zone {
  id: string;
  name: string;
  priority: number;
  baseRate: string | number;
  perKmRate: string | number;
  minOrder: string | number;
  freeAbove?: string | number | null;
  isActive: boolean;
  boundary?: { latitude: number; longitude: number }[] | null;
  timeSlots: TimeSlot[];
  _count?: { timeSlots: number };
}

const ZONE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f43f5e"];

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const normalizeZone = (raw: ApiZone, idx: number): Zone => ({
  id: raw.id,
  name: raw.name,
  color: ZONE_COLORS[idx % ZONE_COLORS.length],
  isActive: Boolean(raw.isActive),
  baseRate: toNumber(raw.baseRate),
  perKmRate: toNumber(raw.perKmRate),
  minOrder: toNumber(raw.minOrder),
  freeAbove: raw.freeAbove != null ? toNumber(raw.freeAbove) : undefined,
  ordersToday: 0,
  drivers: 0,
});

function ZoneCardSkeleton() {
  return (
    <div className="relative overflow-hidden bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 animate-pulse">
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#1e1e2e]" />
      <div className="flex justify-between mb-4">
        <div className="h-5 w-36 bg-[#1e1e2e] rounded" />
        <div className="h-5 w-16 bg-[#1e1e2e] rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3 p-3 bg-[#1a1a2e] rounded-md mb-4">
        {[...Array(4)].map((_, j) => (
          <div key={j}>
            <div className="h-3 w-16 bg-[#1e1e2e] rounded mb-1" />
            <div className="h-4 w-20 bg-[#1e1e2e] rounded" />
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <div className="h-4 w-28 bg-[#1e1e2e] rounded" />
        <div className="h-6 w-12 bg-[#1e1e2e] rounded" />
      </div>
    </div>
  );
}

function EmptyZones() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <MapPin className="w-12 h-12 text-gray-600 mb-4" />
      <h3 className="text-lg font-semibold text-gray-300 mb-2">No delivery zones yet</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        Create your first delivery zone to define service areas, set pricing rules, and manage time slots.
      </p>
      <Button variant="primary">Create Zone</Button>
    </div>
  );
}

export default function ZonesPage() {
  const router = useRouter();
  const { items: rawZones, loading, error, refetch } = useApiList<ApiZone>("/api/v4/zones");

  const zones = useMemo<Zone[]>(
    () => (rawZones ?? []).map((z, i) => normalizeZone(z, i)),
    [rawZones],
  );

  const activeCount = zones.filter((z) => z.isActive).length;

  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={`${zones.length} zones · ${activeCount} active`}
        actions={
          <Button variant="primary" size="md" onClick={() => router.push("/zones/create")}>
            + Create Zone
          </Button>
        }
      />
      <div
        className="relative h-[calc(100vh-64px)] w-full"
        style={{ background: 'var(--wl-bg-root)' }}
      >
        <WLMap maptilerKey={maptilerKey} center={DEFAULT_CENTER} zoom={11}>
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
                await fetch(`/api/v4/zones/${selectedZone.id}`, {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ shape }),
                });
                setDrawing(false);
                await refetchZones();
              }}
            />
          )}
        </WLMap>

      <div className="p-6 bg-[#0a0a0f] min-h-screen">
        {loading ? (
          <TableSkeleton rows={3} />
        ) : error ? (
          <ErrorState title="Failed to load zones" message={error.message} onRetry={refetch} />
        ) : zones.length === 0 ? (
          <Card className="p-8 text-center text-zinc-400">
            No delivery zones yet.{" "}
            <button
              onClick={() => router.push("/zones/create")}
              className="text-amber-400 hover:underline"
            >
              Create your first zone
            </button>
            .
          </Card>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4">
            {zones.map((zone) => (
              <Card
                key={zone.id}
                className={cn(
                  "relative overflow-hidden bg-[#12121a] border border-[#1e1e2e] hover:border-blue-500 transition-colors",
                  zone.isActive ? "opacity-100" : "opacity-60",
                )}
              >
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: zone.color }} />

                <div className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: zone.color }}
                      />
                      <span className="text-base font-bold text-white">{zone.name}</span>
                    </div>
                    <Badge variant={zone.isActive ? "success" : "default"} dot>
                      {zone.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {/* Pricing Grid */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-[#1a1a2e] rounded-md mb-4">
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">Base Rate</div>
                      <div className="text-sm font-bold font-mono text-white">
                        {formatCurrency(zone.baseRate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">Per KM</div>
                      <div className="text-sm font-bold font-mono text-white">
                        {formatCurrency(zone.perKmRate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">Min Order</div>
                      <div className="text-sm font-bold font-mono text-white">
                        {formatCurrency(zone.minOrder)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 mb-0.5">Free Above</div>
                      <div
                        className={`text-sm font-bold font-mono ${zone.freeAbove ? "text-emerald-400" : "text-gray-400"}`}
                      >
                        {zone.freeAbove ? formatCurrency(zone.freeAbove) : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Activity */}
                  <div className="flex justify-between items-center">
                    <div className="flex gap-4">
                      <span className="text-xs text-gray-400">
                        <strong className="text-gray-300 font-mono">{zone.ordersToday}</strong> orders today
                      </span>
                      <span className="text-xs text-gray-400">
                        <strong className="text-gray-300 font-mono">{zone.drivers}</strong> drivers
                      </span>
                    </div>
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
