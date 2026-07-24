/**
 * WooCommerce Test Fixtures
 * Mock data for WooCommerce integration tests
 */

import type {
  WCOrder,
  WCOrderStatus,
  WCProduct,
  WCCustomer,
  WCWebhook,
  WCWebhookPayload,
} from "../../../packages/core/src/integrations/woocommerce/types.js";

/**
 * Create mock WC order
 */
export function createMockWCOrder(overrides?: Partial<WCOrder>): WCOrder {
  return {
    id: 12345,
    parent_id: 0,
    number: "WC-2024-001",
    order_key: "wc_order_key_abc123",
    created_via: "checkout",
    version: "8.0.0",
    status: "processing" as WCOrderStatus,
    currency: "USD",
    date_created: new Date().toISOString(),
    date_created_gmt: new Date().toISOString(),
    date_modified: new Date().toISOString(),
    date_modified_gmt: new Date().toISOString(),
    discount_total: "0.00",
    discount_tax: "0.00",
    shipping_total: "10.00",
    shipping_tax: "0.80",
    cart_tax: "6.00",
    total: "106.00",
    total_tax: "6.80",
    customer_id: 456,
    customer_note: "Please leave at front door",
    billing: {
      first_name: "John",
      last_name: "Doe",
      company: "Acme Corp",
      address_1: "123 Main Street",
      address_2: "Suite 100",
      city: "New York",
      state: "NY",
      postcode: "10001",
      country: "US",
      email: "john@example.com",
      phone: "+1234567890",
    },
    shipping: {
      first_name: "John",
      last_name: "Doe",
      company: "Acme Corp",
      address_1: "456 Oak Avenue",
      address_2: "",
      city: "Brooklyn",
      state: "NY",
      postcode: "11201",
      country: "US",
    },
    payment_method: "credit_card",
    payment_method_title: "Credit Card",
    transaction_id: "txn_abc123def456",
    date_paid: new Date().toISOString(),
    date_completed: null,
    cart_hash: "hash_abc123xyz789",
    meta_data: [
      { id: 1, key: "delivery_date", value: "2024-03-15" },
      { id: 2, key: "time_slot", value: "09:00-11:00" },
      { id: 3, key: "_wc_reserved", value: "internal" },
    ],
    line_items: [
      {
        id: 1,
        name: "Premium Widget",
        product_id: 101,
        variation_id: 0,
        quantity: 2,
        tax_class: "standard",
        subtotal: "50.00",
        subtotal_tax: "3.00",
        total: "50.00",
        total_tax: "3.00",
        taxes: [],
        meta_data: [],
        sku: "WIDGET-PREM-001",
        price: 25.0,
      },
      {
        id: 2,
        name: "Standard Widget",
        product_id: 102,
        variation_id: 0,
        quantity: 1,
        tax_class: "standard",
        subtotal: "40.00",
        subtotal_tax: "2.40",
        total: "40.00",
        total_tax: "2.40",
        taxes: [],
        meta_data: [],
        sku: "WIDGET-STD-001",
        price: 40.0,
      },
    ],
    tax_lines: [],
    shipping_lines: [],
    fee_lines: [],
    coupon_lines: [],
    ...overrides,
  };
}

/**
 * Create mock WC orders list
 */
export function createMockWCOrders(count: number): WCOrder[] {
  return Array.from({ length: count }, (_, i) =>
    createMockWCOrder({
      id: 10001 + i,
      number: `WC-2024-${String(i + 1).padStart(3, "0")}`,
      customer_id: 1000 + i,
      status: ["pending", "processing", "completed", "cancelled"][
        i % 4
      ] as WCOrderStatus,
    }),
  );
}

/**
 * Create mock WC product
 */
