# ADR-032 — MapLibre GL JS + mapbox-gl-draw as the dashboard map stack

- **Status:** Accepted
- **Date:** 2026-04-19
- **Deciders:** Frontend + backend leads
- **Context:** Spec `docs/superpowers/specs/2026-04-19-zones-map-redesign-design.md`

## Decision

Use **MapLibre GL JS** with **`@mapbox/mapbox-gl-draw`** and **`@turf/turf`** for all interactive maps in `apps/dashboard`. Start with MapTiler's free tier for tiles (`dataviz-dark` style); plan to self-host PMTiles for production once we exceed quota.

## Alternatives considered

- **Mapbox GL JS v3** — richer ecosystem but token-locked and usage-priced. Rejected for cost and vendor lock-in.
- **Leaflet** — simple, already used in the tracking-page. Rejected for the dashboard: weaker polygon drawing, no vector tiles, limited clustering at zone density.
- **Google Maps** — heavy licensing and poor aesthetics for a dark ops console.

## Consequences

- ~180 KB gz added to zones routes only (via `next/dynamic` boundaries). Other routes untouched.
- No token-fetch code on the client; `NEXT_PUBLIC_MAPTILER_KEY` is embedded at build time.
- When we need offline or branded tiles, swap the style URL behind `<WLMap>`; no consumer changes.
- `@mapbox/mapbox-gl-draw` runs against MapLibre via the community compatibility shim. Drawing tests must mock `MapboxDraw`.
- Map components read design-system tokens at runtime via `resolveToken('--wl-*')`, keeping visual parity with the rest of the UI.

## Tracking-page (customer-facing)

The customer tracking page keeps its existing Leaflet stack. Converging on MapLibre is a separate decision tracked against a future ADR.
