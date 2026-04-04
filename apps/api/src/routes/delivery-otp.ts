// @ts-nocheck
/**
 * Delivery OTP Routes — WIT-92
 *
 * OTP confirmation step for high-value and regulated parcel deliveries.
 *
 * Routes:
 *   POST /api/v4/deliveries/:orderId/otp/send               — Dispatch OTP to recipient
 *   POST /api/v4/deliveries/:orderId/otp/verify             — Driver submits OTP code
 *   POST /api/v4/deliveries/:orderId/otp/supervisor-override — Supervisor bypass with audit log
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  RateLimitError,
} from '../lib/errors.js';
import { generateDeliveryOTP, verifyDeliveryOTP, maskPhone } from '../services/delivery-otp.js';

// ─── Schemas ────────────────────────────────────────────────

const orderIdParamSchema = z.object({
  orderId: z.string().uuid(),
});

const sendOTPBodySchema = z.object({
  channel: z.enum(['sms', 'whatsapp']).default('sms'),
});

const verifyOTPBodySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
});

const supervisorOverrideBodySchema = z.object({
  reason: z.string().min(1, 'Override reason is required'),
});

// Roles that may perform a supervisor OTP override
const OVERRIDE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'DISPATCHER'] as const;

// ─── Route Plugin ────────────────────────────────────────────

async function deliveryOTPRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── POST /:orderId/otp/send ──────────────────────────────

  fastify.post<{
    Params: { orderId: string };
    Body: z.infer<typeof sendOTPBodySchema>;
  }>(
    '/:orderId/otp/send',
    async (
      request: FastifyRequest<{
        Params: { orderId: string };
        Body: z.infer<typeof sendOTPBodySchema>;
      }>,
      reply: FastifyReply,
    ) => {
      const { orderId } = orderIdParamSchema.parse(request.params);
      const { channel } = sendOTPBodySchema.parse(request.body);
      const tenantDb = request.tenantDb;

      const order = await tenantDb.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          requireOTPConfirmation: true,
          customerPhone: true,
        },
      });

      if (!order) {
        throw new NotFoundError('Order', orderId);
      }

      if (!order.customerPhone) {
        throw new BadRequestError('No phone number on file for this order');
      }

      // Reject if a valid unexpired OTP already exists
      const existing = await tenantDb.deliveryOTP.findFirst({
        where: {
          orderId,
          verified: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (existing) {
        throw new ConflictError('OTP already sent and still valid');
      }

      const otpData = await generateDeliveryOTP({
        orderId,
        recipientPhone: order.customerPhone,
        channel,
      });

      await tenantDb.deliveryOTP.create({
        data: {
          orderId: otpData.orderId,
          code: otpData.code,
          channel: otpData.channel,
          recipientPhone: otpData.recipientPhone,
          expiresAt: otpData.expiresAt,
        },
      });

      reply.status(200);
      return {
        success: true,
        data: {
          channel,
          maskedPhone: maskPhone(order.customerPhone),
        },
      };
    },
  );

  // ── POST /:orderId/otp/verify ────────────────────────────

  fastify.post<{
    Params: { orderId: string };
    Body: z.infer<typeof verifyOTPBodySchema>;
  }>(
    '/:orderId/otp/verify',
    async (
      request: FastifyRequest<{
        Params: { orderId: string };
        Body: z.infer<typeof verifyOTPBodySchema>;
      }>,
      reply: FastifyReply,
    ) => {
      const { orderId } = orderIdParamSchema.parse(request.params);
      const { code } = verifyOTPBodySchema.parse(request.body);
      const tenantDb = request.tenantDb;

      const otpRecord = await tenantDb.deliveryOTP.findFirst({
        where: { orderId },
        orderBy: { createdAt: 'desc' },
      });

      if (!otpRecord) {
        throw new NotFoundError('No OTP found for this order');
      }

      const result = verifyDeliveryOTP(otpRecord, code);

      // Always persist the new attempt count
      await tenantDb.deliveryOTP.update({
        where: { id: otpRecord.id },
        data: {
          attempts: result.attempts,
          ...(result.valid ? { verified: true, verifiedAt: new Date() } : {}),
        },
      });

      if (!result.valid) {
        if (result.reason?.match(/too many/i)) {
          throw new RateLimitError('Too many OTP attempts. Request a new OTP.');
        }
        const attemptsRemaining = Math.max(0, 5 - result.attempts);
        reply.status(422);
        return { error: result.reason, attemptsRemaining };
      }

      reply.status(200);
      return { success: true, data: { verified: true } };
    },
  );

  // ── POST /:orderId/otp/supervisor-override ───────────────

  fastify.post<{
    Params: { orderId: string };
    Body: z.infer<typeof supervisorOverrideBodySchema>;
  }>(
    '/:orderId/otp/supervisor-override',
    async (
      request: FastifyRequest<{
        Params: { orderId: string };
        Body: z.infer<typeof supervisorOverrideBodySchema>;
      }>,
      reply: FastifyReply,
    ) => {
      const { orderId } = orderIdParamSchema.parse(request.params);
      const { reason } = supervisorOverrideBodySchema.parse(request.body);
      const tenantDb = request.tenantDb;
      const actorId = request.auth.userId ?? request.auth.driverId ?? 'unknown';
      const actorRole = request.auth.role;

      if (!OVERRIDE_ROLES.includes(actorRole as any)) {
        throw new ForbiddenError('Insufficient role to perform supervisor OTP override');
      }

      const order = await tenantDb.order.findUnique({
        where: { id: orderId },
        select: { id: true },
      });

      if (!order) {
        throw new NotFoundError('Order', orderId);
      }

      await tenantDb.deliveryAuditLog.create({
        data: {
          orderId,
          action: 'OTP_SUPERVISOR_OVERRIDE',
          actorId,
          actorRole,
          metadata: { orderId, reason },
        },
      });

      reply.status(200);
      return { success: true };
    },
  );
}

export default deliveryOTPRoutes;
