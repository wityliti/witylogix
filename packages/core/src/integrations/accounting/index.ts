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

// ─── SDK CLIENTS ────────────────────────────────────────────────────

export { QuickBooksSDKClient, QuickBooksError } from './quickbooks-sdk-client.js';

export type {
  QBInvoice,
  QBPayment,
  QBCustomer,
  QBItem,
  QBBill,
  QBAccount,
  QBBillPayment,
  QBEstimate,
  QBCompanyInfo,
  QBRateLimitInfo,
} from './quickbooks-sdk-client.js';

export { XeroSDKClient, XeroError } from './xero-sdk-client.js';

export type {
  XeroInvoice as XeroSDKInvoice,
  XeroContact,
  XeroPayment,
  XeroBankTransaction,
  XeroItem,
  XeroAccount,
  XeroPurchaseOrder,
  XeroQuote,
  XeroTenant as XeroTenantInfo,
  XeroRateLimitInfo,
} from './xero-sdk-client.js';

// ─── NORMALIZER ─────────────────────────────────────────────────────

export {
  normalizeQBInvoice,
  normalizeXeroInvoice,
  normalizeQBPayment,
  normalizeXeroPayment,
  normalizeQBCustomer,
  normalizeXeroContact,
  normalizeQBItem,
  normalizeXeroItem,
  normalizeQBAccount,
  normalizeXeroAccount,
  denormalizeToQBInvoice,
  denormalizeToXeroInvoice,
  convertCurrency,
  normalizeTaxRate,
  calculateEffectiveTaxRate,
  calculateTaxFromRate,
} from './accounting-normalizer.js';

export type {
  UnifiedInvoice,
  UnifiedPayment,
  UnifiedContact,
  UnifiedItem,
  UnifiedAccount,
  UnifiedLineItem,
} from './accounting-normalizer.js';

// ─── SYNC SERVICE ───────────────────────────────────────────────────

export { AccountingSyncService } from './accounting-sync.js';

export type { SyncOptions, ReconciliationResult } from './accounting-sync.js';
