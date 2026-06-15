/**
 * Returns/RMA API — full lifecycle management.
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
import { NotFoundError, ValidationError, ConflictError } from "../lib/errors.js";

// Enums for returns
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

// Stub return service
const returnService = {
  calculateRefund: () => 0,
  validateReturn: () => true,
  createReturn: () => ({}),
  processRefund: () => ({}),
};

// Helper function to check if transition is valid
const canTransition = (from: string, to: string): boolean => {
  const validTransitions: Record<string, string[]> = {
    [ReturnStatus.PENDING]: [ReturnStatus.APPROVED, ReturnStatus.REJECTED],
    [ReturnStatus.APPROVED]: [ReturnStatus.RECEIVED],
    [ReturnStatus.RECEIVED]: [ReturnStatus.INSPECTED],
    [ReturnStatus.INSPECTED]: [ReturnStatus.REFUNDED],
  };
  return validTransitions[from]?.includes(to) || false;
};

// ─── Query Params Schema ────────────────────────────────────

const listReturnsQuery = paginationSchema.extend({
  status: z.string().optional(),
  customerId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(["createdAt", "status", "customerId"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Request Body Schemas ───────────────────────────────────

const createReturnSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  reason: z.enum(Object.values(ReturnReason) as any),
  reasonDetails: z.string().min(1).max(1000),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        productId: z.string().uuid(),
        productName: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
        returnReason: z.enum(Object.values(ReturnReason) as any),
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
  paymentMethodId: z.string(),
  notes: z.string().optional(),
});

// ─── Route Plugin ───────────────────────────────────────────

async function returnsRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST RETURNS ────────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = listReturnsQuery.parse(request.query);
      const { page, limit, status, customerId, dateFrom, dateTo, sortBy, sortOrder } = query;

      const shopId = (request as any).shopId as string;

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
              },
            },
            items: true,
          },
        }),
        prisma.returnRequest.count({ where }),
      ]);

      const normalised = returns.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        customerId: r.customerId ?? undefined,
        customerName: r.customerName ?? r.order?.customerName ?? '',
        customerEmail: r.customerEmail ?? r.order?.customerEmail ?? undefined,
        status: r.status,
        reason: r.reason,
        description: r.description ?? undefined,
        items: r.items.map((i) => ({
          id: i.id,
          name: i.productName,
          quantity: i.quantity,
          condition: i.condition,
          notes: i.notes ?? undefined,
        })),
        refundAmount: r.refundAmount ? Number(r.refundAmount) : undefined,
        notes: r.notes ?? undefined,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        approvedAt: r.approvedAt?.toISOString(),
        rejectedAt: r.rejectedAt?.toISOString(),
        rejectionReason: r.rejectionReason ?? undefined,
        receivedAt: r.receivedAt?.toISOString(),
        refundedAt: r.refundedAt?.toISOString(),
      }));

      return {
        data: normalised,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      throw err;
    }
  });

  // ── GET RETURN ──────────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const shopId = (request as any).shopId as string;

      const returnRequest = await prisma.returnRequest.findUnique({
        where: { id },
        include: {
          order: {
            select: {
              id: true,
              externalOrderNumber: true,
              customerName: true,
              customerEmail: true,
            },
          },
          items: true,
        },
      });

      if (!returnRequest || returnRequest.shopId !== shopId) {
        throw new NotFoundError("Return", id);
      }

      return { data: returnRequest };
    } catch (err) {
      throw err;
    }
  });

  // ── CREATE RETURN ───────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createReturnSchema.parse(request.body);
      const shopId = (request as any).shopId as string;

      const order = await prisma.order.findUnique({ where: { id: body.orderId } });
      if (!order || order.shopId !== shopId) {
        throw new NotFoundError("Order", body.orderId);
      }

      const returnRequest = await prisma.returnRequest.create({
        data: {
          shopId,
          orderId: body.orderId,
          customerId: body.customerId,
          reason: (body.reason as any).toUpperCase(),
          description: body.reasonDetails,
          items: {
            create: body.items.map((i) => ({
              productId: i.productId,
              productName: i.productName,
              quantity: i.quantity,
              condition: i.condition,
            })),
          },
        },
        include: { items: true },
      });

      reply.status(201);
      return { data: returnRequest };
    } catch (err) {
      throw err;
    }
  });

  // ── APPROVE RETURN ──────────────────────────────────────────

  fastify.post("/:id/approve", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = approveReturnSchema.parse(request.body);
      const shopId = (request as any).shopId as string;

      const ret = await prisma.returnRequest.findUnique({ where: { id } });
      if (!ret || ret.shopId !== shopId) throw new NotFoundError("Return", id);
      if (!canTransition(ret.status, ReturnStatus.APPROVED)) {
        throw new ValidationError(`Cannot approve return in '${ret.status}' status`);
      }

      const updated = await prisma.returnRequest.update({
        where: { id },
        data: { status: "APPROVED", approvedAt: new Date(), notes: body.notes ?? ret.notes },
      });
      return { data: updated };
    } catch (err) {
      throw err;
    }
  });

  // ── REJECT RETURN ───────────────────────────────────────────

  fastify.post("/:id/reject", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = rejectReturnSchema.parse(request.body);
      const shopId = (request as any).shopId as string;

      const ret = await prisma.returnRequest.findUnique({ where: { id } });
      if (!ret || ret.shopId !== shopId) throw new NotFoundError("Return", id);
      if (!canTransition(ret.status, ReturnStatus.REJECTED)) {
        throw new ValidationError(`Cannot reject return in '${ret.status}' status`);
      }

      const updated = await prisma.returnRequest.update({
        where: { id },
        data: { status: "REJECTED", rejectedAt: new Date(), rejectionReason: body.reason },
      });
      return { data: updated };
    } catch (err) {
      throw err;
    }
  });

  // ── MARK AS RECEIVED ────────────────────────────────────────

  fastify.post("/:id/receive", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const shopId = (request as any).shopId as string;

      const ret = await prisma.returnRequest.findUnique({ where: { id } });
      if (!ret || ret.shopId !== shopId) throw new NotFoundError("Return", id);
      if (!canTransition(ret.status, ReturnStatus.RECEIVED)) {
        throw new ValidationError(`Cannot mark return as received in '${ret.status}' status`);
      }

      const updated = await prisma.returnRequest.update({
        where: { id },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });
      return { data: updated };
    } catch (err) {
      throw err;
    }
  });

  // ── INSPECT ITEMS ───────────────────────────────────────────

  fastify.post("/:id/inspect", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = inspectItemsSchema.parse(request.body);
      const shopId = (request as any).shopId as string;

      const ret = await prisma.returnRequest.findUnique({ where: { id } });
      if (!ret || ret.shopId !== shopId) throw new NotFoundError("Return", id);
      if (!canTransition(ret.status, ReturnStatus.INSPECTED)) {
        throw new ValidationError(`Cannot inspect return in '${ret.status}' status`);
      }

      const updated = await prisma.returnRequest.update({
        where: { id },
        data: { status: "INSPECTED", notes: body.notes ?? ret.notes },
      });
      return { data: updated };
    } catch (err) {
      throw err;
    }
  });

  // ── PROCESS REFUND ──────────────────────────────────────────

  fastify.post("/:id/refund", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      processRefundSchema.parse(request.body);
      const shopId = (request as any).shopId as string;

      const ret = await prisma.returnRequest.findUnique({
        where: { id },
        include: { order: { select: { id: true } } },
      });
      if (!ret || ret.shopId !== shopId) throw new NotFoundError("Return", id);
      if (ret.status !== "INSPECTED") {
        throw new ValidationError(`Can only refund INSPECTED returns, current: '${ret.status}'`);
      }

      const updated = await prisma.returnRequest.update({
        where: { id },
        data: { status: "REFUNDED", refundedAt: new Date() },
      });
      return { data: updated };
    } catch (err) {
      throw err;
    }
  });

  // ── RETURN STATISTICS ───────────────────────────────────────

  fastify.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const shopId = (request as any).shopId as string;
      const where = { shopId };

      const [pending, approved, rejected, received, inspected, refunded, refundStats] = await Promise.all([
        prisma.returnRequest.count({ where: { ...where, status: "PENDING" } }),
        prisma.returnRequest.count({ where: { ...where, status: "APPROVED" } }),
        prisma.returnRequest.count({ where: { ...where, status: "REJECTED" } }),
        prisma.returnRequest.count({ where: { ...where, status: "RECEIVED" } }),
        prisma.returnRequest.count({ where: { ...where, status: "INSPECTED" } }),
        prisma.returnRequest.count({ where: { ...where, status: "REFUNDED" } }),
        prisma.returnRequest.aggregate({
          where: { ...where, status: "REFUNDED" },
          _sum: { refundAmount: true },
        }),
      ]);

      const statusCounts = [pending, approved, rejected, received, inspected, refunded, refunded];

      return {
        data: {
          counts: {
            requested: statusCounts[0],
            approved: statusCounts[1],
            rejected: statusCounts[2],
            received: statusCounts[3],
            inspected: statusCounts[4],
            refunded: statusCounts[5],
            closed: statusCounts[6],
          },
          totalRefundAmount: refundStats._sum.refundAmount || 0,
          totalReturns: statusCounts.reduce((a, b) => a + b, 0),
        },
      };
    } catch (err) {
      throw err;
    }
  });
}

export default returnsRoutes;
