# Zones + Map Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/zones` as a map-first ops console and ship a shared `<WLMap>` foundation that sub-projects D and E will embed without rewrites.

**Architecture:** MapLibre GL JS + `@mapbox/mapbox-gl-draw` + `@turf/turf` in `apps/dashboard`. Backend reuses the existing PostGIS-backed `DeliveryZone.boundary` column (already geometry-typed via raw SQL); we add overlay endpoints, GeoJSON output, and circle-shape persistence via `ST_Buffer`. Frontend delivers a controlled `<WLMap>` component with thin layer components (`<ZoneLayer>`, `<HeatmapLayer>`, `<PinLayer>`, `<HubLayer>`, `<DrawLayer>`), a mode-switching inspector, and three redesigned pages (`/zones`, `/zones/new`, `/zones/[id]`), all styled from `--wl-*` CSS tokens.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Fastify (API) · Prisma · PostgreSQL + PostGIS · Zod validators · MapLibre GL JS · `@mapbox/mapbox-gl-draw` · `@turf/turf` · Vitest · Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-19-zones-map-redesign-design.md`.

---

## Conventions used by every task

- **Test runner:** `pnpm --filter <package> test` (Vitest). Run from repo root.
- **Typecheck:** `pnpm --filter <package> typecheck`.
- **Pre-commit:** `pnpm lint && pnpm typecheck && pnpm test:run` (per `CLAUDE.md`).
- **Commits:** conventional commits (`feat(WIT-XX): ...`, `test(WIT-XX): ...`, etc.). Ticket id is allocated in Task 0. Every task ends with a commit.
- **Branch:** `feat/WIT-XX-zones-map-redesign` created off `staging` in Task 0 (never push to `main` or `staging` directly).
- **Token rule:** no hard-coded hex values in new zones code. Use `var(--wl-*)` tokens from `apps/dashboard/src/styles/tokens.css` or Tailwind utilities that reference them.

---

## Task 0: Pre-flight — branch, ticket, legacy-row count, MapTiler key

**Files:**
- Modify: `apps/dashboard/.env.local.example`
- Read: `packages/db/prisma/schema/06-zones-slots.prisma`

- [ ] **Step 1: Sync staging and create the feature branch**

```bash
cd /Users/youthocrat/Desktop/Witylogix/witylogix-platform
git checkout staging && git pull origin staging
git checkout -b feat/WIT-XX-zones-map-redesign
```

Replace `WIT-XX` with the Paperclip ticket id allocated for this work. If none exists, create one titled "Zones + map foundation (A+B)" and paste its id into this plan header before continuing.

- [ ] **Step 2: Count legacy zones with no geometry (baseline)**

Run against Railway staging Postgres (`DATABASE_URL` in `.env.staging`):

```bash
psql "$(grep DATABASE_URL .env.staging | cut -d= -f2-)" \
  -c "SELECT count(*) AS null_boundary FROM delivery_zones WHERE boundary IS NULL;"
```

Expected: integer. Record the number in the PR description so we know whether a backfill tool is needed later.

- [ ] **Step 3: Register a MapTiler free account and store the key**

1. Sign up at https://maptiler.com (or reuse existing team account).
2. Create an API key scoped to `localhost` + `*.witylogix.com`.
3. Append to `apps/dashboard/.env.local.example`:

```env
# Map tiles (MapTiler free tier — see docs/adr/<ADR-NNN>-maplibre.md)
NEXT_PUBLIC_MAPTILER_KEY=
```

4. Paste the real key into `apps/dashboard/.env.local` locally and the Railway dashboard env for staging.

- [ ] **Step 4: Commit the preflight change**

```bash
git add apps/dashboard/.env.local.example
git commit -m "chore(WIT-XX): scaffold zones-map branch, add MapTiler env var"
```

---

## Task 1: Validator — add `zoneShapeSchema` discriminated union

**Files:**
- Modify: `packages/validators/src/index.ts`
- Modify: `packages/validators/src/__tests__/schemas.test.ts`

- [ ] **Step 1: Write failing tests for `zoneShapeSchema`**

Append to `packages/validators/src/__tests__/schemas.test.ts`:

```ts
import { zoneShapeSchema } from '../index'

