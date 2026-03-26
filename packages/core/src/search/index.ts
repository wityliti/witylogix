/**
 * Search & Filtering Infrastructure — Exports for all search modules.
 *
 * This module provides a comprehensive search and filtering toolkit:
 * - Full-text search with PostgreSQL tsvector/tsquery
 * - Multi-entity search (orders, drivers, deliveries, integrations, customers)
 * - Dynamic filter builder with composite support
 * - Search analytics and quality metrics
 * - Type-ahead suggestions
 * - Saved searches
 */

export { SearchEngine, createSearchEngine } from "./search-engine.js";
export type { SearchableEntity, SearchConfig, SearchResult, SearchHighlight } from "./search-engine.js";

export {
  SearchApiService,
  createSearchApiService,
  searchQuerySchema,
  suggestionsQuerySchema,
  savedSearchSchema,
} from "./search-api.js";
export type { SavedSearch } from "./search-api.js";

export {
  FilterBuilder,
  ORDER_FILTERS,
  DRIVER_FILTERS,
  validateFilter,
} from "./filter-builder.js";
export type {
  FilterOperator,
  FieldType,
  DateShortcut,
  FilterRule,
  CompositeFilter,
  FilterConfig,
} from "./filter-builder.js";

export { SearchAnalytics, createSearchAnalytics } from "./search-analytics.js";
export type { SearchAnalyticsEvent, SearchAnalyticsReport } from "./search-analytics.js";
