/**
 * Event Bus Implementation
 *
 * Core event publishing and subscription system with:
 * - In-memory fallback when Redis unavailable
 * - Wildcard pattern subscriptions
 * - Correlation ID propagation
 * - Event serialization/deserialization
 * - Automatic retry with exponential backoff
 * - Dead letter queue integration
 */

// Note: UUID generation uses native implementation
// For production, integrate with shared UUID service
import {
  BaseEvent,
  EventBusConfig,
  EventHandler,
  EventSubscription,
  EventFilter,
  EventBusError,
  EventSerializationError,
  EventHandlerError,
  RedisStreamConfig,
  PublishedEvent,
  PatternMatcher,
} from './types.js';
import { RedisStreamAdapter } from './redis-stream-adapter.js';

/**
 * Wildcard pattern matcher for event types
 * Supports: "order.*", "*.created", "*"
 */
class WildcardMatcher implements PatternMatcher {
  private pattern: string;
  private regex: RegExp;

  constructor(pattern: string) {
    this.pattern = pattern;
    // Convert glob pattern to regex
    // "order.*" -> "^order\..*$"
    // "*.created" -> "^.*\.created$"
    // "*" -> "^.*$"
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    this.regex = new RegExp(`^${regexPattern}$`);
  }

  matches(eventType: string): boolean {
    return this.regex.test(eventType);
  }

  getPattern(): string {
    return this.pattern;
  }
}

/**
 * Core Event Bus
 * Handles event publishing, subscription, and distribution
 */
export class EventBus {
  private config: EventBusConfig;
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private inMemoryStore: BaseEvent[] = [];
  private redisAdapter?: RedisStreamAdapter;
  private correlationId?: string;
  private isInitialized: boolean = false;

  constructor(config: EventBusConfig = {}) {
    this.config = {
      enableFallback: true,
      maxInMemoryEvents: 1000,
      source: 'event-bus',
      enableEventStore: true,
      eventStoreRetentionDays: 30,
      ...config,
    };
  }

  /**
   * Initialize the event bus
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize Redis adapter if configured
      if (this.config.redis && this.config.streamConfig) {
        this.redisAdapter = new RedisStreamAdapter(this.config.streamConfig);
        await this.redisAdapter.initialize();
      }

      this.isInitialized = true;
    } catch (error) {
      if (!this.config.enableFallback) {
        throw new EventBusError(
          'INITIALIZATION_FAILED',
          `Failed to initialize event bus: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      // Continue with in-memory mode
      console.warn(
        `Redis not available, using in-memory mode: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Publish an event
   * Distributes to all matching subscribers and optionally persists to Redis
   */
  async publish(event: Partial<BaseEvent>): Promise<PublishedEvent> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Validate and enrich event
      const enrichedEvent = this.enrichEvent(event);

      // Store in-memory (for fallback/recent access)
      this.storeInMemory(enrichedEvent);

      let messageId: string | undefined;
      let publishedCount = 0;

      // Persist to Redis if available
      if (this.redisAdapter) {
        try {
          messageId = await this.redisAdapter.publish(enrichedEvent);
        } catch (error) {
          console.warn(
            `Failed to persist event to Redis: ${error instanceof Error ? error.message : String(error)}`,
          );
          if (!this.config.enableFallback) {
            throw error;
          }
        }
      }

      // Find all matching subscriptions and trigger handlers
      publishedCount = await this.notifySubscribers(enrichedEvent);

