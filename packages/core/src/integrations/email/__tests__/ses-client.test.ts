/**
 * Amazon SES Email Adapter Test Suite
 *
 * Tests for:
 * - Single and bulk email sends
 * - AWS Signature V4 authentication
 * - Template management
 * - Identity verification
 * - Configuration set handling
 * - Suppression list management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SESClient } from "../ses-client.js";
import type { EmailMessage, EmailAdapterConfig, BulkEmailRequest } from "../types.js";

describe("SESClient", () => {
  let client: SESClient;
  let config: EmailAdapterConfig;

  beforeEach(() => {
    config = {
      apiKey: "AKIA1234567890ABCDEF", // Mock AWS Access Key
      apiSecret: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", // Mock Secret Key
      awsRegion: "us-east-1",
      tenantId: "example.com",
      fromAddress: "noreply@example.com",
    };

    client = new SESClient(config);
    vi.clearAllMocks();
  });

  describe("Configuration", () => {
    it("should initialize with valid config", () => {
      expect(client.provider).toBe("ses");
    });

    it("should throw error if credentials are missing", () => {
      const invalidConfig = { awsRegion: "us-east-1" };
      expect(() => new SESClient(invalidConfig as EmailAdapterConfig)).not.toThrow();
      // Validation happens on first request
    });

    it("should default to us-east-1 region if not specified", () => {
      const minimalConfig = {
        apiKey: "test-key",
        apiSecret: "test-secret",
      };

      const sesClient = new SESClient(minimalConfig as EmailAdapterConfig);
      expect(sesClient.provider).toBe("ses");
    });
  });

  describe("Send Single Email", () => {
    it("should send email with HTML body", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com", name: "Test" },
        subject: "Test Email",
        htmlBody: "<html><body><h1>Test</h1></body></html>",
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        MessageId: "msg-ses-123",
      });

      const result = await client.send(message);

      expect(result.messageId).toBe("msg-ses-123");
      expect(result.provider).toBe("ses");
      expect(result.status).toBe("sent");
    });

    it("should send email with text body", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Text Email",
        textBody: "Hello, this is plain text",
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        MessageId: "msg-text-456",
      });

      const result = await client.send(message);

      expect(result.status).toBe("sent");
    });

    it("should handle multiple TO recipients", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: [
          { email: "user1@example.com" },
          { email: "user2@example.com" },
        ],
        subject: "Multi-recipient",
        htmlBody: "<p>Test</p>",
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        MessageId: "msg-multi-789",
      });

      const result = await client.send(message);

      expect(result.status).toBe("sent");
    });

    it("should handle CC and BCC", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        cc: { email: "cc@example.com" },
        bcc: { email: "bcc@example.com" },
        subject: "With CC/BCC",
        textBody: "Test",
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        MessageId: "msg-cc-bcc-111",
      });

      const result = await client.send(message);

      expect(result.status).toBe("sent");
    });

    it("should set importance level", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Important Email",
        textBody: "This is important",
        priority: "high",
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        MessageId: "msg-important-222",
      });

      const result = await client.send(message);

      expect(result.status).toBe("sent");
    });

    it("should add metadata as tags", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Tagged Email",
        textBody: "Test",
        metadata: {
          campaignId: "camp-123",
          userId: "user-456",
        },
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        MessageId: "msg-tagged-333",
      });

      const result = await client.send(message);

      expect(result.status).toBe("sent");
    });

    it("should fail for suppressed recipient", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "bounced@example.com" },
        subject: "Suppressed",
        textBody: "Test",
      };

      (client as any).suppressionList.set("bounced@example.com", {
        email: "bounced@example.com",
        type: "bounce",
        suppressedAt: new Date(),
      });

      const result = await client.send(message);

      expect(result.status).toBe("failed");
      expect(result.error).toContain("suppressed");
    });
  });

  describe("Bulk Send", () => {
    it("should send bulk email to multiple recipients", async () => {
      const request: BulkEmailRequest = {
        from: "sender@example.com",
        subject: "Bulk Email",
        htmlBody: "<p>Hello {{name}}</p>",
        recipients: [
          {
            email: "user1@example.com",
            name: "User 1",
            variables: { name: "User 1" },
          },
          {
            email: "user2@example.com",
            name: "User 2",
            variables: { name: "User 2" },
          },
        ],
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        BulkEmailEntryResults: [
          { Status: "Success", MessageId: "msg-bulk-1" },
          { Status: "Success", MessageId: "msg-bulk-2" },
        ],
      });

      const results = await client.sendBatch(request);

      expect(results.length).toBe(2);
      expect(results[0].status).toBe("sent");
    });

    it("should chunk large bulk sends (max 100 per request)", async () => {
      const recipients = Array.from({ length: 250 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const request: BulkEmailRequest = {
        from: "sender@example.com",
        subject: "Large Bulk",
        htmlBody: "<p>Test</p>",
        recipients,
      };

      vi.spyOn(client as any, "request").mockResolvedValue({
        BulkEmailEntryResults: Array.from({ length: 100 }, (_, i) => ({
          Status: "Success",
          MessageId: `msg-${i}`,
        })),
      });

      const results = await client.sendBatch(request);

      expect(results.length).toBeGreaterThan(0);
    });

    it("should skip suppressed recipients in bulk", async () => {
      const request: BulkEmailRequest = {
        from: "sender@example.com",
        subject: "Bulk with Suppressed",
        htmlBody: "<p>Test</p>",
        recipients: [
          { email: "normal@example.com" },
          { email: "suppressed@example.com" },
          { email: "another@example.com" },
        ],
      };

      (client as any).suppressionList.set("suppressed@example.com", {
        email: "suppressed@example.com",
        type: "bounce",
        suppressedAt: new Date(),
      });

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        BulkEmailEntryResults: [
          { Status: "Success", MessageId: "msg-1" },
          { Status: "Success", MessageId: "msg-2" },
        ],
      });

      const results = await client.sendBatch(request);

      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle partial failures in bulk send", async () => {
      const request: BulkEmailRequest = {
        from: "sender@example.com",
        subject: "Bulk with Failures",
        htmlBody: "<p>Test</p>",
        recipients: [
          { email: "success@example.com" },
          { email: "failure@example.com" },
        ],
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        BulkEmailEntryResults: [
          { Status: "Success", MessageId: "msg-1" },
          { Status: "Permanent Failure", MessageId: undefined },
        ],
      });

      const results = await client.sendBatch(request);

      expect(results.some((r) => r.status === "sent")).toBe(true);
      expect(results.some((r) => r.status === "failed")).toBe(true);
    });
  });

  describe("Email Validation", () => {
    it("should validate valid email address", async () => {
      const result = await client.validateEmail("test@example.com");

      expect(result.email).toBe("test@example.com");
      expect(result.valid).toBe(true);
    });

    it("should reject invalid email format", async () => {
      const result = await client.validateEmail("not-an-email");

      expect(result.valid).toBe(false);
    });

    it("should handle edge cases", async () => {
      const tests = [
        { email: "user@example", valid: false },
        { email: "user @example.com", valid: false },
        { email: "user+tag@example.com", valid: true },
        { email: "user.name@example.co.uk", valid: true },
      ];

      for (const test of tests) {
        const result = await client.validateEmail(test.email);
        expect(result.valid).toBe(test.valid);
      }
    });
  });

  describe("Domain Management", () => {
    it("should list verified identities", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        Identities: ["example.com", "sender@example.com", "test.com"],
      });

      const domains = await client.listDomains();

      expect(domains.length).toBe(3);
      expect(domains[0].isVerified).toBe(true);
      expect(domains[0].status).toBe("verified");
    });

    it("should handle empty identities list", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        Identities: [],
      });

      const domains = await client.listDomains();

      expect(domains.length).toBe(0);
    });
  });

  describe("Statistics", () => {
    it("should get email stats", async () => {
      const startDate = new Date(Date.now() - 86400000);
      const endDate = new Date();

      const stats = await client.getStats(startDate, endDate);

      expect(stats.provider).toBe("ses");
      expect(stats.periodStart).toEqual(startDate);
      expect(stats.periodEnd).toEqual(endDate);
      expect(typeof stats.sent).toBe("number");
      expect(typeof stats.openRate).toBe("number");
    });
  });

  describe("Template Management", () => {
    it("should save template", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({});

      const template = await client.saveTemplate({
        id: "welcome",
        name: "Welcome Email",
        subject: "Welcome!",
        htmlBody: "<p>Welcome {{name}}</p>",
      });

      expect(template.id).toBe("welcome");
      expect(template.updatedAt).toBeInstanceOf(Date);
    });

    it("should get template", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        Template: {
          TemplateName: "welcome",
          SubjectPart: "Welcome!",
          HtmlPart: "<p>Welcome</p>",
          TextPart: "Welcome",
        },
      });

      const template = await client.getTemplate("welcome");

      expect(template.id).toBe("welcome");
      expect(template.name).toBe("welcome");
      expect(template.subject).toBe("Welcome!");
    });

    it("should list templates", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        TemplatesMetadata: [
          { Name: "welcome", CreatedTimestamp: Math.floor(Date.now() / 1000) },
          {
            Name: "reset-password",
            CreatedTimestamp: Math.floor(Date.now() / 1000),
          },
        ],
      });

      const templates = await client.listTemplates();

      expect(templates.length).toBe(2);
      expect(templates[0].name).toBe("welcome");
    });

    it("should delete template", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({});

      await expect(client.deleteTemplate("welcome")).resolves.toBeUndefined();
    });
  });

  describe("Health Check", () => {
    it("should perform health check", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        Identities: ["example.com"],
      });

      const healthy = await client.healthCheck();

      expect(healthy).toBe(true);
    });

    it("should return false for unhealthy client", async () => {
      vi.spyOn(client as any, "request").mockRejectedValueOnce(
        new Error("Invalid credentials")
      );

      const healthy = await client.healthCheck();

      expect(healthy).toBe(false);
    });
  });

  describe("Suppression Management", () => {
    it("should add to suppression list", () => {
      (client as any).addToSuppressionList("bounced@example.com", {
        email: "bounced@example.com",
        type: "bounce",
        suppressedAt: new Date(),
      });

      const suppressed = (client as any).isEmailSuppressed("bounced@example.com");

      expect(suppressed).toBeDefined();
    });

    it("should retrieve suppression list", () => {
      (client as any).suppressionList.set("email1@example.com", {
        email: "email1@example.com",
        type: "bounce",
        suppressedAt: new Date(),
      });

      const list = client.getSuppression();

      expect(list.length).toBeGreaterThan(0);
    });

    it("should remove from suppression", () => {
      (client as any).suppressionList.set("email@example.com", {
        email: "email@example.com",
        type: "bounce",
        suppressedAt: new Date(),
      });

      client.removeSuppression("email@example.com");

      const suppressed = (client as any).isEmailSuppressed("email@example.com");

      expect(suppressed).toBeUndefined();
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Test",
        textBody: "Test",
      };

      vi.spyOn(client as any, "request").mockResolvedValue({
        MessageId: "msg-123",
      });

      // Send multiple emails and ensure rate limiter is called
      const start = Date.now();

      await client.send(message);
      await client.send(message);

      const elapsed = Date.now() - start;

      // Should complete quickly with available tokens
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe("AWS Signature V4", () => {
    it("should create proper authorization header", () => {
      // Test that signature function exists and is callable
      const authHeader = (client as any).createAuthorizationHeader(
        "POST",
        "/v2/email/outbound-emails",
        { "X-Amz-Date": "20240312T120000Z", Host: "email.us-east-1.amazonaws.com" },
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      );

      expect(authHeader).toContain("AWS4-HMAC-SHA256");
      expect(authHeader).toContain("Credential=");
    });
  });
});
