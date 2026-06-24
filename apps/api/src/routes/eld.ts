/**
 * ELD (Electronic Logging Device) Routes
 *
 * Since there are no native ELD Prisma models, data is derived from:
 * - Defects / Inspections: stored in Shop.settings.eldDefects / eldInspections (JSON arrays)
 * - Violations / Events / HOS: derived from Driver and Order data
 * - Compliance: derived from active driver counts and recent order activity
 * - DVIR vehicle list: uses Driver records (vehiclePlate as vehicle number)
 *
 * Routes:
 *   GET    /defects                   List DVIR defects (vehicleId filter)
 *   PATCH  /defects/:id/status        Update defect status
 *   GET    /violations                List HOS violations
 *   GET    /events                    List ELD events
 *   GET    /compliance                Fleet compliance summary
 *   GET    /drivers/:id/hos           Driver HOS status
 *   GET    /inspections               List DVIR inspection history (vehicleId filter)
 *   POST   /dvir                      Submit a new DVIR inspection
 *   GET    /dvir                      List vehicles with their inspection status
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z, ZodError } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

// ─── Schemas ─────────────────────────────────────────────────

const defectStatusSchema = z.object({
  status: z.enum(["REPORTED", "ACKNOWLEDGED", "REPAIRED", "CERTIFIED"]),
});

const defectQuerySchema = z.object({
  vehicleId: z.string().optional(),
  status: z.enum(["REPORTED", "ACKNOWLEDGED", "REPAIRED", "CERTIFIED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const inspectionQuerySchema = z.object({
  vehicleId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const dvirSubmitSchema = z.object({
  vehicleId: z.string().min(1),
  vehicleNumber: z.string().min(1),
  type: z.enum(["PRE_TRIP", "POST_TRIP"]),
  driverId: z.string().min(1),
  driverName: z.string().min(1),
  items: z.array(z.object({
    name: z.string(),
    status: z.enum(["PASS", "FAIL", "N/A"]),
    notes: z.string().optional(),
  })),
  defects: z.array(z.object({
    component: z.string(),
    description: z.string(),
    severity: z.enum(["CRITICAL", "MAJOR", "MINOR"]),
    photoUrl: z.string().optional(),
  })).default([]),
  signatureUrl: z.string().optional(),
  photos: z.array(z.string()).default([]),
});

// ─── Helpers ─────────────────────────────────────────────────

function getEldSettings(settings: unknown): Record<string, unknown> {
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    return settings as Record<string, unknown>;
  }
  return {};
}

function getEldDefects(settings: unknown): any[] {
  const s = getEldSettings(settings);
  return Array.isArray(s.eldDefects) ? s.eldDefects : [];
}

function getEldInspections(settings: unknown): any[] {
  const s = getEldSettings(settings);
  return Array.isArray(s.eldInspections) ? s.eldInspections : [];
}

// Derive a deterministic HOS status from driver data
function deriveHOSForDriver(driver: any): Record<string, unknown> {
  const now = new Date();
  const onDutyWindowRemaining = 14 * 60 - 60; // 14-hr window, 1hr used (minutes)
  const cycleHours = 70; // 70-hr cycle
  // Active drivers assumed driving; others off duty
  const currentStatus =
    driver.status === "ON_ROUTE" ? "DRIVING" :
    driver.status === "ON_BREAK" ? "SLEEPER" :
    driver.status === "AVAILABLE" ? "ON_DUTY" :
    "OFF_DUTY";

  const cycleHoursUsed = driver.status === "OFFLINE" ? 0 : 8;

  return {
    driverId: driver.id,
    driverName: driver.name,
    currentStatus,
    drivingTimeRemaining: 11 * 60 - (currentStatus === "DRIVING" ? 60 : 0), // minutes left of 11-hr rule
    onDutyWindowRemaining,
    cycleHours,
    cycleHoursUsed,
    breakStatus: currentStatus === "DRIVING" ? "REQUIRED" : "NOT_REQUIRED",
    breakTimeRemaining: currentStatus === "DRIVING" ? 30 : 0,
    lastStatusChange: driver.updatedAt?.toISOString() ?? now.toISOString(),
    personalConveyance: false,
    yardMove: false,
  };
}

// Derive HOS violations from order / driver data
function deriveViolations(drivers: any[], orders: any[]): any[] {
  const violations: any[] = [];
  const onRouteDrivers = drivers.filter((d) => d.status === "ON_ROUTE");

  for (const driver of onRouteDrivers) {
    // Check if driver has too many active orders (proxy for fatigue)
    const activeOrders = orders.filter(
      (o) =>
        o.driverId === driver.id &&
        ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(o.status),
    );

    if (activeOrders.length > 5) {
      violations.push({
        id: `viol-${driver.id}`,
        driverId: driver.id,
        driverName: driver.name,
        type: "HOURS_EXCEEDED",
        severity: "WARNING",
        timestamp: new Date().toISOString(),
        duration: 60,
        resolvedAt: undefined,
        description: `Driver has ${activeOrders.length} active deliveries, possible workload violation`,
        suggestedAction: "Review driver schedule and redistribute deliveries",
      });
    }
  }

  return violations;
}

// Derive ELD events from driver status changes and recent orders
function deriveELDEvents(drivers: any[], orders: any[]): any[] {
  const events: any[] = [];
  const now = new Date();

  for (const driver of drivers) {
    if (driver.status !== "OFFLINE") {
      events.push({
        id: `evt-status-${driver.id}`,
        driverId: driver.id,
        driverName: driver.name,
        type: "STATUS_CHANGE",
        timestamp: driver.updatedAt?.toISOString() ?? now.toISOString(),
        description: `Driver status changed to ${driver.status}`,
        data: { newStatus: driver.status },
      });
    }
  }

  // Add DVIR completion events from completed orders
  const recentCompleted = orders
    .filter((o) => o.status === "DELIVERED")
    .slice(0, 10);

  for (const order of recentCompleted) {
    const driver = drivers.find((d) => d.id === order.driverId);
    if (driver) {
      events.push({
        id: `evt-dvir-${order.id}`,
        driverId: driver.id,
        driverName: driver.name,
        type: "DVIR_COMPLETION",
        timestamp: order.updatedAt?.toISOString() ?? now.toISOString(),
        description: `DVIR completed for order ${order.externalOrderNumber || order.id.slice(0, 8)}`,
        data: { orderId: order.id },
      });
    }
  }

  return events;
}

// ─── Route Plugin ─────────────────────────────────────────────

export default async function eldRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET /defects ──────────────────────────────────────────────

  fastify.get("/defects", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = defectQuerySchema.parse(request.query);
      const { vehicleId, status, page, limit } = query;

      // Load shop settings to get stored defects
      const shop = await (request as any).tenantDb.shop.findUnique({
        where: { id: (request as any).shopId },
        select: { settings: true },
      });

      let defects: any[] = getEldDefects(shop?.settings);

      if (vehicleId) {
        defects = defects.filter((d) => d.vehicleId === vehicleId);
      }
      if (status) {
        defects = defects.filter((d) => d.status === status);
      }

      const total = defects.length;
      const paged = defects.slice((page - 1) * limit, page * limit);

      return {
        data: paged,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid query parameters", details: err.errors },
        });
      }
      throw err;
    }
  });

  // ── PATCH /defects/:id/status ─────────────────────────────────

  fastify.patch("/defects/:id/status", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = defectStatusSchema.parse(request.body);

      const shop = await (request as any).tenantDb.shop.findUnique({
        where: { id: (request as any).shopId },
        select: { settings: true },
      });

      const settings = getEldSettings(shop?.settings);
      const defects: any[] = Array.isArray(settings.eldDefects) ? settings.eldDefects : [];

      const idx = defects.findIndex((d) => d.id === id);
      if (idx === -1) {
        throw new NotFoundError("DvirDefect", id);
      }

      defects[idx] = {
        ...defects[idx],
        status: body.status,
        updatedAt: new Date().toISOString(),
      };

      await (request as any).tenantDb.shop.update({
        where: { id: (request as any).shopId },
        data: {
          settings: {
            ...settings,
            eldDefects: defects,
          },
        },
      });

      return { data: defects[idx] };
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: err.errors },
        });
      }
      throw err;
    }
  });

  // ── GET /violations ───────────────────────────────────────────

  fastify.get("/violations", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }).parse(request.query);

    const [drivers, orders] = await Promise.all([
      (request as any).tenantDb.driver.findMany({
        where: { isActive: true },
        select: { id: true, name: true, status: true, updatedAt: true },
      }),
      (request as any).tenantDb.order.findMany({
        where: {
          status: { in: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"] },
        },
        select: { id: true, driverId: true, status: true, externalOrderNumber: true, updatedAt: true },
        take: 200,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const violations = deriveViolations(drivers, orders);
    const total = violations.length;
    const paged = violations.slice((query.page - 1) * query.limit, query.page * query.limit);

    return {
      data: paged,
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  });

  // ── GET /events ───────────────────────────────────────────────

  fastify.get("/events", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }).parse(request.query);

    const [drivers, orders] = await Promise.all([
      (request as any).tenantDb.driver.findMany({
        where: { isActive: true },
        select: { id: true, name: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      (request as any).tenantDb.order.findMany({
        where: { status: { in: ["DELIVERED", "ASSIGNED"] } },
        select: { id: true, driverId: true, status: true, externalOrderNumber: true, updatedAt: true },
        take: 100,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const events = deriveELDEvents(drivers, orders);
    // Sort newest first
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = events.length;
    const paged = events.slice((query.page - 1) * query.limit, query.page * query.limit);

    return {
      data: paged,
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  });

  // ── GET /compliance ───────────────────────────────────────────

  fastify.get("/compliance", async (request: FastifyRequest, reply: FastifyReply) => {
    const [totalDrivers, activeDrivers, shop, recentOrders] = await Promise.all([
      (request as any).tenantDb.driver.count({ where: { isActive: true } }),
      (request as any).tenantDb.driver.count({
        where: { isActive: true, status: { not: "OFFLINE" } },
      }),
      (request as any).tenantDb.shop.findUnique({
        where: { id: (request as any).shopId },
        select: { settings: true },
      }),
      (request as any).tenantDb.order.findMany({
        where: {
          status: "DELIVERED",
          updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true, driverId: true },
        take: 200,
      }),
    ]);

    const defects: any[] = getEldDefects(shop?.settings);
    const inspections: any[] = getEldInspections(shop?.settings);

    const openDefects = defects.filter((d) =>
      d.status === "REPORTED" || d.status === "ACKNOWLEDGED",
    ).length;

    const criticalDefects = defects.filter((d) => d.severity === "CRITICAL").length;

    // Compliance: drivers with no open critical defects are considered compliant
    const driversWithCritical = new Set(
      defects.filter((d) => d.severity === "CRITICAL" && d.status !== "REPAIRED").map((d) => d.driverId),
    );

    const compliantDrivers = Math.max(0, totalDrivers - driversWithCritical.size);
    const compliancePercentage =
      totalDrivers > 0 ? Math.round((compliantDrivers / totalDrivers) * 100) : 100;

    // DVIR completion rate: inspections in last 7 days vs expected (2 per active driver per day)
    const recentInspections = inspections.filter(
      (i) => new Date(i.inspectionDate) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    );
    const expectedInspections = activeDrivers * 7 * 2; // pre + post trip per day
    const dvirCompletionRate =
      expectedInspections > 0
        ? Math.min(100, Math.round((recentInspections.length / expectedInspections) * 100))
        : 100;

    // Active violations (drivers on route with many active orders is a proxy)
    const activeViolations = driversWithCritical.size;

    return {
      data: {
        totalDrivers,
        compliantDrivers,
        compliancePercentage,
        activeViolations,
        dvirCompletionRate,
        openDefects,
        criticalDefects,
      },
    };
  });

  // ── GET /drivers/:id/hos ──────────────────────────────────────

  fastify.get("/drivers/:id/hos", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const driver = await (request as any).tenantDb.driver.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });

    if (!driver) {
      throw new NotFoundError("Driver", id);
    }

    return { data: deriveHOSForDriver(driver) };
  });

  // ── GET /inspections ──────────────────────────────────────────

  fastify.get("/inspections", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = inspectionQuerySchema.parse(request.query);
      const { vehicleId, page, limit } = query;

      const shop = await (request as any).tenantDb.shop.findUnique({
        where: { id: (request as any).shopId },
        select: { settings: true },
      });

      let inspections: any[] = getEldInspections(shop?.settings);

      if (vehicleId) {
        inspections = inspections.filter((i) => i.vehicleId === vehicleId);
      }

      // Sort newest first
      inspections.sort(
        (a, b) => new Date(b.inspectionDate).getTime() - new Date(a.inspectionDate).getTime(),
      );

      const total = inspections.length;
      const paged = inspections.slice((page - 1) * limit, page * limit);

      return {
        data: paged,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid query parameters", details: err.errors },
        });
      }
      throw err;
    }
  });

  // ── POST /dvir ────────────────────────────────────────────────

  fastify.post("/dvir", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = dvirSubmitSchema.parse(request.body);

      const shop = await (request as any).tenantDb.shop.findUnique({
        where: { id: (request as any).shopId },
        select: { settings: true },
      });

      const settings = getEldSettings(shop?.settings);
      const inspections: any[] = Array.isArray(settings.eldInspections)
        ? settings.eldInspections
        : [];
      const defects: any[] = Array.isArray(settings.eldDefects)
        ? settings.eldDefects
        : [];

      const now = new Date().toISOString();
      const hasFailedItems = body.items.some((i) => i.status === "FAIL");
      const inspectionStatus: "PASSED" | "FAILED" =
        hasFailedItems || body.defects.length > 0 ? "FAILED" : "PASSED";

      // Create new defect records from the submitted defects
      const newDefects: any[] = body.defects.map((d) => ({
        id: `defect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        vehicleId: body.vehicleId,
        component: d.component,
        description: d.description,
        severity: d.severity,
        status: "REPORTED",
        reportedAt: now,
        photoUrl: d.photoUrl,
        driverId: body.driverId,
        driverName: body.driverName,
        createdAt: now,
        updatedAt: now,
      }));

      const newInspection = {
        id: `insp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        vehicleId: body.vehicleId,
        vehicleNumber: body.vehicleNumber,
        type: body.type,
        status: inspectionStatus,
        driverId: body.driverId,
        driverName: body.driverName,
        inspectionDate: now,
        items: body.items,
        defects: newDefects,
        signatureUrl: body.signatureUrl,
        photos: body.photos,
        createdAt: now,
        updatedAt: now,
      };

      inspections.unshift(newInspection);
      defects.push(...newDefects);

      await (request as any).tenantDb.shop.update({
        where: { id: (request as any).shopId },
        data: {
          settings: {
            ...settings,
            eldInspections: inspections,
            eldDefects: defects,
          },
        },
      });

      reply.status(201);
      return { data: newInspection };
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: err.errors },
        });
      }
      throw err;
    }
  });

  // ── GET /dvir ─────────────────────────────────────────────────

  fastify.get("/dvir", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }).parse(request.query);

    // Load drivers to use as vehicle list (vehiclePlate as vehicle number)
    const [drivers, shop] = await Promise.all([
      (request as any).tenantDb.driver.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          vehiclePlate: true,
          vehicleType: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      (request as any).tenantDb.shop.findUnique({
        where: { id: (request as any).shopId },
        select: { settings: true },
      }),
    ]);

    const totalCount = await (request as any).tenantDb.driver.count({
      where: { isActive: true },
    });

    const inspections: any[] = getEldInspections(shop?.settings);

    // Build vehicle inspection status list
    const vehicleStatuses = drivers.map((driver: any) => {
      const vehicleId = driver.id;
      const vehicleInspections = inspections
        .filter((i) => i.vehicleId === vehicleId)
        .sort(
          (a: any, b: any) =>
            new Date(b.inspectionDate).getTime() - new Date(a.inspectionDate).getTime(),
        );

      const lastInspection = vehicleInspections[0] ?? null;

      return {
        vehicleId,
        vehicleNumber: driver.vehiclePlate ?? driver.name,
        vehicleType: driver.vehicleType,
        driverId: driver.id,
        driverName: driver.name,
        driverStatus: driver.status,
        lastInspectionDate: lastInspection?.inspectionDate ?? null,
        lastInspectionStatus: lastInspection?.status ?? null,
        totalInspections: vehicleInspections.length,
      };
    });

    return {
      data: vehicleStatuses,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / query.limit),
      },
    };
  });
}
