/**
 * Returns/RMA API — full lifecycle management backed by real Prisma.
 *
 * Routes:
 *   GET    /              List returns (paginated, filterable by status/customer/dateRange)
 *   GET    /:id           Get single return
 *   POST   /              Create return request
 *   POST   /:id/approve   Approve return (with optional shipping label)
 *   POST   /:id/reject    Reject return (with reason)
 *   POST   /:id/receive   Mark return as received
 *   POST   /:id/inspect   Inspect items (assess condition)
 *   POST   /:id/refund    Process refund
 *   GET    /stats         Return statistics (counts by status, total refunds)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import { paginationSchema } from "@witylogix/validators";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

const ReturnStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  RECEIVED: "received",
  INSPECTED: "inspected",
  REFUNDED: "refunded",
} as const;

const ReturnReason = {
  DEFECTIVE: "defective",
  DAMAGED: "damaged",
  WRONG_ITEM: "wrong_item",
  NOT_AS_DESCRIBED: "not_as_described",
  CHANGED_MIND: "changed_mind",
} as const;

const canTransition = (from: string, to: string): boolean => {
  const valid: Record<string, string[]> = {
    [ReturnStatus.PENDING]: [ReturnStatus.APPROVED, ReturnStatus.REJECTED],
    [ReturnStatus.APPROVED]: [ReturnStatus.RECEIVED],
    [ReturnStatus.RECEIVED]: [ReturnStatus.INSPECTED],
    [ReturnStatus.INSPECTED]: [ReturnStatus.REFUNDED],
  };
  return valid[from]?.includes(to) ?? false;
};

// ─── Schemas ────────────────────────────────────────────────

const listReturnsQuery = paginationSchema.extend({
  status: z.string().optional(),
  customerId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(["createdAt", "status", "customerId"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const createReturnSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  reason: z.enum(Object.values(ReturnReason) as [string, ...string[]]),
  reasonDetails: z.string().min(1).max(1000),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid().optional(),
        productId: z.string().uuid().optional(),
        productName: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        returnReason: z
          .enum(Object.values(ReturnReason) as [string, ...string[]])
          .optional(),
        condition: z.enum(["new", "opened", "damaged", "defective"]),
      }),
    )
    .min(1),
});

const approveReturnSchema = z.object({
  approvedBy: z.string(),
  notes: z.string().optional(),
  shippingLabelUrl: z.string().url().optional(),
  trackingNumber: z.string().optional(),
});

const rejectReturnSchema = z.object({
  reason: z.string().min(1).max(500),
});

const inspectItemsSchema = z.object({
  condition: z.enum(["new", "opened", "damaged", "defective"]),
  notes: z.string().optional(),
});

const processRefundSchema = z.object({
  paymentMethodId: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Route Plugin ────────────────────────────────────────────

async function returnsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST RETURNS ─────────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest) => {
    const query = listReturnsQuery.parse(request.query);
    const {
      page,
      limit,
      status,
      customerId,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
    } = query;
    const shopId = (request as any).tenantId as string;

    const where: any = { shopId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [returns, total] = await Promise.all([
      prisma.returnRequest.findMany({
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
              deliveryLocation: true,
            },
          },
        },
      }),
      prisma.returnRequest.count({ where }),
    ]);

    return {
      data: returns,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── GET RETURN ───────────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const shopId = (request as any).tenantId as string;

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            externalOrderNumber: true,
            customerName: true,
            customerEmail: true,
            totalPrice: true,
            deliveryLocation: true,
          },
        },
      },
    });

    if (!returnRequest || returnRequest.shopId !== shopId) {
      throw new NotFoundError("Return", id);
    }

    return { data: returnRequest };
  });

  // ── CREATE RETURN ─────────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createReturnSchema.parse(request.body);
    const shopId = (request as any).tenantId as string;

    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
    });
    if (!order || order.shopId !== shopId) {
      throw new NotFoundError("Order", body.orderId);
    }

    // Compute total refund amount from items
    const totalRefund = body.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    // Build items with stable IDs for the JSON column
    const itemsWithIds = body.items.map((item, idx) => ({
      id: `item_${idx}`,
      orderItemId: item.orderItemId ?? null,
      productId: item.productId ?? null,
      productName: item.productName,
      name: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      condition: item.condition,
      refundAmount: item.quantity * item.unitPrice,
    }));

    const returnRequest = await prisma.returnRequest.create({
      data: {
        shopId,
        orderId: body.orderId,
        customerId: body.customerId ?? null,
        customerName: order.customerName ?? null,
        customerEmail: order.customerEmail ?? null,
        status: ReturnStatus.PENDING,
        reason: body.reason,
        reasonDetails: body.reasonDetails,
        items: itemsWithIds,
        totalRefundAmount: totalRefund,
      },
    });

    reply.status(201);
    return { data: returnRequest };
  });

  // ── APPROVE RETURN ────────────────────────────────────────────

  fastify.post("/:id/approve", async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const body = approveReturnSchema.parse(request.body);
    const shopId = (request as any).tenantId as string;

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id },
    });
    if (!returnRequest || returnRequest.shopId !== shopId) {
      throw new NotFoundError("Return", id);
    }
    if (!canTransition(returnRequest.status, ReturnStatus.APPROVED)) {
      throw new ValidationError(
        `Cannot approve return in '${returnRequest.status}' status`,
      );
    }

    const updated = await prisma.returnRequest.update({
      where: { id },
      data: {
        status: ReturnStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: body.approvedBy,
        notes: body.notes ?? null,
        shippingLabelUrl: body.shippingLabelUrl ?? null,
        trackingNumber: body.trackingNumber ?? null,
      },
      include: { order: { select: { id: true, customerEmail: true } } },
    });

    return { data: updated };
  });

  // ── REJECT RETURN ─────────────────────────────────────────────

  fastify.post("/:id/reject", async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const body = rejectReturnSchema.parse(request.body);
    const shopId = (request as any).tenantId as string;

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id },
    });
    if (!returnRequest || returnRequest.shopId !== shopId) {
      throw new NotFoundError("Return", id);
    }
    if (!canTransition(returnRequest.status, ReturnStatus.REJECTED)) {
      throw new ValidationError(
        `Cannot reject return in '${returnRequest.status}' status`,
      );
    }

    const updated = await prisma.returnRequest.update({
      where: { id },
      data: {
        status: ReturnStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: body.reason,
      },
      include: { order: { select: { id: true, customerEmail: true } } },
    });

    return { data: updated };
  });

  // ── MARK AS RECEIVED ──────────────────────────────────────────

  fastify.post("/:id/receive", async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const shopId = (request as any).tenantId as string;

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id },
    });
    if (!returnRequest || returnRequest.shopId !== shopId) {
      throw new NotFoundError("Return", id);
    }
    if (!canTransition(returnRequest.status, ReturnStatus.RECEIVED)) {
      throw new ValidationError(
        `Cannot mark return as received in '${returnRequest.status}' status`,
      );
    }

    const updated = await prisma.returnRequest.update({
      where: { id },
      data: { status: ReturnStatus.RECEIVED, receivedAt: new Date() },
    });

    return { data: updated };
  });

  // ── INSPECT ITEMS ─────────────────────────────────────────────

  fastify.post("/:id/inspect", async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const body = inspectItemsSchema.parse(request.body);
    const shopId = (request as any).tenantId as string;

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id },
    });
    if (!returnRequest || returnRequest.shopId !== shopId) {
      throw new NotFoundError("Return", id);
    }
    if (!canTransition(returnRequest.status, ReturnStatus.INSPECTED)) {
      throw new ValidationError(
        `Cannot inspect return in '${returnRequest.status}' status`,
      );
    }

    const updatedItems = Array.isArray(returnRequest.items)
      ? (returnRequest.items as any[]).map((item: any) => ({
          ...item,
          condition: body.condition,
        }))
      : [];

    const updated = await prisma.returnRequest.update({
      where: { id },
      data: {
        status: ReturnStatus.INSPECTED,
        inspectedAt: new Date(),
        items: updatedItems,
        notes: body.notes ?? returnRequest.notes,
      },
    });

    return { data: updated };
  });

  // ── PROCESS REFUND ────────────────────────────────────────────

  fastify.post("/:id/refund", async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const body = processRefundSchema.parse(request.body);
    const shopId = (request as any).tenantId as string;

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id },
      include: { order: { select: { totalPrice: true } } },
    });
    if (!returnRequest || returnRequest.shopId !== shopId) {
      throw new NotFoundError("Return", id);
    }
    if (returnRequest.status !== ReturnStatus.INSPECTED) {
      throw new ValidationError(
        `Can only process refund for INSPECTED returns, current status: '${returnRequest.status}'`,
      );
    }

    // Compute refund from items total; apply 10% restocking fee for damaged/opened
    const itemsList = Array.isArray(returnRequest.items)
      ? (returnRequest.items as any[])
      : [];
    const itemsTotal = itemsList.reduce(
      (sum: number, item: any) =>
        sum + (item.quantity ?? 1) * (item.unitPrice ?? 0),
      0,
    );
    const hasDeduction = itemsList.some((i: any) =>
      ["damaged", "opened"].includes(i.condition),
    );
    const restockingFee = hasDeduction ? itemsTotal * 0.1 : 0;
    const refundAmount = itemsTotal - restockingFee;

    const updated = await prisma.returnRequest.update({
      where: { id },
      data: {
        status: ReturnStatus.REFUNDED,
        refundedAt: new Date(),
        refundAmount,
        restockingFee,
        refundStatus: "processed",
        notes: body.notes ?? returnRequest.notes,
      },
    });

    return { data: updated };
  });

  // ── STATISTICS ────────────────────────────────────────────────

  fastify.get("/stats", async (request: FastifyRequest) => {
    const shopId = (request as any).tenantId as string;
    const where = { shopId };

    const [
      pending,
      approved,
      rejected,
      received,
      inspected,
      refunded,
      aggregate,
    ] = await Promise.all([
      prisma.returnRequest.count({ where: { ...where, status: "pending" } }),
      prisma.returnRequest.count({ where: { ...where, status: "approved" } }),
      prisma.returnRequest.count({ where: { ...where, status: "rejected" } }),
      prisma.returnRequest.count({ where: { ...where, status: "received" } }),
      prisma.returnRequest.count({ where: { ...where, status: "inspected" } }),
      prisma.returnRequest.count({ where: { ...where, status: "refunded" } }),
      prisma.returnRequest.aggregate({
        where: { ...where, status: "refunded" },
        _sum: { refundAmount: true },
      }),
    ]);

    const total =
      pending + approved + rejected + received + inspected + refunded;

    return {
      data: {
        counts: {
          requested: pending,
          approved,
          rejected,
          received,
          inspected,
          refunded,
          closed: refunded,
        },
        totalRefundAmount: Number(aggregate._sum.refundAmount ?? 0),
        totalReturns: total,
      },
    };
  });
}

export default returnsRoutes;
