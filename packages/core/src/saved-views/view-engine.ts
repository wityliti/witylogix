/**
 * View Engine
 * Core business logic for managing saved views
 * Handles CRUD operations, filtering, and view configuration
 */

import type { PrismaClient } from '@witylogix/db';
import {
  SavedView,
  CreateViewRequest,
  UpdateViewRequest,
  ViewFilter,
  TableName,
  TABLE_COLUMNS,
  ViewNotFoundError,
  ViewValidationError,
} from './types';

/**
 * View Engine - Manages saved views for users
 */
export class ViewEngine {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new saved view
   * Enforces unique view names per user and table
   *
   * @param shopId Shop ID
   * @param userId User ID
   * @param data View creation request
   * @returns Created saved view
   */
  async createView(
    shopId: string,
    userId: string,
    data: CreateViewRequest
  ): Promise<SavedView> {
    // Validate the request
    this.validateCreateRequest(data);

    // Check if view name is unique for this user and table
    const existingView = await (this.prisma as any).savedView.findFirst({
      where: {
        shopId,
        userId,
        tableName: data.tableName,
        name: data.name,
      },
    });

    if (existingView) {
      throw new ViewValidationError(
        `View with name "${data.name}" already exists for this table`
      );
    }

    // Create the view
    const view = await (this.prisma as any).savedView.create({
      data: {
        shopId,
        userId,
        name: data.name,
        tableName: data.tableName,
        filters: data.filters || [],
        sortConfig: data.sortConfig || null,
        columnVisibility: data.columnVisibility || null,
        isShared: data.isShared || false,
        isDefault: false,
      },
    });

    return this.formatView(view);
  }

  /**
   * Update an existing view
   * Verifies ownership before updating
   *
   * @param viewId View ID
   * @param userId User ID (for ownership verification)
   * @param data Update request
   * @returns Updated view
   */
  async updateView(
    viewId: string,
    userId: string,
    data: UpdateViewRequest
  ): Promise<SavedView> {
    // Get the view and verify ownership
    const view = await (this.prisma as any).savedView.findUnique({
      where: { id: viewId },
    });

    if (!view) {
      throw new ViewNotFoundError(viewId);
    }

    if (view.userId !== userId) {
      throw new ViewValidationError('You do not have permission to update this view');
    }

    // If name is being updated, check uniqueness
    if (data.name && data.name !== view.name) {
      const existingView = await (this.prisma as any).savedView.findFirst({
        where: {
          shopId: view.shopId,
          userId,
          tableName: view.tableName,
          name: data.name,
        },
      });

      if (existingView) {
        throw new ViewValidationError(
          `View with name "${data.name}" already exists for this table`
        );
      }
    }

    // Update the view
    const updated = await (this.prisma as any).savedView.update({
      where: { id: viewId },
      data: {
        name: data.name || undefined,
        filters: data.filters !== undefined ? data.filters : undefined,
        sortConfig: data.sortConfig !== undefined ? data.sortConfig : undefined,
        columnVisibility:
          data.columnVisibility !== undefined ? data.columnVisibility : undefined,
        isShared: data.isShared !== undefined ? data.isShared : undefined,
      },
    });

    return this.formatView(updated);
  }

  /**
   * Delete a saved view
   * Verifies ownership before deletion
   *
   * @param viewId View ID
   * @param userId User ID (for ownership verification)
   */
  async deleteView(viewId: string, userId: string): Promise<void> {
    const view = await (this.prisma as any).savedView.findUnique({
      where: { id: viewId },
    });

    if (!view) {
      throw new ViewNotFoundError(viewId);
    }

    if (view.userId !== userId) {
      throw new ViewValidationError('You do not have permission to delete this view');
    }

    await (this.prisma as any).savedView.delete({
      where: { id: viewId },
    });
  }

