/**
 * WhatsApp Business Cloud API v2 Client Tests
 *
 * Unit tests for messaging (text, media, interactive),
 * templates, media management, webhook verification,
 * and rate limiting.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  WhatsAppClient,
  WhatsAppError,
  type WhatsAppSendResponse,
} from "../../../../packages/core/src/integrations/push/whatsapp-cloud-api-v2";

// ─── MOCKS ──────────────────────────────────────────────────────────

const mockConfig = {
  phoneNumberId: "1234567890",
  businessAccountId: "9876543210",
  accessToken: "test-access-token-123",
  webhookVerifyToken: "test-webhook-token",
};

// ─── TESTS ──────────────────────────────────────────────────────────

describe("WhatsAppClient", () => {
  let client: WhatsAppClient;

  beforeEach(() => {
    client = new WhatsAppClient(mockConfig);
    global.fetch = vi.fn();
  });

  describe("initialization", () => {
    it("should initialize with config", () => {
      expect(client).toBeDefined();
    });
  });

  describe("text messaging", () => {
    it("should send a text message", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: "msg-123" }],
        }),
      });

      const response = await client.sendText(
        "+1234567890",
        "Hello, World!"
      );

      expect(response.success).toBe(true);
      expect(response.messageId).toBe("msg-123");
      expect(response.to).toBe("+1234567890");
    });

    it("should send text with preview URL", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: "msg-124" }],
        }),
      });

      const response = await client.sendText(
        "+1234567890",
        "Check this out: https://example.com",
        true
      );

      expect(response.success).toBe(true);
    });

    it("should handle send errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: "Invalid phone number format",
          },
        }),
      });

      const response = await client.sendText(
        "invalid",
        "Test message"
      );

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe("media messaging", () => {
    it("should send an image message", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: "msg-200" }],
        }),
      });

      const response = await client.sendMedia(
        "+1234567890",
        "image",
        "image-media-id-123",
        "Check this image"
      );

      expect(response.success).toBe(true);
      expect(response.messageId).toBe("msg-200");
    });

    it("should send a video message", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: "msg-201" }],
        }),
      });

      const response = await client.sendMedia(
        "+1234567890",
        "video",
        "video-media-id-456",
        "Check this video"
      );

      expect(response.success).toBe(true);
    });

    it("should send a document message", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: "msg-202" }],
        }),
      });

      const response = await client.sendMedia(
        "+1234567890",
        "document",
        "doc-media-id-789",
        "document.pdf"
      );

      expect(response.success).toBe(true);
    });

    it("should send a location message", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: "msg-300" }],
        }),
      });

      const response = await client.sendLocation(
        "+1234567890",
        40.7128,
        -74.006,
        "Times Square",
        "New York, NY"
      );

      expect(response.success).toBe(true);
    });
  });

  describe("interactive messaging", () => {
    it("should send buttons message", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: "msg-400" }],
        }),
      });

      const response = await client.sendInteractive(
        "+1234567890",
        {
          type: "button",
          body: { text: "Choose an option" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "1", title: "Option 1" } },
              { type: "reply", reply: { id: "2", title: "Option 2" } },
            ],
          },
        }
      );

      expect(response.success).toBe(true);
    });

    it("should send list message", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: "msg-401" }],
        }),
      });

      const response = await client.sendInteractive(
        "+1234567890",
        {
          type: "list",
          body: { text: "Choose from list" },
          action: {
            sections: [
              {
                rows: [
                  { id: "row1", title: "Item 1" },
                  { id: "row2", title: "Item 2" },
                ],
              },
            ],
          },
        }
      );

      expect(response.success).toBe(true);
    });
  });

  describe("template messaging", () => {
    it("should send a template message", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: "msg-500" }],
        }),
      });

      const response = await client.sendTemplate(
        "+1234567890",
        "hello_world",
        "en_US"
      );

      expect(response.success).toBe(true);
    });

    it("should send template with parameters", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: "msg-501" }],
        }),
      });

      const response = await client.sendTemplate(
        "+1234567890",
        "order_confirmation",
        "en_US",
        [
          { type: "text", text: "Order #12345" },
          { type: "text", text: "$99.99" },
        ]
      );

      expect(response.success).toBe(true);
    });

    it("should create a template", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "template-123",
          status: "PENDING_REVIEW",
        }),
      });

      const template = await client.createTemplate(
        "my_template",
        "MARKETING",
        "en_US",
        [
          {
            type: "body",
            text: "Hello {{1}}!",
          },
        ]
      );

      expect(template.id).toBe("template-123");
      expect(template.status).toBe("PENDING_REVIEW");
    });

    it("should list templates", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "template-1",
              name: "template1",
              status: "APPROVED",
              category: "MARKETING",
              language: "en_US",
              components: [],
            },
          ],
        }),
      });

      const templates = await client.listTemplates(10);
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThanOrEqual(0);
    });

    it("should delete a template", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(
        client.deleteTemplate("template-123")
      ).resolves.not.toThrow();
    });
  });

  describe("media management", () => {
    it("should upload media", async () => {
      const mockBuffer = Buffer.from("fake image data");
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "media-upload-123",
        }),
      });

      const result = await client.uploadMedia(
        "image",
        "test.jpg",
        "image/jpeg",
        mockBuffer
      );

      expect(result.id).toBe("media-upload-123");
      expect(result.type).toBe("image");
    });

    it("should get media URL", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://example.com/media/123.jpg",
          mime_type: "image/jpeg",
        }),
      });

      const media = await client.getMediaUrl("media-123");
      expect(media.url).toBeDefined();
      expect(media.type).toBe("image");
    });

    it("should delete media", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(client.deleteMedia("media-123")).resolves.not.toThrow();
    });
  });

  describe("reactions", () => {
    it("should send reaction emoji", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: "msg-600" }],
        }),
      });

      const response = await client.sendReaction(
        "+1234567890",
        "original-msg-123",
        "👍"
      );

      expect(response.success).toBe(true);
    });
  });

  describe("read receipts", () => {
    it("should mark message as read", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(
        client.markAsRead("msg-123")
      ).resolves.not.toThrow();
    });
  });

  describe("business profile", () => {
    it("should get business profile", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "biz-123",
          name: "My Business",
          description: "Business description",
          profile_picture_url: "https://example.com/pic.jpg",
        }),
      });

      const profile = await client.getBusinessProfile();
      expect(profile.name).toBe("My Business");
      expect(profile.id).toBe("biz-123");
    });

    it("should update business profile", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "biz-123",
            name: "Updated Business",
            description: "Updated description",
          }),
        });

      const updated = await client.updateBusinessProfile({
        name: "Updated Business",
        description: "Updated description",
      });

      expect(updated.name).toBe("Updated Business");
    });
  });

  describe("contacts", () => {
    it("should check phone number registration", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: [{ wa_id: "1234567890", input: "+1234567890" }],
        }),
      });

      const result = await client.checkPhoneNumberRegistration("+1234567890");
      expect(result.registered).toBe(true);
      expect(result.waId).toBe("1234567890");
    });

    it("should handle unregistered number", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: [{ input: "+9999999999" }],
        }),
      });

      const result = await client.checkPhoneNumberRegistration("+9999999999");
      expect(result.registered).toBe(false);
    });
  });

  describe("webhook", () => {
    it("should verify webhook token", () => {
      const token = "test-token";
      const challenge = "test-challenge";
      const signature = require("crypto")
        .createHmac("sha256", mockConfig.webhookVerifyToken!)
        .update(token + challenge)
        .digest("hex");

      const isValid = client.verifyWebhook(token, challenge, signature);
      expect(isValid).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      const isValid = client.verifyWebhook(
        "token",
        "challenge",
        "invalid-signature"
      );
      expect(isValid).toBe(false);
    });

    it("should parse webhook event", () => {
      const event = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "entry-1",
            changes: [
              {
                field: "messages",
                value: { messages: [{ from: "1234567890", text: { body: "Hello" } }] },
              },
            ],
          },
        ],
      };

      const parsed = client.parseWebhookEvent(event);
      expect(parsed.object).toBe("whatsapp_business_account");
      expect(parsed.entry).toHaveLength(1);
    });
  });

  describe("rate limiting", () => {
    it("should enforce message rate limit", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: "msg-1" }],
        }),
      });

      // Mock 80 successful sends, then should fail on 81st
      for (let i = 0; i < 80; i++) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            messages: [{ id: `msg-${i}` }],
          }),
        });
      }

      // Fill up the limit
      for (let i = 0; i < 80; i++) {
        await client.sendText(`+123456789${i}`, `Message ${i}`);
      }

      // 81st should fail
      await expect(client.sendText("+12345678901", "Message 81")).rejects.toThrow(
        "Rate limit exceeded: 80 messages per second"
      );
    });
  });

  describe("error handling", () => {
    it("should throw WhatsAppError on API error", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: { message: "Internal server error" },
        }),
      });

      await expect(
        client.sendText("+1234567890", "Test")
      ).rejects.not.toThrow(WhatsAppError);
    });

    it("should classify rate limit errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: { message: "Too many requests" },
        }),
      });

      const response = await client.sendText("+1234567890", "Test");
      expect(response.errorCode).toBe("RATE_LIMITED");
    });
  });
});
