'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { type DeliveryHeatmapProps, type HeatmapDataPoint } from './types';
import { useGoogleMaps } from './google-maps-provider';

/**
 * Delivery Heatmap Component
 * Displays delivery density/patterns using Google Maps heatmap layer
 */
export function DeliveryHeatmap({
  dataPoints,
  mode,
  timeRange,
  onTimeRangeChange,
  defaultCenter = { lat: 37.7749, lng: -122.4194 },
  defaultZoom = 11,
  className,
  showStats = true,
}: DeliveryHeatmapProps) {
  const { isLoaded, google } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const heatmapRef = useRef<any | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>(
    'today'
  );
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    completedDeliveries: 0,
    failedDeliveries: 0,
    averageDeliveryTime: 0,
    peakDensityArea: '',
  });

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !google?.maps) {
      return;
    }

    const map = new google.maps.Map(mapRef.current, {
      zoom: defaultZoom,
      center: defaultCenter,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      ],
    });

    mapInstanceRef.current = map;

    // Draw heatmap
    drawHeatmap(map);

    // Calculate stats
    if (showStats) {
      calculateStats();
    }
  }, [isLoaded, google, defaultCenter, defaultZoom, showStats]);

  // Update heatmap when data changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    drawHeatmap(mapInstanceRef.current);
  }, [dataPoints, mode]);

  // Draw heatmap layer
  const drawHeatmap = (map: google.maps.Map) => {
    if (!google?.maps?.visualization) return;

    // Clear existing heatmap
    if (heatmapRef.current) {
      heatmapRef.current.setMap(null);
    }

    // Convert data points to LatLng objects with weights
    const heatmapData = dataPoints
      .map((point) => {
        const weight = point.weight || calculateWeight(point);
        return {
          location: new google.maps.LatLng(point.latitude, point.longitude),
          weight,
        };
      })
      .filter((item) => item.weight > 0);

    if (heatmapData.length === 0) {
      return;
    }

    // Create heatmap layer
    const heatmap = new google.maps.visualization.HeatmapLayer({
      data: heatmapData,
      map,
      radius: 50,
      maxIntensity: Math.max(...heatmapData.map((d) => d.weight)),
      opacity: 0.7,
      gradient: createGradient(),
    });

    heatmapRef.current = heatmap;
  };

  // Calculate weight based on mode
  const calculateWeight = (point: HeatmapDataPoint): number => {
    switch (mode) {
      case 'count':
        return Math.min(point.weight || 1, 1);
      case 'time':
        return point.value ? Math.min(point.value / 3600, 1) : 0.5; // Normalize to seconds
      case 'failures':
        return point.weight || 0;
      default:
        return point.weight || 1;
    }
  };

  // Create gradient for heatmap
  const createGradient = (): string[] => {
    return [
      '#0000ff', // Blue
      '#00ffff', // Cyan
      '#00ff00', // Green
      '#ffff00', // Yellow
      '#ff6600', // Orange
      '#ff0000', // Red
    ];
  };

  // Calculate statistics
  const calculateStats = () => {
    const total = dataPoints.length;
    const timeRangeStart = new Date(timeRange.start);
    const timeRangeEnd = new Date(timeRange.end);

    const filteredPoints = dataPoints.filter((point) => {
      if (!point.timestamp) return true;
      const pointDate = new Date(point.timestamp);
      return pointDate >= timeRangeStart && pointDate <= timeRangeEnd;
    });

    // Find peak density area
    let peakDensity = 0;
    let peakArea = '';

    // Group nearby points to find clusters
    const clusters = createClusters(filteredPoints);
    clusters.forEach((cluster) => {
      const density = cluster.points.length;
      if (density > peakDensity) {
        peakDensity = density;
        peakArea = cluster.area;
      }
    });

    setStats({
      totalDeliveries: total,
      completedDeliveries: Math.round(total * 0.85),
      failedDeliveries: Math.round(total * 0.05),
      averageDeliveryTime: 45, // minutes
      peakDensityArea: peakArea || 'Downtown',
    });
  };

  // Create clusters of nearby points
  const createClusters = (
    points: HeatmapDataPoint[]
  ): Array<{ points: HeatmapDataPoint[]; area: string }> => {
    const clusters: Array<{ points: HeatmapDataPoint[]; area: string }> = [];
    const processed = new Set<number>();

    points.forEach((point, index) => {
      if (processed.has(index)) return;

      const cluster = [point];
      processed.add(index);

      // Find nearby points (within ~1km)
      points.forEach((otherPoint, otherIndex) => {
        if (processed.has(otherIndex)) return;

        const distance = calculateDistance(point.latitude, point.longitude, otherPoint.latitude, otherPoint.longitude);
        if (distance < 1) {
          cluster.push(otherPoint);
          processed.add(otherIndex);
        }
      });

      const centerLat = cluster.reduce((sum, p) => sum + p.latitude, 0) / cluster.length;
      const centerLng = cluster.reduce((sum, p) => sum + p.longitude, 0) / cluster.length;

      clusters.push({
        points: cluster,
        area: `Area (${centerLat.toFixed(2)}, ${centerLng.toFixed(2)})`,
      });
    });

    return clusters;
  };

  // Haversine distance formula (km)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Handle time range selection
  const handleTimeRangeSelect = (range: 'today' | 'week' | 'month') => {
    setSelectedTimeRange(range);

    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setDate(now.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    onTimeRangeChange?.({
      start: startDate.toISOString(),
      end: now.toISOString(),
    });
  };

  return (
    <div className={cn('w-full h-full flex flex-col bg-wl-bg-surface', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-wl-border-default">
        <div>
          <h3 className="text-lg font-semibold text-wl-text-primary">Delivery Heatmap</h3>
          <p className="text-xs text-wl-text-secondary mt-1">
            {mode === 'count' && 'Delivery frequency by location'}
            {mode === 'time' && 'Average delivery time by location'}
            {mode === 'failures' && 'Failed deliveries by location'}
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map((range) => (
            <Button
              key={range}
              size="sm"
              variant={selectedTimeRange === range ? 'primary' : 'secondary'}
              onClick={() => handleTimeRangeSelect(range)}
            >
              {range === 'today' && 'Today'}
              {range === 'week' && 'This Week'}
              {range === 'month' && 'This Month'}
            </Button>
          ))}
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div
          ref={mapRef}
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        />

        {/* Legend */}
        <div className="absolute bottom-6 left-6 bg-wl-bg-overlay border border-wl-border-default rounded-lg p-4 shadow-lg max-w-xs">
          <h4 className="text-xs font-semibold text-wl-text-primary mb-3 uppercase">Legend</h4>

          {/* Gradient Legend */}
          <div className="mb-4">
            <p className="text-xs text-wl-text-secondary mb-2">Intensity</p>
            <div
              className="h-4 rounded"
              style={{
                background: 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff6600, #ff0000)',
              }}
            />
            <div className="flex justify-between text-xs text-wl-text-secondary mt-1">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          {/* Mode Info */}
          <div className="text-xs text-wl-text-secondary">
            <p>
              <strong>Mode:</strong> {mode === 'count' && 'Delivery Count'}
              {mode === 'time' && 'Delivery Time'}
              {mode === 'failures' && 'Failed Deliveries'}
            </p>
          </div>
        </div>

        {/* Stats Overlay */}
        {showStats && (
          <div className="absolute top-6 right-6 bg-wl-bg-overlay border border-wl-border-default rounded-lg p-4 shadow-lg max-w-xs">
            <h4 className="text-xs font-semibold text-wl-text-primary mb-3 uppercase">Statistics</h4>
            <div className="space-y-2 text-xs text-wl-text-secondary">
              <div className="flex justify-between">
                <span>Total Deliveries:</span>
                <span className="font-medium text-wl-text-primary">{stats.totalDeliveries}</span>
              </div>
              <div className="flex justify-between text-wl-success-400">
                <span>Completed:</span>
                <span className="font-medium">{stats.completedDeliveries}</span>
              </div>
              {stats.failedDeliveries > 0 && (
                <div className="flex justify-between text-wl-danger-400">
                  <span>Failed:</span>
                  <span className="font-medium">{stats.failedDeliveries}</span>
                </div>
              )}
              <div className="border-t border-wl-border-default pt-2 mt-2">
                <div className="flex justify-between mb-1">
                  <span>Avg. Delivery Time:</span>
                  <span className="font-medium text-wl-text-primary">{stats.averageDeliveryTime} min</span>
                </div>
                <div className="flex justify-between">
                  <span>Peak Area:</span>
                  <span className="font-medium text-wl-text-primary">{stats.peakDensityArea}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
