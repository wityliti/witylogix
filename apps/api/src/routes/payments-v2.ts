/**
 * Payment API Routes v2
 *
 * Provides endpoints for:
 * - Creating and capturing payments via multiple gateways
 * - Processing refunds
 * - Checking payment status
 * - Managing payment methods
 * - Webhook handling for payment providers
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { PaymentError } from "@witylogix/core/payments";
import {
  MultiGatewayRouter,
  type GatewayMetadata,
  type GatewayRoutingParams,
} from "@witylogix/core/payments/multi-gateway-router";
import {
  PayPalGateway,
  SquareGateway,
  PaymentProcessor,
} from "@witylogix/core/payments";

// ─── REQUEST/RESPONSE TYPES ───────────────────────────────────────────────

interface CreatePaymentRequest {
  amount: number;
  currency: string;
  methodType: string;
  orderId?: string;
  shipmentId?: string;
  customerId?: string;
  description?: string;
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
}

interface CapturePaymentRequest {
  paymentIntentId: string;
  sourceId?: string; // For Square
}

interface RefundPaymentRequest {
  transactionId: string;
  amount?: number;
  reason: string;
  description?: string;
}

interface WebhookRequest {
  body: Record<string, any>;
  headers: Record<string, string>;
}

// ─── PAYMENT ROUTES ───────────────────────────────────────────────────────

export default async function paymentRoutesV2(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // Initialize payment gateway router and processors
  const router = new MultiGatewayRouter(fastify.log);
  let processor: PaymentProcessor;

  // Setup callback for route initialization
  fastify.addHook("onReady", async () => {
    processor = new PaymentProcessor(fastify.db, fastify.log);

    // Register PayPal gateway
    try {
      const paypalConfig = {
        name: "PayPal",
        isEnabled: process.env.PAYPAL_ENABLED === "true",
        isProduction: process.env.NODE_ENV === "production",
        secretKey: process.env.PAYPAL_CLIENT_SECRET,
        publicKey: process.env.PAYPAL_CLIENT_ID,
        metadata: {
          clientId: process.env.PAYPAL_CLIENT_ID,
          webhookId: process.env.PAYPAL_WEBHOOK_ID,
        },
        supportedMethods: ["paypal", "card"],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (paypalConfig.isEnabled && paypalConfig.secretKey) {
        const paypalGateway = new PayPalGateway(paypalConfig);
        processor.registerGateway(paypalGateway);

        const paypalMetadata: GatewayMetadata = {
          gatewayCode: "paypal",
          name: "PayPal",
          isEnabled: true,
          priority: 2,
          supportedMethods: ["paypal", "card"],
          supportedCurrencies: ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"],
          minAmount: 50,
          maxAmount: 999999999,
          transactionFeePercent: 2.9,
          fixedFeeInCents: 30,
          regions: ["US", "CA", "GB", "AU", "EU"],
          healthScore: 100,
          lastHealthCheckAt: new Date(),
          monthlyVolume: 0,
          monthlyTransactionCount: 0,
        };

        router.registerGateway(paypalGateway, paypalMetadata);
      }
    } catch (error) {
      fastify.log.warn("Failed to initialize PayPal gateway", { error });
    }

    // Register Square gateway
    try {
      const squareConfig = {
        name: "Square",
        isEnabled: process.env.SQUARE_ENABLED === "true",
        isProduction: process.env.NODE_ENV === "production",
        secretKey: process.env.SQUARE_ACCESS_TOKEN,
        webhookSecret: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
        metadata: {
          locationId: process.env.SQUARE_LOCATION_ID,
        },
        supportedMethods: ["card", "apple_pay", "google_pay"],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (squareConfig.isEnabled && squareConfig.secretKey) {
        const squareGateway = new SquareGateway(squareConfig);
        processor.registerGateway(squareGateway);

        const squareMetadata: GatewayMetadata = {
          gatewayCode: "square",
          name: "Square",
          isEnabled: true,
          priority: 1, // Default/preferred
          supportedMethods: ["card", "apple_pay", "google_pay"],
          supportedCurrencies: ["USD", "CAD", "GBP", "AUD"],
          minAmount: 1,
          maxAmount: 999999999,
          transactionFeePercent: 2.6,
          fixedFeeInCents: 0,
          regions: ["US", "CA", "GB", "AU"],
          healthScore: 100,
          lastHealthCheckAt: new Date(),
          monthlyVolume: 0,
          monthlyTransactionCount: 0,
        };

        router.registerGateway(squareGateway, squareMetadata);
      }
    } catch (error) {
      fastify.log.warn("Failed to initialize Square gateway", { error });
    }
  });

  // Maps ISO 4217 currency codes to gateway region codes for PCI DSS data-residency routing.
  // region is optional in GatewayRoutingParams; unknown currencies fall through to undefined
  // so all gateways remain candidates rather than silently mis-routing.
  const CURRENCY_REGION: Record<string, string> = {
    USD: "US",
    CAD: "CA",
    GBP: "GB",
    AUD: "AU",
    NZD: "AU",
    EUR: "EU",
    JPY: "JP",
    SGD: "SG",
    HKD: "HK",
  };

  // POST /payments — Create payment and route to optimal gateway
  fastify.post<{ Body: CreatePaymentRequest }>(
    "/",
    async (request: any, reply: FastifyReply) => {
      try {
        const {
          amount,
          currency,
          methodType,
          orderId,
          shipmentId,
          customerId,
          ...rest
        } = request.body as CreatePaymentRequest;

        // Derive region from payment currency for gateway routing.
        // request.shopRegion was undefined (never set by middleware); currency
        // is the correct signal for PCI DSS data-residency scoping.
        const region = currency
          ? CURRENCY_REGION[currency.toUpperCase()]
          : undefined;

        // Route payment to optimal gateway
        const routing = router.routePayment({
          method: methodType,
          currency,
          amount: Math.round(amount * 100), // Convert to cents
          region,
          customerId,
          metadata: rest,
        } as GatewayRoutingParams);

        fastify.log.info("Payment routed", {
          gateway: routing.primaryGateway.name,
          amount,
          method: methodType,
        });

        // Create payment intent via primary gateway
        const gateway = router.getGateway(routing.primaryGateway.gatewayCode);
        if (!gateway) {
          throw new PaymentError(
            "GATEWAY_NOT_FOUND",
            `Gateway ${routing.primaryGateway.name} not initialized`,
            500,
          );
        }

        const intent = await gateway.createPaymentIntent(
          request.shopId,
          Math.round(amount * 100),
          currency,
          customerId,
          {
            orderId,
            shipmentId,
            ...rest,
          },
        );

        // Record idempotency key
        await processor.recordIdempotency(
          intent.idempotencyKey,
          request.shopId,
          { paymentIntentId: intent.id },
        );

        return reply.send({
          success: true,
          paymentIntent: intent,
          routingDecision: {
            gateway: routing.primaryGateway.name,
            estimatedFee: routing.estimatedFee,
            fallbackGateways: [
              routing.secondaryGateway?.name,
              routing.tertiaryGateway?.name,
            ].filter(Boolean),
          },
        });
      } catch (error: any) {
        fastify.log.error("Payment creation failed", { error: error.message });

        const paymentError =
          error instanceof PaymentError
            ? error
            : new PaymentError(
                "PAYMENT_FAILED",
                error.message || "Failed to create payment",
                400,
              );

        return reply.status(paymentError.statusCode).send({
          success: false,
          error: {
            code: paymentError.code,
            message: paymentError.message,
            retryable: paymentError.retryable,
          },
        });
      }
    },
  );

  // POST /payments/capture/:id — Capture authorized payment
  fastify.post<{ Params: { id: string }; Body: CapturePaymentRequest }>(
    "/capture/:id",
    async (request: any, reply: FastifyReply) => {
      try {
        const { sourceId } = request.body as CapturePaymentRequest;
        const paymentIntentId = request.params.id;

        // For now, route based on metadata stored during creation
        // In production, look up the intent from database
        const intent = await processor.getPaymentIntent(
          paymentIntentId,
          request.shopId,
        );
        if (!intent) {
          throw new PaymentError(
            "INTENT_NOT_FOUND",
            `Payment intent not found: ${paymentIntentId}`,
            404,
          );
        }

        const gateway = router.getGateway(
          intent.providerName?.toLowerCase() || "square",
        );
        if (!gateway) {
          throw new PaymentError(
            "GATEWAY_NOT_FOUND",
            `Gateway ${intent.providerName} not initialized`,
            500,
          );
        }

        let transaction;

        // Handle Square with sourceId
        if (gateway.code === "square" && sourceId) {
          const squareGateway = gateway as SquareGateway;
          transaction = await squareGateway.captureWithSourceId(
            paymentIntentId,
            sourceId,
            intent.amount,
            intent.currency,
          );
        } else {
          transaction = await gateway.capturePayment(paymentIntentId);
        }

        // Update intent status
        await processor.updatePaymentIntentStatus(
          paymentIntentId,
          "captured",
          request.shopId,
        );

        router.recordTransaction(
          intent.providerName || "square",
          intent.amount,
        );

        return reply.send({
          success: true,
          transaction,
        });
      } catch (error: any) {
        fastify.log.error("Payment capture failed", { error: error.message });

        const paymentError =
          error instanceof PaymentError
            ? error
            : new PaymentError(
                "CAPTURE_FAILED",
                error.message || "Failed to capture payment",
                400,
              );

        router.recordFailure("square", paymentError.message);

        return reply.status(paymentError.statusCode).send({
          success: false,
          error: {
            code: paymentError.code,
            message: paymentError.message,
          },
        });
      }
    },
  );

  // POST /payments/refund/:id — Refund payment
  fastify.post<{ Params: { id: string }; Body: RefundPaymentRequest }>(
    "/refund/:id",
    async (request: any, reply: FastifyReply) => {
      try {
        const { amount, reason, description } =
          request.body as RefundPaymentRequest;
        const transactionId = request.params.id;

        // Lookup transaction to get provider
        const transaction = await processor.getTransaction(
          transactionId,
          request.shopId,
        );
        if (!transaction) {
          throw new PaymentError(
            "TRANSACTION_NOT_FOUND",
            `Transaction not found: ${transactionId}`,
            404,
          );
        }

        const gateway = router.getGateway(
          transaction.providerName?.toLowerCase() || "square",
        );
        if (!gateway) {
          throw new PaymentError(
            "GATEWAY_NOT_FOUND",
            `Gateway ${transaction.providerName} not initialized`,
            500,
          );
        }

        const refund = await gateway.refundPayment(
          transaction.providerTransactionId || transactionId,
          amount,
          reason,
        );

        refund.shopId = request.shopId;
        refund.description = description;

        // Store refund in database
        await processor.recordRefund(refund, request.shopId);

        return reply.send({
          success: true,
          refund,
        });
      } catch (error: any) {
        fastify.log.error("Refund failed", { error: error.message });

        const paymentError =
          error instanceof PaymentError
            ? error
            : new PaymentError(
                "REFUND_FAILED",
                error.message || "Failed to refund payment",
                400,
              );

        return reply.status(paymentError.statusCode).send({
          success: false,
          error: {
            code: paymentError.code,
            message: paymentError.message,
          },
        });
      }
    },
  );

  // GET /payments/:id — Get payment status
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: any, reply: FastifyReply) => {
      try {
        const transactionId = request.params.id;

        const transaction = await processor.getTransaction(
          transactionId,
          request.shopId,
        );
        if (!transaction) {
          throw new PaymentError(
            "TRANSACTION_NOT_FOUND",
            `Transaction not found: ${transactionId}`,
            404,
          );
        }

        return reply.send({
          success: true,
          transaction,
        });
      } catch (error: any) {
        fastify.log.error("Get transaction failed", { error: error.message });

        const paymentError =
          error instanceof PaymentError
            ? error
            : new PaymentError(
                "FETCH_FAILED",
                error.message || "Failed to fetch transaction",
                400,
              );

        return reply.status(paymentError.statusCode).send({
          success: false,
          error: {
            code: paymentError.code,
            message: paymentError.message,
          },
        });
      }
    },
  );

  // GET /payments/methods — Available payment methods
  fastify.get("/methods", async (request: any, reply: FastifyReply) => {
    try {
      const availableMethods = router.getAvailableMethods();

      const methodDetails = availableMethods.map((method) => ({
        method,
        gateways: router.getGatewaysForMethod(method).map((g) => ({
          name: g.name,
          code: g.gatewayCode,
          priority: g.priority,
        })),
      }));

      const fees = router.compareTransactionFees(10000); // For $100 transaction

      return reply.send({
        success: true,
        methods: methodDetails,
        estimatedFees: fees,
      });
    } catch (error: any) {
      fastify.log.error("Get methods failed", { error: error.message });

      return reply.status(500).send({
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: "Failed to fetch payment methods",
        },
      });
    }
  });

  // POST /payments/webhooks/:gateway — Webhook receiver
  fastify.post<{ Params: { gateway: string } }>(
    "/webhooks/:gateway",
    { schema: { hide: true } }, // Don't show in API docs
    async (request: any, reply: FastifyReply) => {
      try {
        const gatewayCode = request.params.gateway.toLowerCase();
        const gateway = router.getGateway(gatewayCode);

        if (!gateway) {
          fastify.log.warn(
            `Webhook received for unknown gateway: ${gatewayCode}`,
          );
          return reply.status(404).send({ success: false });
        }

        // Verify webhook signature
        const signature =
          request.headers["x-paypal-transmission-sig"] ||
          request.headers["x-square-hmac-sha256-signature"] ||
          request.headers["authorization"] ||
          "";

        const isValid = await gateway.verifyWebhookSignature(
          request.body,
          signature,
        );
        if (!isValid) {
          fastify.log.warn(
            `Webhook signature verification failed for ${gatewayCode}`,
          );
          return reply
            .status(401)
            .send({ success: false, error: "Invalid signature" });
        }

        // Parse and process webhook
        const payload = await gateway.parseWebhookPayload(request.body);

        // Record in database
        await processor.recordWebhook(payload, request.shopId);

        fastify.log.info("Webhook processed", {
          gateway: gatewayCode,
          type: payload.type,
          eventId: payload.providerEventId,
        });

        return reply.send({ success: true });
      } catch (error: any) {
        fastify.log.error("Webhook processing failed", {
          error: error.message,
        });
        return reply.status(500).send({ success: false, error: error.message });
      }
    },
  );
}
