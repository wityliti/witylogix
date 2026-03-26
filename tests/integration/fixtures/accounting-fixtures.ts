/**
 * Accounting Integration Mock Fixtures
 * Provides mock HTTP responses for QuickBooks and Xero accounting APIs
 * Used for integration testing without real API calls
 */

// ─── QUICKBOOKS FIXTURES ────────────────────────────────────────────────────

export const mockQBCustomer = {
  id: 'qb_customer_123',
  displayName: 'Acme Corp',
  givenName: 'Acme',
  familyName: 'Corp',
  companyName: 'Acme Corporation',
  email: {
    address: 'billing@acme.com',
  },
  phone: {
    freeFormNumber: '+14155551234',
  },
  billingAddress: {
    line1: '123 Business Ave',
    line2: 'Suite 100',
    city: 'San Francisco',
    countrySubDivisionCode: 'CA',
    postalCode: '94102',
    country: 'US',
  },
  shippingAddress: {
    line1: '456 Shipping St',
    city: 'San Francisco',
    countrySubDivisionCode: 'CA',
    postalCode: '94105',
    country: 'US',
  },
  taxResId: 'tax_res_001',
  active: true,
  metaData: {
    createTime: '2024-01-15T10:00:00Z',
    updateTime: '2024-03-11T14:00:00Z',
  },
};

export const mockQBInvoice = {
  id: 'qb_invoice_456',
  docNumber: 'INV-001',
  txnDate: '2024-03-11',
  dueDate: '2024-04-10',
  customerRef: {
    value: 'qb_customer_123',
    name: 'Acme Corp',
  },
  lineItems: [
    {
      id: 'lineitem_001',
      description: 'Delivery Service',
      amount: 5000,
      detailType: 'SalesItemLineDetail',
      salesItemLineDetail: {
        itemRef: {
          value: 'service_001',
          name: 'Delivery',
        },
        qty: 1,
        unitPrice: 5000,
        taxCodeRef: {
          value: 'tax_001',
        },
      },
    },
  ],
  txnTaxDetail: {
    txnTaxCodeRef: {
      value: 'sales_tax_001',
    },
    totalTaxAmount: 400,
  },
  totalAmt: 5400,
  balance: 5400,
  homeBalance: 5400,
  currency: {
    name: 'US Dollar',
    value: 'USD',
  },
  metaData: {
    createTime: '2024-03-11T14:00:00Z',
    updateTime: '2024-03-11T14:00:00Z',
  },
};

export const mockQBPayment = {
  id: 'qb_payment_789',
  txnDate: '2024-03-11',
  totalAmt: 5400,
  customerRef: {
    value: 'qb_customer_123',
    name: 'Acme Corp',
  },
  lines: [
    {
      id: 'paymentline_001',
      amount: 5400,
      linkedTxns: [
        {
          txnId: 'qb_invoice_456',
          txnType: 'Invoice',
        },
      ],
    },
  ],
  depositToAccountRef: {
    value: 'account_001',
    name: 'Checking Account',
  },
  paymentMethodRef: {
    value: 'method_001',
    name: 'Credit Card',
  },
  currency: {
    name: 'US Dollar',
    value: 'USD',
  },
  metaData: {
    createTime: '2024-03-11T15:00:00Z',
    updateTime: '2024-03-11T15:00:00Z',
  },
};

export const mockQBOAuth2Token = {
  access_token: 'qb_access_token_xyz789',
  token_type: 'Bearer',
  expires_in: 3600,
  refresh_token: 'qb_refresh_token_abc123',
  x_refresh_token_expires_in: 8726400,
  realmId: 'qb_realm_123',
};

export const mockQBAccount = {
  id: 'account_001',
  name: 'Checking Account',
  accountNumber: '1234567890',
  type: 'Bank',
  subType: 'CashOnHand',
  active: true,
  balance: 50000,
  currency: {
    name: 'US Dollar',
    value: 'USD',
  },
  metaData: {
    createTime: '2024-01-01T00:00:00Z',
    updateTime: '2024-03-11T14:00:00Z',
  },
};

export const mockQBBatch = {
  batchResults: [
    {
      id: '0',
      status: 200,
      body: {
        id: 'qb_customer_123',
        displayName: 'Acme Corp',
      },
    },
  ],
};

// ─── XERO FIXTURES ────────────────────────────────────────────────────

