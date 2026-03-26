/**
 * CRM & Accounting Integration Test Fixtures
 * Factory functions for creating test data:
 * - CRM: Contact, Deal, Company
 * - Accounting: Invoice, Payment, LineItem
 * - Platform responses: Salesforce, HubSpot, QuickBooks, Xero
 * ~150 lines
 */

// ─────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string;
  company: string;
  customFields?: Record<string, any>;
}

export interface Deal {
  id: string;
  amount: number;
  currency: string;
  status: string;
  closedAt?: Date;
  contactId?: string;
  companyId?: string;
  lineItems?: LineItem[];
  fxRate?: number;
}

export interface Company {
  id: string;
  name: string;
  industry?: string;
  employees?: number;
  website?: string;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'outstanding' | 'void';
  customerId?: string;
  totalAmount?: number;
  lineItems?: LineItem[];
  taxRate?: number;
}

export interface Payment {
  id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  invoiceId?: string;
  date?: Date;
}

export interface LineItem {
  id: string;
  description: string;
  amount: number;
  quantity: number;
  totalAmount?: number;
  taxRate?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS - CONTACT
// ─────────────────────────────────────────────────────────────────────────

export function createMockContact(overrides?: Partial<Contact>): Contact {
  const contact: Contact = {
    id: `contact_${Math.random().toString(36).substr(2, 9)}`,
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-123-4567',
    company: 'Acme Corp',
    ...overrides,
  };

  // Update fullName if firstName or lastName changes
  if (overrides?.firstName || overrides?.lastName) {
    contact.fullName = `${contact.firstName} ${contact.lastName}`.trim();
  }

  return contact;
}

// ─────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS - DEAL
// ─────────────────────────────────────────────────────────────────────────

export function createMockDeal(overrides?: Partial<Deal>): Deal {
  return {
    id: `deal_${Math.random().toString(36).substr(2, 9)}`,
    amount: 10000.00,
    currency: 'USD',
    status: 'open',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS - COMPANY
// ─────────────────────────────────────────────────────────────────────────

export function createMockCompany(overrides?: Partial<Company>): Company {
  return {
    id: `company_${Math.random().toString(36).substr(2, 9)}`,
    name: 'Acme Corporation',
    industry: 'Technology',
    employees: 500,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS - INVOICE
// ─────────────────────────────────────────────────────────────────────────

export function createMockInvoice(overrides?: Partial<Invoice>): Invoice {
  return {
    id: `invoice_${Math.random().toString(36).substr(2, 9)}`,
    amount: 5000.00,
    currency: 'USD',
    status: 'outstanding',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS - PAYMENT
// ─────────────────────────────────────────────────────────────────────────

export function createMockPayment(overrides?: Partial<Payment>): Payment {
  return {
    id: `payment_${Math.random().toString(36).substr(2, 9)}`,
    amount: 5000.00,
    status: 'completed',
    date: new Date(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS - LINE ITEM
// ─────────────────────────────────────────────────────────────────────────

export function createMockLineItem(overrides?: Partial<LineItem>): LineItem {
  const base = {
    id: `lineitem_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Service',
    amount: 1000.00,
    quantity: 1,
    taxRate: 0.1,
    ...overrides,
  };

  return {
    ...base,
    totalAmount: base.amount * base.quantity,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS - SALESFORCE RESPONSE
// ─────────────────────────────────────────────────────────────────────────

export function createMockSalesforceResponse(
  overrides?: Partial<Record<string, any>>
): Record<string, any> {
  return {
    id: `salesforce_${Math.random().toString(36).substr(2, 9)}`,
    Name: 'John Doe',
    Email: 'john.doe@example.com',
    Phone: '+1-555-123-4567',
    Company: 'Acme Corp',
    Amount: 10000.00,
    StageName: 'Negotiation/Review',
    CloseDate: new Date('2024-04-15').toISOString(),
    CreatedDate: new Date('2024-03-15').toISOString(),
    LastModifiedDate: new Date('2024-03-15').toISOString(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS - HUBSPOT RESPONSE
// ─────────────────────────────────────────────────────────────────────────

export function createMockHubSpotResponse(
  overrides?: Partial<Record<string, any>>
): Record<string, any> {
  return {
    id: `hubspot_${Math.random().toString(36).substr(2, 9)}`,
    properties: {
      firstname: 'John',
      lastname: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1-555-123-4567',
      company: 'Acme Corp',
      hs_lead_status: 'OPEN',
      dealstage: 'negotiation',
      amount: '10000',
      closedate: Math.floor(new Date('2024-04-15').getTime() / 1000),
      hs_analytics_num_contacts: 1,
      createdate: new Date('2024-03-15').getTime(),
      lastmodifieddate: new Date('2024-03-15').getTime(),
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS - QUICKBOOKS INVOICE
// ─────────────────────────────────────────────────────────────────────────

export function createMockQuickBooksInvoice(
  overrides?: Partial<Record<string, any>>
): Record<string, any> {
  return {
    id: `qb_invoice_${Math.random().toString(36).substr(2, 9)}`,
    docNumber: `INV-${Math.floor(Math.random() * 10000)}`,
    txnDate: '2024-03-15',
    dueDate: '2024-04-15',
    customerRef: {
      value: 'qb_customer_123',
      name: 'Acme Corp',
    },
    lineItems: [
      {
        description: 'Consulting Services',
        amount: 5000,
        detailType: 'SalesItemLineDetail',
        salesItemLineDetail: {
          qty: 1,
          unitPrice: 5000,
        },
      },
    ],
    txnTaxDetail: {
      totalTaxAmount: 400,
    },
    totalAmt: 5400,
    balance: 5400,
    currency: {
      value: 'USD',
    },
    metaData: {
      createTime: new Date('2024-03-15T10:00:00Z').toISOString(),
      updateTime: new Date('2024-03-15T10:00:00Z').toISOString(),
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTIONS - XERO PAYMENT
// ─────────────────────────────────────────────────────────────────────────

export function createMockXeroPayment(
  overrides?: Partial<Record<string, any>>
): Record<string, any> {
  return {
    PaymentID: `xero_payment_${Math.random().toString(36).substr(2, 9)}`,
    InvoiceNumber: `INV-${Math.floor(Math.random() * 10000)}`,
    Reference: 'Payment Ref',
    Amount: 5400.00,
    PaymentType: 'ACCRECPAYMENT',
    Status: 'AUTHORISED',
    LineAmountTypes: 'Inclusive',
    PaymentDate: '2024-03-15',
    Account: {
      Code: '200',
      Name: 'Sales',
    },
    Contact: {
      ContactID: 'xero_contact_123',
      Name: 'Acme Corp',
    },
    UpdatedDateUTC: new Date('2024-03-15T10:00:00Z').toISOString(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────

export function createMockContactBatch(count: number): Contact[] {
  return Array.from({ length: count }, (_, i) => {
    return createMockContact({
      id: `contact_${i}`,
      firstName: `First${i}`,
      lastName: `Last${i}`,
      email: `user${i}@example.com`,
    });
  });
}

export function createMockDealBatch(count: number): Deal[] {
  return Array.from({ length: count }, (_, i) => {
    return createMockDeal({
      id: `deal_${i}`,
      amount: 1000 * (i + 1),
      contactId: `contact_${i}`,
    });
  });
}

export function createMockInvoiceBatch(count: number): Invoice[] {
  return Array.from({ length: count }, (_, i) => {
    return createMockInvoice({
      id: `invoice_${i}`,
      amount: 500 * (i + 1),
      status: i % 2 === 0 ? 'paid' : 'outstanding',
    });
  });
}
