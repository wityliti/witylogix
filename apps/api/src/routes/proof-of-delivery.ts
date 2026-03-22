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
          photoUrls: payload.photoUrl ? [payload.photoUrl] : [],
          signatureUrl: payload.signatureUrl,
          recipientName: payload.recipientName || delivery.customerName,
          notes: payload.notes,
          deliveryLocation: payload.latitude && payload.longitude ? {
            latitude: payload.latitude,
            longitude: payload.longitude,
          } : undefined,
        } as any,
      });

      // Update order status if POD was submitted
      if (payload.method !== "manual_confirm") {
        await request.tenantDb.order.update({
          where: { id: payload.deliveryId },
          data: { status: "DELIVERED", actualDelivery: new Date() },
        });
      }

      const deliveryLocation = (pod.deliveryLocation as any) || {};
      return reply.code(201).send({
        data: {
          id: pod.id,
          deliveryId: pod.orderId,
          method: payload.method,
          status: "pending",
          recipientName: pod.recipientName,
          submittedAt: pod.createdAt,
          location: deliveryLocation.latitude && deliveryLocation.longitude ? {
            latitude: deliveryLocation.latitude,
            longitude: deliveryLocation.longitude,
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

      const deliveryLocation = (pod.deliveryLocation as any) || {};
      return {
        data: {
          id: pod.id,
          deliveryId: pod.orderId,
          method: (pod as any).method,
          photoUrl: pod.photoUrls?.[0],
          signatureUrl: pod.signatureUrl,
          recipientName: pod.recipientName,
          notes: pod.notes,
          status: (pod as any).status,
          submittedAt: (pod as any).submittedAt,
          verifiedAt: (pod as any).verifiedAt,
          location: deliveryLocation.latitude && deliveryLocation.longitude ? {
            latitude: deliveryLocation.latitude,
            longitude: deliveryLocation.longitude,
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
          orderBy: { createdAt: "desc" },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        request.tenantDb.proofOfDelivery.count({ where: { orderId } }),
      ]);

      return {
        data: pods.map((pod) => {
          const deliveryLocation = (pod.deliveryLocation as any) || {};
          return {
            id: pod.id,
            deliveryId: pod.orderId,
            method: (pod as any).method,
            photoUrl: pod.photoUrls?.[0],
            signatureUrl: pod.signatureUrl,
            recipientName: pod.recipientName,
            notes: pod.notes,
            status: (pod as any).status,
            submittedAt: (pod as any).submittedAt,
            verifiedAt: (pod as any).verifiedAt,
            location: deliveryLocation.latitude && deliveryLocation.longitude ? {
              latitude: deliveryLocation.latitude,
              longitude: deliveryLocation.longitude,
            } : null,
          };
        }),
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
      await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

      const { id } = podIdParamSchema.parse(request.params);
      const payload = verifyPodSchema.parse(request.body);

      const pod = await request.tenantDb.proofOfDelivery.findUnique({
        where: { id },
      });

      if (!pod) {
        throw new NotFoundError("Proof of Delivery", id);
      }

      if ((pod as any).status !== "pending") {
        throw new ConflictError(`POD already has status: ${(pod as any).status}`);
      }

      const newStatus = payload.verified ? "verified" : "rejected";

      const updatedPod = await request.tenantDb.proofOfDelivery.update({
        where: { id },
        data: {
          notes: payload.rejectionReason || pod.notes,
        } as any,
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
          method: (updatedPod as any).method,
          status: newStatus,
          verifiedAt: new Date(),
          rejectionReason: payload.rejectionReason,
          comments: payload.comments,
        },
      };
    }
  );
}

export default proofOfDeliveryRoutes;
