/**
 * Healthcare Integration Types.
 *
 * Unified types for FHIR R4, HL7 v2, clinical documents, and consent management
 * across EHR providers (Cerner, Allscripts, Epic) with HIPAA audit logging.
 */

// ─── Configuration ──────────────────────────────────────────────────────────

/**
 * Base healthcare adapter configuration.
 */
export interface HealthcareConfig {
  /** Provider name (e.g., "epic", "cerner", "allscripts") */
  provider: string;

  /** Base URL for the healthcare provider API */
  baseUrl: string;

  /** API authentication token or API key */
  apiKey?: string;

  /** Client ID (for OAuth2) */
  clientId?: string;

  /** Client secret (for OAuth2) */
  clientSecret?: string;

  /** OAuth2 token endpoint */
  tokenEndpoint?: string;

  /** Tenant/organization ID */
  tenantId?: string;

  /** Facility/facility code */
  facilityCode?: string;

  /** Enable audit logging (HIPAA requirement) */
  auditLogging: boolean;

  /** Audit log destination (database, syslog, etc.) */
  auditLogDestination?: string;

  /** Rate limit: requests per second */
  rateLimit?: number;

  /** Circuit breaker: max failures before open */
  circuitBreakerThreshold?: number;

  /** Retry strategy: max attempts */
  retryMaxAttempts?: number;

  /** Retry strategy: backoff multiplier */
  retryBackoffMultiplier?: number;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ─── FHIR R4 Resources ──────────────────────────────────────────────────────

/**
 * Base FHIR Resource structure (simplified).
 */
export interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
  };
}

/**
 * Patient resource (FHIR R4).
 */
export interface Patient extends FHIRResource {
  resourceType: "Patient";
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  name?: Array<{
    use?: string;
    given?: string[];
    family?: string;
  }>;
  telecom?: Array<{
    system: "phone" | "email" | "fax" | "sms";
    value: string;
    use?: string;
  }>;
  gender?: "male" | "female" | "other" | "unknown";
  birthDate?: string;
  address?: Array<{
    use?: string;
    type?: string;
    text?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  contact?: Array<{
    relationship?: Array<{
      coding?: Array<{
        system: string;
        code: string;
      }>;
    }>;
    name?: {
      given?: string[];
      family?: string;
    };
    telecom?: Array<{
      system: string;
      value: string;
    }>;
  }>;
  maritalStatus?: {
    coding?: Array<{
      system: string;
      code: string;
    }>;
  };
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
}

/**
 * Observation resource (vital signs, lab results, etc.).
 */
export interface Observation extends FHIRResource {
  resourceType: "Observation";
  status: "registered" | "preliminary" | "final" | "amended" | "cancelled" | "entered-in-error" | "unknown";
  category?: Array<{
    coding?: Array<{
      system: string;
      code: string;
    }>;
  }>;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: {
    reference: string;
  };
  effectiveDateTime?: string;
  effectivePeriod?: {
    start?: string;
    end?: string;
  };
  issued?: string;
  performer?: Array<{
    reference: string;
  }>;
  value?:
    | {
        value: number;
        unit: string;
        system: string;
        code: string;
      }
    | {
        coding: Array<{
          system: string;
          code: string;
          display?: string;
        }>;
      }
    | string;
  interpretation?: Array<{
    coding?: Array<{
      system: string;
      code: string;
    }>;
  }>;
  referenceRange?: Array<{
    low?: { value: number; unit: string };
    high?: { value: number; unit: string };
  }>;
  dataAbsentReason?: {
    coding?: Array<{
      system: string;
      code: string;
    }>;
  };
}

/**
 * Encounter resource (visit, admission, consultation).
 */
export interface Encounter extends FHIRResource {
  resourceType: "Encounter";
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  status: "planned" | "arrived" | "triaged" | "in-progress" | "onleave" | "finished" | "cancelled" | "entered-in-error" | "unknown";
  statusHistory?: Array<{
    status: string;
    period: {
      start: string;
      end?: string;
    };
  }>;
  class: {
    system: string;
    code: string;
  };
  type?: Array<{
    coding: Array<{
      system: string;
      code: string;
    }>;
  }>;
  subject: {
    reference: string;
  };
  participant?: Array<{
    role?: Array<{
      coding: Array<{
        system: string;
        code: string;
      }>;
    }>;
    individual?: {
      reference: string;
    };
  }>;
  period: {
    start: string;
    end?: string;
  };
  reason?: Array<{
    concept?: {
      coding: Array<{
        system: string;
        code: string;
      }>;
    };
  }>;
  serviceProvider?: {
    reference: string;
  };
  partOf?: {
    reference: string;
  };
}

/**
 * MedicationRequest resource (prescription).
 */
export interface MedicationRequest extends FHIRResource {
  resourceType: "MedicationRequest";
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  status: "active" | "on-hold" | "cancelled" | "completed" | "entered-in-error" | "draft" | "unknown";
  intent: "proposal" | "plan" | "order" | "original-order" | "reflex-order" | "filler-order" | "instance-order";
  medication: {
    reference: string;
  } | {
    concept: {
      coding: Array<{
        system: string;
        code: string;
      }>;
    };
  };
  subject: {
    reference: string;
  };
  encounter?: {
    reference: string;
  };
  authoredOn?: string;
  requester?: {
    reference: string;
  };
  dosageInstruction?: Array<{
    sequence?: number;
    text?: string;
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: string;
      };
    };
    route?: {
      coding: Array<{
        system: string;
        code: string;
      }>;
    };
    doseAndRate?: Array<{
      dose?: {
        value: number;
        unit: string;
      };
      rateQuantity?: {
        value: number;
        unit: string;
      };
    }>;
  }>;
  dispenseRequest?: {
    quantity?: {
      value: number;
      unit: string;
    };
    validityPeriod?: {
      start: string;
      end?: string;
    };
    numberOfRepeatsAllowed?: number;
  };
}