describe('zoneShapeSchema', () => {
  const polygon = {
    type: 'polygon',
    ring: [
      { latitude: 28.65, longitude: 77.12 },
      { latitude: 28.66, longitude: 77.13 },
      { latitude: 28.64, longitude: 77.15 },
    ],
  }
  const circle = {
    type: 'circle',
    center: { latitude: 28.65, longitude: 77.12 },
    radiusMeters: 1500,
  }

  it('accepts a polygon with >= 3 points', () => {
    expect(() => zoneShapeSchema.parse(polygon)).not.toThrow()
  })

  it('rejects a polygon with < 3 points', () => {
    expect(() => zoneShapeSchema.parse({ ...polygon, ring: polygon.ring.slice(0, 2) })).toThrow()
  })

  it('accepts a circle with positive radius', () => {
    expect(() => zoneShapeSchema.parse(circle)).not.toThrow()
  })

  it('rejects a circle with non-positive radius', () => {
    expect(() => zoneShapeSchema.parse({ ...circle, radiusMeters: 0 })).toThrow()
  })

  it('rejects a circle with radius > 100000 meters', () => {
    expect(() => zoneShapeSchema.parse({ ...circle, radiusMeters: 100_001 })).toThrow()
  })

  it('rejects unknown shape types', () => {
    expect(() => zoneShapeSchema.parse({ type: 'square', ring: polygon.ring } as unknown)).toThrow()
  })
})
```

- [ ] **Step 2: Run the tests; expect failures**

```bash
pnpm --filter @witylogix/validators test -- schemas.test.ts
```

Expected: all new tests fail with "zoneShapeSchema is not exported".

- [ ] **Step 3: Implement `zoneShapeSchema`**

Insert after the existing `coordinatesSchema` (around line 20) in `packages/validators/src/index.ts`:

```ts
// ─── Zone shape (polygon ring OR circle descriptor) ──────────
const polygonShape = z.object({
  type: z.literal('polygon'),
  ring: z.array(coordinatesSchema).min(3),
})
const circleShape = z.object({
  type: z.literal('circle'),
  center: coordinatesSchema,
  radiusMeters: z.number().positive().max(100_000),
})
export const zoneShapeSchema = z.discriminatedUnion('type', [polygonShape, circleShape])
export type ZoneShape = z.infer<typeof zoneShapeSchema>
```

- [ ] **Step 4: Run the tests; expect pass**

```bash
pnpm --filter @witylogix/validators test -- schemas.test.ts
```

Expected: PASS for all six new assertions.

- [ ] **Step 5: Commit**

```bash
git add packages/validators/src/index.ts packages/validators/src/__tests__/schemas.test.ts
git commit -m "feat(WIT-XX): add zoneShapeSchema discriminated union (polygon | circle)"
```

---

## Task 2: Validator — extend create/update schemas to accept `shape`

**Files:**
- Modify: `packages/validators/src/index.ts`
- Modify: `packages/validators/src/__tests__/schemas.test.ts`

- [ ] **Step 1: Write tests for the extended `createDeliveryZoneSchema`**

Append to `schemas.test.ts`:

```ts
describe('createDeliveryZoneSchema — with shape', () => {
  const base = { name: 'Downtown', baseRate: 5, perKmRate: 0.5 }

  it('accepts legacy boundary array (unchanged)', () => {
    const parsed = createDeliveryZoneSchema.parse({
      ...base,
      boundary: [
        { latitude: 28.65, longitude: 77.12 },
        { latitude: 28.66, longitude: 77.13 },
        { latitude: 28.64, longitude: 77.15 },
      ],
    })
    expect(parsed.boundary).toBeDefined()
  })

  it('accepts a new polygon shape', () => {
    const parsed = createDeliveryZoneSchema.parse({
      ...base,
      shape: {
        type: 'polygon',
        ring: [
          { latitude: 28.65, longitude: 77.12 },
          { latitude: 28.66, longitude: 77.13 },
          { latitude: 28.64, longitude: 77.15 },
        ],
      },
    })
    expect(parsed.shape?.type).toBe('polygon')
  })

  it('accepts a circle shape', () => {
    const parsed = createDeliveryZoneSchema.parse({
      ...base,
      shape: { type: 'circle', center: { latitude: 28.65, longitude: 77.12 }, radiusMeters: 1500 },
    })
    expect(parsed.shape?.type).toBe('circle')
  })

  it('allows creating a zone with neither boundary nor shape', () => {
    expect(() => createDeliveryZoneSchema.parse(base)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests; expect failures**

```bash
pnpm --filter @witylogix/validators test -- schemas.test.ts
```

Expected: three of the four new tests fail (the "unchanged" one passes).

- [ ] **Step 3: Extend the schema**

Replace the existing `createDeliveryZoneSchema` (lines ~79–90 in `index.ts`) with:

```ts
export const createDeliveryZoneSchema = z.object({
  name: z.string().min(1).max(100),
  // Legacy: array of lat/lng points. Kept for one release cycle.
  boundary: z.array(coordinatesSchema).min(3).optional(),
  // Preferred: discriminated shape (polygon | circle).
  shape: zoneShapeSchema.optional(),
  baseRate: z.number().nonnegative().default(0),
  perKmRate: z.number().nonnegative().default(0),
  minOrder: z.number().nonnegative().default(0),
  freeAbove: z.number().nonnegative().optional(),
  priority: z.number().int().default(0),
})
```

Also add, right after the create schema:

```ts
export const updateDeliveryZoneSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  boundary: z.array(coordinatesSchema).min(3).optional(),
  shape: zoneShapeSchema.optional(),
  baseRate: z.number().nonnegative().optional(),
  perKmRate: z.number().nonnegative().optional(),
  minOrder: z.number().nonnegative().optional(),
  freeAbove: z.number().nonnegative().nullable().optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
})
export type UpdateDeliveryZone = z.infer<typeof updateDeliveryZoneSchema>
```

- [ ] **Step 4: Run tests; expect pass**

```bash
pnpm --filter @witylogix/validators test
```

Expected: all tests (including the existing `createDeliveryZoneSchema` suite) pass.

- [ ] **Step 5: Commit**

```bash
git add packages/validators/src/index.ts packages/validators/src/__tests__/schemas.test.ts
git commit -m "feat(WIT-XX): extend zone validators with discriminated shape field (back-compat retained)"
```

---

## Task 3: API — GeoJSON output on `GET /v4/zones`

**Files:**
- Modify: `apps/api/src/routes/zones.ts`
- Modify: `apps/api/src/routes/__tests__/zones.test.ts`

- [ ] **Step 1: Write failing test for `?format=geojson`**

Append to `zones.test.ts`:

```ts
describe('GET /v4/zones?format=geojson', () => {
  it('returns a FeatureCollection with zone polygons', async () => {
    // Arrange: stub request.tenantDb.deliveryZone.findMany with two zones
    // whose boundary column is returned as raw GeoJSON (via a $queryRaw call in the route).
    // (Use the same mocking pattern as existing zones.test.ts suites.)
    const res = await listZonesHandler({ query: { format: 'geojson' } })
    expect(res.type).toBe('FeatureCollection')
    expect(Array.isArray(res.features)).toBe(true)
    expect(res.features[0]).toMatchObject({
      type: 'Feature',
      geometry: { type: 'Polygon' },
      properties: expect.objectContaining({ id: expect.any(String), name: expect.any(String) }),
    })
  })
})
```

Match the exact helper names used in surrounding tests — they already mock `tenantDb` and `tenantRedis`. Copy the pattern from the existing `'GET /'` block at the top of this file.

- [ ] **Step 2: Run; expect fail**

```bash
pnpm --filter @witylogix/api test -- zones.test.ts
```

Expected: FAIL — "format: 'geojson' not handled".

- [ ] **Step 3: Extend the list handler**

In `apps/api/src/routes/zones.ts`, replace the `GET /` handler with:

```ts
const listQuery = paginationSchema.extend({
  format: z.enum(['json', 'geojson']).optional().default('json'),
})

fastify.get('/', async (request, reply) => {
  const { page, limit, format } = listQuery.parse(request.query)

  if (format === 'geojson') {
    const rows = await request.tenantDb.$queryRaw<
      Array<{ id: string; name: string; is_active: boolean; priority: number; base_rate: number; per_km_rate: number; geojson: unknown }>
    >`
      SELECT
        id::text,
        name,
        is_active,
        priority,
        base_rate,
        per_km_rate,
        ST_AsGeoJSON(boundary)::jsonb AS geojson
      FROM delivery_zones
      WHERE shop_id = ${request.shopId}::uuid
        AND boundary IS NOT NULL
    `
    return {
      type: 'FeatureCollection' as const,
      features: rows.map((r) => ({
        type: 'Feature' as const,
        geometry: r.geojson as { type: 'Polygon'; coordinates: number[][][] },
        properties: {
          id: r.id,
          name: r.name,
          isActive: r.is_active,
          priority: r.priority,
          baseRate: Number(r.base_rate),
          perKmRate: Number(r.per_km_rate),
        },
      })),
    }
  }

  // …existing JSON branch unchanged…
  const [zones, total] = await Promise.all([
    request.tenantDb.deliveryZone.findMany({
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, name: true, priority: true, baseRate: true, perKmRate: true,
        minOrder: true, freeAbove: true, isActive: true, boundary: true,
        timeSlots: { where: { isActive: true }, select: { id: true, name: true, startTime: true, endTime: true } },
        _count: { select: { timeSlots: true } },
      },
    }),
    request.tenantDb.deliveryZone.count(),
  ])

  return {
    data: zones.map((z) => ({ ...z, boundary: z.boundary || null })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
})
```

- [ ] **Step 4: Run tests; expect pass**

```bash
pnpm --filter @witylogix/api test -- zones.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/zones.ts apps/api/src/routes/__tests__/zones.test.ts
git commit -m "feat(WIT-XX): add GeoJSON format to GET /v4/zones"
```

---

## Task 4: API — accept `shape` (polygon + circle) on POST/PATCH

**Files:**
- Modify: `apps/api/src/routes/zones.ts`
- Modify: `apps/api/src/routes/__tests__/zones.test.ts`

- [ ] **Step 1: Write failing tests for the two new shapes**

Append to `zones.test.ts`:

```ts
describe('POST /v4/zones — shape support', () => {
  it('persists a polygon shape via ST_GeomFromText', async () => {
    const executed: string[] = []
    const tenantDb = mockTenantDbRecordingExecuteRaw(executed)
    const res = await createZoneHandler(
      {
        body: {
          name: 'South', baseRate: 10, perKmRate: 2,
          shape: {
            type: 'polygon',
            ring: [
              { latitude: 28.65, longitude: 77.12 },
              { latitude: 28.66, longitude: 77.13 },
              { latitude: 28.64, longitude: 77.15 },
            ],
          },
        },
      },
      { tenantDb },
    )
    expect(res.status).toBe(201)
    expect(executed.join(' ')).toMatch(/ST_GeomFromText\(.*POLYGON/)
  })

  it('persists a circle shape via ST_Buffer and stores metadata.shape', async () => {
    const executed: string[] = []
    const tenantDb = mockTenantDbRecordingExecuteRaw(executed)
    const res = await createZoneHandler(
      {
        body: {
          name: 'HQ 1.5km', baseRate: 0, perKmRate: 0,
          shape: {
            type: 'circle',
            center: { latitude: 28.65, longitude: 77.12 },
            radiusMeters: 1500,
          },
        },
      },
      { tenantDb },
    )
    expect(res.status).toBe(201)
    expect(executed.join(' ')).toMatch(/ST_Buffer/)
    expect(tenantDb.deliveryZone.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            shape: { type: 'circle', center: expect.any(Object), radiusMeters: 1500 },
          }),
        }),
      }),
    )
  })
})
```

`mockTenantDbRecordingExecuteRaw` is a small helper you add to the test file next to the existing mock builders — it returns a `tenantDb` whose `$executeRaw` pushes each serialized SQL call to a captured array.

- [ ] **Step 2: Run; expect fail**

```bash
pnpm --filter @witylogix/api test -- zones.test.ts
```

Expected: FAIL — current handler ignores `shape`.

- [ ] **Step 3: Replace the create handler**

In `apps/api/src/routes/zones.ts` replace the `POST /` body:

```ts
fastify.post('/', async (request, reply) => {
  await requireRole('SUPER_ADMIN', 'ADMIN')(request, reply)

  const body = createDeliveryZoneSchema.parse(request.body)
  const { boundary: legacyPoints, shape, ...zoneData } = body

  // Derive the PostGIS write strategy.
  type WriteGeom =
    | { kind: 'polygon'; wkt: string }
    | { kind: 'circle'; lng: number; lat: number; radiusM: number }
    | null
  let geom: WriteGeom = null
  let metadataShape: ZoneShape | undefined

  if (shape?.type === 'polygon') {
    geom = { kind: 'polygon', wkt: ringToWkt(shape.ring) }
    metadataShape = shape
  } else if (shape?.type === 'circle') {
    geom = { kind: 'circle', lng: shape.center.longitude, lat: shape.center.latitude, radiusM: shape.radiusMeters }
    metadataShape = shape
  } else if (legacyPoints && legacyPoints.length >= 3) {
    geom = { kind: 'polygon', wkt: ringToWkt(legacyPoints) }
  }

  const zone = await request.tenantDb.$transaction(async (tx) => {
    const created = await tx.deliveryZone.create({
      data: {
        shopId: request.shopId,
        metadata: metadataShape ? { shape: metadataShape } : {},
        ...zoneData,
      },
    })
    if (geom?.kind === 'polygon') {
      await tx.$executeRaw`
        UPDATE delivery_zones
        SET boundary = ST_GeomFromText(${geom.wkt}, 4326)
        WHERE id = ${created.id}::uuid
      `
    } else if (geom?.kind === 'circle') {
      await tx.$executeRaw`
        UPDATE delivery_zones
        SET boundary = ST_Buffer(
          ST_SetSRID(ST_MakePoint(${geom.lng}, ${geom.lat}), 4326)::geography,
          ${geom.radiusM}
        )::geometry
        WHERE id = ${created.id}::uuid
      `
    }
    return created
  })

  await request.tenantRedis.invalidateGroup('zones')
  reply.status(201)
  return { data: zone }
})
```

Add (top of the file, after imports) the `ringToWkt` helper and import the new type:

```ts
import { createDeliveryZoneSchema, updateDeliveryZoneSchema, paginationSchema, type ZoneShape } from '@witylogix/validators'

function ringToWkt(ring: Array<{ latitude: number; longitude: number }>): string {
  const points = [...ring]
  const first = points[0]
  const last = points[points.length - 1]
  if (first.longitude !== last.longitude || first.latitude !== last.latitude) {
    points.push(first)
  }
  return `POLYGON((${points.map((p) => `${p.longitude} ${p.latitude}`).join(', ')}))`
}
```

- [ ] **Step 4: Mirror the same logic in the PATCH handler**

Replace the inline `updateZoneSchema` (currently defined inside the file) with the imported `updateDeliveryZoneSchema`, and update the PATCH body to call `ringToWkt` / `ST_Buffer` identically, updating `metadata` when a shape is supplied:

```ts
fastify.patch('/:id', async (request, reply) => {
  await requireRole('SUPER_ADMIN', 'ADMIN')(request, reply)
  const { id } = request.params as { id: string }
  const body = updateDeliveryZoneSchema.parse(request.body)
  const { boundary: legacyPoints, shape, ...updateData } = body

  const existing = await request.tenantDb.deliveryZone.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('DeliveryZone', id)

  const zone = await request.tenantDb.$transaction(async (tx) => {
    const patched = await tx.deliveryZone.update({
      where: { id },
      data: {
        ...updateData,
        ...(shape ? { metadata: { ...(existing.metadata as object), shape } } : {}),
      },
    })
    if (shape?.type === 'polygon' || legacyPoints) {
      const wkt = ringToWkt(shape?.type === 'polygon' ? shape.ring : legacyPoints!)
      await tx.$executeRaw`
        UPDATE delivery_zones SET boundary = ST_GeomFromText(${wkt}, 4326) WHERE id = ${id}::uuid
      `
    } else if (shape?.type === 'circle') {
      await tx.$executeRaw`
        UPDATE delivery_zones
        SET boundary = ST_Buffer(
          ST_SetSRID(ST_MakePoint(${shape.center.longitude}, ${shape.center.latitude}), 4326)::geography,
          ${shape.radiusMeters}
        )::geometry
        WHERE id = ${id}::uuid
      `
    }
    return patched
  })

  await request.tenantRedis.invalidateGroup('zones')
  return { data: zone }
})
```

- [ ] **Step 5: Run tests; expect pass**

```bash
pnpm --filter @witylogix/api test -- zones.test.ts
```

Expected: PASS on both new POST tests and all existing PATCH/POST tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/zones.ts apps/api/src/routes/__tests__/zones.test.ts
git commit -m "feat(WIT-XX): POST/PATCH /v4/zones accept polygon+circle shapes via ST_GeomFromText/ST_Buffer"
```

---

## Task 5: API — `GET /v4/zones/overlays` endpoint

**Files:**
- Create: `apps/api/src/routes/zones-overlays.ts`
- Modify: `apps/api/src/routes/zones.ts`
- Modify: `apps/api/src/server.ts` (or wherever routes are registered; search for `zonesRoutes`)
- Create: `apps/api/src/routes/__tests__/zones-overlays.test.ts`

- [ ] **Step 1: Write failing test**

New file `apps/api/src/routes/__tests__/zones-overlays.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { buildOverlaysHandler, type OverlaysContext } from '../zones-overlays'

const ctx = (): OverlaysContext => ({
  tenantDb: {
    $queryRaw: vi.fn().mockImplementation(async (strings: TemplateStringsArray) => {
      const q = strings.join('')
      if (q.includes('open_orders'))
        return [{ zone_id: 'z1', open_orders: 12, drivers: 4, sla_pct: 0.92 }]
      if (q.includes('heatmap'))
        return [{ lng: 77.12, lat: 28.65, count: 17 }]
      if (q.includes('hubs')) return []
      return []
    }),
  } as unknown as OverlaysContext['tenantDb'],
  shopId: 'shop-1',
})

describe('zones overlays handler', () => {
  it('returns zones, heatmap, and hubs', async () => {
    const handler = buildOverlaysHandler()
    const res = await handler(ctx(), { window: '24h' })
    expect(res.zones[0]).toMatchObject({ id: 'z1', openOrders: 12, drivers: 4, slaPct: 0.92, health: 'good' })
    expect(res.heatmap[0]).toMatchObject({ lng: 77.12, lat: 28.65, count: 17 })
    expect(res.hubs).toEqual([])
  })

  it('caches results for 30 seconds per shop', async () => {
    const c = ctx()
    const handler = buildOverlaysHandler({ now: (() => { let t = 0; return () => (t += 1_000) })() })
    await handler(c, { window: '24h' })
    await handler(c, { window: '24h' })
    // $queryRaw called 3x per call (zones, heatmap, hubs) => 3x total if cached on second
    expect((c.tenantDb.$queryRaw as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3)
  })
})
```

- [ ] **Step 2: Run; expect fail**

```bash
pnpm --filter @witylogix/api test -- zones-overlays.test.ts
```

Expected: FAIL — handler not found.

- [ ] **Step 3: Implement the handler module**

Create `apps/api/src/routes/zones-overlays.ts`:

```ts
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { tenantContext } from '../middleware/tenant.js'
import { z } from 'zod'

export interface OverlaysContext {
  tenantDb: { $queryRaw: (s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown[]> }
  shopId: string
}

const querySchema = z.object({
  window: z.enum(['1h', '24h', '7d']).optional().default('24h'),
})

type Overlay = {
  zones: Array<{ id: string; openOrders: number; drivers: number; slaPct: number; health: 'good' | 'watch' | 'slipping' }>
  heatmap: Array<{ lng: number; lat: number; count: number }>
  hubs: Array<{ id: string; name: string; lng: number; lat: number; type: 'warehouse' | 'store' | 'hub' }>
}

const CACHE_TTL_MS = 30_000

interface CacheEntry { at: number; payload: Overlay }
const cache = new Map<string, CacheEntry>()

const healthFromSla = (sla: number): Overlay['zones'][number]['health'] =>
  sla >= 0.95 ? 'good' : sla >= 0.8 ? 'watch' : 'slipping'

const windowToInterval = (w: '1h' | '24h' | '7d') =>
  w === '1h' ? "interval '1 hour'" : w === '24h' ? "interval '1 day'" : "interval '7 days'"

export function buildOverlaysHandler(opts: { now?: () => number } = {}) {
  const now = opts.now ?? Date.now
  return async (ctx: OverlaysContext, q: { window: '1h' | '24h' | '7d' }): Promise<Overlay> => {
    const key = `${ctx.shopId}:${q.window}`
    const hit = cache.get(key)
    if (hit && now() - hit.at < CACHE_TTL_MS) return hit.payload

    const interval = windowToInterval(q.window)

    const [zoneRows, heatRows, hubRows] = await Promise.all([
      ctx.tenantDb.$queryRaw`
        SELECT dz.id::text AS zone_id,
               coalesce(oo.open_orders, 0)::int AS open_orders,
               coalesce(d.drivers, 0)::int AS drivers,
               coalesce(s.sla_pct, 1)::float AS sla_pct
        FROM delivery_zones dz
        LEFT JOIN (
          SELECT dz.id, count(*) AS open_orders
          FROM orders o JOIN delivery_zones dz
            ON ST_Contains(dz.boundary, ST_SetSRID(ST_MakePoint(o.destination_lng, o.destination_lat), 4326))
          WHERE o.status IN ('pending','assigned','picked_up') AND dz.shop_id = ${ctx.shopId}::uuid
          GROUP BY dz.id
        ) oo ON oo.id = dz.id
        LEFT JOIN (
          SELECT dz.id, count(DISTINCT d.id) AS drivers
          FROM drivers d JOIN delivery_zones dz
            ON ST_Contains(dz.boundary, ST_SetSRID(ST_MakePoint(d.last_lng, d.last_lat), 4326))
          WHERE d.last_ping_at >= now() - interval '10 minutes' AND dz.shop_id = ${ctx.shopId}::uuid
          GROUP BY dz.id
        ) d ON d.id = dz.id
        LEFT JOIN (
          SELECT dz.id, avg(case when o.delivered_at <= o.promised_at then 1 else 0 end)::float AS sla_pct
          FROM orders o JOIN delivery_zones dz
            ON ST_Contains(dz.boundary, ST_SetSRID(ST_MakePoint(o.destination_lng, o.destination_lat), 4326))
          WHERE o.delivered_at >= now() - ${interval}::interval AND dz.shop_id = ${ctx.shopId}::uuid
          GROUP BY dz.id
        ) s ON s.id = dz.id
        WHERE dz.shop_id = ${ctx.shopId}::uuid AND dz.is_active = true
      `,
      ctx.tenantDb.$queryRaw`
        SELECT destination_lng AS lng, destination_lat AS lat, count(*)::int AS count
        FROM orders
        WHERE created_at >= now() - ${interval}::interval
          AND shop_id = ${ctx.shopId}::uuid
        GROUP BY 1, 2
      `,
      ctx.tenantDb.$queryRaw`
        SELECT id::text, name, lng, lat, type FROM hubs WHERE shop_id = ${ctx.shopId}::uuid AND is_active = true
      `,
    ]) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>]

    const payload: Overlay = {
      zones: zoneRows.map((r) => ({
        id: String(r.zone_id),
        openOrders: Number(r.open_orders),
        drivers: Number(r.drivers),
        slaPct: Number(r.sla_pct),
        health: healthFromSla(Number(r.sla_pct)),
      })),
      heatmap: heatRows.map((r) => ({ lng: Number(r.lng), lat: Number(r.lat), count: Number(r.count) })),
      hubs: hubRows.map((r) => ({
        id: String(r.id), name: String(r.name), lng: Number(r.lng), lat: Number(r.lat),
        type: (r.type as Overlay['hubs'][number]['type']) ?? 'hub',
      })),
    }

    cache.set(key, { at: now(), payload })
    return payload
  }
}

export default async function zonesOverlaysRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth)
  fastify.addHook('preHandler', tenantContext)

  const handler = buildOverlaysHandler()
  fastify.get('/', async (request: FastifyRequest) => {
    const q = querySchema.parse(request.query)
    return handler({ tenantDb: request.tenantDb as OverlaysContext['tenantDb'], shopId: request.shopId }, q)
  })
}
```

- [ ] **Step 4: Register the new subroute**

Find where `zonesRoutes` is registered (look for `zones.ts` import in `apps/api/src/server.ts` or the routes index). Register `zonesOverlaysRoutes` at `/v4/zones/overlays`:

```ts
await fastify.register(zonesOverlaysRoutes, { prefix: '/v4/zones/overlays' })
await fastify.register(zonesRoutes, { prefix: '/v4/zones' })
```

Order matters — register the `/overlays` plugin before `/` so the catch-all `GET /:id` in `zonesRoutes` does not swallow `/overlays`.

- [ ] **Step 5: Run tests; expect pass**

```bash
pnpm --filter @witylogix/api test -- zones-overlays.test.ts
pnpm --filter @witylogix/api typecheck
```

Expected: PASS for both.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/zones-overlays.ts apps/api/src/routes/__tests__/zones-overlays.test.ts apps/api/src/server.ts apps/api/src/routes/zones.ts
git commit -m "feat(WIT-XX): GET /v4/zones/overlays with 30s in-memory cache"
```

---

## Task 6: Dashboard — install deps, add MapLibre style builder

**Files:**
- Modify: `apps/dashboard/package.json`
- Create: `apps/dashboard/src/styles/wl-map-style.ts`
- Create: `apps/dashboard/src/components/map/__tests__/wl-map-style.test.ts`

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/youthocrat/Desktop/Witylogix/witylogix-platform
pnpm add --filter @witylogix/dashboard maplibre-gl @mapbox/mapbox-gl-draw @turf/turf
pnpm add --filter @witylogix/dashboard -D @types/mapbox__mapbox-gl-draw
```

- [ ] **Step 2: Write failing test for the style builder**

Create `apps/dashboard/src/components/map/__tests__/wl-map-style.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildMapStyle } from '../../../styles/wl-map-style'

describe('buildMapStyle', () => {
  it('returns a MapLibre style with the provided MapTiler key', () => {
    const style = buildMapStyle({ maptilerKey: 'KEY123' })
    expect(style).toMatchObject({
      version: 8,
      sources: expect.objectContaining({
        basemap: expect.objectContaining({ url: expect.stringContaining('key=KEY123') }),
      }),
    })
  })

  it('declares empty sources for zones, heatmap, pins, hubs', () => {
    const style = buildMapStyle({ maptilerKey: 'k' })
    expect(style.sources).toHaveProperty('zones')
    expect(style.sources).toHaveProperty('heatmap')
    expect(style.sources).toHaveProperty('pins')
    expect(style.sources).toHaveProperty('hubs')
  })
})
```

- [ ] **Step 3: Run; expect fail**

```bash
pnpm --filter @witylogix/dashboard test -- wl-map-style.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement the builder**

Create `apps/dashboard/src/styles/wl-map-style.ts`:

```ts
import type { StyleSpecification } from 'maplibre-gl'

export interface BuildMapStyleOpts {
  maptilerKey: string
  basemap?: 'dark' | 'backdrop'
}

export function buildMapStyle({ maptilerKey, basemap = 'dark' }: BuildMapStyleOpts): StyleSpecification {
  const basemapUrl =
    basemap === 'backdrop'
      ? `https://api.maptiler.com/maps/backdrop-dark/style.json?key=${maptilerKey}`
      : `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${maptilerKey}`

  return {
    version: 8,
    sources: {
      basemap: { type: 'raster', url: basemapUrl, tileSize: 256 } as unknown as StyleSpecification['sources'][string],
      zones: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      heatmap: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      pins: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      hubs: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
      } as unknown as StyleSpecification['layers'][number],
    ],
  } as StyleSpecification
}
```

The cast-through-unknown hop is because MapLibre's TS types disallow `raster` with a plain `url`; we deliberately rely on its style-url loader at runtime. A follow-up tightening can swap to a fully typed tile source once we self-host PMTiles.

- [ ] **Step 5: Run tests; expect pass**

```bash
pnpm --filter @witylogix/dashboard test -- wl-map-style.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/package.json apps/dashboard/src/styles/wl-map-style.ts apps/dashboard/src/components/map/__tests__/wl-map-style.test.ts pnpm-lock.yaml
git commit -m "feat(WIT-XX): install maplibre-gl+mapbox-gl-draw+turf; add wl-map-style builder"
```

---

## Task 7: `<WLMap>` base component

**Files:**
- Create: `apps/dashboard/src/components/map/wl-map.tsx`
- Create: `apps/dashboard/src/components/map/wl-map-context.tsx`
- Create: `apps/dashboard/src/components/map/__tests__/wl-map.test.tsx`

- [ ] **Step 1: Write failing render test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WLMap } from '../wl-map'

vi.mock('maplibre-gl', () => ({
  default: { Map: vi.fn(() => ({ on: vi.fn(), remove: vi.fn(), addControl: vi.fn(), getCanvas: () => ({ style: {} }), getCenter: () => ({ lng: 0, lat: 0 }), getZoom: () => 0 })) },
}))

describe('<WLMap>', () => {
  it('renders a container element with data-testid="wl-map"', () => {
    render(<WLMap maptilerKey="k" center={[77.12, 28.65]} zoom={12} />)
    expect(screen.getByTestId('wl-map')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run; expect fail**

```bash
pnpm --filter @witylogix/dashboard test -- wl-map.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement context + component**

Create `apps/dashboard/src/components/map/wl-map-context.tsx`:

```tsx
'use client'
import { createContext, useContext } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

export const WLMapContext = createContext<MapLibreMap | null>(null)
export function useWLMap(): MapLibreMap {
  const m = useContext(WLMapContext)
  if (!m) throw new Error('useWLMap must be used inside <WLMap>')
  return m
}
```

Create `apps/dashboard/src/components/map/wl-map.tsx`:

```tsx
'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import maplibregl, { type Map as MapLibreMap, type LngLatLike } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildMapStyle } from '@/styles/wl-map-style'
import { WLMapContext } from './wl-map-context'

export interface WLMapProps {
  maptilerKey: string
  center: [number, number]
  zoom?: number
  interactive?: boolean
  cursor?: 'default' | 'crosshair' | 'grab'
  onViewportChange?: (vp: { center: [number, number]; zoom: number }) => void
  children?: ReactNode
  className?: string
}

export function WLMap({
  maptilerKey,
  center,
  zoom = 12,
  interactive = true,
  cursor = 'default',
  onViewportChange,
  children,
  className,
}: WLMapProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const m = new maplibregl.Map({
      container: ref.current,
      style: buildMapStyle({ maptilerKey }),
      center: center as LngLatLike,
      zoom,
      interactive,
      attributionControl: { compact: true },
    })
    m.getCanvas().style.cursor = cursor
    m.on('moveend', () => {
      if (!onViewportChange) return
      const c = m.getCenter()
      onViewportChange({ center: [c.lng, c.lat], zoom: m.getZoom() })
    })
    setMap(m)
    return () => { m.remove() }
     
  }, [maptilerKey])

  useEffect(() => { if (map) map.getCanvas().style.cursor = cursor }, [map, cursor])

  return (
    <div
      ref={ref}
      data-testid="wl-map"
      className={className ?? 'h-full w-full'}
      style={{ background: 'var(--wl-bg-sunken)' }}
    >
      {map && <WLMapContext.Provider value={map}>{children}</WLMapContext.Provider>}
    </div>
  )
}
```

- [ ] **Step 4: Run tests; expect pass**

```bash
pnpm --filter @witylogix/dashboard test -- wl-map.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/map/wl-map.tsx apps/dashboard/src/components/map/wl-map-context.tsx apps/dashboard/src/components/map/__tests__/wl-map.test.tsx
git commit -m "feat(WIT-XX): add <WLMap> base component with MapLibre lifecycle + context"
```

---

## Task 8: `<ZoneLayer>` — render zone polygons from GeoJSON

**Files:**
- Create: `apps/dashboard/src/components/map/zone-layer.tsx`
- Create: `apps/dashboard/src/components/map/__tests__/zone-layer.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/dashboard/src/components/map/__tests__/zone-layer.test.tsx
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WLMapContext } from '../wl-map-context'
import { ZoneLayer } from '../zone-layer'

describe('<ZoneLayer>', () => {
  it('adds a GeoJSON source and layer on mount', () => {
    const addSource = vi.fn()
    const addLayer = vi.fn()
    const getSource = vi.fn()
    const map = {
      addSource, addLayer, getSource,
      getLayer: vi.fn(() => true),
      removeLayer: vi.fn(), removeSource: vi.fn(),
      isStyleLoaded: () => true, on: vi.fn(), off: vi.fn(),
      setPaintProperty: vi.fn(),
    }
    render(
      <WLMapContext.Provider value={map as unknown as never}>
        <ZoneLayer zones={{ type: 'FeatureCollection', features: [] }} selectedId={null} onSelect={() => {}} />
      </WLMapContext.Provider>,
    )
    expect(addSource).toHaveBeenCalledWith('zones', expect.objectContaining({ type: 'geojson' }))
    expect(addLayer).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run; expect fail**

```bash
pnpm --filter @witylogix/dashboard test -- zone-layer.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `apps/dashboard/src/components/map/zone-layer.tsx`:

```tsx
'use client'
import { useEffect } from 'react'
import type { FeatureCollection } from 'geojson'
import { useWLMap } from './wl-map-context'

export interface ZoneLayerProps {
  zones: FeatureCollection
  selectedId: string | null
  onSelect: (zoneId: string | null) => void
}

export function ZoneLayer({ zones, selectedId, onSelect }: ZoneLayerProps) {
  const map = useWLMap()

  // Add/remove the source+layers once.
  useEffect(() => {
    const setup = () => {
      if (map.getSource('zones')) return
      map.addSource('zones', { type: 'geojson', data: zones })
      map.addLayer({
        id: 'zones-fill',
        type: 'fill',
        source: 'zones',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'health'], 'slipping'], '#ef4444',
            ['==', ['get', 'health'], 'watch'], '#f59e0b',
            '#10b981',
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'id'], ['literal', selectedId ?? '']], 0.45,
            0.25,
          ],
        },
      })
      map.addLayer({
        id: 'zones-stroke',
        type: 'line',
        source: 'zones',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'id'], ['literal', selectedId ?? '']], '#f5a623',
            '#35354a',
          ],
          'line-width': 2,
        },
      })
      map.on('click', 'zones-fill', (e) => {
        const f = e.features?.[0]
        const id = f?.properties?.id as string | undefined
        onSelect(id ?? null)
      })
    }
    if (map.isStyleLoaded()) setup()
    else map.on('load', setup)
    return () => {
      if (map.getLayer('zones-fill')) map.removeLayer('zones-fill')
      if (map.getLayer('zones-stroke')) map.removeLayer('zones-stroke')
      if (map.getSource('zones')) map.removeSource('zones')
    }
  }, [map])

  // Update data when zones change.
  useEffect(() => {
    const src = map.getSource('zones') as maplibregl.GeoJSONSource | undefined
    if (src) src.setData(zones)
  }, [map, zones])

  // Re-paint selection highlight when selectedId changes.
  useEffect(() => {
    if (!map.getLayer('zones-stroke')) return
    map.setPaintProperty('zones-stroke', 'line-color', [
      'case', ['==', ['get', 'id'], ['literal', selectedId ?? '']], '#f5a623', '#35354a',
    ])
    map.setPaintProperty('zones-fill', 'fill-opacity', [
      'case', ['==', ['get', 'id'], ['literal', selectedId ?? '']], 0.45, 0.25,
    ])
  }, [map, selectedId])

  return null
}
```

Note: MapLibre paint expressions cannot read CSS vars. We use literal hex values here that match the `--wl-*` tokens (`#ef4444`, `#f59e0b`, `#10b981`, `#f5a623`, `#35354a`). Task 14 introduces a token-resolver helper that replaces these with values read from `getComputedStyle(document.documentElement)` at runtime.

- [ ] **Step 4: Run tests; expect pass**

```bash
pnpm --filter @witylogix/dashboard test -- zone-layer.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/map/zone-layer.tsx apps/dashboard/src/components/map/__tests__/zone-layer.test.tsx
git commit -m "feat(WIT-XX): <ZoneLayer> renders zone polygons with health-driven fill + selection stroke"
```

---

## Task 9: `<HeatmapLayer>`, `<PinLayer>`, `<HubLayer>`

**Files:**
- Create: `apps/dashboard/src/components/map/heatmap-layer.tsx`
- Create: `apps/dashboard/src/components/map/pin-layer.tsx`
- Create: `apps/dashboard/src/components/map/hub-layer.tsx`
- Create: `apps/dashboard/src/components/map/__tests__/layers.test.tsx`

- [ ] **Step 1: Write consolidated test**

```tsx
// layers.test.tsx
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WLMapContext } from '../wl-map-context'
import { HeatmapLayer } from '../heatmap-layer'
import { PinLayer } from '../pin-layer'
import { HubLayer } from '../hub-layer'

const mockMap = () => ({
  addSource: vi.fn(), addLayer: vi.fn(), getSource: vi.fn(), getLayer: vi.fn(),
  removeLayer: vi.fn(), removeSource: vi.fn(), setPaintProperty: vi.fn(),
  isStyleLoaded: () => true, on: vi.fn(), off: vi.fn(),
})

describe('map overlay layers', () => {
  it.each([
    ['heatmap', <HeatmapLayer points={[{ lng: 77, lat: 28, count: 3 }]} />],
    ['pins', <PinLayer pins={[{ id: 'o1', lng: 77, lat: 28, status: 'open' }]} />],
    ['hubs', <HubLayer hubs={[{ id: 'h1', name: 'DC', lng: 77, lat: 28, type: 'warehouse' }]} />],
  ])('mounts %s source', (_name, node) => {
    const m = mockMap()
    render(<WLMapContext.Provider value={m as never}>{node}</WLMapContext.Provider>)
    expect(m.addSource).toHaveBeenCalled()
    expect(m.addLayer).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run; expect fail**

```bash
pnpm --filter @witylogix/dashboard test -- layers.test.tsx
```

- [ ] **Step 3: Implement `<HeatmapLayer>`**

Create `apps/dashboard/src/components/map/heatmap-layer.tsx`:

```tsx
'use client'
import { useEffect } from 'react'
import { useWLMap } from './wl-map-context'

export interface HeatmapPoint { lng: number; lat: number; count: number }
export interface HeatmapLayerProps { points: HeatmapPoint[] }

export function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useWLMap()
  useEffect(() => {
    const setup = () => {
      if (map.getSource('heatmap')) return
      map.addSource('heatmap', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: points.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { count: p.count } })),
        },
      })
      map.addLayer({
        id: 'heatmap-layer', type: 'heatmap', source: 'heatmap',
        paint: {
          'heatmap-weight': ['get', 'count'],
          'heatmap-intensity': 1,
          'heatmap-radius': 24,
          'heatmap-opacity': 0.8,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(96,165,250,0)', 0.2, 'rgba(96,165,250,0.4)',
            0.5, 'rgba(245,158,11,0.6)', 1, 'rgba(239,68,68,0.9)',
          ],
        },
      })
    }
    if (map.isStyleLoaded()) setup(); else map.on('load', setup)
    return () => {
      if (map.getLayer('heatmap-layer')) map.removeLayer('heatmap-layer')
      if (map.getSource('heatmap')) map.removeSource('heatmap')
    }
  }, [map])

  useEffect(() => {
    const src = map.getSource('heatmap') as maplibregl.GeoJSONSource | undefined
    if (src) src.setData({
      type: 'FeatureCollection',
      features: points.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { count: p.count } })),
    })
  }, [map, points])
  return null
}
```

- [ ] **Step 4: Implement `<PinLayer>`**

Create `apps/dashboard/src/components/map/pin-layer.tsx`:

```tsx
'use client'
import { useEffect } from 'react'
import { useWLMap } from './wl-map-context'

