/**
 * Comprehensive Zod validation schemas for all API endpoints.
 * Organized by domain with consistent patterns and error messages.
 *
 * Usage:
 *   const result = orderCreateSchema.parse(request.body);
 *   const validated = orderListSchema.safeParse(query);
 */

import { z } from "zod";

// ─── COMMON PATTERNS ────────────────────────────────────────────

export const idParam = z.string().uuid("Invalid UUID format");
export const slugParam = z.string().min(1).max(100);
export const email = z.string().email("Invalid email format").toLowerCase();
export const phone = z
  .string()
  .regex(/^\+?1?\d{9,15}$/, "Invalid phone format");
export const iso8601DateTime = z.string().datetime("Invalid ISO 8601 datetime");
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");

// Pagination & Search
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

export const searchQuery = z
  .object({
    q: z.string().min(1).max(200).optional(),
    filter: z.record(z.string()).optional(),
    sortBy: z.string().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .merge(pagination);

export const bulkAction = z.object({
  ids: z.array(idParam).min(1).max(1000),
  action: z.string(),
});

export const exportRequest = z.object({
  format: z.enum(["csv", "json", "xlsx"]),
  fields: z.array(z.string()).optional(),
  filters: z.record(z.any()).optional(),
});

// Geographic
export const coordinates = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const address = z.object({
  street: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2, "Use 2-letter country code"),
  coordinates: coordinates.optional(),
});

// Polygon for zones (GeoJSON)
export const polygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
});

// ─── ORDER SCHEMAS ──────────────────────────────────────────────

const baseOrder = {
  referenceId: z.string().min(1).max(100).optional(),
  customerId: idParam.optional(),
  customerName: z.string().min(1).max(255),
  customerEmail: email.optional(),
  customerPhone: phone,
  shippingAddress: address,
  billingAddress: address.optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        sku: z.string().min(1).max(100),
        quantity: z.number().int().min(1),
        price: z.number().min(0),
        weight: z.number().min(0).optional(),
      }),
    )
    .min(1),
  totalAmount: z.number().min(0),
  currency: z.string().length(3),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
};

export const orderCreateSchema = z.object({
  ...baseOrder,
  driverId: idParam.optional(),
  assignmentPriority: z
    .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
    .default("MEDIUM"),
  scheduledDate: date.optional(),
});

export const orderUpdateSchema = z.object({
  customerName: z.string().min(1).max(255).optional(),
  customerPhone: phone.optional(),
  shippingAddress: address.optional(),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
});

export const orderListSchema = pagination.extend({
  status: z
    .enum([
      "PENDING",
      "ASSIGNED",
      "IN_PROGRESS",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
    ])
    .optional(),
  driverId: idParam.optional(),
  createdAfter: iso8601DateTime.optional(),
  createdBefore: iso8601DateTime.optional(),
  search: z.string().max(100).optional(),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum([
    "PENDING",
    "ASSIGNED",
    "IN_PROGRESS",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
  ]),
  reason: z.string().max(500).optional(),
});

export const orderQuerySchema = z.object({
  fields: z.array(z.string()).optional(),
  include: z.array(z.enum(["driver", "items", "timeline", "proof"])).optional(),
});

// ─── DRIVER SCHEMAS ────────────────────────────────────────────

export const driverCreateSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: email,
  phone: phone,
  licenseNumber: z.string().min(1).max(50),
  licenseExpiry: date,
  vehicleType: z.enum(["VAN", "TRUCK", "CAR", "BIKE", "SCOOTER"]),
  vehicleRegistration: z.string().min(1).max(50).optional(),
  insurance: z
    .object({
      provider: z.string().min(1).max(100),
      policyNumber: z.string().min(1).max(100),
      expiryDate: date,
    })
    .optional(),
  baseLocation: coordinates,
  metadata: z.record(z.any()).optional(),
});

export const driverUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: email.optional(),
  phone: phone.optional(),
  licenseExpiry: date.optional(),
  vehicleType: z.enum(["VAN", "TRUCK", "CAR", "BIKE", "SCOOTER"]).optional(),
  baseLocation: coordinates.optional(),
  metadata: z.record(z.any()).optional(),
});

