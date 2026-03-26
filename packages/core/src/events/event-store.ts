/**
 * Event Store Module
 *
 * Persistent event storage for:
 * - Event sourcing / audit trail
 * - Event replay for downstream services
 * - Temporal queries (events by time range, source, correlation)
 * - Schema evolution and versioning
 * - Retention policies
 */

import {
  BaseEvent,
  EventFilter,
  EventStoreQueryOptions,
  EventStoreQueryResult,
  EventBusError,
} from './types.js';

/**
 * Event Store Interface
 * Implementations can use Postgres, MongoDB, etc.
 */
export interface IEventStore {
  /**
   * Append an event to the store
   */
  append(event: BaseEvent): Promise<void>;

  /**
   * Append multiple events atomically
   */
  appendBatch(events: BaseEvent[]): Promise<void>;

  /**
   * Query events with filtering and pagination
   */
  query(opts: EventStoreQueryOptions): Promise<EventStoreQueryResult>;

  /**
   * Get events by correlation ID (trace related events)
   */
  getByCorrelationId(
    correlationId: string,
    opts?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<BaseEvent[]>;

  /**
   * Get events by source and time range
   */
  getBySourceAndTime(
    source: string,
    startTime: Date,
    endTime: Date,
    opts?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<BaseEvent[]>;

  /**
   * Replay events in order (for event sourcing)
   */
  replay(
    opts: {
      fromTimestamp?: Date;
      toTimestamp?: Date;
      batchSize?: number;
    },
  ): AsyncIterator<BaseEvent>;

  /**
   * Get event by ID
   */
  getById(eventId: string): Promise<BaseEvent | null>;

  /**
   * Get latest event for an entity
   */
  getLatestByEntityId(
    entityType: string,
    entityId: string,
  ): Promise<BaseEvent | null>;

  /**
   * Delete old events based on retention policy
   */
  purgeOldEvents(beforeDate: Date): Promise<number>;

  /**
   * Get statistics about stored events
   */
  getStats(): Promise<{
    totalEvents: number;
    oldestEvent?: Date;
    newestEvent?: Date;
    eventsByType: Record<string, number>;
    eventsBySource: Record<string, number>;
  }>;
}

/**
 * In-memory event store (for testing/development)
 */
export class InMemoryEventStore implements IEventStore {
  private events: BaseEvent[] = [];

  async append(event: BaseEvent): Promise<void> {
    this.events.push(event);
  }

  async appendBatch(events: BaseEvent[]): Promise<void> {
    this.events.push(...events);
  }

  async query(opts: EventStoreQueryOptions): Promise<EventStoreQueryResult> {
    const filter = opts.filter;
    let results = [...this.events];

    // Apply filters
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      results = results.filter((e) =>
        types.some((t) => this.patternMatch(e.type, t)),
      );
    }

    if (filter.source) {
      results = results.filter((e) => e.source === filter.source);
    }

    if (filter.correlationId) {
      results = results.filter(
        (e) => e.correlationId === filter.correlationId,
      );
    }

    if (filter.startTime) {
      results = results.filter(
        (e) => new Date(e.timestamp) >= filter.startTime!,
      );
    }

    if (filter.endTime) {
      results = results.filter((e) => new Date(e.timestamp) <= filter.endTime!);
    }

    if (filter.metadata) {
      results = results.filter((e) => {
        if (!e.metadata) return false;
        return Object.entries(filter.metadata!).every(
          ([key, value]) => e.metadata![key] === value,
        );
      });
    }

    // Sort
    const sortOrder = opts.sortOrder || 'desc';
    results.sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
    });

    // Paginate
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    const total = results.length;
    const paginated = results.slice(offset, offset + limit);

