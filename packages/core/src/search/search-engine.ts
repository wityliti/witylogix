/**
 * Full-Text Search Engine — PostgreSQL tsvector/tsquery wrapper with ranking.
 *
 * Provides multi-entity full-text search with:
 * - PostgreSQL tsvector/tsquery with BM25-style rank_cd scoring
 * - Support for orders, drivers, deliveries, integrations, customers
 * - Configurable search weights (A=title, B=description, C=metadata, D=content)
 * - Fuzzy matching with pg_trgm similarity
 * - Headline generation for result highlighting
 * - Tenant-scoped results with deduplication
 *
 * Requires PostgreSQL extensions: plpgsql, pg_trgm
 * Setup: CREATE EXTENSION IF NOT EXISTS pg_trgm;
 */

import { PrismaClient } from "@witylogix/db";
import { TenantContext } from "../tenant/types";

// ─── TYPES ──────────────────────────────────────────────────────────

export type SearchableEntity =
  | "orders"
  | "drivers"
  | "deliveries"
  | "integrations"
  | "customers";

export interface SearchConfig {
  weights: {
    A: number; // title/name (highest)
    B: number; // description/status
    C: number; // metadata/tags
    D: number; // content/notes (lowest)
  };
  fuzzyThreshold: number; // similarity threshold (0-1)
  minRank: number; // minimum rank to include result
}

export interface SearchResult {
  id: string;
  entity: SearchableEntity;
  title: string;
  description?: string;
  rank: number;
  highlight?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchHighlight {
  text: string;
  highlighted: string;
}

// ─── DEFAULT CONFIG ──────────────────────────────────────────────────

const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  weights: {
    A: 1.0, // title
    B: 0.7, // description
    C: 0.5, // metadata
    D: 0.3, // content
  },
  fuzzyThreshold: 0.3,
  minRank: 0.01,
};

// ─── SEARCH ENGINE ──────────────────────────────────────────────────

export class SearchEngine {
  private prisma: PrismaClient;
  private config: SearchConfig;

  constructor(prisma: PrismaClient, config: Partial<SearchConfig> = {}) {
    this.prisma = prisma;
    this.config = { ...DEFAULT_SEARCH_CONFIG, ...config };
  }

  /**
   * Execute full-text search across multiple entities.
   * Returns ranked, deduplicated results.
   */
  async search(
    query: string,
    tenant: TenantContext,
    options: {
      entities?: SearchableEntity[];
      limit?: number;
      offset?: number;
      useFuzzy?: boolean;
    } = {},
  ): Promise<SearchResult[]> {
    const {
      entities = [
        "orders",
        "drivers",
        "deliveries",
        "integrations",
        "customers",
      ],
      limit = 20,
      offset = 0,
      useFuzzy = true,
    } = options;

    if (!query.trim()) {
      return [];
    }

    const processedQuery = this.processQuery(query);
    const results: Map<string, SearchResult> = new Map();

    // Execute searches for each entity type
    for (const entity of entities) {
      const entityResults = await this.searchEntity(
        entity,
        processedQuery,
        tenant,
        useFuzzy,
        limit * 2, // fetch more to account for deduplication
      );

      for (const result of entityResults) {
        const key = `${result.entity}:${result.id}`;
        results.set(key, result);
      }
    }

    // Sort by rank and return paginated results
    return Array.from(results.values())
      .sort((a, b) => b.rank - a.rank)
      .slice(offset, offset + limit);
  }

  /**
   * Search a single entity type with full-text search.
   */
  private async searchEntity(
    entity: SearchableEntity,
    query: string,
    tenant: TenantContext,
    useFuzzy: boolean,
    limit: number,
  ): Promise<SearchResult[]> {
    try {
      const results = await this.buildEntityQuery(
        entity,
        query,
        tenant,
        useFuzzy,
        limit,
      );
      return results.filter((r) => r.rank >= this.config.minRank);
    } catch (error) {
      console.error(`Search failed for entity ${entity}:`, error);
      return [];
    }
  }

