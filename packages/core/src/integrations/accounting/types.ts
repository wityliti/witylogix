/**
 * Accounting Integration Types
 * Shared types for QuickBooks, Xero, and future accounting providers
 */

import type { Invoice, InvoiceLineItem } from "../../invoicing/types.js";

export type AccountingProvider = "quickbooks" | "xero";

export type SyncStatus = "pending" | "synced" | "failed" | "skipped";

export interface AccountingConnection {
  id: string;
  tenantId: string;
  provider: AccountingProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountId?: string; // QB Realm ID or Xero Org ID
  email?: string; // Customer email used for sync
  isActive: boolean;
  lastSyncAt?: Date;
  syncConfig?: {
    autoSync: boolean;
    syncFrequency?: "hourly" | "daily" | "weekly";
    includeDiscounts: boolean;
    includeTaxes: boolean;
    mapCustomFields?: Record<string, string>;
  };
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncRecord {
  id: string;
  tenantId: string;
  connectionId: string;
  provider: AccountingProvider;
  invoiceId: string;
  externalId?: string; // QB Invoice ID, Xero Invoice ID, etc.
  syncStatus: SyncStatus;
  syncType: "create" | "update" | "sync_payment";
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
  metadata?: {
    queuedAt?: Date;
    startedAt?: Date;
    retryCount?: number;
    lastRetryAt?: Date;
  };
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuickBooksInvoice {
  id?: string; // Internal ID if already synced
  docNumber: string; // Invoice number
  txnDate: string; // ISO date string
  dueDate: string; // ISO date string
  customerRef: {
    value: string; // QB Customer ID
    name?: string;
  };
  billAddr?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  line: Array<{
    id?: string;
    lineNum?: number;
    description: string;
    amount: number;
    detailType: "SalesItemLineDetail" | "DescriptionLineDetail";
    salesItemLineDetail?: {
      itemRef: {
        value: string;
        name?: string;
      };
      qty: number;
      unitPrice?: number;
      taxCodeRef?: {
        value: string;
      };
    };
  }>;
  totalAmt: number;
  balanceAmt: number;
  applyTaxAfterDiscount?: boolean;
  taxCodeRef?: {
    value: string;
  };
  totalTax?: number;
  discountLineDetail?: {
    percentBased: boolean;
    value: number;
  };
  metadata?: Record<string, unknown>;
}

export interface XeroInvoice {
  invoiceNumber: string;
  type: "ACCREC"; // Account receivable (sales invoice)
  status?: "DRAFT" | "SUBMITTED" | "AUTHORISED";
  lineAmountTypes: "Exclusive" | "Inclusive";
  contactId?: string;
  contact?: {
    name: string;
    emailAddress?: string;
    addresses?: Array<{
      addressType: "STREET" | "POBOX";
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
    }>;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitAmount: number;
    accountCode: string;
    taxType?: string;
    taxAmount?: number;
    lineAmount?: number;
    lineItemID?: string;
    tracking?: Array<{
      trackingCategoryName: string;
      trackingOptionName: string;
    }>;
  }>;
  date: string; // ISO date string (YYYY-MM-DD)
  dueDate?: string; // ISO date string
  total: number;
  tax?: number;
  amountPaid?: number;
  amountDue?: number;
  status_attr?: string;
  invoiceID?: string; // Xero internal ID
  metadata?: Record<string, unknown>;
}

export interface AccountingSyncStatus {
  invoiceId: string;
  externalId?: string;
  provider: AccountingProvider;
  status: SyncStatus;
  lastSyncAt?: Date;
  nextRetryAt?: Date;
  retryCount: number;
  errorMessage?: string;
}

export interface AccountingSyncResult {
  success: boolean;
  invoiceId: string;
  externalId?: string;
  provider: AccountingProvider;
  message: string;
  timestamp: Date;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

export interface AccountingError extends Error {
  provider: AccountingProvider;
  code?: string;
  statusCode?: number;
  retryable: boolean;
}
