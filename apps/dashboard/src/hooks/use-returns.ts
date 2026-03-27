'use client';

/**
 * Return-specific API hooks for the dashboard
 */

import { useApiMutation, useApiList, useApiQuery, ApiFilters, UseApiQueryResult, UseApiMutationResult, UseApiListResult } from './use-api';

/**
 * Return status enum
 */
export enum ReturnStatus {
  INITIATED = 'initiated',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  RECEIVED = 'received',
  REFUNDED = 'refunded',
}

/**
 * Return type
 */
export interface Return {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  status: ReturnStatus | string;
  reason: string;
  description?: string;
  items: ReturnItem[];
  totalRefundAmount?: number;
  refundAmount?: number;
  refundStatus?: 'pending' | 'processed' | 'failed';
  refundDate?: string;
  createdAt: string;
  updatedAt?: string;
  initiatedAt?: string;
  requestedAt?: string;
  approvedAt?: string;
  receivedAt?: string;
  refundedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  pickupDate?: string;
  notes?: string | null;
  timeline?: unknown[];
}

/**
 * Return item
 */
export interface ReturnItem {
  id: string;
  orderItemId?: string;
  productId?: string;
  productName?: string;
  name?: string;
  quantity: number;
  unitPrice?: number;
  condition: string;
  refundAmount?: number;
}

/**
 * Return statistics
 */
export interface ReturnStats {
  totalReturns: number;
  pendingApprovals: number;
  approvedReturns: number;
  refundedReturns: number;
  totalRefunded: number;
  averageRefundAmount: number;
  returnRate: number;
  topReturnReasons: Array<{
    reason: string;
    count: number;
  }>;
}

/**
 * Return filters
 */
export interface ReturnFilters extends ApiFilters {
  status?: ReturnStatus;
  customerId?: string;
  orderId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Hook to fetch paginated returns with filtering and sorting
 * @param filters - Return filter options
 * @returns List of returns with pagination
 */
export function useReturns(
  filters?: ReturnFilters,
): UseApiListResult<Return> {
  return useApiList<Return>('/api/v4/returns', filters);
}

/**
 * Hook to fetch a single return by ID
 * @param id - Return ID
 * @returns Single return
 */
export function useReturn(
  id: string | null,
): UseApiQueryResult<Return> {
  return useApiQuery<Return>(id ? `/returns/${id}` : null);
}

/**
 * Hook to approve a return
 * @param id - Return ID
 * @returns Mutation to approve return
 */
export function useApproveReturn(
  id: string,
): UseApiMutationResult<Return> {
  return useApiMutation<Return>('PATCH', `/returns/${id}/approve`);
}

/**
 * Hook to reject a return
 * @param id - Return ID
 * @returns Mutation to reject return
 */
export function useRejectReturn(
  id: string,
): UseApiMutationResult<Return> {
  return useApiMutation<Return>('PATCH', `/returns/${id}/reject`);
}

/**
 * Hook to process refund for a return
 * @param id - Return ID
 * @returns Mutation to process refund
 */
export function useProcessRefund(
  id: string,
): UseApiMutationResult<Return> {
  return useApiMutation<Return>('POST', `/returns/${id}/refund`);
}

/**
 * Hook to fetch return statistics for dashboard widgets
 * @returns Return stats (totals, rates, top reasons)
 */
export function useReturnStats(): UseApiQueryResult<ReturnStats> {
  return useApiQuery<ReturnStats>('/api/v4/returns/stats');
}
