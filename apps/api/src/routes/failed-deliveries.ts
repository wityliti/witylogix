/**
 * Failed Deliveries API — dispatcher dashboard endpoints
 *
 * GET  /api/v4/failed-deliveries           — list FAILED/FAILED_ATTEMPT shipments
 * GET  /api/v4/failed-deliveries/:id/attempts — attempt history for a shipment
 * POST /api/v4/failed-deliveries/:id/reassign — reassign to another driver
 * POST /api/v4/failed-deliveries/:id/return   — manually trigger auto-return
 *
 * WIT-141: Failed delivery workflow.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { getFailedDeliveryQueue } from "../lib/queue.js";

const reassignSchema = z.object({
  driverId: z.string().uuid(),
});

async function failedDeliveriesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  /** GET / — list shipments in FAILED or FAILED_ATTEMPT status */
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId: string = (request as any).shopId;
    const db: any = (request as any).tenantDb;
    const query = request.query as any;

    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "25", 10)));
    const skip = (page - 1) * limit;

    const statusFilter =
      query.status === "failed"
        ? ["FAILED"]
        : query.status === "failed_attempt"
          ? ["FAILED_ATTEMPT"]
          : ["FAILED", "FAILED_ATTEMPT"];

    const [shipments, total] = await Promise.all([
      db.shipment.findMany({
        where: { shopId, status: { in: statusFilter } },
        select: {
          id: true,
          shipmentNumber: true,
          status: true,
          attemptCount: true,
          lastFailureReason: true,
          recipientName: true,
          addressLine1: true,
          city: true,
          driverId: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      db.shipment.count({
        where: { shopId, status: { in: statusFilter } },
      }),
    ]);

    return reply.send({
      data: shipments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });

  /** GET /:shipmentId/attempts — attempt history */
  fastify.get(
    "/:shipmentId/attempts",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId: string = (request as any).shopId;
      const db: any = (request as any).tenantDb;
      const { shipmentId } = request.params as { shipmentId: string };

      const shipment = await db.shipment.findFirst({
        where: { id: shipmentId, shopId },
        select: {
          id: true,
          shipmentNumber: true,
          status: true,
          attemptCount: true,
        },
      });

      if (!shipment) {
        return reply.status(404).send({ error: "Shipment not found" });
      }

      const attempts = await db.deliveryAttempt.findMany({
        where: { shipmentId, shopId },
        orderBy: { attemptNumber: "asc" },
      });

      return reply.send({ shipment, attempts });
    },
  );

  /** POST /:shipmentId/reassign — assign to a different driver for retry */
  fastify.post(
    "/:shipmentId/reassign",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId: string = (request as any).shopId;
      const db: any = (request as any).tenantDb;
      const { shipmentId } = request.params as { shipmentId: string };

      const parsed = reassignSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: "Validation error", details: parsed.error.flatten() });
      }

      const shipment = await db.shipment.findFirst({
        where: { id: shipmentId, shopId },
        select: { id: true, status: true },
      });

      if (!shipment) {
        return reply.status(404).send({ error: "Shipment not found" });
      }

      if (shipment.status !== "FAILED_ATTEMPT") {
        return reply.status(409).send({
          error: `Cannot reassign shipment in status ${shipment.status}; only FAILED_ATTEMPT shipments can be reassigned`,
        });
      }

      const driver = await db.driver.findFirst({
        where: { id: parsed.data.driverId, shopId },
        select: { id: true },
      });

      if (!driver) {
        return reply.status(404).send({ error: "Driver not found" });
      }

      const updated = await db.shipment.update({
        where: { id: shipmentId },
        data: {
          driverId: parsed.data.driverId,
          status: "OUT_FOR_DELIVERY",
        },
        select: {
          id: true,
          shipmentNumber: true,
          status: true,
          driverId: true,
        },
      });

      return reply.send({ shipment: updated });
    },
  );

  /** POST /:shipmentId/return — manually trigger return for FAILED shipments */
  fastify.post(
    "/:shipmentId/return",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId: string = (request as any).shopId;
      const db: any = (request as any).tenantDb;
      const { shipmentId } = request.params as { shipmentId: string };

      const shipment = await db.shipment.findFirst({
        where: { id: shipmentId, shopId },
        select: { id: true, status: true, attemptCount: true },
      });

      if (!shipment) {
        return reply.status(404).send({ error: "Shipment not found" });
      }

      if (shipment.status !== "FAILED") {
        return reply.status(409).send({
          error: `Cannot return shipment in status ${shipment.status}; only FAILED shipments can be returned`,
        });
      }

      await getFailedDeliveryQueue().add(
        "auto-return",
        { shopId, shipmentId, attemptCount: shipment.attemptCount },
        { jobId: `auto-return:${shipmentId}`, delay: 0 },
      );

      return reply.status(202).send({ queued: true, shipmentId });
    },
  );
}

export default failedDeliveriesRoutes;
