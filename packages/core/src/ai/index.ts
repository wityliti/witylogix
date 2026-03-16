/**
 * AI Module Exports
 *
 * Exports for semantic search, smart suggestions, NL parsing, and ranking.
 */

// ─── Semantic Search ────────────────────────────────────────────────────

export {
  createSemanticSearch,
  SemanticSearch,
  type EmbeddingModel,
  type SearchableEntity,
  type EmbeddingConfig,
  type SearchResult,
  type HybridSearchOptions,
  type IndexEntry,
} from "./semantic-search.js";

// ─── Smart Suggestions ──────────────────────────────────────────────────

export {
  createSmartSuggestions,
  getSmartSuggestions,
  SmartSuggestions,
  type SuggestionContext,
  type TimeOfDay,
  type Suggestion,
  type SuggestionRule,
  type PageContext,
  type SuggestionMetrics,
} from "./smart-suggestions.js";

// ─── Natural Language Filter ────────────────────────────────────────────

export {
  createNLFilterParser,
  nlFilterParser,
  NaturalLanguageFilterParser,
  type Entity,
  type DateExpression,
  type AmountCondition,
  type LocationCondition,
  type StructuredFilter,
} from "./natural-language-filter.js";

// ─── Search Ranking ────────────────────────────────────────────────────

export {
  createSearchRanker,
  getSearchRanker,
  SearchRanker,
  type RankingFeatures,
  type RankingWeights,
  type SearchInteraction,
  type ABTestConfig,
} from "./search-ranking.js";

// ─── Integration Recommender ────────────────────────────────────────────

export {
  IntegrationRecommender,
  IntegrationDependencyGraph,
  analyzeCategoryGaps,
  type IntegrationRecommendation,
  type TenantIntegrationProfile,
  type IndustryType,
  type WorkflowType,
  type DependencyEdge,
  type CategoryCoverageSummary,
} from "./integration-recommender.js";

// ─── Setup Wizard Assistant ────────────────────────────────────────────

export {
  SetupWizardAssistant,
  type SetupStep,
  type ConfigSuggestion,
  type SetupWizardState,
  type SetupProgress,
  type IntegrationSetupGuide,
} from "./setup-wizard-assistant.js";

// ─── Recommendation API ────────────────────────────────────────────────

export {
  RecommendationService,
  RecommendationCache,
  recommendationService,
  recommendationCache,
  type RecommendationResponse,
  type DependencyResponse,
  type GapAnalysisResponse,
  type RecommendationFeedback,
  type RecommendationAlgorithm,
} from "./recommendation-api.js";
