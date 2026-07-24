/**
 * Payment Test Fixtures
 * Mock data generators for payment integration tests
 * ~100 lines
 */

// ─── STRIPE FIXTURES ────────────────────────────────────────────────────────

export interface StripePaymentLink {
  id: string;
  url: string;
  clientSecret?: string;
  amount: number;
  currency: string;
  customerId: string;
  invoiceId: string;
  status: "active" | "expired";
  expiresAt?: Date;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export const createStripePaymentLink = (
  overrides?: Partial<StripePaymentLink>,
): StripePaymentLink => ({
  id: `pl_${Math.random().toString(36).substr(2, 20)}`,
  url: `https://checkout.stripe.com/pay/${Math.random().toString(36).substr(2, 20)}`,
  clientSecret: `pi_${Math.random().toString(36).substr(2, 20)}_secret_${Math.random().toString(36).substr(2, 20)}`,
  amount: 1000,
  currency: "USD",
  customerId: `customer_${Math.random().toString(36).substr(2, 9)}`,
  invoiceId: `invoice_${Math.random().toString(36).substr(2, 9)}`,
  status: "active",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  metadata: {},
  ...overrides,
});

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
    previous_attributes?: Record<string, unknown>;
  };
  created: number;
  livemode: boolean;
}

export const createStripeWebhookEvent = (
  overrides?: Partial<StripeWebhookEvent>,
): StripeWebhookEvent => ({
  id: `evt_${Math.random().toString(36).substr(2, 20)}`,
  type: "payment_intent.succeeded",
  data: {
    object: {
      id: `pi_${Math.random().toString(36).substr(2, 20)}`,
      status: "succeeded",
      amount_received: 1000,
      currency: "usd",
    },
  },
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  ...overrides,
});

// ─── MANUAL PAYMENT FIXTURES ────────────────────────────────────────────────

export interface ManualPaymentRecord {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  method: "bank_transfer" | "cash" | "check";
  reference?: string;
  notes?: string;
  recordedAt: Date;
  recordedBy: string;
  metadata?: Record<string, unknown>;
}

export const createBankTransferPayment = (
  overrides?: Partial<ManualPaymentRecord>,
): ManualPaymentRecord => ({
  id: `bank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  invoiceId: `invoice_${Math.random().toString(36).substr(2, 9)}`,
  customerId: `customer_${Math.random().toString(36).substr(2, 9)}`,
  amount: 1000,
  method: "bank_transfer",
  reference: `TRANSFER-${Math.floor(Math.random() * 100000)}`,
  notes: "Payment received via bank transfer",
  recordedAt: new Date(),
  recordedBy: `user_${Math.random().toString(36).substr(2, 9)}`,
  metadata: {
    bank: "Chase",
    accountLast4: "1234",
  },
  ...overrides,
});

export const createCashPayment = (
  overrides?: Partial<ManualPaymentRecord>,
): ManualPaymentRecord => ({
  id: `cash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  invoiceId: `invoice_${Math.random().toString(36).substr(2, 9)}`,
  customerId: `customer_${Math.random().toString(36).substr(2, 9)}`,
  amount: 1000,
  method: "cash",
  notes: "Cash payment received in person",
  recordedAt: new Date(),
  recordedBy: `user_${Math.random().toString(36).substr(2, 9)}`,
  metadata: {
    location: "Office",
  },
  ...overrides,
});

