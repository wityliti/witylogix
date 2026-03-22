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
export { validateEnv, EnvSchema, env } from "./env-validator.js";
export type { Env } from "./env-validator.js";

// Configuration service
export { ConfigService, getConfig } from "./config-service.js";
export type { ConfigStructure } from "./config-service.js";

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
} from "./feature-flags.js";
export type { FeatureFlagContext } from "./feature-flags.js";

// Secrets management
export {
  SecretsManager,
  EnvironmentSecretsProvider,
  FileSecretsProvider,
  VaultSecretsProvider,
  AWSSecretsProvider,
} from "./secrets-manager.js";
export type {
  SecretsProvider,
  SecretValue,
} from "./secrets-manager.js";

// Deployment checklist
export {
  DeploymentChecker,
  formatDeploymentReport,
} from "./deployment-checklist.js";
export type {
  DeploymentReport,
  HealthCheckResult,
} from "./deployment-checklist.js";
