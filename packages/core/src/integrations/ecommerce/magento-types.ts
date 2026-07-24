/**
 * Magento 2 REST API Types
 * Type definitions for Magento 2 REST API responses and requests
 * Supports: OAuth1, Bearer tokens, API keys authentication
 */

/**
 * Magento 2 API configuration
 */
export interface MagentoConfig {
  baseUrl: string;
  authType: "oauth1" | "bearer" | "apikey";
  // OAuth1
  consumerKey?: string;
  consumerSecret?: string;
  token?: string;
  tokenSecret?: string;
  // Bearer/API Key
  accessToken?: string;
  apiKey?: string;
  webhookSecret?: string;
  timeout?: number;
  rateLimit?: number; // requests per second
}

/**
 * Magento 2 Order API Response
 */
export interface MagentoOrderResponse {
  entity_id: number;
  increment_id: string;
  state: string;
  status: string;
  coupon_code?: string;
  store_id: number;
  store_name?: string;
  created_at: string;
  updated_at: string;
  customer_id?: number;
  customer_is_guest: number;
  customer_note?: string;
  customer_note_notify: number;
  billing_address: MagentoAddressResponse;
  shipping_address?: MagentoAddressResponse;
  payment?: {
    method: string;
    additional_information?: string[];
  };
  items: MagentoOrderItemResponse[];
  status_histories?: MagentoStatusHistoryResponse[];
  extension_attributes?: {
    shipping_assignments?: Array<{
      shipping: {
        address: MagentoAddressResponse;
        method: string;
        total: MagentoTotalsResponse;
      };
      items: Array<{ order_item_id: number; qty: number }>;
    }>;
    reward_points_balance?: number;
  };
  total_qty_ordered?: number;
  grand_total: number;
  subtotal: number;
  subtotal_incl_tax: number;
  tax_amount: number;
  shipping_amount: number;
  shipping_incl_tax: number;
  discount_amount: number;
  total_paid?: number;
  total_refunded?: number;
  total_due?: number;
}

/**
 * Magento 2 Address API Response
 */
export interface MagentoAddressResponse {
  firstname: string;
  lastname: string;
  company?: string;
  street?: string | string[];
  city: string;
  region?: string;
  region_code?: string;
  postcode: string;
  country_id: string;
  telephone?: string;
  email?: string;
}

/**
 * Magento 2 Order Item Response
 */
export interface MagentoOrderItemResponse {
  item_id: number;
  order_id: number;
  parent_item_id?: number;
  quote_item_id?: number;
  store_id: number;
  created_at: string;
  updated_at: string;
  product_id: number;
  product_type: string;
  product_options?: Record<string, unknown>;
  sku: string;
  name: string;
  description?: string;
  weight?: number;
  is_virtual: boolean;
  is_qty_decimal: boolean;
  item_id_num?: number;
  price: number;
  base_price: number;
  original_price?: number;
  base_original_price?: number;
  tax_percent: number;
  tax_amount: number;
  base_tax_amount: number;
  discount_percent: number;
  discount_amount: number;
  base_discount_amount: number;
  discount_incl_amount?: number;
  base_discount_incl_amount?: number;
  amount_refunded?: number;
  base_amount_refunded?: number;
  qty_ordered: number;
  qty_invoiced: number;
  qty_shipped: number;
  qty_canceled?: number;
  qty_refunded?: number;
  qty_returned?: number;
  row_total: number;
  base_row_total: number;
  row_invoiced: number;
  base_row_invoiced: number;
  row_weight: number;
  base_tax_before_discount?: number;
  tax_before_discount?: number;
  ext_order_item_id?: string;
  locked_do_invoice: boolean;
  locked_do_ship: boolean;
  price_incl_tax: number;
  base_price_incl_tax: number;
  row_total_incl_tax: number;
  base_row_total_incl_tax: number;
  discount_tax_compensation_amount: number;
  base_discount_tax_compensation_amount: number;
  discount_tax_compensation_invoiced: number;
  base_discount_tax_compensation_invoiced: number;
  discount_tax_compensation_refunded?: number;
  base_discount_tax_compensation_refunded?: number;
  tax_canceled?: number;
  discount_tax_compensation_canceled?: number;
}

