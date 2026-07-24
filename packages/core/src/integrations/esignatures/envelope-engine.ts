/**
 * Envelope Engine — Multi-Provider E-Signature Orchestration.
 *
 * Orchestrates document signing across multiple e-signature providers:
 * - DocuSign
 * - Adobe Sign
 * - PandaDoc
 * - HelloSign (Dropbox Sign)
 *
 * Features:
 * - Provider selection based on features, cost, reliability
 * - Automatic fallback on provider failure
 * - Signing workflow management (sequential, parallel, hybrid)
 * - Status aggregation across providers
 * - Audit trail generation
 * - Compliance logging
 */

import type {
  Envelope,
  ESignatureConfig,
  ESignatureAdapterInterface,
  EnvelopeResult,
  EnvelopeStatusResult,
  DocumentDownloadResult,
  EmbedSigningResult,
  SigningEvent,
  Template,
  ComplianceEvent,
  EnvelopeEngineOptions,
  OrchestrationResult,
  ProviderSelectionStrategy,
} from "./types.js";

import { DocuSignClient } from "./docusign-client.js";
import { AdobeSignClient } from "./adobe-sign-client.js";
import { PandaDocClient } from "./pandadoc-client.js";
import { HelloSignClient } from "./hellosign-client.js";

/**
 * Provider metadata for selection strategy.
 */
interface ProviderMetadata {
  name: "docusign" | "adobe_sign" | "pandadoc" | "hellosign";
  costPerMonth: number;
  reliabilityScore: number; // 0-100
  signatureSpeed: number; // seconds to complete signature
  supportedWorkflows: Array<"sequential" | "parallel" | "hybrid">;
  availableCount: number; // approximate monthly envelope count
}

const PROVIDER_METADATA: Record<string, ProviderMetadata> = {
  docusign: {
    name: "docusign",
    costPerMonth: 150,
    reliabilityScore: 98,
    signatureSpeed: 120,
    supportedWorkflows: ["sequential", "parallel", "hybrid"],
    availableCount: 500,
  },
  adobe_sign: {
    name: "adobe_sign",
    costPerMonth: 160,
    reliabilityScore: 97,
    signatureSpeed: 90,
    supportedWorkflows: ["sequential", "parallel"],
    availableCount: 400,
  },
  pandadoc: {
    name: "pandadoc",
    costPerMonth: 99,
    reliabilityScore: 95,
    signatureSpeed: 150,
    supportedWorkflows: ["sequential", "parallel"],
    availableCount: 300,
  },
  hellosign: {
    name: "hellosign",
    costPerMonth: 120,
    reliabilityScore: 94,
    signatureSpeed: 180,
    supportedWorkflows: ["parallel"],
    availableCount: 250,
  },
};

/**
 * Envelope engine for multi-provider orchestration.
 */
export class EnvelopeEngine {
  private adapters: Map<string, ESignatureAdapterInterface> = new Map();
  private options: EnvelopeEngineOptions;
  private auditTrail: Array<{
    timestamp: Date;
    action: string;
    provider: string;
    status: "success" | "failure";
    details?: Record<string, unknown>;
  }> = [];
  private complianceLog: ComplianceEvent[] = [];

  constructor(options: EnvelopeEngineOptions = {}) {
    this.options = {
      selectionStrategy: "features",
      autoFallback: true,
      maxRetries: 3,
      requestTimeout: 30000,
      enableAuditLog: true,
      enableComplianceLog: true,
      preferredProviders: ["docusign", "adobe_sign", "pandadoc", "hellosign"],
      ...options,
    };
  }

  /**
   * Register provider adapter.
   */
  registerAdapter(name: string, adapter: ESignatureAdapterInterface): void {
    this.adapters.set(name, adapter);
  }

  /**
   * Initialize adapter with configuration.
   */
  async initializeAdapter(
    name: string,
    config: ESignatureConfig,
  ): Promise<void> {
    let adapter: ESignatureAdapterInterface;

    switch (name) {
      case "docusign":
        adapter = new DocuSignClient();
        break;
      case "adobe_sign":
        adapter = new AdobeSignClient();
        break;
      case "pandadoc":
        adapter = new PandaDocClient();
        break;
      case "hellosign":
        adapter = new HelloSignClient();
        break;
      default:
        throw new Error(`Unknown provider: ${name}`);
    }

    await adapter.initialize(config);
    this.adapters.set(name, adapter);
  }

