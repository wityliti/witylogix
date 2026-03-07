/**
 * Campaigns API — Marketing campaign management
 *
 * Routes:
 *   GET    /                   List campaigns (paginated, filterable)
 *   GET    /:id                Get campaign detail with stats
 *   POST   /                   Create campaign
 *   PATCH  /:id                Update campaign (draft/scheduled only)
 *   POST   /:id/send           Trigger campaign send
 *   POST   /:id/pause          Pause sending campaign
 *   POST   /:id/resume         Resume paused campaign
 *   DELETE /:id                Delete campaign (draft only)
 *   GET    /:id/recipients     Get campaign recipients (paginated)
 *   GET    /:id/events         Get campaign events (delivered, opened, etc.)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../lib/errors.js";

// ─── SCHEMAS ────────────────────────────────────────────────

const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["EMAIL", "SMS", "WHATSAPP", "PUSH"]),
  templateId: z.string().uuid(),
  audienceFilter: z
    .object({
      recipientType: z.enum(["CUSTOMERS", "DRIVERS", "BOTH"]),
      tags: z.array(z.string()).optional(),
      createdAfter: z.string().datetime().optional(),
      createdBefore: z.string().datetime().optional(),
    })
    .optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  templateId: z.string().uuid().optional(),
  audienceFilter: z
    .object({
      recipientType: z.enum(["CUSTOMERS", "DRIVERS", "BOTH"]).optional(),
      tags: z.array(z.string()).optional(),
      createdAfter: z.string().datetime().optional(),
      createdBefore: z.string().datetime().optional(),
    })
    .optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

// ─── ROUTE PLUGIN ───────────────────────────────────────────

async function campaignsRoutes(fastify: FastifyInstance): Promise<void> {
  // Pre-handler hooks
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);
  fastify.addHook("preHandler", requireRole("ADMIN", "DISPATCHER"));

  // ── LIST CAMPAIGNS ──────────────────────────────────────────

  fastify.get(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const {
          page = 1,
          limit = 20,
          type,
          status,
          search,
        } = request.query as {
          page?: number;
          limit?: number;
          type?: string;
          status?: string;
          search?: string;
        };

        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(limit)) || 20));
        const skip = (pageNum - 1) * pageSize;

        let whereClause = "WHERE shop_id = $1::uuid";
        const params: any[] = [(request as any).shopId];
        let paramCount = 1;

        if (type) {
          paramCount++;
          whereClause += ` AND type = $${paramCount}::text`;
          params.push(type);
        }

        if (status) {
          paramCount++;
          whereClause += ` AND status = $${paramCount}::text`;
          params.push(status);
        }

        if (search) {
          paramCount++;
          whereClause += ` AND name ILIKE $${paramCount}`;
          params.push(`%${search}%`);
        }

        // Get total count
        const countResult: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM campaigns ${whereClause}`,
          ...params
        );
        const total = Number(countResult[0]?.count || 0);

        // Get paginated results
        paramCount += 2;
        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT
              id, shop_id, name, type, template_id, status,
              recipient_count, delivered_count, opened_count, clicked_count,
              audience_filter, scheduled_at, sent_at, paused_at, created_at, updated_at
            FROM campaigns
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount - 1}::int
            OFFSET $${paramCount}::int
          `,
          ...params,
          pageSize,
          skip
        );

        return {
          data: result,
          pagination: {
            page: pageNum,
            limit: pageSize,
            total,
            pages: Math.ceil(total / pageSize),
          },
        };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to list campaigns");
        return reply.code(500).send({ error: "Failed to list campaigns" });
      }
    }
  );

  // ── GET SINGLE CAMPAIGN ─────────────────────────────────────

  fastify.get(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const campaign: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT *
            FROM campaigns
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId
        );

        if (!campaign || campaign.length === 0) {
          throw new NotFoundError("Campaign", id);
        }

        // Get detailed stats
        const stats: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT
              COUNT(*) as total_events,
              SUM(CASE WHEN event_type = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
              SUM(CASE WHEN event_type = 'OPENED' THEN 1 ELSE 0 END) as opened,
              SUM(CASE WHEN event_type = 'CLICKED' THEN 1 ELSE 0 END) as clicked,
              SUM(CASE WHEN event_type = 'FAILED' THEN 1 ELSE 0 END) as failed
            FROM campaign_events
            WHERE campaign_id = $1::uuid
          `,
          id
        );

        return {
          ...campaign[0],
          stats: stats[0] || {
            total_events: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            failed: 0,
          },
        };
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to get campaign");
        return reply.code(500).send({ error: "Failed to get campaign" });
      }
    }
  );

  // ── CREATE CAMPAIGN ─────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createCampaignSchema.parse(request.body);

      // Verify template exists
      const template: any[] = await (request as any).tenantDb.$queryRawUnsafe(
        `
          SELECT id FROM message_templates
          WHERE id = $1::uuid AND shop_id = $2::uuid
        `,
        body.templateId,
        (request as any).shopId
      );

      if (!template || template.length === 0) {
        throw new ValidationError("Template not found");
      }

      const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
        `
          INSERT INTO campaigns (
            shop_id, name, type, template_id, status,
            audience_filter, scheduled_at, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `,
        (request as any).shopId,
        body.name,
        body.type,
        body.templateId,
        body.scheduledAt ? "SCHEDULED" : "DRAFT",
        body.audienceFilter ? JSON.stringify(body.audienceFilter) : null,
        body.scheduledAt || null,
        body.metadata ? JSON.stringify(body.metadata) : "{}"
      );

      return reply.code(201).send(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply
          .code(400)
          .send({ error: "Validation failed", details: error.issues });
      }
      if (error instanceof ValidationError) {
        return reply.code(400).send({ error: error.message });
      }
      fastify.log.error({ err: error }, "Failed to create campaign");
      return reply.code(500).send({ error: "Failed to create campaign" });
    }
  });

  // ── UPDATE CAMPAIGN ─────────────────────────────────────────

  fastify.patch(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateCampaignSchema.parse(request.body);

        // Check if campaign exists and is in draft/scheduled state
        const campaign: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT status FROM campaigns
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId
        );

        if (!campaign || campaign.length === 0) {
          throw new NotFoundError("Campaign", id);
        }

        if (!["DRAFT", "SCHEDULED"].includes(campaign[0].status)) {
          throw new ConflictError(
            `Cannot update campaign in '${campaign[0].status}' status`
          );
        }

        const fields: string[] = [];
        const values: any[] = [id, (request as any).shopId];
        let paramCount = 2;

        if (body.name !== undefined) {
          paramCount++;
          fields.push(`name = $${paramCount}`);
          values.push(body.name);
        }

        if (body.templateId !== undefined) {
          paramCount++;
          fields.push(`template_id = $${paramCount}`);
          values.push(body.templateId);
        }

        if (body.audienceFilter !== undefined) {
          paramCount++;
          fields.push(`audience_filter = $${paramCount}`);
          values.push(JSON.stringify(body.audienceFilter));
        }

        if (body.scheduledAt !== undefined) {
          paramCount++;
          fields.push(`scheduled_at = $${paramCount}`);
          values.push(body.scheduledAt);
        }

        if (body.metadata !== undefined) {
          paramCount++;
          fields.push(`metadata = $${paramCount}`);
          values.push(JSON.stringify(body.metadata));
        }

        if (fields.length === 0) {
          return reply.code(400).send({ error: "No fields to update" });
        }

        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            UPDATE campaigns
            SET ${fields.join(", ")}, updated_at = NOW()
            WHERE id = $1::uuid AND shop_id = $2::uuid
            RETURNING *
          `,
          ...values
        );

        return result[0];
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({ error: error.message });
        }
        if (error instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: "Validation failed", details: error.issues });
        }
        fastify.log.error({ err: error }, "Failed to update campaign");
        return reply.code(500).send({ error: "Failed to update campaign" });
      }
    }
  );

  // ── SEND CAMPAIGN ───────────────────────────────────────────

  fastify.post(
    "/:id/send",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const campaign: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id, status FROM campaigns
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId
        );

        if (!campaign || campaign.length === 0) {
          throw new NotFoundError("Campaign", id);
        }

        if (!["DRAFT", "SCHEDULED"].includes(campaign[0].status)) {
          throw new ConflictError(
            `Cannot send campaign in '${campaign[0].status}' status`
          );
        }

        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            UPDATE campaigns
            SET status = 'SENDING', sent_at = NOW(), updated_at = NOW()
            WHERE id = $1::uuid AND shop_id = $2::uuid
            RETURNING *
          `,
          id,
          (request as any).shopId
        );

        fastify.log.info(
          { campaignId: id, shopId: (request as any).shopId },
          "Campaign send triggered"
        );

        return result[0];
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to send campaign");
        return reply.code(500).send({ error: "Failed to send campaign" });
      }
    }
  );

  // ── PAUSE CAMPAIGN ──────────────────────────────────────────

  fastify.post(
    "/:id/pause",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const campaign: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id, status FROM campaigns
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId
        );

        if (!campaign || campaign.length === 0) {
          throw new NotFoundError("Campaign", id);
        }

        if (!["SENDING", "SCHEDULED"].includes(campaign[0].status)) {
          throw new ConflictError(
            `Cannot pause campaign in '${campaign[0].status}' status`
          );
        }

        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            UPDATE campaigns
            SET status = 'PAUSED', paused_at = NOW(), updated_at = NOW()
            WHERE id = $1::uuid AND shop_id = $2::uuid
            RETURNING *
          `,
          id,
          (request as any).shopId
        );

        return result[0];
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to pause campaign");
        return reply.code(500).send({ error: "Failed to pause campaign" });
      }
    }
  );

  // ── RESUME CAMPAIGN ─────────────────────────────────────────

  fastify.post(
    "/:id/resume",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const campaign: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id, status FROM campaigns
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId
        );

        if (!campaign || campaign.length === 0) {
          throw new NotFoundError("Campaign", id);
        }

        if (campaign[0].status !== "PAUSED") {
          throw new ConflictError(
            `Cannot resume campaign in '${campaign[0].status}' status`
          );
        }

        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            UPDATE campaigns
            SET status = 'SENDING', paused_at = NULL, updated_at = NOW()
            WHERE id = $1::uuid AND shop_id = $2::uuid
            RETURNING *
          `,
          id,
          (request as any).shopId
        );

        return result[0];
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to resume campaign");
        return reply.code(500).send({ error: "Failed to resume campaign" });
      }
    }
  );

  // ── DELETE CAMPAIGN ─────────────────────────────────────────

  fastify.delete(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const campaign: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id, status FROM campaigns
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId
        );

        if (!campaign || campaign.length === 0) {
          throw new NotFoundError("Campaign", id);
        }

        if (campaign[0].status !== "DRAFT") {
          throw new ConflictError(
            `Cannot delete campaign in '${campaign[0].status}' status`
          );
        }

        // Delete associated events and recipients
        await (request as any).tenantDb.$queryRawUnsafe(
          `DELETE FROM campaign_events WHERE campaign_id = $1::uuid`,
          id
        );

        await (request as any).tenantDb.$queryRawUnsafe(
          `DELETE FROM campaign_recipients WHERE campaign_id = $1::uuid`,
          id
        );

        await (request as any).tenantDb.$queryRawUnsafe(
          `
            DELETE FROM campaigns
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId
        );

        return reply.code(204).send();
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof ConflictError) {
          return reply.code(409).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to delete campaign");
        return reply.code(500).send({ error: "Failed to delete campaign" });
      }
    }
  );

  // ── GET CAMPAIGN RECIPIENTS ─────────────────────────────────

  fastify.get(
    "/:id/recipients",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { page = 1, limit = 20, status } = request.query as {
          page?: number;
          limit?: number;
          status?: string;
        };

        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(limit)) || 20));
        const skip = (pageNum - 1) * pageSize;

        let whereClause = "WHERE campaign_id = $1::uuid";
        const params: any[] = [id];
        let paramCount = 1;

        if (status) {
          paramCount++;
          whereClause += ` AND status = $${paramCount}::text`;
          params.push(status);
        }

        // Verify campaign exists
        const campaign: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id FROM campaigns
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId
        );

        if (!campaign || campaign.length === 0) {
          throw new NotFoundError("Campaign", id);
        }

        // Get total count
        const countResult: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM campaign_recipients ${whereClause}`,
          ...params
        );
        const total = Number(countResult[0]?.count || 0);

        // Get paginated results
        paramCount += 2;
        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT
              id, campaign_id, recipient_type, recipient_id, email, phone,
              status, sent_at, delivered_at, opened_at, clicked_at,
              created_at, updated_at
            FROM campaign_recipients
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount - 1}::int
            OFFSET $${paramCount}::int
          `,
          ...params,
          pageSize,
          skip
        );

        return {
          data: result,
          pagination: {
            page: pageNum,
            limit: pageSize,
            total,
            pages: Math.ceil(total / pageSize),
          },
        };
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to get campaign recipients");
        return reply
          .code(500)
          .send({ error: "Failed to get campaign recipients" });
      }
    }
  );

  // ── GET CAMPAIGN EVENTS ─────────────────────────────────────

  fastify.get(
    "/:id/events",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { page = 1, limit = 50, eventType } = request.query as {
          page?: number;
          limit?: number;
          eventType?: string;
        };

        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const pageSize = Math.min(200, Math.max(1, parseInt(String(limit)) || 50));
        const skip = (pageNum - 1) * pageSize;

        let whereClause = "WHERE campaign_id = $1::uuid";
        const params: any[] = [id];
        let paramCount = 1;

        if (eventType) {
          paramCount++;
          whereClause += ` AND event_type = $${paramCount}::text`;
          params.push(eventType);
        }

        // Verify campaign exists
        const campaign: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id FROM campaigns
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId
        );

        if (!campaign || campaign.length === 0) {
          throw new NotFoundError("Campaign", id);
        }

        // Get total count
        const countResult: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM campaign_events ${whereClause}`,
          ...params
        );
        const total = Number(countResult[0]?.count || 0);

        // Get paginated results
        paramCount += 2;
        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT
              id, campaign_id, recipient_id, event_type, event_data,
              created_at
            FROM campaign_events
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount - 1}::int
            OFFSET $${paramCount}::int
          `,
          ...params,
          pageSize,
          skip
        );

        return {
          data: result,
          pagination: {
            page: pageNum,
            limit: pageSize,
            total,
            pages: Math.ceil(total / pageSize),
          },
        };
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to get campaign events");
        return reply.code(500).send({ error: "Failed to get campaign events" });
      }
    }
  );
}

export default campaignsRoutes;
