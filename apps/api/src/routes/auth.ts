/**
 * Authentication routes — JWT token issuance and management.
 *
 * Three auth flows:
 *   1. Dashboard user: email + password → JWT (shop-scoped, optionally org-scoped)
 *   2. Driver app: phone + password → JWT (shop-scoped)
 *   3. Token refresh: refresh token → new JWT pair
 *
 * Shopify session token verification happens in the embedded app
 * via App Bridge, not through these routes. These routes are for
 * the standalone dashboard and driver app.
 *
 * Routes:
 *   POST /login           Dashboard user login (email + password)
 *   POST /driver/login    Driver login (phone + password)
 *   POST /refresh         Refresh access token
 *   POST /logout          Invalidate refresh token
 *   GET  /me              Get current authenticated user (requires Bearer token)
 *   POST /forgot-password Request password reset
 *   POST /reset-password  Reset password with token
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@witylogix/db";
import { UnauthorizedError, NotFoundError, ValidationError } from "../lib/errors.js";
import { getConfig } from "../lib/config.js";
import { getRedis } from "../lib/redis.js";
import { getNotificationQueue } from "../lib/queue.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { strictRateLimiter } from "../middleware/rate-limiter.js";

// ─── Schemas ────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  shopDomain: z.string().min(1), // identifies which shop they're logging into
});

const driverLoginSchema = z.object({
  phone: z.string().min(5),
  password: z.string().min(6),
  shopDomain: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
  shopDomain: z.string().min(1),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const registerSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2).max(200).optional(),
  phone: z.string().optional(),
});

// ─── Helpers ────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  // Using scrypt via Node crypto (no external dep needed)
  const { scrypt, randomBytes } = await import("crypto");
  const { promisify } = await import("util");
  const scryptAsync = promisify(scrypt);
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const { scrypt } = await import("crypto");
  const { promisify } = await import("util");
  const scryptAsync = promisify(scrypt);
  const [salt, hash] = stored.split(":");
  const hashBuffer = (await scryptAsync(password, salt, 64)) as Buffer;
  return hashBuffer.toString("hex") === hash;
}

function generateRefreshToken(): string {
  return randomBytes(40).toString("hex");
}

// ─── Route Plugin ───────────────────────────────────────────

async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // No auth hooks — these are public routes

  // ── REGISTER (Create Account) ─────────────────────────────
  // POST /register - Create a new organization, shop, user, and start onboarding
  // Inspired by Fleetbase's OnboardController@createAccount
  // Returns: accessToken, refreshToken, user profile, needsOnboarding flag
  // Errors: 409 (email already registered), 422 (validation error)
  // Rate limiting: Strict — 3 attempts/minute per IP

  fastify.post("/register", { preHandler: [strictRateLimiter] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = registerSchema.parse(request.body);

    // Check if email is already registered anywhere
    const existingUser = await prisma.user.findFirst({
      where: { email: body.email },
      select: { id: true },
    });

    if (existingUser) {
      reply.status(409);
      return { error: "Email already registered", statusCode: 409 };
    }

    // Hash password
    const hashedPassword = await hashPassword(body.password);

    // Determine if this is the first user (auto-admin, skip verification)
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    // Generate org slug from company name
    const companyName = body.companyName || `${body.name}'s Organization`;
    const baseSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const orgSlug = `${baseSlug}-${Date.now().toString(36)}`;

    // Create everything atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: companyName,
          slug: orgSlug,
          email: body.email,
          planTier: "FREE",
        },
      });

      // 2. Create a "platform" Shop (non-Shopify, represents the org's dashboard context)
      const platformDomain = `${orgSlug}.platform.witylogix.io`;
      const shop = await tx.shop.create({
        data: {
          orgId: org.id,
          shopifyDomain: platformDomain,
          shopifyAccessToken: "platform-managed", // Not a real Shopify token
          shopifyShopId: `platform-${org.id.slice(0, 8)}`,
          name: companyName,
          email: body.email,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          planTier: "FREE",
        },
      });

      // 3. Create User
      const user = await tx.user.create({
        data: {
          shopId: shop.id,
          email: body.email,
          name: body.name,
          phone: body.phone,
          role: "ADMIN",
          password: hashedPassword,
          emailVerifiedAt: isFirstUser ? new Date() : null, // First user auto-verified
          lastLogin: new Date(),
        },
      });

      // 4. Create OrgMember (OWNER)
      await tx.orgMember.create({
        data: {
          orgId: org.id,
          userId: user.id,
          role: "OWNER",
          shopIds: [],
        },
      });

      // 5. Create OnboardingProgress
      await tx.onboardingProgress.create({
        data: {
          userId: user.id,
          orgId: org.id,
          currentStep: isFirstUser ? "choose-deployment" : "verify-email",
          completedSteps: isFirstUser ? ["verify-email"] : [],
          data: {
            companyName,
            email: body.email,
            emailVerified: isFirstUser,
          },
        },
      });

      return { org, shop, user };
    });

    // Generate tokens
    const refreshToken = generateRefreshToken();
    const accessToken = fastify.jwt.sign(
      {
        sub: result.user.id,
        shopId: result.shop.id,
        orgId: result.org.id,
        role: "ADMIN",
        orgRole: "OWNER",
        type: "user" as const,
        shopDomain: `${orgSlug}.platform.witylogix.io`,
      },
      { expiresIn: getConfig().JWT_EXPIRES_IN },
    );

    // Store refresh token in Redis
    const refreshHash = createHash("sha256").update(refreshToken).digest("hex");
    try {
      const redis = getRedis();
      await redis.set(
        `refresh:${refreshHash}`,
        JSON.stringify({
          userId: result.user.id,
          shopId: result.shop.id,
          orgId: result.org.id,
          role: "ADMIN",
          orgRole: "OWNER",
        }),
        "EX",
        30 * 24 * 60 * 60,
      );
    } catch (redisErr) {
      fastify.log.warn({ err: redisErr }, "Redis unavailable — refresh token not persisted");
    }

    // Generate and store email verification code (skip for first user)
    if (!isFirstUser) {
      try {
        const { randomInt } = await import("crypto");
        const code = String(randomInt(100000, 999999));
        const redis = getRedis();
        await redis.set(`email-verify:${result.user.id}`, code, "EX", 15 * 60);

        // Enqueue verification email
        const notificationQueue = getNotificationQueue();
        await notificationQueue.add(
          "onboarding.verify_email",
          {
            type: "notification",
            data: {
              shopId: result.shop.id,
              notificationId: `email-verify-${result.user.id}-${Date.now()}`,
              channel: "email",
              payload: {
                templateId: "email-verification",
                recipientId: result.user.id,
                recipientAddress: result.user.email,
                templateData: { code, email: result.user.email },
                priority: "high",
                ttl: 900,
              },
            },
          },
          { priority: 1 },
        );

        fastify.log.info({ userId: result.user.id, code }, "[register] Verification code (logged for dev)");
      } catch (err) {
        fastify.log.warn({ err }, "Failed to send verification email — non-fatal");
      }
    }

    reply.status(201);
    return {
      data: {
        accessToken,
        refreshToken,
        expiresIn: getConfig().JWT_EXPIRES_IN,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: "ADMIN",
        },
        shop: {
          id: result.shop.id,
          name: result.shop.name,
          domain: `${orgSlug}.platform.witylogix.io`,
        },
        orgId: result.org.id,
        needsOnboarding: true,
        skipVerification: isFirstUser,
      },
    };
  });

  // ── DASHBOARD USER LOGIN ──────────────────────────────────
  // POST /login - Email + password authentication
  // Returns: accessToken, refreshToken, user profile, shop details
  // Errors: 401 (invalid credentials), 422 (validation error)
  // Rate limiting: Recommended 5 attempts/minute per IP

  fastify.post("/login", { preHandler: [strictRateLimiter] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      var { email, password, shopDomain } = loginSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new ValidationError("Invalid login request", err.errors);
      }
      throw err;
    }

    // Look up shop
    const shop = await prisma.shop.findUnique({
      where: { shopifyDomain: shopDomain },
      select: { id: true, orgId: true, isActive: true, name: true },
    });

    if (!shop || !shop.isActive) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Look up user by email within shop
    const user = await prisma.user.findUnique({
      where: { shopId_email: { shopId: shop.id, email } },
      select: { id: true, name: true, email: true, role: true, password: true, isActive: true },
    });

    if (!user || !user.isActive || !user.password) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Check org membership if shop belongs to an org
    let orgId: string | undefined;
    let orgRole: string | undefined;

    if (shop.orgId) {
      const membership = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: shop.orgId, userId: user.id } },
        select: { role: true, isActive: true },
      });

      if (membership?.isActive) {
        orgId = shop.orgId;
        orgRole = membership.role;
      }
    }

    // Generate tokens
    const refreshToken = generateRefreshToken();

    const accessToken = fastify.jwt.sign(
      {
        sub: user.id,
        shopId: shop.id,
        orgId,
        role: user.role,
        orgRole,
        type: "user" as const,
        shopDomain,
      },
      { expiresIn: getConfig().JWT_EXPIRES_IN },
    );

    // Store refresh token (hashed) on the user
    const refreshHash = createHash("sha256").update(refreshToken).digest("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Store refresh token in Redis with TTL (30 days)
    // Non-fatal: if Redis is unavailable the access token still works; refresh just won't persist.
    try {
      const redis = getRedis();
      await redis.set(
        `refresh:${refreshHash}`,
        JSON.stringify({ userId: user.id, shopId: shop.id, orgId, role: user.role, orgRole }),
        "EX",
        30 * 24 * 60 * 60,
      );
    } catch (redisErr) {
      fastify.log.warn({ err: redisErr }, "Redis unavailable — refresh token not persisted, login proceeds");
    }

    return {
      data: {
        accessToken,
        refreshToken,
        expiresIn: getConfig().JWT_EXPIRES_IN,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        shop: { id: shop.id, name: shop.name, domain: shopDomain },
        orgId,
        orgRole,
      },
    };
  });

  // ── DRIVER LOGIN ──────────────────────────────────────────
  // POST /driver/login - Phone + password authentication for mobile drivers
  // Returns: accessToken, refreshToken (90d), driver profile
  // Errors: 401 (invalid credentials), 422 (validation error)
  // Rate limiting: Recommended 5 attempts/minute per IP

  fastify.post("/driver/login", { preHandler: [strictRateLimiter] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      var { phone, password, shopDomain } = driverLoginSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new ValidationError("Invalid driver login request", err.errors);
      }
      throw err;
    }

    const shop = await prisma.shop.findUnique({
      where: { shopifyDomain: shopDomain },
      select: { id: true, orgId: true, isActive: true },
    });

    if (!shop || !shop.isActive) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Look up driver by phone within org (org-level drivers)
    let driver = await prisma.driver.findUnique({
      where: { orgId_phone: { orgId: shop.orgId || "", phone } },
      select: { id: true, name: true, phone: true, password: true, isActive: true, orgId: true },
    });

    // If not found at org level and no org, try looking up in a different way
    // Note: shop-specific drivers use shopId, but the schema shows only orgId_phone unique constraint
    if (!driver) {
      // Fallback: look for any driver with this phone that matches the org or shop context
      const drivers = await prisma.driver.findMany({
        where: { phone, orgId: shop.orgId || undefined },
        select: { id: true, name: true, phone: true, password: true, isActive: true, orgId: true },
        take: 1,
      });
      if (drivers.length > 0) {
        driver = drivers[0];
      }
    }

    if (!driver || !driver.isActive || !driver.password) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const valid = await verifyPassword(password, driver.password);
    if (!valid) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const refreshToken = generateRefreshToken();

    const accessToken = fastify.jwt.sign(
      {
        sub: driver.id,
        shopId: shop.id,
        role: "DRIVER" as const,
        type: "driver" as const,
        shopDomain,
      },
      { expiresIn: "7d" }, // Drivers get longer tokens (mobile)
    );

    // Store refresh token in Redis
    const refreshHash = createHash("sha256").update(refreshToken).digest("hex");
    const redis = getRedis();
    await redis.set(
      `refresh:${refreshHash}`,
      JSON.stringify({ driverId: driver.id, shopId: shop.id, role: "DRIVER" }),
      "EX",
      90 * 24 * 60 * 60, // 90 days for mobile
    );

    // Store refresh token hash on driver record
    await prisma.driver.update({
      where: { id: driver.id },
      data: { refreshToken: refreshHash },
    });

    return {
      data: {
        accessToken,
        refreshToken,
        expiresIn: "7d",
        driver: { id: driver.id, name: driver.name, phone: driver.phone },
      },
    };
  });

  // ── REFRESH TOKEN ─────────────────────────────────────────
  // POST /refresh - Obtain new accessToken using refreshToken
  // Returns: new accessToken, rotated refreshToken, expiresIn
  // Errors: 401 (invalid/expired token), 422 (validation error)
  // Behavior: Old refresh token is invalidated, new one is rotated

  fastify.post("/refresh", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      var { refreshToken } = refreshSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new ValidationError("Invalid refresh request", err.errors);
      }
      throw err;
    }
    const refreshHash = createHash("sha256").update(refreshToken).digest("hex");

    const redis = getRedis();
    const stored = await redis.get(`refresh:${refreshHash}`);

    if (!stored) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const tokenData = JSON.parse(stored);

    // Issue new access token
    const payload: any = {
      sub: tokenData.userId || tokenData.driverId,
      shopId: tokenData.shopId,
      role: tokenData.role,
      type: tokenData.userId ? "user" : "driver",
    };

    if (tokenData.orgId) payload.orgId = tokenData.orgId;
    if (tokenData.orgRole) payload.orgRole = tokenData.orgRole;

    const accessToken = fastify.jwt.sign(payload, {
      expiresIn: tokenData.role === "DRIVER" ? "7d" : getConfig().JWT_EXPIRES_IN,
    });

    // Rotate refresh token
    const newRefreshToken = generateRefreshToken();
    const newRefreshHash = createHash("sha256").update(newRefreshToken).digest("hex");

    // Delete old, store new
    await redis.del(`refresh:${refreshHash}`);
    await redis.set(
      `refresh:${newRefreshHash}`,
      stored, // same payload
      "EX",
      tokenData.role === "DRIVER" ? 90 * 24 * 60 * 60 : 30 * 24 * 60 * 60,
    );

    return {
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: tokenData.role === "DRIVER" ? "7d" : getConfig().JWT_EXPIRES_IN,
      },
    };
  });

  // ── LOGOUT ────────────────────────────────────────────────
  // POST /logout - Revoke refreshToken session
  // Returns: {data: {message: "Logged out"}}
  // Errors: 422 (validation error)
  // Behavior: Deletes refresh token from Redis; always returns 200 for idempotency

  fastify.post("/logout", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      var { refreshToken } = refreshSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new ValidationError("Invalid logout request", err.errors);
      }
      throw err;
    }
    const refreshHash = createHash("sha256").update(refreshToken).digest("hex");

    const redis = getRedis();
    await redis.del(`refresh:${refreshHash}`);

    return { data: { message: "Logged out" } };
  });

  // ── FORGOT PASSWORD ───────────────────────────────────────
  // POST /forgot-password - Initiate password reset flow
  // Returns: {data: {message: "If the email exists, a reset link has been sent"}} (always 200)
  // Errors: 422 (validation error)
  // Security: Never reveals whether user exists; sends email async via notification queue
  // Rate limiting: Recommended 3 attempts/hour per email per shop

  fastify.post("/forgot-password", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      var { email, shopDomain } = forgotPasswordSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new ValidationError("Invalid forgot-password request", err.errors);
      }
      throw err;
    }

    const shop = await prisma.shop.findUnique({
      where: { shopifyDomain: shopDomain },
      select: { id: true },
    });

    // Always return success (don't leak user existence)
    if (!shop) {
      return { data: { message: "If the email exists, a reset link has been sent" } };
    }

    const user = await prisma.user.findUnique({
      where: { shopId_email: { shopId: shop.id, email } },
      select: { id: true, email: true },
    });

    if (user) {
      // Generate reset token, store in Redis with 1h TTL
      const resetToken = randomBytes(32).toString("hex");
      const resetHash = createHash("sha256").update(resetToken).digest("hex");

      const redis = getRedis();
      await redis.set(
        `password-reset:${resetHash}`,
        JSON.stringify({ userId: user.id, shopId: shop.id }),
        "EX",
        3600, // 1 hour
      );

      // Enqueue email notification with reset link
      const notificationQueue = getNotificationQueue();
      await notificationQueue.add(
        'auth.password_reset',
        {
          type: 'notification',
          data: {
            shopId: shop.id,
            notificationId: `password-reset-${resetHash}`,
            channel: 'email',
            payload: {
              templateId: 'password-reset-email',
              recipientId: user.id,
              recipientAddress: user.email,
              templateData: {
                resetLink: `${getConfig().DASHBOARD_URL}/reset-password?token=${resetToken}`,
                email: user.email,
              },
              priority: 'high',
              ttl: 3600, // 1 hour to match reset token TTL
            },
          },
        },
        { priority: 1 } // 1 = high priority in BullMQ
      );
    }

    return { data: { message: "If the email exists, a reset link has been sent" } };
  });

  // ── RESET PASSWORD ────────────────────────────────────────
  // POST /reset-password - Complete password reset with token
  // Returns: {data: {message: "Password reset successfully"}}
  // Errors: 422 (invalid/expired token or weak password)
  // Behavior: Password is hashed with scrypt; token is invalidated after use
  // Rate limiting: Recommended 5 attempts/minute per IP

  fastify.post("/reset-password", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      var { token, password } = resetPasswordSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new ValidationError("Invalid reset-password request", err.errors);
      }
      throw err;
    }
    const resetHash = createHash("sha256").update(token).digest("hex");

    const redis = getRedis();
    const stored = await redis.get(`password-reset:${resetHash}`);

    if (!stored) {
      throw new ValidationError("Invalid or expired reset token");
    }

    const { userId } = JSON.parse(stored);

    const hashedPassword = await hashPassword(password);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate the reset token
    await redis.del(`password-reset:${resetHash}`);

    return { data: { message: "Password reset successfully" } };
  });

  // ── GET CURRENT USER ───────────────────────────────────────
  // GET /me - Retrieve authenticated user's profile and permissions
  // Auth: Required — Bearer token in Authorization header
  // Returns: user/driver profile with role, org context, shop affiliation
  // Errors: 401 (missing/invalid token), 401 (user not found or inactive)

  fastify.get(
    "/me",
    { preHandler: [requireAuth, tenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = (request as any).auth;
      if (!auth?.userId && !auth?.driverId) {
        throw new UnauthorizedError("Invalid authentication context");
      }

      const db = (request as any).tenantDb;

      if (auth.driverId) {
        // Return driver profile
        const driver = await db.driver.findUnique({
          where: { id: auth.driverId },
          select: {
            id: true,
            name: true,
            phone: true,
            isActive: true,
          },
        });

        if (!driver || !driver.isActive) {
          throw new UnauthorizedError("Driver not found or inactive");
        }

        return {
          data: {
            id: driver.id,
            name: driver.name,
            phone: driver.phone,
            role: auth.role,
            type: "driver" as const,
            shopId: auth.shopId,
          },
        };
      }

      // Return user profile
      const user = await db.user.findUnique({
        where: { id: auth.userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedError("User not found or inactive");
      }

      return {
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          type: "user" as const,
          shopId: auth.shopId,
          orgId: auth.orgId,
          orgRole: auth.orgRole,
        },
      };
    },
  );

  // PATCH /me - Update authenticated user's own profile (name, phone)
  // Auth: Required — Bearer token in Authorization header
  // Body: { name?: string, phone?: string | null }
  // Returns: updated user data
  // Errors: 401 (unauthenticated), 422 (validation error)

  const updateMeSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    phone: z.string().max(30).nullable().optional(),
  });

  fastify.patch(
    "/me",
    { preHandler: [requireAuth, tenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = (request as any).auth;
      if (!auth?.userId) {
        throw new UnauthorizedError("Only user accounts can update their profile here");
      }

      let body: z.infer<typeof updateMeSchema>;
      try {
        body = updateMeSchema.parse(request.body);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid input";
        throw new ValidationError(msg);
      }

      const db = (request as any).tenantDb;

      const updatedUser = await db.user.update({
        where: { id: auth.userId },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.phone !== undefined && { phone: body.phone }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      return {
        data: {
          ...updatedUser,
          type: "user" as const,
          shopId: auth.shopId,
        },
      };
    },
  );
}

export default authRoutes;
