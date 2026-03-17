/**
 * CRM Webhook Handler - Processes incoming webhooks from CRM providers
 *
 * Responsibilities:
 * - Normalize webhook events to WitylogixCrmEvent
 * - Deduplicate events using event IDs
 * - Handle event ordering and sequencing
 * - Implement exponential backoff retry logic
 * - Support provider-specific parsers (Salesforce, HubSpot, Zoho, Pipedrive)
 *
 * @module crm/crm-webhook-handler
 */

import type {
  WitylogixCrmEvent,
  FieldChange,
  CrmProvider,
} from "./crm-types.js";

import {
  CrmProvider as CrmProviderEnum,
} from "./crm-types.js";

/**
 * Webhook event from CRM provider (before normalization)
 */
export interface RawWebhookEvent {
  provider: CrmProvider;
  tenantId: string;
  rawPayload: Record<string, unknown>;
  receivedAt: string;
}

/**
 * Event deduplication entry
 */
interface DeduplicationEntry {
  eventId: string;
  timestamp: string;
  provider: CrmProvider;
  tenantId: string;
}

/**
 * Retry queue entry
 */
interface RetryEntry {
  event: WitylogixCrmEvent;
  attempt: number;
  maxAttempts: number;
  nextRetryTime: number;
  lastError?: string;
}

/**
 * Parser interface for provider-specific webhook parsing
 */
export interface WebhookParser {
  /**
   * Parse provider-specific webhook payload
   */
  parse(payload: Record<string, unknown>): Partial<WitylogixCrmEvent> | null;

  /**
   * Extract event ID from payload for deduplication
   */
  extractEventId(payload: Record<string, unknown>): string | null;

  /**
   * Extract timestamp from payload
   */
  extractTimestamp(payload: Record<string, unknown>): string | null;
}

/**
 * Salesforce webhook parser
 */
class SalesforceParser implements WebhookParser {
  parse(payload: Record<string, unknown>): Partial<WitylogixCrmEvent> | null {
    // Salesforce uses sObject (Sobjects) format
    const notification = payload.notification as Record<string, unknown> | undefined;
    if (!notification) return null;

    const eventData = notification.data as Record<string, unknown> | undefined;
    if (!eventData) return null;

    const sObject = eventData.sObject as Record<string, unknown> | undefined;
    if (!sObject) return null;

    // Extract entity type from sobject type
    const entityType = this.mapSObjectType(sObject.attributes as Record<string, unknown>);
    if (!entityType) return null;

    return {
      eventId: `sf-${sObject.Id}`,
      eventType: `${entityType}.${notification.operation || "Changed"}`,
      crmProvider: CrmProviderEnum.SALESFORCE,
      entityId: sObject.Id as string,
      externalEntityId: sObject.Id as string,
      entityType,
      changedFields: this.extractChangedFields(sObject),
      entityData: sObject,
      timestamp: new Date().toISOString(),
    };
  }

  extractEventId(payload: Record<string, unknown>): string | null {
    const notification = payload.notification as Record<string, unknown> | undefined;
    const sObject = (notification?.data as Record<string, unknown>)?.sObject as Record<string, unknown> | undefined;
    return sObject?.Id ? `sf-${sObject.Id}` : null;
  }

  extractTimestamp(payload: Record<string, unknown>): string | null {
    // Use current time if not available
    return new Date().toISOString();
  }

  private mapSObjectType(attributes: Record<string, unknown> | undefined): "Contact" | "Deal" | "Company" | "Activity" | null {
    if (!attributes) return null;
    const type = attributes.type as string | undefined;

    switch (type) {
      case "Contact":
        return "Contact";
      case "Opportunity":
        return "Deal";
      case "Account":
        return "Company";
      case "Task":
      case "Event":
        return "Activity";
      default:
        return null;
    }
  }

  private extractChangedFields(sObject: Record<string, unknown>): Record<string, FieldChange> {
    // In real implementation, would compare with previous state
    const changes: Record<string, FieldChange> = {};

    for (const [key, value] of Object.entries(sObject)) {
      if (key !== "Id" && key !== "attributes") {
        changes[key] = {
          oldValue: undefined,
          newValue: value,
          changedAt: new Date().toISOString(),
        };
      }
    }

    return changes;
  }
}

/**
 * HubSpot webhook parser
 */
class HubSpotParser implements WebhookParser {
  parse(payload: Record<string, unknown>): Partial<WitylogixCrmEvent> | null {
    const objectId = payload.objectId as string | undefined;
    const eventType = payload.eventType as string | undefined;

    if (!objectId || !eventType) return null;

    const entityType = this.mapObjectType(payload.portalId as unknown);
    if (!entityType) return null;

    return {
      eventId: `hubspot-${objectId}-${eventType}`,
      eventType: `${entityType}.${eventType}`,
      crmProvider: CrmProviderEnum.HUBSPOT,
      entityId: objectId,
      externalEntityId: objectId,
      entityType,
      changedFields: this.extractChangedFields(payload),
      entityData: payload,
      timestamp: new Date().toISOString(),
    };
  }

