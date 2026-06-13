'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface JobLocation {
  id: string;
  jobNumber: string;
  customerName: string;
  address: string;
  status: string;
  priority: string;
  lat: number;
  lng: number;
}

interface JobLocationLayerProps {
  mapId: string;
  jobs: JobLocation[];
  selectedJobId?: string | null;
  onJobClick?: (id: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  created:     '#94a3b8',
  scheduled:   '#60a5fa',
  dispatched:  '#a78bfa',
  in_progress: '#fbbf24',
  completed:   '#34d399',
  cancelled:   '#6b7280',
};

const PRIORITY_BORDER: Record<string, string> = {
  urgent: '#ef4444',
  high:   '#f97316',
  medium: '#eab308',
  low:    '#94a3b8',
};

export function JobLocationLayer({ mapId, jobs, selectedJobId, onJobClick }: JobLocationLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      (layersRef.current as L.Layer[]).forEach((l) => map.removeLayer(l));
      layersRef.current = [];

      if (!jobs.length) return;

      const bounds: [number, number][] = [];

      jobs.forEach((job) => {
        const fillColor = STATUS_COLOR[job.status] ?? '#94a3b8';
        const borderColor = PRIORITY_BORDER[job.priority] ?? '#94a3b8';
        const isSelected = job.id === selectedJobId;
        const size = isSelected ? 22 : 16;

        bounds.push([job.lat, job.lng]);

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:${size}px;height:${size}px;
            border-radius:3px;
            background:${fillColor};
            border:2px solid ${isSelected ? '#fff' : borderColor};
            box-shadow:0 0 0 ${isSelected ? 3 : 0}px ${fillColor}55,0 2px 6px rgba(0,0,0,.5);
            display:flex;align-items:center;justify-content:center;
            font-size:8px;font-weight:700;color:rgba(0,0,0,0.7);
          ">J</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([job.lat, job.lng], { icon });
        marker.bindPopup(`
          <div style="min-width:170px">
            <div style="font-weight:700;font-size:13px;margin-bottom:5px;color:#e2e8f0">${job.jobNumber}</div>
            <div style="color:#94a3b8;font-size:11px;margin-bottom:3px">${job.customerName}</div>
            <div style="color:#64748b;font-size:10px;margin-bottom:6px">${job.address}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <span style="background:${fillColor}22;color:${fillColor};padding:2px 6px;border-radius:4px;font-size:10px;border:1px solid ${fillColor}44">${job.status.replace(/_/g, ' ')}</span>
              <span style="background:${borderColor}22;color:${borderColor};padding:2px 6px;border-radius:4px;font-size:10px;border:1px solid ${borderColor}44">${job.priority}</span>
            </div>
          </div>
        `);

        if (onJobClick) {
          marker.on('click', () => onJobClick(job.id));
        }

        marker.addTo(map);
        layersRef.current.push(marker);
      });

      if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else if (bounds.length > 1 && !selectedJobId) {
        try {
          map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 14 });
        } catch {
          // ignore fit-bounds errors
        }
      }
    });

    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, jobs, selectedJobId]);

  return null;
}
