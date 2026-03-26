/**
 * Accounting Normalizer
 *
 * Converts QuickBooks and Xero data to unified internal types,
 * enabling provider-agnostic invoice, payment, and contact handling.
 *
 * Features:
 * - Invoice/payment/contact normalization
 * - Status mapping (QB → Xero → Witylogix)
 * - Currency conversion helpers
 * - Tax rate normalization
 * - Unified type definitions
 */

import type {
  QBInvoice,
  QBPayment,
  QBCustomer,
  QBItem,
  QBAccount,
} from './quickbooks-sdk-client.js';

import type {
  XeroInvoice,
  XeroContact,
  XeroPayment,
  XeroBankTransaction,
  XeroItem,
  XeroAccount,
} from './xero-sdk-client.js';

// ─── UNIFIED TYPES ──────────────────────────────────────────────────

export interface UnifiedInvoice {
  id: string;
  number: string;
  provider: 'quickbooks' | 'xero';
  providerId: string;
  status: 'draft' | 'submitted' | 'paid' | 'voided' | 'overdue';
  date: Date;
  dueDate?: Date;
  contact: UnifiedContact;
  lineItems: UnifiedLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  currencyCode: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UnifiedPayment {
  id: string;
  provider: 'quickbooks' | 'xero';
  providerId: string;
  invoiceId: string;
  amount: number;
  date: Date;
  reference?: string;
  status: 'pending' | 'authorized' | 'completed' | 'refunded';
  currencyCode: string;
  metadata?: Record<string, unknown>;
}

export interface UnifiedContact {
  id: string;
  provider: 'quickbooks' | 'xero';
  providerId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  status: 'active' | 'archived';
  taxId?: string;
  metadata?: Record<string, unknown>;
}

export interface UnifiedItem {
  id: string;
  provider: 'quickbooks' | 'xero';
  providerId: string;
  code: string;
  name: string;
  description?: string;
  unitPrice: number;
  type: 'service' | 'inventory' | 'non_inventory';
  accountCode?: string;
  taxType?: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

export interface UnifiedAccount {
  id: string;
  provider: 'quickbooks' | 'xero';
  providerId: string;
  code: string;
  name: string;
  type: string;
  balance: number;
  status: 'active' | 'archived';
  taxType?: string;
  metadata?: Record<string, unknown>;
}

export interface UnifiedLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxType?: string;
  taxAmount: number;
  accountCode?: string;
}

// ─── STATUS MAPPING ─────────────────────────────────────────────────

const QB_STATUS_MAP: Record<string, string> = {
  'DRAFT': 'draft',
  'SUBMITTED': 'submitted',
  'OPEN': 'submitted',
  'PAID': 'paid',
  'VOIDED': 'voided',
  'DELETED': 'voided',
  'OVERDUE': 'overdue',
};

const XERO_STATUS_MAP: Record<string, string> = {
  'DRAFT': 'draft',
  'SUBMITTED': 'submitted',
  'AUTHORISED': 'submitted',
  'PAID': 'paid',
  'VOIDED': 'voided',
  'DELETED': 'voided',
};

// ─── INVOICE NORMALIZATION ──────────────────────────────────────────

/**
 * Normalize QuickBooks invoice to unified format
 */
export function normalizeQBInvoice(
  invoice: QBInvoice,
  contact?: QBCustomer
): UnifiedInvoice {
  const status = normalizeQBInvoiceStatus(
    invoice.metadata?.status as string
  );
  const lineItems = invoice.line.map((line, idx) =>
    normalizeLineItem(line, idx)
  );

  const amountPaid = invoice.totalAmt - (invoice.balanceAmt ?? 0);

  return {
    id: `qb_${invoice.id}`,
    number: invoice.docNumber,
    provider: 'quickbooks',
    providerId: invoice.id || '',
    status,
    date: new Date(invoice.txnDate),
    dueDate: invoice.dueDate ? new Date(invoice.dueDate) : undefined,
    contact: contact
      ? normalizeQBCustomer(contact)
      : {
        id: `qb_${invoice.customerRef.value}`,
        provider: 'quickbooks',
        providerId: invoice.customerRef.value,
        name: invoice.customerRef.name || '',
        status: 'active',
      },
    lineItems,
    subtotal: invoice.totalAmt - (invoice.totalTax ?? 0),
    tax: invoice.totalTax ?? 0,
    total: invoice.totalAmt,
    amountPaid,
    amountDue: invoice.balanceAmt ?? 0,
    currencyCode: invoice.metadata?.currencyCode as string || 'USD',
    notes: invoice.metadata?.notes as string,
    metadata: invoice.metadata,
  };
}

/**
 * Normalize Xero invoice to unified format
 */
export function normalizeXeroInvoice(
  invoice: XeroInvoice,
  contact?: XeroContact
): UnifiedInvoice {
  const status = normalizeXeroInvoiceStatus(invoice.status);
  const lineItems = invoice.lineItems.map((line, idx) =>
    normalizeXeroLineItem(line, idx)
  );

  return {
    id: `xero_${invoice.invoiceID}`,
    number: invoice.invoiceNumber,
    provider: 'xero',
    providerId: invoice.invoiceID || '',
    status,
    date: new Date(invoice.date),
    dueDate: invoice.dueDate ? new Date(invoice.dueDate) : undefined,
    contact: contact
      ? normalizeXeroContact(contact)
      : {
        id: `xero_${invoice.contactId}`,
        provider: 'xero',
        providerId: invoice.contactId || '',
        name: invoice.contact?.name || '',
        status: 'active',
      },
    lineItems,
    subtotal: (invoice.total ?? 0) - (invoice.tax ?? 0),
    tax: invoice.tax ?? 0,
    total: invoice.total ?? 0,
    amountPaid: invoice.amountPaid ?? 0,
    amountDue: invoice.amountDue ?? 0,
    currencyCode: invoice.metadata?.currencyCode as string || 'USD',
    notes: invoice.metadata?.notes as string,
    metadata: invoice.metadata,
  };
}

// ─── PAYMENT NORMALIZATION ──────────────────────────────────────────

/**
 * Normalize QuickBooks payment to unified format
 */
export function normalizeQBPayment(payment: QBPayment): UnifiedPayment {
  const linkedInvoice = payment.line[0]?.linkedTxn[0];

  return {
    id: `qb_${payment.id}`,
    provider: 'quickbooks',
    providerId: payment.id || '',
    invoiceId: linkedInvoice?.txnId || '',
    amount: payment.totalAmt,
    date: new Date(payment.txnDate),
    reference: payment.metadata?.reference as string,
    status: normalizePaymentStatus(payment.metadata?.status as string),
    currencyCode: payment.metadata?.currencyCode as string || 'USD',
    metadata: payment.metadata,
  };
}

/**
 * Normalize Xero payment to unified format
 */
export function normalizeXeroPayment(payment: XeroPayment): UnifiedPayment {
  return {
    id: `xero_${payment.paymentID}`,
    provider: 'xero',
    providerId: payment.paymentID || '',
    invoiceId: payment.invoiceID,
    amount: payment.amount,
    date: new Date(payment.date),
    reference: payment.reference,
    status: normalizePaymentStatus(payment.status),
    currencyCode: payment.currencyCode || 'USD',
    metadata: {},
  };
}

// ─── CONTACT NORMALIZATION ──────────────────────────────────────────

/**
 * Normalize QuickBooks customer to unified format
 */
export function normalizeQBCustomer(customer: QBCustomer): UnifiedContact {
  return {
    id: `qb_${customer.id}`,
    provider: 'quickbooks',
    providerId: customer.id || '',
    name: customer.displayName,
    email: customer.primaryEmailAddr?.address,
    phone: customer.primaryPhone?.freeFormNumber,
    address: customer.billingAddr
      ? {
        line1: customer.billingAddr.line1,
        line2: customer.billingAddr.line2,
        city: customer.billingAddr.city,
        state: customer.billingAddr.state,
        postalCode: customer.billingAddr.postalCode,
        country: customer.billingAddr.country,
      }
      : undefined,
    status: 'active',
    taxId: customer.metadata?.taxId as string,
    metadata: customer.metadata,
  };
}

/**
 * Normalize Xero contact to unified format
 */
export function normalizeXeroContact(contact: XeroContact): UnifiedContact {
  const streetAddr = contact.addresses?.find(a => a.addressType === 'STREET');
  const phone = contact.phones?.[0]?.phoneNumber;

  return {
    id: `xero_${contact.contactID}`,
    provider: 'xero',
    providerId: contact.contactID || '',
    name: contact.name,
    email: contact.emailAddress || contact.primaryPerson?.emailAddress,
    phone,
    address: streetAddr
      ? {
        line1: streetAddr.line1,
        line2: streetAddr.line2,
        city: streetAddr.city,
        state: streetAddr.region,
        postalCode: streetAddr.postalCode,
        country: streetAddr.country,
      }
      : undefined,
    status: normalizeContactStatus(contact.contactStatus),
    taxId: contact.taxNumber,
    metadata: {},
  };
}

// ─── ITEM NORMALIZATION ─────────────────────────────────────────────

/**
 * Normalize QuickBooks item to unified format
 */
export function normalizeQBItem(item: QBItem): UnifiedItem {
  return {
    id: `qb_${item.id}`,
    provider: 'quickbooks',
    providerId: item.id || '',
    code: item.name,
    name: item.name,
    description: item.description,
    unitPrice: item.unitPrice ?? 0,
    type: normalizeItemType(item.type),
    accountCode: item.incomeAccountRef?.value,
    taxType: item.metadata?.taxType as string,
    quantity: item.qtyOnHand,
    metadata: item.metadata,
  };
}

/**
 * Normalize Xero item to unified format
 */
export function normalizeXeroItem(item: XeroItem): UnifiedItem {
  return {
    id: `xero_${item.itemID}`,
    provider: 'xero',
    providerId: item.itemID || '',
    code: item.code,
    name: item.code,
    description: item.description,
    unitPrice: item.salesDetails?.unitAmount ?? item.unitAmount ?? 0,
    type: 'non_inventory',
    accountCode: item.accountCode,
    taxType: item.salesDetails?.taxType,
    quantity: item.quantity,
    metadata: {},
  };
}

// ─── ACCOUNT NORMALIZATION ──────────────────────────────────────────

/**
 * Normalize QuickBooks account to unified format
 */
export function normalizeQBAccount(account: QBAccount): UnifiedAccount {
  return {
    id: `qb_${account.id}`,
    provider: 'quickbooks',
    providerId: account.id,
    code: account.id,
    name: account.name,
    type: account.type,
    balance: account.currentBalance,
    status: account.active ? 'active' : 'archived',
    taxType: account.metadata?.taxType as string,
    metadata: account.metadata,
  };
}

/**
 * Normalize Xero account to unified format
 */
export function normalizeXeroAccount(account: XeroAccount): UnifiedAccount {
  return {
    id: `xero_${account.accountID}`,
    provider: 'xero',
    providerId: account.accountID,
    code: account.code,
    name: account.name,
    type: account.type,
    balance: account.currentBalance,
    status: account.status === 'ACTIVE' ? 'active' : 'archived',
    taxType: account.taxType,
    metadata: {},
  };
}

// ─── DENORMALIZATION (for syncing back) ────────────────────────────

/**
 * Convert unified invoice to QuickBooks format
 */
export function denormalizeToQBInvoice(unified: UnifiedInvoice): QBInvoice {
  return {
    id: unified.providerId,
    docNumber: unified.number,
    txnDate: unified.date.toISOString(),
    dueDate: unified.dueDate?.toISOString() || '',
    customerRef: {
      value: unified.contact.providerId,
      name: unified.contact.name,
    },
    line: unified.lineItems.map(item => ({
      description: item.description,
      amount: item.amount,
      detailType: 'SalesItemLineDetail',
      salesItemLineDetail: {
        itemRef: { value: item.accountCode || '' },
        qty: item.quantity,
        unitPrice: item.unitPrice,
      },
    })),
    totalAmt: unified.total,
    totalTax: unified.tax,
    metadata: { currencyCode: unified.currencyCode },
  };
}

/**
 * Convert unified invoice to Xero format
 */
export function denormalizeToXeroInvoice(unified: UnifiedInvoice): XeroInvoice {
  return {
    invoiceNumber: unified.number,
    type: 'ACCREC',
    lineAmountTypes: 'Exclusive',
    contactId: unified.contact.providerId,
    contact: {
      name: unified.contact.name,
      emailAddress: unified.contact.email,
    },
    lineItems: unified.lineItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitAmount: item.unitPrice,
      accountCode: item.accountCode || '200',
      taxType: item.taxType,
      taxAmount: item.taxAmount,
    })),
    date: unified.date.toISOString().split('T')[0],
    dueDate: unified.dueDate?.toISOString().split('T')[0],
    total: unified.total,
    tax: unified.tax,
    metadata: { currencyCode: unified.currencyCode },
  };
}

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────