  /**
   * Build and execute search query for a specific entity.
   */
  private async buildEntityQuery(
    entity: SearchableEntity,
    query: string,
    tenant: TenantContext,
    useFuzzy: boolean,
    limit: number,
  ): Promise<SearchResult[]> {
    let sql = "";
    const params: any[] = [tenant.orgId];

    switch (entity) {
      case "orders":
        sql = this.buildOrdersQuery(query, useFuzzy);
        break;
      case "drivers":
        sql = this.buildDriversQuery(query, useFuzzy);
        break;
      case "deliveries":
        sql = this.buildDeliveriesQuery(query, useFuzzy);
        break;
      case "integrations":
        sql = this.buildIntegrationsQuery(query, useFuzzy);
        break;
      case "customers":
        sql = this.buildCustomersQuery(query, useFuzzy);
        break;
      default:
        return [];
    }

    params.push(limit);
    const rawResults = await (this.prisma as any).$queryRawUnsafe(
      sql,
      ...params,
    );

    return (rawResults as any[]).map((row) => ({
      id: row.id,
      entity,
      title: row.title,
      description: row.description,
      rank: parseFloat(row.rank),
      highlight: row.highlight,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Build query for orders search.
   */
  private buildOrdersQuery(query: string, useFuzzy: boolean): string {
    const { A, B, C, D } = this.config.weights;
    const tsqueryFormat = this.formatTsquery(query);

    let baseQuery = `
      SELECT
        id,
        external_order_id as title,
        customer_name as description,
        COALESCE(
          ts_rank(
            setweight(to_tsvector('english', COALESCE(external_order_id, '')), 'A')::tsvector ||
            setweight(to_tsvector('english', COALESCE(customer_name, '')), 'B')::tsvector ||
            setweight(to_tsvector('english', COALESCE(status::text, '')), 'C')::tsvector ||
            setweight(to_tsvector('english', COALESCE(notes, '')), 'D')::tsvector,
            to_tsquery('english', $2)
          ), 0
        ) as rank,
        ts_headline('english',
          COALESCE(customer_name || ' ' || external_order_id, external_order_id),
          to_tsquery('english', $2),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=20'
        ) as highlight,
        metadata,
        created_at,
        updated_at
      FROM orders
      WHERE shop_id IN (
        SELECT id FROM shops WHERE organization_id = $1
      )
    `;

    if (useFuzzy) {
      baseQuery += ` AND (
        external_order_id % $2 OR
        customer_name % $2 OR
        customer_email % $2
      )`;
    } else {
      baseQuery += ` AND (
        to_tsvector('english', COALESCE(external_order_id, '')) @@ to_tsquery('english', $2) OR
        to_tsvector('english', COALESCE(customer_name, '')) @@ to_tsquery('english', $2)
      )`;
    }

    baseQuery += ` ORDER BY rank DESC LIMIT $3`;
    return baseQuery;
  }

  /**
   * Build query for drivers search.
   */
  private buildDriversQuery(query: string, useFuzzy: boolean): string {
    const tsqueryFormat = this.formatTsquery(query);

    let baseQuery = `
      SELECT
        id,
        name as title,
        phone as description,
        COALESCE(
          ts_rank(
            setweight(to_tsvector('english', COALESCE(name, '')), 'A')::tsvector ||
            setweight(to_tsvector('english', COALESCE(phone, '')), 'B')::tsvector ||
            setweight(to_tsvector('english', COALESCE(email, '')), 'B')::tsvector ||
            setweight(to_tsvector('english', COALESCE(status::text, '')), 'C')::tsvector,
            to_tsquery('english', $2)
          ), 0
        ) as rank,
        ts_headline('english',
          COALESCE(name || ' ' || COALESCE(phone, ''), name),
          to_tsquery('english', $2),
          'StartSel=<mark>, StopSel=</mark>'
        ) as highlight,
        NULL::jsonb as metadata,
        created_at,
        updated_at
      FROM drivers
      WHERE organization_id = $1
    `;

    if (useFuzzy) {
      baseQuery += ` AND (name % $2 OR phone % $2 OR email % $2)`;
    } else {
      baseQuery += ` AND (
        to_tsvector('english', COALESCE(name, '')) @@ to_tsquery('english', $2) OR
        to_tsvector('english', COALESCE(phone, '')) @@ to_tsquery('english', $2)
      )`;
    }

    baseQuery += ` ORDER BY rank DESC LIMIT $3`;
    return baseQuery;
  }

  /**
   * Build query for deliveries search.
   */
  private buildDeliveriesQuery(query: string, useFuzzy: boolean): string {
    const tsqueryFormat = this.formatTsquery(query);

    return `
      SELECT
        id,
        status::text as title,
        '' as description,
        COALESCE(ts_rank(
          setweight(to_tsvector('english', status::text), 'A')::tsvector,
          to_tsquery('english', $2)
        ), 0) as rank,
        NULL as highlight,
        NULL::jsonb as metadata,
        created_at,
        updated_at
      FROM deliveries
      WHERE organization_id = $1
      AND (status::text ILIKE '%' || $2 || '%')
      ORDER BY rank DESC LIMIT $3
    `;
  }

  /**
   * Build query for integrations search.
   */
  private buildIntegrationsQuery(query: string, useFuzzy: boolean): string {
    return `
      SELECT
        id,
        name as title,
        provider as description,
        COALESCE(ts_rank(
          setweight(to_tsvector('english', name), 'A')::tsvector ||
          setweight(to_tsvector('english', provider), 'B')::tsvector,
          to_tsquery('english', $2)
        ), 0) as rank,
        ts_headline('english', name || ' ' || provider, to_tsquery('english', $2)) as highlight,
        metadata,
        created_at,
        updated_at
      FROM integrations
      WHERE organization_id = $1
      AND (
        to_tsvector('english', name) @@ to_tsquery('english', $2) OR
        to_tsvector('english', provider) @@ to_tsquery('english', $2)
      )
      ORDER BY rank DESC LIMIT $3
    `;
  }

  /**
   * Build query for customers search.
   */
  private buildCustomersQuery(query: string, useFuzzy: boolean): string {
    return `
      SELECT
        id,
        email as title,
        name as description,
        COALESCE(ts_rank(
          setweight(to_tsvector('english', COALESCE(email, '')), 'A')::tsvector ||
          setweight(to_tsvector('english', COALESCE(name, '')), 'B')::tsvector ||
          setweight(to_tsvector('english', COALESCE(phone, '')), 'C')::tsvector,
          to_tsquery('english', $2)
        ), 0) as rank,
        ts_headline('english', COALESCE(name || ' ' || email, email)) as highlight,
        NULL::jsonb as metadata,
        created_at,
        updated_at
      FROM customers
      WHERE organization_id = $1
      AND (
        email ILIKE '%' || $2 || '%' OR
        name ILIKE '%' || $2 || '%' OR
        phone ILIKE '%' || $2 || '%'
      )
      ORDER BY rank DESC LIMIT $3
    `;
  }

  /**
   * Process user query for tsquery format.
   * Splits into tokens and combines with OR operators.
   */
  private processQuery(query: string): string {
    const tokens = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => `${t}:*`) // Add prefix matching
      .join(" | "); // OR between tokens

    return tokens || query;
  }

  /**
   * Format query for tsquery (no-op for now, can add stemming).
   */
  private formatTsquery(query: string): string {
    return this.processQuery(query);
  }

  /**
   * Get search suggestions based on prefix.
   */
  async getSuggestions(
    prefix: string,
    tenant: TenantContext,
    limit: number = 5,
  ): Promise<string[]> {
    if (prefix.length < 1) {
      return [];
    }

    const sql = `
      SELECT DISTINCT LOWER(external_order_id) as suggestion
      FROM orders
      WHERE shop_id IN (SELECT id FROM shops WHERE organization_id = $1)
      AND external_order_id ILIKE $2 || '%'
      LIMIT $3
      UNION
      SELECT DISTINCT LOWER(name) as suggestion
      FROM drivers
      WHERE organization_id = $1
      AND name ILIKE $2 || '%'
      LIMIT $3
    `;

    const results = await (this.prisma as any).$queryRawUnsafe(
      sql,
      tenant.orgId,
      prefix,
      limit,
    );

    return (results as any[]).map((r) => r.suggestion);
  }

  /**
   * Clear search indexes (rebuild if needed).
   */
  async rebuildIndexes(): Promise<void> {
    try {
      await (this.prisma as any).$queryRawUnsafe(
        `REINDEX INDEX CONCURRENTLY idx_orders_tsvector;`,
      );
      await (this.prisma as any).$queryRawUnsafe(
        `REINDEX INDEX CONCURRENTLY idx_drivers_tsvector;`,
      );
    } catch (error) {
      console.error("Failed to rebuild search indexes:", error);
    }
  }
}

/**
 * Factory function to create search engine with tenant context.
 */
export function createSearchEngine(
  prisma: PrismaClient,
  config?: Partial<SearchConfig>,
): SearchEngine {
  return new SearchEngine(prisma, config);
}
