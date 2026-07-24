// @ts-nocheck
/**
 * Redis Streams adapter for the event bus.
 *
 * Implements distributed, ordered event streaming with consumer groups,
 * automatic acknowledgment, pending message recovery, and dead-letter handling.
 *
 * Features:
 *   - XADD for publishing
 *   - XREADGROUP + XACK for consumer groups
 *   - XPENDING + XCLAIM for dead-letter recovery
 *   - XTRIM for housekeeping
 */

import type { StreamAdapter, EventEnvelope } from "../types.js";

/**
 * Local type stub for Redis types (since @types/ioredis is not available).
 */
interface RedisClient {
  xadd(
    key: string,
    id: string | "*",
    ...args: (string | number)[]
  ): Promise<string>;
  xreadgroup(
    ...args: (string | number)[]
  ): Promise<Array<[string, Array<[string, string[]]>]> | null>;
  xack(key: string, group: string, id: string): Promise<number>;
  xgroup(
    command: string,
    key: string,
    group: string,
    id: string,
    mkstream?: boolean,
  ): Promise<unknown>;
  xpending(
    key: string,
    group: string,
    ...args: (string | number)[]
  ): Promise<unknown>;
  xclaim(
    key: string,
    group: string,
    consumer: string,
    minIdleTime: number,
    ...messageIds: string[]
  ): Promise<Array<[string, string[]]>>;
  xtrim(key: string, strategy: "MAXLEN", value: number): Promise<number>;
  xinfo(command: string, key: string): Promise<unknown>;
  del(key: string): Promise<number>;
  ping(): Promise<string>;
  quit(): Promise<void>;
}

/**
 * Redis Streams adapter for distributed event streaming.
 * Assumes a Redis client (ioredis or similar) is provided.
 */
export class RedisStreamAdapter implements StreamAdapter {
  private client: RedisClient;
  private connected = false;
  private readonly keyPrefix: string;

  /**
   * Create a new Redis Streams adapter.
   *
   * @param client ioredis client instance
   * @param keyPrefix Prefix for Redis keys (default: "events")
   */
  constructor(client: RedisClient, keyPrefix: string = "events") {
    this.client = client;
    this.keyPrefix = keyPrefix;
  }

  /**
   * Verify connection to Redis.
   */
  async connect(): Promise<void> {
    try {
      const pong = await this.client.ping();
      if (pong === "PONG") {
        this.connected = true;
      } else {
        throw new Error("Redis ping returned unexpected response: " + pong);
      }
    } catch (error) {
      throw new Error(`Failed to connect to Redis: ${error}`);
    }
  }

  /**
   * Close Redis connection.
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }

  /**
   * Publish an event envelope to a Redis Stream.
   * Uses XADD with auto-generated message ID.
   *
   * @param streamKey Stream key (e.g., "order.created")
   * @param envelope Event envelope with metadata
   * @returns Message ID assigned by Redis
   */
  async publish(streamKey: string, envelope: EventEnvelope): Promise<string> {
    const fullKey = this.getFullKey(streamKey);

    // Serialize envelope to flat key-value pairs for Redis Stream
    const data = this.serializeEnvelope(envelope);

    // XADD returns the message ID (e.g., "1704067200000-0")
    const messageId = await this.client.xadd(fullKey, "*", ...data);

    return messageId;
  }

  /**
   * Create or ensure a consumer group exists.
   * Idempotent: won't error if group already exists.
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
    const fullKey = this.getFullKey(streamKey);

    try {
      // XGROUP CREATE key group id [MKSTREAM]
      // MKSTREAM: create stream if it doesn't exist
      await this.client.xgroup("CREATE", fullKey, groupName, startId, true);
    } catch (error: any) {
      // BUSYGROUP: group already exists (expected, idempotent)
      if (!error.message?.includes("BUSYGROUP")) {
        throw new Error(
          `Failed to create consumer group "${groupName}" on "${streamKey}": ${error.message}`,
        );
      }
    }
  }

  /**
   * Read messages from a consumer group.
   * Blocks until messages are available or timeout expires.
   *
   * @param streamKey Stream key
   * @param groupName Consumer group name
   * @param consumerId Unique consumer ID
   * @param count Max messages to read
   * @param timeoutMs Block timeout
   * @returns Array of { id, data }
   */
  async readGroup(
    streamKey: string,
    groupName: string,
    consumerId: string,
    count: number,
    timeoutMs: number,
  ): Promise<Array<{ id: string; data: Record<string, string> }>> {
    const fullKey = this.getFullKey(streamKey);

    // XREADGROUP GROUP group consumer COUNT count BLOCK ms STREAMS key id
    const result = await this.client.xreadgroup(
      "GROUP",
      groupName,
      consumerId,
      "COUNT",
      count,
      "BLOCK",
      timeoutMs,
      "STREAMS",
      fullKey,
      ">", // Fetch new messages only (not pending)
    );

    if (!result || !result[0]) {
      return [];
    }

    const messages = result[0][1] || [];
    return messages.map(([id, data]) => ({
      id,
      data: this.arrayToObject(data),
    }));
  }

