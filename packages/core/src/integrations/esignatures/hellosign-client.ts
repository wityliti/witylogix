/**
 * HelloSign (Dropbox Sign) E-Signature Adapter.
 *
 * Integrates with Dropbox Sign (HelloSign) API v3
 * Supports:
 * - API key + OAuth2 authentication
 * - Signature requests (create, send, cancel, remind)
 * - Templates and template management
 * - Embedded signing for web integration
 * - Team management and bulk operations
 * - Event callbacks for request status
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

interface HelloSignSigner {
  email_address: string;
  name: string;
  order?: number;
  sms_phone_number?: string;
}

interface HelloSignSignatureRequest {
  file_url?: string;
  files?: string[];
  title?: string;
  subject?: string;
  message?: string;
  signers: HelloSignSigner[];
  cc_email_addresses?: string[];
  metadata?: Record<string, string>;
}

/**
 * HelloSign (Dropbox Sign) e-signature adapter.
 */
export class HelloSignClient extends ESignatureAdapter {
  private baseUrl: string = "";
  private apiKey: string = "";

  constructor() {
    super("HelloSign");
  }

  async initialize(config: ESignatureConfig): Promise<void> {
    await super.initialize(config);

    if (!config.apiKey && !config.clientId) {
      throw new Error("HelloSign: apiKey or clientId is required");
    }

    this.baseUrl = (config.apiUrl || "https://api.hellosign.com").replace(/\/$/, "");

    if (config.apiKey) {
      this.apiKey = config.apiKey;
    } else if (config.authType === "oauth2") {
      await this.refreshToken();
    }
  }

