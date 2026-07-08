/**
 * Dead Letter Queue Module
 *
 * Handles events that fail processing after max retries:
 * - Store failed events with error details
 * - Inspect and diagnose failures
 * - Replay dead letters for manual recovery
 * - Alert on DLQ threshold
 */

import {
  BaseEvent,
  DeadLetterEntry,
  DeadLetterStats,
  EventBusError,
} from "./types.js";

/**
 * Dead Letter Queue Interface
 */
export interface IDeadLetterQueue {
  /**
   * Add failed event to DLQ
   */
  add(
    event: BaseEvent,
    error: Error,
    retryCount: number,
    context?: Record<string, any>,
  ): Promise<string>;

  /**
   * Get entry by ID
   */
  getById(id: string): Promise<DeadLetterEntry | null>;

  /**
   * Query DLQ entries
   */
  query(opts: {
    status?: "pending" | "resolved" | "ignored";
    eventType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    entries: DeadLetterEntry[];
    total: number;
    hasMore: boolean;
  }>;

  /**
   * Mark entry as resolved
   */
  resolve(id: string): Promise<void>;

  /**
   * Mark entry as ignored (won't be retried)
   */
  ignore(id: string): Promise<void>;

  /**
   * Replay a dead letter entry
   */
  replay(id: string): Promise<void>;

  /**
   * Get DLQ statistics
   */
  getStats(): Promise<DeadLetterStats>;

  /**
   * Get entries older than threshold
   */
  getOlderThan(days: number): Promise<DeadLetterEntry[]>;

  /**
   * Archive old entries
   */
  archive(beforeDate: Date): Promise<number>;
}

/**
 * In-memory Dead Letter Queue implementation
 */
export class InMemoryDeadLetterQueue implements IDeadLetterQueue {
  private entries: DeadLetterEntry[] = [];
  private replayHandlers: Map<string, (event: BaseEvent) => Promise<void>> =
    new Map();

  /**
   * Register replay handler for event type
   */
  registerReplayHandler(
    eventType: string,
    handler: (event: BaseEvent) => Promise<void>,
  ): void {
    this.replayHandlers.set(eventType, handler);
  }

  async add(
    event: BaseEvent,
    error: Error,
    retryCount: number,
    context?: Record<string, any>,
  ): Promise<string> {
    const id = `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const entry: DeadLetterEntry = {
      id,
      event,
      error: {
        message: error.message,
        code: (error as any).code || "UNKNOWN",
        stack: error.stack,
      },
      retryCount,
      lastErrorAt: new Date(),
      createdAt: new Date(),
      status: "pending",
      context,
    };

    this.entries.push(entry);
    return id;
  }

  async getById(id: string): Promise<DeadLetterEntry | null> {
    return this.entries.find((e) => e.id === id) || null;
  }

  async query(opts: {
    status?: "pending" | "resolved" | "ignored";
    eventType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: DeadLetterEntry[]; total: number; hasMore: boolean }> {
    let results = [...this.entries];

    if (opts.status) {
      results = results.filter((e) => e.status === opts.status);
    }

    if (opts.eventType) {
      results = results.filter((e) => e.event.type === opts.eventType);
    }

    // Sort by creation date (newest first)
    results.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total = results.length;
    const offset = opts.offset || 0;
    const limit = opts.limit || 50;

    return {
      entries: results.slice(offset, offset + limit),
      total,
      hasMore: offset + limit < total,
    };
  }

  async resolve(id: string): Promise<void> {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) {
      throw new EventBusError(
        "DLQ_ENTRY_NOT_FOUND",
        `Dead letter entry ${id} not found`,
      );
    }
    entry.status = "resolved";
  }

  async ignore(id: string): Promise<void> {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) {
      throw new EventBusError(
        "DLQ_ENTRY_NOT_FOUND",
        `Dead letter entry ${id} not found`,
      );
    }
    entry.status = "ignored";
  }

  async replay(id: string): Promise<void> {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) {
      throw new EventBusError(
        "DLQ_ENTRY_NOT_FOUND",
        `Dead letter entry ${id} not found`,
      );
    }

    // Find registered handler
    const handler = this.replayHandlers.get(entry.event.type);
    if (!handler) {
      throw new EventBusError(
        "NO_REPLAY_HANDLER",
        `No replay handler registered for event type ${entry.event.type}`,
      );
    }

    try {
      await handler(entry.event);
      entry.status = "resolved";
    } catch (error) {
      throw new EventBusError(
        "REPLAY_FAILED",
        `Failed to replay event: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getStats(): Promise<DeadLetterStats> {
    const pending = this.entries.filter((e) => e.status === "pending");
    const resolved = this.entries.filter((e) => e.status === "resolved");
    const ignored = this.entries.filter((e) => e.status === "ignored");

    let oldestPending: Date | undefined;
    if (pending.length > 0) {
      oldestPending = pending.reduce((oldest, e) =>
        e.createdAt < oldest ? e.createdAt : oldest,
      ).createdAt;
    }

    let latestAt: Date | undefined;
    if (this.entries.length > 0) {
      latestAt = this.entries.reduce((latest, e) =>
        e.createdAt > latest ? e.createdAt : latest,
      ).createdAt;
    }

    return {
      total: this.entries.length,
      pending: pending.length,
      resolved: resolved.length,
      ignored: ignored.length,
      oldestPending,
      latestAt,
    };
  }

  async getOlderThan(days: number): Promise<DeadLetterEntry[]> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);

