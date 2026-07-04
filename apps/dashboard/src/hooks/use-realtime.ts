"use client";
import { useState, useEffect, useCallback, useRef } from "react";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface RealtimeMessage {
  channel: string;
  event: string;
  data: any;
  ts: number;
}

interface UseRealtimeOptions {
  channels?: string[];
  onMessage?: (msg: RealtimeMessage) => void;
  enabled?: boolean;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { channels = ["notifications"], onMessage, enabled = true } = options;
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (!enabled) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/v4/ws`;

    try {
      setStatus("connecting");
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        // Subscribe to channels
        ws.send(JSON.stringify({ type: "subscribe", channels }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as RealtimeMessage;
          setLastMessage(msg);
          onMessage?.(msg);
        } catch {}
      };

      ws.onclose = () => {
        setStatus("disconnected");
        // Auto-reconnect after 3s
        reconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => setStatus("error");
    } catch {
      setStatus("error");
      // Fallback to SSE
      connectSSE();
    }
  }, [enabled, channels, onMessage]);

  const connectSSE = useCallback(() => {
    const eventSource = new EventSource("/api/v4/events");
    eventSource.onopen = () => setStatus("connected");
    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setLastMessage(msg);
        onMessage?.(msg);
      } catch {}
    };
    eventSource.onerror = () => setStatus("error");
  }, [onMessage]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    clearTimeout(reconnectRef.current);
    setStatus("disconnected");
  }, []);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { status, lastMessage, send, disconnect, reconnect: connect };
}

// Channel-specific hooks
export function useOrderUpdates(onUpdate?: (order: any) => void) {
  return useRealtime({
    channels: ["orders"],
    onMessage: (msg) => {
      if (msg.event === "order:updated" || msg.event === "order:created") {
        onUpdate?.(msg.data);
      }
    },
  });
}

export function useDriverLocations(onUpdate?: (location: any) => void) {
  return useRealtime({
    channels: ["drivers"],
    onMessage: (msg) => {
      if (msg.event === "driver:location") {
        onUpdate?.(msg.data);
      }
    },
  });
}

export function useNotificationStream(
  onNotification?: (notification: any) => void,
) {
  return useRealtime({
    channels: ["notifications"],
    onMessage: (msg) => {
      if (msg.channel === "notifications") {
        onNotification?.(msg.data);
      }
    },
  });
}
