/**
 * Integration Health Monitor - Public Exports
 *
 * Provides health monitoring, SLA tracking, latency analysis, error trends,
 * degradation detection, and multi-channel alerting for integrations.
 */

export * from './health-types.js';
export * from './integration-health-monitor.js';
export {
  HealthAPIHandler,
  attachHealthAPI,
  CreateAlertRuleSchema,
  AcknowledgeAlertSchema,
  ResolveAlertSchema,
  ExecuteHealthCheckSchema,
  AlertQuerySchema,
} from './health-api.js';