  /**
   * Select best provider based on strategy.
   */
  private selectProvider(
    strategy: ProviderSelectionStrategy,
    workflow: string,
  ): string | null {
    const availableProviders = (this.options.preferredProviders || [])
      .filter((p) => this.adapters.has(p) && this.adapters.get(p))
      .filter((p) => {
        const meta = PROVIDER_METADATA[p];
        return meta && meta.supportedWorkflows.includes(workflow as any);
      });

    if (availableProviders.length === 0) {
      return null;
    }

    switch (strategy) {
      case "cost":
        return availableProviders.reduce((best, current) => {
          const bestCost = PROVIDER_METADATA[best]?.costPerMonth || Infinity;
          const currentCost =
            PROVIDER_METADATA[current]?.costPerMonth || Infinity;
          return currentCost < bestCost ? current : best;
        });

      case "reliability":
        return availableProviders.reduce((best, current) => {
          const bestScore = PROVIDER_METADATA[best]?.reliabilityScore || 0;
          const currentScore =
            PROVIDER_METADATA[current]?.reliabilityScore || 0;
          return currentScore > bestScore ? current : best;
        });

      case "speed":
        return availableProviders.reduce((best, current) => {
          const bestSpeed = PROVIDER_METADATA[best]?.signatureSpeed || Infinity;
          const currentSpeed =
            PROVIDER_METADATA[current]?.signatureSpeed || Infinity;
          return currentSpeed < bestSpeed ? current : best;
        });

      case "features":
      default:
        // Return first available provider
        return availableProviders[0] || null;
    }
  }

  /**
   * Log audit event.
   */
  private logAudit(
    action: string,
    provider: string,
    status: "success" | "failure",
    details?: Record<string, unknown>,
  ): void {
    if (!this.options.enableAuditLog) {
      return;
    }

    this.auditTrail.push({
      timestamp: new Date(),
      action,
      provider,
      status,
      details,
    });
  }

  /**
   * Log compliance event.
   */
  private logCompliance(event: Omit<ComplianceEvent, "id">): void {
    if (!this.options.enableComplianceLog) {
      return;
    }

    this.complianceLog.push({
      ...event,
      id: `compliance_${Date.now()}_${Math.random()}`,
    });
  }

  /**
   * Create and send envelope.
   */
  async createAndSendEnvelope(
    envelope: Envelope,
  ): Promise<OrchestrationResult> {
    const operationId = `op_${Date.now()}_${Math.random()}`;
    const startTime = Date.now();

    // Select provider
    const selectedProvider = this.selectProvider(
      this.options.selectionStrategy || "features",
      envelope.workflowMode,
    );

    if (!selectedProvider) {
      throw new Error("No compatible provider available for envelope");
    }

    const adapter = this.adapters.get(selectedProvider);
    if (!adapter) {
      throw new Error(`Provider ${selectedProvider} not initialized`);
    }

    // Log compliance event
    this.logCompliance({
      envelopeId: envelope.id,
      type: "envelope_created",
      timestamp: new Date(),
      actor: envelope.createdBy || "system",
      action: `Envelope created with ${selectedProvider}`,
    });

    let result: EnvelopeResult | null = null;
    let fallbackUsed = false;
    const providers = [
      selectedProvider,
      ...this.getProviderFallbacks(selectedProvider),
    ];

    for (const provider of providers) {
      try {
        const currentAdapter = this.adapters.get(provider);
        if (!currentAdapter) {
          continue;
        }

        // Create envelope
        result = await currentAdapter.createEnvelope(envelope);
        this.logAudit("create_envelope", provider, "success", {
          envelopeId: result.envelopeId,
        });

        // Send envelope
        const sendResult = await currentAdapter.sendEnvelope(result.envelopeId);
        this.logAudit("send_envelope", provider, "success", {
          envelopeId: result.envelopeId,
        });

        // Log compliance
        envelope.signers.forEach((signer) => {
          this.logCompliance({
            envelopeId: result!.envelopeId,
            signerEmail: signer.email,
            type: "envelope_sent",
            timestamp: new Date(),
            actor: envelope.createdBy || "system",
            action: `Envelope sent to ${signer.email}`,
          });
        });

        return {
          operationId,
          provider,
          envelope: sendResult,
          fallbackUsed: fallbackUsed && provider !== selectedProvider,
          duration: Date.now() - startTime,
          auditTrail: this.auditTrail,
        };
      } catch (error) {
        this.logAudit("create_envelope", provider, "failure", {
          error: String(error),
        });

        if (
          !this.options.autoFallback ||
          provider === providers[providers.length - 1]
        ) {
          throw error;
        }

        fallbackUsed = true;
      }
    }

    throw new Error("All providers failed to create envelope");
  }

