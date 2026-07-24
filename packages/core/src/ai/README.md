# AI Module — Sprint 7.1

Advanced AI-powered search and smart suggestions for the Witylogix platform.

## Overview

The AI module provides four core services:

1. **Semantic Search** — Vector-based search with hybrid BM25+vector fusion
2. **Smart Suggestions** — Context-aware, actionable recommendations
3. **Natural Language Filter** — Parse NL queries into structured filters
4. **Search Ranking** — ML-based result ranking with personalization

## Files

### Core Modules

- **`semantic-search.ts`** (397 lines)
  - Embedding generation (OpenAI ada-002, sentence-transformers, TF-IDF)
  - pgvector similarity search with cosine distance
  - Hybrid search combining BM25 text + vector semantic with RRF
  - Multi-entity indexing (orders, drivers, deliveries, customers, integrations)
  - Index lifecycle: add, update, delete, batch operations

- **`smart-suggestions.ts`** (399 lines)
  - Page-context suggestions (orders, drivers, dashboard, deliveries, analytics)
  - Time-based suggestions (morning briefing, evening summary)
  - Rule-based condition engine
  - Priority scoring (urgency × relevance × recency)
  - Dismiss/snooze per suggestion with cache
  - Interaction tracking for learning

- **`natural-language-filter.ts`** (352 lines)
  - Parse NL queries into structured filters
  - Entity detection (order, driver, delivery, customer, invoice)
  - Status extraction (pending, completed, overdue, active, unpaid, paid)
  - Date range parsing (today, yesterday, last week, this month, custom)
  - Amount/currency extraction ($100, $1,500, etc.)
  - Location detection (near downtown, zip codes)
  - Tag/hashtag extraction
  - Fallback to full-text search when no patterns match

- **`search-ranking.ts`** (369 lines)
  - Feature extraction (text relevance, recency, popularity, user interactions)
  - Weighted linear combination scoring
  - Personalization via user interaction history
  - Click-through rate tracking
  - A/B testing support for ranking experiments
  - Engagement metrics per entity

- **`index.ts`** (47 lines)
  - Unified exports for all AI services

### Tests

- **`__tests__/semantic-search.test.ts`** (385 lines)
  - Embedding generation consistency
  - Vector similarity scoring
  - BM25 text scoring
  - Index management (add, update, delete)
  - Batch indexing
  - Vector search filtering
  - Hybrid search with RRF fusion
  - Tenant isolation
  - Edge cases

- **`__tests__/natural-language-filter.test.ts`** (339 lines)
  - Entity detection (all 5 types)
  - Status extraction (all 7 statuses)
  - Date range parsing (all patterns + custom)
  - Amount extraction (gt, gte, lt, lte, eq)
  - Location detection (near, in, zip codes)
  - Tag extraction (hashtags, quoted phrases)
  - Complex multi-part queries
  - Fallback behavior
  - Edge cases (empty, special chars, case-insensitivity)

- **`__tests__/smart-suggestions.test.ts`** (416 lines)
  - Context-aware generation (orders, drivers, dashboard)
  - Priority scoring and urgency ordering
  - Time-based suggestions (morning, evening)
  - Suggestion properties validation
  - Dismiss functionality per user
  - Snooze with configurable duration
  - Interaction tracking (click, action)
  - Custom rule registration
  - Edge cases

## Usage Examples

### Semantic Search

```typescript
import { createSemanticSearch } from "@witylogix/core/ai";

const search = createSemanticSearch("tfidf"); // or "openai-ada-002"

// Index content
await search.indexEntity(
  "order_123",
  "order",
  "Urgent delivery to downtown",
  "tenant_1",
);

// Vector search
const results = await search.vectorSearch("delivery downtown", "tenant_1");

// Hybrid search (vector + text with RRF)
const hybrid = await search.hybridSearch({
  query: "delivery downtown",
  tenantId: "tenant_1",
  entityTypes: ["order"],
  limit: 10,
  vectorWeight: 0.6,
  textWeight: 0.4,
});
```

### Smart Suggestions

```typescript
import { getSmartSuggestions } from "@witylogix/core/ai";

const engine = getSmartSuggestions();

const context = {
  tenantId: "tenant_1",
  userId: "user_1",
  currentPage: "orders",
  timeOfDay: "morning",
  timestamp: Date.now(),
};

const suggestions = await engine.generateSuggestions(context);
// Returns 5 top suggestions by priority/urgency

// Dismiss for user
await engine.dismissSuggestion(suggestions[0].id, "tenant_1", "user_1");

// Snooze 60 minutes
await engine.snooze(suggestions[1].id, "tenant_1", "user_1", 60);

// Track interaction
await engine.trackInteraction(suggestions[2].id, "tenant_1", "user_1", true);
```

### Natural Language Parsing

```typescript
import { nlFilterParser } from "@witylogix/core/ai";

// Parse a natural language query
const filter = nlFilterParser.parse(
  "overdue orders from last week over $500 near downtown #urgent",
);

// Result:
// {
//   entity: "order",
//   status: "overdue",
//   dateRange: { range: "last_week", ... },
//   amount: { gt: 500 },
//   location: { keyword: "downtown", type: "area" },
//   tags: ["urgent"],
//   rawQuery: "...",
// }

// Use structured filter in DB queries
if (filter.entity === "order" && filter.status) {
  const orders = await prisma.order.findMany({
    where: { status: filter.status },
  });
}
```

### Search Ranking

