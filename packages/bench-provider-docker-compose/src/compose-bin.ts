import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ComposeRunOptions {
  composeFile: string;
  cwd: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}

/**
 * Builds the leading `docker compose ...` flags: always `-f <composeFile>`,
 * plus `--env-file <cwd>/.env` when that file exists (Compose v2 otherwise
 * looks for `.env` next to the compose file, which misses our layout).
 */
function baseComposeArgs(opts: ComposeRunOptions): string[] {
  const args = ['compose', '-f', opts.composeFile];
  const envFile = resolve(opts.cwd, '.env');
  if (existsSync(envFile)) {
    args.push('--env-file', envFile);
  }
  return args;
}

export interface ComposeRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Runs `docker compose -f <composeFile> <args>` to completion and returns the output.
 * Throws on non-zero exit code unless allowNonZero is true.
 */
export async function runCompose(
  opts: ComposeRunOptions,
  allowNonZero = false,
): Promise<ComposeRunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      'docker',
      [...baseComposeArgs(opts), ...opts.args],
      {
        cwd: opts.cwd,
        env: opts.env ?? process.env,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    const error = err as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number | string;
    };
    if (allowNonZero) {
      return {
        stdout: error.stdout ?? '',
        stderr: error.stderr ?? error.message,
        exitCode: typeof error.code === 'number' ? error.code : 1,
      };
    }
    throw new ComposeError(
      `docker compose ${opts.args.join(' ')} failed: ${error.stderr ?? error.message}`,
      typeof error.code === 'number' ? error.code : 1,
    );
  }
}

/**
 * Streams `docker compose -f <composeFile> logs` line-by-line. Stops when the
 * child process exits. With follow=true, runs until the caller breaks the loop.
 */
export async function* streamComposeLogs(
  opts: ComposeRunOptions,
): AsyncIterable<string> {
  const child = spawn('docker', [...baseComposeArgs(opts), ...opts.args], {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let buffer = '';
  const queue: string[] = [];
  let resolveWaiter: (() => void) | null = null;
  let done = false;

  const push = (line: string): void => {
    queue.push(line);
    if (resolveWaiter) {
      resolveWaiter();
      resolveWaiter = null;
    }
  };

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      push(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
    }
  });
  child.stderr.on('data', (chunk: string) => {
    buffer += chunk;
  });
  child.on('exit', () => {
    if (buffer) push(buffer);
    done = true;
    if (resolveWaiter) {
      resolveWaiter();
      resolveWaiter = null;
    }
  });

  while (!done || queue.length > 0) {
    if (queue.length === 0 && !done) {
      await new Promise<void>((r) => {
        resolveWaiter = r;
      });
    }
    while (queue.length > 0) {
      yield queue.shift() as string;
    }
  }
}

export class ComposeError extends Error {
  constructor(message: string, public readonly exitCode: number) {
    super(message);
    this.name = 'ComposeError';
  }
}

export interface ComposeExecOptions {
  composeFile: string;
  cwd: string;
  service: string;
  cmd: string[];
  stdin?: NodeJS.ReadableStream;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export async function execComposeService(
  opts: ComposeExecOptions,
): Promise<ComposeRunResult> {
  const envFlags: string[] = [];
  for (const [k, v] of Object.entries(opts.env ?? {})) {
    envFlags.push('-e', `${k}=${v}`);
  }
  const args = ['exec', '-T', ...envFlags, opts.service, ...opts.cmd];
  return runCompose(
    { composeFile: opts.composeFile, cwd: opts.cwd, args, env: process.env },
    true,
  );
}

export interface ComposeOneShotOptions {
  composeFile: string;
  cwd: string;
  fromService: string;
  cmd: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
}

export async function runOneShotFromService(
  opts: ComposeOneShotOptions,
): Promise<ComposeRunResult> {
  const envFlags: string[] = [];
  for (const [k, v] of Object.entries(opts.env ?? {})) {
    envFlags.push('-e', `${k}=${v}`);
  }
  const args = ['run', '--rm', '--no-deps', ...envFlags, opts.fromService, ...opts.cmd];
  return runCompose(
    { composeFile: opts.composeFile, cwd: opts.cwd, args, env: process.env },
    true,
  );
}

export async function checkDockerAvailable(): Promise<{
  docker: boolean;
  compose: boolean;
  dockerVersion?: string;
  composeVersion?: string;
}> {
  let docker = false;
  let compose = false;
  let dockerVersion: string | undefined;
  let composeVersion: string | undefined;

  try {
    const { stdout } = await execFileAsync('docker', ['--version']);
    docker = true;
    dockerVersion = stdout.trim();
  } catch {
    /* docker not available */
  }

  try {
    const { stdout } = await execFileAsync('docker', ['compose', 'version']);
    compose = true;
    composeVersion = stdout.trim().split('\n')[0];
  } catch {
    /* compose plugin not available */
  }

  return { docker, compose, dockerVersion, composeVersion };
}
