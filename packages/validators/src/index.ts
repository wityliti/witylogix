/**
 * @witylogix/validators - Shared Zod schemas
 * JIT package: consuming apps transpile directly from src/
 */

import { z } from "zod";

// - Common -

export const uuidSchema = z.string().uuid();
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// - Orders -

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

// - Drivers -

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

// - Delivery Zones -

export const createDeliveryZoneSchema = z.object({
  name: z.string().min(1).max(100),
  boundary: z.array(coordinatesSchema).min(3), // GeoJSON polygon ring
  baseRate: z.number().nonnegative().default(0),
  perKmRate: z.number().nonnegative().default(0),
  minOrder: z.number().nonnegative().default(0),
  freeAbove: z.number().nonnegative().optional(),
  priority: z.number().int().default(0),
});

// - Carrier Service -

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

// - Route Optimization -

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

// ---- Shipments ----

export const createShipmentSchema = z.object({
  orderId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  deliveryMethod: z.enum(["LOCAL_DELIVERY", "STORE_PICKUP", "STANDARD_SHIPPING", "EXPRESS_SHIPPING", "SAME_DAY"]).default("LOCAL_DELIVERY"),
  recipientName: z.string().optional(),
  recipientPhone: z.string().optional(),
  recipientEmail: z.string().email().optional(),
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
  weight: z.number().nonnegative().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
    unit: z.enum(["cm", "in"]).default("cm"),
  }).optional(),
  itemCount: z.number().int().positive().default(1),
  lineItems: z.array(z.record(z.unknown())).default([]),
  shippingCost: z.number().nonnegative().optional(),
  codAmount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const updateShipmentStatusSchema = z.object({
  status: z.enum([
    "PENDING", "PROCESSING", "READY_FOR_PICKUP", "PICKED_UP",
    "IN_TRANSIT", "OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED",
    "FAILED", "RETURNED", "CANCELLED",
  ]),
  notes: z.string().optional(),
  failureReason: z.string().optional(),
});

// - Locations -

export const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["WAREHOUSE", "STORE", "HUB", "DEPOT", "PICKUP_POINT"]).default("WAREHOUSE"),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default("US"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  isDefault: z.boolean().default(false),
  operatingHours: z.record(z.object({
    open: z.string(),
    close: z.string(),
  })).optional(),
  prepTimeMinutes: z.number().int().nonnegative().default(0),
});

export type CreateShipment = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentStatus = z.infer<typeof updateShipmentStatusSchema>;
export type CreateLocation = z.infer<typeof createLocationSchema>;

// - Shipping Profiles -

export const createShippingProfileSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  deliveryMethod: z.enum(["LOCAL_DELIVERY", "STORE_PICKUP", "STANDARD_SHIPPING", "EXPRESS_SHIPPING", "SAME_DAY"]).default("LOCAL_DELIVERY"),
  isDefault: z.boolean().default(false),
  processingTimeHours: z.number().int().nonnegative().default(0),
  rateType: z.enum(["FLAT", "WEIGHT_BASED", "DISTANCE_BASED", "ZONE_BASED", "TIERED", "CALCULATED"]).default("FLAT"),
  flatRate: z.number().nonnegative().optional(),
  freeShippingAbove: z.number().nonnegative().optional(),
  minOrderAmount: z.number().nonnegative().optional(),
  rateRules: z.array(z.record(z.unknown())).default([]),
});

// - Calendar Rules -

export const createCalendarRuleSchema = z.object({
  shippingProfileId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  type: z.enum(["OPERATING_DAYS", "BLACKOUT", "SPECIAL_HOURS", "CAPACITY_OVERRIDE"]).default("OPERATING_DAYS"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([1,2,3,4,5]),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  cutoffMinutes: z.number().int().nonnegative().default(120),
  maxCapacityPerDay: z.number().int().positive().optional(),
  blackoutDates: z.array(z.string().datetime()).default([]),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  surcharge: z.number().nonnegative().default(0),
  priority: z.number().int().default(0),
});

export type CreateShippingProfile = z.infer<typeof createShippingProfileSchema>;
export type CreateCalendarRule = z.infer<typeof createCalendarRuleSchema>;

// - Notification Templates -

export const createNotificationTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/, "Slug must be lowercase alphanumeric with hyphens/underscores"),
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP", "PUSH", "WEBHOOK"]),
  eventType: z.string().min(1).max(100),
  subject: z.string().max(500).optional(),
  bodyTemplate: z.string().min(1),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    required: z.boolean().default(true),
  })).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const updateNotificationTemplateSchema = createNotificationTemplateSchema.partial().extend({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/).optional(),
});

