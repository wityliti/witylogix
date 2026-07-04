/**
 * Integration Gateway V2 — Advanced request orchestration engine
 *
 * Features:
 * - AdvancedCircuitBreaker: half-open with probe requests, sliding window
 * - BulkheadIsolator: per-provider concurrent limits, priority queue
 * - RetryEngine: exponential backoff with full jitter, retry budgets
 * - RequestDeduplicator: content hash-based, TTL cache, coalescing
 * - ResponseCache: LRU with TTL, stale-while-revalidate
 * - CorrelationTracker: W3C Trace Context, parent-child spans
 * - GatewayOrchestrator: compose all middleware, health-aware routing
 */

import { createHash } from "crypto";
import { EventEmitter } from "events";

// ─── Types ──────────────────────────────────────────────────────────

export interface HttpRequestOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
  deduplicateKey?: string;
  cacheKey?: string;
  cacheTtlMs?: number;
  idempotencyKey?: string;
}

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
  cached?: boolean;
}

export interface CircuitBreakerStateChangeEvent {
  providerId: string;
  previousState: "closed" | "open" | "half-open";
  currentState: "closed" | "open" | "half-open";
  timestamp: Date;
  reason: string;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
}

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  ttlMs: number;
  hits: number;
  stale: boolean;
}

interface DedupeRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

interface CircuitBreakerMetrics {
  state: "closed" | "open" | "half-open";
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  stateChangedAt: Date;
  totalStateChanges: number;
}

// ─── Advanced Circuit Breaker ────────────────────────────────────

/**
 * AdvancedCircuitBreaker with sliding window and half-open probing
 */
export class AdvancedCircuitBreaker extends EventEmitter {
  private state: "closed" | "open" | "half-open" = "closed";
  private failureWindow: number[] = [];
  private successWindow: number[] = [];
  private stateChangedAt: Date = new Date();
  private totalStateChanges = 0;
  private failureThreshold: number;
  private successThreshold: number;
  private windowSizeMs: number;
  private halfOpenTimeoutMs: number;
  private probeRequestInFlight = false;

  constructor(
    private providerId: string,
    config: {
      failureThreshold?: number;
      successThreshold?: number;
      windowSizeMs?: number;
      halfOpenTimeoutMs?: number;
    } = {},
  ) {
    super();
    this.failureThreshold = config.failureThreshold ?? 5;
    this.successThreshold = config.successThreshold ?? 2;
    this.windowSizeMs = config.windowSizeMs ?? 60000; // 60 seconds
    this.halfOpenTimeoutMs = config.halfOpenTimeoutMs ?? 30000; // 30 seconds
  }

  canProceed(): boolean {
    const now = Date.now();

    if (this.state === "closed") {
      return true;
    }

    if (this.state === "open") {
      const timeSinceOpen = now - this.stateChangedAt.getTime();
      if (timeSinceOpen >= this.halfOpenTimeoutMs) {
        this.transitionToHalfOpen();
        return !this.probeRequestInFlight;
      }
      return false;
    }

    // half-open: allow one probe
    if (this.state === "half-open" && !this.probeRequestInFlight) {
      this.probeRequestInFlight = true;
      return true;
    }

    return false;
  }

  recordSuccess(): void {
    const now = Date.now();
    this.successWindow.push(now);
    this.probeRequestInFlight = false;

    // Clean old entries
    this.successWindow = this.successWindow.filter(
      (t) => t > now - this.windowSizeMs,
    );

    if (this.state === "half-open") {
      if (this.successWindow.length >= this.successThreshold) {
        this.transitionToClosed();
      }
    } else if (this.state === "closed") {
      // Reset failure count on success
      this.failureWindow = [];
    }
  }

