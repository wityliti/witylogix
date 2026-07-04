/**
 * E-Signature API Endpoints v2
 * 15+ REST endpoints with Zod validation for complete signing workflow
 */

import { z } from "zod";
import {
  Envelope,
  Template,
  SigningCeremony,
  AuditEvent,
  EnvelopeStatus,
  FieldType,
  AuthenticationMethod,
  SignerRole,
} from "./esignature-types";

/**
 * Zod Validation Schemas
 */

// Common schemas
export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const coordinateSchema = z.object({
  xPosition: z.number().min(0),
  yPosition: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
});

/**
 * Envelope Schemas
 */

export const createEnvelopeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  templateId: z.string().uuid().optional(),
  externalId: z.string().optional(),
  documents: z.array(
    z.object({
      fileName: z.string().min(1),
      mimeType: z.string(),
      fileSize: z.number().positive(),
      pageCount: z.number().positive(),
      storageUrl: z.string().url(),
      storageKey: z.string(),
    }),
  ),
  signers: z.array(
    z.object({
      email: z.string().email(),
      name: z.string().min(1),
      phone: z.string().optional(),
      role: z.nativeEnum(SignerRole),
      routingOrder: z.number().positive(),
      authenticationMethod: z.nativeEnum(AuthenticationMethod),
      customFields: z.record(z.string()).optional(),
    }),
  ),
  requireAllSignatures: z.boolean().default(true),
  requireAcceptanceBeforeSigning: z.boolean().default(false),
  enableAccessControl: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
});

export const updateEnvelopeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

export const sendEnvelopeSchema = z.object({
  message: z.string().max(500).optional(),
  scheduleSend: z.date().optional(),
  notifySigners: z.boolean().default(true),
});

export const voidEnvelopeSchema = z.object({
  reason: z.string().min(1).max(500),
});

/**
 * Signer Schemas
 */

export const addSignerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  role: z.nativeEnum(SignerRole),
  routingOrder: z.number().positive(),
  authenticationMethod: z.nativeEnum(AuthenticationMethod),
  customFields: z.record(z.string()).optional(),
});

export const updateSignerSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  customFields: z.record(z.string()).optional(),
});

/**
 * Field Schemas
 */

export const createFieldSchema = z.object({
  documentId: z.string().uuid(),
  pageNumber: z.number().positive(),
  fieldType: z.nativeEnum(FieldType),
  roleId: z.string(),
  label: z.string().optional(),
  required: z.boolean().default(true),
  prefilled: z.string().optional(),
  placeholder: z.string().optional(),
  ...coordinateSchema.shape,
  anchorText: z.string().optional(),
  anchorXOffset: z.number().optional(),
  anchorYOffset: z.number().optional(),
  validationRule: z.string().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  options: z.array(z.string()).optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  fontColor: z.string().optional(),
  backgroundColor: z.string().optional(),
});

/**
 * Template Schemas
 */

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.string().optional(),
  documents: z.array(
    z.object({
      fileName: z.string().min(1),
      mimeType: z.string(),
      storageUrl: z.string().url(),
      storageKey: z.string(),
      pageCount: z.number().positive(),
    }),
  ),
  roles: z.array(
    z.object({
      name: z.string(),
      routingOrder: z.number().positive(),
      signerRole: z.nativeEnum(SignerRole),
      authenticationMethod: z.nativeEnum(AuthenticationMethod),
    }),
  ),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.string().optional(),
});

export const publishTemplateSchema = z.object({
  // Empty - just publish current version
});

export const shareTemplateSchema = z.object({
  userIds: z.array(z.string().uuid()),
  permission: z.enum(["view", "edit", "admin"]),
});

/**
 * Signing Session Schemas
 */

export const createSigningSessionSchema = z.object({
  signingType: z.enum(["remote", "embedded", "in_person"]),
});

export const signFieldSchema = z.object({
  fieldId: z.string().uuid(),
  value: z.any(),
  signatureImage: z.string().optional(), // Base64-encoded image
});

export const completeSigningSchema = z.object({
  declineReason: z.string().optional(),
});

/**
 * Bulk Send Schemas
 */

export const createBulkSendSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  csvContent: z.string(),
  recipientColumn: z.string(),
  recipientNameColumn: z.string().optional(),
  fieldMappings: z.record(z.string()),
});

export const scheduleBulkSendSchema = z.object({
  sendAt: z.date(),
});

/**
 * Audit & Compliance Schemas
 */

export const queryAuditTrailSchema = z.object({
  eventType: z.string().optional(),
  signerId: z.string().uuid().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  ...paginationSchema.shape,
});

export const downloadCertificateSchema = z.object({
  format: z.enum(["pem", "json", "pdf"]),
});

