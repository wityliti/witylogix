'use client';
import { useEffect } from 'react';
import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource } from 'maplibre-gl';
import { useWLMap } from './wl-map-context';

export interface ZoneAccuracyEntry {
  id: string;
  name: string;
  boundary: unknown;
  sampleCount: number;
  onTimePercent: number;
  avgDelayMinutes: number;
}

export interface EtaAccuracyZoneLayerProps {
  zones: FeatureCollection;
  accuracyData: ZoneAccuracyEntry[];
  onSelect?: (zoneId: string | null) => void;
}

function accuracyColor(onTimePct: number): string {
  if (onTimePct >= 90) return '#10b981'; // emerald
  if (onTimePct >= 75) return '#22c55e'; // green
  if (onTimePct >= 60) return '#f59e0b'; // amber
  if (onTimePct >= 45) return '#f97316'; // orange
  return '#ef4444';                       // red
}

function noDataColor(): string {
  return '#6b7280'; // gray for zones with no data
}

export function EtaAccuracyZoneLayer({ zones, accuracyData, onSelect }: EtaAccuracyZoneLayerProps) {
  const map = useWLMap();

  const dataById = new Map(accuracyData.map((d) => [d.id, d]));

  const enriched: FeatureCollection = {
    ...zones,
    features: zones.features.map((f) => {
      const id = String(f.properties?.id ?? '');
      const d = dataById.get(id);
      const color = d ? accuracyColor(d.onTimePercent) : noDataColor();
      return {
        ...f,
        properties: {
          ...f.properties,
          zoneColor: color,
          onTimePercent: d?.onTimePercent ?? null,
          avgDelayMinutes: d?.avgDelayMinutes ?? null,
          sampleCount: d?.sampleCount ?? 0,
          hasData: d != null,
        },
      };
    }),
  };

  useEffect(() => {
    const setup = () => {
      if (map.getSource('eta-accuracy-zones')) return;
      map.addSource('eta-accuracy-zones', { type: 'geojson', data: enriched });
      map.addLayer({
        id: 'eta-accuracy-zones-fill',
        type: 'fill',
        source: 'eta-accuracy-zones',
        paint: {
          'fill-color': ['get', 'zoneColor'],
          'fill-opacity': ['case', ['get', 'hasData'], 0.45, 0.12],
        },
      });
      map.addLayer({
        id: 'eta-accuracy-zones-stroke',
        type: 'line',
        source: 'eta-accuracy-zones',
        paint: {
          'line-color': ['get', 'zoneColor'],
          'line-width': 2,
          'line-opacity': ['case', ['get', 'hasData'], 0.8, 0.3],
        },
      });
      if (onSelect) {
        map.on('click', 'eta-accuracy-zones-fill', (e) => {
          const f = e.features?.[0];
          onSelect(f?.properties?.id ?? null);
        });
      }
    };
    if (map.isStyleLoaded()) setup();
    else map.on('load', setup);
    return () => {
      ['eta-accuracy-zones-fill', 'eta-accuracy-zones-stroke'].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource('eta-accuracy-zones')) map.removeSource('eta-accuracy-zones');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const src = map.getSource('eta-accuracy-zones') as GeoJSONSource | undefined;
    if (src) src.setData(enriched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(accuracyData)]);

  return null;
}
