/**
 * Financial Data Hooks — Managing invoices, reconciliation, and metrics
 *
 * Features:
 * - useInvoices: Paginated, filterable, sortable invoice list
 * - useReconciliation: Payment matching and reconciliation logic
 * - useFinancialMetrics: Revenue tracking, outstanding amounts, aging
 *
 * @example
 * ```tsx
 * const invoices = useInvoices({ page: 1, status: 'outstanding' });
 * const metrics = useFinancialMetrics();
 * const reconciliation = useReconciliation();
 * ```
 */

'use client';

import { useCallback, useEffect, useReducer, useState } from 'react';
import type { Invoice, Payment } from '@/components/invoicing/types';

// ─── TYPES ──────────────────────────────────────────────────────────

export interface InvoiceFilters {
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  platform?: string;
  dateRange?: { from: Date; to: Date };
  amountRange?: { min: number; max: number };
  customerName?: string;
  searchQuery?: string;
}

export interface InvoiceSortOptions {
  sortBy: 'date' | 'amount' | 'status' | 'customer';
  sortOrder: 'asc' | 'desc';
}

export interface InvoicesState {
  invoices: Invoice[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  error: Error | null;
  filters: InvoiceFilters;
  sort: InvoiceSortOptions;
}

export interface ReconciliationMatch {
  id: string;
  bankTransactionId: string;
  internalRecordId?: string;
  amount: number;
  confidenceScore: number;
  status: 'matched' | 'unmatched' | 'partial';
  createdAt: Date;
  matchedAt?: Date;
}

export interface FinancialMetrics {
  totalRevenue: number;
  outstandingAmount: number;
  overdueAmount: number;
  paidThisMonth: number;
  invoiceCount: number;
  overallDaysOverdue: number;
}

// ─── REDUCER ────────────────────────────────────────────────────────

type InvoiceAction =
  | { type: 'SET_INVOICES'; payload: { invoices: Invoice[]; total: number } }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_FILTERS'; payload: InvoiceFilters }
  | { type: 'SET_SORT'; payload: InvoiceSortOptions }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: Error | null };

