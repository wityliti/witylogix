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

  // ── DASHBOARD USER LOGIN ──────────────────────────────────

  fastify.post("/login", async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password, shopDomain } = loginSchema.parse(request.body);

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
    const redis = getRedis();
    await redis.set(
      `refresh:${refreshHash}`,
      JSON.stringify({ userId: user.id, shopId: shop.id, orgId, role: user.role, orgRole }),
      "EX",
      30 * 24 * 60 * 60,
    );

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

  fastify.post("/driver/login", async (request: FastifyRequest, reply: FastifyReply) => {
    const { phone, password, shopDomain } = driverLoginSchema.parse(request.body);

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

  fastify.post("/refresh", async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = refreshSchema.parse(request.body);
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

  fastify.post("/logout", async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    const refreshHash = createHash("sha256").update(refreshToken).digest("hex");

    const redis = getRedis();
    await redis.del(`refresh:${refreshHash}`);

    return { data: { message: "Logged out" } };
  });

  // ── FORGOT PASSWORD ───────────────────────────────────────

  fastify.post("/forgot-password", async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, shopDomain } = forgotPasswordSchema.parse(request.body);

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
        { priority: 'high' }
      );
    }

    return { data: { message: "If the email exists, a reset link has been sent" } };
  });

  // ── RESET PASSWORD ────────────────────────────────────────

  fastify.post("/reset-password", async (request: FastifyRequest, reply: FastifyReply) => {
    const { token, password } = resetPasswordSchema.parse(request.body);
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
}

export default authRoutes;
