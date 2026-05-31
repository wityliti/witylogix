'use client';
import { useEffect, useCallback } from 'react';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import { useWLMap } from './wl-map-context';

export type VehicleMapStatus = 'ACTIVE' | 'IDLE' | 'OFFLINE' | 'MAINTENANCE' | 'INACTIVE';

export interface VehicleMapMarker {
  id: string;
  name: string;
  licensePlate?: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  status: VehicleMapStatus;
  lastUpdate: string;
  fuelLevel?: number;
}

export interface VehicleMarkerLayerProps {
  vehicles: VehicleMapMarker[];
  selectedVehicleId?: string;
  onVehicleClick?: (vehicle: VehicleMapMarker) => void;
}

// Status → color mapping using design-system tokens as fallbacks
const STATUS_COLORS: Record<VehicleMapStatus, string> = {
  ACTIVE: '#10b981',    // wl-success-500
  IDLE: '#f59e0b',      // wl-warning-500
  OFFLINE: '#6b7280',   // neutral
  MAINTENANCE: '#3b82f6', // wl-info-500
  INACTIVE: '#4b5563',
};

const SOURCE_ID = 'vehicle-markers';
const LAYER_CIRCLE = 'vehicle-markers-circle';
const LAYER_LABEL = 'vehicle-markers-label';
const LAYER_SELECTED = 'vehicle-markers-selected';

function buildFeatureCollection(vehicles: VehicleMapMarker[]) {
  return {
    type: 'FeatureCollection' as const,
    features: vehicles.map((v) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [v.longitude, v.latitude],
      },
      properties: {
        id: v.id,
        name: v.name,
        licensePlate: v.licensePlate ?? '',
        status: v.status,
        speed: v.speed,
        heading: v.heading,
        fuelLevel: v.fuelLevel ?? -1,
        lastUpdate: v.lastUpdate,
        color: STATUS_COLORS[v.status] ?? STATUS_COLORS.OFFLINE,
      },
    })),
  };
}

export function VehicleMarkerLayer({
  vehicles,
  selectedVehicleId,
  onVehicleClick,
}: VehicleMarkerLayerProps) {
  const map = useWLMap();

  const handleClick = useCallback(
    (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      if (!onVehicleClick) return;
      const features = e.features ?? [];
      if (features.length === 0) return;
      const props = features[0]?.properties;
      if (!props) return;
      const vehicle = vehicles.find((v) => v.id === props['id']);
      if (vehicle) onVehicleClick(vehicle);
    },
    [vehicles, onVehicleClick],
  );

  // Mount: add source + layers
  useEffect(() => {
    const setup = () => {
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: buildFeatureCollection(vehicles),
      });

      // Outer pulse ring for selected vehicle
      map.addLayer({
        id: LAYER_SELECTED,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 20,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.15,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': 0.4,
        },
        filter: ['==', ['get', 'id'], selectedVehicleId ?? ''],
      });

      // Main vehicle circle
      map.addLayer({
        id: LAYER_CIRCLE,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 5,
            10, 9,
            14, 11,
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#0a0a0c',
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        },
      });

      // Vehicle name label
      map.addLayer({
        id: LAYER_LABEL,
        type: 'symbol',
        source: SOURCE_ID,
        minzoom: 9,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-font': ['DM Sans Medium', 'Open Sans Semibold', 'Arial Unicode MS Regular'],
          'text-max-width': 10,
        },
        paint: {
          'text-color': '#d5d5dd',
          'text-halo-color': '#0a0a0c',
          'text-halo-width': 1.5,
        },
      });

      map.on('click', LAYER_CIRCLE, handleClick as (e: MapMouseEvent) => void);
      map.on('mouseenter', LAYER_CIRCLE, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', LAYER_CIRCLE, () => {
        map.getCanvas().style.cursor = '';
      });
    };

    if (map.isStyleLoaded()) setup();
    else map.on('load', setup);

    return () => {
      map.off('click', LAYER_CIRCLE, handleClick as (e: MapMouseEvent) => void);
      if (map.getLayer(LAYER_LABEL)) map.removeLayer(LAYER_LABEL);
      if (map.getLayer(LAYER_SELECTED)) map.removeLayer(LAYER_SELECTED);
      if (map.getLayer(LAYER_CIRCLE)) map.removeLayer(LAYER_CIRCLE);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
    // Mount-only: data + selection updates handled in separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update GeoJSON data when vehicles change
  useEffect(() => {
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (src) {
      src.setData(buildFeatureCollection(vehicles));
    }
  }, [map, vehicles]);

  // Update selected vehicle filter
  useEffect(() => {
    if (map.getLayer(LAYER_SELECTED)) {
      map.setFilter(LAYER_SELECTED, ['==', ['get', 'id'], selectedVehicleId ?? '']);
    }
  }, [map, selectedVehicleId]);

  return null;
}
