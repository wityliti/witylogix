/**
 * Communication category — re-registers all 17 notification providers
 * from the existing EMAIL_REGISTRY, SMS_REGISTRY, WHATSAPP_REGISTRY,
 * and PUSH_REGISTRY into the unified IntegrationAppMeta format.
 */

import type { IntegrationAppMeta, CredentialField } from "../types.js";

/**
 * Convert existing notification CredentialField (with RegExp pattern)
 * to unified CredentialField (with string pattern).
 */
function convertCredentialField(
  field: { key: string; label: string; placeholder: string; type: string; required: boolean; helpUrl?: string; pattern?: RegExp },
): CredentialField {
  return {
    key: field.key,
    label: field.label,
    placeholder: field.placeholder,
    type: field.type as CredentialField["type"],
    required: field.required,
    helpUrl: field.helpUrl,
    pattern: field.pattern?.source,
  };
}

// ─── Email Providers ─────────────────────────────────────────

const emailProviders: IntegrationAppMeta[] = [
  {
    slug: "sendgrid",
    name: "SendGrid",
    description:
      "Twilio SendGrid — reliable transactional email with template support, analytics, and deliverability tools.",
    category: "COMMUNICATION",
    subcategory: "email",
    websiteUrl: "https://sendgrid.com",
    docsUrl: "https://docs.sendgrid.com",
    authType: "API_KEY",
    credentialFields: [
      { key: "apiKey", label: "API Key", placeholder: "SG.xxxxxxxxxxxxxxxxxxxx", type: "password", required: true, helpUrl: "https://app.sendgrid.com/settings/api_keys", pattern: "^SG\\." },
      { key: "fromEmail", label: "From Email", placeholder: "noreply@yourdomain.com", type: "text", required: true },
      { key: "fromName", label: "From Name", placeholder: "Your Company", type: "text", required: false },
    ],
    capabilities: ["transactional_email", "templates", "analytics", "webhooks"],
    status: "AVAILABLE",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "mailgun",
    name: "Mailgun",
    description:
      "Mailgun by Sinch — powerful email API with templates, analytics, and email validation.",
    category: "COMMUNICATION",
    subcategory: "email",
    websiteUrl: "https://www.mailgun.com",
    docsUrl: "https://documentation.mailgun.com",
    authType: "API_KEY",
    credentialFields: [
      { key: "apiKey", label: "API Key", placeholder: "key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password", required: true, helpUrl: "https://app.mailgun.com/app/account/security/api_keys" },
      { key: "domain", label: "Domain", placeholder: "mg.yourdomain.com", type: "text", required: true },
      { key: "fromEmail", label: "From Email", placeholder: "noreply@yourdomain.com", type: "text", required: true },
    ],
    capabilities: ["transactional_email", "templates", "analytics", "email_validation"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "aws_ses",
    name: "AWS SES",
    description:
      "Amazon Simple Email Service — cost-effective at scale ($0.10 per 1,000 emails). Requires domain verification.",
    category: "COMMUNICATION",
    subcategory: "email",
    websiteUrl: "https://aws.amazon.com/ses/",
    docsUrl: "https://docs.aws.amazon.com/ses/",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      { key: "accessKeyId", label: "Access Key ID", placeholder: "AKIAIOSFODNN7EXAMPLE", type: "password", required: true, helpUrl: "https://console.aws.amazon.com/ses/" },
      { key: "secretAccessKey", label: "Secret Access Key", placeholder: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", type: "password", required: true },
      { key: "region", label: "Region", placeholder: "us-east-1", type: "text", required: true },
      { key: "fromEmail", label: "From Email", placeholder: "noreply@yourdomain.com", type: "text", required: true },
    ],
    capabilities: ["transactional_email", "bulk_email", "templates"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "postmark",
    name: "Postmark",
    description:
      "Postmark — focused on transactional email deliverability. Highest inbox delivery rates in the industry.",
    category: "COMMUNICATION",
    subcategory: "email",
    websiteUrl: "https://postmarkapp.com",
    docsUrl: "https://postmarkapp.com/developer",
    authType: "API_KEY",
    credentialFields: [
      { key: "serverToken", label: "Server API Token", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", type: "password", required: true, helpUrl: "https://account.postmarkapp.com/servers" },
      { key: "fromEmail", label: "From Email", placeholder: "noreply@yourdomain.com", type: "text", required: true },
    ],
    capabilities: ["transactional_email", "templates", "analytics"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "resend",
    name: "Resend",
    description:
      "Resend — modern email API for developers. React Email templates, analytics, and webhooks.",
    category: "COMMUNICATION",
    subcategory: "email",
    websiteUrl: "https://resend.com",
    docsUrl: "https://resend.com/docs",
    authType: "API_KEY",
    credentialFields: [
      { key: "apiKey", label: "API Key", placeholder: "re_xxxxxxxxx", type: "password", required: true, helpUrl: "https://resend.com/api-keys", pattern: "^re_" },
      { key: "fromEmail", label: "From Email", placeholder: "noreply@yourdomain.com", type: "text", required: true },
    ],
    capabilities: ["transactional_email", "react_templates", "webhooks"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "smtp",
    name: "SMTP (Generic)",
    description:
      "Connect any SMTP server — Gmail, Outlook, self-hosted Postfix, etc. Universal compatibility, no vendor lock-in.",
    category: "COMMUNICATION",
    subcategory: "email",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      { key: "host", label: "SMTP Host", placeholder: "smtp.gmail.com", type: "text", required: true },
      { key: "port", label: "SMTP Port", placeholder: "587", type: "text", required: true },
      { key: "username", label: "Username", placeholder: "user@example.com", type: "text", required: true },
      { key: "password", label: "Password", placeholder: "app-specific-password", type: "password", required: true },
      { key: "fromEmail", label: "From Email", placeholder: "noreply@yourdomain.com", type: "text", required: true },
    ],
    capabilities: ["transactional_email"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
];

// ─── SMS Providers ───────────────────────────────────────────

const smsProviders: IntegrationAppMeta[] = [
  {
    slug: "twilio",
    name: "Twilio",
    description:
      "Twilio SMS — global reach, programmable messaging, delivery receipts, and conversation APIs.",
    category: "COMMUNICATION",
    subcategory: "sms",
    websiteUrl: "https://www.twilio.com",
    docsUrl: "https://www.twilio.com/docs/sms",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      { key: "accountSid", label: "Account SID", placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password", required: true, helpUrl: "https://console.twilio.com/", pattern: "^AC[a-f0-9]{32}$" },
      { key: "authToken", label: "Auth Token", placeholder: "your-auth-token", type: "password", required: true },
      { key: "fromNumber", label: "From Number", placeholder: "+1234567890", type: "text", required: true },
    ],
    capabilities: ["sms", "delivery_receipts", "conversations"],
    status: "AVAILABLE",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "vonage",
    name: "Vonage (Nexmo)",
    description:
      "Vonage Messages API — SMS, MMS, and WhatsApp from a single API. Strong in APAC and EU markets.",
    category: "COMMUNICATION",
    subcategory: "sms",
    websiteUrl: "https://www.vonage.com",
    docsUrl: "https://developer.vonage.com/messaging/sms",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      { key: "apiKey", label: "API Key", placeholder: "your-api-key", type: "password", required: true, helpUrl: "https://dashboard.nexmo.com/settings" },
      { key: "apiSecret", label: "API Secret", placeholder: "your-api-secret", type: "password", required: true },
      { key: "fromNumber", label: "From Number", placeholder: "+1234567890", type: "text", required: true },
    ],
    capabilities: ["sms", "mms", "delivery_receipts"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "aws_sns",
    name: "AWS SNS",
    description:
      "Amazon Simple Notification Service — cost-effective SMS at scale. Best for high-volume transactional messages.",
    category: "COMMUNICATION",
    subcategory: "sms",
    websiteUrl: "https://aws.amazon.com/sns/",
    docsUrl: "https://docs.aws.amazon.com/sns/",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      { key: "accessKeyId", label: "Access Key ID", placeholder: "AKIAIOSFODNN7EXAMPLE", type: "password", required: true, helpUrl: "https://console.aws.amazon.com/sns/" },
      { key: "secretAccessKey", label: "Secret Access Key", placeholder: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", type: "password", required: true },
      { key: "region", label: "Region", placeholder: "us-east-1", type: "text", required: true },
    ],
    capabilities: ["sms", "bulk_sms"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "messagebird",
    name: "MessageBird",
    description:
      "MessageBird — omnichannel messaging platform with SMS, WhatsApp, and voice. Strong in EU markets.",
    category: "COMMUNICATION",
    subcategory: "sms",
    websiteUrl: "https://www.messagebird.com",
    docsUrl: "https://developers.messagebird.com",
    authType: "API_KEY",
    credentialFields: [
      { key: "apiKey", label: "API Key", placeholder: "your-messagebird-key", type: "password", required: true, helpUrl: "https://dashboard.messagebird.com/en/developers/access" },
      { key: "originator", label: "Originator (From)", placeholder: "+1234567890 or CompanyName", type: "text", required: true },
    ],
    capabilities: ["sms", "voice", "omnichannel"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "plivo",
    name: "Plivo",
    description:
      "Plivo — enterprise SMS API with competitive pricing, toll-free numbers, and short codes.",
    category: "COMMUNICATION",
    subcategory: "sms",
    websiteUrl: "https://www.plivo.com",
    docsUrl: "https://www.plivo.com/docs/sms/",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      { key: "authId", label: "Auth ID", placeholder: "your-auth-id", type: "password", required: true, helpUrl: "https://console.plivo.com/dashboard/" },
      { key: "authToken", label: "Auth Token", placeholder: "your-auth-token", type: "password", required: true },
      { key: "fromNumber", label: "From Number", placeholder: "+1234567890", type: "text", required: true },
    ],
    capabilities: ["sms", "toll_free", "short_codes"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
];

// ─── WhatsApp Providers ──────────────────────────────────────

const whatsappProviders: IntegrationAppMeta[] = [
  {
    slug: "meta_cloud",
    name: "Meta Cloud API",
    description:
      "Official WhatsApp Business Platform (Cloud API) — direct from Meta, free tier available, template messages.",
    category: "COMMUNICATION",
    subcategory: "whatsapp",
    websiteUrl: "https://business.whatsapp.com",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    authType: "API_KEY",
    credentialFields: [
      { key: "accessToken", label: "Permanent Access Token", placeholder: "EAAxxxxxxx...", type: "password", required: true, helpUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" },
      { key: "phoneNumberId", label: "Phone Number ID", placeholder: "1234567890", type: "text", required: true },
      { key: "businessAccountId", label: "Business Account ID", placeholder: "1234567890", type: "text", required: false },
    ],
    capabilities: ["whatsapp_templates", "session_messages", "media"],
    status: "AVAILABLE",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "twilio_whatsapp",
    name: "Twilio WhatsApp",
    description:
      "Twilio's WhatsApp Business API — use your existing Twilio account for WhatsApp messaging alongside SMS.",
    category: "COMMUNICATION",
    subcategory: "whatsapp",
    websiteUrl: "https://www.twilio.com/whatsapp",
    docsUrl: "https://www.twilio.com/docs/whatsapp",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      { key: "accountSid", label: "Account SID", placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password", required: true, helpUrl: "https://console.twilio.com/" },
      { key: "authToken", label: "Auth Token", placeholder: "your-auth-token", type: "password", required: true },
      { key: "fromNumber", label: "WhatsApp From Number", placeholder: "whatsapp:+14155238886", type: "text", required: true },
    ],
    capabilities: ["whatsapp_templates", "session_messages"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "360dialog",
    name: "360dialog",
    description:
      "360dialog — official WhatsApp Business Solution Provider. Competitive pricing, template management UI.",
    category: "COMMUNICATION",
    subcategory: "whatsapp",
    websiteUrl: "https://www.360dialog.com",
    docsUrl: "https://docs.360dialog.com",
    authType: "API_KEY",
    credentialFields: [
      { key: "apiKey", label: "API Key", placeholder: "your-360dialog-key", type: "password", required: true, helpUrl: "https://hub.360dialog.com/" },
    ],
    capabilities: ["whatsapp_templates", "template_management"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
];

// ─── Push Providers ──────────────────────────────────────────

const pushProviders: IntegrationAppMeta[] = [
  {
    slug: "firebase",
    name: "Firebase (FCM)",
    description:
      "Firebase Cloud Messaging — free, reliable push notifications for Android and iOS. Industry standard.",
    category: "COMMUNICATION",
    subcategory: "push",
    websiteUrl: "https://firebase.google.com",
    docsUrl: "https://firebase.google.com/docs/cloud-messaging",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      { key: "projectId", label: "Project ID", placeholder: "my-project-id", type: "text", required: true, helpUrl: "https://console.firebase.google.com/" },
      { key: "privateKey", label: "Service Account Private Key", placeholder: "-----BEGIN PRIVATE KEY-----\\n...", type: "password", required: true },
      { key: "clientEmail", label: "Service Account Email", placeholder: "firebase-adminsdk-xxxxx@project.iam.gserviceaccount.com", type: "text", required: true },
    ],
    capabilities: ["push_android", "push_ios", "topics", "data_messages"],
    status: "AVAILABLE",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "onesignal",
    name: "OneSignal",
    description:
      "OneSignal — multi-platform push notifications with segmentation, A/B testing, and analytics.",
    category: "COMMUNICATION",
    subcategory: "push",
    websiteUrl: "https://onesignal.com",
    docsUrl: "https://documentation.onesignal.com",
    authType: "MULTI_CREDENTIAL",
    credentialFields: [
      { key: "appId", label: "App ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", type: "text", required: true, helpUrl: "https://onesignal.com/" },
      { key: "restApiKey", label: "REST API Key", placeholder: "your-rest-api-key", type: "password", required: true },
    ],
    capabilities: ["push_android", "push_ios", "segmentation", "ab_testing"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "expo_push",
    name: "Expo Push",
    description:
      "Expo Push Notification Service — free, works with Expo managed and bare workflow React Native apps.",
    category: "COMMUNICATION",
    subcategory: "push",
    websiteUrl: "https://expo.dev",
    docsUrl: "https://docs.expo.dev/push-notifications/overview/",
    authType: "API_KEY",
    credentialFields: [
      { key: "accessToken", label: "Access Token (optional)", placeholder: "ExponentPushToken[xxxxx]", type: "password", required: false, helpUrl: "https://docs.expo.dev/push-notifications/overview/" },
    ],
    capabilities: ["push_android", "push_ios", "expo_managed"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
];

// ─── Exports ─────────────────────────────────────────────────

/** All communication integrations (17 total across 4 channels). */
export const COMMUNICATION_INTEGRATIONS: readonly IntegrationAppMeta[] = [
  ...emailProviders,
  ...smsProviders,
  ...whatsappProviders,
  ...pushProviders,
];
