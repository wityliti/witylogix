'use client';

import { useEffect } from 'react';
import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import type { Feature, Point } from 'geojson';
import { useWLMap } from './wl-map-context';
import { mapTokens } from './resolve-token';

export type OrderPinStatus = 'pending' | 'assigned' | 'in_transit' | 'delayed';

export interface OrderPin {
  id: string;
  orderNumber: string;
  customerName: string;
  address: string;
  status: OrderPinStatus;
  lat: number;
  lng: number;
  priority?: 'low' | 'medium' | 'high';
}

export interface OrderLayerProps {
  orders: OrderPin[];
  selectedOrderId?: string | null;
  onOrderClick?: (orderId: string) => void;
}

const STATUS_COLORS: Record<OrderPinStatus, string> = {
  pending: '#60a5fa',
  assigned: '#f5a623',
  in_transit: '#10b981',
  delayed: '#ef4444',
};

const SOURCE_ID = 'dispatch-orders';
const CIRCLE_LAYER = 'dispatch-orders-circle';
const HALO_LAYER = 'dispatch-orders-halo';

function buildFeatures(orders: OrderPin[], selectedOrderId?: string | null): Feature<Point>[] {
  return orders.map((o) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [o.lng, o.lat] },
    properties: {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      address: o.address,
      status: o.status,
      priority: o.priority ?? 'low',
      isSelected: o.id === selectedOrderId ? 1 : 0,
      color: STATUS_COLORS[o.status] ?? STATUS_COLORS.pending,
    },
  }));
}

export function OrderLayer({ orders, selectedOrderId, onOrderClick }: OrderLayerProps) {
  const map = useWLMap();

  useEffect(() => {
    const setup = () => {
      const t = mapTokens();
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: buildFeatures(orders, selectedOrderId),
        },
      });

      // Halo for selected / high-priority
      map.addLayer({
        id: HALO_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['any',
          ['==', ['get', 'isSelected'], 1],
          ['==', ['get', 'priority'], 'high'],
        ],
        paint: {
          'circle-radius': 14,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.18,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 1,
          'circle-stroke-opacity': 0.4,
        },
      });

      // Main dot — square-ish for orders (large stroke)
      map.addLayer({
        id: CIRCLE_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'isSelected'], 1], 9,
            ['==', ['get', 'priority'], 'high'], 8,
            6,
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'isSelected'], 1], '#ffffff',
            t.labelHalo,
          ],
          'circle-stroke-width': [
            'case',
            ['==', ['get', 'isSelected'], 1], 3,
            1.5,
          ],
        },
      });

      const clickHandler = (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const orderId = feature.properties?.id as string | undefined;
        if (orderId && onOrderClick) {
          onOrderClick(orderId);
        }
      };

      map.on('click', CIRCLE_LAYER, clickHandler);
      map.on('mouseenter', CIRCLE_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', CIRCLE_LAYER, () => { map.getCanvas().style.cursor = ''; });
    };

    if (map.isStyleLoaded()) setup();
    else map.on('load', setup);

    return () => {
      if (map.getLayer(CIRCLE_LAYER)) map.removeLayer(CIRCLE_LAYER);
      if (map.getLayer(HALO_LAYER)) map.removeLayer(HALO_LAYER);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Live data updates
  useEffect(() => {
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: buildFeatures(orders, selectedOrderId),
    });
  }, [map, orders, selectedOrderId]);

  return null;
}
