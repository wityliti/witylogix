/**
 * EFS/TChek API v2 SDK Client
 *
 * API key + merchant ID authentication for truck stop settlement processing,
 * money code generation, fuel purchase authorization, and IFTA compliance.
 */

// Node 22+ has global fetch
const nodeFetch = globalThis.fetch;

import type {
  SDKConfig,
  SDKProvider,
  MoneyCodeRequest,
  PreAuthorizationRequest,
  SettlementRequest,
  TransactionSearchCriteria,
  TransactionDetail,
  WebhookEvent,
  WebhookEventType,
  IFTAReportingData,
  AuthToken,
  RateLimitInfo,
  SDKHealthStatus,
  PaginatedResponse,
  APIErrorResponse,
  TransactionStatusCode,
} from "./fuel-fleet-sdk-types";

/**
 * EFS/TChek API error class
 */
export class EFSTChekAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EFSTChekAPIError";
  }
}

/**
 * EFS/TChek v2 SDK Client
 */
export class EFSTChekv2Client {
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
      throw new Error("EFS/TChek SDK requires baseUrl");
    }
    if (!this.config.apiKey) {
      throw new Error("EFS/TChek SDK requires apiKey");
    }
    if (!this.config.merchantId) {
      throw new Error("EFS/TChek SDK requires merchantId");
    }
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    await this.checkRateLimit();
    const url = new URL(endpoint, this.config.baseUrl).toString();

    for (
      let attempt = 0;
      attempt < (this.config.retryConfig?.maxAttempts || 3);
      attempt++
    ) {
      try {
        const response = (await nodeFetch(url, {
          method,
          headers: {
            "X-API-Key": this.config.apiKey!,
            "X-Merchant-ID": this.config.merchantId!,
            "Content-Type": "application/json",
            ...this.config.customHeaders,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(this.config.timeout || 30000),
        })) as Response;

        this.updateRateLimitInfo(response);

        if (!response.ok) {
          const errorData = (await response.json()) as APIErrorResponse;
          throw new EFSTChekAPIError(
            errorData.code || `HTTP_${response.status}`,
            errorData.message || response.statusText,
            errorData.details,
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
        const delay =
          (this.config.retryConfig?.delayMs || 1000) *
          Math.pow(this.config.retryConfig?.backoffMultiplier || 2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new EFSTChekAPIError(
      "RETRY_EXHAUSTED",
      "All retry attempts exhausted",
    );
  }

  /**
   * Check rate limits (300 requests/min)
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.windowStart;
    const windowMs = 60000;

    if (elapsed >= windowMs) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    const maxRequests = 300;
    if (this.requestCount >= maxRequests) {
      const retryAfter = Math.ceil((windowMs - elapsed) / 1000);
      throw new Error(
        `Rate limit exceeded (300/min). Retry after ${retryAfter}s`,
      );
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
   * Process truck stop settlement
   */
  async processTruckStopSettlement(request: SettlementRequest): Promise<{
    settlementId: string;
    driverId: string;
    settlementAmount: number;
    status: string;
    processedAt: Date;
  }> {
    return this.apiRequest("POST", "/api/v2/settlement/process", {
      driverId: request.driverId,
      amount: request.settlementAmount,
      lumperFees: request.lumperFees,
      settlementType: request.settlementType,
      notes: request.notes,
      metadata: request.customMetadata,
    });
  }

  /**
   * Process lumper fee
   */
  async processLumperFee(
    driverId: string,
    amount: number,
    description?: string,
  ): Promise<{
    lumperFeeId: string;
    driverId: string;
    amount: number;
    status: string;
    processedAt: Date;
  }> {
    return this.apiRequest("POST", "/api/v2/settlement/lumper-fee", {
      driverId,
      amount,
      description,
    });
  }

  /**
   * Issue advance payment
   */
  async issueAdvance(
    driverId: string,
    amount: number,
    purpose?: string,
  ): Promise<{
    advanceId: string;
    driverId: string;
    amount: number;
    issuedAt: Date;
    expiresAt: Date;
  }> {
    return this.apiRequest("POST", "/api/v2/settlement/advance", {
      driverId,
      amount,
      purpose,
    });
  }

  /**
   * Issue comcheck
   */
  async issueComcheck(
    driverId: string,
    amount: number,
    merchantRestrictions?: string[],
  ): Promise<{
    comcheckId: string;
    driverId: string;
    amount: number;
    number: string;
    issuedAt: Date;
    expiresAt: Date;
  }> {
    return this.apiRequest("POST", "/api/v2/settlement/comcheck", {
      driverId,
      amount,
      merchantRestrictions,
    });
  }

  /**
   * Generate single-use money code
   */
  async generateMoneyCode(request: MoneyCodeRequest): Promise<{
    moneyCodeId: string;
    code: string;
    amount: number;
    currency: string;
    status: string;
    expiresAt: Date;
    createdAt: Date;
  }> {
    return this.apiRequest("POST", "/api/v2/money-codes/generate", {
      amount: request.amount,
      currency: request.currency,
      purpose: request.purpose,
      expiryMinutes: request.expiryMinutes,
      driverId: request.driverId,
      merchantRestrictions: request.merchantRestrictions,
      metadata: request.customMetadata,
    });
  }

  /**
   * Get money code status
   */
  async getMoneyCodeStatus(moneyCodeId: string): Promise<{
    moneyCodeId: string;
    code: string;
    amount: number;
    status: "active" | "used" | "expired";
    createdAt: Date;
    usedAt?: Date;
    expiresAt: Date;
  }> {
    return this.apiRequest("GET", `/api/v2/money-codes/${moneyCodeId}`);
  }

  /**
   * Validate money code
   */
  async validateMoneyCode(code: string): Promise<{
    valid: boolean;
    moneyCodeId?: string;
    amount?: number;
    status?: "active" | "used" | "expired";
  }> {
    return this.apiRequest("POST", "/api/v2/money-codes/validate", { code });
  }

  /**
   * Pre-authorize fuel purchase at pump
   */
  async preAuthorizeFuelPurchase(request: PreAuthorizationRequest): Promise<{
    preAuthId: string;
    driverId: string;
    approvedAmount: number;
    authCode: string;
    pumpActivated: boolean;
    expiresAt: Date;
  }> {
    return this.apiRequest("POST", "/api/v2/fuel/pre-auth", {
      driverId: request.driverId,
      amount: request.amount,
      pumpNumber: request.pumpNumber,
      merchantId: request.merchantId,
      expectedFuelGrade: request.expectedFuelGrade,
      expectedQuantity: request.expectedQuantity,
      duration: request.duration,
    });
  }

  /**
   * Activate pump for pre-authorized transaction
   */
  async activatePump(preAuthId: string): Promise<{
    preAuthId: string;
    pumpNumber: string;
    pumpActivated: boolean;
    activatedAt: Date;
  }> {
    return this.apiRequest(
      "POST",
      `/api/v2/fuel/pre-auth/${preAuthId}/activate-pump`,
    );
  }

  /**
   * Post-authorize and reconcile fuel transaction
   */
  async postAuthFuelTransaction(
    preAuthId: string,
    actualAmount: number,
    actualQuantity: number,
    fuelGrade?: string,
  ): Promise<{
    transactionId: string;
    preAuthId: string;
    status: TransactionStatusCode;
    authorizedAmount: number;
    actualAmount: number;
    adjustmentAmount?: number;
    completedAt: Date;
  }> {
    return this.apiRequest(
      "POST",
      `/api/v2/fuel/pre-auth/${preAuthId}/post-auth`,
      {
        actualAmount,
        actualQuantity,
        fuelGrade,
      },
    );
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    driverId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PaginatedResponse<TransactionDetail>> {
    const params = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    return this.apiRequest(
      "GET",
      `/api/v2/driver/${driverId}/transactions${params}`,
    );
  }

  /**
   * Get settlement history for driver
   */
  async getSettlementHistory(
    driverId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<
    Array<{
      settlementId: string;
      amount: number;
      settlementType: "advance" | "comcheck" | "quick_pay";
      status: string;
      processedAt: Date;
    }>
  > {
    const params = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    return this.apiRequest(
      "GET",
      `/api/v2/driver/${driverId}/settlements${params}`,
    );
  }

  /**
   * Get escrow balance
   */
  async getEscrowBalance(driverId: string): Promise<{
    driverId: string;
    escrowBalance: number;
    currency: string;
    lastUpdated: Date;
  }> {
    return this.apiRequest("GET", `/api/v2/escrow/driver/${driverId}`);
  }

  /**
   * Pay driver from escrow
   */
  async payDriver(
    driverId: string,
    amount: number,
    paymentMethod: "ach" | "check" | "comcheck",
  ): Promise<{
    paymentId: string;
    driverId: string;
    amount: number;
    paymentMethod: string;
    status: string;
    processedAt: Date;
  }> {
    return this.apiRequest("POST", "/api/v2/escrow/pay", {
      driverId,
      amount,
      paymentMethod,
    });
  }

  /**
   * Get IFTA data extraction for reporting
   */
  async getIFTAData(
    vehicleId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<IFTAReportingData> {
    const params = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    return this.apiRequest(
      "GET",
      `/api/v2/compliance/ifta/${vehicleId}${params}`,
    );
  }

  /**
   * Get fuel tax reporting by jurisdiction
   */
  async getFuelTaxReporting(
    startDate: Date,
    endDate: Date,
    vehicleId?: string,
  ): Promise<{
    reportingPeriod: { startDate: Date; endDate: Date };
    jurisdictions: Array<{
      state: string;
      gallons: number;
      taxRate: number;
      estimatedTax: number;
    }>;
    summary: {
      totalGallons: number;
      totalTax: number;
    };
  }> {
    const params = new URLSearchParams();
    params.append("startDate", startDate.toISOString());
    params.append("endDate", endDate.toISOString());
    if (vehicleId) params.append("vehicleId", vehicleId);

    return this.apiRequest(
      "GET",
      `/api/v2/compliance/fuel-tax?${params.toString()}`,
    );
  }

  /**
   * Export IFTA compliance report
   */
  async exportIFTAReport(
    startDate: Date,
    endDate: Date,
    format: "json" | "csv" | "pdf" = "json",
  ): Promise<{
    reportId: string;
    format: string;
    downloadUrl: string;
    expiresAt: Date;
  }> {
    return this.apiRequest("POST", "/api/v2/compliance/ifta/export", {
      startDate,
      endDate,
      format,
    });
  }

  /**
   * Subscribe to webhook events
   */
  async subscribeWebhook(
    webhookUrl: string,
    eventTypes: WebhookEventType[],
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
      status:
        this.failureCount === 0
          ? "healthy"
          : this.failureCount < 5
            ? "degraded"
            : "unhealthy",
      provider: "efs_tchek_v2" as SDKProvider,
      lastChecked: now,
      circuitBreaker: {
        state: "closed",
        failureCount: this.failureCount,
      },
      rateLimiter: {
        remaining: this.rateLimitInfo?.remaining || 300,
        limit: this.rateLimitInfo?.limit || 300,
        resetAt: this.rateLimitInfo?.reset || new Date(),
      },
      uptime,
      errorCount: this.failureCount,
    };
  }
}
