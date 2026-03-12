/**
 * PandaDoc E-Signature Adapter.
 *
 * Integrates with PandaDoc API v2
 * Supports:
 * - API key + OAuth2 authentication
 * - Document creation from template
 * - Document sending and recipient management
 * - Content library and pricing tables
 * - Approval workflows
 * - Webhook events for document status changes
 */

import { fetch } from "undici";

import { ESignatureAdapter } from "./esignature-adapter.js";
import type {
  Envelope,
  ESignatureConfig,
  ESignatureWebhookEvent,
  EnvelopeResult,
  EnvelopeStatusResult,
  DocumentDownloadResult,
  EmbedSigningResult,
  SigningEvent,
  Template,
  EnvelopeStatus,
} from "./types.js";

interface PandaDocRecipient {
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  signing_order?: number;
}

interface PandaDocDocument {
  template_uuid?: string;
  content_library_items?: Array<{
    id: string;
    text: string;
  }>;
  recipients?: PandaDocRecipient[];
  fields?: Array<{
    uuid: string;
    role?: string;
    value?: string;
  }>;
  metadata?: Record<string, string>;
  parse_form_fields?: boolean;
  version?: number;
}

/**
 * PandaDoc e-signature adapter.
 */
export class PandaDocClient extends ESignatureAdapter {
  private baseUrl: string = "";
  private apiKey: string = "";

  constructor() {
    super("PandaDoc");
  }

  async initialize(config: ESignatureConfig): Promise<void> {
    await super.initialize(config);

    if (!config.apiKey && !config.clientId) {
      throw new Error("PandaDoc: apiKey or clientId is required");
    }

    this.baseUrl = (config.apiUrl || "https://api.pandadoc.com").replace(/\/$/, "");

    if (config.apiKey) {
      this.apiKey = config.apiKey;
    } else if (config.authType === "oauth2") {
      await this.refreshToken();
    }
  }

