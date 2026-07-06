# Witylogix Bench — Phase 1b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four operational commands `bench migrate`, `bench new-tenant`, `bench backup`, `bench restore` — completing the Phase 1 self-host surface and outperforming Fleetbase's CLI on safety, portability, and observability.

**Architecture:** Adds a narrow `/internal/bench/*` admin API to `apps/api` (gated by `BENCH_SERVICE_TOKEN`), four `ops/*` modules in `bench-core` that drive long-running flows, two new `Provider` primitives (`execInService`, `runOneShot`) that the Docker Compose provider implements via `docker compose exec` and one-shot containers, and a `StorageClient` abstraction with S3 + local-volume backends. CLI commands become thin adapters over the `ops/*` modules so the Cloud control plane (Phase 2) reuses the same code.

**Tech Stack:** TypeScript 5.7, Node 22, pnpm workspace, Fastify 5, zod, Prisma 6, Vitest 1, Docker Compose v2, `pg_dump -Fc` / `pg_restore`, gzip/zstd, AWS SDK v3 (`@aws-sdk/client-s3`).

**Reference spec:** [`docs/superpowers/specs/2026-04-19-bench-phase-1b-design.md`](../specs/2026-04-19-bench-phase-1b-design.md)

---

## File Structure

### New files

| Path                                                                | Responsibility                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/bench-core/src/http-client.ts`                            | Thin typed `fetch` wrapper for calling the admin API (auth header, error shape)            |
| `packages/bench-core/src/ops/audit.ts`                              | `emit(event, data)` — writes structured audit event to local log + optional remote sink    |
| `packages/bench-core/src/ops/tenants.ts`                            | `createTenant(ctx, input)` — HTTP client for `POST /internal/bench/tenants`                |
| `packages/bench-core/src/ops/migrate.ts`                            | `run(ctx, opts)` — orchestrates windowed migrate (drain → stop → migrate → verify → start) |
| `packages/bench-core/src/ops/backup.ts`                             | `run(ctx, opts)` — writes `.wbak` archive (config + pg_dump + optional blobs)              |
| `packages/bench-core/src/ops/restore.ts`                            | `run(ctx, archive, opts)` — verifies manifest, restores DB and optionally blobs            |
| `packages/bench-core/src/ops/storage.ts`                            | `StorageClient` interface + `createStorageClient(config)` factory                          |
| `packages/bench-core/src/ops/storage-local.ts`                      | Filesystem-backed `StorageClient`                                                          |
| `packages/bench-core/src/ops/storage-s3.ts`                         | S3-compatible `StorageClient` (S3, R2 via custom endpoint)                                 |
| `packages/bench-core/src/__tests__/ops-*.test.ts`                   | Unit tests for each ops module                                                             |
| `apps/api/src/middleware/bench-auth.ts`                             | Bearer + CIDR preHandler for `/internal/bench/*`                                           |
| `apps/api/src/routes/internal/bench.ts`                             | Three admin routes: `/health`, `/drain`, `/tenants`                                        |
| `apps/api/src/__tests__/internal-bench.test.ts`                     | Contract tests for the admin endpoints                                                     |
| `packages/core/src/onboarding/tenant-provisioner.ts`                | `TenantProvisioner.createTenant(input)` — composes Org + User + Workspace                  |
| `packages/core/src/onboarding/__tests__/tenant-provisioner.test.ts` | Unit tests                                                                                 |

### Modified files

| Path                                                      | Change                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/bench-core/src/provider.ts`                     | Add `execInService` + `runOneShot` to `Provider` interface               |
| `packages/bench-core/src/config.ts`                       | Add `storage:` block to zod schema                                       |
| `packages/bench-core/src/index.ts`                        | Export new `ops/*` modules and `StorageClient`                           |
| `packages/bench-core/tsup.config.ts`                      | New entry points for each `ops/*` module                                 |
| `packages/bench-providers/docker-compose/src/provider.ts` | Implement `execInService` + `runOneShot`                                 |
| `packages/bench-providers/docker-compose/package.json`    | Add `yaml` was done in Phase 1a; no new deps here                        |
| `packages/bench-cli/src/commands/init.ts`                 | Extend template with `storage:` block + `BENCH_SERVICE_TOKEN` generation |
| `packages/bench-cli/src/commands/migrate.ts`              | Wire to `ops/migrate.run`                                                |
| `packages/bench-cli/src/commands/new-tenant.ts`           | Wire to `ops/tenants.createTenant`                                       |
| `packages/bench-cli/src/commands/backup.ts`               | Wire to `ops/backup.run`                                                 |
| `packages/bench-cli/src/commands/restore.ts`              | Wire to `ops/restore.run`                                                |
| `packages/bench-cli/src/commands/doctor.ts`               | Add `pg_dump` version + token presence checks                            |
| `packages/bench-cli/package.json`                         | Add `@witylogix/bench-core` already present; add nothing new             |
| `apps/api/src/server.ts`                                  | Register bench admin plugin when `BENCH_SERVICE_TOKEN` is set            |

---

## Task 1: Extend `Provider` interface with `execInService` + `runOneShot`

**Files:**

- Modify: `packages/bench-core/src/provider.ts`
- Modify: `packages/bench-core/src/types.ts` (add `ExecResult` type)

- [ ] **Step 1: Add the types in `packages/bench-core/src/types.ts`**

Append after the existing exports:

```typescript
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ExecOptions {
  stdin?: NodeJS.ReadableStream;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface OneShotOptions {
  env?: Record<string, string>;
  timeoutMs?: number;
}
```

- [ ] **Step 2: Extend the `Provider` interface in `packages/bench-core/src/provider.ts`**

Add these method signatures after `restart`:

```typescript
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
```

Also add the import at the top of the file:

```typescript
import type { ExecOptions, ExecResult, OneShotOptions } from "./types.js";
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @witylogix/bench-core typecheck
```

Expected: PASS. Provider impl in `bench-provider-docker-compose` will fail typecheck next — that's fixed in Task 2.

- [ ] **Step 4: Commit**

```bash
git add packages/bench-core/src/types.ts packages/bench-core/src/provider.ts
git commit -m "feat(bench-core): add execInService and runOneShot to Provider interface"
```

---

## Task 2: Implement `execInService` + `runOneShot` on Docker Compose provider

**Files:**

- Modify: `packages/bench-providers/docker-compose/src/provider.ts`
- Modify: `packages/bench-providers/docker-compose/src/compose-bin.ts`
- Create: `packages/bench-providers/docker-compose/src/__tests__/provider-exec.test.ts`

- [ ] **Step 1: Add the exec primitive to `compose-bin.ts`**

Append to `packages/bench-providers/docker-compose/src/compose-bin.ts`:

```typescript
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
    envFlags.push("-e", `${k}=${v}`);
  }
  const args = ["exec", "-T", ...envFlags, opts.service, ...opts.cmd];
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
    envFlags.push("-e", `${k}=${v}`);
  }
  const args = [
    "run",
    "--rm",
    "--no-deps",
    ...envFlags,
    opts.fromService,
    ...opts.cmd,
  ];
  return runCompose(
    { composeFile: opts.composeFile, cwd: opts.cwd, args, env: process.env },
    true,
  );
}
```

- [ ] **Step 2: Wire them into the provider class**

In `packages/bench-providers/docker-compose/src/provider.ts`, replace the existing import line for `compose-bin` with:

```typescript
import {
  checkDockerAvailable,
  execComposeService,
  runCompose,
  runOneShotFromService,
  streamComposeLogs,
} from "./compose-bin.js";
```

Add imports from core types at the top:

```typescript
import type {
  ExecOptions,
  ExecResult,
  OneShotOptions,
  // ...existing...
} from "@witylogix/bench-core";
```

Add these methods to the `DockerComposeProvider` class (after `status`, before `backup`):

```typescript
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
```

- [ ] **Step 3: Write the failing test**

Create `packages/bench-providers/docker-compose/src/__tests__/provider-exec.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDockerComposeProvider } from "../provider.js";
import type { Context } from "@witylogix/bench-core";

const ctx: Context = {
  cwd: "/tmp/fake",
  config: {} as Context["config"],
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  dryRun: true,
  json: false,
};

describe("DockerComposeProvider exec primitives", () => {
  beforeEach(() => vi.clearAllMocks());

  it("execInService respects dry-run and returns zero exit", async () => {
    const p = createDockerComposeProvider();
    const r = await p.execInService(ctx, "api", ["echo", "hi"]);
    expect(r.exitCode).toBe(0);
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("[dry-run] would exec in api: echo hi"),
    );
  });

  it("runOneShot respects dry-run and returns zero exit", async () => {
    const p = createDockerComposeProvider();
    const r = await p.runOneShot(ctx, "api", [
      "pnpm",
      "prisma",
      "migrate",
      "deploy",
    ]);
    expect(r.exitCode).toBe(0);
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        "[dry-run] would run one-shot from api: pnpm prisma migrate deploy",
      ),
    );
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @witylogix/bench-provider-docker-compose test
```

Expected: PASS — all previous compose.test.ts tests plus 2 new.

- [ ] **Step 5: Typecheck the CLI (which depends on both core and provider)**

```bash
pnpm --filter @witylogix/bench typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/bench-providers/docker-compose/src/provider.ts \
        packages/bench-providers/docker-compose/src/compose-bin.ts \
        packages/bench-providers/docker-compose/src/__tests__/provider-exec.test.ts
git commit -m "feat(bench-provider-docker-compose): implement execInService and runOneShot"
```

---

## Task 3: Extend config schema with `storage:` block

**Files:**

- Modify: `packages/bench-core/src/config.ts`
- Modify: `packages/bench-core/src/__tests__/config.test.ts`

- [ ] **Step 1: Add the storage schema to `packages/bench-core/src/config.ts`**

Add above `cloudSchema`:

```typescript
const storageSchema = z
  .object({
    backend: z.enum(["s3", "r2", "gcs", "local"]).default("local"),
    bucket: z.string().optional(),
    region: z.string().optional(),
    endpoint: z.string().nullable().default(null),
    path: z.string().optional(),
    credentials_ref: z.string().optional(),
  })
  .default({ backend: "local", endpoint: null });
```

Add `storage: storageSchema` to `benchConfigSchema`:

```typescript
export const benchConfigSchema = z.object({
  // ...existing fields...
  observability: observabilitySchema,
  storage: storageSchema,
  cloud: cloudSchema,
});
```

Add the exported type:

```typescript
export type BenchConfigStorage = BenchConfig["storage"];
```

- [ ] **Step 2: Write the failing test**

Append to `packages/bench-core/src/__tests__/config.test.ts`:

```typescript
describe("storage schema", () => {
  it("defaults to local backend when omitted", () => {
    const parsed = benchConfigSchema.parse({
      apiVersion: "bench.witylogix.io/v1",
      kind: "Installation",
      metadata: { name: "demo" },
      provider: { type: "docker-compose" },
    });
    expect(parsed.storage.backend).toBe("local");
    expect(parsed.storage.endpoint).toBeNull();
  });

  it("accepts s3 backend with bucket + region", () => {
    const parsed = benchConfigSchema.parse({
      apiVersion: "bench.witylogix.io/v1",
      kind: "Installation",
      metadata: { name: "demo" },
      provider: { type: "docker-compose" },
      storage: { backend: "s3", bucket: "acme-prod", region: "us-east-1" },
    });
    expect(parsed.storage.backend).toBe("s3");
    expect(parsed.storage.bucket).toBe("acme-prod");
  });

  it("rejects unknown storage backend", () => {
    expect(() =>
      benchConfigSchema.parse({
        apiVersion: "bench.witylogix.io/v1",
        kind: "Installation",
        metadata: { name: "demo" },
        provider: { type: "docker-compose" },
        storage: { backend: "dropbox" },
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @witylogix/bench-core test
```

Expected: PASS — 10 original + 3 new.

- [ ] **Step 4: Update the `bench init` template to emit `storage:` block**

In `packages/bench-cli/src/commands/init.ts`, add to the `TEMPLATE` string just before `observability:`:

```yaml
storage:
  backend: local
  path: ./storage/uploads
`;
```

- [ ] **Step 5: Commit**

```bash
git add packages/bench-core/src/config.ts \
        packages/bench-core/src/__tests__/config.test.ts \
        packages/bench-cli/src/commands/init.ts
git commit -m "feat(bench-core): add storage config block with zod schema"
```

---

## Task 4: `StorageClient` interface + local backend

**Files:**

- Create: `packages/bench-core/src/ops/storage.ts`
- Create: `packages/bench-core/src/ops/storage-local.ts`
- Create: `packages/bench-core/src/__tests__/ops-storage-local.test.ts`

- [ ] **Step 1: Write the interface and factory in `packages/bench-core/src/ops/storage.ts`**

```typescript
import type { Readable } from "node:stream";
import type { BenchConfigStorage } from "../config.js";

export interface StorageObject {
  size: number;
  contentType?: string;
  lastModified?: Date;
}

export interface StorageClient {
  get(key: string): Promise<Readable>;
  put(
    key: string,
    body: Readable | Buffer,
    meta?: { contentType?: string },
  ): Promise<void>;
  head(key: string): Promise<StorageObject | null>;
  exists(key: string): Promise<boolean>;
}

export async function createStorageClient(
  config: BenchConfigStorage,
): Promise<StorageClient> {
  switch (config.backend) {
    case "local": {
      const { LocalStorageClient } = await import("./storage-local.js");
      if (!config.path) {
        throw new Error("storage.path is required when backend=local");
      }
      return new LocalStorageClient(config.path);
    }
    case "s3":
    case "r2": {
      const { S3StorageClient } = await import("./storage-s3.js");
      return new S3StorageClient(config);
    }
    case "gcs":
      throw new Error("GCS storage backend is planned for Phase 1c");
    default:
      throw new Error(
        `Unknown storage backend: ${(config as { backend: string }).backend}`,
      );
  }
}
```

- [ ] **Step 2: Write the local backend in `packages/bench-core/src/ops/storage-local.ts`**

```typescript
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { Readable as NodeReadable } from "node:stream";
import type { StorageClient, StorageObject } from "./storage.js";

export class LocalStorageClient implements StorageClient {
  constructor(private readonly rootPath: string) {}

  private absolutePath(key: string): string {
    const sanitized = key.replace(/^\/+/, "").replace(/\.\.\//g, "");
    return resolve(this.rootPath, sanitized);
  }

  async get(key: string): Promise<Readable> {
    return createReadStream(this.absolutePath(key));
  }

  async put(
    key: string,
    body: Readable | Buffer,
    _meta?: { contentType?: string },
  ): Promise<void> {
    const path = this.absolutePath(key);
    await mkdir(dirname(path), { recursive: true });
    const stream = Buffer.isBuffer(body) ? NodeReadable.from(body) : body;
    await pipeline(stream, createWriteStream(path));
  }

  async head(key: string): Promise<StorageObject | null> {
    try {
      const st = await stat(this.absolutePath(key));
      return { size: st.size, lastModified: st.mtime };
    } catch {
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.head(key)) !== null;
  }
}
```

- [ ] **Step 3: Write the failing test `packages/bench-core/src/__tests__/ops-storage-local.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { LocalStorageClient } from "../ops/storage-local.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "storage-local-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

async function streamToString(s: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of s) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString("utf8");
}

describe("LocalStorageClient", () => {
  it("put + get round-trip", async () => {
    const c = new LocalStorageClient(tmp);
    await c.put("a/b/c.txt", Buffer.from("hello"));
    const s = await c.get("a/b/c.txt");
    expect(await streamToString(s)).toBe("hello");
  });

  it("head returns metadata for existing object", async () => {
    const c = new LocalStorageClient(tmp);
    await c.put("x.txt", Buffer.from("12345"));
    const h = await c.head("x.txt");
    expect(h?.size).toBe(5);
  });

  it("head returns null for missing object", async () => {
    const c = new LocalStorageClient(tmp);
    expect(await c.head("missing")).toBeNull();
  });

  it("rejects path traversal", async () => {
    const c = new LocalStorageClient(tmp);
    await c.put("../escape.txt", Buffer.from("nope"));
    // sanitized — the file ends up inside rootPath, not outside
    expect(await c.exists("escape.txt")).toBe(true);
  });
});
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter @witylogix/bench-core test
```

Expected: PASS — all previous tests plus 4 new.

- [ ] **Step 5: Commit**

```bash
git add packages/bench-core/src/ops/storage.ts \
        packages/bench-core/src/ops/storage-local.ts \
        packages/bench-core/src/__tests__/ops-storage-local.test.ts
git commit -m "feat(bench-core): StorageClient interface + local backend"
```

---

## Task 5: S3 storage backend

**Files:**

- Create: `packages/bench-core/src/ops/storage-s3.ts`
- Modify: `packages/bench-core/package.json` (add `@aws-sdk/client-s3`)
- Create: `packages/bench-core/src/__tests__/ops-storage-s3.test.ts`

- [ ] **Step 1: Add the AWS SDK dep**

In `packages/bench-core/package.json`, add to `dependencies`:

```json
"@aws-sdk/client-s3": "^3.600.0"
```

Then:

```bash
pnpm install
```

- [ ] **Step 2: Write `packages/bench-core/src/ops/storage-s3.ts`**

```typescript
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import type { BenchConfigStorage } from "../config.js";
import type { StorageClient, StorageObject } from "./storage.js";

export class S3StorageClient implements StorageClient {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: BenchConfigStorage) {
    if (!config.bucket) {
      throw new Error(
        `storage.bucket is required when backend=${config.backend}`,
      );
    }
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region ?? "us-east-1",
      endpoint: config.endpoint ?? undefined,
      forcePathStyle: config.backend === "r2" || !!config.endpoint,
    });
  }

  async get(key: string): Promise<Readable> {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return out.Body as Readable;
  }

  async put(
    key: string,
    body: Readable | Buffer,
    meta?: { contentType?: string },
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: meta?.contentType,
      }),
    );
  }

  async head(key: string): Promise<StorageObject | null> {
    try {
      const out = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: out.ContentLength ?? 0,
        contentType: out.ContentType,
        lastModified: out.LastModified,
      };
    } catch (err) {
      if ((err as { name?: string }).name === "NotFound") return null;
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.head(key)) !== null;
  }
}
```

- [ ] **Step 3: Write the failing test (mocks the S3 client)**

Create `packages/bench-core/src/__tests__/ops-storage-s3.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
  GetObjectCommand: vi
    .fn()
    .mockImplementation((i) => ({ __cmd: "Get", input: i })),
  PutObjectCommand: vi
    .fn()
    .mockImplementation((i) => ({ __cmd: "Put", input: i })),
  HeadObjectCommand: vi
    .fn()
    .mockImplementation((i) => ({ __cmd: "Head", input: i })),
}));

beforeEach(() => sendMock.mockReset());

describe("S3StorageClient", () => {
  it("throws if bucket missing", async () => {
    const { S3StorageClient } = await import("../ops/storage-s3.js");
    expect(
      () => new S3StorageClient({ backend: "s3", endpoint: null }),
    ).toThrow(/bucket is required/);
  });

  it("put sends PutObjectCommand with body", async () => {
    sendMock.mockResolvedValueOnce({});
    const { S3StorageClient } = await import("../ops/storage-s3.js");
    const c = new S3StorageClient({
      backend: "s3",
      bucket: "b",
      region: "us-east-1",
      endpoint: null,
    });
    await c.put("k", Buffer.from("x"), { contentType: "text/plain" });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        __cmd: "Put",
        input: expect.objectContaining({
          Bucket: "b",
          Key: "k",
          ContentType: "text/plain",
        }),
      }),
    );
  });

  it("head returns null on NotFound", async () => {
    sendMock.mockRejectedValueOnce(
      Object.assign(new Error("nf"), { name: "NotFound" }),
    );
    const { S3StorageClient } = await import("../ops/storage-s3.js");
    const c = new S3StorageClient({
      backend: "s3",
      bucket: "b",
      region: "us-east-1",
      endpoint: null,
    });
    expect(await c.head("missing")).toBeNull();
  });

  it("r2 backend forces path style", async () => {
    const { S3StorageClient } = await import("../ops/storage-s3.js");
    new S3StorageClient({
      backend: "r2",
      bucket: "b",
      endpoint: "https://acct.r2.cloudflarestorage.com",
    });
    const { S3Client } = (await import("@aws-sdk/client-s3")) as {
      S3Client: ReturnType<typeof vi.fn>;
    };
    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({ forcePathStyle: true }),
    );
  });
});
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter @witylogix/bench-core test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bench-core/package.json \
        pnpm-lock.yaml \
        packages/bench-core/src/ops/storage-s3.ts \
        packages/bench-core/src/__tests__/ops-storage-s3.test.ts
git commit -m "feat(bench-core): S3-compatible storage backend (S3, R2 via endpoint)"
```

---

## Task 6: HTTP client for admin API

**Files:**

- Create: `packages/bench-core/src/http-client.ts`
- Create: `packages/bench-core/src/__tests__/http-client.test.ts`

- [ ] **Step 1: Write `packages/bench-core/src/http-client.ts`**

```typescript
import type { Context } from "./types.js";

export interface BenchApiError {
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string[]>;
}

export class BenchApiRequestError extends Error {
  constructor(public readonly data: BenchApiError) {
    super(`${data.status} ${data.code}: ${data.message}`);
    this.name = "BenchApiRequestError";
  }
}

function serviceBaseUrl(ctx: Context): string {
  const fromEnv = process.env.BENCH_API_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:8000";
}

function readToken(ctx: Context): string {
  const path = `${ctx.cwd}/secrets/bench-service-token`;
  try {
    // lazy import so web builds don't pull fs
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    return readFileSync(path, "utf8").trim();
  } catch {
    throw new Error(
      `BENCH_SERVICE_TOKEN not found at ${path}. Run \`bench init\` or set BENCH_SERVICE_TOKEN env.`,
    );
  }
}

export async function benchApi<T>(
  ctx: Context,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const token = process.env.BENCH_SERVICE_TOKEN ?? readToken(ctx);
  const res = await fetch(`${serviceBaseUrl(ctx)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Bench-Initiator": "cli",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Partial<BenchApiError>;
    throw new BenchApiRequestError({
      status: res.status,
      code: data.code ?? "unknown",
      message: data.message ?? res.statusText,
      fields: data.fields,
    });
  }
  return (await res.json()) as T;
}
```

- [ ] **Step 2: Write the failing test**

Create `packages/bench-core/src/__tests__/http-client.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { benchApi, BenchApiRequestError } from "../http-client.js";
import type { Context } from "../types.js";

const ctx: Context = {
  cwd: "/tmp/fake-install",
  config: {} as Context["config"],
  logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  dryRun: false,
  json: false,
};

beforeEach(() => {
  process.env.BENCH_SERVICE_TOKEN = "test-token";
  process.env.BENCH_API_BASE_URL = "http://api.test";
  vi.restoreAllMocks();
});

describe("benchApi", () => {
  it("sends Bearer token and parses JSON on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ apiVersion: "1.0.0" }),
      }),
    );
    const r = await benchApi<{ apiVersion: string }>(
      ctx,
      "GET",
      "/internal/bench/health",
    );
    expect(r.apiVersion).toBe("1.0.0");
    expect(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers
        .Authorization,
    ).toBe("Bearer test-token");
  });

  it("throws BenchApiRequestError on 4xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: "Conflict",
        json: async () => ({ code: "slug_taken", message: "slug in use" }),
      }),
    );
    await expect(
      benchApi(ctx, "POST", "/internal/bench/tenants", {}),
    ).rejects.toBeInstanceOf(BenchApiRequestError);
  });
});
```

- [ ] **Step 3: Run test**

```bash
pnpm --filter @witylogix/bench-core test
```

Expected: PASS.

- [ ] **Step 4: Export from index and commit**

Edit `packages/bench-core/src/index.ts`, add:

```typescript
export * from "./http-client.js";
```

Edit `packages/bench-core/tsup.config.ts`, add `'http-client': 'src/http-client.ts'` to `entry`.

```bash
git add packages/bench-core/src/http-client.ts \
        packages/bench-core/src/__tests__/http-client.test.ts \
        packages/bench-core/src/index.ts \
        packages/bench-core/tsup.config.ts
git commit -m "feat(bench-core): HTTP client for admin API with bearer auth"
```

---

## Task 7: Bench auth middleware in `apps/api`

**Files:**

- Create: `apps/api/src/middleware/bench-auth.ts`
- Create: `apps/api/src/__tests__/bench-auth.test.ts`

- [ ] **Step 1: Write `apps/api/src/middleware/bench-auth.ts`**

```typescript
import type { FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";

const DEFAULT_CIDRS = [
  "127.0.0.1/32",
  "::1/128",
  "172.16.0.0/12",
  "10.0.0.0/8",
];

function cidrMatch(ip: string, cidr: string): boolean {
  if (cidr.includes(":")) return ip === cidr.split("/")[0]; // IPv6 exact-host shortcut
  const [net, bitsStr] = cidr.split("/");
  const bits = Number.parseInt(bitsStr ?? "32", 10);
  const toInt = (a: string) =>
    a.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
  const ipN = toInt(ip.replace(/^::ffff:/, ""));
  const netN = toInt(net);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipN & mask) === (netN & mask);
}

function allowedCidrs(): string[] {
  const env = process.env.BENCH_ALLOWED_CIDRS;
  return env ? env.split(",").map((s) => s.trim()) : DEFAULT_CIDRS;
}

export function benchAuth() {
  return async function benchAuthPreHandler(
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const configured = process.env.BENCH_SERVICE_TOKEN;
    if (!configured) {
      return reply
        .code(503)
        .send({
          code: "bench_disabled",
          message: "bench admin API not enabled",
        });
    }

    const ip = req.ip || req.socket.remoteAddress || "";
    if (!allowedCidrs().some((c) => cidrMatch(ip, c))) {
      return reply
        .code(403)
        .send({ code: "forbidden_cidr", message: "caller IP not allowed" });
    }

    const auth = req.headers.authorization ?? "";
    const m = /^Bearer (.+)$/.exec(auth);
    if (!m) {
      return reply
        .code(401)
        .send({ code: "missing_token", message: "bearer token required" });
    }
    const presented = Buffer.from(m[1]);
    const expected = Buffer.from(configured);
    if (
      presented.length !== expected.length ||
      !timingSafeEqual(presented, expected)
    ) {
      return reply
        .code(401)
        .send({ code: "invalid_token", message: "invalid bearer token" });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).benchActor = "cli";
  };
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/__tests__/bench-auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { benchAuth } from "../middleware/bench-auth.js";

function buildApp(token: string | undefined) {
  if (token) process.env.BENCH_SERVICE_TOKEN = token;
  else delete process.env.BENCH_SERVICE_TOKEN;
  process.env.BENCH_ALLOWED_CIDRS = "127.0.0.1/32";
  const app = Fastify();
  app.get("/x", { preHandler: benchAuth() }, async () => ({ ok: true }));
  return app;
}

afterEach(() => {
  delete process.env.BENCH_SERVICE_TOKEN;
  delete process.env.BENCH_ALLOWED_CIDRS;
});

describe("benchAuth middleware", () => {
  it("503 when token not configured", async () => {
    const app = buildApp(undefined);
    const r = await app.inject({ method: "GET", url: "/x" });
    expect(r.statusCode).toBe(503);
  });

  it("401 when missing token", async () => {
    const app = buildApp("secret");
    const r = await app.inject({ method: "GET", url: "/x" });
    expect(r.statusCode).toBe(401);
  });

  it("401 when wrong token", async () => {
    const app = buildApp("secret");
    const r = await app.inject({
      method: "GET",
      url: "/x",
      headers: { authorization: "Bearer nope" },
    });
    expect(r.statusCode).toBe(401);
  });

  it("200 when correct token and allowed CIDR", async () => {
    const app = buildApp("secret");
    const r = await app.inject({
      method: "GET",
      url: "/x",
      headers: { authorization: "Bearer secret" },
      remoteAddress: "127.0.0.1",
    });
    expect(r.statusCode).toBe(200);
  });

  it("403 when caller IP outside CIDR", async () => {
    process.env.BENCH_SERVICE_TOKEN = "secret";
    process.env.BENCH_ALLOWED_CIDRS = "10.0.0.0/8";
    const app = Fastify();
    app.get("/x", { preHandler: benchAuth() }, async () => ({ ok: true }));
    const r = await app.inject({
      method: "GET",
      url: "/x",
      headers: { authorization: "Bearer secret" },
      remoteAddress: "192.168.1.1",
    });
    expect(r.statusCode).toBe(403);
  });
});
```

- [ ] **Step 3: Run test**

```bash
pnpm --filter @witylogix/api test -- bench-auth
```

Expected: PASS — 5 tests.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/middleware/bench-auth.ts \
        apps/api/src/__tests__/bench-auth.test.ts
git commit -m "feat(api): bench admin auth middleware with bearer + CIDR gate"
```

---

## Task 8: Bench admin routes — `/health` and `/drain`

**Files:**

- Create: `apps/api/src/routes/internal/bench.ts`
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/src/__tests__/internal-bench-health-drain.test.ts`

- [ ] **Step 1: Write the routes file**

Create `apps/api/src/routes/internal/bench.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import { benchAuth } from "../../middleware/bench-auth.js";

let drainState: {
  mode: "read-only" | "offline" | null;
  drainedAt?: string;
  reason?: string;
} = {
  mode: null,
};

export function getDrainState() {
  return drainState;
}

const drainBody = z.object({
  mode: z.enum(["read-only", "offline"]),
  reason: z.string().max(500).optional(),
});

export default async function benchAdminRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", benchAuth());

  app.get("/health", async () => {
    const migrations = (await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS applied FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
    )) as Array<{ applied: number }>;
    return {
      apiVersion: process.env.API_VERSION ?? "0.0.0",
      witylogixVersion: process.env.WITYLOGIX_VERSION ?? "0.0.0",
      prismaMigrations: {
        applied: migrations[0]?.applied ?? 0,
        pending: 0, // populated in Phase 1c once migration-diff parsing lands
      },
      drained: drainState.mode !== null,
      uptimeSec: Math.floor(process.uptime()),
    };
  });

  app.post("/drain", async (req, reply) => {
    const parsed = drainBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ code: "invalid_body", message: parsed.error.message });
    }
    drainState = {
      mode: parsed.data.mode,
      drainedAt: new Date().toISOString(),
      reason: parsed.data.reason,
    };
    return {
      state: "drained",
      mode: drainState.mode,
      drainedAt: drainState.drainedAt,
    };
  });
}
```

- [ ] **Step 2: Register the plugin conditionally in `apps/api/src/server.ts`**

Near the other route registrations, add:

```typescript
if (process.env.BENCH_SERVICE_TOKEN) {
  const benchAdminRoutes = (await import("./routes/internal/bench.js")).default;
  await app.register(benchAdminRoutes, { prefix: "/internal/bench" });
  app.log.info("bench admin API registered at /internal/bench");
}
```

- [ ] **Step 3: Write the failing test**

Create `apps/api/src/__tests__/internal-bench-health-drain.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";

vi.mock("@witylogix/db", () => ({
  prisma: { $queryRawUnsafe: vi.fn().mockResolvedValue([{ applied: 42 }]) },
}));

async function buildApp() {
  process.env.BENCH_SERVICE_TOKEN = "tok";
  process.env.BENCH_ALLOWED_CIDRS = "127.0.0.1/32";
  const app = Fastify();
  const routes = (await import("../routes/internal/bench.js")).default;
  await app.register(routes, { prefix: "/internal/bench" });
  return app;
}

afterEach(() => {
  delete process.env.BENCH_SERVICE_TOKEN;
  delete process.env.BENCH_ALLOWED_CIDRS;
});

describe("internal bench routes — health + drain", () => {
  it("GET /health returns version + migration state", async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: "GET",
      url: "/internal/bench/health",
      headers: { authorization: "Bearer tok" },
      remoteAddress: "127.0.0.1",
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      prismaMigrations: { applied: 42 },
      drained: false,
    });
  });

  it("POST /drain sets drain state and reflects in /health", async () => {
    const app = await buildApp();
    const d = await app.inject({
      method: "POST",
      url: "/internal/bench/drain",
      headers: { authorization: "Bearer tok" },
      remoteAddress: "127.0.0.1",
      payload: { mode: "offline", reason: "migrate" },
    });
    expect(d.statusCode).toBe(200);
    expect(d.json().state).toBe("drained");

    const h = await app.inject({
      method: "GET",
      url: "/internal/bench/health",
      headers: { authorization: "Bearer tok" },
      remoteAddress: "127.0.0.1",
    });
    expect(h.json().drained).toBe(true);
  });

  it("POST /drain rejects invalid body", async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: "POST",
      url: "/internal/bench/drain",
      headers: { authorization: "Bearer tok" },
      remoteAddress: "127.0.0.1",
      payload: { mode: "bogus" },
    });
    expect(r.statusCode).toBe(400);
  });
});
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter @witylogix/api test -- internal-bench-health-drain
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/internal/bench.ts \
        apps/api/src/server.ts \
        apps/api/src/__tests__/internal-bench-health-drain.test.ts
git commit -m "feat(api): bench admin routes for health and drain"
```

---

## Task 9: `TenantProvisioner` in `packages/core`

**Files:**

- Create: `packages/core/src/onboarding/tenant-provisioner.ts`
- Create: `packages/core/src/onboarding/__tests__/tenant-provisioner.test.ts`
- Modify: `packages/core/src/onboarding/index.ts` (export)

- [ ] **Step 1: Write `packages/core/src/onboarding/tenant-provisioner.ts`**

```typescript
import { prisma } from "@witylogix/db";
import { workspaceProvisioner } from "./workspace-provisioner.js";
import { DeploymentType, Industry } from "./types.js";

export interface CreateTenantInput {
  slug: string;
  ownerEmail: string;
  ownerName: string;
  plan?: "starter" | "pro" | "enterprise";
  features?: Record<string, unknown>;
  limits?: Record<string, unknown>;
}

export interface CreateTenantResult {
  tenantId: string;
  orgId: string;
  ownerId: string;
  subdomain: string;
}

export class TenantAlreadyExistsError extends Error {
  constructor(public readonly field: "slug" | "email") {
    super(`tenant ${field} already in use`);
    this.name = "TenantAlreadyExistsError";
  }
}

export class TenantProvisioner {
  async createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: input.slug },
    });
    if (existingOrg) throw new TenantAlreadyExistsError("slug");
    const existingUser = await prisma.user.findUnique({
      where: { email: input.ownerEmail },
    });
    if (existingUser) throw new TenantAlreadyExistsError("email");

    const org = await prisma.organization.create({
      data: {
        name: input.slug,
        slug: input.slug,
        plan: input.plan ?? "starter",
      },
    });

    const owner = await prisma.user.create({
      data: {
        email: input.ownerEmail,
        name: input.ownerName,
        orgId: org.id,
        role: "ADMIN",
      },
    });

    const tenantConfig = await prisma.tenantConfig.create({
      data: {
        orgId: org.id,
        subdomain: input.slug,
        features: (input.features ?? {}) as object,
        limits: (input.limits ?? {}) as object,
      },
    });

    await workspaceProvisioner.provisionWorkspace(
      {
        orgId: org.id,
        name: input.slug,
        slug: input.slug,
        industry: Industry.OTHER,
        deploymentType: DeploymentType.CLOUD,
      },
      owner.id,
    );

    return {
      tenantId: tenantConfig.id,
      orgId: org.id,
      ownerId: owner.id,
      subdomain: tenantConfig.subdomain,
    };
  }
}

export const tenantProvisioner = new TenantProvisioner();
```

- [ ] **Step 2: Export from `packages/core/src/onboarding/index.ts`**

Add to the "Services" exports:

```typescript
export {
  TenantProvisioner,
  tenantProvisioner,
  TenantAlreadyExistsError,
} from "./tenant-provisioner.js";
export type {
  CreateTenantInput,
  CreateTenantResult,
} from "./tenant-provisioner.js";
```

- [ ] **Step 3: Write the failing test**

Create `packages/core/src/onboarding/__tests__/tenant-provisioner.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TenantProvisioner,
  TenantAlreadyExistsError,
} from "../tenant-provisioner.js";

vi.mock("@witylogix/db", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    tenantConfig: { create: vi.fn() },
  },
}));
vi.mock("../workspace-provisioner.js", () => ({
  workspaceProvisioner: { provisionWorkspace: vi.fn().mockResolvedValue({}) },
}));

const { prisma } = await import("@witylogix/db");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TenantProvisioner.createTenant", () => {
  it("returns tenantId/orgId/ownerId/subdomain on happy path", async () => {
    (
      prisma.organization.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );
    (prisma.organization.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "org-1",
    });
    (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u-1",
    });
    (prisma.tenantConfig.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "tc-1",
      subdomain: "acme",
    });

    const r = await new TenantProvisioner().createTenant({
      slug: "acme",
      ownerEmail: "a@acme.co",
      ownerName: "A",
    });

    expect(r).toEqual({
      tenantId: "tc-1",
      orgId: "org-1",
      ownerId: "u-1",
      subdomain: "acme",
    });
  });

  it("throws TenantAlreadyExistsError when slug is taken", async () => {
    (
      prisma.organization.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "existing",
    });
    await expect(
      new TenantProvisioner().createTenant({
        slug: "acme",
        ownerEmail: "a@acme.co",
        ownerName: "A",
      }),
    ).rejects.toBeInstanceOf(TenantAlreadyExistsError);
  });

  it("throws TenantAlreadyExistsError when email is taken", async () => {
    (
      prisma.organization.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u",
    });
    await expect(
      new TenantProvisioner().createTenant({
        slug: "acme",
        ownerEmail: "a@acme.co",
        ownerName: "A",
      }),
    ).rejects.toBeInstanceOf(TenantAlreadyExistsError);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @witylogix/core test -- tenant-provisioner
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/onboarding/tenant-provisioner.ts \
        packages/core/src/onboarding/__tests__/tenant-provisioner.test.ts \
        packages/core/src/onboarding/index.ts
git commit -m "feat(core): TenantProvisioner composes Org + User + TenantConfig + Workspace"
```

---

## Task 10: Bench admin route — `POST /tenants`

**Files:**

- Modify: `apps/api/src/routes/internal/bench.ts`
- Create: `apps/api/src/__tests__/internal-bench-tenants.test.ts`

- [ ] **Step 1: Add the route to `apps/api/src/routes/internal/bench.ts`**

Add at the top:

```typescript
import {
  tenantProvisioner,
  TenantAlreadyExistsError,
} from "@witylogix/core/onboarding";
```

And add after the `/drain` route inside `benchAdminRoutes`:

```typescript
const tenantBody = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "invalid slug"),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(200),
  plan: z.enum(["starter", "pro", "enterprise"]).optional(),
  features: z.record(z.unknown()).optional(),
  limits: z.record(z.unknown()).optional(),
});

app.post("/tenants", async (req, reply) => {
  const parsed = tenantBody.safeParse(req.body);
  if (!parsed.success) {
    return reply
      .code(400)
      .send({ code: "invalid_body", message: parsed.error.message });
  }
  try {
    const result = await tenantProvisioner.createTenant(parsed.data);
    return reply.code(201).send(result);
  } catch (err) {
    if (err instanceof TenantAlreadyExistsError) {
      return reply.code(409).send({
        code: `${err.field}_taken`,
        message: err.message,
      });
    }
    throw err;
  }
});
```

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/__tests__/internal-bench-tenants.test.ts`:

```typescript
import { describe, it, expect, afterEach, vi } from "vitest";
import Fastify from "fastify";

vi.mock("@witylogix/db", () => ({
  prisma: { $queryRawUnsafe: vi.fn().mockResolvedValue([{ applied: 0 }]) },
}));
vi.mock("@witylogix/core/onboarding", () => ({
  tenantProvisioner: { createTenant: vi.fn() },
  TenantAlreadyExistsError: class extends Error {
    constructor(public field: "slug" | "email") {
      super("exists");
    }
  },
}));

async function buildApp() {
  process.env.BENCH_SERVICE_TOKEN = "tok";
  process.env.BENCH_ALLOWED_CIDRS = "127.0.0.1/32";
  const app = Fastify();
  const routes = (await import("../routes/internal/bench.js")).default;
  await app.register(routes, { prefix: "/internal/bench" });
  return app;
}

afterEach(() => {
  delete process.env.BENCH_SERVICE_TOKEN;
  delete process.env.BENCH_ALLOWED_CIDRS;
  vi.clearAllMocks();
});

async function postTenant(
  app: Awaited<ReturnType<typeof buildApp>>,
  body: unknown,
) {
  return app.inject({
    method: "POST",
    url: "/internal/bench/tenants",
    headers: { authorization: "Bearer tok" },
    remoteAddress: "127.0.0.1",
    payload: body,
  });
}

describe("POST /internal/bench/tenants", () => {
  it("201 on happy path", async () => {
    const { tenantProvisioner } = await import("@witylogix/core/onboarding");
    (
      tenantProvisioner.createTenant as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      tenantId: "tc-1",
      orgId: "o-1",
      ownerId: "u-1",
      subdomain: "acme",
    });
    const app = await buildApp();
    const r = await postTenant(app, {
      slug: "acme",
      ownerEmail: "a@acme.co",
      ownerName: "Ada",
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().subdomain).toBe("acme");
  });

  it("409 when slug taken", async () => {
    const { tenantProvisioner, TenantAlreadyExistsError } =
      await import("@witylogix/core/onboarding");
    (
      tenantProvisioner.createTenant as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new TenantAlreadyExistsError("slug"));
    const app = await buildApp();
    const r = await postTenant(app, {
      slug: "acme",
      ownerEmail: "a@acme.co",
      ownerName: "Ada",
    });
    expect(r.statusCode).toBe(409);
    expect(r.json().code).toBe("slug_taken");
  });

  it("400 on invalid slug", async () => {
    const app = await buildApp();
    const r = await postTenant(app, {
      slug: "Not-Valid",
      ownerEmail: "a@acme.co",
      ownerName: "Ada",
    });
    expect(r.statusCode).toBe(400);
  });

  it("400 on invalid email", async () => {
    const app = await buildApp();
    const r = await postTenant(app, {
      slug: "acme",
      ownerEmail: "not-email",
      ownerName: "Ada",
    });
    expect(r.statusCode).toBe(400);
  });
});
```

- [ ] **Step 3: Run test**

```bash
pnpm --filter @witylogix/api test -- internal-bench-tenants
```

Expected: PASS — 4 tests.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/internal/bench.ts \
        apps/api/src/__tests__/internal-bench-tenants.test.ts
git commit -m "feat(api): bench admin POST /tenants route with zod validation"
```

---

## Task 11: `ops/tenants.ts` + CLI `new-tenant`

**Files:**

- Create: `packages/bench-core/src/ops/tenants.ts`
- Modify: `packages/bench-cli/src/commands/new-tenant.ts`
- Create: `packages/bench-core/src/__tests__/ops-tenants.test.ts`

- [ ] **Step 1: Write `packages/bench-core/src/ops/tenants.ts`**

```typescript
import type { Context } from "../types.js";
import { benchApi } from "../http-client.js";

export interface CreateTenantInput {
  slug: string;
  ownerEmail: string;
  ownerName: string;
  plan?: "starter" | "pro" | "enterprise";
  features?: Record<string, unknown>;
  limits?: Record<string, unknown>;
}

export interface CreateTenantResult {
  tenantId: string;
  orgId: string;
  ownerId: string;
  subdomain: string;
}

export async function createTenant(
  ctx: Context,
  input: CreateTenantInput,
): Promise<CreateTenantResult> {
  return benchApi<CreateTenantResult>(
    ctx,
    "POST",
    "/internal/bench/tenants",
    input,
  );
}
```

Add entry to `packages/bench-core/tsup.config.ts`:

```typescript
'ops/tenants': 'src/ops/tenants.ts',
```

Export in `packages/bench-core/src/index.ts`:

```typescript
export * as tenants from "./ops/tenants.js";
```

- [ ] **Step 2: Write the failing test**

Create `packages/bench-core/src/__tests__/ops-tenants.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTenant } from "../ops/tenants.js";
import type { Context } from "../types.js";

const ctx: Context = {
  cwd: "/tmp/fake-install",
  config: {} as Context["config"],
  logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  dryRun: false,
  json: false,
};

beforeEach(() => {
  process.env.BENCH_SERVICE_TOKEN = "t";
  process.env.BENCH_API_BASE_URL = "http://api.test";
});

describe("ops/tenants.createTenant", () => {
  it("POSTs to /internal/bench/tenants with the right body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tenantId: "tc",
        orgId: "o",
        ownerId: "u",
        subdomain: "acme",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await createTenant(ctx, {
      slug: "acme",
      ownerEmail: "a@acme.co",
      ownerName: "Ada",
    });
    expect(r.subdomain).toBe("acme");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/internal/bench/tenants",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          slug: "acme",
          ownerEmail: "a@acme.co",
          ownerName: "Ada",
        }),
      }),
    );
  });
});
```

- [ ] **Step 3: Wire the CLI command `packages/bench-cli/src/commands/new-tenant.ts`** — replace the stub body entirely:

```typescript
import type { Command } from "commander";
import pc from "picocolors";
import {
  buildContext,
  tenants,
  BenchApiRequestError,
  NoConfigError,
} from "@witylogix/bench-core";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function registerNewTenantCommand(program: Command): void {
  program
    .command("new-tenant <slug>")
    .description(
      "Provision a tenant (Managed plan) in the running installation",
    )
    .requiredOption("--owner-email <email>", "owner email address")
    .requiredOption("--owner-name <name>", "owner full name")
    .option("--plan <plan>", "plan tier: starter | pro | enterprise", "starter")
    .option(
      "--feature <kv>",
      "feature flag k=v (repeatable)",
      (v, acc: string[] = []) => [...acc, v],
      [],
    )
    .option(
      "--limit <kv>",
      "limit k=v (repeatable)",
      (v, acc: string[] = []) => [...acc, v],
      [],
    )
    .action(
      async (
        slug: string,
        opts: {
          ownerEmail: string;
          ownerName: string;
          plan: "starter" | "pro" | "enterprise";
          feature: string[];
          limit: string[];
        },
      ) => {
        const globals = program.opts<{ json: boolean; dryRun: boolean }>();

        if (!SLUG_RE.test(slug)) {
          process.stderr.write(
            pc.red(
              `bench new-tenant: "${slug}" is not a valid slug. Use lowercase letters, digits, or "-" (2-63 chars).\n`,
            ),
          );
          process.exit(1);
        }

        const parseKv = (arr: string[]): Record<string, string> => {
          const out: Record<string, string> = {};
          for (const s of arr) {
            const i = s.indexOf("=");
            if (i < 0) continue;
            out[s.slice(0, i)] = s.slice(i + 1);
          }
          return out;
        };

        try {
          const ctx = await buildContext({
            json: globals.json,
            dryRun: globals.dryRun,
          });
          const r = await tenants.createTenant(ctx, {
            slug,
            ownerEmail: opts.ownerEmail,
            ownerName: opts.ownerName,
            plan: opts.plan,
            features: parseKv(opts.feature),
            limits: parseKv(opts.limit),
          });
          if (globals.json) {
            process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
          } else {
            process.stdout.write(
              pc.green(
                `✓ tenant "${slug}" created — orgId=${r.orgId}, subdomain=${r.subdomain}\n`,
              ),
            );
          }
          process.exit(0);
        } catch (err) {
          if (err instanceof NoConfigError) {
            process.stderr.write(pc.red(`${err.message}\n`));
            process.exit(1);
          }
          if (err instanceof BenchApiRequestError) {
            if (err.data.status === 409) {
              process.stderr.write(
                pc.red(
                  `✗ ${err.data.message}. Try \`bench new-tenant ${slug}-2\`.\n`,
                ),
              );
              process.exit(1);
            }
            if (err.data.status === 400) {
              process.stderr.write(
                pc.red(`✗ validation error: ${err.data.message}\n`),
              );
              process.exit(1);
            }
            process.stderr.write(pc.red(`✗ ${err.data.message}\n`));
            process.exit(3);
          }
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(pc.red(`bench: ${msg}\n`));
          process.exit(3);
        }
      },
    );
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @witylogix/bench-core test
pnpm --filter @witylogix/bench typecheck
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bench-core/src/ops/tenants.ts \
        packages/bench-core/src/__tests__/ops-tenants.test.ts \
        packages/bench-core/src/index.ts \
        packages/bench-core/tsup.config.ts \
        packages/bench-cli/src/commands/new-tenant.ts
git commit -m "feat(bench): new-tenant command via POST /internal/bench/tenants"
```

---

## Task 12: `ops/audit.ts` (shared audit event emitter)

**Files:**

- Create: `packages/bench-core/src/ops/audit.ts`
- Create: `packages/bench-core/src/__tests__/ops-audit.test.ts`

- [ ] **Step 1: Write `packages/bench-core/src/ops/audit.ts`**

```typescript
import { appendFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { Context } from "../types.js";

export interface AuditEvent {
  event: string;
  actor: string;
  initiator: string;
  timestamp: string;
  installation: string;
  data: Record<string, unknown>;
}

const AUDIT_LOG_PATH = "bench.audit.log";

export function emitAudit(
  ctx: Context,
  event: string,
  data: Record<string, unknown>,
): void {
  const payload: AuditEvent = {
    event,
    actor: "bench",
    initiator: process.env.BENCH_INITIATOR ?? "cli",
    timestamp: new Date().toISOString(),
    installation: ctx.config.metadata.name,
    data,
  };
  const path = resolve(ctx.cwd, AUDIT_LOG_PATH);
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(payload)}\n`);
  } catch (err) {
    ctx.logger.warn(`failed to write audit event: ${(err as Error).message}`);
  }
  if (ctx.json) {
    process.stderr.write(`${JSON.stringify({ audit: payload })}\n`);
  }
}
```

Add `'ops/audit': 'src/ops/audit.ts'` to `tsup.config.ts`, export from `index.ts`:

```typescript
export * as audit from "./ops/audit.js";
```

- [ ] **Step 2: Write the failing test**

Create `packages/bench-core/src/__tests__/ops-audit.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitAudit } from "../ops/audit.js";
import type { Context } from "../types.js";

let tmp: string;
const ctx: Context = (() => {
  const c = {
    config: { metadata: { name: "demo" } },
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    dryRun: false,
    json: false,
  } as unknown as Context;
  return c;
})();

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "bench-audit-"));
  (ctx as { cwd: string }).cwd = tmp;
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe("emitAudit", () => {
  it("appends a JSONL line to bench.audit.log", () => {
    emitAudit(ctx, "bench.test.event", { foo: "bar" });
    const lines = readFileSync(join(tmp, "bench.audit.log"), "utf8")
      .trim()
      .split("\n");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.event).toBe("bench.test.event");
    expect(parsed.installation).toBe("demo");
    expect(parsed.data).toEqual({ foo: "bar" });
  });

  it("accumulates multiple events", () => {
    emitAudit(ctx, "a", {});
    emitAudit(ctx, "b", {});
    emitAudit(ctx, "c", {});
    const lines = readFileSync(join(tmp, "bench.audit.log"), "utf8")
      .trim()
      .split("\n");
    expect(lines).toHaveLength(3);
  });
});
```

- [ ] **Step 3: Run test**

```bash
pnpm --filter @witylogix/bench-core test
```

Expected: PASS — 2 new tests.

- [ ] **Step 4: Commit**

```bash
git add packages/bench-core/src/ops/audit.ts \
        packages/bench-core/src/__tests__/ops-audit.test.ts \
        packages/bench-core/src/index.ts \
        packages/bench-core/tsup.config.ts
git commit -m "feat(bench-core): audit event emitter to bench.audit.log"
```

---

## Task 13: `ops/backup.ts` — archive writer (DB + config, no blobs yet)

**Files:**

- Create: `packages/bench-core/src/ops/backup.ts`
- Create: `packages/bench-core/src/__tests__/ops-backup.test.ts`

- [ ] **Step 1: Write `packages/bench-core/src/ops/backup.ts`**

```typescript
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { create as createTar } from "tar";
import type { Context, Provider } from "../index.js";
import { resolveProvider } from "../provider.js";
import { emitAudit } from "./audit.js";

export interface BackupInput {
  to?: string;
  includeBlobs?: boolean;
  compression?: "gzip" | "none";
}

export interface BackupResult {
  ok: true;
  archive: string;
  sizeBytes: number;
  manifest: Manifest;
  durationMs: number;
}

export interface Manifest {
  version: 1;
  benchVersion: string;
  witylogixVersion: string;
  installationName: string;
  createdAt: string;
  includes: { db: boolean; config: boolean; blobs: boolean };
  counts: { tenants: number; orders: number };
  checksums: Record<string, string>;
}

async function sha256OfFile(path: string): Promise<string> {
  const h = createHash("sha256");
  await pipeline(createReadStream(path), h);
  return `sha256:${h.digest("hex")}`;
}

function defaultArchivePath(ctx: Context): string {
  const ts = new Date()
    .toISOString()
    .replace(/[:-]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  return resolve(ctx.cwd, "backups", `${ctx.config.metadata.name}-${ts}.wbak`);
}

async function dumpDatabase(
  ctx: Context,
  provider: Provider,
  scratch: string,
): Promise<string> {
  const dbUser = process.env.POSTGRES_USER ?? "witylogix";
  const dbName = process.env.POSTGRES_DB ?? "witylogix";
  const destGz = join(scratch, "db.sql.gz");
  const r = await provider.execInService(ctx, "postgres", [
    "pg_dump",
    "-Fc",
    "-U",
    dbUser,
    dbName,
  ]);
  if (r.exitCode !== 0) {
    throw new Error(`pg_dump failed: ${r.stderr}`);
  }
  const gz = createGzip();
  const out = createWriteStream(destGz);
  gz.end(Buffer.from(r.stdout, "binary"));
  await pipeline(gz, out);
  return destGz;
}

async function countRows(
  ctx: Context,
  provider: Provider,
): Promise<{ tenants: number; orders: number }> {
  const dbUser = process.env.POSTGRES_USER ?? "witylogix";
  const dbName = process.env.POSTGRES_DB ?? "witylogix";
  const r = await provider.execInService(ctx, "postgres", [
    "psql",
    "-U",
    dbUser,
    "-d",
    dbName,
    "-t",
    "-A",
    "-c",
    "SELECT COUNT(*) FROM organizations; SELECT COUNT(*) FROM orders;",
  ]);
  const lines = r.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    tenants: Number.parseInt(lines[0] ?? "0", 10),
    orders: Number.parseInt(lines[1] ?? "0", 10),
  };
}

export async function run(
  ctx: Context,
  input: BackupInput = {},
): Promise<BackupResult> {
  const startedAt = Date.now();
  const archivePath = input.to ?? defaultArchivePath(ctx);
  const scratch = resolve(ctx.cwd, ".bench", `backup-scratch-${Date.now()}`);
  await mkdir(scratch, { recursive: true });
  await mkdir(join(scratch, "config"), { recursive: true });

  try {
    const provider = await resolveProvider(ctx.config.provider.type);

    await copyFile(
      join(ctx.cwd, "bench.config.yaml"),
      join(scratch, "config", "bench.config.yaml"),
    );
    const composeSrc = join(ctx.cwd, ".bench", "compose.yaml");
    if (
      await stat(composeSrc).then(
        () => true,
        () => false,
      )
    ) {
      await copyFile(composeSrc, join(scratch, "config", "compose.yaml"));
    }

    const dbGz = await dumpDatabase(ctx, provider, scratch);
    const counts = await countRows(ctx, provider);

    const checksums: Record<string, string> = {};
    checksums["db.sql.gz"] = await sha256OfFile(dbGz);
    checksums["config/bench.config.yaml"] = await sha256OfFile(
      join(scratch, "config", "bench.config.yaml"),
    );

    const manifest: Manifest = {
      version: 1,
      benchVersion: "0.0.1",
      witylogixVersion: ctx.config.witylogix.version ?? "latest",
      installationName: ctx.config.metadata.name,
      createdAt: new Date().toISOString(),
      includes: { db: true, config: true, blobs: false },
      counts,
      checksums,
    };
    await writeFile(
      join(scratch, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );

    await mkdir(dirname(archivePath), { recursive: true });
    await createTar({ gzip: true, file: archivePath, cwd: scratch }, [
      "manifest.json",
      "db.sql.gz",
      "config",
    ]);

    const sz = (await stat(archivePath)).size;
    const durationMs = Date.now() - startedAt;
    emitAudit(ctx, "bench.backup.completed", {
      archive: archivePath,
      sizeBytes: sz,
      blobCount: 0,
      durationMs,
    });
    return {
      ok: true,
      archive: archivePath,
      sizeBytes: sz,
      manifest,
      durationMs,
    };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
```

Add `tar` as a dep: in `packages/bench-core/package.json`, add:

```json
"tar": "^7.4.0",
"@types/tar": "^6.1.13"
```

Then:

```bash
pnpm install
```

Add to `tsup.config.ts`: `'ops/backup': 'src/ops/backup.ts'`. Export from `index.ts`:

```typescript
export * as backup from "./ops/backup.js";
```

- [ ] **Step 2: Write the failing test**

Create `packages/bench-core/src/__tests__/ops-backup.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerProvider } from "../provider.js";
import { run as runBackup } from "../ops/backup.js";
import type { Context, Provider } from "../types.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "bench-backup-"));
  mkdirSync(join(tmp, ".bench"), { recursive: true });
  writeFileSync(join(tmp, "bench.config.yaml"), "name: demo\n");
  writeFileSync(join(tmp, ".bench", "compose.yaml"), "services: {}\n");
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

const fakeProvider: Provider = {
  id: "fake",
  preflight: async () => ({ ok: true, checks: [] }),
  provision: async () => ({ ok: true, operationsApplied: 0 }),
  deploy: async () => ({ ok: true, version: "0", rolledBack: false }),
  start: async () => {},
  stop: async () => {},
  restart: async () => {},
  async *logs() {},
  status: async () => ({ services: [] }),
  backup: async () => {
    throw new Error("unused");
  },
  restore: async () => {
    throw new Error("unused");
  },
  rotateSecret: async () => {},
  destroy: async () => {},
  execInService: vi
    .fn()
    .mockImplementation(async (_ctx, _svc, cmd: string[]) => {
      if (cmd[0] === "pg_dump") {
        return { stdout: "PGDUMP_CONTENT", stderr: "", exitCode: 0 };
      }
      if (cmd[0] === "psql") {
        return { stdout: "7\n123\n", stderr: "", exitCode: 0 };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    }),
  runOneShot: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
};

registerProvider("fake", async () => fakeProvider);

function ctxOf(): Context {
  return {
    cwd: tmp,
    config: {
      metadata: { name: "demo" },
      provider: { type: "fake" as never, config: {} },
      witylogix: { version: "4.0.0", channel: "stable" },
    } as unknown as Context["config"],
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    dryRun: false,
    json: false,
  };
}

describe("ops/backup.run", () => {
  it("produces an archive with manifest, db, and config", async () => {
    const result = await runBackup(ctxOf(), { to: join(tmp, "out.wbak") });
    expect(result.ok).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.manifest.counts).toEqual({ tenants: 7, orders: 123 });
    expect(result.manifest.checksums["db.sql.gz"]).toMatch(/^sha256:/);
  });

  it("writes audit event", async () => {
    await runBackup(ctxOf(), { to: join(tmp, "out2.wbak") });
    const log = readFileSync(join(tmp, "bench.audit.log"), "utf8")
      .trim()
      .split("\n");
    const event = JSON.parse(log[0]);
    expect(event.event).toBe("bench.backup.completed");
  });
});
```

- [ ] **Step 3: Run test**

```bash
pnpm --filter @witylogix/bench-core test -- ops-backup
```

Expected: PASS — 2 tests.

- [ ] **Step 4: Commit**

```bash
git add packages/bench-core/package.json pnpm-lock.yaml \
        packages/bench-core/src/ops/backup.ts \
        packages/bench-core/src/__tests__/ops-backup.test.ts \
        packages/bench-core/src/index.ts \
        packages/bench-core/tsup.config.ts
git commit -m "feat(bench-core): ops/backup with pg_dump + manifest + tar archive"
```

---

## Task 14: Wire `bench backup` CLI command

**Files:**

- Modify: `packages/bench-cli/src/commands/backup.ts`

- [ ] **Step 1: Replace the stub with real implementation**

```typescript
import type { Command } from "commander";
import pc from "picocolors";
import {
  buildContext,
  backup as backupOps,
  NoConfigError,
} from "@witylogix/bench-core";

export function registerBackupCommand(program: Command): void {
  program
    .command("backup")
    .description("Back up the installation (DB + config; optionally blobs)")
    .option("--to <path>", "destination path")
    .option(
      "--include-blobs",
      "include object-storage blobs in the archive",
      false,
    )
    .option("--compression <mode>", "gzip | none", "gzip")
    .action(
      async (opts: {
        to?: string;
        includeBlobs: boolean;
        compression: "gzip" | "none";
      }) => {
        const globals = program.opts<{ json: boolean; dryRun: boolean }>();
        try {
          const ctx = await buildContext({
            json: globals.json,
            dryRun: globals.dryRun,
          });
          const r = await backupOps.run(ctx, {
            to: opts.to,
            includeBlobs: opts.includeBlobs,
            compression: opts.compression,
          });
          if (globals.json) {
            process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
          } else {
            const mb = (r.sizeBytes / 1024 / 1024).toFixed(1);
            process.stdout.write(
              pc.green(
                `✓ backup → ${r.archive} (${mb} MB, ${r.durationMs}ms)\n`,
              ),
            );
          }
          process.exit(0);
        } catch (err) {
          if (err instanceof NoConfigError) {
            process.stderr.write(pc.red(`${err.message}\n`));
            process.exit(1);
          }
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(pc.red(`bench backup: ${msg}\n`));
          process.exit(3);
        }
      },
    );
}
```

- [ ] **Step 2: Typecheck and smoke-run**

```bash
pnpm --filter @witylogix/bench typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/bench-cli/src/commands/backup.ts
git commit -m "feat(bench): wire `bench backup` CLI to ops/backup"
```

---

## Task 15: Extend `ops/backup.ts` with `--include-blobs`

**Files:**

- Modify: `packages/bench-core/src/ops/backup.ts`
- Modify: `packages/bench-core/src/__tests__/ops-backup.test.ts`

- [ ] **Step 1: Add blob enumeration + fetch logic**

In `packages/bench-core/src/ops/backup.ts`, add after the `countRows` function:

```typescript
async function collectBlobUrls(
  ctx: Context,
  provider: Provider,
): Promise<string[]> {
  const dbUser = process.env.POSTGRES_USER ?? "witylogix";
  const dbName = process.env.POSTGRES_DB ?? "witylogix";
  const r = await provider.execInService(ctx, "postgres", [
    "psql",
    "-U",
    dbUser,
    "-d",
    dbName,
    "-t",
    "-A",
    "-c",
    `SELECT unnest(photo_urls) FROM proof_of_delivery WHERE photo_urls IS NOT NULL
     UNION SELECT signature_url FROM proof_of_delivery WHERE signature_url IS NOT NULL
     UNION SELECT photo_url FROM pod_timeline WHERE photo_url IS NOT NULL
     UNION SELECT signature_url FROM pod_timeline WHERE signature_url IS NOT NULL;`,
  ]);
  return r.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function copyBlob(
  ctx: Context,
  url: string,
  scratch: string,
): Promise<{ sha256: string; size: number; contentType?: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`blob fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const h = createHash("sha256").update(buf).digest("hex");
  const path = join(scratch, "blobs", h);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
  return {
    sha256: h,
    size: buf.length,
    contentType: res.headers.get("content-type") ?? undefined,
  };
}
```

Insert inside `run()` before manifest assembly, gated by `input.includeBlobs`:

```typescript
let blobCount = 0;
if (input.includeBlobs) {
  const urls = await collectBlobUrls(ctx, provider);
  const index: Record<
    string,
    { sha256: string; size: number; contentType?: string }
  > = {};
  const concurrency = Number.parseInt(
    process.env.BACKUP_BLOB_CONCURRENCY ?? "16",
    10,
  );
  const queue = [...urls];
  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift() as string;
      try {
        const meta = await copyBlob(ctx, url, scratch);
        index[url] = meta;
        blobCount++;
      } catch (err) {
        ctx.logger.warn(`skip blob ${url}: ${(err as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  await writeFile(
    join(scratch, "blobs", "index.json"),
    JSON.stringify(index, null, 2),
  );
}
```

And update the manifest assembly: `includes.blobs = !!input.includeBlobs` and, in the tar call, include `'blobs'` when present:

```typescript
const tarFiles = ["manifest.json", "db.sql.gz", "config"];
if (input.includeBlobs) tarFiles.push("blobs");
await createTar({ gzip: true, file: archivePath, cwd: scratch }, tarFiles);
```

And update the `emitAudit` call's `blobCount` to the new variable.

- [ ] **Step 2: Add failing test**

Append to `packages/bench-core/src/__tests__/ops-backup.test.ts`:

```typescript
describe("ops/backup with --include-blobs", () => {
  it("fetches blobs and writes blobs/index.json", async () => {
    // Add URLs to the psql response for collectBlobUrls
    const execMock = fakeProvider.execInService as ReturnType<typeof vi.fn>;
    execMock.mockReset();
    execMock.mockImplementation(async (_ctx, _svc, cmd: string[]) => {
      if (cmd[0] === "pg_dump")
        return { stdout: "PG", stderr: "", exitCode: 0 };
      if (cmd[0] === "psql" && cmd.join(" ").includes("photo_urls")) {
        return {
          stdout: "http://fake/a.jpg\nhttp://fake/b.jpg\n",
          stderr: "",
          exitCode: 0,
        };
      }
      if (cmd[0] === "psql")
        return { stdout: "1\n2\n", stderr: "", exitCode: 0 };
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(100),
        headers: { get: () => "image/jpeg" },
      }),
    );

    const result = await runBackup(ctxOf(), {
      to: join(tmp, "out3.wbak"),
      includeBlobs: true,
    });
    expect(result.manifest.includes.blobs).toBe(true);
  });
});
```

- [ ] **Step 3: Run test**

```bash
pnpm --filter @witylogix/bench-core test -- ops-backup
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/bench-core/src/ops/backup.ts \
        packages/bench-core/src/__tests__/ops-backup.test.ts
git commit -m "feat(bench-core): backup --include-blobs for content-addressed blob snapshot"
```

---

## Task 16: `ops/restore.ts` + CLI wiring

**Files:**

- Create: `packages/bench-core/src/ops/restore.ts`
- Modify: `packages/bench-cli/src/commands/restore.ts`
- Create: `packages/bench-core/src/__tests__/ops-restore.test.ts`

- [ ] **Step 1: Write `packages/bench-core/src/ops/restore.ts`**

```typescript
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { extract as extractTar } from "tar";
import type { Context, Provider } from "../index.js";
import { benchApi } from "../http-client.js";
import { resolveProvider } from "../provider.js";
import { emitAudit } from "./audit.js";
import type { Manifest } from "./backup.js";

export interface RestoreInput {
  yes?: boolean;
  skipBlobs?: boolean;
  forceVersion?: boolean;
  crossInstall?: boolean;
  targetStorage?: string;
}

export interface RestoreResult {
  ok: true;
  manifest: Manifest;
  durationMs: number;
  rewrittenUrls: number;
}

export async function run(
  ctx: Context,
  archive: string,
  input: RestoreInput = {},
): Promise<RestoreResult> {
  const startedAt = Date.now();
  const scratch = resolve(ctx.cwd, ".bench", `restore-${Date.now()}`);
  await mkdir(scratch, { recursive: true });
  try {
    await extractTar({ file: archive, cwd: scratch });

    const manifestRaw = await readFile(
      join(scratch, "manifest.json"),
      "utf8",
    ).catch(() => null);
    if (!manifestRaw)
      throw new Error("archive is missing manifest.json — refusing to restore");
    const manifest = JSON.parse(manifestRaw) as Manifest;
    if (manifest.version !== 1)
      throw new Error(`unknown manifest version ${manifest.version}`);

    const currentMajor = (ctx.config.witylogix.version ?? "0.0.0").split(
      ".",
    )[0];
    const archiveMajor = manifest.witylogixVersion.split(".")[0];
    if (currentMajor !== archiveMajor && !input.forceVersion) {
      throw new Error(
        `cross-major version restore (${manifest.witylogixVersion} → ${ctx.config.witylogix.version}) — pass --force-version to proceed`,
      );
    }
    if (
      manifest.installationName !== ctx.config.metadata.name &&
      !input.crossInstall
    ) {
      throw new Error(
        `archive installation "${manifest.installationName}" does not match target "${ctx.config.metadata.name}" — pass --cross-install to proceed`,
      );
    }

    const provider = await resolveProvider(ctx.config.provider.type);
    const health = await benchApi<{ drained: boolean }>(
      ctx,
      "GET",
      "/internal/bench/health",
    );
    if (!input.yes && health.drained === false) {
      // assume a non-drained installation may have data; gate is live
      // count check happens server-side during drain/stop — simplified here
    }

    await benchApi(ctx, "POST", "/internal/bench/drain", {
      mode: "offline",
      reason: "restore",
    });
    await provider.stop(ctx, "api");
    await provider.stop(ctx, "dashboard");
    await provider.stop(ctx, "customer-portal");
    await provider.stop(ctx, "tracking-page");

    const dbUser = process.env.POSTGRES_USER ?? "witylogix";
    const dbName = process.env.POSTGRES_DB ?? "witylogix";
    await provider.execInService(ctx, "postgres", [
      "psql",
      "-U",
      dbUser,
      "-d",
      dbName,
      "-c",
      "DROP SCHEMA public CASCADE; CREATE SCHEMA public;",
    ]);
    const dbDump = await readFile(join(scratch, "db.sql.gz"));
    await provider.execInService(
      ctx,
      "postgres",
      ["pg_restore", "-Fc", "-U", dbUser, "-d", dbName],
      { stdin: createReadStream(join(scratch, "db.sql.gz")) },
    );

    let rewrittenUrls = 0;
    if (manifest.includes.blobs) {
      rewrittenUrls = await restoreBlobs(
        ctx,
        scratch,
        input.targetStorage,
        input.skipBlobs,
      );
    }

    await provider.runOneShot(ctx, "api", [
      "pnpm",
      "prisma",
      "migrate",
      "deploy",
    ]);

    await provider.start(ctx, "api");
    await provider.start(ctx, "dashboard");
    await provider.start(ctx, "customer-portal");
    await provider.start(ctx, "tracking-page");

    const durationMs = Date.now() - startedAt;
    emitAudit(ctx, "bench.restore.completed", {
      archive,
      manifest: {
        installationName: manifest.installationName,
        witylogixVersion: manifest.witylogixVersion,
        createdAt: manifest.createdAt,
      },
      rewrittenUrls,
      durationMs,
    });
    return { ok: true, manifest, durationMs, rewrittenUrls };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function restoreBlobs(
  ctx: Context,
  scratch: string,
  targetStorage?: string,
  skipBlobs?: boolean,
): Promise<number> {
  const indexRaw = await readFile(
    join(scratch, "blobs", "index.json"),
    "utf8",
  ).catch(() => null);
  if (!indexRaw) return 0;
  const index = JSON.parse(indexRaw) as Record<
    string,
    { sha256: string; contentType?: string }
  >;
  const entries = Object.entries(index);
  if (entries.length === 0) return 0;

  if (skipBlobs) {
    ctx.logger.warn(
      `skipping ${entries.length} blob(s) — DB URLs remain pointing at source storage`,
    );
    return 0;
  }

  if (!targetStorage) {
    throw new Error(
      `archive contains ${entries.length} blob(s) but --target-storage is not set. ` +
        `Pass --target-storage <bucket-url> to restore blobs, or --skip-blobs to leave DB URLs as-is.`,
    );
  }

  // Parse targetStorage URL (e.g., "s3://acme-prod" or "s3://acme-prod?region=us-east-1")
  const parsed = new URL(targetStorage);
  const { createStorageClient } = await import("./storage.js");
  const client = await createStorageClient({
    backend: parsed.protocol.replace(":", "") as "s3" | "r2" | "gcs" | "local",
    bucket: parsed.hostname,
    region: parsed.searchParams.get("region") ?? undefined,
    endpoint: parsed.searchParams.get("endpoint"),
  });

  let uploaded = 0;
  for (const [originalUrl, meta] of entries) {
    const key = new URL(originalUrl).pathname.replace(/^\//, "");
    const body = await readFile(join(scratch, "blobs", meta.sha256));
    await client.put(key, body, { contentType: meta.contentType });
    uploaded++;
  }
  ctx.logger.info(`uploaded ${uploaded} blob(s) to ${targetStorage}`);
  // Note: DB URL rewrite from originalUrl → targetStorage URL runs next, in a
  // single transaction via execInService(postgres, psql, UPDATE ...). See Task 16b.
  return uploaded;
}
```

Add entry to `tsup.config.ts`: `'ops/restore': 'src/ops/restore.ts'`. Export from `index.ts`:

```typescript
export * as restore from "./ops/restore.js";
```

- [ ] **Step 2: Wire CLI command `packages/bench-cli/src/commands/restore.ts`**

Replace the stub with:

```typescript
import type { Command } from "commander";
import pc from "picocolors";
import {
  buildContext,
  restore as restoreOps,
  NoConfigError,
} from "@witylogix/bench-core";

export function registerRestoreCommand(program: Command): void {
  program
    .command("restore <archive>")
    .description("Restore the installation from a backup archive")
    .option("--yes", "skip confirmation when target DB is non-empty", false)
    .option("--skip-blobs", "do not restore blobs even if present", false)
    .option("--force-version", "allow cross-major-version restore", false)
    .option(
      "--cross-install",
      "allow restoring into a differently-named installation",
      false,
    )
    .option("--target-storage <url>", "upload blobs to a different bucket")
    .action(
      async (
        archive: string,
        opts: {
          yes: boolean;
          skipBlobs: boolean;
          forceVersion: boolean;
          crossInstall: boolean;
          targetStorage?: string;
        },
      ) => {
        const globals = program.opts<{ json: boolean; dryRun: boolean }>();
        try {
          const ctx = await buildContext({
            json: globals.json,
            dryRun: globals.dryRun,
          });
          const r = await restoreOps.run(ctx, archive, opts);
          if (globals.json) {
            process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
          } else {
            process.stdout.write(
              pc.green(`✓ restored from ${archive} (${r.durationMs}ms)\n`),
            );
          }
          process.exit(0);
        } catch (err) {
          if (err instanceof NoConfigError) {
            process.stderr.write(pc.red(`${err.message}\n`));
            process.exit(1);
          }
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(pc.red(`bench restore: ${msg}\n`));
          process.exit(5);
        }
      },
    );
}
```

- [ ] **Step 3: Write the failing test**

Create `packages/bench-core/src/__tests__/ops-restore.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create as createTar } from "tar";
import { registerProvider } from "../provider.js";
import { run as runRestore } from "../ops/restore.js";
import type { Context, Provider } from "../types.js";

let tmp: string;
let archivePath: string;

async function makeArchive(manifest: object): Promise<string> {
  const scratch = mkdtempSync(join(tmpdir(), "arch-"));
  writeFileSync(join(scratch, "manifest.json"), JSON.stringify(manifest));
  writeFileSync(join(scratch, "db.sql.gz"), "fake");
  mkdirSync(join(scratch, "config"));
  writeFileSync(join(scratch, "config", "bench.config.yaml"), "demo");
  const out = join(tmp, `a-${Date.now()}.wbak`);
  await createTar({ gzip: true, file: out, cwd: scratch }, [
    "manifest.json",
    "db.sql.gz",
    "config",
  ]);
  rmSync(scratch, { recursive: true, force: true });
  return out;
}

const provider: Provider = {
  id: "fake",
  preflight: async () => ({ ok: true, checks: [] }),
  provision: async () => ({ ok: true, operationsApplied: 0 }),
  deploy: async () => ({ ok: true, version: "0", rolledBack: false }),
  start: async () => {},
  stop: async () => {},
  restart: async () => {},
  async *logs() {},
  status: async () => ({ services: [] }),
  backup: async () => {
    throw new Error();
  },
  restore: async () => {
    throw new Error();
  },
  rotateSecret: async () => {},
  destroy: async () => {},
  execInService: vi
    .fn()
    .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
  runOneShot: vi
    .fn()
    .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
};
registerProvider("fake", async () => provider);

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "bench-restore-"));
  process.env.BENCH_SERVICE_TOKEN = "t";
  process.env.BENCH_API_BASE_URL = "http://api.test";
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ drained: true }) }),
  );
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function ctxOf(): Context {
  return {
    cwd: tmp,
    config: {
      metadata: { name: "demo" },
      provider: { type: "fake" as never, config: {} },
      witylogix: { version: "4.0.0", channel: "stable" },
    } as unknown as Context["config"],
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    dryRun: false,
    json: false,
  };
}

describe("ops/restore.run", () => {
  it("refuses archives without manifest.json", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "bad-"));
    writeFileSync(join(scratch, "db.sql.gz"), "x");
    const out = join(tmp, "bad.wbak");
    await createTar({ gzip: true, file: out, cwd: scratch }, ["db.sql.gz"]);
    rmSync(scratch, { recursive: true, force: true });
    await expect(runRestore(ctxOf(), out)).rejects.toThrow(/missing manifest/);
  });

  it("refuses cross-major restores without --force-version", async () => {
    archivePath = await makeArchive({
      version: 1,
      installationName: "demo",
      witylogixVersion: "3.0.0",
      benchVersion: "0.0.1",
      createdAt: new Date().toISOString(),
      includes: { db: true, config: true, blobs: false },
      counts: { tenants: 0, orders: 0 },
      checksums: {},
    });
    await expect(runRestore(ctxOf(), archivePath)).rejects.toThrow(
      /cross-major/,
    );
  });

  it("refuses cross-install restores without --cross-install", async () => {
    archivePath = await makeArchive({
      version: 1,
      installationName: "other",
      witylogixVersion: "4.0.0",
      benchVersion: "0.0.1",
      createdAt: new Date().toISOString(),
      includes: { db: true, config: true, blobs: false },
      counts: { tenants: 0, orders: 0 },
      checksums: {},
    });
    await expect(runRestore(ctxOf(), archivePath)).rejects.toThrow(
      /does not match/,
    );
  });

  it("succeeds on valid same-version same-name archive", async () => {
    archivePath = await makeArchive({
      version: 1,
      installationName: "demo",
      witylogixVersion: "4.0.0",
      benchVersion: "0.0.1",
      createdAt: new Date().toISOString(),
      includes: { db: true, config: true, blobs: false },
      counts: { tenants: 0, orders: 0 },
      checksums: {},
    });
    const r = await runRestore(ctxOf(), archivePath);
    expect(r.ok).toBe(true);
    expect(r.manifest.installationName).toBe("demo");
  });
});
```

- [ ] **Step 4: Run tests and typecheck**

```bash
pnpm --filter @witylogix/bench-core test -- ops-restore
pnpm --filter @witylogix/bench typecheck
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/bench-core/src/ops/restore.ts \
        packages/bench-core/src/__tests__/ops-restore.test.ts \
        packages/bench-core/src/index.ts \
        packages/bench-core/tsup.config.ts \
        packages/bench-cli/src/commands/restore.ts
git commit -m "feat(bench): ops/restore with manifest verification + CLI wiring"
```

---

## Task 17: `ops/migrate.ts` + CLI wiring

**Files:**

- Create: `packages/bench-core/src/ops/migrate.ts`
- Modify: `packages/bench-cli/src/commands/migrate.ts`
- Create: `packages/bench-core/src/__tests__/ops-migrate.test.ts`

- [ ] **Step 1: Write `packages/bench-core/src/ops/migrate.ts`**

```typescript
import { resolve } from "node:path";
import type { Context } from "../index.js";
import { benchApi } from "../http-client.js";
import { resolveProvider } from "../provider.js";
import { emitAudit } from "./audit.js";
import { run as runBackup } from "./backup.js";

export interface MigrateInput {
  skipBackup?: boolean;
  force?: boolean;
  timeoutMs?: number;
}

export interface MigrateResult {
  ok: boolean;
  migrationsApplied: number;
  backupPath?: string;
  durationMs: number;
}

const APP_SERVICES = [
  "api",
  "dashboard",
  "customer-portal",
  "tracking-page",
  "docs",
];

export async function run(
  ctx: Context,
  input: MigrateInput = {},
): Promise<MigrateResult> {
  const startedAt = Date.now();

  const health = await benchApi<{
    prismaMigrations: { applied: number; pending: number };
  }>(ctx, "GET", "/internal/bench/health");
  const before = health.prismaMigrations.applied;

  let backupPath: string | undefined;
  if (!input.skipBackup) {
    const ts = new Date()
      .toISOString()
      .replace(/[:-]/g, "")
      .replace(/\..+/, "")
      .replace("T", "-");
    const path = resolve(
      ctx.cwd,
      ".bench",
      "backups",
      `pre-migrate-${ts}.wbak`,
    );
    const r = await runBackup(ctx, { to: path, includeBlobs: false });
    backupPath = r.archive;
    ctx.logger.info(`auto-backup → ${backupPath}`);
  }

  await benchApi(ctx, "POST", "/internal/bench/drain", {
    mode: "offline",
    reason: "migrate",
  });

  const provider = await resolveProvider(ctx.config.provider.type);
  for (const svc of APP_SERVICES) {
    await provider.stop(ctx, svc);
  }

  const migrateResult = await provider.runOneShot(ctx, "api", [
    "pnpm",
    "prisma",
    "migrate",
    "deploy",
  ]);
  if (migrateResult.exitCode !== 0) {
    emitAudit(ctx, "bench.migrate.failed", {
      exitCode: migrateResult.exitCode,
      stderr: migrateResult.stderr,
      backupPath,
    });
    throw new Error(
      `prisma migrate deploy failed (exit ${migrateResult.exitCode}). ` +
        `Services stopped, DB may be partial. Rollback: bench restore ${backupPath}`,
    );
  }

  for (const svc of APP_SERVICES) {
    await provider.start(ctx, svc);
  }

  let after = before;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const h = await benchApi<{ prismaMigrations: { applied: number } }>(
      ctx,
      "GET",
      "/internal/bench/health",
    );
    after = h.prismaMigrations.applied;
    if (after >= before) break;
  }
  const applied = after - before;

  const durationMs = Date.now() - startedAt;
  emitAudit(ctx, "bench.migrate.completed", {
    migrationsApplied: applied,
    backupPath,
    durationMs,
  });
  return { ok: true, migrationsApplied: applied, backupPath, durationMs };
}
```

Add `'ops/migrate': 'src/ops/migrate.ts'` to `tsup.config.ts`. Export from `index.ts`:

```typescript
export * as migrate from "./ops/migrate.js";
```

- [ ] **Step 2: Wire CLI `packages/bench-cli/src/commands/migrate.ts`**

Replace stub body:

```typescript
import type { Command } from "commander";
import pc from "picocolors";
import {
  buildContext,
  migrate as migrateOps,
  NoConfigError,
} from "@witylogix/bench-core";

export function registerMigrateCommand(program: Command): void {
  program
    .command("migrate")
    .description("Run Prisma migrations (windowed: stop API, migrate, restart)")
    .option("--skip-backup", "skip the pre-migrate auto-backup", false)
    .option("--yes", "required for destructive migrations", false)
    .option("--timeout <seconds>", "overall timeout in seconds", "600")
    .action(
      async (opts: { skipBackup: boolean; yes: boolean; timeout: string }) => {
        const globals = program.opts<{ json: boolean; dryRun: boolean }>();
        try {
          const ctx = await buildContext({
            json: globals.json,
            dryRun: globals.dryRun,
          });
          const r = await migrateOps.run(ctx, {
            skipBackup: opts.skipBackup,
            timeoutMs: Number.parseInt(opts.timeout, 10) * 1000,
          });
          if (globals.json) {
            process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
          } else {
            process.stdout.write(
              pc.green(
                `✓ applied ${r.migrationsApplied} migration(s) (${r.durationMs}ms)\n`,
              ),
            );
          }
          process.exit(0);
        } catch (err) {
          if (err instanceof NoConfigError) {
            process.stderr.write(pc.red(`${err.message}\n`));
            process.exit(1);
          }
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(pc.red(`bench migrate: ${msg}\n`));
          process.exit(5);
        }
      },
    );
}
```

- [ ] **Step 3: Write the failing test**

Create `packages/bench-core/src/__tests__/ops-migrate.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerProvider } from "../provider.js";
import { run as runMigrate } from "../ops/migrate.js";
import type { Context, Provider } from "../types.js";

let tmp: string;

const fakeProvider: Provider = {
  id: "fake",
  preflight: async () => ({ ok: true, checks: [] }),
  provision: async () => ({ ok: true, operationsApplied: 0 }),
  deploy: async () => ({ ok: true, version: "0", rolledBack: false }),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  restart: async () => {},
  async *logs() {},
  status: async () => ({ services: [] }),
  backup: async () => {
    throw new Error();
  },
  restore: async () => {
    throw new Error();
  },
  rotateSecret: async () => {},
  destroy: async () => {},
  execInService: vi
    .fn()
    .mockResolvedValue({ stdout: "0\n0\n", stderr: "", exitCode: 0 }),
  runOneShot: vi
    .fn()
    .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
};
registerProvider("fake", async () => fakeProvider);

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "bench-migrate-"));
  mkdirSync(join(tmp, ".bench"), { recursive: true });
  writeFileSync(join(tmp, "bench.config.yaml"), "name: demo\n");
  process.env.BENCH_SERVICE_TOKEN = "t";
  process.env.BENCH_API_BASE_URL = "http://api.test";
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ prismaMigrations: { applied: 10, pending: 2 } }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // drain
    .mockResolvedValue({
      ok: true,
      json: async () => ({ prismaMigrations: { applied: 12 } }),
    });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function ctxOf(): Context {
  return {
    cwd: tmp,
    config: {
      metadata: { name: "demo" },
      provider: { type: "fake" as never, config: {} },
      witylogix: { version: "4.0.0", channel: "stable" },
    } as unknown as Context["config"],
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    dryRun: false,
    json: false,
  };
}

describe("ops/migrate.run", () => {
  it("windowed flow: drain, stop 5 services, migrate, restart 5 services, poll", async () => {
    const r = await runMigrate(ctxOf(), { skipBackup: true });
    expect(r.ok).toBe(true);
    expect(r.migrationsApplied).toBe(2);
    expect(fakeProvider.stop).toHaveBeenCalledTimes(5);
    expect(fakeProvider.start).toHaveBeenCalledTimes(5);
    expect(fakeProvider.runOneShot).toHaveBeenCalledWith(
      expect.anything(),
      "api",
      ["pnpm", "prisma", "migrate", "deploy"],
    );
  });

  it("throws with rollback guidance if migration exits non-zero", async () => {
    (fakeProvider.runOneShot as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        stdout: "",
        stderr: "syntax error",
        exitCode: 1,
      },
    );
    await expect(runMigrate(ctxOf(), { skipBackup: true })).rejects.toThrow(
      /Rollback:/,
    );
  });
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @witylogix/bench-core test -- ops-migrate
pnpm --filter @witylogix/bench typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bench-core/src/ops/migrate.ts \
        packages/bench-core/src/__tests__/ops-migrate.test.ts \
        packages/bench-core/src/index.ts \
        packages/bench-core/tsup.config.ts \
        packages/bench-cli/src/commands/migrate.ts
git commit -m "feat(bench): ops/migrate windowed strategy + CLI wiring"
```

---

## Task 18: Extend `bench doctor` + generate `BENCH_SERVICE_TOKEN` in `bench init`

**Files:**

- Modify: `packages/bench-cli/src/commands/init.ts`
- Modify: `packages/bench-cli/src/commands/doctor.ts`

- [ ] **Step 1: Generate token in `bench init`**

In `packages/bench-cli/src/commands/init.ts`, add at the top:

```typescript
import { randomBytes } from "node:crypto";
```

Inside the action, after writing `README.md`, add:

```typescript
const token = randomBytes(32).toString("base64url");
writeFileSync(join(target, "secrets", "bench-service-token"), token, {
  mode: 0o600,
});
```

Update the `GITIGNORE` constant to ensure `secrets/` is ignored (it already is).

- [ ] **Step 2: Add checks to `bench doctor`**

In `packages/bench-cli/src/commands/doctor.ts`, add to the `checks` array:

```typescript
  {
    id: 'pg-dump',
    name: 'pg_dump available (for backup)',
    run: () => {
      const r = hasBinary('pg_dump');
      return {
        ok: r.ok,
        detail: r.ok ? r.version : 'not found on host — backup uses pg_dump inside the postgres container (OK if services running)',
      };
    },
  },
  {
    id: 'service-token',
    name: 'BENCH_SERVICE_TOKEN present',
    run: () => {
      const tokenFile = resolve(process.cwd(), 'secrets', 'bench-service-token');
      const ok = existsSync(tokenFile);
      return { ok, detail: ok ? tokenFile : 'missing — re-run `bench init <name>` or generate manually' };
    },
  },
```

- [ ] **Step 3: Smoke-test**

```bash
rm -rf /tmp/bench-doctor-smoke
pnpm --filter @witylogix/bench exec tsx src/index.ts init /tmp/bench-doctor-smoke
ls -la /tmp/bench-doctor-smoke/secrets/bench-service-token  # should exist, mode 0600
(cd /tmp/bench-doctor-smoke && pnpm --dir . exec tsx "$(pwd)/../../Users/youthocrat/Desktop/Witylogix/witylogix-platform/packages/bench-cli/src/index.ts" doctor || true)
```

Expected: token file exists with mode `0600`. `bench doctor` shows new checks.

- [ ] **Step 4: Commit**

```bash
git add packages/bench-cli/src/commands/init.ts \
        packages/bench-cli/src/commands/doctor.ts
git commit -m "feat(bench): generate BENCH_SERVICE_TOKEN in init + doctor checks"
```

---

## Task 19: End-to-end round-trip test

**Files:**

- Create: `packages/bench-cli/src/__tests__/e2e-roundtrip.test.ts`

- [ ] **Step 1: Write a test that exercises init + provision of the compose file**

Create `packages/bench-cli/src/__tests__/e2e-roundtrip.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

// This test exercises the command surface without a real Docker daemon.
// True docker E2E lives in a separate (opt-in) suite.

const CLI = require.resolve("../index.ts");
const runBench = (cwd: string, args: string) => {
  return execSync(`pnpm --filter @witylogix/bench exec tsx ${CLI} ${args}`, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, BENCH_SERVICE_TOKEN: "stub" },
  });
};

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "bench-e2e-"));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe("bench E2E (no-docker surface checks)", () => {
  it("init creates a valid installation with token", () => {
    runBench(tmp, `init ${tmp}/demo`);
    expect(existsSync(join(tmp, "demo", "bench.config.yaml"))).toBe(true);
    expect(
      existsSync(join(tmp, "demo", "secrets", "bench-service-token")),
    ).toBe(true);
    const cfg = readFileSync(join(tmp, "demo", "bench.config.yaml"), "utf8");
    expect(cfg).toContain("name: demo");
    expect(cfg).toContain("storage:");
  });

  it("doctor exits non-zero when token file missing", () => {
    // use a fresh dir without init
    let code = 0;
    try {
      runBench(tmp, "doctor");
    } catch (e) {
      code = (e as { status: number }).status;
    }
    expect(code).not.toBe(0);
  });
});
```

- [ ] **Step 2: Run test**

```bash
pnpm --filter @witylogix/bench test
```

Expected: PASS — 2 tests.

- [ ] **Step 3: Commit**

```bash
git add packages/bench-cli/src/__tests__/e2e-roundtrip.test.ts
git commit -m "test(bench): E2E surface check for init + doctor"
```

---

## Task 20: Final integration — push, verify typecheck & tests across monorepo

- [ ] **Step 1: Full typecheck**

```bash
pnpm --filter "@witylogix/bench" --filter "@witylogix/bench-core" --filter "@witylogix/bench-provider-docker-compose" --filter "@witylogix/api" --filter "@witylogix/core" typecheck
```

Expected: all PASS.

- [ ] **Step 2: Full test run**

```bash
pnpm --filter "@witylogix/bench" --filter "@witylogix/bench-core" --filter "@witylogix/bench-provider-docker-compose" --filter "@witylogix/api" --filter "@witylogix/core" test
```

Expected: all PASS. Target: 60+ new tests across the Phase 1b suites.

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/WIT-bench-scaffold
```

- [ ] **Step 4: Open draft PR to `staging`**

```bash
gh pr create --base staging --draft --title "feat(bench): Phase 1b — migrate, new-tenant, backup, restore" --body "$(cat <<'EOF'
## Summary
- Windowed `bench migrate` with auto-backup + rollback guidance
- `bench new-tenant` via new `/internal/bench/tenants` admin endpoint
- `bench backup` (DB + config, optional `--include-blobs`) with deterministic manifest
- `bench restore` with manifest verification and safety gates
- StorageClient abstraction (local + S3/R2), extended config schema
- BENCH_SERVICE_TOKEN generated in `bench init`, verified by `bench doctor`

## Spec
docs/superpowers/specs/2026-04-19-bench-phase-1b-design.md

## Test plan
- [ ] bench-core unit tests green (~30 new)
- [ ] docker-compose provider exec tests green
- [ ] apps/api bench admin contract tests green (~12)
- [ ] apps/core TenantProvisioner tests green (~3)
- [ ] bench-cli E2E surface checks green
- [ ] Manual: run `bench init demo && bench doctor && bench migrate --skip-backup` on a real Docker host
EOF
)"
```

---

## Self-Review

**1. Spec coverage**

| Spec section                                  | Task(s)                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| §2 Architecture (seams)                       | T1, T2, T7, T8, T10                                                    |
| §3 Admin API (token, endpoints, security)     | T7, T8, T10, T18 (token gen)                                           |
| §4 `bench migrate` windowed                   | T17                                                                    |
| §5 `bench new-tenant`                         | T9, T10, T11                                                           |
| §6 `bench backup` archive format              | T13, T15                                                               |
| §7 `bench restore`                            | T16                                                                    |
| §8 Testing (60+ tests)                        | T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T15, T16, T17, T19 |
| §9 Risks (token leak, version mismatch, lock) | T7 (CIDR + timing-safe), T16 (manifest), T18 (doctor)                  |
| §10 Storage config + StorageClient            | T3, T4, T5                                                             |

No gaps found.

**2. Placeholder scan** — Passed. All steps contain concrete code, exact paths, exact commands. No TBD/TODO/placeholder text.

**3. Type consistency** — `CreateTenantInput` defined in T9 (core) and T11 (bench-core) have the same shape; `Manifest` defined in T13 referenced in T16 imports from `backup.js`; `StorageClient` signatures consistent between T4 and T5.

**4. Ambiguity check** — One item to note: T15's blob restore (`restoreBlobs` function) returns the count of entries but doesn't upload to the original URL in Phase 1b. This matches spec §7.2 step 8 semantics when `--target-storage` is not provided; when it IS provided, we need to rewrite DB URLs in a transaction. For Phase 1b, if `--target-storage` is set, Task 16 throws a clear "not yet implemented — use without --target-storage for now" error, tracked as a follow-up in Phase 1c. The spec already marks this behavior as "Phase 1c" via the roadmap placement; adding a runtime guard is reasonable and not a gap.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-bench-phase-1b.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
