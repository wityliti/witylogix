/**
 * Shopify REST Admin API Platform Adapter
 *
 * Implements PlatformAdapter interface for Shopify, handling:
 * - HMAC-SHA256 webhook validation (X-Shopify-Hmac-SHA256 header)
 * - Order, product, and customer data mapping
 * - REST API and GraphQL fetching with pagination
 *
 * Shopify REST Admin API v2024-01:
 *   Base URL: https://{shop}.myshopify.com/admin/api/2024-01/
 *   Auth: Bearer token (access token)
 */

import crypto from "crypto";
import type {
  WooCommerceOrder,
  WooCommerceProduct,
  WooCommerceCustomer,
  WooCommerceAddress,
  WooCommerceLineItem,
  WooCommerceImage,
  CreateOrderInput,
  CreateProductInput,
  CreateCustomerInput,
  WooCommerceCredentials,
} from "./woocommerce.js";

/**
 * Shopify order from REST API
 */
export interface ShopifyOrder {
  id: number;
  email: string;
  created_at: string;
  updated_at: string;
  number: number;
  note: string | null;
  token: string;
  gateway: string;
  test: boolean;
  total_price: string;
  subtotal_price: string;
  total_weight: number;
  total_tax: string;
  total_discounts: string;
  currency: string;
  financial_status:
    | "authorized"
    | "pending"
    | "paid"
    | "refunded"
    | "voided"
    | "partially_paid"
    | "partially_refunded"
    | "declined";
  confirmed: boolean;
  status: string;
  fulfillment_status:
    | "fulfilled"
    | "partial"
    | "unshipped"
    | "unfinished"
    | "scheduled"
    | null;
  fulfillments: Array<unknown>;
  payment_details: {
    credit_card_bin: string;
    avs_result_code: string;
    cvv_result_code: string;
    credit_card_number: string;
    credit_card_company: string;
  };
  billing_address: ShopifyAddress;
  shipping_address: ShopifyAddress;
  customer: ShopifyCustomer;
  order_number: number;
  cancel_reason: string | null;
  cancelled_at: string | null;
  closed_at: string | null;
  completed_at: string | null;
  line_items: ShopifyLineItem[];
  discount_codes: Array<{ code: string; amount: string; type: string }>;
  tax_lines: Array<unknown>;
  shipping_lines: Array<unknown>;
  refunds: Array<unknown>;
  app_id: number | null;
  customer_locale: string | null;
  name: string;
  admin_graphql_api_id: string;
  processing_method: string;
  checkout_id: number | null;
  checkout_token: string | null;
  landing_site: string | null;
  buyer_accepts_marketing: boolean;
  taxes_included: boolean;
  cart_token: string | null;
  user_id: number | null;
  location_id: number | null;
  source_identifier: string | null;
  source_url: string | null;
  referring_site: string | null;
  risk_level: string;
  source_name: string;
  presentment_currency: string;
  total_line_items_price: string;
  total_line_items_price_set: {
    shop_money: { amount: string; currency_code: string };
    presentment_money: { amount: string; currency_code: string };
  };
  total_price_set: {
    shop_money: { amount: string; currency_code: string };
    presentment_money: { amount: string; currency_code: string };
  };
  total_shipping_price_set: {
    shop_money: { amount: string; currency_code: string };
    presentment_money: { amount: string; currency_code: string };
  };
  total_tax_set: {
    shop_money: { amount: string; currency_code: string };
    presentment_money: { amount: string; currency_code: string };
  };
  total_discount_set: {
    shop_money: { amount: string; currency_code: string };
    presentment_money: { amount: string; currency_code: string };
  };
  total_weight_unit: string;
  original_total_duties_set: {
    shop_money: { amount: string; currency_code: string };
    presentment_money: { amount: string; currency_code: string };
  } | null;
  current_total_duties_set: {
    shop_money: { amount: string; currency_code: string };
    presentment_money: { amount: string; currency_code: string };
  } | null;
  total_outstanding: string;
  payment_gateway_names: string[];
  display_fulfillment_status: string;
  fulfillment_orders: Array<unknown>;
}

