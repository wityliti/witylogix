# Witylogix Phase 1 Testing Strategy

**Document Version:** 1.0
**Last Updated:** 2026-03-06
**Author:** QA Lead (KS)
**Status:** Active

---

## Executive Summary

This document outlines a comprehensive testing strategy for the Witylogix Phase 1 platform—a Shopify-integrated last-mile delivery logistics SaaS. The strategy emphasizes quality assurance across a Turborepo monorepo architecture while prioritizing multi-tenant data isolation, shipment state machine integrity, and secure template rendering.

### Critical Success Factors

1. **Multi-tenant RLS enforcement** — Zero tolerance for data leakage between tenants
2. **State machine correctness** — All 11 shipment states and transitions validated
3. **Template rendering security** — Protection against injection attacks and variable interpolation errors
4. **API contract compliance** — All Fastify endpoints validate against Zod schemas
5. **Dashboard stability** — Client-side rendering and state management reliability

---

## 1. Testing Pyramid & Coverage Strategy

### 1.1 Test Distribution Target

```
                       /\
                      /  \          E2E Tests (~15%)
                     /----\         - Full user workflows
                    /      \        - Cross-feature integration
                   /        \       - Deployment validation
                  /          \
                 /____________\
                /              \
               /                \    Integration Tests (~40%)
              /                  \   - Package interactions
             /____________________\  - API + DB + Cache
            /                      \
           /                        \
          /___________________________\
         /                             \ Unit Tests (~45%)
        /                               \ - Isolated functions
       /_________________________________\ - Validators, renderers, logic
```

**Target Coverage Ratios:**

- **Unit Tests: 45%** (2,000+ tests) — Fast feedback, isolated validation
- **Integration Tests: 40%** (1,500+ tests) — Cross-package interactions, real dependencies
- **E2E Tests: 15%** (400+ tests) — Critical user journeys, full platform validation

**Overall Coverage Target:** ≥85% code coverage, with 100% coverage for:

- Multi-tenant RLS logic
- Shipment state transitions
- Template renderer core functions
- Zod validators

---

## 2. Package-Specific Test Plans

### 2.1 `packages/validators` — Zod Schema Validation

**Purpose:** Validate all API request/response payloads and form inputs
**Test Runner:** Vitest
**Coverage Target:** 100%

#### Test Categories

**A. Schema Structure Tests**

- Valid input acceptance (happy path)
- Type coercion (strings → numbers, booleans)
- Required vs. optional field handling
- Nested object validation
- Array item validation

**B. Edge Case Tests**

- Empty strings, null, undefined
- Boundary values (min/max lengths, numeric ranges)
- Special characters and Unicode handling
- ISO date parsing and validation
- Email and URL format validation
- Enum value validation

**C. Custom Refinement Tests**

- Cross-field validation (e.g., `endDate > startDate`)
- Conditional field requirements
- Custom error messages
- Async validation (e.g., slug uniqueness)

#### Sample Test File: `packages/validators/__tests__/shipment.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import {
  ShipmentCreateSchema,
  ShipmentUpdateSchema,
  ShipmentFilterSchema,
} from "../schemas/shipment";

