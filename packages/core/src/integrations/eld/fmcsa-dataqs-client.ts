/**
 * FMCSA DataQs (Data Quality Services) API Client
 *
 * Complete implementation for FMCSA's Data Quality & Safety Services API
 * Authentication: API key (WebKey)
 * Base URL: https://public-api.safetydata.fmcsa.dot.gov
 * Rate Limit: 50 requests per minute
 *
 * Features:
 * - Carrier lookup: by DOT#, MC#, legal name search
 * - Safety Measurement System (SMS): BASIC scores
 * - Inspection data: roadside inspections, violations, OOS rates
 * - Crash data: reportable crashes, fatalities, injuries
 * - Census data: company info, fleet size, operation classification
 * - DataQs challenge: submit RoR (Request for Review)
 * - Insurance: active insurance/bond status, coverage amounts
 * - Operating authority: MC/FF/MX authority status
 * - Rate limiting: 50 req/min with caching (24h TTL for census)
 */

import type {
  FMCSACarrierProfile,
  FMCSASafetyRating,
  FMCSAInspection,
  FMCSACrash,
  FMCSACarrierLookupParams,
  FMCSACarrierSearchResponse,
  FMCSABasicScore,
  FMCSAInsurance,
  FMCSAOperatingAuthority,
  FMCSADataQsChallengeRequest,
} from "./eld-sdk-types.js";

// ─── FMCSA DataQs Client ────────────────────────────────

export class FMCSADataQsClient {
  private baseUrl: string;
  private apiKey: string;
  private cache: Map<string, { data: any; expiresAt: number }> = new Map();
  private rateLimitInfo = {
    requestsThisMinute: 0,
    resetTime: Date.now(),
  };

  constructor(apiKey: string, baseUrl?: string) {
    if (!apiKey) {
      throw new Error("FMCSA API key (WebKey) is required");
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl || "https://public-api.safetydata.fmcsa.dot.gov";
  }

  /**
   * Initialize and validate API key
   */
  async initialize(): Promise<void> {
    try {
      await this.makeRequest<any>("GET", "/Carrier/0/DOT");
      console.log("FMCSA DataQs initialized successfully");
    } catch (error) {
      throw new Error(`Failed to initialize FMCSA DataQs: ${String(error)}`);
    }
  }

  /**
   * Lookup carrier by DOT number
   */
  async lookupCarrierByDOT(dotNumber: string): Promise<FMCSACarrierProfile> {
    const cacheKey = `carrier-dot-${dotNumber}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached as FMCSACarrierProfile;
    }

    const response = await this.makeRequest<any>(
      "GET",
      `/Carrier/${dotNumber}/DOT`
    );

    const carrier = this.normalizeCarrierProfile(response);
    this.setInCache(cacheKey, carrier, 86400000); // 24h TTL

    return carrier;
  }

  /**
   * Lookup carrier by MC number
   */
  async lookupCarrierByMC(mcNumber: string): Promise<FMCSACarrierProfile> {
    const cacheKey = `carrier-mc-${mcNumber}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached as FMCSACarrierProfile;
    }

    const response = await this.makeRequest<any>(
      "GET",
      `/Carrier/${mcNumber}/MC`
    );

    const carrier = this.normalizeCarrierProfile(response);
    this.setInCache(cacheKey, carrier, 86400000);

    return carrier;
  }

  /**
   * Search for carriers by legal name
   */
  async searchCarriers(
    legalName: string,
    limit: number = 10
  ): Promise<FMCSACarrierSearchResponse> {
    const response = await this.makeRequest<any>(
      "GET",
      `/Carrier/Search/${encodeURIComponent(legalName)}`,
      { limit }
    );

    return {
      carriers: (response.SearchResults || []).map((c: any) =>
        this.normalizeCarrierProfile(c)
      ),
      totalResults: response.totalRecordCount || 0,
    };
  }