export const driverLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  timestamp: iso8601DateTime,
});

export const driverStatusSchema = z.object({
  status: z.enum([
    "AVAILABLE",
    "ON_DUTY",
    "ON_BREAK",
    "OFF_DUTY",
    "UNAVAILABLE",
  ]),
  reason: z.string().max(200).optional(),
});

export const driverListSchema = pagination.extend({
  status: z.enum(["AVAILABLE", "ON_DUTY", "UNAVAILABLE"]).optional(),
  vehicleType: z.enum(["VAN", "TRUCK", "CAR", "BIKE", "SCOOTER"]).optional(),
  search: z.string().max(100).optional(),
});

// ─── DELIVERY SCHEMAS ───────────────────────────────────────────

export const deliveryCreateSchema = z.object({
  orderId: idParam.optional(),
  recipientName: z.string().min(1).max(255),
  recipientPhone: phone,
  address: address,
  deliveryType: z.enum(["STANDARD", "EXPRESS", "SAME_DAY", "SCHEDULED"]),
  scheduledDate: date.optional(),
  scheduledWindow: z
    .object({
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .optional(),
  specialInstructions: z.string().max(1000).optional(),
  proofRequired: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

export const deliveryAssignSchema = z.object({
  driverId: idParam,
  estimatedArrival: iso8601DateTime.optional(),
  notes: z.string().max(500).optional(),
});

export const deliveryProofSchema = z.object({
  proofType: z.enum(["SIGNATURE", "PHOTO", "BOTH", "NONE"]),
  signatureUrl: z.string().url().optional(),
  photoUrls: z.array(z.string().url()).optional(),
  notes: z.string().max(500).optional(),
  temperature: z.number().optional(),
  humidity: z.number().min(0).max(100).optional(),
});

export const deliveryCompleteSchema = z.object({
  status: z.enum(["COMPLETED", "FAILED", "RESCHEDULED"]),
  proof: deliveryProofSchema.optional(),
  failureReason: z.string().max(500).optional(),
  rescheduleDate: date.optional(),
});

export const deliveryListSchema = pagination.extend({
  status: z
    .enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "FAILED"])
    .optional(),
  driverId: idParam.optional(),
  createdAfter: iso8601DateTime.optional(),
  createdBefore: iso8601DateTime.optional(),
});

// ─── ZONE SCHEMAS ───────────────────────────────────────────────

export const zoneCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  polygon: polygon,
  serviceLevel: z.enum(["STANDARD", "EXPRESS", "PREMIUM"]),
  operatingHours: z
    .object({
      monday: z
        .object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        })
        .optional(),
      tuesday: z
        .object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        })
        .optional(),
      wednesday: z
        .object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        })
        .optional(),
      thursday: z
        .object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        })
        .optional(),
      friday: z
        .object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        })
        .optional(),
      saturday: z
        .object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        })
        .optional(),
      sunday: z
        .object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        })
        .optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

export const zoneUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  polygon: polygon.optional(),
  serviceLevel: z.enum(["STANDARD", "EXPRESS", "PREMIUM"]).optional(),
  metadata: z.record(z.any()).optional(),
});

export const zoneQuerySchema = pagination.extend({
  serviceLevel: z.enum(["STANDARD", "EXPRESS", "PREMIUM"]).optional(),
  search: z.string().max(100).optional(),
});

export const zonePointValidationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// ─── ORGANIZATION SCHEMAS ──────────────────────────────────────

export const organizationCreateSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  email: email,
  phone: phone.optional(),
  website: z.string().url().optional(),
  address: address.optional(),
  logo: z.string().url().optional(),
  timezone: z.string().default("UTC"),
  currency: z.string().length(3).default("USD"),
  metadata: z.record(z.any()).optional(),
});

export const organizationUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: email.optional(),
  phone: phone.optional(),
  website: z.string().url().optional(),
  address: address.optional(),
  logo: z.string().url().optional(),
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
  metadata: z.record(z.any()).optional(),
});

export const inviteMemberSchema = z.object({
  email: email,
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "USER", "VIEWER"]),
  message: z.string().max(500).optional(),
});

// ─── INTEGRATION SCHEMAS ───────────────────────────────────────

