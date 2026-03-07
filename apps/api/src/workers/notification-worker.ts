/**
 * Notification Worker — multi-provider, BYOK-aware notification processing.
 *
 * Architecture mirrors the routing optimization worker:
 *   1. Receive job with shopId + channels + recipient
 *   2. Load tenant's notification config from shop.settings.notifications
 *   3. Resolve provider per channel (tenant → deployer fallback + metering)
 *   4. Dispatch to the resolved provider
 *   5. Log result to notification_logs table
 *
 * Multi-provider support:
 *   When NOTIFICATIONS_BYOK=true, the worker reads the tenant's chosen
 *   provider + credentials from shop.settings.notifications.<channel>.
 *   If the tenant hasn't configured anything, falls back to the deployer's
 *   default provider and metering kicks in automatically.
 *
 * Channels:
 *   - Email:    SendGrid (available), Mailgun, SES, Postmark, Resend, SMTP
 *   - SMS:      Twilio (available), Vonage, SNS, MessageBird, Plivo
 *   - WhatsApp: Meta Cloud API (available), Twilio WhatsApp, 360dialog
 *   - Push:     Firebase FCM (available), OneSignal, Expo Push
 */

import { Worker, type Job } from "bullmq";
import { forTenant } from "@witylogix/db";
import { getConfig } from "../lib/config.js";
import type { NotificationJobData } from "../lib/queue.js";
import { registerWorker } from "../lib/queue.js";
import {
  resolveNotificationProvider,
  type NotificationChannel,
  type TenantNotificationConfig,
  type ChannelCredentials,
  type ResolvedNotificationProvider,
} from "@witylogix/core/notifications";

// ─── Channel Dispatchers ────────────────────────────────────
//
// Each dispatcher receives the resolved provider info and uses the
// appropriate SDK/API. Phase 1 implementations are stubs that log
// the call; concrete SDK integrations follow one-by-one.

async function sendEmail(
  resolved: ResolvedNotificationProvider,
  recipient: string,
  eventType: string,
  templateData: Record<string, unknown>,
): Promise<{ providerId?: string }> {
  if (!resolved.available) {
    console.warn(
      `[notification-worker] Email not configured (provider: ${resolved.provider}), skipping`,
    );
    return {};
  }

  switch (resolved.provider) {
    case "sendgrid": {
      const apiKey = resolved.credentials.SENDGRID_API_KEY ??
        resolved.credentials.apiKey;
      if (!apiKey) {
        console.warn("[notification-worker] SendGrid API key missing, skipping email");
        return {};
      }
      // TODO: Implement SendGrid integration
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(apiKey as string);
      // const result = await sgMail.send({ to: recipient, ... });
      // return { providerId: result[0]?.headers['x-message-id'] };
      console.info(
        `[notification-worker] Email via SendGrid to ${recipient}: ${eventType}` +
          (resolved.usedFallback ? " [FALLBACK]" : ""),
      );
      return { providerId: `sg_${Date.now()}` };
    }

    case "mailgun": {
      // TODO: Implement Mailgun
      console.info(`[notification-worker] Email via Mailgun to ${recipient}: ${eventType}`);
      return { providerId: `mg_${Date.now()}` };
    }

    case "postmark": {
      // TODO: Implement Postmark
      console.info(`[notification-worker] Email via Postmark to ${recipient}: ${eventType}`);
      return { providerId: `pm_${Date.now()}` };
    }

    case "resend": {
      // TODO: Implement Resend
      console.info(`[notification-worker] Email via Resend to ${recipient}: ${eventType}`);
      return { providerId: `re_${Date.now()}` };
    }

    case "aws_ses": {
      // TODO: Implement AWS SES
      console.info(`[notification-worker] Email via AWS SES to ${recipient}: ${eventType}`);
      return { providerId: `ses_${Date.now()}` };
    }

    case "smtp": {
      // TODO: Implement SMTP (nodemailer)
      console.info(`[notification-worker] Email via SMTP to ${recipient}: ${eventType}`);
      return { providerId: `smtp_${Date.now()}` };
    }

    default:
      console.warn(`[notification-worker] Unknown email provider: ${resolved.provider}`);
      return {};
  }
}

