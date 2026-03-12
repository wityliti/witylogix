/**
 * Abstract Healthcare Adapter.
 *
 * Base class for healthcare provider integrations (Epic, Cerner, Allscripts).
 * Provides FHIR R4 CRUD operations, HL7 v2 parsing, PHI audit logging,
 * consent management, and terminology service integration.
 */

import type {
  HealthcareConfig,
  FHIRResource,
  FHIRSearchParams,
  FHIRSearchResult,
  Patient,
  Observation,
  Encounter,
  MedicationRequest,
  DiagnosticReport,
  Procedure,
  Condition,
  AllergyIntolerance,
  HL7Message,
  ClinicalDocument,
  ConsentRecord,
  ConsentPurpose,
  AuditEntry,
  TerminologyMapping,
  CodeSystem,
  BulkExportParams,
  BulkExportResult,
  SMARTLaunchParams,
  SMARTContext,
} from "./types.js";

// ─── Rate Limiter ───────────────────────────────────────────────────────────

/**
 * Token bucket rate limiter.
 */
class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private lastRefillTime: number;

  constructor(requestsPerSecond: number) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRate = requestsPerSecond;
    this.lastRefillTime = Date.now();
  }

  async waitForToken(): Promise<void> {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTime) / 1000;
    this.lastRefillTime = now;
    this.tokens = Math.min(this.maxTokens, this.tokens + timePassed * this.refillRate);

    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate;
      await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

// ─── Circuit Breaker ────────────────────────────────────────────────────────

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

/**
 * Circuit breaker for fault tolerance.
 */
class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private lastFailureTime: number = 0;

  constructor(threshold: number = 5, resetTimeoutMs: number = 60000) {
    this.failureThreshold = threshold;
    this.resetTimeout = resetTimeoutMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await fn();
      if (this.state === "HALF_OPEN") {
        this.state = "CLOSED";
        this.failureCount = 0;
      }
      return result;
    } catch (error) {
      this.failureCount += 1;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = "OPEN";
      }

      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// ─── Retry Handler ──────────────────────────────────────────────────────────

/**
 * Exponential backoff retry handler.
 */
class RetryHandler {
  private readonly maxAttempts: number;
  private readonly backoffMultiplier: number;
  private readonly initialDelayMs: number;

  constructor(maxAttempts: number = 3, backoffMultiplier: number = 2, initialDelayMs: number = 100) {
    this.maxAttempts = maxAttempts;
    this.backoffMultiplier = backoffMultiplier;
    this.initialDelayMs = initialDelayMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxAttempts - 1) {
          const delayMs = this.initialDelayMs * Math.pow(this.backoffMultiplier, attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError || new Error("Retry handler failed");
  }
}

// ─── Abstract Healthcare Adapter ────────────────────────────────────────────

/**
 * Abstract base class for healthcare provider adapters.
 */
export abstract class HealthcareAdapter {
  /** Provider name (e.g., "epic", "cerner", "allscripts") */
  abstract readonly provider: string;

  /** Configuration */
  protected config: HealthcareConfig;

  /** Rate limiter instance */
  protected rateLimiter: RateLimiter;

  /** Circuit breaker instance */
  protected circuitBreaker: CircuitBreaker;

  /** Retry handler instance */
  protected retryHandler: RetryHandler;

  constructor(config: HealthcareConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimit || 10);
    this.circuitBreaker = new CircuitBreaker(config.circuitBreakerThreshold || 5);
    this.retryHandler = new RetryHandler(config.retryMaxAttempts || 3, config.retryBackoffMultiplier || 2);
  }

  // ─── FHIR CRUD Operations ───────────────────────────────────────────────

  /**
   * Create a FHIR resource.
   */
  abstract create<T extends FHIRResource>(resourceType: string, resource: Omit<T, "id">): Promise<T>;

  /**
   * Read a FHIR resource by ID.
   */
  abstract read<T extends FHIRResource>(resourceType: string, id: string): Promise<T>;

  /**
   * Update a FHIR resource.
   */
  abstract update<T extends FHIRResource>(resourceType: string, id: string, resource: Partial<T>): Promise<T>;

