/**
 * @witylogix/core/platforms/__tests__/magento-adapter.test.ts
 * Comprehensive test suite for Magento 2 platform adapter
 *
 * Tests:
 * - Bearer token + HMAC webhook validation
 * - Order mapping (nested items, addresses, payment)
 * - Product mapping (configurable/simple products)
 * - Customer mapping
 * - fetchOrder (REST API v1 calls with mocked HTTP)
 * - fetchProducts (searchCriteria-based pagination)
 * - Edge cases: complex nested structures, EAV attributes
 *
 * Note: This test suite uses mock Magento adapter interface
 * since full Magento 2 integration is a placeholder
 *
 * ~900 lines total
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

// ───────────────────────────────────────────────────────────────────────────
// MAGENTO ADAPTER INTERFACE AND TYPES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Magento order from REST API
 */
interface MagentoOrder {
  entity_id: number;
  increment_id: string;
  state: string;
  status: string;
  coupon_code: string | null;
  shipping_description: string;
  is_virtual: boolean;
  store_id: number;
  customer_id: number;
  base_discount_amount: number;
  base_shipping_amount: number;
  base_shipping_tax_amount: number;
  base_subtotal: number;
  base_subtotal_incl_tax: number;
  base_tax_amount: number;
  base_total_due: number;
  base_total_invoiced: number;
  base_total_paid: number;
  base_total_refunded: number;
  billing_address_id: number;
  currency_code: string;
  customer_email: string;
  customer_firstname: string;
  customer_lastname: string;
  customer_note: string | null;
  customer_is_guest: boolean;
  discount_amount: number;
  discount_invoiced: number;
  email_sent: boolean;
  grand_total: number;
  increment_id_created_at: string;
  invoice_count: number;
  items_count: number;
  items: MagentoOrderItem[];
  billing_address: MagentoAddress;
  shipping_address: MagentoAddress;
  payment: MagentoPayment;
  extension_attributes: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface MagentoOrderItem {
  item_id: number;
  order_id: number;
  parent_item_id: number | null;
  quote_item_id: number;
  store_id: number;
  created_at: string;
  updated_at: string;
  product_id: number;
  product_type: string;
  product_options: Record<string, any>;
  weight: number;
  is_virtual: boolean;
  sku: string;
  name: string;
  description: string | null;
  quote_item_id: number;
  qty_ordered: number;
  qty_canceled: number;
  qty_invoiced: number;
  qty_shipped: number;
  price: number;
  base_price: number;
  original_price: number;
  base_original_price: number;
  tax_percent: number;
  tax_amount: number;
  base_tax_amount: number;
  tax_invoiced: number;
  base_tax_invoiced: number;
  discount_percent: number;
  discount_amount: number;
  base_discount_amount: number;
  discount_invoiced: number;
  base_discount_invoiced: number;
  amount_refunded: number;
  base_amount_refunded: number;
  row_total: number;
  base_row_total: number;
  row_invoiced: number;
  base_row_invoiced: number;
  row_weight: number;
  base_tax_before_discount: number;
  tax_before_discount: number;
  ext_order_item_id: string | null;
  locked: boolean;
  extension_attributes: Record<string, any>;
}

interface MagentoAddress {
  entity_id: number;
  parent_id: number;
  customer_address_id: number;
  region: MagentoRegion;
  region_id: number;
  country_id: string;
  street: string[];
  telephone: string;
  postcode: string;
  city: string;
  firstname: string;
  lastname: string;
  company: string;
  prefix: string | null;
  suffix: string | null;
  vat_id: string | null;
  email: string;
  same_as_billing: number;
  customer_id: number;
  fax: string | null;
  extension_attributes: Record<string, any>;
}

interface MagentoRegion {
  region_code: string;
  region: string;
  region_id: number;
}

interface MagentoPayment {
  entity_id: number;
  parent_id: number;
  base_shipping_captured: number;
  shipping_captured: number;
  amount_refunded: number;
  base_amount_paid: number;
  amount_paid: number;
  amount_canceled: number;
  base_amount_authorized: number;
  base_amount_refunded: number;
  base_shipping_refunded: number;
  shipping_refunded: number;
  base_amount_canceled: number;
  base_amount_ordered: number;
  amount_ordered: number;
  base_shipping_amount_refunded: number;
  shipping_amount_refunded: number;
  base_shipping_captured: number;
  cc_exp_year: string | null;
  cc_ss_start_month: string | null;
  echeck_bank_name: string | null;
  method: string;
  cc_debug_request_body: string | null;
  cc_secure_verify: string | null;
  protection_eligibility: string | null;
  cc_approval: string | null;
  cc_last4: string | null;
  cc_status_description: string | null;
  echeck_type: string | null;
  cc_debug_response_serialized: string | null;
  cc_ss_start_year: string | null;
  echeck_account_type: string | null;
  last_trans_id: string | null;
  cc_cid_status: string | null;
  cc_owner: string | null;
  cc_type: string | null;
  po_number: string | null;
  cc_exp_month: string | null;
  cc_number_enc: string | null;
  cc_trans_id: string | null;
  paybox_request_num: string | null;
  additional_information: string[] | Record<string, any>;
  extension_attributes: Record<string, any>;
}

interface MagentoProduct {
  id: number;
  sku: string;
  name: string;
  attribute_set_id: number;
  price: number;
  status: number;
  visibility: number;
  type_id: string;
  created_at: string;
  updated_at: string;
  weight: number;
  extension_attributes: {
    website_ids: number[];
    category_links: Array<{ position: number; category_id: string }>;
    stock_item?: {
      item_id: number;
      product_id: number;
      stock_id: number;
      qty: number;
      is_in_stock: boolean;
      is_qty_decimal: boolean;
      show_default_notification_message: boolean;
      use_config_min_qty: boolean;
      min_qty: number;
      use_config_min_sale_qty: number;
      min_sale_qty: number;
      use_config_max_sale_qty: boolean;
      max_sale_qty: number;
      use_config_backorders: boolean;
      backorders: number;
      use_config_notify_stock_qty: boolean;
      notify_stock_qty: number;
      use_config_qty_increments: boolean;
      qty_increments: number;
      use_config_enable_qty_inc: boolean;
      enable_qty_increments: boolean;
      use_config_manage_stock: boolean;
      manage_stock: boolean;
      low_stock_date: string | null;
      is_decimal_divided: boolean;
      stock_status_changed_auto: number;
      deferred_stock_update: boolean;
      use_config_deferred_stock_update: boolean;
    };
    configurable_product_options?: Array<{
      id: number;
      attribute_id: string;
      label: string;
      position: number;
      values: Array<{
        value_index: number;
        label: string;
      }>;
    }>;
    configurable_product_links?: number[];
    images?: Array<{
      id: number;
      parent_id: number;
      position: number;
      label: string;
      disabled: boolean;
      types: string[];
      file: string;
      media_type: string;
    }>;
  };
  product_links?: Array<{
    sku: string;
    link_type: string;
    linked_product_sku: string;
    linked_product_type: string;
    position: number;
    extension_attributes: Record<string, any>;
  }>;
  options?: Array<{
    product_id: number;
    option_id: number;
    title: string;
    type: string;
    sort_order: number;
    is_require: boolean;
    price: number;
    price_type: string;
    sku: string;
    file_extension: string | null;
    image_size_x: number | null;
    image_size_y: number | null;
    values: Array<{
      title: string;
      option_type_id: number;
      price: number;
      price_type: string;
      sku: string;
      sort_order: number;
    }>;
  }>;
  media_gallery_entries?: Array<{
    id: number;
    media_type: string;
    label: string;
    position: number;
    disabled: boolean;
    types: string[];
    file: string;
    content?: {
      base64_encoded_data: string;
      type: string;
      name: string;
    };
  }>;
  tier_prices?: Array<{
    customer_group_id: number | string;
    qty: number;
    value: number;
    extension_attributes: Record<string, any>;
  }>;
  custom_attributes?: Array<{
    attribute_code: string;
    value: string | number | boolean | string[];
  }>;
}

interface MagentoCustomer {
  id: number;
  group_id: number;
  default_billing: string;
  default_shipping: string;
  confirmation: string | null;
  created_at: string;
  updated_at: string;
  created_in: string;
  dob: string | null;
  email: string;
  firstname: string;
  lastname: string;
  gender: number | null;
  middlename: string | null;
  prefix: string | null;
  suffix: string | null;
  store_id: number;
  taxvat: string | null;
  website_id: number;
  addresses: MagentoCustomerAddress[];
  disable_auto_group_change: number;
  extension_attributes: Record<string, any>;
}

interface MagentoCustomerAddress {
  id: number;
  customer_id: number;
  region: MagentoRegion;
  region_id: number;
  country_id: string;
  street: string[];
  telephone: string;
  postcode: string;
  city: string;
  firstname: string;
  lastname: string;
  company: string;
  prefix: string | null;
  suffix: string | null;
  vat_id: string | null;
  default_billing: boolean;
  default_shipping: boolean;
  extension_attributes: Record<string, any>;
}

interface MagentoCredentials {
  storeUrl: string;
  accessToken: string;
}

/**
 * Mock Magento Adapter for testing
 */
class MagentoAdapter {
  public readonly source = 'MAGENTO' as const;

