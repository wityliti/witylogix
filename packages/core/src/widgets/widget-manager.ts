/**
 * Widget Manager
 * Core business logic for managing dashboard widgets
 * Handles widget CRUD operations, positioning, and layout management
 */

import type { PrismaClient } from '@witylogix/db';
import {
  Widget,
  CreateWidgetRequest,
  UpdateWidgetRequest,
  GridPosition,
  WidgetType,
  WidgetCatalogEntry,
  WIDGET_CATALOG,
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_HEIGHT,
  WidgetNotFoundError,
  WidgetValidationError,
} from './types';

/**
 * Widget Manager - Manages dashboard widgets for users
 */
export class WidgetManager {
  private readonly AUTO_POSITION = true;
  private readonly GRID_COLS = DEFAULT_GRID_COLS;
  private readonly GRID_ROWS = DEFAULT_GRID_HEIGHT;

  constructor(private prisma: PrismaClient) {}

  /**
   * Add a new widget to the dashboard
   * Auto-positions if no position is provided
   *
   * @param shopId Shop ID
   * @param userId User ID
   * @param data Widget creation request
   * @returns Created widget
   */
  async addWidget(
    shopId: string,
    userId: string,
    data: CreateWidgetRequest
  ): Promise<Widget> {
    // Validate widget type
    const catalogEntry = this.getCatalogEntry(data.type);
    if (!catalogEntry) {
      throw new WidgetValidationError(`Invalid widget type: ${data.type}`);
    }

    // Determine position
    let position = data.position;
    if (!position) {
      position = await this.findNextAvailablePosition(shopId, userId);
    } else {
      // Validate provided position
      this.validatePosition(position);
    }

    // Get highest sort order
    const lastWidget = await (this.prisma as any).widget.findFirst({
      where: { shopId, userId },
      orderBy: { sortOrder: 'desc' },
    });
    const sortOrder = (lastWidget?.sortOrder || 0) + 1;

    // Create the widget
    const widget = await (this.prisma as any).widget.create({
      data: {
        shopId,
        userId,
        type: data.type,
        name: data.name,
        config: data.config || catalogEntry.defaultConfig,
        position,
        styling: data.styling || {},
        isActive: true,
        targetPages: data.targetPages || ['/'],
        sortOrder,
      },
    });

    return this.formatWidget(widget);
  }

