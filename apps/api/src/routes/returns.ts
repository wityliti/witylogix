/**
 * Returns/RMA API — full lifecycle management.
 *
 * Routes:
 *   GET    /              List returns (paginated, filterable by status/customer/dateRange)
 *   GET    /stats         Return statistics (counts by status, total refunds)
 *   GET    /:id           Get single return
 *   POST   /              Create return request
 *   POST   /:id/approve   Approve return (with optional shipping label)
 *   POST   /:id/reject    Reject return (with reason)
 *   POST   /:id/receive   Mark return as received
 *   POST   /:id/inspect   Inspect items (assess condition)
 *   POST   /:id/refund    Process refund
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { paginationSchema } from "@witylogix/validators";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

// ─── Status Transition Map ──────────────────────────────────

const validTransitions: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["RECEIVED"],
  RECEIVED: ["INSPECTED"],
  INSPECTED: ["REFUNDED", "CLOSED"],
  REFUNDED: ["CLOSED"],
};

const canTransition = (from: string, to: string): boolean =>
  validTransitions[from]?.includes(to) ?? false;

// ─── Schemas ────────────────────────────────────────────────

const listReturnsQuery = paginationSchema.extend({
  status: z
    .enum([
      "PENDING",
      "APPROVED",
      "REJECTED",
      "RECEIVED",
      "INSPECTED",
      "REFUNDED",
      "CLOSED",
    ])
    .optional(),
  customerId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z
    .enum(["createdAt", "status", "refundAmount"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const createReturnSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  reason: z.enum([
    "DEFECTIVE",
    "DAMAGED",
    "WRONG_ITEM",
    "NOT_AS_DESCRIBED",
    "CHANGED_MIND",
    "OTHER",
  ]),
  reasonDetails: z.string().min(1).max(1000),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid().optional(),
        productId: z.string().uuid().optional(),
        productName: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        returnReason: z.string(),
        condition: z.enum(["new", "opened", "damaged", "defective"]),
      }),
    )
    .min(1),
  notes: z.string().optional(),
});

const approveReturnSchema = z.object({
  approvedBy: z.string().optional(),
  notes: z.string().optional(),
  shippingLabelUrl: z.string().url().optional(),
  trackingNumber: z.string().optional(),
});

const rejectReturnSchema = z.object({
  reason: z.string().min(1).max(500),
});

const inspectReturnSchema = z.object({
  condition: z.enum(["new", "opened", "damaged", "defective"]),
  notes: z.string().optional(),
});

const processRefundSchema = z.object({
  refundAmount: z.number().positive().optional(),
  notes: z.string().optional(),
});

// ─── Normalise helper ──────────────────────────────────────

function normalizeReturn(r: any) {
  return {
    id: r.id,
    orderId: r.orderId,
    customerId: r.customerId ?? null,
    customerName: r.customerName,
    customerEmail: r.customerEmail ?? null,
    status: r.status as string,
    reason: r.reason as string,
    reasonDetails: r.reasonDetails,
    refundAmount: parseFloat(String(r.refundAmount ?? 0)),
    refundStatus: r.refundStatus,
    notes: r.notes ?? null,
    approvedAt: r.approvedAt ?? null,
    approvedBy: r.approvedBy ?? null,
    rejectedAt: r.rejectedAt ?? null,
    rejectionReason: r.rejectionReason ?? null,
    receivedAt: r.receivedAt ?? null,
    inspectedAt: r.inspectedAt ?? null,
    refundedAt: r.refundedAt ?? null,
    shippingLabelUrl: r.shippingLabelUrl ?? null,
    trackingNumber: r.trackingNumber ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    items: (r.items ?? []).map((i: any) => ({
      id: i.id,
      productName: i.productName,
      productId: i.productId ?? null,
      quantity: i.quantity,
      unitPrice: parseFloat(String(i.unitPrice ?? 0)),
      condition: i.condition,
      returnReason: i.returnReason,
    })),
    order: r.order ?? null,
  };
}

// ─── Route Plugin ───────────────────────────────────────────

async function returnsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST RETURNS  (/stats must come before /:id) ─────────────

  fastify.get("/stats", async (request: FastifyRequest, _reply: FastifyReply) => {
    const db = request.tenantDb;
    const shopId = request.shopId;

    const [pending, approved, rejected, received, inspected, refunded, closed] =
      await Promise.all([
        db.returnRequest.count({ where: { shopId, status: "PENDING" } }),
        db.returnRequest.count({ where: { shopId, status: "APPROVED" } }),
        db.returnRequest.count({ where: { shopId, status: "REJECTED" } }),
        db.returnRequest.count({ where: { shopId, status: "RECEIVED" } }),
        db.returnRequest.count({ where: { shopId, status: "INSPECTED" } }),
        db.returnRequest.count({ where: { shopId, status: "REFUNDED" } }),
        db.returnRequest.count({ where: { shopId, status: "CLOSED" } }),
      ]);

    const refundAgg = await db.returnRequest.aggregate({
      where: { shopId, status: { in: ["REFUNDED", "CLOSED"] } },
      _sum: { refundAmount: true },
      _avg: { refundAmount: true },
    });

    const total =
      pending + approved + rejected + received + inspected + refunded + closed;

    return {
      data: {
        counts: { pending, approved, rejected, received, inspected, refunded, closed, total },
        totalRefundAmount: parseFloat(
          String(refundAgg._sum.refundAmount ?? 0),
        ),
        averageRefundAmount: parseFloat(
          String(refundAgg._avg.refundAmount ?? 0),
        ),
        returnRate: null,
      },
    };
  });

  fastify.get("/", async (request: FastifyRequest, _reply: FastifyReply) => {
    const db = request.tenantDb;
    const shopId = request.shopId;
    const query = listReturnsQuery.parse(request.query);
    const { page, limit, status, customerId, dateFrom, dateTo, sortBy, sortOrder } =
      query;

    const where: any = { shopId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [rows, total] = await Promise.all([
      db.returnRequest.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          items: true,
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

    return {
      data: rows.map(normalizeReturn),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  // ── GET SINGLE RETURN ────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, _reply: FastifyReply) => {
    const db = request.tenantDb;
    const { id } = request.params as { id: string };

    const ret = await db.returnRequest.findFirst({
      where: { id, shopId: request.shopId },
      include: {
        items: true,
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

    if (!ret) throw new NotFoundError("Return", id);

    return { data: normalizeReturn(ret) };
  });

  // ── CREATE RETURN ────────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const db = request.tenantDb;
    const shopId = request.shopId;
    const body = createReturnSchema.parse(request.body);

    const order = await db.order.findFirst({
      where: { id: body.orderId, shopId },
      select: { id: true, customerName: true, customerEmail: true },
    });
    if (!order) throw new NotFoundError("Order", body.orderId);

    const totalRefund = body.items.reduce(
      (sum, i) => sum + i.quantity * i.unitPrice,
      0,
    );

    const ret = await db.returnRequest.create({
      data: {
        shopId,
        orderId: body.orderId,
        customerId: body.customerId ?? null,
        customerName: order.customerName ?? "Unknown",
        customerEmail: order.customerEmail ?? null,
        reason: body.reason as any,
        reasonDetails: body.reasonDetails,
        refundAmount: totalRefund,
        notes: body.notes ?? null,
        items: {
          create: body.items.map((i) => ({
            orderItemId: i.orderItemId ?? null,
            productId: i.productId ?? null,
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            returnReason: i.returnReason,
            condition: i.condition,
          })),
        },
      },
      include: { items: true, order: { select: { id: true, externalOrderNumber: true } } },
    });

    reply.status(201);
    return { data: normalizeReturn(ret) };
  });

  // ── APPROVE ──────────────────────────────────────────────────

  fastify.post(
    "/:id/approve",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const db = request.tenantDb;
      const { id } = request.params as { id: string };
      const body = approveReturnSchema.parse(request.body);

      const ret = await db.returnRequest.findFirst({
        where: { id, shopId: request.shopId },
      });
      if (!ret) throw new NotFoundError("Return", id);
      if (!canTransition(ret.status, "APPROVED"))
        throw new ValidationError(
          `Cannot approve return in '${ret.status}' status`,
        );

      const updated = await db.returnRequest.update({
        where: { id },
        data: {
          status: "APPROVED" as any,
          approvedAt: new Date(),
          approvedBy: body.approvedBy ?? null,
          notes: body.notes ?? ret.notes,
          shippingLabelUrl: body.shippingLabelUrl ?? null,
          trackingNumber: body.trackingNumber ?? null,
        },
        include: { items: true },
      });

      return { data: normalizeReturn(updated) };
    },
  );

  // ── REJECT ───────────────────────────────────────────────────

  fastify.post(
    "/:id/reject",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const db = request.tenantDb;
      const { id } = request.params as { id: string };
      const body = rejectReturnSchema.parse(request.body);

      const ret = await db.returnRequest.findFirst({
        where: { id, shopId: request.shopId },
      });
      if (!ret) throw new NotFoundError("Return", id);
      if (!canTransition(ret.status, "REJECTED"))
        throw new ValidationError(
          `Cannot reject return in '${ret.status}' status`,
        );

      const updated = await db.returnRequest.update({
        where: { id },
        data: {
          status: "REJECTED" as any,
          rejectedAt: new Date(),
          rejectionReason: body.reason,
        },
        include: { items: true },
      });

      return { data: normalizeReturn(updated) };
    },
  );

  // ── MARK RECEIVED ────────────────────────────────────────────

  fastify.post(
    "/:id/receive",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const db = request.tenantDb;
      const { id } = request.params as { id: string };

      const ret = await db.returnRequest.findFirst({
        where: { id, shopId: request.shopId },
      });
      if (!ret) throw new NotFoundError("Return", id);
      if (!canTransition(ret.status, "RECEIVED"))
        throw new ValidationError(
          `Cannot mark return as received in '${ret.status}' status`,
        );

      const updated = await db.returnRequest.update({
        where: { id },
        data: { status: "RECEIVED" as any, receivedAt: new Date() },
        include: { items: true },
      });

      return { data: normalizeReturn(updated) };
    },
  );

  // ── INSPECT ──────────────────────────────────────────────────

  fastify.post(
    "/:id/inspect",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const db = request.tenantDb;
      const { id } = request.params as { id: string };
      const body = inspectReturnSchema.parse(request.body);

      const ret = await db.returnRequest.findFirst({
        where: { id, shopId: request.shopId },
      });
      if (!ret) throw new NotFoundError("Return", id);
      if (!canTransition(ret.status, "INSPECTED"))
        throw new ValidationError(
          `Cannot inspect return in '${ret.status}' status`,
        );

      await db.returnRequestItem.updateMany({
        where: { returnRequestId: id },
        data: { condition: body.condition },
      });

      const updated = await db.returnRequest.update({
        where: { id },
        data: {
          status: "INSPECTED" as any,
          inspectedAt: new Date(),
          notes: body.notes ?? ret.notes,
        },
        include: { items: true },
      });

      return { data: normalizeReturn(updated) };
    },
  );

  // ── PROCESS REFUND ───────────────────────────────────────────

  fastify.post(
    "/:id/refund",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const db = request.tenantDb;
      const { id } = request.params as { id: string };
      const body = processRefundSchema.parse(request.body);

      const ret = await db.returnRequest.findFirst({
        where: { id, shopId: request.shopId },
      });
      if (!ret) throw new NotFoundError("Return", id);
      if (!canTransition(ret.status, "REFUNDED"))
        throw new ValidationError(
          `Cannot process refund for return in '${ret.status}' status`,
        );

      const refundAmount =
        body.refundAmount ?? parseFloat(String(ret.refundAmount));

      const updated = await db.returnRequest.update({
        where: { id },
        data: {
          status: "REFUNDED" as any,
          refundedAt: new Date(),
          refundAmount,
          refundStatus: "processed",
          notes: body.notes ?? ret.notes,
        },
        include: { items: true },
      });

      return { data: normalizeReturn(updated) };
    },
  );
}

export default returnsRoutes;
