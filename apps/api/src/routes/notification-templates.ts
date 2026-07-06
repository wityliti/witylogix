/**
 * Notification Templates — API endpoints
 *
 * Routes:
 *   GET    /                      List templates (paginated, filterable)
 *   GET    /:id                   Get single template
 *   POST   /                      Create template
 *   PATCH  /:id                   Update template (increments version on body/subject change)
 *   DELETE /:id                   Soft-deactivate (set isActive=false)
 *   POST   /:id/preview           Preview rendered template with sample variables
 *   POST   /:id/duplicate         Duplicate template with new slug
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from "../lib/errors.js";
import {
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  previewNotificationTemplateSchema,
  duplicateNotificationTemplateSchema,
  paginationSchema,
} from "@witylogix/validators";
import {
  renderTemplate,
  validateTemplateVariables,
} from "@witylogix/core/templates";

// ─── Zod Schemas ────────────────────────────────────────────

const listQuerySchema = paginationSchema.extend({
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP", "PUSH", "WEBHOOK"]).optional(),
  eventType: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

// ─── Route Plugin ───────────────────────────────────────────

export default async function notificationTemplateRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // All routes require authentication + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET / — List notification templates ──────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listQuerySchema.parse(request.query);
    const shopId = request.shopId;

    const where: Record<string, unknown> = { shopId };

    if (query.channel) {
      where.channel = query.channel;
    }

    if (query.eventType) {
      where.eventType = query.eventType;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [templates, total] = await Promise.all([
      request.tenantDb.notificationTemplate.findMany({
        where,
        orderBy: [
          { eventType: "asc" },
          { channel: "asc" },
          { createdAt: "desc" },
        ],
        take: query.limit,
        skip: (query.page - 1) * query.limit,
        select: {
          id: true,
          name: true,
          channel: true,
          eventType: true,
          subject: true,
          version: true,
          isActive: true,
          variables: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      request.tenantDb.notificationTemplate.count({ where }),
    ]);

    const totalPages = Math.ceil(total / query.limit);

    return {
      data: templates,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  });

  // ── GET /:id — Get single template ──────────────────────────

  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const shopId = request.shopId;

      const template = await request.tenantDb.notificationTemplate.findUnique({
        where: { id, shopId },
      });

      if (!template) {
        throw new NotFoundError("NotificationTemplate", id);
      }

      return { data: template };
    },
  );

  // ── POST / — Create notification template ──────────────────

  fastify.post<{ Body: Record<string, unknown> }>(
    "/",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createNotificationTemplateSchema.parse(request.body) as any;
      const shopId = request.shopId;

      // Validate template syntax
      const validationErrors = validateTemplateVariables(body.bodyTemplate, {});
      if (validationErrors.length > 0) {
        throw new ValidationError(
          "Template validation failed",
          validationErrors,
        );
      }

      // If subject is provided, validate it too
      if (body.subject) {
        const subjectErrors = validateTemplateVariables(body.subject, {});
        if (subjectErrors.length > 0) {
          throw new ValidationError("Subject validation failed", subjectErrors);
        }
      }

      const template = await request.tenantDb.notificationTemplate.create({
        data: {
          shopId,
          name: body.name,
          channel: body.channel as any,
          eventType: body.eventType,
          subject: body.subject || null,
          body: body.bodyTemplate,
          variables: body.variables,
          isActive: true,
          version: 1,
        },
      });

      return reply.status(201).send({ data: template });
    },
  );

  // ── PATCH /:id — Update template ─────────────────────────────

  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/:id",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = updateNotificationTemplateSchema.parse(request.body) as any;
      const shopId = request.shopId;

      // Verify template exists
      const existing = await request.tenantDb.notificationTemplate.findUnique({
        where: { id, shopId },
      });

      if (!existing) {
        throw new NotFoundError("NotificationTemplate", id);
      }

      // Validate template syntax if body is provided
      if (body.bodyTemplate) {
        const validationErrors = validateTemplateVariables(
          body.bodyTemplate,
          {},
        );
        if (validationErrors.length > 0) {
          throw new ValidationError(
            "Template validation failed",
            validationErrors,
          );
        }
      }

      // Validate subject if provided
      if (body.subject) {
        const subjectErrors = validateTemplateVariables(body.subject, {});
        if (subjectErrors.length > 0) {
          throw new ValidationError("Subject validation failed", subjectErrors);
        }
      }

      // Determine if we need to increment version
      let updateData: Record<string, unknown> = { ...body };
      const shouldIncrementVersion =
        (body.bodyTemplate && body.bodyTemplate !== existing.body) ||
        (body.subject && body.subject !== existing.subject);

      if (shouldIncrementVersion) {
        updateData.version = existing.version + 1;
      }

      // Map bodyTemplate to body for Prisma
      const prismaData: any = { ...updateData };
      if (prismaData.bodyTemplate) {
        prismaData.body = prismaData.bodyTemplate;
        delete prismaData.bodyTemplate;
      }
      delete prismaData.slug;
      delete prismaData.metadata;

      const updated = await request.tenantDb.notificationTemplate.update({
        where: { id, shopId },
        data: prismaData,
      });

      return { data: updated };
    },
  );

  // ── DELETE /:id — Soft-deactivate template ──────────────────

  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const shopId = request.shopId;

      const existing = await request.tenantDb.notificationTemplate.findUnique({
        where: { id, shopId },
      });

      if (!existing) {
        throw new NotFoundError("NotificationTemplate", id);
      }

      // Soft deactivate
      const updated = await request.tenantDb.notificationTemplate.update({
        where: { id, shopId },
        data: { isActive: false },
      });

      return { data: updated };
    },
  );

  // ── POST /:id/preview — Preview rendered template ──────────────

  fastify.post<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>(
    "/:id/preview",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = previewNotificationTemplateSchema.parse(request.body);
      const shopId = request.shopId;

      const template = await request.tenantDb.notificationTemplate.findUnique({
        where: { id, shopId },
      });

      if (!template) {
        throw new NotFoundError("NotificationTemplate", id);
      }

      // Render body template
      const previewBody = previewNotificationTemplateSchema.parse(
        request.body,
      ) as any;
      const bodyResult = renderTemplate(
        previewBody.bodyTemplate,
        previewBody.sampleVariables,
      );

      // Render subject if provided
      let subjectResult: { html: string; text: string; errors: string[] } = {
        html: "",
        text: "",
        errors: [],
      };
      if (previewBody.subject) {
        subjectResult = renderTemplate(
          previewBody.subject,
          previewBody.sampleVariables,
        );
      }

      // Combine errors
      const allErrors = [...bodyResult.errors, ...subjectResult.errors];

      return {
        data: {
          subject: {
            html: subjectResult.html,
            text: subjectResult.text,
          },
          body: {
            html: bodyResult.html,
            text: bodyResult.text,
          },
          errors: allErrors,
          hasErrors: allErrors.length > 0,
        },
      };
    },
  );

  // ── POST /:id/duplicate — Duplicate template ────────────────

  fastify.post<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>(
    "/:id/duplicate",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = duplicateNotificationTemplateSchema.parse(
        request.body,
      ) as any;
      const shopId = request.shopId;

      const existing = await request.tenantDb.notificationTemplate.findUnique({
        where: { id, shopId },
      });

      if (!existing) {
        throw new NotFoundError("NotificationTemplate", id);
      }

      // Create duplicate
      const duplicated = await request.tenantDb.notificationTemplate.create({
        data: {
          shopId,
          name: body.newName || `${existing.name} (Copy)`,
          channel: existing.channel as any,
          eventType: existing.eventType,
          subject: existing.subject,
          body: existing.body,
          variables: existing.variables as any,
          isActive: true,
          version: 1,
        },
      });

      return reply.status(201).send({ data: duplicated });
    },
  );
}
