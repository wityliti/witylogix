/**
 * Notifications module — multi-provider registry, factory, and metering.
 *
 * Architecture mirrors the routing module:
 *
 *   ┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐
 *   │  Deployer    │    │  Tenant (Shop)   │    │  Channel         │
 *   │  .env config │──▶│  shop.settings   │──▶│  Registries      │
 *   └─────────────┘    └──────────────────┘    └──────┬───────────┘
 *         │                                           │
 *         ▼                                           ▼
 *   EMAIL_PROVIDER=sendgrid            resolveNotificationProvider()
 *   NOTIFICATIONS_BYOK=true            tenant → deployer fallback
 *   SENDGRID_API_KEY=SG.xxx            + metering
 *
 * Four independent channels, each with its own provider registry:
 *   ✅ Email:    SendGrid (available), Mailgun, SES, Postmark, Resend, SMTP
 *   ✅ SMS:      Twilio (available), Vonage, SNS, MessageBird, Plivo
 *   ✅ WhatsApp: Meta Cloud API (available), Twilio WhatsApp, 360dialog
 *   ✅ Push:     Firebase FCM (available), OneSignal, Expo Push
 *
 * Resolution per channel:
 *   1. Tenant has configured provider + credentials → use tenant's
 *   2. Fall back to deployer's env credentials → emit metering event
 *   3. No credentials → skip channel with warning
 */

export type {
  NotificationChannel,
  SendResult,
  NotifAuthType,
  EmailProviderSlug,
  EmailProvider,
  EmailProviderMeta,
  SMSProviderSlug,
  SMSProvider,
  SMSProviderMeta,
  WhatsAppProviderSlug,
  WhatsAppProvider,
  WhatsAppProviderMeta,
  PushProviderSlug,
  PushProvider,
  PushProviderMeta,
  CredentialField,
  NotificationMeterEvent,
} from "./provider.js";

export {
  EMAIL_REGISTRY,
  SMS_REGISTRY,
  WHATSAPP_REGISTRY,
  PUSH_REGISTRY,
  getNotificationRegistry,
  getAllNotificationRegistries,
  getNotificationProviderMeta,
} from "./registry.js";

// ─── Provider Implementations ──────────────────────────────────

export type {
  NotificationProvider,
  NotificationMessage,
  NotificationResult,
  ProviderStatus,
  Attachment,
} from "./providers/index.js";

export {
  ProviderError,
  RateLimitError,
  InvalidRecipientError,
  AuthenticationError,
  SendGridEmailProvider,
  TwilioSMSProvider,
  FirebasePushProvider,
  WhatsAppProvider as WhatsAppBusinessProvider,
} from "./providers/index.js";

// ─── Provider Registry ────────────────────────────────────────

export type {
  ProviderHealthRecord,
} from "./provider-registry.js";

export {
  TenantProviderRegistry,
  getTenantProviderRegistry,
  clearTenantRegistry,
  clearAllRegistries,
  getRegistryStats,
} from "./provider-registry.js";

// ─── Orchestrator ─────────────────────────────────────────────

export type {
  NotificationTemplate,
  DeliveryLogEntry,
  RetryOptions,
} from "./orchestrator.js";

export {
  NotificationOrchestrator,
  getNotificationOrchestrator,
  setOrchestratorRetryOptions,
} from "./orchestrator.js";

import type {
  NotificationChannel,
  NotificationMeterEvent,
} from "./provider.js";

// ─── Types ─────────────────────────────────────────────────

/**
 * Per-channel credentials from shop.settings.notifications.<channel>
 * Example: settings.notifications.email = { provider: "sendgrid", apiKey: "SG.xxx", fromEmail: "x@y.com" }
 */
export interface ChannelCredentials {
  provider?: string;
  [key: string]: unknown;
}

/**
 * Full tenant notification config from shop.settings.notifications
 */
export interface TenantNotificationConfig {
  email?: ChannelCredentials;
  sms?: ChannelCredentials;
  whatsapp?: ChannelCredentials;
  push?: ChannelCredentials;
}

/**
 * Result of resolving which provider + credentials to use for a channel.
 */
export interface ResolvedNotificationProvider {
  channel: NotificationChannel;
  provider: string;
  credentials: Record<string, unknown>;
  usedFallback: boolean;
  available: boolean;
}

