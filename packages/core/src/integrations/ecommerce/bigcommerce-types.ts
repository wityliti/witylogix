/**
 * BigCommerce-specific TypeScript types and interfaces
 * Extends base ecommerce types with platform-specific fields
 */

import type {
  ECommerceOrder,
  ECommerceProduct,
  ECommerceCustomer,
  ECommerceInventory,
  ECommerceWebhookEvent,
} from "./types.js";

/**
 * BigCommerce Order Status Enum
 */
export enum BigCommerceOrderStatusId {
  Pending = 0,
  Dispatched = 1,
  Shipped = 2,
  Cancelled = 3,
  Refunded = 4,
  PartiallyShipped = 5,
  PendingReview = 6,
  ManuallyReviewed = 7,
  AwaitingShipment = 8,
  AwaitingPickup = 9,
  Complete = 10,
}

/**
 * BigCommerce Payment Status Enum
 */
export enum BigCommercePaymentStatusId {
  Pending = 0,
  Authorized = 1,
  Captured = 2,
  Refunded = 3,
}

/**
 * BigCommerce Fulfillment Status Enum
 */
export enum BigCommerceFulfillmentStatusId {
  Shipped = 0,
  Partial = 1,
  NotFulfilled = 2,
}

/**
 * BigCommerce Product Status Type
 */
export type BigCommerceProductStatus = "active" | "disabled" | "archived";

/**
 * BigCommerce Product Visibility
 */
export interface BigCommerceProductVisibility {
  is_visible: boolean;
  is_featured: boolean;
  seo_url: string;
}

/**
 * BigCommerce Order with extended fields
 */
export interface BigCommerceOrderExtended extends ECommerceOrder {
  status_id: number;
  fulfillment_status: string;
  customer_message?: string;
  staff_notes?: string;
  is_email_opt_in: boolean;
  payment_provider_id?: string;
}

/**
 * BigCommerce Product with extended fields
 */
export interface BigCommerceProductExtended extends ECommerceProduct {
  inventory_tracking?: "simple" | "variant" | "none";
  view_count?: number;
  seo_url?: string;
  is_featured: boolean;
  dimension_unit?: "in" | "cm";
}

/**
 * BigCommerce Customer with extended fields
 */
export interface BigCommerceCustomerExtended extends ECommerceCustomer {
  customer_group_id: number;
  tax_exempt_category?: string;
  store_credit?: string;
  registration_ip_address?: string;
  authentication_token?: string;
}

/**
 * BigCommerce Inventory with extended fields
 */
export interface BigCommerceInventoryExtended extends ECommerceInventory {
  warning_level: number;
  bin_picking_number?: string;
}

/**
 * BigCommerce Webhook Event payload
 */
export interface BigCommerceWebhookPayload {
  scope: string;
  type: string;
  id: number;
  created_at: number;
  data: Record<string, unknown>;
}

/**
 * BigCommerce Webhook Event with extended fields
 */
export interface BigCommerceWebhookEventExtended extends ECommerceWebhookEvent {
  scope: string;
  type: string;
  created_at: number;
}

/**
 * BigCommerce Order Line Item
 */
export interface BigCommerceOrderLineItem {
  id: number;
  order_id: number;
  product_id: number;
  variant_id: number;
  order_product_id: number;
  quantity: number;
  quantity_shipped: number;
  quantity_refunded: number;
  refund_reason?: string;
  product_name: string;
  product_sku: string;
  variant_sku?: string;
  bin_picking_number?: string;
  event_name?: string;
  list_price: number;
  list_price_inc_tax: number;
  list_price_ex_tax: number;
  sale_price: number;
  sale_price_inc_tax: number;
  sale_price_ex_tax: number;
  base_total: number;
  base_total_inc_tax: number;
  base_total_ex_tax: number;
  total: number;
  total_inc_tax: number;
  total_ex_tax: number;
  tax: number;
  tax_class?: string;
  digital_download?: {
    download_enabled: boolean;
    max_downloads: number;
    files: Array<{
      id: number;
      filename: string;
      size: number;
    }>;
  };
}

/**
 * BigCommerce Shipment
 */
export interface BigCommerceShipment {
  id: number;
  order_id: number;
  customer_id: number;
  order_address_id: number;
  date_created: string;
  tracking_carrier: string;
  tracking_number: string;
  comments: string;
  shipping_provider: string;
  shipping_method: string;
  tracking_carrier_url?: string;
  items: Array<{
    order_product_id: number;
    quantity: number;
  }>;
}

/**
 * BigCommerce Refund
 */
export interface BigCommerceRefund {
  id: number;
  order_id: number;
  user_id: number;
  created: number;
  reason: string;
  amount: string;
  items: Array<{
    item_id: number;
    quantity: number;
    reason: string;
  }>;
}

/**
 * BigCommerce ProductVariant with extended pricing
 */
export interface BigCommerceVariantWithPricing {
  id: number;
  product_id: number;
  sku: string;
  price: number;
  cost_price?: number;
  retail_price?: number;
  sale_price?: number;
  weight?: number;
  width?: number;
  depth?: number;
  height?: number;
  is_default: boolean;
  inventory_level?: number;
  inventory_warning_level?: number;
  option_values?: Array<{
    option_display_name: string;
    option_id: number;
    id: number;
    label: string;
  }>;
  bulk_pricing_rules?: Array<{
    id: number;
    quantity_min: number;
    quantity_max: number;
    type: "fixed" | "percent" | "price";
    amount: string;
  }>;
}

/**
 * BigCommerce Product Category
 */
