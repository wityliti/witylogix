'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { useApiList, useApiQuery, ApiFilters, UseApiListResult, UseApiQueryResult } from './use-api';

/**
 * Transaction status enum
 */
export type TransactionStatus = "completed" | "pending" | "refunded" | "cancelled" | "failed";
export type PaymentMethod = "cash" | "card" | "mobile" | "check" | "gift_card";

/**
 * Terminal status enum
 */
export type TerminalStatus = "online" | "offline" | "error";

/**
 * Transaction data structure
 */
export interface Transaction {
  id: string;
  transactionId: string;
  terminalId: string;
  terminalName: string;
  timestamp: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  amount: number;
  tax: number;
  discount: number;
  subtotal: number;
  items: TransactionItem[];
  customerName?: string;
  customerEmail?: string;
  receiptNumber: string;
  notes?: string;
  refundedAmount?: number;
  refundReason?: string;
}

/**
 * Transaction item
 */
export interface TransactionItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: string;
}

/**
 * POS Terminal data structure
 */
export interface POSTerminal {
  id: string;
  name: string;
  location: string;
  status: TerminalStatus;
  lastActivity: string;
  totalTransactions: number;
  totalSales: number;
  operatingHours?: { open: string; close: string };
  currentShift?: string;
}

/**
 * POS overview metrics
 */
export interface POSOverview {
  todaysSales: number;
  transactionCount: number;
  avgTicket: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    mobile: number;
    other: number;
  };
}

/**
 * Sales trend data
 */
export interface SalesTrend {
  date: string;
  daily: number;
  weekly: number;
  monthly: number;
  transactions: number;
}

/**
 * Top-selling item
 */
export interface TopSellingItem {
  id: string;
  name: string;
  sku: string;
  unitsSold: number;
  revenue: number;
  category: string;
}

export function usePOSOverview(): UseApiQueryResult<POSOverview> {
  return useApiQuery<POSOverview>('/api/v4/pos/overview');
}

export function useTransactions(filters?: ApiFilters): UseApiListResult<Transaction> {
  return useApiList<Transaction>('/api/v4/pos/transactions', filters);
}

export function useTransactionDetail(id: string | null): UseApiQueryResult<Transaction> {
  return useApiQuery<Transaction>(id ? `/api/v4/pos/transactions/${id}` : null);
}

export function useTerminals(filters?: ApiFilters): UseApiListResult<POSTerminal> {
  return useApiList<POSTerminal>('/api/v4/pos/terminals', filters);
}

export function useSalesTrends(filters?: ApiFilters): UseApiListResult<SalesTrend> {
  return useApiList<SalesTrend>('/api/v4/pos/sales-trends', filters);
}

export function useTopSellingItems(filters?: ApiFilters): UseApiListResult<TopSellingItem> {
  return useApiList<TopSellingItem>('/api/v4/pos/top-items', filters);
}

export interface RefundResult {
  success: boolean;
  transactionId: string;
}

export function useRefundTransaction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refund = useCallback(async (transactionId: string, reason: string, amount?: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<{ data: RefundResult }>(
        `/api/v4/pos/transactions/${transactionId}/refund`,
        { reason, amount }
      );
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { refund, loading, error };
}

export function useExportTransactions() {
  const [loading, setLoading] = useState(false);

  const exportTransactions = useCallback(async (filters?: ApiFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', String(filters.search));
      if (filters?.status) params.set('status', String(filters.status));
      const query = params.toString() ? `?${params.toString()}` : '';
      // Fetch all transactions for export
      const result = await api.get<{ data: Transaction[] }>(`/api/v4/pos/transactions${query}&limit=1000`);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { exportTransactions, loading };
}
