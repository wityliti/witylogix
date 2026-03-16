/**
 * Batch Loader — DataLoader-style query batching for N+1 prevention.
 *
 * Batches individual lookups into single queries executed within a
 * configurable window (default 10ms). Supports:
 * - Per-request scoping
 * - Request-scope caching
 * - Composite key support
 * - Prisma findMany integration
 * - Automatic cache invalidation
 *
 * Usage:
 *   const loader = new BatchLoader(prisma);
 *   const result = await loader.load("users", userId);
 *   // Within 10ms, all loads are batched into single findMany query
 */

/**
 * Batch queue for pending loads.
 */
interface BatchQueue<K, V> {
  keys: K[];
  callbacks: Array<(value: V | Error) => void>;
  timer?: NodeJS.Timeout;
}

/**
 * Loader configuration.
 */
export interface LoaderConfig {
  batchWindow?: number; // ms to batch (default 10)
  cacheResults?: boolean; // Cache within request (default true)
  batchFn: <K, V>(keys: K[]) => Promise<Map<K, V>>;
}

/**
 * Batch Loader for request-scoped query batching.
 *
 * Implements DataLoader pattern to batch individual record lookups
 * into single database queries, preventing N+1 query problems.
 */
export class BatchLoader<K, V> {
  private queues: Map<string, BatchQueue<K, V>> = new Map();
  private cache: Map<K, V> = new Map();
  private readonly batchWindow: number;
  private readonly batchFn: (keys: K[]) => Promise<Map<K, V>>;
  private readonly cacheResults: boolean;
  private requestId: string = "";

  /**
   * Create batch loader.
   *
   * @param config - Configuration
   */
  constructor(config: LoaderConfig) {
    this.batchWindow = config.batchWindow || 10;
    this.batchFn = config.batchFn;
    this.cacheResults = config.cacheResults !== false;
  }

