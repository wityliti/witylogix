/**
 * WooCommerce Integration Types
 * Type definitions for WooCommerce REST API v3 and Witylogix mappings
 */

/**
 * WooCommerce Order Status
 */
export type WCOrderStatus =
  | "pending"
  | "processing"
  | "on-hold"
  | "completed"
  | "cancelled"
  | "refunded"
  | "failed";

/**
 * Witylogix Order Status
 */
export type WLOrderStatus =
  | "pending"
  | "confirmed"
  | "dispatched"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned";

/**
 * WooCommerce Product Type
 */
export type WCProductType =
  | "simple"
  | "variable"
  | "grouped"
  | "external"
  | "bundle";

/**
 * WooCommerce Order from REST API v3
 */
export interface WCOrder {
  id: number;
  parent_id: number;
  number: string;
  order_key: string;
  created_via: string;
  version: string;
  status: WCOrderStatus;
  currency: string;
  date_created: string; // ISO 8601
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  customer_id: number;
  customer_note: string;
  billing: WCAddress;
  shipping: WCAddress;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  date_paid: string | null;
  date_completed: string | null;
  cart_hash: string;
  meta_data: Array<{
    id: number;
    key: string;
    value: string | Record<string, unknown>;
  }>;
  line_items: WCLineItem[];
  tax_lines: WCTaxLine[];
  shipping_lines: WCShippingLine[];
  fee_lines: WCFeeLine[];
  coupon_lines: WCCouponLine[];
}

/**
 * WooCommerce Address
 */
export interface WCAddress {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

/**
 * WooCommerce Line Item (Order Product)
 */
export interface WCLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  tax_class: string;
  subtotal: string;
  subtotal_tax: string;
  total: string;
  total_tax: string;
  taxes: Array<{
    id: number;
    total: string;
    subtotal: string;
  }>;
  meta_data: Array<{
    id: number;
    key: string;
    value: string | Record<string, unknown>;
  }>;
  sku: string;
  price: number;
}

/**
 * WooCommerce Tax Line
 */
export interface WCTaxLine {
  id: number;
  rate_code: string;
  rate_id: number;
  label: string;
  compound: boolean;
  tax_total: string;
  shipping_tax_total: string;
  meta_data: Array<{
    id: number;
    key: string;
    value: string | Record<string, unknown>;
  }>;
}

/**
 * WooCommerce Shipping Line
 */
export interface WCShippingLine {
  id: number;
  method_title: string;
  method_id: string;
  instance_id: string;
  total: string;
  total_tax: string;
  taxes: Array<{
    id: number;
    total: string;
  }>;
  meta_data: Array<{
    id: number;
    key: string;
    value: string | Record<string, unknown>;
  }>;
}

/**
 * WooCommerce Fee Line
 */
export interface WCFeeLine {
  id: number;
  name: string;
  tax_class: string;
  tax_status: string;
  total: string;
  total_tax: string;
  taxes: Array<{
    id: number;
    total: string;
  }>;
  meta_data: Array<{
    id: number;
    key: string;
    value: string | Record<string, unknown>;
  }>;
}

/**
 * WooCommerce Coupon Line
 */
export interface WCCouponLine {
  id: number;
  code: string;
  discount: string;
  discount_tax: string;
  meta_data: Array<{
    id: number;
    key: string;
    value: string | Record<string, unknown>;
  }>;
}

/**
 * WooCommerce Product from REST API v3
 */
export interface WCProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  type: WCProductType;
  status: "draft" | "pending" | "private" | "publish";
  featured: boolean;
  catalog_visibility: "visible" | "catalog" | "search" | "hidden";
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  date_on_sale_from: string | null;
  date_on_sale_from_gmt: string | null;
  date_on_sale_to: string | null;
  date_on_sale_to_gmt: string | null;
  price_html: string;
  on_sale: boolean;
  purchasable: boolean;
  total_sales: number;
  virtual: boolean;
  downloadable: boolean;
  downloads: Array<{
    id: string;
    name: string;
    file: string;
  }>;
  download_limit: number;
  download_expiry: number;
  external_url: string;
  button_text: string;
  tax_status: "taxable" | "shipping" | "none";
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  backorders: "no" | "notify" | "yes";
  backorders_allowed: boolean;
  backordered: boolean;
  sold_individually: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  shipping_required: boolean;
  shipping_taxable: boolean;
  shipping_class: string;
  shipping_class_id: number;
  reviews_allowed: boolean;
  average_rating: string;
  rating_count: number;
  related_ids: number[];
  upsell_ids: number[];
  cross_sell_ids: number[];
  parent_id: number;
  purchase_note: string;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  tags: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  images: WCProductImage[];
  attributes: Array<{
    id: number;
    name: string;
    position: number;
    visible: boolean;
    variation: boolean;
    options: string[];
  }>;
  default_attributes: Array<{
    id: number;
    name: string;
    option: string;
  }>;
  variations: number[];
  grouped_products: number[];
  menu_order: number;
  meta_data: Array<{
    id: number;
    key: string;
    value: string | Record<string, unknown>;
  }>;
}

