/**
 * Customers Cache Sync — Shopify customer data cached for fast lookups.
 *
 * Routes:
 *   GET    /              List customers (paginated, searchable by name/email/phone)
 *   GET    /stats         Customer stats (total, top spenders, avg order count)
 *   GET    /density       Customer density by city for map view
 *   GET    /:id           Get single customer with orders
 *   GET    /:id/orders    Get orders for a customer (join with Order table)
 *   POST   /sync          Bulk upsert customers
 *   DELETE /:id           Remove cached customer
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

// ─── City lookup for density map (lat/lng for major cities) ────────────────
// Used when PostGIS geometry is unavailable for order delivery_location.

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "New York": { lat: 40.7128, lng: -74.006 },
  "New York City": { lat: 40.7128, lng: -74.006 },
  "NYC": { lat: 40.7128, lng: -74.006 },
  "Los Angeles": { lat: 34.0522, lng: -118.2437 },
  "Chicago": { lat: 41.8781, lng: -87.6298 },
  "Houston": { lat: 29.7604, lng: -95.3698 },
  "Phoenix": { lat: 33.4484, lng: -112.074 },
  "Philadelphia": { lat: 39.9526, lng: -75.1652 },
  "San Antonio": { lat: 29.4241, lng: -98.4936 },
  "San Diego": { lat: 32.7157, lng: -117.1611 },
  "Dallas": { lat: 32.7767, lng: -96.797 },
  "San Francisco": { lat: 37.7749, lng: -122.4194 },
  "Austin": { lat: 30.2672, lng: -97.7431 },
  "Seattle": { lat: 47.6062, lng: -122.3321 },
  "Denver": { lat: 39.7392, lng: -104.9903 },
  "Boston": { lat: 42.3601, lng: -71.0589 },
  "Nashville": { lat: 36.1627, lng: -86.7816 },
  "Miami": { lat: 25.7617, lng: -80.1918 },
  "Atlanta": { lat: 33.749, lng: -84.388 },
  "Minneapolis": { lat: 44.9778, lng: -93.265 },
  "London": { lat: 51.5074, lng: -0.1278 },
  "Manchester": { lat: 53.4808, lng: -2.2426 },
  "Birmingham": { lat: 52.4862, lng: -1.8904 },
  "Glasgow": { lat: 55.8642, lng: -4.2518 },
  "Toronto": { lat: 43.6532, lng: -79.3832 },
  "Vancouver": { lat: 49.2827, lng: -123.1207 },
  "Montreal": { lat: 45.5017, lng: -73.5673 },
  "Calgary": { lat: 51.0447, lng: -114.0719 },
  "Sydney": { lat: -33.8688, lng: 151.2093 },
  "Melbourne": { lat: -37.8136, lng: 144.9631 },
  "Brisbane": { lat: -27.4698, lng: 153.0251 },
  "Perth": { lat: -31.9505, lng: 115.8605 },
  "Dublin": { lat: 53.3498, lng: -6.2603 },
  "Auckland": { lat: -36.8485, lng: 174.7633 },
  "Singapore": { lat: 1.3521, lng: 103.8198 },
  "Dubai": { lat: 25.2048, lng: 55.2708 },
  "Paris": { lat: 48.8566, lng: 2.3522 },
  "Berlin": { lat: 52.52, lng: 13.405 },
  "Amsterdam": { lat: 52.3676, lng: 4.9041 },
  "Madrid": { lat: 40.4168, lng: -3.7038 },
  "Rome": { lat: 41.9028, lng: 12.4964 },
  "Johannesburg": { lat: -26.2041, lng: 28.0473 },
  "Cape Town": { lat: -33.9249, lng: 18.4241 },
  "Lagos": { lat: 6.5244, lng: 3.3792 },
  "Nairobi": { lat: -1.2921, lng: 36.8219 },
  "Mumbai": { lat: 19.076, lng: 72.8777 },
  "Delhi": { lat: 28.6139, lng: 77.209 },
  "Bangalore": { lat: 12.9716, lng: 77.5946 },
  "Tokyo": { lat: 35.6762, lng: 139.6503 },
  "Seoul": { lat: 37.5665, lng: 126.978 },
  "Shanghai": { lat: 31.2304, lng: 121.4737 },
  "Beijing": { lat: 39.9042, lng: 116.4074 },
  "São Paulo": { lat: -23.5505, lng: -46.6333 },
  "Mexico City": { lat: 19.4326, lng: -99.1332 },
  "Buenos Aires": { lat: -34.6037, lng: -58.3816 },
};

function lookupCityCoords(city: string, _country?: string | null): { lat: number; lng: number } | null {
  if (!city) return null;
  // Exact match
  const exact = CITY_COORDS[city];
  if (exact) return exact;
  // Case-insensitive partial match
  const lower = city.toLowerCase();
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (k.toLowerCase() === lower || k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())) {
      return v;
    }
  }
  return null;
}

// ─── Helper: normalize DB customer → API shape ──────────────────────────────

function normalizeCustomer(c: Record<string, unknown>) {
  const firstName = (c.firstName as string | null) ?? "";
  const lastName = (c.lastName as string | null) ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ") || (c.email as string | null) || "Unknown";
  const ordersCount = (c.ordersCount as number | null) ?? 0;
  const totalSpent = Number(c.totalSpent ?? 0);

  // Synthesize tier from totalSpent
  const tier = totalSpent >= 1000 ? "enterprise" : totalSpent >= 200 ? "premium" : "standard";
  // Synthesize status: active if has orders or spent > 0
  const status = ordersCount > 0 || totalSpent > 0 ? "active" : "inactive";

  // Parse addresses from JSON blob
  let addresses: unknown[] = [];
  if (Array.isArray(c.addresses)) addresses = c.addresses;
  else if (typeof c.addresses === "string") {
    try { addresses = JSON.parse(c.addresses); } catch { /* ignore */ }
  }

  return {
    id: c.id,
    name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    status,
    tier,
    totalOrders: ordersCount,
    totalSpent,
    lastOrderDate: c.lastSyncAt ?? c.updatedAt ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    lastSyncAt: c.lastSyncAt ?? null,
    tags: c.tags ?? [],
    addresses,
    notes: c.notes ?? null,
    marketingConsent: c.marketingConsent ?? false,
    source: c.source ?? "SHOPIFY",
    externalCustomerId: c.externalCustomerId ?? null,
  };
}

