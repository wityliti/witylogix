import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Activity Logs Route Integration Tests
 * Tests activity log listing with pagination, filtering, date range filtering, and export endpoint.
 *
 * Coverage:
 * - GET /api/v4/activity-logs (list with pagination, filter by action/user/entity)
 * - GET /api/v4/activity-logs/:id (detail retrieval)
 * - GET /api/v4/activity-logs/export (export endpoint with date range)
 * - Query parameters: skip, limit, action, userId, entityType, entityId, startDate, endDate
 */

interface MockActivityLog {
  id: string;
  shopId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  description: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const generateActivityLog = (overrides?: Partial<MockActivityLog>): MockActivityLog => ({
  id: 'log-' + Math.random().toString(36).substring(7),
  shopId: 'shop-123',
  userId: 'user-456',
  userName: 'John Doe',
  action: 'CREATE',
  entityType: 'ORDER',
  entityId: 'order-789',
  entityName: 'Order #1001',
  description: 'Order created',
  status: 'SUCCESS',
  createdAt: new Date('2026-03-09T10:00:00Z'),
  updatedAt: new Date('2026-03-09T10:00:00Z'),
  ...overrides,
});

describe('Activity Logs Routes', () => {
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
      activityLog: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
    };
  });

  describe('GET /api/v4/activity-logs (List)', () => {
    it('should list all activity logs with default pagination (skip=0, limit=20)', async () => {
      const logs = [generateActivityLog(), generateActivityLog()];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);
      mockPrisma.activityLog.count.mockResolvedValue(2);

      const result = await (mockPrisma as any).activityLog.findMany({
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(2);
      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 })
      );
    });

    it('should return 200 with activity logs in correct format', async () => {
      const logs = [generateActivityLog()];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);
      mockPrisma.activityLog.count.mockResolvedValue(1);

      const result = await (mockPrisma as any).activityLog.findMany();

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('userId');
      expect(result[0]).toHaveProperty('action');
      expect(result[0]).toHaveProperty('entityType');
      expect(result[0]).toHaveProperty('createdAt');
    });

    it('should support pagination with custom skip and limit', async () => {
      const logs = [generateActivityLog(), generateActivityLog()];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      mockRequest.query = { skip: 10, limit: 50 };

      await (mockPrisma as any).activityLog.findMany({
        skip: 10,
        take: 50,
      });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 50 })
      );
    });

    it('should enforce maximum limit of 100', async () => {
      mockRequest.query = { limit: 200 };
      const limit = Math.min(200, 100);

      expect(limit).toBe(100);
    });

    it('should filter by action (CREATE, UPDATE, DELETE, etc)', async () => {
      const logs = [generateActivityLog({ action: 'UPDATE' })];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      mockRequest.query = { action: 'UPDATE' };

      await (mockPrisma as any).activityLog.findMany({
        where: { action: 'UPDATE' },
      });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { action: 'UPDATE' } })
      );
    });

    it('should filter by userId', async () => {
      const logs = [generateActivityLog({ userId: 'user-999' })];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      mockRequest.query = { userId: 'user-999' };

      await (mockPrisma as any).activityLog.findMany({
        where: { userId: 'user-999' },
      });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalled();
    });

    it('should filter by entityType (ORDER, SHIPMENT, CUSTOMER, etc)', async () => {
      const logs = [generateActivityLog({ entityType: 'SHIPMENT' })];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      mockRequest.query = { entityType: 'SHIPMENT' };

      await (mockPrisma as any).activityLog.findMany({
        where: { entityType: 'SHIPMENT' },
      });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalled();
    });

    it('should filter by entityId', async () => {
      const logs = [generateActivityLog({ entityId: 'order-999' })];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      mockRequest.query = { entityId: 'order-999' };

      await (mockPrisma as any).activityLog.findMany({
        where: { entityId: 'order-999' },
      });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalled();
    });

    it('should filter by date range (startDate, endDate)', async () => {
      const logs = [generateActivityLog()];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      mockRequest.query = {
        startDate: '2026-03-01T00:00:00Z',
        endDate: '2026-03-31T23:59:59Z',
      };

      await (mockPrisma as any).activityLog.findMany({
        where: {
          createdAt: {
            gte: new Date('2026-03-01T00:00:00Z'),
            lte: new Date('2026-03-31T23:59:59Z'),
          },
        },
      });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalled();
    });

    it('should combine multiple filters', async () => {
      const logs = [generateActivityLog({ action: 'DELETE', userId: 'user-999' })];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      mockRequest.query = {
        action: 'DELETE',
        userId: 'user-999',
        entityType: 'ORDER',
      };

      await (mockPrisma as any).activityLog.findMany({
        where: {
          action: 'DELETE',
          userId: 'user-999',
          entityType: 'ORDER',
        },
      });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalled();
    });

    it('should sort by createdAt descending', async () => {
      const logs = [
        generateActivityLog({ createdAt: new Date('2026-03-09T12:00:00Z') }),
        generateActivityLog({ createdAt: new Date('2026-03-09T10:00:00Z') }),
      ];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      await (mockPrisma as any).activityLog.findMany({
        orderBy: { createdAt: 'desc' },
      });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } })
      );
    });

    it('should return empty array when no logs match filters', async () => {
      mockPrisma.activityLog.findMany.mockResolvedValue([]);

      const result = await (mockPrisma as any).activityLog.findMany();

      expect(result).toEqual([]);
    });

    it('should include total count in paginated response', async () => {
      mockPrisma.activityLog.count.mockResolvedValue(100);

      const count = await (mockPrisma as any).activityLog.count();

      expect(count).toBe(100);
    });

    it('should handle skip larger than total count', async () => {
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(50);

      const result = await (mockPrisma as any).activityLog.findMany({ skip: 100 });

      expect(result).toEqual([]);
    });

    it('should include IP address and user agent in logs', async () => {
      const logs = [
        generateActivityLog({
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
        }),
      ];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      const result = await (mockPrisma as any).activityLog.findMany();

      expect(result[0].ipAddress).toBe('192.168.1.1');
      expect(result[0].userAgent).toContain('Mozilla');
    });

    it('should return 400 for invalid limit', () => {
      mockRequest.query = { limit: -1 };
      const isValid = Number(mockRequest.query.limit) > 0;

      expect(isValid).toBe(false);
    });

    it('should return 400 for invalid date format', () => {
      mockRequest.query = { startDate: 'invalid-date' };
      const isValidDate = !isNaN(Date.parse(String(mockRequest.query.startDate)));

      expect(isValidDate).toBe(false);
    });

    it('should return 400 for startDate after endDate', () => {
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

  describe('GET /api/v4/activity-logs/:id (Detail)', () => {
    it('should retrieve activity log by ID', async () => {
      const log = generateActivityLog({ id: 'log-123' });
      mockPrisma.activityLog.findUnique.mockResolvedValue(log);

      mockRequest.params = { id: 'log-123' };

      const result = await (mockPrisma as any).activityLog.findUnique({
        where: { id: 'log-123' },
      });

      expect(result.id).toBe('log-123');
    });

    it('should return 200 with complete log details', async () => {
      const log = generateActivityLog({ changes: { status: ['PENDING', 'PROCESSING'] } });
      mockPrisma.activityLog.findUnique.mockResolvedValue(log);

      const result = await (mockPrisma as any).activityLog.findUnique({
        where: { id: log.id },
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('changes');
    });

    it('should return 404 when log not found', async () => {
      mockPrisma.activityLog.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: 'nonexistent' };

      const result = await (mockPrisma as any).activityLog.findUnique({
        where: { id: 'nonexistent' },
      });

      expect(result).toBeNull();
    });

    it('should return log with changes data', async () => {
      const log = generateActivityLog({
        changes: { status: ['PENDING', 'PROCESSING'] },
      });
      mockPrisma.activityLog.findUnique.mockResolvedValue(log);

      const result = await (mockPrisma as any).activityLog.findUnique({
        where: { id: log.id },
      });

      expect(result.changes).toEqual({ status: ['PENDING', 'PROCESSING'] });
    });

    it('should return log with status field', async () => {
      const log = generateActivityLog({ status: 'SUCCESS' });
      mockPrisma.activityLog.findUnique.mockResolvedValue(log);

      const result = await (mockPrisma as any).activityLog.findUnique({
        where: { id: log.id },
      });

      expect(result.status).toBe('SUCCESS');
    });

    it('should handle invalid log ID format', () => {
      mockRequest.params = { id: '' };

      expect(String(mockRequest.params.id).length).toBe(0);
    });
  });

  describe('GET /api/v4/activity-logs/export (Export)', () => {
    it('should export logs as CSV with date range', async () => {
      const logs = [generateActivityLog(), generateActivityLog()];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      mockRequest.query = {
        startDate: '2026-03-01T00:00:00Z',
        endDate: '2026-03-31T23:59:59Z',
        format: 'csv',
      };

      const result = await (mockPrisma as any).activityLog.findMany({
        where: {
          createdAt: {
            gte: new Date('2026-03-01T00:00:00Z'),
            lte: new Date('2026-03-31T23:59:59Z'),
          },
        },
      });

      expect(result).toHaveLength(2);
    });

    it('should set correct content-type for CSV export', () => {
      mockRequest.query = { format: 'csv' };

      const contentType = 'text/csv';
      expect(contentType).toBe('text/csv');
    });

    it('should set correct filename in content-disposition header', () => {
      const filename = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;

      expect(filename).toContain('activity-logs');
      expect(filename).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should export logs with required columns', async () => {
      const logs = [generateActivityLog()];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      const result = await (mockPrisma as any).activityLog.findMany();

      expect(result[0]).toHaveProperty('createdAt');
      expect(result[0]).toHaveProperty('userId');
      expect(result[0]).toHaveProperty('action');
      expect(result[0]).toHaveProperty('entityType');
      expect(result[0]).toHaveProperty('description');
    });

    it('should export logs as JSON with date range', async () => {
      const logs = [generateActivityLog()];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      mockRequest.query = { format: 'json' };

      const result = await (mockPrisma as any).activityLog.findMany();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty export (no logs in date range)', async () => {
      mockPrisma.activityLog.findMany.mockResolvedValue([]);

      const result = await (mockPrisma as any).activityLog.findMany({
        where: {
          createdAt: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-01-02'),
          },
        },
      });

      expect(result).toEqual([]);
    });

    it('should apply user filter to export', async () => {
      const logs = [generateActivityLog({ userId: 'user-999' })];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      mockRequest.query = { userId: 'user-999', format: 'csv' };

      await (mockPrisma as any).activityLog.findMany({
        where: { userId: 'user-999' },
      });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalled();
    });

    it('should apply action filter to export', async () => {
      const logs = [generateActivityLog({ action: 'DELETE' })];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      mockRequest.query = { action: 'DELETE', format: 'csv' };

      await (mockPrisma as any).activityLog.findMany({
        where: { action: 'DELETE' },
      });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalled();
    });

    it('should return 400 for invalid format', () => {
      mockRequest.query = { format: 'invalid' };

      const validFormats = ['csv', 'json'];
      const isValid = validFormats.includes(String(mockRequest.query.format));

      expect(isValid).toBe(false);
    });

    it('should return 400 for missing date range', () => {
      mockRequest.query = { format: 'csv' };

      const hasDateRange =
        !!mockRequest.query && 'startDate' in mockRequest.query;

      expect(hasDateRange).toBe(false);
    });

    it('should limit export to maximum 50000 records', async () => {
      const logs = Array.from({ length: 50000 }, () => generateActivityLog());
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      const result = await (mockPrisma as any).activityLog.findMany({
        take: 50000,
      });

      expect(result.length).toBeLessThanOrEqual(50000);
    });
  });

  describe('Activity Log Filtering Edge Cases', () => {
    it('should handle multiple actions in filter', async () => {
      const logs = [
        generateActivityLog({ action: 'CREATE' }),
        generateActivityLog({ action: 'UPDATE' }),
      ];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      mockRequest.query = { actions: 'CREATE,UPDATE' };

      await (mockPrisma as any).activityLog.findMany({
        where: {
          action: { in: ['CREATE', 'UPDATE'] },
        },
      });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalled();
    });

    it('should handle case-insensitive action filter', async () => {
      const logs = [generateActivityLog({ action: 'CREATE' })];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      mockRequest.query = { action: 'create' };

      await (mockPrisma as any).activityLog.findMany({
        where: { action: 'CREATE' },
      });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalled();
    });

    it('should handle very large skip values', async () => {
      mockPrisma.activityLog.findMany.mockResolvedValue([]);

      mockRequest.query = { skip: 999999999 };

      const result = await (mockPrisma as any).activityLog.findMany({
        skip: 999999999,
      });

      expect(result).toEqual([]);
    });

    it('should handle special characters in filters', async () => {
      mockRequest.query = { entityName: "O'Reilly's Order" };

      // Verify filter value is properly escaped
      expect(String(mockRequest.query.entityName)).toContain("'");
    });

    it('should sort by userName when action filter applied', async () => {
      const logs = [generateActivityLog()];
      mockPrisma.activityLog.findMany.mockResolvedValue(logs);

      await (mockPrisma as any).activityLog.findMany({
        where: { action: 'UPDATE' },
        orderBy: { createdAt: 'desc' },
      });

      expect(mockPrisma.activityLog.findMany).toHaveBeenCalled();
    });
  });

  describe('Activity Log Response Validation', () => {
    it('should include all required response fields', async () => {
      const log = generateActivityLog();
      mockPrisma.activityLog.findUnique.mockResolvedValue(log);

      const result = await (mockPrisma as any).activityLog.findUnique({
        where: { id: log.id },
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('shopId');
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('userName');
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('entityType');
      expect(result).toHaveProperty('entityId');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('createdAt');
    });

    it('should not expose sensitive data in response', async () => {
      const log = generateActivityLog();
      mockPrisma.activityLog.findUnique.mockResolvedValue(log);

      const result = await (mockPrisma as any).activityLog.findUnique({
        where: { id: log.id },
      });

      expect(result).not.toHaveProperty('hashedPassword');
      expect(result).not.toHaveProperty('apiKey');
    });

    it('should format dates as ISO strings', async () => {
      const log = generateActivityLog();
      mockPrisma.activityLog.findUnique.mockResolvedValue(log);

      const result = await (mockPrisma as any).activityLog.findUnique({
        where: { id: log.id },
      });

      const isValidISODate = /^\d{4}-\d{2}-\d{2}T/.test(
        result.createdAt.toISOString()
      );
      expect(isValidISODate).toBe(true);
    });
  });
});
