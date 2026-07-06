/**
 * Integration Gateway — Public API
 * Re-exports for unified HTTP client wrapper and middleware components
 */

export {
  IntegrationGateway,
  type HttpRequestOptions,
  type HttpResponse,
  type RateLimitConfig,
  type RetryConfig,
  type ProviderGatewayConfig,
  type CircuitBreakerConfig,
  type HttpInterceptor,
  type IntegrationGatewayConfig,
  type IHttpClient,
  type IMetricsCollector,
} from "./integration-gateway.js";

// Rate limit enforcer
export {
  RateLimitEnforcer,
  InMemoryRateLimitStore,
  type RateLimitConfig as RateLimitEnforcerConfig,
  type WindowBucket,
  type PendingRequest,
  type RateLimitHeaders,
  type RateLimitAnalytics,
  type RateLimitStore,
} from "./rate-limit-enforcer.js";

// Circuit breaker
export {
  CircuitBreaker,
  type CircuitState,
  type CircuitBreakerConfig as CircuitBreakerEnforcerConfig,
  type FailureRecord,
  type CircuitBreakerMetrics,
  type StateChangeEvent,
} from "./circuit-breaker.js";

// Error mapper
export {
  ErrorMapper,
  type IntegrationErrorCode,
  type MappedError,
} from "./error-mapper.js";

// Request logger
export {
  RequestLogger,
  type RequestDetails,
  type ResponseDetails,
  type RequestLogEntry,
  type ResponseLogEntry,
  type ErrorLogEntry,
  type LogShipEvent,
} from "./request-logger.js";

// Metrics collector
export {
  MetricsCollector,
  type MetricsResolution,
  type LatencyMetrics,
  type OperationMetrics,
  type TimeSeriesPoint,
  type TimeSeries,
  type HealthScoreInput,
  type HealthScore,
  type DailyAggregation,
  type PrometheusMetric,
} from "./metrics-collector.js";

// ─── Integration Gateway V2 ─────────────────────────────────────

// Gateway V2 Core
export {
  AdvancedCircuitBreaker,
  BulkheadIsolator,
  RetryEngine,
  RequestDeduplicator,
  ResponseCache,
  CorrelationTracker,
  GatewayOrchestrator,
  type HttpRequestOptions as HttpRequestOptionsV2,
  type HttpResponse as HttpResponseV2,
  type CircuitBreakerStateChangeEvent,
  type TraceContext,
  type HttpClient,
} from "./integration-gateway-v2.js";

// Gateway V2 Metrics
export {
  MetricsCollectorV2,
  MetricsExporter,
  type Percentile,
  type ErrorBreakdown,
  type ProviderMetrics,
  type AggregatedMetrics,
  type AnomalyDetection,
  type MetricsCollectorConfig,
} from "./gateway-metrics.js";

// Gateway V2 API
export { GatewayV2API, createGatewayV2Routes } from "./gateway-v2-api.js";
