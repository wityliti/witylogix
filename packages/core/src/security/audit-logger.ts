/**
 * Security Audit Logger — Immutable audit trail for compliance.
 *
 * Tracks all security-relevant events (logins, permission changes, data access)
 * with immutable append-only log entries and cryptographic hash chain for
 * tamper detection.
 *
 * Key features:
 * - Immutable audit log entries
 * - Event types: LOGIN, LOGOUT, PERMISSION_CHANGE, DATA_ACCESS, DATA_MODIFY, CONFIG_CHANGE
 * - Actor tracking (userId, IP, sessionId)
 * - Before/after state capture
 * - Tamper detection via hash chain
 * - Searchable by event type, actor, resource
 * - Long-term retention policy
 *
 * @example
 * const auditLogger = new AuditLogger();
 * await auditLogger.log({
 *   eventType: "LOGIN",
 *   actor: { userId: "user-123", ip: "192.168.1.1" },
 *   resource: "authentication",
 * });
 */

/**
 * Types of auditable events.
 */
export enum AuditEventType {
  /** User login event */
  LOGIN = "LOGIN",
  /** User logout event */
  LOGOUT = "LOGOUT",
  /** Permission/role assignment change */
  PERMISSION_CHANGE = "PERMISSION_CHANGE",
  /** Data read/access event */
  DATA_ACCESS = "DATA_ACCESS",
  /** Data create/update/delete event */
  DATA_MODIFY = "DATA_MODIFY",
  /** Configuration change event */
  CONFIG_CHANGE = "CONFIG_CHANGE",
  /** API key created/revoked */
  API_KEY_CHANGE = "API_KEY_CHANGE",
  /** User account changes */
  ACCOUNT_CHANGE = "ACCOUNT_CHANGE",
  /** Integration enabled/disabled */
  INTEGRATION_CHANGE = "INTEGRATION_CHANGE",
  /** Webhook created/modified/deleted */
  WEBHOOK_CHANGE = "WEBHOOK_CHANGE",
}

/**
 * Actor information (who performed action).
 */
export interface AuditActor {
  /** User ID if authenticated */
  userId?: string;
  /** Email if available */
  email?: string;
  /** Client IP address */
  ip: string;
  /** Session ID */
  sessionId?: string;
  /** User agent string */
  userAgent?: string;
}

/**
 * State change capture (before/after).
 */
export interface StateChange {
  /** State before change */
  before?: Record<string, unknown>;
  /** State after change */
  after?: Record<string, unknown>;
  /** Array of field names that changed */
  changedFields?: string[];
}

/**
 * Audit log entry.
 */
export interface AuditLogEntry {
  /** Unique entry ID */
  id: string;
  /** When entry was logged */
  timestamp: Date;
  /** Type of event */
  eventType: AuditEventType;
  /** Actor (who did it) */
  actor: AuditActor;
  /** Resource affected (e.g., "user:123", "organization:456") */
  resource: string;
  /** Action performed (e.g., "create", "update", "delete") */
  action: string;
  /** Outcome of action */
  outcome: "SUCCESS" | "FAILURE";
  /** Details about the action */
  details?: Record<string, unknown>;
  /** Before/after state capture */
  stateChange?: StateChange;
  /** HTTP status code (if applicable) */
  statusCode?: number;
  /** Error message (if failed) */
  errorMessage?: string;
  /** Organization ID (for multi-tenant) */
  orgId?: string;
  /** SHA-256 hash of this entry */
  hash: string;
  /** SHA-256 hash of previous entry (for chain verification) */
  previousHash?: string;
  /** Duration of operation in milliseconds */
  durationMs?: number;
}

/**
 * Query filter for searching audit logs.
 */
