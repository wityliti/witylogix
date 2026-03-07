/**
 * Products Cache Sync — Shopify product data cached for fast lookups.
 *
 * This cache syncs product data from Shopify webhooks or manual sync operations.
 * Fast lookups by SKU/barcode are critical during shipment creation.
 *
 * Routes:
 *   GET    /              List products (paginated, searchable by title/sku)
 *   GET    /:id           Get single product
 *   POST   /sync          Bulk upsert products (array from Shopify webhook)
 *   DELETE /:id           Remove cached product
 *   GET    /stats         Product stats (total, synced today, missing weight, etc.)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";
import { paginationSchema, syncProductsSchema } from "@witylogix/validators";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError } from "../lib/errors.js";

// ─── Query Params Schema ────────────────────────────────────

const listProductsQuery = paginationSchema.extend({
  search: z.string().optional(),
  sortBy: z.enum(["title", "productType", "lastSyncAt"]).default("lastSyncAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Route Plugin ───────────────────────────────────────────

async function productRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST PRODUCTS ──────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listProductsQuery.parse(request.query);
    const { page, limit, search, sortBy, sortOrder } = query;

    const where: Prisma.ProductWhereInput = {
      shopId: request.shopId,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { shopifyProductId: { contains: search, mode: "insensitive" } },
        { vendor: { contains: search, mode: "insensitive" } },
      ];
    }

    const [products, total] = await Promise.all([
      request.tenantDb.product.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      request.tenantDb.product.count({ where }),
    ]);

    return {
      data: products,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── GET SINGLE PRODUCT ─────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const product = await request.tenantDb.product.findUnique({
      where: { id },
    });

    if (!product) throw new NotFoundError("Product", id);
    if (product.shopId !== request.shopId) {
      throw new NotFoundError("Product", id);
    }

    return { data: product };
  });

  // ── SYNC PRODUCTS (UPSERT) ────────────────────────────────

  fastify.post("/sync", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = syncProductsSchema.parse(request.body);
    const { products: incomingProducts } = body;

    // Upsert all products in a transaction
    const synced = await request.tenantDb.$transaction(async (tx) => {
      const results = await Promise.all(
        incomingProducts.map((product: any) =>
          tx.product.upsert({
            where: {
              // Unique constraint: shopId + shopifyProductId
              shopId_shopifyProductId: {
                shopId: request.shopId,
                shopifyProductId: product.externalId,
              },
            },
            update: {
              title: product.title,
              productType: product.productType,
              vendor: product.vendor,
              weight: product.weight ? new Prisma.Decimal(product.weight) : null,
              requiresShipping: product.requiresShipping,
              variants: product.metadata ?? {},
              lastSyncAt: new Date(),
            },
            create: {
              shopId: request.shopId,
              shopifyProductId: product.externalId,
              title: product.title,
              productType: product.productType,
              vendor: product.vendor,
              weight: product.weight ? new Prisma.Decimal(product.weight) : null,
              requiresShipping: product.requiresShipping,
              variants: product.metadata ?? {},
            },
          }),
        ),
      );
      return results;
    });

    reply.status(200);
    return {
      data: synced,
      message: `Synced ${synced.length} products`,
    };
  });

  // ── DELETE PRODUCT ────────────────────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const product = await request.tenantDb.product.findUnique({
      where: { id },
    });

    if (!product) throw new NotFoundError("Product", id);
    if (product.shopId !== request.shopId) {
      throw new NotFoundError("Product", id);
    }

    const deleted = await request.tenantDb.product.delete({
      where: { id },
    });

    return { data: deleted };
  });

  // ── PRODUCT STATS ──────────────────────────────────────────

  fastify.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    // Total products
    const total = await request.tenantDb.product.count({
      where: { shopId: request.shopId },
    });

    // Products synced today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const syncedToday = await request.tenantDb.product.count({
      where: {
        shopId: request.shopId,
        lastSyncAt: { gte: today },
      },
    });

    // Products missing weight
    const missingWeight = await request.tenantDb.product.count({
      where: {
        shopId: request.shopId,
        weight: null,
        requiresShipping: true,
      },
    });

    // Products without productType
    const missingSkus = await request.tenantDb.product.count({
      where: {
        shopId: request.shopId,
        productType: null,
      },
    });

    // Last sync timestamp
    const lastSync = await request.tenantDb.product.findFirst({
      where: { shopId: request.shopId },
      orderBy: { lastSyncAt: "desc" },
      select: { lastSyncAt: true },
    });

    return {
      data: {
        total,
        syncedToday,
        missingWeight,
        missingSkus,
        lastSync: lastSync?.lastSyncAt || null,
      },
    };
  });
}

export default productRoutes;
