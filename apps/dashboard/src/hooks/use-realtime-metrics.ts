/**
 * useRealtimeMetrics — React hook for subscribing to aggregated metrics updates.
 *
 * Provides real-time dashboard metrics (orders, deliveries, drivers, SLA)
 * with animation-friendly value transitions.
 */

import { useEffect, useState, useCallback } from "react";
import type { MetricsUpdatedEvent } from "@witylogix/core/realtime/types";
import { useRealtime } from "./use-realtime.js";

/**
 * Real-time metrics data structure.
 */
export interface RealtimeMetrics {
  /** Total orders created today. */
  ordersToday: number;
  /** Active deliveries in progress. */
  activeDeliveries: number;
  /** Drivers available for dispatch. */
  availableDrivers: number;
  /** Service level agreement compliance percentage. */
  slaPercentage: number;
  /** Timestamp of last update. */
  lastUpdatedAt: string;
  /** Whether metrics are loading. */
  isLoading: boolean;
  /** Previous values for animation. */
  prevValues?: RealtimeMetrics;
}

/**
 * Hook for subscribing to real-time metrics updates.
 *
 * Subscribes to metrics.updated events and provides animation-friendly
 * value transitions. Works with any auth mechanism (passed via parent hook).
 *
 * @param shopId Shop ID to subscribe to metrics for (optional).
 * @param config Optional configuration (token, etc).
 * @returns Current metrics and hook API.
 *
 * @example
 * const metrics = useRealtimeMetrics("shop_123", { token: jwtToken });
 *
 * return (
 *   <div>
 *     <div>Orders Today: {metrics.ordersToday}</div>
 *     <div>Active Deliveries: {metrics.activeDeliveries}</div>
 *     <div>SLA: {metrics.slaPercentage}%</div>
 *   </div>
 * );
 */
export function useRealtimeMetrics(
  shopId?: string,
  config?: {
    token?: string;
    url?: string;
    onMetricsUpdate?: (metrics: RealtimeMetrics) => void;
  },
): RealtimeMetrics {
  const [metrics, setMetrics] = useState<RealtimeMetrics>({
    ordersToday: 0,
    activeDeliveries: 0,
    availableDrivers: 0,
    slaPercentage: 0,
    lastUpdatedAt: new Date().toISOString(),
    isLoading: true,
  });

  const roomId = shopId
    ? (`shop:${shopId}` as const)
    : (`org:${shopId}` as const);

  /**
   * Handle metrics updated event.
   */
  const handleMetricsMessage = useCallback(
    (event: MetricsUpdatedEvent) => {
      setMetrics((prev) => {
        const updated: RealtimeMetrics = {
          ordersToday: event.ordersToday,
          activeDeliveries: event.activeDeliveries,
          availableDrivers: event.availableDrivers,
          slaPercentage: event.slaPercentage,
          lastUpdatedAt: event.lastUpdatedAt,
          isLoading: false,
          prevValues: {
            ordersToday: prev.ordersToday,
            activeDeliveries: prev.activeDeliveries,
            availableDrivers: prev.availableDrivers,
            slaPercentage: prev.slaPercentage,
            lastUpdatedAt: prev.lastUpdatedAt,
            isLoading: prev.isLoading,
          },
        };

        // Call optional callback
        config?.onMetricsUpdate?.(updated);

        return updated;
      });
    },
    [config],
  );

  // Use realtime hook
  const realtime = useRealtime({
    channels: [roomId],
    onMessage: (msg) => {
      if (msg.event === "metrics.updated") {
        handleMetricsMessage(msg.data as MetricsUpdatedEvent);
      }
    },
    enabled: true,
  });

  /**
   * Mark as loaded once connected.
   */
  useEffect(() => {
    if (realtime.status === "connected") {
      setMetrics((prev) => ({ ...prev, isLoading: false }));
    } else if (realtime.status === "connecting") {
      setMetrics((prev) => ({ ...prev, isLoading: true }));
    }
  }, [realtime.status]);

  return metrics;
}

/**
 * Hook for displaying animated metric counters.
 *
 * Provides smooth transitions between metric values for UI display.
 *
 * @param current Current value.
 * @param previous Previous value for comparison.
 * @param duration Animation duration in milliseconds.
 * @returns Animated display value.
 */
export function useAnimatedMetric(
  current: number,
  previous?: number,
  duration: number = 500,
): number {
  const [displayValue, setDisplayValue] = useState(current);

  useEffect(() => {
    if (current === displayValue) return;

    const startTime = Date.now();
    const startValue = displayValue;
    const diff = current - startValue;

    const updateInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const newValue = startValue + diff * progress;
      setDisplayValue(Math.round(newValue));

      if (progress >= 1) {
        clearInterval(updateInterval);
        setDisplayValue(current);
      }
    }, 16); // ~60 FPS

    return () => clearInterval(updateInterval);
  }, [current, displayValue, duration]);

  return displayValue;
}

/**
 * Hook for SLA percentage formatting with change indication.
 *
 * @param current Current SLA percentage.
 * @param previous Previous SLA percentage.
 * @returns Formatted string and change indicator.
 */
export function useFormattedSLA(
  current: number,
  previous?: number,
): {
  formatted: string;
  changed: boolean;
  improved: boolean;
} {
  const formatted = `${Math.round(current)}%`;
  const changed = previous !== undefined && previous !== current;
  const improved = changed && previous !== undefined && current > previous;

  return { formatted, changed, improved };
}
