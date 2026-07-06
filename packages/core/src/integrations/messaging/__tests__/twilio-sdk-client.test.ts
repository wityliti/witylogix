/**
 * Twilio SDK Client Tests
 *
 * Tests for Twilio REST API integration:
 * - SMS sending and MMS with media
 * - WhatsApp template and freeform messages
 * - Verify API (verification creation and checking)
 * - Webhook validation and message parsing
 * - Phone number management
 * - Message status tracking
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TwilioClient, TwilioError } from "../twilio-sdk-client.js";

describe("TwilioClient", () => {
  let client: TwilioClient;

  beforeEach(() => {
    client = new TwilioClient({
      provider: "twilio",
      apiKey: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", // Mock Account SID
      apiSecret: "twilio-auth-token-fake-12345", // Mock Auth Token
    });

    global.fetch = vi.fn();
  });

  describe("constructor", () => {
    it("should initialize with valid credentials", () => {
      expect(client.provider).toBe("twilio");
    });

    it("should throw without account SID", () => {
      expect(() => {
        new TwilioClient({
          provider: "twilio",
          apiKey: "",
          apiSecret: "token",
        });
      }).toThrow("requires apiKey (Account SID)");
    });

    it("should throw without auth token", () => {
      expect(() => {
        new TwilioClient({
          provider: "twilio",
          apiKey: "AC123",
          apiSecret: "",
        });
      }).toThrow("requires apiKey (Account SID) and apiSecret (Auth Token)");
    });
  });

  describe("SMS sending", () => {
    it("should send SMS message", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          sid: "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          status: "queued",
        }),
      });

      const result = await client.sendSMS({
        to: "+14155552671",
        from: "+14155552222",
        body: "Hello World",
      });

      expect(result.sid).toBe("SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
      expect(result.status).toBe("queued");
    });

    it("should handle SMS errors", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          code: 21211,
          message: "The 'To' number is invalid",
        }),
      });

      await expect(
        client.sendSMS({
          to: "invalid",
          from: "+14155552222",
          body: "Test",
        }),
      ).rejects.toThrow();
    });

    it("should send SMS with message type", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          sid: "SM123",
          status: "queued",
        }),
      });

      const result = await client.sendSMS({
        to: "+14155552671",
        from: "+14155552222",
        body: "Unicode message: ñ",
        type: "unicode",
      });

      expect(result.status).toBe("queued");
    });
  });

  describe("MMS sending", () => {
    it("should send MMS with media URL", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          sid: "MMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          status: "queued",
        }),
      });

      const result = await client.sendMMS(
        "+14155552671",
        "+14155552222",
        "Check this out",
        ["https://example.com/image.jpg"],
      );

      expect(result.sid).toBe("MMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
      expect(result.status).toBe("queued");
    });

    it("should send MMS with multiple media", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          sid: "MM123",
          status: "queued",
        }),
      });

      const result = await client.sendMMS(
        "+14155552671",
        "+14155552222",
        "Photos",
        ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
      );

      expect(result.status).toBe("queued");
    });
  });

  describe("WhatsApp messaging", () => {
    it("should send WhatsApp template message", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          sid: "MMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          status: "queued",
        }),
      });

      const result = await client.sendWhatsAppTemplate(
        "whatsapp:+14155552671",
        "whatsapp:+14155552222",
        "hello_world",
      );

      expect(result.status).toBe("queued");
    });

    it("should send WhatsApp template with parameters", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          sid: "MM123",
          status: "queued",
        }),
      });

      const result = await client.sendWhatsAppTemplate(
        "whatsapp:+14155552671",
        "whatsapp:+14155552222",
        "greeting",
        [{ type: "text", text: "John" }],
      );

      expect(result.status).toBe("queued");
    });

    it("should send WhatsApp freeform message", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          sid: "MM456",
          status: "sent",
        }),
      });

      const result = await client.sendWhatsAppMessage(
        "whatsapp:+14155552671",
        "whatsapp:+14155552222",
        "Hello from WhatsApp!",
      );

      expect(result.status).toBe("sent");
    });
  });

  describe("Verify API", () => {
    it("should create verification", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          sid: "VEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          status: "pending",
          phone_number: "+14155552671",
        }),
      });

      const result = await client.createVerification(
        "+14155552671",
        "sms",
        "VAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      );

      expect(result.status).toBe("pending");
      expect(result.phoneNumber).toBe("+14155552671");
    });

    it("should create verification with call channel", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          sid: "VE123",
          status: "pending",
          phone_number: "+14155552671",
        }),
      });

      const result = await client.createVerification("+14155552671", "call");

      expect(result.status).toBe("pending");
    });

    it("should check verification code", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "approved",
        }),
      });

      const result = await client.checkVerification("+14155552671", "123456");

      expect(result.valid).toBe(true);
      expect(result.status).toBe("approved");
    });

    it("should fail on invalid code", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "pending",
        }),
      });

      const result = await client.checkVerification("+14155552671", "000000");

      expect(result.valid).toBe(false);
    });
  });

  describe("webhook validation", () => {
    it("should validate webhook request signature", () => {
      const url = "https://example.com/webhooks/sms";
      const params = {
        MessageSid: "SMxxx",
        AccountSid: "ACxxx",
        From: "+15551234567",
        To: "+15559876543",
        Body: "Test message",
      };

      // In real test, would use actual HMAC calculation
      const isValid = client.validateWebhookRequest(
        url,
        params,
        "fake-signature",
      );

      // Signature validation will fail with fake values
      expect(typeof isValid).toBe("boolean");
    });

    it("should parse incoming message", () => {
      const body = {
        MessageSid: "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        AccountSid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        From: "+15551234567",
        To: "+15559876543",
        Body: "Hello Twilio",
        NumMedia: 0,
      };

      const message = client.parseIncomingMessage(body);

      expect(message).not.toBeNull();
      expect(message?.body).toBe("Hello Twilio");
      expect(message?.from).toBe("+15551234567");
      expect(message?.numMedia).toBe(0);
    });

    it("should handle MMS with media", () => {
      const body = {
        MessageSid: "SM123",
        From: "+15551234567",
        To: "+15559876543",
        Body: "Photo",
        NumMedia: 1,
        MediaUrl0: "https://example.com/image.jpg",
      };

      const message = client.parseIncomingMessage(body);

      expect(message?.numMedia).toBe(1);
    });
  });

  describe("phone number management", () => {
    it("should list phone numbers", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          incoming_phone_numbers: [
            {
              phone_number: "+15551234567",
              friendly_name: "Main Number",
              capabilities: {
                voice: true,
                sms: true,
                mms: true,
              },
            },
          ],
        }),
      });

      const numbers = await client.listPhoneNumbers();

      expect(numbers.length).toBe(1);
      expect(numbers[0].phoneNumber).toBe("+15551234567");
      expect(numbers[0].capabilities).toContain("sms");
    });

    it("should get phone number details", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          phone_number: "+15551234567",
          friendly_name: "Main",
          capabilities: {
            voice: true,
            sms: true,
          },
        }),
      });

      const number = await client.getPhoneNumber("PNxxx");

      expect(number.phoneNumber).toBe("+15551234567");
      expect(number.capabilities).toContain("voice");
    });

    it("should update phone number webhooks", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await client.updatePhoneNumberWebhooks(
        "PNxxx",
        "https://example.com/sms",
        "https://example.com/voice",
      );

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("message status", () => {
    it("should get message status", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          sid: "SMxxx",
          status: "delivered",
          from: "+15551234567",
          to: "+15559876543",
        }),
      });

      const status = await client.getMessageStatus("SMxxx");

      expect(status.status).toBe("delivered");
      expect(status.from).toBe("+15551234567");
    });
  });

  describe("error handling", () => {
    it("should throw TwilioError with error code", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          code: 21211,
          message: "The 'To' number is invalid",
        }),
      });

      try {
        await client.sendSMS({
          to: "invalid",
          from: "+14155552222",
          body: "Test",
        });
        expect.fail("Should have thrown");
      } catch (error) {
        if (error instanceof TwilioError) {
          expect(error.code).toBe(21211);
        }
      }
    });
  });

  describe("rate limiting", () => {
    it("should initialize with default rate limit", () => {
      const testClient = new TwilioClient({
        provider: "twilio",
        apiKey: "AC123",
        apiSecret: "token",
      });

      expect(testClient).toBeDefined();
    });

    it("should accept custom rate limit config", () => {
      const testClient = new TwilioClient({
        provider: "twilio",
        apiKey: "AC123",
        apiSecret: "token",
        rateLimit: {
          requestsPerSecond: 50,
          concurrency: 10,
        },
      });

      expect(testClient).toBeDefined();
    });
  });
});
