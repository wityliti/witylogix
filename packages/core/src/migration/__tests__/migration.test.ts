/**
 * @witylogix/core/migration/__tests__/migration.test.ts
 * Comprehensive test suite for data migration module
 *
 * Tests:
 * - Data transformers: field mapping, backward compatibility
 * - shopifyOrderId ↔ externalOrderId migration
 * - Batch transformation
 * - Error handling for malformed data
 * - Rollback scenarios
 * - Status enum transformations
 * - Address normalization
 * - Complex entity transformations (orders, shipments, drivers, customers)
 *
 * ~850 lines total, 35-40 test cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  transformOrder,
  transformShipment,
  transformDriver,
  transformCustomer,
  transformProduct,
  transformZone,
  transformRoute,
  transformers,
} from '../transformers';
import { DataMapper, BuiltInTransformers, DefaultMappings } from '../mapper';
import type { CollectionMapping, FieldTransform } from '../types';

// ───────────────────────────────────────────────────────────────────────────
// TEST DATA
// ───────────────────────────────────────────────────────────────────────────

const mockMongoOrder = {
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  shopId: 'shop-123',
  shop_id: 'shop-123',
  customerId: 'cust-456',
  customer: {
    id: 'cust-456',
    email: 'customer@example.com',
    phone: '+1234567890',
  },
  shopify_order_id: 'gid://shopify/Order/123456789',
  externalOrderId: 'gid://shopify/Order/123456789',
  status: 'pending',
  fulfillment_status: 'unshipped',
  email: 'customer@example.com',
  phone: '+1234567890',
  total_price: '99.99',
  totalPrice: 99.99,
  currency: 'USD',
  shipping_address: {
    name: 'John Doe',
    street: '123 Main St',
    address1: '123 Main St',
    city: 'Springfield',
    province: 'IL',
    state: 'IL',
    zip: '62701',
    postal_code: '62701',
    country: 'US',
  },
  shippingAddress: {
    name: 'John Doe',
    street: '123 Main St',
    city: 'Springfield',
    province: 'IL',
    zip: '62701',
    country: 'US',
  },
  billing_address: {
    street: '123 Main St',
    city: 'Springfield',
    province: 'IL',
    zip: '62701',
    country: 'US',
  },
  billingAddress: {
    street: '123 Main St',
    city: 'Springfield',
    province: 'IL',
    zip: '62701',
    country: 'US',
  },
  line_items: [
    {
      _id: 'item-1',
      product_id: 'prod-1',
      productId: 'prod-1',
      variant_id: 'var-1',
      variantId: 'var-1',
      title: 'Widget',
      name: 'Widget',
      sku: 'WIDGET-001',
      quantity: 2,
      price: '49.99',
      total: '99.99',
      weight: '1.5',
    },
  ],
  lineItems: [
    {
      id: 'item-1',
      productId: 'prod-1',
      variantId: 'var-1',
      name: 'Widget',
      sku: 'WIDGET-001',
      quantity: 2,
      price: 49.99,
      total: 99.99,
      weight: 1.5,
    },
  ],
  tags: 'urgent,vip',
  note: 'Special delivery instructions',
  notes: 'Special delivery instructions',
  discount_codes: [
    { code: 'SAVE10', amount: '10.00', type: 'fixed' },
  ],
  discountCode: 'SAVE10',
  total_discounts: '10.00',
  discountAmount: 10.0,
  total_tax: '8.00',
  taxAmount: 8.0,
  shipping_lines: [
    { title: 'Standard Shipping', price: '5.00' },
  ],
  shippingMethod: 'Standard Shipping',
  shippingCost: 5.0,
  metadata: { source: 'mobile-app' },
  metafields: { source: 'mobile-app' },
  created_at: '2024-01-15T10:30:00Z',
  createdAt: new Date('2024-01-15T10:30:00Z'),
  updated_at: '2024-01-15T11:45:00Z',
  updatedAt: new Date('2024-01-15T11:45:00Z'),
};

const mockMongoShipment = {
  _id: 'ship-1',
  id: 'ship-1',
  order_id: '507f1f77bcf86cd799439011',
  orderId: '507f1f77bcf86cd799439011',
  shop_id: 'shop-123',
  shopId: 'shop-123',
  status: 'in_transit',
  carrier: 'FedEx',
  tracking_number: 'FDX123456789',
  trackingNumber: 'FDX123456789',
  estimated_delivery: '2024-01-18T15:00:00Z',
  actual_delivery: null,
  location_id: 'loc-1',
  locationId: 'loc-1',
  driver_id: 'driver-1',
  driverId: 'driver-1',
  weight: '2.5',
  dimensions: { length: '10', width: '8', height: '6' },
  special_handling: 'fragile,cold-chain',
  notes: 'Handle with care',
  metadata: { carrier_account: 'test-123' },
  created_at: '2024-01-15T10:30:00Z',
  createdAt: new Date('2024-01-15T10:30:00Z'),
  updated_at: '2024-01-15T11:45:00Z',
  updatedAt: new Date('2024-01-15T11:45:00Z'),
};

const mockMongoDriver = {
  _id: 'driver-1',
  id: 'driver-1',
  shop_id: 'shop-123',
  shopId: 'shop-123',
  name: 'John Smith',
  email: 'john.smith@delivery.com',
  phone: '+1-555-0100',
  license_plate: 'DRV-001',
  licensePlate: 'DRV-001',
  license_number: 'DL123456',
  licenseNumber: 'DL123456',
  license_expiry: '2025-12-31',
  status: 'active',
  vehicle_type: 'van',
  vehicleType: 'van',
  vehicle_capacity: '100',
  vehicleCapacity: 100,
  is_verified: true,
  isVerified: true,
  verified_at: '2023-06-01T00:00:00Z',
  rating: '4.8',
  total_deliveries: '342',
  totalDeliveries: 342,
  bank_account: { account_number: '****1234', bank_name: 'Bank ABC' },
  document: { type: 'id', url: 'https://...' },
  metadata: { zone_assignment: 'zone-north' },
  created_at: '2023-06-01T00:00:00Z',
  createdAt: new Date('2023-06-01T00:00:00Z'),
  updated_at: '2024-01-15T11:45:00Z',
  updatedAt: new Date('2024-01-15T11:45:00Z'),
};

const mockMongoCustomer = {
  _id: 'cust-1',
  id: 'cust-1',
  shop_id: 'shop-123',
  shopId: 'shop-123',
  shopify_customer_id: 'cust-shopify-123',
  externalCustomerId: 'cust-external-123',
  first_name: 'Jane',
  firstName: 'Jane',
  last_name: 'Doe',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  phone: '+1-555-0101',
  default_address: {
    street: '456 Oak Ave',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    country: 'US',
  },
  defaultAddress: {
    street: '456 Oak Ave',
    city: 'Springfield',
    province: 'IL',
    zip: '62701',
    country: 'US',
  },
  addresses: [
    {
      street: '456 Oak Ave',
      city: 'Springfield',
      province: 'IL',
      zip: '62701',
      country: 'US',
      isDefault: true,
    },
  ],
  total_orders: '15',
  totalOrders: 15,
  total_spent: '1500.00',
  totalSpent: 1500.0,
  tags: ['vip', 'frequent-buyer'],
  is_active: true,
  isActive: true,
  metadata: { source: 'web' },
  created_at: '2023-01-10T00:00:00Z',
  createdAt: new Date('2023-01-10T00:00:00Z'),
  updated_at: '2024-01-15T11:45:00Z',
  updatedAt: new Date('2024-01-15T11:45:00Z'),
};

const mockMongoProduct = {
  _id: 'prod-1',
  id: 'prod-1',
  shop_id: 'shop-123',
  shopId: 'shop-123',
  shopify_product_id: 'prod-shopify-123',
  externalProductId: 'prod-external-123',
  name: 'Premium Widget',
  sku: 'WIDGET-001',
  barcode: '1234567890123',
  description: 'A high-quality widget',
  category: 'Electronics',
  weight: '1.5',
  dimensions: { length: '10', width: '8', height: '6' },
  price: '99.99',
  cost: '45.00',
  image: 'https://example.com/widget.jpg',
  imageUrl: 'https://example.com/widget.jpg',
  tags: ['bestseller', 'featured'],
  is_active: true,
  isActive: true,
  metadata: { supplier: 'ABC Corp' },
  created_at: '2023-01-01T00:00:00Z',
  createdAt: new Date('2023-01-01T00:00:00Z'),
  updated_at: '2024-01-15T11:45:00Z',
  updatedAt: new Date('2024-01-15T11:45:00Z'),
};

const mockMongoZone = {
  _id: 'zone-1',
  id: 'zone-1',
  shop_id: 'shop-123',
  shopId: 'shop-123',
  name: 'Downtown Area',
  description: 'Central delivery zone',
  type: 'postal_code',
  postal_codes: ['60601', '60602', '60603'],
  postalCodes: ['60601', '60602', '60603'],
  polygon_coordinates: [
    [[-87.6298, 41.8827]],
    [[-87.6194, 41.8827]],
  ],
  polygonCoordinates: [
    [[-87.6298, 41.8827]],
    [[-87.6194, 41.8827]],
  ],
  base_rate: '5.00',
  baseRate: 5.0,
  per_km_rate: '0.50',
  perKmRate: 0.5,
  min_order: '20.00',
  minOrder: 20.0,
  free_above: '100.00',
  estimated_days: '1',
  estimatedDays: 1,
  priority: '10',
  is_active: true,
  isActive: true,
  metadata: { region: 'north' },
  created_at: '2023-01-01T00:00:00Z',
  createdAt: new Date('2023-01-01T00:00:00Z'),
  updated_at: '2024-01-15T11:45:00Z',
  updatedAt: new Date('2024-01-15T11:45:00Z'),
};

const mockMongoRoute = {
  _id: 'route-1',
  id: 'route-1',
  shop_id: 'shop-123',
  shopId: 'shop-123',
  driver_id: 'driver-1',
  driverId: 'driver-1',
  status: 'in_progress',
  shipment_ids: ['ship-1', 'ship-2', 'ship-3'],
  shipmentIds: ['ship-1', 'ship-2', 'ship-3'],
  start_time: '2024-01-15T08:00:00Z',
  start_location: {
    street: '100 Depot Way',
    city: 'Springfield',
    province: 'IL',
    zip: '62701',
  },
  startLocation: {
    street: '100 Depot Way',
    city: 'Springfield',
    province: 'IL',
    zip: '62701',
  },
  end_time: null,
  end_location: null,
  endLocation: null,
  total_distance: '45.5',
  total_time: '2700',
  waypoints: [
    {
      street: '123 Main St',
      city: 'Springfield',
      province: 'IL',
    },
    {
      street: '456 Oak Ave',
      city: 'Springfield',
      province: 'IL',
    },
  ],
  metadata: { fuel_type: 'diesel' },
  created_at: '2024-01-15T07:30:00Z',
  createdAt: new Date('2024-01-15T07:30:00Z'),
  updated_at: '2024-01-15T10:00:00Z',
  updatedAt: new Date('2024-01-15T10:00:00Z'),
};

// ───────────────────────────────────────────────────────────────────────────
// ORDER TRANSFORMATION TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Order Transformations', () => {
  it('should transform order with shopify_order_id to externalOrderId', () => {
    const result = transformOrder(mockMongoOrder);

    expect(result).toBeDefined();
    expect(result.externalOrderId).toBe('gid://shopify/Order/123456789');
    expect(result.id).toBe('507f1f77bcf86cd799439011');
    expect(result.shopId).toBe('shop-123');
  });

  it('should handle backward compatibility with externalOrderId field', () => {
    const orderWithExternal = {
      _id: 'id-1',
      shopId: 'shop-1',
      externalOrderId: 'ext-123',
      status: 'pending',
    };

    const result = transformOrder(orderWithExternal);
    expect(result.externalOrderId).toBe('ext-123');
  });

  it('should transform order status to uppercase enum', () => {
    const testCases = [
      { input: 'pending', expected: 'PENDING' },
      { input: 'confirmed', expected: 'CONFIRMED' },
      { input: 'processing', expected: 'PROCESSING' },
      { input: 'shipped', expected: 'SHIPPED' },
      { input: 'delivered', expected: 'DELIVERED' },
      { input: 'cancelled', expected: 'CANCELLED' },
      { input: 'refunded', expected: 'REFUNDED' },
      { input: 'on_hold', expected: 'ON_HOLD' },
      { input: 'unknown_status', expected: 'PENDING' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = transformOrder({ ...mockMongoOrder, status: input });
      expect(result.status).toBe(expected);
    });
  });

  it('should normalize pricing fields (parseFloat)', () => {
    const result = transformOrder(mockMongoOrder);

    expect(result.totalPrice).toBe(99.99);
    expect(typeof result.totalPrice).toBe('number');
    expect(result.discountAmount).toBe(10.0);
    expect(result.taxAmount).toBe(8.0);
    expect(result.shippingCost).toBe(5.0);
  });

  it('should transform nested addresses', () => {
    const result = transformOrder(mockMongoOrder);

    expect(result.shippingAddress).toBeDefined();
    expect(result.shippingAddress.street).toBe('123 Main St');
    expect(result.shippingAddress.city).toBe('Springfield');
    expect(result.shippingAddress.zip).toBe('62701');
    expect(result.shippingAddress.country).toBe('US');
  });

  it('should transform line items with nested arrays', () => {
    const result = transformOrder(mockMongoOrder);

    expect(Array.isArray(result.lineItems)).toBe(true);
    expect(result.lineItems.length).toBe(1);
    expect(result.lineItems[0].name).toBe('Widget');
    expect(result.lineItems[0].sku).toBe('WIDGET-001');
    expect(result.lineItems[0].quantity).toBe(2);
  });

  it('should parse string quantities as integers', () => {
    const order = { ...mockMongoOrder, line_items: [{ quantity: '5' }] };
    const result = transformOrder(order);

    expect(result.lineItems[0].quantity).toBe(5);
    expect(typeof result.lineItems[0].quantity).toBe('number');
  });

  it('should split comma-separated tags', () => {
    const result = transformOrder(mockMongoOrder);

    expect(Array.isArray(result.tags)).toBe(true);
    expect(result.tags).toContain('urgent');
    expect(result.tags).toContain('vip');
    expect(result.tags.length).toBe(2);
  });

  it('should handle missing customer data gracefully', () => {
    const orderWithoutCustomer = { ...mockMongoOrder, customer: null, email: null };
    const result = transformOrder(orderWithoutCustomer);

    expect(result.email).toBeNull();
    expect(result.customerId).toBe('cust-456');
  });

  it('should handle empty or null orders', () => {
    expect(transformOrder(null)).toBeNull();
    expect(transformOrder(undefined)).toBeNull();
  });

  it('should parse dates correctly', () => {
    const result = transformOrder(mockMongoOrder);

    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('should handle discount codes array extraction', () => {
    const result = transformOrder(mockMongoOrder);
    expect(result.discountCode).toBe('SAVE10');
  });

  it('should extract shipping method from shipping_lines', () => {
    const result = transformOrder(mockMongoOrder);
    expect(result.shippingMethod).toBe('Standard Shipping');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// SHIPMENT TRANSFORMATION TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Shipment Transformations', () => {
  it('should transform shipment with correct field mapping', () => {
    const result = transformShipment(mockMongoShipment);

    expect(result.id).toBe('ship-1');
    expect(result.orderId).toBe('507f1f77bcf86cd799439011');
    expect(result.shopId).toBe('shop-123');
    expect(result.carrier).toBe('FedEx');
    expect(result.trackingNumber).toBe('FDX123456789');
  });

  it('should transform shipment status enum', () => {
    const testCases = [
      { input: 'pending', expected: 'PENDING' },
      { input: 'picked', expected: 'PICKED' },
      { input: 'packed', expected: 'PACKED' },
      { input: 'dispatched', expected: 'DISPATCHED' },
      { input: 'in_transit', expected: 'IN_TRANSIT' },
      { input: 'out_for_delivery', expected: 'OUT_FOR_DELIVERY' },
      { input: 'delivered', expected: 'DELIVERED' },
      { input: 'failed', expected: 'FAILED' },
      { input: 'returned', expected: 'RETURNED' },
      { input: 'cancelled', expected: 'CANCELLED' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = transformShipment({ ...mockMongoShipment, status: input });
      expect(result.status).toBe(expected);
    });
  });

  it('should parse weight as float', () => {
    const result = transformShipment(mockMongoShipment);

    expect(result.weight).toBe(2.5);
    expect(typeof result.weight).toBe('number');
  });

  it('should split special handling tags', () => {
    const result = transformShipment(mockMongoShipment);

    expect(Array.isArray(result.specialHandling)).toBe(true);
    expect(result.specialHandling).toContain('fragile');
    expect(result.specialHandling).toContain('cold-chain');
  });

  it('should preserve estimated and actual delivery dates', () => {
    const result = transformShipment(mockMongoShipment);

    expect(result.estimatedDelivery).toBeInstanceOf(Date);
    expect(result.actualDelivery).toBeNull();
  });

  it('should handle null shipment gracefully', () => {
    expect(transformShipment(null)).toBeNull();
    expect(transformShipment(undefined)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// DRIVER TRANSFORMATION TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Driver Transformations', () => {
  it('should transform driver with correct field mapping', () => {
    const result = transformDriver(mockMongoDriver);

    expect(result.id).toBe('driver-1');
    expect(result.name).toBe('John Smith');
    expect(result.email).toBe('john.smith@delivery.com');
    expect(result.phone).toBe('+1-555-0100');
    expect(result.shopId).toBe('shop-123');
  });

  it('should transform driver status enum', () => {
    const testCases = [
      { input: 'active', expected: 'ACTIVE' },
      { input: 'inactive', expected: 'INACTIVE' },
      { input: 'suspended', expected: 'SUSPENDED' },
      { input: 'onleave', expected: 'ON_LEAVE' },
      { input: 'offline', expected: 'OFFLINE' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = transformDriver({ ...mockMongoDriver, status: input });
      expect(result.status).toBe(expected);
    });
  });

  it('should parse numeric fields correctly', () => {
    const result = transformDriver(mockMongoDriver);

    expect(result.vehicleCapacity).toBe(100);
    expect(result.rating).toBe(4.8);
    expect(result.totalDeliveries).toBe(342);
  });

  it('should preserve license information', () => {
    const result = transformDriver(mockMongoDriver);

    expect(result.licensePlate).toBe('DRV-001');
    expect(result.licenseNumber).toBe('DL123456');
    expect(result.licenseExpiry).toBeInstanceOf(Date);
  });

  it('should handle verification status and timestamp', () => {
    const result = transformDriver(mockMongoDriver);

    expect(result.isVerified).toBe(true);
    expect(result.verifiedAt).toBeInstanceOf(Date);
  });

  it('should handle null driver gracefully', () => {
    expect(transformDriver(null)).toBeNull();
    expect(transformDriver(undefined)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CUSTOMER TRANSFORMATION TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Customer Transformations', () => {
  it('should transform customer with correct field mapping', () => {
    const result = transformCustomer(mockMongoCustomer);

    expect(result.id).toBe('cust-1');
    expect(result.firstName).toBe('Jane');
    expect(result.lastName).toBe('Doe');
    expect(result.email).toBe('jane.doe@example.com');
    expect(result.phone).toBe('+1-555-0101');
  });

  it('should map external customer IDs', () => {
    const result = transformCustomer(mockMongoCustomer);

    expect(result.externalCustomerId).toBe('cust-external-123');
  });

  it('should parse numeric fields', () => {
    const result = transformCustomer(mockMongoCustomer);

    expect(result.totalOrders).toBe(15);
    expect(result.totalSpent).toBe(1500.0);
  });

  it('should handle addresses array', () => {
    const result = transformCustomer(mockMongoCustomer);

    expect(Array.isArray(result.addresses)).toBe(true);
    expect(result.addresses.length).toBeGreaterThan(0);
    expect(result.addresses[0].street).toBe('456 Oak Ave');
  });

  it('should extract tags array', () => {
    const result = transformCustomer(mockMongoCustomer);

    expect(Array.isArray(result.tags)).toBe(true);
    expect(result.tags).toContain('vip');
    expect(result.tags).toContain('frequent-buyer');
  });

  it('should preserve active status', () => {
    const result = transformCustomer(mockMongoCustomer);
    expect(result.isActive).toBe(true);
  });

  it('should handle null customer gracefully', () => {
    expect(transformCustomer(null)).toBeNull();
    expect(transformCustomer(undefined)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PRODUCT TRANSFORMATION TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Product Transformations', () => {
  it('should transform product with correct field mapping', () => {
    const result = transformProduct(mockMongoProduct);

    expect(result.id).toBe('prod-1');
    expect(result.name).toBe('Premium Widget');
    expect(result.sku).toBe('WIDGET-001');
    expect(result.shopId).toBe('shop-123');
  });

  it('should map external product IDs', () => {
    const result = transformProduct(mockMongoProduct);
    expect(result.externalProductId).toBe('prod-external-123');
  });

  it('should parse pricing fields', () => {
    const result = transformProduct(mockMongoProduct);

    expect(result.price).toBe(99.99);
    expect(result.cost).toBe(45.0);
  });

  it('should preserve barcode and category', () => {
    const result = transformProduct(mockMongoProduct);

    expect(result.barcode).toBe('1234567890123');
    expect(result.category).toBe('Electronics');
  });

  it('should handle tags array', () => {
    const result = transformProduct(mockMongoProduct);

    expect(Array.isArray(result.tags)).toBe(true);
    expect(result.tags).toContain('bestseller');
  });

  it('should preserve active status', () => {
    const result = transformProduct(mockMongoProduct);
    expect(result.isActive).toBe(true);
  });

  it('should handle null product gracefully', () => {
    expect(transformProduct(null)).toBeNull();
    expect(transformProduct(undefined)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ZONE TRANSFORMATION TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Zone Transformations', () => {
  it('should transform zone with correct field mapping', () => {
    const result = transformZone(mockMongoZone);

    expect(result.id).toBe('zone-1');
    expect(result.name).toBe('Downtown Area');
    expect(result.type).toBe('postal_code');
    expect(result.shopId).toBe('shop-123');
  });

  it('should parse postal codes array', () => {
    const result = transformZone(mockMongoZone);

    expect(Array.isArray(result.postalCodes)).toBe(true);
    expect(result.postalCodes).toContain('60601');
    expect(result.postalCodes).toContain('60602');
  });

  it('should parse rate fields as floats', () => {
    const result = transformZone(mockMongoZone);

    expect(result.baseRate).toBe(5.0);
    expect(result.perKmRate).toBe(0.5);
    expect(result.minOrder).toBe(20.0);
    expect(result.freeAbove).toBe(100.0);
  });

  it('should parse estimated days as integer', () => {
    const result = transformZone(mockMongoZone);
    expect(result.estimatedDays).toBe(1);
    expect(typeof result.estimatedDays).toBe('number');
  });

  it('should preserve polygon coordinates', () => {
    const result = transformZone(mockMongoZone);

    expect(Array.isArray(result.polygonCoordinates)).toBe(true);
    expect(result.polygonCoordinates.length).toBeGreaterThan(0);
  });

  it('should handle null zone gracefully', () => {
    expect(transformZone(null)).toBeNull();
    expect(transformZone(undefined)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ROUTE TRANSFORMATION TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Route Transformations', () => {
  it('should transform route with correct field mapping', () => {
    const result = transformRoute(mockMongoRoute);

    expect(result.id).toBe('route-1');
    expect(result.driverId).toBe('driver-1');
    expect(result.shopId).toBe('shop-123');
  });

  it('should transform route status enum', () => {
    const testCases = [
      { input: 'pending', expected: 'PENDING' },
      { input: 'assigned', expected: 'ASSIGNED' },
      { input: 'in_progress', expected: 'IN_PROGRESS' },
      { input: 'completed', expected: 'COMPLETED' },
      { input: 'cancelled', expected: 'CANCELLED' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = transformRoute({ ...mockMongoRoute, status: input });
      expect(result.status).toBe(expected);
    });
  });

  it('should parse shipment IDs from mixed types', () => {
    const result = transformRoute(mockMongoRoute);

    expect(Array.isArray(result.shipmentIds)).toBe(true);
    expect(result.shipmentIds).toContain('ship-1');
    expect(result.shipmentIds).toContain('ship-2');
  });

  it('should parse route timing as numbers', () => {
    const result = transformRoute(mockMongoRoute);

    expect(result.totalDistance).toBe(45.5);
    expect(result.totalTime).toBe(2700);
  });

  it('should handle waypoints array', () => {
    const result = transformRoute(mockMongoRoute);

    expect(Array.isArray(result.waypoints)).toBe(true);
    expect(result.waypoints.length).toBe(2);
    expect(result.waypoints[0].street).toBe('123 Main St');
  });

  it('should handle null route gracefully', () => {
    expect(transformRoute(null)).toBeNull();
    expect(transformRoute(undefined)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// BATCH TRANSFORMATION TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Batch Transformations', () => {
  it('should transform batch of orders', () => {
    const orders = [mockMongoOrder, { ...mockMongoOrder, _id: 'id-2' }];
    const results = orders.map(transformOrder);

    expect(results.length).toBe(2);
    expect(results[0].id).toBe('507f1f77bcf86cd799439011');
    expect(results[1].id).toBe('id-2');
  });

  it('should handle mixed valid and null orders in batch', () => {
    const orders = [mockMongoOrder, null, { ...mockMongoOrder, _id: 'id-3' }];
    const results = orders.map(transformOrder);

    expect(results[0]).toBeDefined();
    expect(results[1]).toBeNull();
    expect(results[2]).toBeDefined();
  });

  it('should transform batch of customers with consistent structure', () => {
    const customers = [mockMongoCustomer, { ...mockMongoCustomer, _id: 'cust-2' }];
    const results = customers.map(transformCustomer);

    expect(results.length).toBe(2);
    results.forEach(result => {
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('firstName');
      expect(result).toHaveProperty('lastName');
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ERROR HANDLING & MALFORMED DATA TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Error Handling & Malformed Data', () => {
  it('should handle order with missing required fields', () => {
    const minimalOrder = { status: 'pending' };
    const result = transformOrder(minimalOrder);

    expect(result).toBeDefined();
    expect(result.status).toBe('PENDING');
    expect(result.totalPrice).toBe(0);
  });

  it('should handle product with invalid price values', () => {
    const productWithBadPrice = { ...mockMongoProduct, price: 'not-a-number' };
    const result = transformProduct(productWithBadPrice);

    expect(result.price).toBe(0);
  });

  it('should handle driver with missing numeric fields', () => {
    const driverWithoutMetrics = { ...mockMongoDriver, rating: null, totalDeliveries: undefined };
    const result = transformDriver(driverWithoutMetrics);

    expect(result.rating).toBe(0);
    expect(result.totalDeliveries).toBe(0);
  });

  it('should handle malformed date strings', () => {
    const orderWithBadDate = { ...mockMongoOrder, created_at: 'invalid-date' };
    const result = transformOrder(orderWithBadDate);

    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('should handle non-array tags gracefully', () => {
    const customerWithStringTags = { ...mockMongoCustomer, tags: 'vip' };
    const result = transformCustomer(customerWithStringTags);

    expect(Array.isArray(result.tags)).toBe(true);
  });

  it('should handle empty arrays without errors', () => {
    const orderWithEmptyItems = { ...mockMongoOrder, line_items: [] };
    const result = transformOrder(orderWithEmptyItems);

    expect(Array.isArray(result.lineItems)).toBe(true);
    expect(result.lineItems.length).toBe(0);
  });

  it('should handle undefined addresses', () => {
    const orderWithoutAddress = { ...mockMongoOrder, shipping_address: undefined };
    const result = transformOrder(orderWithoutAddress);

    expect(result.shippingAddress).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// DATA MAPPER TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('DataMapper', () => {
  let mapper: DataMapper;

  beforeEach(() => {
    mapper = new DataMapper();
  });

  it('should get default mapping for orders', () => {
    const mapping = mapper.getDefaultMapping('orders');

    expect(mapping).toBeDefined();
    expect(mapping?.mongoCollection).toBe('orders');
    expect(mapping?.prismaModel).toBe('Order');
    expect(Array.isArray(mapping?.fieldMap)).toBe(true);
  });

  it('should map document using field transforms', () => {
    const mapping = DefaultMappings.orders;
    const mapped = mapper.mapDocument(mockMongoOrder, mapping);

    expect(mapped).toBeDefined();
    expect(mapped.shopId).toBe('shop-123');
  });

  it('should apply built-in transformers', () => {
    const idTransformed = BuiltInTransformers.objectIdToString('507f1f77bcf86cd799439011');
    expect(typeof idTransformed).toBe('string');
  });

  it('should convert nested objects to JSON', () => {
    const nested = { key: 'value', level2: { nested: true } };
    const result = BuiltInTransformers.nestedToJson(nested);

    expect(typeof result).toBe('string');
    expect(JSON.parse(result)).toEqual(nested);
  });

  it('should handle enum mapping', () => {
    const mapping: Record<string, string> = { pending: 'PENDING', confirmed: 'CONFIRMED' };
    const mapper = BuiltInTransformers.enumMapper(mapping);

    expect(mapper('pending')).toBe('PENDING');
    expect(mapper('unknown')).toBe('unknown');
  });

  it('should preserve default values for missing fields', () => {
    const customMapping: CollectionMapping = {
      mongoCollection: 'test',
      prismaModel: 'Test',
      fieldMap: [
        { sourceField: 'name', targetField: 'name' },
      ],
      defaultValues: {
        status: 'ACTIVE',
        createdAt: new Date(),
      },
    };

    const doc = { name: 'Test' };
    const result = mapper.mapDocument(doc, customMapping);

    expect(result.status).toBe('ACTIVE');
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('should handle optional fields correctly', () => {
    const customMapping: CollectionMapping = {
      mongoCollection: 'test',
      prismaModel: 'Test',
      fieldMap: [
        { sourceField: 'id', targetField: 'id' },
        { sourceField: 'optional_field', targetField: 'optional', optional: true },
      ],
    };

    const doc = { id: '1' };
    const result = mapper.mapDocument(doc, customMapping);

    expect(result.id).toBe('1');
    expect(result.optional).toBeUndefined();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ROLLBACK & RECOVERY TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Rollback & Recovery Scenarios', () => {
  it('should maintain original field structure for rollback', () => {
    const original = { ...mockMongoOrder };
    const transformed = transformOrder(original);

    // Verify no mutation of original
    expect(original.status).not.toBe(transformed.status);
    expect(original._id).toBe(mockMongoOrder._id);
  });

  it('should track transformation errors for rollback reporting', () => {
    const orderWithError = { ...mockMongoOrder, total_price: NaN };
    const result = transformOrder(orderWithError);

    expect(result.totalPrice).toBe(0);
  });

  it('should handle partial transformations without data loss', () => {
    const incompleteOrder = { _id: 'id-1', status: 'pending' };
    const result = transformOrder(incompleteOrder);

    expect(result.id).toBe('id-1');
    expect(result.status).toBe('PENDING');
    // Other fields have sensible defaults
    expect(result.totalPrice).toBe(0);
    expect(result.currency).toBe('USD');
  });

  it('should support forward compatibility with new fields', () => {
    const orderWithExtra = {
      ...mockMongoOrder,
      newField: 'should be preserved in metadata',
    };

    const result = transformOrder(orderWithExtra);
    // New fields in metadata
    expect(result.metadata).toBeDefined();
  });

  it('should handle version mismatch gracefully', () => {
    const oldOrder = {
      _id: 'id-1',
      status: 'pending',
      // Missing modern fields
    };

    const result = transformOrder(oldOrder);
    expect(result).toBeDefined();
    expect(result.status).toBe('PENDING');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// FIELD MAPPING TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Field Mapping & Compatibility', () => {
  it('should handle both snake_case and camelCase field names', () => {
    const snakeCaseOrder = {
      _id: 'id-1',
      shop_id: 'shop-1',
      status: 'pending',
      total_price: '100.00',
    };

    const camelCaseOrder = {
      _id: 'id-1',
      shopId: 'shop-1',
      status: 'pending',
      totalPrice: 100.0,
    };

    const result1 = transformOrder(snakeCaseOrder);
    const result2 = transformOrder(camelCaseOrder);

    expect(result1.shopId).toBe(result2.shopId);
    expect(result1.totalPrice).toBe(result2.totalPrice);
  });

  it('should prefer snake_case when both formats exist', () => {
    const orderWithBoth = {
      _id: 'id-1',
      shop_id: 'snake-shop',
      shopId: 'camel-shop',
      status: 'pending',
    };

    const result = transformOrder(orderWithBoth);
    expect(result.shopId).toBe('snake-shop');
  });

  it('should handle nested field access with dot notation', () => {
    const mapper = new DataMapper();
    const customMapping: CollectionMapping = {
      mongoCollection: 'test',
      prismaModel: 'Test',
      fieldMap: [
        { sourceField: 'customer.email', targetField: 'email' },
        { sourceField: 'shipping.address.city', targetField: 'city' },
      ],
    };

    const doc = {
      customer: { email: 'test@example.com' },
      shipping: { address: { city: 'Springfield' } },
    };

    const result = mapper.mapDocument(doc, customMapping);
    expect(result.email).toBe('test@example.com');
    expect(result.city).toBe('Springfield');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Integration Tests', () => {
  it('should export all transformers', () => {
    expect(transformers).toBeDefined();
    expect(typeof transformers.transformOrder).toBe('function');
    expect(typeof transformers.transformShipment).toBe('function');
    expect(typeof transformers.transformDriver).toBe('function');
    expect(typeof transformers.transformCustomer).toBe('function');
    expect(typeof transformers.transformProduct).toBe('function');
    expect(typeof transformers.transformZone).toBe('function');
    expect(typeof transformers.transformRoute).toBe('function');
  });

  it('should provide default mappings for all major collections', () => {
    const collections = ['orders', 'shipments', 'customers', 'products', 'drivers', 'zones'];

    collections.forEach(collection => {
      const mapping = DefaultMappings[collection];
      expect(mapping).toBeDefined();
      expect(mapping.fieldMap).toBeDefined();
      expect(Array.isArray(mapping.fieldMap)).toBe(true);
    });
  });

  it('should support custom transformation chains', () => {
    const mapper = new DataMapper();
    const customMapping: CollectionMapping = {
      mongoCollection: 'orders',
      prismaModel: 'Order',
      fieldMap: [
        { sourceField: '_id', targetField: 'id', transformer: BuiltInTransformers.objectIdToString },
      ],
      preProcess: (doc) => ({ ...doc, processed: true }),
      postProcess: (record) => ({ ...record, finalized: true }),
    };

    const doc = { _id: 'id-1' };
    const result = mapper.mapDocument(doc, customMapping);

    expect(result.finalized).toBe(true);
  });
});
