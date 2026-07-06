/**
 * Healthcare FHIR v2 SDK Unified Types.
 *
 * Normalized types for Epic, Cerner, and Allscripts FHIR R4 clients.
 * Provides consistent interfaces across all three providers.
 */

/**
 * SDK configuration shared across all healthcare providers.
 */
export interface SDKConfig {
  /** Provider name: "epic", "cerner", "allscripts" */
  provider: "epic" | "cerner" | "allscripts";

  /** Base URL for the provider API */
  baseUrl: string;

  /** OAuth2 client ID */
  clientId: string;

  /** OAuth2 client secret */
  clientSecret: string;

  /** OAuth2 token endpoint */
  tokenEndpoint: string;

  /** Tenant or organization ID (provider-specific) */
  tenantId?: string;

  /** Facility code (for multi-facility organizations) */
  facilityCode?: string;

  /** Rate limit: requests per second (default: 20) */
  rateLimit?: number;

  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelayMs: number;
  };

  /** Circuit breaker settings */
  circuitBreaker?: {
    failureThreshold: number;
    resetTimeoutMs: number;
  };

  /** Enable detailed logging */
  debug?: boolean;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Generic FHIR error response from provider APIs.
 */
export interface OperationOutcome {
  resourceType: "OperationOutcome";
  issue: Array<{
    severity: "fatal" | "error" | "warning" | "information";
    code: string;
    details?: {
      coding?: Array<{
        system: string;
        code: string;
        display?: string;
      }>;
      text?: string;
    };
    diagnostics?: string;
    location?: string[];
    expression?: string[];
  }>;
}

/**
 * Generic FHIR Resource response wrapper.
 */
export interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  text?: {
    status: "generated" | "extensions" | "additional" | "empty";
    div: string;
  };
}

/**
 * Generic FHIR Bundle for search results.
 */
export interface FHIRBundle<T extends FHIRResource = FHIRResource> {
  resourceType: "Bundle";
  type: "searchset" | "transaction" | "batch";
  total: number;
  link?: Array<{
    relation: "self" | "first" | "previous" | "next" | "last";
    url: string;
  }>;
  entry: Array<{
    resource: T;
    search?: {
      mode: "match" | "include" | "outcome";
      score?: number;
    };
  }>;
}

/**
 * Normalized Patient across Epic, Cerner, and Allscripts.
 */
export interface NormalizedPatient extends FHIRResource {
  resourceType: "Patient";
  id: string;
  identifier: Array<{
    system: string;
    value: string;
    use?: string;
  }>;
  name: Array<{
    use?:
      | "usual"
      | "official"
      | "temp"
      | "nickname"
      | "anonymous"
      | "old"
      | "maiden";
    given?: string[];
    family?: string;
    prefix?: string[];
    suffix?: string[];
  }>;
  telecom?: Array<{
    system: "phone" | "fax" | "email" | "pager" | "url" | "sms" | "other";
    value: string;
    use?: "home" | "work" | "temp" | "old" | "mobile";
  }>;
  gender?: "male" | "female" | "other" | "unknown";
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: Array<{
    use?: "home" | "work" | "temp" | "old" | "billing";
    type?: "postal" | "physical" | "both";
    text?: string;
    line?: string[];
    city?: string;
    district?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    period?: {
      start?: string;
      end?: string;
    };
  }>;
  maritalStatus?: {
    coding?: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  };
  contact?: Array<{
    relationship?: Array<{
      coding?: Array<{
        system: string;
        code: string;
        display?: string;
      }>;
      text?: string;
    }>;
    name?: {
      given?: string[];
      family?: string;
    };
    telecom?: Array<{
      system: string;
      value: string;
      use?: string;
    }>;
    address?: {
      line?: string[];
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  }>;
}

/**
 * Normalized Encounter across all providers.
 */
export interface NormalizedEncounter extends FHIRResource {
  resourceType: "Encounter";
  id: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  status:
    | "planned"
    | "arrived"
    | "triaged"
    | "in-progress"
    | "onleave"
    | "finished"
    | "cancelled";
  class: {
    system: string;
    code: string;
    display?: string;
  };
  type?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  }>;
  subject?: {
    reference: string;
    type?: string;
    identifier?: {
      system: string;
      value: string;
    };
  };
  period: {
    start: string;
    end?: string;
  };
  serviceProvider?: {
    reference: string;
    display?: string;
  };
  participant?: Array<{
    type?: Array<{
      coding: Array<{
        system: string;
        code: string;
      }>;
    }>;
    individual?: {
      reference: string;
      display?: string;
    };
  }>;
  reason?: Array<{
    concept?: {
      coding: Array<{
        system: string;
        code: string;
        display?: string;
      }>;
      text?: string;
    };
  }>;
}

