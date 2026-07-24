/**
 * Allscripts Unity API Client
 *
 * Implements HealthcareAdapter for Allscripts EHR integration.
 * Authentication: SSO token-based auth
 * API Base: https://api.allscripts.com/
 *
 * Features:
 * - SSO token authentication with session management
 * - Patient demographics and clinical data retrieval
 * - Prescription management (e-prescribe, refills)
 * - Lab results and orders
 * - Document management
 * - Task and workflow management
 * - HIPAA audit logging and consent tracking
 */

import { HealthcareAdapter } from "./healthcare-adapter.js";
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
  AuditEntry,
  TerminologyMapping,
  CodeSystem,
  BulkExportParams,
  BulkExportResult,
  SMARTLaunchParams,
  SMARTContext,
} from "./types.js";

/**
 * Allscripts Unity API Client.
 */
export class AllscriptsClient extends HealthcareAdapter {
  readonly provider = "allscripts";

  private baseUrl: string;
  private appId: string;
  private appSecret: string;
  private sessionToken?: string;
  private sessionExpiresAt?: number;

  constructor(config: HealthcareConfig) {
    super(config);
    this.baseUrl = config.baseUrl || "https://api.allscripts.com/";
    this.appId = (config.metadata?.appId as string) || "";
    this.appSecret = (config.metadata?.appSecret as string) || "";
  }

