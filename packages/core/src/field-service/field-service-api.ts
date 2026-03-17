/**
 * Field Service API — REST endpoints for work order, technician, scheduling, and dispatch.
 *
 * Provides 14+ endpoints with Zod validation:
 * - Work Orders (CRUD, assign, dispatch, complete)
 * - Scheduling (find slots, batch schedule, recurring)
 * - Dispatch (auto, manual, route optimization)
 * - Technicians (availability, performance)
 * - SLA (status, reports)
 *
 * All endpoints use TypeScript for type safety and validation schemas.
 * Error responses follow standard format with error codes and user-friendly messages.
 */

import { z } from "zod";
import type {
  WorkOrder,
  Technician,
  DispatchResult,
  OptimizedRoute,
  JobSchedule,
  SLAStatus,
} from "./field-service-types.js";

// ─── VALIDATION SCHEMAS ─────────────────────────────────────────

// Common patterns
const uuidSchema = z.string().uuid("Invalid UUID format");
const addressSchema = z.object({
  street: z.string().min(1).max(255),
  street2: z.string().optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  notes: z.string().optional(),
});

const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// ─── WORK ORDER SCHEMAS ─────────────────────────────────────────

export const createWorkOrderSchema = z.object({
  customerId: uuidSchema,
  type: z.enum(["SERVICE", "INSTALL", "REPAIR", "MAINTENANCE", "INSPECTION"]),
  priority: z.enum(["EMERGENCY", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  description: z.string().min(1).max(2000),
  requiredSkills: z.array(z.string()).default([]),
  estimatedDuration: z.number().int().min(15).max(1440), // 15 min to 24 hours
  address: addressSchema,
  slaRuleId: uuidSchema,
});

export const updateWorkOrderSchema = createWorkOrderSchema.partial();

export const assignWorkOrderSchema = z.object({
  technicianId: uuidSchema,
  scheduledStart: z.string().datetime(),
});

export const completeWorkOrderSchema = z.object({
  actualDuration: z.number().int().min(1),
  notes: z.array(z.string()).optional(),
  customerSignatureName: z.string().optional(),
  customerSignatureData: z.string().optional(),
});

// ─── TECHNICIAN SCHEMAS ─────────────────────────────────────────

export const createTechnicianSchema = z.object({
  name: z.string().min(1).max(255),
  skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  homeBase: addressSchema,
  currentLocation: coordinatesSchema,
  workingHours: z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    daysOfWeek: z.array(z.number().min(0).max(6)),
    timezone: z.string(),
  }),
  serviceZones: z.array(uuidSchema).default([]),
  vehicleId: uuidSchema.optional(),
});

export const updateTechnicianLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const updateTechnicianStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "EN_ROUTE", "ON_JOB", "BREAK", "OFF_DUTY"]),
});

// ─── SCHEDULING SCHEMAS ─────────────────────────────────────────

export const findAvailableSlotsSchema = z.object({
  technicianId: uuidSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minDurationMinutes: z.number().int().min(15),
  maxSlots: z.number().int().min(1).max(20).default(10),
});

export const batchScheduleSchema = z.object({
  jobIds: z.array(uuidSchema).min(1).max(1000),
  slaRuleId: uuidSchema,
});

export const recurringScheduleSchema = z.object({
  customerId: uuidSchema,
  description: z.string().min(1).max(2000),
  type: z.enum(["SERVICE", "INSTALL", "REPAIR", "MAINTENANCE", "INSPECTION"]),
  requiredSkills: z.array(z.string()).default([]),
  address: addressSchema,
  estimatedDuration: z.number().int().min(15).max(1440),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY"]),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string(),
  slaRuleId: uuidSchema,
  endDate: z.string().datetime().optional(),
});

// ─── DISPATCH SCHEMAS ────────────────────────────────────────────

export const autoDispatchSchema = z.object({
  jobId: uuidSchema,
  strategy: z.enum(["nearest", "balanced", "priority"]).default("balanced"),
});

export const manualDispatchSchema = z.object({
  jobId: uuidSchema,
  technicianId: uuidSchema,
  scheduledStart: z.string().datetime(),
});

