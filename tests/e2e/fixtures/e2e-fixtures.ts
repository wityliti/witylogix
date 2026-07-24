/**
 * E2E Test Fixtures
 *
 * Shared fixtures and test data generators for all E2E tests.
 * Provides factories for creating test orders, customers, routes, payments, etc.
 *
 * ~300 lines
 */

import { randomUUID } from "crypto";

// ─── CUSTOMER FIXTURES ───────────────────────────────────────────────────────

export interface TestCustomer {
  id: string;
  email: string;
  phone: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  createdAt: Date;
}

export function createTestCustomer(
  overrides?: Partial<TestCustomer>,
): TestCustomer {
  const baseId: string = randomUUID();
  return {
    id: baseId,
    email: `customer.${baseId.slice(0, 8)}@example.com`,
    phone: `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
    name: `Test Customer ${baseId.slice(0, 8)}`,
    address: `${Math.floor(Math.random() * 10000)} Main Street`,
    city: "San Francisco",
    state: "CA",
    postalCode: "94102",
    country: "US",
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── ORDER FIXTURES ───────────────────────────────────────────────────────────

export interface TestOrderItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
  weight?: number;
}

export interface TestOrder {
  id: string;
  externalOrderId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: TestOrderItem[];
  totalAmount: number;
  status: "pending" | "assigned" | "in_transit" | "delivered" | "cancelled";
  deliveryDate: Date;
  deliverySlot?: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostalCode: string;
  deliveryCountry: string;
  notes?: string;
  createdAt: Date;
  createdBy?: string;
  assignedDriver?: string;
  assignedRoute?: string;
  proofOfDelivery?: string;
  invoiceId?: string;
}

export function createTestOrder(overrides?: Partial<TestOrder>): TestOrder {
  const baseId: string = randomUUID();
  const customer: TestCustomer = createTestCustomer();

  return {
    id: baseId,
    externalOrderId: `EXT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    items: [
      {
        sku: `SKU-${Math.random().toString(36).substring(7)}`,
        name: "Test Product",
        quantity: 1,
        price: 2999,
        weight: 0.5,
      },
    ],
    totalAmount: 2999,
    status: "pending",
    deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    deliverySlot: "09:00-12:00",
    deliveryAddress: customer.address,
    deliveryCity: customer.city,
    deliveryPostalCode: customer.postalCode,
    deliveryCountry: customer.country,
    notes: "Leave at front door",
    createdAt: new Date(),
    ...overrides,
  };
}

export function createTestOrderWithMultipleItems(
  itemCount: number = 3,
  overrides?: Partial<TestOrder>,
): TestOrder {
  const items: TestOrderItem[] = Array.from({ length: itemCount }, (_, i) => ({
    sku: `SKU-${Math.random().toString(36).substring(7)}`,
    name: `Product ${i + 1}`,
    quantity: Math.floor(Math.random() * 3) + 1,
    price: Math.floor(Math.random() * 5000) + 999,
    weight: Math.random() * 2 + 0.1,
  }));

  const totalAmount: number = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return createTestOrder({
    items,
    totalAmount,
    ...overrides,
  });
}

// ─── ROUTE FIXTURES ───────────────────────────────────────────────────────────

