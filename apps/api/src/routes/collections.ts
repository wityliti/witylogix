/**
 * Collections — grouped product collections with sorting and syncing.
 *
 * Routes:
 *   POST   /                    Create collection { title, description?, type?, sortOrder?, rules? }
 *   GET    /                    List collections { type?, page?, limit? }
 *   GET    /:id                 Get collection with products
 *   PUT    /:id                 Update collection
 *   DELETE /:id                 Delete collection
 *   POST   /:id/products        Add products { productIds[] }
 *   DELETE /:id/products        Remove products { productIds[] }
 *   PUT    /:id/products/reorder Reorder products { items: [{productId, position}] }
 *   POST   /sync                Sync collections from Shopify
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@witylogix/db";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
} from "../lib/errors.js";
import { getIntegrationQueue } from "../lib/queue.js";

// ─── Schemas ────────────────────────────────────────────────────

const createCollectionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(["MANUAL", "SMART", "FEATURED"]).optional().default("MANUAL"),
  sortOrder: z.enum(["MANUAL", "BEST_SELLING", "NEWEST", "ALPHABETICAL"]).optional().default("MANUAL"),
  rules: z.record(z.unknown()).optional(),
});

const updateCollectionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  type: z.enum(["MANUAL", "SMART", "FEATURED"]).optional(),
  sortOrder: z.enum(["MANUAL", "BEST_SELLING", "NEWEST", "ALPHABETICAL"]).optional(),
  rules: z.record(z.unknown()).optional(),
});

const addProductsSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1),
});

const removeProductsSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1),
});

const reorderProductsSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      position: z.number().int().positive(),
    }),
  ),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const listCollectionsQuery = paginationSchema.extend({
  type: z.enum(["MANUAL", "SMART", "FEATURED"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "title", "productCount"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Route Plugin ────────────────────────────────────────────────

async function collectionsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── POST / ──────────────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const body = createCollectionSchema.parse(request.body);

    const collection = await (request.tenantDb as any).collection.create({
      data: {
        shopId: request.shopId,
        title: body.title,
        description: body.description,
        type: body.type as any,
        sortOrder: body.sortOrder as any,
        rules: body.rules ? JSON.stringify(body.rules) : null,
        productCount: 0,
      },
    });

    fastify.log.info(
      { shopId: request.shopId, collectionId: collection.id, title: body.title },
      "Collection created",
    );

    reply.status(201);
    return {
      data: {
        ...collection,
        rules: collection.rules ? JSON.parse(collection.rules) : null,
      },
    };
  });

  // ── GET / ────────────────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listCollectionsQuery.parse(request.query);
    const { page, limit, type, search, sortBy, sortOrder } = query;

    const where: any = {
      shopId: request.shopId,
    };

    if (type) {
      where.type = type as any;
    }
    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }

    const [collections, total] = await Promise.all([
      (request.tenantDb as any).collection.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (request.tenantDb as any).collection.count({ where }),
    ]);

    const transformed = collections.map((col: any) => ({
      ...col,
      rules: col.rules ? JSON.parse(col.rules) : null,
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

    const collection = await (request.tenantDb as any).collection.findUnique({
      where: { id },
      include: {
        products: {
          include: { product: true },
          orderBy: { position: "asc" },
        },
      },
    });

    if (!collection) {
      throw new NotFoundError("Collection", id);
    }

    if (collection.shopId !== request.shopId) {
      throw new ForbiddenError("Cannot access collection from another shop");
    }

    return {
      data: {
        ...collection,
        rules: collection.rules ? JSON.parse(collection.rules) : null,
        products: collection.products.map((cp: any) => ({
          id: cp.product.id,
          title: cp.product.title,
          position: cp.position,
          shopifyProductId: cp.product.shopifyProductId,
        })),
      },
    };
  });

  // ── PUT /:id ─────────────────────────────────────────────────

  fastify.put("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };
    const body = updateCollectionSchema.parse(request.body);

    const collection = await (request.tenantDb as any).collection.findUnique({
      where: { id },
    });

    if (!collection) {
      throw new NotFoundError("Collection", id);
    }

    if (collection.shopId !== request.shopId) {
      throw new ForbiddenError("Cannot update collection from another shop");
    }

    const updated = await (request.tenantDb as any).collection.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        type: body.type as any,
        sortOrder: body.sortOrder as any,
        rules: body.rules ? JSON.stringify(body.rules) : undefined,
        updatedAt: new Date(),
      },
    });

    fastify.log.info(
      { shopId: request.shopId, collectionId: id },
      "Collection updated",
    );

    return {
      data: {
        ...updated,
        rules: updated.rules ? JSON.parse(updated.rules) : null,
      },
    };
  });

  // ── DELETE /:id ──────────────────────────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };

    const collection = await (request.tenantDb as any).collection.findUnique({
      where: { id },
    });

    if (!collection) {
      throw new NotFoundError("Collection", id);
    }

    if (collection.shopId !== request.shopId) {
      throw new ForbiddenError("Cannot delete collection from another shop");
    }

    // Delete collection and associated products
    await request.tenantDb.$transaction(async (tx) => {
      await (tx as any).collectionProduct.deleteMany({
        where: { collectionId: id },
      });
      await (tx as any).collection.delete({
        where: { id },
      });
    });

    fastify.log.info(
      { shopId: request.shopId, collectionId: id },
      "Collection deleted",
    );

    reply.status(204);
    return;
  });

  // ── POST /:id/products ───────────────────────────────────────

  fastify.post(
    "/:id/products",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };
      const { productIds } = addProductsSchema.parse(request.body);

      const collection = await (request.tenantDb as any).collection.findUnique({
        where: { id },
      });

      if (!collection) {
        throw new NotFoundError("Collection", id);
      }

      if (collection.shopId !== request.shopId) {
        throw new ForbiddenError("Cannot update collection from another shop");
      }

      // Verify products exist
      const products = await request.tenantDb.product.findMany({
        where: { id: { in: productIds }, shopId: request.shopId },
      });

      if (products.length !== productIds.length) {
        throw new ValidationError("Some products not found in this shop");
      }

      // Get max position
      const maxPosition = await (request.tenantDb as any).collectionProduct.findFirst({
        where: { collectionId: id },
        orderBy: { position: "desc" },
      });

      const startPosition = (maxPosition?.position ?? 0) + 1;

      // Add products to collection
      await (request.tenantDb as any).collectionProduct.createMany({
        data: productIds.map((productId, index) => ({
          collectionId: id,
          productId,
          position: startPosition + index,
        })),
      });

      // Update product count
      const newCount = await (request.tenantDb as any).collectionProduct.count({
        where: { collectionId: id },
      });

      await (request.tenantDb as any).collection.update({
        where: { id },
        data: { productCount: newCount },
      });

      fastify.log.info(
        { shopId: request.shopId, collectionId: id, productCount: productIds.length },
        "Products added to collection",
      );

      reply.status(201);
      return {
        message: `Added ${productIds.length} products to collection`,
        productCount: newCount,
      };
    },
  );

  // ── DELETE /:id/products ─────────────────────────────────────

  fastify.delete(
    "/:id/products",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };
      const { productIds } = removeProductsSchema.parse(request.body);

      const collection = await (request.tenantDb as any).collection.findUnique({
        where: { id },
      });

      if (!collection) {
        throw new NotFoundError("Collection", id);
      }

      if (collection.shopId !== request.shopId) {
        throw new ForbiddenError("Cannot update collection from another shop");
      }

      // Remove products
      await (request.tenantDb as any).collectionProduct.deleteMany({
        where: {
          collectionId: id,
          productId: { in: productIds },
        },
      });

      // Update product count
      const newCount = await (request.tenantDb as any).collectionProduct.count({
        where: { collectionId: id },
      });

      await (request.tenantDb as any).collection.update({
        where: { id },
        data: { productCount: newCount },
      });

      fastify.log.info(
        { shopId: request.shopId, collectionId: id, productCount: productIds.length },
        "Products removed from collection",
      );

      return {
        message: `Removed ${productIds.length} products from collection`,
        productCount: newCount,
      };
    },
  );

  // ── PUT /:id/products/reorder ────────────────────────────────

  fastify.put(
    "/:id/products/reorder",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };
      const { items } = reorderProductsSchema.parse(request.body);

      const collection = await (request.tenantDb as any).collection.findUnique({
        where: { id },
      });

      if (!collection) {
        throw new NotFoundError("Collection", id);
      }

      if (collection.shopId !== request.shopId) {
        throw new ForbiddenError("Cannot update collection from another shop");
      }

      // Update positions
      await Promise.all(
        items.map((item) =>
          (request.tenantDb as any).collectionProduct.update({
            where: {
              collectionId_productId: {
                collectionId: id,
                productId: item.productId,
              },
            },
            data: { position: item.position },
          }),
        ),
      );

      fastify.log.info(
        { shopId: request.shopId, collectionId: id, count: items.length },
        "Collection products reordered",
      );

      return { message: "Products reordered successfully" };
    },
  );

  // ── POST /sync ───────────────────────────────────────────────

  fastify.post(
    "/sync",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      // Mock Shopify sync — in production, this would call Shopify GraphQL API
      // to fetch collections and products, then sync to database

      fastify.log.info(
        { shopId: request.shopId },
        "Starting Shopify collections sync",
      );

      // Get shop's Shopify integration
      const shop = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
      });

      if (!shop || !shop.shopifyAccessToken) {
        throw new ValidationError("Shop not connected to Shopify or missing access token");
      }

      // Fetch Shopify collections via GraphQL API
      try {
        const shopifyDomain = shop.shopifyDomain || `${shop.id}.myshopify.com`;
        const graphqlUrl = `https://${shopifyDomain}/admin/api/2024-01/graphql.json`;

        // GraphQL query to fetch collections and their products
        const query = `
          query {
            collections(first: 100) {
              edges {
                node {
                  id
                  title
                  description
                  products(first: 50) {
                    edges {
                      node {
                        id
                        title
                        handle
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const response = await fetch(graphqlUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": shop.shopifyAccessToken,
          },
          body: JSON.stringify({ query }),
        });

        if (!response.ok) {
          throw new ValidationError(
            `Shopify API error: ${response.status} ${response.statusText}`,
          );
        }

        const data = await response.json() as any;

        if (data.errors) {
          throw new ValidationError(
            `Shopify GraphQL error: ${data.errors.map((e: any) => e.message).join(", ")}`,
          );
        }

        // Queue integration sync job to process collections asynchronously
        const queue = getIntegrationQueue();
        await queue.add(
          "sync",
          {
            shopId: request.shopId,
            appSlug: "shopify",
            integrationId: shop.id, // Use shop ID as integration ID for Shopify
            jobType: "sync",
            payload: {
              collections: data.data?.collections?.edges || [],
              shopifyDomain,
            },
          },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 3000 },
          },
        );

        fastify.log.info(
          { shopId: request.shopId, collectionsCount: data.data?.collections?.edges?.length },
          "Shopify collections sync job queued",
        );
      } catch (error) {
        fastify.log.error(
          { shopId: request.shopId, error },
          "Failed to fetch Shopify collections",
        );
        throw error;
      }

      reply.status(202);
      return {
        message: "Shopify collections sync started",
        status: "processing",
      };
    },
  );
}

export default collectionsRoutes;
