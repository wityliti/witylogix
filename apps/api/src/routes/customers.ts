/**
 * Customers Cache Sync — Shopify customer data cached for fast lookups.
 *
 * Routes:
 *   GET    /              List customers (paginated, searchable)
 *   GET    /stats         Customer stats (must be before /:id)
 *   GET    /geo           Customer density aggregated by city (must be before /:id)
 *   GET    /:id           Get single customer
 *   GET    /:id/orders    Get orders for a customer
 *   POST   /sync          Bulk upsert customers
 *   DELETE /:id           Remove cached customer
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@witylogix/db";
import { ZodError } from "zod";
import { paginationSchema, syncCustomersSchema } from "@witylogix/validators";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError } from "../lib/errors.js";

// ─── Query Params Schema ────────────────────────────────────

const listCustomersQuery = paginationSchema.extend({
  search: z.string().optional(),
  sortBy: z.enum(["firstName", "email", "totalSpent", "lastSyncAt", "ordersCount"]).default("lastSyncAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const customerOrdersQuery = paginationSchema.extend({
  status: z.string().optional(),
  sortBy: z.enum(["createdAt", "totalPrice"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Route Plugin ───────────────────────────────────────────

async function customerRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST CUSTOMERS ────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = listCustomersQuery.parse(request.query);
      const { page, limit, search, sortBy, sortOrder } = query;

      const where: Prisma.CustomerWhereInput = {
        shopId: request.shopId,
      };

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { externalCustomerId: { contains: search, mode: "insensitive" } },
        ];
      }

      const [customers, total] = await Promise.all([
        request.tenantDb.customer.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        request.tenantDb.customer.count({ where }),
      ]);

      return {
        data: customers,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid query parameters", details: err.errors },
        });
      }
      throw err;
    }
  });

  // ── CUSTOMER STATS (before /:id) ──────────────────────────

  fastify.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const total = await request.tenantDb.customer.count({
        where: { shopId: request.shopId },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const syncedToday = await request.tenantDb.customer.count({
        where: {
          shopId: request.shopId,
          lastSyncAt: { gte: today },
        },
      });

      const topSpenders = await request.tenantDb.customer.findMany({
        where: { shopId: request.shopId },
        orderBy: { totalSpent: "desc" },
        take: 10,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          totalSpent: true,
          ordersCount: true,
        },
      });

      const agg = await request.tenantDb.customer.aggregate({
        where: { shopId: request.shopId },
        _avg: { ordersCount: true },
        _sum: { totalSpent: true },
        _max: { totalSpent: true },
      });

      const lastSync = await request.tenantDb.customer.findFirst({
        where: { shopId: request.shopId },
        orderBy: { lastSyncAt: "desc" },
        select: { lastSyncAt: true },
      });

      // Customers active in last 30 days (recently synced)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentlyActive = await request.tenantDb.customer.count({
        where: {
          shopId: request.shopId,
          lastSyncAt: { gte: thirtyDaysAgo },
        },
      });

      return {
        data: {
          total,
          syncedToday,
          recentlyActive,
          topSpenders,
          avgOrderCount: agg._avg?.ordersCount ?? 0,
          totalRevenue: agg._sum?.totalSpent ?? new Prisma.Decimal(0),
          topSpent: agg._max?.totalSpent ?? new Prisma.Decimal(0),
          lastSync: lastSync?.lastSyncAt ?? null,
        },
      };
    } catch (err) {
      throw err;
    }
  });

  // ── CUSTOMER GEO — density by city (before /:id) ──────────

  fastify.get("/geo", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Aggregate order delivery cities for customers in this shop.
      // Groups by city+province+country, counts distinct customer emails.
      const rows = await request.tenantDb.order.groupBy({
        by: ["city", "province", "country"],
        where: {
          shopId: request.shopId,
          city: { not: null },
          deliveryLocation: { not: null },
        },
        _count: { customerEmail: true },
      });

      // Also pull a sample deliveryLocation per city for lat/lng
      const cityLocations: Array<{
        city: string;
        province: string | null;
        country: string | null;
        count: number;
        lat: number | null;
        lng: number | null;
      }> = [];

      for (const row of rows) {
        if (!row.city) continue;
        // Get a sample order from this city to extract lat/lng
        const sample = await request.tenantDb.order.findFirst({
          where: {
            shopId: request.shopId,
            city: row.city,
            province: row.province,
            country: row.country,
            deliveryLocation: { not: null },
          },
          select: { deliveryLocation: true },
        });

        let lat: number | null = null;
        let lng: number | null = null;

        if (sample?.deliveryLocation && typeof sample.deliveryLocation === "object") {
          const loc = sample.deliveryLocation as Record<string, unknown>;
          lat = typeof loc.lat === "number" ? loc.lat : typeof loc.latitude === "number" ? loc.latitude : null;
          lng = typeof loc.lng === "number" ? loc.lng : typeof loc.longitude === "number" ? loc.longitude : null;
        }

        cityLocations.push({
          city: row.city,
          province: row.province,
          country: row.country,
          count: row._count.customerEmail,
          lat,
          lng,
        });
      }

      return { data: cityLocations.filter((r) => r.lat !== null && r.lng !== null) };
    } catch (err) {
      throw err;
    }
  });

  // ── GET SINGLE CUSTOMER ────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const customer = await request.tenantDb.customer.findUnique({
        where: { id },
      });

      if (!customer) throw new NotFoundError("Customer", id);
      if (customer.shopId !== request.shopId) {
        throw new NotFoundError("Customer", id);
      }

      return { data: customer };
    } catch (err) {
      throw err;
    }
  });

  // ── GET CUSTOMER ORDERS ────────────────────────────────────

  fastify.get("/:id/orders", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const query = customerOrdersQuery.parse(request.query);
      const { page, limit, status, sortBy, sortOrder } = query;

      const customer = await request.tenantDb.customer.findUnique({
        where: { id },
      });

      if (!customer) throw new NotFoundError("Customer", id);
      if (customer.shopId !== request.shopId) {
        throw new NotFoundError("Customer", id);
      }

      const where: Prisma.OrderWhereInput = {
        shopId: request.shopId,
        ...(customer.email ? { customerEmail: customer.email } : {}),
      };

      if (status) {
        where.status = status as Prisma.EnumOrderStatusFilter;
      }

      const [orders, total] = await Promise.all([
        request.tenantDb.order.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            externalOrderNumber: true,
            status: true,
            totalPrice: true,
            itemCount: true,
            city: true,
            deliveryDate: true,
            actualDelivery: true,
            createdAt: true,
            driver: { select: { id: true, name: true } },
          },
        }),
        request.tenantDb.order.count({ where }),
      ]);

      return {
        data: { customer, orders },
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid query parameters", details: err.errors },
        });
      }
      throw err;
    }
  });

  // ── SYNC CUSTOMERS (UPSERT) ────────────────────────────────

  fastify.post("/sync", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = syncCustomersSchema.parse(request.body);
      const { customers: incomingCustomers } = body;

      const synced = await request.tenantDb.$transaction(async (tx) => {
        const results = await Promise.all(
          incomingCustomers.map((customer) =>
            tx.customer.upsert({
              where: {
                shopId_externalCustomerId_source: {
                  shopId: request.shopId,
                  externalCustomerId: customer.externalId,
                  source: "SHOPIFY",
                },
              },
              update: {
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone,
                addresses: customer.defaultAddress ?? [],
                ordersCount: customer.orderCount,
                totalSpent: customer.totalSpent
                  ? new Prisma.Decimal(customer.totalSpent)
                  : new Prisma.Decimal(0),
                lastSyncAt: new Date(),
              },
              create: {
                shopId: request.shopId,
                externalCustomerId: customer.externalId,
                source: "SHOPIFY",
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone,
                addresses: customer.defaultAddress ?? [],
                ordersCount: customer.orderCount,
                totalSpent: customer.totalSpent
                  ? new Prisma.Decimal(customer.totalSpent)
                  : new Prisma.Decimal(0),
              },
            }),
          ),
        );
        return results;
      });

      reply.status(200);
      return {
        data: synced,
        message: `Synced ${synced.length} customers`,
      };
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: err.errors },
        });
      }
      throw err;
    }
  });

  // ── DELETE CUSTOMER ────────────────────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const customer = await request.tenantDb.customer.findUnique({
        where: { id },
      });

      if (!customer) throw new NotFoundError("Customer", id);
      if (customer.shopId !== request.shopId) {
        throw new NotFoundError("Customer", id);
      }

      const deleted = await request.tenantDb.customer.delete({
        where: { id },
      });

      return { data: deleted };
    } catch (err) {
      throw err;
    }
  });
}

export default customerRoutes;
