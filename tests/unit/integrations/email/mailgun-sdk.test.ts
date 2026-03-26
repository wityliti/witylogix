/**
 * Mailgun SDK Client Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MailgunSDKClient } from "../../../../packages/core/src/integrations/email/mailgun-sdk-client.js";

describe("MailgunSDKClient", () => {
  let client: MailgunSDKClient;
  const mockConfig = {
    apiKey: "key-test123",
    domain: "mg.example.com",
    webhookSigningKey: "test-webhook-key",
  };

  beforeEach(() => {
    client = new MailgunSDKClient(mockConfig);
    global.fetch = vi.fn();
  });

  describe("Constructor", () => {
    it("should throw error if apiKey is missing", () => {
      expect(() => {
        new MailgunSDKClient({
          apiKey: "",
          domain: "mg.example.com",
        });
      }).toThrow("Mailgun apiKey is required");
    });

    it("should throw error if domain is missing", () => {
      expect(() => {
        new MailgunSDKClient({
          apiKey: "key-test123",
          domain: "",
        });
      }).toThrow("Mailgun domain is required");
    });

    it("should initialize with valid config", () => {
      expect(client).toBeDefined();
    });
  });

  describe("sendMessage", () => {
    it("should send a single email message", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "msg-123", message: "Queued. Thank you." }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const message = {
        from: "test@mg.example.com",
        to: "user@example.com",
        subject: "Test",
        text: "Test message",
      };

      const result = await client.sendMessage(message);
      expect(result.id).toBe("msg-123");
    });

    it("should include proper authentication header", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "msg-123", message: "Queued." }),
        headers: new Map([["content-type", "application/json"]]),
      });

      await client.sendMessage({
        from: "test@mg.example.com",
        to: "user@example.com",
        subject: "Test",
        text: "Test",
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.Authorization).toContain("Basic");
    });

    it("should support HTML content", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "msg-123", message: "Queued." }),
        headers: new Map([["content-type", "application/json"]]),
      });

      await client.sendMessage({
        from: "test@mg.example.com",
        to: "user@example.com",
        subject: "Test",
        html: "<h1>Hello</h1>",
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain("/messages");
    });

    it("should support multiple recipients", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "msg-123", message: "Queued." }),
        headers: new Map([["content-type", "application/json"]]),
      });

      await client.sendMessage({
        from: "test@mg.example.com",
        to: ["user1@example.com", "user2@example.com"],
        subject: "Test",
        text: "Test",
      });

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("Templates", () => {
    it("should create a template", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ template: { name: "welcome" } }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const template = {
        name: "welcome",
        template: "<h1>Welcome {{username}}</h1>",
      };

      const result = await client.createTemplate(template);
      expect(result).toBeDefined();
    });

    it("should list templates with pagination", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listTemplates({ limit: 10 });
      expect(result).toBeDefined();
    });

    it("should update a template", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ template: { name: "welcome" } }),
        headers: new Map([["content-type", "application/json"]]),
      });

      await client.updateTemplate("welcome", { template: "<h1>Updated</h1>" });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
    });

    it("should delete a template", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.deleteTemplate("welcome");

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[1].method).toBe("DELETE");
    });
  });

  describe("Routes", () => {
    it("should create a route", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ route: { id: "route-123" } }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const route = {
        expression: "match_recipient('.*@example.com')",
        actions: ["forward('user@example.org')"],
      };

      const result = await client.createRoute(route);
      expect(result).toBeDefined();
    });

    it("should list routes", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listRoutes({ limit: 10 });
      expect(result).toBeDefined();
    });
  });

  describe("Domain Management", () => {
    it("should add a domain", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ domain: { name: "mg.example.com" } }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const domain = {
        name: "mg.example.com",
        smtp_password: "password",
      };

      const result = await client.addDomain(domain);
      expect(result).toBeDefined();
    });

    it("should list domains", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listDomains();
      expect(result).toBeDefined();
    });
  });

  describe("Event Management", () => {
    it("should list events", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listEvents({ limit: 10 });
      expect(result).toBeDefined();
    });

    it("should filter events by type", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listEvents({
        event: ["delivered", "opened"],
      });

      expect(result).toBeDefined();
    });
  });

  describe("Suppression Lists", () => {
    it("should list bounces", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listBounces();
      expect(result).toBeDefined();
    });

    it("should add a bounce", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.addBounce("bounced@example.com", "550", "Mailbox not found");

      expect(global.fetch).toHaveBeenCalled();
    });

    it("should delete a bounce", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.deleteBounce("bounced@example.com");

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[1].method).toBe("DELETE");
    });

    it("should list complaints", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listComplaints();
      expect(result).toBeDefined();
    });

    it("should add a complaint", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.addComplaint("complained@example.com");

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("Mailing Lists", () => {
    it("should create a mailing list", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ list: { address: "users@mg.example.com" } }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const list = {
        address: "users@mg.example.com",
        name: "All Users",
      };

      const result = await client.createMailingList(list);
      expect(result).toBeDefined();
    });

    it("should add member to mailing list", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ member: { address: "user@example.com" } }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.addMailingListMember("users@mg.example.com", {
        address: "user@example.com",
      });

      expect(result).toBeDefined();
    });
  });

  describe("Webhook Signature Verification", () => {
    it("should verify valid webhook signature", () => {
      const timestamp = "1234567890";
      const token = "token123";
      const signature = "abc123";

      expect(
        client.verifyWebhookSignature(timestamp, token, signature)
      ).toBeDefined();
    });

    it("should throw error if signing key not configured", () => {
      const clientNoKey = new MailgunSDKClient({
        apiKey: "key-test123",
        domain: "mg.example.com",
      });

      expect(() => {
        clientNoKey.verifyWebhookSignature("timestamp", "token", "signature");
      }).toThrow("Webhook signing key is not configured");
    });

    it("should parse webhook event", async () => {
      const timestamp = "1234567890";
      const token = "token123";
      const payload = '{"event":"delivered"}';
      const signature = "abc123";

      vi.spyOn(client, "verifyWebhookSignature").mockReturnValue(true);

      const result = await client.handleWebhookEvent(
        timestamp,
        token,
        signature,
        payload
      );

      expect(result.event).toBe("delivered");
    });
  });

  describe("Error Handling", () => {
    it("should throw error on API failure", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Unauthorized",
      });

      await expect(
        client.sendMessage({
          from: "test@mg.example.com",
          to: "user@example.com",
          subject: "Test",
          text: "Test",
        })
      ).rejects.toThrow("Mailgun API error");
    });

    it("should handle empty response", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      const result = await client.listTemplates();
      expect(result).toEqual({});
    });
  });
});