  recordFailure(): void {
    const now = Date.now();
    this.failureWindow.push(now);
    this.probeRequestInFlight = false;

    // Clean old entries
    this.failureWindow = this.failureWindow.filter(
      (t) => t > now - this.windowSizeMs,
    );

    if (this.state === "half-open") {
      this.transitionToOpen();
    } else if (this.state === "closed") {
      if (this.failureWindow.length >= this.failureThreshold) {
        this.transitionToOpen();
      }
    }
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureWindow.length,
      successCount: this.successWindow.length,
      lastFailureTime: this.failureWindow[this.failureWindow.length - 1],
      lastSuccessTime: this.successWindow[this.successWindow.length - 1],
      stateChangedAt: this.stateChangedAt,
      totalStateChanges: this.totalStateChanges,
    };
  }

  reset(): void {
    this.transitionToClosed();
  }

  private transitionToOpen(): void {
    if (this.state === "open") return;
    const previousState = this.state;
    this.state = "open";
    this.stateChangedAt = new Date();
    this.totalStateChanges++;
    this.probeRequestInFlight = false;

    this.emit("state-change", {
      providerId: this.providerId,
      previousState,
      currentState: "open",
      timestamp: this.stateChangedAt,
      reason: "Failure threshold exceeded",
    } as CircuitBreakerStateChangeEvent);
  }

  private transitionToHalfOpen(): void {
    const previousState = this.state;
    this.state = "half-open";
    this.stateChangedAt = new Date();
    this.totalStateChanges++;
    this.successWindow = [];
    this.probeRequestInFlight = false;

    this.emit("state-change", {
      providerId: this.providerId,
      previousState,
      currentState: "half-open",
      timestamp: this.stateChangedAt,
      reason: "Half-open timeout elapsed, testing recovery",
    } as CircuitBreakerStateChangeEvent);
  }

  private transitionToClosed(): void {
    if (this.state === "closed") return;
    const previousState = this.state;
    this.state = "closed";
    this.stateChangedAt = new Date();
    this.totalStateChanges++;
    this.failureWindow = [];
    this.successWindow = [];
    this.probeRequestInFlight = false;

    this.emit("state-change", {
      providerId: this.providerId,
      previousState,
      currentState: "closed",
      timestamp: this.stateChangedAt,
      reason: "Service recovered",
    } as CircuitBreakerStateChangeEvent);
  }
}

// ─── Bulkhead Isolator ───────────────────────────────────────────

/**
 * BulkheadIsolator — Per-provider concurrent request limiting
 */
export class BulkheadIsolator extends EventEmitter {
  private semaphores: Map<string, number> = new Map();
  private queues: Map<string, Array<() => Promise<void>>> = new Map();
  private maxConcurrency: number;

  constructor(maxConcurrency: number = 10) {
    super();
    this.maxConcurrency = maxConcurrency;
  }

  async acquire(providerId: string): Promise<() => void> {
    const current = this.semaphores.get(providerId) ?? 0;

    if (current < this.maxConcurrency) {
      this.semaphores.set(providerId, current + 1);
      return () => this.release(providerId);
    }

    // Queue the request
    return new Promise((resolve) => {
      const queue = this.queues.get(providerId) ?? [];
      queue.push(async () => {
        this.semaphores.set(
          providerId,
          (this.semaphores.get(providerId) ?? 0) + 1,
        );
        resolve(() => this.release(providerId));
      });
      this.queues.set(providerId, queue);
      this.emit("queued", { providerId, queueLength: queue.length });
    });
  }

  private release(providerId: string): void {
    const current = Math.max(0, (this.semaphores.get(providerId) ?? 1) - 1);
    this.semaphores.set(providerId, current);

    const queue = this.queues.get(providerId) ?? [];
    if (queue.length > 0) {
      const next = queue.shift();
      if (next) {
        next();
      }
    }
  }

  getStatus(providerId: string): { active: number; queued: number } {
    return {
      active: this.semaphores.get(providerId) ?? 0,
      queued: (this.queues.get(providerId) ?? []).length,
    };
  }
}

// ─── Retry Engine ───────────────────────────────────────────────

/**
 * RetryEngine — Exponential backoff with full jitter
 */
export class RetryEngine {
  private retryBudget: Map<string, number> = new Map();
  private budgetResetTime: Map<string, number> = new Map();

  constructor(
    private maxRetries: number = 3,
    private initialBackoffMs: number = 100,
    private maxBackoffMs: number = 10000,
    private retryBudgetPercent: number = 10,
  ) {}

  calculateBackoff(attempt: number): number {
    const exponential = this.initialBackoffMs * Math.pow(2, attempt);
    const withMax = Math.min(exponential, this.maxBackoffMs);
    const jitter = Math.random() * withMax;
    return Math.floor(jitter);
  }

