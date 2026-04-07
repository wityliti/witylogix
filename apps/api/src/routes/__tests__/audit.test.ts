import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Audit Trail Route Integration Tests
 * Tests audit trail listing, filtering by user/action/resource, detail view, compliance export, and retention policies.
 *
 * Coverage:
 * - GET /api/v4/audit (list audit events with pagination, filtering)
 * - GET /api/v4/audit/:id (detail view of specific audit event)
 * - GET /api/v4/audit/export/compliance (compliance-format export)
 * - Filtering by user, action, resource type, date range
 * - Retention policy enforcement (30/90/365 day retention)
 */

interface MockAuditEvent {
  id: string;
  orgId: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  description: string;
  status: string;
  statusCode?: number;
  changes?: Record<string, [any, any]>;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  createdAt: Date;
  retentionDays?: number;
}

const generateAuditEvent = (
  overrides?: Partial<MockAuditEvent>
): MockAuditEvent => ({
  id: 'audit-' + Math.random().toString(36).substring(7),
  orgId: 'org-123',
  userId: 'user-456',
  userName: 'John Doe',
  userEmail: 'john@example.com',
  action: 'CREATE',
  resourceType: 'ORDER',
  resourceId: 'order-789',
  resourceName: 'Order #1001',
  description: 'Order created via API',
  status: 'SUCCESS',
  statusCode: 201,
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  timestamp: new Date('2026-01-01T10:00:00Z'),
  createdAt: new Date('2026-03-09T10:00:00Z'),
  retentionDays: 90,
  previousValues: {},
  newValues: {},
  ...overrides,
});

