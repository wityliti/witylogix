/**
 * Redis Streams Adapter
 *
 * Implements reliable event delivery using Redis Streams with consumer groups.
 * Features:
 * - XADD for publishing events
 * - XREADGROUP with consumer groups for reliable delivery
 * - XACK for acknowledgment after processing
 * - XPENDING/XCLAIM for pending message recovery
 * - XTRIM for automatic stream cleanup
 */

import {
  BaseEvent,
  RedisStreamConfig,
  StreamMessage,
  RedisStreamError,
} from "./types.js";

export class RedisStreamAdapter {
  private config: RedisStreamConfig;
  private isInitialized: boolean = false;

  constructor(config: RedisStreamConfig) {
    this.config = {
      batchSize: 10,
      maxStreamLength: 100000,
      blockTimeout: 5000,
      claimTimeout: 30000,
      ...config,
    };
  }

  /**
   * Initialize the adapter and create consumer group
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Ensure Redis connection is available
      if (!this.config.redis) {
        throw new RedisStreamError("Redis client not configured");
      }

      // Test connection
      await this.config.redis.ping();
      this.isInitialized = true;
    } catch (error) {
      throw new RedisStreamError(
        `Failed to initialize Redis Stream adapter: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Publish an event to a stream
   * Uses XADD to append to the stream
   */
  async publish(event: BaseEvent): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const streamKey = this.getStreamKey(event.type);
    const messageData = this.serializeEvent(event);

