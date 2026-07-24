/**
 * WhatsApp Provider Tests
 * Comprehensive test suite for Meta Cloud API WhatsApp provider
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WhatsAppProvider } from "../whatsapp";
import {
  RateLimitError,
  InvalidRecipientError,
  AuthenticationError,
  ProviderError,
} from "../types";

describe("WhatsAppProvider", () => {
  let provider: WhatsAppProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    provider = new WhatsAppProvider({
      accessToken: "whatsapp-access-token-12345",
      phoneNumberId: "123456789012345",
    });
  });

  describe("send()", () => {
    it("should send text message successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          messages: [{ id: "wamid.message-id-12345" }],
          contacts: [{ input: "+14155552671", wa_id: "14155552671" }],
        }),
      });

      const result = await provider.send({
        to: "+14155552671",
        body: "Hello, this is a test message",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("wamid.message-id-12345");
    });

    it("should build correct text message payload", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          messages: [{ id: "wamid.test" }],
        }),
      });

      await provider.send({
        to: "+14155552671",
        body: "Test message body",
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body).toEqual(
        expect.objectContaining({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: "+14155552671",
          type: "text",
          text: expect.objectContaining({
            body: "Test message body",
            preview_url: false,
          }),
        }),
      );
    });

    it("should send template message with parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          messages: [{ id: "wamid.template-msg" }],
        }),
      });

      const result = await provider.send({
        to: "+14155552671",
        templateId: "order_confirmation",
        variables: { orderId: "ORD123", amount: "$99.99" },
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalled();

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.type).toBe("template");
      expect(body.template.name).toBe("order_confirmation");
      expect(body.template.parameters.body.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "text", text: "ORD123" }),
          expect.objectContaining({ type: "text", text: "$99.99" }),
        ]),
      );
    });

    it("should handle Meta error code 131000 (invalid token)", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          error: { code: 131000, message: "Invalid access token" },
        }),
      });

      const result = await provider.send({
        to: "+14155552671",
        body: "Test",
      });

      expect(result.success).toBe(false);
    });

    it("should handle Meta error code 131047 (rate limit)", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          error: { code: 131047, message: "Rate limit exceeded" },
        }),
      });

      const result = await provider.send({
        to: "+14155552671",
        body: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Rate limit exceeded");
    });

    it("should handle Meta error code 131048 (spam limit)", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          error: { code: 131048, message: "Spam limit exceeded" },
        }),
      });

      const result = await provider.send({
        to: "+14155552671",
        body: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Spam limit exceeded");
    });

    it("should handle authentication error (401 response)", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          error: { code: 190, message: "Invalid access token" },
        }),
      });

      const result = await provider.send({
        to: "+14155552671",
        body: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid access token");
    });

    it("should reject invalid phone number format", async () => {
      const result = await provider.send({
        to: "14155552671", // Missing +
        body: "Test",
      });

      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should reject missing access token", async () => {
      const providerNoAuth = new WhatsAppProvider({
        accessToken: "",
        phoneNumberId: "123456789",
      });

      const result = await providerNoAuth.send({
        to: "+14155552671",
        body: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing access token");
    });

    it("should reject missing phone number ID", async () => {
      const providerNoPhone = new WhatsAppProvider({
        accessToken: "token123",
        phoneNumberId: "",
      });

      const result = await providerNoPhone.send({
        to: "+14155552671",
        body: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing phone number ID");
    });

    it("should strip HTML tags from text body", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          messages: [{ id: "wamid.test" }],
        }),
      });

      await provider.send({
        to: "+14155552671",
        body: "<p>This is <b>bold</b> text</p>",
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.text.body).toBe("This is bold text");
    });

    it("should handle parameter-less template messages", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          messages: [{ id: "wamid.test" }],
        }),
      });

      await provider.send({
        to: "+14155552671",
        templateId: "simple_template",
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.template.parameters.body.parameters).toEqual([]);
    });

    it("should handle HTTP 400 parameter errors", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          error: { code: 100, message: "Invalid parameter" },
        }),
      });

      const result = await provider.send({
        to: "+14155552671",
        templateId: "template",
      });

      expect(result.success).toBe(false);
    });

    it("should verify Authorization header format", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          messages: [{ id: "wamid.test" }],
        }),
      });

      await provider.send({
        to: "+14155552671",
        body: "Test",
      });

      const call = mockFetch.mock.calls[0];
      const headers = call[1].headers;

      expect(headers.Authorization).toBe("Bearer whatsapp-access-token-12345");
    });
  });

  describe("validateConfig()", () => {
    it("should validate correct configuration", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn(),
      });

      const result = await provider.validateConfig({
        accessToken: "valid-token",
        phoneNumberId: "123456789",
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://graph.facebook.com/v19.0/123456789",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer valid-token",
          }),
        }),
      );
    });

    it("should reject missing access token", async () => {
      const result = await provider.validateConfig({
        accessToken: "",
        phoneNumberId: "123456789",
      });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should reject missing phone number ID", async () => {
      const result = await provider.validateConfig({
        accessToken: "token",
        phoneNumberId: "",
      });

      expect(result).toBe(false);
    });

    it("should handle validation API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        ok: false,
      });

      const result = await provider.validateConfig({
        accessToken: "invalid",
        phoneNumberId: "123456789",
      });

      expect(result).toBe(false);
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.validateConfig({
        accessToken: "token",
        phoneNumberId: "123456789",
      });

      expect(result).toBe(false);
    });
  });

  describe("getStatus()", () => {
    it("should return healthy status by checking business profile", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          quality_rating: "GREEN",
          messaging_limit_mtc: 1000,
          messaging_limit_mtc_reset_time: Math.floor(Date.now() / 1000) + 86400,
        }),
      });

      const status = await provider.getStatus();

      expect(status.healthy).toBe(true);
      expect(status.latency).toBeDefined();
      expect(status.quotaRemaining).toBe(1000);
    });

    it("should report unhealthy when quality rating is FLAGGED", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          quality_rating: "FLAGGED",
          messaging_limit_mtc: 1000,
        }),
      });

      const status = await provider.getStatus();

      expect(status.healthy).toBe(false);
    });

    it("should cache status for 60 seconds", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          quality_rating: "GREEN",
          messaging_limit_mtc: 1000,
        }),
      });

      const status1 = await provider.getStatus();
      const status2 = await provider.getStatus();

      expect(status1).toEqual(status2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle health check API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
        ok: false,
        headers: new Map(),
      });

      const status = await provider.getStatus();

      expect(status.healthy).toBe(false);
      expect(status.lastError).toContain("Health check failed with status 500");
    });

    it("should handle network errors in health check", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const status = await provider.getStatus();

      expect(status.healthy).toBe(false);
      expect(status.lastError).toContain("Connection refused");
    });

    it("should measure latency correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          quality_rating: "GREEN",
          messaging_limit_mtc: 1000,
        }),
      });

      const status = await provider.getStatus();

      expect(status.latency).toBeDefined();
      expect(typeof status.latency).toBe("number");
      expect(status.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe("channel and name properties", () => {
    it("should have correct channel type", () => {
      expect(provider.channel).toBe("WHATSAPP");
    });

    it("should have correct provider name", () => {
      expect(provider.name).toBe("Meta Cloud API");
    });
  });
});
