/**
 * Abstract Messaging Adapter Base Class.
 *
 * Provides common functionality for all messaging providers:
 * - Rate limiting
 * - Circuit breaker pattern
 * - Retry logic
 * - Template rendering
 * - Delivery tracking
 * - Batch operations
 * - Health monitoring
 */

import type {
  MessagingAdapterConfig,
  SMSMessage,
  PushNotification,
  InAppMessage,
  BulkMessage,
  MessageTemplate,
  DeliveryStatus,
  DeliveryReceipt,
  WebhookPayload,
  SendResult,
  BatchSendResult,
  ProviderCapabilities,
  ProviderHealth,
  RateLimitConfig,
} from "./types.js";

/**
 * Rate limiter using token bucket algorithm.
 */
class RateLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private lastRefillAt: number = Date.now();

  constructor(capacity: number, refillRatePerSecond: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRatePerSecond;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefillAt) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillAt = now;
  }

  async acquire(tokens: number = 1): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= tokens) {
        this.tokens -= tokens;
        return;
      }
      // Wait 10ms and try again
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  getAvailable(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

/**
 * Circuit breaker for failing providers.
 */
class CircuitBreaker {
  private failures: number = 0;
  private lastFailureAt: number = 0;
  private state: "closed" | "open" | "half_open" = "closed";
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;

  constructor(failureThreshold: number = 5, resetTimeout: number = 60000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      const timeSinceLastFailure = Date.now() - this.lastFailureAt;
      if (timeSinceLastFailure > this.resetTimeout) {
        this.state = "half_open";
      } else {
        throw new Error(
          `Circuit breaker is open. Reset in ${this.resetTimeout - timeSinceLastFailure}ms`
        );
      }
    }

    try {
      const result = await fn();
      if (this.state === "half_open") {
        this.state = "closed";
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures += 1;
      this.lastFailureAt = Date.now();
      if (this.failures >= this.failureThreshold) {
        this.state = "open";
      }
      throw error;
    }
  }

  getState(): "closed" | "open" | "half_open" {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }
}

/**
 * Retry handler with exponential backoff.
 */
class RetryHandler {
  private readonly maxRetries: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;

  constructor(maxRetries: number = 3, baseDelay: number = 1000, maxDelay: number = 30000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  async execute<T>(
    fn: () => Promise<T>,
    isRetryable: (error: Error) => boolean = () => true
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt >= this.maxRetries || !isRetryable(lastError)) {
          throw lastError;
        }

        const delay = Math.min(
          this.maxDelay,
          this.baseDelay * Math.pow(2, attempt) + Math.random() * 1000
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error("Retry handler failed");
  }
}

/**
 * Abstract base class for messaging adapters.
 * All concrete implementations extend this class.
 */
export abstract class MessagingAdapter {
  /** Provider name (vonage, textmagic, onesignal, sendbird) */
  abstract readonly provider: string;

  /** Adapter configuration */
  protected config: MessagingAdapterConfig;

  /** Rate limiter instance */
  protected rateLimiter: RateLimiter;

  /** Circuit breaker instance */
  protected circuitBreaker: CircuitBreaker;

  /** Retry handler instance */
  protected retryHandler: RetryHandler;

  /** Message templates cache */
  protected templates: Map<string, MessageTemplate> = new Map();

  /** Delivery tracking store */
  protected deliveryTracking: Map<string, DeliveryStatus> = new Map();

  /** Provider health tracking */
  protected health: ProviderHealth;

  constructor(config: MessagingAdapterConfig) {
    this.config = config;

    const rateLimit = config.rateLimit || {};
    const requestsPerSecond = rateLimit.requestsPerSecond || 100;
    const concurrency = rateLimit.concurrency || 10;

    this.rateLimiter = new RateLimiter(concurrency, requestsPerSecond);
    this.circuitBreaker = new CircuitBreaker(5, 60000);
    this.retryHandler = new RetryHandler(3, 1000, 30000);

    this.health = {
      provider: config.provider,
      healthy: true,
      lastCheckAt: new Date(),
      consecutiveFailures: 0,
    };
  }

  /**
   * Get provider capabilities.
   * Implemented by subclasses to declare what they support.
   */
  abstract getCapabilities(): ProviderCapabilities;

  /**
   * Validate adapter configuration.
   * Implemented by subclasses to check credentials, etc.
   */
  abstract validateConfig(): Promise<void>;

  /**
   * Send a single SMS message.
   * Implemented by subclasses.
   */
  abstract sendSMS(message: SMSMessage): Promise<SendResult>;

  /**
   * Send a single push notification.
   * Implemented by subclasses.
   */
  abstract sendPush(notification: PushNotification): Promise<SendResult>;

  /**
   * Send in-app message.
   * Implemented by subclasses.
   */
  abstract sendInApp(message: InAppMessage): Promise<SendResult>;

  /**
   * Handle incoming webhook payload (delivery receipt, etc.).
   */
  abstract handleWebhook(payload: WebhookPayload): Promise<void>;

  /**
   * Register a message template.
   */
  async registerTemplate(template: MessageTemplate): Promise<void> {
    this.templates.set(template.id, template);
  }

  /**
   * Get a message template by ID.
   */
  protected getTemplate(templateId: string): MessageTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Render template with variable substitution.
   * Replaces {{variable}} placeholders with values.
   */
  protected renderTemplate(template: MessageTemplate, variables: Record<string, unknown>): string {
    let content = template.body;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder, "g"), String(value));
    }
    return content;
  }

  /**
   * Track message delivery status.
   */
  protected trackDelivery(messageId: string, status: DeliveryStatus): void {
    this.deliveryTracking.set(messageId, status);
  }

  /**
   * Get tracked delivery status.
   */
  protected getDeliveryStatus(messageId: string): DeliveryStatus | undefined {
    return this.deliveryTracking.get(messageId);
  }

  /**
   * Send bulk messages with configurable concurrency.
   */
  async sendBulk(bulk: BulkMessage): Promise<BatchSendResult> {
    const batchId = bulk.batchId || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const results = new Map<string, SendResult>();
    const concurrency = bulk.concurrency || 10;

    let totalCost = 0;
    let sent = 0;
    let failed = 0;

    // Process recipients in batches
    for (let i = 0; i < bulk.recipients.length; i += concurrency) {
      const batch = bulk.recipients.slice(i, i + concurrency);
      const promises = batch.map(async (recipient) => {
        try {
          let result: SendResult;

          if (bulk.type === "sms") {
            const smsMessage: SMSMessage = {
              to: recipient,
              body: bulk.content?.body || "",
              from: this.config.apiKey || "SENDER",
              scheduleFor: bulk.scheduleFor,
              tags: bulk.tags,
              metadata: bulk.metadata,
            };
            result = await this.sendSMS(smsMessage);
          } else if (bulk.type === "push") {
            const pushNotif: PushNotification = {
              to: recipient,
              title: bulk.content?.title || "Notification",
              body: bulk.content?.body || "",
              data: bulk.content?.data,
              scheduleFor: bulk.scheduleFor,
              tags: bulk.tags,
              metadata: bulk.metadata,
            };
            result = await this.sendPush(pushNotif);
          } else {
            const inAppMsg: InAppMessage = {
              targetUserId: recipient,
              title: bulk.content?.title || "Message",
              content: bulk.content?.body || "",
              scheduleFor: bulk.scheduleFor,
              metadata: bulk.metadata,
            };
            result = await this.sendInApp(inAppMsg);
          }

          results.set(recipient, result);
          if (result.success) {
            sent += 1;
            if (result.cost) totalCost += result.cost;
          } else {
            failed += 1;
          }
        } catch (error) {
          failed += 1;
          results.set(recipient, {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
          });
        }
      });

      await Promise.allSettled(promises);
    }

    return {
      batchId,
      total: bulk.recipients.length,
      sent,
      failed,
      results,
      totalCost: totalCost || undefined,
      timestamp: new Date(),
    };
  }

  /**
   * Perform health check — verify API connectivity.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.validateConfig();
      this.health.healthy = true;
      this.health.consecutiveFailures = 0;
      this.health.lastCheckAt = new Date();
      return true;
    } catch (error) {
      this.health.healthy = false;
      this.health.consecutiveFailures += 1;
      this.health.lastError = error instanceof Error ? error : new Error(String(error));
      this.health.lastCheckAt = new Date();
      return false;
    }
  }

  /**
   * Get current provider health status.
   */
  getHealth(): ProviderHealth {
    return { ...this.health };
  }

  /**
   * Get current rate limiter state.
   */
  getRateLimitState(): number {
    return this.rateLimiter.getAvailable();
  }

  /**
   * Get circuit breaker state.
   */
  getCircuitBreakerState(): "closed" | "open" | "half_open" {
    return this.circuitBreaker.getState();
  }

  /**
   * Wait for rate limit token to be available.
   */
  protected async waitForRateLimit(): Promise<void> {
    await this.rateLimiter.acquire(1);
  }

  /**
   * Execute operation with circuit breaker, rate limiting, and retry.
   */
  protected async executeWithProtections<T>(
    operation: () => Promise<T>,
    isRetryable: (error: Error) => boolean = () => true
  ): Promise<T> {
    await this.waitForRateLimit();
    return this.circuitBreaker.execute(() => this.retryHandler.execute(operation, isRetryable));
  }
}