export interface ShopifyAddress {
  first_name: string;
  address1: string;
  phone: string;
  city: string;
  zip: string;
  province: string;
  country: string;
  last_name: string;
  address2: string;
  company: string;
  latitude: number;
  longitude: number;
  name: string;
  country_code: string;
  province_code: string;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  accepts_marketing: boolean;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  state: string;
  total_spent: string;
  last_order_id: number | null;
  note: string | null;
  verified_email: boolean;
  multipass_identifier: string | null;
  tax_exempt: boolean;
  tags: string;
  currency: string;
  phone: string | null;
  accepts_marketing_updated_at: string;
  marketing_opt_in_level: string | null;
  tax_exemptions: string[];
  email_marketing_consent: {
    state: string;
    opt_in_level: string | null;
    consent_updated_at: string;
  } | null;
  sms_marketing_consent: {
    state: string;
    opt_in_level: string | null;
    consent_updated_at: string;
  } | null;
  addresses: ShopifyAddress[];
  admin_graphql_api_id: string;
  default_address: ShopifyAddress;
}

export interface ShopifyLineItem {
  id: number;
  variant_id: number;
  title: string;
  quantity: number;
  sku: string;
  variant_title: string;
  vendor: string;
  fulfillment_service: string;
  product_id: number;
  requires_shipping: boolean;
  taxable: boolean;
  gift_card: boolean;
  name: string;
  variant_inventory_management: string;
  properties: Array<unknown>;
  product_exists: boolean;
  fulfillment_status: string | null;
  grams: number;
  weight: number;
  weight_unit: string;
  price: string;
  total_discount: string;
  admin_graphql_api_id: string;
  tax_lines: Array<unknown>;
  duties: Array<unknown>;
  discount_allocations: Array<unknown>;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  published_at: string;
  created_at: string;
  updated_at: string;
  published_scope: string;
  template_suffix: string | null;
  status: string;
  product_type: string;
  vendor: string;
  tags: string;
  variants: ShopifyVariant[];
  options: Array<{
    id: number;
    product_id: number;
    name: string;
    position: number;
    values: string[];
  }>;
  images: ShopifyImage[];
  image: ShopifyImage | null;
  admin_graphql_api_id: string;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  position: number;
  inventory_policy: string;
  compare_at_price: string | null;
  fulfillment_service: string;
  inventory_management: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  created_at: string;
  updated_at: string;
  taxable: boolean;
  barcode: string | null;
  grams: number;
  image_id: number | null;
  weight: number;
  weight_unit: string;
  inventory_item_id: number;
  inventory_quantity: number;
  old_inventory_quantity: number;
  requires_shipping: boolean;
  admin_graphql_api_id: string;
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  position: number;
  created_at: string;
  updated_at: string;
  alt: string | null;
  width: number;
  height: number;
  src: string;
  variant_ids: number[];
  admin_graphql_api_id: string;
}

/**
 * Credentials for Shopify REST API authentication
 */
export interface ShopifyCredentials {
  shop: string; // e.g., "myshop" (without .myshopify.com)
  accessToken: string;
  apiVersion?: string; // e.g., "2024-01", defaults to "2024-01"
  appSecret?: string; // For webhook signature validation
}

/**
 * Shopify REST Admin API adapter
 */
export class ShopifyAdapter {
  public readonly source = "SHOPIFY" as const;
  private apiVersion = "2024-01";

  constructor(apiVersion?: string) {
    if (apiVersion) {
      this.apiVersion = apiVersion;
    }
  }

