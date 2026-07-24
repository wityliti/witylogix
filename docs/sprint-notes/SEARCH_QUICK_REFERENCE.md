# Search & Filtering Infrastructure — Quick Reference

## 9 Files Created | 3,019 Lines of Code

### Backend (5 modules + 1 test suite)

**packages/core/src/search/**

1. **search-engine.ts** (458 lines)
   - PostgreSQL tsvector/tsquery search
   - Multi-entity support (orders, drivers, deliveries, integrations, customers)
   - Fuzzy matching, highlighting, suggestions
   - Tenant-scoped with deduplication

2. **search-api.ts** (314 lines)
   - RESTful endpoints: `/api/search`, `/api/search/suggestions`, `/api/search/saved`
   - Zod validation schemas
   - Analytics tracking
   - Saved search CRUD

3. **filter-builder.ts** (363 lines)
   - 12 operators: eq, ne, gt, gte, lt, lte, in, not_in, contains, starts_with, between, is_null
   - Composite filters: AND, OR, NOT
   - Date shortcuts, status presets
   - SQL injection-safe parameterized queries

4. **search-analytics.ts** (370 lines)
   - Event recording: searches, clicks, execution time
   - Reports: popular searches, zero-results, trends
   - Quality metrics aggregation

5. **index.ts** (41 lines)
   - Public API exports

6. \***\*tests**/filter-builder.test.ts\*\* (360 lines)
   - 30+ test cases
   - Operator coverage, SQL injection tests
   - Vitest suite

### Frontend (1 hook + 2 components)

**apps/dashboard/src/**

7. **hooks/use-search.ts** (376 lines)
   - Debounced search (300ms)
   - Type-ahead suggestions
   - Recent searches (localStorage)
   - Keyboard navigation (↑↓ Enter Esc)
   - Error states, loading indicators

8. **components/search/search-command-palette.tsx** (373 lines)
   - Cmd+K hotkey activation
   - Grouped results by entity
   - Quick actions (Create Order, Add Driver, View Map)
   - Recent searches fallback
   - Dark theme, keyboard nav

9. **components/search/filter-panel.tsx** (364 lines)
   - Collapsible filter sidebar
   - Status multi-select
   - Date range picker with shortcuts
   - Active filter chips (removable)
   - Save/clear presets
   - Dark theme

## Key APIs

### Search Engine

```typescript
const engine = new SearchEngine(prisma, {
  weights: { A: 1.0, B: 0.7, C: 0.5, D: 0.3 },
  fuzzyThreshold: 0.3,
  minRank: 0.01,
});

const results = await engine.search(query, tenant, {
  entities: ["orders", "drivers"],
  limit: 20,
  offset: 0,
  useFuzzy: true,
});
```

### Search API Service

```typescript
const service = new SearchApiService(engine, prisma);

// Search
const { results, total } = await service.search(query, tenant, options);

// Suggestions
const suggestions = await service.getSuggestions(prefix, tenant);

// Analytics
const metrics = await service.getSearchMetrics(tenant, { days: 7 });
```

### Filter Builder

```typescript
const builder = new FilterBuilder();

const filters = {
  AND: [
    { field: "status", operator: "in", value: ["ACTIVE", "PENDING"] },
    { field: "createdAt", operator: "gte", value: "2024-01-01" },
  ],
};

const { sql, params } = builder.buildWhereClause({
  table: "orders",
  filters,
});
```

### useSearch Hook

```typescript
const search = useSearch({
  type: 'orders',
  limit: 20,
  debounceMs: 300,
  onSearch: (results) => console.log(results),
  onError: (error) => console.error(error)
});

return (
  <>
    <input {...search.register} />
    {search.isLoading && <div>Searching...</div>}
    {search.results.map(r => <div key={r.id}>{r.title}</div>)}
  </>
);
```

### Search Command Palette

```typescript
import { SearchCommandPalette } from '@/components/search/search-command-palette';

<SearchCommandPalette />
// Hotkey: Cmd+K (or Ctrl+K on Linux/Windows)
```

### Filter Panel

```typescript
<FilterPanel
  entityType="orders"
  onFiltersChange={(filters) => applyFilters(filters)}
  onSavePreset={(name, filters) => savePreset(name, filters)}
/>
```

## Database Setup

```sql
-- Create extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create tables
CREATE TABLE search_analytics_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  query TEXT,
  result_count INT,
  execution_time_ms INT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE saved_searches (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name VARCHAR(100),
  query TEXT,
  filters JSONB
);

-- Create indexes for search
CREATE INDEX idx_orders_tsvector ON orders USING GIN(
  setweight(to_tsvector('english', external_order_id), 'A') ||
  setweight(to_tsvector('english', customer_name), 'B')
);
```

## Testing

```bash
# Run filter builder tests
npm test -- filter-builder.test.ts

# Coverage
npm test -- --coverage filter-builder.test.ts
```

## Performance Notes

- **Search latency**: ~50-200ms (PostgreSQL + debounce)
- **Debounce default**: 300ms
- **Results limit**: 20-100 per request
- **Recent searches**: 10 items max in localStorage
- **Analytics**: Non-blocking async write

## Conventions

- **Tailwind**: v3.4, dark theme (gray-900, gray-800)
- **Validation**: Zod schemas on all inputs
- **Types**: Full TypeScript with exports
- **Naming**: `useSearch`, `SearchEngine`, `FilterBuilder` (PascalCase classes)
- **Error handling**: Try-catch with fallbacks, no test keys
- **Comments**: JSDoc on public APIs, inline for complex logic

## Integration Checklist

- [ ] Create database tables (search_analytics_events, saved_searches)
- [ ] Create search indexes on orders, drivers tables
- [ ] Add API routes (/api/search, /api/search/suggestions, /api/search/saved)
- [ ] Add SearchCommandPalette to layout
- [ ] Add FilterPanel to list pages
- [ ] Export hooks/components from index files
- [ ] Add search to navigation/header
- [ ] Configure environment variables if needed
- [ ] Run tests: `npm test -- filter-builder.test.ts`
- [ ] Build: `npm run build` (no errors expected)

## Files Location

```
/packages/core/src/search/
├── search-engine.ts (458 lines)
├── search-api.ts (314 lines)
├── filter-builder.ts (363 lines)
├── search-analytics.ts (370 lines)
├── index.ts (41 lines)
└── __tests__/
    └── filter-builder.test.ts (360 lines)

/apps/dashboard/src/
├── hooks/
│   └── use-search.ts (376 lines)
└── components/search/
    ├── search-command-palette.tsx (373 lines)
    └── filter-panel.tsx (364 lines)
```

## Documentation

Full documentation: See `SEARCH_INFRASTRUCTURE_SUMMARY.md`

---

**Status**: ✅ Complete (Sprint 7.1)
