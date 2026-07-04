"use client";

import { useEffect, useRef } from "react";
import type { GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import { useWLMap } from "./wl-map-context";
import { mapTokens } from "./resolve-token";

export type DriverStatus = "available" | "busy" | "break" | "offline";

export interface DriverMarker {
  id: string;
  name: string;
  status: DriverStatus;
  lat: number;
  lng: number;
  heading?: number | null;
  activeDeliveries?: number;
  vehicleType?: string;
}

export interface DriverLayerProps {
  drivers: DriverMarker[];
  selectedDriverId?: string | null;
  onDriverClick?: (driverId: string) => void;
}

const STATUS_COLORS: Record<DriverStatus, string> = {
  available: "#10b981",
  busy: "#f59e0b",
  break: "#a78bfa",
  offline: "#6b7280",
};

const CIRCLE_LAYER = "dispatch-drivers-circle";
const LABEL_LAYER = "dispatch-drivers-label";
const PULSE_LAYER = "dispatch-drivers-pulse";
const SOURCE_ID = "dispatch-drivers";

function buildFeatures(
  drivers: DriverMarker[],
  selectedDriverId?: string | null,
): Feature<Point>[] {
  return drivers.map((d) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [d.lng, d.lat] },
    properties: {
      id: d.id,
      name: d.name,
      status: d.status,
      heading: d.heading ?? 0,
      activeDeliveries: d.activeDeliveries ?? 0,
      vehicleType: d.vehicleType ?? "",
      isSelected: d.id === selectedDriverId ? 1 : 0,
      color: STATUS_COLORS[d.status] ?? STATUS_COLORS.offline,
      initial: (d.name ?? "?").charAt(0).toUpperCase(),
    },
  }));
}

export function DriverLayer({
  drivers,
  selectedDriverId,
  onDriverClick,
}: DriverLayerProps) {
  const map = useWLMap();
  const clickHandlerRef = useRef<((e: MapLayerMouseEvent) => void) | null>(
    null,
  );

  useEffect(() => {
    const setup = () => {
      const t = mapTokens();
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: buildFeatures(drivers, selectedDriverId),
        },
      });

      // Pulse ring for available drivers
      map.addLayer({
        id: PULSE_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "status"], "available"],
        paint: {
          "circle-radius": 16,
          "circle-color": STATUS_COLORS.available,
          "circle-opacity": 0.12,
          "circle-stroke-color": STATUS_COLORS.available,
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.35,
        },
      });

      // Main driver circle
      map.addLayer({
        id: CIRCLE_LAYER,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": ["case", ["==", ["get", "isSelected"], 1], 12, 9],
          "circle-color": ["get", "color"],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "isSelected"], 1],
            "#ffffff",
            t.labelHalo,
          ],
          "circle-stroke-width": [
            "case",
            ["==", ["get", "isSelected"], 1],
            3,
            2,
          ],
          "circle-opacity": [
            "case",
            ["==", ["get", "status"], "offline"],
            0.45,
            1,
          ],
        },
      });

      // Driver initial label
      map.addLayer({
        id: LABEL_LAYER,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "text-field": ["get", "initial"],
          "text-size": 10,
          "text-font": [
            "DM Sans Bold",
            "Open Sans Bold",
            "Arial Unicode MS Regular",
          ],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.4)",
          "text-halo-width": 0.5,
        },
      });

      const clickHandler = (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const driverId = feature.properties?.id as string | undefined;
        if (driverId && onDriverClick) {
          onDriverClick(driverId);
        }
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
      if (map.getLayer(PULSE_LAYER)) map.removeLayer(PULSE_LAYER);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
    // Mount-only; data updates handled in the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Live data updates without remounting
  useEffect(() => {
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: buildFeatures(drivers, selectedDriverId),
    });
  }, [map, drivers, selectedDriverId]);

  return null;
}
