/**
 * Campaign Audience Builder
 * Builds parameterized SQL queries for audience segmentation and filtering
 * Supports flexible filtering on customer attributes, tags, and order history
 */

import { AudienceFilter, SegmentRule } from "./types.js";

/**
 * Supported filter fields for audience segmentation
 */
export type FilterField =
  | "customer.tags"
  | "customer.city"
  | "customer.totalOrders"
  | "customer.lastOrderDate"
  | "customer.totalSpent"
  | "order.status"
  | "order.zone";

/**
 * Query result with parameter bindings
 */
export interface QueryResult {
  query: string;
  params: (string | number | boolean | null)[];
}

/**
 * Pagination input
 */
export interface PaginationInput {
  limit: number;
  offset: number;
}

/**
 * Recipient result with basic info
 */
export interface RecipientResult {
  customerId: string;
  email?: string;
  phone?: string;
  name?: string;
}

/**
 * Error class for audience builder
 */
export class AudienceBuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AudienceBuilderError";
  }
}

/**
 * AudienceBuilder class for constructing parameterized SQL queries
 * All queries use parameter binding to prevent SQL injection
 */
export class AudienceBuilder {
  /**
   * Build a parameterized SQL query from audience filters
   * Supports complex filtering with AND/OR logic
   */
  buildQuery(tenantId: string, filters?: AudienceFilter[]): QueryResult {
    if (!tenantId) {
      throw new AudienceBuilderError("tenantId is required");
    }

    const params: (string | number | boolean | null)[] = [tenantId];
    let whereConditions: string[] = [];

    if (filters && filters.length > 0) {
      const filterConditions = this.buildFilterConditions(filters, params);
      whereConditions.push(`(${filterConditions})`);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const query = `
      SELECT DISTINCT c.id as "customerId", c.email, c.phone, c.name
      FROM customers c
      ${whereClause}
      AND c.tenant_id = $1
      ORDER BY c.created_at DESC
    `;

    return { query, params };
  }

  /**
   * Build a COUNT query to estimate audience size
   */
  buildCountQuery(tenantId: string, filters?: AudienceFilter[]): QueryResult {
    if (!tenantId) {
      throw new AudienceBuilderError("tenantId is required");
    }

    const params: (string | number | boolean | null)[] = [tenantId];
    let whereConditions: string[] = [];

    if (filters && filters.length > 0) {
      const filterConditions = this.buildFilterConditions(filters, params);
      whereConditions.push(`(${filterConditions})`);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const query = `
      SELECT COUNT(DISTINCT c.id) as count
      FROM customers c
      ${whereClause}
      AND c.tenant_id = $1
    `;

    return { query, params };
  }

  /**
   * Build pagination-aware query
   */
  buildPaginatedQuery(
    tenantId: string,
    filters: AudienceFilter[] | undefined,
    pagination: PaginationInput,
  ): QueryResult {
    if (!tenantId) {
      throw new AudienceBuilderError("tenantId is required");
    }

    if (pagination.limit <= 0 || pagination.limit > 10000) {
      throw new AudienceBuilderError("limit must be between 1 and 10000");
    }

    if (pagination.offset < 0) {
      throw new AudienceBuilderError("offset must be non-negative");
    }

    const params: (string | number | boolean | null)[] = [tenantId];
    let whereConditions: string[] = [];

    if (filters && filters.length > 0) {
      const filterConditions = this.buildFilterConditions(filters, params);
      whereConditions.push(`(${filterConditions})`);
    }

    const paramOffset = params.length + 1;
    const paramLimit = params.length + 2;

    params.push(pagination.offset, pagination.limit);

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const query = `
      SELECT DISTINCT c.id as "customerId", c.email, c.phone, c.name
      FROM customers c
      ${whereClause}
      AND c.tenant_id = $1
      ORDER BY c.created_at DESC
      OFFSET $${paramOffset}
      LIMIT $${paramLimit}
    `;

    return { query, params };
  }

  /**
   * Build filter conditions with proper parameterization
   */
  private buildFilterConditions(
    filters: AudienceFilter[],
    params: (string | number | boolean | null)[],
  ): string {
    const conditions = filters.map((filter) => {
      return this.buildSingleFilterCondition(filter, params);
    });

    return conditions.join(" AND ");
  }

  /**
   * Build a single filter condition
   */
  private buildSingleFilterCondition(
    filter: AudienceFilter,
    params: (string | number | boolean | null)[],
  ): string {
    const operator = filter.operator || "equals";
    const paramIndex = params.length + 1;

    // Parse field path (e.g., "customer.tags" -> ["customer", "tags"])
    const parts = filter.type.split(".");
    if (parts.length === 0) {
      throw new AudienceBuilderError(`Invalid filter type: ${filter.type}`);
    }

    switch (filter.type) {
      case "location":
        params.push(filter.value);
        return `c.city = $${paramIndex}`;

      case "status":
        params.push(filter.value);
        return `c.status = $${paramIndex}`;

      case "tag":
        params.push(filter.value);
        return `c.tags @> $${paramIndex}::jsonb`;

      case "subscription_status":
        params.push(filter.value);
        return `c.subscription_status = $${paramIndex}`;

      case "engagement":
        return this.buildEngagementFilter(filter, params);

      case "custom_field":
        params.push(filter.value);
        return `c.metadata @> jsonb_build_object('custom_field', $${paramIndex})`;

      default:
        throw new AudienceBuilderError(
          `Unsupported filter type: ${filter.type}`,
        );
    }
  }

  /**
   * Build engagement-based filter conditions
   */
  private buildEngagementFilter(
    filter: AudienceFilter,
    params: (string | number | boolean | null)[],
  ): string {
    // engagement filters might check last order date, total orders, etc.
    const value = filter.value.toLowerCase();

    if (value === "high") {
      return `c.total_orders >= 5`;
    } else if (value === "medium") {
      return `c.total_orders >= 2 AND c.total_orders < 5`;
    } else if (value === "low") {
      return `c.total_orders = 1`;
    } else if (value === "inactive") {
      // Last order more than 90 days ago
      return `c.last_order_date < NOW() - INTERVAL '90 days'`;
    } else if (value === "active") {
      // Last order within 30 days
      return `c.last_order_date >= NOW() - INTERVAL '30 days'`;
    }

    throw new AudienceBuilderError(`Unknown engagement value: ${value}`);
  }

  /**
   * Validate a single segment rule
   */
  private validateSegmentRule(rule: SegmentRule): void {
    if (!rule.field) {
      throw new AudienceBuilderError("Segment rule field is required");
    }

    const validOperators = [
      "equals",
      "contains",
      "gt",
      "lt",
      "gte",
      "lte",
      "in",
      "between",
      "startsWith",
      "endsWith",
    ];

    if (!validOperators.includes(rule.operator)) {
      throw new AudienceBuilderError(
        `Invalid operator: ${rule.operator}. Must be one of: ${validOperators.join(", ")}`,
      );
    }

    if (!rule.value) {
      throw new AudienceBuilderError("Segment rule value is required");
    }
  }

  /**
   * Build query from segment rules (more flexible filtering)
   */
  buildSegmentQuery(tenantId: string, rules: SegmentRule[]): QueryResult {
    if (!tenantId) {
      throw new AudienceBuilderError("tenantId is required");
    }

    if (!rules || rules.length === 0) {
      throw new AudienceBuilderError("At least one segment rule is required");
    }

    // Validate all rules
    rules.forEach((rule) => this.validateSegmentRule(rule));

    const params: (string | number | boolean | null)[] = [tenantId];
    const conditions = rules.map((rule) => {
      return this.buildSegmentCondition(rule, params);
    });

    const logic = rules[0]?.logic || "AND";
    const whereClause = conditions.join(` ${logic} `);

    const query = `
      SELECT DISTINCT c.id as "customerId", c.email, c.phone, c.name
      FROM customers c
      WHERE (${whereClause})
      AND c.tenant_id = $1
      ORDER BY c.created_at DESC
    `;

    return { query, params };
  }

  /**
   * Build a single segment condition
   */
  private buildSegmentCondition(
    rule: SegmentRule,
    params: (string | number | boolean | null)[],
  ): string {
    const paramIndex = params.length + 1;
    const operator = rule.operator;
    const field = this.mapFieldToColumn(rule.field);

    switch (operator) {
      case "equals":
        params.push(rule.value);
        return `${field} = $${paramIndex}`;

      case "contains":
        params.push(`%${rule.value}%`);
        return `${field} ILIKE $${paramIndex}`;

      case "gt":
        params.push(rule.value);
        return `${field} > $${paramIndex}`;

      case "lt":
        params.push(rule.value);
        return `${field} < $${paramIndex}`;

      case "gte":
        params.push(rule.value);
        return `${field} >= $${paramIndex}`;

      case "lte":
        params.push(rule.value);
        return `${field} <= $${paramIndex}`;

      case "in":
        if (!Array.isArray(rule.value)) {
          throw new AudienceBuilderError(
            'Value for "in" operator must be an array',
          );
        }
        const placeholders = rule.value
          .map((v) => {
            params.push(v);
            return `$${params.length}`;
          })
          .join(", ");
        return `${field} IN (${placeholders})`;

      case "between":
        if (!Array.isArray(rule.value) || rule.value.length !== 2) {
          throw new AudienceBuilderError(
            'Value for "between" operator must be a 2-element array [min, max]',
          );
        }
        params.push(rule.value[0], rule.value[1]);
        return `${field} BETWEEN $${params.length - 1} AND $${params.length}`;

      case "startsWith":
        params.push(`${rule.value}%`);
        return `${field} ILIKE $${paramIndex}`;

      case "endsWith":
        params.push(`%${rule.value}`);
        return `${field} ILIKE $${paramIndex}`;

      default:
        throw new AudienceBuilderError(`Unsupported operator: ${operator}`);
    }
  }

  /**
   * Map logical field names to database columns
   */
  private mapFieldToColumn(field: string): string {
    const mapping: Record<string, string> = {
      "customer.tags": "c.tags",
      "customer.city": "c.city",
      "customer.totalOrders": "c.total_orders",
      "customer.lastOrderDate": "c.last_order_date",
      "customer.totalSpent": "c.total_spent",
      "order.status":
        "(SELECT status FROM orders WHERE customer_id = c.id ORDER BY created_at DESC LIMIT 1)",
      "order.zone":
        "(SELECT zone_id FROM orders WHERE customer_id = c.id ORDER BY created_at DESC LIMIT 1)",
    };

    if (mapping[field]) {
      return mapping[field];
    }

    throw new AudienceBuilderError(`Unsupported field: ${field}`);
  }
}
