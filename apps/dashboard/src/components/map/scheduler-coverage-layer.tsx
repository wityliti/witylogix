"use client";
import { useEffect } from "react";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource } from "maplibre-gl";
import { useWLMap } from "./wl-map-context";

export interface ZoneCoverageEntry {
  id: string;
  name: string;
  status: "understaffed" | "optimal" | "overstaffed";
  scheduledDrivers: number;
  requiredDrivers: number;
}

export interface SchedulerCoverageLayerProps {
  zones: FeatureCollection;
  coverageData: ZoneCoverageEntry[];
  onSelect?: (zoneId: string | null) => void;
}

const STATUS_COLORS: Record<string, string> = {
  understaffed: "#ef4444",
  optimal: "#10b981",
  overstaffed: "#3b82f6",
};

export function SchedulerCoverageLayer({
  zones,
  coverageData,
  onSelect,
}: SchedulerCoverageLayerProps) {
  const map = useWLMap();

  const coverageById = new Map(coverageData.map((d) => [d.id, d]));

  const enriched: FeatureCollection = {
    ...zones,
    features: zones.features.map((f) => {
      const id = String(f.properties?.id ?? "");
      const d = coverageById.get(id);
      return {
        ...f,
        properties: {
          ...f.properties,
          coverageStatus: d?.status ?? "optimal",
          coverageColor: STATUS_COLORS[d?.status ?? "optimal"] ?? "#10b981",
          scheduledDrivers: d?.scheduledDrivers ?? 0,
          requiredDrivers: d?.requiredDrivers ?? 0,
        },
      };
    }),
  };

  useEffect(() => {
    const setup = () => {
      if (map.getSource("scheduler-coverage")) return;
      map.addSource("scheduler-coverage", { type: "geojson", data: enriched });
      map.addLayer({
        id: "scheduler-coverage-fill",
        type: "fill",
        source: "scheduler-coverage",
        paint: {
          "fill-color": ["get", "coverageColor"],
          "fill-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "scheduler-coverage-stroke",
        type: "line",
        source: "scheduler-coverage",
        paint: {
          "line-color": ["get", "coverageColor"],
          "line-width": 2,
          "line-opacity": 0.8,
        },
      });
      if (onSelect) {
        map.on("click", "scheduler-coverage-fill", (e) => {
          const f = e.features?.[0];
          onSelect(f?.properties?.id ?? null);
        });
      }
    };
    if (map.isStyleLoaded()) setup();
    else map.on("load", setup);
    return () => {
      ["scheduler-coverage-fill", "scheduler-coverage-stroke"].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource("scheduler-coverage"))
        map.removeSource("scheduler-coverage");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const src = map.getSource("scheduler-coverage") as
      | GeoJSONSource
      | undefined;
    if (src) src.setData(enriched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(coverageData)]);

  return null;
}
