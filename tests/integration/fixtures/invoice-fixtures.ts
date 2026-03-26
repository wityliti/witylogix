/**
 * Invoice Test Fixtures
 * Mock data generators for invoice integration tests
 * ~150 lines
 */

// ─── DELIVERY RECORD GENERATORS ──────────────────────────────────────────────

export interface DeliveryRecord {
  id: string;
  orderId: string;
  customerId: string;
  distance: number; // miles
  duration: number; // hours
  weight: number; // kg
  status: "completed" | "cancelled" | "pending";
  completedAt: Date;
  billingModel: "per-delivery" | "per-mile" | "per-hour" | "flat-rate" | "tiered" | "subscription";
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

export const createDeliveryRecord = (overrides?: Partial<DeliveryRecord>): DeliveryRecord => ({
  id: `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  orderId: `order_${Math.random().toString(36).substr(2, 9)}`,
  customerId: `customer_${Math.random().toString(36).substr(2, 9)}`,
  distance: 5,
  duration: 0.5,
  weight: 2,
  status: "completed",
  completedAt: new Date(),
  billingModel: "per-delivery",
  amount: 10,
  currency: "USD",
  metadata: {},
  ...overrides,
});

export const createBatchDeliveries = (count: number, baseModel: DeliveryRecord["billingModel"] = "per-delivery"): DeliveryRecord[] => {
  return Array.from({ length: count }, (_, i) =>
    createDeliveryRecord({
      id: `delivery_${Date.now()}_${i}`,
      billingModel: baseModel,
      distance: baseModel === "per-mile" ? 10 + i : 5,
      duration: baseModel === "per-hour" ? 1 + i * 0.5 : 0.5,
      amount: baseModel === "per-delivery" ? 10 : (baseModel === "per-mile" ? (10 + i) : 15),
    })
  );
};

// ─── INVOICE DATA GENERATORS ────────────────────────────────────────────────

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  billableMetric?: "delivery_count" | "distance" | "duration" | "weight";
}

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  discountType?: "fixed" | "percentage" | "volume";
  tax: number;
  total: number;
  currency: string;
  billingPeriod: {
    start: Date;
    end: Date;
  };
  dueDate: Date;
  status: "draft" | "sent" | "paid" | "void" | "overdue";
  paidAmount?: number;
  paidDate?: Date;
  createdAt: Date;
  finalizedAt?: Date;
  sentAt?: Date;
  voidedAt?: Date;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export const createInvoice = (overrides?: Partial<InvoiceData>): InvoiceData => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const lineItems: InvoiceLineItem[] = [
    {
      description: "Delivery Services",
      quantity: 50,
      unitPrice: 10,
      taxable: true,
      billableMetric: "delivery_count",
    },
  ];

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const tax = Math.round(subtotal * 0.08 * 100) / 100;

  return {
    id: `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    invoiceNumber: `INV-${Math.floor(Math.random() * 10000)}`,
    customerId: `customer_${Math.random().toString(36).substr(2, 9)}`,
    customerName: "Acme Corp",
    customerEmail: "billing@acme.com",
    lineItems,
    subtotal,
    discount: 0,
    tax,
    total: subtotal + tax,
    currency: "USD",
    billingPeriod: {
      start: startOfMonth,
      end: endOfMonth,
    },
    dueDate: new Date(endOfMonth.getTime() + 30 * 24 * 60 * 60 * 1000),
    status: "draft",
    createdAt: now,
    metadata: {},
    ...overrides,
  };
};

// ─── BILLING MODEL CONFIGURATIONS ──────────────────────────────────────────

export interface BillingModelConfig {
  type: "per-delivery" | "per-mile" | "per-hour" | "flat-rate" | "tiered" | "subscription";
  basePrice?: number;
  perUnitPrice?: number;
  tiers?: Array<{
    min: number;
    max?: number;
    price: number;
  }>;
  subscription?: {
    monthlyPrice: number;
    includedDeliveries: number;
    overagePrice: number;
  };
  volumeDiscount?: Array<{
    minDeliveries: number;
    discountPercent: number;
  }>;
}

export const billingModels: Record<string, BillingModelConfig> = {
  "per-delivery": {
    type: "per-delivery",
    basePrice: 10,
  },
  "per-mile": {
    type: "per-mile",
    perUnitPrice: 2.5,
  },
  "per-hour": {
    type: "per-hour",
    perUnitPrice: 20,
  },
  "flat-rate": {
    type: "flat-rate",
    basePrice: 100,
  },
  tiered: {
    type: "tiered",
    tiers: [
      { min: 1, max: 50, price: 10 },
      { min: 51, max: 200, price: 8 },
      { min: 201, max: undefined, price: 6 },
    ],
  },
  subscription: {
    type: "subscription",
    subscription: {
      monthlyPrice: 499,
      includedDeliveries: 100,
      overagePrice: 5,
    },
  },
};

// ─── TAX RATE FIXTURES ──────────────────────────────────────────────────────

export const taxRates: Record<string, number> = {
  "US-CA": 0.0725,
  "US-NY": 0.08,
  "US-TX": 0.0625,
  "US-FL": 0.06,
  "CA-ON": 0.13,
  "CA-QC": 0.15,
  "GB-ENG": 0.20,
  "GB-SC": 0.20,
  "AU-NSW": 0.1,
  "AU-VIC": 0.1,
};

// ─── VOLUME DISCOUNT FIXTURES ──────────────────────────────────────────────

export const volumeDiscounts = [
  { minDeliveries: 1, maxDeliveries: 50, discountPercent: 0 },
  { minDeliveries: 51, maxDeliveries: 200, discountPercent: 5 },
  { minDeliveries: 201, maxDeliveries: 500, discountPercent: 10 },
  { minDeliveries: 501, maxDeliveries: undefined, discountPercent: 15 },
];

// ─── CUSTOMER FIXTURES ──────────────────────────────────────────────────────

export interface CustomerData {
  id: string;
  name: string;
  email: string;
  currency: string;
  taxJurisdiction: string;
  billingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  paymentMethod?: {
    type: "credit_card" | "bank_transfer" | "check";
    lastFour?: string;
  };
}

export const createCustomer = (overrides?: Partial<CustomerData>): CustomerData => ({
  id: `customer_${Math.random().toString(36).substr(2, 9)}`,
  name: "Acme Corp",
  email: "billing@acme.com",
  currency: "USD",
  taxJurisdiction: "US-CA",
  billingAddress: {
    street: "123 Business Ave",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    country: "US",
  },
  paymentMethod: {
    type: "credit_card",
    lastFour: "4242",
  },
  ...overrides,
});

// ─── MULTI-CURRENCY FIXTURES ──────────────────────────────────────────────

export const currencyRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.53,
  JPY: 149.5,
};

