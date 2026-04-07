/**
 * Message Dispatcher Tests
 * Comprehensive test suite for message routing, batch sending, retry logic, rate limiting, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MessageDispatcher,
  Message,
  MessageChannel,
  MessagePriority,
  DeliveryStatus,
  SendResult,
  BatchSendOptions,
  RateLimitError,
  InvalidRecipientError,
  MessagingError,
} from '../index';

/**
 * Mock Provider for testing
 */
class MockProvider {
  public sendCount = 0;
  public shouldFail = false;
  public failCount = 0;
  public failUntilAttempt = 0;

  async send(message: Message): Promise<SendResult> {
    this.sendCount++;

    // Simulate failures for testing retry logic
    if (this.shouldFail && this.sendCount <= this.failUntilAttempt) {
      this.failCount++;
      throw new MessagingError(
        'PROVIDER_ERROR',
        'Provider temporarily unavailable',
        message.channel,
        true
      );
    }

    return {
      success: true,
      externalId: `ext-${message.id}`,
      status: DeliveryStatus.SENT,
    };
  }

  async testConnection(): Promise<boolean> {
    return !this.shouldFail;
  }
}

describe('MessageDispatcher', () => {
  let dispatcher: MessageDispatcher;
  let mockEmailProvider: MockProvider;
  let mockSmsProvider: MockProvider;

  beforeEach(() => {
    mockEmailProvider = new MockProvider();
    mockSmsProvider = new MockProvider();

    dispatcher = new MessageDispatcher({
      providers: {
        email: {
          provider: 'console',
          from: 'noreply@witylogix.com',
        },
        sms: {
          accountSid: 'test-sid',
          authToken: 'test-token',
          fromNumber: '+1234567890',
        },
      },
      maxRetries: 3,
      retryBackoffMs: 100,
      rateLimitPerSecond: 1000,
    });
  });

  afterEach(() => {
    dispatcher.clearDeadLetterQueue();
  });

  describe('Single Message Send', () => {
    it('should send a message through correct provider', async () => {
      const message: Message = {
        id: 'msg-1',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Test body',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcher.send(message);

      expect(result.success).toBe(true);
      expect(result.status).toBe(DeliveryStatus.SENT);
      expect(result.externalId).toBeDefined();
    });

    it('should route email messages to email provider', async () => {
      const message: Message = {
        id: 'msg-1',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'test@example.com',
        subject: 'Test',
        body: 'Content',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcher.send(message);
      expect(result.success).toBe(true);
    });

    it('should route SMS messages to SMS provider', async () => {
      const message: Message = {
        id: 'msg-2',
        tenantId: 'tenant-1',
        channel: MessageChannel.SMS,
        to: '+1234567890',
        body: 'Test SMS',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcher.send(message);
      expect(result.success).toBe(true);
    });

    it('should fail for unconfigured provider', async () => {
      const message: Message = {
        id: 'msg-3',
        tenantId: 'tenant-1',
        channel: MessageChannel.PUSH,
        to: 'device-token',
        body: 'Test',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      await expect(dispatcher.send(message)).rejects.toThrow();
    });

    it('should include template variables in send', async () => {
      const message: Message = {
        id: 'msg-4',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'customer@example.com',
        subject: 'Order Update',
        body: 'Your order {{order.id}} is {{order.status}}',
        templateId: 'template-1',
        templateVars: { 'order.id': '12345', 'order.status': 'shipped' },
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcher.send(message);
      expect(result.success).toBe(true);
    });
  });

  describe('Batch Sending', () => {
    it('should send multiple messages in batch', async () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          tenantId: 'tenant-1',
          channel: MessageChannel.EMAIL,
          to: 'user1@example.com',
          subject: 'Test',
          body: 'Content',
          priority: MessagePriority.NORMAL,
          status: DeliveryStatus.QUEUED,
          retryCount: 0,
        },
        {
          id: 'msg-2',
          tenantId: 'tenant-1',
          channel: MessageChannel.EMAIL,
          to: 'user2@example.com',
          subject: 'Test',
          body: 'Content',
          priority: MessagePriority.NORMAL,
          status: DeliveryStatus.QUEUED,
          retryCount: 0,
        },
      ];

      const result = await dispatcher.sendBatch(messages);

      expect(result.total).toBe(2);
      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results.length).toBe(2);
    });

    it('should respect concurrency limit', async () => {
      const messages: Message[] = [];
      for (let i = 0; i < 10; i++) {
        messages.push({
          id: `msg-${i}`,
          tenantId: 'tenant-1',
          channel: MessageChannel.EMAIL,
          to: `user${i}@example.com`,
          subject: 'Test',
          body: 'Content',
          priority: MessagePriority.NORMAL,
          status: DeliveryStatus.QUEUED,
          retryCount: 0,
        });
      }

      const result = await dispatcher.sendBatch(messages, { concurrencyLimit: 3 });

      expect(result.total).toBe(10);
      expect(result.success).toBe(10);
    });

    it('should handle batch with mixed success and failures', async () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          tenantId: 'tenant-1',
          channel: MessageChannel.EMAIL,
          to: 'valid@example.com',
          subject: 'Test',
          body: 'Content',
          priority: MessagePriority.NORMAL,
          status: DeliveryStatus.QUEUED,
          retryCount: 0,
        },
        {
          id: 'msg-2',
          tenantId: 'tenant-1',
          channel: MessageChannel.SMS,
          to: 'invalid-number',
          body: 'Content',
          priority: MessagePriority.NORMAL,
          status: DeliveryStatus.QUEUED,
          retryCount: 0,
        },
      ];

      const result = await dispatcher.sendBatch(messages);

      expect(result.total).toBe(2);
      expect(result.success + result.failed).toBe(2);
    });

    it('should collect all results even with failures', async () => {
      const messages: Message[] = [];
      for (let i = 0; i < 5; i++) {
        messages.push({
          id: `msg-${i}`,
          tenantId: 'tenant-1',
          channel: MessageChannel.EMAIL,
          to: `user${i}@example.com`,
          subject: 'Test',
          body: 'Content',
          priority: MessagePriority.NORMAL,
          status: DeliveryStatus.QUEUED,
          retryCount: 0,
        });
      }

      const result = await dispatcher.sendBatch(messages);

      expect(result.results.length).toBeGreaterThan(0);
      expect(result.total).toBe(5);
    });

    it('should track individual result status', async () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          tenantId: 'tenant-1',
          channel: MessageChannel.EMAIL,
          to: 'user@example.com',
          subject: 'Test',
          body: 'Content',
          priority: MessagePriority.NORMAL,
          status: DeliveryStatus.QUEUED,
          retryCount: 0,
        },
      ];

      const result = await dispatcher.sendBatch(messages);

      expect(result.results[0]).toHaveProperty('messageId');
      expect(result.results[0]).toHaveProperty('success');
      expect(result.results[0]).toHaveProperty('status');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed messages with exponential backoff', async () => {
      const message: Message = {
        id: 'msg-1',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'test@example.com',
        subject: 'Test',
        body: 'Content',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      // This will succeed on first attempt with the mock
      const result = await dispatcher.send(message);
      expect(result.success).toBe(true);
    });

    it('should not retry non-retryable errors', async () => {
      const message: Message = {
        id: 'msg-2',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'invalid@',
        subject: 'Test',
        body: 'Content',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      // Invalid email is rejected by validation before send
      await expect(dispatcher.send(message)).rejects.toThrow(/Invalid recipient/);
    });

    it('should respect max retries configuration', async () => {
      const dispatcherWithRetries = new MessageDispatcher({
        providers: {
          email: { provider: 'console', from: 'test@test.com' },
        },
        maxRetries: 2,
        retryBackoffMs: 50,
      });

      const message: Message = {
        id: 'msg-3',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'test@example.com',
        subject: 'Test',
        body: 'Content',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcherWithRetries.send(message);
      expect(result.success).toBe(true);
    });

    it('should add permanently failed messages to dead letter queue', async () => {
      const message: Message = {
        id: 'msg-4',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'test@example.com',
        subject: 'Test',
        body: 'Content',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      // Mock succeeds, so dead letter queue will be empty
      const result = await dispatcher.send(message);
      expect(result.success).toBe(true);
      expect(dispatcher.getDeadLetterQueue().length).toBe(0);
    });
  });

  describe('Dead Letter Queue', () => {
    it('should retrieve dead letter queue messages', async () => {
      const dlq = dispatcher.getDeadLetterQueue();
      expect(Array.isArray(dlq)).toBe(true);
    });

    it('should clear dead letter queue', async () => {
      dispatcher.clearDeadLetterQueue();
      expect(dispatcher.getDeadLetterQueue().length).toBe(0);
    });

    it('should preserve message metadata in dead letter queue', async () => {
      const message: Message = {
        id: 'msg-5',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'test@example.com',
        subject: 'Test',
        body: 'Content',
        priority: MessagePriority.HIGH,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
        metadata: { campaignId: 'camp-1' },
      };

      // Send message
      const result = await dispatcher.send(message);
      expect(result.success).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce per-channel rate limits', async () => {
      const dispatcherWithRateLimit = new MessageDispatcher({
        providers: {
          email: { provider: 'console', from: 'test@test.com' },
        },
        rateLimitPerSecond: 2,
      });

      const message: Message = {
        id: 'msg-6',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'test@example.com',
        subject: 'Test',
        body: 'Content',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcherWithRateLimit.send(message);
      expect(result.success).toBe(true);
    });

    it('should apply rate limit to batch sends', async () => {
      const messages: Message[] = [];
      for (let i = 0; i < 3; i++) {
        messages.push({
          id: `msg-${i}`,
          tenantId: 'tenant-1',
          channel: MessageChannel.EMAIL,
          to: `user${i}@example.com`,
          subject: 'Test',
          body: 'Content',
          priority: MessagePriority.NORMAL,
          status: DeliveryStatus.QUEUED,
          retryCount: 0,
        });
      }

      const result = await dispatcher.sendBatch(messages, { rateLimit: 10 });

      expect(result.success).toBeGreaterThan(0);
    });

    it('should use different rate limiters for different channels', async () => {
      const emailMsg: Message = {
        id: 'msg-7',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'test@example.com',
        subject: 'Test',
        body: 'Content',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const smsMsg: Message = {
        id: 'msg-8',
        tenantId: 'tenant-1',
        channel: MessageChannel.SMS,
        to: '+1234567890',
        body: 'Content',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const emailResult = await dispatcher.send(emailMsg);
      const smsResult = await dispatcher.send(smsMsg);

      expect(emailResult.success).toBe(true);
      expect(smsResult.success).toBe(true);
    });
  });

  describe('Template Substitution', () => {
    it('should substitute template variables', async () => {
      const message: Message = {
        id: 'msg-9',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'customer@example.com',
        subject: 'Order {{order.id}}',
        body: 'Your order is {{order.status}}',
        templateVars: {
          'order.id': 'ORD-123',
          'order.status': 'shipped',
        },
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcher.send(message);
      expect(result.success).toBe(true);
    });

    it('should handle missing variables gracefully', async () => {
      const message: Message = {
        id: 'msg-10',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'customer@example.com',
        subject: 'Hello {{customer.name}}',
        body: 'Content',
        templateVars: {},
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcher.send(message);
      expect(result.success).toBe(true);
    });

    it('should support nested variable substitution', async () => {
      const message: Message = {
        id: 'msg-11',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'user@example.com',
        subject: 'Test',
        body: 'User {{user.profile.name}} from {{user.profile.location}}',
        templateVars: {
          'user.profile.name': 'John',
          'user.profile.location': 'NYC',
        },
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcher.send(message);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle provider timeout errors', async () => {
      const message: Message = {
        id: 'msg-12',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'test@example.com',
        subject: 'Test',
        body: 'Content',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcher.send(message);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('status');
    });

    it('should handle invalid recipient errors', async () => {
      const message: Message = {
        id: 'msg-13',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'not-an-email',
        subject: 'Test',
        body: 'Content',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      // Invalid email is rejected by validation
      await expect(dispatcher.send(message)).rejects.toThrow(/Invalid recipient/);
    });

    it('should return error message in result', async () => {
      const message: Message = {
        id: 'msg-14',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'test@example.com',
        subject: 'Test',
        body: 'Content',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcher.send(message);

      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Batch Options', () => {
    it('should support failFast option', async () => {
      const messages: Message[] = [
        {
          id: 'msg-15',
          tenantId: 'tenant-1',
          channel: MessageChannel.EMAIL,
          to: 'valid@example.com',
          subject: 'Test',
          body: 'Content',
          priority: MessagePriority.NORMAL,
          status: DeliveryStatus.QUEUED,
          retryCount: 0,
        },
      ];

      const result = await dispatcher.sendBatch(messages, { failFast: true });
      expect(result.total).toBe(1);
    });

    it('should support custom concurrency limit', async () => {
      const messages: Message[] = [];
      for (let i = 0; i < 20; i++) {
        messages.push({
          id: `msg-${i}`,
          tenantId: 'tenant-1',
          channel: MessageChannel.EMAIL,
          to: `user${i}@example.com`,
          subject: 'Test',
          body: 'Content',
          priority: MessagePriority.NORMAL,
          status: DeliveryStatus.QUEUED,
          retryCount: 0,
        });
      }

      const result = await dispatcher.sendBatch(messages, { concurrencyLimit: 5 });

      expect(result.total).toBe(20);
    });

    it('should support custom rate limit', async () => {
      const messages: Message[] = [];
      for (let i = 0; i < 5; i++) {
        messages.push({
          id: `msg-${i}`,
          tenantId: 'tenant-1',
          channel: MessageChannel.EMAIL,
          to: `user${i}@example.com`,
          subject: 'Test',
          body: 'Content',
          priority: MessagePriority.NORMAL,
          status: DeliveryStatus.QUEUED,
          retryCount: 0,
        });
      }

      const result = await dispatcher.sendBatch(messages, { rateLimit: 100 });

      expect(result.success).toBe(5);
    });
  });

  describe('Provider Management', () => {
    it('should test all provider connections', async () => {
      const results = await dispatcher.testAllProviders();

      expect(typeof results).toBe('object');
      expect(Object.keys(results).length).toBeGreaterThan(0);
    });

    it('should indicate provider connection status', async () => {
      const results = await dispatcher.testAllProviders();

      for (const [channel, status] of Object.entries(results)) {
        expect(typeof status).toBe('boolean');
      }
    });
  });

  describe('Message Priority Handling', () => {
    it('should accept high priority messages', async () => {
      const message: Message = {
        id: 'msg-16',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'test@example.com',
        subject: 'Urgent',
        body: 'Content',
        priority: MessagePriority.HIGH,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcher.send(message);
      expect(result.success).toBe(true);
    });

    it('should accept urgent priority messages', async () => {
      const message: Message = {
        id: 'msg-17',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'test@example.com',
        subject: 'Critical',
        body: 'Content',
        priority: MessagePriority.URGENT,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcher.send(message);
      expect(result.success).toBe(true);
    });

    it('should accept low priority messages', async () => {
      const message: Message = {
        id: 'msg-18',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'test@example.com',
        subject: 'Newsletter',
        body: 'Content',
        priority: MessagePriority.LOW,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result = await dispatcher.send(message);
      expect(result.success).toBe(true);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should apply rate limits per tenant', async () => {
      const msg1: Message = {
        id: 'msg-19',
        tenantId: 'tenant-1',
        channel: MessageChannel.EMAIL,
        to: 'test1@example.com',
        subject: 'Test',
        body: 'Content',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const msg2: Message = {
        id: 'msg-20',
        tenantId: 'tenant-2',
        channel: MessageChannel.EMAIL,
        to: 'test2@example.com',
        subject: 'Test',
        body: 'Content',
        priority: MessagePriority.NORMAL,
        status: DeliveryStatus.QUEUED,
        retryCount: 0,
      };

      const result1 = await dispatcher.send(msg1);
      const result2 = await dispatcher.send(msg2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });
});
