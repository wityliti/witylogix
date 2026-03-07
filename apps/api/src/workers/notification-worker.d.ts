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
import { Worker } from "bullmq";
export declare function startNotificationWorker(): Worker;
//# sourceMappingURL=notification-worker.d.ts.map