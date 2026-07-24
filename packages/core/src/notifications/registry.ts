/**
 * Notification Provider Registry — static metadata for all channels.
 *
 * Pattern mirrors the routing provider registry:
 * - Each channel has its own registry of providers
 * - Providers are listed with status "available" or "coming_soon"
 * - The Settings UI reads this to render provider cards + credential forms
 * - Providers are implemented one-by-one
 */

import type {
  EmailProviderMeta,
  SMSProviderMeta,
  WhatsAppProviderMeta,
  PushProviderMeta,
  NotificationChannel,
} from "./provider.js";

// ─── Email Providers ───────────────────────────────────────

export const EMAIL_REGISTRY: ReadonlyMap<string, EmailProviderMeta> = new Map([
  [
    "sendgrid",
    {
      slug: "sendgrid",
      displayName: "SendGrid",
      description:
        "Twilio SendGrid — reliable transactional email with template " +
        "support, analytics, and deliverability tools.",
      authType: "api_key",
      credentials: [
        {
          key: "apiKey",
          label: "API Key",
          placeholder: "SG.xxxxxxxxxxxxxxxxxxxx",
          type: "password" as const,
          required: true,
          helpUrl: "https://app.sendgrid.com/settings/api_keys",
          pattern: /^SG\./,
        },
        {
          key: "fromEmail",
          label: "From Email",
          placeholder: "noreply@yourdomain.com",
          type: "text" as const,
          required: true,
        },
        {
          key: "fromName",
          label: "From Name",
          placeholder: "Your Company",
          type: "text" as const,
          required: false,
        },
      ],
      status: "available",
    },
  ],
  [
    "mailgun",
    {
      slug: "mailgun",
      displayName: "Mailgun",
      description:
        "Mailgun by Sinch — powerful email API with templates, " +
        "analytics, and email validation.",
      authType: "api_key",
      credentials: [
        {
          key: "apiKey",
          label: "API Key",
          placeholder: "key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          type: "password" as const,
          required: true,
          helpUrl: "https://app.mailgun.com/app/account/security/api_keys",
        },
        {
          key: "domain",
          label: "Domain",
          placeholder: "mg.yourdomain.com",
          type: "text" as const,
          required: true,
        },
        {
          key: "fromEmail",
          label: "From Email",
          placeholder: "noreply@yourdomain.com",
          type: "text" as const,
          required: true,
        },
      ],
      status: "coming_soon",
    },
  ],
  [
    "aws_ses",
    {
      slug: "aws_ses",
      displayName: "AWS SES",
      description:
        "Amazon Simple Email Service — cost-effective at scale " +
        "($0.10 per 1,000 emails). Requires domain verification.",
      authType: "credentials",
      credentials: [
        {
          key: "accessKeyId",
          label: "Access Key ID",
          placeholder: "AKIAIOSFODNN7EXAMPLE",
          type: "password" as const,
          required: true,
          helpUrl: "https://console.aws.amazon.com/ses/",
        },
        {
          key: "secretAccessKey",
          label: "Secret Access Key",
          placeholder: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          type: "password" as const,
          required: true,
        },
        {
          key: "region",
          label: "Region",
          placeholder: "us-east-1",
          type: "text" as const,
          required: true,
        },
        {
          key: "fromEmail",
          label: "From Email",
          placeholder: "noreply@yourdomain.com",
          type: "text" as const,
          required: true,
        },
      ],
      status: "coming_soon",
    },
  ],
  [
    "postmark",
    {
      slug: "postmark",
      displayName: "Postmark",
      description:
        "Postmark — focused on transactional email deliverability. " +
        "Highest inbox delivery rates in the industry.",
      authType: "api_key",
      credentials: [
        {
          key: "serverToken",
          label: "Server API Token",
          placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
          type: "password" as const,
          required: true,
          helpUrl: "https://account.postmarkapp.com/servers",
        },
        {
          key: "fromEmail",
          label: "From Email",
          placeholder: "noreply@yourdomain.com",
          type: "text" as const,
          required: true,
        },
      ],
      status: "coming_soon",
    },
  ],
  [
    "resend",
    {
      slug: "resend",
      displayName: "Resend",
      description:
        "Resend — modern email API for developers. React Email " +
        "templates, analytics, and webhooks.",
      authType: "api_key",
      credentials: [
        {
          key: "apiKey",
          label: "API Key",
          placeholder: "re_xxxxxxxxx",
          type: "password" as const,
          required: true,
          helpUrl: "https://resend.com/api-keys",
          pattern: /^re_/,
        },
        {
          key: "fromEmail",
          label: "From Email",
          placeholder: "noreply@yourdomain.com",
          type: "text" as const,
          required: true,
        },
      ],
      status: "coming_soon",
    },
  ],
  [
    "smtp",
    {
      slug: "smtp",
      displayName: "SMTP (Generic)",
      description:
        "Connect any SMTP server — Gmail, Outlook, self-hosted Postfix, etc. " +
        "Universal compatibility, no vendor lock-in.",
      authType: "credentials",
      credentials: [
        {
          key: "host",
          label: "SMTP Host",
          placeholder: "smtp.gmail.com",
          type: "text" as const,
          required: true,
        },
        {
          key: "port",
          label: "SMTP Port",
          placeholder: "587",
          type: "text" as const,
          required: true,
        },
        {
          key: "username",
          label: "Username",
          placeholder: "user@example.com",
          type: "text" as const,
          required: true,
        },
        {
          key: "password",
          label: "Password",
          placeholder: "app-specific-password",
          type: "password" as const,
          required: true,
        },
        {
          key: "fromEmail",
          label: "From Email",
          placeholder: "noreply@yourdomain.com",
          type: "text" as const,
          required: true,
        },
      ],
      status: "coming_soon",
    },
  ],
]);