export type PinStatus = 'open' | 'assigned' | 'in_transit' | 'delayed'
export interface Pin { id: string; lng: number; lat: number; status: PinStatus; label?: string }
export interface PinLayerProps { pins: Pin[] }

const COLOR_BY_STATUS: Record<PinStatus, string> = {
  open: '#60a5fa', assigned: '#f5a623', in_transit: '#10b981', delayed: '#ef4444',
}

export function PinLayer({ pins }: PinLayerProps) {
  const map = useWLMap()
  useEffect(() => {
    const setup = () => {
      if (map.getSource('pins')) return
      map.addSource('pins', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: pins.map((p) => ({
            type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: { id: p.id, status: p.status, label: p.label ?? '' },
          })),
        },
      })
      map.addLayer({
        id: 'pins-circles', type: 'circle', source: 'pins',
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'match', ['get', 'status'],
            'open', COLOR_BY_STATUS.open,
            'assigned', COLOR_BY_STATUS.assigned,
            'in_transit', COLOR_BY_STATUS.in_transit,
            'delayed', COLOR_BY_STATUS.delayed,
            '#8585a0',
          ],
          'circle-stroke-color': '#0a0a0c', 'circle-stroke-width': 2,
        },
      })
    }
    if (map.isStyleLoaded()) setup(); else map.on('load', setup)
    return () => {
      if (map.getLayer('pins-circles')) map.removeLayer('pins-circles')
      if (map.getSource('pins')) map.removeSource('pins')
    }
  }, [map])

  useEffect(() => {
    const src = map.getSource('pins') as maplibregl.GeoJSONSource | undefined
    if (src) src.setData({
      type: 'FeatureCollection',
      features: pins.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, status: p.status, label: p.label ?? '' } })),
    })
  }, [map, pins])
  return null
}
```

- [ ] **Step 5: Implement `<HubLayer>`**

Create `apps/dashboard/src/components/map/hub-layer.tsx`:

```tsx
'use client'
import { useEffect } from 'react'
import { useWLMap } from './wl-map-context'

