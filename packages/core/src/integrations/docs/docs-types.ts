/**
 * Documentation Engine — Type definitions for SDK docs, webhooks, rate limits, and troubleshooting.
 *
 * Defines the core types for auto-generating and serving comprehensive integration documentation.
 */

// ─── SDK Documentation ──────────────────────────────────────────

/** Documentation for a single parameter. */
export interface ParameterDoc {
  /** Parameter name. */
  name: string;
  /** Parameter data type. */
  type: string;
  /** Whether parameter is required. */
  required: boolean;
  /** Human description. */
  description: string;
  /** Default value (if any). */
  defaultValue?: unknown;
  /** Example value. */
  example?: unknown;
  /** Constraints or validation rules. */
  constraints?: string[];
}

/** Documentation for a return value or response. */
export interface ResponseDoc {
  /** Response data type. */
  type: string;
  /** Human description. */
  description: string;
  /** Example response (JSON/object). */
  example?: unknown;
  /** Response fields documentation. */
  fields?: Record<string, string>;
}

/** Documentation for a single SDK method. */
export interface MethodDoc {
  /** Method name. */
  name: string;
  /** Human description. */
  description: string;
  /** Method parameters. */
  parameters: ParameterDoc[];
  /** Return value documentation. */
  returns: ResponseDoc;
  /** Authentication requirements. */
  requiresAuth: boolean;
  /** Rate limit category (e.g., "standard", "heavy"). */
  rateLimitCategory?: string;
  /** Example request (code snippet). */
  example?: string;
  /** Potential error codes. */
  errors?: Array<{
    code: string;
    description: string;
  }>;
}

/** Complete SDK class documentation. */
export interface SDKDocumentation {
  /** Provider slug. */
  provider: string;
  /** Provider display name. */
  providerName: string;
  /** SDK class name. */
  className: string;
  /** Class description. */
  description: string;
  /** Required imports. */
  imports: string[];
  /** Required credentials/config. */
  requiredCredentials: string[];
  /** Instantiation example. */
  instantiationExample?: string;
  /** Documented methods. */
  methods: MethodDoc[];
  /** Authentication info. */
  authentication: {
    type: "API_KEY" | "OAUTH" | "NONE" | "MULTI_CREDENTIAL";
    description: string;
    setupUrl?: string;
  };
}

// ─── Webhook Documentation ─────────────────────────────────────

/** JSON Schema for a webhook payload field. */
export interface PayloadSchema {
  /** Field name. */
  name: string;
  /** Data type. */
  type: string;
  /** Field description. */
  description: string;
  /** Whether field is always present. */
  required: boolean;
  /** Nested fields (if object). */
  properties?: PayloadSchema[];
}

/** Complete webhook event documentation. */
export interface WebhookEventDoc {
  /** Event type identifier (e.g., "payment.created"). */
  eventType: string;
  /** Human-readable event name. */
  eventName: string;
  /** Event description. */
  description: string;
  /** Payload schema/structure. */
  payloadSchema: PayloadSchema[];
  /** Sample webhook payload. */
  samplePayload: unknown;
  /** Available filters/subscriptions. */
  availableFilters?: string[];
  /** Timestamp of event documentation. */
  documentedAt: Date;
}

/** Webhook catalog for a provider. */
export interface WebhookCatalog {
  /** Provider slug. */
  provider: string;
  /** Provider display name. */
  providerName: string;
  /** All webhook event types. */
  events: WebhookEventDoc[];
  /** Webhook configuration endpoint. */
  configurationUrl?: string;
  /** Example webhook subscription request. */
  subscriptionExample?: string;
  /** How to verify webhook authenticity. */
  verificationMethod?: string;
  /** Sample verification code. */
  verificationExample?: string;
}

// ─── Rate Limit Documentation ──────────────────────────────────

/** Rate limit info for a specific endpoint or operation. */
export interface RateLimitInfo {
  /** Limit type (e.g., "requests_per_second", "credits_per_minute"). */
  limitType: string;
  /** Numeric limit value. */
  limit: number;
  /** Unit (e.g., "per_second", "per_minute", "per_hour", "per_month"). */
  unit: string;
  /** Whether limit is shared across endpoints or per-endpoint. */
  scope: "GLOBAL" | "ENDPOINT" | "OPERATION";
  /** Operation/endpoint this limit applies to (if scoped). */
  appliesTo?: string[];
  /** Burst capacity (if applicable). */
  burstCapacity?: number;
  /** How to reset a consumed limit. */
  resetBehavior?: string;
  /** Retry-After header behavior. */
  retryAfterHeader?: boolean;
}

