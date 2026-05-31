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

  // GET /gateways — List payment methods configured as gateway configs
  fastify.get("/gateways", async (request: any, reply: FastifyReply) => {
    const methods = await request.tenantDb.paymentMethod.findMany({
      where: { shopId: request.shopId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        type: true,
        isDefault: true,
        displayName: true,
        gatewayId: true,
        lastDigits: true,
        expiryDate: true,
        metadata: true,
        createdAt: true,
      },
    });

    // COD is always available as a gateway option
    const hasCod = methods.some((m: any) => m.type === "cod");
    const gateways = [
      ...methods.map((m: any) => ({
        id: m.id,
        name: m.displayName,
        code: m.type,
        status: "connected" as const,
        isDefault: m.isDefault,
        isProduction: true,
        icon: getGatewayIcon(m.type),
        supportedMethods: getSupportedMethods(m.type),
        transactionFeePercent: getGatewayFee(m.type).percent,
        fixedFeeInCents: getGatewayFee(m.type).fixed,
        healthScore: 100,
        config: m.lastDigits
          ? { lastDigits: m.lastDigits, expiryDate: m.expiryDate ?? undefined }
          : undefined,
      })),
      ...(!hasCod
        ? [
            {
              id: "cod-default",
              name: "Cash on Delivery",
              code: "cod" as const,
              status: "connected" as const,
              isDefault: false,
              isProduction: true,
              icon: "💰",
              supportedMethods: ["cash"],
              transactionFeePercent: 0,
              fixedFeeInCents: 0,
              healthScore: 100,
              config: undefined,
            },
          ]
        : []),
    ];

    return reply.send({ data: gateways });
  });

  // PATCH /gateways/:id/default — Set a payment method as default gateway
  fastify.patch("/gateways/:id/default", async (request: any, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const shopId = request.shopId;

    const existing = await request.tenantDb.paymentMethod.findFirst({
      where: { id, shopId },
    });
    if (!existing) {
      return reply.code(404).send({ error: "Payment method not found" });
    }

    // Unset all defaults, set the new one
    await request.tenantDb.$transaction([
      request.tenantDb.paymentMethod.updateMany({
        where: { shopId },
        data: { isDefault: false },
      }),
      request.tenantDb.paymentMethod.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return reply.send({ data: { id, isDefault: true } });
  });

  // DELETE /gateways/:id — Remove a payment method / gateway
  fastify.delete("/gateways/:id", async (request: any, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const shopId = request.shopId;

    const existing = await request.tenantDb.paymentMethod.findFirst({
      where: { id, shopId },
    });
    if (!existing) {
      return reply.code(404).send({ error: "Payment method not found" });
    }

    await request.tenantDb.paymentMethod.update({
      where: { id },
      data: { isActive: false },
    });

    return reply.send({ data: { id, deleted: true } });
  });

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

  // ─── Gateway Management ──────────────────────────────────────
  // Gateways are stored in Shop.settings.paymentGateways (JSON array).
  // No hardcoded defaults — if nothing is configured, returns empty array.

  // GET /gateways — List configured payment gateways
  fastify.get(
    "/gateways",
    async (request: any, reply: FastifyReply) => {
      const shop = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });

      const settings: Record<string, unknown> =
        shop?.settings && typeof shop.settings === "object" && !Array.isArray(shop.settings)
          ? (shop.settings as Record<string, unknown>)
          : {};

      const gateways = Array.isArray(settings.paymentGateways) ? settings.paymentGateways : [];

      return reply.code(200).send({
        success: true,
        data: gateways,
      });
    },
  );

  // PATCH /gateways/:id/default — Set a gateway as the default
  fastify.patch(
    "/gateways/:id/default",
    async (request: any, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const shop = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });

      const settings: Record<string, unknown> =
        shop?.settings && typeof shop.settings === "object" && !Array.isArray(shop.settings)
          ? (shop.settings as Record<string, unknown>)
          : {};

      const gateways: any[] = Array.isArray(settings.paymentGateways)
        ? settings.paymentGateways
        : [];

      const idx = gateways.findIndex((g) => g.id === id);
      if (idx === -1) {
        return reply.code(404).send({ success: false, error: `Gateway ${id} not found` });
      }

      const updated = gateways.map((g) => ({ ...g, isDefault: g.id === id }));

      await request.tenantDb.shop.update({
        where: { id: request.shopId },
        data: {
          settings: {
            ...settings,
            paymentGateways: updated,
          },
        },
      });

      return reply.code(200).send({
        success: true,
        data: updated[idx],
      });
    },
  );

  // DELETE /gateways/:id — Remove a gateway from configuration
  fastify.delete(
    "/gateways/:id",
    async (request: any, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const shop = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });

      const settings: Record<string, unknown> =
        shop?.settings && typeof shop.settings === "object" && !Array.isArray(shop.settings)
          ? (shop.settings as Record<string, unknown>)
          : {};

      const gateways: any[] = Array.isArray(settings.paymentGateways)
        ? settings.paymentGateways
        : [];

      const idx = gateways.findIndex((g) => g.id === id);
      if (idx === -1) {
        return reply.code(404).send({ success: false, error: `Gateway ${id} not found` });
      }

      const remaining = gateways.filter((g) => g.id !== id);

      await request.tenantDb.shop.update({
        where: { id: request.shopId },
        data: {
          settings: {
            ...settings,
            paymentGateways: remaining,
          },
        },
      });

      return reply.code(200).send({ success: true, data: { deleted: true } });
    },
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

  // GET /gateways — List configured payment gateways
  fastify.get("/gateways", async (request: FastifyRequest, reply: FastifyReply) => {
    const stripeOk = !!(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_PUBLISHABLE_KEY);
    const paypalOk = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
    const squareOk = !!(process.env.SQUARE_ACCESS_TOKEN);

    // Fetch shop to determine default gateway from settings
    const shop = await request.tenantDb.shop.findUnique({
      where: { id: request.shopId },
      select: { settings: true },
    });
    const shopSettings = (shop?.settings ?? {}) as Record<string, unknown>;
    const defaultGateway = (shopSettings.defaultPaymentGateway as string) ?? "stripe";

    const gateways = [
      {
        id: "stripe",
        name: "Stripe",
        code: "stripe" as const,
        status: stripeOk ? "connected" : "disconnected",
        isDefault: defaultGateway === "stripe",
        isProduction: process.env.NODE_ENV === "production",
        icon: "💳",
        supportedMethods: ["card", "apple_pay", "google_pay", "bank_transfer"],
        transactionFeePercent: 2.9,
        fixedFeeInCents: 30,
        healthScore: stripeOk ? 100 : 0,
      },
      {
        id: "paypal",
        name: "PayPal",
        code: "paypal" as const,
        status: paypalOk ? "connected" : "disconnected",
        isDefault: defaultGateway === "paypal",
        isProduction: process.env.NODE_ENV === "production",
        icon: "🅿️",
        supportedMethods: ["paypal", "card"],
        transactionFeePercent: 2.9,
        fixedFeeInCents: 30,
        healthScore: paypalOk ? 100 : 0,
      },
      {
        id: "square",
        name: "Square",
        code: "square" as const,
        status: squareOk ? "connected" : "disconnected",
        isDefault: defaultGateway === "square",
        isProduction: process.env.NODE_ENV === "production",
        icon: "◻️",
        supportedMethods: ["card", "apple_pay", "google_pay"],
        transactionFeePercent: 2.6,
        fixedFeeInCents: 0,
        healthScore: squareOk ? 100 : 0,
      },
      {
        id: "cod",
        name: "Cash on Delivery",
        code: "cod" as const,
        status: "connected",
        isDefault: defaultGateway === "cod",
        isProduction: true,
        icon: "💰",
        supportedMethods: ["cash"],
        transactionFeePercent: 0,
        fixedFeeInCents: 0,
        healthScore: 100,
      },
    ];

    return reply.send({
      data: gateways,
      total: gateways.length,
    });
  });

  // PATCH /gateways/:id/default — Set default gateway
  fastify.patch("/gateways/:id/default", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);
    const { id } = request.params as { id: string };

    await request.tenantDb.shop.update({
      where: { id: request.shopId },
      data: { settings: { ...(await request.tenantDb.shop.findUnique({ where: { id: request.shopId }, select: { settings: true } }))?.settings as object, defaultPaymentGateway: id } },
    });

    return reply.send({ success: true, defaultGateway: id });
  });
}

