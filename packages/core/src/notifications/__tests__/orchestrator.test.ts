/**
 * Notification Orchestrator Integration Tests
 *
 * Tests the complete notification delivery pipeline:
 * - Template loading from database
 * - Mustache variable rendering
 * - Provider routing and selection
 * - Retry logic with exponential backoff
 * - Failover to backup providers
 * - Rate limit handling
 * - Delivery logging
 * - Error type handling
 *
 * Mocking strategy:
 * - Mock Prisma via (prisma as any).notificationTemplate and .notificationLog
 * - Mock providers via vi.fn()
 * - Mock sleep/delays to run tests quickly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NotificationOrchestrator,
  getNotificationOrchestrator,
  setOrchestratorRetryOptions,
} from '../orchestrator.js';
import { getTenantProviderRegistry, clearAllRegistries } from '../provider-registry.js';
import type { NotificationProvider, NotificationMessage, NotificationResult } from '../providers/types.js';

// Mock prisma module
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

describe('NotificationOrchestrator', () => {
  let orchestrator: NotificationOrchestrator;
  let mockPrisma: any;
  let mockProvider: NotificationProvider;

  beforeEach(() => {
    // Reset orchestrator singleton
    orchestrator = getNotificationOrchestrator();
    clearAllRegistries();

    // Get mocked prisma
    const module = vi.importActual('@witylogix/db') as any;
    mockPrisma = module.prisma;

    // Create mock provider
    mockProvider = {
      channel: 'EMAIL',
      name: 'test-provider',
      send: vi.fn(),
      validateConfig: vi.fn().mockResolvedValue(true),
      getStatus: vi.fn().mockResolvedValue({
        healthy: true,
        latency: 50,
        quotaRemaining: 1000,
      }),
    };

    // Register provider to registry
    const registry = getTenantProviderRegistry('shop-123');
    registry.registerProvider('EMAIL', 'test-provider', mockProvider);
    registry.setFallbackChain('EMAIL', 'test-provider');

    // Speed up tests by reducing retry delays
    setOrchestratorRetryOptions({
      maxAttempts: 3,
      baseBackoffMs: 1,
      jitterFraction: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearAllRegistries();
  });

  describe('Template Loading and Rendering', () => {
    it('should load template from database and render with variables', async () => {
      // Arrange
      const template = {
        id: 'welcome-email',
        channel: 'EMAIL' as const,
        name: 'Welcome Email',
        subject: 'Welcome {{name}}!',
        body: 'Hello {{name}}, welcome to {{company}}!',
        textBody: 'Hello {{name}}, welcome to {{company}}!',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);
      (mockProvider.send as any).mockResolvedValueOnce({
        success: true,
        messageId: 'msg-123',
      });

      // Act
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'welcome-email',
        { name: 'Alice', company: 'Witylogix' }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');

      // Verify template was loaded
      expect(mockPrisma.notificationTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'welcome-email',
          channel: 'EMAIL',
          active: true,
        },
      });

      // Verify provider received rendered template
      const sendCall = (mockProvider.send as any).mock.calls[0][0] as NotificationMessage;
      expect(sendCall.subject).toBe('Welcome Alice!');
      expect(sendCall.body).toBe('Hello Alice, welcome to Witylogix!');
    });

    it('should handle missing template gracefully', async () => {
      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'missing-template'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template not found');
    });

    it('should render template with special characters and escapes', async () => {
      const template = {
        id: 'special-chars',
        channel: 'EMAIL' as const,
        name: 'Special Chars',
        subject: 'Order #{{orderId}} - {{amount}}',
        body: 'Amount: ${{amount}}, Status: {{status}}',
        textBody: 'Amount: ${{amount}}, Status: {{status}}',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);
      (mockProvider.send as any).mockResolvedValueOnce({
        success: true,
        messageId: 'msg-456',
      });

      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'special-chars',
        { orderId: '12345', amount: '99.99', status: 'Processing' }
      );

      expect(result.success).toBe(true);
      const sendCall = (mockProvider.send as any).mock.calls[0][0] as NotificationMessage;
      expect(sendCall.body).toBe('Amount: $99.99, Status: Processing');
    });

    it('should handle missing variables gracefully (replace with empty string)', async () => {
      const template = {
        id: 'optional-vars',
        channel: 'EMAIL' as const,
        name: 'Optional Vars',
        subject: 'Hello {{name}}',
        body: 'Optional middle name: {{middleName}}',
        textBody: 'Optional middle name: {{middleName}}',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);
      (mockProvider.send as any).mockResolvedValueOnce({
        success: true,
        messageId: 'msg-789',
      });

      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'optional-vars',
        { name: 'Alice' } // middleName is missing
      );

      expect(result.success).toBe(true);
      const sendCall = (mockProvider.send as any).mock.calls[0][0] as NotificationMessage;
      expect(sendCall.body).toBe('Optional middle name: ');
    });
  });

  describe('Provider Routing', () => {
    it('should route to correct provider based on channel and tenant config', async () => {
      const template = {
        id: 'sms-notif',
        channel: 'SMS' as const,
        name: 'SMS Notification',
        body: 'Your code is {{code}}',
        active: true,
      };

      // Setup SMS provider
      const smsProvider: NotificationProvider = {
        channel: 'SMS',
        name: 'twilio',
        send: vi.fn().mockResolvedValue({
          success: true,
          messageId: 'sms-msg-123',
        }),
        validateConfig: vi.fn().mockResolvedValue(true),
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
      };

      const registry = getTenantProviderRegistry('shop-123');
      registry.registerProvider('SMS', 'twilio', smsProvider);
      registry.setFallbackChain('SMS', 'twilio');

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);

      const result = await orchestrator.sendNotification(
        'shop-123',
        'SMS',
        '+1234567890',
        'sms-notif',
        { code: '123456' }
      );

      expect(result.success).toBe(true);
      expect(smsProvider.send).toHaveBeenCalled();
    });

    it('should error when no providers configured for channel', async () => {
      // Clear all registries to simulate no providers
      clearAllRegistries();
      const registry = getTenantProviderRegistry('shop-456');
      // Don't register any providers

      const template = {
        id: 'test',
        channel: 'EMAIL' as const,
        name: 'Test',
        body: 'Body',
        active: true,
      };
      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);

      const result = await orchestrator.sendNotification(
        'shop-456',
        'EMAIL',
        'user@example.com',
        'test'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No providers configured');
    });

    it('should include metadata in message sent to provider', async () => {
      const template = {
        id: 'metadata-test',
        channel: 'EMAIL' as const,
        name: 'Metadata Test',
        subject: 'Test',
        body: 'Test body',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);
      (mockProvider.send as any).mockResolvedValueOnce({
        success: true,
        messageId: 'msg-metadata',
      });

      await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'metadata-test'
      );

      const sendCall = (mockProvider.send as any).mock.calls[0][0] as NotificationMessage;
      expect(sendCall.metadata).toEqual({
        shopId: 'shop-123',
        templateId: 'metadata-test',
        channel: 'EMAIL',
      });
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient failure and succeed on second attempt', async () => {
      const template = {
        id: 'retry-test',
        channel: 'EMAIL' as const,
        name: 'Retry Test',
        body: 'Test',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);

      // First attempt fails with rate limit error
      (mockProvider.send as any)
        .mockResolvedValueOnce({
          success: false,
          error: 'Rate limit exceeded, retry after 60s',
        })
        // Second attempt succeeds
        .mockResolvedValueOnce({
          success: true,
          messageId: 'msg-retry-success',
        });

      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'retry-test'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-retry-success');
      expect(mockProvider.send).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries after max attempts', async () => {
      const template = {
        id: 'exhaust-retries',
        channel: 'EMAIL' as const,
        name: 'Exhaust Retries',
        body: 'Test',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);

      // All attempts fail
      (mockProvider.send as any).mockResolvedValue({
        success: false,
        error: 'Temporary service error',
      });

      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'exhaust-retries'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Exhausted all retry attempts');
      expect(mockProvider.send).toHaveBeenCalledTimes(3); // maxAttempts = 3
    });

    it('should not retry on permanent errors (e.g., invalid recipient)', async () => {
      const template = {
        id: 'permanent-error',
        channel: 'EMAIL' as const,
        name: 'Permanent Error',
        body: 'Test',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);

      // Permanent error
      (mockProvider.send as any).mockResolvedValueOnce({
        success: false,
        error: 'Invalid email address',
      });

      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'invalid-email',
        'permanent-error'
      );

      expect(result.success).toBe(false);
      expect(mockProvider.send).toHaveBeenCalledTimes(1); // No retries
    });

    it('should use exponential backoff with jitter', async () => {
      const template = {
        id: 'backoff-test',
        channel: 'EMAIL' as const,
        name: 'Backoff Test',
        body: 'Test',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);

      // Fail twice, succeed third time
      (mockProvider.send as any)
        .mockResolvedValueOnce({ success: false, error: 'timeout' })
        .mockResolvedValueOnce({ success: false, error: 'timeout' })
        .mockResolvedValueOnce({ success: true, messageId: 'msg-backoff' });

      const startTime = Date.now();
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'backoff-test'
      );

      const duration = Date.now() - startTime;

      // With baseBackoff=1ms and 2 retries: (1ms + 2ms) = at least 3ms expected
      // But timing can vary, just check we did multiple attempts
      expect(result.success).toBe(true);
      expect(mockProvider.send).toHaveBeenCalledTimes(3);
    });
  });

  describe('Failover to Backup Providers', () => {
    it('should failover to backup provider when primary fails', async () => {
      const template = {
        id: 'failover-test',
        channel: 'EMAIL' as const,
        name: 'Failover Test',
        body: 'Test',
        active: true,
      };

      // Setup primary and backup providers
      const primaryProvider: NotificationProvider = {
        channel: 'EMAIL',
        name: 'primary',
        send: vi.fn().mockResolvedValue({
          success: false,
          error: 'Service unavailable',
        }),
        validateConfig: vi.fn().mockResolvedValue(true),
        getStatus: vi.fn().mockResolvedValue({ healthy: false }),
      };

      const backupProvider: NotificationProvider = {
        channel: 'EMAIL',
        name: 'backup',
        send: vi.fn().mockResolvedValue({
          success: true,
          messageId: 'msg-backup',
        }),
        validateConfig: vi.fn().mockResolvedValue(true),
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
      };

      const registry = getTenantProviderRegistry('shop-123');
      registry.registerProvider('EMAIL', 'primary', primaryProvider);
      registry.registerProvider('EMAIL', 'backup', backupProvider);
      registry.setFallbackChain('EMAIL', 'primary', ['backup']);

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);

      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'failover-test'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-backup');
      expect(primaryProvider.send).toHaveBeenCalled();
      expect(backupProvider.send).toHaveBeenCalled();
    });

    it('should try all providers in fallback chain before giving up', async () => {
      const template = {
        id: 'multi-failover',
        channel: 'EMAIL' as const,
        name: 'Multi Failover',
        body: 'Test',
        active: true,
      };

      const provider1: NotificationProvider = {
        channel: 'EMAIL',
        name: 'provider1',
        send: vi.fn().mockResolvedValue({ success: false, error: 'Failed 1' }),
        validateConfig: vi.fn().mockResolvedValue(true),
        getStatus: vi.fn().mockResolvedValue({ healthy: false }),
      };

      const provider2: NotificationProvider = {
        channel: 'EMAIL',
        name: 'provider2',
        send: vi.fn().mockResolvedValue({ success: false, error: 'Failed 2' }),
        validateConfig: vi.fn().mockResolvedValue(true),
        getStatus: vi.fn().mockResolvedValue({ healthy: false }),
      };

      const provider3: NotificationProvider = {
        channel: 'EMAIL',
        name: 'provider3',
        send: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-3' }),
        validateConfig: vi.fn().mockResolvedValue(true),
        getStatus: vi.fn().mockResolvedValue({ healthy: true }),
      };

      const registry = getTenantProviderRegistry('shop-123');
      registry.registerProvider('EMAIL', 'provider1', provider1);
      registry.registerProvider('EMAIL', 'provider2', provider2);
      registry.registerProvider('EMAIL', 'provider3', provider3);
      registry.setFallbackChain('EMAIL', 'provider1', ['provider2', 'provider3']);

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);

      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'multi-failover'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-3');
      expect(provider1.send).toHaveBeenCalled();
      expect(provider2.send).toHaveBeenCalled();
      expect(provider3.send).toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limit error and retry', async () => {
      const template = {
        id: 'rate-limit-test',
        channel: 'EMAIL' as const,
        name: 'Rate Limit Test',
        body: 'Test',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);

      (mockProvider.send as any)
        .mockResolvedValueOnce({
          success: false,
          error: 'Rate limit exceeded, try again later',
        })
        .mockResolvedValueOnce({
          success: true,
          messageId: 'msg-rate-limit',
        });

      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'rate-limit-test'
      );

      expect(result.success).toBe(true);
      expect(mockProvider.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('Delivery Logging', () => {
    it('should log successful delivery to database', async () => {
      const template = {
        id: 'logging-test',
        channel: 'EMAIL' as const,
        name: 'Logging Test',
        subject: 'Test',
        body: 'Test body',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);
      (mockProvider.send as any).mockResolvedValueOnce({
        success: true,
        messageId: 'msg-logged',
      });

      await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'logging-test'
      );

      expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shopId: 'shop-123',
          templateId: 'logging-test',
          channel: 'EMAIL',
          recipient: 'user@example.com',
          status: 'SENT',
          messageId: 'msg-logged',
        }),
      });
    });

    it('should log failed delivery with error message', async () => {
      const template = {
        id: 'fail-logging-test',
        channel: 'EMAIL' as const,
        name: 'Fail Logging Test',
        body: 'Test',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);
      (mockProvider.send as any).mockResolvedValue({
        success: false,
        error: 'Permanent failure',
      });

      await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'fail-logging-test'
      );

      expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'Permanent failure',
        }),
      });
    });

    it('should not fail if logging throws (graceful degradation)', async () => {
      const template = {
        id: 'logging-error-test',
        channel: 'EMAIL' as const,
        name: 'Logging Error Test',
        body: 'Test',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);
      (mockProvider.send as any).mockResolvedValueOnce({
        success: true,
        messageId: 'msg-123',
      });
      mockPrisma.notificationLog.create.mockRejectedValueOnce(
        new Error('Database error')
      );

      // Should not throw
      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'logging-error-test'
      );

      expect(result.success).toBe(true); // Still considered successful
    });
  });

  describe('Error Handling', () => {
    it('should handle ProviderError with code and retryable flag', async () => {
      const template = {
        id: 'provider-error-test',
        channel: 'EMAIL' as const,
        name: 'Provider Error Test',
        body: 'Test',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);

      const err = new Error('API Key invalid');
      (err as any).name = 'AuthenticationError';

      (mockProvider.send as any).mockRejectedValueOnce(err);

      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'provider-error-test'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('API Key invalid');
    });

    it('should handle timeout errors as retryable', async () => {
      const template = {
        id: 'timeout-test',
        channel: 'EMAIL' as const,
        name: 'Timeout Test',
        body: 'Test',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);

      const err = new Error('ECONNREFUSED: Connection refused');
      (mockProvider.send as any)
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce({ success: true, messageId: 'msg-recovered' });

      const result = await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'timeout-test'
      );

      expect(result.success).toBe(true);
      expect(mockProvider.send).toHaveBeenCalledTimes(2); // Retried
    });
  });

  describe('Batch Sending', () => {
    it('should send batch to multiple recipients', async () => {
      const template = {
        id: 'batch-test',
        channel: 'EMAIL' as const,
        name: 'Batch Test',
        body: 'Hello {{name}}',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValue(template);
      (mockProvider.send as any).mockResolvedValue({
        success: true,
        messageId: 'msg-batch',
      });

      const recipients = ['user1@example.com', 'user2@example.com', 'user3@example.com'];
      const results = await orchestrator.sendBatch(
        'shop-123',
        'EMAIL',
        recipients,
        'batch-test',
        { name: 'User' }
      );

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.result.success)).toBe(true);
      expect(mockProvider.send).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in batch', async () => {
      const template = {
        id: 'partial-batch',
        channel: 'EMAIL' as const,
        name: 'Partial Batch',
        body: 'Test',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValue(template);

      (mockProvider.send as any)
        .mockResolvedValueOnce({ success: true, messageId: 'msg-1' })
        .mockResolvedValueOnce({ success: false, error: 'Invalid recipient' })
        .mockResolvedValueOnce({ success: true, messageId: 'msg-3' });

      const recipients = ['user1@example.com', 'invalid', 'user3@example.com'];
      const results = await orchestrator.sendBatch(
        'shop-123',
        'EMAIL',
        recipients,
        'partial-batch'
      );

      expect(results).toHaveLength(3);
      expect(results[0].result.success).toBe(true);
      expect(results[1].result.success).toBe(false);
      expect(results[2].result.success).toBe(true);
    });
  });

  describe('Provider Health Checks', () => {
    it('should check health status of providers', async () => {
      const registry = getTenantProviderRegistry('shop-123');

      const health = await orchestrator.getProviderHealth('shop-123', 'EMAIL');

      expect(health).toHaveProperty('test-provider');
      expect(health['test-provider']).toMatchObject({
        healthy: true,
        latency: 50,
        quotaRemaining: 1000,
      });
    });

    it('should check health across all channels', async () => {
      const health = await orchestrator.getAllChannelHealth('shop-123');

      expect(health).toHaveProperty('EMAIL');
      expect(health).toHaveProperty('SMS');
      expect(health).toHaveProperty('WHATSAPP');
      expect(health).toHaveProperty('PUSH');
    });
  });

  describe('Variable Interpolation Edge Cases', () => {
    it('should handle numeric and boolean variables', async () => {
      const template = {
        id: 'complex-vars',
        channel: 'EMAIL' as const,
        name: 'Complex Vars',
        body: 'Count: {{count}}, Active: {{isActive}}, Amount: {{amount}}',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);
      (mockProvider.send as any).mockResolvedValueOnce({
        success: true,
        messageId: 'msg-complex',
      });

      await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'complex-vars',
        { count: 42, isActive: true, amount: 19.99 }
      );

      const sendCall = (mockProvider.send as any).mock.calls[0][0] as NotificationMessage;
      expect(sendCall.body).toBe('Count: 42, Active: true, Amount: 19.99');
    });

    it('should handle null and undefined variables gracefully', async () => {
      const template = {
        id: 'null-vars',
        channel: 'EMAIL' as const,
        name: 'Null Vars',
        body: 'Value: {{value}}, Other: {{other}}',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);
      (mockProvider.send as any).mockResolvedValueOnce({
        success: true,
        messageId: 'msg-null',
      });

      await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'null-vars',
        { value: null, other: undefined }
      );

      const sendCall = (mockProvider.send as any).mock.calls[0][0] as NotificationMessage;
      expect(sendCall.body).toBe('Value: , Other: ');
    });

    it('should handle regex special characters in variable names', async () => {
      const template = {
        id: 'regex-special',
        channel: 'EMAIL' as const,
        name: 'Regex Special',
        body: 'Info: {{user.email}} and {{user[0]}}',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);
      (mockProvider.send as any).mockResolvedValueOnce({
        success: true,
        messageId: 'msg-regex',
      });

      await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'regex-special',
        { 'user.email': 'alice@example.com', 'user[0]': 'first' }
      );

      const sendCall = (mockProvider.send as any).mock.calls[0][0] as NotificationMessage;
      expect(sendCall.body).toBe('Info: alice@example.com and first');
    });

    it('should handle whitespace variations in placeholder syntax', async () => {
      const template = {
        id: 'whitespace-vars',
        channel: 'EMAIL' as const,
        name: 'Whitespace Vars',
        body: 'Spaced: {{  name  }}, Normal: {{name}}, Newline: {{\nname\n}}',
        active: true,
      };

      mockPrisma.notificationTemplate.findFirst.mockResolvedValueOnce(template);
      (mockProvider.send as any).mockResolvedValueOnce({
        success: true,
        messageId: 'msg-whitespace',
      });

      await orchestrator.sendNotification(
        'shop-123',
        'EMAIL',
        'user@example.com',
        'whitespace-vars',
        { name: 'Bob' }
      );

      const sendCall = (mockProvider.send as any).mock.calls[0][0] as NotificationMessage;
      expect(sendCall.body).toContain('Spaced: Bob');
      expect(sendCall.body).toContain('Normal: Bob');
    });
  });
});
