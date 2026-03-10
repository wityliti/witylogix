/**
 * Platform Bridge Type Definitions
 * Unified types for multi-platform e-commerce integration
 */

/**
 * Supported e-commerce platforms
 */
export enum PlatformSource {
  SHOPIFY = 'shopify',
  WOOCOMMERCE = 'woocommerce',
  MAGENTO = 'magento',
  CUSTOM = 'custom',
}

/**
 * Unified order representation
 */
export interface UnifiedOrder {
  id: string;
  externalId: string;
  platform: PlatformSource;
  number: string;
  status: 'pending' | 'confirmed' | 'dispatched' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned';
  currency: string;
  createdAt: Date;
  modifiedAt: Date;
  customer: UnifiedCustomer;
  lineItems: UnifiedLineItem[];
  shippingAddress: UnifiedAddress;
  billingAddress: UnifiedAddress;
  paymentMethod: string;
  subtotal: number; // In cents
  taxTotal: number; // In cents
  shippingTotal: number; // In cents
  discountTotal: number; // In cents
  total: number; // In cents
  notes: string;
  metadata: Record<string, unknown>;
}

/**
 * Unified line item (order product)
 */
export interface UnifiedLineItem {
  id: string;
  externalId: string;
  productId: string;
  productName: string;
  variantId?: string;
  sku: string;
  quantity: number;
  unitPrice: number; // In cents
  totalPrice: number; // In cents
  taxTotal: number; // In cents
  metadata: Record<string, unknown>;
}

/**
 * Unified product representation
 */
export interface UnifiedProduct {
  id: string;
  externalId: string;
  platform: PlatformSource;
  name: string;
  description: string;
  sku: string;
  price: number; // In cents
  compareAtPrice?: number; // In cents
  cost?: number; // In cents
  weight?: number;
  status: 'draft' | 'active' | 'archived';
  createdAt: Date;
  modifiedAt: Date;
  images: UnifiedImage[];
  variants: UnifiedProductVariant[];
  categories: string[];
  tags: string[];
  metadata: Record<string, unknown>;
}

/**
 * Unified product variant
 */
export interface UnifiedProductVariant {
  id: string;
  externalId: string;
  title: string;
  sku: string;
  price: number; // In cents
  compareAtPrice?: number; // In cents
  weight?: number;
  inventory: number;
  metadata: Record<string, unknown>;
}

/**
 * Unified product image
 */
export interface UnifiedImage {
  id: string;
  externalId: string;
  url: string;
  alt: string;
  position: number;
}

/**
 * Unified customer representation
 */
export interface UnifiedCustomer {
  id: string;
  externalId: string;
  platform: PlatformSource;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  defaultAddress?: UnifiedAddress;
  shippingAddresses: UnifiedAddress[];
  billingAddress?: UnifiedAddress;
  totalOrders: number;
  totalSpent: number; // In cents
  isVerified: boolean;
  createdAt: Date;
  modifiedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Unified address representation
 */
export interface UnifiedAddress {
  id?: string;
  firstName: string;
  lastName: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  email?: string;
  phone?: string;
  isDefault?: boolean;
}

/**
 * Unified webhook event
 */
export interface UnifiedWebhookEvent {
  id: string;
  platform: PlatformSource;
  topic: string;
  eventType: 'created' | 'updated' | 'deleted' | 'action_required';
  resourceType: 'order' | 'product' | 'customer' | 'fulfillment';
  resourceId: string;
  data: UnifiedOrder | UnifiedProduct | UnifiedCustomer;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

/**
 * Field mapping configuration for normalization
 */
export interface FieldMapping {
  source: string; // Source field path (e.g., 'customer.email')
  target: string; // Target field path (e.g., 'email')
  transform?: (value: unknown) => unknown; // Optional transformation function
  required?: boolean;
}

/**
 * Normalizer configuration
 */
export interface NormalizerConfig {
  platform: PlatformSource;
  fieldMappings: Record<string, FieldMapping[]>;
  dateFields?: string[]; // Fields that should be converted to Date
  currencyFields?: string[]; // Fields that represent currency values
}

/**
 * Normalization error
 */
export interface NormalizationError {
  field: string;
  value: unknown;
  reason: string;
}

/**
 * Normalization result
 */
export interface NormalizationResult<T> {
  success: boolean;
  data?: T;
  errors?: NormalizationError[];
}

/**
 * Platform-specific webhook topics
 */
export interface PlatformWebhookTopics {
  [PlatformSource.SHOPIFY]: {
    order: 'orders/created' | 'orders/updated' | 'orders/cancelled' | 'orders/fulfilled';
    product: 'products/create' | 'products/update' | 'products/delete';
    customer: 'customers/create' | 'customers/update' | 'customers/delete';
  };
  [PlatformSource.WOOCOMMERCE]: {
    order: 'order.created' | 'order.updated' | 'order.deleted';
    product: 'product.created' | 'product.updated' | 'product.deleted';
    customer: 'customer.created' | 'customer.updated' | 'customer.deleted';
  };
  [PlatformSource.MAGENTO]: {
    order: 'order.created' | 'order.updated' | 'order.cancelled';
    product: 'product.created' | 'product.updated' | 'product.deleted';
    customer: 'customer.created' | 'customer.updated' | 'customer.deleted';
  };
}

/**
 * Sync direction
 */
export type SyncDirection = 'one-way-pull' | 'one-way-push' | 'bidirectional';

/**
 * Sync configuration
 */
export interface SyncConfig {
  platform: PlatformSource;
  resources: ('orders' | 'products' | 'customers')[];
  direction: SyncDirection;
  schedule?: string; // Cron expression
  batchSize?: number;
  conflictResolution?: 'last-write-wins' | 'external-wins' | 'internal-wins';
}

/**
 * Sync status
 */
export interface SyncStatus {
  id: string;
  platform: PlatformSource;
  resource: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  itemsProcessed: number;
  itemsFailed: number;
  errors: string[];
}
