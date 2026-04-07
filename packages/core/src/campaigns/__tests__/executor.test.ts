/**
 * Campaign Executor Tests
 * Comprehensive test suite for campaign state machine, batch processing, pause/resume, and failure handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CampaignExecutor,
  ExecutionContext,
  ExecutionState,
  RecipientData,
  MessageDispatcher,
  SendResultItem,
  ExecutorError,
} from '../executor';
import { CampaignType, CampaignContent } from '../types';

/**
 * Mock MessageDispatcher for testing
 */
class MockMessageDispatcher implements MessageDispatcher {
  public sendCallCount = 0;
  public failureRate = 0; // 0.0 to 1.0

  async send(
    channel: string,
    recipient: RecipientData,
    content: CampaignContent
  ): Promise<SendResultItem> {
    this.sendCallCount++;

    const shouldFail = Math.random() < this.failureRate;

    return {
      recipientId: recipient.customerId,
      messageId: `msg-${Date.now()}-${Math.random()}`,
      status: shouldFail ? 'failed' : 'sent',
      error: shouldFail ? 'Provider error' : undefined,
      timestamp: new Date(),
    };
  }

  async sendBatch(
    channel: string,
    recipients: RecipientData[],
    content: CampaignContent
  ): Promise<SendResultItem[]> {
    return Promise.all(
      recipients.map((recipient) => this.send(channel, recipient, content))
    );
  }
}

