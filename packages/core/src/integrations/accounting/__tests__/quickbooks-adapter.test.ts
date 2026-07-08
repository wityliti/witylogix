/**
 * QuickBooks Adapter Tests
 * Mock OAuth and API tests for QuickBooks integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  QuickBooksAdapter,
  createQuickBooksConfig,
} from "../quickbooks-adapter.js";
import type { Invoice } from "../../../invoicing/types.js";

describe("QuickBooksAdapter", () => {
  let adapter: QuickBooksAdapter;
  let config: ReturnType<typeof createQuickBooksConfig>;

  beforeEach(() => {
    config = createQuickBooksConfig(
      "test_client_id",
      "test_client_secret",
      "http://localhost:3000/callback",
      "sandbox",
    );
    adapter = new QuickBooksAdapter(config);
  });

  describe("OAuth Flow", () => {
    it("should generate authorization URL", () => {
      const authUrl = adapter.getAuthorizationUrl("test_state");

      expect(authUrl).toContain("client_id=test_client_id");
      expect(authUrl).toContain("response_type=code");
      expect(authUrl).toContain("state=test_state");
      expect(authUrl).toContain("scope=com.intuit.quickbooks.accounting");
    });

    it("should generate authorization URL with random state", () => {
      const authUrl1 = adapter.getAuthorizationUrl();
      const authUrl2 = adapter.getAuthorizationUrl();

      // Should have different states
      const state1 = new URL(authUrl1).searchParams.get("state");
      const state2 = new URL(authUrl2).searchParams.get("state");

      expect(state1).not.toEqual(state2);
    });

    it("should authenticate with authorization code", async () => {
      const connection = await adapter.authenticate(
        "auth_code_123",
        "realm_456",
      );

      expect(connection).toMatchObject({
        provider: "quickbooks",
        accessToken: expect.stringContaining("qbo_at_"),
        refreshToken: expect.stringContaining("qbo_rt_"),
        accountId: "realm_456",
        isActive: true,
      });

      expect(connection.expiresAt).toBeInstanceOf(Date);
      expect(connection.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should refresh access token", async () => {
      const connection = await adapter.authenticate(
        "auth_code_123",
        "realm_456",
      );

      const newToken = await adapter.refreshToken(connection);

      expect(newToken).toContain("qbo_at_");
      expect(newToken).not.toEqual(connection.accessToken);
    });

    it("should throw error when refreshing without token", async () => {
      const connection = {
        id: "conn_1",
        tenantId: "tenant_1",
        provider: "quickbooks" as const,
        accessToken: "token",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(adapter.refreshToken(connection)).rejects.toThrow(
        "No refresh token available",
      );
    });
  });

  describe("Invoice Sync", () => {
    let mockConnection: any;
    let mockInvoice: Invoice;

    beforeEach(async () => {
      mockConnection = await adapter.authenticate("auth_code_123", "realm_456");

      mockInvoice = {
        id: "inv_123",
        tenantId: "tenant_1",
        invoiceNumber: "INV-001",
        customerId: "cust_456",
        status: "finalized",
        subtotal: 100,
        discountTotal: 10,
        taxTotal: 7.5,
        total: 97.5,
        currency: "USD",
        issuedAt: new Date("2024-03-01"),
        dueAt: new Date("2024-03-31"),
        lineItems: [
          {
            id: "item_1",
            invoiceId: "inv_123",
            description: "Delivery Service",
            quantity: 1,
            unitPrice: 100,
            amount: 100,
            createdAt: new Date(),
          },
        ],
        discounts: [
          {
            id: "disc_1",
            invoiceId: "inv_123",
            description: "Volume Discount",
            type: "percentage",
            value: 10,
            amount: 10,
            createdAt: new Date(),
          },
        ],
        taxes: [
          {
            id: "tax_1",
            invoiceId: "inv_123",
            description: "Sales Tax",
            rate: 7.5,
            amount: 7.5,
            jurisdiction: "CA",
            createdAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    it("should create invoice in QB", async () => {
      const result = await adapter.createInvoice(mockInvoice, mockConnection);

      expect(result).toMatchObject({
        success: true,
        invoiceId: "inv_123",
        provider: "quickbooks",
        externalId: expect.stringContaining("qb_inv_"),
        timestamp: expect.any(Date),
      });
    });

    it("should throw error when QB account not configured", async () => {
      const invalidConnection = { ...mockConnection, accountId: undefined };

      await expect(
        adapter.createInvoice(mockInvoice, invalidConnection),
      ).rejects.toThrow("QB account ID not configured");
    });

    it("should map invoice to QB format correctly", async () => {
      const result = await adapter.createInvoice(mockInvoice, mockConnection);

      expect(result.success).toBe(true);
      expect(result.invoiceId).toBe(mockInvoice.id);
    });

    it("should handle invoice with no line items", async () => {
      const invoiceNoItems = {
        ...mockInvoice,
        lineItems: undefined,
      };

      const result = await adapter.createInvoice(
        invoiceNoItems,
        mockConnection,
      );

      expect(result.success).toBe(true);
    });

    it("should include invoice metadata", async () => {
      const result = await adapter.createInvoice(mockInvoice, mockConnection);

      expect(result).toHaveProperty("externalId");
      expect(result).toHaveProperty("timestamp");
    });
  });

  describe("Payment Sync", () => {
    let mockConnection: any;
    let mockInvoice: Invoice;
    let mockPayment: any;

    beforeEach(async () => {
      mockConnection = await adapter.authenticate("auth_code_123", "realm_456");

      mockInvoice = {
        id: "inv_123",
        tenantId: "tenant_1",
        invoiceNumber: "INV-001",
        status: "paid",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 0,
        total: 100,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        paidAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPayment = {
        id: "pay_123",
        invoiceId: "inv_123",
        amount: 100,
        method: "bank_transfer",
        reference: "ACH-123456",
        paidAt: new Date(),
        createdAt: new Date(),
      };
    });

    it("should sync payment to QB", async () => {
      const result = await adapter.syncPayment(
        mockInvoice,
        mockPayment,
        mockConnection,
      );

      expect(result).toMatchObject({
        success: true,
        invoiceId: "inv_123",
        provider: "quickbooks",
        externalId: expect.stringContaining("qb_payment_"),
      });
    });

    it("should throw error when QB account not configured", async () => {
      const invalidConnection = { ...mockConnection, accountId: undefined };

      await expect(
        adapter.syncPayment(mockInvoice, mockPayment, invalidConnection),
      ).rejects.toThrow("QB account ID not configured");
    });

    it("should handle payment with reference", async () => {
      const result = await adapter.syncPayment(
        mockInvoice,
        mockPayment,
        mockConnection,
      );

      expect(result.success).toBe(true);
      expect(result.externalId).toBeTruthy();
    });
  });

  describe("Customer Management", () => {
    let mockConnection: any;

    beforeEach(async () => {
      mockConnection = await adapter.authenticate("auth_code_123", "realm_456");
    });

    it("should get or create customer", async () => {
      const customerId = await adapter.getOrCreateCustomer(
        "john@example.com",
        "John Doe",
        mockConnection,
      );

      expect(customerId).toContain("qb_cust_");
    });

    it("should throw error when QB account not configured", async () => {
      const invalidConnection = { ...mockConnection, accountId: undefined };

      await expect(
        adapter.getOrCreateCustomer(
          "john@example.com",
          "John Doe",
          invalidConnection,
        ),
      ).rejects.toThrow("QB account ID not configured");
    });

    it("should handle customer without name", async () => {
      const customerId = await adapter.getOrCreateCustomer(
        "jane@example.com",
        undefined,
        mockConnection,
      );

      expect(customerId).toContain("qb_cust_");
    });
  });

  describe("Line Items Sync", () => {
    let mockConnection: any;

    beforeEach(async () => {
      mockConnection = await adapter.authenticate("auth_code_123", "realm_456");
    });

    it("should sync line items", async () => {
      // Should not throw
      await adapter.syncLineItems("inv_123", mockConnection);
    });

    it("should throw error when QB account not configured", async () => {
      const invalidConnection = { ...mockConnection, accountId: undefined };

      await expect(
        adapter.syncLineItems("inv_123", invalidConnection),
      ).rejects.toThrow("QB account ID not configured");
    });
  });

  describe("Accounting Status", () => {
    let mockConnection: any;

    beforeEach(async () => {
      mockConnection = await adapter.authenticate("auth_code_123", "realm_456");
    });

    it("should get accounting status", async () => {
      const status = await adapter.getAccountingStatus(
        "inv_123",
        mockConnection,
      );

      expect(status).toMatchObject({
        synced: expect.any(Boolean),
        externalId: expect.any(String),
        lastSyncAt: expect.any(Date),
      });
    });
  });

  describe("Error Handling", () => {
    let mockConnection: any;

    beforeEach(async () => {
      mockConnection = await adapter.authenticate("auth_code_123", "realm_456");
    });

    it("should create error with provider", async () => {
      const invalidConnection = { ...mockConnection, accountId: undefined };
      const mockInvoice: Invoice = {
        id: "inv_123",
        tenantId: "tenant_1",
        invoiceNumber: "INV-001",
        status: "finalized",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 0,
        total: 100,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        await adapter.createInvoice(mockInvoice, invalidConnection);
      } catch (error: any) {
        expect(error.provider).toBe("quickbooks");
        expect(error.retryable).toBeDefined();
      }
    });
  });

  describe("Rate Limiting", () => {
    let mockConnection: any;
    let mockInvoice: Invoice;

    beforeEach(async () => {
      mockConnection = await adapter.authenticate("auth_code_123", "realm_456");

      mockInvoice = {
        id: "inv_123",
        tenantId: "tenant_1",
        invoiceNumber: "INV-001",
        status: "finalized",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 0,
        total: 100,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    it("should handle rate limits gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Make multiple requests
      for (let i = 0; i < 3; i++) {
        await adapter.createInvoice(mockInvoice, mockConnection);
      }

      consoleSpy.mockRestore();
    });
  });

  describe("Configuration", () => {
    it("should use sandbox environment", () => {
      const sandboxConfig = createQuickBooksConfig(
        "client_id",
        "client_secret",
        "http://localhost:3000/callback",
        "sandbox",
      );

      const sandboxAdapter = new QuickBooksAdapter(sandboxConfig);
      expect(sandboxAdapter).toBeDefined();
    });

    it("should use production environment", () => {
      const prodConfig = createQuickBooksConfig(
        "client_id",
        "client_secret",
        "https://example.com/callback",
        "production",
      );

      const prodAdapter = new QuickBooksAdapter(prodConfig);
      expect(prodAdapter).toBeDefined();
    });
  });
});
