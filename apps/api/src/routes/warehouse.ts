/**
 * Warehouse Operations API — pick strategy engine, pick-list generation,
 * putaway rules, and inbound PO receiving (dock-to-bin workflow).
 *
 * Routes:
 *   GET  /config                     Get warehouse config for a location
 *   PUT  /config                     Upsert pick strategy config
 *   GET  /pick-lists                 List pick lists (filterable by status)
 *   POST /pick-lists/generate        Generate optimised pick list from open orders
 *   GET  /pick-lists/:id             Get pick list with all items
 *   PATCH /pick-lists/:id            Update pick list status or assignee
 *   PATCH /pick-lists/:id/items/:itemId  Mark item picked
 *   GET  /putaway-rules              List putaway rules for a location
 *   POST /putaway-rules              Create a putaway rule
 *   PATCH /putaway-rules/:id         Update a putaway rule
 *   DELETE /putaway-rules/:id        Delete a putaway rule
 *   GET  /purchase-orders            List purchase orders
 *   POST /purchase-orders            Create inbound PO
 *   GET  /purchase-orders/:id        Get PO with line items
 *   PATCH /purchase-orders/:id       Update PO header
 *   POST /purchase-orders/:id/receive  Receive items (dock-to-bin)
 *   GET  /dashboard                  Operator dashboard: queues + putaway tasks
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, BadRequestError } from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────────────────────

const locationIdSchema = z.object({
  locationId: z.string().uuid("locationId must be a UUID"),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const warehouseConfigSchema = z.object({
  locationId: z.string().uuid(),
  pickStrategy: z
    .enum(["ZONE_PICK", "BATCH_PICK", "WAVE_PICK"])
    .default("BATCH_PICK"),
  waveWindows: z.array(z.number().int().min(0).max(1439)).default([]),
  batchSize: z.number().int().min(1).max(200).default(10),
  zoneLayout: z
    .array(
      z.object({
        code: z.string(),
        name: z.string(),
        binPrefix: z.string().optional(),
      }),
    )
    .default([]),
  putawayDefaults: z.record(z.unknown()).default({}),
});

const generatePickListSchema = z.object({
  locationId: z.string().uuid(),
  orderIds: z.array(z.string()).min(1, "At least one order required"),
  strategy: z.enum(["ZONE_PICK", "BATCH_PICK", "WAVE_PICK"]).optional(),
  zone: z.string().optional(),
  waveWindow: z.string().optional(),
});

const updatePickListSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  assignedTo: z.string().optional(),
});

const markItemPickedSchema = z.object({
  pickedById: z.string().optional(),
});

const putawayRuleSchema = z
  .object({
    locationId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional(),
    priority: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
    matchCriteria: z.object({
      productType: z.string().optional(),
      velocityClass: z.enum(["A", "B", "C"]).optional(),
      temperatureZone: z.enum(["ambient", "chilled", "frozen"]).optional(),
      maxWeightKg: z.number().positive().optional(),
      skuPrefix: z.string().optional(),
    }),
    targetZone: z.string().optional(),
    targetBinPrefix: z.string().optional(),
    targetBin: z.string().optional(),
  })
  .refine((v) => v.targetZone || v.targetBinPrefix || v.targetBin, {
    message:
      "At least one of targetZone, targetBinPrefix, or targetBin is required",
  });

const updatePutawayRuleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  matchCriteria: z
    .object({
      productType: z.string().optional(),
      velocityClass: z.enum(["A", "B", "C"]).optional(),
      temperatureZone: z.enum(["ambient", "chilled", "frozen"]).optional(),
      maxWeightKg: z.number().positive().optional(),
      skuPrefix: z.string().optional(),
    })
    .optional(),
  targetZone: z.string().optional(),
  targetBinPrefix: z.string().optional(),
  targetBin: z.string().optional(),
});

const purchaseOrderSchema = z.object({
  locationId: z.string().uuid(),
  poNumber: z.string().min(1),
  supplierName: z.string().optional(),
  expectedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string().optional(),
        sku: z.string().optional(),
        productTitle: z.string().optional(),
        quantityOrdered: z.number().int().positive(),
        unitCost: z.number().positive().optional(),
        currencyCode: z.string().length(3).default("USD"),
      }),
    )
    .min(1, "At least one item required"),
});

const updatePurchaseOrderSchema = z.object({
  supplierName: z.string().optional(),
  status: z
    .enum([
      "DRAFT",
      "SENT",
      "CONFIRMED",
      "PARTIALLY_RECEIVED",
      "RECEIVED",
      "CANCELLED",
    ])
    .optional(),
  expectedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const receivePOSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        quantityReceived: z.number().int().positive(),
        actualBin: z.string().optional(),
      }),
    )
    .min(1),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Apply putaway rules to determine bin/zone for a given item.
 * Rules are evaluated in ascending priority order; first match wins.
 */
