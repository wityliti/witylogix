"use client";
/**
 * ShipmentMarkerLayer — renders shipment delivery locations as status-coloured
 * circles on a WLMap.  Click a marker to trigger onShipmentClick.
 *
 * Shipment statuses are mapped to four pin colours:
 *   pending/processing/ready_for_pickup → pinOpen   (blue)
 *   picked_up/in_transit               → pinAssigned (amber)
 *   out_for_delivery/arrived           → pinInTransit (green)
 *   delivered                          → delivered colour (emerald)
 *   failed/returned/cancelled          → pinDelayed  (red)
 */

import { useEffect } from "react";
import type {
  GeoJSONSource,
  MapMouseEvent,
  MapGeoJSONFeature,
} from "maplibre-gl";
import { useWLMap } from "./wl-map-context";
import { mapTokens } from "./resolve-token";

export type ShipmentMarkerStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY_FOR_PICKUP"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "ARRIVED"
  | "DELIVERED"
  | "FAILED"
  | "FAILED_ATTEMPT"
  | "RETURNED"
  | "CANCELLED";

export interface ShipmentMarker {
  id: string;
  lng: number;
  lat: number;
  status: ShipmentMarkerStatus;
  label: string;
}

export interface ShipmentMarkerLayerProps {
  markers: ShipmentMarker[];
  selectedId?: string | null;
  onShipmentClick?: (id: string) => void;
}

const SOURCE_ID = "shipment-markers";
const LAYER_CIRCLES = "shipment-circles";
const LAYER_SELECTED = "shipment-selected-ring";
const LAYER_LABELS = "shipment-labels";

function resolveStatusColour(
  status: ShipmentMarkerStatus,
  tokens: ReturnType<typeof mapTokens>,
): string {
  switch (status) {
    case "DELIVERED":
      return tokens.fillGood;
    case "OUT_FOR_DELIVERY":
    case "ARRIVED":
      return tokens.pinInTransit;
    case "IN_TRANSIT":
    case "PICKED_UP":
      return tokens.pinAssigned;
    case "FAILED":
    case "FAILED_ATTEMPT":
    case "RETURNED":
    case "CANCELLED":
      return tokens.pinDelayed;
    default:
      // PENDING, PROCESSING, READY_FOR_PICKUP
      return tokens.pinOpen;
  }
}

function buildFeatureCollection(
  markers: ShipmentMarker[],
  tokens: ReturnType<typeof mapTokens>,
) {
  return {
    type: "FeatureCollection" as const,
    features: markers.map((m) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [m.lng, m.lat] },
      properties: {
        id: m.id,
        status: m.status,
        label: m.label,
        colour: resolveStatusColour(m.status, tokens),
      },
    })),
  };
}

export function ShipmentMarkerLayer({
  markers,
  selectedId,
  onShipmentClick,
}: ShipmentMarkerLayerProps) {
  const map = useWLMap();

  // ── Mount: add source + layers ──────────────────────────────
  useEffect(() => {
    const setup = () => {
      const t = mapTokens();
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: buildFeatureCollection(markers, t),
      });

      // Base circles — colour driven by feature property set at data-update time
      map.addLayer({
        id: LAYER_CIRCLES,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 10],
          "circle-color": ["get", "colour"],
          "circle-stroke-color": t.labelHalo,
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.9,
        },
      });

      // Selection ring (rendered on top of base circles)
      map.addLayer({
        id: LAYER_SELECTED,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "id"], selectedId ?? ""],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 9, 14, 16],
          "circle-color": "transparent",
          "circle-stroke-color": t.strokeSelected,
          "circle-stroke-width": 2.5,
          "circle-opacity": 1,
        },
      });

      // Labels
      map.addLayer({
        id: LAYER_LABELS,
        type: "symbol",
        source: SOURCE_ID,
        minzoom: 12,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-font": ["DM Sans Regular", "Open Sans Regular"],
        },
        paint: {
          "text-color": t.label,
          "text-halo-color": t.labelHalo,
          "text-halo-width": 1.5,
        },
      });

      // Click handler
      if (onShipmentClick) {
        const handleClick = (
          e: MapMouseEvent & { features?: MapGeoJSONFeature[] },
        ) => {
          const feature = e.features?.[0];
          if (feature) {
            const id = feature.properties?.id as string;
            onShipmentClick(id);
          }
        };
        map.on("click", LAYER_CIRCLES, handleClick);
        map.on("mouseenter", LAYER_CIRCLES, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", LAYER_CIRCLES, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    };

    if (map.isStyleLoaded()) setup();
    else map.on("load", setup);

    return () => {
      if (map.getLayer(LAYER_LABELS)) map.removeLayer(LAYER_LABELS);
      if (map.getLayer(LAYER_SELECTED)) map.removeLayer(LAYER_SELECTED);
      if (map.getLayer(LAYER_CIRCLES)) map.removeLayer(LAYER_CIRCLES);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // ── Data update when markers change ─────────────────────────
  useEffect(() => {
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (src) {
      src.setData(buildFeatureCollection(markers, mapTokens()));
    }
  }, [map, markers]);

  // ── Update selected ring filter ──────────────────────────────
  useEffect(() => {
    if (map.getLayer(LAYER_SELECTED)) {
      map.setFilter(LAYER_SELECTED, ["==", ["get", "id"], selectedId ?? ""]);
    }
  }, [map, selectedId]);

  return null;
}
