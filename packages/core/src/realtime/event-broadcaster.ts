/**
 * Event Broadcaster — Fan-out events from event bus to WebSocket rooms.
 *
 * Bridges the event bus (Redis pub/sub) with WebSocket rooms, handling
 * fan-out logic (order events to shop+org rooms), metrics aggregation,
 * and event serialization.
 */

import type { TypedEventBus } from "../event-bus/index.js";
import type { WitylogixEvents } from "../event-bus/types.js";
import {
  METRICS_DEBOUNCE_INTERVAL,
  type DashboardEvent,
  type EventEnvelope,
  type MetricsUpdatedEvent,
  type OrderCreatedEvent,
  type OrderUpdatedEvent,
  type DeliveryStatusChangedEvent,
  type DriverLocationUpdatedEvent,
} from "./types.js";

/**
 * Handles broadcasting of events from event bus to WebSocket rooms.
 */
export class EventBroadcaster {
  /** Event bus for subscribing to domain events. */
  private eventBus: TypedEventBus<WitylogixEvents>;

  /** Callback to emit events to client connections. */
  private emitToClients: (
    roomId: string,
    event: EventEnvelope,
  ) => Promise<void>;

  /** Event sequence counter per room for ordering. */
  private eventSequence = new Map<string, number>();

  /** Debounce timers for metrics aggregation. */
  private metricsDebounceTimers = new Map<string, NodeJS.Timeout>();

  /** Accumulated metrics for debouncing. */
  private metricsAccumulator = new Map<string, Partial<MetricsUpdatedEvent>>();

  constructor(
    eventBus: TypedEventBus<WitylogixEvents>,
    emitToClients: (roomId: string, event: EventEnvelope) => Promise<void>,
  ) {
    this.eventBus = eventBus;
    this.emitToClients = emitToClients;
  }

  /**
   * Start subscribing to event bus events and broadcasting to rooms.
   */
  async startBroadcasting(): Promise<void> {
    // Order events -> shop room + org room
    await this.eventBus.subscribe(
      "order.created",
      (envelope) => this.handleOrderEvent(envelope),
      { consumerGroup: "dashboard-broadcaster" },
    );

    await this.eventBus.subscribe(
      "order.updated",
      (envelope) => this.handleOrderEvent(envelope),
      { consumerGroup: "dashboard-broadcaster" },
    );

    await this.eventBus.subscribe(
      "order.cancelled",
      (envelope) => this.handleOrderEvent(envelope),
      { consumerGroup: "dashboard-broadcaster" },
    );

    // Delivery events -> shop room + org room
    await this.eventBus.subscribe(
      "delivery.assigned",
      (envelope) => this.handleDeliveryEvent(envelope),
      { consumerGroup: "dashboard-broadcaster" },
    );

    await this.eventBus.subscribe(
      "delivery.status_changed",
      (envelope) => this.handleDeliveryEvent(envelope),
      { consumerGroup: "dashboard-broadcaster" },
    );

    await this.eventBus.subscribe(
      "delivery.completed",
      (envelope) => this.handleDeliveryEvent(envelope),
      { consumerGroup: "dashboard-broadcaster" },
    );

    // Driver events -> org room + specific driver room
    await this.eventBus.subscribe(
      "driver.location_updated",
      (envelope) => this.handleLocationUpdate(envelope),
      { consumerGroup: "dashboard-broadcaster" },
    );

    await this.eventBus.subscribe(
      "driver.status_changed",
      (envelope) => this.handleDriverEvent(envelope),
      { consumerGroup: "dashboard-broadcaster" },
    );

    // Alerts -> shop room + org room
    await this.eventBus.subscribe(
      "alert.sla_breach",
      (envelope) => this.handleAlertEvent(envelope),
      { consumerGroup: "dashboard-broadcaster" },
    );

    await this.eventBus.subscribe(
      "alert.system",
      (envelope) => this.handleAlertEvent(envelope),
      { consumerGroup: "dashboard-broadcaster" },
    );
  }

