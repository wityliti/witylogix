/**
 * Proof of Delivery (POD) API Routes — POD submission and verification
 *
 * Routes (all require AUTH):
 *   POST   /                      Submit proof of delivery
 *   GET    /:deliveryId           Get POD for a delivery
 *   GET    /order/:orderId        Get all PODs for an order
 *   PATCH  /:id/verify            Verify/approve a POD submission
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError, ConflictError } from "../lib/errors.js";

// ─── VALIDATION SCHEMAS ─────────────────────────────────────────

const podSubmissionSchema = z.object({
  deliveryId: z.string().uuid(),
  method: z.enum(["photo", "signature", "qr_scan", "barcode", "manual_confirm"]),
  photoUrl: z.string().url().optional(),
  signatureUrl: z.string().url().optional(),
  recipientName: z.string().min(1).optional(),
  notes: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const deliveryIdParamSchema = z.object({
  deliveryId: z.string().uuid(),
});

const orderIdParamSchema = z.object({
  orderId: z.string().uuid(),
});

const podIdParamSchema = z.object({
  id: z.string().uuid(),
});

const verifyPodSchema = z.object({
  verified: z.boolean(),
  rejectionReason: z.string().optional(),
  comments: z.string().optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ─── ROUTE PLUGIN ───────────────────────────────────────────────

async function proofOfDeliveryRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth and tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── SUBMIT PROOF OF DELIVERY ────────────────────────────────

  fastify.post<{ Body: typeof podSubmissionSchema._type }>(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = podSubmissionSchema.parse(request.body);

      // Verify delivery exists
      const delivery = await request.tenantDb.order.findUnique({
        where: { id: payload.deliveryId },
        select: {
          id: true,
          status: true,
          driverId: true,
          customerId: true,
          customerName: true,
        },
      });

      if (!delivery) {
        throw new NotFoundError("Delivery", payload.deliveryId);
      }

      if (!["ARRIVED", "OUT_FOR_DELIVERY"].includes(delivery.status)) {
        throw new ValidationError(
          `Cannot submit POD for delivery in status: ${delivery.status}`
        );
      }

      // Create POD record
      const pod = await request.tenantDb.proofOfDelivery.create({
        data: {
          orderId: payload.deliveryId,
          method: payload.method,
          photoUrl: payload.photoUrl,
          signatureUrl: payload.signatureUrl,
          recipientName: payload.recipientName || delivery.customerName,
          notes: payload.notes,
          latitude: payload.latitude,
          longitude: payload.longitude,
          submittedAt: new Date(),
          status: "pending",
          submittedBy: (request as any).auth?.userId,
        },
      });

      // Update order status if POD was submitted
      if (payload.method !== "manual_confirm") {
        await request.tenantDb.order.update({
          where: { id: payload.deliveryId },
          data: { status: "DELIVERED", actualDelivery: new Date() },
        });
      }

      return reply.code(201).send({
        data: {
          id: pod.id,
          deliveryId: pod.orderId,
          method: pod.method,
          status: pod.status,
          recipientName: pod.recipientName,
          submittedAt: pod.submittedAt,
          location: pod.latitude && pod.longitude ? {
            latitude: pod.latitude,
            longitude: pod.longitude,
          } : null,
        },
      });
    }
  );

  // ── GET POD FOR DELIVERY ────────────────────────────────────

  fastify.get<{ Params: { deliveryId: string } }>(
    "/:deliveryId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { deliveryId } = deliveryIdParamSchema.parse(request.params);

      const pod = await request.tenantDb.proofOfDelivery.findFirst({
        where: { orderId: deliveryId },
      });

      if (!pod) {
        throw new NotFoundError("Proof of Delivery", deliveryId);
      }

      return {
        data: {
          id: pod.id,
          deliveryId: pod.orderId,
          method: pod.method,
          photoUrl: pod.photoUrl,
          signatureUrl: pod.signatureUrl,
          recipientName: pod.recipientName,
          notes: pod.notes,
          status: pod.status,
          submittedAt: pod.submittedAt,
          verifiedAt: pod.verifiedAt,
          location: pod.latitude && pod.longitude ? {
            latitude: pod.latitude,
            longitude: pod.longitude,
          } : null,
        },
      };
    }
  );

  // ── GET ALL PODS FOR AN ORDER ───────────────────────────────

  fastify.get<{ Params: { orderId: string }; Querystring: { page: number; limit: number } }>(
    "/order/:orderId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { orderId } = orderIdParamSchema.parse(request.params);
      const query = paginationSchema.parse(request.query);

      // Verify order exists
      const order = await request.tenantDb.order.findUnique({
        where: { id: orderId },
        select: { id: true },
      });

      if (!order) {
        throw new NotFoundError("Order", orderId);
      }

      const [pods, total] = await Promise.all([
        request.tenantDb.proofOfDelivery.findMany({
          where: { orderId },
          orderBy: { submittedAt: "desc" },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        request.tenantDb.proofOfDelivery.count({ where: { orderId } }),
      ]);

      return {
        data: pods.map((pod) => ({
          id: pod.id,
          deliveryId: pod.orderId,
          method: pod.method,
          photoUrl: pod.photoUrl,
          signatureUrl: pod.signatureUrl,
          recipientName: pod.recipientName,
          notes: pod.notes,
          status: pod.status,
          submittedAt: pod.submittedAt,
          verifiedAt: pod.verifiedAt,
          location: pod.latitude && pod.longitude ? {
            latitude: pod.latitude,
            longitude: pod.longitude,
          } : null,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    }
  );

  // ── VERIFY/APPROVE POD SUBMISSION ───────────────────────────

  fastify.patch<{ Params: { id: string } }>(
    "/:id/verify",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER")(request, reply);

      const { id } = podIdParamSchema.parse(request.params);
      const payload = verifyPodSchema.parse(request.body);

      const pod = await request.tenantDb.proofOfDelivery.findUnique({
        where: { id },
      });

      if (!pod) {
        throw new NotFoundError("Proof of Delivery", id);
      }

      if (pod.status !== "pending") {
        throw new ConflictError(`POD already has status: ${pod.status}`);
      }

      const newStatus = payload.verified ? "verified" : "rejected";

      const updatedPod = await request.tenantDb.proofOfDelivery.update({
        where: { id },
        data: {
          status: newStatus,
          verifiedAt: new Date(),
          verifiedBy: (request as any).auth?.userId,
          rejectionReason: payload.rejectionReason,
          comments: payload.comments,
        },
      });

      // Update order status if POD was rejected
      if (!payload.verified) {
        await request.tenantDb.order.update({
          where: { id: pod.orderId },
          data: { status: "ARRIVED" }, // Back to arrived state
        });
      }

      return {
        data: {
          id: updatedPod.id,
          deliveryId: updatedPod.orderId,
          method: updatedPod.method,
          status: updatedPod.status,
          verifiedAt: updatedPod.verifiedAt,
          rejectionReason: updatedPod.rejectionReason,
          comments: updatedPod.comments,
        },
      };
    }
  );
}

export default proofOfDeliveryRoutes;
