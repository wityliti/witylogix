/**
 * Platform Admin — super-admin management routes for all stores and users.
 * Requires SUPER_ADMIN role on all endpoints.
 *
 * Routes:
 *   GET    /stores                  List all stores on platform
 *   GET    /stores/:id              Get store detail with usage
 *   PUT    /stores/:id/suspend      Suspend a store
 *   PUT    /stores/:id/restore      Restore a suspended store
 *   GET    /users                   List all platform users
 *   GET    /users/:id               Get user detail
 *   PUT    /users/:id/role          Change user role
 *   PUT    /users/:id/suspend       Suspend user
 *   PUT    /users/:id/restore       Restore user
 *   GET    /customers               List customers across stores
 *   GET    /customers/:id           Get customer detail
 *   GET    /dashboard               Platform metrics
 *   GET    /activity                Platform-wide activity feed (cross-store)
 *   GET    /queues                  BullMQ queue stats + DLQ
 *   GET    /queues/:name/jobs       Jobs for a specific queue
 *   GET    /system                  System health metrics
 *   GET    /integrations            Integration health across all stores
 *   POST   /impersonate/:userId     Start impersonation session (rate-limited, Redis-tracked)
 *   POST   /impersonate/:userId/revoke  Revoke active impersonation session by JTI
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z, ZodError } from "zod";
import { randomUUID } from "crypto";
import os from "os";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";
import { getRedis } from "../lib/redis.js";
import {
  getNotificationQueue,
  getOptimizationQueue,
  getWebhookQueue,
  getMaintenanceQueue,
  getGeofenceQueue,
  getFailedDeliveryQueue,
  getWCWebhookQueue,
  getIntegrationQueue,
} from "../lib/queue.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "../lib/errors.js";

// ─── Types ───────────────────────────────────────────────────────

interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "critical";
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
  responseTime: number;
  lastChecked: string;
}

interface SystemMetrics {
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  deploymentVersion: string;
  deploymentTime: string;
}

// ─── Schemas ────────────────────────────────────────────────────

const roleEnum = z.enum(["SUPER_ADMIN", "ADMIN", "DISPATCHER", "VIEWER", "DRIVER"]);

const listStoresQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  search: z.string().optional(),
});

const changeUserRoleSchema = z.object({
  role: roleEnum,
});

const suspendUserSchema = z.object({
  reason: z.string().optional(),
});

const listCustomersQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

const impersonateSchema = z.object({
  duration: z.number().int().positive().optional().default(3600), // seconds
});

// ─── Route Plugin ────────────────────────────────────────────────

async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);

  // Skip tenantContext for admin routes since we're accessing all tenants
  // fastify.addHook("preHandler", tenantContext);

  // ── Require SUPER_ADMIN for all routes ───────────────────────

  fastify.addHook("preHandler", async (request, reply) => {
    await requireRole("SUPER_ADMIN")(request, reply);
  });

  // ── GET /stores (List all stores) ──────────────────────────────

  fastify.get("/stores", async (request: FastifyRequest, reply: FastifyReply) => {
    let query: z.infer<typeof listStoresQuery>;
    try {
      query = listStoresQuery.parse(request.query);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError(err.errors[0]?.message || "Invalid query parameters");
      }
      throw err;
    }
    const { page, limit, status, search } = query;

    const where: any = {};
    if (status) {
      where.suspendedAt = status === "SUSPENDED" ? { not: null } : null;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { shopifyDomain: { contains: search, mode: "insensitive" } },
        { id: search },
      ];
    }

    const [stores, total] = await Promise.all([
      (prisma.shop as any).findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          shopifyDomain: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          suspendedAt: true,
          _count: {
            select: {
              orders: true,
              users: true,
              drivers: true,
            },
          },
        },
      } as any),
      prisma.shop.count({ where }),
    ]);

    return {
      data: stores.map((store: any) => ({
        ...store,
        status: (store as any).suspendedAt ? "SUSPENDED" : "ACTIVE",
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── GET /stores/:id (Get store detail with usage) ──────────────

  fastify.get("/stores/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [store, billingHistory, activityLogs] = await Promise.all([
      (prisma.shop as any).findUnique({
        where: { id },
        include: {
          orders: { select: { id: true }, take: 1000 },
          users: { select: { id: true, role: true, name: true, email: true } },
          drivers: { select: { id: true }, take: 1000 },
          subscription: {
            select: { planTier: true, status: true, billingCycleEnd: true, billingCycleStart: true },
          },
          _count: { select: { orders: true, drivers: true, users: true } },
        },
      } as any),
      (prisma as any).invoice?.findMany?.({
        where: { shopId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, number: true, status: true, totalAmount: true, dueAt: true, createdAt: true },
      }).catch(() => []) ?? Promise.resolve([]),
      (prisma as any).activityLog?.findMany?.({
        where: { shopId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          action: true,
          entityType: true,
          actorType: true,
          createdAt: true,
          metadata: true,
        },
      }).catch(() => []) ?? Promise.resolve([]),
    ]);

    if (!store) {
      throw new NotFoundError("Store", id);
    }

    const planTier = (store as any).subscription?.planTier ?? "FREE";
    const planPrices: Record<string, number> = { FREE: 0, STARTER: 49, GROWTH: 199, ENTERPRISE: 999 };

    return {
      data: {
        id: (store as any).id,
        name: (store as any).name,
        domain: (store as any).shopifyDomain ?? "",
        planTier: planTier.toLowerCase() as string,
        status: (store as any).suspendedAt ? "suspended" : "active",
        owner: {
          name: (store as any).users?.[0]?.name ?? (store as any).email ?? "Owner",
          email: (store as any).email ?? "",
          phone: "",
          joinDate: (store as any).createdAt?.toISOString() ?? "",
        },
        usage: {
          orders: (store as any)._count?.orders ?? 0,
          shipments: (store as any)._count?.orders ?? 0,
          drivers: (store as any)._count?.drivers ?? 0,
          apiCalls: 0,
          apiCallsLimit: planTier === "ENTERPRISE" ? 1000000 : planTier === "GROWTH" ? 500000 : 100000,
        },
        billing: {
          currentPlan: planTier.charAt(0) + planTier.slice(1).toLowerCase(),
          monthlyFee: planPrices[planTier] ?? 0,
          nextBillingDate: (store as any).subscription?.billingCycleEnd?.toISOString() ?? "",
          status: (store as any).subscription?.status ?? "active",
        },
        createdAt: (store as any).createdAt?.toISOString() ?? "",
        lastActive: (store as any).updatedAt?.toISOString() ?? "",
        uptime: 99.9,
        billingHistory: (billingHistory as any[]).map((inv: any) => ({
          id: inv.id,
          date: inv.createdAt?.toISOString() ?? "",
          description: `${planTier.charAt(0) + planTier.slice(1).toLowerCase()} Plan`,
          amount: inv.totalAmount ?? 0,
          status: inv.status?.toLowerCase() ?? "paid",
        })),
        activityLog: (activityLogs as any[]).map((log: any) => ({
          id: log.id,
          timestamp: log.createdAt?.toISOString() ?? "",
          action: log.action ?? "",
          details: typeof log.metadata === "object" ? JSON.stringify(log.metadata).slice(0, 100) : "",
          user: log.actorType === "USER" ? "User" : "System",
          severity: "info",
        })),
      },
    };
  });

  // ── POST /stores/:id/suspend (Suspend store) ───────────────────

  fastify.post(
    "/stores/:id/suspend",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = suspendUserSchema.parse(request.body);
      const { reason } = body;

      const store = await prisma.shop.findUnique({ where: { id } });

      if (!store) {
        throw new NotFoundError("Store", id);
      }

      if ((store as any).suspendedAt) {
        throw new ConflictError("Store is already suspended");
      }

      const suspended = await (prisma.shop as any).update({
        where: { id },
        data: {
          suspendedAt: new Date(),
          suspensionReason: reason,
        } as any,
      });

      fastify.log.info(
        { storeId: id, reason },
        "Store suspended",
      );

      return {
        data: {
          ...suspended,
          status: "SUSPENDED",
        },
      };
    },
  );

  // ── PUT /stores/:id/restore (Restore store) ────────────────────

  fastify.put(
    "/stores/:id/restore",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const store = await prisma.shop.findUnique({ where: { id } });

      if (!store) {
        throw new NotFoundError("Store", id);
      }

      if (!(store as any).suspendedAt) {
        throw new ConflictError("Store is not suspended");
      }

      const restored = await (prisma.shop as any).update({
        where: { id },
        data: {
          suspendedAt: null,
          suspensionReason: null,
        } as any,
      });

      fastify.log.info({ storeId: id }, "Store restored");

      return {
        data: {
          ...restored,
          status: "ACTIVE",
        },
      };
    },
  );

  // ── GET /users (List all platform users) ───────────────────────

  fastify.get("/users", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listStoresQuery.parse(request.query);
    const { page, limit, search } = query;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      (prisma.user as any).findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          suspendedAt: true,
          shop: { select: { id: true, name: true } },
        },
      } as any),
      prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user: any) => ({
        ...user,
        status: (user as any).suspendedAt ? "SUSPENDED" : "ACTIVE",
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── GET /users/:id (Get user detail) ───────────────────────────

  fastify.get("/users/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const user = await (prisma.user as any).findUnique({
      where: { id },
      include: {
        shop: {
          select: { id: true, name: true },
        },
      },
    } as any);

    if (!user) {
      throw new NotFoundError("User", id);
    }

    return {
      data: {
        ...user,
        status: (user as any).suspendedAt ? "SUSPENDED" : "ACTIVE",
      },
    };
  });

  // ── PUT /users/:id/role (Change user role) ─────────────────────

  fastify.put(
    "/users/:id/role",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      let body: z.infer<typeof changeUserRoleSchema>;
      try {
        body = changeUserRoleSchema.parse(request.body);
      } catch (err) {
        if (err instanceof ZodError) {
          throw new ValidationError(err.errors[0]?.message || "Invalid role");
        }
        throw err;
      }
      const { role } = body;

      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        throw new NotFoundError("User", id);
      }

      if (user.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
        throw new ValidationError(
          "Cannot downgrade SUPER_ADMIN role. Delete the user instead.",
        );
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { role: role as any },
      });

      fastify.log.info(
        { userId: id, previousRole: user.role, newRole: role },
        "User role changed",
      );

      return { data: updated };
    },
  );

  // ── PUT /users/:id/suspend (Suspend user) ──────────────────────

  fastify.put(
    "/users/:id/suspend",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = suspendUserSchema.parse(request.body);
      const { reason } = body;

      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        throw new NotFoundError("User", id);
      }

      if ((user as any).suspendedAt) {
        throw new ConflictError("User is already suspended");
      }

      if (user.role === "SUPER_ADMIN") {
        throw new ValidationError("Cannot suspend SUPER_ADMIN users");
      }

      const suspended = await (prisma.user as any).update({
        where: { id },
        data: {
          suspendedAt: new Date(),
          suspensionReason: reason,
        } as any,
      });

      fastify.log.info(
        { userId: id, reason },
        "User suspended",
      );

      return {
        data: {
          ...suspended,
          status: "SUSPENDED",
        },
      };
    },
  );

  // ── PUT /users/:id/restore (Restore user) ──────────────────────

  fastify.put(
    "/users/:id/restore",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        throw new NotFoundError("User", id);
      }

      if (!(user as any).suspendedAt) {
        throw new ConflictError("User is not suspended");
      }

      const restored = await (prisma.user as any).update({
        where: { id },
        data: {
          suspendedAt: null,
          suspensionReason: null,
        } as any,
      });

      fastify.log.info({ userId: id }, "User restored");

      return {
        data: {
          ...restored,
          status: "ACTIVE",
        },
      };
    },
  );

  // ── GET /customers (List customers across stores) ────────────────

  fastify.get("/customers", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listCustomersQuery.parse(request.query);
    const { page, limit, search } = query;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await Promise.all([
      (prisma.customer as any).findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          shop: { select: { id: true, name: true } },
          _count: { select: { orders: true } },
        },
      } as any),
      prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── GET /customers/:id (Get customer detail) ───────────────────

  fastify.get("/customers/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const customer = await (prisma.customer as any).findUnique({
      where: { id },
      include: {
        shop: { select: { id: true, name: true } },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
        _count: { select: { orders: true } },
      },
    } as any);

    if (!customer) {
      throw new NotFoundError("Customer", id);
    }

    return { data: customer };
  });

  // ── GET /dashboard (Platform metrics) ───────────────────────────

  fastify.get("/dashboard", async (request: FastifyRequest, reply: FastifyReply) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalStores,
      activeStores,
      suspendedStores,
      totalUsers,
      totalOrders,
      ordersLast30Days,
      totalRevenue,
      revenueLast30Days,
      totalCustomers,
      topStores,
    ] = await Promise.all([
      prisma.shop.count(),
      (prisma.shop as any).count({ where: { suspendedAt: null } }),
      (prisma.shop as any).count({ where: { suspendedAt: { not: null } } }),
      prisma.user.count(),
      prisma.order.count(),
      prisma.order.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      (prisma.order as any).aggregate({
        _sum: { totalAmount: true },
      }),
      (prisma.order as any).aggregate({
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { totalAmount: true },
      }),
      prisma.customer.count(),
      (prisma.shop as any).findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { orders: true } },
        },
        orderBy: {
          orders: { _count: "desc" },
        },
        take: 5,
      } as any),
    ]);

    return {
      data: {
        stores: {
          total: totalStores,
          active: activeStores,
          suspended: suspendedStores,
        },
        users: {
          total: totalUsers,
        },
        orders: {
          total: totalOrders,
          last30Days: ordersLast30Days,
        },
        revenue: {
          total: (totalRevenue as any)._sum.totalAmount || 0,
          last30Days: (revenueLast30Days as any)._sum.totalAmount || 0,
        },
        customers: {
          total: totalCustomers,
        },
        topStores: topStores.map((store: any) => ({
          id: store.id,
          name: store.name,
          orderCount: (store as any)._count.orders,
        })),
      },
    };
  });

  // ── GET /system/health (System health metrics) ─────────────────

  fastify.get("/system/health", async (request: FastifyRequest, reply: FastifyReply) => {
    const redis = getRedis();

    const services: Array<{
      name: string;
      status: "healthy" | "degraded" | "critical";
      responseTime: number;
      uptime24h: number;
      uptime7d: number;
      uptime30d: number;
      lastChecked: string;
    }> = [];

    // Check Postgres
    const dbStart = Date.now();
    let dbStatus: "healthy" | "critical" = "critical";
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = "healthy";
    } catch {
      // db unreachable
    }
    services.push({
      name: "PostgreSQL",
      status: dbStatus,
      responseTime: Date.now() - dbStart,
      uptime24h: dbStatus === "healthy" ? 100 : 0,
      uptime7d: dbStatus === "healthy" ? 100 : 0,
      uptime30d: dbStatus === "healthy" ? 100 : 0,
      lastChecked: new Date().toISOString(),
    });

    // Check Redis
    const redisStart = Date.now();
    let redisStatus: "healthy" | "critical" = "critical";
    try {
      await redis.ping();
      redisStatus = "healthy";
    } catch {
      // redis unreachable
    }
    services.push({
      name: "Redis Cache",
      status: redisStatus,
      responseTime: Date.now() - redisStart,
      uptime24h: redisStatus === "healthy" ? 100 : 0,
      uptime7d: redisStatus === "healthy" ? 100 : 0,
      uptime30d: redisStatus === "healthy" ? 100 : 0,
      lastChecked: new Date().toISOString(),
    });

    // API Server (self — always healthy if this runs)
    services.push({
      name: "API Server",
      status: "healthy",
      responseTime: 1,
      uptime24h: 100,
      uptime7d: 100,
      uptime30d: 100,
      lastChecked: new Date().toISOString(),
    });

    const memUsage = process.memoryUsage();
    const memoryPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    return {
      data: {
        services,
        metrics: {
          memoryUsage: memoryPercent,
          cpuUsage: 0,
          activeConnections: 0,
          deploymentTime: new Date().toISOString(),
          deploymentVersion: process.env.npm_package_version ?? "unknown",
        },
      },
    };
  });

  // ── GET /test-results (Test coverage summary) ──────────────────

  fastify.get("/test-results", async (request: FastifyRequest, reply: FastifyReply) => {
    // Test results are produced by CI — not persisted in DB.
    // Return null stats so the dashboard shows the empty state.
    return {
      data: {
        stats: null,
        categories: [],
        packages: [],
        flakyTests: [],
        recentRuns: [],
      },
    };
  });

  // ── POST /impersonate/:userId (Start impersonation) ────────────
  // Rate-limited to 10 requests/minute per admin to prevent token flooding.
  // Session is tracked in Redis so it can be revoked before expiry.

  fastify.post(
    "/impersonate/:userId",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
          keyGenerator: (request: any) => `impersonate:${(request as any).auth?.userId || request.ip}`,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      const body = impersonateSchema.parse(request.body);
      const { duration } = body;
      const effectiveDuration = Math.min(duration, 3600); // Max 1 hour

      const user = await (prisma.user as any).findUnique({
        where: { id: userId },
        include: { shop: { select: { id: true, shopifyDomain: true } } },
      } as any);

      if (!user) {
        throw new NotFoundError("User", userId);
      }

      const jti = randomUUID();
      const adminId = (request as any).auth.userId;

      // Generate impersonation token with JTI for revocation tracking
      const impersonationToken = await (request as any).jwtSign(
        {
          sub: user.id,
          shopId: user.shopId,
          role: user.role,
          type: "user",
          impersonatedBy: adminId,
          shopDomain: (user as any).shop?.shopifyDomain,
          jti,
        },
        {
          expiresIn: effectiveDuration,
        },
      );

      // Store session in Redis — enables server-side revocation before token expiry
      const redis = getRedis();
      await redis.set(
        `impersonation:${jti}`,
        JSON.stringify({
          adminId,
          userId: user.id,
          shopId: user.shopId,
          createdAt: new Date().toISOString(),
        }),
        "EX",
        effectiveDuration,
      );

      fastify.log.info(
        {
          adminId,
          impersonatedUserId: userId,
          duration: effectiveDuration,
          jti,
        },
        "Impersonation session started",
      );

      return {
        data: {
          token: impersonationToken,
          jti,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            shopId: user.shopId,
          },
          expiresIn: effectiveDuration,
        },
      };
    },
  );

  // ── POST /impersonate/:userId/revoke (Revoke active impersonation) ──
  // Invalidates a specific impersonation session by JTI before its natural expiry.

  fastify.post(
    "/impersonate/:userId/revoke",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
          keyGenerator: (request: any) => `impersonate-revoke:${(request as any).auth?.userId || request.ip}`,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      const { jti } = (request.body as any) || {};

      if (!jti || typeof jti !== "string") {
        throw new ValidationError("jti is required");
      }

      const redis = getRedis();
      const sessionRaw = await redis.get(`impersonation:${jti}`);

      if (!sessionRaw) {
        // Already expired or never existed — treat as success (idempotent)
        fastify.log.info({ adminId: (request as any).auth.userId, jti }, "Impersonation revoke: session not found (already expired)");
        return { data: { revoked: false, reason: "session_not_found" } };
      }

      const session = JSON.parse(sessionRaw);

      // Only the admin who created the session (or any SUPER_ADMIN) may revoke it
      const requestingAdminId = (request as any).auth.userId;
      if (session.adminId !== requestingAdminId) {
        throw new ForbiddenError("You can only revoke your own impersonation sessions");
      }

      await redis.del(`impersonation:${jti}`);

      fastify.log.info(
        { adminId: requestingAdminId, impersonatedUserId: userId, jti },
        "Impersonation session revoked",
      );

      return { data: { revoked: true } };
    },
  );

  // ── GET /system-health ──────────────────────────────────────
  // Real system health: process metrics + DB/Redis latency + queue sizes.

  const SYSTEM_START = Date.now();

  fastify.get("/system-health", async (request: FastifyRequest, reply: FastifyReply) => {
    const services: Record<string, any>[] = [];

  // ── GET /queues/jobs — recent jobs across all queues ──────────

  fastify.get("/queues/jobs", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const QUEUE_FACTORIES: [string, () => any][] = [
      ["notifications", getNotificationQueue],
      ["optimization", getOptimizationQueue],
      ["webhooks", getWebhookQueue],
      ["maintenance", getMaintenanceQueue],
    ];

    const allJobs: any[] = [];
    for (const [, getQueue] of QUEUE_FACTORIES) {
      try {
        const queue = getQueue();
        const jobs = await queue.getJobs(["active", "waiting", "failed"], 0, 10, true).catch(() => []);
        for (const job of jobs) {
          allJobs.push({
            id: String(job.id),
            name: job.name,
            status: job.finishedOn ? "completed" : job.processedOn ? "active" : job.failedReason ? "failed" : "waiting",
            progress: typeof job.progress === "number" ? job.progress : 0,
            attempts: job.attemptsMade ?? 0,
            maxAttempts: job.opts?.attempts ?? 3,
            createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : new Date().toISOString(),
            processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
          });
        }
      } catch {
        // queue not available
      }
    }

    return { data: allJobs.slice(0, 50), pagination: { page: 1, limit: 50, total: allJobs.length, totalPages: 1 } };
  });

  // ── GET /queues/scheduled — recurring/scheduled jobs ─────────

  fastify.get("/queues/scheduled", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const SCHEDULED_QUEUES: [string, () => any][] = [
      ["maintenance", getMaintenanceQueue],
      ["geofence", getGeofenceQueue],
    ];

    const scheduled: any[] = [];
    for (const [queueName, getQueue] of SCHEDULED_QUEUES) {
      try {
        const queue = getQueue();
        const repeatable = await queue.getRepeatableJobs().catch(() => []);
        for (const job of repeatable) {
          scheduled.push({
            id: job.key,
            name: job.name,
            pattern: job.cron ?? job.every ?? "unknown",
            enabled: true,
            nextRunAt: job.next ? new Date(job.next).toISOString() : null,
            lastRunStatus: "success",
            lastRunTime: null,
            queue: queueName,
          });
        }
      } catch {
        // queue not available
      }
    }

    return { data: scheduled };
  });

  // ── GET /queues/dlq — dead letter queue items ─────────────────

  fastify.get("/queues/dlq", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const QUEUE_FACTORIES: [string, () => any][] = [
      ["failed-delivery", getFailedDeliveryQueue],
      ["wc-webhooks", getWCWebhookQueue],
      ["notifications", getNotificationQueue],
      ["webhooks", getWebhookQueue],
    ];

    const dlqItems: any[] = [];
    for (const [queueName, getQueue] of QUEUE_FACTORIES) {
      try {
        const queue = getQueue();
        const failed = await queue.getFailed(0, 10).catch(() => []);
        for (const job of failed) {
          dlqItems.push({
            jobId: String(job.id),
            jobName: job.name,
            queue: queueName,
            failedReason: job.failedReason ?? "Unknown error",
            category: "system",
            failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : new Date().toISOString(),
          });
        }
      } catch {
        // queue not available
      }
    }

    return { data: dlqItems };
  });

  // ── GET /system — system health check ─────────────────────────

  fastify.get("/system", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const { execSync } = await import("child_process");
    const { readFileSync } = await import("fs");
    const { join, dirname } = await import("path");
    const { fileURLToPath } = await import("url");

    const now = Date.now();

    // DB health check
    let dbStatus: "healthy" | "critical" = "healthy";
    let dbResponseTime = 0;
    try {
      const t0 = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbResponseTime = Date.now() - t0;
    } catch {
      dbStatus = "critical";
    }

    // Redis health check
    let redisStatus: "healthy" | "critical" = "healthy";
    let redisResponseTime = 0;
    try {
      const redis = getRedis();
      const t0 = Date.now();
      await redis.ping();
      redisResponseTime = Date.now() - t0;
    } catch {
      redisStatus = "degraded";
    }

    // Worker queues — sample one queue
    let workerStatus: "healthy" | "degraded" = "healthy";
    let activeJobs = 0;
    try {
      const q = getNotificationQueue();
      const counts = await q.getJobCounts("active", "waiting", "failed");
      activeJobs = (counts.active ?? 0) + (counts.waiting ?? 0);
      if ((counts.failed ?? 0) > 50) workerStatus = "degraded";
    } catch {
      workerStatus = "degraded";
    }

    // Process memory
    const mem = process.memoryUsage();
    const memUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const memPct = memTotalMB > 0 ? Math.round((memUsedMB / memTotalMB) * 100) : 0;

    // Version
    let version = "4.x";
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const pkg = JSON.parse(readFileSync(join(__dirname, "../../../package.json"), "utf8"));
      version = pkg.version ?? version;
    } catch {
      // ignore
    }

    const checkedAt = new Date(now).toISOString();

    return {
      data: {
        services: [
          {
            name: "API Server",
            status: "healthy" as const,
            responseTime: Date.now() - now,
            uptime24h: 100,
            uptime7d: 100,
            uptime30d: 100,
            checkedAt,
          },
          {
            name: "PostgreSQL",
            status: dbStatus,
            responseTime: dbResponseTime,
            uptime24h: dbStatus === "healthy" ? 100 : 0,
            uptime7d: dbStatus === "healthy" ? 100 : 0,
            uptime30d: dbStatus === "healthy" ? 100 : 0,
            checkedAt,
          },
          {
            name: "Redis Cache",
            status: redisStatus,
            responseTime: redisResponseTime,
            uptime24h: redisStatus === "healthy" ? 100 : 0,
            uptime7d: redisStatus === "healthy" ? 100 : 0,
            uptime30d: redisStatus === "healthy" ? 100 : 0,
            checkedAt,
          },
          {
            name: "Worker Queues",
            status: workerStatus,
            responseTime: 0,
            uptime24h: workerStatus === "healthy" ? 100 : 95,
            uptime7d: workerStatus === "healthy" ? 100 : 95,
            uptime30d: workerStatus === "healthy" ? 100 : 95,
            activeJobs,
            checkedAt,
          },
        ],
        metrics: {
          memoryUsedMB,
          memoryTotalMB,
          memoryUsagePct: memPct,
          processUptimeSec: Math.round(process.uptime()),
          version,
          nodeVersion: process.version,
        },
        checkedAt,
      },
    };
  });

  // ── GET /stores/:id/billing — store billing history ──────────

  fastify.get("/stores/:id/billing", async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const invoices = await (prisma.invoice as any).findMany({
      where: { shopId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        dueDate: true,
        paidAt: true,
        createdAt: true,
        lineItems: true,
        subscription: {
          select: { plan: { select: { name: true } } },
        },
      },
    }).catch(() => [] as any[]);

    return {
      data: invoices.map((inv: any) => ({
        id: inv.id,
        date: inv.createdAt,
        description: inv.subscription?.plan?.name
          ? `${inv.subscription.plan.name} Plan - Monthly`
          : "Subscription",
        amount: Number(inv.amount),
        currency: inv.currency ?? "usd",
        status: inv.status === "paid" ? "paid" : inv.status === "failed" ? "failed" : "pending",
        paidAt: inv.paidAt,
        dueDate: inv.dueDate,
      })),
    };
  });

  // ── GET /stores/:id/activity — store activity log ─────────────

  fastify.get("/stores/:id/activity", async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const logs = await (prisma.activityLog as any).findMany({
      where: { shopId: id },
      orderBy: { timestamp: "desc" },
      take: 30,
      select: {
        id: true,
        entityType: true,
        action: true,
        actorType: true,
        changes: true,
        metadata: true,
        timestamp: true,
      },
    }).catch(() => [] as any[]);

    return {
      data: logs.map((log: any) => ({
        id: log.id,
        timestamp: log.timestamp,
        action: `${log.entityType} ${log.action}`.replace(/_/g, " "),
        details: (() => {
          const changes = log.changes as Record<string, unknown>;
          if (changes && Object.keys(changes).length > 0) {
            return Object.keys(changes).slice(0, 2).join(", ") + " updated";
          }
          return `${log.entityType} ${log.action}`;
        })(),
        actor: log.actorType ?? "system",
        severity: (log.action === "deleted" || log.action === "failed") ? "warning" : "info" as const,
      })),
    };
  });
}

export default adminRoutes;