// ─── SMS Providers ─────────────────────────────────────────

export const SMS_REGISTRY: ReadonlyMap<string, SMSProviderMeta> = new Map([
  [
    "twilio",
    {
      slug: "twilio",
      displayName: "Twilio",
      description:
        "Twilio SMS — global reach, programmable messaging, " +
        "delivery receipts, and conversation APIs.",
      authType: "api_key_secret",
      credentials: [
        {
          key: "accountSid",
          label: "Account SID",
          placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          type: "password" as const,
          required: true,
          helpUrl: "https://console.twilio.com/",
          pattern: /^AC[a-f0-9]{32}$/,
        },
        {
          key: "authToken",
          label: "Auth Token",
          placeholder: "your-auth-token",
          type: "password" as const,
          required: true,
        },
        {
          key: "fromNumber",
          label: "From Number",
          placeholder: "+1234567890",
          type: "text" as const,
          required: true,
        },
      ],
      status: "available",
    },
  ],
  [
    "vonage",
    {
      slug: "vonage",
      displayName: "Vonage (Nexmo)",
      description:
        "Vonage Messages API — SMS, MMS, and WhatsApp from a single API. " +
        "Strong in APAC and EU markets.",
      authType: "api_key_secret",
      credentials: [
        {
          key: "apiKey",
          label: "API Key",
          placeholder: "your-api-key",
          type: "password" as const,
          required: true,
          helpUrl: "https://dashboard.nexmo.com/settings",
        },
        {
          key: "apiSecret",
          label: "API Secret",
          placeholder: "your-api-secret",
          type: "password" as const,
          required: true,
        },
        {
          key: "fromNumber",
          label: "From Number",
          placeholder: "+1234567890",
          type: "text" as const,
          required: true,
        },
      ],
      status: "coming_soon",
    },
  ],
  [
    "aws_sns",
    {
      slug: "aws_sns",
      displayName: "AWS SNS",
      description:
        "Amazon Simple Notification Service — cost-effective SMS " +
        "at scale. Best for high-volume transactional messages.",
      authType: "credentials",
      credentials: [
        {
          key: "accessKeyId",
          label: "Access Key ID",
          placeholder: "AKIAIOSFODNN7EXAMPLE",
          type: "password" as const,
          required: true,
          helpUrl: "https://console.aws.amazon.com/sns/",
        },
        {
          key: "secretAccessKey",
          label: "Secret Access Key",
          placeholder: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          type: "password" as const,
          required: true,
        },
        {
          key: "region",
          label: "Region",
          placeholder: "us-east-1",
          type: "text" as const,
          required: true,
        },
      ],
      status: "coming_soon",
    },
  ],
  [
    "messagebird",
    {
      slug: "messagebird",
      displayName: "MessageBird",
      description:
        "MessageBird — omnichannel messaging platform with SMS, " +
        "WhatsApp, and voice. Strong in EU markets.",
      authType: "api_key",
      credentials: [
        {
          key: "apiKey",
          label: "API Key",
          placeholder: "your-messagebird-key",
          type: "password" as const,
          required: true,
          helpUrl: "https://dashboard.messagebird.com/en/developers/access",
        },
        {
          key: "originator",
          label: "Originator (From)",
          placeholder: "+1234567890 or CompanyName",
          type: "text" as const,
          required: true,
        },
      ],
      status: "coming_soon",
    },
  ],
  [
    "plivo",
    {
      slug: "plivo",
      displayName: "Plivo",
      description:
        "Plivo — enterprise SMS API with competitive pricing, " +
        "toll-free numbers, and short codes.",
      authType: "api_key_secret",
      credentials: [
        {
          key: "authId",
          label: "Auth ID",
          placeholder: "your-auth-id",
          type: "password" as const,
          required: true,
          helpUrl: "https://console.plivo.com/dashboard/",
        },
        {
          key: "authToken",
          label: "Auth Token",
          placeholder: "your-auth-token",
          type: "password" as const,
          required: true,
        },
        {
          key: "fromNumber",
          label: "From Number",
          placeholder: "+1234567890",
          type: "text" as const,
          required: true,
        },
      ],
      status: "coming_soon",
    },
  ],
]);