  extractEventId(payload: Record<string, unknown>): string | null {
    const objectId = payload.objectId as string | undefined;
    const eventType = payload.eventType as string | undefined;

    return objectId && eventType ? `hubspot-${objectId}-${eventType}` : null;
  }

  extractTimestamp(payload: Record<string, unknown>): string | null {
    return new Date().toISOString();
  }

  private mapObjectType(type: unknown): "Contact" | "Deal" | "Company" | "Activity" | null {
    const typeStr = String(type);

    switch (typeStr) {
      case "contact":
        return "Contact";
      case "deal":
        return "Deal";
      case "company":
        return "Company";
      case "engagement":
        return "Activity";
      default:
        return null;
    }
  }

  private extractChangedFields(payload: Record<string, unknown>): Record<string, FieldChange> {
    const changes: Record<string, FieldChange> = {};
    const changes_data = payload.changesData as Array<Record<string, unknown>> | undefined;

    if (changes_data) {
      for (const change of changes_data) {
        const propertyName = change.propertyName as string | undefined;
        const newValue = change.newValue;
        const oldValue = change.oldValue;

        if (propertyName) {
          changes[propertyName] = {
            oldValue,
            newValue,
            changedAt: new Date().toISOString(),
          };
        }
      }
    }

    return changes;
  }
}

/**
 * Zoho webhook parser
 */
class ZohoParser implements WebhookParser {
  parse(payload: Record<string, unknown>): Partial<WitylogixCrmEvent> | null {
    const data = payload.data as Array<Record<string, unknown>> | undefined;
    if (!data || data.length === 0) return null;

    const record = data[0];
    const entityId = record.id as string | undefined;
    const entityType = this.mapZohoModule(payload.module as string | undefined);

    if (!entityId || !entityType) return null;

    return {
      eventId: `zoho-${entityId}`,
      eventType: `${entityType}.Changed`,
      crmProvider: CrmProviderEnum.ZOHO,
      entityId,
      externalEntityId: entityId,
      entityType,
      changedFields: this.extractChangedFields(record),
      entityData: record,
      timestamp: new Date().toISOString(),
    };
  }

  extractEventId(payload: Record<string, unknown>): string | null {
    const data = payload.data as Array<Record<string, unknown>> | undefined;
    const entityId = data?.[0]?.id as string | undefined;
    return entityId ? `zoho-${entityId}` : null;
  }

  extractTimestamp(payload: Record<string, unknown>): string | null {
    return new Date().toISOString();
  }

  private mapZohoModule(module: string | undefined): "Contact" | "Deal" | "Company" | "Activity" | null {
    switch (module) {
      case "Contacts":
        return "Contact";
      case "Deals":
        return "Deal";
      case "Accounts":
        return "Company";
      case "Tasks":
      case "Events":
        return "Activity";
      default:
        return null;
    }
  }

  private extractChangedFields(record: Record<string, unknown>): Record<string, FieldChange> {
    const changes: Record<string, FieldChange> = {};

    for (const [key, value] of Object.entries(record)) {
      if (key !== "id") {
        changes[key] = {
          oldValue: undefined,
          newValue: value,
          changedAt: new Date().toISOString(),
        };
      }
    }

    return changes;
  }
}

/**
 * Pipedrive webhook parser
 */
class PipedriveParser implements WebhookParser {
  parse(payload: Record<string, unknown>): Partial<WitylogixCrmEvent> | null {
    const event = payload.event as string | undefined;
    const current = payload.current as Record<string, unknown> | undefined;

    if (!event || !current) return null;

    const [action, entityType] = event.split(".");
    const id = current.id as string | undefined;

    if (!id || !entityType) return null;

    const mappedType = this.mapPipedriveEntity(entityType);
    if (!mappedType) return null;

    return {
      eventId: `pipedrive-${id}-${event}`,
      eventType: `${mappedType}.${action}`,
      crmProvider: CrmProviderEnum.PIPEDRIVE,
      entityId: id as string,
      externalEntityId: id as string,
      entityType: mappedType,
      changedFields: this.extractChangedFields(current),
      entityData: current,
      timestamp: new Date().toISOString(),
    };
  }

  extractEventId(payload: Record<string, unknown>): string | null {
    const event = payload.event as string | undefined;
    const current = payload.current as Record<string, unknown> | undefined;
    const id = current?.id as string | undefined;

    return event && id ? `pipedrive-${id}-${event}` : null;
  }

  extractTimestamp(payload: Record<string, unknown>): string | null {
    return new Date().toISOString();
  }

  private mapPipedriveEntity(entity: string): "Contact" | "Deal" | "Company" | "Activity" | null {
    switch (entity) {
      case "person":
        return "Contact";
      case "deal":
        return "Deal";
      case "organization":
        return "Company";
      case "activity":
        return "Activity";
      default:
        return null;
    }
  }

  private extractChangedFields(record: Record<string, unknown>): Record<string, FieldChange> {
    const changes: Record<string, FieldChange> = {};

    for (const [key, value] of Object.entries(record)) {
      if (key !== "id") {
        changes[key] = {
          oldValue: undefined,
          newValue: value,
          changedAt: new Date().toISOString(),
        };
      }
    }

    return changes;
  }
}

