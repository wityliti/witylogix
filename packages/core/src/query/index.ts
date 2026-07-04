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

export { NPlusOneDetector } from "./n-plus-one-detector.js";
export type { QueryPattern, NPlusOneReport } from "./n-plus-one-detector.js";

export { QueryAnalyzer } from "./query-analyzer.js";
export type {
  IndexIssue,
  JoinAnalysis,
  QueryAnalysis,
} from "./query-analyzer.js";

export { IndexAdvisor } from "./index-advisor.js";
export type { IndexRecommendation } from "./index-advisor.js";

export { SlowQueryLogger } from "./slow-query-logger.js";
export type { QueryFingerprint, SlowQueryReport } from "./slow-query-logger.js";

export { QueryCache } from "./query-cache.js";
export type { CacheStats } from "./query-cache.js";

export {
  BatchLoader,
  CompositeKeyBatchLoader,
  createPrismaBatchLoader,
} from "./batch-loader.js";
export type { LoaderConfig } from "./batch-loader.js";

export { ConnectionMonitor } from "./connection-monitor.js";
export type {
  PoolHealth,
  ConnectionLeak,
  PoolAlert,
} from "./connection-monitor.js";
