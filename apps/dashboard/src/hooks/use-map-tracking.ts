/**
 * useMapTracking — React hook for real-time driver position updates via WebSocket.
 *
 * Manages WebSocket connections for live delivery tracking,
 * handling driver position updates, status changes, and delivery events.
 */

import { useCallback, useRef, useEffect, useState } from "react";
import { useRealtime } from "./use-realtime";
import type { Driver, MapTrackingEvent } from "@/components/maps/delivery-types";

/**
 * Configuration for useMapTracking hook.
 */
export interface UseMapTrackingConfig {
  /** WebSocket URL (default: current origin + "/realtime"). */
  url?: string;
  /** Authentication token (JWT). */
  token?: string;
  /** Auto-reconnect on disconnect. */
  autoReconnect?: boolean;
  /** Max reconnection attempts (default: 5). */
  maxReconnectAttempts?: number;
}

/**
 * Return type for useMapTracking hook.
 */
export interface UseMapTrackingReturn {
  /** Subscribe to tracking room. */
  subscribe: (room: string) => Promise<void>;
  /** Unsubscribe from tracking room. */
  unsubscribe: (room: string) => Promise<void>;
  /** Register position update handler. */
  onPositionUpdate: (callback: (driver: Driver) => void) => void;
  /** Register status change handler. */
  onStatusChange: (callback: (driverId: string, status: string) => void) => void;
  /** Register delivery update handler. */
  onDeliveryUpdate: (callback: (driverId: string, deliveryId: string) => void) => void;
  /** Manual disconnect. */
  disconnect: () => void;
  /** Get last error message. */
  lastError?: string;
  /** Connection latency in milliseconds. */
  latency: number;
}

/**
 * useMapTracking hook
 *
 * Provides real-time driver and delivery tracking via WebSocket.
 * Handles position updates, status changes, and delivery events.
 *
 * @example
 * const { subscribe, onPositionUpdate, disconnect } = useMapTracking();
 *
 * useEffect(() => {
 *   subscribe("tracking:active");
 *   onPositionUpdate((driver) => {
 *     console.log("Driver updated:", driver);
 *   });
 *
 *   return () => {
 *     unsubscribe("tracking:active");
 *     disconnect();
 *   };
 * }, []);
 */
export function useMapTracking(config?: UseMapTrackingConfig): UseMapTrackingReturn {
  // Use existing realtime hook
  const {
    subscribe: realtimeSubscribe,
    unsubscribe: realtimeUnsubscribe,
    onEvent,
    disconnect: realtimeDisconnect,
    lastError,
    latency,
  } = useRealtime({
    token: config?.token || "placeholder-token",
    url: config?.url,
    autoReconnect: config?.autoReconnect ?? true,
    maxReconnectAttempts: config?.maxReconnectAttempts ?? 5,
  });

  const positionUpdateCallbacks = useRef<Set<(driver: Driver) => void>>(
    new Set()
  );
  const statusChangeCallbacks = useRef<Set<(driverId: string, status: string) => void>>(
    new Set()
  );
  const deliveryUpdateCallbacks = useRef<Set<(driverId: string, deliveryId: string) => void>>(
    new Set()
  );

  // Register global event handler
  useEffect(() => {
    const handleEvent = (event: any) => {
      // Check for tracking-specific event
      if (!event.type) return;

      const trackingEvent = event as MapTrackingEvent;

      switch (trackingEvent.type) {
        case "position_update": {
          // Call position update callbacks
          positionUpdateCallbacks.current.forEach((cb) => {
            if (trackingEvent.data) {
              cb(trackingEvent.data as Driver);
            }
          });
          break;
        }

        case "status_change": {
          // Call status change callbacks
          statusChangeCallbacks.current.forEach((cb) => {
            const newStatus = trackingEvent.data?.status;
            if (newStatus) {
              cb(trackingEvent.driverId, newStatus as string);
            }
          });
          break;
        }

        case "delivery_update": {
          // Call delivery update callbacks
          deliveryUpdateCallbacks.current.forEach((cb) => {
            const deliveryId = trackingEvent.data?.currentDeliveryId;
            if (deliveryId) {
              cb(trackingEvent.driverId, deliveryId as string);
            }
          });
          break;
        }
      }
    };

    // Register event handler with realtime hook
    onEvent(handleEvent);

    return () => {
      // Cleanup handled by onEvent return
    };
  }, [onEvent]);

  // Subscribe to tracking room
  const subscribe = useCallback(
    async (room: string) => {
      try {
        await realtimeSubscribe(room);
      } catch (error) {
        console.error(`Failed to subscribe to ${room}:`, error);
        throw error;
      }
    },
    [realtimeSubscribe]
  );

  // Unsubscribe from tracking room
  const unsubscribe = useCallback(
    async (room: string) => {
      try {
        await realtimeUnsubscribe(room);
      } catch (error) {
        console.error(`Failed to unsubscribe from ${room}:`, error);
        throw error;
      }
    },
    [realtimeUnsubscribe]
  );

  // Register position update callback
  const onPositionUpdate = useCallback(
    (callback: (driver: Driver) => void) => {
      positionUpdateCallbacks.current.add(callback);

      return () => {
        positionUpdateCallbacks.current.delete(callback);
      };
    },
    []
  );

  // Register status change callback
  const onStatusChange = useCallback(
    (callback: (driverId: string, status: string) => void) => {
      statusChangeCallbacks.current.add(callback);

      return () => {
        statusChangeCallbacks.current.delete(callback);
      };
    },
    []
  );

  // Register delivery update callback
  const onDeliveryUpdate = useCallback(
    (callback: (driverId: string, deliveryId: string) => void) => {
      deliveryUpdateCallbacks.current.add(callback);

      return () => {
        deliveryUpdateCallbacks.current.delete(callback);
      };
    },
    []
  );

  return {
    subscribe,
    unsubscribe,
    onPositionUpdate,
    onStatusChange,
    onDeliveryUpdate,
    disconnect: realtimeDisconnect,
    lastError,
    latency,
  };
}