/**
 * Magento 2 Status History Response
 */
export interface MagentoStatusHistoryResponse {
  entity_id: number;
  parent_id: number;
  is_customer_notified: number;
  is_visible_on_front: number;
  comment: string;
  status: string;
  created_at: string;
  updated_at: string;
  entity_name: string;
}

/**
 * Magento 2 Totals Response
 */
export interface MagentoTotalsResponse {
  grand_total: number;
  base_grand_total: number;
  subtotal: number;
  base_subtotal: number;
  tax_amount: number;
  base_tax_amount: number;
  discount_amount: number;
  base_discount_amount: number;
  shipping: number;
  base_shipping: number;
}

/**
 * Magento 2 Product API Response
 */
export interface MagentoProductResponse {
  id: number;
  sku: string;
  name: string;
  attribute_set_id: number;
  price: number;
  status: number; // 1 = enabled, 2 = disabled
  visibility: number;
  type_id: string;
  created_at: string;
  updated_at: string;
  weight?: number;
  product_links?: Array<{
    id: number;
    sku: string;
    link_type: string;
    linked_product_sku: string;
    linked_product_type: string;
    position: number;
  }>;
  options?: Array<{
    product_id: number;
    option_id: number;
    type: string;
    is_require: boolean;
    sku?: string;
    max_characters?: number;
    image_size_x?: number;
    image_size_y?: number;
    sort_order: number;
    option_title?: string;
    price?: number;
    price_type?: string;
    sku_type?: string;
    file_extension?: string;
    image_size_x_type?: string;
    image_size_y_type?: string;
    values?: Array<{ title?: string; sort_order: number; price?: number }>;
  }>;
  media_gallery_entries?: Array<{
    id: number;
    media_type: string;
    label: string;
    position: number;
    disabled: boolean;
    types: string[];
    file: string;
  }>;
  custom_attributes?: Array<{
    attribute_code: string;
    value: unknown;
  }>;
  extension_attributes?: {
    stock_item?: MagentoStockItemResponse;
    category_links?: Array<{ position: number; category_id: string }>;
    bundle_product_options?: Array<{
      option_id: number;
      title: string;
      required: boolean;
      type: string;
      position: number;
      sku?: string;
      product_links: Array<{
        id: string;
        sku: string;
        name: string;
        position: number;
        qty: number;
        price?: number;
        price_type?: number;
        can_change_qty: boolean;
      }>;
    }>;
    configurable_product_options?: Array<{
      id: number;
      attribute_id: string;
      label: string;
      position: number;
      is_use_default: boolean;
      values: Array<{
        value_index: number;
        label?: string;
      }>;
    }>;
    configurable_product_links?: number[];
  };
}

/**
 * Magento 2 Stock Item Response
 */
export interface MagentoStockItemResponse {
  item_id: number;
  product_id: number;
  stock_id: number;
  qty: number;
  min_qty: number;
  min_sale_qty?: number;
  max_sale_qty?: number;
  is_qty_decimal: boolean;
  backorders: number;
  notify_stock_qty?: number;
  manage_stock: boolean;
  use_config_manage_stock: boolean;
  is_in_stock: boolean;
  low_stock_date?: string;
  use_config_notify_stock_qty: boolean;
  use_config_qty_increments: boolean;
  qty_increments?: number;
  use_config_min_qty: boolean;
  use_config_min_sale_qty: boolean;
  use_config_max_sale_qty: boolean;
  use_config_backorders: boolean;
}

/**
 * Magento 2 Customer API Response
 */
export interface MagentoCustomerResponse {
  id: number;
  group_id: number;
  default_billing?: string;
  default_shipping?: string;
  confirmation?: string;
  created_at: string;
  updated_at: string;
  created_in: string;
  dob?: string;
  email: string;
  firstname: string;
  lastname: string;
  middlename?: string;
  prefix?: string;
  suffix?: string;
  gender?: number; // 0 = Not specified, 1 = Male, 2 = Female
  store_id: number;
  taxvat?: string;
  website_id: number;
  addresses?: MagentoCustomerAddressResponse[];
  custom_attributes?: Array<{
    attribute_code: string;
    value: unknown;
  }>;
  extension_attributes?: {
    is_subscribed?: boolean;
    company_attributes?: Record<string, unknown>;
  };
}

