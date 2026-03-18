/**
 * Dead Letter Queue Implementation Tests
 * Tests DLQ functionality: failed event handling, retry exhaustion, metrics tracking
 * ~400 lines
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ───────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ───────────────────────────────────────────────────────────────────────────

export interface EventMetadata {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  tenantId: string;
  correlationId: string;
  version: number;
  userId?: string;
  requestId?: string;
  tags?: Record<string, string>;
}

export interface EventEnvelope<T = unknown> {
  metadata: EventMetadata;
  data: T;
}

export interface DeadLetterEvent {
  originalEventId: string;
  eventType: string;
  envelopeData: EventEnvelope;
  errorMessage: string;
  errorStack?: string;
  failureCount: number;
  firstFailureAt: Date;
  lastFailureAt: Date;
  metadata: {
    tenantId: string;
    source: string;
    retriesExhausted: boolean;
    causeChain: Array<{
      error: string;
      timestamp: Date;
    }>;
  };
}

export interface DLQMetrics {
  totalEventsInDLQ: number;
  eventsByType: Record<string, number>;
  eventsByTenant: Record<string, number>;
  oldestEventAge: number;
  recentFailures: number;
}

export interface DeadLetterQueue {
  addFailedEvent(envelope: EventEnvelope, error: Error, retryCount: number): Promise<void>;
  getMetrics(): DLQMetrics;
  getEventsByType(eventType: string): DeadLetterEvent[];
  getEventsByTenant(tenantId: string): DeadLetterEvent[];
  replayEvent(dlqEventId: string): Promise<void>;
  deleteEvent(dlqEventId: string): Promise<void>;
  getSize(): number;
}

export interface EventStream {
  publish(streamKey: string, event: DeadLetterEvent): Promise<string>;
  getStreamMetrics(streamKey: string): Promise<{ size: number; events: DeadLetterEvent[] }>;
}

// ───────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION
// ───────────────────────────────────────────────────────────────────────────

class InMemoryEventStream implements EventStream {
  private streams: Map<string, DeadLetterEvent[]> = new Map();

  async publish(streamKey: string, event: DeadLetterEvent): Promise<string> {
    if (!this.streams.has(streamKey)) {
      this.streams.set(streamKey, []);
    }
    this.streams.get(streamKey)!.push(event);
    return `dlq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async getStreamMetrics(streamKey: string): Promise<{ size: number; events: DeadLetterEvent[] }> {
    const events = this.streams.get(streamKey) || [];
    return { size: events.length, events: [...events] };
  }

  getAllEvents(): DeadLetterEvent[] {
    const allEvents: DeadLetterEvent[] = [];
    this.streams.forEach((events) => {
      allEvents.push(...events);
    });
    return allEvents;
  }

  clearAll(): void {
    this.streams.clear();
  }
}

class DeadLetterQueueImpl implements DeadLetterQueue {
  private dlqEvents: Record<string, DeadLetterEvent> = {};
  private eventStream: EventStream;
  private dlqIdCounter = 0;

  constructor(eventStream: EventStream) {
    this.eventStream = eventStream;
  }

  async addFailedEvent(
    envelope: EventEnvelope,
    error: Error,
    retryCount: number
  ): Promise<void> {
    const dlqEventId = `dlq-${++this.dlqIdCounter}`;
    const now = new Date();

    const dlqEvent: DeadLetterEvent = {
      originalEventId: envelope.metadata.id,
      eventType: envelope.metadata.type,
      envelopeData: envelope,
      errorMessage: error.message,
      errorStack: error.stack,
      failureCount: retryCount,
      firstFailureAt: now,
      lastFailureAt: now,
      metadata: {
        tenantId: envelope.metadata.tenantId,
        source: envelope.metadata.source,
        retriesExhausted: true,
        causeChain: [
          {
            error: error.message,
            timestamp: now,
          },
        ],
      },
    };

    this.dlqEvents[dlqEventId] = dlqEvent;

    // Publish to event stream
    const streamKey = `dlq:${envelope.metadata.type}`;
    await this.eventStream.publish(streamKey, dlqEvent);
  }

  getMetrics(): DLQMetrics {
    const events = Object.values(this.dlqEvents);
    const eventsByType: Record<string, number> = {};
    const eventsByTenant: Record<string, number> = {};
    let oldestEventAge = 0;

    for (const event of events) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      eventsByTenant[event.metadata.tenantId] =
        (eventsByTenant[event.metadata.tenantId] || 0) + 1;

      const age = Date.now() - event.firstFailureAt.getTime();
      if (age > oldestEventAge) {
        oldestEventAge = age;
      }
    }

    const oneHourAgo = Date.now() - 3600000;
    const recentFailures = events.filter(
      (e) => e.lastFailureAt.getTime() > oneHourAgo
    ).length;

    return {
      totalEventsInDLQ: events.length,
      eventsByType,
      eventsByTenant,
      oldestEventAge,
      recentFailures,
    };
  }

  getEventsByType(eventType: string): DeadLetterEvent[] {
    return Object.values(this.dlqEvents).filter(
      (e) => e.eventType === eventType
    );
  }

  getEventsByTenant(tenantId: string): DeadLetterEvent[] {
    return Object.values(this.dlqEvents).filter(
      (e) => e.metadata.tenantId === tenantId
    );
  }

  async replayEvent(dlqEventId: string): Promise<void> {
    const dlqEvent = this.dlqEvents[dlqEventId];
    if (!dlqEvent) {
      throw new Error(`DLQ event not found: ${dlqEventId}`);
    }
    // In a real implementation, this would requeue the event for processing
    // For testing, we just verify it exists
  }

  async deleteEvent(dlqEventId: string): Promise<void> {
    if (!(dlqEventId in this.dlqEvents)) {
      throw new Error(`DLQ event not found: ${dlqEventId}`);
    }
    delete this.dlqEvents[dlqEventId];
  }

  getSize(): number {
    return Object.keys(this.dlqEvents).length;
  }

  getAllEvents(): DeadLetterEvent[] {
    return Object.values(this.dlqEvents);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ───────────────────────────────────────────────────────────────────────────

describe('Dead Letter Queue (DLQ)', () => {
  let dlq: DeadLetterQueueImpl;
  let eventStream: InMemoryEventStream;

  beforeEach(() => {
    eventStream = new InMemoryEventStream();
    dlq = new DeadLetterQueueImpl(eventStream);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FAILED EVENTS GO TO DLQ AFTER RETRY EXHAUSTION
  // ─────────────────────────────────────────────────────────────────────────

  describe('Failed Events Go to DLQ After Retry Exhaustion', () => {
    it('should add failed event to DLQ after exhausting retries', async () => {
      const envelope: EventEnvelope = {
        metadata: {
          id: 'evt-1',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-1',
          version: 1,
        },
        data: { orderId: '123', amount: 100 },
      };

      const error = new Error('Database connection failed');
      const retryCount = 3;

      await dlq.addFailedEvent(envelope, error, retryCount);

      expect(dlq.getSize()).toBe(1);
    });

    it('should preserve original event data in DLQ', async () => {
      const envelope: EventEnvelope = {
        metadata: {
          id: 'evt-2',
          type: 'order.updated',
          source: 'webhook',
          timestamp: '2024-02-01T10:00:00Z',
          tenantId: 'shop-2',
          correlationId: 'corr-2',
          version: 1,
        },
        data: { orderId: '456', status: 'shipped' },
      };

      const error = new Error('Service unavailable');

      await dlq.addFailedEvent(envelope, error, 3);

      const dlqEvents = dlq.getAllEvents();
      expect(dlqEvents).toHaveLength(1);
      expect(dlqEvents[0].originalEventId).toBe('evt-2');
      expect(dlqEvents[0].eventType).toBe('order.updated');
      expect(dlqEvents[0].envelopeData.data.orderId).toBe('456');
    });

    it('should capture error details in DLQ entry', async () => {
      const envelope: EventEnvelope = {
        metadata: {
          id: 'evt-3',
          type: 'delivery.completed',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-3',
          correlationId: 'corr-3',
          version: 1,
        },
        data: { deliveryId: '789' },
      };

      const error = new Error('Network timeout after 30s');
      error.stack = 'Error: Network timeout after 30s\n  at handler.ts:50';

      await dlq.addFailedEvent(envelope, error, 5);

      const dlqEvents = dlq.getAllEvents();
      expect(dlqEvents[0].errorMessage).toBe('Network timeout after 30s');
      expect(dlqEvents[0].errorStack).toBeDefined();
      expect(dlqEvents[0].failureCount).toBe(5);
    });

    it('should mark retries as exhausted', async () => {
      const envelope: EventEnvelope = {
        metadata: {
          id: 'evt-4',
          type: 'customer.registered',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-4',
          correlationId: 'corr-4',
          version: 1,
        },
        data: { customerId: '999' },
      };

      const error = new Error('Permanent error');

      await dlq.addFailedEvent(envelope, error, 3);

      const dlqEvents = dlq.getAllEvents();
      expect(dlqEvents[0].metadata.retriesExhausted).toBe(true);
    });

    it('should track failure timestamps', async () => {
      const envelope: EventEnvelope = {
        metadata: {
          id: 'evt-5',
          type: 'payment.processed',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-5',
          correlationId: 'corr-5',
          version: 1,
        },
        data: { paymentId: '555' },
      };

      const error = new Error('Payment gateway error');
      const beforeTime = Date.now();

      await dlq.addFailedEvent(envelope, error, 2);

      const afterTime = Date.now();
      const dlqEvents = dlq.getAllEvents();
      const failureTime = dlqEvents[0].firstFailureAt.getTime();

      expect(failureTime).toBeGreaterThanOrEqual(beforeTime);
      expect(failureTime).toBeLessThanOrEqual(afterTime);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DLQ COUNTER INCREMENTS PER EVENT TYPE
  // ─────────────────────────────────────────────────────────────────────────

  describe('DLQ Counter Increments Per Event Type', () => {
    it('should increment counter for order.created events', async () => {
      const envelope1: EventEnvelope = {
        metadata: {
          id: 'evt-6',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-6',
          version: 1,
        },
        data: { orderId: '1' },
      };

      const envelope2: EventEnvelope = {
        metadata: {
          id: 'evt-7',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-7',
          version: 1,
        },
        data: { orderId: '2' },
      };

      const error = new Error('Failed');

      await dlq.addFailedEvent(envelope1, error, 3);
      await dlq.addFailedEvent(envelope2, error, 3);

      const metrics = dlq.getMetrics();
      expect(metrics.eventsByType['order.created']).toBe(2);
    });

    it('should track different event types separately', async () => {
      const error = new Error('Failed');

      const orderEnvelope: EventEnvelope = {
        metadata: {
          id: 'evt-8',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-8',
          version: 1,
        },
        data: {},
      };

      const deliveryEnvelope: EventEnvelope = {
        metadata: {
          id: 'evt-9',
          type: 'delivery.started',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-9',
          version: 1,
        },
        data: {},
      };

      const paymentEnvelope: EventEnvelope = {
        metadata: {
          id: 'evt-10',
          type: 'payment.processed',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-10',
          version: 1,
        },
        data: {},
      };

      await dlq.addFailedEvent(orderEnvelope, error, 3);
      await dlq.addFailedEvent(deliveryEnvelope, error, 3);
      await dlq.addFailedEvent(paymentEnvelope, error, 3);

      const metrics = dlq.getMetrics();
      expect(metrics.eventsByType['order.created']).toBe(1);
      expect(metrics.eventsByType['delivery.started']).toBe(1);
      expect(metrics.eventsByType['payment.processed']).toBe(1);
      expect(metrics.totalEventsInDLQ).toBe(3);
    });

    it('should retrieve events by type', async () => {
      const error = new Error('Failed');

      for (let i = 0; i < 3; i++) {
        const envelope: EventEnvelope = {
          metadata: {
            id: `evt-${11 + i}`,
            type: 'order.created',
            source: 'api',
            timestamp: new Date().toISOString(),
            tenantId: 'shop-1',
            correlationId: `corr-${11 + i}`,
            version: 1,
          },
          data: {},
        };
        await dlq.addFailedEvent(envelope, error, 3);
      }

      for (let i = 0; i < 2; i++) {
        const envelope: EventEnvelope = {
          metadata: {
            id: `evt-${20 + i}`,
            type: 'delivery.completed',
            source: 'api',
            timestamp: new Date().toISOString(),
            tenantId: 'shop-1',
            correlationId: `corr-${20 + i}`,
            version: 1,
          },
          data: {},
        };
        await dlq.addFailedEvent(envelope, error, 3);
      }

      const orderEvents = dlq.getEventsByType('order.created');
      const deliveryEvents = dlq.getEventsByType('delivery.completed');

      expect(orderEvents).toHaveLength(3);
      expect(deliveryEvents).toHaveLength(2);
      expect(orderEvents.every((e) => e.eventType === 'order.created')).toBe(true);
      expect(deliveryEvents.every((e) => e.eventType === 'delivery.completed')).toBe(true);
    });

    it('should filter by multiple event types correctly', async () => {
      const error = new Error('Failed');

      const eventTypes = ['order.created', 'order.updated', 'payment.processed'];

      for (const eventType of eventTypes) {
        const envelope: EventEnvelope = {
          metadata: {
            id: `evt-${eventType}`,
            type: eventType,
            source: 'api',
            timestamp: new Date().toISOString(),
            tenantId: 'shop-1',
            correlationId: `corr-${eventType}`,
            version: 1,
          },
          data: {},
        };
        await dlq.addFailedEvent(envelope, error, 3);
      }

      const metrics = dlq.getMetrics();
      expect(Object.keys(metrics.eventsByType)).toHaveLength(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET_METRICS RETURNS CORRECT DLQ SIZE
  // ─────────────────────────────────────────────────────────────────────────

  describe('getMetrics() Returns Correct DLQ Size', () => {
    it('should return total events count', async () => {
      const error = new Error('Failed');

      for (let i = 0; i < 5; i++) {
        const envelope: EventEnvelope = {
          metadata: {
            id: `evt-${30 + i}`,
            type: 'order.created',
            source: 'api',
            timestamp: new Date().toISOString(),
            tenantId: 'shop-1',
            correlationId: `corr-${30 + i}`,
            version: 1,
          },
          data: {},
        };
        await dlq.addFailedEvent(envelope, error, 3);
      }

      const metrics = dlq.getMetrics();
      expect(metrics.totalEventsInDLQ).toBe(5);
    });

    it('should return breakdown by tenant', async () => {
      const error = new Error('Failed');

      const tenants = ['shop-1', 'shop-2', 'shop-3'];

      for (let i = 0; i < 3; i++) {
        for (const tenant of tenants) {
          const envelope: EventEnvelope = {
            metadata: {
              id: `evt-${40 + i}-${tenant}`,
              type: 'order.created',
              source: 'api',
              timestamp: new Date().toISOString(),
              tenantId: tenant,
              correlationId: `corr-${40 + i}-${tenant}`,
              version: 1,
            },
            data: {},
          };
          await dlq.addFailedEvent(envelope, error, 3);
        }
      }

      const metrics = dlq.getMetrics();
      expect(metrics.eventsByTenant['shop-1']).toBe(3);
      expect(metrics.eventsByTenant['shop-2']).toBe(3);
      expect(metrics.eventsByTenant['shop-3']).toBe(3);
    });

    it('should return oldest event age', async () => {
      const error = new Error('Failed');

      const envelope: EventEnvelope = {
        metadata: {
          id: 'evt-oldest',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-oldest',
          version: 1,
        },
        data: {},
      };

      await dlq.addFailedEvent(envelope, error, 3);

      const metrics = dlq.getMetrics();
      expect(metrics.oldestEventAge).toBeGreaterThanOrEqual(0);
      expect(metrics.oldestEventAge).toBeLessThan(1000); // Should be < 1s
    });

    it('should track recent failures within last hour', async () => {
      const error = new Error('Failed');

      const envelope: EventEnvelope = {
        metadata: {
          id: 'evt-recent',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-recent',
          version: 1,
        },
        data: {},
      };

      await dlq.addFailedEvent(envelope, error, 3);

      const metrics = dlq.getMetrics();
      expect(metrics.recentFailures).toBe(1);
    });

    it('should include breakdown by event type in metrics', async () => {
      const error = new Error('Failed');

      const types = ['order.created', 'delivery.started', 'payment.processed'];

      for (const type of types) {
        for (let i = 0; i < 2; i++) {
          const envelope: EventEnvelope = {
            metadata: {
              id: `evt-${type}-${i}`,
              type,
              source: 'api',
              timestamp: new Date().toISOString(),
              tenantId: 'shop-1',
              correlationId: `corr-${type}-${i}`,
              version: 1,
            },
            data: {},
          };
          await dlq.addFailedEvent(envelope, error, 3);
        }
      }

      const metrics = dlq.getMetrics();
      expect(metrics.eventsByType['order.created']).toBe(2);
      expect(metrics.eventsByType['delivery.started']).toBe(2);
      expect(metrics.eventsByType['payment.processed']).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DLQ STREAM RECEIVES FAILED EVENTS WITH ERROR DETAILS
  // ─────────────────────────────────────────────────────────────────────────

  describe('DLQ Stream Receives Failed Events With Error Details', () => {
    it('should publish failed event to stream', async () => {
      const envelope: EventEnvelope = {
        metadata: {
          id: 'evt-stream-1',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-stream-1',
          version: 1,
        },
        data: { orderId: '123' },
      };

      const error = new Error('Processing failed');
      await dlq.addFailedEvent(envelope, error, 3);

      const streamMetrics = await eventStream.getStreamMetrics('dlq:order.created');
      expect(streamMetrics.size).toBe(1);
      expect(streamMetrics.events[0].originalEventId).toBe('evt-stream-1');
    });

    it('should include error message in stream event', async () => {
      const envelope: EventEnvelope = {
        metadata: {
          id: 'evt-stream-2',
          type: 'delivery.started',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-stream-2',
          version: 1,
        },
        data: { deliveryId: '456' },
      };

      const error = new Error('Delivery service unreachable');
      await dlq.addFailedEvent(envelope, error, 2);

      const streamMetrics = await eventStream.getStreamMetrics('dlq:delivery.started');
      expect(streamMetrics.events[0].errorMessage).toBe('Delivery service unreachable');
    });

    it('should publish multiple failed events to correct streams', async () => {
      const error = new Error('Failed');

      const envelope1: EventEnvelope = {
        metadata: {
          id: 'evt-multi-1',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-multi-1',
          version: 1,
        },
        data: {},
      };

      const envelope2: EventEnvelope = {
        metadata: {
          id: 'evt-multi-2',
          type: 'payment.processed',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-multi-2',
          version: 1,
        },
        data: {},
      };

      await dlq.addFailedEvent(envelope1, error, 3);
      await dlq.addFailedEvent(envelope2, error, 3);

      const orderStream = await eventStream.getStreamMetrics('dlq:order.created');
      const paymentStream = await eventStream.getStreamMetrics('dlq:payment.processed');

      expect(orderStream.size).toBe(1);
      expect(paymentStream.size).toBe(1);
    });

    it('should include cause chain in stream event', async () => {
      const envelope: EventEnvelope = {
        metadata: {
          id: 'evt-cause',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-cause',
          version: 1,
        },
        data: {},
      };

      const error = new Error('Connection timeout');
      await dlq.addFailedEvent(envelope, error, 3);

      const streamMetrics = await eventStream.getStreamMetrics('dlq:order.created');
      const dlqEvent = streamMetrics.events[0];

      expect(dlqEvent.metadata.causeChain).toBeDefined();
      expect(dlqEvent.metadata.causeChain.length).toBeGreaterThan(0);
      expect(dlqEvent.metadata.causeChain[0].error).toBe('Connection timeout');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ADDITIONAL OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  describe('DLQ Operations - Replay and Delete', () => {
    it('should replay event from DLQ', async () => {
      const envelope: EventEnvelope = {
        metadata: {
          id: 'evt-replay',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-replay',
          version: 1,
        },
        data: { orderId: '789' },
      };

      const error = new Error('Failed');
      await dlq.addFailedEvent(envelope, error, 3);

      const dlqEvents = dlq.getAllEvents();
      const dlqEventId = Object.keys(dlq['dlqEvents'])[0];

      // Replay the event
      await expect(dlq.replayEvent(dlqEventId)).resolves.toBeUndefined();
    });

    it('should delete event from DLQ', async () => {
      const envelope: EventEnvelope = {
        metadata: {
          id: 'evt-delete',
          type: 'order.created',
          source: 'api',
          timestamp: new Date().toISOString(),
          tenantId: 'shop-1',
          correlationId: 'corr-delete',
          version: 1,
        },
        data: { orderId: '999' },
      };

      const error = new Error('Failed');
      await dlq.addFailedEvent(envelope, error, 3);

      expect(dlq.getSize()).toBe(1);

      const dlqEventId = Object.keys(dlq['dlqEvents'])[0];
      await dlq.deleteEvent(dlqEventId);

      expect(dlq.getSize()).toBe(0);
    });

    it('should throw error when deleting non-existent event', async () => {
      await expect(dlq.deleteEvent('non-existent')).rejects.toThrow('DLQ event not found');
    });

    it('should retrieve events by tenant', async () => {
      const error = new Error('Failed');

      for (let i = 0; i < 3; i++) {
        const envelope: EventEnvelope = {
          metadata: {
            id: `evt-tenant-1-${i}`,
            type: 'order.created',
            source: 'api',
            timestamp: new Date().toISOString(),
            tenantId: 'shop-1',
            correlationId: `corr-tenant-1-${i}`,
            version: 1,
          },
          data: {},
        };
        await dlq.addFailedEvent(envelope, error, 3);
      }

      for (let i = 0; i < 2; i++) {
        const envelope: EventEnvelope = {
          metadata: {
            id: `evt-tenant-2-${i}`,
            type: 'order.created',
            source: 'api',
            timestamp: new Date().toISOString(),
            tenantId: 'shop-2',
            correlationId: `corr-tenant-2-${i}`,
            version: 1,
          },
          data: {},
        };
        await dlq.addFailedEvent(envelope, error, 3);
      }

      const shop1Events = dlq.getEventsByTenant('shop-1');
      const shop2Events = dlq.getEventsByTenant('shop-2');

      expect(shop1Events).toHaveLength(3);
      expect(shop2Events).toHaveLength(2);
    });

    it('should handle empty DLQ operations gracefully', () => {
      const metrics = dlq.getMetrics();
      expect(metrics.totalEventsInDLQ).toBe(0);
      expect(Object.keys(metrics.eventsByType).length).toBe(0);
      expect(metrics.oldestEventAge).toBe(0);
    });
  });
});
