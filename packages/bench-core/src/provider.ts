import type {
  BackupArchive,
  BackupResult,
  BackupTarget,
  Context,
  DeployResult,
  DestroyConfirmation,
  ExecOptions,
  ExecResult,
  LogLine,
  LogOptions,
  OneShotOptions,
  Plan,
  PreflightResult,
  ProvisionResult,
  RestoreResult,
  StatusReport,
} from './types.js';

export interface Provider {
  readonly id: string;

  preflight(ctx: Context): Promise<PreflightResult>;
  provision(ctx: Context, plan: Plan): Promise<ProvisionResult>;
  deploy(ctx: Context, plan: Plan): Promise<DeployResult>;
  start(ctx: Context, service?: string): Promise<void>;
  stop(ctx: Context, service?: string): Promise<void>;
  restart(ctx: Context, service?: string): Promise<void>;
  execInService(
    ctx: Context,
    service: string,
    cmd: string[],
    opts?: ExecOptions,
  ): Promise<ExecResult>;
  runOneShot(
    ctx: Context,
    fromService: string,
    cmd: string[],
    opts?: OneShotOptions,
  ): Promise<ExecResult>;
  logs(ctx: Context, service: string, opts: LogOptions): AsyncIterable<LogLine>;
  status(ctx: Context): Promise<StatusReport>;
  backup(ctx: Context, target: BackupTarget): Promise<BackupResult>;
  restore(ctx: Context, archive: BackupArchive): Promise<RestoreResult>;
  rotateSecret(ctx: Context, key: string): Promise<void>;
  destroy(ctx: Context, confirm: DestroyConfirmation): Promise<void>;
}

export class ProviderNotImplementedError extends Error {
  constructor(provider: string, op: string) {
    super(`Provider "${provider}" does not implement operation "${op}".`);
    this.name = 'ProviderNotImplementedError';
  }
}

const providerRegistry = new Map<string, () => Promise<Provider>>();

export function registerProvider(
  id: string,
  factory: () => Promise<Provider>,
): void {
  providerRegistry.set(id, factory);
}

export async function resolveProvider(id: string): Promise<Provider> {
  const factory = providerRegistry.get(id);
  if (!factory) {
    throw new Error(
      `Provider "${id}" is not registered. Available providers: ${[...providerRegistry.keys()].join(', ') || '(none)'}`,
    );
  }
  return factory();
}

export function listRegisteredProviders(): string[] {
  return [...providerRegistry.keys()];
}
