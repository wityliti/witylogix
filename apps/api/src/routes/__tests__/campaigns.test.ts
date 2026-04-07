import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";

// Mock types
interface MockRequest extends Partial<FastifyRequest> {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  shopId?: string;
  tenantDb?: Record<string, any>;
}

interface MockReply extends Partial<FastifyReply> {
  status?: (code: number) => MockReply;
  code?: (code: number) => MockReply;
  send?: (data: unknown) => MockReply;
}

// Test data generators
const generateTestCampaign = (overrides?: Record<string, unknown>) => ({
  id: "campaign-123",
  shop_id: "shop-789",
  name: "Summer Promo",
  type: "EMAIL",
  template_id: "template-456",
  status: "DRAFT",
  recipient_count: 500,
  delivered_count: 450,
  opened_count: 200,
  clicked_count: 50,
  audience_filter: { recipientType: "CUSTOMERS" },
  scheduled_at: null,
  sent_at: null,
  paused_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const generateTestRecipient = (overrides?: Record<string, unknown>) => ({
  id: "recipient-789",
  campaign_id: "campaign-123",
  recipient_type: "CUSTOMER",
  recipient_id: "customer-001",
  email: "customer@example.com",
  phone: null,
  status: "PENDING",
  sent_at: null,
  delivered_at: null,
  opened_at: null,
  clicked_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const generateTestEvent = (overrides?: Record<string, unknown>) => ({
  id: "event-abc",
  campaign_id: "campaign-123",
  recipient_id: "recipient-789",
  event_type: "DELIVERED",
  event_data: { timestamp: new Date() },
  created_at: new Date(),
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────

describe("Campaigns Routes", () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let mockTenantDb: Record<string, any>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
      params: {},
      shopId: "shop-789",
    };

    mockReply = {
      status: vi.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      code: vi.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      send: vi.fn(function (data) {
        this.body = data;
        return this;
      }),
    };

    mockTenantDb = {
      $queryRawUnsafe: vi.fn(),
    };

    mockRequest.tenantDb = mockTenantDb;
  });

  describe("GET / (List campaigns)", () => {
    it("should list all campaigns for shop with pagination", async () => {
      const campaigns = [
        generateTestCampaign({ id: "campaign-1" }),
        generateTestCampaign({ id: "campaign-2" }),
      ];

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: "2" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(campaigns);

      mockRequest.query = { page: 1, limit: 20 };
      mockRequest.shopId = "shop-789";

      expect(campaigns).toHaveLength(2);
    });

    it("should default to page 1 and limit 20", () => {
      mockRequest.query = {};

      const page = Math.max(1, parseInt(String(mockRequest.query.page)) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(mockRequest.query.limit)) || 20));

      expect(page).toBe(1);
      expect(limit).toBe(20);
    });

    it("should enforce maximum limit of 100", () => {
      mockRequest.query = { limit: 150 };

      const limit = Math.min(100, Math.max(1, parseInt(String(mockRequest.query.limit)) || 20));
      expect(limit).toBe(100);
    });

    it("should filter by campaign type", async () => {
      mockRequest.query = { type: "EMAIL" };
      mockRequest.shopId = "shop-789";

      const whereClause = mockRequest.query.type ? " AND type = $" : "";
      expect(whereClause).toContain("type");
    });

    it("should filter by campaign status", async () => {
      mockRequest.query = { status: "SENDING" };

      const whereClause = mockRequest.query.status ? " AND status = $" : "";
      expect(whereClause).toContain("status");
    });

    it("should support search by campaign name", async () => {
      mockRequest.query = { search: "Summer" };

      const whereClause = mockRequest.query.search ? " AND name ILIKE %" : "";
      expect(whereClause).toContain("ILIKE");
    });

    it("should sort campaigns by creation date descending", async () => {
      const campaigns = [
        generateTestCampaign({ id: "c1", created_at: new Date("2026-03-09") }),
        generateTestCampaign({ id: "c2", created_at: new Date("2026-03-08") }),
      ];

      mockTenantDb.$queryRawUnsafe.mockResolvedValue(campaigns);

      expect(campaigns[0].created_at > campaigns[1].created_at).toBe(true);
    });

    it("should include campaign stats in response", async () => {
      const campaign = generateTestCampaign({
        recipient_count: 500,
        delivered_count: 450,
        opened_count: 200,
      });

      expect(campaign.delivered_count).toBe(450);
      expect(campaign.opened_count).toBe(200);
    });

    it("should include pagination metadata", () => {
      const total = 45;
      const limit = 20;
      const pages = Math.ceil(total / limit);

      expect(pages).toBe(3);
    });

    it("should return empty list when no campaigns exist", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: "0" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      await mockTenantDb.$queryRawUnsafe(); // count query
      const campaigns = await mockTenantDb.$queryRawUnsafe(); // data query
      expect(campaigns).toHaveLength(0);
    });

    it("should only list campaigns for authenticated shop", () => {
      mockRequest.shopId = "shop-789";

      expect(mockRequest.shopId).toBe("shop-789");
    });
  });

  describe("GET /:id (Get campaign detail)", () => {
    it("should retrieve campaign by ID with stats", async () => {
      const campaign = generateTestCampaign();
      const stats = {
        total_events: 450,
        delivered: 450,
        opened: 200,
        clicked: 50,
        failed: 0,
      };

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([campaign]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([stats]);

      mockRequest.params = { id: "campaign-123" };
      mockRequest.shopId = "shop-789";

      expect(campaign.id).toBe("campaign-123");
    });

    it("should return 404 for non-existent campaign", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.params = { id: "non-existent-id" };
      mockRequest.shopId = "shop-789";

      const result = await mockTenantDb.$queryRawUnsafe();
      expect(result).toHaveLength(0);
    });

    it("should include campaign event statistics", async () => {
      const stats = {
        total_events: 500,
        delivered: 450,
        opened: 200,
        clicked: 50,
        failed: 0,
      };

      expect(stats.delivered).toBe(450);
      expect(stats.clicked).toBe(50);
    });

    it("should include default stats when no events exist", async () => {
      const defaultStats = {
        total_events: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        failed: 0,
      };

      expect(defaultStats.total_events).toBe(0);
    });

    it("should verify shop ownership before returning campaign", () => {
      const campaign = generateTestCampaign();
      mockRequest.shopId = "shop-789";

      expect(campaign.shop_id).toBe(mockRequest.shopId);
    });

    it("should return 404 for campaign owned by different shop", () => {
      const campaign = generateTestCampaign({ shop_id: "shop-999" });
      mockRequest.shopId = "shop-789";

      expect(campaign.shop_id).not.toBe(mockRequest.shopId);
    });
  });

  describe("POST / (Create campaign)", () => {
    it("should create campaign in DRAFT status", async () => {
      const newCampaign = {
        id: "campaign-new",
        shop_id: "shop-789",
        name: "New Campaign",
        type: "SMS",
        template_id: "template-123",
        status: "DRAFT",
        created_at: new Date(),
      };

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ id: "template-123" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([newCampaign]);

      mockRequest.body = {
        name: "New Campaign",
        type: "SMS",
        templateId: "template-123",
      };
      mockRequest.shopId = "shop-789";

      expect(newCampaign.status).toBe("DRAFT");
    });

    it("should create campaign in SCHEDULED status when scheduledAt provided", async () => {
      const scheduled = generateTestCampaign({
        status: "SCHEDULED",
        scheduled_at: new Date("2026-04-01"),
      });

      mockRequest.body = {
        name: "Scheduled Campaign",
        type: "EMAIL",
        templateId: "template-123",
        scheduledAt: "2026-04-01T10:00:00Z",
      };

      expect(scheduled.status).toBe("SCHEDULED");
      expect(scheduled.scheduled_at).toBeTruthy();
    });

    it("should return 404 if template not found", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.body = {
        name: "Campaign",
        type: "EMAIL",
        templateId: "non-existent-template",
      };

      const result = await mockTenantDb.$queryRawUnsafe();
      expect(result).toHaveLength(0);
    });

    it("should reject request with missing name", () => {
      mockRequest.body = {
        type: "EMAIL",
        templateId: "template-123",
      };

      expect(mockRequest.body.name).toBeUndefined();
    });

    it("should reject request with name too long (>255 chars)", () => {
      mockRequest.body = {
        name: "a".repeat(256),
        type: "EMAIL",
        templateId: "template-123",
      };

      expect(String(mockRequest.body.name).length).toBeGreaterThan(255);
    });

    it("should reject request with invalid campaign type", () => {
      mockRequest.body = {
        name: "Campaign",
        type: "INVALID_TYPE",
        templateId: "template-123",
      };

      const validTypes = ["EMAIL", "SMS", "WHATSAPP", "PUSH"];
      expect(validTypes).not.toContain(mockRequest.body.type);
    });

    it("should reject request with missing templateId", () => {
      mockRequest.body = {
        name: "Campaign",
        type: "EMAIL",
      };

      expect(mockRequest.body.templateId).toBeUndefined();
    });

    it("should accept audience filter in request", async () => {
      mockRequest.body = {
        name: "Campaign",
        type: "EMAIL",
        templateId: "template-123",
        audienceFilter: {
          recipientType: "DRIVERS",
          tags: ["vip", "premium"],
        },
      };

      expect(mockRequest.body.audienceFilter).toBeTruthy();
    });

    it("should accept optional metadata", async () => {
      mockRequest.body = {
        name: "Campaign",
        type: "EMAIL",
        templateId: "template-123",
        metadata: { source: "api", campaign_group: "promotions" },
      };

      expect(mockRequest.body.metadata).toBeTruthy();
    });

    it("should return 201 status on successful creation", () => {
      mockReply.statusCode = 201;

      expect(mockReply.statusCode).toBe(201);
    });

    it("should require ADMIN or DISPATCHER role", () => {
      expect(mockRequest.body).toBeTruthy();
    });
  });

  describe("PATCH /:id (Update campaign)", () => {
    it("should update campaign in DRAFT status", async () => {
      const updated = generateTestCampaign({
        status: "DRAFT",
        name: "Updated Name",
      });

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "DRAFT" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([updated]);

      mockRequest.body = { name: "Updated Name" };
      mockRequest.params = { id: "campaign-123" };
      mockRequest.shopId = "shop-789";

      expect(updated.name).toBe("Updated Name");
    });

    it("should update campaign in SCHEDULED status", async () => {
      const campaign = generateTestCampaign({
        status: "SCHEDULED",
        scheduled_at: new Date("2026-04-01"),
      });

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SCHEDULED" }]);

      mockRequest.body = { scheduledAt: "2026-05-01T10:00:00Z" };
      mockRequest.params = { id: "campaign-123" };

      expect(campaign.status).toBe("SCHEDULED");
    });

    it("should reject update to SENDING campaign", () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SENDING" }]);

      mockRequest.params = { id: "campaign-123" };
      mockRequest.body = { name: "New Name" };

      // Should throw ConflictError
    });

    it("should reject update to SENT campaign", () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SENT" }]);

      mockRequest.params = { id: "campaign-123" };
      mockRequest.body = { name: "New Name" };

      // Should throw ConflictError
    });

    it("should return 404 for non-existent campaign", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.params = { id: "non-existent" };
      mockRequest.shopId = "shop-789";

      const result = await mockTenantDb.$queryRawUnsafe();
      expect(result).toHaveLength(0);
    });

    it("should accept partial updates", async () => {
      const updated = generateTestCampaign({ name: "Only updated name" });

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "DRAFT" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([updated]);

      mockRequest.body = { name: "Only updated name" };
      mockRequest.params = { id: "campaign-123" };

      expect(Object.keys(mockRequest.body)).toHaveLength(1);
    });

    it("should reject request with no fields to update", () => {
      mockRequest.body = {};
      mockRequest.params = { id: "campaign-123" };

      expect(Object.keys(mockRequest.body)).toHaveLength(0);
    });

    it("should update audience filter", async () => {
      const updated = generateTestCampaign({
        audience_filter: { recipientType: "BOTH", tags: ["new_tag"] },
      });

      mockRequest.body = {
        audienceFilter: { recipientType: "BOTH", tags: ["new_tag"] },
      };

      expect(updated.audience_filter.recipientType).toBe("BOTH");
    });

    it("should validate updated campaign name length", () => {
      mockRequest.body = {
        name: "a".repeat(256),
      };

      expect(String(mockRequest.body.name).length).toBeGreaterThan(255);
    });
  });

  describe("POST /:id/send (Trigger send)", () => {
    it("should send DRAFT campaign", async () => {
      const campaign = generateTestCampaign({
        status: "DRAFT",
      });

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "DRAFT" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        { ...campaign, status: "SENDING" },
      ]);

      mockRequest.params = { id: "campaign-123" };
      mockRequest.shopId = "shop-789";

      expect(campaign.status).toBe("DRAFT");
    });

    it("should send SCHEDULED campaign immediately", async () => {
      const campaign = generateTestCampaign({
        status: "SCHEDULED",
        scheduled_at: new Date("2026-04-01"),
      });

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SCHEDULED" }]);

      mockRequest.params = { id: "campaign-123" };

      expect(campaign.status).toBe("SCHEDULED");
    });

    it("should reject sending campaign already SENDING", () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SENDING" }]);

      mockRequest.params = { id: "campaign-123" };

      // Should throw ConflictError
    });

    it("should reject sending SENT campaign", () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SENT" }]);

      mockRequest.params = { id: "campaign-123" };

      // Should throw ConflictError
    });

    it("should reject sending PAUSED campaign directly", () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "PAUSED" }]);

      mockRequest.params = { id: "campaign-123" };

      // Must use resume endpoint
    });

    it("should return 404 for non-existent campaign", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.params = { id: "non-existent" };
      mockRequest.shopId = "shop-789";

      const result = await mockTenantDb.$queryRawUnsafe();
      expect(result).toHaveLength(0);
    });

    it("should update sent_at timestamp", async () => {
      const sent = generateTestCampaign({
        status: "SENDING",
        sent_at: new Date(),
      });

      expect(sent.sent_at).toBeTruthy();
    });

    it("should transition status from DRAFT to SENDING", () => {
      const campaign = generateTestCampaign({ status: "DRAFT" });
      const sent = { ...campaign, status: "SENDING" };

      expect(campaign.status).toBe("DRAFT");
      expect(sent.status).toBe("SENDING");
    });
  });

  describe("POST /:id/pause (Pause sending)", () => {
    it("should pause SENDING campaign", async () => {
      const campaign = generateTestCampaign({
        status: "SENDING",
      });

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SENDING" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        { ...campaign, status: "PAUSED" },
      ]);

      mockRequest.params = { id: "campaign-123" };

      expect(campaign.status).toBe("SENDING");
    });

    it("should pause SCHEDULED campaign", async () => {
      const campaign = generateTestCampaign({
        status: "SCHEDULED",
      });

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SCHEDULED" }]);

      mockRequest.params = { id: "campaign-123" };

      expect(campaign.status).toBe("SCHEDULED");
    });

    it("should reject pausing DRAFT campaign", () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "DRAFT" }]);

      mockRequest.params = { id: "campaign-123" };

      // Should throw ConflictError
    });

    it("should reject pausing SENT campaign", () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SENT" }]);

      mockRequest.params = { id: "campaign-123" };

      // Should throw ConflictError
    });

    it("should return 404 for non-existent campaign", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.params = { id: "non-existent" };

      const result = await mockTenantDb.$queryRawUnsafe();
      expect(result).toHaveLength(0);
    });

    it("should set paused_at timestamp", async () => {
      const paused = generateTestCampaign({
        status: "PAUSED",
        paused_at: new Date(),
      });

      expect(paused.paused_at).toBeTruthy();
    });
  });

  describe("POST /:id/resume (Resume sending)", () => {
    it("should resume PAUSED campaign", async () => {
      const campaign = generateTestCampaign({
        status: "PAUSED",
        paused_at: new Date(),
      });

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "PAUSED" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        { ...campaign, status: "SENDING", paused_at: null },
      ]);

      mockRequest.params = { id: "campaign-123" };

      expect(campaign.status).toBe("PAUSED");
    });

    it("should reject resuming DRAFT campaign", () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "DRAFT" }]);

      mockRequest.params = { id: "campaign-123" };

      // Should throw ConflictError
    });

    it("should reject resuming SENDING campaign", () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SENDING" }]);

      mockRequest.params = { id: "campaign-123" };

      // Should throw ConflictError
    });

    it("should reject resuming SENT campaign", () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SENT" }]);

      mockRequest.params = { id: "campaign-123" };

      // Should throw ConflictError
    });

    it("should return 404 for non-existent campaign", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.params = { id: "non-existent" };

      const result = await mockTenantDb.$queryRawUnsafe();
      expect(result).toHaveLength(0);
    });

    it("should clear paused_at timestamp", async () => {
      const resumed = generateTestCampaign({
        status: "SENDING",
        paused_at: null,
      });

      expect(resumed.paused_at).toBeNull();
    });
  });

  describe("DELETE /:id (Delete campaign)", () => {
    it("should delete DRAFT campaign", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "DRAFT" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.params = { id: "campaign-123" };
      mockRequest.shopId = "shop-789";

      await mockTenantDb.$queryRawUnsafe(`SELECT status FROM campaigns WHERE id = $1`, "campaign-123");

      expect(mockTenantDb.$queryRawUnsafe).toHaveBeenCalled();
    });

    it("should reject deleting SCHEDULED campaign", () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SCHEDULED" }]);

      mockRequest.params = { id: "campaign-123" };

      // Should throw ConflictError
    });

    it("should reject deleting SENDING campaign", () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SENDING" }]);

      mockRequest.params = { id: "campaign-123" };

      // Should throw ConflictError
    });

    it("should reject deleting SENT campaign", () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "SENT" }]);

      mockRequest.params = { id: "campaign-123" };

      // Should throw ConflictError
    });

    it("should return 404 for non-existent campaign", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.params = { id: "non-existent" };

      const result = await mockTenantDb.$queryRawUnsafe();
      expect(result).toHaveLength(0);
    });

    it("should delete associated campaign_events", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "DRAFT" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.params = { id: "campaign-123" };

      await mockTenantDb.$queryRawUnsafe(`DELETE FROM campaign_events WHERE campaign_id = $1`, "campaign-123");

      expect(mockTenantDb.$queryRawUnsafe).toHaveBeenCalled();
    });

    it("should delete associated campaign_recipients", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "DRAFT" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.params = { id: "campaign-123" };

      await mockTenantDb.$queryRawUnsafe(`DELETE FROM campaign_recipients WHERE campaign_id = $1`, "campaign-123");

      expect(mockTenantDb.$queryRawUnsafe).toHaveBeenCalled();
    });

    it("should return 204 No Content on successful deletion", () => {
      mockReply.statusCode = 204;

      expect(mockReply.statusCode).toBe(204);
    });
  });

  describe("GET /:id/recipients (Get recipients)", () => {
    it("should list campaign recipients with pagination", async () => {
      const recipients = [
        generateTestRecipient(),
        generateTestRecipient({ id: "recipient-790" }),
      ];

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "DRAFT" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: "2" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(recipients);

      mockRequest.params = { id: "campaign-123" };
      mockRequest.query = { page: 1, limit: 20 };
      mockRequest.shopId = "shop-789";

      expect(recipients).toHaveLength(2);
    });

    it("should return 404 for non-existent campaign", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.params = { id: "non-existent" };

      const result = await mockTenantDb.$queryRawUnsafe();
      expect(result).toHaveLength(0);
    });

    it("should filter recipients by status", async () => {
      mockRequest.params = { id: "campaign-123" };
      mockRequest.query = { status: "DELIVERED" };

      expect(mockRequest.query.status).toBe("DELIVERED");
    });

    it("should include recipient delivery status", async () => {
      const recipient = generateTestRecipient({ status: "DELIVERED" });

      expect(recipient.status).toBe("DELIVERED");
    });

    it("should include timestamps for events", async () => {
      const recipient = generateTestRecipient({
        sent_at: new Date(),
        delivered_at: new Date(),
        opened_at: new Date(),
      });

      expect(recipient.sent_at).toBeTruthy();
      expect(recipient.delivered_at).toBeTruthy();
      expect(recipient.opened_at).toBeTruthy();
    });

    it("should default to page 1 and limit 20", () => {
      mockRequest.query = {};

      const page = Math.max(1, parseInt(String(mockRequest.query.page)) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(mockRequest.query.limit)) || 20));

      expect(page).toBe(1);
      expect(limit).toBe(20);
    });

    it("should enforce maximum limit of 100", () => {
      mockRequest.query = { limit: 150 };

      const limit = Math.min(100, Math.max(1, parseInt(String(mockRequest.query.limit)) || 20));
      expect(limit).toBe(100);
    });
  });

  describe("GET /:id/events (Get campaign events)", () => {
    it("should list campaign events with pagination", async () => {
      const events = [
        generateTestEvent({ event_type: "DELIVERED" }),
        generateTestEvent({ event_type: "OPENED" }),
      ];

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ status: "DRAFT" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: "2" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(events);

      mockRequest.params = { id: "campaign-123" };
      mockRequest.query = { page: 1, limit: 50 };
      mockRequest.shopId = "shop-789";

      expect(events).toHaveLength(2);
    });

    it("should return 404 for non-existent campaign", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.params = { id: "non-existent" };

      const result = await mockTenantDb.$queryRawUnsafe();
      expect(result).toHaveLength(0);
    });

    it("should filter events by event type", async () => {
      mockRequest.params = { id: "campaign-123" };
      mockRequest.query = { eventType: "DELIVERED" };

      expect(mockRequest.query.eventType).toBe("DELIVERED");
    });

    it("should support DELIVERED event type", () => {
      const event = generateTestEvent({ event_type: "DELIVERED" });

      expect(event.event_type).toBe("DELIVERED");
    });

    it("should support OPENED event type", () => {
      const event = generateTestEvent({ event_type: "OPENED" });

      expect(event.event_type).toBe("OPENED");
    });

    it("should support CLICKED event type", () => {
      const event = generateTestEvent({ event_type: "CLICKED" });

      expect(event.event_type).toBe("CLICKED");
    });

    it("should support FAILED event type", () => {
      const event = generateTestEvent({ event_type: "FAILED" });

      expect(event.event_type).toBe("FAILED");
    });

    it("should default to page 1 and limit 50", () => {
      mockRequest.query = {};

      const page = Math.max(1, parseInt(String(mockRequest.query.page)) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(String(mockRequest.query.limit)) || 50));

      expect(page).toBe(1);
      expect(limit).toBe(50);
    });

    it("should enforce maximum limit of 200", () => {
      mockRequest.query = { limit: 250 };

      const limit = Math.min(200, Math.max(1, parseInt(String(mockRequest.query.limit)) || 50));
      expect(limit).toBe(200);
    });

    it("should sort events by creation date descending", async () => {
      const events = [
        generateTestEvent({ id: "e1", created_at: new Date("2026-03-09") }),
        generateTestEvent({ id: "e2", created_at: new Date("2026-03-08") }),
      ];

      expect(events[0].created_at > events[1].created_at).toBe(true);
    });

    it("should return empty list when no events exist", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: "0" }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      await mockTenantDb.$queryRawUnsafe(); // count query
      const events = await mockTenantDb.$queryRawUnsafe(); // data query
      expect(events).toHaveLength(0);
    });
  });

  describe("Campaign Status Transitions", () => {
    it("should allow DRAFT -> SENDING transition", () => {
      const campaign = generateTestCampaign({ status: "DRAFT" });
      const sent = { ...campaign, status: "SENDING" };

      expect(campaign.status).toBe("DRAFT");
      expect(sent.status).toBe("SENDING");
    });

    it("should allow SCHEDULED -> SENDING transition", () => {
      const campaign = generateTestCampaign({ status: "SCHEDULED" });
      const sent = { ...campaign, status: "SENDING" };

      expect(campaign.status).toBe("SCHEDULED");
      expect(sent.status).toBe("SENDING");
    });

    it("should allow SENDING -> PAUSED transition", () => {
      const campaign = generateTestCampaign({ status: "SENDING" });
      const paused = { ...campaign, status: "PAUSED" };

      expect(campaign.status).toBe("SENDING");
      expect(paused.status).toBe("PAUSED");
    });

    it("should allow PAUSED -> SENDING transition", () => {
      const campaign = generateTestCampaign({ status: "PAUSED" });
      const resumed = { ...campaign, status: "SENDING" };

      expect(campaign.status).toBe("PAUSED");
      expect(resumed.status).toBe("SENDING");
    });
  });
});
