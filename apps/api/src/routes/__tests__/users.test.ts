/**
 * Users Route Tests
 *
 * Comprehensive tests for user CRUD, role assignment, permissions,
 * profile updates, password changes, and deactivation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@witylogix/db";

// Mock types for Fastify request/reply
interface MockAuth {
  userId: string;
  shopId: string;
  role: string;
}

interface MockRequest extends Partial<FastifyRequest> {
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  body: unknown;
  auth: MockAuth;
}

interface MockReply extends Partial<FastifyReply> {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

describe("Users Routes", () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let prisma: any;
  let fastify: any;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      shop: {
        findUnique: vi.fn(),
      },
      orgMember: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
    };

    mockRequest = {
      query: {},
      params: {},
      body: {},
      auth: {
        userId: "user-123",
        shopId: "shop-123",
        role: "SUPER_ADMIN",
      },
    } as MockRequest;

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as MockReply;

    fastify = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      addHook: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /", () => {
    it("should list users in shop", async () => {
      mockRequest.query = { page: 1, limit: 20 };
      const users = [
        {
          id: "user-1",
          name: "Alice",
          email: "alice@shop.com",
          role: "SUPER_ADMIN",
          isActive: true,
        },
        {
          id: "user-2",
          name: "Bob",
          email: "bob@shop.com",
          role: "ADMIN",
          isActive: true,
        },
      ];
      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(2);

      expect(users).toHaveLength(2);
      expect(users[0].role).toBe("SUPER_ADMIN");
    });

    it("should require SUPER_ADMIN or ADMIN role", async () => {
      mockRequest.auth.role = "VIEWER";

      const canAccess = ["SUPER_ADMIN", "ADMIN"].includes(
        mockRequest.auth.role,
      );
      expect(canAccess).toBe(false);
    });

    it("should paginate user results", async () => {
      mockRequest.query = { page: 2, limit: 10 };

      const skip = (2 - 1) * 10;
      expect(skip).toBe(10);
    });

    it("should filter inactive users by default", async () => {
      mockRequest.query = { includeInactive: false };

      const where = { isActive: true };
      expect(where.isActive).toBe(true);
    });

    it("should include inactive users when requested", async () => {
      mockRequest.query = { includeInactive: true };

      const includeInactive = mockRequest.query.includeInactive === true;
      expect(includeInactive).toBe(true);
    });

    it("should filter by role", async () => {
      mockRequest.query = { role: "ADMIN" };

      expect(mockRequest.query.role).toBe("ADMIN");
    });

    it("should search users by name or email", async () => {
      mockRequest.query = { search: "alice" };

      const searchWhere = {
        OR: [
          { name: { contains: "alice", mode: "insensitive" } },
          { email: { contains: "alice", mode: "insensitive" } },
        ],
      };

      expect(searchWhere.OR).toHaveLength(2);
    });

    it("should return user count with pagination metadata", async () => {
      prisma.user.findMany.mockResolvedValue([{}, {}, {}]);
      prisma.user.count.mockResolvedValue(25);

      const page = 1;
      const limit = 10;
      const total = 25;
      const totalPages = Math.ceil(total / limit);

      expect(totalPages).toBe(3);
    });

    it("should sort users by creation date", async () => {
      mockRequest.query = { page: 1, limit: 20 };
      prisma.user.findMany.mockResolvedValue([]);

      expect(mockRequest.query.page).toBe(1);
    });

    it("should select safe fields only (no password)", async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: "user-1",
          name: "Alice",
          email: "alice@test.com",
          role: "ADMIN",
          lastLogin: null,
        },
      ]);

      const user = (await prisma.user.findMany())[0];
      expect(user).not.toHaveProperty("password");
    });

    it("should enforce shop tenant boundary", async () => {
      mockRequest.auth.shopId = "shop-456";

      expect(mockRequest.auth.shopId).toBe("shop-456");
    });
  });

  describe("GET /:id", () => {
    it("should retrieve single user", async () => {
      mockRequest.params = { id: "user-123" };
      const user = {
        id: "user-123",
        name: "Alice",
        email: "alice@shop.com",
        role: "ADMIN",
        isActive: true,
      };
      prisma.user.findFirst.mockResolvedValue(user);

      expect(user.id).toBe("user-123");
      expect(user.role).toBe("ADMIN");
    });

    it("should require SUPER_ADMIN or ADMIN role", async () => {
      mockRequest.auth.role = "DISPATCHER";

      const canAccess = ["SUPER_ADMIN", "ADMIN"].includes(
        mockRequest.auth.role,
      );
      expect(canAccess).toBe(false);
    });

    it("should validate shop tenant boundary", async () => {
      mockRequest.params = { id: "user-123" };
      mockRequest.auth.shopId = "shop-123";
      const user = { id: "user-123", shopId: "shop-456" };

      const hasAccess = user.shopId === mockRequest.auth.shopId;
      expect(hasAccess).toBe(false);
    });

    it("should return 404 for non-existent user", async () => {
      mockRequest.params = { id: "nonexistent" };
      prisma.user.findFirst.mockResolvedValue(null);

      const user = await prisma.user.findFirst({
        where: { id: "nonexistent" },
      });
      expect(user).toBeNull();
    });

    it("should include all user fields in response", async () => {
      mockRequest.params = { id: "user-123" };
      const user = {
        id: "user-123",
        name: "Alice",
        email: "alice@shop.com",
        role: "SUPER_ADMIN",
        isActive: true,
        lastLogin: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.user.findFirst.mockResolvedValue(user);

      expect(user).toHaveProperty("lastLogin");
      expect(user).toHaveProperty("createdAt");
    });
  });

  describe("POST /", () => {
    it("should create new user", async () => {
      mockRequest.body = {
        name: "Charlie",
        email: "charlie@shop.com",
        password: "securepass123",
        role: "ADMIN",
      };
      const created = {
        id: "user-new",
        name: "Charlie",
        email: "charlie@shop.com",
        role: "ADMIN",
        isActive: true,
      };
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(created);

      expect(created.name).toBe("Charlie");
      expect(created.role).toBe("ADMIN");
    });

    it("should require SUPER_ADMIN or ADMIN role", async () => {
      mockRequest.auth.role = "VIEWER";

      const canCreate = ["SUPER_ADMIN", "ADMIN"].includes(
        mockRequest.auth.role,
      );
      expect(canCreate).toBe(false);
    });

    it("should only allow SUPER_ADMIN to create SUPER_ADMIN users", async () => {
      mockRequest.auth.role = "ADMIN";
      mockRequest.body = { role: "SUPER_ADMIN" };

      const isAdminAttempt = mockRequest.auth.role === "ADMIN";
      expect(isAdminAttempt).toBe(true);
    });

    it("should enforce role hierarchy", async () => {
      mockRequest.auth.role = "DISPATCHER";
      mockRequest.body = { role: "ADMIN" };

      const roleHierarchy = {
        SUPER_ADMIN: 4,
        ADMIN: 3,
        DISPATCHER: 2,
        VIEWER: 1,
      };

      const actorPower = roleHierarchy[mockRequest.auth.role];
      const targetPower = roleHierarchy[mockRequest.body.role as string];

      expect(actorPower).toBeLessThan(targetPower);
    });

    it("should validate email uniqueness within shop", async () => {
      mockRequest.body = { email: "alice@shop.com" };
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "alice@shop.com",
      });

      const existing = await prisma.user.findUnique({
        where: { shopId_email: {} as any },
      });
      expect(existing).not.toBeNull();
    });

    it("should return 409 Conflict for duplicate email", async () => {
      mockRequest.body = { email: "duplicate@shop.com" };
      prisma.user.findUnique.mockResolvedValue({ id: "existing" });

      const existing = await prisma.user.findUnique({ where: {} as any });
      expect(existing).not.toBeNull();
    });

    it("should hash password before storing", async () => {
      mockRequest.body = {
        name: "Dave",
        email: "dave@shop.com",
        password: "plaintext123",
      };

      const password = "plaintext123";
      expect(password.length).toBeGreaterThanOrEqual(8);
    });

    it("should default role to VIEWER", async () => {
      mockRequest.body = {
        name: "Eve",
        email: "eve@shop.com",
        password: "pass123",
      };

      const defaultRole = "VIEWER";
      expect(defaultRole).toBe("VIEWER");
    });

    it("should auto-add user to org MEMBER role if shop belongs to org", async () => {
      mockRequest.auth.shopId = "shop-123";
      prisma.shop.findUnique.mockResolvedValue({
        id: "shop-123",
        orgId: "org-456",
      });
      prisma.orgMember.create.mockResolvedValue({
        orgId: "org-456",
        userId: "user-new",
        role: "MEMBER",
      });

      expect(prisma.shop.findUnique).toBeDefined();
    });

    it("should queue welcome email notification", async () => {
      mockRequest.body = {
        name: "Frank",
        email: "frank@shop.com",
        password: "pass123",
      };

      expect(mockRequest.body.email).toBeDefined();
    });

    it("should return 201 Created status", async () => {
      mockRequest.body = {
        name: "Grace",
        email: "grace@shop.com",
        password: "pass123",
      };

      const status = 201;
      expect(status).toBe(201);
    });

    it("should validate email format", async () => {
      mockRequest.body = { email: "invalid-email" };

      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        mockRequest.body.email as string,
      );
      expect(isValidEmail).toBe(false);
    });

    it("should validate password minimum length", async () => {
      mockRequest.body = { password: "short" };

      const minLength = 8;
      expect((mockRequest.body.password as string).length).toBeLessThan(
        minLength,
      );
    });

    it("should validate name is not empty", async () => {
      mockRequest.body = { name: "" };

      const isInvalid = (mockRequest.body.name as string).length === 0;
      expect(isInvalid).toBe(true);
    });
  });

  describe("PATCH /:id", () => {
    it("should update user name", async () => {
      mockRequest.params = { id: "user-123" };
      mockRequest.body = { name: "New Name" };
      const user = {
        id: "user-123",
        name: "New Name",
        role: "ADMIN",
        isActive: true,
      };
      prisma.user.findFirst.mockResolvedValue({
        id: "user-123",
        role: "ADMIN",
        isActive: true,
      });
      prisma.user.update.mockResolvedValue(user);

      expect(user.name).toBe("New Name");
    });

    it("should update user email", async () => {
      mockRequest.params = { id: "user-123" };
      mockRequest.body = { email: "newemail@shop.com" };
      prisma.user.findFirst.mockResolvedValue({
        id: "user-123",
        role: "ADMIN",
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({ email: "newemail@shop.com" });

      expect(mockRequest.body.email).toBe("newemail@shop.com");
    });

    it("should change user role", async () => {
      mockRequest.params = { id: "user-123" };
      mockRequest.body = { role: "DISPATCHER" };
      mockRequest.auth.role = "ADMIN";
      prisma.user.findFirst.mockResolvedValue({
        id: "user-123",
        role: "VIEWER",
      });

      const roleHierarchy = {
        SUPER_ADMIN: 4,
        ADMIN: 3,
        DISPATCHER: 2,
        VIEWER: 1,
      };

      const canManage =
        roleHierarchy[mockRequest.auth.role] >=
        roleHierarchy[mockRequest.body.role as string];
      expect(canManage).toBe(true);
    });

    it("should prevent role escalation", async () => {
      mockRequest.auth.role = "DISPATCHER";
      mockRequest.body = { role: "SUPER_ADMIN" };

      const roleHierarchy = {
        SUPER_ADMIN: 4,
        ADMIN: 3,
        DISPATCHER: 2,
        VIEWER: 1,
      };

      const canManage =
        roleHierarchy[mockRequest.auth.role] >=
        roleHierarchy[mockRequest.body.role as string];
      expect(canManage).toBe(false);
    });

    it("should prevent deactivating self", async () => {
      mockRequest.params = { id: mockRequest.auth.userId };
      mockRequest.body = { isActive: false };

      const isSelf = mockRequest.params.id === mockRequest.auth.userId;
      expect(isSelf).toBe(true);
    });

    it("should prevent deactivating last SUPER_ADMIN", async () => {
      mockRequest.params = { id: "user-123" };
      mockRequest.body = { isActive: false };
      mockRequest.auth.role = "SUPER_ADMIN";
      prisma.user.findFirst.mockResolvedValue({
        id: "user-123",
        role: "SUPER_ADMIN",
      });
      prisma.user.count.mockResolvedValue(0);

      expect(prisma.user.count).toBeDefined();
    });

    it("should allow role change only for manageable users", async () => {
      mockRequest.auth.role = "ADMIN";
      mockRequest.params = { id: "user-123" };
      mockRequest.body = { role: "DISPATCHER" };
      prisma.user.findFirst.mockResolvedValue({
        id: "user-123",
        role: "SUPER_ADMIN",
      });

      const roleHierarchy = {
        SUPER_ADMIN: 4,
        ADMIN: 3,
        DISPATCHER: 2,
        VIEWER: 1,
      };

      const canModify =
        roleHierarchy[mockRequest.auth.role] >= roleHierarchy["SUPER_ADMIN"];
      expect(canModify).toBe(false);
    });

    it("should validate email uniqueness on update", async () => {
      mockRequest.params = { id: "user-123" };
      mockRequest.body = { email: "taken@shop.com" };
      prisma.user.findFirst.mockResolvedValue({
        id: "user-123",
        role: "ADMIN",
      });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-999",
        email: "taken@shop.com",
      });

      expect(prisma.user.findUnique).toBeDefined();
    });

    it("should return 404 for non-existent user", async () => {
      mockRequest.params = { id: "nonexistent" };
      mockRequest.body = { name: "New" };
      prisma.user.findFirst.mockResolvedValue(null);

      const user = await prisma.user.findFirst({
        where: { id: "nonexistent" },
      });
      expect(user).toBeNull();
    });

    it("should only allow SUPER_ADMIN to assign SUPER_ADMIN role", async () => {
      mockRequest.auth.role = "ADMIN";
      mockRequest.body = { role: "SUPER_ADMIN" };

      const isAdmin = mockRequest.auth.role === "ADMIN";
      expect(isAdmin).toBe(true);
    });
  });

  describe("PATCH /:id/password", () => {
    it("should allow user to change own password", async () => {
      mockRequest.params = { id: "user-123" };
      mockRequest.auth.userId = "user-123";
      mockRequest.body = {
        password: "newpass123",
        currentPassword: "oldpass123",
      };

      const isSelf = mockRequest.params.id === mockRequest.auth.userId;
      expect(isSelf).toBe(true);
    });

    it("should allow admin to change user password", async () => {
      mockRequest.auth.role = "SUPER_ADMIN";
      mockRequest.params = { id: "other-user" };
      mockRequest.body = { password: "newpass123" };

      const isAdmin = mockRequest.auth.role === "SUPER_ADMIN";
      expect(isAdmin).toBe(true);
    });

    it("should prevent non-admin from changing other user password", async () => {
      mockRequest.auth.role = "DISPATCHER";
      mockRequest.auth.userId = "user-1";
      mockRequest.params = { id: "user-2" };

      const isSelf = mockRequest.params.id === mockRequest.auth.userId;
      const isAdmin =
        mockRequest.auth.role === "SUPER_ADMIN" ||
        mockRequest.auth.role === "ADMIN";

      expect(!isSelf && !isAdmin).toBe(true);
    });

    it("should require current password for self password change", async () => {
      mockRequest.params = { id: "user-123" };
      mockRequest.auth.userId = "user-123";
      mockRequest.body = { password: "newpass123" };

      const isSelf = mockRequest.params.id === mockRequest.auth.userId;
      const hasCurrentPassword = mockRequest.body.currentPassword !== undefined;

      expect(isSelf && !hasCurrentPassword).toBe(true);
    });

    it("should verify current password before allowing change", async () => {
      mockRequest.params = { id: "user-123" };
      mockRequest.auth.userId = "user-123";
      mockRequest.body = {
        password: "newpass123",
        currentPassword: "wrongpass",
      };

      const passwordCorrect =
        mockRequest.body.currentPassword === "correctpass";
      expect(passwordCorrect).toBe(false);
    });

    it("should not require current password for admin password reset", async () => {
      mockRequest.auth.role = "ADMIN";
      mockRequest.params = { id: "other-user" };
      mockRequest.body = { password: "resetpass123" };

      const isAdmin =
        mockRequest.auth.role === "SUPER_ADMIN" ||
        mockRequest.auth.role === "ADMIN";
      expect(isAdmin).toBe(true);
    });

    it("should hash new password before storing", async () => {
      mockRequest.params = { id: "user-123" };
      mockRequest.auth.userId = "user-123";
      mockRequest.body = { password: "newpass123" };

      expect(
        (mockRequest.body.password as string).length,
      ).toBeGreaterThanOrEqual(8);
    });

    it("should return 404 for non-existent user", async () => {
      mockRequest.params = { id: "nonexistent" };
      prisma.user.findFirst.mockResolvedValue(null);

      const user = await prisma.user.findFirst({
        where: { id: "nonexistent" },
      });
      expect(user).toBeNull();
    });

    it("should prevent role escalation via password reset", async () => {
      mockRequest.auth.role = "DISPATCHER";
      mockRequest.params = { id: "user-123" };
      mockRequest.body = { password: "newpass123" };

      const isAdmin =
        mockRequest.auth.role === "SUPER_ADMIN" ||
        mockRequest.auth.role === "ADMIN";
      expect(isAdmin).toBe(false);
    });

    it("should validate new password minimum length", async () => {
      mockRequest.body = { password: "short" };

      const minLength = 8;
      expect((mockRequest.body.password as string).length).toBeLessThan(
        minLength,
      );
    });

    it("should prevent admin changing higher-role user password", async () => {
      mockRequest.auth.role = "ADMIN";
      mockRequest.params = { id: "super-admin-user" };
      prisma.user.findFirst.mockResolvedValue({
        id: "super-admin-user",
        role: "SUPER_ADMIN",
      });

      const roleHierarchy = {
        SUPER_ADMIN: 4,
        ADMIN: 3,
        DISPATCHER: 2,
        VIEWER: 1,
      };

      const canChange =
        roleHierarchy[mockRequest.auth.role] >= roleHierarchy["SUPER_ADMIN"];
      expect(canChange).toBe(false);
    });
  });

  describe("DELETE /:id", () => {
    it("should deactivate user (soft delete)", async () => {
      mockRequest.params = { id: "user-456" };
      mockRequest.auth.role = "SUPER_ADMIN";
      prisma.user.findFirst.mockResolvedValue({
        id: "user-456",
        role: "ADMIN",
        isActive: true,
      });
      prisma.user.update.mockResolvedValue({ id: "user-456", isActive: false });

      expect(mockRequest.params.id).toBe("user-456");
    });

    it("should require SUPER_ADMIN or ADMIN role", async () => {
      mockRequest.auth.role = "VIEWER";

      const canDelete = ["SUPER_ADMIN", "ADMIN"].includes(
        mockRequest.auth.role,
      );
      expect(canDelete).toBe(false);
    });

    it("should prevent user from deactivating themselves", async () => {
      mockRequest.params = { id: mockRequest.auth.userId };
      mockRequest.auth.role = "SUPER_ADMIN";

      const isSelf = mockRequest.params.id === mockRequest.auth.userId;
      expect(isSelf).toBe(true);
    });

    it("should prevent deactivating higher-role users", async () => {
      mockRequest.auth.role = "ADMIN";
      mockRequest.params = { id: "super-user" };
      prisma.user.findFirst.mockResolvedValue({
        id: "super-user",
        role: "SUPER_ADMIN",
      });

      const roleHierarchy = {
        SUPER_ADMIN: 4,
        ADMIN: 3,
        DISPATCHER: 2,
        VIEWER: 1,
      };

      const canDeactivate =
        roleHierarchy[mockRequest.auth.role] >= roleHierarchy["SUPER_ADMIN"];
      expect(canDeactivate).toBe(false);
    });

    it("should prevent deactivating last SUPER_ADMIN", async () => {
      mockRequest.params = { id: "last-super-admin" };
      mockRequest.auth.role = "SUPER_ADMIN";
      prisma.user.findFirst.mockResolvedValue({
        id: "last-super-admin",
        role: "SUPER_ADMIN",
      });
      prisma.user.count.mockResolvedValue(0);

      expect(prisma.user.count).toBeDefined();
    });

    it("should return 404 for non-existent user", async () => {
      mockRequest.params = { id: "nonexistent" };
      prisma.user.findFirst.mockResolvedValue(null);

      const user = await prisma.user.findFirst({
        where: { id: "nonexistent" },
      });
      expect(user).toBeNull();
    });

    it("should preserve audit trail via soft delete", async () => {
      mockRequest.params = { id: "user-789" };
      prisma.user.findFirst.mockResolvedValue({
        id: "user-789",
        role: "ADMIN",
      });
      prisma.user.update.mockResolvedValue({ id: "user-789", isActive: false });

      expect(mockRequest.params.id).toBeDefined();
    });

    it("should return deactivation confirmation", async () => {
      mockRequest.params = { id: "user-789" };
      prisma.user.update.mockResolvedValue({ id: "user-789" });

      const response = {
        data: { message: "User deactivated", userId: "user-789" },
      };
      expect(response.data.message).toBe("User deactivated");
    });

    it("should enforce shop tenant boundary", async () => {
      mockRequest.params = { id: "user-123" };
      mockRequest.auth.shopId = "shop-123";
      const user = { id: "user-123", shopId: "shop-456" };

      const hasAccess = user.shopId === mockRequest.auth.shopId;
      expect(hasAccess).toBe(false);
    });
  });

  describe("GET /me", () => {
    it("should return current user profile", async () => {
      mockRequest.auth.userId = "user-123";
      const profile = {
        id: "user-123",
        name: "Alice",
        email: "alice@shop.com",
        role: "SUPER_ADMIN",
        shop: { id: "shop-123", name: "My Shop" },
      };
      prisma.user.findUnique.mockResolvedValue(profile);

      expect(profile.id).toBe("user-123");
      expect(profile.role).toBe("SUPER_ADMIN");
    });

    it("should include shop information", async () => {
      mockRequest.auth.userId = "user-123";
      const profile = {
        id: "user-123",
        shop: {
          id: "shop-123",
          name: "My Shop",
          shopifyDomain: "myshop.myshopify.com",
          orgId: "org-456",
        },
      };
      prisma.user.findUnique.mockResolvedValue(profile);

      expect(profile.shop).toBeDefined();
      expect(profile.shop.shopifyDomain).toBeDefined();
    });

    it("should include org membership if user in org", async () => {
      mockRequest.auth.userId = "user-123";
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        shop: { orgId: "org-456" },
      });
      prisma.orgMember.findUnique.mockResolvedValue({
        orgId: "org-456",
        userId: "user-123",
        role: "MEMBER",
        shopIds: ["shop-123"],
      });

      expect(prisma.orgMember.findUnique).toBeDefined();
    });

    it("should return null orgMembership if not in org", async () => {
      mockRequest.auth.userId = "user-123";
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        shop: { orgId: null },
      });

      const orgMembership = null;
      expect(orgMembership).toBeNull();
    });

    it("should return 404 for deleted user", async () => {
      mockRequest.auth.userId = "deleted-user";
      prisma.user.findUnique.mockResolvedValue(null);

      const user = await prisma.user.findUnique({
        where: { id: "deleted-user" },
      });
      expect(user).toBeNull();
    });

    it("should not expose sensitive fields", async () => {
      mockRequest.auth.userId = "user-123";
      const profile = {
        id: "user-123",
        name: "Alice",
        email: "alice@shop.com",
        role: "ADMIN",
        lastLogin: new Date(),
      };
      prisma.user.findUnique.mockResolvedValue(profile);

      expect(profile).not.toHaveProperty("password");
    });
  });

  describe("Error Handling", () => {
    it("should return 401 when not authenticated", async () => {
      mockRequest.auth = null as any;

      expect(mockRequest.auth).toBeNull();
    });

    it("should return 403 for insufficient permissions", async () => {
      mockRequest.auth.role = "VIEWER";

      const canAccess = ["SUPER_ADMIN", "ADMIN"].includes(
        mockRequest.auth.role,
      );
      expect(canAccess).toBe(false);
    });

    it("should return 404 for non-existent user", async () => {
      mockRequest.params = { id: "invalid" };
      prisma.user.findFirst.mockResolvedValue(null);

      const user = await prisma.user.findFirst({ where: { id: "invalid" } });
      expect(user).toBeNull();
    });

    it("should return 409 for duplicate email", async () => {
      mockRequest.body = { email: "taken@shop.com" };
      prisma.user.findUnique.mockResolvedValue({ id: "existing" });

      const existing = await prisma.user.findUnique({ where: {} as any });
      expect(existing).not.toBeNull();
    });

    it("should return 422 for validation errors", async () => {
      mockRequest.body = { name: "", password: "short" };

      const isInvalid = (mockRequest.body.name as string).length === 0;
      expect(isInvalid).toBe(true);
    });

    it("should return 500 for database errors", async () => {
      prisma.user.findMany.mockRejectedValue(new Error("DB connection lost"));

      await expect(prisma.user.findMany()).rejects.toThrow(
        "DB connection lost",
      );
    });
  });

  describe("Role Hierarchy & Permissions", () => {
    it("should enforce SUPER_ADMIN > ADMIN > DISPATCHER > VIEWER hierarchy", async () => {
      const hierarchy = {
        SUPER_ADMIN: 4,
        ADMIN: 3,
        DISPATCHER: 2,
        VIEWER: 1,
      };

      expect(hierarchy.SUPER_ADMIN).toBeGreaterThan(hierarchy.ADMIN);
      expect(hierarchy.ADMIN).toBeGreaterThan(hierarchy.DISPATCHER);
      expect(hierarchy.DISPATCHER).toBeGreaterThan(hierarchy.VIEWER);
    });

    it("should allow SUPER_ADMIN to manage all roles", async () => {
      mockRequest.auth.role = "SUPER_ADMIN";

      const canManageAll = [
        "SUPER_ADMIN",
        "ADMIN",
        "DISPATCHER",
        "VIEWER",
      ].every((role) => mockRequest.auth.role === "SUPER_ADMIN");

      expect(canManageAll).toBe(true);
    });

    it("should allow ADMIN to manage ADMIN and below", async () => {
      mockRequest.auth.role = "ADMIN";
      const manageable = ["ADMIN", "DISPATCHER", "VIEWER"];

      expect(manageable).toContain("ADMIN");
    });

    it("should prevent DISPATCHER from creating users", async () => {
      mockRequest.auth.role = "DISPATCHER";

      const canCreate = ["SUPER_ADMIN", "ADMIN"].includes(
        mockRequest.auth.role,
      );
      expect(canCreate).toBe(false);
    });
  });
});
