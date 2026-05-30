/**
 * WEX Fleet One/EFS API v2 SDK Client
 *
 * OAuth2 client credentials authentication for comprehensive fleet card management,
 * real-time transaction feeds, advanced reporting, and fleet controls.
 */

// Node 22+ has global fetch
const nodeFetch = globalThis.fetch;

import type {
  SDKConfig,
  SDKProvider,
  CardIssuanceRequest,
  CardLifecycleRequest,
  SpendingLimitConfig,
  ProductRestrictionConfig,
  TimeRestrictionConfig,
  RealTimeTransaction,
  TransactionSearchCriteria,
  TransactionDetail,
  WebhookEvent,
  WebhookEventType,
  FuelUsageAnalytics,
  ExceptionReport,
  IFTAReportingData,
  ReportingParams,
  AuthToken,
  RateLimitInfo,
  SDKHealthStatus,
  DeclineReason,
  TransactionStatusCode,
  PaginatedResponse,
  APIErrorResponse,
  FuelType,
} from "./fuel-fleet-sdk-types";

/**
 * WEX v2 API error class
 */
export class WEXAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
    public requestId?: string
  ) {
    super(message);
    this.name = "WEXAPIError";
  }
}

/**
 * WEX v2 SDK Client
 */
export class WEXv2SDKClient {
  private config: SDKConfig;
  private accessToken: string = "";
  private tokenExpiresAt: number = 0;
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
      throw new Error("WEX SDK requires baseUrl");
    }
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error("WEX SDK requires clientId and clientSecret for OAuth2");
    }
    if (!this.config.tokenUrl) {
      throw new Error("WEX SDK requires tokenUrl");
    }
  }

  /**
   * Authenticate with OAuth2 client credentials flow
   */
  async authenticate(): Promise<AuthToken> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return {
        accessToken: this.accessToken,
        tokenType: "Bearer",
        expiresIn: Math.floor((this.tokenExpiresAt - Date.now()) / 1000),
        expiresAt: new Date(this.tokenExpiresAt),
      };
    }

    try {
      const response = await nodeFetch(this.config.tokenUrl!, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.config.clientId!,
          client_secret: this.config.clientSecret!,
          scope: "fleet_cards transactions reporting",
        }).toString(),
      });

      if (!response.ok) {
        throw new WEXAPIError(
          "AUTH_FAILED",
          `Authentication failed: ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        access_token: string;
        token_type: string;
        expires_in: number;
      };

      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000;
      this.failureCount = 0;

      return {
        accessToken: this.accessToken,
        tokenType: data.token_type,
        expiresIn: data.expires_in,
        expiresAt: new Date(this.tokenExpiresAt),
      };
    } catch (error) {
      this.failureCount += 1;
      throw new WEXAPIError(
        "AUTH_ERROR",
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Make authenticated API request with rate limiting and retry logic
   */
  private async apiRequest<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    await this.checkRateLimit();
    const token = await this.authenticate();
    const url = new URL(endpoint, this.config.baseUrl).toString();

    for (let attempt = 0; attempt < (this.config.retryConfig?.maxAttempts || 3); attempt++) {
      try {
        const response = (await nodeFetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token.accessToken}`,
            "Content-Type": "application/json",
            ...this.config.customHeaders,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(this.config.timeout || 30000),
        })) as Response;

        this.updateRateLimitInfo(response);

        if (!response.ok) {
          const errorData = (await response.json()) as APIErrorResponse;
          throw new WEXAPIError(
            errorData.code || `HTTP_${response.status}`,
            errorData.message || response.statusText,
            errorData.details,
            errorData.requestId
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

    throw new WEXAPIError("RETRY_EXHAUSTED", "All retry attempts exhausted");
  }

  /**
   * Check rate limits before request
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.windowStart;
    const windowMs = 60000; // 1 minute window

    if (elapsed >= windowMs) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    const maxRequests = 1000; // 1000 requests per hour = ~16 per minute
    if (this.requestCount >= maxRequests / 60) {
      const retryAfter = Math.ceil((windowMs - elapsed) / 1000);
      throw new Error(`Rate limit exceeded. Retry after ${retryAfter}s`);
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
   * Issue a new fuel card
   */
  async issueCard(request: CardIssuanceRequest): Promise<{ cardId: string; cardNumber: string; last4: string }> {
    return this.apiRequest("POST", "/api/v2/cards/issue", {
      cardholderName: request.cardholderName,
      cardholderEmail: request.cardholderEmail,
      driverId: request.driverId,
      vehicleId: request.vehicleId,
      costCenter: request.costCenter,
      limits: {
        daily: request.dailyLimit,
        weekly: request.weeklyLimit,
        monthly: request.monthlyLimit,
        singleTransaction: request.singleTransactionLimit,
      },
      restrictions: {
        products: request.productRestrictions,
        time: request.timeRestrictions,
        merchants: request.merchantRestrictions,
        geofence: request.geofenceRestrictions,
      },
      metadata: request.customMetadata,
    });
  }

  /**
   * Suspend a fuel card
   */
  async suspendCard(cardId: string, reason?: string): Promise<{ status: string; timestamp: Date }> {
    return this.apiRequest("POST", `/api/v2/cards/${cardId}/suspend`, { reason });
  }

  /**
   * Reactivate a suspended card
   */
  async reactivateCard(cardId: string): Promise<{ status: string; timestamp: Date }> {
    return this.apiRequest("POST", `/api/v2/cards/${cardId}/reactivate`);
  }

  /**
   * Cancel a fuel card
   */
  async cancelCard(cardId: string, reason?: string): Promise<{ status: string; timestamp: Date }> {
    return this.apiRequest("POST", `/api/v2/cards/${cardId}/cancel`, { reason });
  }

  /**
   * Set daily spending limit
   */
  async setDailyLimit(cardId: string, amount: number): Promise<SpendingLimitConfig> {
    return this.apiRequest("POST", `/api/v2/cards/${cardId}/limits/daily`, { amount });
  }

  /**
   * Set weekly spending limit
   */
  async setWeeklyLimit(cardId: string, amount: number): Promise<SpendingLimitConfig> {
    return this.apiRequest("POST", `/api/v2/cards/${cardId}/limits/weekly`, { amount });
  }

  /**
   * Set monthly spending limit
   */
  async setMonthlyLimit(cardId: string, amount: number): Promise<SpendingLimitConfig> {
    return this.apiRequest("POST", `/api/v2/cards/${cardId}/limits/monthly`, { amount });
  }

  /**
   * Set per-transaction limit
   */
  async setTransactionLimit(cardId: string, amount: number): Promise<SpendingLimitConfig> {
    return this.apiRequest("POST", `/api/v2/cards/${cardId}/limits/transaction`, { amount });
  }

  /**
   * Configure product restrictions (fuel only, fuel + maintenance, etc)
   */
  async setProductRestrictions(config: ProductRestrictionConfig): Promise<ProductRestrictionConfig> {
    return this.apiRequest(
      "POST",
      `/api/v2/cards/${config.cardId}/restrictions/products`,
      config
    );
  }

  /**
   * Configure time-of-day restrictions
   */
  async setTimeRestrictions(config: TimeRestrictionConfig): Promise<TimeRestrictionConfig> {
    return this.apiRequest(
      "POST",
      `/api/v2/cards/${config.cardId}/restrictions/time`,
      config
    );
  }

  /**
   * Get real-time transaction feed
   */
  async getRealTimeTransactionFeed(): Promise<PaginatedResponse<RealTimeTransaction>> {
    return this.apiRequest("GET", "/api/v2/transactions/realtime");
  }

  /**
   * Search historical transactions
   */
  async searchTransactions(
    criteria: TransactionSearchCriteria
  ): Promise<PaginatedResponse<TransactionDetail>> {
    const params = new URLSearchParams();
    params.append("startDate", criteria.startDate.toISOString());
    params.append("endDate", criteria.endDate.toISOString());

    if (criteria.cardId) params.append("cardId", criteria.cardId);
    if (criteria.vehicleId) params.append("vehicleId", criteria.vehicleId);
    if (criteria.driverId) params.append("driverId", criteria.driverId);
    if (criteria.minAmount) params.append("minAmount", String(criteria.minAmount));
    if (criteria.maxAmount) params.append("maxAmount", String(criteria.maxAmount));
    if (criteria.status) params.append("status", criteria.status);
    if (criteria.includeDeclined) params.append("includeDeclined", "true");
    if (criteria.limit) params.append("limit", String(criteria.limit));
    if (criteria.offset) params.append("offset", String(criteria.offset));

    return this.apiRequest("GET", `/api/v2/transactions/search?${params.toString()}`);
  }

  /**
   * Get detailed transaction information (Level 3 data)
   */
  async getTransactionDetails(transactionId: string): Promise<TransactionDetail> {
    return this.apiRequest("GET", `/api/v2/transactions/${transactionId}/details`);
  }

  /**
   * Get declined transactions with reasons
   */
  async getDeclinedTransactions(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ transactionId: string; reason: DeclineReason; timestamp: Date }>> {
    return this.apiRequest("GET", `/api/v2/transactions/declined?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
  }

  /**
   * Get fuel usage analytics by vehicle
   */
  async getFuelUsageByVehicle(
    startDate: Date,
    endDate: Date,
    vehicleId?: string
  ): Promise<FuelUsageAnalytics> {
    const params = new URLSearchParams();
    params.append("startDate", startDate.toISOString());
    params.append("endDate", endDate.toISOString());
    if (vehicleId) params.append("vehicleId", vehicleId);

    return this.apiRequest("GET", `/api/v2/analytics/fuel-usage/vehicle?${params.toString()}`);
  }

  /**
   * Get fuel usage analytics by driver
   */
  async getFuelUsageByDriver(
    startDate: Date,
    endDate: Date,
    driverId?: string
  ): Promise<FuelUsageAnalytics> {
    const params = new URLSearchParams();
    params.append("startDate", startDate.toISOString());
    params.append("endDate", endDate.toISOString());
    if (driverId) params.append("driverId", driverId);

    return this.apiRequest("GET", `/api/v2/analytics/fuel-usage/driver?${params.toString()}`);
  }

  /**
   * Get cost center allocation report
   */
  async getCostCenterAllocation(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ costCenter: string; totalSpend: number; allocationPercentage: number }>> {
    return this.apiRequest(
      "GET",
      `/api/v2/reporting/cost-center?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
    );
  }

  /**
   * Get exception report (over-limit, after-hours, location mismatch, etc)
   */
  async getExceptionReport(
    startDate: Date,
    endDate: Date
  ): Promise<ExceptionReport> {
    return this.apiRequest(
      "GET",
      `/api/v2/reporting/exceptions?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
    );
  }

  /**
   * Get IFTA reporting data
   */
  async getIFTAReportingData(
    jurisdiction: string,
    startDate: Date,
    endDate: Date,
    vehicleId?: string
  ): Promise<IFTAReportingData> {
    const params = new URLSearchParams();
    params.append("jurisdiction", jurisdiction);
    params.append("startDate", startDate.toISOString());
    params.append("endDate", endDate.toISOString());
    if (vehicleId) params.append("vehicleId", vehicleId);

    return this.apiRequest("GET", `/api/v2/reporting/ifta?${params.toString()}`);
  }

  /**
   * Require driver ID for transactions
   */
  async requireDriverId(cardId: string, required: boolean): Promise<{ cardId: string; driverIdRequired: boolean }> {
    return this.apiRequest(
      "POST",
      `/api/v2/cards/${cardId}/controls/driver-id`,
      { required }
    );
  }

  /**
   * Require odometer entry for transactions
   */
  async requireOdometer(cardId: string, required: boolean): Promise<{ cardId: string; odometerRequired: boolean }> {
    return this.apiRequest(
      "POST",
      `/api/v2/cards/${cardId}/controls/odometer`,
      { required }
    );
  }

  /**
   * Require vehicle number prompts
   */
  async requireVehicleNumber(cardId: string, required: boolean): Promise<{ cardId: string; vehicleNumberRequired: boolean }> {
    return this.apiRequest(
      "POST",
      `/api/v2/cards/${cardId}/controls/vehicle-number`,
      { required }
    );
  }

  /**
   * Set merchant category restrictions
   */
  async setMerchantCategoryRestrictions(
    cardId: string,
    allowedCategories: string[]
  ): Promise<{ cardId: string; restrictions: string[] }> {
    return this.apiRequest(
      "POST",
      `/api/v2/cards/${cardId}/controls/merchant-categories`,
      { allowedCategories }
    );
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
   * Unsubscribe from webhook
   */
  async unsubscribeWebhook(webhookId: string): Promise<{ success: boolean }> {
    return this.apiRequest("POST", `/api/v2/webhooks/${webhookId}/unsubscribe`);
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string
  ): boolean {
    if (!this.config.webhookSecret) return false;

    const crypto = require("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", this.config.webhookSecret)
      .update(payload)
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
      provider: "wex_v2" as SDKProvider,
      lastChecked: now,
      circuitBreaker: {
        state: "closed",
        failureCount: this.failureCount,
      },
      rateLimiter: {
        remaining: this.rateLimitInfo?.remaining || 0,
        limit: this.rateLimitInfo?.limit || 1000,
        resetAt: this.rateLimitInfo?.reset || new Date(),
      },
      uptime,
      errorCount: this.failureCount,
    };
  }

  /**
   * Generate custom report
   */
  async generateReport(params: ReportingParams): Promise<{ reportId: string; status: string; downloadUrl?: string }> {
    return this.apiRequest("POST", "/api/v2/reporting/generate", params);
  }

  /**
   * Get report status and download
   */
  async getReportStatus(reportId: string): Promise<{ reportId: string; status: string; downloadUrl?: string }> {
    return this.apiRequest("GET", `/api/v2/reporting/${reportId}`);
  }
}
