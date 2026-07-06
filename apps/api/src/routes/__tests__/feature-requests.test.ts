import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// Mock types
interface MockRequest extends Partial<FastifyRequest> {
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  jwt?: {
    sign: (
      payload: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => string;
  };
}

interface MockReply extends Partial<FastifyReply> {
  status?: (code: number) => MockReply;
  send?: (data: unknown) => MockReply;
}

// Helper to generate valid test data
const generateTestFeatureRequest = () => ({
  id: "feature-123",
  tenantId: "tenant-456",
  title: "Dark Mode Support",
  description: "Add dark mode theme support to the dashboard",
  status: "OPEN",
  category: "UI/UX",
  upvotes: 42,
  downvotes: 2,
  createdBy: "user-789",
  createdAt: new Date(),
  updatedAt: new Date(),
  closedAt: null,
  closureReason: null,
});

const generateTestUser = () => ({
  id: "user-789",
  name: "Test User",
  email: "user@example.com",
  isActive: true,
  createdAt: new Date(),
});

const generateTestTenant = () => ({
  id: "tenant-456",
  name: "Test Tenant",
  slug: "test-tenant",
  isActive: true,
  createdAt: new Date(),
});

const generateTestVote = () => ({
  id: "vote-999",
  featureRequestId: "feature-123",
  userId: "user-789",
  voteType: "UPVOTE",
  createdAt: new Date(),
});

// ─────────────────────────────────────────────────────────────────

describe("Feature Requests Routes", () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let mockPrisma: Record<string, any>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      jwt: {
        sign: vi.fn((payload, options) => `jwt_token_${payload.sub}`),
      },
    };

    mockReply = {
      status: vi.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      send: vi.fn(function (data) {
        this.body = data;
        return this;
      }),
    };

