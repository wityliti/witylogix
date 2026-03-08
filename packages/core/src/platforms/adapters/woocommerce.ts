/**
 * WooCommerce REST API v3 Platform Adapter
 *
 * Implements PlatformAdapter interface for WooCommerce, handling:
 * - HMAC-SHA256 webhook validation
 * - Order, product, and customer data mapping
 * - REST API v3 fetching with pagination
 *
 * WooCommerce REST API v3:
 *   Base URL: https://{site}/wp-json/wc/v3/
 *   Auth: Basic Auth with consumer_key + consumer_secret
 */

import crypto from 'crypto';

/**
 * WooCommerce order from REST API v3
 */
export interface WooCommerceOrder {
  id: number;
  parent_id: number;
  number: string;
  order_key: string;
  created_via: string;
  version: string;
  status: string;
  currency: string;
  date_created: string;
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
  customer_ip_address: string;
  customer_user_agent: string;
  customer_note: string;
  billing: WooCommerceAddress;
  shipping: WooCommerceAddress;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  date_paid: string | null;
  date_completed: string | null;
  cart_hash: string;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
  line_items: Array<WooCommerceLineItem>;
  tax_lines: Array<unknown>;
  shipping_lines: Array<unknown>;
  fee_lines: Array<unknown>;
  coupon_lines: Array<unknown>;
  refunds: Array<unknown>;
  payment_url: string;
  customer_note_html?: string;
  _links: Record<string, unknown>;
}

export interface WooCommerceAddress {
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

export interface WooCommerceLineItem {
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
  taxes: Array<unknown>;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
  sku: string;
  price: string;
  image: { id: number; src: string };
  parent_name: string;
  _links: Record<string, unknown>;
}

export interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  type: string;
  status: string;
  featured: boolean;
  catalog_visibility: string;
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
  downloads: Array<unknown>;
  download_limit: number;
  download_expiry: number;
  external_url: string;
  button_text: string;
  tax_status: string;
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string;
  backorders: string;
  backorders_allowed: boolean;
  backordered: boolean;
  sold_individually: boolean;
  weight: string;
  dimensions: { length: string; width: string; height: string };
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
  categories: Array<{ id: number; name: string; slug: string }>;
  tags: Array<{ id: number; name: string; slug: string }>;
  images: Array<WooCommerceImage>;
  attributes: Array<{ id: number; name: string; position: number; visible: boolean; variation: boolean; options: string[] }>;
  default_attributes: Array<{ id: number; name: string; option: string }>;
  variations: number[];
  grouped_products: number[];
  menu_order: number;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
  _links: Record<string, unknown>;
}

export interface WooCommerceImage {
  id: number;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  src: string;
  name: string;
  alt: string;
}

export interface WooCommerceCustomer {
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
  billing: WooCommerceAddress;
  shipping: WooCommerceAddress;
  is_paying_customer: boolean;
  avatar_url: string;
  meta_data: Array<{ id: number; key: string; value: unknown }>;
  _links: Record<string, unknown>;
}

/**
 * Create order input (normalized from platform-specific data)
 */
export interface CreateOrderInput {
  externalOrderId: string;
  source: string;
  email: string;
  currency: string;
  totalPrice: number;
  subtotalPrice: number;
  totalTax: number;
  totalWeight: number;
  financialStatus: string;
  fulfillmentStatus: string;
  lineItems: Array<{
    id: string;
    productId: string;
    variantId: string;
    title: string;
    quantity: number;
    price: number;
    sku: string;
  }>;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    country: string;
    postalCode: string;
    phone?: string;
  };
  createdAt: Date;
}

/**
 * Create product input (normalized from platform-specific data)
 */
export interface CreateProductInput {
  externalProductId: string;
  source: string;
  title: string;
  vendor?: string;
  productType?: string;
  handle?: string;
  tags: string[];
  variants: Array<{
    id: string;
    sku: string;
    barcode?: string;
    title: string;
    inventoryQuantity: number;
    weight: number;
    price: string;
  }>;
  collections?: string[];
}

/**
 * Create customer input (normalized from platform-specific data)
 */
export interface CreateCustomerInput {
  externalCustomerId: string;
  source: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  billingAddress?: {
    address1: string;
    address2?: string;
    city: string;
    province: string;
    country: string;
    postalCode: string;
  };
  shippingAddress?: {
    address1: string;
    address2?: string;
    city: string;
    province: string;
    country: string;
    postalCode: string;
  };
}

/**
 * Credentials for WooCommerce REST API authentication
 */
export interface WooCommerceCredentials {
  siteUrl: string; // e.g., https://mystore.com
  consumerKey: string;
  consumerSecret: string;
  webhookSecret?: string; // Optional, for webhook validation
}

/**
 * WooCommerce REST API v3 adapter
 */
export class WooCommerceAdapter {
  public readonly source = 'WOOCOMMERCE' as const;

