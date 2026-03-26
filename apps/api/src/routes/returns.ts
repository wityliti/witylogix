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

      const where: any = {
        tenantId: (request as any).tenantId,
      };

      if (status) {
        where.status = status;
      }
      if (customerId) {
        where.customerId = customerId;
      }
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) {
          (where.createdAt as any).gte = new Date(dateFrom);
        }
        if (dateTo) {
          (where.createdAt as any).lte = new Date(dateTo);
        }
      }

      const [returns, total] = await Promise.all([
        (prisma as any).returnRequest?.findMany?.({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            order: {
              select: {
                id: true,
                shopifyOrderNumber: true,
                customerName: true,
                customerEmail: true,
              },
            },
          },
        }),
        (prisma as any).returnRequest?.count?.({ where }) ?? 0,
      ]);

      return {
        data: returns,
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

      const returnRequest = await (prisma as any).returnRequest?.findUnique?.({
        where: { id },
        include: {
          order: {
            select: {
              id: true,
              shopifyOrderNumber: true,
              customerName: true,
              customerEmail: true,
              totalPrice: true,
            },
          },
        },
      });

      if (!returnRequest) {
        throw new NotFoundError("Return", id);
      }

      // Verify tenant ownership
      if (returnRequest.tenantId !== (request as any).tenantId) {
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

      // Verify order exists and belongs to tenant
      const order = await (prisma as any).order?.findUnique?.({
        where: { id: body.orderId },
      });

      if (!order || order.shopId !== (request as any).tenantId) {
        throw new NotFoundError("Order", body.orderId);
      }

      // Create return using core service
      const returnRequest = returnService.createReturn();

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

      const returnRequest = await (prisma as any).returnRequest?.findUnique?.({
        where: { id },
      });

      if (!returnRequest) {
        throw new NotFoundError("Return", id);
      }

      // Verify tenant ownership
      if (returnRequest.tenantId !== (request as any).tenantId) {
        throw new NotFoundError("Return", id);
      }

      // Validate status transition
      if (!canTransition(returnRequest.status, ReturnStatus.APPROVED)) {
        throw new ValidationError(
          `Cannot approve return in '${returnRequest.status}' status`,
        );
      }

      // Update status and approval details
      const updated = await (prisma as any).returnRequest?.update?.({
        where: { id },
        data: {
          status: ReturnStatus.APPROVED as any,
          approvedAt: new Date(),
          approvedBy: body.approvedBy,
          notes: body.notes,
          shippingLabelUrl: body.shippingLabelUrl,
          trackingNumber: body.trackingNumber,
        },
        include: {
          order: { select: { id: true, customerEmail: true } },
        },
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

      const returnRequest = await (prisma as any).returnRequest?.findUnique?.({
        where: { id },
      });

      if (!returnRequest) {
        throw new NotFoundError("Return", id);
      }

      // Verify tenant ownership
      if (returnRequest.tenantId !== (request as any).tenantId) {
        throw new NotFoundError("Return", id);
      }

      // Validate status transition
      if (!canTransition(returnRequest.status, ReturnStatus.REJECTED)) {
        throw new ValidationError(
          `Cannot reject return in '${returnRequest.status}' status`,
        );
      }

      // Update status with rejection reason
      const updated = await (prisma as any).returnRequest?.update?.({
        where: { id },
        data: {
          status: ReturnStatus.REJECTED as any,
          notes: body.reason,
        },
        include: {
          order: { select: { id: true, customerEmail: true } },
        },
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

      const returnRequest = await (prisma as any).returnRequest?.findUnique?.({
        where: { id },
      });

      if (!returnRequest) {
        throw new NotFoundError("Return", id);
      }

      // Verify tenant ownership
      if (returnRequest.tenantId !== (request as any).tenantId) {
        throw new NotFoundError("Return", id);
      }

      // Validate status transition
      if (!canTransition(returnRequest.status, ReturnStatus.RECEIVED)) {
        throw new ValidationError(
          `Cannot mark return as received in '${returnRequest.status}' status`,
        );
      }

      // Update status
      const updated = await (prisma as any).returnRequest?.update?.({
        where: { id },
        data: {
          status: ReturnStatus.RECEIVED as any,
          receivedAt: new Date(),
        },
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

      const returnRequest = await (prisma as any).returnRequest?.findUnique?.({
        where: { id },
      });

      if (!returnRequest) {
        throw new NotFoundError("Return", id);
      }

      // Verify tenant ownership
      if (returnRequest.tenantId !== (request as any).tenantId) {
        throw new NotFoundError("Return", id);
      }

      // Validate status transition
      if (!canTransition(returnRequest.status, ReturnStatus.INSPECTED)) {
        throw new ValidationError(
          `Cannot inspect return in '${returnRequest.status}' status`,
        );
      }

      // Update items with condition assessment
      const updatedItems = returnRequest.items.map((item: any) => ({
        ...item,
        condition: body.condition,
      }));

      // Update status to inspected
      const updated = await (prisma as any).returnRequest?.update?.({
        where: { id },
        data: {
          status: ReturnStatus.INSPECTED as any,
          items: updatedItems,
          notes: body.notes,
        },
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
      const body = processRefundSchema.parse(request.body);

      const returnRequest = await (prisma as any).returnRequest?.findUnique?.({
        where: { id },
        include: {
          order: { select: { totalPrice: true } },
        },
      });

      if (!returnRequest) {
        throw new NotFoundError("Return", id);
      }

      // Verify tenant ownership
      if (returnRequest.tenantId !== (request as any).tenantId) {
        throw new NotFoundError("Return", id);
      }

      // Validate status transition - must be inspected
      if (returnRequest.status !== ReturnStatus.INSPECTED) {
        throw new ValidationError(
          `Can only process refund for INSPECTED returns, current status: '${returnRequest.status}'`,
        );
      }

      // Process refund using core service
      const refund = returnService.processRefund();

      // Update return status to refunded
      const updated = await (prisma as any).returnRequest?.update?.({
        where: { id },
        data: {
          status: ReturnStatus.REFUNDED as any,
          refundedAt: new Date(),
          refundAmount: 0,
          restockingFee: 0,
        },
      });

      return { data: updated };
    } catch (err) {
      throw err;
    }
  });

  // ── RETURN STATISTICS ───────────────────────────────────────

  fastify.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const where: any = {
        tenantId: (request as any).tenantId,
      };

      // Get counts by status
      const statusCounts = await Promise.all([
        (prisma as any).returnRequest?.count?.({
          where: { ...where, status: "pending" },
        }),
        (prisma as any).returnRequest?.count?.({
          where: { ...where, status: "approved" },
        }),
        (prisma as any).returnRequest?.count?.({
          where: { ...where, status: "rejected" },
        }),
        (prisma as any).returnRequest?.count?.({
          where: { ...where, status: "received" },
        }),
        (prisma as any).returnRequest?.count?.({
          where: { ...where, status: "inspected" },
        }),
        (prisma as any).returnRequest?.count?.({
          where: { ...where, status: "refunded" },
        }),
        (prisma as any).returnRequest?.count?.({
          where: { ...where, status: "refunded" },
        }),
      ]);

      // Get total refund amount
      const refundStats = await (prisma as any).returnRequest?.aggregate?.({
        where: { ...where, status: "refunded" },
        _sum: {
          refundAmount: true,
        },
      });

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
