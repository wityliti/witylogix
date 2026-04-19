import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const metaSchema = z.object({
  name: z.string().min(1),
  owner: z.string().optional(),
  contact: z.string().optional(),
});

const witylogixSchema = z.object({
  version: z.string().nullable().default(null),
  channel: z.enum(['stable', 'beta', 'canary']).default('stable'),
});

const providerSchema = z.object({
  type: z.enum(['docker-compose', 'railway', 'fly', 'k8s', 'systemd']),
  config: z.record(z.unknown()).default({}),
});

const serviceSchema = z
  .object({
    replicas: z.number().int().positive().default(1),
    resources: z
      .object({
        cpu: z.string().optional(),
        memory: z.string().optional(),
      })
      .optional(),
    domain: z.string().optional(),
  })
  .default({ replicas: 1 });

const servicesSchema = z
  .object({
    api: serviceSchema.optional(),
    dashboard: serviceSchema.optional(),
    'customer-portal': serviceSchema.optional(),
    'tracking-page': serviceSchema.optional(),
    docs: serviceSchema.optional(),
  })
  .default({});

const databaseSchema = z.object({
  provider: z
    .enum(['postgres-managed', 'postgres-external', 'postgres-self-hosted'])
    .default('postgres-self-hosted'),
  version: z.string().default('16'),
  isolation: z.enum(['rls', 'dedicated']).default('rls'),
  backup: z
    .object({
      schedule: z.string().default('0 3 * * *'),
      retention_days: z.number().int().positive().default(30),
    })
    .default({ schedule: '0 3 * * *', retention_days: 30 }),
});

const redisSchema = z.object({
  provider: z
    .enum(['redis-managed', 'redis-external', 'redis-self-hosted'])
    .default('redis-self-hosted'),
  version: z.string().default('7'),
});

const secretsSchema = z.object({
  backend: z.enum(['file', 'doppler', 'sops', 'railway', 'fly']).default('file'),
  path: z.string().optional(),
  project: z.string().optional(),
  config: z.string().optional(),
});

const observabilitySchema = z
  .object({
    traces: z
      .object({
        enabled: z.boolean().default(false),
        otlp_endpoint: z.string().optional(),
      })
      .default({ enabled: false }),
    logs: z
      .object({
        sink: z.string().default('stdout'),
        endpoint: z.string().optional(),
      })
      .default({ sink: 'stdout' }),
    metrics: z
      .object({
        prometheus_scrape: z.boolean().default(false),
      })
      .default({ prometheus_scrape: false }),
  })
  .default({});

const cloudSchema = z
  .object({
    plan: z.enum(['managed', 'dedicated']),
    tenant_slug: z.string(),
    billing_id: z.string().optional(),
  })
  .optional();

export const benchConfigSchema = z.object({
  apiVersion: z.literal('bench.witylogix.io/v1'),
  kind: z.literal('Installation'),
  metadata: metaSchema,
  witylogix: witylogixSchema.default({ version: null, channel: 'stable' }),
  provider: providerSchema,
  services: servicesSchema,
  database: databaseSchema.default({}),
  redis: redisSchema.default({}),
  secrets: secretsSchema.default({ backend: 'file' }),
  observability: observabilitySchema,
  cloud: cloudSchema,
});

export type BenchConfig = z.infer<typeof benchConfigSchema>;
export type BenchConfigMeta = BenchConfig['metadata'];
export type BenchConfigProvider = BenchConfig['provider'];
export type BenchConfigDatabase = BenchConfig['database'];
export type BenchConfigServices = BenchConfig['services'];

export const DEFAULT_CONFIG_FILENAME = 'bench.config.yaml';

export function loadConfig(cwd: string, filename = DEFAULT_CONFIG_FILENAME): BenchConfig {
  const path = resolve(cwd, filename);
  const raw = readFileSync(path, 'utf8');
  const parsed = parseYaml(raw);
  const result = benchConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new BenchConfigError(`Invalid ${filename}:\n${issues}`);
  }
  return result.data;
}

export class BenchConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BenchConfigError';
  }
}