export const previewNotificationTemplateSchema = z.object({
  bodyTemplate: z.string().min(1),
  subject: z.string().optional(),
  sampleVariables: z.record(z.unknown()).default({}),
});

export const duplicateNotificationTemplateSchema = z.object({
  newSlug: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/),
  newName: z.string().min(1).max(200).optional(),
});

export type CreateNotificationTemplate = z.infer<typeof createNotificationTemplateSchema>;
export type UpdateNotificationTemplate = z.infer<typeof updateNotificationTemplateSchema>;
export type PreviewNotificationTemplate = z.infer<typeof previewNotificationTemplateSchema>;
export type DuplicateNotificationTemplate = z.infer<typeof duplicateNotificationTemplateSchema>;

// - Activity Logs -
export const createActivityLogSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid(),
  action: z.string().min(1).max(100),
  actorType: z.enum(["USER", "SYSTEM", "WEBHOOK", "API", "CRON"]),
  actorId: z.string().uuid().optional(),
  changes: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
  ipAddress: z.string().ip().optional(),
  shipmentId: z.string().uuid().optional(),
});
export const activityLogFilterSchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  action: z.string().optional(),
  actorType: z.string().optional(),
  actorId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type CreateActivityLog = z.infer<typeof createActivityLogSchema>;
export type ActivityLogFilter = z.infer<typeof activityLogFilterSchema>;

// - Payments -
export const createPaymentSchema = z.object({
  shipmentId: z.string().uuid().optional(),
  paymentType: z.enum(["DELIVERY", "COD", "SUBSCRIPTION", "ADDON", "REFUND"]),
  paymentMethod: z.enum(["STRIPE", "PAYPAL", "CASH", "BANK_TRANSFER", "SHOPIFY_PAYMENTS", "OTHER"]),
  amount: z.number().positive().multipleOf(0.01),
  currency: z.string().length(3).default("USD"),
  externalRef: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).default({}),
});
export const updatePaymentStatusSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED", "CANCELLED"]),
  externalRef: z.string().max(200).optional(),
});
export const paymentFilterSchema = z.object({
  status: z.string().optional(),
  paymentType: z.string().optional(),
  paymentMethod: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type CreatePayment = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentStatus = z.infer<typeof updatePaymentStatusSchema>;
export type PaymentFilter = z.infer<typeof paymentFilterSchema>;

// - Products (Cache Sync) -
export const syncProductSchema = z.object({
  externalId: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  sku: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  weight: z.number().positive().optional(),
  weightUnit: z.enum(["g", "kg", "lb", "oz"]).optional(),
  requiresShipping: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
});
export const syncProductsSchema = z.object({
  products: z.array(syncProductSchema).min(1).max(250),
});

// - Customers (Cache Sync) -
export const syncCustomerSchema = z.object({
  externalId: z.string().min(1).max(200),
  email: z.string().email().optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  defaultAddress: z.record(z.unknown()).optional(),
  orderCount: z.number().int().min(0).default(0),
  totalSpent: z.number().min(0).default(0),
  metadata: z.record(z.unknown()).default({}),
});
export const syncCustomersSchema = z.object({
  customers: z.array(syncCustomerSchema).min(1).max(250),
});
export type SyncProduct = z.infer<typeof syncProductSchema>;
export type SyncCustomer = z.infer<typeof syncCustomerSchema>;

// Schema re-exports for bundler visibility

// Type exports (moved to end to avoid vitest parsing issues)
export type CreateActivityLog = z.infer<typeof createActivityLogSchema>;
export type ActivityLogFilter = z.infer<typeof activityLogFilterSchema>;
export type CreateOrder = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatus = z.infer<typeof updateOrderStatusSchema>;
export type CreateDriver = z.infer<typeof createDriverSchema>;
export type UpdateDriverLocation = z.infer<typeof updateDriverLocationSchema>;
export type CreateDeliveryZone = z.infer<typeof createDeliveryZoneSchema>;
export type OptimizeRoute = z.infer<typeof optimizeRouteSchema>;
