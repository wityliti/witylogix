# Zones + Map Foundation — Design Spec

- **Date:** 2026-04-19
- **Scope:** Sub-project **A + B** only (Map foundation + Zones page redesign)
- **Deferred to follow-on specs:** C (zone geometry persistence ergonomics), D (live ops map at `/map`), E (map embeds on order / shipment / route / driver / location pages)
- **Status:** Design. Implementation plan to be generated via `writing-plans` after approval.

---

## 1. Context and goals

Witylogix is a logistics platform. The map is the truest expression of the product — it is where zones live, where drivers move, where orders happen, where SLAs are kept or missed. Today the product barely uses it.

- `/zones` is a dark card grid with no map at all (`apps/dashboard/src/app/(dashboard)/zones/page.tsx`). A dispatcher cannot tell from this page whether a zone is busy, healthy, or empty.
- `/zones/create` is a four-field form with no geometry picker. The DB schema has a `boundary` column and the API already persists PostGIS polygons, but the UI has no way to draw one.
- `/map` uses a custom SVG pseudo-map with pretend lat/lng. It is a mockup, not an ops tool.
- Across the dashboard, colors and borders are hard-coded (`bg-[#0a0a0f]`, `border-blue-500`) instead of `wl.*` tokens. The design system is architecturally sound but inconsistently applied.

**Goals for A + B:**

1. Make the zones page the first place in the product where the map is the hero.
2. Ship one shared `<WLMap>` component that other pages (sub-projects D and E) will embed without rewrites.
3. Let ops users draw real zone geometry (polygons and circles) and see live signals at a glance.
4. Raise the design-system bar where we touch: use `wl.*` tokens consistently, keep the dark theme coherent, hit WCAG AA.

**Non-goals:**

- Redesigning `/map` (sub-project D).
- Embedding maps in order/shipment/route/driver/location detail pages (sub-project E).
- Reworking the rate engine, billing, Fleetbase sync, or the tracking-page (a separate Vite app that keeps its Leaflet stack).

---

## 2. Users and jobs

The zones page serves two jobs with roughly equal weight:

1. **Ops configurer / founder** — Opens `/zones` occasionally. Defines coverage areas, edits rate cards, toggles zones on and off, creates new zones when the business expands. Wants precision and clarity, tolerates a longer session.
2. **Daily dispatcher** — Opens `/zones` every shift. Watches which zones are hot, which are slipping, which have no driver nearby, where demand is spiking. Wants a single glance to answer "is this zone healthy?"

The design keeps both on one page. A **mode toggle** (`Monitor` / `Configure`) in the top-left swaps the inspector's content and reveals editing affordances, but the map canvas, zones, and overlays do not change. This avoids the "two pages pretending to be one" feel and lets a configurer verify their change against live data without navigating away.

**Success criteria:**

- A dispatcher can answer "which zone is slipping right now?" in ≤ 5 seconds on `/zones`.
- An ops configurer can create a new zone with a drawn polygon, base rate, and per-km rate in ≤ 60 seconds.
- Zero hard-coded hex values or default Tailwind palettes in the zones UI — all styling flows through `wl.*` tokens.

---

## 3. Scope

**In scope (this spec, A + B):**

| Area | Deliverable |
| --- | --- |
| Dependencies | Add `maplibre-gl`, `@mapbox/mapbox-gl-draw`, `@turf/turf` to `apps/dashboard` |
| Component | New `<WLMap>` React component package (tokens-styled, controlled, headless-friendly) |
| Pages | Rebuild `/zones`, `/zones/new`, `/zones/[id]` in the dashboard |
| API | Add overlay read endpoints + extend `createDeliveryZoneSchema` to support `circle` shape |
| Design system | Document map tokens in `docs/DESIGN_SYSTEM.md`; fix hard-coded colors on touched pages |

**Deferred:**

