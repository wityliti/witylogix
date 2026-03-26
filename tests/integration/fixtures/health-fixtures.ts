/**
 * Health Monitoring Fixtures
 * Provides factory functions for provider health, SLA configs, alerts, and degradation events
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

export interface ProviderHealth {
  providerId: string;
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  lastCheckTime: Date;
  uptime: number;
  responseTime: number;
  errorRate: number;
  checkDetails: Record<string, unknown>;
}

export interface SLAConfig {
  providerId: string;
  targetUptime: number;
  maxErrorRate: number;
  maxResponseTime: number;
  checkInterval: number;
  breachThreshold: number;
}

export interface HealthAlert {
  id: string;
  providerId: string;
  severity: "warning" | "critical";
  type: string;
  message: string;
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  metrics: Record<string, number>;
}

export interface LatencyData {
  providerId: string;
  timestamp: Date;
  p50: number;
  p75: number;
  p95: number;
  p99: number;
  max: number;
  samples: number;
}

export interface DegradationEvent {
  id: string;
  providerId: string;
  type: string;
  signal: "latency" | "error_rate" | "availability";
  baseline: number;
  current: number;
  deviation: number;
  timestamp: Date;
}

/**
 * Factory: Create provider health status
 */
export function createProviderHealth(
  providerId: string,
  overrides?: Partial<ProviderHealth>
): ProviderHealth {
  return {
    providerId,
    name: `Provider-${providerId}`,
    status: "healthy",
    lastCheckTime: new Date(),
    uptime: 0.9999,
    responseTime: 150,
    errorRate: 0.0001,
    checkDetails: {
      latency: "150ms",
      throughput: "10000rps",
      connections: 500,
    },
    ...overrides,
  };
}

/**
 * Factory: Create SLA configuration
 */
export function createSLAConfig(
  providerId: string,
  overrides?: Partial<SLAConfig>
): SLAConfig {
  return {
    providerId,
    targetUptime: 0.9999,
    maxErrorRate: 0.001,
    maxResponseTime: 500,
    checkInterval: 30000,
    breachThreshold: 2,
    ...overrides,
  };
}

/**
 * Factory: Create health check alert
 */
export function createHealthAlert(
  providerId: string,
  type: string,
  overrides?: Partial<HealthAlert>
): HealthAlert {
  return {
    id: `alert-${Date.now()}`,
    providerId,
    severity: "warning",
    type,
    message: `Health check failed for ${providerId}: ${type}`,
    createdAt: new Date(),
    metrics: {
      errorRate: 0.05,
      responseTime: 2500,
      uptime: 0.95,
    },
    ...overrides,
  };
}

/**
 * Factory: Create critical alert
 */
export function createCriticalAlert(
  providerId: string,
  message: string
): HealthAlert {
  return createHealthAlert(providerId, "critical_failure", {
    severity: "critical",
    message,
    metrics: {
      errorRate: 0.5,
      responseTime: 30000,
      uptime: 0.5,
    },
  });
}

/**
 * Factory: Create latency histogram data
 */
export function createLatencyData(
  providerId: string,
  overrides?: Partial<LatencyData>
): LatencyData {
  return {
    providerId,
    timestamp: new Date(),
    p50: 120,
    p75: 180,
    p95: 800,
    p99: 2000,
    max: 5000,
    samples: 10000,
    ...overrides,
  };
}

/**
 * Factory: Create degradation event (multi-signal)
 */
export function createDegradationEvent(
  providerId: string,
  signal: "latency" | "error_rate" | "availability",
  overrides?: Partial<DegradationEvent>
): DegradationEvent {
  const configs: Record<
    string,
    { baseline: number; current: number }
  > = {
    latency: { baseline: 150, current: 2500 },
    error_rate: { baseline: 0.0001, current: 0.05 },
    availability: { baseline: 0.9999, current: 0.95 },
  };

  const { baseline, current } = configs[signal];
  const deviation =
    signal === "availability"
      ? baseline - current
      : ((current - baseline) / baseline) * 100;

  return {
    id: `degrad-${Date.now()}`,
    providerId,
    type: "multi_signal_degradation",
    signal,
    baseline,
    current,
    deviation,
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Factory: Create SLA breach
 */
export function createSLABreach(providerId: string) {
  return {
    breachId: `breach-${Date.now()}`,
    providerId,
    slaConfig: createSLAConfig(providerId),
    detectedAt: new Date(),
    metric: "uptime",
    actualValue: 0.98,
    targetValue: 0.9999,
    duration: 1800000, // 30 minutes
  };
}

/**
 * Factory: Create baseline metrics for degradation detection
 */
export function createBaselineMetrics(providerId: string) {
  return {
    providerId,
    latencyP50: 120,
    latencyP95: 800,
    latencyP99: 2000,
    errorRate: 0.0001,
    availability: 0.9999,
    throughput: 10000,
    computedAt: new Date(),
    sampleSize: 100000,
  };
}

/**
 * Factory: Create multi-signal degradation alert
 */
export function createMultiSignalAlert(
  providerId: string,
  signals: Array<{
    type: "latency" | "error_rate" | "availability";
    score: number;
  }>
) {
  return {
    alertId: `multi-signal-${Date.now()}`,
    providerId,
    severity: "critical",
    type: "multi_signal_degradation",
    signals,
    degradationScore: signals.reduce((sum, s) => sum + s.score, 0),
    createdAt: new Date(),
    acknowledgedBy?: undefined,
    resolvedAt: undefined,
  };
}

/**
 * Factory: Create passive health detection event
 */
export function createPassiveHealthEvent(
  providerId: string,
  eventType: string
) {
  return {
    eventId: `passive-${Date.now()}`,
    providerId,
    type: eventType,
    detectionMethod: "passive",
    timestamp: new Date(),
    metrics: {
      failedRequests: 10,
      slowRequests: 25,
      totalRequests: 1000,
    },
  };
}

/**
 * Factory: Create health check schedule
 */
export function createHealthCheckSchedule(providerId: string) {
  const now = Date.now();
  return {
    providerId,
    interval: 30000, // 30 seconds
    timeout: 5000,
    nextCheckAt: new Date(now + 30000),
    lastCheckAt: new Date(now - 30000),
    consecutiveFailures: 0,
    enabled: true,
  };
}