export const optimizeRouteSchema = z.object({
  technicianId: uuidSchema,
  jobIds: z.array(uuidSchema).min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ─── SLA SCHEMAS ─────────────────────────────────────────────────

export const slaStatusQuerySchema = z.object({
  jobId: uuidSchema,
});

export const slaReportSchema = z.object({
  customerId: uuidSchema.optional(),
  technicianId: uuidSchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ─── API ERROR TYPES ────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    duration: number;
  };
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public httpStatus: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── ENDPOINT DEFINITIONS ───────────────────────────────────────

/**
 * Field Service API endpoints.
 * Each endpoint definition includes path, method, validation schema, and response type.
 */
export const fieldServiceEndpoints = {
  // ─── WORK ORDER ENDPOINTS ──────────────────────────────────────

  /**
   * POST /api/field-service/work-orders
   * Create new work order.
   */
  createWorkOrder: {
    method: "POST",
    path: "/api/field-service/work-orders",
    validation: createWorkOrderSchema,
    response: z.object({
      id: uuidSchema,
      customerId: uuidSchema,
      status: z.enum([
        "CREATED",
        "SCHEDULED",
        "DISPATCHED",
        "EN_ROUTE",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ]),
      createdAt: z.string().datetime(),
    }),
  },

  /**
   * GET /api/field-service/work-orders/:id
   * Get work order details.
   */
  getWorkOrder: {
    method: "GET",
    path: "/api/field-service/work-orders/:id",
    params: z.object({ id: uuidSchema }),
    response: z.object({
      id: uuidSchema,
      customerId: uuidSchema,
      type: z.enum(["SERVICE", "INSTALL", "REPAIR", "MAINTENANCE", "INSPECTION"]),
      priority: z.enum(["EMERGENCY", "HIGH", "MEDIUM", "LOW"]),
      status: z.enum([
        "CREATED",
        "SCHEDULED",
        "DISPATCHED",
        "EN_ROUTE",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ]),
      description: z.string(),
      requiredSkills: z.array(z.string()),
      technicianId: uuidSchema.optional(),
    }),
  },

  /**
   * PATCH /api/field-service/work-orders/:id
   * Update work order.
   */
  updateWorkOrder: {
    method: "PATCH",
    path: "/api/field-service/work-orders/:id",
    params: z.object({ id: uuidSchema }),
    validation: updateWorkOrderSchema,
    response: z.object({
      id: uuidSchema,
      status: z.enum([
        "CREATED",
        "SCHEDULED",
        "DISPATCHED",
        "EN_ROUTE",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ]),
      updatedAt: z.string().datetime(),
    }),
  },

  /**
   * POST /api/field-service/work-orders/:id/assign
   * Assign work order to technician.
   */
  assignWorkOrder: {
    method: "POST",
    path: "/api/field-service/work-orders/:id/assign",
    params: z.object({ id: uuidSchema }),
    validation: assignWorkOrderSchema,
    response: z.object({
      id: uuidSchema,
      technicianId: uuidSchema,
      status: z.literal("SCHEDULED"),
      scheduledStart: z.string().datetime(),
    }),
  },

  /**
   * POST /api/field-service/work-orders/:id/dispatch
   * Dispatch work order to technician.
   */
  dispatchWorkOrder: {
    method: "POST",
    path: "/api/field-service/work-orders/:id/dispatch",
    params: z.object({ id: uuidSchema }),
    response: z.object({
      jobId: uuidSchema,
      technicianId: uuidSchema,
      status: z.literal("DISPATCHED"),
      eta: z.string().datetime(),
      travelMinutes: z.number(),
    }),
  },

  /**
   * POST /api/field-service/work-orders/:id/complete
   * Mark work order as completed.
   */
  completeWorkOrder: {
    method: "POST",
    path: "/api/field-service/work-orders/:id/complete",
    params: z.object({ id: uuidSchema }),
    validation: completeWorkOrderSchema,
    response: z.object({
      id: uuidSchema,
      status: z.literal("COMPLETED"),
      invoiceId: uuidSchema.optional(),
      completedAt: z.string().datetime(),
    }),
  },

  /**
   * POST /api/field-service/work-orders/:id/cancel
   * Cancel work order.
   */
  cancelWorkOrder: {
    method: "POST",
    path: "/api/field-service/work-orders/:id/cancel",
    params: z.object({ id: uuidSchema }),
    validation: z.object({ reason: z.string().optional() }),
    response: z.object({
      id: uuidSchema,
      status: z.literal("CANCELLED"),
    }),
  },

  /**
   * GET /api/field-service/work-orders
   * List work orders with filtering.
   */
  listWorkOrders: {
    method: "GET",
    path: "/api/field-service/work-orders",
    query: z.object({
      customerId: uuidSchema.optional(),
      status: z.enum([
        "CREATED",
        "SCHEDULED",
        "DISPATCHED",
        "EN_ROUTE",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ]).optional(),
      technicianId: uuidSchema.optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    }),
    response: z.object({
      items: z.array(z.object({ id: uuidSchema })),
      pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      }),
    }),
  },

  // ─── TECHNICIAN ENDPOINTS ──────────────────────────────────────

  /**
   * POST /api/field-service/technicians
   * Create new technician.
   */
  createTechnician: {
    method: "POST",
    path: "/api/field-service/technicians",
    validation: createTechnicianSchema,
    response: z.object({
      id: uuidSchema,
      name: z.string(),
      status: z.enum(["AVAILABLE", "EN_ROUTE", "ON_JOB", "BREAK", "OFF_DUTY"]),
    }),
  },

  /**
   * GET /api/field-service/technicians/:id
   * Get technician details.
   */
  getTechnician: {
    method: "GET",
    path: "/api/field-service/technicians/:id",
    params: z.object({ id: uuidSchema }),
    response: z.object({
      id: uuidSchema,
      name: z.string(),
      skills: z.array(z.string()),
      status: z.enum(["AVAILABLE", "EN_ROUTE", "ON_JOB", "BREAK", "OFF_DUTY"]),
    }),
  },

  /**
   * PATCH /api/field-service/technicians/:id/location
   * Update technician's current location.
   */
  updateTechnicianLocation: {
    method: "PATCH",
    path: "/api/field-service/technicians/:id/location",
    params: z.object({ id: uuidSchema }),
    validation: updateTechnicianLocationSchema,
    response: z.object({
      id: uuidSchema,
      currentLocation: coordinatesSchema,
      updatedAt: z.string().datetime(),
    }),
  },

  /**
   * PATCH /api/field-service/technicians/:id/status
   * Update technician's status.
   */
  updateTechnicianStatus: {
    method: "PATCH",
    path: "/api/field-service/technicians/:id/status",
    params: z.object({ id: uuidSchema }),
    validation: updateTechnicianStatusSchema,
    response: z.object({
      id: uuidSchema,
      status: z.enum(["AVAILABLE", "EN_ROUTE", "ON_JOB", "BREAK", "OFF_DUTY"]),
    }),
  },

  /**
   * GET /api/field-service/technicians/:id/performance
   * Get technician performance metrics.
   */
  getTechnicianPerformance: {
    method: "GET",
    path: "/api/field-service/technicians/:id/performance",
    params: z.object({ id: uuidSchema }),
    response: z.object({
      technicianId: uuidSchema,
      totalJobsCompleted: z.number(),
      averageRating: z.number().min(1).max(5),
      slaComplianceRate: z.number().min(0).max(100),
      utilizationRate30d: z.number().min(0).max(100),
    }),
  },

  /**
   * GET /api/field-service/technicians
   * List technicians with filtering.
   */
  listTechnicians: {
    method: "GET",
    path: "/api/field-service/technicians",
    query: z.object({
      status: z.enum(["AVAILABLE", "EN_ROUTE", "ON_JOB", "BREAK", "OFF_DUTY"]).optional(),
      skill: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    }),
    response: z.object({
      items: z.array(z.object({ id: uuidSchema })),
      pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      }),
    }),
  },

  // ─── SCHEDULING ENDPOINTS ──────────────────────────────────────

  /**
   * GET /api/field-service/scheduling/available-slots
   * Find available time slots for technician.
   */
  findAvailableSlots: {
    method: "GET",
    path: "/api/field-service/scheduling/available-slots",
    query: findAvailableSlotsSchema,
    response: z.object({
      technicianId: uuidSchema,
      date: z.string(),
      slots: z.array(
        z.object({
          startTime: z.string().datetime(),
          endTime: z.string().datetime(),
          durationMinutes: z.number(),
        })
      ),
    }),
  },

  /**
   * POST /api/field-service/scheduling/batch-schedule
   * Schedule multiple work orders optimally.
   */
  batchSchedule: {
    method: "POST",
    path: "/api/field-service/scheduling/batch-schedule",
    validation: batchScheduleSchema,
    response: z.object({
      successCount: z.number(),
      failedCount: z.number(),
      violations: z.array(
        z.object({
          jobId: uuidSchema.optional(),
          type: z.string(),
          message: z.string(),
          severity: z.enum(["WARNING", "ERROR"]),
        })
      ),
      executionTimeMs: z.number(),
    }),
  },

  /**
   * POST /api/field-service/scheduling/recurring
   * Create recurring service plan.
   */
  createRecurringPlan: {
    method: "POST",
    path: "/api/field-service/scheduling/recurring",
    validation: recurringScheduleSchema,
    response: z.object({
      id: uuidSchema,
      customerId: uuidSchema,
      frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY"]),
      active: z.boolean(),
    }),
  },

  // ─── DISPATCH ENDPOINTS ────────────────────────────────────────

  /**
   * POST /api/field-service/dispatch/auto
   * Auto-dispatch work order using selected strategy.
   */
  autoDispatch: {
    method: "POST",
    path: "/api/field-service/dispatch/auto",
    validation: autoDispatchSchema,
    response: z.object({
      jobId: uuidSchema,
      technicianId: uuidSchema,
      score: z.number(),
      reason: z.string(),
      eta: z.string().datetime(),
      distance: z.number(),
    }),
  },

  /**
   * POST /api/field-service/dispatch/manual
   * Manually assign work order to technician.
   */
  manualDispatch: {
    method: "POST",
    path: "/api/field-service/dispatch/manual",
    validation: manualDispatchSchema,
    response: z.object({
      jobId: uuidSchema,
      technicianId: uuidSchema,
      status: z.literal("DISPATCHED"),
    }),
  },

  /**
   * POST /api/field-service/dispatch/optimize-route
   * Generate optimized route for technician.
   */
  optimizeRoute: {
    method: "POST",
    path: "/api/field-service/dispatch/optimize-route",
    validation: optimizeRouteSchema,
    response: z.object({
      technicianId: uuidSchema,
      date: z.string(),
      stops: z.array(
        z.object({
          sequence: z.number(),
          jobId: uuidSchema,
          eta: z.string().datetime(),
        })
      ),
      totalDistance: z.number(),
      totalDuration: z.number(),
      efficiencyScore: z.number(),
    }),
  },

  // ─── SLA ENDPOINTS ─────────────────────────────────────────────

  /**
   * GET /api/field-service/sla/status/:jobId
   * Get SLA status for work order.
   */
  getSLAStatus: {
    method: "GET",
    path: "/api/field-service/sla/status/:jobId",
    params: z.object({ jobId: uuidSchema }),
    response: z.object({
      jobId: uuidSchema,
      priority: z.enum(["EMERGENCY", "HIGH", "MEDIUM", "LOW"]),
      responseDeadline: z.string().datetime(),
      completionDeadline: z.string().datetime(),
      breached: z.boolean(),
      statusPercent: z.number().min(0).max(100),
    }),
  },

  /**
   * GET /api/field-service/sla/report
   * Generate SLA compliance report.
   */
  getSLAReport: {
    method: "GET",
    path: "/api/field-service/sla/report",
    query: slaReportSchema,
    response: z.object({
      totalJobs: z.number(),
      compliantJobs: z.number(),
      breachedJobs: z.number(),
      complianceRate: z.number().min(0).max(100),
      criticalAlerts: z.number(),
    }),
  },
};

// ─── HANDLER DEFINITIONS ────────────────────────────────────────

/**
 * Abstract handler for field service endpoints.
 * Concrete implementations should extend this and implement handle().
 */
export abstract class FieldServiceHandler<T> {
  abstract handle(req: {
    params?: Record<string, string>;
    query?: Record<string, unknown>;
    body?: unknown;
  }): Promise<ApiResponse<T>>;

  protected validateRequest<S>(schema: z.ZodSchema<S>, data: unknown): S {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "Request validation failed",
        400,
        Object.fromEntries(
          result.error.issues.map((issue) => [
            issue.path.join("."),
            issue.message,
          ])
        )
      );
    }
    return result.data;
  }

  protected response<D>(data: D, duration: number): ApiResponse<D> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        duration,
      },
    };
  }

  protected error(error: ApiError | Error, duration: number): ApiResponse<never> {
    if (error instanceof ApiError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        meta: {
          timestamp: new Date().toISOString(),
          duration,
        },
      };
    }

    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        duration,
      },
    };
  }
}