describe("Shipment Validators", () => {
  describe("ShipmentCreateSchema", () => {
    it("should accept valid shipment creation payload", () => {
      const valid = {
        recipientName: "John Doe",
        recipientPhone: "+12125551234",
        recipientAddress: "123 Main St, NYC, NY 10001",
        items: [{ sku: "ITEM001", quantity: 2 }],
        estimatedDeliveryDate: "2026-03-10",
        assignedDriverId: "driver_abc123",
      };
      const result = ShipmentCreateSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject missing required fields", () => {
      const invalid = { recipientName: "John Doe" };
      const result = ShipmentCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      expect(result.error?.errors.length).toBeGreaterThan(0);
    });

    it("should reject invalid phone format", () => {
      const invalid = {
        recipientName: "John Doe",
        recipientPhone: "invalid-phone",
        recipientAddress: "123 Main St, NYC, NY 10001",
        items: [{ sku: "ITEM001", quantity: 1 }],
      };
      const result = ShipmentCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject empty items array", () => {
      const invalid = {
        recipientName: "John Doe",
        recipientPhone: "+12125551234",
        recipientAddress: "123 Main St, NYC, NY 10001",
        items: [],
      };
      const result = ShipmentCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should enforce max shipment items limit", () => {
      const invalid = {
        recipientName: "John Doe",
        recipientPhone: "+12125551234",
        recipientAddress: "123 Main St, NYC, NY 10001",
        items: Array.from({ length: 101 }, (_, i) => ({
          sku: `ITEM${i}`,
          quantity: 1,
        })),
      };
      const result = ShipmentCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should enforce date constraints", () => {
      const invalid = {
        recipientName: "John Doe",
        recipientPhone: "+12125551234",
        recipientAddress: "123 Main St, NYC, NY 10001",
        items: [{ sku: "ITEM001", quantity: 1 }],
        estimatedDeliveryDate: "2026-01-01", // Past date
      };
      const result = ShipmentCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("ShipmentFilterSchema", () => {
    it("should accept valid filter combinations", () => {
      const valid = {
        status: "in_transit",
        driverId: "driver_abc123",
        sortBy: "createdAt",
        sortOrder: "desc",
        limit: 50,
        offset: 0,
      };
      const result = ShipmentFilterSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should enforce limit boundaries", () => {
      const invalid = { limit: 500 }; // Exceeds max
      const result = ShipmentFilterSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid status values", () => {
      const invalid = { status: "invalid_status" };
      const result = ShipmentFilterSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
```

---

### 2.2 `packages/db` — Prisma Client & RLS

**Purpose:** Enforce multi-tenant data isolation and query integrity
**Test Runner:** Vitest with Docker Postgres or PGlite
**Coverage Target:** 100% for RLS logic, 85% overall

#### Critical Test Areas

**A. Multi-Tenant RLS Isolation Tests**

- Tenant A cannot query tenant B's data
- RLS policy enforcement at database layer
- Cross-tenant queries return 403/Unauthorized
- RLS policies apply to all CRUD operations

**B. Schema Integrity Tests**

- 18 modular schema files produce valid Prisma schema
- Relationships are bidirectional and correct
- Indexes are applied to high-query columns
- Unique constraints are properly defined

**C. Query Safety Tests**

- Prepared statements prevent SQL injection
- Parameterized queries used throughout
- No hardcoded tenant filtering (enforced by RLS)

#### Sample Test File: `packages/db/__tests__/rls.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getOrCreateTestTenant } from "../test-utils/tenant-factory";
import { sql } from "@prisma/client/runtime/library";

describe("Multi-Tenant RLS Isolation", () => {
  let tenantADb: PrismaClient;
  let tenantBDb: PrismaClient;
  let tenantAId: string;
  let tenantBId: string;

  beforeEach(async () => {
    // Create isolated test tenants
    const [tenantA, tenantB] = await Promise.all([
      getOrCreateTestTenant("tenant-a-" + Date.now()),
      getOrCreateTestTenant("tenant-b-" + Date.now()),
    ]);

    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    // Create Prisma clients with tenant context
    tenantADb = new PrismaClient({
      errorFormat: "pretty",
    });
    tenantBDb = new PrismaClient({
      errorFormat: "pretty",
    });

    // Set RLS tenant context (mock implementation)
    await tenantADb.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant_id', $1, true)`,
      tenantAId,
    );
    await tenantBDb.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant_id', $1, true)`,
      tenantBId,
    );
  });

  afterEach(async () => {
    await tenantADb.$disconnect();
    await tenantBDb.$disconnect();
  });

  it("should prevent Tenant A from reading Tenant B shipments", async () => {
    // Tenant B creates a shipment
    const shipmentB = await tenantBDb.shipment.create({
      data: {
        recipientName: "Tenant B Customer",
        recipientPhone: "+12025551234",
        recipientAddress: "456 Oak Ave",
        status: "pending",
        tenantId: tenantBId,
      },
    });

    // Tenant A attempts to read it
    const result = await tenantADb.shipment.findUnique({
      where: { id: shipmentB.id },
    });

    expect(result).toBeNull(); // RLS should hide it
  });

  it("should prevent Tenant A from updating Tenant B shipments", async () => {
    const shipmentB = await tenantBDb.shipment.create({
      data: {
        recipientName: "Tenant B Customer",
        recipientPhone: "+12025551234",
        recipientAddress: "456 Oak Ave",
        status: "pending",
        tenantId: tenantBId,
      },
    });

    // Tenant A attempts to update
    const updatePromise = tenantADb.shipment.update({
      where: { id: shipmentB.id },
      data: { status: "in_transit" },
    });

    // Should throw or return 0 rows affected
    await expect(updatePromise).rejects.toThrow();
  });

  it("should prevent Tenant A from deleting Tenant B shipments", async () => {
    const shipmentB = await tenantBDb.shipment.create({
      data: {
        recipientName: "Tenant B Customer",
        recipientPhone: "+12025551234",
        recipientAddress: "456 Oak Ave",
        status: "pending",
        tenantId: tenantBId,
      },
    });

    const deletePromise = tenantADb.shipment.delete({
      where: { id: shipmentB.id },
    });

    await expect(deletePromise).rejects.toThrow();
  });

  it("should allow Tenant A to access only own shipments via list query", async () => {
    const shipmentA = await tenantADb.shipment.create({
      data: {
        recipientName: "Tenant A Customer",
        recipientPhone: "+12125551234",
        recipientAddress: "123 Main St",
        status: "pending",
        tenantId: tenantAId,
      },
    });

    await tenantBDb.shipment.create({
      data: {
        recipientName: "Tenant B Customer",
        recipientPhone: "+12025551234",
        recipientAddress: "456 Oak Ave",
        status: "pending",
        tenantId: tenantBId,
      },
    });

    const shipments = await tenantADb.shipment.findMany();

    expect(shipments).toHaveLength(1);
    expect(shipments[0].id).toBe(shipmentA.id);
  });

  it("should enforce RLS on related queries (drivers)", async () => {
    const driverB = await tenantBDb.driver.create({
      data: {
        name: "Tenant B Driver",
        phone: "+12025559999",
        status: "active",
        tenantId: tenantBId,
      },
    });

    // Tenant A attempts to access via relationship
    const resultDirect = await tenantADb.driver.findUnique({
      where: { id: driverB.id },
    });

    expect(resultDirect).toBeNull();
  });

  it("should audit RLS violations", async () => {
    // Attempt a cross-tenant query
    const unauthorizedAccess = await tenantADb.shipment.findMany({
      where: { tenantId: tenantBId }, // Explicit cross-tenant filter
    });

    // Should return empty due to RLS, not by client-side filtering
    expect(unauthorizedAccess).toHaveLength(0);
  });
});
```

#### Schema Integrity Test: `packages/db/__tests__/schema.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";

describe("Prisma Schema Integrity", () => {
  const prisma = new PrismaClient();

  it("should load schema without errors", async () => {
    // If Prisma fails to load, this test fails
    const version = await prisma.$queryRaw`SELECT VERSION()`;
    expect(version).toBeDefined();
  });

  it("should have all required models", async () => {
    const models = [
      "Tenant",
      "Shipment",
      "Driver",
      "Route",
      "Notification",
      "Template",
      "ApiKey",
      "AuditLog",
    ];

    for (const model of models) {
      expect(prisma[model]).toBeDefined();
    }
  });

  it("should enforce unique constraints on email", async () => {
    const tenantId = "test-tenant-" + Date.now();

    const user1 = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        tenantId,
      },
    });

    const duplicatePromise = prisma.user.create({
      data: {
        email: user1.email,
        tenantId,
      },
    });

    await expect(duplicatePromise).rejects.toThrow();
    await prisma.user.delete({ where: { id: user1.id } });
  });

  it("should cascade delete related records", async () => {
    const tenant = await prisma.tenant.create({
      data: { name: "Test Tenant " + Date.now() },
    });

    const shipment = await prisma.shipment.create({
      data: {
        tenantId: tenant.id,
        status: "pending",
        recipientName: "Test",
        recipientPhone: "+12125551234",
        recipientAddress: "Test",
      },
    });

    await prisma.tenant.delete({ where: { id: tenant.id } });

    const deletedShipment = await prisma.shipment.findUnique({
      where: { id: shipment.id },
    });

    expect(deletedShipment).toBeNull();
  });
});
```

---

### 2.3 `packages/core` — Business Logic & Template Renderer

**Purpose:** Test domain logic, shipment state machine, and template rendering
**Test Runner:** Vitest
**Coverage Target:** 100% for state machine, 95% for renderers

#### Critical Test Areas

**A. Shipment State Machine**

```
pending → assigned → in_transit → delivered (final)
       ↓
     cancelled (final)

pending → unassigned → re_routed → in_transit → delivered
assigned → on_hold → assigned → in_transit
in_transit → exception → in_transit → delivered
```

Valid transitions only; invalid transitions throw `InvalidStateTransitionError`

**B. Template Renderer**

- Variable interpolation: `{{ variable }}`
- Conditionals: `{% if condition %}...{% endif %}`
- Loops: `{% for item in items %}...{% endfor %}`
- HTML escaping to prevent XSS
- Missing variable handling

**C. Notification Logic**

- Correct notification types triggered on state changes
- Notification payloads interpolated correctly
- Scheduled notifications queued

#### Sample Test File: `packages/core/__tests__/state-machine.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { ShipmentStateMachine } from "../state-machine";
import { InvalidStateTransitionError } from "../errors";

describe("Shipment State Machine", () => {
  const machine = new ShipmentStateMachine();

  it("should initialize in pending state", () => {
    const state = machine.getCurrentState("shipment_123");
    expect(state).toBe("pending");
  });

  describe("Valid Transitions", () => {
    it("should transition pending → assigned", () => {
      const result = machine.transition("shipment_123", "pending", "assigned");
      expect(result.newState).toBe("assigned");
      expect(result.timestamp).toBeDefined();
    });

    it("should transition assigned → in_transit", () => {
      machine.transition("shipment_123", "assigned", "in_transit");
      const result = machine.transition(
        "shipment_123",
        "in_transit",
        "delivered",
      );
      expect(result.newState).toBe("delivered");
    });

    it("should transition pending → cancelled", () => {
      const result = machine.transition(
        "shipment_cancel_123",
        "pending",
        "cancelled",
      );
      expect(result.newState).toBe("cancelled");
    });

    it("should support on_hold from assigned", () => {
      machine.transition("shipment_hold_123", "pending", "assigned");
      const result = machine.transition(
        "shipment_hold_123",
        "assigned",
        "on_hold",
      );
      expect(result.newState).toBe("on_hold");
    });

    it("should allow recovery from on_hold → assigned", () => {
      machine.transition("shipment_recover_123", "pending", "assigned");
      machine.transition("shipment_recover_123", "assigned", "on_hold");
      const result = machine.transition(
        "shipment_recover_123",
        "on_hold",
        "assigned",
      );
      expect(result.newState).toBe("assigned");
    });

    it("should transition in_transit → exception", () => {
      machine.transition("shipment_exc_123", "pending", "assigned");
      machine.transition("shipment_exc_123", "assigned", "in_transit");
      const result = machine.transition(
        "shipment_exc_123",
        "in_transit",
        "exception",
      );
      expect(result.newState).toBe("exception");
    });

    it("should recover from exception → in_transit", () => {
      machine.transition("shipment_exc_recover_123", "pending", "assigned");
      machine.transition("shipment_exc_recover_123", "assigned", "in_transit");
      machine.transition("shipment_exc_recover_123", "in_transit", "exception");
      const result = machine.transition(
        "shipment_exc_recover_123",
        "exception",
        "in_transit",
      );
      expect(result.newState).toBe("in_transit");
    });
  });

  describe("Invalid Transitions", () => {
    it("should reject pending → in_transit (skip assigned)", () => {
      expect(() => {
        machine.transition("shipment_invalid_123", "pending", "in_transit");
      }).toThrow(InvalidStateTransitionError);
    });

    it("should reject delivered → any state", () => {
      machine.transition("shipment_final_123", "pending", "assigned");
      machine.transition("shipment_final_123", "assigned", "in_transit");
      machine.transition("shipment_final_123", "in_transit", "delivered");

      expect(() => {
        machine.transition("shipment_final_123", "delivered", "in_transit");
      }).toThrow(InvalidStateTransitionError);
    });

    it("should reject cancelled → any state", () => {
      machine.transition("shipment_cancelled_123", "pending", "cancelled");

      expect(() => {
        machine.transition("shipment_cancelled_123", "cancelled", "assigned");
      }).toThrow(InvalidStateTransitionError);
    });

    it("should reject in_transit → pending", () => {
      machine.transition("shipment_backward_123", "pending", "assigned");
      machine.transition("shipment_backward_123", "assigned", "in_transit");

      expect(() => {
        machine.transition("shipment_backward_123", "in_transit", "pending");
      }).toThrow(InvalidStateTransitionError);
    });

    it("should reject assigned → in_transit from on_hold", () => {
      machine.transition("shipment_hold_skip_123", "pending", "assigned");
      machine.transition("shipment_hold_skip_123", "assigned", "on_hold");

      expect(() => {
        machine.transition("shipment_hold_skip_123", "on_hold", "delivered");
      }).toThrow(InvalidStateTransitionError);
    });
  });

  describe("Final States", () => {
    it("should mark delivered as terminal", () => {
      expect(machine.isTerminal("delivered")).toBe(true);
    });

    it("should mark cancelled as terminal", () => {
      expect(machine.isTerminal("cancelled")).toBe(true);
    });

    it("should not mark intermediate states as terminal", () => {
      expect(machine.isTerminal("pending")).toBe(false);
      expect(machine.isTerminal("assigned")).toBe(false);
      expect(machine.isTerminal("in_transit")).toBe(false);
    });
  });

  describe("Transition History", () => {
    it("should record full transition history", () => {
      const shipmentId = "shipment_history_123";
      machine.transition(shipmentId, "pending", "assigned");
      machine.transition(shipmentId, "assigned", "in_transit");
      machine.transition(shipmentId, "in_transit", "delivered");

      const history = machine.getHistory(shipmentId);
      expect(history).toHaveLength(3);
      expect(history[0].fromState).toBe("pending");
      expect(history[2].toState).toBe("delivered");
    });
  });
});
```

#### Template Renderer Tests: `packages/core/__tests__/template-renderer.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { TemplateRenderer } from "../template-renderer";

describe("Template Renderer", () => {
  const renderer = new TemplateRenderer();

  describe("Variable Interpolation", () => {
    it("should interpolate single variable", () => {
      const template = "Hello {{ name }}!";
      const result = renderer.render(template, { name: "John" });
      expect(result).toBe("Hello John!");
    });

    it("should interpolate multiple variables", () => {
      const template =
        "{{ greeting }} {{ name }}, your order #{{ orderId }} is {{ status }}.";
      const result = renderer.render(template, {
        greeting: "Hi",
        name: "Jane",
        orderId: "12345",
        status: "delivered",
      });
      expect(result).toBe("Hi Jane, your order #12345 is delivered.");
    });

    it("should handle missing variables gracefully", () => {
      const template = "Hello {{ name }}, your order is {{ status }}.";
      const result = renderer.render(template, { name: "John" });
      expect(result).toBe("Hello John, your order is .");
    });

    it("should handle nested object access", () => {
      const template =
        "Delivering to {{ recipient.name }} at {{ recipient.address }}.";
      const result = renderer.render(template, {
        recipient: { name: "Alice", address: "123 Main St" },
      });
      expect(result).toBe("Delivering to Alice at 123 Main St.");
    });

    it("should HTML escape variables to prevent XSS", () => {
      const template = "Recipient: {{ name }}";
      const result = renderer.render(template, {
        name: '<script>alert("xss")</script>',
      });
      expect(result).toBe(
        "Recipient: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
      );
      expect(result).not.toContain("<script>");
    });

    it("should handle numeric variables", () => {
      const template = "Total: ${{ amount }}";
      const result = renderer.render(template, { amount: 99.99 });
      expect(result).toBe("Total: $99.99");
    });

    it("should handle boolean variables", () => {
      const template = "Is fragile: {{ isFragile }}";
      const result = renderer.render(template, { isFragile: true });
      expect(result).toBe("Is fragile: true");
    });
  });

  describe("Conditionals", () => {
    it("should render if block when condition is true", () => {
      const template =
        '{% if status === "delivered" %}Package delivered!{% endif %}';
      const result = renderer.render(template, { status: "delivered" });
      expect(result).toBe("Package delivered!");
    });

    it("should skip if block when condition is false", () => {
      const template =
        '{% if status === "delivered" %}Package delivered!{% endif %}';
      const result = renderer.render(template, { status: "in_transit" });
      expect(result).toBe("");
    });

    it("should support if-else blocks", () => {
      const template =
        '{% if status === "delivered" %}Delivered{% else %}In transit{% endif %}';

      const deliveredResult = renderer.render(template, {
        status: "delivered",
      });
      expect(deliveredResult).toBe("Delivered");

      const transitResult = renderer.render(template, { status: "in_transit" });
      expect(transitResult).toBe("In transit");
    });

    it("should support nested conditionals", () => {
      const template = `{% if hasDriver %}
        {% if driverArrived %}Driver arrived!{% else %}Driver en route{% endif %}
      {% else %}No driver assigned{% endif %}`;

      const withDriverArrived = renderer.render(template, {
        hasDriver: true,
        driverArrived: true,
      });
      expect(withDriverArrived).toContain("Driver arrived!");

      const withDriver = renderer.render(template, {
        hasDriver: true,
        driverArrived: false,
      });
      expect(withDriver).toContain("Driver en route");

      const noDriver = renderer.render(template, { hasDriver: false });
      expect(noDriver).toContain("No driver assigned");
    });
  });

  describe("Loops", () => {
    it("should iterate over arrays", () => {
      const template = "{% for item in items %}{{ item.name }}, {% endfor %}";
      const result = renderer.render(template, {
        items: [{ name: "Apple" }, { name: "Banana" }, { name: "Cherry" }],
      });
      expect(result).toBe("Apple, Banana, Cherry, ");
    });

    it("should support loop index", () => {
      const template =
        "{% for item in items %}#{{ @index }}: {{ item }} {% endfor %}";
      const result = renderer.render(template, {
        items: ["a", "b", "c"],
      });
      expect(result).toContain("#0: a");
      expect(result).toContain("#1: b");
      expect(result).toContain("#2: c");
    });

    it("should handle empty arrays", () => {
      const template = "{% for item in items %}{{ item }}{% endfor %}No items!";
      const result = renderer.render(template, { items: [] });
      expect(result).toBe("No items!");
    });

    it("should support nested loops", () => {
      const template = `{% for order in orders %}
        Order #{{ order.id }}: {% for item in order.items %}{{ item }}, {% endfor %}\n
      {% endfor %}`;
      const result = renderer.render(template, {
        orders: [
          { id: "1", items: ["A", "B"] },
          { id: "2", items: ["C"] },
        ],
      });
      expect(result).toContain("Order #1:");
      expect(result).toContain("A, B");
    });
  });

  describe("Security & Edge Cases", () => {
    it("should prevent injection attacks via template syntax", () => {
      const malicious = '{{ system.execute("rm -rf /") }}';
      expect(() => renderer.render(malicious, {})).not.toThrow();
    });

    it("should handle very long strings", () => {
      const longString = "A".repeat(10000);
      const template = "{{ text }}";
      const result = renderer.render(template, { text: longString });
      expect(result.length).toBe(10000);
    });

    it("should escape HTML in conditionals", () => {
      const template = "{% if safe %}<b>Bold</b>{% endif %}";
      const result = renderer.render(template, {
        safe: "<img src=x onerror=alert(1)>",
      });
      expect(result).not.toContain("<img src=x");
    });
  });
});
```

---

### 2.4 `apps/api` — Fastify REST API

**Purpose:** Validate API routes, request handling, error responses, and data contracts
**Test Runner:** Vitest + Supertest
**Coverage Target:** 90% (all critical paths, edge cases)

#### Test Coverage Areas

**A. Route Response Validation**

- Correct HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Response body matches schema
- Error messages are descriptive
- Rate limiting headers present

**B. Authentication & Authorization**

- Valid JWT tokens accepted
- Expired tokens rejected
- Missing auth header returns 401
- Cross-tenant access returns 403
- API key validation

**C. Data Validation**

- Zod schema validation on request
- Invalid data returns 400 with error details
- Type coercion works as expected

**D. Error Handling**

- Unhandled errors return 500 with message
- Validation errors return 400
- Not found errors return 404
- Conflict errors return 409

#### Sample Test File: `apps/api/__tests__/shipments.route.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createTestApp } from "../test-utils/app-factory";
import { createTestUser, createTestShipment } from "../test-utils/data-factory";

describe("POST /api/v1/shipments", () => {
  let app: FastifyInstance;
  let authToken: string;
  let tenantId: string;

  beforeEach(async () => {
    app = await createTestApp();
    const user = await createTestUser();
    tenantId = user.tenantId;
    authToken = user.token;
  });

  afterEach(async () => {
    await app.close();
  });

  describe("Create Shipment", () => {
    it("should create shipment with valid payload", async () => {
      const payload = {
        recipientName: "John Doe",
        recipientPhone: "+12125551234",
        recipientAddress: "123 Main St, NYC, NY 10001",
        items: [{ sku: "ITEM001", quantity: 2, weight: 2.5 }],
        estimatedDeliveryDate: "2026-03-10",
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/shipments",
        headers: { Authorization: `Bearer ${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.status).toBe("pending");
      expect(body.tenantId).toBe(tenantId);
    });

    it("should return 400 for missing required fields", async () => {
      const payload = {
        recipientName: "John Doe",
        // Missing recipientPhone, recipientAddress, items
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/shipments",
        headers: { Authorization: `Bearer ${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.details).toContain("recipientPhone");
    });

    it("should return 401 for missing auth token", async () => {
      const payload = {
        recipientName: "John Doe",
        recipientPhone: "+12125551234",
        recipientAddress: "123 Main St, NYC, NY 10001",
        items: [{ sku: "ITEM001", quantity: 1 }],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/shipments",
        payload,
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 400 for invalid phone format", async () => {
      const payload = {
        recipientName: "John Doe",
        recipientPhone: "invalid-phone",
        recipientAddress: "123 Main St, NYC, NY 10001",
        items: [{ sku: "ITEM001", quantity: 1 }],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/shipments",
        headers: { Authorization: `Bearer ${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for empty items array", async () => {
      const payload = {
        recipientName: "John Doe",
        recipientPhone: "+12125551234",
        recipientAddress: "123 Main St, NYC, NY 10001",
        items: [],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/shipments",
        headers: { Authorization: `Bearer ${authToken}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/v1/shipments/:id", () => {
    it("should retrieve shipment by ID", async () => {
      const shipment = await createTestShipment(tenantId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/shipments/${shipment.id}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(shipment.id);
      expect(body.recipientName).toBe(shipment.recipientName);
    });

    it("should return 404 for non-existent shipment", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/shipments/nonexistent_id",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 403 for cross-tenant access", async () => {
      const otherUserToken = (
        await createTestUser({ tenantId: "other-tenant" })
      ).token;
      const shipment = await createTestShipment(tenantId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/shipments/${shipment.id}`,
        headers: { Authorization: `Bearer ${otherUserToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PATCH /api/v1/shipments/:id", () => {
    it("should update shipment status via state transition", async () => {
      const shipment = await createTestShipment(tenantId, {
        status: "pending",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/shipments/${shipment.id}`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { status: "assigned", driverId: "driver_123" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("assigned");
    });

    it("should reject invalid state transitions", async () => {
      const shipment = await createTestShipment(tenantId, {
        status: "pending",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/shipments/${shipment.id}`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { status: "in_transit" }, // Invalid: skip assigned
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Invalid state transition");
    });

    it("should return 409 for state conflict", async () => {
      const shipment = await createTestShipment(tenantId, {
        status: "delivered",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/shipments/${shipment.id}`,
        headers: { Authorization: `Bearer ${authToken}` },
        payload: { status: "in_transit" },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe("GET /api/v1/shipments (list)", () => {
    it("should list shipments for current tenant", async () => {
      const shipment1 = await createTestShipment(tenantId);
      const shipment2 = await createTestShipment(tenantId);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/shipments",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("should support pagination", async () => {
      for (let i = 0; i < 15; i++) {
        await createTestShipment(tenantId);
      }

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/shipments?limit=10&offset=0",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(10);
      expect(body.total).toBe(15);
    });

    it("should filter by status", async () => {
      await createTestShipment(tenantId, { status: "pending" });
      await createTestShipment(tenantId, { status: "in_transit" });
      await createTestShipment(tenantId, { status: "in_transit" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/shipments?status=in_transit",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
    });

    it("should not leak other tenant shipments", async () => {
      const otherUserToken = (
        await createTestUser({ tenantId: "other-tenant" })
      ).token;

      await createTestShipment(tenantId);
      await createTestShipment("other-tenant");

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/shipments",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
    });
  });
});
```

---

### 2.5 `apps/dashboard` — Next.js App Router Frontend

**Purpose:** Test React components, page rendering, state management, and user interactions
**Test Runner:** Vitest + React Testing Library
**Coverage Target:** 80% (focus on UI logic, not styling)

#### Test Coverage Areas

**A. Component Unit Tests**

- Props validation
- Conditional rendering
- Event handlers
- State updates

**B. Page Integration Tests**

- Server-side data fetching (getServerSideProps equivalent)
- Client-side rendering
- Navigation between pages
- Form submissions

**C. User Interaction Tests**

- Button clicks
- Form input and validation
- Filtering and sorting
- Modal open/close
- Toast notifications

#### Sample Test File: `apps/dashboard/__tests__/pages/shipments.test.tsx`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShipmentsPage } from '../../pages/shipments';
import { mockShipments } from '../fixtures/shipments';

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: {},
    push: vi.fn()
  })
}));

describe('ShipmentsPage', () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should render shipments list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockShipments, total: 2 })
    });

    render(<ShipmentsPage initialData={{ data: mockShipments, total: 2 }} />);

    expect(screen.getByText('Shipments')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should display shipment status badge', () => {
    const shipmentWithStatus = [
      { ...mockShipments[0], status: 'pending' },
      { ...mockShipments[1], status: 'in_transit' }
    ];

    render(<ShipmentsPage initialData={{ data: shipmentWithStatus, total: 2 }} />);

    expect(screen.getByText('pending')).toHaveClass('badge-pending');
    expect(screen.getByText('in_transit')).toHaveClass('badge-in-transit');
  });

  it('should filter shipments by status', async () => {
    const user = userEvent.setup();
    render(<ShipmentsPage initialData={{ data: mockShipments, total: 2 }} />);

    const statusFilter = screen.getByRole('combobox', { name: /status/i });
    await user.click(statusFilter);
    await user.click(screen.getByRole('option', { name: /pending/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=pending')
      );
    });
  });

  it('should sort shipments by date', async () => {
    const user = userEvent.setup();
    render(<ShipmentsPage initialData={{ data: mockShipments, total: 2 }} />);

    const sortButton = screen.getByRole('button', { name: /sort by date/i });
    await user.click(sortButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('sortBy=createdAt&sortOrder=desc')
      );
    });
  });

  it('should paginate shipments', async () => {
    const user = userEvent.setup();
    render(<ShipmentsPage initialData={{ data: mockShipments, total: 50 }} />);

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=20')
      );
    });
  });

  it('should navigate to shipment detail page', async () => {
    const user = userEvent.setup();
    const mockRouter = vi.mocked(require('next/router').useRouter());

    render(<ShipmentsPage initialData={{ data: mockShipments, total: 2 }} />);

    const firstShipmentRow = screen.getByText('John Doe').closest('tr');
    await user.click(firstShipmentRow);

    expect(mockRouter.push).toHaveBeenCalledWith(
      `/shipments/${mockShipments[0].id}`
    );
  });
});
```

#### Component Test: `apps/dashboard/__tests__/components/shipment-card.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShipmentCard } from '../../components/shipment-card';

describe('ShipmentCard Component', () => {
  const mockShipment = {
    id: 'shipment_123',
    recipientName: 'John Doe',
    recipientAddress: '123 Main St, NYC',
    status: 'in_transit',
    estimatedDeliveryDate: '2026-03-10'
  };

  it('should render shipment information', () => {
    render(<ShipmentCard shipment={mockShipment} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('123 Main St, NYC')).toBeInTheDocument();
    expect(screen.getByText('in_transit')).toBeInTheDocument();
  });

  it('should apply correct status color class', () => {
    render(<ShipmentCard shipment={mockShipment} />);

    const statusBadge = screen.getByText('in_transit');
    expect(statusBadge).toHaveClass('badge-in-transit');
  });

  it('should format delivery date', () => {
    render(<ShipmentCard shipment={mockShipment} />);

    expect(screen.getByText(/March 10, 2026/i)).toBeInTheDocument();
  });

  it('should be clickable and call onClick handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<ShipmentCard shipment={mockShipment} onClick={onClick} />);

    const card = screen.getByRole('button');
    await user.click(card);

    expect(onClick).toHaveBeenCalledWith(mockShipment.id);
  });

  it('should show action buttons for pending status', () => {
    const pendingShipment = { ...mockShipment, status: 'pending' };
    render(<ShipmentCard shipment={pendingShipment} />);

    expect(screen.getByRole('button', { name: /assign driver/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should not show action buttons for delivered status', () => {
    const deliveredShipment = { ...mockShipment, status: 'delivered' };
    render(<ShipmentCard shipment={deliveredShipment} />);

    expect(screen.queryByRole('button', { name: /assign driver/i })).not.toBeInTheDocument();
  });
});
```

---

## 3. Critical Test Scenarios

### 3.1 Multi-Tenant RLS Bypass Prevention

**Threat:** Attacker crafts malicious queries to access cross-tenant data
**Test Strategy:** Attempt RLS bypass via:

- Direct query manipulation
- Relationship traversal
- Subquery injection
- UPDATE/DELETE without tenant filter

**Test Case:**

```typescript
it('should prevent RLS bypass via explicit cross-tenant filter', async () => {
  // Create shipments in two tenants
  const tenantAShipment = await tenantADb.shipment.create({...});
  const tenantBShipment = await tenantBDb.shipment.create({...});

  // Attempt explicit cross-tenant query
  const result = await tenantADb.shipment.findMany({
    where: { tenantId: tenantBId }
  });

  // RLS should prevent access
  expect(result).toHaveLength(0);
});
```

### 3.2 Shipment State Machine Invalid Transitions

**Threat:** Invalid state transitions corrupt shipment data
**Test Strategy:** Attempt all invalid transitions from each state
**Coverage:** All 11 states × invalid transitions = 50+ test cases

**Test Case:**

```typescript
it("should prevent delivery of cancelled shipment", async () => {
  machine.transition(shipmentId, "pending", "cancelled");

  expect(() => {
    machine.transition(shipmentId, "cancelled", "delivered");
  }).toThrow(InvalidStateTransitionError);
});
```

### 3.3 Template Injection Attacks

**Threat:** Malicious variables or conditionals in templates execute code
**Test Strategy:**

- HTML/JS injection via variables
- Template syntax injection
- Path traversal in file includes
- Infinite loops in conditionals

**Test Case:**

```typescript
it("should escape HTML in interpolated variables", () => {
  const template = "Message: {{ userInput }}";
  const malicious = '<img src=x onerror="alert(1)">';

  const result = renderer.render(template, { userInput: malicious });
  expect(result).not.toContain("<img src=x");
  expect(result).toContain("&lt;img");
});
```

### 3.4 API Route Validation Bypass

**Threat:** Invalid payloads bypass validation and corrupt data
**Test Strategy:** Fuzz API endpoints with malformed data

**Test Case:**

```typescript
it("should reject oversized payload", async () => {
  const hugePayload = {
    items: Array(1000).fill({ sku: "TEST", quantity: 1 }),
  };

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/shipments",
    headers: { Authorization: `Bearer ${authToken}` },
    payload: hugePayload,
  });

  expect(response.statusCode).toBe(400);
});
```

### 3.5 Race Conditions in State Transitions

**Threat:** Concurrent requests cause invalid state changes
**Test Strategy:** Simulate simultaneous transitions on same shipment

**Test Case:**

```typescript
it("should handle concurrent state transitions atomically", async () => {
  const shipmentId = "shipment_race_123";

  const results = await Promise.all([
    app.inject({
      method: "PATCH",
      url: `/api/v1/shipments/${shipmentId}`,
      payload: { status: "assigned" },
      headers: { Authorization: `Bearer ${token1}` },
    }),
    app.inject({
      method: "PATCH",
      url: `/api/v1/shipments/${shipmentId}`,
      payload: { status: "in_transit" },
      headers: { Authorization: `Bearer ${token2}` },
    }),
  ]);

  // One should succeed, other should fail
  const successCount = results.filter((r) => r.statusCode === 200).length;
  expect(successCount).toBe(1);
});
```

---

## 4. CI/CD Pipeline Integration

### 4.1 GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: witylogix_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Setup database
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/witylogix_test

      - name: Run unit tests
        run: npm run test:unit -- --reporter=verbose
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://postgres:test@localhost:5432/witylogix_test

      - name: Run integration tests
        run: npm run test:integration -- --reporter=verbose
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://postgres:test@localhost:5432/witylogix_test

      - name: Run E2E tests
        run: npm run test:e2e -- --reporter=verbose
        env:
          NODE_ENV: test
          BASE_URL: http://localhost:3000

      - name: Generate coverage report
        run: npm run test:coverage
        if: always()

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: always()
        with:
          files: ./coverage/coverage-final.json
          flags: unittests
          name: codecov-umbrella

      - name: Check coverage thresholds
        run: npm run coverage:check
        if: always()
```

### 4.2 Test Scripts in `package.json`

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:unit": "vitest --run --include='**/*.unit.test.ts(x)?'",
    "test:integration": "vitest --run --include='**/*.integration.test.ts(x)?'",
    "test:e2e": "playwright test",
    "test:coverage": "vitest --coverage",
    "coverage:check": "vitest run --coverage --all",
    "db:migrate": "prisma migrate deploy",
    "db:seed": "prisma db seed",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix"
  }
}
```

---

## 5. Sample Test File Stubs

### 5.1 Unit Test Template

```typescript
// packages/[package]/__tests__/[feature].unit.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("[Feature]", () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe("[Scenario]", () => {
    it("should [expected behavior]", () => {
      // Arrange
      const input = {};

      // Act
      const result = {};

      // Assert
      expect(result).toBeDefined();
    });
  });
});
```

### 5.2 Integration Test Template

```typescript
// packages/[package]/__tests__/[feature].integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTestTenant } from "../test-utils/tenant-factory";

describe("[Feature] Integration", () => {
  let db: PrismaClient;
  let tenantId: string;

  beforeEach(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
    db = new PrismaClient();
  });

  afterEach(async () => {
    await db.$disconnect();
  });

  it("should [expected behavior] with dependencies", async () => {
    // Arrange
    const entity = await db.model.create({ data: {} });

    // Act
    const result = await db.model.findUnique({ where: { id: entity.id } });

    // Assert
    expect(result).toEqual(entity);
  });
});
```

### 5.3 E2E Test Template (Playwright)

```typescript
// e2e/[feature].e2e.spec.ts
import { test, expect } from "@playwright/test";

test.describe("[Feature] E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should [user scenario]", async ({ page }) => {
    // User journey
    await page.click('button:has-text("Login")');
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button:has-text("Sign In")');

    // Assertions
    await expect(page.locator("text=Dashboard")).toBeVisible();
  });
});
```

---

## 6. Coverage Targets Per Package

| Package     | Unit     | Integration | E2E      | Overall  | Critical 100% Areas           |
| ----------- | -------- | ----------- | -------- | -------- | ----------------------------- |
| validators  | 100%     | N/A         | N/A      | 100%     | All schemas                   |
| db          | 85%      | 95%         | N/A      | 90%      | RLS, multi-tenant queries     |
| core        | 95%      | 90%         | N/A      | 95%      | State machine, renderer       |
| api         | 80%      | 90%         | 85%      | 85%      | All route handlers            |
| dashboard   | 75%      | 85%         | 80%      | 80%      | Critical user paths           |
| **Overall** | **~87%** | **~90%**    | **~82%** | **~85%** | Multi-tenant, state, security |

**Coverage thresholds enforced in CI/CD:**

- Fail if overall coverage drops below 85%
- Fail if critical packages drop below stated minimums
- Fail if new code has <80% coverage

---

## 7. Testing Tooling Configuration

### 7.1 `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.d.ts",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/test-utils/**",
        "**/fixtures/**",
      ],
      lines: 85,
      functions: 85,
      branches: 85,
      statements: 85,
    },
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", "dist"],
    setupFiles: ["./test-setup.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
    isolate: true,
    threads: true,
    maxThreads: 8,
    minThreads: 1,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@validators": path.resolve(__dirname, "../validators/src"),
      "@db": path.resolve(__dirname, "../db/src"),
      "@core": path.resolve(__dirname, "../core/src"),
    },
  },
});
```

### 7.2 `vitest.react.config.ts` (For dashboard)

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.stories.tsx",
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### 7.3 `playwright.config.ts` (For E2E)

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

### 7.4 `.nycrc.json` (Coverage configuration)

```json
{
  "all": true,
  "include": [
    "packages/*/src/**/*.ts",
    "packages/*/src/**/*.tsx",
    "apps/*/src/**/*.ts",
    "apps/*/src/**/*.tsx"
  ],
  "exclude": [
    "**/*.d.ts",
    "**/test-utils/**",
    "**/fixtures/**",
    "**/*.test.ts",
    "**/*.test.tsx"
  ],
  "reporter": ["text", "lcov", "html"],
  "watermarks": {
    "lines": [75, 95],
    "functions": [75, 95],
    "branches": [70, 90],
    "statements": [75, 95]
  }
}
```

---

## 8. Test Utilities & Factories

### 8.1 Tenant Factory: `packages/db/test-utils/tenant-factory.ts`

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createTestTenant(name?: string) {
  return await prisma.tenant.create({
    data: {
      name: name || `Test Tenant ${Date.now()}`,
      slug: `tenant-${Date.now()}`,
      isActive: true,
    },
  });
}

export async function cleanupTestTenant(tenantId: string) {
  // Delete all related data
  await prisma.shipment.deleteMany({ where: { tenantId } });
  await prisma.driver.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
}
```

