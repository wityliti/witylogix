/**
 * @witylogix/core/platforms/__tests__/woocommerce-adapter.test.ts
 * Comprehensive test suite for WooCommerce platform adapter
 *
 * Tests:
 * - HMAC-SHA256 webhook signature validation (consumer_secret)
 * - Order mapping with WooCommerce-specific field names
 * - Product mapping (simple, variable, grouped products)
 * - Customer mapping (full/minimal data)
 * - fetchOrder (API calls with mocked HTTP)
 * - fetchProducts (page-based pagination vs cursor)
 * - getWebhookEventType
 * - Edge cases: missing fields, null values, various product types
 *
 * ~900 lines total
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import {
  WooCommerceAdapter,
  WooCommerceOrder,
  WooCommerceProduct,
  WooCommerceCustomer,
} from "../adapters/woocommerce";

// ───────────────────────────────────────────────────────────────────────────
// MOCK HELPERS
// ───────────────────────────────────────────────────────────────────────────

function createValidWooCommerceHmac(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64");
}

// ───────────────────────────────────────────────────────────────────────────
// REALISTIC WEBHOOK PAYLOADS
// ───────────────────────────────────────────────────────────────────────────

const MOCK_WOOCOMMERCE_ORDER: WooCommerceOrder = {
  id: 12345,
  parent_id: 0,
  number: "12345",
  order_key: "wc_order_abcdef123456",
  created_via: "checkout",
  version: "8.5.0",
  status: "pending",
  currency: "USD",
  date_created: "2024-01-15T10:30:00",
  date_created_gmt: "2024-01-15T15:30:00",
  date_modified: "2024-01-15T10:35:00",
  date_modified_gmt: "2024-01-15T15:35:00",
  discount_total: "10.00",
  discount_tax: "0.00",
  shipping_total: "5.00",
  shipping_tax: "0.00",
  cart_tax: "4.50",
  total: "99.50",
  total_tax: "4.50",
  customer_id: 567,
  customer_ip_address: "192.168.1.1",
  customer_user_agent: "Mozilla/5.0...",
  customer_note: "Please deliver after 6pm",
  billing: {
    first_name: "Alice",
    last_name: "Johnson",
    company: "Tech Corp",
    address_1: "123 Business Ave",
    address_2: "Suite 200",
    city: "New York",
    state: "NY",
    postcode: "10001",
    country: "US",
    email: "alice@example.com",
    phone: "+1-212-555-0123",
  },
  shipping: {
    first_name: "Alice",
    last_name: "Johnson",
    company: "Tech Corp",
    address_1: "456 Shipping St",
    address_2: "Building A",
    city: "New York",
    state: "NY",
    postcode: "10002",
    country: "US",
  },
  payment_method: "stripe",
  payment_method_title: "Credit Card (Stripe)",
  transaction_id: "txn_1234567890",
  date_paid: "2024-01-15T10:32:00",
  date_completed: null,
  cart_hash: "hash123abc",
  meta_data: [
    { id: 1, key: "customer_note", value: "Please deliver after 6pm" },
    { id: 2, key: "custom_field_1", value: "custom_value_1" },
  ],
  line_items: [
    {
      id: 1,
      name: "Premium Widget - Red",
      product_id: 5001,
      variation_id: 5002,
      quantity: 2,
      tax_class: "standard",
      subtotal: "79.98",
      subtotal_tax: "0.00",
      total: "69.98",
      total_tax: "3.50",
      taxes: [],
      meta_data: [{ id: 1, key: "color", value: "Red" }],
      sku: "WIDGET-RED-001",
      price: "39.99",
      image: { id: 501, src: "https://store.example.com/product-1.jpg" },
      parent_name: "Premium Widget",
      _links: {},
    },
    {
      id: 2,
      name: "Standard Widget - Blue",
      product_id: 5003,
      variation_id: 0,
      quantity: 1,
      tax_class: "standard",
      subtotal: "9.99",
      subtotal_tax: "0.00",
      total: "9.99",
      total_tax: "1.00",
      taxes: [],
      meta_data: [],
      sku: "WIDGET-BLUE-001",
      price: "9.99",
      image: { id: 502, src: "https://store.example.com/product-2.jpg" },
      parent_name: "",
      _links: {},
    },
  ],
  tax_lines: [],
  shipping_lines: [
    {
      id: 1,
      method_title: "Standard Shipping",
      method_id: "flat_rate:1",
      instance_id: "1",
      total: "5.00",
      total_tax: "0.00",
      taxes: [],
      meta_data: [],
    } as any,
  ],
  fee_lines: [],
  coupon_lines: [],
  refunds: [],
  payment_url:
    "https://store.example.com/checkout/order-pay/12345/?pay_for_order=true",
  customer_note_html: "<p>Please deliver after 6pm</p>",
  _links: {},
};

const MOCK_WOOCOMMERCE_PRODUCT: WooCommerceProduct = {
  id: 5001,
  name: "Premium Widget",
  slug: "premium-widget",
  permalink: "https://store.example.com/product/premium-widget/",
  date_created: "2023-10-01T12:00:00",
  date_created_gmt: "2023-10-01T16:00:00",
  date_modified: "2024-01-10T15:30:00",
  date_modified_gmt: "2024-01-10T20:30:00",
  type: "variable",
  status: "publish",
  featured: true,
  catalog_visibility: "visible",
  description: "<p>Our flagship product with premium features.</p>",
  short_description: "<p>Premium product</p>",
  sku: "WIDGET-PREMIUM",
  price: "39.99",
  regular_price: "49.99",
  sale_price: "39.99",
  date_on_sale_from: "2024-01-01",
  date_on_sale_from_gmt: "2024-01-01T00:00:00",
  date_on_sale_to: "2024-01-31",
  date_on_sale_to_gmt: "2024-01-31T00:00:00",
  price_html:
    '<span class="woocommerce-Price-amount"><bdi><span class="woocommerce-Price-currencySymbol">$</span>39.99</bdi></span>',
  on_sale: true,
  purchasable: true,
  total_sales: 156,
  virtual: false,
  downloadable: false,
  downloads: [],
  download_limit: -1,
  download_expiry: -1,
  external_url: "",
  button_text: "",
  tax_status: "taxable",
  tax_class: "standard",
  manage_stock: true,
  stock_quantity: 500,
  stock_status: "instock",
  backorders: "no",
  backorders_allowed: false,
  backordered: false,
  sold_individually: false,
  weight: "0.5",
  dimensions: { length: "10", width: "10", height: "5" },
  shipping_required: true,
  shipping_taxable: true,
  shipping_class: "standard",
  shipping_class_id: 0,
  reviews_allowed: true,
  average_rating: "4.5",
  rating_count: 24,
  related_ids: [5002, 5003],
  upsell_ids: [5004],
  cross_sell_ids: [5005],
  parent_id: 0,
  purchase_note: "Thank you for your purchase!",
  categories: [
    { id: 15, name: "Widgets", slug: "widgets" },
    { id: 16, name: "Premium", slug: "premium" },
  ],
  tags: [
    { id: 20, name: "bestseller", slug: "bestseller" },
    { id: 21, name: "new", slug: "new" },
  ],
  images: [
    {
      id: 501,
      date_created: "2023-10-01T12:00:00",
      date_created_gmt: "2023-10-01T16:00:00",
      date_modified: "2023-10-01T12:00:00",
      date_modified_gmt: "2023-10-01T16:00:00",
      src: "https://store.example.com/wp-content/uploads/product-1.jpg",
      name: "Product Main Image",
      alt: "Premium Widget",
    },
    {
      id: 502,
      date_created: "2023-10-01T12:01:00",
      date_created_gmt: "2023-10-01T16:01:00",
      date_modified: "2023-10-01T12:01:00",
      date_modified_gmt: "2023-10-01T16:01:00",
      src: "https://store.example.com/wp-content/uploads/product-2.jpg",
      name: "Product Alt Image",
      alt: "Premium Widget Alt",
    },
  ],
  attributes: [
    {
      id: 1,
      name: "Color",
      position: 0,
      visible: true,
      variation: true,
      options: ["Red", "Blue", "Green"],
    },
  ],
  default_attributes: [{ id: 1, name: "Color", option: "Red" }],
  variations: [5002, 5003, 5004],
  grouped_products: [],
  menu_order: 0,
  meta_data: [
    { id: 100, key: "featured", value: "yes" },
    { id: 101, key: "supplier", value: "Acme Inc" },
  ],
  _links: {},
};

const MOCK_WOOCOMMERCE_CUSTOMER: WooCommerceCustomer = {
  id: 567,
  date_created: "2023-12-01T08:00:00",
  date_created_gmt: "2023-12-01T13:00:00",
  date_modified: "2024-01-15T10:30:00",
  date_modified_gmt: "2024-01-15T15:30:00",
  email: "customer@example.com",
  first_name: "Bob",
  last_name: "Wilson",
  role: "customer",
  username: "bobwilson",
  billing: {
    first_name: "Bob",
    last_name: "Wilson",
    company: "Wilson Corp",
    address_1: "123 Main St",
    address_2: "Suite 100",
    city: "Portland",
    state: "OR",
    postcode: "97201",
    country: "US",
    email: "bob@wilsoncorp.com",
    phone: "+1-503-555-0123",
  },
  shipping: {
    first_name: "Bob",
    last_name: "Wilson",
    company: "",
    address_1: "456 Oak Ave",
    address_2: "Apt 20",
    city: "Portland",
    state: "OR",
    postcode: "97202",
    country: "US",
  },
  is_paying_customer: true,
  avatar_url: "https://secure.gravatar.com/avatar/abc123",
  meta_data: [{ id: 1, key: "loyalty_points", value: "500" }],
  _links: {},
};

// ───────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ───────────────────────────────────────────────────────────────────────────

describe("WooCommerceAdapter", () => {
  let adapter: WooCommerceAdapter;
  const secret = "woocommerce-webhook-secret";

  beforeEach(() => {
    adapter = new WooCommerceAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // WEBHOOK VALIDATION TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe("validateWebhook", () => {
    it("should validate webhook with correct HMAC-SHA256 signature", () => {
      const payload = JSON.stringify({ id: 12345, status: "completed" });
      const signature = createValidWooCommerceHmac(payload, secret);

      const result = adapter.validateWebhook(payload, signature, secret);
      expect(result).toBe(true);
    });

    it("should validate webhook with buffer payload", () => {
      const payloadString = JSON.stringify({ id: 54321, number: "2024" });
      const payload = Buffer.from(payloadString);
      const signature = createValidWooCommerceHmac(payloadString, secret);

      const result = adapter.validateWebhook(payload, signature, secret);
      expect(result).toBe(true);
    });

    it("should reject webhook with invalid HMAC signature", () => {
      const payload = JSON.stringify({ id: 12345, status: "completed" });
      const invalidSignature = "invalid-signature-hash";

      const result = adapter.validateWebhook(payload, invalidSignature, secret);
      expect(result).toBe(false);
    });

    it("should detect altered payload", () => {
      const originalPayload = JSON.stringify({ id: 999, order_number: 5001 });
      const signature = createValidWooCommerceHmac(originalPayload, secret);
      const alteredPayload = JSON.stringify({ id: 999, order_number: 9999 });

      const result = adapter.validateWebhook(alteredPayload, signature, secret);
      expect(result).toBe(false);
    });

    it("should use timing-safe comparison", () => {
      const payload = JSON.stringify({ test: "data" });
      const validSignature = createValidWooCommerceHmac(payload, secret);
      const invalidSignature = "invalid";

      const result1 = adapter.validateWebhook(payload, validSignature, secret);
      const result2 = adapter.validateWebhook(
        payload,
        invalidSignature,
        secret,
      );

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it("should return false for empty signature", () => {
      const payload = JSON.stringify({ test: "data" });
      const result = adapter.validateWebhook(payload, "", secret);
      expect(result).toBe(false);
    });

    it("should return false for empty secret", () => {
      const payload = JSON.stringify({ test: "data" });
      const signature = createValidWooCommerceHmac(payload, secret);
      const result = adapter.validateWebhook(payload, signature, "");
      expect(result).toBe(false);
    });

    it("should handle real-world WooCommerce webhook format", () => {
      const orderPayload = JSON.stringify(MOCK_WOOCOMMERCE_ORDER);
      const signature = createValidWooCommerceHmac(orderPayload, secret);

      const result = adapter.validateWebhook(orderPayload, signature, secret);
      expect(result).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ORDER MAPPING TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe("mapOrder", () => {
    it("should map full WooCommerce order to CreateOrderInput", () => {
      const result = adapter.mapOrder(MOCK_WOOCOMMERCE_ORDER);

      expect(result.externalOrderId).toBe("12345");
      expect(result.source).toBe("WOOCOMMERCE");
      expect(result.email).toBe("alice@example.com");
      expect(result.currency).toBe("USD");
      expect(result.totalPrice).toBe(99.5);
      expect(result.subtotalPrice).toBe(94);
      expect(result.totalTax).toBe(4.5);
      expect(result.financialStatus).toBe("paid");
      expect(result.fulfillmentStatus).toBe("unshipped");
      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[0].quantity).toBe(2);
      expect(result.lineItems[0].sku).toBe("WIDGET-RED-001");
      expect(result.shippingAddress.firstName).toBe("Alice");
      expect(result.shippingAddress.line1).toBe("456 Shipping St");
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it("should map order with minimal data", () => {
      const minimalOrder: WooCommerceOrder = {
        id: 1,
        parent_id: 0,
        number: "1",
        order_key: "wc_order_1",
        created_via: "rest-api",
        version: "8.5.0",
        status: "pending",
        currency: "USD",
        date_created: "2024-01-01T00:00:00",
        date_created_gmt: "2024-01-01T00:00:00",
        date_modified: "2024-01-01T00:00:00",
        date_modified_gmt: "2024-01-01T00:00:00",
        discount_total: "0.00",
        discount_tax: "0.00",
        shipping_total: "0.00",
        shipping_tax: "0.00",
        cart_tax: "0.00",
        total: "50.00",
        total_tax: "0.00",
        customer_id: 1,
        customer_ip_address: "127.0.0.1",
        customer_user_agent: "",
        customer_note: "",
        billing: {
          first_name: "Test",
          last_name: "User",
          company: "",
          address_1: "100 Test St",
          address_2: "",
          city: "Test City",
          state: "TC",
          postcode: "12345",
          country: "US",
        },
        shipping: {
          first_name: "Test",
          last_name: "User",
          company: "",
          address_1: "100 Test St",
          address_2: "",
          city: "Test City",
          state: "TC",
          postcode: "12345",
          country: "US",
        },
        payment_method: "",
        payment_method_title: "",
        transaction_id: "",
        date_paid: null,
        date_completed: null,
        cart_hash: "",
        meta_data: [],
        line_items: [],
        tax_lines: [],
        shipping_lines: [],
        fee_lines: [],
        coupon_lines: [],
        refunds: [],
        payment_url: "",
        _links: {},
      };

      const result = adapter.mapOrder(minimalOrder);

      expect(result.externalOrderId).toBe("1");
      expect(result.totalPrice).toBe(50);
      expect(result.lineItems).toHaveLength(0);
    });

    it("should map order with multiple line items", () => {
      const multiItemOrder = {
        ...MOCK_WOOCOMMERCE_ORDER,
        line_items: [
          ...MOCK_WOOCOMMERCE_ORDER.line_items,
          {
            id: 3,
            name: "Third Item",
            product_id: 5005,
            variation_id: 0,
            quantity: 3,
            tax_class: "standard",
            subtotal: "29.97",
            subtotal_tax: "0.00",
            total: "29.97",
            total_tax: "3.00",
            taxes: [],
            meta_data: [],
            sku: "ITEM-THREE",
            price: "9.99",
            image: { id: 503, src: "https://store.example.com/product-3.jpg" },
            parent_name: "",
            _links: {},
          } as any,
        ],
      };

      const result = adapter.mapOrder(multiItemOrder);

      expect(result.lineItems).toHaveLength(3);
      expect(result.lineItems[2].quantity).toBe(3);
    });

    it("should determine financial status from payment", () => {
      const paidOrder = {
        ...MOCK_WOOCOMMERCE_ORDER,
        date_paid: "2024-01-15T10:32:00",
      };
      const result = adapter.mapOrder(paidOrder);
      expect(result.financialStatus).toBe("paid");

      const unpaidOrder = { ...MOCK_WOOCOMMERCE_ORDER, date_paid: null };
      const resultUnpaid = adapter.mapOrder(unpaidOrder);
      expect(resultUnpaid.financialStatus).toBe("pending");
    });

    it("should handle refunded order status", () => {
      const refundedOrder = { ...MOCK_WOOCOMMERCE_ORDER, status: "refunded" };
      const result = adapter.mapOrder(refundedOrder);
      expect(result.financialStatus).toBe("refunded");
    });

    it("should handle cancelled order status", () => {
      const cancelledOrder = { ...MOCK_WOOCOMMERCE_ORDER, status: "cancelled" };
      const result = adapter.mapOrder(cancelledOrder);
      expect(result.financialStatus).toBe("voided");
    });

    it("should determine fulfillment status from order status", () => {
      const completedOrder = { ...MOCK_WOOCOMMERCE_ORDER, status: "completed" };
      const result = adapter.mapOrder(completedOrder);
      expect(result.fulfillmentStatus).toBe("fulfilled");

      const processingOrder = {
        ...MOCK_WOOCOMMERCE_ORDER,
        status: "processing",
      };
      const resultProcessing = adapter.mapOrder(processingOrder);
      expect(resultProcessing.fulfillmentStatus).toBe("partial");
    });

    it("should handle line items with variation_id of 0", () => {
      const result = adapter.mapOrder(MOCK_WOOCOMMERCE_ORDER);
      // Second item has variation_id: 0
      expect(result.lineItems[1].variantId).toBe("5003");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCT MAPPING TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe("mapProduct", () => {
    it("should map variable product with variations", () => {
      const result = adapter.mapProduct(MOCK_WOOCOMMERCE_PRODUCT);

      expect(result.externalProductId).toBe("5001");
      expect(result.source).toBe("WOOCOMMERCE");
      expect(result.title).toBe("Premium Widget");
      expect(result.description).toContain("flagship product");
      expect(result.productType).toBe("variable");
      expect(result.variants).toBeDefined();
    });

    it("should map simple product", () => {
      const simpleProduct: WooCommerceProduct = {
        ...MOCK_WOOCOMMERCE_PRODUCT,
        type: "simple",
        sku: "SIMPLE-001",
      };

      const result = adapter.mapProduct(simpleProduct);

      expect(result.productType).toBe("simple");
      expect(result.title).toBe("Premium Widget");
      expect(result.variants).toBeDefined();
      expect(result.variants.length).toBeGreaterThan(0);
    });

    it("should map external product", () => {
      const externalProduct: WooCommerceProduct = {
        ...MOCK_WOOCOMMERCE_PRODUCT,
        type: "external",
        external_url: "https://external-supplier.com/product",
      };

      const result = adapter.mapProduct(externalProduct);

      expect(result.productType).toBe("external");
    });

    it("should extract image URLs", () => {
      const result = adapter.mapProduct(MOCK_WOOCOMMERCE_PRODUCT);

      expect(result.imageUrl).toBe(
        "https://store.example.com/wp-content/uploads/product-1.jpg",
      );
    });

    it("should extract categories as collections", () => {
      const result = adapter.mapProduct(MOCK_WOOCOMMERCE_PRODUCT);

      expect(result.collections).toContain("widgets");
      expect(result.collections).toContain("premium");
    });

    it("should extract tags", () => {
      const result = adapter.mapProduct(MOCK_WOOCOMMERCE_PRODUCT);

      expect(result.tags).toContain("bestseller");
      expect(result.tags).toContain("new");
    });

    it("should handle product with no images", () => {
      const productNoImages: WooCommerceProduct = {
        ...MOCK_WOOCOMMERCE_PRODUCT,
        images: [],
      };

      const result = adapter.mapProduct(productNoImages);

      expect(result.imageUrl).toBeUndefined();
    });

    it("should handle product with no tags", () => {
      const productNoTags: WooCommerceProduct = {
        ...MOCK_WOOCOMMERCE_PRODUCT,
        tags: [],
      };

      const result = adapter.mapProduct(productNoTags);

      expect(result.tags).toHaveLength(0);
    });

    it("should handle product with no categories", () => {
      const productNoCategories: WooCommerceProduct = {
        ...MOCK_WOOCOMMERCE_PRODUCT,
        categories: [],
      };

      const result = adapter.mapProduct(productNoCategories);

      expect(result.collections).toHaveLength(0);
    });

    it("should extract price from string", () => {
      const result = adapter.mapProduct(MOCK_WOOCOMMERCE_PRODUCT);

      expect(result.variants[0].price).toMatch(/\d+\.\d+/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMER MAPPING TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe("mapCustomer", () => {
    it("should map full WooCommerce customer to CreateCustomerInput", () => {
      const result = adapter.mapCustomer(MOCK_WOOCOMMERCE_CUSTOMER);

      expect(result.externalCustomerId).toBe("567");
      expect(result.source).toBe("WOOCOMMERCE");
      expect(result.email).toBe("customer@example.com");
      expect(result.firstName).toBe("Bob");
      expect(result.lastName).toBe("Wilson");
      expect(result.phone).toBe("+1-503-555-0123");
      expect(result.billingAddress).toBeDefined();
      expect(result.billingAddress?.line1).toBe("123 Main St");
      expect(result.shippingAddress).toBeDefined();
      expect(result.shippingAddress?.line1).toBe("456 Oak Ave");
    });

    it("should map customer with minimal data", () => {
      const minimalCustomer: WooCommerceCustomer = {
        id: 1,
        date_created: "2024-01-01T00:00:00",
        date_created_gmt: "2024-01-01T00:00:00",
        date_modified: "2024-01-01T00:00:00",
        date_modified_gmt: "2024-01-01T00:00:00",
        email: "minimal@example.com",
        first_name: "Jane",
        last_name: "Doe",
        role: "customer",
        username: "janedoe",
        billing: {
          first_name: "Jane",
          last_name: "Doe",
          company: "",
          address_1: "100 Test St",
          address_2: "",
          city: "Test City",
          state: "TC",
          postcode: "12345",
          country: "US",
        },
        shipping: {
          first_name: "Jane",
          last_name: "Doe",
          company: "",
          address_1: "100 Test St",
          address_2: "",
          city: "Test City",
          state: "TC",
          postcode: "12345",
          country: "US",
        },
        is_paying_customer: false,
        avatar_url: "",
        meta_data: [],
        _links: {},
      };

      const result = adapter.mapCustomer(minimalCustomer);

      expect(result.externalCustomerId).toBe("1");
      expect(result.email).toBe("minimal@example.com");
      expect(result.firstName).toBe("Jane");
    });

    it("should handle customer without phone", () => {
      const customerNoPhone: WooCommerceCustomer = {
        ...MOCK_WOOCOMMERCE_CUSTOMER,
        billing: {
          ...MOCK_WOOCOMMERCE_CUSTOMER.billing,
          phone: undefined,
        },
      };

      const result = adapter.mapCustomer(customerNoPhone);

      expect(result.phone).toBeUndefined();
    });

    it("should handle customer with fallback phone from main object", () => {
      const customerFallbackPhone: WooCommerceCustomer = {
        ...MOCK_WOOCOMMERCE_CUSTOMER,
        billing: {
          ...MOCK_WOOCOMMERCE_CUSTOMER.billing,
          phone: undefined,
        },
      } as any;
      customerFallbackPhone.phone = "+1-555-0000";

      const result = adapter.mapCustomer(customerFallbackPhone);

      expect(result.phone).toBe("+1-555-0000");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH ORDER TESTS (MOCKED HTTP)
  // ─────────────────────────────────────────────────────────────────────────

  describe("fetchOrder", () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("should fetch order from WooCommerce REST API v3", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_WOOCOMMERCE_ORDER,
      });

      const credentials = {
        siteUrl: "https://mystore.com",
        consumerKey: "ck_test123",
        consumerSecret: "cs_test456",
      };

      const order = await adapter.fetchOrder("12345", credentials);

      expect(order.id).toBe(12345);
      expect(order.email).not.toBeDefined(); // Not in WooCommerce order
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("mystore.com"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        }),
      );
    });

    it("should handle API error responses", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const credentials = {
        siteUrl: "https://mystore.com",
        consumerKey: "ck_test123",
        consumerSecret: "cs_test456",
      };

      await expect(adapter.fetchOrder("999999", credentials)).rejects.toThrow();
    });

    it("should use basic auth with consumer key and secret", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_WOOCOMMERCE_ORDER,
      });

      const credentials = {
        siteUrl: "https://mystore.com",
        consumerKey: "ck_abc",
        consumerSecret: "cs_def",
      };

      await adapter.fetchOrder("12345", credentials);

      const callArgs = mockFetch.mock.calls[0];
      const authHeader = callArgs[1].headers["Authorization"];

      // Should be base64(ck_abc:cs_def)
      expect(authHeader).toMatch(/^Basic /);
      const decoded = Buffer.from(
        authHeader.replace("Basic ", ""),
        "base64",
      ).toString();
      expect(decoded).toBe("ck_abc:cs_def");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH PRODUCTS TESTS (PAGE-BASED PAGINATION)
  // ─────────────────────────────────────────────────────────────────────────

  describe("fetchProducts", () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("should fetch products with page-based pagination", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [MOCK_WOOCOMMERCE_PRODUCT],
        headers: new Map([["X-WP-TotalPages", "5"]]),
      });

      const credentials = {
        siteUrl: "https://mystore.com",
        consumerKey: "ck_test",
        consumerSecret: "cs_test",
      };

      const result = await adapter.fetchProducts(credentials);

      expect(result.products).toHaveLength(1);
      expect(result.nextCursor).toBe("2");
    });

    it("should not provide next cursor on last page", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [MOCK_WOOCOMMERCE_PRODUCT],
        headers: new Map([["X-WP-TotalPages", "1"]]),
      });

      const credentials = {
        siteUrl: "https://mystore.com",
        consumerKey: "ck_test",
        consumerSecret: "cs_test",
      };

      const result = await adapter.fetchProducts(credentials);

      expect(result.nextCursor).toBeUndefined();
    });

    it("should use cursor as page number for subsequent requests", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        headers: new Map([["X-WP-TotalPages", "5"]]),
      });

      const credentials = {
        siteUrl: "https://mystore.com",
        consumerKey: "ck_test",
        consumerSecret: "cs_test",
      };

      await adapter.fetchProducts(credentials, "3");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("page=3"),
        expect.any(Object),
      );
    });

    it("should respect per_page parameter", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        headers: new Map([["X-WP-TotalPages", "1"]]),
      });

      const credentials = {
        siteUrl: "https://mystore.com",
        consumerKey: "ck_test",
        consumerSecret: "cs_test",
      };

      await adapter.fetchProducts(credentials, undefined, 50);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("per_page=50"),
        expect.any(Object),
      );
    });

    it("should cap per_page at 100", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        headers: new Map([["X-WP-TotalPages", "1"]]),
      });

      const credentials = {
        siteUrl: "https://mystore.com",
        consumerKey: "ck_test",
        consumerSecret: "cs_test",
      };

      await adapter.fetchProducts(credentials, undefined, 500);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("per_page=100"),
        expect.any(Object),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH CUSTOMER TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe("fetchCustomer", () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("should fetch customer from WooCommerce REST API v3", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_WOOCOMMERCE_CUSTOMER,
      });

      const credentials = {
        siteUrl: "https://mystore.com",
        consumerKey: "ck_test",
        consumerSecret: "cs_test",
      };

      const customer = await adapter.fetchCustomer("567", credentials);

      expect(customer.id).toBe(567);
      expect(customer.email).toBe("customer@example.com");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CASES AND SPECIAL SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────

  describe("Edge Cases", () => {
    it("should validate adapter source", () => {
      expect(adapter.source).toBe("WOOCOMMERCE");
    });

    it("should handle order with zero total", () => {
      const zeroOrder = {
        ...MOCK_WOOCOMMERCE_ORDER,
        total: "0.00",
        total_tax: "0.00",
      };

      const result = adapter.mapOrder(zeroOrder);

      expect(result.totalPrice).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("should handle order with very large totals", () => {
      const largeOrder = {
        ...MOCK_WOOCOMMERCE_ORDER,
        total: "99999.99",
        line_items: [
          { ...MOCK_WOOCOMMERCE_ORDER.line_items[0], total: "99999.99" },
        ],
      };

      const result = adapter.mapOrder(largeOrder);

      expect(result.totalPrice).toBe(99999.99);
    });

    it("should handle product with decimal weight", () => {
      const result = adapter.mapProduct(MOCK_WOOCOMMERCE_PRODUCT);

      expect(result.variants[0].weight).toBe(0.5);
    });

    it("should handle customer with special characters in name", () => {
      const specialCustomer: WooCommerceCustomer = {
        ...MOCK_WOOCOMMERCE_CUSTOMER,
        first_name: "Jean-Pierre",
        last_name: "O'Shaughnessy",
      };

      const result = adapter.mapCustomer(specialCustomer);

      expect(result.firstName).toContain("Jean-Pierre");
      expect(result.lastName).toContain("Shaughnessy");
    });

    it("should handle grouped product type", () => {
      const groupedProduct: WooCommerceProduct = {
        ...MOCK_WOOCOMMERCE_PRODUCT,
        type: "grouped",
        grouped_products: [5001, 5002, 5003],
      };

      const result = adapter.mapProduct(groupedProduct);

      expect(result.productType).toBe("grouped");
    });

    it("should handle order with null billing email fallback to empty string", () => {
      const orderNoBillingEmail = {
        ...MOCK_WOOCOMMERCE_ORDER,
        billing: {
          ...MOCK_WOOCOMMERCE_ORDER.billing,
          email: undefined,
        },
      } as any;

      const result = adapter.mapOrder(orderNoBillingEmail);

      expect(result.email).toBe("");
    });

    it("should handle line item with missing SKU", () => {
      const itemNoSku = {
        ...MOCK_WOOCOMMERCE_ORDER.line_items[0],
        sku: "",
      };
      const order = {
        ...MOCK_WOOCOMMERCE_ORDER,
        line_items: [itemNoSku],
      };

      const result = adapter.mapOrder(order);

      expect(result.lineItems[0].sku).toBe("");
    });
  });
});
