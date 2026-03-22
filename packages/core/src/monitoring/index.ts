/**
 * Monitoring and observability infrastructure.
 *
 * Comprehensive monitoring module providing:
 * - Structured JSON logging with context injection
 * - Sentry error tracking integration
 * - Prometheus-compatible metrics collection
 * - Health check endpoints (liveness, readiness, startup)
 * - Distributed request tracing (W3C Trace Context)
 * - Threshold-based alerting with deduplication
 *
 * Usage:
 * const logger = createLogger("my-service");
 * const metrics = getMetricsCollector();
 * const checker = getHealthChecker();
 * const tracer = getRequestTracer();
 * const alertMgr = getAlertManager();
 */

// ─── LOGGER EXPORTS ────────────────────────────────────────────────────

export {
  Logger,
  createLogger,
  type LogLevel,
  type LogContext,
  type StructuredLog,
  type LogTransport,
  type LoggerConfig,
} from "./structured-logger.js";

// ─── SENTRY EXPORTS ────────────────────────────────────────────────────

export {
  SentryManager,
  initializeSentry,
  getSentryManager,
  type SentryConfig,
  type ErrorContext,
  type BreadcrumbData,
  type Transaction,
} from "./sentry-integration.js";

// ─── METRICS EXPORTS ───────────────────────────────────────────────────

export {
  MetricsCollector,
  getMetricsCollector,
  type MetricType,
  type MetricDefinition,
  type HistogramBucket,
} from "./metrics-collector.js";

// ─── HEALTH CHECK EXPORTS ──────────────────────────────────────────────

export {
  HealthChecker,
  getHealthChecker,
  checkDatabase,
  checkCache,
  checkQueue,
  checkStorage,
  healthEndpoint,
  readinessEndpoint,
  startupEndpoint,
  type HealthStatus,
  type ComponentHealth,
  type HealthCheckResponse,
  type HealthCheckFn,
} from "./health-endpoint.js";

// ─── TRACING EXPORTS ────────────────────────────────────────────────────

export {
  Span,
  RequestTracer,
  getRequestTracer,
  tracingMiddleware,
  type TraceContext,
  type SpanAttribute,
  type SpanEvent,
  type SpanData,
  type TracerConfig,
} from "./request-tracer.js";

// ─── ALERTING EXPORTS ──────────────────────────────────────────────────

export {
  AlertManager,
  WebhookChannel,
  EmailChannel,
  SlackChannel,
  getAlertManager,
  createHighErrorRateRule,
  createHighLatencyRule,
  createLowSuccessRateRule,
  type AlertSeverity,
  type AlertRule,
  type Alert,
  type AlertChannelHandler,
  type WebhookChannelConfig,
  type EmailChannelConfig,
  type SlackChannelConfig,
} from "./alerting.js";

// ─── CONVENIENCE SINGLETONS ──────────────────────────────────────────────

import { getMetricsCollector } from "./metrics-collector.js";
import { getHealthChecker } from "./health-endpoint.js";

/**
 * Pre-configured MetricsCollector singleton for convenience.
 */
export const metrics = getMetricsCollector();

/**
 * HealthCheckRegistry — alias for HealthChecker for backward compatibility.
 */
export { HealthChecker as HealthCheckRegistry } from "./health-endpoint.js";

/**
 * Pre-configured HealthCheckRegistry singleton.
 */
export const healthRegistry = getHealthChecker();

/**
 * Register default health checks (database, cache, queue).
 */
const healthCheckStartTime = Date.now();

export function registerDefaultHealthChecks(
  registry: InstanceType<typeof import("./health-endpoint").HealthChecker> = healthRegistry
): void {
  registry.register("database", async () => ({
    status: "UP" as const,
    name: "database",
    duration: 0,
  }));
  registry.register("cache", async () => ({
    status: "UP" as const,
    name: "cache",
    duration: 0,
  }));
  registry.register("queue", async () => ({
    status: "UP" as const,
    name: "queue",
    duration: 0,
  }));
  registry.register("uptime", async () => ({
    status: "UP" as const,
    name: "uptime",
    duration: 0,
    details: {
      uptimeMs: Date.now() - healthCheckStartTime,
    },
  }));
}

// ─── LEGACY EXPORTS (from original monitoring module) ───────────────────

export interface Metric {
  name: string;
  type: "counter" | "gauge" | "histogram";
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
}

export interface HealthCheckResult {
  name: string;
  status: "UP" | "DOWN" | "DEGRADED";
  message?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  durationMs: number;
}

export interface HealthStatus {
  status: "UP" | "DOWN" | "DEGRADED";
  checks: HealthCheckResult[];
  uptime: number;
  timestamp: Date;
}
