/**
 * Abstract Field Service Adapter Base Class
 * Provides common OAuth2, rate limiting, circuit breaker, and sync capabilities
 * Extended by ServiceTitan, Jobber, HouseCall Pro, and FieldEdge adapters
 */

import type {
  FieldServiceProvider,
  FieldServiceConnection,
  FieldServiceFieldMapping,
  Job,
  WorkOrder,
  Technician,
  ServiceTerritory,
  Equipment,
  Estimate,
  Invoice,
  CustomerRecord,
  Membership,
  Schedule,
  DispatchAssignment,
  RateLimitInfo,
  PaginationParams,
  PaginatedResult,
  FieldServiceBatchResult,
  FieldServiceOperationError,
  FieldServiceCredentials,
} from './types.js';

// ─── CIRCUIT BREAKER ────────────────────────────────────────────────────────

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // ms
}

/**
 * Circuit breaker for fault tolerance
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;

  /**
   * Initialize circuit breaker
   */
  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute function with circuit breaker protection
   */
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
    const error = new Error('Circuit breaker is OPEN - service temporarily unavailable');
    (error as any).retryable = true;
    return error;
  }

  getState(): CircuitState {
    return this.state;
  }
}

// ─── RATE LIMITER ──────────────────────────────────────────────────────────

/**
 * Token bucket rate limiter
 */
class RateLimiter {
  private requestTimestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  /**
   * Initialize rate limiter
   */
  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Acquire a token, waiting if necessary
   */
  async acquire(): Promise<void> {
    const now: number = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter((ts: number) => now - ts < this.windowMs);

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

  /**
   * Get current rate limit info
   */
  getInfo(): RateLimitInfo {
    const now: number = Date.now();
    const recentRequests: number[] = this.requestTimestamps.filter((ts: number) => now - ts < this.windowMs);
    const remaining: number = Math.max(0, this.maxRequests - recentRequests.length);
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

// ─── RETRY HANDLER ─────────────────────────────────────────────────────────

interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Exponential backoff retry handler
 */
class RetryHandler {
  private config: RetryConfig;

  /**
   * Initialize retry handler
   */
  constructor(config: RetryConfig) {
    this.config = config;
  }

  /**
   * Execute function with exponential backoff retry
   */
  async execute<T>(fn: () => Promise<T>, isRetryable?: (error: unknown) => boolean): Promise<T> {
    let lastError: unknown;
    let delayMs = this.config.initialDelayMs;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error;

        // Check if error is retryable
        if (isRetryable && !isRetryable(error)) {
          throw error;
        }

        if (attempt < this.config.maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs = Math.min(delayMs * this.config.backoffMultiplier, this.config.maxDelayMs);
        }
      }
    }

    throw lastError;
  }
}

// ─── OAUTH2 TOKEN MANAGER ──────────────────────────────────────────────────

/**
 * OAuth2 token management
 */
class OAuth2TokenManager {
  private connection: FieldServiceConnection;
  private refreshThreshold: number = 300000; // 5 minutes before expiry

  /**
   * Initialize token manager
   */
  constructor(connection: FieldServiceConnection) {
    this.connection = connection;
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    const { credentials } = this.connection;

    if (!credentials.accessToken) {
      throw this.createError('No access token available', 'MISSING_ACCESS_TOKEN');
    }

    // Check if token is expired or about to expire
    const now = Date.now();
    if (credentials.expiresAt && now + this.refreshThreshold > credentials.expiresAt.getTime()) {
      if (credentials.refreshToken) {
        // Token refresh implemented by subclass
        throw this.createError('Token refresh not implemented', 'NOT_IMPLEMENTED');
      } else {
        throw this.createError('Token expired and no refresh token available', 'TOKEN_EXPIRED');
      }
    }

    return credentials.accessToken;
  }

  /**
   * Update stored credentials
   */
  updateCredentials(credentials: Partial<FieldServiceCredentials>): void {
    Object.assign(this.connection.credentials, credentials);
  }

  /**
   * Update token expiry time
   */
  updateExpiry(expiresInSeconds: number): void {
    this.connection.credentials.expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  }