- **C · Zone geometry persistence ergonomics** — Prisma cannot describe `geometry(Polygon, 4326)`, so the schema still carries a `TODO` comment. A follow-on spec will switch the Prisma schema to `Unsupported("geometry(...)")?`, generate GeoJSON directly from Postgres, and remove the raw-SQL round trip in `apps/api/src/routes/zones.ts`. **Important:** the database *already* stores real PostGIS geometry; the API reads/writes it via `ST_GeomFromText` and `ST_Contains`. A + B depends on no changes here.
- **D · Live ops upgrade on `/map`** — Replace the SVG pseudo-map with `<WLMap>` plus driver pins, route lines, and clustering. Uses this spec's foundation unchanged.
- **E · Map embeds** — Order, shipment, route, driver, and location-settings pages render a small `<WLMap>` with relevant context (origin/destination pin, delivery polygon, driver route). Uses this spec's foundation unchanged.

---

## 4. Map foundation

### 4.1 Library choice

**MapLibre GL JS + `@mapbox/mapbox-gl-draw`**.

| Option | Verdict |
| --- | --- |
| **MapLibre GL JS** (chosen) | Open-source fork of Mapbox GL JS v1. No token. Vector tiles. Smooth drawing. Compatible with `mapbox-gl-draw` via shim. Widely used in logistics tooling (HERE, Grab, Stuart). |
| Mapbox GL JS v3 | Polished, but locked behind token + per-session usage pricing. Unnecessary for v1. |
| Leaflet | Simple and lightweight but weaker for polygon drawing, no vector tiles, poor clustering at scale. The tracking-page (Vite app) already uses Leaflet — we leave it alone. |
| Google Maps | Heavy license, opinionated styling, poor fit for a dark ops console. |

### 4.2 Tile source

- **Dev / staging:** MapTiler free tier with our API key in `NEXT_PUBLIC_MAPTILER_KEY` (`apps/dashboard/.env.local`).
- **Production:** Self-host `planetiler`-built PMTiles behind the API once we exceed free-tier quotas. The `<WLMap>` `styleUrl` prop makes the swap invisible to consumers. This is a production-readiness task, not a blocker for shipping A + B to staging.
- The tile style is a dark, neutral basemap (MapTiler "Backdrop Dark" or equivalent) that our overlays can sit on without fighting the design system.

### 4.3 The `<WLMap>` component

Lives in a new package: `packages/wl-map` (or `apps/dashboard/src/components/map/` if we prefer to keep it colocated for v1 — see §12). Exports:

```tsx
<WLMap
  center={[lng, lat]}
  zoom={12}
  styleUrl={wlMapStyle.dark}
  interactive={true}
  cursor="default" | "crosshair" | "grab"
  onViewportChange={(vp) => ...}
>
  <ZoneLayer zones={zones} selectedId={...} onSelect={...} />
  <HeatmapLayer points={demandPoints} weight="count" />
  <PinLayer pins={openOrders} popover={OrderPopover} />
  <HubLayer hubs={hubs} />
  <DrawLayer mode="polygon" | "circle" | null onChange={setGeom} />
</WLMap>
```

Principles:

- **Tokens as source of truth.** Map fills, strokes, heat ramp, and pin colors derive from `wl.color.*` CSS vars. The MapLibre style JSON is templated with these at build time by a small utility (`apps/dashboard/src/styles/wl-map-style.ts`).
- **Controlled.** Consumers own state (selected zone, draw mode, viewport). `<WLMap>` has no internal selection or data store.
- **Layer components are thin.** They take data in, declaratively render MapLibre sources/layers, and clean up on unmount. No imperative code in consumers.
- **Tree-shakable.** Consumers only import the layers they use. Sub-project E pages will only pull `<PinLayer>`, for example.
- **Server-component safe.** `<WLMap>` is `"use client"`; consumers can be RSC by default.

---

## 5. Data model

### 5.1 What exists today

```prisma
model DeliveryZone {
  id        String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orgId     String? @db.Uuid
  shopId    String? @db.Uuid
  name      String
  boundary  Json?   // Written via raw SQL: ST_GeomFromText('POLYGON(...)', 4326)
  baseRate  Decimal @default(0) @db.Decimal(10, 2)
  perKmRate Decimal @default(0) @db.Decimal(10, 2)
  minOrder  Decimal @default(0) @db.Decimal(10, 2)
  freeAbove Decimal? @db.Decimal(10, 2)
  isActive  Boolean @default(true)
  priority  Int     @default(0)
  metadata  Json    @default("{}")
}
```

