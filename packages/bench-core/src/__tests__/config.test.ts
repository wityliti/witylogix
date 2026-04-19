import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { benchConfigSchema, loadConfig, BenchConfigError } from '../config.js';

const MINIMAL_YAML = `
apiVersion: bench.witylogix.io/v1
kind: Installation
metadata:
  name: demo
provider:
  type: docker-compose
`;

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'bench-config-test-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('benchConfigSchema', () => {
  it('accepts the minimal valid config with defaults applied', () => {
    const parsed = benchConfigSchema.parse({
      apiVersion: 'bench.witylogix.io/v1',
      kind: 'Installation',
      metadata: { name: 'demo' },
      provider: { type: 'docker-compose' },
    });
    expect(parsed.witylogix.channel).toBe('stable');
    expect(parsed.witylogix.version).toBeNull();
    expect(parsed.database.isolation).toBe('rls');
    expect(parsed.database.version).toBe('16');
    expect(parsed.redis.version).toBe('7');
    expect(parsed.secrets.backend).toBe('file');
  });

  it('rejects unknown provider types', () => {
    expect(() =>
      benchConfigSchema.parse({
        apiVersion: 'bench.witylogix.io/v1',
        kind: 'Installation',
        metadata: { name: 'demo' },
        provider: { type: 'heroku' },
      }),
    ).toThrow();
  });

  it('rejects wrong apiVersion', () => {
    expect(() =>
      benchConfigSchema.parse({
        apiVersion: 'bench.witylogix.io/v0',
        kind: 'Installation',
        metadata: { name: 'demo' },
        provider: { type: 'docker-compose' },
      }),
    ).toThrow();
  });
});

describe('loadConfig', () => {
  it('reads and validates a valid bench.config.yaml', () => {
    withTempDir((dir) => {
      writeFileSync(join(dir, 'bench.config.yaml'), MINIMAL_YAML);
      const cfg = loadConfig(dir);
      expect(cfg.metadata.name).toBe('demo');
      expect(cfg.provider.type).toBe('docker-compose');
    });
  });

  it('throws BenchConfigError with helpful message on invalid yaml', () => {
    withTempDir((dir) => {
      writeFileSync(
        join(dir, 'bench.config.yaml'),
        `
apiVersion: bench.witylogix.io/v1
kind: Installation
metadata:
  name: demo
provider:
  type: not-a-real-provider
`,
      );
      expect(() => loadConfig(dir)).toThrow(BenchConfigError);
    });
  });

  it('throws when metadata.name is missing', () => {
    withTempDir((dir) => {
      writeFileSync(
        join(dir, 'bench.config.yaml'),
        `
apiVersion: bench.witylogix.io/v1
kind: Installation
metadata: {}
provider:
  type: docker-compose
`,
      );
      expect(() => loadConfig(dir)).toThrow(BenchConfigError);
    });
  });
});