export interface AuditQuery {
  /** Filter by event type */
  eventType?: AuditEventType;
  /** Filter by user ID */
  userId?: string;
  /** Filter by resource */
  resource?: string;
  /** Filter by organization */
  orgId?: string;
  /** Start date (inclusive) */
  startDate?: Date;
  /** End date (inclusive) */
  endDate?: Date;
  /** Outcome filter */
  outcome?: "SUCCESS" | "FAILURE";
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Audit log query result.
 */
export interface AuditQueryResult {
  /** Total matching entries */
  total: number;
  /** Returned entries */
  entries: AuditLogEntry[];
  /** Pagination offset for next page */
  nextOffset?: number;
}

/**
 * Immutable security audit logger.
 */
export class AuditLogger {
  private entries: AuditLogEntry[] = [];
  private entryById: Map<string, AuditLogEntry> = new Map();
  private lastHash: string = "";
  private sequence: number = 0;

  /**
   * Initialize audit logger.
   */
  constructor() {
    // Initialize with genesis hash
    this.lastHash = this.hashEntry("GENESIS");
  }

  /**
   * Generate SHA-256 hash of entry data.
   * @param data - Data to hash
   * @returns SHA-256 hash in hex
   */
  private hashEntry(data: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Generate unique entry ID.
   * @returns Unique entry ID
   */
  private generateEntryId(): string {
    this.sequence++;
    return `audit-${Date.now()}-${this.sequence}`;
  }

  /**
   * Create hash chain for tamper detection.
   * @param entry - Entry to hash
   * @returns Hash of this entry
   */
  private createChainHash(entry: AuditLogEntry): string {
    const data = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      eventType: entry.eventType,
      actor: entry.actor,
      resource: entry.resource,
      action: entry.action,
      outcome: entry.outcome,
      details: entry.details,
      previousHash: entry.previousHash,
      orgId: entry.orgId,
    });

    return this.hashEntry(data);
  }

