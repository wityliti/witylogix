# Sprint 7.1: Search & Filtering Infrastructure

## Overview

Comprehensive search and filtering infrastructure for the Witylogix platform with full-text PostgreSQL search, advanced filtering, analytics, and React UI components.

## Files Created

### Backend (packages/core/src/search/)

#### 1. **search-engine.ts** (458 lines)

PostgreSQL tsvector/tsquery wrapper with BM25-style ranking.

**Key Features:**

- Multi-entity full-text search (orders, drivers, deliveries, integrations, customers)
- PostgreSQL tsvector/tsquery with rank_cd scoring
- Configurable search weights (A=title, B=description, C=metadata, D=content)
- Fuzzy matching with pg_trgm similarity
- Headline generation for result highlighting
- Tenant-scoped results with deduplication
- Type-ahead suggestions

**Exports:**

- `SearchEngine` class
- `createSearchEngine()` factory
- `SearchableEntity`, `SearchConfig`, `SearchResult`, `SearchHighlight` types

**Database Requirements:**

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Search indexes will be created by migration
CREATE INDEX idx_orders_tsvector ON orders USING GIN(
  setweight(to_tsvector('english', external_order_id), 'A') ||
  setweight(to_tsvector('english', customer_name), 'B') ||
  setweight(to_tsvector('english', status::text), 'C')
);
```

#### 2. **search-api.ts** (314 lines)

RESTful search API with Zod validation.

**Endpoints:**

- `GET /api/search?q={query}&type={entity}&limit=20&offset=0` - Search
- `GET /api/search/suggestions?q={prefix}&limit=5` - Type-ahead
- `GET /api/search/saved` - List saved searches
- `POST /api/search/saved` - Save search
- `DELETE /api/search/saved/:id` - Delete saved search

**Key Features:**

- Zod validation for all endpoints
- Search analytics tracking (query terms, result counts)
- Popular searches aggregation
- Search quality metrics (zero-result rate, performance)
- Saved searches with metadata

**Exports:**

- `SearchApiService` class
- `createSearchApiService()` factory
- Validation schemas: `searchQuerySchema`, `suggestionsQuerySchema`, `savedSearchSchema`

#### 3. **filter-builder.ts** (363 lines)

Dynamic filter builder with SQL injection prevention.

**Operators Supported:**

- Comparison: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`
- Containment: `in`, `not_in`, `contains`, `starts_with`
- Range: `between`
- Null: `is_null`

**Features:**

- Composite filters: AND, OR, NOT
- Date shortcuts: `today`, `yesterday`, `this_week`, `this_month`, `last_30_days`, `custom`
- Status shortcuts for each entity (ORDER_FILTERS, DRIVER_FILTERS)
- Parameterized queries (prevents SQL injection)
- Field type awareness (string, number, date, enum, boolean, array)

**Exports:**

- `FilterBuilder` class with static helpers
- Filter types: `FilterRule`, `CompositeFilter`, `FilterConfig`
- Preset filters: `ORDER_FILTERS`, `DRIVER_FILTERS`
- `validateFilter()` helper

#### 4. **search-analytics.ts** (370 lines)

Search analytics and quality metrics.

**Tracked Events:**

- Query terms and frequency
- Result counts (including zero-result queries)
- Click-through rates
- Execution time metrics
- Entity type distribution

**Reports Generated:**

- Comprehensive analytics report (totals, trends, top queries)
- Zero-result queries (content gaps)
- Click-through rates per query
- Search trends over time (hourly, daily, weekly buckets)

**Features:**

- Event recording with automatic aggregation
- Click-through tracking
- Retention policy cleanup
- Slow query detection (>100ms)

**Exports:**

- `SearchAnalytics` class
- `createSearchAnalytics()` factory
- `SearchAnalyticsEvent`, `SearchAnalyticsReport` types

#### 5. **index.ts** (41 lines)

Module exports and re-exports.

**Exports all public APIs from search modules.**

#### 6. \***\*tests**/filter-builder.test.ts\*\* (360 lines)

Comprehensive test suite for FilterBuilder.

**Test Coverage:**

- ✓ Single filter rules (eq, ne, gt, contains, etc.)
- ✓ Composite filters (AND, OR, NOT with nesting)
- ✓ SQL injection prevention
- ✓ Date range shortcuts
- ✓ Status filter presets
- ✓ Filter merging and validation

**Run:** `npm test -- filter-builder.test.ts`

### Frontend (apps/dashboard/src/)

#### 1. **hooks/use-search.ts** (376 lines)

React hook for search with debouncing and state management.

**Features:**

