'use client';

/**
 * Order-specific API hooks for the dashboard
 */

import { useMemo } from 'react';
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
  deliveryLat: number | null;
  deliveryLng: number | null;
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

/**
 * Normalize a raw API order record into the shape the dashboard components
 * expect. The API returns flat address fields and uppercase status strings;
 * dashboard code reads nested `deliveryAddress` and lowercase `status`.
 *
 * Defensive: every field tolerates missing/null values without throwing so a
 * partially-populated record from the DB still renders.
 */
function normalizeOrder(raw: unknown): Order {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const num = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const parsed = Number(v);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const rawStatus = str(r.status).toLowerCase();
  const status =
    (Object.values(OrderStatus) as string[]).includes(rawStatus)
      ? (rawStatus as OrderStatus)
      : OrderStatus.PENDING;

  const rawLineItems = Array.isArray(r.lineItems) ? (r.lineItems as unknown[]) : [];
  const items: OrderItem[] = rawLineItems.map((li, idx) => {
    const item = (li ?? {}) as Record<string, unknown>;
    return {
      id: str(item.id) || `item-${idx}`,
      productId: str(item.productId),
      productName: str(item.name ?? item.productName),
      quantity: num(item.quantity),
      unitPrice: num(item.price ?? item.unitPrice),
      subtotal: num(item.subtotal ?? num(item.price) * num(item.quantity)),
    };
  });

  const deliveryAddress: Address = {
    street: str(r.addressLine1),
    city: str(r.city),
    state: str(r.province ?? r.state),
    zipCode: str(r.postalCode ?? r.zipCode),
    country: str(r.country),
  };

  return {
    id: str(r.id),
    customerId: str(r.customerId),
    customerName: str(r.customerName),
    customerEmail: str(r.customerEmail),
    customerPhone: str(r.customerPhone),
    status,
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
    deliveryDate: (r.deliveryDate as string | null) ?? null,
    estimatedDelivery: (r.estimatedArrival ?? r.estimatedDelivery ?? null) as string | null,
    totalAmount: num(r.totalPrice ?? r.totalAmount),
    currency: str(r.currency) || 'USD',
    items,
    deliveryAddress,
    driverId: r.driverId ? str(r.driverId) : undefined,
    notes: r.notes ? str(r.notes) : undefined,
    deliveryLat: typeof r.deliveryLat === 'number' ? r.deliveryLat : null,
    deliveryLng: typeof r.deliveryLng === 'number' ? r.deliveryLng : null,
  };
}

/**
 * Normalize a raw API order record into the shape the dashboard components
 * expect. The API returns flat address fields and uppercase status strings;
 * dashboard code reads nested `deliveryAddress` and lowercase `status`.
 *
 * Defensive: every field tolerates missing/null values without throwing so a
 * partially-populated record from the DB still renders.
 */
function normalizeOrder(raw: unknown): Order {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const num = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const parsed = Number(v);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const rawStatus = str(r.status).toLowerCase();
  const status =
    (Object.values(OrderStatus) as string[]).includes(rawStatus)
      ? (rawStatus as OrderStatus)
      : OrderStatus.PENDING;

  const rawLineItems = Array.isArray(r.lineItems) ? (r.lineItems as unknown[]) : [];
  const items: OrderItem[] = rawLineItems.map((li, idx) => {
    const item = (li ?? {}) as Record<string, unknown>;
    return {
      id: str(item.id) || `item-${idx}`,
      productId: str(item.productId),
      productName: str(item.name ?? item.productName),
      quantity: num(item.quantity),
      unitPrice: num(item.price ?? item.unitPrice),
      subtotal: num(item.subtotal ?? num(item.price) * num(item.quantity)),
    };
  });

  const deliveryAddress: Address = {
    street: str(r.addressLine1),
    city: str(r.city),
    state: str(r.province ?? r.state),
    zipCode: str(r.postalCode ?? r.zipCode),
    country: str(r.country),
  };

  return {
    id: str(r.id),
    customerId: str(r.customerId),
    customerName: str(r.customerName),
    customerEmail: str(r.customerEmail),
    customerPhone: str(r.customerPhone),
    status,
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
    deliveryDate: (r.deliveryDate as string | null) ?? null,
    estimatedDelivery: (r.estimatedArrival ?? r.estimatedDelivery ?? null) as string | null,
    totalAmount: num(r.totalPrice ?? r.totalAmount),
    currency: str(r.currency) || 'USD',
    items,
    deliveryAddress,
    driverId: r.driverId ? str(r.driverId) : undefined,
    notes: r.notes ? str(r.notes) : undefined,
  };
}

/**
 * Hook to fetch paginated orders with filtering and sorting
 * @param filters - Order filter options
 * @returns List of orders with pagination
 */
export function useOrders(
  filters?: OrderFilters,
): UseApiListResult<Order> {
  const result = useApiList<unknown>('/api/v4/orders', filters);
  const items = useMemo<Order[]>(
    () => (result.items ?? []).map(normalizeOrder),
    [result.items],
  );
  return { ...result, items } as UseApiListResult<Order>;
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
