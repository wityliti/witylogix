# Sprint 9.4 — Mass Page Rewiring & Design Polish

**Date:** 2026-03-20
**Branch:** `sprint-9.4-mass-page-rewiring-design`
**Theme:** Wire the remaining 141 mock-data dashboard pages to real API hooks and apply design quality improvements. Target: <30 mock pages remaining after this sprint.

## Current State

- 39 pages wired to API, 141 still on mock data
- 61/61 API routes registered in server.ts
- 12 hooks rewritten to real API (Sprint 9.3)
- Frontend-design skill to be applied for design quality

## Deliverables

### 1. Rewire integrations pages — 31 pages (AR — CTO) [frontend-patterns]

All 31 integrations/\* pages: overview, catalog, connected, credentials, providers, health, webhooks, migration, docs, chaos + domain-specific (analytics, collaboration, crm, ecommerce, eld, email, erp, esignatures, freight, fuel, lastmile, marketplace, marketplace/[providerId], messaging, payments, pos, routing, shipping, supply-chain, telematics)

### 2. Rewire settings pages — 18 pages (NK — Frontend Lead) [frontend-patterns]

All 18 settings/\* pages: general, api-keys, auth-providers, billing, branding, notifications, notifications-config, notifications/templates, notifications/templates/[id], notifications/whatsapp, organization, payments, preferences, profile, team, webhooks, webhooks/test + root settings page

### 3. Rewire admin pages — 13 pages (PK — Sr. Backend) [frontend-patterns]

All 13 admin/\* pages: root, activity, api-docs, customers, design-system, integrations, queues, shops/[id], system, test-dashboard, users, workflows, workflows/[id]

### 4. Rewire orders + routes pages — 13 pages (RG — Backend Lead) [frontend-patterns]

Orders: [id], board, bulk, conflicts, create, import, local (7 pages)
Routes: root, [id], [id]/assign, [id]/edit, create, plan (6 pages)

### 5. Rewire fleet + freight + shipping pages — 16 pages (SP — Full-stack) [frontend-patterns]

Fleet: root, fuel, maintenance, vehicles (4)
Freight: root, compliance, loads, rates (4)
Shipping: labels, labels/new, tracking, tracking/[trackingNumber] (4)
Shipping-profiles: root, [id] (2)
Shipments: [id] (1)
Delivery: root, standard (0 — already done or N/A)

### 6. Rewire demand + analytics + finance pages — 12 pages (DM — Frontend) [frontend-patterns]

Demand: root, anomalies, capacity, models, scheduler (5)
Analytics: root, dashboards, reports, route-performance (4)
Finance: root, invoices, reconciliation (3)

### 7. Rewire remaining domain pages — 20 pages (VS — Component Dev) [frontend-patterns]

Field-service: root, dispatch, jobs (3)
Healthcare: root, patients, records (3)
Invoices: root, [id], create (3)
Partners: root, [id], compare, onboard (3 — onboard is new)
Drivers: performance (1)
Dispatch: couriers (1)
Supply-chain: inventory (1)
Notifications: delivery-log, log (2)
POS: transactions (1)
Products: sync (1)
Calendar (1)

### 8. Rewire utility + config pages — 14 pages (AM — Integration) [frontend-patterns]

Activity: root, realtime (2)
Design-system: root, components, forms, tokens (4)
Profile (1), Platform (1), Onboarding (1), Mobile-config (1)
Locations (1), Saved-views (1), Stores (1), Time-slots (1), Tracking-config (1), Widget-config (1), Widgets (1)

### 9. Design quality audit & polish (KS — QA Lead) [frontend-design]

- Audit top 20 most important pages for design quality
- Apply consistent dark theme, proper spacing, card styling
- Ensure LoadingSkeleton/ErrorState/EmptyState used consistently
- Fix any pages with broken layouts after rewiring

### 10. README, CHANGELOG, sprint docs (ZR — AI Engineer) [coding-standards]

- Update README with Sprint 9.3-9.4 features
- Update CHANGELOG
- Sprint summary document

## Success Criteria

- [ ] < 30 mock pages remaining (from 141)
- [ ] All major domains fully API-wired
- [ ] Design quality improved on top 20 pages
- [ ] README and CHANGELOG updated
