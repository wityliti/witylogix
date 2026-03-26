/**
 * ERP Integration Types
 * Shared types for SAP, NetSuite, Dynamics 365, Sage, and future ERP providers
 * Supports multi-tenant, bidirectional syncing with conflict resolution
 */

// ─── ENUMS & CONSTANTS ──────────────────────────────────────────────────────

export type ERPProvider = 'sap' | 'netsuite' | 'dynamics365' | 'sage';

export type SyncDirection = 'push' | 'pull' | 'bidirectional';

export type ConflictResolution = 'timestamp' | 'priority' | 'manual' | 'custom';

export type ERPSyncStatus = 'pending' | 'synced' | 'failed' | 'partial' | 'skipped' | 'conflict';

export type SyncEntityType = 'customer' | 'vendor' | 'product' | 'invoice' | 'order' | 'payment' | 'journal_entry' | 'inventory';

export type ERPFieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'currency'
  | 'decimal'
  | 'email'
  | 'phone'
  | 'url'
  | 'select'
  | 'multiselect'
  | 'textarea'
  | 'json';

export enum ConnectionStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  EXPIRED = 'EXPIRED',
  PENDING_AUTH = 'PENDING_AUTH',
}

// ─── CORE ERP ENTITIES ──────────────────────────────────────────────────────

/**
 * ERP Customer/Contact entity
 */
export interface ERPCustomer {
  id?: string; // ERP-specific ID
  externalId?: string; // Witylogix customer ID
  code?: string; // Customer code/number
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  taxId?: string; // VAT/Tax number
  creditLimit?: number;
  paymentTerms?: string;
  currency?: string;
  status?: 'active' | 'inactive' | 'blocked' | 'prospect';
  addresses?: ERPAddress[];
  contacts?: ERPContact[];
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  lastModifiedAt?: Date;
  createdAt?: Date;
}

/**
 * ERP Vendor entity
 */
export interface ERPVendor {
  id?: string;
  externalId?: string;
  code?: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
  currency?: string;
  paymentTerms?: string;
  status?: 'active' | 'inactive' | 'blocked';
  addresses?: ERPAddress[];
  contacts?: ERPContact[];
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  lastModifiedAt?: Date;
  createdAt?: Date;
}

/**
 * ERP Contact/Address information
 */
