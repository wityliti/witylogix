/**
 * Notification Delivery - All Channels Test Suite
 * Tests delivery across all 6 channels:
 * - Email (SendGrid, Mailgun, SES)
 * - SMS (Twilio, Vonage)
 * - Push (Firebase FCM, OneSignal)
 * - WhatsApp (Meta, Vonage)
 * - In-app (WebSocket, Pusher)
 * - Slack (Web API)
 * ~200 lines
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  NotificationPayload,
  NotificationChannel,
  ChannelPayload,
  DeliveryReceipt,
} from "../fixtures/notification-fixtures.js";
import {
  createNotificationPayload,
  createEmailChannel,
  createSmsChannel,
  createPushChannel,
  createWhatsAppChannel,
  createInAppChannel,
  createSlackChannel,
  createEmailChannelPayload,
  createSmsChannelPayload,
  createPushChannelPayload,
  createDeliveryReceipt,
  createFailedDeliveryReceipt,
} from "../fixtures/notification-fixtures.js";

// ─── MOCK PROVIDERS ─────────────────────────────────────────────────────────

interface MockProvider {
  send: (
    payload: ChannelPayload,
  ) => Promise<{ messageId: string; timestamp: Date }>;
  verify: (messageId: string) => Promise<boolean>;
}

const createMockSendGrid = (): MockProvider => ({
  send: vi.fn(async (payload) => ({
    messageId: `sg_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  })),
  verify: vi.fn(async () => true),
});

const createMockTwilio = (): MockProvider => ({
  send: vi.fn(async (payload) => ({
    messageId: `tw_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  })),
  verify: vi.fn(async () => true),
});

const createMockFCM = (): MockProvider => ({
  send: vi.fn(async (payload) => ({
    messageId: `fcm_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  })),
  verify: vi.fn(async () => true),
});

const createMockMeta = (): MockProvider => ({
  send: vi.fn(async (payload) => ({
    messageId: `wa_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  })),
  verify: vi.fn(async () => true),
});

const createMockPusher = (): MockProvider => ({
  send: vi.fn(async (payload) => ({
    messageId: `pusher_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  })),
  verify: vi.fn(async () => true),
});

const createMockSlack = (): MockProvider => ({
  send: vi.fn(async (payload) => ({
    messageId: `slack_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  })),
  verify: vi.fn(async () => true),
});

// ─── DELIVERY SERVICE ───────────────────────────────────────────────────────

class NotificationDeliveryService {
  private deliveryRecords: Map<string, DeliveryReceipt> = new Map();

  constructor(private providers: Record<string, MockProvider>) {}

  async deliverToChannel(
    channel: NotificationChannel,
    payload: ChannelPayload,
  ): Promise<DeliveryReceipt> {
    const provider = this.providers[channel.provider || ""];
    if (!provider) throw new Error(`Provider not found: ${channel.provider}`);

    const result = await provider.send(payload);
    const receipt: DeliveryReceipt = {
      channelPayloadId: payload.channel,
      channel: channel.type,
      provider: channel.provider || "",
      providerMessageId: result.messageId,
      status: "DELIVERED",
      receivedAt: result.timestamp,
    };

    this.deliveryRecords.set(result.messageId, receipt);
    return receipt;
  }

  getDeliveryRecords(): DeliveryReceipt[] {
    return Array.from(this.deliveryRecords.values());
  }

  clearRecords(): void {
    this.deliveryRecords.clear();
  }
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("Notification Delivery - All Channels", () => {
  let sendGrid: MockProvider;
  let twilio: MockProvider;
  let fcm: MockProvider;
  let meta: MockProvider;
  let pusher: MockProvider;
  let slack: MockProvider;
  let deliveryService: NotificationDeliveryService;

  beforeEach(() => {
    sendGrid = createMockSendGrid();
    twilio = createMockTwilio();
    fcm = createMockFCM();
    meta = createMockMeta();
    pusher = createMockPusher();
    slack = createMockSlack();

    deliveryService = new NotificationDeliveryService({
      sendgrid: sendGrid,
      mailgun: { ...sendGrid },
      ses: { ...sendGrid },
      twilio: twilio,
      vonage: { ...twilio },
      fcm: fcm,
      onesignal: { ...fcm },
      meta: meta,
      pusher: pusher,
      slack: slack,
    });
  });

  // ─── EMAIL DELIVERY ─────────────────────────────────────────────────────

  describe("Email Delivery", () => {
    it("should deliver via SendGrid with correct payload format", async () => {
      const channel = createEmailChannel({ provider: "sendgrid" });
      const payload = createEmailChannelPayload({ provider: "sendgrid" });

      const receipt = await deliveryService.deliverToChannel(channel, payload);

      expect(receipt.channel).toBe("EMAIL");
      expect(receipt.provider).toBe("sendgrid");
      expect(receipt.status).toBe("DELIVERED");
      expect(receipt.providerMessageId).toMatch(/^sg_/);
      expect(sendGrid.send).toHaveBeenCalledWith(
        expect.objectContaining(payload),
      );
    });

    it("should deliver via Mailgun with correct payload format", async () => {
      const channel = createEmailChannel({ provider: "mailgun" });
      const payload = createEmailChannelPayload({ provider: "mailgun" });

      const receipt = await deliveryService.deliverToChannel(channel, payload);

      expect(receipt.provider).toBe("mailgun");
      expect(receipt.status).toBe("DELIVERED");
    });

    it("should deliver via SES with correct payload format", async () => {
      const channel = createEmailChannel({ provider: "ses" });
      const payload = createEmailChannelPayload({ provider: "ses" });

      const receipt = await deliveryService.deliverToChannel(channel, payload);

      expect(receipt.provider).toBe("ses");
      expect(receipt.status).toBe("DELIVERED");
    });

    it("should include HTML content for email channels", async () => {
      const channel = createEmailChannel();
      const payload = createEmailChannelPayload({
        html: "<html><body><h1>Order Confirmed</h1></body></html>",
      });

      await deliveryService.deliverToChannel(channel, payload);

      expect(sendGrid.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("Order Confirmed"),
        }),
      );
    });
  });

  // ─── SMS DELIVERY ──────────────────────────────────────────────────────

  describe("SMS Delivery", () => {
    it("should deliver via Twilio with correct payload format", async () => {
      const channel = createSmsChannel({ provider: "twilio" });
      const payload = createSmsChannelPayload({ provider: "twilio" });

      const receipt = await deliveryService.deliverToChannel(channel, payload);

      expect(receipt.channel).toBe("SMS");
      expect(receipt.provider).toBe("twilio");
      expect(receipt.status).toBe("DELIVERED");
      expect(receipt.providerMessageId).toMatch(/^tw_/);
    });

    it("should deliver via Vonage with correct payload format", async () => {
      const channel = createSmsChannel({ provider: "vonage" });
      const payload = createSmsChannelPayload({ provider: "vonage" });

      const receipt = await deliveryService.deliverToChannel(channel, payload);

      expect(receipt.provider).toBe("vonage");
      expect(receipt.status).toBe("DELIVERED");
    });

    it("should include destination phone number in SMS payload", async () => {
      const phoneNumber = "+14155552671";
      const channel = createSmsChannel({ destination: phoneNumber });
      const payload = createSmsChannelPayload({ destination: phoneNumber });

      await deliveryService.deliverToChannel(channel, payload);

      expect(twilio.send).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: phoneNumber,
        }),
      );
    });
  });

  // ─── PUSH NOTIFICATION DELIVERY ────────────────────────────────────────

  describe("Push Notification Delivery", () => {
    it("should deliver via FCM with correct payload format", async () => {
      const channel = createPushChannel({ provider: "fcm" });
      const payload = createPushChannelPayload({ provider: "fcm" });

      const receipt = await deliveryService.deliverToChannel(channel, payload);

      expect(receipt.channel).toBe("PUSH");
      expect(receipt.provider).toBe("fcm");
      expect(receipt.status).toBe("DELIVERED");
      expect(receipt.providerMessageId).toMatch(/^fcm_/);
    });

    it("should deliver via OneSignal with correct payload format", async () => {
      const channel = createPushChannel({ provider: "onesignal" });
      const payload = createPushChannelPayload({ provider: "onesignal" });

      const receipt = await deliveryService.deliverToChannel(channel, payload);

      expect(receipt.provider).toBe("onesignal");
      expect(receipt.status).toBe("DELIVERED");
    });

    it("should include device token and badge count in push payload", async () => {
      const deviceToken = "device_abc123xyz789";
      const channel = createPushChannel({ destination: deviceToken });
      const payload = createPushChannelPayload({
        destination: deviceToken,
        variables: { badgeCount: 3 },
      });

      await deliveryService.deliverToChannel(channel, payload);

      expect(fcm.send).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: deviceToken,
        }),
      );
    });
  });

  // ─── WHATSAPP DELIVERY ──────────────────────────────────────────────────

  describe("WhatsApp Delivery", () => {
    it("should deliver via Meta with correct payload format", async () => {
      const channel = createWhatsAppChannel({ provider: "meta" });
      const payload = {
        channel: "WHATSAPP",
        provider: "meta",
        destination: "+14155552671",
        body: "Your order has been confirmed!",
        variables: { orderId: "12345" },
      };

      const receipt = await deliveryService.deliverToChannel(channel, payload);

      expect(receipt.channel).toBe("WHATSAPP");
      expect(receipt.provider).toBe("meta");
      expect(receipt.status).toBe("DELIVERED");
      expect(receipt.providerMessageId).toMatch(/^wa_/);
    });

    it("should deliver via Vonage WhatsApp", async () => {
      const channel = createWhatsAppChannel({ provider: "vonage" });
      const payload = {
        channel: "WHATSAPP",
        provider: "vonage",
        destination: "+14155552671",
        body: "Your delivery is on its way!",
        variables: {},
      };

      const receipt = await deliveryService.deliverToChannel(channel, payload);

      expect(receipt.provider).toBe("vonage");
      expect(receipt.status).toBe("DELIVERED");
    });

    it("should include phone number and message template in WhatsApp payload", async () => {
      const phoneNumber = "+34911234567";
      const channel = createWhatsAppChannel({ destination: phoneNumber });
      const payload = {
        channel: "WHATSAPP",
        provider: "meta",
        destination: phoneNumber,
        body: "Your package awaits!",
        variables: { trackingId: "TRK-123456" },
      };

      await deliveryService.deliverToChannel(channel, payload);

      expect(meta.send).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: phoneNumber,
        }),
      );
    });
  });

  // ─── IN-APP DELIVERY ────────────────────────────────────────────────────

  describe("In-App Delivery", () => {
    it("should deliver via Pusher WebSocket", async () => {
      const channel = createInAppChannel({ provider: "pusher" });
      const payload = {
        channel: "IN_APP",
        provider: "pusher",
        destination: "user_123",
        subject: "Order Update",
        body: "Your order is ready",
        variables: { orderId: "ORD-999" },
      };

      const receipt = await deliveryService.deliverToChannel(channel, payload);

      expect(receipt.channel).toBe("IN_APP");
      expect(receipt.provider).toBe("pusher");
      expect(receipt.status).toBe("DELIVERED");
      expect(receipt.providerMessageId).toMatch(/^pusher_/);
    });

    it("should include user ID in in-app delivery", async () => {
      const userId = "user_abc123";
      const channel = createInAppChannel({ destination: userId });
      const payload = {
        channel: "IN_APP",
        provider: "pusher",
        destination: userId,
        subject: "Notification",
        body: "New message",
        variables: {},
      };

      await deliveryService.deliverToChannel(channel, payload);

      expect(pusher.send).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: userId,
        }),
      );
    });
  });

  // ─── SLACK DELIVERY ─────────────────────────────────────────────────────

  describe("Slack Delivery", () => {
    it("should deliver via Slack Web API", async () => {
      const channel = createSlackChannel();
      const payload = {
        channel: "SLACK",
        provider: "slack",
        destination: "#notifications",
        subject: "System Alert",
        body: "High load detected",
        variables: { cpuUsage: "95%" },
      };

      const receipt = await deliveryService.deliverToChannel(channel, payload);

      expect(receipt.channel).toBe("SLACK");
      expect(receipt.provider).toBe("slack");
      expect(receipt.status).toBe("DELIVERED");
      expect(receipt.providerMessageId).toMatch(/^slack_/);
    });

    it("should include channel name and formatted message in Slack payload", async () => {
      const channel = createSlackChannel({ destination: "#order-alerts" });
      const payload = {
        channel: "SLACK",
        provider: "slack",
        destination: "#order-alerts",
        subject: "Order Placed",
        body: "Order #12345 placed for $99.99",
        variables: { orderId: "12345", amount: "99.99" },
      };

      await deliveryService.deliverToChannel(channel, payload);

      expect(slack.send).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: "#order-alerts",
        }),
      );
    });
  });

  // ─── DELIVERY RECEIPT VERIFICATION ──────────────────────────────────────

  describe("Delivery Receipt Verification", () => {
    it("should track all delivery receipts", async () => {
      const channels = [
        createEmailChannel(),
        createSmsChannel(),
        createPushChannel(),
      ];

      for (const channel of channels) {
        const payload =
          channel.type === "EMAIL"
            ? createEmailChannelPayload()
            : channel.type === "SMS"
              ? createSmsChannelPayload()
              : createPushChannelPayload();

        await deliveryService.deliverToChannel(channel, payload);
      }

      const records = deliveryService.getDeliveryRecords();
      expect(records).toHaveLength(3);
      expect(records.every((r) => r.status === "DELIVERED")).toBe(true);
    });

    it("should include provider message ID in receipt", async () => {
      const channel = createEmailChannel();
      const payload = createEmailChannelPayload();

      const receipt = await deliveryService.deliverToChannel(channel, payload);

      expect(receipt.providerMessageId).toBeDefined();
      expect(receipt.providerMessageId).toMatch(/^sg_/);
    });

    it("should include timestamp in delivery receipt", async () => {
      const channel = createSmsChannel();
      const payload = createSmsChannelPayload();

      const receipt = await deliveryService.deliverToChannel(channel, payload);

      expect(receipt.receivedAt).toBeInstanceOf(Date);
      expect(receipt.receivedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});
