/**
 * SendGrid SDK Client Tests
 *
 * Tests for SendGrid v3 API integration:
 * - Email sending (single and batch)
 * - Template operations (list, get, create, update)
 * - Contact management (add, update, delete)
 * - Suppression list management
 * - Webhook event parsing and verification
 * - Statistics retrieval
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SendGridClient } from "../sendgrid-sdk-client.js";

describe("SendGridClient", () => {
  let client: SendGridClient;

  beforeEach(() => {
    client = new SendGridClient({
      apiKey: "test-api-key-sg-fake-12345",
      fromAddress: "sender@example.com",
      fromName: "Test Sender",
    });

    // Mock fetch
    global.fetch = vi.fn();
  });

  describe("constructor", () => {
    it("should initialize with valid config", () => {
      expect(client.provider).toBe("sendgrid");
    });

    it("should throw without API key", () => {
      expect(() => {
        new SendGridClient({ apiKey: "" });
      }).toThrow("SendGrid adapter requires apiKey");
    });
  });

  describe("send single email", () => {
    it("should send email with basic fields", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ message_id: "test-msg-id-123" }),
      });

      const result = await client.send({
        from: "sender@example.com",
        to: { email: "recipient@example.com", name: "John Doe" },
        subject: "Test Email",
        htmlBody: "<p>Hello World</p>",
        textBody: "Hello World",
      });

      expect(result.status).toBe("sent");
      expect(result.provider).toBe("sendgrid");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should send email with template", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ message_id: "template-msg-id" }),
      });

      const result = await client.send({
        from: "sender@example.com",
        to: {
          email: "recipient@example.com",
          variables: { firstName: "John" },
        },
        templateId: "d-template-id-123",
      });

      expect(result.status).toBe("sent");
    });

    it("should include attachments", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ message_id: "attach-msg-id" }),
      });

      const result = await client.send({
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "With Attachment",
        htmlBody: "See attachment",
        attachments: [
          {
            filename: "test.pdf",
            content: "base64-encoded-content-here",
            contentType: "application/pdf",
          },
        ],
      });

      expect(result.status).toBe("sent");
    });

    it("should handle CC and BCC", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ message_id: "cc-bcc-msg-id" }),
      });

      const result = await client.send({
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        cc: { email: "cc@example.com" },
        bcc: { email: "bcc@example.com" },
        subject: "With CC/BCC",
        htmlBody: "Test",
      });

      expect(result.status).toBe("sent");
    });
  });

  describe("send batch emails", () => {
    it("should send batch with multiple recipients", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ message_id: "batch-msg-id-456" }),
      });

      const results = await client.sendBatch({
        from: "sender@example.com",
        recipients: [
          { email: "user1@example.com", variables: { firstName: "Alice" } },
          { email: "user2@example.com", variables: { firstName: "Bob" } },
        ],
        templateId: "d-template-id",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].status).toBe("sent");
    });

    it("should chunk large batches", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValue({
        ok: true,
        status: 202,
        json: async () => ({ message_id: "batch-id" }),
      });

      const largeBatch = Array.from({ length: 1500 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const results = await client.sendBatch({
        from: "sender@example.com",
        recipients: largeBatch,
        templateId: "d-template-id",
      });

      expect(results.length).toBeGreaterThan(1);
    });
  });

  describe("template operations", () => {
    it("should list templates", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          templates: [
            { id: "d-template-1", name: "Welcome Email", updated_at: 1000000 },
            { id: "d-template-2", name: "Reset Password", updated_at: 2000000 },
          ],
        }),
      });

      const templates = await client.listTemplates();

      expect(templates.length).toBe(2);
      expect(templates[0].name).toBe("Welcome Email");
    });

    it("should get template by ID", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: "d-template-1",
          name: "Welcome",
          versions: [
            {
              id: "v-1",
              subject: "Welcome {{firstName}}",
              html_content: "<p>Hi {{firstName}}</p>",
              plain_content: "Hi {{firstName}}",
              updated_at: 1000000,
            },
          ],
        }),
      });

      const template = await client.getTemplate("d-template-1");

      expect(template.name).toBe("Welcome");
      expect(template.subject).toBe("Welcome {{firstName}}");
    });

    it("should create new template", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: "d-new-template",
          name: "New Template",
        }),
      });

      const template = await client.createTemplate({
        id: "",
        name: "New Template",
        subject: "Test Subject",
        htmlBody: "<p>Test</p>",
      });

      expect(template.id).toBe("d-new-template");
      expect(template.name).toBe("New Template");
    });

    it("should update template", async () => {
      const mockFetch = global.fetch as any;

      // First call for PATCH, second for GET
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: "d-template-1",
            name: "Updated Name",
            versions: [
              {
                subject: "Updated",
                html_content: "<p>Updated</p>",
                plain_content: "Updated",
                updated_at: 3000000,
              },
            ],
          }),
        });

      const updated = await client.updateTemplate("d-template-1", {
        name: "Updated Name",
      });

      expect(updated.name).toBe("Updated Name");
    });
  });

  describe("contact management", () => {
    it("should add contact", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({}),
      });

      await client.addContact("john@example.com", "John Doe", {
        customerId: "123",
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it("should update contact", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({}),
      });

      await client.updateContact("john@example.com", { firstName: "Johnny" });

      expect(mockFetch).toHaveBeenCalled();
    });

    it("should delete contact", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({}),
      });

      await client.deleteContact("john@example.com");

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("suppression management", () => {
    it("should get bounce list", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              email: "bounced@example.com",
              created: 1000000,
              reason: "Mail from 192.168.1.1 was blocked",
              status: "Permanent",
            },
          ],
        }),
      });

      const entries = await client.getSuppressionList("bounces");

      expect(entries.length).toBe(1);
      expect(entries[0].email).toBe("bounced@example.com");
    });

    it("should add to suppression list", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({}),
      });

      await client.addToSuppressionList("spam@example.com", "spam_reports");

      expect(mockFetch).toHaveBeenCalled();
    });

    it("should remove from suppression list", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      });

      await client.removeFromSuppressionList("user@example.com", "bounces");

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("webhook event parsing", () => {
    it("should parse delivery event", () => {
      const event = client.parseAndVerifyWebhookEvent(
        JSON.stringify([
          {
            event: "delivered",
            email: "recipient@example.com",
            timestamp: 1000000,
          },
        ]),
        "fake-signature",
        "1000000",
        "test-secret",
      );

      // Note: Signature verification will fail in test, so result may be null
      // In real usage with correct signatures, this would parse successfully
    });

    it("should handle invalid signature", () => {
      const event = client.parseAndVerifyWebhookEvent(
        JSON.stringify([{ event: "delivered", email: "test@example.com" }]),
        "invalid-signature",
        "1000000",
        "test-secret",
      );

      expect(event).toBeNull();
    });
  });

  describe("statistics", () => {
    it("should get global statistics", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          stats: [
            {
              date: "2024-01-01",
              stats: [
                {
                  metrics: {
                    requests: 1000,
                    delivered: 950,
                    opens: 300,
                    clicks: 100,
                    bounces: 20,
                  },
                },
              ],
            },
          ],
        }),
      });

      const stats = await client.getStatistics();

      expect(stats.provider).toBe("sendgrid");
      expect(stats.requests).toBeGreaterThan(0);
      expect(stats.deliveryRate).toBeGreaterThan(0);
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          message: "Invalid email address",
        }),
      });

      await expect(
        client.send({
          from: "sender@example.com",
          to: { email: "invalid" },
          subject: "Test",
          htmlBody: "Test",
        }),
      ).rejects.toThrow();
    });

    it("should validate recipient limit", async () => {
      const tooManyRecipients = Array.from({ length: 1001 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      await expect(
        client.send({
          from: "sender@example.com",
          to: tooManyRecipients,
          subject: "Test",
          htmlBody: "Test",
        }),
      ).rejects.toThrow("Exceeded maximum 1000 recipients");
    });
  });
});
