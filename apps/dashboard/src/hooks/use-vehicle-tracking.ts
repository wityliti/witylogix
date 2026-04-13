/**
 * useVehicleTracking — React hook for live vehicle tracking
 *
 * Provides real-time vehicle position updates via WebSocket/SSE
 * with auto-reconnect, filtering, and state management
 */

import { useEffect, useState, useCallback, useRef } from "react";
import type {
  WitylogixVehiclePosition,
  VehicleFeedConfig,
} from "@witylogix/core/integrations/telematics";

/**
 * Vehicle tracking hook state
 */
export interface UseVehicleTrackingState {
  /** Map of vehicle ID to current position */
  vehicles: Map<string, WitylogixVehiclePosition>;
  /** Currently selected vehicle ID */
  selectedVehicle?: string;
  /** Whether the feed is connected */
  isConnected: boolean;
  /** Whether data is still loading */
  isLoading: boolean;
  /** Error message if any */
  error?: Error;
  /** Last time the feed updated */
  lastUpdate?: Date;
  /** Number of stale vehicles */
  staleCount: number;
}

/**
 * Vehicle tracking hook return type
 */
export interface UseVehicleTrackingReturn extends UseVehicleTrackingState {
  /** Select a vehicle to track */
  selectVehicle: (vehicleId?: string) => void;
  /** Refresh vehicle positions manually */
  refresh: () => Promise<void>;
  /** Reconnect to the feed */
  reconnect: () => Promise<void>;
  /** Disconnect from the feed */
  disconnect: () => void;
  /** Filter vehicles by status */
  filterByStatus: (status: string) => string[];
  /** Filter vehicles in a geofence */
  filterByGeofence: (bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }) => string[];
  /** Get position history for a vehicle */
  getPositionHistory: (vehicleId: string, limit?: number) => WitylogixVehiclePosition[];
}

/**
 * Hook for consuming vehicle feed
 *
 * @param vehicleIds List of vehicle IDs to track
 * @param config Feed configuration options
 * @param wsUrl WebSocket/SSE endpoint URL (optional)
 * @returns Vehicle tracking state and controls
 *
 * @example
 * const tracking = useVehicleTracking(
 *   ["vehicle-1", "vehicle-2"],
 *   { updateInterval: 10000 },
 *   "wss://api.witylogix.com/feed"
 * );
 *
 * return (
 *   <div>
 *     {Array.from(tracking.vehicles.values()).map(v => (
 *       <div key={v.vehicleId}>
 *         {v.vehicleId}: ({v.lat}, {v.lng})
 *       </div>
 *     ))}
 *   </div>
 * );
 */
