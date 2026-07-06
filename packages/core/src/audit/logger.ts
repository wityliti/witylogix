/**
 * Audit Logger
 * Logs audit events with batching, diffing, and sensitive field masking
 */

import {
  AuditEvent,
  AuditAction,
  AuditConfig,
  ChangedField,
  SENSITIVE_FIELDS,
  AuditLogError,
  AuditEventBuilder,
} from "./types";

/**
 * AuditLogger
 * Main audit logging service with batching and diffing capabilities
 */
export class AuditLogger {
  private eventBatch: AuditEvent[] = [];
  private config: Required<AuditConfig>;
  private flushTimer?: NodeJS.Timeout;
  private onFlush?: (events: AuditEvent[]) => Promise<void>;

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      batchSize: config.batchSize ?? 50,
      batchIntervalMs: config.batchIntervalMs ?? 5000,
      retentionDays: config.retentionDays ?? 365,
      maskSensitiveFields: config.maskSensitiveFields ?? true,
      captureMetadata: config.captureMetadata ?? true,
      excludeResources: config.excludeResources ?? [],
      excludeActions: config.excludeActions ?? [],
    };
  }

  /**
   * Set the flush callback
   * This is called when the batch should be persisted (e.g., to database)
   */
  setFlushCallback(callback: (events: AuditEvent[]) => Promise<void>): void {
    this.onFlush = callback;
  }

  /**
   * Log an audit event
   * Event is added to batch and flushed if batch size is reached or interval expires
   */
  async log(event: AuditEvent | Partial<AuditEvent>): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Validate and build complete event
    const completeEvent = this.normalizeEvent(event);

    // Check exclusions
    if (this.isExcluded(completeEvent)) {
      return;
    }

    // Mask sensitive fields if configured
    if (this.config.maskSensitiveFields) {
      this.maskSensitiveFields(completeEvent);
    }

    // Add to batch
    this.eventBatch.push(completeEvent);

    // Flush if batch size reached
    if (this.eventBatch.length >= this.config.batchSize) {
      await this.flush();
    } else if (!this.flushTimer) {
      // Start timer if not already started
      this.startFlushTimer();
    }
  }

  /**
   * Log multiple events
   * Useful for batch operations
   */
  async logMany(events: (AuditEvent | Partial<AuditEvent>)[]): Promise<void> {
    for (const event of events) {
      await this.log(event);
    }
  }

  /**
   * Log an update with before/after values
   * Automatically computes the diff
   */
  async logUpdate(
    tenantId: string,
    userId: string,
    resource: string,
    resourceId: string,
    before: Record<string, any>,
    after: Record<string, any>,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const changes = this.computeChanges(before, after);

    const event: Partial<AuditEvent> = {
      tenantId,
      userId,
      action: AuditAction.UPDATE,
      resource,
      resourceId,
      changes: this.serializeChanges(changes),
      changesSummary: this.summarizeChanges(changes),
      metadata,
    };

    await this.log(event);
  }

  /**
   * Log a creation event
   */
  async logCreate(
    tenantId: string,
    userId: string,
    resource: string,
    resourceId: string,
    data: Record<string, any>,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const event: Partial<AuditEvent> = {
      tenantId,
      userId,
      action: AuditAction.CREATE,
      resource,
      resourceId,
      changes: this.maskObject(data),
      metadata,
    };

    await this.log(event);
  }

  /**
   * Log a deletion event
   */
  async logDelete(
    tenantId: string,
    userId: string,
    resource: string,
    resourceId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const event: Partial<AuditEvent> = {
      tenantId,
      userId,
      action: AuditAction.DELETE,
      resource,
      resourceId,
      metadata,
    };

    await this.log(event);
  }

  /**
   * Flush pending events to storage
   */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    if (this.eventBatch.length === 0) {
      return;
    }

    const eventsToFlush = [...this.eventBatch];
    this.eventBatch = [];

    try {
      if (this.onFlush) {
        await this.onFlush(eventsToFlush);
      }
    } catch (error) {
      throw new AuditLogError(
        `Failed to flush audit events: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Compute changes between two objects
   * Returns array of changed fields
   * @private
   */
  private computeChanges(
    before: Record<string, any>,
    after: Record<string, any>,
  ): ChangedField[] {
    const changes: ChangedField[] = [];
    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ]);

    for (const key of allKeys) {
      const oldValue = before?.[key];
      const newValue = after?.[key];

      // Skip if both are undefined
      if (oldValue === undefined && newValue === undefined) {
        continue;
      }

      // Skip if values are the same
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
        continue;
      }

      changes.push({
        fieldName: key,
        oldValue,
        newValue,
        valueType: this.getValueType(newValue),
      });
    }

    return changes;
  }

  /**
   * Serialize changes to a simple object format
   * @private
   */
  private serializeChanges(
    changes: ChangedField[],
  ): Record<string, { old: any; new: any }> {
    const result: Record<string, { old: any; new: any }> = {};
    for (const change of changes) {
      result[change.fieldName] = {
        old: change.oldValue,
        new: change.newValue,
      };
    }
    return result;
  }

  /**
   * Create a human-readable summary of changes
   * @private
   */
  private summarizeChanges(changes: ChangedField[]): string {
    if (changes.length === 0) {
      return "No changes";
    }

    const fieldNames = changes.map((c) => c.fieldName);
    if (fieldNames.length === 1) {
      return `Modified ${fieldNames[0]}`;
    }
    return `Modified ${fieldNames.length} fields: ${fieldNames.join(", ")}`;
  }

  /**
   * Get the type of a value
   * @private
   */
  private getValueType(value: any): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (value instanceof Date) return "date";
    if (typeof value === "object") return "object";
    return typeof value;
  }

  /**
   * Mask sensitive fields in an object
   * @private
   */
  private maskObject(obj: Record<string, any>): Record<string, any> {
    if (!this.config.maskSensitiveFields) {
      return obj;
    }

    const masked = { ...obj };
    for (const key of Object.keys(masked)) {
      if (this.isSensitiveField(key)) {
        masked[key] = "***REDACTED***";
      }
    }
    return masked;
  }

  /**
   * Mask sensitive fields in an audit event
   * @private
   */
  private maskSensitiveFields(event: AuditEvent): void {
    if (event.changes) {
      const masked: Record<string, any> = {};
      for (const [key, value] of Object.entries(event.changes)) {
        if (this.isSensitiveField(key)) {
          masked[key] = { old: "***REDACTED***", new: "***REDACTED***" };
        } else {
          masked[key] = value;
        }
      }
      event.changes = masked;
    }

    if (event.metadata) {
      event.metadata = this.maskObject(event.metadata);
    }
  }

  /**
   * Check if a field name is sensitive
   * @private
   */
  private isSensitiveField(fieldName: string): boolean {
    const lower = fieldName.toLowerCase();
    return SENSITIVE_FIELDS.some((sensitive) =>
      lower.includes(sensitive.toLowerCase()),
    );
  }

  /**
   * Normalize a partial event into a complete event
   * @private
   */
  private normalizeEvent(event: AuditEvent | Partial<AuditEvent>): AuditEvent {
    if ((event as AuditEvent).id) {
      return event as AuditEvent;
    }

    // Build a complete event
    const partial = event as Partial<AuditEvent>;
    if (!partial.tenantId) throw new Error("tenantId is required");
    if (!partial.userId) throw new Error("userId is required");
    if (!partial.action) throw new Error("action is required");
    if (!partial.resource) throw new Error("resource is required");

    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      tenantId: partial.tenantId,
      userId: partial.userId,
      action: partial.action,
      resource: partial.resource,
      resourceId: partial.resourceId,
      resourceName: partial.resourceName,
      changes: partial.changes,
      changesSummary: partial.changesSummary,
      metadata: partial.metadata,
      ipAddress: partial.ipAddress,
      userAgent: partial.userAgent,
      statusCode: partial.statusCode,
      errorMessage: partial.errorMessage,
      durationMs: partial.durationMs,
    };
  }

  /**
   * Check if an event should be excluded from audit trail
   * @private
   */
  private isExcluded(event: AuditEvent): boolean {
    if (
      this.config.excludeResources.includes(event.resource) ||
      this.config.excludeActions.includes(event.action)
    ) {
      return true;
    }
    return false;
  }

  /**
   * Start the flush timer
   * @private
   */
  private startFlushTimer(): void {
    this.flushTimer = setTimeout(async () => {
      if (this.eventBatch.length > 0) {
        await this.flush();
      }
    }, this.config.batchIntervalMs);
  }

  /**
   * Get current batch size
   */
  getBatchSize(): number {
    return this.eventBatch.length;
  }

  /**
   * Get a builder for creating events
   */
  builder(): AuditEventBuilder {
    return new AuditEventBuilder();
  }

  /**
   * Clear all pending events
   * WARNING: This discards unsaved events
   */
  clear(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.eventBatch = [];
  }
}
