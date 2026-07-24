/**
 * Customers Cache Sync — Shopify customer data cached for fast lookups.
 *
 * Routes:
 *   GET    /               List customers (paginated, searchable)
 *   GET    /stats          Aggregate stats
 *   GET    /locations      Customers with lat/lng extracted from addresses
 *   GET    /segment-stats  Tier + geo breakdown for segments page
 *   GET    /:id            Single customer
 *   GET    /:id/orders     Orders for a customer
 *   POST   /sync           Bulk upsert customers
 *   DELETE /:id            Remove cached customer
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@witylogix/db";
import { ZodError } from "zod";
import { paginationSchema, syncCustomersSchema } from "@witylogix/validators";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError } from "../lib/errors.js";

// ─── Helpers ────────────────────────────────────────────────

interface ShopifyAddress {
  id?: number;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  country?: string;
  zip?: string;
  latitude?: number | string;
  longitude?: number | string;
  default?: boolean;
}

function parseAddresses(raw: Prisma.JsonValue): ShopifyAddress[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ShopifyAddress[];
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function deriveTier(totalSpent: Prisma.Decimal | number): "enterprise" | "premium" | "standard" {
  const n = Number(totalSpent);
  if (n >= 5000) return "enterprise";
  if (n >= 1000) return "premium";
  return "standard";
}

function deriveStatus(ordersCount: number): "active" | "inactive" {
  return ordersCount > 0 ? "active" : "inactive";
}

function normalizeName(firstName: string | null, lastName: string | null, email: string | null): string {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  return full || email || "Unknown";
}

function normalizeCustomer(c: {
  id: string;
  shopId: string;
  externalCustomerId: string;
  source: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  ordersCount: number;
  totalSpent: Prisma.Decimal;
  tags: string[];
  addresses: Prisma.JsonValue;
  marketingConsent: boolean;
  notes: string | null;
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  const addresses = parseAddresses(c.addresses);
  return {
    ...c,
    totalSpent: Number(c.totalSpent),
    addresses,
    name: normalizeName(c.firstName, c.lastName, c.email),
    totalOrders: c.ordersCount,
    tier: deriveTier(c.totalSpent),
    status: deriveStatus(c.ordersCount),
  };
}

// ─── Query Params Schema ────────────────────────────────────

const listCustomersQuery = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  tier: z.enum(["standard", "premium", "enterprise"]).optional(),
  sortBy: z.enum(["firstName", "email", "totalSpent", "lastSyncAt", "ordersCount"]).default("lastSyncAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const customerOrdersQuery = paginationSchema.extend({
  status: z.string().optional(),
  sortBy: z.enum(["createdAt", "totalPrice"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Route Plugin ───────────────────────────────────────────────────────────

async function customerRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── CUSTOMER STATS ─────────────────────────────────────────────────────────
  // NOTE: /stats must be registered BEFORE /:id to avoid Fastify matching "stats" as an ID

  fastify.get("/stats", async (request: FastifyRequest, _reply: FastifyReply) => {
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

    const aggStats = await request.tenantDb.customer.aggregate({
      where: { shopId: request.shopId },
      _avg: { ordersCount: true },
      _sum: { totalSpent: true },
    });

    const lastSync = await request.tenantDb.customer.findFirst({
      where: { shopId: request.shopId },
      orderBy: { lastSyncAt: "desc" },
      select: { lastSyncAt: true },
    });

    // Tier breakdown
    const customers = await request.tenantDb.customer.findMany({
      where: { shopId: request.shopId },
      select: { totalSpent: true, ordersCount: true },
    });

    let standard = 0, premium = 0, enterprise = 0;
    let active = 0, inactive = 0;
    for (const c of customers) {
      const spent = Number(c.totalSpent ?? 0);
      const orders = c.ordersCount ?? 0;
      if (spent >= 1000) enterprise++;
      else if (spent >= 200) premium++;
      else standard++;
      if (orders > 0 || spent > 0) active++;
      else inactive++;
    }

    return {
      data: {
        total,
        syncedToday,
        active,
        inactive,
        tiers: { standard, premium, enterprise },
        topSpenders: topSpenders.map((c) => ({
          ...c,
          name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "Unknown",
          totalSpent: Number(c.totalSpent ?? 0),
        })),
        avgOrderCount: aggStats._avg?.ordersCount ?? 0,
        totalRevenue: Number(aggStats._sum?.totalSpent ?? 0),
        lastSync: lastSync?.lastSyncAt ?? null,
      },
    };
  });

  // ── CUSTOMER DENSITY (for map) ─────────────────────────────────────────────

  fastify.get("/density", async (request: FastifyRequest, _reply: FastifyReply) => {
    // Group orders by city/country and count distinct customer emails
    const rows = await request.tenantDb.$queryRaw<
      { city: string; country: string | null; customer_count: bigint; order_count: bigint }[]
    >`
      SELECT
        city,
        country,
        COUNT(DISTINCT customer_email)::bigint AS customer_count,
        COUNT(*)::bigint AS order_count
      FROM orders
      WHERE shop_id = ${request.shopId}::uuid
        AND city IS NOT NULL
        AND city != ''
      GROUP BY city, country
      ORDER BY customer_count DESC
      LIMIT 50
    `;

    const points = rows
      .map((r) => {
        const coords = lookupCityCoords(r.city, r.country);
        return {
          city: r.city,
          country: r.country ?? null,
          customerCount: Number(r.customer_count),
          orderCount: Number(r.order_count),
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        };
      })
      .filter((p) => p.lat !== null && p.lng !== null);

    return { data: points };
  });

  // ── LIST CUSTOMERS ─────────────────────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = listCustomersQuery.parse(request.query);
      const { page, limit, search, tier, status, sortBy, sortOrder } = query;

      const where: Prisma.CustomerWhereInput = { shopId: request.shopId };

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { externalCustomerId: { contains: search, mode: "insensitive" } },
        ];
      }

      // Tier and status are derived fields — filter after fetching (with larger limit)
      // For large datasets this would be a DB-side computed column, but addresses it in app layer here
      const fetchLimit = (tier || status) ? Math.max(limit * 20, 500) : limit;
      const fetchSkip = (tier || status) ? 0 : (page - 1) * limit;

      const allMatching = await request.tenantDb.customer.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: fetchSkip,
        take: fetchLimit,
      });

      let normalized = allMatching.map(normalizeCustomer);

      if (tier) normalized = normalized.filter((c) => c.tier === tier);
      if (status) normalized = normalized.filter((c) => c.status === status);

      const total = (tier || status)
        ? normalized.length
        : await request.tenantDb.customer.count({ where });

      const paged = (tier || status)
        ? normalized.slice((page - 1) * limit, page * limit)
        : normalized;

      return {
        data: paged,
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

  // ── GET SINGLE CUSTOMER ────────────────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const customer = await request.tenantDb.customer.findUnique({ where: { id } });

    if (!customer) throw new NotFoundError("Customer", id);
    if (customer.shopId !== request.shopId) throw new NotFoundError("Customer", id);

    return { data: normalizeCustomer(customer) };
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

  // ── CREATE CUSTOMER (manual, dashboard) ────────────────────
  // Shopify customers arrive via POST /sync. Dashboard-entered customers
  // go through this endpoint, which generates a synthetic shopifyCustomerId
  // ("manual-<uuid>") to satisfy the shopId+shopifyCustomerId unique key.

  const createCustomerSchema = z.object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().email(),
    phone: z.string().trim().min(1).max(40).optional(),
  });

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createCustomerSchema.parse(request.body);

      const created = await request.tenantDb.customer.create({
        data: {
          shopId: request.shopId,
          externalCustomerId: `manual-${randomUUID()}`,
          source: "MANUAL",
          email: body.email,
          firstName: body.firstName ?? null,
          lastName: body.lastName ?? null,
          phone: body.phone ?? null,
          ordersCount: 0,
          totalSpent: new Prisma.Decimal(0),
          lastSyncAt: new Date(),
        },
      });

      await request.tenantRedis?.invalidateGroup?.("customers");
      reply.status(201);
      return { data: created };
    } catch (err) {
      if (err instanceof ZodError) {
        reply.status(422);
        return {
          statusCode: 422,
          error: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: err.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
            code: i.code,
          })),
        };
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

      const customer = await request.tenantDb.customer.findUnique({ where: { id } });
      if (!customer) throw new NotFoundError("Customer", id);
      if (customer.shopId !== request.shopId) throw new NotFoundError("Customer", id);

      const where: Prisma.OrderWhereInput = {
        shopId: request.shopId,
        ...(customer.email ? { customerEmail: customer.email } : {}),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (status) where.status = status as any;

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
        data: {
          customer: normalizeCustomer(customer as unknown as Record<string, unknown>),
          orders: orders.map((o) => ({
            ...o,
            totalPrice: o.totalPrice ? Number(o.totalPrice) : null,
          })),
        },
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

  // ── SYNC CUSTOMERS (UPSERT) ────────────────────────────────────────────────

  fastify.post("/sync", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const shopId = request.shopId;
      const now = new Date();
      const today = new Date(now); today.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
      const sixtyDaysAgo = new Date(now); sixtyDaysAgo.setDate(now.getDate() - 60);

      const [total, totalPrev, syncedToday, topSpenders, stats, lastSync] = await Promise.all([
        request.tenantDb.customer.count({ where: { shopId } }),
        request.tenantDb.customer.count({ where: { shopId, createdAt: { lt: thirtyDaysAgo } } }),
        request.tenantDb.customer.count({ where: { shopId, lastSyncAt: { gte: today } } }),
        request.tenantDb.customer.findMany({
          where: { shopId },
          orderBy: { totalSpent: "desc" },
          take: 5,
          select: { id: true, firstName: true, lastName: true, email: true, totalSpent: true, ordersCount: true },
        }),
        request.tenantDb.customer.aggregate({
          where: { shopId },
          _avg: { ordersCount: true },
          _sum: { totalSpent: true },
          _max: { totalSpent: true },
        }),
        request.tenantDb.customer.findFirst({
          where: { shopId },
          orderBy: { lastSyncAt: "desc" },
          select: { lastSyncAt: true },
        }),
      ]);

      const activeCount = await request.tenantDb.customer.count({
        where: { shopId, ordersCount: { gt: 0 } },
      });

      return {
        data: {
          total,
          totalPrev,
          activeCount,
          syncedToday,
          topSpenders: topSpenders.map((c) => ({
            ...c,
            totalSpent: Number(c.totalSpent),
            name: normalizeName(c.firstName, c.lastName, c.email),
          })),
          avgOrderCount: stats._avg?.ordersCount ?? 0,
          totalRevenue: Number(stats._sum?.totalSpent ?? 0),
          topSpenderAmount: Number(stats._max?.totalSpent ?? 0),
          lastSync: lastSync?.lastSyncAt ?? null,
        },
      };
    } catch (err) {
      throw err;
    }
  });

  // ── CUSTOMER LOCATIONS (for map) ──────────────────────────

  fastify.get("/locations", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const customers = await request.tenantDb.customer.findMany({
        where: { shopId: request.shopId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          ordersCount: true,
          totalSpent: true,
          addresses: true,
        },
        take: 2000,
      });

      const locations: Array<{
        id: string;
        name: string;
        lat: number;
        lng: number;
        city: string;
        country: string;
        totalOrders: number;
        totalSpent: number;
        tier: "standard" | "premium" | "enterprise";
      }> = [];

      for (const c of customers) {
        const addrs = parseAddresses(c.addresses);
        const primaryAddr = addrs.find((a) => a.default) ?? addrs[0];
        if (!primaryAddr) continue;

        const lat = Number(primaryAddr.latitude);
        const lng = Number(primaryAddr.longitude);
        if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) continue;

        locations.push({
          id: c.id,
          name: normalizeName(c.firstName, c.lastName, c.email),
          lat,
          lng,
          city: primaryAddr.city ?? "",
          country: primaryAddr.country ?? "",
          totalOrders: c.ordersCount,
          totalSpent: Number(c.totalSpent),
          tier: deriveTier(c.totalSpent),
        });
      }

      return { data: locations };
    } catch (err) {
      throw err;
    }
  });

  // ── SEGMENT STATS ─────────────────────────────────────────

  fastify.get("/segment-stats", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const allCustomers = await request.tenantDb.customer.findMany({
        where: { shopId: request.shopId },
        select: { ordersCount: true, totalSpent: true, addresses: true, tags: true },
        take: 10000,
      });

      const tiers: Record<string, { count: number; totalSpent: number; totalOrders: number }> = {
        enterprise: { count: 0, totalSpent: 0, totalOrders: 0 },
        premium: { count: 0, totalSpent: 0, totalOrders: 0 },
        standard: { count: 0, totalSpent: 0, totalOrders: 0 },
      };
      const statuses = { active: 0, inactive: 0 };
      const geoBuckets: Record<string, { count: number; totalSpent: number; avgOrders: number; orders: number }> = {};

      for (const c of allCustomers) {
        const spent = Number(c.totalSpent);
        const tier = deriveTier(c.totalSpent);
        tiers[tier].count++;
        tiers[tier].totalSpent += spent;
        tiers[tier].totalOrders += c.ordersCount;

        if (c.ordersCount > 0) statuses.active++; else statuses.inactive++;

        const addrs = parseAddresses(c.addresses);
        const primaryAddr = addrs[0];
        if (primaryAddr?.city) {
          const key = `${primaryAddr.city}${primaryAddr.country ? `, ${primaryAddr.country}` : ""}`;
          if (!geoBuckets[key]) geoBuckets[key] = { count: 0, totalSpent: 0, avgOrders: 0, orders: 0 };
          geoBuckets[key].count++;
          geoBuckets[key].totalSpent += spent;
          geoBuckets[key].orders += c.ordersCount;
        }
      }

      const topCities = Object.entries(geoBuckets)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 15)
        .map(([city, s]) => ({ city, count: s.count, totalSpent: s.totalSpent, avgOrders: s.orders / s.count }));

      return {
        data: {
          total: allCustomers.length,
          tiers,
          statuses,
          topCities,
        },
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

  // ── DELETE CUSTOMER ────────────────────────────────────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const customer = await request.tenantDb.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundError("Customer", id);
    if (customer.shopId !== request.shopId) throw new NotFoundError("Customer", id);

    const deleted = await request.tenantDb.customer.delete({ where: { id } });
    return { data: normalizeCustomer(deleted as unknown as Record<string, unknown>) };
  });
}

export default customerRoutes;
