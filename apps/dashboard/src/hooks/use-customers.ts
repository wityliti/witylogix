'use client';

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

export interface CustomerStats {
  total: number;
  syncedToday: number;
  active: number;
  inactive: number;
  tiers: { standard: number; premium: number; enterprise: number };
  topSpenders: { id: string; name: string; email: string | null; totalSpent: number; ordersCount: number }[];
  avgOrderCount: number;
  totalRevenue: number;
  lastSync: string | null;
}

export interface CustomerDensityPoint {
  city: string;
  country: string | null;
  customerCount: number;
  orderCount: number;
  lat: number;
  lng: number;
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

export function useCustomerDensity(): UseApiQueryResult<CustomerDensityPoint[]> {
  return useApiQuery<CustomerDensityPoint[]>('/api/v4/customers/density');
}
