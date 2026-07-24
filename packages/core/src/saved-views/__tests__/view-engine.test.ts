/**
 * View Engine Tests
 * Comprehensive test suite for saved view management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ViewEngine } from "../view-engine";
import { ViewNotFoundError, ViewValidationError } from "../types";

describe("ViewEngine", () => {
  let engine: ViewEngine;
  let prisma: any;

  beforeEach(() => {
    // Mock Prisma client
    prisma = {
      savedView: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    engine = new ViewEngine(prisma as any);
  });

  describe("createView", () => {
    it("should create view", async () => {
      const mockView: any = {
        id: "view-1",
        shopId: "shop-1",
        userId: "user-1",
        name: "Active Orders",
        tableName: "orders",
        filters: [{ column: "status", operator: "equals", value: "active" }],
        sortConfig: null,
        columnVisibility: null,
        isShared: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.savedView.findFirst.mockResolvedValue(null);
      prisma.savedView.create.mockResolvedValue(mockView);

      const result = await engine.createView("shop-1", "user-1", {
        name: "Active Orders",
        tableName: "orders",
        filters: [{ column: "status", operator: "equals", value: "active" }],
      });

      expect(result.id).toBe("view-1");
      expect(result.name).toBe("Active Orders");
      expect(result.tableName).toBe("orders");
    });

    it("should enforce unique name per user and table", async () => {
      const existingView: any = {
        id: "view-1",
        name: "Active Orders",
      };

      prisma.savedView.findFirst.mockResolvedValue(existingView);

      await expect(
        engine.createView("shop-1", "user-1", {
          name: "Active Orders",
          tableName: "orders",
        }),
      ).rejects.toThrow(ViewValidationError);
    });
  });

  describe("updateView", () => {
    it("should update view with ownership check", async () => {
      const mockView: any = {
        id: "view-1",
        shopId: "shop-1",
        userId: "user-1",
        name: "Old Name",
        tableName: "orders",
      };

      const updatedView: any = {
        ...mockView,
        name: "New Name",
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);
      prisma.savedView.findFirst.mockResolvedValue(null);
      prisma.savedView.update.mockResolvedValue(updatedView);

      const result = await engine.updateView("view-1", "user-1", {
        name: "New Name",
      });

      expect(result.name).toBe("New Name");
    });

    it("should throw error if user does not own view", async () => {
      const mockView: any = {
        id: "view-1",
        userId: "user-2",
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);

      await expect(
        engine.updateView("view-1", "user-1", { name: "New Name" }),
      ).rejects.toThrow(ViewValidationError);
    });

    it("should throw ViewNotFoundError when view not found", async () => {
      prisma.savedView.findUnique.mockResolvedValue(null);

      await expect(
        engine.updateView("invalid-view", "user-1", { name: "Test" }),
      ).rejects.toThrow(ViewNotFoundError);
    });
  });

  describe("deleteView", () => {
    it("should delete view with ownership check", async () => {
      const mockView: any = {
        id: "view-1",
        userId: "user-1",
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);
      prisma.savedView.delete.mockResolvedValue(mockView);

      await engine.deleteView("view-1", "user-1");

      expect(prisma.savedView.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "view-1" },
        }),
      );
    });

    it("should throw error if user does not own view", async () => {
      const mockView: any = {
        id: "view-1",
        userId: "user-2",
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);

      await expect(engine.deleteView("view-1", "user-1")).rejects.toThrow(
        ViewValidationError,
      );
    });

    it("should throw ViewNotFoundError when view not found", async () => {
      prisma.savedView.findUnique.mockResolvedValue(null);

      await expect(engine.deleteView("invalid-view", "user-1")).rejects.toThrow(
        ViewNotFoundError,
      );
    });
  });

  describe("setDefault", () => {
    it("should set view as default and unset previous default", async () => {
      const mockView: any = {
        id: "view-1",
        userId: "user-1",
        tableName: "orders",
        isDefault: false,
      };

      const updatedView: any = {
        ...mockView,
        isDefault: true,
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);
      prisma.savedView.updateMany.mockResolvedValue({ count: 1 });
      prisma.savedView.update.mockResolvedValue(updatedView);

      const result = await engine.setDefault("view-1", "user-1", "orders");

      expect(result.isDefault).toBe(true);
      expect(prisma.savedView.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user-1",
            tableName: "orders",
            isDefault: true,
          }),
          data: { isDefault: false },
        }),
      );
    });

    it("should throw error if user does not own view", async () => {
      const mockView: any = {
        id: "view-1",
        userId: "user-2",
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);

      await expect(
        engine.setDefault("view-1", "user-1", "orders"),
      ).rejects.toThrow(ViewValidationError);
    });
  });

  describe("duplicateView", () => {
    it('should duplicate view with "(Copy)" suffix', async () => {
      const mockView: any = {
        id: "view-1",
        shopId: "shop-1",
        userId: "user-1",
        name: "Original",
        tableName: "orders",
        filters: [],
        sortConfig: null,
        columnVisibility: null,
        isShared: true,
        isDefault: true,
      };

      const duplicatedView: any = {
        id: "view-2",
        name: "Original (Copy)",
        isShared: false,
        isDefault: false,
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);
      prisma.savedView.findFirst.mockResolvedValue(null);
      prisma.savedView.create.mockResolvedValue(duplicatedView);

      const result = await engine.duplicateView("view-1", "user-1");

      expect(result.name).toBe("Original (Copy)");
      expect(result.isShared).toBe(false);
      expect(result.isDefault).toBe(false);
    });

    it("should handle duplicate copy names", async () => {
      const mockView: any = {
        id: "view-1",
        shopId: "shop-1",
        userId: "user-1",
        name: "Original",
        tableName: "orders",
      };

      const existingCopy: any = {
        name: "Original (Copy)",
      };

      const duplicatedView: any = {
        id: "view-3",
        name: "Original (Copy 2)",
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);
      prisma.savedView.findFirst
        .mockResolvedValueOnce(existingCopy)
        .mockResolvedValueOnce(null);
      prisma.savedView.create.mockResolvedValue(duplicatedView);

      const result = await engine.duplicateView("view-1", "user-1");

      expect(result.name).toBe("Original (Copy 2)");
    });

    it("should throw error if user does not own view", async () => {
      const mockView: any = {
        id: "view-1",
        userId: "user-2",
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);

      await expect(engine.duplicateView("view-1", "user-1")).rejects.toThrow(
        ViewValidationError,
      );
    });
  });

  describe("shareView", () => {
    it("should share view", async () => {
      const mockView: any = {
        id: "view-1",
        userId: "user-1",
        isShared: false,
      };

      const sharedView: any = {
        ...mockView,
        isShared: true,
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);
      prisma.savedView.update.mockResolvedValue(sharedView);

      const result = await engine.shareView("view-1", "user-1");

      expect(result.isShared).toBe(true);
    });

    it("should throw error if user does not own view", async () => {
      const mockView: any = {
        id: "view-1",
        userId: "user-2",
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);

      await expect(engine.shareView("view-1", "user-1")).rejects.toThrow(
        ViewValidationError,
      );
    });
  });

  describe("unshareView", () => {
    it("should unshare view", async () => {
      const mockView: any = {
        id: "view-1",
        userId: "user-1",
        isShared: true,
      };

      const unsharedView: any = {
        ...mockView,
        isShared: false,
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);
      prisma.savedView.update.mockResolvedValue(unsharedView);

      const result = await engine.unshareView("view-1", "user-1");

      expect(result.isShared).toBe(false);
    });

    it("should throw error if user does not own view", async () => {
      const mockView: any = {
        id: "view-1",
        userId: "user-2",
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);

      await expect(engine.unshareView("view-1", "user-1")).rejects.toThrow(
        ViewValidationError,
      );
    });
  });

  describe("listViews", () => {
    it("should list user's own views and shared views", async () => {
      const mockViews: any = [
        { id: "view-1", userId: "user-1", isShared: false },
        { id: "view-2", userId: "user-2", isShared: true },
      ];

      prisma.savedView.findMany.mockResolvedValue(mockViews);

      const result = await engine.listViews("shop-1", "user-1");

      expect(result).toHaveLength(2);
      expect(prisma.savedView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            shopId: "shop-1",
            OR: [{ userId: "user-1" }, { isShared: true }],
          }),
        }),
      );
    });

    it("should filter by table name", async () => {
      const mockViews: any = [{ id: "view-1", tableName: "orders" }];

      prisma.savedView.findMany.mockResolvedValue(mockViews);

      await engine.listViews("shop-1", "user-1", "orders");

      expect(prisma.savedView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tableName: "orders",
          }),
        }),
      );
    });
  });

  describe("applyFilters", () => {
    it("should apply equals filter", () => {
      const result = engine.applyFilters("orders", [
        { column: "status", operator: "equals", value: "active" },
      ]);

      expect(result).toEqual({
        status: { equals: "active" },
      });
    });

    it("should apply contains filter", () => {
      const result = engine.applyFilters("orders", [
        { column: "description", operator: "contains", value: "urgent" },
      ]);

      expect(result).toEqual({
        description: { contains: "urgent", mode: "insensitive" },
      });
    });

    it("should apply between filter", () => {
      const result = engine.applyFilters("orders", [
        { column: "amount", operator: "between", value: [100, 500] },
      ]);

      expect(result).toEqual({
        AND: [{ amount: { gte: 100 } }, { amount: { lte: 500 } }],
      });
    });

    it("should apply in filter", () => {
      const result = engine.applyFilters("orders", [
        { column: "status", operator: "in", value: ["active", "pending"] },
      ]);

      expect(result).toEqual({
        status: { in: ["active", "pending"] },
      });
    });

    it("should apply is_empty filter", () => {
      const result = engine.applyFilters("orders", [
        { column: "notes", operator: "is_empty", value: null },
      ]);

      expect(result).toEqual({
        OR: [{ notes: null }, { notes: "" }],
      });
    });

    it("should combine multiple filters with AND", () => {
      const result = engine.applyFilters("orders", [
        { column: "status", operator: "equals", value: "active" },
        { column: "priority", operator: "equals", value: "high" },
      ]);

      expect(result).toEqual({
        AND: [
          { status: { equals: "active" } },
          { priority: { equals: "high" } },
        ],
      });
    });

    it("should return empty object for empty filters", () => {
      const result = engine.applyFilters("orders", []);

      expect(result).toEqual({});
    });
  });

  describe("validateFilters", () => {
    it("should validate filters against table columns", () => {
      expect(() => {
        engine.validateFilters("orders", [
          { column: "status", operator: "equals", value: "active" },
        ]);
      }).not.toThrow();
    });

    it("should throw error for invalid column", () => {
      expect(() => {
        engine.validateFilters("orders", [
          { column: "nonexistent", operator: "equals", value: "test" },
        ]);
      }).toThrow(ViewValidationError);
    });

    it("should throw error for between operator without array", () => {
      expect(() => {
        engine.validateFilters("orders", [
          { column: "amount", operator: "between", value: 100 },
        ]);
      }).toThrow(ViewValidationError);
    });

    it("should throw error for between operator without 2 values", () => {
      expect(() => {
        engine.validateFilters("orders", [
          { column: "amount", operator: "between", value: [100] },
        ]);
      }).toThrow(ViewValidationError);
    });
  });

  describe("getAvailableColumns", () => {
    it("should return available columns for table", () => {
      const columns = engine.getAvailableColumns("orders");

      expect(Array.isArray(columns)).toBe(true);
      expect(columns.length).toBeGreaterThan(0);
    });

    it("should throw error for unknown table", () => {
      expect(() => {
        engine.getAvailableColumns("unknown_table" as any);
      }).toThrow(ViewValidationError);
    });
  });

  describe("getView", () => {
    it("should get view by ID", async () => {
      const mockView: any = {
        id: "view-1",
        name: "Test View",
        tableName: "orders",
      };

      prisma.savedView.findUnique.mockResolvedValue(mockView);

      const result = await engine.getView("view-1");

      expect(result.id).toBe("view-1");
      expect(result.name).toBe("Test View");
    });

    it("should throw ViewNotFoundError when view not found", async () => {
      prisma.savedView.findUnique.mockResolvedValue(null);

      await expect(engine.getView("invalid-view")).rejects.toThrow(
        ViewNotFoundError,
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle empty view name validation", async () => {
      await expect(
        engine.createView("shop-1", "user-1", {
          name: "",
          tableName: "orders",
        }),
      ).rejects.toThrow(ViewValidationError);
    });

    it("should handle missing table name", async () => {
      await expect(
        engine.createView("shop-1", "user-1", {
          name: "Test",
          tableName: undefined as any,
        }),
      ).rejects.toThrow(ViewValidationError);
    });

    it("should handle unknown table in create", async () => {
      await expect(
        engine.createView("shop-1", "user-1", {
          name: "Test",
          tableName: "unknown_table" as any,
        }),
      ).rejects.toThrow(ViewValidationError);
    });
  });
});
