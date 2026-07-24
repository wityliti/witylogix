/**
 * Natural Language Filter Parser
 *
 * Parses natural language queries into structured filters:
 * - "overdue orders from last week" → { status: 'overdue', dateRange: 'last_week' }
 * - "drivers near downtown" → { entity: 'driver', location: 'downtown' }
 * - "unpaid invoices over $500" → { entity: 'invoice', status: 'unpaid', amount: { gt: 500 } }
 *
 * Uses pattern matching, regex, and keyword extraction with fallback to text search.
 */

// ─── TYPES ─────────────────────────────────────────────────────────────

export type Entity = "order" | "driver" | "delivery" | "customer" | "invoice";

export interface DateExpression {
  range:
    | "today"
    | "yesterday"
    | "this_week"
    | "last_week"
    | "this_month"
    | "last_month"
    | "custom";
  startDate?: Date;
  endDate?: Date;
}

export interface AmountCondition {
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  eq?: number;
}

export interface LocationCondition {
  keyword: string;
  type?: "zip" | "city" | "area" | "address";
}

export interface StructuredFilter {
  entity?: Entity;
  status?: string;
  dateRange?: DateExpression;
  amount?: AmountCondition;
  location?: LocationCondition;
  tags?: string[];
  customFields?: Record<string, unknown>;
  fullTextFallback?: boolean;
  rawQuery?: string;
}

// ─── PATTERNS & KEYWORDS ────────────────────────────────────────────────

const ENTITY_PATTERNS = {
  delivery: /\b(deliveries?|delivery)\b/i,
  order: /\b(orders?|shipments?)\b/i,
  driver: /\b(drivers?|couriers?)\b/i,
  customer: /\b(customers?|clients?|accounts?)\b/i,
  invoice: /\b(invoices?|bills?|payments?)\b/i,
};

const STATUS_KEYWORDS: Record<string, string[]> = {
  pending: ["pending", "waiting", "new", "unassigned"],
  completed: ["completed", "done", "finished", "delivered"],
  failed: ["failed", "cancelled", "rejected"],
  overdue: ["overdue", "late", "delayed"],
  active: ["active", "in_progress", "ongoing"],
  unpaid: ["unpaid", "outstanding", "due"],
  paid: ["paid", "settled", "closed"],
};

const DATE_PATTERNS: Record<string, RegExp> = {
  today: /\btoday\b/i,
  yesterday: /\byesterday\b/i,
  this_week: /\bthis\s+week\b/i,
  last_week: /\blast\s+week\b/i,
  this_month: /\bthis\s+month\b/i,
  last_month: /\blast\s+month\b/i,
};

const AMOUNT_PATTERNS = {
  gt: /(?:over|@)\s*\$?([\d,]+(?:\.\d+)?)/i,
  gte: /at\s+least\s+\$?([\d,]+(?:\.\d+)?)/i,
  lt: /under\s+\$?([\d,]+(?:\.\d+)?)/i,
  lte: /up\s+to\s+\$?([\d,]+(?:\.\d+)?)/i,
  eq: /exactly\s+\$?([\d,]+(?:\.\d+)?)/i,
};

// ─── NATURAL LANGUAGE FILTER PARSER ─────────────────────────────────────

export class NaturalLanguageFilterParser {
  /**
   * Parse natural language query into structured filter
   */
  parse(query: string): StructuredFilter {
    const filter: StructuredFilter = {
      rawQuery: query,
    };

    // Detect entity type
    filter.entity = this.detectEntity(query);

    // Extract status
    filter.status = this.extractStatus(query);

    // Extract date range
    const dateRange = this.extractDateRange(query);
    if (dateRange) {
      filter.dateRange = dateRange;
    }

    // Extract amount condition
    const amount = this.extractAmount(query);
    if (amount) {
      filter.amount = amount;
    }

    // Extract location
    const location = this.extractLocation(query);
    if (location) {
      filter.location = location;
    }

    // Extract tags/keywords
    filter.tags = this.extractTags(query);

    // If no structured pattern matched, use full-text search
    if (
      !filter.status &&
      !filter.dateRange &&
      !filter.amount &&
      !filter.location
    ) {
      filter.fullTextFallback = true;
    }

    return filter;
  }

  /**
   * Detect the entity type from query
   */
  private detectEntity(query: string): Entity | undefined {
    let bestEntity: Entity | undefined;
    let bestPosition = Infinity;

    for (const [entity, pattern] of Object.entries(ENTITY_PATTERNS)) {
      const match = query.match(pattern);
      if (match && match.index !== undefined && match.index < bestPosition) {
        bestPosition = match.index;
        bestEntity = entity as Entity;
      }
    }
    return bestEntity;
  }

