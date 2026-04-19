import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { benchConfigSchema } from '@witylogix/bench-core';
import { generateCompose } from '../compose.js';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return benchConfigSchema.parse({
    apiVersion: 'bench.witylogix.io/v1',
    kind: 'Installation',
    metadata: { name: 'demo-install' },
    provider: { type: 'docker-compose' },
    services: {
      api: { replicas: 1 },
      dashboard: { replicas: 1 },
    },
    ...overrides,
  });
}

describe('generateCompose', () => {
  it('produces a parseable YAML document with top-level services, networks, volumes', () => {
    const cfg = makeConfig();
    const yaml = generateCompose(cfg);
    const doc = parseYaml(yaml);

    expect(doc.name).toBe('demo-install');
    expect(doc.networks.bench.driver).toBe('bridge');
    expect(doc.volumes.postgres_data).toBeDefined();
    expect(doc.volumes.redis_data).toBeDefined();
    expect(doc.services.postgres).toBeDefined();
    expect(doc.services.redis).toBeDefined();
    expect(doc.services.api).toBeDefined();
    expect(doc.services.dashboard).toBeDefined();
  });

  it('omits services that are not declared in config', () => {
    const cfg = makeConfig({ services: { api: { replicas: 1 } } });
    const yaml = generateCompose(cfg);
    const doc = parseYaml(yaml);

    expect(doc.services.api).toBeDefined();
    expect(doc.services.dashboard).toBeUndefined();
    expect(doc.services['customer-portal']).toBeUndefined();
  });

  it('uses the configured Witylogix version in app service images', () => {
    const cfg = makeConfig({
      witylogix: { version: '4.1.0', channel: 'stable' },
    });
    const yaml = generateCompose(cfg);
    expect(yaml).toContain('witylogix-api:4.1.0');
    expect(yaml).toContain('witylogix-dashboard:4.1.0');
  });

  it('falls back to "latest" when witylogix.version is null', () => {
    const cfg = makeConfig();
    const yaml = generateCompose(cfg);
    expect(yaml).toContain('witylogix-api:latest');
  });

  it('uses postgres and redis versions from config', () => {
    const cfg = makeConfig({
      database: { provider: 'postgres-self-hosted', version: '15', isolation: 'rls' },
      redis: { provider: 'redis-self-hosted', version: '6' },
    });
    const yaml = generateCompose(cfg);
    expect(yaml).toContain('postgis/postgis:15-3.4-alpine');
    expect(yaml).toContain('redis:6-alpine');
  });

  it('applies deploy.replicas when replicas > 1', () => {
    const cfg = makeConfig({
      services: { api: { replicas: 3 } },
    });
    const yaml = generateCompose(cfg);
    const doc = parseYaml(yaml);
    expect(doc.services.api.deploy.replicas).toBe(3);
  });

  it('is deterministic — same input produces identical output', () => {
    const cfg = makeConfig();
    const a = generateCompose(cfg);
    const b = generateCompose(cfg);
    expect(a).toBe(b);
  });

  it('respects imageRegistry and imagePrefix overrides', () => {
    const cfg = makeConfig();
    const yaml = generateCompose(cfg, {
      imageRegistry: 'registry.example.com',
      imagePrefix: 'acme/witylogix',
    });
    expect(yaml).toContain('registry.example.com/acme/witylogix-api:latest');
  });

  it('includes depends_on postgres + redis for app services', () => {
    const cfg = makeConfig();
    const yaml = generateCompose(cfg);
    const doc = parseYaml(yaml);
    expect(doc.services.api.depends_on.postgres.condition).toBe('service_healthy');
    expect(doc.services.api.depends_on.redis.condition).toBe('service_healthy');
  });
});