```typescript
import { createSearchRanker } from "@witylogix/core/ai";

const ranker = createSearchRanker({
  textRelevance: 0.35,
  recency: 0.2,
  popularity: 0.2,
  userInteractionScore: 0.15,
  engagementRate: 0.08,
  entityTypeBonus: 0.02,
});

// Extract features and score
const features = await ranker.extractFeatures(
  "order_123",
  "order",
  "delivery downtown",
  "urgent delivery to downtown for customer...",
  new Date(),
  "user_1",
  "tenant_1",
);

const score = ranker.scoreResult(features, "user_1");

// Track interaction for learning
await ranker.trackInteraction({
  queryId: "q_456",
  entityId: "order_123",
  entityType: "order",
  userId: "user_1",
  tenantId: "tenant_1",
  position: 0,
  clicked: true,
  actionTaken: true,
  dwellTime: 5000,
  timestamp: new Date(),
});

// A/B test ranking variants
ranker.registerABTest({
  testId: "ranking_v2_test",
  name: "Ranking Algorithm V2",
  enabled: true,
  weightingA: {
    /* old weights */
  },
  weightingB: {
    /* new weights */
  },
  splitPercentage: 50,
});

const results = await getTestResults("ranking_v2_test");
// { variantA: 0.15, variantB: 0.18 } // CTR
```

## Architecture

### Embedding Generation (Pluggable)

Three options for vector embeddings:

1. **OpenAI ada-002** — Production-grade, 1536-dim vectors
2. **Sentence-Transformers** — Local, privacy-preserving
3. **TF-IDF** — Lightweight fallback, no external deps

Switch at runtime:

```typescript
const search = createSemanticSearch("openai-ada-002", openaiApiKey);
```

### Hybrid Search: BM25 + Vector + RRF

Combines two ranking systems:

1. **BM25 Text** — Traditional keyword relevance
2. **Vector Similarity** — Semantic understanding

Unified with **Reciprocal Rank Fusion (RRF)**:

```
RRF(r_bm25, r_vector) = 1/(60 + r_bm25) + 1/(60 + r_vector)
```

Ensures top results are semantically relevant AND keyword-matched.

### Suggestion Rule Engine

Pluggable condition system:

```typescript
engine.registerRule({
  id: "custom_rule",
  name: "High Value Orders",
  condition: (ctx) =>
    ctx.currentPage === "orders" && ctx.data?.orderValue > 5000,
  suggestionFactory: (ctx) => ({
    title: "VIP Order Attention Needed",
    description: `${ctx.data?.orderCount || 0} high-value orders pending`,
    urgency: "high",
    actionUrl: "/orders?filter=high_value",
  }),
  enabled: true,
});
```

### Ranking Personalization

User interaction history boosts familiar entities:

- Click on entity → +0.1 score
- Action taken → +0.3 score
- Cumulative, capped at 1.0

Enables learning without explicit training.

## Database Schema

Requires these tables (generated via Prisma):

- **`SearchIndex`** — Embeddings and content

  ```
  id, entityId, entityType, tenantId, content, embedding[], metadata
  ```

- **`SuggestionDismissal`** — Dismissed suggestions

  ```
  id, suggestionId, tenantId, userId, dismissedAt
  ```

- **`SuggestionSnooze`** — Snoozed suggestions

  ```
  id, suggestionId, tenantId, userId, snoozedUntil
  ```

- **`SearchInteraction`** — Click/action tracking
  ```
  id, queryId, entityId, entityType, userId, tenantId, position, clicked, actionTaken, dwellTime
  ```

## Testing

Run all tests:

```bash
npm run test packages/core -- ai
```

Individual test files:

```bash
npm run test packages/core -- semantic-search.test.ts
npm run test packages/core -- natural-language-filter.test.ts
npm run test packages/core -- smart-suggestions.test.ts
```

Coverage:

- **Semantic Search**: 28 tests (embeddings, similarity, BM25, indexing, hybrid search, tenant isolation)
- **NL Filter**: 45 tests (entity detection, status, dates, amounts, locations, tags, edge cases)
- **Smart Suggestions**: 32 tests (generation, priority, time-based, rules, dismiss, snooze, tracking)
- **Search Ranking**: (Included in semantic-search for integration testing)

## Configuration

### Embedding Models

```typescript
// TF-IDF (default, no external dependencies)
const search = createSemanticSearch("tfidf");

// OpenAI ada-002 (requires API key)
const search = createSemanticSearch(
  "openai-ada-002",
  process.env.OPENAI_API_KEY,
);

// Sentence-Transformers (requires local model)
const search = createSemanticSearch(
  "sentence-transformers",
  undefined,
  "/models/sentence-transformers",
);
```

### Ranking Weights

Customize for your use case:

```typescript
const ranker = createSearchRanker({
  textRelevance: 0.5, // Boost keyword matching
  recency: 0.1, // Reduce recency importance
  popularity: 0.25, // Increase popularity factor
  userInteractionScore: 0.1,
  engagementRate: 0.05,
});
```

## Performance Considerations

- **Embeddings**: Cached for 24h, regenerated on content update
- **Similarity Search**: O(n) full scan (use pgvector indexes for scale)
- **Dismissals**: In-memory cache, DB-backed for persistence
- **Interactions**: Async tracking, batched writes

## No Real API Keys

All embedding models have mock implementations to prevent real API calls in development/testing. Production deployments should configure actual API keys and model paths.

## Future Enhancements

1. pgvector HNSW index optimization
2. Semantic re-ranking with cross-encoders
3. Entity relationship reasoning (co-occurrence)
4. Multi-modal search (images + text)
5. Spelling correction and query expansion
6. Explanation generation for suggestions
7. Batch embedding generation with queue
