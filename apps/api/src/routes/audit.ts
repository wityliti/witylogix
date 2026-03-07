/**
 * Audit Trail API — Compliance and activity logging
 *
 * Routes (all require ADMIN role):
 *   GET    /                       Query audit log (paginated, filterable)
 *   GET    /entity/:resource/:id   Get history for specific entity
 *   GET    /user/:userId           Get user activity log
 *   GET    /export                 Export audit log as CSV
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError } from "../lib/errors.js";

// ─── SCHEMAS ────────────────────────────────────────────────

const auditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  resource: z.string().optional(),
  userId: z.string().uuid().optional(),
  action: z.enum(["CREATE", "READ", "UPDATE", "DELETE", "EXPORT"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ─── ROUTE PLUGIN ───────────────────────────────────────────

async function auditRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth, tenant context, and admin role
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);
  fastify.addHook("preHandler", requireRole("ADMIN", "SUPER_ADMIN"));

  // ── QUERY AUDIT LOG ─────────────────────────────────────────

  fastify.get(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = auditQuerySchema.parse(request.query);

        const pageNum = query.page;
        const pageSize = query.limit;
        const skip = (pageNum - 1) * pageSize;

        let whereClause = "WHERE shop_id = $1::uuid";
        const params: any[] = [(request as any).shopId];
        let paramCount = 1;

        if (query.resource) {
          paramCount++;
          whereClause += ` AND resource_type = $${paramCount}::text`;
          params.push(query.resource);
        }

        if (query.userId) {
          paramCount++;
          whereClause += ` AND user_id = $${paramCount}::uuid`;
          params.push(query.userId);
        }

        if (query.action) {
          paramCount++;
          whereClause += ` AND action = $${paramCount}::text`;
          params.push(query.action);
        }

        if (query.startDate) {
          paramCount++;
          whereClause += ` AND created_at >= $${paramCount}::timestamptz`;
          params.push(query.startDate);
        }

        if (query.endDate) {
          paramCount++;
          whereClause += ` AND created_at <= $${paramCount}::timestamptz`;
          params.push(query.endDate);
        }

        // Get total count
        const countResult: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
          ...params
        );
        const total = Number(countResult[0]?.count || 0);

        // Get paginated results
        paramCount += 2;
        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT
              id, shop_id, user_id, action, resource_type, resource_id,
              changes, ip_address, user_agent, metadata, created_at
            FROM audit_logs
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
        fastify.log.error({ err: error }, "Failed to query audit log");
        return reply.code(500).send({ error: "Failed to query audit log" });
      }
    }
  );

  // ── GET ENTITY HISTORY ──────────────────────────────────────

  fastify.get(
    "/entity/:resource/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { resource, id } = request.params as {
          resource: string;
          id: string;
        };
        const { page = 1, limit = 50 } = request.query as {
          page?: number;
          limit?: number;
        };

        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const pageSize = Math.min(200, Math.max(1, parseInt(String(limit)) || 50));
        const skip = (pageNum - 1) * pageSize;

        // Verify UUID format for resource ID
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          return reply.code(400).send({ error: "Invalid resource ID format" });
        }

        // Get total count
        const countResult: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT COUNT(*) as count FROM audit_logs
            WHERE shop_id = $1::uuid AND resource_type = $2::text AND resource_id = $3::uuid
          `,
          (request as any).shopId,
          resource,
          id
        );
        const total = Number(countResult[0]?.count || 0);

        if (total === 0) {
          return reply.code(404).send({ error: "No history found for this resource" });
        }

        // Get paginated results
        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT
              id, user_id, action, resource_type, resource_id,
              changes, metadata, created_at
            FROM audit_logs
            WHERE shop_id = $1::uuid AND resource_type = $2::text AND resource_id = $3::uuid
            ORDER BY created_at DESC
            LIMIT $4::int
            OFFSET $5::int
          `,
          (request as any).shopId,
          resource,
          id,
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
        fastify.log.error({ err: error }, "Failed to get entity history");
        return reply.code(500).send({ error: "Failed to get entity history" });
      }
    }
  );

  // ── GET USER ACTIVITY ───────────────────────────────────────

  fastify.get(
    "/user/:userId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = request.params as { userId: string };
        const { page = 1, limit = 50, action, startDate, endDate } = request.query as {
          page?: number;
          limit?: number;
          action?: string;
          startDate?: string;
          endDate?: string;
        };

        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const pageSize = Math.min(200, Math.max(1, parseInt(String(limit)) || 50));
        const skip = (pageNum - 1) * pageSize;

        // Verify UUID format
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
          return reply.code(400).send({ error: "Invalid user ID format" });
        }

        let whereClause = "WHERE shop_id = $1::uuid AND user_id = $2::uuid";
        const params: any[] = [(request as any).shopId, userId];
        let paramCount = 2;

        if (action) {
          paramCount++;
          whereClause += ` AND action = $${paramCount}::text`;
          params.push(action);
        }

        if (startDate) {
          paramCount++;
          whereClause += ` AND created_at >= $${paramCount}::timestamptz`;
          params.push(startDate);
        }

        if (endDate) {
          paramCount++;
          whereClause += ` AND created_at <= $${paramCount}::timestamptz`;
          params.push(endDate);
        }

        // Get total count
        const countResult: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
          ...params
        );
        const total = Number(countResult[0]?.count || 0);

        if (total === 0) {
          return reply.code(404).send({ error: "No activity found for this user" });
        }

        // Get paginated results
        paramCount += 2;
        const result: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT
              id, user_id, action, resource_type, resource_id,
              changes, ip_address, user_agent, metadata, created_at
            FROM audit_logs
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
        fastify.log.error({ err: error }, "Failed to get user activity");
        return reply.code(500).send({ error: "Failed to get user activity" });
      }
    }
  );

  // ── EXPORT AUDIT LOG ────────────────────────────────────────

  fastify.get(
    "/export",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const {
          resource,
          userId,
          action,
          startDate,
          endDate,
        } = request.query as {
          resource?: string;
          userId?: string;
          action?: string;
          startDate?: string;
          endDate?: string;
        };

        let whereClause = "WHERE shop_id = $1::uuid";
        const params: any[] = [(request as any).shopId];
        let paramCount = 1;

        if (resource) {
          paramCount++;
          whereClause += ` AND resource_type = $${paramCount}::text`;
          params.push(resource);
        }

        if (userId) {
          paramCount++;
          whereClause += ` AND user_id = $${paramCount}::uuid`;
          params.push(userId);
        }

        if (action) {
          paramCount++;
          whereClause += ` AND action = $${paramCount}::text`;
          params.push(action);
        }

        if (startDate) {
          paramCount++;
          whereClause += ` AND created_at >= $${paramCount}::timestamptz`;
          params.push(startDate);
        }

        if (endDate) {
          paramCount++;
          whereClause += ` AND created_at <= $${paramCount}::timestamptz`;
          params.push(endDate);
        }

        // Fetch all matching records
        const records: any[] = await (request as any).tenantDb.$queryRawUnsafe(
          `
            SELECT
              id, user_id, action, resource_type, resource_id,
              changes, ip_address, user_agent, metadata, created_at
            FROM audit_logs
            ${whereClause}
            ORDER BY created_at DESC
          `,
          ...params
        );

        // Generate CSV
        const csv = generateCsv(records);

        // Set response headers for download
        reply.header("Content-Type", "text/csv");
        reply.header(
          "Content-Disposition",
          `attachment; filename="audit-export-${Date.now()}.csv"`
        );

        fastify.log.info(
          { recordCount: records.length, shopId: (request as any).shopId },
          "Audit log exported"
        );

        return csv;
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to export audit log");
        return reply.code(500).send({ error: "Failed to export audit log" });
      }
    }
  );
}

// ─── HELPERS ────────────────────────────────────────────────

function generateCsv(records: any[]): string {
  if (records.length === 0) {
    return "No data to export\n";
  }

  const headers = [
    "ID",
    "User ID",
    "Action",
    "Resource Type",
    "Resource ID",
    "Changes",
    "IP Address",
    "User Agent",
    "Metadata",
    "Created At",
  ];

  const rows = records.map((record) => [
    record.id,
    record.user_id,
    record.action,
    record.resource_type,
    record.resource_id,
    record.changes ? JSON.stringify(record.changes) : "",
    record.ip_address || "",
    record.user_agent || "",
    record.metadata ? JSON.stringify(record.metadata) : "",
    record.created_at,
  ]);

  const csvContent = [
    headers.map(escapeQuotes).join(","),
    ...rows.map((row) =>
      row.map((cell) => escapeQuotes(String(cell || ""))).join(",")
    ),
  ].join("\n");

  return csvContent;
}

function escapeQuotes(str: string): string {
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default auditRoutes;
