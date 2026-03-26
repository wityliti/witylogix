/**
 * WhatsApp Business Client Tests
 *
 * Tests for Meta Cloud API (WhatsApp Business) integration:
 * - Template message sending with parameters
 * - Freeform text messaging within 24hr window
 * - Media messages (image, video, document, audio)
 * - Interactive messages (buttons, lists)
 * - Webhook verification and event parsing
 * - Message status tracking
 * - Template management (list, create, submit)
 * - Phone number quality monitoring
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { WhatsAppBusinessClient } from "../whatsapp-business-client.js";

describe("WhatsAppBusinessClient", () => {
  let client: WhatsAppBusinessClient;

  beforeEach(() => {
    client = new WhatsAppBusinessClient({
      accessToken: "EAABsbCS1iHgBABaZBWX...fake-token",
      businessPhoneNumberId: "102099015432109",
      businessAccountId: "102099015432109",
    });

    global.fetch = vi.fn();
  });

  describe("constructor", () => {
    it("should initialize with valid config", () => {
      expect(client.provider).toBe("whatsapp");
    });

    it("should throw without access token", () => {
      expect(() => {
        new WhatsAppBusinessClient({
          accessToken: "",
          businessPhoneNumberId: "123",
          businessAccountId: "456",
        });
      }).toThrow("requires accessToken and businessPhoneNumberId");
    });

    it("should throw without phone number ID", () => {
      expect(() => {
        new WhatsAppBusinessClient({
          accessToken: "token",
          businessPhoneNumberId: "",
          businessAccountId: "456",
        });
      }).toThrow("requires accessToken and businessPhoneNumberId");
    });
  });

  describe("send template message", () => {
    it("should send template message without parameters", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: "wamid.xxx" }],
        }),
      });

      const result = await client.sendTemplateMessage(
        "+14155552671",
        "hello_world"
      );

      expect(result.messageId).toBeTruthy();
      expect(result.status).toBe("sent");
    });

    it("should send template with text parameters", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: "wamid.abc123" }],
        }),
      });

      const result = await client.sendTemplateMessage(
        "+14155552671",
        "greeting_template",
        "en_US",
        [{ type: "text", text: "John" }]
      );

      expect(result.status).toBe("sent");
    });

    it("should send template with media parameters", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: "wamid.def456" }],
        }),
      });

      const result = await client.sendTemplateMessage(
        "+14155552671",
        "invoice_template",
        "en_US",
        [
          {
            type: "document",
            document: { link: "https://example.com/invoice.pdf" },
          },
        ]
      );

      expect(result.status).toBe("sent");
    });
  });

  describe("send text message", () => {
    it("should send freeform text message", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: "wamid.text123" }],
        }),
      });

      const result = await client.sendTextMessage(
        "+14155552671",
        "Hello, how can I help you?"
      );

      expect(result.messageId).toBeTruthy();
      expect(result.status).toBe("sent");
    });

    it("should send text within 24hr window", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: "wamid.txt456" }],
        }),
      });

      const result = await client.sendTextMessage(
        "+14155552671",
        "This is a follow-up message"
      );

      expect(result.status).toBe("sent");
    });
  });

  describe("send media messages", () => {
    it("should send image message", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: "wamid.img789" }],
        }),
      });

      const result = await client.sendMediaMessage(
        "+14155552671",
        "image",
        "https://example.com/image.jpg",
        "Check this out"
      );

      expect(result.status).toBe("sent");
    });

    it("should send video message", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: "wamid.vid111" }],
        }),
      });

      const result = await client.sendMediaMessage(
        "+14155552671",
        "video",
        "https://example.com/video.mp4",
        "Watch this video"
      );

      expect(result.status).toBe("sent");
    });

    it("should send document message", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: "wamid.doc222" }],
        }),
      });

      const result = await client.sendMediaMessage(
        "+14155552671",
        "document",
        "https://example.com/document.pdf",
        "Here is your document"
      );

      expect(result.status).toBe("sent");
    });

    it("should send audio message without caption", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: "wamid.aud333" }],
        }),
      });

      const result = await client.sendMediaMessage(
        "+14155552671",
        "audio",
        "https://example.com/audio.mp3"
      );

      expect(result.status).toBe("sent");
    });
  });

  describe("send interactive messages", () => {
    it("should send button message", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: "wamid.btn444" }],
        }),
      });

      const result = await client.sendInteractiveMessage(
        "+14155552671",
        "button",
        "Which option do you prefer?",
        [
          { id: "opt1", title: "Option 1" },
          { id: "opt2", title: "Option 2" },
        ],
        "Choose Now"
      );

      expect(result.status).toBe("sent");
    });

    it("should send list message", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: "wamid.list555" }],
        }),
      });

      const result = await client.sendInteractiveMessage(
        "+14155552671",
        "list",
        "Select from the list",
        [
          { id: "prod1", title: "Product 1" },
          { id: "prod2", title: "Product 2" },
          { id: "prod3", title: "Product 3" },
        ]
      );

      expect(result.status).toBe("sent");
    });
  });

  describe("webhook handling", () => {
    it("should verify webhook token", () => {
      const result = client.verifyWebhookToken(
        "test-verify-token",
        "test-verify-token"
      );

      expect(result).toBe("test-verify-token");
    });

    it("should reject invalid webhook token", () => {
      const result = client.verifyWebhookToken(
        "test-verify-token",
        "wrong-token"
      );

      expect(result).toBeNull();
    });

    it("should parse incoming text message", () => {
      const webhook = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: "14155552671",
                      id: "wamid.msg666",
                      timestamp: 1234567890,
                      type: "text",
                      text: {
                        body: "Hello business",
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const event = client.parseWebhookEvent(webhook as any);

      expect(event?.type).toBe("message");
      expect(event?.message?.text).toBe("Hello business");
    });

    it("should parse message status update", () => {
      const webhook = {
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: "wamid.msg777",
                      recipient_id: "14155552671",
                      status: "delivered",
                      timestamp: 1234567890,
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const event = client.parseWebhookEvent(webhook as any);

      expect(event?.type).toBe("status");
      expect(event?.status?.status).toBe("delivered");
    });
  });

  describe("template management", () => {
    it("should list templates", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "123456",
              name: "hello_world",
              status: "APPROVED",
              category: "MARKETING",
            },
            {
              id: "789012",
              name: "order_confirmation",
              status: "APPROVED",
              category: "TRANSACTIONAL",
            },
          ],
        }),
      });

      const templates = await client.listTemplates();

      expect(templates.length).toBe(2);
      expect(templates[0].name).toBe("hello_world");
    });

    it("should create template", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: "new-template-123",
          status: "PENDING_REVIEW",
        }),
      });

      const result = await client.createTemplate(
        "welcome_template",
        "MARKETING",
        "en_US",
        "Welcome to our service! {{firstName}}"
      );

      expect(result.id).toBe("new-template-123");
      expect(result.status).toBe("PENDING_REVIEW");
    });

    it("should get template details", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: "123456",
          name: "hello_world",
          status: "APPROVED",
          category: "MARKETING",
          language: "en_US",
        }),
      });

      const template = await client.getTemplate("123456");

      expect(template.id).toBe("123456");
      expect(template.name).toBe("hello_world");
    });

    it("should submit template for review", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await client.submitTemplateForReview("template-id-999");

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("phone number management", () => {
    it("should get phone number quality rating", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          quality_rating: "HIGH",
        }),
      });

      const quality = await client.getPhoneNumberQuality();

      expect(quality.quality).toBe("HIGH");
      expect(quality.status).toBe("active");
    });

    it("should get business account health", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          health: {
            status: "HEALTHY",
          },
          quality_rating: "HIGH",
        }),
      });

      const health = await client.getBusinessAccountHealth();

      expect(health.status).toBe("HEALTHY");
      expect(health.qualityRating).toBe("HIGH");
    });

    it("should get phone number info", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          display_phone_number: "+14155552671",
          quality_rating: "HIGH",
          name_status: "APPROVED",
          is_official_business_account: true,
        }),
      });

      const info = await client.getPhoneNumberInfo();

      expect(info.phoneNumber).toBe("+14155552671");
      expect(info.qualityRating).toBe("HIGH");
      expect(info.isOfficialBusinessAccount).toBe(true);
    });
  });

  describe("message management", () => {
    it("should mark message as read", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await client.markMessageAsRead("wamid.msg888");

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("media upload", () => {
    it("should upload media file", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          h: "media-handle-999",
        }),
      });

      const fileBuffer = Buffer.from("fake-file-content");
      const result = await client.uploadMedia(
        fileBuffer,
        "image/jpeg",
        "photo.jpg"
      );

      expect(result.mediaId).toBe("media-handle-999");
    });

    it("should upload media from base64 string", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          h: "media-handle-111",
        }),
      });

      const result = await client.uploadMedia(
        "iVBORw0KGgoAAAANSUhEUgAAAAUA...",
        "image/png"
      );

      expect(result.mediaId).toBe("media-handle-111");
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          message: "Invalid recipient",
          error: { code: 400 },
        }),
      });

      await expect(
        client.sendTextMessage("invalid", "Test")
      ).rejects.toThrow();
    });

    it("should handle missing webhook data", () => {
      const event = client.parseWebhookEvent({});

      expect(event).toBeNull();
    });
  });
});
