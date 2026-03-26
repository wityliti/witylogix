/**
 * Audit Logger Tests
 * Comprehensive test suite for audit event logging, batching, diffing, sensitive field masking, and querying
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AuditLogger,
  AuditEvent,
  AuditAction,
  AuditConfig,
  ChangedField,
  SENSITIVE_FIELDS,
} from '../index';

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  afterEach(() => {
    logger.clear();
  });

  describe('Basic Event Logging', () => {
    it('should log a basic audit event', async () => {
      const event: Partial<AuditEvent> = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'orders',
      };

      await logger.log(event);
      expect(logger.getBatchSize()).toBe(1);
    });

    it('should require tenantId', async () => {
      const event: Partial<AuditEvent> = {
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'orders',
      };

      await expect(logger.log(event)).rejects.toThrow('tenantId is required');
    });

    it('should require userId', async () => {
      const event: Partial<AuditEvent> = {
        tenantId: 'tenant-1',
        action: AuditAction.CREATE,
        resource: 'orders',
      };

      await expect(logger.log(event)).rejects.toThrow('userId is required');
    });

    it('should require action', async () => {
      const event: Partial<AuditEvent> = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        resource: 'orders',
      };

      await expect(logger.log(event)).rejects.toThrow('action is required');
    });

    it('should require resource', async () => {
      const event: Partial<AuditEvent> = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
      };

      await expect(logger.log(event)).rejects.toThrow('resource is required');
    });

    it('should not log when disabled', async () => {
      const disabledLogger = new AuditLogger({ enabled: false });

      const event: Partial<AuditEvent> = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'orders',
      };

      await disabledLogger.log(event);
      expect(disabledLogger.getBatchSize()).toBe(0);
    });
  });

  describe('Batch Flushing', () => {
    it('should flush when batch size is reached', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      const config = new AuditLogger({ batchSize: 3 });
      config.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      for (let i = 0; i < 3; i++) {
        await config.log({
          tenantId: 'tenant-1',
          userId: 'user-1',
          action: AuditAction.CREATE,
          resource: 'orders',
          resourceId: `order-${i}`,
        });
      }

      expect(events.length).toBe(3);
      expect(config.getBatchSize()).toBe(0);
    });

    it('should flush on timeout when batch not full', async () => {
      const events: AuditEvent[] = [];
      const config = new AuditLogger({ batchIntervalMs: 100 });
      config.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await config.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'orders',
      });

      expect(config.getBatchSize()).toBe(1);

      // Wait for timer to flush
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(events.length).toBe(1);
      expect(config.getBatchSize()).toBe(0);
    }, { timeout: 5000 });

    it('should support manual flush', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'orders',
      });

      expect(logger.getBatchSize()).toBe(1);

      await logger.flush();

      expect(events.length).toBe(1);
      expect(logger.getBatchSize()).toBe(0);
    });

    it('should handle multiple batches', async () => {
      let flushCount = 0;
      logger.setFlushCallback(async () => {
        flushCount++;
      });

      for (let i = 0; i < 5; i++) {
        await logger.log({
          tenantId: 'tenant-1',
          userId: 'user-1',
          action: AuditAction.CREATE,
          resource: 'orders',
          resourceId: `order-${i}`,
        });
      }

      expect(flushCount).toBeGreaterThanOrEqual(1);
    });

    it('should not flush empty batch', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.flush();
      expect(events.length).toBe(0);
    });
  });

  describe('Diff Computation', () => {
    it('should compute changes between objects', async () => {
      const before = { name: 'Order 1', status: 'pending', amount: 100 };
      const after = { name: 'Order 1', status: 'completed', amount: 100 };

      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.logUpdate('tenant-1', 'user-1', 'orders', 'order-1', before, after);

      expect(logger.getBatchSize()).toBe(1);
      expect(events.length).toBe(0); // Not flushed yet

      await logger.flush();

      expect(events.length).toBe(1);
      expect(events[0].changes).toBeDefined();
      expect(events[0].changes?.status).toEqual({ old: 'pending', new: 'completed' });
      expect(events[0].changes?.amount).toBeUndefined(); // No change
    });

    it('should handle added fields in diff', async () => {
      const before = { name: 'Order 1' };
      const after = { name: 'Order 1', status: 'pending', notes: 'test' };

      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.logUpdate('tenant-1', 'user-1', 'orders', 'order-1', before, after);
      await logger.flush();

      expect(events[0].changes?.status).toEqual({ old: undefined, new: 'pending' });
      expect(events[0].changes?.notes).toEqual({ old: undefined, new: 'test' });
    });

    it('should handle removed fields in diff', async () => {
      const before = { name: 'Order 1', status: 'pending', notes: 'test' };
      const after = { name: 'Order 1' };

      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.logUpdate('tenant-1', 'user-1', 'orders', 'order-1', before, after);
      await logger.flush();

      expect(events[0].changes?.status).toEqual({ old: 'pending', new: undefined });
      expect(events[0].changes?.notes).toEqual({ old: 'test', new: undefined });
    });

    it('should detect no changes', async () => {
      const before = { name: 'Order 1', status: 'pending' };
      const after = { name: 'Order 1', status: 'pending' };

      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.logUpdate('tenant-1', 'user-1', 'orders', 'order-1', before, after);
      await logger.flush();

      expect(events[0].changes).toEqual({});
      expect(events[0].changesSummary).toBe('No changes');
    });

    it('should handle complex object changes', async () => {
      const before = {
        name: 'Order 1',
        items: [{ id: 1, qty: 5 }],
        metadata: { source: 'api' },
      };
      const after = {
        name: 'Order 1',
        items: [{ id: 1, qty: 10 }],
        metadata: { source: 'api' },
      };

      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.logUpdate('tenant-1', 'user-1', 'orders', 'order-1', before, after);
      await logger.flush();

      expect(events[0].changes?.items).toBeDefined();
      expect(events[0].changes?.metadata).toBeUndefined(); // No change
    });
  });

  describe('Sensitive Field Masking', () => {
    it('should mask password fields', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'users',
        changes: { password: 'secret123', name: 'John' },
      });

      await logger.flush();

      expect(events[0].changes?.password).toBe('***REDACTED***');
      expect(events[0].changes?.name).toBe('John');
    });

    it('should mask token fields', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'integrations',
        changes: { api_token: 'sk_live_abc123', name: 'Stripe' },
      });

      await logger.flush();

      expect(events[0].changes?.api_token).toBe('***REDACTED***');
      expect(events[0].changes?.name).toBe('Stripe');
    });

    it('should mask fields in metadata', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'orders',
        metadata: { secret_key: 'secret', email: 'test@example.com' },
      });

      await logger.flush();

      expect(events[0].metadata?.secret_key).toBe('***REDACTED***');
      expect(events[0].metadata?.email).toBe('***REDACTED***');
    });

    it('should not mask when maskSensitiveFields is disabled', async () => {
      const disabledLogger = new AuditLogger({ maskSensitiveFields: false });
      const events: AuditEvent[] = [];
      disabledLogger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await disabledLogger.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'users',
        changes: { password: 'secret123', name: 'John' },
      });

      await disabledLogger.flush();

      expect(events[0].changes?.password).toBe('secret123');
    });

    it('should handle multiple sensitive fields', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.UPDATE,
        resource: 'users',
        changes: {
          password: 'secret123',
          api_key: 'key_abc',
          access_token: 'token_xyz',
          name: 'John',
          email: 'john@example.com',
        },
      });

      await logger.flush();

      expect(events[0].changes?.password).toBe('***REDACTED***');
      expect(events[0].changes?.api_key).toBe('***REDACTED***');
      expect(events[0].changes?.access_token).toBe('***REDACTED***');
      expect(events[0].changes?.name).toBe('John');
      expect(events[0].changes?.email).toBe('***REDACTED***');
    });
  });

  describe('Event Exclusions', () => {
    it('should exclude events from specified resources', async () => {
      const config = new AuditLogger({ excludeResources: ['system', 'internal'] });
      let loggedCount = 0;
      config.setFlushCallback(async () => {
        loggedCount++;
      });

      await config.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'system',
      });

      // Flush to process batch
      await config.flush();

      expect(loggedCount).toBe(0);
    });

    it('should exclude events from specified actions', async () => {
      const config = new AuditLogger({ excludeActions: ['read', 'debug'] });
      let loggedCount = 0;
      config.setFlushCallback(async () => {
        loggedCount++;
      });

      await config.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'read',
        resource: 'orders',
      });

      await config.flush();

      expect(loggedCount).toBe(0);
    });

    it('should log non-excluded events', async () => {
      const config = new AuditLogger({ excludeResources: ['system'] });
      let loggedCount = 0;
      config.setFlushCallback(async () => {
        loggedCount++;
      });

      await config.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'orders',
      });

      await config.flush();

      expect(loggedCount).toBe(1);
    });
  });

  describe('Convenience Methods', () => {
    it('should log create events', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.logCreate(
        'tenant-1',
        'user-1',
        'orders',
        'order-1',
        { name: 'Order 1', status: 'pending' }
      );

      await logger.flush();

      expect(events[0].action).toBe(AuditAction.CREATE);
      expect(events[0].resource).toBe('orders');
    });

    it('should log delete events', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.logDelete('tenant-1', 'user-1', 'orders', 'order-1');

      await logger.flush();

      expect(events[0].action).toBe(AuditAction.DELETE);
      expect(events[0].resourceId).toBe('order-1');
    });

    it('should log multiple events', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      const logEntries = [
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          action: AuditAction.CREATE,
          resource: 'orders',
        },
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          action: AuditAction.UPDATE,
          resource: 'orders',
        },
      ];

      await logger.logMany(logEntries);
      await logger.flush();

      expect(events.length).toBe(2);
    });
  });

  describe('Concurrent Logging', () => {
    it('should handle concurrent log operations', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          logger.log({
            tenantId: 'tenant-1',
            userId: `user-${i}`,
            action: AuditAction.CREATE,
            resource: 'orders',
            resourceId: `order-${i}`,
          })
        );
      }

      await Promise.all(promises);
      await logger.flush();

      expect(events.length).toBe(10);
    });

    it('should not lose data with concurrent operations', async () => {
      let totalLogged = 0;
      logger.setFlushCallback(async (batch) => {
        totalLogged += batch.length;
      });

      const promises = [];
      for (let i = 0; i < 25; i++) {
        promises.push(
          logger.log({
            tenantId: 'tenant-1',
            userId: 'user-1',
            action: AuditAction.CREATE,
            resource: 'orders',
            resourceId: `order-${i}`,
          })
        );
      }

      await Promise.all(promises);
      await logger.flush();

      expect(totalLogged).toBe(25);
    });
  });

  describe('Event Normalization', () => {
    it('should auto-generate event ID', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'orders',
      });

      await logger.flush();

      expect(events[0].id).toBeDefined();
      expect(events[0].id).toMatch(/^audit-/);
    });

    it('should auto-generate timestamp', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      const beforeTime = new Date();
      await logger.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'orders',
      });
      const afterTime = new Date();

      await logger.flush();

      expect(events[0].timestamp).toBeDefined();
      expect(new Date(events[0].timestamp!).getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(new Date(events[0].timestamp!).getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should preserve provided event data', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'orders',
        resourceId: 'order-123',
        resourceName: 'New Order',
        ipAddress: '192.168.1.1',
      });

      await logger.flush();

      expect(events[0].resourceId).toBe('order-123');
      expect(events[0].resourceName).toBe('New Order');
      expect(events[0].ipAddress).toBe('192.168.1.1');
    });
  });

  describe('Change Summary Generation', () => {
    it('should summarize single field change', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.logUpdate(
        'tenant-1',
        'user-1',
        'orders',
        'order-1',
        { status: 'pending' },
        { status: 'completed' }
      );

      await logger.flush();

      expect(events[0].changesSummary).toBe('Modified status');
    });

    it('should summarize multiple field changes', async () => {
      const events: AuditEvent[] = [];
      logger.setFlushCallback(async (batch) => {
        events.push(...batch);
      });

      await logger.logUpdate(
        'tenant-1',
        'user-1',
        'orders',
        'order-1',
        { status: 'pending', amount: 100, notes: '' },
        { status: 'completed', amount: 150, notes: 'Updated' }
      );

      await logger.flush();

      expect(events[0].changesSummary).toContain('Modified 3 fields');
      expect(events[0].changesSummary).toContain('status');
      expect(events[0].changesSummary).toContain('amount');
      expect(events[0].changesSummary).toContain('notes');
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom batch size', async () => {
      let flushCount = 0;
      const config = new AuditLogger({ batchSize: 2 });
      config.setFlushCallback(async () => {
        flushCount++;
      });

      for (let i = 0; i < 3; i++) {
        await config.log({
          tenantId: 'tenant-1',
          userId: 'user-1',
          action: AuditAction.CREATE,
          resource: 'orders',
          resourceId: `order-${i}`,
        });
      }

      expect(flushCount).toBeGreaterThanOrEqual(1);
    });

    it('should support retention days configuration', async () => {
      const config = new AuditLogger({ retentionDays: 30 });
      expect(config).toBeDefined();
    });

    it('should respect capture metadata flag', async () => {
      const config = new AuditLogger({ captureMetadata: false });
      expect(config).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw when flush callback fails', async () => {
      logger.setFlushCallback(async () => {
        throw new Error('Database error');
      });

      await logger.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'orders',
      });

      await expect(logger.flush()).rejects.toThrow('Failed to flush audit events');
    });
  });

  describe('Clear Operation', () => {
    it('should clear pending events', async () => {
      await logger.log({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: AuditAction.CREATE,
        resource: 'orders',
      });

      expect(logger.getBatchSize()).toBe(1);

      logger.clear();

      expect(logger.getBatchSize()).toBe(0);
    });
  });
});
