"use client";
import { useEffect } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import { useWLMap } from "./wl-map-context";

export interface HeatmapPoint {
  lng: number;
  lat: number;
  count: number;
}

export interface HeatmapLayerProps {
  points: HeatmapPoint[];
}

export function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useWLMap();

  useEffect(() => {
    const setup = () => {
      if (map.getSource("heatmap")) return;
      map.addSource("heatmap", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: points.map((p) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [p.lng, p.lat] },
            properties: { count: p.count },
          })),
        },
      });
      map.addLayer({
        id: "heatmap-layer",
        type: "heatmap",
        source: "heatmap",
        paint: {
          "heatmap-weight": ["get", "count"],
          "heatmap-intensity": 1,
          "heatmap-radius": 24,
          "heatmap-opacity": 0.8,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(96,165,250,0)",
            0.2,
            "rgba(96,165,250,0.4)",
            0.5,
            "rgba(245,158,11,0.6)",
            1,
            "rgba(239,68,68,0.9)",
          ],
        },
      });
    };
    if (map.isStyleLoaded()) setup();
    else map.on("load", setup);
    return () => {
      if (map.getLayer("heatmap-layer")) map.removeLayer("heatmap-layer");
      if (map.getSource("heatmap")) map.removeSource("heatmap");
    };
    // Mount-only: data updates handled in the separate effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const src = map.getSource("heatmap") as GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: "FeatureCollection",
        features: points.map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
          properties: { count: p.count },
        })),
      });
    }
  }, [map, points]);

  return null;
}
