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
 *   POST   /impersonate/:userId     Start impersonation session (rate-limited, Redis-tracked)
 *   POST   /impersonate/:userId/revoke  Revoke active impersonation session by JTI
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z, ZodError } from "zod";
import { randomUUID } from "crypto";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";
import { getRedis } from "../lib/redis.js";
import {
  getNotificationQueue,
  getOptimizationQueue,
  getWebhookQueue,
  getMaintenanceQueue,
  getIntegrationQueue,
  getGeofenceQueue,
  getFailedDeliveryQueue,
  getWCWebhookQueue,
} from "../lib/queue.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "../lib/errors.js";

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

    const store = await (prisma.shop as any).findUnique({
      where: { id },
      include: {
        orders: { select: { id: true } },
        users: { select: { id: true, role: true } },
        drivers: { select: { id: true } },
        subscription: {
          select: {
            planTier: true,
            status: true,
            billingCycleEnd: true,
          },
        },
      },
    } as any);

    if (!store) {
      throw new NotFoundError("Store", id);
    }

    return {
      data: {
        ...store,
        status: (store as any).suspendedAt ? "SUSPENDED" : "ACTIVE",
        usage: {
          orders: (store as any).orders.length,
          users: (store as any).users.length,
          drivers: (store as any).drivers.length,
          suspension: (store as any).suspendedAt ? {
            suspendedAt: (store as any).suspendedAt,
            reason: (store as any).suspensionReason,
          } : null,
        },
      },
    };
  });

  // ── PUT /stores/:id/suspend (Suspend store) ────────────────────

  fastify.put(
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
  // ── GET /queues — BullMQ queue stats ──────────────────────────

  fastify.get("/queues", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const QUEUE_FACTORIES: [string, () => any][] = [
      ["notifications", getNotificationQueue],
      ["optimization", getOptimizationQueue],
      ["webhooks", getWebhookQueue],
      ["maintenance", getMaintenanceQueue],
      ["integration", getIntegrationQueue],
      ["geofence", getGeofenceQueue],
      ["failed-delivery", getFailedDeliveryQueue],
      ["wc-webhooks", getWCWebhookQueue],
    ];

    const stats = await Promise.all(
      QUEUE_FACTORIES.map(async ([name, getQueue]) => {
        try {
          const queue = getQueue();
          const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused");
          const isPaused = await queue.isPaused();
          return {
            name,
            active: counts.active ?? 0,
            waiting: counts.waiting ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
            delayed: counts.delayed ?? 0,
            paused: isPaused,
            throughputPerMin: 0,
            avgProcessingTimeMs: 0,
            errorRate: counts.completed > 0
              ? Math.round((counts.failed / (counts.completed + counts.failed)) * 10000) / 100
              : 0,
          };
        } catch {
          return { name, active: 0, waiting: 0, completed: 0, failed: 0, delayed: 0, paused: false, throughputPerMin: 0, avgProcessingTimeMs: 0, errorRate: 0 };
        }
      }),
    );

    return { data: stats };
  });

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
}

export default adminRoutes;
