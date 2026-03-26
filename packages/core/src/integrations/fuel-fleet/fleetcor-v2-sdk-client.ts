/**
 * Fleetcor/FUELMAN API v2 SDK Client
 *
 * OAuth2 + API key dual authentication for universal card management,
 * fleet analytics, maintenance network integration, and SmartHub reporting.
 */

// Node 22+ has global fetch
const nodeFetch = globalThis.fetch;

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
  TransactionStatusCode,
  PaginatedResponse,
  APIErrorResponse,
} from "./fuel-fleet-sdk-types";

/**
 * Fleetcor API error class
 */
export class FleetcorAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
    public requestId?: string
  ) {
    super(message);
    this.name = "FleetcorAPIError";
  }
}

/**
 * Fleetcor v2 SDK Client
 */
export class Fleetcorv2SDKClient {
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
      throw new Error("Fleetcor SDK requires baseUrl");
    }
    if (!this.config.apiKey) {
      throw new Error("Fleetcor SDK requires apiKey");
    }
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error("Fleetcor SDK requires clientId and clientSecret for OAuth2");
    }
    if (!this.config.tokenUrl) {
      throw new Error("Fleetcor SDK requires tokenUrl");
    }
  }

  /**
   * Authenticate with OAuth2
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
          scope: "fleet_cards maintenance_network reporting",
        }).toString(),
      });

      if (!response.ok) {
        throw new FleetcorAPIError(
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
      throw new FleetcorAPIError(
        "AUTH_ERROR",
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Make authenticated API request with rate limiting
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
            "X-API-Key": this.config.apiKey!,
            "Content-Type": "application/json",
            ...this.config.customHeaders,
          },
          body: body ? JSON.stringify(body) : undefined,
          timeout: this.config.timeout || 30000,
        })) as Response;

        this.updateRateLimitInfo(response);

        if (!response.ok) {
          const errorData = (await response.json()) as APIErrorResponse;
          throw new FleetcorAPIError(
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

    throw new FleetcorAPIError("RETRY_EXHAUSTED", "All retry attempts exhausted");
  }

  /**
   * Check rate limits (600 requests/min)
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.windowStart;
    const windowMs = 60000;

    if (elapsed >= windowMs) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    const maxRequests = 600;
    if (this.requestCount >= maxRequests) {
      const retryAfter = Math.ceil((windowMs - elapsed) / 1000);
      throw new Error(`Rate limit exceeded (600/min). Retry after ${retryAfter}s`);
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
   * Issue universal card (Fuelman, Fleet One, Comdata network)
   */
  async issueUniversalCard(request: CardIssuanceRequest): Promise<{ cardId: string; cardNumber: string; networks: string[] }> {
    return this.apiRequest("POST", "/api/v2/cards/universal/issue", {
      cardholderName: request.cardholderName,
      driverId: request.driverId,
      vehicleId: request.vehicleId,
      limits: {
        daily: request.dailyLimit,
        weekly: request.weeklyLimit,
        monthly: request.monthlyLimit,
      },
      restrictions: request.productRestrictions,
      metadata: request.customMetadata,
    });
  }

  /**
   * Activate universal card
   */
  async activateUniversalCard(cardId: string): Promise<{ status: string; activatedAt: Date; networks: string[] }> {
    return this.apiRequest("POST", `/api/v2/cards/universal/${cardId}/activate`);
  }

  /**
   * Suspend card with optional temporary override
   */
  async suspendCard(
    cardId: string,
    reason?: string,
    temporaryOverride?: { durationMinutes: number; limitAmount: number }
  ): Promise<{ status: string; suspendedAt: Date }> {
    return this.apiRequest("POST", `/api/v2/cards/${cardId}/suspend`, {
      reason,
      temporaryOverride,
    });
  }

  /**
   * Terminate card
   */
  async terminateCard(cardId: string, reason?: string): Promise<{ status: string; terminatedAt: Date }> {
    return this.apiRequest("POST", `/api/v2/cards/${cardId}/terminate`, { reason });
  }

  /**
   * Query real-time transactions
   */
  async getRealTimeTransactions(
    limit?: number,
    offset?: number
  ): Promise<PaginatedResponse<RealTimeTransaction>> {
    const params = new URLSearchParams();
    if (limit) params.append("limit", String(limit));
    if (offset) params.append("offset", String(offset));

    return this.apiRequest("GET", `/api/v2/transactions/realtime?${params.toString()}`);
  }

  /**
   * Query transactions in batch
   */
  async getTransactionsBatch(
    criteria: TransactionSearchCriteria
  ): Promise<PaginatedResponse<TransactionDetail>> {
    const params = new URLSearchParams();
    params.append("startDate", criteria.startDate.toISOString());
    params.append("endDate", criteria.endDate.toISOString());

    if (criteria.cardId) params.append("cardId", criteria.cardId);
    if (criteria.vehicleId) params.append("vehicleId", criteria.vehicleId);
    if (criteria.driverId) params.append("driverId", criteria.driverId);
    if (criteria.limit) params.append("limit", String(criteria.limit));
    if (criteria.offset) params.append("offset", String(criteria.offset));

    return this.apiRequest("GET", `/api/v2/transactions/batch?${params.toString()}`);
  }

  /**
   * Get transaction with Level 3 data and exception flagging
   */
  async getTransactionDetails(
    transactionId: string
  ): Promise<TransactionDetail & { exceptionFlags: string[] }> {
    return this.apiRequest("GET", `/api/v2/transactions/${transactionId}/details`);
  }

  /**
   * Get MPG tracking per vehicle
   */
  async getVehicleMPGTracking(
    vehicleId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    vehicleId: string;
    averageMPG: number;
    totalMiles: number;
    totalGallons: number;
    mileageHistory: Array<{ date: Date; mileage: number; fuelPurchased: number; mpg: number }>;
  }> {
    const params = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    return this.apiRequest("GET", `/api/v2/analytics/vehicle/${vehicleId}/mpg${params}`);
  }

  /**
   * Estimate idle fuel waste
   */
  async estimateIdleFuelWaste(
    vehicleId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    vehicleId: string;
    estimatedWastedGallons: number;
    estimatedWasteCost: number;
    idlePercentage: number;
    recommendations: string[];
  }> {
    const params = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    return this.apiRequest("GET", `/api/v2/analytics/vehicle/${vehicleId}/idle-waste${params}`);
  }

  /**
   * Get fueling efficiency score
   */
  async getFuelingEfficiencyScore(
    vehicleId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    vehicleId: string;
    efficiencyScore: number;
    benchmarkScore: number;
    trend: "improving" | "stable" | "declining";
    recommendations: string[];
  }> {
    const params = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    return this.apiRequest("GET", `/api/v2/analytics/vehicle/${vehicleId}/efficiency-score${params}`);
  }

  /**
   * Find authorized service locations
   */
  async findAuthorizedServiceLocations(
    latitude: number,
    longitude: number,
    radiusKm: number = 50
  ): Promise<
    Array<{
      locationId: string;
      name: string;
      address: string;
      latitude: number;
      longitude: number;
      distance: number;
      servicesOffered: string[];
    }>
  > {
    const params = `?latitude=${latitude}&longitude=${longitude}&radius=${radiusKm}`;
    return this.apiRequest("GET", `/api/v2/maintenance/locations${params}`);
  }

  /**
   * Request pre-authorization for service
   */
  async requestPreAuthorization(
    locationId: string,
    estimatedAmount: number,
    serviceDescription?: string
  ): Promise<{
    authorizationId: string;
    status: string;
    expiresAt: Date;
    approvedAmount: number;
  }> {
    return this.apiRequest("POST", "/api/v2/maintenance/pre-authorization", {
      locationId,
      estimatedAmount,
      serviceDescription,
    });
  }

  /**
   * Submit PO-based approval for maintenance
   */
  async submitPOApproval(
    locationId: string,
    poNumber: string,
    amount: number
  ): Promise<{ approvalId: string; status: string; poNumber: string }> {
    return this.apiRequest("POST", "/api/v2/maintenance/po-approval", {
      locationId,
      poNumber,
      amount,
    });
  }

  /**
   * Get customizable SmartHub dashboards
   */
  async getSmartHubDashboards(): Promise<
    Array<{ dashboardId: string; name: string; type: string; widgets: Array<{ id: string; type: string }> }>
  > {
    return this.apiRequest("GET", "/api/v2/reporting/smarthub/dashboards");
  }

  /**
   * Schedule automated report delivery
   */
  async scheduleReportDelivery(params: {
    reportType: string;
    frequency: "daily" | "weekly" | "monthly";
    deliveryMethod: "email" | "sftp";
    deliveryEmail?: string;
    sftpConfig?: { host: string; username: string; password: string; path: string };
  }): Promise<{ scheduleId: string; nextDeliveryDate: Date }> {
    return this.apiRequest("POST", "/api/v2/reporting/schedule-delivery", params);
  }

  /**
   * Get tax exemption status
   */
  async getTaxExemptionStatus(cardId: string): Promise<{
    cardId: string;
    exemptionStatus: "full" | "partial" | "none";
    applicableStates: string[];
  }> {
    return this.apiRequest("GET", `/api/v2/tax-exemption/card/${cardId}`);
  }

  /**
   * Enable state-level fuel tax exempt processing
   */
  async enableStateExemption(
    cardId: string,
    states: string[]
  ): Promise<{ cardId: string; exemptionStates: string[] }> {
    return this.apiRequest("POST", `/api/v2/tax-exemption/card/${cardId}/enable`, {
      states,
    });
  }

  /**
   * Process fuel purchase with tax exemption
   */
  async processFuelPurchaseWithExemption(
    transactionId: string,
    exemptionState: string
  ): Promise<{ transactionId: string; taxExemptionApplied: boolean; savingsAmount: number }> {
    return this.apiRequest("POST", `/api/v2/transactions/${transactionId}/apply-exemption`, {
      exemptionState,
    });
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
  verifyWebhookSignature(payload: string, signature: string): boolean {
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
      provider: "fleetcor_v2" as SDKProvider,
      lastChecked: now,
      circuitBreaker: {
        state: "closed",
        failureCount: this.failureCount,
      },
      rateLimiter: {
        remaining: this.rateLimitInfo?.remaining || 600,
        limit: this.rateLimitInfo?.limit || 600,
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
   * Get report status
   */
  async getReportStatus(reportId: string): Promise<{ reportId: string; status: string; downloadUrl?: string }> {
    return this.apiRequest("GET", `/api/v2/reporting/${reportId}`);
  }
}
