/**
 * Notification Preferences API Routes
 *
 * Preferences are stored as a JSON blob in Shop.settings.notificationPreferences.
 * Default matrix: all channels × all categories enabled.
 *
 * Routes:
 *   GET   /   — Return current preferences (with defaults)
 *   PATCH /   — Update preferences (partial merge)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";

// ─── Types ──────────────────────────────────────────────────────────────────

const CHANNELS = [
  "EMAIL",
  "SMS",
  "PUSH",
  "WHATSAPP",
  "WEBHOOK",
  "SLACK",
] as const;
const CATEGORIES = [
  "ORDERS",
  "DELIVERIES",
  "DRIVERS",
  "PAYMENTS",
  "SYSTEM",
  "ALERTS",
] as const;

type Channel = (typeof CHANNELS)[number];
type Category = (typeof CATEGORIES)[number];

const channelMatrixItemSchema = z.object({
  channel: z.enum(CHANNELS),
  category: z.enum(CATEGORIES),
  enabled: z.boolean(),
});

const quietHoursSchema = z.object({
  enabled: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string(),
});

const digestSettingsSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["IMMEDIATE", "HOURLY", "DAILY"]),
  time: z.string().optional(),
});

const patchBodySchema = z.object({
  channelMatrix: z.array(channelMatrixItemSchema).optional(),
  quietHours: quietHoursSchema.optional(),
  digestSettings: digestSettingsSchema.optional(),
});

// ─── Defaults ───────────────────────────────────────────────────────────────

function buildDefaultMatrix() {
  const matrix: { channel: Channel; category: Category; enabled: boolean }[] =
    [];
  for (const channel of CHANNELS) {
    for (const category of CATEGORIES) {
      matrix.push({ channel, category, enabled: true });
    }
  }
  return matrix;
}

const DEFAULT_PREFERENCES = {
  channelMatrix: buildDefaultMatrix(),
  quietHours: {
    enabled: false,
    startTime: "22:00",
    endTime: "08:00",
    timezone: "UTC",
  },
  digestSettings: {
    enabled: false,
    frequency: "IMMEDIATE" as const,
    time: "09:00",
  },
};

type Preferences = typeof DEFAULT_PREFERENCES;

function getPreferences(settings: unknown): Preferences {
  const s = (settings ?? {}) as Record<string, unknown>;
  const stored = s.notificationPreferences as Partial<Preferences> | undefined;
  if (!stored) return DEFAULT_PREFERENCES;
  return {
    channelMatrix:
      Array.isArray(stored.channelMatrix) && stored.channelMatrix.length > 0
        ? (stored.channelMatrix as Preferences["channelMatrix"])
        : DEFAULT_PREFERENCES.channelMatrix,
    quietHours: stored.quietHours ?? DEFAULT_PREFERENCES.quietHours,
    digestSettings: stored.digestSettings ?? DEFAULT_PREFERENCES.digestSettings,
  };
}

// ─── Plugin ─────────────────────────────────────────────────────────────────

export default async function notificationPreferencesRoutes(
  app: FastifyInstance,
) {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", tenantContext);

  // ── GET / ────────────────────────────────────────────────────────────────

  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.shopId;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { settings: true },
    });

    return reply.send(getPreferences(shop?.settings));
  });

  // ── PATCH / ──────────────────────────────────────────────────────────────

  app.patch("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.shopId;
    const body = patchBodySchema.parse(request.body);

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { settings: true },
    });

    const current = getPreferences(shop?.settings);

    const updated: Preferences = {
      channelMatrix: body.channelMatrix ?? current.channelMatrix,
      quietHours: body.quietHours ?? current.quietHours,
      digestSettings: body.digestSettings ?? current.digestSettings,
    };

    await prisma.shop.update({
      where: { id: shopId },
      data: {
        settings: {
          ...((shop?.settings as object) ?? {}),
          notificationPreferences: updated,
        },
      },
    });

    return reply.send(updated);
  });
}
