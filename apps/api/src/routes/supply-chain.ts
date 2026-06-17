/**
 * Supply Chain API — aggregated views for inventory, orders, fulfillment,
 * demand planning, warehouse ops, reorder alerts, and stock gauges.
 *
 * Routes:
 *   GET /inventory         Inventory items with ABC classification
 *   GET /orders            Orders with fulfillment status
 *   GET /fulfillment       Active fulfillment pipeline
 *   GET /demand-planning   Demand vs supply forecast (derived from order history)
 *   GET /warehouses        Warehouse (location) utilisation summary
 *   GET /reorder-alerts    Items below reorder threshold
 *   GET /stock-gauges      Per-SKU stock level gauges
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────

function deriveInventoryStatus(quantity: number, reorderPoint: number): string {
  if (quantity <= 0) return "out-of-stock";
  if (quantity <= reorderPoint) return "low-stock";
  return "in-stock";
}

function deriveAbcClass(quantity: number, reorderPoint: number): "A" | "B" | "C" {
  const ratio = reorderPoint > 0 ? quantity / reorderPoint : quantity;
  if (ratio >= 5) return "A";
  if (ratio >= 2) return "B";
  return "C";
}

// ─── Route Plugin ────────────────────────────────────────────────────

async function supplyChainRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── INVENTORY ─────────────────────────────────────────────────────

  fastify.get("/inventory", async (request: FastifyRequest, _reply: FastifyReply) => {
    const query = paginationSchema.parse(request.query);
    const { page, limit } = query;
    const shopId = request.shopId;

    const [items, total] = await Promise.all([
      (request.tenantDb as any).inventoryItem.findMany({
        where: { shopId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" as const },
      }),
      (request.tenantDb as any).inventoryItem.count({ where: { shopId } }),
    ]);

    // Enrich with product info
    const productIds = [...new Set(items.map((i: any) => i.productId as string))];
    const products = productIds.length > 0
      ? await request.tenantDb.product.findMany({
          where: { shopId, id: { in: productIds } },
          select: { id: true, title: true, productType: true, vendor: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Enrich with location info
    const locationIds = [...new Set(items.map((i: any) => i.locationId as string))];
    const locations = locationIds.length > 0
      ? await (request.tenantDb as any).location?.findMany({
          where: { id: { in: locationIds } },
          select: { id: true, name: true },
        }).catch(() => [])
      : [];
    const locationMap = new Map((locations as any[]).map((l: any) => [l.id, l]));

    const enriched = items.map((item: any) => {
      const product = productMap.get(item.productId);
      const location = locationMap.get(item.locationId);
      return {
        id: item.id,
        name: product?.title ?? "Unknown Product",
        sku: item.productId,
        warehouse: location?.name ?? item.locationId,
        status: deriveInventoryStatus(item.quantity, item.reorderPoint),
        abcClass: deriveAbcClass(item.quantity, item.reorderPoint),
        quantity: item.quantity,
        reorderPoint: item.reorderPoint,
        unitCost: 0, // cost model not yet implemented
        productId: item.productId,
        locationId: item.locationId,
        reservedQuantity: item.reservedQuantity,
        updatedAt: item.updatedAt,
      };
    });

    return { data: enriched, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  });

  // ── ORDERS ────────────────────────────────────────────────────────

  fastify.get("/orders", async (request: FastifyRequest, _reply: FastifyReply) => {
    const query = paginationSchema.parse(request.query);
    const { page, limit, search } = query;
    const shopId = request.shopId;

    const where: Record<string, unknown> = { shopId };
    if (search) {
      where.OR = [
        { externalOrderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [orders, total] = await Promise.all([
      request.tenantDb.order.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" as const },
        select: {
          id: true,
          externalOrderId: true,
          externalOrderNumber: true,
          status: true,
          customerName: true,
          customerEmail: true,
          totalPrice: true,
          itemCount: true,
          deliveryDate: true,
          createdAt: true,
          tags: true,
        },
      }),
      request.tenantDb.order.count({ where: where as any }),
    ]);

    const mapped = orders.map((o) => ({
      id: o.id,
      orderNumber: o.externalOrderNumber ?? o.externalOrderId,
      status: mapOrderStatus(String(o.status)),
      customer: o.customerName ?? o.customerEmail ?? "Unknown",
      items: o.itemCount,
      total: Number(o.totalPrice ?? 0),
      createdDate: o.createdAt.toISOString(),
      dueDate: o.deliveryDate?.toISOString() ?? null,
      warehouse: "Main",
      priority: (o.tags as string[]).includes("expedited") ? "expedited" : "standard",
    }));

    return { data: mapped, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  });

  // ── FULFILLMENT ───────────────────────────────────────────────────

  fastify.get("/fulfillment", async (request: FastifyRequest, _reply: FastifyReply) => {
    const query = paginationSchema.parse(request.query);
    const { page, limit } = query;
    const shopId = request.shopId;

    const orders = await request.tenantDb.order.findMany({
      where: {
        shopId,
        status: { in: ["PICKED_UP", "IN_TRANSIT", "PENDING", "ASSIGNED"] as any },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" as const },
      select: {
        id: true,
        externalOrderNumber: true,
        itemCount: true,
        status: true,
        createdAt: true,
        deliveryDate: true,
        fulfillmentId: true,
      },
    });

    const total = await request.tenantDb.order.count({
      where: {
        shopId,
        status: { in: ["PICKED_UP", "IN_TRANSIT", "PENDING", "ASSIGNED"] as any },
      },
    });

    const mapped = orders.map((o) => ({
      orderId: o.id,
      orderNumber: o.externalOrderNumber ?? o.id,
      itemCount: o.itemCount,
      status: mapFulfillmentStatus(String(o.status)),
      startTime: o.createdAt.toISOString(),
      estCompletionTime: o.deliveryDate?.toISOString() ?? new Date(Date.now() + 86400000).toISOString(),
      warehouse: "Main",
      pickWave: `WAVE-${o.createdAt.toISOString().slice(0, 7).replace("-", "")}-0001`,
      batchNumber: o.fulfillmentId ?? `BATCH-${o.id.slice(0, 8)}`,
    }));

    return { data: mapped, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  });

  // ── DEMAND PLANNING ───────────────────────────────────────────────

  fastify.get("/demand-planning", async (request: FastifyRequest, _reply: FastifyReply) => {
    const shopId = request.shopId;

    // Aggregate orders by month for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const orders = await request.tenantDb.order.findMany({
      where: { shopId, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, itemCount: true },
    });

    // Group by month
    const monthMap = new Map<string, { demand: number; count: number }>();
    for (const o of orders) {
      const period = o.createdAt.toISOString().slice(0, 7); // "YYYY-MM"
      const existing = monthMap.get(period) ?? { demand: 0, count: 0 };
      existing.demand += o.itemCount;
      existing.count += 1;
      monthMap.set(period, existing);
    }

    const data = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, val]) => ({
        period,
        demand: val.demand,
        supply: Math.round(val.demand * 1.1), // supply assumption: 10% buffer
        variance: Math.round(val.demand * 0.1),
        confidence: 80,
      }));

    return { data, pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 } };
  });

  // ── WAREHOUSES ────────────────────────────────────────────────────

  fastify.get("/warehouses", async (request: FastifyRequest, _reply: FastifyReply) => {
    const shopId = request.shopId;

    // Fetch locations that serve as warehouses
    let locations: any[] = [];
    try {
      locations = await (request.tenantDb as any).location.findMany({
        where: { shopId, isActive: true },
        select: { id: true, name: true, type: true, city: true, addressLine1: true, country: true, coordinates: true },
      });
    } catch {
      // location model may not exist in all environments
      locations = [{ id: "default", name: "Main Warehouse", type: "WAREHOUSE", city: null, coordinates: null }];
    }

    // For each location get inventory count
    const enriched = await Promise.all(
      locations.map(async (loc: any) => {
        const itemCount = await (request.tenantDb as any).inventoryItem
          .count({ where: { shopId, locationId: loc.id } })
          .catch(() => 0);
        const totalQty: number = await (request.tenantDb as any).inventoryItem
          .aggregate({ where: { shopId, locationId: loc.id }, _sum: { quantity: true } })
          .then((r: any) => r._sum?.quantity ?? 0)
          .catch(() => 0);

        const capacity = 10000;
        const utilization = Math.min(totalQty, capacity);
        const coords = loc.coordinates as { lat?: number; lng?: number } | null;
        return {
          warehouseId: loc.id,
          name: loc.name,
          type: loc.type ?? "WAREHOUSE",
          city: loc.city ?? null,
          address: loc.addressLine1 ?? null,
          country: loc.country ?? null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          capacity,
          utilization,
          utilizationPercentage: Math.round((utilization / capacity) * 100),
          itemCount,
          totalQuantity: totalQty,
          activeOrders: 0,
          pendingPutaway: 0,
          cycleCountsScheduled: 0,
        };
      }),
    );

    return { data: enriched, pagination: { page: 1, limit: enriched.length, total: enriched.length, totalPages: 1 } };
  });

  // ── REORDER ALERTS ────────────────────────────────────────────────

  fastify.get("/reorder-alerts", async (request: FastifyRequest, _reply: FastifyReply) => {
    const query = paginationSchema.parse(request.query);
    const { page, limit } = query;
    const shopId = request.shopId;

    const [items, total] = await Promise.all([
      (request.tenantDb as any).inventoryItem.findMany({
        where: { shopId, quantity: { lte: (request.tenantDb as any).inventoryItem.fields?.reorderPoint } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { quantity: "asc" as const },
      }),
      (request.tenantDb as any).inventoryItem.count({
        where: { shopId, quantity: { lte: 10 } },
      }),
    ]);

    // Actually use a raw approach for "quantity <= reorderPoint"
    const lowItems = await (request.tenantDb as any).inventoryItem.findMany({
      where: { shopId },
      orderBy: { quantity: "asc" as const },
    });
    const filteredLow = lowItems.filter((i: any) => i.quantity <= i.reorderPoint);
    const paged = filteredLow.slice((page - 1) * limit, page * limit);

    const productIds = [...new Set(paged.map((i: any) => i.productId as string))];
    const products = productIds.length > 0
      ? await request.tenantDb.product.findMany({
          where: { shopId, id: { in: productIds } },
          select: { id: true, title: true, vendor: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    const alerts = paged.map((item: any) => {
      const product = productMap.get(item.productId);
      const urgency = item.quantity <= 0 ? "critical" : item.quantity <= item.reorderPoint / 2 ? "high" : "medium";
      return {
        id: item.id,
        sku: item.productId,
        productName: product?.title ?? "Unknown Product",
        currentQty: item.quantity,
        reorderPoint: item.reorderPoint,
        suggestedOrder: item.reorderQuantity,
        vendor: product?.vendor ?? "Unknown",
        leadTime: 7,
        urgency,
      };
    });

    return {
      data: alerts,
      pagination: { page, limit, total: filteredLow.length, totalPages: Math.ceil(filteredLow.length / limit) },
    };
  });

  // ── STOCK GAUGES ──────────────────────────────────────────────────

  fastify.get("/stock-gauges", async (request: FastifyRequest, _reply: FastifyReply) => {
    const shopId = request.shopId;

    const items = await (request.tenantDb as any).inventoryItem.findMany({
      where: { shopId },
      take: 20,
      orderBy: { quantity: "desc" as const },
    });

    const productIds = [...new Set(items.map((i: any) => i.productId as string))];
    const products = productIds.length > 0
      ? await request.tenantDb.product.findMany({
          where: { shopId, id: { in: productIds } },
          select: { id: true, title: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    const gauges = items.map((item: any) => {
      const product = productMap.get(item.productId);
      const maximum = item.reorderQuantity * 3;
      const percentageFilled = maximum > 0 ? Math.min(100, Math.round((item.quantity / maximum) * 100)) : 0;
      let status: "critical" | "warning" | "optimal" | "overstock" = "optimal";
      if (item.quantity <= 0) status = "critical";
      else if (item.quantity <= item.reorderPoint) status = "warning";
      else if (item.quantity >= maximum * 0.9) status = "overstock";

      return {
        sku: item.productId,
        name: product?.title ?? "Unknown Product",
        current: item.quantity,
        minimum: item.reorderPoint,
        maximum,
        percentageFilled,
        status,
      };
    });

    return { data: gauges, pagination: { page: 1, limit: gauges.length, total: gauges.length, totalPages: 1 } };
  });

  // ── WAVE PLANS ────────────────────────────────────────────────────────

  fastify.get("/waves", async (request: FastifyRequest, _reply: FastifyReply) => {
    const shopId = request.shopId;

    const waves = await (request.tenantDb as any).pickList.findMany({
      where: { shopId, strategy: "WAVE_PICK" },
      include: { items: { select: { orderId: true } } },
      orderBy: { createdAt: "desc" as const },
      take: 50,
    });

    const data = waves.map((w: any) => {
      const orderIds = [...new Set(w.items.map((i: any) => i.orderId as string))];
      const status =
        w.status === "DONE" ? "completed"
        : w.status === "IN_PROGRESS" ? "picking"
        : "planned";
      return {
        waveId: `WAVE-${w.id.slice(0, 8).toUpperCase()}`,
        id: w.id,
        createdDate: w.createdAt,
        ordersCount: orderIds.length,
        itemsCount: w.items.length,
        status,
        waveWindow: w.waveWindow,
        estimatedCompletionTime: w.completedAt ?? null,
        assignedTo: w.assignedTo,
      };
    });

    return { data, total: data.length };
  });

  // ── BATCH PICKING ─────────────────────────────────────────────────────

  fastify.get("/batches", async (request: FastifyRequest, _reply: FastifyReply) => {
    const shopId = request.shopId;

    const batches = await (request.tenantDb as any).pickList.findMany({
      where: { shopId, strategy: "BATCH_PICK" },
      include: { items: { select: { id: true, binLocation: true, zone: true } } },
      orderBy: { createdAt: "desc" as const },
      take: 50,
    });

    const data = batches.map((b: any) => {
      const status =
        b.status === "DONE" ? "completed"
        : b.status === "IN_PROGRESS" ? "in-progress"
        : "pending";
      const doneItems = b.status === "DONE" ? b.items.length : b.status === "IN_PROGRESS" ? Math.floor(b.items.length * 0.5) : 0;
      const completionRate = b.items.length > 0 ? Math.round((doneItems / b.items.length) * 100) : 0;
      const zone = b.zone ?? b.items[0]?.zone ?? "General";
      return {
        batchId: `BATCH-${b.batchNumber ?? b.id.slice(0, 6).toUpperCase()}`,
        id: b.id,
        waveId: `WAVE-${b.id.slice(0, 8).toUpperCase()}`,
        location: `Zone ${zone}`,
        itemCount: b.items.length,
        status,
        assignedTo: b.assignedTo,
        completionRate,
      };
    });

    return { data, total: data.length };
  });
}

// ─── Status Mappers ──────────────────────────────────────────────────

function mapOrderStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: "received",
    ASSIGNED: "picked",
    PICKED_UP: "packed",
    IN_TRANSIT: "shipped",
    DELIVERED: "delivered",
    FAILED: "received",
    CANCELLED: "received",
  };
  return map[status] ?? "received";
}

function mapFulfillmentStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: "received",
    ASSIGNED: "picked",
    PICKED_UP: "packed",
    IN_TRANSIT: "shipped",
    DELIVERED: "delivered",
  };
  return map[status] ?? "received";
}

export default supplyChainRoutes;
