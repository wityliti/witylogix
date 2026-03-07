/**
 * @witylogix/framework/queue/dead-letter — Dead-letter queue handler
 *
 * Manages permanently failed workflows that cannot be recovered.
 * Features:
 * - Store failed workflow context for manual review
 * - Retry individual failed jobs
 * - List and purge DLQ entries
 * - Alert hooks on DLQ entry
 */

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { DeadLetterEntry } from "./types.js";

export class DeadLetterHandler extends EventEmitter {
  private dlqEntries: Map<string, DeadLetterEntry> = new Map();
  private alertHooks: Set<(entry: DeadLetterEntry) => Promise<void>> = new Set();

  constructor() {
    super();
  }

  onDLQEntry(hook: (entry: DeadLetterEntry) => Promise<void>): void {
    this.alertHooks.add(hook);
  }

  offDLQEntry(hook: (entry: DeadLetterEntry) => Promise<void>): void {
    this.alertHooks.delete(hook);
  }

  async addEntry(entry: Omit<DeadLetterEntry, "id" | "timestamp">): Promise<string> {
    const dlqEntry: DeadLetterEntry = {
      ...entry,
      id: `dlq_${randomUUID()}`,
      timestamp: new Date(),
    };
    this.dlqEntries.set(dlqEntry.id, dlqEntry);
    this.emit("dlq:entry-added", {
      entryId: dlqEntry.id,
      workflowName: dlqEntry.workflowName,
      error: dlqEntry.error.message,
      timestamp: new Date(),
    });
    console.warn(
      `[DeadLetterHandler] Job added to DLQ: ${dlqEntry.jobId || "unknown"} (${dlqEntry.workflowName})`
    );
    try {
      await Promise.all(
        Array.from(this.alertHooks).map((hook) =>
          hook(dlqEntry).catch((err) => {
            console.error("[DeadLetterHandler] Alert hook error:", err);
          })
        )
      );
    } catch (error) {
      console.error("[DeadLetterHandler] Error calling alert hooks:", error);
    }
    return dlqEntry.id;
  }

  async listDeadLetters(limit: number = 100, offset: number = 0): Promise<DeadLetterEntry[]> {
    const entries = Array.from(this.dlqEntries.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
    return entries;
  }

  async getEntry(entryId: string): Promise<DeadLetterEntry | undefined> {
    return this.dlqEntries.get(entryId);
  }

  async getEntriesByWorkflow(workflowName: string): Promise<DeadLetterEntry[]> {
    return Array.from(this.dlqEntries.values()).filter(
      (entry) => entry.workflowName === workflowName
    );
  }

  async getEntriesSince(since: Date): Promise<DeadLetterEntry[]> {
    return Array.from(this.dlqEntries.values()).filter(
      (entry) => entry.timestamp.getTime() >= since.getTime()
    );
  }

  async retryDeadLetter(entryId: string, queue: any): Promise<string | undefined> {
    const entry = this.dlqEntries.get(entryId);
    if (!entry) return undefined;
    try {
      const jobId = await queue.enqueue(
        entry.workflowName,
        entry.input,
        {
          userId: "system",
          tenantId: "system",
          transactionId: `retry_${entryId}_${Date.now()}`,
          metadata: { dlqRetry: true, originalEntryId: entryId },
        }
      );
      this.dlqEntries.delete(entryId);
      this.emit("dlq:entry-retried", {
        entryId,
        jobId,
        workflowName: entry.workflowName,
        timestamp: new Date(),
      });
      console.log(`[DeadLetterHandler] Retried DLQ entry ${entryId} as job ${jobId}`);
      return jobId;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("dlq:retry-failed", { entryId, error: message, timestamp: new Date() });
      console.error(`[DeadLetterHandler] Failed to retry DLQ entry ${entryId}:`, error);
      return undefined;
    }
  }

  async removeEntry(entryId: string): Promise<boolean> {
    const entry = this.dlqEntries.get(entryId);
    if (!entry) return false;
    this.dlqEntries.delete(entryId);
    this.emit("dlq:entry-removed", {
      entryId,
      workflowName: entry.workflowName,
      timestamp: new Date(),
    });
    return true;
  }

  async purgeDeadLetters(): Promise<number> {
    const count = this.dlqEntries.size;
    this.dlqEntries.clear();
    this.emit("dlq:purged", { count, timestamp: new Date() });
    console.warn(`[DeadLetterHandler] Purged ${count} DLQ entries`);
    return count;
  }

  async purgeOlderThan(before: Date): Promise<number> {
    let count = 0;
    for (const [entryId, entry] of this.dlqEntries.entries()) {
      if (entry.timestamp.getTime() < before.getTime()) {
        this.dlqEntries.delete(entryId);
        count++;
      }
    }
    if (count > 0) {
      this.emit("dlq:purged", { count, before, timestamp: new Date() });
      console.log(`[DeadLetterHandler] Purged ${count} old DLQ entries`);
    }
    return count;
  }

  async getStats(): Promise<{
    totalEntries: number;
    byWorkflow: Record<string, number>;
    oldestEntry?: Date;
    newestEntry?: Date;
  }> {
    const entries = Array.from(this.dlqEntries.values());
    const byWorkflow: Record<string, number> = {};
    for (const entry of entries) {
      byWorkflow[entry.workflowName] = (byWorkflow[entry.workflowName] ?? 0) + 1;
    }
    const timestamps = entries.map((e) => e.timestamp.getTime());
    const oldestEntry = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined;
    const newestEntry = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined;
    return { totalEntries: entries.length, byWorkflow, oldestEntry, newestEntry };
  }

  async exportAsJSON(): Promise<string> {
    const entries = Array.from(this.dlqEntries.values());
    return JSON.stringify(entries, null, 2);
  }

  async clear(): Promise<void> {
    this.dlqEntries.clear();
    this.emit("dlq:cleared", { timestamp: new Date() });
  }

  async close(): Promise<void> {
    this.dlqEntries.clear();
    this.alertHooks.clear();
    this.emit("dlq:closed", { timestamp: new Date() });
  }
}
