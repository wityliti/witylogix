'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { type RouteMapViewerProps, type DeliveryRoute, type RouteStop } from './types';
import { useGoogleMaps } from './google-maps-provider';

/**
 * Status color mapping
 */
const STATUS_COLORS: Record<string, string> = {
  pending: '#fbbf24',
  completed: '#10b981',
  failed: '#ef4444',
  skipped: '#6b7280',
};

const STOP_STATUS_BADGES: Record<string, 'warning' | 'success' | 'danger' | 'info'> = {
  pending: 'warning',
  completed: 'success',
  failed: 'danger',
  skipped: 'info',
};

/**
 * Route Map Viewer Component
 * Displays a delivery route with stops, polylines, and markers
 */
export function RouteMapViewer({
  route,
  onStopClick,
  showActualRoute = false,
  defaultCenter,
  defaultZoom = 12,
  className,
}: RouteMapViewerProps) {
  const { isLoaded, google } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);
  const [displayActualRoute, setDisplayActualRoute] = useState(showActualRoute);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !google?.maps) {
      return;
    }

    const center = defaultCenter || {
      lat: route.stops[0]?.latitude || 37.7749,
      lng: route.stops[0]?.longitude || -122.4194,
    };

    const map = new google.maps.Map(mapRef.current, {
      zoom: defaultZoom,
      center,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      ],
    });

    mapInstanceRef.current = map;

    // Draw route
    drawRoute(map);
    drawStops(map);
    drawCurrentLocation(map);

    // Fit bounds to show full route
    fitBounds(map);
  }, [isLoaded, google, route, defaultCenter, defaultZoom]);

  // Update actual route display
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing polylines
    polylinesRef.current.forEach((polyline) => polyline.setMap(null));
    polylinesRef.current = [];

    // Draw route (planned or actual)
    drawRoute(mapInstanceRef.current);
  }, [displayActualRoute, route]);

  // Draw planned or actual route polyline
  const drawRoute = (map: google.maps.Map) => {
    if (!google?.maps) return;

    const pathToUse = displayActualRoute ? route.actualPath : route.plannedPath;

    if (!pathToUse) {
      // Fallback: draw line through stops
      const stopCoordinates = route.stops.map((stop) => ({
        lat: stop.latitude,
        lng: stop.longitude,
      }));

      const polyline = new google.maps.Polyline({
        path: stopCoordinates,
        geodesic: true,
        strokeColor: '#2563eb',
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map,
      });

      polylinesRef.current.push(polyline);
      return;
    }

    let coordinates: Array<{ lat: number; lng: number }>;

    if (displayActualRoute && 'timestamp' in pathToUse[0]) {
      // Actual path (with timestamps)
      coordinates = (
        pathToUse as Array<{ lat: number; lng: number; timestamp: string }>
      ).map((point) => ({
        lat: point.lat,
        lng: point.lng,
      }));
    } else {
      // Planned path (GeoJSON-style)
      const coords = pathToUse.coordinates;
      if (pathToUse.type === 'LineString') {
        coordinates = (coords as Array<[number, number]>).map(([lng, lat]) => ({
          lat,
          lng,
        }));
      } else {
        return; // Unsupported geometry type
      }
    }

    const polyline = new google.maps.Polyline({
      path: coordinates,
      geodesic: true,
      strokeColor: displayActualRoute ? '#8b5cf6' : '#2563eb',
      strokeOpacity: 0.7,
      strokeWeight: 3,
      map,
    });

    polylinesRef.current.push(polyline);
  };

  // Draw stop markers
  const drawStops = (map: google.maps.Map) => {
    if (!google?.maps) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    route.stops.forEach((stop, index) => {
      const marker = new google.maps.Marker({
        position: { lat: stop.latitude, lng: stop.longitude },
        map,
        title: `Stop ${index + 1}: ${stop.address}`,
        icon: createStopIcon(index + 1, stop.status),
      });

      marker.addListener('click', () => {
        setSelectedStop(stop);
        onStopClick?.(stop);
        showStopInfo(map, marker, stop, index + 1);
      });

      markersRef.current.push(marker);
    });
  };

  // Draw current location marker
  const drawCurrentLocation = (map: google.maps.Map) => {
    if (!route.currentLocation || !google?.maps) return;

    const marker = new google.maps.Marker({
      position: {
        lat: route.currentLocation.lat,
        lng: route.currentLocation.lng,
      },
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#10b981',
        fillOpacity: 0.9,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
      title: 'Current Location',
    });

    markersRef.current.push(marker);
  };

  // Create custom marker icon
  const createStopIcon = (number: number, status: string): google.maps.Icon => {
    if (!google?.maps) {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: STATUS_COLORS[status],
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      };
    }

    const color = STATUS_COLORS[status] || '#3b82f6';

    return {
      path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z',
      scale: 1.5,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    };
  };

  // Show info window for stop
  const showStopInfo = (
    map: google.maps.Map,
    marker: google.maps.Marker,
    stop: RouteStop,
    stopNumber: number
  ) => {
    if (!google?.maps) return;

    // Close previous info window
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    const content = `
      <div style="padding: 12px; max-width: 300px; font-family: system-ui, -apple-system, sans-serif;">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1f2937;">
          Stop #${stopNumber}: ${stop.customerName || 'Customer'}
        </h3>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #4b5563;">
          ${stop.address}
        </p>
        ${
          stop.timeWindow
            ? `
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">
            <strong>Time Window:</strong> ${new Date(stop.timeWindow.start).toLocaleTimeString()} - ${new Date(stop.timeWindow.end).toLocaleTimeString()}
          </p>
        `
            : ''
        }
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">
          <strong>Status:</strong> <span style="color: ${STATUS_COLORS[stop.status]}">${stop.status.toUpperCase()}</span>
        </p>
        ${
          stop.notes
            ? `<p style="margin: 0; font-size: 12px; color: #6b7280;"><strong>Notes:</strong> ${stop.notes}</p>`
            : ''
        }
      </div>
    `;

    infoWindowRef.current = new google.maps.InfoWindow({ content });
    infoWindowRef.current.open(map, marker);
  };

  // Fit map bounds to show full route
  const fitBounds = (map: google.maps.Map) => {
    if (!google?.maps || route.stops.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    route.stops.forEach((stop) => {
      bounds.extend({ lat: stop.latitude, lng: stop.longitude });
    });

    if (route.currentLocation) {
      bounds.extend({
        lat: route.currentLocation.lat,
        lng: route.currentLocation.lng,
      });
    }

    map.fitBounds(bounds);
  };

  // Calculate route summary
  const calculateSummary = () => {
    const totalStops = route.stops.length;
    const completedStops = route.stops.filter((s) => s.status === 'completed').length;
    const failedStops = route.stops.filter((s) => s.status === 'failed').length;
    const totalDistance = route.estimatedDistance || 0;
    const estimatedDuration = route.estimatedDuration || 0;

    return {
      totalStops,
      completedStops,
      failedStops,
      totalDistance: (totalDistance / 1000).toFixed(1), // km
      estimatedDuration: Math.round(estimatedDuration / 60), // minutes
    };
  };

  const summary = calculateSummary();

  return (
    <div className={cn('relative w-full h-full flex flex-col bg-wl-bg-surface', className)}>
      {/* Map */}
      <div className="flex-1 relative rounded-lg overflow-hidden shadow-lg">
        <div
          ref={mapRef}
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        />

        {/* Route Toggle Button */}
        {route.actualPath && (
          <button
            onClick={() => setDisplayActualRoute(!displayActualRoute)}
            className={cn(
              'absolute top-4 left-4 px-3 py-2 rounded-lg',
              'text-xs font-medium transition-all',
              'bg-wl-bg-overlay border border-wl-border-default',
              'hover:bg-wl-bg-elevated hover:border-wl-border-strong',
              'text-wl-text-secondary'
            )}
          >
            {displayActualRoute ? 'Planned Route' : 'Actual Route'}
          </button>
        )}

        {/* Summary Panel */}
        <div className="absolute bottom-4 right-4 bg-wl-bg-overlay border border-wl-border-default rounded-lg p-4 shadow-lg max-w-xs">
          <h4 className="text-sm font-semibold text-wl-text-primary mb-3">Route Summary</h4>
          <div className="space-y-2 text-xs text-wl-text-secondary">
            <div className="flex justify-between">
              <span>Total Stops:</span>
              <span className="font-medium text-wl-text-primary">{summary.totalStops}</span>
            </div>
            <div className="flex justify-between">
              <span>Completed:</span>
              <span className="font-medium text-wl-success-400">{summary.completedStops}</span>
            </div>
            {summary.failedStops > 0 && (
              <div className="flex justify-between">
                <span>Failed:</span>
                <span className="font-medium text-wl-danger-400">{summary.failedStops}</span>
              </div>
            )}
            <div className="border-t border-wl-border-default pt-2 mt-2">
              <div className="flex justify-between mb-1">
                <span>Distance:</span>
                <span className="font-medium text-wl-text-primary">{summary.totalDistance} km</span>
              </div>
              <div className="flex justify-between">
                <span>Est. Duration:</span>
                <span className="font-medium text-wl-text-primary">{summary.estimatedDuration} min</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stops List */}
      <div className="mt-4 p-4 bg-wl-bg-overlay rounded-lg border border-wl-border-default">
        <h4 className="text-sm font-semibold text-wl-text-primary mb-3">Stops</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-h-24 overflow-y-auto">
          {route.stops.map((stop, index) => (
            <button
              key={stop.id}
              onClick={() => {
                setSelectedStop(stop);
                onStopClick?.(stop);
              }}
              className={cn(
                'p-3 rounded-lg text-left transition-all text-xs',
                selectedStop?.id === stop.id
                  ? 'bg-wl-primary-500/20 border border-wl-primary-500'
                  : 'bg-wl-bg-surface border border-wl-border-default hover:border-wl-border-strong'
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-semibold text-wl-text-primary">Stop {index + 1}</span>
                <Badge variant={STOP_STATUS_BADGES[stop.status]} className="text-xs px-1.5">
                  {stop.status}
                </Badge>
              </div>
              <p className="text-wl-text-secondary line-clamp-2">{stop.address}</p>
              {stop.customerName && (
                <p className="text-wl-text-secondary mt-1">{stop.customerName}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
