/**
 * Idempotency Manager
 * Ensures webhook delivery is idempotent using key deduplication and response caching
 */

/**
 * Cached idempotent response
 */
export interface CachedResponse {
  statusCode: number;
  body?: string;
  headers?: Record<string, string>;
  timestamp: Date;
}

/**
 * Idempotency storage interface
 */
export interface IdempotencyStore {
  get(key: string): Promise<CachedResponse | null>;
  set(key: string, response: CachedResponse): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

/**
 * In-memory idempotency store
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private store: Map<string, CachedResponse> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private cleanupIntervalMs: number = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.startCleanup();
  }

  async get(key: string): Promise<CachedResponse | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, response: CachedResponse): Promise<void> {
    this.store.set(key, response);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const ttl = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, response] of this.store.entries()) {
      if (now - response.timestamp.getTime() > ttl) {
        this.store.delete(key);
      }
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  getSize(): number {
    return this.store.size;
  }
}

/**
 * IdempotencyManager
 * Manages idempotent webhook delivery using keys and response caching
 */
export class IdempotencyManager {
  private store: IdempotencyStore;
  private deduplicationWindowMs: number = 24 * 60 * 60 * 1000; // 24 hours default

  /**
   * Initialize idempotency manager
   * @param store - Idempotency store implementation
   * @param deduplicationWindowMs - Deduplication window in milliseconds
   */
  constructor(store?: IdempotencyStore, deduplicationWindowMs?: number) {
    this.store = store || new InMemoryIdempotencyStore();
    if (deduplicationWindowMs) {
      this.deduplicationWindowMs = deduplicationWindowMs;
    }
  }

  /**
   * Generate idempotency key from event
   * Format: wh_{eventType}_{resourceId}_{timestamp}
   * @param eventType - Webhook event type
   * @param resourceId - Resource identifier
   * @param timestamp - Event timestamp (optional, uses now if not provided)
   * @returns Idempotency key
   */
  generateKey(eventType: string, resourceId: string, timestamp?: Date): string {
    const ts = timestamp ? timestamp.getTime() : Date.now();
    const sanitizedEventType = eventType.replace(/[^a-zA-Z0-9._-]/g, "_");
    const sanitizedResourceId = resourceId.replace(/[^a-zA-Z0-9._-]/g, "_");

    return `wh_${sanitizedEventType}_${sanitizedResourceId}_${ts}`;
  }

  /**
   * Check if request is duplicate (already processed)
   * @param key - Idempotency key
   * @returns Cached response if duplicate, null if new
   */
  async checkDuplicate(key: string): Promise<CachedResponse | null> {
    const cached = await this.store.get(key);

    if (!cached) {
      return null;
    }

    // Check if cached response is still within deduplication window
    const age = Date.now() - cached.timestamp.getTime();
    if (age > this.deduplicationWindowMs) {
      // Expired, remove and treat as new
      await this.store.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Cache successful response for future duplicates
   * @param key - Idempotency key
   * @param statusCode - Response status code
   * @param body - Response body (optional)
   * @param headers - Response headers (optional)
   */
  async cacheResponse(
    key: string,
    statusCode: number,
    body?: string,
    headers?: Record<string, string>,
  ): Promise<void> {
    const response: CachedResponse = {
      statusCode,
      body,
      headers,
      timestamp: new Date(),
    };

    await this.store.set(key, response);
  }

  /**
   * Get cached response
   * @param key - Idempotency key
   * @returns Cached response or null
   */
  async getCachedResponse(key: string): Promise<CachedResponse | null> {
    const cached = await this.store.get(key);

    if (!cached) {
      return null;
    }

    // Check if still valid
    const age = Date.now() - cached.timestamp.getTime();
    if (age > this.deduplicationWindowMs) {
      await this.store.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Remove cached response
   * @param key - Idempotency key
   */
  async removeCached(key: string): Promise<void> {
    await this.store.delete(key);
  }

  /**
   * Check if idempotency key exists
   * @param key - Idempotency key
   * @returns True if exists and valid
   */
  async exists(key: string): Promise<boolean> {
    const cached = await this.store.get(key);
    if (!cached) {
      return false;
    }

    // Check age
    const age = Date.now() - cached.timestamp.getTime();
    if (age > this.deduplicationWindowMs) {
      await this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Validate idempotency key format
   * @param key - Key to validate
   * @returns True if valid format
   */
  static validateKeyFormat(key: string): boolean {
    // Expected format: wh_{eventType}_{resourceId}_{timestamp}
    const parts = key.split("_");
    if (parts.length < 4 || parts[0] !== "wh") {
      return false;
    }

    // Last part should be numeric timestamp
    const lastPart = parts[parts.length - 1];
    return /^\d+$/.test(lastPart);
  }

  /**
   * Parse idempotency key to extract components
   * @param key - Idempotency key
   * @returns Parsed components
   */
  static parseKey(key: string): {
    eventType: string;
    resourceId: string;
    timestamp: number;
  } | null {
    if (!this.validateKeyFormat(key)) {
      return null;
    }

    const parts = key.split("_");
    if (parts.length < 4) {
      return null;
    }

    const timestamp = parseInt(parts[parts.length - 1], 10);
    if (isNaN(timestamp)) {
      return null;
    }

    // Everything between "wh" and timestamp is eventType and resourceId
    // For simplicity, we'll split based on last two parts
    const resourceId = parts[parts.length - 2];
    const eventType = parts.slice(1, -2).join("_");

    return {
      eventType,
      resourceId,
      timestamp,
    };
  }

  /**
   * Clear all cached responses
   */
  async clearAll(): Promise<void> {
    await this.store.clear();
  }

  /**
   * Get manager statistics
   */
  async getStatistics(): Promise<{
    cachedResponses: number;
    deduplicationWindowMs: number;
  }> {
    if (this.store instanceof InMemoryIdempotencyStore) {
      return {
        cachedResponses: this.store.getSize(),
        deduplicationWindowMs: this.deduplicationWindowMs,
      };
    }

    return {
      cachedResponses: 0,
      deduplicationWindowMs: this.deduplicationWindowMs,
    };
  }

  /**
   * Update deduplication window
   * @param windowMs - New window in milliseconds
   */
  updateDeduplicationWindow(windowMs: number): void {
    this.deduplicationWindowMs = windowMs;
  }

  /**
   * Get current deduplication window
   */
  getDeduplicationWindow(): number {
    return this.deduplicationWindowMs;
  }
}
