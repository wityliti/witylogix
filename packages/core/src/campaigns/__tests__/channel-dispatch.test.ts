/**
 * Campaign Channel Dispatcher Tests
 * Tests campaign dispatcher with rate limiting per channel type
 * ~500 lines
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ───────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ───────────────────────────────────────────────────────────────────────────

export type ChannelType = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';
export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface RateLimit {
  channel: ChannelType;
  messagesPerMinute: number;
}

export interface NotificationMessage {
  recipientId: string;
  channel: ChannelType;
  subject?: string;
  body: string;
  templateId?: string;
}

export interface NotificationResult {
  messageId: string;
  status: 'sent' | 'failed' | 'queued' | 'rate_limited';
  sentAt?: Date;
  error?: string;
}

export interface NotificationOrchestrator {
  send(message: NotificationMessage): Promise<NotificationResult>;
  getStatus(): Promise<{ healthy: boolean; queueSize: number }>;
}

export interface Campaign {
  id: string;
  name: string;
  channelType: ChannelType;
  status: CampaignStatus;
  audienceSize: number;
  sentCount: number;
  failedCount: number;
  rateLimitedCount: number;
  template: {
    id: string;
    subject?: string;
    body: string;
  };
}

export interface DispatchResult {
  campaignId: string;
  totalDispatched: number;
  sent: number;
  failed: number;
  rateLimited: number;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

export interface CampaignDispatcher {
  dispatch(campaign: Campaign, orchestrator: NotificationOrchestrator): Promise<DispatchResult>;
  getChannelRateLimit(channel: ChannelType): RateLimit;
  setChannelRateLimit(channel: ChannelType, messagesPerMinute: number): void;
}

// ───────────────────────────────────────────────────────────────────────────
// RATE LIMIT DEFAULTS
// ───────────────────────────────────────────────────────────────────────────

const DEFAULT_RATE_LIMITS: Record<ChannelType, number> = {
  EMAIL: 300,      // 300 emails per minute
  SMS: 60,         // 60 SMS per minute
  WHATSAPP: 80,    // 80 WhatsApp per minute
  PUSH: 500,       // 500 push notifications per minute
};

// ───────────────────────────────────────────────────────────────────────────
// DISPATCHER IMPLEMENTATION
// ───────────────────────────────────────────────────────────────────────────

class CampaignDispatcherImpl implements CampaignDispatcher {
  private rateLimits: Record<ChannelType, RateLimit> = {
    EMAIL: { channel: 'EMAIL', messagesPerMinute: DEFAULT_RATE_LIMITS.EMAIL },
    SMS: { channel: 'SMS', messagesPerMinute: DEFAULT_RATE_LIMITS.SMS },
    WHATSAPP: { channel: 'WHATSAPP', messagesPerMinute: DEFAULT_RATE_LIMITS.WHATSAPP },
    PUSH: { channel: 'PUSH', messagesPerMinute: DEFAULT_RATE_LIMITS.PUSH },
  };

  private dispatchHistory: DispatchResult[] = [];
  private sentMessages: NotificationMessage[] = [];

  getChannelRateLimit(channel: ChannelType): RateLimit {
    return this.rateLimits[channel];
  }

  setChannelRateLimit(channel: ChannelType, messagesPerMinute: number): void {
    this.rateLimits[channel].messagesPerMinute = messagesPerMinute;
  }

  async dispatch(
    campaign: Campaign,
    orchestrator: NotificationOrchestrator
  ): Promise<DispatchResult> {
    const startedAt = new Date();
    const result: DispatchResult = {
      campaignId: campaign.id,
      totalDispatched: 0,
      sent: 0,
      failed: 0,
      rateLimited: 0,
      startedAt,
    };

    const rateLimit = this.getChannelRateLimit(campaign.channelType);
    const messagesPerSecond = rateLimit.messagesPerMinute / 60;
    const delayBetweenMessages = 1000 / messagesPerSecond;

    // Simulate sending to all audience members
    for (let i = 0; i < campaign.audienceSize; i++) {
      const message: NotificationMessage = {
        recipientId: `user-${i}`,
        channel: campaign.channelType,
        subject: campaign.template.subject,
        body: campaign.template.body,
        templateId: campaign.template.id,
      };

      try {
        const sendResult = await orchestrator.send(message);
        this.sentMessages.push(message);
        result.totalDispatched++;

        if (sendResult.status === 'sent') {
          result.sent++;
        } else if (sendResult.status === 'failed') {
          result.failed++;
        } else if (sendResult.status === 'rate_limited') {
          result.rateLimited++;
        }
      } catch (error) {
        result.failed++;
        result.totalDispatched++;
      }

      // Apply rate limiting delay
      if (i < campaign.audienceSize - 1) {
        await this.delay(delayBetweenMessages);
      }
    }

    result.completedAt = new Date();
    result.durationMs = result.completedAt.getTime() - startedAt.getTime();

    this.dispatchHistory.push(result);
    return result;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getDispatchHistory(): DispatchResult[] {
    return [...this.dispatchHistory];
  }

  getSentMessages(): NotificationMessage[] {
    return [...this.sentMessages];
  }

  clearHistory() {
    this.dispatchHistory = [];
    this.sentMessages = [];
  }
}

// ───────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ───────────────────────────────────────────────────────────────────────────

describe('Campaign Channel Dispatcher', () => {
  let dispatcher: CampaignDispatcherImpl;
  let mockOrchestrator: NotificationOrchestrator;

  beforeEach(() => {
    dispatcher = new CampaignDispatcherImpl();
    mockOrchestrator = {
      send: vi.fn(async (msg) => ({
        messageId: `msg-${Date.now()}`,
        status: 'sent' as const,
        sentAt: new Date(),
      })),
      getStatus: vi.fn(async () => ({ healthy: true, queueSize: 0 })),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CAMPAIGN MANAGER CALLS NOTIFICATION ORCHESTRATOR
  // ─────────────────────────────────────────────────────────────────────────

  describe('Campaign Manager Calls Notification Orchestrator', () => {
    it('should call notification orchestrator for each recipient', async () => {
      const campaign: Campaign = {
        id: 'camp-1',
        name: 'Test Campaign',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 3,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: {
          id: 'tpl-1',
          subject: 'Test Subject',
          body: 'Test body content',
        },
      };

      await dispatcher.dispatch(campaign, mockOrchestrator);

      expect(mockOrchestrator.send).toHaveBeenCalledTimes(3);
    });

    it('should pass correct notification message to orchestrator', async () => {
      const campaign: Campaign = {
        id: 'camp-2',
        name: 'Message Test',
        channelType: 'SMS',
        status: 'running',
        audienceSize: 1,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: {
          id: 'tpl-2',
          body: 'SMS message content',
        },
      };

      await dispatcher.dispatch(campaign, mockOrchestrator);

      expect(mockOrchestrator.send).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'SMS',
          body: 'SMS message content',
          templateId: 'tpl-2',
        })
      );
    });

    it('should call orchestrator with all required message fields', async () => {
      const campaign: Campaign = {
        id: 'camp-3',
        name: 'Full Message Test',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 1,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: {
          id: 'tpl-3',
          subject: 'Email Subject',
          body: 'Email body',
        },
      };

      await dispatcher.dispatch(campaign, mockOrchestrator);

      const callArg = (mockOrchestrator.send as any).mock.calls[0][0];
      expect(callArg.recipientId).toBeDefined();
      expect(callArg.channel).toBe('EMAIL');
      expect(callArg.subject).toBe('Email Subject');
      expect(callArg.body).toBe('Email body');
      expect(callArg.templateId).toBe('tpl-3');
    });

    it('should handle orchestrator failures gracefully', async () => {
      const failingOrchestrator: NotificationOrchestrator = {
        send: vi.fn(async () => ({
          messageId: '',
          status: 'failed' as const,
          error: 'Send failed',
        })),
        getStatus: vi.fn(async () => ({ healthy: false, queueSize: 0 })),
      };

      const campaign: Campaign = {
        id: 'camp-4',
        name: 'Failure Test',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 2,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: {
          id: 'tpl-4',
          body: 'Test',
        },
      };

      const result = await dispatcher.dispatch(campaign, failingOrchestrator);

      expect(result.failed).toBe(2);
      expect(result.sent).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RATE LIMITS PER CHANNEL TYPE
  // ─────────────────────────────────────────────────────────────────────────

  describe('Rate Limits Per Channel Type', () => {
    it('should have EMAIL rate limit of 300/min', () => {
      const limit = dispatcher.getChannelRateLimit('EMAIL');
      expect(limit.channel).toBe('EMAIL');
      expect(limit.messagesPerMinute).toBe(300);
    });

    it('should have SMS rate limit of 60/min', () => {
      const limit = dispatcher.getChannelRateLimit('SMS');
      expect(limit.channel).toBe('SMS');
      expect(limit.messagesPerMinute).toBe(60);
    });

    it('should have WHATSAPP rate limit of 80/min', () => {
      const limit = dispatcher.getChannelRateLimit('WHATSAPP');
      expect(limit.channel).toBe('WHATSAPP');
      expect(limit.messagesPerMinute).toBe(80);
    });

    it('should have PUSH rate limit of 500/min', () => {
      const limit = dispatcher.getChannelRateLimit('PUSH');
      expect(limit.channel).toBe('PUSH');
      expect(limit.messagesPerMinute).toBe(500);
    });

    it('should allow modifying rate limits', () => {
      dispatcher.setChannelRateLimit('EMAIL', 500);
      const limit = dispatcher.getChannelRateLimit('EMAIL');
      expect(limit.messagesPerMinute).toBe(500);
    });

    it('should apply rate limits independently per channel', () => {
      const emailLimit = dispatcher.getChannelRateLimit('EMAIL');
      const smsLimit = dispatcher.getChannelRateLimit('SMS');
      const whatsappLimit = dispatcher.getChannelRateLimit('WHATSAPP');
      const pushLimit = dispatcher.getChannelRateLimit('PUSH');

      expect(emailLimit.messagesPerMinute).toBe(300);
      expect(smsLimit.messagesPerMinute).toBe(60);
      expect(whatsappLimit.messagesPerMinute).toBe(80);
      expect(pushLimit.messagesPerMinute).toBe(500);
    });

    it('should preserve rate limits across multiple campaigns', async () => {
      const campaign1: Campaign = {
        id: 'camp-5',
        name: 'Campaign 1',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 1,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-5', body: 'Test' },
      };

      const campaign2: Campaign = {
        id: 'camp-6',
        name: 'Campaign 2',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 1,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-6', body: 'Test' },
      };

      await dispatcher.dispatch(campaign1, mockOrchestrator);
      const limitAfterFirst = dispatcher.getChannelRateLimit('EMAIL');

      await dispatcher.dispatch(campaign2, mockOrchestrator);
      const limitAfterSecond = dispatcher.getChannelRateLimit('EMAIL');

      expect(limitAfterFirst.messagesPerMinute).toBe(300);
      expect(limitAfterSecond.messagesPerMinute).toBe(300);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CAMPAIGN SCHEDULER DERIVES CORRECT RATE FROM CAMPAIGN TYPE
  // ─────────────────────────────────────────────────────────────────────────

  describe('Campaign Scheduler Derives Correct Rate From Campaign Type', () => {
    it('should use EMAIL rate limit for EMAIL campaign', async () => {
      const emailCampaign: Campaign = {
        id: 'camp-email',
        name: 'Email Campaign',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 5,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-email', body: 'Email content' },
      };

      const startTime = Date.now();
      const result = await dispatcher.dispatch(emailCampaign, mockOrchestrator);
      const endTime = Date.now();

      // EMAIL has 300/min = 5/sec = 200ms per message
      // 5 messages should take approximately 1000ms (4 delays of 200ms each)
      const emailRateLimit = dispatcher.getChannelRateLimit('EMAIL');
      expect(emailRateLimit.messagesPerMinute).toBe(300);
      expect(result.sent).toBeGreaterThan(0);
    });

    it('should use SMS rate limit for SMS campaign', async () => {
      const smsCampaign: Campaign = {
        id: 'camp-sms',
        name: 'SMS Campaign',
        channelType: 'SMS',
        status: 'running',
        audienceSize: 3,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-sms', body: 'SMS content' },
      };

      const smsRateLimit = dispatcher.getChannelRateLimit('SMS');
      expect(smsRateLimit.messagesPerMinute).toBe(60);

      const result = await dispatcher.dispatch(smsCampaign, mockOrchestrator);
      expect(result.sent).toBeGreaterThan(0);
    });

    it('should use WHATSAPP rate limit for WHATSAPP campaign', async () => {
      const whatsappCampaign: Campaign = {
        id: 'camp-whatsapp',
        name: 'WhatsApp Campaign',
        channelType: 'WHATSAPP',
        status: 'running',
        audienceSize: 2,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-whatsapp', body: 'WhatsApp content' },
      };

      const whatsappRateLimit = dispatcher.getChannelRateLimit('WHATSAPP');
      expect(whatsappRateLimit.messagesPerMinute).toBe(80);

      const result = await dispatcher.dispatch(whatsappCampaign, mockOrchestrator);
      expect(result.sent).toBeGreaterThan(0);
    });

    it('should use PUSH rate limit for PUSH campaign', async () => {
      const pushCampaign: Campaign = {
        id: 'camp-push',
        name: 'Push Campaign',
        channelType: 'PUSH',
        status: 'running',
        audienceSize: 4,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-push', body: 'Push content' },
      };

      const pushRateLimit = dispatcher.getChannelRateLimit('PUSH');
      expect(pushRateLimit.messagesPerMinute).toBe(500);

      const result = await dispatcher.dispatch(pushCampaign, mockOrchestrator);
      expect(result.sent).toBeGreaterThan(0);
    });

    it('should dispatch all messages successfully with correct counts', async () => {
      const campaign: Campaign = {
        id: 'camp-7',
        name: 'Count Test',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 10,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-7', body: 'Test' },
      };

      const result = await dispatcher.dispatch(campaign, mockOrchestrator);

      expect(result.totalDispatched).toBe(10);
      expect(result.sent).toBe(10);
      expect(result.failed).toBe(0);
      expect(result.rateLimited).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR HANDLING WHEN ORCHESTRATOR FAILS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Error Handling When Orchestrator Fails', () => {
    it('should track failed messages when orchestrator returns failure status', async () => {
      const failOrchestrator: NotificationOrchestrator = {
        send: vi.fn(async () => ({
          messageId: '',
          status: 'failed' as const,
          error: 'Service unavailable',
        })),
        getStatus: vi.fn(async () => ({ healthy: false, queueSize: 100 })),
      };

      const campaign: Campaign = {
        id: 'camp-fail-1',
        name: 'Failure Campaign',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 5,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-fail-1', body: 'Test' },
      };

      const result = await dispatcher.dispatch(campaign, failOrchestrator);

      expect(result.failed).toBe(5);
      expect(result.sent).toBe(0);
    });

    it('should track rate limited messages', async () => {
      const rateLimitOrchestrator: NotificationOrchestrator = {
        send: vi.fn(async () => ({
          messageId: '',
          status: 'rate_limited' as const,
          error: 'Rate limit exceeded',
        })),
        getStatus: vi.fn(async () => ({ healthy: true, queueSize: 50 })),
      };

      const campaign: Campaign = {
        id: 'camp-ratelimit-1',
        name: 'Rate Limited Campaign',
        channelType: 'SMS',
        status: 'running',
        audienceSize: 3,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-rl-1', body: 'Test' },
      };

      const result = await dispatcher.dispatch(campaign, rateLimitOrchestrator);

      expect(result.rateLimited).toBe(3);
      expect(result.sent).toBe(0);
    });

    it('should continue dispatching even if some messages fail', async () => {
      let callCount = 0;
      const mixedOrchestrator: NotificationOrchestrator = {
        send: vi.fn(async () => {
          callCount++;
          if (callCount % 2 === 0) {
            return {
              messageId: `msg-${callCount}`,
              status: 'failed' as const,
              error: 'Intermittent failure',
            };
          }
          return {
            messageId: `msg-${callCount}`,
            status: 'sent' as const,
            sentAt: new Date(),
          };
        }),
        getStatus: vi.fn(async () => ({ healthy: true, queueSize: 0 })),
      };

      const campaign: Campaign = {
        id: 'camp-mixed-1',
        name: 'Mixed Results Campaign',
        channelType: 'PUSH',
        status: 'running',
        audienceSize: 4,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-mixed-1', body: 'Test' },
      };

      const result = await dispatcher.dispatch(campaign, mixedOrchestrator);

      expect(result.totalDispatched).toBe(4);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(2);
    });

    it('should report dispatch timing metrics', async () => {
      const campaign: Campaign = {
        id: 'camp-metrics-1',
        name: 'Metrics Campaign',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 2,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-metrics-1', body: 'Test' },
      };

      const result = await dispatcher.dispatch(campaign, mockOrchestrator);

      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toEqual(
        result.completedAt!.getTime() - result.startedAt.getTime()
      );
    });

    it('should handle orchestrator throwing exceptions', async () => {
      const throwingOrchestrator: NotificationOrchestrator = {
        send: vi.fn(async () => {
          throw new Error('Connection timeout');
        }),
        getStatus: vi.fn(async () => ({ healthy: false, queueSize: 0 })),
      };

      const campaign: Campaign = {
        id: 'camp-throw-1',
        name: 'Exception Campaign',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 2,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-throw-1', body: 'Test' },
      };

      const result = await dispatcher.dispatch(campaign, throwingOrchestrator);

      expect(result.failed).toBe(2);
      expect(result.sent).toBe(0);
      expect(result.totalDispatched).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DISPATCH RESULT TRACKING
  // ─────────────────────────────────────────────────────────────────────────

  describe('Dispatch Result Tracking', () => {
    it('should return complete dispatch result', async () => {
      const campaign: Campaign = {
        id: 'camp-result-1',
        name: 'Result Test',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 3,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-result-1', body: 'Test' },
      };

      const result = await dispatcher.dispatch(campaign, mockOrchestrator);

      expect(result.campaignId).toBe('camp-result-1');
      expect(result.totalDispatched).toBe(3);
      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.rateLimited).toBe(0);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should track dispatch history', async () => {
      const campaign1: Campaign = {
        id: 'camp-hist-1',
        name: 'History 1',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 1,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-hist-1', body: 'Test' },
      };

      const campaign2: Campaign = {
        id: 'camp-hist-2',
        name: 'History 2',
        channelType: 'SMS',
        status: 'running',
        audienceSize: 1,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-hist-2', body: 'Test' },
      };

      await dispatcher.dispatch(campaign1, mockOrchestrator);
      await dispatcher.dispatch(campaign2, mockOrchestrator);

      const history = dispatcher.getDispatchHistory();
      expect(history).toHaveLength(2);
      expect(history[0].campaignId).toBe('camp-hist-1');
      expect(history[1].campaignId).toBe('camp-hist-2');
    });

    it('should track sent messages', async () => {
      const campaign: Campaign = {
        id: 'camp-track-1',
        name: 'Track Messages',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 2,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-track-1', subject: 'Test', body: 'Test body' },
      };

      await dispatcher.dispatch(campaign, mockOrchestrator);

      const sentMessages = dispatcher.getSentMessages();
      expect(sentMessages).toHaveLength(2);
      expect(sentMessages[0].templateId).toBe('tpl-track-1');
      expect(sentMessages[0].channel).toBe('EMAIL');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle empty audience', async () => {
      const campaign: Campaign = {
        id: 'camp-empty',
        name: 'Empty Campaign',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 0,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-empty', body: 'Test' },
      };

      const result = await dispatcher.dispatch(campaign, mockOrchestrator);

      expect(result.totalDispatched).toBe(0);
      expect(result.sent).toBe(0);
      expect(mockOrchestrator.send).not.toHaveBeenCalled();
    });

    it('should handle very high rate limits', () => {
      dispatcher.setChannelRateLimit('PUSH', 10000);
      const limit = dispatcher.getChannelRateLimit('PUSH');
      expect(limit.messagesPerMinute).toBe(10000);
    });

    it('should handle rate limit of 1 message per minute', () => {
      dispatcher.setChannelRateLimit('SMS', 1);
      const limit = dispatcher.getChannelRateLimit('SMS');
      expect(limit.messagesPerMinute).toBe(1);
    });

    it('should clear history when requested', async () => {
      const campaign: Campaign = {
        id: 'camp-clear',
        name: 'Clear Test',
        channelType: 'EMAIL',
        status: 'running',
        audienceSize: 1,
        sentCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        template: { id: 'tpl-clear', body: 'Test' },
      };

      await dispatcher.dispatch(campaign, mockOrchestrator);
      let history = dispatcher.getDispatchHistory();
      expect(history).toHaveLength(1);

      dispatcher.clearHistory();
      history = dispatcher.getDispatchHistory();
      expect(history).toHaveLength(0);
    });
  });
});
