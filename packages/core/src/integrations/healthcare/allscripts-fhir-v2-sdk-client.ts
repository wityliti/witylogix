/**
 * Allscripts/Veradigm FHIR R4 v2 SDK Client.
 *
 * Production-grade implementation for Allscripts/Veradigm FHIR R4 API with Unity API bridge.
 * Supports OAuth2 authentication, FHIR resources, and legacy Unity API operations.
 *
 * Features:
 * - OAuth2 authentication
 * - SMART app launch support
 * - FHIR R4 resources (Patient, Encounter, Observation, Condition, etc.)
 * - Unity API bridge for non-FHIR operations
 * - Bulk data export ($export operation)
 * - Rate limiting (100 req/min), retry logic, circuit breaker
 * - Comprehensive error handling
 */

import { EventEmitter } from "events";
import type {
  SDKConfig,
  NormalizedPatient,
  NormalizedEncounter,
  NormalizedObservation,
  NormalizedCondition,
  NormalizedMedication,
  FHIRBundle,
  FHIRResource,
  OperationOutcome,
  BulkExportResult,
  OAuth2Token,
  RetryConfig,
  RateLimiterState,
} from "./healthcare-sdk-types.js";
import { HealthcareSDKError } from "./healthcare-sdk-types.js";

/**
 * Unity API operation result.
 */
export interface UnityApiResponse<T = unknown> {
  success: boolean;
  errorMessage?: string;
  data?: T;
}

/**
 * Allscripts FHIR v2 SDK Client.
 */
export class AllscriptsFhirV2SdkClient extends EventEmitter {
  private config: SDKConfig;
  private baseUrl: string;
  private unityBaseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private rateLimiter: RateLimiterState;
  private retryConfig: RetryConfig;
  private circuitBreakerFailures: number = 0;
  private circuitBreakerOpenUntil: number = 0;
  private requestQueue: Array<() => Promise<unknown>> = [];
  private processingQueue: boolean = false;

  constructor(config: SDKConfig) {
    super();

    if (!config.clientId || !config.clientSecret || !config.tokenEndpoint) {
      throw new Error("Allscripts SDK requires clientId, clientSecret, and tokenEndpoint");
    }

    this.config = {
      rateLimit: 100, // 100 req/min = ~1.67 req/sec
      ...config,
    };

    this.baseUrl = this.config.baseUrl;
    this.unityBaseUrl = (this.config.metadata?.unityBaseUrl as string) || this.baseUrl;
    this.rateLimiter = {
      tokens: this.config.rateLimit ?? 100,
      capacity: this.config.rateLimit ?? 100,
      refillRate: (this.config.rateLimit ?? 100) / 60, // Per second
      lastRefillTime: Date.now(),
    };

    this.retryConfig = {
      maxAttempts: config.retry?.maxAttempts ?? 3,
      backoffMultiplier: config.retry?.backoffMultiplier ?? 2,
      initialDelayMs: config.retry?.initialDelayMs ?? 100,
      getDelayMs: (attempt: number) =>
        (config.retry?.initialDelayMs ?? 100) *
        Math.pow(config.retry?.backoffMultiplier ?? 2, attempt - 1),
    };
  }

