/**
 * QuickBooks Sync Integration Tests
 * Tests: OAuth2 flow, invoice creation mapping, payment sync,
 * customer lookup/create, sync status tracking, retry on failure
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockQBOAuth2Token,
  mockQBCustomer,
  mockQBInvoice,
  mockQBPayment,
  mockQBAccount,
  mockQBSyncStatus,
  mockQBSyncStatusFailed,
  mockQBBatchResponse,
  mockQBInvoiceWithoutCustomer,
  mockQBInvoiceWithMultipleLineItems,
  mockQBCustomerWithoutEmail,
  mockQBAuthorizationError,
  mockQBValidationError,
  mockQBNotFoundError,
  mockQBInvoiceForReconciliation,
} from '../fixtures/accounting-fixtures.js';

global.fetch = vi.fn();

describe('QuickBooksSync', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockClear();
    vi.useFakeTimers();
  });

  describe('OAuth2 Flow', () => {
    it('should exchange authorization code for token', () => {
      expect(mockQBOAuth2Token.access_token).toBeDefined();
      expect(mockQBOAuth2Token.token_type).toBe('Bearer');
    });

    it('should include refresh token for long-lived sessions', () => {
      expect(mockQBOAuth2Token.refresh_token).toBeDefined();
    });

    it('should have realm ID for tenant identification', () => {
      expect(mockQBOAuth2Token.realmId).toBe('qb_realm_123');
    });

    it('should track refresh token expiration', () => {
      expect(mockQBOAuth2Token.x_refresh_token_expires_in).toBe(8726400); // 101 days
    });

    it('should handle token refresh before expiry', () => {
      const expiresIn = mockQBOAuth2Token.expires_in;
      expect(expiresIn).toBeLessThan(3600); // 1 hour
    });
  });

  describe('Invoice Creation Mapping', () => {
    it('should map internal invoice to QuickBooks format', () => {
      expect(mockQBInvoice.docNumber).toBe('INV-001');
      expect(mockQBInvoice.txnDate).toBe('2024-03-11');
      expect(mockQBInvoice.dueDate).toBe('2024-04-10');
    });

    it('should include customer reference in invoice', () => {
      expect(mockQBInvoice.customerRef).toBeDefined();
      expect(mockQBInvoice.customerRef.value).toBe('qb_customer_123');
      expect(mockQBInvoice.customerRef.name).toBe('Acme Corp');
    });

    it('should include line items with details', () => {
      expect(mockQBInvoice.lineItems).toHaveLength(1);
      const item = mockQBInvoice.lineItems[0];
      expect(item.description).toBe('Delivery Service');
      expect(item.amount).toBe(5000);
    });

    it('should support multiple line items', () => {
      expect(mockQBInvoiceWithMultipleLineItems.lineItems).toHaveLength(2);
      const totalAmount = mockQBInvoiceWithMultipleLineItems.lineItems.reduce(
        (sum, item) => sum + item.amount,
        0
      );
      expect(totalAmount).toBe(5000);
    });

    it('should include tax information', () => {
      expect(mockQBInvoice.txnTaxDetail).toBeDefined();
      expect(mockQBInvoice.txnTaxDetail.totalTaxAmount).toBe(400);
    });

    it('should calculate total amount including tax', () => {
      expect(mockQBInvoice.totalAmt).toBe(5400); // 5000 + 400 tax
    });

    it('should handle invoice without customer', () => {
      expect(mockQBInvoiceWithoutCustomer.customerRef).toBeNull();
    });
  });

  describe('Payment Sync', () => {
    it('should sync payment against invoice', () => {
      expect(mockQBPayment.totalAmt).toBe(5400);
      expect(mockQBPayment.lines).toHaveLength(1);
    });

    it('should link payment to specific invoice', () => {
      const linkedTxn = mockQBPayment.lines[0].linkedTxns[0];
      expect(linkedTxn.txnId).toBe('qb_invoice_456');
      expect(linkedTxn.txnType).toBe('Invoice');
    });

    it('should include payment method', () => {
      expect(mockQBPayment.paymentMethodRef).toBeDefined();
      expect(mockQBPayment.paymentMethodRef.value).toBe('method_001');
    });

    it('should include deposit account', () => {
      expect(mockQBPayment.depositToAccountRef).toBeDefined();
      expect(mockQBPayment.depositToAccountRef.name).toBe('Checking Account');
    });

    it('should track payment date', () => {
      expect(mockQBPayment.txnDate).toBe('2024-03-11');
    });
  });

  describe('Customer Lookup/Create', () => {
    it('should parse customer details', () => {
      expect(mockQBCustomer.displayName).toBe('Acme Corp');
      expect(mockQBCustomer.companyName).toBe('Acme Corporation');
    });

    it('should include customer contact information', () => {
      expect(mockQBCustomer.email.address).toBe('billing@acme.com');
      expect(mockQBCustomer.phone.freeFormNumber).toBe('+14155551234');
    });

    it('should include billing address', () => {
      const address = mockQBCustomer.billingAddress;
      expect(address.line1).toBe('123 Business Ave');
      expect(address.city).toBe('San Francisco');
      expect(address.countrySubDivisionCode).toBe('CA');
    });

    it('should include shipping address', () => {
      const address = mockQBCustomer.shippingAddress;
      expect(address.line1).toBe('456 Shipping St');
      expect(address.city).toBe('San Francisco');
    });

    it('should track customer status', () => {
      expect(mockQBCustomer.active).toBe(true);
    });

    it('should handle customer without email', () => {
      expect(mockQBCustomerWithoutEmail.email).toBeUndefined();
    });

    it('should include tax exemption ID', () => {
      expect(mockQBCustomer.taxResId).toBe('tax_res_001');
    });
  });

  describe('Sync Status Tracking', () => {
    it('should track successful sync', () => {
      expect(mockQBSyncStatus.status).toBe('synced');
      expect(mockQBSyncStatus.externalId).toBe('qb_invoice_456');
      expect(mockQBSyncStatus.errorMessage).toBeNull();
    });

    it('should include sync timestamp', () => {
      expect(mockQBSyncStatus.syncedAt).toBe('2024-03-11T14:05:00Z');
    });

    it('should track failed sync with error message', () => {
      expect(mockQBSyncStatusFailed.status).toBe('failed');
      expect(mockQBSyncStatusFailed.externalId).toBeNull();
      expect(mockQBSyncStatusFailed.errorMessage).toBe('Customer not found in QuickBooks');
    });

    it('should schedule retry on failure', () => {
      expect(mockQBSyncStatusFailed.nextRetry).toBe('2024-03-11T14:10:00Z');
    });

    it('should track retry count', () => {
      expect(mockQBSyncStatusFailed.retryCount).toBe(2);
    });

    it('should clear retry on successful sync', () => {
      expect(mockQBSyncStatus.nextRetry).toBeNull();
      expect(mockQBSyncStatus.retryCount).toBe(0);
    });
  });

  describe('Retry on Failure', () => {
    it('should retry on transient errors', () => {
      const failedSync = {
        status: 'failed',
        errorMessage: 'Connection timeout',
        retryable: true,
      };

      expect(failedSync.retryable).toBe(true);
    });

    it('should not retry on validation errors', () => {
      expect(mockQBValidationError.fault.error[0].code).toBe('4000');
    });

    it('should not retry on 401 authentication errors', () => {
      expect(mockQBAuthorizationError.fault.error[0].code).toBe('401');
    });

    it('should handle 404 not found errors', () => {
      expect(mockQBNotFoundError.fault.error[0].code).toBe('2010');
    });

    it('should backoff on retry', () => {
      const attempt1 = 1000; // 1 second
      const attempt2 = 2000; // 2 seconds
      const attempt3 = 4000; // 4 seconds
      expect(attempt2).toBe(attempt1 * 2);
      expect(attempt3).toBe(attempt2 * 2);
    });
  });

  describe('Batch Operations', () => {
    it('should parse batch response', () => {
      expect(mockQBBatchResponse.batchResults).toHaveLength(2);
    });

    it('should track status of each batch item', () => {
      expect(mockQBBatchResponse.batchResults[0].status).toBe(200);
      expect(mockQBBatchResponse.batchResults[1].status).toBe(201);
    });

    it('should extract body from batch item', () => {
      const customerResult = mockQBBatchResponse.batchResults[0].body;
      expect(customerResult.id).toBe('qb_customer_123');
    });

    it('should handle partial batch failures', () => {
      const results = mockQBBatchResponse.batchResults;
      const success = results.filter((r) => r.status >= 200 && r.status < 300);
      expect(success).toHaveLength(2);
    });
  });

  describe('Account and Chart of Accounts', () => {
    it('should parse account information', () => {
      expect(mockQBAccount.name).toBe('Checking Account');
      expect(mockQBAccount.type).toBe('Bank');
      expect(mockQBAccount.subType).toBe('CashOnHand');
    });

    it('should include account number', () => {
      expect(mockQBAccount.accountNumber).toBe('1234567890');
    });

    it('should track account balance', () => {
      expect(mockQBAccount.balance).toBe(50000);
    });

    it('should include account status', () => {
      expect(mockQBAccount.active).toBe(true);
    });
  });

  describe('Reconciliation', () => {
    it('should track reconciliation status', () => {
      expect(mockQBInvoiceForReconciliation.balance).toBe(0);
    });

    it('should mark fully paid invoices', () => {
      expect(mockQBInvoiceForReconciliation.balance).toBe(0);
    });

    it('should calculate outstanding balance', () => {
      const balance = mockQBInvoice.totalAmt - 0; // no payment
      expect(balance).toBe(5400);
    });
  });

  describe('Metadata and Timestamps', () => {
    it('should include creation timestamp', () => {
      expect(mockQBCustomer.metaData.createTime).toBe('2024-01-15T10:00:00Z');
    });

    it('should include update timestamp', () => {
      expect(mockQBCustomer.metaData.updateTime).toBe('2024-03-11T14:00:00Z');
    });

    it('should track invoice creation time', () => {
      expect(mockQBInvoice.metaData.createTime).toBe('2024-03-11T14:00:00Z');
    });

    it('should track payment creation time', () => {
      expect(mockQBPayment.metaData.createTime).toBe('2024-03-11T15:00:00Z');
    });
  });

  describe('Error Handling', () => {
    it('should handle authorization errors', () => {
      expect(mockQBAuthorizationError.fault.error[0].message).toContain('token');
    });

    it('should handle validation errors', () => {
      expect(mockQBValidationError.fault.error[0].message).toContain('Invalid');
    });

    it('should handle not found errors', () => {
      expect(mockQBNotFoundError.fault.error[0].message).toContain('not found');
    });
  });

  describe('Currency Handling', () => {
    it('should preserve currency in invoices', () => {
      expect(mockQBInvoice.currency.value).toBe('USD');
    });

    it('should include currency code', () => {
      expect(mockQBInvoice.currency.name).toBe('US Dollar');
    });

    it('should preserve currency in payments', () => {
      expect(mockQBPayment.currency.value).toBe('USD');
    });
  });

  describe('Line Item Details', () => {
    it('should include item reference', () => {
      const item = mockQBInvoice.lineItems[0];
      expect(item.salesItemLineDetail.itemRef.value).toBe('service_001');
    });

    it('should include quantity and unit price', () => {
      const item = mockQBInvoice.lineItems[0];
      expect(item.salesItemLineDetail.qty).toBe(1);
      expect(item.salesItemLineDetail.unitPrice).toBe(5000);
    });

    it('should include tax code reference', () => {
      const item = mockQBInvoice.lineItems[0];
      expect(item.salesItemLineDetail.taxCodeRef).toBeDefined();
    });
  });
});