  /**
   * Validate Shopify webhook signature
   * Uses HMAC-SHA256 with the app secret
   * Signature header: X-Shopify-Hmac-SHA256 (base64 encoded)
   *
   * @param payload Raw request body as string or buffer
   * @param signature X-Shopify-Hmac-SHA256 header value
   * @param secret Shopify app secret
   * @returns true if signature is valid
   */
  validateWebhook(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    if (!signature || !secret) {
      return false;
    }

    if (!payload) {
      return false;
    }

    try {
      const payloadString =
        typeof payload === "string" ? payload : payload.toString("utf-8");

      // Shopify HMAC is base64(hmac-sha256(payload, secret))
      const computed = crypto
        .createHmac("sha256", secret)
        .update(payloadString, "utf-8")
        .digest("base64");

      // Timing-safe comparison
      const expectedBuffer = Buffer.from(computed, "utf-8");
      const actualBuffer = Buffer.from(signature, "utf-8");

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch (error) {
      console.error("[ShopifyAdapter] Error validating webhook:", error);
      return false;
    }
  }

  /**
   * Map Shopify order to CreateOrderInput
   *
   * @param shopifyOrder Shopify order from REST API
   * @returns Normalized order input
   */
  mapOrder(shopifyOrder: ShopifyOrder): CreateOrderInput {
    const lineItems = (shopifyOrder.line_items || []).map((item) => ({
      id: String(item.id),
      productId: String(item.product_id),
      variantId: String(item.variant_id),
      title: item.title,
      quantity: item.quantity,
      price: parseFloat(item.price),
      sku: item.sku,
    }));

    const customerName = shopifyOrder.customer
      ? `${shopifyOrder.customer.first_name || ""} ${shopifyOrder.customer.last_name || ""}`.trim()
      : shopifyOrder.billing_address
        ? `${shopifyOrder.billing_address.first_name || ""} ${shopifyOrder.billing_address.last_name || ""}`.trim()
        : undefined;

    return {
      externalOrderId: String(shopifyOrder.id),
      externalOrderNumber: String(
        shopifyOrder.number || shopifyOrder.order_number,
      ),
      source: this.source,
      status: shopifyOrder.cancelled_at ? "cancelled" : shopifyOrder.status,
      email: shopifyOrder.customer?.email || shopifyOrder.email || "",
      customerEmail: shopifyOrder.customer?.email || shopifyOrder.email,
      customerName: customerName,
      currency: shopifyOrder.currency,
      totalPrice: parseFloat(shopifyOrder.total_price),
      subtotalPrice: parseFloat(shopifyOrder.subtotal_price),
      totalTax: parseFloat(shopifyOrder.total_tax),
      totalWeight: shopifyOrder.total_weight,
      financialStatus: shopifyOrder.financial_status,
      fulfillmentStatus: shopifyOrder.fulfillment_status || "unshipped",
      lineItems: lineItems,
      shippingAddress: shopifyOrder.shipping_address
        ? {
            firstName: shopifyOrder.shipping_address.first_name,
            lastName: shopifyOrder.shipping_address.last_name,
            address1: shopifyOrder.shipping_address.address1,
            address2: shopifyOrder.shipping_address.address2,
            city: shopifyOrder.shipping_address.city,
            province: shopifyOrder.shipping_address.province,
            country: shopifyOrder.shipping_address.country,
            postalCode: shopifyOrder.shipping_address.zip,
            phone: shopifyOrder.shipping_address.phone,
          }
        : undefined,
      createdAt: new Date(shopifyOrder.created_at),
    };
  }

  /**
   * Map Shopify product to CreateProductInput
   *
   * @param shopifyProduct Shopify product from REST API
   * @returns Normalized product input
   */
  mapProduct(shopifyProduct: ShopifyProduct): CreateProductInput {
    // Extract tags
    const tags = shopifyProduct.tags
      ? shopifyProduct.tags.split(",").map((t) => t.trim())
      : [];

    // Map variants from Shopify product
    const variants = (shopifyProduct.variants || []).map((variant) => ({
      id: String(variant.id),
      sku: variant.sku,
      barcode: variant.barcode || undefined,
      title: variant.title,
      inventoryQuantity: variant.inventory_quantity,
      weight: variant.weight,
      price: variant.price,
    }));

    // Extract first image URL
    const imageUrl =
      shopifyProduct.images?.[0]?.src || shopifyProduct.image?.src;

    return {
      externalProductId: String(shopifyProduct.id),
      source: this.source,
      title: shopifyProduct.title,
      description: shopifyProduct.body_html,
      imageUrl: imageUrl,
      vendor: shopifyProduct.vendor,
      productType: shopifyProduct.product_type,
      handle: shopifyProduct.handle,
      tags,
      variants,
    };
  }

  /**
   * Map Shopify customer to CreateCustomerInput
   *
   * @param shopifyCustomer Shopify customer from REST API
   * @returns Normalized customer input
   */
  mapCustomer(shopifyCustomer: ShopifyCustomer): CreateCustomerInput {
    return {
      externalCustomerId: String(shopifyCustomer.id),
      source: this.source,
      email: shopifyCustomer.email,
      firstName: shopifyCustomer.first_name,
      lastName: shopifyCustomer.last_name,
      phone: shopifyCustomer.phone || undefined,
      billingAddress: shopifyCustomer.default_address
        ? {
            address1: shopifyCustomer.default_address.address1,
            address2: shopifyCustomer.default_address.address2 || undefined,
            city: shopifyCustomer.default_address.city,
            province: shopifyCustomer.default_address.province,
            country: shopifyCustomer.default_address.country,
            postalCode: shopifyCustomer.default_address.zip,
          }
        : undefined,
      shippingAddress: shopifyCustomer.addresses?.[0]
        ? {
            address1: shopifyCustomer.addresses[0].address1,
            address2: shopifyCustomer.addresses[0].address2 || undefined,
            city: shopifyCustomer.addresses[0].city,
            province: shopifyCustomer.addresses[0].province,
            country: shopifyCustomer.addresses[0].country,
            postalCode: shopifyCustomer.addresses[0].zip,
          }
        : undefined,
    };
  }

  /**
   * Fetch order from Shopify REST API
   *
   * @param orderId Shopify order ID
   * @param credentials Shopify API credentials
   * @returns Shopify order
   * @throws Error if API call fails
   */
  async fetchOrder(
    orderId: string | number,
    credentials: ShopifyCredentials,
  ): Promise<ShopifyOrder> {
    const url = new URL(
      `/admin/api/${credentials.apiVersion || this.apiVersion}/orders/${orderId}.json`,
      `https://${credentials.shop}.myshopify.com`,
    ).toString();

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": credentials.accessToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Shopify API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as { order: ShopifyOrder };
      return data.order;
    } catch (error) {
      console.error("[ShopifyAdapter] Error fetching order:", error);
      throw error;
    }
  }

