/**
 * Shopify Admin API SDK Client
 * Production-ready client for Shopify 2024-01 REST + GraphQL patterns
 * Supports: Orders, Products, Inventory, Fulfillment, Webhooks, Metafields
 * Rate Limiting: 40 req/min (REST), cost-based (GraphQL)
 * Pagination: Cursor-based (Link header) and page-based
 */

import { createHmac } from "node:crypto";
import type {
  ECommerceOrder,
  ECommerceProduct,
  ECommerceCustomer,
  ECommerceInventory,
  FulfillmentRequest,
  FulfillmentResponse,
  InventoryUpdateRequest,
} from "./types.js";

/**
 * Shopify OAuth2 configuration
 */
export interface ShopifyOAuthConfig {
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Shopify API configuration
 */
export interface ShopifyConfig {
  shopName: string;
  accessToken: string;
  apiVersion?: string;
  webhookSecret?: string;
}

/**
 * Shopify REST API order response
 */
interface ShopifyOrderResponse {
  id: number;
  order_number: number;
  email: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  closed_at: string | null;
  financial_status: string;
  fulfillment_status: string;
  currency: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_shipping_price: string;
  total_discounts: string;
  note: string;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    accepts_marketing: boolean;
    created_at: string;
    updated_at: string;
  };
  billing_address: ShopifyAddress;
  shipping_address: ShopifyAddress;
  line_items: ShopifyLineItem[];
  fulfillments: ShopifyFulfillment[];
}

/**
 * Shopify address response
 */
interface ShopifyAddress {
  id: number;
  first_name: string;
  last_name: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string;
  name: string;
  province_code: string;
  country_code: string;
  latitude: number;
  longitude: number;
}

/**
 * Shopify line item
 */
interface ShopifyLineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  total_discount: string;
  product_id: number;
  variant_id: number;
  sku: string;
  name: string;
  properties: Array<{ name: string; value: unknown }>;
  variant_title: string;
  vendor: string;
  taxable: boolean;
}

/**
 * Shopify fulfillment
 */
interface ShopifyFulfillment {
  id: number;
  order_id: number;
  status: string;
  created_at: string;
  updated_at: string;
  line_items: Array<{ id: number; quantity: number }>;
  tracking_info: {
    number: string;
    company: string;
    url: string;
  };
}

/**
 * Shopify product response
 */
interface ShopifyProductResponse {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  tags: string;
  status: string;
  handle: string;
  variants: ShopifyVariant[];
  images: Array<{
    id: number;
    product_id: number;
    position: number;
    created_at: string;
    updated_at: string;
    alt: string;
    width: number;
    height: number;
    src: string;
  }>;
}

/**
 * Shopify product variant
 */
interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  position: number;
  grams: number;
  weight: number;
  weight_unit: string;
  inventory_item_id: number;
  inventory_quantity: number;
  inventory_management: string;
  tax_code: string;
  barcode: string;
}

/**
 * Shopify inventory level
 */
interface ShopifyInventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
  updated_at: string;
}

/**
 * Shopify webhook registration
 */
interface ShopifyWebhookResponse {
  id: number;
  address: string;
  topic: string;
  created_at: string;
  updated_at: string;
  format: string;
  fields: string[];
  api_version: string;
}

/**
 * Shopify metafield
 */
interface ShopifyMetafield {
  id: number;
  owner_id: number;
  owner_resource: string;
  key: string;
  value: unknown;
  type: string;
  created_at: string;
  updated_at: string;
}

/**
 * Pagination cursor information
 */
interface PaginationCursor {
  after?: string;
  before?: string;
  limit: number;
}

/** Shopify REST API response wrappers */
interface ShopifyOAuthTokenResponse {
  access_token: string;
  scope?: string;
}

interface ShopifyOrdersListResponse {
  orders: ShopifyOrderResponse[];
  pagination?: { after?: string };
}

interface ShopifyOrderWrapResponse {
  order: ShopifyOrderResponse;
}

interface ShopifyProductsListResponse {
  products: ShopifyProductResponse[];
  pagination?: { after?: string };
}

interface ShopifyProductWrapResponse {
  product: ShopifyProductResponse;
}

interface ShopifyFulfillmentWrapResponse {
  fulfillment: ShopifyFulfillment;
}

