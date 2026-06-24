'use client';

import { useApiMutation, useApiList, useApiQuery, ApiFilters, UseApiQueryResult, UseApiMutationResult, UseApiListResult } from './use-api';

export interface Address {
  street: string;
  street2?: string | null;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface OrderDriver {
  id: string;
  name: string;
  phone: string;
  vehicleType?: string;
}

export interface OrderTimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface Order {
  id: string;
  orderNumber: string | null;
  externalOrderId: string;
  source: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: Address;
  // Top-level geo fields for map geocoding
  city: string;
  province: string;
  country: string;
  totalAmount: number;
  totalWeight: number | null;
  currency: string;
  items: unknown[];
  itemCount: number;
  tags: string[];
  notes: string | null;
  deliveryDate: string | null;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  driverId: string | null;
  driver: OrderDriver | null;
  timeSlot: OrderTimeSlot | null;
  trackingToken: string | null;
  requireOTPConfirmation: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OrderStats {
  total: number;
  byStatus: Record<string, number>;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

export interface OrderFilters extends ApiFilters {
  status?: string;
  driverId?: string;
  deliveryDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useOrders(filters?: OrderFilters): UseApiListResult<Order> {
  return useApiList<Order>('/api/v4/orders', filters);
}

export function useOrder(id: string | null): UseApiQueryResult<Order> {
  return useApiQuery<Order>(id ? `/api/v4/orders/${id}` : null);
}

export function useCreateOrder(): UseApiMutationResult<Order> {
  return useApiMutation<Order>('POST', '/api/v4/orders');
}

export function useUpdateOrderStatus(id: string): UseApiMutationResult<Order> {
  return useApiMutation<Order>('PATCH', `/api/v4/orders/${id}/status`);
}

export function useOrderStats(): UseApiQueryResult<OrderStats> {
  return useApiQuery<OrderStats>('/api/v4/orders/stats');
}
