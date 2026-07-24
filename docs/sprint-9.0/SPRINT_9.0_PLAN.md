# Sprint 9.0 — Test Hardening & API Route Wiring

**Date:** 2026-03-18
**Branch:** `sprint-9.0-test-hardening-api-wiring`
**Theme:** Fix systemic test failures to reach 95%+ pass rate, wire Fastify API routes to core business logic, and add i18n foundation.

## Objectives

1. **Fix systemic test failures** — Resolve the ~762 failing tests (from 83.8% to 95%+ pass rate) by fixing common patterns: `@jest/globals` → vitest, mock initialization order, duplicate type exports, missing module mocks
2. **Wire Fastify API routes** — Connect the API app to core business logic with real route handlers for orders, drivers, zones, shipments, tracking, and webhooks
3. **Add i18n foundation** — Internationalization infrastructure for dashboard and API error messages
4. **Order Kanban board** — Fleetbase-inspired drag-and-drop order board for operational visibility

## Agent Assignments

| Agent | Role          | Task                                                                   | ECC Skill                    |
| ----- | ------------- | ---------------------------------------------------------------------- | ---------------------------- |
| AR    | CTO           | Fix systemic test patterns (auth, monitoring, queue modules)           | tdd-workflow                 |
| RG    | Backend Lead  | Wire Fastify API routes — orders, drivers, zones, shipments            | api-design, backend-patterns |
| PK    | Sr. Backend   | Wire Fastify API routes — tracking, webhooks, notifications, auth      | api-design, security-review  |
| SP    | Full-stack    | Fix test failures in integrations (payments, erp, messaging, couriers) | tdd-workflow                 |
| KS    | QA Lead       | Fix test failures in AI, demand-prediction, onboarding, campaigns      | tdd-workflow                 |
| DM    | Frontend      | Order Kanban board with drag-and-drop                                  | frontend-patterns            |
| NK    | Frontend Lead | i18n infrastructure — next-intl setup, locale files, dashboard wiring  | frontend-patterns            |
| VS    | Component Dev | Kanban card components, status badges, drag indicators                 | frontend-patterns            |
| AM    | Integration   | Fix integration test failures (ecommerce, routing, shipping, gateway)  | tdd-workflow                 |
| ZR    | AI Engineer   | Fix AI module test failures and add missing mocks                      | tdd-workflow                 |
