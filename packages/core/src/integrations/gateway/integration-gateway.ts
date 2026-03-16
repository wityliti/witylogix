/**
 * Integration Gateway — Unified HTTP client for all provider API calls
 *
 * Features:
 * - Unified HTTP client wrapper for provider APIs
 * - Request/response logging with correlation IDs
 * - Per-provider rate limit tracking (sliding window)
 * - Circuit breaker pattern per provider
 * - Retry with exponential backoff
 * - Request/response interceptors for auth injection
 * - Unified error mapping to Witylogix error codes
 * - Metrics collection (latency, success rate, error rate)
 * - Configurable timeouts per provider
 *
 * Circuit Breaker States:
 * - CLOSED: Normal operation
 * - OPEN: Failing, reject requests immediately
 * - HALF_OPEN: Testing if service recovered
 */

// ─── Types ──────────────────────────────────────────────────────────

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
}

/**
 * HTTP response
 */
export interface HttpResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
}

/**
 * Provider-specific rate limit configuration
 */
export interface RateLimitConfig {
  /** Requests per window (e.g., 100 requests per 60 seconds) */
  requestsPerWindow: number;
  /** Window duration in seconds */
  windowSec: number;
}

/**
 * Provider-specific retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;
  /** Initial backoff in milliseconds */
  initialBackoffMs: number;
  /** Maximum backoff in milliseconds */
  maxBackoffMs: number;
  /** Backoff multiplier */
  multiplier: number;
  /** HTTP status codes to retry on */
  retryableStatusCodes: number[];
}

/**
 * Provider-specific gateway configuration
 */
export interface ProviderGatewayConfig {
  /** Provider slug */
  providerId: string;
  /** Base API URL */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Rate limit configuration */
  rateLimit?: RateLimitConfig;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures to trigger circuit break */
  failureThreshold: number;
  /** Time in milliseconds to wait before attempting to recover */
  resetTimeoutMs: number;
  /** Number of successful requests needed to close circuit */
  successThreshold: number;
}

/**
 * Request/response interceptor
 */
export interface HttpInterceptor {
  onRequest?(options: HttpRequestOptions): Promise<HttpRequestOptions>;
  onResponse?<T>(response: HttpResponse<T>): Promise<HttpResponse<T>>;
  onError?(error: unknown): Promise<void>;
}

/**
 * Gateway configuration
 */
export interface IntegrationGatewayConfig {
  /** HTTP client implementation */
  httpClient: IHttpClient;
  /** Metrics collector */
  metricsCollector?: IMetricsCollector;
  /** Request/response interceptors */
  interceptors?: HttpInterceptor[];
}

/**
 * HTTP client interface
 */
export interface IHttpClient {
  request<T>(options: HttpRequestOptions): Promise<HttpResponse<T>>;
}

/**
 * Metrics collector interface
 */
export interface IMetricsCollector {
  recordRequest(
    providerId: string,
    method: string,
    status: number,
    durationMs: number,
    error?: string,
  ): Promise<void>;
}

/**
 * Rate limit state
 */
interface RateLimitState {
  requests: number[];
  lastResetTime: number;
}

/**
 * Circuit breaker state
 */
