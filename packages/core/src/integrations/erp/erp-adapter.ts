/**
 * Abstract ERP Adapter Base Class
 * Provides common OAuth2, rate limiting, circuit breaker, field mapping, and sync capabilities
 * Extended by SAP, NetSuite, Dynamics365, and Sage adapters
 */

import type {
  ERPProvider,
  ERPConnection,
  ERPFieldMapping,
  ERPCustomer,
  ERPVendor,
  ERPProduct,
  ERPOrder,
  ERPInvoice,
  ERPPayment,
  ERPJournalEntry,
  ERPInventory,
  RateLimitInfo,
  PaginationParams,
  PaginatedResult,
  ERPBatchResult,
  ERPOperationError,
  ERPWebhookPayload,
  ERPWebhookRegistration,
  SyncEntityType,
} from "./types.js";

// ─── CIRCUIT BREAKER ────────────────────────────────────────────────────────

enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // ms
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const now: number = Date.now();
      if (now - this.lastFailureTime >= this.config.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw this.createCircuitOpenError();
      }
    }

    try {
      const result: T = await fn();
      this.onSuccess();
      return result;
    } catch (error: unknown) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount += 1;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  private createCircuitOpenError(): Error {
    const error = new Error(
      "Circuit breaker is OPEN - service temporarily unavailable",
    );
    (error as any).retryable = true;
    return error;
  }

  getState(): CircuitState {
    return this.state;
  }
}

// ─── RATE LIMITER ──────────────────────────────────────────────────────────

class RateLimiter {
  private requestTimestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now: number = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts: number) => now - ts < this.windowMs,
    );

    if (this.requestTimestamps.length >= this.maxRequests) {
      const oldestTimestamp: number = this.requestTimestamps[0] as number;
      const waitTime: number = this.windowMs - (now - oldestTimestamp);
      await new Promise((resolve: (value: void) => void) => {
        setTimeout(resolve, waitTime);
      });
      return this.acquire();
    }

    this.requestTimestamps.push(now);
  }

  getInfo(): RateLimitInfo {
    const now: number = Date.now();
    const recentRequests: number[] = this.requestTimestamps.filter(
      (ts: number) => now - ts < this.windowMs,
    );
    const remaining: number = Math.max(
      0,
      this.maxRequests - recentRequests.length,
    );
    const resetAt: Date = new Date(now + this.windowMs);

    return {
      remaining,
      limit: this.maxRequests,
      resetAt,
    };
  }

  reset(): void {
    this.requestTimestamps = [];
  }
}

// ─── OAUTH2 TOKEN MANAGER ──────────────────────────────────────────────────

class OAuth2TokenManager {
  private connection: ERPConnection;
  private refreshThreshold: number = 300000; // 5 minutes before expiry

  constructor(connection: ERPConnection) {
    this.connection = connection;
  }

  async getAccessToken(): Promise<string> {
    const { credentials } = this.connection;
    const expiresAt = credentials.expiresAt;

    if (!credentials.accessToken) {
      throw this.createError(
        "No access token available",
        "MISSING_ACCESS_TOKEN",
      );
    }

    // Check if token is expired or about to expire
    const now = Date.now();
    if (expiresAt && now + this.refreshThreshold > expiresAt.getTime()) {
      if (credentials.refreshToken) {
        await this.refreshAccessToken();
      } else {
        throw this.createError(
          "Token expired and no refresh token available",
          "TOKEN_EXPIRED",
        );
      }
    }

    return credentials.accessToken;
  }

  protected async refreshAccessToken(): Promise<void> {
    // To be implemented by subclasses
    throw this.createError("Token refresh not implemented", "NOT_IMPLEMENTED");
  }

  updateCredentials(credentials: any): void {
    Object.assign(this.connection.credentials, credentials);
  }

  updateExpiry(expiresInSeconds: number): void {
    this.connection.credentials.expiresAt = new Date(
      Date.now() + expiresInSeconds * 1000,
    );
  }

  private createError(message: string, code: string): Error {
    const error = new Error(message) as any;
    error.code = code;
    return error;
  }
}

// ─── ABSTRACT ERP ADAPTER ──────────────────────────────────────────────────

/**
 * Abstract base class for all ERP adapters
 * Provides common functionality: OAuth2, rate limiting, circuit breaker, field mapping
 */
