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
const SOCKET_URL = typeof window !== "undefined"
    ? window.__SOCKET_URL ?? "http://localhost:8000"
    : "http://localhost:8000";
export function useSocket(options = {}) {
    const { namespace = "", token, room, autoConnect = true } = options;
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(null);
    useEffect(() => {
        if (!autoConnect || typeof window === "undefined")
            return;
        // Dynamic import to avoid SSR issues
        let cancelled = false;
        (async () => {
            const { io } = await import("socket.io-client");
            if (cancelled)
                return;
            const socket = io(`${SOCKET_URL}${namespace}`, {
                auth: token ? { token } : undefined,
                transports: ["websocket", "polling"],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 10,
            });
            socketRef.current = socket;
            socket.on("connect", () => {
                setIsConnected(true);
                if (room)
                    socket.emit("join", room);
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
    const on = useCallback((event, handler) => {
        socketRef.current?.on(event, handler);
    }, []);
    const off = useCallback((event, handler) => {
        socketRef.current?.off(event, handler);
    }, []);
    const emit = useCallback((event, ...args) => {
        socketRef.current?.emit(event, ...args);
    }, []);
    return { isConnected, socket: socketRef.current, on, off, emit };
}
//# sourceMappingURL=useSocket.js.map