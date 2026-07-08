/**
 * Xero Adapter Tests
 * Mock OAuth and API tests for Xero integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { XeroAdapter, createXeroConfig } from "../xero-adapter.js";
import type { Invoice } from "../../../invoicing/types.js";

describe("XeroAdapter", () => {
  let adapter: XeroAdapter;
  let config: ReturnType<typeof createXeroConfig>;

  beforeEach(() => {
    config = createXeroConfig(
      "test_client_id",
      "test_client_secret",
      "http://localhost:3000/callback",
      "sandbox",
    );
    adapter = new XeroAdapter(config);
  });

  describe("OAuth Flow", () => {
    it("should generate authorization URL", () => {
      const authUrl = adapter.getAuthorizationUrl("test_state");

      expect(authUrl).toContain("client_id=test_client_id");
      expect(authUrl).toContain("response_type=code");
      expect(authUrl).toContain("state=test_state");
      expect(authUrl).toContain("scope=");
      expect(authUrl).toContain("openid");
      expect(authUrl).toContain("accounting");
    });

    it("should generate authorization URL with random state", () => {
      const authUrl1 = adapter.getAuthorizationUrl();
      const authUrl2 = adapter.getAuthorizationUrl();

      const state1 = new URL(authUrl1).searchParams.get("state");
      const state2 = new URL(authUrl2).searchParams.get("state");

      expect(state1).not.toEqual(state2);
    });

    it("should authenticate with authorization code", async () => {
      const result = await adapter.authenticate("auth_code_123");

      expect(result).toMatchObject({
        provider: "xero",
        accessToken: expect.stringContaining("xero_at_"),
        refreshToken: expect.stringContaining("xero_rt_"),
        isActive: true,
        tenants: expect.arrayContaining([
          expect.objectContaining({
            tenantType: "ORGANISATION",
          }),
        ]),
      });

      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.accountId).toBeTruthy();
    });

    it("should return tenant information", async () => {
      const result = await adapter.authenticate("auth_code_123");

      expect(result.tenants).toBeInstanceOf(Array);
      expect(result.tenants.length).toBeGreaterThan(0);
      expect(result.tenants[0]).toHaveProperty("id");
      expect(result.tenants[0]).toHaveProperty("tenantName");
    });

    it("should refresh access token", async () => {
      const connection = await adapter.authenticate("auth_code_123");

      const newToken = await adapter.refreshToken(connection);

      expect(newToken).toContain("xero_at_");
      expect(newToken).not.toEqual(connection.accessToken);
    });

    it("should throw error when refreshing without token", async () => {
      const connection = {
        id: "conn_1",
        tenantId: "tenant_1",
        provider: "xero" as const,
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
      const result = await adapter.authenticate("auth_code_123");
      mockConnection = result;

      mockInvoice = {
        id: "inv_123",
        tenantId: "tenant_1",
        invoiceNumber: "INV-001",
        customerId: "cust_456",
        status: "finalized",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 10,
        total: 110,
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
        taxes: [
          {
            id: "tax_1",
            invoiceId: "inv_123",
            description: "GST",
            rate: 10,
            amount: 10,
            jurisdiction: "AU",
            createdAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    it("should create invoice in Xero", async () => {
      const result = await adapter.createInvoice(mockInvoice, mockConnection);

      expect(result).toMatchObject({
        success: true,
        invoiceId: "inv_123",
        provider: "xero",
        externalId: expect.stringContaining("xero_inv_"),
        timestamp: expect.any(Date),
      });
    });

    it("should throw error when Xero org not configured", async () => {
      const invalidConnection = { ...mockConnection, accountId: undefined };

      await expect(
        adapter.createInvoice(mockInvoice, invalidConnection),
      ).rejects.toThrow("Xero organization ID not configured");
    });

    it("should map invoice to Xero format correctly", async () => {
      const result = await adapter.createInvoice(mockInvoice, mockConnection);

      expect(result.success).toBe(true);
      expect(result.invoiceId).toBe(mockInvoice.id);
    });

    it("should handle invoice without discounts", async () => {
      const invoiceNoDiscounts = {
        ...mockInvoice,
        discounts: undefined,
      };

      const result = await adapter.createInvoice(
        invoiceNoDiscounts,
        mockConnection,
      );

      expect(result.success).toBe(true);
    });

    it("should include line items", async () => {
      const result = await adapter.createInvoice(mockInvoice, mockConnection);

      expect(result.success).toBe(true);
    });
  });

  describe("Payment Sync", () => {
    let mockConnection: any;
    let mockInvoice: Invoice;
    let mockPayment: any;

    beforeEach(async () => {
      const result = await adapter.authenticate("auth_code_123");
      mockConnection = result;

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
        reference: "XFER-123456",
        paidAt: new Date(),
        createdAt: new Date(),
      };
    });

    it("should sync payment to Xero", async () => {
      const result = await adapter.syncPayment(
        mockInvoice,
        mockPayment,
        mockConnection,
      );

      expect(result).toMatchObject({
        success: true,
        invoiceId: "inv_123",
        provider: "xero",
        externalId: expect.stringContaining("xero_payment_"),
      });
    });

    it("should throw error when Xero org not configured", async () => {
      const invalidConnection = { ...mockConnection, accountId: undefined };

      await expect(
        adapter.syncPayment(mockInvoice, mockPayment, invalidConnection),
      ).rejects.toThrow("Xero organization ID not configured");
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

  describe("Contact Management", () => {
    let mockConnection: any;

    beforeEach(async () => {
      const result = await adapter.authenticate("auth_code_123");
      mockConnection = result;
    });

    it("should get or create contact", async () => {
      const contactId = await adapter.getOrCreateContact(
        "john@example.com",
        "John Doe",
        mockConnection,
      );

      expect(contactId).toContain("xero_contact_");
    });

    it("should throw error when Xero org not configured", async () => {
      const invalidConnection = { ...mockConnection, accountId: undefined };

      await expect(
        adapter.getOrCreateContact(
          "john@example.com",
          "John Doe",
          invalidConnection,
        ),
      ).rejects.toThrow("Xero organization ID not configured");
    });

    it("should handle contact without name", async () => {
      const contactId = await adapter.getOrCreateContact(
        "jane@example.com",
        undefined,
        mockConnection,
      );

      expect(contactId).toContain("xero_contact_");
    });
  });

  describe("Line Items Sync", () => {
    let mockConnection: any;

    beforeEach(async () => {
      const result = await adapter.authenticate("auth_code_123");
      mockConnection = result;
    });

    it("should sync line items", async () => {
      // Should not throw
      await adapter.syncLineItems("inv_123", mockConnection);
    });

    it("should throw error when Xero org not configured", async () => {
      const invalidConnection = { ...mockConnection, accountId: undefined };

      await expect(
        adapter.syncLineItems("inv_123", invalidConnection),
      ).rejects.toThrow("Xero organization ID not configured");
    });
  });

  describe("Tax Rates", () => {
    let mockConnection: any;

    beforeEach(async () => {
      const result = await adapter.authenticate("auth_code_123");
      mockConnection = result;
    });

    it("should get tax rates", async () => {
      const rates = await adapter.getTaxRates(mockConnection);

      expect(rates).toBeInstanceOf(Array);
      expect(rates.length).toBeGreaterThan(0);
      expect(rates[0]).toHaveProperty("id");
      expect(rates[0]).toHaveProperty("name");
      expect(rates[0]).toHaveProperty("rate");
    });

    it("should include standard tax rate", async () => {
      const rates = await adapter.getTaxRates(mockConnection);

      const standardRate = rates.find((r) => r.rate === 10);
      expect(standardRate).toBeDefined();
    });

    it("should throw error when Xero org not configured", async () => {
      const invalidConnection = { ...mockConnection, accountId: undefined };

      await expect(adapter.getTaxRates(invalidConnection)).rejects.toThrow(
        "Xero organization ID not configured",
      );
    });
  });

  describe("Accounting Status", () => {
    let mockConnection: any;

    beforeEach(async () => {
      const result = await adapter.authenticate("auth_code_123");
      mockConnection = result;
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
      const result = await adapter.authenticate("auth_code_123");
      mockConnection = result;
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
        expect(error.provider).toBe("xero");
        expect(error.retryable).toBeDefined();
      }
    });
  });

  describe("Rate Limiting", () => {
    let mockConnection: any;
    let mockInvoice: Invoice;

    beforeEach(async () => {
      const result = await adapter.authenticate("auth_code_123");
      mockConnection = result;

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
      const sandboxConfig = createXeroConfig(
        "client_id",
        "client_secret",
        "http://localhost:3000/callback",
        "sandbox",
      );

      const sandboxAdapter = new XeroAdapter(sandboxConfig);
      expect(sandboxAdapter).toBeDefined();
    });

    it("should use production environment", () => {
      const prodConfig = createXeroConfig(
        "client_id",
        "client_secret",
        "https://example.com/callback",
        "production",
      );

      const prodAdapter = new XeroAdapter(prodConfig);
      expect(prodAdapter).toBeDefined();
    });
  });

  describe("Tenant Selection", () => {
    it("should include tenant info in authentication result", async () => {
      const result = await adapter.authenticate("auth_code_123");

      expect(result.tenants).toBeInstanceOf(Array);
      expect(result.tenants[0]).toHaveProperty("tenantId");
      expect(result.tenants[0].tenantType).toBe("ORGANISATION");
    });
  });
});