/**
 * DiagnosticReport resource (lab results, imaging).
 */
export interface DiagnosticReport extends FHIRResource {
  resourceType: "DiagnosticReport";
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  status: "registered" | "partial" | "preliminary" | "final" | "amended" | "corrected" | "appended" | "cancelled" | "entered-in-error" | "unknown";
  category?: Array<{
    coding: Array<{
      system: string;
      code: string;
    }>;
  }>;
  code: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  subject: {
    reference: string;
  };
  encounter?: {
    reference: string;
  };
  effectiveDateTime?: string;
  effectivePeriod?: {
    start: string;
    end?: string;
  };
  issued?: string;
  performer?: Array<{
    reference: string;
  }>;
  result?: Array<{
    reference: string;
  }>;
  media?: Array<{
    link?: {
      reference: string;
    };
  }>;
  conclusion?: string;
  conclusionCode?: Array<{
    coding: Array<{
      system: string;
      code: string;
    }>;
  }>;
}

/**
 * Procedure resource (surgical procedure, treatment).
 */
export interface Procedure extends FHIRResource {
  resourceType: "Procedure";
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  status: "preparation" | "in-progress" | "not-done" | "on-hold" | "stopped" | "completed" | "entered-in-error" | "unknown";
  statusReason?: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  category?: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  code: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  subject: {
    reference: string;
  };
  encounter?: {
    reference: string;
  };
  performedDateTime?: string;
  performedPeriod?: {
    start: string;
    end?: string;
  };
  performer?: Array<{
    function?: {
      coding: Array<{
        system: string;
        code: string;
      }>;
    };
    actor: {
      reference: string;
    };
  }>;
  reasonCode?: Array<{
    coding: Array<{
      system: string;
      code: string;
    }>;
  }>;
  location?: {
    reference: string;
  };
  outcome?: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
}

/**
 * Condition resource (diagnosis).
 */
