/**
 * Comdata API v2 SDK Client
 *
 * API key + HMAC-SHA256 signature authentication for virtual MasterCard issuance,
 * real-time transaction streaming, bulk fuel purchasing, and fleet analytics.
 */

import { fetch as nodeFetch } from "node-fetch";
import type { Response } from "node-fetch";
import { createHmac } from "crypto";

import type {
  SDKConfig,
  SDKProvider,
  CardIssuanceRequest,
  CardLifecycleRequest,
  SpendingLimitConfig,
  RealTimeTransaction,
  TransactionSearchCriteria,
  TransactionDetail,
  WebhookEvent,
  WebhookEventType,
  FuelUsageAnalytics,
  ReportingParams,
  AuthToken,
  RateLimitInfo,
  SDKHealthStatus,
  VirtualCardIssuanceRequest,
  TransactionStatusCode,
  PaginatedResponse,
  APIErrorResponse,
} from "./fuel-fleet-sdk-types";

/**
 * Comdata API error class
 */
export class ComdataAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ComdataAPIError";
  }
}

/**
 * Comdata v2 SDK Client
 */
export class Comdatav2SDKClient {
  private config: SDKConfig;
  private rateLimitInfo: RateLimitInfo | null = null;
  private requestCount: number = 0;
  private windowStart: number = Date.now();
  private lastHealthCheck: Date = new Date();
  private failureCount: number = 0;

  constructor(config: SDKConfig) {
    this.config = config;
    this.validateConfig();
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (!this.config.baseUrl) {
      throw new Error("Comdata SDK requires baseUrl");
    }
    if (!this.config.apiKey || !this.config.apiSecret) {
      throw new Error("Comdata SDK requires apiKey and apiSecret for HMAC-SHA256");
    }
  }

  /**
   * Generate HMAC-SHA256 signature
   */
  private generateSignature(
    method: string,
    endpoint: string,
    body?: unknown,
    timestamp: number = Date.now()
  ): { signature: string; timestamp: number } {
    const bodyString = body ? JSON.stringify(body) : "";
    const payload = [method, endpoint, timestamp, bodyString].join("\n");

    const signature = createHmac("sha256", this.config.apiSecret!)
      .update(payload)
      .digest("hex");

    return { signature, timestamp };
  }

  /**
   * Make authenticated API request with HMAC signature
   */
  private async apiRequest<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    await this.checkRateLimit();

    const { signature, timestamp } = this.generateSignature(method, endpoint, body);
    const url = new URL(endpoint, this.config.baseUrl).toString();

