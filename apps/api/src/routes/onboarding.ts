/**
 * Onboarding routes — multi-step workspace setup for new tenants.
 *
 * These routes manage the post-registration onboarding wizard that
 * guides new users through email verification, deployment selection,
 * and workspace configuration.
 *
 * Inspired by Fleetbase's OnboardController, but adapted for the
 * Witylogix TypeScript/Fastify stack with Redis-backed verification
 * codes and Prisma-based progress persistence.
 *
 * Routes:
 *   GET  /progress            Get current onboarding progress
 *   PUT  /progress            Update step / sub-step / form data
 *   POST /verify-email        Validate 6-digit email verification code
 *   POST /resend-verification Resend verification email (rate-limited)
 *   POST /complete            Finalize onboarding, create workspace
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { randomInt } from "crypto";
import { prisma } from "@witylogix/db";
import { requireAuth } from "../middleware/auth.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { getRedis } from "../lib/redis.js";
import { getNotificationQueue } from "../lib/queue.js";
import { strictRateLimiter } from "../middleware/rate-limiter.js";

// ─── Schemas ────────────────────────────────────────────────

const updateProgressSchema = z.object({
  currentStep: z.string().min(1),
  currentSubStep: z.string().optional(),
  completedSteps: z.array(z.string()).optional(),
  data: z.record(z.unknown()).optional(),
});

const verifyEmailSchema = z.object({
  code: z.string().length(6, "Verification code must be 6 digits"),
});

const completeOnboardingSchema = z.object({
  workspaceName: z.string().min(1).max(200).optional(),
  deploymentType: z.enum(["CLOUD", "SELF_MANAGED"]).default("CLOUD"),
  industry: z.string().optional(),
  goals: z.array(z.string()).default([]),
  selectedIntegrations: z.array(z.string()).default([]),
  dashboardLayout: z.record(z.unknown()).optional(),
  timezone: z.string().default("UTC"),
  currency: z.string().default("USD"),
  distanceUnit: z.enum(["KM", "MILES"]).default("KM"),
  weightUnit: z.enum(["KG", "LBS"]).default("KG"),
  dateFormat: z.string().default("YYYY-MM-DD"),
  locale: z.string().default("en-US"),
});

// ─── Helpers ────────────────────────────────────────────────

function generateVerificationCode(): string {
  return String(randomInt(100000, 999999));
}

function verificationRedisKey(userId: string): string {
  return `email-verify:${userId}`;
}

// ─── Route Plugin ───────────────────────────────────────────

async function onboardingRoutes(fastify: FastifyInstance): Promise<void> {
  // All onboarding routes require authentication
  fastify.addHook("preHandler", requireAuth);

  // ── GET ONBOARDING PROGRESS ───────────────────────────────
  // Returns the current user's onboarding progress, or null if
  // onboarding is already complete or not yet started.

  fastify.get(
    "/progress",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.auth?.userId;
      if (!userId) {
        throw new ValidationError("User authentication required");
      }

      const progress = await prisma.onboardingProgress.findUnique({
        where: { userId },
        select: {
          id: true,
          currentStep: true,
          currentSubStep: true,
          completedSteps: true,
          data: true,
          startedAt: true,
          completedAt: true,
          isActive: true,
        },
      });

      if (!progress || progress.completedAt) {
        return { data: null, completed: !!progress?.completedAt };
      }

      return { data: progress };
    },
  );

  // ── UPDATE ONBOARDING PROGRESS ────────────────────────────
  // Persists step changes and form data as the user advances
  // through the onboarding wizard.

  fastify.put(
    "/progress",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.auth?.userId;
      if (!userId) {
        throw new ValidationError("User authentication required");
      }

      const body = updateProgressSchema.parse(request.body);

      const progress = await prisma.onboardingProgress.findUnique({
        where: { userId },
      });

      if (!progress) {
        throw new NotFoundError("OnboardingProgress", userId);
      }

      if (progress.completedAt) {
        throw new ValidationError("Onboarding is already complete");
      }

      // Merge new data with existing data
      const existingData = (progress.data as Record<string, unknown>) || {};
      const mergedData = body.data
        ? { ...existingData, ...body.data }
        : existingData;

      // Merge completed steps (union of existing + new)
      const existingSteps = progress.completedSteps || [];
      const newSteps = body.completedSteps || [];
      const mergedSteps = [...new Set([...existingSteps, ...newSteps])];

      const updated = await prisma.onboardingProgress.update({
        where: { userId },
        data: {
          currentStep: body.currentStep,
          currentSubStep: body.currentSubStep ?? null,
          completedSteps: mergedSteps,
          data: mergedData,
        },
      });

      return { data: updated };
    },
  );

  // ── VERIFY EMAIL ──────────────────────────────────────────
  // Validates a 6-digit code that was sent to the user's email
  // during registration. Code is stored in Redis with 15min TTL.

  fastify.post(
    "/verify-email",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.auth?.userId;
      if (!userId) {
        throw new ValidationError("User authentication required");
      }

      const { code } = verifyEmailSchema.parse(request.body);

      const redis = getRedis();
      const redisKey = verificationRedisKey(userId);
      const storedCode = await redis.get(redisKey);

      if (!storedCode) {
        throw new ValidationError(
          "Verification code expired or not found. Please request a new one.",
        );
      }

      if (storedCode !== code) {
        throw new ValidationError("Invalid verification code.");
      }

      // Mark email as verified
      const verifiedAt = new Date();
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: verifiedAt },
      });

      // Delete the code from Redis
      await redis.del(redisKey);

      // Update onboarding progress — merge JSON so we don't replace entire `data` blob
      const progress = await prisma.onboardingProgress.findUnique({
        where: { userId },
        select: { id: true, data: true, completedAt: true },
      });
      if (progress && !progress.completedAt) {
        const prevData = (progress.data as Record<string, unknown>) || {};
        await prisma.onboardingProgress.update({
          where: { userId },
          data: {
            currentStep: "choose-deployment",
            completedSteps: { push: "verify-email" },
            data: {
              ...prevData,
              emailVerified: true,
              emailVerifiedAt: verifiedAt.toISOString(),
            },
          },
        });
      }

      return {
        data: {
          verified: true,
          verifiedAt: verifiedAt.toISOString(),
        },
      };
    },
  );

  // ── RESEND VERIFICATION EMAIL ─────────────────────────────
  // Rate-limited endpoint to resend the 6-digit code.
  // Generates a new code and enqueues via BullMQ notification queue.

  fastify.post(
    "/resend-verification",
    { preHandler: [strictRateLimiter] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.auth?.userId;
      if (!userId) {
        throw new ValidationError("User authentication required");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, emailVerifiedAt: true, shopId: true },
      });

      if (!user) {
        throw new NotFoundError("User", userId);
      }

      if (user.emailVerifiedAt) {
        return { data: { message: "Email is already verified" } };
      }

      // Generate new code and store in Redis (15 min TTL)
      const code = generateVerificationCode();
      const redis = getRedis();
      await redis.set(verificationRedisKey(userId), code, "EX", 15 * 60);

      // Enqueue verification email
      try {
        const notificationQueue = getNotificationQueue();
        await notificationQueue.add(
          "onboarding.verify_email",
          {
            type: "notification",
            data: {
              shopId: user.shopId,
              notificationId: `email-verify-${userId}-${Date.now()}`,
              channel: "email",
              payload: {
                templateId: "email-verification",
                recipientId: userId,
                recipientAddress: user.email,
                templateData: {
                  code,
                  email: user.email,
                },
                priority: "high",
                ttl: 900, // 15 minutes
              },
            },
          },
          { priority: 1 },
        );
      } catch (err) {
        // Email queue failure is non-fatal — log the code in dev
        fastify.log.warn(
          { err, code },
          "Failed to enqueue verification email — code logged for dev",
        );
      }

      fastify.log.info(
        { userId, code },
        "[onboarding] Verification code generated (logged for dev)",
      );

      return { data: { message: "Verification email sent" } };
    },
  );

  // ── COMPLETE ONBOARDING ───────────────────────────────────
  // Finalizes the onboarding flow by creating a Workspace +
  // WorkspaceSettings and marking onboarding as complete.
  // Runs inside a Prisma transaction for atomicity.

  fastify.post(
    "/complete",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.auth?.userId;
      if (!userId) {
        throw new ValidationError("User authentication required");
      }

      const body = completeOnboardingSchema.parse(request.body);

      // Find user + org context
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, shopId: true },
      });

      if (!user) {
        throw new NotFoundError("User", userId);
      }

      // Find the user's org membership
      const orgMember = await prisma.orgMember.findFirst({
        where: { userId, isActive: true },
        select: { orgId: true, role: true },
      });

      if (!orgMember) {
        throw new ValidationError(
          "User must belong to an organization to complete onboarding",
        );
      }

      // Check onboarding progress
      const progress = await prisma.onboardingProgress.findUnique({
        where: { userId },
      });

      if (!progress || progress.completedAt) {
        throw new ValidationError("No active onboarding session found");
      }

      // Generate workspace slug
      const workspaceName = body.workspaceName || "default-workspace";
      const slug = workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Atomically create workspace and complete onboarding
      const result = await prisma.$transaction(async (tx) => {
        // Create workspace
        const workspace = await tx.workspace.create({
          data: {
            orgId: orgMember.orgId,
            name: workspaceName,
            slug: `${slug}-${Date.now().toString(36)}`, // Ensure uniqueness
            deploymentType: body.deploymentType,
            industry: body.industry,
            goals: body.goals,
            selectedIntegrations: body.selectedIntegrations,
            dashboardLayout: body.dashboardLayout || {},
            provisionedAt: new Date(),
          },
        });

        // Create workspace settings
        await tx.workspaceSettings.create({
          data: {
            workspaceId: workspace.id,
            timezone: body.timezone,
            currency: body.currency,
            distanceUnit: body.distanceUnit,
            weightUnit: body.weightUnit,
            dateFormat: body.dateFormat,
            locale: body.locale,
          },
        });

        // Mark onboarding as complete
        await tx.onboardingProgress.update({
          where: { userId },
          data: {
            completedAt: new Date(),
            currentStep: "complete",
            completedSteps: { push: "review" },
            data: {
              ...(progress.data as Record<string, unknown>),
              workspaceId: workspace.id,
              completedAt: new Date().toISOString(),
            },
          },
        });

        return workspace;
      });

      return {
        data: {
          workspace: result,
          redirectUrl: "/",
          message: "Onboarding complete! Welcome to Witylogix.",
        },
      };
    },
  );
}

export default onboardingRoutes;