export interface Condition extends FHIRResource {
  resourceType: "Condition";
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  clinicalStatus?: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  verificationStatus?: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  category?: Array<{
    coding: Array<{
      system: string;
      code: string;
    }>;
  }>;
  severity?: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  code: {
    coding: Array<{
      system: string;
      code: string;
    }>;
    text?: string;
  };
  subject: {
    reference: string;
  };
  encounter?: {
    reference: string;
  };
  onsetDateTime?: string;
  onsetAge?: {
    value: number;
    unit: string;
  };
  abatementDateTime?: string;
  recordedDate?: string;
  recorder?: {
    reference: string;
  };
  evidence?: Array<{
    code?: Array<{
      coding: Array<{
        system: string;
        code: string;
      }>;
    }>;
    detail?: Array<{
      reference: string;
    }>;
  }>;
}

/**
 * AllergyIntolerance resource.
 */
export interface AllergyIntolerance extends FHIRResource {
  resourceType: "AllergyIntolerance";
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  clinicalStatus?: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  verificationStatus: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  type?: "allergy" | "intolerance";
  category?: Array<"food" | "medication" | "environment" | "biologic">;
  criticality?: "low" | "high" | "unable-to-assess";
  code: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  patient: {
    reference: string;
  };
  encounter?: {
    reference: string;
  };
  onsetDateTime?: string;
  recordedDate?: string;
  lastOccurrence?: string;
  note?: Array<{
    text: string;
    time?: string;
  }>;
  reaction?: Array<{
    substance?: {
      coding: Array<{
        system: string;
        code: string;
      }>;
    };
    manifestation: Array<{
      coding: Array<{
        system: string;
        code: string;
      }>;
    }>;
    description?: string;
    onset?: string;
    severity?: "mild" | "moderate" | "severe";
    exposureRoute?: {
      coding: Array<{
        system: string;
        code: string;
      }>;
    };
    note?: Array<{
      text: string;
    }>;
  }>;
}

// ─── HL7 Message ────────────────────────────────────────────────────────────

/**
 * HL7 v2 message segment.
 */
export interface HL7Segment {
  id: string;
  fields: string[][];
  encoding: {
    fieldSeparator: string;
    componentSeparator: string;
    repetitionSeparator: string;
    escapeCharacter: string;
    subcomponentSeparator: string;
  };
}

/**
 * HL7 v2 message structure.
 */
export interface HL7Message {
  messageType: string;
  messageControlId: string;
  processingId: string;
  versionId: string;
  timestamp: string;
  sendingApplication?: string;
  sendingFacility?: string;
  receivingApplication?: string;
  receivingFacility?: string;
  segments: HL7Segment[];
}

// ─── Clinical Documents ─────────────────────────────────────────────────────

/**
 * Clinical document metadata.
 */
export interface ClinicalDocument {
  id: string;
  type: "CCD" | "consultation" | "discharge_summary" | "laboratory_report" | "imaging_study" | "procedure_note" | "other";
  patientId: string;
  encounterId?: string;
  title: string;
  content: string;
  contentType: "application/pdf" | "application/xml" | "text/plain" | "application/hl7-v2+er7";
  createdAt: string;
  createdBy?: string;
  effectiveDateTime?: string;
  confidentiality?: "N" | "R" | "V";
  metadata?: Record<string, unknown>;
}

// ─── Consent & Privacy ──────────────────────────────────────────────────────

/**
 * Consent purpose codes (HIPAA authorization).
 */
export type ConsentPurpose =
  | "TREATMENT"
  | "PAYMENT"
  | "OPERATIONS"
  | "RESEARCH"
  | "PATIENT_REQUESTED"
  | "LEGAL"
  | "EMERGENCY"
  | "OTHER";

/**
 * Consent record for PHI access authorization.
 */