### 8.2 Data Factory: `apps/api/test-utils/data-factory.ts`

```typescript
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export async function createTestUser(overrides = {}) {
  const tenantId = overrides.tenantId || `tenant-${Date.now()}`;

  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: { name: tenantId },
  });

  const user = await prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      tenantId: tenant.id,
      ...overrides,
    },
  });

  const token = jwt.sign(
    { userId: user.id, tenantId: user.tenantId },
    process.env.JWT_SECRET || "test-secret",
  );

  return { ...user, token };
}

export async function createTestShipment(tenantId: string, overrides = {}) {
  return await prisma.shipment.create({
    data: {
      tenantId,
      status: "pending",
      recipientName: `Recipient ${Date.now()}`,
      recipientPhone: "+12125551234",
      recipientAddress: "123 Main St",
      ...overrides,
    },
  });
}
```

---

## 9. Key Testing Principles

1. **Test Behavior, Not Implementation** — Test what the system does, not how it does it
2. **Isolation** — Each test should be independent; no test should depend on another
3. **Fast Feedback** — Unit tests run in <5s; integration tests <30s total
4. **Deterministic** — Tests pass/fail consistently; no flakiness
5. **Readable** — Clear test names and structure; 3 AAA pattern (Arrange, Act, Assert)
6. **Coverage-Driven** — Coverage targets guide test development, not vice versa
7. **Security-First** — RLS, injection, and data isolation tested before features
8. **Automatable** — All tests run in CI/CD without manual intervention