// ─── Metering ──────────────────────────────────────────────

export type NotificationMeteringCallback = (
  event: NotificationMeterEvent,
) => void | Promise<void>;

let _notifMeteringCallback: NotificationMeteringCallback | null = null;

/**
 * Register a global metering callback for notification fallback usage.
 */
export function onNotificationMeter(
  callback: NotificationMeteringCallback,
): void {
  _notifMeteringCallback = callback;
}

/**
 * Emit a notification metering event.
 */
export function emitNotificationMeterEvent(
  event: NotificationMeterEvent,
): void {
  if (_notifMeteringCallback) {
    Promise.resolve(_notifMeteringCallback(event)).catch((err) => {
      console.error("[notifications:metering] Callback error:", err);
    });
  }
}

// ─── Deployer Defaults ─────────────────────────────────────

/** Maps channel to deployer env var names for credential resolution. */
const DEPLOYER_ENV_MAP: Record<
  NotificationChannel,
  { providerEnv: string; defaultProvider: string; credentialEnvs: Record<string, string[]> }
> = {
  email: {
    providerEnv: "EMAIL_PROVIDER",
    defaultProvider: "sendgrid",
    credentialEnvs: {
      sendgrid: ["SENDGRID_API_KEY"],
      mailgun: ["MAILGUN_API_KEY", "MAILGUN_DOMAIN"],
      aws_ses: ["AWS_SES_ACCESS_KEY_ID", "AWS_SES_SECRET_ACCESS_KEY", "AWS_SES_REGION"],
      postmark: ["POSTMARK_SERVER_TOKEN"],
      resend: ["RESEND_API_KEY"],
      smtp: ["SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD"],
    },
  },
  sms: {
    providerEnv: "SMS_PROVIDER",
    defaultProvider: "twilio",
    credentialEnvs: {
      twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
      vonage: ["VONAGE_API_KEY", "VONAGE_API_SECRET"],
      aws_sns: ["AWS_SNS_ACCESS_KEY_ID", "AWS_SNS_SECRET_ACCESS_KEY", "AWS_SNS_REGION"],
      messagebird: ["MESSAGEBIRD_API_KEY"],
      plivo: ["PLIVO_AUTH_ID", "PLIVO_AUTH_TOKEN"],
    },
  },
  whatsapp: {
    providerEnv: "WHATSAPP_PROVIDER",
    defaultProvider: "meta_cloud",
    credentialEnvs: {
      meta_cloud: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
      twilio_whatsapp: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
      "360dialog": ["DIALOG360_API_KEY"],
    },
  },
  push: {
    providerEnv: "PUSH_PROVIDER",
    defaultProvider: "firebase",
    credentialEnvs: {
      firebase: ["FIREBASE_PROJECT_ID", "FIREBASE_PRIVATE_KEY", "FIREBASE_CLIENT_EMAIL"],
      onesignal: ["ONESIGNAL_APP_ID", "ONESIGNAL_REST_API_KEY"],
      expo_push: [],
    },
  },
};

/**
 * Resolve which provider and credentials to use for a given channel.
 *
 * Resolution:
 *   1. If BYOK enabled and tenant has configured this channel → use tenant's
 *   2. Otherwise → deployer's env-based credentials (metered if BYOK)
 *   3. If nothing configured → mark as unavailable
 */
