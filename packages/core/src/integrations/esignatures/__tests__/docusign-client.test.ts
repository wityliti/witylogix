/**
 * DocuSign Client Tests.
 *
 * Comprehensive test suite for DocuSign e-signature adapter.
 * Tests OAuth2, JWT, envelope management, templates, signing, and webhooks.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock undici's fetch so the DocuSign client uses our mock instead of making real HTTP requests.
// The mockFetch variable is set in each test/beforeEach to control responses.
let mockFetch: ReturnType<typeof vi.fn>;
vi.mock("undici", () => ({
  fetch: (...args: any[]) => mockFetch(...args),
}));

import { DocuSignClient } from "../docusign-client.js";
import type {
  ESignatureConfig,
  Envelope,
  Signer,
  Document,
  SigningField,
} from "../types.js";

/** Create a mock fetch that handles the 3-call initialize sequence then delegates to a custom handler */
function createInitMock(
  afterInitHandler?: (...args: any[]) => Promise<Response>,
) {
  const tokenResponse = () =>
    new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }));
  const okResponse = () => new Response("{}", { status: 200 });
  const fn = vi
    .fn()
    .mockResolvedValueOnce(tokenResponse()) // refreshOAuth2Token during verifyCredentials
    .mockResolvedValueOnce(okResponse()) // account check during verifyCredentials
    .mockResolvedValueOnce(tokenResponse()); // refreshToken at end of initialize
  if (afterInitHandler) {
    fn.mockImplementation(afterInitHandler);
  }
  return fn;
}