  private createError(message: string, code: string): Error {
    const error = new Error(message) as any;
    error.code = code;
    return error;
  }
}

// ─── ABSTRACT FIELD SERVICE ADAPTER ─────────────────────────────────────────

/**
 * Abstract base class for all field service adapters
 * Provides common functionality: OAuth2, rate limiting, circuit breaker, field mapping, retries
 */
export abstract class AbstractFieldServiceAdapter {
  protected provider: FieldServiceProvider;
  protected connection: FieldServiceConnection;
  protected tokenManager: OAuth2TokenManager;
  protected rateLimiter: RateLimiter;
  protected circuitBreaker: CircuitBreaker;
  protected retryHandler: RetryHandler;
  protected fieldMappings: Map<string, FieldServiceFieldMapping> = new Map();

  /**
   * Initialize adapter
   */
  constructor(provider: FieldServiceProvider, connection: FieldServiceConnection) {
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
    this.retryHandler = new RetryHandler({
      maxAttempts: connection.config.maxRetries || 3,
      initialDelayMs: connection.config.retryDelayMs || 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    });

    this.initializeFieldMappings();
  }

  /**
   * Initialize field mappings from connection config
   */
  private initializeFieldMappings(): void {
    if (this.connection.config.fieldMappings) {
      Object.entries(this.connection.config.fieldMappings).forEach(([key, mapping]) => {
        this.fieldMappings.set(key, mapping);
      });
    }
  }

  /**
   * Add or update field mapping
   */
  protected addFieldMapping(mapping: FieldServiceFieldMapping): void {
    const key = `${mapping.entity}.${mapping.witylogixField}`;
    this.fieldMappings.set(key, mapping);
  }

  /**
   * Get field mapping
   */
  protected getFieldMapping(entity: string, field: string): FieldServiceFieldMapping | undefined {
    return this.fieldMappings.get(`${entity}.${field}`);
  }

  /**
   * Map field value from provider to Witylogix
   */
  protected mapFieldValue(entity: string, field: string, value: unknown): unknown {
    const mapping = this.getFieldMapping(entity, field);
    if (!mapping || !mapping.metadata?.decode) {
      return value;
    }
    return (mapping.metadata.decode as (v: unknown) => unknown)(value);
  }

  /**
   * Map field value from Witylogix to provider
   */
  protected reverseMapFieldValue(entity: string, field: string, value: unknown): unknown {
    const mapping = this.getFieldMapping(entity, field);
    if (!mapping || !mapping.metadata?.encode) {
      return value;
    }
    return (mapping.metadata.encode as (v: unknown) => unknown)(value);
  }

  /**
   * Execute with rate limiting and circuit breaker
   */
  protected async executeWithProtection<T>(fn: () => Promise<T>): Promise<T> {
    await this.rateLimiter.acquire();
    return this.circuitBreaker.execute(() => fn());
  }

  /**
   * Execute with retry logic
   */
  protected async executeWithRetry<T>(
    fn: () => Promise<T>,
    isRetryable?: (error: unknown) => boolean,
  ): Promise<T> {
    return this.retryHandler.execute(fn, isRetryable);
  }

  /**
   * Health check - to be implemented by subclasses
   */
  abstract healthCheck(): Promise<boolean>;

  // ─── JOB MANAGEMENT ────────────────────────────────────────────────────────

  /**
   * Create a new job
   */
  abstract createJob(job: Job): Promise<Job>;

  /**
   * Get job by ID
   */
  abstract getJob(jobId: string): Promise<Job>;

  /**
   * Update job
   */
  abstract updateJob(jobId: string, updates: Partial<Job>): Promise<Job>;

  /**
   * Delete job
   */
  abstract deleteJob(jobId: string): Promise<void>;

  /**
   * List jobs
   */
  abstract listJobs(params?: PaginationParams): Promise<PaginatedResult<Job>>;

  // ─── WORK ORDER MANAGEMENT ─────────────────────────────────────────────────

  /**
   * Create work order
   */
  abstract createWorkOrder(workOrder: WorkOrder): Promise<WorkOrder>;

  /**
   * Get work order by ID
   */
  abstract getWorkOrder(workOrderId: string): Promise<WorkOrder>;

  /**
   * Update work order
   */
  abstract updateWorkOrder(workOrderId: string, updates: Partial<WorkOrder>): Promise<WorkOrder>;

  /**
   * List work orders
   */
  abstract listWorkOrders(params?: PaginationParams): Promise<PaginatedResult<WorkOrder>>;

  // ─── TECHNICIAN MANAGEMENT ────────────────────────────────────────────────

  /**
   * Get technician by ID
   */
  abstract getTechnician(technicianId: string): Promise<Technician>;

