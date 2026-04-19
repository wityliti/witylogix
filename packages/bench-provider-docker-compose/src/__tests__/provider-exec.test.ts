import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDockerComposeProvider } from '../provider.js';
import type { Context } from '@witylogix/bench-core';

const ctx: Context = {
  cwd: '/tmp/fake',
  config: {} as Context['config'],
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  dryRun: true,
  json: false,
};

describe('DockerComposeProvider exec primitives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('execInService respects dry-run and returns zero exit', async () => {
    const p = createDockerComposeProvider();
    const r = await p.execInService(ctx, 'api', ['echo', 'hi']);
    expect(r.exitCode).toBe(0);
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[dry-run] would exec in api: echo hi'),
    );
  });

  it('runOneShot respects dry-run and returns zero exit', async () => {
    const p = createDockerComposeProvider();
    const r = await p.runOneShot(ctx, 'api', ['pnpm', 'prisma', 'migrate', 'deploy']);
    expect(r.exitCode).toBe(0);
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[dry-run] would run one-shot from api: pnpm prisma migrate deploy'),
    );
  });
});
