/**
 * In-memory stream adapter for local testing and development.
 *
 * Implements the StreamAdapter interface using a local Map<stream, messages>,
 * providing consumer group semantics without Redis.
 *
 * Useful for:
 *   - Unit tests (fast, no external dependency)
 *   - Local development
 *   - CI/CD pipelines
 */

import type { StreamAdapter, EventEnvelope } from "../types.js";

/**
 * In-memory message representation.
 */
interface StoredMessage {
  id: string;
  data: Record<string, string>;
  timestamp: number;
}

/**
 * Pending message tracking for a consumer group.
 */
interface PendingMessage {
  id: string;
  consumer: string;
  addedAt: number;
  ageMs: number;
}

/**
 * Consumer group tracking.
 */
interface ConsumerGroup {
  name: string;
  consumers: Map<string, number>; // consumerId -> next index to read
  pending: Map<string, PendingMessage>; // messageId -> PendingMessage
}

/**
 * In-memory adapter for testing and local development.
 */
export class InMemoryStreamAdapter implements StreamAdapter {
  private streams = new Map<string, StoredMessage[]>();
  private consumerGroups = new Map<string, Map<string, ConsumerGroup>>();
  private messageIdCounter = 0;
  private connected = false;

  /**
   * Connect (no-op for in-memory).
   */
  async connect(): Promise<void> {
    this.connected = true;
  }

  /**
   * Disconnect (no-op for in-memory).
   */
  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Publish an event envelope to an in-memory stream.
   *
   * @param streamKey Stream key
   * @param envelope Event envelope
   * @returns Simulated message ID
   */
  async publish(streamKey: string, envelope: EventEnvelope): Promise<string> {
    if (!this.streams.has(streamKey)) {
      this.streams.set(streamKey, []);
    }

    const messages = this.streams.get(streamKey)!;
    const data = this.serializeEnvelope(envelope);
    const id = this.generateMessageId();

    messages.push({
      id,
      data,
      timestamp: Date.now(),
    });

    return id;
  }

  /**
   * Create or ensure a consumer group exists.
   *
   * @param streamKey Stream key
   * @param groupName Consumer group name
   * @param startId Starting position ("0-0", "$", or message ID)
   */
  async createConsumerGroup(
    streamKey: string,
    groupName: string,
    startId: string,
  ): Promise<void> {
    if (!this.consumerGroups.has(streamKey)) {
      this.consumerGroups.set(streamKey, new Map());
    }

    const groups = this.consumerGroups.get(streamKey)!;

    if (groups.has(groupName)) {
      // Idempotent: group already exists
      return;
    }

    // Determine starting index based on startId
    let startIndex = 0;
    if (startId === "$") {
      // Start from new messages only
      const messages = this.streams.get(streamKey);
      startIndex = messages ? messages.length : 0;
    } else if (startId === "0-0") {
      // Start from beginning
      startIndex = 0;
    } else {
      // Start from specific message ID
      startIndex = this.findMessageIndex(streamKey, startId);
    }

    groups.set(groupName, {
      name: groupName,
      consumers: new Map(),
      pending: new Map(),
    });
  }

  /**
   * Read messages from a consumer group.
   *
   * @param streamKey Stream key
   * @param groupName Consumer group name
   * @param consumerId Unique consumer ID
   * @param count Max messages to read
   * @param timeoutMs Block timeout (ignored in memory)
   * @returns Array of { id, data }
   */
  async readGroup(
    streamKey: string,
    groupName: string,
    consumerId: string,
    count: number,
    timeoutMs: number,
  ): Promise<Array<{ id: string; data: Record<string, string> }>> {
    const groups = this.consumerGroups.get(streamKey);
    if (!groups || !groups.has(groupName)) {
      return [];
    }

    const group = groups.get(groupName)!;
    const messages = this.streams.get(streamKey) || [];

    // Get the next index for this consumer
    let nextIndex = group.consumers.get(consumerId) ?? 0;

    // Read requested count
    const result: Array<{ id: string; data: Record<string, string> }> = [];
    for (let i = 0; i < count && nextIndex < messages.length; i++) {
      const msg = messages[nextIndex];
      result.push({
        id: msg.id,
        data: msg.data,
      });

      // Add to pending list
      group.pending.set(msg.id, {
        id: msg.id,
        consumer: consumerId,
        addedAt: Date.now(),
        ageMs: 0,
      });

      nextIndex++;
    }

    // Update next index for this consumer
    if (nextIndex > 0) {
      group.consumers.set(consumerId, nextIndex);
    }

    return result;
  }

  /**
   * Acknowledge a message as processed.
   *
   * @param streamKey Stream key
   * @param groupName Consumer group name
   * @param messageId Message ID to acknowledge
   */
  async acknowledge(
    streamKey: string,
    groupName: string,
    messageId: string,
  ): Promise<void> {
    const groups = this.consumerGroups.get(streamKey);
    if (!groups || !groups.has(groupName)) {
      return;
    }

    const group = groups.get(groupName)!;
    group.pending.delete(messageId);
  }