- Debounced search (300ms default, configurable)
- Type-ahead suggestions from API
- Recent searches (persisted to localStorage)
- Keyboard navigation (↑↓ select, Enter confirm)
- Error handling and retry
- Loading states
- Query string builder

**Usage:**

```tsx
const search = useSearch({ limit: 20, debounceMs: 300 });

return (
  <>
    <input {...search.register} />
    {search.isLoading && <Spinner />}
    {search.results.map((r) => (
      <div key={r.id}>{r.title}</div>
    ))}
  </>
);
```

**Exports:**

- `useSearch()` hook
- `SearchResult`, `SearchSuggestion`, `UseSearchOptions`, `UseSearchState` types

#### 2. **components/search/search-command-palette.tsx** (373 lines)

Global command palette with Cmd+K hotkey.

**Features:**

- Cmd+K hotkey to toggle (Ctrl+K on Linux/Windows)
- Search across all entities
- Grouped results by entity type (Orders, Drivers, Deliveries, etc.)
- Recent searches section
- Quick actions (Create Order, Add Driver, View Map)
- Keyboard navigation with visual feedback
- Dark theme with Tailwind CSS v3.4
- Result highlighting with entity-type badges

**Component Structure:**

- Search input with debounce
- Loading indicator
- Grouped result list
- Recent searches fallback
- Quick actions when empty
- Navigation hints (footer)

**Usage:**

```tsx
import { SearchCommandPalette } from "@/components/search/search-command-palette";

export default function Layout() {
  return (
    <>
      <SearchCommandPalette />
      {/* rest of app */}
    </>
  );
}
```

#### 3. **components/search/filter-panel.tsx** (364 lines)

Collapsible sidebar for advanced filtering.

**Features:**

- Collapsible filter sections
- Active filter chips (removable)
- Multi-select status dropdown
- Date range picker with shortcuts
- Custom date range input
- Filter preset saving
- Clear all filters button
- Dark theme with Tailwind CSS v3.4

**Filter Sections:**

- Status (multi-select)
- Date Range (shortcuts + custom picker)
- Extensible for entity-specific filters

**Component Structure:**

- Collapsible header
- Active filters display as removable chips
- Filter input sections
- Save preset modal
- Action buttons (Save, Clear)

**Usage:**

```tsx
const [filters, setFilters] = useState<Filter[]>([]);

return (
  <FilterPanel
    entityType="orders"
    onFiltersChange={setFilters}
    onSavePreset={(name, filters) => savePreset(name, filters)}
  />
);
```

## Architecture & Design

### Full-Text Search Flow

```
User Query
   ↓
useSearch() hook (debounce 300ms)
   ↓
GET /api/search?q={query}
   ↓
SearchApiService.search()
   ↓
SearchEngine.search()
   ↓
PostgreSQL tsvector/tsquery
   ↓
Ranked results + highlights
   ↓
Component renders results
```

### Filter Building Flow

```
User Selects Filters
   ↓
FilterPanel.tsx updates state
   ↓
FilterBuilder.buildWhereClause()
   ↓
Parameterized SQL (injection-safe)
   ↓
Query database
   ↓
Update results
```

### Analytics Flow

```
Search executed
   ↓
SearchAnalytics.recordSearch()
   ↓
searchAnalyticsEvent table
   ↓
Aggregation queries (top searches, slow queries, etc.)
   ↓
Reports generated on demand
```

## Configuration & Setup

### Tailwind CSS Setup

All components use:

- **Base:** `cn()` utility from `@/lib/utils`
- **Theme:** Dark mode (gray-900, gray-800, etc.)
- **Colors:** Blue accents for active states
- **Responsive:** Mobile-first design

### Database Migrations Required

```sql
-- Search analytics tables
CREATE TABLE search_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  query TEXT NOT NULL,
  entity_type VARCHAR(50),
  result_count INT DEFAULT 0,
  execution_time_ms INT,
  has_zero_results BOOLEAN,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES organizations(id)
);

CREATE TABLE search_click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  query TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_type VARCHAR(50),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  query TEXT NOT NULL,
  filters JSONB,
  entity_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES organizations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_search_analytics_tenant_timestamp ON search_analytics_events(tenant_id, timestamp DESC);
CREATE INDEX idx_search_analytics_query ON search_analytics_events(tenant_id, query);
CREATE INDEX idx_saved_searches_tenant_user ON saved_searches(tenant_id, user_id);
```

### API Integration Points

Add these routes to your Next.js API:

