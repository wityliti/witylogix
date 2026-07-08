"use client";

import { useEffect } from "react";
import type { GeoJSONSource, LngLatBoundsLike } from "maplibre-gl";
import { useWLMap } from "./wl-map-context";

export interface RoutePolylineLayerProps {
  /**
   * Ordered array of [lng, lat] coordinate pairs forming the route polyline.
   * If fewer than 2 points, no line is drawn.
   */
  coordinates: Array<[number, number]>;
  /**
   * Visual variant. 'planned' renders a blue line; 'actual' renders a purple line.
   */
  variant?: "planned" | "actual";
  /**
   * When true, the map camera fits to the polyline bounds after the layer loads.
   */
  fitBounds?: boolean;
  /**
   * Padding in pixels applied when fitting bounds.
   */
  fitPadding?: number;
  /**
   * Optional source/layer id suffix to allow multiple polylines on the same map.
   */
  layerId?: string;
}

const SOURCE_ID_BASE = "route-polyline";
const LAYER_ID_BASE = "route-polyline-line";
const BORDER_LAYER_ID_BASE = "route-polyline-border";

export function RoutePolylineLayer({
  coordinates,
  variant = "planned",
  fitBounds = false,
  fitPadding = 60,
  layerId = "",
}: RoutePolylineLayerProps) {
  const map = useWLMap();

  const sourceId = layerId ? `${SOURCE_ID_BASE}-${layerId}` : SOURCE_ID_BASE;
  const borderLayerId = layerId
    ? `${BORDER_LAYER_ID_BASE}-${layerId}`
    : BORDER_LAYER_ID_BASE;
  const lineLayerId = layerId ? `${LAYER_ID_BASE}-${layerId}` : LAYER_ID_BASE;

  const lineColor = variant === "actual" ? "#8b5cf6" : "#3b82f6";
  const borderColor = variant === "actual" ? "#4c1d95" : "#1e3a5f";

  // Setup source and layers
  useEffect(() => {
    const setup = () => {
      if (map.getSource(sourceId)) return;

      map.addSource(sourceId, {
        type: "geojson",
        data: buildGeoJSON(coordinates),
      });

      // Soft border layer (slightly wider, darker)
      map.addLayer({
        id: borderLayerId,
        type: "line",
        source: sourceId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": borderColor,
          "line-width": 6,
          "line-opacity": 0.5,
        },
      });

      // Main polyline
      map.addLayer({
        id: lineLayerId,
        type: "line",
        source: sourceId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": lineColor,
          "line-width": 3,
          "line-opacity": 0.85,
          "line-dasharray": variant === "actual" ? [1, 0] : [1, 0],
        },
      });
    };

    if (map.isStyleLoaded()) setup();
    else map.on("load", setup);

    return () => {
      if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
      if (map.getLayer(borderLayerId)) map.removeLayer(borderLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, sourceId, lineLayerId, borderLayerId]);

  // Update GeoJSON data when coordinates change
  useEffect(() => {
    const src = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (src) {
      src.setData(buildGeoJSON(coordinates));
    }
  }, [map, sourceId, coordinates]);

  // Fit bounds to route
  useEffect(() => {
    if (!fitBounds || coordinates.length < 2) return;

    const src = map.getSource(sourceId);
    if (!src) return;

    const lngs = coordinates.map(([lng]) => lng);
    const lats = coordinates.map(([, lat]) => lat);
    const bounds: LngLatBoundsLike = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    map.fitBounds(bounds, { padding: fitPadding, duration: 600 });
  }, [map, sourceId, coordinates, fitBounds, fitPadding]);

  return null;
}

type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "LineString"; coordinates: Array<[number, number]> };
    properties: Record<string, never>;
  }>;
};

function buildGeoJSON(
  coordinates: Array<[number, number]>,
): GeoJSONFeatureCollection {
  return {
    type: "FeatureCollection",
    features:
      coordinates.length >= 2
        ? [
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates,
              },
              properties: {} as Record<string, never>,
            },
          ]
        : [],
  };
}
