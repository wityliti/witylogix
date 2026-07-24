/**
 * Pusher Channels SDK Client
 *
 * Real-time pub/sub messaging with support for public, private, and presence channels.
 * Uses HMAC-SHA256 authentication and signature verification.
 *
 * Features:
 * - Authentication: app_id + key + secret, HMAC-SHA256 signing
 * - Trigger: single channel, multiple channels (up to 100), batch (up to 10 events)
 * - Channel types: public, private (auth required), presence (user info), encrypted
 * - Channel auth: generate auth token for private/presence channels
 * - Presence: who's online, user_info, member_added/removed
 * - Webhooks: channel_occupied/vacated, member_added/removed, client_event, HMAC-SHA256
 * - Channel info: GET /channels, GET /channels/{name}, GET /channels/{name}/users
 * - Client events: enable, validation
 * - Rate limiting: 10 msg/sec per channel, 200 concurrent connections (free)
 */

import { createHmac } from "crypto";

// ─── Types ───────────────────────────────────────────────────────

export type PusherChannelType = "public" | "private" | "presence" | "encrypted";

export interface PusherEvent {
  channel: string;
  event: string;
  data: Record<string, unknown> | string;
  socketId?: string;
}

export interface PusherBatchEvent {
  batch: Array<{
    channel: string;
    event: string;
    data: Record<string, unknown> | string;
    socketId?: string;
  }>;
}

export interface PusherChannel {
  name: string;
  type: PusherChannelType;
  occupied?: boolean;
  subscriptionCount?: number;
  userCount?: number;
}

export interface PusherPresenceData {
  userId: string;
  userInfo?: Record<string, unknown>;
  joinedAt?: Date;
  lastUpdate?: Date;
}

export interface PusherPresenceMember {
  id: string;
  info?: Record<string, unknown>;
}

export interface PusherWebhookPayload {
  time_ms: number;
  events: Array<{
    name: string;
    channel: string;
    event?: string;
    data?: Record<string, unknown>;
    socket_id?: string;
    user_id?: string;
  }>;
  signature?: string;
}

export interface PusherChannelInfo {
  name: string;
  occupied: boolean;
  subscriptionCount: number;
  userCount?: number;
  members?: PusherPresenceMember[];
}

export interface PusherClientAuthPayload {
  auth: string;
  shared_secret?: string;
  channel_data?: string;
}

// ─── Configuration ───────────────────────────────────────────────

export interface PusherSDKConfig {
  appId: string;
  key: string;
  secret: string;
  cluster?: string;
  baseUrl?: string;
  webhookSecret?: string;
  rateLimit?: { eventsPerSecond?: number; maxConcurrent?: number };
  timeout?: number;
  enableClientEvents?: boolean;
  encryptionMasterKey?: string;
}

// ─── Client ───────────────────────────────────────────────────────

export class PusherSDKClient {
  private readonly appId: string;
  private readonly key: string;
  private readonly secret: string;
  private readonly cluster: string;
  private readonly baseUrl: string;
  private readonly webhookSecret?: string;
  private readonly timeout: number;
  private readonly rateLimit: {
    eventsPerSecond: number;
    maxConcurrent: number;
  };
  private readonly enableClientEvents: boolean;
  private readonly encryptionMasterKey?: string;
  private requestQueue: Promise<unknown>[] = [];
  private rateLimitBucket: Map<string, number[]> = new Map();

  constructor(config: PusherSDKConfig) {
    if (!config.appId) {
      throw new Error("Pusher appId is required");
    }
    if (!config.key) {
      throw new Error("Pusher key is required");
    }
    if (!config.secret) {
      throw new Error("Pusher secret is required");
    }

    this.appId = config.appId;
    this.key = config.key;
    this.secret = config.secret;
    this.cluster = config.cluster || "mt1";
    this.baseUrl = config.baseUrl || `https://api-${this.cluster}.pusher.com`;
    this.webhookSecret = config.webhookSecret;
    this.timeout = config.timeout || 30000;
    this.enableClientEvents = config.enableClientEvents ?? false;
    this.encryptionMasterKey = config.encryptionMasterKey;
    this.rateLimit = {
      eventsPerSecond: config.rateLimit?.eventsPerSecond || 10,
      maxConcurrent: config.rateLimit?.maxConcurrent || 100,
    };
  }

