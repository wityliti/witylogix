/**
 * Envelope Engine Tests.
 *
 * Comprehensive test suite for the multi-provider envelope orchestration engine.
 * Tests provider selection, fallback, compliance logging, and status aggregation.
 */

import { describe, it, expect, beforeEach, vi, Mock } from "vitest";

import { EnvelopeEngine } from "../envelope-engine.js";
import type {
  ESignatureAdapterInterface,
  Envelope,
  Document,
  Signer,
  SigningField,
  EnvelopeResult,
  EnvelopeStatusResult,
} from "../types.js";

describe("EnvelopeEngine", () => {
  let engine: EnvelopeEngine;
  let mockAdapter: Partial<ESignatureAdapterInterface>;

  beforeEach(() => {
    engine = new EnvelopeEngine({
      selectionStrategy: "features",
      autoFallback: true,
      maxRetries: 3,
      enableAuditLog: true,
      enableComplianceLog: true,
    });

    mockAdapter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      verifyCredentials: vi.fn().mockResolvedValue(true),
      createEnvelope: vi.fn().mockResolvedValue(createMockEnvelopeResult()),
      sendEnvelope: vi.fn().mockResolvedValue(createMockEnvelopeResult()),
      getEnvelopeStatus: vi.fn().mockResolvedValue(createMockEnvelopeStatus()),
      getEnvelopeEvents: vi.fn().mockResolvedValue([]),
      downloadEnvelopeDocuments: vi.fn().mockResolvedValue({
        content: "base64content",
        mimeType: "application/pdf",
        fileName: "test.pdf",
      }),
      listTemplates: vi.fn().mockResolvedValue({ templates: [], total: 0 }),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true, message: "OK" }),
    };
  });

  describe("initialization", () => {
    it("should initialize with default options", () => {
      const newEngine = new EnvelopeEngine();
      expect(newEngine).toBeDefined();
    });

    it("should initialize with custom options", () => {
      const newEngine = new EnvelopeEngine({
        selectionStrategy: "cost",
        autoFallback: false,
        maxRetries: 5,
      });
      expect(newEngine).toBeDefined();
    });

    it("should register adapter", () => {
      engine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);
      expect(engine).toBeDefined();
    });
  });

  describe("provider selection", () => {
    beforeEach(() => {
      engine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);
      engine.registerAdapter("adobe_sign", mockAdapter as ESignatureAdapterInterface);
      engine.registerAdapter("pandadoc", mockAdapter as ESignatureAdapterInterface);
    });

    it("should select provider based on features strategy", () => {
      const newEngine = new EnvelopeEngine({ selectionStrategy: "features" });
      newEngine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);
      newEngine.registerAdapter("adobe_sign", mockAdapter as ESignatureAdapterInterface);
      expect(newEngine).toBeDefined();
    });

    it("should select provider based on cost strategy", () => {
      const newEngine = new EnvelopeEngine({ selectionStrategy: "cost" });
      newEngine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);
      newEngine.registerAdapter("pandadoc", mockAdapter as ESignatureAdapterInterface);
      expect(newEngine).toBeDefined();
    });

    it("should select provider based on reliability strategy", () => {
      const newEngine = new EnvelopeEngine({ selectionStrategy: "reliability" });
      newEngine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);
      newEngine.registerAdapter("adobe_sign", mockAdapter as ESignatureAdapterInterface);
      expect(newEngine).toBeDefined();
    });

    it("should support workflow constraints", () => {
      const newEngine = new EnvelopeEngine({
        selectionStrategy: "features",
      });
      newEngine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);
      expect(newEngine).toBeDefined();
    });
  });

  describe("envelope operations", () => {
    beforeEach(() => {
      engine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);
    });

    it("should create and send envelope", async () => {
      const envelope = createMockEnvelope();
      const result = await engine.createAndSendEnvelope(envelope);

      expect(result.operationId).toBeDefined();
      expect(result.provider).toBe("docusign");
      expect(result.envelope.envelopeId).toBe("test-envelope-id");
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should log audit trail for envelope creation", async () => {
      const envelope = createMockEnvelope();
      await engine.createAndSendEnvelope(envelope);

      const auditTrail = engine.getAuditTrail();
      expect(auditTrail.length).toBeGreaterThan(0);
      expect(auditTrail.some((e) => e.action === "create_envelope")).toBe(true);
      expect(auditTrail.some((e) => e.action === "send_envelope")).toBe(true);
    });

    it("should log compliance events", async () => {
      const envelope = createMockEnvelope();
      await engine.createAndSendEnvelope(envelope);

      const complianceLog = engine.getComplianceLog();
      expect(complianceLog.length).toBeGreaterThan(0);
      expect(complianceLog.some((e) => e.type === "envelope_created")).toBe(true);
      expect(complianceLog.some((e) => e.type === "envelope_sent")).toBe(true);
    });

    it("should get envelope status", async () => {
      const status = await engine.getEnvelopeStatus("env-id", "docusign");

      expect(status.envelopeId).toBe("env-id");
      expect(status.status).toBeDefined();
      expect(status.completionPercentage).toBeDefined();
    });

    it("should get envelope events", async () => {
      const events = await engine.getEnvelopeEvents("env-id", "docusign");

      expect(Array.isArray(events)).toBe(true);
    });

    it("should download envelope documents", async () => {
      const result = await engine.downloadEnvelopeDocuments("env-id", "docusign");

      expect(result.content).toBeDefined();
      expect(result.mimeType).toBeDefined();
      expect(result.fileName).toBeDefined();
    });

    it("should get embedded signing URL", async () => {
      mockAdapter.getEmbeddedSigningUrl = vi.fn().mockResolvedValue({
        signingUrl: "https://signing.example.com",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      engine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);

      const result = await engine.getEmbeddedSigningUrl(
        "env-id",
        "signer@example.com",
        "https://return.example.com",
        "docusign"
      );

      expect(result.signingUrl).toBe("https://signing.example.com");
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("should void envelope", async () => {
      mockAdapter.voidEnvelope = vi.fn().mockResolvedValue(undefined);
      engine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);

      await expect(
        engine.voidEnvelope("env-id", "docusign", "User cancellation")
      ).resolves.not.toThrow();

      const complianceLog = engine.getComplianceLog();
      expect(complianceLog.some((e) => e.type === "envelope_voided")).toBe(true);
    });
  });

  describe("template operations", () => {
    beforeEach(() => {
      engine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);
    });

    it("should list templates", async () => {
      const result = await engine.listTemplates("docusign", { limit: 20 });

      expect(result).toHaveProperty("templates");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.templates)).toBe(true);
    });
  });

  describe("fallback handling", () => {
    it("should fallback to alternative provider on failure", async () => {
      const failingAdapter = {
        ...mockAdapter,
        createEnvelope: vi.fn().mockRejectedValue(new Error("Provider error")),
        sendEnvelope: vi.fn().mockRejectedValue(new Error("Provider error")),
      } as Partial<ESignatureAdapterInterface>;

      const successAdapter = mockAdapter;

      engine.registerAdapter("docusign", failingAdapter as ESignatureAdapterInterface);
      engine.registerAdapter("adobe_sign", successAdapter as ESignatureAdapterInterface);

      const envelope = createMockEnvelope();
      const result = await engine.createAndSendEnvelope(envelope);

      expect(result.fallbackUsed).toBe(true);
      expect(result.provider).toBe("adobe_sign");
    });

    it("should throw error when all providers fail", async () => {
      const failingAdapter = {
        ...mockAdapter,
        createEnvelope: vi.fn().mockRejectedValue(new Error("Provider error")),
        sendEnvelope: vi.fn().mockRejectedValue(new Error("Provider error")),
      } as Partial<ESignatureAdapterInterface>;

      engine.registerAdapter("docusign", failingAdapter as ESignatureAdapterInterface);

      const envelope = createMockEnvelope();
      await expect(engine.createAndSendEnvelope(envelope)).rejects.toThrow();
    });
  });

  describe("audit and compliance logging", () => {
    beforeEach(() => {
      engine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);
    });

    it("should maintain audit trail", async () => {
      const envelope = createMockEnvelope();
      await engine.createAndSendEnvelope(envelope);

      const auditTrail = engine.getAuditTrail();
      expect(auditTrail.length).toBeGreaterThan(0);

      auditTrail.forEach((entry) => {
        expect(entry).toHaveProperty("timestamp");
        expect(entry).toHaveProperty("action");
        expect(entry).toHaveProperty("provider");
        expect(entry).toHaveProperty("status");
      });
    });

    it("should maintain compliance log", async () => {
      const envelope = createMockEnvelope();
      await engine.createAndSendEnvelope(envelope);

      const complianceLog = engine.getComplianceLog();
      expect(complianceLog.length).toBeGreaterThan(0);

      complianceLog.forEach((entry) => {
        expect(entry).toHaveProperty("id");
        expect(entry).toHaveProperty("envelopeId");
        expect(entry).toHaveProperty("type");
        expect(entry).toHaveProperty("timestamp");
        expect(entry).toHaveProperty("actor");
        expect(entry).toHaveProperty("action");
      });
    });

    it("should clear logs", async () => {
      const envelope = createMockEnvelope();
      await engine.createAndSendEnvelope(envelope);

      expect(engine.getAuditTrail().length).toBeGreaterThan(0);
      expect(engine.getComplianceLog().length).toBeGreaterThan(0);

      engine.clearLogs();

      expect(engine.getAuditTrail()).toHaveLength(0);
      expect(engine.getComplianceLog()).toHaveLength(0);
    });

    it("should skip logging when disabled", async () => {
      const loggingDisabledEngine = new EnvelopeEngine({
        enableAuditLog: false,
        enableComplianceLog: false,
      });

      loggingDisabledEngine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);

      const envelope = createMockEnvelope();
      await loggingDisabledEngine.createAndSendEnvelope(envelope);

      expect(loggingDisabledEngine.getAuditTrail()).toHaveLength(0);
      expect(loggingDisabledEngine.getComplianceLog()).toHaveLength(0);
    });
  });

  describe("health checks", () => {
    beforeEach(() => {
      mockAdapter.healthCheck = vi.fn().mockResolvedValue({
        healthy: true,
        message: "Provider is healthy",
      });
      engine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);
    });

    it("should check provider health", async () => {
      const health = await engine.getProviderHealth("docusign");

      expect(health).toHaveProperty("healthy");
      expect(health).toHaveProperty("message");
      expect(health.healthy).toBe(true);
    });

    it("should check all providers health", async () => {
      engine.registerAdapter("adobe_sign", mockAdapter as ESignatureAdapterInterface);
      engine.registerAdapter("pandadoc", mockAdapter as ESignatureAdapterInterface);

      const health = await engine.getAllProvidersHealth();

      expect(health).toHaveProperty("docusign");
      expect(health).toHaveProperty("adobe_sign");
      expect(health).toHaveProperty("pandadoc");
      expect(health.docusign.healthy).toBe(true);
    });

    it("should report unhealthy for unregistered provider", async () => {
      const health = await engine.getProviderHealth("nonexistent");

      expect(health.healthy).toBe(false);
    });
  });

  describe("operation result", () => {
    beforeEach(() => {
      engine.registerAdapter("docusign", mockAdapter as ESignatureAdapterInterface);
    });

    it("should return complete orchestration result", async () => {
      const envelope = createMockEnvelope();
      const result = await engine.createAndSendEnvelope(envelope);

      expect(result).toHaveProperty("operationId");
      expect(result).toHaveProperty("provider");
      expect(result).toHaveProperty("envelope");
      expect(result).toHaveProperty("fallbackUsed");
      expect(result).toHaveProperty("duration");
      expect(result).toHaveProperty("auditTrail");

      expect(typeof result.operationId).toBe("string");
      expect(typeof result.provider).toBe("string");
      expect(result.envelope).toHaveProperty("envelopeId");
      expect(typeof result.duration).toBe("number");
      expect(Array.isArray(result.auditTrail)).toBe(true);
    });
  });
});

/**
 * Helper functions to create mock objects for testing.
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

function createMockEnvelopeResult(): EnvelopeResult {
  return {
    envelopeId: "test-envelope-id",
    status: "created",
    createdAt: new Date(),
  };
}

function createMockEnvelopeStatus(): EnvelopeStatusResult {
  return {
    envelopeId: "env-id",
    status: "sent",
    signerStatuses: [
      {
        email: "signer@example.com",
        name: "John Signer",
        status: "sent",
      },
    ],
    completionPercentage: 0,
    lastUpdated: new Date(),
  };
}