  /**
   * Validate WooCommerce webhook signature
   * Uses HMAC-SHA256 with the webhook secret
   * Signature header: X-WC-Webhook-Signature (base64 encoded)
   *
   * @param payload Raw request body as string or buffer
   * @param signature X-WC-Webhook-Signature header value
   * @param secret Webhook secret from WooCommerce settings
   * @returns true if signature is valid
   */
  validateWebhook(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): boolean {
    if (!signature || !secret) {
      return false;
    }

    try {
      const payloadString = typeof payload === 'string' ? payload : payload.toString('utf-8');

      // WooCommerce HMAC is base64(hmac-sha256(payload, secret))
      const computed = crypto
        .createHmac('sha256', secret)
        .update(payloadString, 'utf-8')
        .digest('base64');

      // Timing-safe comparison
      const expectedBuffer = Buffer.from(computed, 'utf-8');
      const actualBuffer = Buffer.from(signature, 'utf-8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch (error) {
      console.error('[WooCommerceAdapter] Error validating webhook:', error);
      return false;
    }
  }

  /**
   * Map WooCommerce order to CreateOrderInput
   *
   * @param wcOrder WooCommerce order from REST API
   * @returns Normalized order input
   */
  mapOrder(wcOrder: WooCommerceOrder): CreateOrderInput {
    // Determine financial status based on payment and order status
    let financialStatus = 'pending';
    if (wcOrder.date_paid) {
      financialStatus = 'paid';
    } else if (wcOrder.status === 'refunded') {
      financialStatus = 'refunded';
    } else if (wcOrder.status === 'cancelled') {
      financialStatus = 'voided';
    }

    // Determine fulfillment status
    let fulfillmentStatus = 'unshipped';
    if (wcOrder.status === 'completed') {
      fulfillmentStatus = 'fulfilled';
    } else if (wcOrder.status === 'processing') {
      fulfillmentStatus = 'partial';
    }

    return {
      externalOrderId: String(wcOrder.id),
      source: this.source,
      email: wcOrder.billing.email || '',
      currency: wcOrder.currency,
      totalPrice: parseFloat(wcOrder.total),
      subtotalPrice: parseFloat(wcOrder.total) - parseFloat(wcOrder.total_tax),
      totalTax: parseFloat(wcOrder.total_tax),
      totalWeight: 0, // WooCommerce doesn't provide total weight directly
      financialStatus,
      fulfillmentStatus,
      lineItems: wcOrder.line_items.map((item) => ({
        id: String(item.id),
        productId: String(item.product_id),
        variantId: String(item.variation_id || item.product_id),
        title: item.name,
        quantity: item.quantity,
        price: parseFloat(item.total),
        sku: item.sku,
      })),
      shippingAddress: {
        firstName: wcOrder.shipping.first_name,
        lastName: wcOrder.shipping.last_name,
        address1: wcOrder.shipping.address_1,
        address2: wcOrder.shipping.address_2 || undefined,
        city: wcOrder.shipping.city,
        province: wcOrder.shipping.state,
        country: wcOrder.shipping.country,
        postalCode: wcOrder.shipping.postcode,
        phone: wcOrder.shipping.phone || undefined,
      },
      createdAt: new Date(wcOrder.date_created),
    };
  }

  /**
   * Map WooCommerce product to CreateProductInput
   *
   * @param wcProduct WooCommerce product from REST API
   * @returns Normalized product input
   */
  mapProduct(wcProduct: WooCommerceProduct): CreateProductInput {
    // Extract tags from product tags
    const tags = wcProduct.tags?.map((t) => t.name) || [];

    // Extract categories as collections
    const collections = wcProduct.categories?.map((c) => c.slug) || [];

    // Build variants array (for simple products, we create a single variant)
    const variants = [];
    if (wcProduct.type === 'simple' || wcProduct.type === 'external') {
      variants.push({
        id: String(wcProduct.id),
        sku: wcProduct.sku,
        barcode: undefined,
        title: wcProduct.name,
        inventoryQuantity: wcProduct.stock_quantity ?? 0,
        weight: parseFloat(wcProduct.weight) || 0,
        price: wcProduct.price || '0',
      });
    } else if (wcProduct.type === 'variable' && wcProduct.variations?.length) {
      // For variable products, variations would need to be fetched separately
      // For now, create a placeholder
      for (const variationId of wcProduct.variations) {
        variants.push({
          id: String(variationId),
          sku: `${wcProduct.sku}-${variationId}`,
          barcode: undefined,
          title: `${wcProduct.name} - Variant`,
          inventoryQuantity: 0,
          weight: parseFloat(wcProduct.weight) || 0,
          price: wcProduct.price || '0',
        });
      }
    }

    return {
      externalProductId: String(wcProduct.id),
      source: this.source,
      title: wcProduct.name,
      vendor: undefined, // WooCommerce doesn't have vendor concept by default
      productType: wcProduct.type,
      handle: wcProduct.slug,
      tags,
      variants: variants.length > 0 ? variants : [{
        id: String(wcProduct.id),
        sku: wcProduct.sku,
        barcode: undefined,
        title: wcProduct.name,
        inventoryQuantity: wcProduct.stock_quantity ?? 0,
        weight: parseFloat(wcProduct.weight) || 0,
        price: wcProduct.price || '0',
      }],
      collections,
    };
  }

  /**
   * Map WooCommerce customer to CreateCustomerInput
   *
   * @param wcCustomer WooCommerce customer from REST API
   * @returns Normalized customer input
   */
  mapCustomer(wcCustomer: WooCommerceCustomer): CreateCustomerInput {
    return {
      externalCustomerId: String(wcCustomer.id),
      source: this.source,
      email: wcCustomer.email,
      firstName: wcCustomer.first_name,
      lastName: wcCustomer.last_name,
      phone: wcCustomer.billing?.phone || undefined,
      billingAddress: wcCustomer.billing ? {
        address1: wcCustomer.billing.address_1,
        address2: wcCustomer.billing.address_2 || undefined,
        city: wcCustomer.billing.city,
        province: wcCustomer.billing.state,
        country: wcCustomer.billing.country,
        postalCode: wcCustomer.billing.postcode,
      } : undefined,
      shippingAddress: wcCustomer.shipping ? {
        address1: wcCustomer.shipping.address_1,
        address2: wcCustomer.shipping.address_2 || undefined,
        city: wcCustomer.shipping.city,
        province: wcCustomer.shipping.state,
        country: wcCustomer.shipping.country,
        postalCode: wcCustomer.shipping.postcode,
      } : undefined,
    };
  }

  /**
   * Fetch order from WooCommerce REST API v3
   *
   * @param orderId WooCommerce order ID
   * @param credentials WooCommerce API credentials
   * @returns WooCommerce order
   * @throws Error if API call fails
   */
  async fetchOrder(
    orderId: string | number,
    credentials: WooCommerceCredentials
  ): Promise<WooCommerceOrder> {
    const authHeader = this.buildBasicAuthHeader(
      credentials.consumerKey,
      credentials.consumerSecret
    );

    const url = new URL(
      `/wp-json/wc/v3/orders/${orderId}`,
      credentials.siteUrl
    ).toString();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as WooCommerceOrder;
    } catch (error) {
      console.error('[WooCommerceAdapter] Error fetching order:', error);
      throw error;
    }
  }

