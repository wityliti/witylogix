"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

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

interface ApiShipment {
  id: string;
  trackingNumber?: string | null;
  orderId: string;
  status: string;
  carrier?: string | null;
  estimatedArrival?: string | null;
  deliveryDate?: string | null;
  recipientName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
  weight?: number | null;
  dimensions?: { length: number; width: number; height: number } | null;
  deliveryMethod?: string | null;
  location?: { name: string; city: string } | null;
  activityLogs?: Array<{
    id: string;
    timestamp: string;
    description: string;
    status?: string | null;
    location?: string | null;
  }>;
}

interface UseShipmentTrackingReturn {
  trackingData: TrackingData | null;
  events: TrackingEvent[];
  status: "idle" | "loading" | "success" | "error";
  eta: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

function mapShipmentToTrackingData(s: ApiShipment): TrackingData {
  const address = [s.addressLine1, s.city, s.province, s.postalCode]
    .filter(Boolean)
    .join(", ");
  return {
    trackingNumber: s.trackingNumber ?? s.id,
    orderId: s.orderId,
    carrier: s.carrier ?? "Witylogix",
    currentStatus: s.status,
    eta: s.estimatedArrival ?? s.deliveryDate ?? null,
    lastLocation: s.city ?? s.location?.city ?? "",
    origin: s.location?.name ?? "Warehouse",
    destination: s.city ?? "",
    recipientName: s.recipientName ?? "",
    recipientAddress: address,
    weight: s.weight ?? 0,
    dimensions: s.dimensions ?? { length: 0, width: 0, height: 0 },
    serviceLevel: s.deliveryMethod ?? "Standard",
  };
}

function mapLogsToEvents(
  logs: NonNullable<ApiShipment["activityLogs"]>,
): TrackingEvent[] {
  return logs.map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    location: log.location ?? "",
    description: log.description,
    status: log.status ?? "info",
    icon: "📦",
  }));
}

export function useShipmentTracking(
  trackingNumber: string,
): UseShipmentTrackingReturn {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchTrackingData = useCallback(async () => {
    if (!trackingNumber) return;

    setStatus("loading");
    setError(null);

    try {
      const response = await fetch(`/api/tracking/${trackingNumber}`);
      if (!response.ok) throw new Error("Failed to fetch tracking data");

      const result = await response.json();
      const shipment = result.data?.[0];
      if (!shipment) {
        throw new Error("Tracking number not found");
      }

      // Fetch full detail (includes activityLogs)
      const detail = await api.get<{ data: ApiShipment }>(
        `/api/v4/shipments/${shipment.id}`,
      );

      setTrackingData(mapShipmentToTrackingData(detail.data));
      setEvents(mapLogsToEvents(detail.data.activityLogs ?? []));
      setStatus("success");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load tracking data";
      setError(errorMessage);
      setStatus("error");
    }
  }, [trackingNumber]);

  const subscribeToUpdates = useCallback(() => {
    if (!trackingNumber) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
    try {
      wsRef.current = new WebSocket(`${wsUrl}/ws/tracking/${trackingNumber}`);

      wsRef.current.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data as string) as {
            shipment?: Partial<TrackingData>;
            events?: TrackingEvent[];
          };
          if (update.shipment) {
            setTrackingData((prev) =>
              prev ? { ...prev, ...update.shipment } : null,
            );
          }
          if (update.events) {
            setEvents(update.events);
          }
        } catch {
          // Ignore malformed WS messages
        }
      };

      wsRef.current.onerror = () => {
        // WS not available; polling via refetch is the fallback
      };

      wsRef.current.onclose = () => {
        const t = setTimeout(subscribeToUpdates, 10_000);
        return () => clearTimeout(t);
      };
    } catch {
      // WebSocket unavailable in this environment
    }
  }, [trackingNumber]);

  useEffect(() => {
    fetchTrackingData();
    subscribeToUpdates();

    return () => {
      wsRef.current?.close();
    };
  }, [fetchTrackingData, subscribeToUpdates]);

  return {
    trackingData,
    events,
    status,
    eta: trackingData?.eta ?? null,
    isLoading: status === "loading",
    error,
    refetch: fetchTrackingData,
  };
}
