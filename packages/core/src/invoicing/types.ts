/**
 * Invoice Service Type Definitions
 * Shared types for invoicing operations across service, API, and tests
 */

// ─── INVOICE TYPES ──────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'finalized' | 'sent' | 'paid' | 'overdue' | 'voided';

export type DiscountType = 'percentage' | 'fixed';

export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'check' | 'cash' | 'other';

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  deliveryId?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface InvoiceDiscount {
  id: string;
  invoiceId: string;
  description: string;
  type: DiscountType;
  value: number;
  amount: number;
  createdAt: Date;
}

export interface InvoiceTax {
  id: string;
  invoiceId: string;
  description: string;
  rate: number;
  amount: number;
  jurisdiction?: string;
  createdAt: Date;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paidAt: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface Invoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  customerId?: string;
  status: InvoiceStatus;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  issuedAt: Date;
  dueAt: Date;
  paidAt?: Date;
  voidedAt?: Date;
  voidReason?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  lineItems?: InvoiceLineItem[];
  discounts?: InvoiceDiscount[];
  taxes?: InvoiceTax[];
  payments?: PaymentRecord[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── RATE CARD TYPES ────────────────────────────────────────────────

export interface DistanceTier {
  minKm: number;
  maxKm: number | null; // null = no upper limit
  rateMultiplier: number; // 1.0 = base rate, 1.5 = 150% of base rate
}

export interface WeightTier {
  minKg: number;
  maxKg: number | null; // null = no upper limit
  ratePerKg: number;
}

export interface SpecialHandlingSurcharge {
  fragile?: number; // percentage
  refrigerated?: number; // percentage
  oversized?: number; // percentage
}

export interface RateCard {
  id: string;
  tenantId: string;
  name: string;
  baseRate: number;
  perKmRate: number;
  perKgRate: number;
  distanceTiers: DistanceTier[];
  weightTiers: WeightTier[];
  peakSurchargePct: number;
  fuelSurchargePct: number;
  specialHandling: SpecialHandlingSurcharge;
  minimumCharge: number;
  isDefault: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── COST BREAKDOWN TYPES ───────────────────────────────────────────

export interface CostBreakdown {
  baseCharge: number;
  distanceSurcharge: number;
  weightSurcharge: number;
  timePremium: number;
  fuelSurcharge: number;
  specialHandling: number;
  subtotal: number;
  minimumCharge: number;
  finalCharge: number;
}

// ─── DELIVERY/ORDER REFERENCE FOR COSTING ──────────────────────────

export interface DeliveryForCosting {
  id: string;
  distanceKm: number;
  weightKg: number;
  pickupTime: Date;
  deliveryTime?: Date;
  specialHandling?: {
    fragile: boolean;
    refrigerated: boolean;
    oversized: boolean;
  };
  metadata?: Record<string, unknown>;
}

// ─── TAX CONFIGURATION ──────────────────────────────────────────────

export interface TaxConfig {
  jurisdiction: string;
  rate: number; // e.g., 0.075 for 7.5%
  description?: string;
}

export interface TaxBreakdown {
  configs: TaxConfig[];
  total: number;
  items: InvoiceTax[];
}

// ─── CREATION/UPDATE PARAMETERS ────────────────────────────────────

export interface CreateInvoiceParams {
  tenantId: string;
  customerId?: string;
  deliveryIds?: string[]; // Create from Order/RouteStop IDs
  routeIds?: string[]; // Create from Route IDs (all stops)
  dueDate?: Date; // Default: 30 days from issue
  currency?: string; // Default: USD
  notes?: string;
  discounts?: {
    description: string;
    type: DiscountType;
    value: number;
  }[];
  taxConfig?: TaxConfig[]; // Override default tax
  rateCardId?: string; // Use specific rate card, else use default
  metadata?: Record<string, unknown>;
}

export interface UpdateInvoiceParams {
  notes?: string;
  metadata?: Record<string, unknown>;
  discounts?: {
    description: string;
    type: DiscountType;
    value: number;
  }[];
  dueDate?: Date;
}

export interface MarkAsPaidParams {
  amount: number;
  method: PaymentMethod;
  reference?: string;
  metadata?: Record<string, unknown>;
}

// ─── SUMMARY & REPORTING ────────────────────────────────────────────

export interface InvoiceSummary {
  tenantId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  totalInvoices: number;
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
  totalVoided: number;
  byStatus: {
    draft: number;
    finalized: number;
    sent: number;
    paid: number;
    overdue: number;
    voided: number;
  };
  byCurrency: Record<string, number>;
  averageInvoiceAmount: number;
  paymentRate: number; // percentage of finalized invoices paid
}

export interface InvoiceDetailedSummary extends InvoiceSummary {
  invoices: Invoice[];
  outstandingByCustomer: Array<{
    customerId: string;
    amount: number;
    daysOverdue: number;
  }>;
}

// ─── ERROR TYPES ────────────────────────────────────────────────────

export class InvoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceError';
  }
}

export class InvoiceNotFoundError extends InvoiceError {
  constructor(invoiceId: string) {
    super(`Invoice not found: ${invoiceId}`);
    this.name = 'InvoiceNotFoundError';
  }
}

export class InvalidInvoiceStateError extends InvoiceError {
  constructor(invoiceId: string, currentStatus: InvoiceStatus, operation: string) {
    super(`Cannot ${operation} invoice ${invoiceId} in status ${currentStatus}`);
    this.name = 'InvalidInvoiceStateError';
  }
}

export class RateCardNotFoundError extends InvoiceError {
  constructor(rateCardId: string) {
    super(`Rate card not found: ${rateCardId}`);
    this.name = 'RateCardNotFoundError';
  }
}

export class DeliveryNotFoundError extends InvoiceError {
  constructor(deliveryId: string) {
    super(`Delivery/Order not found: ${deliveryId}`);
    this.name = 'DeliveryNotFoundError';
  }
}
