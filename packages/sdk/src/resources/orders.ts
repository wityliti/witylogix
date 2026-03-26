/**
 * Orders resource - manage delivery orders
 */

import type { WitylogixClient } from '../client';
import type { Order, ListParams, PaginatedResponse, OrderStatus } from '../types';

export interface CreateOrderData {
  reference_number: string;
  customer_id: string;
  origin: {
    latitude: number;
    longitude: number;
    address?: string;
    postal_code?: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    address?: string;
    postal_code?: string;
  };
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    weight?: number;
    dimensions?: {
      length: number;
      width: number;
      height: number;
      unit: 'cm' | 'in';
    };
  }>;
  scheduled_date: string;
  time_slot?: {
    start_time: string;
    end_time: string;
    date: string;
  };
  special_instructions?: string;
}

export interface UpdateOrderData {
  reference_number?: string;
  time_slot?: {
    start_time: string;
    end_time: string;
    date: string;
  };
  special_instructions?: string;
}

/**
 * OrdersResource - handle all order-related API calls
 */
export class OrdersResource {
  constructor(private client: WitylogixClient) {}

  /**
   * List all orders with pagination
   *
   * @example
   * const orders = await client.orders.list({ page: 1, limit: 20 });
   */
  public async list(params?: ListParams): Promise<PaginatedResponse<Order>> {
    return this.client.get<PaginatedResponse<Order>>('/v1/orders', params);
  }

  /**
   * Get a single order by ID
   *
   * @example
   * const order = await client.orders.get('order-123');
   */
  public async get(id: string): Promise<Order> {
    return this.client.get<Order>(`/v1/orders/${id}`);
  }

  /**
   * Create a new order
   *
   * @example
   * const order = await client.orders.create({
   *   reference_number: 'ORD-001',
   *   customer_id: 'cust-123',
   *   origin: { latitude: 40.7128, longitude: -74.0060 },
   *   destination: { latitude: 40.7580, longitude: -73.9855 },
   *   items: [{ sku: 'ITEM-1', name: 'Package', quantity: 1 }],
   *   scheduled_date: '2024-03-15'
   * });
   */
  public async create(data: CreateOrderData): Promise<Order> {
    return this.client.post<Order>('/v1/orders', data);
  }

  /**
   * Update an order
   *
   * @example
   * const order = await client.orders.update('order-123', {
   *   special_instructions: 'Leave at door'
   * });
   */
  public async update(id: string, data: UpdateOrderData): Promise<Order> {
    return this.client.patch<Order>(`/v1/orders/${id}`, data);
  }

  /**
   * Delete an order (only for pending orders)
   *
   * @example
   * await client.orders.delete('order-123');
   */
  public async delete(id: string): Promise<void> {
    await this.client.delete(`/v1/orders/${id}`);
  }

  /**
   * Assign an order to a driver
   *
   * @example
   * const order = await client.orders.assign('order-123', 'driver-456');
   */
  public async assign(id: string, driverId: string): Promise<Order> {
    return this.client.patch<Order>(`/v1/orders/${id}/assign`, {
      driver_id: driverId,
    });
  }

  /**
   * Update order status
   *
   * @example
   * const order = await client.orders.updateStatus('order-123', 'in_transit');
   */
  public async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    return this.client.patch<Order>(`/v1/orders/${id}/status`, {
      status,
    });
  }

  /**
   * Get orders by status
   *
   * @example
   * const pendingOrders = await client.orders.getByStatus('pending');
   */
  public async getByStatus(
    status: OrderStatus,
    params?: ListParams
  ): Promise<PaginatedResponse<Order>> {
    return this.client.get<PaginatedResponse<Order>>('/v1/orders', {
      ...params,
      status,
    });
  }

  /**
   * Get orders for a specific date
   *
   * @example
   * const todayOrders = await client.orders.getByDate('2024-03-15');
   */
  public async getByDate(
    date: string,
    params?: ListParams
  ): Promise<PaginatedResponse<Order>> {
    return this.client.get<PaginatedResponse<Order>>('/v1/orders', {
      ...params,
      scheduled_date: date,
    });
  }

  /**
   * Get orders assigned to a driver
   *
   * @example
   * const driverOrders = await client.orders.getByDriver('driver-123');
   */
  public async getByDriver(
    driverId: string,
    params?: ListParams
  ): Promise<PaginatedResponse<Order>> {
    return this.client.get<PaginatedResponse<Order>>('/v1/orders', {
      ...params,
      assigned_driver_id: driverId,
    });
  }
}
