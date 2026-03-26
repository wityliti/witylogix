/**
 * Socket.io Client Hook for Dashboard
 *
 * React hook for connecting to the real-time Socket.io server.
 * Handles authentication, reconnection, and event subscriptions.
 *
 * Features:
 *   • Auto-connect with JWT token from session storage
 *   • Automatic reconnection with exponential backoff
 *   • Type-safe event listeners
 *   • Shop and entity subscriptions
 *   • Connection health monitoring
 *   • Graceful cleanup on unmount
 *
 * Usage in components:
 *
 *   function DashboardPage() {
 *     const socket = useSocket(shopId);
 *     const [shipments, setShipments] = useState([]);
 *
 *     useEffect(() => {
 *       if (!socket.isConnected) return;
 *
 *       // Subscribe to shipment events
 *       socket.subscribe("shop", (event) => {
 *         if (event.type === "shipment:created") {
 *           setShipments(prev => [...prev, event.data]);
 *         }
 *       });
 *     }, [socket.isConnected]);
 *
 *     return <div>{shipments.length} shipments</div>;
 *   }
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import type {
  ShipmentEventPayload,
  ShipmentStatusEventPayload,
  ShipmentAssignEventPayload,
  OrderEventPayload,
  OrderStatusEventPayload,
  DriverEventPayload,
  DriverLocationEventPayload,
  NotificationEventPayload,
  PaymentEventPayload,
  ActivityEventPayload,
  SystemHealthEventPayload,
  EventName,
} from "@witylogix/core/realtime";
import { EVENTS, SUBSCRIPTIONS } from "@witylogix/core/realtime";

// ─── Types ──────────────────────────────────────────────────

export interface SocketEvent {
  type: EventName;
  data:
    | ShipmentEventPayload
    | ShipmentStatusEventPayload
    | ShipmentAssignEventPayload
    | OrderEventPayload
    | OrderStatusEventPayload
    | DriverEventPayload
    | DriverLocationEventPayload
    | NotificationEventPayload
    | PaymentEventPayload
    | ActivityEventPayload
    | SystemHealthEventPayload;
  timestamp: string;
}

export interface UseSocketOptions {
  autoConnect?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
}

export interface UseSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastEvent: SocketEvent | null;
  socket: Socket | null;
  subscribe: (shopId: string) => void;
  unsubscribe: (shopId: string) => void;
  subscribeToShipment: (shipmentId: string) => void;
  subscribeToDriver: (driverId: string) => void;
  on: <T extends EventName>(
    event: T,
    callback: (data: any) => void,
  ) => () => void;
}

// ─── Hook Implementation ────────────────────────────────────

export function useSocket(shopId?: string, options: UseSocketOptions = {}): UseSocketReturn {
  const {
    autoConnect = true,
    reconnectionDelay = 1000,
    reconnectionDelayMax = 5000,
    reconnectionAttempts = 5,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<SocketEvent | null>(null);
  const listenersRef = useRef<Map<EventName, Set<Function>>>(new Map());

  // ─── Initialize Socket ──────────────────────────────────

  useEffect(() => {
    if (!autoConnect || socketRef.current) {
      return;
    }

    // Get JWT token from session storage or localStorage
    const getToken = (): string | null => {
      if (typeof window === "undefined") return null;
      return (
        sessionStorage.getItem("auth_token") || localStorage.getItem("auth_token")
      );
    };

    const token = getToken();
    if (!token) {
      setError("No authentication token found");
      return;
    }

    setIsConnecting(true);

    // Initialize Socket.io client
    const socketInstance = io(
      typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.host}`
        : "",
      {
        auth: { token },
        reconnection: true,
        reconnectionDelay,
        reconnectionDelayMax,
        reconnectionAttempts,
        transports: ["websocket", "polling"],
        closeOnBeforeunload: true,
      },
    );

    // ─── Connection Events ──────────────────────────────

    socketInstance.on("connect", () => {
      console.log("[Socket] Connected:", socketInstance.id);
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err);
      setError(err.message || "Connection error");
      setIsConnecting(false);
    });

    socketInstance.on("error", (err) => {
      console.error("[Socket] Error:", err);
      setError(typeof err === "string" ? err : "Socket error");
    });

    // ─── Event Listeners ────────────────────────────────

    // Register all event listeners
    Object.values(EVENTS).forEach((event) => {
      socketInstance.on(event, (data) => {
        const eventObj: SocketEvent = {
          type: event as EventName,
          data,
          timestamp: new Date().toISOString(),
        };

        setLastEvent(eventObj);

        // Emit to registered listeners
        const callbacks = listenersRef.current.get(event as EventName);
        if (callbacks) {
          callbacks.forEach((callback) => {
            try {
              callback(data);
            } catch (err) {
              console.error("[Socket] Listener error:", err);
            }
          });
        }
      });
    });

    socketRef.current = socketInstance;

    // ─── Cleanup ────────────────────────────────────────

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [autoConnect, reconnectionDelay, reconnectionDelayMax, reconnectionAttempts]);

  // ─── Subscribe to Shop ──────────────────────────────────

  const subscribe = useCallback((targetShopId: string) => {
    if (!socketRef.current || !socketRef.current.connected) {
      console.warn("[Socket] Not connected, cannot subscribe to shop");
      return;
    }

    socketRef.current.emit(SUBSCRIPTIONS.SUBSCRIBE_SHOP, targetShopId, (ack: boolean) => {
      if (ack) {
        console.log("[Socket] Subscribed to shop:", targetShopId);
      } else {
        console.error("[Socket] Failed to subscribe to shop:", targetShopId);
        setError(`Failed to subscribe to shop ${targetShopId}`);
      }
    });
  }, []);

  // ─── Unsubscribe from Shop ──────────────────────────────

  const unsubscribe = useCallback((targetShopId: string) => {
    if (!socketRef.current) return;

    socketRef.current.emit(
      SUBSCRIPTIONS.UNSUBSCRIBE_SHOP,
      targetShopId,
      (ack: boolean) => {
        if (ack) {
          console.log("[Socket] Unsubscribed from shop:", targetShopId);
        }
      },
    );
  }, []);

  // ─── Subscribe to Shipment ──────────────────────────────

  const subscribeToShipment = useCallback((shipmentId: string) => {
    if (!socketRef.current || !socketRef.current.connected) {
      console.warn("[Socket] Not connected, cannot subscribe to shipment");
      return;
    }

    socketRef.current.emit(SUBSCRIPTIONS.SUBSCRIBE_SHIPMENT, shipmentId, (ack: boolean) => {
      if (ack) {
        console.log("[Socket] Subscribed to shipment:", shipmentId);
      } else {
        console.error("[Socket] Failed to subscribe to shipment:", shipmentId);
      }
    });
  }, []);

  // ─── Subscribe to Driver ────────────────────────────────

  const subscribeToDriver = useCallback((driverId: string) => {
    if (!socketRef.current || !socketRef.current.connected) {
      console.warn("[Socket] Not connected, cannot subscribe to driver");
      return;
    }

    socketRef.current.emit(SUBSCRIPTIONS.SUBSCRIBE_DRIVER, driverId, (ack: boolean) => {
      if (ack) {
        console.log("[Socket] Subscribed to driver:", driverId);
      } else {
        console.error("[Socket] Failed to subscribe to driver:", driverId);
      }
    });
  }, []);

  // ─── Generic Event Listener Registration ────────────────

  const on = useCallback(
    <T extends EventName,>(event: T, callback: (data: any) => void): (() => void) => {
      // Ensure the event set exists
      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());
      }

      const callbacks = listenersRef.current.get(event)!;
      callbacks.add(callback);

      // Return unsubscribe function
      return () => {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          listenersRef.current.delete(event);
        }
      };
    },
    [],
  );

  // ─── Auto-subscribe to shop if provided ─────────────────

  useEffect(() => {
    if (shopId && isConnected && socketRef.current) {
      subscribe(shopId);

      return () => {
        unsubscribe(shopId);
      };
    }
  }, [shopId, isConnected, subscribe, unsubscribe]);

  return {
    isConnected,
    isConnecting,
    error,
    lastEvent,
    socket: socketRef.current,
    subscribe,
    unsubscribe,
    subscribeToShipment,
    subscribeToDriver,
    on,
  };
}

// ─── Event Type Guards ──────────────────────────────────────

export function isShipmentCreatedEvent(
  event: SocketEvent,
): event is SocketEvent & { data: ShipmentEventPayload } {
  return event.type === EVENTS.SHIPMENT_CREATED;
}

export function isShipmentStatusChangedEvent(
  event: SocketEvent,
): event is SocketEvent & { data: ShipmentStatusEventPayload } {
  return event.type === EVENTS.SHIPMENT_STATUS_CHANGED;
}

export function isDriverLocationUpdatedEvent(
  event: SocketEvent,
): event is SocketEvent & { data: DriverLocationEventPayload } {
  return event.type === EVENTS.DRIVER_LOCATION_UPDATED;
}

export function isNotificationSentEvent(
  event: SocketEvent,
): event is SocketEvent & { data: NotificationEventPayload } {
  return event.type === EVENTS.NOTIFICATION_SENT;
}
