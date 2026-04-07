/**
 * Dead Letter Queue Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InMemoryDeadLetterQueue,
  DeadLetterQueueFactory,
  createInMemoryDeadLetterQueue,
  DeadLetterAlertHandler,
} from '../dead-letter.js';
import { BaseEvent, EventBusError } from '../types.js';

describe('InMemoryDeadLetterQueue', () => {
  let dlq: InMemoryDeadLetterQueue;

  beforeEach(() => {
    dlq = createInMemoryDeadLetterQueue();
  });

  describe('Add Operations', () => {
    it('should add failed event to DLQ', async () => {
      const event: BaseEvent = {
        id: 'evt-1',
        type: 'order.created',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-1',
        data: { orderId: '123' },
      };

      const error = new Error('Processing failed');
      const entryId = await dlq.add(event, error, 3);

      expect(entryId).toBeDefined();
      expect(typeof entryId).toBe('string');
    });

    it('should store error details', async () => {
      const event: BaseEvent = {
        id: 'evt-1',
        type: 'order.created',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-1',
        data: { orderId: '123' },
      };

      const error = new Error('Processing failed');
      const entryId = await dlq.add(event, error, 2, { context: 'test' });

      const entry = await dlq.getById(entryId);

      expect(entry).not.toBeNull();
      expect(entry?.error.message).toBe('Processing failed');
      expect(entry?.retryCount).toBe(2);
      expect(entry?.context?.context).toBe('test');
    });

    it('should initialize entry with pending status', async () => {
      const event: BaseEvent = {
        id: 'evt-2',
        type: 'order.updated',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-2',
        data: { orderId: '456' },
      };

      const error = new Error('Failed');
      const entryId = await dlq.add(event, error, 3);

      const entry = await dlq.getById(entryId);

      expect(entry?.status).toBe('pending');
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      const event1: BaseEvent = {
        id: 'evt-1',
        type: 'order.created',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-1',
        data: { orderId: '123' },
      };

      const event2: BaseEvent = {
        id: 'evt-2',
        type: 'order.updated',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-2',
        data: { orderId: '456' },
      };

      const error = new Error('Processing failed');

      const id1 = await dlq.add(event1, error, 3);
      const id2 = await dlq.add(event2, error, 2);

      await dlq.resolve(id1);
    });

    it('should query pending entries', async () => {
      const result = await dlq.query({ status: 'pending' });

      expect(result.total).toBe(1);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].status).toBe('pending');
    });

    it('should query resolved entries', async () => {
      const result = await dlq.query({ status: 'resolved' });

      expect(result.total).toBe(1);
      expect(result.entries[0].status).toBe('resolved');
    });

    it('should query by event type', async () => {
      const result = await dlq.query({ eventType: 'order.created' });

      expect(result.total).toBe(1);
      expect(result.entries[0].event.type).toBe('order.created');
    });

    it('should apply pagination', async () => {
      const page1 = await dlq.query({ limit: 1, offset: 0 });

      expect(page1.entries).toHaveLength(1);
      expect(page1.hasMore).toBe(true);

      const page2 = await dlq.query({ limit: 1, offset: 1 });

      expect(page2.entries).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });
  });

  describe('Status Management', () => {
    let entryId: string;

    beforeEach(async () => {
      const event: BaseEvent = {
        id: 'evt-1',
        type: 'order.created',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-1',
        data: { orderId: '123' },
      };

      const error = new Error('Failed');
      entryId = await dlq.add(event, error, 3);
    });

    it('should resolve an entry', async () => {
      let entry = await dlq.getById(entryId);
      expect(entry?.status).toBe('pending');

      await dlq.resolve(entryId);

      entry = await dlq.getById(entryId);
      expect(entry?.status).toBe('resolved');
    });

    it('should ignore an entry', async () => {
      let entry = await dlq.getById(entryId);
      expect(entry?.status).toBe('pending');

      await dlq.ignore(entryId);

      entry = await dlq.getById(entryId);
      expect(entry?.status).toBe('ignored');
    });

    it('should throw error when resolving non-existent entry', async () => {
      await expect(dlq.resolve('non-existent')).rejects.toThrow(EventBusError);
    });

    it('should throw error when ignoring non-existent entry', async () => {
      await expect(dlq.ignore('non-existent')).rejects.toThrow(EventBusError);
    });
  });

  describe('Replay', () => {
    let entryId: string;

    beforeEach(async () => {
      const event: BaseEvent = {
        id: 'evt-replay',
        type: 'order.created',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-1',
        data: { orderId: '123' },
      };

      const error = new Error('Failed');
      entryId = await dlq.add(event, error, 3);
    });

    it('should replay event with registered handler', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      dlq.registerReplayHandler('order.created', handler);

      await dlq.replay(entryId);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'evt-replay' }),
      );

      const entry = await dlq.getById(entryId);
      expect(entry?.status).toBe('resolved');
    });

    it('should throw error if no handler registered', async () => {
      await expect(dlq.replay(entryId)).rejects.toThrow(EventBusError);
    });

    it('should throw error if replay handler fails', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Handler failed'));
      dlq.registerReplayHandler('order.created', handler);

      await expect(dlq.replay(entryId)).rejects.toThrow(EventBusError);
    });

    it('should throw error for non-existent entry', async () => {
      const handler = vi.fn();
      dlq.registerReplayHandler('order.created', handler);

      await expect(dlq.replay('non-existent')).rejects.toThrow(EventBusError);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      const events: BaseEvent[] = [];

      for (let i = 0; i < 3; i++) {
        events.push({
          id: `evt-${i}`,
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          correlationId: `corr-${i}`,
          data: { orderId: String(i) },
        });
      }

      const error = new Error('Failed');

      const id1 = await dlq.add(events[0], error, 3);
      const id2 = await dlq.add(events[1], error, 3);
      await dlq.add(events[2], error, 3);

      await dlq.resolve(id1);
      await dlq.ignore(id2);
    });

    it('should get DLQ statistics', async () => {
      const stats = await dlq.getStats();

      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.resolved).toBe(1);
      expect(stats.ignored).toBe(1);
      expect(stats.oldestPending).toBeDefined();
      expect(stats.latestAt).toBeDefined();
    });

    it('should handle empty DLQ statistics', async () => {
      const emptyDlq = createInMemoryDeadLetterQueue();
      const stats = await emptyDlq.getStats();

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.resolved).toBe(0);
      expect(stats.ignored).toBe(0);
      expect(stats.oldestPending).toBeUndefined();
      expect(stats.latestAt).toBeUndefined();
    });
  });

  describe('Purge Operations', () => {
    beforeEach(async () => {
      const now = Date.now();
      const error = new Error('Failed');

      // Use fake timers to backdate the "old" entry's createdAt.
      // The implementation sets createdAt = new Date() inside add(),
      // so we must control the clock to make the entry genuinely old.
      vi.useFakeTimers();
      vi.setSystemTime(new Date(now - 2 * 24 * 60 * 60 * 1000)); // 2 days ago

      const oldEvent: BaseEvent = {
        id: 'evt-old',
        type: 'order.created',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-1',
        data: { orderId: '123' },
      };
      await dlq.add(oldEvent, error, 3);

      vi.setSystemTime(new Date(now)); // restore to "now"

      const newEvent: BaseEvent = {
        id: 'evt-new',
        type: 'order.created',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-2',
        data: { orderId: '456' },
      };
      await dlq.add(newEvent, error, 3);

      vi.useRealTimers();
    });

    it('should get entries older than threshold', async () => {
      // The old entry was created 2 days ago, so getOlderThan(1) should find it
      const old = await dlq.getOlderThan(1);

      expect(old.length).toBeGreaterThan(0);
    });

    it('should archive old entries', async () => {
      // Archive entries created before 1 day ago
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const archived = await dlq.archive(oneDayAgo);

      expect(archived).toBe(1);

      const stats = await dlq.getStats();
      expect(stats.total).toBe(1);
    });
  });

  describe('Factory', () => {
    it('should get or create default DLQ', () => {
      const dlq1 = DeadLetterQueueFactory.get('memory');
      const dlq2 = DeadLetterQueueFactory.get('memory');

      expect(dlq1).toBe(dlq2);
    });

    it('should throw error for unregistered DLQ', () => {
      expect(() => DeadLetterQueueFactory.get('unknown')).toThrow();
    });

    it('should register custom DLQ', () => {
      const customDlq = createInMemoryDeadLetterQueue();
      DeadLetterQueueFactory.register('custom', customDlq);

      const retrieved = DeadLetterQueueFactory.get('custom');
      expect(retrieved).toBe(customDlq);
    });

    it('should clear all DLQs', () => {
      DeadLetterQueueFactory.register('test', createInMemoryDeadLetterQueue());

      DeadLetterQueueFactory.clear();

      expect(() => DeadLetterQueueFactory.get('test')).toThrow();
    });
  });
});

describe('DeadLetterAlertHandler', () => {
  let dlq: InMemoryDeadLetterQueue;
  let alertHandler: DeadLetterAlertHandler;

  beforeEach(async () => {
    dlq = createInMemoryDeadLetterQueue();
    alertHandler = new DeadLetterAlertHandler(dlq, 5);
  });

  it('should trigger alert when threshold exceeded', async () => {
    const alertCallback = vi.fn();
    alertHandler.setAlertCallback(alertCallback);

    const error = new Error('Failed');

    for (let i = 0; i < 6; i++) {
      const event: BaseEvent = {
        id: `evt-${i}`,
        type: 'order.created',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: `corr-${i}`,
        data: { orderId: String(i) },
      };

      await dlq.add(event, error, 3);
    }

    await alertHandler.check();

    expect(alertCallback).toHaveBeenCalledWith(
      expect.objectContaining({ pending: 6 }),
    );
  });

  it('should not trigger alert when below threshold', async () => {
    const alertCallback = vi.fn();
    alertHandler.setAlertCallback(alertCallback);

    const error = new Error('Failed');

    for (let i = 0; i < 3; i++) {
      const event: BaseEvent = {
        id: `evt-${i}`,
        type: 'order.created',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: `corr-${i}`,
        data: { orderId: String(i) },
      };

      await dlq.add(event, error, 3);
    }

    await alertHandler.check();

    expect(alertCallback).not.toHaveBeenCalled();
  });

  it('should set custom threshold', async () => {
    alertHandler.setThreshold(10);

    const alertCallback = vi.fn();
    alertHandler.setAlertCallback(alertCallback);

    const error = new Error('Failed');

    for (let i = 0; i < 6; i++) {
      const event: BaseEvent = {
        id: `evt-${i}`,
        type: 'order.created',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: `corr-${i}`,
        data: { orderId: String(i) },
      };

      await dlq.add(event, error, 3);
    }

    await alertHandler.check();

    // Should not trigger with higher threshold
    expect(alertCallback).not.toHaveBeenCalled();
  });
});
