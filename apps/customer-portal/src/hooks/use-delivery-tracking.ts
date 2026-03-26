'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DeliveryTracking, DriverLocation, DeliveryStep } from '@/types';

interface TrackingEvent {
  type: 'driver:location' | 'delivery:status-update' | 'delivery:eta-update';
  data: any;
  timestamp: number;
}

interface UseDeliveryTrackingOptions {
  orderId: string;
  token: string;
  autoReconnect?: boolean;
  reconnectMaxAttempts?: number;
}

interface UseDeliveryTrackingReturn {
  driverPosition: DriverLocation | null;
  deliveryStatus: DeliveryStep | null;
  eta: Date | null;
  isConnected: boolean;
  error: string | null;
  retryCount: number;
}

/**
 * WebSocket hook for real-time delivery tracking
 * Connects to /tracking namespace and listens for driver updates
 */
export function useDeliveryTracking({
  orderId,
  token,
  autoReconnect = true,
  reconnectMaxAttempts = 5,
}: UseDeliveryTrackingOptions): UseDeliveryTrackingReturn {
  const [driverPosition, setDriverPosition] = useState<DriverLocation | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStep | null>(null);
  const [eta, setEta] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculateBackoffDelay = useCallback((attempt: number) => {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    return delay + Math.random() * 1000; // Add jitter
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = new URL(
        `/tracking?orderId=${orderId}&token=${token}`,
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      );
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';

      const ws = new WebSocket(wsUrl.toString());

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        setRetryCount(0);

        // Send subscription message
        ws.send(JSON.stringify({
          type: 'subscribe',
          orderId,
          token,
        }));

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message: TrackingEvent = JSON.parse(event.data);

          switch (message.type) {
            case 'driver:location': {
              const location: DriverLocation = {
                latitude: message.data.latitude,
                longitude: message.data.longitude,
                bearing: message.data.bearing,
                speed: message.data.speed,
                timestamp: new Date(message.data.timestamp),
              };
              setDriverPosition(location);
              break;
            }

            case 'delivery:status-update': {
              const status: DeliveryStep = message.data.status;
              setDeliveryStatus(status);
              break;
            }

            case 'delivery:eta-update': {
              if (message.data.eta) {
                setEta(new Date(message.data.eta));
              }
              break;
            }
          }
        } catch (parseError) {
          console.error('Failed to parse WebSocket message:', parseError);
        }
      };

      ws.onerror = (event) => {
        setError('Connection error occurred');
        console.error('WebSocket error:', event);
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }

        // Auto-reconnect logic
        if (autoReconnect && retryCount < reconnectMaxAttempts) {
          const delay = calculateBackoffDelay(retryCount);
          reconnectTimeoutRef.current = setTimeout(() => {
            setRetryCount((prev) => prev + 1);
            connect();
          }, delay);
        } else if (retryCount >= reconnectMaxAttempts) {
          setError('Max reconnection attempts reached');
        }
      };

      wsRef.current = ws;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [orderId, token, autoReconnect, reconnectMaxAttempts, retryCount, calculateBackoffDelay]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    driverPosition,
    deliveryStatus,
    eta,
    isConnected,
    error,
    retryCount,
  };
}
