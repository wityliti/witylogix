'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TrackingEvent {
  id: string;
  timestamp: string;
  location: string;
  description: string;
  status: string;
  icon: string;
}

export interface TrackingData {
  trackingNumber: string;
  orderId: string;
  carrier: string;
  currentStatus: string;
  eta: string | null;
  lastLocation: string;
  origin: string;
  destination: string;
  recipientName: string;
  recipientAddress: string;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  serviceLevel: string;
  signature?: string;
  proofOfDelivery?: string[];
}

interface UseShipmentTrackingReturn {
  trackingData: TrackingData | null;
  events: TrackingEvent[];
  status: 'idle' | 'loading' | 'success' | 'error';
  eta: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useShipmentTracking(trackingNumber: string): UseShipmentTrackingReturn {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchTrackingData = useCallback(async () => {
    if (!trackingNumber) return;

    setStatus('loading');
    setError(null);

    try {
      // Mock API call - replace with actual endpoint
      const response = await fetch(`/api/tracking/${trackingNumber}`);
      if (!response.ok) throw new Error('Failed to fetch tracking data');

      const data = await response.json();
      setTrackingData(data.shipment);
      setEvents(data.events || []);
      setStatus('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setStatus('error');

      // Generate mock data for demo
      setTrackingData({
        trackingNumber,
        orderId: `ORD-${Math.random().toString(36).substring(7).toUpperCase()}`,
        carrier: ['FedEx', 'UPS', 'DHL'][Math.floor(Math.random() * 3)],
        currentStatus: ['In Transit', 'Out for Delivery', 'Delivered'][Math.floor(Math.random() * 3)],
        eta: new Date(Date.now() + 2 * 86400000).toISOString(),
        lastLocation: 'Distribution Center, Toronto',
        origin: 'Warehouse, Vancouver',
        destination: 'Recipient Address, Toronto',
        recipientName: 'John Doe',
        recipientAddress: '123 Main St, Toronto, ON M1A 1A1',
        weight: 2.5,
        dimensions: { length: 30, width: 20, height: 15 },
        serviceLevel: 'Express',
      });

      setEvents([
        {
          id: '1',
          timestamp: new Date().toISOString(),
          location: 'Toronto, ON',
          description: 'Out for delivery',
          status: 'in_transit',
          icon: '🚚',
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
          location: 'Distribution Center',
          description: 'Package sorted and loaded',
          status: 'in_transit',
          icon: '📦',
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 6 * 3600000).toISOString(),
          location: 'Vancouver, BC',
          description: 'Package picked up',
          status: 'picked_up',
          icon: '📍',
        },
      ]);
    }
  }, [trackingNumber]);

  const subscribeToUpdates = useCallback(() => {
    if (!trackingNumber) return;

    // Mock WebSocket subscription - replace with actual endpoint
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
    try {
      wsRef.current = new WebSocket(`${wsUrl}/tracking/${trackingNumber}`);

      wsRef.current.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          setTrackingData((prev) => prev ? { ...prev, ...update.shipment } : null);
          if (update.events) {
            setEvents(update.events);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      wsRef.current.onerror = () => {
        console.warn('WebSocket error, falling back to polling');
      };

      wsRef.current.onclose = () => {
        // Attempt reconnect after 5 seconds
        setTimeout(subscribeToUpdates, 5000);
      };
    } catch (err) {
      console.warn('WebSocket unavailable, using polling instead');
    }
  }, [trackingNumber]);

  useEffect(() => {
    fetchTrackingData();
    subscribeToUpdates();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [fetchTrackingData, subscribeToUpdates]);

  return {
    trackingData,
    events,
    status,
    eta: trackingData?.eta || null,
    isLoading: status === 'loading',
    error,
    refetch: fetchTrackingData,
  };
}
