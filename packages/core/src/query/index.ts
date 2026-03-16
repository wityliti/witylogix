/**
 * Query Optimization System — Exports for all query analysis and monitoring modules.
 *
 * This module provides a comprehensive query optimization toolkit:
 * - N+1 query detection
 * - Query performance analysis with EXPLAIN
 * - Index recommendations based on patterns
 * - Slow query logging and trend detection
 * - Query result caching with LRU eviction
 * - Request-scoped batch loading (DataLoader pattern)
 * - Connection pool monitoring and leak detection
 */

export { NPlusOneDetector } from "./n-plus-one-detector";
export type { QueryPattern, NPlusOneReport } from "./n-plus-one-detector";

export { QueryAnalyzer } from "./query-analyzer";
export type {
  IndexIssue,
  JoinAnalysis,
  QueryAnalysis,
} from "./query-analyzer";

export { IndexAdvisor } from "./index-advisor";
export type { IndexRecommendation } from "./index-advisor";

export { SlowQueryLogger } from "./slow-query-logger";
export type {
  QueryFingerprint,
  SlowQueryReport,
} from "./slow-query-logger";

export { QueryCache } from "./query-cache";
export type { CacheStats } from "./query-cache";

export {
  BatchLoader,
  CompositeKeyBatchLoader,
  createPrismaBatchLoader,
} from "./batch-loader";
export type { LoaderConfig } from "./batch-loader";

export { ConnectionMonitor } from "./connection-monitor";
export type {
  PoolHealth,
  ConnectionLeak,
  PoolAlert,
} from "./connection-monitor";
