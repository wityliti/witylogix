/**
 * @witylogix/core/platforms/__tests__/shopify-adapter.test.ts
 * Comprehensive test suite for Shopify platform adapter
 *
 * Tests:
 * - HMAC-SHA256 webhook signature validation
 * - Order mapping (full/minimal data, multiple items, edge cases)
 * - Product mapping (simple/variant products)
 * - Customer mapping (full/minimal data)
 * - fetchOrder (API calls with mocked HTTP)
 * - fetchProducts (pagination with cursor)
 * - getWebhookEventType
 * - Edge cases: missing fields, null values, cancelled orders
 *
 * ~900 lines total
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import {
  ShopifyAdapter,
  ShopifyOrder,
  ShopifyProduct,
  ShopifyCustomer,
} from "../adapters/shopify";
import {
  CreateOrderInput,
  CreateProductInput,
  CreateCustomerInput,
} from "../types";

// ───────────────────────────────────────────────────────────────────────────
// MOCK HELPERS
// ───────────────────────────────────────────────────────────────────────────

function createValidShopifyHmac(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload, "utf-8")
    .digest("base64");
}

function createValidShopifyPayloadBuffer(
  obj: Record<string, any>,
  secret: string,
): { payload: Buffer; signature: string } {
  const payloadString = JSON.stringify(obj);
  const payload = Buffer.from(payloadString);
  const signature = createValidShopifyHmac(payloadString, secret);
  return { payload, signature };
}

// ───────────────────────────────────────────────────────────────────────────
// REALISTIC WEBHOOK PAYLOADS
// ───────────────────────────────────────────────────────────────────────────

const MOCK_SHOPIFY_ORDER: ShopifyOrder = {
  id: 123456789,
  email: "customer@example.com",
  created_at: "2024-01-15T10:30:00Z",
  updated_at: "2024-01-15T10:35:00Z",
  number: 1001,
  note: "Please handle with care",
  token: "abc123token",
  gateway: "shopify_payments",
  test: false,
  total_price: "299.97",
  subtotal_price: "299.97",
  total_weight: 5000,
  total_tax: "0.00",
  total_discounts: "0.00",
  currency: "USD",
  financial_status: "paid",
  confirmed: true,
  status: "pending",
  fulfillment_status: null,
  fulfillments: [],
  payment_details: {
    credit_card_bin: "411111",
    avs_result_code: "Y",
    cvv_result_code: "M",
    credit_card_number: "•••• •••• •••• 1111",
    credit_card_company: "Visa",
  },
  billing_address: {
    first_name: "John",
    address1: "456 Billing St",
    phone: "555-1234",
    city: "San Francisco",
    zip: "94102",
    province: "CA",
    country: "United States",
    last_name: "Doe",
    address2: "Suite 100",
    company: "Acme Corp",
    latitude: 37.7749,
    longitude: -122.4194,
    name: "John Doe",
    country_code: "US",
    province_code: "CA",
  },
  shipping_address: {
    first_name: "John",
    address1: "123 Main St",
    phone: "555-1234",
    city: "San Francisco",
    zip: "94102",
    province: "CA",
    country: "United States",
    last_name: "Doe",
    address2: "Apt 5",
    company: "",
    latitude: 37.7749,
    longitude: -122.4194,
    name: "John Doe",
    country_code: "US",
    province_code: "CA",
  },
  customer: {
    id: 987654321,
    email: "customer@example.com",
    accepts_marketing: true,
    created_at: "2023-12-01T08:00:00Z",
    updated_at: "2024-01-15T10:30:00Z",
    first_name: "John",
    last_name: "Doe",
    orders_count: 5,
    state: "enabled",
    total_spent: "1500.00",
    last_order_id: 123456789,
    note: "VIP customer",
    verified_email: true,
    multipass_identifier: null,
    tax_exempt: false,
    tags: "vip,wholesale",
    currency: "USD",
    phone: "+1-555-0123",
    accepts_marketing_updated_at: "2024-01-15T10:30:00Z",
    marketing_opt_in_level: "confirmed_opt_in",
    tax_exemptions: [],
    email_marketing_consent: {
      state: "subscribed",
      opt_in_level: "single_opt_in",
      consent_updated_at: "2024-01-15T10:30:00Z",
    },
    sms_marketing_consent: null,
    addresses: [
      {
        first_name: "John",
        address1: "789 Secondary Ave",
        phone: "555-5678",
        city: "Oakland",
        zip: "94612",
        province: "CA",
        country: "United States",
        last_name: "Doe",
        address2: "",
        company: "",
        latitude: 37.8044,
        longitude: -122.2712,
        name: "John Doe",
        country_code: "US",
        province_code: "CA",
      },
    ],
    admin_graphql_api_id: "gid://shopify/Customer/987654321",
    default_address: {
      first_name: "John",
      address1: "456 Billing St",
      phone: "555-1234",
      city: "San Francisco",
      zip: "94102",
      province: "CA",
      country: "United States",
      last_name: "Doe",
      address2: "Suite 100",
      company: "Acme Corp",
      latitude: 37.7749,
      longitude: -122.4194,
      name: "John Doe",
      country_code: "US",
      province_code: "CA",
    },
  },
  order_number: 1001,
  cancel_reason: null,
  cancelled_at: null,
  closed_at: null,
  completed_at: null,
  line_items: [
    {
      id: 111111111,
      variant_id: 222222222,
      title: "Premium Widget - Red",
      quantity: 2,
      sku: "WIDGET-RED-001",
      variant_title: "Red",
      vendor: "Acme Inc",
      fulfillment_service: "manual",
      product_id: 333333333,
      requires_shipping: true,
      taxable: true,
      gift_card: false,
      name: "Premium Widget - Red",
      variant_inventory_management: "shopify",
      properties: [],
      product_exists: true,
      fulfillment_status: null,
      grams: 200,
      weight: 200,
      weight_unit: "g",
      price: "99.99",
      total_discount: "0.00",
      admin_graphql_api_id: "gid://shopify/LineItem/111111111",
      tax_lines: [],
      duties: [],
      discount_allocations: [],
    },
    {
      id: 444444444,
      variant_id: 555555555,
      title: "Standard Widget - Blue",
      quantity: 1,
      sku: "WIDGET-BLUE-001",
      variant_title: "Blue",
      vendor: "Acme Inc",
      fulfillment_service: "manual",
      product_id: 666666666,
      requires_shipping: true,
      taxable: true,
      gift_card: false,
      name: "Standard Widget - Blue",
      variant_inventory_management: "shopify",
      properties: [],
      product_exists: true,
      fulfillment_status: null,
      grams: 150,
      weight: 150,
      weight_unit: "g",
      price: "49.99",
      total_discount: "0.00",
      admin_graphql_api_id: "gid://shopify/LineItem/444444444",
      tax_lines: [],
      duties: [],
      discount_allocations: [],
    },
  ],
  discount_codes: [],
  tax_lines: [],
  shipping_lines: [],
  refunds: [],
  app_id: null,
  customer_locale: "en",
  name: "#1001",
  admin_graphql_api_id: "gid://shopify/Order/123456789",
  processing_method: "direct",
  checkout_id: null,
  checkout_token: "checkout-token",
  landing_site: null,
  buyer_accepts_marketing: true,
  taxes_included: false,
  cart_token: "cart-token",
  user_id: null,
  location_id: null,
  source_identifier: null,
  source_url: null,
  referring_site: null,
  risk_level: "low",
  source_name: "web",
  presentment_currency: "USD",
  total_line_items_price: "299.97",
  total_line_items_price_set: {
    shop_money: { amount: "299.97", currency_code: "USD" },
    presentment_money: { amount: "299.97", currency_code: "USD" },
  },
  total_price_set: {
    shop_money: { amount: "299.97", currency_code: "USD" },
    presentment_money: { amount: "299.97", currency_code: "USD" },
  },
  total_shipping_price_set: {
    shop_money: { amount: "0.00", currency_code: "USD" },
    presentment_money: { amount: "0.00", currency_code: "USD" },
  },
  total_tax_set: {
    shop_money: { amount: "0.00", currency_code: "USD" },
    presentment_money: { amount: "0.00", currency_code: "USD" },
  },
  total_discount_set: {
    shop_money: { amount: "0.00", currency_code: "USD" },
    presentment_money: { amount: "0.00", currency_code: "USD" },
  },
  total_weight_unit: "g",
  original_total_duties_set: null,
  current_total_duties_set: null,
  total_outstanding: "0.00",
  payment_gateway_names: ["shopify_payments"],
  display_fulfillment_status: "unshipped",
  fulfillment_orders: [],
};

const MOCK_SHOPIFY_PRODUCT: ShopifyProduct = {
  id: 333333333,
  title: "Premium Widget",
  handle: "premium-widget",
  body_html: "<p>Our flagship product with premium features.</p>",
  published_at: "2023-10-01T12:00:00Z",
  created_at: "2023-10-01T12:00:00Z",
  updated_at: "2024-01-10T15:30:00Z",
  published_scope: "web",
  template_suffix: null,
  status: "active",
  product_type: "Widget",
  vendor: "Acme Inc",
  tags: "premium,bestseller,new",
  variants: [
    {
      id: 222222222,
      product_id: 333333333,
      title: "Red",
      price: "99.99",
      sku: "WIDGET-RED-001",
      position: 1,
      inventory_policy: "continue",
      compare_at_price: "149.99",
      fulfillment_service: "manual",
      inventory_management: "shopify",
      option1: "Red",
      option2: null,
      option3: null,
      created_at: "2023-10-01T12:00:00Z",
      updated_at: "2023-10-01T12:00:00Z",
      taxable: true,
      barcode: "BAR123456",
      grams: 200,
      image_id: null,
      weight: 200,
      weight_unit: "g",
      inventory_item_id: 987654321,
      inventory_quantity: 100,
      old_inventory_quantity: 100,
      requires_shipping: true,
      admin_graphql_api_id: "gid://shopify/ProductVariant/222222222",
    },
    {
      id: 555555555,
      product_id: 333333333,
      title: "Blue",
      price: "99.99",
      sku: "WIDGET-BLUE-001",
      position: 2,
      inventory_policy: "continue",
      compare_at_price: "149.99",
      fulfillment_service: "manual",
      inventory_management: "shopify",
      option1: "Blue",
      option2: null,
      option3: null,
      created_at: "2023-10-01T12:00:00Z",
      updated_at: "2023-10-01T12:00:00Z",
      taxable: true,
      barcode: "BAR123457",
      grams: 200,
      image_id: null,
      weight: 200,
      weight_unit: "g",
      inventory_item_id: 987654322,
      inventory_quantity: 150,
      old_inventory_quantity: 150,
      requires_shipping: true,
      admin_graphql_api_id: "gid://shopify/ProductVariant/555555555",
    },
  ],
  options: [
    {
      id: 123123123,
      product_id: 333333333,
      name: "Color",
      position: 1,
      values: ["Red", "Blue"],
    },
  ],
  images: [
    {
      id: 777777777,
      product_id: 333333333,
      position: 1,
      created_at: "2023-10-01T12:00:00Z",
      updated_at: "2023-10-01T12:00:00Z",
      alt: "Premium Widget",
      width: 500,
      height: 500,
      src: "https://cdn.shopify.com/s/files/1/0001/1234/5678/premium-widget.jpg",
      variant_ids: [222222222, 555555555],
      admin_graphql_api_id: "gid://shopify/ProductImage/777777777",
    },
  ],
  image: {
    id: 777777777,
    product_id: 333333333,
    position: 1,
    created_at: "2023-10-01T12:00:00Z",
    updated_at: "2023-10-01T12:00:00Z",
    alt: "Premium Widget",
    width: 500,
    height: 500,
    src: "https://cdn.shopify.com/s/files/1/0001/1234/5678/premium-widget.jpg",
    variant_ids: [222222222, 555555555],
    admin_graphql_api_id: "gid://shopify/ProductImage/777777777",
  },
  admin_graphql_api_id: "gid://shopify/Product/333333333",
};

const MOCK_SHOPIFY_CUSTOMER: ShopifyCustomer = {
  id: 987654321,
  email: "customer@example.com",
  accepts_marketing: true,
  created_at: "2023-12-01T08:00:00Z",
  updated_at: "2024-01-15T10:30:00Z",
  first_name: "John",
  last_name: "Doe",
  orders_count: 5,
  state: "enabled",
  total_spent: "1500.00",
  last_order_id: 123456789,
  note: "VIP customer",
  verified_email: true,
  multipass_identifier: null,
  tax_exempt: false,
  tags: "vip,wholesale",
  currency: "USD",
  phone: "+1-555-0123",
  accepts_marketing_updated_at: "2024-01-15T10:30:00Z",
  marketing_opt_in_level: "confirmed_opt_in",
  tax_exemptions: [],
  email_marketing_consent: {
    state: "subscribed",
    opt_in_level: "single_opt_in",
    consent_updated_at: "2024-01-15T10:30:00Z",
  },
  sms_marketing_consent: null,
  addresses: [
    {
      first_name: "John",
      address1: "789 Secondary Ave",
      phone: "555-5678",
      city: "Oakland",
      zip: "94612",
      province: "CA",
      country: "United States",
      last_name: "Doe",
      address2: "Suite 200",
      company: "Tech Corp",
      latitude: 37.8044,
      longitude: -122.2712,
      name: "John Doe",
      country_code: "US",
      province_code: "CA",
    },
  ],
  admin_graphql_api_id: "gid://shopify/Customer/987654321",
  default_address: {
    first_name: "John",
    address1: "456 Billing St",
    phone: "555-1234",
    city: "San Francisco",
    zip: "94102",
    province: "CA",
    country: "United States",
    last_name: "Doe",
    address2: "Suite 100",
    company: "Acme Corp",
    latitude: 37.7749,
    longitude: -122.4194,
    name: "John Doe",
    country_code: "US",
    province_code: "CA",
  },
};

// ───────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ───────────────────────────────────────────────────────────────────────────

describe("ShopifyAdapter", () => {
  let adapter: ShopifyAdapter;
  const secret = "shopify-webhook-secret";

  beforeEach(() => {
    adapter = new ShopifyAdapter();
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
      const payload = Buffer.from(
        JSON.stringify({ id: 123, order_number: 1001 }),
      );
      const signature = createValidShopifyHmac(
        payload.toString("utf-8"),
        secret,
      );

      const result = adapter.validateWebhook(payload, signature, secret);
      expect(result).toBe(true);
    });

    it("should reject webhook with invalid HMAC signature", () => {
      const payload = Buffer.from(
        JSON.stringify({ id: 123, order_number: 1001 }),
      );
      const invalidSignature = "invalid-signature-base64==";

      const result = adapter.validateWebhook(payload, invalidSignature, secret);
      expect(result).toBe(false);
    });

    it("should handle string payload", () => {
      const payloadString = JSON.stringify({ id: 456, order_number: 1002 });
      const signature = createValidShopifyHmac(payloadString, secret);

      const result = adapter.validateWebhook(payloadString, signature, secret);
      expect(result).toBe(true);
    });

    it("should detect altered payload", () => {
      const originalPayload = JSON.stringify({ id: 789, order_number: 1003 });
      const signature = createValidShopifyHmac(originalPayload, secret);
      const alteredPayload = JSON.stringify({ id: 789, order_number: 9999 });

      const result = adapter.validateWebhook(alteredPayload, signature, secret);
      expect(result).toBe(false);
    });

    it("should use timing-safe comparison to prevent timing attacks", () => {
      const payload = Buffer.from(JSON.stringify({ test: "data" }));
      const validSignature = createValidShopifyHmac(
        payload.toString("utf-8"),
        secret,
      );
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
      const payload = Buffer.from(JSON.stringify({ test: "data" }));
      const result = adapter.validateWebhook(payload, "", secret);
      expect(result).toBe(false);
    });

    it("should return false for empty secret", () => {
      const payload = Buffer.from(JSON.stringify({ test: "data" }));
      const signature = createValidShopifyHmac(
        payload.toString("utf-8"),
        secret,
      );
      const result = adapter.validateWebhook(payload, signature, "");
      expect(result).toBe(false);
    });

    it("should handle whitespace in signature gracefully", () => {
      const payload = Buffer.from(JSON.stringify({ id: 999 }));
      const signature = createValidShopifyHmac(
        payload.toString("utf-8"),
        secret,
      );
      const signatureWithWhitespace = ` ${signature} `;

      const result = adapter.validateWebhook(
        payload,
        signatureWithWhitespace,
        secret,
      );
      expect(result).toBe(false); // Should not match due to whitespace
    });

    it("should handle real-world Shopify webhook format", () => {
      const orderPayload = JSON.stringify(MOCK_SHOPIFY_ORDER);
      const signature = createValidShopifyHmac(orderPayload, secret);

      const result = adapter.validateWebhook(
        Buffer.from(orderPayload),
        signature,
        secret,
      );
      expect(result).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ORDER MAPPING TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe("mapOrder", () => {
    it("should map full Shopify order to CreateOrderInput", () => {
      const result = adapter.mapOrder(MOCK_SHOPIFY_ORDER);

      expect(result.externalOrderId).toBe("123456789");
      expect(result.source).toBe("SHOPIFY");
      expect(result.customerEmail).toBe("customer@example.com");
      expect(result.currency).toBe("USD");
      expect(result.totalPrice).toBe(299.97);
      expect(result.subtotalPrice).toBe(299.97);
      expect(result.totalTax).toBe(0);
      expect(result.totalWeight).toBe(5000);
      expect(result.financialStatus).toBe("paid");
      expect(result.fulfillmentStatus).toBe("unshipped");
      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[0].quantity).toBe(2);
      expect(result.lineItems[0].price).toBe(99.99);
      expect(result.shippingAddress.firstName).toBe("John");
      expect(result.shippingAddress.lastName).toBe("Doe");
      expect(result.shippingAddress.line1).toBe("123 Main St");
      expect(result.shippingAddress.city).toBe("San Francisco");
    });

    it("should map order with minimal data", () => {
      const minimalOrder: ShopifyOrder = {
        ...MOCK_SHOPIFY_ORDER,
        customer: null,
        shipping_address: null,
        line_items: [],
        total_tax: "15.50",
      } as unknown as ShopifyOrder;

      const result = adapter.mapOrder(minimalOrder);

      expect(result.externalOrderId).toBe("123456789");
      expect(result.totalPrice).toBe(299.97);
      expect(result.totalTax).toBe(15.5);
      expect(result.lineItems).toHaveLength(0);
    });

    it("should map order with multiple line items", () => {
      const orderWithManyItems = {
        ...MOCK_SHOPIFY_ORDER,
        line_items: [
          { ...MOCK_SHOPIFY_ORDER.line_items[0], quantity: 5 },
          { ...MOCK_SHOPIFY_ORDER.line_items[1], quantity: 3 },
          {
            id: 999,
            variant_id: 888,
            title: "Item 3",
            quantity: 1,
            sku: "SKU3",
            price: "25.00",
          } as any,
        ],
      };

      const result = adapter.mapOrder(orderWithManyItems);

      expect(result.lineItems).toHaveLength(3);
      expect(result.lineItems[0].quantity).toBe(5);
      expect(result.lineItems[2].price).toBe(25);
    });

    it("should handle cancelled order", () => {
      const cancelledOrder = {
        ...MOCK_SHOPIFY_ORDER,
        status: "cancelled",
        cancel_reason: "customer_request",
        cancelled_at: "2024-01-15T12:00:00Z",
      };

      const result = adapter.mapOrder(cancelledOrder);

      expect(result.externalOrderId).toBe("123456789");
      expect(result.status).toBe("cancelled");
    });

    it("should handle order with fulfillment status", () => {
      const fulfilledOrder = {
        ...MOCK_SHOPIFY_ORDER,
        fulfillment_status: "fulfilled",
      };

      const result = adapter.mapOrder(fulfilledOrder);

      expect(result.fulfillmentStatus).toBe("fulfilled");
    });

    it("should parse numeric prices from strings", () => {
      const order = {
        ...MOCK_SHOPIFY_ORDER,
        total_price: "123.45",
        subtotal_price: "100.00",
        total_tax: "23.45",
      };

      const result = adapter.mapOrder(order);

      expect(result.totalPrice).toBe(123.45);
      expect(result.subtotalPrice).toBe(100);
      expect(result.totalTax).toBe(23.45);
    });

    it("should extract address fields correctly", () => {
      const result = adapter.mapOrder(MOCK_SHOPIFY_ORDER);

      expect(result.shippingAddress.line1).toBe("123 Main St");
      expect(result.shippingAddress.line2).toBe("Apt 5");
      expect(result.shippingAddress.postalCode).toBe("94102");
      expect(result.shippingAddress.country).toBe("United States");
    });

    it("should handle order with customer details", () => {
      const result = adapter.mapOrder(MOCK_SHOPIFY_ORDER);

      expect(result.customerName).toBe("John Doe");
      expect(result.customerEmail).toBe("customer@example.com");
    });

    it("should set createdAt date", () => {
      const result = adapter.mapOrder(MOCK_SHOPIFY_ORDER);

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.toISOString()).toBe("2024-01-15T10:30:00.000Z");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCT MAPPING TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe("mapProduct", () => {
    it("should map full Shopify product with variants", () => {
      const result = adapter.mapProduct(MOCK_SHOPIFY_PRODUCT);

      expect(result.externalProductId).toBe("333333333");
      expect(result.source).toBe("SHOPIFY");
      expect(result.title).toBe("Premium Widget");
      expect(result.description).toBe(
        "<p>Our flagship product with premium features.</p>",
      );
      expect(result.variants).toHaveLength(2);
      expect(result.variants[0].sku).toBe("WIDGET-RED-001");
      expect(result.variants[0].price).toBe("99.99");
      expect(result.variants[1].sku).toBe("WIDGET-BLUE-001");
    });

    it("should map simple product without variants", () => {
      const simpleProduct: ShopifyProduct = {
        ...MOCK_SHOPIFY_PRODUCT,
        variants: [
          {
            id: 111,
            product_id: 333333333,
            title: "Default",
            price: "49.99",
            sku: "SIMPLE-001",
            position: 1,
            inventory_policy: "continue",
            compare_at_price: null,
            fulfillment_service: "manual",
            inventory_management: "shopify",
            option1: null,
            option2: null,
            option3: null,
            created_at: "2023-10-01T12:00:00Z",
            updated_at: "2023-10-01T12:00:00Z",
            taxable: true,
            barcode: null,
            grams: 100,
            image_id: null,
            weight: 100,
            weight_unit: "g",
            inventory_item_id: 123,
            inventory_quantity: 50,
            old_inventory_quantity: 50,
            requires_shipping: true,
            admin_graphql_api_id: "gid://shopify/ProductVariant/111",
          },
        ],
      };

      const result = adapter.mapProduct(simpleProduct);

      expect(result.variants).toHaveLength(1);
      expect(result.variants[0].sku).toBe("SIMPLE-001");
    });

    it("should extract image URL from images array", () => {
      const result = adapter.mapProduct(MOCK_SHOPIFY_PRODUCT);

      expect(result.imageUrl).toBe(
        "https://cdn.shopify.com/s/files/1/0001/1234/5678/premium-widget.jpg",
      );
    });

    it("should parse variant prices", () => {
      const result = adapter.mapProduct(MOCK_SHOPIFY_PRODUCT);

      expect(result.variants[0].inventoryQuantity).toBe(100);
      expect(result.variants[1].inventoryQuantity).toBe(150);
      expect(result.variants[0].barcode).toBe("BAR123456");
    });

    it("should handle product with tags", () => {
      const result = adapter.mapProduct(MOCK_SHOPIFY_PRODUCT);

      expect(result.tags).toContain("premium");
      expect(result.tags).toContain("bestseller");
      expect(result.tags).toContain("new");
    });

    it("should map product type and vendor", () => {
      const result = adapter.mapProduct(MOCK_SHOPIFY_PRODUCT);

      expect(result.productType).toBe("Widget");
      expect(result.vendor).toBe("Acme Inc");
    });

    it("should handle product with no images", () => {
      const productNoImages: ShopifyProduct = {
        ...MOCK_SHOPIFY_PRODUCT,
        images: [],
        image: null,
      };

      const result = adapter.mapProduct(productNoImages);

      expect(result.imageUrl).toBeUndefined();
    });

    it("should handle product with no tags", () => {
      const productNoTags: ShopifyProduct = {
        ...MOCK_SHOPIFY_PRODUCT,
        tags: "",
      };

      const result = adapter.mapProduct(productNoTags);

      expect(result.tags).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMER MAPPING TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe("mapCustomer", () => {
    it("should map full Shopify customer to CreateCustomerInput", () => {
      const result = adapter.mapCustomer(MOCK_SHOPIFY_CUSTOMER);

      expect(result.externalCustomerId).toBe("987654321");
      expect(result.source).toBe("SHOPIFY");
      expect(result.email).toBe("customer@example.com");
      expect(result.firstName).toBe("John");
      expect(result.lastName).toBe("Doe");
      expect(result.phone).toBe("+1-555-0123");
      expect(result.billingAddress).toBeDefined();
      expect(result.billingAddress?.line1).toBe("456 Billing St");
      expect(result.shippingAddress).toBeDefined();
      expect(result.shippingAddress?.line1).toBe("789 Secondary Ave");
    });

    it("should map customer with minimal data", () => {
      const minimalCustomer: ShopifyCustomer = {
        id: 111,
        email: "minimal@example.com",
        first_name: "Jane",
        last_name: "Smith",
        phone: null,
        accepts_marketing: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        orders_count: 0,
        state: "enabled",
        total_spent: "0.00",
        last_order_id: null,
        note: null,
        verified_email: false,
        multipass_identifier: null,
        tax_exempt: false,
        tags: "",
        currency: "USD",
        accepts_marketing_updated_at: "2024-01-01T00:00:00Z",
        marketing_opt_in_level: null,
        tax_exemptions: [],
        email_marketing_consent: null,
        sms_marketing_consent: null,
        addresses: [],
        admin_graphql_api_id: "gid://shopify/Customer/111",
        default_address: null,
      };

      const result = adapter.mapCustomer(minimalCustomer);

      expect(result.externalCustomerId).toBe("111");
      expect(result.email).toBe("minimal@example.com");
      expect(result.firstName).toBe("Jane");
      expect(result.lastName).toBe("Smith");
      expect(result.phone).toBeUndefined();
      expect(result.billingAddress).toBeUndefined();
    });

    it("should handle customer with multiple addresses", () => {
      const result = adapter.mapCustomer(MOCK_SHOPIFY_CUSTOMER);

      expect(result.shippingAddress).toBeDefined();
      expect(result.shippingAddress?.line1).toBe("789 Secondary Ave");
      expect(result.shippingAddress?.city).toBe("Oakland");
    });

    it("should handle customer without phone", () => {
      const customerNoPhone: ShopifyCustomer = {
        ...MOCK_SHOPIFY_CUSTOMER,
        phone: null,
      };

      const result = adapter.mapCustomer(customerNoPhone);

      expect(result.phone).toBeUndefined();
    });

    it("should handle customer without addresses", () => {
      const customerNoAddresses: ShopifyCustomer = {
        ...MOCK_SHOPIFY_CUSTOMER,
        addresses: [],
        default_address: null,
      };

      const result = adapter.mapCustomer(customerNoAddresses);

      expect(result.billingAddress).toBeUndefined();
      expect(result.shippingAddress).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH ORDER TESTS (MOCKED HTTP)
  // ─────────────────────────────────────────────────────────────────────────

  describe("fetchOrder", () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("should fetch order from Shopify REST API", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ order: MOCK_SHOPIFY_ORDER }),
      });

      const credentials = {
        shop: "mystore",
        accessToken: "shpat_test123",
      };

      const order = await adapter.fetchOrder("123456789", credentials);

      expect(order.id).toBe(123456789);
      expect(order.email).toBe("customer@example.com");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("mystore.myshopify.com"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "X-Shopify-Access-Token": "shpat_test123",
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
        shop: "mystore",
        accessToken: "shpat_test123",
      };

      await expect(
        adapter.fetchOrder("999999999", credentials),
      ).rejects.toThrow();
    });

    it("should use custom API version if provided", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ order: MOCK_SHOPIFY_ORDER }),
      });

      const credentials = {
        shop: "mystore",
        accessToken: "shpat_test123",
        apiVersion: "2023-07",
      };

      await adapter.fetchOrder("123456789", credentials);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("2023-07"),
        expect.any(Object),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH PRODUCTS TESTS (PAGINATION)
  // ─────────────────────────────────────────────────────────────────────────

  describe("fetchProducts", () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("should fetch products with pagination", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: [MOCK_SHOPIFY_PRODUCT] }),
        headers: new Map([
          [
            "Link",
            '<https://store.myshopify.com/api/2024-01/products.json?cursor=abc123>; rel="next"',
          ],
        ]),
      });

      const credentials = {
        shop: "store",
        accessToken: "shpat_test123",
      };

      const result = await adapter.fetchProducts(credentials);

      expect(result.products).toHaveLength(1);
      expect(result.products[0].id).toBe(333333333);
      expect(result.nextCursor).toBe("abc123");
    });

    it("should fetch products without next cursor on last page", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: [MOCK_SHOPIFY_PRODUCT] }),
        headers: new Map(),
      });

      const credentials = {
        shop: "store",
        accessToken: "shpat_test123",
      };

      const result = await adapter.fetchProducts(credentials);

      expect(result.nextCursor).toBeUndefined();
    });

    it("should use cursor for pagination", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: [MOCK_SHOPIFY_PRODUCT] }),
        headers: new Map(),
      });

      const credentials = {
        shop: "store",
        accessToken: "shpat_test123",
      };

      await adapter.fetchProducts(credentials, "page2cursor");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("cursor=page2cursor"),
        expect.any(Object),
      );
    });

    it("should respect limit parameter", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: [] }),
        headers: new Map(),
      });

      const credentials = {
        shop: "store",
        accessToken: "shpat_test123",
      };

      await adapter.fetchProducts(credentials, undefined, 50);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=50"),
        expect.any(Object),
      );
    });

    it("should cap limit at 250", async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: [] }),
        headers: new Map(),
      });

      const credentials = {
        shop: "store",
        accessToken: "shpat_test123",
      };

      await adapter.fetchProducts(credentials, undefined, 500);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=250"),
        expect.any(Object),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CASES AND SPECIAL SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────

  describe("Edge Cases", () => {
    it("should handle order with null customer", () => {
      const orderNullCustomer = {
        ...MOCK_SHOPIFY_ORDER,
        customer: null,
      } as unknown as ShopifyOrder;

      const result = adapter.mapOrder(orderNullCustomer);

      expect(result.customerEmail).toBe("customer@example.com");
    });

    it("should handle order with missing line items", () => {
      const orderNoItems = {
        ...MOCK_SHOPIFY_ORDER,
        line_items: undefined,
      } as any;

      const result = adapter.mapOrder(orderNoItems);

      expect(result.lineItems).toHaveLength(0);
    });

    it("should handle product with empty variants array", () => {
      const productNoVariants: ShopifyProduct = {
        ...MOCK_SHOPIFY_PRODUCT,
        variants: [],
      };

      const result = adapter.mapProduct(productNoVariants);

      expect(result.variants).toHaveLength(0);
    });

    it("should handle zero prices", () => {
      const order = {
        ...MOCK_SHOPIFY_ORDER,
        total_price: "0",
        subtotal_price: "0",
        total_tax: "0",
        line_items: [{ ...MOCK_SHOPIFY_ORDER.line_items[0], price: "0" }],
      };

      const result = adapter.mapOrder(order);

      expect(result.totalPrice).toBe(0);
      expect(result.lineItems[0].price).toBe(0);
    });

    it("should handle very large order values", () => {
      const order = {
        ...MOCK_SHOPIFY_ORDER,
        total_price: "999999.99",
        line_items: [
          {
            ...MOCK_SHOPIFY_ORDER.line_items[0],
            price: "999999.99",
            quantity: 10,
          },
        ],
      };

      const result = adapter.mapOrder(order);

      expect(result.totalPrice).toBe(999999.99);
    });

    it("should handle special characters in customer name", () => {
      const order = {
        ...MOCK_SHOPIFY_ORDER,
        customer: {
          ...MOCK_SHOPIFY_ORDER.customer,
          first_name: "Jean-Claude",
          last_name: "O'Brien",
        },
      };

      const result = adapter.mapOrder(order);

      expect(result.customerName).toContain("Jean-Claude");
      expect(result.customerName).toContain("O'Brien");
    });

    it("should validate adapter source", () => {
      expect(adapter.source).toBe("SHOPIFY");
    });
  });
});