export function resolveNotificationProvider(
  channel: NotificationChannel,
  tenantConfig?: ChannelCredentials,
  shopId?: string,
): ResolvedNotificationProvider {
  const byok = process.env.NOTIFICATIONS_BYOK === "true";
  const envMap = DEPLOYER_ENV_MAP[channel];

  // ── Attempt 1: Tenant's own provider ──────────────────────
  if (byok && tenantConfig?.provider) {
    const creds = { ...tenantConfig };
    delete creds.provider;
    const hasAnyCred = Object.values(creds).some((v) => Boolean(v));

    if (hasAnyCred) {
      return {
        channel,
        provider: tenantConfig.provider,
        credentials: creds,
        usedFallback: false,
        available: true,
      };
    }
  }

  // ── Attempt 2: Deployer fallback ──────────────────────────
  const deployerProvider =
    process.env[envMap.providerEnv] || envMap.defaultProvider;
  const envKeys = envMap.credentialEnvs[deployerProvider] ?? [];
  const deployerCreds: Record<string, unknown> = {};

  for (const envKey of envKeys) {
    const value = process.env[envKey];
    if (value) {
      deployerCreds[envKey] = value;
    }
  }

  const hasDeployerCreds = Object.keys(deployerCreds).length > 0;

  if (hasDeployerCreds) {
    // Emit metering event if BYOK is enabled (tenant is borrowing deployer creds)
    if (byok && shopId) {
      emitNotificationMeterEvent({
        shopId,
        channel,
        provider: deployerProvider,
        operation: "send",
        usedFallback: true,
        timestamp: new Date(),
      });
    }

    return {
      channel,
      provider: deployerProvider,
      credentials: deployerCreds,
      usedFallback: true,
      available: true,
    };
  }

  // ── Nothing configured ────────────────────────────────────
  return {
    channel,
    provider: deployerProvider,
    credentials: {},
    usedFallback: true,
    available: false,
  };
}

/**
 * Resolve all channels at once. Returns a map of channel → resolved state.
 */
export function resolveAllNotificationProviders(
  tenantConfig?: TenantNotificationConfig,
  shopId?: string,
): Record<NotificationChannel, ResolvedNotificationProvider> {
  return {
    email: resolveNotificationProvider("email", tenantConfig?.email, shopId),
    sms: resolveNotificationProvider("sms", tenantConfig?.sms, shopId),
    whatsapp: resolveNotificationProvider(
      "whatsapp",
      tenantConfig?.whatsapp,
      shopId,
    ),
    push: resolveNotificationProvider("push", tenantConfig?.push, shopId),
  };
}

// ─── NOTIFICATION TYPES (v2) ───────────────────────────────────────────

export type {
  NotificationTemplate as NotificationTemplateV2,
  RecipientPreferences,
  NotificationRequest,
  BatchNotificationRequest,
  NotificationWithReceipts,
  DeliveryReceipt,
  ChannelConfig,
  PriorityMatrix,
  QuietHoursConfig,
  DigestConfig,
  ChannelPreference,
  ChannelTemplate,
} from "./notification-types.js";

export {
  NotificationChannel,
  NotificationPriority,
  NotificationCategory,
  DeliveryStatus,
  NotificationChannelSchema,
  NotificationPrioritySchema,
  NotificationCategorySchema,
  DeliveryStatusSchema,
  NotificationRequestSchema,
  BatchNotificationRequestSchema,
  RecipientPreferencesSchema,
} from "./notification-types.js";

// ─── TEMPLATE ENGINE ───────────────────────────────────────────────────

export {
  HandlebarsCompiler,
  ChannelFormatter,
  TemplateRegistry,
  TemplateValidator,
  TemplateLocalizer,
  TemplatePreview,
} from "./template-engine.js";

// ─── NOTIFICATION ORCHESTRATOR v2 ──────────────────────────────────────

export type { } from "./notification-orchestrator-v2.js";

export {
  ChannelRouter,
  FallbackChain,
  QuietHoursManager,
  DigestBatcher,
  DeliveryTracker,
  RetryManager,
  NotificationThrottler,
  NotificationOrchestratorV2,
  getNotificationOrchestratorV2,
  resetNotificationOrchestratorV2,
} from "./notification-orchestrator-v2.js";

// ─── NOTIFICATION API ──────────────────────────────────────────────────

export type {
  ApiResponse,
  PaginatedResponse,
  NotificationListItem,
  NotificationDetail,
  AnalyticsResult,
} from "./notification-api.js";

export {
  SendNotificationRequestSchema,
  SendBatchNotificationRequestSchema,
  ListNotificationsQuerySchema,
  GetNotificationRequestSchema,
  MarkAsReadRequestSchema,
  UpdatePreferencesRequestSchema,
  CreateTemplateRequestSchema,
  ListTemplatesQuerySchema,
  AnalyticsQuerySchema,
  TestNotificationRequestSchema,
  createNotificationApiHandlers,
  getNotificationApiHandlers,
} from "./notification-api.js";
