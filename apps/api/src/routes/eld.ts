/**
 * ELD / HOS / DVIR API — Hours-of-Service compliance and vehicle inspections.
 *
 * Routes:
 *   GET    /compliance                   Fleet-wide compliance summary
 *   GET    /drivers                      Drivers with their current HOS status
 *   GET    /drivers/:id/hos              Single driver HOS detail
 *   GET    /violations                   Active HOS violations
 *   GET    /events                       ELD event audit log
 *   GET    /defects                      DVIR active defects
 *   PATCH  /defects/status               Update defect status (id in body)
 *   PATCH  /defects/:id/status           Update defect status (id in path)
 *   GET    /dvir                         DVIR inspection history
 *   POST   /dvir                         Submit new DVIR inspection
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

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
