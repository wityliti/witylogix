/**
 * Returns/RMA API — full lifecycle management.
 *
 * Routes:
 *   GET    /              List returns (paginated, filterable by status/customer/dateRange)
 *   GET    /stats         Return statistics
 *   GET    /:id           Get single return
 *   POST   /              Create return request
 *   POST   /:id/approve   Approve return
 *   POST   /:id/reject    Reject return (with reason)
 *   POST   /:id/receive   Mark return as received
 *   POST   /:id/inspect   Inspect items
 *   POST   /:id/refund    Process refund
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { paginationSchema } from "@witylogix/validators";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError, ConflictError } from "../lib/errors.js";

// ─── Query/Body Schemas ─────────────────────────────────────

const listReturnsQuery = paginationSchema.extend({
  status: z.string().optional(),
  customerId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(["createdAt", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const createReturnSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum(["DEFECTIVE", "DAMAGED", "WRONG_ITEM", "NOT_AS_DESCRIBED", "CHANGED_MIND", "OTHER"]),
  reasonDetails: z.string().min(1).max(1000).optional(),
  items: z.array(z.object({
    orderItemId: z.string().uuid().optional(),
    productName: z.string().min(1),
    quantity: z.number().int().min(1),
    condition: z.string(),
    refundAmount: z.number().min(0).optional(),
  })).min(1),
  notes: z.string().max(2000).optional(),
});

const rejectSchema = z.object({
  rejectionReason: z.string().min(1).max(1000),
});

// ─── Helpers ───────────────────────────────────────────────

function normalizeReturn(r: any) {
  return {
    id: r.id,
    orderId: r.orderId,
    customerId: r.customerId,
    customerName: r.order?.customerName ?? null,
    customerEmail: r.order?.customerEmail ?? null,
    status: r.status.toLowerCase(),
    reason: r.reason.toLowerCase().replace(/_/g, '_'),
    reasonDetails: r.reasonDetails,
    notes: r.notes,
    items: r.items,
    refundAmount: r.refundAmount ? Number(r.refundAmount) : null,
    refundStatus: r.refundStatus,
    createdAt: r.createdAt,
    requestedAt: r.createdAt,
    approvedAt: r.approvedAt,
    rejectedAt: r.rejectedAt,
    rejectionReason: r.rejectionReason,
    receivedAt: r.receivedAt,
    inspectedAt: r.inspectedAt,
    refundedAt: r.refundedAt,
    updatedAt: r.updatedAt,
    timeline: [],
  };
}

// ─── Route Plugin ─────────────────────────────────────────

async function returnsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST RETURNS ───────────────────────────────��──────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listReturnsQuery.parse(request.query);
    const { page, limit, status, customerId, dateFrom, dateTo, sortBy, sortOrder } = query;
    const shopId = (request as any).shopId as string;
    const db = (request as any).tenantDb;

    const where: Record<string, any> = {};
    if (status) where.status = status.toUpperCase();
    if (customerId) where.customerId = customerId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [returns, total] = await Promise.all([
      db.returnRequest.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order: {
            select: {
              id: true,
              externalOrderNumber: true,
              customerName: true,
              customerEmail: true,
            },
          },
        },
      }),
      db.returnRequest.count({ where }),
    ]);

    return reply.send({
      data: returns.map(normalizeReturn),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // ── STATS ────────────────────────────────────────────────

  fastify.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    const db = (request as any).tenantDb;

    const [total, pending, approved, received, inspected, refunded, rejected, refundAggregate] =
      await Promise.all([
        db.returnRequest.count({}),
        db.returnRequest.count({ where: { status: "PENDING" } }),
        db.returnRequest.count({ where: { status: "APPROVED" } }),
        db.returnRequest.count({ where: { status: "RECEIVED" } }),
        db.returnRequest.count({ where: { status: "INSPECTED" } }),
        db.returnRequest.count({ where: { status: "REFUNDED" } }),
        db.returnRequest.count({ where: { status: "REJECTED" } }),
        db.returnRequest.aggregate({
          _sum: { refundAmount: true },
          _avg: { refundAmount: true },
          where: { status: "REFUNDED" },
        }),
      ]);

    return reply.send({
      totalReturns: total,
      pendingApprovals: pending,
      approvedReturns: approved,
      receivedReturns: received,
      inspectedReturns: inspected,
      refundedReturns: refunded,
      rejectedReturns: rejected,
      totalRefunded: Number(refundAggregate._sum.refundAmount ?? 0),
      averageRefundAmount: Number(refundAggregate._avg.refundAmount ?? 0),
    });
  });

  // ── GET SINGLE RETURN ────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = (request as any).tenantDb;

    const returnRequest = await db.returnRequest.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            externalOrderNumber: true,
            customerName: true,
            customerEmail: true,
            totalPrice: true,
          },
        },
      },
    });

    if (!returnRequest) throw new NotFoundError("Return", id);
    return reply.send(normalizeReturn(returnRequest));
  });

  // ── CREATE RETURN ────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createReturnSchema.parse(request.body);
    const shopId = (request as any).shopId as string;
    const db = (request as any).tenantDb;

    const order = await db.order.findUnique({ where: { id: body.orderId } });
    if (!order) throw new NotFoundError("Order", body.orderId);

    const refundAmount = body.items.reduce(
      (sum, item) => sum + (item.refundAmount ?? 0),
      0
    );

    const returnRequest = await db.returnRequest.create({
      data: {
        shopId,
        tenantId: shopId,
        orderId: body.orderId,
        customerId: (order as any).customerId ?? null,
        reason: body.reason,
        reasonDetails: body.reasonDetails ?? null,
        notes: body.notes ?? null,
        items: body.items,
        refundAmount: refundAmount > 0 ? refundAmount : null,
      },
      include: {
        order: { select: { id: true, externalOrderNumber: true, customerName: true, customerEmail: true } },
      },
    });

    return reply.code(201).send(normalizeReturn(returnRequest));
  });

  // ── APPROVE ──────────────────────────────────────────────

  fastify.post("/:id/approve", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = (request as any).tenantDb;

    const existing = await db.returnRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Return", id);
    if (existing.status !== "PENDING") throw new ConflictError("Only PENDING returns can be approved");

    const updated = await db.returnRequest.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: new Date() },
      include: { order: { select: { id: true, externalOrderNumber: true, customerName: true, customerEmail: true } } },
    });
    return reply.send(normalizeReturn(updated));
  });

  // ── REJECT ───────────────────────────────────────────────

  fastify.post("/:id/reject", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = rejectSchema.parse(request.body);
    const db = (request as any).tenantDb;

    const existing = await db.returnRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Return", id);
    if (!["PENDING", "APPROVED"].includes(existing.status))
      throw new ConflictError("Cannot reject this return at its current status");

    const updated = await db.returnRequest.update({
      where: { id },
      data: { status: "REJECTED", rejectedAt: new Date(), rejectionReason: body.rejectionReason },
      include: { order: { select: { id: true, externalOrderNumber: true, customerName: true, customerEmail: true } } },
    });
    return reply.send(normalizeReturn(updated));
  });

  // ── RECEIVE ──────────────────────────────────────────────

  fastify.post("/:id/receive", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = (request as any).tenantDb;

    const existing = await db.returnRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Return", id);
    if (existing.status !== "APPROVED") throw new ConflictError("Only APPROVED returns can be marked received");

    const updated = await db.returnRequest.update({
      where: { id },
      data: { status: "RECEIVED", receivedAt: new Date() },
      include: { order: { select: { id: true, externalOrderNumber: true, customerName: true, customerEmail: true } } },
    });
    return reply.send(normalizeReturn(updated));
  });

  // ── INSPECT ──────────────────────────────────────────────

  fastify.post("/:id/inspect", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = (request as any).tenantDb;

    const existing = await db.returnRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Return", id);
    if (existing.status !== "RECEIVED") throw new ConflictError("Only RECEIVED returns can be inspected");

    const updated = await db.returnRequest.update({
      where: { id },
      data: { status: "INSPECTED", inspectedAt: new Date() },
      include: { order: { select: { id: true, externalOrderNumber: true, customerName: true, customerEmail: true } } },
    });
    return reply.send(normalizeReturn(updated));
  });

  // ── PROCESS REFUND ───────────────────────────────────────

  fastify.post("/:id/refund", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = (request as any).tenantDb;

    const existing = await db.returnRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Return", id);
    if (existing.status !== "INSPECTED") throw new ConflictError("Only INSPECTED returns can be refunded");

    const updated = await db.returnRequest.update({
      where: { id },
      data: { status: "REFUNDED", refundedAt: new Date(), refundStatus: "processed" },
      include: { order: { select: { id: true, externalOrderNumber: true, customerName: true, customerEmail: true } } },
    });
    return reply.send(normalizeReturn(updated));
  });
}

export default returnsRoutes;
