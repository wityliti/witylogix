/**
 * Delivery OTP API — one-time password confirmation for high-value deliveries
 *
 * POST /api/v4/deliveries/otp/send    — generate + send OTP to customer (driver calls this)
 * POST /api/v4/deliveries/otp/verify  — verify OTP code (driver submits what customer says)
 *
 * WIT-92: OTP confirmation gate. When Order.requireOTPConfirmation is true,
 * the complete-delivery workflow step returns 403 until an OTP is verified.
 * OTPs expire after 10 minutes and lock after 5 failed attempts.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { createHmac, randomInt } from "crypto";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

// ── Zod schemas ────────────────────────────────────────────────────────────────

const sendOTPBody = z.object({
  orderId: z.string().uuid(),
});

const verifyOTPBody = z.object({
  orderId: z.string().uuid(),
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Generate a 6-digit numeric OTP and return plain + hashed versions. */
function generateOTP(): { plain: string; hashed: string } {
  const plain = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const hashed = createHmac(
    "sha256",
    process.env.OTP_SECRET ?? "witylogix-otp-secret",
  )
    .update(plain)
    .digest("hex");
  return { plain, hashed };
}

function hashOTP(code: string): string {
  return createHmac("sha256", process.env.OTP_SECRET ?? "witylogix-otp-secret")
    .update(code)
    .digest("hex");
}

// ── Route plugin ───────────────────────────────────────────────────────────────

async function deliveryOTPRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  /**
   * POST /otp/send
   * Driver triggers this when arriving at the customer's address.
   * Creates (or replaces) an active OTP for the order and would push it via
   * notification service. For now the plain code is returned in the response
   * so the driver can relay it verbally as a fallback.
   */
  fastify.post(
    "/otp/send",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = sendOTPBody.parse(request.body);
      const shopId: string = (request as any).shopId;
      const userId: string = (request as any).auth?.userId;
      const db: any = (request as any).tenantDb;

      const order = await db.order.findFirst({
        where: { id: body.orderId, shopId },
        select: {
          id: true,
          requireOTPConfirmation: true,
          customerPhone: true,
          customerEmail: true,
        },
      });

      if (!order) {
        reply.status(404);
        return {
          data: null,
          error: { code: "NOT_FOUND", message: "Order not found" },
        };
      }

      if (!order.requireOTPConfirmation) {
        reply.status(422);
        return {
          data: null,
          error: {
            code: "OTP_NOT_REQUIRED",
            message: "This order does not require OTP confirmation",
          },
        };
      }

      const { plain, hashed } = generateOTP();
      const expiresAt = new Date(Date.now() + OTP_TTL_MS);

      // Invalidate any previous OTPs for this order before creating a new one
      await db.deliveryOTP.updateMany({
        where: { orderId: body.orderId, verified: false },
        data: { expiresAt: new Date(0) }, // expire immediately
      });

      const otp = await db.deliveryOTP.create({
        data: {
          orderId: body.orderId,
          shopId,
          code: hashed,
          expiresAt,
          verified: false,
          attempts: 0,
        },
        select: { id: true, expiresAt: true },
      });

      await db.deliveryAuditLog.create({
        data: {
          orderId: body.orderId,
          shopId,
          action: "otp_sent",
          actorId: userId,
          metadata: {
            otpId: otp.id,
            channel: order.customerPhone ? "sms" : "email",
          },
        },
      });

      // TODO: integrate with notification service to send SMS/email to customer
      // For now, return plain code so driver can relay verbally if needed
      return reply.send({
        data: {
          otpId: otp.id,
          code: plain, // remove once SMS integration is wired
          expiresAt: otp.expiresAt,
        },
      });
    },
  );

  /**
   * POST /otp/verify
   * Driver submits the code that the customer read out.
   * Marks OTP as verified on success; increments attempt counter on failure.
   * Locks after MAX_ATTEMPTS failed attempts.
   */
  fastify.post(
    "/otp/verify",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = verifyOTPBody.parse(request.body);
      const shopId: string = (request as any).shopId;
      const userId: string = (request as any).auth?.userId;
      const db: any = (request as any).tenantDb;

      const otp = await db.deliveryOTP.findFirst({
        where: { orderId: body.orderId, shopId },
        orderBy: { createdAt: "desc" },
      });

      if (!otp) {
        reply.status(404);
        return {
          data: null,
          error: {
            code: "OTP_NOT_FOUND",
            message: "No OTP found for this order. Use POST /otp/send first.",
          },
        };
      }

      if (otp.verified) {
        return reply.send({
          data: { verified: true, message: "OTP already verified" },
        });
      }

      if (new Date() > otp.expiresAt) {
        reply.status(410);
        return {
          data: null,
          error: {
            code: "OTP_EXPIRED",
            message:
              "OTP has expired. Use POST /otp/send to generate a new one.",
          },
        };
      }

      if (otp.attempts >= MAX_ATTEMPTS) {
        reply.status(429);
        return {
          data: null,
          error: {
            code: "OTP_LOCKED",
            message:
              "Too many failed attempts. Use POST /otp/send to generate a new OTP.",
          },
        };
      }

      const hashed = hashOTP(body.code);
      const match = hashed === otp.code;

      if (!match) {
        await db.deliveryOTP.update({
          where: { id: otp.id },
          data: { attempts: { increment: 1 } },
        });

        await db.deliveryAuditLog.create({
          data: {
            orderId: body.orderId,
            shopId,
            action: "otp_failed",
            actorId: userId,
            metadata: { otpId: otp.id, attemptsAfter: otp.attempts + 1 },
          },
        });

        reply.status(422);
        return {
          data: null,
          error: {
            code: "OTP_INVALID",
            message: `Incorrect code. ${MAX_ATTEMPTS - otp.attempts - 1} attempt(s) remaining.`,
          },
        };
      }

      await db.deliveryOTP.update({
        where: { id: otp.id },
        data: { verified: true, verifiedAt: new Date() },
      });

      await db.deliveryAuditLog.create({
        data: {
          orderId: body.orderId,
          shopId,
          action: "otp_verified",
          actorId: userId,
          metadata: { otpId: otp.id },
        },
      });

      return reply.send({ data: { verified: true } });
    },
  );
}

export default deliveryOTPRoutes;