export const installIntegrationSchema = z.object({
  type: z.string().min(1).max(50),
  credentials: z.record(z.any()),
  webhookUrl: z.string().url().optional(),
});

export const configureIntegrationSchema = z.object({
  settings: z.record(z.any()),
  enabled: z.boolean().optional(),
  webhooks: z.array(z.string()).optional(),
});

export const webhookPayloadSchema = z.object({
  event: z.string().min(1).max(100),
  timestamp: iso8601DateTime,
  data: z.record(z.any()),
  signature: z.string().optional(),
});

export const integrationListSchema = pagination.extend({
  enabled: z.boolean().optional(),
  type: z.string().optional(),
});

// ─── COMMON BATCH/BULK SCHEMAS ────────────────────────────────

export const bulkOrderCreateSchema = z.object({
  orders: z.array(orderCreateSchema).min(1).max(1000),
  sendNotifications: z.boolean().default(true),
});

export const bulkActionSchema = z.object({
  ids: z.array(idParam).min(1).max(1000),
  action: z.enum(["assign", "cancel", "complete", "reschedule"]),
  data: z.record(z.any()).optional(),
});

// ─── ROUTE & STOP SCHEMAS ──────────────────────────────────────

export const routeCreateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  date: date,
  driverId: idParam.optional(),
  startAddress: address.optional(),
  orderIds: z.array(idParam).optional(),
});

export const routeAddStopsSchema = z.object({
  stops: z
    .array(
      z.object({
        orderId: idParam.optional(),
        sequence: z.number().int().nonnegative(),
        stopType: z
          .enum(["PICKUP", "DELIVERY", "RETURN", "DEPOT"])
          .default("DELIVERY"),
      }),
    )
    .min(1)
    .max(500),
});

export const routeOptimizeSchema = z.object({
  algorithm: z
    .enum(["NEAREST_NEIGHBOR", "GENETIC", "SIMULATED_ANNEALING"])
    .default("GENETIC"),
  constraints: z
    .object({
      maxDrivingTime: z.number().min(1).optional(),
      maxStops: z.number().min(1).optional(),
      maxDistance: z.number().min(1).optional(),
      timeWindows: z.boolean().default(true),
    })
    .optional(),
});

// ─── EXPORT & BULK SCHEMAS ────────────────────────────────────

export const exportDataSchema = z.object({
  resource: z.string().min(1),
  format: z.enum(["csv", "json", "xlsx"]),
  filters: z.record(z.any()).optional(),
  fields: z.array(z.string()).optional(),
  dateRange: z
    .object({
      start: iso8601DateTime,
      end: iso8601DateTime,
    })
    .optional(),
});

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────

/**
 * Create a paginated response type from a base schema
 */
export const paginatedResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });

/**
 * Create a standard API response wrapper
 */
export const apiResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    metadata: z
      .object({
        timestamp: iso8601DateTime,
        version: z.string(),
      })
      .optional(),
  });

/**
 * Create an error response schema
 */
export const errorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.any()).optional(),
    requestId: z.string().optional(),
  }),
});

// ─── EXPORT TYPE HELPERS ────────────────────────────────────────

export type OrderCreate = z.infer<typeof orderCreateSchema>;
export type OrderUpdate = z.infer<typeof orderUpdateSchema>;
export type OrderList = z.infer<typeof orderListSchema>;

export type DriverCreate = z.infer<typeof driverCreateSchema>;
export type DriverUpdate = z.infer<typeof driverUpdateSchema>;
export type DriverLocation = z.infer<typeof driverLocationSchema>;

export type DeliveryCreate = z.infer<typeof deliveryCreateSchema>;
export type DeliveryComplete = z.infer<typeof deliveryCompleteSchema>;
export type DeliveryProof = z.infer<typeof deliveryProofSchema>;

export type ZoneCreate = z.infer<typeof zoneCreateSchema>;
export type ZoneUpdate = z.infer<typeof zoneUpdateSchema>;

export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;
export type InviteMember = z.infer<typeof inviteMemberSchema>;

export type SearchQuery = z.infer<typeof searchQuery>;
export type Pagination = z.infer<typeof pagination>;
export type BulkAction = z.infer<typeof bulkAction>;
