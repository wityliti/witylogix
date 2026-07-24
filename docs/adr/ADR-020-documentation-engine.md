# ADR-020: Documentation Engine — Fumadocs with AI-Powered Search

**Status:** Accepted
**Date:** 2026-03-10
**Author:** AR (CTO)
**Deciders:** Engineering Team
**Related:** ADR-001 (Platform Architecture), ADR-015 (API Design)

---

## Context

The Witylogix delivery logistics platform has grown significantly:

- **73 API routes** across 4 adapters (REST, gRPC, WebSocket, GraphQL-ready)
- **19 Architecture Decision Records** documenting platform patterns
- **23 reusable UI components** in the design system
- **4 platform adapters** (Web, Mobile, Webhook, Third-party Integration)
- **Multiple deployment targets** (Vercel, Docker Compose, Kubernetes)

Developers need centralized, discoverable documentation that:

1. Is always in sync with code (auto-generated API docs)
2. Supports semantic search beyond keyword matching
3. Runs offline and self-hosted
4. Scales to 200+ pages without performance degradation
5. Integrates with the Turborepo monorepo structure
6. Provides OpenAPI-first documentation for APIs

Current state: Documentation scattered across README files, Notion, and inline code comments. This creates onboarding friction, increases support burden, and makes knowledge discovery difficult.

---

## Decision

**Adopt Fumadocs as the documentation engine**, deployed as a standalone Next.js application in the Turborepo monorepo at `apps/docs`.

Key architectural decisions:

- **Framework:** Fumadocs + Next.js 15 (React 19)
- **Content:** MDX files in `content/docs` directory + OpenAPI 3.0 specs in `content/api`
- **Search:** AI-powered RAG search using Anthropic Claude API with local embedding
- **API Reference:** Auto-generated from OpenAPI specs via `fumadocs-openapi`
- **Deployment:** Vercel (primary) or self-hosted Docker Compose
- **Styling:** Dark theme with Witylogix brand colors, responsive Tailwind CSS
- **Performance:** Static site generation with ISR for live API reference updates

---

## Alternatives Considered

### 1. **Mintlify** (Hosted SaaS)

**Pros:**

- Beautiful UI out-of-the-box
- Zero infrastructure maintenance
- GitHub Sync for easy updates
- Built-in analytics

**Cons:**

- Hosted SaaS (data privacy concerns for enterprise clients)
- Limited customization (brand colors, layout)
- Pricing per team member ($50–500/month)
- No offline-first support
- Vendor lock-in risk
- Cannot self-host for air-gapped deployments

**Decision:** Rejected due to hosting constraints and lack of self-hosting option.

### 2. **Docusaurus 3** (Meta, React-based)

**Pros:**

- Mature, widely used (React ecosystem)
- Strong MDX support
- Excellent search plugin ecosystem
- Large community

**Cons:**

- Not AI-first (search is keyword-based, not semantic)
- Heavier build times for large doc sites
- More boilerplate for custom components
- Limited OpenAPI integration
- Not optimized for TypeScript SDK generation

**Decision:** Rejected because it lacks AI-first architecture and OpenAPI-native integration.

### 3. **Nextra** (Vercel, Next.js)

**Pros:**

- Lightweight
- Simple file-based routing
- Built by Vercel team
- MDX support

**Cons:**

- Fewer features than Fumadocs
- No built-in OpenAPI support
- Search is third-party integration only
- Minimal theming system
- Community is smaller

**Decision:** Rejected due to lack of OpenAPI and AI search features.

### 4. **GitBook** (Cloud Docs Platform)

**Pros:**

- Beautiful collaborative editor
- Team-based permissions
- Built-in integrations

**Cons:**

- Hosted-only (no self-hosting)
- Expensive for large teams
- Difficult to version control docs with code
- API is restrictive
- Creates fragmented knowledge (docs separate from code repo)

**Decision:** Rejected due to no self-hosting and disconnection from source control.

---

