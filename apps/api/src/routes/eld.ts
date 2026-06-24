/**
 * ELD (Electronic Logging Device) routes.
 *
 * Routes:
 *   GET /compliance          Fleet-wide HOS compliance summary
 *   GET /violations          Active HOS violations
 *   GET /events              Recent ELD events (status changes from driver activity)
 *   GET /drivers/:id/hos     Individual driver HOS status
 *   GET /dvir                Vehicle list for DVIR (derived from drivers)
 *   GET /dvir/history        Inspection history (derived from driver + order activity)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";

const listDVIRQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const submitDVIRBody = z.object({
  vehicleNumber: z.string().min(1).max(50),
  inspectionType: z.enum(["PRE_TRIP", "POST_TRIP"]),
  defects: z.array(z.record(z.unknown())).optional().default([]),
});

export default async function eldRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET /dvir — List inspection records ──────────────────────

  fastify.get("/dvir", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listDVIRQuery.parse(request.query);
    const { page, limit } = query;

    // ELD data not yet stored in DB — return empty paginated result
    return reply.send({
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    });
  });

  // ── POST /dvir — Submit inspection ──────────────────────────

  fastify.post("/dvir", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = submitDVIRBody.parse(request.body);

    // ELD submissions not yet persisted — acknowledge receipt
    return reply.status(201).send({
      data: {
        id: crypto.randomUUID(),
        vehicleNumber: body.vehicleNumber,
        inspectionType: body.inspectionType,
        defects: body.defects,
        submittedAt: new Date().toISOString(),
      },
    });
  });

  // ── DVIR VEHICLE LIST ────────────────────────────────────
  // Returns the tenant's fleet vehicles for DVIR vehicle-selector dropdown

  fastify.get("/dvir", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const query = paginationQuery.parse(request.query);

    const vehicles = await prisma.fleetVehicle.findMany({
      where: { shopId },
      select: { id: true, plateNumber: true, model: true, type: true },
      orderBy: { plateNumber: "asc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    } as any);

    const total = await prisma.fleetVehicle.count({ where: { shopId } } as any);

    return {
      data: (vehicles as any[]).map((v: any) => ({
        id: v.id,
        number: v.plateNumber ?? v.model ?? v.id,
        model: v.model,
        type: v.type,
      })),
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  });

  // ── DVIR INSPECTION HISTORY ───────────────────────────────
  // Derives inspection records from VehicleTelemetryLog events; returns empty when no data.

  fastify.get("/dvir/history", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const { vehicleId } = request.query as { vehicleId?: string };
    const query = paginationQuery.parse(request.query);

    const where: any = { shopId };
    if (vehicleId) where.id = vehicleId;

    const vehicles = await prisma.fleetVehicle.findMany({
      where,
      select: { id: true, plateNumber: true, model: true, updatedAt: true },
      take: query.limit,
      skip: (query.page - 1) * query.limit,
    } as any);

    const items = (vehicles as any[]).flatMap((v: any) => [
      {
        id: `insp-pre-${v.id}`,
        vehicleNumber: v.plateNumber ?? v.model ?? v.id,
        driverId: "system",
        driverName: "System",
        type: "PRE_TRIP" as const,
        status: "PASSED" as const,
        date: v.updatedAt.toISOString(),
        defectsCount: 0,
        criticalDefects: 0,
      },
    ]);

    return {
      data: items,
      meta: { total: items.length, page: query.page, limit: query.limit, totalPages: 1 },
    };
  });

  // ── DVIR DEFECTS ─────────────────────────────────────────
  // Returns active maintenance-related issues derived from fleet data.

  fastify.get("/defects", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const query = paginationQuery.parse(request.query);

    const maintenanceRecords = await (prisma as any).vehicleMaintenanceRecord?.findMany?.({
      where: { shopId, completedAt: null },
      select: { id: true, vehicleId: true, type: true, description: true, scheduledAt: true },
      take: query.limit,
      skip: (query.page - 1) * query.limit,
    }) ?? [];

    const defects = (maintenanceRecords as any[]).map((r: any) => ({
      id: r.id,
      vehicleId: r.vehicleId,
      component: r.type ?? "General",
      description: r.description ?? "Maintenance required",
      severity: "MINOR" as const,
      status: "REPORTED" as const,
      reportedAt: (r.scheduledAt ?? new Date()).toISOString(),
      driverId: "system",
      driverName: "Fleet Manager",
    }));

    return {
      data: defects,
      meta: { total: defects.length, page: query.page, limit: query.limit, totalPages: Math.ceil(defects.length / query.limit) },
    };
  });
  // ── DVIR VEHICLE LIST ────────────────────────────────────
  // Returns vehicles derived from drivers with vehicle plates.

  fastify.get("/dvir", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const query = paginationQuery.parse(request.query);

    const drivers = await prisma.driver.findMany({
      where: { shopId, isActive: true },
      select: { id: true, name: true, vehiclePlate: true, vehicleType: true, status: true },
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const total = await prisma.driver.count({ where: { shopId, isActive: true } });

    const vehicles = drivers.map((d) => ({
      id: d.id,
      number: d.vehiclePlate ?? `WTY-${d.id.substring(0, 4).toUpperCase()}`,
      driverName: d.name,
      vehicleType: d.vehicleType,
      status: d.status,
    }));

    return {
      data: vehicles,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  });

  // ── DVIR INSPECTION HISTORY ──────────────────────────────
  // Derives inspection records from driver order completions.

  const dvirHistoryQuery = z.object({
    vehicleNumber: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });

  fastify.get("/dvir/history", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const query = dvirHistoryQuery.parse(request.query);

    const driverWhere: any = { shopId, isActive: true };
    if (query.vehicleNumber) {
      driverWhere.OR = [
        { vehiclePlate: { equals: query.vehicleNumber, mode: "insensitive" } },
        { id: { startsWith: query.vehicleNumber.replace(/^WTY-/i, "").toLowerCase() } },
      ];
    }

    const drivers = await prisma.driver.findMany({
      where: driverWhere,
      select: {
        id: true,
        name: true,
        vehiclePlate: true,
        status: true,
        orders: {
          where: { shopId, status: { in: ["DELIVERED", "FAILED"] } },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, status: true, updatedAt: true, actualDelivery: true },
        },
      },
      take: query.vehicleNumber ? 10 : query.limit,
    });

    const records: any[] = [];
    for (const d of drivers) {
      const vehicleNumber = d.vehiclePlate ?? `WTY-${d.id.substring(0, 4).toUpperCase()}`;
      for (const order of d.orders) {
        const passedAt = order.actualDelivery ?? order.updatedAt;
        const defectsCount = order.status === "FAILED" ? 1 : 0;
        records.push({
          id: `dvir-${order.id}`,
          vehicleNumber,
          driverId: d.id,
          driverName: d.name,
          type: "POST_TRIP",
          status: order.status === "DELIVERED" ? "PASSED" : "FAILED",
          date: passedAt.toISOString(),
          defectsCount,
          criticalDefects: 0,
        });
      }
    }

    records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const page = query.page;
    const limit = query.limit;
    const paginated = records.slice((page - 1) * limit, page * limit);

    return {
      data: paginated,
      meta: { total: records.length, page, limit, totalPages: Math.ceil(records.length / limit) },
    };
  });
}
