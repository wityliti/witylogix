/**
 * Invoice Service Barrel Export
 * Unified access point for invoicing functionality
 */

// ─── TYPES ──────────────────────────────────────────────────────────

export type {
  Invoice,
  InvoiceLineItem,
  InvoiceDiscount,
  InvoiceTax,
  PaymentRecord,
  RateCard,
  CostBreakdown,
  DeliveryForCosting,
  CreateInvoiceParams,
  UpdateInvoiceParams,
  MarkAsPaidParams,
  InvoiceSummary,
  InvoiceDetailedSummary,
  TaxConfig,
  DistanceTier,
  WeightTier,
  SpecialHandlingSurcharge,
  InvoiceStatus,
  DiscountType,
  PaymentMethod,
} from './types.js';

export {
  InvoiceError,
  InvoiceNotFoundError,
  InvalidInvoiceStateError,
  RateCardNotFoundError,
  DeliveryNotFoundError,
} from './types.js';

// ─── SERVICES ───────────────────────────────────────────────────────

export { InvoiceService } from './invoice-service.js';
export { calculateDeliveryCost, calculateBatchCost } from './cost-calculator.js';
export { generateInvoiceNumber, getNextInvoiceNumber, resetInvoiceCounter, updateInvoicePrefix } from './invoice-number.js';
export { generateInvoicePDF } from './pdf-generator.js';