  /**
   * Acknowledge a message as processed.
   * Removes from pending list.
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
    const fullKey = this.getFullKey(streamKey);

    // XACK key group id [id ...]
    const result = await this.client.xack(fullKey, groupName, messageId);

    if (result === 0) {
      // Message ID not found in pending list (may already be acked or invalid)
      console.warn(
        `Message ${messageId} not found in pending list for ${groupName}`,
      );
    }
  }

  /**
   * Get pending messages for a consumer group.
   * Used to detect and reclaim stuck messages (dead-letter detection).
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
    const fullKey = this.getFullKey(streamKey);

    // XPENDING key group [start end count] [consumer]
    // Returns: [count, start_id, end_id, [[consumer1, count1], [consumer2, count2], ...]]
    // Or with extended info: [[id, consumer, age_ms, delivery_count], ...]
    const result = await this.client.xpending(
      fullKey,
      groupName,
      "-", // start from earliest
      "+", // to latest
      count,
    );

    if (!result || !result[0]) {
      return [];
    }

    // Extended format returns array of [id, consumer, ageMs, deliveryCount]
    const messages = result[0];
    return messages.map(([id, consumer, ageMs]: [string, string, number]) => ({
      id,
      consumer,
      ageMs,
    }));
  }

  /**
   * Reclaim pending messages and reassign to a consumer.
   * Used for dead-letter recovery when a consumer crashes.
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
    const fullKey = this.getFullKey(streamKey);

    if (messageIds.length === 0) {
      return [];
    }

    // XCLAIM key group consumer min-idle-time id [id ...]
    // min-idle-time: only claim if pending for this many ms (0 = any)
    const messages = await this.client.xclaim(
      fullKey,
      groupName,
      consumerId,
      0, // claim any pending message
      ...messageIds,
    );

    return messages.map(([id, data]) => ({
      id,
      data: this.arrayToObject(data),
    }));
  }

  /**
   * Trim a stream to a maximum length.
   * Keeps the most recent messages, removes oldest.
   *
   * @param streamKey Stream key
   * @param maxLength Maximum number of messages to keep
   * @returns Number of messages deleted
   */
  async trimStream(streamKey: string, maxLength: number): Promise<number> {
    const fullKey = this.getFullKey(streamKey);

    // XTRIM key MAXLEN count
    const deleted = await this.client.xtrim(fullKey, "MAXLEN", maxLength);

    return deleted;
  }

  /**
   * Get information about a stream.
   * Used for monitoring and debugging.
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
    const fullKey = this.getFullKey(streamKey);

    try {
      // XINFO STREAM key
      const info = (await this.client.xinfo("STREAM", fullKey)) as any;

      return {
        length: info[1], // message count
        firstId: info[3], // first message ID
        lastId: info[5], // last message ID
        groups: info[9], // number of consumer groups
      };
    } catch (error: any) {
      if (error.message?.includes("no such key")) {
        return {
          length: 0,
          groups: 0,
        };
      }
      throw error;
    }
  }

  /**
   * Permanently delete a message from a stream.
   * Note: Redis streams don't actually remove messages, just mark as deleted.
   *
   * @param streamKey Stream key
   * @param messageId Message ID to delete
   */
  async deleteMessage(streamKey: string, messageId: string): Promise<void> {
    const fullKey = this.getFullKey(streamKey);

    // XDEL key id [id ...]
    // Marks message as deleted (doesn't free space, but it's inaccessible)
    await (this.client as any).xdel(fullKey, messageId);
  }

  /**
   * Delete an entire stream.
   * Used for cleanup in tests or when resetting.
   *
   * @param streamKey Stream key
   */
  async deleteStream(streamKey: string): Promise<void> {
    const fullKey = this.getFullKey(streamKey);
    await (this.client as any).del(fullKey);
  }

  // ───────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ───────────────────────────────────────────────────────────────

  /**
   * Construct full Redis key with prefix.
   */
  private getFullKey(streamKey: string): string {
    return `${this.keyPrefix}:${streamKey}`;
  }

  /**
   * Serialize EventEnvelope to flat array of alternating keys and values.
   * Redis XADD expects: field1 value1 field2 value2 ...
   */
  private serializeEnvelope(envelope: EventEnvelope): (string | number)[] {
    const result: (string | number)[] = [];

    // Add metadata as separate fields
    result.push("id", envelope.metadata.id);
    result.push("type", envelope.metadata.type);
    result.push("source", envelope.metadata.source);
    result.push("timestamp", envelope.metadata.timestamp);
    result.push("tenantId", envelope.metadata.tenantId);
    result.push("correlationId", envelope.metadata.correlationId);
    result.push("version", envelope.metadata.version.toString());

    if (envelope.metadata.userId) {
      result.push("userId", envelope.metadata.userId);
    }
    if (envelope.metadata.requestId) {
      result.push("requestId", envelope.metadata.requestId);
    }

    // Serialize event data as JSON string
    result.push("data", JSON.stringify(envelope.data));

    // Serialize tags as JSON
    if (envelope.metadata.tags) {
      result.push("tags", JSON.stringify(envelope.metadata.tags));
    }

    return result;
  }

  /**
   * Convert array of [key, value, key, value, ...] to object.
   */
  private arrayToObject(arr: string[]): Record<string, string> {
    const obj: Record<string, string> = {};
    for (let i = 0; i < arr.length; i += 2) {
      obj[arr[i]] = arr[i + 1];
    }
    return obj;
  }
}
