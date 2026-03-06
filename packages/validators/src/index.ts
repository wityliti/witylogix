/**
 * @witylogix/validators — Shared Zod schemas
 * JIT package: consuming apps transpile directly from src/
 */

import { z } from "zod";

// ─── Common ─────────────────────────────────────────────────

export const uuidSchema = z.string().uuid();
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// ─── Orders ─────────────────────────────────────────────────

export const createOrderSchema = z.object({
  shopifyOrderId: z.string().min(1),
  shopifyOrderNumber: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  deliveryDate: z.string().datetime().optional(),
  timeSlotId: z.string().uuid().optional(),
  totalPrice: z.number().nonnegative().optional(),
  totalWeight: z.number().nonnegative().optional(),
  itemCount: z.number().int().positive().default(1),
  lineItems: z.array(z.record(z.unknown())).default([]),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "PENDING", "ACCEPTED", "ASSIGNED", "PICKED_UP",
    "OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED",
    "FAILED", "RETURNED", "CANCELLED",
  ]),
  notes: z.string().optional(),
});

// ─── Drivers ────────────────────────────────────────────────

export const createDriverSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(5).max(20),
  vehicleType: z.enum(["BICYCLE", "MOTORCYCLE", "CAR", "VAN", "TRUCK"]).default("CAR"),
  vehiclePlate: z.string().optional(),
  maxCapacity: z.number().int().positive().default(20),
  maxWeight: z.number().nonnegative().optional(),
});

export const updateDriverLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().nonnegative().optional(),
  accuracy: z.number().nonnegative().optional(),
  timestamp: z.number().int().positive(),
});

// ─── Delivery Zones ─────────────────────────────────────────

export const createDeliveryZoneSchema = z.object({
  name: z.string().min(1).max(100),
  boundary: z.array(coordinatesSchema).min(3), // GeoJSON polygon ring
  baseRate: z.number().nonnegative().default(0),
  perKmRate: z.number().nonnegative().default(0),
  minOrder: z.number().nonnegative().default(0),
  freeAbove: z.number().nonnegative().optional(),
  priority: z.number().int().default(0),
});

// ─── Carrier Service ────────────────────────────────────────

export const carrierRateRequestSchema = z.object({
  rate: z.object({
    origin: z.object({
      country: z.string(),
      postal_code: z.string(),
      province: z.string(),
      city: z.string(),
    }),
    destination: z.object({
      country: z.string(),
      postal_code: z.string(),
      province: z.string(),
      city: z.string(),
      address1: z.string().optional(),
    }),
    items: z.array(z.object({
      name: z.string(),
      quantity: z.number().int().positive(),
      grams: z.number().nonnegative(),
      price: z.number().nonnegative(),
    })),
    currency: z.string().length(3),
  }),
});

// ─── Route Optimization ────────────────────────────────────

export const optimizeRouteSchema = z.object({
  depot: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().optional(),
  }),
  orderIds: z.array(z.string().uuid()).min(1).max(500),
  vehicleIds: z.array(z.string().uuid()).min(1),
  options: z.object({
    timeLimit: z.number().int().positive().max(120).default(30),
    returnToDepot: z.boolean().default(true),
  }).optional(),
});

export type CreateOrder = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatus = z.infer<typeof updateOrderStatusSchema>;
export type CreateDriver = z.infer<typeof createDriverSchema>;
export type UpdateDriverLocation = z.infer<typeof updateDriverLocationSchema>;
export type CreateDeliveryZone = z.infer<typeof createDeliveryZoneSchema>;
export type OptimizeRoute = z.infer<typeof optimizeRouteSchema>;