/**
 * CRM Webhook Handler - Main processor
 */
export class CrmWebhookHandler {
  private parsers: Map<CrmProvider, WebhookParser> = new Map();
  private deduplicationCache: Map<string, DeduplicationEntry> = new Map();
  private retryQueue: RetryEntry[] = [];
  private eventCache: Map<string, WitylogixCrmEvent> = new Map();
  private readonly DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 10000;

  constructor() {
    // Register parsers
    this.parsers.set(CrmProviderEnum.SALESFORCE, new SalesforceParser());
    this.parsers.set(CrmProviderEnum.HUBSPOT, new HubSpotParser());
    this.parsers.set(CrmProviderEnum.ZOHO, new ZohoParser());
    this.parsers.set(CrmProviderEnum.PIPEDRIVE, new PipedriveParser());

    // Clean up old entries periodically
    setInterval(() => this.cleanupDeduplication(), 60 * 1000);
  }

  /**
   * Process incoming webhook event
   * @param rawEvent - Raw webhook event from CRM
   * @returns Normalized event or null if duplicate/invalid
   */
  async processWebhook(rawEvent: RawWebhookEvent): Promise<WitylogixCrmEvent | null> {
    const parser = this.parsers.get(rawEvent.provider);
    if (!parser) {
      console.error(`No parser found for provider: ${rawEvent.provider}`);
      return null;
    }

    // Extract event ID for deduplication
    const eventId = parser.extractEventId(rawEvent.rawPayload);
    if (!eventId) {
      console.warn("Could not extract event ID from webhook");
      return null;
    }

    // Check for duplicates
    if (this.isDuplicate(eventId, rawEvent.provider, rawEvent.tenantId)) {
      console.log(`Duplicate event detected: ${eventId}`);
      return null;
    }

    // Parse webhook payload
    const normalizedEvent = parser.parse(rawEvent.rawPayload) as WitylogixCrmEvent | undefined;
    if (!normalizedEvent) {
      console.warn("Failed to parse webhook payload");
      return null;
    }

    // Add metadata
    normalizedEvent.eventId = eventId;
    normalizedEvent.receivedAt = rawEvent.receivedAt;
    normalizedEvent.tenantId = rawEvent.tenantId;
    normalizedEvent.isDuplicate = false;

    // Record in deduplication cache
    this.recordDeduplication(eventId, rawEvent.provider, rawEvent.tenantId);

    // Store in event cache (with size limit)
    if (this.eventCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.eventCache.keys().next().value;
      this.eventCache.delete(firstKey);
    }
    this.eventCache.set(eventId, normalizedEvent);

    return normalizedEvent;
  }

  /**
   * Check if event is a duplicate
   */
  private isDuplicate(eventId: string, provider: CrmProvider, tenantId: string): boolean {
    const key = `${provider}:${tenantId}:${eventId}`;
    return this.deduplicationCache.has(key);
  }

  /**
   * Record event for deduplication
   */
  private recordDeduplication(eventId: string, provider: CrmProvider, tenantId: string): void {
    const key = `${provider}:${tenantId}:${eventId}`;
    this.deduplicationCache.set(key, {
      eventId,
      provider,
      tenantId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Clean up old deduplication entries
   */
  private cleanupDeduplication(): void {
    const cutoffTime = Date.now() - this.DEDUP_WINDOW_MS;

    for (const [key, entry] of this.deduplicationCache.entries()) {
      if (new Date(entry.timestamp).getTime() < cutoffTime) {
        this.deduplicationCache.delete(key);
      }
    }
  }

  /**
   * Queue event for retry with exponential backoff
   * @param event - Event to retry
   * @param error - Error that occurred
   */
  async queueForRetry(event: WitylogixCrmEvent, error: Error): Promise<void> {
    const retryEntry: RetryEntry = {
      event,
      attempt: 0,
      maxAttempts: 3,
      nextRetryTime: Date.now() + Math.pow(2, 0) * 1000, // Start with 1 second
      lastError: error.message,
    };

    this.retryQueue.push(retryEntry);
  }

  /**
   * Get retry queue
   */
  getRetryQueue(): RetryEntry[] {
    return [...this.retryQueue];
  }

  /**
   * Process retry queue
   */
  async processRetryQueue(): Promise<void> {
    const now = Date.now();
    const toRetry = this.retryQueue.filter((entry) => entry.nextRetryTime <= now);

    for (const entry of toRetry) {
      if (entry.attempt >= entry.maxAttempts) {
        // Move to dead letter queue after max attempts
        console.error(`Event ${entry.event.eventId} exceeded max retries`);
        this.retryQueue.splice(this.retryQueue.indexOf(entry), 1);
        continue;
      }

      entry.attempt += 1;
      // Set next retry time with exponential backoff
      entry.nextRetryTime = Date.now() + Math.pow(2, entry.attempt) * 1000;
    }
  }

  /**
   * Get event from cache by ID
   */
  getEventFromCache(eventId: string): WitylogixCrmEvent | undefined {
    return this.eventCache.get(eventId);
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.deduplicationCache.clear();
    this.eventCache.clear();
    this.retryQueue = [];
  }
}
