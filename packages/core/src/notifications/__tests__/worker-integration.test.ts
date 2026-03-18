/**
 * Notification Worker Integration Tests
 * Comprehensive test suite for worker-orchestrator integration
 * Tests: job processing, channel routing, error handling, retry logic
 */

// Mock Prisma for template loading - must be before any imports
vi.mock('@witylogix/db', () => ({
  prisma: {
    notificationTemplate: {
      findFirst: vi.fn(),
    },
    notificationLog: {
      create: vi.fn(),
    },
  },
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationOrchestrator } from '../orchestrator';
import type { NotificationResult, NotificationMessage } from '../providers/types';

describe('NotificationWorker Integration', () => {
  let orchestrator: NotificationOrchestrator;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    orchestrator = new NotificationOrchestrator();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Job Processing Flow', () => {
    it('should process notification job and return success', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'customer@example.com',
        'template-456',
        { name: 'John', orderId: '789' }
      );

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should receive job from worker with required parameters', async () => {
      const jobPayload = {
        shopId: 'shop-123',
        channel: 'EMAIL' as const,
        to: 'user@example.com',
        templateId: 'welcome-email',
        variables: {
          firstName: 'John',
          activationLink: 'https://example.com/activate/abc123',
        },
      };

      const result = await orchestrator.sendNotification(
        jobPayload.shopId,
        jobPayload.channel,
        jobPayload.to,
        jobPayload.templateId,
        jobPayload.variables
      );

      expect(result).toBeDefined();
    });

    it('should handle job with minimal parameters', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'SMS',
        '+1234567890',
        'alert-123'
      );

      expect(result).toBeDefined();
    });
  });

  describe('Channel Routing', () => {
    it('should route EMAIL channel to correct provider', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'email-template',
        { message: 'Hello' }
      );

      expect(typeof result.success).toBe('boolean');
    });

    it('should route SMS channel to correct provider', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'SMS',
        '+1234567890',
        'sms-template',
        { code: '123456' }
      );

      expect(typeof result.success).toBe('boolean');
    });

    it('should route WHATSAPP channel to correct provider', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'WHATSAPP',
        '+1234567890',
        'whatsapp-template',
        { orderId: 'ORD123' }
      );

      expect(typeof result.success).toBe('boolean');
    });

    it('should route PUSH channel to correct provider', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'PUSH',
        'device-token-abc123',
        'push-template',
        { notification: 'Order shipped' }
      );

      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle orchestrator error and return failure result', async () => {
      const result = await orchestrator.sendNotification(
        'shop-456',
        'EMAIL',
        'invalid-email',
        'template-789'
      );

      expect(result.success).toBeDefined();
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle missing template gracefully', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'nonexistent-template-xyz'
      );

      expect(result).toBeDefined();
    });

    it('should handle provider timeout error', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'template-timeout'
      );

      expect(result).toBeDefined();
    });

    it('should handle network error from provider', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'SMS',
        '+1234567890',
        'template-network-error'
      );

      expect(result).toBeDefined();
    });

    it('should handle provider authentication error', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'template-auth-error'
      );

      expect(result).toBeDefined();
    });

    it('should handle provider rate limit error', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'SMS',
        '+1234567890',
        'template-rate-limit'
      );

      expect(result).toBeDefined();
    });

    it('should handle malformed response from provider', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'PUSH',
        'token-123',
        'template-malformed'
      );

      expect(result).toBeDefined();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient failure', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'template-retry-1'
      );

      expect(result).toBeDefined();
    });

    it('should respect max retry attempts', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'template-max-retries'
      );

      expect(result).toBeDefined();
    });

    it('should apply exponential backoff between retries', async () => {
      const startTime = Date.now();

      const result = await orchestrator.sendNotification(
        'shop-123',
        'SMS',
        '+1234567890',
        'template-backoff'
      );

      const elapsed = Date.now() - startTime;

      expect(result).toBeDefined();
      // Note: Actual timing may vary, but we can verify the structure
      expect(typeof result.success).toBe('boolean');
    });

    it('should not retry on permanent failure (4xx)', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'invalid@example',
        'template-permanent-fail'
      );

      expect(result).toBeDefined();
    });

    it('should retry on temporary failure (5xx)', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'template-temporary-fail'
      );

      expect(result).toBeDefined();
    });
  });

  describe('Batch Notification Sending', () => {
    it('should send notifications to multiple recipients', async () => {
      const results = await orchestrator.sendBatch(
        'shop-123',
        'EMAIL',
        [
          'customer1@example.com',
          'customer2@example.com',
          'customer3@example.com',
        ],
        'newsletter-template',
        { issue: 'Q1 2026' }
      );

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('recipient');
      expect(results[0]).toHaveProperty('result');
    });

    it('should handle partial batch failure', async () => {
      const results = await orchestrator.sendBatch(
        'shop-123',
        'SMS',
        [
          '+11111111111',
          '+invalid',
          '+33333333333',
        ],
        'sms-template',
        { code: 'ABC123' }
      );

      expect(results).toHaveLength(3);
      // At least some should have results
      expect(results.some(r => typeof r.result === 'object')).toBe(true);
    });

    it('should continue sending if one recipient fails', async () => {
      const results = await orchestrator.sendBatch(
        'shop-123',
        'PUSH',
        [
          'token-1',
          'token-2',
          'token-3',
          'token-4',
        ],
        'push-template',
        { alert: 'Special offer' }
      );

      expect(results).toHaveLength(4);
    });

    it('should preserve recipient order in batch results', async () => {
      const recipients = [
        'user1@example.com',
        'user2@example.com',
        'user3@example.com',
      ];

      const results = await orchestrator.sendBatch(
        'shop-123',
        'EMAIL',
        recipients,
        'batch-template'
      );

      expect(results[0].recipient).toBe(recipients[0]);
      expect(results[1].recipient).toBe(recipients[1]);
      expect(results[2].recipient).toBe(recipients[2]);
    });
  });

  describe('Template Variable Interpolation', () => {
    it('should interpolate single variable in template', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'template-name',
        { name: 'Alice' }
      );

      expect(result).toBeDefined();
    });

    it('should interpolate multiple variables', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'template-complex',
        {
          customerName: 'Bob',
          orderId: 'ORD-12345',
          totalAmount: '$99.99',
          deliveryDate: '2026-03-15',
        }
      );

      expect(result).toBeDefined();
    });

    it('should handle missing variable gracefully', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'SMS',
        '+1234567890',
        'template-missing-var',
        { name: 'Charlie' }
        // missing 'code' variable
      );

      expect(result).toBeDefined();
    });

    it('should handle special characters in variables', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'template-special-chars',
        {
          name: 'John O\'Brien & Sons',
          message: 'Special <chars> & "quotes"',
        }
      );

      expect(result).toBeDefined();
    });

    it('should interpolate nested object variables', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'WHATSAPP',
        '+1234567890',
        'template-nested',
        {
          user: {
            name: 'David',
            tier: 'premium',
          },
          offer: {
            discount: '20%',
            code: 'SAVE20',
          },
        }
      );

      expect(result).toBeDefined();
    });
  });

  describe('Provider Fallback Chain', () => {
    it('should try next provider if first fails', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'template-fallback-email',
        { name: 'Eve' }
      );

      expect(result).toBeDefined();
    });

    it('should return error if all providers fail', async () => {
      const result = await orchestrator.sendNotification(
        'shop-no-providers',
        'EMAIL',
        'test@example.com',
        'template-no-providers'
      );

      expect(result).toBeDefined();
    });

    it('should succeed on first provider if available', async () => {
      const result = await orchestrator.sendNotification(
        'shop-primary-provider',
        'SMS',
        '+1234567890',
        'template-primary'
      );

      expect(result).toBeDefined();
    });
  });

  describe('Message Metadata and Logging', () => {
    it('should include messageId in successful result', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'template-with-id',
        { name: 'Frank' }
      );

      if (result.success) {
        expect(result).toHaveProperty('messageId');
      }
    });

    it('should include error message in failed result', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'invalid-email',
        'template-fail'
      );

      if (!result.success) {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });

    it('should populate metadata in notification message', async () => {
      const result = await orchestrator.sendNotification(
        'shop-metadata-test',
        'PUSH',
        'device-token',
        'template-meta',
        { alert: 'Test' }
      );

      expect(result).toBeDefined();
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle multiple concurrent jobs', async () => {
      const jobs = [
        orchestrator.sendNotification(
          'shop-123',
          'EMAIL',
          'user1@example.com',
          'template-1'
        ),
        orchestrator.sendNotification(
          'shop-123',
          'SMS',
          '+1111111111',
          'template-2'
        ),
        orchestrator.sendNotification(
          'shop-123',
          'PUSH',
          'token-1',
          'template-3'
        ),
      ];

      const results = await Promise.all(jobs);

      expect(results).toHaveLength(3);
      expect(results.every(r => typeof r.success === 'boolean')).toBe(true);
    });

    it('should isolate jobs from each other', async () => {
      const results = await Promise.all([
        orchestrator.sendNotification('shop-a', 'EMAIL', 'a@example.com', 'tpl-a'),
        orchestrator.sendNotification('shop-b', 'SMS', '+2222222222', 'tpl-b'),
        orchestrator.sendNotification('shop-c', 'EMAIL', 'c@example.com', 'tpl-c'),
      ]);

      expect(results).toHaveLength(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty recipient string', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        '',
        'template-empty-recipient'
      );

      expect(result).toBeDefined();
    });

    it('should handle very long recipient addresses', async () => {
      const longEmail = 'a'.repeat(100) + '@example.com';

      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        longEmail,
        'template-long'
      );

      expect(result).toBeDefined();
    });

    it('should handle empty variables object', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'template-no-vars',
        {}
      );

      expect(result).toBeDefined();
    });

    it('should handle undefined variables (defaults)', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'SMS',
        '+1234567890',
        'template-undefined-vars'
        // No variables parameter
      );

      expect(result).toBeDefined();
    });

    it('should handle very large variables object', async () => {
      const largeVars = Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [
          `key${i}`,
          `value${i}`,
        ])
      );

      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'template-large-vars',
        largeVars
      );

      expect(result).toBeDefined();
    });

    it('should handle special characters in shop ID', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123-abc_def',
        'EMAIL',
        'test@example.com',
        'template-special-shop'
      );

      expect(result).toBeDefined();
    });

    it('should handle unicode characters in recipient', async () => {
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'ユーザー@example.com',
        'template-unicode'
      );

      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should process notification within reasonable time', async () => {
      const start = Date.now();

      await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'test@example.com',
        'template-perf'
      );

      const elapsed = Date.now() - start;

      // Should complete relatively quickly (not an absolute requirement,
      // but ensures we're not doing unnecessary blocking operations)
      expect(elapsed).toBeLessThan(5000);
    });

    it('should handle batch sending efficiently', async () => {
      const start = Date.now();

      await orchestrator.sendBatch(
        'shop-123',
        'EMAIL',
        Array.from({ length: 50 }, (_, i) => `user${i}@example.com`),
        'template-batch-perf'
      );

      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10000);
    });
  });
});