export const getComplianceReportSchema = z.object({
  format: z.enum(["json", "html", "pdf"]),
});

/**
 * Type Exports
 */

export type CreateEnvelope = z.infer<typeof createEnvelopeSchema>;
export type UpdateEnvelope = z.infer<typeof updateEnvelopeSchema>;
export type SendEnvelope = z.infer<typeof sendEnvelopeSchema>;
export type VoidEnvelope = z.infer<typeof voidEnvelopeSchema>;
export type AddSigner = z.infer<typeof addSignerSchema>;
export type UpdateSigner = z.infer<typeof updateSignerSchema>;
export type CreateField = z.infer<typeof createFieldSchema>;
export type CreateTemplate = z.infer<typeof createTemplateSchema>;
export type UpdateTemplate = z.infer<typeof updateTemplateSchema>;
export type PublishTemplate = z.infer<typeof publishTemplateSchema>;
export type ShareTemplate = z.infer<typeof shareTemplateSchema>;
export type CreateSigningSession = z.infer<typeof createSigningSessionSchema>;
export type SignField = z.infer<typeof signFieldSchema>;
export type CompleteSigningSession = z.infer<typeof completeSigningSchema>;
export type CreateBulkSend = z.infer<typeof createBulkSendSchema>;
export type ScheduleBulkSend = z.infer<typeof scheduleBulkSendSchema>;
export type QueryAuditTrail = z.infer<typeof queryAuditTrailSchema>;
export type DownloadCertificate = z.infer<typeof downloadCertificateSchema>;
export type GetComplianceReport = z.infer<typeof getComplianceReportSchema>;

/**
 * API Response Schemas
 */

export const envelopeResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.nativeEnum(EnvelopeStatus),
  createdAt: z.date(),
  updatedAt: z.date(),
  signatureProgress: z.object({
    totalSigners: z.number(),
    signersSigned: z.number(),
    signersDeclined: z.number(),
    signersViewed: z.number(),
  }),
  documents: z.array(
    z.object({
      id: z.string(),
      fileName: z.string(),
      pageCount: z.number(),
    }),
  ),
  signers: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      status: z.string(),
    }),
  ),
});

export const templateResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number(),
  isPublished: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  usageCount: z.number().optional(),
  completionRate: z.number().optional(),
});

export const signingSessionResponseSchema = z.object({
  id: z.string(),
  envelopeId: z.string(),
  signerId: z.string(),
  status: z.string(),
  signingUrl: z.string(),
  expiresAt: z.date(),
  completionPercentage: z.number(),
});

export const auditEventResponseSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  description: z.string(),
  timestamp: z.date(),
  ipAddress: z.string(),
  userAgent: z.string(),
  additionalData: z.record(z.any()).optional(),
});

export const certificateResponseSchema = z.object({
  id: z.string(),
  envelopeId: z.string(),
  completedAt: z.date(),
  expiresAt: z.date(),
  signatories: z.array(
    z.object({
      email: z.string(),
      name: z.string(),
      signedAt: z.date(),
    }),
  ),
});

export const complianceReportResponseSchema = z.object({
  id: z.string(),
  envelopeId: z.string(),
  esignActCompliant: z.boolean(),
  uetaCompliant: z.boolean(),
  eidasCompliant: z.boolean(),
  findings: z.array(
    z.object({
      category: z.string(),
      severity: z.enum(["info", "warning", "error"]),
      message: z.string(),
    }),
  ),
});

/**
 * Error Response Schema
 */