export function createMockWCProduct(overrides?: Partial<WCProduct>): WCProduct {
  return {
    id: 101,
    name: "Premium Widget",
    slug: "premium-widget",
    permalink: "https://example.com/product/premium-widget",
    date_created: new Date().toISOString(),
    date_created_gmt: new Date().toISOString(),
    date_modified: new Date().toISOString(),
    date_modified_gmt: new Date().toISOString(),
    type: "simple",
    status: "publish",
    featured: false,
    catalog_visibility: "visible",
    description: "A premium widget with advanced features",
    short_description: "Premium widget",
    sku: "WIDGET-PREM-001",
    price: "25.00",
    regular_price: "25.00",
    sale_price: null,
    date_on_sale_from: null,
    date_on_sale_from_gmt: null,
    date_on_sale_to: null,
    date_on_sale_to_gmt: null,
    price_html: "<span>$25.00</span>",
    on_sale: false,
    purchasable: true,
    total_sales: 150,
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
    stock_quantity: 100,
    stock_status: "instock",
    backorders: "no",
    backorders_allowed: false,
    backordered: false,
    low_stock_amount: 10,
    sold_individually: false,
    weight: "2.5",
    dimensions: {
      length: "10",
      width: "10",
      height: "5",
    },
    shipping_required: true,
    shipping_taxable: true,
    shipping_class: "standard",
    shipping_class_id: 0,
    reviews_allowed: true,
    average_rating: "4.5",
    rating_count: 45,
    upsell_ids: [],
    cross_sell_ids: [],
    parent_id: 0,
    purchase_note: "",
    categories: [
      {
        id: 10,
        name: "Widgets",
        slug: "widgets",
      },
    ],
    tags: [],
    images: [
      {
        id: 5000,
        date_created: new Date().toISOString(),
        date_created_gmt: new Date().toISOString(),
        date_modified: new Date().toISOString(),
        date_modified_gmt: new Date().toISOString(),
        src: "https://example.com/widget.jpg",
        name: "Widget Image",
        alt: "Widget product image",
      },
    ],
    attributes: [
      {
        id: 1,
        name: "Color",
        position: 0,
        visible: true,
        variation: false,
        options: ["Red", "Blue", "Green"],
      },
    ],
    default_attributes: [],
    variations: [],
    grouped_products: [],
    menu_order: 0,
    meta_data: [],
    ...overrides,
  } as WCProduct;
}

/**
 * Create mock WC customer
 */
export function createMockWCCustomer(
  overrides?: Partial<WCCustomer>,
): WCCustomer {
  return {
    id: 456,
    date_created: new Date().toISOString(),
    date_created_gmt: new Date().toISOString(),
    date_modified: new Date().toISOString(),
    date_modified_gmt: new Date().toISOString(),
    email: "john@example.com",
    first_name: "John",
    last_name: "Doe",
    role: "customer",
    username: "johndoe",
    billing: {
      first_name: "John",
      last_name: "Doe",
      company: "Acme Corp",
      address_1: "123 Main Street",
      address_2: "Suite 100",
      city: "New York",
      state: "NY",
      postcode: "10001",
      country: "US",
      email: "john@example.com",
      phone: "+1234567890",
    },
    shipping: {
      first_name: "John",
      last_name: "Doe",
      company: "Acme Corp",
      address_1: "456 Oak Avenue",
      address_2: "",
      city: "Brooklyn",
      state: "NY",
      postcode: "11201",
      country: "US",
    },
    is_paying_customer: true,
    avatar_url: "https://example.com/avatar.jpg",
    meta_data: [],
    ...overrides,
  } as WCCustomer;
}

/**
 * Create mock WC webhook
 */
export function createMockWCWebhook(overrides?: Partial<WCWebhook>): WCWebhook {
  return {
    id: 1001,
    name: "Order Created Webhook",
    status: "active",
    topic: "order.created",
    resource: "order",
    event: "created",
    hooks: ["woocommerce_after_order_object_save"],
    delivery_url: "https://example.com/webhooks/orders",
    secret: "webhook_secret_xyz789",
    api_version: "wc/v3",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    _links: {
      self: [{ href: "https://example.com/wp-json/wc/v3/webhooks/1001" }],
      collection: [{ href: "https://example.com/wp-json/wc/v3/webhooks" }],
    },
    ...overrides,
  } as WCWebhook;
}

/**
 * Create mock webhook payload
 */
export function createMockWebhookPayload(
  overrides?: Partial<WCWebhookPayload>,
): WCWebhookPayload {
  return {
    id: 12345,
    delivery_id: "delivery_550e8400_e29b_41d4_a716",
    resource: "order",
    event: "created",
    created_at: new Date().toISOString(),
    ...overrides,
  } as WCWebhookPayload;
}

