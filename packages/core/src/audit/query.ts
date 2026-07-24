/**
 * Audit Log Query Engine
 * Provides methods to query audit logs with filtering, pagination, and sorting
 * All queries use parameterized SQL to prevent injection
 */

import {
  AuditEvent,
  AuditQuery,
  AuditQueryResult,
  EntityHistory,
  UserActivitySummary,
  AuditQueryError,
} from "./types";

/**
 * Mock database interface
 * In production, this would be a real database client (Prisma, pg, etc.)
 */
interface DatabaseClient {
  query(sql: string, params: any[]): Promise<any[]>;
  queryOne(sql: string, params: any[]): Promise<any | null>;
}

/**
 * AuditQueryEngine
 * Executes parameterized queries against the audit log
 */
export class AuditQueryEngine {
  constructor(private db: DatabaseClient) {}

  /**
   * Query audit logs with filtering, pagination, and sorting
   * Returns paginated results
   */
  async queryAuditLog(query: AuditQuery): Promise<AuditQueryResult> {
    if (query.limit && (query.limit < 1 || query.limit > 1000)) {
      throw new AuditQueryError("Limit must be between 1 and 1000");
    }

    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const sortBy = query.sortBy ?? "timestamp";
    const sortOrder = query.sortOrder ?? "desc";

    // Build WHERE clause with parameterized queries
    const conditions: string[] = [];
    const params: any[] = [];

    conditions.push("tenant_id = $" + (params.length + 1));
    params.push(query.tenantId);

    if (query.resource) {
      conditions.push("resource = $" + (params.length + 1));
      params.push(query.resource);
    }

    if (query.resourceId) {
      conditions.push("resource_id = $" + (params.length + 1));
      params.push(query.resourceId);
    }

    if (query.userId) {
      conditions.push("user_id = $" + (params.length + 1));
      params.push(query.userId);
    }

    if (query.action) {
      conditions.push("action = $" + (params.length + 1));
      params.push(query.action);
    }

    if (query.startDate) {
      conditions.push("timestamp >= $" + (params.length + 1));
      params.push(query.startDate);
    }

    if (query.endDate) {
      conditions.push("timestamp <= $" + (params.length + 1));
      params.push(query.endDate);
    }

    const whereClause =
      conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    // Validate sort column to prevent SQL injection
    const validSortColumns = ["timestamp", "action", "resource"];
    if (!validSortColumns.includes(sortBy)) {
      throw new AuditQueryError(`Invalid sort column: ${sortBy}`);
    }

    const validSortOrders = ["asc", "desc"];
    if (!validSortOrders.includes(sortOrder)) {
      throw new AuditQueryError(`Invalid sort order: ${sortOrder}`);
    }

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM audit_events ${whereClause}`;
    const countResult = await this.db.queryOne(countSql, params);
    const total = countResult?.count ?? 0;

    // Get paginated results
    const sql = `
      SELECT * FROM audit_events
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit);
    params.push(offset);

    const rows = await this.db.query(sql, params);
    const events = rows.map((row) => this.mapRowToEvent(row));