  /**
   * Verify HelloSign credentials.
   */
  async verifyCredentials(): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/v3/signature_requests/list?limit=1`, {
        method: "GET",
        headers: this.getAuthHeaders(),
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
      const auth = Buffer.from(`${this.apiKey}:`).toString("base64");
      headers.Authorization = `Basic ${auth}`;
    } else if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    } else {
      throw new Error("HelloSign: No authentication available");
    }

    return headers;
  }

  /**
   * Refresh OAuth2 token.
   */
  async refreshToken(): Promise<void> {
    if (!this.config?.clientId || !this.config?.clientSecret || !this.config?.refreshToken) {
      throw new Error("HelloSign: OAuth2 requires clientId, clientSecret, and refreshToken");
    }

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
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
   * Create signature request.
   */
  async createEnvelope(envelope: Envelope): Promise<EnvelopeResult> {
    return this.rateLimitedRequest(async () => {
      const prepared = this.prepareEnvelope(envelope);
      const headers = this.getAuthHeaders();

      // HelloSign uses form data for document uploads
      const formData = new FormData();

      // Add documents
      prepared.documents.forEach((doc, index) => {
        const buffer = Buffer.from(doc.content, "base64");
        const blob = new Blob([buffer], { type: doc.mimeType });
        formData.append(`files[${index}]`, blob, doc.fileName);
      });

      // Add signers
      prepared.signers.forEach((signer, index) => {
        formData.append(`signers[${index}][email_address]`, signer.email);
        formData.append(`signers[${index}][name]`, signer.name);
        if (signer.order) {
          formData.append(`signers[${index}][order]`, signer.order.toString());
        }
      });

      // Add metadata
      formData.append("title", envelope.subject || "Document Signature Request");
      if (envelope.message) {
        formData.append("message", envelope.message);
      }

      if (envelope.metadata) {
        Object.entries(envelope.metadata).forEach(([key, value]) => {
          formData.append(`metadata[${key}]`, String(value));
        });
      }

      const response = await fetch(`${this.baseUrl}/v3/signature_requests/send`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HelloSign: Failed to create request: ${response.statusText}`);
      }

      const data = (await response.json()) as { signature_request: { signature_request_id: string } };

      return {
        envelopeId: data.signature_request.signature_request_id,
        status: "sent",
        createdAt: new Date(),
      };
    });
  }

  /**
   * Send signature request (already sent on creation in HelloSign).
   */
  async sendEnvelope(envelopeId: string): Promise<EnvelopeResult> {
    return this.rateLimitedRequest(async () => {
      // In HelloSign, requests are sent on creation
      // This method is here for interface compatibility
      const envelope = await this.getEnvelope(envelopeId);
      return {
        envelopeId,
        status: envelope.status,
        createdAt: envelope.createdAt,
      };
    });
  }

  /**
   * Cancel signature request.
   */
  async voidEnvelope(envelopeId: string, reason?: string): Promise<void> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();
      headers["Content-Type"] = "application/x-www-form-urlencoded";

      const response = await fetch(`${this.baseUrl}/v3/signature_requests/cancel/${envelopeId}`, {
        method: "POST",
        headers,
        body: new URLSearchParams({
          email_address: this.config?.accountId || "support@example.com",
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`HelloSign: Failed to cancel request: ${response.statusText}`);
      }
    });
  }

  /**
   * Get signature request details.
   */
  async getEnvelope(envelopeId: string): Promise<Envelope> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/v3/signature_requests/${envelopeId}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HelloSign: Failed to get request: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const req = data.signature_request;

      const statusMap: Record<string, EnvelopeStatus> = {
        draft: "created",
        sent: "sent",
        viewed: "viewed",
        signed: "signed",
        completed: "completed",
        declined: "declined",
        canceled: "voided",
      };

      return {
        id: req.signature_request_id,
        name: req.title || "Document",
        status: statusMap[req.is_complete ? "completed" : req.status] || "sent",
        documents: req.files?.map((file: any, i: number) => ({
          id: file.file_id,
          name: file.file_name,
          fileName: file.file_name,
          content: "",
          order: i + 1,
          mimeType: "application/pdf",
        })) || [],
        signers: req.signatures?.map((sig: any) => ({
          email: sig.signer_email_address,
          name: sig.signer_name || sig.signer_email_address,
          order: 1,
          requiresSequentialSigning: false,
        })) || [],
        fields: [],
        createdAt: new Date(req.created_at * 1000),
        subject: req.title,
        message: req.message,
        workflowMode: "parallel",
        createdBy: req.requester_email_address || "unknown",
      };
    });
  }

  /**
   * Get signature request status.
   */
  async getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatusResult> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/v3/signature_requests/${envelopeId}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HelloSign: Failed to get request status: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const req = data.signature_request;

      const statusMap: Record<string, EnvelopeStatus> = {
        unsigned: "sent",
        signed: "signed",
        viewed: "viewed",
      };

      const signerStatuses = req.signatures?.map((sig: any) => ({
        email: sig.signer_email_address,
        name: sig.signer_name || sig.signer_email_address,
        status: statusMap[sig.status_code] || ("sent" as EnvelopeStatus),
        signedAt: sig.signed_at ? new Date(sig.signed_at * 1000) : undefined,
      })) || [];

      const completedSigners = signerStatuses.filter((s) => s.status === "signed").length;
      const totalSigners = signerStatuses.length;

      return {
        envelopeId,
        status: req.is_complete ? "completed" : "sent",
        signerStatuses,
        completionPercentage: totalSigners > 0 ? Math.round((completedSigners / totalSigners) * 100) : 0,
        lastUpdated: new Date(),
      };
    });
  }

  /**
   * List signature requests.
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
        limit: Math.min(limit, 100).toString(),
        page: ((offset / limit) + 1).toString(),
      });

      const response = await fetch(`${this.baseUrl}/v3/signature_requests/list?${params}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HelloSign: Failed to list requests: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      const statusMap: Record<string, EnvelopeStatus> = {
        draft: "created",
        sent: "sent",
        completed: "completed",
        declined: "declined",
      };

      const envelopes = (data.signature_requests || []).map((req: any) => ({
        id: req.signature_request_id,
        name: req.title || "Document",
        status: statusMap[req.is_complete ? "completed" : "sent"] || "sent",
        documents: [],
        signers: [],
        fields: [],
        createdAt: new Date(req.created_at * 1000),
        workflowMode: "parallel" as const,
        createdBy: "unknown",
      }));

      return {
        envelopes,
        total: data.list_info?.total_count || 0,
      };
    });
  }

  /**
   * Remind signers.
   */
  async resendEnvelope(envelopeId: string, signerEmails?: string[]): Promise<void> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();
      headers["Content-Type"] = "application/x-www-form-urlencoded";

      const response = await fetch(`${this.baseUrl}/v3/signature_requests/remind/${envelopeId}`, {
        method: "POST",
        headers,
        body: new URLSearchParams({
          email_address: signerEmails?.[0] || this.config?.accountId || "support@example.com",
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`HelloSign: Failed to remind signers: ${response.statusText}`);
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

      const params = new URLSearchParams({
        limit: limit.toString(),
        page: ((options?.offset || 0) / limit + 1).toString(),
      });

      const response = await fetch(`${this.baseUrl}/v3/template_list?${params}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HelloSign: Failed to list templates: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      const templates = (data.templates || []).map((template: any) => ({
        id: template.template_id,
        name: template.title,
        description: template.message,
        createdAt: new Date(template.created_at * 1000),
        modifiedAt: new Date(template.updated_at * 1000),
        defaultSignerCount: template.signer_roles?.length || 1,
      }));

      return {
        templates,
        total: data.list_info?.total_count || 0,
      };
    });
  }

  /**
   * Get template details.
   */
  async getTemplate(templateId: string): Promise<Template> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/v3/template/${templateId}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HelloSign: Failed to get template: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const template = data.template;

      return {
        id: template.template_id,
        name: template.title,
        description: template.message,
        createdAt: new Date(template.created_at * 1000),
        modifiedAt: new Date(template.updated_at * 1000),
        defaultSignerCount: template.signer_roles?.length || 1,
      };
    });
  }

  /**
   * Create signature request from template.
   */
  async createEnvelopeFromTemplate(
    templateId: string,
    envelope: Partial<Envelope>
  ): Promise<EnvelopeResult> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();
      headers["Content-Type"] = "application/x-www-form-urlencoded";

      const body = new URLSearchParams({
        template_id: templateId,
        title: envelope.subject || "Document Signature Request",
      });

      if (envelope.message) {
        body.append("message", envelope.message);
      }

      envelope.signers?.forEach((signer, index) => {
        body.append(`signers[${signer.name}][email_address]`, signer.email);
        body.append(`signers[${signer.name}][name]`, signer.name);
      });

      const response = await fetch(`${this.baseUrl}/v3/signature_requests/send_with_template`, {
        method: "POST",
        headers,
        body: body.toString(),
      });

      if (!response.ok) {
        throw new Error(`HelloSign: Failed to create request from template: ${response.statusText}`);
      }

      const data = (await response.json()) as { signature_request: { signature_request_id: string } };

      return {
        envelopeId: data.signature_request.signature_request_id,
        status: "sent",
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
        `${this.baseUrl}/v3/signature_requests/${envelopeId}/files/${documentId}`,
        {
          method: "GET",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HelloSign: Failed to download document: ${response.statusText}`);
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

      const response = await fetch(`${this.baseUrl}/v3/signature_requests/${envelopeId}/files/zip`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HelloSign: Failed to download documents: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const content = Buffer.from(buffer).toString("base64");

      return {
        content,
        mimeType: "application/zip",
        fileName: `request_${envelopeId}.zip`,
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

      const response = await fetch(
        `${this.baseUrl}/v3/signature_requests/${envelopeId}/embedded_sign_init/${signerEmail}`,
        {
          method: "GET",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HelloSign: Failed to get signing URL: ${response.statusText}`);
      }

      const data = (await response.json()) as { embedded: { sign_url: string } };

      return {
        signingUrl: data.embedded.sign_url,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };
    });
  }

  /**
   * Mark document as viewed.
   */
  async markDocumentViewed(envelopeId: string, signerEmail: string): Promise<void> {
    // HelloSign tracks viewing automatically
  }

  /**
   * Get signature request events.
   */
  async getEnvelopeEvents(envelopeId: string): Promise<SigningEvent[]> {
    return this.rateLimitedRequest(async () => {
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/v3/signature_requests/${envelopeId}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HelloSign: Failed to get events: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const req = data.signature_request;
      const events: SigningEvent[] = [];

      const statusMap: Record<string, EnvelopeStatus> = {
        unsigned: "sent",
        signed: "signed",
        viewed: "viewed",
      };

      events.push({
        id: `${envelopeId}_request`,
        envelopeId,
        type: "status_changed",
        previousStatus: "created",
        newStatus: req.is_complete ? "completed" : "sent",
        timestamp: new Date(req.created_at * 1000),
      });

      req.signatures?.forEach((sig: any) => {
        events.push({
          id: `${envelopeId}_${sig.signer_email_address}`,
          envelopeId,
          type: "status_changed",
          signerEmail: sig.signer_email_address,
          previousStatus: "sent",
          newStatus: statusMap[sig.status_code] || "sent",
          timestamp: new Date(sig.signed_at ? sig.signed_at * 1000 : Date.now()),
          signatureDetails: sig.signed_at
            ? { date: new Date(sig.signed_at * 1000) }
            : undefined,
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
    const isValid = this.verifyWebhookSignature(JSON.stringify(payload), headers["x-hellosign-signature"] || "");

    const envelopeId = (payload as any).signature_request?.signature_request_id || "";
    const eventType = (payload as any).event?.type || "unknown";

    const statusMap: Record<string, EnvelopeStatus> = {
      signature_request_sent: "sent",
      signature_request_viewed: "viewed",
      signature_request_signed: "signed",
      signature_request_all_signed: "completed",
      signature_request_declined: "declined",
      signature_request_canceled: "voided",
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
      source: "hellosign",
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
        message: verified ? "HelloSign connection is healthy" : "Failed to verify credentials",
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${(error as Error).message}`,
      };
    }
  }
}
