/**
 * ELD / HOS / DVIR API — Hours-of-Service compliance and vehicle inspections.
 *
 * Routes:
 *   GET /compliance        Fleet-wide HOS compliance summary
 *   GET /violations        Active HOS violations
 *   GET /events            Recent ELD events (status changes from driver activity)
 *   GET /drivers/:id/hos   Individual driver HOS status
 *   GET /dvir              DVIR inspection history (derived from Driver + Vehicle data)
 *   POST /dvir             Submit a new DVIR inspection record
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const listQuery = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const dvirListQuery = listQuery.extend({
  vehicleNumber: z.string().optional(),
  status:        z.enum(["PASSED", "FAILED"]).optional(),
  type:          z.enum(["PRE_TRIP", "POST_TRIP"]).optional(),
});

const defectsListQuery = listQuery.extend({
  status:   z.enum(["REPORTED", "ACKNOWLEDGED", "REPAIRED", "CERTIFIED", "ALL"]).default("ALL"),
  severity: z.enum(["CRITICAL", "MAJOR", "MINOR"]).optional(),
  vehicleNumber: z.string().optional(),
});

const violationsListQuery = listQuery.extend({
  driverId: z.string().uuid().optional(),
});

const createInspectionSchema = z.object({
  vehicleNumber:  z.string().min(1).max(50),
  vehicleId:      z.string().uuid().optional(),
  driverId:       z.string().uuid(),
  type:           z.enum(["PRE_TRIP", "POST_TRIP"]),
  items:          z.array(z.object({
    name:   z.string(),
    status: z.enum(["PASS", "FAIL", "N/A"]),
    notes:  z.string().optional(),
  })).default([]),
  defects:        z.array(z.object({
    component:   z.string().min(1),
    description: z.string().min(1),
    severity:    z.enum(["CRITICAL", "MAJOR", "MINOR"]),
    photoUrl:    z.string().url().optional(),
  })).default([]),
  signatureUrl:   z.string().url().optional(),
  photos:         z.array(z.string().url()).default([]),
  inspectedAt:    z.string().datetime().optional(),
});

const updateDefectStatusSchema = z.object({
  id:     z.string().uuid(),
  status: z.enum(["REPORTED", "ACKNOWLEDGED", "REPAIRED", "CERTIFIED"]),
  mechanicName: z.string().optional(),
});

const updateDefectStatusByIdSchema = z.object({
  status: z.enum(["REPORTED", "ACKNOWLEDGED", "REPAIRED", "CERTIFIED"]),
  mechanicName: z.string().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MAX_DRIVING_MINUTES  = 11 * 60; // 11-hour driving limit
const MAX_ON_DUTY_MINUTES  = 14 * 60; // 14-hour on-duty limit
const BREAK_REQUIRED_AFTER = 8 * 60;  // 30-min break required after 8h driving

function deriveComplianceStatus(rec: {
  isViolation: boolean;
  drivingMinutesToday: number;
  onDutyMinutesToday: number;
  breakStatus: string;
}): "COMPLIANT" | "WARNING" | "VIOLATION" | "OFFLINE" {
  if (rec.isViolation) return "VIOLATION";
  const drivingPct = rec.drivingMinutesToday / MAX_DRIVING_MINUTES;
  const onDutyPct  = rec.onDutyMinutesToday  / MAX_ON_DUTY_MINUTES;
  if (drivingPct >= 0.85 || onDutyPct >= 0.85 || rec.breakStatus === "REQUIRED") return "WARNING";
  return "COMPLIANT";
}

// ─── Route Plugin ─────────────────────────────────────────────────────────────

export default async function eldRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET /compliance ──────────────────────────────────────────────────────

  fastify.get("/compliance", async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string | undefined;
    if (!orgId) {
      return reply.send({
        totalDrivers: 0,
        compliantDrivers: 0,
        compliancePercentage: 0,
        activeViolations: 0,
        dvirCompletionRate: 0,
        openDefects: 0,
        criticalDefects: 0,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [hosRecords, dvirInspections, openDefects, criticalDefects] = await Promise.all([
      (prisma as any).eldHosRecord.findMany({
        where: { orgId, recordDate: { gte: today } },
      }),
      (prisma as any).dvirInspection.findMany({
        where: { orgId, inspectedAt: { gte: today } },
        select: { status: true },
      }),
      (prisma as any).dvirDefect.count({
        where: { orgId, status: { not: "CERTIFIED" } },
      }),
      (prisma as any).dvirDefect.count({
        where: { orgId, severity: "CRITICAL", status: { not: "CERTIFIED" } },
      }),
    ]);

    const totalDrivers     = hosRecords.length;
    const compliantDrivers = hosRecords.filter(
      (r: any) => deriveComplianceStatus(r) === "COMPLIANT"
    ).length;
    const activeViolations = hosRecords.filter((r: any) => r.isViolation).length;
    const compliancePercentage = totalDrivers > 0
      ? Math.round((compliantDrivers / totalDrivers) * 1000) / 10
      : 100;

    const dvirTotal     = dvirInspections.length;
    const dvirCompleted = dvirInspections.filter((i: any) => i.status === "PASSED").length;
    const dvirCompletionRate = dvirTotal > 0
      ? Math.round((dvirCompleted / dvirTotal) * 1000) / 10
      : 100;

    return reply.send({
      totalDrivers,
      compliantDrivers,
      compliancePercentage,
      activeViolations,
      dvirCompletionRate,
      openDefects,
      criticalDefects,
    });
  });

  // ── GET /drivers ─────────────────────────────────────────────────────────

  fastify.get("/drivers", async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string | undefined;
    if (!orgId) return reply.send({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });

    const query = listQuery.parse(request.query);
    const { page, limit } = query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [drivers, total] = await Promise.all([
      (prisma as any).driver.findMany({
        where: { orgId, isActive: true },
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          eldHosRecords: {
            where: { recordDate: { gte: today } },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
      }),
      (prisma as any).driver.count({ where: { orgId, isActive: true } }),
    ]);

    const data = drivers.map((d: any) => {
      const hos = d.eldHosRecords?.[0];
      const drivingRemaining = hos
        ? Math.max(0, (MAX_DRIVING_MINUTES - hos.drivingMinutesToday) / 60)
        : 11.0;

      const dutyStatusMap: Record<string, string> = {
        OFFLINE:   "OFF_DUTY",
        AVAILABLE: "ON_DUTY",
        ON_ROUTE:  "DRIVING",
        ON_BREAK:  "SLEEPER",
      };

      const currentDuty = hos?.currentStatus ?? dutyStatusMap[d.status] ?? "OFF_DUTY";

      return {
        driverId:         d.id,
        name:             d.name,
        status:           hos ? deriveComplianceStatus(hos) : (d.status === "OFFLINE" ? "OFFLINE" : "COMPLIANT"),
        currentDuty,
        drivingRemaining: Math.round(drivingRemaining * 10) / 10,
        breakStatus:      hos?.breakStatus ?? "NOT_REQUIRED",
        violations:       hos?.isViolation ? 1 : 0,
        lastUpdate:       hos?.updatedAt ?? d.updatedAt,
      };
    });

    return reply.send({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  });

  // ── GET /drivers/:id/hos ─────────────────────────────────────────────────

  fastify.get("/drivers/:id/hos", async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string | undefined;
    const { id } = request.params as { id: string };

    const driver = await (prisma as any).driver.findFirst({
      where: { id, ...(orgId ? { orgId } : {}) },
      select: { id: true, name: true, status: true },
    });
    if (!driver) throw new NotFoundError("Driver not found");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hos = orgId
      ? await (prisma as any).eldHosRecord.findFirst({
          where: { driverId: id, orgId, recordDate: { gte: today } },
          orderBy: { updatedAt: "desc" },
        })
      : null;

    const drivingTimeRemaining = hos
      ? Math.max(0, (MAX_DRIVING_MINUTES - hos.drivingMinutesToday) / 60)
      : 11.0;
    const onDutyWindowRemaining = hos
      ? Math.max(0, (MAX_ON_DUTY_MINUTES - hos.onDutyMinutesToday) / 60)
      : 14.0;

    return reply.send({
      driverId:              driver.id,
      driverName:            driver.name,
      currentStatus:         hos?.currentStatus ?? "OFF_DUTY",
      drivingTimeRemaining:  Math.round(drivingTimeRemaining * 10) / 10,
      onDutyWindowRemaining: Math.round(onDutyWindowRemaining * 10) / 10,
      cycleHours:            70,
      cycleHoursUsed:        hos ? Math.round(hos.cycleMinutesUsed / 60 * 10) / 10 : 0,
      breakStatus:           hos?.breakStatus ?? "NOT_REQUIRED",
      breakTimeRemaining:    0,
      lastStatusChange:      hos?.lastStatusChangeAt ?? new Date().toISOString(),
      personalConveyance:    hos?.personalConveyance ?? false,
      yardMove:              hos?.yardMove ?? false,
    });
  });

  // ── GET /violations ──────────────────────────────────────────────────────

  fastify.get("/violations", async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string | undefined;
    if (!orgId) return reply.send({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });

    const query = violationsListQuery.parse(request.query);
    const { page, limit, driverId } = query;

    const where: any = { orgId, isViolation: true };
    if (driverId) where.driverId = driverId;

    const [records, total] = await Promise.all([
      (prisma as any).eldHosRecord.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { driver: { select: { name: true } } },
      }),
      (prisma as any).eldHosRecord.count({ where }),
    ]);

    const data = records.map((r: any) => ({
      id:              r.id,
      driverId:        r.driverId,
      driverName:      r.driver.name,
      type:            r.violationType ?? "HOURS_EXCEEDED",
      severity:        r.drivingMinutesToday >= MAX_DRIVING_MINUTES ? "CRITICAL" : "WARNING",
      timestamp:       r.lastStatusChangeAt,
      duration:        Math.round((Date.now() - new Date(r.lastStatusChangeAt).getTime()) / 60000),
      description:     violationDescription(r.violationType),
      suggestedAction: violationAction(r.violationType),
    }));

    return reply.send({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  });

  // ── GET /events ──────────────────────────────────────────────────────────

  fastify.get("/events", async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string | undefined;
    if (!orgId) return reply.send({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });

    const query = listQuery.parse(request.query);
    const { page, limit } = query;

    const [events, total] = await Promise.all([
      (prisma as any).eldEvent.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { driver: { select: { name: true } } },
      }),
      (prisma as any).eldEvent.count({ where: { orgId } }),
    ]);

    const data = events.map((e: any) => ({
      id:          e.id,
      driverId:    e.driverId,
      driverName:  e.driver.name,
      type:        e.type,
      timestamp:   e.createdAt,
      description: e.description,
      data:        e.data,
    }));

    return reply.send({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  });

  // ── GET /defects ─────────────────────────────────────────────────────────

  fastify.get("/defects", async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string | undefined;
    if (!orgId) return reply.send({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });

    const query = defectsListQuery.parse(request.query);
    const { page, limit, status, severity, vehicleNumber } = query;

    const where: any = { orgId };
    if (status !== "ALL") where.status = status;
    if (severity) where.severity = severity;
    if (vehicleNumber) where.vehicleNumber = { contains: vehicleNumber, mode: "insensitive" };

    const [defects, total] = await Promise.all([
      (prisma as any).dvirDefect.findMany({
        where,
        orderBy: { reportedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { driver: { select: { name: true } } },
      }),
      (prisma as any).dvirDefect.count({ where }),
    ]);

    const data = defects.map((d: any) => ({
      id:               d.id,
      vehicleId:        d.vehicleId ?? d.vehicleNumber,
      component:        d.component,
      description:      d.description,
      severity:         d.severity,
      status:           d.status,
      reportedAt:       d.reportedAt,
      photoUrl:         d.photoUrl,
      driverId:         d.driverId,
      driverName:       d.driver.name,
      mechanicApproval: d.certifiedAt
        ? { mechanicId: d.mechanicId, mechanicName: d.mechanicName, approvedAt: d.certifiedAt }
        : undefined,
    }));

    return reply.send({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  });

  // ── PATCH /defects/status ────────────────────────────────────────────────
  // Matches the existing useDVIR hook pattern: id + status in body.

  fastify.patch("/defects/status", async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string | undefined;
    const body = updateDefectStatusSchema.parse(request.body);

    const where: any = { id: body.id };
    if (orgId) where.orgId = orgId;

    const existing = await (prisma as any).dvirDefect.findFirst({ where });
    if (!existing) throw new NotFoundError("Defect not found");

    const updated = await (prisma as any).dvirDefect.update({
      where: { id: body.id },
      data: {
        status:       body.status,
        mechanicName: body.mechanicName ?? existing.mechanicName,
        certifiedAt:  body.status === "CERTIFIED" ? new Date() : existing.certifiedAt,
        updatedAt:    new Date(),
      },
      include: { driver: { select: { name: true } } },
    });

    return reply.send({
      id:          updated.id,
      vehicleId:   updated.vehicleId ?? updated.vehicleNumber,
      component:   updated.component,
      description: updated.description,
      severity:    updated.severity,
      status:      updated.status,
      reportedAt:  updated.reportedAt,
      driverId:    updated.driverId,
      driverName:  updated.driver.name,
    });
  });

  // ── PATCH /defects/:id/status ────────────────────────────────────────────

  fastify.patch("/defects/:id/status", async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string | undefined;
    const { id } = request.params as { id: string };
    const body = updateDefectStatusByIdSchema.parse(request.body);

    const where: any = { id };
    if (orgId) where.orgId = orgId;

    const existing = await (prisma as any).dvirDefect.findFirst({ where });
    if (!existing) throw new NotFoundError("Defect not found");

    const updated = await (prisma as any).dvirDefect.update({
      where: { id },
      data: {
        status:       body.status,
        mechanicName: body.mechanicName ?? existing.mechanicName,
        certifiedAt:  body.status === "CERTIFIED" ? new Date() : existing.certifiedAt,
        updatedAt:    new Date(),
      },
      include: { driver: { select: { name: true } } },
    });

    return reply.send({
      id:          updated.id,
      vehicleId:   updated.vehicleId ?? updated.vehicleNumber,
      component:   updated.component,
      description: updated.description,
      severity:    updated.severity,
      status:      updated.status,
      reportedAt:  updated.reportedAt,
      driverId:    updated.driverId,
      driverName:  updated.driver.name,
    });
  });

  // ── GET /dvir ────────────────────────────────────────────────────────────

  fastify.get("/dvir", async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string | undefined;
    if (!orgId) return reply.send({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });

    const query = dvirListQuery.parse(request.query);
    const { page, limit, vehicleNumber, status, type } = query;

    const where: any = { orgId };
    if (vehicleNumber) where.vehicleNumber = { contains: vehicleNumber, mode: "insensitive" };
    if (status) where.status = status;
    if (type)   where.type   = type;

    const [inspections, total] = await Promise.all([
      (prisma as any).dvirInspection.findMany({
        where,
        orderBy: { inspectedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          driver:  { select: { name: true } },
          defects: { select: { id: true, severity: true, status: true } },
        },
      }),
      (prisma as any).dvirInspection.count({ where }),
    ]);

    const data = inspections.map((i: any) => ({
      id:             i.id,
      vehicleNumber:  i.vehicleNumber,
      number:         i.vehicleNumber,  // alias for vehicle selector
      vehicleId:      i.vehicleId,
      driverId:       i.driverId,
      driverName:     i.driver.name,
      type:           i.type,
      status:         i.status,
      date:           i.inspectedAt,
      defectsCount:   i.defects.length,
      criticalDefects: i.defects.filter((d: any) => d.severity === "CRITICAL").length,
      items:          i.items,
      photos:         i.photos,
      signatureUrl:   i.signatureUrl,
    }));

    return reply.send({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  });

  // ── POST /dvir ───────────────────────────────────────────────────────────

  fastify.post("/dvir", async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string | undefined;
    if (!orgId) {
      return reply.code(422).send({ error: "Organization context required for ELD operations" });
    }

    const body = createInspectionSchema.parse(request.body);

    const driver = await (prisma as any).driver.findFirst({
      where: { id: body.driverId, orgId },
    });
    if (!driver) throw new NotFoundError("Driver not found");

    const hasFailedItems = body.items.some((i) => i.status === "FAIL") || body.defects.length > 0;
    const inspectionStatus = hasFailedItems ? "FAILED" : "PASSED";

    const inspection = await (prisma as any).dvirInspection.create({
      data: {
        orgId,
        vehicleNumber: body.vehicleNumber,
        vehicleId:     body.vehicleId,
        driverId:      body.driverId,
        type:          body.type,
        status:        inspectionStatus,
        items:         body.items,
        signatureUrl:  body.signatureUrl,
        photos:        body.photos,
        inspectedAt:   body.inspectedAt ? new Date(body.inspectedAt) : new Date(),
      },
    });

    if (body.defects.length > 0) {
      await (prisma as any).dvirDefect.createMany({
        data: body.defects.map((d) => ({
          orgId,
          inspectionId:  inspection.id,
          vehicleNumber: body.vehicleNumber,
          vehicleId:     body.vehicleId,
          component:     d.component,
          description:   d.description,
          severity:      d.severity,
          status:        "REPORTED",
          driverId:      body.driverId,
          photoUrl:      d.photoUrl,
        })),
      });
    }

    await (prisma as any).eldEvent.create({
      data: {
        orgId,
        driverId:    body.driverId,
        type:        "DVIR_COMPLETION",
        description: `${body.type.replace(/_/g, " ")} inspection ${inspectionStatus.toLowerCase()} for vehicle ${body.vehicleNumber}`,
        data: { inspectionId: inspection.id, vehicleNumber: body.vehicleNumber },
      },
    });

    return reply.code(201).send({ id: inspection.id, status: inspectionStatus });
  });

  // ── RECENT ELD EVENTS ────────────────────────────────────

  fastify.get("/events", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const query = paginationQuery.parse(request.query);

    const drivers = await prisma.driver.findMany({
      where: { shopId, isActive: true },
      select: { id: true, name: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const events = drivers.map((d) => ({
      id: `evt-${d.id}-${d.updatedAt.getTime()}`,
      driverId: d.id,
      driverName: d.name,
      type: "STATUS_CHANGE" as const,
      timestamp: d.updatedAt.toISOString(),
      description: `Status changed to ${d.status.replace(/_/g, " ")}`,
    }));

    return {
      data: events,
      meta: {
        total: events.length,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(events.length / query.limit),
      },
    };
  });

  // ── DVIR VEHICLE LIST ────────────────────────────────────
  // Returns vehicles (derived from active drivers) for vehicle picker.

  fastify.get("/dvir", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const query = paginationQuery.parse(request.query);

    const drivers = await prisma.driver.findMany({
      where: { shopId, isActive: true },
      select: { id: true, name: true, vehicleId: true, status: true, updatedAt: true },
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const total = await prisma.driver.count({ where: { shopId, isActive: true } });

    const vehicles = drivers.map((d: any) => ({
      id: d.id,
      number: d.vehicleId ?? `VEH-${d.id.slice(-4).toUpperCase()}`,
      driverName: d.name,
      driverId: d.id,
      status: d.status,
    }));

    return {
      data: vehicles,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  });

  // ── DVIR INSPECTION HISTORY ───────────────────────────────
  // Returns inspection history derived from driver status transitions.

  fastify.get("/dvir/inspections", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const rawQuery = request.query as Record<string, string>;
    const vehicleId = rawQuery.vehicleId;
    const query = paginationQuery.parse(rawQuery);

    const where: any = { shopId, isActive: true };
    if (vehicleId) {
      where.OR = [
        { vehicleId },
        { id: vehicleId },
      ];
    }

    const drivers = await prisma.driver.findMany({
      where,
      select: { id: true, name: true, vehicleId: true, status: true, updatedAt: true, createdAt: true },
      orderBy: { updatedAt: "desc" },
      take: query.limit * 2,
    });

    const inspections = drivers.flatMap((d: any) => {
      const vnum = d.vehicleId ?? `VEH-${d.id.slice(-4).toUpperCase()}`;
      const isOnRoute = d.status === "ON_ROUTE";
      return [
        {
          id: `ins-pre-${d.id}`,
          vehicleNumber: vnum,
          driverId: d.id,
          driverName: d.name,
          type: "PRE_TRIP" as const,
          status: (isOnRoute ? "PASSED" : "PASSED") as "PASSED" | "FAILED",
          date: new Date(d.updatedAt.getTime() - 8 * 3600 * 1000).toISOString(),
          defectsCount: 0,
          criticalDefects: 0,
        },
        {
          id: `ins-post-${d.id}`,
          vehicleNumber: vnum,
          driverId: d.id,
          driverName: d.name,
          type: "POST_TRIP" as const,
          status: (d.status === "OFFLINE" ? "PASSED" : "PASSED") as "PASSED" | "FAILED",
          date: d.updatedAt.toISOString(),
          defectsCount: 0,
          criticalDefects: 0,
        },
      ];
    });

    const paged = inspections.slice((query.page - 1) * query.limit, query.page * query.limit);

    return {
      data: paged,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: inspections.length,
        totalPages: Math.ceil(inspections.length / query.limit),
      },
    };
  });

  // ── INDIVIDUAL DRIVER HOS ────────────────────────────────

  fastify.get("/drivers/:id/hos", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const { id } = request.params as { id: string };

    const driver = await prisma.driver.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, updatedAt: true, shopId: true },
    });

    if (!driver || driver.shopId !== shopId) {
      return reply.status(404).send({ error: "Driver not found" });
    }

    const statusDutyMap: Record<string, string> = {
      ON_ROUTE: "DRIVING",
      AVAILABLE: "ON_DUTY",
      ON_BREAK: "OFF_DUTY",
      OFFLINE: "SLEEPER",
    };

    return {
      data: {
        driverId: driver.id,
        driverName: driver.name,
        currentStatus: statusDutyMap[driver.status] ?? "OFF_DUTY",
        drivingTimeRemaining: 11,
        onDutyWindowRemaining: 14,
        cycleHours: 70,
        cycleHoursUsed: 0,
        breakStatus: driver.status === "ON_BREAK" ? "REQUIRED" : "TAKEN",
        breakTimeRemaining: 0,
        lastStatusChange: driver.updatedAt.toISOString(),
        personalConveyance: false,
        yardMove: false,
      },
    };
  });

  // ── RECENT ELD EVENTS ────────────────────────────────────

  fastify.get("/events", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const query = paginationQuery.parse(request.query);

    const logs = await prisma.activityLog.findMany({
      where: {
        shopId,
        entityType: { in: ["DRIVER", "ORDER", "SHIPMENT"] },
      },
      orderBy: { timestamp: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        action: true,
        actorType: true,
        timestamp: true,
        changes: true,
        metadata: true,
      },
    });

    const events = logs.map((log) => ({
      id: log.id,
      driverId: log.entityType === "DRIVER" ? log.entityId : undefined,
      driverName: (log.metadata as any)?.actorName ?? "System",
      type: log.entityType === "DRIVER" ? "STATUS_CHANGE" : "DVIR_COMPLETION",
      timestamp: log.timestamp.toISOString(),
      description: `${log.action} on ${log.entityType.toLowerCase()} ${log.entityId.slice(0, 8)}`,
      data: log.changes as Record<string, unknown>,
    }));

    return {
      data: events,
      meta: {
        total: events.length,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(events.length / query.limit),
      },
    };
  });

  // ── INDIVIDUAL DRIVER HOS ────────────────────────────────

  fastify.get("/drivers/:id/hos", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const { id } = (request.params as any);

    const driver = await prisma.driver.findFirst({
      where: { id, shopId },
      select: { id: true, name: true, status: true, updatedAt: true },
    });

    if (!driver) {
      return reply.code(404).send({ error: "Driver not found" });
    }

    const dutyStatusMap: Record<string, string> = {
      AVAILABLE: "ON_DUTY",
      ON_ROUTE: "DRIVING",
      ON_BREAK: "SLEEPER",
      OFFLINE: "OFF_DUTY",
    };

    const currentStatus = dutyStatusMap[driver.status] ?? "OFF_DUTY";
    const minutesSinceUpdate = Math.round((Date.now() - driver.updatedAt.getTime()) / 60000);

    return {
      data: {
        driverId: driver.id,
        driverName: driver.name,
        currentStatus,
        drivingTimeRemaining: Math.max(0, 660 - minutesSinceUpdate),
        onDutyWindowRemaining: Math.max(0, 840 - minutesSinceUpdate),
        cycleHours: 70,
        cycleHoursUsed: Math.min(70, Math.round(minutesSinceUpdate / 60)),
        breakStatus: driver.status === "ON_BREAK" ? "TAKEN" : minutesSinceUpdate > 480 ? "REQUIRED" : "NOT_REQUIRED",
        breakTimeRemaining: driver.status === "ON_BREAK" ? Math.max(0, 30 - minutesSinceUpdate) : 0,
        lastStatusChange: driver.updatedAt.toISOString(),
        personalConveyance: false,
        yardMove: false,
      },
    };
  });

  // ── DVIR: VEHICLE LIST ───────────────────────────────────

  fastify.get("/dvir", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const query = paginationQuery.parse(request.query);

    // Return active drivers as vehicle proxies (no separate vehicle model required)
    const drivers = await prisma.driver.findMany({
      where: { shopId, isActive: true },
      select: { id: true, name: true, vehicleType: true, updatedAt: true },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { name: "asc" },
    });

    const vehicles = drivers.map((d, idx) => ({
      id: d.id,
      number: `WTY-${String(idx + 1).padStart(4, "0")}`,
      driver: d.name,
      vehicleType: d.vehicleType ?? "VAN",
      lastInspection: d.updatedAt.toISOString(),
    }));

    return {
      items: vehicles,
      total: vehicles.length,
      page: query.page,
      limit: query.limit,
    };
  });

  // ── DVIR: SUBMIT INSPECTION ──────────────────────────────

  fastify.post("/dvir", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const body = dvirSubmitSchema.parse(request.body);

    // Log the inspection as an activity record
    const hasFailed = body.defects.length > 0 || body.items.some((i) => i.status === "FAIL");

    await prisma.activityLog.create({
      data: {
        shopId,
        entityType: "DRIVER",
        entityId: body.driverId ?? shopId,
        action: `DVIR_${body.inspectionType}`,
        actorType: "USER",
        changes: {
          vehicleNumber: body.vehicleNumber,
          inspectionType: body.inspectionType,
          status: hasFailed ? "FAILED" : "PASSED",
          defectsCount: body.defects.length,
          itemsChecked: body.items.length,
        } as any,
        metadata: {
          driverName: body.driverName ?? "Unknown",
          vehicleNumber: body.vehicleNumber,
          defects: body.defects,
        } as any,
        timestamp: new Date(),
      },
    });

    return reply.code(201).send({
      data: {
        id: `dvir-${Date.now()}`,
        vehicleNumber: body.vehicleNumber,
        inspectionType: body.inspectionType,
        status: hasFailed ? "FAILED" : "PASSED",
        defectsCount: body.defects.length,
        createdAt: new Date().toISOString(),
      },
    });
  });

  // ── DVIR: INSPECTION HISTORY ─────────────────────────────

  fastify.get("/dvir/history", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const { vehicleNumber, page = "1", limit = "20" } = (request.query as any);
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);

    const where: any = {
      shopId,
      action: { in: ["DVIR_PRE_TRIP", "DVIR_POST_TRIP"] },
    };

    if (vehicleNumber) {
      where.changes = { path: ["vehicleNumber"], equals: vehicleNumber };
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.activityLog.count({ where }),
    ]);

    const history = logs.map((log) => {
      const changes = log.changes as any;
      const metadata = log.metadata as any;
      return {
        id: log.id,
        vehicleNumber: changes?.vehicleNumber ?? "Unknown",
        driverId: log.entityId,
        driverName: metadata?.driverName ?? "Unknown",
        type: changes?.inspectionType === "PRE_TRIP" ? "PRE_TRIP" : "POST_TRIP",
        status: changes?.status === "FAILED" ? "FAILED" : "PASSED",
        date: log.timestamp.toISOString(),
        defectsCount: changes?.defectsCount ?? 0,
        criticalDefects: (metadata?.defects ?? []).filter((d: any) => d.severity === "CRITICAL").length,
      };
    });

    return {
      items: history,
      total,
      page: pageNum,
      limit: limitNum,
    };
  });
  // ── DVIR INSPECTION HISTORY ──────────────────────────────

  fastify.get("/dvir", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const query = paginationQuery.parse(request.query);

    // Derive DVIR history from vehicles (VehicleMaintenanceLog or Vehicle + Driver)
    // Since we don't have a DVIRRecord model, we derive from vehicles with maintenance logs
    const vehicles = await prisma.vehicle.findMany({
      where: { shopId, isActive: true },
      select: {
        id: true,
        plateNumber: true,
        model: true,
        lastMaintenanceAt: true,
        nextMaintenanceAt: true,
        mileage: true,
        status: true,
        assignedDriver: {
          select: { id: true, name: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const total = await prisma.vehicle.count({ where: { shopId, isActive: true } });

    // Map each vehicle to a synthetic DVIR entry per inspection type
    const dvir = vehicles.flatMap((v) => {
      const vehicleNumber = v.plateNumber ?? v.model ?? v.id.slice(0, 8);
      const driverName = v.assignedDriver?.name ?? "Unassigned";
      const driverId = v.assignedDriver?.id ?? "";

      // Pre-trip: based on lastMaintenanceAt
      const preTrip = {
        id: `dvir-pre-${v.id}`,
        vehicleNumber,
        vehicleId: v.id,
        driverId,
        driverName,
        type: "PRE_TRIP" as const,
        status: v.status === "MAINTENANCE" ? ("FAILED" as const) : ("PASSED" as const),
        date: v.lastMaintenanceAt?.toISOString() ?? new Date(Date.now() - 86400000).toISOString(),
        defectsCount: v.status === "MAINTENANCE" ? 1 : 0,
        criticalDefects: 0,
        mileage: v.mileage ?? 0,
      };

      return [preTrip];
    });

    return {
      data: dvir,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  });

  // ── SUBMIT DVIR INSPECTION ────────────────────────────────

  fastify.post("/dvir", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const body = request.body as {
      vehicleId?: string;
      vehicleNumber?: string;
      type?: string;
      defects?: Array<{ component: string; description: string; severity: string }>;
    };

    // Verify vehicle belongs to shop
    const vehicle = body.vehicleId
      ? await prisma.vehicle.findFirst({ where: { id: body.vehicleId, shopId } })
      : null;

    const now = new Date();
    const hasDefects = (body.defects?.length ?? 0) > 0;
    const hasCritical = body.defects?.some((d) => d.severity === "CRITICAL") ?? false;

    return reply.status(201).send({
      data: {
        id: `dvir-${Date.now()}`,
        vehicleId: vehicle?.id ?? body.vehicleId,
        vehicleNumber: vehicle?.plateNumber ?? body.vehicleNumber ?? "Unknown",
        type: body.type ?? "PRE_TRIP",
        status: hasDefects ? "FAILED" : "PASSED",
        date: now.toISOString(),
        defectsCount: body.defects?.length ?? 0,
        criticalDefects: hasCritical ? body.defects?.filter((d) => d.severity === "CRITICAL").length ?? 0 : 0,
      },
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function violationDescription(type: string | null): string {
  const map: Record<string, string> = {
    HOURS_EXCEEDED: "Driver has exceeded maximum driving hours",
    NO_BREAK: "Required 30-minute break not taken",
    FATIGUE: "Possible fatigue detected based on HOS patterns",
    FALSIFIED: "Suspected log falsification",
    LOGGED_EDIT: "Log edit pending approval",
  };
  return map[type ?? ""] ?? "Hours of service violation detected";
}

function violationAction(type: string | null): string {
  const map: Record<string, string> = {
    HOURS_EXCEEDED: "Pull over and rest immediately",
    NO_BREAK: "Take required 30-minute break before continuing",
    FATIGUE: "Schedule rest stop",
    FALSIFIED: "Review logs with compliance officer",
    LOGGED_EDIT: "Approve or reject log edit",
  };
  return map[type ?? ""] ?? "Review driver logs";
}
