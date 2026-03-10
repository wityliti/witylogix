/**
 * Event Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryEventStore,
  EventStoreFactory,
  createInMemoryEventStore,
} from '../event-store.js';
import { BaseEvent } from '../types.js';

describe('InMemoryEventStore', () => {
  let store: InMemoryEventStore;

  beforeEach(() => {
    store = createInMemoryEventStore();
  });

  describe('Append Operations', () => {
    it('should append a single event', async () => {
      const event: BaseEvent = {
        id: 'evt-1',
        type: 'order.created',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-1',
        data: { orderId: '123' },
      };

      await store.append(event);

      const stored = store.getAllEvents();
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('evt-1');
    });

    it('should append multiple events in batch', async () => {
      const events: BaseEvent[] = [
        {
          id: 'evt-1',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          correlationId: 'corr-1',
          data: { orderId: '123' },
        },
        {
          id: 'evt-2',
          type: 'order.updated',
          source: 'api',
          timestamp: new Date().toISOString(),
          correlationId: 'corr-1',
          data: { orderId: '123', status: 'processed' },
        },
      ];

      await store.appendBatch(events);

      const stored = store.getAllEvents();
      expect(stored).toHaveLength(2);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      const now = new Date();
      const events: BaseEvent[] = [
        {
          id: 'evt-1',
          type: 'order.created',
          source: 'api',
          timestamp: now.toISOString(),
          correlationId: 'corr-1',
          data: { orderId: '123' },
        },
        {
          id: 'evt-2',
          type: 'order.updated',
          source: 'webhook',
          timestamp: new Date(now.getTime() + 1000).toISOString(),
          correlationId: 'corr-1',
          data: { orderId: '123', status: 'shipped' },
        },
        {
          id: 'evt-3',
          type: 'shipment.created',
          source: 'api',
          timestamp: new Date(now.getTime() + 2000).toISOString(),
          correlationId: 'corr-2',
          data: { shipmentId: '456' },
        },
      ];

      await store.appendBatch(events);
    });

    it('should query events by type', async () => {
      const result = await store.query({
        filter: { type: 'order.created' },
      });

      expect(result.total).toBe(1);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('order.created');
    });

    it('should query events with wildcard pattern', async () => {
      const result = await store.query({
        filter: { type: 'order.*' },
      });

      expect(result.total).toBe(2);
      expect(result.events).toHaveLength(2);
    });

    it('should query events by source', async () => {
      const result = await store.query({
        filter: { source: 'api' },
      });

      expect(result.total).toBe(2);
      expect(result.events.every((e) => e.source === 'api')).toBe(true);
    });

    it('should query events by correlation ID', async () => {
      const result = await store.query({
        filter: { correlationId: 'corr-1' },
      });

      expect(result.total).toBe(2);
      expect(result.events.every((e) => e.correlationId === 'corr-1')).toBe(
        true,
      );
    });

    it('should respect sort order', async () => {
      const ascResult = await store.query({
        filter: {},
        sortOrder: 'asc',
      });

      const descResult = await store.query({
        filter: {},
        sortOrder: 'desc',
      });

      expect(ascResult.events[0].id).toBe('evt-1');
      expect(descResult.events[0].id).toBe('evt-3');
    });

    it('should apply pagination', async () => {
      const page1 = await store.query({
        filter: { limit: 2, offset: 0 },
      });

      expect(page1.events).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await store.query({
        filter: { limit: 2, offset: 2 },
      });

      expect(page2.events).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });

    it('should filter by time range', async () => {
      const now = new Date();
      const startTime = new Date(now.getTime() - 500);
      const endTime = new Date(now.getTime() + 1500);

      const result = await store.query({
        filter: { startTime, endTime },
      });

      expect(result.events).toHaveLength(2);
    });
  });

  describe('Correlation ID Queries', () => {
    beforeEach(async () => {
      const events: BaseEvent[] = [
        {
          id: 'evt-1',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          correlationId: 'trace-123',
          data: { orderId: '123' },
        },
        {
          id: 'evt-2',
          type: 'order.updated',
          source: 'api',
          timestamp: new Date().toISOString(),
          correlationId: 'trace-123',
          data: { orderId: '123' },
        },
        {
          id: 'evt-3',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          correlationId: 'trace-456',
          data: { orderId: '456' },
        },
      ];

      await store.appendBatch(events);
    });

    it('should get events by correlation ID', async () => {
      const result = await store.getByCorrelationId('trace-123');

      expect(result).toHaveLength(2);
      expect(result.every((e) => e.correlationId === 'trace-123')).toBe(true);
    });

    it('should respect pagination in correlation query', async () => {
      const result = await store.getByCorrelationId('trace-123', {
        limit: 1,
        offset: 0,
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('Source and Time Queries', () => {
    beforeEach(async () => {
      const now = new Date();
      const events: BaseEvent[] = [
        {
          id: 'evt-1',
          type: 'order.created',
          source: 'api',
          timestamp: now.toISOString(),
          correlationId: 'corr-1',
          data: { orderId: '123' },
        },
        {
          id: 'evt-2',
          type: 'order.updated',
          source: 'api',
          timestamp: new Date(now.getTime() + 1000).toISOString(),
          correlationId: 'corr-1',
          data: { orderId: '123' },
        },
        {
          id: 'evt-3',
          type: 'shipment.created',
          source: 'warehouse',
          timestamp: new Date(now.getTime() + 2000).toISOString(),
          correlationId: 'corr-2',
          data: { shipmentId: '456' },
        },
      ];

      await store.appendBatch(events);
    });

    it('should query by source and time range', async () => {
      const now = new Date();
      const startTime = new Date(now.getTime() - 1000);
      const endTime = new Date(now.getTime() + 1500);

      const result = await store.getBySourceAndTime('api', startTime, endTime);

      expect(result).toHaveLength(2);
      expect(result.every((e) => e.source === 'api')).toBe(true);
    });
  });

  describe('Replay', () => {
    beforeEach(async () => {
      const now = new Date();
      const events: BaseEvent[] = [];

      for (let i = 0; i < 5; i++) {
        events.push({
          id: `evt-${i}`,
          type: 'order.created',
          source: 'api',
          timestamp: new Date(now.getTime() + i * 100).toISOString(),
          correlationId: 'corr-1',
          data: { orderId: String(i) },
        });
      }

      await store.appendBatch(events);
    });

    it('should replay events in order', async () => {
      const replayed: BaseEvent[] = [];

      for await (const event of store.replay({})) {
        replayed.push(event);
      }

      expect(replayed).toHaveLength(5);
      expect(replayed[0].id).toBe('evt-0');
      expect(replayed[4].id).toBe('evt-4');
    });

    it('should replay with batch size', async () => {
      const replayed: BaseEvent[] = [];

      for await (const event of store.replay({ batchSize: 2 })) {
        replayed.push(event);
      }

      expect(replayed).toHaveLength(5);
    });
  });

  describe('Single Event Retrieval', () => {
    beforeEach(async () => {
      const event: BaseEvent = {
        id: 'evt-find',
        type: 'order.created',
        source: 'api',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-1',
        data: { orderId: '123' },
      };

      await store.append(event);
    });

    it('should get event by ID', async () => {
      const event = await store.getById('evt-find');

      expect(event).not.toBeNull();
      expect(event?.id).toBe('evt-find');
    });

    it('should return null for non-existent event', async () => {
      const event = await store.getById('non-existent');

      expect(event).toBeNull();
    });

    it('should get latest event by entity ID', async () => {
      const events: BaseEvent[] = [
        {
          id: 'evt-1',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          correlationId: 'corr-1',
          data: { orderId: '123', status: 'created' },
        },
        {
          id: 'evt-2',
          type: 'order.updated',
          source: 'api',
          timestamp: new Date(Date.now() + 1000).toISOString(),
          correlationId: 'corr-1',
          data: { orderId: '123', status: 'updated' },
        },
      ];

      await store.appendBatch(events);

      const latest = await store.getLatestByEntityId('order', '123');

      expect(latest?.id).toBe('evt-2');
    });
  });

  describe('Purge Operations', () => {
    beforeEach(async () => {
      const now = new Date();
      const events: BaseEvent[] = [
        {
          id: 'evt-old',
          type: 'order.created',
          source: 'api',
          timestamp: new Date(now.getTime() - 100000).toISOString(),
          correlationId: 'corr-1',
          data: { orderId: '123' },
        },
        {
          id: 'evt-new',
          type: 'order.created',
          source: 'api',
          timestamp: now.toISOString(),
          correlationId: 'corr-1',
          data: { orderId: '456' },
        },
      ];

      await store.appendBatch(events);
    });

    it('should purge old events', async () => {
      const now = new Date();
      const threshold = new Date(now.getTime() - 50000);

      const purged = await store.purgeOldEvents(threshold);

      expect(purged).toBe(1);

      const remaining = store.getAllEvents();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('evt-new');
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      const now = new Date();
      const events: BaseEvent[] = [
        {
          id: 'evt-1',
          type: 'order.created',
          source: 'api',
          timestamp: now.toISOString(),
          correlationId: 'corr-1',
          data: { orderId: '123' },
        },
        {
          id: 'evt-2',
          type: 'order.updated',
          source: 'api',
          timestamp: new Date(now.getTime() + 1000).toISOString(),
          correlationId: 'corr-1',
          data: { orderId: '123' },
        },
        {
          id: 'evt-3',
          type: 'shipment.created',
          source: 'warehouse',
          timestamp: new Date(now.getTime() + 2000).toISOString(),
          correlationId: 'corr-2',
          data: { shipmentId: '456' },
        },
      ];

      await store.appendBatch(events);
    });

    it('should get store statistics', async () => {
      const stats = await store.getStats();

      expect(stats.totalEvents).toBe(3);
      expect(stats.oldestEvent).toBeDefined();
      expect(stats.newestEvent).toBeDefined();
      expect(stats.eventsByType['order.created']).toBe(1);
      expect(stats.eventsByType['order.updated']).toBe(1);
      expect(stats.eventsByType['shipment.created']).toBe(1);
      expect(stats.eventsBySource.api).toBe(2);
      expect(stats.eventsBySource.warehouse).toBe(1);
    });

    it('should handle empty store statistics', async () => {
      const emptyStore = createInMemoryEventStore();
      const stats = await emptyStore.getStats();

      expect(stats.totalEvents).toBe(0);
      expect(stats.oldestEvent).toBeUndefined();
      expect(stats.newestEvent).toBeUndefined();
    });
  });

  describe('Factory', () => {
    it('should get or create default store', () => {
      const store1 = EventStoreFactory.get('memory');
      const store2 = EventStoreFactory.get('memory');

      expect(store1).toBe(store2);
    });

    it('should throw error for unregistered store', () => {
      expect(() => EventStoreFactory.get('unknown')).toThrow();
    });

    it('should register custom store', () => {
      const customStore = createInMemoryEventStore();
      EventStoreFactory.register('custom', customStore);

      const retrieved = EventStoreFactory.get('custom');
      expect(retrieved).toBe(customStore);
    });

    it('should clear all stores', () => {
      EventStoreFactory.register('test', createInMemoryEventStore());

      EventStoreFactory.clear();

      expect(() => EventStoreFactory.get('test')).toThrow();
    });
  });
});
