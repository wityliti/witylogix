/**
 * Webhook Debugger
 * Store and manage delivery history for debugging webhook integrations
 */

import { v4 as uuidv4 } from "uuid";
import type { WebhookDelivery, WebhookEventType, DeliveryStatus } from "./types";

/**
 * Delivery entry with full request/response details
 */
export interface DeliveryRecord {
  id: string;
  endpointId: string;
  endpointUrl: string;
  eventType: WebhookEventType;
  eventId: string;
  status: DeliveryStatus;
  attempt: number;
  maxAttempts: number;
  requestHeaders: Record<string, string>;
  requestBody: string;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  durationMs: number;
  error?: string;
  timestamp: Date;
  nextRetryAt?: Date;
}

/**
 * Timeline entry for a delivery attempt
 */
export interface TimelineEntry {
  attemptNumber: number;
  timestamp: Date;
  status: DeliveryStatus;
  statusCode?: number;
  durationMs: number;
  error?: string;
}

/**
 * Webhook Debugger Service
 * Stores and provides access to webhook delivery history
 */
export class WebhookDebugger {
  // In-memory store: endpointId -> array of deliveries (last 100)
  private deliveryStore: Map<string, DeliveryRecord[]> = new Map();
  private maxStoragePerEndpoint = 100;

  /**
   * Store a delivery record
   */
  storeDelivery(
    endpointId: string,
    endpointUrl: string,
    event: {
      type: WebhookEventType;
      id: string;
      data: Record<string, any>;
    },
    attempt: number,
    maxAttempts: number,
    request: {
      headers: Record<string, string>;
      body: string;
    },
    response: {
      status?: number;
      headers?: Record<string, string>;
      body?: string;
      durationMs: number;
    },
    status: DeliveryStatus,
    error?: string,
    nextRetryAt?: Date
  ): DeliveryRecord {
    const record: DeliveryRecord = {
      id: uuidv4(),
      endpointId,
      endpointUrl,
      eventType: event.type,
      eventId: event.id,
      status,
      attempt,
      maxAttempts,
      requestHeaders: request.headers,
      requestBody: request.body,
      responseStatus: response.status,
      responseHeaders: response.headers,
      responseBody: response.body,
      durationMs: response.durationMs,
      error,
      timestamp: new Date(),
      nextRetryAt,
    };

    const deliveries = this.deliveryStore.get(endpointId) || [];
    deliveries.unshift(record);

    // Keep only last N deliveries
    if (deliveries.length > this.maxStoragePerEndpoint) {
      deliveries.pop();
    }

    this.deliveryStore.set(endpointId, deliveries);
    return record;
  }

  /**
   * Get delivery history for an endpoint
   */
  getEndpointHistory(
    endpointId: string,
    limit: number = 50
  ): DeliveryRecord[] {
    const deliveries = this.deliveryStore.get(endpointId) || [];
    return deliveries.slice(0, limit);
  }