  /**
   * Update an existing widget
   * Verifies ownership before updating
   *
   * @param widgetId Widget ID
   * @param userId User ID (for ownership verification)
   * @param data Update request
   * @returns Updated widget
   */
  async updateWidget(
    widgetId: string,
    userId: string,
    data: UpdateWidgetRequest
  ): Promise<Widget> {
    // Get and verify ownership
    const widget = await (this.prisma as any).widget.findUnique({
      where: { id: widgetId },
    });

    if (!widget) {
      throw new WidgetNotFoundError(widgetId);
    }

    if (widget.userId !== userId) {
      throw new WidgetValidationError(
        'You do not have permission to update this widget'
      );
    }

    // Validate position if provided
    if (data.position) {
      this.validatePosition(data.position);
    }

    // Update the widget
    const updated = await (this.prisma as any).widget.update({
      where: { id: widgetId },
      data: {
        name: data.name || undefined,
        type: data.type || undefined,
        config: data.config !== undefined ? data.config : undefined,
        position: data.position || undefined,
        styling: data.styling !== undefined ? data.styling : undefined,
        targetPages: data.targetPages !== undefined ? data.targetPages : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
    });

    return this.formatWidget(updated);
  }

  /**
   * Remove a widget (soft delete - marks as inactive)
   *
   * @param widgetId Widget ID
   * @param userId User ID (for ownership verification)
   */
  async removeWidget(widgetId: string, userId: string): Promise<void> {
    const widget = await (this.prisma as any).widget.findUnique({
      where: { id: widgetId },
    });

    if (!widget) {
      throw new WidgetNotFoundError(widgetId);
    }

    if (widget.userId !== userId) {
      throw new WidgetValidationError(
        'You do not have permission to remove this widget'
      );
    }

    await (this.prisma as any).widget.update({
      where: { id: widgetId },
      data: { isActive: false },
    });
  }

  /**
   * Reorder widgets in batch
   * Updates sort order for multiple widgets
   *
   * @param userId User ID
   * @param items Array of {widgetId, position}
   */
  async reorderWidgets(
    userId: string,
    items: Array<{ widgetId: string; position: number }>
  ): Promise<void> {
    // Verify all widgets belong to user
    const widgets = await (this.prisma as any).widget.findMany({
      where: {
        id: { in: items.map((i) => i.widgetId) },
      },
    });

    for (const widget of widgets) {
      if (widget.userId !== userId) {
        throw new WidgetValidationError(
          'You do not have permission to reorder these widgets'
        );
      }
    }

    // Update all in parallel
    await Promise.all(
      items.map((item) =>
        (this.prisma as any).widget.update({
          where: { id: item.widgetId },
          data: { sortOrder: item.position },
        })
      )
    );
  }

  /**
   * Toggle widget active/inactive status
   *
   * @param widgetId Widget ID
   * @param userId User ID (for ownership verification)
   * @returns Updated widget
   */
  async toggleWidget(widgetId: string, userId: string): Promise<Widget> {
    const widget = await (this.prisma as any).widget.findUnique({
      where: { id: widgetId },
    });

    if (!widget) {
      throw new WidgetNotFoundError(widgetId);
    }

    if (widget.userId !== userId) {
      throw new WidgetValidationError(
        'You do not have permission to toggle this widget'
      );
    }

    const updated = await (this.prisma as any).widget.update({
      where: { id: widgetId },
      data: { isActive: !widget.isActive },
    });

    return this.formatWidget(updated);
  }

  /**
   * Get active widgets for a specific page
   *
   * @param shopId Shop ID
   * @param userId User ID
   * @param page Page path (default: '/')
   * @returns Array of active widgets
   */
  async getActiveWidgets(
    shopId: string,
    userId: string,
    page: string = '/'
  ): Promise<Widget[]> {
    const widgets = await (this.prisma as any).widget.findMany({
      where: {
        shopId,
        userId,
        isActive: true,
        targetPages: {
          has: page,
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return widgets.map((widget: any) => this.formatWidget(widget));
  }

  /**
   * Get all widgets for a user (active and inactive)
   *
   * @param shopId Shop ID
   * @param userId User ID
   * @returns Array of all widgets
   */
  async getAllWidgets(shopId: string, userId: string): Promise<Widget[]> {
    const widgets = await (this.prisma as any).widget.findMany({
      where: { shopId, userId },
      orderBy: { sortOrder: 'asc' },
    });

    return widgets.map((widget: any) => this.formatWidget(widget));
  }

  /**
   * Get the widget catalog
   *
   * @returns Array of available widget definitions
   */
  getWidgetCatalog(): WidgetCatalogEntry[] {
    return WIDGET_CATALOG;
  }

  /**
   * Reset layout to default widgets
   * Removes all existing widgets and creates default ones
   *
   * @param shopId Shop ID
   * @param userId User ID
   * @returns Array of default widgets
   */
  async resetLayout(shopId: string, userId: string): Promise<Widget[]> {
    // Delete all existing widgets
    await (this.prisma as any).widget.deleteMany({
      where: { shopId, userId },
    });

    // Create default widgets
    const defaultWidgets: CreateWidgetRequest[] = [
      {
        type: 'stat_card',
        name: 'Total Revenue',
        targetPages: ['/'],
      },
      {
        type: 'stat_card',
        name: 'Today\'s Orders',
        targetPages: ['/'],
      },
      {
        type: 'chart_line',
        name: 'Revenue Trend',
        targetPages: ['/'],
      },
      {
        type: 'table',
        name: 'Recent Orders',
        targetPages: ['/'],
      },
    ];

    const createdWidgets: Widget[] = [];
    for (const widgetData of defaultWidgets) {
      const widget = await this.addWidget(shopId, userId, widgetData);
      createdWidgets.push(widget);
    }

    return createdWidgets;
  }

  /**
   * Duplicate a widget
   * Creates a copy of an existing widget with a new position
   *
   * @param widgetId Widget ID to duplicate
   * @param userId User ID (for ownership verification)
   * @returns Duplicated widget
   */
  async duplicateWidget(widgetId: string, userId: string): Promise<Widget> {
    const widget = await (this.prisma as any).widget.findUnique({
      where: { id: widgetId },
    });

    if (!widget) {
      throw new WidgetNotFoundError(widgetId);
    }

    if (widget.userId !== userId) {
      throw new WidgetValidationError(
        'You do not have permission to duplicate this widget'
      );
    }

    // Find next available position
    const position = await this.findNextAvailablePosition(widget.shopId, userId);

    // Get highest sort order
    const lastWidget = await (this.prisma as any).widget.findFirst({
      where: { shopId: widget.shopId, userId },
      orderBy: { sortOrder: 'desc' },
    });
    const sortOrder = (lastWidget?.sortOrder || 0) + 1;

    // Create duplicate
    const duplicate = await (this.prisma as any).widget.create({
      data: {
        shopId: widget.shopId,
        userId,
        type: widget.type,
        name: `${widget.name} (Copy)`,
        config: widget.config,
        position,
        styling: widget.styling,
        isActive: true,
        targetPages: widget.targetPages,
        sortOrder,
      },
    });

    return this.formatWidget(duplicate);
  }

  /**
   * Find the next available grid position
   * Scans grid left-to-right, top-to-bottom
   *
   * @param shopId Shop ID
   * @param userId User ID
   * @returns Next available position
   */
  private async findNextAvailablePosition(
    shopId: string,
    userId: string
  ): Promise<GridPosition> {
    const existingWidgets = await (this.prisma as any).widget.findMany({
      where: { shopId, userId },
      select: { position: true },
    });

    // Create occupied positions set
    const occupied = new Set<string>();
    for (const widget of existingWidgets) {
      const pos = widget.position as GridPosition;
      for (let x = pos.x; x < pos.x + pos.w; x++) {
        for (let y = pos.y; y < pos.y + pos.h; y++) {
          occupied.add(`${x},${y}`);
        }
      }
    }

    // Default size for auto-positioned widgets
    const defaultW = 1;
    const defaultH = 1;

    // Scan grid
    for (let y = 0; y < this.GRID_ROWS; y++) {
      for (let x = 0; x < this.GRID_COLS; x++) {
        // Check if position is available
        let available = true;
        for (let dx = 0; dx < defaultW; dx++) {
          for (let dy = 0; dy < defaultH; dy++) {
            if (occupied.has(`${x + dx},${y + dy}`)) {
              available = false;
              break;
            }
          }
          if (!available) break;
        }

        if (available && x + defaultW <= this.GRID_COLS && y + defaultH <= this.GRID_ROWS) {
          return {
            x,
            y,
            w: defaultW,
            h: defaultH,
          };
        }
      }
    }

    // If grid is full, place at bottom
    return {
      x: 0,
      y: this.GRID_ROWS,
      w: defaultW,
      h: defaultH,
    };
  }

  /**
   * Private helper: Validate grid position
   */
  private validatePosition(position: GridPosition): void {
    if (position.x < 0 || position.y < 0) {
      throw new WidgetValidationError('Position coordinates must be non-negative');
    }

    if (position.w <= 0 || position.h <= 0) {
      throw new WidgetValidationError('Widget dimensions must be positive');
    }

    if (position.x + position.w > this.GRID_COLS) {
      throw new WidgetValidationError(
        `Widget extends beyond grid width (max x+w = ${this.GRID_COLS})`
      );
    }
  }

  /**
   * Private helper: Get catalog entry for widget type
   */
  private getCatalogEntry(type: WidgetType): WidgetCatalogEntry | undefined {
    return WIDGET_CATALOG.find((entry) => entry.type === type);
  }

  /**
   * Private helper: Format widget from database
   */
  private formatWidget(widget: any): Widget {
    return {
      id: widget.id,
      shopId: widget.shopId,
      userId: widget.userId,
      type: widget.type as WidgetType,
      name: widget.name,
      config: (widget.config as any) || {},
      position: (widget.position as GridPosition) || { x: 0, y: 0, w: 1, h: 1 },
      styling: (widget.styling as any) || {},
      isActive: widget.isActive,
      targetPages: widget.targetPages || ['/'],
      sortOrder: widget.sortOrder,
      createdAt: widget.createdAt,
      updatedAt: widget.updatedAt,
    };
  }
}
