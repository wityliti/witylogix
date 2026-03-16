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
} from './integration-gateway.js';

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
} from './rate-limit-enforcer.js';

// Circuit breaker
export {
  CircuitBreaker,
  type CircuitState,
  type CircuitBreakerConfig as CircuitBreakerEnforcerConfig,
  type FailureRecord,
  type CircuitBreakerMetrics,
  type StateChangeEvent,
} from './circuit-breaker.js';

// Error mapper
export {
  ErrorMapper,
  type IntegrationErrorCode,
  type MappedError,
} from './error-mapper.js';

// Request logger
export {
  RequestLogger,
  type RequestDetails,
  type ResponseDetails,
  type RequestLogEntry,
  type ResponseLogEntry,
  type ErrorLogEntry,
  type LogShipEvent,
} from './request-logger.js';

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
} from './metrics-collector.js';
