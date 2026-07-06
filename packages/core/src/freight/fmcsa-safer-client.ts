/**
 * FMCSA SAFER System API Client
 * Integrates with Federal Motor Carrier Safety Administration SAFER database for carrier compliance verification
 * Provides safety ratings, inspection history, crash data, and insurance verification
 */

import {
  SafetyRating,
  CarrierCensus,
  InspectionRecord,
  CrashRecord,
  OperatingAuthority,
  InsuranceInfo,
} from "./freight-types";

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export interface FMCSASaferConfig {
  baseUrl: string;
  apiKey: string;
  rateLimit: number; // requests per minute
  cacheTTL: number; // seconds
}

export interface CarrierLookupRequest {
  dotNumber?: string;
  mcNumber?: string;
  companyName?: string;
}

export interface SafetyInspectionQuery {
  dotNumber: string;
  limit?: number; // max records
}

export interface CrashDataQuery {
  dotNumber: string;
  days?: number; // lookback period
}

// ────────────────────────────────────────────────────────────────────────────
// CACHE IMPLEMENTATION
// ────────────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SaferCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl * 1000;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// RATE LIMITER
// ────────────────────────────────────────────────────────────────────────────

class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(requestsPerMinute: number) {
    this.maxRequests = requestsPerMinute;
    this.windowMs = 60 * 1000; // 1 minute
  }

  async checkLimit(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.requests.push(now);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// FMCSA SAFER CLIENT
// ────────────────────────────────────────────────────────────────────────────

export class FMCSASaferClient {
  private config: FMCSASaferConfig;
  private cache: SaferCache;
  private rateLimiter: RateLimiter;

  constructor(config: FMCSASaferConfig) {
    this.config = config;
    this.cache = new SaferCache();
    this.rateLimiter = new RateLimiter(config.rateLimit);
  }

  /**
   * Look up carrier by DOT number, MC number, or company name
   */
  async lookupCarrier(
    request: CarrierLookupRequest,
  ): Promise<CarrierCensus | null> {
    const cacheKey = this.getCacheKey("census", request);
    const cached = this.cache.get<CarrierCensus>(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.checkLimit();

    try {
      const result = await this.fetchCarrierData(request);
      if (result) {
        this.cache.set(cacheKey, result, this.config.cacheTTL);
      }
      return result;
    } catch (error) {
      console.error("FMCSA lookup failed:", error);
      return null;
    }
  }

  /**
   * Get safety rating for carrier
   */
  async getSafetyRating(dotNumber: string): Promise<SafetyRating | null> {
    const cacheKey = this.getCacheKey("safety", { dotNumber });
    const cached = this.cache.get<SafetyRating>(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.checkLimit();

    try {
      const rating = await this.fetchSafetyRating(dotNumber);
      if (rating) {
        this.cache.set(cacheKey, rating, this.config.cacheTTL);
      }
      return rating;
    } catch (error) {
      console.error("Safety rating lookup failed:", error);
      return null;
    }
  }

  /**
   * Get inspection history for carrier
   */
  async getInspectionHistory(
    query: SafetyInspectionQuery,
  ): Promise<InspectionRecord[]> {
    const cacheKey = this.getCacheKey("inspections", query);
    const cached = this.cache.get<InspectionRecord[]>(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.checkLimit();

    try {
      const records = await this.fetchInspectionRecords(query);
      this.cache.set(cacheKey, records, this.config.cacheTTL);
      return records;
    } catch (error) {
      console.error("Inspection history lookup failed:", error);
      return [];
    }
  }

  /**
   * Get crash records for carrier
   */
  async getCrashData(query: CrashDataQuery): Promise<CrashRecord[]> {
    const cacheKey = this.getCacheKey("crashes", query);
    const cached = this.cache.get<CrashRecord[]>(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.checkLimit();

    try {
      const records = await this.fetchCrashRecords(query);
      this.cache.set(cacheKey, records, this.config.cacheTTL);
      return records;
    } catch (error) {
      console.error("Crash data lookup failed:", error);
      return [];
    }
  }

  /**
   * Verify insurance status and coverage
   */
  async verifyInsurance(dotNumber: string): Promise<InsuranceInfo | null> {
    const cacheKey = this.getCacheKey("insurance", { dotNumber });
    const cached = this.cache.get<InsuranceInfo>(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.checkLimit();

    try {
      const insurance = await this.fetchInsuranceInfo(dotNumber);
      if (insurance) {
        this.cache.set(cacheKey, insurance, this.config.cacheTTL);
      }
      return insurance;
    } catch (error) {
      console.error("Insurance verification failed:", error);
      return null;
    }
  }

  /**
   * Check operating authority status
   */
  async getOperatingAuthority(
    dotNumber: string,
  ): Promise<OperatingAuthority | null> {
    const cacheKey = this.getCacheKey("authority", { dotNumber });
    const cached = this.cache.get<OperatingAuthority>(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.checkLimit();

    try {
      const authority = await this.fetchOperatingAuthority(dotNumber);
      if (authority) {
        this.cache.set(cacheKey, authority, this.config.cacheTTL);
      }
      return authority;
    } catch (error) {
      console.error("Operating authority lookup failed:", error);
      return null;
    }
  }

  /**
   * Get census data (fleet size, driver count, mileage)
   */
  async getCensusData(
    dotNumber: string,
  ): Promise<Partial<CarrierCensus> | null> {
    const cacheKey = this.getCacheKey("census-full", { dotNumber });
    const cached = this.cache.get<Partial<CarrierCensus>>(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.checkLimit();

    try {
      const data = await this.fetchCensusData(dotNumber);
      if (data) {
        this.cache.set(cacheKey, data, this.config.cacheTTL);
      }
      return data;
    } catch (error) {
      console.error("Census data lookup failed:", error);
      return null;
    }
  }

  /**
   * Perform comprehensive carrier profile audit
   */
  async performCarrierAudit(dotNumber: string): Promise<{
    safetyRating: SafetyRating | null;
    insurance: InsuranceInfo | null;
    authority: OperatingAuthority | null;
    recentInspections: InspectionRecord[];
    recentCrashes: CrashRecord[];
    census: Partial<CarrierCensus> | null;
    complianceIssues: string[];
  }> {
    const [
      safetyRating,
      insurance,
      authority,
      recentInspections,
      recentCrashes,
      census,
    ] = await Promise.all([
      this.getSafetyRating(dotNumber),
      this.verifyInsurance(dotNumber),
      this.getOperatingAuthority(dotNumber),
      this.getInspectionHistory({ dotNumber, limit: 10 }),
      this.getCrashData({ dotNumber, days: 365 }),
      this.getCensusData(dotNumber),
    ]);

    const complianceIssues = this.identifyComplianceIssues({
      safetyRating,
      insurance,
      authority,
      recentInspections,
    });

    return {
      safetyRating,
      insurance,
      authority,
      recentInspections,
      recentCrashes,
      census,
      complianceIssues,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ──────────────────────────────────────────────────────────────────────────

  private getCacheKey(type: string, params: Record<string, any>): string {
    return `fmcsa:${type}:${JSON.stringify(params)}`;
  }

  private async fetchCarrierData(
    request: CarrierLookupRequest,
  ): Promise<CarrierCensus | null> {
    // Mock implementation - in production would call actual FMCSA API
    const dotNumber = request.dotNumber || "1234567";

    return {
      dotNumber,
      mcNumber: "MC" + dotNumber,
      companyName: request.companyName || "Sample Carrier",
      dbaName: undefined,
      address: {
        address: "123 Truck Lane",
        city: "Springfield",
        state: "IL",
        zip: "62701",
        country: "USA",
      },
      phoneNumber: "555-0123",
      fleetSize: 50,
      driverCount: 75,
      annualMileage: 2500000,
      operatingAuthority: {
        status: "active",
        mcNumber: "MC" + dotNumber,
        sinceDate: new Date("2015-01-15"),
        expiryDate: undefined,
        authority: ["common", "contract"],
        hazmat: true,
      },
      insurance: {
        bipd: {
          required: 750000,
          actual: 1000000,
          verified: true,
          expiryDate: new Date("2025-12-31"),
        },
        cargo: {
          required: 100000,
          actual: 250000,
          verified: true,
          expiryDate: new Date("2025-12-31"),
        },
        bond: {
          required: 10000,
          actual: 25000,
          verified: true,
          expiryDate: new Date("2025-12-31"),
        },
      },
      hireDate: new Date("2015-01-01"),
      censusDate: new Date(),
    };
  }

  private async fetchSafetyRating(
    dotNumber: string,
  ): Promise<SafetyRating | null> {
    // Mock implementation
    return {
      dotNumber,
      mcNumber: "MC" + dotNumber,
      companyName: "Sample Carrier",
      status: "satisfactory",
      ratingDate: new Date(),
      nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      inspectionCount: 12,
      inspectionDeficitPercentage: 5,
      crashCount: 2,
      outOfServiceRate: 0.5,
      unsafe: false,
      fitness: false,
      hos: false,
      drugs: false,
    };
  }

  private async fetchInspectionRecords(
    query: SafetyInspectionQuery,
  ): Promise<InspectionRecord[]> {
    // Mock implementation
    return [
      {
        inspectionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        location: "Springfield, IL",
        inspectorName: "John Smith",
        vehicleDefectsFound: 2,
        driverDefectsFound: 0,
        hazmatDefectsFound: 0,
        outOfService: false,
        violations: [
          {
            violationCode: "LLAD010",
            description: "Brake system defect",
            severity: "warning",
            corrected: true,
          },
        ],
      },
    ];
  }

  private async fetchCrashRecords(
    query: CrashDataQuery,
  ): Promise<CrashRecord[]> {
    // Mock implementation
    return [
      {
        crashDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        crashLocation: "I-55 near Springfield, IL",
        severity: "property",
        vehicles: 2,
        people: 3,
        injuries: 0,
        fatalities: 0,
      },
    ];
  }

  private async fetchInsuranceInfo(
    dotNumber: string,
  ): Promise<InsuranceInfo | null> {
    // Mock implementation
    const today = new Date();
    const expiryDate = new Date(
      today.getFullYear() + 1,
      today.getMonth(),
      today.getDate(),
    );

    return {
      bipd: {
        required: 750000,
        actual: 1000000,
        verified: true,
        expiryDate,
      },
      cargo: {
        required: 100000,
        actual: 250000,
        verified: true,
        expiryDate,
      },
      bond: {
        required: 10000,
        actual: 25000,
        verified: true,
        expiryDate,
      },
    };
  }

  private async fetchOperatingAuthority(
    dotNumber: string,
  ): Promise<OperatingAuthority | null> {
    // Mock implementation
    return {
      status: "active",
      mcNumber: "MC" + dotNumber,
      sinceDate: new Date("2015-01-01"),
      expiryDate: undefined,
      authority: ["common", "contract"],
      hazmat: true,
    };
  }

  private async fetchCensusData(
    dotNumber: string,
  ): Promise<Partial<CarrierCensus> | null> {
    // Mock implementation
    return {
      fleetSize: 50,
      driverCount: 75,
      annualMileage: 2500000,
    };
  }

  private identifyComplianceIssues(data: {
    safetyRating: SafetyRating | null;
    insurance: InsuranceInfo | null;
    authority: OperatingAuthority | null;
    recentInspections: InspectionRecord[];
  }): string[] {
    const issues: string[] = [];

    if (data.safetyRating?.status === "unsatisfactory") {
      issues.push("Safety rating is unsatisfactory");
    }

    if (data.safetyRating?.unsafe) {
      issues.push("Unsafe violations found");
    }

    if (data.safetyRating?.fitness === false) {
      issues.push("Fitness violations found");
    }

    if (
      data.insurance?.bipd &&
      data.insurance.bipd.actual < data.insurance.bipd.required
    ) {
      issues.push("BIPD insurance below required amount");
    }

    if (data.authority?.status !== "active") {
      issues.push(`Operating authority is ${data.authority?.status}`);
    }

    if (
      data.recentInspections.some((insp) =>
        insp.violations.some((v) => v.severity === "critical"),
      )
    ) {
      issues.push("Critical violations found in recent inspections");
    }

    return issues;
  }
}

/**
 * Factory function for creating FMCSA SAFER client
 */
export function createFMCSASaferClient(
  config: FMCSASaferConfig,
): FMCSASaferClient {
  return new FMCSASaferClient(config);
}