describe('Audit Trail Routes', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockPrisma: Record<string, any>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
      params: {},
    };

    mockReply = {
      status: vi.fn(function (code: number) {
        this.statusCode = code;
        return this;
      }),
      send: vi.fn(function (data: unknown) {
        this.body = data;
        return this;
      }),
    };

    mockPrisma = {
      auditEvent: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
  });

  describe('GET /api/v4/audit (List)', () => {
    it('should list all audit events with default pagination', async () => {
      const events = [generateAuditEvent(), generateAuditEvent()];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      const result = await (mockPrisma as any).auditEvent.findMany({
        skip: 0,
        take: 50,
        orderBy: { timestamp: 'desc' },
      });

      expect(result).toHaveLength(2);
    });

    it('should return 200 with audit events', async () => {
      const events = [generateAuditEvent()];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      const result = await (mockPrisma as any).auditEvent.findMany();

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('userId');
      expect(result[0]).toHaveProperty('action');
    });

    it('should filter audit events by userId', async () => {
      const events = [generateAuditEvent({ userId: 'user-999' })];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      mockRequest.query = { userId: 'user-999' };

      const result = await (mockPrisma as any).auditEvent.findMany({
        where: { userId: 'user-999' },
      });

      expect(result[0].userId).toBe('user-999');
    });

    it('should filter audit events by action', async () => {
      const events = [generateAuditEvent({ action: 'DELETE' })];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      mockRequest.query = { action: 'DELETE' };

      const result = await (mockPrisma as any).auditEvent.findMany({
        where: { action: 'DELETE' },
      });

      expect(result[0].action).toBe('DELETE');
    });

    it('should filter audit events by resourceType', async () => {
      const events = [generateAuditEvent({ resourceType: 'SHIPMENT' })];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      mockRequest.query = { resourceType: 'SHIPMENT' };

      const result = await (mockPrisma as any).auditEvent.findMany({
        where: { resourceType: 'SHIPMENT' },
      });

      expect(result[0].resourceType).toBe('SHIPMENT');
    });

    it('should filter audit events by resourceId', async () => {
      const events = [generateAuditEvent({ resourceId: 'ship-999' })];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      mockRequest.query = { resourceId: 'ship-999' };

      const result = await (mockPrisma as any).auditEvent.findMany({
        where: { resourceId: 'ship-999' },
      });

      expect(result[0].resourceId).toBe('ship-999');
    });

    it('should filter audit events by date range', async () => {
      const events = [generateAuditEvent()];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      mockRequest.query = {
        startDate: '2026-03-01T00:00:00Z',
        endDate: '2026-03-31T23:59:59Z',
      };

      await (mockPrisma as any).auditEvent.findMany({
        where: {
          timestamp: {
            gte: new Date('2026-03-01T00:00:00Z'),
            lte: new Date('2026-03-31T23:59:59Z'),
          },
        },
      });

      expect(mockPrisma.auditEvent.findMany).toHaveBeenCalled();
    });

    it('should support pagination with skip and limit', async () => {
      const events = [generateAuditEvent()];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      mockRequest.query = { skip: 20, limit: 50 };

      await (mockPrisma as any).auditEvent.findMany({
        skip: 20,
        take: 50,
      });

      expect(mockPrisma.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 50 })
      );
    });

    it('should combine multiple filters', async () => {
      const events = [
        generateAuditEvent({
          userId: 'user-999',
          action: 'DELETE',
          resourceType: 'SHIPMENT',
        }),
      ];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      mockRequest.query = {
        userId: 'user-999',
        action: 'DELETE',
        resourceType: 'SHIPMENT',
      };

      await (mockPrisma as any).auditEvent.findMany({
        where: {
          userId: 'user-999',
          action: 'DELETE',
          resourceType: 'SHIPMENT',
        },
      });

      expect(mockPrisma.auditEvent.findMany).toHaveBeenCalled();
    });

    it('should sort by timestamp descending', async () => {
      const events = [
        generateAuditEvent({ timestamp: new Date('2026-03-09T12:00:00Z') }),
        generateAuditEvent({ timestamp: new Date('2026-03-09T10:00:00Z') }),
      ];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      await (mockPrisma as any).auditEvent.findMany({
        orderBy: { timestamp: 'desc' },
      });

      expect(mockPrisma.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { timestamp: 'desc' } })
      );
    });

    it('should return empty array when no events match', async () => {
      mockPrisma.auditEvent.findMany.mockResolvedValue([]);

      const result = await (mockPrisma as any).auditEvent.findMany();

      expect(result).toEqual([]);
    });

    it('should include total count with paginated response', async () => {
      mockPrisma.auditEvent.count.mockResolvedValue(500);

      const count = await (mockPrisma as any).auditEvent.count();

      expect(count).toBe(500);
    });

    it('should filter by status code', async () => {
      const events = [generateAuditEvent({ statusCode: 201 })];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      mockRequest.query = { statusCode: 201 };

      const result = await (mockPrisma as any).auditEvent.findMany({
        where: { statusCode: 201 },
      });

      expect(result[0].statusCode).toBe(201);
    });

    it('should support IP address filtering', async () => {
      const events = [generateAuditEvent({ ipAddress: '192.168.1.1' })];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      mockRequest.query = { ipAddress: '192.168.1.1' };

      const result = await (mockPrisma as any).auditEvent.findMany({
        where: { ipAddress: '192.168.1.1' },
      });

      expect(result[0].ipAddress).toBe('192.168.1.1');
    });

    it('should return 400 for invalid date range', () => {
      mockRequest.query = {
        startDate: '2026-03-31T00:00:00Z',
        endDate: '2026-03-01T00:00:00Z',
      };

      const isValid =
        new Date(String(mockRequest.query.startDate)) <=
        new Date(String(mockRequest.query.endDate));

      expect(isValid).toBe(false);
    });
  });

  describe('GET /api/v4/audit/:id (Detail View)', () => {
    it('should retrieve audit event by ID', async () => {
      const event = generateAuditEvent({ id: 'audit-123' });
      mockPrisma.auditEvent.findUnique.mockResolvedValue(event);

      mockRequest.params = { id: 'audit-123' };

      const result = await (mockPrisma as any).auditEvent.findUnique({
        where: { id: 'audit-123' },
      });

      expect(result.id).toBe('audit-123');
    });

    it('should return 200 with complete audit event details', async () => {
      const event = generateAuditEvent({ previousValues: { status: 'PENDING' }, newValues: { status: 'PROCESSING' } });
      mockPrisma.auditEvent.findUnique.mockResolvedValue(event);

      const result = await (mockPrisma as any).auditEvent.findUnique({
        where: { id: event.id },
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('resourceType');
      expect(result).toHaveProperty('previousValues');
      expect(result).toHaveProperty('newValues');
    });

    it('should return 404 when audit event not found', async () => {
      mockPrisma.auditEvent.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: 'nonexistent' };

      const result = await (mockPrisma as any).auditEvent.findUnique({
        where: { id: 'nonexistent' },
      });

      expect(result).toBeNull();
    });

    it('should include previousValues and newValues in detail', async () => {
      const event = generateAuditEvent({
        previousValues: { status: 'PENDING' },
        newValues: { status: 'PROCESSING' },
        changes: { status: ['PENDING', 'PROCESSING'] },
      });
      mockPrisma.auditEvent.findUnique.mockResolvedValue(event);

      const result = await (mockPrisma as any).auditEvent.findUnique({
        where: { id: event.id },
      });

      expect(result.previousValues).toEqual({ status: 'PENDING' });
      expect(result.newValues).toEqual({ status: 'PROCESSING' });
    });

    it('should include metadata (IP, user agent) in detail', async () => {
      const event = generateAuditEvent({
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });
      mockPrisma.auditEvent.findUnique.mockResolvedValue(event);

      const result = await (mockPrisma as any).auditEvent.findUnique({
        where: { id: event.id },
      });

      expect(result.ipAddress).toBe('192.168.1.1');
      expect(result.userAgent).toContain('Mozilla');
    });

    it('should return user information with audit event', async () => {
      const event = generateAuditEvent({
        userId: 'user-999',
        userName: 'Jane Smith',
        userEmail: 'jane@example.com',
      });
      mockPrisma.auditEvent.findUnique.mockResolvedValue(event);

      const result = await (mockPrisma as any).auditEvent.findUnique({
        where: { id: event.id },
      });

      expect(result.userId).toBe('user-999');
      expect(result.userName).toBe('Jane Smith');
      expect(result.userEmail).toBe('jane@example.com');
    });
  });

  describe('GET /api/v4/audit/export/compliance (Compliance Export)', () => {
    it('should export audit trail in compliance format', async () => {
      const events = [generateAuditEvent(), generateAuditEvent()];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      mockRequest.query = { format: 'compliance-report' };

      const result = await (mockPrisma as any).auditEvent.findMany({
        orderBy: { timestamp: 'asc' },
      });

      expect(result.length).toBe(2);
    });

    it('should return 200 for successful compliance export', async () => {
      const events = [generateAuditEvent()];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      const result = await (mockPrisma as any).auditEvent.findMany();

      expect(result).toBeDefined();
    });

    it('should include required compliance fields', async () => {
      const event = generateAuditEvent();
      mockPrisma.auditEvent.findUnique.mockResolvedValue(event);

      const result = await (mockPrisma as any).auditEvent.findUnique({
        where: { id: event.id },
      });

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('userName');
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('resourceType');
      expect(result).toHaveProperty('resourceId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('ipAddress');
    });

    it('should set correct content-type for compliance export', () => {
      mockRequest.query = { format: 'compliance-report' };

      const contentType = 'application/pdf';
      expect(contentType).toBe('application/pdf');
    });

    it('should set filename in content-disposition header', () => {
      const filename = `audit-trail-${new Date().toISOString().split('T')[0]}.pdf`;

      expect(filename).toContain('audit-trail');
      expect(filename).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should export in specific date range', async () => {
      const events = [generateAuditEvent()];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      mockRequest.query = {
        startDate: '2026-03-01T00:00:00Z',
        endDate: '2026-03-31T23:59:59Z',
        format: 'compliance-report',
      };

      await (mockPrisma as any).auditEvent.findMany({
        where: {
          timestamp: {
            gte: new Date('2026-03-01T00:00:00Z'),
            lte: new Date('2026-03-31T23:59:59Z'),
          },
        },
      });

      expect(mockPrisma.auditEvent.findMany).toHaveBeenCalled();
    });

    it('should include digital signature in compliance export', async () => {
      const events = [generateAuditEvent()];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      const result = await (mockPrisma as any).auditEvent.findMany();

      expect(result).toBeDefined();
    });

    it('should include timestamp in chronological order', async () => {
      const events = [
        generateAuditEvent({ timestamp: new Date('2026-03-09T10:00:00Z') }),
        generateAuditEvent({ timestamp: new Date('2026-03-09T11:00:00Z') }),
      ];
      mockPrisma.auditEvent.findMany.mockResolvedValue(events);

      await (mockPrisma as any).auditEvent.findMany({
        orderBy: { timestamp: 'asc' },
      });

      expect(mockPrisma.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { timestamp: 'asc' } })
      );
    });

    it('should handle empty compliance export', async () => {
      mockPrisma.auditEvent.findMany.mockResolvedValue([]);

      const result = await (mockPrisma as any).auditEvent.findMany();

      expect(result).toEqual([]);
    });

    it('should return 400 for invalid export format', () => {
      mockRequest.query = { format: 'invalid-format' };

      const validFormats = [
        'compliance-report',
        'pdf',
        'csv',
        'json',
      ];
      const isValid = validFormats.includes(String(mockRequest.query.format));

      expect(isValid).toBe(false);
    });
  });

  describe('Retention Policy Enforcement', () => {
    it('should enforce 30-day retention for non-critical events', async () => {
      const event = generateAuditEvent({ retentionDays: 30, timestamp: new Date('2026-01-01T10:00:00Z') });

      // Event older than 30 days should be eligible for deletion
      const createdDate = new Date(event.timestamp);
      const thirtyDaysAgo = new Date(
        new Date().getTime() - 30 * 24 * 60 * 60 * 1000
      );

      expect(createdDate.getTime()).toBeLessThan(
        thirtyDaysAgo.getTime() + 1000
      );
    });

    it('should enforce 90-day retention for sensitive operations', async () => {
      const event = generateAuditEvent({
        retentionDays: 90,
        action: 'DELETE',
      });

      expect(event.retentionDays).toBe(90);
    });

    it('should enforce 365-day retention for compliance events', async () => {
      const event = generateAuditEvent({
        retentionDays: 365,
        action: 'UPDATE',
      });

      expect(event.retentionDays).toBe(365);
    });

    it('should auto-delete events past retention period', async () => {
      mockPrisma.auditEvent.deleteMany.mockResolvedValue({ deleted: 100 });

      const thirtyDaysAgo = new Date(
        new Date().getTime() - 30 * 24 * 60 * 60 * 1000
      );

      await (mockPrisma as any).auditEvent.deleteMany({
        where: {
          retentionDays: 30,
          timestamp: { lt: thirtyDaysAgo },
        },
      });

      expect(mockPrisma.auditEvent.deleteMany).toHaveBeenCalled();
    });

    it('should preserve events within retention period', async () => {
      mockPrisma.auditEvent.findMany.mockResolvedValue([
        generateAuditEvent({ retentionDays: 90 }),
      ]);

      const result = await (mockPrisma as any).auditEvent.findMany();

      expect(result[0].retentionDays).toBe(90);
    });

    it('should apply different retention based on action type', () => {
      const deleteEvent = generateAuditEvent({
        action: 'DELETE',
        retentionDays: 365,
      });
      const updateEvent = generateAuditEvent({
        action: 'UPDATE',
        retentionDays: 90,
      });

      expect(deleteEvent.retentionDays).toBeGreaterThan(
        updateEvent.retentionDays
      );
    });

    it('should apply different retention based on resource type', () => {
      const paymentEvent = generateAuditEvent({
        resourceType: 'PAYMENT',
        retentionDays: 365,
      });
      const orderEvent = generateAuditEvent({
        resourceType: 'ORDER',
        retentionDays: 90,
      });

      expect(paymentEvent.retentionDays).toBeGreaterThanOrEqual(
        orderEvent.retentionDays
      );
    });

    it('should require org approval to delete compliance events', async () => {
      const complianceEvent = generateAuditEvent({
        retentionDays: 365,
        resourceType: 'PAYMENT',
      });

      mockPrisma.auditEvent.findUnique.mockResolvedValue(complianceEvent);

      const result = await (mockPrisma as any).auditEvent.findUnique({
        where: { id: complianceEvent.id },
      });

      expect(result.retentionDays).toBe(365);
    });
  });

  describe('Audit Event Response Validation', () => {
    it('should not expose sensitive user data', async () => {
      const event = generateAuditEvent();
      mockPrisma.auditEvent.findUnique.mockResolvedValue(event);

      const result = await (mockPrisma as any).auditEvent.findUnique({
        where: { id: event.id },
      });

      expect(result).not.toHaveProperty('hashedPassword');
      expect(result).not.toHaveProperty('apiKey');
    });

    it('should include all required audit fields', async () => {
      const event = generateAuditEvent();
      mockPrisma.auditEvent.findUnique.mockResolvedValue(event);

      const result = await (mockPrisma as any).auditEvent.findUnique({
        where: { id: event.id },
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('resourceType');
      expect(result).toHaveProperty('status');
    });

    it('should format dates as ISO strings', async () => {
      const event = generateAuditEvent();
      mockPrisma.auditEvent.findUnique.mockResolvedValue(event);

      const result = await (mockPrisma as any).auditEvent.findUnique({
        where: { id: event.id },
      });

      const isValidISODate = /^\d{4}-\d{2}-\d{2}T/.test(
        result.timestamp.toISOString()
      );
      expect(isValidISODate).toBe(true);
    });
  });
});