  /**
   * Set a view as the default view for a table
   * Unsets the previous default if one exists
   *
   * @param viewId View ID to set as default
   * @param userId User ID (for ownership verification)
   * @param tableName Table name for context
   * @returns Updated view
   */
  async setDefault(
    viewId: string,
    userId: string,
    tableName: TableName
  ): Promise<SavedView> {
    const view = await (this.prisma as any).savedView.findUnique({
      where: { id: viewId },
    });

    if (!view) {
      throw new ViewNotFoundError(viewId);
    }

    if (view.userId !== userId) {
      throw new ViewValidationError('You do not have permission to modify this view');
    }

    // Unset previous default for this user and table
    await (this.prisma as any).savedView.updateMany({
      where: {
        userId,
        tableName,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    // Set this view as default
    const updated = await (this.prisma as any).savedView.update({
      where: { id: viewId },
      data: { isDefault: true },
    });

    return this.formatView(updated);
  }

  /**
   * Duplicate an existing view
   * Creates a copy with "(Copy)" suffix in the name
   *
   * @param viewId View ID to duplicate
   * @param userId User ID (for ownership verification)
   * @returns Duplicated view
   */
  async duplicateView(viewId: string, userId: string): Promise<SavedView> {
    const view = await (this.prisma as any).savedView.findUnique({
      where: { id: viewId },
    });

    if (!view) {
      throw new ViewNotFoundError(viewId);
    }

    if (view.userId !== userId) {
      throw new ViewValidationError('You do not have permission to duplicate this view');
    }

    // Generate unique name
    let newName = `${view.name} (Copy)`;
    let counter = 1;
    while (true) {
      const existing = await (this.prisma as any).savedView.findFirst({
        where: {
          shopId: view.shopId,
          userId,
          tableName: view.tableName,
          name: newName,
        },
      });
      if (!existing) break;
      newName = `${view.name} (Copy ${++counter})`;
    }

    // Create duplicate
    const duplicate = await (this.prisma as any).savedView.create({
      data: {
        shopId: view.shopId,
        userId,
        name: newName,
        tableName: view.tableName,
        filters: view.filters,
        sortConfig: view.sortConfig,
        columnVisibility: view.columnVisibility,
        isShared: false, // Reset sharing
        isDefault: false,
      },
    });

    return this.formatView(duplicate);
  }

  /**
   * Share a view with other team members
   *
   * @param viewId View ID
   * @param userId User ID (for ownership verification)
   * @returns Updated view
   */
  async shareView(viewId: string, userId: string): Promise<SavedView> {
    const view = await (this.prisma as any).savedView.findUnique({
      where: { id: viewId },
    });

    if (!view) {
      throw new ViewNotFoundError(viewId);
    }

    if (view.userId !== userId) {
      throw new ViewValidationError('You do not have permission to share this view');
    }

    const updated = await (this.prisma as any).savedView.update({
      where: { id: viewId },
      data: { isShared: true },
    });

    return this.formatView(updated);
  }

  /**
   * Unshare a view
   *
   * @param viewId View ID
   * @param userId User ID (for ownership verification)
   * @returns Updated view
   */
  async unshareView(viewId: string, userId: string): Promise<SavedView> {
    const view = await (this.prisma as any).savedView.findUnique({
      where: { id: viewId },
    });

    if (!view) {
      throw new ViewNotFoundError(viewId);
    }

    if (view.userId !== userId) {
      throw new ViewValidationError('You do not have permission to unshare this view');
    }

    const updated = await (this.prisma as any).savedView.update({
      where: { id: viewId },
      data: { isShared: false },
    });

    return this.formatView(updated);
  }

  /**
   * Get a single view by ID
   *
   * @param viewId View ID
   * @returns View or throws error
   */
  async getView(viewId: string): Promise<SavedView> {
    const view = await (this.prisma as any).savedView.findUnique({
      where: { id: viewId },
    });

    if (!view) {
      throw new ViewNotFoundError(viewId);
    }

    return this.formatView(view);
  }

  /**
   * List views for a user, optionally filtered by table
   * Includes the user's own views and shared views from others
   *
   * @param shopId Shop ID
   * @param userId User ID
   * @param tableName Optional table filter
   * @returns Array of views
   */
  async listViews(
    shopId: string,
    userId: string,
    tableName?: TableName
  ): Promise<SavedView[]> {
    const whereClause: any = {
      shopId,
      OR: [
        { userId }, // User's own views
        { isShared: true }, // Shared views from others
      ],
    };

    if (tableName) {
      whereClause.tableName = tableName;
    }

    const views = await (this.prisma as any).savedView.findMany({
      where: whereClause,
      orderBy: [{ userId: 'asc' }, { createdAt: 'desc' }],
    });

    return views.map((view: any) => this.formatView(view));
  }

  /**
   * Build Prisma where clause from view filters
   * Converts ViewFilter array to Prisma where syntax
   *
   * @param tableName Table to filter
   * @param filters Array of filters
   * @returns Prisma where clause
   */
  applyFilters(tableName: TableName, filters: ViewFilter[]): any {
    if (!filters || filters.length === 0) {
      return {};
    }

    const whereConditions: any[] = [];

    for (const filter of filters) {
      const condition = this.buildFilterCondition(filter);
      if (condition) {
        whereConditions.push(condition);
      }
    }

    if (whereConditions.length === 0) {
      return {};
    }

    // Combine all conditions with AND
    return whereConditions.length === 1 ? whereConditions[0] : { AND: whereConditions };
  }

  /**
   * Validate filters against available columns for a table
   *
   * @param tableName Table name
   * @param filters Filters to validate
   * @throws ViewValidationError if validation fails
   */
  validateFilters(tableName: TableName, filters: ViewFilter[]): void {
    const columns = TABLE_COLUMNS[tableName];
    if (!columns) {
      throw new ViewValidationError(`Unknown table: ${tableName}`);
    }

    for (const filter of filters) {
      if (!columns.includes(filter.column)) {
        throw new ViewValidationError(
          `Column "${filter.column}" does not exist in table "${tableName}"`
        );
      }

      this.validateFilterOperator(filter.operator, filter.value);
    }
  }

  /**
   * Get available columns for a table
   *
   * @param tableName Table name
   * @returns Array of column names
   */
  getAvailableColumns(tableName: TableName): string[] {
    const columns = TABLE_COLUMNS[tableName];
    if (!columns) {
      throw new ViewValidationError(`Unknown table: ${tableName}`);
    }
    return columns;
  }

  /**
   * Private helper: Build a single filter condition
   */
  private buildFilterCondition(filter: ViewFilter): any {
    const { column, operator, value } = filter;

    switch (operator) {
      case 'equals':
        return { [column]: { equals: value } };
      case 'not_equals':
        return { [column]: { not: value } };
      case 'contains':
        return { [column]: { contains: value, mode: 'insensitive' } };
      case 'starts_with':
        return { [column]: { startsWith: value, mode: 'insensitive' } };
      case 'greater_than':
        return { [column]: { gt: value } };
      case 'less_than':
        return { [column]: { lt: value } };
      case 'in':
        return { [column]: { in: Array.isArray(value) ? value : [value] } };
      case 'between':
        if (!Array.isArray(value) || value.length !== 2) {
          return null;
        }
        return {
          AND: [
            { [column]: { gte: value[0] } },
            { [column]: { lte: value[1] } },
          ],
        };
      case 'is_empty':
        return {
          OR: [{ [column]: null }, { [column]: '' }],
        };
      case 'is_not_empty':
        return {
          AND: [{ [column]: { not: null } }, { [column]: { not: '' } }],
        };
      default:
        return null;
    }
  }

  /**
   * Private helper: Validate filter operator and value combination
   */
  private validateFilterOperator(operator: string, value: any): void {
    if (['between', 'in'].includes(operator)) {
      if (!Array.isArray(value)) {
        throw new ViewValidationError(
          `Operator "${operator}" requires an array value`
        );
      }
      if (operator === 'between' && value.length !== 2) {
        throw new ViewValidationError(
          'Operator "between" requires exactly 2 values'
        );
      }
    }

    if (['is_empty', 'is_not_empty'].includes(operator)) {
      if (value !== null && value !== undefined) {
        throw new ViewValidationError(
          `Operator "${operator}" does not take a value`
        );
      }
    }
  }

  /**
   * Private helper: Format view from database
   */
  private formatView(view: any): SavedView {
    return {
      id: view.id,
      shopId: view.shopId,
      userId: view.userId,
      name: view.name,
      tableName: view.tableName as TableName,
      filters: (view.filters as ViewFilter[]) || [],
      sortConfig: (view.sortConfig as any) || null,
      columnVisibility: (view.columnVisibility as any) || null,
      isDefault: view.isDefault,
      isShared: view.isShared,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    };
  }

  /**
   * Private helper: Validate create request
   */
  private validateCreateRequest(data: CreateViewRequest): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new ViewValidationError('View name is required');
    }

    if (!data.tableName) {
      throw new ViewValidationError('Table name is required');
    }

    if (!TABLE_COLUMNS[data.tableName]) {
      throw new ViewValidationError(`Unknown table: ${data.tableName}`);
    }

    if (data.filters) {
      this.validateFilters(data.tableName, data.filters);
    }
  }
}