## Fumadocs Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      apps/docs (Next.js App)                    │
│                                                                   │
│  ┌──────────────────┐      ┌──────────────────┐                │
│  │  app/layout.tsx  │      │   app/page.tsx   │                │
│  │  (Root Layout)   │      │  (Landing Page)  │                │
│  └──────────────────┘      └──────────────────┘                │
│           │                           │                          │
│           └─────────────┬─────────────┘                         │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────┐               │
│  │   app/[[...slug]]/page.tsx                  │               │
│  │   (Catch-all Docs Page + Search)            │               │
│  └──────────────┬───────────────────────────────┘               │
│                 │                                                │
│    ┌────────────┼────────────┬──────────────────┐               │
│    │            │            │                  │               │
│    ▼            ▼            ▼                  ▼               │
│ Fumadocs   Sidebar Nav   Breadcrumb       TOC                  │
│ UI         (from MDX)    Navigation      Components            │
│ Theme      Structure     (Auto-gen)      (fumadocs-ui)         │
│                                                                  │
│  ┌──────────────────────────────────────────┐                 │
│  │  app/api/search/route.ts                 │                 │
│  │  (AI-Powered RAG Search via Claude API)  │                 │
│  └──────────┬───────────────────────────────┘                 │
│             │                                                   │
│             ▼                                                   │
│  ┌──────────────────────────────────────────┐                 │
│  │  Anthropic Claude API                    │                 │
│  │  - Semantic Search over doc embeddings  │                 │
│  │  - Context-aware results                │                 │
│  │  - Follow-up Q&A capability             │                 │
│  └──────────────────────────────────────────┘                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
    ┌──────────┐      ┌──────────┐     ┌──────────────┐
    │content/  │      │content/  │     │ packages/sdk │
    │docs/     │      │api/      │     │ (Generated   │
    │(MDX)     │      │(OpenAPI) │     │  from spec)  │
    │          │      │          │     │              │
    │├─guides  │      │├─core    │     │ Sync with    │
    │├─api-ref │      │├─adapters│     │ OpenAPI 3.0  │
    │├─adr     │      │└─webhooks│     │              │
    │└─getting │      └──────────┘     └──────────────┘
    │  started │
    └──────────┘
```

### Data Flow for Search

```
User Query
    │
    ├─→ POST /api/search
    │
    ├─→ Parse and validate query
    │
    ├─→ Retrieve doc embeddings from index
    │   (Pre-computed during build via fumadocs)
    │
    ├─→ Construct RAG prompt:
    │   - User question
    │   - Top-5 relevant doc chunks
    │   - System prompt for context
    │
    ├─→ Call Anthropic Claude API
    │   (claude-opus-4.6 for quality)
    │
    ├─→ Stream response with citations
    │   - Paragraph ID
    │   - Document path
    │   - Relevance score
    │
    └─→ Return JSON with:
        {
          answer: "...",
          citations: [
            { page: "...", section: "...", url: "..." }
          ],
          followUpQuestions: ["...", "...", "..."]
        }
```

---

## Key Design Decisions

### 1. **MDX Content Structure**

```
content/docs/
├── index.mdx                 (Landing / Overview)
├── getting-started/
│   ├── index.mdx             (Quick Start)
│   ├── installation.mdx
│   ├── authentication.mdx
│   ├── first-shipment.mdx
│   └── environment-setup.mdx
├── guides/
│   ├── webhooks.mdx
│   ├── batch-operations.mdx
│   ├── rate-limiting.mdx
│   ├── error-handling.mdx
│   └── deployment.mdx
├── architecture/
│   ├── overview.mdx
│   ├── data-model.mdx
│   ├── authorization.mdx
│   ├── scaling.mdx
│   └── adr-index.mdx
├── api-reference/
│   ├── rest-api.mdx          (Auto-generated from OpenAPI)
│   ├── graphql.mdx
│   ├── webhooks.mdx
│   └── error-codes.mdx
└── troubleshooting/
    ├── common-errors.mdx
    ├── debugging.mdx
    └── performance.mdx
```

### 2. **OpenAPI Integration**

Fumadocs reads OpenAPI 3.0 spec and auto-generates:

- **API endpoint reference** with request/response examples
- **Parameter documentation** (required, types, defaults)
- **Error codes and status handling**
- **TypeScript SDK types** (via OpenAPI code generation)

Location: `content/api/openapi.json` (or `openapi.yaml`)

Generated docs appear at `/docs/api-reference/rest-api` automatically.

### 3. **AI Search Implementation**

The search route (`app/api/search/route.ts`):

1. **Indexes docs during build** - Fumadocs extracts all MDX content
2. **Stores embeddings** - Claude API embeddings (or local mini embeddings)
3. **RAG retrieval** - Matches user query to top doc chunks
4. **LLM synthesis** - Claude generates comprehensive answer with citations
5. **Streaming response** - Returns answer progressively for UX speed

Search features:

- Semantic (not just keyword) matching
- Context-aware follow-up suggestions
- Code example extraction
- Multi-page search results ranked by relevance

### 4. **Theme & Branding**

Witylogix dark theme with:

- **Primary background:** `#0a0a1a` (deep blue-black)
- **Text:** `#e0e0ff` (light periwinkle)
- **Accent:** `#6366f1` (indigo)
- **Success:** `#10b981` (emerald)
- **Error:** `#ef4444` (red)

Uses Tailwind CSS custom properties for consistency with design system.

### 5. **Deployment Strategy**

