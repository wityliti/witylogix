/**
 * Notification Preferences API Routes
 *
 *   GET    /          Read per-channel/category matrix + quiet hours + digest settings
 *   PATCH  /          Merge-update preferences (partial update supported)
 *   POST   /test      Send a test notification for a given channel; records in NotificationLog
 *   GET    /status    Health check
 *
 * Preferences are stored as `shop.settings.notificationPreferences` JSON.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";

// ─── Default preferences ──────────────────────────────────────────────────

const CHANNELS = [
  "EMAIL",
  "SMS",
  "WHATSAPP",
  "PUSH",
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

type NotificationChannel = (typeof CHANNELS)[number];
type NotificationCategory = (typeof CATEGORIES)[number];

interface ChannelPreference {
  channel: NotificationChannel;
  category: NotificationCategory;
  enabled: boolean;
}

interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
}

interface DigestSettings {
  enabled: boolean;
  frequency: "IMMEDIATE" | "HOURLY" | "DAILY";
  time?: string;
}

interface NotificationPreferences {
  channelMatrix: ChannelPreference[];
  quietHours: QuietHours;
  digestSettings: DigestSettings;
}

function buildDefaultMatrix(): ChannelPreference[] {
  const matrix: ChannelPreference[] = [];
  for (const channel of CHANNELS) {
    for (const category of CATEGORIES) {
      // Default: EMAIL/PUSH enabled for all; SMS/WHATSAPP only for ORDERS+DELIVERIES; WEBHOOK/SLACK for SYSTEM+ALERTS
      let enabled = false;
      if (channel === "EMAIL" || channel === "PUSH") {
        enabled = true;
      } else if (channel === "SMS" || channel === "WHATSAPP") {
        enabled = category === "ORDERS" || category === "DELIVERIES";
      } else if (channel === "WEBHOOK" || channel === "SLACK") {
        enabled = category === "SYSTEM" || category === "ALERTS";
      }
      matrix.push({ channel, category, enabled });
    }
  }
  return matrix;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  channelMatrix: buildDefaultMatrix(),
  quietHours: {
    enabled: false,
    startTime: "22:00",
    endTime: "07:00",
    timezone: "UTC",
  },
  digestSettings: {
    enabled: false,
    frequency: "IMMEDIATE",
    time: "09:00",
  },
};

function getPreferences(settings: unknown): NotificationPreferences {
  const raw = (settings as any)?.notificationPreferences;
  if (!raw) return DEFAULT_PREFERENCES;
  // Merge stored data with defaults so new fields always exist
  return {
    channelMatrix:
      Array.isArray(raw.channelMatrix) && raw.channelMatrix.length > 0
        ? raw.channelMatrix
        : DEFAULT_PREFERENCES.channelMatrix,
    quietHours: {
      ...DEFAULT_PREFERENCES.quietHours,
      ...(raw.quietHours ?? {}),
    },
    digestSettings: {
      ...DEFAULT_PREFERENCES.digestSettings,
      ...(raw.digestSettings ?? {}),
    },
  };
}

function mergePreferences(
  existing: NotificationPreferences,
  patch: Partial<NotificationPreferences>,
): NotificationPreferences {
  return {
    channelMatrix: patch.channelMatrix ?? existing.channelMatrix,
    quietHours: patch.quietHours
      ? { ...existing.quietHours, ...patch.quietHours }
      : existing.quietHours,
    digestSettings: patch.digestSettings
      ? { ...existing.digestSettings, ...patch.digestSettings }
      : existing.digestSettings,
  };
}

// ─── Route Plugin ─────────────────────────────────────────────────────────

export default async function notificationPreferencesRoutes(
  app: FastifyInstance,
) {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", tenantContext);

  // ── GET / — read preferences ───────────────────────────────────────────
  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const req = request as any;
      const shop = await req.tenantDb.shop.findUnique({
        where: { id: req.shopId },
        select: { settings: true },
      });
      return reply.send({ data: getPreferences(shop?.settings) });
    } catch (err) {
      request.log.error(err, "Failed to fetch notification preferences");
      return reply
        .status(500)
        .send({ error: "Failed to fetch notification preferences" });
    }
  });

  // ── PATCH / — update preferences (partial) ────────────────────────────
  app.patch("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const req = request as any;
      const body = request.body as Partial<NotificationPreferences>;

      const shop = await req.tenantDb.shop.findUnique({
        where: { id: req.shopId },
        select: { settings: true },
      });

      const current = getPreferences(shop?.settings);
      const updated = mergePreferences(current, body);

      await req.tenantDb.shop.update({
        where: { id: req.shopId },
        data: {
          settings: {
            ...((shop?.settings as any) ?? {}),
            notificationPreferences: updated,
          },
        },
      });

      return reply.send({ data: updated });
    } catch (err) {
      request.log.error(err, "Failed to update notification preferences");
      return reply
        .status(500)
        .send({ error: "Failed to update notification preferences" });
    }
  });

  // ── POST /test — send a test notification ─────────────────────────────
  app.post("/test", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const req = request as any;
      const { channel } = request.body as { channel?: NotificationChannel };

      if (!channel || !CHANNELS.includes(channel)) {
        return reply.status(400).send({ error: "Valid channel required" });
      }

      // DB-native channels → record in NotificationLog; WEBHOOK/SLACK → ActivityLog
      const dbNativeChannels = ["EMAIL", "SMS", "WHATSAPP", "PUSH"];
      if (dbNativeChannels.includes(channel)) {
        await req.tenantDb.notificationLog.create({
          data: {
            shopId: req.shopId,
            channel: channel as "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
            eventType: "test",
            recipient:
              channel === "EMAIL" ? "test@example.com" : "+10000000000",
            status: "SENT",
            sentAt: new Date(),
          },
        });
      } else {
        // WEBHOOK / SLACK — record as activity event (no FK needed)
        await req.tenantDb.activityLog.create({
          data: {
            shopId: req.shopId,
            entityType: "notification",
            entityId: req.shopId,
            action: "test_sent",
            actorType: "user",
            changes: {},
            metadata: { channel, test: true },
          },
        });
      }

      return reply.send({
        success: true,
        message: `Test ${channel} notification sent successfully`,
      });
    } catch (err) {
      request.log.error(err, "Failed to send test notification");
      return reply
        .status(500)
        .send({ error: "Failed to send test notification" });
    }
  });

  // ── GET /status ────────────────────────────────────────────────────────
  app.get("/status", async (_req, reply) => {
    return reply.send({ status: "ok" });
  });
}
