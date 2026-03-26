/**
 * Payment Methods & Processing Routes
 *
 * Endpoints for:
 *   - List payment methods
 *   - Add new payment method
 *   - Set default payment method
 *   - Process payments (capture, refund)
 *   - COD collection recording and verification
 *   - Webhook handling from payment providers
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { NotFoundError, ValidationError, ConflictError } from '../lib/errors.js';

interface PaymentMethodQueryParams {
  page?: number;
  limit?: number;
}

interface PaymentMethodBody {
  type: string;
  displayName: string;
  lastDigits?: string;
  expiryDate?: string;
  isDefault?: boolean;
}

interface ProcessPaymentBody {
  amount: number; // In cents
  currency?: string;
  paymentMethodId?: string;
  shipmentId?: string;
  orderId?: string;
  metadata?: Record<string, any>;
  idempotencyKey: string;
}

interface InitiateRefundBody {
  amount?: number; // Partial refund in cents
  reason: 'customer_request' | 'duplicate_charge' | 'order_cancelled' | 'merchant_error' | 'other';
  description?: string;
  idempotencyKey: string;
}

interface RecordCODBody {
  shipmentId: string;
  driverId: string;
  amount: number; // In cents
  currency?: string;
  metadata?: Record<string, any>;
  idempotencyKey: string;
}

interface VerifyCODBody {
  codCollectionId: string;
}

interface WebhookBody {
  type: string;
  provider: string;
  data: any;
  signature?: string;
}

export default async function paymentMethodRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ─── PAYMENT METHODS ─────────────────────────────────────────────────

  // GET /payment-methods — List payment methods for shop
  fastify.get<{ Querystring: PaymentMethodQueryParams }>(
    '/payment-methods',
    async (request: any, reply: FastifyReply) => {
      try {
        const { page = 1, limit = 25 } = request.query;
        const skip = (page - 1) * limit;

        const [methods, total] = await Promise.all([
          request.tenantDb.paymentMethod.findMany({
            where: { shopId: request.shopId },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          }),
          request.tenantDb.paymentMethod.count({
            where: { shopId: request.shopId },
          }),
        ]);

        return reply.code(200).send({
          success: true,
          data: methods,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        throw error;
      }
    },
  );

  // GET /payment-methods/:id — Get specific payment method
  fastify.get<{ Params: { id: string } }>(
    '/payment-methods/:id',
    async (request: any, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const method = await request.tenantDb.paymentMethod.findFirst({
          where: {
            id,
            shopId: request.shopId,
          },
        });

        if (!method) {
          throw new NotFoundError(`Payment method ${id} not found`);
        }

        return reply.code(200).send({
          success: true,
          data: method,
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
    },
  );

  // POST /payment-methods — Add new payment method
  fastify.post<{ Body: PaymentMethodBody }>(
    '/payment-methods',
    async (request: any, reply: FastifyReply) => {
      try {
        const { type, displayName, lastDigits, expiryDate, isDefault } = request.body;

        // Validate type
        const validTypes = ['credit_card', 'debit_card', 'cod', 'bank_transfer', 'wallet', 'shopify_payment', 'other'];
        if (!validTypes.includes(type)) {
          throw new ValidationError(`Invalid payment method type: ${type}`);
        }

        // If setting as default, unset other defaults
        if (isDefault) {
          await request.tenantDb.paymentMethod.updateMany({
            where: { shopId: request.shopId, isDefault: true },
            data: { isDefault: false },
          });
        }

        const method = await request.tenantDb.paymentMethod.create({
          data: {
            shopId: request.shopId,
            type,
            displayName,
            lastDigits,
            expiryDate,
            isDefault: isDefault || false,
            isActive: true,
            metadata: {},
          },
        });

        return reply.code(201).send({
          success: true,
          data: method,
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
    },
  );

  // PATCH /payment-methods/:id/default — Set as default
  fastify.patch<{ Params: { id: string } }>(
    '/payment-methods/:id/default',
    async (request: any, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        // Verify method exists and belongs to shop
        const method = await request.tenantDb.paymentMethod.findFirst({
          where: { id, shopId: request.shopId },
        });

        if (!method) {
          throw new NotFoundError(`Payment method ${id} not found`);
        }

        // Unset other defaults
        await request.tenantDb.paymentMethod.updateMany({
          where: { shopId: request.shopId, isDefault: true },
          data: { isDefault: false },
        });

        // Set this as default
        const updated = await request.tenantDb.paymentMethod.update({
          where: { id },
          data: { isDefault: true },
        });

        return reply.code(200).send({
          success: true,
          data: updated,
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
    },
  );

  // DELETE /payment-methods/:id — Delete payment method
  fastify.delete<{ Params: { id: string } }>(
    '/payment-methods/:id',
    async (request: any, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const method = await request.tenantDb.paymentMethod.findFirst({
          where: { id, shopId: request.shopId },
        });

        if (!method) {
          throw new NotFoundError(`Payment method ${id} not found`);
        }

        await request.tenantDb.paymentMethod.delete({ where: { id } });

        return reply.code(204).send();
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    },
  );

  // ─── PAYMENT PROCESSING ──────────────────────────────────────────────

  // POST /payments/process — Process a payment (create intent + capture)
  fastify.post<{ Body: ProcessPaymentBody }>(
    '/payments/process',
    async (request: any, reply: FastifyReply) => {
      try {
        const { amount, currency = 'USD', paymentMethodId, shipmentId, orderId, metadata, idempotencyKey } = request.body;

        // Validate required fields
        if (!amount || amount <= 0) {
          throw new ValidationError('Amount must be greater than 0');
        }

        if (!idempotencyKey) {
          throw new ValidationError('idempotencyKey is required for idempotency');
        }

        // Check if shipment/order exists
        if (shipmentId) {
          const shipment = await request.tenantDb.shipment.findFirst({
            where: { id: shipmentId, shopId: request.shopId },
          });

          if (!shipment) {
            throw new NotFoundError(`Shipment ${shipmentId} not found`);
          }
        }

        if (orderId) {
          const order = await request.tenantDb.order.findFirst({
            where: { id: orderId, shopId: request.shopId },
          });

          if (!order) {
            throw new NotFoundError(`Order ${orderId} not found`);
          }
        }

        // Create payment transaction
        const transaction = await request.tenantDb.paymentTransaction.create({
          data: {
            shopId: request.shopId,
            orderId: orderId || null,
            shipmentId: shipmentId || null,
            paymentMethodId: paymentMethodId || null,
            amount: BigInt(amount),
            currency,
            type: 'charge',
            status: 'pending',
            metadata: metadata || {},
            idempotencyKey,
          },
          include: {
            paymentMethod: true,
          },
        });

        return reply.code(201).send({
          success: true,
          data: {
            id: transaction.id,
            amount: transaction.amount.toString(),
            currency: transaction.currency,
            status: transaction.status,
            createdAt: transaction.createdAt,
          },
        });
      } catch (error) {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
          return reply.code(error instanceof ValidationError ? 400 : 404).send({
            success: false,
            error: error.message,
          });
        }
        throw error;
      }
    },
  );

  // POST /payments/:id/refund — Initiate refund
  fastify.post<{ Params: { id: string }; Body: InitiateRefundBody }>(
    '/payments/:id/refund',
    async (request: any, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const { amount, reason, description, idempotencyKey } = request.body;

        if (!idempotencyKey) {
          throw new ValidationError('idempotencyKey is required');
        }

        // Get original transaction
        const original = await request.tenantDb.paymentTransaction.findFirst({
          where: { id, shopId: request.shopId },
        });

        if (!original) {
          throw new NotFoundError(`Payment ${id} not found`);
        }

        if (original.status !== 'completed') {
          throw new ConflictError(`Cannot refund a ${original.status} payment`);
        }

        // Create refund
        const refund = await request.tenantDb.refund.create({
          data: {
            shopId: request.shopId,
            originalTxnId: original.id,
            amount: amount ? BigInt(amount) : null,
            currency: original.currency,
            reason,
            description,
            status: 'processing',
            metadata: {},
          },
        });

        // Create refund transaction
        const refundTxn = await request.tenantDb.paymentTransaction.create({
          data: {
            shopId: request.shopId,
            orderId: original.orderId,
            shipmentId: original.shipmentId,
            amount: amount ? BigInt(amount) : original.amount,
            currency: original.currency,
            type: 'refund',
            status: 'processing',
            refundOf: original.id,
            paymentMethodId: original.paymentMethodId,
            metadata: { refundId: refund.id, reason },
            idempotencyKey,
          },
        });

        return reply.code(201).send({
          success: true,
          data: {
            id: refundTxn.id,
            refundId: refund.id,
            amount: refundTxn.amount.toString(),
            status: refundTxn.status,
            createdAt: refundTxn.createdAt,
          },
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          return reply.code(400).send({ success: false, error: error.message });
        }
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ success: false, error: error.message });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({ success: false, error: error.message });
        }
        throw error;
      }
    },
  );

  // ─── COD (CASH ON DELIVERY) ──────────────────────────────────────────

  // POST /cod-collection — Record COD collection from driver
  fastify.post<{ Body: RecordCODBody }>(
    '/cod-collection',
    async (request: any, reply: FastifyReply) => {
      try {
        const { shipmentId, driverId, amount, currency = 'USD', metadata, idempotencyKey } = request.body;

        if (!idempotencyKey) {
          throw new ValidationError('idempotencyKey is required');
        }

        // Verify shipment exists
        const shipment = await request.tenantDb.shipment.findFirst({
          where: { id: shipmentId, shopId: request.shopId },
        });

        if (!shipment) {
          throw new NotFoundError(`Shipment ${shipmentId} not found`);
        }

        // Verify driver exists
        const driver = await request.tenantDb.driver.findFirst({
          where: { id: driverId },
        });

        if (!driver) {
          throw new NotFoundError(`Driver ${driverId} not found`);
        }

        // Create COD collection
        const codCollection = await request.tenantDb.cODCollection.create({
          data: {
            shopId: request.shopId,
            shipmentId,
            driverId,
            amount: BigInt(amount),
            currency,
            status: 'collected',
            collectedAt: new Date(),
            metadata: metadata || {},
          },
        });

        // Create payment transaction for tracking
        const transaction = await request.tenantDb.paymentTransaction.create({
          data: {
            shopId: request.shopId,
            shipmentId,
            amount: BigInt(amount),
            currency,
            type: 'cod_collection',
            status: 'completed',
            providerName: 'cod',
            metadata: { codCollectionId: codCollection.id },
            idempotencyKey,
            completedAt: new Date(),
          },
        });

        return reply.code(201).send({
          success: true,
          data: {
            id: codCollection.id,
            transactionId: transaction.id,
            amount: amount.toString(),
            status: 'collected',
            collectedAt: codCollection.collectedAt,
          },
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          return reply.code(400).send({ success: false, error: error.message });
        }
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ success: false, error: error.message });
        }
        throw error;
      }
    },
  );

  // PATCH /cod-collection/:id/verify — Verify COD collection
  fastify.patch<{ Params: { id: string }; Body: VerifyCODBody }>(
    '/cod-collection/:id/verify',
    async (request: any, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const codCollection = await request.tenantDb.cODCollection.findFirst({
          where: { id, shopId: request.shopId },
        });

        if (!codCollection) {
          throw new NotFoundError(`COD collection ${id} not found`);
        }

        if (codCollection.status !== 'collected') {
          throw new ConflictError(`Cannot verify ${codCollection.status} collection`);
        }

        const verified = await request.tenantDb.cODCollection.update({
          where: { id },
          data: {
            status: 'verified',
            verifiedAt: new Date(),
          },
        });

        return reply.code(200).send({
          success: true,
          data: verified,
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ success: false, error: error.message });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({ success: false, error: error.message });
        }
        throw error;
      }
    },
  );

  // ─── WEBHOOKS ─────────────────────────────────────────────────────────

  // POST /webhooks/payments — Handle payment provider webhooks
  fastify.post<{ Body: WebhookBody }>(
    '/webhooks/payments',
    async (request: any, reply: FastifyReply) => {
      try {
        const { type, provider, data, signature } = request.body;

        fastify.log.info(`Processing webhook: ${type} from ${provider}`);

        // Verify signature if provided
        if (signature) {
          // In production, verify HMAC signature based on provider
          // For now, accept all webhooks (COD doesn't use webhooks anyway)
        }

        // Handle based on provider
        switch (provider.toLowerCase()) {
          case 'cod':
            // COD doesn't have webhooks
            throw new ValidationError('COD does not support webhooks');

          case 'stripe':
            // Future: Handle Stripe webhooks
            // - payment_intent.succeeded
            // - payment_intent.payment_failed
            // - charge.refunded
            break;

          case 'paypal':
            // Future: Handle PayPal webhooks
            break;

          default:
            throw new ValidationError(`Unknown payment provider: ${provider}`);
        }

        return reply.code(200).send({
          success: true,
          received: true,
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Webhook processing error');

        if (error instanceof ValidationError) {
          return reply.code(400).send({
            success: false,
            error: error.message,
          });
        }

        // Log webhook error but return 200 to prevent retries
        return reply.code(200).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );
}