  /**
   * Get delivery timeline for a specific event
   */
  getEventTimeline(eventId: string): TimelineEntry[] {
    const timeline: TimelineEntry[] = [];

    for (const deliveries of this.deliveryStore.values()) {
      for (const delivery of deliveries) {
        if (delivery.eventId === eventId) {
          timeline.push({
            attemptNumber: delivery.attempt,
            timestamp: delivery.timestamp,
            status: delivery.status,
            statusCode: delivery.responseStatus,
            durationMs: delivery.durationMs,
            error: delivery.error,
          });
        }
      }
    }

    return timeline.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  /**
   * Get a specific delivery record
   */
  getDelivery(deliveryId: string): DeliveryRecord | undefined {
    for (const deliveries of this.deliveryStore.values()) {
      const found = deliveries.find((d) => d.id === deliveryId);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Replay a delivery (get original request/response for re-sending)
   */
  replayDelivery(deliveryId: string): {
    request: { headers: Record<string, string>; body: string };
    originalResponse: {
      status?: number;
      headers?: Record<string, string>;
      body?: string;
    };
  } | null {
    const delivery = this.getDelivery(deliveryId);
    if (!delivery) return null;

    return {
      request: {
        headers: delivery.requestHeaders,
        body: delivery.requestBody,
      },
      originalResponse: {
        status: delivery.responseStatus,
        headers: delivery.responseHeaders,
        body: delivery.responseBody,
      },
    };
  }

  /**
   * Calculate delivery statistics
   */
  getEndpointStats(endpointId: string): {
    totalDeliveries: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgDurationMs: number;
    avgAttemptsToSuccess: number;
    recentFailures: string[];
  } {
    const deliveries = this.deliveryStore.get(endpointId) || [];

    const successCount = deliveries.filter((d) => d.status === "delivered").length;
    const failureCount = deliveries.filter((d) => d.status === "failed").length;
    const totalDeliveries = deliveries.length;

    const successRate =
      totalDeliveries > 0 ? (successCount / totalDeliveries) * 100 : 0;
    const avgDurationMs =
      totalDeliveries > 0
        ? deliveries.reduce((sum, d) => sum + d.durationMs, 0) / totalDeliveries
        : 0;

    const successfulDeliveries = deliveries.filter(
      (d) => d.status === "delivered"
    );
    const avgAttemptsToSuccess =
      successfulDeliveries.length > 0
        ? successfulDeliveries.reduce((sum, d) => sum + d.attempt, 0) /
          successfulDeliveries.length
        : 0;

    const recentFailures = deliveries
      .filter((d) => d.status === "failed" && d.error)
      .slice(0, 5)
      .map((d) => d.error || "Unknown error");

    return {
      totalDeliveries,
      successCount,
      failureCount,
      successRate,
      avgDurationMs,
      avgAttemptsToSuccess,
      recentFailures,
    };
  }

  /**
   * Get response time histogram data
   */
  getResponseTimeHistogram(
    endpointId: string,
    buckets: number = 5
  ): {
    bucket: string;
    count: number;
    percentage: number;
  }[] {
    const deliveries = this.deliveryStore.get(endpointId) || [];
    if (deliveries.length === 0) return [];

    const min = Math.min(...deliveries.map((d) => d.durationMs));
    const max = Math.max(...deliveries.map((d) => d.durationMs));
    const bucketSize = (max - min + 1) / buckets;

    const histogram: Record<number, number> = {};
    for (let i = 0; i < buckets; i++) {
      histogram[i] = 0;
    }

    deliveries.forEach((delivery) => {
      const bucketIndex = Math.min(
        Math.floor((delivery.durationMs - min) / bucketSize),
        buckets - 1
      );
      histogram[bucketIndex]++;
    });

    return Array.from({ length: buckets }).map((_, i) => {
      const lower = Math.round(min + i * bucketSize);
      const upper = Math.round(min + (i + 1) * bucketSize);
      return {
        bucket: `${lower}-${upper}ms`,
        count: histogram[i],
        percentage: (histogram[i] / deliveries.length) * 100,
      };
    });
  }

  /**
   * Classify delivery errors
   */
  classifyError(delivery: DeliveryRecord): string {
    if (delivery.status === "delivered") return "success";

    const error = delivery.error?.toLowerCase() || "";
    const statusCode = delivery.responseStatus;

    if (error.includes("timeout") || error.includes("econnrefused")) {
      return "timeout";
    }
    if (statusCode === 429) return "rate_limited";
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return statusCode === 401 || statusCode === 403
        ? "auth_error"
        : "client_error";
    }
    if (statusCode && statusCode >= 500) return "server_error";
    if (error.includes("econnrefused")) return "connection_refused";
    if (error.includes("enotfound") || error.includes("dns")) return "dns_error";
    if (error.includes("econnreset")) return "connection_reset";

    return "unknown_error";
  }

  /**
   * Filter deliveries by criteria
   */
  filterDeliveries(
    criteria: {
      endpointId?: string;
      eventType?: WebhookEventType;
      status?: DeliveryStatus;
      startDate?: Date;
      endDate?: Date;
      errorOnly?: boolean;
    }
  ): DeliveryRecord[] {
    let results: DeliveryRecord[] = [];

    if (criteria.endpointId) {
      results = this.deliveryStore.get(criteria.endpointId) || [];
    } else {
      for (const deliveries of this.deliveryStore.values()) {
        results.push(...deliveries);
      }
    }

    return results.filter((delivery) => {
      if (
        criteria.eventType &&
        delivery.eventType !== criteria.eventType
      )
        return false;
      if (criteria.status && delivery.status !== criteria.status) return false;
      if (
        criteria.startDate &&
        delivery.timestamp < criteria.startDate
      )
        return false;
      if (criteria.endDate && delivery.timestamp > criteria.endDate)
        return false;
      if (criteria.errorOnly && delivery.status === "delivered") return false;
      return true;
    });
  }

  /**
   * Clear history for an endpoint
   */
  clearEndpointHistory(endpointId: string): void {
    this.deliveryStore.delete(endpointId);
  }

  /**
   * Clear all history
   */
  clearAllHistory(): void {
    this.deliveryStore.clear();
  }
}

// Export singleton instance
export const webhookDebugger = new WebhookDebugger();