    for (let attempt = 0; attempt < (this.config.retryConfig?.maxAttempts || 3); attempt++) {
      try {
        const response = (await nodeFetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": this.config.apiKey!,
            "X-Signature": signature,
            "X-Timestamp": String(timestamp),
            ...this.config.customHeaders,
          },
          body: body ? JSON.stringify(body) : undefined,
          timeout: this.config.timeout || 30000,
        })) as Response;

        this.updateRateLimitInfo(response);

        if (!response.ok) {
          const errorData = (await response.json()) as APIErrorResponse;
          throw new ComdataAPIError(
            errorData.code || `HTTP_${response.status}`,
            errorData.message || response.statusText,
            errorData.details
          );
        }

        const data = (await response.json()) as T;
        this.failureCount = 0;
        return data;
      } catch (error) {
        if (attempt === (this.config.retryConfig?.maxAttempts || 3) - 1) {
          this.failureCount += 1;
          throw error;
        }
        const delay = (this.config.retryConfig?.delayMs || 1000) * Math.pow(
          this.config.retryConfig?.backoffMultiplier || 2,
          attempt
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new ComdataAPIError("RETRY_EXHAUSTED", "All retry attempts exhausted");
  }

  /**
   * Check rate limits (500 requests/min)
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.windowStart;
    const windowMs = 60000; // 1 minute

    if (elapsed >= windowMs) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    const maxRequests = 500;
    if (this.requestCount >= maxRequests) {
      const retryAfter = Math.ceil((windowMs - elapsed) / 1000);
      throw new Error(`Rate limit exceeded (500/min). Retry after ${retryAfter}s`);
    }

    this.requestCount += 1;
  }

  /**
   * Update rate limit info from response headers
   */
  private updateRateLimitInfo(response: Response): void {
    const limit = response.headers.get("X-RateLimit-Limit");
    const remaining = response.headers.get("X-RateLimit-Remaining");
    const reset = response.headers.get("X-RateLimit-Reset");

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: new Date(parseInt(reset, 10) * 1000),
      };
    }
  }

  /**
   * Issue a virtual one-time use MasterCard
   */
  async issueVirtualCard(
    request: VirtualCardIssuanceRequest
  ): Promise<{ cardId: string; cardNumber: string; cvv: string; expiryDate: string }> {
    return this.apiRequest("POST", "/api/v2/cards/virtual/issue", {
      cardholderName: request.cardholderName,
      purpose: request.purpose,
      amount: request.amount,
      currency: request.currency,
      expiryMinutes: request.expiryMinutes,
      merchantRestrictions: request.merchantRestrictions,
      singleUseOnly: request.singleUseOnly,
      metadata: request.customMetadata,
    });
  }

  /**
   * Issue a fuel card and activate
   */
  async issueFuelCard(request: CardIssuanceRequest): Promise<{ cardId: string; cardNumber: string }> {
    return this.apiRequest("POST", "/api/v2/cards/fuel/issue", {
      cardholderName: request.cardholderName,
      driverId: request.driverId,
      vehicleId: request.vehicleId,
      limits: {
        daily: request.dailyLimit,
        weekly: request.weeklyLimit,
        monthly: request.monthlyLimit,
      },
      restrictions: {
        productCodes: request.productRestrictions,
      },
      metadata: request.customMetadata,
    });
  }

  /**
   * Activate fuel card
   */
  async activateFuelCard(cardId: string): Promise<{ status: string; activatedAt: Date }> {
    return this.apiRequest("POST", `/api/v2/cards/fuel/${cardId}/activate`);
  }

  /**
   * Deactivate fuel card
   */
  async deactivateFuelCard(cardId: string): Promise<{ status: string; deactivatedAt: Date }> {
    return this.apiRequest("POST", `/api/v2/cards/fuel/${cardId}/deactivate`);
  }

  /**
   * Set fuel card spending limit
   */
  async setFuelCardLimit(cardId: string, amount: number, limitType: "daily" | "weekly" | "monthly"): Promise<SpendingLimitConfig> {
    return this.apiRequest("POST", `/api/v2/cards/fuel/${cardId}/limits/${limitType}`, {
      amount,
    });
  }

  /**
   * Assign driver to fuel card
   */
  async assignDriver(cardId: string, driverId: string): Promise<{ cardId: string; driverId: string; assignedAt: Date }> {
    return this.apiRequest("POST", `/api/v2/cards/fuel/${cardId}/assign/driver`, {
      driverId,
    });
  }

  /**
   * Assign vehicle to fuel card
   */
  async assignVehicle(cardId: string, vehicleId: string): Promise<{ cardId: string; vehicleId: string; assignedAt: Date }> {
    return this.apiRequest("POST", `/api/v2/cards/fuel/${cardId}/assign/vehicle`, {
      vehicleId,
    });
  }

  /**
   * Set product code restrictions (controls fuel types and categories)
   */
  async setProductCodeRestrictions(
    cardId: string,
    allowedCodes: string[]
  ): Promise<{ cardId: string; productCodes: string[] }> {
    return this.apiRequest(
      "POST",
      `/api/v2/cards/fuel/${cardId}/restrictions/products`,
      { allowedCodes }
    );
  }

  /**
   * Get real-time transaction stream (iConnectData)
   */
  async getRealTimeTransactionStream(
    limit?: number
  ): Promise<PaginatedResponse<RealTimeTransaction>> {
    const params = limit ? `?limit=${limit}` : "";
    return this.apiRequest("GET", `/api/v2/iconnectdata/transactions/stream${params}`);
  }

  /**
   * Get enhanced transaction data
   */
  async getEnhancedTransactionData(
    transactionId: string
  ): Promise<{
    transactionId: string;
    fuelType: string;
    quantity: number;
    unitPrice: number;
    odometer: number;
  }> {
    return this.apiRequest("GET", `/api/v2/iconnectdata/transactions/${transactionId}/enhanced`);
  }

  /**
   * Get bulk fuel purchase options (SmartBuy)
   */
  async getSmartBuyPricing(
    quantity: number,
    fuelType: string
  ): Promise<{
    basePrice: number;
    bulkPrice: number;
    discount: number;
    estimatedTotal: number;
  }> {
    const params = `?quantity=${quantity}&fuelType=${fuelType}`;
    return this.apiRequest("GET", `/api/v2/smartbuy/pricing${params}`);
  }

  /**
   * Create pre-buy fuel contract
   */
  async createPreBuyContract(
    quantity: number,
    fuelType: string,
    pricePerUnit: number,
    expiryDate: Date
  ): Promise<{ contractId: string; quantity: number; pricePerUnit: number; expiryDate: Date }> {
    return this.apiRequest("POST", "/api/v2/smartbuy/contracts", {
      quantity,
      fuelType,
      pricePerUnit,
      expiryDate,
    });
  }

  /**
   * Purchase bulk fuel at negotiated wholesale rates
   */
  async executeBulkFuelPurchase(
    contractId: string,
    quantity: number
  ): Promise<{ purchaseId: string; contractId: string; quantity: number; totalCost: number; status: string }> {
    return this.apiRequest("POST", "/api/v2/smartbuy/purchase", {
      contractId,
      quantity,
    });
  }

  /**
   * Search transactions with enhanced data
   */
  async searchTransactions(
    criteria: TransactionSearchCriteria
  ): Promise<PaginatedResponse<TransactionDetail>> {
    const params = new URLSearchParams();
    params.append("startDate", criteria.startDate.toISOString());
    params.append("endDate", criteria.endDate.toISOString());

    if (criteria.cardId) params.append("cardId", criteria.cardId);
    if (criteria.driverId) params.append("driverId", criteria.driverId);
    if (criteria.vehicleId) params.append("vehicleId", criteria.vehicleId);
    if (criteria.limit) params.append("limit", String(criteria.limit));
    if (criteria.offset) params.append("offset", String(criteria.offset));

    return this.apiRequest("GET", `/api/v2/transactions/search?${params.toString()}`);
  }

  /**
   * Get fleet spend analytics
   */
  async getFleetSpendAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSpend: number;
    transactionCount: number;
    averageTransactionAmount: number;
    topMerchants: Array<{ name: string; spend: number; transactions: number }>;
    spendByCategory: Record<string, number>;
  }> {
    const params = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    return this.apiRequest("GET", `/api/v2/analytics/fleet-spend${params}`);
  }

  /**
   * Get driver behavior analytics
   */
  async getDriverBehaviorAnalytics(
    driverId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    driverId: string;
    fuelingFrequency: number;
    averageFuelingAmount: number;
    costPerMile: number;
    fuelingPatterns: Array<{ date: Date; gallons: number; cost: number }>;
  }> {
    const params = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    return this.apiRequest("GET", `/api/v2/analytics/driver/${driverId}/behavior${params}`);
  }

  /**
   * Get cost allocation by GL code
   */
  async getCostAllocationByGLCode(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ glCode: string; amount: number; percentage: number; transactionCount: number }>> {
    const params = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    return this.apiRequest("GET", `/api/v2/reporting/cost-allocation/gl-code${params}`);
  }

  /**
   * Validate DOT number for compliance
   */
  async validateDOTNumber(dotNumber: string): Promise<{ valid: boolean; complianceStatus: string }> {
    return this.apiRequest("POST", "/api/v2/compliance/dot/validate", { dotNumber });
  }

  /**
   * Get IFTA mileage data for reporting
   */
  async getIFTAMileageData(
    vehicleId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    vehicleId: string;
    totalMileage: number;
    mileageByState: Record<string, number>;
    reportingPeriod: { startDate: Date; endDate: Date };
  }> {
    const params = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    return this.apiRequest("GET", `/api/v2/compliance/ifta/mileage/${vehicleId}${params}`);
  }

  /**
   * Subscribe to webhook events
   */
  async subscribeWebhook(
    webhookUrl: string,
    eventTypes: WebhookEventType[]
  ): Promise<{ webhookId: string; url: string; events: WebhookEventType[] }> {
    return this.apiRequest("POST", "/api/v2/webhooks/subscribe", {
      url: webhookUrl,
      events: eventTypes,
      secret: this.config.webhookSecret,
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string
  ): boolean {
    if (!this.config.webhookSecret) return false;

    // Prevent replay attacks - check timestamp is within 5 minutes
    const now = Date.now();
    const eventTime = parseInt(timestamp, 10) * 1000;
    if (Math.abs(now - eventTime) > 5 * 60 * 1000) {
      return false;
    }

    const expectedSignature = createHmac("sha256", this.config.webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    return expectedSignature === signature;
  }

  /**
   * Get rate limiting information
   */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  /**
   * Get SDK health status
   */
  async getHealthStatus(): Promise<SDKHealthStatus> {
    const now = new Date();
    const uptime = now.getTime() - this.lastHealthCheck.getTime();

    return {
      status: this.failureCount === 0 ? "healthy" : this.failureCount < 5 ? "degraded" : "unhealthy",
      provider: "comdata_v2" as SDKProvider,
      lastChecked: now,
      circuitBreaker: {
        state: "closed",
        failureCount: this.failureCount,
      },
      rateLimiter: {
        remaining: this.rateLimitInfo?.remaining || 500,
        limit: this.rateLimitInfo?.limit || 500,
        resetAt: this.rateLimitInfo?.reset || new Date(),
      },
      uptime,
      errorCount: this.failureCount,
    };
  }

  /**
   * Generate custom analytics report
   */
  async generateAnalyticsReport(params: ReportingParams): Promise<{ reportId: string; status: string; downloadUrl?: string }> {
    return this.apiRequest("POST", "/api/v2/reporting/analytics/generate", params);
  }

  /**
   * Get report status
   */
  async getReportStatus(reportId: string): Promise<{ reportId: string; status: string; downloadUrl?: string }> {
    return this.apiRequest("GET", `/api/v2/reporting/${reportId}`);
  }
}
