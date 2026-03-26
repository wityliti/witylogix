# Sprint 9.2 — Dashboard API Wiring & Design System Upgrade

**Date:** 2026-03-18
**Branch:** `sprint-9.2-dashboard-api-wiring-design`
**Theme:** Wire the dashboard to real API endpoints, build typed hook infrastructure, upgrade core UI components and layout.

## Problem Statement

After 20+ sprints, the dashboard accumulated 250 pages but 200 (80%) use hardcoded mock data with zero connection to the backend API. The API has 60+ route files that work, but the dashboard never calls them. This sprint builds the bridge.

## Deliverables

1. **API Hook Infrastructure** — Generic useApiQuery/useApiList/useApiMutation hooks with loading/error/refetch
2. **7 Domain Hooks** — orders, drivers, zones, customers, returns, dashboard-stats — all typed, all calling real endpoints
3. **5 Critical Pages Rewired** — Home dashboard, Orders, Drivers, Customers, Returns — now using real API hooks with loading/error/empty states
4. **UI Component Upgrades** — LoadingSkeleton, ErrorState, EmptyState, DataTable, Pagination
5. **Dashboard Layout** — Collapsible sidebar navigation, breadcrumbs, responsive header