  /**
   * Load a single value, batching with other loads.
   *
   * @param id - Unique queue identifier
   * @param key - Key to load
   * @returns Promise resolving to loaded value
   */
  async load(id: string, key: K): Promise<V> {
    this.requestId = id;

    // Check cache first
    if (this.cacheResults && this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Get or create queue
    if (!this.queues.has(id)) {
      this.queues.set(id, {
        keys: [],
        callbacks: [],
      });
    }

    const queue = this.queues.get(id)!;
    const isDuplicate = queue.keys.includes(key);

    return new Promise<V>((resolve, reject) => {
      const callback = (value: V | Error) => {
        if (value instanceof Error) {
          reject(value);
        } else {
          if (this.cacheResults) {
            this.cache.set(key, value);
          }
          resolve(value);
        }
      };

      // Add to queue if not duplicate
      if (!isDuplicate) {
        queue.keys.push(key);
      }

      queue.callbacks.push(callback);

      // Schedule batch execution if not already scheduled
      if (!queue.timer && !isDuplicate) {
        queue.timer = setTimeout(() => {
          this.executeBatch(id);
        }, this.batchWindow);
      } else if (isDuplicate && queue.callbacks.length > 1) {
        // Duplicate key, reuse existing result
        this.executeCallbacks(id, key);
      }
    });
  }

  /**
   * Load multiple values at once.
   *
   * @param id - Unique queue identifier
   * @param keys - Keys to load
   * @returns Promise resolving to array of values
   */
  async loadMany(id: string, keys: K[]): Promise<V[]> {
    const results = await Promise.all(
      keys.map((key) => this.load(id, key))
    );
    return results;
  }

  /**
   * Load with fallback for missing values.
   *
   * @param id - Unique queue identifier
   * @param key - Key to load
   * @param fallback - Fallback value if not found
   * @returns Promise resolving to loaded or fallback value
   */
  async loadOr(id: string, key: K, fallback: V): Promise<V> {
    try {
      return await this.load(id, key);
    } catch {
      return fallback;
    }
  }

  /**
   * Clear cache (call after writes to same table).
   *
   * @param keys - Optional keys to clear (default all)
   */
  clearCache(keys?: K[]): void {
    if (!keys) {
      this.cache.clear();
      return;
    }

    keys.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear queue for request.
   *
   * @param id - Queue identifier
   */
  clearQueue(id: string): void {
    const queue = this.queues.get(id);
    if (queue && queue.timer) {
      clearTimeout(queue.timer);
    }
    this.queues.delete(id);
  }

  /**
   * Get cache statistics.
   *
   * @returns Cache size and hit count
   */
  getStats(): { cacheSize: number; batchCount: number } {
    return {
      cacheSize: this.cache.size,
      batchCount: this.queues.size,
    };
  }

  /**
   * Execute batched query.
   *
   * @param id - Queue identifier
   */
  private async executeBatch(id: string): Promise<void> {
    const queue = this.queues.get(id);
    if (!queue) return;

    // Clear timer
    if (queue.timer) {
      clearTimeout(queue.timer);
      queue.timer = undefined;
    }

    // Execute batch function with deduped keys
    const uniqueKeys = [...new Set(queue.keys)];

    try {
      const results = await this.batchFn(uniqueKeys);

      // Resolve all callbacks
      let callbackIndex = 0;
      for (const key of queue.keys) {
        const value = results.get(key);
        if (value !== undefined) {
          queue.callbacks[callbackIndex++](value);
        } else {
          queue.callbacks[callbackIndex++](
            new Error(`No result for key: ${key}`)
          );
        }
      }
    } catch (error) {
      // Reject all pending callbacks
      queue.callbacks.forEach((cb) => cb(error as Error));
    }

    // Clean up queue
    this.queues.delete(id);
  }

  /**
   * Resolve callback for duplicate key.
   *
   * @param id - Queue identifier
   * @param key - Key to resolve
   */
  private executeCallbacks(id: string, key: K): void {
    const queue = this.queues.get(id);
    if (!queue) return;

    const cached = this.cache.get(key);
    if (cached !== undefined) {
      queue.callbacks.forEach((cb) => cb(cached));
    }
  }
}

/**
 * Prisma-specific batch loader factory.
 *
 * @param prisma - Prisma client
 * @returns Function to create batch loaders for tables
 */
export function createPrismaBatchLoader(prisma: any) {
  return function <T extends Record<string, any>>(
    model: string,
    idField: string = "id"
  ) {
    return new BatchLoader<string, T>({
      batchWindow: 10,
      cacheResults: true,
      batchFn: async (ids: string[]) => {
        const records = await (prisma[model] as any).findMany({
          where: { [idField]: { in: ids } },
        });

        const map = new Map<string, T>();
        records.forEach((record: T) => {
          const id = String((record as any)[idField]);
          map.set(id, record);
        });

        return map;
      },
    });
  };
}

/**
 * Composite key batch loader helper.
 *
 * Useful for loading by composite keys (e.g., userId + orderId).
 */
export class CompositeKeyBatchLoader<K extends Record<string, any>, V> {
  private loader: BatchLoader<string, V>;
  private keySerializer: (key: K) => string;

  constructor(
    config: LoaderConfig & {
      keySerializer?: (key: K) => string;
    }
  ) {
    this.keySerializer = config.keySerializer || ((key) =>
      JSON.stringify(key)
    );

    this.loader = new BatchLoader<string, V>({
      ...config,
      batchFn: async (keys: string[]) => {
        // Deserialize keys back to original objects
        const deserializedKeys = keys.map((k) => JSON.parse(k) as K);

        // Call original batch function with deserialized keys
        const result = await config.batchFn(deserializedKeys as any);

        // Reserialize keys for map
        const reserializedMap = new Map<string, V>();
        result.forEach((value, key) => {
          const serialized = this.keySerializer(key as any);
          reserializedMap.set(serialized, value);
        });

        return reserializedMap;
      },
    });
  }

  /**
   * Load by composite key.
   *
   * @param id - Request identifier
   * @param key - Composite key object
   * @returns Promise resolving to value
   */
  async load(id: string, key: K): Promise<V> {
    const serialized = this.keySerializer(key);
    return this.loader.load(id, serialized);
  }

  /**
   * Load many by composite keys.
   *
   * @param id - Request identifier
   * @param keys - Composite key objects
   * @returns Promise resolving to values
   */
  async loadMany(id: string, keys: K[]): Promise<V[]> {
    const serialized = keys.map((k) => this.keySerializer(k));
    return this.loader.loadMany(id, serialized as any);
  }

  /**
   * Clear cache.
   *
   * @param keys - Optional keys to clear
   */
  clearCache(keys?: K[]): void {
    const serialized = keys?.map((k) => this.keySerializer(k));
    this.loader.clearCache(serialized as any);
  }
}
