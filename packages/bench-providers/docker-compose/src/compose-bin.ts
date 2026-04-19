import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ComposeRunOptions {
  composeFile: string;
  cwd: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
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
      ['compose', '-f', opts.composeFile, ...opts.args],
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
  const child = spawn('docker', ['compose', '-f', opts.composeFile, ...opts.args], {
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