  /**
   * Trigger event on a single channel.
   */
  async trigger(
    channel: string,
    event: string,
    data: Record<string, unknown> | string,
  ): Promise<void> {
    return this.withRateLimit(channel, async () => {
      const payload: Record<string, unknown> = {
        name: event,
        channels: [channel],
        data: typeof data === "string" ? data : JSON.stringify(data),
      };

      await this.makeRequest("POST", "/events", payload);
    });
  }

  /**
   * Trigger event on multiple channels (up to 100).
   */
  async triggerMultiple(
    channels: string[],
    event: string,
    data: Record<string, unknown> | string,
  ): Promise<void> {
    if (channels.length === 0) {
      throw new Error("At least one channel is required");
    }
    if (channels.length > 100) {
      throw new Error("Maximum 100 channels per request");
    }

    return this.withRateLimit(channels[0], async () => {
      const payload: Record<string, unknown> = {
        name: event,
        channels,
        data: typeof data === "string" ? data : JSON.stringify(data),
      };

      await this.makeRequest("POST", "/events", payload);
    });
  }

  /**
   * Batch trigger events (up to 10 events).
   */
  async triggerBatch(batch: PusherBatchEvent["batch"]): Promise<void> {
    if (batch.length === 0) {
      throw new Error("At least one event is required");
    }
    if (batch.length > 10) {
      throw new Error("Maximum 10 events per batch");
    }

    return this.withRateLimit(batch[0].channel, async () => {
      const events = batch.map((e) => ({
        name: e.event,
        channel: e.channel,
        data: typeof e.data === "string" ? e.data : JSON.stringify(e.data),
        socket_id: e.socketId,
      }));

      const payload = { batch: events };

      await this.makeRequest("POST", "/batch_events", payload);
    });
  }

  /**
   * Generate authentication token for private/presence channels.
   */
  generateChannelAuth(
    socketId: string,
    channel: string,
    userInfo?: Record<string, unknown>,
  ): PusherClientAuthPayload {
    if (!channel) {
      throw new Error("Channel name is required");
    }

    let channelData: string | undefined;

    if (channel.startsWith("presence-") && userInfo) {
      channelData = JSON.stringify({
        user_id: userInfo.userId || userInfo.id,
        user_info: userInfo,
      });
    }

    const stringToSign = `${socketId}:${channel}${channelData ? `:${channelData}` : ""}`;
    const auth = this.generateSignature(stringToSign);

    return {
      auth: `${this.key}:${auth}`,
      ...(channelData && { channel_data: channelData }),
      ...(this.encryptionMasterKey && {
        shared_secret: this.encryptionMasterKey,
      }),
    };
  }

  /**
   * Get information about all channels.
   */
  async getChannels(filter?: {
    prefix?: string;
    occupied?: boolean;
    count?: number;
    info?: string;
  }): Promise<PusherChannelInfo[]> {
    let path = "/channels";
    const params = new URLSearchParams();

    if (filter?.prefix) {
      params.append("filter_by_prefix", filter.prefix);
    }
    if (filter?.occupied) {
      params.append("filter_by_occupied", "true");
    }
    if (filter?.count) {
      params.append("count", String(filter.count));
    }
    if (filter?.info) {
      params.append("info", filter.info);
    }

    if (params.toString()) {
      path += `?${params.toString()}`;
    }

    const response = (await this.makeRequest("GET", path)) as {
      channels: Record<string, PusherChannel>;
    };

    return Object.entries(response.channels || {}).map(([name, channel]) => ({
      name,
      occupied: channel.occupied || false,
      subscriptionCount: channel.subscriptionCount || 0,
      userCount: channel.userCount,
    }));
  }

  /**
   * Get information about a specific channel.
   */
  async getChannel(channel: string, info?: string): Promise<PusherChannelInfo> {
    let path = `/channels/${encodeURIComponent(channel)}`;

    if (info) {
      path += `?info=${encodeURIComponent(info)}`;
    }

    const response = (await this.makeRequest(
      "GET",
      path,
    )) as unknown as PusherChannel;

    return {
      name: response.name,
      occupied: response.occupied || false,
      subscriptionCount: response.subscriptionCount || 0,
      userCount: response.userCount,
    };
  }

  /**
   * Get presence members of a presence channel.
   */
  async getPresenceMembers(channel: string): Promise<PusherPresenceMember[]> {
    const path = `/channels/${encodeURIComponent(channel)}/users`;
    const response = (await this.makeRequest("GET", path)) as {
      users: Array<{ id: string; info?: Record<string, unknown> }>;
    };

    return response.users.map((user) => ({
      id: user.id,
      info: user.info,
    }));
  }

