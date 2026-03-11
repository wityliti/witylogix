/**
 * Accounting Integration Barrel Export
 * Unified access point for accounting integrations (QB, Xero, etc.)
 */

// ─── TYPES ──────────────────────────────────────────────────────────

export type {
  AccountingProvider,
  SyncStatus,
  AccountingConnection,
  SyncRecord,
  QuickBooksInvoice,
  XeroInvoice,
  AccountingSyncStatus,
  AccountingSyncResult,
  RateLimitInfo,
  AccountingError,
} from './types.js';

// ─── ADAPTERS ───────────────────────────────────────────────────────

export { QuickBooksAdapter, createQuickBooksConfig } from './quickbooks-adapter.js';

export type { QuickBooksConfig, QBAuthResponse } from './quickbooks-adapter.js';

export { XeroAdapter, createXeroConfig } from './xero-adapter.js';

export type { XeroConfig, XeroAuthResponse, XeroTenant } from './xero-adapter.js';

// ─── SYNC SERVICE ───────────────────────────────────────────────────

export { AccountingSyncService } from './accounting-sync.js';

export type { SyncOptions, ReconciliationResult } from './accounting-sync.js';