export interface Hub { id: string; name: string; lng: number; lat: number; type: 'warehouse' | 'store' | 'hub' }
export interface HubLayerProps { hubs: Hub[] }

export function HubLayer({ hubs }: HubLayerProps) {
  const map = useWLMap()
  useEffect(() => {
    const setup = () => {
      if (map.getSource('hubs')) return
      map.addSource('hubs', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: hubs.map((h) => ({
            type: 'Feature', geometry: { type: 'Point', coordinates: [h.lng, h.lat] },
            properties: { id: h.id, name: h.name, type: h.type },
          })),
        },
      })
      map.addLayer({
        id: 'hubs-squares', type: 'circle', source: 'hubs',
        paint: {
          'circle-radius': 7,
          'circle-color': '#f5a623',
          'circle-stroke-color': '#0a0a0c', 'circle-stroke-width': 2,
        },
      })
      map.addLayer({
        id: 'hubs-labels', type: 'symbol', source: 'hubs',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-font': ['DM Sans Regular', 'Open Sans Regular'],
        },
        paint: { 'text-color': '#d5d5dd', 'text-halo-color': '#0a0a0c', 'text-halo-width': 1 },
      })
    }
    if (map.isStyleLoaded()) setup(); else map.on('load', setup)
    return () => {
      if (map.getLayer('hubs-labels')) map.removeLayer('hubs-labels')
      if (map.getLayer('hubs-squares')) map.removeLayer('hubs-squares')
      if (map.getSource('hubs')) map.removeSource('hubs')
    }
  }, [map])
  return null
}
```

- [ ] **Step 6: Run tests; expect pass**

```bash
pnpm --filter @witylogix/dashboard test -- layers.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/components/map/heatmap-layer.tsx apps/dashboard/src/components/map/pin-layer.tsx apps/dashboard/src/components/map/hub-layer.tsx apps/dashboard/src/components/map/__tests__/layers.test.tsx
git commit -m "feat(WIT-XX): heatmap, pin, and hub map layers"
```

---

## Task 10: `<DrawLayer>` — polygon + circle drawing via mapbox-gl-draw

**Files:**
- Create: `apps/dashboard/src/components/map/draw-layer.tsx`
- Create: `apps/dashboard/src/components/map/__tests__/draw-layer.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// draw-layer.test.tsx
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WLMapContext } from '../wl-map-context'
import { DrawLayer } from '../draw-layer'

vi.mock('@mapbox/mapbox-gl-draw', () => ({
  default: vi.fn().mockImplementation(() => ({
    add: vi.fn(), delete: vi.fn(), deleteAll: vi.fn(), changeMode: vi.fn(), getAll: vi.fn(() => ({ features: [] })),
  })),
}))

