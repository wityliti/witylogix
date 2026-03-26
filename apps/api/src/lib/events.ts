/**
 * Event Emitter Helpers
 *
 * Type-safe wrapper functions for emitting real-time events to clients.
 * These functions are called from route handlers after mutations to notify
 * connected dashboard clients of changes.
 *
 * Usage in route handlers:
 *
 *   // After creating a shipment
 *   const shipment = await prisma.shipment.create({ ... });
 *   emitShipmentCreated(shipment);
 *
 *   // After status change
 *   emitShipmentStatusChanged({
 *     ...shipment,
 *     previousStatus: oldStatus,
 *   });
 */

import {
  emitToShop,
  emitToShipment,
  emitToDriver,
  type ShipmentEvent,
  type ShipmentStatusEvent,
  type ShipmentAssignEvent,
  type OrderEvent,
  type OrderStatusEvent,
  type DriverEvent,
  type DriverLocationEvent,
  type NotificationEvent,
  type PaymentEvent,
  type ActivityEvent,
  type SystemHealthEvent,
} from "./socket.js";

// ─── Shipment Events ────────────────────────────────────────

/**
 * Emit when a new shipment is created
 */
export function emitShipmentCreated(data: ShipmentEvent): void {
  emitToShop(data.shopId, "shipment:created", data);
}

/**
 * Emit when a shipment status changes
 */
export function emitShipmentStatusChanged(data: ShipmentStatusEvent): void {
  emitToShop(data.shopId, "shipment:status_changed", data);
  emitToShipment(data.id, "shipment:status_changed", data);
}

/**
 * Emit when a shipment is assigned to a driver
 */
export function emitShipmentAssigned(data: ShipmentAssignEvent): void {
  emitToShop(data.shopId, "shipment:assigned", data);
  emitToShipment(data.id, "shipment:assigned", data);
  emitToDriver(data.driverId, "shipment:assigned", data);
}

// ─── Order Events ───────────────────────────────────────────

/**
 * Emit when a new order is created
 */
export function emitOrderCreated(data: OrderEvent): void {
  emitToShop(data.shopId, "order:created", data);
}

/**
 * Emit when an order status changes
 */
export function emitOrderStatusChanged(data: OrderStatusEvent): void {
  emitToShop(data.shopId, "order:status_changed", data);
}

// ─── Driver Events ──────────────────────────────────────────

/**
 * Emit when a driver's status changes (online/offline/break)
 */
export function emitDriverStatusChanged(data: DriverEvent): void {
  emitToShop(data.shopId, "driver:status_changed", data);
  emitToDriver(data.driverId, "driver:status_changed", data);
}

/**
 * Emit when a driver's location updates
 */
export function emitDriverLocationUpdated(data: DriverLocationEvent): void {
  emitToShop(data.shopId, "driver:location_updated", data);
  emitToDriver(data.driverId, "driver:location_updated", data);
}

// ─── Notification Events ────────────────────────────────────

/**
 * Emit when a new notification is sent
 */
export function emitNotificationSent(data: NotificationEvent): void {
  emitToShop(data.shopId, "notification:sent", data);

  // If notification is for a specific user/driver, also emit to them
  if (data.userId) {
    // In a production system, might want to track user->socket mapping
    // For now, user rooms can be implemented similarly to driver rooms
  }
  if (data.driverId) {
    emitToDriver(data.driverId, "notification:sent", data);
  }
}

// ─── Payment Events ─────────────────────────────────────────

/**
 * Emit when a payment is received
 */
export function emitPaymentReceived(data: PaymentEvent): void {
  emitToShop(data.shopId, "payment:received", data);
}

// ─── Activity Events ────────────────────────────────────────

/**
 * Emit when a new activity log is created
 */
export function emitActivityNew(data: ActivityEvent): void {
  emitToShop(data.shopId, "activity:new", data);
}

// ─── System Health Events ───────────────────────────────────

/**
 * Emit system health metrics
 * (typically called on interval, not from route handlers)
 */
export function emitSystemHealth(data: SystemHealthEvent): void {
  // Broadcast to all connected clients
  // In a production setup, this might go to a monitoring room
  // For now, emit to all shops (handled by broadcasting to all rooms)
}

// ─── Batch Event Helpers ────────────────────────────────────

/**
 * Emit shipment created for multiple recipients
 */
export function emitShipmentsCreated(shipments: ShipmentEvent[]): void {
  // Group by shop to minimize emits
  const byShop = new Map<string, ShipmentEvent[]>();
  for (const shipment of shipments) {
    if (!byShop.has(shipment.shopId)) {
      byShop.set(shipment.shopId, []);
    }
    byShop.get(shipment.shopId)!.push(shipment);
  }

  for (const [shopId, items] of byShop) {
    for (const item of items) {
      emitShipmentCreated(item);
    }
  }
}

/**
 * Emit multiple driver location updates
 */
export function emitDriverLocationsUpdated(drivers: DriverLocationEvent[]): void {
  for (const driver of drivers) {
    emitDriverLocationUpdated(driver);
  }
}
