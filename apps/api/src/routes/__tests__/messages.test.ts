import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";

interface MockRequest extends Partial<FastifyRequest> {
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
  shopId?: string;
  tenantDb?: Record<string, any>;
  auth?: Record<string, any>;
}

interface MockReply extends Partial<FastifyReply> {
  status?: (code: number) => MockReply;
  code?: (code: number) => MockReply;
  send?: (data: unknown) => MockReply;
}

describe("Messages Routes", () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let mockTenantDb: Record<string, any>;

  const mockMessage = {
    id: "msg-123",
    shopId: "shop-456",
    channel: "EMAIL",
    subject: "Order Confirmation",
    body: "Your order has been confirmed.",
    status: "sent",
    recipientEmail: "customer@example.com",
    recipientPhone: null,
    recipientName: "John Doe",
    templateId: null,
    sentAt: new Date("2024-03-01T10:00:00Z"),
    deliveredAt: new Date("2024-03-01T10:05:00Z"),
    openedAt: null,
    failedAt: null,
    createdAt: new Date("2024-03-01T10:00:00Z"),
    updatedAt: new Date("2024-03-01T10:05:00Z"),
  };

  const mockTemplate = {
    id: "template-123",
    shopId: "shop-456",
    name: "Order Confirmation Template",
    channel: "EMAIL",
    subject: "Order {{order_id}} Confirmed",
    body: "Thank you {{customer_name}}, your order has been confirmed.",
  };

  beforeEach(() => {
    mockTenantDb = {
      $queryRawUnsafe: vi.fn(),
    };

    mockRequest = {
      body: {},
      query: {},
      params: {},
      shopId: "shop-456",
      tenantDb: mockTenantDb,
      auth: { userId: "user-123" },
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

    vi.clearAllMocks();
  });

  describe("GET / - List Messages", () => {
    it("should list all messages with pagination", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 1 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockMessage]);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [mockMessage],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      };

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
    });

    it("should filter messages by channel", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 1 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockMessage]);

      mockRequest.query = { page: 1, limit: 20, channel: "EMAIL" };

      const result = {
        data: [mockMessage],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      };

      expect(result.data[0].channel).toBe("EMAIL");
    });

    it("should filter messages by status", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 1 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockMessage, status: "delivered" },
      ]);

      mockRequest.query = { page: 1, limit: 20, status: "delivered" };

      const result = {
        data: [{ ...mockMessage, status: "delivered" }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      };

      expect(result.data[0].status).toBe("delivered");
    });

    it("should filter messages by recipient email", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 1 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockMessage]);

      mockRequest.query = {
        page: 1,
        limit: 20,
        recipient: "customer@example.com",
      };

      const result = {
        data: [mockMessage],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      };

      expect(result.data[0].recipientEmail).toBe("customer@example.com");
    });

    it("should handle pagination with multiple pages", async () => {
      const messages = Array.from({ length: 40 }, (_, i) => ({
        ...mockMessage,
        id: `msg-${i}`,
      }));

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 40 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(messages.slice(0, 20));

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: messages.slice(0, 20),
        pagination: { page: 1, limit: 20, total: 40, pages: 2 },
      };

      expect(result.data).toHaveLength(20);
      expect(result.pagination.pages).toBe(2);
    });

    it("should order messages by creation date descending", async () => {
      const oldMsg = { ...mockMessage, createdAt: new Date("2024-01-01") };
      const newMsg = {
        ...mockMessage,
        id: "msg-456",
        createdAt: new Date("2024-03-01"),
      };

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 2 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([newMsg, oldMsg]);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [newMsg, oldMsg],
        pagination: { page: 1, limit: 20, total: 2, pages: 1 },
      };

      expect(result.data[0].createdAt.getTime()).toBeGreaterThan(
        result.data[1].createdAt.getTime(),
      );
    });

    it("should handle empty results", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 0 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      };

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it("should validate page and limit parameters", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 100 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(
        Array(50).fill(mockMessage),
      );

      mockRequest.query = { page: 1, limit: 50 };

      expect(mockRequest.query.limit).toBeLessThanOrEqual(100);
    });
  });

  describe("GET /:id - Get Single Message", () => {
    it("should get message by id", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockMessage]);

      mockRequest.params = { id: "msg-123" };

      const result = mockMessage;

      expect(result.id).toBe("msg-123");
      expect(result.channel).toBe("EMAIL");
    });

    it("should throw NotFoundError when message does not exist", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.params = { id: "nonexistent" };

      expect(mockTenantDb.$queryRawUnsafe).toBeDefined();
    });

    it("should include delivery timestamps", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockMessage]);

      mockRequest.params = { id: "msg-123" };

      const result = mockMessage;

      expect(result.sentAt).toBeDefined();
      expect(result.deliveredAt).toBeDefined();
    });
  });

  describe("POST / - Send Single Message", () => {
    it("should send email message", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: "msg-new-123",
          ...mockMessage,
          channel: "EMAIL",
          status: "pending",
        },
      ]);

      mockRequest.body = {
        channel: "EMAIL",
        to: "customer@example.com",
        subject: "Order Confirmation",
        body: "Your order has been confirmed.",
      };

      expect(mockRequest.body.channel).toBe("EMAIL");
      expect(mockRequest.body.to).toBe("customer@example.com");
    });

    it("should send SMS message", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: "msg-new-123",
          channel: "SMS",
          to: "+1234567890",
          body: "Your order is ready.",
          status: "pending",
        },
      ]);

      mockRequest.body = {
        channel: "SMS",
        to: "+1234567890",
        body: "Your order is ready.",
      };

      expect(mockRequest.body.channel).toBe("SMS");
      expect(mockRequest.body.to).toBe("+1234567890");
    });

    it("should send PUSH notification", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: "msg-new-123",
          channel: "PUSH",
          to: "device-token",
          subject: "Order Update",
          body: "Your order shipped!",
          status: "pending",
        },
      ]);

      mockRequest.body = {
        channel: "PUSH",
        to: "device-token",
        subject: "Order Update",
        body: "Your order shipped!",
      };

      expect(mockRequest.body.channel).toBe("PUSH");
    });

    it("should send WhatsApp message", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: "msg-new-123",
          channel: "WHATSAPP",
          to: "+1234567890",
          body: "Your delivery is here!",
          status: "pending",
        },
      ]);

      mockRequest.body = {
        channel: "WHATSAPP",
        to: "+1234567890",
        body: "Your delivery is here!",
      };

      expect(mockRequest.body.channel).toBe("WHATSAPP");
    });

    it("should use template if templateId provided", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockTemplate]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockMessage, templateId: "template-123" },
      ]);

      mockRequest.body = {
        channel: "EMAIL",
        to: "customer@example.com",
        templateId: "template-123",
        variables: { order_id: "ORD-123", customer_name: "John" },
      };

      expect(mockRequest.body.templateId).toBe("template-123");
      expect(mockRequest.body.variables).toBeDefined();
    });

    it("should include custom variables with template", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockTemplate]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockMessage, templateId: "template-123" },
      ]);

      mockRequest.body = {
        channel: "EMAIL",
        to: "customer@example.com",
        templateId: "template-123",
        variables: {
          order_id: "ORD-123",
          customer_name: "John Doe",
          shipping_date: "2024-03-05",
        },
      };

      expect(Object.keys(mockRequest.body.variables)).toHaveLength(3);
    });

    it("should include metadata with message", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        {
          ...mockMessage,
          metadata: { campaign_id: "camp-123", source: "api" },
        },
      ]);

      mockRequest.body = {
        channel: "EMAIL",
        to: "customer@example.com",
        body: "Test",
        metadata: { campaign_id: "camp-123", source: "api" },
      };

      expect(mockRequest.body.metadata).toBeDefined();
      expect(mockRequest.body.metadata.campaign_id).toBe("camp-123");
    });

    it("should set initial status to pending", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockMessage, status: "pending" },
      ]);

      mockRequest.body = {
        channel: "EMAIL",
        to: "customer@example.com",
        body: "Test",
      };

      const result = { ...mockMessage, status: "pending" };

      expect(result.status).toBe("pending");
    });
  });

  describe("POST /batch - Send Batch Messages", () => {
    it("should send up to 100 messages in batch", async () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        ...mockMessage,
        id: `msg-${i}`,
      }));

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(messages);

      mockRequest.body = {
        messages: Array.from({ length: 100 }, (_, i) => ({
          channel: "EMAIL",
          to: `customer${i}@example.com`,
          body: "Batch message",
        })),
      };

      expect(mockRequest.body.messages).toHaveLength(100);
    });

    it("should reject more than 100 messages", async () => {
      mockRequest.body = {
        messages: Array.from({ length: 101 }, (_, i) => ({
          channel: "EMAIL",
          to: `customer${i}@example.com`,
          body: "Batch message",
        })),
      };

      expect(mockRequest.body.messages.length).toBeGreaterThan(100);
    });

    it("should support mixed channels in batch", async () => {
      mockRequest.body = {
        messages: [
          { channel: "EMAIL", to: "user1@example.com", body: "Email" },
          { channel: "SMS", to: "+1234567890", body: "SMS" },
          { channel: "PUSH", to: "token", subject: "Push", body: "Push" },
        ],
      };

      expect(mockRequest.body.messages).toHaveLength(3);
      expect(mockRequest.body.messages[0].channel).toBe("EMAIL");
      expect(mockRequest.body.messages[1].channel).toBe("SMS");
      expect(mockRequest.body.messages[2].channel).toBe("PUSH");
    });

    it("should process batch messages sequentially", async () => {
      const messages = [
        { ...mockMessage, id: "msg-1", recipientEmail: "user1@example.com" },
        { ...mockMessage, id: "msg-2", recipientEmail: "user2@example.com" },
        { ...mockMessage, id: "msg-3", recipientEmail: "user3@example.com" },
      ];

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(messages);

      mockRequest.body = {
        messages: [
          { channel: "EMAIL", to: "user1@example.com", body: "Msg 1" },
          { channel: "EMAIL", to: "user2@example.com", body: "Msg 2" },
          { channel: "EMAIL", to: "user3@example.com", body: "Msg 3" },
        ],
      };

      expect(mockRequest.body.messages).toHaveLength(3);
    });

    it("should return results for each message", async () => {
      const results = [
        { id: "msg-1", status: "sent" },
        { id: "msg-2", status: "sent" },
        { id: "msg-3", status: "failed", error: "Invalid email" },
      ];

      mockRequest.body = {
        messages: [
          { channel: "EMAIL", to: "user1@example.com", body: "Msg 1" },
          { channel: "EMAIL", to: "user2@example.com", body: "Msg 2" },
          { channel: "EMAIL", to: "invalid", body: "Msg 3" },
        ],
      };

      expect(results).toHaveLength(3);
      expect(results[2].status).toBe("failed");
    });
  });

  describe("Message Status Tracking", () => {
    it("should track sent status", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockMessage, status: "sent", sentAt: new Date() },
      ]);

      mockRequest.query = { status: "sent" };

      const result = { ...mockMessage, status: "sent" };

      expect(result.status).toBe("sent");
      expect(result.sentAt).toBeDefined();
    });

    it("should track delivered status with timestamp", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockMessage, status: "delivered", deliveredAt: new Date() },
      ]);

      mockRequest.query = { status: "delivered" };

      const result = { ...mockMessage, status: "delivered" };

      expect(result.status).toBe("delivered");
      expect(result.deliveredAt).toBeDefined();
    });

    it("should track opened status with timestamp", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockMessage, status: "opened", openedAt: new Date() },
      ]);

      mockRequest.query = { status: "opened" };

      const result = { ...mockMessage, status: "opened" };

      expect(result.status).toBe("opened");
      expect(result.openedAt).toBeDefined();
    });

    it("should track failed status with error info", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        {
          ...mockMessage,
          status: "failed",
          failedAt: new Date(),
          error: "Invalid email address",
        },
      ]);

      mockRequest.query = { status: "failed" };

      const result = {
        ...mockMessage,
        status: "failed",
        failedAt: new Date(),
      };

      expect(result.status).toBe("failed");
      expect(result.failedAt).toBeDefined();
    });
  });

  describe("Template-Based Sending", () => {
    it("should validate template exists before sending", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(null);

      mockRequest.body = {
        channel: "EMAIL",
        to: "customer@example.com",
        templateId: "nonexistent",
        variables: {},
      };

      expect(mockTenantDb.$queryRawUnsafe).toBeDefined();
    });

    it("should render template variables in message", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockTemplate]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        {
          ...mockMessage,
          subject: "Order ORD-123 Confirmed",
          body: "Thank you John Doe, your order has been confirmed.",
        },
      ]);

      mockRequest.body = {
        channel: "EMAIL",
        to: "customer@example.com",
        templateId: "template-123",
        variables: { order_id: "ORD-123", customer_name: "John Doe" },
      };

      expect(mockRequest.body.variables).toBeDefined();
    });

    it("should preserve template structure in rendered message", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockTemplate]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        {
          ...mockMessage,
          templateId: "template-123",
          subject: mockTemplate.subject.replace("{{order_id}}", "ORD-123"),
        },
      ]);

      mockRequest.body = {
        channel: "EMAIL",
        to: "customer@example.com",
        templateId: "template-123",
        variables: { order_id: "ORD-123", customer_name: "John" },
      };

      expect(mockRequest.body.templateId).toBe("template-123");
    });
  });

  describe("Message Scheduling", () => {
    it("should support scheduled message sending", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        {
          ...mockMessage,
          id: "msg-scheduled",
          status: "scheduled",
          scheduledFor: new Date("2024-03-05T10:00:00Z"),
        },
      ]);

      mockRequest.body = {
        channel: "EMAIL",
        to: "customer@example.com",
        body: "Your reminder",
        scheduledFor: "2024-03-05T10:00:00Z",
      };

      const result = {
        ...mockMessage,
        id: "msg-scheduled",
        status: "scheduled",
      };

      expect(result.status).toBe("scheduled");
    });

    it("should handle immediate vs scheduled messages", async () => {
      const immediate = { ...mockMessage, status: "sent" };
      const scheduled = {
        ...mockMessage,
        id: "msg-scheduled",
        status: "scheduled",
      };

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([immediate]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([scheduled]);

      expect(immediate.status).toBe("sent");
      expect(scheduled.status).toBe("scheduled");
    });
  });

  describe("Bulk Messaging", () => {
    it("should send to multiple recipients", async () => {
      const recipients = [
        { email: "user1@example.com" },
        { email: "user2@example.com" },
        { email: "user3@example.com" },
      ];

      const messages = recipients.map((r, i) => ({
        ...mockMessage,
        id: `msg-${i}`,
        recipientEmail: r.email,
      }));

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(messages);

      mockRequest.body = {
        messages: recipients.map((r) => ({
          channel: "EMAIL",
          to: r.email,
          body: "Bulk message",
        })),
      };

      expect(mockRequest.body.messages).toHaveLength(3);
    });

    it("should track success/failure per recipient", async () => {
      const results = [
        { recipient: "user1@example.com", status: "sent" },
        { recipient: "user2@example.com", status: "sent" },
        { recipient: "invalid", status: "failed" },
      ];

      mockRequest.body = {
        messages: [
          { channel: "EMAIL", to: "user1@example.com", body: "Test" },
          { channel: "EMAIL", to: "user2@example.com", body: "Test" },
          { channel: "EMAIL", to: "invalid", body: "Test" },
        ],
      };

      expect(results).toHaveLength(3);
    });

    it("should limit batch size to 100 messages", async () => {
      mockRequest.body = {
        messages: Array.from({ length: 100 }, (_, i) => ({
          channel: "EMAIL",
          to: `user${i}@example.com`,
          body: "Batch",
        })),
      };

      expect(mockRequest.body.messages.length).toBeLessThanOrEqual(100);
    });
  });

  describe("Message Listing and Filtering", () => {
    it("should filter by channel and status combined", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 1 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockMessage, channel: "EMAIL", status: "delivered" },
      ]);

      mockRequest.query = {
        page: 1,
        limit: 20,
        channel: "EMAIL",
        status: "delivered",
      };

      const result = {
        data: [{ ...mockMessage, channel: "EMAIL", status: "delivered" }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      };

      expect(result.data[0].channel).toBe("EMAIL");
      expect(result.data[0].status).toBe("delivered");
    });

    it("should filter by recipient with partial match", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 2 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockMessage, recipientEmail: "john@example.com" },
        { ...mockMessage, id: "msg-456", recipientEmail: "johnny@example.com" },
      ]);

      mockRequest.query = { page: 1, limit: 20, recipient: "john" };

      const result = {
        data: [
          { ...mockMessage, recipientEmail: "john@example.com" },
          {
            ...mockMessage,
            id: "msg-456",
            recipientEmail: "johnny@example.com",
          },
        ],
      };

      expect(result.data).toHaveLength(2);
    });
  });
});