function applyPutawayRules(
  rules: Array<{
    priority: number;
    matchCriteria: unknown;
    targetZone: string | null;
    targetBinPrefix: string | null;
    targetBin: string | null;
  }>,
  item: {
    sku?: string | null;
    productType?: string | null;
    weightKg?: number | null;
  },
): { zone: string | null; bin: string | null } {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    const criteria = rule.matchCriteria as Record<string, unknown>;
    let matches = true;

    if (criteria.productType && item.productType !== criteria.productType)
      matches = false;
    if (
      criteria.skuPrefix &&
      typeof item.sku === "string" &&
      !item.sku.startsWith(criteria.skuPrefix as string)
    )
      matches = false;
    if (
      criteria.maxWeightKg != null &&
      item.weightKg != null &&
      item.weightKg > (criteria.maxWeightKg as number)
    )
      matches = false;

    if (matches) {
      return {
        zone: rule.targetZone ?? null,
        bin: rule.targetBin ?? rule.targetBinPrefix ?? null,
      };
    }
  }
  return { zone: null, bin: null };
}

/**
 * Enrich order lines with product/variant info for pick list items.
 */
function buildPickListItems(
  orders: Array<{ id: string; lineItems?: unknown }>,
  zone?: string,
): Array<{
  orderId: string;
  productId: string;
  variantId?: string;
  sku?: string;
  productTitle?: string;
  quantity: number;
  zone?: string;
  binLocation?: string;
}> {
  const items: ReturnType<typeof buildPickListItems> = [];
  for (const order of orders) {
    const lines = (order as any).lineItems ?? (order as any).line_items ?? [];
    for (const line of lines) {
      items.push({
        orderId: order.id,
        productId: line.productId ?? line.product_id ?? "",
        variantId: line.variantId ?? line.variant_id,
        sku: line.sku,
        productTitle: line.title ?? line.name,
        quantity: line.quantity ?? 1,
        zone,
      });
    }
  }
  return items;
}

// ─── Route Plugin ────────────────────────────────────────────────────────────