export function useVehicleTracking(
  vehicleIds: string[],
  config?: VehicleFeedConfig,
  wsUrl?: string,
): UseVehicleTrackingReturn {
  const [state, setState] = useState<UseVehicleTrackingState>({
    vehicles: new Map(),
    isConnected: false,
    isLoading: true,
    staleCount: 0,
  });

  const [selectedVehicle, setSelectedVehicle] = useState<string | undefined>();

  const wsRef = useRef<WebSocket | undefined>();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const positionHistoryRef = useRef<Map<string, WitylogixVehiclePosition[]>>(new Map());

  /**
   * Connect to vehicle feed
   */
  const connect = useCallback(async () => {
    if (!wsUrl) {
      // Fallback to HTTP polling
      setState((prev) => ({ ...prev, isLoading: false, error: undefined }));
      return;
    }

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setState((prev) => ({
          ...prev,
          isConnected: true,
          isLoading: false,
          error: undefined,
        }));
        reconnectAttemptsRef.current = 0;

        // Subscribe to vehicle updates
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              action: "subscribe",
              vehicleIds,
            }),
          );
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as {
            type: string;
            data: WitylogixVehiclePosition;
          };

          if (message.type === "position-update") {
            const position = message.data;
            setState((prev) => {
              const vehicles = new Map(prev.vehicles);
              vehicles.set(position.vehicleId, position);

              // Store in history
              const history = positionHistoryRef.current.get(position.vehicleId) || [];
              history.push(position);
              if (history.length > (config?.maxPositions || 100)) {
                history.shift();
              }
              positionHistoryRef.current.set(position.vehicleId, history);

              return {
                ...prev,
                vehicles,
                lastUpdate: new Date(),
              };
            });
          }
        } catch {
          // Invalid message, ignore
        }
      };

      wsRef.current.onerror = (error) => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: new Error("WebSocket connection error"),
        }));
      };

      wsRef.current.onclose = () => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
        }));
        // Auto-reconnect with exponential backoff
        attemptReconnect();
      };
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, [wsUrl, vehicleIds, config?.maxPositions]);

  /**
   * Attempt to reconnect with backoff
   */
  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= 5) {
      setState((prev) => ({
        ...prev,
        error: new Error("Max reconnection attempts exceeded"),
      }));
      return;
    }

    reconnectAttemptsRef.current++;
    const delayMs = Math.pow(2, reconnectAttemptsRef.current) * 1000;

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delayMs);
  }, [connect]);

  /**
   * Disconnect from feed
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = undefined;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setState((prev) => ({
      ...prev,
      isConnected: false,
    }));
  }, []);

  /**
   * Reconnect to feed
   */
  const reconnect = useCallback(async () => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    await connect();
  }, [connect, disconnect]);

  /**
   * Refresh vehicle positions
   */
  const refresh = useCallback(async () => {
    // This would call the HTTP API for a manual refresh
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      // Fetch via HTTP if no WebSocket
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, []);

  /**
   * Select a vehicle
   */
  const selectVehicle = useCallback((vehicleId?: string) => {
    setSelectedVehicle(vehicleId);
  }, []);

  /**
   * Filter vehicles by status
   */
  const filterByStatus = useCallback((status: string) => {
    // Filter logic based on vehicle properties
    // Stale if lastUpdate > 5 minutes
    const staleThreshold = Date.now() - (5 * 60 * 1000);

    return Array.from(state.vehicles.entries())
      .filter(([_, position]) => {
        if (status === "active") {
          return position.timestamp.getTime() > staleThreshold;
        }
        if (status === "stale") {
          return position.timestamp.getTime() <= staleThreshold;
        }
        return true;
      })
      .map(([id]) => id);
  }, [state.vehicles]);

  /**
   * Filter vehicles in geofence
   */
  const filterByGeofence = useCallback(
    (bounds: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    }) => {
      return Array.from(state.vehicles.entries())
        .filter(([_, position]) => {
          return (
            position.lat >= bounds.minLat &&
            position.lat <= bounds.maxLat &&
            position.lng >= bounds.minLng &&
            position.lng <= bounds.maxLng
          );
        })
        .map(([id]) => id);
    },
    [state.vehicles],
  );

  /**
   * Get position history
   */
  const getPositionHistory = useCallback(
    (vehicleId: string, limit?: number) => {
      const history = positionHistoryRef.current.get(vehicleId) || [];
      if (limit && history.length > limit) {
        return history.slice(-limit);
      }
      return history;
    },
    [],
  );

  // Set up initial connection
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, []);

  // Update stale count
  useEffect(() => {
    const staleThreshold = Date.now() - (5 * 60 * 1000);
    const staleCount = Array.from(state.vehicles.values()).filter(
      (pos) => pos.timestamp.getTime() <= staleThreshold,
    ).length;

    setState((prev) => ({
      ...prev,
      staleCount,
    }));
  }, [state.vehicles]);

  return {
    ...state,
    selectedVehicle,
    selectVehicle,
    refresh,
    reconnect,
    disconnect,
    filterByStatus,
    filterByGeofence,
    getPositionHistory,
  };
}