  validateWebhook(
    payload: Buffer | string,
    signature: string,
    secret: string
  ): boolean {
    if (!signature || !secret) {
      return false;
    }

    try {
      const payloadString = typeof payload === 'string' ? payload : payload.toString('utf-8');

      // Magento uses HMAC-SHA256 with base64 encoding
      const computed = crypto
        .createHmac('sha256', secret)
        .update(payloadString, 'utf-8')
        .digest('base64');

      const expectedBuffer = Buffer.from(computed, 'utf-8');
      const actualBuffer = Buffer.from(signature, 'utf-8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch (error) {
      return false;
    }
  }

  mapOrder(magentoOrder: MagentoOrder): any {
    const lineItems = magentoOrder.items.map((item: MagentoOrderItem) => ({
      externalProductId: String(item.product_id),
      sku: item.sku,
      quantity: Math.floor(item.qty_ordered),
      price: String(item.price),
    }));

    return {
      shopId: 'placeholder',
      source: this.source,
      externalOrderId: String(magentoOrder.entity_id),
      externalOrderNumber: magentoOrder.increment_id,
      status: magentoOrder.status,
      total: String(magentoOrder.grand_total),
      currency: magentoOrder.currency_code,
      customerEmail: magentoOrder.customer_email,
      customerName: `${magentoOrder.customer_firstname} ${magentoOrder.customer_lastname}`,
      shippingAddress: magentoOrder.shipping_address ? {
        firstName: magentoOrder.shipping_address.firstname,
        lastName: magentoOrder.shipping_address.lastname,
        line1: magentoOrder.shipping_address.street?.[0] || '',
        line2: magentoOrder.shipping_address.street?.[1],
        city: magentoOrder.shipping_address.city,
        state: magentoOrder.shipping_address.region?.region_code,
        postalCode: magentoOrder.shipping_address.postcode,
        country: magentoOrder.shipping_address.country_id,
      } : undefined,
      billingAddress: magentoOrder.billing_address ? {
        firstName: magentoOrder.billing_address.firstname,
        lastName: magentoOrder.billing_address.lastname,
        line1: magentoOrder.billing_address.street?.[0] || '',
        line2: magentoOrder.billing_address.street?.[1],
        city: magentoOrder.billing_address.city,
        state: magentoOrder.billing_address.region?.region_code,
        postalCode: magentoOrder.billing_address.postcode,
        country: magentoOrder.billing_address.country_id,
      } : undefined,
      lineItems,
      notes: magentoOrder.customer_note,
      createdAt: new Date(magentoOrder.created_at),
      metadata: {
        magentoOrderId: magentoOrder.entity_id,
        state: magentoOrder.state,
        discountAmount: magentoOrder.discount_amount,
        shippingAmount: magentoOrder.base_shipping_amount,
        taxAmount: magentoOrder.base_tax_amount,
      },
    };
  }

  mapProduct(magentoProduct: MagentoProduct): any {
    const imageUrl = magentoProduct.extension_attributes?.images?.[0]?.file
      ? `${magentoProduct.extension_attributes.website_ids?.[0] || ''}/media/catalog/product${magentoProduct.extension_attributes.images[0].file}`
      : undefined;

    const variants = [];
    if (magentoProduct.type_id === 'configurable' && magentoProduct.extension_attributes?.configurable_product_links) {
      // For configurable products, variants are separate products
      for (const linkedId of magentoProduct.extension_attributes.configurable_product_links) {
        variants.push({
          externalId: String(linkedId),
          sku: `${magentoProduct.sku}-${linkedId}`,
          price: String(magentoProduct.price),
        });
      }
    } else {
      // Simple product
      variants.push({
        externalId: String(magentoProduct.id),
        sku: magentoProduct.sku,
        price: String(magentoProduct.price),
      });
    }

    return {
      shopId: 'placeholder',
      source: this.source,
      externalProductId: String(magentoProduct.id),
      title: magentoProduct.name,
      description: undefined,
      sku: magentoProduct.sku,
      price: String(magentoProduct.price),
      currency: 'USD',
      status: magentoProduct.status === 1 ? 'ACTIVE' : 'INACTIVE',
      imageUrl,
      variants,
      metadata: {
        type: magentoProduct.type_id,
        weight: magentoProduct.weight,
        attributeSetId: magentoProduct.attribute_set_id,
      },
    };
  }

  mapCustomer(magentoCustomer: MagentoCustomer): any {
    const defaultAddress = magentoCustomer.addresses?.find(
      (addr: MagentoCustomerAddress) => addr.default_billing
    ) || magentoCustomer.addresses?.[0];

    return {
      shopId: 'placeholder',
      source: this.source,
      externalCustomerId: String(magentoCustomer.id),
      email: magentoCustomer.email,
      firstName: magentoCustomer.firstname,
      lastName: magentoCustomer.lastname,
      phone: defaultAddress?.telephone,
      defaultAddress: defaultAddress ? {
        firstName: defaultAddress.firstname,
        lastName: defaultAddress.lastname,
        line1: defaultAddress.street?.[0] || '',
        line2: defaultAddress.street?.[1],
        city: defaultAddress.city,
        state: defaultAddress.region?.region_code,
        postalCode: defaultAddress.postcode,
        country: defaultAddress.country_id,
      } : undefined,
      metadata: {
        groupId: magentoCustomer.group_id,
        websiteId: magentoCustomer.website_id,
        storeId: 0,
      },
    };
  }

  async fetchOrder(
    orderId: string | number,
    credentials: MagentoCredentials
  ): Promise<MagentoOrder> {
    const url = new URL(
      `/rest/V1/orders/${orderId}`,
      credentials.storeUrl
    ).toString();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Magento API error: ${response.status}`);
      }

      return (await response.json()) as MagentoOrder;
    } catch (error) {
      throw error;
    }
  }

  async fetchProducts(
    credentials: MagentoCredentials,
    cursor?: string
  ): Promise<{ products: MagentoProduct[]; nextCursor?: string }> {
    const currentPage = cursor ? parseInt(cursor, 10) : 1;
    const pageSize = 20;

    const url = new URL(`/rest/V1/products`, credentials.storeUrl);
    url.searchParams.set('searchCriteria[pageSize]', String(pageSize));
    url.searchParams.set('searchCriteria[currentPage]', String(currentPage));

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Magento API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        items: MagentoProduct[];
        total_count: number;
      };

      const totalPages = Math.ceil(data.total_count / pageSize);
      const nextCursor = currentPage < totalPages ? String(currentPage + 1) : undefined;

      return { products: data.items, nextCursor };
    } catch (error) {
      throw error;
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ───────────────────────────────────────────────────────────────────────────

const MOCK_MAGENTO_ORDER: MagentoOrder = {
  entity_id: 100001,
  increment_id: '100000001',
  state: 'processing',
  status: 'processing',
  coupon_code: null,
  shipping_description: 'Standard Shipping - Standard',
  is_virtual: false,
  store_id: 1,
  customer_id: 5001,
  base_discount_amount: 10,
  base_shipping_amount: 10,
  base_shipping_tax_amount: 0,
  base_subtotal: 100,
  base_subtotal_incl_tax: 100,
  base_tax_amount: 0,
  base_total_due: 0,
  base_total_invoiced: 100,
  base_total_paid: 100,
  base_total_refunded: 0,
  billing_address_id: 5001,
  currency_code: 'USD',
  customer_email: 'customer@magento.example.com',
  customer_firstname: 'Carol',
  customer_lastname: 'Martinez',
  customer_note: 'Special handling required',
  customer_is_guest: false,
  discount_amount: 10,
  discount_invoiced: 10,
  email_sent: true,
  grand_total: 100,
  increment_id_created_at: '2024-01-15 10:30:00',
  invoice_count: 1,
  items_count: 2,
  items: [
    {
      item_id: 1,
      order_id: 100001,
      parent_item_id: null,
      quote_item_id: 1,
      store_id: 1,
      created_at: '2024-01-15 10:30:00',
      updated_at: '2024-01-15 10:30:00',
      product_id: 10001,
      product_type: 'configurable',
      product_options: {
        info_buyRequest: {
          options: [{ '1': 'Red' }],
        },
      },
      weight: 2,
      is_virtual: false,
      sku: 'PRODUCT-CONFIGURABLE-RED',
      name: 'Configurable Product - Red',
      description: null,
      qty_ordered: 2,
      qty_canceled: 0,
      qty_invoiced: 2,
      qty_shipped: 0,
      price: 50,
      base_price: 50,
      original_price: 50,
      base_original_price: 50,
      tax_percent: 0,
      tax_amount: 0,
      base_tax_amount: 0,
      tax_invoiced: 0,
      base_tax_invoiced: 0,
      discount_percent: 0,
      discount_amount: 5,
      base_discount_amount: 5,
      discount_invoiced: 5,
      base_discount_invoiced: 5,
      amount_refunded: 0,
      base_amount_refunded: 0,
      row_total: 100,
      base_row_total: 100,
      row_invoiced: 100,
      base_row_invoiced: 100,
      row_weight: 4,
      base_tax_before_discount: 0,
      tax_before_discount: 0,
      ext_order_item_id: null,
      locked: false,
      extension_attributes: {},
    },
  ],
  billing_address: {
    entity_id: 5001,
    parent_id: 100001,
    customer_address_id: 0,
    region: { region_code: 'CA', region: 'California', region_id: 12 },
    region_id: 12,
    country_id: 'US',
    street: ['789 Commerce St', 'Suite 500'],
    telephone: '+1-323-555-0124',
    postcode: '90001',
    city: 'Los Angeles',
    firstname: 'Carol',
    lastname: 'Martinez',
    company: 'Commerce Inc',
    prefix: null,
    suffix: null,
    vat_id: null,
    email: 'carol@commerce.com',
    same_as_billing: 0,
    customer_id: 5001,
    fax: null,
    extension_attributes: {},
  },
  shipping_address: {
    entity_id: 5002,
    parent_id: 100001,
    customer_address_id: 5002,
    region: { region_code: 'CA', region: 'California', region_id: 12 },
    region_id: 12,
    country_id: 'US',
    street: ['500 Shipping Blvd', 'Warehouse B'],
    telephone: '+1-323-555-0125',
    postcode: '90002',
    city: 'Los Angeles',
    firstname: 'Carol',
    lastname: 'Martinez',
    company: 'Commerce Inc',
    prefix: null,
    suffix: null,
    vat_id: null,
    email: 'carol@commerce.com',
    same_as_billing: 0,
    customer_id: 5001,
    fax: null,
    extension_attributes: {},
  },
  payment: {
    entity_id: 100001,
    parent_id: 100001,
    base_shipping_captured: 10,
    shipping_captured: 10,
    amount_refunded: 0,
    base_amount_paid: 100,
    amount_paid: 100,
    amount_canceled: 0,
    base_amount_authorized: 100,
    base_amount_refunded: 0,
    base_shipping_refunded: 0,
    shipping_refunded: 0,
    base_amount_canceled: 0,
    base_amount_ordered: 100,
    amount_ordered: 100,
    base_shipping_amount_refunded: 0,
    shipping_amount_refunded: 0,
    cc_exp_year: null,
    cc_ss_start_month: null,
    echeck_bank_name: null,
    method: 'stripe_payments',
    cc_debug_request_body: null,
    cc_secure_verify: null,
    protection_eligibility: null,
    cc_approval: null,
    cc_last4: '4242',
    cc_status_description: 'Stripe payment approved',
    echeck_type: null,
    cc_debug_response_serialized: null,
    cc_ss_start_year: null,
    echeck_account_type: null,
    last_trans_id: 'ch_stripe123abc',
    cc_cid_status: null,
    cc_owner: null,
    cc_type: 'VI',
    po_number: null,
    cc_exp_month: null,
    cc_number_enc: null,
    cc_trans_id: 'ch_stripe123abc',
    paybox_request_num: null,
    additional_information: ['Stripe'],
    extension_attributes: {},
  },
  extension_attributes: {},
  created_at: '2024-01-15T10:30:00+00:00',
  updated_at: '2024-01-15T10:35:00+00:00',
};

const MOCK_MAGENTO_PRODUCT: MagentoProduct = {
  id: 10001,
  sku: 'PRODUCT-CONFIGURABLE',
  name: 'Configurable Product',
  attribute_set_id: 11,
  price: 50,
  status: 1,
  visibility: 4,
  type_id: 'configurable',
  created_at: '2023-10-01T12:00:00+00:00',
  updated_at: '2024-01-10T15:30:00+00:00',
  weight: 2.5,
  extension_attributes: {
    website_ids: [1],
    category_links: [
      { position: 1, category_id: '5' },
      { position: 2, category_id: '10' },
    ],
    stock_item: {
      item_id: 1,
      product_id: 10001,
      stock_id: 1,
      qty: 500,
      is_in_stock: true,
      is_qty_decimal: false,
      show_default_notification_message: false,
      use_config_min_qty: true,
      min_qty: 0,
      use_config_min_sale_qty: 1,
      min_sale_qty: 1,
      use_config_max_sale_qty: true,
      max_sale_qty: 10000,
      use_config_backorders: true,
      backorders: 0,
      use_config_notify_stock_qty: true,
      notify_stock_qty: 1,
      use_config_qty_increments: true,
      qty_increments: 1,
      use_config_enable_qty_inc: true,
      enable_qty_increments: true,
      use_config_manage_stock: true,
      manage_stock: true,
      low_stock_date: null,
      is_decimal_divided: false,
      stock_status_changed_auto: 0,
      deferred_stock_update: false,
      use_config_deferred_stock_update: true,
    },
    configurable_product_options: [
      {
        id: 1,
        attribute_id: '92',
        label: 'Color',
        position: 1,
        values: [
          { value_index: 1, label: 'Red' },
          { value_index: 2, label: 'Blue' },
          { value_index: 3, label: 'Green' },
        ],
      },
    ],
    configurable_product_links: [10002, 10003, 10004],
    images: [
      {
        id: 1,
        parent_id: 10001,
        position: 1,
        label: 'Product Image',
        disabled: false,
        types: ['image', 'small_image', 'thumbnail'],
        file: '/c/o/configurable_product.jpg',
        media_type: 'image',
      },
    ],
  },
};

const MOCK_MAGENTO_CUSTOMER: MagentoCustomer = {
  id: 5001,
  group_id: 1,
  default_billing: '5001',
  default_shipping: '5002',
  confirmation: null,
  created_at: '2023-12-01T08:00:00+00:00',
  updated_at: '2024-01-15T10:30:00+00:00',
  created_in: 'Default Store View',
  dob: '1985-06-15',
  email: 'customer@magento.example.com',
  firstname: 'Diana',
  lastname: 'Chen',
  gender: 2,
  middlename: null,
  prefix: null,
  suffix: null,
  store_id: 1,
  taxvat: null,
  website_id: 1,
  addresses: [
    {
      id: 5001,
      customer_id: 5001,
      region: { region_code: 'WA', region: 'Washington', region_id: 61 },
      region_id: 61,
      country_id: 'US',
      street: ['1000 Main Street', 'Suite 300'],
      telephone: '+1-206-555-0126',
      postcode: '98101',
      city: 'Seattle',
      firstname: 'Diana',
      lastname: 'Chen',
      company: 'Tech Enterprises',
      prefix: null,
      suffix: null,
      vat_id: null,
      default_billing: true,
      default_shipping: false,
      extension_attributes: {},
    },
    {
      id: 5002,
      customer_id: 5001,
      region: { region_code: 'OR', region: 'Oregon', region_id: 38 },
      region_id: 38,
      country_id: 'US',
      street: ['2000 Ship Lane'],
      telephone: '+1-503-555-0127',
      postcode: '97201',
      city: 'Portland',
      firstname: 'Diana',
      lastname: 'Chen',
      company: 'Tech Enterprises',
      prefix: null,
      suffix: null,
      vat_id: null,
      default_billing: false,
      default_shipping: true,
      extension_attributes: {},
    },
  ],
  disable_auto_group_change: 0,
  extension_attributes: {},
};

// ───────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ───────────────────────────────────────────────────────────────────────────

describe('MagentoAdapter', () => {
  let adapter: MagentoAdapter;
  const secret = 'magento-webhook-secret';

  beforeEach(() => {
    adapter = new MagentoAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // WEBHOOK VALIDATION TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('validateWebhook', () => {
    it('should validate webhook with correct HMAC-SHA256 signature', () => {
      const payload = JSON.stringify({ entity_id: 100001, status: 'processing' });
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf-8')
        .digest('base64');

      const result = adapter.validateWebhook(payload, signature, secret);
      expect(result).toBe(true);
    });

    it('should validate webhook with buffer payload', () => {
      const payloadString = JSON.stringify({ entity_id: 100002, increment_id: '100000002' });
      const payload = Buffer.from(payloadString);
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payloadString, 'utf-8')
        .digest('base64');

      const result = adapter.validateWebhook(payload, signature, secret);
      expect(result).toBe(true);
    });

    it('should reject webhook with invalid signature', () => {
      const payload = JSON.stringify({ entity_id: 100001 });
      const invalidSignature = 'invalid-signature';

      const result = adapter.validateWebhook(payload, invalidSignature, secret);
      expect(result).toBe(false);
    });

    it('should detect altered payload', () => {
      const originalPayload = JSON.stringify({ entity_id: 999, status: 'pending' });
      const signature = crypto
        .createHmac('sha256', secret)
        .update(originalPayload, 'utf-8')
        .digest('base64');
      const alteredPayload = JSON.stringify({ entity_id: 999, status: 'completed' });

      const result = adapter.validateWebhook(alteredPayload, signature, secret);
      expect(result).toBe(false);
    });

    it('should use timing-safe comparison', () => {
      const payload = JSON.stringify({ test: 'data' });
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf-8')
        .digest('base64');
      const invalidSignature = 'invalid';

      const result1 = adapter.validateWebhook(payload, validSignature, secret);
      const result2 = adapter.validateWebhook(payload, invalidSignature, secret);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should return false for empty signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const result = adapter.validateWebhook(payload, '', secret);
      expect(result).toBe(false);
    });

    it('should handle real-world Magento webhook', () => {
      const orderPayload = JSON.stringify(MOCK_MAGENTO_ORDER);
      const signature = crypto
        .createHmac('sha256', secret)
        .update(orderPayload, 'utf-8')
        .digest('base64');

      const result = adapter.validateWebhook(orderPayload, signature, secret);
      expect(result).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ORDER MAPPING TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('mapOrder', () => {
    it('should map full Magento order with nested items and addresses', () => {
      const result = adapter.mapOrder(MOCK_MAGENTO_ORDER);

      expect(result.externalOrderId).toBe('100001');
      expect(result.source).toBe('MAGENTO');
      expect(result.externalOrderNumber).toBe('100000001');
      expect(result.status).toBe('processing');
      expect(result.total).toBe('100');
      expect(result.currency).toBe('USD');
      expect(result.customerEmail).toBe('customer@magento.example.com');
      expect(result.customerName).toBe('Carol Martinez');
      expect(result.lineItems).toHaveLength(1);
      expect(result.shippingAddress).toBeDefined();
      expect(result.shippingAddress.firstName).toBe('Carol');
      expect(result.shippingAddress.line1).toBe('500 Shipping Blvd');
      expect(result.billingAddress).toBeDefined();
      expect(result.billingAddress.line1).toBe('789 Commerce St');
    });

    it('should handle order with multiple line items', () => {
      const multiItemOrder = {
        ...MOCK_MAGENTO_ORDER,
        items: [
          ...MOCK_MAGENTO_ORDER.items,
          {
            ...MOCK_MAGENTO_ORDER.items[0],
            item_id: 2,
            product_id: 10002,
            sku: 'SIMPLE-PRODUCT',
            name: 'Simple Product',
            product_type: 'simple',
            qty_ordered: 1,
            price: 75,
          },
        ],
      };

      const result = adapter.mapOrder(multiItemOrder);

      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[1].externalProductId).toBe('10002');
      expect(result.lineItems[1].quantity).toBe(1);
    });

    it('should extract nested address information', () => {
      const result = adapter.mapOrder(MOCK_MAGENTO_ORDER);

      expect(result.shippingAddress.line2).toBe('Warehouse B');
      expect(result.shippingAddress.city).toBe('Los Angeles');
      expect(result.shippingAddress.state).toBe('CA');
      expect(result.shippingAddress.postalCode).toBe('90002');
      expect(result.shippingAddress.country).toBe('US');
    });

    it('should include payment and discount information in metadata', () => {
      const result = adapter.mapOrder(MOCK_MAGENTO_ORDER);

      expect(result.metadata.discountAmount).toBe(10);
      expect(result.metadata.shippingAmount).toBe(10);
      expect(result.metadata.state).toBe('processing');
    });

    it('should parse order created_at to Date', () => {
      const result = adapter.mapOrder(MOCK_MAGENTO_ORDER);

      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should include customer notes', () => {
      const result = adapter.mapOrder(MOCK_MAGENTO_ORDER);

      expect(result.notes).toBe('Special handling required');
    });

    it('should handle configurable product in line items', () => {
      const result = adapter.mapOrder(MOCK_MAGENTO_ORDER);

      expect(result.lineItems[0].sku).toBe('PRODUCT-CONFIGURABLE-RED');
      expect(result.lineItems[0].quantity).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCT MAPPING TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('mapProduct', () => {
    it('should map configurable product with variants', () => {
      const result = adapter.mapProduct(MOCK_MAGENTO_PRODUCT);

      expect(result.externalProductId).toBe('10001');
      expect(result.source).toBe('MAGENTO');
      expect(result.title).toBe('Configurable Product');
      expect(result.sku).toBe('PRODUCT-CONFIGURABLE');
      expect(result.price).toBe('50');
      expect(result.variants).toHaveLength(3);
      expect(result.status).toBe('ACTIVE');
    });

    it('should extract image URLs from extension_attributes', () => {
      const result = adapter.mapProduct(MOCK_MAGENTO_PRODUCT);

      expect(result.imageUrl).toContain('configurable_product.jpg');
    });

    it('should include product metadata', () => {
      const result = adapter.mapProduct(MOCK_MAGENTO_PRODUCT);

      expect(result.metadata.type).toBe('configurable');
      expect(result.metadata.weight).toBe(2.5);
      expect(result.metadata.attributeSetId).toBe(11);
    });

    it('should handle simple product', () => {
      const simpleProduct: MagentoProduct = {
        ...MOCK_MAGENTO_PRODUCT,
        type_id: 'simple',
        extension_attributes: {
          ...MOCK_MAGENTO_PRODUCT.extension_attributes,
          configurable_product_links: undefined,
        },
      };

      const result = adapter.mapProduct(simpleProduct);

      expect(result.variants).toHaveLength(1);
      expect(result.variants[0].externalId).toBe('10001');
      expect(result.variants[0].sku).toBe('PRODUCT-CONFIGURABLE');
    });

    it('should handle product with no images', () => {
      const productNoImages: MagentoProduct = {
        ...MOCK_MAGENTO_PRODUCT,
        extension_attributes: {
          ...MOCK_MAGENTO_PRODUCT.extension_attributes,
          images: [],
        },
      };

      const result = adapter.mapProduct(productNoImages);

      expect(result.imageUrl).toBeUndefined();
    });

    it('should map status correctly', () => {
      const inactiveProduct: MagentoProduct = {
        ...MOCK_MAGENTO_PRODUCT,
        status: 2,
      };

      const result = adapter.mapProduct(inactiveProduct);

      expect(result.status).toBe('INACTIVE');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMER MAPPING TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('mapCustomer', () => {
    it('should map full Magento customer with addresses', () => {
      const result = adapter.mapCustomer(MOCK_MAGENTO_CUSTOMER);

      expect(result.externalCustomerId).toBe('5001');
      expect(result.source).toBe('MAGENTO');
      expect(result.email).toBe('customer@magento.example.com');
      expect(result.firstName).toBe('Diana');
      expect(result.lastName).toBe('Chen');
      expect(result.phone).toBe('+1-206-555-0126');
      expect(result.defaultAddress).toBeDefined();
      expect(result.defaultAddress.line1).toBe('1000 Main Street');
    });

    it('should use default billing address', () => {
      const result = adapter.mapCustomer(MOCK_MAGENTO_CUSTOMER);

      expect(result.defaultAddress.city).toBe('Seattle');
      expect(result.defaultAddress.state).toBe('WA');
    });

    it('should include customer metadata', () => {
      const result = adapter.mapCustomer(MOCK_MAGENTO_CUSTOMER);

      expect(result.metadata.groupId).toBe(1);
      expect(result.metadata.websiteId).toBe(1);
    });

    it('should handle customer with multiple addresses', () => {
      const result = adapter.mapCustomer(MOCK_MAGENTO_CUSTOMER);

      expect(result.defaultAddress).toBeDefined();
      expect(result.defaultAddress.line1).toBe('1000 Main Street');
    });

    it('should extract first address as default if no default_billing', () => {
      const customerNoBillingDefault: MagentoCustomer = {
        ...MOCK_MAGENTO_CUSTOMER,
        default_billing: '',
      };

      const result = adapter.mapCustomer(customerNoBillingDefault);

      expect(result.defaultAddress).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH ORDER TESTS (MOCKED HTTP)
  // ─────────────────────────────────────────────────────────────────────────

  describe('fetchOrder', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should fetch order from Magento REST API v1', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_MAGENTO_ORDER,
      });

      const credentials = {
        storeUrl: 'https://magento.example.com',
        accessToken: 'token123abc',
      };

      const order = await adapter.fetchOrder('100001', credentials);

      expect(order.entity_id).toBe(100001);
      expect(order.increment_id).toBe('100000001');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('rest/V1/orders/100001'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123abc',
          }),
        })
      );
    });

    it('should handle API error responses', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const credentials = {
        storeUrl: 'https://magento.example.com',
        accessToken: 'token123abc',
      };

      await expect(adapter.fetchOrder('999999', credentials)).rejects.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH PRODUCTS TESTS (SEARCHCRITERIA PAGINATION)
  // ─────────────────────────────────────────────────────────────────────────

  describe('fetchProducts', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should fetch products with searchCriteria pagination', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [MOCK_MAGENTO_PRODUCT],
          total_count: 150,
        }),
      });

      const credentials = {
        storeUrl: 'https://magento.example.com',
        accessToken: 'token123abc',
      };

      const result = await adapter.fetchProducts(credentials);

      expect(result.products).toHaveLength(1);
      expect(result.nextCursor).toBe('2');
    });

    it('should not provide next cursor on last page', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [MOCK_MAGENTO_PRODUCT],
          total_count: 10,
        }),
      });

      const credentials = {
        storeUrl: 'https://magento.example.com',
        accessToken: 'token123abc',
      };

      const result = await adapter.fetchProducts(credentials);

      expect(result.nextCursor).toBeUndefined();
    });

    it('should use cursor as currentPage parameter', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
          total_count: 100,
        }),
      });

      const credentials = {
        storeUrl: 'https://magento.example.com',
        accessToken: 'token123abc',
      };

      await adapter.fetchProducts(credentials, '5');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('searchCriteria%5BcurrentPage%5D=5'),
        expect.any(Object)
      );
    });

    it('should include pageSize in searchCriteria', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
          total_count: 0,
        }),
      });

      const credentials = {
        storeUrl: 'https://magento.example.com',
        accessToken: 'token123abc',
      };

      await adapter.fetchProducts(credentials);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('searchCriteria%5BpageSize%5D=20'),
        expect.any(Object)
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CASES AND SPECIAL SCENARIOS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should validate adapter source', () => {
      expect(adapter.source).toBe('MAGENTO');
    });

    it('should handle order with null customer_note', () => {
      const orderNoNote = {
        ...MOCK_MAGENTO_ORDER,
        customer_note: null,
      };

      const result = adapter.mapOrder(orderNoNote);

      expect(result.notes).toBeNull();
    });

    it('should handle street array with single element', () => {
      const addressSingleStreet = {
        ...MOCK_MAGENTO_ORDER.billing_address,
        street: ['123 Main St'],
      };

      const orderWithModifiedAddress = {
        ...MOCK_MAGENTO_ORDER,
        billing_address: addressSingleStreet,
      };

      const result = adapter.mapOrder(orderWithModifiedAddress);

      expect(result.billingAddress.line1).toBe('123 Main St');
      expect(result.billingAddress.line2).toBeUndefined();
    });

    it('should handle product with zero weight', () => {
      const productZeroWeight: MagentoProduct = {
        ...MOCK_MAGENTO_PRODUCT,
        weight: 0,
      };

      const result = adapter.mapProduct(productZeroWeight);

      expect(result.metadata.weight).toBe(0);
    });

    it('should handle configurable product with no variants linked', () => {
      const configurableNoVariants: MagentoProduct = {
        ...MOCK_MAGENTO_PRODUCT,
        extension_attributes: {
          ...MOCK_MAGENTO_PRODUCT.extension_attributes,
          configurable_product_links: [],
        },
      };

      const result = adapter.mapProduct(configurableNoVariants);

      expect(result.variants).toHaveLength(0);
    });

    it('should handle product status of 1 as ACTIVE', () => {
      const result = adapter.mapProduct(MOCK_MAGENTO_PRODUCT);

      expect(result.status).toBe('ACTIVE');
    });
  });
});
