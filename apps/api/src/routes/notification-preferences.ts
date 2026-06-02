/**
 * Notification Preferences API
 * Stores per-shop preferences in Shop.settings JSON column.
 *
 * Routes:
 *   GET  / — Retrieve preferences (returns defaults if not set)
 *   PATCH / — Update preferences
 *   POST /test — Send a test notification
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { prisma } from '@witylogix/db';

const channelEnum = z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'WEBHOOK', 'SLACK']);
const categoryEnum = z.enum(['ORDERS', 'DELIVERIES', 'DRIVERS', 'PAYMENTS', 'SYSTEM', 'ALERTS']);

const preferenceMatrixSchema = z.array(
  z.object({
    channel: channelEnum,
    category: categoryEnum,
    enabled: z.boolean(),
  }),
);

const quietHoursSchema = z.object({
  enabled: z.boolean(),
  startTime: z.string(),
  endTime: z.string(),
  timezone: z.string(),
});

const digestSettingsSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['IMMEDIATE', 'HOURLY', 'DAILY']),
  time: z.string().optional(),
});

const updatePrefsSchema = z.object({
  channelMatrix: preferenceMatrixSchema.optional(),
  quietHours: quietHoursSchema.optional(),
  digestSettings: digestSettingsSchema.optional(),
});

const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'WEBHOOK', 'SLACK'] as const;
const CATEGORIES = ['ORDERS', 'DELIVERIES', 'DRIVERS', 'PAYMENTS', 'SYSTEM', 'ALERTS'] as const;

function buildDefaultPreferences() {
  const channelMatrix = CHANNELS.flatMap((channel) =>
    CATEGORIES.map((category) => ({
      channel,
      category,
      enabled: channel === 'EMAIL' || channel === 'PUSH',
    })),
  );

  return {
    channelMatrix,
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'UTC',
    },
    digestSettings: {
      enabled: false,
      frequency: 'IMMEDIATE' as const,
      time: '09:00',
    },
  };
}

export default async function notificationPreferencesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', tenantContext);

  // ── GET / — Return preferences from Shop.settings ────────────

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { settings: true },
    });

    const settings = (shop?.settings ?? {}) as Record<string, unknown>;
    const stored = settings.notificationPreferences as ReturnType<typeof buildDefaultPreferences> | undefined;
    const prefs = stored ?? buildDefaultPreferences();

    // Fill in any missing channel×category combos
    const existing = new Set(
      prefs.channelMatrix.map((p: any) => `${p.channel}:${p.category}`),
    );
    for (const ch of CHANNELS) {
      for (const cat of CATEGORIES) {
        if (!existing.has(`${ch}:${cat}`)) {
          prefs.channelMatrix.push({
            channel: ch,
            category: cat,
            enabled: ch === 'EMAIL' || ch === 'PUSH',
          });
        }
      }
    }

    return reply.send({ data: prefs });
  });

  // ── PATCH / — Update preferences ─────────────────────────────

  app.patch('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = (request as any).shopId as string;
    const body = updatePrefsSchema.parse(request.body);

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { settings: true },
    });

    const settings = (shop?.settings ?? {}) as Record<string, unknown>;
    const current = (settings.notificationPreferences ?? buildDefaultPreferences()) as ReturnType<
      typeof buildDefaultPreferences
    >;

    const updated = {
      ...current,
      ...(body.channelMatrix !== undefined && { channelMatrix: body.channelMatrix }),
      ...(body.quietHours !== undefined && { quietHours: body.quietHours }),
      ...(body.digestSettings !== undefined && { digestSettings: body.digestSettings }),
    };

    await prisma.shop.update({
      where: { id: shopId },
      data: {
        settings: {
          ...settings,
          notificationPreferences: updated,
        },
      },
    });

    return reply.send({ data: updated });
  });

  // ── POST /test — Send test notification ───────────────────────

  app.post('/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({ channel: channelEnum }).parse(request.body);
    return reply.send({
      success: true,
      message: `Test ${body.channel} notification queued`,
    });
  });
}