    return {
      events,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get all changes for a specific entity
   * Useful for seeing the evolution of a resource
   */
  async getEntityHistory(
    tenantId: string,
    resource: string,
    resourceId: string,
  ): Promise<EntityHistory> {
    const events = await this.db.query(
      `
      SELECT * FROM audit_events
      WHERE tenant_id = $1 AND resource = $2 AND resource_id = $3
      ORDER BY timestamp ASC
    `,
      [tenantId, resource, resourceId],
    );

    const auditEvents = events.map((row) => this.mapRowToEvent(row));

    // Find creation timestamp
    const createdEvent = auditEvents.find((e) => e.action === "create");
    const createdAt =
      createdEvent?.timestamp ?? auditEvents[0]?.timestamp ?? new Date();

    return {
      resourceId,
      resource,
      tenantId,
      createdAt,
      changes: auditEvents,
    };
  }

  /**
   * Get user's activity within a date range
   * Aggregates all actions by a specific user
   */
  async getUserActivity(
    tenantId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<UserActivitySummary> {
    const conditions = ["tenant_id = $1", "user_id = $2"];
    const params: any[] = [tenantId, userId];

    if (startDate) {
      conditions.push(`timestamp >= $${params.length + 1}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`timestamp <= $${params.length + 1}`);
      params.push(endDate);
    }

    const whereClause = conditions.join(" AND ");

    // Get all events
    const events = await this.db.query(
      `
      SELECT * FROM audit_events
      WHERE ${whereClause}
      ORDER BY timestamp DESC
    `,
      params,
    );

    const auditEvents = events.map((row) => this.mapRowToEvent(row));

    // Aggregate by action and resource
    const eventsByAction: Record<string, number> = {};
    const eventsByResource: Record<string, number> = {};

    for (const event of auditEvents) {
      eventsByAction[event.action] = (eventsByAction[event.action] ?? 0) + 1;
      eventsByResource[event.resource] =
        (eventsByResource[event.resource] ?? 0) + 1;
    }

    return {
      userId,
      tenantId,
      startDate: startDate ?? new Date(0),
      endDate: endDate ?? new Date(),
      totalEvents: auditEvents.length,
      eventsByAction,
      eventsByResource,
      lastActivity: auditEvents[0]?.timestamp,
    };
  }

  /**
   * Search for events matching text in changes or metadata
   * Uses ILIKE for case-insensitive search
   */
  async searchAuditLog(
    tenantId: string,
    searchText: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<AuditQueryResult> {
    const searchPattern = `%${searchText}%`;

    const countSql = `
      SELECT COUNT(*) as count FROM audit_events
      WHERE tenant_id = $1
        AND (resource ILIKE $2 OR action ILIKE $2 OR changes_summary ILIKE $2)
    `;

    const countResult = await this.db.queryOne(countSql, [
      tenantId,
      searchPattern,
    ]);
    const total = countResult?.count ?? 0;

    const sql = `
      SELECT * FROM audit_events
      WHERE tenant_id = $1
        AND (resource ILIKE $2 OR action ILIKE $2 OR changes_summary ILIKE $2)
      ORDER BY timestamp DESC
      LIMIT $3 OFFSET $4
    `;

    const rows = await this.db.query(sql, [
      tenantId,
      searchPattern,
      limit,
      offset,
    ]);
    const events = rows.map((row) => this.mapRowToEvent(row));

    return {
      events,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get audit summary statistics for a tenant
   * Useful for compliance reporting
   */
  async getAuditSummary(
    tenantId: string,
    days: number = 30,
  ): Promise<Record<string, any>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const sql = `
      SELECT
        COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT resource) as resource_types,
        json_object_agg(action, count) as events_by_action
      FROM audit_events
      WHERE tenant_id = $1 AND timestamp >= $2
      GROUP BY tenant_id
    `;

    const result = await this.db.queryOne(sql, [tenantId, startDate]);

    return {
      tenantId,
      period: `Last ${days} days`,
      startDate,
      totalEvents: result?.total_events ?? 0,
      uniqueUsers: result?.unique_users ?? 0,
      resourceTypes: result?.resource_types ?? 0,
      eventsByAction: result?.events_by_action ?? {},
    };
  }

  /**
   * Map database row to AuditEvent
   * @private
   */
  private mapRowToEvent(row: any): AuditEvent {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      action: row.action,
      resource: row.resource,
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      changes: this.parseJson(row.changes),
      changesSummary: row.changes_summary,
      metadata: this.parseJson(row.metadata),
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      statusCode: row.status_code,
      errorMessage: row.error_message,
      durationMs: row.duration_ms,
      timestamp: new Date(row.timestamp),
    };
  }

  /**
   * Safe JSON parsing
   * @private
   */
  private parseJson(value: any): any {
    if (!value) return undefined;
    if (typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
}

/**
 * Create a query engine with a database client
 */
export function createAuditQueryEngine(db: DatabaseClient): AuditQueryEngine {
  return new AuditQueryEngine(db);
}
