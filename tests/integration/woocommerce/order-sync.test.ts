/**
 * WooCommerce Order Sync Tests
 * Tests bidirectional order field mapping, status transitions, meta field handling,
 * guest customer handling, and conflict resolution
 */

import { describe, it, expect, beforeEach } from "vitest";
import { OrderSyncService } from "../../../packages/core/src/integrations/woocommerce/order-sync.js";
import type { WCOrder, WCOrderStatus, WLOrderStatus } from "../../../packages/core/src/integrations/woocommerce/types.js";

describe("OrderSyncService", () => {
  describe("WC to WL Status Mapping", () => {
    const testCases: Array<[WCOrderStatus, WLOrderStatus]> = [
      ["pending", "pending"],
      ["processing", "confirmed"],
      ["on-hold", "pending"],
      ["completed", "delivered"],
      ["cancelled", "cancelled"],
      ["refunded", "cancelled"],
      ["failed", "pending"],
    ];

    testCases.forEach(([wcStatus, wlStatus]) => {
      it(`should map WC "${wcStatus}" to WL "${wlStatus}"`, () => {
        const mapped = OrderSyncService.mapWCStatusToWL(wcStatus);
        expect(mapped).toBe(wlStatus);
      });
    });

    it("should default to pending for unknown WC status", () => {
      const mapped = OrderSyncService.mapWCStatusToWL("unknown" as WCOrderStatus);
      expect(mapped).toBe("pending");
    });
  });

  describe("WL to WC Status Mapping", () => {
    const testCases: Array<[WLOrderStatus, WCOrderStatus]> = [
      ["pending", "pending"],
      ["confirmed", "processing"],
      ["dispatched", "processing"],
      ["out_for_delivery", "processing"],
      ["delivered", "completed"],
      ["cancelled", "cancelled"],
      ["returned", "refunded"],
    ];

    testCases.forEach(([wlStatus, wcStatus]) => {
      it(`should map WL "${wlStatus}" to WC "${wcStatus}"`, () => {
        const mapped = OrderSyncService.mapWLStatusToWC(wlStatus);
        expect(mapped).toBe(wcStatus);
      });
    });

    it("should default to pending for unknown WL status", () => {
      const mapped = OrderSyncService.mapWLStatusToWC("unknown" as WLOrderStatus);
      expect(mapped).toBe("pending");
    });
  });

  describe("WC Order to WL Order Field Mapping", () => {
    let mockWCOrder: WCOrder;

    beforeEach(() => {
      mockWCOrder = {
        id: 12345,
        parent_id: 0,
        number: "WC-2024-001",
        order_key: "wc_order_key_123",
        created_via: "checkout",
        version: "8.0.0",
        status: "processing",
        currency: "USD",
        date_created: "2024-03-01T10:30:00",
        date_created_gmt: "2024-03-01T10:30:00",
        date_modified: "2024-03-01T11:00:00",
        date_modified_gmt: "2024-03-01T11:00:00",
        discount_total: "0.00",
        discount_tax: "0.00",
        shipping_total: "10.00",
        shipping_tax: "0.00",
        cart_tax: "7.50",
        total: "107.50",
        total_tax: "7.50",
        customer_id: 456,
        customer_note: "Special instructions here",
        billing: {
          first_name: "John",
          last_name: "Doe",
          company: "Acme Corp",
          address_1: "123 Main St",
          address_2: "Suite 100",
          city: "New York",
          state: "NY",
          postcode: "10001",
          country: "US",
          email: "john@example.com",
          phone: "+1234567890",
        },
        shipping: {
          first_name: "Jane",
          last_name: "Doe",
          company: "Acme Corp",
          address_1: "456 Oak Ave",
          address_2: "Apt 200",
          city: "Brooklyn",
          state: "NY",
          postcode: "11001",
          country: "US",
          email: "jane@example.com",
          phone: "+1234567891",
        },
        payment_method: "credit_card",
        payment_method_title: "Credit Card",
        transaction_id: "txn_123456",
        date_paid: "2024-03-01T10:35:00",
        date_completed: null,
        cart_hash: "hash_abc123",
        meta_data: [
          { id: 1, key: "delivery_date", value: "2024-03-02" },
          { id: 2, key: "time_slot", value: "09:00-11:00" },
          { id: 3, key: "_system_internal", value: "hidden" },
        ],
        line_items: [
          {
            id: 1,
            name: "Widget A",
            product_id: 101,
            variation_id: 0,
            quantity: 2,
            tax_class: "standard",
            subtotal: "50.00",
            subtotal_tax: "3.75",
            total: "50.00",
            total_tax: "3.75",
            taxes: [],
            meta_data: [],
            sku: "WIDGET-A",
            price: 25.0,
          },
          {
            id: 2,
            name: "Widget B",
            product_id: 102,
            variation_id: 0,
            quantity: 3,
            tax_class: "standard",
            subtotal: "40.00",
            subtotal_tax: "3.75",
            total: "40.00",
            total_tax: "3.75",
            taxes: [],
            meta_data: [],
            sku: "WIDGET-B",
            price: 13.33,
          },
        ],
        tax_lines: [],
        shipping_lines: [],
        fee_lines: [],
        coupon_lines: [],
      };
    });

    it("should map basic order fields", () => {
      const synced = OrderSyncService.syncOrderFromWC(mockWCOrder);

      expect(synced.externalId).toBe("12345");
      expect(synced.externalOrderNumber).toBe("WC-2024-001");
      expect(synced.status).toBe("confirmed");
      expect(synced.notes).toBe("Special instructions here");
    });

    it("should map customer information", () => {
      const synced = OrderSyncService.syncOrderFromWC(mockWCOrder) as Record<string, any>;

      expect(synced.customer.firstName).toBe("John");
      expect(synced.customer.lastName).toBe("Doe");
      expect(synced.customer.email).toBe("john@example.com");
      expect(synced.customer.phone).toBe("+1234567890");
    });

    it("should map delivery address", () => {
      const synced = OrderSyncService.syncOrderFromWC(mockWCOrder) as Record<string, any>;

      expect(synced.deliveryAddress.street).toBe("456 Oak Ave");
      expect(synced.deliveryAddress.street2).toBe("Apt 200");
      expect(synced.deliveryAddress.city).toBe("Brooklyn");
      expect(synced.deliveryAddress.state).toBe("NY");
      expect(synced.deliveryAddress.postalCode).toBe("11001");
      expect(synced.deliveryAddress.country).toBe("US");
    });

    it("should map billing address", () => {
      const synced = OrderSyncService.syncOrderFromWC(mockWCOrder) as Record<string, any>;

      expect(synced.billingAddress.street).toBe("123 Main St");
      expect(synced.billingAddress.street2).toBe("Suite 100");
      expect(synced.billingAddress.city).toBe("New York");
      expect(synced.billingAddress.state).toBe("NY");
      expect(synced.billingAddress.postalCode).toBe("10001");
      expect(synced.billingAddress.country).toBe("US");
    });

    it("should map all line items with correct properties", () => {
      const synced = OrderSyncService.syncOrderFromWC(mockWCOrder) as Record<string, any>;

      expect(synced.items).toHaveLength(2);
      expect(synced.items[0]).toMatchObject({
        externalId: "1",
        productId: "101",
        sku: "WIDGET-A",
        name: "Widget A",
        quantity: 2,
        unitPrice: 25.0,
        total: 50.0,
      });
      expect(synced.items[1]).toMatchObject({
        externalId: "2",
        productId: "102",
        sku: "WIDGET-B",
        name: "Widget B",
        quantity: 3,
        unitPrice: 13.33,
        total: 40.0,
      });
    });

    it("should map financial totals", () => {
      const synced = OrderSyncService.syncOrderFromWC(mockWCOrder) as Record<string, any>;

      expect(synced.subtotal).toBe(100);
      expect(synced.shippingCost).toBe(10);
      expect(synced.tax).toBe(7.5);
      expect(synced.total).toBe(107.5);
    });

    it("should map payment information", () => {
      const synced = OrderSyncService.syncOrderFromWC(mockWCOrder) as Record<string, any>;

      expect(synced.paymentMethod).toBe("Credit Card");
      expect(synced.metadata.paymentMethod).toBe("credit_card");
      expect(synced.metadata.transactionId).toBe("txn_123456");
    });

    it("should extract non-system meta fields", () => {
      const synced = OrderSyncService.syncOrderFromWC(mockWCOrder) as Record<string, any>;

      expect(synced.metaFields).toHaveProperty("delivery_date", "2024-03-02");
      expect(synced.metaFields).toHaveProperty("time_slot", "09:00-11:00");
      expect(synced.metaFields).not.toHaveProperty("_system_internal");
    });

    it("should map dates correctly", () => {
      const synced = OrderSyncService.syncOrderFromWC(mockWCOrder) as Record<string, any>;

      expect(synced.createdAt).toBeInstanceOf(Date);
      expect(synced.updatedAt).toBeInstanceOf(Date);
    });

    it("should handle empty addresses", () => {
      mockWCOrder.billing = {
        first_name: "",
        last_name: "",
        company: "",
        address_1: "",
        address_2: "",
        city: "",
        state: "",
        postcode: "",
        country: "",
      };

      const synced = OrderSyncService.syncOrderFromWC(mockWCOrder) as Record<string, any>;

      expect(synced.customer.email).toBe("");
      expect(synced.billingAddress.street).toBe("");
    });

    it("should handle null meta data values", () => {
      mockWCOrder.meta_data = [
        { id: 1, key: "custom_field", value: "test" },
        { id: 2, key: "another_field", value: { nested: "object" } },
      ];

      const synced = OrderSyncService.syncOrderFromWC(mockWCOrder) as Record<string, any>;

      expect(synced.metaFields.custom_field).toBe("test");
      expect(synced.metaFields.another_field).toEqual({ nested: "object" });
    });
  });

  describe("WL Order to WC Order Update Mapping", () => {
    it("should map WL order status to WC status", () => {
      const wlOrder = { status: "delivered" as WLOrderStatus };
      const mapped = OrderSyncService.syncOrderToWC(wlOrder);

      expect(mapped.status).toBe("completed");
    });

    it("should map WL notes to customer_note", () => {
      const wlOrder = { notes: "Important delivery instructions" };
      const mapped = OrderSyncService.syncOrderToWC(wlOrder);

      expect(mapped.customer_note).toBe("Important delivery instructions");
    });

    it("should build meta_data array from metaFields object", () => {
      const wlOrder = {
        metaFields: {
          delivery_date: "2024-03-02",
          time_slot: "09:00-11:00",
          custom_field: "value",
        },
      };
      const mapped = OrderSyncService.syncOrderToWC(wlOrder);

      expect(mapped.meta_data).toBeDefined();
      expect(Array.isArray(mapped.meta_data)).toBe(true);
      expect(mapped.meta_data).toHaveLength(3);
    });

    it("should handle missing metaFields", () => {
      const wlOrder = { status: "confirmed" as WLOrderStatus };
      const mapped = OrderSyncService.syncOrderToWC(wlOrder);

      expect(mapped.meta_data).toEqual([]);
    });

    it("should handle empty notes", () => {
      const wlOrder = { status: "pending" as WLOrderStatus };
      const mapped = OrderSyncService.syncOrderToWC(wlOrder);

      expect(mapped.customer_note).toBe("");
    });
  });

  describe("Status Change Handling", () => {
    it("should determine correct WC status for status change", () => {
      const result = OrderSyncService.handleOrderStatusChange(
        "123",
        "delivered",
        new Date()
      );

      expect(result.wcStatus).toBe("completed");
      expect(result.shouldUpdate).toBe(true);
    });

    it("should provide reason for status change", () => {
      const result = OrderSyncService.handleOrderStatusChange(
        "456",
        "cancelled",
        new Date()
      );

      expect(result.reason).toContain("456");
      expect(result.reason).toContain("cancelled");
    });

    it("should handle all valid WL status transitions", () => {
      const statuses: WLOrderStatus[] = [
        "pending",
        "confirmed",
        "dispatched",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned",
      ];

      for (const status of statuses) {
        const result = OrderSyncService.handleOrderStatusChange(
          "999",
          status,
          new Date()
        );
        expect(result.wcStatus).toBeDefined();
        expect(result.shouldUpdate).toBe(true);
      }
    });
  });

  describe("Conflict Resolution", () => {
    it("should resolve conflict to WL when WL is newer", () => {
      const wlDate = new Date("2024-03-02T12:00:00");
      const wcDate = new Date("2024-03-01T12:00:00");

      const result = OrderSyncService.resolveConflict(
        wlDate,
        wcDate,
        "status"
      );

      expect(result.winner).toBe("wl");
      expect(result.reason).toContain("newer");
    });

    it("should resolve conflict to WC when WC is newer", () => {
      const wlDate = new Date("2024-03-01T12:00:00");
      const wcDate = new Date("2024-03-02T12:00:00");

      const result = OrderSyncService.resolveConflict(
        wlDate,
        wcDate,
        "customer_note"
      );

      expect(result.winner).toBe("wc");
      expect(result.reason).toContain("newer");
    });

    it("should resolve to WC when dates are equal", () => {
      const date = new Date("2024-03-01T12:00:00");

      const result = OrderSyncService.resolveConflict(
        date,
        date,
        "some_field"
      );

      expect(result.winner).toBe("wc");
    });

    it("should include field name in conflict reason", () => {
      const wlDate = new Date("2024-03-01T12:00:00");
      const wcDate = new Date("2024-03-02T12:00:00");

      const result = OrderSyncService.resolveConflict(
        wlDate,
        wcDate,
        "delivery_address"
      );

      expect(result.reason).toContain("delivery_address");
    });

    it("should handle timestamp microsecond differences", () => {
      const wlDate = new Date("2024-03-01T12:00:00.999");
      const wcDate = new Date("2024-03-01T12:00:00.001");

      const result = OrderSyncService.resolveConflict(
        wlDate,
        wcDate,
        "notes"
      );

      expect(result.winner).toBe("wl");
    });
  });

  describe("Meta Field Extraction", () => {
    it("should extract custom meta fields", () => {
      const metaData = [
        { id: 1, key: "delivery_date", value: "2024-03-02" },
        { id: 2, key: "time_slot", value: "09:00-11:00" },
      ];

      const result = OrderSyncService.extractMetaFields(metaData);

      expect(result.delivery_date).toBe("2024-03-02");
      expect(result.time_slot).toBe("09:00-11:00");
    });

    it("should skip system meta fields (prefixed with _)", () => {
      const metaData = [
        { id: 1, key: "_wc_reserved_field", value: "hidden" },
        { id: 2, key: "_edit_lock", value: "123456" },
        { id: 3, key: "custom_field", value: "visible" },
      ];

      const result = OrderSyncService.extractMetaFields(metaData);

      expect(result).not.toHaveProperty("_wc_reserved_field");
      expect(result).not.toHaveProperty("_edit_lock");
      expect(result.custom_field).toBe("visible");
    });

    it("should handle object meta field values", () => {
      const metaData = [
        {
          id: 1,
          key: "delivery_instructions",
          value: { notes: "Handle with care", fragile: true },
        },
      ];

      const result = OrderSyncService.extractMetaFields(metaData);

      expect(result.delivery_instructions).toEqual({
        notes: "Handle with care",
        fragile: true,
      });
    });

    it("should handle empty meta data", () => {
      const result = OrderSyncService.extractMetaFields([]);

      expect(result).toEqual({});
    });
  });

  describe("Meta Data Building", () => {
    it("should build meta_data array from object", () => {
      const metaFields = {
        delivery_date: "2024-03-02",
        time_slot: "09:00-11:00",
      };

      const result = OrderSyncService.buildMetaData(metaFields);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        key: "delivery_date",
        value: "2024-03-02",
      });
      expect(result).toContainEqual({
        key: "time_slot",
        value: "09:00-11:00",
      });
    });

    it("should handle object values in meta data", () => {
      const metaFields = {
        custom: { nested: "value" },
      };

      const result = OrderSyncService.buildMetaData(metaFields);

      expect(result[0].value).toEqual({ nested: "value" });
    });

    it("should handle empty meta fields", () => {
      const result = OrderSyncService.buildMetaData({});

      expect(result).toEqual([]);
    });
  });

  describe("Order Validation", () => {
    let validOrder: WCOrder;

    beforeEach(() => {
      validOrder = {
        id: 123,
        parent_id: 0,
        number: "WC-001",
        order_key: "key",
        created_via: "checkout",
        version: "8.0",
        status: "pending",
        currency: "USD",
        date_created: "2024-01-01T00:00:00",
        date_created_gmt: "2024-01-01T00:00:00",
        date_modified: "2024-01-01T00:00:00",
        date_modified_gmt: "2024-01-01T00:00:00",
        discount_total: "0",
        discount_tax: "0",
        shipping_total: "10",
        shipping_tax: "0",
        cart_tax: "0",
        total: "100",
        total_tax: "0",
        customer_id: 1,
        customer_note: "",
        billing: {
          first_name: "John",
          last_name: "Doe",
          company: "",
          address_1: "123 St",
          address_2: "",
          city: "NYC",
          state: "NY",
          postcode: "10001",
          country: "US",
          email: "john@example.com",
          phone: "+1234567890",
        },
        shipping: {
          first_name: "John",
          last_name: "Doe",
          company: "",
          address_1: "123 St",
          address_2: "",
          city: "NYC",
          state: "NY",
          postcode: "10001",
          country: "US",
        },
        payment_method: "card",
        payment_method_title: "Card",
        transaction_id: "",
        date_paid: null,
        date_completed: null,
        cart_hash: "",
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
            subtotal_tax: "0",
            total: "100",
            total_tax: "0",
            taxes: [],
            meta_data: [],
            sku: "SKU1",
            price: 100,
          },
        ],
        tax_lines: [],
        shipping_lines: [],
        fee_lines: [],
        coupon_lines: [],
      };
    });

    it("should validate correct order", () => {
      const result = OrderSyncService.validateOrder(validOrder);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should error on missing order ID", () => {
      validOrder.id = 0;
      const result = OrderSyncService.validateOrder(validOrder);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Order ID is required");
    });

    it("should error on missing email and phone", () => {
      validOrder.billing.email = "";
      validOrder.billing.phone = "";

      const result = OrderSyncService.validateOrder(validOrder);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Email or phone is required");
    });

    it("should accept email only", () => {
      validOrder.billing.phone = "";
      const result = OrderSyncService.validateOrder(validOrder);

      expect(result.valid).toBe(true);
    });

    it("should accept phone only", () => {
      validOrder.billing.email = "";
      const result = OrderSyncService.validateOrder(validOrder);

      expect(result.valid).toBe(true);
    });

    it("should error on missing line items", () => {
      validOrder.line_items = [];
      const result = OrderSyncService.validateOrder(validOrder);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Order must contain at least one line item");
    });

    it("should accumulate multiple errors", () => {
      validOrder.id = 0;
      validOrder.billing.email = "";
      validOrder.billing.phone = "";
      validOrder.line_items = [];

      const result = OrderSyncService.validateOrder(validOrder);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("Order Summary Calculation", () => {
    let mockOrder: WCOrder;

    beforeEach(() => {
      mockOrder = {
        id: 123,
        parent_id: 0,
        number: "WC-001",
        order_key: "key",
        created_via: "checkout",
        version: "8.0",
        status: "pending",
        currency: "USD",
        date_created: "2024-01-01T00:00:00",
        date_created_gmt: "2024-01-01T00:00:00",
        date_modified: "2024-01-01T00:00:00",
        date_modified_gmt: "2024-01-01T00:00:00",
        discount_total: "0",
        discount_tax: "0",
        shipping_total: "10",
        shipping_tax: "2",
        cart_tax: "5",
        total: "117",
        total_tax: "7",
        customer_id: 1,
        customer_note: "",
        billing: {
          first_name: "John",
          last_name: "Doe",
          company: "",
          address_1: "123 St",
          address_2: "",
          city: "NYC",
          state: "NY",
          postcode: "10001",
          country: "US",
          email: "john@example.com",
        },
        shipping: {
          first_name: "John",
          last_name: "Doe",
          company: "",
          address_1: "123 St",
          address_2: "",
          city: "NYC",
          state: "NY",
          postcode: "10001",
          country: "US",
        },
        payment_method: "card",
        payment_method_title: "Card",
        transaction_id: "",
        date_paid: null,
        date_completed: null,
        cart_hash: "",
        meta_data: [],
        line_items: [
          {
            id: 1,
            name: "Product A",
            product_id: 1,
            variation_id: 0,
            quantity: 2,
            tax_class: "",
            subtotal: "50",
            subtotal_tax: "0",
            total: "50",
            total_tax: "2.5",
            taxes: [],
            meta_data: [],
            sku: "SKU1",
            price: 25,
          },
          {
            id: 2,
            name: "Product B",
            product_id: 2,
            variation_id: 0,
            quantity: 3,
            tax_class: "",
            subtotal: "60",
            subtotal_tax: "0",
            total: "60",
            total_tax: "2.5",
            taxes: [],
            meta_data: [],
            sku: "SKU2",
            price: 20,
          },
        ],
        tax_lines: [],
        shipping_lines: [],
        fee_lines: [],
        coupon_lines: [],
      };
    });

    it("should calculate correct item count", () => {
      const summary = OrderSyncService.calculateOrderSummary(mockOrder);

      expect(summary.itemCount).toBe(5); // 2 + 3
    });

    it("should calculate correct subtotal", () => {
      const summary = OrderSyncService.calculateOrderSummary(mockOrder);

      expect(summary.subtotal).toBe(100); // 117 - 10 - 7
    });

    it("should get correct shipping cost", () => {
      const summary = OrderSyncService.calculateOrderSummary(mockOrder);

      expect(summary.shipping).toBe(10);
    });

    it("should get correct tax amount", () => {
      const summary = OrderSyncService.calculateOrderSummary(mockOrder);

      expect(summary.tax).toBe(7);
    });

    it("should get correct total", () => {
      const summary = OrderSyncService.calculateOrderSummary(mockOrder);

      expect(summary.total).toBe(117);
    });

    it("should handle zero items", () => {
      mockOrder.line_items = [];
      const summary = OrderSyncService.calculateOrderSummary(mockOrder);

      expect(summary.itemCount).toBe(0);
    });
  });
});
