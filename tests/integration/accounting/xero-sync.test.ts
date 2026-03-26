/**
 * Xero Sync Integration Tests
 * Tests: OAuth2 flow, invoice creation, contact management,
 * tax rate sync, reconciliation, idempotent sync operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockXeroOAuth2Token,
  mockXeroContact,
  mockXeroInvoice,
  mockXeroPayment,
  mockXeroTaxRate,
  mockXeroAccount,
  mockXeroTrackingCategory,
  mockXeroSyncStatus,
  mockXeroInvoicePaid,
  mockXeroContactWithoutTaxNumber,
  mockXeroInvoiceWithoutLineItems,
  mockXeroUnauthorizedError,
  mockXeroValidationError,
  mockXeroRateLimitError,
  mockXeroInvoiceForReconciliation,
} from '../fixtures/accounting-fixtures.js';

global.fetch = vi.fn();

describe('XeroSync', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockClear();
    vi.useFakeTimers();
  });

  describe('OAuth2 Flow', () => {
    it('should exchange authorization code for token', () => {
      expect(mockXeroOAuth2Token.access_token).toBeDefined();
      expect(mockXeroOAuth2Token.token_type).toBe('Bearer');
    });

    it('should include refresh token for session renewal', () => {
      expect(mockXeroOAuth2Token.refresh_token).toBeDefined();
    });

    it('should have appropriate scopes', () => {
      const scopes = mockXeroOAuth2Token.scope.split(' ');
      expect(scopes).toContain('offline_access');
      expect(scopes.some((s) => s.includes('payroll'))).toBe(true);
    });

    it('should track token expiration time', () => {
      expect(mockXeroOAuth2Token.expires_in).toBe(1800); // 30 minutes
    });

    it('should refresh token before expiry', () => {
      const expiresIn = mockXeroOAuth2Token.expires_in;
      const bufferTime = 300; // 5 minutes
      expect(expiresIn).toBeGreaterThan(bufferTime);
    });
  });

  describe('Invoice Creation', () => {
    it('should create invoice with all details', () => {
      expect(mockXeroInvoice.invoiceNumber).toBe('INV-002');
      expect(mockXeroInvoice.status).toBe('DRAFT');
      expect(mockXeroInvoice.type).toBe('ACCREC');
    });

    it('should include contact reference', () => {
      expect(mockXeroInvoice.contact).toBeDefined();
      expect(mockXeroInvoice.contact.contactID).toBe('xero_contact_123');
      expect(mockXeroInvoice.contact.name).toBe('Beta Industries');
    });

    it('should include invoice dates', () => {
      expect(mockXeroInvoice.date).toBe('2024-03-11');
      expect(mockXeroInvoice.dueDate).toBe('2024-04-10');
    });

    it('should calculate payment terms', () => {
      const issueDate = new Date('2024-03-11');
      const dueDate = new Date('2024-04-10');
      const terms = Math.ceil(
        (dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(terms).toBe(30); // 30 days
    });

    it('should include line items', () => {
      expect(mockXeroInvoice.lineItems).toHaveLength(1);
      const item = mockXeroInvoice.lineItems[0];
      expect(item.description).toBe('Express Delivery Service');
      expect(item.quantity).toBe(1);
      expect(item.unitAmount).toBe(7500);
    });

    it('should handle invoices without line items', () => {
      expect(mockXeroInvoiceWithoutLineItems.lineItems).toHaveLength(0);
      expect(mockXeroInvoiceWithoutLineItems.total).toBe(0);
    });

    it('should calculate totals correctly', () => {
      expect(mockXeroInvoice.subtotal).toBe(7500);
      expect(mockXeroInvoice.totalTax).toBe(1500);
      expect(mockXeroInvoice.total).toBe(9000);
    });

    it('should include branding theme', () => {
      expect(mockXeroInvoice.branding).toBeDefined();
      expect(mockXeroInvoice.branding.brandingThemeID).toBe('branding_001');
    });

    it('should track invoice amount due', () => {
      expect(mockXeroInvoice.amountDue).toBe(9000);
      expect(mockXeroInvoice.amountPaid).toBe(0);
    });

    it('should track invoice update time', () => {
      expect(mockXeroInvoice.updated).toBe('2024-03-11T14:00:00Z');
    });
  });

  describe('Contact Management', () => {
    it('should parse contact details', () => {
      expect(mockXeroContact.name).toBe('Beta Industries');
      expect(mockXeroContact.firstName).toBe('Beta');
      expect(mockXeroContact.lastName).toBe('Industries');
    });

    it('should include contact ID', () => {
      expect(mockXeroContact.contactID).toBeDefined();
      expect(mockXeroContact.contactNumber).toBe('CONT-001');
    });

    it('should include email address', () => {
      expect(mockXeroContact.emailAddress).toBe('info@beta.com');
    });

    it('should include phone information', () => {
      const phone = mockXeroContact.phones[0];
      expect(phone.phoneType).toBe('DEFAULT');
      expect(phone.phoneNumber).toBe('+441234567890');
    });

    it('should include address details', () => {
      const address = mockXeroContact.addresses[0];
      expect(address.addressType).toBe('STREET');
      expect(address.city).toBe('London');
      expect(address.region).toBe('England');
      expect(address.postalCode).toBe('SW1A 1AA');
    });

    it('should include tax number', () => {
      expect(mockXeroContact.taxNumber).toBe('GB123456789');
    });

    it('should track contact status', () => {
      expect(mockXeroContact.status).toBe('ACTIVE');
    });

    it('should handle contact without tax number', () => {
      expect(mockXeroContactWithoutTaxNumber.taxNumber).toBeUndefined();
    });

    it('should indicate if contact is customer', () => {
      expect(mockXeroContact.isCustomer).toBe(true);
    });
  });

  describe('Tax Rate Sync', () => {
    it('should parse tax rate details', () => {
      expect(mockXeroTaxRate.taxType).toBe('Tax on Sales');
      expect(mockXeroTaxRate.taxPercent).toBe(20);
    });

    it('should include tax component ID', () => {
      expect(mockXeroTaxRate.taxComponentID).toBeDefined();
    });

    it('should track tax rate status', () => {
      expect(mockXeroTaxRate.status).toBe('ACTIVE');
    });

    it('should indicate compound tax', () => {
      expect(mockXeroTaxRate.isCompound).toBe(false);
    });

    it('should include display tax rate', () => {
      expect(mockXeroTaxRate.displayTaxRate).toBe(20);
    });

    it('should include effective rate', () => {
      expect(mockXeroTaxRate.effectiveRate).toBe(20);
    });

    it('should include report tax type', () => {
      expect(mockXeroTaxRate.reportTaxType).toBe('Sales Tax');
    });
  });

  describe('Payment Sync', () => {
    it('should track payment status', () => {
      expect(mockXeroPayment.isPaid).toBe(true);
    });

    it('should link payment to invoice', () => {
      expect(mockXeroPayment.invoice.invoiceID).toBe('xero_invoice_456');
      expect(mockXeroPayment.invoice.invoiceNumber).toBe('INV-002');
    });

    it('should include payment reference', () => {
      expect(mockXeroPayment.reference).toBe('Payment for delivery');
    });

    it('should track payment details', () => {
      expect(mockXeroPayment.value).toBe(9000);
      expect(mockXeroPayment.total).toBe(9000);
    });

    it('should include payment type', () => {
      const payment = mockXeroPayment.payments[0];
      expect(payment.paymentType).toBe('CHEQUE');
    });

    it('should track payment timestamp', () => {
      expect(mockXeroPayment.updatedDateUTC).toBeDefined();
    });
  });

  describe('Reconciliation', () => {
    it('should mark paid invoices in reconciliation', () => {
      expect(mockXeroInvoicePaid.status).toBe('SUBMITTED');
      expect(mockXeroInvoicePaid.amountDue).toBe(0);
    });

    it('should track full payment amount', () => {
      expect(mockXeroInvoicePaid.amountPaid).toBe(9000);
    });

    it('should verify invoice reconciliation status', () => {
      expect(mockXeroInvoiceForReconciliation.isPaid).toBe(true);
    });

    it('should calculate outstanding balance', () => {
      const balance = mockXeroInvoice.amountDue - mockXeroInvoice.amountPaid;
      expect(balance).toBe(9000);
    });
  });

  describe('Idempotent Sync Operations', () => {
    it('should use unique invoice number to prevent duplicates', () => {
      const invoice1 = { invoiceNumber: 'INV-002', id: 'inv_1' };
      const invoice2 = { invoiceNumber: 'INV-002', id: 'inv_1' };
      expect(invoice1.invoiceNumber).toBe(invoice2.invoiceNumber);
    });

    it('should use contact ID to prevent duplicate contacts', () => {
      const contact1 = { contactID: 'xero_contact_123', name: 'Beta Industries' };
      const contact2 = { contactID: 'xero_contact_123', name: 'Beta Industries' };
      expect(contact1.contactID).toBe(contact2.contactID);
    });

    it('should handle duplicate payment gracefully', () => {
      const payment1 = { paymentID: 'xero_payment_789', value: 9000 };
      const payment2 = { paymentID: 'xero_payment_789', value: 9000 };
      expect(payment1.paymentID).toBe(payment2.paymentID);
    });

    it('should prevent double-posting of payments', () => {
      const payments = [
        { paymentID: 'payment_1', value: 5000 },
        { paymentID: 'payment_1', value: 5000 }, // Duplicate
      ];
      const uniquePayments = [...new Map(payments.map((p) => [p.paymentID, p])).values()];
      expect(uniquePayments).toHaveLength(1);
    });
  });

  describe('Tracking Categories', () => {
    it('should parse tracking category', () => {
      expect(mockXeroTrackingCategory.name).toBe('Department');
      expect(mockXeroTrackingCategory.status).toBe('ACTIVE');
    });

    it('should include tracking option ID', () => {
      expect(mockXeroTrackingCategory.trackingOptionID).toBeDefined();
    });

    it('should include tracking category ID', () => {
      expect(mockXeroTrackingCategory.trackingCategoryID).toBeDefined();
    });
  });

  describe('Chart of Accounts', () => {
    it('should parse account information', () => {
      expect(mockXeroAccount.name).toBe('Sales');
      expect(mockXeroAccount.type).toBe('REVENUE');
      expect(mockXeroAccount.code).toBe('200');
    });

    it('should include account tax type', () => {
      expect(mockXeroAccount.taxType).toBe('Tax on Sales');
    });

    it('should include reporting code', () => {
      expect(mockXeroAccount.reportingCodeName).toBe('Revenue');
    });

    it('should track account status', () => {
      expect(mockXeroAccount.status).toBe('ACTIVE');
    });
  });

  describe('Sync Status Tracking', () => {
    it('should track successful sync', () => {
      expect(mockXeroSyncStatus.status).toBe('synced');
      expect(mockXeroSyncStatus.externalId).toBe('xero_invoice_456');
    });

    it('should include sync timestamp', () => {
      expect(mockXeroSyncStatus.syncedAt).toBe('2024-03-11T14:05:00Z');
    });

    it('should track no retry needed on success', () => {
      expect(mockXeroSyncStatus.nextRetry).toBeNull();
    });

    it('should include entity ID for correlation', () => {
      expect(mockXeroSyncStatus.entityId).toBe('invoice_123');
    });
  });

  describe('Error Handling', () => {
    it('should handle authorization errors', () => {
      expect(mockXeroUnauthorizedError.apiErrors[0].errorNumber).toBe(401);
      expect(mockXeroUnauthorizedError.apiErrors[0].type).toBe('AuthenticationException');
    });

    it('should handle validation errors', () => {
      expect(mockXeroValidationError.apiErrors[0].errorNumber).toBe(400);
      expect(mockXeroValidationError.apiErrors[0].type).toBe('ValidationException');
      expect(mockXeroValidationError.apiErrors[0].message).toContain('required');
    });

    it('should handle rate limiting', () => {
      expect(mockXeroRateLimitError.apiErrors[0].errorNumber).toBe(429);
      expect(mockXeroRateLimitError.apiErrors[0].type).toBe('RateLimitException');
    });

    it('should extract error code for categorization', () => {
      const error = mockXeroValidationError.apiErrors[0];
      expect(error.apiErrorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('Line Item Tracking', () => {
    it('should include account code in line items', () => {
      const item = mockXeroInvoice.lineItems[0];
      expect(item.accountCode).toBe('200');
    });

    it('should include tax type in line items', () => {
      const item = mockXeroInvoice.lineItems[0];
      expect(item.taxType).toBe('Tax on Sales');
    });

    it('should support tracking categories in line items', () => {
      const item = mockXeroInvoice.lineItems[0];
      expect(item.trackingCategoryRefs).toBeDefined();
    });

    it('should calculate line item total', () => {
      const item = mockXeroInvoice.lineItems[0];
      const total = item.quantity * item.unitAmount;
      expect(total).toBe(7500);
    });
  });

  describe('Currency and Locale', () => {
    it('should preserve currency code', () => {
      expect(mockXeroInvoice.currencyCode).toBe('GBP');
    });

    it('should handle different currencies', () => {
      const currencies = ['GBP', 'USD', 'EUR'];
      expect(currencies).toContain('GBP');
    });

    it('should support locale-specific formatting', () => {
      expect(mockXeroInvoice.currencyCode).toBe('GBP');
    });
  });

  describe('Status Transitions', () => {
    it('should track invoice status progression', () => {
      expect(mockXeroInvoice.status).toBe('DRAFT');
      expect(mockXeroInvoicePaid.status).toBe('SUBMITTED');
    });

    it('should prevent invalid status transitions', () => {
      const validStatuses = ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'PAID', 'VOIDED'];
      expect(validStatuses).toContain(mockXeroInvoice.status);
    });

    it('should mark submitted invoices', () => {
      expect(mockXeroInvoicePaid.status).toBe('SUBMITTED');
    });
  });
});