const invoicesReducer = (state: InvoicesState, action: InvoiceAction): InvoicesState => {
  switch (action.type) {
    case 'SET_INVOICES':
      return { ...state, invoices: action.payload.invoices, total: action.payload.total };
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    case 'SET_FILTERS':
      return { ...state, filters: action.payload, page: 1 };
    case 'SET_SORT':
      return { ...state, sort: action.payload, page: 1 };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
};

const initialInvoicesState: InvoicesState = {
  invoices: [],
  total: 0,
  page: 1,
  pageSize: 50,
  isLoading: false,
  error: null,
  filters: {},
  sort: { sortBy: 'date', sortOrder: 'desc' },
};

// ─── HOOKS ──────────────────────────────────────────────────────────

/**
 * Hook for managing invoice list with pagination, filtering, and sorting.
 */
export function useInvoices(initialFilters?: InvoiceFilters) {
  const [state, dispatch] = useReducer(invoicesReducer, {
    ...initialInvoicesState,
    filters: initialFilters || {},
  });

  // Fetch invoices when filters or pagination changes
  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: true });

    // Simulate API call
    const timer = setTimeout(() => {
      const mockInvoices: Invoice[] = Array.from({ length: 150 }, (_, i) => ({
        id: `inv_${i + 1}`,
        invoiceNumber: `INV-${String(i + 1).padStart(5, '0')}`,
        customerId: `cust_${(i % 10) + 1}`,
        customerName: [`Acme Corp`, `TechFlow Inc`, `Global Services`, `Prime Logistics`][i % 4],
        amount: Math.random() * 50000 + 1000,
        status: ['draft', 'sent', 'paid', 'overdue', 'void'][i % 5] as any,
        issueDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        subtotal: Math.random() * 45000 + 1000,
        taxAmount: Math.random() * 5000,
      }));

      // Apply filters
      let filtered = mockInvoices;
      if (state.filters.status) {
        filtered = filtered.filter((inv) => inv.status === state.filters.status);
      }
      if (state.filters.searchQuery) {
        filtered = filtered.filter(
          (inv) =>
            inv.invoiceNumber.toLowerCase().includes(state.filters.searchQuery!.toLowerCase()) ||
            inv.customerName.toLowerCase().includes(state.filters.searchQuery!.toLowerCase())
        );
      }

      // Apply sorting
      const sorted = filtered.sort((a, b) => {
        let aVal: any = a[state.sort.sortBy === 'date' ? 'issueDate' : state.sort.sortBy];
        let bVal: any = b[state.sort.sortBy === 'date' ? 'issueDate' : state.sort.sortBy];

        if (typeof aVal === 'string' && !isNaN(Date.parse(aVal))) {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        }

        return state.sort.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });

      // Paginate
      const start = (state.page - 1) * state.pageSize;
      const paginated = sorted.slice(start, start + state.pageSize);

      dispatch({ type: 'SET_INVOICES', payload: { invoices: paginated, total: filtered.length } });
      dispatch({ type: 'SET_LOADING', payload: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [state.page, state.pageSize, state.filters, state.sort]);

  return {
    ...state,
    setPage: (page: number) => dispatch({ type: 'SET_PAGE', payload: page }),
    setFilters: (filters: InvoiceFilters) => dispatch({ type: 'SET_FILTERS', payload: filters }),
    setSort: (sort: InvoiceSortOptions) => dispatch({ type: 'SET_SORT', payload: sort }),
  };
}

/**
 * Hook for payment reconciliation with matching logic.
 */
export function useReconciliation() {
  const [matches, setMatches] = useState<ReconciliationMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const autoReconcile = useCallback(async () => {
    setIsLoading(true);
    try {
      // Simulate auto-match API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock matches with confidence scores
      const mockMatches: ReconciliationMatch[] = [
        {
          id: 'match_1',
          bankTransactionId: 'trans_101',
          internalRecordId: 'inv_1',
          amount: 5000,
          confidenceScore: 0.98,
          status: 'matched',
          createdAt: new Date(),
          matchedAt: new Date(),
        },
        {
          id: 'match_2',
          bankTransactionId: 'trans_102',
          internalRecordId: undefined,
          amount: 3500,
          confidenceScore: 0,
          status: 'unmatched',
          createdAt: new Date(),
        },
      ];

      setMatches(mockMatches);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const matchRecords = useCallback((bankTxnId: string, recordId: string, amount: number) => {
    const existingIndex = matches.findIndex((m) => m.bankTransactionId === bankTxnId);

    if (existingIndex >= 0) {
      const updated = [...matches];
      updated[existingIndex] = {
        ...updated[existingIndex],
        internalRecordId: recordId,
        confidenceScore: 0.95,
        status: 'matched',
        matchedAt: new Date(),
      };
      setMatches(updated);
    } else {
      setMatches([
        ...matches,
        {
          id: `match_${Date.now()}`,
          bankTransactionId: bankTxnId,
          internalRecordId: recordId,
          amount,
          confidenceScore: 0.95,
          status: 'matched',
          createdAt: new Date(),
          matchedAt: new Date(),
        },
      ]);
    }
  }, [matches]);

  const unmatchRecords = useCallback((matchId: string) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId ? { ...m, internalRecordId: undefined, status: 'unmatched', matchedAt: undefined } : m
      )
    );
  }, []);

  return {
    matches,
    isLoading,
    autoReconcile,
    matchRecords,
    unmatchRecords,
  };
}

/**
 * Hook for financial metrics aggregation.
 */
export function useFinancialMetrics(): FinancialMetrics {
  const [metrics, setMetrics] = useState<FinancialMetrics>({
    totalRevenue: 0,
    outstandingAmount: 0,
    overdueAmount: 0,
    paidThisMonth: 0,
    invoiceCount: 0,
    overallDaysOverdue: 0,
  });

  useEffect(() => {
    // Simulate metrics calculation
    const timer = setTimeout(() => {
      setMetrics({
        totalRevenue: 324500,
        outstandingAmount: 45200,
        overdueAmount: 12800,
        paidThisMonth: 85600,
        invoiceCount: 342,
        overallDaysOverdue: 18,
      });
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  return metrics;
}
