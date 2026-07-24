/**
 * Message dispatcher — routes messages to correct provider based on channel.
 *
 * Responsibilities:
 * - Route messages to appropriate provider
 * - Batch send with concurrency limiting and rate-limiting
 * - Retry logic with exponential backoff
 * - Dead letter handling for permanently failed messages
 * - Per-tenant rate limiting
 */

import type {
  Message,
  MessageTemplate,
  SendResult,
  BatchSendOptions,
  BatchSendResult,
} from "./types.js";
import {
  MessageChannel,
  MessagePriority,
  DeliveryStatus,
  MessagingError,
  RateLimitError,
} from "./types.js";
import { MessageProvider } from "./providers/base.js";
import { EmailProvider } from "./providers/email.js";
import { SmsProvider } from "./providers/sms.js";
import { WhatsAppProvider } from "./providers/whatsapp.js";
import { PushProvider } from "./providers/push.js";

/**
 * Message dispatcher for multi-channel delivery.
 */
export class MessageDispatcher {
  private providers: Map<MessageChannel, MessageProvider> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map(); // key: tenantId_channel
  private deadLetterQueue: Message[] = [];

  constructor(
    private config: {
      providers: {
        email?: {
          provider: "sendgrid" | "smtp" | "console";
          apiKey?: string;
          from: string;
          host?: string;
          port?: number;
          auth?: { user: string; pass: string };
        };
        sms?: { accountSid: string; authToken: string; fromNumber: string };
        whatsapp?: {
          phoneNumberId: string;
          businessAccountId: string;
          accessToken: string;
          webhookSecret?: string;
        };
        push?: { projectId: string; privateKey: string; clientEmail: string };
      };
      maxRetries?: number;
      retryBackoffMs?: number;
      rateLimitPerSecond?: number;
    },
  ) {
    this.initializeProviders();
  }

  /**
   * Initialize configured providers.
   */
  private initializeProviders(): void {
    if (this.config.providers.email) {
      this.providers.set(
        MessageChannel.EMAIL,
        new EmailProvider(this.config.providers.email),
      );
    }

    if (this.config.providers.sms) {
      this.providers.set(
        MessageChannel.SMS,
        new SmsProvider(this.config.providers.sms),
      );
    }

    if (this.config.providers.whatsapp) {
      this.providers.set(
        MessageChannel.WHATSAPP,
        new WhatsAppProvider(this.config.providers.whatsapp),
      );
    }

    if (this.config.providers.push) {
      this.providers.set(
        MessageChannel.PUSH,
        new PushProvider(this.config.providers.push),
      );
    }
  }

  /**
   * Send a single message.
   *
   * @param message Message to send
   * @returns Send result with status and external ID
   * @throws MessagingError for validation/auth/rate-limit errors
   */
  async send(message: Message): Promise<SendResult> {
    const provider = this.getProvider(message.channel);

    // Check rate limiting
    await this.checkRateLimit(message.tenantId, message.channel);

    // Send through provider
    const result = await provider.send(message);

    return result;
  }

  /**
   * Send multiple messages in parallel with concurrency control.
   *
   * @param messages Messages to send
   * @param options Batch options (concurrency, rate-limit, fail-fast)
   * @returns Batch result with success/failure counts
   */
  async sendBatch(
    messages: Message[],
    options: BatchSendOptions = {},
  ): Promise<BatchSendResult> {
    const { concurrencyLimit = 10, failFast = false, rateLimit } = options;

    const results: Array<SendResult & { messageId: string }> = [];
    const errors: Array<{ messageId: string; error: string }> = [];

    // Process messages with concurrency control
    let index = 0;
    const pending: Promise<void>[] = [];

    while (index < messages.length || pending.length > 0) {
      while (pending.length < concurrencyLimit && index < messages.length) {
        const message = messages[index];
        index++;

        const promise = this.sendWithRetry(message, rateLimit)
          .then((result) => {
            results.push({ ...result, messageId: message.id });
          })
          .catch((error) => {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            errors.push({ messageId: message.id, error: errorMsg });

            if (failFast) {
              throw error;
            }
          });

        pending.push(promise);
      }

      if (pending.length > 0) {
        try {
          await Promise.race(pending);
          pending.splice(0, 1); // Remove completed promise
        } catch {
          if (failFast) {
            throw new Error("Batch send failed");
          }
        }
      }
    }

    return {
      total: messages.length,
      success: results.length,
      failed: errors.length,
      results,
    };
  }

