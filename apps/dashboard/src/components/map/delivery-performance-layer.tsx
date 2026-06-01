'use client';
/**
 * DeliveryPerformanceLayer — renders delivery pins coloured by on-time status.
 *
 * Green  = on-time delivery
 * Red    = late delivery
 * Amber  = in-flight (OUT_FOR_DELIVERY / ARRIVED)
 * Grey   = failed / unknown
 */

import { useEffect } from 'react';
import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import type { Feature, Point } from 'geojson';
import { useWLMap } from './wl-map-context';

export interface DeliveryPin {
  id: string;
  lat: number;
  lng: number;
  status: string;
  onTime: boolean | null;
  city?: string | null;
}

export interface DeliveryPerformanceLayerProps {
  pins: DeliveryPin[];
  onPinClick?: (id: string) => void;
}

const SOURCE_ID = 'delivery-perf';
const CIRCLE_ID = 'delivery-perf-circle';
const HALO_ID   = 'delivery-perf-halo';

function pinColor(pin: DeliveryPin): string {
  if (pin.status === 'DELIVERED' && pin.onTime === true)  return '#10b981'; // emerald
  if (pin.status === 'DELIVERED' && pin.onTime === false) return '#ef4444'; // red
  if (pin.status === 'OUT_FOR_DELIVERY' || pin.status === 'ARRIVED') return '#f59e0b'; // amber
  return '#6b7280'; // grey / failed
}

function buildFeatures(pins: DeliveryPin[]): Feature<Point>[] {
  return pins.map((p) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
    properties: {
      id: p.id,
      color: pinColor(p),
      status: p.status,
      city: p.city ?? '',
    },
  }));
}

export function DeliveryPerformanceLayer({ pins, onPinClick }: DeliveryPerformanceLayerProps) {
  const map = useWLMap();

  useEffect(() => {
    const setup = () => {
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: buildFeatures(pins) },
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 40,
      });

      // Cluster circles
      map.addLayer({
        id: 'delivery-perf-cluster',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#3b82f6', 10, '#f59e0b', 50, '#ef4444'],
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
          'circle-opacity': 0.8,
          'circle-stroke-color': 'rgba(255,255,255,0.15)',
          'circle-stroke-width': 1,
        },
      });

      // Cluster count labels
      map.addLayer({
        id: 'delivery-perf-cluster-count',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 11,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: { 'text-color': '#ffffff' },
      });

      // Halo for individual pins
      map.addLayer({
        id: HALO_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 10,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.15,
        },
      });

      // Individual pin dots
      map.addLayer({
        id: CIRCLE_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': 'rgba(255,255,255,0.4)',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
      });

      if (onPinClick) {
        const handler = (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) onPinClick(id);
        };
        map.on('click', CIRCLE_ID, handler);
        map.on('mouseenter', CIRCLE_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', CIRCLE_ID, () => { map.getCanvas().style.cursor = ''; });
      }
    };

    if (map.isStyleLoaded()) setup();
    else map.on('load', setup);

    return () => {
      ['delivery-perf-cluster', 'delivery-perf-cluster-count', HALO_ID, CIRCLE_ID].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Live updates
  useEffect(() => {
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (src) src.setData({ type: 'FeatureCollection', features: buildFeatures(pins) });
  }, [map, pins]);

  return null;
}
