"use client";
/**
 * CityVolumeLayer — renders delivery zones / cities as scaled circles coloured by trend.
 *
 * Circle size = proportional to order volume (orders / max).
 * Circle colour:
 *   - trend > 0  → emerald (growing zone)
 *   - trend < 0  → red     (declining zone)
 *   - trend == 0 → blue    (stable)
 *
 * Uses MapLibre GL JS via useWLMap().
 */

import { useEffect } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import type { Feature, Point, FeatureCollection } from "geojson";
import { useWLMap } from "./wl-map-context";

export interface CityVolume {
  name: string;
  lat: number;
  lng: number;
  orders: number;
  pct: number;
  trend: number;
}

interface CityVolumeLayerProps {
  cities: CityVolume[];
  onCityClick?: (name: string) => void;
}

const SOURCE_ID = "city-volume";
const CIRCLE_ID = "city-volume-circle";
const HALO_ID = "city-volume-halo";

function trendColor(trend: number): string {
  if (trend > 5) return "#10b981"; // emerald — strong growth
  if (trend > 0) return "#34d399"; // light emerald — growth
  if (trend < -5) return "#ef4444"; // red — strong decline
  if (trend < 0) return "#f87171"; // light red — decline
  return "#818cf8"; // indigo — stable
}

function buildFeatures(
  cities: CityVolume[],
  maxOrders: number,
): Feature<Point>[] {
  return cities.map((c) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
    properties: {
      name: c.name,
      orders: c.orders,
      pct: c.pct,
      trend: c.trend,
      color: trendColor(c.trend),
      // Radius in pixels: 10–40 based on volume share
      radius: 10 + Math.round(30 * (maxOrders > 0 ? c.orders / maxOrders : 0)),
    },
  }));
}

export function CityVolumeLayer({ cities, onCityClick }: CityVolumeLayerProps) {
  const map = useWLMap();

  const maxOrders = Math.max(...cities.map((c) => c.orders), 1);
  const fc: FeatureCollection<Point> = {
    type: "FeatureCollection",
    features: buildFeatures(cities, maxOrders),
  };

  useEffect(() => {
    const setup = () => {
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, { type: "geojson", data: fc });

      // Outer halo (soft glow)
      map.addLayer({
        id: HALO_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["*", ["get", "radius"], 1.8],
          "circle-opacity": 0.12,
          "circle-stroke-width": 0,
        },
      });

      // Main volume circle
      map.addLayer({
        id: CIRCLE_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["get", "radius"],
          "circle-opacity": 0.75,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": 0.9,
        },
      });

      if (onCityClick) {
        map.on("click", CIRCLE_ID, (e) => {
          const name = e.features?.[0]?.properties?.name as string | undefined;
          if (name) onCityClick(name);
        });
        map.on("mouseenter", CIRCLE_ID, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", CIRCLE_ID, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    };

    if (map.isStyleLoaded()) setup();
    else map.on("load", setup);

    return () => {
      [CIRCLE_ID, HALO_ID].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update data when cities change
  useEffect(() => {
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (src) src.setData(fc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(cities)]);

  return null;
}