export const mockXeroContact = {
  contactID: 'xero_contact_123',
  contactNumber: 'CONT-001',
  name: 'Beta Industries',
  firstName: 'Beta',
  lastName: 'Industries',
  emailAddress: 'info@beta.com',
  phones: [
    {
      phoneType: 'DEFAULT',
      phoneNumber: '+441234567890',
      phoneAreaCode: '44',
      phoneCountryCode: '44',
    },
  ],
  addresses: [
    {
      addressType: 'STREET',
      city: 'London',
      region: 'England',
      postalCode: 'SW1A 1AA',
      country: 'United Kingdom',
      attentionTo: 'Finance Team',
    },
  ],
  taxNumber: 'GB123456789',
  status: 'ACTIVE',
  isCustomer: true,
  isVendor: false,
  isSupplier: false,
  updatedDateUTC: '2024-03-11T14:00:00Z',
};

export const mockXeroInvoice = {
  invoiceID: 'xero_invoice_456',
  invoiceNumber: 'INV-002',
  status: 'DRAFT',
  type: 'ACCREC',
  lineItems: [
    {
      itemCode: 'DELIVERY',
      description: 'Express Delivery Service',
      quantity: 1,
      unitAmount: 7500,
      taxType: 'Tax on Sales',
      trackingCategoryRefs: [],
      accountCode: '200',
    },
  ],
  contact: {
    contactID: 'xero_contact_123',
    name: 'Beta Industries',
  },
  date: '2024-03-11',
  dueDate: '2024-04-10',
  total: 9000,
  subtotal: 7500,
  totalTax: 1500,
  taxTotal: 1500,
  amountDue: 9000,
  amountPaid: 0,
  currencyCode: 'GBP',
  branding: {
    brandingThemeID: 'branding_001',
  },
  updated: '2024-03-11T14:00:00Z',
};

export const mockXeroPayment = {
  paymentID: 'xero_payment_789',
  invoiceNumber: 'INV-002',
  hasAccount: false,
  hasTracking: false,
  updatedDateUTC: '2024-03-11T15:00:00Z',
  contact: {
    contactID: 'xero_contact_123',
    name: 'Beta Industries',
  },
  invoice: {
    invoiceID: 'xero_invoice_456',
    invoiceNumber: 'INV-002',
  },
  lineAmountTypes: 'Exclusive',
  subTotal: 7500,
  totalTax: 1500,
  total: 9000,
  invoiceAmount: 9000,
  reference: 'Payment for delivery',
  isPaid: true,
  payments: [
    {
      paymentID: 'xero_payment_789',
      reference: 'CHQ12345',
      value: 9000,
      paymentType: 'CHEQUE',
      hasAccount: false,
      accountCode: '200',
    },
  ],
};

export const mockXeroOAuth2Token = {
  access_token: 'xero_access_token_abc123',
  token_type: 'Bearer',
  expires_in: 1800,
  refresh_token: 'xero_refresh_token_xyz789',
  scope: 'payroll.employees payroll.settings offline_access',
};

export const mockXeroTaxRate = {
  taxType: 'Tax on Sales',
  taxComponentID: 'tax_comp_001',
  reportTaxType: 'Sales Tax',
  taxPercent: 20,
  isCompound: false,
  displayTaxRate: 20,
  effectiveRate: 20,
  status: 'ACTIVE',
};

export const mockXeroAccount = {
  accountID: 'xero_account_001',
  code: '200',
  name: 'Sales',
  type: 'REVENUE',
  taxType: 'Tax on Sales',
  description: 'Operating Revenue',
  enablePayments: false,
  status: 'ACTIVE',
  systemAccount: false,
  class: 'REVENUE',
  reportingCode: 'REV',
  reportingCodeName: 'Revenue',
  hasAttachments: false,
  updated: '2024-01-01T00:00:00Z',
};

export const mockXeroTrackingCategory = {
  trackingCategoryID: 'xero_tracking_001',
  name: 'Department',
  status: 'ACTIVE',
  trackingOptionID: 'tracking_opt_001',
};

// ─── SYNC STATUS FIXTURES ────────────────────────────────────────────────────

export const mockQBSyncStatus = {
  entityId: 'invoice_123',
  externalId: 'qb_invoice_456',
  provider: 'quickbooks',
  status: 'synced',
  syncedAt: '2024-03-11T14:05:00Z',
  nextRetry: null,
  errorMessage: null,
  retryCount: 0,
};

export const mockQBSyncStatusFailed = {
  entityId: 'invoice_124',
  externalId: null,
  provider: 'quickbooks',
  status: 'failed',
  syncedAt: null,
  nextRetry: '2024-03-11T14:10:00Z',
  errorMessage: 'Customer not found in QuickBooks',
  retryCount: 2,
};

