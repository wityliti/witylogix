/**
 * Audit Trail System — Type Definitions
 * Defines audit events, actions, and query interfaces
 */

/**
 * Audit action enum
 * Represents different types of actions that can be audited
 */
export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  EXPORT = 'export',
  IMPORT = 'import',
  PERMISSION_CHANGE = 'permission_change',
  SETTINGS_CHANGE = 'settings_change',
  BULK_ACTION = 'bulk_action',
  API_CALL = 'api_call',
}

/**
 * Audit event
 * Represents a single auditable action in the system
 */
export interface AuditEvent {
  id: string;
  tenantId: string;
  userId: string;
  action: AuditAction | string;
  resource: string; // e.g., 'orders', 'shipments', 'users'
  resourceId?: string; // ID of the specific resource
  resourceName?: string; // Human-readable name of the resource
  changes?: Record<string, any>; // Before/after changes (already diffed)
  changesSummary?: string; // Human-readable summary of changes
  metadata?: Record<string, any>; // Additional context
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number; // HTTP status if applicable
  errorMessage?: string; // Error details if action failed
  durationMs?: number; // How long the action took
  timestamp: Date;
}

/**
 * Changed field in an audit event
 * Represents a single field that was modified
 */
export interface ChangedField {
  fieldName: string;
  oldValue: any;
  newValue: any;
  valueType?: string; // 'string', 'number', 'boolean', 'date', 'json', etc.
}

/**
 * Sensitive fields that should be masked in audit logs
 * These field names will have their values redacted
 */
export const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'apiSecret',
  'secret',
  'secretKey',
  'privateKey',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
  'socialSecurityNumber',
  'bankAccount',
  'accountNumber',
  'routingNumber',
];

/**
 * Audit query filter
 * Parameters for querying audit logs
 */
export interface AuditQuery {
  tenantId: string;
  resource?: string; // Filter by resource type
  resourceId?: string; // Filter by specific resource
  userId?: string; // Filter by actor
  action?: AuditAction | string; // Filter by action
  startDate?: Date;
  endDate?: Date;
  limit?: number; // Pagination limit (default 100, max 1000)
  offset?: number; // Pagination offset (default 0)
  sortBy?: 'timestamp' | 'action' | 'resource'; // Sort order (default: timestamp)
  sortOrder?: 'asc' | 'desc'; // Sort direction (default: desc)
}

/**
 * Paginated audit query results
 */
export interface AuditQueryResult {
  events: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * User activity summary
 * Aggregated view of a user's activities
 */
export interface UserActivitySummary {
  userId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  totalEvents: number;
  eventsByAction: Record<string, number>;
  eventsByResource: Record<string, number>;
  lastActivity?: Date;
}

/**
 * Entity history
 * All changes made to a specific resource
 */
export interface EntityHistory {
  resourceId: string;
  resource: string;
  tenantId: string;
  createdAt: Date;
  changes: AuditEvent[];
  currentState?: Record<string, any>; // Optional: reconstructed current state
}

/**
 * Audit configuration
 * Settings for audit logging behavior
 */
export interface AuditConfig {
  enabled: boolean;
  batchSize?: number; // Flush batch when reaching this size (default: 50)
  batchIntervalMs?: number; // Flush batch at this interval (default: 5000)
  retentionDays?: number; // How long to keep audit logs (default: 365)
  maskSensitiveFields?: boolean; // Mask sensitive data (default: true)
  captureMetadata?: boolean; // Capture IP, user agent, etc (default: true)
  excludeResources?: string[]; // Resources to not audit
  excludeActions?: string[]; // Actions to not audit
}

/**
 * Audit statistics
 * Summary of audit logging system health
 */
export interface AuditStats {
  totalEvents: number;
  eventsThisMonth: number;
  eventsThisWeek: number;
  averageEventsPerDay: number;
  pendingBatch: number;
  lastFlushAt?: Date;
  oldestEvent?: Date;
}

/**
 * Audit logger errors
 */
export class AuditError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AuditError';
  }
}

export class AuditQueryError extends AuditError {
  constructor(message: string) {
    super('AUDIT_QUERY_ERROR', message, 400);
    this.name = 'AuditQueryError';
  }
}

export class AuditLogError extends AuditError {
  constructor(message: string) {
    super('AUDIT_LOG_ERROR', message, 500);
    this.name = 'AuditLogError';
  }
}

/**
 * Audit event builder
 * Helper for constructing audit events
 */
export class AuditEventBuilder {
  private event: Partial<AuditEvent> = {};

  setTenantId(tenantId: string): this {
    this.event.tenantId = tenantId;
    return this;
  }

  setUserId(userId: string): this {
    this.event.userId = userId;
    return this;
  }

  setAction(action: AuditAction | string): this {
    this.event.action = action;
    return this;
  }

  setResource(resource: string): this {
    this.event.resource = resource;
    return this;
  }

  setResourceId(resourceId: string): this {
    this.event.resourceId = resourceId;
    return this;
  }

  setResourceName(name: string): this {
    this.event.resourceName = name;
    return this;
  }

  setChanges(changes: Record<string, any>): this {
    this.event.changes = changes;
    return this;
  }

  setChangesSummary(summary: string): this {
    this.event.changesSummary = summary;
    return this;
  }

  setMetadata(metadata: Record<string, any>): this {
    this.event.metadata = metadata;
    return this;
  }

  setIpAddress(ip: string): this {
    this.event.ipAddress = ip;
    return this;
  }

  setUserAgent(ua: string): this {
    this.event.userAgent = ua;
    return this;
  }

  setStatusCode(code: number): this {
    this.event.statusCode = code;
    return this;
  }

  setErrorMessage(message: string): this {
    this.event.errorMessage = message;
    return this;
  }

  setDurationMs(duration: number): this {
    this.event.durationMs = duration;
    return this;
  }

  build(): AuditEvent {
    if (!this.event.tenantId) throw new Error('tenantId is required');
    if (!this.event.userId) throw new Error('userId is required');
    if (!this.event.action) throw new Error('action is required');
    if (!this.event.resource) throw new Error('resource is required');

    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...this.event,
    } as AuditEvent;
  }
}