  /**
   * Get a specific presence member.
   */
  async getPresenceMember(
    channel: string,
    userId: string,
  ): Promise<PusherPresenceMember | null> {
    const members = await this.getPresenceMembers(channel);
    return members.find((m) => m.id === userId) || null;
  }

  /**
   * Verify webhook signature using HMAC-SHA256.
   */
  verifyWebhookSignature(
    payload: PusherWebhookPayload,
    signature: string,
  ): boolean {
    if (!this.webhookSecret) {
      return false;
    }

    const data = JSON.stringify(payload);
    const hmac = createHmac("sha256", this.webhookSecret);
    hmac.update(data);
    const expectedSignature = hmac.digest("hex");

    // Timing-safe comparison
    return this.timingSafeEqual(expectedSignature, signature);
  }

  /**
   * Parse webhook payload.
   */
  parseWebhookPayload(payload: PusherWebhookPayload): {
    timestamp: Date;
    events: Array<{
      type: string;
      channel: string;
      data?: Record<string, unknown>;
      socketId?: string;
      userId?: string;
    }>;
  } {
    return {
      timestamp: new Date(payload.time_ms),
      events: payload.events.map((e) => ({
        type: e.name,
        channel: e.channel,
        data: e.data,
        socketId: e.socket_id,
        userId: e.user_id,
      })),
    };
  }

  /**
   * Generate socket auth for client-side authentication.
   */
  generateSocketAuth(socketId: string): PusherClientAuthPayload {
    const stringToSign = socketId;
    const auth = this.generateSignature(stringToSign);

    return {
      auth: `${this.key}:${auth}`,
    };
  }

  /**
   * Make HTTP request to Pusher API with authentication.
   */
  private async makeRequest(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(path, this.baseUrl);

    // Add authentication query parameters
    const queryParams: Record<string, string> = {
      auth_key: this.key,
      auth_timestamp: Math.floor(Date.now() / 1000).toString(),
      auth_version: "1.0",
    };

    // Add body to request if present
    let bodyStr: string | undefined;
    if (body && method !== "GET") {
      bodyStr = JSON.stringify(body);
    }

    // Generate auth signature
    const stringToSign = [
      method,
      path,
      this.buildQueryString(queryParams, bodyStr),
    ].join("\n");
    queryParams.auth_signature = this.generateSignature(stringToSign);

    // Add all query params to URL
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    };

    if (bodyStr) {
      options.body = bodyStr;
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      throw new Error(
        `Pusher API error: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return (await response.json()) as Record<string, unknown>;
    }

    return {};
  }

  /**
   * Build query string for authentication.
   */
  private buildQueryString(
    params: Record<string, string>,
    body?: string,
  ): string {
    const queryParts: string[] = [];

    Object.entries(params)
      .filter(([key]) => key !== "auth_signature")
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, value]) => {
        queryParts.push(`${key}=${encodeURIComponent(value)}`);
      });

    if (body) {
      queryParts.push(`body=${encodeURIComponent(body)}`);
    }

    return queryParts.join("&");
  }

  /**
   * Generate HMAC-SHA256 signature.
   */
  private generateSignature(data: string): string {
    const hmac = createHmac("sha256", this.secret);
    hmac.update(data);
    return hmac.digest("hex");
  }

  /**
   * Apply rate limiting to events.
   */
  private async withRateLimit<T>(
    channel: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    // Wait for concurrent limit
    while (this.requestQueue.length >= this.rateLimit.maxConcurrent) {
      await Promise.race(this.requestQueue);
      this.requestQueue = this.requestQueue.filter((p) => p !== undefined);
    }

    // Check rate limit bucket
    const now = Date.now();
    const bucket = this.rateLimitBucket.get(channel) || [];
    const recentRequests = bucket.filter((t) => now - t < 1000);

    if (recentRequests.length >= this.rateLimit.eventsPerSecond) {
      const oldestRequest = Math.min(...recentRequests);
      const delay = 1000 - (now - oldestRequest) + 10;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    recentRequests.push(now);
    this.rateLimitBucket.set(
      channel,
      recentRequests.slice(-this.rateLimit.eventsPerSecond),
    );

    const promise = fn();
    this.requestQueue.push(promise);

    try {
      return await promise;
    } finally {
      this.requestQueue = this.requestQueue.filter((p) => p !== promise);
    }
  }

  /**
   * Timing-safe string comparison for signature verification.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

export default PusherSDKClient;
