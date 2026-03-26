/**
 * Customers Cache Sync — Shopify customer data cached for fast lookups.
 *
 * This cache syncs customer data from Shopify webhooks or manual sync operations.
 * Enables fast order-to-customer relationship lookups during shipment creation.
 *
 * Routes:
 *   GET    /              List customers (paginated, searchable by name/email/phone)
 *   GET    /:id           Get single customer
 *   POST   /sync          Bulk upsert customers
 *   DELETE /:id           Remove cached customer
 *   GET    /stats         Customer stats (total, top spenders, avg order count)
 *   GET    /:id/orders    Get orders for a customer (join with Order table)
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
  sortBy: z.enum(["firstName", "email", "totalSpent", "lastSyncAt"]).default("lastSyncAt"),
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
          { shopifyCustomerId: { contains: search, mode: "insensitive" } },
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

  // ── SYNC CUSTOMERS (UPSERT) ────────────────────────────────

  fastify.post("/sync", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = syncCustomersSchema.parse(request.body);
      const { customers: incomingCustomers } = body;

      // Upsert all customers in a transaction
      const synced = await request.tenantDb.$transaction(async (tx) => {
        const results = await Promise.all(
          incomingCustomers.map((customer) =>
            tx.customer.upsert({
              where: {
                // Unique constraint: shopId + shopifyCustomerId
                shopId_shopifyCustomerId: {
                  shopId: request.shopId,
                  shopifyCustomerId: customer.externalId,
                },
              },
              update: {
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone,
                addresses: customer.defaultAddress,
                ordersCount: customer.orderCount,
                totalSpent: customer.totalSpent
                  ? new Prisma.Decimal(customer.totalSpent)
                  : new Prisma.Decimal(0),
                lastSyncAt: new Date(),
              },
              create: {
                shopId: request.shopId,
                shopifyCustomerId: customer.externalId,
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone,
                addresses: customer.defaultAddress,
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

  // ── GET CUSTOMER ORDERS ────────────────────────────────────

  fastify.get("/:id/orders", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const query = customerOrdersQuery.parse(request.query);
      const { page, limit, status, sortBy, sortOrder } = query;

      // Verify customer exists and belongs to tenant
      const customer = await request.tenantDb.customer.findUnique({
        where: { id },
      });

      if (!customer) throw new NotFoundError("Customer", id);
      if (customer.shopId !== request.shopId) {
        throw new NotFoundError("Customer", id);
      }

      // Build where clause for orders
      // Since customers and orders have no direct relation in the schema,
      // we'll filter by customer email or external ID in order metadata or notes
      const where: Prisma.OrderWhereInput = {
        shopId: request.shopId,
        OR: [
          { customerEmail: customer.email || undefined },
        ].filter((condition) => Object.values(condition).some((v) => v !== undefined)),
      };

      if (status) {
        where.status = status as any;
      }

      const [orders, total] = await Promise.all([
        request.tenantDb.order.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            driver: { select: { id: true, name: true } },
            timeSlot: { select: { id: true, name: true } },
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

  // ── CUSTOMER STATS ────────────────────────────────────────

  fastify.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Total customers
      const total = await request.tenantDb.customer.count({
        where: { shopId: request.shopId },
      });

      // Customers synced today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const syncedToday = await request.tenantDb.customer.count({
        where: {
          shopId: request.shopId,
          lastSyncAt: { gte: today },
        },
      });

      // Top spenders
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
        },
      });

      // Average order count
      const stats = await request.tenantDb.customer.aggregate({
        where: { shopId: request.shopId },
        _avg: { ordersCount: true },
        _sum: { totalSpent: true },
      });

      // Last sync timestamp
      const lastSync = await request.tenantDb.customer.findFirst({
        where: { shopId: request.shopId },
        orderBy: { lastSyncAt: "desc" },
        select: { lastSyncAt: true },
      });

      return {
        data: {
          total,
          syncedToday,
          topSpenders,
          avgOrderCount: stats._avg?.ordersCount || 0,
          totalRevenue: stats._sum?.totalSpent || new Prisma.Decimal(0),
          lastSync: lastSync?.lastSyncAt || null,
        },
      };
    } catch (err) {
      throw err;
    }
  });
}

export default customerRoutes;
