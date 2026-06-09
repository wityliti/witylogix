import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  createPaymentSchema,
  updatePaymentStatusSchema,
  paymentFilterSchema,
} from "@witylogix/validators";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../lib/errors.js";

interface PaymentQueryParams {
  status?: string;
  paymentType?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
}


export default async function paymentRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // GET / — List payments (paginated) with filters
  fastify.get<{ Querystring: PaymentQueryParams }>(
    "/",
    async (request: any, reply: FastifyReply) => {
      try {
        const filters = paymentFilterSchema.parse(request.query);
        const {
          status,
          paymentType,
          paymentMethod,
          dateFrom,
          dateTo,
          minAmount,
          maxAmount,
          page,
          limit,
        } = filters;

        const skip = ((page ?? 1) - 1) * (limit ?? 25);

        // Build where clause
        const where: any = {
          shopId: request.shopId,
        };

        if (status) {
          where.status = status.toUpperCase();
        }
        if (paymentType) {
          where.type = paymentType.toUpperCase();
        }
        if (paymentMethod) {
          where.method = paymentMethod.toUpperCase();
        }
        if (minAmount !== undefined) {
          where.amount = { gte: minAmount };
        }
        if (maxAmount !== undefined) {
          where.amount = { ...where.amount, lte: maxAmount };
        }
        if (dateFrom || dateTo) {
          where.createdAt = {};
          if (dateFrom) {
            where.createdAt.gte = new Date(dateFrom);
          }
          if (dateTo) {
            where.createdAt.lte = new Date(dateTo);
          }
        }

        // Fetch payments with order context when available
        const [rawPayments, total] = await Promise.all([
          request.tenantDb.paymentTransaction.findMany({
            where,
            skip,
            take: limit ?? 25,
            orderBy: { createdAt: "desc" },
            include: {
              paymentMethod: { select: { type: true, displayName: true, lastDigits: true } },
            },
          }),
          request.tenantDb.paymentTransaction.count({ where }),
        ]);

        // Normalize to dashboard-friendly shape
        const PROVIDER_TO_METHOD: Record<string, string> = {
          stripe: "card",
          square: "card",
          paypal: "bank_transfer",
          cod: "cash",
          cash: "cash",
          check: "check",
        };

        const payments = rawPayments.map((p) => {
          const methodRaw =
            p.paymentMethod?.type?.toLowerCase() ||
            p.providerName?.toLowerCase() ||
            "bank_transfer";
          const method = PROVIDER_TO_METHOD[methodRaw] ?? "bank_transfer";

          return {
            id: p.id,
            invoiceNumber: p.orderId
              ? `ORD-${p.orderId.slice(0, 8).toUpperCase()}`
              : p.providerTxnId?.slice(0, 12) ?? p.id.slice(0, 8).toUpperCase(),
            customerName:
              p.paymentMethod?.displayName ??
              (p.providerName ? `${p.providerName} payment` : "Direct payment"),
            amount: Number(p.amount) / 100,
            method,
            status: p.status.toLowerCase(),
            date: p.createdAt.toISOString(),
            reference: p.providerRef ?? p.providerTxnId ?? p.id,
            metadata: p.metadata,
          };
        });

        const totalPages = Math.ceil(total / (limit ?? 25));

        return reply.code(200).send({
          success: true,
          data: payments,
          pagination: {
            total,
            page: page ?? 1,
            limit: limit ?? 25,
            totalPages,
          },
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          return reply.code(400).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // GET /:id — Get single payment with related info
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: any, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const payment = await request.tenantDb.paymentTransaction.findFirst({
          where: {
            id,
            shopId: request.shopId,
          },
          include: {
            shop: {
              select: { id: true, name: true },
            },
          },
        });

        if (!payment) {
          throw new NotFoundError(`Payment ${id} not found`);
        }

        return reply.code(200).send({
          success: true,
          data: payment,
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // POST / — Record a payment
  fastify.post<{ Body: any }>(
    "/",
    async (request: any, reply: FastifyReply) => {
      try {
        const body = createPaymentSchema.parse(request.body);
        const {
          shipmentId,
          paymentType,
          paymentMethod,
          amount,
          currency,
          externalRef,
          metadata,
        } = body;

        // Validate shipmentId exists for DELIVERY type
        if (paymentType === "DELIVERY" && shipmentId) {
          const shipment = await request.tenantDb.shipment.findFirst({
            where: {
              id: shipmentId,
              shopId: request.shopId,
            },
          });

          if (!shipment) {
            throw new NotFoundError(
              `Shipment ${shipmentId} not found for this shop`
            );
          }
        }

        // Create payment transaction
        const payment = await request.tenantDb.paymentTransaction.create({
          data: {
            shopId: request.shopId,
            shipmentId: shipmentId || null,
            type: paymentType,
            method: paymentMethod,
            amount,
            currency,
            providerTxnId: externalRef || null,
            metadata: metadata || {},
            status: "PENDING",
          },
          include: {
            shop: {
              select: { id: true, name: true },
            },
          },
        });

        return reply.code(201).send({
          success: true,
          data: payment,
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          return reply.code(400).send({
            success: false,
            error: error.message,
          });
        }
        if (error instanceof NotFoundError) {
          return reply.code(404).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // PATCH /:id/status — Update payment status
  fastify.patch<{ Params: { id: string }; Body: any }>(
    "/:id/status",
    async (request: any, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const body = updatePaymentStatusSchema.parse(request.body);
        const { status, externalRef } = body;

        // Get current payment
        const currentPayment =
          await request.tenantDb.paymentTransaction.findFirst({
            where: {
              id,
              shopId: request.shopId,
            },
          });

        if (!currentPayment) {
          throw new NotFoundError(`Payment ${id} not found`);
        }

        // Validate status transition
        const validTransitions: Record<string, string[]> = {
          PENDING: ["PROCESSING", "CANCELLED"],
          PROCESSING: ["COMPLETED", "FAILED"],
          COMPLETED: ["REFUNDED"],
          FAILED: ["PENDING"],
          REFUNDED: [],
          CANCELLED: [],
        };

        if (!validTransitions[currentPayment.status]?.includes(status)) {
          throw new ConflictError(
            `Cannot transition from ${currentPayment.status} to ${status}`
          );
        }

        // Update payment
        const updatedPayment =
          await request.tenantDb.paymentTransaction.update({
            where: { id },
            data: {
              status,
              providerTxnId: externalRef || currentPayment.providerTxnId,
              completedAt:
                status === "COMPLETED" || status === "FAILED"
                  ? new Date()
                  : currentPayment.completedAt,
            },
            include: {
              shop: {
                select: { id: true, name: true },
              },
            },
          });

        return reply.code(200).send({
          success: true,
          data: updatedPayment,
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          return reply.code(400).send({
            success: false,
            error: error.message,
          });
        }
        if (error instanceof NotFoundError) {
          return reply.code(404).send({
            success: false,
            error: error.message,
          });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // GET /summary — Revenue summary
  fastify.get<{ Querystring: PaymentQueryParams }>(
    "/summary",
    async (request: any, reply: FastifyReply) => {
      try {
        const filters = paymentFilterSchema.parse(request.query);
        const { dateFrom, dateTo } = filters;

        const where: any = {
          shopId: request.shopId,
          status: "COMPLETED",
        };

        if (dateFrom || dateTo) {
          where.createdAt = {};
          if (dateFrom) {
            where.createdAt.gte = new Date(dateFrom);
          }
          if (dateTo) {
            where.createdAt.lte = new Date(dateTo);
          }
        }

        // Get total revenue
        const totalResult = await request.tenantDb.paymentTransaction.aggregate(
          {
            where,
            _sum: {
              amount: true,
            },
          }
        );

        // Get by status
        const byStatus = await request.tenantDb.paymentTransaction.groupBy({
          by: ["status"],
          where: { shopId: request.shopId },
          _sum: { amount: true },
          _count: true,
        });

        // Get by method
        const byMethod = await request.tenantDb.paymentTransaction.groupBy({
          by: ["method"],
          where: { shopId: request.shopId },
          _sum: { amount: true },
          _count: true,
        });

        // Get by type
        const byType = await request.tenantDb.paymentTransaction.groupBy({
          by: ["type"],
          where: { shopId: request.shopId },
          _sum: { amount: true },
          _count: true,
        });

        // Get daily totals
        const allPayments =
          await request.tenantDb.paymentTransaction.findMany({
            where,
            select: {
              amount: true,
              createdAt: true,
            },
          });

        const dailyTotals: Record<string, number> = {};
        allPayments.forEach((p: any) => {
          const date = p.createdAt.toISOString().split("T")[0];
          dailyTotals[date] = (dailyTotals[date] || 0) + Number(p.amount);
        });

        return reply.code(200).send({
          success: true,
          data: {
            totalRevenue: totalResult._sum.amount || 0,
            byStatus: byStatus.map((s: any) => ({
              status: s.status,
              amount: s._sum.amount || 0,
              count: s._count,
            })),
            byMethod: byMethod.map((m: any) => ({
              method: m.method,
              amount: m._sum.amount || 0,
              count: m._count,
            })),
            byType: byType.map((t: any) => ({
              type: t.type,
              amount: t._sum.amount || 0,
              count: t._count,
            })),
            dailyTotals,
          },
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          return reply.code(400).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // POST /:id/refund — Initiate refund
  fastify.post<{ Params: { id: string }; Body: any }>(
    "/:id/refund",
    async (request: any, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        // Get original payment
        const originalPayment =
          await request.tenantDb.paymentTransaction.findFirst({
            where: {
              id,
              shopId: request.shopId,
            },
          });

        if (!originalPayment) {
          throw new NotFoundError(`Payment ${id} not found`);
        }

        if (originalPayment.status !== "COMPLETED") {
          throw new ConflictError(
            `Cannot refund a ${originalPayment.status} payment`
          );
        }

        // Create refund transaction
        const refund = await request.tenantDb.paymentTransaction.create({
          data: {
            shopId: request.shopId,
            shipmentId: originalPayment.shipmentId,
            type: "REFUND",
            method: originalPayment.method,
            amount: originalPayment.amount,
            currency: originalPayment.currency,
            providerTxnId: `REFUND-${originalPayment.providerTxnId || originalPayment.id}`,
            metadata: {
              ...originalPayment.metadata,
              refundedTransactionId: originalPayment.id,
            },
            status: "PROCESSING",
          },
          include: {
            shop: {
              select: { id: true, name: true },
            },
          },
        });

        // Update original payment to REFUNDED
        await request.tenantDb.paymentTransaction.update({
          where: { id },
          data: {
            status: "REFUNDED",
          },
        });

        return reply.code(201).send({
          success: true,
          data: refund,
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({
            success: false,
            error: error.message,
          });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    }
  );

  // GET /reconciliation — Reconciliation view: match payments against invoices
  fastify.get(
    "/reconciliation",
    async (request: any, reply: FastifyReply) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [payments, invoices] = await Promise.all([
        request.tenantDb.payment.findMany({
          where: {
            shopId: request.shopId,
            createdAt: { gte: thirtyDaysAgo },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            createdAt: true,
            amount: true,
            status: true,
            method: true,
            reference: true,
          },
        }),
        (request.tenantDb as any).invoice?.findMany
          ? (request.tenantDb as any).invoice.findMany({
              where: {
                tenantId: request.tenantId,
                issuedAt: { gte: thirtyDaysAgo },
              },
              orderBy: { issuedAt: "desc" },
              take: 100,
              select: {
                id: true,
                issuedAt: true,
                total: true,
                status: true,
                invoiceNumber: true,
              },
            })
          : Promise.resolve([]),
      ]);

      // Simple matching: mark payments as matched if amount appears in an invoice
      const invoiceAmounts = new Set(invoices.map((inv: any) => String(Math.round(parseFloat(inv.total)))));

      const bankTransactions = payments.map((p: any) => {
        const amtStr = String(Math.round(parseFloat(p.amount)));
        const matched = invoiceAmounts.has(amtStr);
        return {
          id: p.id,
          date: p.createdAt,
          description: `${p.method} payment${p.reference ? ` (${p.reference})` : ""}`,
          amount: parseFloat(p.amount),
          status: matched ? "matched" : "unmatched",
          confidence: matched ? 0.9 : 0,
        };
      });

      const paymentAmounts = new Set(payments.map((p: any) => String(Math.round(parseFloat(p.amount)))));
      const internalRecords = invoices.map((inv: any) => {
        const amtStr = String(Math.round(parseFloat(inv.total)));
        const matched = paymentAmounts.has(amtStr);
        return {
          id: inv.id,
          date: inv.issuedAt,
          description: inv.invoiceNumber || `Invoice ${inv.id.slice(0, 8)}`,
          amount: parseFloat(inv.total),
          status: matched ? "matched" : "unmatched",
        };
      });

      const unmatchedCount = bankTransactions.filter((t: any) => t.status === "unmatched").length;
      const discrepancyTotal = bankTransactions
        .filter((t: any) => t.status === "unmatched")
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      return reply.send({
        data: {
          bankTransactions,
          internalRecords,
          unmatchedCount,
          discrepancyTotal,
        },
      });
    },
  );
}