/**
 * WooCommerce Product Image
 */
export interface WCProductImage {
  id: number;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  src: string;
  name: string;
  alt: string;
}

/**
 * WooCommerce Product Variation
 */
export interface WCProductVariation {
  id: number;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  description: string;
  permalink: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  date_on_sale_from: string | null;
  date_on_sale_from_gmt: string | null;
  date_on_sale_to: string | null;
  date_on_sale_to_gmt: string | null;
  on_sale: boolean;
  status: "draft" | "pending" | "private" | "publish";
  purchasable: boolean;
  virtual: boolean;
  downloadable: boolean;
  downloads: Array<{
    id: string;
    name: string;
    file: string;
  }>;
  download_limit: number;
  download_expiry: number;
  tax_status: "taxable" | "shipping" | "none";
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  backorders: "no" | "notify" | "yes";
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  shipping_class: string;
  shipping_class_id: number;
  image: WCProductImage | null;
  attributes: Array<{
    id: number;
    name: string;
    option: string;
  }>;
  menu_order: number;
  meta_data: Array<{
    id: number;
    key: string;
    value: string | Record<string, unknown>;
  }>;
}

/**
 * WooCommerce Customer from REST API v3
 */
export interface WCCustomer {
  id: number;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  username: string;
  billing: WCAddress;
  shipping: WCAddress;
  is_paying_customer: boolean;
  avatar_url: string;
  meta_data: Array<{
    id: number;
    key: string;
    value: string | Record<string, unknown>;
  }>;
}

/**
 * WooCommerce Webhook from REST API v3
 */
export interface WCWebhook {
  id: number;
  name: string;
  status: "active" | "paused" | "disabled";
  topic: string;
  resource: string;
  event: string;
  hooks: string[];
  delivery_url: string;
  api_version: string;
  secret: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  _links: Record<string, unknown>;
}

/**
 * WooCommerce Webhook Payload
 */
export interface WCWebhookPayload {
  id: number;
  resource: string;
  event: string;
  created_at: string;
  data: WCOrder | WCProduct | WCCustomer;
}

/**
 * WooCommerce Client Configuration
 */
export interface WCClientConfig {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  version?: string; // REST API version, defaults to "wc/v3"
  timeout?: number; // milliseconds, defaults to 30000
  rateLimit?: number; // requests per second, defaults to 25
  retries?: number; // max retry attempts, defaults to 3
}

/**
 * WooCommerce Sync Options
 */
export interface WCSyncOptions {
  syncOrders?: boolean;
  syncProducts?: boolean;
  syncCustomers?: boolean;
  since?: Date; // Only sync items modified since this date
  includeArchived?: boolean;
  conflictResolution?: "last-write-wins" | "external-wins" | "internal-wins";
}

/**
 * WooCommerce Sync Result
 */
export interface WCSyncResult {
  ordersSync: {
    created: number;
    updated: number;
    failed: number;
    errors: Array<{
      id: string;
      error: string;
    }>;
  };
  productsSync: {
    created: number;
    updated: number;
    failed: number;
    errors: Array<{
      id: string;
      error: string;
    }>;
  };
  customersSync: {
    created: number;
    updated: number;
    failed: number;
    errors: Array<{
      id: string;
      error: string;
    }>;
  };
}

/**
 * WooCommerce to Witylogix Order Mapping
 */
export interface WCToWLOrderMapping {
  wcOrderId: number;
  wlOrderId: string;
  wcStatus: WCOrderStatus;
  wlStatus: WLOrderStatus;
  syncedAt: Date;
  lastModifiedAt: Date;
}

/**
 * WooCommerce Sync Record
 */
export interface WCSyncRecord {
  id: string;
  tenantId: string;
  wcId: string | number;
  wlId: string;
  entityType: "order" | "product" | "customer";
  syncDirection: "wc_to_wl" | "wl_to_wc" | "bidirectional";
  lastSyncedAt: Date;
  status: "success" | "pending" | "failed";
  errorMessage?: string;
}

/**
 * OAuth 1.0a Signature for WooCommerce
 */
export interface OAuth1aSignature {
  authorizationHeader: string;
  timestamp: string;
  nonce: string;
  signature: string;
}

/**
 * Pagination options for WooCommerce API
 */
export interface WCPaginationOptions {
  page?: number;
  perPage?: number;
  offset?: number;
  orderby?: string;
  order?: "asc" | "desc";
}

/**
 * WooCommerce API Error Response
 */
export interface WCAPIError {
  code: string;
  message: string;
  data?: {
    status: number;
  };
}

/**
 * WooCommerce List Response
 */
export interface WCListResponse<T> {
  data: T[];
  totalItems?: number;
  page?: number;
  perPage?: number;
}