// ─── Query Params Schemas ───────────────────────────────────────────────────

const listCustomersQuery = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  tier: z.enum(["standard", "premium", "enterprise"]).optional(),
  sortBy: z.enum(["name", "totalSpent", "totalOrders", "lastSyncAt"]).default("lastSyncAt"),
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

      // Map sortBy aliases to actual DB fields
      const dbSortBy =
        sortBy === "name" ? "firstName" :
        sortBy === "totalOrders" ? "ordersCount" :
        sortBy;

      const [customers, total] = await Promise.all([
        request.tenantDb.customer.findMany({
          where,
          orderBy: { [dbSortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        request.tenantDb.customer.count({ where }),
      ]);

      return {
        data: customers.map(normalizeCustomer),
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

    const customer = await request.tenantDb.customer.findUnique({
      where: { id },
    });

    if (!customer) throw new NotFoundError("Customer", id);
    if (customer.shopId !== request.shopId) throw new NotFoundError("Customer", id);

    // Fetch recent orders for this customer by email
    const recentOrders = customer.email
      ? await request.tenantDb.order.findMany({
          where: {
            shopId: request.shopId,
            customerEmail: customer.email,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            externalOrderNumber: true,
            status: true,
            totalPrice: true,
            city: true,
            country: true,
            deliveryDate: true,
            createdAt: true,
          },
        })
      : [];

    return {
      data: {
        ...normalizeCustomer(customer as unknown as Record<string, unknown>),
        recentOrders: recentOrders.map((o) => ({
          ...o,
          totalPrice: o.totalPrice ? Number(o.totalPrice) : null,
        })),
      },
    };
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
          shopifyCustomerId: `manual-${randomUUID()}`,
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
      const body = syncCustomersSchema.parse(request.body);
      const { customers: incoming } = body;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const synced = await request.tenantDb.$transaction(async (tx: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          incoming.map((c: any) =>
            tx.customer.upsert({
              where: {
                shopId_externalCustomerId_source: {
                  shopId: request.shopId,
                  externalCustomerId: c.externalId,
                  source: "SHOPIFY",
                },
              },
              update: {
                email: c.email,
                firstName: c.firstName,
                lastName: c.lastName,
                phone: c.phone,
                addresses: c.defaultAddress ? [c.defaultAddress] : Prisma.JsonNull,
                ordersCount: c.orderCount,
                totalSpent: c.totalSpent ? new Prisma.Decimal(c.totalSpent) : new Prisma.Decimal(0),
                lastSyncAt: new Date(),
              },
              create: {
                shopId: request.shopId,
                externalCustomerId: c.externalId,
                source: "SHOPIFY",
                email: c.email,
                firstName: c.firstName,
                lastName: c.lastName,
                phone: c.phone,
                addresses: c.defaultAddress ? [c.defaultAddress] : Prisma.JsonNull,
                ordersCount: c.orderCount,
                totalSpent: c.totalSpent ? new Prisma.Decimal(c.totalSpent) : new Prisma.Decimal(0),
              },
            }),
          ),
        );
      });

      reply.status(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { data: synced.map((c: any) => normalizeCustomer(c as unknown as Record<string, unknown>)), message: `Synced ${synced.length} customers` };
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
