/**
 * Test Data Factories
 * Factory functions for creating mock test data with Faker-style randomization
 * - createMockOrganization()
 * - createMockShop()
 * - createMockOrder()
 * - createMockDriver()
 * - createMockDelivery()
 * - createMockIntegration()
 * - createMockUser()
 * - Bulk factory: createMany()
 *
 * Usage:
 *   const org = createMockOrganization({ name: 'Custom Org' });
 *   const orders = createMany(() => createMockOrder(), 10);
 */

import { randomBytes, randomUUID } from "crypto";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a random string of specified length
 */
function randomString(length: number = 8): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a random email address
 */
function randomEmail(): string {
  return `${randomString(10)}@example.com`;
}

/**
 * Generate a random phone number
 */
function randomPhone(): string {
  return `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
}

/**
 * Generate a random company name
 */
function randomCompanyName(): string {
  const prefixes = [
    "Acme",
    "Tech",
    "Global",
    "Prime",
    "Elite",
    "Swift",
    "Fast",
    "Smart",
  ];
  const suffixes = [
    "Corp",
    "Industries",
    "Services",
    "Solutions",
    "Logistics",
    "Express",
    "Hub",
  ];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  return `${prefix} ${suffix}`;
}

/**
 * Generate a random first name
 */
function randomFirstName(): string {
  const names = [
    "John",
    "Jane",
    "Michael",
    "Sarah",
    "David",
    "Emma",
    "James",
    "Lisa",
    "Robert",
    "Maria",
    "William",
    "Anna",
    "Charles",
    "Rachel",
    "Daniel",
    "Lauren",
  ];
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Generate a random last name
 */
function randomLastName(): string {
  const names = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Hernandez",
    "Lopez",
    "Gonzalez",
    "Wilson",
    "Anderson",
    "Thomas",
  ];
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Generate a random address
 */
function randomAddress(): string {
  const streets = [
    "123 Main St",
    "456 Oak Ave",
    "789 Elm Rd",
    "321 Pine Ln",
    "654 Maple Dr",
    "987 Cedar Way",
    "159 Birch Ct",
    "753 Willow Pl",
  ];
  const cities = [
    "New York",
    "Los Angeles",
    "Chicago",
    "Houston",
    "Phoenix",
    "Philadelphia",
    "San Antonio",
    "San Diego",
    "Dallas",
    "San Jose",
  ];
  const states = ["NY", "CA", "TX", "FL", "PA", "IL", "OH", "GA"];

  const street = streets[Math.floor(Math.random() * streets.length)];
  const city = cities[Math.floor(Math.random() * cities.length)];
  const state = states[Math.floor(Math.random() * states.length)];
  const zip = Math.floor(Math.random() * 90000) + 10000;

  return `${street}, ${city}, ${state} ${zip}`;
}

/**
 * Generate a random UUID
 */
function randomId(): string {
  return randomUUID();
}

/**
 * Generate a random ISO timestamp
 */
function randomTimestamp(): string {
  const days = Math.floor(Math.random() * 30);
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/**
 * Generate a random future ISO timestamp
 */
function randomFutureTimestamp(): string {
  const days = Math.floor(Math.random() * 30) + 1;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

// ============================================================================
// MOCK TYPES
// ============================================================================

export interface MockOrganization {
  id: string;
  name: string;
  email: string;
  phone: string;
  website?: string;
  industry?: string;
  planType: "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MockShop {
  id: string;
  organizationId: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  email: string;
  managerId: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface MockOrder {
  id: string;
  shopId: string;
  customerId: string;
  status: "PENDING" | "CONFIRMED" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  items: Array<{ productId: string; quantity: number; price: number }>;
  totalAmount: number;
  deliveryAddress: string;
  deliveryDeadline: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MockDriver {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "SUSPENDED";
  vehicleId?: string;
  rating: number;
  totalDeliveries: number;
  createdAt: string;
  updatedAt: string;
}

export interface MockDelivery {
  id: string;
  orderId: string;
  driverId: string;
  shopId: string;
  status:
    | "PENDING"
    | "ASSIGNED"
    | "PICKED_UP"
    | "IN_TRANSIT"
    | "DELIVERED"
    | "FAILED";
  pickupAddress: string;
  deliveryAddress: string;
  estimatedArrival?: string;
  actualArrival?: string;
  failureReason?: string;
  distance: number;
  duration?: number;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MockIntegration {
  id: string;
  organizationId: string;
  provider: string;
  status: "ACTIVE" | "INACTIVE" | "ERROR" | "PENDING";
  credentials: Record<string, string>;
  webhookUrl?: string;
  lastSyncAt?: string;
  syncFrequency: "MANUAL" | "HOURLY" | "DAILY" | "WEEKLY";
  createdAt: string;
  updatedAt: string;
}

export interface MockUser {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: "ADMIN" | "MANAGER" | "DRIVER" | "CUSTOMER" | "SUPPORT";
  status: "ACTIVE" | "INACTIVE" | "PENDING_VERIFICATION";
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a mock organization
 */
export function createMockOrganization(
  overrides: Partial<MockOrganization> = {},
): MockOrganization {
  return {
    id: overrides.id || randomId(),
    name: overrides.name || randomCompanyName(),
    email: overrides.email || randomEmail(),
    phone: overrides.phone || randomPhone(),
    website: overrides.website || `https://${randomString(10)}.com`,
    industry: overrides.industry || "Logistics",
    planType: overrides.planType || "PROFESSIONAL",
    isActive: overrides.isActive !== false,
    createdAt: overrides.createdAt || randomTimestamp(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  };
}