  async validateConfig(): Promise<void> {
    if (!this.baseUrl) {
      throw new Error("Allscripts base URL is required");
    }

    if (!this.appId || !this.appSecret) {
      throw new Error("Allscripts AppID and AppSecret are required");
    }

    if (!this.sessionToken) {
      try {
        await this.authenticateSSO();
      } catch (error) {
        throw new Error(
          `Failed to authenticate with Allscripts: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Authenticate and obtain SSO session token.
   */
  private async authenticateSSO(): Promise<void> {
    const body = {
      appId: this.appId,
      appSecret: this.appSecret,
      timestamp: Math.floor(Date.now() / 1000),
    };

    try {
      const response = (await fetch(
        `${this.baseUrl}Authentication/Authenticate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      ).then((r) => r.json())) as any;

      if (response.IsSuccessful) {
        this.sessionToken = response.SessionToken;
        this.sessionExpiresAt =
          Date.now() + (response.SessionTokenExpireMinutes || 60) * 60 * 1000;
      } else {
        throw new Error(response.ErrorMessage || "SSO authentication failed");
      }
    } catch (error) {
      throw new Error(
        `Allscripts SSO authentication error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Refresh session token if expired.
   */
  private async ensureValidSession(): Promise<void> {
    if (
      !this.sessionToken ||
      !this.sessionExpiresAt ||
      Date.now() >= this.sessionExpiresAt - 60000
    ) {
      await this.authenticateSSO();
    }
  }

  /**
   * Make authenticated HTTP request to Allscripts API.
   */
  private async request(
    method: string,
    endpoint: string,
    options: {
      body?: unknown;
      query?: Record<string, string | string[] | number>;
    },
  ): Promise<unknown> {
    await this.applyRateLimit();
    await this.ensureValidSession();

    const url = new URL(endpoint, this.baseUrl);
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, String(v)));
        } else {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      AppId: this.appId,
      SessionToken: this.sessionToken || "",
    };

    return this.executeWithCircuitBreaker(async () =>
      this.executeWithRetry(async () => {
        // INTEGRATION: Actual HTTP call to Allscripts API
        const response = await fetch(url.toString(), {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(
            `Allscripts API error (${response.status}): ${error}`,
          );
        }

        return response.json();
      }),
    );
  }

  // ─── FHIR CRUD Operations ───────────────────────────────────────────────

  async create<T extends FHIRResource>(
    resourceType: string,
    resource: Omit<T, "id">,
  ): Promise<T> {
    // Allscripts uses its own API, convert FHIR to Allscripts format
    const result = (await this.request("POST", `/api/${resourceType}`, {
      body: resource,
    })) as T;
    await this.auditOperation(
      "CREATE",
      resourceType,
      result.id || "unknown",
      undefined,
      { resourceType },
    );
    return result;
  }

  async read<T extends FHIRResource>(
    resourceType: string,
    id: string,
  ): Promise<T> {
    const result = (await this.request(
      "GET",
      `/api/${resourceType}/${id}`,
      {},
    )) as T;
    await this.auditOperation("READ", resourceType, id, undefined, {
      resourceType,
    });
    return result;
  }

  async update<T extends FHIRResource>(
    resourceType: string,
    id: string,
    resource: Partial<T>,
  ): Promise<T> {
    const result = (await this.request("PUT", `/api/${resourceType}/${id}`, {
      body: resource,
    })) as T;
    await this.auditOperation("UPDATE", resourceType, id, undefined, {
      resourceType,
    });
    return result;
  }

  async delete(resourceType: string, id: string): Promise<void> {
    await this.request("DELETE", `/api/${resourceType}/${id}`, {});
    await this.auditOperation("DELETE", resourceType, id, undefined, {
      resourceType,
    });
  }

  async search<T extends FHIRResource>(
    resourceType: string,
    params: FHIRSearchParams,
  ): Promise<FHIRSearchResult<T>> {
    const query: Record<string, string | string[] | number> = {};

    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        query[key] = value;
      });
    }

    if (params.pageSize) {
      query.pageSize = params.pageSize;
    }

    const result = (await this.request("GET", `/api/${resourceType}`, {
      query,
    })) as FHIRSearchResult<T>;
    await this.auditOperation("QUERY", resourceType, "", undefined, {
      filters: params.filters,
    });
    return result;
  }

  // ─── Prescription Management ────────────────────────────────────────────

  /**
   * Get e-prescriptions for a patient.
   */
  async getPrescriptions(patientId: string): Promise<MedicationRequest[]> {
    const result = await this.request(
      "GET",
      `/api/Prescriptions/${patientId}`,
      {},
    );
    return (result as any[]) || [];
  }

  /**
   * Send e-prescription.
   */
  async sendPrescription(
    patientId: string,
    medication: string,
    dosage: string,
    quantity: number,
    daysSupply: number,
    refillsAllowed: number,
  ): Promise<MedicationRequest> {
    const body = {
      patientId,
      medication,
      dosage,
      quantity,
      daysSupply,
      refillsAllowed,
      rxStatus: "sent",
    };

    const result = (await this.request("POST", "/api/Prescriptions", {
      body,
    })) as MedicationRequest;
    await this.auditOperation(
      "CREATE",
      "MedicationRequest",
      result.id || "",
      patientId,
      { medication, dosage },
    );
    return result;
  }

  /**
   * Refill a prescription.
   */
  async refillPrescription(
    prescriptionId: string,
    refillNumber: number = 1,
  ): Promise<MedicationRequest> {
    const body = { refillNumber };
    const result = (await this.request(
      "POST",
      `/api/Prescriptions/${prescriptionId}/Refill`,
      { body },
    )) as MedicationRequest;
    await this.auditOperation(
      "UPDATE",
      "MedicationRequest",
      prescriptionId,
      undefined,
      { refillNumber },
    );
    return result;
  }

  // ─── Lab Results & Orders ───────────────────────────────────────────────

  /**
   * Get lab results for a patient.
   */
  async getLabResults(
    patientId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<DiagnosticReport[]> {
    const query: Record<string, string | string[] | number> = {};

    if (startDate) {
      query.startDate = startDate;
    }

    if (endDate) {
      query.endDate = endDate;
    }

    const result = await this.request("GET", `/api/Labs/${patientId}`, {
      query,
    });
    return (result as any[]) || [];
  }

  /**
   * Order a lab test.
   */
  async orderLabTest(
    patientId: string,
    testCode: string,
    testName: string,
    orderingProvider: string,
  ): Promise<DiagnosticReport> {
    const body = {
      patientId,
      testCode,
      testName,
      orderingProvider,
      orderDate: new Date().toISOString(),
    };

    const result = (await this.request("POST", "/api/Labs/Order", {
      body,
    })) as DiagnosticReport;
    await this.auditOperation(
      "CREATE",
      "DiagnosticReport",
      result.id || "",
      patientId,
      { testCode, testName },
    );
    return result;
  }

  // ─── Document Management ────────────────────────────────────────────────

  async getDocuments(
    patientId: string,
    params?: FHIRSearchParams,
  ): Promise<ClinicalDocument[]> {
    const result = await this.request("GET", `/api/Documents/${patientId}`, {});
    return ((result as any[]) || []).map((doc) => ({
      id: doc.id,
      type: doc.type || "CCD",
      patientId,
      title: doc.description || "Document",
      content: doc.content || "",
      contentType: doc.mimeType || "application/pdf",
      createdAt: doc.createdDate,
      metadata: doc,
    }));
  }

  async getDocument(
    documentId: string,
    format: "pdf" | "xml" | "json" = "pdf",
  ): Promise<ClinicalDocument> {
    const result = (await this.request(
      "GET",
      `/api/Documents/${documentId}`,
      {},
    )) as any;

    return {
      id: result.id,
      type: result.type || "CCD",
      patientId: result.patientId || "",
      title: result.description || "Document",
      content: result.content || "",
      contentType:
        format === "pdf"
          ? "application/pdf"
          : format === "xml"
            ? "application/xml"
            : "text/plain",
      createdAt: result.createdDate,
      metadata: result,
    };
  }

  // ─── Consent Management ─────────────────────────────────────────────────

  async getConsents(patientId: string): Promise<ConsentRecord[]> {
    const result = await this.request("GET", `/api/Consents/${patientId}`, {});
    return ((result as any[]) || []).map((consent) => ({
      id: consent.id,
      patientId,
      consentType: consent.optIn ? "OPT_IN" : "OPT_OUT",
      purpose: consent.purpose || "TREATMENT",
      validFrom: consent.effectiveDate,
      createdAt: consent.createdDate,
      revokedAt: consent.revokedDate,
    }));
  }

  async createConsent(
    consent: Omit<ConsentRecord, "id" | "createdAt">,
  ): Promise<ConsentRecord> {
    const body = {
      patientId: consent.patientId,
      optIn: consent.consentType === "OPT_IN",
      purpose: consent.purpose,
      effectiveDate: consent.validFrom,
      expiryDate: consent.validUntil,
    };

    const result = (await this.request("POST", "/api/Consents", {
      body,
    })) as any;
    await this.auditOperation(
      "CREATE",
      "Consent",
      result.id,
      consent.patientId,
      { purpose: consent.purpose },
    );
    return {
      id: result.id,
      patientId: consent.patientId,
      consentType: consent.consentType,
      purpose: consent.purpose,
      validFrom: consent.validFrom,
      validUntil: consent.validUntil,
      createdAt: new Date().toISOString(),
    };
  }

  async revokeConsent(consentId: string): Promise<ConsentRecord> {
    const body = { revokedDate: new Date().toISOString() };
    const result = (await this.request(
      "PUT",
      `/api/Consents/${consentId}/Revoke`,
      { body },
    )) as any;
    await this.auditOperation("UPDATE", "Consent", consentId, undefined, {
      action: "revoke",
    });
    return {
      id: result.id,
      patientId: result.patientId,
      consentType: result.optIn ? "OPT_IN" : "OPT_OUT",
      purpose: result.purpose,
      validFrom: result.effectiveDate,
      revokedAt: result.revokedDate,
      createdAt: result.createdDate,
    };
  }

  // ─── PHI Audit Logging (HIPAA) ──────────────────────────────────────────

  async logAuditEntry(
    entry: Omit<AuditEntry, "id" | "timestamp">,
  ): Promise<AuditEntry> {
    const auditEvent: AuditEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    try {
      await this.request("POST", "/api/Audit/Log", { body: auditEvent });
    } catch (error) {
      console.error("Failed to log audit entry:", error);
    }

    return auditEvent;
  }

  async getAuditLogs(
    patientId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<AuditEntry[]> {
    const query: Record<string, string | string[] | number> = { patientId };

    if (startDate) {
      query.startDate = startDate;
    }

    if (endDate) {
      query.endDate = endDate;
    }

    const result = await this.request("GET", "/api/Audit/Logs", { query });
    return (result as any[]) || [];
  }

  // ─── Terminology Service ────────────────────────────────────────────────

  async getTerminologyMapping(
    sourceSystem: CodeSystem,
    sourceCode: string,
    targetSystem: CodeSystem,
  ): Promise<TerminologyMapping | null> {
    try {
      const result = (await this.request("GET", "/api/Terminology/Translate", {
        query: {
          sourceSystem,
          sourceCode,
          targetSystem,
        },
      })) as any;

      if (result?.targetCode) {
        return {
          sourceSystem,
          sourceCode,
          targetSystem,
          targetCode: result.targetCode,
          equivalence: "equivalent",
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async createTerminologyMapping(
    mapping: Omit<TerminologyMapping, "createdAt">,
  ): Promise<TerminologyMapping> {
    return {
      ...mapping,
      createdAt: new Date().toISOString(),
    };
  }

  // ─── Bulk Data Operations ───────────────────────────────────────────────

  async bulkExport(params: BulkExportParams): Promise<BulkExportResult> {
    const body = {
      resourceType: params.resourceType,
      since: params.since,
      outputFormat: params.outputFormat || "ndjson",
    };

    const response = (await this.request("POST", "/api/Export", {
      body,
    })) as any;

    return {
      transactionTime: new Date().toISOString(),
      outputUrl: response.exportUrl,
      requiresAccessToken: false,
      output: [
        {
          type: params.resourceType || "All",
          url: response.dataUrl,
          count: response.recordCount,
        },
      ],
    };
  }

  async getBulkExportStatus(exportId: string): Promise<BulkExportResult> {
    const response = (await this.request(
      "GET",
      `/api/Export/${exportId}`,
      {},
    )) as any;

    return {
      transactionTime: response.createdDate,
      outputUrl: response.exportUrl,
      requiresAccessToken: false,
      output: response.files || [],
    };
  }

  async cancelBulkExport(exportId: string): Promise<void> {
    await this.request("DELETE", `/api/Export/${exportId}`, {});
  }

  // ─── HL7 v2 Message Operations ──────────────────────────────────────────

  parseHL7Message(messageString: string): HL7Message {
    const lines = messageString.split("\n");
    if (!lines[0].startsWith("MSH")) {
      throw new Error("Invalid HL7 message: must start with MSH segment");
    }

    const mshFields = lines[0].split("|");

    return {
      messageType: mshFields[8] || "",
      messageControlId: mshFields[9] || "",
      processingId: mshFields[10] || "",
      versionId: mshFields[11] || "",
      timestamp: mshFields[6] || new Date().toISOString(),
      segments: [],
    };
  }

  generateHL7Message(message: HL7Message): string {
    return `MSH|^~\\&|${message.sendingApplication || ""}|${message.sendingFacility || ""}|${message.receivingApplication || ""}|${message.receivingFacility || ""}|${message.timestamp}||${message.messageType}|${message.messageControlId}|${message.processingId}|${message.versionId}|\n`;
  }

  // ─── SMART on FHIR OAuth ────────────────────────────────────────────────

  generateSMARTLaunchUrl(params: SMARTLaunchParams): string {
    const url = new URL(params.launchUrl);
    url.searchParams.set("client_id", params.clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("scope", params.scope);
    url.searchParams.set("state", params.state || "");

    if (params.launch) {
      url.searchParams.set("launch", params.launch);
    }

    return url.toString();
  }

  async exchangeAuthorizationCode(
    code: string,
    codeVerifier?: string,
  ): Promise<{
    accessToken: string;
    expiresIn: number;
    context?: SMARTContext;
  }> {
    throw new Error("SMART OAuth not implemented for Allscripts");
  }

  async getSMARTContext(accessToken: string): Promise<SMARTContext> {
    throw new Error("SMART context not applicable for Allscripts");
  }
}
