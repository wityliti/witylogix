/**
 * Saved Views — user-defined table views with custom filters, sorts, and column visibility.
 *
 * Routes:
 *   POST   /                      Create view { name, tableName, filters?, sortConfig?, columnVisibility?, isShared? }
 *   GET    /                      List views for current user { tableName? }
 *   GET    /:id                   Get view
 *   PUT    /:id                   Update view
 *   DELETE /:id                   Delete view
 *   POST   /:id/duplicate         Duplicate view
 *   PUT    /:id/default           Set as default
 *   PUT    /:id/share             Toggle sharing
 *   GET    /columns/:tableName    Get available columns for table
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@witylogix/db";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────────

const filterSchema = z.object({
  field: z.string(),
  operator: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in"]),
  value: z.unknown(),
});

const sortConfigSchema = z.object({
  field: z.string(),
  order: z.enum(["asc", "desc"]),
});

const columnVisibilitySchema = z.record(z.boolean());

const createViewSchema = z.object({
  name: z.string().min(1).max(200),
  tableName: z.string(),
  filters: z.array(filterSchema).optional(),
  sortConfig: sortConfigSchema.optional(),
  columnVisibility: columnVisibilitySchema.optional(),
  isShared: z.boolean().optional().default(false),
});

const updateViewSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  filters: z.array(filterSchema).optional(),
  sortConfig: sortConfigSchema.optional(),
  columnVisibility: columnVisibilitySchema.optional(),
  isShared: z.boolean().optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const listViewsQuery = paginationSchema.extend({
  tableName: z.string().optional(),
});

// ─── Column Definitions (per table) ──────────────────────────────

const TABLE_COLUMNS: Record<string, Array<{ name: string; type: string }>> = {
  orders: [
    { name: "id", type: "string" },
    { name: "externalOrderNumber", type: "string" },
    { name: "customerName", type: "string" },
    { name: "customerEmail", type: "string" },
    { name: "status", type: "enum" },
    { name: "totalPrice", type: "number" },
    { name: "deliveryDate", type: "date" },
    { name: "createdAt", type: "date" },
  ],
  shipments: [
    { name: "id", type: "string" },
    { name: "orderId", type: "string" },
    { name: "status", type: "enum" },
    { name: "carrier", type: "string" },
    { name: "trackingNumber", type: "string" },
    { name: "shippedAt", type: "date" },
    { name: "deliveredAt", type: "date" },
    { name: "createdAt", type: "date" },
  ],
  products: [
    { name: "id", type: "string" },
    { name: "title", type: "string" },
    { name: "shopifyProductId", type: "string" },
    { name: "vendor", type: "string" },
    { name: "productType", type: "string" },
    { name: "weight", type: "number" },
    { name: "lastSyncAt", type: "date" },
  ],
  drivers: [
    { name: "id", type: "string" },
    { name: "name", type: "string" },
    { name: "phone", type: "string" },
    { name: "vehicleType", type: "string" },
    { name: "isActive", type: "boolean" },
    { name: "createdAt", type: "date" },
  ],
};

// ─── Route Plugin ────────────────────────────────────────────────

async function savedViewsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── POST / ──────────────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createViewSchema.parse(request.body);

    // Validate table name
    if (!TABLE_COLUMNS[body.tableName]) {
      throw new ValidationError(
        `Invalid table name. Supported tables: ${Object.keys(TABLE_COLUMNS).join(", ")}`,
      );
    }

    const view = await (request.tenantDb as any).savedView.create({
      data: {
        shopId: request.shopId,
        userId: request.auth.userId,
        name: body.name,
        tableName: body.tableName,
        filters: body.filters ? JSON.stringify(body.filters) : null,
        sortConfig: body.sortConfig ? JSON.stringify(body.sortConfig) : null,
        columnVisibility: body.columnVisibility
          ? JSON.stringify(body.columnVisibility)
          : null,
        isShared: body.isShared,
        isDefault: false,
      },
    });

    fastify.log.info(
      { shopId: request.shopId, userId: request.auth.userId, viewId: view.id },
      "Saved view created",
    );

    reply.status(201);
    return {
      data: {
        ...view,
        filters: view.filters ? JSON.parse(view.filters) : null,
        sortConfig: view.sortConfig ? JSON.parse(view.sortConfig) : null,
        columnVisibility: view.columnVisibility
          ? JSON.parse(view.columnVisibility)
          : null,
      },
    };
  });

  // ── GET / ────────────────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listViewsQuery.parse(request.query);
    const { page, limit, tableName } = query;

    const where: any = {
      shopId: request.shopId,
      userId: request.auth.userId,
    };

    if (tableName) {
      where.tableName = tableName;
    }

    const [views, total] = await Promise.all([
      (request.tenantDb as any).savedView.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (request.tenantDb as any).savedView.count({ where }),
    ]);

    const transformed = views.map((view: any) => ({
      ...view,
      filters: view.filters ? JSON.parse(view.filters) : null,
      sortConfig: view.sortConfig ? JSON.parse(view.sortConfig) : null,
      columnVisibility: view.columnVisibility
        ? JSON.parse(view.columnVisibility)
        : null,
    }));

    return {
      data: transformed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  // ── GET /:id ─────────────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const view = await (request.tenantDb as any).savedView.findUnique({
      where: { id },
    });

    if (!view) {
      throw new NotFoundError("Saved view", id);
    }

    if (view.shopId !== request.shopId) {
      throw new ForbiddenError("Cannot access view from another shop");
    }

    if (!view.isShared && view.userId !== request.auth.userId) {
      throw new ForbiddenError("Cannot access private view from another user");
    }

    return {
      data: {
        ...view,
        filters: view.filters ? JSON.parse(view.filters) : null,
        sortConfig: view.sortConfig ? JSON.parse(view.sortConfig) : null,
        columnVisibility: view.columnVisibility
          ? JSON.parse(view.columnVisibility)
          : null,
      },
    };
  });

  // ── PUT /:id ─────────────────────────────────────────────────

  fastify.put("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateViewSchema.parse(request.body);

    const view = await (request.tenantDb as any).savedView.findUnique({
      where: { id },
    });

    if (!view) {
      throw new NotFoundError("Saved view", id);
    }

    if (view.shopId !== request.shopId) {
      throw new ForbiddenError("Cannot update view from another shop");
    }

    if (view.userId !== request.auth.userId) {
      throw new ForbiddenError("Cannot update view from another user");
    }

    const updated = await (request.tenantDb as any).savedView.update({
      where: { id },
      data: {
        name: body.name,
        filters: body.filters ? JSON.stringify(body.filters) : undefined,
        sortConfig: body.sortConfig
          ? JSON.stringify(body.sortConfig)
          : undefined,
        columnVisibility: body.columnVisibility
          ? JSON.stringify(body.columnVisibility)
          : undefined,
        isShared: body.isShared,
        updatedAt: new Date(),
      },
    });

    fastify.log.info(
      { shopId: request.shopId, userId: request.auth.userId, viewId: id },
      "Saved view updated",
    );

    return {
      data: {
        ...updated,
        filters: updated.filters ? JSON.parse(updated.filters) : null,
        sortConfig: updated.sortConfig ? JSON.parse(updated.sortConfig) : null,
        columnVisibility: updated.columnVisibility
          ? JSON.parse(updated.columnVisibility)
          : null,
      },
    };
  });

  // ── DELETE /:id ──────────────────────────────────────────────

  fastify.delete(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const view = await (request.tenantDb as any).savedView.findUnique({
        where: { id },
      });

      if (!view) {
        throw new NotFoundError("Saved view", id);
      }

      if (view.shopId !== request.shopId) {
        throw new ForbiddenError("Cannot delete view from another shop");
      }

      if (view.userId !== request.auth.userId) {
        throw new ForbiddenError("Cannot delete view from another user");
      }

      await (request.tenantDb as any).savedView.delete({
        where: { id },
      });

      fastify.log.info(
        { shopId: request.shopId, userId: request.auth.userId, viewId: id },
        "Saved view deleted",
      );

      reply.status(204);
      return;
    },
  );

  // ── POST /:id/duplicate ──────────────────────────────────────

  fastify.post(
    "/:id/duplicate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const view = await (request.tenantDb as any).savedView.findUnique({
        where: { id },
      });

      if (!view) {
        throw new NotFoundError("Saved view", id);
      }

      if (view.shopId !== request.shopId) {
        throw new ForbiddenError("Cannot duplicate view from another shop");
      }

      const duplicated = await (request.tenantDb as any).savedView.create({
        data: {
          shopId: request.shopId,
          userId: request.auth.userId,
          name: `${view.name} (Copy)`,
          tableName: view.tableName,
          filters: view.filters,
          sortConfig: view.sortConfig,
          columnVisibility: view.columnVisibility,
          isShared: false,
          isDefault: false,
        },
      });

      fastify.log.info(
        {
          shopId: request.shopId,
          userId: request.auth.userId,
          viewId: duplicated.id,
        },
        "Saved view duplicated",
      );

      reply.status(201);
      return {
        data: {
          ...duplicated,
          filters: duplicated.filters ? JSON.parse(duplicated.filters) : null,
          sortConfig: duplicated.sortConfig
            ? JSON.parse(duplicated.sortConfig)
            : null,
          columnVisibility: duplicated.columnVisibility
            ? JSON.parse(duplicated.columnVisibility)
            : null,
        },
      };
    },
  );

  // ── PUT /:id/default ─────────────────────────────────────────

  fastify.put(
    "/:id/default",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const view = await (request.tenantDb as any).savedView.findUnique({
        where: { id },
      });

      if (!view) {
        throw new NotFoundError("Saved view", id);
      }

      if (view.shopId !== request.shopId) {
        throw new ForbiddenError("Cannot set default view from another shop");
      }

      if (view.userId !== request.auth.userId) {
        throw new ForbiddenError("Cannot set default view from another user");
      }

      // Unset previous default
      await (request.tenantDb as any).savedView.updateMany({
        where: {
          userId: request.auth.userId,
          tableName: view.tableName,
          isDefault: true,
        },
        data: { isDefault: false },
      });

      // Set new default
      const updated = await (request.tenantDb as any).savedView.update({
        where: { id },
        data: { isDefault: true },
      });

      fastify.log.info(
        { shopId: request.shopId, userId: request.auth.userId, viewId: id },
        "Saved view set as default",
      );

      return { data: updated };
    },
  );

  // ── PUT /:id/share ───────────────────────────────────────────

  fastify.put(
    "/:id/share",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const view = await (request.tenantDb as any).savedView.findUnique({
        where: { id },
      });

      if (!view) {
        throw new NotFoundError("Saved view", id);
      }

      if (view.shopId !== request.shopId) {
        throw new ForbiddenError("Cannot update view from another shop");
      }

      if (view.userId !== request.auth.userId) {
        throw new ForbiddenError("Cannot update view from another user");
      }

      const updated = await (request.tenantDb as any).savedView.update({
        where: { id },
        data: { isShared: !view.isShared },
      });

      fastify.log.info(
        {
          shopId: request.shopId,
          userId: request.auth.userId,
          viewId: id,
          isShared: updated.isShared,
        },
        "Saved view sharing toggled",
      );

      return {
        data: updated,
        message: `View is now ${updated.isShared ? "shared" : "private"}`,
      };
    },
  );

  // ── GET /columns/:tableName ──────────────────────────────────

  fastify.get(
    "/columns/:tableName",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tableName } = request.params as { tableName: string };

      const columns = TABLE_COLUMNS[tableName];
      if (!columns) {
        throw new ValidationError(
          `Invalid table name. Supported tables: ${Object.keys(TABLE_COLUMNS).join(", ")}`,
        );
      }

      return {
        data: {
          tableName,
          columns,
          total: columns.length,
        },
      };
    },
  );
}

export default savedViewsRoutes;