  /**
   * Get pending messages for a consumer group.
   *
   * @param streamKey Stream key
   * @param groupName Consumer group name
   * @param count Number of pending messages to retrieve
   * @returns Array of pending message info
   */
  async getPendingMessages(
    streamKey: string,
    groupName: string,
    count: number,
  ): Promise<Array<{ id: string; consumer: string; ageMs: number }>> {
    const groups = this.consumerGroups.get(streamKey);
    if (!groups || !groups.has(groupName)) {
      return [];
    }

    const group = groups.get(groupName)!;
    const now = Date.now();
    const result: Array<{ id: string; consumer: string; ageMs: number }> = [];

    let i = 0;
    for (const pending of group.pending.values()) {
      if (i >= count) break;

      result.push({
        id: pending.id,
        consumer: pending.consumer,
        ageMs: now - pending.addedAt,
      });
      i++;
    }

    return result;
  }

  /**
   * Reclaim pending messages and reassign to a consumer.
   *
   * @param streamKey Stream key
   * @param groupName Consumer group name
   * @param messageIds Message IDs to reclaim
   * @param consumerId New consumer to assign to
   * @returns Array of reclaimed messages
   */
  async reclaimMessages(
    streamKey: string,
    groupName: string,
    messageIds: string[],
    consumerId: string,
  ): Promise<Array<{ id: string; data: Record<string, string> }>> {
    const groups = this.consumerGroups.get(streamKey);
    if (!groups || !groups.has(groupName)) {
      return [];
    }

    const group = groups.get(groupName)!;
    const messages = this.streams.get(streamKey) || [];

    const result: Array<{ id: string; data: Record<string, string> }> = [];

    for (const msgId of messageIds) {
      const pending = group.pending.get(msgId);
      if (!pending) continue;

      // Find the actual message
      const msg = messages.find((m) => m.id === msgId);
      if (!msg) continue;

      result.push({
        id: msg.id,
        data: msg.data,
      });

      // Reassign to new consumer
      group.pending.set(msgId, {
        ...pending,
        consumer: consumerId,
        addedAt: Date.now(),
      });
    }

    return result;
  }

  /**
   * Trim a stream to a maximum length.
   *
   * @param streamKey Stream key
   * @param maxLength Maximum number of messages to keep
   * @returns Number of messages deleted
   */
  async trimStream(streamKey: string, maxLength: number): Promise<number> {
    const messages = this.streams.get(streamKey);
    if (!messages || messages.length <= maxLength) {
      return 0;
    }

    const deleted = messages.length - maxLength;
    const newMessages = messages.slice(deleted);
    this.streams.set(streamKey, newMessages);

    return deleted;
  }

  /**
   * Get information about a stream.
   *
   * @param streamKey Stream key
   * @returns Stream metadata
   */
  async getStreamInfo(streamKey: string): Promise<{
    length: number;
    firstId?: string;
    lastId?: string;
    groups: number;
  }> {
    const messages = this.streams.get(streamKey);
    const groups = this.consumerGroups.get(streamKey);

    return {
      length: messages?.length ?? 0,
      firstId: messages?.[0]?.id,
      lastId: messages?.[messages.length - 1]?.id,
      groups: groups?.size ?? 0,
    };
  }

  /**
   * Permanently delete a message from a stream.
   *
   * @param streamKey Stream key
   * @param messageId Message ID to delete
   */
  async deleteMessage(streamKey: string, messageId: string): Promise<void> {
    const messages = this.streams.get(streamKey);
    if (!messages) return;

    const index = messages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      messages.splice(index, 1);
    }
  }

  /**
   * Delete an entire stream (for testing).
   */
  async deleteStream(streamKey: string): Promise<void> {
    this.streams.delete(streamKey);
    this.consumerGroups.delete(streamKey);
  }

  // ───────────────────────────────────────────────────────────────
  // TESTING HELPERS
  // ───────────────────────────────────────────────────────────────

  /**
   * Get all messages in a stream (for testing).
   */
  getAllMessages(streamKey: string): StoredMessage[] {
    return this.streams.get(streamKey) ?? [];
  }

  /**
   * Clear all streams (for testing).
   */
  reset(): void {
    this.streams.clear();
    this.consumerGroups.clear();
    this.messageIdCounter = 0;
  }

  // ───────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ───────────────────────────────────────────────────────────────

  /**
   * Generate a simulated Redis message ID (timestamp-sequence).
   */
  private generateMessageId(): string {
    const timestamp = Date.now();
    this.messageIdCounter++;
    return `${timestamp}-${this.messageIdCounter}`;
  }

  /**
   * Find the index of a message by ID.
   */
  private findMessageIndex(streamKey: string, messageId: string): number {
    const messages = this.streams.get(streamKey);
    if (!messages) return 0;

    const index = messages.findIndex((m) => m.id === messageId);
    return index === -1 ? 0 : index + 1; // +1 to start after this message
  }

  /**
   * Serialize EventEnvelope to flat object.
   */
  private serializeEnvelope(envelope: EventEnvelope): Record<string, string> {
    const result: Record<string, string> = {
      id: envelope.metadata.id,
      type: envelope.metadata.type,
      source: envelope.metadata.source,
      timestamp: envelope.metadata.timestamp,
      tenantId: envelope.metadata.tenantId,
      correlationId: envelope.metadata.correlationId,
      version: envelope.metadata.version.toString(),
      data: JSON.stringify(envelope.data),
    };

    if (envelope.metadata.userId) {
      result.userId = envelope.metadata.userId;
    }
    if (envelope.metadata.requestId) {
      result.requestId = envelope.metadata.requestId;
    }
    if (envelope.metadata.tags) {
      result.tags = JSON.stringify(envelope.metadata.tags);
    }

    return result;
  }
}