// ─── WhatsApp Providers ────────────────────────────────────

export const WHATSAPP_REGISTRY: ReadonlyMap<string, WhatsAppProviderMeta> =
  new Map([
    [
      "meta_cloud",
      {
        slug: "meta_cloud",
        displayName: "Meta Cloud API",
        description:
          "Official WhatsApp Business Platform (Cloud API) — " +
          "direct from Meta, free tier available, template messages.",
        authType: "api_key",
        credentials: [
          {
            key: "accessToken",
            label: "Permanent Access Token",
            placeholder: "EAAxxxxxxx...",
            type: "password" as const,
            required: true,
            helpUrl:
              "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
          },
          {
            key: "phoneNumberId",
            label: "Phone Number ID",
            placeholder: "1234567890",
            type: "text" as const,
            required: true,
          },
          {
            key: "businessAccountId",
            label: "Business Account ID",
            placeholder: "1234567890",
            type: "text" as const,
            required: false,
          },
        ],
        status: "available",
      },
    ],
    [
      "twilio_whatsapp",
      {
        slug: "twilio_whatsapp",
        displayName: "Twilio WhatsApp",
        description:
          "Twilio's WhatsApp Business API — use your existing Twilio " +
          "account for WhatsApp messaging alongside SMS.",
        authType: "api_key_secret",
        credentials: [
          {
            key: "accountSid",
            label: "Account SID",
            placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            type: "password" as const,
            required: true,
            helpUrl: "https://console.twilio.com/",
          },
          {
            key: "authToken",
            label: "Auth Token",
            placeholder: "your-auth-token",
            type: "password" as const,
            required: true,
          },
          {
            key: "fromNumber",
            label: "WhatsApp From Number",
            placeholder: "whatsapp:+14155238886",
            type: "text" as const,
            required: true,
          },
        ],
        status: "coming_soon",
      },
    ],
    [
      "360dialog",
      {
        slug: "360dialog",
        displayName: "360dialog",
        description:
          "360dialog — official WhatsApp Business Solution Provider. " +
          "Competitive pricing, template management UI.",
        authType: "api_key",
        credentials: [
          {
            key: "apiKey",
            label: "API Key",
            placeholder: "your-360dialog-key",
            type: "password" as const,
            required: true,
            helpUrl: "https://hub.360dialog.com/",
          },
        ],
        status: "coming_soon",
      },
    ],
  ]);

