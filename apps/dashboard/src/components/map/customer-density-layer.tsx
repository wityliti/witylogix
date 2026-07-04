"use client";

import { useEffect, useRef } from "react";
import type { GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";
import type { Feature, Point } from "geojson";
import { useWLMap } from "./wl-map-context";

export interface CustomerLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
  totalOrders: number;
  totalSpent: number;
  tier: "standard" | "premium" | "enterprise";
}

export interface CustomerDensityLayerProps {
  customers: CustomerLocation[];
  selectedId?: string | null;
  onCustomerClick?: (id: string) => void;
}

const TIER_COLORS: Record<string, string> = {
  enterprise: "#f59e0b",
  premium: "#60a5fa",
  standard: "#6b7280",
};

const SOURCE_ID = "customer-density";
const CIRCLE_LAYER = "customer-density-circles";
const LABEL_LAYER = "customer-density-labels";

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function buildFeatures(
  customers: CustomerLocation[],
  selectedId?: string | null,
): Feature<Point>[] {
  return customers.map((c) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
    properties: {
      id: c.id,
      name: c.name,
      city: c.city,
      country: c.country,
      totalOrders: c.totalOrders,
      totalSpent: c.totalSpent,
      tier: c.tier,
      color: TIER_COLORS[c.tier] ?? TIER_COLORS.standard,
      isSelected: c.id === selectedId ? 1 : 0,
    },
  }));
}

export function CustomerDensityLayer({
  customers,
  selectedId,
  onCustomerClick,
}: CustomerDensityLayerProps) {
  const map = useWLMap();
  const clickHandlerRef = useRef<((e: MapLayerMouseEvent) => void) | null>(
    null,
  );

  useEffect(() => {
    const setup = () => {
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: buildFeatures(customers, selectedId),
        },
      });

      map.addLayer({
        id: CIRCLE_LAYER,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "isSelected"], 1],
            12,
            ["==", ["get", "tier"], "enterprise"],
            9,
            ["==", ["get", "tier"], "premium"],
            7,
            6,
          ],
          "circle-color": ["get", "color"],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "isSelected"], 1],
            "#ffffff",
            "rgba(0,0,0,0.6)",
          ],
          "circle-stroke-width": [
            "case",
            ["==", ["get", "isSelected"], 1],
            2.5,
            1,
          ],
          "circle-opacity": ["case", ["==", ["get", "isSelected"], 1], 1, 0.82],
        },
      });

      map.addLayer({
        id: LABEL_LAYER,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["==", ["get", "tier"], "enterprise"],
        layout: {
          "text-field": ["slice", ["get", "name"], 0, 1],
          "text-size": 9,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Regular"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.5)",
          "text-halo-width": 0.5,
        },
      });

      const clickHandler = (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const id = feature.properties?.id as string | undefined;
        if (id && onCustomerClick) onCustomerClick(id);
      };

      clickHandlerRef.current = clickHandler;
      map.on("click", CIRCLE_LAYER, clickHandler);
      map.on("mouseenter", CIRCLE_LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", CIRCLE_LAYER, () => {
        map.getCanvas().style.cursor = "";
      });
    };

    if (map.isStyleLoaded()) setup();
    else map.on("load", setup);

    return () => {
      if (clickHandlerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.off("click", CIRCLE_LAYER, clickHandlerRef.current as any);
      }
      if (map.getLayer(LABEL_LAYER)) map.removeLayer(LABEL_LAYER);
      if (map.getLayer(CIRCLE_LAYER)) map.removeLayer(CIRCLE_LAYER);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
    // Mount-only; data updates handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: buildFeatures(customers, selectedId),
    });
  }, [map, customers, selectedId]);

  return null;
}

// Re-export fmt for use in the map view component
export { fmt as fmtCurrency };
