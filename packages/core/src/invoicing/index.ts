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

// ─── BILLING RULES ENGINE ───────────────────────────────────────────

export {
  BillingRuleEngine,
  createBillingRule,
  createSurcharge,
  createTier,
} from './billing-rules.js';

export type {
  BillingRule,
  BillingRuleType,
  BillingContext,
  Tier,
  Surcharge,
  SubscriptionPlan,
  LineItemWithMetadata,
} from './billing-rules.js';

// ─── INVOICE EMAIL ──────────────────────────────────────────────────

export {
  buildInvoiceEmail,
  buildPaymentReminderEmail,
  buildPaymentReceiptEmail,
  sendInvoiceEmail,
  sendPaymentReminderEmail,
  sendPaymentReceiptEmail,
} from './invoice-email.js';

export type {
  InvoiceEmailData,
  EmailReminder,
  ReceiptEmailData,
  EmailContent,
} from './invoice-email.js';
