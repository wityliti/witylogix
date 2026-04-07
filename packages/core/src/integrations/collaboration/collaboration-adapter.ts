/**
 * Abstract Collaboration Adapter Base Class
 * Provides common functionality for all collaboration platform adapters
 */

import {
  CollaborationAdapterInterface,
  CollaborationAttachment,
  CollaborationChannel,
  CollaborationConfig,
  CollaborationMessage,
  CollaborationPresence,
  CollaborationReaction,
  CollaborationUser,
  CollaborationWebhookEvent,
  ChannelCacheEntry,
  CircuitBreakerState,
  PresenceTracking,
  RateLimitState,
  RetryConfig,
  WebhookEventType,
  PresenceStatus,
  ChannelType,
  MessageType,
} from './types';

export abstract class CollaborationAdapter implements CollaborationAdapterInterface {
  readonly platform: 'slack' | 'teams' | 'pusher';
  readonly config: CollaborationConfig;
  protected connected: boolean = false;

  // Rate limiting
  protected rateLimitState: RateLimitState;

  // Circuit breaker
  protected circuitBreakerState: CircuitBreakerState = {
    status: 'closed',
    failureCount: 0,
  };

  // Caching
  protected channelCache: Map<string, ChannelCacheEntry> = new Map();
  protected presenceCache: PresenceTracking = {};

  // Webhook handlers
  protected webhookHandlers: Map<
    string,
    (event: CollaborationWebhookEvent) => Promise<void>
  > = new Map();

  constructor(platform: 'slack' | 'teams' | 'pusher', config: CollaborationConfig) {
    this.platform = platform;
    this.config = config;
    this.rateLimitState = {
      tokensAvailable: config.rateLimitPerSecond,
      lastRefillTime: Date.now(),
      requestQueue: [],
    };
  }

  /**
   * Rate limiting with token bucket algorithm
   */
  protected async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRefill = now - this.rateLimitState.lastRefillTime;
    const tokensToAdd = (timeSinceLastRefill / 1000) * this.config.rateLimitPerSecond;

    this.rateLimitState.tokensAvailable = Math.min(
      this.config.rateLimitPerSecond,
      this.rateLimitState.tokensAvailable + tokensToAdd
    );
    this.rateLimitState.lastRefillTime = now;

    if (this.rateLimitState.tokensAvailable < 1) {
      const waitTime = (1 - this.rateLimitState.tokensAvailable) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.rateLimitState.tokensAvailable = 1;
    }

