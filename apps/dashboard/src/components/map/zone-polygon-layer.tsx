'use client';

import { useEffect, useRef } from 'react';

export interface ZoneFeature {
  id: string;
  name: string;
  isActive: boolean;
  color?: string;
  /** GeoJSON polygon coordinates: array of rings, each ring is [[lng, lat], …] */
  coordinates: [number, number][][];
}

interface ZonePolygonLayerProps {
  map: import('maplibre-gl').Map;
  zones: ZoneFeature[];
  onZoneClick?: (zone: ZoneFeature) => void;
}

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

export function ZonePolygonLayer({ map, zones, onZoneClick }: ZonePolygonLayerProps) {
  const prevZoneIds = useRef<string[]>([]);

  useEffect(() => {
    if (!map || zones.length === 0) return;

    const sourceId = 'wl-zones-source';
    const fillLayerId = 'wl-zones-fill';
    const lineLayerId = 'wl-zones-line';
    const labelLayerId = 'wl-zones-label';

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: zones.map((zone, i) => ({
        type: 'Feature',
        id: zone.id,
        properties: {
          id: zone.id,
          name: zone.name,
          isActive: zone.isActive,
          color: zone.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
        },
        geometry: {
          type: 'Polygon',
          coordinates: zone.coordinates,
        },
      })),
    };

    const existing = map.getSource(sourceId) as import('maplibre-gl').GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojson);
    } else {
      map.addSource(sourceId, { type: 'geojson', data: geojson });

      map.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['get', 'isActive'], 0.15, 0.06],
        },
      });

      map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': ['case', ['get', 'isActive'], 0.8, 0.4],
        },
      });

      map.addLayer({
        id: labelLayerId,
        type: 'symbol',
        source: sourceId,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-anchor': 'center',
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1,
        },
      });

      if (onZoneClick) {
        map.on('click', fillLayerId, (e) => {
          const props = e.features?.[0]?.properties;
          if (!props) return;
          const zone = zones.find((z) => z.id === props.id);
          if (zone) onZoneClick(zone);
        });

        map.on('mouseenter', fillLayerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', fillLayerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    }

    prevZoneIds.current = zones.map((z) => z.id);

    return () => {
      try {
        if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
        if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // map already destroyed
      }
    };
  }, [map, zones, onZoneClick]);

  return null;
}