- The Postgres column is `geometry(Polygon, 4326)` — Prisma just can't describe it.
- The API uses raw SQL to read/write polygons and to run point-in-polygon queries in `/v4/zones/check`.
- The `createDeliveryZoneSchema` validator accepts `boundary: Array<{latitude, longitude}>` (≥ 3 points).

### 5.2 Changes for A + B

1. **Extend `createDeliveryZoneSchema` to a discriminated union** that accepts either a polygon ring or a circle descriptor, persisted in the existing `boundary` column.

   ```ts
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
   ```

   A circle is persisted by buffering `center` by `radiusMeters` into a polygon via PostGIS `ST_Buffer(ST_GeomFromText('POINT(...)', 4326)::geography, r)::geometry`. The UI round-trips the circle by reading `metadata.shape = { type: 'circle', center, radiusMeters }` so subsequent edits stay a circle. Losing the original descriptor is acceptable as a v1 edge case (user re-draws).
2. **Add a `GET /v4/zones/overlays` endpoint** returning, per zone, precomputed overlay data for the dashboard:

   ```json
   {
     "zones": [
       {
         "id": "uuid",
         "openOrders": 12,
         "drivers": 4,
         "slaPct": 0.92,
         "health": "good"
       }
     ],
     "heatmap": [
       { "lng": 77.12, "lat": 28.65, "count": 17 }
     ],
     "hubs": [
       { "id": "uuid", "name": "South DC", "lng": 77.08, "lat": 28.57, "type": "warehouse" }
     ]
   }
   ```

   Backed by aggregations over `Order`, `Shipment`, and `Driver` tables, scoped by org/shop. Cached with a 30 s in-memory TTL per org to keep the page cheap. Refresh is manual (button) or on window focus; no websockets in v1.
3. **Add `GET /v4/zones` GeoJSON mode** — the existing endpoint returns an internal shape. Add an `Accept: application/geo+json` branch (or `?format=geojson` query) that emits a `FeatureCollection` the `<ZoneLayer>` consumes directly. No schema change, just a formatter.
4. **No Prisma migration.** We stay on the current `Json?` column; polygons are already persisted correctly via raw SQL. Sub-project C is free to tidy the Prisma typing later.

### 5.3 Aggregation sources

- `openOrders` — `Order` rows `status IN ('pending', 'assigned', 'picked_up')` with a lat/lng inside the zone's boundary (PostGIS `ST_Contains`).
- `drivers` — `Driver` rows with recent location pings inside the zone in the last N minutes (config, default 10).
- `slaPct` — share of orders completed within SLA window for the current day, zone-scoped.
- `heatmap` — order locations (lng, lat) for the selected window (1h/24h/7d), returned as a weighted point set.

---

## 6. Page layout

### 6.1 `/zones` — Monitor mode (default)

- **Full-bleed map** occupies the entire viewport under the dashboard chrome. No gutters.
- **Top-left floating control cluster:**
  - Mode toggle: `● Monitor` / `Configure` (pill, animated).
  - Overlay checklist card: `☑ Heatmap · ☑ SLA tint · ☑ Open orders · ☑ Hubs`. Each toggle is state-persisted in `localStorage` per user.
  - Time window for demand heatmap: `1 h / 24 h / 7 d`.
- **Top-right floating cluster:**
  - Zone search (`wl-input` styled). Fuzzy match on name; select a result to fly the map to it.
  - `+ New zone` primary button (`wl-btn-primary`) — launches `/zones/new`.
- **Right inspector panel (320 px, slides in):** appears when a zone is selected. Shows name, SLA %, driver count, open orders, base + per-km rates, active status, and a muted "Open full detail →" link to `/zones/[id]`. In Monitor mode, rates are read-only.
- **Bottom-center KPI strip:** `4 zones · 13 drivers online · 47 open orders · 1 slipping` (amber if > 0). Click the slipping pill to filter the map to that zone.
- **Fallback / empty state:** if the org has zero zones, show a centered card with "Your map is empty" and a primary `+ Draw your first zone` CTA.

### 6.2 `/zones` — Configure mode

Same canvas. The inspector panel's content changes:

