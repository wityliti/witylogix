/**
 * Test Fixtures for Integration Tests
 * Factory functions for mock data across all domains
 * ~300 lines
 */

// ───────────────────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────────────────

export interface MockOrder {
  id: string;
  customerId: string;
  items: MockOrderItem[];
  total: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

export interface MockOrderItem {
  productId: string;
  quantity: number;
  price: number;
  name: string;
}

export interface MockProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  sku: string;
  category: string;
}

export interface MockPaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  customerId: string;
  metadata: Record<string, string>;
}

export interface MockVehicle {
  id: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  status: "active" | "inactive" | "maintenance";
}

export interface MockVehicleLocation {
  vehicleId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

export interface MockRoute {
  id: string;
  driverId: string;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
  stops: MockStop[];
  status: "pending" | "active" | "completed" | "cancelled";
  createdAt: Date;
}

export interface MockStop {
  id: string;
  location: { lat: number; lng: number };
  address: string;
  sequence: number;
  status: "pending" | "completed" | "skipped";
}

export interface MockShipment {
  id: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  status: "created" | "picked_up" | "in_transit" | "delivered" | "failed";
  estimatedDelivery: Date;
  actualDelivery?: Date;
}

export interface MockInvoice {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  status: "draft" | "issued" | "paid" | "overdue" | "cancelled";
  dueDate: Date;
  issuedAt: Date;
  items: MockInvoiceItem[];
}

export interface MockInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface MockContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface MockWebhookEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, any>;
}

export interface CredentialFixture {
  apiKey: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  bearerToken: string;
}

// ───────────────────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────────────────