export interface ERPAddress {
  type?: 'billing' | 'shipping' | 'business' | 'other';
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export interface ERPContact {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  title?: string;
  department?: string;
}

/**
 * ERP Product/Item entity
 */
export interface ERPProduct {
  id?: string;
  externalId?: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string; // e.g., 'EA', 'BOX', 'KG'
  unitPrice?: number;
  cost?: number;
  currency?: string;
  quantity?: number;
  status?: 'active' | 'inactive' | 'discontinued';
  taxCode?: string;
  taxRate?: number;
  hsCode?: string; // Harmonized System code
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  lastModifiedAt?: Date;
  createdAt?: Date;
}

/**
 * ERP Sales Order
 */
export interface ERPOrder {
  id?: string;
  externalId?: string;
  orderNumber: string;
  orderDate: Date;
  dueDate?: Date;
  customerId: string;
  customerName?: string;
  currency?: string;
  status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'completed';
  lineItems: ERPLineItem[];
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  total: number;
  shippingAddress?: ERPAddress;
  billingAddress?: ERPAddress;
  notes?: string;
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  lastModifiedAt?: Date;
  createdAt?: Date;
}

/**
 * ERP Invoice
 */
export interface ERPInvoice {
  id?: string;
  externalId?: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  customerId: string;
  customerName?: string;
  currency?: string;
  status?: 'draft' | 'posted' | 'paid' | 'overdue' | 'cancelled' | 'credit_note';
  invoiceType?: 'sales' | 'purchase' | 'credit_memo' | 'debit_memo';
  lineItems: ERPLineItem[];
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  total: number;
  amountPaid?: number;
  amountDue?: number;
  billingAddress?: ERPAddress;
  shippingAddress?: ERPAddress;
  notes?: string;
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  lastModifiedAt?: Date;
  createdAt?: Date;
}

/**
 * ERP Line Item (for Orders and Invoices)
 */
export interface ERPLineItem {
  lineNumber?: number;
  itemId?: string;
  itemCode?: string;
  itemName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  discountPercent?: number;
  discountAmount?: number;
  taxCode?: string;
  taxRate?: number;
  taxAmount?: number;
  totalAmount: number;
  customFields?: Record<string, unknown>;
}

/**
 * ERP Payment
 */
export interface ERPPayment {
  id?: string;
  externalId?: string;
  referenceNumber?: string;
  paymentDate: Date;
  invoiceId?: string;
  customerId?: string;
  vendorId?: string;
  amount: number;
  currency?: string;
  paymentMethod?: 'cash' | 'check' | 'bank_transfer' | 'credit_card' | 'other';
  status?: 'pending' | 'posted' | 'reconciled' | 'reversed';
  notes?: string;
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

/**
 * ERP Journal Entry / GL Transaction
 */
export interface ERPJournalEntry {
  id?: string;
  externalId?: string;
  referenceNumber?: string;
  transactionDate: Date;
  description?: string;
  currency?: string;
  status?: 'draft' | 'posted' | 'reversed' | 'cancelled';
  lines: ERPJournalLine[];
  totalDebit?: number;
  totalCredit?: number;
  notes?: string;
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export interface ERPJournalLine {
  accountCode: string;
  accountName?: string;
  description?: string;
  debitAmount?: number;
  creditAmount?: number;
  costCenter?: string;
  dimension?: string;
  customFields?: Record<string, unknown>;
}

/**
 * ERP Inventory/Stock
 */
export interface ERPInventory {
  id?: string;
  itemId: string;
  itemCode?: string;
  warehouse?: string;
  quantity: number;
  unit?: string;
  lastCountDate?: Date;
  reorderLevel?: number;
  safetyStock?: number;
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ─── CONFIGURATION & CONNECTION ────────────────────────────────────────────

/**
 * ERP Connection with credentials and configuration
 */
export interface ERPConnection {
  id: string;
  tenantId: string;
  provider: ERPProvider;
  connectionName?: string;
  status: ConnectionStatus;
  credentials: ERPCredentials;
  config: ERPConnectionConfig;
  lastSyncAt?: Date;
  lastHealthCheckAt?: Date;
  syncConfig?: ERPSyncConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Provider-specific credentials (encrypted in database)
 */
export interface ERPCredentials {
  // OAuth2 fields (SAP, Dynamics365, Sage)
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  idToken?: string;

  // Token-based auth (NetSuite)
  tokenId?: string;
  tokenSecret?: string;
  consumerKey?: string;
  consumerSecret?: string;

  // Basic/API key auth
  username?: string;
  password?: string;
  apiKey?: string;
  apiSecret?: string;

  // Instance/realm specific
  instanceUrl?: string; // Salesforce, Dynamics
  realm?: string; // QB, Intuit
  accountId?: string;
  companyId?: string;
  subsidiaryId?: string;
  organizationId?: string;

  // SAP specific
  sapPassport?: string;
  soapEndpoint?: string;
  restEndpoint?: string;

  // Custom metadata
  metadata?: Record<string, unknown>;
}

/**
 * ERP Connection Configuration
 */
export interface ERPConnectionConfig {
  // Connection behavior
  timeout?: number; // ms
  maxRetries?: number;
  retryDelayMs?: number;
  pollIntervalMs?: number;

  // Multi-company/subsidiary support
  defaultCompanyId?: string;
  defaultBranch?: string;
  allowMultiCompany?: boolean;

  // Webhook configuration
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEnabled?: boolean;

  // Sync behavior
  batchSize?: number;
  pageSize?: number;
  rateLimitPerSecond?: number;

