'use client';
import { useEffect, useRef } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import type { FeatureCollection } from 'geojson';
import type { IControl, MapMouseEvent } from 'maplibre-gl';
import { circle as turfCircle } from '@turf/turf';
import type { ZoneShape } from '@witylogix/validators';
import { useWLMap } from './wl-map-context';

export interface DrawLayerProps {
  mode: 'polygon' | 'circle' | null;
  value: ZoneShape | null;
  onChange: (shape: ZoneShape | null) => void;
  /** For circle mode, radius in meters (controlled by inspector slider). */
  circleRadiusMeters?: number;
}

export function DrawLayer({ mode, value, onChange, circleRadiusMeters = 1000 }: DrawLayerProps) {
  const map = useWLMap();
  const drawRef = useRef<MapboxDraw | null>(null);

  useEffect(() => {
    if (!mode) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      styles: [
        {
          id: 'draw-poly-fill',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: { 'fill-color': '#f5a623', 'fill-opacity': 0.2 },
        },
        {
          id: 'draw-poly-stroke',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon']],
          paint: { 'line-color': '#f5a623', 'line-width': 2 },
        },
        {
          id: 'draw-vertex',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex']],
          paint: { 'circle-radius': 5, 'circle-color': '#f5a623' },
        },
      ],
    });
    drawRef.current = draw;
    map.addControl(draw as unknown as IControl);

    if (mode === 'polygon') {
      draw.changeMode('draw_polygon');
    }

    if (mode === 'circle') {
      const onClick = (e: MapMouseEvent) => {
        const poly = turfCircle(
          [e.lngLat.lng, e.lngLat.lat],
          circleRadiusMeters / 1000,
          { steps: 64, units: 'kilometers' },
        );
        draw.deleteAll();
        draw.add(poly);
        onChange({
          type: 'circle',
          center: { latitude: e.lngLat.lat, longitude: e.lngLat.lng },
          radiusMeters: circleRadiusMeters,
        });
      };
      map.once('click', onClick);
    }

    const emitPolygon = () => {
      const all = draw.getAll() as FeatureCollection;
      const feat = all.features[0];
      if (!feat || feat.geometry.type !== 'Polygon') {
        onChange(null);
        return;
      }
      const ring = feat.geometry.coordinates[0]
        .slice(0, -1)
        .map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
      onChange({ type: 'polygon', ring });
    };

    // mapbox-gl-draw emits draw.* events not in MapLibre's typed event map.
    const onCustom = map.on.bind(map) as (type: string, listener: (e: unknown) => void) => unknown;
    onCustom('draw.create', emitPolygon);
    onCustom('draw.update', emitPolygon);

    if (value?.type === 'polygon' && value.ring.length >= 3) {
      draw.add({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              ...value.ring.map((p: { latitude: number; longitude: number }) => [p.longitude, p.latitude]),
              [value.ring[0].longitude, value.ring[0].latitude],
            ],
          ],
        },
      });
    } else if (value?.type === 'circle') {
      const poly = turfCircle(
        [value.center.longitude, value.center.latitude],
        value.radiusMeters / 1000,
        { steps: 64, units: 'kilometers' },
      );
      draw.add(poly);
    }

    return () => {
      map.removeControl(draw as unknown as IControl);
      drawRef.current = null;
    };
    // Re-create draw control when mode or radius changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mode, circleRadiusMeters]);

  return null;
}
