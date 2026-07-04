/**
 * Messages API — Direct messaging and message template management
 *
 * Routes:
 *   GET    /                   List messages (paginated, filterable)
 *   GET    /:id                Get message detail
 *   POST   /                   Send single message
 *   POST   /batch              Send batch messages (max 100)
 *   GET    /templates          List message templates
 *   POST   /templates          Create template
 *   PATCH  /templates/:id      Update template
 *   DELETE /templates/:id      Delete template
 *   POST   /webhooks/:provider Webhook handler for delivery status
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

// ─── SCHEMAS ────────────────────────────────────────────────

const sendMessageSchema = z.object({
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP", "PUSH"]),
  to: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
  templateId: z.string().uuid().optional(),
  variables: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

const batchSendSchema = z.object({
  messages: z.array(sendMessageSchema).max(100),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP", "PUSH"]),
  subject: z.string().optional(),
  body: z.string().min(1),
  variables: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  subject: z.string().optional(),
  body: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

// ─── ROUTE PLUGIN ───────────────────────────────────────────

async function messagesRoutes(fastify: FastifyInstance): Promise<void> {
  // Pre-handler hooks
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST MESSAGES ───────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const {
        page = 1,
        limit = 20,
        channel,
        status,
        recipient,
      } = request.query as {
        page?: number;
        limit?: number;
        channel?: string;
        status?: string;
        recipient?: string;
      };

      const pageNum = Math.max(1, parseInt(String(page)) || 1);
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(String(limit)) || 20),
      );
      const skip = (pageNum - 1) * pageSize;

      let whereClause = "WHERE shop_id = $1::uuid";
      const params: any[] = [(request as any).shopId];
      let paramCount = 1;

      if (channel) {
        paramCount++;
        whereClause += ` AND channel = $${paramCount}::text`;
        params.push(channel);
      }

      if (status) {
        paramCount++;
        whereClause += ` AND status = $${paramCount}::text`;
        params.push(status);
      }

      if (recipient) {
        paramCount++;
        whereClause += ` AND (recipient_email ILIKE $${paramCount} OR recipient_phone ILIKE $${paramCount})`;
        params.push(`%${recipient}%`);
      }

      // Get total count
      const countResult: any[] = await (
        request as any
      ).tenantDb.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM messages ${whereClause}`,
        ...params,
      );
      const total = Number(countResult[0]?.count || 0);

      // Get paginated results
      paramCount += 2;
      const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
        `
            SELECT
              id, shop_id, channel, subject, body, status,
              recipient_email, recipient_phone, recipient_name,
              template_id, sent_at, delivered_at, opened_at, failed_at,
              created_at, updated_at
            FROM messages
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount - 1}::int
            OFFSET $${paramCount}::int
          `,
        ...params,
        pageSize,
        skip,
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
      fastify.log.error({ err: error }, "Failed to list messages");
      return reply.code(500).send({ error: "Failed to list messages" });
    }
  });

  // ── GET SINGLE MESSAGE ──────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const message: any[] = await (request as any).tenantDb.$queryRawUnsafe(
        `
            SELECT *
            FROM messages
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
        id,
        (request as any).shopId,
      );

      if (!message || message.length === 0) {
        throw new NotFoundError("Message", id);
      }

      return message[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      fastify.log.error({ err: error }, "Failed to get message");
      return reply.code(500).send({ error: "Failed to get message" });
    }
  });

  // ── SEND SINGLE MESSAGE ─────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = sendMessageSchema.parse(request.body);

      // If templateId provided, verify it exists
      if (body.templateId) {
        const template: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id FROM message_templates
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          body.templateId,
          (request as any).shopId,
        );

        if (!template || template.length === 0) {
          throw new ValidationError("Template not found");
        }
      }

      const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
        `
          INSERT INTO messages (
            shop_id, channel, subject, body, status,
            recipient_email, recipient_phone, template_id,
            variables, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `,
        (request as any).shopId,
        body.channel,
        body.subject || null,
        body.body,
        "PENDING",
        body.channel === "EMAIL" ? body.to : null,
        ["SMS", "WHATSAPP"].includes(body.channel) ? body.to : null,
        body.templateId || null,
        body.variables ? JSON.stringify(body.variables) : "{}",
        body.metadata ? JSON.stringify(body.metadata) : "{}",
      );

      fastify.log.info(
        { messageId: result[0].id, channel: body.channel },
        "Message created",
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
      fastify.log.error({ err: error }, "Failed to send message");
      return reply.code(500).send({ error: "Failed to send message" });
    }
  });

  // ── SEND BATCH MESSAGES ─────────────────────────────────────

  fastify.post(
    "/batch",
    { preHandler: requireRole("ADMIN", "DISPATCHER") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = batchSendSchema.parse(request.body);

        if (body.messages.length === 0) {
          throw new ValidationError("At least one message is required");
        }

        // Verify all templates exist
        const templateIds = body.messages
          .filter((m) => m.templateId)
          .map((m) => m.templateId!);

        if (templateIds.length > 0) {
          const templates: any[] = await (
            request as any
          ).tenantDb.$queryRawUnsafe(
            `
              SELECT id FROM message_templates
              WHERE shop_id = $1::uuid AND id = ANY($2::uuid[])
            `,
            (request as any).shopId,
            templateIds,
          );

          if (templates.length !== new Set(templateIds).size) {
            throw new ValidationError("One or more templates not found");
          }
        }

        const insertedMessages: any[] = [];

        for (const msg of body.messages) {
          const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
            `
              INSERT INTO messages (
                shop_id, channel, subject, body, status,
                recipient_email, recipient_phone, template_id,
                variables, metadata
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              RETURNING *
            `,
            (request as any).shopId,
            msg.channel,
            msg.subject || null,
            msg.body,
            "PENDING",
            msg.channel === "EMAIL" ? msg.to : null,
            ["SMS", "WHATSAPP"].includes(msg.channel) ? msg.to : null,
            msg.templateId || null,
            msg.variables ? JSON.stringify(msg.variables) : "{}",
            msg.metadata ? JSON.stringify(msg.metadata) : "{}",
          );

          insertedMessages.push(result[0]);
        }

        fastify.log.info(
          { count: insertedMessages.length },
          "Batch messages created",
        );

        return reply.code(201).send({ data: insertedMessages });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: "Validation failed", details: error.issues });
        }
        if (error instanceof ValidationError) {
          return reply.code(400).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to send batch messages");
        return reply.code(500).send({ error: "Failed to send batch messages" });
      }
    },
  );

  // ── LIST TEMPLATES ──────────────────────────────────────────

  fastify.get(
    "/templates",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const {
          page = 1,
          limit = 20,
          channel,
        } = request.query as {
          page?: number;
          limit?: number;
          channel?: string;
        };

        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const pageSize = Math.min(
          100,
          Math.max(1, parseInt(String(limit)) || 20),
        );
        const skip = (pageNum - 1) * pageSize;

        let whereClause = "WHERE shop_id = $1::uuid";
        const params: any[] = [(request as any).shopId];
        let paramCount = 1;

        if (channel) {
          paramCount++;
          whereClause += ` AND channel = $${paramCount}::text`;
          params.push(channel);
        }

        // Get total count
        const countResult: any[] = await (
          request as any
        ).tenantDb.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM message_templates ${whereClause}`,
          ...params,
        );
        const total = Number(countResult[0]?.count || 0);

        // Get paginated results
        paramCount += 2;
        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT
              id, shop_id, name, channel, subject, body, variables,
              metadata, created_at, updated_at
            FROM message_templates
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount - 1}::int
            OFFSET $${paramCount}::int
          `,
          ...params,
          pageSize,
          skip,
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
        fastify.log.error({ err: error }, "Failed to list templates");
        return reply.code(500).send({ error: "Failed to list templates" });
      }
    },
  );

  // ── CREATE TEMPLATE ─────────────────────────────────────────

  fastify.post(
    "/templates",
    { preHandler: requireRole("ADMIN") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createTemplateSchema.parse(request.body);

        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            INSERT INTO message_templates (
              shop_id, name, channel, subject, body, variables, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `,
          (request as any).shopId,
          body.name,
          body.channel,
          body.subject || null,
          body.body,
          body.variables ? JSON.stringify(body.variables) : "[]",
          body.metadata ? JSON.stringify(body.metadata) : "{}",
        );

        return reply.code(201).send(result[0]);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: "Validation failed", details: error.issues });
        }
        fastify.log.error({ err: error }, "Failed to create template");
        return reply.code(500).send({ error: "Failed to create template" });
      }
    },
  );

  // ── UPDATE TEMPLATE ─────────────────────────────────────────

  fastify.patch(
    "/templates/:id",
    { preHandler: requireRole("ADMIN") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateTemplateSchema.parse(request.body);

        // Check if template exists
        const template: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id FROM message_templates
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId,
        );

        if (!template || template.length === 0) {
          throw new NotFoundError("Template", id);
        }

        const fields: string[] = [];
        const values: any[] = [id, (request as any).shopId];
        let paramCount = 2;

        if (body.name !== undefined) {
          paramCount++;
          fields.push(`name = $${paramCount}`);
          values.push(body.name);
        }

        if (body.subject !== undefined) {
          paramCount++;
          fields.push(`subject = $${paramCount}`);
          values.push(body.subject);
        }

        if (body.body !== undefined) {
          paramCount++;
          fields.push(`body = $${paramCount}`);
          values.push(body.body);
        }

        if (body.variables !== undefined) {
          paramCount++;
          fields.push(`variables = $${paramCount}`);
          values.push(JSON.stringify(body.variables));
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
            UPDATE message_templates
            SET ${fields.join(", ")}, updated_at = NOW()
            WHERE id = $1::uuid AND shop_id = $2::uuid
            RETURNING *
          `,
          ...values,
        );

        return result[0];
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: "Validation failed", details: error.issues });
        }
        fastify.log.error({ err: error }, "Failed to update template");
        return reply.code(500).send({ error: "Failed to update template" });
      }
    },
  );

  // ── DELETE TEMPLATE ─────────────────────────────────────────

  fastify.delete(
    "/templates/:id",
    { preHandler: requireRole("ADMIN") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const template: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT id FROM message_templates
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId,
        );

        if (!template || template.length === 0) {
          throw new NotFoundError("Template", id);
        }

        await (request as any).tenantDb.$queryRawUnsafe(
          `
            DELETE FROM message_templates
            WHERE id = $1::uuid AND shop_id = $2::uuid
          `,
          id,
          (request as any).shopId,
        );

        return reply.code(204).send();
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        fastify.log.error({ err: error }, "Failed to delete template");
        return reply.code(500).send({ error: "Failed to delete template" });
      }
    },
  );

  // ── WEBHOOK HANDLER ─────────────────────────────────────────

  fastify.post(
    "/webhooks/:provider",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { provider } = request.params as { provider: string };
        const payload = request.body as any;

        fastify.log.info({ provider, payload }, "Received message webhook");

        // Provider-specific handling
        switch (provider) {
          case "whatsapp":
            await handleWhatsAppWebhook(payload, (request as any).tenantDb);
            break;
          case "email":
            await handleEmailWebhook(payload, (request as any).tenantDb);
            break;
          case "sms":
            await handleSmsWebhook(payload, (request as any).tenantDb);
            break;
          default:
            return reply.code(400).send({ error: "Unknown provider" });
        }

        return { success: true };
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to process webhook");
        return reply.code(500).send({ error: "Failed to process webhook" });
      }
    },
  );
}

// ─── WEBHOOK HANDLERS ────────────────────────────────────────

async function handleWhatsAppWebhook(
  payload: any,
  tenantDb: any,
): Promise<void> {
  // Extract message ID and status from WhatsApp payload
  const messageId = payload.message_id;
  const status = payload.status;

  if (!messageId || !status) {
    return;
  }

  const statusMap: Record<string, string> = {
    delivered: "DELIVERED",
    read: "OPENED",
    failed: "FAILED",
  };

  const dbStatus = statusMap[status] || status;

  await tenantDb.$queryRawUnsafe(
    `
      UPDATE messages
      SET status = $1::text, delivered_at = CASE WHEN $1::text = 'DELIVERED' THEN NOW() ELSE delivered_at END
      WHERE id = $2::uuid
    `,
    dbStatus,
    messageId,
  );
}

async function handleEmailWebhook(payload: any, tenantDb: any): Promise<void> {
  // Handle email delivery status (e.g., from SendGrid)
  const messageId = payload.message_id;
  const event = payload.event;

  if (!messageId || !event) {
    return;
  }

  const statusMap: Record<string, string> = {
    delivered: "DELIVERED",
    open: "OPENED",
    click: "OPENED",
    bounce: "FAILED",
    drop: "FAILED",
  };

  const dbStatus = statusMap[event];

  if (dbStatus) {
    await tenantDb.$queryRawUnsafe(
      `
        UPDATE messages
        SET status = $1::text,
            delivered_at = CASE WHEN $1::text = 'DELIVERED' THEN NOW() ELSE delivered_at END,
            opened_at = CASE WHEN $1::text = 'OPENED' THEN NOW() ELSE opened_at END
        WHERE id = $2::uuid
      `,
      dbStatus,
      messageId,
    );
  }
}

async function handleSmsWebhook(payload: any, tenantDb: any): Promise<void> {
  // Handle SMS delivery status (e.g., from Twilio)
  const messageId = payload.message_id;
  const status = payload.status;

  if (!messageId || !status) {
    return;
  }

  const statusMap: Record<string, string> = {
    delivered: "DELIVERED",
    failed: "FAILED",
    bounced: "FAILED",
  };

  const dbStatus = statusMap[status] || status;

  await tenantDb.$queryRawUnsafe(
    `
      UPDATE messages
      SET status = $1::text, delivered_at = CASE WHEN $1::text = 'DELIVERED' THEN NOW() ELSE delivered_at END
      WHERE id = $2::uuid
    `,
    dbStatus,
    messageId,
  );
}

export default messagesRoutes;
