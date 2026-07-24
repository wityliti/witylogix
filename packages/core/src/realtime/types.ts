/**
 * Real-time Dashboard Types — WebSocket event definitions and configuration.
 *
 * Defines discriminated union types for all dashboard events, connection
 * configuration, and plan-based limits.
 */

// ─── PLAN-BASED LIMITS ──────────────────────────────────────────────────

/**
 * Connection limits by plan tier.
 */
export const CONNECTION_LIMITS = {
  FREE: 5,
  STARTER: 25,
  GROWTH: 100,
  ENTERPRISE: Infinity,
} as const;

/**
 * Rate limiting per connection: events per second.
 */
export const RATE_LIMIT_PER_CONNECTION = 50;

/**
 * Event replay buffer size per room.
 */
export const EVENT_BUFFER_SIZE = 100;

/**
 * Heartbeat interval (milliseconds).
 */
export const HEARTBEAT_INTERVAL = 30000; // 30 seconds

/**
 * Heartbeat timeout (milliseconds).
 */
export const HEARTBEAT_TIMEOUT = 60000; // 60 seconds

/**
 * Metrics aggregation debounce interval (milliseconds).
 */
export const METRICS_DEBOUNCE_INTERVAL = 1000; // 1 second

// ─── ROOM TYPES ────────────────────────────────────────────────────────

/**
 * Room types for organizing broadcast subscriptions.
 */
export type RoomType = "org" | "shop" | "driver" | "delivery" | "admin";

/**
 * Room identifier patterns.
 */
export type RoomId =
  | `org:${string}`
  | `shop:${string}`
  | `driver:${string}`
  | `delivery:${string}`
  | "admin";

/**
 * Room configuration for join/leave operations.
 */
export interface RoomConfig {
  /** Room identifier (e.g., "org:org_123", "shop:shop_456"). */
  id: RoomId;
  /** Room type. */
  type: RoomType;
  /** Optional filters to apply to events in this room. */
  filters?: EventFilter;
}

// ─── EVENT TYPES ──────────────────────────────────────────────────────

/**
 * Discriminated union of all dashboard events.
 * Each event must have an 'event' field for type discrimination.
 */
export type DashboardEvent =
  | OrderCreatedEvent
  | OrderUpdatedEvent
  | OrderCancelledEvent
  | DeliveryAssignedEvent
  | DeliveryStatusChangedEvent
  | DeliveryCompletedEvent
  | DriverLocationUpdatedEvent
  | DriverStatusChangedEvent
  | AlertSlaBreachEvent
  | AlertSystemEvent
  | MetricsUpdatedEvent;

// ─── ORDER EVENTS ──────────────────────────────────────────────────────

export interface OrderCreatedEvent {
  event: "order.created";
  orderId: string;
  shopId: string;
  customerId?: string;
  totalAmount: number;
  currency: string;
  createdAt: string; // ISO 8601
  metadata?: Record<string, any>;
}

export interface OrderUpdatedEvent {
  event: "order.updated";
  orderId: string;
  shopId: string;
  status: string;
  updatedAt: string; // ISO 8601
  changes?: Record<string, any>;
}

export interface OrderCancelledEvent {
  event: "order.cancelled";
  orderId: string;
  shopId: string;
  reason?: string;
  cancelledAt: string; // ISO 8601
}

// ─── DELIVERY EVENTS ──────────────────────────────────────────────────

export interface DeliveryAssignedEvent {
  event: "delivery.assigned";
  deliveryId: string;
  shopId: string;
  driverId: string;
  orderId: string;
  assignedAt: string; // ISO 8601
}

export interface DeliveryStatusChangedEvent {
  event: "delivery.status_changed";
  deliveryId: string;
  shopId: string;
  status: "assigned" | "picked_up" | "in_transit" | "delivered" | "failed";
  previousStatus?: string;
  changedAt: string; // ISO 8601
  location?: { latitude: number; longitude: number };
}

export interface DeliveryCompletedEvent {
  event: "delivery.completed";
  deliveryId: string;
  shopId: string;
  driverId: string;
  completedAt: string; // ISO 8601
  duration: number; // seconds
  distance?: number; // meters
}

// ─── DRIVER EVENTS ──────────────────────────────────────────────────────

export interface DriverLocationUpdatedEvent {
  event: "driver.location_updated";
  driverId: string;
  shopId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  updatedAt: string; // ISO 8601
}

