import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  Provider,
  RestoreResult,
  StatusReport,
} from '@witylogix/bench-core';
import { ProviderNotImplementedError } from '@witylogix/bench-core';
import { generateCompose } from './compose.js';
import {
  checkDockerAvailable,
  execComposeService,
  runCompose,
  runOneShotFromService,
  streamComposeLogs,
} from './compose-bin.js';

const BENCH_DIR = '.bench';
const COMPOSE_FILENAME = 'compose.yaml';

function composeFilePath(ctx: Context): string {
  return resolve(ctx.cwd, BENCH_DIR, COMPOSE_FILENAME);
}

function ensureBenchDir(ctx: Context): void {
  mkdirSync(resolve(ctx.cwd, BENCH_DIR), { recursive: true });
}

interface ComposePsRow {
  Name?: string;
  Service?: string;
  State?: string;
  Health?: string;
  Image?: string;
}

function parsePs(stdout: string): ComposePsRow[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    return JSON.parse(trimmed) as ComposePsRow[];
  }
  return trimmed
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ComposePsRow);
}

export class DockerComposeProvider implements Provider {
  readonly id = 'docker-compose';

  async preflight(_ctx: Context): Promise<PreflightResult> {
    const check = await checkDockerAvailable();
    return {
      ok: check.docker && check.compose,
      checks: [
        {
          id: 'docker',
          name: 'Docker CLI',
          ok: check.docker,
          message: check.dockerVersion ?? 'not found',
        },
        {
          id: 'compose',
          name: 'Docker Compose plugin',
          ok: check.compose,
          message: check.composeVersion ?? 'not found',
        },
      ],
    };
  }

  async provision(ctx: Context, _plan: Plan): Promise<ProvisionResult> {
    ensureBenchDir(ctx);
    const yaml = generateCompose(ctx.config);
    const path = composeFilePath(ctx);
    if (ctx.dryRun) {
      ctx.logger.info(`[dry-run] would write ${path}`);
      return { ok: true, operationsApplied: 0, message: 'dry-run' };
    }
    writeFileSync(path, yaml);
    ctx.logger.debug(`wrote ${path}`);
    return { ok: true, operationsApplied: 1 };
  }

  async deploy(ctx: Context, plan: Plan): Promise<DeployResult> {
    await this.provision(ctx, plan);
    const version = ctx.config.witylogix.version ?? 'latest';
    if (ctx.dryRun) {
      ctx.logger.info('[dry-run] would run: docker compose up -d --remove-orphans');
      return { ok: true, version, rolledBack: false, message: 'dry-run' };
    }
    await runCompose({
      composeFile: composeFilePath(ctx),
      cwd: ctx.cwd,
      args: ['up', '-d', '--remove-orphans'],
    });
    return { ok: true, version, rolledBack: false };
  }

  async start(ctx: Context, service?: string): Promise<void> {
    if (ctx.dryRun) {
      ctx.logger.info(`[dry-run] would start ${service ?? 'all services'}`);
      return;
    }
    const args = ['up', '-d'];
    if (service) args.push(service);
    await runCompose({
      composeFile: composeFilePath(ctx),
      cwd: ctx.cwd,
      args,
    });
  }

  async stop(ctx: Context, service?: string): Promise<void> {
    if (ctx.dryRun) {
      ctx.logger.info(`[dry-run] would stop ${service ?? 'all services'}`);
      return;
    }
    const args = ['stop'];
    if (service) args.push(service);
    await runCompose({
      composeFile: composeFilePath(ctx),
      cwd: ctx.cwd,
      args,
    });
  }

  async restart(ctx: Context, service?: string): Promise<void> {
    if (ctx.dryRun) {
      ctx.logger.info(`[dry-run] would restart ${service ?? 'all services'}`);
      return;
    }
    const args = ['restart'];
    if (service) args.push(service);
    await runCompose({
      composeFile: composeFilePath(ctx),
      cwd: ctx.cwd,
      args,
    });
  }