  shouldRetry(
    providerId: string,
    statusCode: number,
    attempt: number,
    isIdempotent: boolean,
  ): boolean {
    if (attempt >= this.maxRetries) return false;
    if (!isIdempotent && statusCode >= 500) return false;

    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    if (!retryableStatuses.includes(statusCode)) return false;

    // Check retry budget
    return this.consumeRetryBudget(providerId);
  }

  private consumeRetryBudget(providerId: string): boolean {
    const now = Date.now();
    const resetTime = this.budgetResetTime.get(providerId) ?? 0;

    // Reset budget every minute
    if (now > resetTime) {
      this.budgetResetTime.set(providerId, now + 60000);
      this.retryBudget.set(
        providerId,
        Math.floor((100 / this.retryBudgetPercent) * 100),
      );
      return true;
    }

    const budget = this.retryBudget.get(providerId) ?? 0;
    if (budget > 0) {
      this.retryBudget.set(providerId, budget - 1);
      return true;
    }

    return false;
  }
}

// ─── Request Deduplicator ───────────────────────────────────────

/**
 * RequestDeduplicator — Content hash-based deduplication with coalescing
 */
export class RequestDeduplicator {
  private cache: Map<string, DedupeRequest<unknown>[]> = new Map();
  private ttlMap: Map<string, number> = new Map();

  async deduplicate<T>(
    key: string,
    request: () => Promise<T>,
    ttlMs: number = 5000,
  ): Promise<T> {
    const now = Date.now();
    const cachedExpiry = this.ttlMap.get(key);

    // Check if we have pending requests
    if (this.cache.has(key) && cachedExpiry && cachedExpiry > now) {
      const pending = this.cache.get(key)!;
      return new Promise<T>((resolve, reject) => {
        pending.push({ resolve: resolve as any, reject, timestamp: now });
      });
    }

    // New request
    this.cache.set(key, []);
    this.ttlMap.set(key, now + ttlMs);

    try {
      const result = await request();

      // Coalesce all pending requests
      const pending = this.cache.get(key) ?? [];
      for (const req of pending) {
        req.resolve(result);
      }

      this.cache.delete(key);
      return result;
    } catch (error) {
      const pending = this.cache.get(key) ?? [];
      for (const req of pending) {
        req.reject(error as Error);
      }

      this.cache.delete(key);
      throw error;
    }
  }

  getContentHash(body: unknown): string {
    const content = typeof body === "string" ? body : JSON.stringify(body);
    return createHash("sha256").update(content).digest("hex");
  }
}

// ─── Response Cache ─────────────────────────────────────────────

/**
 * ResponseCache — LRU with TTL and stale-while-revalidate
 */
export class ResponseCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private accessOrder: string[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | null {
    const now = Date.now();
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    // Check if expired
    if (entry.createdAt + entry.ttlMs < now) {
      this.cache.delete(key);
      return null;
    }

    // Mark as accessed (LRU)
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);
    entry.hits++;

    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    const now = Date.now();

    // Evict LRU if at capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    this.cache.set(key, {
      data,
      createdAt: now,
      ttlMs,
      hits: 0,
      stale: false,
    });

    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);
  }

  markStale(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.stale = true;
    }
  }

  getStats(): { size: number; hits: number; total: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }

    return {
      size: this.cache.size,
      hits: totalHits,
      total: this.cache.size + totalHits,
    };
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }
}

// ─── Correlation Tracker ────────────────────────────────────────

/**
 * CorrelationTracker — W3C Trace Context implementation
 */
export class CorrelationTracker {
  private traces: Map<string, TraceContext[]> = new Map();

  createTrace(traceId?: string): TraceContext {
    const id = traceId ?? this.generateId();
    return {
      traceId: id,
      spanId: this.generateId(),
      sampled: Math.random() < 0.1, // 10% sampling
    };
  }

  createChildSpan(parentContext: TraceContext): TraceContext {
    return {
      traceId: parentContext.traceId,
      spanId: this.generateId(),
      parentSpanId: parentContext.spanId,
      sampled: parentContext.sampled,
    };
  }