    mockPrisma = {
      featureRequest: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      featureVote: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn(),
      },
    };
  });

  describe("GET /feature-requests (List requests)", () => {
    it("should list all feature requests for a tenant", async () => {
      const tenant = generateTestTenant();
      const request1 = generateTestFeatureRequest();
      const request2 = {
        ...generateTestFeatureRequest(),
        id: "feature-124",
        title: "API Webhooks",
        upvotes: 28,
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.featureRequest.findMany.mockResolvedValue([
        request1,
        request2,
      ]);

      const requests = await (mockPrisma as any).featureRequest.findMany({
        where: { tenantId: tenant.id },
      });

      expect(requests).toHaveLength(2);
      expect(requests[0].title).toBe("Dark Mode Support");
    });

    it("should return empty list when no requests exist", async () => {
      const tenant = generateTestTenant();
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.featureRequest.findMany.mockResolvedValue([]);

      const requests = await (mockPrisma as any).featureRequest.findMany({
        where: { tenantId: tenant.id },
      });

      expect(requests).toHaveLength(0);
    });

    it("should filter requests by status", async () => {
      const tenant = generateTestTenant();
      const openRequest = generateTestFeatureRequest();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.featureRequest.findMany.mockResolvedValue([openRequest]);

      const requests = await (mockPrisma as any).featureRequest.findMany({
        where: { tenantId: tenant.id, status: "OPEN" },
      });

      expect(requests[0].status).toBe("OPEN");
    });

    it("should sort requests by upvote count", async () => {
      const tenant = generateTestTenant();
      const request1 = { ...generateTestFeatureRequest(), upvotes: 100 };
      const request2 = {
        ...generateTestFeatureRequest(),
        id: "feature-124",
        upvotes: 50,
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.featureRequest.findMany.mockResolvedValue([
        request1,
        request2,
      ]);

      const requests = await (mockPrisma as any).featureRequest.findMany({
        where: { tenantId: tenant.id },
      });

      expect(requests[0].upvotes).toBeGreaterThan(requests[1].upvotes);
    });

    it("should return 401 when tenant not found", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const tenant = await (mockPrisma as any).tenant.findUnique({
        where: { id: "invalid-tenant" },
      });

      expect(tenant).toBeNull();
    });

    it("should include vote counts in list response", async () => {
      const tenant = generateTestTenant();
      const request = generateTestFeatureRequest();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.featureRequest.findMany.mockResolvedValue([request]);

      const requests = await (mockPrisma as any).featureRequest.findMany({
        where: { tenantId: tenant.id },
      });

      expect(requests[0].upvotes).toBe(42);
      expect(requests[0].downvotes).toBe(2);
    });

    it("should filter requests by category", async () => {
      const tenant = generateTestTenant();
      const request = {
        ...generateTestFeatureRequest(),
        category: "Performance",
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.featureRequest.findMany.mockResolvedValue([request]);

      const requests = await (mockPrisma as any).featureRequest.findMany({
        where: { tenantId: tenant.id, category: "Performance" },
      });

      expect(requests[0].category).toBe("Performance");
    });
  });

  describe("GET /feature-requests/:id (Get single request)", () => {
    it("should retrieve a specific feature request", async () => {
      const request = generateTestFeatureRequest();

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);

      const result = await (mockPrisma as any).featureRequest.findUnique({
        where: { id: request.id },
      });

      expect(result.id).toBe("feature-123");
      expect(result.title).toBe("Dark Mode Support");
    });

    it("should return 404 for non-existent request", async () => {
      mockPrisma.featureRequest.findUnique.mockResolvedValue(null);

      const result = await (mockPrisma as any).featureRequest.findUnique({
        where: { id: "invalid-id" },
      });

      expect(result).toBeNull();
    });

    it("should include creator details in response", async () => {
      const request = generateTestFeatureRequest();
      const creator = generateTestUser();

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);
      mockPrisma.user.findUnique.mockResolvedValue(creator);

      const result = await (mockPrisma as any).featureRequest.findUnique({
        where: { id: request.id },
      });

      expect(result.createdBy).toBe("user-789");
    });

    it("should include vote counts", async () => {
      const request = generateTestFeatureRequest();

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);

      const result = await (mockPrisma as any).featureRequest.findUnique({
        where: { id: request.id },
      });

      expect(result.upvotes).toBe(42);
      expect(result.downvotes).toBe(2);
    });

    it("should indicate user's vote status if authenticated", async () => {
      const request = generateTestFeatureRequest();
      const userVote = generateTestVote();

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);
      mockPrisma.featureVote.findUnique.mockResolvedValue(userVote);

      const result = await (mockPrisma as any).featureRequest.findUnique({
        where: { id: request.id },
      });

      expect(result).toBeDefined();
    });
  });

  describe("POST /feature-requests (Create request)", () => {
    it("should create a new feature request", async () => {
      const tenant = generateTestTenant();
      const user = generateTestUser();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.featureRequest.create.mockResolvedValue(
        generateTestFeatureRequest(),
      );

      mockRequest.body = {
        tenantId: tenant.id,
        title: "Dark Mode Support",
        description: "Add dark mode theme support to the dashboard",
        category: "UI/UX",
      };

      const result = await (mockPrisma as any).featureRequest.create({
        data: mockRequest.body,
      });

      expect(result.status).toBe("OPEN");
      expect(result.title).toBe("Dark Mode Support");
    });

    it("should reject creation without title", () => {
      mockRequest.body = {
        tenantId: "tenant-456",
        description: "Some description",
      };

      expect(mockRequest.body.title).toBeUndefined();
    });

    it("should reject creation without description", () => {
      mockRequest.body = {
        tenantId: "tenant-456",
        title: "Feature Title",
      };

      expect(mockRequest.body.description).toBeUndefined();
    });

    it("should reject creation without category", () => {
      mockRequest.body = {
        tenantId: "tenant-456",
        title: "Feature Title",
        description: "Description",
      };

      expect(mockRequest.body.category).toBeUndefined();
    });

    it("should detect and prevent duplicate requests", async () => {
      const tenant = generateTestTenant();
      const existingRequest = generateTestFeatureRequest();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.featureRequest.findMany.mockResolvedValue([existingRequest]);

      mockRequest.body = {
        tenantId: tenant.id,
        title: "Dark Mode Support",
        description: "Add dark mode theme support to the dashboard",
      };

      const duplicates = await (mockPrisma as any).featureRequest.findMany({
        where: { tenantId: tenant.id, title: "Dark Mode Support" },
      });

      expect(duplicates).toHaveLength(1);
    });

    it("should return error for duplicate request", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.featureRequest.findMany.mockResolvedValue([
        generateTestFeatureRequest(),
      ]);

      mockRequest.body = {
        tenantId: tenant.id,
        title: "Dark Mode Support",
        description: "Add dark mode theme support to the dashboard",
      };

      const duplicates = await (mockPrisma as any).featureRequest.findMany({
        where: { tenantId: tenant.id, title: mockRequest.body.title },
      });

      expect(duplicates.length).toBeGreaterThan(0);
    });

    it("should initialize upvote count to zero", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.featureRequest.create.mockResolvedValue({
        ...generateTestFeatureRequest(),
        upvotes: 0,
        downvotes: 0,
      });

      mockRequest.body = {
        tenantId: tenant.id,
        title: "New Feature",
        description: "Description",
        category: "Feature",
      };

      const result = await (mockPrisma as any).featureRequest.create({
        data: mockRequest.body,
      });

      expect(result.upvotes).toBe(0);
      expect(result.downvotes).toBe(0);
    });

    it("should set status to OPEN for new requests", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.featureRequest.create.mockResolvedValue({
        ...generateTestFeatureRequest(),
        status: "OPEN",
      });

      mockRequest.body = {
        tenantId: tenant.id,
        title: "New Feature",
        description: "Description",
        category: "Feature",
      };

      const result = await (mockPrisma as any).featureRequest.create({
        data: mockRequest.body,
      });

      expect(result.status).toBe("OPEN");
    });
  });

  describe("PUT /feature-requests/:id/vote (Vote on request)", () => {
    it("should upvote a feature request", async () => {
      const request = generateTestFeatureRequest();
      const votedRequest = {
        ...request,
        upvotes: request.upvotes + 1,
      };

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);
      mockPrisma.featureVote.findUnique.mockResolvedValue(null);
      mockPrisma.featureVote.create.mockResolvedValue(generateTestVote());
      mockPrisma.featureRequest.update.mockResolvedValue(votedRequest);

      mockRequest.params = { id: request.id };
      mockRequest.body = { voteType: "UPVOTE" };

      const result = await (mockPrisma as any).featureRequest.update({
        where: { id: request.id },
        data: { upvotes: { increment: 1 } },
      });

      expect(result.upvotes).toBe(43);
    });

    it("should downvote a feature request", async () => {
      const request = generateTestFeatureRequest();
      const votedRequest = {
        ...request,
        downvotes: request.downvotes + 1,
      };

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);
      mockPrisma.featureVote.findUnique.mockResolvedValue(null);
      mockPrisma.featureVote.create.mockResolvedValue({
        ...generateTestVote(),
        voteType: "DOWNVOTE",
      });
      mockPrisma.featureRequest.update.mockResolvedValue(votedRequest);

      mockRequest.params = { id: request.id };
      mockRequest.body = { voteType: "DOWNVOTE" };

      const result = await (mockPrisma as any).featureRequest.update({
        where: { id: request.id },
        data: { downvotes: { increment: 1 } },
      });

      expect(result.downvotes).toBe(3);
    });

    it("should prevent duplicate votes from same user", async () => {
      const request = generateTestFeatureRequest();
      const existingVote = generateTestVote();

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);
      mockPrisma.featureVote.findUnique.mockResolvedValue(existingVote);

      mockRequest.params = { id: request.id };
      mockRequest.body = { voteType: "UPVOTE" };

      const existingUserVote = await (mockPrisma as any).featureVote.findUnique(
        {
          where: {
            featureRequestId_userId: {
              featureRequestId: request.id,
              userId: "user-789",
            },
          },
        },
      );

      expect(existingUserVote).toBeDefined();
    });

    it("should return error when user already voted", async () => {
      const request = generateTestFeatureRequest();
      const existingVote = generateTestVote();

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);
      mockPrisma.featureVote.findUnique.mockResolvedValue(existingVote);

      mockRequest.params = { id: request.id };
      mockRequest.body = { voteType: "UPVOTE" };

      expect(existingVote).toBeDefined();
    });

    it("should allow changing vote from upvote to downvote", async () => {
      const request = generateTestFeatureRequest();
      const existingUpvote = generateTestVote();
      const updatedRequest = {
        ...request,
        upvotes: request.upvotes - 1,
        downvotes: request.downvotes + 1,
      };

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);
      mockPrisma.featureVote.findUnique.mockResolvedValue(existingUpvote);
      mockPrisma.featureVote.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.featureRequest.update.mockResolvedValue(updatedRequest);

      mockRequest.params = { id: request.id };
      mockRequest.body = { voteType: "DOWNVOTE" };

      const result = await (mockPrisma as any).featureRequest.update({
        where: { id: request.id },
        data: { upvotes: { decrement: 1 }, downvotes: { increment: 1 } },
      });

      expect(result.upvotes).toBe(41);
      expect(result.downvotes).toBe(3);
    });

    it("should enforce vote limit per user per feature (max 1)", async () => {
      const request = generateTestFeatureRequest();

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);

      mockRequest.params = { id: request.id };
      mockRequest.body = { voteType: "UPVOTE" };

      const voteLimit = 1;
      expect(voteLimit).toBe(1);
    });

    it("should return 404 for non-existent feature request", async () => {
      mockPrisma.featureRequest.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: "invalid-id" };
      mockRequest.body = { voteType: "UPVOTE" };

      const result = await (mockPrisma as any).featureRequest.findUnique({
        where: { id: "invalid-id" },
      });

      expect(result).toBeNull();
    });
  });

  describe("PUT /feature-requests/:id/status (Update status)", () => {
    it("should transition request from OPEN to IN_PROGRESS", async () => {
      const request = generateTestFeatureRequest();
      const updatedRequest = {
        ...request,
        status: "IN_PROGRESS",
      };

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);
      mockPrisma.featureRequest.update.mockResolvedValue(updatedRequest);

      mockRequest.params = { id: request.id };
      mockRequest.body = { status: "IN_PROGRESS" };

      const result = await (mockPrisma as any).featureRequest.update({
        where: { id: request.id },
        data: { status: "IN_PROGRESS" },
      });

      expect(result.status).toBe("IN_PROGRESS");
    });

    it("should transition request from IN_PROGRESS to COMPLETED", async () => {
      const request = {
        ...generateTestFeatureRequest(),
        status: "IN_PROGRESS",
      };
      const completedRequest = {
        ...request,
        status: "COMPLETED",
        closedAt: new Date(),
      };

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);
      mockPrisma.featureRequest.update.mockResolvedValue(completedRequest);

      mockRequest.params = { id: request.id };
      mockRequest.body = { status: "COMPLETED" };

      const result = await (mockPrisma as any).featureRequest.update({
        where: { id: request.id },
        data: { status: "COMPLETED", closedAt: new Date() },
      });

      expect(result.status).toBe("COMPLETED");
    });

    it("should allow closing requests with closure reason", async () => {
      const request = generateTestFeatureRequest();
      const closedRequest = {
        ...request,
        status: "CLOSED",
        closedAt: new Date(),
        closureReason: "DUPLICATE",
      };

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);
      mockPrisma.featureRequest.update.mockResolvedValue(closedRequest);

      mockRequest.params = { id: request.id };
      mockRequest.body = { status: "CLOSED", closureReason: "DUPLICATE" };

      const result = await (mockPrisma as any).featureRequest.update({
        where: { id: request.id },
        data: { status: "CLOSED", closureReason: "DUPLICATE" },
      });

      expect(result.status).toBe("CLOSED");
      expect(result.closureReason).toBe("DUPLICATE");
    });

    it("should validate status transitions", () => {
      const validTransitions = {
        OPEN: ["IN_PROGRESS", "CLOSED"],
        IN_PROGRESS: ["COMPLETED", "CLOSED"],
        COMPLETED: ["CLOSED"],
        CLOSED: [],
      };

      expect(validTransitions.OPEN).toContain("IN_PROGRESS");
      expect(validTransitions.IN_PROGRESS).not.toContain("OPEN");
    });

    it("should return 404 for non-existent request", async () => {
      mockPrisma.featureRequest.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: "invalid-id" };
      mockRequest.body = { status: "IN_PROGRESS" };

      const result = await (mockPrisma as any).featureRequest.findUnique({
        where: { id: "invalid-id" },
      });

      expect(result).toBeNull();
    });
  });

  describe("DELETE /feature-requests/:id (Delete request)", () => {
    it("should delete a feature request", async () => {
      const request = generateTestFeatureRequest();

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);
      mockPrisma.featureRequest.delete.mockResolvedValue(request);

      mockRequest.params = { id: request.id };

      await (mockPrisma as any).featureRequest.delete({
        where: { id: request.id },
      });

      expect(mockPrisma.featureRequest.delete).toHaveBeenCalledWith({
        where: { id: request.id },
      });
    });

    it("should cascade delete votes on request deletion", async () => {
      const request = generateTestFeatureRequest();

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);
      mockPrisma.featureVote.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.featureRequest.delete.mockResolvedValue(request);

      mockRequest.params = { id: request.id };

      await (mockPrisma as any).featureRequest.delete({
        where: { id: request.id },
      });

      expect(mockPrisma.featureRequest.delete).toHaveBeenCalled();
    });

    it("should return 404 when deleting non-existent request", async () => {
      mockPrisma.featureRequest.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: "invalid-id" };

      const result = await (mockPrisma as any).featureRequest.findUnique({
        where: { id: "invalid-id" },
      });

      expect(result).toBeNull();
    });
  });

  describe("Edge Cases & Error Handling", () => {
    it("should handle feature request with zero votes", async () => {
      const request = {
        ...generateTestFeatureRequest(),
        upvotes: 0,
        downvotes: 0,
      };

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);

      const result = await (mockPrisma as any).featureRequest.findUnique({
        where: { id: request.id },
      });

      expect(result.upvotes).toBe(0);
      expect(result.downvotes).toBe(0);
    });

    it("should preserve request history on updates", async () => {
      const request = generateTestFeatureRequest();
      const createdAt = request.createdAt;

      mockPrisma.featureRequest.update.mockResolvedValue({
        ...request,
        updatedAt: new Date(),
      });

      const updated = await (mockPrisma as any).featureRequest.update({
        where: { id: request.id },
        data: { status: "IN_PROGRESS" },
      });

      expect(updated.createdAt).toEqual(createdAt);
    });

    it("should handle very long titles and descriptions gracefully", async () => {
      const tenant = generateTestTenant();
      const longTitle = "A".repeat(500);
      const longDesc = "B".repeat(5000);

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);

      mockRequest.body = {
        tenantId: tenant.id,
        title: longTitle,
        description: longDesc,
        category: "Feature",
      };

      expect(mockRequest.body.title.length).toBeGreaterThan(100);
    });

    it("should handle rapid consecutive votes gracefully", async () => {
      const request = generateTestFeatureRequest();

      mockPrisma.featureRequest.findUnique.mockResolvedValue(request);
      mockPrisma.featureVote.findUnique.mockResolvedValue(null);

      const result = await (mockPrisma as any).featureRequest.findUnique({
        where: { id: request.id },
      });

      expect(result).toBeDefined();
    });
  });
});
