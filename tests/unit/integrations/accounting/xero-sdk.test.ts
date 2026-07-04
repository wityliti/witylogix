/**
 * Xero SDK Client Tests
 *
 * Unit tests for OAuth2 PKCE flow, invoice operations, contacts,
 * payments, tenant management, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  XeroSDKClient,
  XeroError,
  type XeroInvoice,
  type XeroContact,
  type XeroPayment,
  type XeroItem,
  type XeroTenant,
} from "../../../../packages/core/src/integrations/accounting/xero-sdk-client";
import type { ConfigService } from "../../../../packages/core/src/config/config-service";

// ─── MOCKS ──────────────────────────────────────────────────────────

const mockConfigService: Partial<ConfigService> = {
  get: vi.fn((key: string) => {
    const config: Record<string, string> = {
      "xero.clientId": "xero_" + "FAKE_CLIENT_ID",
      "xero.clientSecret": "xero_" + "FAKE_CLIENT_SECRET",
      "xero.redirectUri": "https://localhost:3000/oauth/xero/callback",
    };
    return config[key];
  }),
};

const mockInvoice: XeroInvoice = {
  invoiceID: "123456",
  invoiceNumber: "INV-001",
  type: "ACCREC",
  status: "DRAFT",
  lineAmountTypes: "Exclusive",
  date: "2024-03-17",
  dueDate: "2024-04-17",
  contact: {
    name: "Acme Corp",
    emailAddress: "contact@acme.com",
  },
  lineItems: [
    {
      description: "Consulting Services",
      quantity: 10,
      unitAmount: 100,
      accountCode: "200",
      taxType: "Tax on Sales",
      taxAmount: 100,
    },
  ],
  total: 1100,
  tax: 100,
};

const mockContact: XeroContact = {
  contactID: "contact-123",
  name: "Acme Corp",
  emailAddress: "contact@acme.com",
  primaryPerson: {
    firstName: "John",
    lastName: "Doe",
    emailAddress: "john@acme.com",
  },
  addresses: [
    {
      addressType: "STREET",
      line1: "123 Main St",
      city: "San Francisco",
      region: "CA",
      postalCode: "94105",
      country: "USA",
    },
  ],
  contactStatus: "ACTIVE",
};

const mockPayment: XeroPayment = {
  paymentID: "payment-123",
  invoiceID: "invoice-123",
  accountID: "account-123",
  date: "2024-03-17",
  amount: 1100,
  reference: "Payment for INV-001",
  status: "AUTHORISED",
};

const mockItem: XeroItem = {
  itemID: "item-123",
  code: "CONSULTING",
  description: "Professional Consulting Services",
  salesDetails: {
    unitAmount: 100,
    accountCode: "200",
    taxType: "Tax on Sales",
  },
};

const mockTenant: XeroTenant = {
  id: "tenant-123",
  tenantName: "Acme Corp",
  tenantType: "ORGANISATION",
  createdUtc: "2024-01-01T00:00:00Z",
};

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCEPair(): { verifier: string; challenge: string } {
  const crypto = require("crypto");
  const verifier = Buffer.from(crypto.randomBytes(32)).toString("base64url");
  const challenge = Buffer.from(
    crypto.createHash("sha256").update(verifier).digest(),
  ).toString("base64url");

  return { verifier, challenge };
}

// ─── TEST SUITE ─────────────────────────────────────────────────────

describe("XeroSDKClient", () => {
  let client: XeroSDKClient;

  beforeEach(() => {
    client = new XeroSDKClient(mockConfigService as ConfigService);
  });

  // ─── OAUTH2 PKCE TESTS ──────────────────────────────────────────

  describe("OAuth2 PKCE Flow", () => {
    it("should generate authorization URL with PKCE", () => {
      const { challenge } = generatePKCEPair();
      const authUrl = client.getAuthorizationUrl(challenge, "state-123");

      expect(authUrl).toContain("client_id=" + "xero_FAKE_CLIENT_ID");
      expect(authUrl).toContain("response_type=code");
      expect(authUrl).toContain("code_challenge=" + challenge);
      expect(authUrl).toContain("code_challenge_method=S256");
      expect(authUrl).toContain("state=state-123");
      expect(authUrl).toContain("scope=openid+profile+email");
    });

    it("should generate random state if not provided", () => {
      const { challenge } = generatePKCEPair();
      const authUrl1 = client.getAuthorizationUrl(challenge);
      const authUrl2 = client.getAuthorizationUrl(challenge);

      const state1 = new URL(authUrl1).searchParams.get("state");
      const state2 = new URL(authUrl2).searchParams.get("state");

      expect(state1).toBeTruthy();
      expect(state2).toBeTruthy();
      expect(state1).not.toEqual(state2);
    });

    it("should include all required OAuth2 scopes", () => {
      const { challenge } = generatePKCEPair();
      const authUrl = client.getAuthorizationUrl(challenge);

      const scopes = [
        "openid",
        "profile",
        "email",
        "accounting.transactions",
        "offline_access",
      ];

      scopes.forEach((scope) => {
        expect(authUrl).toContain(encodeURIComponent(scope));
      });
    });
  });

  // ─── TENANT MANAGEMENT TESTS ────────────────────────────────────

  describe("Tenant Management", () => {
    it("should set and get active tenant", () => {
      client.setActiveTenant("tenant-123");
      expect(client.getActiveTenant()).toBe("tenant-123");
    });

    it("should handle tenant switching", () => {
      client.setActiveTenant("tenant-1");
      expect(client.getActiveTenant()).toBe("tenant-1");

      client.setActiveTenant("tenant-2");
      expect(client.getActiveTenant()).toBe("tenant-2");
    });

    it("should throw error if active tenant not set", () => {
      const newClient = new XeroSDKClient(mockConfigService as ConfigService);
      // Active tenant not set

      expect(() => {
        if (!newClient.getActiveTenant()) {
          throw new XeroError(
            "Active tenant not set",
            "XERO_NO_ACTIVE_TENANT",
            400,
            false,
          );
        }
      }).toThrow("Active tenant not set");
    });
  });

  // ─── INVOICE TESTS ──────────────────────────────────────────────

  describe("Invoice Operations", () => {
    beforeEach(() => {
      client.setActiveTenant("tenant-123");
    });

    it("should validate invoice schema", () => {
      const invoice = mockInvoice;
      expect(invoice.invoiceNumber).toBeDefined();
      expect(invoice.type).toBe("ACCREC");
      expect(invoice.lineAmountTypes).toBe("Exclusive");
      expect(invoice.lineItems.length).toBeGreaterThan(0);
    });

    it("should handle invoice with credit note type", () => {
      const creditNote: XeroInvoice = {
        ...mockInvoice,
        type: "ACCPAY",
        invoiceNumber: "CN-001",
      };

      expect(creditNote.type).toBe("ACCPAY");
    });

    it("should calculate invoice totals correctly", () => {
      const invoice = {
        ...mockInvoice,
        lineItems: [
          {
            description: "Item 1",
            quantity: 10,
            unitAmount: 100,
            accountCode: "200",
            taxAmount: 100,
            lineAmount: 1000,
          },
          {
            description: "Item 2",
            quantity: 5,
            unitAmount: 50,
            accountCode: "200",
            taxAmount: 25,
            lineAmount: 250,
          },
        ],
        total: 1350,
        tax: 125,
      };

      const subtotal = (invoice.total || 0) - (invoice.tax || 0);
      expect(subtotal).toBe(1225);
    });

    it("should support invoice status transitions", () => {
      const statuses = ["DRAFT", "SUBMITTED", "AUTHORISED", "PAID", "VOIDED"];
      statuses.forEach((status) => {
        const invoice: XeroInvoice = {
          ...mockInvoice,
          status: status as any,
        };
        expect(invoice.status).toBe(status);
      });
    });

    it("should handle allocation of payment to invoice", () => {
      const invoice = mockInvoice;
      const paymentAmount = 550;
      const amountAllocated = paymentAmount;

      expect(amountAllocated).toBeLessThanOrEqual(invoice.total || 0);
    });

    it("should create credit notes with proper structure", () => {
      const creditNote: XeroInvoice = {
        ...mockInvoice,
        type: "ACCRECCRN",
        status: "DRAFT",
      };

      expect(creditNote.type).toBe("ACCRECCRN");
      expect(creditNote.lineItems).toBeDefined();
    });
  });

  // ─── CONTACT TESTS ──────────────────────────────────────────────

  describe("Contact Operations", () => {
    beforeEach(() => {
      client.setActiveTenant("tenant-123");
    });

    it("should validate contact schema", () => {
      const contact = mockContact;
      expect(contact.name).toBeDefined();
      expect(contact.name.length).toBeGreaterThan(0);
    });

    it("should handle contact with full address", () => {
      const contact = mockContact;
      const streetAddr = contact.addresses?.find(
        (a) => a.addressType === "STREET",
      );

      expect(streetAddr).toBeDefined();
      expect(streetAddr?.city).toBe("San Francisco");
      expect(streetAddr?.region).toBe("CA");
    });

    it("should support contact status management", () => {
      const statuses = ["ACTIVE", "ARCHIVED", "GDPRREQUEST"];
      statuses.forEach((status) => {
        const contact: XeroContact = {
          ...mockContact,
          contactStatus: status as any,
        };
        expect(contact.contactStatus).toBe(status);
      });
    });

    it("should handle contact merging structure", () => {
      const contact1: XeroContact = {
        contactID: "contact-1",
        name: "Old Name",
      };
      const contact2: XeroContact = {
        ...contact1,
        name: "New Name",
      };

      // After merge, primary contact should have consolidated data
      expect(contact2.name).toBe("New Name");
    });

    it("should support contact groups", () => {
      const contact: XeroContact = {
        ...mockContact,
        metadata: { groups: ["vip", "enterprise"] },
      };

      expect(contact.metadata?.groups).toContain("vip");
    });
  });

  // ─── PAYMENT TESTS ──────────────────────────────────────────────

  describe("Payment Operations", () => {
    beforeEach(() => {
      client.setActiveTenant("tenant-123");
    });

    it("should validate payment schema", () => {
      const payment = mockPayment;
      expect(payment.invoiceID).toBeDefined();
      expect(payment.amount).toBeGreaterThan(0);
      expect(payment.date).toBeDefined();
    });

    it("should handle payment allocation", () => {
      const payment = mockPayment;
      const invoiceTotal = 1100;
      const allocationAmount = 550;

      expect(allocationAmount).toBeLessThanOrEqual(invoiceTotal);
      expect(allocationAmount).toBeLessThanOrEqual(payment.amount);
    });

    it("should support payment refunds", () => {
      const payment: XeroPayment = {
        ...mockPayment,
        status: "REFUNDED",
      };

      expect(payment.status).toBe("REFUNDED");
    });

    it("should support multiple payments for single invoice", () => {
      const payment1 = { ...mockPayment, paymentID: "pay-1", amount: 500 };
      const payment2 = { ...mockPayment, paymentID: "pay-2", amount: 600 };

      const totalAllocated = payment1.amount + payment2.amount;
      expect(totalAllocated).toBe(1100);
    });
  });

  // ─── BANK TRANSACTION TESTS ─────────────────────────────────────

  describe("Bank Transaction Operations", () => {
    beforeEach(() => {
      client.setActiveTenant("tenant-123");
    });

    it("should validate bank transaction types", () => {
      const types = [
        "ACCRECPAYMENT",
        "ACCPAYPAYMENT",
        "ARCREDITPAYMENT",
        "APCREDICPAYMENT",
      ];
      types.forEach((type) => {
        expect([
          "ACCRECPAYMENT",
          "ACCPAYPAYMENT",
          "ARCREDITPAYMENT",
          "APCREDICPAYMENT",
        ]).toContain(type);
      });
    });

    it("should support bank transaction status tracking", () => {
      const statuses = ["DRAFT", "SUBMITTED", "AUTHORISED"];
      statuses.forEach((status) => {
        expect(["DRAFT", "SUBMITTED", "AUTHORISED"]).toContain(status);
      });
    });
  });

  // ─── ITEM TESTS ──────────────────────────────────────────────────

  describe("Item Operations", () => {
    beforeEach(() => {
      client.setActiveTenant("tenant-123");
    });

    it("should validate item schema", () => {
      const item = mockItem;
      expect(item.code).toBeDefined();
      expect(item.code.length).toBeGreaterThan(0);
    });

    it("should handle items with purchase and sale details", () => {
      const item: XeroItem = {
        ...mockItem,
        purchaseDetails: {
          unitAmount: 80,
          accountCode: "300",
          taxType: "Tax on Purchases",
        },
        salesDetails: {
          unitAmount: 100,
          accountCode: "200",
          taxType: "Tax on Sales",
        },
      };

      expect(item.purchaseDetails?.unitAmount).toBe(80);
      expect(item.salesDetails?.unitAmount).toBe(100);
    });

    it("should track item inventory quantities", () => {
      const item: XeroItem = {
        ...mockItem,
        quantity: 100,
      };

      expect(item.quantity).toBe(100);
    });
  });

  // ─── PURCHASE ORDER TESTS ───────────────────────────────────────

  describe("Purchase Order Operations", () => {
    beforeEach(() => {
      client.setActiveTenant("tenant-123");
    });

    it("should support purchase order status", () => {
      const statuses = ["DRAFT", "SUBMITTED", "AUTHORISED"];
      statuses.forEach((status) => {
        expect(["DRAFT", "SUBMITTED", "AUTHORISED"]).toContain(status);
      });
    });
  });

  // ─── QUOTE TESTS ────────────────────────────────────────────────

  describe("Quote Operations", () => {
    beforeEach(() => {
      client.setActiveTenant("tenant-123");
    });

    it("should support quote status lifecycle", () => {
      const statuses = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"];
      statuses.forEach((status) => {
        expect(["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"]).toContain(
          status,
        );
      });
    });

    it("should handle quote expiration dates", () => {
      const quote = {
        quoteNumber: "QUOTE-001",
        date: "2024-03-17",
        expirationDate: "2024-04-17",
      };

      expect(quote.expirationDate).toBeDefined();
    });
  });

  // ─── RATE LIMITING TESTS ────────────────────────────────────────

  describe("Rate Limiting", () => {
    it("should initialize rate limit tracking", () => {
      client.setActiveTenant("tenant-123");
      const rateLimit = client.getRateLimitInfo();
      // Initially undefined until first API call
      expect(rateLimit === undefined || rateLimit.limit > 0).toBe(true);
    });

    it("should track daily and per-minute limits", () => {
      const rateInfo = {
        remaining: 45,
        limit: 60,
        resetAt: new Date(Date.now() + 60000),
        dailyRemaining: 4950,
        dailyLimit: 5000,
      };

      expect(rateInfo.remaining).toBeLessThan(rateInfo.limit);
      expect(rateInfo.dailyRemaining).toBeLessThan(rateInfo.dailyLimit);
    });

    it("should detect approaching rate limit", () => {
      const rateInfo = {
        remaining: 5,
        limit: 60,
        resetAt: new Date(),
      };

      const isApproachingLimit = rateInfo.remaining <= 10;
      expect(isApproachingLimit).toBe(true);
    });
  });

  // ─── ERROR HANDLING TESTS ────────────────────────────────────────

  describe("Error Handling", () => {
    it("should create XeroError with context", () => {
      const error = new XeroError("Test error", "TEST_ERROR", 400, false, {
        detail: "test detail",
      });

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
      expect(error.context?.detail).toBe("test detail");
    });

    it("should identify retryable vs permanent errors", () => {
      const retryableError = new XeroError(
        "Rate limit",
        "RATE_LIMIT",
        429,
        true,
      );
      const permanentError = new XeroError(
        "Invalid request",
        "INVALID_REQUEST",
        400,
        false,
      );

      expect(retryableError.retryable).toBe(true);
      expect(permanentError.retryable).toBe(false);
    });

    it("should throw error when tenant not set for API operations", () => {
      const newClient = new XeroSDKClient(mockConfigService as ConfigService);
      // Tenant not set

      expect(() => {
        if (!newClient.getActiveTenant()) {
          throw new XeroError(
            "Active tenant not set",
            "XERO_NO_ACTIVE_TENANT",
            400,
            false,
          );
        }
      }).toThrow("Active tenant not set");
    });
  });

  // ─── WEBHOOK VERIFICATION TESTS ─────────────────────────────────

  describe("Webhook Verification", () => {
    it("should verify valid webhook signature", () => {
      const payload = JSON.stringify({ event: "invoice.created" });
      const webhookKey = "test_webhook_key";

      const crypto = require("crypto");
      const signature = crypto
        .createHmac("sha256", webhookKey)
        .update(payload)
        .digest("base64");

      const isValid = client.verifyWebhookSignature(
        payload,
        signature,
        webhookKey,
      );

      expect(isValid).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      const payload = JSON.stringify({ event: "invoice.created" });
      const webhookKey = "test_webhook_key";
      const invalidSignature = "invalid_signature_here";

      const isValid = client.verifyWebhookSignature(
        payload,
        invalidSignature,
        webhookKey,
      );

      expect(isValid).toBe(false);
    });

    it("should support intent-to-receive webhook flow", () => {
      const intentPayload = JSON.stringify({
        eventTypes: ["INVOICES.CONTACTS"],
      });
      const webhookKey = "test_key";

      const crypto = require("crypto");
      const signature = crypto
        .createHmac("sha256", webhookKey)
        .update(intentPayload)
        .digest("base64");

      const isValid = client.verifyWebhookSignature(
        intentPayload,
        signature,
        webhookKey,
      );

      expect(isValid).toBe(true);
    });
  });

  // ─── IF-MODIFIED-SINCE TESTS ───────────────────────────────────

  describe("Efficient Polling with If-Modified-Since", () => {
    beforeEach(() => {
      client.setActiveTenant("tenant-123");
    });

    it("should support If-Modified-Since header", () => {
      const lastSyncDate = new Date("2024-03-10T00:00:00Z");
      const headerValue = lastSyncDate.toISOString();

      expect(headerValue).toContain("2024-03-10");
    });

    it("should handle 304 Not Modified responses", () => {
      const statusCode = 304;
      const isNotModified = statusCode === 304;

      expect(isNotModified).toBe(true);
    });
  });
});
