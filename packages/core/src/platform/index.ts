/**
 * @witylogix/core/platform — Production deployment, health checks, and API documentation
 *
 * Exports:
 * - OpenAPI specification generator
 * - Platform health check service
 * - Docker Compose configuration generator
 * - Graceful shutdown utilities
 */

// ─── OpenAPI Generator ──────────────────────────────────────────

export {
  OpenAPIGenerator,
  zodToJsonSchema,
  serveSwaggerUI,
  createOpenAPIConfig,
  exportOpenAPISpec,
  validateOpenAPISpec,
} from "./openapi-generator.js";

export type {
  OpenAPIDocument,
  OpenAPIGeneratorConfig,
  OpenAPIRouteInfo,
} from "./openapi-generator.js";

// ─── Health Check Service ───────────────────────────────────────

export {
  PlatformHealthService,
  gracefulShutdown,
  setupSignalHandlers,
} from "./health.js";

export type {
  HealthStatusType,
  HealthCheckResult,
  HealthStatus,
  SystemMetrics,
  HealthCheckConfig,
  PrometheusMetrics,
} from "./health.js";

// ─── Docker Configuration ───────────────────────────────────────

export {
  DockerComposeGenerator,
  generateDockerCompose,
  generateEnvTemplate,
  generateNginxConfig,
  generateHealthCheckScript,
} from "./docker-config.js";

export type {
  EnvironmentType,
  DockerComposeService,
  DockerComposeConfig,
} from "./docker-config.js";
