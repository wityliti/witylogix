/**
 * Tenant Isolation Tests
 *
 * Tests cover:
 * - Tenant context creation from requests
 * - Role-based permissions
 * - Cross-tenant access validation
 * - Scoped Prisma queries
 * - Middleware integration
 * - Permission guards
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import {
  TenantContext,
  createTenantContext,
  withTenantScope,
  validateTenantAccess,
  tenantMiddleware,
  requireTenantContext,
  checkTenantPermission,
} from "../tenant-isolation";

describe("TenantContext", () => {
  it("should create a tenant context", () => {
    const context = new TenantContext(
      "org-123",
      "workspace-456",
      "user-789",
      "ADMIN",
      ["READ", "WRITE", "DELETE"],
    );

    expect(context.orgId).toBe("org-123");
    expect(context.workspaceId).toBe("workspace-456");
    expect(context.userId).toBe("user-789");
    expect(context.role).toBe("ADMIN");
  });

  describe("hasPermission", () => {
    it("should check if context has permission", () => {
      const context = new TenantContext("org-123", undefined, "user-789", "MEMBER", [
        "READ",
        "WRITE",
      ]);

      expect(context.hasPermission("READ")).toBe(true);
      expect(context.hasPermission("WRITE")).toBe(true);
      expect(context.hasPermission("DELETE")).toBe(false);
    });

    it("ADMIN should have all permissions", () => {
      const context = new TenantContext("org-123", undefined, "user-789", "ADMIN", [
        "ADMIN",
      ]);

      expect(context.hasPermission("READ")).toBe(true);
      expect(context.hasPermission("WRITE")).toBe(true);
      expect(context.hasPermission("DELETE")).toBe(true);
      expect(context.hasPermission("ADMIN")).toBe(true);
    });
  });

  describe("isOrgId", () => {
    it("should check org ID match", () => {
      const context = new TenantContext("org-123");

      expect(context.isOrgId("org-123")).toBe(true);
      expect(context.isOrgId("org-456")).toBe(false);
    });
  });

  describe("isWorkspaceId", () => {
    it("should check workspace ID match", () => {
      const context = new TenantContext("org-123", "workspace-456");

      expect(context.isWorkspaceId("workspace-456")).toBe(true);
      expect(context.isWorkspaceId("workspace-789")).toBe(false);
    });
  });

  describe("toJSON", () => {
    it("should serialize context", () => {
      const context = new TenantContext("org-123", "workspace-456", "user-789", "ADMIN", [
        "ADMIN",
      ]);

      const json = context.toJSON();

      expect(json.orgId).toBe("org-123");
      expect(json.workspaceId).toBe("workspace-456");
      expect(json.userId).toBe("user-789");
      expect(json.role).toBe("ADMIN");
      expect(json.permissions).toContain("ADMIN");
    });
  });
});

describe("createTenantContext", () => {
  it("should extract tenant context from JWT in auth middleware", () => {
    const req = {
      auth: {
        orgId: "org-123",
        workspaceId: "workspace-456",
        userId: "user-789",
        role: "ADMIN",
      },
      headers: {},
    } as any as Request;

    const context = createTenantContext(req);

    expect(context.orgId).toBe("org-123");
    expect(context.workspaceId).toBe("workspace-456");
    expect(context.userId).toBe("user-789");
  });

  it("should extract from headers if not in JWT", () => {
    const req = {
      auth: {
        userId: "user-789",
        role: "MEMBER",
      },
      headers: {
        "x-org-id": "org-123",
        "x-workspace-id": "workspace-456",
      },
    } as any as Request;

    const context = createTenantContext(req);

    expect(context.orgId).toBe("org-123");
    expect(context.workspaceId).toBe("workspace-456");
  });

  it("should prefer JWT over headers", () => {
    const req = {
      auth: {
        orgId: "org-jwt",
        userId: "user-789",
      },
      headers: {
        "x-org-id": "org-header",
      },
    } as any as Request;

    const context = createTenantContext(req);

    expect(context.orgId).toBe("org-jwt");
  });

  it("should throw error if no auth context", () => {
    const req = {
      headers: {},
    } as any as Request;

    expect(() => createTenantContext(req)).toThrow();
  });

  it("should throw error if no org ID", () => {
    const req = {
      auth: {
        userId: "user-789",
      },
      headers: {},
    } as any as Request;

    expect(() => createTenantContext(req)).toThrow();
  });

  it("should map OWNER role to full permissions", () => {
    const req = {
      auth: {
        orgId: "org-123",
        role: "OWNER",
      },
      headers: {},
    } as any as Request;

    const context = createTenantContext(req);

    expect(context.hasPermission("READ")).toBe(true);
    expect(context.hasPermission("WRITE")).toBe(true);
    expect(context.hasPermission("DELETE")).toBe(true);
    expect(context.hasPermission("ADMIN")).toBe(true);
    expect(context.hasPermission("MANAGE_USERS")).toBe(true);
    expect(context.hasPermission("MANAGE_BILLING")).toBe(true);
  });

  it("should map ADMIN role", () => {
    const req = {
      auth: {
        orgId: "org-123",
        role: "ADMIN",
      },
      headers: {},
    } as any as Request;

    const context = createTenantContext(req);

    expect(context.hasPermission("READ")).toBe(true);
    expect(context.hasPermission("WRITE")).toBe(true);
    expect(context.hasPermission("DELETE")).toBe(true);
    expect(context.hasPermission("MANAGE_USERS")).toBe(true);
    expect(context.hasPermission("ADMIN")).toBe(false); // Admin role doesn't have ADMIN permission
  });

  it("should map MEMBER role", () => {
    const req = {
      auth: {
        orgId: "org-123",
        role: "MEMBER",
      },
      headers: {},
    } as any as Request;

    const context = createTenantContext(req);

    expect(context.hasPermission("READ")).toBe(true);
    expect(context.hasPermission("WRITE")).toBe(true);
    expect(context.hasPermission("DELETE")).toBe(false);
  });

  it("should map VIEWER role", () => {
    const req = {
      auth: {
        orgId: "org-123",
        role: "VIEWER",
      },
      headers: {},
    } as any as Request;

    const context = createTenantContext(req);

    expect(context.hasPermission("READ")).toBe(true);
    expect(context.hasPermission("WRITE")).toBe(false);
  });
});

describe("validateTenantAccess", () => {
  it("should allow access to same org", () => {
    const context = new TenantContext("org-123");

    expect(() => validateTenantAccess(context, "org-123")).not.toThrow();
  });

  it("should block cross-tenant access", () => {
    const context = new TenantContext("org-123");

    expect(() => validateTenantAccess(context, "org-456")).toThrow();
  });
});

describe("withTenantScope", () => {
  it("should auto-inject orgId into find queries", () => {
    const mockPrisma = {
      workspace: {
        findUnique: vi.fn(),
      },
    };

    const context = new TenantContext("org-123");
    const scoped = withTenantScope(mockPrisma, context);

    // Call findUnique
    scoped.workspace.findUnique({ where: { id: "ws-123" } });

    expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
      where: {
        id: "ws-123",
        orgId: "org-123",
      },
    });
  });

  it("should auto-inject orgId into create queries", () => {
    const mockPrisma = {
      workspace: {
        create: vi.fn(),
      },
    };

    const context = new TenantContext("org-123");
    const scoped = withTenantScope(mockPrisma, context);

    scoped.workspace.create({ data: { name: "Test" } });

    expect(mockPrisma.workspace.create).toHaveBeenCalledWith({
      data: {
        name: "Test",
        orgId: "org-123",
      },
    });
  });

  it("should not filter global models", () => {
    const mockPrisma = {
      integrationApp: {
        findMany: vi.fn(),
      },
    };

    const context = new TenantContext("org-123");
    const scoped = withTenantScope(mockPrisma, context);

    scoped.integrationApp.findMany({});

    expect(mockPrisma.integrationApp.findMany).toHaveBeenCalledWith({});
  });
});

describe("tenantMiddleware", () => {
  it("should inject tenant context into request", () => {
    const req = {
      auth: {
        orgId: "org-123",
        userId: "user-789",
      },
      headers: {},
    } as any as Request;

    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    tenantMiddleware(req, res, next);

    expect((req as any).tenantContext).toBeDefined();
    expect((req as any).tenantContext.orgId).toBe("org-123");
    expect(next).toHaveBeenCalled();
  });

  it("should continue if no auth context (public endpoint)", () => {
    const req = {
      headers: {},
    } as any as Request;

    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    tenantMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe("requireTenantContext", () => {
  it("should allow request with tenant context", () => {
    const req = {
      tenantContext: new TenantContext("org-123"),
    } as any as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any as Response;

    const next = vi.fn() as NextFunction;

    requireTenantContext(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should reject request without tenant context", () => {
    const req = {} as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any as Response;

    const next = vi.fn() as NextFunction;

    requireTenantContext(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("checkTenantPermission", () => {
  it("should allow request with required permission", () => {
    const req = {
      tenantContext: new TenantContext("org-123", undefined, "user-789", "ADMIN", [
        "READ",
        "WRITE",
        "DELETE",
      ]),
    } as any as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any as Response;

    const next = vi.fn() as NextFunction;

    const guard = checkTenantPermission("WRITE");
    guard(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should reject request without required permission", () => {
    const req = {
      tenantContext: new TenantContext("org-123", undefined, "user-789", "VIEWER", ["READ"]),
    } as any as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any as Response;

    const next = vi.fn() as NextFunction;

    const guard = checkTenantPermission("DELETE");
    guard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("should reject request without tenant context", () => {
    const req = {} as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any as Response;

    const next = vi.fn() as NextFunction;

    const guard = checkTenantPermission("READ");
    guard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
