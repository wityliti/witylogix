"use client";
import { useEffect } from "react";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource } from "maplibre-gl";
import { useWLMap } from "./wl-map-context";

export interface DemandZoneEntry {
  id: string;
  name: string;
  predictedVolume: number;
  actualVolume: number;
  trend: "up" | "down" | "stable";
}

export interface DemandZoneLayerProps {
  zones: FeatureCollection;
  demandData: DemandZoneEntry[];
  onSelect?: (zoneId: string | null) => void;
}

function intensityColor(normalised: number): string {
  if (normalised > 0.8) return "#ef4444"; // red — high demand
  if (normalised > 0.6) return "#f97316"; // orange
  if (normalised > 0.4) return "#eab308"; // amber
  if (normalised > 0.2) return "#22c55e"; // green
  return "#3b82f6"; // blue — low demand
}

export function DemandZoneLayer({
  zones,
  demandData,
  onSelect,
}: DemandZoneLayerProps) {
  const map = useWLMap();

  const demandById = new Map(demandData.map((d) => [d.id, d]));
  const maxVolume = Math.max(...demandData.map((d) => d.predictedVolume), 1);

  // Augment GeoJSON features with demand data
  const enriched: FeatureCollection = {
    ...zones,
    features: zones.features.map((f) => {
      const id = String(f.properties?.id ?? "");
      const d = demandById.get(id);
      const norm = d ? d.predictedVolume / maxVolume : 0;
      return {
        ...f,
        properties: {
          ...f.properties,
          demandNorm: norm,
          demandColor: intensityColor(norm),
          predictedVolume: d?.predictedVolume ?? 0,
          trend: d?.trend ?? "stable",
        },
      };
    }),
  };

  useEffect(() => {
    const setup = () => {
      if (map.getSource("demand-zones")) return;
      map.addSource("demand-zones", { type: "geojson", data: enriched });
      map.addLayer({
        id: "demand-zones-fill",
        type: "fill",
        source: "demand-zones",
        paint: {
          "fill-color": ["get", "demandColor"],
          "fill-opacity": 0.4,
        },
      });
      map.addLayer({
        id: "demand-zones-stroke",
        type: "line",
        source: "demand-zones",
        paint: {
          "line-color": ["get", "demandColor"],
          "line-width": 2,
          "line-opacity": 0.8,
        },
      });
      if (onSelect) {
        map.on("click", "demand-zones-fill", (e) => {
          const f = e.features?.[0];
          onSelect(f?.properties?.id ?? null);
        });
      }
    };
    if (map.isStyleLoaded()) setup();
    else map.on("load", setup);
    return () => {
      ["demand-zones-fill", "demand-zones-stroke"].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource("demand-zones")) map.removeSource("demand-zones");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const src = map.getSource("demand-zones") as GeoJSONSource | undefined;
    if (src) src.setData(enriched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(demandData)]);

  return null;
}