// ─── Push Providers ────────────────────────────────────────

export const PUSH_REGISTRY: ReadonlyMap<string, PushProviderMeta> = new Map([
  [
    "firebase",
    {
      slug: "firebase",
      displayName: "Firebase (FCM)",
      description:
        "Firebase Cloud Messaging — free, reliable push notifications " +
        "for Android and iOS. Industry standard.",
      authType: "credentials",
      credentials: [
        {
          key: "projectId",
          label: "Project ID",
          placeholder: "my-project-id",
          type: "text" as const,
          required: true,
          helpUrl: "https://console.firebase.google.com/",
        },
        {
          key: "privateKey",
          label: "Service Account Private Key",
          placeholder: "-----BEGIN PRIVATE KEY-----\\n...",
          type: "password" as const,
          required: true,
        },
        {
          key: "clientEmail",
          label: "Service Account Email",
          placeholder:
            "firebase-adminsdk-xxxxx@project.iam.gserviceaccount.com",
          type: "text" as const,
          required: true,
        },
      ],
      status: "available",
    },
  ],
  [
    "onesignal",
    {
      slug: "onesignal",
      displayName: "OneSignal",
      description:
        "OneSignal — multi-platform push notifications with " +
        "segmentation, A/B testing, and analytics.",
      authType: "api_key",
      credentials: [
        {
          key: "appId",
          label: "App ID",
          placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
          type: "text" as const,
          required: true,
          helpUrl: "https://onesignal.com/",
        },
        {
          key: "restApiKey",
          label: "REST API Key",
          placeholder: "your-rest-api-key",
          type: "password" as const,
          required: true,
        },
      ],
      status: "coming_soon",
    },
  ],
  [
    "expo_push",
    {
      slug: "expo_push",
      displayName: "Expo Push",
      description:
        "Expo Push Notification Service — free, works with Expo " +
        "managed and bare workflow React Native apps.",
      authType: "api_key",
      credentials: [
        {
          key: "accessToken",
          label: "Access Token (optional)",
          placeholder: "ExponentPushToken[xxxxx]",
          type: "password" as const,
          required: false,
          helpUrl: "https://docs.expo.dev/push-notifications/overview/",
        },
      ],
      status: "coming_soon",
    },
  ],
]);

// ─── Accessors ─────────────────────────────────────────────

/**
 * Get the full registry for a notification channel.
 */
export function getNotificationRegistry(channel: NotificationChannel) {
  switch (channel) {
    case "email":
      return Array.from(EMAIL_REGISTRY.values());
    case "sms":
      return Array.from(SMS_REGISTRY.values());
    case "whatsapp":
      return Array.from(WHATSAPP_REGISTRY.values());
    case "push":
      return Array.from(PUSH_REGISTRY.values());
    default:
      return [];
  }
}

/**
 * Get all registries in a single map (for the Settings UI).
 */
export function getAllNotificationRegistries(): Record<
  NotificationChannel,
  Array<
    | EmailProviderMeta
    | SMSProviderMeta
    | WhatsAppProviderMeta
    | PushProviderMeta
  >
> {
  return {
    email: Array.from(EMAIL_REGISTRY.values()),
    sms: Array.from(SMS_REGISTRY.values()),
    whatsapp: Array.from(WHATSAPP_REGISTRY.values()),
    push: Array.from(PUSH_REGISTRY.values()),
  };
}

/**
 * Get metadata for a specific provider within a channel.
 */
export function getNotificationProviderMeta(
  channel: NotificationChannel,
  slug: string,
) {
  switch (channel) {
    case "email":
      return EMAIL_REGISTRY.get(slug);
    case "sms":
      return SMS_REGISTRY.get(slug);
    case "whatsapp":
      return WHATSAPP_REGISTRY.get(slug);
    case "push":
      return PUSH_REGISTRY.get(slug);
    default:
      return undefined;
  }
}
