/**
 * Campaign Executor
 * Executes campaign sending with state machine, batch processing, and error handling
 * Implements pause/resume support and tracks progress in real-time
 */

import { CampaignStatus, CampaignType, CampaignContent } from './types.js';

/**
 * Campaign execution state
 */
export type ExecutionState =
  | 'validating'
  | 'fetching_audience'
  | 'batching'
  | 'sending'
  | 'tracking'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'resumed';

/**
 * Campaign execution context
 */
export interface ExecutionContext {
  campaignId: string;
  tenantId: string;
  state: ExecutionState;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  currentBatchIndex: number;
  totalBatches: number;
  startedAt: Date;
  updatedAt: Date;
  error?: string;
  isPaused: boolean;
}

/**
 * Recipient data for sending
 */
export interface RecipientData {
  customerId: string;
  email?: string;
  phone?: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Send result for individual recipient
 */
export interface SendResultItem {
  recipientId: string;
  messageId: string;
  status: 'sent' | 'failed';
  error?: string;
  timestamp: Date;
}

/**
 * Dispatcher interface for sending messages
 */
export interface MessageDispatcher {
  send(
    channel: string,
    recipient: RecipientData,
    content: CampaignContent
  ): Promise<SendResultItem>;
  sendBatch(
    channel: string,
    recipients: RecipientData[],
    content: CampaignContent
  ): Promise<SendResultItem[]>;
}

/**
 * Error class for executor
 */
export class ExecutorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutorError';
  }
}

/**
 * Campaign Executor for running campaign execution
 */
export class CampaignExecutor {
  /**
   * Batch size for processing recipients
   */
  private readonly BATCH_SIZE = 100;

  /**
   * Failure threshold (percentage) - fail campaign if > 50% of sends fail
   */
  private readonly FAILURE_THRESHOLD = 0.5;

  /**
   * Execution contexts storage (would use database in production)
   */
  private executionContexts: Map<string, ExecutionContext> = new Map();

  /**
   * Active pause/resume tokens
   */
  private pausedCampaigns: Set<string> = new Set();

  constructor(private dispatcher: MessageDispatcher) {}

  /**
   * Execute a campaign with full state machine
   * Returns execution context with final stats
   */
  async execute(
    campaignId: string,
    tenantId: string,
    recipients: RecipientData[],
    content: CampaignContent,
    campaignType: CampaignType
  ): Promise<ExecutionContext> {
    if (!campaignId || !tenantId || !recipients || recipients.length === 0) {
      throw new ExecutorError(
        'campaignId, tenantId, and recipients are required'
      );
    }

    // Initialize execution context
    const context: ExecutionContext = {
      campaignId,
      tenantId,
      state: 'validating',
      totalRecipients: recipients.length,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      openedCount: 0,
      clickedCount: 0,
      bouncedCount: 0,
      unsubscribedCount: 0,
      currentBatchIndex: 0,
      totalBatches: Math.ceil(recipients.length / this.BATCH_SIZE),
      startedAt: new Date(),
      updatedAt: new Date(),
      isPaused: false,
    };

    this.executionContexts.set(campaignId, context);

    try {
      // State 1: Validate campaign and content
      await this.validateCampaign(campaignId, content, campaignType);
      context.state = 'fetching_audience';
      this.updateContext(context);

      // State 2: Fetch audience (already done in this case)
      context.state = 'batching';
      this.updateContext(context);

      // State 3: Batch recipients
      const batches = this.createBatches(recipients);
      context.totalBatches = batches.length;
      this.updateContext(context);

      // State 4: Send messages in batches
      context.state = 'sending';
      await this.sendBatches(
        context,
        batches,
        content,
        campaignType
      );
      this.updateContext(context);

      // State 5: Track results
      context.state = 'tracking';
      this.updateContext(context);

      // Check for failure threshold
      const failureRate = context.failedCount / context.totalRecipients;
      if (failureRate > this.FAILURE_THRESHOLD) {
        context.state = 'failed';
        context.error = `Campaign failed: ${(failureRate * 100).toFixed(2)}% of messages failed (threshold: ${(this.FAILURE_THRESHOLD * 100).toFixed(2)}%)`;
        context.updatedAt = new Date();
        this.updateContext(context);
        throw new ExecutorError(context.error);
      }

      // Mark as completed
      context.state = 'completed';
      context.updatedAt = new Date();
      this.updateContext(context);

      return context;
    } catch (error) {
      context.state = 'failed';
      context.error = error instanceof Error ? error.message : String(error);
      context.updatedAt = new Date();
      this.updateContext(context);
      throw error;
    }
  }

  /**
   * Pause campaign execution
   */
  pauseCampaign(campaignId: string): void {
    this.pausedCampaigns.add(campaignId);
    const context = this.executionContexts.get(campaignId);
    if (context) {
      context.state = 'paused';
      context.isPaused = true;
      context.updatedAt = new Date();
      this.updateContext(context);
    }
  }

  /**
   * Resume campaign execution
   */
  resumeCampaign(campaignId: string): void {
    this.pausedCampaigns.delete(campaignId);
    const context = this.executionContexts.get(campaignId);
    if (context) {
      context.state = 'resumed';
      context.isPaused = false;
      context.updatedAt = new Date();
      this.updateContext(context);
    }
  }