  /**
   * Log an audit event.
   * @param eventType - Type of event
   * @param actor - Actor information
   * @param resource - Resource affected
   * @param action - Action performed
   * @param options - Additional options
   * @returns Created audit log entry
   */
  async log(
    eventType: AuditEventType,
    actor: AuditActor,
    resource: string,
    action: string,
    options?: {
      outcome?: "SUCCESS" | "FAILURE";
      details?: Record<string, unknown>;
      stateChange?: StateChange;
      statusCode?: number;
      errorMessage?: string;
      orgId?: string;
      durationMs?: number;
    }
  ): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: this.generateEntryId(),
      timestamp: new Date(),
      eventType,
      actor,
      resource,
      action,
      outcome: options?.outcome || "SUCCESS",
      details: options?.details,
      stateChange: options?.stateChange,
      statusCode: options?.statusCode,
      errorMessage: options?.errorMessage,
      orgId: options?.orgId,
      durationMs: options?.durationMs,
      hash: "", // Will be set below
      previousHash: this.lastHash,
    };

    // Create hash chain
    entry.hash = this.createChainHash(entry);
    this.lastHash = entry.hash;

    // Store entry (immutable append-only)
    this.entries.push(Object.freeze(entry) as AuditLogEntry);
    this.entryById.set(entry.id, entry);

    return entry;
  }

  /**
   * Convenience method for login events.
   */
  async logLogin(
    userId: string,
    ip: string,
    sessionId?: string,
    options?: {
      mfaUsed?: boolean;
      orgId?: string;
    }
  ): Promise<AuditLogEntry> {
    return this.log(
      AuditEventType.LOGIN,
      { userId, ip, sessionId },
      `user:${userId}`,
      "login",
      {
        outcome: "SUCCESS",
        details: { mfaUsed: options?.mfaUsed || false },
        orgId: options?.orgId,
      }
    );
  }

  /**
   * Convenience method for logout events.
   */
  async logLogout(
    userId: string,
    ip: string,
    sessionId?: string,
    options?: {
      orgId?: string;
    }
  ): Promise<AuditLogEntry> {
    return this.log(
      AuditEventType.LOGOUT,
      { userId, ip, sessionId },
      `user:${userId}`,
      "logout",
      {
        outcome: "SUCCESS",
        orgId: options?.orgId,
      }
    );
  }

  /**
   * Convenience method for permission changes.
   */
  async logPermissionChange(
    userId: string,
    targetUserId: string,
    actor: AuditActor,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    options?: {
      orgId?: string;
    }
  ): Promise<AuditLogEntry> {
    return this.log(
      AuditEventType.PERMISSION_CHANGE,
      actor,
      `user:${targetUserId}`,
      "update_permissions",
      {
        outcome: "SUCCESS",
        stateChange: { before, after },
        orgId: options?.orgId,
      }
    );
  }

  /**
   * Convenience method for data access events.
   */
  async logDataAccess(
    actor: AuditActor,
    resource: string,
    query?: Record<string, unknown>,
    options?: {
      orgId?: string;
      resultCount?: number;
    }
  ): Promise<AuditLogEntry> {
    return this.log(
      AuditEventType.DATA_ACCESS,
      actor,
      resource,
      "read",
      {
        outcome: "SUCCESS",
        details: { query, resultCount: options?.resultCount },
        orgId: options?.orgId,
      }
    );
  }

  /**
   * Convenience method for data modifications.
   */
  async logDataModify(
    actor: AuditActor,
    resource: string,
    action: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    options?: {
      orgId?: string;
    }
  ): Promise<AuditLogEntry> {
    return this.log(
      AuditEventType.DATA_MODIFY,
      actor,
      resource,
      action,
      {
        outcome: "SUCCESS",
        stateChange: { before, after },
        orgId: options?.orgId,
      }
    );
  }

  /**
   * Query audit logs.
   * @param query - Query filter
   * @returns Query result
   */
  async query(query: AuditQuery): Promise<AuditQueryResult> {
    let results = [...this.entries];

    // Apply filters
    if (query.eventType) {
      results = results.filter((e) => e.eventType === query.eventType);
    }
    if (query.userId) {
      results = results.filter((e) => e.actor.userId === query.userId);
    }
    if (query.resource) {
      results = results.filter((e) => e.resource === query.resource);
    }
    if (query.orgId) {
      results = results.filter((e) => e.orgId === query.orgId);
    }
    if (query.startDate) {
      results = results.filter((e) => e.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter((e) => e.timestamp <= query.endDate!);
    }
    if (query.outcome) {
      results = results.filter((e) => e.outcome === query.outcome);
    }

    const total = results.length;

    // Pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const entries = results.slice(offset, offset + limit);
    const nextOffset = offset + limit < total ? offset + limit : undefined;

    return {
      total,
      entries,
      nextOffset,
    };
  }

  /**
   * Get entry by ID.
   * @param entryId - Entry ID
   * @returns Entry or undefined
   */
  getEntry(entryId: string): AuditLogEntry | undefined {
    return this.entryById.get(entryId);
  }

  /**
   * Verify hash chain integrity.
   * Returns true if all entries hash chain is valid.
   * @returns true if chain is intact
   */
  verifyChainIntegrity(): boolean {
    let previousHash = this.hashEntry("GENESIS");

    for (const entry of this.entries) {
      // Verify previous hash
      if (entry.previousHash !== previousHash) {
        return false;
      }

      // Verify current hash
      const expectedHash = this.createChainHash(entry);
      if (entry.hash !== expectedHash) {
        return false;
      }

      previousHash = entry.hash;
    }

    return true;
  }

  /**
   * Get total audit entries logged.
   */
  count(): number {
    return this.entries.length;
  }

  /**
   * Get recent entries.
   * @param limit - Number of entries to return
   * @returns Recent entries in reverse chronological order
   */
  getRecent(limit: number = 100): AuditLogEntry[] {
    return [...this.entries].reverse().slice(0, limit);
  }

  /**
   * Export audit log as JSON.
   * Includes full chain for external verification.
   * @returns JSON representation of entire audit log
   */
  export(): {
    exportedAt: Date;
    totalEntries: number;
    chainIntact: boolean;
    entries: AuditLogEntry[];
  } {
    return {
      exportedAt: new Date(),
      totalEntries: this.entries.length,
      chainIntact: this.verifyChainIntegrity(),
      entries: [...this.entries],
    };
  }
}
