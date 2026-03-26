# Sprint 8.4 — CRM, ERP & Accounting

**Date:** 2026-03-17
**Branch:** `sprint-8.4-crm-erp-accounting`
**Theme:** Two-way CRM sync, ERP integration, accounting platform connections, and AI-powered customer intelligence.
**Skills Applied:** backend-patterns, api-design, security-review, frontend-patterns, e2e-testing, tdd-workflow

## Objectives

1. Build CRM Sync Engine v3 with field mapping DSL and bi-directional conflict resolution
2. Integrate CRM platforms: Salesforce, HubSpot, Zoho CRM, Pipedrive, Dynamics 365
3. Integrate accounting: QuickBooks Online, Xero
4. Integrate ERP: SAP S/4HANA (OData), NetSuite (TBA/REST)
5. Build financial sync dashboard with payment reconciliation
6. Build AI customer lifetime value predictor and CRM intelligence

## Agent Contributions

### AR (CTO) — CRM Sync Engine v3 [backend-patterns, api-design]
- `packages/core/src/crm/crm-sync-engine-v3.ts` — SyncOrchestrator, FieldMappingDSL (fluent builder: map().to().transform().when()), BidirectionalResolver (5 strategies: TIMESTAMP_WINS, SOURCE_OF_TRUTH, FIELD_PRIORITY, MERGE, MANUAL_REVIEW), ChangeDetector, SyncTransaction with rollback
- `packages/core/src/crm/crm-types.ts` — UnifiedContact, UnifiedDeal, UnifiedCompany, UnifiedActivity, FieldMapping, ConflictRecord, SyncConfig
- `packages/core/src/crm/crm-api.ts` — 15+ RESTful endpoints with pagination, filtering, proper status codes
- `packages/core/src/crm/crm-webhook-handler.ts` — Event normalization from 4 CRM providers, deduplication, retry, caching

### DM (Frontend) — CRM Connection Wizard [frontend-patterns]
- `apps/dashboard/src/app/(dashboard)/crm/connect/page.tsx` — 5-step compound component wizard (Select → OAuth → Configure → Test → Activate), keyboard navigation
- `apps/dashboard/src/app/(dashboard)/crm/page.tsx` — CRM dashboard with health status, activity feed, quick stats
- `apps/dashboard/src/hooks/use-crm-connection.ts` — useCrmConnection, useOAuthFlow, useCrmMetrics hooks
- `apps/dashboard/src/components/crm/crm-platform-card.tsx` + `oauth-callback-handler.tsx`

### NK (Frontend Lead) — Financial Sync Dashboard [frontend-patterns]
- `apps/dashboard/src/app/(dashboard)/finance/page.tsx` — Revenue overview with animated counters, lazy-loaded charts
- `apps/dashboard/src/app/(dashboard)/finance/invoices/page.tsx` — Virtualized invoice list, debounced search, bulk actions
- `apps/dashboard/src/app/(dashboard)/finance/reconciliation/page.tsx` — Two-column payment matcher with confidence scoring
- `apps/dashboard/src/hooks/use-financial-data.ts` — useInvoices, useReconciliation, useFinancialMetrics

### RG (Backend Lead) — Salesforce + HubSpot SDKs [api-design, security-review]
- `packages/core/src/integrations/crm/salesforce-sdk-client.ts` — 65+ methods: OAuth2, SOQL builder (injection-safe), SObject CRUD, Composite API, Bulk API 2.0, Streaming API, Metadata, HMAC webhooks, Sforce-Limit-Info tracking
- `packages/core/src/integrations/crm/hubspot-sdk-client.ts` — 70+ methods: OAuth2, CRM Objects CRUD, Search API, Associations, Properties, Pipelines, Batch (100 records), SHA-256 webhook verification

### SP (Full-stack) — QuickBooks + Xero SDKs [backend-patterns, security-review]
- `packages/core/src/integrations/accounting/quickbooks-sdk-client.ts` — OAuth2 (Intuit), invoices/payments/customers/items/bills/estimates/reports, PDF download, HMAC webhooks, 500 req/min
- `packages/core/src/integrations/accounting/xero-sdk-client.ts` — OAuth2 PKCE, multi-tenant, invoices/contacts/payments/bank transactions/items/POs/quotes/reports, intent-to-receive webhooks, 60 req/min
- `packages/core/src/integrations/accounting/accounting-normalizer.ts` — Unified types, currency conversion, tax normalization, status mapping