  /**
   * Verify PandaDoc credentials.
   */
  async verifyCredentials(): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    try {
      const headers = this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/v1/documents?limit=1`, {
        method: "GET",
        headers,
      });

      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get authorization headers.
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `API-Key ${this.apiKey}`;
    } else if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    } else {
      throw new Error("PandaDoc: No authentication available");
    }

    return headers;
  }

  /**
   * Refresh OAuth2 token.
   */
  async refreshToken(): Promise<void> {
    if (!this.config?.clientId || !this.config?.clientSecret || !this.config?.refreshToken) {
      throw new Error("PandaDoc: OAuth2 requires clientId, clientSecret, and refreshToken");
    }

    const response = await fetch("https://api.pandadoc.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
      }).toString(),
    });

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.setAccessToken(data.access_token, data.expires_in);
  }

  /**
   * Create document.
   */
  async createEnvelope(envelope: Envelope): Promise<EnvelopeResult> {
    return this.rateLimitedRequest(async () => {
      const prepared = this.prepareEnvelope(envelope);
      const headers = this.getAuthHeaders();
      headers["Content-Type"] = "application/json";

      // For PandaDoc, we need to create from template or upload document
      // This example assumes using a template or document URL

      const recipients = prepared.signers.map((signer) => ({
        email: signer.email,
        first_name: signer.name.split(" ")[0],
        last_name: signer.name.split(" ").slice(1).join(" "),
        role: "Signer",
        signing_order: signer.order,
      }));

      const documentData: PandaDocDocument = {
        recipients,
        metadata: {
          subject: envelope.subject || "Document Signature",
          message: envelope.message || "",
        },
      };

      if (envelope.templateId) {
        documentData.template_uuid = envelope.templateId;
      }

      const response = await fetch(`${this.baseUrl}/v1/documents`, {
        method: "POST",
        headers,
        body: JSON.stringify(documentData),
      });

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to create document: ${response.statusText}`);
      }

      const data = (await response.json()) as { uuid: string };

      return {
        envelopeId: data.uuid,
        status: "created",
        createdAt: new Date(),
      };
    });
  }

  /**
   * Send document.
   */
  async sendEnvelope(envelopeId: string): Promise<EnvelopeResult> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();
      headers["Content-Type"] = "application/json";

      const response = await fetch(`${this.baseUrl}/v1/documents/${envelopeId}/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: "Please sign this document",
        }),
      });

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to send document: ${response.statusText}`);
      }

      return {
        envelopeId,
        status: "sent",
        createdAt: new Date(),
      };
    });
  }

  /**
   * Void document.
   */
  async voidEnvelope(envelopeId: string, reason?: string): Promise<void> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();
      headers["Content-Type"] = "application/json";

      const response = await fetch(`${this.baseUrl}/v1/documents/${envelopeId}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to void document: ${response.statusText}`);
      }
    });
  }

  /**
   * Get document details.
   */
  async getEnvelope(envelopeId: string): Promise<Envelope> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/v1/documents/${envelopeId}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to get document: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      const statusMap: Record<string, EnvelopeStatus> = {
        draft: "created",
        sent: "sent",
        viewed: "viewed",
        completed: "completed",
        archived: "completed",
        declined: "declined",
      };

      return {
        id: data.uuid,
        name: data.name || "Document",
        status: statusMap[data.status] || "created",
        documents: data.documents?.map((doc: any, i: number) => ({
          id: doc.uuid,
          name: doc.name,
          fileName: doc.name,
          content: "",
          order: i + 1,
          mimeType: "application/pdf",
        })) || [],
        signers: data.recipients?.map((r: any) => ({
          email: r.email,
          name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
          order: r.signing_order || 1,
          requiresSequentialSigning: true,
        })) || [],
        fields: [],
        createdAt: new Date(data.created_at),
        subject: data.name,
        message: data.metadata?.message,
        workflowMode: "sequential",
        createdBy: data.created_by || "unknown",
      };
    });
  }

  /**
   * Get document status.
   */
  async getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatusResult> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/v1/documents/${envelopeId}/details`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to get document status: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      const statusMap: Record<string, EnvelopeStatus> = {
        draft: "created",
        sent: "sent",
        viewed: "viewed",
        completed: "completed",
        declined: "declined",
      };

      const signerStatuses = (data.recipients || []).map((r: any) => ({
        email: r.email,
        name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
        status: statusMap[r.status] || ("sent" as EnvelopeStatus),
        signedAt: r.signed_at ? new Date(r.signed_at) : undefined,
        declinedAt: r.declined_at ? new Date(r.declined_at) : undefined,
      }));

      const completedSigners = signerStatuses.filter((s) => s.status === "completed").length;
      const totalSigners = signerStatuses.length;

      return {
        envelopeId,
        status: statusMap[data.status] || "created",
        signerStatuses,
        completionPercentage: totalSigners > 0 ? Math.round((completedSigners / totalSigners) * 100) : 0,
        lastUpdated: new Date(),
      };
    });
  }

  /**
   * List documents.
   */
  async listEnvelopes(options?: {
    status?: string;
    limit?: number;
    offset?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{ envelopes: Envelope[]; total: number }> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (options?.status) {
        params.append("status", options.status);
      }

      const response = await fetch(`${this.baseUrl}/v1/documents?${params}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to list documents: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      const statusMap: Record<string, EnvelopeStatus> = {
        draft: "created",
        sent: "sent",
        completed: "completed",
        declined: "declined",
      };

      const envelopes = (data.results || []).map((doc: any) => ({
        id: doc.uuid,
        name: doc.name || "Document",
        status: statusMap[doc.status] || "created",
        documents: [],
        signers: [],
        fields: [],
        createdAt: new Date(doc.created_at),
        workflowMode: "sequential" as const,
        createdBy: "unknown",
      }));

      return {
        envelopes,
        total: data.count || 0,
      };
    });
  }

  /**
   * Resend document.
   */
  async resendEnvelope(envelopeId: string, signerEmails?: string[]): Promise<void> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();
      headers["Content-Type"] = "application/json";

      const response = await fetch(`${this.baseUrl}/v1/documents/${envelopeId}/send_reminder`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          recipients: signerEmails || [],
        }),
      });

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to resend document: ${response.statusText}`);
      }
    });
  }

  /**
   * List templates.
   */
  async listTemplates(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ templates: Template[]; total: number }> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(`${this.baseUrl}/v1/templates?${params}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to list templates: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      const templates = (data.results || []).map((template: any) => ({
        id: template.uuid,
        name: template.name,
        description: template.description,
        createdAt: new Date(template.created_at),
        modifiedAt: new Date(template.updated_at),
        defaultSignerCount: 1,
      }));

      return {
        templates,
        total: data.count || 0,
      };
    });
  }

  /**
   * Get template details.
   */
  async getTemplate(templateId: string): Promise<Template> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/v1/templates/${templateId}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to get template: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      return {
        id: data.uuid,
        name: data.name,
        description: data.description,
        createdAt: new Date(data.created_at),
        modifiedAt: new Date(data.updated_at),
        defaultSignerCount: 1,
      };
    });
  }

  /**
   * Create document from template.
   */
  async createEnvelopeFromTemplate(
    templateId: string,
    envelope: Partial<Envelope>
  ): Promise<EnvelopeResult> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();
      headers["Content-Type"] = "application/json";

      const recipients = envelope.signers?.map((signer) => ({
        email: signer.email,
        first_name: signer.name.split(" ")[0],
        last_name: signer.name.split(" ").slice(1).join(" "),
        role: "Signer",
        signing_order: signer.order,
      })) || [];

      const request = {
        template_uuid: templateId,
        recipients,
        metadata: {
          subject: envelope.subject || "Document Signature",
          message: envelope.message || "",
        },
      };

      const response = await fetch(`${this.baseUrl}/v1/documents`, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to create document from template: ${response.statusText}`);
      }

      const data = (await response.json()) as { uuid: string };

      return {
        envelopeId: data.uuid,
        status: "created",
        createdAt: new Date(),
      };
    });
  }

  /**
   * Download document.
   */
  async downloadDocument(envelopeId: string, documentId: string): Promise<DocumentDownloadResult> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();

      const response = await fetch(
        `${this.baseUrl}/v1/documents/${envelopeId}/documents/${documentId}/download`,
        {
          method: "GET",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to download document: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const content = Buffer.from(buffer).toString("base64");

      return {
        documentId,
        fileName: `document_${documentId}.pdf`,
        mimeType: "application/pdf",
        content,
        fileSize: buffer.byteLength,
        downloadedAt: new Date(),
      };
    });
  }

  /**
   * Download all documents.
   */
  async downloadEnvelopeDocuments(
    envelopeId: string
  ): Promise<{ content: string; mimeType: string; fileName: string }> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/v1/documents/${envelopeId}/download`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to download documents: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const content = Buffer.from(buffer).toString("base64");

      return {
        content,
        mimeType: "application/pdf",
        fileName: `document_${envelopeId}.pdf`,
      };
    });
  }

  /**
   * Get embedded signing URL.
   */
  async getEmbeddedSigningUrl(
    envelopeId: string,
    signerEmail: string,
    returnUrl: string
  ): Promise<EmbedSigningResult> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();
      headers["Content-Type"] = "application/json";

      const response = await fetch(`${this.baseUrl}/v1/documents/${envelopeId}/shared_link`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          recipient_email: signerEmail,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to get signing URL: ${response.statusText}`);
      }

      const data = (await response.json()) as { url: string };

      return {
        signingUrl: data.url,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };
    });
  }

  /**
   * Mark document as viewed.
   */
  async markDocumentViewed(envelopeId: string, signerEmail: string): Promise<void> {
    // PandaDoc tracks viewing automatically
  }

  /**
   * Get document events.
   */
  async getEnvelopeEvents(envelopeId: string): Promise<SigningEvent[]> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/v1/documents/${envelopeId}/details`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`PandaDoc: Failed to get events: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const events: SigningEvent[] = [];

      const statusMap: Record<string, EnvelopeStatus> = {
        draft: "created",
        sent: "sent",
        viewed: "viewed",
        completed: "completed",
        declined: "declined",
      };

      events.push({
        id: `${envelopeId}_document`,
        envelopeId,
        type: "status_changed",
        previousStatus: "created",
        newStatus: statusMap[data.status] || "created",
        timestamp: new Date(data.updated_at),
      });

      (data.recipients || []).forEach((recipient: any) => {
        events.push({
          id: `${envelopeId}_${recipient.email}`,
          envelopeId,
          type: "status_changed",
          signerEmail: recipient.email,
          previousStatus: "sent",
          newStatus: statusMap[recipient.status] || "sent",
          timestamp: new Date(recipient.updated_at),
        });
      });

      return events;
    });
  }

  /**
   * Parse webhook event.
   */
  async parseWebhookEvent(
    payload: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<ESignatureWebhookEvent> {
    const isValid = this.verifyWebhookSignature(JSON.stringify(payload), headers["x-signature"] || "");

    const envelopeId = (payload as any).document?.uuid || "";
    const eventType = (payload as any).event_type || "unknown";

    const statusMap: Record<string, EnvelopeStatus> = {
      document_created: "created",
      document_sent: "sent",
      document_viewed: "viewed",
      document_completed: "completed",
      document_declined: "declined",
    };

    const signingEvent = {
      id: `${envelopeId}_${Date.now()}`,
      envelopeId,
      type: "status_changed" as const,
      previousStatus: ("created" as EnvelopeStatus),
      newStatus: statusMap[eventType] || ("created" as EnvelopeStatus),
      timestamp: new Date(),
    };

    return {
      source: "pandadoc",
      eventType,
      envelopeId,
      timestamp: new Date(),
      payload,
      headers,
      signingEvent,
      isValid,
    };
  }

  /**
   * Verify webhook signature.
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config?.webhookSecret) {
      return true;
    }

    const crypto = require("crypto");
    const hash = crypto
      .createHmac("sha256", this.config.webhookSecret)
      .update(payload)
      .digest("hex");

    return hash === signature;
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const verified = await this.verifyCredentials();
      return {
        healthy: verified,
        message: verified ? "PandaDoc connection is healthy" : "Failed to verify credentials",
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${(error as Error).message}`,
      };
    }
  }
}
