/**
 * useRealtime — React hook for WebSocket real-time dashboard connections.
 *
 * Manages connection lifecycle, room subscriptions, event handling,
 * and reconnection with exponential backoff.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  DashboardEvent,
  EventEnvelope,
  EventFilter,
  RoomId,
  ConnectionStatus,
} from "@witylogix/core/realtime/types";

/**
 * Configuration for useRealtime hook.
 */
export interface UseRealtimeConfig {
  /** WebSocket URL (default: current origin + "/realtime"). */
  url?: string;
  /** Authentication token (JWT). */
  token: string;
  /** Auto-reconnect on disconnect. */
  autoReconnect?: boolean;
  /** Max reconnection attempts (default: 5). */
  maxReconnectAttempts?: number;
  /** Initial backoff delay in ms (default: 1000). */
  initialBackoffMs?: number;
  /** Maximum backoff delay in ms (default: 30000). */
  maxBackoffMs?: number;
}

/**
 * Return type for useRealtime hook.
 */
export interface UseRealtimeReturn {
  /** Current connection status. */
  status: ConnectionStatus;
  /** Subscribe to room with optional filter. */
  subscribe: (roomId: RoomId, filter?: EventFilter) => Promise<void>;
  /** Unsubscribe from room. */
  unsubscribe: (roomId: RoomId) => Promise<void>;
  /** On event handler. */
  onEvent: (callback: (event: EventEnvelope) => void) => void;
  /** Off event handler. */
  offEvent: (callback: (event: EventEnvelope) => void) => void;
  /** Event buffer for manual consumption. */
  eventBuffer: EventEnvelope[];
  /** Last received event ID (for replay). */
  lastEventId?: string;
  /** Manual disconnect. */
  disconnect: () => void;
  /** Get last error message. */
  lastError?: string;
  /** Latency in milliseconds. */
  latency: number;
}

/**
 * Hook for real-time WebSocket connections to dashboard.
 *
 * @param roomId Initial room to subscribe to.
 * @param filter Optional event filter.
 * @param config Configuration options.
 * @returns Hook API.
 */
