'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DriverLocation } from '@/types';

interface LiveMapProps {
  driverPosition: DriverLocation | null;
  destinationLat: number;
  destinationLng: number;
  route?: DriverLocation[];
  isConnected: boolean;
}

/**
 * Enhanced Leaflet map with driver marker, destination, and route
 * Note: This is a canvas-based implementation without external dependencies
 * In production, integrate with actual Leaflet library
 */
export function LiveMap({
  driverPosition,
  destinationLat,
  destinationLng,
  route = [],
  isConnected,
}: LiveMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecenter, setIsRecenter] = useState(false);
  const [zoom, setZoom] = useState(15);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Simplified map projection (Web Mercator)
  const latLngToPixel = (lat: number, lng: number, centerLat: number, centerLng: number, width: number, height: number) => {
    const scale = Math.pow(2, zoom) * 256 / (2 * Math.PI);
    const x = (lng - centerLng) * scale + width / 2 + panOffset.x;
    const y = (centerLat - lat) * scale * Math.cos((centerLat * Math.PI) / 180) + height / 2 + panOffset.y;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setIsRecenter(true);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleRecenter = () => {
    setPanOffset({ x: 0, y: 0 });
    setZoom(15);
    setIsRecenter(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(5, Math.min(20, prev + (e.deltaY > 0 ? -1 : 1))));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    // Determine center point
    const centerLat = driverPosition?.latitude || destinationLat;
    const centerLng = driverPosition?.longitude || destinationLng;

    // Fill background
    ctx.fillStyle = '#1a1a1a'; // Dark tile color
    ctx.fillRect(0, 0, width, height);

    // Draw grid pattern (fake map)
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i <= height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Draw route polyline
    if (route.length > 1) {
      ctx.strokeStyle = '#3b82f6'; // Solid blue for completed
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const firstPoint = latLngToPixel(route[0].latitude, route[0].longitude, centerLat, centerLng, width, height);
      ctx.moveTo(firstPoint.x, firstPoint.y);

      for (let i = 1; i < route.length; i++) {
        const point = latLngToPixel(route[i].latitude, route[i].longitude, centerLat, centerLng, width, height);
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }

    // Draw destination marker with pulse animation
    const destPixel = latLngToPixel(destinationLat, destinationLng, centerLat, centerLng, width, height);
    const time = Date.now() / 1000;
    const pulseRadius = 20 + Math.sin(time * 3) * 5;

    // Pulse circle
    ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
    ctx.beginPath();
    ctx.arc(destPixel.x, destPixel.y, pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    // Destination marker
    ctx.fillStyle = '#22c55e'; // Success green
    ctx.beginPath();
    ctx.arc(destPixel.x, destPixel.y, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📍', destPixel.x, destPixel.y);

    // Draw driver marker with heading arrow
    if (driverPosition) {
      const driverPixel = latLngToPixel(driverPosition.latitude, driverPosition.longitude, centerLat, centerLng, width, height);
      const bearing = driverPosition.bearing || 0;

      // Driver circle
      ctx.fillStyle = '#f59e0b'; // Amber
      ctx.beginPath();
      ctx.arc(driverPixel.x, driverPixel.y, 16, 0, Math.PI * 2);
      ctx.fill();

      // Heading arrow
      ctx.save();
      ctx.translate(driverPixel.x, driverPixel.y);
      ctx.rotate((bearing * Math.PI) / 180);

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(-8, 8);
      ctx.lineTo(0, 4);
      ctx.lineTo(8, 8);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Connection status indicator
      ctx.fillStyle = isConnected ? '#22c55e' : '#ef4444';
      ctx.beginPath();
      ctx.arc(driverPixel.x + 10, driverPixel.y - 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw center point indicator
    ctx.strokeStyle = '#6366f1'; // Indigo
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 20, 0, Math.PI * 2);
    ctx.stroke();
  }, [driverPosition, destinationLat, destinationLng, route, zoom, panOffset, isConnected]);

  return (
    <div className="relative w-full h-full bg-wl-bg-surface rounded-lg overflow-hidden">
      {/* Canvas Map */}
      <canvas
        ref={canvasRef}
        className={cn(
          'w-full h-full cursor-grab active:cursor-grabbing',
          'touch-none'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Map Controls */}
      <div className="absolute inset-4 pointer-events-none flex flex-col justify-between">
        {/* Top Controls */}
        <div className="flex justify-between items-start pointer-events-auto">
          {/* Connection Status */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md bg-wl-bg-surface',
            'border border-wl-border-subtle'
          )}>
            <div className={cn(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-wl-success-500' : 'bg-wl-danger-500'
            )} />
            <span className="text-xs font-medium text-wl-text-primary">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Zoom Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => setZoom((z) => Math.min(20, z + 1))}
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-md',
                'bg-wl-bg-surface border border-wl-border-subtle',
                'text-wl-text-primary text-lg',
                'hover:bg-wl-bg-elevated transition-colors'
              )}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(5, z - 1))}
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-md',
                'bg-wl-bg-surface border border-wl-border-subtle',
                'text-wl-text-primary text-lg',
                'hover:bg-wl-bg-elevated transition-colors'
              )}
              aria-label="Zoom out"
            >
              −
            </button>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="flex justify-between items-end">
          {/* Legend */}
          <div className="text-xs text-wl-text-secondary space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-wl-warning-500" />
              <span>Driver</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-wl-success-500" />
              <span>Destination</span>
            </div>
          </div>

          {/* Recenter Button */}
          {isRecenter && (
            <button
              onClick={handleRecenter}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md',
                'bg-wl-primary-500 text-wl-text-inverse',
                'hover:bg-wl-primary-600 transition-colors',
                'text-sm font-medium'
              )}
            >
              <RotateCw className="w-4 h-4" />
              Recenter
            </button>
          )}
        </div>
      </div>

      {/* Geofence Circle Indicator */}
      {driverPosition && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-xs text-wl-text-secondary">
            Zoom: {zoom}x
          </div>
        </div>
      )}
    </div>
  );
}