async function sendSMS(
  resolved: ResolvedNotificationProvider,
  recipient: string,
  eventType: string,
  templateData: Record<string, unknown>,
): Promise<{ providerId?: string }> {
  if (!resolved.available) {
    console.warn(
      `[notification-worker] SMS not configured (provider: ${resolved.provider}), skipping`,
    );
    return {};
  }

  switch (resolved.provider) {
    case "twilio": {
      const accountSid = resolved.credentials.TWILIO_ACCOUNT_SID ??
        resolved.credentials.accountSid;
      const authToken = resolved.credentials.TWILIO_AUTH_TOKEN ??
        resolved.credentials.authToken;
      if (!accountSid || !authToken) {
        console.warn("[notification-worker] Twilio credentials missing, skipping SMS");
        return {};
      }
      // TODO: Implement Twilio SMS
      // const client = require('twilio')(accountSid, authToken);
      // const message = await client.messages.create({ ... });
      // return { providerId: message.sid };
      console.info(
        `[notification-worker] SMS via Twilio to ${recipient}: ${eventType}` +
          (resolved.usedFallback ? " [FALLBACK]" : ""),
      );
      return { providerId: `tw_${Date.now()}` };
    }

    case "vonage": {
      // TODO: Implement Vonage
      console.info(`[notification-worker] SMS via Vonage to ${recipient}: ${eventType}`);
      return { providerId: `vn_${Date.now()}` };
    }

    case "aws_sns": {
      // TODO: Implement AWS SNS
      console.info(`[notification-worker] SMS via AWS SNS to ${recipient}: ${eventType}`);
      return { providerId: `sns_${Date.now()}` };
    }

    case "messagebird": {
      // TODO: Implement MessageBird
      console.info(`[notification-worker] SMS via MessageBird to ${recipient}: ${eventType}`);
      return { providerId: `mb_${Date.now()}` };
    }

    case "plivo": {
      // TODO: Implement Plivo
      console.info(`[notification-worker] SMS via Plivo to ${recipient}: ${eventType}`);
      return { providerId: `pv_${Date.now()}` };
    }

    default:
      console.warn(`[notification-worker] Unknown SMS provider: ${resolved.provider}`);
      return {};
  }
}

async function sendWhatsApp(
  resolved: ResolvedNotificationProvider,
  recipient: string,
  eventType: string,
  templateData: Record<string, unknown>,
): Promise<{ providerId?: string }> {
  if (!resolved.available) {
    console.warn(
      `[notification-worker] WhatsApp not configured (provider: ${resolved.provider}), skipping`,
    );
    return {};
  }

  switch (resolved.provider) {
    case "meta_cloud": {
      const token = resolved.credentials.WHATSAPP_TOKEN ??
        resolved.credentials.accessToken;
      const phoneId = resolved.credentials.WHATSAPP_PHONE_NUMBER_ID ??
        resolved.credentials.phoneNumberId;
      if (!token || !phoneId) {
        console.warn("[notification-worker] WhatsApp Cloud API credentials missing, skipping");
        return {};
      }
      // TODO: Implement Meta Cloud API WhatsApp
      // const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, { ... });
      console.info(
        `[notification-worker] WhatsApp via Meta Cloud to ${recipient}: ${eventType}` +
          (resolved.usedFallback ? " [FALLBACK]" : ""),
      );
      return { providerId: `wa_${Date.now()}` };
    }

    case "twilio_whatsapp": {
      // TODO: Implement Twilio WhatsApp
      console.info(`[notification-worker] WhatsApp via Twilio to ${recipient}: ${eventType}`);
      return { providerId: `twa_${Date.now()}` };
    }

    case "360dialog": {
      // TODO: Implement 360dialog
      console.info(`[notification-worker] WhatsApp via 360dialog to ${recipient}: ${eventType}`);
      return { providerId: `d360_${Date.now()}` };
    }

    default:
      console.warn(`[notification-worker] Unknown WhatsApp provider: ${resolved.provider}`);
      return {};
  }
}

async function sendPush(
  resolved: ResolvedNotificationProvider,
  fcmToken: string,
  eventType: string,
  templateData: Record<string, unknown>,
): Promise<{ providerId?: string }> {
  if (!resolved.available) {
    console.warn(
      `[notification-worker] Push not configured (provider: ${resolved.provider}), skipping`,
    );
    return {};
  }

  switch (resolved.provider) {
    case "firebase": {
      const projectId = resolved.credentials.FIREBASE_PROJECT_ID ??
        resolved.credentials.projectId;
      if (!projectId) {
        console.warn("[notification-worker] Firebase project ID missing, skipping push");
        return {};
      }
      // TODO: Implement Firebase Cloud Messaging
      // const admin = require('firebase-admin');
      console.info(
        `[notification-worker] Push via Firebase to token: ${eventType}` +
          (resolved.usedFallback ? " [FALLBACK]" : ""),
      );
      return { providerId: `fcm_${Date.now()}` };
    }

    case "onesignal": {
      // TODO: Implement OneSignal
      console.info(`[notification-worker] Push via OneSignal: ${eventType}`);
      return { providerId: `os_${Date.now()}` };
    }

    case "expo_push": {
      // TODO: Implement Expo Push
      console.info(`[notification-worker] Push via Expo: ${eventType}`);
      return { providerId: `expo_${Date.now()}` };
    }

    default:
      console.warn(`[notification-worker] Unknown push provider: ${resolved.provider}`);
      return {};
  }
}

