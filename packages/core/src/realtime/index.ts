/**
 * Real-time Event Constants and Types
 *
 * Shared across API server and client-side dashboard for type safety.
 * Both the API and dashboard import these to ensure event names are consistent.
 *
 * Usage in API:
 *   import { EVENTS } from "@witylogix/core/realtime";
 *   io.to(roomId).emit(EVENTS.SHIPMENT_CREATED, data);
 *
 * Usage in Dashboard:
 *   import { EVENTS } from "@witylogix/core/realtime";
 *   socket.on(EVENTS.SHIPMENT_CREATED, (data) => { ... });
 */

// ─── Event Name Constants ────────────────────────────────────

export const EVENTS = {
  // ── Shipment Events ──────────────────────────────────────
  SHIPMENT_CREATED: "shipment:created",
  SHIPMENT_STATUS_CHANGED: "shipment:status_changed",
  SHIPMENT_ASSIGNED: "shipment:assigned",

  // ── Order Events ─────────────────────────────────────────
  ORDER_CREATED: "order:created",
  ORDER_STATUS_CHANGED: "order:status_changed",

  // ── Driver Events ────────────────────────────────────────
  DRIVER_STATUS_CHANGED: "driver:status_changed",
  DRIVER_LOCATION_UPDATED: "driver:location_updated",

  // ── Notification Events ──────────────────────────────────
  NOTIFICATION_SENT: "notification:sent",

  // ── Payment Events ───────────────────────────────────────
  PAYMENT_RECEIVED: "payment:received",

  // ── Activity Events ──────────────────────────────────────
  ACTIVITY_NEW: "activity:new",

  // ── System Events ────────────────────────────────────────
  SYSTEM_HEALTH: "system:health",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// ─── Subscription Commands ───────────────────────────────────

export const SUBSCRIPTIONS = {
  SUBSCRIBE_SHOP: "subscribe:shop",
  UNSUBSCRIBE_SHOP: "unsubscribe:shop",
  SUBSCRIBE_SHIPMENT: "subscribe:shipment",
  SUBSCRIBE_DRIVER: "subscribe:driver",
  PING: "ping",
} as const;

// ─── Room Naming Conventions ────────────────────────────────

/**
 * Generate a room name for a shop
 */
export function getShopRoom(shopId: string): string {
  return `shop:${shopId}`;
}

/**
 * Generate a room name for a shipment
 */
export function getShipmentRoom(shipmentId: string): string {
  return `shipment:${shipmentId}`;
}

/**
 * Generate a room name for a driver
 */
export function getDriverRoom(driverId: string): string {
  return `driver:${driverId}`;
}

/**
 * Generate a room name for a user
 */
export function getUserRoom(userId: string): string {
  return `user:${userId}`;
}

// ─── Event Payload Types ────────────────────────────────────

export interface ShipmentEventPayload {
  id: string;
  shopId: string;
  status: string;
  orderId: string;
  trackingNumber: string;
  driverId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentStatusEventPayload extends ShipmentEventPayload {
  previousStatus: string;
  changedAt: string;
  reason?: string;
}

export interface ShipmentAssignEventPayload extends ShipmentEventPayload {
  driverId: string;
  driverName: string;
  assignedAt: string;
}

export interface OrderEventPayload {
  id: string;
  shopId: string;
  status: string;
  orderId: string;
  customerId: string;
  totalAmount: number;
  createdAt: string;
}

export interface OrderStatusEventPayload extends OrderEventPayload {
  previousStatus: string;
  changedAt: string;
}

export interface DriverEventPayload {
  id: string;
  shopId: string;
  driverId: string;
  driverName: string;
  status: "ONLINE" | "OFFLINE" | "BREAK";
  assignedShipments: number;
  lastUpdated: string;
}

export interface DriverLocationEventPayload extends DriverEventPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
}

export interface NotificationEventPayload {
  id: string;
  shopId: string;
  userId?: string;
  driverId?: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface PaymentEventPayload {
  id: string;
  shopId: string;
  orderId: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  method: string;
  createdAt: string;
}

export interface ActivityEventPayload {
  id: string;
  shopId: string;
  entityId: string;
  entityType: string;
  action: string;
  userId?: string;
  driverId?: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface SystemHealthEventPayload {
  status: "healthy" | "degraded" | "critical";
  timestamp: string;
  metrics: {
    connectedClients: number;
    activeShops: number;
    uptime: number;
  };
}

// ─── Mapped Event Types ──────────────────────────────────────

export type EventPayload = {
  [EVENTS.SHIPMENT_CREATED]: ShipmentEventPayload;
  [EVENTS.SHIPMENT_STATUS_CHANGED]: ShipmentStatusEventPayload;
  [EVENTS.SHIPMENT_ASSIGNED]: ShipmentAssignEventPayload;
  [EVENTS.ORDER_CREATED]: OrderEventPayload;
  [EVENTS.ORDER_STATUS_CHANGED]: OrderStatusEventPayload;
  [EVENTS.DRIVER_STATUS_CHANGED]: DriverEventPayload;
  [EVENTS.DRIVER_LOCATION_UPDATED]: DriverLocationEventPayload;
  [EVENTS.NOTIFICATION_SENT]: NotificationEventPayload;
  [EVENTS.PAYMENT_RECEIVED]: PaymentEventPayload;
  [EVENTS.ACTIVITY_NEW]: ActivityEventPayload;
  [EVENTS.SYSTEM_HEALTH]: SystemHealthEventPayload;
};
