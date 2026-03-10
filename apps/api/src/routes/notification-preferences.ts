import { Router, Request, Response } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

/**
 * Validation schemas
 */
const PreferencesSchema = z.object({
  email_enabled: z.boolean().default(true),
  sms_enabled: z.boolean().default(true),
  whatsapp_enabled: z.boolean().default(false),
  push_enabled: z.boolean().default(true),
  quiet_hours_enabled: z.boolean().default(false),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
  quiet_hours_timezone: z.string().default("UTC"),
  preferred_channel: z.enum(["email", "sms", "whatsapp", "push"]).default("email"),
  marketing_consent: z.boolean().default(false),
  event_preferences: z.record(z.string(), z.boolean()).optional(),
});

type PreferencesInput = z.infer<typeof PreferencesSchema>;

/**
 * GET /notifications/preferences/:customerId
 * Get customer notification preferences
 */
router.get(
  "/notifications/preferences/:customerId",
  async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;

      // Validate customerId
      if (!customerId || typeof customerId !== "string") {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      // Fetch or create default preferences
      let preferences = await (prisma as any).notificationPreference.findUnique({
        where: { customerId },
      });

      if (!preferences) {
        // Create default preferences
        preferences = await (prisma as any).notificationPreference.create({
          data: {
            customerId,
            email_enabled: true,
            sms_enabled: true,
            whatsapp_enabled: false,
            push_enabled: true,
            quiet_hours_enabled: false,
            quiet_hours_timezone: "UTC",
            preferred_channel: "email",
            marketing_consent: false,
            event_preferences: {
              order_confirmed: true,
              delivery_scheduled: true,
              out_for_delivery: true,
              delivery_arriving: true,
              delivered: true,
              delivery_failed: true,
              rescheduled: true,
            },
          },
        });
      }

      return res.json({
        customerId,
        ...preferences,
        updatedAt: preferences.updatedAt || new Date(),
      });
    } catch (error) {
      console.error("Error fetching preferences:", error);
      return res.status(500).json({ error: "Failed to fetch preferences" });
    }
  }
);

/**
 * PUT /notifications/preferences/:customerId
 * Update customer notification preferences
 */
