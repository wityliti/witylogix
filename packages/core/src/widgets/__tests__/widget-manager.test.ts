/**
 * Widget Manager Tests
 * Comprehensive test suite for dashboard widget management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WidgetManager } from '../widget-manager';
import { WidgetNotFoundError, WidgetValidationError } from '../types';

describe('WidgetManager', () => {
  let manager: WidgetManager;
  let prisma: any;

  beforeEach(() => {
    // Mock Prisma client
    prisma = {
      widget: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    manager = new WidgetManager(prisma as any);
  });

  describe('addWidget', () => {
    it('should add widget with auto-position', async () => {
      const mockWidget: any = {
        id: 'widget-1',
        shopId: 'shop-1',
        userId: 'user-1',
        type: 'stat_card',
        name: 'Total Revenue',
        position: { x: 0, y: 0, w: 1, h: 1 },
        config: {},
        styling: {},
        isActive: true,
        targetPages: ['/'],
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // findMany is called by findNextAvailablePosition to get existing widgets
      prisma.widget.findMany.mockResolvedValue([]);
      prisma.widget.findFirst.mockResolvedValue(null);
      prisma.widget.create.mockResolvedValue(mockWidget);

      const result = await manager.addWidget('shop-1', 'user-1', {
        type: 'stat_card',
        name: 'Total Revenue',
      });

      expect(result.id).toBe('widget-1');
      expect(result.type).toBe('stat_card');
      expect(result.isActive).toBe(true);
    });

    it('should add widget with explicit position', async () => {
      const mockWidget: any = {
        id: 'widget-1',
        position: { x: 2, y: 1, w: 2, h: 2 },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.widget.findFirst.mockResolvedValue(null);
      prisma.widget.create.mockResolvedValue(mockWidget);

      const result = await manager.addWidget('shop-1', 'user-1', {
        type: 'chart_line',
        name: 'Chart',
        position: { x: 2, y: 1, w: 2, h: 2 },
      });

      expect(result.position).toEqual({ x: 2, y: 1, w: 2, h: 2 });
    });

    it('should throw error for invalid widget type', async () => {
      await expect(
        manager.addWidget('shop-1', 'user-1', {
          type: 'invalid_type' as any,
          name: 'Test',
        })
      ).rejects.toThrow(WidgetValidationError);
    });

    it('should throw error for invalid position', async () => {
      await expect(
        manager.addWidget('shop-1', 'user-1', {
          type: 'stat_card',
          name: 'Test',
          position: { x: -1, y: 0, w: 1, h: 1 },
        })
      ).rejects.toThrow(WidgetValidationError);
    });
  });

  describe('updateWidget', () => {
    it('should update widget config', async () => {
      const mockWidget: any = {
        id: 'widget-1',
        userId: 'user-1',
        config: { metric: 'revenue' },
      };

      const updatedWidget: any = {
        ...mockWidget,
        config: { metric: 'orders' },
      };

      prisma.widget.findUnique.mockResolvedValue(mockWidget);
      prisma.widget.update.mockResolvedValue(updatedWidget);

      const result = await manager.updateWidget('widget-1', 'user-1', {
        config: { metric: 'orders' },
      });

      expect(result.config).toEqual({ metric: 'orders' });
    });

    it('should throw error if user does not own widget', async () => {
      const mockWidget: any = {
        id: 'widget-1',
        userId: 'user-2',
      };

      prisma.widget.findUnique.mockResolvedValue(mockWidget);

      await expect(
        manager.updateWidget('widget-1', 'user-1', { name: 'Updated' })
      ).rejects.toThrow(WidgetValidationError);
    });

    it('should throw WidgetNotFoundError for non-existent widget', async () => {
      prisma.widget.findUnique.mockResolvedValue(null);

      await expect(
        manager.updateWidget('invalid-widget', 'user-1', { name: 'Test' })
      ).rejects.toThrow(WidgetNotFoundError);
    });
  });

  describe('removeWidget', () => {
    it('should remove widget (soft delete)', async () => {
      const mockWidget: any = {
        id: 'widget-1',
        userId: 'user-1',
        isActive: true,
      };

      prisma.widget.findUnique.mockResolvedValue(mockWidget);
      prisma.widget.update.mockResolvedValue({ ...mockWidget, isActive: false });

      await manager.removeWidget('widget-1', 'user-1');

      expect(prisma.widget.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        })
      );
    });

    it('should throw error if user does not own widget', async () => {
      const mockWidget: any = {
        id: 'widget-1',
        userId: 'user-2',
      };

      prisma.widget.findUnique.mockResolvedValue(mockWidget);

      await expect(manager.removeWidget('widget-1', 'user-1')).rejects.toThrow(
        WidgetValidationError
      );
    });

    it('should throw WidgetNotFoundError for non-existent widget', async () => {
      prisma.widget.findUnique.mockResolvedValue(null);

      await expect(manager.removeWidget('invalid-widget', 'user-1')).rejects.toThrow(
        WidgetNotFoundError
      );
    });
  });

  describe('reorderWidgets', () => {
    it('should reorder widgets', async () => {
      const mockWidgets: any = [
        { id: 'widget-1', userId: 'user-1', sortOrder: 1 },
        { id: 'widget-2', userId: 'user-1', sortOrder: 2 },
      ];

      prisma.widget.findMany.mockResolvedValue(mockWidgets);
      prisma.widget.update.mockResolvedValue({});

      await manager.reorderWidgets('user-1', [
        { widgetId: 'widget-1', position: 2 },
        { widgetId: 'widget-2', position: 1 },
      ]);

      expect(prisma.widget.update).toHaveBeenCalledTimes(2);
    });

    it('should throw error if user does not own widget', async () => {
      const mockWidgets: any = [
        { id: 'widget-1', userId: 'user-1', sortOrder: 1 },
        { id: 'widget-2', userId: 'user-2', sortOrder: 2 },
      ];

      prisma.widget.findMany.mockResolvedValue(mockWidgets);

      await expect(
        manager.reorderWidgets('user-1', [
          { widgetId: 'widget-1', position: 1 },
          { widgetId: 'widget-2', position: 2 },
        ])
      ).rejects.toThrow(WidgetValidationError);
    });
  });

  describe('toggleWidget', () => {
    it('should toggle widget active status', async () => {
      const mockWidget: any = {
        id: 'widget-1',
        userId: 'user-1',
        isActive: true,
      };

      const toggledWidget: any = {
        ...mockWidget,
        isActive: false,
      };

      prisma.widget.findUnique.mockResolvedValue(mockWidget);
      prisma.widget.update.mockResolvedValue(toggledWidget);

      const result = await manager.toggleWidget('widget-1', 'user-1');

      expect(result.isActive).toBe(false);
      expect(prisma.widget.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        })
      );
    });

    it('should throw error if user does not own widget', async () => {
      const mockWidget: any = {
        id: 'widget-1',
        userId: 'user-2',
      };

      prisma.widget.findUnique.mockResolvedValue(mockWidget);

      await expect(manager.toggleWidget('widget-1', 'user-1')).rejects.toThrow(
        WidgetValidationError
      );
    });

    it('should throw WidgetNotFoundError for non-existent widget', async () => {
      prisma.widget.findUnique.mockResolvedValue(null);

      await expect(manager.toggleWidget('invalid-widget', 'user-1')).rejects.toThrow(
        WidgetNotFoundError
      );
    });
  });

  describe('getActiveWidgets', () => {
    it('should get active widgets for page', async () => {
      const mockWidgets: any = [
        { id: 'widget-1', isActive: true, targetPages: ['/'], sortOrder: 1 },
        { id: 'widget-2', isActive: true, targetPages: ['/'], sortOrder: 2 },
      ];

      prisma.widget.findMany.mockResolvedValue(mockWidgets);

      const result = await manager.getActiveWidgets('shop-1', 'user-1', '/');

      expect(result).toHaveLength(2);
      expect(result[0].isActive).toBe(true);
    });

    it('should use default page path', async () => {
      prisma.widget.findMany.mockResolvedValue([]);

      await manager.getActiveWidgets('shop-1', 'user-1');

      expect(prisma.widget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetPages: {
              has: '/',
            },
          }),
        })
      );
    });

    it('should filter by custom page path', async () => {
      prisma.widget.findMany.mockResolvedValue([]);

      await manager.getActiveWidgets('shop-1', 'user-1', '/dashboard');

      expect(prisma.widget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetPages: {
              has: '/dashboard',
            },
          }),
        })
      );
    });
  });

  describe('getAllWidgets', () => {
    it('should get all widgets for user', async () => {
      const mockWidgets: any = [
        { id: 'widget-1', isActive: true },
        { id: 'widget-2', isActive: false },
        { id: 'widget-3', isActive: true },
      ];

      prisma.widget.findMany.mockResolvedValue(mockWidgets);

      const result = await manager.getAllWidgets('shop-1', 'user-1');

      expect(result).toHaveLength(3);
    });
  });

  describe('getWidgetCatalog', () => {
    it('should return widget catalog', () => {
      const catalog = manager.getWidgetCatalog();

      expect(Array.isArray(catalog)).toBe(true);
      expect(catalog.length).toBeGreaterThan(0);
      expect(catalog[0]).toHaveProperty('type');
      expect(catalog[0]).toHaveProperty('name');
    });
  });

  describe('resetLayout', () => {
    it('should reset layout to defaults', async () => {
      prisma.widget.deleteMany.mockResolvedValue({ count: 0 });
      // findMany is called by findNextAvailablePosition within addWidget
      prisma.widget.findMany.mockResolvedValue([]);
      prisma.widget.findFirst.mockResolvedValue(null);
      prisma.widget.create.mockResolvedValue({
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await manager.resetLayout('shop-1', 'user-1');

      expect(result).toHaveLength(4);
      expect(prisma.widget.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shopId: 'shop-1',
            userId: 'user-1',
          },
        })
      );
    });
  });

  describe('duplicateWidget', () => {
    it('should duplicate widget', async () => {
      const mockWidget: any = {
        id: 'widget-1',
        userId: 'user-1',
        shopId: 'shop-1',
        type: 'stat_card',
        name: 'Revenue',
        config: { metric: 'revenue' },
        styling: {},
        isActive: true,
        targetPages: ['/'],
      };

      const duplicatedWidget: any = {
        ...mockWidget,
        id: 'widget-2',
        name: 'Revenue (Copy)',
      };

      prisma.widget.findUnique.mockResolvedValue(mockWidget);
      prisma.widget.findMany.mockResolvedValue([]);
      prisma.widget.findFirst.mockResolvedValue(null);
      prisma.widget.create.mockResolvedValue({
        ...duplicatedWidget,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await manager.duplicateWidget('widget-1', 'user-1');

      expect(result.name).toBe('Revenue (Copy)');
      expect(result.type).toBe('stat_card');
    });

    it('should throw error if user does not own widget', async () => {
      const mockWidget: any = {
        id: 'widget-1',
        userId: 'user-2',
      };

      prisma.widget.findUnique.mockResolvedValue(mockWidget);

      await expect(manager.duplicateWidget('widget-1', 'user-1')).rejects.toThrow(
        WidgetValidationError
      );
    });

    it('should throw WidgetNotFoundError for non-existent widget', async () => {
      prisma.widget.findUnique.mockResolvedValue(null);

      await expect(manager.duplicateWidget('invalid-widget', 'user-1')).rejects.toThrow(
        WidgetNotFoundError
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle position at grid boundary', async () => {
      // GRID_COLS is 4, so max valid position is x=3 with w=1 (3+1=4)
      prisma.widget.findFirst.mockResolvedValue(null);
      prisma.widget.create.mockResolvedValue({
        id: 'widget-1',
        position: { x: 3, y: 0, w: 1, h: 1 },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await manager.addWidget('shop-1', 'user-1', {
        type: 'stat_card',
        name: 'Test',
        position: { x: 3, y: 0, w: 1, h: 1 },
      });

      expect(result.position).toEqual({ x: 3, y: 0, w: 1, h: 1 });
    });

    it('should throw error when position exceeds grid width', async () => {
      await expect(
        manager.addWidget('shop-1', 'user-1', {
          type: 'stat_card',
          name: 'Test',
          position: { x: 3, y: 0, w: 2, h: 1 },
        })
      ).rejects.toThrow(WidgetValidationError);
    });

    it('should throw error for zero dimension', async () => {
      await expect(
        manager.addWidget('shop-1', 'user-1', {
          type: 'stat_card',
          name: 'Test',
          position: { x: 0, y: 0, w: 0, h: 1 },
        })
      ).rejects.toThrow(WidgetValidationError);
    });

    it('should handle empty widget list for auto-position', async () => {
      prisma.widget.findMany.mockResolvedValue([]);
      prisma.widget.findFirst.mockResolvedValue(null);
      prisma.widget.create.mockResolvedValue({
        id: 'widget-1',
        position: { x: 0, y: 0, w: 1, h: 1 },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await manager.addWidget('shop-1', 'user-1', {
        type: 'stat_card',
        name: 'First Widget',
      });

      expect(result.position.x).toBe(0);
      expect(result.position.y).toBe(0);
    });

    it('should handle full grid auto-position', async () => {
      const occupiedWidgets: any = Array.from({ length: 144 }, (_, i) => ({
        position: { x: i % 12, y: Math.floor(i / 12), w: 1, h: 1 },
      }));

      prisma.widget.findMany.mockResolvedValue(occupiedWidgets);
      prisma.widget.findFirst.mockResolvedValue(null);
      prisma.widget.create.mockResolvedValue({
        id: 'widget-1',
        position: { x: 0, y: 12, w: 1, h: 1 },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await manager.addWidget('shop-1', 'user-1', {
        type: 'stat_card',
        name: 'Overflow Widget',
      });

      expect(result.position.y).toBeGreaterThanOrEqual(12);
    });
  });
});