export interface ConsentRecord {
  id: string;
  patientId: string;
  consentType: "OPT_IN" | "OPT_OUT";
  purpose: ConsentPurpose;
  grantedTo?: Array<{
    role: string;
    organizationId?: string;
  }>;
  validFrom: string;
  validUntil?: string;
  restrictions?: {
    dataTypes?: string[];
    excludeProviders?: string[];
    includeProviders?: string[];
  };
  signedAt?: string;
  signatureMethod?: "digital" | "wet" | "electronically_recorded";
  createdAt: string;
  revokedAt?: string;
}

// ─── Audit Logging (HIPAA) ──────────────────────────────────────────────────

/**
 * HIPAA audit log entry for PHI access.
 */
export interface AuditEntry {
  id: string;
  timestamp: string;
  eventId: string;
  eventType: "CREATE" | "READ" | "UPDATE" | "DELETE" | "EXPORT" | "PRINT" | "QUERY" | "ACCESS" | "AUTHENTICATE" | "AUTHORIZE";
  userId?: string;
  userEmail?: string;
  userRole?: string;
  resourceType: string;
  resourceId: string;
  patientId?: string;
  action: string;
  outcome: "SUCCESS" | "FAILURE";
  outcomeDescription?: string;
  ipAddress?: string;
  userAgent?: string;
  sourceApplication?: string;
  affectedSystems?: string[];
  dataClassification?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  details?: Record<string, unknown>;
}

// ─── Terminology Mapping ────────────────────────────────────────────────────

/**
 * Code system types supported.
 */
export type CodeSystem = "ICD-10" | "ICD-9" | "SNOMED-CT" | "LOINC" | "CPT" | "RxNorm" | "CVX" | "HL7-V3";

/**
 * Terminology mapping (code translation).
 */
export interface TerminologyMapping {
  sourceSystem: CodeSystem;
  sourceCode: string;
  sourceDisplay?: string;
  targetSystem: CodeSystem;
  targetCode: string;
  targetDisplay?: string;
  equivalence?: "equivalent" | "wider" | "narrower" | "inexact" | "unrelated";
  confidence?: number; // 0-1
  createdAt?: string;
  validFrom?: string;
  validUntil?: string;
}

// ─── Search & Query ─────────────────────────────────────────────────────────

/**
 * FHIR search parameters.
 */
export interface FHIRSearchParams {
  pageSize?: number;
  pageNumber?: number;
  sort?: string;
  summary?: "true" | "false" | "text" | "data" | "count";
  filters?: Record<string, string | string[]>;
  _include?: string[];
  _revinclude?: string[];
}

/**
 * FHIR search result bundle.
 */
export interface FHIRSearchResult<T extends FHIRResource = FHIRResource> {
  resourceType: "Bundle";
  type: "searchset";
  total: number;
  link?: Array<{
    relation: string;
    url: string;
  }>;
  entry: Array<{
    resource: T;
    search?: {
      mode: string;
      score?: number;
    };
  }>;
}

// ─── Batch Operations ───────────────────────────────────────────────────────

/**
 * Bulk data export parameters.
 */
export interface BulkExportParams {
  resourceType?: string;
  since?: string;
  type?: string[];
  groupId?: string;
  outputFormat?: "ndjson" | "csv";
  cancelledByUrl?: string;
}

/**
 * Bulk data export result.
 */
export interface BulkExportResult {
  transactionTime: string;
  outputUrl?: string;
  requiresAccessToken?: boolean;
  output: Array<{
    type: string;
    url: string;
    count?: number;
  }>;
  error?: Array<{
    type: string;
    url: string;
  }>;
}

// ─── SMART on FHIR OAuth ────────────────────────────────────────────────────

/**
 * SMART on FHIR launch parameters.
 */
export interface SMARTLaunchParams {
  launchUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  launch?: string;
  aud?: string;
}

/**
 * SMART context (patient, encounter, etc.).
 */
export interface SMARTContext {
  patientId?: string;
  encounterId?: string;
  userId?: string;
  needPatientBanner?: boolean;
  resourceId?: string;
  scope: string[];
}
