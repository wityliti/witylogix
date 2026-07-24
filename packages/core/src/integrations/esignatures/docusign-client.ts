/**
 * DocuSign E-Signature Adapter.
 *
 * Integrates with DocuSign REST API v2.1
 * Supports:
 * - JWT Grant and Authorization Code Grant OAuth2
 * - Envelope creation, sending, and management
 * - Recipient management and field positioning
 * - Template management and custom fields
 * - Connect webhooks for real-time status updates
 * - Embedded signing with recipient view URLs
 */

import { fetch } from "undici";
import { createHmac, createSign } from "crypto";

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
  Signer,
  Document,
  SigningField,
  EnvelopeStatus,
} from "./types.js";

interface DocuSignTab {
  documentId?: string;
  pageNumber: string;
  xPosition: string;
  yPosition: string;
  width?: string;
  height?: string;
  tabLabel: string;
  required?: string;
  value?: string;
  tabType?: string;
}

interface DocuSignSigner {
  email: string;
  name: string;
  recipientId: string;
  routingOrder: string;
  signInEachLocation?: string;
  requireIDLookup?: string;
  idCheckConfigurationName?: string;
  tabs?: {
    signHereTabs?: DocuSignTab[];
    initialHereTabs?: DocuSignTab[];
    dateSignedTabs?: DocuSignTab[];
    textTabs?: DocuSignTab[];
    checkboxTabs?: DocuSignTab[];
    dropdownTabs?: DocuSignTab[];
  };
}

interface DocuSignDocument {
  documentId: string;
  name: string;
  documentBase64: string;
  fileExtension?: string;
}

interface DocuSignEnvelopeRequest {
  emailSubject: string;
  emailBlurb?: string;
  documents: DocuSignDocument[];
  recipients: {
    signers: DocuSignSigner[];
  };
  status: "created" | "sent";
  templateId?: string;
  templateRoles?: Array<{
    email: string;
    name: string;
    roleName: string;
  }>;
}

interface DocuSignEnvelopeResponse {
  envelopeId: string;
  emailSubject?: string;
  status: string;
  statusChangedDateTime?: string;
  createdBy?: string;
  envelopeDocuments?: Array<{
    documentId: string;
    name: string;
  }>;
  recipients?: {
    signers?: Array<{
      email: string;
      name: string;
      status: string;
      routingOrder: string;
      signedDateTime?: string;
      declinedDateTime?: string;
      statusChangedDateTime?: string;
      location?: string;
      declinedReason?: string;
    }>;
  };
  emailBlurb?: string;
}

interface DocuSignTemplateResponse {
  templateId: string;
  name: string;
  description?: string;
  dateModified?: string;
  recipients?: {
    signers?: Array<{ email: string; name: string }>;
  };
}

interface DocuSignTemplatesListResponse {
  envelopeTemplates?: Array<{
    templateId: string;
    name: string;
    description?: string;
    dateModified?: string;
  }>;
  totalSetSize?: number;
}

interface DocuSignEnvelopesListResponse {
  envelopes?: Array<{
    envelopeId: string;
    emailSubject?: string;
    status: string;
    statusChangedDateTime?: string;
  }>;
  totalSetSize?: number;
}

/**
 * DocuSign e-signature adapter.
 */
export class DocuSignClient extends ESignatureAdapter {
  private baseUrl: string = "";
  private accountId: string = "";

  constructor() {
    super("DocuSign");
  }

  async initialize(config: ESignatureConfig): Promise<void> {
    await super.initialize(config);

    if (!config.accountId) {
      throw new Error("DocuSign: accountId is required");
    }

    this.baseUrl = (config.apiUrl || "https://na3.docusign.net").replace(
      /\/$/,
      "",
    );
    this.accountId = config.accountId;

    if (config.authType === "oauth2") {
      await this.refreshToken();
    }
  }

