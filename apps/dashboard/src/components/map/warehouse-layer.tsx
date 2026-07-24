"use client";

import { useEffect } from "react";
import { useWLMap } from "./wl-map-context";
import { useFitBounds } from "./use-fit-bounds";

export interface WarehousePin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  utilizationPercentage: number;
  totalQuantity: number;
  itemCount: number;
  city?: string | null;
}

export interface WarehouseLayerProps {
  warehouses: WarehousePin[];
}

const SOURCE = "wl-warehouses";
const CIRCLE_LAYER = "wl-warehouses-circles";
const LABEL_LAYER = "wl-warehouses-labels";

export function WarehouseLayer({ warehouses }: WarehouseLayerProps) {
  const map = useWLMap();

  useFitBounds(
    map,
    warehouses.map((w) => ({ lng: w.lng, lat: w.lat })),
  );

  useEffect(() => {
    const setup = () => {
      if (map.getSource(SOURCE)) {
        (map.getSource(SOURCE) as any).setData({
          type: "FeatureCollection",
          features: warehouses.map((w) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [w.lng, w.lat] },
            properties: {
              id: w.id,
              name: w.name,
              utilization: w.utilizationPercentage,
              qty: w.totalQuantity,
              items: w.itemCount,
              city: w.city ?? "",
            },
          })),
        });
        return;
      }

      map.addSource(SOURCE, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: warehouses.map((w) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [w.lng, w.lat] },
            properties: {
              id: w.id,
              name: w.name,
              utilization: w.utilizationPercentage,
              qty: w.totalQuantity,
              items: w.itemCount,
              city: w.city ?? "",
            },
          })),
        },
      });

      map.addLayer({
        id: CIRCLE_LAYER,
        type: "circle",
        source: SOURCE,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "qty"],
            0,
            10,
            500,
            20,
            5000,
            35,
            20000,
            50,
          ],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "utilization"],
            0,
            "var(--wl-info-500, #3b82f6)",
            50,
            "var(--wl-success-500, #22c55e)",
            85,
            "var(--wl-warning-500, #f59e0b)",
            100,
            "var(--wl-error-500, #ef4444)",
          ],
          "circle-opacity": 0.8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.3)",
        },
      });

      map.addLayer({
        id: LABEL_LAYER,
        type: "symbol",
        source: SOURCE,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 2.5],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#e2e8f0",
          "text-halo-color": "rgba(0,0,0,0.8)",
          "text-halo-width": 1.5,
        },
      });

      const popup = document.createElement("div");
      popup.className = "wl-map-popup";

      map.on("click", CIRCLE_LAYER, (e: any) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        const coords = (f.geometry as any).coordinates.slice() as [
          number,
          number,
        ];
        popup.innerHTML = `
          <div style="background:#1e1e2e;border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:12px;min-width:160px;color:#e2e8f0;font-family:sans-serif;font-size:12px;">
            <p style="font-weight:700;font-size:13px;margin:0 0 6px;">${p.name}</p>
            ${p.city ? `<p style="color:#94a3b8;margin:0 0 4px;">${p.city}</p>` : ""}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:8px;">
              <div><span style="color:#94a3b8;">Items</span><br/><b>${Number(p.items).toLocaleString()}</b></div>
              <div><span style="color:#94a3b8;">Qty</span><br/><b>${Number(p.qty).toLocaleString()}</b></div>
              <div style="grid-column:1/-1;"><span style="color:#94a3b8;">Utilization</span><br/><b>${p.utilization}%</b></div>
            </div>
          </div>`;
        (map as any)._popup?.remove();
        const { default: maplibregl } = require("maplibre-gl");
        const mp = new maplibregl.Popup({ closeButton: false, offset: 20 })
          .setLngLat(coords)
          .setDOMContent(popup)
          .addTo(map);
        (map as any)._popup = mp;
      });

      map.on("mouseenter", CIRCLE_LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", CIRCLE_LAYER, () => {
        map.getCanvas().style.cursor = "";
      });
    };

    if (map.isStyleLoaded()) {
      setup();
    } else {
      map.once("load", setup);
    }

    return () => {
      if (map.getLayer(LABEL_LAYER)) map.removeLayer(LABEL_LAYER);
      if (map.getLayer(CIRCLE_LAYER)) map.removeLayer(CIRCLE_LAYER);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    };
  }, [map, warehouses]);

  return null;
}
