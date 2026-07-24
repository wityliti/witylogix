/**
 * Ticket Manager
 * Manages support tickets, messages, and feature requests
 */

import { PrismaClient } from "@witylogix/db";
import {
  SupportTicket,
  SupportMessage,
  SupportTicketWithMessages,
  FeatureRequest,
  CreateTicketRequest,
  UpdateTicketRequest,
  AddMessageRequest,
  CreateFeatureRequestRequest,
  UpdateFeatureRequestRequest,
  TicketFilterOptions,
  FeatureRequestFilterOptions,
  PaginationOptions,
  TicketListResponse,
  FeatureRequestListResponse,
  TicketStatus,
  TicketPriority,
} from "./types";

// ─── ERROR CLASSES ──────────────────────────────────────────────────

export class TicketNotFoundError extends Error {
  constructor(ticketId: string) {
    super(`Support ticket not found: ${ticketId}`);
    this.name = "TicketNotFoundError";
  }
}

export class FeatureRequestNotFoundError extends Error {
  constructor(requestId: string) {
    super(`Feature request not found: ${requestId}`);
    this.name = "FeatureRequestNotFoundError";
  }
}

export class TicketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketError";
  }
}

// ─── TICKET MANAGER ─────────────────────────────────────────────────

export class TicketManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new support ticket
   */
  async createTicket(
    shopId: string,
    userId: string,
    data: CreateTicketRequest,
  ): Promise<SupportTicket> {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        shopId,
        userId,
        subject: data.subject,
        description: data.description,
        priority: data.priority || "medium",
        category: data.category,
        tags: data.tags || [],
        status: "open",
      },
    });

    return this.mapTicket(ticket);
  }

  /**
   * Update a support ticket
   */
  async updateTicket(
    ticketId: string,
    data: UpdateTicketRequest,
  ): Promise<SupportTicket> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        subject: data.subject ?? ticket.subject,
        description: data.description ?? ticket.description,
        status: data.status ?? ticket.status,
        priority: data.priority ?? ticket.priority,
        category: data.category ?? ticket.category,
        assigneeId: data.assigneeId ?? ticket.assigneeId,
        tags: data.tags ?? ticket.tags,
      },
    });

    return this.mapTicket(updated);
  }

  /**
   * Add a message to a ticket
   */
  async addMessage(
    ticketId: string,
    userId: string,
    data: AddMessageRequest,
  ): Promise<SupportMessage> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    const message = await this.prisma.supportMessage.create({
      data: {
        ticketId,
        userId,
        content: data.content,
        isInternal: data.isInternal || false,
        attachments: JSON.parse(JSON.stringify(data.attachments || [])),
      },
    });

    return this.mapMessage(message);
  }

  /**
   * Assign ticket to a team member
   */
  async assignTicket(
    ticketId: string,
    assigneeId: string,
  ): Promise<SupportTicket> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assigneeId,
        status: "in_progress",
      },
    });

    return this.mapTicket(updated);
  }

  /**
   * Mark ticket as resolved
   */
  async resolveTicket(ticketId: string): Promise<SupportTicket> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: "resolved",
      },
    });

    return this.mapTicket(updated);
  }

  /**
   * Close a ticket
   */
  async closeTicket(ticketId: string): Promise<SupportTicket> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: "closed",
      },
    });

    return this.mapTicket(updated);
  }

  /**
   * Get ticket with messages
   */
  async getTicketWithMessages(
    ticketId: string,
  ): Promise<SupportTicketWithMessages | null> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return null;
    }

    return {
      ...this.mapTicket(ticket),
      messages: ticket.messages.map((m) => this.mapMessage(m)),
    };
  }

  /**
   * List tickets for a shop with filters
   */
  async listTickets(
    shopId: string,
    filters?: TicketFilterOptions,
    pagination?: PaginationOptions,
  ): Promise<TicketListResponse> {
    const limit = pagination?.limit || 20;
    const offset = pagination?.offset || 0;

    // Build where clause
    const where: any = { shopId };

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.priority) {
      where.priority = filters.priority;
    }
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.assigneeId) {
      where.assigneeId = filters.assigneeId;
    }
    if (filters?.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags,
      };
    }
    if (filters?.searchTerm) {
      where.OR = [
        { subject: { contains: filters.searchTerm, mode: "insensitive" } },
        { description: { contains: filters.searchTerm, mode: "insensitive" } },
      ];
    }

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      tickets: tickets.map((t) => this.mapTicket(t)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get ticket by ID
   */
  async getTicket(ticketId: string): Promise<SupportTicket | null> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    return ticket ? this.mapTicket(ticket) : null;
  }

  /**
   * Create a feature request
   */
  async createFeatureRequest(
    shopId: string,
    userId: string,
    data: CreateFeatureRequestRequest,
  ): Promise<FeatureRequest> {
    const request = await this.prisma.featureRequest.create({
      data: {
        shopId,
        userId,
        title: data.title,
        description: data.description,
        category: data.category,
        status: "submitted",
        votes: 0,
      },
    });

    return this.mapFeatureRequest(request);
  }

  /**
   * Update a feature request
   */
  async updateFeatureRequest(
    requestId: string,
    data: UpdateFeatureRequestRequest,
  ): Promise<FeatureRequest> {
    const request = await this.prisma.featureRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new FeatureRequestNotFoundError(requestId);
    }

    const updated = await this.prisma.featureRequest.update({
      where: { id: requestId },
      data: {
        title: data.title ?? request.title,
        description: data.description ?? request.description,
        status: data.status ?? request.status,
        category: data.category ?? request.category,
      },
    });

    return this.mapFeatureRequest(updated);
  }

  /**
   * Vote for a feature request (increment votes)
   */
  async voteFeatureRequest(requestId: string): Promise<FeatureRequest> {
    const request = await this.prisma.featureRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new FeatureRequestNotFoundError(requestId);
    }

    const updated = await this.prisma.featureRequest.update({
      where: { id: requestId },
      data: {
        votes: request.votes + 1,
      },
    });

    return this.mapFeatureRequest(updated);
  }

  /**
   * List feature requests for a shop with filters
   */
  async listFeatureRequests(
    shopId: string,
    filters?: FeatureRequestFilterOptions,
    pagination?: PaginationOptions,
  ): Promise<FeatureRequestListResponse> {
    const limit = pagination?.limit || 20;
    const offset = pagination?.offset || 0;

    // Build where clause
    const where: any = { shopId };

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.minVotes !== undefined) {
      where.votes = { gte: filters.minVotes };
    }
    if (filters?.searchTerm) {
      where.OR = [
        { title: { contains: filters.searchTerm, mode: "insensitive" } },
        { description: { contains: filters.searchTerm, mode: "insensitive" } },
      ];
    }

    const [requests, total] = await Promise.all([
      this.prisma.featureRequest.findMany({
        where,
        orderBy: { votes: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.featureRequest.count({ where }),
    ]);

    return {
      requests: requests.map((r) => this.mapFeatureRequest(r)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get feature request by ID
   */
  async getFeatureRequest(requestId: string): Promise<FeatureRequest | null> {
    const request = await this.prisma.featureRequest.findUnique({
      where: { id: requestId },
    });

    return request ? this.mapFeatureRequest(request) : null;
  }

  /**
   * Map Prisma ticket to type
   */
  private mapTicket(ticket: any): SupportTicket {
    return {
      id: ticket.id,
      shopId: ticket.shopId,
      userId: ticket.userId,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      assigneeId: ticket.assigneeId,
      tags: ticket.tags,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }

  /**
   * Map Prisma message to type
   */
  private mapMessage(message: any): SupportMessage {
    return {
      id: message.id,
      ticketId: message.ticketId,
      userId: message.userId,
      content: message.content,
      isInternal: message.isInternal,
      attachments: message.attachments
        ? JSON.parse(JSON.stringify(message.attachments))
        : [],
      createdAt: message.createdAt,
    };
  }

  /**
   * Map Prisma feature request to type
   */
  private mapFeatureRequest(request: any): FeatureRequest {
    return {
      id: request.id,
      shopId: request.shopId,
      userId: request.userId,
      title: request.title,
      description: request.description,
      status: request.status,
      category: request.category,
      votes: request.votes,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }
}

// Export singleton instance
export const ticketManager = (prisma: PrismaClient) =>
  new TicketManager(prisma);
