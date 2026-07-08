import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import { NotFoundError, ValidationError } from "../lib/errors.js";

// Activity log schemas (temporary local definitions until validators export is fixed)
const createActivityLogSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid(),
  action: z.string().min(1).max(100),
  actorType: z.enum(["USER", "SYSTEM", "WEBHOOK", "API", "CRON"]),
  actorId: z.string().uuid().optional(),
  changes: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
  ipAddress: z.string().ip().optional(),
  shipmentId: z.string().uuid().optional(),
});

const activityLogFilterSchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  action: z.string().optional(),
  actorType: z.string().optional(),
  actorId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

type CreateActivityLog = z.infer<typeof createActivityLogSchema>;
type ActivityLogFilter = z.infer<typeof activityLogFilterSchema>;

export default async function activityLogRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // GET / — List activity logs (paginated)
  fastify.get<{ Querystring: ActivityLogFilter }>(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsedQuery = activityLogFilterSchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw new ValidationError(
          "Invalid query parameters",
          parsedQuery.error.errors,
        );
      }

      const {
        entityType,
        entityId,
        action,
        actorType,
        actorId,
        dateFrom,
        dateTo,
        page,
        limit,
      } = parsedQuery.data;

      const skip = (page - 1) * limit;

      const whereClause: Record<string, unknown> = {
        shopId: request.shopId,
      };

      if (entityType) whereClause.entityType = entityType;
      if (entityId) whereClause.entityId = entityId;
      if (action) whereClause.action = action;
      if (actorType) whereClause.actorType = actorType;
      if (actorId) whereClause.actorId = actorId;

      if (dateFrom || dateTo) {
        whereClause.timestamp = {};
        if (dateFrom) {
          (whereClause.timestamp as Record<string, unknown>).gte = new Date(
            dateFrom,
          );
        }
        if (dateTo) {
          (whereClause.timestamp as Record<string, unknown>).lte = new Date(
            dateTo,
          );
        }
      }

      const [logs, total] = await Promise.all([
        request.tenantDb.activityLog.findMany({
          where: whereClause as any,
          orderBy: { timestamp: "desc" },
          skip,
          take: limit,
        }),
        request.tenantDb.activityLog.count({
          where: whereClause as any,
        }),
      ]);

      return reply.send({
        data: logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    },
  );

  // GET /:id — Get single log entry
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const log = await request.tenantDb.activityLog.findFirst({
        where: { id, shopId: request.shopId },
      });

      if (!log) {
        throw new NotFoundError("Activity log entry not found");
      }

      return reply.send({ data: log });
    },
  );

  // POST / — Create activity log entry
  fastify.post<{ Body: CreateActivityLog }>(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsedBody = createActivityLogSchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw new ValidationError(
          "Invalid activity log data",
          parsedBody.error.errors,
        );
      }

      const log = await request.tenantDb.activityLog.create({
        data: {
          ...parsedBody.data,
          shopId: request.shopId,
        },
      });

      return reply.status(201).send({ data: log });
    },
  );

  // GET /entity/:entityType/:entityId — Get logs for a specific entity
  fastify.get<{
    Params: { entityType: string; entityId: string };
    Querystring: { limit?: string; page?: string };
  }>(
    "/entity/:entityType/:entityId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { entityType, entityId } = request.params as {
        entityType: string;
        entityId: string;
      };

      const limit = Math.min(
        Math.max(parseInt((request.query as any).limit as string) || 25, 1),
        100,
      );
      const page = Math.max(
        parseInt((request.query as any).page as string) || 1,
        1,
      );
      const skip = (page - 1) * limit;

      // Validate UUID format for entityId
      try {
        z.string().uuid().parse(entityId);
      } catch {
        throw new ValidationError("Invalid entity ID format");
      }

      const [logs, total] = await Promise.all([
        request.tenantDb.activityLog.findMany({
          where: {
            shopId: request.shopId,
            entityType,
            entityId,
          },
          orderBy: { timestamp: "desc" },
          skip,
          take: limit,
        }),
        request.tenantDb.activityLog.count({
          where: {
            shopId: request.shopId,
            entityType,
            entityId,
          },
        }),
      ]);

      return reply.send({
        data: logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    },
  );

  // GET /stats — Get activity summary stats
  fastify.get<{ Querystring: { dateFrom?: string; dateTo?: string } }>(
    "/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { dateFrom, dateTo } = request.query as {
        dateFrom?: string;
        dateTo?: string;
      };

      const whereClause: Record<string, unknown> = {
        shopId: request.shopId,
      };

      if (dateFrom || dateTo) {
        whereClause.timestamp = {};
        if (dateFrom) {
          (whereClause.timestamp as Record<string, unknown>).gte = new Date(
            dateFrom,
          );
        }
        if (dateTo) {
          (whereClause.timestamp as Record<string, unknown>).lte = new Date(
            dateTo,
          );
        }
      }

      // Get counts by action type
      const actionCounts = await request.tenantDb.activityLog.groupBy({
        by: ["action"],
        where: whereClause as any,
        _count: true,
      });

      // Get counts by actor type
      const actorCounts = await request.tenantDb.activityLog.groupBy({
        by: ["actorType"],
        where: whereClause as any,
        _count: true,
      });

      // Get top actors by count
      const topActors = await request.tenantDb.activityLog.groupBy({
        by: ["actorId", "actorType"],
        where: whereClause as any,
        _count: true,
        orderBy: { _count: { id: "desc" } },
        take: 10,
      });

      // Get total event count
      const totalCount = await request.tenantDb.activityLog.count({
        where: whereClause as any,
      });

      // Get events today
      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      );

      const eventsToday = await request.tenantDb.activityLog.count({
        where: {
          ...whereClause,
          timestamp: {
            gte: startOfDay,
            lt: endOfDay,
          },
        } as any,
      });

      // Get most active entity type
      const entityTypeCounts = await request.tenantDb.activityLog.groupBy({
        by: ["entityType"],
        where: whereClause as any,
        _count: true,
        orderBy: { _count: { id: "desc" } },
        take: 1,
      });

      return reply.send({
        data: {
          totalEvents: totalCount,
          eventsToday,
          actionBreakdown: (actionCounts as any[]).map((item: any) => ({
            action: item.action,
            count: item._count,
          })),
          actorTypeBreakdown: (actorCounts as any[]).map((item: any) => ({
            actorType: item.actorType,
            count: item._count,
          })),
          topActors: (topActors as any[]).map((item: any) => ({
            actorId: item.actorId,
            actorType: item.actorType,
            count: item._count,
          })),
          mostActiveEntityType:
            entityTypeCounts.length > 0
              ? {
                  entityType: (entityTypeCounts[0] as any).entityType,
                  count: (entityTypeCounts[0] as any)._count,
                }
              : null,
        },
      });
    },
  );

  // DELETE /bulk — Soft-archive logs older than a date (ADMIN only)
  fastify.delete<{ Body: { beforeDate: string } }>(
    "/bulk",
    {
      preHandler: requireRole("ADMIN"),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({
        beforeDate: z.string().datetime(),
      });

      const parsedBody = schema.safeParse(request.body);
      if (!parsedBody.success) {
        throw new ValidationError(
          "Invalid request body",
          parsedBody.error.errors,
        );
      }

      const { beforeDate } = parsedBody.data;
      const cutoffDate = new Date(beforeDate);

      // Check if archived field exists; if not, add archiving concept via metadata
      // For now, we'll update via an "archived" field if it exists in the model,
      // otherwise we set an archived flag in metadata
      const updated = await request.tenantDb.activityLog.updateMany({
        where: {
          shopId: request.shopId,
          timestamp: {
            lt: cutoffDate,
          },
        },
        data: {
          metadata: {
            archived: true,
            archivedAt: new Date().toISOString(),
          },
        },
      });

      return reply.send({
        data: {
          archivedCount: updated.count,
          beforeDate: cutoffDate.toISOString(),
        },
      });
    },
  );
}