// ─── Channel→NotificationChannel mapper ─────────────────────

const CHANNEL_MAP: Record<string, NotificationChannel> = {
  EMAIL: "email",
  SMS: "sms",
  WHATSAPP: "whatsapp",
  PUSH: "push",
};

// ─── Worker ─────────────────────────────────────────────────

export function startNotificationWorker(): Worker {
  const config = getConfig();
  const connection = {
    host: new URL(config.REDIS_URL).hostname || "localhost",
    port: Number(new URL(config.REDIS_URL).port) || 6379,
  };

  const worker = new Worker<NotificationJobData>(
    "notifications",
    async (job: Job<NotificationJobData>) => {
      const { shopId, orderId, eventType, channels, recipient, templateData } = job.data;
      const db = forTenant(shopId);

      // ── Load tenant notification config ─────────────────
      let tenantNotifConfig: TenantNotificationConfig | undefined;

      if (config.NOTIFICATIONS_BYOK) {
        const shop = await db.shop.findUnique({
          where: { id: shopId },
          select: { settings: true },
        });
        const settings = (shop?.settings ?? {}) as Record<string, unknown>;
        const notifications = settings.notifications as TenantNotificationConfig | undefined;
        if (notifications) {
          tenantNotifConfig = notifications;
        }
      }

      // ── Process each channel ────────────────────────────
      const results: Array<{
        channel: string;
        provider: string;
        usedFallback: boolean;
        status: "SENT" | "FAILED" | "SKIPPED";
        providerId?: string;
        error?: string;
      }> = [];

      for (const channel of channels) {
        const notifChannel = CHANNEL_MAP[channel];
        if (!notifChannel) {
          results.push({
            channel,
            provider: "unknown",
            usedFallback: false,
            status: "FAILED",
            error: `Unknown channel: ${channel}`,
          });
          continue;
        }

        // Resolve provider for this channel
        const channelCreds = tenantNotifConfig?.[notifChannel] as
          | ChannelCredentials
          | undefined;
        const resolved = resolveNotificationProvider(
          notifChannel,
          channelCreds,
          shopId,
        );

        if (!resolved.available) {
          results.push({
            channel,
            provider: resolved.provider,
            usedFallback: resolved.usedFallback,
            status: "SKIPPED",
            error: `${notifChannel} provider not configured`,
          });
          continue;
        }

        try {
          let result: { providerId?: string } = {};

          switch (notifChannel) {
            case "email":
              if (recipient.email) {
                result = await sendEmail(resolved, recipient.email, eventType, templateData);
              }
              break;
            case "sms":
              if (recipient.phone) {
                result = await sendSMS(resolved, recipient.phone, eventType, templateData);
              }
              break;
            case "whatsapp":
              if (recipient.phone) {
                result = await sendWhatsApp(resolved, recipient.phone, eventType, templateData);
              }
              break;
            case "push":
              if (recipient.fcmToken) {
                result = await sendPush(resolved, recipient.fcmToken, eventType, templateData);
              }
              break;
          }

          // Log success
          await db.notificationLog.create({
            data: {
              shopId,
              orderId,
              channel,
              eventType,
              recipient: recipient.email || recipient.phone || "unknown",
              status: "SENT",
              providerMsgId: result.providerId,
              sentAt: new Date(),
            },
          });

          results.push({
            channel,
            provider: resolved.provider,
            usedFallback: resolved.usedFallback,
            status: "SENT",
            providerId: result.providerId,
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";

          // Log failure
          await db.notificationLog.create({
            data: {
              shopId,
              orderId,
              channel,
              eventType,
              recipient: recipient.email || recipient.phone || "unknown",
              status: "FAILED",
              errorMessage,
            },
          });

          results.push({
            channel,
            provider: resolved.provider,
            usedFallback: resolved.usedFallback,
            status: "FAILED",
            error: errorMessage,
          });
        }
      }

      return results;
    },
    {
      connection,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 60000, // 100 per minute per worker
      },
    },
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[notification-worker] Job ${job?.id} failed:`,
      err.message,
    );
  });

  worker.on("completed", (job) => {
    console.info(`[notification-worker] Job ${job.id} completed`);
  });

  registerWorker(worker);
  console.info("[notification-worker] Started");
  return worker;
}