    return this.entries.filter((e) => e.createdAt < threshold);
  }

  async archive(beforeDate: Date): Promise<number> {
    const initialLength = this.entries.length;
    this.entries = this.entries.filter((e) => e.createdAt >= beforeDate);
    return initialLength - this.entries.length;
  }

  /**
   * Clear all entries (testing)
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get all entries (testing)
   */
  getAllEntries(): DeadLetterEntry[] {
    return [...this.entries];
  }
}

/**
 * DLQ Factory
 */
export class DeadLetterQueueFactory {
  private static queues: Map<string, IDeadLetterQueue> = new Map();

  /**
   * Register a DLQ implementation
   */
  static register(name: string, dlq: IDeadLetterQueue): void {
    this.queues.set(name, dlq);
  }

  /**
   * Get or create a DLQ
   */
  static get(name: string = "memory"): IDeadLetterQueue {
    if (!this.queues.has(name)) {
      if (name === "memory") {
        this.queues.set(name, new InMemoryDeadLetterQueue());
      } else {
        throw new EventBusError(
          "DLQ_NOT_FOUND",
          `Dead letter queue '${name}' not registered`,
        );
      }
    }
    return this.queues.get(name)!;
  }

  /**
   * Clear all registered queues
   */
  static clear(): void {
    this.queues.clear();
  }
}

/**
 * Convenience function to get default DLQ
 */
export function getDeadLetterQueue(): IDeadLetterQueue {
  return DeadLetterQueueFactory.get("memory");
}

/**
 * Create in-memory DLQ
 */
export function createInMemoryDeadLetterQueue(): InMemoryDeadLetterQueue {
  return new InMemoryDeadLetterQueue();
}

/**
 * DLQ Alert Handler
 * Monitors DLQ and triggers alerts on threshold
 */
export class DeadLetterAlertHandler {
  constructor(
    private dlq: IDeadLetterQueue,
    private thresholdCount: number = 10,
    private alertCallback?: (stats: DeadLetterStats) => Promise<void>,
  ) {}

  /**
   * Check DLQ and trigger alert if threshold exceeded
   */
  async check(): Promise<void> {
    const stats = await this.dlq.getStats();

    if (stats.pending >= this.thresholdCount) {
      if (this.alertCallback) {
        await this.alertCallback(stats);
      } else {
        console.warn(
          `Dead Letter Queue alert: ${stats.pending} pending entries (threshold: ${this.thresholdCount})`,
        );
      }
    }
  }

  /**
   * Set alert callback
   */
  setAlertCallback(callback: (stats: DeadLetterStats) => Promise<void>): void {
    this.alertCallback = callback;
  }

  /**
   * Set threshold
   */
  setThreshold(count: number): void {
    this.thresholdCount = count;
  }
}