export const createMultiCurrencyInvoice = (currency: string, amount: number): InvoiceData => {
  const baseRate = currencyRates[currency] || 1;
  const adjustedAmount = Math.round((amount / baseRate) * 100) / 100;

  return createInvoice({
    currency,
    subtotal: adjustedAmount,
    total: adjustedAmount + Math.round(adjustedAmount * 0.08 * 100) / 100,
    lineItems: [
      {
        description: "Delivery Services",
        quantity: 50,
        unitPrice: Math.round((adjustedAmount / 50) * 100) / 100,
        taxable: true,
      },
    ],
  });
};

// ─── PAYMENT FIXTURES ──────────────────────────────────────────────────────

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: number;
  method: "stripe" | "manual" | "bank_transfer" | "cash" | "check";
  status: "pending" | "completed" | "failed" | "refunded";
  reference?: string;
  processedAt?: Date;
  metadata?: Record<string, unknown>;
}

export const createPaymentRecord = (overrides?: Partial<PaymentRecord>): PaymentRecord => ({
  id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  invoiceId: `invoice_${Math.random().toString(36).substr(2, 9)}`,
  amount: 1000,
  method: "stripe",
  status: "completed",
  processedAt: new Date(),
  metadata: {},
  ...overrides,
});

// ─── EDGE CASE GENERATORS ──────────────────────────────────────────────────

export const generateZeroAmountInvoice = (): InvoiceData => {
  return createInvoice({
    lineItems: [],
    subtotal: 0,
    tax: 0,
    total: 0,
  });
};

export const generateSingleDeliveryInvoice = (): InvoiceData => {
  return createInvoice({
    lineItems: [
      {
        description: "Single Delivery",
        quantity: 1,
        unitPrice: 15,
        taxable: true,
      },
    ],
    subtotal: 15,
    tax: Math.round(15 * 0.08 * 100) / 100,
    total: 15 + Math.round(15 * 0.08 * 100) / 100,
  });
};

export const generateLargeInvoice = (deliveryCount: number = 1000): InvoiceData => {
  const unitPrice = 10;
  const subtotal = deliveryCount * unitPrice;
  const tax = Math.round(subtotal * 0.08 * 100) / 100;

  return createInvoice({
    lineItems: [
      {
        description: `${deliveryCount} Deliveries`,
        quantity: deliveryCount,
        unitPrice,
        taxable: true,
      },
    ],
    subtotal,
    tax,
    total: subtotal + tax,
  });
};

export const generateSpecialCharacterCustomer = (): CustomerData => {
  return createCustomer({
    name: "José María & Co. (España)",
    email: "josé@example.com",
    billingAddress: {
      street: "Calle Mayor, 123",
      city: "Madrid",
      state: "Madrid",
      zip: "28001",
      country: "ES",
    },
  });
};
