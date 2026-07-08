/**
 * WooCommerce Order Sync Tests
 * Tests for order field mapping, status transitions, and conflict resolution
 */

import { describe, it, expect } from "vitest";
import { OrderSyncService } from "../order-sync.js";
import type { WCOrder, WLOrderStatus } from "../types.js";

describe("OrderSyncService", () => {
  describe("Status Mapping", () => {
    describe("WooCommerce to Witylogix", () => {
      it("should map pending to pending", () => {
        const status = OrderSyncService.mapWCStatusToWL("pending");
        expect(status).toBe("pending");
      });

      it("should map processing to confirmed", () => {
        const status = OrderSyncService.mapWCStatusToWL("processing");
        expect(status).toBe("confirmed");
      });

      it("should map on-hold to pending", () => {
        const status = OrderSyncService.mapWCStatusToWL("on-hold");
        expect(status).toBe("pending");
      });

      it("should map completed to delivered", () => {
        const status = OrderSyncService.mapWCStatusToWL("completed");
        expect(status).toBe("delivered");
      });

      it("should map cancelled to cancelled", () => {
        const status = OrderSyncService.mapWCStatusToWL("cancelled");
        expect(status).toBe("cancelled");
      });

      it("should map refunded to cancelled", () => {
        const status = OrderSyncService.mapWCStatusToWL("refunded");
        expect(status).toBe("cancelled");
      });

      it("should map failed to pending", () => {
        const status = OrderSyncService.mapWCStatusToWL("failed");
        expect(status).toBe("pending");
      });
    });

    describe("Witylogix to WooCommerce", () => {
      it("should map pending to pending", () => {
        const status = OrderSyncService.mapWLStatusToWC("pending");
        expect(status).toBe("pending");
      });

      it("should map confirmed to processing", () => {
        const status = OrderSyncService.mapWLStatusToWC("confirmed");
        expect(status).toBe("processing");
      });

      it("should map dispatched to processing", () => {
        const status = OrderSyncService.mapWLStatusToWC("dispatched");
        expect(status).toBe("processing");
      });

      it("should map out_for_delivery to processing", () => {
        const status = OrderSyncService.mapWLStatusToWC("out_for_delivery");
        expect(status).toBe("processing");
      });

      it("should map delivered to completed", () => {
        const status = OrderSyncService.mapWLStatusToWC("delivered");
        expect(status).toBe("completed");
      });

      it("should map cancelled to cancelled", () => {
        const status = OrderSyncService.mapWLStatusToWC("cancelled");
        expect(status).toBe("cancelled");
      });

      it("should map returned to refunded", () => {
        const status = OrderSyncService.mapWLStatusToWC("returned");
        expect(status).toBe("refunded");
      });
    });
  });

  describe("Order Field Mapping", () => {
    it("should map WC order to WL order format", () => {
      const wcOrder: WCOrder = {
        id: 123,
        parent_id: 0,
        number: "456",
        order_key: "key123",
        created_via: "checkout",
        version: "1.0",
        status: "processing",
        currency: "USD",
        date_created: "2024-01-01T10:00:00Z",
        date_created_gmt: "2024-01-01T10:00:00Z",
        date_modified: "2024-01-02T10:00:00Z",
        date_modified_gmt: "2024-01-02T10:00:00Z",
        discount_total: "0",
        discount_tax: "0",
        shipping_total: "10",
        shipping_tax: "0",
        cart_tax: "5",
        total: "105",
        total_tax: "5",
        customer_id: 456,
        customer_note: "Please ring doorbell",
        billing: {
          first_name: "John",
          last_name: "Doe",
          company: "Acme",
          address_1: "123 Main St",
          address_2: "",
          city: "Springfield",
          state: "IL",
          postcode: "62701",
          country: "US",
          email: "john@example.com",
          phone: "555-1234",
        },
        shipping: {
          first_name: "John",
          last_name: "Doe",
          company: "Acme",
          address_1: "456 Oak Ave",
          address_2: "",
          city: "Springfield",
          state: "IL",
          postcode: "62702",
          country: "US",
        },
        payment_method: "card",
        payment_method_title: "Credit Card",
        transaction_id: "txn123",
        date_paid: "2024-01-01T10:30:00Z",
        date_completed: "2024-01-02T15:00:00Z",
        cart_hash: "hash123",
        meta_data: [],
        line_items: [
          {
            id: 1,
            name: "Test Product",
            product_id: 789,
            variation_id: 0,
            quantity: 2,
            tax_class: "standard",
            subtotal: "50",
            subtotal_tax: "5",
            total: "90",
            total_tax: "5",
            taxes: [],
            meta_data: [],
            sku: "SKU123",
            price: 45,
          },
        ],
        tax_lines: [],
        shipping_lines: [],
        fee_lines: [],
        coupon_lines: [],
      };

      const mapped = OrderSyncService.syncOrderFromWC(wcOrder);

      expect(mapped.externalId).toBe("123");
      expect(mapped.externalOrderNumber).toBe("456");
      expect(mapped.status).toBe("confirmed");
      expect((mapped.customer as any).firstName).toBe("John");
      expect((mapped.customer as any).lastName).toBe("Doe");
      expect((mapped.items as any[]).length).toBe(1);
      expect((mapped.deliveryAddress as any).street).toBe("456 Oak Ave");
    });

    it("should map WL order to WC update format", () => {
      const wlOrder = {
        status: "delivered" as WLOrderStatus,
        notes: "Order delivered successfully",
        metaFields: {
          trackingNumber: "TRACK123",
        },
      };

      const mapped = OrderSyncService.syncOrderToWC(wlOrder);

      expect(mapped.status).toBe("completed");
      expect(mapped.customer_note).toBe("Order delivered successfully");
      expect(mapped.meta_data).toBeDefined();
    });
  });

  describe("Conflict Resolution", () => {
    it("should resolve conflict using last-write-wins with WL newer", () => {
      const wlTime = new Date("2024-01-02T15:00:00Z");
      const wcTime = new Date("2024-01-01T10:00:00Z");

      const result = OrderSyncService.resolveConflict(wlTime, wcTime, "status");

      expect(result.winner).toBe("wl");
      expect(result.reason).toContain("Witylogix version");
    });

    it("should resolve conflict using last-write-wins with WC newer", () => {
      const wlTime = new Date("2024-01-01T10:00:00Z");
      const wcTime = new Date("2024-01-02T15:00:00Z");

      const result = OrderSyncService.resolveConflict(wlTime, wcTime, "status");

      expect(result.winner).toBe("wc");
      expect(result.reason).toContain("WooCommerce version");
    });
  });

  describe("Meta Fields", () => {
    it("should extract non-system meta fields", () => {
      const metaData = [
        { id: 1, key: "custom_field", value: "custom_value" },
        { id: 2, key: "_internal", value: "should_skip" },
        { id: 3, key: "tracking", value: { number: "123" } },
      ];

      const result = OrderSyncService.extractMetaFields(metaData);

      expect(result.custom_field).toBe("custom_value");
      expect(result.tracking).toEqual({ number: "123" });
      expect(result._internal).toBeUndefined();
    });

    it("should build meta_data from WL fields", () => {
      const fields = {
        trackingNumber: "TRACK123",
        deliveryNotes: "Left at door",
      };

      const result = OrderSyncService.buildMetaData(fields);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe("trackingNumber");
      expect(result[0].value).toBe("TRACK123");
    });
  });

  describe("Validation", () => {
    it("should validate complete order", () => {
      const validOrder: WCOrder = {
        id: 123,
        parent_id: 0,
        number: "456",
        order_key: "key",
        created_via: "checkout",
        version: "1.0",
        status: "processing",
        currency: "USD",
        date_created: "2024-01-01T10:00:00Z",
        date_created_gmt: "2024-01-01T10:00:00Z",
        date_modified: "2024-01-02T10:00:00Z",
        date_modified_gmt: "2024-01-02T10:00:00Z",
        discount_total: "0",
        discount_tax: "0",
        shipping_total: "10",
        shipping_tax: "0",
        cart_tax: "5",
        total: "105",
        total_tax: "5",
        customer_id: 456,
        customer_note: "",
        billing: {
          first_name: "John",
          last_name: "Doe",
          company: "",
          address_1: "123 Main",
          address_2: "",
          city: "City",
          state: "ST",
          postcode: "12345",
          country: "US",
          email: "john@example.com",
        },
        shipping: {
          first_name: "John",
          last_name: "Doe",
          company: "",
          address_1: "456 Oak",
          address_2: "",
          city: "City",
          state: "ST",
          postcode: "12345",
          country: "US",
        },
        payment_method: "card",
        payment_method_title: "Card",
        transaction_id: "txn",
        date_paid: null,
        date_completed: null,
        cart_hash: "hash",
        meta_data: [],
        line_items: [
          {
            id: 1,
            name: "Product",
            product_id: 1,
            variation_id: 0,
            quantity: 1,
            tax_class: "",
            subtotal: "100",
            subtotal_tax: "5",
            total: "105",
            total_tax: "5",
            taxes: [],
            meta_data: [],
            sku: "SKU",
            price: 105,
          },
        ],
        tax_lines: [],
        shipping_lines: [],
        fee_lines: [],
        coupon_lines: [],
      };

      const result = OrderSyncService.validateOrder(validOrder);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject order without ID", () => {
      const invalidOrder: Partial<WCOrder> = {
        id: 0,
        customer_note: "",
      };

      const result = OrderSyncService.validateOrder(invalidOrder as WCOrder);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("ID"))).toBe(true);
    });

    it("should reject order without line items", () => {
      const invalidOrder: Partial<WCOrder> = {
        id: 123,
        line_items: [],
      };

      const result = OrderSyncService.validateOrder(invalidOrder as WCOrder);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("line item"))).toBe(true);
    });
  });

  describe("Order Summary", () => {
    it("should calculate order summary correctly", () => {
      const order: Partial<WCOrder> = {
        total: "105",
        shipping_total: "10",
        total_tax: "5",
        line_items: [{ quantity: 2 }, { quantity: 1 }] as any,
      };

      const summary = OrderSyncService.calculateOrderSummary(order as WCOrder);

      expect(summary.itemCount).toBe(3);
      expect(summary.total).toBe(105);
      expect(summary.shipping).toBe(10);
      expect(summary.tax).toBe(5);
    });
  });
});
