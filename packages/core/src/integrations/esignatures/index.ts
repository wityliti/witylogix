/**
 * E-Signature Integration Module.
 *
 * Exports types, adapters, and orchestration engine for multi-provider
 * e-signature integration with DocuSign, Adobe Sign, PandaDoc, and HelloSign.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type {
  Envelope,
  Document,
  Signer,
  SigningField,
  Template,
  SigningEvent,
  ESignatureConfig,
  ESignatureWebhookEvent,
  EnvelopeResult,
  EnvelopeStatusResult,
  DocumentDownloadResult,
  EmbedSigningResult,
  ESignatureAdapterInterface,
  EnvelopeEngineOptions,
  OrchestrationResult,
  ComplianceEvent,
} from "./types.js";

export type {
  EnvelopeStatus,
  FieldType,
  ProviderSelectionStrategy,
} from "./types.js";

// ─── Adapters ───────────────────────────────────────────────────────

export { ESignatureAdapter } from "./esignature-adapter.js";
export { DocuSignClient } from "./docusign-client.js";
export { AdobeSignClient } from "./adobe-sign-client.js";
export { PandaDocClient } from "./pandadoc-client.js";
export { HelloSignClient } from "./hellosign-client.js";

// ─── Engine ─────────────────────────────────────────────────────────

export { EnvelopeEngine } from "./envelope-engine.js";
