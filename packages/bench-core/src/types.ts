import type { BenchConfig } from './config.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface Context {
  readonly cwd: string;
  readonly config: BenchConfig;
  readonly logger: Logger;
  readonly dryRun: boolean;
  readonly json: boolean;
}

export interface PreflightResult {
  ok: boolean;
  checks: Array<{
    id: string;
    name: string;
    ok: boolean;
    message?: string;
  }>;
}

export interface Plan {
  operations: PlanOperation[];
  summary: string;
}

export interface PlanOperation {
  id: string;
  kind: 'create' | 'update' | 'delete' | 'noop';
  target: string;
  description: string;
  dangerous: boolean;
}

export interface ProvisionResult {
  ok: boolean;
  operationsApplied: number;
  message?: string;
}

export interface DeployResult {
  ok: boolean;
  version: string;
  rolledBack: boolean;
  message?: string;
}

export interface StatusReport {
  services: Array<{
    name: string;
    state: 'running' | 'stopped' | 'degraded' | 'unknown';
    healthy: boolean;
    version?: string;
    lastDeployAt?: string;
  }>;
}

export interface LogOptions {
  follow: boolean;
  since?: string;
  tail?: number;
}

export interface LogLine {
  service: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

export interface BackupTarget {
  kind: 'local-file' | 's3' | 'provider-native';
  path?: string;
  bucket?: string;
  key?: string;
}

export interface BackupResult {
  ok: boolean;
  archive: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupArchive {
  path: string;
  createdAt: string;
  bench_version: string;
}

export interface RestoreResult {
  ok: boolean;
  tenantsRestored: number;
  message?: string;
}

export interface DestroyConfirmation {
  installationName: string;
  acknowledged: true;
}

export type {
  BenchConfig,
  BenchConfigMeta,
  BenchConfigProvider,
  BenchConfigDatabase,
  BenchConfigServices,
} from './config.js';
