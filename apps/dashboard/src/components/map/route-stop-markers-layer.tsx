'use client';

import { useEffect, useCallback } from 'react';
import maplibregl, { type LngLatBoundsLike } from 'maplibre-gl';
import { useWLMap } from './wl-map-context';
import type { Map as MapLibreMap } from 'maplibre-gl';

export type StopMarkerStatus =
  | 'PENDING'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'FAILED';

export interface StopMarker {
  id: string;
  /** 1-based sequence number */
  sequence: number;
  lng: number;
  lat: number;
  status: StopMarkerStatus;
  address?: string;
  customerName?: string;
  eta?: string;
}

export interface RouteStopMarkersLayerProps {
  stops: StopMarker[];
  /**
   * Called when a stop marker popup is clicked.
   */
  onStopClick?: (stop: StopMarker) => void;
  /**
   * Fit map to all stop bounds on first render.
   */
  fitBounds?: boolean;
  fitPadding?: number;
}

const STATUS_COLORS: Record<StopMarkerStatus, string> = {
  PENDING: '#6b7280',
  EN_ROUTE: '#f59e0b',
  ARRIVED: '#3b82f6',
  COMPLETED: '#10b981',
  SKIPPED: '#9ca3af',
  FAILED: '#ef4444',
};

/** Creates an SVG data URI for a numbered stop marker */
function createMarkerElement(sequence: number, status: StopMarkerStatus): HTMLElement {
  const color = STATUS_COLORS[status] ?? '#6b7280';
  const el = document.createElement('div');
  el.style.cssText = 'cursor: pointer; user-select: none;';

  const size = 28;
  el.innerHTML = `
    <svg width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="${size / 2}" y="${size / 2 + 1}" text-anchor="middle" dominant-baseline="middle"
        font-family="DM Mono, monospace" font-size="10" font-weight="700" fill="white">${sequence}</text>
      <polygon points="${size / 2 - 4},${size - 2} ${size / 2 + 4},${size - 2} ${size / 2},${size + 6}" fill="${color}"/>
    </svg>
  `;
  return el;
}

/** Builds HTML for a stop popup */
function buildPopupHTML(stop: StopMarker): string {
  const color = STATUS_COLORS[stop.status] ?? '#6b7280';
  return `
    <div style="font-family: system-ui, sans-serif; min-width: 180px; max-width: 240px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></div>
        <strong style="font-size:13px;color:#111;">Stop #${stop.sequence}</strong>
        <span style="margin-left:auto;font-size:11px;color:${color};font-weight:600;text-transform:uppercase;">
          ${stop.status.replace('_', ' ')}
        </span>
      </div>
      ${stop.customerName ? `<p style="margin:0 0 4px;font-size:12px;color:#374151;font-weight:500;">${stop.customerName}</p>` : ''}
      ${stop.address ? `<p style="margin:0 0 4px;font-size:11px;color:#6b7280;">${stop.address}</p>` : ''}
      ${stop.eta ? `<p style="margin:0;font-size:11px;color:#6b7280;">ETA: ${stop.eta}</p>` : ''}
    </div>
  `;
}

export function RouteStopMarkersLayer({
  stops,
  onStopClick,
  fitBounds = false,
  fitPadding = 60,
}: RouteStopMarkersLayerProps) {
  const map = useWLMap();

  const addMarkers = useCallback(
    (m: MapLibreMap, currentStops: StopMarker[]) => {
      // Remove all existing route-stop markers
      type MarkerLike = { remove: () => void };
      const existingMarkers = (m as MapLibreMap & { _routeStopMarkers?: MarkerLike[] })
        ._routeStopMarkers ?? [];
      existingMarkers.forEach((marker: MarkerLike) => marker.remove());

      if (currentStops.length === 0) {
        (m as MapLibreMap & { _routeStopMarkers?: MarkerLike[] })._routeStopMarkers = [];
        return;
      }

      const markers: MarkerLike[] = currentStops.map((stop) => {
        const el = createMarkerElement(stop.sequence, stop.status);

        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: true,
          offset: [0, -30],
          className: 'route-stop-popup',
        }).setHTML(buildPopupHTML(stop));

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([stop.lng, stop.lat])
          .setPopup(popup)
          .addTo(m);

        el.addEventListener('click', () => {
          onStopClick?.(stop);
        });

        return marker;
      });

      (m as MapLibreMap & { _routeStopMarkers?: MarkerLike[] })._routeStopMarkers =
        markers;

      if (fitBounds && currentStops.length >= 1) {
        const lngs = currentStops.map((s) => s.lng);
        const lats = currentStops.map((s) => s.lat);
        const bounds: LngLatBoundsLike = [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ];
        m.fitBounds(bounds, { padding: fitPadding, duration: 600 });
      }
    },
    [onStopClick, fitBounds, fitPadding],
  );

  // Initial setup — wait for style load
  useEffect(() => {
    const setup = () => addMarkers(map, stops);
    if (map.isStyleLoaded()) setup();
    else map.on('load', setup);

    return () => {
      type MarkerLike = { remove: () => void };
      const existing = (
        map as MapLibreMap & { _routeStopMarkers?: MarkerLike[] }
      )._routeStopMarkers;
      existing?.forEach((mk: MarkerLike) => mk.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update markers when stops change
  useEffect(() => {
    if (map.isStyleLoaded()) {
      addMarkers(map, stops);
    }
  }, [map, stops, addMarkers]);

  return null;
}
