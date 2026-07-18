'use client';

import { useEffect, useRef } from 'react';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import type { Feature, Point } from 'geojson';
import { useWLMap } from './wl-map-context';

export type EldComplianceStatus = 'COMPLIANT' | 'WARNING' | 'VIOLATION' | 'OFFLINE';

export interface EldDriverPin {
  id: string;
  name: string;
  compliance: EldComplianceStatus;
  duty: string;
  drivingRemaining: number;
  violations: number;
  lat: number;
  lng: number;
}

export interface EldComplianceLayerProps {
  drivers: EldDriverPin[];
  selectedDriverId?: string | null;
  onDriverClick?: (driverId: string) => void;
}

const COMPLIANCE_COLORS: Record<EldComplianceStatus, string> = {
  COMPLIANT: '#10b981',
  WARNING:   '#f59e0b',
  VIOLATION: '#ef4444',
  OFFLINE:   '#6b7280',
};

const SOURCE_ID  = 'eld-compliance-drivers';
const CIRCLE_ID  = 'eld-compliance-circle';
const PULSE_ID   = 'eld-compliance-pulse';
const LABEL_ID   = 'eld-compliance-label';
const OUTLINE_ID = 'eld-compliance-outline';

function buildFeatures(drivers: EldDriverPin[], selectedId?: string | null): Feature<Point>[] {
  return drivers.map((d) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
    properties: {
      id:               d.id,
      name:             d.name,
      compliance:       d.compliance,
      duty:             d.duty,
      drivingRemaining: d.drivingRemaining,
      violations:       d.violations,
      isSelected:       d.id === selectedId ? 1 : 0,
      color:            COMPLIANCE_COLORS[d.compliance] ?? COMPLIANCE_COLORS.OFFLINE,
      initial:          (d.name ?? '?').charAt(0).toUpperCase(),
    },
  }));
}

export function EldComplianceLayer({ drivers, selectedDriverId, onDriverClick }: EldComplianceLayerProps) {
  const map = useWLMap();
  const clickHandlerRef = useRef<((e: MapLayerMouseEvent) => void) | null>(null);

  useEffect(() => {
    const geojson = { type: 'FeatureCollection' as const, features: buildFeatures(drivers, selectedDriverId) };

    if (map.getSource(SOURCE_ID)) {
      (map.getSource(SOURCE_ID) as any).setData(geojson);
      return;
    }

    map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

    // Pulse ring for VIOLATION drivers
    map.addLayer({
      id: PULSE_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['get', 'compliance'], 'VIOLATION'],
      paint: {
        'circle-radius': 20,
        'circle-color': '#ef4444',
        'circle-opacity': 0.18,
        'circle-stroke-width': 0,
      },
    });

    // Main circle
    map.addLayer({
      id: CIRCLE_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': ['case', ['==', ['get', 'isSelected'], 1], 18, 14],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.9,
        'circle-stroke-width': ['case', ['==', ['get', 'isSelected'], 1], 3, 1.5],
        'circle-stroke-color': ['case', ['==', ['get', 'isSelected'], 1], '#ffffff', 'rgba(255,255,255,0.4)'],
      },
    });

    // Selection outline
    map.addLayer({
      id: OUTLINE_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['get', 'isSelected'], 1],
      paint: {
        'circle-radius': 24,
        'circle-color': 'transparent',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0,
        'circle-stroke-opacity': 0.5,
      },
    });

    // Initial label
    map.addLayer({
      id: LABEL_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'text-field': ['get', 'initial'],
        'text-size': 10,
        'text-anchor': 'center',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0,0,0,0.3)',
        'text-halo-width': 1,
      },
    });

    // Cursor + click
    const onClick = (e: MapLayerMouseEvent) => {
      const features = e.features;
      if (!features?.length) return;
      const id = features[0].properties?.id as string | undefined;
      if (id) onDriverClick?.(id);
    };
    clickHandlerRef.current = onClick;
    map.on('click', CIRCLE_ID, onClick);
    map.on('mouseenter', CIRCLE_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', CIRCLE_ID, () => { map.getCanvas().style.cursor = ''; });

    return () => {
      if (clickHandlerRef.current) map.off('click', CIRCLE_ID, clickHandlerRef.current);
      [LABEL_ID, OUTLINE_ID, CIRCLE_ID, PULSE_ID].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map]);

  // Update data when drivers or selection changes
  useEffect(() => {
    if (!map.getSource(SOURCE_ID)) return;
    const geojson = { type: 'FeatureCollection' as const, features: buildFeatures(drivers, selectedDriverId) };
    (map.getSource(SOURCE_ID) as any).setData(geojson);
  }, [drivers, selectedDriverId, map]);

  return null;
}