export abstract class AbstractERPAdapter {
  protected provider: ERPProvider;
  protected connection: ERPConnection;
  protected tokenManager: OAuth2TokenManager;
  protected rateLimiter: RateLimiter;
  protected circuitBreaker: CircuitBreaker;
  protected fieldMappings: Map<string, ERPFieldMapping> = new Map();
  protected webhookRegistrations: Map<string, ERPWebhookRegistration> =
    new Map();

  constructor(provider: ERPProvider, connection: ERPConnection) {
    this.provider = provider;
    this.connection = connection;
    this.tokenManager = new OAuth2TokenManager(connection);
    this.rateLimiter = new RateLimiter(
      connection.config.rateLimitPerSecond || 100,
      1000,
    );
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
    });

    this.initializeFieldMappings();
  }

  /**
   * Initialize field mappings from connection config
   */
  private initializeFieldMappings(): void {
    if (this.connection.config.fieldMappings) {
      Object.entries(this.connection.config.fieldMappings).forEach(
        ([key, mapping]) => {
          this.fieldMappings.set(key, mapping);
        },
      );
    }
  }

  /**
   * Add or update field mapping
   */
  protected addFieldMapping(mapping: ERPFieldMapping): void {
    const key = `${mapping.entity}.${mapping.witylogixField}`;
    this.fieldMappings.set(key, mapping);
  }

  /**
   * Get field mapping
   */
  protected getFieldMapping(
    entity: SyncEntityType,
    witylogixField: string,
  ): ERPFieldMapping | undefined {
    return this.fieldMappings.get(`${entity}.${witylogixField}`);
  }

  /**
   * Transform field value using mapping
   */
  protected transformFieldValue(
    entity: SyncEntityType,
    witylogixField: string,
    value: unknown,
    direction: "encode" | "decode",
  ): unknown {
    const mapping = this.getFieldMapping(entity, witylogixField);
    if (!mapping || !mapping.transform) {
      return value;
    }

    if (direction === "encode" && mapping.transform.encode) {
      return mapping.transform.encode(value);
    } else if (direction === "decode" && mapping.transform.decode) {
      return mapping.transform.decode(value);
    }

    return value;
  }

  /**
   * Map Witylogix object to ERP format
   */
  protected mapToERP<T extends Record<string, any>>(
    entity: SyncEntityType,
    obj: Record<string, any>,
  ): T {
    const mapped: any = {};

    Object.entries(obj).forEach(([witylogixField, value]) => {
      const erpField =
        this.getFieldMapping(entity, witylogixField)?.erpField ||
        witylogixField;
      const transformedValue = this.transformFieldValue(
        entity,
        witylogixField,
        value,
        "encode",
      );
      mapped[erpField] = transformedValue;
    });

    return mapped as T;
  }

  /**
   * Map ERP object to Witylogix format
   */
  protected mapFromERP<T extends Record<string, any>>(
    entity: SyncEntityType,
    erpObj: Record<string, any>,
  ): T {
    const mapped: any = {};

    // Find all mappings for this entity
    this.fieldMappings.forEach((mapping) => {
      if (mapping.entity === entity && erpObj[mapping.erpField] !== undefined) {
        const transformedValue = this.transformFieldValue(
          entity,
          mapping.witylogixField,
          erpObj[mapping.erpField],
          "decode",
        );
        mapped[mapping.witylogixField] = transformedValue;
      }
    });

    // Copy unmapped fields
    Object.entries(erpObj).forEach(([erpField, value]) => {
      const isMapped = Array.from(this.fieldMappings.values()).some(
        (m) => m.entity === entity && m.erpField === erpField,
      );
      if (!isMapped && !mapped[erpField]) {
        mapped[erpField] = value;
      }
    });

    return mapped as T;
  }

  /**
   * Execute operation with circuit breaker and rate limiting
   */
  protected async executeWithRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    await this.rateLimiter.acquire();
    return this.circuitBreaker.execute(fn);
  }

  /**
   * Register webhook for ERP events
   */
  async registerWebhook(registration: ERPWebhookRegistration): Promise<void> {
    const key = registration.url;
    this.webhookRegistrations.set(key, registration);
  }

  /**
   * Unregister webhook
   */
  async unregisterWebhook(webhookUrl: string): Promise<void> {
    this.webhookRegistrations.delete(webhookUrl);
  }

  /**
   * Handle incoming webhook payload
   */
  async handleWebhookPayload(payload: ERPWebhookPayload): Promise<void> {
    // Verify signature if secret is configured
    for (const registration of this.webhookRegistrations.values()) {
      if (payload.signature && registration.secret) {
        if (!this.verifyWebhookSignature(payload, registration.secret)) {
          throw this.createError(
            "Invalid webhook signature",
            "INVALID_SIGNATURE",
          );
        }
      }
    }

    // Process webhook event
    await this.processWebhookEvent(payload);
  }

  /**
   * Verify webhook signature
   */
  protected verifyWebhookSignature(
    payload: ERPWebhookPayload,
    secret: string,
  ): boolean {
    // Implementation should use HMAC-SHA256
    // This is a placeholder
    return true;
  }

  /**
   * Process webhook event - to be implemented by subclasses
   */
  protected async processWebhookEvent(
    payload: ERPWebhookPayload,
  ): Promise<void> {
    // To be implemented by subclasses
  }

  /**
   * Batch CRUD operations with error handling
   */
  async batchCreate<T extends Record<string, any>>(
    entities: T[],
    entityType: SyncEntityType,
  ): Promise<ERPBatchResult<T>> {
    const startTime = Date.now();
    const results: Array<{
      recordId: string;
      externalId?: string;
      status: "success" | "failed" | "skipped";
      data?: T;
      error?: string;
    }> = [];
    let successful = 0;
    let failed = 0;

    for (const entity of entities) {
      try {
        const result = await this.createEntity(entity, entityType);
        results.push({
          recordId: (entity.id as string) || "",
          externalId: (result as { id?: string }).id,
          status: "success",
          data: result,
        });
        successful += 1;
      } catch (error: unknown) {
        failed += 1;
        results.push({
          recordId: (entity.id as string) || "",
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      total: entities.length,
      successful,
      failed,
      skipped: 0,
      results,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Batch read with pagination
   */
  async batchRead<T extends Record<string, any>>(
    entityType: SyncEntityType,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<T>> {
    // To be implemented by subclasses
    throw this.createError("Method not implemented", "NOT_IMPLEMENTED");
  }

  /**
   * Create entity - to be implemented by subclasses
   */
  protected async createEntity<T extends Record<string, any>>(
    entity: T,
    entityType: SyncEntityType,
  ): Promise<T> {
    throw this.createError("Method not implemented", "NOT_IMPLEMENTED");
  }

  /**
   * Update entity - to be implemented by subclasses
   */
  protected async updateEntity<T extends Record<string, any>>(
    id: string,
    entity: Partial<T>,
    entityType: SyncEntityType,
  ): Promise<T> {
    throw this.createError("Method not implemented", "NOT_IMPLEMENTED");
  }

  /**
   * Delete entity - to be implemented by subclasses
   */
  protected async deleteEntity(
    id: string,
    entityType: SyncEntityType,
  ): Promise<void> {
    throw this.createError("Method not implemented", "NOT_IMPLEMENTED");
  }

  /**
   * Get entity by ID - to be implemented by subclasses
   */
  protected async getEntity<T extends Record<string, any>>(
    id: string,
    entityType: SyncEntityType,
  ): Promise<T> {
    throw this.createError("Method not implemented", "NOT_IMPLEMENTED");
  }

  /**
   * Create ERP operation error
   */
  protected createError(
    message: string,
    code?: string,
    retryable: boolean = true,
  ): ERPOperationError {
    const error = new Error(message) as ERPOperationError;
    error.provider = this.provider;
    error.code = code;
    error.retryable = retryable;
    return error;
  }

  /**
   * Get current rate limit info
   */
  getRateLimitInfo(): RateLimitInfo {
    return this.rateLimiter.getInfo();
  }

  /**
   * Reset rate limiter (e.g., after quota reset)
   */
  resetRateLimit(): void {
    this.rateLimiter.reset();
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
  }

  /**
   * Check connection health
   */
  abstract checkHealth(): Promise<boolean>;

  /**
   * Get connection details
   */
  getConnection(): ERPConnection {
    return this.connection;
  }

  /**
   * Update connection config
   */
  updateConnection(config: Partial<ERPConnection>): void {
    Object.assign(this.connection, config);
  }
}