- Editable name (inline).
- Editable rate fields (base, per-km, min order, free-above) with save-on-blur.
- On/off switch for `isActive`.
- `Edit geometry` button — toggles draw/edit mode on the map. Vertex handles appear on the polygon; dragging commits to a new `boundary`. A `Cancel` / `Save` pair sits at the bottom of the inspector during edits.
- "Delete zone" lives in an overflow menu, protected by a confirm dialog.

Switching modes does **not** re-center the map or lose selection. It is the cheapest possible UI switch.

### 6.3 `/zones/new`

Full-bleed map with a permanent inspector (right side) and a prominent tool toolbar (top-left):

- **Shape picker:** `Polygon` / `Circle`. Defaults to Polygon.
- **Polygon tool:** click to drop vertices, double-click to close. Standard `mapbox-gl-draw` behavior, restyled to `wl` tokens.
- **Circle tool:** click the center, drag to set radius. Live radius readout in meters / km.
- The inspector carries the rate/activation form. The `Create zone` primary button activates only when name is present and shape has ≥ 3 vertices (polygon) or a nonzero radius (circle).
- Cancel returns to `/zones` with no state written.

### 6.4 `/zones/[id]`

- Detail page for a single zone. Map is prominent but smaller (~70% width) with a left detail column.
- Left column: full rate card, time-slot bindings (`TimeSlot` relation), assigned drivers, last 30-day order volume sparkline, SLA trend.
- Edit actions match the `/zones` Configure inspector, scaled up for the larger surface.

---

## 7. Components

All live under `apps/dashboard/src/components/map/` in v1. If/when a second app needs them we promote to `packages/wl-map`.

| Component | Responsibility | Props shape (abbreviated) |
| --- | --- | --- |
| `<WLMap>` | Create and tear down the MapLibre instance. Own no data. | `center`, `zoom`, `styleUrl`, `interactive`, `cursor`, `onViewportChange`, `children` |
| `<ZoneLayer>` | Render zone polygons as a MapLibre source+layer. Handle click → `onSelect`. | `zones: GeoJsonFeatureCollection`, `selectedId`, `onSelect` |
| `<HeatmapLayer>` | Weighted heatmap layer. | `points: WeightedPoint[]`, `radius`, `intensity` |
| `<PinLayer>` | Generic pin renderer with optional popover component prop. | `pins: Pin[]`, `popover?: ReactComponent` |
| `<HubLayer>` | Hubs (warehouses, stores). Fixed iconography, tooltip. | `hubs: Hub[]` |
| `<DrawLayer>` | Wraps `@mapbox/mapbox-gl-draw`. Emits GeoJSON on change. | `mode: 'polygon' \| 'circle' \| null`, `value`, `onChange` |
| `<OverlayControls>` | Top-left floating checklist; reads/writes localStorage. | `value`, `onChange` |
| `<ModeToggle>` | Monitor / Configure pill. | `value`, `onChange` |
| `<ZoneInspector>` | Right panel. Variant-switches on mode. | `zone`, `mode`, `overlays`, `onSave`, `onDelete` |
| `<ZoneSearch>` | Top-right fuzzy search. | `zones`, `onSelect` |
| `<KpiStrip>` | Bottom KPI pill row. | `stats` |

Each component is ≤ ~150 LOC. Anything growing past that gets split.

---

## 8. Interaction flows

### 8.1 Selecting a zone

1. User clicks a polygon on the map.
2. `<ZoneLayer>` emits `onSelect(zoneId)`.
3. Page state sets `selectedId`. `<ZoneLayer>` re-renders with a highlight stroke; `<ZoneInspector>` slides in with the zone's data.
4. Pressing `Esc` or clicking the map background clears selection.

### 8.2 Drawing a new zone

1. User clicks `+ New zone` → `/zones/new`.
2. Picks `Polygon` in the toolbar. `<DrawLayer mode="polygon">` is active.
3. Clicks to drop vertices; double-clicks to close.
4. Fills rate fields in the inspector.
5. Clicks `Create zone`. Client POSTs to `/v4/zones` with `shape: { type: 'polygon', ring }`. On success, routes to `/zones/[id]`.
6. Failure: field-level errors from Zod surface inline; network failures show a toast with retry.