export const mockXeroSyncStatus = {
  entityId: 'invoice_125',
  externalId: 'xero_invoice_456',
  provider: 'xero',
  status: 'synced',
  syncedAt: '2024-03-11T14:05:00Z',
  nextRetry: null,
  errorMessage: null,
  retryCount: 0,
};

// ─── ERROR RESPONSE FIXTURES ────────────────────────────────────────────────────

export const mockQBAuthorizationError = {
  fault: {
    error: [
      {
        message: 'Invalid token or expired token',
        detail: 'Auth token has expired',
        code: '401',
      },
    ],
  },
};

export const mockQBValidationError = {
  fault: {
    error: [
      {
        message: 'Invalid email address',
        detail: 'Email must be a valid format',
        code: '4000',
      },
    ],
  },
};

export const mockQBNotFoundError = {
  fault: {
    error: [
      {
        message: 'Customer not found',
        detail: 'No customer with ID qb_customer_999',
        code: '2010',
      },
    ],
  },
};

export const mockXeroUnauthorizedError = {
  apiErrors: [
    {
      errorNumber: 401,
      type: 'AuthenticationException',
      message: 'Invalid token',
    },
  ],
};

export const mockXeroValidationError = {
  apiErrors: [
    {
      errorNumber: 400,
      type: 'ValidationException',
      message: 'Contact name is required',
      apiErrorCode: 'VALIDATION_ERROR',
    },
  ],
};

export const mockXeroRateLimitError = {
  apiErrors: [
    {
      errorNumber: 429,
      type: 'RateLimitException',
      message: 'Rate limit exceeded. Please retry after 30 seconds.',
    },
  ],
};

// ─── EDGE CASE FIXTURES ────────────────────────────────────────────────────

export const mockQBInvoiceWithoutCustomer = {
  ...mockQBInvoice,
  customerRef: null,
};

export const mockQBInvoiceWithMultipleLineItems = {
  ...mockQBInvoice,
  lineItems: [
    {
      id: 'lineitem_001',
      description: 'Delivery Service',
      amount: 3000,
      detailType: 'SalesItemLineDetail',
      salesItemLineDetail: {
        itemRef: { value: 'service_001', name: 'Delivery' },
        qty: 1,
        unitPrice: 3000,
      },
    },
    {
      id: 'lineitem_002',
      description: 'Surcharge',
      amount: 2000,
      detailType: 'SalesItemLineDetail',
      salesItemLineDetail: {
        itemRef: { value: 'service_002', name: 'Surcharge' },
        qty: 1,
        unitPrice: 2000,
      },
    },
  ],
  totalAmt: 5200,
};

export const mockQBCustomerWithoutEmail = {
  ...mockQBCustomer,
  email: undefined,
};

export const mockXeroInvoicePaid = {
  ...mockXeroInvoice,
  status: 'SUBMITTED',
  amountDue: 0,
  amountPaid: 9000,
};

export const mockXeroContactWithoutTaxNumber = {
  ...mockXeroContact,
  taxNumber: undefined,
};

export const mockXeroInvoiceWithoutLineItems = {
  ...mockXeroInvoice,
  lineItems: [],
  total: 0,
  subtotal: 0,
};

// ─── RECONCILIATION FIXTURES ────────────────────────────────────────────────────

export const mockQBInvoiceForReconciliation = {
  ...mockQBInvoice,
  id: 'qb_invoice_rec_001',
  docNumber: 'INV-REC-001',
  totalAmt: 10000,
  balance: 0,
};

export const mockXeroInvoiceForReconciliation = {
  ...mockXeroInvoice,
  invoiceID: 'xero_invoice_rec_001',
  invoiceNumber: 'INV-REC-001',
  total: 10000,
  amountDue: 0,
  isPaid: true,
};

// ─── BATCH OPERATION FIXTURES ────────────────────────────────────────────────────

export const mockQBBatchRequest = {
  requests: [
    {
      method: 'GET',
      url: '/query?query=select * from Customer where id = 123',
    },
    {
      method: 'POST',
      url: '/invoice',
      body: mockQBInvoice,
    },
  ],
};

export const mockQBBatchResponse = {
  batchResults: [
    {
      id: '0',
      status: 200,
      body: { id: 'qb_customer_123' },
    },
    {
      id: '1',
      status: 201,
      body: { id: 'qb_invoice_456' },
    },
  ],
};
