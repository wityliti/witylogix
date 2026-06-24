/**
 * Abstract Email Adapter Base Class.
 *
 * Provides common functionality for all email providers:
 * - Rate limiting (token bucket algorithm)
 * - Circuit breaker pattern for failover
 * - Retry logic with exponential backoff
 * - Template rendering with variable substitution
 * - Attachment handling (inline + file, size limits)
 * - Bounce handling and suppression management
 * - Open/click tracking pixel injection
 */

import { EmailEventType } from "./types.js";
import type {
  EmailAdapterConfig,
  EmailMessage,
  EmailRecipient,
  EmailAttachment,
  EmailTemplate,
  BulkEmailRequest,
  EmailDeliveryStatus,
  SuppressionEntry,
  EmailEvent,
  EmailStats,
  DeliveryStatus,
  DomainVerification,
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

        if (attempt === this.maxRetries || !isRetryable(lastError)) {
          throw lastError;
        }

        const delay = Math.min(
          this.baseDelay * Math.pow(2, attempt),
          this.maxDelay
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  getMaxRetries(): number {
    return this.maxRetries;
  }
}

/**
 * Result of sending an email message.
 */
export interface SendResult {
  messageId: string;
  timestamp: Date;
  provider: string;
  status: "pending" | "sent" | "failed";
  error?: string;
  rawResponse?: Record<string, unknown>;
}

/**
 * Abstract base class for email adapters.
 * All concrete implementations (Mailgun, SES, Gmail, Outlook) extend this.
 */
export abstract class EmailAdapter {
  /** Email provider name (e.g., "mailgun", "ses", "gmail", "outlook") */
  abstract readonly provider: string;

  /** Configuration for this adapter instance */
  protected config: EmailAdapterConfig;

  /** Rate limiter instance */
  protected rateLimiter: RateLimiter;

  /** Circuit breaker instance */
  protected circuitBreaker: CircuitBreaker;

  /** Retry handler instance */
  protected retryHandler: RetryHandler;

  /** Suppression list (email -> suppression reason) */
  protected suppressionList: Map<string, SuppressionEntry> = new Map();

  /** Logger instance (no-op by default, override in subclass or pass via config) */
  protected logger: {
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };

  constructor(config: EmailAdapterConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(1000, 10); // 1000 tokens, 10/sec refill
    this.circuitBreaker = new CircuitBreaker(5, 60000);
    this.retryHandler = new RetryHandler(3, 1000, 30000);

    // Default no-op logger
    this.logger = {
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
    };
  }

  /**
   * Send a single email message.
   *
   * @param message Email message to send
   * @returns Send result with message ID
   * @throws {Error} If message cannot be sent
   */
  abstract send(message: EmailMessage): Promise<SendResult>;

  /**
   * Send multiple emails in bulk.
   *
   * @param request Bulk send request
   * @returns Results for each recipient
   * @throws {Error} If bulk send fails
   */
  abstract sendBatch(request: BulkEmailRequest): Promise<SendResult[]>;

  /**
   * Get delivery status of a message.
   *
   * @param messageId Message ID from send response
   * @returns Delivery status and tracking info
   * @throws {Error} If message not found or API error
   */
  abstract getStatus(messageId: string): Promise<EmailDeliveryStatus>;

  /**
   * List domains registered with this provider.
   *
   * @returns Array of domain verifications
   * @throws {Error} If API error
   */
  abstract listDomains(): Promise<DomainVerification[]>;

  /**
   * Validate an email address (syntax, MX, mailbox).
   *
   * @param email Email address to validate
   * @returns Validation result
   * @throws {Error} If API error
   */
  abstract validateEmail(email: string): Promise<{
    email: string;
    valid: boolean;
    reason?: string;
  }>;

  /**
   * Render template with variable substitution (Handlebars-style {{var}}).
   *
   * @param template Template string
   * @param variables Variables to substitute
   * @returns Rendered template
   */
  protected renderTemplate(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Inject open tracking pixel into HTML body.
   *
   * @param htmlBody HTML body content
   * @param messageId Message ID for tracking
   * @returns HTML with tracking pixel injected
   */
  protected injectOpenTracking(htmlBody: string, messageId: string): string {
    const trackingPixel = `<img src="https://${this.config.tenantId}.track.example.com/open/${messageId}" width="1" height="1" style="display:none;" />`;

    // Inject before closing </body> tag, or at end if no body tag
    if (htmlBody.includes("</body>")) {
      return htmlBody.replace("</body>", `${trackingPixel}</body>`);
    }
    return htmlBody + trackingPixel;
  }

  /**
   * Inject click tracking into HTML links.
   *
   * @param htmlBody HTML body content
   * @param messageId Message ID for tracking
   * @returns HTML with click tracking enabled
   */
  protected injectClickTracking(htmlBody: string, messageId: string): string {
    // Replace href="..." with tracking URL
    return htmlBody.replace(
      /href="([^"]*)"/g,
      (match, url) => {
        if (!url || url.startsWith("mailto:")) return match;
        const encoded = encodeURIComponent(url);
        return `href="https://${this.config.tenantId}.track.example.com/click/${messageId}/${encoded}"`;
      }
    );
  }

  /**
   * Validate attachment sizes and count.
   *
   * @param attachments Attachments to validate
   * @throws {Error} If attachments exceed limits
   */
  protected validateAttachments(attachments?: EmailAttachment[]): void {
    if (!attachments) return;

    const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB
    const MAX_ATTACHMENT_COUNT = 10;

    if (attachments.length > MAX_ATTACHMENT_COUNT) {
      throw new Error(
        `Too many attachments. Maximum ${MAX_ATTACHMENT_COUNT} allowed, got ${attachments.length}`
      );
    }

    for (const attachment of attachments) {
      const size = typeof attachment.content === "string"
        ? attachment.content.length
        : attachment.content.length;

      if (size > MAX_ATTACHMENT_SIZE) {
        throw new Error(
          `Attachment "${attachment.filename}" exceeds maximum size of ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB`
        );
      }
    }
  }

  /**
   * Check if email is in suppression list.
   *
   * @param email Email address to check
   * @returns Suppression entry if suppressed, undefined otherwise
   */
  protected isEmailSuppressed(email: string): SuppressionEntry | undefined {
    return this.suppressionList.get(email.toLowerCase());
  }

  /**
   * Add email to suppression list.
   *
   * @param email Email address to suppress
   * @param entry Suppression entry details
   */
  protected addToSuppressionList(email: string, entry: SuppressionEntry): void {
    this.suppressionList.set(email.toLowerCase(), entry);
  }

  /**
   * Handle bounce event and update suppression list.
   *
   * @param event Email event from webhook
   */
  protected handleBounceEvent(event: EmailEvent): void {
    if (event.type !== EmailEventType.BOUNCED) return;

    const entry: SuppressionEntry = {
      email: event.recipient,
      type: "bounce",
      bounceType: event.bounceType,
      reason: event.bounceReason,
      suppressedAt: event.timestamp,
    };

    this.addToSuppressionList(event.recipient, entry);
  }

  /**
   * Handle complaint event and update suppression list.
   *
   * @param event Email event from webhook
   */
  protected handleComplaintEvent(event: EmailEvent): void {
    if (event.type !== EmailEventType.COMPLAINED) return;

    const entry: SuppressionEntry = {
      email: event.recipient,
      type: "complaint",
      reason: "User complaint/spam report",
      suppressedAt: event.timestamp,
    };

    this.addToSuppressionList(event.recipient, entry);
  }

  /**
   * Validate the adapter configuration.
   * Called during adapter instantiation to check credentials.
   *
   * @throws {Error} If configuration is invalid
   */
  abstract validateConfig(): Promise<void>;

  /**
   * Health check — verify API connectivity and authentication.
   *
   * @returns true if healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.validateConfig();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get provider health status.
   *
   * @returns Health status details
   */
  async getHealth(): Promise<{
    healthy: boolean;
    provider: string;
    circuitBreakerState: string;
    rateLimitAvailable: number;
    failureCount: number;
  }> {
    return {
      healthy: await this.healthCheck(),
      provider: this.provider,
      circuitBreakerState: this.circuitBreaker.getState(),
      rateLimitAvailable: this.rateLimiter.getAvailable(),
      failureCount: this.circuitBreaker.getFailureCount(),
    };
  }

  /**
   * Get email statistics for time period.
   *
   * @param startDate Period start
   * @param endDate Period end
   * @returns Email statistics
   */
  abstract getStats(startDate: Date, endDate: Date): Promise<EmailStats>;

  /**
   * Create or update an email template.
   *
   * @param template Template definition
   * @returns Created/updated template
   */
  abstract saveTemplate(template: EmailTemplate): Promise<EmailTemplate>;

  /**
   * Get a saved email template.
   *
   * @param templateId Template ID
   * @returns Template definition
   */
  abstract getTemplate(templateId: string): Promise<EmailTemplate>;

  /**
   * List all templates.
   *
   * @returns Array of templates
   */
  abstract listTemplates(): Promise<EmailTemplate[]>;

  /**
   * Delete an email template.
   *
   * @param templateId Template ID to delete
   */
  abstract deleteTemplate(templateId: string): Promise<void>;

  /**
   * Get current suppression list.
   *
   * @returns Array of suppressed email entries
   */
  getSuppression(): SuppressionEntry[] {
    return Array.from(this.suppressionList.values());
  }

  /**
   * Remove email from suppression list.
   *
   * @param email Email address to unsuppress
   */
  removeSuppression(email: string): void {
    this.suppressionList.delete(email.toLowerCase());
  }

  /**
   * Clear all suppressions.
   */
  clearSuppressions(): void {
    this.suppressionList.clear();
  }
}
