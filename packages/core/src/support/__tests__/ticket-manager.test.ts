/**
 * Ticket Manager Tests
 * Comprehensive test suite for support ticket management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TicketManager,
  TicketNotFoundError,
  FeatureRequestNotFoundError,
  TicketError,
} from '../ticket-manager';

describe('TicketManager', () => {
  let manager: TicketManager;
  let prisma: any;

  beforeEach(() => {
    // Mock Prisma client
    prisma = {
      supportTicket: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      supportMessage: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      featureRequest: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    manager = new TicketManager(prisma);
  });

  describe('createTicket', () => {
    it('should create ticket with default values', async () => {
      const mockTicket: any = {
        id: 'ticket-1',
        shopId: 'shop-1',
        userId: 'user-1',
        subject: 'Bug Report',
        description: 'Something is broken',
        priority: 'medium',
        status: 'open',
        category: 'bug',
        tags: [],
        assigneeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.supportTicket.create.mockResolvedValue(mockTicket);

      const result = await manager.createTicket('shop-1', 'user-1', {
        subject: 'Bug Report',
        description: 'Something is broken',
        category: 'bug',
      });

      expect(result.id).toBe('ticket-1');
      expect(result.status).toBe('open');
      expect(result.priority).toBe('medium');
      expect(prisma.supportTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shopId: 'shop-1',
            userId: 'user-1',
            status: 'open',
            priority: 'medium',
          }),
        })
      );
    });

    it('should create ticket with custom priority', async () => {
      const mockTicket: any = {
        id: 'ticket-1',
        priority: 'high',
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.supportTicket.create.mockResolvedValue(mockTicket);

      const result = await manager.createTicket('shop-1', 'user-1', {
        subject: 'Critical Issue',
        description: 'System down',
        priority: 'high',
        category: 'urgent',
      });

      expect(result.priority).toBe('high');
    });

    it('should create ticket with tags', async () => {
      const mockTicket: any = {
        id: 'ticket-1',
        tags: ['urgent', 'bug'],
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.supportTicket.create.mockResolvedValue(mockTicket);

      const result = await manager.createTicket('shop-1', 'user-1', {
        subject: 'Issue',
        description: 'Description',
        tags: ['urgent', 'bug'],
      });

      expect(result.tags).toContain('urgent');
      expect(result.tags).toContain('bug');
    });
  });

  describe('updateTicket', () => {
    it('should update ticket fields', async () => {
      const originalTicket: any = {
        id: 'ticket-1',
        subject: 'Old Subject',
        priority: 'low',
        status: 'open',
      };

      const updatedTicket: any = {
        ...originalTicket,
        subject: 'New Subject',
        priority: 'high',
      };

      prisma.supportTicket.findUnique.mockResolvedValue(originalTicket);
      prisma.supportTicket.update.mockResolvedValue(updatedTicket);

      const result = await manager.updateTicket('ticket-1', {
        subject: 'New Subject',
        priority: 'high',
      });

      expect(result.subject).toBe('New Subject');
      expect(result.priority).toBe('high');
    });

    it('should throw TicketNotFoundError when updating non-existent ticket', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(null);

      await expect(
        manager.updateTicket('invalid-ticket', { subject: 'Test' })
      ).rejects.toThrow(TicketNotFoundError);
    });
  });

  describe('addMessage', () => {
    it('should add public message', async () => {
      const mockTicket: any = { id: 'ticket-1' };
      const mockMessage: any = {
        id: 'msg-1',
        ticketId: 'ticket-1',
        userId: 'user-1',
        content: 'This is a public message',
        isInternal: false,
        attachments: [],
        createdAt: new Date(),
      };

      prisma.supportTicket.findUnique.mockResolvedValue(mockTicket);
      prisma.supportMessage.create.mockResolvedValue(mockMessage);

      const result = await manager.addMessage('ticket-1', 'user-1', {
        content: 'This is a public message',
      });

      expect(result.isInternal).toBe(false);
      expect(result.content).toBe('This is a public message');
    });

    it('should add internal message', async () => {
      const mockTicket: any = { id: 'ticket-1' };
      const mockMessage: any = {
        id: 'msg-1',
        ticketId: 'ticket-1',
        userId: 'user-1',
        content: 'Internal note for team',
        isInternal: true,
        attachments: [],
        createdAt: new Date(),
      };

      prisma.supportTicket.findUnique.mockResolvedValue(mockTicket);
      prisma.supportMessage.create.mockResolvedValue(mockMessage);

      const result = await manager.addMessage('ticket-1', 'user-1', {
        content: 'Internal note for team',
        isInternal: true,
      });

      expect(result.isInternal).toBe(true);
    });

    it('should throw TicketNotFoundError when adding message to non-existent ticket', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(null);

      await expect(
        manager.addMessage('invalid-ticket', 'user-1', { content: 'Test' })
      ).rejects.toThrow(TicketNotFoundError);
    });
  });

  describe('assignTicket', () => {
    it('should assign ticket and set status to in_progress', async () => {
      const mockTicket: any = {
        id: 'ticket-1',
        status: 'open',
        assigneeId: null,
      };

      const updatedTicket: any = {
        ...mockTicket,
        status: 'in_progress',
        assigneeId: 'user-2',
      };

      prisma.supportTicket.findUnique.mockResolvedValue(mockTicket);
      prisma.supportTicket.update.mockResolvedValue(updatedTicket);

      const result = await manager.assignTicket('ticket-1', 'user-2');

      expect(result.assigneeId).toBe('user-2');
      expect(result.status).toBe('in_progress');
      expect(prisma.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            assigneeId: 'user-2',
            status: 'in_progress',
          },
        })
      );
    });

    it('should throw TicketNotFoundError when assigning non-existent ticket', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(null);

      await expect(manager.assignTicket('invalid-ticket', 'user-1')).rejects.toThrow(
        TicketNotFoundError
      );
    });
  });

  describe('resolveTicket', () => {
    it('should mark ticket as resolved', async () => {
      const mockTicket: any = {
        id: 'ticket-1',
        status: 'in_progress',
      };

      const resolvedTicket: any = {
        ...mockTicket,
        status: 'resolved',
      };

      prisma.supportTicket.findUnique.mockResolvedValue(mockTicket);
      prisma.supportTicket.update.mockResolvedValue(resolvedTicket);

      const result = await manager.resolveTicket('ticket-1');

      expect(result.status).toBe('resolved');
    });

    it('should throw TicketNotFoundError when resolving non-existent ticket', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(null);

      await expect(manager.resolveTicket('invalid-ticket')).rejects.toThrow(
        TicketNotFoundError
      );
    });
  });

  describe('closeTicket', () => {
    it('should close ticket', async () => {
      const mockTicket: any = {
        id: 'ticket-1',
        status: 'resolved',
      };

      const closedTicket: any = {
        ...mockTicket,
        status: 'closed',
      };

      prisma.supportTicket.findUnique.mockResolvedValue(mockTicket);
      prisma.supportTicket.update.mockResolvedValue(closedTicket);

      const result = await manager.closeTicket('ticket-1');

      expect(result.status).toBe('closed');
    });

    it('should throw TicketNotFoundError when closing non-existent ticket', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(null);

      await expect(manager.closeTicket('invalid-ticket')).rejects.toThrow(
        TicketNotFoundError
      );
    });
  });

  describe('listTickets', () => {
    it('should list tickets with status filter', async () => {
      const mockTickets: any = [
        { id: 'ticket-1', status: 'open', priority: 'high' },
        { id: 'ticket-2', status: 'open', priority: 'medium' },
      ];

      prisma.supportTicket.findMany.mockResolvedValue(mockTickets);
      prisma.supportTicket.count.mockResolvedValue(2);

      const result = await manager.listTickets('shop-1', { status: 'open' });

      expect(result.tickets).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            shopId: 'shop-1',
            status: 'open',
          }),
        })
      );
    });

    it('should list tickets with priority filter', async () => {
      const mockTickets: any = [{ id: 'ticket-1', priority: 'high' }];

      prisma.supportTicket.findMany.mockResolvedValue(mockTickets);
      prisma.supportTicket.count.mockResolvedValue(1);

      const result = await manager.listTickets('shop-1', { priority: 'high' });

      expect(result.tickets).toHaveLength(1);
      expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: 'high',
          }),
        })
      );
    });

    it('should list tickets with multiple filters', async () => {
      const mockTickets: any = [];

      prisma.supportTicket.findMany.mockResolvedValue(mockTickets);
      prisma.supportTicket.count.mockResolvedValue(0);

      await manager.listTickets('shop-1', {
        status: 'open',
        priority: 'high',
        category: 'bug',
      });

      expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'open',
            priority: 'high',
            category: 'bug',
          }),
        })
      );
    });

    it('should use default pagination', async () => {
      prisma.supportTicket.findMany.mockResolvedValue([]);
      prisma.supportTicket.count.mockResolvedValue(0);

      await manager.listTickets('shop-1');

      expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 0,
        })
      );
    });
  });

  describe('createFeatureRequest', () => {
    it('should create feature request', async () => {
      const mockRequest: any = {
        id: 'fr-1',
        shopId: 'shop-1',
        userId: 'user-1',
        title: 'Dark Mode',
        description: 'Add dark mode support',
        category: 'ui',
        status: 'submitted',
        votes: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.featureRequest.create.mockResolvedValue(mockRequest);

      const result = await manager.createFeatureRequest('shop-1', 'user-1', {
        title: 'Dark Mode',
        description: 'Add dark mode support',
        category: 'ui',
      });

      expect(result.id).toBe('fr-1');
      expect(result.status).toBe('submitted');
      expect(result.votes).toBe(0);
    });
  });

  describe('voteFeatureRequest', () => {
    it('should vote on feature request', async () => {
      const mockRequest: any = {
        id: 'fr-1',
        votes: 5,
      };

      const updatedRequest: any = {
        ...mockRequest,
        votes: 6,
      };

      prisma.featureRequest.findUnique.mockResolvedValue(mockRequest);
      prisma.featureRequest.update.mockResolvedValue(updatedRequest);

      const result = await manager.voteFeatureRequest('fr-1');

      expect(result.votes).toBe(6);
      expect(prisma.featureRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { votes: 6 },
        })
      );
    });

    it('should throw FeatureRequestNotFoundError when voting non-existent request', async () => {
      prisma.featureRequest.findUnique.mockResolvedValue(null);

      await expect(manager.voteFeatureRequest('invalid-request')).rejects.toThrow(
        FeatureRequestNotFoundError
      );
    });
  });

  describe('listFeatureRequests', () => {
    it('should list feature requests sorted by votes', async () => {
      const mockRequests: any = [
        { id: 'fr-1', title: 'Feature 1', votes: 10 },
        { id: 'fr-2', title: 'Feature 2', votes: 5 },
      ];

      prisma.featureRequest.findMany.mockResolvedValue(mockRequests);
      prisma.featureRequest.count.mockResolvedValue(2);

      const result = await manager.listFeatureRequests('shop-1');

      expect(result.requests).toHaveLength(2);
      expect(result.requests[0].votes).toBe(10);
      expect(result.requests[1].votes).toBe(5);
      expect(prisma.featureRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { votes: 'desc' },
        })
      );
    });

    it('should filter by status', async () => {
      const mockRequests: any = [
        { id: 'fr-1', status: 'submitted', votes: 5 },
      ];

      prisma.featureRequest.findMany.mockResolvedValue(mockRequests);
      prisma.featureRequest.count.mockResolvedValue(1);

      await manager.listFeatureRequests('shop-1', { status: 'submitted' });

      expect(prisma.featureRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'submitted',
          }),
        })
      );
    });

    it('should filter by minimum votes', async () => {
      const mockRequests: any = [
        { id: 'fr-1', votes: 10 },
        { id: 'fr-2', votes: 20 },
      ];

      prisma.featureRequest.findMany.mockResolvedValue(mockRequests);
      prisma.featureRequest.count.mockResolvedValue(2);

      await manager.listFeatureRequests('shop-1', { minVotes: 5 });

      expect(prisma.featureRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            votes: { gte: 5 },
          }),
        })
      );
    });
  });

  describe('getTicketWithMessages', () => {
    it('should get ticket with messages', async () => {
      const mockTicket: any = {
        id: 'ticket-1',
        subject: 'Test Ticket',
        messages: [
          { id: 'msg-1', content: 'First message' },
          { id: 'msg-2', content: 'Second message' },
        ],
      };

      prisma.supportTicket.findUnique.mockResolvedValue(mockTicket);

      const result = await manager.getTicketWithMessages('ticket-1');

      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(2);
      expect(result?.messages[0].content).toBe('First message');
    });

    it('should return null when ticket not found', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(null);

      const result = await manager.getTicketWithMessages('invalid-ticket');

      expect(result).toBeNull();
    });
  });

  describe('getTicket', () => {
    it('should get ticket by ID', async () => {
      const mockTicket: any = {
        id: 'ticket-1',
        subject: 'Test',
        status: 'open',
      };

      prisma.supportTicket.findUnique.mockResolvedValue(mockTicket);

      const result = await manager.getTicket('ticket-1');

      expect(result).toEqual(mockTicket);
    });

    it('should return null when not found', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(null);

      const result = await manager.getTicket('invalid-ticket');

      expect(result).toBeNull();
    });
  });

  describe('getFeatureRequest', () => {
    it('should get feature request by ID', async () => {
      const mockRequest: any = {
        id: 'fr-1',
        title: 'Feature',
        votes: 5,
      };

      prisma.featureRequest.findUnique.mockResolvedValue(mockRequest);

      const result = await manager.getFeatureRequest('fr-1');

      expect(result).toEqual(mockRequest);
    });

    it('should return null when not found', async () => {
      prisma.featureRequest.findUnique.mockResolvedValue(null);

      const result = await manager.getFeatureRequest('invalid-request');

      expect(result).toBeNull();
    });
  });
});