  /**
   * List technicians
   */
  abstract listTechnicians(params?: PaginationParams): Promise<PaginatedResult<Technician>>;

  /**
   * Update technician availability
   */
  abstract updateTechnicianAvailability(
    technicianId: string,
    status: string,
  ): Promise<Technician>;

  /**
   * Get technician location
   */
  abstract getTechnicianLocation(technicianId: string): Promise<any>;

  // ─── SCHEDULING ────────────────────────────────────────────────────────────

  /**
   * Create schedule
   */
  abstract createSchedule(schedule: Schedule): Promise<Schedule>;

  /**
   * List available time slots
   */
  abstract listAvailableSlots(
    technicianId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ start: Date; end: Date }>>;

  /**
   * Schedule job for technician
   */
  abstract scheduleJob(jobId: string, technicianId: string, start: Date): Promise<Job>;

  // ─── EQUIPMENT MANAGEMENT ──────────────────────────────────────────────────

  /**
   * Get equipment by ID
   */
  abstract getEquipment(equipmentId: string): Promise<Equipment>;

  /**
   * List equipment
   */
  abstract listEquipment(params?: PaginationParams): Promise<PaginatedResult<Equipment>>;

  /**
   * Get equipment service history
   */
  abstract getEquipmentServiceHistory(equipmentId: string): Promise<any[]>;

  // ─── CUSTOMER MANAGEMENT ───────────────────────────────────────────────────

  /**
   * Create customer
   */
  abstract createCustomer(customer: CustomerRecord): Promise<CustomerRecord>;

  /**
   * Get customer by ID
   */
  abstract getCustomer(customerId: string): Promise<CustomerRecord>;

  /**
   * Update customer
   */
  abstract updateCustomer(customerId: string, updates: Partial<CustomerRecord>): Promise<CustomerRecord>;

  /**
   * List customers
   */
  abstract listCustomers(params?: PaginationParams): Promise<PaginatedResult<CustomerRecord>>;

  // ─── ESTIMATES & INVOICES ──────────────────────────────────────────────────

  /**
   * Create estimate
   */
  abstract createEstimate(estimate: Estimate): Promise<Estimate>;

  /**
   * Get estimate by ID
   */
  abstract getEstimate(estimateId: string): Promise<Estimate>;

  /**
   * Create invoice
   */
  abstract createInvoice(invoice: Invoice): Promise<Invoice>;

  /**
   * Get invoice by ID
   */
  abstract getInvoice(invoiceId: string): Promise<Invoice>;

  /**
   * List invoices
   */
  abstract listInvoices(params?: PaginationParams): Promise<PaginatedResult<Invoice>>;

  /**
   * Record invoice payment
   */
  abstract recordPayment(invoiceId: string, amount: number, method: string): Promise<Invoice>;

  // ─── DISPATCH OPERATIONS ───────────────────────────────────────────────────

  /**
   * Create dispatch assignment
   */
  abstract createDispatchAssignment(assignment: DispatchAssignment): Promise<DispatchAssignment>;

  /**
   * Get dispatch assignment
   */
  abstract getDispatchAssignment(assignmentId: string): Promise<DispatchAssignment>;

  /**
   * Update dispatch assignment
   */
  abstract updateDispatchAssignment(
    assignmentId: string,
    updates: Partial<DispatchAssignment>,
  ): Promise<DispatchAssignment>;

  /**
   * Cancel dispatch assignment
   */
  abstract cancelDispatchAssignment(assignmentId: string): Promise<void>;

  // ─── BATCH OPERATIONS ──────────────────────────────────────────────────────

  /**
   * Batch create jobs
   */
  abstract batchCreateJobs(jobs: Job[]): Promise<FieldServiceBatchResult<Job>>;

  /**
   * Batch update jobs
   */
  abstract batchUpdateJobs(
    updates: Array<{ jobId: string; data: Partial<Job> }>,
  ): Promise<FieldServiceBatchResult<Job>>;

  /**
   * Get rate limit info
   */
  getRateLimitInfo(): RateLimitInfo {
    return this.rateLimiter.getInfo();
  }

  /**
   * Create operation error
   */
  protected createOperationError(
    message: string,
    code?: string,
    statusCode?: number,
    retryable: boolean = true,
  ): FieldServiceOperationError {
    const error = new Error(message) as any;
    error.provider = this.provider;
    error.code = code;
    error.statusCode = statusCode;
    error.retryable = retryable;
    return error as FieldServiceOperationError;
  }
}