/**
 * Create mock WC API error response
 */
export function createMockWCErrorResponse(
  code: string,
  message: string,
): Record<string, unknown> {
  return {
    code,
    message,
    data: {
      status: 400,
    },
  };
}

/**
 * Create mock WC list response
 */
export function createMockWCListResponse<T>(items: T[]): {
  data: T[];
} {
  return {
    data: items,
  };
}

/**
 * Create mock OAuth signature
 */
export function createMockOAuthSignature(): string {
  return 'OAuth oauth_consumer_key="test_key", oauth_nonce="random_nonce", oauth_signature="signature_hash", oauth_signature_method="HMAC-SHA256", oauth_timestamp="1234567890", oauth_version="1.0"';
}

/**
 * Guest customer fixture - order without customer account
 */
export function createMockGuestOrderFixture(): WCOrder {
  return createMockWCOrder({
    customer_id: 0,
    billing: {
      first_name: "Jane",
      last_name: "Guest",
      company: "Guest Company",
      address_1: "999 Temporary Lane",
      address_2: "",
      city: "San Francisco",
      state: "CA",
      postcode: "94101",
      country: "US",
      email: "jane.guest@temporary.com",
      phone: "+15551234567",
    },
  });
}

/**
 * Order with multiple items fixture
 */
export function createMockOrderWithMultipleItems(): WCOrder {
  return createMockWCOrder({
    line_items: [
      {
        id: 1,
        name: "Item A",
        product_id: 101,
        variation_id: 0,
        quantity: 5,
        tax_class: "standard",
        subtotal: "50.00",
        subtotal_tax: "3.00",
        total: "50.00",
        total_tax: "3.00",
        taxes: [],
        meta_data: [],
        sku: "SKU-A",
        price: 10.0,
      },
      {
        id: 2,
        name: "Item B",
        product_id: 102,
        variation_id: 0,
        quantity: 3,
        tax_class: "standard",
        subtotal: "30.00",
        subtotal_tax: "1.80",
        total: "30.00",
        total_tax: "1.80",
        taxes: [],
        meta_data: [],
        sku: "SKU-B",
        price: 10.0,
      },
      {
        id: 3,
        name: "Item C",
        product_id: 103,
        variation_id: 0,
        quantity: 2,
        tax_class: "standard",
        subtotal: "20.00",
        subtotal_tax: "1.20",
        total: "20.00",
        total_tax: "1.20",
        taxes: [],
        meta_data: [],
        sku: "SKU-C",
        price: 10.0,
      },
    ],
    total: "100.80",
    total_tax: "6.00",
  });
}

/**
 * Order with meta fields fixture - for testing custom field mapping
 */
export function createMockOrderWithMetaFields(): WCOrder {
  return createMockWCOrder({
    meta_data: [
      { id: 1, key: "delivery_date", value: "2024-03-15" },
      { id: 2, key: "time_slot", value: "09:00-11:00" },
      { id: 3, key: "delivery_instructions", value: "Ring doorbell twice" },
      { id: 4, key: "signature_required", value: "true" },
      { id: 5, key: "_wc_internal", value: "hidden" },
      {
        id: 6,
        key: "custom_object",
        value: { nested: true, count: 5 },
      },
    ],
  });
}

/**
 * Cancelled order fixture
 */
export function createMockCancelledOrder(): WCOrder {
  return createMockWCOrder({
    status: "cancelled",
    date_completed: new Date().toISOString(),
  });
}

/**
 * Refunded order fixture
 */
export function createMockRefundedOrder(): WCOrder {
  return createMockWCOrder({
    status: "refunded",
    date_completed: new Date().toISOString(),
  });
}

/**
 * Order with different delivery address fixture
 */
export function createMockOrderWithDifferentShippingAddress(): WCOrder {
  return createMockWCOrder({
    shipping: {
      first_name: "Martha",
      last_name: "Smith",
      company: "Smith Inc",
      address_1: "789 Different Street",
      address_2: "Building B",
      city: "Los Angeles",
      state: "CA",
      postcode: "90001",
      country: "US",
    },
  });
}
