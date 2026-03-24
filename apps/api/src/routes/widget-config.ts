/**
 * Widget Configuration — dashboard widgets management.
 *
 * Routes:
 *   POST   /                  Add widget { type, name?, config?, position?, targetPages? }
 *   GET    /                  List active widgets { page? }
 *   GET    /catalog           Get widget catalog
 *   PUT    /:id               Update widget { config?, position?, styling? }
 *   DELETE /:id               Remove widget (soft delete)
 *   PUT    /:id/toggle        Toggle active/inactive
 *   POST   /reorder           Reorder widgets { items: [{widgetId, position}] }
 *   POST   /reset             Reset to default layout
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@witylogix/db";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────────

const widgetTypeSchema = z.enum([
  "ORDERS_SUMMARY",
  "SHIPMENTS_PENDING",
  "REVENUE_CHART",
  "QUICK_STATS",
  "DRIVER_ACTIVITY",
  "TOP_PRODUCTS",
  "CUSTOMER_MAP",
  "NOTIFICATIONS",
  "CALENDAR",
  "RECENT_SHIPMENTS",
]);

const createWidgetSchema = z.object({
  type: widgetTypeSchema,
  name: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  position: z.object({ row: z.number(), col: z.number() }).optional(),
  targetPages: z.array(z.string()).optional(),
});

const updateWidgetSchema = z.object({
  config: z.record(z.unknown()).optional(),
  position: z.object({ row: z.number(), col: z.number() }).optional(),
  styling: z.record(z.unknown()).optional(),
});

const reorderSchema = z.object({
  items: z.array(
    z.object({
      widgetId: z.string().uuid(),
      position: z.object({ row: z.number(), col: z.number() }),
    }),
  ),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Widget Catalog ─────────────────────────────────────────────

const WIDGET_CATALOG = [
  {
    id: "ORDERS_SUMMARY",
    name: "Orders Summary",
    description: "Overview of order count and status breakdown",
    type: "ORDERS_SUMMARY",
    dimensions: { minWidth: 300, minHeight: 200 },
    defaultConfig: { timeframe: "7d", showTrend: true },
  },
  {
    id: "SHIPMENTS_PENDING",
    name: "Pending Shipments",
    description: "Count and list of pending shipments",
    type: "SHIPMENTS_PENDING",
    dimensions: { minWidth: 300, minHeight: 250 },
    defaultConfig: { limit: 10, sortBy: "createdAt" },
  },
  {
    id: "REVENUE_CHART",
    name: "Revenue Chart",
    description: "Revenue trend over time",
    type: "REVENUE_CHART",
    dimensions: { minWidth: 400, minHeight: 300 },
    defaultConfig: { timeframe: "30d", chartType: "line" },
  },
  {
    id: "QUICK_STATS",
    name: "Quick Stats",
    description: "Key metrics at a glance",
    type: "QUICK_STATS",
    dimensions: { minWidth: 300, minHeight: 150 },
    defaultConfig: { metrics: ["totalOrders", "totalRevenue", "avgDeliveryTime"] },
  },
  {
    id: "DRIVER_ACTIVITY",
    name: "Driver Activity",
    description: "Real-time driver activity and location map",
    type: "DRIVER_ACTIVITY",
    dimensions: { minWidth: 400, minHeight: 300 },
    defaultConfig: { showMap: true, showList: true },
  },
  {
    id: "TOP_PRODUCTS",
    name: "Top Products",
    description: "Best-selling products",
    type: "TOP_PRODUCTS",
    dimensions: { minWidth: 300, minHeight: 250 },
    defaultConfig: { limit: 10, timeframe: "30d" },
  },
  {
    id: "CUSTOMER_MAP",
    name: "Customer Map",
    description: "Geographic distribution of customers",
    type: "CUSTOMER_MAP",
    dimensions: { minWidth: 400, minHeight: 350 },
    defaultConfig: { heatmap: true },
  },
  {
    id: "NOTIFICATIONS",
    name: "Notifications",
    description: "Recent system notifications and alerts",
    type: "NOTIFICATIONS",
    dimensions: { minWidth: 300, minHeight: 200 },
    defaultConfig: { limit: 5 },
  },
  {
    id: "CALENDAR",
    name: "Calendar",
    description: "Scheduled deliveries calendar",
    type: "CALENDAR",
    dimensions: { minWidth: 350, minHeight: 300 },
    defaultConfig: { view: "month" },
  },
  {
    id: "RECENT_SHIPMENTS",
    name: "Recent Shipments",
    description: "List of recently updated shipments",
    type: "RECENT_SHIPMENTS",
    dimensions: { minWidth: 400, minHeight: 300 },
    defaultConfig: { limit: 10, sortBy: "updatedAt" },
  },
];

// ─── Route Plugin ────────────────────────────────────────────────

async function widgetConfigRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── POST / ──────────────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createWidgetSchema.parse(request.body);

    // Validate widget type exists in catalog
    const catalogEntry = WIDGET_CATALOG.find((w) => w.type === body.type);
    if (!catalogEntry) {
      throw new ValidationError(`Invalid widget type: ${body.type}`);
    }

    // Calculate next position if not provided
    let position = body.position;
    if (!position) {
      const existingCount = await (request.tenantDb as any).widget.count({
        where: { shopId: request.shopId },
      });
      position = {
        row: Math.floor(existingCount / 2),
        col: existingCount % 2,
      };
    }

    const widget = await (request.tenantDb as any).widget.create({
      data: {
        shopId: request.shopId,
        type: body.type,
        name: body.name || catalogEntry.name,
        config: body.config ? JSON.stringify(body.config) : JSON.stringify(catalogEntry.defaultConfig),
        position: JSON.stringify(position),
        targetPages: body.targetPages ? JSON.stringify(body.targetPages) : null,
        isActive: true,
      },
    });

    fastify.log.info(
      { shopId: request.shopId, widgetId: widget.id, type: body.type },
      "Widget created",
    );

    reply.status(201);
    return {
      data: {
        ...widget,
        config: JSON.parse(widget.config),
        position: JSON.parse(widget.position),
        targetPages: widget.targetPages ? JSON.parse(widget.targetPages) : null,
      },
    };
  });

  // ── GET / ────────────────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = paginationSchema.parse(request.query);
    const { page, limit } = query;

    const [widgets, total] = await Promise.all([
      (request.tenantDb as any).widget.findMany({
        where: { shopId: request.shopId, isActive: true },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (request.tenantDb as any).widget.count({
        where: { shopId: request.shopId, isActive: true },
      }),
    ]);

    const transformed = widgets.map((widget: any) => ({
      ...widget,
      config: JSON.parse(widget.config),
      position: JSON.parse(widget.position),
      targetPages: widget.targetPages ? JSON.parse(widget.targetPages) : null,
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

  // ── GET /catalog ─────────────────────────────────────────────

  fastify.get("/catalog", async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      data: WIDGET_CATALOG,
      total: WIDGET_CATALOG.length,
    };
  });

  // ── PUT /:id ─────────────────────────────────────────────────

  fastify.put("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateWidgetSchema.parse(request.body);

    const widget = await (request.tenantDb as any).widget.findUnique({
      where: { id },
    });

    if (!widget) {
      throw new NotFoundError("Widget", id);
    }

    if (widget.shopId !== request.shopId) {
      throw new ForbiddenError("Cannot update widget from another shop");
    }

    const updateData: any = {};
    if (body.config) {
      updateData.config = JSON.stringify(body.config);
    }
    if (body.position) {
      updateData.position = JSON.stringify(body.position);
    }
    if (body.styling) {
      updateData.styling = JSON.stringify(body.styling);
    }

    const updated = await (request.tenantDb as any).widget.update({
      where: { id },
      data: updateData,
    });

    fastify.log.info(
      { shopId: request.shopId, widgetId: id },
      "Widget updated",
    );

    return {
      data: {
        ...updated,
        config: JSON.parse(updated.config),
        position: JSON.parse(updated.position),
        targetPages: updated.targetPages ? JSON.parse(updated.targetPages) : null,
        styling: updated.styling ? JSON.parse(updated.styling) : null,
      },
    };
  });

  // ── DELETE /:id ──────────────────────────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const widget = await (request.tenantDb as any).widget.findUnique({
      where: { id },
    });

    if (!widget) {
      throw new NotFoundError("Widget", id);
    }

    if (widget.shopId !== request.shopId) {
      throw new ForbiddenError("Cannot delete widget from another shop");
    }

    // Soft delete
    const deleted = await (request.tenantDb as any).widget.update({
      where: { id },
      data: { isActive: false },
    });

    fastify.log.info(
      { shopId: request.shopId, widgetId: id },
      "Widget deleted",
    );

    reply.status(204);
    return;
  });

  // ── PUT /:id/toggle ──────────────────────────────────────────

  fastify.put(
    "/:id/toggle",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const widget = await (request.tenantDb as any).widget.findUnique({
        where: { id },
      });

      if (!widget) {
        throw new NotFoundError("Widget", id);
      }

      if (widget.shopId !== request.shopId) {
        throw new ForbiddenError("Cannot toggle widget from another shop");
      }

      const updated = await (request.tenantDb as any).widget.update({
        where: { id },
        data: { isActive: !widget.isActive },
      });

      fastify.log.info(
        { shopId: request.shopId, widgetId: id, isActive: updated.isActive },
        "Widget toggled",
      );

      return {
        data: {
          ...updated,
          config: JSON.parse(updated.config),
          position: JSON.parse(updated.position),
          targetPages: updated.targetPages ? JSON.parse(updated.targetPages) : null,
        },
        message: `Widget is now ${updated.isActive ? "active" : "inactive"}`,
      };
    },
  );

  // ── POST /reorder ────────────────────────────────────────────

  fastify.post(
    "/reorder",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = reorderSchema.parse(request.body);

      // Verify all widgets exist and belong to shop
      const widgetIds = body.items.map((item) => item.widgetId);
      const widgets = await (request.tenantDb as any).widget.findMany({
        where: { id: { in: widgetIds }, shopId: request.shopId },
      });

      if (widgets.length !== widgetIds.length) {
        throw new ValidationError("Some widgets not found or don't belong to this shop");
      }

      // Update all widget positions
      await Promise.all(
        body.items.map((item) =>
          (request.tenantDb as any).widget.update({
            where: { id: item.widgetId },
            data: { position: JSON.stringify(item.position) },
          }),
        ),
      );

      fastify.log.info(
        { shopId: request.shopId, count: body.items.length },
        "Widgets reordered",
      );

      reply.status(200);
      return { message: "Widgets reordered successfully" };
    },
  );

  // ── POST /reset ──────────────────────────────────────────────

  fastify.post(
    "/reset",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Soft delete all existing widgets
      await (request.tenantDb as any).widget.updateMany({
        where: { shopId: request.shopId },
        data: { isActive: false },
      });

      // Create default widgets
      const defaultWidgets = [
        { type: "QUICK_STATS", name: "Quick Stats", row: 0, col: 0 },
        { type: "ORDERS_SUMMARY", name: "Orders Summary", row: 0, col: 1 },
        { type: "REVENUE_CHART", name: "Revenue Chart", row: 1, col: 0 },
        { type: "TOP_PRODUCTS", name: "Top Products", row: 1, col: 1 },
      ];

      const created = await Promise.all(
        defaultWidgets.map((w) =>
          (request.tenantDb as any).widget.create({
            data: {
              shopId: request.shopId,
              type: w.type as any,
              name: w.name,
              config: JSON.stringify(WIDGET_CATALOG.find((c) => c.type === w.type)?.defaultConfig),
              position: JSON.stringify({ row: w.row, col: w.col }),
              isActive: true,
            },
          }),
        ),
      );

      fastify.log.info(
        { shopId: request.shopId, count: created.length },
        "Widget layout reset to default",
      );

      reply.status(201);
      return {
        data: created.map((widget) => ({
          ...widget,
          config: JSON.parse(widget.config),
          position: JSON.parse(widget.position),
          targetPages: widget.targetPages ? JSON.parse(widget.targetPages) : null,
        })),
        message: "Dashboard reset to default layout",
      };
    },
  );
}

export default widgetConfigRoutes;