  /**
   * Get execution context for a campaign
   */
  getContext(campaignId: string): ExecutionContext | undefined {
    return this.executionContexts.get(campaignId);
  }

  /**
   * Validate campaign before execution
   */
  private async validateCampaign(
    campaignId: string,
    content: CampaignContent,
    campaignType: CampaignType
  ): Promise<void> {
    if (!campaignId) {
      throw new ExecutorError('Campaign ID is required');
    }

    if (!content) {
      throw new ExecutorError('Campaign content is required');
    }

    // Validate content based on campaign type
    switch (campaignType) {
      case CampaignType.EMAIL:
        if (!content.email?.subject || !content.email?.htmlBody) {
          throw new ExecutorError(
            'Email campaign must have subject and htmlBody'
          );
        }
        if (!content.email?.fromEmail) {
          throw new ExecutorError('Email campaign must have fromEmail');
        }
        break;

      case CampaignType.SMS:
        if (!content.sms?.message) {
          throw new ExecutorError('SMS campaign must have message');
        }
        if (content.sms.message.length > 160) {
          throw new ExecutorError('SMS message must not exceed 160 characters');
        }
        break;

      case CampaignType.WHATSAPP:
        if (!content.whatsapp?.templateName) {
          throw new ExecutorError('WhatsApp campaign must have templateName');
        }
        break;

      case CampaignType.PUSH:
        if (!content.push?.title || !content.push?.body) {
          throw new ExecutorError('Push campaign must have title and body');
        }
        break;

      case CampaignType.MULTI_CHANNEL:
        if (!content.email && !content.sms && !content.whatsapp && !content.push) {
          throw new ExecutorError(
            'Multi-channel campaign must have at least one channel configured'
          );
        }
        break;

      default:
        throw new ExecutorError(`Unknown campaign type: ${campaignType}`);
    }
  }

  /**
   * Split recipients into batches
   */
  private createBatches(recipients: RecipientData[]): RecipientData[][] {
    const batches: RecipientData[][] = [];

    for (let i = 0; i < recipients.length; i += this.BATCH_SIZE) {
      batches.push(recipients.slice(i, i + this.BATCH_SIZE));
    }

    return batches;
  }

  /**
   * Send batches of messages with pause/resume support
   */
  private async sendBatches(
    context: ExecutionContext,
    batches: RecipientData[][],
    content: CampaignContent,
    campaignType: CampaignType
  ): Promise<void> {
    for (let i = 0; i < batches.length; i++) {
      // Check if paused
      while (this.pausedCampaigns.has(context.campaignId)) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      context.currentBatchIndex = i + 1;
      const batch = batches[i];

      try {
        // Determine channel to use
        const channel = this.getChannelFromCampaignType(campaignType);

        // Send batch
        const results = await this.dispatcher.sendBatch(
          channel,
          batch,
          content
        );

        // Update stats
        for (const result of results) {
          if (result.status === 'sent') {
            context.sentCount++;
            context.deliveredCount++; // Assume delivered if sent
          } else {
            context.failedCount++;
          }
        }
      } catch (error) {
        // Continue on batch error, but increment failed count
        context.failedCount += batch.length;
      }

      context.updatedAt = new Date();
      this.updateContext(context);

      // Small delay between batches to avoid overwhelming services
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Get channel name from campaign type
   */
  private getChannelFromCampaignType(campaignType: CampaignType): string {
    switch (campaignType) {
      case CampaignType.EMAIL:
        return 'email';
      case CampaignType.SMS:
        return 'sms';
      case CampaignType.WHATSAPP:
        return 'whatsapp';
      case CampaignType.PUSH:
        return 'push';
      case CampaignType.MULTI_CHANNEL:
        return 'multi_channel';
      default:
        return 'email';
    }
  }

  /**
   * Update execution context in storage
   */
  private updateContext(context: ExecutionContext): void {
    context.updatedAt = new Date();
    this.executionContexts.set(context.campaignId, context);
  }

  /**
   * Get execution progress as percentage
   */
  getProgress(campaignId: string): number {
    const context = this.executionContexts.get(campaignId);
    if (!context) {
      return 0;
    }

    if (context.state === 'completed' || context.state === 'failed') {
      return 100;
    }

    if (context.totalBatches === 0) {
      return 0;
    }

    return Math.round(
      (context.currentBatchIndex / context.totalBatches) * 100
    );
  }

  /**
   * Get execution stats
   */
  getStats(campaignId: string): Partial<ExecutionContext> | undefined {
    const context = this.executionContexts.get(campaignId);
    if (!context) {
      return undefined;
    }

    return {
      campaignId: context.campaignId,
      state: context.state,
      totalRecipients: context.totalRecipients,
      sentCount: context.sentCount,
      deliveredCount: context.deliveredCount,
      failedCount: context.failedCount,
      openedCount: context.openedCount,
      clickedCount: context.clickedCount,
      startedAt: context.startedAt,
      updatedAt: context.updatedAt,
    };
  }

  /**
   * Clean up old execution contexts
   */
  cleanup(olderThanHours: number = 24): number {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

    let deletedCount = 0;

    for (const [campaignId, context] of this.executionContexts.entries()) {
      if (
        (context.state === 'completed' || context.state === 'failed') &&
        context.updatedAt < cutoffDate
      ) {
        this.executionContexts.delete(campaignId);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}
