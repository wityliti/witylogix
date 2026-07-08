"use client";

import { useMemo } from "react";
import {
  useApiList,
  useApiQuery,
  type ApiFilters,
  type UseApiQueryResult,
  type UseApiListResult,
} from "./use-api";
import type { CustomerLocation } from "@/components/map/customer-density-layer";

export interface Customer {
  id: string;
  shopId: string;
  externalCustomerId: string;
  source: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  ordersCount: number;
  totalSpent: number;
  tags: string[];
  addresses: CustomerAddress[];
  marketingConsent: boolean;
  notes: string | null;
  lastSyncAt: string;
  createdAt: string;
  updatedAt: string;
  // Derived fields normalised by the API
  name: string;
  totalOrders: number;
  tier: "standard" | "premium" | "enterprise";
  status: "active" | "inactive";
}

export interface CustomerAddress {
  id?: number;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  country?: string;
  zip?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  default?: boolean;
}

export interface CustomerFilters extends ApiFilters {
  status?: "active" | "inactive";
  tier?: "standard" | "premium" | "enterprise";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CustomerSegmentStats {
  total: number;
  tiers: Record<
    string,
    { count: number; totalSpent: number; totalOrders: number }
  >;
  statuses: { active: number; inactive: number };
  topCities: Array<{
    city: string;
    count: number;
    totalSpent: number;
    avgOrders: number;
  }>;
}

/**
 * Normalize a raw API customer record. The API returns `firstName`/`lastName`
 * and `ordersCount`; the dashboard expects a single `name` field and
 * `totalOrders`. Missing fields fall back to safe defaults so `.localeCompare`
 * and arithmetic never crash on null.
 */
function normalizeCustomer(raw: unknown): Customer {
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

  const first = str(r.firstName);
  const last = str(r.lastName);
  const fallbackName = str(r.name);
  const name =
    fallbackName ||
    [first, last].filter(Boolean).join(" ").trim() ||
    str(r.email) ||
    "Unknown";

  const rawStatus = str(r.status).toLowerCase();
  const status: Customer["status"] =
    rawStatus === "inactive" || rawStatus === "blocked"
      ? (rawStatus as Customer["status"])
      : "active";

  const rawTier = str(r.tier).toLowerCase();
  const tier: Customer["tier"] =
    rawTier === "premium" || rawTier === "enterprise"
      ? (rawTier as Customer["tier"])
      : "standard";

  return {
    id: str(r.id),
    shopId: str(r.shopId),
    externalCustomerId: str(r.externalCustomerId),
    source: str(r.source) || "SHOPIFY",
    name,
    email: r.email ? str(r.email) : null,
    phone: r.phone ? str(r.phone) : null,
    firstName: r.firstName ? str(r.firstName) : null,
    lastName: r.lastName ? str(r.lastName) : null,
    ordersCount: num(r.ordersCount),
    status,
    tier,
    totalOrders: num(r.ordersCount ?? r.totalOrders),
    totalSpent: num(r.totalSpent),
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    addresses: Array.isArray(r.addresses)
      ? (r.addresses as CustomerAddress[])
      : [],
    marketingConsent: Boolean(r.marketingConsent),
    notes: r.notes ? str(r.notes) : null,
    lastSyncAt: str(r.lastSyncAt),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
  };
}

/**
 * Hook to fetch paginated customers with filtering and sorting
 * @param filters - Customer filter options
 * @returns List of customers with pagination
 */
export function useCustomers(
  filters?: CustomerFilters,
): UseApiListResult<Customer> {
  const result = useApiList<unknown>("/api/v4/customers", filters);
  const items = useMemo<Customer[]>(
    () => (result.items ?? []).map(normalizeCustomer),
    [result.items],
  );
  return { ...result, items } as UseApiListResult<Customer>;
}

// ─── Raw order shape from /:id/orders endpoint ─────────────

export interface CustomerOrder {
  id: string;
  externalOrderNumber: string | null;
  externalOrderId: string;
  status: string;
  customerName: string | null;
  totalPrice: string | number | null;
  itemCount: number;
  city: string | null;
  province: string | null;
  country: string | null;
  deliveryLocation: { lat: number; lng: number } | null;
  createdAt: string;
  driver: { id: string; name: string } | null;
}

export interface CustomerOrdersData {
  customer: Record<string, unknown>;
  orders: CustomerOrder[];
}

export interface CustomerOrdersResult {
  data: CustomerOrdersData | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface CustomerStats {
  total: number;
  totalPrev: number;
  activeCount: number;
  syncedToday: number;
  avgOrderCount: number;
  totalRevenue: number;
  topSpenderAmount: number;
  lastSync: string | null;
  topSpenders: Array<{
    id: string;
    name: string;
    totalSpent: number;
    ordersCount: number;
  }>;
}

/**
 * Hook to fetch a single customer by ID.
 * useApiQuery already extracts `.data` from the JSON wrapper, so the raw
 * Prisma customer lands directly in result.data. We normalize it.
 */
export function useCustomer(id: string | null): UseApiQueryResult<Customer> {
  const result = useApiQuery<unknown>(id ? `/api/v4/customers/${id}` : null);
  const customer = useMemo<Customer | null>(
    () => (result.data ? normalizeCustomer(result.data) : null),
    [result.data],
  );
  return { ...result, data: customer } as UseApiQueryResult<Customer>;
}

/**
 * Hook to fetch orders for a customer.
 * The endpoint returns { data: { customer, orders }, pagination } — useApiQuery
 * extracts the inner `data` field ({ customer, orders }).
 * 20 orders is sufficient for the customer detail page.
 */
export function useCustomerOrders(id: string | null): CustomerOrdersResult {
  const result = useApiQuery<CustomerOrdersData>(
    id
      ? `/api/v4/customers/${id}/orders?limit=20&sortBy=createdAt&sortOrder=desc`
      : null,
  );
  return {
    data: result.data ?? null,
    pagination: {
      page: 1,
      limit: 20,
      total: result.data?.orders?.length ?? 0,
      totalPages: 1,
    },
    loading: result.loading,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useCustomerStats(): UseApiQueryResult<CustomerStats> {
  return useApiQuery<CustomerStats>("/api/v4/customers/stats");
}

export function useCustomerLocations(): UseApiQueryResult<CustomerLocation[]> {
  return useApiQuery<CustomerLocation[]>("/api/v4/customers/locations");
}

export function useCustomerSegmentStats(): UseApiQueryResult<CustomerSegmentStats> {
  return useApiQuery<CustomerSegmentStats>("/api/v4/customers/segment-stats");
}