  /**
   * Get Safety Measurement System (SMS) BASIC scores
   */
  async getSMSBASICScores(dotNumber: string): Promise<FMCSASafetyRating> {
    const cacheKey = `sms-basics-${dotNumber}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached as FMCSASafetyRating;
    }

    const response = await this.makeRequest<any>(
      "GET",
      `/Carrier/${dotNumber}/SMS`
    );

    const rating = this.normalizeSafetyRating(response, dotNumber);
    this.setInCache(cacheKey, rating, 3600000); // 1h TTL for SMS

    return rating;
  }

  /**
   * Get roadside inspection data
   */
  async getRoadsideInspections(
    dotNumber: string,
    limit: number = 100
  ): Promise<FMCSAInspection[]> {
    const response = await this.makeRequest<any>(
      "GET",
      `/Carrier/${dotNumber}/Inspections`,
      { limit }
    );

    return (response.inspections || []).map((i: any) =>
      this.normalizeInspection(i, dotNumber)
    );
  }

  /**
   * Get crash data
   */
  async getCrashes(
    dotNumber: string,
    limit: number = 100
  ): Promise<FMCSACrash[]> {
    const response = await this.makeRequest<any>(
      "GET",
      `/Carrier/${dotNumber}/Crashes`,
      { limit }
    );

    return (response.crashes || []).map((c: any) =>
      this.normalizeCrash(c, dotNumber)
    );
  }

  /**
   * Get insurance status
   */
  async getInsuranceStatus(dotNumber: string): Promise<FMCSAInsurance> {
    const response = await this.makeRequest<any>(
      "GET",
      `/Carrier/${dotNumber}/Insurance`
    );

    return {
      dotNumber,
      insured: response.insured || false,
      activeBonds: (response.bonds || []).map((b: any) => ({
        bondType: b.type,
        bondAmount: b.amount,
        bondEffectiveDate: b.effectiveDate,
        bondExpirationDate: b.expirationDate,
      })),
      activeInsurancePolicies: (response.policies || []).map((p: any) => ({
        policyType: p.type,
        coverage: p.coverage,
        insurer: p.insurer,
        effectiveDate: p.effectiveDate,
        expirationDate: p.expirationDate,
      })),
      lastUpdatedDate: response.lastUpdated,
    };
  }

  /**
   * Get operating authority status
   */
  async getOperatingAuthority(dotNumber: string): Promise<FMCSAOperatingAuthority> {
    const response = await this.makeRequest<any>(
      "GET",
      `/Carrier/${dotNumber}/Authority`
    );

    return {
      dotNumber,
      mcNumber: response.mcNumber,
      fmcNumber: response.fmcNumber,
      mcAuthorityStatus: response.mcStatus || "Inactive",
      ffAuthorityStatus: response.ffStatus || "Inactive",
      authorityEffectiveDate: response.effectiveDate,
      authorityExpirationDate: response.expirationDate,
      numberOfAuthorityDocuments: response.documentCount,
    };
  }

  /**
   * Submit Data Quality Services challenge (Request for Review)
   */
  async submitDataQsChallenge(
    dotNumber: string,
    dataElement: string,
    reason: string,
    supportingDocUrl?: string
  ): Promise<FMCSADataQsChallengeRequest> {
    const payload = {
      dotNumber,
      dataElement,
      reason,
      supportingDocumentationUrl: supportingDocUrl,
      submittedDate: new Date().toISOString(),
    };

    const response = await this.makeRequest<any>(
      "POST",
      `/Carrier/${dotNumber}/Challenge`,
      payload
    );

    return {
      dotNumber,
      challengeType: response.challengeType || "DataChallenge",
      dataElementId: dataElement,
      reason,
      supportingDocumentationUrl: supportingDocUrl,
      submittedDate: new Date().toISOString(),
      status: response.status || "Pending",
    };
  }

  /**
   * Get census data (company info, fleet size, etc.)
   */
  async getCensusData(dotNumber: string): Promise<Partial<FMCSACarrierProfile>> {
    const cacheKey = `census-${dotNumber}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    const response = await this.makeRequest<any>(
      "GET",
      `/Carrier/${dotNumber}/Census`
    );

    const censusData = {
      dotNumber,
      legalName: response.legalName,
      dbaName: response.dbaName,
      carrierType: response.carrierType,
      operationClassification: response.operationClassification,
      totalDrivers: response.totalDrivers,
      totalVehicles: response.totalVehicles,
      powerUnits: response.powerUnits,
      trailers: response.trailers,
      hazmatRegistered: response.hazmatRegistered,
      operatingStatus: response.operatingStatus,
    };

    this.setInCache(cacheKey, censusData, 86400000); // 24h TTL

    return censusData;
  }