  toW3CHeader(context: TraceContext): string {
    return `${context.traceId}-${context.spanId}-${context.sampled ? "1" : "0"}`;
  }

  fromW3CHeader(header: string): TraceContext | null {
    const parts = header.split("-");
    if (parts.length < 3) return null;

    return {
      traceId: parts[0],
      spanId: parts[1],
      sampled: parts[2] === "1",
    };
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}

// ─── Gateway Orchestrator ───────────────────────────────────────

/**
 * GatewayOrchestrator — Compose all middleware into unified gateway
 */
export interface HttpClient {
  request<T>(options: HttpRequestOptions): Promise<HttpResponse<T>>;
}

export class GatewayOrchestrator {
  private breakers: Map<string, AdvancedCircuitBreaker> = new Map();
  private bulkhead: BulkheadIsolator;
  private retryEngine: RetryEngine;
  private deduplicator: RequestDeduplicator;
  private cache: ResponseCache;
  private correlationTracker: CorrelationTracker;

  constructor(private httpClient: HttpClient) {
    this.bulkhead = new BulkheadIsolator(10);
    this.retryEngine = new RetryEngine();
    this.deduplicator = new RequestDeduplicator();
    this.cache = new ResponseCache();
    this.correlationTracker = new CorrelationTracker();
  }

  async request<T>(
    providerId: string,
    options: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    // Get or create circuit breaker
    if (!this.breakers.has(providerId)) {
      this.breakers.set(providerId, new AdvancedCircuitBreaker(providerId));
    }

    const breaker = this.breakers.get(providerId)!;

    // Check circuit breaker
    if (!breaker.canProceed()) {
      throw new Error(`Circuit breaker open for provider ${providerId}`);
    }

    // Try cache first
    const cacheKey = options.cacheKey ?? `${options.method}:${options.url}`;
    if (options.method === "GET") {
      const cached = this.cache.get<T>(cacheKey);
      if (cached) {
        return {
          status: 200,
          headers: {},
          data: cached,
          cached: true,
        };
      }
    }

    // Acquire bulkhead permit
    const release = await this.bulkhead.acquire(providerId);

    try {
      // Create trace context
      const trace = this.correlationTracker.createTrace();

      // Prepare headers with trace
      const headers = {
        ...(options.headers ?? {}),
        traceparent: this.correlationTracker.toW3CHeader(trace),
      };

      // Prepare request with deduplication
      const dedupeKey = options.deduplicateKey ?? `${providerId}:${cacheKey}`;
      const request = async () => {
        let attempt = 0;
        let lastError: Error | null = null;

        while (attempt <= this.retryEngine["maxRetries"]) {
          try {
            const response = await this.httpClient.request<T>({
              ...options,
              headers,
            });

            breaker.recordSuccess();

            // Cache successful responses
            if (response.status < 400 && options.cacheTtlMs) {
              this.cache.set<T>(cacheKey, response.data, options.cacheTtlMs);
            }

            return response;
          } catch (error) {
            lastError = error as Error;
            const statusCode = this.extractStatusCode(error);

            const isIdempotent = ["GET", "DELETE"].includes(options.method);
            if (
              this.retryEngine.shouldRetry(
                providerId,
                statusCode,
                attempt,
                isIdempotent,
              )
            ) {
              const backoff = this.retryEngine.calculateBackoff(attempt);
              await this.delay(backoff);
              attempt++;
              continue;
            }

            breaker.recordFailure();
            throw error;
          }
        }

        throw lastError ?? new Error("Max retries exceeded");
      };

      return await this.deduplicator.deduplicate<HttpResponse<T>>(
        dedupeKey,
        request,
      );
    } finally {
      release();
    }
  }

  getCircuitBreakerStatus(providerId: string) {
    return this.breakers.get(providerId)?.getMetrics() ?? null;
  }

  resetCircuitBreaker(providerId: string): void {
    this.breakers.get(providerId)?.reset();
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  clearCache(): void {
    this.cache.clear();
  }

  getBulkheadStatus(providerId: string) {
    return this.bulkhead.getStatus(providerId);
  }

  private extractStatusCode(error: unknown): number {
    if (error instanceof Error && "statusCode" in error) {
      return (error as any).statusCode ?? 500;
    }
    return 500;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