async function warehouseRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  const db = () => (fastify as any).prisma ?? (fastify as any).db;

  // ── WAREHOUSE CONFIG ────────────────────────────────────────────────────────

  fastify.get(
    "/config",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { locationId } = locationIdSchema.parse(request.query);
      const shopId = request.shopId;

      const config = await (request.tenantDb as any).warehouseConfig.findFirst({
        where: { locationId, shopId },
      });

      if (!config) {
        return {
          locationId,
          pickStrategy: "BATCH_PICK",
          waveWindows: [],
          batchSize: 10,
          zoneLayout: [],
          putawayDefaults: {},
        };
      }
      return config;
    },
  );

  fastify.put(
    "/config",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const body = warehouseConfigSchema.parse(request.body);
      const shopId = request.shopId;

      const config = await (request.tenantDb as any).warehouseConfig.upsert({
        where: { locationId: body.locationId },
        create: { ...body, shopId },
        update: {
          pickStrategy: body.pickStrategy,
          waveWindows: body.waveWindows,
          batchSize: body.batchSize,
          zoneLayout: body.zoneLayout,
          putawayDefaults: body.putawayDefaults,
        },
      });

      return config;
    },
  );

  // ── PICK LISTS ───────────────────────────────────────────────────────────────

  fastify.get(
    "/pick-lists",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const query = z
        .object({
          locationId: z.string().uuid().optional(),
          status: z
            .enum(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"])
            .optional(),
          ...paginationSchema.shape,
        })
        .parse(request.query);

      const { page, limit, locationId, status } = query;
      const shopId = request.shopId;

      const where: Record<string, unknown> = { shopId };
      if (locationId) where.locationId = locationId;
      if (status) where.status = status;

      const [pickLists, total] = await Promise.all([
        (request.tenantDb as any).pickList.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" as const },
          include: {
            items: { select: { id: true, picked: true } },
          },
        }),
        (request.tenantDb as any).pickList.count({ where }),
      ]);

      const enriched = pickLists.map((pl: any) => ({
        ...pl,
        totalItems: pl.items.length,
        pickedItems: pl.items.filter((i: any) => i.picked).length,
        items: undefined,
      }));

      return {
        data: enriched,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    },
  );

  fastify.post(
    "/pick-lists/generate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = generatePickListSchema.parse(request.body);
      const shopId = request.shopId;

      // Fetch warehouse config to determine active strategy
      const config = await (request.tenantDb as any).warehouseConfig.findFirst({
        where: { locationId: body.locationId, shopId },
      });
      const strategy = body.strategy ?? config?.pickStrategy ?? "BATCH_PICK";

      // Fetch orders — use available order IDs
      // lineItems is a JSON column on Order, not a relation
      const orders = await request.tenantDb.order.findMany({
        where: { shopId, id: { in: body.orderIds } },
      });

      if (orders.length === 0) {
        throw new BadRequestError(
          "No valid orders found for provided orderIds",
        );
      }

      // Fetch active putaway rules for bin assignment hints
      const putawayRules = await (request.tenantDb as any).putawayRule.findMany(
        {
          where: { shopId, locationId: body.locationId, isActive: true },
          orderBy: { priority: "asc" as const },
        },
      );

      // Build pick list items with putaway hints
      const rawItems = buildPickListItems(orders, body.zone);
      const itemsWithBins = rawItems.map((item) => {
        const { zone, bin } = applyPutawayRules(putawayRules, {
          sku: item.sku,
          productType: null,
        });
        return {
          ...item,
          zone: item.zone ?? zone ?? undefined,
          binLocation: bin ?? undefined,
        };
      });

      // Sort items by zone/bin for efficient picking path
      itemsWithBins.sort((a, b) => {
        const zoneA = a.zone ?? "";
        const zoneB = b.zone ?? "";
        if (zoneA !== zoneB) return zoneA.localeCompare(zoneB);
        return (a.binLocation ?? "").localeCompare(b.binLocation ?? "");
      });

      const pickList = await (request.tenantDb as any).pickList.create({
        data: {
          shopId,
          locationId: body.locationId,
          strategy,
          status: "OPEN",
          orderIds: body.orderIds,
          waveWindow: body.waveWindow,
          zone: body.zone,
          items: {
            create: itemsWithBins,
          },
        },
        include: { items: true },
      });

      reply.code(201);
      return pickList;
    },
  );

  fastify.get(
    "/pick-lists/:id",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const shopId = request.shopId;

      const pickList = await (request.tenantDb as any).pickList.findFirst({
        where: { id, shopId },
        include: {
          items: {
            orderBy: [
              { zone: "asc" as const },
              { binLocation: "asc" as const },
            ],
          },
        },
      });

      if (!pickList) throw new NotFoundError("PickList", id);
      return pickList;
    },
  );

  fastify.patch(
    "/pick-lists/:id",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = updatePickListSchema.parse(request.body);
      const shopId = request.shopId;

      const existing = await (request.tenantDb as any).pickList.findFirst({
        where: { id, shopId },
      });
      if (!existing) throw new NotFoundError("PickList", id);

      const updates: Record<string, unknown> = { ...body };
      if (body.status === "IN_PROGRESS" && !existing.startedAt)
        updates.startedAt = new Date();
      if (body.status === "DONE") updates.completedAt = new Date();

      return (request.tenantDb as any).pickList.update({
        where: { id },
        data: updates,
      });
    },
  );

  fastify.patch(
    "/pick-lists/:id/items/:itemId",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { id, itemId } = z
        .object({ id: z.string().uuid(), itemId: z.string().uuid() })
        .parse(request.params);
      const body = markItemPickedSchema.parse(request.body);
      const shopId = request.shopId;

      const pickList = await (request.tenantDb as any).pickList.findFirst({
        where: { id, shopId },
      });
      if (!pickList) throw new NotFoundError("PickList", id);

      const item = await (request.tenantDb as any).pickListItem.findFirst({
        where: { id: itemId, pickListId: id },
      });
      if (!item) throw new NotFoundError("PickListItem", itemId);

      return (request.tenantDb as any).pickListItem.update({
        where: { id: itemId },
        data: {
          picked: true,
          pickedAt: new Date(),
          pickedById: body.pickedById,
        },
      });
    },
  );

  // ── PUTAWAY RULES ────────────────────────────────────────────────────────────

  fastify.get(
    "/putaway-rules",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { locationId } = locationIdSchema.parse(request.query);
      const shopId = request.shopId;

      return (request.tenantDb as any).putawayRule.findMany({
        where: { shopId, locationId },
        orderBy: { priority: "asc" as const },
      });
    },
  );

  fastify.post(
    "/putaway-rules",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = putawayRuleSchema.parse(request.body);
      const shopId = request.shopId;

      const rule = await (request.tenantDb as any).putawayRule.create({
        data: { ...body, shopId },
      });

      reply.code(201);
      return rule;
    },
  );

  fastify.patch(
    "/putaway-rules/:id",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = updatePutawayRuleSchema.parse(request.body);
      const shopId = request.shopId;

      const existing = await (request.tenantDb as any).putawayRule.findFirst({
        where: { id, shopId },
      });
      if (!existing) throw new NotFoundError("PutawayRule", id);

      return (request.tenantDb as any).putawayRule.update({
        where: { id },
        data: body,
      });
    },
  );

  fastify.delete(
    "/putaway-rules/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const shopId = request.shopId;

      const existing = await (request.tenantDb as any).putawayRule.findFirst({
        where: { id, shopId },
      });
      if (!existing) throw new NotFoundError("PutawayRule", id);

      await (request.tenantDb as any).putawayRule.delete({ where: { id } });
      reply.code(204);
      return null;
    },
  );

  // ── PURCHASE ORDERS ───────────────────────────────────────────────────────────

  fastify.get(
    "/purchase-orders",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const query = z
        .object({
          locationId: z.string().uuid().optional(),
          status: z
            .enum([
              "DRAFT",
              "SENT",
              "CONFIRMED",
              "PARTIALLY_RECEIVED",
              "RECEIVED",
              "CANCELLED",
            ])
            .optional(),
          ...paginationSchema.shape,
        })
        .parse(request.query);

      const { page, limit, locationId, status } = query;
      const shopId = request.shopId;

      const where: Record<string, unknown> = { shopId };
      if (locationId) where.locationId = locationId;
      if (status) where.status = status;

      const [orders, total] = await Promise.all([
        (request.tenantDb as any).purchaseOrder.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" as const },
          include: {
            items: {
              select: {
                id: true,
                quantityOrdered: true,
                quantityReceived: true,
              },
            },
          },
        }),
        (request.tenantDb as any).purchaseOrder.count({ where }),
      ]);

      const enriched = orders.map((po: any) => ({
        ...po,
        totalLines: po.items.length,
        totalOrdered: po.items.reduce(
          (s: number, i: any) => s + i.quantityOrdered,
          0,
        ),
        totalReceived: po.items.reduce(
          (s: number, i: any) => s + i.quantityReceived,
          0,
        ),
        items: undefined,
      }));

      return {
        data: enriched,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    },
  );

  fastify.post(
    "/purchase-orders",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = purchaseOrderSchema.parse(request.body);
      const shopId = request.shopId;

      // Fetch putaway rules to pre-fill suggested bins
      const putawayRules = await (request.tenantDb as any).putawayRule.findMany(
        {
          where: { shopId, locationId: body.locationId, isActive: true },
          orderBy: { priority: "asc" as const },
        },
      );

      const itemsWithBins = body.items.map((item) => {
        const { bin } = applyPutawayRules(putawayRules, {
          sku: item.sku ?? null,
        });
        return { ...item, suggestedBin: bin };
      });

      const po = await (request.tenantDb as any).purchaseOrder.create({
        data: {
          shopId,
          locationId: body.locationId,
          poNumber: body.poNumber,
          supplierName: body.supplierName,
          expectedAt: body.expectedAt ? new Date(body.expectedAt) : undefined,
          notes: body.notes,
          items: { create: itemsWithBins },
        },
        include: { items: true },
      });

      reply.code(201);
      return po;
    },
  );

  fastify.get(
    "/purchase-orders/:id",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const shopId = request.shopId;

      const po = await (request.tenantDb as any).purchaseOrder.findFirst({
        where: { id, shopId },
        include: { items: true },
      });

      if (!po) throw new NotFoundError("PurchaseOrder", id);
      return po;
    },
  );

  fastify.patch(
    "/purchase-orders/:id",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = updatePurchaseOrderSchema.parse(request.body);
      const shopId = request.shopId;

      const existing = await (request.tenantDb as any).purchaseOrder.findFirst({
        where: { id, shopId },
      });
      if (!existing) throw new NotFoundError("PurchaseOrder", id);

      const updates: Record<string, unknown> = { ...body };
      if (body.expectedAt) updates.expectedAt = new Date(body.expectedAt);

      return (request.tenantDb as any).purchaseOrder.update({
        where: { id },
        data: updates,
      });
    },
  );

  /**
   * Receive PO items: dock-to-bin workflow.
   * For each received item:
   *  1. Update quantityReceived on PurchaseOrderItem
   *  2. Create an InventoryMovement(RECEIVE) to update stock
   *  3. Update PO status based on completion
   */
  fastify.post(
    "/purchase-orders/:id/receive",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = receivePOSchema.parse(request.body);
      const shopId = request.shopId;

      const po = await (request.tenantDb as any).purchaseOrder.findFirst({
        where: { id, shopId },
        include: { items: true },
      });

      if (!po) throw new NotFoundError("PurchaseOrder", id);
      if (po.status === "RECEIVED" || po.status === "CANCELLED") {
        throw new BadRequestError(
          `PO is ${po.status} and cannot receive more items`,
        );
      }

      const itemMap = new Map<string, (typeof po.items)[number]>(
        po.items.map((i: any) => [i.id, i]),
      );

      const results: unknown[] = [];

      for (const recv of body.items) {
        const poItem = itemMap.get(recv.itemId);
        if (!poItem) {
          throw new BadRequestError(
            `Item ${recv.itemId} does not belong to PO ${id}`,
          );
        }

        const newReceived =
          (poItem as any).quantityReceived + recv.quantityReceived;
        if (newReceived > (poItem as any).quantityOrdered) {
          throw new BadRequestError(
            `Cannot receive ${recv.quantityReceived} for item ${recv.itemId}: would exceed ordered quantity`,
          );
        }

        // 1. Update PO item
        const updatedItem = await (
          request.tenantDb as any
        ).purchaseOrderItem.update({
          where: { id: recv.itemId },
          data: {
            quantityReceived: newReceived,
            actualBin: recv.actualBin,
          },
        });
        results.push(updatedItem);

        // 2. Create InventoryMovement (RECEIVE)
        // Find or create InventoryItem for this product+location
        const invItem = await (request.tenantDb as any).inventoryItem.upsert({
          where: {
            shopId_productId_variantId_locationId: {
              shopId,
              productId: (poItem as any).productId,
              variantId: (poItem as any).variantId ?? "",
              locationId: po.locationId,
            },
          },
          create: {
            shopId,
            productId: (poItem as any).productId,
            variantId: (poItem as any).variantId,
            locationId: po.locationId,
            quantity: recv.quantityReceived,
          },
          update: {
            quantity: { increment: recv.quantityReceived },
          },
        });

        await (request.tenantDb as any).inventoryMovement.create({
          data: {
            itemId: invItem.id,
            type: "RECEIVE",
            quantity: recv.quantityReceived,
            toLocationId: po.locationId,
            reference: po.poNumber,
          },
        });
      }

      // 3. Determine new PO status
      const refreshedItems = await (
        request.tenantDb as any
      ).purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
      });

      const allReceived = refreshedItems.every(
        (i: any) => i.quantityReceived >= i.quantityOrdered,
      );
      const anyReceived = refreshedItems.some(
        (i: any) => i.quantityReceived > 0,
      );
      const newStatus = allReceived
        ? "RECEIVED"
        : anyReceived
          ? "PARTIALLY_RECEIVED"
          : po.status;

      const updatedPO = await (request.tenantDb as any).purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          receivedAt: allReceived ? new Date() : undefined,
        },
        include: { items: true },
      });

      return { purchaseOrder: updatedPO, received: results };
    },
  );

  // ── OPERATOR DASHBOARD ───────────────────────────────────────────────────────

  fastify.get(
    "/dashboard",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { locationId } = locationIdSchema.parse(request.query);
      const shopId = request.shopId;

      const [openPickLists, inProgressPickLists, pendingPOs, recentPOs] =
        await Promise.all([
          (request.tenantDb as any).pickList.findMany({
            where: { shopId, locationId, status: "OPEN" },
            orderBy: { createdAt: "asc" as const },
            take: 10,
            include: { items: { select: { id: true, picked: true } } },
          }),
          (request.tenantDb as any).pickList.findMany({
            where: { shopId, locationId, status: "IN_PROGRESS" },
            orderBy: { startedAt: "asc" as const },
            take: 10,
            include: { items: { select: { id: true, picked: true } } },
          }),
          (request.tenantDb as any).purchaseOrder.findMany({
            where: {
              shopId,
              locationId,
              status: { in: ["CONFIRMED", "PARTIALLY_RECEIVED"] },
            },
            orderBy: { expectedAt: "asc" as const },
            take: 10,
            include: {
              items: {
                select: {
                  id: true,
                  quantityOrdered: true,
                  quantityReceived: true,
                  suggestedBin: true,
                },
              },
            },
          }),
          (request.tenantDb as any).purchaseOrder.findMany({
            where: { shopId, locationId },
            orderBy: { createdAt: "desc" as const },
            take: 5,
          }),
        ]);

      const summarise = (pl: any) => ({
        id: pl.id,
        strategy: pl.strategy,
        status: pl.status,
        orderCount: pl.orderIds?.length ?? 0,
        totalItems: pl.items.length,
        pickedItems: pl.items.filter((i: any) => i.picked).length,
        assignedTo: pl.assignedTo,
        zone: pl.zone,
        waveWindow: pl.waveWindow,
        createdAt: pl.createdAt,
        startedAt: pl.startedAt,
      });

      return {
        pickQueues: {
          open: openPickLists.map(summarise),
          inProgress: inProgressPickLists.map(summarise),
        },
        putawayTasks: pendingPOs.map((po: any) => ({
          id: po.id,
          poNumber: po.poNumber,
          supplierName: po.supplierName,
          status: po.status,
          expectedAt: po.expectedAt,
          items: po.items.map((i: any) => ({
            id: i.id,
            quantityOrdered: i.quantityOrdered,
            quantityReceived: i.quantityReceived,
            remaining: i.quantityOrdered - i.quantityReceived,
            suggestedBin: i.suggestedBin,
          })),
        })),
        recentPurchaseOrders: recentPOs,
      };
    },
  );
}

export default warehouseRoutes;