export interface TestRoute {
  id: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  status: "planned" | "active" | "completed" | "cancelled";
  startLocation: { lat: number; lng: number };
  waypoints: Array<{ orderId: string; lat: number; lng: number }>;
  estimatedDuration: number;
  estimatedDistance: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export function createTestRoute(overrides?: Partial<TestRoute>): TestRoute {
  const baseId: string = randomUUID();

  return {
    id: baseId,
    driverId: `driver_${Math.random().toString(36).substring(7)}`,
    driverName: `Driver ${baseId.slice(0, 8)}`,
    driverPhone: `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
    status: "planned",
    startLocation: {
      lat: 37.7749 + (Math.random() - 0.5) * 0.1,
      lng: -122.4194 + (Math.random() - 0.5) * 0.1,
    },
    waypoints: [],
    estimatedDuration: 120,
    estimatedDistance: 45.2,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── PAYMENT FIXTURES ────────────────────────────────────────────────────────

export interface StripePaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: "succeeded" | "processing" | "requires_payment_method" | "canceled";
  clientSecret: string;
  customerId: string;
  invoiceId: string;
  createdAt: Date;
}

export function createStripePaymentIntent(
  overrides?: Partial<StripePaymentIntent>,
): StripePaymentIntent {
  const baseId: string = randomUUID();

  return {
    id: `pi_${Math.random().toString(36).substring(7)}`,
    amount: 2999,
    currency: "USD",
    status: "succeeded",
    clientSecret: `${baseId}_secret_${Math.random().toString(36).substring(7)}`,
    customerId: `cus_${Math.random().toString(36).substring(7)}`,
    invoiceId: `inv_${Math.random().toString(36).substring(7)}`,
    createdAt: new Date(),
    ...overrides,
  };
}

export interface PayPalOrder {
  id: string;
  amount: number;
  currency: string;
  status: "CREATED" | "APPROVED" | "CAPTURED" | "REFUNDED" | "CANCELLED";
  invoiceId: string;
  customerId: string;
  createdAt: Date;
}

export function createPayPalOrder(
  overrides?: Partial<PayPalOrder>,
): PayPalOrder {
  const baseId: string = randomUUID();

  return {
    id: `PPL-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    amount: 2999,
    currency: "USD",
    status: "CAPTURED",
    invoiceId: `inv_${Math.random().toString(36).substring(7)}`,
    customerId: `cus_${Math.random().toString(36).substring(7)}`,
    createdAt: new Date(),
    ...overrides,
  };
}

export interface SquarePayment {
  id: string;
  amount: number;
  currency: string;
  status: "COMPLETED" | "APPROVED" | "PENDING" | "FAILED" | "CANCELED";
  receiptUrl: string;
  invoiceId: string;
  customerId: string;
  createdAt: Date;
}

export function createSquarePayment(
  overrides?: Partial<SquarePayment>,
): SquarePayment {
  const baseId: string = randomUUID();

  return {
    id: `SQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    amount: 2999,
    currency: "USD",
    status: "COMPLETED",
    receiptUrl: `https://square.com/receipts/${Math.random().toString(36).substring(7)}`,
    invoiceId: `inv_${Math.random().toString(36).substring(7)}`,
    customerId: `cus_${Math.random().toString(36).substring(7)}`,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── WEBHOOK FIXTURES ────────────────────────────────────────────────────────

export interface ShopifyOrderWebhook {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  test: boolean;
  currency: string;
  total_price: string;
  line_items: Array<{
    id: string;
    title: string;
    quantity: number;
    price: string;
  }>;
  shipping_address: {
    first_name: string;
    last_name: string;
    street: string;
    city: string;
    province: string;
    zip: string;
    country: string;
    phone: string;
  };
  customer: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
}

export function createShopifyOrderWebhook(
  overrides?: Partial<ShopifyOrderWebhook>,
): ShopifyOrderWebhook {
  const customerId: string = Math.floor(Math.random() * 1000000000).toString();
  const orderId: string = Math.floor(Math.random() * 1000000000).toString();

  return {
    id: orderId,
    email: `customer@example.com`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    test: false,
    currency: "USD",
    total_price: "29.99",
    line_items: [
      {
        id: "test_line_item_1",
        title: "Test Product",
        quantity: 1,
        price: "29.99",
      },
    ],
    shipping_address: {
      first_name: "John",
      last_name: "Doe",
      street: "123 Main St",
      city: "San Francisco",
      province: "CA",
      zip: "94102",
      country: "US",
      phone: "+14155551234",
    },
    customer: {
      id: customerId,
      email: `customer.${customerId}@example.com`,
      first_name: "John",
      last_name: "Doe",
      phone: "+14155551234",
    },
    ...overrides,
  };
}

export interface WooCommerceProductWebhook {
  id: number;
  name: string;
  slug: string;
  sku: string;
  regular_price: string;
  sale_price?: string;
  stock_quantity: number;
  status: "publish" | "draft" | "trash";
  description: string;
  short_description: string;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
}

export function createWooCommerceProductWebhook(
  overrides?: Partial<WooCommerceProductWebhook>,
): WooCommerceProductWebhook {
  const baseId: number = Math.floor(Math.random() * 1000000);

  return {
    id: baseId,
    name: `Test Product ${baseId}`,
    slug: `test-product-${baseId}`,
    sku: `SKU-${Math.random().toString(36).substring(7)}`,
    regular_price: "29.99",
    sale_price: "24.99",
    stock_quantity: 100,
    status: "publish",
    description: "This is a test product description.",
    short_description: "Test product",
    weight: "2.5",
    dimensions: {
      length: "10",
      width: "8",
      height: "5",
    },
    ...overrides,
  };
}

export interface MagentoFulfillmentWebhook {
  entity_id: string;
  increment_id: string;
  status: "processing" | "complete" | "canceled";
  items: Array<{
    item_id: string;
    sku: string;
    name: string;
    qty: number;
  }>;
  shipping: {
    tracking_number?: string;
    carrier_code?: string;
    title?: string;
  };
}

export function createMagentoFulfillmentWebhook(
  overrides?: Partial<MagentoFulfillmentWebhook>,
): MagentoFulfillmentWebhook {
  const baseId: string = Math.floor(Math.random() * 1000000).toString();
  const trackingNumber: string = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;

  return {
    entity_id: baseId,
    increment_id: `100000${baseId}`,
    status: "complete",
    items: [
      {
        item_id: "1",
        sku: `SKU-${Math.random().toString(36).substring(7)}`,
        name: "Test Product",
        qty: 1,
      },
    ],
    shipping: {
      tracking_number: trackingNumber,
      carrier_code: "fedex",
      title: "FedEx",
    },
    ...overrides,
  };
}

// ─── NOTIFICATION FIXTURES ──────────────────────────────────────────────────

export interface NotificationRecord {
  id: string;
  type:
    | "order_created"
    | "order_assigned"
    | "order_in_transit"
    | "order_delivered";
  recipient: string;
  recipientType: "email" | "sms" | "push";
  status: "sent" | "failed" | "pending";
  sentAt?: Date;
  createdAt: Date;
}

export function createNotificationRecord(
  overrides?: Partial<NotificationRecord>,
): NotificationRecord {
  const baseId: string = randomUUID();

  return {
    id: baseId,
    type: "order_created",
    recipient: `customer.${baseId.slice(0, 8)}@example.com`,
    recipientType: "email",
    status: "sent",
    sentAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── INVOICE FIXTURES ────────────────────────────────────────────────────────

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  customerId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  dueDate: Date;
  issuedAt: Date;
  paidAt?: Date;
}

export function createInvoiceRecord(
  overrides?: Partial<InvoiceRecord>,
): InvoiceRecord {
  const baseId: string = randomUUID();

  return {
    id: baseId,
    invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    customerId: `cus_${Math.random().toString(36).substring(7)}`,
    orderId: `ord_${Math.random().toString(36).substring(7)}`,
    amount: 2999,
    currency: "USD",
    status: "sent",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    issuedAt: new Date(),
    ...overrides,
  };
}

// ─── DELIVERY SLOT FIXTURES ─────────────────────────────────────────────────

export interface DeliverySlot {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  zone: string;
  capacity: number;
  booked: number;
  price: number;
  available: boolean;
}

export function createDeliverySlot(
  overrides?: Partial<DeliverySlot>,
): DeliverySlot {
  const baseId: string = randomUUID();

  return {
    id: baseId,
    date: new Date(Date.now() + 24 * 60 * 60 * 1000),
    startTime: "09:00",
    endTime: "12:00",
    zone: "zone_1",
    capacity: 50,
    booked: 10,
    price: 599,
    available: true,
    ...overrides,
  };
}