  /**
   * Get Out of Service (OOS) violation rates
   */
  async getOOSRates(dotNumber: string): Promise<{
    driverOOSRate: number;
    vehicleOOSRate: number;
    hazmatOOSRate: number;
  }> {
    const response = await this.makeRequest<any>(
      "GET",
      `/Carrier/${dotNumber}/OOS`
    );

    return {
      driverOOSRate: response.driverOOSRate || 0,
      vehicleOOSRate: response.vehicleOOSRate || 0,
      hazmatOOSRate: response.hazmatOOSRate || 0,
    };
  }

  /**
   * Bulk lookup carriers
   */
  async bulkLookup(dotNumbers: string[]): Promise<FMCSACarrierProfile[]> {
    const carriers: FMCSACarrierProfile[] = [];

    for (const dotNumber of dotNumbers) {
      try {
        const carrier = await this.lookupCarrierByDOT(dotNumber);
        carriers.push(carrier);

        // Rate limit: max 50 req/min = ~833ms per request
        await this.rateLimitDelay();
      } catch (error) {
        console.error(`Failed to lookup DOT ${dotNumber}:`, error);
      }
    }

    return carriers;
  }

  /**
   * Get comprehensive carrier profile
   */
  async getComprehensiveProfile(
    dotNumber: string
  ): Promise<{
    carrier: FMCSACarrierProfile;
    safetyRating: FMCSASafetyRating;
    inspections: FMCSAInspection[];
    crashes: FMCSACrash[];
    insurance: FMCSAInsurance;
    authority: FMCSAOperatingAuthority;
  }> {
    const [carrier, safetyRating, inspections, crashes, insurance, authority] =
      await Promise.all([
        this.lookupCarrierByDOT(dotNumber),
        this.getSMSBASICScores(dotNumber),
        this.getRoadsideInspections(dotNumber),
        this.getCrashes(dotNumber),
        this.getInsuranceStatus(dotNumber),
        this.getOperatingAuthority(dotNumber),
      ]);

    return {
      carrier,
      safetyRating,
      inspections,
      crashes,
      insurance,
      authority,
    };
  }

  // ─── Private Helper Methods ──────────────────────────

  private async makeRequest<T>(
    method: string,
    path: string,
    params?: Record<string, any>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (method === "GET" && params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    url.searchParams.append("WebKey", this.apiKey);

    const options: RequestInit = {
      method,
      headers: {
        "Accept": "application/json",
      },
    };

    if (method !== "GET" && params) {
      options.headers = {
        ...options.headers,
        "Content-Type": "application/json",
      };
      options.body = JSON.stringify(params);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`FMCSA API error: ${response.status} ${error}`);
    }

    this.trackRateLimit();

    return response.json();
  }

  private trackRateLimit(): void {
    const now = Date.now();
    const resetTime = this.rateLimitInfo.resetTime + 60000;

    if (now > resetTime) {
      this.rateLimitInfo.requestsThisMinute = 1;
      this.rateLimitInfo.resetTime = now;
    } else {
      this.rateLimitInfo.requestsThisMinute++;
    }
  }