/**
 * Magento 2 Customer Address Response
 */
export interface MagentoCustomerAddressResponse {
  id: number;
  customer_id: number;
  region: {
    region_code: string;
    region: string;
    region_id: number;
  };
  region_id: number;
  country_id: string;
  street: string[];
  telephone?: string;
  postcode: string;
  city: string;
  firstname: string;
  lastname: string;
  middlename?: string;
  prefix?: string;
  suffix?: string;
  company?: string;
  vat_id?: string;
  is_default_billing?: boolean;
  is_default_shipping?: boolean;
  custom_attributes?: Array<{
    attribute_code: string;
    value: unknown;
  }>;
}

/**
 * Magento 2 Invoice Response
 */
export interface MagentoInvoiceResponse {
  entity_id: number;
  increment_id: string;
  order_id: number;
  state: number;
  created_at: string;
  updated_at: string;
  is_email_sent: number;
  email_sent?: boolean;
  order_increment_id: string;
  store_id: number;
  base_currency_code: string;
  store_currency_code: string;
  order_currency_code: string;
  items: Array<{
    entity_id: number;
    parent_id: number;
    base_price: number;
    price: number;
    qty: number;
    row_total: number;
    base_row_total: number;
    order_item_id: number;
    product_id: number;
    sku: string;
    name: string;
  }>;
  comments?: Array<{
    entity_id: number;
    parent_id: number;
    is_customer_notified: number;
    is_visible_on_front: number;
    comment: string;
    created_at: string;
  }>;
}

/**
 * Magento 2 Shipment Response
 */
export interface MagentoShipmentResponse {
  entity_id: number;
  increment_id: string;
  order_id: number;
  store_id: number;
  created_at: string;
  updated_at: string;
  packages: Array<{
    entity_id: number;
    shipment_id: number;
    weight: number;
    cost: number;
    carrier_code: string;
    container_type?: string;
    barcode?: string;
  }>;
  tracks: Array<{
    entity_id: number;
    parent_id: number;
    weight: number;
    qty: number;
    order_increment_id: string;
    track_number: string;
    title: string;
    carrier_code: string;
    description: string;
    created_at: string;
    updated_at: string;
  }>;
  items: Array<{
    entity_id: number;
    parent_id: number;
    row_total: number;
    price: number;
    weight: number;
    qty: number;
    product_id: number;
    order_item_id: number;
    additional_data?: string;
    description?: string;
    name: string;
    sku: string;
  }>;
  comments?: Array<{
    entity_id: number;
    parent_id: number;
    comment: string;
    is_customer_notified: number;
    is_visible_on_front: number;
    created_at: string;
  }>;
}

/**
 * Magento 2 Credit Memo Response
 */
export interface MagentoCreditMemoResponse {
  entity_id: number;
  increment_id: string;
  order_id: number;
  state: number;
  adjustment: number;
  base_adjustment: number;
  shipping_amount: number;
  base_shipping_amount: number;
  adjustment_negative: number;
  base_adjustment_negative: number;
  subtotal: number;
  base_subtotal: number;
  grand_total: number;
  base_grand_total: number;
  created_at: string;
  updated_at: string;
  items: Array<{
    entity_id: number;
    parent_id: number;
    base_price: number;
    price: number;
    qty: number;
    row_total: number;
    base_row_total: number;
    order_item_id: number;
    product_id: number;
    sku: string;
    name: string;
  }>;
  comments?: Array<{
    entity_id: number;
    parent_id: number;
    comment: string;
    is_customer_notified: number;
    is_visible_on_front: number;
    created_at: string;
  }>;
}

/**
 * Magento 2 SearchCriteria filter
 */
export interface MagentoFilterGroup {
  filters: Array<{
    field: string;
    value: string | number | boolean | unknown;
    condition_type?: string; // eq, neq, gt, gteq, lt, lteq, like, in, nin, notnull, null
  }>;
}

/**
 * Magento 2 SearchCriteria
 */
export interface MagentoSearchCriteria {
  filter_groups: MagentoFilterGroup[];
  sort_orders?: Array<{
    field: string;
    direction: "ASC" | "DESC";
  }>;
  page_size?: number;
  current_page?: number;
}