/**
 * Normalized Observation (vital signs, labs) across all providers.
 */
export interface NormalizedObservation extends FHIRResource {
  resourceType: "Observation";
  id: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  status:
    | "registered"
    | "preliminary"
    | "final"
    | "amended"
    | "cancelled"
    | "entered-in-error"
    | "unknown";
  category?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  }>;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  };
  subject?: {
    reference: string;
    type?: string;
  };
  encounter?: {
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
    display?: string;
  }>;
  value?:
    | {
        value: number;
        comparator?: "<" | "<=" | ">=" | ">";
        unit?: string;
        system?: string;
        code?: string;
      }
    | {
        coding: Array<{
          system: string;
          code: string;
          display?: string;
        }>;
        text?: string;
      }
    | string
    | boolean;
  dataAbsentReason?: {
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
  };
  interpretation?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
  }>;
  referenceRange?: Array<{
    low?: {
      value: number;
      unit?: string;
    };
    high?: {
      value: number;
      unit?: string;
    };
    text?: string;
  }>;
}

/**
 * Normalized Condition (diagnosis) across all providers.
 */
export interface NormalizedCondition extends FHIRResource {
  resourceType: "Condition";
  id: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  clinicalStatus?: {
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
  };
  verificationStatus?: {
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
  };
  category?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
  }>;
  severity?: {
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
  };
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
    type?: string;
  };
  encounter?: {
    reference: string;
  };
  onsetDateTime?: string;
  abatementDateTime?: string;
  recordedDate?: string;
  recorder?: {
    reference: string;
    display?: string;
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
 * Normalized Medication/MedicationRequest across all providers.
 */
export interface NormalizedMedication extends FHIRResource {
  resourceType: "MedicationRequest" | "MedicationStatement";
  id: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  status:
    | "active"
    | "on-hold"
    | "cancelled"
    | "completed"
    | "entered-in-error"
    | "draft"
    | "stopped"
    | "unknown";
  intent?:
    | "proposal"
    | "plan"
    | "order"
    | "original-order"
    | "reflex-order"
    | "filler-order"
    | "instance-order";
  medication: {
    reference?: string;
    concept?: {
      coding: Array<{
        system: string;
        code: string;
        display?: string;
      }>;
      text?: string;
    };
  };
  subject: {
    reference: string;
    type?: string;
  };
  encounter?: {
    reference: string;
  };
  authoredOn?: string;
  effectiveDateTime?: string;
  effectivePeriod?: {
    start?: string;
    end?: string;
  };
  requester?: {
    reference: string;
    display?: string;
  };
  dosageInstruction?: Array<{
    sequence?: number;
    text?: string;
    additionalInstruction?: Array<{
      coding: Array<{
        system: string;
        code: string;
      }>;
    }>;
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: "s" | "min" | "h" | "d" | "wk" | "mo" | "a";
      };
    };
    route?: {
      coding: Array<{
        system: string;
        code: string;
        display?: string;
      }>;
    };
    doseAndRate?: Array<{
      dose?: {
        value: number;
        unit?: string;
      };
    }>;
  }>;
}

/**
 * Bulk export operation result.
 */
export interface BulkExportResult {
  transactionTime: string;
  request: string;
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

/**
 * Rate limiter state for request throttling.
 */
export interface RateLimiterState {
  tokens: number;
  lastRefillTime: number;
  capacity: number;
  refillRate: number;
}

/**
 * Retry configuration result.
 */
export interface RetryConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelayMs: number;
  getDelayMs: (attempt: number) => number;
}

/**
 * OAuth2 token response.
 */
export interface OAuth2Token {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
  expiresAt: number;
}

/**
 * Healthcare SDK error with detailed context.
 */
export class HealthcareSDKError extends Error {
  public code: string;
  public statusCode: number;
  public provider: string;
  public context?: Record<string, unknown>;

  constructor(
    code: string,
    statusCode: number,
    provider: string,
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HealthcareSDKError";
    this.code = code;
    this.statusCode = statusCode;
    this.provider = provider;
    this.context = context;
    Object.setPrototypeOf(this, HealthcareSDKError.prototype);
  }
}
