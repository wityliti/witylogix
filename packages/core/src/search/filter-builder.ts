/**
 * Filter Builder — Dynamic query builder with operator support and SQL injection prevention.
 *
 * Supports:
 * - Operators: eq, ne, gt, gte, lt, lte, in, not_in, contains, starts_with, between, is_null
 * - Field types: string, number, date, enum, boolean, array
 * - Composite filters: AND, OR, NOT
 * - Date shortcuts: today, yesterday, this_week, this_month, last_30_days, custom
 * - Status shortcuts for each entity type
 * - Parameterized queries (safe from SQL injection)
 */

// ─── TYPES ──────────────────────────────────────────────────────────

export type FilterOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains"
  | "starts_with"
  | "between"
  | "is_null";

export type FieldType =
  | "string"
  | "number"
  | "date"
  | "enum"
  | "boolean"
  | "array";

export type DateShortcut =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_30_days"
  | "custom";

export interface FilterRule {
  field: string;
  operator: FilterOperator;
  value?: any;
  type?: FieldType;
}

export interface CompositeFilter {
  AND?: (FilterRule | CompositeFilter)[];
  OR?: (FilterRule | CompositeFilter)[];
  NOT?: (FilterRule | CompositeFilter)[];
}

export interface FilterConfig {
  table: string;
  alias?: string;
  filters: FilterRule | CompositeFilter;
}

// ─── STATUS SHORTCUTS ───────────────────────────────────────────────

const STATUS_SHORTCUTS: Record<string, Record<string, string[]>> = {
  orders: {
    pending: ["PENDING", "ACCEPTED"],
    in_progress: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"],
    completed: ["DELIVERED"],
    failed: ["FAILED", "CANCELLED", "RETURNED"],
  },
  drivers: {
    active: ["ACTIVE"],
    inactive: ["INACTIVE"],
    on_duty: ["ON_DUTY"],
    off_duty: ["OFF_DUTY"],
  },
  deliveries: {
    pending: ["PENDING"],
    in_progress: ["IN_PROGRESS"],
    completed: ["COMPLETED"],
    failed: ["FAILED"],
  },
};

// ─── DATE RANGE SHORTCUTS ───────────────────────────────────────────

function getDateRange(shortcut: DateShortcut): [Date, Date] {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date, end: Date;

  switch (shortcut) {
    case "today":
      start = startOfDay;
      end = new Date(startOfDay.getTime() + 86400000); // +1 day
      break;

    case "yesterday":
      start = new Date(startOfDay.getTime() - 86400000);
      end = startOfDay;
      break;

    case "this_week":
      const dayOfWeek = now.getDay();
      start = new Date(
        startOfDay.getTime() - (dayOfWeek || 7) * 86400000 + 86400000,
      ); // Monday
      end = new Date(
        startOfDay.getTime() + (7 - (dayOfWeek || 7)) * 86400000 + 86400000,
      ); // Next Monday
      break;

    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;

    case "last_30_days":
      end = new Date(startOfDay.getTime() + 86400000);
      start = new Date(end.getTime() - 30 * 86400000);
      break;

    case "custom":
      return [startOfDay, new Date()];

    default:
      return [startOfDay, new Date()];
  }

  return [start, end];
}

// ─── FILTER BUILDER ─────────────────────────────────────────────────

export class FilterBuilder {
  private params: any[] = [];
  private paramIndex: number = 1;

  /**
   * Build SQL WHERE clause from filter configuration.
   */
  buildWhereClause(config: FilterConfig): { sql: string; params: any[] } {
    this.params = [];
    this.paramIndex = 1;

    const alias = config.alias || config.table;
    const whereClauses = this.buildFilterClauses(config.filters, alias);

    return {
      sql: whereClauses.join(" AND "),
      params: this.params,
    };
  }

  /**
   * Build individual filter clauses.
   */
  private buildFilterClauses(
    filter: FilterRule | CompositeFilter,
    alias: string,
  ): string[] {
    const clauses: string[] = [];

    // Handle composite filters
    if ("AND" in filter) {
      const andClauses = filter.AND!.map((f) =>
        this.buildFilterClauses(f, alias).join(" AND "),
      );
      clauses.push(`(${andClauses.join(") AND (")})`);
    }

    if ("OR" in filter) {
      const orClauses = filter.OR!.map((f) =>
        this.buildFilterClauses(f, alias).join(" AND "),
      );
      clauses.push(`(${orClauses.join(") OR (")})`);
    }

    if ("NOT" in filter) {
      const notClauses = filter.NOT!.map((f) =>
        this.buildFilterClauses(f, alias).join(" AND "),
      );
      clauses.push(`NOT (${notClauses.join(" AND ")})`);
    }

    // Handle single filter rule
    if ("field" in filter) {
      clauses.push(this.buildSingleFilter(filter, alias));
    }

    return clauses.filter((c) => c.length > 0);
  }

