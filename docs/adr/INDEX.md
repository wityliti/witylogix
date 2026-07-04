# Architecture Decision Records (ADR) Index

This document provides an index of all Architecture Decision Records (ADRs) for the Witylogix platform. ADRs document major architectural and design decisions, their context, alternatives considered, and rationale.

## Overview

ADRs follow the [RFC 3986](https://adr.github.io/) format with:

- **Status**: Proposed, Accepted, Deprecated, Superseded
- **Date**: When the decision was made
- **Deciders**: Who made the decision
- **Context**: Problem and constraints
- **Decision**: What was decided
- **Consequences**: Positive and negative outcomes

## Core Architecture

### [ADR-001: Platform Rewrite — Technology Stack Selection](./ADR-001-platform-rewrite-stack-selection.md)

- **Date**: 2026-03-06
- **Status**: Accepted
- **Summary**: Decision to rewrite platform as Turborepo monorepo with Fastify backend, PostgreSQL database, and React Router v7 Shopify app framework.
- **Key Decisions**:
  - Turborepo + pnpm for monorepo organization
  - Fastify 5 backend with PostgreSQL 16 + PostGIS
  - PostgreSQL Row-Level Security for multi-tenant isolation
  - React Router v7 + Polaris Web Components for Shopify app
  - Preact for UI extensions
  - AGPL-3.0 open-source license

### [ADR-009: Medusa v2-Inspired Architecture Evolution](./ADR-009-medusa-inspired-architecture-evolution.md)

- **Date**: 2026-03-08
- **Status**: Accepted
- **Summary**: Adoption of Medusa v2's plugin architecture pattern for extensibility and modularity.
- **Key Decisions**:
  - Workflow engine with step-based orchestration
  - Dependency injection container for loose coupling
  - Provider abstraction pattern for swappable implementations
  - Event bus for asynchronous communication
  - Extension hooks for merchant customization

### [ADR-021: Developer Experience & Monorepo Bootability](./ADR-021-developer-experience-monorepo.md)

- **Date**: 2026-03-10
- **Status**: Accepted
- **Summary**: Prioritize developer experience through simplified setup, hot reload, and comprehensive documentation.
- **Key Decisions**:
  - Docker Compose for one-command local setup
  - Turbo watch mode for instant feedback
  - Workspace development with module aliasing
  - Automated code generation from schemas
  - Clear package boundaries and responsibilities

## Integration & Extensibility

### [ADR-008: Multi-Provider Authentication Abstraction](./ADR-008-auth-provider-abstraction.md)

- **Date**: 2026-03-07
- **Status**: Accepted
- **Summary**: Abstract authentication provider interface to support multiple auth backends (Local, Auth0, Clerk, Cognito, Firebase, OIDC, SAML).
- **Key Decisions**:
  - Provider registry pattern for auth backends
  - Tenant-level provider override capability
  - Fallback to deployer default if tenant has no custom provider
  - Metered usage tracking for third-party providers
  - Session management abstraction

### [ADR-011: Extension Architecture](./ADR-011-extension-architecture.md)

- **Date**: 2026-03-08
- **Status**: Accepted
- **Summary**: Preact-based extension system for Shopify checkout and POS UI customization.
- **Key Decisions**:
  - Preact for small bundle size (< 64KB)
  - Theme token bridge for design system consistency
  - App Bridge integration for session tokens
  - PostMessage RPC for parent-child communication
  - Merchant-controlled extension marketplace

### [ADR-012: Notification Provider Architecture](./ADR-012-notification-provider-architecture.md)

- **Date**: 2026-03-08
- **Status**: Accepted
- **Summary**: Multi-channel notification system supporting Email, SMS, WhatsApp, and Push notifications across multiple providers.
- **Key Decisions**:
  - Provider abstraction for swappable implementations
  - Multi-tenant provider configuration
  - Deployer-level defaults with tenant BYOK option
  - Metered fallback billing for tenant custom providers
  - Template rendering and rate limiting

### [ADR-014: Platform Source Abstraction](./ADR-014-platform-source-abstraction.md)

- **Date**: 2026-03-08
- **Status**: Accepted
- **Summary**: Abstract e-commerce platform integration interface to support Shopify, WooCommerce, Magento, and custom APIs.
- **Key Decisions**:
  - Source adapter pattern for platform integration
  - Unified order/product sync interface
  - Webhook standardization across platforms
  - Merchant credential management per tenant
  - Health monitoring and fallback handling

### [ADR-015: WooCommerce Integration](./ADR-015-woocommerce-integration.md)

- **Date**: 2026-03-09
- **Status**: Accepted
- **Summary**: Deep integration with WooCommerce for delivery rate calculation, tracking, and proof-of-delivery.
- **Key Decisions**:
  - REST API + webhook integration
  - Shipping zones and rate table mapping
  - Custom field plugin for delivery metadata
  - Order status sync with POD handling
  - Multi-site support via sub-registries

### [ADR-016: Magento 2 Integration](./ADR-016-magento-integration.md)

- **Date**: 2026-03-09
- **Status**: Accepted
- **Summary**: Integration with Magento 2 for B2B delivery scenarios and custom storefronts.
- **Key Decisions**:
  - REST API for order/customer sync
  - GraphQL support for complex queries
  - Custom attributes for delivery metadata
  - Multi-store and multi-website support
  - Tax/shipping rule integration

## Data & Workflows

### [ADR-010: Event Bus Architecture](./ADR-010-event-bus-architecture.md)

- **Date**: 2026-03-08
- **Status**: Accepted
- **Summary**: Redis Streams-based event bus for asynchronous domain event processing with multi-tenant support.
- **Key Decisions**:
  - Redis Streams (XADD/XREADGROUP/XACK) for durability
  - Consumer group pattern for parallel processing
  - Automatic retry with exponential backoff
  - Dead-letter queue for failed events
  - In-memory fallback mode for development

### [ADR-013: BullMQ Worker Integration](./ADR-013-worker-orchestrator-integration.md)

- **Date**: 2026-03-08
- **Status**: Accepted
- **Summary**: Integration of BullMQ job queue with workflow engine and notification system.
- **Key Decisions**:
  - Separate workers for billing, campaigns, notifications
  - Cron-based job scheduling
  - Graceful shutdown and auto-restart
  - Tenant-aware job grouping
  - Priority queue support

### [ADR-023: E2E Testing Strategy](./ADR-023-e2e-testing-event-bus.md)

- **Date**: 2026-03-10
- **Status**: Accepted
- **Summary**: Playwright-based E2E testing with event bus testing utilities for complete workflow validation.
- **Key Decisions**:
  - Playwright for cross-browser testing
  - Event bus listening for state verification
  - Isolated test databases per test
  - Visual regression testing with snapshots
  - CI/CD integration with parallel execution

## API & Reliability

### [ADR-018: Error Handling & Resilience](./ADR-018-error-handling-resilience.md)

- **Date**: 2026-03-09
- **Status**: Accepted
- **Summary**: Comprehensive error handling with custom error classes, retry strategies, and resilience patterns.
- **Key Decisions**:
  - 8 custom error classes (Validation, NotFound, Unauthorized, etc.)
  - Automatic Zod/Prisma error mapping
  - Exponential backoff retry with jitter
  - Circuit breaker for failing external services
  - Structured error responses with request IDs

### [ADR-020: Documentation Engine](./ADR-020-documentation-engine.md)

- **Date**: 2026-03-10
- **Status**: Accepted
- **Summary**: Fumadocs-based documentation site with AI-powered search, API specs, and component gallery.
- **Key Decisions**:
  - Fumadocs for MDX rendering and search
  - OpenAPI 3.0 spec auto-generation
  - AI search powered by Claude API (RAG)
  - Component gallery for design system
  - Platform adapter guides (Shopify, WooCommerce, Magento)

### [ADR-028: Platform Deployment Architecture](./ADR-028-platform-deployment.md)

- **Date**: 2026-03-12
- **Status**: Accepted
- **Summary**: Containerized deployment with Docker Compose for self-hosted and Kubernetes for cloud.
- **Key Decisions**:
  - Multi-stage Docker builds
  - Environment-specific configurations
  - Automated Prisma migrations on startup
  - Health checks and graceful shutdown
  - OpenAPI spec generation in build pipeline

## Operations & Monitoring

### [ADR-019: CI/CD Pipeline & Release Strategy](./ADR-019-cicd-pipeline-release.md)

- **Date**: 2026-03-10
- **Status**: Accepted
- **Summary**: GitHub Actions-based CI/CD with semantic versioning and automated releases.
- **Key Decisions**:
  - GitHub Actions for CI/CD automation
  - Semantic versioning with conventional commits
  - Automated changelog generation
  - Multi-environment deployment (staging, production)
  - Rollback strategy with feature flags

### [ADR-022: CLI Deployment Tool](./ADR-022-cli-deployment-tool.md)

- **Date**: 2026-03-10
- **Status**: Accepted
- **Summary**: Command-line tool for managing Witylogix deployments, upgrades, and configuration.
- **Key Decisions**:
  - TypeScript-based CLI using Yargs
  - Docker registry management
  - Database migration orchestration
  - Health checks and validation
  - Configuration templating

## Advanced Features

### [ADR-024: Dispatch Dashboard Architecture](./ADR-024-dispatch-dashboard.md)

- **Date**: 2026-03-11
- **Status**: Accepted
- **Summary**: Real-time route dispatch interface with timeline visualization and driver management.
- **Key Decisions**:
  - Leaflet map for route visualization
  - Socket.io for real-time updates
  - Drag-and-drop route building
  - Driver assignment with optimization scoring
  - Proof-of-delivery photo capture

### [ADR-025: Route Analytics Architecture](./ADR-025-route-analytics.md)

- **Date**: 2026-03-11
- **Status**: Accepted
- **Summary**: Planned vs actual route analytics with performance metrics and KPI tracking.
- **Key Decisions**:
  - Aggregated metrics storage (planned vs actual)
  - Driver performance scoring
  - Route efficiency metrics (distance, time, stops)
  - Customer experience metrics (delivery time, accuracy)
  - Custom report building with saved views

### [ADR-026: Telematics Gateway](./ADR-026-telematics-gateway.md)

- **Date**: 2026-03-11
- **Status**: Accepted
- **Summary**: Hardware GPS device integration via Telematics providers with real-time location streaming.
- **Key Decisions**:
  - Multi-provider telematics support
  - Real-time location polling and webhooks
  - Device health monitoring
  - Fallback to mobile GPS if device unavailable
  - Historical location replay for analytics

### [ADR-027: AI Demand Prediction](./ADR-027-ai-demand-prediction.md)

- **Date**: 2026-03-11
- **Status**: Accepted
- **Summary**: Machine learning-based demand forecasting for capacity planning and route optimization.
- **Key Decisions**:
  - Time series forecasting (ARIMA/Prophet)
  - Seasonal pattern detection
  - Zone-level granularity
  - Weekly forecasting with confidence intervals
  - Manual override capability with feedback loop

### [ADR-029: ML ETA Model v2 — GBDT + Holt-Winters](./ADR-029-ml-eta-model-v2.md)

- **Date**: 2026-04-05
- **Status**: Accepted
- **Summary**: Pure TypeScript Gradient Boosted Decision Trees for ETA prediction integrated into the 6-model ensemble, plus Holt-Winters triple exponential smoothing for 7-day slot demand forecasting.
- **Key Decisions**:
  - GBDT model: 60 trees, 17 features, no external ML dependencies
  - Holt-Winters: additive seasonality with m=7 (weekly period)
  - 60/40 blend of Holt-Winters + historical regression for demand
  - EtaLog and SlotDemandForecast Prisma models for accuracy tracking
  - Feature importance surfaced for operator insights

### [ADR-032: MapLibre GL JS + mapbox-gl-draw Map Stack](./ADR-032-maplibre-map-stack.md)

- **Date**: 2026-04-19
- **Status**: Accepted
- **Summary**: Adopt MapLibre GL JS with `@mapbox/mapbox-gl-draw` and `@turf/turf` as the dashboard map stack, starting with MapTiler tiles in dev/staging and planning self-hosted PMTiles for production.
- **Key Decisions**:
  - MapLibre GL JS (free, token-free) for dashboard interactive maps
  - `@mapbox/mapbox-gl-draw` + `@turf/turf` for polygon and circle drawing
  - MapTiler `dataviz-dark` tiles in dev/staging; self-hosted PMTiles planned for production
  - Tracking-page keeps Leaflet for now; convergence deferred
  - Map components consume design-system tokens at runtime via `resolveToken`

## Navigation by Category

### Monorepo & Developer Experience

- ADR-001: Stack Selection
- ADR-009: Architecture Evolution
- ADR-021: Developer Experience

### Authentication & Security

- ADR-008: Auth Provider Abstraction
- ADR-018: Error Handling & Resilience

### Platform Integration

- ADR-014: Platform Source Abstraction
- ADR-015: WooCommerce Integration
- ADR-016: Magento Integration

### Extensions & Customization

- ADR-011: Extension Architecture
- ADR-012: Notification Providers
- ADR-013: Worker Integration

### Data & Async Processing

- ADR-010: Event Bus Architecture
- ADR-023: E2E Testing Strategy

### Operations & Deployment

- ADR-019: CI/CD Pipeline
- ADR-020: Documentation Engine
- ADR-022: CLI Tool
- ADR-028: Deployment Architecture

### Advanced Features

- ADR-024: Dispatch Dashboard
- ADR-025: Route Analytics
- ADR-026: Telematics Gateway
- ADR-027: AI Demand Prediction
- ADR-032: MapLibre Map Stack

## Decision History

All ADRs are maintained in this directory with dates indicating when decisions were made. Refer to individual ADR files for detailed context, alternatives considered, and implementation guidance.

For questions about architectural decisions, refer to the relevant ADR or open a discussion in the [GitHub Discussions](https://github.com/witylogix/witylogix-platform/discussions).