  /**
   * Stop broadcasting (cleanup timers).
   */
  async stopBroadcasting(): Promise<void> {
    // Clear all debounce timers
    for (const timer of this.metricsDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.metricsDebounceTimers.clear();
    this.metricsAccumulator.clear();
  }

  // ─── EVENT HANDLERS ────────────────────────────────────────────────────

  /**
   * Handle order events (created, updated, cancelled).
   */
  private async handleOrderEvent(envelope: any): Promise<void> {
    const data = envelope.data;
    const orgId = envelope.metadata?.tenantId || data.shopId;
    const shopId = data.shopId;

    const event: DashboardEvent = {
      event: envelope.type as any,
      ...data,
    };

    await this.broadcastToRooms(
      orgId,
      [`shop:${shopId}`, `org:${orgId}`],
      event,
    );
  }

  /**
   * Handle delivery events (assigned, status_changed, completed).
   */
  private async handleDeliveryEvent(envelope: any): Promise<void> {
    const data = envelope.data;
    const orgId = envelope.metadata?.tenantId || data.shopId;
    const shopId = data.shopId;
    const deliveryId = data.deliveryId;

    const event: DashboardEvent = {
      event: envelope.type as any,
      ...data,
    };

    // Broadcast to shop, org, and specific delivery tracking room
    await this.broadcastToRooms(
      orgId,
      [`shop:${shopId}`, `org:${orgId}`, `delivery:${deliveryId}`],
      event,
    );
  }

  /**
   * Handle driver location updates with aggregation/debouncing.
   */
  private async handleLocationUpdate(envelope: any): Promise<void> {
    const data = envelope.data;
    const orgId = envelope.metadata?.tenantId || data.shopId;
    const driverId = data.driverId;
    const shopId = data.shopId;

    const event: DriverLocationUpdatedEvent = {
      event: "driver.location_updated",
      ...data,
    };

    // Broadcast immediately to org room and specific driver room
    await this.broadcastToRooms(
      orgId,
      [`org:${orgId}`, `driver:${driverId}`],
      event,
    );

    // Trigger metrics update
    this.scheduleMetricsUpdate(shopId, orgId);
  }

  /**
   * Handle driver status change events.
   */
  private async handleDriverEvent(envelope: any): Promise<void> {
    const data = envelope.data;
    const orgId = envelope.metadata?.tenantId || data.shopId;
    const shopId = data.shopId;
    const driverId = data.driverId;

    const event: DashboardEvent = {
      event: envelope.type as any,
      ...data,
    };

    // Broadcast to org and driver-specific rooms
    await this.broadcastToRooms(
      orgId,
      [`org:${orgId}`, `driver:${driverId}`],
      event,
    );
  }

  /**
   * Handle alert events.
   */
  private async handleAlertEvent(envelope: any): Promise<void> {
    const data = envelope.data;
    const orgId = envelope.metadata?.tenantId || data.shopId;
    const shopId = data.shopId;

    const event: DashboardEvent = {
      event: envelope.type as any,
      ...data,
    };

    // Broadcast to admin room, org room, and optionally shop room
    const rooms: string[] = ["admin", `org:${orgId}`];
    if (shopId) {
      rooms.push(`shop:${shopId}`);
    }

    await this.broadcastToRooms(orgId, rooms, event);
  }

  // ─── METRICS AGGREGATION ──────────────────────────────────────────────

  /**
   * Schedule a metrics update with debouncing.
   */
  private scheduleMetricsUpdate(shopId: string, orgId: string): void {
    const key = `${orgId}:${shopId}`;

    // Clear existing timer
    if (this.metricsDebounceTimers.has(key)) {
      clearTimeout(this.metricsDebounceTimers.get(key)!);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      const metrics = this.metricsAccumulator.get(key);
      if (metrics) {
        await this.broadcastMetrics(orgId, shopId, metrics as any);
        this.metricsAccumulator.delete(key);
        this.metricsDebounceTimers.delete(key);
      }
    }, METRICS_DEBOUNCE_INTERVAL);

    this.metricsDebounceTimers.set(key, timer);
  }

  /**
   * Broadcast aggregated metrics to rooms.
   */
  private async broadcastMetrics(
    orgId: string,
    shopId: string,
    metrics: Partial<MetricsUpdatedEvent>,
  ): Promise<void> {
    const event: MetricsUpdatedEvent = {
      event: "metrics.updated",
      shopId,
      ordersToday: metrics.ordersToday ?? 0,
      activeDeliveries: metrics.activeDeliveries ?? 0,
      availableDrivers: metrics.availableDrivers ?? 0,
      slaPercentage: metrics.slaPercentage ?? 0,
      lastUpdatedAt: new Date().toISOString(),
    };

    await this.broadcastToRooms(
      orgId,
      [`shop:${shopId}`, `org:${orgId}`],
      event,
    );
  }

  // ─── BROADCAST HELPERS ──────────────────────────────────────────────────

  /**
   * Broadcast an event to multiple rooms with serialization and sequencing.
   */
  private async broadcastToRooms(
    orgId: string,
    roomIds: string[],
    event: DashboardEvent,
  ): Promise<void> {
    for (const roomId of roomIds) {
      const seq = this.getNextSequence(roomId);

      const envelope: EventEnvelope = {
        id: this.generateEventId(),
        seq,
        data: event,
        timestamp: new Date().toISOString(),
        orgId,
      };

      try {
        await this.emitToClients(roomId, envelope);
      } catch (error) {
        console.error(`Failed to broadcast to room ${roomId}:`, error);
      }
    }
  }

  /**
   * Get next sequence number for a room.
   */
  private getNextSequence(roomId: string): number {
    const current = this.eventSequence.get(roomId) ?? 0;
    const next = current + 1;
    this.eventSequence.set(roomId, next);
    return next;
  }

  /**
   * Generate unique event ID.
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
