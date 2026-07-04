"use client";

import { useEffect, useRef } from "react";
import type { FeatureCollection } from "geojson";
import { useWLMap } from "./wl-map-context";

export interface RevenueZoneEntry {
  zoneId: string;
  zoneName: string;
  orderCount: number;
  revenue: number;
  avgOrderValue: number;
}

export interface RevenueZoneLayerProps {
  zones: FeatureCollection;
  revenueData: RevenueZoneEntry[];
  onSelect?: (zoneId: string | null) => void;
}

function revenueColor(normalised: number): string {
  if (normalised > 0.8) return "#10b981"; // emerald — highest revenue
  if (normalised > 0.6) return "#22c55e"; // green
  if (normalised > 0.4) return "#eab308"; // amber
  if (normalised > 0.2) return "#f97316"; // orange
  return "#6b7280"; // grey — no / very low revenue
}

export function RevenueZoneLayer({
  zones,
  revenueData,
  onSelect,
}: RevenueZoneLayerProps) {
  const map = useWLMap();
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const revenueById = new Map(revenueData.map((d) => [d.zoneId, d]));
  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue), 1);

  const enriched: FeatureCollection = {
    ...zones,
    features: zones.features.map((f) => {
      const id = String(f.properties?.id ?? "");
      const d = revenueById.get(id);
      const norm = d ? d.revenue / maxRevenue : 0;
      return {
        ...f,
        properties: {
          ...f.properties,
          revenueNorm: norm,
          revenueColor: revenueColor(norm),
          revenue: d?.revenue ?? 0,
          orderCount: d?.orderCount ?? 0,
          avgOrderValue: d?.avgOrderValue ?? 0,
          hasOrders: !!d,
        },
      };
    }),
  };

  useEffect(() => {
    const setup = () => {
      if (map.getSource("revenue-zones")) return;

      map.addSource("revenue-zones", { type: "geojson", data: enriched });

      map.addLayer({
        id: "revenue-zones-fill",
        type: "fill",
        source: "revenue-zones",
        paint: {
          "fill-color": ["get", "revenueColor"],
          "fill-opacity": ["case", ["get", "hasOrders"], 0.45, 0.1],
        },
      });

      map.addLayer({
        id: "revenue-zones-line",
        type: "line",
        source: "revenue-zones",
        paint: {
          "line-color": ["get", "revenueColor"],
          "line-width": ["case", ["get", "hasOrders"], 1.5, 0.5],
          "line-opacity": ["case", ["get", "hasOrders"], 0.8, 0.3],
        },
      });

      map.on("click", "revenue-zones-fill", (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const id = String(feat.properties?.id ?? "");
        const revenue = feat.properties?.revenue ?? 0;
        const orderCount = feat.properties?.orderCount ?? 0;
        const name = feat.properties?.name ?? "Zone";

        const popup = new (window as any).maplibregl.Popup({
          closeButton: true,
        })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:sans-serif;font-size:13px;min-width:160px">
              <div style="font-weight:600;margin-bottom:6px">${name}</div>
              <div style="color:#888;margin-bottom:2px">${orderCount} orders</div>
              <div style="font-weight:700;font-size:15px;color:#10b981">
                $${revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>`,
          )
          .addTo(map);

        onSelectRef.current?.(id);
      });

      map.on("mouseenter", "revenue-zones-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "revenue-zones-fill", () => {
        map.getCanvas().style.cursor = "";
        onSelectRef.current?.(null);
      });
    };

    if (map.loaded()) {
      setup();
    } else {
      map.once("load", setup);
    }

    return () => {
      if (map.getLayer("revenue-zones-fill"))
        map.removeLayer("revenue-zones-fill");
      if (map.getLayer("revenue-zones-line"))
        map.removeLayer("revenue-zones-line");
      if (map.getSource("revenue-zones")) map.removeSource("revenue-zones");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(enriched)]);

  return null;
}