    return {
      events: paginated,
      total,
      hasMore: offset + limit < total,
      cursor: offset + limit < total ? (offset + limit).toString() : undefined,
    };
  }

  async getByCorrelationId(
    correlationId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<BaseEvent[]> {
    let results = this.events.filter(
      (e) => e.correlationId === correlationId,
    );

    const offset = opts?.offset || 0;
    const limit = opts?.limit || 100;

    return results.slice(offset, offset + limit);
  }

  async getBySourceAndTime(
    source: string,
    startTime: Date,
    endTime: Date,
    opts?: { limit?: number; offset?: number },
  ): Promise<BaseEvent[]> {
    let results = this.events.filter(
      (e) =>
        e.source === source &&
        new Date(e.timestamp) >= startTime &&
        new Date(e.timestamp) <= endTime,
    );

    const offset = opts?.offset || 0;
    const limit = opts?.limit || 100;

    return results.slice(offset, offset + limit);
  }

  async *replay(opts: {
    fromTimestamp?: Date;
    toTimestamp?: Date;
    batchSize?: number;
  }): AsyncIterator<BaseEvent> {
    let results = [...this.events];

    if (opts.fromTimestamp) {
      results = results.filter((e) => new Date(e.timestamp) >= opts.fromTimestamp!);
    }

    if (opts.toTimestamp) {
      results = results.filter((e) => new Date(e.timestamp) <= opts.toTimestamp!);
    }

    results.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    const batchSize = opts.batchSize || 100;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      for (const event of batch) {
        yield event;
      }
    }
  }

  async getById(eventId: string): Promise<BaseEvent | null> {
    return this.events.find((e) => e.id === eventId) || null;
  }

  async getLatestByEntityId(
    entityType: string,
    entityId: string,
  ): Promise<BaseEvent | null> {
    // Look for events where data contains the entity reference
    const results = this.events.filter(
      (e) => e.data[`${entityType}Id`] === entityId,
    );

    if (results.length === 0) return null;

    results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return results[0];
  }

  async purgeOldEvents(beforeDate: Date): Promise<number> {
    const initialLength = this.events.length;
    this.events = this.events.filter(
      (e) => new Date(e.timestamp) >= beforeDate,
    );
    return initialLength - this.events.length;
  }

  async getStats(): Promise<{
    totalEvents: number;
    oldestEvent?: Date;
    newestEvent?: Date;
    eventsByType: Record<string, number>;
    eventsBySource: Record<string, number>;
  }> {
    const eventsByType: Record<string, number> = {};
    const eventsBySource: Record<string, number> = {};
    let oldest: Date | undefined;
    let newest: Date | undefined;

    for (const event of this.events) {
      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;

      // Count by source
      eventsBySource[event.source] = (eventsBySource[event.source] || 0) + 1;

      // Track time range
      const eventTime = new Date(event.timestamp);
      if (!oldest || eventTime < oldest) oldest = eventTime;
      if (!newest || eventTime > newest) newest = eventTime;
    }

    return {
      totalEvents: this.events.length,
      oldestEvent: oldest,
      newestEvent: newest,
      eventsByType,
      eventsBySource,
    };
  }

  /**
   * Clear all events (testing)
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get all events (testing)
   */
  getAllEvents(): BaseEvent[] {
    return [...this.events];
  }

  /**
   * Pattern matcher for event types (supports wildcards)
   */
  private patternMatch(eventType: string, pattern: string): boolean {
    const regex = new RegExp(
      `^${pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')}$`,
    );
    return regex.test(eventType);
  }
}

/**
 * Event Store Factory for different backends
 */
export class EventStoreFactory {
  private static stores: Map<string, IEventStore> = new Map();

  /**
   * Register a store implementation
   */
  static register(name: string, store: IEventStore): void {
    this.stores.set(name, store);
  }

  /**
   * Get or create a store
   */
  static get(name: string = 'memory'): IEventStore {
    if (!this.stores.has(name)) {
      if (name === 'memory') {
        this.stores.set(name, new InMemoryEventStore());
      } else {
        throw new EventBusError(
          'STORE_NOT_FOUND',
          `Event store '${name}' not registered`,
        );
      }
    }
    return this.stores.get(name)!;
  }

  /**
   * Clear all registered stores
   */
  static clear(): void {
    this.stores.clear();
  }
}

/**
 * Convenience function to get default event store
 */
export function getEventStore(): IEventStore {
  return EventStoreFactory.get('memory');
}

/**
 * Create in-memory event store
 */
export function createInMemoryEventStore(): InMemoryEventStore {
  return new InMemoryEventStore();
}
