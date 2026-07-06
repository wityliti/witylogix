/**
 * Dead Letter Queue
 * Stores permanently failed webhooks for manual inspection and retry
 */

/**
 * Failure reason categorization
 */
export type FailureReason =
  | "timeout"
  | "4xx"
  | "5xx"
  | "network"
  | "invalid_url";

/**
 * Dead letter queue entry
 */
export interface DeadLetterEntry {
  id: string;
  endpointId: string;
  tenantId: string;
  eventType: string;
  eventId: string;
  payload: Record<string, unknown>;
  failureReason: FailureReason;
  failureMessage: string;
  statusCode?: number;
  requestHeaders?: Record<string, string>;
  responseBody?: string;
  totalAttempts: number;
  createdAt: Date;
  expireAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * DLQ statistics
 */
export interface DLQStatistics {
  totalEntries: number;
  byReason: Record<FailureReason, number>;
  byTenant: Record<string, number>;
  byEventType: Record<string, number>;
  oldestEntry?: Date;
}

/**
 * DeadLetterQueue
 * Manages permanently failed webhook deliveries
 */
export class DeadLetterQueue {
  private entries: Map<string, DeadLetterEntry> = new Map();
  private retentionMs: number = 30 * 24 * 60 * 60 * 1000; // 30 days default
  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Initialize dead letter queue
   * @param retentionDays - Retention period in days (default: 30)
   */
  constructor(retentionDays: number = 30) {
    this.retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    this.startCleanupTimer();
  }

  /**
   * Add failed webhook to DLQ
   * @param entry - Dead letter entry to add
   */
  addEntry(entry: Omit<DeadLetterEntry, "expireAt">): DeadLetterEntry {
    const expireAt = new Date(Date.now() + this.retentionMs);
    const dlqEntry: DeadLetterEntry = {
      ...entry,
      expireAt,
    };

    this.entries.set(entry.id, dlqEntry);
    return dlqEntry;
  }

  /**
   * Get entry by ID
   * @param id - Entry ID
   * @returns Dead letter entry or undefined
   */
  getEntry(id: string): DeadLetterEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Search entries by criteria
   * @param criteria - Search criteria
   * @returns Matching entries
   */
  search(criteria: {
    endpointId?: string;
    tenantId?: string;
    eventType?: string;
    failureReason?: FailureReason;
    from?: Date;
    to?: Date;
  }): DeadLetterEntry[] {
    return Array.from(this.entries.values()).filter((entry) => {
      if (criteria.endpointId && entry.endpointId !== criteria.endpointId) {
        return false;
      }
      if (criteria.tenantId && entry.tenantId !== criteria.tenantId) {
        return false;
      }
      if (criteria.eventType && entry.eventType !== criteria.eventType) {
        return false;
      }
      if (
        criteria.failureReason &&
        entry.failureReason !== criteria.failureReason
      ) {
        return false;
      }
      if (criteria.from && entry.createdAt < criteria.from) {
        return false;
      }
      if (criteria.to && entry.createdAt > criteria.to) {
        return false;
      }
      return true;
    });
  }

  /**
   * Manually retry a failed webhook
   * @param id - Entry ID
   * @param dispatcher - Webhook dispatcher instance
   * @returns Success status
   */
  async retryEntry(
    id: string,
    dispatcher: any,
    secret: string,
  ): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }

    try {
      const response = await dispatcher.dispatch(
        // URL would need to be reconstructed or stored
        // This is a placeholder - actual implementation would retrieve endpoint URL
        "",
        entry.payload,
        secret,
      );

      if (response.success) {
        this.entries.delete(id);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Batch retry multiple entries
   * @param ids - Entry IDs to retry
   * @param dispatcher - Webhook dispatcher instance
   * @param secretMap - Map of endpoint IDs to secrets
   * @returns Success count
   */
  async batchRetry(
    ids: string[],
    dispatcher: any,
    secretMap: Map<string, string>,
  ): Promise<number> {
    let successCount = 0;

    for (const id of ids) {
      const entry = this.entries.get(id);
      if (!entry) continue;

      const secret = secretMap.get(entry.endpointId);
      if (!secret) continue;

      try {
        if (await this.retryEntry(id, dispatcher, secret)) {
          successCount++;
        }
      } catch {
        // Continue with next entry
      }
    }

    return successCount;
  }

  /**
   * Remove entry from DLQ
   * @param id - Entry ID
   * @returns True if entry was removed
   */
  removeEntry(id: string): boolean {
    return this.entries.delete(id);
  }

  /**
   * Get DLQ statistics
   * @returns Statistics object
   */
  getStatistics(): DLQStatistics {
    const entries = Array.from(this.entries.values());
    const stats: DLQStatistics = {
      totalEntries: entries.length,
      byReason: {
        timeout: 0,
        "4xx": 0,
        "5xx": 0,
        network: 0,
        invalid_url: 0,
      },
      byTenant: {},
      byEventType: {},
    };

    for (const entry of entries) {
      stats.byReason[entry.failureReason]++;

      if (!stats.byTenant[entry.tenantId]) {
        stats.byTenant[entry.tenantId] = 0;
      }
      stats.byTenant[entry.tenantId]++;

      if (!stats.byEventType[entry.eventType]) {
        stats.byEventType[entry.eventType] = 0;
      }
      stats.byEventType[entry.eventType]++;
    }

    if (entries.length > 0) {
      const sorted = [...entries].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      stats.oldestEntry = sorted[0].createdAt;
    }

    return stats;
  }

  /**
   * Get DLQ size in bytes
   * @returns Approximate size in bytes
   */
  getSize(): number {
    return Array.from(this.entries.values()).reduce((sum, entry) => {
      const payloadSize = JSON.stringify(entry.payload).length;
      const responseSize = entry.responseBody?.length || 0;
      return sum + payloadSize + responseSize;
    }, 0);
  }

  /**
   * Check if DLQ is at capacity
   * @param maxSizeBytes - Maximum size in bytes
   * @returns True if at or over capacity
   */
  isAtCapacity(maxSizeBytes: number = 1024 * 1024 * 100): boolean {
    // 100MB default
    return this.getSize() >= maxSizeBytes;
  }

  /**
   * Clean up expired entries
   * Called automatically by cleanup timer
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [id, entry] of this.entries.entries()) {
      if (entry.expireAt.getTime() <= now) {
        this.entries.delete(id);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    // Run cleanup every 6 hours
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      6 * 60 * 60 * 1000,
    );

    // Don't keep process alive if this is the only interval
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Get all entries (for testing/admin)
   */
  getAllEntries(): DeadLetterEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Clear all entries (dangerous!)
   */
  clear(): void {
    this.entries.clear();
  }
}
