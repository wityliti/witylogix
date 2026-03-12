/**
 * Adobe Sign E-Signature Adapter.
 *
 * Integrates with Adobe Sign REST API v6
 * Supports:
 * - OAuth2 with refresh tokens
 * - Agreements (create, send, cancel)
 * - Participants and document management
 * - Library templates and web forms
 * - Mega-sign for bulk signing
 * - Webhook subscriptions for agreement events
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

interface AdobeSignParticipantSet {
  memberInfos: Array<{
    email: string;
  }>;
  role: "SIGNER" | "APPROVER" | "DELEGATED_SIGNER" | "ACCEPTOR" | "FORM_FILLER";
  order?: number;
}

interface AdobeSignFileInfo {
  documentUrl?: string;
  transientDocumentId?: string;
  libraryDocumentId?: string;
}

interface AdobeSignAgreementRequest {
  fileInfos: AdobeSignFileInfo[];
  participantSetsInfo: AdobeSignParticipantSet[];
  name: string;
  message?: string;
  signatureType?: "ESIGN" | "DIGITAL";
  signatureFlow?: "SENDER_SIGNATURE_NOT_REQUIRED" | "SENDER_SIGNS_FIRST" | "SENDER_SIGNS_LAST";
  state?: "IN_PROCESS" | "DRAFT";
  reminderFrequency?: "DAILY_UNTIL_SIGNED" | "WEEKLY_UNTIL_SIGNED" | "BI_WEEKLY_UNTIL_SIGNED";
}

/**
 * Adobe Sign e-signature adapter.
 */
export class AdobeSignClient extends ESignatureAdapter {
  private baseUrl: string = "";
  private accountId: string = "";

  constructor() {
    super("Adobe Sign");
  }

  async initialize(config: ESignatureConfig): Promise<void> {
    await super.initialize(config);

    if (!config.accountId) {
      throw new Error("Adobe Sign: accountId is required");
    }

    this.baseUrl = (config.apiUrl || "https://api.adobesign.com").replace(/\/$/, "");
    this.accountId = config.accountId;

    if (config.authType === "oauth2") {
      await this.refreshToken();
    }
  }

