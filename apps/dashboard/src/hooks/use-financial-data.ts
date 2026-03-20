'use client';

import { useApiList, useApiQuery, useApiMutation, ApiFilters, UseApiQueryResult, UseApiListResult, UseApiMutationResult } from './use-api';

// ─── TYPES ──────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: 'bank_transfer' | 'credit_card' | 'cash' | 'check';
  status: 'pending' | 'completed' | 'failed';
  transactionDate: string;
}

export interface ReconciliationMatch {
  id: string;
  bankTransactionId: string;
  internalRecordId?: string;
  amount: number;
  confidenceScore: number;
  status: 'matched' | 'unmatched' | 'partial';
  createdAt: string;
  matchedAt?: string;
}

export interface FinancialMetrics {
  totalRevenue: number;
  outstandingAmount: number;
  overdueAmount: number;
  paidThisMonth: number;
  invoiceCount: number;
  overallDaysOverdue: number;
}

// ─── HOOKS ──────────────────────────────────────────────────────────

export function useInvoices(filters?: ApiFilters): UseApiListResult<Invoice> {
  return useApiList<Invoice>('/api/v4/invoices', filters);
}

export function useInvoice(id: string | null): UseApiQueryResult<Invoice> {
  return useApiQuery<Invoice>(id ? `/api/v4/invoices/${id}` : null);
}

export function useCreateInvoice(): UseApiMutationResult<Invoice> {
  return useApiMutation<Invoice>('POST', '/api/v4/invoices');
}

export function useUpdateInvoice(id: string): UseApiMutationResult<Invoice> {
  return useApiMutation<Invoice>('PATCH', `/api/v4/invoices/${id}`);
}

export function usePayments(filters?: ApiFilters): UseApiListResult<Payment> {
  return useApiList<Payment>('/api/v4/payments', filters);
}

export function useCreatePayment(): UseApiMutationResult<Payment> {
  return useApiMutation<Payment>('POST', '/api/v4/payments');
}

export function useReconciliationMatches(filters?: ApiFilters): UseApiListResult<ReconciliationMatch> {
  return useApiList<ReconciliationMatch>('/api/v4/reconciliation/matches', filters);
}

export function useAutoReconcile(): UseApiMutationResult<ReconciliationMatch[]> {
  return useApiMutation<ReconciliationMatch[]>('POST', '/api/v4/reconciliation/auto-match');
}

export function useMatchRecords(matchId: string): UseApiMutationResult<ReconciliationMatch> {
  return useApiMutation<ReconciliationMatch>('PATCH', `/api/v4/reconciliation/matches/${matchId}`);
}

export function useFinancialMetrics(): UseApiQueryResult<FinancialMetrics> {
  return useApiQuery<FinancialMetrics>('/api/v4/financial/metrics');
}