function getGatewayIcon(type: string): string {
  const icons: Record<string, string> = {
    credit_card: "💳",
    debit_card: "💳",
    cod: "💰",
    bank_transfer: "🏦",
    wallet: "👛",
    stripe: "💳",
    paypal: "🅿️",
    square: "◻️",
  };
  return icons[type] ?? "💳";
}

function getSupportedMethods(type: string): string[] {
  const methods: Record<string, string[]> = {
    credit_card: ["card", "apple_pay", "google_pay"],
    debit_card: ["card"],
    cod: ["cash"],
    bank_transfer: ["bank_transfer"],
    wallet: ["wallet"],
    stripe: ["card", "apple_pay", "google_pay", "bank_transfer"],
    paypal: ["paypal", "card"],
    square: ["card", "apple_pay", "google_pay"],
  };
  return methods[type] ?? ["card"];
}

function getGatewayFee(type: string): { percent: number; fixed: number } {
  const fees: Record<string, { percent: number; fixed: number }> = {
    credit_card: { percent: 2.9, fixed: 30 },
    debit_card: { percent: 2.6, fixed: 0 },
    cod: { percent: 0, fixed: 0 },
    bank_transfer: { percent: 0.8, fixed: 25 },
    wallet: { percent: 1.5, fixed: 0 },
    stripe: { percent: 2.9, fixed: 30 },
    paypal: { percent: 2.9, fixed: 30 },
    square: { percent: 2.6, fixed: 0 },
  };
  return fees[type] ?? { percent: 2.9, fixed: 30 };
}