/**
 * Create a mock shop
 */
export function createMockShop(overrides: Partial<MockShop> = {}): MockShop {
  const org = createMockOrganization();
  return {
    id: overrides.id || randomId(),
    organizationId: overrides.organizationId || org.id,
    name: overrides.name || `Shop ${randomString(6)}`,
    status: overrides.status || "ACTIVE",
    address: overrides.address || randomAddress(),
    city: overrides.city || "New York",
    state: overrides.state || "NY",
    zipCode: overrides.zipCode || "10001",
    country: overrides.country || "US",
    phone: overrides.phone || randomPhone(),
    email: overrides.email || randomEmail(),
    managerId: overrides.managerId || randomId(),
    timezone: overrides.timezone || "America/New_York",
    createdAt: overrides.createdAt || randomTimestamp(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  };
}

/**
 * Create a mock order
 */
export function createMockOrder(overrides: Partial<MockOrder> = {}): MockOrder {
  const shop = createMockShop();
  return {
    id: overrides.id || `ORD-${randomString(8)}`,
    shopId: overrides.shopId || shop.id,
    customerId: overrides.customerId || randomId(),
    status: overrides.status || "PENDING",
    items: overrides.items || [
      {
        productId: randomId(),
        quantity: Math.floor(Math.random() * 5) + 1,
        price: Math.floor(Math.random() * 200) + 10,
      },
    ],
    totalAmount: overrides.totalAmount || Math.floor(Math.random() * 1000) + 50,
    deliveryAddress: overrides.deliveryAddress || randomAddress(),
    deliveryDeadline: overrides.deliveryDeadline || randomFutureTimestamp(),
    notes: overrides.notes,
    createdAt: overrides.createdAt || randomTimestamp(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  };
}

/**
 * Create a mock driver
 */
export function createMockDriver(
  overrides: Partial<MockDriver> = {},
): MockDriver {
  const org = createMockOrganization();
  return {
    id: overrides.id || randomId(),
    organizationId: overrides.organizationId || org.id,
    firstName: overrides.firstName || randomFirstName(),
    lastName: overrides.lastName || randomLastName(),
    email: overrides.email || randomEmail(),
    phone: overrides.phone || randomPhone(),
    licenseNumber: overrides.licenseNumber || randomString(10).toUpperCase(),
    licenseExpiry: overrides.licenseExpiry || randomFutureTimestamp(),
    status: overrides.status || "ACTIVE",
    vehicleId: overrides.vehicleId,
    rating: overrides.rating || Math.random() * 5,
    totalDeliveries:
      overrides.totalDeliveries || Math.floor(Math.random() * 500),
    createdAt: overrides.createdAt || randomTimestamp(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  };
}

/**
 * Create a mock delivery
 */
export function createMockDelivery(
  overrides: Partial<MockDelivery> = {},
): MockDelivery {
  const order = createMockOrder();
  const driver = createMockDriver();
  const shop = createMockShop();

  return {
    id: overrides.id || randomId(),
    orderId: overrides.orderId || order.id,
    driverId: overrides.driverId || driver.id,
    shopId: overrides.shopId || shop.id,
    status: overrides.status || "PENDING",
    pickupAddress: overrides.pickupAddress || randomAddress(),
    deliveryAddress: overrides.deliveryAddress || randomAddress(),
    estimatedArrival: overrides.estimatedArrival,
    actualArrival: overrides.actualArrival,
    failureReason: overrides.failureReason,
    distance: overrides.distance || Math.floor(Math.random() * 50) + 1,
    duration: overrides.duration,
    rating: overrides.rating,
    createdAt: overrides.createdAt || randomTimestamp(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  };
}

/**
 * Create a mock integration
 */
export function createMockIntegration(
  provider: string = "salesforce",
  overrides: Partial<MockIntegration> = {},
): MockIntegration {
  const org = createMockOrganization();
  return {
    id: overrides.id || randomId(),
    organizationId: overrides.organizationId || org.id,
    provider: overrides.provider || provider,
    status: overrides.status || "ACTIVE",
    credentials: overrides.credentials || {
      apiKey: randomString(32),
      apiSecret: randomString(32),
    },
    webhookUrl:
      overrides.webhookUrl || `https://webhook.example.com/${randomString(16)}`,
    lastSyncAt: overrides.lastSyncAt,
    syncFrequency: overrides.syncFrequency || "DAILY",
    createdAt: overrides.createdAt || randomTimestamp(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  };
}

/**
 * Create a mock user
 */
export function createMockUser(
  role: "ADMIN" | "MANAGER" | "DRIVER" | "CUSTOMER" | "SUPPORT" = "MANAGER",
  overrides: Partial<MockUser> = {},
): MockUser {
  const org = createMockOrganization();
  return {
    id: overrides.id || randomId(),
    organizationId: overrides.organizationId || org.id,
    firstName: overrides.firstName || randomFirstName(),
    lastName: overrides.lastName || randomLastName(),
    email: overrides.email || randomEmail(),
    phone: overrides.phone || randomPhone(),
    role: overrides.role || role,
    status: overrides.status || "ACTIVE",
    lastLoginAt: overrides.lastLoginAt,
    createdAt: overrides.createdAt || randomTimestamp(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  };
}

// ============================================================================
// BULK FACTORY FUNCTION
// ============================================================================

/**
 * Create multiple instances using a factory function
 */
export function createMany<T>(factory: () => T, count: number): T[] {
  const results: T[] = [];
  for (let i = 0; i < count; i++) {
    results.push(factory());
  }
  return results;
}

// ============================================================================
// SPECIALIZED FACTORY BUILDERS
// ============================================================================

/**
 * Create a complete order with related entities
 */
export function createOrderWithRelated(overrides: Partial<MockOrder> = {}) {
  const shop = createMockShop();
  const driver = createMockDriver({ organizationId: shop.organizationId });
  const order = createMockOrder({ shopId: shop.id, ...overrides });
  const delivery = createMockDelivery({
    orderId: order.id,
    shopId: shop.id,
    driverId: driver.id,
  });

  return {
    shop,
    driver,
    order,
    delivery,
  };
}

/**
 * Create a complete organization setup with shop and users
 */
export function createOrganizationSetup(
  overrides: {
    orgOverrides?: Partial<MockOrganization>;
    shopCount?: number;
    userCount?: number;
    driverCount?: number;
  } = {},
) {
  const organization = createMockOrganization(overrides.orgOverrides);
  const shops = createMany(
    () => createMockShop({ organizationId: organization.id }),
    overrides.shopCount || 3,
  );
  const users = createMany(
    () => createMockUser("MANAGER", { organizationId: organization.id }),
    overrides.userCount || 5,
  );
  const drivers = createMany(
    () => createMockDriver({ organizationId: organization.id }),
    overrides.driverCount || 10,
  );

  return {
    organization,
    shops,
    users,
    drivers,
  };
}

/**
 * Create mock data for a complete delivery workflow
 */
export function createDeliveryWorkflow(shopId?: string) {
  const shop = shopId ? ({ id: shopId } as MockShop) : createMockShop();
  const driver = createMockDriver({ organizationId: shop.organizationId });
  const orders = createMany(
    () => createMockOrder({ shopId: shop.id, status: "CONFIRMED" }),
    5,
  );
  const deliveries = orders.map((order) =>
    createMockDelivery({
      orderId: order.id,
      shopId: shop.id,
      driverId: driver.id,
      status: "ASSIGNED",
    }),
  );

  return {
    shop,
    driver,
    orders,
    deliveries,
  };
}
