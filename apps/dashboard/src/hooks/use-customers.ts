'use client';

import { useApiList, useApiQuery, ApiFilters, UseApiQueryResult, UseApiListResult } from './use-api';

/** Matches the Customer model in 25-cache-models.prisma */
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
  totalSpent: string; // Decimal serialised as string
  tags: string[];
  addresses: unknown[]; // JSON array of address objects
  marketingConsent: boolean;
  notes: string | null;
  lastSyncAt: string;
  createdAt: string;
  updatedAt: string;
}

export function customerName(c: Customer): string {
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : c.email ?? c.externalCustomerId;
}

export interface CustomerAddress {
  address1?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  default?: boolean;
}

export interface CustomerOrder {
  id: string;
  externalOrderNumber: string | null;
  status: string;
  totalPrice: string | null;
  itemCount: number;
  city: string | null;
  deliveryDate: string | null;
  actualDelivery: string | null;
  createdAt: string;
  driver: { id: string; name: string } | null;
}

export interface CustomerStats {
  total: number;
  syncedToday: number;
  recentlyActive: number;
  topSpenders: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    totalSpent: string;
    ordersCount: number;
  }>;
  avgOrderCount: number;
  totalRevenue: string;
  topSpent: string;
  lastSync: string | null;
}

export interface CustomerGeoPoint {
  city: string;
  province: string | null;
  country: string | null;
  count: number;
  lat: number;
  lng: number;
}

export interface CustomerFilters extends ApiFilters {
  sortBy?: 'firstName' | 'email' | 'totalSpent' | 'lastSyncAt' | 'ordersCount';
  sortOrder?: 'asc' | 'desc';
}

export function useCustomers(filters?: CustomerFilters): UseApiListResult<Customer> {
  return useApiList<Customer>('/api/v4/customers', filters);
}

export function useCustomer(id: string | null): UseApiQueryResult<Customer> {
  return useApiQuery<Customer>(id ? `/api/v4/customers/${id}` : null);
}

export function useCustomerStats(): UseApiQueryResult<CustomerStats> {
  return useApiQuery<CustomerStats>('/api/v4/customers/stats');
}

export function useCustomerOrders(
  customerId: string | null,
): UseApiQueryResult<{ customer: Customer; orders: CustomerOrder[] }> {
  return useApiQuery(customerId ? `/api/v4/customers/${customerId}/orders` : null);
}

export function useCustomerGeo(): UseApiQueryResult<CustomerGeoPoint[]> {
  return useApiQuery<CustomerGeoPoint[]>('/api/v4/customers/geo');
}