function normalizeQBInvoiceStatus(status?: string): UnifiedInvoice['status'] {
  if (!status) return 'submitted';
  return (QB_STATUS_MAP[status] || 'submitted') as UnifiedInvoice['status'];
}

function normalizeXeroInvoiceStatus(status?: string): UnifiedInvoice['status'] {
  if (!status) return 'submitted';
  return (XERO_STATUS_MAP[status] || 'submitted') as UnifiedInvoice['status'];
}

function normalizePaymentStatus(status?: string): UnifiedPayment['status'] {
  const statusMap: Record<string, UnifiedPayment['status']> = {
    'DRAFT': 'pending',
    'SUBMITTED': 'pending',
    'AUTHORISED': 'authorized',
    'PAID': 'completed',
    'REFUNDED': 'refunded',
    'OPEN': 'pending',
  };
  return statusMap[status || ''] || 'pending';
}

function normalizeContactStatus(status?: string): UnifiedContact['status'] {
  return status === 'ARCHIVED' ? 'archived' : 'active';
}

function normalizeItemType(type: string): UnifiedItem['type'] {
  const typeMap: Record<string, UnifiedItem['type']> = {
    'Service': 'service',
    'Inventory': 'inventory',
    'NonInventory': 'non_inventory',
  };
  return typeMap[type] || 'service';
}

