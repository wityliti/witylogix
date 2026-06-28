/**
 * COD (Cash on Delivery) Finance Routes
 *
 * Routes:
 *   GET  /summary     — aggregate stats (collected, outstanding, reconciled)
 *   GET  /deliveries  — paginated delivery-level COD records
 *   PATCH /remit      — mark a batch of deliveries as reconciled (remitted)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z, ZodError } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────

const dateRangeQuery = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  driverId: z.string().uuid().optional(),
});

const deliveriesQuery = dateRangeQuery.extend({
  status: z.enum(["pending", "collected", "verified", "reconciled", "failed"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const remitSchema = z.object({
  deliveryIds: z.array(z.string().uuid()).min(1).max(200),
  depositId: z.string().optional(),
  depositDate: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(500).optional(),
});

// ─── Helpers ────────────────────────────────────────────────

function parseSafe<T>(schema: z.ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    const msg =
      err instanceof ZodError
        ? err.errors[0]?.message ?? "Invalid input"
        : "Invalid input";
    throw new ValidationError(msg);
  }
}

/** Convert BigInt amount (cents) to decimal string for JSON serialisation */
function centsToDecimal(cents: bigint): string {
  const n = Number(cents);
  return (n / 100).toFixed(2);
}

// ─── Route Plugin ───────────────────────────────────────────

export default async function financeCodRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET /summary ─────────────────────────────────────────

  fastify.get("/summary", async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to, driverId } = parseSafe(dateRangeQuery, request.query);

    const shopId = (request as any).shopId as string;
    const db = (request as any).tenantDb;

    const dateFilter: any = {};
    if (from || to) {
      dateFilter.collectedAt = {};
      if (from) dateFilter.collectedAt.gte = new Date(from);
      if (to) dateFilter.collectedAt.lte = new Date(to);
    }

    const baseWhere: any = { shopId, ...dateFilter };
    if (driverId) baseWhere.driverId = driverId;

    // Run aggregate queries in parallel
    const [collected, outstanding, reconciled, total] = await Promise.all([
      db.cODCollection.aggregate({
        where: { ...baseWhere, status: "collected" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      db.cODCollection.aggregate({
        where: { ...baseWhere, status: { in: ["collected", "verified"] } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      db.cODCollection.aggregate({
        where: { ...baseWhere, status: "reconciled" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      db.cODCollection.aggregate({
        where: baseWhere,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    // Per-driver breakdown
    const driverBreakdown = await db.cODCollection.groupBy({
      by: ["driverId", "status"],
      where: baseWhere,
      _sum: { amount: true },
      _count: { id: true },
    });

    // Enrich with driver names
    const driverIds = [...new Set(driverBreakdown.map((r: any) => r.driverId))];
    const drivers = driverIds.length
      ? await db.driver.findMany({
          where: { id: { in: driverIds as string[] } },
          select: { id: true, name: true, phone: true },
        })
      : [];
    const driverMap = Object.fromEntries(drivers.map((d: any) => [d.id, d]));

    // Group driver breakdown by driverId
    const byDriver: Record<string, any> = {};
    for (const row of driverBreakdown) {
      if (!byDriver[row.driverId]) {
        byDriver[row.driverId] = {
          driver: driverMap[row.driverId] ?? { id: row.driverId },
          collected: "0.00",
          outstanding: "0.00",
          reconciled: "0.00",
        };
      }
      const amt = centsToDecimal(row._sum.amount ?? BigInt(0));
      if (row.status === "reconciled") {
        byDriver[row.driverId].reconciled = amt;
      } else if (row.status === "collected" || row.status === "verified") {
        const prev = parseFloat(byDriver[row.driverId].outstanding);
        byDriver[row.driverId].outstanding = (prev + parseFloat(amt)).toFixed(2);
      }
      if (row.status === "collected") {
        byDriver[row.driverId].collected = amt;
      }
    }

    return {
      data: {
        totals: {
          collected: centsToDecimal(collected._sum.amount ?? BigInt(0)),
          outstanding: centsToDecimal(outstanding._sum.amount ?? BigInt(0)),
          reconciled: centsToDecimal(reconciled._sum.amount ?? BigInt(0)),
          total: centsToDecimal(total._sum.amount ?? BigInt(0)),
          collectedCount: collected._count.id,
          outstandingCount: outstanding._count.id,
          reconciledCount: reconciled._count.id,
          totalCount: total._count.id,
        },
        byDriver: Object.values(byDriver),
      },
    };
  });

  // ── GET /deliveries ──────────────────────────────────────

  fastify.get("/deliveries", async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to, driverId, status, page, limit } = parseSafe(deliveriesQuery, request.query);

    const shopId = (request as any).shopId as string;
    const db = (request as any).tenantDb;

    const where: any = { shopId };
    if (status) where.status = status;
    if (driverId) where.driverId = driverId;
    if (from || to) {
      where.collectedAt = {};
      if (from) where.collectedAt.gte = new Date(from);
      if (to) where.collectedAt.lte = new Date(to);
    }

    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      db.cODCollection.findMany({
        where,
        orderBy: { collectedAt: "desc" },
        skip,
        take: limit,
        include: {
          driver: { select: { id: true, name: true, phone: true } },
          order: { select: { id: true, shopifyOrderNumber: true, totalPrice: true, deliveryLocation: true } },
          shipment: { select: { id: true, shipmentNumber: true } },
        },
      }),
      db.cODCollection.count({ where }),
    ]);

    const serialised = records.map((r: any) => {
      let deliveryLat: number | null = null;
      let deliveryLng: number | null = null;
      if (r.order?.deliveryLocation) {
        try {
          const loc =
            typeof r.order.deliveryLocation === 'string'
              ? JSON.parse(r.order.deliveryLocation)
              : r.order.deliveryLocation;
          if (typeof loc.lat === 'number') deliveryLat = loc.lat;
          if (typeof loc.lng === 'number') deliveryLng = loc.lng;
        } catch {}
      }
      return { ...r, amount: centsToDecimal(r.amount), deliveryLat, deliveryLng };
    });

    return {
      data: serialised,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  });

  // ── PATCH /remit ─────────────────────────────────────────

  fastify.patch("/remit", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { deliveryIds, depositId, depositDate, notes } = parseSafe(remitSchema, request.body);

    const shopId = (request as any).shopId as string;
    const db = (request as any).tenantDb;

    // Verify all records belong to this shop and are in a remittable state
    const records = await db.cODCollection.findMany({
      where: {
        id: { in: deliveryIds },
        shopId,
        status: { in: ["collected", "verified"] },
      },
      select: { id: true, status: true },
    });

    if (records.length !== deliveryIds.length) {
      const foundIds = new Set(records.map((r: any) => r.id));
      const missing = deliveryIds.filter((id) => !foundIds.has(id));
      throw new ValidationError(
        `${missing.length} record(s) not found or not in a remittable state. Ids: ${missing.slice(0, 5).join(", ")}`,
      );
    }

    const now = new Date();
    const updateData: any = {
      status: "reconciled",
      reconciledAt: now,
    };
    if (depositId) updateData.depositId = depositId;
    if (depositDate) updateData.depositDate = new Date(depositDate);
    if (notes) updateData.driverNotes = notes;

    const result = await db.cODCollection.updateMany({
      where: {
        id: { in: deliveryIds },
        shopId,
      },
      data: updateData,
    });

    return {
      data: {
        updated: result.count,
        status: "reconciled",
        reconciledAt: now.toISOString(),
      },
    };
  });
}