export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  statusCode: z.number(),
  details: z.record(z.any()).optional(),
  timestamp: z.date(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * API Endpoint Handlers
 * These would be implemented in actual REST framework (Express, Hono, etc.)
 */

export class ESignatureApiHandler {
  /**
   * POST /envelopes
   * Create new envelope
   */
  async createEnvelope(data: CreateEnvelope): Promise<Envelope> {
    // Validate input
    const validated = createEnvelopeSchema.parse(data);

    // TODO: Create envelope via EnvelopeManager
    // const envelope = await envelopeManager.createEnvelope(...);

    return {} as Envelope;
  }

  /**
   * GET /envelopes/:id
   * Get envelope by ID
   */
  async getEnvelope(envelopeId: string): Promise<Envelope> {
    // TODO: Fetch from EnvelopeManager
    return {} as Envelope;
  }

  /**
   * GET /envelopes
   * List envelopes with pagination
   */
  async listEnvelopes(
    query: z.infer<typeof paginationSchema> & { status?: EnvelopeStatus },
  ): Promise<{ envelopes: Envelope[]; total: number }> {
    const validated = paginationSchema.parse(query);

    // TODO: List envelopes with filters
    return { envelopes: [], total: 0 };
  }

  /**
   * PATCH /envelopes/:id
   * Update envelope
   */
  async updateEnvelope(
    envelopeId: string,
    data: UpdateEnvelope,
  ): Promise<Envelope> {
    const validated = updateEnvelopeSchema.parse(data);

    // TODO: Update via EnvelopeManager
    return {} as Envelope;
  }

  /**
   * POST /envelopes/:id/send
   * Send envelope to signers
   */
  async sendEnvelope(
    envelopeId: string,
    data: SendEnvelope,
  ): Promise<Envelope> {
    const validated = sendEnvelopeSchema.parse(data);

    // TODO: Validate envelope, transition status, send invites
    return {} as Envelope;
  }

  /**
   * POST /envelopes/:id/void
   * Void envelope
   */
  async voidEnvelope(
    envelopeId: string,
    data: VoidEnvelope,
  ): Promise<Envelope> {
    const validated = voidEnvelopeSchema.parse(data);

    // TODO: Void envelope, update status
    return {} as Envelope;
  }

  /**
   * POST /envelopes/:id/signers
   * Add signer to envelope
   */
  async addSigner(envelopeId: string, data: AddSigner): Promise<any> {
    const validated = addSignerSchema.parse(data);

    // TODO: Add signer via EnvelopeManager
    return {};
  }

  /**
   * PATCH /envelopes/:id/signers/:signerId
   * Update signer
   */
  async updateSigner(
    envelopeId: string,
    signerId: string,
    data: UpdateSigner,
  ): Promise<any> {
    const validated = updateSignerSchema.parse(data);

    // TODO: Update signer
    return {};
  }

  /**
   * POST /envelopes/:id/fields
   * Add field to envelope
   */
  async addField(envelopeId: string, data: CreateField): Promise<any> {
    const validated = createFieldSchema.parse(data);

    // TODO: Add field via envelope manager
    return {};
  }

  /**
   * POST /templates
   * Create template
   */
  async createTemplate(data: CreateTemplate): Promise<Template> {
    const validated = createTemplateSchema.parse(data);

    // TODO: Create template via TemplateManager
    return {} as Template;
  }

  /**
   * GET /templates/:id
   * Get template
   */
  async getTemplate(templateId: string): Promise<Template> {
    // TODO: Fetch template
    return {} as Template;
  }

  /**
   * GET /templates
   * List templates
   */
  async listTemplates(query: z.infer<typeof paginationSchema>): Promise<{
    templates: Template[];
    total: number;
  }> {
    const validated = paginationSchema.parse(query);

    // TODO: List templates
    return { templates: [], total: 0 };
  }

  /**
   * PATCH /templates/:id
   * Update template
   */
  async updateTemplate(
    templateId: string,
    data: UpdateTemplate,
  ): Promise<Template> {
    const validated = updateTemplateSchema.parse(data);

    // TODO: Update template
    return {} as Template;
  }

  /**
   * POST /templates/:id/publish
   * Publish template
   */
  async publishTemplate(templateId: string): Promise<Template> {
    // TODO: Publish template
    return {} as Template;
  }

  /**
   * POST /templates/:id/share
   * Share template with users
   */
  async shareTemplate(
    templateId: string,
    data: ShareTemplate,
  ): Promise<Template> {
    const validated = shareTemplateSchema.parse(data);

    // TODO: Share template
    return {} as Template;
  }

  /**
   * POST /envelopes/:id/signing-session
   * Create signing ceremony/session
   */
  async createSigningSession(
    envelopeId: string,
    signerId: string,
    data: CreateSigningSession,
  ): Promise<SigningCeremony> {
    const validated = createSigningSessionSchema.parse(data);

    // TODO: Create ceremony, return signing URL
    return {} as SigningCeremony;
  }

  /**
   * POST /signing-sessions/:sessionId/sign-field
   * Sign a field
   */
  async signField(sessionId: string, data: SignField): Promise<any> {
    const validated = signFieldSchema.parse(data);

    // TODO: Process field signature
    return { success: true };
  }

  /**
   * POST /signing-sessions/:sessionId/complete
   * Complete signing session
   */
  async completeSigningSession(
    sessionId: string,
    data?: CompleteSigningSession,
  ): Promise<any> {
    if (data) {
      const validated = completeSigningSchema.parse(data);
    }

    // TODO: Mark session complete
    return { success: true };
  }

  /**
   * POST /bulk-send
   * Create bulk send configuration
   */
  async createBulkSend(data: CreateBulkSend): Promise<any> {
    const validated = createBulkSendSchema.parse(data);

    // TODO: Create bulk send config
    return {};
  }

  /**
   * POST /bulk-send/:id/schedule
   * Schedule bulk send
   */
  async scheduleBulkSend(
    bulkSendId: string,
    data: ScheduleBulkSend,
  ): Promise<any> {
    const validated = scheduleBulkSendSchema.parse(data);

    // TODO: Schedule bulk send job
    return {};
  }

  /**
   * GET /envelopes/:id/audit-trail
   * Get audit trail
   */
  async getAuditTrail(
    envelopeId: string,
    query: QueryAuditTrail,
  ): Promise<{ events: AuditEvent[]; total: number }> {
    const validated = queryAuditTrailSchema.parse(query);

    // TODO: Query audit trail
    return { events: [], total: 0 };
  }

  /**
   * GET /envelopes/:id/certificate
   * Download signing certificate
   */
  async downloadCertificate(
    envelopeId: string,
    query: DownloadCertificate,
  ): Promise<string> {
    const validated = downloadCertificateSchema.parse(query);

    // TODO: Generate and return certificate
    return "";
  }

  /**
   * GET /envelopes/:id/compliance-report
   * Get compliance report
   */
  async getComplianceReport(
    envelopeId: string,
    query: GetComplianceReport,
  ): Promise<string> {
    const validated = getComplianceReportSchema.parse(query);

    // TODO: Generate compliance report
    return "";
  }

  /**
   * POST /envelopes/:id/merge
   * Merge multiple envelopes
   */
  async mergeEnvelopes(
    sourceEnvelopeIds: string[],
    newName: string,
  ): Promise<any> {
    if (!Array.isArray(sourceEnvelopeIds) || sourceEnvelopeIds.length < 2) {
      throw new Error("At least 2 envelopes required for merge");
    }

    // TODO: Merge envelopes
    return {};
  }

  /**
   * POST /envelopes/:id/clone
   * Clone envelope
   */
  async cloneEnvelope(envelopeId: string, newName: string): Promise<Envelope> {
    if (!newName || newName.trim().length === 0) {
      throw new Error("New name required for clone");
    }

    // TODO: Clone envelope
    return {} as Envelope;
  }
}

/**
 * API Route Definitions
 * For use with Express, Hono, or other routing frameworks
 */

export const apiRoutes = [
  // Envelope routes
  { method: "POST", path: "/envelopes", handler: "createEnvelope" },
  { method: "GET", path: "/envelopes", handler: "listEnvelopes" },
  { method: "GET", path: "/envelopes/:id", handler: "getEnvelope" },
  { method: "PATCH", path: "/envelopes/:id", handler: "updateEnvelope" },
  { method: "POST", path: "/envelopes/:id/send", handler: "sendEnvelope" },
  { method: "POST", path: "/envelopes/:id/void", handler: "voidEnvelope" },
  { method: "POST", path: "/envelopes/:id/clone", handler: "cloneEnvelope" },

  // Signer routes
  { method: "POST", path: "/envelopes/:id/signers", handler: "addSigner" },
  {
    method: "PATCH",
    path: "/envelopes/:id/signers/:signerId",
    handler: "updateSigner",
  },

  // Field routes
  { method: "POST", path: "/envelopes/:id/fields", handler: "addField" },

  // Template routes
  { method: "POST", path: "/templates", handler: "createTemplate" },
  { method: "GET", path: "/templates", handler: "listTemplates" },
  { method: "GET", path: "/templates/:id", handler: "getTemplate" },
  { method: "PATCH", path: "/templates/:id", handler: "updateTemplate" },
  {
    method: "POST",
    path: "/templates/:id/publish",
    handler: "publishTemplate",
  },
  { method: "POST", path: "/templates/:id/share", handler: "shareTemplate" },

  // Signing session routes
  {
    method: "POST",
    path: "/envelopes/:id/signing-session",
    handler: "createSigningSession",
  },
  {
    method: "POST",
    path: "/signing-sessions/:id/sign-field",
    handler: "signField",
  },
  {
    method: "POST",
    path: "/signing-sessions/:id/complete",
    handler: "completeSigningSession",
  },

  // Bulk operations
  { method: "POST", path: "/bulk-send", handler: "createBulkSend" },
  {
    method: "POST",
    path: "/bulk-send/:id/schedule",
    handler: "scheduleBulkSend",
  },

  // Audit & compliance
  {
    method: "GET",
    path: "/envelopes/:id/audit-trail",
    handler: "getAuditTrail",
  },
  {
    method: "GET",
    path: "/envelopes/:id/certificate",
    handler: "downloadCertificate",
  },
  {
    method: "GET",
    path: "/envelopes/:id/compliance-report",
    handler: "getComplianceReport",
  },

  // Merge operations
  { method: "POST", path: "/envelopes/merge", handler: "mergeEnvelopes" },
];