  /**
   * Send a template to multiple recipients.
   *
   * @param tenantId Tenant ID
   * @param templateId Template ID
   * @param recipients Array of recipient addresses
   * @param variables Template variables
   * @returns Batch result
   */
  async sendTemplate(
    tenantId: string,
    templateId: string,
    recipients: string[],
    variables: Record<string, unknown>,
  ): Promise<BatchSendResult> {
    // In real implementation, would load template from DB
    // For now, create messages from template
    const messages: Message[] = recipients.map((to) => ({
      id: `msg-${Date.now()}-${Math.random()}`,
      tenantId,
      channel: MessageChannel.EMAIL, // Assume email for example
      to,
      body: "Template body", // Would be loaded from DB
      subject: "Subject", // Would be loaded from DB
      templateId,
      templateVars: variables,
      priority: MessagePriority.NORMAL,
      status: DeliveryStatus.QUEUED,
      retryCount: 0,
    }));

    return this.sendBatch(messages);
  }

  /**
   * Send with retry logic (exponential backoff, max 3 retries).
   *
   * @param message Message to send
   * @param rateLimitPerSecond Optional rate limit
   * @returns Send result
   */
  private async sendWithRetry(
    message: Message,
    rateLimitPerSecond?: number,
  ): Promise<SendResult> {
    const maxRetries = this.config.maxRetries || 3;
    const baseBackoffMs = this.config.retryBackoffMs || 1000;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Rate limiting
        if (rateLimitPerSecond) {
          await this.applyRateLimit(rateLimitPerSecond);
        }

        return await this.send(message);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry non-retryable errors
        if (error instanceof MessagingError && !error.retryable) {
          return {
            success: false,
            status: DeliveryStatus.FAILED,
            error: error.message,
          };
        }

        // Last attempt
        if (attempt === maxRetries) {
          // Add to dead letter queue
          this.deadLetterQueue.push({
            ...message,
            status: DeliveryStatus.FAILED,
            error: lastError.message,
            retryCount: attempt,
          });

          return {
            success: false,
            status: DeliveryStatus.FAILED,
            error: lastError.message,
          };
        }

        // Exponential backoff
        const backoffMs = baseBackoffMs * Math.pow(2, attempt);
        await sleep(backoffMs);
      }
    }

    return {
      success: false,
      status: DeliveryStatus.FAILED,
      error: lastError?.message || "Unknown error",
    };
  }

  /**
   * Check rate limit for tenant + channel combination.
   */
  private async checkRateLimit(
    tenantId: string,
    channel: MessageChannel,
  ): Promise<void> {
    const key = `${tenantId}_${channel}`;
    let limiter = this.rateLimiters.get(key);

    if (!limiter) {
      limiter = new RateLimiter(this.config.rateLimitPerSecond || 100);
      this.rateLimiters.set(key, limiter);
    }

    await limiter.acquire();
  }

  /**
   * Apply rate limiting (messages per second).
   */
  private async applyRateLimit(messagesPerSecond: number): Promise<void> {
    const delayMs = 1000 / messagesPerSecond;
    await sleep(delayMs);
  }

  /**
   * Get provider for a channel.
   */
  private getProvider(channel: MessageChannel): MessageProvider {
    const provider = this.providers.get(channel);
    if (!provider) {
      throw new Error(`No provider configured for channel: ${channel}`);
    }
    return provider;
  }

  /**
   * Get dead letter queue messages.
   */
  getDeadLetterQueue(): Message[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear dead letter queue.
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue = [];
  }

  /**
   * Test all configured providers.
   */
  async testAllProviders(): Promise<Record<MessageChannel, boolean>> {
    const results: Record<MessageChannel, boolean> = {} as any;

    for (const [channel, provider] of this.providers) {
      try {
        results[channel] = await provider.testConnection();
      } catch {
        results[channel] = false;
      }
    }

    return results;
  }
}

/**
 * Token bucket rate limiter.
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number = Date.now();

  constructor(private tokensPerSecond: number) {
    this.tokens = tokensPerSecond;
  }

  /**
   * Acquire one token, waiting if necessary.
   */
  async acquire(): Promise<void> {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.tokensPerSecond,
      this.tokens + timePassed * this.tokensPerSecond,
    );
    this.lastRefill = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait for token
    const waitTime = (1 - this.tokens) / this.tokensPerSecond;
    await sleep(waitTime * 1000);
    this.tokens = 0;
  }
}

/**
 * Sleep helper.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
