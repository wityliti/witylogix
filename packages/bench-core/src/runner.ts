import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CONFIG_FILENAME, loadConfig } from "./config.js";
import { resolveProvider } from "./provider.js";
import type { Context, Logger } from "./types.js";

export interface RunnerOptions {
  cwd?: string;
  json?: boolean;
  dryRun?: boolean;
  logger?: Logger;
}

export class NoConfigError extends Error {
  constructor(cwd: string) {
    super(
      `No ${DEFAULT_CONFIG_FILENAME} found at ${cwd}. ` +
        `Run \`bench init <name>\` first, or cd into an existing installation.`,
    );
    this.name = "NoConfigError";
  }
}

const defaultLogger: Logger = {
  debug: () => {},
  info: (msg) => process.stdout.write(`${msg}\n`),
  warn: (msg) => process.stderr.write(`${msg}\n`),
  error: (msg) => process.stderr.write(`${msg}\n`),
};

export async function buildContext(opts: RunnerOptions = {}): Promise<Context> {
  const cwd = resolve(opts.cwd ?? process.cwd());
  const configPath = resolve(cwd, DEFAULT_CONFIG_FILENAME);
  if (!existsSync(configPath)) {
    throw new NoConfigError(cwd);
  }
  const config = loadConfig(cwd);
  return {
    cwd,
    config,
    logger: opts.logger ?? defaultLogger,
    dryRun: opts.dryRun ?? false,
    json: opts.json ?? false,
  };
}

export async function withProvider<T>(
  action: (
    ctx: Context,
    provider: Awaited<ReturnType<typeof resolveProvider>>,
  ) => Promise<T>,
  opts: RunnerOptions = {},
): Promise<T> {
  const ctx = await buildContext(opts);
  const provider = await resolveProvider(ctx.config.provider.type);
  return action(ctx, provider);
}