  /**
   * Extract status from keywords
   */
  private extractStatus(query: string): string | undefined {
    const lowerQuery = query.toLowerCase();

    for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
      for (const keyword of keywords) {
        if (new RegExp(`\\b${keyword}\\b`).test(lowerQuery)) {
          return status;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract date range expression
   */
  private extractDateRange(query: string): DateExpression | undefined {
    for (const [range, pattern] of Object.entries(DATE_PATTERNS)) {
      if (pattern.test(query)) {
        const startDate = this.getDateRangeStart(range as any);
        const endDate = this.getDateRangeEnd(range as any);

        return {
          range: range as any,
          startDate,
          endDate,
        };
      }
    }

    // Try to extract custom date range (e.g., "from Jan 1 to Jan 31")
    const customDateMatch = query.match(
      /from\s+(\w+\s+\d+)\s+to\s+(\w+\s+\d+)/i,
    );
    if (customDateMatch) {
      return {
        range: "custom",
        startDate: this.parseCustomDate(customDateMatch[1]),
        endDate: this.parseCustomDate(customDateMatch[2]),
      };
    }

    return undefined;
  }

  /**
   * Extract amount condition
   */
  private extractAmount(query: string): AmountCondition | undefined {
    const condition: AmountCondition = {};

    for (const [operator, pattern] of Object.entries(AMOUNT_PATTERNS)) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const amount = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(amount)) {
          (condition as any)[operator] = amount;
        }
      }
    }

    return Object.keys(condition).length > 0 ? condition : undefined;
  }

  /**
   * Extract location information
   */
  private extractLocation(query: string): LocationCondition | undefined {
    // Look for "near [location]"
    const nearMatch = query.match(/near\s+(\w+(?:\s+\w+)?)/i);
    if (nearMatch) {
      return {
        keyword: nearMatch[1],
        type: this.detectLocationType(nearMatch[1]),
      };
    }

    // Look for "in [location]"
    const inMatch = query.match(/in\s+(\w+(?:\s+\w+)?)/i);
    if (inMatch) {
      return {
        keyword: inMatch[1],
        type: this.detectLocationType(inMatch[1]),
      };
    }

    // Look for zip code (5 or 9 digit)
    const zipMatch = query.match(/\b(\d{5}(?:-\d{4})?)\b/);
    if (zipMatch) {
      return {
        keyword: zipMatch[1],
        type: "zip",
      };
    }

    return undefined;
  }

  /**
   * Extract tags and keywords
   */
  private extractTags(query: string): string[] {
    const tags: string[] = [];

    // Extract hashtags
    const hashtagMatches = query.match(/#\w+/g);
    if (hashtagMatches) {
      tags.push(...hashtagMatches.map((t) => t.substring(1)));
    }

    // Extract quoted phrases
    const quotedMatches = query.match(/"([^"]+)"/g);
    if (quotedMatches) {
      tags.push(...quotedMatches.map((t) => t.slice(1, -1)));
    }

    return tags;
  }

  /**
   * Detect location type
   */
  private detectLocationType(
    location: string,
  ): "zip" | "city" | "area" | "address" {
    if (/^\d{5}(-\d{4})?$/.test(location)) {
      return "zip";
    }
    if (/downtown|uptown|district|zone|region/i.test(location)) {
      return "area";
    }
    // Default to city for most cases
    return "city";
  }

  /**
   * Get start date for relative date ranges
   */
  private getDateRangeStart(
    range:
      | "today"
      | "yesterday"
      | "this_week"
      | "last_week"
      | "this_month"
      | "last_month",
  ): Date {
    const now = new Date();
    switch (range) {
      case "today":
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case "yesterday":
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate(),
        );
      case "this_week":
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        return new Date(
          weekStart.getFullYear(),
          weekStart.getMonth(),
          weekStart.getDate(),
        );
      case "last_week":
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
        return new Date(
          lastWeekStart.getFullYear(),
          lastWeekStart.getMonth(),
          lastWeekStart.getDate(),
        );
      case "this_month":
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case "last_month":
        return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    }
  }

  /**
   * Get end date for relative date ranges
   */
  private getDateRangeEnd(
    range:
      | "today"
      | "yesterday"
      | "this_week"
      | "last_week"
      | "this_month"
      | "last_month",
  ): Date {
    const now = new Date();
    switch (range) {
      case "today":
        return now;
      case "yesterday":
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
      case "this_week":
        return now;
      case "last_week":
        const lastWeekEnd = new Date(now);
        lastWeekEnd.setDate(now.getDate() - now.getDay() - 1);
        return lastWeekEnd;
      case "this_month":
        return now;
      case "last_month":
        return new Date(now.getFullYear(), now.getMonth(), 0);
    }
  }

  /**
   * Parse custom date format (simple implementation)
   */
  private parseCustomDate(dateStr: string): Date {
    // Try parsing with native Date constructor
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Fallback: return today's date
    return new Date();
  }
}

// ─── FACTORY ────────────────────────────────────────────────────────────

export function createNLFilterParser(): NaturalLanguageFilterParser {
  return new NaturalLanguageFilterParser();
}

export const nlFilterParser = createNLFilterParser();
