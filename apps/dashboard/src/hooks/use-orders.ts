'use client';

/**
 * Order-specific API hooks for the dashboard
 */

import { useApiMutation, useApiList, useApiQuery, ApiFilters, UseApiQueryResult, UseApiMutationResult, UseApiListResult } from './use-api';

/**
 * Order status enum
 */
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  ASSIGNED = 'assigned',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

/**
 * Order type
 */
export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  deliveryDate: string | null;
  estimatedDelivery: string | null;
  totalAmount: number;
  currency: string;
  items: OrderItem[];
  deliveryAddress: Address;
  driverId?: string;
  notes?: string;
}

/**
 * Order item
 */
export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/**
 * Delivery address
 */
export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/**
 * Order statistics
 */
export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  deliveredToday: number;
  averageOrderValue: number;
  cancellationRate: number;
}

/**
 * Order filters
 */
export interface OrderFilters extends ApiFilters {
  status?: OrderStatus;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Hook to fetch paginated orders with filtering and sorting
 * @param filters - Order filter options
 * @returns List of orders with pagination
 */
export function useOrders(
  filters?: OrderFilters,
): UseApiListResult<Order> {
  return useApiList<Order>('/orders', filters);
}

/**
 * Hook to fetch a single order by ID
 * @param id - Order ID
 * @returns Single order
 */
export function useOrder(
  id: string | null,
): UseApiQueryResult<Order> {
  return useApiQuery<Order>(id ? `/orders/${id}` : null);
}

/**
 * Hook to create a new order
 * @returns Mutation to create order
 */
export function useCreateOrder(): UseApiMutationResult<Order> {
  return useApiMutation<Order>('POST', '/orders');
}

/**
 * Hook to update order status
 * @param id - Order ID
 * @returns Mutation to update order status
 */
export function useUpdateOrderStatus(
  id: string,
): UseApiMutationResult<Order> {
  return useApiMutation<Order>('PATCH', `/orders/${id}/status`);
}

/**
 * Hook to fetch order statistics for dashboard widgets
 * @returns Order stats (totals, rates, metrics)
 */
export function useOrderStats(): UseApiQueryResult<OrderStats> {
  return useApiQuery<OrderStats>('/orders/stats');
}