    try {
      // XADD returns the message ID
      const messageId = await this.config.redis.xadd(
        streamKey,
        "*", // Auto-generate ID
        ...messageData,
      );

      // Trim stream to max length
      await this.trimStream(streamKey);

      return messageId;
    } catch (error) {
      throw new RedisStreamError(
        `Failed to publish event to stream ${streamKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create consumer group if it doesn't exist
   */
  async ensureConsumerGroup(eventType: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const streamKey = this.getStreamKey(eventType);

    try {
      // Create consumer group, starting from latest message
      // MKSTREAM creates the stream if it doesn't exist
      await this.config.redis.xgroup(
        "CREATE",
        streamKey,
        this.config.consumerGroup,
        "$",
        "MKSTREAM",
      );
    } catch (error) {
      // Group already exists - this is expected and not an error
      if (error instanceof Error && !error.message.includes("BUSYGROUP")) {
        throw new RedisStreamError(
          `Failed to create consumer group: ${error.message}`,
        );
      }
    }
  }

  /**
   * Read events from a stream using consumer group
   * Blocks until messages are available or timeout occurs
   */
  async readGroup(
    eventType: string,
    opts?: {
      count?: number;
      timeout?: number;
    },
  ): Promise<Array<{ id: string; event: BaseEvent }>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const streamKey = this.getStreamKey(eventType);
    const count = opts?.count || this.config.batchSize;
    const timeout = opts?.timeout || this.config.blockTimeout;

    // Ensure consumer group exists
    await this.ensureConsumerGroup(eventType);

    try {
      // XREADGROUP reads from consumer group with blocking
      const messages = await this.config.redis.xreadgroup(
        "GROUP",
        this.config.consumerGroup,
        this.config.consumerName,
        "BLOCK",
        timeout,
        "COUNT",
        count,
        "STREAMS",
        streamKey,
        ">",
      );

      if (!messages || messages.length === 0) {
        return [];
      }

      // Parse messages: [[streamKey, [[messageId, data], ...]]]
      const [, eventMessages] = messages[0];
      return eventMessages.map((msg: StreamMessage) => ({
        id: msg[0],
        event: this.deserializeEvent(msg[1]),
      }));
    } catch (error) {
      throw new RedisStreamError(
        `Failed to read from stream ${streamKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Acknowledge a message as processed
   * Uses XACK to mark message as handled
   */
  async acknowledge(eventType: string, messageId: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const streamKey = this.getStreamKey(eventType);

    try {
      const result = await this.config.redis.xack(
        streamKey,
        this.config.consumerGroup,
        messageId,
      );
      return result > 0;
    } catch (error) {
      throw new RedisStreamError(
        `Failed to acknowledge message ${messageId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get pending messages for the consumer group
   * Uses XPENDING to find unacknowledged messages
   */
  async getPendingMessages(
    eventType: string,
    opts?: {
      count?: number;
    },
  ): Promise<
    Array<{
      id: string;
      consumerName: string;
      idleMs: number;
      deliveryCount: number;
    }>
  > {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const streamKey = this.getStreamKey(eventType);
    const count = opts?.count || this.config.batchSize;

    try {
      // XPENDING returns pending message details
      const pending = await this.config.redis.xpending(
        streamKey,
        this.config.consumerGroup,
        "-",
        "+",
        count,
      );

      return pending.map((item: any) => ({
        id: item[0],
        consumerName: item[1],
        idleMs: item[2],
        deliveryCount: item[3],
      }));
    } catch (error) {
      throw new RedisStreamError(
        `Failed to get pending messages: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Claim pending messages (for dead-letter handling)
   * Uses XCLAIM to reassign old pending messages
   */
  async claimPendingMessages(
    eventType: string,
    opts?: {
      minIdleMs?: number;
      count?: number;
    },
  ): Promise<Array<{ id: string; event: BaseEvent }>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const streamKey = this.getStreamKey(eventType);
    const minIdleMs = opts?.minIdleMs || this.config.claimTimeout;
    const count = opts?.count || this.config.batchSize;

    try {
      // Get pending messages older than minIdleMs
      const pending = await this.getPendingMessages(eventType, { count });

      if (pending.length === 0) {
        return [];
      }

      // Claim messages that are old enough
      const messageIds = pending
        .filter((p) => p.idleMs >= minIdleMs)
        .map((p) => p.id);

      if (messageIds.length === 0) {
        return [];
      }

      // XCLAIM reassigns messages to this consumer
      const claimed = await this.config.redis.xclaim(
        streamKey,
        this.config.consumerGroup,
        this.config.consumerName,
        minIdleMs,
        ...messageIds,
        "JUSTID", // Return just the IDs
      );

      // Now fetch the full messages
      const messages = await this.config.redis.xrange(streamKey, "-", "+");

      return messages
        .filter((msg: StreamMessage) => claimed.includes(msg[0]))
        .map((msg: StreamMessage) => ({
          id: msg[0],
          event: this.deserializeEvent(msg[1]),
        }));
    } catch (error) {
      throw new RedisStreamError(
        `Failed to claim pending messages: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get stream info and statistics
   */
  async getStreamInfo(eventType: string): Promise<{
    length: number;
    radixTreeKeys: number;
    radixTreeNodes: number;
    groups: number;
    lastGeneratedId: string;
    firstEntry?: { id: string; data: any };
    lastEntry?: { id: string; data: any };
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const streamKey = this.getStreamKey(eventType);

    try {
      const info = await this.config.redis.xinfo("STREAM", streamKey);

      // Parse XINFO output (returns array of [key, value, ...])
      const result: any = {};
      for (let i = 0; i < info.length; i += 2) {
        result[info[i]] = info[i + 1];
      }

      return {
        length: result.length || 0,
        radixTreeKeys: result["radix-tree-keys"] || 0,
        radixTreeNodes: result["radix-tree-nodes"] || 0,
        groups: result.groups || 0,
        lastGeneratedId: result["last-generated-id"] || "",
        firstEntry: result["first-entry"]
          ? {
              id: result["first-entry"][0],
              data: this.convertArrayToObject(result["first-entry"][1]),
            }
          : undefined,
        lastEntry: result["last-entry"]
          ? {
              id: result["last-entry"][0],
              data: this.convertArrayToObject(result["last-entry"][1]),
            }
          : undefined,
      };
    } catch (error) {
      // Stream doesn't exist yet
      if (error instanceof Error && error.message.includes("no such key")) {
        return {
          length: 0,
          radixTreeKeys: 0,
          radixTreeNodes: 0,
          groups: 0,
          lastGeneratedId: "",
        };
      }
      throw new RedisStreamError(
        `Failed to get stream info: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete a consumer from the group
   */
  async deleteConsumer(
    eventType: string,
    consumerName: string,
  ): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const streamKey = this.getStreamKey(eventType);

    try {
      // Returns number of pending messages transferred to other consumers
      return await this.config.redis.xgroup(
        "DELCONSUMER",
        streamKey,
        this.config.consumerGroup,
        consumerName,
      );
    } catch (error) {
      throw new RedisStreamError(
        `Failed to delete consumer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete consumer group
   */
  async deleteConsumerGroup(eventType: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const streamKey = this.getStreamKey(eventType);

    try {
      const result = await this.config.redis.xgroup(
        "DESTROY",
        streamKey,
        this.config.consumerGroup,
      );
      return result > 0;
    } catch (error) {
      throw new RedisStreamError(
        `Failed to delete consumer group: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Trim stream to max length using XTRIM
   * This is called after each publish to keep stream size bounded
   */
  private async trimStream(streamKey: string): Promise<void> {
    if (!this.config.maxStreamLength) return;

    try {
      await this.config.redis.xtrim(
        streamKey,
        "MAXLEN",
        this.config.maxStreamLength,
      );
    } catch (error) {
      // Don't fail on trim error - just log it
      // The stream will still work, just might grow larger
      console.warn(
        `Failed to trim stream ${streamKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Serialize event to Redis format (flat array of alternating keys and values)
   */
  private serializeEvent(event: BaseEvent): string[] {
    const data: string[] = [];

    // Flatten event properties
    const flatEvent = {
      id: event.id,
      type: event.type,
      source: event.source,
      timestamp: event.timestamp,
      correlationId: event.correlationId,
      schemaVersion: event.schemaVersion || 1,
      traceId: event.traceId || "",
      parentEventId: event.parentEventId || "",
      metadata: event.metadata ? JSON.stringify(event.metadata) : "{}",
      data: JSON.stringify(event.data),
    };

    // Convert to alternating key-value array
    for (const [key, value] of Object.entries(flatEvent)) {
      data.push(key);
      data.push(String(value));
    }

    return data;
  }

  /**
   * Deserialize event from Redis format
   */
  private deserializeEvent(data: string[]): BaseEvent {
    const obj: Record<string, any> = {};

    // Convert alternating key-value array to object
    for (let i = 0; i < data.length; i += 2) {
      obj[data[i]] = data[i + 1];
    }

    // Parse JSON fields
    const metadata = obj.metadata ? JSON.parse(obj.metadata) : undefined;
    const eventData = obj.data ? JSON.parse(obj.data) : {};

    return {
      id: obj.id,
      type: obj.type,
      source: obj.source,
      timestamp: obj.timestamp,
      correlationId: obj.correlationId,
      schemaVersion: obj.schemaVersion ? parseInt(obj.schemaVersion) : 1,
      traceId: obj.traceId || undefined,
      parentEventId: obj.parentEventId || undefined,
      metadata: metadata,
      data: eventData,
    };
  }

  /**
   * Convert Redis array format [key, val, key, val] to object
   */
  private convertArrayToObject(arr: string[]): Record<string, string> {
    const obj: Record<string, string> = {};
    for (let i = 0; i < arr.length; i += 2) {
      obj[arr[i]] = arr[i + 1];
    }
    return obj;
  }

  /**
   * Get stream key for event type
   */
  private getStreamKey(eventType: string): string {
    return `${this.config.streamPrefix}:${eventType}`;
  }

  /**
   * Check if adapter is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Close connection (if needed)
   */
  async close(): Promise<void> {
    // Connection managed by parent application
    this.isInitialized = false;
  }
}