  /**
   * Delete a FHIR resource.
   */
  abstract delete(resourceType: string, id: string): Promise<void>;

  /**
   * Search for FHIR resources.
   */
  abstract search<T extends FHIRResource>(
    resourceType: string,
    params: FHIRSearchParams
  ): Promise<FHIRSearchResult<T>>;

  // ─── Specific Resource Operations ────────────────────────────────────────

  /**
   * Get patient by ID.
   */
  async getPatient(patientId: string): Promise<Patient> {
    return this.read<Patient>("Patient", patientId);
  }

  /**
   * Get observations for a patient.
   */
  async getObservations(patientId: string, params?: FHIRSearchParams): Promise<FHIRSearchResult<Observation>> {
    return this.search<Observation>("Observation", {
      ...params,
      filters: {
        ...params?.filters,
        "subject:Patient": patientId,
      },
    });
  }

  /**
   * Get encounters for a patient.
   */
  async getEncounters(patientId: string, params?: FHIRSearchParams): Promise<FHIRSearchResult<Encounter>> {
    return this.search<Encounter>("Encounter", {
      ...params,
      filters: {
        ...params?.filters,
        patient: patientId,
      },
    });
  }

  /**
   * Get medication requests for a patient.
   */
  async getMedicationRequests(patientId: string, params?: FHIRSearchParams): Promise<FHIRSearchResult<MedicationRequest>> {
    return this.search<MedicationRequest>("MedicationRequest", {
      ...params,
      filters: {
        ...params?.filters,
        patient: patientId,
      },
    });
  }

  /**
   * Get diagnostic reports for a patient.
   */
  async getDiagnosticReports(patientId: string, params?: FHIRSearchParams): Promise<FHIRSearchResult<DiagnosticReport>> {
    return this.search<DiagnosticReport>("DiagnosticReport", {
      ...params,
      filters: {
        ...params?.filters,
        subject: patientId,
      },
    });
  }

  /**
   * Get conditions (diagnoses) for a patient.
   */
  async getConditions(patientId: string, params?: FHIRSearchParams): Promise<FHIRSearchResult<Condition>> {
    return this.search<Condition>("Condition", {
      ...params,
      filters: {
        ...params?.filters,
        subject: patientId,
      },
    });
  }

  /**
   * Get allergy intolerances for a patient.
   */
  async getAllergies(patientId: string, params?: FHIRSearchParams): Promise<FHIRSearchResult<AllergyIntolerance>> {
    return this.search<AllergyIntolerance>("AllergyIntolerance", {
      ...params,
      filters: {
        ...params?.filters,
        patient: patientId,
      },
    });
  }

  // ─── HL7 v2 Message Operations ──────────────────────────────────────────

  /**
   * Parse an HL7 v2 message string.
   */
  abstract parseHL7Message(messageString: string): HL7Message;

  /**
   * Generate an HL7 v2 message string.
   */
  abstract generateHL7Message(message: HL7Message): string;

  // ─── Clinical Document Operations ───────────────────────────────────────

  /**
   * Get clinical documents (CCD, discharge summaries, etc.).
   */
  abstract getDocuments(patientId: string, params?: FHIRSearchParams): Promise<ClinicalDocument[]>;

  /**
   * Retrieve a specific clinical document.
   */
  abstract getDocument(documentId: string, format?: "pdf" | "xml" | "json"): Promise<ClinicalDocument>;

  // ─── Consent Management ─────────────────────────────────────────────────

  /**
   * Get active consents for a patient.
   */
  abstract getConsents(patientId: string): Promise<ConsentRecord[]>;

  /**
   * Create a new consent record.
   */
  abstract createConsent(consent: Omit<ConsentRecord, "id" | "createdAt">): Promise<ConsentRecord>;

  /**
   * Revoke a consent.
   */
  abstract revokeConsent(consentId: string): Promise<ConsentRecord>;

