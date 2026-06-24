# Integrations Section — UX & Cognitive-Load Refresh

**Date:** 2026-04-19
**Status:** Design, awaiting approval
**Scope:** `apps/dashboard/src/app/(dashboard)/integrations/**` + new shared layout primitives in `apps/dashboard/src/components/layout/`
**Related docs:** [`docs/DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md)

---

## 1. Context & Problem

The Integrations section has expanded to 15+ sub-pages (Health Center, Catalog, Connected, six category pages, six tools pages). Each page was built piecemeal, so navigating between them feels like visiting five different products. The user's stated goal is to **reduce cognitive load** and **re-align with the design system**.

### Observed cognitive-load drivers (from current code)

1. **Quadruple wayfinding.** Every page shows sidebar selection + `<Header title="Integrations" />` + breadcrumb trail + three-group tab bar + its own H1. A user has to parse four overlapping "where am I?" signals before reading anything.
2. **Three-accent tab bar.** `integrations/layout.tsx` paints main tabs amber (`border-amber-500/text-amber-400`), category tabs blue (`border-blue-500/text-blue-400`), and tools tabs violet (`border-violet-500/text-violet-400`). The design system has **one** primary accent (amber). The other two are raw Tailwind colors, not tokens.
3. **Raw hex / raw Tailwind colors.** Sub-pages use `text-gray-400`, `bg-emerald-500/10`, `text-red-500`, `border-white/[0.06]` instead of `wl-*` tokens. State is inconsistent — "healthy" is emerald on one page, green-500 on another.
4. **Bespoke page shells.** Every sub-page re-invents its hero: Payments has a gradient card, Shipping has a sub-tab bar + stat row, ERP has a blue hero strip, Messaging has a purple hero strip. Nothing repeats, so muscle memory never forms.
5. **KPI overload.** Most sub-pages lead with 4–6 KPI cards of roughly equal visual weight. The actual job (configure a provider, view a failure, trigger a sync) is buried below the fold.

### North Star

A user jumping between `Payments → Shipping → ERP → Messaging` should feel like they are **on the same page with different data**, not four different apps. The section should read as one surface with one primary accent, one header pattern, one KPI band, and one page-body grammar.

### Non-goals (this refresh)

- Redesigning the global sidebar or the top `Header` component.
- Changing any routes or data contracts.
- Touching `/integrations` (Health Center) or `/integrations/catalog` — both were brought to the new baseline in the previous session and are the reference implementations.
- Rewriting sub-page business logic. Only layout, tokens, and shared primitives.
- Adding new features (that's a separate ticket).

---

## 2. Design Principles

Applied top-down to every integrations sub-page.

1. **One attention zone per viewport.** Page opens with exactly one "most-important thing" — either the primary action or the primary status. Secondary info recedes.
2. **One accent, many weights.** Amber (`wl-primary-*`) is the only accent color on interactive elements. Semantic tokens (`wl-success`, `wl-warning`, `wl-danger`, `wl-info`) are the **only** way state is expressed. No raw Tailwind colors.
3. **Token-first.** Every color, spacing, radius, and font size references a design token. Reviewers should be able to reject any PR that uses a raw `text-gray-*`, `bg-emerald-*`, `text-red-*`, or `border-white/[0.xx]` class inside `integrations/**`.
4. **One header, one nav.** Wayfinding happens in exactly two places: the tab bar (which section) and the page title (which view). The global Header title reverts to the section name only; breadcrumb becomes optional drill-down only.
5. **Shared shell, local body.** Every sub-page wraps its content in the same `<PageShell>` primitive. Only the body content varies.

---

## 3. Architecture & Shared Primitives

Two new primitives plus surgical changes to `integrations/layout.tsx`.

### 3.1 `<PageShell>` — `apps/dashboard/src/components/layout/page-shell.tsx` (new)

Replaces the ad-hoc `<div className="space-y-8">` + header blocks each sub-page reinvents.

```tsx
interface PageShellProps {
  title: string
  description?: string
  primaryAction?: ReactNode       // at most one
  secondaryActions?: ReactNode[]  // zero or more, de-emphasized
  kpis?: ReactNode                // slot for a single <KpiRow />
  children: ReactNode             // the page body
}
```

Rules the component enforces (via JSDoc + defaults, not runtime asserts):

- Only one `primaryAction` — the pattern breaks if sub-pages start cramming two.
- `kpis` slot caps at four cards. Anything more goes into the page body as a secondary section.
- Vertical rhythm is fixed (`space-y-8`). No sub-page tweaks it.
- Title/description use `text-wl-text-primary` / `text-wl-text-tertiary` — hard-coded so sub-pages can't regress.

### 3.2 `<KpiRow>` / `<KpiCard>` — `apps/dashboard/src/components/layout/kpi-row.tsx` (new)

Single source of truth for the stat-card pattern every integrations page currently duplicates.

```tsx
type KpiTone = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface KpiCardProps {
  label: string
  value: string | number
  tone?: KpiTone          // maps to wl-* semantic tokens
  delta?: { value: string; direction: 'up' | 'down' | 'flat' }
  icon?: ReactNode
  href?: string           // makes the whole card a link
}
```

- Tones map to exactly these tokens — no other colors exist:
  - `default` → `text-wl-text-primary`, neutral border
  - `success` → `text-wl-success-400`, `border-wl-success-400/20`
  - `warning` → `text-wl-warning-400`, `border-wl-warning-400/20`
  - `danger` → `text-wl-danger-400`, `border-wl-danger-400/20`
  - `info` → `text-wl-info-400`, `border-wl-info-400/20`
- `href` collapses the existing "click this card" pattern (currently done 4 different ways across pages) into one.

### 3.3 Changes to `integrations/layout.tsx`

Four surgical changes; no behavioral regression.

1. **Unify tab accent to amber.** All three groups (`main`, `categories`, `tools`) use `border-wl-primary-500 text-wl-primary-400` when active. Group identity is expressed through **grouping itself** (the existing dividers) and a single muted label above each group, not through color.
2. **Replace raw colors with tokens.**
   - `border-white/[0.06]` → `border-wl-border-subtle`
   - `text-white/35` → `text-wl-text-tertiary`
   - `text-white/60` → `text-wl-text-secondary`
   - `bg-white/[0.08]` → `bg-wl-border-subtle`
3. **Add small group labels.** Above the three groups, add muted `text-xs uppercase tracking-wider text-wl-text-tertiary` labels: "Overview", "By category", "Tools". Clarifies grouping without a rainbow.
4. **Demote the Header subtitle.** The existing `<Header title="Integrations" subtitle="Manage your third-party integrations and connections" />` is redundant once every sub-page has its own `<PageShell title=...>`. Keep the title, drop the subtitle. Breadcrumb collapses to `Dashboard › Integrations › {current}` only when the user is deeper than one level (already does this; no change).

### 3.4 Non-goals in Phase 1

- Any sub-page body. Phase 1 only adds the two primitives and edits
  `integrations/layout.tsx`. Sub-pages including `/integrations/page.tsx`
  (Health Center) and `/integrations/catalog/page.tsx` convert in
  Phase 2.
- `packages/*` — untouched.
- API / data hooks — untouched in Phase 1. Phase 2 PRs may bundle small
  hook additions (e.g. `isDemoData` on `useIntegrationHealth`) when a
  page needs them, but only as prerequisites for that page's conversion.

---

## 4. Per-Page Conformance Plan (Phase 2)

Each of these four pages adopts `<PageShell>` + `<KpiRow>` and swaps raw colors for tokens. The data, logic, and routes do not change.

| Page | Current hero | After | KPI count |
|------|--------------|-------|-----------|
| `integrations/payments` | Gradient hero card + 4 KPIs + tabs | `<PageShell>` + `<KpiRow>` (4 tones: info / success / warning / default) | 4 |
| `integrations/shipping` | Sub-tab bar + stat row | `<PageShell>` + `<KpiRow>` with the sub-tab bar moved into the page body as a `<Tabs>` component | 4 |
| `integrations/erp` | Blue hero strip + 5 KPIs | `<PageShell>` + `<KpiRow>` capped at 4, 5th metric demoted into a "Sync status" section card | 4 |
| `integrations/messaging` | Purple hero strip + 4 KPIs | `<PageShell>` + `<KpiRow>` | 4 |

Each conversion is:

1. Replace the bespoke hero JSX with `<PageShell title={...} description={...} primaryAction={...} kpis={<KpiRow>...}`.
2. Delete any raw-color classes (`text-emerald-*`, `bg-blue-*/10`, `text-gray-*`, `border-white/[0.06]`, etc.). Replace with `wl-*` tokens or semantic KPI tones.
3. Move any "secondary" KPI above the 4-card cap into a `SectionCard` below the fold.
4. Verify the page still type-checks and the E2E smoke test for that page (if any) passes.

No page-body logic changes. If a conversion starts to require behavioral changes, it stops and files a separate ticket.

---

## 5. Rollout

**Phase 1 — this PR (small, reviewable):**

- Add `<PageShell>` and `<KpiRow>` primitives (new files, no existing file broken).
- Surgical changes to `integrations/layout.tsx` (unify accent, tokenize colors, add group labels, drop Header subtitle).
- No sub-page touched.
- Diff target: < 400 lines (keeps PR at "1 reviewer" tier per `AGENTS.md`).
- Reviewer: Nisha Kapoor (primary, dashboard area).

**Phase 2 — one PR per page, in this order:**

1. `integrations/page.tsx` (Health Center) — bundles the in-flight
   `isDemoData` addition to `useIntegrationHealth` and the demo-data
   banner. Becomes the section's reference implementation.
2. `integrations/catalog/page.tsx` — bundles the in-flight
   `integration-logos.ts` helper and `CatalogIntegrationLogo`.
3. `integrations/payments`, `shipping`, `erp`, `messaging` — one PR
   each, using the new primitives. No logic changes.

- Each PR is independent and mergeable in order.
- Target per PR: 100–300 lines.
- Reviewer: Nisha Kapoor (primary), Dev Malhotra (secondary for any PR
  that clears the 400-line large-PR line).

**Deferred:**

- `integrations/crm`, `integrations/ecommerce`, and the tools tabs
  (`providers`, `webhooks`, `credentials`, `chaos`, `migration`, `docs`)
  — same conformance pattern, follow-up sprint. Not blocked on Phase 1
  or 2.

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Shared `<PageShell>` becomes a god-component as sub-pages request new slots. | Props are frozen to the six above. Any addition requires explicit spec update; additions < 2 so far is the bar. |
| Removing the 3-color tab accent makes group boundaries harder to see. | Group labels + existing dividers replace the color signal. Reviewed in Phase 1 PR screenshots before merge. |
| Phase 2 page conversions accidentally change behavior. | Each page PR limited to layout/token swaps. No data-flow or state changes. PR description must include "no behavioral change" checkbox. |
| Raw-color creep after Phase 1 ships. | Optional Phase 3: eslint rule forbidding `text-gray-*`, `bg-emerald-*`, `text-red-*`, `border-white/` inside `integrations/**`. Not part of this spec; logged as follow-up. |

---

## 7. Success Criteria

Phase 1 ships when:

1. `apps/dashboard/src/components/layout/page-shell.tsx` and `kpi-row.tsx` exist and type-check.
2. `integrations/layout.tsx` uses one accent (amber) and zero raw colors.
3. `pnpm lint && pnpm typecheck` passes for `apps/dashboard`.
4. Visual smoke on `/integrations`, `/integrations/catalog`, and one category page (`/integrations/payments`) shows no regression.
5. Diff stays under the 400-line one-reviewer threshold.

Phase 2 (per page) ships when:

1. Page uses `<PageShell>` + `<KpiRow>`; no bespoke hero.
2. `rg "(text-gray-|bg-emerald-|text-red-|border-white/\[)" apps/dashboard/src/app/\(dashboard\)/integrations/<page>` returns zero matches.
3. KPI count ≤ 4.
4. `pnpm typecheck` green, no behavioral change.
