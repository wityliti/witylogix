/**
 * AWS SES SDK Client Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SesSDKClient } from "../../../../packages/core/src/integrations/email/ses-sdk-client.js";

describe("SesSDKClient", () => {
  let client: SesSDKClient;
  const mockConfig = {
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
  };

  beforeEach(() => {
    client = new SesSDKClient(mockConfig);
    global.fetch = vi.fn();
  });

  describe("Constructor", () => {
    it("should throw error if accessKeyId is missing", () => {
      expect(() => {
        new SesSDKClient({
          accessKeyId: "",
          secretAccessKey: "secret",
          region: "us-east-1",
        });
      }).toThrow("AWS accessKeyId is required");
    });

    it("should throw error if secretAccessKey is missing", () => {
      expect(() => {
        new SesSDKClient({
          accessKeyId: "key",
          secretAccessKey: "",
          region: "us-east-1",
        });
      }).toThrow("AWS secretAccessKey is required");
    });

    it("should throw error if region is missing", () => {
      expect(() => {
        new SesSDKClient({
          accessKeyId: "key",
          secretAccessKey: "secret",
          region: "",
        });
      }).toThrow("AWS region is required");
    });

    it("should initialize with valid config", () => {
      expect(client).toBeDefined();
    });

    it("should use custom baseUrl if provided", () => {
      const customClient = new SesSDKClient({
        ...mockConfig,
        baseUrl: "https://custom.example.com",
      });

      expect(customClient).toBeDefined();
    });
  });

  describe("sendEmail", () => {
    it("should send simple email", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: "msg-123" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const email = {
        source: "test@example.com",
        destination: {
          toAddresses: ["user@example.com"],
        },
        message: {
          subject: { data: "Test" },
          body: { text: { data: "Test message" } },
        },
      };

      const result = await client.sendEmail(email);
      expect(result.messageId).toBe("msg-123");
    });

    it("should include AWS Signature V4 authorization", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: "msg-123" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      await client.sendEmail({
        source: "test@example.com",
        destination: { toAddresses: ["user@example.com"] },
        message: {
          subject: { data: "Test" },
          body: { text: { data: "Test" } },
        },
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.Authorization).toContain("AWS4-HMAC-SHA256");
    });

    it("should support HTML and text content", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: "msg-123" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      await client.sendEmail({
        source: "test@example.com",
        destination: { toAddresses: ["user@example.com"] },
        message: {
          subject: { data: "Test" },
          body: {
            text: { data: "Plain text" },
            html: { data: "<h1>HTML</h1>" },
          },
        },
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it("should support CC and BCC recipients", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: "msg-123" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      await client.sendEmail({
        source: "test@example.com",
        destination: {
          toAddresses: ["user@example.com"],
          ccAddresses: ["cc@example.com"],
          bccAddresses: ["bcc@example.com"],
        },
        message: {
          subject: { data: "Test" },
          body: { text: { data: "Test" } },
        },
      });

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("sendRawEmail", () => {
    it("should send raw MIME email", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: "msg-123" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const email = {
        source: "test@example.com",
        destinations: ["user@example.com"],
        rawMessage: { data: "bWltZS1tZXNzYWdl" },
      };

      const result = await client.sendRawEmail(email);
      expect(result.messageId).toBe("msg-123");
    });
  });

  describe("sendTemplateEmail", () => {
    it("should send templated email", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: "msg-123" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const email = {
        source: "test@example.com",
        destination: { toAddresses: ["user@example.com"] },
        template: "welcome",
        templateData: '{"username":"john"}',
      };

      const result = await client.sendTemplateEmail(email);
      expect(result.messageId).toBe("msg-123");
    });
  });

  describe("Template Management", () => {
    it("should create a template", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templateName: "welcome" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const template = {
        templateName: "welcome",
        subjectPart: "Welcome {{name}}",
        textPart: "Welcome!",
      };

      const result = await client.createTemplate(template);
      expect(result.templateName).toBe("welcome");
    });

    it("should update a template", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.updateTemplate("welcome", {
        subjectPart: "Updated Subject",
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(fetchCall[1].method).toBe("PUT");
    });

    it("should delete a template", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.deleteTemplate("welcome");

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(fetchCall[1].method).toBe("DELETE");
    });

    it("should list templates", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: [] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listTemplates();
      expect(result).toBeDefined();
    });

    it("should get specific template", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templateName: "welcome" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.getTemplate("welcome");
      expect(result.templateName).toBe("welcome");
    });

    it("should test template rendering", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subject: "Welcome John" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.testTemplate("welcome", '{"name":"John"}');

      expect(result).toBeDefined();
    });
  });

  describe("Configuration Sets", () => {
    it("should create a configuration set", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.createConfigSet({
        configurationSetName: "test-config-set",
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it("should delete a configuration set", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.deleteConfigSet("test-config-set");

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(fetchCall[1].method).toBe("DELETE");
    });

    it("should create event destination", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      const eventDest = {
        name: "sns-dest",
        enabled: true,
        matchingEventTypes: ["delivery", "bounce"],
        snsDestination: { topicArn: "arn:aws:sns:..." },
      };

      await client.createEventDestination("test-set", eventDest);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("Identity Verification", () => {
    it("should verify email identity", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.verifyEmailIdentity("test@example.com");

      expect(global.fetch).toHaveBeenCalled();
    });

    it("should verify domain identity", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.verifyDomainIdentity("example.com");

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("Contact Lists", () => {
    it("should create contact list", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      const list = {
        contactListName: "subscribers",
        description: "Email subscribers",
      };

      await client.createContactList(list);

      expect(global.fetch).toHaveBeenCalled();
    });

    it("should add contact to list", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      const contact = {
        emailAddress: "user@example.com",
        unsubscribeAll: false,
      };

      await client.addContact("subscribers", contact);

      expect(global.fetch).toHaveBeenCalled();
    });

    it("should list contact lists", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contactLists: [] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listContactLists();
      expect(result).toBeDefined();
    });
  });

  describe("Suppression Lists", () => {
    it("should list suppressed destinations", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ suppressedDestinationAttributes: [] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listSuppressedDestinations({
        reason: "BOUNCE",
      });

      expect(result).toBeDefined();
    });

    it("should add suppressed destination", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.addSuppressedDestination("bounced@example.com", "BOUNCE");

      expect(global.fetch).toHaveBeenCalled();
    });

    it("should delete suppressed destination", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.deleteSuppressedDestination("bounced@example.com");

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(fetchCall[1].method).toBe("DELETE");
    });
  });

  describe("Account Information", () => {
    it("should get send quota", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          max24HourSend: 50000,
          maxSendRate: 14,
          sent24Hour: 1000,
        }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.getSendQuota();
      expect(result.max24HourSend).toBe(50000);
    });

    it("should get send statistics", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sends: 1000, bounces: 10 }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.getSendStatistics();
      expect(result).toBeDefined();
    });
  });

  describe("SNS Event Handling", () => {
    it("should parse SNS notification", async () => {
      const message = JSON.stringify({
        eventType: "Delivery",
        delivery: {
          recipients: ["user@example.com"],
          timestamp: "2023-01-01T00:00:00Z",
          processingTimeMillis: 1000,
        },
      });

      const result = await client.handleSnsNotification(message);
      expect(result.eventType).toBe("Delivery");
    });
  });

  describe("Error Handling", () => {
    it("should throw error on API failure", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Invalid credentials",
      });

      await expect(
        client.sendEmail({
          source: "test@example.com",
          destination: { toAddresses: ["user@example.com"] },
          message: {
            subject: { data: "Test" },
            body: { text: { data: "Test" } },
          },
        }),
      ).rejects.toThrow("AWS SES API error");
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

  describe("Session Token Support", () => {
    it("should include session token in request if provided", async () => {
      const sessionClient = new SesSDKClient({
        ...mockConfig,
        sessionToken: "test-session-token",
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: "msg-123" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      await sessionClient.sendEmail({
        source: "test@example.com",
        destination: { toAddresses: ["user@example.com"] },
        message: {
          subject: { data: "Test" },
          body: { text: { data: "Test" } },
        },
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const headers = fetchCall[1].headers;
      expect(headers["X-Amz-Security-Token"]).toBe("test-session-token");
    });
  });
});