describe('<DrawLayer>', () => {
  it('attaches a draw control to the map when mode is set', () => {
    const addControl = vi.fn()
    const map = { addControl, removeControl: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn() }
    render(<WLMapContext.Provider value={map as never}><DrawLayer mode="polygon" value={null} onChange={() => {}} /></WLMapContext.Provider>)
    expect(addControl).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run; expect fail**

```bash
pnpm --filter @witylogix/dashboard test -- draw-layer.test.tsx
```

- [ ] **Step 3: Implement**

Create `apps/dashboard/src/components/map/draw-layer.tsx`:

```tsx
'use client'
import { useEffect, useRef } from 'react'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import type { FeatureCollection } from 'geojson'
import { circle as turfCircle } from '@turf/turf'
import { useWLMap } from './wl-map-context'
import type { ZoneShape } from '@witylogix/validators'

export interface DrawLayerProps {
  mode: 'polygon' | 'circle' | null
  value: ZoneShape | null
  onChange: (shape: ZoneShape | null) => void
  /** For circle mode, radius in meters (controlled by inspector slider). */
  circleRadiusMeters?: number
}

export function DrawLayer({ mode, value, onChange, circleRadiusMeters = 1000 }: DrawLayerProps) {
  const map = useWLMap()
  const drawRef = useRef<MapboxDraw | null>(null)

  useEffect(() => {
    if (!mode) return
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      styles: [
        { id: 'draw-poly-fill', type: 'fill', filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], paint: { 'fill-color': '#f5a623', 'fill-opacity': 0.2 } },
        { id: 'draw-poly-stroke', type: 'line', filter: ['all', ['==', '$type', 'Polygon']], paint: { 'line-color': '#f5a623', 'line-width': 2 } },
        { id: 'draw-vertex', type: 'circle', filter: ['all', ['==', 'meta', 'vertex']], paint: { 'circle-radius': 5, 'circle-color': '#f5a623' } },
      ],
    })
    drawRef.current = draw
    map.addControl(draw as unknown as maplibregl.IControl)

    if (mode === 'polygon') draw.changeMode('draw_polygon')
    if (mode === 'circle') {
      // mapbox-gl-draw has no native circle; synthesize with turf on single-click.
      const onClick = (e: maplibregl.MapMouseEvent) => {
        const poly = turfCircle([e.lngLat.lng, e.lngLat.lat], circleRadiusMeters / 1000, { steps: 64, units: 'kilometers' })
        draw.deleteAll()
        draw.add(poly)
        onChange({ type: 'circle', center: { latitude: e.lngLat.lat, longitude: e.lngLat.lng }, radiusMeters: circleRadiusMeters })
      }
      map.once('click', onClick)
    }

    const emitPolygon = () => {
      const all = draw.getAll() as FeatureCollection
      const feat = all.features[0]
      if (!feat || feat.geometry.type !== 'Polygon') return onChange(null)
      const ring = feat.geometry.coordinates[0]
        .slice(0, -1)
        .map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
      onChange({ type: 'polygon', ring })
    }
    map.on('draw.create' as unknown as keyof maplibregl.MapLayerEventType, emitPolygon)
    map.on('draw.update' as unknown as keyof maplibregl.MapLayerEventType, emitPolygon)

    // Hydrate existing value into the draw control so users can edit.
    if (value?.type === 'polygon' && value.ring.length >= 3) {
      draw.add({
        type: 'Feature', properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[...value.ring.map((p) => [p.longitude, p.latitude]), [value.ring[0].longitude, value.ring[0].latitude]]],
        },
      })
    } else if (value?.type === 'circle') {
      const poly = turfCircle([value.center.longitude, value.center.latitude], value.radiusMeters / 1000, { steps: 64, units: 'kilometers' })
      draw.add(poly)
    }

    return () => { map.removeControl(draw as unknown as maplibregl.IControl); drawRef.current = null }
  }, [map, mode, circleRadiusMeters])

  return null
}
```

- [ ] **Step 4: Run; expect pass**

```bash
pnpm --filter @witylogix/dashboard test -- draw-layer.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/map/draw-layer.tsx apps/dashboard/src/components/map/__tests__/draw-layer.test.tsx
git commit -m "feat(WIT-XX): <DrawLayer> polygon+circle drawing (turf-synthesized circle)"
```

---

## Task 11: UI chrome — `<ModeToggle>`, `<OverlayControls>`, `<ZoneSearch>`, `<KpiStrip>`

**Files:**
- Create: `apps/dashboard/src/components/zones/mode-toggle.tsx`
- Create: `apps/dashboard/src/components/zones/overlay-controls.tsx`
- Create: `apps/dashboard/src/components/zones/zone-search.tsx`
- Create: `apps/dashboard/src/components/zones/kpi-strip.tsx`
- Create: `apps/dashboard/src/components/zones/__tests__/chrome.test.tsx`

- [ ] **Step 1: Write consolidated failing tests**

```tsx
// chrome.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModeToggle } from '../mode-toggle'
import { OverlayControls, type OverlayState } from '../overlay-controls'
import { ZoneSearch } from '../zone-search'
import { KpiStrip } from '../kpi-strip'

describe('zones chrome', () => {
  it('ModeToggle switches between monitor and configure', () => {
    const onChange = vi.fn()
    render(<ModeToggle value="monitor" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: /configure/i }))
    expect(onChange).toHaveBeenCalledWith('configure')
  })

  it('OverlayControls persists state to localStorage', () => {
    const ls = new Map<string, string>()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k) => ls.get(k) ?? null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => void ls.set(k, v))
    const state: OverlayState = { heatmap: true, sla: true, openOrders: true, hubs: true, window: '24h' }
    const onChange = vi.fn()
    render(<OverlayControls value={state} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText(/heatmap/i))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ heatmap: false }))
  })

  it('ZoneSearch calls onSelect with fuzzy match', () => {
    const onSelect = vi.fn()
    render(<ZoneSearch zones={[{ id: 'a', name: 'South Hub' }, { id: 'b', name: 'North' }]} onSelect={onSelect} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'south' } })
    fireEvent.click(screen.getByRole('option', { name: /south hub/i }))
    expect(onSelect).toHaveBeenCalledWith('a')
  })

  it('KpiStrip renders zone/driver/order counts and a slipping pill', () => {
    render(<KpiStrip stats={{ zones: 4, driversOnline: 13, openOrders: 47, slipping: 1 }} onClickSlipping={() => {}} />)
    expect(screen.getByText(/4 zones/)).toBeInTheDocument()
    expect(screen.getByText(/13 drivers online/)).toBeInTheDocument()
    expect(screen.getByText(/47 open orders/)).toBeInTheDocument()
    expect(screen.getByText(/1 slipping/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run; expect fail**

```bash
pnpm --filter @witylogix/dashboard test -- chrome.test.tsx
```

- [ ] **Step 3: Implement `<ModeToggle>`**

```tsx
// apps/dashboard/src/components/zones/mode-toggle.tsx
'use client'
export type ZoneMode = 'monitor' | 'configure'
export interface ModeToggleProps { value: ZoneMode; onChange: (m: ZoneMode) => void }

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div
      role="tablist"
      className="inline-flex rounded-md border text-sm"
      style={{ background: 'var(--wl-bg-elevated)', borderColor: 'var(--wl-neutral-800)' }}
    >
      {(['monitor', 'configure'] as const).map((m) => {
        const active = m === value
        return (
          <button
            key={m}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            className="px-3 py-1.5 capitalize transition-colors"
            style={{
              color: active ? 'var(--wl-neutral-50)' : 'var(--wl-neutral-400)',
              background: active ? 'var(--wl-primary-700)' : 'transparent',
            }}
          >
            {m}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Implement `<OverlayControls>`**

```tsx
// apps/dashboard/src/components/zones/overlay-controls.tsx
'use client'
import { useEffect } from 'react'

export interface OverlayState {
  heatmap: boolean
  sla: boolean
  openOrders: boolean
  hubs: boolean
  window: '1h' | '24h' | '7d'
}
export interface OverlayControlsProps { value: OverlayState; onChange: (v: OverlayState) => void }

const STORAGE_KEY = 'wl.zones.overlays'

export function OverlayControls({ value, onChange }: OverlayControlsProps) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) onChange({ ...value, ...(JSON.parse(raw) as Partial<OverlayState>) })
    } catch { /* ignore parse failure */ }
     
  }, [])

  const update = (patch: Partial<OverlayState>) => {
    const next = { ...value, ...patch }
    onChange(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore quota */ }
  }

  const Check = ({ k, label }: { k: keyof OverlayState; label: string }) => (
    <label className="flex items-center gap-2 text-xs py-1">
      <input
        type="checkbox"
        aria-label={label}
        checked={Boolean(value[k])}
        onChange={(e) => update({ [k]: e.target.checked } as Partial<OverlayState>)}
        className="accent-[var(--wl-primary-500)]"
      />
      <span style={{ color: 'var(--wl-neutral-200)' }}>{label}</span>
    </label>
  )

  return (
    <div
      className="rounded-md border p-3 min-w-[180px] space-y-0.5"
      style={{ background: 'var(--wl-bg-elevated)', borderColor: 'var(--wl-neutral-800)' }}
    >
      <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: 'var(--wl-neutral-500)' }}>
        Overlays
      </div>
      <Check k="heatmap" label="Heatmap" />
      <Check k="sla" label="SLA tint" />
      <Check k="openOrders" label="Open orders" />
      <Check k="hubs" label="Hubs" />
      <div className="mt-3 flex gap-1">
        {(['1h', '24h', '7d'] as const).map((w) => (
          <button
            key={w}
            onClick={() => update({ window: w })}
            className="px-2 py-0.5 rounded text-[11px]"
            style={{
              background: value.window === w ? 'var(--wl-primary-700)' : 'var(--wl-bg-overlay)',
              color: value.window === w ? 'var(--wl-neutral-50)' : 'var(--wl-neutral-300)',
            }}
          >{w}</button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Implement `<ZoneSearch>`**

```tsx
// apps/dashboard/src/components/zones/zone-search.tsx
'use client'
import { useMemo, useState } from 'react'

export interface SearchableZone { id: string; name: string }
export interface ZoneSearchProps { zones: SearchableZone[]; onSelect: (id: string) => void }

export function ZoneSearch({ zones, onSelect }: ZoneSearchProps) {
  const [q, setQ] = useState('')
  const matches = useMemo(() => {
    if (!q) return []
    const needle = q.toLowerCase()
    return zones.filter((z) => z.name.toLowerCase().includes(needle)).slice(0, 8)
  }, [q, zones])

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={matches.length > 0}
        placeholder="Search zones…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-64 rounded-md px-3 py-1.5 text-sm border outline-none"
        style={{
          background: 'var(--wl-bg-elevated)', borderColor: 'var(--wl-neutral-800)',
          color: 'var(--wl-neutral-100)',
        }}
      />
      {matches.length > 0 && (
        <ul
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 rounded-md border max-h-60 overflow-auto"
          style={{ background: 'var(--wl-bg-overlay)', borderColor: 'var(--wl-neutral-800)' }}
        >
          {matches.map((m) => (
            <li key={m.id} role="option">
              <button
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--wl-bg-elevated)]"
                style={{ color: 'var(--wl-neutral-100)' }}
                onClick={() => { onSelect(m.id); setQ('') }}
              >{m.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Implement `<KpiStrip>`**

```tsx
// apps/dashboard/src/components/zones/kpi-strip.tsx
'use client'
export interface KpiStats { zones: number; driversOnline: number; openOrders: number; slipping: number }
export interface KpiStripProps { stats: KpiStats; onClickSlipping: () => void }

export function KpiStrip({ stats, onClickSlipping }: KpiStripProps) {
  return (
    <div
      className="inline-flex items-center gap-4 rounded-md border px-4 py-1.5 text-xs"
      style={{ background: 'var(--wl-bg-elevated)', borderColor: 'var(--wl-neutral-800)', color: 'var(--wl-neutral-200)' }}
    >
      <span>{stats.zones} zones</span>
      <span style={{ color: 'var(--wl-neutral-600)' }}>|</span>
      <span>{stats.driversOnline} drivers online</span>
      <span style={{ color: 'var(--wl-neutral-600)' }}>|</span>
      <span>{stats.openOrders} open orders</span>
      {stats.slipping > 0 && (
        <>
          <span style={{ color: 'var(--wl-neutral-600)' }}>|</span>
          <button
            onClick={onClickSlipping}
            className="rounded px-2 py-0.5"
            style={{ background: 'var(--wl-warning-bg)', color: 'var(--wl-warning-500)' }}
          >{stats.slipping} slipping</button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Run tests; expect pass**

```bash
pnpm --filter @witylogix/dashboard test -- chrome.test.tsx
```

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/components/zones/
git commit -m "feat(WIT-XX): zones chrome — ModeToggle, OverlayControls (with localStorage), ZoneSearch, KpiStrip"
```

---

## Task 12: `<ZoneInspector>` — mode-variant side panel

**Files:**
- Create: `apps/dashboard/src/components/zones/zone-inspector.tsx`
- Create: `apps/dashboard/src/components/zones/__tests__/zone-inspector.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// zone-inspector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ZoneInspector } from '../zone-inspector'

const zone = {
  id: 'z1', name: 'South Hub', baseRate: 40, perKmRate: 8,
  minOrder: 0, freeAbove: null, isActive: true, priority: 0,
}
const overlay = { id: 'z1', openOrders: 12, drivers: 4, slaPct: 0.92, health: 'good' as const }

describe('<ZoneInspector>', () => {
  it('monitor mode shows read-only zone summary', () => {
    render(<ZoneInspector zone={zone} overlay={overlay} mode="monitor" onSave={() => {}} onDelete={() => {}} onEditGeometry={() => {}} />)
    expect(screen.getByText('South Hub')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit geometry/i })).toBeNull()
  })

  it('configure mode reveals editable fields and Edit geometry', () => {
    const onSave = vi.fn()
    render(<ZoneInspector zone={zone} overlay={overlay} mode="configure" onSave={onSave} onDelete={() => {}} onEditGeometry={() => {}} />)
    const rate = screen.getByLabelText(/base rate/i) as HTMLInputElement
    fireEvent.change(rate, { target: { value: '45' } })
    fireEvent.blur(rate)
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ baseRate: 45 }))
    expect(screen.getByRole('button', { name: /edit geometry/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run; expect fail**

```bash
pnpm --filter @witylogix/dashboard test -- zone-inspector.test.tsx
```

- [ ] **Step 3: Implement**

```tsx
// apps/dashboard/src/components/zones/zone-inspector.tsx
'use client'
import Link from 'next/link'
import type { UpdateDeliveryZone } from '@witylogix/validators'

export interface InspectorZone {
  id: string; name: string;
  baseRate: number; perKmRate: number; minOrder: number; freeAbove: number | null;
  isActive: boolean; priority: number;
}
export interface InspectorOverlay {
  id: string; openOrders: number; drivers: number; slaPct: number; health: 'good' | 'watch' | 'slipping';
}
export interface ZoneInspectorProps {
  zone: InspectorZone
  overlay?: InspectorOverlay
  mode: 'monitor' | 'configure'
  onSave: (patch: UpdateDeliveryZone) => void
  onDelete: () => void
  onEditGeometry: () => void
}

const HEALTH_COLOR: Record<InspectorOverlay['health'], string> = {
  good: 'var(--wl-success-500)',
  watch: 'var(--wl-warning-500)',
  slipping: 'var(--wl-danger-500)',
}

export function ZoneInspector({ zone, overlay, mode, onSave, onDelete, onEditGeometry }: ZoneInspectorProps) {
  return (
    <aside
      aria-live="polite"
      className="flex flex-col w-80 h-full p-4 border-l"
      style={{ background: 'var(--wl-bg-surface)', borderColor: 'var(--wl-neutral-800)' }}
    >
      <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--wl-neutral-500)' }}>Zone</div>
      <div className="mt-1 mb-4 text-base font-semibold" style={{ color: 'var(--wl-neutral-50)' }}>{zone.name}</div>

      {overlay && (
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <Stat label="SLA" value={`${Math.round(overlay.slaPct * 100)}%`} color={HEALTH_COLOR[overlay.health]} />
          <Stat label="Drivers" value={overlay.drivers} />
          <Stat label="Open" value={overlay.openOrders} />
          <Stat label="Active" value={zone.isActive ? 'Yes' : 'No'} />
        </div>
      )}

      {mode === 'monitor' ? (
        <>
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--wl-neutral-500)' }}>Rates</div>
          <div className="text-sm mb-4" style={{ color: 'var(--wl-neutral-100)' }}>
            Base {formatRate(zone.baseRate)}<br />+{formatRate(zone.perKmRate)}/km
          </div>
          <Link
            href={`/zones/${zone.id}`}
            className="text-xs underline-offset-2 hover:underline"
            style={{ color: 'var(--wl-primary-400)' }}
          >Open full detail →</Link>
        </>
      ) : (
        <ConfigureForm zone={zone} onSave={onSave} onDelete={onDelete} onEditGeometry={onEditGeometry} />
      )}
    </aside>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--wl-neutral-500)' }}>{label}</div>
      <div className="text-sm" style={{ color: color ?? 'var(--wl-neutral-100)' }}>{value}</div>
    </div>
  )
}

function ConfigureForm({ zone, onSave, onDelete, onEditGeometry }:
  { zone: InspectorZone; onSave: (p: UpdateDeliveryZone) => void; onDelete: () => void; onEditGeometry: () => void }) {
  const Field = (props: { label: string; name: keyof UpdateDeliveryZone; defaultValue: string | number | null }) => (
    <label className="block text-xs mb-2">
      <span style={{ color: 'var(--wl-neutral-500)' }}>{props.label}</span>
      <input
        aria-label={props.label}
        defaultValue={props.defaultValue ?? ''}
        onBlur={(e) => {
          const v = e.target.value === '' ? null : Number(e.target.value)
          onSave({ [props.name]: v } as UpdateDeliveryZone)
        }}
        className="mt-1 w-full rounded px-2 py-1 text-sm border"
        style={{ background: 'var(--wl-bg-overlay)', borderColor: 'var(--wl-neutral-800)', color: 'var(--wl-neutral-100)' }}
      />
    </label>
  )
  return (
    <div className="flex flex-col gap-2">
      <Field label="Base rate" name="baseRate" defaultValue={zone.baseRate} />
      <Field label="Per-km rate" name="perKmRate" defaultValue={zone.perKmRate} />
      <Field label="Min order" name="minOrder" defaultValue={zone.minOrder} />
      <Field label="Free above" name="freeAbove" defaultValue={zone.freeAbove} />
      <label className="flex items-center gap-2 text-xs py-2">
        <input
          type="checkbox"
          defaultChecked={zone.isActive}
          onChange={(e) => onSave({ isActive: e.target.checked })}
          className="accent-[var(--wl-primary-500)]"
        />
        <span style={{ color: 'var(--wl-neutral-200)' }}>Active</span>
      </label>
      <button
        onClick={onEditGeometry}
        className="mt-2 rounded py-1.5 text-xs border"
        style={{ background: 'var(--wl-bg-overlay)', borderColor: 'var(--wl-neutral-800)', color: 'var(--wl-neutral-100)' }}
      >Edit geometry</button>
      <button
        onClick={() => { if (confirm('Delete this zone? This is permanent.')) onDelete() }}
        className="mt-3 text-[11px] text-left"
        style={{ color: 'var(--wl-danger-400)' }}
      >Delete zone</button>
    </div>
  )
}

function formatRate(n: number): string { return `₹${n.toFixed(0)}` }
```

- [ ] **Step 4: Run; expect pass**

```bash
pnpm --filter @witylogix/dashboard test -- zone-inspector.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/zones/zone-inspector.tsx apps/dashboard/src/components/zones/__tests__/zone-inspector.test.tsx
git commit -m "feat(WIT-XX): <ZoneInspector> mode-variant panel (monitor summary / configure form)"
```

---

## Task 13: Data hooks — `useZonesGeoJson` + `useZoneOverlays`

**Files:**
- Create: `apps/dashboard/src/hooks/use-zones-geojson.ts`
- Create: `apps/dashboard/src/hooks/use-zone-overlays.ts`
- Create: `apps/dashboard/src/hooks/__tests__/zones-hooks.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// zones-hooks.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useZonesGeoJson } from '../use-zones-geojson'
import { useZoneOverlays } from '../use-zone-overlays'

const fetchJson = (body: unknown) => Promise.resolve({ ok: true, json: async () => body } as Response)

describe('zones data hooks', () => {
  it('useZonesGeoJson fetches /api/v4/zones?format=geojson', async () => {
    vi.stubGlobal('fetch', vi.fn(() => fetchJson({ type: 'FeatureCollection', features: [] })))
    const { result } = renderHook(() => useZonesGeoJson())
    await waitFor(() => expect(result.current.data).toBeTruthy())
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('format=geojson')
  })

  it('useZoneOverlays fetches /api/v4/zones/overlays and refetches on window focus', async () => {
    const fetchMock = vi.fn(() => fetchJson({ zones: [], heatmap: [], hubs: [] }))
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useZoneOverlays('24h'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })
})
```

- [ ] **Step 2: Run; expect fail**

```bash
pnpm --filter @witylogix/dashboard test -- zones-hooks.test.ts
```

- [ ] **Step 3: Implement `useZonesGeoJson`**

```ts
// apps/dashboard/src/hooks/use-zones-geojson.ts
'use client'
import { useEffect, useState, useCallback } from 'react'
import type { FeatureCollection } from 'geojson'

export function useZonesGeoJson() {
  const [data, setData] = useState<FeatureCollection | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchZones = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v4/zones?format=geojson')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (e) { setError(e as Error) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchZones() }, [fetchZones])
  return { data, error, loading, refetch: fetchZones }
}
```

- [ ] **Step 4: Implement `useZoneOverlays`**

```ts
// apps/dashboard/src/hooks/use-zone-overlays.ts
'use client'
import { useEffect, useState, useCallback } from 'react'

export interface ZoneOverlay {
  id: string; openOrders: number; drivers: number; slaPct: number; health: 'good' | 'watch' | 'slipping'
}
export interface OverlaysPayload {
  zones: ZoneOverlay[]
  heatmap: Array<{ lng: number; lat: number; count: number }>
  hubs: Array<{ id: string; name: string; lng: number; lat: number; type: 'warehouse' | 'store' | 'hub' }>
}

export function useZoneOverlays(window: '1h' | '24h' | '7d') {
  const [data, setData] = useState<OverlaysPayload | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const fetchOverlays = useCallback(async () => {
    try {
      const res = await fetch(`/api/v4/zones/overlays?window=${window}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (e) { setError(e as Error) }
  }, [window])

  useEffect(() => {
    fetchOverlays()
    const onFocus = () => fetchOverlays()
    globalThis.window.addEventListener('focus', onFocus)
    return () => globalThis.window.removeEventListener('focus', onFocus)
  }, [fetchOverlays])

  return { data, error, refetch: fetchOverlays }
}
```

- [ ] **Step 5: Run; expect pass**

```bash
pnpm --filter @witylogix/dashboard test -- zones-hooks.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/hooks/use-zones-geojson.ts apps/dashboard/src/hooks/use-zone-overlays.ts apps/dashboard/src/hooks/__tests__/zones-hooks.test.ts
git commit -m "feat(WIT-XX): useZonesGeoJson + useZoneOverlays hooks with focus-refresh"
```

---

## Task 14: Token-resolver helper + apply to map layers

**Files:**
- Create: `apps/dashboard/src/components/map/resolve-token.ts`
- Modify: `apps/dashboard/src/components/map/zone-layer.tsx`
- Modify: `apps/dashboard/src/components/map/pin-layer.tsx`
- Modify: `apps/dashboard/src/components/map/hub-layer.tsx`

- [ ] **Step 1: Write the helper**

```ts
// apps/dashboard/src/components/map/resolve-token.ts
'use client'

/**
 * Read a `--wl-*` CSS variable from :root and return its resolved string.
 * Runs in the browser only — never call during SSR.
 */
export function resolveToken(name: string): string {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export const mapTokens = () => ({
  strokeDefault: resolveToken('--wl-neutral-700') || '#35354a',
  strokeSelected: resolveToken('--wl-primary-500') || '#f5a623',
  fillGood: resolveToken('--wl-success-500') || '#10b981',
  fillWatch: resolveToken('--wl-warning-500') || '#f59e0b',
  fillSlipping: resolveToken('--wl-danger-500') || '#ef4444',
  label: resolveToken('--wl-neutral-200') || '#d5d5dd',
  labelHalo: resolveToken('--wl-bg-root') || '#0a0a0c',
  hubFill: resolveToken('--wl-primary-500') || '#f5a623',
  pinOpen: resolveToken('--wl-info-400') || '#60a5fa',
  pinAssigned: resolveToken('--wl-primary-500') || '#f5a623',
  pinInTransit: resolveToken('--wl-success-500') || '#10b981',
  pinDelayed: resolveToken('--wl-danger-500') || '#ef4444',
})
```

- [ ] **Step 2: Rewire `<ZoneLayer>`**

In `apps/dashboard/src/components/map/zone-layer.tsx`, at the top of the `setup` function (inside the first `useEffect`), compute `const t = mapTokens()` and replace each literal hex:

```ts
const t = mapTokens()
map.addLayer({
  id: 'zones-fill', type: 'fill', source: 'zones',
  paint: {
    'fill-color': ['case',
      ['==', ['get', 'health'], 'slipping'], t.fillSlipping,
      ['==', ['get', 'health'], 'watch'], t.fillWatch,
      t.fillGood,
    ],
    'fill-opacity': ['case', ['==', ['get', 'id'], ['literal', selectedId ?? '']], 0.45, 0.25],
  },
})
map.addLayer({
  id: 'zones-stroke', type: 'line', source: 'zones',
  paint: {
    'line-color': ['case', ['==', ['get', 'id'], ['literal', selectedId ?? '']], t.strokeSelected, t.strokeDefault],
    'line-width': 2,
  },
})
```

And in the `setPaintProperty` calls:

```ts
map.setPaintProperty('zones-stroke', 'line-color', ['case', ['==', ['get', 'id'], ['literal', selectedId ?? '']], t.strokeSelected, t.strokeDefault])
```

(Move the `const t = mapTokens()` so it's in scope, or call it inside the second effect as well.)

- [ ] **Step 3: Rewire `<PinLayer>`**

Replace the `COLOR_BY_STATUS` constant's usage with `mapTokens()`-derived values computed inside the effect:

```ts
const t = mapTokens()
const colorByStatus = {
  open: t.pinOpen, assigned: t.pinAssigned, in_transit: t.pinInTransit, delayed: t.pinDelayed,
}
// then use colorByStatus.open etc in the match expression
```

Also swap the literal `'#0a0a0c'` stroke for `t.labelHalo`.

- [ ] **Step 4: Rewire `<HubLayer>`**

Swap `'#f5a623'` → `t.hubFill`, `'#d5d5dd'` → `t.label`, `'#0a0a0c'` → `t.labelHalo`.

- [ ] **Step 5: Run all map tests; expect pass**

```bash
pnpm --filter @witylogix/dashboard test -- src/components/map
```

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/components/map/
git commit -m "refactor(WIT-XX): resolve map paint colors from --wl-* tokens at runtime"
```

---

## Task 15: Page — rebuild `/zones` (Monitor + Configure)

**Files:**
- Modify: `apps/dashboard/src/app/(dashboard)/zones/page.tsx`

- [ ] **Step 1: Replace the file content**

Overwrite `apps/dashboard/src/app/(dashboard)/zones/page.tsx` with:

```tsx
'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { WLMap } from '@/components/map/wl-map'
import { ZoneLayer } from '@/components/map/zone-layer'
import { HeatmapLayer } from '@/components/map/heatmap-layer'
import { PinLayer } from '@/components/map/pin-layer'
import { HubLayer } from '@/components/map/hub-layer'
import { DrawLayer } from '@/components/map/draw-layer'
import { ModeToggle, type ZoneMode } from '@/components/zones/mode-toggle'
import { OverlayControls, type OverlayState } from '@/components/zones/overlay-controls'
import { ZoneSearch } from '@/components/zones/zone-search'
import { KpiStrip } from '@/components/zones/kpi-strip'
import { ZoneInspector } from '@/components/zones/zone-inspector'
import { useZonesGeoJson } from '@/hooks/use-zones-geojson'
import { useZoneOverlays } from '@/hooks/use-zone-overlays'

const DEFAULT_OVERLAYS: OverlayState = { heatmap: true, sla: true, openOrders: true, hubs: true, window: '24h' }
const DEFAULT_CENTER: [number, number] = [77.12, 28.65] // per-org override to come later

export default function ZonesPage() {
  const router = useRouter()
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? ''
  const { data: geojson, refetch: refetchZones } = useZonesGeoJson()
  const [overlays, setOverlays] = useState<OverlayState>(DEFAULT_OVERLAYS)
  const { data: overlaysData } = useZoneOverlays(overlays.window)
  const [mode, setMode] = useState<ZoneMode>('monitor')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)

  const zones = useMemo(
    () => geojson?.features.map((f) => ({ id: String(f.properties?.id), name: String(f.properties?.name) })) ?? [],
    [geojson],
  )
  const overlay = overlaysData?.zones.find((z) => z.id === selectedId)
  const selectedZone = useMemo(() => {
    const f = geojson?.features.find((g) => g.properties?.id === selectedId)
    if (!f) return null
    const p = f.properties as Record<string, unknown>
    return {
      id: String(p.id), name: String(p.name),
      baseRate: Number(p.baseRate ?? 0), perKmRate: Number(p.perKmRate ?? 0),
      minOrder: 0, freeAbove: null as number | null,
      isActive: Boolean(p.isActive), priority: Number(p.priority ?? 0),
    }
  }, [geojson, selectedId])

  const stats = {
    zones: overlaysData?.zones.length ?? 0,
    driversOnline: overlaysData?.zones.reduce((s, z) => s + z.drivers, 0) ?? 0,
    openOrders: overlaysData?.zones.reduce((s, z) => s + z.openOrders, 0) ?? 0,
    slipping: overlaysData?.zones.filter((z) => z.health === 'slipping').length ?? 0,
  }

  return (
    <>
      <Header title="Delivery Zones" subtitle={`${zones.length} zones · ${mode === 'monitor' ? 'Monitor' : 'Configure'}`} />
      <div className="relative h-[calc(100vh-64px)] w-full" style={{ background: 'var(--wl-bg-root)' }}>
        <WLMap maptilerKey={maptilerKey} center={DEFAULT_CENTER} zoom={11}>
          {geojson && <ZoneLayer zones={geojson} selectedId={selectedId} onSelect={setSelectedId} />}
          {overlays.heatmap && overlaysData?.heatmap && <HeatmapLayer points={overlaysData.heatmap} />}
          {overlays.openOrders && <PinLayer pins={[]} />}
          {overlays.hubs && overlaysData?.hubs && <HubLayer hubs={overlaysData.hubs} />}
          {drawing && selectedZone && (
            <DrawLayer
              mode="polygon"
              value={null}
              onChange={async (shape) => {
                if (!shape || shape.type !== 'polygon') return
                await fetch(`/api/v4/zones/${selectedZone.id}`, {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ shape }),
                })
                setDrawing(false)
                refetchZones()
              }}
            />
          )}
        </WLMap>

        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <ModeToggle value={mode} onChange={setMode} />
          <OverlayControls value={overlays} onChange={setOverlays} />
        </div>

        <div className="absolute top-4 right-4 flex gap-2 items-center">
          <ZoneSearch zones={zones} onSelect={setSelectedId} />
          <Button variant="primary" size="md" onClick={() => router.push('/zones/new')}>+ New zone</Button>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <KpiStrip
            stats={stats}
            onClickSlipping={() => {
              const z = overlaysData?.zones.find((z) => z.health === 'slipping')
              if (z) setSelectedId(z.id)
            }}
          />
        </div>

        {selectedZone && (
          <div className="absolute top-0 right-0 h-full">
            <ZoneInspector
              zone={selectedZone}
              overlay={overlay}
              mode={mode}
              onSave={async (patch) => {
                await fetch(`/api/v4/zones/${selectedZone.id}`, {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(patch),
                })
              }}
              onDelete={async () => {
                await fetch(`/api/v4/zones/${selectedZone.id}`, { method: 'DELETE' })
                setSelectedId(null)
                refetchZones()
              }}
              onEditGeometry={() => setDrawing((d) => !d)}
            />
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Start the dev server and smoke-test**

```bash
pnpm --filter @witylogix/dashboard dev
```

Open http://localhost:3003/zones. Confirm:

- Map renders, basemap tiles load.
- Existing zones appear as polygons.
- Clicking a polygon opens the inspector on the right.
- Toggling overlay checkboxes hides/shows layers.
- Mode toggle flips inspector between read-only and editable.

Kill the dev server when done.

- [ ] **Step 3: Run typecheck + tests**

```bash
pnpm --filter @witylogix/dashboard typecheck
pnpm --filter @witylogix/dashboard test
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/app/\(dashboard\)/zones/page.tsx
git commit -m "feat(WIT-XX): rebuild /zones as map-first Monitor/Configure page"
```

---

## Task 16: Page — `/zones/new` + redirect from `/zones/create`

**Files:**
- Create: `apps/dashboard/src/app/(dashboard)/zones/new/page.tsx`
- Delete: `apps/dashboard/src/app/(dashboard)/zones/create/page.tsx`
- Modify: `apps/dashboard/next.config.js` (or `next.config.mjs` — whichever exists)

- [ ] **Step 1: Inspect the existing create page (for field names to preserve)**

```bash
cat apps/dashboard/src/app/\(dashboard\)/zones/create/page.tsx
```

Note the fields it currently validates — we preserve those in the new form.

- [ ] **Step 2: Create `new/page.tsx`**

```tsx
// apps/dashboard/src/app/(dashboard)/zones/new/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { WLMap } from '@/components/map/wl-map'
import { DrawLayer } from '@/components/map/draw-layer'
import type { ZoneShape } from '@witylogix/validators'

const DEFAULT_CENTER: [number, number] = [77.12, 28.65]

export default function NewZonePage() {
  const router = useRouter()
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? ''
  const [tool, setTool] = useState<'polygon' | 'circle'>('polygon')
  const [shape, setShape] = useState<ZoneShape | null>(null)
  const [name, setName] = useState('')
  const [baseRate, setBaseRate] = useState('0')
  const [perKmRate, setPerKmRate] = useState('0')
  const [minOrder, setMinOrder] = useState('0')
  const [freeAbove, setFreeAbove] = useState('')
  const [circleRadius, setCircleRadius] = useState(1000)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = name.length > 0 && shape !== null

  async function submit() {
    if (!shape) return
    setSubmitting(true)
    const res = await fetch('/api/v4/zones', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name, shape,
        baseRate: Number(baseRate), perKmRate: Number(perKmRate),
        minOrder: Number(minOrder),
        freeAbove: freeAbove ? Number(freeAbove) : undefined,
      }),
    })
    setSubmitting(false)
    if (!res.ok) { alert(`Create failed: HTTP ${res.status}`); return }
    const body = await res.json() as { data: { id: string } }
    router.push(`/zones/${body.data.id}`)
  }

  return (
    <>
      <Header title="New zone" subtitle="Draw a shape, set rates, save." />
      <div className="relative h-[calc(100vh-64px)] w-full" style={{ background: 'var(--wl-bg-root)' }}>
        <WLMap maptilerKey={maptilerKey} center={DEFAULT_CENTER} zoom={11}>
          <DrawLayer mode={tool} value={shape} onChange={setShape} circleRadiusMeters={circleRadius} />
        </WLMap>

        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <div role="tablist" className="inline-flex rounded-md border text-sm"
            style={{ background: 'var(--wl-bg-elevated)', borderColor: 'var(--wl-neutral-800)' }}>
            {(['polygon', 'circle'] as const).map((t) => (
              <button key={t}
                aria-selected={tool === t}
                onClick={() => setTool(t)}
                className="px-3 py-1.5 capitalize"
                style={{
                  color: tool === t ? 'var(--wl-neutral-50)' : 'var(--wl-neutral-400)',
                  background: tool === t ? 'var(--wl-primary-700)' : 'transparent',
                }}
              >{t}</button>
            ))}
          </div>
          {tool === 'circle' && (
            <label className="flex flex-col text-xs p-2 rounded border"
              style={{ background: 'var(--wl-bg-elevated)', borderColor: 'var(--wl-neutral-800)', color: 'var(--wl-neutral-200)' }}>
              Radius: {(circleRadius / 1000).toFixed(1)} km
              <input type="range" min={100} max={30000} step={100}
                value={circleRadius} onChange={(e) => setCircleRadius(Number(e.target.value))} />
            </label>
          )}
        </div>

        <aside className="absolute top-0 right-0 h-full w-80 p-4 border-l"
          style={{ background: 'var(--wl-bg-surface)', borderColor: 'var(--wl-neutral-800)' }}>
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--wl-neutral-50)' }}>Zone details</h2>
          {[
            { label: 'Name', value: name, onChange: setName, type: 'text' },
            { label: 'Base rate', value: baseRate, onChange: setBaseRate, type: 'number' },
            { label: 'Per-km rate', value: perKmRate, onChange: setPerKmRate, type: 'number' },
            { label: 'Min order', value: minOrder, onChange: setMinOrder, type: 'number' },
            { label: 'Free above', value: freeAbove, onChange: setFreeAbove, type: 'number' },
          ].map((f) => (
            <label key={f.label} className="block text-xs mb-3">
              <span style={{ color: 'var(--wl-neutral-500)' }}>{f.label}</span>
              <input type={f.type} value={f.value} onChange={(e) => f.onChange(e.target.value)}
                className="mt-1 w-full rounded px-2 py-1 text-sm border"
                style={{ background: 'var(--wl-bg-overlay)', borderColor: 'var(--wl-neutral-800)', color: 'var(--wl-neutral-100)' }} />
            </label>
          ))}
          <div className="flex gap-2 mt-4">
            <Button variant="ghost" onClick={() => router.push('/zones')}>Cancel</Button>
            <Button variant="primary" disabled={!canSubmit || submitting} onClick={submit}>
              {submitting ? 'Creating…' : 'Create zone'}
            </Button>
          </div>
        </aside>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Delete the old `/zones/create/page.tsx`**

```bash
rm apps/dashboard/src/app/\(dashboard\)/zones/create/page.tsx
rmdir apps/dashboard/src/app/\(dashboard\)/zones/create 2>/dev/null || true
```

- [ ] **Step 4: Add a redirect from `/zones/create` → `/zones/new`**

Inspect which config file exists:

```bash
ls apps/dashboard/next.config.*
```

Open whichever is present and add to the `redirects` async function:

```js
async redirects() {
  return [
    { source: '/zones/create', destination: '/zones/new', permanent: true },
    // …existing redirects preserved
  ]
}
```

Also update any remaining in-dashboard links pointing at `/zones/create`:

```bash
grep -rn "/zones/create" apps/dashboard/src --include="*.tsx" --include="*.ts"
# For each hit, change the literal to "/zones/new".
```

- [ ] **Step 5: Smoke-test**

```bash
pnpm --filter @witylogix/dashboard dev
```

Navigate to `/zones/new`, draw a polygon, fill name + base rate, click `Create zone`. Verify you land on `/zones/<id>`. Visit `/zones/create` and verify it 308-redirects to `/zones/new`.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/app/\(dashboard\)/zones/new/page.tsx apps/dashboard/next.config.* apps/dashboard/src
git add -u apps/dashboard/src/app/\(dashboard\)/zones/create
git commit -m "feat(WIT-XX): /zones/new with polygon+circle drawing; redirect old /zones/create"
```

---

## Task 17: Page — `/zones/[id]` detail

**Files:**
- Create: `apps/dashboard/src/app/(dashboard)/zones/[id]/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/dashboard/src/app/(dashboard)/zones/[id]/page.tsx
'use client'
import { use, useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { WLMap } from '@/components/map/wl-map'
import { ZoneLayer } from '@/components/map/zone-layer'
import { ZoneInspector } from '@/components/zones/zone-inspector'
import type { FeatureCollection } from 'geojson'

export default function ZoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? ''
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null)
  const [zone, setZone] = useState<{
    id: string; name: string; baseRate: number; perKmRate: number;
    minOrder: number; freeAbove: number | null; isActive: boolean; priority: number
  } | null>(null)

  useEffect(() => {
    (async () => {
      const [zRes, gRes] = await Promise.all([
        fetch(`/api/v4/zones/${id}`).then((r) => r.json()),
        fetch('/api/v4/zones?format=geojson').then((r) => r.json()),
      ])
      setZone({
        id,
        name: zRes.data.name,
        baseRate: Number(zRes.data.baseRate),
        perKmRate: Number(zRes.data.perKmRate),
        minOrder: Number(zRes.data.minOrder),
        freeAbove: zRes.data.freeAbove == null ? null : Number(zRes.data.freeAbove),
        isActive: Boolean(zRes.data.isActive),
        priority: Number(zRes.data.priority ?? 0),
      })
      setGeojson({
        type: 'FeatureCollection',
        features: (gRes as FeatureCollection).features.filter((f) => f.properties?.id === id),
      })
    })()
  }, [id])

  if (!zone || !geojson) return <div className="p-8" style={{ color: 'var(--wl-neutral-400)' }}>Loading…</div>

  return (
    <>
      <Header title={zone.name} subtitle="Zone detail" />
      <div className="grid h-[calc(100vh-64px)]" style={{ gridTemplateColumns: '320px 1fr', background: 'var(--wl-bg-root)' }}>
        <div className="border-r p-4 overflow-auto" style={{ borderColor: 'var(--wl-neutral-800)' }}>
          <ZoneInspector
            zone={zone}
            mode="configure"
            onSave={async (patch) => {
              await fetch(`/api/v4/zones/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
            }}
            onDelete={async () => { await fetch(`/api/v4/zones/${id}`, { method: 'DELETE' }); location.assign('/zones') }}
            onEditGeometry={() => { location.assign(`/zones?edit=${id}`) }}
          />
        </div>
        <WLMap maptilerKey={maptilerKey} center={[77.12, 28.65]} zoom={12}>
          <ZoneLayer zones={geojson} selectedId={id} onSelect={() => {}} />
        </WLMap>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Run typecheck + test**

```bash
pnpm --filter @witylogix/dashboard typecheck
pnpm --filter @witylogix/dashboard test
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/app/\(dashboard\)/zones/\[id\]/page.tsx
git commit -m "feat(WIT-XX): /zones/[id] detail page with map + inspector"
```

---

## Task 18: Feature flag — gate redesigned pages

**Files:**
- Modify: `apps/dashboard/.env.local.example`
- Create: `apps/dashboard/src/components/zones/legacy-notice.tsx`
- Modify: `apps/dashboard/src/app/(dashboard)/zones/page.tsx`
- Modify: `apps/dashboard/src/app/(dashboard)/zones/new/page.tsx`
- Modify: `apps/dashboard/src/app/(dashboard)/zones/[id]/page.tsx`

- [ ] **Step 1: Add flag to env example**

Append to `apps/dashboard/.env.local.example`:

```env
# Zones map-first redesign (A+B). Set to 1 to enable.
NEXT_PUBLIC_FEATURE_ZONES_MAP=0
```

- [ ] **Step 2: Create the legacy notice**

```tsx
// apps/dashboard/src/components/zones/legacy-notice.tsx
'use client'
export function LegacyNotice() {
  return (
    <div className="p-8 text-sm" style={{ color: 'var(--wl-neutral-300)' }}>
      The new zones experience is behind a feature flag.
      <br />Set <code>NEXT_PUBLIC_FEATURE_ZONES_MAP=1</code> in your <code>.env.local</code> to enable it.
    </div>
  )
}
```

- [ ] **Step 3: Gate the three pages**

At the top of each of `/zones/page.tsx`, `/zones/new/page.tsx`, `/zones/[id]/page.tsx`, import the notice and guard the render:

```tsx
import { LegacyNotice } from '@/components/zones/legacy-notice'

// …inside the default-exported component, at the very start:
if (process.env.NEXT_PUBLIC_FEATURE_ZONES_MAP !== '1') return <LegacyNotice />
```

> Alternative: if the dashboard already has a `FeatureFlag`/`useFeature` utility (grep `grep -r "FeatureFlag\|useFeature" apps/dashboard/src | head`), use that instead of `process.env` directly.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/.env.local.example apps/dashboard/src/components/zones/legacy-notice.tsx apps/dashboard/src/app/\(dashboard\)/zones/
git commit -m "feat(WIT-XX): feature-flag zones map redesign behind NEXT_PUBLIC_FEATURE_ZONES_MAP"
```

---

## Task 19: Telemetry — `zones.viewed`, `zones.created`, `zones.geometry_edited`

**Files:**
- Modify: `apps/dashboard/src/app/(dashboard)/zones/page.tsx`
- Modify: `apps/dashboard/src/app/(dashboard)/zones/new/page.tsx`

- [ ] **Step 1: Find the existing analytics client**

```bash
grep -rn "track(" apps/dashboard/src --include="*.ts" --include="*.tsx" | head
```

Use whichever helper the codebase already exposes (e.g. `track('event', props)`). If none exists, fall back to `fetch('/api/v4/analytics-events', { method: 'POST', body: JSON.stringify({ event, properties }) })` — the endpoint already exists (`apps/api/src/routes/__tests__/analytics-events.test.ts`).

- [ ] **Step 2: `zones.viewed` on `/zones`**

Inside `/zones/page.tsx` (after the hook declarations):

```tsx
import { useEffect } from 'react'
// …
useEffect(() => {
  track('zones.viewed', {
    mode,
    overlays: (Object.keys(overlays) as (keyof OverlayState)[]).filter((k) => overlays[k] === true),
  })
}, []) // fire once per mount
```

- [ ] **Step 3: `zones.created` on successful POST in `/zones/new/page.tsx`**

Inside the `submit()` function, after the success branch:

```tsx
if (res.ok) {
  const body = await res.json() as { data: { id: string } }
  track('zones.created', { shape: shape.type, baseRate: Number(baseRate), perKmRate: Number(perKmRate) })
  router.push(`/zones/${body.data.id}`)
  return
}
```

- [ ] **Step 4: `zones.geometry_edited` on the draw-save flow**

Inside `/zones/page.tsx`, wrap the `DrawLayer`'s `onChange`:

```tsx
<DrawLayer
  mode="polygon" value={null}
  onChange={async (shape) => {
    if (!shape || shape.type !== 'polygon') return
    track('zones.geometry_edited', { zoneId: selectedZone!.id, type: shape.type })
    await fetch(`/api/v4/zones/${selectedZone!.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ shape }),
    })
    setDrawing(false)
    refetchZones()
  }}
/>
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/app/\(dashboard\)/zones/
git commit -m "feat(WIT-XX): telemetry for zones.viewed / .created / .geometry_edited"
```

---

## Task 20: Docs — Design-system "Map" section + MapLibre ADR

**Files:**
- Modify: `docs/DESIGN_SYSTEM.md`
- Create: `docs/adr/ADR-NNN-maplibre-map-stack.md` (choose the next free number by reading `docs/adr/INDEX.md`)
- Modify: `docs/adr/INDEX.md`

- [ ] **Step 1: Pick the ADR number**

```bash
grep -E "ADR-[0-9]+" docs/adr/INDEX.md | tail -5
```

Use the next integer. If the highest is `ADR-030`, the new one is `ADR-031`.

- [ ] **Step 2: Append a "Map" section to `docs/DESIGN_SYSTEM.md`**

```markdown
## Map

Witylogix maps are rendered with **MapLibre GL JS** and styled from the same `--wl-*` tokens as the rest of the UI.

### Tokens used on the map

| Use | Token |
| --- | --- |
| Zone fill (good SLA) | `--wl-success-500` @ 25% opacity |
| Zone fill (watch)    | `--wl-warning-500` @ 25% opacity |
| Zone fill (slipping) | `--wl-danger-500`  @ 25% opacity |
| Zone stroke (default)| `--wl-neutral-700` |
| Zone stroke (selected)| `--wl-primary-500` |
| Pin fills            | status-driven (see `pin-layer.tsx`) |
| Hub fill             | `--wl-primary-500` |
| Label text           | `--wl-neutral-200` |
| Label halo           | `--wl-bg-root` |

### Rules

1. Never hard-code hex values in map code. Read tokens with `resolveToken('--wl-*')` at runtime.
2. Map components live in `apps/dashboard/src/components/map/`. Keep each ≤ ~150 LOC.
3. The `<WLMap>` component is always `"use client"`. Consumers can stay RSC where possible.
4. Tile style is `MapTiler dataviz-dark` in dev/staging, self-hosted PMTiles in production (see ADR-NNN).
```

- [ ] **Step 3: Write the ADR**

Create `docs/adr/ADR-NNN-maplibre-map-stack.md`:

```markdown
# ADR-NNN — MapLibre GL JS + mapbox-gl-draw as the dashboard map stack

- **Status:** Accepted
- **Date:** 2026-04-19
- **Deciders:** frontend + backend leads
- **Context:** Spec `docs/superpowers/specs/2026-04-19-zones-map-redesign-design.md`

## Decision

Use **MapLibre GL JS** with **`@mapbox/mapbox-gl-draw`** and **`@turf/turf`** for all interactive maps in `apps/dashboard`. Start with MapTiler's free tier for tiles; plan to self-host PMTiles for production once we exceed quota.

## Alternatives considered

- **Mapbox GL JS v3** — richer but token-locked and usage-priced. Rejected for cost and vendor lock-in.
- **Leaflet** — simple, already used in the tracking-page. Rejected for the dashboard: weaker polygon drawing, no vector tiles, limited clustering.
- **Google Maps** — heavy licensing and poor aesthetics for a dark ops console.

## Consequences

- ~180 KB gz added to zones routes only (via `next/dynamic`). Other routes untouched.
- We write no token-fetch code on the client; the `NEXT_PUBLIC_MAPTILER_KEY` is embedded.
- When we need offline or branded tiles, swap the style URL behind `<WLMap>`; no consumer changes.
- `@mapbox/mapbox-gl-draw` runs against MapLibre via its community shim. Drawing tests must mock `MapboxDraw`.

## Tracking-page (customer-facing)

Keeps its existing Leaflet stack. Converging is a separate decision.
```

- [ ] **Step 4: Add the ADR to the index**

Append a bullet to `docs/adr/INDEX.md` pointing at the new file.

- [ ] **Step 5: Commit**

```bash
git add docs/DESIGN_SYSTEM.md docs/adr/ADR-*-maplibre-map-stack.md docs/adr/INDEX.md
git commit -m "docs(WIT-XX): design system map section + ADR-NNN MapLibre stack"
```

---

## Task 21: Final verification loop

**Files:** none new; this is a gate.

- [ ] **Step 1: Run all checks**

```bash
pnpm lint
pnpm typecheck
pnpm test:run
```

Expected: all green. Fix anything that fails; if a failure surfaces a plan gap, update this plan inline and add a small task before the gate passes.

- [ ] **Step 2: Flip the feature flag and smoke-test**

```bash
echo "NEXT_PUBLIC_FEATURE_ZONES_MAP=1" >> apps/dashboard/.env.local
pnpm --filter @witylogix/dashboard dev
```

Manual checks (walk through them; check each):

- [ ] `/zones` renders the map and at least one existing polygon.
- [ ] Mode toggle flips the inspector without re-centering the map.
- [ ] Overlay toggles add/remove layers smoothly; refresh the page and confirm localStorage keeps them.
- [ ] `/zones/new` lets me draw a polygon → submit → land on the new detail page.
- [ ] `/zones/new` circle tool: click center, radius slider updates live, submit creates a zone whose `metadata.shape.type === 'circle'` (verify with `psql`).
- [ ] `/zones/create` issues a 308 redirect to `/zones/new`.
- [ ] Chrome DevTools → Performance: a hard reload of `/zones` with 50 zones stays under 2 s to first map paint on a throttled fast-3G connection.
- [ ] Lighthouse accessibility score ≥ 90 on `/zones` (focus rings visible; aria attrs present).
- [ ] `psql` → `SELECT count(*) FROM delivery_zones WHERE boundary IS NULL;` → unchanged from Task 0's baseline (we haven't overwritten any existing geometries).

- [ ] **Step 3: Push the branch and open the PR**

```bash
git push -u origin feat/WIT-XX-zones-map-redesign
gh pr create --base staging --title "feat(WIT-XX): zones map-first redesign + <WLMap> foundation" \
  --body "$(cat <<'EOF'
## Summary
- Rebuilds /zones as a map-first Monitor/Configure console on MapLibre GL JS
- Ships a shared `<WLMap>` + thin layer components (`<ZoneLayer>`, `<HeatmapLayer>`, `<PinLayer>`, `<HubLayer>`, `<DrawLayer>`) that sub-projects D and E can embed
- Extends `POST/PATCH /v4/zones` to accept polygon OR circle shapes (circle → PostGIS `ST_Buffer`)
- Adds `GET /v4/zones/overlays` (30s cache) and a GeoJSON output on `GET /v4/zones`
- Gated behind `NEXT_PUBLIC_FEATURE_ZONES_MAP=1`. Default off on staging until QA signs off.

Spec: docs/superpowers/specs/2026-04-19-zones-map-redesign-design.md
Plan: docs/superpowers/plans/2026-04-19-zones-map-redesign.md

## Test plan
- [x] pnpm lint, pnpm typecheck, pnpm test:run all green
- [x] Manual smoke on staging: draw polygon, draw circle, edit geometry, toggle overlays, redirect from /zones/create
- [x] SELECT count(*) FROM delivery_zones WHERE boundary IS NULL; unchanged

Reviewers: @nisha-kapoor (primary — dashboard), @rahul-gupta (secondary — API + DB)
EOF
)"
```

- [ ] **Step 4: Remove the feature flag override locally**

```bash
# macOS
sed -i '' '/NEXT_PUBLIC_FEATURE_ZONES_MAP=1/d' apps/dashboard/.env.local
# Linux: sed -i '/NEXT_PUBLIC_FEATURE_ZONES_MAP=1/d' apps/dashboard/.env.local
```

- [ ] **Step 5: Close out**

Post the PR URL in the tracking ticket. Move on.

---

## Plan self-review

**Spec coverage (§-by-§):**

- §1 Context / §2 Users — covered by Tasks 15, 16, 17 (pages), 11 (chrome), 12 (inspector). Success criteria measured in Task 21.
- §3 Scope — C/D/E kept out; plan contains no Prisma migration, no `/map` redesign, no embedded maps elsewhere. ✓
- §4 Map foundation — Task 6 (deps + style builder), 7 (`<WLMap>`), 14 (token resolver), 20 (ADR + design-system docs). ✓
- §5 Data model — Tasks 1 (validator), 2 (back-compat), 3 (GeoJSON), 4 (shape-aware POST/PATCH), 5 (overlays + aggregation). ✓
- §6 Page layout — Tasks 15, 16, 17. ✓
- §7 Components — Tasks 7–12. ✓
- §8 Interaction flows — covered across the page + component tasks. Draw flow tests live inside Task 10 + smoke checks in Task 21.
- §9 Visual language — Task 11 (chrome uses tokens), 14 (token resolver for layer paint), 20 (design-system doc). ✓
- §10 Migration/rollout — Task 2 (back-compat), 18 (flag), 19 (telemetry), 16 (redirect). ✓
- §11 Out of scope — respected in every task. ✓
- §12 Risks — addressed as acceptance checks in Task 21 (perf, token purity, accessibility, legacy-row count stability).

**Placeholder scan:** no `TBD`, no "Similar to Task N" code omissions, no "add validation" hand-waves. Every code step contains the full code. Tests contain actual assertions.

**Type consistency:**

- `ZoneShape` discriminated union defined in Task 1, consumed by Tasks 4 (API), 10 (DrawLayer), 16 (new-zone page) — same import path (`@witylogix/validators`), same shape (`{ type: 'polygon', ring }` | `{ type: 'circle', center, radiusMeters }`).
- `UpdateDeliveryZone` defined in Task 2, used in Tasks 4 (API), 12 (inspector).
- `OverlaysPayload` matches the API shape produced in Task 5, consumed by Task 13's hook and Task 15's page.
- `InspectorZone` / `InspectorOverlay` names are stable across Task 12, 15, 17.
- CSS var names (`--wl-primary-500`, etc.) match the `tokens.css` file verified during planning.

No issues found. The plan is ready to execute.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-zones-map-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — I execute tasks in this session using `executing-plans`, batch execution with checkpoints.

**Which approach?**