describe("DocuSignClient", () => {
  let client: DocuSignClient;
  let mockConfig: ESignatureConfig;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new DocuSignClient();
    mockConfig = {
      apiUrl: "https://na3.docusign.net",
      authType: "oauth2",
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      refreshToken: "test-refresh-token",
      accountId: "test-account-id",
      webhookUrl: "https://example.com/webhook",
    };
  });

  describe("initialization", () => {
    it("should initialize with OAuth2 config", async () => {
      mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        )
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        );

      await expect(client.initialize(mockConfig)).resolves.not.toThrow();
    });

    it("should throw error if accountId is missing", async () => {
      const config = { ...mockConfig, accountId: "" };
      await expect(client.initialize(config)).rejects.toThrow(
        "accountId is required",
      );
    });

    it("should verify credentials", async () => {
      mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        )
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        )
        .mockResolvedValueOnce(new Response("{}", { status: 200 }));

      await client.initialize(mockConfig);
      const verified = await client.verifyCredentials();
      expect(verified).toBe(true);
    });
  });

  describe("envelope management", () => {
    beforeEach(async () => {
      // initialize makes 3 fetch calls: refreshToken during verifyCredentials,
      // account check during verifyCredentials, and refreshToken at end
      mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        )
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        );
      await client.initialize(mockConfig);
    });

    it("should create envelope", async () => {
      const envelope = createMockEnvelope();

      mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ envelopeId: "test-envelope-id" }), {
            status: 201,
          }),
        ),
      );

      const result = await client.createEnvelope(envelope);
      expect(result.envelopeId).toBe("test-envelope-id");
      expect(result.status).toBe("created");
    });

    it("should send envelope", async () => {
      mockFetch = vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({}), { status: 200 })),
      );

      const result = await client.sendEnvelope("test-envelope-id");
      expect(result.status).toBe("sent");
    });

    it("should void envelope", async () => {
      mockFetch = vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({}), { status: 200 })),
      );

      await expect(
        client.voidEnvelope("test-envelope-id", "User request"),
      ).resolves.not.toThrow();
    });

    it("should get envelope status", async () => {
      mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              envelopeId: "test-envelope-id",
              status: "sent",
              statusChangedDateTime: new Date().toISOString(),
              recipients: {
                signers: [
                  {
                    email: "signer@example.com",
                    name: "John Signer",
                    status: "sent",
                  },
                ],
              },
            }),
            { status: 200 },
          ),
        ),
      );

      const status = await client.getEnvelopeStatus("test-envelope-id");
      expect(status.status).toBe("sent");
      expect(status.signerStatuses).toHaveLength(1);
      expect(status.signerStatuses[0].email).toBe("signer@example.com");
    });

    it("should list envelopes", async () => {
      mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              envelopes: [
                {
                  envelopeId: "env1",
                  emailSubject: "Document 1",
                  status: "completed",
                  statusChangedDateTime: new Date().toISOString(),
                },
              ],
              totalSetSize: 1,
            }),
            { status: 200 },
          ),
        ),
      );

      const result = await client.listEnvelopes({ limit: 20 });
      expect(result.total).toBe(1);
      expect(result.envelopes).toHaveLength(1);
    });

    it("should resend envelope", async () => {
      mockFetch = vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({}), { status: 200 })),
      );

      await expect(
        client.resendEnvelope("test-envelope-id", ["signer@example.com"]),
      ).resolves.not.toThrow();
    });
  });

  describe("template management", () => {
    beforeEach(async () => {
      // initialize makes 3 fetch calls: refreshToken during verifyCredentials,
      // account check during verifyCredentials, and refreshToken at end
      mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        )
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        );
      await client.initialize(mockConfig);
    });

    it("should list templates", async () => {
      mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              envelopeTemplates: [
                {
                  templateId: "template-1",
                  name: "Test Template",
                  dateModified: new Date().toISOString(),
                },
              ],
              totalSetSize: 1,
            }),
            { status: 200 },
          ),
        ),
      );

      const result = await client.listTemplates({ limit: 20 });
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].name).toBe("Test Template");
    });

    it("should get template", async () => {
      mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              templateId: "template-1",
              name: "Test Template",
              dateModified: new Date().toISOString(),
            }),
            { status: 200 },
          ),
        ),
      );

      const template = await client.getTemplate("template-1");
      expect(template.id).toBe("template-1");
      expect(template.name).toBe("Test Template");
    });

    it("should create envelope from template", async () => {
      mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ envelopeId: "env-from-template" }), {
            status: 201,
          }),
        ),
      );

      const result = await client.createEnvelopeFromTemplate("template-1", {
        signers: [
          {
            email: "signer@example.com",
            name: "John",
            order: 1,
            requiresSequentialSigning: false,
          },
        ],
        subject: "Sign This",
      });

      expect(result.envelopeId).toBe("env-from-template");
      expect(result.status).toBe("created");
    });
  });

  describe("document management", () => {
    beforeEach(async () => {
      // initialize makes 3 fetch calls: refreshToken during verifyCredentials,
      // account check during verifyCredentials, and refreshToken at end
      mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        )
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        );
      await client.initialize(mockConfig);
    });

    it("should download document", async () => {
      const pdfContent = Buffer.from("PDF content").toString("base64");

      mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(Buffer.from(pdfContent, "base64"), { status: 200 }),
        ),
      );

      const result = await client.downloadDocument("env-id", "doc-id");
      expect(result.documentId).toBe("doc-id");
      expect(result.mimeType).toBe("application/pdf");
    });

    it("should download all documents", async () => {
      const zipContent = Buffer.from("ZIP content").toString("base64");

      mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(Buffer.from(zipContent, "base64"), { status: 200 }),
        ),
      );

      const result = await client.downloadEnvelopeDocuments("env-id");
      expect(result.mimeType).toBe("application/zip");
      expect(result.fileName).toContain("envelope_env-id.zip");
    });
  });

  describe("signing", () => {
    beforeEach(async () => {
      // initialize makes 3 fetch calls: refreshToken during verifyCredentials,
      // account check during verifyCredentials, and refreshToken at end
      mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        )
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        );
      await client.initialize(mockConfig);
    });

    it("should get embedded signing URL", async () => {
      mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ url: "https://docusign.com/signing" }),
            { status: 200 },
          ),
        ),
      );

      const result = await client.getEmbeddedSigningUrl(
        "env-id",
        "signer@example.com",
        "https://return.example.com",
      );

      expect(result.signingUrl).toBe("https://docusign.com/signing");
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("should mark document as viewed", async () => {
      await expect(
        client.markDocumentViewed("env-id", "signer@example.com"),
      ).resolves.not.toThrow();
    });
  });

  describe("events and webhooks", () => {
    beforeEach(async () => {
      // initialize makes 3 fetch calls: refreshToken during verifyCredentials,
      // account check during verifyCredentials, and refreshToken at end
      mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        )
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        );
      await client.initialize(mockConfig);
    });

    it("should get envelope events", async () => {
      mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              envelopeId: "env-id",
              status: "completed",
              statusChangedDateTime: new Date().toISOString(),
              recipients: {
                signers: [
                  {
                    email: "signer@example.com",
                    name: "John",
                    status: "completed",
                    signedDateTime: new Date().toISOString(),
                  },
                ],
              },
            }),
            { status: 200 },
          ),
        ),
      );

      const events = await client.getEnvelopeEvents("env-id");
      expect(events.length).toBeGreaterThan(0);
    });

    it("should parse webhook event", async () => {
      const payload = {
        event: "envelope-sent",
        data: {
          envelopeId: "webhook-env-id",
          status: "sent",
        },
      };

      const event = await client.parseWebhookEvent(payload, {
        "x-docusign-signature-1": "valid-signature",
      });

      expect(event.envelopeId).toBe("webhook-env-id");
      expect(event.source).toBe("docusign");
    });

    it("should verify webhook signature", () => {
      const payload = JSON.stringify({ test: "data" });
      const signature = "test-signature";

      const isValid = client.verifyWebhookSignature(payload, signature);
      // Without webhook secret, should return true
      expect(isValid).toBe(true);
    });
  });

  describe("health checks", () => {
    it("should perform health check", async () => {
      mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        )
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        );

      await client.initialize(mockConfig);
      const health = await client.healthCheck();

      expect(health).toHaveProperty("healthy");
      expect(health).toHaveProperty("message");
    });
  });

  describe("rate limiting and circuit breaker", () => {
    beforeEach(async () => {
      // initialize makes 3 fetch calls: refreshToken during verifyCredentials,
      // account check during verifyCredentials, and refreshToken at end
      mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        )
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: "token", expires_in: 3600 }),
          ),
        );
      await client.initialize(mockConfig);
    });

    it("should get rate limit status", async () => {
      const status = await client.getRateLimitStatus();
      expect(status).toHaveProperty("remaining");
      expect(status).toHaveProperty("resetAt");
      expect(typeof status.remaining).toBe("number");
    });

    it("should get circuit breaker status", async () => {
      const status = await client.getCircuitBreakerStatus();
      expect(status).toHaveProperty("state");
      expect(status).toHaveProperty("failureCount");
      expect(["closed", "open", "half_open"]).toContain(status.state);
    });
  });
});

/**
 * Helper function to create mock envelope for testing.
 */
function createMockEnvelope(): Envelope {
  const doc: Document = {
    id: "doc1",
    name: "Test Document",
    fileName: "test.pdf",
    content: Buffer.from("PDF content").toString("base64"),
    order: 1,
    mimeType: "application/pdf",
  };

  const signer: Signer = {
    email: "signer@example.com",
    name: "John Signer",
    order: 1,
    requiresSequentialSigning: false,
  };

  const field: SigningField = {
    id: "field1",
    type: "signature",
    pageNumber: 1,
    xCoordinate: 10,
    yCoordinate: 20,
    width: 100,
    height: 50,
    signerEmail: "signer@example.com",
    required: true,
  };

  return {
    id: "envelope1",
    name: "Test Envelope",
    status: "created",
    documents: [doc],
    signers: [signer],
    fields: [field],
    createdAt: new Date(),
    workflowMode: "sequential",
    createdBy: "test@example.com",
  };
}