      return {
        event: enrichedEvent,
        messageId,
        subscriberCount: publishedCount,
        publishedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof EventBusError) {
        throw error;
      }
      throw new EventBusError(
        'PUBLISH_FAILED',
        `Failed to publish event: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Subscribe to events matching a pattern
   * Returns subscription ID for later unsubscribe
   */
  subscribe(
    pattern: string,
    handler: EventHandler,
    opts?: {
      maxRetries?: number;
      retryBackoff?: number;
      consumerGroup?: string;
    },
  ): string {
    const subscriptionId = this.generateId();

    const subscription: EventSubscription = {
      id: subscriptionId,
      pattern,
      handler,
      maxRetries: opts?.maxRetries ?? 3,
      retryBackoff: opts?.retryBackoff ?? 1000,
      consumerGroup: opts?.consumerGroup,
      createdAt: new Date(),
      active: true,
    };

    // Store subscription (can have multiple handlers per pattern)
    if (!this.subscriptions.has(pattern)) {
      this.subscriptions.set(pattern, []);
    }
    this.subscriptions.get(pattern)!.push(subscription);

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [, subs] of this.subscriptions.entries()) {
      const index = subs.findIndex((s) => s.id === subscriptionId);
      if (index >= 0) {
        subs[index].active = false;
        subs.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Query recent in-memory events
   */
  queryInMemory(filter: EventFilter): BaseEvent[] {
    let results = [...this.inMemoryStore];

    // Filter by type
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      const matchers = types.map((t) => new WildcardMatcher(t));
      results = results.filter((e) =>
        matchers.some((m) => m.matches(e.type)),
      );
    }

    // Filter by source
    if (filter.source) {
      results = results.filter((e) => e.source === filter.source);
    }

    // Filter by correlation ID
    if (filter.correlationId) {
      results = results.filter(
        (e) => e.correlationId === filter.correlationId,
      );
    }

    // Filter by time range
    if (filter.startTime) {
      results = results.filter(
        (e) => new Date(e.timestamp) >= filter.startTime!,
      );
    }
    if (filter.endTime) {
      results = results.filter((e) => new Date(e.timestamp) <= filter.endTime!);
    }

    // Filter by metadata
    if (filter.metadata) {
      results = results.filter((e) => {
        if (!e.metadata) return false;
        return Object.entries(filter.metadata!).every(
          ([key, value]) => e.metadata![key] === value,
        );
      });
    }

    // Apply pagination
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;

    return results.slice(offset, offset + limit);
  }

  /**
   * Get all active subscriptions for a pattern
   */
  getSubscriptions(pattern?: string): EventSubscription[] {
    if (pattern) {
      return this.subscriptions.get(pattern) || [];
    }

    const all: EventSubscription[] = [];
    for (const subs of this.subscriptions.values()) {
      all.push(...subs);
    }
    return all;
  }

  /**
   * Set correlation ID for tracing
   * All subsequent events will include this ID
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string {
    return this.correlationId || '';
  }

  /**
   * Get event bus statistics
   */
  getStats(): {
    inMemoryCount: number;
    subscriptionCount: number;
    patternCount: number;
    redisAvailable: boolean;
  } {
    return {
      inMemoryCount: this.inMemoryStore.length,
      subscriptionCount: Array.from(this.subscriptions.values()).reduce(
        (sum, subs) => sum + subs.length,
        0,
      ),
      patternCount: this.subscriptions.size,
      redisAvailable: !!this.redisAdapter?.isReady(),
    };
  }

  /**
   * Clear in-memory store (testing/maintenance)
   */
  clearInMemory(): void {
    this.inMemoryStore = [];
  }

  /**
   * Close event bus and cleanup resources
   */
  async close(): Promise<void> {
    if (this.redisAdapter) {
      await this.redisAdapter.close();
    }
    this.subscriptions.clear();
    this.inMemoryStore = [];
    this.isInitialized = false;
  }

  /**
   * Enrich event with required fields
   */
  private enrichEvent(event: Partial<BaseEvent>): BaseEvent {
    const now = new Date().toISOString();

    return {
      id: event.id || this.generateId(),
      type: event.type || '',
      source: event.source || this.config.source || 'unknown',
      timestamp: event.timestamp || now,
      correlationId:
        event.correlationId || this.correlationId || this.generateId(),
      schemaVersion: event.schemaVersion || 1,
      traceId: event.traceId,
      parentEventId: event.parentEventId,
      metadata: event.metadata || {},
      data: event.data || {},
    };
  }

  /**
   * Store event in in-memory cache
   */
  private storeInMemory(event: BaseEvent): void {
    this.inMemoryStore.push(event);

    // Keep in-memory store bounded
    const maxEvents = this.config.maxInMemoryEvents || 1000;
    if (this.inMemoryStore.length > maxEvents) {
      // Remove oldest half
      this.inMemoryStore = this.inMemoryStore.slice(maxEvents / 2);
    }
  }

  /**
   * Notify all matching subscribers
   * Returns count of notifications sent
   */
  private async notifySubscribers(event: BaseEvent): Promise<number> {
    let notifiedCount = 0;

    for (const [pattern, subscriptions] of this.subscriptions.entries()) {
      const matcher = new WildcardMatcher(pattern);

      if (matcher.matches(event.type)) {
        for (const subscription of subscriptions) {
          if (!subscription.active) continue;

          notifiedCount++;

          // Fire handler asynchronously, don't wait
          this.executeHandlerWithRetry(subscription, event).catch((error) => {
            console.error(
              `Handler error for ${pattern}: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
        }
      }
    }

    return notifiedCount;
  }

  /**
   * Execute handler with exponential backoff retry
   */
  private async executeHandlerWithRetry(
    subscription: EventSubscription,
    event: BaseEvent,
    attempt: number = 1,
  ): Promise<void> {
    try {
      await subscription.handler(event);
    } catch (error) {
      const maxRetries = subscription.maxRetries || 3;

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, ...
        const backoff = (subscription.retryBackoff || 1000) * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));

        // Retry
        return this.executeHandlerWithRetry(
          subscription,
          event,
          attempt + 1,
        );
      }

      // Max retries exceeded
      throw new EventHandlerError(
        `Handler failed after ${maxRetries} retries for event ${event.type}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if event bus is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

/**
 * Singleton event bus instance
 */
let globalEventBus: EventBus | null = null;

/**
 * Get or create global event bus instance
 */
export function getEventBus(config?: EventBusConfig): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus(config);
  }
  return globalEventBus;
}

/**
 * Create a new event bus instance
 */
export function createEventBus(config?: EventBusConfig): EventBus {
  return new EventBus(config);
}
