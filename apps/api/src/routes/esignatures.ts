/**
 * E-Signatures API — Envelopes, signing templates, and analytics.
 *
 *   GET /envelopes               List signing envelopes (backed by ActivityLog entity_type=envelope)
 *   GET /envelopes/:id           Get single envelope
 *   GET /signing-templates       Signing templates (backed by NotificationTemplate)
 *   GET /esig/analytics          Aggregate e-sig metrics
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireAuth } from "../middleware/auth.js";

async function esignaturesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);

  // ── ENVELOPES LIST ──────────────────────────────────────────────────

  fastify.get("/envelopes", async (request: FastifyRequest) => {
    const shopId = request.shopId;
    const { page = "1", limit = "25" } = request.query as Record<string, string>;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const where = { shopId, entityType: "envelope" };

    const [rows, total] = await Promise.all([
      request.tenantDb.activityLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: (p - 1) * l,
        take: l,
      }),
      request.tenantDb.activityLog.count({ where }),
    ]);

    const data = rows.map((row) => ({
      id: row.id,
      name: `Envelope ${row.entityId.slice(0, 8)}`,
      status: (row.action ?? "draft").toLowerCase(),
      sender: { id: row.actorId ?? "", name: row.actorType ?? "system", email: "" },
      recipients: [],
      documentCount: 1,
      createdDate: row.timestamp,
      sentDate: row.timestamp,
      completedDate: row.action === "COMPLETED" ? row.timestamp : null,
      completionRate: row.action === "COMPLETED" ? 100 : 0,
    }));

    return {
      data,
      pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) },
    };
  });

  // ── ENVELOPE DETAIL ─────────────────────────────────────────────────

  fastify.get("/envelopes/:id", async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const shopId = request.shopId;

    const row = await request.tenantDb.activityLog.findFirst({
      where: { id, shopId, entityType: "envelope" },
    });
    if (!row) {
      throw fastify.httpErrors.notFound("Envelope not found");
    }
    return {
      data: {
        id: row.id,
        name: `Envelope ${row.entityId.slice(0, 8)}`,
        status: (row.action ?? "draft").toLowerCase(),
        sender: { id: row.actorId ?? "", name: row.actorType ?? "system", email: "" },
        recipients: [],
        documentCount: 1,
        createdDate: row.timestamp,
        completionRate: row.action === "COMPLETED" ? 100 : 0,
      },
    };
  });

  // ── SIGNING TEMPLATES ────────────────────────────────────────────────

  fastify.get("/signing-templates", async (request: FastifyRequest) => {
    const shopId = request.shopId;

    const templates = await request.tenantDb.notificationTemplate.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const data = templates.map((t) => ({
      id: t.id,
      name: t.name,
      category: "CUSTOM" as const,
      description: "",
      version: 1,
      documentCount: 1,
      signatureFields: 1,
      usageCount: 0,
      createdDate: t.createdAt,
      updatedDate: t.updatedAt,
      isActive: true,
    }));

    return {
      data,
      pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
    };
  });

  // ── ANALYTICS ───────────────────────────────────────────────────────

  fastify.get("/esig/analytics", async (request: FastifyRequest) => {
    const shopId = request.shopId;

    const [totalEnvelopes, completedEnvelopes, pendingEnvelopes, declinedEnvelopes, templateCount] =
      await Promise.all([
        request.tenantDb.activityLog.count({ where: { shopId, entityType: "envelope" } }),
        request.tenantDb.activityLog.count({ where: { shopId, entityType: "envelope", action: "COMPLETED" } }),
        request.tenantDb.activityLog.count({ where: { shopId, entityType: "envelope", action: "SENT" } }),
        request.tenantDb.activityLog.count({ where: { shopId, entityType: "envelope", action: "DECLINED" } }),
        request.tenantDb.notificationTemplate.count({ where: { shopId } }),
      ]);

    const completionRate = totalEnvelopes > 0
      ? Math.round((completedEnvelopes / totalEnvelopes) * 100)
      : 0;
    const declineRate = totalEnvelopes > 0
      ? Math.round((declinedEnvelopes / totalEnvelopes) * 100)
      : 0;

    return {
      data: {
        totalEnvelopes,
        completedEnvelopes,
        pendingEnvelopes,
        declinedEnvelopes,
        completionRate,
        declineRate,
        avgCompletionTime: 0,
        avgSignersPerEnvelope: 0,
        activeTemplates: templateCount,
      },
    };
  });
}

export default esignaturesRoutes;
