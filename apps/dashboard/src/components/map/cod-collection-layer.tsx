'use client';

import { useEffect, useRef } from 'react';
import { useWLMap } from './wl-map-context';
import { useFitBounds } from './use-fit-bounds';

export interface CodCollectionPoint {
  id: string;
  deliveryLat: number;
  deliveryLng: number;
  status: 'pending' | 'collected' | 'verified' | 'reconciled' | 'failed';
  amount: string;
  driverName?: string;
  orderNumber?: string;
}

interface Props {
  points: CodCollectionPoint[];
  onPointClick?: (point: CodCollectionPoint) => void;
  autoFit?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#3b82f6',
  collected: '#22c55e',
  verified: '#f59e0b',
  reconciled: '#6b7280',
  failed: '#ef4444',
};

const SOURCE_ID = 'cod-collection-source';
const LAYER_ID = 'cod-collection-circles';
const LABEL_LAYER_ID = 'cod-collection-labels';

export function CodCollectionLayer({ points, onPointClick, autoFit = true }: Props) {
  const map = useWLMap();
  const clickHandlerRef = useRef<((e: any) => void) | null>(null);

  const coords = points.map((p) => ({ lng: p.deliveryLng, lat: p.deliveryLat }));
  useFitBounds(map, coords, 60);

  useEffect(() => {
    if (!map) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        id: p.id,
        geometry: { type: 'Point', coordinates: [p.deliveryLng, p.deliveryLat] },
        properties: {
          id: p.id,
          status: p.status,
          color: STATUS_COLORS[p.status] ?? '#6b7280',
          amount: p.amount,
          driverName: p.driverName ?? '',
          orderNumber: p.orderNumber ?? '',
        },
      })),
    };

    const existing = map.getSource(SOURCE_ID);
    if (existing) {
      (existing as any).setData(geojson);
      return;
    }

    const addLayers = () => {
      if (map.getSource(SOURCE_ID)) {
        (map.getSource(SOURCE_ID) as any).setData(geojson);
        return;
      }
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 14, 10],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        minzoom: 13,
        layout: {
          'text-field': ['concat', '$', ['get', 'amount']],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1,
        },
      });
    };

    if (map.isStyleLoaded()) addLayers();
    else map.once('load', addLayers);
  }, [map, points]);

  useEffect(() => {
    if (!map || !onPointClick) return;

    if (clickHandlerRef.current) {
      map.off('click', LAYER_ID, clickHandlerRef.current);
    }

    const handler = (e: any) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const props = feature.properties;
      const point = points.find((p) => p.id === props.id);
      if (point) onPointClick(point);
    };

    map.on('click', LAYER_ID, handler);
    map.on('mouseenter', LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', LAYER_ID, () => { map.getCanvas().style.cursor = ''; });
    clickHandlerRef.current = handler;

    return () => {
      map.off('click', LAYER_ID, handler);
    };
  }, [map, points, onPointClick]);

  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {}
    };
  }, [map]);

  return null;
}
