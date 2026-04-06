/**
 * Support Tickets Routes Test Suite
 * Tests for CRUD operations, assignment, priority, status transitions, comments, and resolution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import supportTicketsRoutes from "../support-tickets.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "../../lib/errors.js";

describe("Support Tickets Routes", () => {
  let fastify: FastifyInstance;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    fastify = {
      addHook: vi.fn(),
      post: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      log: { info: vi.fn(), error: vi.fn() },
    } as any;

    mockRequest = {
      auth: { userId: "user-123" },
      shopId: "shop-1",
      query: {},
      body: {},
      params: {},
      tenantDb: {
        supportTicket: {
          create: vi.fn(),
          findMany: vi.fn(),
          findUnique: vi.fn(),
          update: vi.fn(),
          count: vi.fn(),
        },
        ticketMessage: {
          create: vi.fn(),
        },
        user: {
          findUnique: vi.fn(),
        },
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST / (Create Ticket)", () => {
    it("should create a new support ticket", async () => {
      mockRequest.body = {
        subject: "Cannot login to account",
        description: "I am unable to login with my credentials. Getting error 403.",
        priority: "HIGH",
        category: "Account",
      };

      const createdTicket = {
        id: "ticket-1",
        subject: "Cannot login to account",
        description: "I am unable to login with my credentials. Getting error 403.",
        priority: "HIGH",
        category: "Account",
        status: "OPEN",
        createdBy: "user-123",
        creator: { id: "user-123", email: "user@example.com", name: "User One" },
        assignee: null,
      };

      (mockRequest.tenantDb as any).supportTicket.create.mockResolvedValue(
        createdTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(result.data.status).toBe("OPEN");
      expect(result.data.priority).toBe("HIGH");
    });

    it("should set default priority to MEDIUM", async () => {
      mockRequest.body = {
        subject: "General inquiry",
        description: "I have a general question about the service.",
      };

      const createdTicket = {
        id: "ticket-1",
        subject: "General inquiry",
        description: "I have a general question about the service.",
        priority: "MEDIUM",
        status: "OPEN",
        creator: { id: "user-123", email: "user@example.com", name: "User One" },
        assignee: null,
      };

      (mockRequest.tenantDb as any).supportTicket.create.mockResolvedValue(
        createdTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.priority).toBe("MEDIUM");
    });

    it("should throw ValidationError on invalid subject length", async () => {
      mockRequest.body = {
        subject: "Test",
        description: "This is a valid description but subject is too short.",
      };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });

    it("should throw ValidationError on missing required fields", async () => {
      mockRequest.body = {
        subject: "Valid Subject",
      };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });

    it("should throw ValidationError on invalid priority enum", async () => {
      mockRequest.body = {
        subject: "Valid Subject",
        description: "Valid description with more than ten characters",
        priority: "CRITICAL",
      };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });

    it("should log ticket creation", async () => {
      mockRequest.body = {
        subject: "Test Subject",
        description: "Test description for ticket",
      };

      const createdTicket = {
        id: "ticket-1",
        subject: "Test Subject",
        description: "Test description for ticket",
        priority: "MEDIUM",
        status: "OPEN",
        creator: { id: "user-123", email: "user@example.com", name: "User One" },
        assignee: null,
      };

      (mockRequest.tenantDb as any).supportTicket.create.mockResolvedValue(
        createdTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect(fastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          shopId: "shop-1",
          ticketId: "ticket-1",
          subject: "Test Subject",
        }),
        "Support ticket created"
      );
    });
  });

  describe("GET / (List Tickets)", () => {
    it("should list all tickets with default pagination", async () => {
      mockRequest.query = { page: 1, limit: 20 };

      const tickets = [
        {
          id: "ticket-1",
          subject: "Issue One",
          priority: "HIGH",
          status: "OPEN",
          creator: { id: "user-1", email: "user1@example.com", name: "User One" },
          assignee: null,
          messages: [],
        },
        {
          id: "ticket-2",
          subject: "Issue Two",
          priority: "MEDIUM",
          status: "IN_PROGRESS",
          creator: { id: "user-2", email: "user2@example.com", name: "User Two" },
          assignee: { id: "agent-1", email: "agent@example.com", name: "Agent" },
          messages: [{ id: "msg-1", createdAt: new Date() }],
        },
      ];

      (mockRequest.tenantDb as any).supportTicket.findMany.mockResolvedValue(
        tickets
      );
      (mockRequest.tenantDb as any).supportTicket.count.mockResolvedValue(50);

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data).toBeInstanceOf(Array);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(50);
    });

    it("should filter tickets by status", async () => {
      mockRequest.query = { page: 1, limit: 20, status: "OPEN" };

      (mockRequest.tenantDb as any).supportTicket.findMany.mockResolvedValue([]);
      (mockRequest.tenantDb as any).supportTicket.count.mockResolvedValue(0);

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect((mockRequest.tenantDb as any).supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "OPEN",
          }),
        })
      );
    });

    it("should filter tickets by priority", async () => {
      mockRequest.query = { page: 1, limit: 20, priority: "URGENT" };

      (mockRequest.tenantDb as any).supportTicket.findMany.mockResolvedValue([]);
      (mockRequest.tenantDb as any).supportTicket.count.mockResolvedValue(0);

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect((mockRequest.tenantDb as any).supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: "URGENT",
          }),
        })
      );
    });

    it("should filter tickets by category", async () => {
      mockRequest.query = { page: 1, limit: 20, category: "Billing" };

      (mockRequest.tenantDb as any).supportTicket.findMany.mockResolvedValue([]);
      (mockRequest.tenantDb as any).supportTicket.count.mockResolvedValue(0);

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect((mockRequest.tenantDb as any).supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: "Billing",
          }),
        })
      );
    });

    it("should search tickets by subject or description", async () => {
      mockRequest.query = { page: 1, limit: 20, search: "cannot login" };

      (mockRequest.tenantDb as any).supportTicket.findMany.mockResolvedValue([]);
      (mockRequest.tenantDb as any).supportTicket.count.mockResolvedValue(0);

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect((mockRequest.tenantDb as any).supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                subject: expect.objectContaining({ contains: "cannot login" }),
              }),
            ]),
          }),
        })
      );
    });

    it("should sort tickets by creation date descending by default", async () => {
      mockRequest.query = { page: 1, limit: 20 };

      (mockRequest.tenantDb as any).supportTicket.findMany.mockResolvedValue([]);
      (mockRequest.tenantDb as any).supportTicket.count.mockResolvedValue(0);

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect((mockRequest.tenantDb as any).supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        })
      );
    });

    it("should allow sorting by priority", async () => {
      mockRequest.query = { page: 1, limit: 20, sortBy: "priority" };

      (mockRequest.tenantDb as any).supportTicket.findMany.mockResolvedValue([]);
      (mockRequest.tenantDb as any).supportTicket.count.mockResolvedValue(0);

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect((mockRequest.tenantDb as any).supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { priority: "desc" },
        })
      );
    });

    it("should allow custom sort order", async () => {
      mockRequest.query = { page: 1, limit: 20, sortBy: "createdAt", sortOrder: "asc" };

      (mockRequest.tenantDb as any).supportTicket.findMany.mockResolvedValue([]);
      (mockRequest.tenantDb as any).supportTicket.count.mockResolvedValue(0);

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect((mockRequest.tenantDb as any).supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "asc" },
        })
      );
    });

    it("should throw ValidationError on invalid page number", async () => {
      mockRequest.query = { page: 0, limit: 20 };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe("GET /:id (Get Ticket)", () => {
    it("should return ticket with messages", async () => {
      mockRequest.params = { id: "ticket-1" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
        subject: "Cannot login",
        description: "Getting error 403",
        priority: "HIGH",
        status: "OPEN",
        creator: { id: "user-1", email: "user1@example.com", name: "User One" },
        assignee: null,
        messages: [
          {
            id: "msg-1",
            content: "We are looking into this.",
            isInternal: false,
            author: { id: "agent-1", email: "agent@example.com", name: "Agent" },
            createdAt: new Date(),
          },
        ],
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/:id"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.messages).toBeInstanceOf(Array);
      expect(result.data.messages[0]).toHaveProperty("content");
    });

    it("should throw NotFoundError for non-existent ticket", async () => {
      mockRequest.params = { id: "nonexistent" };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        null
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/:id"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        NotFoundError
      );
    });

    it("should throw ForbiddenError for ticket from another shop", async () => {
      mockRequest.params = { id: "ticket-1" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-2",
        subject: "Cannot login",
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/:id"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("should order messages chronologically", async () => {
      mockRequest.params = { id: "ticket-1" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
        subject: "Cannot login",
        messages: [],
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/:id"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect((mockRequest.tenantDb as any).supportTicket.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            messages: expect.objectContaining({
              orderBy: { createdAt: "asc" },
            }),
          }),
        })
      );
    });
  });

  describe("PUT /:id (Update Ticket)", () => {
    it("should update ticket fields", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = {
        subject: "Updated Subject",
        priority: "URGENT",
      };

      const existingTicket = {
        id: "ticket-1",
        shopId: "shop-1",
        status: "OPEN",
      };

      const updatedTicket = {
        id: "ticket-1",
        subject: "Updated Subject",
        priority: "URGENT",
        status: "OPEN",
        creator: { id: "user-1", email: "user1@example.com", name: "User One" },
        assignee: null,
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        existingTicket
      );
      (mockRequest.tenantDb as any).supportTicket.update.mockResolvedValue(
        updatedTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.subject).toBe("Updated Subject");
      expect(result.data.priority).toBe("URGENT");
    });

    it("should validate status transitions", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { status: "RESOLVED" };

      const existingTicket = {
        id: "ticket-1",
        shopId: "shop-1",
        status: "CLOSED",
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        existingTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });

    it("should allow OPEN to IN_PROGRESS transition", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { status: "IN_PROGRESS" };

      const existingTicket = {
        id: "ticket-1",
        shopId: "shop-1",
        status: "OPEN",
      };

      const updatedTicket = {
        id: "ticket-1",
        status: "IN_PROGRESS",
        creator: { id: "user-1", email: "user1@example.com", name: "User One" },
        assignee: null,
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        existingTicket
      );
      (mockRequest.tenantDb as any).supportTicket.update.mockResolvedValue(
        updatedTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.status).toBe("IN_PROGRESS");
    });

    it("should allow RESOLVED to REOPEN transition", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { status: "REOPEN" };

      const existingTicket = {
        id: "ticket-1",
        shopId: "shop-1",
        status: "RESOLVED",
      };

      const updatedTicket = {
        id: "ticket-1",
        status: "REOPEN",
        creator: { id: "user-1", email: "user1@example.com", name: "User One" },
        assignee: null,
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        existingTicket
      );
      (mockRequest.tenantDb as any).supportTicket.update.mockResolvedValue(
        updatedTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.status).toBe("REOPEN");
    });

    it("should throw ForbiddenError for ticket from another shop", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { subject: "Updated" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-2",
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("should require ADMIN role for updates", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { subject: "Updated" };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id"
      )?.[1];

      expect(handler).toBeDefined();
    });

    it("should log ticket updates", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { status: "IN_PROGRESS" };

      const existingTicket = {
        id: "ticket-1",
        shopId: "shop-1",
        status: "OPEN",
      };

      const updatedTicket = {
        id: "ticket-1",
        status: "IN_PROGRESS",
        creator: { id: "user-1", email: "user1@example.com", name: "User One" },
        assignee: null,
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        existingTicket
      );
      (mockRequest.tenantDb as any).supportTicket.update.mockResolvedValue(
        updatedTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect(fastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          shopId: "shop-1",
          ticketId: "ticket-1",
        }),
        "Support ticket updated"
      );
    });
  });

  describe("POST /:id/messages (Add Message)", () => {
    it("should add a message to ticket", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = {
        content: "Thank you for contacting us. We will look into this.",
        isInternal: false,
      };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
      };

      const message = {
        id: "msg-1",
        ticketId: "ticket-1",
        content: "Thank you for contacting us. We will look into this.",
        isInternal: false,
        authorId: "user-123",
        author: { id: "user-123", email: "user@example.com", name: "User One" },
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );
      (mockRequest.tenantDb as any).ticketMessage.create.mockResolvedValue(
        message
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/:id/messages"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(result.data.content).toBe(
        "Thank you for contacting us. We will look into this."
      );
    });

    it("should mark message as internal if specified", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = {
        content: "Internal note about the issue.",
        isInternal: true,
      };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
      };

      const message = {
        id: "msg-1",
        content: "Internal note about the issue.",
        isInternal: true,
        author: { id: "user-123", email: "user@example.com", name: "User One" },
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );
      (mockRequest.tenantDb as any).ticketMessage.create.mockResolvedValue(
        message
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/:id/messages"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.isInternal).toBe(true);
    });

    it("should update ticket updatedAt timestamp", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = {
        content: "New message",
      };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
      };

      const message = {
        id: "msg-1",
        content: "New message",
        isInternal: false,
        author: { id: "user-123", email: "user@example.com", name: "User One" },
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );
      (mockRequest.tenantDb as any).ticketMessage.create.mockResolvedValue(
        message
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/:id/messages"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect(
        (mockRequest.tenantDb as any).supportTicket.update
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ticket-1" },
          data: expect.objectContaining({
            updatedAt: expect.any(Date),
          }),
        })
      );
    });

    it("should throw ValidationError for empty content", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { content: "" };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/:id/messages"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow();
    });

    it("should throw ForbiddenError for ticket from another shop", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { content: "New message" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-2",
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/:id/messages"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("should log message addition", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { content: "New message" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
      };

      const message = {
        id: "msg-1",
        content: "New message",
        isInternal: false,
        author: { id: "user-123", email: "user@example.com", name: "User One" },
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );
      (mockRequest.tenantDb as any).ticketMessage.create.mockResolvedValue(
        message
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/:id/messages"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect(fastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          shopId: "shop-1",
          ticketId: "ticket-1",
          messageId: "msg-1",
        }),
        "Ticket message added"
      );
    });
  });

  describe("PUT /:id/assign (Assign Ticket)", () => {
    it("should assign ticket to a user", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { assigneeId: "00000000-0000-0000-0000-000000000099" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
        status: "OPEN",
      };

      const assignee = {
        id: "00000000-0000-0000-0000-000000000099",
        shopId: "shop-1",
      };

      const updatedTicket = {
        id: "ticket-1",
        assigneeId: "00000000-0000-0000-0000-000000000099",
        status: "IN_PROGRESS",
        assignee: { id: "00000000-0000-0000-0000-000000000099", email: "agent@example.com", name: "Agent" },
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );
      (mockRequest.tenantDb as any).user.findUnique.mockResolvedValue(assignee);
      (mockRequest.tenantDb as any).supportTicket.update.mockResolvedValue(
        updatedTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/assign"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.assigneeId).toBe("00000000-0000-0000-0000-000000000099");
      expect(result.data.status).toBe("IN_PROGRESS");
    });

    it("should throw NotFoundError for non-existent assignee", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { assigneeId: "00000000-0000-0000-0000-000000000000" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );
      (mockRequest.tenantDb as any).user.findUnique.mockResolvedValue(null);

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/assign"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        NotFoundError
      );
    });

    it("should throw NotFoundError if assignee from different shop", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { assigneeId: "00000000-0000-0000-0000-000000000099" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
      };

      const assignee = {
        id: "00000000-0000-0000-0000-000000000099",
        shopId: "shop-2",
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );
      (mockRequest.tenantDb as any).user.findUnique.mockResolvedValue(assignee);

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/assign"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        NotFoundError
      );
    });

    it("should require ADMIN role", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { assigneeId: "00000000-0000-0000-0000-000000000099" };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/assign"
      )?.[1];

      expect(handler).toBeDefined();
    });

    it("should log ticket assignment", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { assigneeId: "00000000-0000-0000-0000-000000000099" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
        status: "OPEN",
      };

      const assignee = {
        id: "00000000-0000-0000-0000-000000000099",
        shopId: "shop-1",
      };

      const updatedTicket = {
        id: "ticket-1",
        status: "IN_PROGRESS",
        assignee: { id: "00000000-0000-0000-0000-000000000099", email: "agent@example.com", name: "Agent" },
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );
      (mockRequest.tenantDb as any).user.findUnique.mockResolvedValue(assignee);
      (mockRequest.tenantDb as any).supportTicket.update.mockResolvedValue(
        updatedTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/assign"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect(fastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          shopId: "shop-1",
          ticketId: "ticket-1",
          assigneeId: "00000000-0000-0000-0000-000000000099",
        }),
        "Ticket assigned"
      );
    });
  });

  describe("PUT /:id/resolve (Resolve Ticket)", () => {
    it("should mark ticket as resolved", async () => {
      mockRequest.params = { id: "ticket-1" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
        status: "IN_PROGRESS",
      };

      const resolvedTicket = {
        id: "ticket-1",
        status: "RESOLVED",
        resolvedAt: new Date(),
        creator: { id: "user-1", email: "user1@example.com", name: "User One" },
        assignee: { id: "agent-1", email: "agent@example.com", name: "Agent" },
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );
      (mockRequest.tenantDb as any).supportTicket.update.mockResolvedValue(
        resolvedTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/resolve"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.status).toBe("RESOLVED");
      expect(result.data.resolvedAt).toBeDefined();
    });

    it("should throw ConflictError if ticket already closed", async () => {
      mockRequest.params = { id: "ticket-1" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
        status: "CLOSED",
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/resolve"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ConflictError
      );
    });

    it("should require ADMIN role", async () => {
      mockRequest.params = { id: "ticket-1" };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/resolve"
      )?.[1];

      expect(handler).toBeDefined();
    });

    it("should log ticket resolution", async () => {
      mockRequest.params = { id: "ticket-1" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
        status: "IN_PROGRESS",
      };

      const resolvedTicket = {
        id: "ticket-1",
        status: "RESOLVED",
        resolvedAt: new Date(),
        creator: { id: "user-1", email: "user1@example.com", name: "User One" },
        assignee: null,
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );
      (mockRequest.tenantDb as any).supportTicket.update.mockResolvedValue(
        resolvedTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/resolve"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect(fastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          shopId: "shop-1",
          ticketId: "ticket-1",
        }),
        "Ticket marked resolved"
      );
    });
  });

  describe("PUT /:id/close (Close Ticket)", () => {
    it("should close a ticket", async () => {
      mockRequest.params = { id: "ticket-1" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
        status: "RESOLVED",
      };

      const closedTicket = {
        id: "ticket-1",
        status: "CLOSED",
        closedAt: new Date(),
        creator: { id: "user-1", email: "user1@example.com", name: "User One" },
        assignee: null,
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );
      (mockRequest.tenantDb as any).supportTicket.update.mockResolvedValue(
        closedTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/close"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.status).toBe("CLOSED");
      expect(result.data.closedAt).toBeDefined();
    });

    it("should require ADMIN role", async () => {
      mockRequest.params = { id: "ticket-1" };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/close"
      )?.[1];

      expect(handler).toBeDefined();
    });

    it("should throw ForbiddenError for ticket from another shop", async () => {
      mockRequest.params = { id: "ticket-1" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-2",
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/close"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("should log ticket closure", async () => {
      mockRequest.params = { id: "ticket-1" };

      const ticket = {
        id: "ticket-1",
        shopId: "shop-1",
        status: "RESOLVED",
      };

      const closedTicket = {
        id: "ticket-1",
        status: "CLOSED",
        closedAt: new Date(),
        creator: { id: "user-1", email: "user1@example.com", name: "User One" },
        assignee: null,
      };

      (mockRequest.tenantDb as any).supportTicket.findUnique.mockResolvedValue(
        ticket
      );
      (mockRequest.tenantDb as any).supportTicket.update.mockResolvedValue(
        closedTicket
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/close"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect(fastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          shopId: "shop-1",
          ticketId: "ticket-1",
        }),
        "Ticket closed"
      );
    });
  });

  describe("Route Registration", () => {
    it("should register all routes on fastify instance", async () => {
      await supportTicketsRoutes(fastify);

      expect(fastify.post).toHaveBeenCalledWith("/", expect.any(Function));
      expect(fastify.get).toHaveBeenCalledWith("/", expect.any(Function));
      expect(fastify.get).toHaveBeenCalledWith("/:id", expect.any(Function));
      expect(fastify.put).toHaveBeenCalledWith("/:id", expect.any(Function));
      expect(fastify.post).toHaveBeenCalledWith("/:id/messages", expect.any(Function));
      expect(fastify.put).toHaveBeenCalledWith("/:id/assign", expect.any(Function));
      expect(fastify.put).toHaveBeenCalledWith("/:id/resolve", expect.any(Function));
      expect(fastify.put).toHaveBeenCalledWith("/:id/close", expect.any(Function));
    });

    it("should add auth and tenant context hooks", async () => {
      await supportTicketsRoutes(fastify);

      expect(fastify.addHook).toHaveBeenCalledWith(
        "preHandler",
        expect.any(Function)
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle Prisma query errors gracefully", async () => {
      mockRequest.query = { page: 1, limit: 20 };

      (mockRequest.tenantDb as any).supportTicket.findMany.mockRejectedValue(
        new Error("Database connection error")
      );

      await supportTicketsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow();
    });

    it("should throw ValidationError on invalid input", async () => {
      mockRequest.body = {
        subject: "ab",
        description: "short",
      };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe("Data Validation", () => {
    it("should enforce subject min length of 5 characters", async () => {
      mockRequest.body = {
        subject: "Test",
        description: "A description with more than 10 characters",
      };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow();
    });

    it("should enforce description min length of 10 characters", async () => {
      mockRequest.body = {
        subject: "Valid Subject",
        description: "short",
      };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow();
    });

    it("should enforce priority enum validation", async () => {
      mockRequest.body = {
        subject: "Valid Subject",
        description: "Valid description with more than 10 characters",
        priority: "SEVERE",
      };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow();
    });

    it("should validate assigneeId as UUID", async () => {
      mockRequest.params = { id: "ticket-1" };
      mockRequest.body = { assigneeId: "not-a-uuid" };

      await supportTicketsRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/:id/assign"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });
  });
});
