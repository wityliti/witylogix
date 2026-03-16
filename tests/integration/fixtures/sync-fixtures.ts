/**
 * Sync Fixtures - Factory Functions for Order Sync & E-Commerce Integrations
 *
 * Provides factory functions for creating test data:
 * - SyncJob configurations
 * - Platform-specific orders (Shopify, BigCommerce, Magento, Etsy, eBay, Square)
 * - Sync conflicts and resolutions
 * - Field mappings and configurations
 *
 * ~100 lines per section, comprehensive coverage
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface SyncJob {
  id: string;
  platformId: string;
  jobType: 'order_sync' | 'inventory_sync' | 'product_sync' | 'customer_sync';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  recordsProcessed: number;
  recordsFailed: number;
  errors?: string[];
}

export interface PlatformOrder {
  id: string;
  externalOrderId: string;
  platformId: string;
  platformName: 'shopify' | 'bigcommerce' | 'magento' | 'etsy' | 'ebay' | 'square';
  orderId?: string;
  status: string;
  total: number;
  currency: string;
  items: OrderItem[];
  customer: OrderCustomer;
  shippingAddress: Address;
  billingAddress: Address;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  tax?: number;
}

export interface OrderCustomer {
  id?: string;
  externalId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isGuest?: boolean;
}

export interface Address {
  street1: string;
  street2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface SyncConflict {
  id: string;
  platformId: string;
  recordType: 'order' | 'inventory' | 'customer' | 'product';
  externalId: string;
  internalId?: string;
  conflictType: 'field_conflict' | 'status_conflict' | 'data_mismatch';
  field?: string;
  externalValue?: any;
  internalValue?: any;
  resolutionStrategy: 'LAST_WRITE_WINS' | 'EXTERNAL_WINS' | 'INTERNAL_WINS' | 'MANUAL_REVIEW';
  status: 'unresolved' | 'resolved' | 'ignored';
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
}

export interface FieldMapping {
  id: string;
  platformId: string;
  recordType: 'order' | 'inventory' | 'customer' | 'product';
  externalField: string;
  internalField: string;
  transformation?: (value: any) => any;
  isRequired: boolean;
}

export interface SyncConfig {
  id: string;
  platformId: string;
  platformName: string;
  apiKey: string;
  apiSecret?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  syncEnabled: boolean;
  syncInterval?: number;
  lastSyncAt?: Date;
  fieldMappings: FieldMapping[];
  conflictResolutionStrategy: 'LAST_WRITE_WINS' | 'EXTERNAL_WINS' | 'INTERNAL_WINS' | 'MANUAL_REVIEW';
}

// ============================================================================
// FACTORY FUNCTIONS - SYNC JOB
// ============================================================================

export function createSyncJob(overrides?: Partial<SyncJob>): SyncJob {
  const baseDate = new Date('2024-03-15T10:00:00Z');
  return {
    id: `sync_${Math.random().toString(36).substr(2, 9)}`,
    platformId: 'platform_001',
    jobType: 'order_sync',
    status: 'completed',
    startedAt: baseDate,
    completedAt: new Date(baseDate.getTime() + 60000),
    recordsProcessed: 150,
    recordsFailed: 0,
    ...overrides,
  };
}

export function createPendingSyncJob(): SyncJob {
  return createSyncJob({ status: 'pending', completedAt: undefined, recordsProcessed: 0 });
}

export function createFailedSyncJob(errors: string[] = []): SyncJob {
  return createSyncJob({
    status: 'failed',
    recordsFailed: 10,
    errors: errors.length > 0 ? errors : ['Network timeout', 'Invalid API key'],
  });
}

// ============================================================================
// FACTORY FUNCTIONS - PLATFORM ORDERS
// ============================================================================

export function createShopifyOrder(overrides?: Partial<PlatformOrder>): PlatformOrder {
  return {
    id: `shopify_order_${Math.random().toString(36).substr(2, 9)}`,
    externalOrderId: `#100${Math.floor(Math.random() * 1000)}`,
    platformId: 'shopify_store_001',
    platformName: 'shopify',
    status: 'pending',
    total: 299.99,
    currency: 'USD',
    items: [
      {
        id: 'item_1',
        sku: 'SKU-001',
        name: 'Wireless Headphones',
        quantity: 1,
        price: 149.99,
        tax: 12.00,
      },
      {
        id: 'item_2',
        sku: 'SKU-002',
        name: 'Phone Case',
        quantity: 2,
        price: 19.99,
        tax: 3.20,
      },
    ],
    customer: {
      id: 'cust_shopify_001',
      externalId: 'ext_cust_001',
      email: 'customer@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      isGuest: false,
    },
    shippingAddress: {
      street1: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
    },
    billingAddress: {
      street1: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
    },
    metadata: {
      source: 'online_store',
      channelId: 'gid://shopify/Channel/1',
      fulfillmentStatus: 'unfullfilled',
    },
    createdAt: new Date('2024-03-15T10:00:00Z'),
    updatedAt: new Date('2024-03-15T10:00:00Z'),
    ...overrides,
  };
}

export function createBigCommerceOrder(overrides?: Partial<PlatformOrder>): PlatformOrder {
  return {
    id: `bigcommerce_order_${Math.random().toString(36).substr(2, 9)}`,
    externalOrderId: `BC-${Math.floor(Math.random() * 100000)}`,
    platformId: 'bigcommerce_store_001',
    platformName: 'bigcommerce',
    status: 'awaiting_fulfillment',
    total: 450.50,
    currency: 'USD',
    items: [
      {
        id: 'item_1',
        sku: 'BC-SKU-001',
        name: 'Premium Backpack',
        quantity: 1,
        price: 199.99,
        tax: 16.00,
      },
      {
        id: 'item_2',
        sku: 'BC-SKU-002',
        name: 'Water Bottle',
        quantity: 3,
        price: 29.99,
        tax: 7.20,
      },
    ],
    customer: {
      id: 'cust_bc_001',
      externalId: 'ext_cust_bc_001',
      email: 'customer.bc@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+1987654321',
    },
    shippingAddress: {
      street1: '456 Oak Ave',
      street2: 'Suite 200',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90001',
      country: 'US',
    },
    billingAddress: {
      street1: '456 Oak Ave',
      street2: 'Suite 200',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90001',
      country: 'US',
    },
    metadata: {
      shipments: 0,
      shippingMethod: 'Standard',
      paymentStatus: 'captured',
    },
    createdAt: new Date('2024-03-15T11:00:00Z'),
    updatedAt: new Date('2024-03-15T11:00:00Z'),
    ...overrides,
  };
}

export function createMagentoOrder(overrides?: Partial<PlatformOrder>): PlatformOrder {
  return {
    id: `magento_order_${Math.random().toString(36).substr(2, 9)}`,
    externalOrderId: `MGT-${Math.floor(Math.random() * 1000000)}`,
    platformId: 'magento_store_001',
    platformName: 'magento',
    status: 'processing',
    total: 575.00,
    currency: 'USD',
    items: [
      {
        id: 'item_1',
        sku: 'MGT-SKU-001',
        name: 'Laptop Stand',
        quantity: 2,
        price: 89.99,
        tax: 14.40,
      },
      {
        id: 'item_2',
        sku: 'MGT-SKU-002',
        name: 'USB Cable Pack',
        quantity: 5,
        price: 12.99,
        tax: 5.20,
      },
    ],
    customer: {
      id: 'cust_mgt_001',
      externalId: 'ext_cust_mgt_001',
      email: 'customer.mag@example.com',
      firstName: 'Robert',
      lastName: 'Johnson',
      phone: '+1555666777',
    },
    shippingAddress: {
      street1: '789 Pine Rd',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: 'US',
    },
    billingAddress: {
      street1: '789 Pine Rd',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: 'US',
    },
    metadata: {
      storeId: 1,
      storeCode: 'default',
      state: 'new',
      increment_id: '000001234',
    },
    createdAt: new Date('2024-03-15T12:00:00Z'),
    updatedAt: new Date('2024-03-15T12:00:00Z'),
    ...overrides,
  };
}

export function createEtsyOrder(overrides?: Partial<PlatformOrder>): PlatformOrder {
  return {
    id: `etsy_order_${Math.random().toString(36).substr(2, 9)}`,
    externalOrderId: `ETSY-${Math.floor(Math.random() * 1000000)}`,
    platformId: 'etsy_shop_001',
    platformName: 'etsy',
    status: 'payment_received',
    total: 125.50,
    currency: 'USD',
    items: [
      {
        id: 'item_1',
        sku: 'ETSY-SKU-001',
        name: 'Handmade Ceramic Mug',
        quantity: 1,
        price: 65.00,
        tax: 5.20,
      },
    ],
    customer: {
      id: 'cust_etsy_001',
      externalId: 'ext_cust_etsy_001',
      email: 'customer.etsy@example.com',
      firstName: 'Emma',
      lastName: 'Williams',
      isGuest: true,
    },
    shippingAddress: {
      street1: '321 Elm St',
      city: 'Portland',
      state: 'OR',
      postalCode: '97201',
      country: 'US',
    },
    billingAddress: {
      street1: '321 Elm St',
      city: 'Portland',
      state: 'OR',
      postalCode: '97201',
      country: 'US',
    },
    metadata: {
      seller_user_id: 'seller_001',
      listing_id: 'list_001',
      was_payment_processed: true,
    },
    createdAt: new Date('2024-03-15T13:00:00Z'),
    updatedAt: new Date('2024-03-15T13:00:00Z'),
    ...overrides,
  };
}

export function createEBayOrder(overrides?: Partial<PlatformOrder>): PlatformOrder {
  return {
    id: `ebay_order_${Math.random().toString(36).substr(2, 9)}`,
    externalOrderId: `EBAY-${Math.floor(Math.random() * 1000000000)}`,
    platformId: 'ebay_account_001',
    platformName: 'ebay',
    status: 'shipped',
    total: 199.99,
    currency: 'USD',
    items: [
      {
        id: 'item_1',
        sku: 'EBAY-SKU-001',
        name: 'Vintage Camera',
        quantity: 1,
        price: 149.99,
        tax: 12.00,
      },
    ],
    customer: {
      id: 'cust_ebay_001',
      externalId: 'buyer_user_001',
      email: 'customer.ebay@example.com',
      firstName: 'Michael',
      lastName: 'Brown',
      isGuest: true,
    },
    shippingAddress: {
      street1: '555 Market St',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94103',
      country: 'US',
    },
    billingAddress: {
      street1: '555 Market St',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94103',
      country: 'US',
    },
    metadata: {
      buyer_user_id: 'buyer_001',
      item_id: 'item_id_001',
      transaction_id: 'txn_001',
      shipment_tracking_number: 'TRACK123456789',
    },
    createdAt: new Date('2024-03-15T14:00:00Z'),
    updatedAt: new Date('2024-03-15T14:30:00Z'),
    ...overrides,
  };
}

export function createSquareOrder(overrides?: Partial<PlatformOrder>): PlatformOrder {
  return {
    id: `square_order_${Math.random().toString(36).substr(2, 9)}`,
    externalOrderId: `SQ-${Math.floor(Math.random() * 1000000)}`,
    platformId: 'square_location_001',
    platformName: 'square',
    status: 'OPEN',
    total: 89.99,
    currency: 'USD',
    items: [
      {
        id: 'item_1',
        sku: 'SQ-SKU-001',
        name: 'Wireless Speaker',
        quantity: 1,
        price: 79.99,
        tax: 6.40,
      },
    ],
    customer: {
      id: 'cust_sq_001',
      externalId: 'ext_cust_sq_001',
      email: 'customer.square@example.com',
      firstName: 'Sarah',
      lastName: 'Davis',
      phone: '+1234567890',
    },
    shippingAddress: {
      street1: '999 Beach Blvd',
      city: 'Miami',
      state: 'FL',
      postalCode: '33139',
      country: 'US',
    },
    billingAddress: {
      street1: '999 Beach Blvd',
      city: 'Miami',
      state: 'FL',
      postalCode: '33139',
      country: 'US',
    },
    metadata: {
      location_id: 'loc_001',
      created_at: '2024-03-15T15:00:00Z',
      updated_at: '2024-03-15T15:00:00Z',
      reference_id: 'ref_001',
    },
    createdAt: new Date('2024-03-15T15:00:00Z'),
    updatedAt: new Date('2024-03-15T15:00:00Z'),
    ...overrides,
  };
}

// ============================================================================
// FACTORY FUNCTIONS - SYNC CONFLICTS
// ============================================================================

export function createSyncConflict(overrides?: Partial<SyncConflict>): SyncConflict {
  return {
    id: `conflict_${Math.random().toString(36).substr(2, 9)}`,
    platformId: 'platform_001',
    recordType: 'order',
    externalId: 'ext_123',
    internalId: 'int_456',
    conflictType: 'field_conflict',
    field: 'status',
    externalValue: 'shipped',
    internalValue: 'processing',
    resolutionStrategy: 'MANUAL_REVIEW',
    status: 'unresolved',
    createdAt: new Date('2024-03-15T10:00:00Z'),
    ...overrides,
  };
}

export function createFieldConflict(field: string, externalValue: any, internalValue: any): SyncConflict {
  return createSyncConflict({
    conflictType: 'field_conflict',
    field,
    externalValue,
    internalValue,
  });
}

export function createStatusConflict(externalStatus: string, internalStatus: string): SyncConflict {
  return createSyncConflict({
    conflictType: 'status_conflict',
    field: 'status',
    externalValue: externalStatus,
    internalValue: internalStatus,
  });
}

export function createDataMismatchConflict(field: string): SyncConflict {
  return createSyncConflict({
    conflictType: 'data_mismatch',
    field,
  });
}

// ============================================================================
// FACTORY FUNCTIONS - FIELD MAPPINGS
// ============================================================================

export function createFieldMapping(overrides?: Partial<FieldMapping>): FieldMapping {
  return {
    id: `mapping_${Math.random().toString(36).substr(2, 9)}`,
    platformId: 'platform_001',
    recordType: 'order',
    externalField: 'order_status',
    internalField: 'status',
    isRequired: true,
    ...overrides,
  };
}

export function createShopifyFieldMappings(): FieldMapping[] {
  return [
    createFieldMapping({ externalField: 'id', internalField: 'externalOrderId', isRequired: true }),
    createFieldMapping({ externalField: 'financial_status', internalField: 'paymentStatus', isRequired: true }),
    createFieldMapping({ externalField: 'fulfillment_status', internalField: 'fulfillmentStatus', isRequired: false }),
    createFieldMapping({ externalField: 'total_price', internalField: 'total', isRequired: true }),
    createFieldMapping({ externalField: 'currency', internalField: 'currency', isRequired: true }),
  ];
}

export function createBigCommerceFieldMappings(): FieldMapping[] {
  return [
    createFieldMapping({ platformId: 'platform_bc', externalField: 'id', internalField: 'externalOrderId' }),
    createFieldMapping({ platformId: 'platform_bc', externalField: 'status', internalField: 'status' }),
    createFieldMapping({ platformId: 'platform_bc', externalField: 'total_inc_tax', internalField: 'total' }),
  ];
}

// ============================================================================
// FACTORY FUNCTIONS - SYNC CONFIG
// ============================================================================

export function createSyncConfig(overrides?: Partial<SyncConfig>): SyncConfig {
  return {
    id: `config_${Math.random().toString(36).substr(2, 9)}`,
    platformId: 'platform_001',
    platformName: 'shopify',
    apiKey: 'test_api_key_123456',
    apiSecret: 'test_api_secret_789',
    webhookUrl: 'https://api.witylogix.com/webhooks/shopify',
    webhookSecret: 'test_webhook_secret',
    syncEnabled: true,
    syncInterval: 3600000,
    lastSyncAt: new Date('2024-03-15T09:00:00Z'),
    fieldMappings: createShopifyFieldMappings(),
    conflictResolutionStrategy: 'LAST_WRITE_WINS',
    ...overrides,
  };
}

export function createDisabledSyncConfig(): SyncConfig {
  return createSyncConfig({ syncEnabled: false, lastSyncAt: undefined });
}

export function createManualReviewConfig(): SyncConfig {
  return createSyncConfig({ conflictResolutionStrategy: 'MANUAL_REVIEW' });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function generateDedupKey(platformId: string, externalOrderId: string): string {
  return `${platformId}#${externalOrderId}`;
}

export function generateWebhookSignature(payload: string, secret: string): string {
  // Simple HMAC-SHA256 simulation for testing
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(payload).digest('base64');
}

export function createSampleOrderList(count: number = 5): PlatformOrder[] {
  const creators = [createShopifyOrder, createBigCommerceOrder, createMagentoOrder, createEtsyOrder, createEBayOrder, createSquareOrder];
  return Array.from({ length: count }, (_, i) => {
    const creator = creators[i % creators.length];
    return creator();
  });
}
