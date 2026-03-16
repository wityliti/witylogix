/**
 * Configuration Module Exports
 *
 * This module re-exports all configuration services and types.
 * Import from here to access the config system.
 *
 * @example
 * // Basic config
 * import { env } from '@witylogix/core/config';
 * console.log(env.PORT);
 *
 * @example
 * // Configuration service
 * import { getConfig } from '@witylogix/core/config';
 * const config = getConfig();
 * const poolSize = config.get('database.poolSize');
 *
 * @example
 * // Feature flags
 * import { isFeatureEnabled, FeatureFlag } from '@witylogix/core/config';
 * if (isFeatureEnabled(FeatureFlag.MFA_REQUIRED)) {
 *   // enforce MFA
 * }
 *
 * @example
 * // Secrets
 * import { SecretsManager } from '@witylogix/core/config';
 * const secrets = new SecretsManager('environment');
 * const jwtSecret = await secrets.getSecret('JWT_SECRET');
 *
 * @example
 * // Deployment checks
 * import { DeploymentChecker } from '@witylogix/core/config';
 * const checker = new DeploymentChecker();
 * const report = await checker.runAllChecks();
 */

// Environment validation
export { validateEnv, EnvSchema, env } from "./env-validator.ts";
export type { Env } from "./env-validator.ts";

// Configuration service
export { ConfigService, getConfig } from "./config-service.ts";
export type { ConfigStructure } from "./config-service.ts";

// Feature flags
export {
  FeatureFlag,
  isFeatureEnabled,
  enableFeatureForTenant,
  disableFeatureForTenant,
  getEnabledFlagsForTenant,
  getAllFlagDefinitions,
  resetTenantOverrides,
  FEATURE_FLAG_DEFINITIONS,
} from "./feature-flags.ts";
export type { FeatureFlagContext } from "./feature-flags.ts";

// Secrets management
export {
  SecretsManager,
  EnvironmentSecretsProvider,
  FileSecretsProvider,
  VaultSecretsProvider,
  AWSSecretsProvider,
} from "./secrets-manager.ts";
export type {
  SecretsProvider,
  SecretValue,
} from "./secrets-manager.ts";

// Deployment checklist
export {
  DeploymentChecker,
  formatDeploymentReport,
} from "./deployment-checklist.ts";
export type {
  DeploymentReport,
  HealthCheckResult,
} from "./deployment-checklist.ts";
