"use client";

/**
 * Order-specific API hooks for the dashboard
 */

import { useMemo } from "react";
import {
  useApiMutation,
  useApiList,
  useApiQuery,
  ApiFilters,
  UseApiQueryResult,
  UseApiMutationResult,
  UseApiListResult,
} from "./use-api";

/**
 * Order status enum
 */
export enum OrderStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  ASSIGNED = "assigned",
  IN_TRANSIT = "in_transit",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
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

/**
 * Order type — the canonical shape used throughout the dashboard.
 */
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
  // Geo coordinates for map pins
  deliveryLat: number | null;
  deliveryLng: number | null;
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
  sortOrder?: "asc" | "desc";
}

/**
 * Normalize a raw API order record into the Order shape the dashboard components
 * expect. The API returns flat address fields and uppercase status strings;
 * dashboard code reads nested `deliveryAddress` and lowercase `status`.
 *
 * Defensive: every field tolerates missing/null values without throwing so a
 * partially-populated record from the DB still renders.
 */
function normalizeOrder(raw: unknown): Order {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const num = (v: unknown): number => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const parsed = Number(v);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const rawStatus = str(r.status).toLowerCase();

  const rawLineItems = Array.isArray(r.lineItems)
    ? (r.lineItems as unknown[])
    : Array.isArray(r.items)
      ? (r.items as unknown[])
      : [];

  const deliveryAddress: Address = {
    street: str(r.addressLine1 ?? r.street),
    city: str(r.city),
    state: str(r.province ?? r.state),
    zipCode: str(r.postalCode ?? r.zipCode),
    country: str(r.country),
  };

  const driver: OrderDriver | null =
    r.driver && typeof r.driver === "object"
      ? {
          id: str((r.driver as Record<string, unknown>).id),
          name: str((r.driver as Record<string, unknown>).name),
          phone: str((r.driver as Record<string, unknown>).phone),
          vehicleType:
            (r.driver as Record<string, unknown>).vehicleType != null
              ? str((r.driver as Record<string, unknown>).vehicleType)
              : undefined,
        }
      : null;

  const timeSlot: OrderTimeSlot | null =
    r.timeSlot && typeof r.timeSlot === "object"
      ? {
          id: str((r.timeSlot as Record<string, unknown>).id),
          name: str((r.timeSlot as Record<string, unknown>).name),
          startTime: str((r.timeSlot as Record<string, unknown>).startTime),
          endTime: str((r.timeSlot as Record<string, unknown>).endTime),
        }
      : null;

  return {
    id: str(r.id),
    orderNumber: typeof r.orderNumber === "string" ? r.orderNumber : null,
    externalOrderId: str(r.externalOrderId ?? r.shopifyOrderId ?? r.externalId),
    source: str(r.source) || "manual",
    status: rawStatus || "pending",
    customerName: str(r.customerName),
    customerEmail: str(r.customerEmail),
    customerPhone: str(r.customerPhone),
    deliveryAddress,
    city: str(r.city),
    province: str(r.province ?? r.state),
    country: str(r.country),
    totalAmount: num(r.totalPrice ?? r.totalAmount),
    totalWeight: typeof r.totalWeight === "number" ? r.totalWeight : null,
    currency: str(r.currency) || "USD",
    items: rawLineItems,
    itemCount:
      typeof r.itemCount === "number" ? r.itemCount : rawLineItems.length,
    tags: Array.isArray(r.tags) ? (r.tags as unknown[]).map(String) : [],
    notes: typeof r.notes === "string" ? r.notes : null,
    deliveryDate: typeof r.deliveryDate === "string" ? r.deliveryDate : null,
    estimatedDelivery:
      typeof (r.estimatedArrival ?? r.estimatedDelivery) === "string"
        ? str(r.estimatedArrival ?? r.estimatedDelivery)
        : null,
    actualDelivery:
      typeof r.actualDelivery === "string" ? r.actualDelivery : null,
    driverId: typeof r.driverId === "string" ? r.driverId : null,
    driver,
    timeSlot,
    trackingToken: typeof r.trackingToken === "string" ? r.trackingToken : null,
    requireOTPConfirmation: Boolean(r.requireOTPConfirmation),
    metadata:
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : {},
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
    deliveryLat: typeof r.deliveryLat === "number" ? r.deliveryLat : null,
    deliveryLng: typeof r.deliveryLng === "number" ? r.deliveryLng : null,
  };
}

/**
 * Hook to fetch paginated orders with filtering and sorting
 * @param filters - Order filter options
 * @returns List of orders with pagination
 */
export function useOrders(filters?: OrderFilters): UseApiListResult<Order> {
  const result = useApiList<unknown>("/api/v4/orders", filters);
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
  return useApiMutation<Order>("POST", "/api/v4/orders");
}

export function useUpdateOrderStatus(id: string): UseApiMutationResult<Order> {
  return useApiMutation<Order>("PATCH", `/api/v4/orders/${id}/status`);
}

export function useOrderStats(): UseApiQueryResult<OrderStats> {
  return useApiQuery<OrderStats>("/api/v4/orders/stats");
}