  // Custom mappings
  fieldMappings?: Record<string, ERPFieldMapping>;
  entityMappings?: Record<string, unknown>;

  // Advanced options
  customHeaders?: Record<string, string>;
  customParameters?: Record<string, unknown>;
}

/**
 * ERP Sync Configuration
 */
export interface ERPSyncConfig {
  direction: SyncDirection;
  conflictResolution: ConflictResolution;
  enabledEntities: SyncEntityType[];
  disabledEntities?: SyncEntityType[];
  fullSyncIntervalDays?: number;
  deltaSyncIntervalMinutes?: number;
  autoSync?: boolean;
  onConflict?: (record: unknown, local: unknown, remote: unknown) => Promise<unknown>;
  customFieldMappings?: Record<string, string>;
}

/**
 * Field mapping between Witylogix and ERP system
 */
export interface ERPFieldMapping {
  entity: SyncEntityType;
  witylogixField: string;
  erpField: string;
  fieldType: ERPFieldType;
  readOnly?: boolean;
  required?: boolean;
  transform?: {
    direction: 'push' | 'pull' | 'bidirectional';
    encode?: (value: unknown) => unknown;
    decode?: (value: unknown) => unknown;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Tax Rate definition
 */
export interface TaxRate {
  id?: string;
  code: string;
  name: string;
  rate: number; // 0-100
  type?: 'standard' | 'reduced' | 'zero' | 'exempt';
  country?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Currency configuration
 */
export interface Currency {
  code: string; // ISO 4217, e.g., 'USD', 'EUR'
  name: string;
  symbol?: string;
  decimalPlaces?: number;
  isDefault?: boolean;
}

/**
 * GL Account
 */
export interface Account {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'cost_of_goods_sold';
  status?: 'active' | 'inactive';
  description?: string;
  parent?: string; // Parent account code
}

/**
 * Cost Center / Dimension
 */
export interface CostCenter {
  code: string;
  name: string;
  description?: string;
  status?: 'active' | 'inactive';
  parent?: string;
}

// ─── SYNC & OPERATIONS ──────────────────────────────────────────────────────

/**
 * Sync operation status
 */
export interface ERPSyncStatus {
  id: string;
  connectionId: string;
  entityType: SyncEntityType;
  recordId: string;
  externalId?: string;
  status: ERPSyncStatus;
  direction: SyncDirection;
  syncedAt?: Date;
  nextRetryAt?: Date;
  retryCount: number;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
}

/**
 * Batch operation result
 */
export interface ERPBatchResult<T = unknown> {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  results: Array<{
    recordId: string;
    externalId?: string;
    status: 'success' | 'failed' | 'skipped';
    data?: T;
    error?: string;
  }>;
  duration: number; // ms
}

/**
 * ERP operation error
 */
export interface ERPOperationError extends Error {
  provider: ERPProvider;
  code?: string;
  statusCode?: number;
  retryable: boolean;
  details?: Record<string, unknown>;
}

/**
 * Webhook payload for ERP events
 */
export interface ERPWebhookPayload {
  eventType: string;
  entityType: SyncEntityType;
  action: 'create' | 'update' | 'delete';
  recordId: string;
  externalId?: string;
  data: Record<string, unknown>;
  timestamp: Date;
  signature?: string; // HMAC signature for verification
}

/**
 * Webhook registration
 */
export interface ERPWebhookRegistration {
  id?: string;
  connectionId: string;
  url: string;
  secret?: string;
  events: string[]; // e.g., ['customer.created', 'invoice.updated']
  isActive: boolean;
  lastTriggeredAt?: Date;
  failureCount?: number;
  createdAt?: Date;
}

// ─── HELPER TYPES ──────────────────────────────────────────────────────────

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfter?: number; // Seconds to wait before retry
}

export interface PaginationParams {
  skip?: number;
  limit?: number;
  offset?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
  pageToken?: string;
}