    this.rateLimitState.tokensAvailable -= 1;
  }

  /**
   * Circuit breaker pattern implementation
   */
  protected async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    if (this.circuitBreakerState.status === 'open') {
      const now = Date.now();
      if (
        this.circuitBreakerState.nextAttemptTime &&
        now >= this.circuitBreakerState.nextAttemptTime
      ) {
        this.circuitBreakerState.status = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      if (this.circuitBreakerState.status === 'half-open') {
        this.circuitBreakerState.status = 'closed';
        this.circuitBreakerState.failureCount = 0;
      }
      return result;
    } catch (error) {
      this.circuitBreakerState.failureCount += 1;

      if (
        this.circuitBreakerState.failureCount >=
        this.config.circuitBreakerThreshold
      ) {
        this.circuitBreakerState.status = 'open';
        this.circuitBreakerState.nextAttemptTime =
          Date.now() + this.config.circuitBreakerResetMs;
      }

      throw error;
    }
  }

  /**
   * Exponential backoff retry handler
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const retryConfig: RetryConfig = {
      attempts: config?.attempts ?? this.config.retryAttempts,
      backoffMs: config?.backoffMs ?? this.config.retryBackoffMs,
      maxBackoffMs: config?.maxBackoffMs ?? 30000,
      jitterFactor: config?.jitterFactor ?? 0.1,
    };

    let lastError: unknown;
    for (let attempt = 0; attempt < retryConfig.attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt < retryConfig.attempts - 1) {
          const backoff = Math.min(
            retryConfig.backoffMs * Math.pow(2, attempt),
            retryConfig.maxBackoffMs || 30000
          );
          const jitter =
            backoff * retryConfig.jitterFactor * Math.random();
          await new Promise((resolve) =>
            setTimeout(resolve, backoff + jitter)
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Format message content for the platform
   */
  protected formatMessage(
    content: string,
    options?: {
      mentions?: string[];
      markdown?: boolean;
      emoji?: boolean;
    }
  ): string {
    let formatted = content;

    // Resolve mentions
    if (options?.mentions) {
      for (const mention of options.mentions) {
        formatted = this.resolveMention(formatted, mention);
      }
    }

    // Handle emoji
    if (options?.emoji) {
      formatted = this.normalizeEmoji(formatted);
    }

    // Handle markdown if supported
    if (options?.markdown) {
      formatted = this.processMarkdown(formatted);
    }

    return formatted;
  }

  /**
   * Resolve @mentions to platform-specific format
   */
  protected abstract resolveMention(content: string, mention: string): string;

  /**
   * Normalize emoji across platforms
   */
  protected normalizeEmoji(content: string): string {
    // Basic emoji normalization
    const emojiMap: Record<string, string> = {
      ':+1:': '👍',
      ':-1:': '👎',
      ':fire:': '🔥',
      ':heart:': '❤️',
      ':laughing:': '😆',
      ':thinking:': '🤔',
      ':tada:': '🎉',
    };

    let normalized = content;
    for (const [code, emoji] of Object.entries(emojiMap)) {
      const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      normalized = normalized.replace(new RegExp(escaped, 'g'), emoji);
    }
    return normalized;
  }

  /**
   * Process markdown content
   */
  protected processMarkdown(content: string): string {
    // Platform-specific markdown processing
    // This is a base implementation that can be overridden
    return content
      .replace(/\*\*(.*?)\*\*/g, '_$1_') // Bold to underscore
      .replace(/\*(.*?)\*/g, '_$1_'); // Italic to underscore
  }

  /**
   * Channel caching with TTL
   */
  protected cacheChannel(channel: CollaborationChannel): void {
    const expiresAt = Date.now() + this.config.channelCacheTtlMs;
    this.channelCache.set(channel.id, { channel, expiresAt });
  }

  protected getCachedChannel(channelId: string): CollaborationChannel | null {
    const cached = this.channelCache.get(channelId);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.channelCache.delete(channelId);
      return null;
    }

    return cached.channel;
  }

  protected invalidateChannelCache(channelId: string): void {
    this.channelCache.delete(channelId);
  }

  protected clearChannelCache(): void {
    this.channelCache.clear();
  }

  /**
   * Presence tracking
   */
  protected trackPresence(
    userId: string,
    presence: CollaborationPresence
  ): void {
    this.presenceCache[userId] = {
      presence,
      timestamp: Date.now(),
    };
  }

  protected getTrackedPresence(userId: string): CollaborationPresence | null {
    const tracked = this.presenceCache[userId];
    if (!tracked) return null;

    // Check if expired based on config TTL
    if (Date.now() - tracked.timestamp > this.config.presenceCacheTtlMs) {
      delete this.presenceCache[userId];
      return null;
    }

    return tracked.presence;
  }

  protected clearPresenceCache(): void {
    this.presenceCache = {};
  }

  /**
   * Message formatting pipeline
   */
  protected buildRichMessage(
    content: string,
    options?: {
      title?: string;
      color?: string;
      blocks?: unknown[];
      actions?: Array<{ label: string; value: string }>;
      metadata?: Record<string, unknown>;
    }
  ): Record<string, unknown> {
    return {
      content,
      title: options?.title,
      color: options?.color,
      blocks: options?.blocks || [],
      actions: options?.actions || [],
      metadata: options?.metadata || {},
    };
  }

  /**
   * Register webhook handler
   */
  public registerWebhook(
    eventTypes: WebhookEventType[],
    callback: (event: CollaborationWebhookEvent) => Promise<void>
  ): string {
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.webhookHandlers.set(webhookId, callback);
    return webhookId;
  }

  /**
   * Unregister webhook handler
   */
  public unregisterWebhook(webhookId: string): void {
    this.webhookHandlers.delete(webhookId);
  }

  /**
   * Trigger webhook handlers
   */
  protected async triggerWebhookHandlers(
    event: CollaborationWebhookEvent
  ): Promise<void> {
    const promises = Array.from(this.webhookHandlers.values()).map((handler) =>
      handler(event).catch((error) => {
        console.error(`Webhook handler error: ${error}`);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Validate webhook signature (to be implemented by subclasses)
   */
  public abstract validateWebhook(
    signature: string,
    timestamp: string,
    body: string
  ): boolean;

  /**
   * Health check
   */
  public async health(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy' }> {
    if (!this.connected) {
      return { status: 'unhealthy' };
    }

    if (this.circuitBreakerState.status === 'open') {
      return { status: 'degraded' };
    }

    return { status: 'healthy' };
  }

  /**
   * Connection status
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getChannel(channelId: string): Promise<CollaborationChannel | null>;
  abstract listChannels(options?: {
    includeArchived?: boolean;
    types?: ChannelType[];
    limit?: number;
    cursor?: string;
  }): Promise<{ channels: CollaborationChannel[]; cursor?: string }>;
  abstract createChannel(
    name: string,
    options?: {
      description?: string;
      type?: ChannelType;
      isPrivate?: boolean;
      members?: string[];
    }
  ): Promise<CollaborationChannel>;
  abstract updateChannel(
    channelId: string,
    updates: Partial<CollaborationChannel>
  ): Promise<CollaborationChannel>;
  abstract archiveChannel(channelId: string): Promise<void>;
  abstract unarchiveChannel(channelId: string): Promise<void>;
  abstract sendMessage(
    channelId: string,
    content: string,
    options?: {
      type?: MessageType;
      richContent?: Record<string, unknown>;
      attachments?: CollaborationAttachment[];
      threadId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<CollaborationMessage>;
  abstract getMessage(messageId: string): Promise<CollaborationMessage | null>;
  abstract editMessage(
    messageId: string,
    content: string,
    richContent?: Record<string, unknown>
  ): Promise<CollaborationMessage>;
  abstract deleteMessage(messageId: string): Promise<void>;
  abstract getMessageThread(messageId: string): Promise<CollaborationMessage[]>;
  abstract getUser(userId: string): Promise<CollaborationUser | null>;
  abstract listUsers(options?: {
    limit?: number;
    cursor?: string;
    includeInactive?: boolean;
  }): Promise<{ users: CollaborationUser[]; cursor?: string }>;
  abstract getUsersByEmail(email: string): Promise<CollaborationUser[]>;
  abstract getUserPresence(userId: string): Promise<CollaborationPresence | null>;
  abstract setUserPresence(
    userId: string,
    status: PresenceStatus,
    statusMessage?: string
  ): Promise<void>;
  abstract addReaction(
    messageId: string,
    emoji: string
  ): Promise<CollaborationReaction>;
  abstract removeReaction(messageId: string, emoji: string): Promise<void>;
  abstract listReactions(messageId: string): Promise<CollaborationReaction[]>;
  abstract addChannelMember(
    channelId: string,
    userId: string
  ): Promise<CollaborationUser>;
  abstract removeChannelMember(channelId: string, userId: string): Promise<void>;
  abstract listChannelMembers(
    channelId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<{ members: CollaborationUser[]; cursor?: string }>;
  abstract uploadFile(
    channelId: string,
    file: { name: string; buffer: Buffer; mimeType: string }
  ): Promise<CollaborationAttachment>;
  abstract shareFile(
    messageId: string,
    fileId: string
  ): Promise<CollaborationAttachment>;
}
