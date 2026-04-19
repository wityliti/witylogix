/**
 * @witylogix/bench-core
 *
 * Provisioning engine and shared types for Witylogix Bench.
 * The CLI (`@witylogix/bench`) and the Cloud control plane (`apps/bench-web`)
 * both consume this package — any operation must be expressible here first.
 */

export * from './types.js';
export * from './provider.js';
export * from './runner.js';
export * from './http-client.js';
export * as tenants from './ops/tenants.js';
export * as audit from './ops/audit.js';
export * as migrate from './ops/migrate.js';
export {
  benchConfigSchema,
  loadConfig,
  BenchConfigError,
  DEFAULT_CONFIG_FILENAME,
} from './config.js';

export const BENCH_CORE_VERSION = '0.0.1';