  private async rateLimitDelay(): Promise<void> {
    // 50 req/min = max 50 requests in 60 seconds
    // If we've made requests, calculate delay
    if (this.rateLimitInfo.requestsThisMinute > 0) {
      const avgDelay = 60000 / 50; // ~1200ms per request
      const delay = Math.max(0, avgDelay - (Date.now() - this.rateLimitInfo.resetTime) / this.rateLimitInfo.requestsThisMinute);

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setInCache(key: string, data: any, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  private normalizeCarrierProfile(data: any): FMCSACarrierProfile {
    return {
      dotNumber: data.dotNumber || data.DOTNumber || "",
      mcNumber: data.mcNumber || data.MCNumber,
      fmcNumber: data.fmcNumber || data.FMCNumber,
      legalName: data.legalName || data.LegalName || "",
      dbaName: data.dbaName || data.dbaName,
      addressLine1: data.addressLine1 || data.Address1 || "",
      addressLine2: data.addressLine2 || data.Address2,
      city: data.city || data.City || "",
      state: data.state || data.State || "",
      zipCode: data.zipCode || data.ZipCode || "",
      country: data.country || "US",
      phoneNumber: data.phoneNumber,
      operatingStatus: data.operatingStatus || "Unknown",
      operationClassification: data.operationClassification || "Exempt",
      carrierType: data.carrierType || "Motor Carrier",
      totalDrivers: data.totalDrivers,
      totalVehicles: data.totalVehicles,
      powerUnits: data.powerUnits,
      trailers: data.trailers,
      hazmatRegistered: data.hazmatRegistered,
    };
  }

  private normalizeSafetyRating(data: any, dotNumber: string): FMCSASafetyRating {
    const basicsArray = (data.BASICs || data.basics || []).map(
      (b: any): FMCSABasicScore => ({
        basicNumber: b.basicNumber || b.BasicNumber || 0,
        basicName: b.basicName || b.BasicName || "",
        weight: b.weight || 1,
        score: b.score || b.Score || 0,
        percentile: b.percentile,
      })
    );

    return {
      dotNumber,
      safetyRating: data.safetyRating || data.SafetyRating || "Unrated",
      safetyRatingDate: data.safetyRatingDate,
      basics: basicsArray,
      crashIndicators: data.crashIndicators
        ? {
            rateable: data.crashIndicators.rateable,
            rate: data.crashIndicators.rate,
            percentile: data.crashIndicators.percentile,
          }
        : undefined,
      smsOverallRating: data.smsOverallRating
        ? {
            numOfInspections: data.smsOverallRating.numOfInspections,
            numOfViolations: data.smsOverallRating.numOfViolations,
            weightedScore: data.smsOverallRating.weightedScore,
            percentile: data.smsOverallRating.percentile,
          }
        : undefined,
    };
  }

  private normalizeInspection(data: any, dotNumber: string): FMCSAInspection {
    return {
      inspectionId: data.inspectionId || data.id || "",
      dotNumber,
      inspectionDate: data.inspectionDate || "",
      inspectionType: data.inspectionType || "vehicle",
      violationCount: data.violationCount || 0,
      outOfServiceCount: data.outOfServiceCount || 0,
      violations: (data.violations || []).map((v: any) => ({
        violationCode: v.code,
        violationDescription: v.description,
        severity: v.severity || "warning",
      })),
      state: data.state || "",
      roadwayType: data.roadwayType,
    };
  }

  private normalizeCrash(data: any, dotNumber: string): FMCSACrash {
    return {
      crashId: data.crashId || data.id || "",
      dotNumber,
      crashDate: data.crashDate || "",
      crashLocation: data.crashLocation,
      crashState: data.crashState,
      fatalityCount: data.fatalityCount || 0,
      injuryCount: data.injuryCount || 0,
      vehiclesInvolved: data.vehiclesInvolved || 0,
      reportable: data.reportable || false,
    };
  }
}

// ─── Error Types ────────────────────────────────────────

export class FMCSADataQsError extends Error {
  constructor(
    public statusCode: number,
    public body: string
  ) {
    super(`FMCSA DataQs Error ${statusCode}: ${body}`);
  }
}