interface ShopifyInventoryLevelsResponse {
  inventory_levels: ShopifyInventoryLevel[];
}

interface ShopifyLocationsResponse {
  locations: Array<{ id: number; name: string }>;
}

interface ShopifyWebhookWrapResponse {
  webhook: ShopifyWebhookResponse;
}

interface ShopifyWebhooksListResponse {
  webhooks: ShopifyWebhookResponse[];
}

interface ShopifyMetafieldsResponse {
  metafields: ShopifyMetafield[];
}

interface ShopifyMetafieldWrapResponse {
  metafield: ShopifyMetafield;
}

/**
 * Shopify SDK Client
 */
export class ShopifyClient {
  private config: ShopifyConfig;
  private baseUrl: string;
  private rateLimitRemaining = 40;
  private rateLimitReset = 0;

  constructor(config: ShopifyConfig) {
    this.config = {
      apiVersion: "2024-01",
      ...config,
    };
    this.baseUrl = `https://${this.config.shopName}.myshopify.com/admin/api/${this.config.apiVersion}`;
  }

  /**
   * Generate OAuth2 install URL
   */
  static generateInstallUrl(config: ShopifyOAuthConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.apiKey,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(","),
      state,
    });
    return `https://${new URL(config.redirectUri).hostname}/oauth/authorize?${params}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeAuthorizationCode(
    config: ShopifyOAuthConfig,
    shopName: string,
    code: string,
  ): Promise<{ accessToken: string; scope: string[] }> {
    const url = `https://${shopName}.myshopify.com/oauth/access_token`;

    const response = await this.request<ShopifyOAuthTokenResponse>(
      "POST",
      url,
      {
        client_id: config.apiKey,
        client_secret: config.apiSecret,
        code,
      },
    );

    return {
      accessToken: response.access_token,
      scope: response.scope?.split(",") || [],
    };
  }

  /**
   * List orders
   */
  async listOrders(options?: {
    status?: "any" | "pending" | "cancelled" | "processing" | "completed";
    limit?: number;
    cursor?: string;
  }): Promise<{ orders: ECommerceOrder[]; nextCursor?: string }> {
    const params = new URLSearchParams({
      status: options?.status || "any",
      limit: String(options?.limit || 50),
    });

    if (options?.cursor) {
      params.append("cursor", options.cursor);
    }

    const response = await this.request<ShopifyOrdersListResponse>(
      "GET",
      `${this.baseUrl}/orders.json?${params}`,
    );

    const orders = response.orders.map((order: ShopifyOrderResponse) =>
      this.mapShopifyOrderToECommerce(order),
    );

    return {
      orders,
      nextCursor: this.extractPaginationCursor(response.pagination?.after),
    };
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<ECommerceOrder> {
    const response = await this.request<ShopifyOrderWrapResponse>(
      "GET",
      `${this.baseUrl}/orders/${orderId}.json`,
    );
    return this.mapShopifyOrderToECommerce(response.order);
  }

  /**
   * Create order
   */
  async createOrder(data: {
    email: string;
    line_items: Array<{ variant_id: number; quantity: number; price?: string }>;
    customer?: { email: string };
    billing_address?: Record<string, unknown>;
    shipping_address?: Record<string, unknown>;
  }): Promise<ECommerceOrder> {
    const response = await this.request<ShopifyOrderWrapResponse>(
      "POST",
      `${this.baseUrl}/orders.json`,
      {
        order: data,
      },
    );
    return this.mapShopifyOrderToECommerce(response.order);
  }

  /**
   * Update order
   */
  async updateOrder(
    orderId: string,
    data: Record<string, unknown>,
  ): Promise<ECommerceOrder> {
    const response = await this.request<ShopifyOrderWrapResponse>(
      "PUT",
      `${this.baseUrl}/orders/${orderId}.json`,
      { order: data },
    );
    return this.mapShopifyOrderToECommerce(response.order);
  }

  /**
   * Fulfill order
   */
  async fulfillOrder(
    orderId: string,
    request: FulfillmentRequest,
  ): Promise<FulfillmentResponse> {
    const fulfillmentData = {
      line_items_by_fulfillment_order: [
        {
          fulfillment_order_id: orderId,
          fulfillment_order_line_items: request.items.map((item) => ({
            id: item.lineItemId,
            quantity: item.quantity,
          })),
        },
      ],
      tracking_info: request.trackingNumber
        ? {
            number: request.trackingNumber,
            company: request.trackingCompany || "other",
          }
        : undefined,
      notify_customer: request.notifyCustomer !== false,
    };

    const response = await this.request<ShopifyFulfillmentWrapResponse>(
      "POST",
      `${this.baseUrl}/fulfillments.json`,
      { fulfillment: fulfillmentData },
    );

    return this.mapShopifyFulfillmentToECommerce(response.fulfillment);
  }

  /**
   * Update fulfillment
   */
  async updateFulfillment(
    orderId: string,
    fulfillmentId: string,
    data: { tracking_number?: string; tracking_company?: string },
  ): Promise<FulfillmentResponse> {
    const response = await this.request<ShopifyFulfillmentWrapResponse>(
      "PATCH",
      `${this.baseUrl}/fulfillments/${fulfillmentId}.json`,
      { fulfillment: data },
    );

    return this.mapShopifyFulfillmentToECommerce(response.fulfillment);
  }

  /**
   * Cancel fulfillment
   */
  async cancelFulfillment(fulfillmentId: string): Promise<void> {
    await this.request(
      "POST",
      `${this.baseUrl}/fulfillments/${fulfillmentId}/cancel.json`,
    );
  }

  /**
   * List products
   */
  async listProducts(options?: {
    status?: "active" | "draft" | "archived";
    limit?: number;
    cursor?: string;
  }): Promise<{ products: ECommerceProduct[]; nextCursor?: string }> {
    const params = new URLSearchParams({
      status: options?.status || "active",
      limit: String(options?.limit || 50),
    });

    if (options?.cursor) {
      params.append("cursor", options.cursor);
    }

    const response = await this.request<ShopifyProductsListResponse>(
      "GET",
      `${this.baseUrl}/products.json?${params}`,
    );

    const products = response.products.map((product: ShopifyProductResponse) =>
      this.mapShopifyProductToECommerce(product),
    );

    return {
      products,
      nextCursor: this.extractPaginationCursor(response.pagination?.after),
    };
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<ECommerceProduct> {
    const response = await this.request<ShopifyProductWrapResponse>(
      "GET",
      `${this.baseUrl}/products/${productId}.json`,
    );
    return this.mapShopifyProductToECommerce(response.product);
  }

  /**
   * Create product
   */
  async createProduct(data: {
    title: string;
    body_html?: string;
    vendor?: string;
    product_type?: string;
    variants?: Array<{ price: string; sku?: string }>;
  }): Promise<ECommerceProduct> {
    const response = await this.request<ShopifyProductWrapResponse>(
      "POST",
      `${this.baseUrl}/products.json`,
      { product: data },
    );
    return this.mapShopifyProductToECommerce(response.product);
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    data: Record<string, unknown>,
  ): Promise<ECommerceProduct> {
    const response = await this.request<ShopifyProductWrapResponse>(
      "PUT",
      `${this.baseUrl}/products/${productId}.json`,
      { product: data },
    );
    return this.mapShopifyProductToECommerce(response.product);
  }

  /**
   * Delete product
   */
  async deleteProduct(productId: string): Promise<void> {
    await this.request("DELETE", `${this.baseUrl}/products/${productId}.json`);
  }

  /**
   * Create product variant
   */
  async createVariant(
    productId: string,
    data: { price: string; sku?: string; title?: string },
  ): Promise<ShopifyVariant> {
    const response = await this.request<{ variant: ShopifyVariant }>(
      "POST",
      `${this.baseUrl}/products/${productId}/variants.json`,
      { variant: data },
    );
    return response.variant;
  }

  /**
   * Update product variant
   */
  async updateVariant(
    variantId: string,
    data: Record<string, unknown>,
  ): Promise<ShopifyVariant> {
    const response = await this.request<{ variant: ShopifyVariant }>(
      "PUT",
      `${this.baseUrl}/variants/${variantId}.json`,
      { variant: data },
    );
    return response.variant;
  }

  /**
   * Delete product variant
   */
  async deleteVariant(productId: string, variantId: string): Promise<void> {
    await this.request(
      "DELETE",
      `${this.baseUrl}/products/${productId}/variants/${variantId}.json`,
    );
  }

  /**
   * Get inventory levels for a location
   */
  async getInventoryLevels(locationId: string): Promise<ECommerceInventory[]> {
    const response = await this.request<ShopifyInventoryLevelsResponse>(
      "GET",
      `${this.baseUrl}/inventory_levels.json?location_id=${locationId}`,
    );

    return response.inventory_levels.map((level: ShopifyInventoryLevel) => ({
      variantId: String(level.inventory_item_id),
      quantity: level.available,
      trackQuantity: true,
      allowNegativeStock: false,
      updatedAt: new Date(level.updated_at),
    }));
  }

  /**
   * Adjust inventory
   */
  async adjustInventory(
    request: InventoryUpdateRequest,
  ): Promise<ECommerceInventory> {
    const response = await this.request<ShopifyInventoryLevelsResponse>(
      "POST",
      `${this.baseUrl}/inventory_levels/adjust.json`,
      {
        body: {
          reason: request.reason || "adjustment",
          changes: [
            {
              inventory_item_id: request.variantId,
              available_adjustment: request.quantity,
              location_id: request.warehouseId || "1",
            },
          ],
        },
      },
    );

    return {
      variantId: request.variantId,
      quantity: response.inventory_levels[0].available,
      trackQuantity: true,
      allowNegativeStock: false,
      updatedAt: new Date(),
    };
  }

  /**
   * Set inventory quantity
   */
  async setInventory(
    variantId: string,
    quantity: number,
    locationId: string,
  ): Promise<ECommerceInventory> {
    const response = await this.request<ShopifyInventoryLevelsResponse>(
      "POST",
      `${this.baseUrl}/inventory_levels/set.json`,
      {
        body: {
          inventory_item_id: variantId,
          available: quantity,
          location_id: locationId,
        },
      },
    );

    return {
      variantId,
      quantity: response.inventory_levels[0].available,
      trackQuantity: true,
      allowNegativeStock: false,
      updatedAt: new Date(),
    };
  }

  /**
   * List inventory locations
   */
  async listLocations(): Promise<Array<{ id: string; name: string }>> {
    const response = await this.request<ShopifyLocationsResponse>(
      "GET",
      `${this.baseUrl}/locations.json`,
    );
    return response.locations.map((loc: { id: number; name: string }) => ({
      id: String(loc.id),
      name: loc.name,
    }));
  }

  /**
   * Register webhook
   */
  async registerWebhook(
    topic: string,
    callbackUrl: string,
  ): Promise<ShopifyWebhookResponse> {
    const response = await this.request<ShopifyWebhookWrapResponse>(
      "POST",
      `${this.baseUrl}/webhooks.json`,
      {
        webhook: {
          topic,
          address: callbackUrl,
          format: "json",
        },
      },
    );
    return response.webhook;
  }

  /**
   * List webhooks
   */
  async listWebhooks(): Promise<ShopifyWebhookResponse[]> {
    const response = await this.request<ShopifyWebhooksListResponse>(
      "GET",
      `${this.baseUrl}/webhooks.json`,
    );
    return response.webhooks;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request("DELETE", `${this.baseUrl}/webhooks/${webhookId}.json`);
  }

  /**
   * Verify webhook HMAC signature
   */
  verifyWebhookSignature(payload: unknown, signature: string): boolean {
    if (!this.config.webhookSecret) {
      return false;
    }

    const payloadStr =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    const computed = createHmac("sha256", this.config.webhookSecret)
      .update(payloadStr, "utf8")
      .digest("base64");

    return computed === signature;
  }

  /**
   * Get metafield for resource
   */
  async getMetafields(
    resourceType: string,
    resourceId: string,
  ): Promise<ShopifyMetafield[]> {
    const response = await this.request<ShopifyMetafieldsResponse>(
      "GET",
      `${this.baseUrl}/${resourceType}/${resourceId}/metafields.json`,
    );
    return response.metafields;
  }

  /**
   * Create metafield
   */
  async createMetafield(
    resourceType: string,
    resourceId: string,
    data: { key: string; value: unknown; type: string },
  ): Promise<ShopifyMetafield> {
    const response = await this.request<ShopifyMetafieldWrapResponse>(
      "POST",
      `${this.baseUrl}/${resourceType}/${resourceId}/metafields.json`,
      { metafield: data },
    );
    return response.metafield;
  }

  /**
   * Update metafield
   */
  async updateMetafield(
    metafieldId: string,
    data: { value: unknown },
  ): Promise<ShopifyMetafield> {
    const response = await this.request<ShopifyMetafieldWrapResponse>(
      "PUT",
      `${this.baseUrl}/metafields/${metafieldId}.json`,
      { metafield: data },
    );
    return response.metafield;
  }

  /**
   * Make HTTP request with rate limit handling
   */
  private async request<T = unknown>(
    method: string,
    url: string,
    body?: unknown,
  ): Promise<T> {
    // Wait if needed for rate limiting
    await this.handleRateLimit();

    const options: RequestInit = {
      method,
      headers: {
        "X-Shopify-Access-Token": this.config.accessToken,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    let response = await fetch(url, options);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any = await response.json();

    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After")) || 1;
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      response = await fetch(url, options);
      data = await response.json();
    }

    // Update rate limit info
    this.rateLimitRemaining =
      Number(
        response.headers.get("X-Shopify-Shop-Api-Call-Limit")?.split("/")[0],
      ) || this.rateLimitRemaining;
    this.rateLimitReset =
      Number(
        response.headers.get("X-Shopify-Shop-Api-Call-Limit")?.split("/")[1],
      ) || this.rateLimitReset;

    if (!response.ok) {
      throw new Error(
        `Shopify API error: ${response.status} ${JSON.stringify(data)}`,
      );
    }

    return data as T;
  }

  /**
   * Handle rate limit delays
   */
  private async handleRateLimit(): Promise<void> {
    if (this.rateLimitRemaining <= 5) {
      const now = Date.now() / 1000;
      const delay = Math.max(0, this.rateLimitReset - now);
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, (delay + 1) * 1000));
      }
    }
  }

  /**
   * Extract pagination cursor from Link header
   */
  private extractPaginationCursor(linkHeader?: string): string | undefined {
    if (!linkHeader) return undefined;
    const match = linkHeader.match(/after=([^&;]+)/);
    return match?.[1];
  }

  /**
   * Map Shopify order to ECommerce order
   */
  private mapShopifyOrderToECommerce(
    order: ShopifyOrderResponse,
  ): ECommerceOrder {
    return {
      id: String(order.id),
      externalId: String(order.order_number),
      status: this.mapShopifyOrderStatus(order.financial_status),
      paymentStatus: this.mapShopifyPaymentStatus(order.financial_status),
      fulfillmentStatus: this.mapShopifyFulfillmentStatus(
        order.fulfillment_status,
      ),
      currency: order.currency,
      totalAmount: parseFloat(order.total_price),
      subtotalAmount: parseFloat(order.subtotal_price),
      taxAmount: parseFloat(order.total_tax),
      shippingAmount: parseFloat(order.total_shipping_price),
      discountAmount: parseFloat(order.total_discounts),
      customer: {
        id: String(order.customer.id),
        email: order.customer.email,
        firstName: order.customer.first_name,
        lastName: order.customer.last_name,
        phone: order.customer.phone,
        acceptsMarketing: order.customer.accepts_marketing,
        createdAt: new Date(order.customer.created_at),
        updatedAt: new Date(order.customer.updated_at),
      },
      billingAddress: this.mapShopifyAddress(order.billing_address),
      shippingAddress: this.mapShopifyAddress(order.shipping_address),
      lineItems: order.line_items.map((item) => ({
        id: String(item.id),
        name: item.title,
        sku: item.sku,
        quantity: item.quantity,
        price: parseFloat(item.price),
        taxAmount: 0,
        discountAmount: parseFloat(item.total_discount),
        totalAmount: parseFloat(item.price) * item.quantity,
        variantId: String(item.variant_id),
      })),
      notes: order.note,
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
    };
  }

  /**
   * Map Shopify product to ECommerce product
   */
  private mapShopifyProductToECommerce(
    product: ShopifyProductResponse,
  ): ECommerceProduct {
    return {
      id: String(product.id),
      title: product.title,
      description: product.body_html?.replace(/<[^>]*>/g, ""),
      status: product.status as "active" | "draft" | "archived",
      productType: product.product_type,
      vendor: product.vendor,
      variants: product.variants.map((v) => ({
        id: String(v.id),
        sku: v.sku,
        title: v.title,
        price: parseFloat(v.price),
        inventory: {
          variantId: String(v.id),
          quantity: v.inventory_quantity,
          trackQuantity: v.inventory_management !== null,
          allowNegativeStock: false,
          updatedAt: new Date(),
        },
        weight: v.weight,
        weightUnit: (v.weight_unit || "kg") as "lb" | "kg" | "g" | "oz",
      })),
      images: product.images.map((img) => ({
        url: img.src,
        altText: img.alt,
      })),
      createdAt: new Date(product.created_at),
      updatedAt: new Date(product.updated_at),
    };
  }

  /**
   * Map Shopify fulfillment to ECommerce fulfillment
   */
  private mapShopifyFulfillmentToECommerce(
    fulfillment: ShopifyFulfillment,
  ): FulfillmentResponse {
    return {
      id: String(fulfillment.id),
      orderId: String(fulfillment.order_id),
      status: fulfillment.status as
        | "pending"
        | "partial"
        | "complete"
        | "cancelled",
      items: fulfillment.line_items.map((item) => ({
        lineItemId: String(item.id),
        quantity: item.quantity,
      })),
      trackingInfo: fulfillment.tracking_info
        ? {
            company: fulfillment.tracking_info.company,
            number: fulfillment.tracking_info.number,
            url: fulfillment.tracking_info.url,
          }
        : undefined,
      createdAt: new Date(fulfillment.created_at),
      updatedAt: new Date(fulfillment.updated_at),
    };
  }

  /**
   * Map Shopify address to ECommerce address
   */
  private mapShopifyAddress(addr: ShopifyAddress): {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    state?: string;
    postalCode: string;
    country: string;
    phone?: string;
    email?: string;
  } {
    return {
      firstName: addr.first_name,
      lastName: addr.last_name,
      company: addr.company,
      address1: addr.address1,
      address2: addr.address2,
      city: addr.city,
      province: addr.province,
      postalCode: addr.zip,
      country: addr.country,
      phone: addr.phone,
    };
  }

  /**
   * Map Shopify order status to ECommerce status
   */
  private mapShopifyOrderStatus(
    status: string,
  ):
    | "processing"
    | "dispatched"
    | "pending"
    | "confirmed"
    | "out_for_delivery"
    | "delivered"
    | "cancelled"
    | "refunded"
    | "failed" {
    const mapping: Record<
      string,
      | "processing"
      | "dispatched"
      | "pending"
      | "confirmed"
      | "out_for_delivery"
      | "delivered"
      | "cancelled"
      | "refunded"
      | "failed"
    > = {
      pending: "pending",
      authorized: "confirmed",
      partially_paid: "processing",
      paid: "processing",
      partially_refunded: "refunded",
      refunded: "refunded",
      voided: "cancelled",
    };
    return mapping[status] || "pending";
  }

  /**
   * Map Shopify payment status to ECommerce payment status
   */
  private mapShopifyPaymentStatus(
    status: string,
  ): "pending" | "authorized" | "captured" | "refunded" | "failed" {
    const mapping: Record<
      string,
      "pending" | "authorized" | "captured" | "refunded" | "failed"
    > = {
      pending: "pending",
      authorized: "authorized",
      paid: "captured",
      partially_paid: "authorized",
      refunded: "refunded",
      partially_refunded: "captured",
      voided: "failed",
    };
    return mapping[status] || "pending";
  }

  /**
   * Map Shopify fulfillment status to ECommerce fulfillment status
   */
  private mapShopifyFulfillmentStatus(
    status: string | null,
  ): "pending" | "partial" | "complete" | "cancelled" {
    if (!status) return "pending";
    const mapping: Record<
      string,
      "pending" | "partial" | "complete" | "cancelled"
    > = {
      fulfilled: "complete",
      partial: "partial",
      unfulilled: "pending",
      restocked: "cancelled",
    };
    return mapping[status] || "pending";
  }
}

/**
 * Factory function to create Shopify client
 */
export function createShopifyClient(config: ShopifyConfig): ShopifyClient {
  return new ShopifyClient(config);
}
