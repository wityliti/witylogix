/**
 * Notification API Routes v2 — Multi-channel notifications
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  NotificationService,
  PreferenceManager,
  TemplateEngine,
  RateLimiter,
  WebhookManager,
  UrlShortener,
} from "@witylogix/core/notifications-v2";
import { NotificationServiceConfig, NotificationRequest } from "@witylogix/core/notifications-v2";

const router = Router();

/**
 * Initialize services
 */
const config: NotificationServiceConfig = {
  rateLimitConfig: {
    maxSmsPerDay: 10,
    maxWhatsAppPerDay: 5,
    windowMs: 24 * 60 * 60 * 1000,
  },
  retryOptions: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  emailFrom: process.env.NOTIFICATION_EMAIL_FROM || "noreply@witylogix.com",
  smsSender: process.env.SMS_SENDER || "+1234567890",
  trackingBaseUrl: process.env.TRACKING_BASE_URL || "https://track.witylogix.com",
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
};

const notificationService = new NotificationService(config);
const rateLimiter = notificationService.getRateLimiter();
const urlShortener = notificationService.getUrlShortener();

/**
 * Request validation schemas
 */
const SendNotificationSchema = z.object({
  customerId: z.string().min(1),
  eventType: z.enum([
    "order_confirmed",
    "delivery_scheduled",
    "out_for_delivery",
    "delivery_arriving",
    "delivered",
    "delivery_failed",
    "rescheduled",
  ]),
  channels: z.enum(["email", "sms", "whatsapp", "push"]).array().optional(),
  data: z.record(z.string().or(z.number()).or(z.boolean()).or(z.null())).optional(),
});

const PreferencesSchema = z.object({
  channels: z.object({
    email: z.object({
      enabled: z.boolean().optional(),
      eventTypes: z.record(z.boolean()).optional(),
    }).optional(),
    sms: z.object({
      enabled: z.boolean().optional(),
      eventTypes: z.record(z.boolean()).optional(),
    }).optional(),
    whatsapp: z.object({
      enabled: z.boolean().optional(),
      eventTypes: z.record(z.boolean()).optional(),
    }).optional(),
    push: z.object({
      enabled: z.boolean().optional(),
      eventTypes: z.record(z.boolean()).optional(),
    }).optional(),
  }).optional(),
});

const WebhookSchema = z.object({
  url: z.string().url(),
  events: z.enum([
    "delivery.scheduled",
    "delivery.out_for_delivery",
    "delivery.delivered",
    "delivery.failed",
  ]).array(),
  secret: z.string().optional(),
});

/**
 * POST /api/notifications/send — Send a notification
 */
router.post("/send", async (req: Request, res: Response) => {
  try {
    const validated = SendNotificationSchema.parse(req.body);

    const notificationRequest: NotificationRequest = {
      customerId: validated.customerId,
      eventType: validated.eventType,
      channels: validated.channels as any,
      data: (validated.data || {}) as any,
    };

    const results = await notificationService.send(notificationRequest);

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * POST /api/notifications/send-bulk — Send bulk notifications
 */
router.post("/send-bulk", async (req: Request, res: Response) => {
  try {
    const { notifications } = req.body;

    if (!Array.isArray(notifications)) {
      return res.status(400).json({
        success: false,
        error: "notifications must be an array",
      });
    }

    const validated = notifications.map((n) => SendNotificationSchema.parse(n));

    const requests: NotificationRequest[] = validated.map((v) => ({
      customerId: v.customerId,
      eventType: v.eventType,
      channels: v.channels as any,
      data: (v.data || {}) as any,
    }));

    const results = await notificationService.sendBulk(requests);

    res.json({
      success: true,
      data: {
        sent: results.length,
        results,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * GET /api/notifications/:customerId/history — Get notification history
 */
router.get("/:customerId/history", (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { limit } = req.query;

    const parsedLimit = limit ? parseInt(limit as string) : 50;

    const history = notificationService.getHistory(customerId, parsedLimit);

    res.json({
      success: true,
      data: history,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * GET /api/notifications/:customerId/preferences — Get customer preferences
 */
router.get("/:customerId/preferences", (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const preferences = PreferenceManager.getPreferences(customerId);

    res.json({
      success: true,
      data: preferences,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * PUT /api/notifications/:customerId/preferences — Update customer preferences
 */
router.put("/:customerId/preferences", (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const validated = PreferencesSchema.parse(req.body);

    PreferenceManager.updatePreferences(customerId, {
      customerId,
      channels: validated.channels as any,
      updatedAt: new Date(),
    });

    const updated = PreferenceManager.getPreferences(customerId);

    res.json({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * GET /api/notifications/:customerId/rate-limit/:channel — Get rate limit status
 */
router.get("/:customerId/rate-limit/:channel", (req: Request, res: Response) => {
  try {
    const { customerId, channel } = req.params;

    if (!["email", "sms", "whatsapp", "push"].includes(channel)) {
      return res.status(400).json({
        success: false,
        error: "Invalid channel",
      });
    }

    const status = rateLimiter.getStatus(customerId, channel as any);

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * POST /api/notifications/webhooks — Register a webhook
 */
router.post("/webhooks", (req: Request, res: Response) => {
  try {
    const validated = WebhookSchema.parse(req.body);

    const webhook = WebhookManager.registerWebhook(
      validated.url,
      validated.events as any,
      validated.secret
    );

    res.status(201).json({
      success: true,
      data: webhook,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * GET /api/notifications/webhooks — List webhooks
 */
router.get("/webhooks", (req: Request, res: Response) => {
  try {
    const webhooks = WebhookManager.listWebhooks();

    res.json({
      success: true,
      data: webhooks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * GET /api/notifications/webhooks/:id — Get webhook by ID
 */
router.get("/webhooks/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const webhook = WebhookManager.getWebhook(id);

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: "Webhook not found",
      });
    }

    res.json({
      success: true,
      data: webhook,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * PUT /api/notifications/webhooks/:id — Update webhook
 */
router.put("/webhooks/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const updated = WebhookManager.updateWebhook(id, req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Webhook not found",
      });
    }

    res.json({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * DELETE /api/notifications/webhooks/:id — Delete webhook
 */
router.delete("/webhooks/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = WebhookManager.deleteWebhook(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Webhook not found",
      });
    }

    res.json({
      success: true,
      message: "Webhook deleted",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * POST /api/notifications/shorten-url — Shorten a URL
 */
router.post("/shorten-url", (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "URL is required",
      });
    }

    const result = urlShortener.shortenUrl(url);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    res.status(400).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * GET /api/notifications/url-stats/:code — Get URL shortener stats
 */
router.get("/url-stats/:code", (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    const stats = urlShortener.getStats(code);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: "URL not found or expired",
      });
    }

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * GET /api/notifications/templates/:eventType — Get template for event
 */
router.get("/templates/:eventType", (req: Request, res: Response) => {
  try {
    const { eventType } = req.params;

    const template = TemplateEngine.getTemplate(eventType as any);

    res.json({
      success: true,
      data: template,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    res.status(404).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * GET /api/notifications/templates — List available templates
 */
router.get("/templates", (req: Request, res: Response) => {
  try {
    const eventTypes = TemplateEngine.listEventTypes();

    res.json({
      success: true,
      data: eventTypes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

export default router;
