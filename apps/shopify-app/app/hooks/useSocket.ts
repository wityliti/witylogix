/**
 * useSocket — Socket.io connection manager for real-time updates.
 *
 * Connects to the Witylogix API WebSocket server and provides
 * a typed event subscription API. Used for:
 *   - Activity timeline on Dashboard
 *   - Driver location updates on Drivers map
 *   - Route optimization results
 *   - Order status changes
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { Socket } from "socket.io-client";

interface UseSocketOptions {
  /** Socket.io namespace (e.g., "/admin", "/tracking"). */
  namespace?: string;
  /** Authentication token to send on connect. */
  token?: string;
  /** Room to join after connecting. */
  room?: string;
  /** Auto-connect on mount. Default: true. */
  autoConnect?: boolean;
}

interface UseSocketResult {
  isConnected: boolean;
  socket: Socket | null;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
}

function readSocketUrl(): string {
  if (typeof window === "undefined") return "http://localhost:8000";
  return (
    (window as unknown as Record<string, string>).__SOCKET_URL ??
    "http://localhost:8000"
  );
}

export function useSocket(options: UseSocketOptions = {}): UseSocketResult {
  const { namespace = "", token, room, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!autoConnect || typeof window === "undefined") return;

    // Dynamic import to avoid SSR issues
    let cancelled = false;
    (async () => {
      const { io } = await import("socket.io-client");
      if (cancelled) return;

      const socketUrl = readSocketUrl();
      const socket = io(`${socketUrl}${namespace}`, {
        auth: token ? { token } : undefined,
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        if (room) socket.emit("join", room);
      });

      socket.on("disconnect", () => setIsConnected(false));
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [namespace, token, room, autoConnect]);

  const on = useCallback(
    (event: string, handler: (...args: unknown[]) => void) => {
      socketRef.current?.on(event, handler);
    },
    [],
  );

  const off = useCallback(
    (event: string, handler: (...args: unknown[]) => void) => {
      socketRef.current?.off(event, handler);
    },
    [],
  );

  const emit = useCallback((event: string, ...args: unknown[]) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  return { isConnected, socket: socketRef.current, on, off, emit };
}