  /**
   * Get SMART authorization URL.
   */
  getSMARTAuthorizationUrl(redirectUri: string, scope: string = "patient/*.read launch"): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope,
      state: this.generateRandomState(),
    });

    return `${this.config.tokenEndpoint?.replace(/\/token$/, "")}/authorize?${params.toString()}`;
  }

  /**
   * Exchange code for token.
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuth2Token> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const token = await this.retryableRequest<OAuth2Token>(async () => {
      const response = await fetch(this.config.tokenEndpoint as string, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      return response.json() as Promise<OAuth2Token>;
    });

    this.accessToken = token.accessToken;
    this.refreshToken = token.refreshToken ?? null;
    this.tokenExpiresAt = Date.now() + token.expiresIn * 1000;

    return token;
  }

  /**
   * Search patients.
   */
  async searchPatients(params: Record<string, string>): Promise<FHIRBundle<NormalizedPatient>> {
    await this.ensureToken();

    const url = new URL(`${this.baseUrl}/Patient`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return this.makeRequest<FHIRBundle<NormalizedPatient>>(url.toString());
  }

  /**
   * Get patient.
   */
  async getPatient(patientId: string): Promise<NormalizedPatient> {
    await this.ensureToken();
    return this.makeRequest<NormalizedPatient>(`${this.baseUrl}/Patient/${patientId}`);
  }

  /**
   * Search encounters.
   */
  async searchEncounters(params: Record<string, string>): Promise<FHIRBundle<NormalizedEncounter>> {
    await this.ensureToken();

    const url = new URL(`${this.baseUrl}/Encounter`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return this.makeRequest<FHIRBundle<NormalizedEncounter>>(url.toString());
  }

  /**
   * Get encounter.
   */
  async getEncounter(encounterId: string): Promise<NormalizedEncounter> {
    await this.ensureToken();
    return this.makeRequest<NormalizedEncounter>(`${this.baseUrl}/Encounter/${encounterId}`);
  }

  /**
   * Search observations.
   */
  async searchObservations(
    params: Record<string, string>,
  ): Promise<FHIRBundle<NormalizedObservation>> {
    await this.ensureToken();

    const url = new URL(`${this.baseUrl}/Observation`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return this.makeRequest<FHIRBundle<NormalizedObservation>>(url.toString());
  }

  /**
   * Search conditions.
   */
  async searchConditions(params: Record<string, string>): Promise<FHIRBundle<NormalizedCondition>> {
    await this.ensureToken();

    const url = new URL(`${this.baseUrl}/Condition`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return this.makeRequest<FHIRBundle<NormalizedCondition>>(url.toString());
  }

  /**
   * Search medication statements.
   */
  async searchMedicationStatements(
    params: Record<string, string>,
  ): Promise<FHIRBundle<NormalizedMedication>> {
    await this.ensureToken();

    const url = new URL(`${this.baseUrl}/MedicationStatement`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return this.makeRequest<FHIRBundle<NormalizedMedication>>(url.toString());
  }

  /**
   * Search allergy intolerances.
   */
  async searchAllergyIntolerances(
    params: Record<string, string>,
  ): Promise<FHIRBundle<FHIRResource>> {
    await this.ensureToken();

    const url = new URL(`${this.baseUrl}/AllergyIntolerance`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return this.makeRequest<FHIRBundle<FHIRResource>>(url.toString());
  }

  /**
   * Search diagnostic reports.
   */
  async searchDiagnosticReports(
    params: Record<string, string>,
  ): Promise<FHIRBundle<FHIRResource>> {
    await this.ensureToken();

    const url = new URL(`${this.baseUrl}/DiagnosticReport`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return this.makeRequest<FHIRBundle<FHIRResource>>(url.toString());
  }

  /**
   * Search procedures.
   */
  async searchProcedures(params: Record<string, string>): Promise<FHIRBundle<FHIRResource>> {
    await this.ensureToken();

    const url = new URL(`${this.baseUrl}/Procedure`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return this.makeRequest<FHIRBundle<FHIRResource>>(url.toString());
  }

  /**
   * Search immunizations.
   */
  async searchImmunizations(params: Record<string, string>): Promise<FHIRBundle<FHIRResource>> {
    await this.ensureToken();

    const url = new URL(`${this.baseUrl}/Immunization`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return this.makeRequest<FHIRBundle<FHIRResource>>(url.toString());
  }

  /**
   * Search document references.
   */
  async searchDocumentReferences(
    params: Record<string, string>,
  ): Promise<FHIRBundle<FHIRResource>> {
    await this.ensureToken();

    const url = new URL(`${this.baseUrl}/DocumentReference`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return this.makeRequest<FHIRBundle<FHIRResource>>(url.toString());
  }

  /**
   * Search clinical impressions.
   */
  async searchClinicalImpressions(
    params: Record<string, string>,
  ): Promise<FHIRBundle<FHIRResource>> {
    await this.ensureToken();

    const url = new URL(`${this.baseUrl}/ClinicalImpression`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return this.makeRequest<FHIRBundle<FHIRResource>>(url.toString());
  }

  /**
   * Download binary document.
   */
  async downloadBinaryDocument(documentId: string): Promise<Blob> {
    await this.ensureToken();
    return this.makeRequestBlob(`${this.baseUrl}/Binary/${documentId}`);
  }

  /**
   * Unity API: Get patient activity (non-FHIR operation).
   */
  async getPatientActivity(
    patientId: string,
    days?: number,
  ): Promise<UnityApiResponse<unknown>> {
    await this.ensureToken();

    const url = new URL(`${this.unityBaseUrl}/GetPatientActivity`);
    url.searchParams.append("PatientID", patientId);
    if (days) {
      url.searchParams.append("Days", days.toString());
    }

    return this.makeUnityApiRequest<UnityApiResponse<unknown>>(url.toString());
  }

  /**
   * Unity API: Get providers list.
   */
  async getProviders(): Promise<UnityApiResponse<unknown>> {
    await this.ensureToken();

    const url = `${this.unityBaseUrl}/GetProviders`;
    return this.makeUnityApiRequest<UnityApiResponse<unknown>>(url);
  }

  /**
   * Unity API: Save clinical document.
   */
  async saveClinicalDocument(
    patientId: string,
    documentData: Record<string, unknown>,
  ): Promise<UnityApiResponse<unknown>> {
    await this.ensureToken();

    const url = `${this.unityBaseUrl}/SaveClinicalDocument`;

    return this.makeUnityApiRequest<UnityApiResponse<unknown>>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        PatientID: patientId,
        ...documentData,
      }),
    });
  }

  /**
   * Initiate bulk export.
   */
  async initiateBulkExport(resourceTypes?: string[], since?: string): Promise<string> {
    await this.ensureToken();

    let url = `${this.baseUrl}/$export`;
    const params = new URLSearchParams();

    if (resourceTypes && resourceTypes.length > 0) {
      params.append("_type", resourceTypes.join(","));
    }

    if (since) {
      params.append("_since", since);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/fhir+json",
        Prefer: "respond-async",
      },
    });

    if (!response.ok) {
      const outcome = await this.parseErrorResponse(response);
      throw this.createError("BULK_EXPORT_FAILED", response.status, outcome);
    }

    return response.headers.get("Content-Location") ?? "";
  }

  /**
   * Get bulk export status.
   */
  async getBulkExportStatus(statusUrl: string): Promise<BulkExportResult | null> {
    await this.ensureToken();

    const response = await fetch(statusUrl, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (response.status === 202) {
      return null;
    }

    if (!response.ok) {
      const outcome = await this.parseErrorResponse(response);
      throw this.createError("BULK_EXPORT_STATUS_FAILED", response.status, outcome);
    }

    return response.json() as Promise<BulkExportResult>;
  }

  /**
   * Private: Ensure token.
   */
  private async ensureToken(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      if (this.refreshToken) {
        await this.refreshAccessToken();
      } else {
        throw new Error("No valid token available. Call exchangeCodeForToken first.");
      }
    }
  }

  /**
   * Private: Refresh token.
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(this.config.tokenEndpoint as string, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const token = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    this.accessToken = token.access_token;
    if (token.refresh_token) {
      this.refreshToken = token.refresh_token;
    }
    this.tokenExpiresAt = Date.now() + token.expires_in * 1000;
  }

  /**
   * Private: Make FHIR request.
   */
  private async makeRequest<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.retryableRequest<T>(async () => {
            this.checkCircuitBreaker();
            await this.rateLimitWait();

            const response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                Accept: "application/fhir+json",
              },
            });

            if (!response.ok) {
              const outcome = await this.parseErrorResponse(response);
              throw this.createError("REQUEST_FAILED", response.status, outcome);
            }

            this.circuitBreakerFailures = 0;
            return response.json() as Promise<T>;
          });

          resolve(result);
        } catch (error) {
          this.circuitBreakerFailures++;
          reject(error);
        }
      });

      this.processRequestQueue();
    });
  }

  /**
   * Private: Make blob request.
   */
  private async makeRequestBlob(url: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.retryableRequest<Blob>(async () => {
            this.checkCircuitBreaker();
            await this.rateLimitWait();

            const response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
              },
            });

            if (!response.ok) {
              throw this.createError("BINARY_DOWNLOAD_FAILED", response.status, {
                resourceType: "OperationOutcome",
                issue: [],
              });
            }

            this.circuitBreakerFailures = 0;
            return response.blob();
          });

          resolve(result);
        } catch (error) {
          this.circuitBreakerFailures++;
          reject(error);
        }
      });

      this.processRequestQueue();
    });
  }

  /**
   * Private: Make Unity API request.
   */
  private async makeUnityApiRequest<T>(
    url: string,
    options?: RequestInit,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.retryableRequest<T>(async () => {
            this.checkCircuitBreaker();
            await this.rateLimitWait();

            const response = await fetch(url, {
              ...options,
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                ...options?.headers,
              },
            });

            if (!response.ok) {
              throw this.createError("UNITY_API_FAILED", response.status, {
                resourceType: "OperationOutcome",
                issue: [],
              });
            }

            this.circuitBreakerFailures = 0;
            return response.json() as Promise<T>;
          });

          resolve(result);
        } catch (error) {
          this.circuitBreakerFailures++;
          reject(error);
        }
      });

      this.processRequestQueue();
    });
  }

  /**
   * Private: Process queue.
   */
  private async processRequestQueue(): Promise<void> {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          this.emit("error", error);
        }
      }
    }

    this.processingQueue = false;
  }

  /**
   * Private: Retry logic.
   */
  private async retryableRequest<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === this.retryConfig.maxAttempts) {
          throw error;
        }

        const delayMs = this.retryConfig.getDelayMs(attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw new Error("Retry max attempts exceeded");
  }

  /**
   * Private: Rate limiting.
   */
  private async rateLimitWait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRefill = (now - this.rateLimiter.lastRefillTime) / 1000;
    const tokensToAdd = timeSinceLastRefill * this.rateLimiter.refillRate;

    this.rateLimiter.tokens = Math.min(
      this.rateLimiter.capacity,
      this.rateLimiter.tokens + tokensToAdd,
    );
    this.rateLimiter.lastRefillTime = now;

    if (this.rateLimiter.tokens < 1) {
      const waitTime = (1 - this.rateLimiter.tokens) / this.rateLimiter.refillRate;
      await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
      this.rateLimiter.tokens = 1;
    }

    this.rateLimiter.tokens -= 1;
  }

  /**
   * Private: Circuit breaker.
   */
  private checkCircuitBreaker(): void {
    const threshold = this.config.circuitBreaker?.failureThreshold ?? 5;
    const resetTimeout = this.config.circuitBreaker?.resetTimeoutMs ?? 60000;

    if (this.circuitBreakerFailures >= threshold) {
      if (Date.now() < this.circuitBreakerOpenUntil) {
        throw new Error("Circuit breaker is open");
      }

      this.circuitBreakerOpenUntil = Date.now() + resetTimeout;
    }
  }

  /**
   * Private: Parse error response.
   */
  private async parseErrorResponse(response: Response): Promise<OperationOutcome> {
    try {
      return (await response.json()) as OperationOutcome;
    } catch {
      return {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "processing",
            diagnostics: response.statusText,
          },
        ],
      };
    }
  }

  /**
   * Private: Create error.
   */
  private createError(
    code: string,
    statusCode: number,
    outcome: OperationOutcome,
  ): HealthcareSDKError {
    const message = outcome.issue?.[0]?.diagnostics ?? "Unknown error";
    const error = new HealthcareSDKError(code, statusCode, "allscripts", message);
    error.context = { outcome };
    return error;
  }

  /**
   * Private: Generate state.
   */
  private generateRandomState(): string {
    return "state_" + Math.random().toString(36).substring(2, 15);
  }
}