function randomId(prefix: string): string {
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${random}`;
}

function randomString(length: number = 10): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

// ───────────────────────────────────────────────────────────────────────────
// ECOMMERCE FIXTURES
// ───────────────────────────────────────────────────────────────────────────

export function createMockOrder(overrides?: Partial<MockOrder>): MockOrder {
  const now = new Date();
  return {
    id: randomId("order"),
    customerId: randomId("cust"),
    items: [createMockOrderItem()],
    total: 99.99,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockOrderItem(
  overrides?: Partial<MockOrderItem>,
): MockOrderItem {
  return {
    productId: randomId("prod"),
    quantity: 1,
    price: 99.99,
    name: "Sample Product",
    ...overrides,
  };
}

export function createMockProduct(
  overrides?: Partial<MockProduct>,
): MockProduct {
  return {
    id: randomId("prod"),
    name: "Sample Product",
    description: "A sample product for testing",
    price: 99.99,
    stock: 100,
    sku: `SKU-${randomString(8)}`,
    category: "Electronics",
    ...overrides,
  };
}

export function createMockPaymentIntent(
  overrides?: Partial<MockPaymentIntent>,
): MockPaymentIntent {
  return {
    id: randomId("pi"),
    amount: 9999,
    currency: "USD",
    status: "pending",
    customerId: randomId("cust"),
    metadata: {
      orderId: randomId("order"),
    },
    ...overrides,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// LOGISTICS & DELIVERY FIXTURES
// ───────────────────────────────────────────────────────────────────────────

export function createMockVehicle(
  overrides?: Partial<MockVehicle>,
): MockVehicle {
  return {
    id: randomId("veh"),
    licensePlate: `LIC${randomString(6).toUpperCase()}`,
    make: "Toyota",
    model: "Camry",
    year: 2023,
    vin: `VIN${randomString(14).toUpperCase()}`,
    status: "active",
    ...overrides,
  };
}

export function createMockVehicleLocation(
  overrides?: Partial<MockVehicleLocation>,
): MockVehicleLocation {
  return {
    vehicleId: randomId("veh"),
    latitude: 37.7749 + (Math.random() - 0.5) * 0.1,
    longitude: -122.4194 + (Math.random() - 0.5) * 0.1,
    timestamp: Date.now(),
    speed: Math.floor(Math.random() * 80),
    heading: Math.floor(Math.random() * 360),
    ...overrides,
  };
}

export function createMockRoute(overrides?: Partial<MockRoute>): MockRoute {
  return {
    id: randomId("route"),
    driverId: randomId("driver"),
    startLocation: { lat: 37.7749, lng: -122.4194 },
    endLocation: { lat: 34.0522, lng: -118.2437 },
    stops: [
      {
        id: randomId("stop"),
        location: { lat: 37.8044, lng: -122.2712 },
        address: "123 Main St",
        sequence: 1,
        status: "pending",
      },
    ],
    status: "pending",
    createdAt: new Date(),
    ...overrides,
  };
}

export function createMockShipment(
  overrides?: Partial<MockShipment>,
): MockShipment {
  return {
    id: randomId("ship"),
    orderId: randomId("order"),
    trackingNumber: `TRACK${randomString(10).toUpperCase()}`,
    carrier: "FedEx",
    status: "created",
    estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// ACCOUNTING FIXTURES
// ───────────────────────────────────────────────────────────────────────────

export function createMockInvoice(
  overrides?: Partial<MockInvoice>,
): MockInvoice {
  const now = new Date();
  return {
    id: randomId("inv"),
    customerId: randomId("cust"),
    amount: 5000,
    currency: "USD",
    status: "issued",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    issuedAt: now,
    items: [
      {
        description: "Service charge",
        quantity: 1,
        unitPrice: 5000,
        amount: 5000,
      },
    ],
    ...overrides,
  };
}

export function createMockContact(
  overrides?: Partial<MockContact>,
): MockContact {
  return {
    id: randomId("contact"),
    name: "John Doe",
    email: `john${randomString(5)}@example.com`,
    phone: "+1-555-0123",
    company: "Acme Corp",
    address: "123 Business Ave",
    city: "San Francisco",
    state: "CA",
    zipCode: "94102",
    country: "USA",
    ...overrides,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// WEBHOOK FIXTURES
// ───────────────────────────────────────────────────────────────────────────

export function createMockWebhookEvent(
  overrides?: Partial<MockWebhookEvent>,
): MockWebhookEvent {
  return {
    id: randomId("evt"),
    type: "payment.completed",
    timestamp: Date.now(),
    data: {
      paymentId: randomId("pay"),
      amount: 9999,
      currency: "USD",
    },
    ...overrides,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// PROVIDER-SPECIFIC RESPONSE FIXTURES
// ───────────────────────────────────────────────────────────────────────────

export function stripePaymentIntentResponse(
  overrides?: Partial<MockPaymentIntent>,
): Record<string, any> {
  const intent = createMockPaymentIntent(overrides);
  return {
    id: intent.id,
    object: "payment_intent",
    amount: intent.amount,
    currency: intent.currency,
    status: intent.status,
    client_secret: `pi_secret_${randomString(20)}`,
    customer: intent.customerId,
    metadata: intent.metadata,
    created: Math.floor(Date.now() / 1000),
  };
}

export function shopifyOrderResponse(
  overrides?: Partial<MockOrder>,
): Record<string, any> {
  const order = createMockOrder(overrides);
  return {
    id:
      parseInt(order.id.replace(/\D/g, "")) ||
      Math.floor(Math.random() * 1000000),
    email: `customer-${randomString(8)}@example.com`,
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
    total_price: order.total.toString(),
    financial_status: order.status === "pending" ? "pending" : "paid",
    fulfillment_status: order.status,
    line_items: order.items.map((item) => ({
      id:
        parseInt(item.productId.replace(/\D/g, "")) ||
        Math.floor(Math.random() * 1000000),
      product_id:
        parseInt(item.productId.replace(/\D/g, "")) ||
        Math.floor(Math.random() * 1000000),
      title: item.name,
      quantity: item.quantity,
      price: item.price.toString(),
    })),
  };
}

export function stripeWebhookResponse(
  event: MockWebhookEvent,
): Record<string, any> {
  return {
    id: event.id,
    object: "event",
    api_version: "2023-10-16",
    created: Math.floor(event.timestamp / 1000),
    type: event.type,
    data: {
      object: event.data,
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// CREDENTIAL FIXTURES (ALL FAKE)
// ───────────────────────────────────────────────────────────────────────────

export function credentialFixture(): CredentialFixture {
  return {
    apiKey: `sk_test_${randomString(32)}`,
    clientId: `client_${randomString(20)}`,
    clientSecret: `secret_${randomString(32)}`,
    username: `testuser_${randomString(8)}`,
    password: `password_${randomString(12)}`,
    bearerToken: `bearer_${randomString(40)}`,
  };
}

export function apiKeyFixture(): string {
  return `sk_test_${randomString(32)}`;
}

export function oauth2TokenFixture(): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} {
  return {
    accessToken: `access_${randomString(40)}`,
    refreshToken: `refresh_${randomString(40)}`,
    expiresIn: 3600,
  };
}

export function jwtTokenFixture(): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: randomId("user"),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  const signature = randomString(40);
  return `${header}.${payload}.${signature}`;
}

// ───────────────────────────────────────────────────────────────────────────
// BULK DATA GENERATORS
// ───────────────────────────────────────────────────────────────────────────

export function generateOrders(
  count: number,
  overrides?: Partial<MockOrder>,
): MockOrder[] {
  return Array.from({ length: count }, () => createMockOrder(overrides));
}

export function generateProducts(
  count: number,
  overrides?: Partial<MockProduct>,
): MockProduct[] {
  return Array.from({ length: count }, () => createMockProduct(overrides));
}

export function generateVehicles(
  count: number,
  overrides?: Partial<MockVehicle>,
): MockVehicle[] {
  return Array.from({ length: count }, () => createMockVehicle(overrides));
}

export function generateVehicleLocations(
  count: number,
  vehicleId?: string,
): MockVehicleLocation[] {
  return Array.from({ length: count }, (_, i) => {
    const baseLat = 37.7749;
    const baseLng = -122.4194;
    return {
      vehicleId: vehicleId || randomId("veh"),
      latitude: baseLat + (Math.random() - 0.5) * 0.2,
      longitude: baseLng + (Math.random() - 0.5) * 0.2,
      timestamp: Date.now() + i * 60000,
      speed: Math.floor(Math.random() * 80),
      heading: Math.floor(Math.random() * 360),
    };
  });
}

export function generateInvoices(
  count: number,
  overrides?: Partial<MockInvoice>,
): MockInvoice[] {
  return Array.from({ length: count }, () => createMockInvoice(overrides));
}

export function generateShipments(
  count: number,
  overrides?: Partial<MockShipment>,
): MockShipment[] {
  return Array.from({ length: count }, () => createMockShipment(overrides));
}
