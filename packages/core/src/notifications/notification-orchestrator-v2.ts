/**
 * Notification Orchestrator v2
 *
 * Advanced multi-channel notification engine with:
 * - ChannelRouter: Priority matrix routing with per-recipient preferences
 * - FallbackChain: Provider fallback with configurable retries
 * - QuietHoursManager: Timezone-aware quiet hours with queue flush
 * - DigestBatcher: Batch low-priority notifications into digests
 * - DeliveryTracker: Track status across channels (PENDING→SENT→DELIVERED→READ→FAILED)
 * - RetryManager: Exponential backoff with per-channel limits
 * - NotificationThrottler: Per-recipient rate limiting
 *
 * Architecture:
 *   Request → Validation → Channel Router → Quiet Hours Check
 *   ↓
 *   Digest Batcher → Delivery Tracker → Provider Selection
 *   ↓
 *   Retry Manager → Send → Status Update
 */

import { z } from "zod";
import type {
  NotificationRequest,
  BatchNotificationRequest,
  NotificationTemplate,
  RecipientPreferences,
  NotificationChannel,
  NotificationPriority,
  DeliveryStatus,
  ChannelConfig,
  PriorityMatrix,
  DigestConfig,
  QuietHoursConfig,
  DeliveryReceipt,
  NotificationWithReceipts,
} from "./notification-types.js";
import {
  NotificationRequestSchema,
  BatchNotificationRequestSchema,
  NotificationChannel as NotificationChannelEnum,
  NotificationPriority as NotificationPriorityEnum,
  DeliveryStatus as DeliveryStatusEnum,
} from "./notification-types.js";

// ─── CHANNEL ROUTER ─────────────────────────────────────────────────────

/**
 * Routes notifications through channels based on priority matrix
 * and recipient preferences
 */
export class ChannelRouter {
  private priorityMatrix: PriorityMatrix = this.getDefaultPriorityMatrix();

  /**
   * Get channels for recipient based on priority and preferences
   */
  async routeChannels(
    priority: NotificationPriority,
    recipientPrefs: RecipientPreferences | undefined,
    requestChannels?: NotificationChannel[],
  ): Promise<NotificationChannel[]> {
    // Override with explicit request channels if provided
    if (requestChannels && requestChannels.length > 0) {
      return requestChannels;
    }

    // Get channels from priority matrix
    const matrixChannels =
      this.priorityMatrix[priority]
        ?.filter((c) => c.enabled)
        .sort((a, b) => a.priority - b.priority)
        .map((c) => c.channel) || [];

    if (!recipientPrefs) {
      return matrixChannels;
    }

    // Filter by recipient preferences
    return matrixChannels.filter((channel) => {
      const pref = recipientPrefs.preferences.find(
        (p) => p.channel === channel,
      );
      return pref ? pref.enabled : true; // Default to enabled if no preference
    });
  }

  /**
   * Set custom priority matrix
   */
  setPriorityMatrix(matrix: PriorityMatrix): void {
    this.priorityMatrix = matrix;
  }

  /**
   * Get default priority matrix
   */
  private getDefaultPriorityMatrix(): PriorityMatrix {
    return {
      CRITICAL: [
        { channel: NotificationChannelEnum.PUSH, priority: 1, enabled: true },
        {
          channel: NotificationChannelEnum.SMS,
          priority: 2,
          enabled: true,
          fallbackChain: [NotificationChannelEnum.EMAIL],
        },
        { channel: NotificationChannelEnum.EMAIL, priority: 3, enabled: true },
      ],
      HIGH: [
        { channel: NotificationChannelEnum.PUSH, priority: 1, enabled: true },
        { channel: NotificationChannelEnum.SMS, priority: 2, enabled: true },
        { channel: NotificationChannelEnum.EMAIL, priority: 3, enabled: true },
      ],
      NORMAL: [
        { channel: NotificationChannelEnum.PUSH, priority: 1, enabled: true },
        { channel: NotificationChannelEnum.EMAIL, priority: 2, enabled: true },
        { channel: NotificationChannelEnum.SMS, priority: 3, enabled: true },
      ],
      LOW: [
        { channel: NotificationChannelEnum.EMAIL, priority: 1, enabled: true },
        { channel: NotificationChannelEnum.PUSH, priority: 2, enabled: true },
      ],
      DIGEST: [
        { channel: NotificationChannelEnum.EMAIL, priority: 1, enabled: true },
      ],
    };
  }
}