export const createCheckPayment = (
  overrides?: Partial<ManualPaymentRecord>,
): ManualPaymentRecord => ({
  id: `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  invoiceId: `invoice_${Math.random().toString(36).substr(2, 9)}`,
  customerId: `customer_${Math.random().toString(36).substr(2, 9)}`,
  amount: 1000,
  method: "check",
  reference: `CHK-${Math.floor(Math.random() * 1000000)}`,
  notes: "Check #1234 received",
  recordedAt: new Date(),
  recordedBy: `user_${Math.random().toString(36).substr(2, 9)}`,
  metadata: {
    checkNumber: "1234",
    bankName: "Chase",
  },
  ...overrides,
});

// ─── PARTIAL PAYMENT FIXTURES ──────────────────────────────────────────────

export interface PartialPaymentScenario {
  invoiceAmount: number;
  payments: Array<{
    amount: number;
    date: Date;
    method: string;
  }>;
  remainingBalance: number;
  isFullyPaid: boolean;
}

export const createPartialPaymentScenario = (
  invoiceAmount: number = 1000,
): PartialPaymentScenario => {
  const payments = [
    {
      amount: 300,
      date: new Date(),
      method: "stripe",
    },
    {
      amount: 200,
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      method: "bank_transfer",
    },
  ];

  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  return {
    invoiceAmount,
    payments,
    remainingBalance: invoiceAmount - paidAmount,
    isFullyPaid: paidAmount >= invoiceAmount,
  };
};

// ─── OVERPAYMENT FIXTURES ──────────────────────────────────────────────────

export interface OverpaymentScenario {
  invoiceAmount: number;
  paymentAmount: number;
  overpaymentAmount: number;
  creditApplied: boolean;
}

export const createOverpaymentScenario = (
  invoiceAmount: number = 1000,
  overpaymentPercent: number = 20,
): OverpaymentScenario => {
  const paymentAmount = invoiceAmount * (1 + overpaymentPercent / 100);

  return {
    invoiceAmount,
    paymentAmount,
    overpaymentAmount: paymentAmount - invoiceAmount,
    creditApplied: true,
  };
};

// ─── REFUND FIXTURES ────────────────────────────────────────────────────────

export interface RefundRecord {
  id: string;
  paymentId: string;
  invoiceId: string;
  originalAmount: number;
  refundAmount: number;
  reason: "duplicate" | "customer_request" | "overpayment" | "void_invoice";
  status: "initiated" | "processing" | "completed" | "failed";
  initiatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export const createRefund = (
  overrides?: Partial<RefundRecord>,
): RefundRecord => ({
  id: `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  paymentId: `payment_${Math.random().toString(36).substr(2, 9)}`,
  invoiceId: `invoice_${Math.random().toString(36).substr(2, 9)}`,
  originalAmount: 1000,
  refundAmount: 1000,
  reason: "customer_request",
  status: "completed",
  initiatedAt: new Date(),
  completedAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  metadata: {},
  ...overrides,
});

// ─── PAYMENT RECONCILIATION FIXTURES ────────────────────────────────────────

export interface PaymentReconciliation {
  invoiceId: string;
  invoiceAmount: number;
  recordedPayments: number;
  actualPayments: number;
  discrepancy: number;
  status: "reconciled" | "pending" | "disputed";
  lastReconciled?: Date;
}

export const createPaymentReconciliation = (
  overrides?: Partial<PaymentReconciliation>,
): PaymentReconciliation => ({
  invoiceId: `invoice_${Math.random().toString(36).substr(2, 9)}`,
  invoiceAmount: 1000,
  recordedPayments: 1000,
  actualPayments: 1000,
  discrepancy: 0,
  status: "reconciled",
  lastReconciled: new Date(),
  ...overrides,
});

// ─── CONCURRENT PAYMENT FIXTURES ────────────────────────────────────────────

export const createConcurrentPaymentScenario = (
  invoiceId: string,
  invoiceAmount: number = 1000,
) => {
  const now = Date.now();

  return {
    invoiceId,
    invoiceAmount,
    payments: [
      {
        id: `payment_${now}_1`,
        amount: 500,
        timestamp: now,
        method: "stripe",
      },
      {
        id: `payment_${now}_2`,
        amount: 500,
        timestamp: now + 100, // 100ms later, essentially concurrent
        method: "stripe",
      },
    ],
    expectedBehavior:
      "both payments should be recorded, invoice marked as paid",
  };
};

// ─── DUPLICATE WEBHOOK FIXTURES ──────────────────────────────────────────────

export const createDuplicateWebhookScenario = (eventId: string) => {
  return {
    originalEvent: {
      id: eventId,
      type: "payment_intent.succeeded",
      timestamp: Date.now(),
    },
    duplicateEvent: {
      id: eventId,
      type: "payment_intent.succeeded",
      timestamp: Date.now() + 500, // resend a few milliseconds later
    },
    expectedBehavior: "second webhook should be idempotent, no double charging",
  };
};