  async *logs(
    ctx: Context,
    service: string,
    opts: LogOptions,
  ): AsyncIterable<LogLine> {
    const args = ['logs'];
    if (opts.follow) args.push('-f');
    if (opts.tail) args.push('--tail', String(opts.tail));
    if (opts.since) args.push('--since', opts.since);
    args.push(service);

    const now = new Date().toISOString();
    for await (const raw of streamComposeLogs({
      composeFile: composeFilePath(ctx),
      cwd: ctx.cwd,
      args,
    })) {
      yield {
        service,
        timestamp: now,
        level: 'info',
        message: raw,
      };
    }
  }

  async status(ctx: Context): Promise<StatusReport> {
    const { stdout } = await runCompose(
      {
        composeFile: composeFilePath(ctx),
        cwd: ctx.cwd,
        args: ['ps', '--format', 'json'],
      },
      true,
    );
    const rows = parsePs(stdout);
    return {
      services: rows.map((r) => ({
        name: r.Service ?? r.Name ?? '(unknown)',
        state: mapState(r.State),
        healthy: (r.Health ?? '').toLowerCase() === 'healthy',
        version: r.Image,
      })),
    };
  }

  async execInService(
    ctx: Context,
    service: string,
    cmd: string[],
    opts: ExecOptions = {},
  ): Promise<ExecResult> {
    if (ctx.dryRun) {
      ctx.logger.info(`[dry-run] would exec in ${service}: ${cmd.join(' ')}`);
      return { stdout: '', stderr: '', exitCode: 0 };
    }
    const r = await execComposeService({
      composeFile: composeFilePath(ctx),
      cwd: ctx.cwd,
      service,
      cmd,
      stdin: opts.stdin,
      env: opts.env,
      timeoutMs: opts.timeoutMs,
    });
    return { stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode };
  }

  async runOneShot(
    ctx: Context,
    fromService: string,
    cmd: string[],
    opts: OneShotOptions = {},
  ): Promise<ExecResult> {
    if (ctx.dryRun) {
      ctx.logger.info(`[dry-run] would run one-shot from ${fromService}: ${cmd.join(' ')}`);
      return { stdout: '', stderr: '', exitCode: 0 };
    }
    const r = await runOneShotFromService({
      composeFile: composeFilePath(ctx),
      cwd: ctx.cwd,
      fromService,
      cmd,
      env: opts.env,
      timeoutMs: opts.timeoutMs,
    });
    return { stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode };
  }

  async backup(_ctx: Context, _target: BackupTarget): Promise<BackupResult> {
    throw new ProviderNotImplementedError(this.id, 'backup');
  }

  async restore(
    _ctx: Context,
    _archive: BackupArchive,
  ): Promise<RestoreResult> {
    throw new ProviderNotImplementedError(this.id, 'restore');
  }

  async rotateSecret(_ctx: Context, _key: string): Promise<void> {
    throw new ProviderNotImplementedError(this.id, 'rotateSecret');
  }

  async destroy(ctx: Context, confirm: DestroyConfirmation): Promise<void> {
    if (confirm.installationName !== ctx.config.metadata.name) {
      throw new Error(
        `destroy: confirmation name "${confirm.installationName}" does not match installation name "${ctx.config.metadata.name}".`,
      );
    }
    if (ctx.dryRun) {
      ctx.logger.info('[dry-run] would run: docker compose down -v');
      return;
    }
    await runCompose({
      composeFile: composeFilePath(ctx),
      cwd: ctx.cwd,
      args: ['down', '-v'],
    });
  }
}

function mapState(state?: string): 'running' | 'stopped' | 'degraded' | 'unknown' {
  const s = (state ?? '').toLowerCase();
  if (s === 'running') return 'running';
  if (s === 'exited' || s === 'stopped' || s === 'created') return 'stopped';
  if (s === 'restarting' || s === 'paused' || s === 'dead') return 'degraded';
  return 'unknown';
}

export function createDockerComposeProvider(): Provider {
  return new DockerComposeProvider();
}
