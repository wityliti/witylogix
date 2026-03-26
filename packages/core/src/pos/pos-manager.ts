/**
 * POS Manager
 * Core management class for POS configurations, orders, and operations
 */

import type {
  PosConfigInput,
  PosOrderInput,
  PosOrderStatus,
  PosDeliveryType,
  PosOrderFilters,
  PosOrderStats,
  PosOrderListResponse,
} from './types';

/**
 * POS Manager - Handles all POS-related operations
 */
export class PosManager {
  constructor(private prisma: any) {}

  /**
   * Create a new POS configuration
   * @param input - Configuration input
   * @returns Created POS config
   * @throws Error if validation fails
   */
  async createConfig(input: PosConfigInput): Promise<any> {
    if (!input.shopId) {
      throw new Error('shopId is required');
    }
    if (!input.provider) {
      throw new Error('provider is required');
    }

    try {
      const config = await (this.prisma as any).posConfig.create({
        data: {
          shopId: input.shopId,
          terminalId: input.terminalId,
          provider: input.provider,
          apiKey: input.apiKey,
          enabled: input.enabled ?? false,
          settings: input.settings ?? {},
        },
      });
      return config;
    } catch (error) {
      throw new Error(`Failed to create POS config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a POS configuration
   * @param shopId - Shop ID
   * @param terminalId - Optional terminal ID
   * @returns POS config or null
   */
  async getConfig(shopId: string, terminalId?: string): Promise<any> {
    if (!shopId) {
      throw new Error('shopId is required');
    }

    try {
      const config = await (this.prisma as any).posConfig.findFirst({
        where: {
          shopId,
          ...(terminalId && { terminalId }),
        },
      });
      return config;
    } catch (error) {
      throw new Error(`Failed to get POS config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a POS configuration
   * @param id - Config ID
   * @param updates - Partial updates
   * @returns Updated config
   */
  async updateConfig(id: string, updates: Partial<PosConfigInput>): Promise<any> {
    if (!id) {
      throw new Error('id is required');
    }

    try {
      const config = await (this.prisma as any).posConfig.update({
        where: { id },
        data: {
          ...(updates.terminalId !== undefined && { terminalId: updates.terminalId }),
          ...(updates.provider && { provider: updates.provider }),
          ...(updates.apiKey !== undefined && { apiKey: updates.apiKey }),
          ...(updates.enabled !== undefined && { enabled: updates.enabled }),
          ...(updates.settings && { settings: updates.settings }),
        },
      });
      return config;
    } catch (error) {
      throw new Error(`Failed to update POS config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a POS configuration
   * @param id - Config ID
   */
  async deleteConfig(id: string): Promise<void> {
    if (!id) {
      throw new Error('id is required');
    }

    try {
      await (this.prisma as any).posConfig.delete({
        where: { id },
      });
    } catch (error) {
      throw new Error(`Failed to delete POS config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all POS configurations for a shop
   * @param shopId - Shop ID
   * @returns Array of POS configs
   */
  async listConfigs(shopId: string): Promise<any[]> {
    if (!shopId) {
      throw new Error('shopId is required');
    }

    try {
      const configs = await (this.prisma as any).posConfig.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
      });
      return configs;
    } catch (error) {
      throw new Error(`Failed to list POS configs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new POS order
   * @param input - Order input
   * @returns Created POS order
   */
  async createOrder(input: PosOrderInput): Promise<any> {
    if (!input.shopId) {
      throw new Error('shopId is required');
    }
    if (!input.posConfigId) {
      throw new Error('posConfigId is required');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('items must contain at least one item');
    }
    if (input.total < 0) {
      throw new Error('total must be non-negative');
    }

    try {
      const order = await (this.prisma as any).posOrder.create({
        data: {
          shopId: input.shopId,
          posConfigId: input.posConfigId,
          externalId: input.externalId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          items: input.items,
          total: input.total,
          status: 'PENDING',
          deliveryType: input.deliveryType,
          address: input.address,
          notes: input.notes,
          scheduledAt: input.scheduledAt,
        },
      });
      return order;
    } catch (error) {
      throw new Error(`Failed to create POS order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update the status of a POS order
   * @param orderId - Order ID
   * @param status - New status
   * @param notes - Optional status change notes
   * @returns Updated order
   */
  async updateOrderStatus(orderId: string, status: PosOrderStatus, notes?: string): Promise<any> {
    if (!orderId) {
      throw new Error('orderId is required');
    }
    if (!status) {
      throw new Error('status is required');
    }

    const validStatuses: PosOrderStatus[] = ['PENDING', 'CONFIRMED', 'READY', 'PICKED_UP', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    try {
      const order = await (this.prisma as any).posOrder.update({
        where: { id: orderId },
        data: {
          status,
          ...(notes && { notes: (await (this.prisma as any).posOrder.findUnique({ where: { id: orderId } }))?.notes ? `${notes}` : notes }),
          ...(status === 'DELIVERED' && { completedAt: new Date() }),
          ...(status === 'PICKED_UP' && { completedAt: new Date() }),
        },
      });
      return order;
    } catch (error) {
      throw new Error(`Failed to update POS order status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific POS order
   * @param orderId - Order ID
   * @returns POS order or null
   */
  async getOrder(orderId: string): Promise<any> {
    if (!orderId) {
      throw new Error('orderId is required');
    }

    try {
      const order = await (this.prisma as any).posOrder.findUnique({
        where: { id: orderId },
      });
      return order;
    } catch (error) {
      throw new Error(`Failed to get POS order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List POS orders with optional filters
   * @param shopId - Shop ID
   * @param filters - Optional filters
   * @returns Paginated list of orders
   */
  async listOrders(
    shopId: string,
    filters?: PosOrderFilters,
  ): Promise<PosOrderListResponse> {
    if (!shopId) {
      throw new Error('shopId is required');
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    try {
      const where: any = {
        shopId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.deliveryType && { deliveryType: filters.deliveryType }),
        ...(filters?.from && { createdAt: { gte: filters.from } }),
        ...(filters?.to && { createdAt: { ...(filters?.from && { gte: filters.from }), lte: filters.to } }),
      };

      const [orders, total] = await Promise.all([
        (this.prisma as any).posOrder.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        (this.prisma as any).posOrder.count({ where }),
      ]);

      return { orders, total };
    } catch (error) {
      throw new Error(`Failed to list POS orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel a POS order
   * @param orderId - Order ID
   * @param reason - Optional cancellation reason
   * @returns Cancelled order
   */
  async cancelOrder(orderId: string, reason?: string): Promise<any> {
    if (!orderId) {
      throw new Error('orderId is required');
    }

    try {
      const order = await (this.prisma as any).posOrder.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          notes: reason,
          completedAt: new Date(),
        },
      });
      return order;
    } catch (error) {
      throw new Error(`Failed to cancel POS order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get statistics for POS orders
   * @param shopId - Shop ID
   * @param from - Start date
   * @param to - End date
   * @returns Order statistics
   */
  async getStats(shopId: string, from: Date, to: Date): Promise<PosOrderStats> {
    if (!shopId) {
      throw new Error('shopId is required');
    }
    if (!from || !to) {
      throw new Error('from and to dates are required');
    }

    try {
      const orders = await (this.prisma as any).posOrder.findMany({
        where: {
          shopId,
          createdAt: {
            gte: from,
            lte: to,
          },
        },
      });

      const byStatus: Record<string, number> = {};
      const byType: Record<string, number> = {};
      let totalOrders = 0;
      let revenue = 0;

      orders.forEach((order: any) => {
        totalOrders += 1;
        revenue += order.total;

        // Count by status
        byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;

        // Count by delivery type
        byType[order.deliveryType] = (byType[order.deliveryType] ?? 0) + 1;
      });

      return {
        totalOrders,
        byStatus,
        byType,
        revenue,
      };
    } catch (error) {
      throw new Error(`Failed to get POS stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
