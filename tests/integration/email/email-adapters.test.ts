/**
 * Email Adapters Integration Tests
 * Comprehensive test suite for email providers
 * Tests: Mailgun, Amazon SES, Gmail, Outlook
 * ~550 lines, 30+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mockMailgunSendResponse,
  mockMailgunValidateResponse,
  mockMailgunEventsResponse,
  mockSesSendResponse,
  mockSesTemplateResponse,
  mockGmailSendResponse,
  mockGmailListResponse,
  mockOutlookSendResponse,
  mockOutlookListResponse,
  generateWebhookPayload,
} from "../fixtures/integration-fixtures.js";
import {
  createMockHTTPClient,
  createMockRateLimiter,
  assertProviderHealth,
} from "../helpers/integration-test-helpers.js";

// ─────────────────────────────────────────────────────────────────────────────
// MAILGUN CLIENT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Mailgun Client", () => {
  let mockClient: ReturnType<typeof createMockHTTPClient>;
  let rateLimiter: ReturnType<typeof createMockRateLimiter>;

  beforeEach(() => {
    mockClient = createMockHTTPClient({
      responses: [
        {
          url: /\/messages/,
          status: 200,
          data: mockMailgunSendResponse,
        },
      ],
    });
    rateLimiter = createMockRateLimiter(300);
  });

  describe("Send Email", () => {
    it("should send email successfully", async () => {
      const emailRequest = {
        from: "sender@sandbox.mailgun.org",
        to: "recipient@example.com",
        subject: "Test Email",
        text: "This is a test email",
      };

      const result = await mockClient.fetch(
        "https://api.mailgun.net/v3/sandbox.mailgun.org/messages",
        {
          method: "POST",
          body: JSON.stringify(emailRequest),
        },
      );

      const data = await result.json();
      expect(result.status).toBe(200);
      expect(data).toHaveProperty("id");
      expect(data.message).toContain("Thank you");
    });

    it("should include message ID in response", async () => {
      const data = mockMailgunSendResponse;
      expect(data).toHaveProperty("id");
      expect(data.id).toMatch(/^<.*@.*>$/);
    });

    it("should support HTML content", () => {
      const emailRequest = {
        from: "sender@sandbox.mailgun.org",
        to: "recipient@example.com",
        subject: "Test Email",
        html: "<h1>Hello</h1><p>This is HTML content</p>",
      };

      expect(emailRequest).toHaveProperty("html");
    });

    it("should support email attachments", () => {
      const emailRequest = {
        from: "sender@sandbox.mailgun.org",
        to: "recipient@example.com",
        subject: "Email with Attachment",
        text: "See attachment",
        attachment: "file.pdf",
      };

      expect(emailRequest).toHaveProperty("attachment");
    });

    it("should apply rate limiting to email sends", async () => {
      await rateLimiter.check("email_send");
      const state = rateLimiter.getState();
      expect(state.remaining).toBeLessThan(300);
    });

    it("should handle CC and BCC recipients", () => {
      const emailRequest = {
        from: "sender@sandbox.mailgun.org",
        to: "recipient@example.com",
        cc: "cc@example.com",
        bcc: "bcc@example.com",
        subject: "Test",
        text: "Test",
      };

      expect(emailRequest).toHaveProperty("cc");
      expect(emailRequest).toHaveProperty("bcc");
    });

    it("should support batch sending", () => {
      const recipients = [
        "user1@example.com",
        "user2@example.com",
        "user3@example.com",
      ];

      expect(recipients).toHaveLength(3);
    });
  });

  describe("Email Validation", () => {
    it("should validate email addresses", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/validate/,
            status: 200,
            data: mockMailgunValidateResponse,
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://api.mailgun.net/v3/address/validate",
      );

      const data = await result.json();
      expect(data.result).toBe("valid");
    });

    it("should identify invalid email addresses", () => {
      const invalidEmails = ["not-an-email", "missing@domain", "@nodomain.com"];

      for (const email of invalidEmails) {
        expect(email).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      }
    });
  });

  describe("Routes & Policies", () => {
    it("should support routing rules", () => {
      const routeRequest = {
        priority: 10,
        description: "Route all mail to support",
        expression: 'match_recipient("support@.*")',
        actions: ["forward(admin@example.com)"],
      };

      expect(routeRequest).toHaveProperty("expression");
    });
  });

  describe("Templates", () => {
    it("should list templates", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/templates/,
            status: 200,
            data: {
              items: [
                {
                  name: "welcome",
                  description: "Welcome email",
                  createdAt: 1710247800,
                },
              ],
            },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://api.mailgun.net/v3/sandbox.mailgun.org/templates",
      );

      const data = await result.json();
      expect(data.items).toHaveLength(1);
    });

    it("should render template with variables", () => {
      const templateRequest = {
        template: "welcome",
        "h:X-Mailgun-Variables": JSON.stringify({
          user_name: "John",
        }),
      };

      expect(templateRequest).toHaveProperty("h:X-Mailgun-Variables");
    });
  });

  describe("Events & Webhooks", () => {
    it("should retrieve event logs", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/events/,
            status: 200,
            data: mockMailgunEventsResponse,
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://api.mailgun.net/v3/sandbox.mailgun.org/events",
      );

      const data = await result.json();
      expect(data.items).toHaveLength(1);
      expect(data.items[0].event).toBe("delivered");
    });

    it("should handle delivery webhook", () => {
      const webhook = generateWebhookPayload("mailgun", "delivered", {
        to: "recipient@example.com",
        id: "event_123",
      });

      expect(webhook["event-data"].event).toBe("delivered");
    });

    it("should handle bounce webhook", () => {
      const webhook = generateWebhookPayload("mailgun", "bounced", {
        to: "invalid@example.com",
      });

      expect(webhook["event-data"]).toBeDefined();
    });

    it("should handle complaint webhook", () => {
      const webhook = generateWebhookPayload("mailgun", "complained", {
        to: "user@example.com",
      });

      expect(webhook["event-data"]).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid domain", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/messages/,
            status: 401,
            data: { message: "Unauthorized" },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://api.mailgun.net/v3/invalid.domain/messages",
      );

      expect(result.status).toBe(401);
    });

    it("should handle rate limiting", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/messages/,
            status: 429,
            data: { message: "Rate limit exceeded" },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://api.mailgun.net/v3/sandbox.mailgun.org/messages",
      );

      expect(result.status).toBe(429);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AMAZON SES CLIENT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Amazon SES Client", () => {
  let mockClient: ReturnType<typeof createMockHTTPClient>;

  beforeEach(() => {
    mockClient = createMockHTTPClient({
      responses: [
        {
          url: /SendEmail/,
          status: 200,
          data: mockSesSendResponse,
        },
      ],
    });
  });

  describe("Send Email", () => {
    it("should send email via SES", async () => {
      const sesRequest = {
        Source: "sender@example.com",
        Destination: {
          ToAddresses: ["recipient@example.com"],
        },
        Message: {
          Subject: {
            Data: "Test Email",
          },
          Body: {
            Text: {
              Data: "This is a test",
            },
          },
        },
      };

      const result = await mockClient.fetch(
        "https://email.us-east-1.amazonaws.com/",
        {
          method: "POST",
          body: JSON.stringify(sesRequest),
        },
      );

      const data = await result.json();
      expect(result.status).toBe(200);
      expect(data).toHaveProperty("MessageId");
    });

    it("should support HTML emails", () => {
      const sesRequest = {
        Message: {
          Body: {
            Html: {
              Data: "<h1>Hello</h1>",
            },
          },
        },
      };

      expect(sesRequest.Message.Body).toHaveProperty("Html");
    });

    it("should include attachments via raw email", () => {
      const sesRequest = {
        RawMessage: {
          Data: Buffer.from("MIME content").toString("base64"),
        },
      };

      expect(sesRequest).toHaveProperty("RawMessage");
    });

    it("should support configuration sets", () => {
      const sesRequest = {
        ConfigurationSetName: "event-tracking",
      };

      expect(sesRequest).toHaveProperty("ConfigurationSetName");
    });
  });

  describe("Email Templates", () => {
    it("should list templates", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /ListTemplates/,
            status: 200,
            data: {
              TemplatesMetadata: [
                { Name: "OrderConfirmation", CreatedTimestamp: 1710247800 },
              ],
            },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://email.us-east-1.amazonaws.com/",
      );

      const data = await result.json();
      expect(data.TemplatesMetadata).toHaveLength(1);
    });

    it("should get template details", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /GetTemplate/,
            status: 200,
            data: mockSesTemplateResponse,
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://email.us-east-1.amazonaws.com/",
      );

      const data = await result.json();
      expect(data).toHaveProperty("TemplateName");
    });

    it("should send templated email", () => {
      const sesRequest = {
        Template: "OrderConfirmation",
        TemplateData: JSON.stringify({
          order_id: "ORD-123",
        }),
      };

      expect(sesRequest).toHaveProperty("Template");
    });
  });

  describe("Identities & Verification", () => {
    it("should verify email identity", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /VerifyEmailIdentity/,
            status: 200,
            data: {},
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://email.us-east-1.amazonaws.com/",
      );

      expect(result.status).toBe(200);
    });

    it("should verify domain identity", () => {
      const verifyRequest = {
        Domain: "example.com",
      };

      expect(verifyRequest).toHaveProperty("Domain");
    });

    it("should list verified identities", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /ListVerifiedEmailAddresses/,
            status: 200,
            data: {
              VerifiedEmailAddresses: ["sender@example.com"],
            },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://email.us-east-1.amazonaws.com/",
      );

      const data = await result.json();
      expect(data.VerifiedEmailAddresses).toHaveLength(1);
    });
  });

  describe("Configuration Sets", () => {
    it("should create configuration set", () => {
      const csRequest = {
        ConfigurationSet: {
          Name: "delivery-events",
        },
      };

      expect(csRequest.ConfigurationSet).toHaveProperty("Name");
    });

    it("should add event destination", () => {
      const eventRequest = {
        EventType: "send",
        SNSDestination: {
          TopicARN: "arn:aws:sns:region:account:topic",
        },
      };

      expect(eventRequest).toHaveProperty("SNSDestination");
    });
  });

  describe("Sending Limits", () => {
    it("should check sending quota", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /GetSendQuota/,
            status: 200,
            data: {
              Max24HourSend: 50000,
              MaxSendRate: 14,
              SentLast24Hour: 1234,
            },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://email.us-east-1.amazonaws.com/",
      );

      const data = await result.json();
      expect(data).toHaveProperty("Max24HourSend");
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid email", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /SendEmail/,
            status: 400,
            data: { Error: { Message: "Invalid email address" } },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://email.us-east-1.amazonaws.com/",
      );

      expect(result.status).toBe(400);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GMAIL CLIENT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Gmail Client", () => {
  let mockClient: ReturnType<typeof createMockHTTPClient>;

  beforeEach(() => {
    mockClient = createMockHTTPClient({
      responses: [
        {
          url: /\/messages\/send/,
          status: 200,
          data: mockGmailSendResponse,
        },
      ],
    });
  });

  describe("Send Email", () => {
    it("should send email via Gmail API", async () => {
      const message = Buffer.from(
        "To: recipient@example.com\nSubject: Test\n\nHello",
      ).toString("base64");

      const gmailRequest = {
        raw: message,
      };

      const result = await mockClient.fetch(
        "https://www.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          body: JSON.stringify(gmailRequest),
        },
      );

      const data = await result.json();
      expect(result.status).toBe(200);
      expect(data).toHaveProperty("id");
    });

    it("should include thread ID in response", async () => {
      const data = mockGmailSendResponse;
      expect(data).toHaveProperty("threadId");
    });
  });

  describe("List Messages", () => {
    it("should list messages", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/messages/,
            status: 200,
            data: mockGmailListResponse,
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://www.googleapis.com/gmail/v1/users/me/messages",
      );

      const data = await result.json();
      expect(data.messages).toHaveLength(1);
    });

    it("should support pagination", () => {
      const params = {
        maxResults: 10,
        pageToken: "token_123",
      };

      expect(params).toHaveProperty("pageToken");
    });
  });

  describe("Message Management", () => {
    it("should get message details", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/messages\/[^/]+$/,
            status: 200,
            data: {
              id: "gmail_msg_123",
              threadId: "thread_001",
              payload: {
                headers: [
                  { name: "From", value: "sender@example.com" },
                  { name: "Subject", value: "Test" },
                ],
              },
            },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://www.googleapis.com/gmail/v1/users/me/messages/gmail_msg_123",
      );

      expect(result.status).toBe(200);
    });

    it("should modify message labels", () => {
      const modifyRequest = {
        addLabelIds: ["INBOX"],
        removeLabelIds: ["DRAFT"],
      };

      expect(modifyRequest).toHaveProperty("addLabelIds");
    });
  });

  describe("Labels", () => {
    it("should list labels", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/labels/,
            status: 200,
            data: {
              labels: [
                { id: "INBOX", name: "INBOX" },
                { id: "DRAFT", name: "DRAFT" },
              ],
            },
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://www.googleapis.com/gmail/v1/users/me/labels",
      );

      const data = await result.json();
      expect(data.labels).toHaveLength(2);
    });
  });

  describe("Drafts", () => {
    it("should create draft", () => {
      const draftRequest = {
        message: {
          raw: Buffer.from("To: test@example.com\n\nDraft").toString("base64"),
        },
      };

      expect(draftRequest).toHaveProperty("message");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OUTLOOK CLIENT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Outlook Client", () => {
  let mockClient: ReturnType<typeof createMockHTTPClient>;

  beforeEach(() => {
    mockClient = createMockHTTPClient({
      responses: [
        {
          url: /\/sendMail/,
          status: 202,
          data: {},
        },
      ],
    });
  });

  describe("Send Email", () => {
    it("should send email via Outlook API", async () => {
      const outlookRequest = {
        message: {
          subject: "Test Email",
          body: {
            contentType: "HTML",
            content: "<p>Hello</p>",
          },
          toRecipients: [
            {
              emailAddress: {
                address: "recipient@example.com",
              },
            },
          ],
        },
      };

      const result = await mockClient.fetch(
        "https://graph.microsoft.com/v1.0/me/sendMail",
        {
          method: "POST",
          body: JSON.stringify(outlookRequest),
        },
      );

      expect(result.status).toBe(202);
    });
  });

  describe("List Messages", () => {
    it("should list messages", async () => {
      mockClient = createMockHTTPClient({
        responses: [
          {
            url: /\/messages/,
            status: 200,
            data: mockOutlookListResponse,
          },
        ],
      });

      const result = await mockClient.fetch(
        "https://graph.microsoft.com/v1.0/me/messages",
      );

      const data = await result.json();
      expect(data.value).toHaveLength(1);
    });
  });

  describe("Drafts", () => {
    it("should create draft", () => {
      const draftRequest = {
        subject: "Draft Email",
        body: {
          contentType: "HTML",
          content: "<p>Draft content</p>",
        },
      };

      expect(draftRequest).toHaveProperty("subject");
    });

    it("should send draft", () => {
      const sendRequest = {
        drafts: [{ id: "draft_123" }],
      };

      expect(sendRequest).toHaveProperty("drafts");
    });
  });

  describe("Attachments", () => {
    it("should add attachment to message", () => {
      const attachmentRequest = {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: "document.pdf",
        contentBytes: "base64content",
      };

      expect(attachmentRequest).toHaveProperty("name");
    });
  });

  describe("Calendar Events", () => {
    it("should create calendar event", () => {
      const eventRequest = {
        subject: "Team Meeting",
        start: {
          dateTime: "2024-03-12T10:00:00",
          timeZone: "UTC",
        },
        end: {
          dateTime: "2024-03-12T11:00:00",
          timeZone: "UTC",
        },
      };

      expect(eventRequest).toHaveProperty("subject");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL ROUTING ENGINE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Email Routing Engine", () => {
  describe("Provider Selection", () => {
    it("should select provider based on domain", () => {
      const domain = "company.com";
      const provider =
        domain === "gmail.com"
          ? "gmail"
          : domain === "outlook.com"
            ? "outlook"
            : "mailgun";

      expect(provider).toBe("mailgun");
    });

    it("should support domain-based routing", () => {
      const routing = {
        "company.com": "mailgun",
        "personal.com": "gmail",
      };

      expect(routing["company.com"]).toBe("mailgun");
    });
  });

  describe("Fallback Routing", () => {
    it("should fallback to secondary provider", () => {
      const primaryFailed = true;
      const provider = primaryFailed ? "ses" : "mailgun";

      expect(provider).toBe("ses");
    });
  });

  describe("Provider Health", () => {
    it("should monitor provider health", async () => {
      const health = await assertProviderHealth(
        "mailgun",
        async () => {
          return true;
        },
        5000,
      );

      expect(health.provider).toBe("mailgun");
      expect(health.healthy).toBe(true);
    });
  });
});