  /**
   * Verify DocuSign credentials.
   */
  async verifyCredentials(): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    try {
      const token = await this.getAccessToken();
      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Refresh OAuth2 token using refresh token or JWT.
   */
  async refreshToken(): Promise<void> {
    if (!this.config) {
      throw new Error("DocuSign: Not initialized");
    }

    if (this.config.authType === "jwt") {
      await this.refreshJWTToken();
    } else if (this.config.authType === "oauth2" && this.config.refreshToken) {
      await this.refreshOAuth2Token();
    } else {
      throw new Error("DocuSign: Invalid auth configuration");
    }
  }

  /**
   * Refresh using OAuth2 Authorization Code Grant.
   */
  private async refreshOAuth2Token(): Promise<void> {
    if (
      !this.config?.clientId ||
      !this.config?.clientSecret ||
      !this.config?.refreshToken
    ) {
      throw new Error(
        "DocuSign: OAuth2 requires clientId, clientSecret, and refreshToken",
      );
    }

    const response = await fetch("https://account.docusign.com/oauth/token", {
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

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.setAccessToken(data.access_token, data.expires_in);
  }

  /**
   * Refresh using JWT Grant.
   */
  private async refreshJWTToken(): Promise<void> {
    if (
      !this.config?.clientId ||
      !this.config?.userId ||
      !this.config?.privateKey
    ) {
      throw new Error(
        "DocuSign: JWT requires clientId, userId, and privateKey",
      );
    }

    // Create JWT assertion
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.config.clientId,
      sub: this.config.userId,
      aud: "https://account.docusign.com",
      iat: now,
      exp: now + 3600,
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
      "base64url",
    );
    const message = `${headerB64}.${payloadB64}`;

    const signer = createSign("sha256");
    signer.update(message);
    const signatureBuffer = signer.sign(this.config.privateKey);
    const signature = signatureBuffer.toString("base64url");

    const assertion = `${message}.${signature}`;

    const response = await fetch("https://account.docusign.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    });

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.setAccessToken(data.access_token, data.expires_in);
  }

  /**
   * Create envelope with documents and signers.
   */
  async createEnvelope(envelope: Envelope): Promise<EnvelopeResult> {
    return this.rateLimitedRequest(async () => {
      const prepared = this.prepareEnvelope(envelope);
      const token = await this.getAccessToken();

      // Convert documents
      const docuSignDocs: DocuSignDocument[] = prepared.documents.map(
        (doc, index) => ({
          documentId: (index + 1).toString(),
          name: doc.fileName,
          documentBase64: doc.content,
          fileExtension: doc.fileName.split(".").pop() || "pdf",
        }),
      );

      // Convert signers with tabs
      const docuSignSigners: DocuSignSigner[] = prepared.signers.map(
        (signer) => {
          const signerFields = prepared.fields.filter(
            (f) => f.signerEmail === signer.email,
          );

          const tabs: DocuSignSigner["tabs"] = {
            signHereTabs: [],
            initialHereTabs: [],
            dateSignedTabs: [],
            textTabs: [],
            checkboxTabs: [],
            dropdownTabs: [],
          };

          signerFields.forEach((field) => {
            const docIndex = prepared.documents.findIndex(
              (d) => d.id === `doc${field.pageNumber}`,
            );
            const tab: DocuSignTab = {
              documentId: (docIndex + 1).toString(),
              pageNumber: field.pageNumber.toString(),
              xPosition: field.xCoordinate.toFixed(0),
              yPosition: field.yCoordinate.toFixed(0),
              width: field.width.toFixed(0),
              height: field.height.toFixed(0),
              tabLabel: field.label || field.id,
              required: field.required ? "true" : "false",
              value: field.value,
            };

            switch (field.type) {
              case "signature":
                tabs.signHereTabs?.push(tab);
                break;
              case "initial":
                tabs.initialHereTabs?.push(tab);
                break;
              case "date":
                tabs.dateSignedTabs?.push(tab);
                break;
              case "text":
                tabs.textTabs?.push(tab);
                break;
              case "checkbox":
                tabs.checkboxTabs?.push(tab);
                break;
              case "dropdown":
                tabs.dropdownTabs?.push(tab);
                break;
            }
          });

          return {
            email: signer.email,
            name: signer.name,
            recipientId: (prepared.signers.indexOf(signer) + 1).toString(),
            routingOrder: signer.order.toString(),
            tabs,
          };
        },
      );

      const request: DocuSignEnvelopeRequest = {
        emailSubject: envelope.subject || "Please sign this document",
        emailBlurb: envelope.message,
        documents: docuSignDocs,
        recipients: { signers: docuSignSigners },
        status: "created",
      };

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to create envelope: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as { envelopeId: string };

      return {
        envelopeId: data.envelopeId,
        status: "created",
        createdAt: new Date(),
      };
    });
  }

  /**
   * Send envelope to signers.
   */
  async sendEnvelope(envelopeId: string): Promise<EnvelopeResult> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "sent" }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to send envelope: ${response.statusText}`,
        );
      }

      return {
        envelopeId,
        status: "sent",
        createdAt: new Date(),
      };
    });
  }

  /**
   * Void/cancel envelope.
   */
  async voidEnvelope(envelopeId: string, reason?: string): Promise<void> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "voided", voidedReason: reason }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to void envelope: ${response.statusText}`,
        );
      }
    });
  }

  /**
   * Get envelope details.
   */
  async getEnvelope(envelopeId: string): Promise<Envelope> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to get envelope: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as DocuSignEnvelopeResponse;

      const statusMap: Record<string, EnvelopeStatus> = {
        created: "created",
        sent: "sent",
        delivered: "delivered",
        signed: "signed",
        completed: "completed",
        voided: "voided",
        declined: "declined",
      };

      return {
        id: data.envelopeId,
        name: data.emailSubject || "Document",
        status: statusMap[data.status] || "created",
        documents:
          data.envelopeDocuments?.map((doc, i) => ({
            id: doc.documentId,
            name: doc.name,
            fileName: doc.name,
            content: "",
            order: i + 1,
            mimeType: "application/pdf",
          })) || [],
        signers:
          data.recipients?.signers?.map((signer) => ({
            email: signer.email,
            name: signer.name,
            order: parseInt(signer.routingOrder) || 1,
            requiresSequentialSigning: true,
          })) || [],
        fields: [],
        createdAt: new Date(data.statusChangedDateTime || ""),
        subject: data.emailSubject,
        message: data.emailBlurb,
        workflowMode: "sequential",
        createdBy: data.createdBy || "unknown",
      };
    });
  }

  /**
   * Get envelope status.
   */
  async getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatusResult> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}?include=recipients`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to get envelope status: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as DocuSignEnvelopeResponse;

      const statusMap: Record<string, EnvelopeStatus> = {
        created: "created",
        sent: "sent",
        delivered: "delivered",
        viewed: "viewed",
        signed: "signed",
        completed: "completed",
        voided: "voided",
        declined: "declined",
      };

      const signerStatuses =
        data.recipients?.signers?.map((signer) => ({
          email: signer.email,
          name: signer.name,
          status: statusMap[signer.status] || ("created" as EnvelopeStatus),
          signedAt: signer.signedDateTime
            ? new Date(signer.signedDateTime)
            : undefined,
          declinedAt: signer.declinedDateTime
            ? new Date(signer.declinedDateTime)
            : undefined,
        })) || [];

      const completedSigners = signerStatuses.filter(
        (s) => s.status === "completed",
      ).length;
      const totalSigners = signerStatuses.length;
      const completionPercentage =
        totalSigners > 0 ? (completedSigners / totalSigners) * 100 : 0;

      return {
        envelopeId,
        status: statusMap[data.status] || "created",
        signerStatuses,
        completionPercentage: Math.round(completionPercentage),
        lastUpdated: new Date(data.statusChangedDateTime || ""),
      };
    });
  }

  /**
   * List envelopes.
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
        from_date:
          options?.fromDate?.toISOString() ||
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to_date: options?.toDate?.toISOString() || new Date().toISOString(),
      });

      if (options?.status) {
        params.append("status", options.status);
      }

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes?${params}&limit=${limit}&start_position=${offset}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to list envelopes: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as DocuSignEnvelopesListResponse;

      const statusMap: Record<string, EnvelopeStatus> = {
        created: "created",
        sent: "sent",
        delivered: "delivered",
        signed: "signed",
        completed: "completed",
        voided: "voided",
        declined: "declined",
      };

      const envelopes =
        data.envelopes?.map((env) => ({
          id: env.envelopeId,
          name: env.emailSubject || "Document",
          status: statusMap[env.status] || "created",
          documents: [],
          signers: [],
          fields: [],
          createdAt: new Date(env.statusChangedDateTime || ""),
          workflowMode: "sequential" as const,
          createdBy: "unknown",
        })) || [];

      return {
        envelopes,
        total: data.totalSetSize || 0,
      };
    });
  }

  /**
   * Resend envelope to signers.
   */
  async resendEnvelope(
    envelopeId: string,
    signerEmails?: string[],
  ): Promise<void> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/recipients`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipients: {
              signers:
                signerEmails?.map((email) => ({
                  email,
                  resendNotification: "true",
                })) || [],
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to resend envelope: ${response.statusText}`,
        );
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
      const offset = options?.offset || 0;

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/templates?limit=${limit}&start_position=${offset}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to list templates: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as DocuSignTemplatesListResponse;

      const templates =
        data.envelopeTemplates?.map((template) => ({
          id: template.templateId,
          name: template.name,
          description: template.description,
          createdAt: new Date(),
          modifiedAt: new Date(template.dateModified || ""),
          defaultSignerCount: 1,
        })) || [];

      return {
        templates,
        total: data.totalSetSize || 0,
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
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/templates/${templateId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to get template: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as DocuSignTemplateResponse;

      return {
        id: data.templateId,
        name: data.name,
        description: data.description,
        createdAt: new Date(),
        modifiedAt: new Date(data.dateModified || ""),
        defaultSignerCount: data.recipients?.signers?.length || 1,
      };
    });
  }

  /**
   * Create envelope from template.
   */
  async createEnvelopeFromTemplate(
    templateId: string,
    envelope: Partial<Envelope>,
  ): Promise<EnvelopeResult> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const templateRoles =
        envelope.signers?.map((signer) => ({
          email: signer.email,
          name: signer.name,
          roleName: `Signer${signer.order}`,
        })) || [];

      const request = {
        templateId,
        templateRoles,
        emailSubject: envelope.subject || "Please sign this document",
        emailBlurb: envelope.message,
        status: "created",
      };

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to create envelope from template: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as { envelopeId: string };

      return {
        envelopeId: data.envelopeId,
        status: "created",
        createdAt: new Date(),
      };
    });
  }

  /**
   * Download document.
   */
  async downloadDocument(
    envelopeId: string,
    documentId: string,
  ): Promise<DocumentDownloadResult> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/documents/${documentId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to download document: ${response.statusText}`,
        );
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
   * Download all envelope documents as ZIP.
   */
  async downloadEnvelopeDocuments(
    envelopeId: string,
  ): Promise<{ content: string; mimeType: string; fileName: string }> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/documents/zip`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to download envelope documents: ${response.statusText}`,
        );
      }

      const buffer = await response.arrayBuffer();
      const content = Buffer.from(buffer).toString("base64");

      return {
        content,
        mimeType: "application/zip",
        fileName: `envelope_${envelopeId}.zip`,
      };
    });
  }

  /**
   * Get embedded signing URL.
   */
  async getEmbeddedSigningUrl(
    envelopeId: string,
    signerEmail: string,
    returnUrl: string,
  ): Promise<EmbedSigningResult> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/views/recipient`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            returnUrl,
            authMethod: "none",
            email: signerEmail,
            userName: signerEmail,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to get signing URL: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as { url: string };

      return {
        signingUrl: data.url,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      };
    });
  }

  /**
   * Mark document as viewed.
   */
  async markDocumentViewed(
    envelopeId: string,
    signerEmail: string,
  ): Promise<void> {
    // DocuSign tracks viewing automatically, no action needed
  }

  /**
   * Get envelope events.
   */
  async getEnvelopeEvents(envelopeId: string): Promise<SigningEvent[]> {
    return this.rateLimitedRequest(async () => {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}?include=recipients`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `DocuSign: Failed to get events: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as DocuSignEnvelopeResponse;
      const events: SigningEvent[] = [];

      const statusMap: Record<string, EnvelopeStatus> = {
        created: "created",
        sent: "sent",
        delivered: "delivered",
        signed: "signed",
        completed: "completed",
        voided: "voided",
        declined: "declined",
      };

      // Add envelope event
      events.push({
        id: `${envelopeId}_envelope`,
        envelopeId,
        type: "status_changed",
        previousStatus: "created",
        newStatus: statusMap[data.status] || "created",
        timestamp: new Date(data.statusChangedDateTime || ""),
      });

      // Add signer events
      data.recipients?.signers?.forEach((signer) => {
        events.push({
          id: `${envelopeId}_${signer.email}`,
          envelopeId,
          type: "status_changed",
          signerEmail: signer.email,
          previousStatus: "sent",
          newStatus: statusMap[signer.status] || "sent",
          timestamp: new Date(
            signer.statusChangedDateTime || data.statusChangedDateTime || "",
          ),
          signatureDetails: signer.signedDateTime
            ? {
                date: new Date(signer.signedDateTime),
                location: signer.location,
              }
            : undefined,
          declineReason: signer.declinedReason,
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
    headers: Record<string, string>,
  ): Promise<ESignatureWebhookEvent> {
    const isValid = this.verifyWebhookSignature(
      JSON.stringify(payload),
      headers["x-docusign-signature-1"] || "",
    );

    const payloadData = payload as Record<string, unknown>;
    const envelopeId =
      (payloadData.data as Record<string, unknown> | undefined)?.envelopeId ||
      "";
    const eventType = (payloadData.event as string) || "unknown";

    const statusMap: Record<string, EnvelopeStatus> = {
      "envelope-created": "created",
      "envelope-sent": "sent",
      "envelope-delivered": "delivered",
      "envelope-signed": "signed",
      "envelope-completed": "completed",
      "envelope-declined": "declined",
      "envelope-voided": "voided",
    };

    const signingEvent: SigningEvent = {
      id: `${envelopeId}_${Date.now()}`,
      envelopeId: String(envelopeId),
      type: "status_changed",
      previousStatus: "created",
      newStatus: statusMap[eventType] || "created",
      timestamp: new Date(),
    };

    return {
      source: "docusign",
      eventType: String(eventType),
      envelopeId: String(envelopeId),
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
      return true; // Skip verification if no secret configured
    }

    const hash = createHmac("sha256", this.config.webhookSecret)
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
        message: verified
          ? "DocuSign connection is healthy"
          : "Failed to verify credentials",
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${(error as Error).message}`,
      };
    }
  }
}