---

## 10. Testing Roadmap

### Phase 1 (Week 1-2): Foundation

- [ ] Set up Vitest, React Testing Library, Playwright
- [ ] Write unit tests for validators (100%)
- [ ] Write RLS isolation tests (100%)
- [ ] Write state machine tests (100%)

### Phase 2 (Week 3-4): Integration

- [ ] API route integration tests (all 50+ endpoints)
- [ ] Dashboard component tests (critical paths)
- [ ] Template renderer security tests

### Phase 3 (Week 5-6): E2E & Quality

- [ ] Playwright E2E workflows
- [ ] Coverage report generation
- [ ] Performance benchmarking
- [ ] Load testing for concurrent shipments

### Phase 4 (Ongoing): Maintenance

- [ ] 85% coverage maintained with each PR
- [ ] New features require tests
- [ ] Monthly security audit of test coverage

---

## Appendix A: Running Tests Locally

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test -- packages/validators/__tests__/shipment.test.ts

# Run with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# View coverage in browser
npm run test:coverage -- --ui
```

---

## Appendix B: Common Test Scenarios by Package

### validators

- Valid/invalid input combinations
- Edge case values (empty, null, very large)
- Custom refinement rules
- Error message clarity

### db

- RLS isolation (tenant A ≠ tenant B)
- Query performance (indexes)
- Relationship integrity
- Data constraints

### core

- All valid state transitions
- All invalid state transitions
- Template rendering (variables, loops, conditionals)
- Security (XSS, injection)

### api

- Request validation against Zod
- Authentication (JWT, API keys)
- Authorization (RLS enforcement)
- Error responses (4xx, 5xx)

### dashboard

- Component rendering
- User interactions (click, type, submit)
- Navigation
- State management (filters, sorting, pagination)

---

**Document Status:** Ready for implementation
**Next Review:** 2026-04-06
**Questions/Feedback:** Contact QA Lead