```typescript
// apps/api/search/route.ts
import { SearchApiService, SearchEngine } from "@witylogix/core/search";

export async function GET(req) {
  const { q, type, limit, offset } = req.nextUrl.searchParams;
  const service = createSearchApiService(engine, prisma);
  return json(await service.search(q, tenant, { type, limit, offset }));
}

// apps/api/search/suggestions/route.ts
export async function GET(req) {
  const { q, limit } = req.nextUrl.searchParams;
  return json(await service.getSuggestions(q, tenant, limit));
}
```

## Testing

### Run Filter Builder Tests

```bash
npm test -- filter-builder.test.ts
```

### Test Coverage

- 30+ test cases covering operators, composition, injection prevention
- Vitest with vi mocking
- Validates edge cases (NULL, ranges, arrays)

## Performance Characteristics

### Search Performance

- PostgreSQL tsvector lookup: O(log n) with GIN index
- Fuzzy matching with pg_trgm: O(n) but indexed
- Pagination: limit 20-100 results per request
- Debounce: 300ms prevents excessive queries

### Filter Performance

- Parameterized queries: Safe from injection
- Index utilization on filtered fields
- Support for composite indexes on (tenant_id, field)

### Analytics Performance

- Async tracking (non-blocking)
- Aggregation queries run on read, not write
- Retention policy (cleanup old events)

## Conventions Applied

### Code Style

- Named imports: `import { SearchEngine } from '@/search'`
- Prisma as any: `(prisma as any).modelName`
- Zod validation for all input
- JSDoc comments on public APIs
- No test secret keys

### Component Design

- Button variants: "primary" | "secondary" | "ghost" | "danger"
- Tailwind CSS v3.4 with dark theme
- Fully accessible keyboard navigation
- Responsive mobile-first
- Proper error boundaries

### Naming Conventions

- Classes: `SearchEngine`, `FilterBuilder`, `SearchAnalytics`
- Hooks: `useSearch` (not `useSearchHook`)
- Components: `SearchCommandPalette`, `FilterPanel`
- Types: `SearchResult`, `FilterRule` (PascalCase)

## Extensions & Future Work

### Potential Enhancements

1. **Advanced Analytics:**
   - A/B testing search UX changes
   - ML-based result ranking
   - Query reformulation suggestions

2. **Search Features:**
   - Faceted search (count by status, entity type)
   - Saved search alerts
   - Shared search collections
   - Advanced query syntax (boolean operators)

3. **Performance:**
   - Search result caching (Redis)
   - Query suggestion cache
   - Elasticsearch migration for scale

4. **UI Enhancements:**
   - Search result previews
   - Entity type filtering chips
   - Inline filter editing
   - Drag-and-drop filter builder

## File Locations Summary

| File                       | Location                              | Lines     |
| -------------------------- | ------------------------------------- | --------- |
| search-engine.ts           | packages/core/src/search/             | 458       |
| search-api.ts              | packages/core/src/search/             | 314       |
| filter-builder.ts          | packages/core/src/search/             | 363       |
| search-analytics.ts        | packages/core/src/search/             | 370       |
| index.ts                   | packages/core/src/search/             | 41        |
| filter-builder.test.ts     | packages/core/src/search/**tests**/   | 360       |
| use-search.ts              | apps/dashboard/src/hooks/             | 376       |
| search-command-palette.tsx | apps/dashboard/src/components/search/ | 373       |
| filter-panel.tsx           | apps/dashboard/src/components/search/ | 364       |
| **Total**                  |                                       | **3,019** |

## Validation Checklist

- ✓ Full-text search with PostgreSQL tsvector/tsquery
- ✓ Multi-entity search (orders, drivers, deliveries, integrations, customers)
- ✓ Search configuration with weights
- ✓ Highlight matching with ts_headline
- ✓ Fuzzy matching with pg_trgm similarity
- ✓ Tenant-scoped results
- ✓ Result deduplication
- ✓ Search API endpoints with Zod validation
- ✓ Type-ahead suggestions
- ✓ Saved searches CRUD
- ✓ Filter operators (eq, ne, gt, gte, lt, lte, in, not_in, contains, starts_with, between, is_null)
- ✓ Composite filters (AND, OR, NOT)
- ✓ Date range shortcuts
- ✓ Status shortcuts per entity
- ✓ SQL injection prevention with parameterized queries
- ✓ Search analytics tracking
- ✓ Popular searches aggregation
- ✓ Search quality metrics
- ✓ useSearch hook with debouncing
- ✓ Keyboard navigation
- ✓ Recent searches (localStorage)
- ✓ Search command palette (Cmd+K)
- ✓ Filter panel with collapsible sections
- ✓ Active filter chips
- ✓ Save filter presets
- ✓ Tailwind CSS v3.4 dark theme
- ✓ Comprehensive tests (150+ lines)

---

**Sprint 7.1 Complete** ✓