router.put(
  "/notifications/preferences/:customerId",
  async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;

      // Validate customerId
      if (!customerId || typeof customerId !== "string") {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      // Validate input
      const validatedData = PreferencesSchema.parse(req.body);

      // Update or create preferences
      const preferences = await (prisma as any).notificationPreference.upsert({
        where: { customerId },
        create: {
          customerId,
          ...validatedData,
        },
        update: {
          ...validatedData,
          updatedAt: new Date(),
        },
      });

      return res.json({
        customerId,
        ...preferences,
        message: "Preferences updated successfully",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating preferences:", error);
      return res.status(500).json({ error: "Failed to update preferences" });
    }
  }
);

/**
 * POST /notifications/preferences/unsubscribe
 * Handle unsubscribe request via link
 */
router.post(
  "/notifications/preferences/unsubscribe",
  async (req: Request, res: Response) => {
    try {
      const { customerId, channel, token } = req.body;

      // Validate required fields
      if (!customerId || !channel) {
        return res.status(400).json({
          error: "Missing required fields: customerId, channel",
        });
      }

      // Verify unsubscribe token (in production, implement proper token validation)
      if (!token || token.length < 10) {
        return res.status(401).json({ error: "Invalid unsubscribe token" });
      }

      // Update preferences
      const channelKey = `${channel}_enabled`;
      const updateData = {
        [channelKey]: false,
        updatedAt: new Date(),
      };

      const preferences = await (prisma as any).notificationPreference.upsert({
        where: { customerId },
        create: {
          customerId,
          ...updateData,
        },
        update: updateData,
      });

      return res.json({
        message: `Successfully unsubscribed from ${channel} notifications`,
        customerId,
        preferences,
      });
    } catch (error) {
      console.error("Error processing unsubscribe:", error);
      return res.status(500).json({ error: "Failed to process unsubscribe" });
    }
  }
);

/**
 * GET /notifications/preferences/:customerId/check
 * Check if notification should be sent
 */
router.get(
  "/notifications/preferences/:customerId/check",
  async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const { channel, eventType } = req.query;

      if (!customerId || !channel || !eventType) {
        return res.status(400).json({
          error: "Missing required parameters: customerId, channel, eventType",
        });
      }

      // Fetch preferences
      const preferences = await (prisma as any).notificationPreference.findUnique({
        where: { customerId },
      });

      if (!preferences) {
        return res.json({
          canSend: true,
          reason: "No preferences found, using defaults",
        });
      }

      // Check channel enabled
      const channelKey = `${channel}_enabled`;
      const isChannelEnabled = preferences[channelKey] !== false;

      if (!isChannelEnabled) {
        return res.json({
          canSend: false,
          reason: `${channel} is disabled`,
        });
      }

      // Check event preferences
      const eventPrefs = preferences.event_preferences || {};
      const isEventEnabled = eventPrefs[eventType as string] !== false;

      if (!isEventEnabled) {
        return res.json({
          canSend: false,
          reason: `${eventType} is disabled for this customer`,
        });
      }

      // Check quiet hours
      if (preferences.quiet_hours_enabled) {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
          now.getMinutes()
        ).padStart(2, "0")}`;
        const startTime = preferences.quiet_hours_start || "22:00";
        const endTime = preferences.quiet_hours_end || "08:00";

        // Simple comparison - in production, use proper timezone handling
        if (currentTime >= startTime || currentTime < endTime) {
          return res.json({
            canSend: false,
            reason: "During quiet hours",
            quietHours: { start: startTime, end: endTime },
          });
        }
      }

      return res.json({
        canSend: true,
        reason: "All checks passed",
        preferences: {
          channelEnabled: isChannelEnabled,
          eventEnabled: isEventEnabled,
        },
      });
    } catch (error) {
      console.error("Error checking preferences:", error);
      return res.status(500).json({ error: "Failed to check preferences" });
    }
  }
);

/**
 * PATCH /notifications/preferences/:customerId/quiet-hours
 * Update quiet hours settings
 */
router.patch(
  "/notifications/preferences/:customerId/quiet-hours",
  async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const { enabled, startTime, endTime, timezone } = req.body;

      if (!customerId) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      const updateData = {
        quiet_hours_enabled: enabled,
        quiet_hours_start: startTime || "22:00",
        quiet_hours_end: endTime || "08:00",
        quiet_hours_timezone: timezone || "UTC",
        updatedAt: new Date(),
      };

      const preferences = await (prisma as any).notificationPreference.upsert({
        where: { customerId },
        create: {
          customerId,
          ...updateData,
        },
        update: updateData,
      });

      return res.json({
        message: "Quiet hours updated successfully",
        preferences,
      });
    } catch (error) {
      console.error("Error updating quiet hours:", error);
      return res.status(500).json({ error: "Failed to update quiet hours" });
    }
  }
);

/**
 * PATCH /notifications/preferences/:customerId/channel/:channel
 * Enable/disable specific channel
 */
router.patch(
  "/notifications/preferences/:customerId/channel/:channel",
  async (req: Request, res: Response) => {
    try {
      const { customerId, channel } = req.params;
      const { enabled } = req.body;

      if (!customerId || !channel) {
        return res.status(400).json({
          error: "Missing required parameters: customerId, channel",
        });
      }

      const channelKey = `${channel}_enabled`;
      const updateData = {
        [channelKey]: enabled === true,
        updatedAt: new Date(),
      };

      const preferences = await (prisma as any).notificationPreference.upsert({
        where: { customerId },
        create: {
          customerId,
          ...updateData,
        },
        update: updateData,
      });

      return res.json({
        message: `${channel} notifications ${enabled ? "enabled" : "disabled"}`,
        preferences,
      });
    } catch (error) {
      console.error("Error updating channel preference:", error);
      return res.status(500).json({ error: "Failed to update channel preference" });
    }
  }
);

/**
 * GET /notifications/preferences/:customerId/bulk
 * Get preferences for multiple customers
 */
router.post(
  "/notifications/preferences/bulk",
  async (req: Request, res: Response) => {
    try {
      const { customerIds } = req.body;

      if (!Array.isArray(customerIds) || customerIds.length === 0) {
        return res.status(400).json({
          error: "customerIds must be a non-empty array",
        });
      }

      const preferences = await (prisma as any).notificationPreference.findMany({
        where: {
          customerId: { in: customerIds },
        },
      });

      return res.json({
        count: preferences.length,
        preferences,
      });
    } catch (error) {
      console.error("Error fetching bulk preferences:", error);
      return res.status(500).json({ error: "Failed to fetch preferences" });
    }
  }
);

export default router;
