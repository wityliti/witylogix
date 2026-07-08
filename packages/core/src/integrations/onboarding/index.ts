/**
 * Integration Onboarding Wizard
 *
 * Complete OAuth, credential validation, and health check system
 * for 124 integration providers across 21 categories.
 */

// ─── Types ────────────────────────────────────────────────────
export * from "./types";

// ─── Registry & Configuration ─────────────────────────────────
export * from "./integration-setup-registry";
export * from "./quick-setup-templates";

// ─── Core Managers ────────────────────────────────────────────
export { OAuthFlowManager } from "./oauth-flow-manager";
export { CredentialValidator, testCredentials } from "./credential-validator";
export {
  HealthChecker,
  checkHealth,
  HealthCheckScheduler,
} from "./health-checker";
export { BatchIntegrationManager } from "./batch-integration-manager";