### VS (Component Dev) — CRM/Finance UI Components [frontend-patterns]
- `apps/dashboard/src/components/crm/contact-card.tsx` — Unified card with avatar, CRM source badge, expandable activities, React.memo
- `apps/dashboard/src/components/crm/deal-pipeline.tsx` — Kanban pipeline with color-coded probability, state-based drag
- `apps/dashboard/src/components/finance/invoice-line-item-editor.tsx` — Dynamic rows, auto-calc, tab navigation, currency selector
- `apps/dashboard/src/components/finance/payment-matcher.tsx` — Two-panel matcher with confidence scoring
- `apps/dashboard/src/components/finance/revenue-chart.tsx` — Recharts bars + trend line, YoY growth

### PK (Sr. Backend) — SAP + NetSuite SDKs [api-design, backend-patterns]
- `packages/core/src/integrations/erp/sap-odata-client.ts` — OAuth2 + SAML, OData v4 query builder (injection-safe), BusinessPartner/SalesOrder/PurchaseOrder/Product/Delivery/Invoice, $batch, CSRF tokens
- `packages/core/src/integrations/erp/netsuite-sdk-client.ts` — OAuth1 TBA, SuiteQL (parameterized), CRUD on 7 record types, Saved Search, File Cabinet, RESTlets, concurrency control (10 concurrent, 4500 pts/day)
- `packages/core/src/integrations/erp/erp-normalizer.ts` — SAP/NetSuite → unified types, UOM mapping, currency normalization

### KS (QA Lead) — Test Suites [e2e-testing, tdd-workflow]
- `tests/integration/crm/data-accuracy.test.ts` — Field mapping, decimal precision, timezone, Unicode, null handling
- `tests/integration/accounting/reconciliation.test.ts` — Amount matching ($0.01 tolerance), partial payments, FX, tax, void/refund
- `tests/integration/crm/conflict-resolution.test.ts` — All 5 strategies, concurrent updates, rollback
- `tests/e2e/crm/oauth-connect-flow.spec.ts` — Page Object Model, HubSpot/Salesforce OAuth flows, error handling
- `tests/e2e/finance/invoice-create.spec.ts` — Customer selection, line items, tax, PDF generation
- Fixtures file with 13 factory functions

### AM (Integration) — Zoho + Pipedrive + Dynamics 365 [api-design, security-review]
- `packages/core/src/integrations/crm/zoho-crm-sdk-client.ts` — OAuth2 (6 domains), Leads/Contacts/Accounts/Deals CRUD, Bulk (100), COQL, webhooks, 24K req/day
- `packages/core/src/integrations/crm/pipedrive-sdk-client.ts` — OAuth2 + API token, Persons/Orgs/Deals/Activities, Search, Pipelines, HMAC webhooks, 80 req/2s
- `packages/core/src/integrations/crm/dynamics365-sdk-client.ts` — OAuth2 MSAL, OData v4 builder, 7 entity types, ETag concurrency, $batch, multi-org, 6000 req/5min

### ZR (AI Engineer) — Customer LTV & CRM Intelligence [backend-patterns]
- `packages/core/src/ai/customer-ltv-predictor.ts` — DataFuser, FeatureExtractor (RFM + engagement + tenure + growth), LTVPredictor (weighted regression), CohortAnalyzer, ChurnPredictor, 7 segments (CHAMPION→LOST)
- `packages/core/src/ai/crm-intelligence.ts` — DealScoringModel, LeadScorer (A/B/C/D grades), ActivityRecommender, RelationshipStrength, SalesForecaster
- `packages/core/src/ai/crm-intelligence-api.ts` — 8 REST endpoints for LTV, scoring, forecasting, churn risk

## Stats

- **Files added/modified:** ~60+
- **New source lines:** ~28,000+
- **Test files:** 16+ (unit + integration + E2E + fixtures)
- **CRM SDKs:** 5 (Salesforce, HubSpot, Zoho, Pipedrive, Dynamics 365)
- **Accounting SDKs:** 2 (QuickBooks Online, Xero)
- **ERP SDKs:** 2 (SAP S/4HANA, NetSuite)
- **AI modules:** 3 new (LTV predictor, CRM intelligence, CRM intelligence API)

## Key Decisions

1. **Field Mapping DSL** — Fluent builder pattern (map().to().transform()) instead of JSON config for type safety
2. **5 conflict strategies** — Covers all enterprise needs from automatic to manual review
3. **OData query builders** — Both SAP and Dynamics 365 use injection-safe query builders
4. **OAuth1 TBA for NetSuite** — Required by NetSuite, implemented with HMAC-SHA256 signatures
5. **Service layer pattern** — All SDKs separate business logic from HTTP transport
6. **Page Object Model** — E2E tests use POM for maintainability
