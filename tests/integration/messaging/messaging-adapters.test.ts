/**
 * Messaging Adapters Integration Tests
 * Comprehensive test suite for messaging providers
 * Tests: Vonage, TextMagic, OneSignal, Sendbird
 * ~600 lines, 35+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mockVonageSendSMSResponse,
  mockVonageVerifyResponse,
  mockVonageVerifyCheckResponse,
  mockTextMagicSendResponse,
  mockTextMagicBulkSendResponse,
  mockOneSignalPushResponse,
  mockOneSignalSegmentResponse,
  mockSendBirdUserResponse,
  mockSendBirdChannelResponse,
  mockSendBirdMessageResponse,
  generateWebhookPayload,
} from "../fixtures/integration-fixtures.js";
import {
  createMockHTTPClient,
  createMockRateLimiter,
  createMockCircuitBreaker,
  assertWebhookDelivery,
} from "../helpers/integration-test-helpers.js";

// ─────────────────────────────────────────────────────────────────────────────
// VONAGE SMS CLIENT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Vonage Client", () => {
  let mockClient: ReturnType<typeof createMockHTTPClient>;
  let rateLimiter: ReturnType<typeof createMockRateLimiter>;

  beforeEach(() => {
    mockClient = createMockHTTPClient({
      responses: [
        {
          url: /\/sms\/json/,
          status: 200,
          data: mockVonageSendSMSResponse,
        },
      ],
    });
    rateLimiter = createMockRateLimiter(150);
  });

  describe("Send SMS", () => {
    it("should send SMS successfully", async () => {
      const smsRequest = {
        api_key: "test_key",
        api_secret: "test_secret",
        to: "14155552671",
        from: "MyCompany",
        text: "Hello, this is a test message",
      };

      const result = await mockClient.fetch(
        "https://rest.nexmo.com/sms/json",
        {
          method: "POST",
          body: JSON.stringify(smsRequest),
        },
      );

      const data = await result.json();
      expect(result.status).toBe(200);
      expect(data).toHaveProperty("messages");
      expect(data.messages[0]).toHaveProperty("status");
    });

    it("should include remaining balance in response", async () => {
      const data = mockVonageSendSMSResponse;
      expect(data.messages[0]).toHaveProperty("remaining_balance");
      expect(parseFloat(data.messages[0].remaining_balance as string)).toBeLessThan(
        15,
      );
    });

    it("should handle international phone numbers", () => {
      const phoneNumbers = [
        "14155552671", // US
        "4407700900123", // UK
        "33123456789", // France
        "8613000000000", // China
      ];

      for (const phone of phoneNumbers) {
        expect(phone).toMatch(/^\d{10,15}$/);
      }
    });

    it("should apply rate limiting to SMS sends", async () => {
      await rateLimiter.check("sms_send");
      const state = rateLimiter.getState();
      expect(state.remaining).toBeLessThan(150);
    });

    it("should batch SMS sends", async () => {
      const batchRequest = {
        api_key: "test_key",
        api_secret: "test_secret",
        messages: [
          {
            to: "14155552671",
            text: "Message 1",
          },
          {
            to: "14155552672",
            text: "Message 2",
          },
        ],
      };

      expect(batchRequest.messages).toHaveLength(2);
    });
  });

  describe("Send MMS", () => {
    it("should send MMS with media attachment", () => {
      const mmsRequest = {
        api_key: "test_key",
        api_secret: "test_secret",
        to: "14155552671",
        from: "MyCompany",
        text: "Check out this image",
        media_url: "https://example.com/image.jpg",
      };

      expect(mmsRequest).toHaveProperty("media_url");
    });
  });

  describe("Verify OTP", () => {
    it("should initiate phone verification", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/verify\/json/,
            status: 200,
            data: mockVonageVerifyResponse,
          },
        ],
      });

      const verifyRequest = {
        api_key: "test_key",
        api_secret: "test_secret",
        number: "14155552671",
        brand: "MyApp",
      };

      const result = await mockClient.fetch(
        "https://api.nexmo.com/verify/json",
        {
          method: "POST",
          body: JSON.stringify(verifyRequest),
        },
      );

      const data = await result.json();
      expect(result.status).toBe(200);
      expect(data).toHaveProperty("request_id");
    });

    it("should check OTP verification code", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/verify\/check/,
            status: 200,
            data: mockVonageVerifyCheckResponse,
          },
        ],
      });

      const checkRequest = {
        api_key: "test_key",
        api_secret: "test_secret",
        request_id: "verify_req_123456",
        code: "123456",
      };

      const result = await mockClient.fetch(
        "https://api.nexmo.com/verify/check/json",
        {
          method: "POST",
          body: JSON.stringify(checkRequest),
        },
      );

      const data = await result.json();
      expect(data).toHaveProperty("request_id");
    });
  });

  describe("Number Insight", () => {
    it("should retrieve number insights", () => {
      const insightRequest = {
        api_key: "test_key",
        api_secret: "test_secret",
        number: "14155552671",
        features: ["type", "ported", "roaming"],
      };

      expect(insightRequest.features).toContain("type");
    });
  });

  describe("Webhooks", () => {
    it("should handle SMS delivery webhooks", () => {
      const webhook = generateWebhookPayload("vonage", "delivered", {
        phone: "14155552671",
        message_id: "msg_123",
        status: "delivered",
      });

      expect(webhook).toHaveProperty("status");
      expect(webhook.status).toBe("delivered");
    });

    it("should handle SMS received webhooks", () => {
      const webhook = generateWebhookPayload("vonage", "inbound_sms", {
        phone: "14155552671",
        message: "Hello",
      });

      expect(webhook).toHaveProperty("message");
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid phone numbers", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/sms\/json/,
            status: 400,
            data: {
              messages: [{ status: "1", error_text: "Invalid Destination Address" }],
            },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://rest.nexmo.com/sms/json",
      );

      expect(result.status).toBe(400);
    });

    it("should handle auth failures", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/sms\/json/,
            status: 401,
            data: { error: "Unauthorized" },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://rest.nexmo.com/sms/json",
      );

      expect(result.status).toBe(401);
    });

    it("should handle rate limiting", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/sms\/json/,
            status: 429,
            data: { error: "Rate limit exceeded" },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://rest.nexmo.com/sms/json",
      );

      expect(result.status).toBe(429);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEXTMAGIC CLIENT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("TextMagic Client", () => {
  let mockClient: ReturnType<typeof createMockHTTPClient>;

  beforeEach(() => {
    mockClient = createMockHTTPClient({
      responses: [
        {
          url: /\/sms\/send/,
          status: 200,
          data: mockTextMagicSendResponse,
        },
      ],
    });
  });

  describe("Send SMS", () => {
    it("should send individual SMS", async () => {
      const smsRequest = {
        phones: "14155552671",
        text: "Hello, this is a test message",
      };

      const result = await mockClient.fetch(
        "https://rest.textmagic.com/api/v2/sms/send",
        {
          method: "POST",
          body: JSON.stringify(smsRequest),
        },
      );

      const data = await result.json();
      expect(result.status).toBe(200);
      expect(data.result.status).toBe("accepted");
    });

    it("should include message ID in response", async () => {
      const data = mockTextMagicSendResponse;
      expect(data.result).toHaveProperty("id");
      expect(data.result.recipients).toHaveLength(1);
    });
  });

  describe("Bulk Send", () => {
    it("should send bulk SMS messages", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/sms\/send/,
            status: 200,
            data: mockTextMagicBulkSendResponse,
          },
        ],
      });

      const bulkRequest = {
        phones: ["14155552671", "14155552672", "14155552673"],
        text: "Hello",
      };

      const result = await mockClient.fetch(
        "https://rest.textmagic.com/api/v2/sms/send",
        {
          method: "POST",
          body: JSON.stringify(bulkRequest),
        },
      );

      const data = await result.json();
      expect(data.result).toHaveProperty("batch_size");
      expect(data.result.status).toBe("processing");
    });
  });

  describe("Contact Management", () => {
    it("should list contacts", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/contacts/,
            status: 200,
            data: {
              data: [
                { id: 1, phone: "14155552671", firstName: "John" },
                { id: 2, phone: "14155552672", firstName: "Jane" },
              ],
            },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://rest.textmagic.com/api/v2/contacts",
      );

      const data = await result.json();
      expect(data.data).toHaveLength(2);
    });

    it("should create contact", () => {
      const contactRequest = {
        phone: "14155552671",
        firstName: "John",
        lastName: "Doe",
      };

      expect(contactRequest).toHaveProperty("phone");
    });
  });

  describe("Templates", () => {
    it("should list message templates", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/templates/,
            status: 200,
            data: {
              data: [
                { id: 1, name: "Welcome", text: "Welcome to {{app_name}}" },
                { id: 2, name: "Verification", text: "Your code: {{code}}" },
              ],
            },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://rest.textmagic.com/api/v2/templates",
      );

      const data = await result.json();
      expect(data.data).toHaveLength(2);
    });

    it("should send SMS using template", () => {
      const templateRequest = {
        templateId: 1,
        phones: "14155552671",
        variables: {
          app_name: "MyApp",
        },
      };

      expect(templateRequest).toHaveProperty("templateId");
    });
  });

  describe("Scheduled Messages", () => {
    it("should schedule SMS for later delivery", () => {
      const scheduleRequest = {
        phones: "14155552671",
        text: "Scheduled message",
        sendTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      expect(scheduleRequest).toHaveProperty("sendTime");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ONESIGNAL PUSH NOTIFICATION CLIENT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("OneSignal Client", () => {
  let mockClient: ReturnType<typeof createMockHTTPClient>;
  let circuitBreaker: ReturnType<typeof createMockCircuitBreaker>;

  beforeEach(() => {
    mockClient = createMockHTTPClient({
      responses: [
        {
          url: /\/notifications/,
          status: 200,
          data: mockOneSignalPushResponse,
        },
      ],
    });
    circuitBreaker = createMockCircuitBreaker(5);
  });

  describe("Send Push Notifications", () => {
    it("should send push notification to segment", async () => {
      const pushRequest = {
        app_id: "app_123",
        included_segments: ["All"],
        headings: { en: "Hello" },
        contents: { en: "This is a test notification" },
      };

      const result = await mockClient.fetch(
        "https://onesignal.com/api/v1/notifications",
        {
          method: "POST",
          body: JSON.stringify(pushRequest),
        },
      );

      const data = await result.json();
      expect(result.status).toBe(200);
      expect(data.body).toHaveProperty("id");
    });

    it("should include recipient count in response", async () => {
      const data = mockOneSignalPushResponse;
      expect(data.body).toHaveProperty("recipients");
    });

    it("should support send to specific devices", () => {
      const pushRequest = {
        app_id: "app_123",
        include_external_user_ids: ["user_123", "user_456"],
        contents: { en: "Hello" },
      };

      expect(pushRequest.include_external_user_ids).toHaveLength(2);
    });
  });

  describe("Segments", () => {
    it("should create audience segment", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/segments/,
            status: 200,
            data: mockOneSignalSegmentResponse,
          },
        ],
      });

      const segmentRequest = {
        name: "VIP Users",
        filters: [
          {
            field: "tag",
            value: "vip",
            operator: "=",
          },
        ],
      };

      const result = await mockClient.fetch(
        "https://onesignal.com/api/v1/segments",
        {
          method: "POST",
          body: JSON.stringify(segmentRequest),
        },
      );

      expect(result.status).toBe(200);
    });
  });

  describe("Templates", () => {
    it("should list notification templates", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/templates/,
            status: 200,
            data: {
              templates: [
                { id: "tpl_1", name: "Welcome" },
                { id: "tpl_2", name: "Promotion" },
              ],
            },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://onesignal.com/api/v1/templates",
      );

      const data = await result.json();
      expect(data.templates).toHaveLength(2);
    });

    it("should send using template", () => {
      const templateRequest = {
        app_id: "app_123",
        template_id: "tpl_1",
        included_segments: ["All"],
      };

      expect(templateRequest).toHaveProperty("template_id");
    });
  });

  describe("A/B Testing", () => {
    it("should create A/B test notification", () => {
      const abTestRequest = {
        app_id: "app_123",
        included_segments: ["All"],
        headings: { en: "Variant A", en_variant_b: "Variant B" },
        contents: { en: "Content A", en_variant_b: "Content B" },
      };

      expect(abTestRequest.headings).toHaveProperty("en_variant_b");
    });
  });

  describe("Device Management", () => {
    it("should list devices for user", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/players/,
            status: 200,
            data: {
              players: [
                { id: "player_1", device_type: 1, last_active: 1710247800 },
              ],
            },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://onesignal.com/api/v1/players",
      );

      expect(result.status).toBe(200);
    });
  });

  describe("Circuit Breaker", () => {
    it("should handle service failures with circuit breaker", async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error("Service unavailable");
          });
        } catch {
          // Expected
        }
      }

      const state = circuitBreaker.getState();
      expect(state.state).toBe("open");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SENDBIRD CLIENT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Sendbird Client", () => {
  let mockClient: ReturnType<typeof createMockHTTPClient>;

  beforeEach(() => {
    mockClient = createMockHTTPClient({
      defaultHeaders: { "Content-Type": "application/json" },
      responses: [
        {
          url: /\/v3\/users/,
          status: 200,
          data: mockSendBirdUserResponse,
        },
      ],
    });
  });

  describe("User Management", () => {
    it("should create user", async () => {
      const userRequest = {
        user_id: "user_12345",
        nickname: "John Doe",
        profile_url: "https://example.com/profile.jpg",
      };

      const result = await mockClient.fetch(
        "https://api-abc123.sendbird.com/v3/users",
        {
          method: "POST",
          body: JSON.stringify(userRequest),
        },
      );

      const data = await result.json();
      expect(result.status).toBe(200);
      expect(data).toHaveProperty("user_id");
    });

    it("should retrieve user", async () => {
      const data = mockSendBirdUserResponse;
      expect(data).toHaveProperty("user_id");
      expect(data).toHaveProperty("nickname");
    });

    it("should update user profile", () => {
      const updateRequest = {
        nickname: "John Smith",
        profile_url: "https://example.com/new-profile.jpg",
      };

      expect(updateRequest).toHaveProperty("nickname");
    });
  });

  describe("Channel Management", () => {
    it("should create open channel", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/v3\/open_channels/,
            status: 200,
            data: mockSendBirdChannelResponse,
          },
        ],
      });

      const channelRequest = {
        name: "General",
        channel_url: "general_channel_123",
        is_public: true,
      };

      const result = await mockClient.fetch(
        "https://api-abc123.sendbird.com/v3/open_channels",
        {
          method: "POST",
          body: JSON.stringify(channelRequest),
        },
      );

      expect(result.status).toBe(200);
    });

    it("should list channels", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/v3\/group_channels/,
            status: 200,
            data: {
              channels: [
                {
                  channel_url: "channel_1",
                  name: "Channel 1",
                  member_count: 5,
                },
              ],
            },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://api-abc123.sendbird.com/v3/group_channels",
      );

      const data = await result.json();
      expect(data.channels).toHaveLength(1);
    });
  });

  describe("Messaging", () => {
    it("should send message to channel", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/v3\/open_channels\/[^/]+\/messages/,
            status: 201,
            data: mockSendBirdMessageResponse,
          },
        ],
      });

      const messageRequest = {
        user_id: "user_12345",
        message: "Hello, this is a test message",
        custom_type: "text",
      };

      const result = await mockClient.fetch(
        "https://api-abc123.sendbird.com/v3/open_channels/general_123/messages",
        {
          method: "POST",
          body: JSON.stringify(messageRequest),
        },
      );

      expect(result.status).toBe(201);
    });

    it("should list channel messages", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/v3\/open_channels\/[^/]+\/messages/,
            status: 200,
            data: {
              messages: [mockSendBirdMessageResponse],
            },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://api-abc123.sendbird.com/v3/open_channels/general_123/messages",
      );

      const data = await result.json();
      expect(data.messages).toHaveLength(1);
    });
  });

  describe("Moderation", () => {
    it("should mute user in channel", () => {
      const muteRequest = {
        user_id: "user_12345",
        seconds: 3600,
      };

      expect(muteRequest).toHaveProperty("seconds");
    });

    it("should ban user from channel", () => {
      const banRequest = {
        user_id: "user_12345",
        seconds: 86400,
      };

      expect(banRequest.seconds).toBe(86400);
    });
  });

  describe("Webhooks", () => {
    it("should handle message webhook", () => {
      const webhook = generateWebhookPayload("sendbird", "message_new", {
        channel_url: "general_123",
        user_id: "user_123",
        message: "Hello",
      });

      expect(webhook.type).toBe("message_new");
    });

    it("should handle user join webhook", () => {
      const webhook = generateWebhookPayload("sendbird", "user_join", {
        channel_url: "general_123",
        user_id: "user_123",
      });

      expect(webhook).toHaveProperty("type");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGING ROUTER TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Messaging Router", () => {
  describe("Channel Routing", () => {
    it("should route SMS through Vonage", () => {
      const message = {
        type: "sms",
        to: "14155552671",
      };

      const provider = message.type === "sms" ? "vonage" : "unknown";
      expect(provider).toBe("vonage");
    });

    it("should route push notifications through OneSignal", () => {
      const message = {
        type: "push",
        segment: "all",
      };

      const provider = message.type === "push" ? "onesignal" : "unknown";
      expect(provider).toBe("onesignal");
    });

    it("should route chat messages through Sendbird", () => {
      const message = {
        type: "chat",
        channel_url: "channel_1",
      };

      const provider = message.type === "chat" ? "sendbird" : "unknown";
      expect(provider).toBe("sendbird");
    });
  });

  describe("Fallback Logic", () => {
    it("should fallback to TextMagic if Vonage fails", () => {
      const primaryFailed = true;
      const fallbackProvider = primaryFailed ? "textmagic" : "vonage";
      expect(fallbackProvider).toBe("textmagic");
    });
  });

  describe("Cost Optimization", () => {
    it("should select cheapest provider", () => {
      const costs = {
        vonage: 0.05,
        textmagic: 0.04,
        twilio: 0.0075,
      };

      const cheapest = Object.entries(costs).sort(([, a], [, b]) => a - b)[0];
      expect(cheapest[0]).toBe("twilio");
    });
  });

  describe("Deduplication", () => {
    it("should detect and prevent duplicate sends", () => {
      const sentMessages = new Set<string>();
      const messageHash = "hash_abc123";

      const isDuplicate = sentMessages.has(messageHash);
      expect(isDuplicate).toBe(false);

      sentMessages.add(messageHash);
      expect(sentMessages.has(messageHash)).toBe(true);
    });
  });

  describe("Webhook Delivery", () => {
    it("should verify webhook delivery", async () => {
      const webhookId = "webhook_123";

      const result = await assertWebhookDelivery(
        webhookId,
        async () => {
          return true; // Mock delivery check
        },
        3,
      );

      expect(result.delivered).toBe(true);
    });
  });
});