export function useRealtime(
  roomId: RoomId,
  filter?: EventFilter,
  config?: UseRealtimeConfig
): UseRealtimeReturn {
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const backoffRef = useRef(config?.initialBackoffMs ?? 1000);
  const subscriptionTimeoutRef = useRef<NodeJS.Timer | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [eventBuffer, setEventBuffer] = useState<EventEnvelope[]>([]);
  const [lastEventId, setLastEventId] = useState<string | undefined>();
  const [lastError, setLastError] = useState<string | undefined>();
  const [latency, setLatency] = useState(0);

  const eventCallbacksRef = useRef<((event: EventEnvelope) => void)[]>([]);

  const url = config?.url ?? `${window.location.origin}/realtime`;
  const token = config?.token;
  const autoReconnect = config?.autoReconnect ?? true;
  const maxReconnectAttempts = config?.maxReconnectAttempts ?? 5;
  const maxBackoffMs = config?.maxBackoffMs ?? 30000;

  /**
   * Initialize socket connection.
   */
  const initializeSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

    setStatus("connecting");

    const socket = io(url, {
      auth: { token },
      reconnection: autoReconnect,
      reconnectionDelay: backoffRef.current,
      reconnectionDelayMax: maxBackoffMs,
      transports: ["websocket", "polling"],
    });

    // Connection established
    socket.on("connect", () => {
      console.log("[useRealtime] Connected");
      setStatus("connected");
      setLastError(undefined);
      reconnectAttemptRef.current = 0;
      backoffRef.current = config?.initialBackoffMs ?? 1000;

      // Subscribe to initial room
      socket.emit("subscribe", roomId, filter, (ack: any) => {
        if (ack?.error) {
          setLastError(ack.error);
        }
      });
    });

    // Connection error
    socket.on("connect_error", (error) => {
      console.error("[useRealtime] Connection error:", error);
      setStatus("error");
      setLastError(error.message);
    });

    // Disconnected
    socket.on("disconnect", () => {
      console.log("[useRealtime] Disconnected");
      setStatus("disconnected");
    });

    // Reconnecting
    socket.on("reconnect_attempt", () => {
      setStatus("reconnecting");
      reconnectAttemptRef.current += 1;

      if (
        maxReconnectAttempts &&
        reconnectAttemptRef.current > maxReconnectAttempts
      ) {
        socket.disconnect();
        setLastError(
          `Max reconnection attempts (${maxReconnectAttempts}) exceeded`
        );
      }

      // Update backoff
      backoffRef.current = Math.min(
        backoffRef.current * 2,
        maxBackoffMs
      );
    });

    // Event received
    socket.on("event", (envelope: EventEnvelope) => {
      setLastEventId(envelope.id);
      setEventBuffer((prev) => {
        const updated = [...prev, envelope];
        // Keep buffer size reasonable
        return updated.slice(-100);
      });

      // Trigger callbacks
      for (const callback of eventCallbacksRef.current) {
        try {
          callback(envelope);
        } catch (error) {
          console.error("[useRealtime] Event callback error:", error);
        }
      }
    });

    // Replay complete
    socket.on("replay_complete", (data) => {
      console.log(
        `[useRealtime] Replay complete for ${data.roomId}: ${data.eventCount} events`
      );
    });

    // Subscribed to room
    socket.on("subscribed", (data) => {
      console.log(`[useRealtime] Subscribed to ${data.roomId}`);
    });

    // Unsubscribed from room
    socket.on("unsubscribed", (data) => {
      console.log(`[useRealtime] Unsubscribed from ${data.roomId}`);
    });

    // Heartbeat acknowledgment
    socket.on("heartbeat_ack", (data) => {
      setLatency(data.latency ?? 0);
    });

    // Server error
    socket.on("error", (error) => {
      console.error("[useRealtime] Server error:", error);
      setLastError(error);
    });

    socketRef.current = socket;
  }, [url, token, autoReconnect, maxReconnectAttempts, maxBackoffMs, roomId, filter, config?.initialBackoffMs]);

  /**
   * Subscribe to a room.
   */
  const subscribe = useCallback(
    async (room: RoomId, eventFilter?: EventFilter) => {
      if (!socketRef.current?.connected) {
        throw new Error("Socket not connected");
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Subscribe timeout"));
        }, 10000);

        socketRef.current?.once("subscribed", (data) => {
          clearTimeout(timeout);
          if (data.roomId === room) {
            resolve();
          }
        });

        socketRef.current?.emit("subscribe", room, eventFilter);
      });
    },
    []
  );

  /**
   * Unsubscribe from a room.
   */
  const unsubscribe = useCallback(
    async (room: RoomId) => {
      if (!socketRef.current?.connected) {
        throw new Error("Socket not connected");
      }

      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 5000);

        socketRef.current?.once("unsubscribed", (data) => {
          clearTimeout(timeout);
          if (data.roomId === room) {
            resolve();
          }
        });

        socketRef.current?.emit("unsubscribe", room);
      });
    },
    []
  );

  /**
   * Register event callback.
   */
  const onEvent = useCallback((callback: (event: EventEnvelope) => void) => {
    eventCallbacksRef.current.push(callback);
  }, []);

  /**
   * Unregister event callback.
   */
  const offEvent = useCallback((callback: (event: EventEnvelope) => void) => {
    eventCallbacksRef.current = eventCallbacksRef.current.filter(
      (cb) => cb !== callback
    );
  }, []);

  /**
   * Manual disconnect.
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  /**
   * Send periodic heartbeats.
   */
  useEffect(() => {
    if (status !== "connected") return;

    const heartbeatInterval = setInterval(() => {
      socketRef.current?.emit("heartbeat");
    }, 30000); // 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [status]);

  /**
   * Initialize socket on mount.
   */
  useEffect(() => {
    initializeSocket();

    return () => {
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
      }
    };
  }, [initializeSocket]);

  /**
   * Cleanup on unmount.
   */
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    subscribe,
    unsubscribe,
    onEvent,
    offEvent,
    eventBuffer,
    lastEventId,
    disconnect,
    lastError,
    latency,
  };
}