  /**
   * Check if patient has consented to a specific purpose.
   */
  async hasConsent(patientId: string, purpose: ConsentPurpose): Promise<boolean> {
    const consents = await this.getConsents(patientId);
    const now = new Date();

    return consents.some(
      (c) =>
        c.patientId === patientId &&
        c.purpose === purpose &&
        c.consentType === "OPT_IN" &&
        new Date(c.validFrom) <= now &&
        (!c.validUntil || new Date(c.validUntil) >= now) &&
        !c.revokedAt
    );
  }

  // ─── PHI Audit Logging (HIPAA) ──────────────────────────────────────────

  /**
   * Log a HIPAA audit event.
   */
  abstract logAuditEntry(entry: Omit<AuditEntry, "id" | "timestamp">): Promise<AuditEntry>;

  /**
   * Get audit logs for a patient.
   */
  abstract getAuditLogs(patientId: string, startDate?: string, endDate?: string): Promise<AuditEntry[]>;

  /**
   * Protected audit logging wrapper for sensitive operations.
   */
  protected async auditOperation(
    eventType: AuditEntry["eventType"],
    resourceType: string,
    resourceId: string,
    patientId: string | undefined,
    details: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.auditLogging) {
      return;
    }

    try {
      await this.logAuditEntry({
        eventId: `${eventType}-${Date.now()}`,
        eventType,
        userId: details.userId as string | undefined,
        resourceType,
        resourceId,
        patientId,
        action: `${eventType} ${resourceType}`,
        outcome: "SUCCESS",
        sourceApplication: this.provider,
        dataClassification: "CONFIDENTIAL",
        details,
      });
    } catch (error) {
      console.error("Failed to log audit entry:", error);
    }
  }

  // ─── Terminology Service ────────────────────────────────────────────────

  /**
   * Get terminology mappings for a code.
   */
  abstract getTerminologyMapping(
    sourceSystem: CodeSystem,
    sourceCode: string,
    targetSystem: CodeSystem
  ): Promise<TerminologyMapping | null>;

  /**
   * Create a terminology mapping.
   */
  abstract createTerminologyMapping(mapping: Omit<TerminologyMapping, "createdAt">): Promise<TerminologyMapping>;

  /**
   * Translate a code between systems.
   */
  async translateCode(
    sourceSystem: CodeSystem,
    sourceCode: string,
    targetSystem: CodeSystem
  ): Promise<string | null> {
    const mapping = await this.getTerminologyMapping(sourceSystem, sourceCode, targetSystem);
    return mapping?.targetCode || null;
  }

  // ─── Bulk Data Operations ───────────────────────────────────────────────

  /**
   * Initiate a bulk FHIR export.
   */
  abstract bulkExport(params: BulkExportParams): Promise<BulkExportResult>;

  /**
   * Get bulk export status.
   */
  abstract getBulkExportStatus(exportId: string): Promise<BulkExportResult>;

  /**
   * Cancel a bulk export.
   */
  abstract cancelBulkExport(exportId: string): Promise<void>;

  // ─── SMART on FHIR OAuth ────────────────────────────────────────────────

  /**
   * Generate SMART launch URL.
   */
  abstract generateSMARTLaunchUrl(params: SMARTLaunchParams): string;

  /**
   * Exchange authorization code for access token.
   */
  abstract exchangeAuthorizationCode(code: string, codeVerifier?: string): Promise<{ accessToken: string; expiresIn: number; context?: SMARTContext }>;

  /**
   * Get SMART context from access token.
   */
  abstract getSMARTContext(accessToken: string): Promise<SMARTContext>;

  // ─── Configuration & Health Check ───────────────────────────────────────

  /**
   * Validate adapter configuration.
   */
  abstract validateConfig(): Promise<void>;

  /**
   * Perform health check.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.validateConfig();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Apply rate limiting before requests.
   */
  protected async applyRateLimit(): Promise<void> {
    await this.rateLimiter.waitForToken();
  }

  /**
   * Execute with circuit breaker protection.
   */
  protected async executeWithCircuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.execute(fn);
  }

  /**
   * Execute with automatic retry.
   */
  protected async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    return this.retryHandler.execute(fn);
  }
}

export { RateLimiter, CircuitBreaker, RetryHandler };
