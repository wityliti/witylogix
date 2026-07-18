'use client';
import { useEffect } from 'react';
import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource } from 'maplibre-gl';
import { useWLMap } from './wl-map-context';

export interface SlotZoneEntry {
  zoneId: string;
  activeSlots: number;
  totalSlots: number;
  totalCapacity: number;
}

export interface TimeSlotZoneLayerProps {
  zones: FeatureCollection;
  slotData: SlotZoneEntry[];
  onSelect?: (zoneId: string | null) => void;
}

function slotColor(activeSlots: number, totalCapacity: number): string {
  if (totalCapacity === 0) return '#6b7280';  // grey — no slots
  if (activeSlots === 0) return '#ef4444';     // red — all inactive
  if (activeSlots === 1 || totalCapacity < 50) return '#f59e0b'; // amber — limited
  return '#10b981';                            // emerald — good coverage
}

export function TimeSlotZoneLayer({ zones, slotData, onSelect }: TimeSlotZoneLayerProps) {
  const map = useWLMap();

  const slotById = new Map(slotData.map((s) => [s.zoneId, s]));

  const enriched: FeatureCollection = {
    ...zones,
    features: zones.features.map((f) => {
      const id = String(f.properties?.id ?? '');
      const s = slotById.get(id);
      const color = slotColor(s?.activeSlots ?? 0, s?.totalCapacity ?? 0);
      return {
        ...f,
        properties: {
          ...f.properties,
          slotColor: color,
          activeSlots: s?.activeSlots ?? 0,
          totalSlots: s?.totalSlots ?? 0,
          totalCapacity: s?.totalCapacity ?? 0,
        },
      };
    }),
  };

  useEffect(() => {
    const setup = () => {
      if (map.getSource('timeslot-zones')) return;
      map.addSource('timeslot-zones', { type: 'geojson', data: enriched });
      map.addLayer({
        id: 'timeslot-zones-fill',
        type: 'fill',
        source: 'timeslot-zones',
        paint: {
          'fill-color': ['get', 'slotColor'],
          'fill-opacity': 0.35,
        },
      });
      map.addLayer({
        id: 'timeslot-zones-stroke',
        type: 'line',
        source: 'timeslot-zones',
        paint: {
          'line-color': ['get', 'slotColor'],
          'line-width': 2,
          'line-opacity': 0.85,
        },
      });
      if (onSelect) {
        map.on('click', 'timeslot-zones-fill', (e) => {
          const f = e.features?.[0];
          onSelect(f?.properties?.id ?? null);
        });
        map.on('mouseenter', 'timeslot-zones-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'timeslot-zones-fill', () => {
          map.getCanvas().style.cursor = '';
        });
      }
    };
    if (map.isStyleLoaded()) setup();
    else map.on('load', setup);
    return () => {
      ['timeslot-zones-fill', 'timeslot-zones-stroke'].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource('timeslot-zones')) map.removeSource('timeslot-zones');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const src = map.getSource('timeslot-zones') as GeoJSONSource | undefined;
    if (src) src.setData(enriched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(slotData)]);

  return null;
}
