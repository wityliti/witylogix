/**
 * Rate Limiter — Notification rate limiting per customer
 */

import {
  NotificationChannel,
  RateLimitStatus,
  RateLimitConfig,
} from "./types.js";

/**
 * Rate limit entry
 */
interface RateLimitEntry {
  customerId: string;
  channel: NotificationChannel;
  count: number;
  resetAt: Date;
}

/**
 * In-memory rate limit store
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Default rate limit configuration
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxSmsPerDay: 10,
  maxWhatsAppPerDay: 5,
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Rate Limiter — prevents notification abuse
 */
export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Create a rate limit key
   */
  private getKey(customerId: string, channel: NotificationChannel): string {
    return `${customerId}:${channel}`;
  }

  /**
   * Check if a notification can be sent
   */
  canSend(customerId: string, channel: NotificationChannel): boolean {
    const key = this.getKey(customerId, channel);
    const now = new Date();

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);

    if (!entry) {
      // Create new entry
      const resetAt = new Date(now.getTime() + this.config.windowMs);
      entry = {
        customerId,
        channel,
        count: 0,
        resetAt,
      };
      rateLimitStore.set(key, entry);
      return true;
    }

    // Check if window has expired
    if (entry.resetAt <= now) {
      // Reset the window
      entry.count = 0;
      entry.resetAt = new Date(now.getTime() + this.config.windowMs);
      rateLimitStore.set(key, entry);
      return true;
    }

    // Check if limit exceeded
    const limit = this.getLimit(channel);
    return entry.count < limit;
  }

  /**
   * Record a sent notification
   */
  recordSend(customerId: string, channel: NotificationChannel): void {
    const key = this.getKey(customerId, channel);
    const now = new Date();

    let entry = rateLimitStore.get(key);

    if (!entry) {
      // Create new entry
      const resetAt = new Date(now.getTime() + this.config.windowMs);
      entry = {
        customerId,
        channel,
        count: 1,
        resetAt,
      };
    } else {
      // Check if window has expired and reset if needed
      if (entry.resetAt <= now) {
        entry.count = 1;
        entry.resetAt = new Date(now.getTime() + this.config.windowMs);
      } else {
        entry.count++;
      }
    }

    rateLimitStore.set(key, entry);
  }

  /**
   * Get rate limit status
   */
  getStatus(customerId: string, channel: NotificationChannel): RateLimitStatus {
    const key = this.getKey(customerId, channel);
    const now = new Date();

    let entry = rateLimitStore.get(key);

    if (!entry) {
      const resetAt = new Date(now.getTime() + this.config.windowMs);
      return {
        customerId,
        channel,
        sentToday: 0,
        limit: this.getLimit(channel),
        canSend: true,
        resetAt,
      };
    }

    // Check if window has expired
    if (entry.resetAt <= now) {
      const resetAt = new Date(now.getTime() + this.config.windowMs);
      return {
        customerId,
        channel,
        sentToday: 0,
        limit: this.getLimit(channel),
        canSend: true,
        resetAt,
      };
    }

    const limit = this.getLimit(channel);
    return {
      customerId,
      channel,
      sentToday: entry.count,
      limit,
      canSend: entry.count < limit,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Get limit for a channel
   */
  private getLimit(channel: NotificationChannel): number {
    switch (channel) {
      case "sms":
        return this.config.maxSmsPerDay;
      case "whatsapp":
        return this.config.maxWhatsAppPerDay;
      case "email":
      case "push":
      default:
        return 1000; // No practical limit
    }
  }

  /**
   * Reset rate limit for a customer
   */
  reset(customerId: string, channel: NotificationChannel): void {
    const key = this.getKey(customerId, channel);
    rateLimitStore.delete(key);
  }

  /**
   * Reset all rate limits for a customer
   */
  resetAll(customerId: string): void {
    for (const channel of [
      "email",
      "sms",
      "whatsapp",
      "push",
    ] as NotificationChannel[]) {
      this.reset(customerId, channel);
    }
  }

  /**
   * Get all rate limit entries (for monitoring)
   */
  getAllEntries(): RateLimitEntry[] {
    return Array.from(rateLimitStore.values());
  }

  /**
   * Clear all rate limits (for testing)
   */
  clearAll(): void {
    rateLimitStore.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}