type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerData {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

// ─── Constants ───────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_BACKOFF_MS = 100;
const DEFAULT_MAX_BACKOFF_MS = 10000;
const DEFAULT_BACKOFF_MULTIPLIER = 2;
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// ─── Integration Gateway ────────────────────────────────────────────

export class IntegrationGateway {
  private httpClient: IHttpClient;
  private metricsCollector?: IMetricsCollector;
  private interceptors: HttpInterceptor[] = [];
  private providers: Map<string, ProviderGatewayConfig> = new Map();
  private rateLimitStates: Map<string, RateLimitState> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerData> = new Map();

  constructor(config: IntegrationGatewayConfig) {
    this.httpClient = config.httpClient;
    this.metricsCollector = config.metricsCollector;
    this.interceptors = config.interceptors ?? [];
  }

  /**
   * Register a provider configuration
   */
  registerProvider(config: ProviderGatewayConfig): void {
    this.providers.set(config.providerId, config);

    // Initialize circuit breaker
    if (config.circuitBreaker) {
      this.circuitBreakers.set(config.providerId, {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      });
    }
  }

  /**
   * Make HTTP request to provider API
   */
  async request<T>(
    providerId: string,
    options: Partial<HttpRequestOptions>,
  ): Promise<HttpResponse<T>> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider "${providerId}" not registered`);
    }

    const fullOptions: HttpRequestOptions = {
      method: options.method || 'GET',
      url: `${provider.baseUrl}${options.url}`,
      headers: options.headers,
      body: options.body,
      timeout: options.timeout ?? provider.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      retries: options.retries ?? this.getRetryConfig(provider).maxRetries,
    };

    return this.makeRequest<T>(providerId, provider, fullOptions);
  }

  /**
   * Make GET request
   */
  async get<T>(providerId: string, path: string, options?: Partial<HttpRequestOptions>): Promise<T> {
    const response = await this.request<T>(providerId, {
      ...options,
      method: 'GET',
      url: path,
    });
    return response.data;
  }

  /**
   * Make POST request
   */
  async post<T>(providerId: string, path: string, body?: unknown, options?: Partial<HttpRequestOptions>): Promise<T> {
    const response = await this.request<T>(providerId, {
      ...options,
      method: 'POST',
      url: path,
      body,
    });
    return response.data;
  }

  /**
   * Make PUT request
   */
  async put<T>(providerId: string, path: string, body?: unknown, options?: Partial<HttpRequestOptions>): Promise<T> {
    const response = await this.request<T>(providerId, {
      ...options,
      method: 'PUT',
      url: path,
      body,
    });
    return response.data;
  }

  /**
   * Make PATCH request
   */
  async patch<T>(providerId: string, path: string, body?: unknown, options?: Partial<HttpRequestOptions>): Promise<T> {
    const response = await this.request<T>(providerId, {
      ...options,
      method: 'PATCH',
      url: path,
      body,
    });
    return response.data;
  }

  /**
   * Make DELETE request
   */
  async delete<T>(providerId: string, path: string, options?: Partial<HttpRequestOptions>): Promise<T> {
    const response = await this.request<T>(providerId, {
      ...options,
      method: 'DELETE',
      url: path,
    });
    return response.data;
  }

  /**
   * Get rate limit status for provider
   */
  getRateLimitStatus(providerId: string): { remaining: number; resetAt: Date } | null {
    const provider = this.providers.get(providerId);
    if (!provider?.rateLimit) return null;

    const state = this.rateLimitStates.get(providerId);
    const now = Date.now();
    const windowMs = provider.rateLimit.windowSec * 1000;

    if (!state) {
      return {
        remaining: provider.rateLimit.requestsPerWindow,
        resetAt: new Date(now + windowMs),
      };
    }

    // Clean old requests outside window
    const validRequests = state.requests.filter((time) => time > now - windowMs);

    return {
      remaining: Math.max(0, provider.rateLimit.requestsPerWindow - validRequests.length),
      resetAt: new Date(state.lastResetTime + windowMs),
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(providerId: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(providerId)?.state ?? null;
  }

  // ─── Private Methods ────────────────────────────────────────────

  private async makeRequest<T>(
    providerId: string,
    provider: ProviderGatewayConfig,
    options: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    const startTime = Date.now();
    const correlationId = this.generateCorrelationId();

    // Check circuit breaker
    if (!this.checkCircuitBreaker(providerId)) {
      throw new Error(`Circuit breaker OPEN for provider "${providerId}"`);
    }

    // Check rate limits
    if (!this.checkRateLimit(providerId, provider)) {
      throw new Error(`Rate limit exceeded for provider "${providerId}"`);
    }

    try {
      // Add correlation ID to headers
      const requestOptions: HttpRequestOptions = {
        ...options,
        headers: {
          ...options.headers,
          'X-Request-ID': correlationId,
        },
      };

      // Run request interceptors
      for (const interceptor of this.interceptors) {
        if (interceptor.onRequest) {
          requestOptions.headers = (await interceptor.onRequest(requestOptions)).headers ?? requestOptions.headers;
        }
      }

      // Record rate limit usage
      this.recordRateLimit(providerId);

      // Perform request with retries
      const response = await this.requestWithRetries<T>(provider, requestOptions);

      // Run response interceptors
      let finalResponse = response;
      for (const interceptor of this.interceptors) {
        if (interceptor.onResponse) {
          finalResponse = await interceptor.onResponse<T>(finalResponse);
        }
      }

      // Record success
      this.recordCircuitBreakerSuccess(providerId);

      const duration = Date.now() - startTime;
      await this.recordMetrics(providerId, options.method, response.status, duration);

      return finalResponse;
    } catch (error) {
      // Record failure
      this.recordCircuitBreakerFailure(providerId);

      const duration = Date.now() - startTime;
      await this.recordMetrics(providerId, options.method, 0, duration, String(error));

      // Run error interceptors
      for (const interceptor of this.interceptors) {
        if (interceptor.onError) {
          await interceptor.onError(error);
        }
      }

      throw error;
    }
  }

  private async requestWithRetries<T>(
    provider: ProviderGatewayConfig,
    options: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    const retryConfig = this.getRetryConfig(provider);
    let lastError: unknown;
    let backoffMs = retryConfig.initialBackoffMs;

    for (let attempt = 0; attempt <= options.retries!; attempt++) {
      try {
        return await this.httpClient.request<T>(options);
      } catch (error) {
        lastError = error;

        // Check if we should retry
        const statusCode = this.extractStatusCode(error);
        const shouldRetry =
          attempt < options.retries! &&
          retryConfig.retryableStatusCodes.includes(statusCode);

        if (!shouldRetry) {
          throw error;
        }

        // Wait before retrying
        await this.delay(backoffMs);
        backoffMs = Math.min(backoffMs * retryConfig.multiplier, retryConfig.maxBackoffMs);
      }
    }

    throw lastError;
  }

  private checkCircuitBreaker(providerId: string): boolean {
    const breaker = this.circuitBreakers.get(providerId);
    if (!breaker) return true; // No circuit breaker configured

    const now = Date.now();

    if (breaker.state === 'CLOSED') {
      return true;
    }

    if (breaker.state === 'OPEN') {
      // Check if we should attempt recovery
      if (now >= breaker.nextAttemptTime) {
        breaker.state = 'HALF_OPEN';
        breaker.successCount = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN: allow request to proceed
    return true;
  }

  private recordCircuitBreakerSuccess(providerId: string): void {
    const breaker = this.circuitBreakers.get(providerId);
    if (!breaker) return;

    if (breaker.state === 'HALF_OPEN') {
      breaker.successCount++;
      const config = this.providers.get(providerId)?.circuitBreaker;
      if (config && breaker.successCount >= config.successThreshold) {
        breaker.state = 'CLOSED';
        breaker.failureCount = 0;
        breaker.successCount = 0;
      }
    }
  }

  private recordCircuitBreakerFailure(providerId: string): void {
    const breaker = this.circuitBreakers.get(providerId);
    if (!breaker) return;

    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();
    const config = this.providers.get(providerId)?.circuitBreaker;

    if (config && breaker.failureCount >= config.failureThreshold) {
      breaker.state = 'OPEN';
      breaker.nextAttemptTime = Date.now() + config.resetTimeoutMs;
    }
  }

  private checkRateLimit(providerId: string, provider: ProviderGatewayConfig): boolean {
    if (!provider.rateLimit) return true;

    const status = this.getRateLimitStatus(providerId);
    return status ? status.remaining > 0 : true;
  }

  private recordRateLimit(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (!provider?.rateLimit) return;

    let state = this.rateLimitStates.get(providerId);
    if (!state) {
      state = { requests: [], lastResetTime: Date.now() };
      this.rateLimitStates.set(providerId, state);
    }

    state.requests.push(Date.now());
  }

  private getRetryConfig(provider: ProviderGatewayConfig): RetryConfig {
    return (
      provider.retry || {
        maxRetries: DEFAULT_MAX_RETRIES,
        initialBackoffMs: DEFAULT_INITIAL_BACKOFF_MS,
        maxBackoffMs: DEFAULT_MAX_BACKOFF_MS,
        multiplier: DEFAULT_BACKOFF_MULTIPLIER,
        retryableStatusCodes: RETRYABLE_STATUS_CODES,
      }
    );
  }

  private async recordMetrics(
    providerId: string,
    method: string,
    status: number,
    durationMs: number,
    error?: string,
  ): Promise<void> {
    if (!this.metricsCollector) return;

    await this.metricsCollector.recordRequest(providerId, method, status, durationMs, error);
  }

  private generateCorrelationId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractStatusCode(error: unknown): number {
    if (error instanceof Error && 'statusCode' in error) {
      return (error as any).statusCode ?? 500;
    }
    return 500;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
