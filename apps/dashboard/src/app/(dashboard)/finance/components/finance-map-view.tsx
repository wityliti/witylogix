"use client";

import { useState, useMemo } from "react";
import type { FeatureCollection } from "geojson";
import { useApiQuery } from "@/hooks/use-api";
import { WLMap } from "@/components/map/wl-map";
import {
  RevenueZoneLayer,
  type RevenueZoneEntry,
} from "@/components/map/revenue-zone-layer";
import { useFitBounds } from "@/components/map/use-fit-bounds";
import { useWLMap } from "@/components/map/wl-map-context";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import { Map } from "lucide-react";

interface RevenueByZoneData {
  zones: RevenueZoneEntry[];
  total: {
    revenue: number;
    orderCount: number;
    zonesWithOrders: number;
  };
  dateFrom: string;
  days: number;
}

interface FitToZonesProps {
  zones: FeatureCollection;
}

function FitToZones({ zones }: FitToZonesProps) {
  const map = useWLMap();
  const coords = useMemo(() => {
    const pts: { lng: number; lat: number }[] = [];
    for (const f of zones.features) {
      if (!f.geometry) continue;
      const g = f.geometry as any;
      const flatCoords = (
        g.type === "Polygon"
          ? g.coordinates[0]
          : g.type === "MultiPolygon"
            ? g.coordinates.flat(2)
            : []
      ) as [number, number][];
      for (const [lng, lat] of flatCoords) {
        pts.push({ lng, lat });
      }
    }
    return pts;
  }, [zones]);

  useFitBounds(map, coords);
  return null;
}

interface FinanceMapViewProps {
  days?: number;
  className?: string;
}

export function FinanceMapView({ days = 30, className }: FinanceMapViewProps) {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const {
    data: zonesData,
    loading: zonesLoading,
    error: zonesError,
  } = useApiQuery<FeatureCollection>(`/api/v4/zones?format=geojson`);

  const {
    data: revenueData,
    loading: revenueLoading,
    error: revenueError,
  } = useApiQuery<{ data: RevenueByZoneData }>(
    `/api/v4/finance/revenue-by-zone?days=${days}`,
  );

  const loading = zonesLoading || revenueLoading;
  const error = zonesError || revenueError;

  if (loading) return <LoadingSkeleton className={className} />;
  if (error) return <ErrorState error={error} className={className} />;

  const zones = zonesData ?? { type: "FeatureCollection", features: [] };
  const revenue = revenueData?.data;
  const zoneEntries: RevenueZoneEntry[] = revenue?.zones ?? [];
  const total = revenue?.total ?? {
    revenue: 0,
    orderCount: 0,
    zonesWithOrders: 0,
  };

  if (zones.features.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-wl-border-default bg-wl-bg-surface",
          className,
        )}
      >
        <Map className="w-10 h-10 text-wl-text-tertiary" />
        <p className="text-sm text-wl-text-tertiary">
          No delivery zones configured
        </p>
      </div>
    );
  }

  const selectedZone = zoneEntries.find((z) => z.zoneId === selectedZoneId);

  return (
    <div className={cn("relative rounded-lg overflow-hidden", className)}>
      <WLMap center={[0, 20]} zoom={2} className="w-full h-full">
        <FitToZones zones={zones} />
        <RevenueZoneLayer
          zones={zones}
          revenueData={zoneEntries}
          onSelect={setSelectedZoneId}
        />
      </WLMap>

      {/* Revenue legend */}
      <div className="absolute bottom-4 left-4 bg-wl-bg-surface/90 backdrop-blur rounded-lg p-3 border border-wl-border-default text-xs space-y-1.5 min-w-[140px]">
        <p className="font-semibold text-wl-text-primary mb-2">
          Revenue by Zone
        </p>
        {[
          { color: "var(--wl-success-500)", label: "Highest" },
          { color: "var(--wl-chart-green)", label: "High" },
          { color: "var(--wl-warning-500)", label: "Medium" },
          { color: "var(--wl-chart-orange)", label: "Low" },
          { color: "var(--wl-neutral-500)", label: "No orders" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-wl-text-secondary">{label}</span>
          </div>
        ))}
      </div>

      {/* Stats overlay */}
      <div className="absolute top-4 right-4 bg-wl-bg-surface/90 backdrop-blur rounded-lg p-3 border border-wl-border-default text-xs space-y-1 min-w-[160px]">
        <p className="font-semibold text-wl-text-primary mb-2">
          Last {days} days
        </p>
        <div className="flex justify-between gap-4">
          <span className="text-wl-text-tertiary">Revenue</span>
          <span className="font-medium text-emerald-400">
            $
            {total.revenue.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-wl-text-tertiary">Orders</span>
          <span className="font-medium text-wl-text-primary">
            {total.orderCount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-wl-text-tertiary">Active zones</span>
          <span className="font-medium text-wl-text-primary">
            {total.zonesWithOrders}
          </span>
        </div>
        {selectedZone && (
          <div className="mt-2 pt-2 border-t border-wl-border-default">
            <p className="font-semibold text-wl-text-primary truncate">
              {selectedZone.zoneName}
            </p>
            <p className="text-emerald-400 font-medium">
              $
              {selectedZone.revenue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
