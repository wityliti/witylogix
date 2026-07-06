/**
 * E-Signature Workflow Engine v2
 * Complete digital signing, templating, and compliance system
 * Exports all types, managers, and API endpoints
 */

// Types
export * from "./esignature-types";

// Envelope Management
export {
  EnvelopeManager,
  EnvelopeValidator,
  EnvelopeStatusTracker,
  BulkSendManager,
  EnvelopeMerger,
} from "./envelope-engine-v2";

// Template Management
export {
  TemplateManager,
  FieldMapper,
  RoleManager,
  VariableManager,
  TemplateAnalyticsManager,
} from "./template-manager-v2";

// Signing Ceremony
export {
  SigningCeremonyOrchestrator,
  SignerAuthenticator,
  SigningSessionManager,
  FieldRenderer,
  CompletionHandler,
  NotificationManager,
} from "./signing-ceremony";

// Audit & Compliance
export {
  AuditLogger,
  CertificateGenerator,
  ComplianceReporter,
  TamperDetector,
  RetentionManager,
} from "./audit-trail";

// API Endpoints
export {
  ESignatureApiHandler,
  apiRoutes,
  // Schemas
  createEnvelopeSchema,
  updateEnvelopeSchema,
  sendEnvelopeSchema,
  voidEnvelopeSchema,
  addSignerSchema,
  updateSignerSchema,
  createFieldSchema,
  createTemplateSchema,
  updateTemplateSchema,
  publishTemplateSchema,
  shareTemplateSchema,
  createSigningSessionSchema,
  signFieldSchema,
  completeSigningSchema,
  createBulkSendSchema,
  scheduleBulkSendSchema,
  queryAuditTrailSchema,
  downloadCertificateSchema,
  getComplianceReportSchema,
  // Response schemas
  envelopeResponseSchema,
  templateResponseSchema,
  signingSessionResponseSchema,
  auditEventResponseSchema,
  certificateResponseSchema,
  complianceReportResponseSchema,
  errorResponseSchema,
  // Types
  type CreateEnvelope,
  type UpdateEnvelope,
  type SendEnvelope,
  type VoidEnvelope,
  type AddSigner,
  type UpdateSigner,
  type CreateField,
  type CreateTemplate,
  type UpdateTemplate,
  type PublishTemplate,
  type ShareTemplate,
  type CreateSigningSession,
  type SignField,
  type CompleteSigningSession,
  type CreateBulkSend,
  type ScheduleBulkSend,
  type QueryAuditTrail,
  type DownloadCertificate,
  type GetComplianceReport,
  type ErrorResponse,
} from "./esignature-api";