  /**
   * Build SQL for a single filter rule.
   */
  private buildSingleFilter(filter: FilterRule, alias: string): string {
    const fieldRef = `${alias}."${filter.field}"`;
    const paramRef = `$${this.paramIndex}`;

    switch (filter.operator) {
      case "eq":
        this.params.push(filter.value);
        return filter.value === null
          ? `${fieldRef} IS NULL`
          : `${fieldRef} = ${paramRef}`;

      case "ne":
        this.params.push(filter.value);
        return filter.value === null
          ? `${fieldRef} IS NOT NULL`
          : `${fieldRef} != ${paramRef}`;

      case "gt":
        this.params.push(filter.value);
        return `${fieldRef} > ${paramRef}`;

      case "gte":
        this.params.push(filter.value);
        return `${fieldRef} >= ${paramRef}`;

      case "lt":
        this.params.push(filter.value);
        return `${fieldRef} < ${paramRef}`;

      case "lte":
        this.params.push(filter.value);
        return `${fieldRef} <= ${paramRef}`;

      case "in":
        this.params.push(
          Array.isArray(filter.value) ? filter.value : [filter.value],
        );
        return `${fieldRef} = ANY(${paramRef}::text[])`;

      case "not_in":
        this.params.push(
          Array.isArray(filter.value) ? filter.value : [filter.value],
        );
        return `${fieldRef} != ALL(${paramRef}::text[])`;

      case "contains":
        this.params.push(`%${filter.value}%`);
        return `${fieldRef} ILIKE ${paramRef}`;

      case "starts_with":
        this.params.push(`${filter.value}%`);
        return `${fieldRef} ILIKE ${paramRef}`;

      case "between":
        if (!Array.isArray(filter.value) || filter.value.length !== 2) {
          throw new Error("Between operator requires array with two values");
        }
        this.params.push(filter.value[0]);
        this.params.push(filter.value[1]);
        return `${fieldRef} BETWEEN $${this.paramIndex++} AND $${this.paramIndex}`;

      case "is_null":
        return filter.value ? `${fieldRef} IS NULL` : `${fieldRef} IS NOT NULL`;

      default:
        throw new Error(`Unknown operator: ${filter.operator}`);
    }

    this.paramIndex++;
  }

  /**
   * Apply status shortcut to filters.
   */
  static applyStatusShortcut(
    shortcuts: Record<string, string[]>,
    statusShortcut: string,
  ): string[] {
    return shortcuts[statusShortcut] || [statusShortcut];
  }

  /**
   * Build date range filter for a field.
   */
  static buildDateRangeFilter(
    field: string,
    shortcut: DateShortcut,
  ): FilterRule[] {
    const [start, end] = getDateRange(shortcut);

    return [
      {
        field,
        operator: "gte",
        value: start.toISOString(),
        type: "date",
      },
      {
        field,
        operator: "lt",
        value: end.toISOString(),
        type: "date",
      },
    ];
  }

  /**
   * Merge multiple filter rules with AND logic.
   */
  static mergeFilters(
    ...filters: (FilterRule | CompositeFilter)[]
  ): CompositeFilter {
    return {
      AND: filters,
    };
  }

  /**
   * Create OR filter from multiple rules.
   */
  static orFilters(
    ...filters: (FilterRule | CompositeFilter)[]
  ): CompositeFilter {
    return {
      OR: filters,
    };
  }
}

// ─── FILTER PRESETS ─────────────────────────────────────────────────

export const ORDER_FILTERS = {
  pending: {
    field: "status",
    operator: "in" as FilterOperator,
    value: STATUS_SHORTCUTS.orders.pending,
  },
  in_progress: {
    field: "status",
    operator: "in" as FilterOperator,
    value: STATUS_SHORTCUTS.orders.in_progress,
  },
  completed: {
    field: "status",
    operator: "eq" as FilterOperator,
    value: "DELIVERED",
  },
  failed: {
    field: "status",
    operator: "in" as FilterOperator,
    value: STATUS_SHORTCUTS.orders.failed,
  },
};

export const DRIVER_FILTERS = {
  active: {
    field: "status",
    operator: "eq" as FilterOperator,
    value: "ACTIVE",
  },
  on_duty: {
    field: "status",
    operator: "eq" as FilterOperator,
    value: "ON_DUTY",
  },
};

/**
 * Validate filter rule structure.
 */
export function validateFilter(filter: FilterRule | CompositeFilter): boolean {
  if ("field" in filter) {
    return (
      typeof filter.field === "string" &&
      typeof filter.operator === "string" &&
      filter.value !== undefined
    );
  }

  if ("AND" in filter || "OR" in filter || "NOT" in filter) {
    return true;
  }

  return false;
}
