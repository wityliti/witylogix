# Developer FAQ

Frequently asked questions about developing on Witylogix.

## Getting Started

### Q: What are the minimum system requirements?

**A**: You need Node.js 20+ LTS, pnpm 9+, Docker, and Git. See `docs/development/SETUP.md` for detailed requirements.

### Q: How do I start developing locally?

**A**: Follow the [Development Setup Guide](./SETUP.md). TL;DR:

```bash
git clone https://github.com/witylogix/witylogix-platform.git
cd witylogix-platform
pnpm install
cp .env.example .env.local
docker compose up -d
pnpm db:migrate
pnpm dev
```

### Q: What IDEs are recommended?

**A**: VS Code is recommended with these extensions:

- TypeScript Vue Plugin
- ESLint
- Prettier
- Tailwind CSS IntelliSense

See `docs/development/SETUP.md` for detailed setup.

## Monorepo Questions

### Q: Why use Turborepo?

**A**: Turborepo provides:

- **Task orchestration**: Run scripts across all packages efficiently
- **Smart caching**: Only rebuild changed packages
- **Parallel execution**: Speed up builds with multiple workers
- **Workspace management**: Easy dependency management across packages
- **Distributed execution**: Scales to cloud CI/CD

### Q: How does the monorepo structure work?

**A**: Witylogix uses a monorepo with:

- **packages/**: Shared libraries (core, db, types, validators, etc.)
- **apps/**: Production applications (api, dashboard, driver-app, etc.)
- **extensions/**: Merchant-facing UI extensions

pnpm workspaces manages dependencies, Turborepo orchestrates tasks.

### Q: How do I add a new package?

**A**:

1. Create directory: `mkdir packages/my-package`
2. Add package.json with unique name: `@witylogix/my-package`
3. Update `pnpm-workspace.yaml` (auto-detected)
4. Reference in other packages: `"@witylogix/my-package": "workspace:*"`

### Q: How do I run a command for a specific package?

**A**:

```bash
# Run in a specific app
cd apps/api && pnpm dev

# Or use Turbo scoping
pnpm dev --filter=api
pnpm test --filter=@witylogix/core
pnpm build --filter=dashboard
```

### Q: Why are some dependencies in workspace?

**A**: Shared dependencies at the root are:

- Build tools (TypeScript, Turbo, Babel)
- Linting (ESLint, Prettier)
- Testing (Jest, Vitest)
- CI/CD tools

App-specific dependencies live in their package.json.

## Database Questions

### Q: What's Row-Level Security (RLS)?

**A**: RLS enforces tenant isolation at the PostgreSQL level:

- Each user can only see their own organization's data
- Policies are defined in migrations
- Enforced by database, not application code
- See `docs/architecture/ARCHITECTURE.md` for details

### Q: How do multi-tenant queries work?

**A**: Every query includes the current tenant context:

```typescript
// Automatically scoped to current tenant
const orders = await prisma.orders.findMany({
  where: {
    tenantId: session.tenantId, // Enforced by Prisma middleware
  },
});
```

### Q: How do I run migrations?

**A**:

```bash
# Create a new migration
pnpm db:create-migration

# Run pending migrations
pnpm db:migrate

# Reset database (dev only)
pnpm db:reset

# Generate Prisma client
pnpm db:generate
```

### Q: Can I modify the schema?

**A**: Yes, follow these steps:

1. Update `packages/db/prisma/schema.prisma`
2. Create migration: `pnpm db:create-migration`
3. Review the generated SQL
4. Apply: `pnpm db:migrate`
5. Commit schema and migration files

### Q: What if migrations conflict?

**A**:

```bash
# Resolve conflicts
git merge origin/main

# Reset local state
pnpm db:reset

# Reapply migrations
pnpm db:migrate
```

## Frontend Questions

### Q: When should I use Server Components vs Client Components?

**A**:

- **Server Components** (default): For data fetching, secure operations, large libraries
- **Client Components**: Only for interactivity (useState, useEffect, event handlers)

See `docs/development/CODE_STYLE.md` for examples.

### Q: How do I use Tailwind CSS?

**A**: Use utility classes:

```tsx
<div className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-900">
  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Title</h1>
</div>
```

No inline styles. Support dark mode. Use `cn()` for conditional classes.

### Q: How is dark mode supported?

**A**: Tailwind handles dark mode:

```tsx
// Automatically respects user preference via CSS media query
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Content
</div>
```

Users toggle dark mode in dashboard settings.

### Q: How do I create a new component?

**A**:

1. Create file: `apps/dashboard/src/components/MyComponent.tsx`
2. Define props interface
3. Export named function component
4. Add to component library if reusable
5. Write tests: `MyComponent.test.tsx`

See component patterns in `docs/development/CODE_STYLE.md`.

### Q: Where should I put custom styles?

**A**: Use Tailwind utilities in className. For global styles:

- CSS modules: `component.module.css` (scoped)
- Global styles: `app.css` (root layout)
- Avoid inline styles

### Q: How do forms work?

**A**: Use Zod for validation + React Hook Form for handling:

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
  });
  // ...
}
```

## Backend Questions

### Q: How does the API structure work?

**A**: Fastify-based API with:

- **Controllers**: HTTP request handlers
- **Services**: Business logic
- **Repositories**: Data access (Prisma)
- **Middleware**: Authentication, validation, logging
- **Routes**: Endpoint definitions

### Q: How do I validate API inputs?

**A**: Use Zod schemas:

```typescript
const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().positive(),
    }),
  ),
});

fastify.post("/orders", async (request) => {
  const data = createOrderSchema.parse(request.body);
  // data is validated and typed
});
```

### Q: How do I handle errors?

**A**: Use custom error classes:

```typescript
class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`);
    this.name = "NotFoundError";
  }
}

async function getOrder(id: string) {
  const order = await prisma.orders.findUnique({ where: { id } });
  if (!order) throw new NotFoundError("Order", id);
  return order;
}
```

### Q: How do I add a new API endpoint?

**A**:

1. Create controller: `apps/api/src/routes/orders.ts`
2. Define routes with Zod validation
3. Implement business logic
4. Register in main server
5. Add tests

See ADR-018 for error handling patterns.

### Q: How do webhooks work?

**A**: Outbound webhooks:

- Store webhook URLs in database
- Sign with HMAC-SHA256
- Retry with exponential backoff
- Circuit breaker for failing endpoints
- See `packages/core/src/webhooks/` for implementation

## Testing Questions

### Q: What's the test coverage target?

**A**:

- **Critical business logic**: 80%+
- **Utilities/helpers**: 70%+
- **UI components**: 50%+

Run `pnpm test --coverage` to check.

### Q: How do I write tests?

**A**: Use Vitest for packages, Jest for apps:

```typescript
describe("calculateDistance", () => {
  it("should calculate distance between coordinates", () => {
    const result = calculateDistance(
      { lat: 40.7128, lon: -74.006 },
      { lat: 34.0522, lon: -118.2437 },
    );
    expect(result).toBeGreaterThan(0);
  });
});
```

See `docs/development/CODE_STYLE.md` for patterns.

### Q: How do I mock database calls?

**A**: Use Prisma mock client:

```typescript
import { PrismaClient } from "@prisma/client";
import { mockDeep } from "jest-mock-extended";

const prismaMock = mockDeep<PrismaClient>();

it("should create order", async () => {
  prismaMock.orders.create.mockResolvedValue({
    id: "123",
    customerId: "cust-1",
    // ...
  });

  const result = await createOrder(prismaMock, data);
  expect(result.id).toBe("123");
});
```

### Q: How do I run E2E tests?

**A**: Use Playwright:

```bash
pnpm test:e2e

# Run specific test
pnpm test:e2e checkout
```

See `PLAYWRIGHT_INTEGRATION.md` for setup.

## Deployment Questions

### Q: How do I deploy the application?

**A**: See `docs/deployment/` for deployment guides:

- Docker Compose for self-hosted
- Cloud deployment (AWS, GCP, Azure)
- Kubernetes support

### Q: What's the deployment checklist?

**A**: Before deploying:

- [ ] All tests pass
- [ ] No type errors
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] API health check passes
- [ ] CDN caches invalidated
- [ ] Monitoring set up

### Q: How do I handle secrets?

**A**: Use environment variables only:

- Never commit secrets
- Use `.env.local` for development
- Use secret managers (AWS Secrets Manager, HashiCorp Vault) for production
- See `docs/deployment/SECRETS_ROTATION.md`

### Q: How do I scale the application?

**A**: Horizontal scaling:

- API is stateless (scale with load balancer)
- Use read replicas for PostgreSQL
- Redis cluster for caching/sessions
- S3 for file storage
- CDN for static assets

See `docs/architecture/ARCHITECTURE.md`.

## Performance Questions

### Q: How do I find performance bottlenecks?

**A**:

```bash
# API profiling
LOG_LEVEL=debug pnpm dev --filter=api

# Check slow queries
SLOW_QUERY_LOG_MS=100 pnpm dev

# Database analysis
EXPLAIN ANALYZE SELECT * FROM orders;
```

### Q: How do I optimize database queries?

**A**:

- Use includes for relationships (avoid N+1)
- Add indexes on frequently queried fields
- Denormalize when necessary
- Profile with EXPLAIN ANALYZE
- Cache frequently accessed data

### Q: How is caching implemented?

**A**: Multiple caching layers:

- **Redis**: Session, cache, queue storage
- **Database query cache**: Prisma client-level
- **API response cache**: Conditional requests
- **CDN**: Static assets

## Troubleshooting

### Q: My local environment won't start

**A**: Follow these steps:

1. Verify system requirements
2. Check Docker is running: `docker ps`
3. Clean and reinstall: `rm -rf node_modules && pnpm install`
4. Reset database: `pnpm db:reset`
5. Check logs: `LOG_LEVEL=debug pnpm dev`

### Q: Tests are failing locally but passing in CI

**A**: Common causes:

- Database state issues: `pnpm db:reset`
- Cache issues: Clear .turbo: `rm -rf .turbo`
- Race conditions: Run individually vs together
- Environment variables: Check `.env.test`

### Q: Port conflicts

**A**: Change ports in `.env.local`:

```env
PORT=8001
DASHBOARD_URL=http://localhost:3001
```

Or kill process: `lsof -i :8000 && kill -9 <PID>`

### Q: Out of memory during build

**A**: Increase Node memory:

```bash
NODE_OPTIONS=--max-old-space-size=4096 pnpm build
```

## Community & Support

### Q: Where can I get help?

**A**:

- **Docs**: https://docs.witylogix.com
- **Discussions**: GitHub Discussions
- **Discord**: https://discord.gg/witylogix
- **Issues**: GitHub Issues

### Q: How do I contribute?

**A**: See `CONTRIBUTING.md` for guidelines. TL;DR:

1. Create feature branch
2. Make changes
3. Write tests
4. Format code
5. Create pull request

### Q: How are contributions recognized?

**A**: Contributors are:

- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Highlighted in community updates
- Can earn badges/roles in Discord

## Additional Resources

- Architecture: `docs/architecture/ARCHITECTURE.md`
- ADRs: `docs/adr/` (Architecture Decision Records)
- API Docs: `apps/docs/` (Fumadocs site)
- Testing Strategy: `docs/testing-strategy.md`
- Contributing: `CONTRIBUTING.md`
- Code Style: `docs/development/CODE_STYLE.md`