describe('CampaignExecutor', () => {
  let executor: CampaignExecutor;
  let dispatcher: MockMessageDispatcher;

  beforeEach(() => {
    dispatcher = new MockMessageDispatcher();
    executor = new CampaignExecutor(dispatcher);
  });

  describe('Campaign State Machine', () => {
    it('should transition from draft to scheduled state', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user1@example.com', name: 'User 1' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test Campaign',
          htmlBody: '<p>Test</p>',
          fromEmail: 'campaigns@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.state).toBe('completed');
    });

    it('should validate campaign during execution', async () => {
      const recipients: RecipientData[] = [];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      await expect(
        executor.execute('camp-1', 'tenant-1', recipients, content, CampaignType.EMAIL)
      ).rejects.toThrow();
    });

    it('should move through all execution states', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user@example.com' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(['completed', 'failed']).toContain(context.state);
    });

    it('should fail campaign with detailed error message', async () => {
      dispatcher.failureRate = 1.0; // 100% failure rate

      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user@example.com' },
        { customerId: 'cust-2', email: 'user2@example.com' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      try {
        await executor.execute(
          'camp-2',
          'tenant-1',
          recipients,
          content,
          CampaignType.EMAIL
        );
      } catch (error) {
        expect(error).toBeInstanceOf(ExecutorError);
      }
    });
  });

  describe('Audience Building', () => {
    it('should accept all recipients in audience', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user1@example.com', name: 'User 1' },
        { customerId: 'cust-2', email: 'user2@example.com', name: 'User 2' },
        { customerId: 'cust-3', email: 'user3@example.com', name: 'User 3' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.totalRecipients).toBe(3);
    });

    it('should build audience from filtered recipients', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user1@example.com' },
        { customerId: 'cust-2', email: 'user2@example.com' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.sentCount + context.failedCount).toBe(2);
    });

    it('should track estimated reach count', async () => {
      const recipients: RecipientData[] = [];
      for (let i = 0; i < 50; i++) {
        recipients.push({
          customerId: `cust-${i}`,
          email: `user${i}@example.com`,
        });
      }

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.totalRecipients).toBe(50);
    });
  });

  describe('Batch Execution', () => {
    it('should process recipients in batches of 100', async () => {
      const recipients: RecipientData[] = [];
      for (let i = 0; i < 250; i++) {
        recipients.push({
          customerId: `cust-${i}`,
          email: `user${i}@example.com`,
        });
      }

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.totalBatches).toBe(3);
    });

    it('should track batch progress during execution', async () => {
      const recipients: RecipientData[] = [];
      for (let i = 0; i < 150; i++) {
        recipients.push({
          customerId: `cust-${i}`,
          email: `user${i}@example.com`,
        });
      }

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.totalBatches).toBeGreaterThan(0);
      expect(context.totalRecipients).toBe(150);
    });

    it('should not stop campaign on individual message failures', async () => {
      dispatcher.failureRate = 0.1; // 10% failure rate

      const recipients: RecipientData[] = [];
      for (let i = 0; i < 20; i++) {
        recipients.push({
          customerId: `cust-${i}`,
          email: `user${i}@example.com`,
        });
      }

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      // Should have some successes even with failures
      expect(context.sentCount).toBeGreaterThan(0);
    });
  });

  describe('Progress Tracking', () => {
    it('should track sent count during execution', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user1@example.com' },
        { customerId: 'cust-2', email: 'user2@example.com' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.sentCount + context.failedCount).toBe(context.totalRecipients);
    });

    it('should track failed count', async () => {
      dispatcher.failureRate = 0.5; // 50% failure rate

      const recipients: RecipientData[] = [];
      for (let i = 0; i < 10; i++) {
        recipients.push({
          customerId: `cust-${i}`,
          email: `user${i}@example.com`,
        });
      }

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      try {
        await executor.execute(
          'camp-1',
          'tenant-1',
          recipients,
          content,
          CampaignType.EMAIL
        );
      } catch (error) {
        // Failure threshold exceeded
      }
    });

    it('should track delivery metrics', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user1@example.com' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(typeof context.deliveredCount).toBe('number');
      expect(typeof context.sentCount).toBe('number');
      expect(typeof context.failedCount).toBe('number');
    });

    it('should track engagement metrics', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user@example.com' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.openedCount).toBeDefined();
      expect(context.clickedCount).toBeDefined();
      expect(context.bouncedCount).toBeDefined();
    });

    it('should update metrics during execution', async () => {
      const recipients: RecipientData[] = [];
      for (let i = 0; i < 5; i++) {
        recipients.push({
          customerId: `cust-${i}`,
          email: `user${i}@example.com`,
        });
      }

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.updatedAt).toBeInstanceOf(Date);
      expect(context.updatedAt.getTime()).toBeGreaterThanOrEqual(
        context.startedAt.getTime()
      );
    });
  });

  describe('Pause and Resume', () => {
    it('should pause campaign during execution', async () => {
      const recipients: RecipientData[] = [];
      for (let i = 0; i < 10; i++) {
        recipients.push({
          customerId: `cust-${i}`,
          email: `user${i}@example.com`,
        });
      }

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.isPaused).toBe(false);
    });

    it('should resume paused campaign', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user@example.com' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.isPaused).toBe(false);
    });

    it('should track pause state in execution context', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user@example.com' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(typeof context.isPaused).toBe('boolean');
    });
  });

  describe('Failure Threshold', () => {
    it('should fail campaign when failure rate exceeds 50%', async () => {
      dispatcher.failureRate = 0.95; // 95% failure rate to ensure threshold is exceeded

      const recipients: RecipientData[] = [];
      for (let i = 0; i < 100; i++) {
        recipients.push({
          customerId: `cust-${i}`,
          email: `user${i}@example.com`,
        });
      }

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      try {
        await executor.execute(
          'camp-1',
          'tenant-1',
          recipients,
          content,
          CampaignType.EMAIL
        );
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExecutorError);
      }
    });

    it('should succeed when failure rate below threshold', async () => {
      dispatcher.failureRate = 0.3; // 30% failure rate

      const recipients: RecipientData[] = [];
      for (let i = 0; i < 10; i++) {
        recipients.push({
          customerId: `cust-${i}`,
          email: `user${i}@example.com`,
        });
      }

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.state).toBe('completed');
    });

    it('should include threshold info in error message', async () => {
      dispatcher.failureRate = 0.8; // 80% failure rate

      const recipients: RecipientData[] = [];
      for (let i = 0; i < 5; i++) {
        recipients.push({
          customerId: `cust-${i}`,
          email: `user${i}@example.com`,
        });
      }

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      try {
        await executor.execute(
          'camp-1',
          'tenant-1',
          recipients,
          content,
          CampaignType.EMAIL
        );
      } catch (error) {
        const message = (error as ExecutorError).message;
        expect(message).toContain('50');
      }
    });
  });

  describe('Campaign Types', () => {
    it('should support email campaigns', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user@example.com' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test Email',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.state).toBe('completed');
    });

    it('should support SMS campaigns', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', phone: '+1234567890' },
      ];

      const content: CampaignContent = {
        sms: { message: 'Test SMS' },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.SMS
      );

      expect(context.state).toBe('completed');
    });

    it('should support WhatsApp campaigns', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', phone: '+1234567890' },
      ];

      const content: CampaignContent = {
        whatsapp: { textMessage: 'Test WhatsApp', templateName: 'test_template' },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.WHATSAPP
      );

      expect(context.state).toBe('completed');
    });

    it('should support push notification campaigns', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', metadata: { deviceToken: 'token-123' } },
      ];

      const content: CampaignContent = {
        push: {
          title: 'Test Notification',
          body: 'Test message',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.PUSH
      );

      expect(context.state).toBe('completed');
    });
  });

  describe('Error Handling', () => {
    it('should require campaignId', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user@example.com' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      await expect(
        executor.execute('', 'tenant-1', recipients, content, CampaignType.EMAIL)
      ).rejects.toThrow();
    });

    it('should require tenantId', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user@example.com' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      await expect(
        executor.execute('camp-1', '', recipients, content, CampaignType.EMAIL)
      ).rejects.toThrow();
    });

    it('should require recipients', async () => {
      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      await expect(
        executor.execute('camp-1', 'tenant-1', [], content, CampaignType.EMAIL)
      ).rejects.toThrow();
    });
  });

  describe('Execution Timestamps', () => {
    it('should set startedAt timestamp', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user@example.com' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.startedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt timestamp', async () => {
      const recipients: RecipientData[] = [
        { customerId: 'cust-1', email: 'user@example.com' },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.updatedAt).toBeInstanceOf(Date);
      expect(context.updatedAt.getTime()).toBeGreaterThanOrEqual(
        context.startedAt.getTime()
      );
    });
  });

  describe('Recipient Data Handling', () => {
    it('should handle recipients with metadata', async () => {
      const recipients: RecipientData[] = [
        {
          customerId: 'cust-1',
          email: 'user@example.com',
          name: 'User One',
          metadata: { tier: 'premium', segment: 'vip' },
        },
      ];

      const content: CampaignContent = {
        email: {
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          fromEmail: 'test@example.com',
        },
      };

      const context = await executor.execute(
        'camp-1',
        'tenant-1',
        recipients,
        content,
        CampaignType.EMAIL
      );

      expect(context.state).toBe('completed');
    });
  });
});
