'use client';

/**
 * Customer-specific API hooks for the dashboard
 */

import { useApiList, useApiQuery, ApiFilters, UseApiQueryResult, UseApiListResult } from './use-api';

/**
 * Customer type
 */
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  company?: string;
  status: 'active' | 'inactive' | 'blocked';
  tier: 'standard' | 'premium' | 'enterprise';
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: string;
  createdAt: string;
  updatedAt: string;
  addresses?: CustomerAddress[];
  orderHistory?: OrderSummary[];
}

/**
 * Customer address
 */
export interface CustomerAddress {
  id: string;
  type: 'billing' | 'shipping' | 'default';
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

/**
 * Order summary for customer history
 */
export interface OrderSummary {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

/**
 * Customer filters
 */
export interface CustomerFilters extends ApiFilters {
  status?: 'active' | 'inactive' | 'blocked';
  tier?: 'standard' | 'premium' | 'enterprise';
  minSpent?: number;
  maxSpent?: number;
}

/**
 * Hook to fetch paginated customers with filtering and sorting
 * @param filters - Customer filter options
 * @returns List of customers with pagination
 */
export function useCustomers(
  filters?: CustomerFilters,
): UseApiListResult<Customer> {
  return useApiList<Customer>('/api/v4/customers', filters);
}

/**
 * Hook to fetch a single customer by ID with order history
 * @param id - Customer ID
 * @returns Single customer with addresses and order history
 */
export function useCustomer(
  id: string | null,
): UseApiQueryResult<Customer> {
  return useApiQuery<Customer>(id ? `/customers/${id}` : null);
}