export interface BigCommerceProductCategory {
  id: number;
  parent_id: number;
  name: string;
  description?: string;
  sort_order: number;
  page_title?: string;
  meta_keywords?: string[];
  meta_description?: string;
  layout?: string;
  is_visible: boolean;
  default_product_sort?: string;
  image_url?: string;
  custom_url?: {
    url: string;
    is_customized: boolean;
  };
}

/**
 * BigCommerce Brand
 */
export interface BigCommerceBrand {
  id: number;
  name: string;
  page_title?: string;
  meta_keywords?: string[];
  meta_description?: string;
  image_url?: string;
  search_keywords?: string;
  custom_url?: {
    url: string;
    is_customized: boolean;
  };
}

/**
 * BigCommerce Customer Group
 */
export interface BigCommerceCustomerGroup {
  id: number;
  name: string;
  is_default: boolean;
  category_access: "all" | "specific";
  discount_rules?: Array<{
    type: "price" | "percent";
    amount: string;
  }>;
}

/**
 * BigCommerce Webhook Subscription Event Scope
 */
export type BigCommerceWebhookScope =
  | "store/order/*"
  | "store/order/created"
  | "store/order/updated"
  | "store/order/archived"
  | "store/product/*"
  | "store/product/created"
  | "store/product/updated"
  | "store/product/deleted"
  | "store/customer/*"
  | "store/customer/created"
  | "store/customer/updated"
  | "store/customer/deleted"
  | "store/cart/*"
  | "store/cart/created"
  | "store/cart/updated"
  | "store/cart/deleted"
  | "store/inventory/*"
  | "store/inventory/updated";

/**
 * BigCommerce OAuth Scope
 */
export type BigCommerceOAuthScope =
  | "store/orders"
  | "store/orders/read"
  | "store/orders:create"
  | "store/orders:update"
  | "store/orders:delete"
  | "store/products"
  | "store/products/read"
  | "store/products:create"
  | "store/products:update"
  | "store/products:delete"
  | "store/customers"
  | "store/customers/read"
  | "store/customers:create"
  | "store/customers:update"
  | "store/customers:delete"
  | "store/inventory"
  | "store/inventory:read"
  | "store/inventory:update"
  | "store/settings/read";

/**
 * BigCommerce API Error Response
 */
export interface BigCommerceErrorResponse {
  status: number;
  title: string;
  type: string;
  detail?: string;
  errors?: Array<{
    status: number;
    title: string;
    detail: string;
    field?: string;
    error_type?: string;
  }>;
}

/**
 * BigCommerce Pagination Meta
 */
export interface BigCommercePaginationMeta {
  pagination: {
    total: number;
    count: number;
    per_page: number;
    current_page: number;
    total_pages: number;
    links?: {
      next?: string;
      current: string;
    };
  };
}

/**
 * BigCommerce Coupon/Discount
 */
export interface BigCommerceCoupon {
  id: number;
  code: string;
  coupon_type: string;
  discount_type: string;
  discount_amount: string;
  discount_percentage?: string;
  discount_category?: {
    id: number;
  };
  applies_to?: {
    entity: string;
  };
  expires: string;
  enabled: boolean;
  max_uses?: number;
  max_uses_per_customer?: number;
  num_uses: number;
  restricted_to?: Record<string, unknown>;
  shipping_methods?: string[];
  min_purchase_amount?: string;
  custom_fields?: Array<{
    name: string;
    value: string;
  }>;
}

/**
 * BigCommerce Store Information
 */
export interface BigCommerceStoreInfo {
  id: number;
  uuid: string;
  name: string;
  first_name: string;
  last_name: string;
  address: string;
  country: string;
  phone: string;
  admin_email: string;
  order_email: string;
  favicon_url?: string;
  logo_url?: string;
  language: string;
  currency: string;
  currency_symbol: string;
  decimal_separator: string;
  thousands_separator: string;
  default_time_zone: string;
  date_created: string;
  date_modified: string;
}

/**
 * BigCommerce Payment Method
 */
export interface BigCommercePaymentMethod {
  id: string;
  name: string;
  code: string;
  config?: Record<string, unknown>;
  enabled: boolean;
  test_mode?: boolean;
}

/**
 * BigCommerce Shipping Carrier
 */
export interface BigCommerceShippingCarrier {
  id: number;
  name: string;
  enabled: boolean;
  carrier_type: string;
  config?: Record<string, unknown>;
}

/**
 * BigCommerce Tax Class
 */
export interface BigCommerceTaxClass {
  id: number;
  name: string;
}

/**
 * BigCommerce Channel (multi-channel support)
 */
export interface BigCommerceChannel {
  id: number;
  type: string;
  platform: string;
  name: string;
  is_enabled: boolean;
  is_listable: boolean;
  is_taxable: boolean;
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * BigCommerce Listing (channel-specific product)
 */
export interface BigCommerceListing {
  id: number;
  product_id: number;
  channel_id: number;
  listing_id: string;
  state: string;
  name: string;
  description?: string;
  sku?: string;
  price?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * BigCommerce Metafield (custom fields)
 */
export interface BigCommerceMetafield {
  id: number;
  ownerId: number;
  key: string;
  value: string;
  namespace: string;
  resourceType: string;
  description?: string;
  ownerMetaId?: number;
}

/**
 * BigCommerce Cart Item
 */
export interface BigCommerceCartItem {
  id: string;
  product_id: number;
  variant_id: number;
  quantity: number;
  list_price: number;
  sale_price: number;
  extended_list_price: number;
  extended_sale_price: number;
}

/**
 * BigCommerce Site Configuration
 */
export interface BigCommerceSiteConfiguration {
  id: string;
  store_id: number;
  name: string;
  domain: string;
  url: string;
  ssl_url: string;
  created_at: string;
  updated_at: string;
}
