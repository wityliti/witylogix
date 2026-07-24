"use client";

import {
  useApiMutation,
  useApiList,
  useApiQuery,
  ApiFilters,
  UseApiQueryResult,
  UseApiMutationResult,
  UseApiListResult,
} from "./use-api";

export enum ReturnStatus {
  INITIATED = "initiated",
  APPROVED = "approved",
  REJECTED = "rejected",
  PICKED_UP = "picked_up",
  IN_TRANSIT = "in_transit",
  RECEIVED = "received",
  INSPECTED = "inspected",
  REFUNDED = "refunded",
}

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

export interface ReturnOrder {
  id: string;
  externalOrderNumber?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  totalPrice?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
}

export interface Return {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  status: ReturnStatus | string;
  reason: string;
  reasonDetails?: string;
  description?: string;
  items: ReturnItem[];
  totalRefundAmount?: number;
  refundAmount?: number;
  restockingFee?: number;
  refundStatus?: "pending" | "processed" | "failed";
  refundDate?: string;
  shippingLabelUrl?: string | null;
  trackingNumber?: string | null;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  receivedAt?: string | null;
  refundedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  pickupDate?: string | null;
  notes?: string | null;
  order?: ReturnOrder | null;
}

export interface ReturnStats {
  counts: {
    requested: number;
    approved: number;
    rejected: number;
    received: number;
    inspected: number;
    refunded: number;
    closed: number;
  };
  totalRefundAmount: number;
  totalReturns: number;
}

export interface ReturnFilters extends ApiFilters {
  status?: ReturnStatus | string;
  customerId?: string;
  orderId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useReturns(filters?: ReturnFilters): UseApiListResult<Return> {
  return useApiList<Return>("/api/v4/returns", filters);
}

export function useReturn(id: string | null): UseApiQueryResult<Return> {
  return useApiQuery<Return>(id ? `/api/v4/returns/${id}` : null);
}

export function useApproveReturn(id: string): UseApiMutationResult<Return> {
  return useApiMutation<Return>("POST", `/api/v4/returns/${id}/approve`);
}

export function useRejectReturn(id: string): UseApiMutationResult<Return> {
  return useApiMutation<Return>("POST", `/api/v4/returns/${id}/reject`);
}

export function useReceiveReturn(id: string): UseApiMutationResult<Return> {
  return useApiMutation<Return>("POST", `/api/v4/returns/${id}/receive`);
}

export function useInspectReturn(id: string): UseApiMutationResult<Return> {
  return useApiMutation<Return>("POST", `/api/v4/returns/${id}/inspect`);
}

export function useProcessRefund(id: string): UseApiMutationResult<Return> {
  return useApiMutation<Return>("POST", `/api/v4/returns/${id}/refund`);
}

export function useReturnStats(): UseApiQueryResult<ReturnStats> {
  return useApiQuery<ReturnStats>("/api/v4/returns/stats");
}