  /**
   * Verify Adobe Sign credentials.
   */
  async verifyCredentials(): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.baseUrl}/api/rest/v6/agreements`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Refresh OAuth2 token.
   */
  async refreshToken(): Promise<void> {
    if (!this.config?.clientId || !this.config?.clientSecret || !this.config?.refreshToken) {
      throw new Error("Adobe Sign: OAuth2 requires clientId, clientSecret, and refreshToken");
    }

    const response = await fetch("https://api.adobesign.com/oauth/token", {
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
   * Create agreement.
   */
  async createEnvelope(envelope: Envelope): Promise<EnvelopeResult> {
    return this.rateLimitedRequest(async () => {
      const prepared = this.prepareEnvelope(envelope);
      const token = await this.getAccessToken();

      // Upload documents first
      const transientDocumentIds: string[] = [];
      for (const doc of prepared.documents) {
        const formData = new FormData();
        formData.append("File", Buffer.from(doc.content, "base64"));

        const uploadResponse = await fetch(
          `${this.baseUrl}/api/rest/v6/transientDocuments`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          throw new Error(`Adobe Sign: Failed to upload document: ${uploadResponse.statusText}`);
        }

        const uploadData = (await uploadResponse.json()) as { transientDocumentId: string };
        transientDocumentIds.push(uploadData.transientDocumentId);
      }

      // Create participant sets
      const participantSetsInfo: AdobeSignParticipantSet[] = prepared.signers.map(
        (signer) => ({
          memberInfos: [{ email: signer.email }],
          role: "SIGNER",
          order: signer.order,
        })
      );

      const request: AdobeSignAgreementRequest = {
        fileInfos: transientDocumentIds.map((id) => ({
          transientDocumentId: id,
        })),
        participantSetsInfo,
        name: envelope.subject || "Document Signature Request",
        message: envelope.message,
        signatureType: "ESIGN",
        state: "IN_PROCESS",
      };

      const response = await fetch(`${this.baseUrl}/api/rest/v6/agreements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to create agreement: ${response.statusText}`);
      }

      const data = (await response.json()) as { id: string };

      return {
        envelopeId: data.id,
        status: "created",
        createdAt: new Date(),
      };
    });
  }

  /**
   * Send agreement.
   */
  async sendEnvelope(envelopeId: string): Promise<EnvelopeResult> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/api/rest/v6/agreements/${envelopeId}/state`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ state: "OUT_FOR_SIGNATURE" }),
        }
      );

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to send agreement: ${response.statusText}`);
      }

      return {
        envelopeId,
        status: "sent",
        createdAt: new Date(),
      };
    });
  }

  /**
   * Cancel agreement.
   */
  async voidEnvelope(envelopeId: string, reason?: string): Promise<void> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/api/rest/v6/agreements/${envelopeId}/state`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ state: "CANCELLED", comment: reason }),
        }
      );

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to cancel agreement: ${response.statusText}`);
      }
    });
  }

  /**
   * Get agreement details.
   */
  async getEnvelope(envelopeId: string): Promise<Envelope> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/api/rest/v6/agreements/${envelopeId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to get agreement: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      const statusMap: Record<string, EnvelopeStatus> = {
        DRAFT: "created",
        AUTHORING: "created",
        OUT_FOR_SIGNATURE: "sent",
        OUT_FOR_APPROVAL: "sent",
        SIGNED: "signed",
        APPROVED: "completed",
        REJECTED: "declined",
        CANCELLED: "voided",
        EXPIRED: "voided",
        ARCHIVED: "completed",
        UNKNOWN: "created",
      };

      return {
        id: data.id,
        name: data.name || "Document",
        status: statusMap[data.status] || "created",
        documents: (data.documentList || []).map((doc: any, i: number) => ({
          id: doc.id,
          name: doc.name,
          fileName: doc.name,
          content: "",
          order: i + 1,
          mimeType: "application/pdf",
        })),
        signers: (data.participantSetMap || []).map((p: any) => ({
          email: p.memberInfos?.[0]?.email || "",
          name: p.memberInfos?.[0]?.email || "",
          order: p.order || 1,
          requiresSequentialSigning: true,
        })),
        fields: [],
        createdAt: new Date(),
        subject: data.name,
        workflowMode: "sequential",
        createdBy: data.creator?.email || "unknown",
      };
    });
  }

  /**
   * Get agreement status.
   */
  async getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatusResult> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/api/rest/v6/agreements/${envelopeId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to get agreement status: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      const statusMap: Record<string, EnvelopeStatus> = {
        DRAFT: "created",
        OUT_FOR_SIGNATURE: "sent",
        SIGNED: "signed",
        APPROVED: "completed",
        REJECTED: "declined",
        CANCELLED: "voided",
      };

      const signerStatuses = (data.participantSetMap || []).map((p: any) => ({
        email: p.memberInfos?.[0]?.email || "",
        name: p.memberInfos?.[0]?.email || "",
        status: statusMap[p.status] || ("created" as EnvelopeStatus),
        signedAt: p.signedDate ? new Date(p.signedDate) : undefined,
      }));

      const completedSigners = signerStatuses.filter((s) => s.status === "completed" || s.status === "signed").length;
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
   * List agreements.
   */
  async listEnvelopes(options?: {
    status?: string;
    limit?: number;
    offset?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{ envelopes: Envelope[]; total: number }> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      const params = new URLSearchParams({
        cursor: offset.toString(),
        pageSize: limit.toString(),
      });

      if (options?.status) {
        params.append("status", options.status);
      }

      const response = await fetch(
        `${this.baseUrl}/api/rest/v6/agreements?${params}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to list agreements: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      const statusMap: Record<string, EnvelopeStatus> = {
        DRAFT: "created",
        OUT_FOR_SIGNATURE: "sent",
        SIGNED: "signed",
        APPROVED: "completed",
        REJECTED: "declined",
        CANCELLED: "voided",
      };

      const envelopes = (data.userAgreementList || []).map((agreement: any) => ({
        id: agreement.agreementId,
        name: agreement.name || "Document",
        status: statusMap[agreement.status] || "created",
        documents: [],
        signers: [],
        fields: [],
        createdAt: new Date(agreement.created),
        workflowMode: "sequential" as const,
        createdBy: "unknown",
      }));

      return {
        envelopes,
        total: data.page?.totalItemCount || 0,
      };
    });
  }

  /**
   * Resend agreement.
   */
  async resendEnvelope(envelopeId: string, signerEmails?: string[]): Promise<void> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/api/rest/v6/agreements/${envelopeId}/reminders`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reminders: signerEmails?.map((email) => ({ email })) || [],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to resend agreement: ${response.statusText}`);
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
      const token = await this.getAccessToken();
      const limit = options?.limit || 20;

      const response = await fetch(
        `${this.baseUrl}/api/rest/v6/libraryDocuments?pageSize=${limit}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to list templates: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      const templates = (data.libraryDocumentList || []).map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        description: doc.description,
        createdAt: new Date(doc.created),
        modifiedAt: new Date(doc.modifiedDate),
        defaultSignerCount: 1,
      }));

      return {
        templates,
        total: templates.length,
      };
    });
  }

  /**
   * Get template details.
   */
  async getTemplate(templateId: string): Promise<Template> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/api/rest/v6/libraryDocuments/${templateId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to get template: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        createdAt: new Date(data.created),
        modifiedAt: new Date(data.modifiedDate),
        defaultSignerCount: 1,
      };
    });
  }

  /**
   * Create agreement from template.
   */
  async createEnvelopeFromTemplate(
    templateId: string,
    envelope: Partial<Envelope>
  ): Promise<EnvelopeResult> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const participantSetsInfo = envelope.signers?.map((signer) => ({
        memberInfos: [{ email: signer.email }],
        role: "SIGNER" as const,
        order: signer.order,
      })) || [];

      const request = {
        fileInfos: [{ libraryDocumentId: templateId }],
        participantSetsInfo,
        name: envelope.subject || "Document Signature Request",
        message: envelope.message,
        state: "IN_PROCESS" as const,
      };

      const response = await fetch(`${this.baseUrl}/api/rest/v6/agreements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to create agreement from template: ${response.statusText}`);
      }

      const data = (await response.json()) as { id: string };

      return {
        envelopeId: data.id,
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
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/api/rest/v6/agreements/${envelopeId}/documents/${documentId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to download document: ${response.statusText}`);
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
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/api/rest/v6/agreements/${envelopeId}/combinedDocument`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to download documents: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const content = Buffer.from(buffer).toString("base64");

      return {
        content,
        mimeType: "application/pdf",
        fileName: `agreement_${envelopeId}.pdf`,
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
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/api/rest/v6/agreements/${envelopeId}/views/signingUrl`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to get signing URL: ${response.statusText}`);
      }

      const data = (await response.json()) as { signingUrl: string };

      return {
        signingUrl: data.signingUrl,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };
    });
  }

  /**
   * Mark document as viewed.
   */
  async markDocumentViewed(envelopeId: string, signerEmail: string): Promise<void> {
    // Adobe Sign tracks viewing automatically
  }

  /**
   * Get agreement events.
   */
  async getEnvelopeEvents(envelopeId: string): Promise<SigningEvent[]> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/api/rest/v6/agreements/${envelopeId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Adobe Sign: Failed to get events: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const events: SigningEvent[] = [];

      const statusMap: Record<string, EnvelopeStatus> = {
        DRAFT: "created",
        OUT_FOR_SIGNATURE: "sent",
        SIGNED: "signed",
        APPROVED: "completed",
        REJECTED: "declined",
        CANCELLED: "voided",
      };

      events.push({
        id: `${envelopeId}_agreement`,
        envelopeId,
        type: "status_changed",
        previousStatus: "created",
        newStatus: statusMap[data.status] || "created",
        timestamp: new Date(),
      });

      (data.participantSetMap || []).forEach((participant: any) => {
        events.push({
          id: `${envelopeId}_${participant.memberInfos?.[0]?.email}`,
          envelopeId,
          type: "status_changed",
          signerEmail: participant.memberInfos?.[0]?.email,
          previousStatus: "sent",
          newStatus: statusMap[participant.status] || "sent",
          timestamp: new Date(),
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
    const isValid = this.verifyWebhookSignature(JSON.stringify(payload), headers["x-adobe-signature"] || "");

    const envelopeId = (payload as any).agreementId || "";
    const eventType = (payload as any).eventType || "unknown";

    const statusMap: Record<string, EnvelopeStatus> = {
      AGREEMENT_CREATED: "created",
      AGREEMENT_ACTION_DELEGATED: "sent",
      AGREEMENT_VIEWABLE: "delivered",
      AGREEMENT_SIGNED: "signed",
      AGREEMENT_ACCEPTED: "completed",
      AGREEMENT_REJECTED: "declined",
      AGREEMENT_EXPIRED: "voided",
      AGREEMENT_RECALLED: "voided",
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
      source: "adobe_sign",
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
        message: verified ? "Adobe Sign connection is healthy" : "Failed to verify credentials",
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${(error as Error).message}`,
      };
    }
  }
}