### 8.3 Editing zone geometry

1. In Configure mode, user selects a zone → clicks `Edit geometry`.
2. `<DrawLayer mode="polygon">` hydrates with the current polygon; vertex handles appear.
3. User drags handles, adds/removes vertices (right-click or keyboard delete).
4. `Save` → PATCH `/v4/zones/:id` with new ring. `Cancel` → revert.

### 8.4 Toggling overlays

1. User checks/unchecks a box in `<OverlayControls>`.
2. State writes to `localStorage` under `wl.zones.overlays`.
3. The corresponding layer mounts/unmounts. No data re-fetch; overlay data is fetched once on page load and cached.

### 8.5 Mode switch

1. User clicks `Configure`.
2. `<ZoneInspector>` swaps its subtree (read-only → editable form). The map canvas and selection persist.
3. The `+ New zone` button gains subtle emphasis (it is the primary Configure action).

---

## 9. Visual language

- **Tokens over literals.** Every `className` and every MapLibre style paint value flows through `wl.*` CSS vars or theme-derived JSON. No `#1a1a2e`, `border-blue-500`, or `text-gray-500` in zones code.
- **Zone colors:**
  - Stroke: `wl.color.border.default` (unselected), `wl.color.primary.500` (selected).
  - Fill: derived from `slaPct` — `wl.color.success.500` (≥ 0.95), `wl.color.warning.500` (0.80–0.94), `wl.color.danger.500` (< 0.80). 15% opacity for inactive fills.
- **Heatmap ramp:** low-weight `wl.color.info.300` with 0.2 opacity → high-weight `wl.color.danger.500` with 0.9 opacity.
- **Pins:** colored by order status (`open`, `assigned`, `in_transit`, `delayed`). Delayed pins pulse at 1.5 s interval.
- **Typography:** map labels use `wl.font.sans` at `wl.text.xs` / `wl.text.sm`. Inspector uses existing dashboard type scale.
- **Spacing / radii:** floating controls use `wl.radius.md`, inspector uses `wl.radius.lg`, `wl.shadow.elevation-3`.
- **Accessibility:**
  - Every interactive element has a visible focus ring (`wl.color.primary.500`, 2 px).
  - Keyboard flow: `Tab` cycles overlay controls → search → `+ New zone` → inspector.
  - Screen readers announce zone selection via `aria-live="polite"` on the inspector.
  - Color alone never carries meaning — SLA state has both color and a glyph (`●`, `▲`, `✕`) in the inspector.
  - Map pan/zoom supports keyboard (`+`, `-`, arrows).

---

## 10. Migration and rollout

### 10.1 Backward compatibility