**Primary: Vercel**

- Deploy as part of monorepo
- Auto-deploy on docs/ changes
- Built-in analytics and preview URLs
- ISR for live API updates

**Secondary: Docker Compose**

- `docker-compose.yml` includes docs service on `:3003`
- Self-hosted option for air-gapped deployments
- Same build pipeline, different host

---

## Implementation Plan

### Phase 1: Foundation (Sprint 4.1)

- Set up Fumadocs + Next.js app structure
- Create initial content directories
- Implement dark theme and branding
- Deploy landing page

### Phase 2: Content (Sprint 4.2)

- Write Getting Started guides
- Document API endpoints (from OpenAPI spec)
- Migrate ADRs from scattered locations
- Add troubleshooting section

### Phase 3: AI Search (Sprint 4.3)

- Implement Claude API integration
- Build search UI component
- Test RAG accuracy on 100+ doc pages
- Add analytics tracking

### Phase 4: Automation (Sprint 4.4)

- Auto-sync TypeScript SDK from OpenAPI
- CI/CD pipeline for doc validation
- Link checker for broken references
- Version management for API docs

---

## Trade-offs Analysis

### **Fumadocs (Chosen)**

| Aspect              | Pro                            | Con                         |
| ------------------- | ------------------------------ | --------------------------- |
| **Customization**   | Full control over layout/theme | Requires more initial setup |
| **Self-hosting**    | Can run on any infrastructure  | Requires maintenance        |
| **Cost**            | Free (open-source)             | Dev time investment         |
| **AI integration**  | Native API-friendly            | Build custom search         |
| **Performance**     | Fast static site gen           | CDN required for scale      |
| **OpenAPI support** | First-class integration        | Config overhead             |

**Best for:** Teams with time/resources to customize, need self-hosting, want OpenAPI-first docs.

### **Mintlify (Not Chosen)**

| Aspect                  | Pro                         | Con               |
| ----------------------- | --------------------------- | ----------------- |
| **Setup time**          | 30 minutes to live          | Vendor lock-in    |
| **Maintenance**         | Zero ops burden             | Hosted dependency |
| **Customization**       | Limited                     | Cannot self-host  |
| **Cost**                | Team pricing ($50–500/mo)   | Not free          |
| **Enterprise features** | SSO, permissions, analytics | May be overkill   |

**Best for:** Non-technical teams, small orgs, prioritize speed over control.

---

## Risk Mitigation

| Risk                                | Probability | Impact | Mitigation                                              |
| ----------------------------------- | ----------- | ------ | ------------------------------------------------------- |
| **Docs fall out of sync with code** | Medium      | High   | Add pre-commit hook to validate doc references          |
| **Search quality poor**             | Medium      | Medium | Use Claude 3.5 Sonnet or better; test on 50+ queries    |
| **Build time grows over time**      | Low         | Medium | Implement incremental builds; archive old versions      |
| **OpenAPI spec not maintained**     | High        | High   | Automate spec generation from source code               |
| **Hosting costs scale**             | Low         | Low    | Vercel free tier handles 10k+ docs; self-host if needed |

---

## Metrics & Success Criteria

**We'll consider this successful when:**

1. **70%+ of API questions answered by docs** (tracked via support volume drop)
2. **Search answers 80%+ of user queries correctly** (semantic match + relevance)
3. **Build time < 5 seconds** on incremental changes
4. **No broken links in docs** (CI check catches regressions)
5. **TypeScript SDK generated and published automatically** (no manual sync)
6. **Docs searchable via semantics** (not just keywords)

---

## Open Questions & Future Work

1. **Versioning:** How to maintain docs for multiple API versions (v1, v2)?
   - Proposal: Folder structure by version `docs/v1/` and `docs/v2/`

2. **Translations:** Should we support non-English docs?
   - Proposal: Phase 2+ using i18n with Fumadocs

3. **Analytics:** Which events should we track?
   - Proposal: Search queries, page views, conversion (signup after docs)

4. **Community:** Should we accept doc contributions from community?
   - Proposal: GitHub-based PR workflow with review process

---

## References

- **Fumadocs:** https://fumadocs.vercel.app/
- **Next.js 15:** https://nextjs.org/
- **Anthropic Claude API:** https://docs.anthropic.com/
- **OpenAPI 3.0:** https://spec.openapis.org/oas/v3.0.3
- **Related ADRs:** ADR-001 (Architecture), ADR-015 (API Design)

---

## Approval Sign-off

- **CTO (AR):** Approved ✓
- **Backend Lead:** Pending
- **DevOps Lead:** Pending
- **Product Manager:** Pending

---

**Next Step:** Begin implementation of Phase 1 (Foundation) in Sprint 4.1.