/**
 * Magento 2 Search Results
 */
export interface MagentoSearchResults<T> {
  items: T[];
  search_criteria: MagentoSearchCriteria;
  total_count: number;
}

/**
 * Magento 2 Category Response
 */
export interface MagentoCategoryResponse {
  id: number;
  parent_id: number;
  name: string;
  is_active: boolean;
  position: number;
  level: number;
  children: string;
  created_at?: string;
  updated_at?: string;
  path: string;
  include_in_menu: boolean;
  custom_attributes?: Array<{
    attribute_code: string;
    value: unknown;
  }>;
  extension_attributes?: {
    category_tree?: MagentoCategoryResponse;
  };
}

/**
 * Magento 2 Quote/Cart Response
 */
export interface MagentoQuoteResponse {
  id: number;
  store_id: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_virtual: boolean;
  items: Array<{
    item_id: number;
    sku: string;
    qty: number;
    name: string;
    price: number;
    product_type: string;
    quote_id: number;
    product_id: number;
    custom_price?: number;
    extension_attributes?: Record<string, unknown>;
  }>;
  items_count: number;
  items_qty: number;
  customer: {
    customer_id: number;
    email: string;
    firstname: string;
    lastname: string;
    is_guest?: boolean;
  };
  billing_address?: MagentoQuoteAddressResponse;
  shipping_address?: MagentoQuoteAddressResponse;
  shipping_method?: string;
  payment_method?: string;
  totals?: MagentoTotalsResponse;
  extension_attributes?: Record<string, unknown>;
}

/**
 * Magento 2 Quote Address Response
 */
export interface MagentoQuoteAddressResponse {
  id: number;
  quote_id: number;
  created_at: string;
  updated_at: string;
  customer_id?: number;
  customer_address_id?: number;
  address_type: "billing" | "shipping";
  email: string;
  firstname: string;
  lastname: string;
  middlename?: string;
  prefix?: string;
  suffix?: string;
  company?: string;
  street: string[];
  city: string;
  region_code: string;
  region_id: number;
  region: string;
  postcode: string;
  country_id: string;
  telephone: string;
  fax?: string;
  same_as_billing: number;
  customer_notes?: string;
}

/**
 * Magento 2 MSI Source Response
 */
export interface MagentoMSISourceResponse {
  source_code: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  fax?: string;
  country_id: string;
  state: string;
  region: string;
  city: string;
  street: string;
  postcode: string;
  enabled: boolean;
  use_default_carrier_config: boolean;
  carrier_links: Array<{
    carrier_code: string;
    position: number;
  }>;
}

/**
 * Magento 2 MSI Stock Response
 */
export interface MagentoMSIStockResponse {
  stock_id: number;
  name: string;
  assignment_status: number;
  is_deleted: number;
}

/**
 * Magento 2 MSI Source Item Response
 */
export interface MagentoMSISourceItemResponse {
  source_code: string;
  sku: string;
  quantity: number;
  status: number; // 0 = Out of Stock, 1 = In Stock
}

/**
 * Magento 2 MSI Reservation Response
 */
export interface MagentoMSIReservationResponse {
  reservation_id: number;
  stock_id: number;
  sku: string;
  quantity: number;
  metadata: string;
}

/**
 * Magento 2 Async Bulk Request
 */
export interface MagentoAsyncBulkRequest {
  requests: Array<{
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
  }>;
}

/**
 * Magento 2 Async Bulk Response
 */
export interface MagentoAsyncBulkResponse {
  bulk_uuid: string;
  request_items: number;
  available_operations: number;
  failed_operations: number;
  operation_status:
    | "TYPE_OBJECT"
    | "COMPLETE"
    | "RETRIABLE"
    | "NOT_RETRIABLE"
    | "OPEN";
  result_message?: string;
  errors: boolean;
  extension_attributes?: Record<string, unknown>;
}

/**
 * Magento 2 API Error Response
 */
export interface MagentoErrorResponse {
  message: string;
  errors?: Array<{
    message: string;
    parameters?: Record<string, unknown>;
  }>;
  code?: number;
  details?: Record<string, unknown>;
  trace?: string;
}