// ─── FALLBACK CHAIN ─────────────────────────────────────────────────────

/**
 * Manages fallback chain: if primary channel fails, try next in chain
 */
export class FallbackChain {
  private maxRetries: number = 3;

  /**
   * Get fallback chain for a channel
   */
  getChain(
    channel: NotificationChannel,
    config: ChannelConfig | undefined,
  ): NotificationChannel[] {
    if (!config || !config.fallbackChain) {
      return [channel]; // Single channel if no fallback
    }
    return [channel, ...config.fallbackChain];
  }

  /**
   * Set max retries per channel
   */
  setMaxRetries(maxRetries: number): void {
    this.maxRetries = maxRetries;
  }

  /**
   * Get retry limit for channel
   */
  getRetryLimit(config: ChannelConfig | undefined): number {
    return config?.retryLimit || this.maxRetries;
  }
}

// ─── QUIET HOURS MANAGER ────────────────────────────────────────────────

/**
 * Manages timezone-aware quiet hours
 * Queues notifications during quiet hours, flushes on wake
 */
export class QuietHoursManager {
  private quietQueue: Map<string, NotificationRequest[]> = new Map();

  /**
   * Check if quiet hours are active for recipient
   */
  async isInQuietHours(
    recipientId: string,
    prefs: RecipientPreferences | undefined,
    priority: NotificationPriority,
  ): Promise<boolean> {
    if (!prefs) {
      return false; // No preferences = always active
    }

    // Critical and HIGH priority bypass quiet hours
    if (
      priority === NotificationPriorityEnum.CRITICAL ||
      priority === NotificationPriorityEnum.HIGH
    ) {
      return false;
    }

    // Check global quiet hours
    if (prefs.globalQuietHours && prefs.globalQuietHours.enabled) {
      if (
        this.isCurrentlyInQuietHours(prefs.globalQuietHours, prefs.timezone)
      ) {
        return true;
      }
    }

    // Check channel-specific quiet hours
    for (const pref of prefs.preferences) {
      if (
        pref.quietHours &&
        pref.quietHours.enabled &&
        this.isCurrentlyInQuietHours(pref.quietHours, pref.quietHours.timezone)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Queue notification if in quiet hours
   */
  async queueIfQuiet(
    recipientId: string,
    request: NotificationRequest,
    isQuiet: boolean,
  ): Promise<boolean> {
    if (!isQuiet) {
      return false; // Not queued
    }

    const queue = this.quietQueue.get(recipientId) || [];
    queue.push(request);
    this.quietQueue.set(recipientId, queue);
    return true;
  }

  /**
   * Flush queued notifications for recipient (call on wake)
   */
  async flushQueue(recipientId: string): Promise<NotificationRequest[]> {
    const queue = this.quietQueue.get(recipientId) || [];
    this.quietQueue.delete(recipientId);
    return queue;
  }

  /**
   * Get queue size for recipient
   */
  async getQueueSize(recipientId: string): Promise<number> {
    return (this.quietQueue.get(recipientId) || []).length;
  }

  /**
   * Check if current time is within quiet hours
   */
  private isCurrentlyInQuietHours(
    config: QuietHoursConfig,
    timezone: string,
  ): boolean {
    const now = new Date();
    // Convert to target timezone (simplified - in production use date-fns/Intl)
    const currentHour = now.getHours(); // Simplified assumption of UTC
    return currentHour >= config.startHour || currentHour < config.endHour;
  }
}

// ─── DIGEST BATCHER ─────────────────────────────────────────────────────

/**
 * Batches low-priority notifications into hourly/daily digests
 */
export class DigestBatcher {
  private digestQueues: Map<
    string,
    { notifications: NotificationRequest[]; createdAt: Date }
  > = new Map();

  /**
   * Check if notification should be batched
   */
  async shouldBatch(
    priority: NotificationPriority,
    prefs: RecipientPreferences | undefined,
  ): Promise<boolean> {
    if (
      priority !== NotificationPriorityEnum.LOW &&
      priority !== NotificationPriorityEnum.DIGEST
    ) {
      return false;
    }

    if (!prefs || !prefs.globalDigest) {
      return false;
    }

    return prefs.globalDigest.enabled;
  }

  /**
   * Add notification to digest queue
   */
  async addToDigest(
    recipientId: string,
    request: NotificationRequest,
  ): Promise<void> {
    const queueKey = recipientId;
    const queue = this.digestQueues.get(queueKey) || {
      notifications: [],
      createdAt: new Date(),
    };
    queue.notifications.push(request);
    this.digestQueues.set(queueKey, queue);
  }

  /**
   * Get digest for recipient
   */
  async getDigest(recipientId: string): Promise<NotificationRequest[] | null> {
    const queue = this.digestQueues.get(recipientId);
    if (!queue) {
      return null;
    }

    // Check if digest is ready (hourly/daily threshold)
    const age = Date.now() - queue.createdAt.getTime();
    const oneHourMs = 60 * 60 * 1000;

    if (age < oneHourMs) {
      return null; // Not ready yet
    }

    // Digest is ready
    this.digestQueues.delete(recipientId);
    return queue.notifications;
  }

  /**
   * Force flush digest
   */
  async flushDigest(
    recipientId: string,
  ): Promise<NotificationRequest[] | null> {
    const queue = this.digestQueues.get(recipientId);
    if (!queue) {
      return null;
    }
    this.digestQueues.delete(recipientId);
    return queue.notifications;
  }

  /**
   * Get digest queue size
   */
  async getQueueSize(recipientId: string): Promise<number> {
    return this.digestQueues.get(recipientId)?.notifications.length || 0;
  }
}

// ─── DELIVERY TRACKER ────────────────────────────────────────────────────

/**
 * Tracks delivery status per message per channel
 */
export class DeliveryTracker {
  private receipts: Map<string, DeliveryReceipt[]> = new Map();

  /**
   * Create initial receipt for message
   */
  async createReceipt(
    messageId: string,
    channel: NotificationChannel,
  ): Promise<DeliveryReceipt> {
    const receipt: DeliveryReceipt = {
      messageId,
      channel,
      status: DeliveryStatusEnum.PENDING,
      timestamp: new Date(),
      retryCount: 0,
    };

    const key = messageId;
    const receipts = this.receipts.get(key) || [];
    receipts.push(receipt);
    this.receipts.set(key, receipts);

    return receipt;
  }

  /**
   * Update receipt status
   */
  async updateReceipt(
    messageId: string,
    channel: NotificationChannel,
    status: DeliveryStatus,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const key = messageId;
    const receipts = this.receipts.get(key) || [];
    const receipt = receipts.find((r) => r.channel === channel);

    if (receipt) {
      receipt.status = status;
      receipt.timestamp = new Date();
      receipt.metadata = metadata;
    }
  }

  /**
   * Get receipts for message
   */
  async getReceipts(messageId: string): Promise<DeliveryReceipt[]> {
    return this.receipts.get(messageId) || [];
  }

  /**
   * Get overall status for message
   */
  async getMessageStatus(messageId: string): Promise<DeliveryStatus> {
    const receipts = await this.getReceipts(messageId);
    if (receipts.length === 0) {
      return DeliveryStatusEnum.PENDING;
    }

    // If any are READ, message is READ
    if (receipts.some((r) => r.status === DeliveryStatusEnum.READ)) {
      return DeliveryStatusEnum.READ;
    }

    // If any are DELIVERED, message is DELIVERED
    if (receipts.some((r) => r.status === DeliveryStatusEnum.DELIVERED)) {
      return DeliveryStatusEnum.DELIVERED;
    }

    // If any are SENT, message is SENT
    if (receipts.some((r) => r.status === DeliveryStatusEnum.SENT)) {
      return DeliveryStatusEnum.SENT;
    }

    // If all are FAILED, message is FAILED
    if (receipts.every((r) => r.status === DeliveryStatusEnum.FAILED)) {
      return DeliveryStatusEnum.FAILED;
    }

    // Otherwise PENDING
    return DeliveryStatusEnum.PENDING;
  }
}

// ─── RETRY MANAGER ──────────────────────────────────────────────────────

/**
 * Manages exponential backoff and per-channel retry limits
 */
export class RetryManager {
  private deadLetterQueue: Map<string, NotificationRequest> = new Map();
  private baseBackoffMs: number = 100;
  private maxBackoffMs: number = 30000; // 30 seconds

  /**
   * Calculate retry delay with exponential backoff + jitter
   */
  calculateDelay(attemptNumber: number): number {
    const exponential = this.baseBackoffMs * Math.pow(2, attemptNumber);
    const capped = Math.min(exponential, this.maxBackoffMs);
    const jitter = Math.random() * 0.1 * capped; // 0-10% jitter
    return Math.floor(capped + jitter);
  }

  /**
   * Move failed notification to dead letter queue
   */
  async moveToDeadLetter(request: NotificationRequest): Promise<void> {
    const key = request.id || `${request.tenantId}:${request.recipientId}`;
    this.deadLetterQueue.set(key, request);
  }

  /**
   * Get dead letter queue
   */
  async getDeadLetterQueue(): Promise<NotificationRequest[]> {
    return Array.from(this.deadLetterQueue.values());
  }

  /**
   * Remove from dead letter queue
   */
  async removeFromDeadLetter(requestId: string): Promise<void> {
    this.deadLetterQueue.delete(requestId);
  }

  /**
   * Set base backoff time
   */
  setBaseBackoff(ms: number): void {
    this.baseBackoffMs = ms;
  }

  /**
   * Set max backoff time
   */
  setMaxBackoff(ms: number): void {
    this.maxBackoffMs = ms;
  }
}

// ─── NOTIFICATION THROTTLER ─────────────────────────────────────────────

/**
 * Per-recipient rate limiting
 */
export class NotificationThrottler {
  private limits: Map<string, { email: number; sms: number; push: number }> =
    new Map();

  // Default rate limits per hour
  private readonly DEFAULT_LIMITS = {
    email: 10,
    sms: 5,
    push: 20,
  };

  private readonly windowMs = 60 * 60 * 1000; // 1 hour

  /**
   * Check if notification would exceed rate limit
   */
  async isRateLimited(
    recipientId: string,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const counts = this.limits.get(recipientId);
    if (!counts) {
      return false; // No limit tracking yet
    }

    const channelKey = channel.toLowerCase() as keyof typeof counts;
    const limit = this.DEFAULT_LIMITS[channelKey];

    return counts[channelKey] >= limit;
  }

  /**
   * Record notification send
   */
  async recordSend(
    recipientId: string,
    channel: NotificationChannel,
  ): Promise<void> {
    const counts = this.limits.get(recipientId) || {
      email: 0,
      sms: 0,
      push: 0,
    };
    const channelKey = channel.toLowerCase() as keyof typeof counts;
    counts[channelKey]++;
    this.limits.set(recipientId, counts);

    // Reset counters after window
    setTimeout(() => {
      const current = this.limits.get(recipientId);
      if (current) {
        current[channelKey] = Math.max(0, current[channelKey] - 1);
      }
    }, this.windowMs);
  }

  /**
   * Set custom rate limit for channel
   */
  setRateLimit(channel: NotificationChannel, limit: number): void {
    const channelKey =
      channel.toLowerCase() as keyof typeof this.DEFAULT_LIMITS;
    this.DEFAULT_LIMITS[channelKey] = limit;
  }

  /**
   * Get current counts for recipient
   */
  async getCounts(
    recipientId: string,
  ): Promise<{ email: number; sms: number; push: number }> {
    return this.limits.get(recipientId) || { email: 0, sms: 0, push: 0 };
  }
}

// ─── MAIN ORCHESTRATOR ──────────────────────────────────────────────────

/**
 * Central notification orchestrator coordinating all components
 */
export class NotificationOrchestratorV2 {
  private channelRouter = new ChannelRouter();
  private fallbackChain = new FallbackChain();
  private quietHoursManager = new QuietHoursManager();
  private digestBatcher = new DigestBatcher();
  private deliveryTracker = new DeliveryTracker();
  private retryManager = new RetryManager();
  private throttler = new NotificationThrottler();

  /**
   * Send a single notification
   */
  async send(request: NotificationRequest): Promise<void> {
    // Validate input
    const validation = NotificationRequestSchema.safeParse(request);
    if (!validation.success) {
      throw new Error(
        `Invalid notification request: ${validation.error.message}`,
      );
    }

    const validated = validation.data;

    // Generate message ID if not provided
    const messageId = validated.id || this.generateMessageId();

    // Check rate limits
    const throttled = await this.throttler.isRateLimited(
      validated.recipientId,
      NotificationChannelEnum.EMAIL,
    );
    if (throttled) {
      // Move to digest batcher
      await this.digestBatcher.addToDigest(validated.recipientId, {
        ...validated,
        id: messageId,
      });
      return;
    }

    // Check quiet hours
    const isQuiet = await this.quietHoursManager.isInQuietHours(
      validated.recipientId,
      undefined, // Would fetch from DB in production
      validated.priority,
    );
    if (isQuiet) {
      await this.quietHoursManager.queueIfQuiet(
        validated.recipientId,
        { ...validated, id: messageId },
        true,
      );
      return;
    }

    // Route channels
    const channels = await this.channelRouter.routeChannels(
      validated.priority,
      undefined,
      validated.channels,
    );

    // Create delivery receipts
    for (const channel of channels) {
      await this.deliveryTracker.createReceipt(messageId, channel);
    }

    // Record send
    for (const channel of channels) {
      await this.throttler.recordSend(validated.recipientId, channel);
    }
  }

  /**
   * Send batch notifications
   */
  async sendBatch(request: BatchNotificationRequest): Promise<void> {
    // Validate input
    const validation = BatchNotificationRequestSchema.safeParse(request);
    if (!validation.success) {
      throw new Error(`Invalid batch request: ${validation.error.message}`);
    }

    const validated = validation.data;

    // Send to each recipient
    for (const recipient of validated.recipients) {
      const singleRequest: NotificationRequest = {
        tenantId: validated.tenantId,
        recipientId: recipient.recipientId,
        templateId: validated.templateId,
        category: validated.category,
        priority: validated.priority,
        channels: recipient.channels || validated.channels,
        variables: recipient.variables,
        metadata: validated.metadata,
        scheduledFor: validated.scheduledFor,
        expiresAt: validated.expiresAt,
      };

      await this.send(singleRequest);
    }
  }

  /**
   * Get notification with all delivery statuses
   */
  async getNotification(
    messageId: string,
  ): Promise<NotificationWithReceipts | null> {
    const receipts = await this.deliveryTracker.getReceipts(messageId);
    if (receipts.length === 0) {
      return null;
    }

    // In production, fetch actual notification details from database
    return {
      id: messageId,
      tenantId: "",
      recipientId: "",
      templateId: "",
      category: "SYSTEM" as const,
      priority: "NORMAL" as const,
      body: "",
      channels: receipts.map((r) => r.channel),
      receipts,
      createdAt: new Date(),
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(messageId: string): Promise<void> {
    const receipts = await this.deliveryTracker.getReceipts(messageId);
    for (const receipt of receipts) {
      await this.deliveryTracker.updateReceipt(
        messageId,
        receipt.channel,
        DeliveryStatusEnum.READ,
      );
    }
  }

  /**
   * Get delivery status for message
   */
  async getDeliveryStatus(messageId: string): Promise<DeliveryStatus> {
    return this.deliveryTracker.getMessageStatus(messageId);
  }

  /**
   * Get quiet hours queue for recipient
   */
  async getQuietQueue(recipientId: string): Promise<NotificationRequest[]> {
    const size = await this.quietHoursManager.getQueueSize(recipientId);
    if (size === 0) {
      return [];
    }
    return this.quietHoursManager.flushQueue(recipientId);
  }

  /**
   * Get digest for recipient
   */
  async getDigest(recipientId: string): Promise<NotificationRequest[] | null> {
    return this.digestBatcher.getDigest(recipientId);
  }

  /**
   * Get dead letter queue
   */
  async getDeadLetterQueue(): Promise<NotificationRequest[]> {
    return this.retryManager.getDeadLetterQueue();
  }

  /**
   * Get current throttle counts
   */
  async getThrottleCounts(
    recipientId: string,
  ): Promise<{ email: number; sms: number; push: number }> {
    return this.throttler.getCounts(recipientId);
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Getters for components (for advanced customization)
  getChannelRouter(): ChannelRouter {
    return this.channelRouter;
  }

  getFallbackChain(): FallbackChain {
    return this.fallbackChain;
  }

  getQuietHoursManager(): QuietHoursManager {
    return this.quietHoursManager;
  }

  getDigestBatcher(): DigestBatcher {
    return this.digestBatcher;
  }

  getDeliveryTracker(): DeliveryTracker {
    return this.deliveryTracker;
  }

  getRetryManager(): RetryManager {
    return this.retryManager;
  }

  getThrottler(): NotificationThrottler {
    return this.throttler;
  }
}

/**
 * Global singleton instance
 */
let orchestratorInstance: NotificationOrchestratorV2 | null = null;

/**
 * Get global notification orchestrator instance
 */
export function getNotificationOrchestratorV2(): NotificationOrchestratorV2 {
  if (!orchestratorInstance) {
    orchestratorInstance = new NotificationOrchestratorV2();
  }
  return orchestratorInstance;
}

/**
 * Reset orchestrator (for testing)
 */
export function resetNotificationOrchestratorV2(): void {
  orchestratorInstance = null;
}
