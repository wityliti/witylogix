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
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@witylogix/db";
import { paginationSchema } from "@witylogix/validators";
import {
  ReturnStatus,
  ReturnReason,
  canTransition,
  validateTransition,
  returnService,
} from "@witylogix/core/returns";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError, ConflictError } from "../lib/errors.js";

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
  reason: z.nativeEnum(ReturnReason),
  reasonDetails: z.string().min(1).max(1000),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        productId: z.string().uuid(),
        productName: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
        returnReason: z.nativeEnum(ReturnReason),
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

      const where: Prisma.ReturnRequestWhereInput = {
        tenantId: request.shopId,
      };

      if (status) {
        where.status = status as ReturnStatus;
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
        db.returnRequest.findMany({
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
        db.returnRequest.count({ where }),
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

      const returnRequest = await db.returnRequest.findUnique({
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
      if (returnRequest.tenantId !== request.shopId) {
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
      const order = await db.order.findUnique({
        where: { id: body.orderId },
      });

      if (!order || order.shopId !== request.shopId) {
        throw new NotFoundError("Order", body.orderId);
      }

      // Create return using core service
      const returnRequest = await returnService.createReturn({
        tenantId: request.shopId,
        orderId: body.orderId,
        customerId: body.customerId,
        reason: body.reason,
        reasonDetails: body.reasonDetails,
        items: body.items,
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

      const returnRequest = await db.returnRequest.findUnique({
        where: { id },
      });

      if (!returnRequest) {
        throw new NotFoundError("Return", id);
      }

      // Verify tenant ownership
      if (returnRequest.tenantId !== request.shopId) {
        throw new NotFoundError("Return", id);
      }

      // Validate status transition
      if (!canTransition(returnRequest.status, ReturnStatus.APPROVED)) {
        throw new ValidationError(
          `Cannot approve return in '${returnRequest.status}' status`,
        );
      }

      // Update status and approval details
      const updated = await db.returnRequest.update({
        where: { id },
        data: {
          status: ReturnStatus.APPROVED,
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

      const returnRequest = await db.returnRequest.findUnique({
        where: { id },
      });

      if (!returnRequest) {
        throw new NotFoundError("Return", id);
      }

      // Verify tenant ownership
      if (returnRequest.tenantId !== request.shopId) {
        throw new NotFoundError("Return", id);
      }

      // Validate status transition
      if (!canTransition(returnRequest.status, ReturnStatus.REJECTED)) {
        throw new ValidationError(
          `Cannot reject return in '${returnRequest.status}' status`,
        );
      }

      // Update status with rejection reason
      const updated = await db.returnRequest.update({
        where: { id },
        data: {
          status: ReturnStatus.REJECTED,
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

      const returnRequest = await db.returnRequest.findUnique({
        where: { id },
      });

      if (!returnRequest) {
        throw new NotFoundError("Return", id);
      }

      // Verify tenant ownership
      if (returnRequest.tenantId !== request.shopId) {
        throw new NotFoundError("Return", id);
      }

      // Validate status transition
      if (!canTransition(returnRequest.status, ReturnStatus.RECEIVED)) {
        throw new ValidationError(
          `Cannot mark return as received in '${returnRequest.status}' status`,
        );
      }

      // Update status
      const updated = await db.returnRequest.update({
        where: { id },
        data: {
          status: ReturnStatus.RECEIVED,
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

      const returnRequest = await db.returnRequest.findUnique({
        where: { id },
      });

      if (!returnRequest) {
        throw new NotFoundError("Return", id);
      }

      // Verify tenant ownership
      if (returnRequest.tenantId !== request.shopId) {
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
      const updated = await db.returnRequest.update({
        where: { id },
        data: {
          status: ReturnStatus.INSPECTED,
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

      const returnRequest = await db.returnRequest.findUnique({
        where: { id },
        include: {
          order: { select: { totalPrice: true } },
        },
      });

      if (!returnRequest) {
        throw new NotFoundError("Return", id);
      }

      // Verify tenant ownership
      if (returnRequest.tenantId !== request.shopId) {
        throw new NotFoundError("Return", id);
      }

      // Validate status transition - must be inspected
      if (returnRequest.status !== ReturnStatus.INSPECTED) {
        throw new ValidationError(
          `Can only process refund for INSPECTED returns, current status: '${returnRequest.status}'`,
        );
      }

      // Process refund using core service
      const refund = await returnService.processRefund({
        returnId: id,
        paymentMethodId: body.paymentMethodId,
        notes: body.notes,
      });

      // Update return status to refunded
      const updated = await db.returnRequest.update({
        where: { id },
        data: {
          status: ReturnStatus.REFUNDED,
          refundedAt: new Date(),
          refundAmount: refund.finalRefundAmount,
          restockingFee: refund.restockingFee,
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
      const where: Prisma.ReturnRequestWhereInput = {
        tenantId: request.shopId,
      };

      // Get counts by status
      const statusCounts = await Promise.all([
        db.returnRequest.count({
          where: { ...where, status: ReturnStatus.REQUESTED },
        }),
        db.returnRequest.count({
          where: { ...where, status: ReturnStatus.APPROVED },
        }),
        db.returnRequest.count({
          where: { ...where, status: ReturnStatus.REJECTED },
        }),
        db.returnRequest.count({
          where: { ...where, status: ReturnStatus.RECEIVED },
        }),
        db.returnRequest.count({
          where: { ...where, status: ReturnStatus.INSPECTED },
        }),
        db.returnRequest.count({
          where: { ...where, status: ReturnStatus.REFUNDED },
        }),
        db.returnRequest.count({
          where: { ...where, status: ReturnStatus.CLOSED },
        }),
      ]);

      // Get total refund amount
      const refundStats = await db.returnRequest.aggregate({
        where: { ...where, status: ReturnStatus.REFUNDED },
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