function normalizeLineItem(
  line: QBInvoice['line'][0],
  index: number
): UnifiedLineItem {
  return {
    id: String(index),
    description: line.description,
    quantity: line.salesItemLineDetail?.qty ?? 1,
    unitPrice: line.salesItemLineDetail?.unitPrice ?? 0,
    amount: line.amount,
    taxType: line.salesItemLineDetail?.taxCodeRef?.value,
    taxAmount: 0,
    accountCode: line.salesItemLineDetail?.itemRef.value,
  };
}

function normalizeXeroLineItem(
  line: XeroInvoice['lineItems'][0],
  index: number
): UnifiedLineItem {
  return {
    id: line.lineItemID || String(index),
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitAmount,
    amount: line.lineAmount ?? 0,
    taxType: line.taxType,
    taxAmount: line.taxAmount ?? 0,
    accountCode: line.accountCode,
  };
}

// ─── CURRENCY CONVERSION ────────────────────────────────────────────

/**
 * Convert amount from source to target currency (requires live rates)
 * This is a placeholder - real implementation would use exchange rate API
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRates?: Map<string, number>
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  if (!exchangeRates) {
    throw new Error('Exchange rates not provided');
  }

  const rate = exchangeRates.get(`${fromCurrency}/${toCurrency}`);
  if (!rate) {
    throw new Error(
      `No exchange rate available for ${fromCurrency}/${toCurrency}`
    );
  }

  return amount * rate;
}

// ─── TAX NORMALIZATION ──────────────────────────────────────────────

/**
 * Normalize tax rates between providers
 */
export function normalizeTaxRate(
  rate: number,
  provider: 'quickbooks' | 'xero'
): number {
  // Both QB and Xero use percentage (e.g., 8.5 for 8.5%)
  // If provider needs different handling, adjust here
  return rate;
}

/**
 * Calculate effective tax rate
 */
export function calculateEffectiveTaxRate(
  total: number,
  taxAmount: number
): number {
  if (total === 0) return 0;
  return (taxAmount / total) * 100;
}

/**
 * Calculate tax from subtotal and rate
 */
export function calculateTaxFromRate(
  subtotal: number,
  taxRate: number
): number {
  return (subtotal * taxRate) / 100;
}
