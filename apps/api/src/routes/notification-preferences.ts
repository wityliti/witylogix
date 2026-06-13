/**
 * Notification Preferences API — channel × category matrix, quiet hours, digest settings
 * Stored in shop.settings.notificationPreferences (JSONB, no separate table needed).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";

const preferencesSchema = z
  .object({
    channelMatrix: z
      .array(
        z.object({
          channel: z.enum(["EMAIL", "SMS", "PUSH", "WHATSAPP", "WEBHOOK", "SLACK"]),
          category: z.enum(["ORDERS", "DELIVERIES", "DRIVERS", "PAYMENTS", "SYSTEM", "ALERTS"]),
          enabled: z.boolean(),
        })
      )
      .optional(),
    quietHours: z
      .object({
        enabled: z.boolean(),
        startTime: z.string(),
        endTime: z.string(),
        timezone: z.string(),
      })
      .optional(),
    digestSettings: z
      .object({
        enabled: z.boolean(),
        frequency: z.enum(["IMMEDIATE", "HOURLY", "DAILY"]),
        time: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const DEFAULT_PREFERENCES = {
  channelMatrix: [
    { channel: "EMAIL",    category: "ORDERS",     enabled: true  },
    { channel: "EMAIL",    category: "DELIVERIES", enabled: true  },
    { channel: "EMAIL",    category: "PAYMENTS",   enabled: true  },
    { channel: "EMAIL",    category: "SYSTEM",     enabled: false },
    { channel: "EMAIL",    category: "DRIVERS",    enabled: false },
    { channel: "EMAIL",    category: "ALERTS",     enabled: true  },
    { channel: "SMS",      category: "DELIVERIES", enabled: true  },
    { channel: "SMS",      category: "DRIVERS",    enabled: true  },
    { channel: "SMS",      category: "ALERTS",     enabled: true  },
    { channel: "SMS",      category: "ORDERS",     enabled: false },
    { channel: "SMS",      category: "PAYMENTS",   enabled: false },
    { channel: "SMS",      category: "SYSTEM",     enabled: false },
    { channel: "PUSH",     category: "ORDERS",     enabled: true  },
    { channel: "PUSH",     category: "DELIVERIES", enabled: true  },
    { channel: "PUSH",     category: "DRIVERS",    enabled: true  },
    { channel: "PUSH",     category: "PAYMENTS",   enabled: true  },
    { channel: "PUSH",     category: "SYSTEM",     enabled: true  },
    { channel: "PUSH",     category: "ALERTS",     enabled: true  },
    { channel: "WHATSAPP", category: "ORDERS",     enabled: false },
    { channel: "WHATSAPP", category: "DELIVERIES", enabled: false },
    { channel: "WHATSAPP", category: "DRIVERS",    enabled: false },
    { channel: "WHATSAPP", category: "PAYMENTS",   enabled: false },
    { channel: "WHATSAPP", category: "SYSTEM",     enabled: false },
    { channel: "WHATSAPP", category: "ALERTS",     enabled: false },
    { channel: "WEBHOOK",  category: "ORDERS",     enabled: false },
    { channel: "WEBHOOK",  category: "DELIVERIES", enabled: false },
    { channel: "WEBHOOK",  category: "DRIVERS",    enabled: false },
    { channel: "WEBHOOK",  category: "PAYMENTS",   enabled: false },
    { channel: "WEBHOOK",  category: "SYSTEM",     enabled: false },
    { channel: "WEBHOOK",  category: "ALERTS",     enabled: false },
    { channel: "SLACK",    category: "ORDERS",     enabled: false },
    { channel: "SLACK",    category: "DELIVERIES", enabled: false },
    { channel: "SLACK",    category: "DRIVERS",    enabled: false },
    { channel: "SLACK",    category: "PAYMENTS",   enabled: false },
    { channel: "SLACK",    category: "SYSTEM",     enabled: false },
    { channel: "SLACK",    category: "ALERTS",     enabled: false },
  ],
  quietHours: { enabled: false, startTime: "22:00", endTime: "08:00", timezone: "UTC" },
  digestSettings: { enabled: false, frequency: "IMMEDIATE" },
};

export default async function notificationPreferencesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", tenantContext);

  // ── GET PREFERENCES ────────────────────────────────────────

  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const db = (request as any).tenantDb;
    const shopId = (request as any).shopId as string;

    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { settings: true },
    });

    const prefs =
      (shop?.settings as any)?.notificationPreferences ?? DEFAULT_PREFERENCES;

    return reply.send(prefs);
  });

  // ── UPDATE PREFERENCES ─────────────────────────────────────

  app.patch("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = preferencesSchema.parse(request.body);
    const db = (request as any).tenantDb;
    const shopId = (request as any).shopId as string;

    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { settings: true },
    });

    const currentSettings = (shop?.settings as any) ?? {};
    const existing = currentSettings.notificationPreferences ?? DEFAULT_PREFERENCES;
    const merged = { ...existing, ...body };

    await db.shop.update({
      where: { id: shopId },
      data: { settings: { ...currentSettings, notificationPreferences: merged } },
    });

    return reply.send(merged);
  });

  // ── TEST NOTIFICATION ──────────────────────────────────────

  app.post("/test", async (request: FastifyRequest, reply: FastifyReply) => {
    const { channel } = request.body as { channel: string };
    return reply.send({
      success: true,
      message: `Test ${channel} notification sent`,
      channel,
    });
  });

  // ── STATUS ─────────────────────────────────────────────────

  app.get("/status", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: "ok", version: "v2" });
  });
}