  /**
   * Fetch products from WooCommerce REST API v3 with pagination
   *
   * @param credentials WooCommerce API credentials
   * @param cursor Page number (1-based)
   * @param perPage Items per page (max 100)
   * @returns Products and next cursor
   * @throws Error if API call fails
   */
  async fetchProducts(
    credentials: WooCommerceCredentials,
    cursor?: string | number,
    perPage: number = 100
  ): Promise<{ products: WooCommerceProduct[]; nextCursor?: string }> {
    const authHeader = this.buildBasicAuthHeader(
      credentials.consumerKey,
      credentials.consumerSecret
    );

    const page = cursor ? Number(cursor) : 1;
    const url = new URL(
      `/wp-json/wc/v3/products`,
      credentials.siteUrl
    );
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(Math.min(perPage, 100)));

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
      }

      const products = (await response.json()) as WooCommerceProduct[];

      // Check if there are more pages
      const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
      const nextCursor = page < totalPages ? String(page + 1) : undefined;

      return { products, nextCursor };
    } catch (error) {
      console.error('[WooCommerceAdapter] Error fetching products:', error);
      throw error;
    }
  }

  /**
   * Fetch customer from WooCommerce REST API v3
   *
   * @param customerId WooCommerce customer ID
   * @param credentials WooCommerce API credentials
   * @returns WooCommerce customer
   * @throws Error if API call fails
   */
  async fetchCustomer(
    customerId: string | number,
    credentials: WooCommerceCredentials
  ): Promise<WooCommerceCustomer> {
    const authHeader = this.buildBasicAuthHeader(
      credentials.consumerKey,
      credentials.consumerSecret
    );

    const url = new URL(
      `/wp-json/wc/v3/customers/${customerId}`,
      credentials.siteUrl
    ).toString();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as WooCommerceCustomer;
    } catch (error) {
      console.error('[WooCommerceAdapter] Error fetching customer:', error);
      throw error;
    }
  }

  /**
   * Build HTTP Basic Auth header for WooCommerce API
   *
   * @param consumerKey WooCommerce consumer key
   * @param consumerSecret WooCommerce consumer secret
   * @returns Authorization header value
   */
  private buildBasicAuthHeader(consumerKey: string, consumerSecret: string): string {
    const credentials = `${consumerKey}:${consumerSecret}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
  }
}

export default WooCommerceAdapter;
