'use client';

/**
 * Customer-specific API hooks for the dashboard
 */

import { useMemo } from 'react';
import { useApiList, useApiQuery, ApiFilters, UseApiQueryResult, UseApiListResult } from './use-api';

export interface CustomerAddress {
  id?: string;
  type?: 'billing' | 'shipping' | 'default';
  street?: string;
  address1?: string;
  city?: string;
  province?: string;
  state?: string;
  zip?: string;
  zipCode?: string;
  country?: string;
  country_code?: string;
  isDefault?: boolean;
}

export interface OrderSummary {
  id: string;
  externalOrderNumber?: string | null;
  status: string;
  totalPrice: number | null;
  city?: string | null;
  country?: string | null;
  deliveryDate?: string | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'inactive';
  tier: 'standard' | 'premium' | 'enterprise';
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: string | null;
  lastSyncAt?: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  addresses?: CustomerAddress[];
  recentOrders?: OrderSummary[];
  notes?: string | null;
  marketingConsent?: boolean;
  source?: string;
  externalCustomerId?: string | null;
}

export interface CustomerFilters extends ApiFilters {
  status?: 'active' | 'inactive';
  tier?: 'standard' | 'premium' | 'enterprise';
}

/**
 * Normalize a raw API customer record. The API returns `firstName`/`lastName`
 * and `ordersCount`; the dashboard expects a single `name` field and
 * `totalOrders`. Missing fields fall back to safe defaults so `.localeCompare`
 * and arithmetic never crash on null.
 */
function normalizeCustomer(raw: unknown): Customer {
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

  const first = str(r.firstName);
  const last = str(r.lastName);
  const fallbackName = str(r.name);
  const name =
    fallbackName ||
    [first, last].filter(Boolean).join(' ').trim() ||
    str(r.email) ||
    'Unknown';

  const rawStatus = str(r.status).toLowerCase();
  const status: Customer['status'] =
    rawStatus === 'inactive' || rawStatus === 'blocked'
      ? (rawStatus as Customer['status'])
      : 'active';

  const rawTier = str(r.tier).toLowerCase();
  const tier: Customer['tier'] =
    rawTier === 'premium' || rawTier === 'enterprise'
      ? (rawTier as Customer['tier'])
      : 'standard';

  return {
    id: str(r.id),
    name,
    email: str(r.email),
    phone: str(r.phone),
    avatar: r.avatar ? str(r.avatar) : undefined,
    company: r.company ? str(r.company) : undefined,
    status,
    tier,
    totalOrders: num(r.ordersCount ?? r.totalOrders),
    totalSpent: num(r.totalSpent),
    lastOrderDate: r.lastOrderDate ? str(r.lastOrderDate) : undefined,
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
    addresses: Array.isArray(r.addresses) ? (r.addresses as CustomerAddress[]) : undefined,
    orderHistory: undefined,
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
  const result = useApiList<unknown>('/api/v4/customers', filters);
  const items = useMemo<Customer[]>(
    () => (result.items ?? []).map(normalizeCustomer),
    [result.items],
  );
  return { ...result, items } as UseApiListResult<Customer>;
}

export function useCustomer(id: string | null): UseApiQueryResult<Customer> {
  return useApiQuery<Customer>(id ? `/api/v4/customers/${id}` : null);
}

export function useCustomerStats(): UseApiQueryResult<CustomerStats> {
  return useApiQuery<CustomerStats>('/api/v4/customers/stats');
}

export function useCustomerDensity(): UseApiQueryResult<CustomerDensityPoint[]> {
  return useApiQuery<CustomerDensityPoint[]>('/api/v4/customers/density');
}