function getGatewayIcon(type: string): string {
  const icons: Record<string, string> = {
    credit_card: "💳",
    debit_card: "💳",
    cod: "💰",
    bank_transfer: "🏦",
    wallet: "👛",
    stripe: "💳",
    paypal: "🅿️",
    square: "◻️",
  };
  return icons[type] ?? "💳";
}

function getSupportedMethods(type: string): string[] {
  const methods: Record<string, string[]> = {
    credit_card: ["card", "apple_pay", "google_pay"],
    debit_card: ["card"],
    cod: ["cash"],
    bank_transfer: ["bank_transfer"],
    wallet: ["wallet"],
    stripe: ["card", "apple_pay", "google_pay", "bank_transfer"],
    paypal: ["paypal", "card"],
    square: ["card", "apple_pay", "google_pay"],
  };
  return methods[type] ?? ["card"];
}

function getGatewayFee(type: string): { percent: number; fixed: number } {
  const fees: Record<string, { percent: number; fixed: number }> = {
    credit_card: { percent: 2.9, fixed: 30 },
    debit_card: { percent: 2.6, fixed: 0 },
    cod: { percent: 0, fixed: 0 },
    bank_transfer: { percent: 0.8, fixed: 25 },
    wallet: { percent: 1.5, fixed: 0 },
    stripe: { percent: 2.9, fixed: 30 },
    paypal: { percent: 2.9, fixed: 30 },
    square: { percent: 2.6, fixed: 0 },
  };
  return fees[type] ?? { percent: 2.9, fixed: 30 };
}