/** Rate limit reference for a provider. */
export interface RateLimitReference {
  /** Provider slug. */
  provider: string;
  /** Provider display name. */
  providerName: string;
  /** All rate limits for this provider. */
  limits: RateLimitInfo[];
  /** Effective limit accounting for retries. */
  effectiveLimit?: {
    requestsPerSecond: number;
    burstCapacity: number;
  };
  /** Documentation URL. */
  documentationUrl?: string;
}

// ─── Troubleshooting Playbooks ─────────────────────────────────

/** Single resolution step in a playbook. */
export interface PlaybookStep {
  /** Step number. */
  stepNumber: number;
  /** Step description. */
  description: string;
  /** Code example (if applicable). */
  code?: string;
  /** Expected result after this step. */
  expectedResult?: string;
}

/** Decision tree node for diagnostics. */
export interface DiagnosticNode {
  /** Node identifier. */
  nodeId: string;
  /** Question to ask or condition to check. */
  question: string;
  /** Next node if true. */
  yesNodeId?: string;
  /** Next node if false. */
  noNodeId?: string;
  /** Resolution steps if terminal node. */
  resolution?: PlaybookStep[];
}

/** Single troubleshooting playbook. */
export interface Playbook {
  /** Playbook identifier. */
  playbookId: string;
  /** Error code or pattern this addresses. */
  errorCode: string;
  /** Human error name/title. */
  errorName: string;
  /** Detailed error description. */
  description: string;
  /** Root causes. */
  rootCauses: string[];
  /** Resolution steps. */
  steps: PlaybookStep[];
  /** Diagnostic decision tree. */
  diagnosticTree?: DiagnosticNode[];
  /** Log analysis patterns to look for. */
  logPatterns?: string[];
  /** When to escalate. */
  escalationCriteria?: string[];
  /** Related playbooks. */
  relatedPlaybooks?: string[];
}

/** Complete troubleshooting reference for a provider. */
export interface TroubleshootingReference {
  /** Provider slug. */
  provider: string;
  /** Provider display name. */
  providerName: string;
  /** All playbooks for this provider. */
  playbooks: Playbook[];
  /** Common error categories. */
  errorCategories: string[];
  /** Support contact info. */
  supportUrl?: string;
  /** Issue tracking/reporting URL. */
  issueTrackerUrl?: string;
}

// ─── Configuration Guide ────────────────────────────────────────

/** Single configuration step. */
export interface ConfigurationStep {
  /** Step number. */
  stepNumber: number;
  /** Step title. */
  title: string;
  /** Detailed instructions. */
  instructions: string;
  /** Code/configuration example. */
  example?: string;
  /** Expected outcome. */
  expectedOutcome?: string;
}

/** Complete setup guide for a provider. */
export interface ConfigGuide {
  /** Provider slug. */
  provider: string;
  /** Provider display name. */
  providerName: string;
  /** Overview/introduction. */
  introduction: string;
  /** Prerequisites (accounts, permissions, etc.). */
  prerequisites: string[];
  /** Required credentials. */
  requiredCredentials: Array<{
    name: string;
    description: string;
    howToObtain: string;
  }>;
  /** Required OAuth scopes (if applicable). */
  requiredScopes?: string[];
  /** Environment variables to set. */
  environmentVariables?: Array<{
    name: string;
    value: string;
    description: string;
  }>;
  /** Step-by-step setup instructions. */
  setupSteps: ConfigurationStep[];
  /** Webhook configuration (if applicable). */
  webhookConfiguration?: Array<{
    eventType: string;
    setupInstructions: string;
    example?: string;
  }>;
  /** Verification steps to confirm setup. */
  verificationSteps: ConfigurationStep[];
  /** Troubleshooting common setup issues. */
  commonIssues?: Array<{
    issue: string;
    solution: string;
  }>;
}

// ─── Aggregate Documentation Service ───────────────────────────

/** All documentation for a single provider. */
export interface ProviderDocumentation {
  /** Provider slug. */
  provider: string;
  /** Provider display name. */
  providerName: string;
  /** SDK documentation. */
  sdk?: SDKDocumentation;
  /** Webhook catalog. */
  webhooks?: WebhookCatalog;
  /** Rate limit reference. */
  rateLimits?: RateLimitReference;
  /** Troubleshooting reference. */
  troubleshooting?: TroubleshootingReference;
  /** Configuration guide. */
  configGuide?: ConfigGuide;
  /** Last updated timestamp. */
  lastUpdated: Date;
}
