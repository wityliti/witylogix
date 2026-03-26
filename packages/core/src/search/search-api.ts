/**
 * Search API Endpoints — Full-text search, suggestions, and saved searches.
 *
 * Endpoints:
 * - GET /api/search?q={query}&type={entity}&limit=20&offset=0
 * - GET /api/search/suggestions?q={prefix}&limit=5
 * - GET /api/search/saved — list saved searches
 * - POST /api/search/saved — save a search
 * - DELETE /api/search/saved/:id — delete saved search
 *
 * All endpoints require authentication and tenant context.
 */

import { z } from "zod";
import { TenantContext } from "../tenant/types";
import { SearchEngine, SearchableEntity, SearchResult } from "./search-engine";
import { PrismaClient } from "@prisma/client";

// ─── VALIDATION SCHEMAS ─────────────────────────────────────────────

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200).describe("Search query"),
  type: z
    .enum(["orders", "drivers", "deliveries", "integrations", "customers"])
    .optional()
    .describe("Entity type to search"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  useFuzzy: z.coerce.boolean().default(true),
});

export const suggestionsQuerySchema = z.object({
  q: z.string().min(1).max(50).describe("Query prefix"),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export const savedSearchSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.string().min(1).max(200),
  filters: z.record(z.any()).optional(),
  entityType: z
    .enum(["orders", "drivers", "deliveries", "integrations", "customers"])
    .optional(),
});

// ─── TYPES ──────────────────────────────────────────────────────────

export interface SavedSearch {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  query: string;
  filters?: Record<string, any>;
  entityType?: SearchableEntity;
  createdAt: Date;
  updatedAt: Date;
}

// ─── SEARCH API SERVICE ──────────────────────────────────────────────

export class SearchApiService {
  private engine: SearchEngine;
  private prisma: PrismaClient;

  constructor(engine: SearchEngine, prisma: PrismaClient) {
    this.engine = engine;
    this.prisma = prisma;
  }

  /**
   * Execute search with validation.
   */
  async search(
    query: string,
    tenant: TenantContext,
    options: {
      type?: SearchableEntity;
      limit?: number;
      offset?: number;
      useFuzzy?: boolean;
    } = {}
  ): Promise<{ results: SearchResult[]; total: number }> {
    // Validate inputs
    const validated = searchQuerySchema.parse({
      q: query,
      type: options.type,
      limit: options.limit || 20,
      offset: options.offset || 0,
      useFuzzy: options.useFuzzy !== false,
    });

    // Track search analytics
    await this.trackSearch(tenant, validated.q, validated.type);

    // Execute search
    const entities = validated.type
      ? ([validated.type] as SearchableEntity[])
      : undefined;

    const results = await this.engine.search(validated.q, tenant, {
      entities,
      limit: validated.limit,
      offset: validated.offset,
      useFuzzy: validated.useFuzzy,
    });

    return {
      results,
      total: results.length, // Ideally would count total matches
    };
  }

  /**
   * Get type-ahead suggestions.
   */
  async getSuggestions(
    prefix: string,
    tenant: TenantContext,
    limit: number = 5
  ): Promise<string[]> {
    const validated = suggestionsQuerySchema.parse({ q: prefix, limit });

    const suggestions = await this.engine.getSuggestions(validated.q, tenant, validated.limit);

    return suggestions;
  }

  /**
   * Save a search for later use.
   */
  async saveSearch(
    userId: string,
    tenant: TenantContext,
    search: z.infer<typeof savedSearchSchema>
  ): Promise<SavedSearch> {
    const validated = savedSearchSchema.parse(search);

    // Save to database
    const saved = await (this.prisma as any).savedSearch.create({
      data: {
        userId,
        tenantId: tenant.orgId,
        name: validated.name,
        query: validated.query,
        filters: validated.filters,
        entityType: validated.entityType,
      },
    });

    return {
      id: saved.id,
      tenantId: saved.tenantId,
      userId: saved.userId,
      name: saved.name,
      query: saved.query,
      filters: saved.filters,
      entityType: saved.entityType,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  /**
   * List saved searches for user.
   */
  async listSavedSearches(
    userId: string,
    tenant: TenantContext,
    options: { limit?: number; offset?: number } = {}
  ): Promise<SavedSearch[]> {
    const { limit = 20, offset = 0 } = options;

    const searches = await (this.prisma as any).savedSearch.findMany({
      where: {
        userId,
        tenantId: tenant.orgId,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    return searches.map((s: any) => ({
      id: s.id,
      tenantId: s.tenantId,
      userId: s.userId,
      name: s.name,
      query: s.query,
      filters: s.filters,
      entityType: s.entityType,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  /**
   * Delete a saved search.
   */
  async deleteSavedSearch(searchId: string, tenant: TenantContext): Promise<void> {
    await (this.prisma as any).savedSearch.deleteMany({
      where: {
        id: searchId,
        tenantId: tenant.orgId,
      },
    });
  }

  /**
   * Track search for analytics.
   */
  private async trackSearch(
    tenant: TenantContext,
    query: string,
    entityType?: SearchableEntity
  ): Promise<void> {
    try {
      await (this.prisma as any).searchAnalytics.create({
        data: {
          tenantId: tenant.orgId,
          query,
          entityType,
          timestamp: new Date(),
          resultCount: 0, // Will be updated after search
        },
      });
    } catch (error) {
      // Silent fail - analytics should not block search
      console.debug("Failed to track search:", error);
    }
  }

  /**
   * Get popular searches for tenant.
   */
  async getPopularSearches(
    tenant: TenantContext,
    options: { limit?: number; days?: number } = {}
  ): Promise<Array<{ query: string; count: number }>> {
    const { limit = 10, days = 7 } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const results = await (this.prisma as any).$queryRawUnsafe(
      `
      SELECT query, COUNT(*) as count
      FROM search_analytics
      WHERE tenant_id = $1 AND timestamp >= $2
      GROUP BY query
      ORDER BY count DESC
      LIMIT $3
    `,
      tenant.orgId,
      cutoffDate,
      limit
    );

    return (results as any[]).map((r) => ({
      query: r.query,
      count: parseInt(r.count),
    }));
  }

  /**
   * Get search quality metrics.
   */
  async getSearchMetrics(
    tenant: TenantContext,
    options: { days?: number } = {}
  ): Promise<{
    totalSearches: number;
    zeroResultQueries: number;
    avgResultsPerQuery: number;
    uniqueQueries: number;
  }> {
    const { days = 7 } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const results = await (this.prisma as any).$queryRawUnsafe(
      `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN result_count = 0 THEN 1 END) as zero_results,
        AVG(result_count) as avg_results,
        COUNT(DISTINCT query) as unique_queries
      FROM search_analytics
      WHERE tenant_id = $1 AND timestamp >= $2
    `,
      tenant.orgId,
      cutoffDate
    );

    const row = results[0];
    return {
      totalSearches: parseInt(row.total) || 0,
      zeroResultQueries: parseInt(row.zero_results) || 0,
      avgResultsPerQuery: parseFloat(row.avg_results) || 0,
      uniqueQueries: parseInt(row.unique_queries) || 0,
    };
  }
}

/**
 * Factory function to create search API service.
 */
export function createSearchApiService(
  engine: SearchEngine,
  prisma: PrismaClient
): SearchApiService {
  return new SearchApiService(engine, prisma);
}