  /**
   * Get envelope status across provider.
   */
  async getEnvelopeStatus(
    envelopeId: string,
    provider: string,
  ): Promise<EnvelopeStatusResult> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    try {
      const status = await adapter.getEnvelopeStatus(envelopeId);
      this.logAudit("get_status", provider, "success", { envelopeId });
      return status;
    } catch (error) {
      this.logAudit("get_status", provider, "failure", {
        error: String(error),
        envelopeId,
      });
      throw error;
    }
  }

  /**
   * Get envelope events.
   */
  async getEnvelopeEvents(
    envelopeId: string,
    provider: string,
  ): Promise<SigningEvent[]> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    try {
      const events = await adapter.getEnvelopeEvents(envelopeId);
      this.logAudit("get_events", provider, "success", {
        envelopeId,
        eventCount: events.length,
      });
      return events;
    } catch (error) {
      this.logAudit("get_events", provider, "failure", {
        error: String(error),
        envelopeId,
      });
      throw error;
    }
  }

  /**
   * Download envelope documents.
   */
  async downloadEnvelopeDocuments(
    envelopeId: string,
    provider: string,
  ): Promise<{ content: string; mimeType: string; fileName: string }> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    try {
      const result = await adapter.downloadEnvelopeDocuments(envelopeId);
      this.logAudit("download_documents", provider, "success", { envelopeId });

      this.logCompliance({
        envelopeId,
        type: "envelope_created",
        timestamp: new Date(),
        actor: "system",
        action: `Documents downloaded for envelope ${envelopeId}`,
      });

      return result;
    } catch (error) {
      this.logAudit("download_documents", provider, "failure", {
        error: String(error),
        envelopeId,
      });
      throw error;
    }
  }

  /**
   * Get embedded signing URL.
   */
  async getEmbeddedSigningUrl(
    envelopeId: string,
    signerEmail: string,
    returnUrl: string,
    provider: string,
  ): Promise<EmbedSigningResult> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    try {
      const result = await adapter.getEmbeddedSigningUrl(
        envelopeId,
        signerEmail,
        returnUrl,
      );
      this.logAudit("get_signing_url", provider, "success", {
        envelopeId,
        signerEmail,
      });
      return result;
    } catch (error) {
      this.logAudit("get_signing_url", provider, "failure", {
        error: String(error),
        envelopeId,
        signerEmail,
      });
      throw error;
    }
  }

  /**
   * Void envelope.
   */
  async voidEnvelope(
    envelopeId: string,
    provider: string,
    reason?: string,
  ): Promise<void> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    try {
      await adapter.voidEnvelope(envelopeId, reason);
      this.logAudit("void_envelope", provider, "success", {
        envelopeId,
        reason,
      });

      this.logCompliance({
        envelopeId,
        type: "envelope_voided",
        timestamp: new Date(),
        actor: "system",
        action: `Envelope voided: ${reason || "No reason provided"}`,
      });
    } catch (error) {
      this.logAudit("void_envelope", provider, "failure", {
        error: String(error),
        envelopeId,
      });
      throw error;
    }
  }

  /**
   * List templates.
   */
  async listTemplates(
    provider: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ templates: Template[]; total: number }> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    try {
      const result = await adapter.listTemplates(options);
      this.logAudit("list_templates", provider, "success", {
        templateCount: result.templates.length,
      });
      return result;
    } catch (error) {
      this.logAudit("list_templates", provider, "failure", {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get provider fallbacks.
   */
  private getProviderFallbacks(primary: string): string[] {
    const all = this.options.preferredProviders || [
      "docusign",
      "adobe_sign",
      "pandadoc",
      "hellosign",
    ];
    return all.filter((p) => p !== primary && this.adapters.has(p));
  }

  /**
   * Get audit trail.
   */
  getAuditTrail(): Array<{
    timestamp: Date;
    action: string;
    provider: string;
    status: "success" | "failure";
    details?: Record<string, unknown>;
  }> {
    return [...this.auditTrail];
  }

  /**
   * Get compliance log.
   */
  getComplianceLog(): ComplianceEvent[] {
    return [...this.complianceLog];
  }

  /**
   * Clear logs.
   */
  clearLogs(): void {
    this.auditTrail = [];
    this.complianceLog = [];
  }

  /**
   * Get provider health.
   */
  async getProviderHealth(
    provider: string,
  ): Promise<{ healthy: boolean; message: string }> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      return {
        healthy: false,
        message: `Provider ${provider} not initialized`,
      };
    }

    try {
      return await adapter.healthCheck();
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get all providers health.
   */
  async getAllProvidersHealth(): Promise<
    Record<string, { healthy: boolean; message: string }>
  > {
    const results: Record<string, { healthy: boolean; message: string }> = {};

    for (const [name] of this.adapters) {
      results[name] = await this.getProviderHealth(name);
    }

    return results;
  }
}