- The new create/update API accepts both the legacy shape (`boundary: [{latitude, longitude}, ...]`) and the new discriminated union (`shape: { type, ... }`). The legacy field remains for one release cycle, then is removed.
- Zones with no boundary (today's optional field) are rendered as small diamond placeholders at the org's default center. The inspector highlights them with "No geometry yet — click Edit geometry to draw".

### 10.2 Feature flag

- Gate the redesigned pages behind `NEXT_PUBLIC_FEATURE_ZONES_MAP=true` in `.env`. Default off on staging until QA signs off, then flipped on globally. The flag is removed in the follow-up PR after ~1 week of production soak.

### 10.3 Dashboard design-system cleanup (narrow scope)

While we're in the zones codebase we also:

- Replace hard-coded palette values in `apps/dashboard/src/app/(dashboard)/zones/**/*.tsx` with `wl.*` tokens.
- Do **not** touch unrelated pages (e.g. `integrations/connected/page.tsx`) beyond what the zones redesign imports. Broader cleanup is a separate ticket.

### 10.4 Telemetry

Fire three events (existing analytics pipeline):

- `zones.viewed` (mode, overlay set)
- `zones.created` (shape type, rate values)
- `zones.geometry_edited` (vertex count delta)

---

## 11. Out of scope (with rationale)

| Item | Why deferred |
| --- | --- |
| **C · Prisma `Unsupported("geometry(...)")` migration** | Database is already correct; this is an ergonomic cleanup, not a blocker. Spin its own spec. |
| **C · Removing raw-SQL PostGIS round-trips** | Same reason. Works correctly today. |
| **D · `/map` live ops redesign** | Depends on this spec's `<WLMap>` but has its own UX concerns (driver clustering, route lines, incident overlays). Separate spec. |
| **E · Map embeds on detail pages** | Each embed (order, shipment, route, driver, location) has specific content and is best specced with its owning page. |
| **Fleetbase zone sync** | Fleetbase carries its own zone concept. Integration is an interoperability project, not a UI one. |
| **Tracking-page parity** | Customer tracking uses Leaflet; we don't pay the UX cost of converging it now. |
| **Postcode / admin-region zones** | Requires per-market boundary data. Revisit once two markets demand it. |
| **Multi-polygon zones** | Rare. Supported server-side via PostGIS already; UI is deferred. |
| **Real-time push of overlay updates** | 30 s poll is enough for "healthy / slipping" glance-value. Realtime belongs to D. |

---

## 12. Risks and open questions

1. **Tile costs.** MapTiler free tier caps at 100k requests/month. If staging + a small prod usage exceed it we self-host PMTiles. Tracked as a pre-launch task, not a design blocker.
2. **Polygon perf at scale.** Orgs with > 500 zones may feel lag on style recompute. Mitigation: move `<ZoneLayer>` to a vector tile source backed by a Postgres function once we see it in the wild. Monitor with a browser perf event.
3. **Package location.** We start with the map components under `apps/dashboard/src/components/map/`. If sub-project E begins inside the customer-portal before we're done with D we promote to `packages/wl-map`. Low-cost move.
4. **Legacy boundary rows.** An unknown number of existing zones have `boundary = null`. We need a one-time count before we ship to decide if a backfill tool is warranted. Tracked in the implementation plan's pre-flight checklist.
5. **`zones.boundary` write path.** Today the API does `ST_GeomFromText` on a manually-assembled WKT string. Circle support means assembling a `ST_Buffer` call instead. Non-trivial but localized to `apps/api/src/routes/zones.ts` — covered in the implementation plan.
6. **Map styling JSON size.** Bundling a full MapLibre style inline can bloat the client bundle. We load the style URL at runtime and patch color stops from tokens via a small runtime utility. Bundle impact: add `maplibre-gl` (~150 KB gz) + `mapbox-gl-draw` (~30 KB gz) on zones pages only via `next/dynamic`. Other dashboard routes stay untouched.
7. **Draw UX on touch devices.** Vertex handles at touch resolution are fiddly. v1 accepts this; touch-optimized drawing is a follow-up.

---

## 13. Appendix · Concrete file touchpoints

**Frontend (`apps/dashboard`):**

- `package.json` — add `maplibre-gl`, `@mapbox/mapbox-gl-draw`, `@turf/turf`.
- `src/components/map/` — new directory for all map components listed in §7.
- `src/styles/wl-map-style.ts` — new; compiles MapLibre style JSON from `wl.*` tokens.
- `src/app/(dashboard)/zones/page.tsx` — replace card grid with `<WLMap>`-based page.
- `src/app/(dashboard)/zones/new/page.tsx` — replace four-field form with drawing UI. (Note: current path is `/zones/create`; we rename to `/zones/new` to match the rest of the dashboard's conventions. Redirect old path.)
- `src/app/(dashboard)/zones/[id]/page.tsx` — new detail page.
- `src/hooks/use-zone-overlays.ts` — new hook that fetches + caches `/v4/zones/overlays`.

**Backend (`apps/api`):**

- `src/routes/zones.ts` — add `GET /overlays`, `GET /?format=geojson`, extend POST/PATCH to accept discriminated `shape`.
- `packages/validators/src/index.ts` — add `zoneShapeSchema`; extend `createDeliveryZoneSchema` and `updateDeliveryZoneSchema`.

**Docs:**

- `docs/DESIGN_SYSTEM.md` — add "Map" section with token usage rules.
- `docs/adr/INDEX.md` — link new ADR if we write one for MapLibre selection (likely yes — it's a foundational decision).

---

## 14. Approval

This spec is ready for the user to review. Once approved, the next step is to invoke `writing-plans` and generate the implementation plan that turns each section above into ordered, testable tasks with clear acceptance criteria.
