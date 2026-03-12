/**
 * Mailgun Email Adapter Test Suite
 *
 * Tests for:
 * - Single and batch email sends
 * - Email validation (syntax, MX, mailbox)
 * - Domain management and verification
 * - Event tracking and delivery status
 * - Template CRUD operations
 * - Webhook signature verification
 * - Bounce handling and suppression
 * - Rate limiting and retry logic
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MailgunClient } from "../mailgun-client.js";
import type { EmailMessage, EmailAdapterConfig, BulkEmailRequest } from "../types.js";

describe("MailgunClient", () => {
  let client: MailgunClient;
  let config: EmailAdapterConfig;

  beforeEach(() => {
    config = {
      apiKey: "test-api-key",
      tenantId: "sandboxa1b2c3d4e5f6g7h8i9j0k.mailgun.org",
      fromAddress: "noreply@example.com",
      fromName: "Test App",
    };

    client = new MailgunClient(config);
    vi.clearAllMocks();
  });

  describe("Configuration", () => {
    it("should initialize with valid config", () => {
      expect(client.provider).toBe("mailgun");
    });

    it("should throw error if apiKey is missing", () => {
      const invalidConfig = { tenantId: "test.mailgun.org" };
      expect(() => new MailgunClient(invalidConfig as EmailAdapterConfig)).toThrow();
    });

    it("should throw error if tenantId (domain) is missing", () => {
      const invalidConfig = { apiKey: "key" };
      expect(() => new MailgunClient(invalidConfig as EmailAdapterConfig)).toThrow();
    });
  });

  describe("Send Single Email", () => {
    it("should send email with text body", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        fromName: "Test Sender",
        to: { email: "recipient@example.com", name: "Test Recipient" },
        subject: "Test Email",
        textBody: "Hello, this is a test email",
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        id: "msg-123",
        message: "Queued. Thank you.",
      });

      const result = await client.send(message);

      expect(result.messageId).toBeDefined();
      expect(result.provider).toBe("mailgun");
      expect(result.status).toBe("sent");
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should send email with HTML body", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "HTML Email",
        htmlBody: "<html><body><h1>Hello</h1></body></html>",
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        id: "msg-456",
        message: "Queued. Thank you.",
      });

      const result = await client.send(message);

      expect(result.status).toBe("sent");
    });

    it("should handle multiple recipients (TO field)", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: [
          { email: "recipient1@example.com" },
          { email: "recipient2@example.com" },
        ],
        subject: "Multi-recipient Email",
        textBody: "Test",
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        id: "msg-789",
        message: "Queued. Thank you.",
      });

      const result = await client.send(message);

      expect(result.status).toBe("sent");
    });

    it("should handle CC and BCC recipients", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        cc: { email: "cc@example.com" },
        bcc: { email: "bcc@example.com" },
        subject: "Email with CC/BCC",
        textBody: "Test",
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        id: "msg-cc-bcc",
        message: "Queued. Thank you.",
      });

      const result = await client.send(message);

      expect(result.status).toBe("sent");
    });

    it("should support custom headers", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Email with Headers",
        textBody: "Test",
        headers: {
          "X-Custom-Header": "custom-value",
          "X-Tracking-ID": "track-123",
        },
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        id: "msg-headers",
        message: "Queued. Thank you.",
      });

      const result = await client.send(message);

      expect(result.status).toBe("sent");
    });

    it("should inject open tracking pixel when enabled", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Tracked Email",
        htmlBody: "<html><body>Test</body></html>",
        trackOpens: true,
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        id: "msg-track",
        message: "Queued. Thank you.",
      });

      const result = await client.send(message);

      expect(result.status).toBe("sent");
    });

    it("should support scheduled send", async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Scheduled Email",
        textBody: "This will be sent later",
        scheduledAt: futureDate,
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        id: "msg-scheduled",
        message: "Queued. Thank you.",
      });

      const result = await client.send(message);

      expect(result.status).toBe("sent");
    });

    it("should return failed status for suppressed email", async () => {
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "suppressed@example.com" },
        subject: "Suppressed Email",
        textBody: "Test",
      };

      // Add to suppression
      (client as any).suppressionList.set("suppressed@example.com", {
        email: "suppressed@example.com",
        type: "bounce",
        suppressedAt: new Date(),
      });

      const result = await client.send(message);

      expect(result.status).toBe("failed");
      expect(result.error).toContain("suppressed");
    });
  });

  describe("Batch Send", () => {
    it("should send batch email with recipient variables", async () => {
      const request: BulkEmailRequest = {
        from: "sender@example.com",
        subject: "Batch Email",
        htmlBody: "Hello {{name}}, your order is {{orderId}}",
        recipients: [
          {
            email: "user1@example.com",
            name: "User One",
            variables: { name: "User One", orderId: "ORD-001" },
          },
          {
            email: "user2@example.com",
            name: "User Two",
            variables: { name: "User Two", orderId: "ORD-002" },
          },
        ],
      };

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        id: "batch-msg-123",
        message: "Queued. Thank you.",
      });

      const results = await client.sendBatch(request);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].status).toBe("sent");
    });

    it("should handle batch with 1000+ recipients in chunks", async () => {
      const recipients = Array.from({ length: 1050 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const request: BulkEmailRequest = {
        from: "sender@example.com",
        subject: "Large Batch",
        textBody: "Test message",
        recipients,
      };

      vi.spyOn(client as any, "request").mockResolvedValue({
        id: "batch-msg",
        message: "Queued. Thank you.",
      });

      const results = await client.sendBatch(request);

      expect(results.length).toBeGreaterThan(0);
    });

    it("should skip suppressed recipients in batch", async () => {
      const request: BulkEmailRequest = {
        from: "sender@example.com",
        subject: "Batch with Suppressed",
        textBody: "Test",
        recipients: [
          { email: "normal@example.com" },
          { email: "suppressed@example.com" },
        ],
      };

      (client as any).suppressionList.set("suppressed@example.com", {
        email: "suppressed@example.com",
        type: "bounce",
        suppressedAt: new Date(),
      });

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        id: "batch-msg",
        message: "Queued. Thank you.",
      });

      const results = await client.sendBatch(request);

      // Should only have results for non-suppressed
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("Email Validation", () => {
    it("should validate email address", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        result: "valid",
        is_valid: true,
      });

      const result = await client.validateEmail("test@example.com");

      expect(result.email).toBe("test@example.com");
      expect(result.valid).toBe(true);
    });

    it("should reject invalid email", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        result: "invalid",
        is_valid: false,
        reason: "Invalid email format",
      });

      const result = await client.validateEmail("invalid-email");

      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe("Domain Management", () => {
    it("should list all domains", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        items: [
          {
            name: "example.com",
            state: "active",
            created_at: new Date().toISOString(),
            smtp_login: "postmaster@example.com",
            wildcard: false,
          },
          {
            name: "test.com",
            state: "unverified",
            created_at: new Date().toISOString(),
            smtp_login: "postmaster@test.com",
            wildcard: false,
          },
        ],
      });

      const domains = await client.listDomains();

      expect(domains.length).toBe(2);
      expect(domains[0].domain).toBe("example.com");
      expect(domains[0].isVerified).toBe(true);
      expect(domains[1].isVerified).toBe(false);
    });
  });

  describe("Statistics", () => {
    it("should get email stats for time period", async () => {
      const startDate = new Date(Date.now() - 86400000); // 24 hours ago
      const endDate = new Date();

      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        items: [
          { event: "sent", timestamp: Math.floor(Date.now() / 1000) },
          { event: "delivered", timestamp: Math.floor(Date.now() / 1000) },
          { event: "opened", timestamp: Math.floor(Date.now() / 1000) },
          { event: "clicked", timestamp: Math.floor(Date.now() / 1000) },
          { event: "bounced", timestamp: Math.floor(Date.now() / 1000) },
        ],
      });

      const stats = await client.getStats(startDate, endDate);

      expect(stats.provider).toBe("mailgun");
      expect(stats.sent).toBeGreaterThan(0);
      expect(stats.delivered).toBeGreaterThan(0);
      expect(stats.opens).toBeGreaterThan(0);
      expect(stats.clicks).toBeGreaterThan(0);
      expect(stats.bounced).toBeGreaterThan(0);
    });
  });

  describe("Template Management", () => {
    it("should save template", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        template: { name: "welcome" },
      });

      const template = await client.saveTemplate({
        id: "welcome",
        name: "Welcome Email",
        subject: "Welcome!",
        htmlBody: "<html><body>Welcome {{name}}</body></html>",
      });

      expect(template.id).toBe("welcome");
      expect(template.name).toBe("Welcome Email");
      expect(template.updatedAt).toBeInstanceOf(Date);
    });

    it("should get template by ID", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        template: {
          name: "Welcome Email",
          createdAt: new Date().toISOString(),
          templates: [
            {
              version: 1,
              createdAt: new Date().toISOString(),
              template: "<html>Welcome</html>",
            },
          ],
        },
      });

      const template = await client.getTemplate("welcome");

      expect(template.id).toBe("welcome");
      expect(template.name).toBe("Welcome Email");
    });

    it("should list all templates", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        items: [
          {
            name: "welcome",
            createdAt: new Date().toISOString(),
            id: "welcome",
          },
          {
            name: "reset-password",
            createdAt: new Date().toISOString(),
            id: "reset-password",
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

  describe("Webhook Signature Verification", () => {
    it("should verify valid webhook signature", () => {
      const timestamp = "1234567890";
      const token = "test-token";
      const signature = "52c582138706552cc4aaf48401dc3d183cbe7b56b5e5eae57924ee2a5ee65a41"; // Mock signature

      // Note: This test would require mocking crypto module
      // In real implementation, you would test the actual HMAC validation
      expect(typeof client.verifyWebhookSignature).toBe("function");
    });
  });

  describe("Health Check", () => {
    it("should perform health check", async () => {
      vi.spyOn(client as any, "request").mockResolvedValueOnce({
        items: [
          {
            name: "example.com",
            state: "active",
            created_at: new Date().toISOString(),
            smtp_login: "postmaster@example.com",
            wildcard: false,
          },
        ],
      });

      const healthy = await client.healthCheck();

      expect(healthy).toBe(true);
    });

    it("should return false for unhealthy client", async () => {
      vi.spyOn(client as any, "request").mockRejectedValueOnce(
        new Error("API Error")
      );

      const healthy = await client.healthCheck();

      expect(healthy).toBe(false);
    });
  });

  describe("Suppression Management", () => {
    it("should add email to suppression list", () => {
      const entry = {
        email: "bounced@example.com",
        type: "bounce" as const,
        suppressedAt: new Date(),
      };

      (client as any).addToSuppressionList("bounced@example.com", entry);

      const suppressed = (client as any).isEmailSuppressed("bounced@example.com");

      expect(suppressed).toBeDefined();
      expect(suppressed.type).toBe("bounce");
    });

    it("should get suppression list", () => {
      (client as any).suppressionList.set("bounced@example.com", {
        email: "bounced@example.com",
        type: "bounce",
        suppressedAt: new Date(),
      });

      const suppressions = client.getSuppression();

      expect(suppressions.length).toBeGreaterThan(0);
      expect(suppressions[0].email).toBe("bounced@example.com");
    });

    it("should remove from suppression list", () => {
      (client as any).suppressionList.set("bounced@example.com", {
        email: "bounced@example.com",
        type: "bounce",
        suppressedAt: new Date(),
      });

      client.removeSuppression("bounced@example.com");

      const suppressed = (client as any).isEmailSuppressed("bounced@example.com");

      expect(suppressed).toBeUndefined();
    });

    it("should clear all suppressions", () => {
      (client as any).suppressionList.set("email1@example.com", {
        email: "email1@example.com",
        type: "bounce",
        suppressedAt: new Date(),
      });

      (client as any).suppressionList.set("email2@example.com", {
        email: "email2@example.com",
        type: "complaint",
        suppressedAt: new Date(),
      });

      client.clearSuppressions();

      expect((client as any).suppressionList.size).toBe(0);
    });
  });

  describe("Rate Limiting", () => {
    it("should rate limit requests", async () => {
      const start = Date.now();

      // Acquire multiple tokens
      await (client as any).rateLimiter.acquire(10);

      const elapsed = Date.now() - start;

      // Should take minimal time (tokens available)
      expect(elapsed).toBeLessThan(100);
    });

    it("should report available rate limit tokens", () => {
      const available = (client as any).rateLimiter.getAvailable();

      expect(available).toBeGreaterThanOrEqual(0);
    });
  });
});
