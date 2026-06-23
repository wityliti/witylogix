/**
 * Inventory Management API — InventoryItem records with product enrichment.
 *
 * Routes:
 *   GET  /            List inventory items (joined with product cache for name/SKU)
 *   GET  /warehouses  Warehouse aggregates with lat/lng for map view
 *   GET  /:id         Get single inventory item with movements
 *   POST /            Create inventory item
 *   PATCH /:id        Update quantity / reorder point
 *   POST /:id/adjust  Record a stock movement (adjust quantity)
 *   GET  /movements   List recent stock movements
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError } from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────────────

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  locationId: z.string().optional(),
  status: z.enum(["in-stock", "low-stock", "out-of-stock", "all"]).optional().default("all"),
});

const createItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  locationId: z.string(),
  quantity: z.number().int().min(0).default(0),
  reorderPoint: z.number().int().min(0).default(10),
  reorderQuantity: z.number().int().min(0).default(50),
});

const updateItemSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  reorderQuantity: z.number().int().min(0).optional(),
});

const adjustStockSchema = z.object({
  type: z.enum(["RECEIVE", "SHIP", "ADJUST", "TRANSFER"]),
  quantity: z.number().int(),
  fromLocationId: z.string().optional(),
  toLocationId: z.string().optional(),
  reference: z.string().optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────

function deriveStatus(quantity: number, reorderPoint: number): "in-stock" | "low-stock" | "out-of-stock" {
  if (quantity <= 0) return "out-of-stock";
  if (quantity <= reorderPoint) return "low-stock";
  return "in-stock";
}

// ─── Route Plugin ────────────────────────────────────────────────────

async function inventoryRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST INVENTORY ITEMS ──────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, _reply: FastifyReply) => {
    const query = paginationSchema.parse(request.query);
    const { page, limit, search, locationId, status } = query;

    const where: Record<string, unknown> = { shopId: request.shopId };
    if (locationId) where.locationId = locationId;

    const [inventoryItems, total] = await Promise.all([
      (request.tenantDb as any).inventoryItem.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" as const },
        include: { movements: { take: 5, orderBy: { createdAt: "desc" as const } } },
      }),
      (request.tenantDb as any).inventoryItem.count({ where }),
    ]);

    // Enrich with product data
    const productIds = [...new Set(inventoryItems.map((i: any) => i.productId))];
    const products = productIds.length > 0
      ? await request.tenantDb.product.findMany({
          where: { shopId: request.shopId, id: { in: productIds as string[] } },
          select: { id: true, title: true, productType: true, vendor: true, inventoryQuantity: true },
        })
      : [];

    const productMap = new Map(products.map((p) => [p.id, p]));

    const enriched = inventoryItems
      .map((item: any) => {
        const product = productMap.get(item.productId);
        const itemStatus = deriveStatus(item.quantity, item.reorderPoint);
        if (status !== "all" && itemStatus !== status) return null;
        return {
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          locationId: item.locationId,
          name: product?.title ?? "Unknown Product",
          sku: item.productId, // use productId as SKU until variant SKU model is added
          productType: product?.productType ?? null,
          vendor: product?.vendor ?? null,
          quantity: item.quantity,
          reservedQuantity: item.reservedQuantity,
          availableQuantity: item.quantity - item.reservedQuantity,
          reorderPoint: item.reorderPoint,
          reorderQuantity: item.reorderQuantity,
          status: itemStatus,
          recentMovements: item.movements,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      })
      .filter(Boolean);

    return {
      data: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── GET SINGLE ITEM ───────────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const item = await (request.tenantDb as any).inventoryItem.findUnique({
      where: { id },
      include: { movements: { orderBy: { createdAt: "desc" as const }, take: 20 } },
    });

    if (!item || item.shopId !== request.shopId) throw new NotFoundError("InventoryItem", id);

    const product = await request.tenantDb.product.findFirst({
      where: { shopId: request.shopId, id: item.productId },
      select: { id: true, title: true, productType: true, vendor: true },
    });

    return {
      data: {
        ...item,
        name: product?.title ?? "Unknown Product",
        status: deriveStatus(item.quantity, item.reorderPoint),
      },
    };
  });

  // ── CREATE INVENTORY ITEM ─────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createItemSchema.parse(request.body);

    const item = await (request.tenantDb as any).inventoryItem.create({
      data: {
        shopId: request.shopId,
        productId: body.productId,
        variantId: body.variantId ?? null,
        locationId: body.locationId,
        quantity: body.quantity,
        reorderPoint: body.reorderPoint,
        reorderQuantity: body.reorderQuantity,
      },
    });

    reply.status(201);
    return { data: { ...item, status: deriveStatus(item.quantity, item.reorderPoint) } };
  });

  // ── UPDATE INVENTORY ITEM ─────────────────────────────────────────

  fastify.patch("/:id", async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateItemSchema.parse(request.body);

    const existing = await (request.tenantDb as any).inventoryItem.findUnique({ where: { id } });
    if (!existing || existing.shopId !== request.shopId) throw new NotFoundError("InventoryItem", id);

    const updated = await (request.tenantDb as any).inventoryItem.update({
      where: { id },
      data: body,
    });

    return { data: { ...updated, status: deriveStatus(updated.quantity, updated.reorderPoint) } };
  });

  // ── ADJUST STOCK ──────────────────────────────────────────────────

  fastify.post("/:id/adjust", async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = adjustStockSchema.parse(request.body);

    const existing = await (request.tenantDb as any).inventoryItem.findUnique({ where: { id } });
    if (!existing || existing.shopId !== request.shopId) throw new NotFoundError("InventoryItem", id);

    const delta = body.type === "SHIP" ? -Math.abs(body.quantity) : Math.abs(body.quantity);

    const [updated, movement] = await (request.tenantDb as any).$transaction([
      (request.tenantDb as any).inventoryItem.update({
        where: { id },
        data: { quantity: { increment: delta } },
      }),
      (request.tenantDb as any).inventoryMovement.create({
        data: {
          itemId: id,
          type: body.type,
          quantity: body.quantity,
          fromLocationId: body.fromLocationId ?? null,
          toLocationId: body.toLocationId ?? null,
          reference: body.reference ?? null,
        },
      }),
    ]);

    return { data: { item: { ...updated, status: deriveStatus(updated.quantity, updated.reorderPoint) }, movement } };
  });

  // ── LIST MOVEMENTS ────────────────────────────────────────────────

  fastify.get("/movements", async (request: FastifyRequest, _reply: FastifyReply) => {
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };

    // Get all item IDs for this shop first
    const itemIds = await (request.tenantDb as any).inventoryItem.findMany({
      where: { shopId: request.shopId },
      select: { id: true },
    });

    const ids = itemIds.map((i: any) => i.id);
    if (ids.length === 0) {
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }

    const [movements, total] = await Promise.all([
      (request.tenantDb as any).inventoryMovement.findMany({
        where: { itemId: { in: ids } },
        orderBy: { createdAt: "desc" as const },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (request.tenantDb as any).inventoryMovement.count({ where: { itemId: { in: ids } } }),
    ]);

    return { data: movements, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  });

  // ── WAREHOUSE AGGREGATES (map view) ──────────────────────────────

  fastify.get("/warehouses", async (request: FastifyRequest, _reply: FastifyReply) => {
    const shopId = request.shopId;

    // Aggregate items per locationId
    const items: Array<{ locationId: string; quantity: number; reorderPoint: number }> =
      await (request.tenantDb as any).inventoryItem.findMany({
        where: { shopId },
        select: { locationId: true, quantity: true, reorderPoint: true },
      });

    if (items.length === 0) return { data: [] };

    // Group by locationId
    const groups = new Map<
      string,
      { totalQuantity: number; itemCount: number; lowStock: number; outOfStock: number }
    >();
    for (const item of items) {
      const existing = groups.get(item.locationId) ?? {
        totalQuantity: 0,
        itemCount: 0,
        lowStock: 0,
        outOfStock: 0,
      };
      existing.totalQuantity += item.quantity;
      existing.itemCount++;
      if (item.quantity <= 0) existing.outOfStock++;
      else if (item.quantity <= item.reorderPoint) existing.lowStock++;
      groups.set(item.locationId, existing);
    }

    const locationIds = Array.from(groups.keys());

    // Fetch locations with lat/lng via raw SQL (Prisma schema uses raw columns)
    let locations: Array<{
      id: string;
      name: string;
      city: string | null;
      latitude: string | null;
      longitude: string | null;
    }> = [];

    try {
      locations = await (request.tenantDb as any).$queryRawUnsafe(
        `SELECT id, name, city, latitude, longitude
         FROM locations
         WHERE id = ANY($1::uuid[]) AND shop_id = $2::uuid`,
        locationIds,
        shopId
      );
    } catch {
      // Location table may not have rows; return empty
      return { data: [] };
    }

    const result = locations
      .filter(
        (loc) =>
          loc.latitude !== null &&
          loc.longitude !== null &&
          !isNaN(parseFloat(loc.latitude!)) &&
          !isNaN(parseFloat(loc.longitude!))
      )
      .map((loc) => {
        const agg = groups.get(loc.id) ?? {
          totalQuantity: 0,
          itemCount: 0,
          lowStock: 0,
          outOfStock: 0,
        };
        const utilizationPercentage =
          agg.itemCount > 0
            ? Math.round(((agg.lowStock + agg.outOfStock) / agg.itemCount) * 100)
            : 0;
        return {
          id: loc.id,
          name: loc.name,
          city: loc.city ?? null,
          lat: parseFloat(loc.latitude!),
          lng: parseFloat(loc.longitude!),
          totalQuantity: agg.totalQuantity,
          itemCount: agg.itemCount,
          utilizationPercentage,
        };
      });

    return { data: result };
  });
}

export default inventoryRoutes;