export interface DriverStatusChangedEvent {
  event: "driver.status_changed";
  driverId: string;
  shopId: string;
  status: "available" | "on_delivery" | "offline" | "on_break";
  previousStatus?: string;
  changedAt: string; // ISO 8601
}

// ─── ALERT EVENTS ──────────────────────────────────────────────────────

export interface AlertSlaBreachEvent {
  event: "alert.sla_breach";
  shopId: string;
  deliveryId?: string;
  orderId?: string;
  breachType: "delivery_time" | "pickup_time" | "response_time";
  slaTimeMs: number;
  actualTimeMs: number;
  severity: "warning" | "critical";
  alertedAt: string; // ISO 8601
}

export interface AlertSystemEvent {
  event: "alert.system";
  shopId?: string;
  alertType: "service_degradation" | "high_load" | "quota_exceeded" | "error";
  severity: "info" | "warning" | "critical";
  message: string;
  alertedAt: string; // ISO 8601
  metadata?: Record<string, any>;
}

// ─── METRICS EVENTS ──────────────────────────────────────────────────────

export interface MetricsUpdatedEvent {
  event: "metrics.updated";
  shopId: string;
  ordersToday: number;
  activeDeliveries: number;
  availableDrivers: number;
  slaPercentage: number; // 0-100
  lastUpdatedAt: string; // ISO 8601
}

// ─── EVENT ENVELOPE ──────────────────────────────────────────────────────

/**
 * Wrapper around dashboard events with metadata.
 */
export interface EventEnvelope<T extends DashboardEvent = DashboardEvent> {
  /** Unique event ID for deduplication. */
  id: string;
  /** Event sequence number for ordering (per room). */
  seq: number;
  /** The actual event payload. */
  data: T;
  /** Timestamp when event was emitted. */
  timestamp: string; // ISO 8601
  /** Organization ID for isolation. */
  orgId: string;
}

// ─── EVENT FILTER ──────────────────────────────────────────────────────

/**
 * Filter to apply to events when subscribing.
 */
export interface EventFilter {
  /** Only events with these types. */
  eventTypes?: DashboardEvent["event"][];
  /** Only events for these shops. */
  shopIds?: string[];
  /** Only events for these drivers. */
  driverIds?: string[];
  /** Only events with severity >= this (for alerts). */
  minSeverity?: "info" | "warning" | "critical";
}

// ─── CONNECTION CONFIG ──────────────────────────────────────────────────

/**
 * Configuration for WebSocket connections.
 */
export interface ConnectionConfig {
  /** Maximum events per second per connection. */
  maxEventsPerSecond: number;
  /** Heartbeat interval in milliseconds. */
  heartbeatInterval: number;
  /** Heartbeat timeout in milliseconds. */
  heartbeatTimeout: number;
  /** Event buffer size per room. */
  eventBufferSize: number;
}

// ─── CONNECTION STATE ──────────────────────────────────────────────────

export type ConnectionStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "error"
  | "reconnecting";

/**
 * Represents an active WebSocket connection.
 */
export interface WebSocketConnection {
  /** Unique connection ID. */
  id: string;
  /** User ID if authenticated. */
  userId?: string;
  /** Organization ID. */
  orgId: string;
  /** Connected timestamp. */
  connectedAt: Date;
  /** Rooms this connection is subscribed to. */
  rooms: Set<RoomId>;
  /** Event filter for subscriptions. */
  filters?: EventFilter;
  /** Last heartbeat acknowledgment. */
  lastHeartbeat: Date;
  /** Metrics for this connection. */
  metrics: ConnectionMetrics;
}

/**
 * Metrics tracked per connection.
 */
export interface ConnectionMetrics {
  /** Total events received. */
  eventsReceived: number;
  /** Events rate-limited (dropped). */
  eventsDropped: number;
  /** Total events sent. */
  eventsSent: number;
  /** Latency in milliseconds. */
  latency: number;
  /** Last event timestamp. */
  lastEventAt: Date;
}

// ─── TENANT METRICS ──────────────────────────────────────────────────────

/**
 * Metrics for real-time connections per tenant.
 */
export interface TenantMetrics {
  /** Current active connections. */
  activeConnections: number;
  /** Peak connections in this period. */
  peakConnections: number;
  /** Connection errors in this period. */
  connectionErrors: number;
  /** Events published in this period. */
  eventCount: number;
  /** Average latency in milliseconds. */
  avgLatency: number;
  /** Period timestamp. */
  timestamp: Date;
}