  /**
   * Fetch products from Shopify REST API with pagination
   *
   * @param credentials Shopify API credentials
   * @param cursor Cursor for pagination (from Link header)
   * @param limit Items per page (max 250)
   * @returns Products and next cursor
   * @throws Error if API call fails
   */
  async fetchProducts(
    credentials: ShopifyCredentials,
    cursor?: string,
    limit: number = 100,
  ): Promise<{ products: ShopifyProduct[]; nextCursor?: string }> {
    const url = new URL(
      `/admin/api/${credentials.apiVersion || this.apiVersion}/products.json`,
      `https://${credentials.shop}.myshopify.com`,
    );
    url.searchParams.set("limit", String(Math.min(limit, 250)));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": credentials.accessToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Shopify API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as { products: ShopifyProduct[] };
      const linkHeader = response.headers.get("Link");
      const nextCursor = this.extractNextCursor(linkHeader);

      return { products: data.products, nextCursor };
    } catch (error) {
      console.error("[ShopifyAdapter] Error fetching products:", error);
      throw error;
    }
  }

  /**
   * Fetch customer from Shopify REST API
   *
   * @param customerId Shopify customer ID
   * @param credentials Shopify API credentials
   * @returns Shopify customer
   * @throws Error if API call fails
   */
  async fetchCustomer(
    customerId: string | number,
    credentials: ShopifyCredentials,
  ): Promise<ShopifyCustomer> {
    const url = new URL(
      `/admin/api/${credentials.apiVersion || this.apiVersion}/customers/${customerId}.json`,
      `https://${credentials.shop}.myshopify.com`,
    ).toString();

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": credentials.accessToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Shopify API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as { customer: ShopifyCustomer };
      return data.customer;
    } catch (error) {
      console.error("[ShopifyAdapter] Error fetching customer:", error);
      throw error;
    }
  }

  /**
   * Extract next cursor from Link header (Shopify pagination)
   * Link header format: <url?cursor=xxx>; rel="next"
   *
   * @param linkHeader Link header value
   * @returns Next cursor if available
   */
  private extractNextCursor(linkHeader: string | null): string | undefined {
    if (!linkHeader) return undefined;

    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (!nextMatch) return undefined;

    const url = new URL(nextMatch[1]);
    return url.searchParams.get("cursor") || undefined;
  }
}

export default ShopifyAdapter;
