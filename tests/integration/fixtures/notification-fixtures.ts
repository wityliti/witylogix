/**
 * Notification Test Fixtures
 * Factory functions for creating mock notification data
 * ~100 lines
 */

import { randomUUID } from "crypto";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface NotificationPayload {
  id: string;
  recipientId: string;
  templateId: string;
  channels: NotificationChannel[];
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  subject?: string;
  content: string;
  variables?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface NotificationChannel {
  type: "EMAIL" | "SMS" | "PUSH" | "WHATSAPP" | "IN_APP" | "SLACK";
  provider?: string;
  destination: string;
  status: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "BOUNCED";
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface ChannelPayload {
  channel: string;
  provider: string;
  destination: string;
  subject?: string;
  body: string;
  html?: string;
  variables: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface TemplateContext {
  templateId: string;
  locale: string;
  variables: Record<string, unknown>;
  formatForChannel: "EMAIL" | "SMS" | "PUSH" | "WHATSAPP";
}

export interface QuietHours {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string;
  timezone: string;
}

export interface DeliveryReceipt {
  channelPayloadId: string;
  channel: string;
  provider: string;
  providerMessageId: string;
  status: "DELIVERED" | "FAILED" | "BOUNCED";
  receivedAt: Date;
  metadata?: Record<string, unknown>;
}

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────

function randomId(): string {
  return randomUUID();
}

function randomEmail(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let username = "";
  for (let i = 0; i < 10; i++) {
    username += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${username}@example.com`;
}

function randomPhone(): string {
  return `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
}

// ─── NOTIFICATION PAYLOAD FACTORIES ─────────────────────────────────────────

export const createEmailChannel = (
  overrides?: Partial<NotificationChannel>,
): NotificationChannel => ({
  type: "EMAIL",
  provider: "sendgrid",
  destination: randomEmail(),
  status: "PENDING",
  retryCount: 0,
  ...overrides,
});

export const createSmsChannel = (
  overrides?: Partial<NotificationChannel>,
): NotificationChannel => ({
  type: "SMS",
  provider: "twilio",
  destination: randomPhone(),
  status: "PENDING",
  retryCount: 0,
  ...overrides,
});

export const createPushChannel = (
  overrides?: Partial<NotificationChannel>,
): NotificationChannel => ({
  type: "PUSH",
  provider: "fcm",
  destination: `device_${randomId()}`,
  status: "PENDING",
  retryCount: 0,
  ...overrides,
});

export const createWhatsAppChannel = (
  overrides?: Partial<NotificationChannel>,
): NotificationChannel => ({
  type: "WHATSAPP",
  provider: "meta",
  destination: randomPhone(),
  status: "PENDING",
  retryCount: 0,
  ...overrides,
});

export const createInAppChannel = (
  overrides?: Partial<NotificationChannel>,
): NotificationChannel => ({
  type: "IN_APP",
  provider: "pusher",
  destination: `user_${randomId()}`,
  status: "PENDING",
  retryCount: 0,
  ...overrides,
});

export const createSlackChannel = (
  overrides?: Partial<NotificationChannel>,
): NotificationChannel => ({
  type: "SLACK",
  provider: "slack",
  destination: `#notifications`,
  status: "PENDING",
  retryCount: 0,
  ...overrides,
});

export const createNotificationPayload = (
  overrides?: Partial<NotificationPayload>,
): NotificationPayload => ({
  id: randomId(),
  recipientId: randomId(),
  templateId: "order.confirmation",
  channels: [createEmailChannel()],
  priority: "NORMAL",
  subject: "Your Order Confirmation",
  content: "Your order has been confirmed.",
  variables: {
    orderId: `ORD-${Math.random().toString(36).substr(2, 9)}`,
    customerName: "John Doe",
    totalAmount: 99.99,
  },
  createdAt: new Date(),
  ...overrides,
});

export const createMultiChannelPayload = (
  channels: NotificationChannel[],
  overrides?: Partial<NotificationPayload>,
): NotificationPayload => ({
  ...createNotificationPayload(overrides),
  channels,
});

// ─── CHANNEL PAYLOAD FACTORIES ──────────────────────────────────────────────

export const createEmailChannelPayload = (
  overrides?: Partial<ChannelPayload>,
): ChannelPayload => ({
  channel: "EMAIL",
  provider: "sendgrid",
  destination: randomEmail(),
  subject: "Your Notification",
  body: "Please see the attached HTML.",
  html: "<html><body><h1>Your Notification</h1><p>Details here.</p></body></html>",
  variables: {
    recipientName: "John Doe",
  },
  ...overrides,
});

export const createSmsChannelPayload = (
  overrides?: Partial<ChannelPayload>,
): ChannelPayload => ({
  channel: "SMS",
  provider: "twilio",
  destination: randomPhone(),
  body: "Your order #12345 has been confirmed.",
  variables: {
    orderId: "12345",
  },
  ...overrides,
});

export const createPushChannelPayload = (
  overrides?: Partial<ChannelPayload>,
): ChannelPayload => ({
  channel: "PUSH",
  provider: "fcm",
  destination: `device_${randomId()}`,
  subject: "Order Update",
  body: "Your order has been dispatched.",
  variables: {
    orderId: "12345",
    status: "DISPATCHED",
  },
  ...overrides,
});

// ─── DELIVERY RECEIPT FACTORIES ─────────────────────────────────────────────

export const createDeliveryReceipt = (
  overrides?: Partial<DeliveryReceipt>,
): DeliveryReceipt => ({
  channelPayloadId: randomId(),
  channel: "EMAIL",
  provider: "sendgrid",
  providerMessageId: `sg_${randomId()}`,
  status: "DELIVERED",
  receivedAt: new Date(),
  ...overrides,
});

export const createFailedDeliveryReceipt = (
  reason: string,
  overrides?: Partial<DeliveryReceipt>,
): DeliveryReceipt => ({
  ...createDeliveryReceipt(overrides),
  status: "FAILED",
  failureReason: reason,
});

// ─── TEMPLATE CONTEXT FACTORIES ─────────────────────────────────────────────

export const createTemplateContext = (
  overrides?: Partial<TemplateContext>,
): TemplateContext => ({
  templateId: "order.confirmation",
  locale: "en-US",
  variables: {
    orderId: "ORD-12345",
    customerName: "Jane Smith",
    totalAmount: 199.99,
    estimatedDelivery: "2026-03-20",
  },
  formatForChannel: "EMAIL",
  ...overrides,
});

// ─── QUIET HOURS FACTORIES ──────────────────────────────────────────────────

export const createQuietHours = (
  overrides?: Partial<QuietHours>,
): QuietHours => ({
  enabled: true,
  startTime: "22:00",
  endTime: "08:00",
  timezone: "America/New_York",
  ...overrides,
});

// ─── BULK FACTORIES ─────────────────────────────────────────────────────────

export const createManyNotifications = (
  count: number,
): NotificationPayload[] => {
  const notifications: NotificationPayload[] = [];
  for (let i = 0; i < count; i++) {
    notifications.push(createNotificationPayload());
  }
  return notifications;
};

export const createNotificationWithAllChannels = (): NotificationPayload =>
  createMultiChannelPayload([
    createEmailChannel(),
    createSmsChannel(),
    createPushChannel(),
    createWhatsAppChannel(),
    createInAppChannel(),
    createSlackChannel(),
  ]);

export const createFailoverScenario = (): {
  primary: NotificationChannel;
  secondary: NotificationChannel;
  tertiary: NotificationChannel;
} => ({
  primary: createEmailChannel({ provider: "sendgrid" }),
  secondary: createEmailChannel({ provider: "mailgun" }),
  tertiary: createEmailChannel({ provider: "ses" }),
});
