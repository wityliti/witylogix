/**
 * WooCommerce REST API v3 SDK Client
 * Production-ready client for WooCommerce with OAuth1 authentication
 * Supports: Orders, Products, Customers, Inventory, Webhooks, Batch Operations
 * Rate Limiting: 25 requests per 10 seconds
 * Pagination: Page-based with total count headers
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
 * WooCommerce configuration
 */
export interface WooCommerceConfig {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  webhookSecret?: string;
}

/**
 * WooCommerce order response
 */
interface WooCommerceOrderResponse {
  id: number;
  order_number: string;
  date_created: string;
  date_modified: string;
  status: string;
  currency: string;
  total: string;
  subtotal: string;
  total_tax: string;
  shipping_total: string;
  discount_total: string;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  customer_id: number;
  customer_note: string;
  billing: WooCommerceAddress;
  shipping: WooCommerceAddress;
  line_items: WooCommerceLineItem[];
  shipping_lines: Array<{ method_title: string; total: string }>;
  fee_lines: Array<{ description: string; total: string }>;
  refunds: Array<{ id: number; reason: string; total: string }>;
}

/**
 * WooCommerce address
 */
interface WooCommerceAddress {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email: string;
  phone: string;
}

/**
 * WooCommerce line item
 */
interface WooCommerceLineItem {
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
  sku: string;
  price: string;
  meta_data: Array<{ key: string; value: unknown }>;
}

/**
 * WooCommerce product response
 */
interface WooCommerceProductResponse {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  date_created: string;
  date_modified: string;
  description: string;
  short_description: string;
  sku: string;
  regular_price: string;
  sale_price: string;
  price: string;
  status: string;
  type: string;
  stock_quantity: number;
  manage_stock: boolean;
  categories: Array<{ id: number; name: string }>;
  tags: Array<{ id: number; name: string }>;
  images: Array<{ id: number; src: string; alt: string }>;
  variations: number[];
  attributes: Array<{ id: number; name: string; options: string[] }>;
}

/**
 * WooCommerce product variation
 */
interface WooCommerceVariation {
  id: number;
  product_id: number;
  status: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number;
  manage_stock: boolean;
  attributes: Array<{ id: number; option: string }>;
  image: { id: number; src: string; alt: string };
}

/**
 * WooCommerce customer response
 */
interface WooCommerceCustomerResponse {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
  billing: WooCommerceAddress;
  shipping: WooCommerceAddress;
  is_paying_customer: boolean;
  orders_count: number;
  total_spent: string;
  date_created: string;
  date_modified: string;
  meta_data: Array<{ key: string; value: unknown }>;
}

/**
 * WooCommerce webhook
 */
interface WooCommerceWebhook {
  id: number;
  name: string;
  status: string;
  topic: string;
  delivery_url: string;
  resource: string;
  event: string;
  hooks: string[];
  active: boolean;
  date_created: string;
  date_modified: string;
  secret: string;
}

/**
 * WooCommerce batch request item
 */
interface BatchRequestItem {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
}

/**
 * WooCommerce batch response item
 */
interface BatchResponseItem {
  code: number;
  body: Record<string, unknown>;
}

/**
 * WooCommerce SDK Client
 */
export class WooCommerceClient {
  private config: WooCommerceConfig;
  private baseUrl: string;
  private requestCount = 0;
  private requestWindowStart = Date.now();
  private readonly MAX_REQUESTS_PER_10S = 25;

  constructor(config: WooCommerceConfig) {
    this.config = config;
    this.baseUrl = `${this.config.storeUrl}/wp-json/wc/v3`;
  }

  /**
   * List orders
   */
  async listOrders(options?: {
    status?: string;
    limit?: number;
    page?: number;
    orderby?: string;
    order?: "asc" | "desc";
  }): Promise<{ orders: ECommerceOrder[]; total: number; totalPages: number }> {
    const params = new URLSearchParams({
      per_page: String(options?.limit || 50),
      page: String(options?.page || 1),
      orderby: options?.orderby || "date",
      order: options?.order || "desc",
    });

    if (options?.status) {
      params.append("status", options.status);
    }

    const response = await this.request(
      "GET",
      `/orders?${params}`,
      null,
    ) as { body: WooCommerceOrderResponse[]; headers: Headers };

    return {
      orders: response.body.map((order: WooCommerceOrderResponse) =>
        this.mapWooCommerceOrderToECommerce(order),
      ),
      total: Number(response.headers.get("x-wp-total")) || response.body.length,
      totalPages: Number(response.headers.get("x-wp-totalpages")) || 1,
    };
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<ECommerceOrder> {
    const response = await this.request("GET", `/orders/${orderId}`, null) as { body: WooCommerceOrderResponse; headers: Headers };
    return this.mapWooCommerceOrderToECommerce(response.body);
  }

  /**
   * Create order
   */
  async createOrder(data: {
    billing: Record<string, string>;
    shipping?: Record<string, string>;
    line_items: Array<{ product_id: number; quantity: number }>;
    payment_method?: string;
    customer_id?: number;
    customer_note?: string;
    status?: string;
  }): Promise<ECommerceOrder> {
    const response = await this.request("POST", "/orders", data) as { body: WooCommerceOrderResponse; headers: Headers };
    return this.mapWooCommerceOrderToECommerce(response.body);
  }

  /**
   * Update order
   */
  async updateOrder(
    orderId: string,
    data: Record<string, unknown>,
  ): Promise<ECommerceOrder> {
    const response = await this.request("PUT", `/orders/${orderId}`, data) as { body: WooCommerceOrderResponse; headers: Headers };
    return this.mapWooCommerceOrderToECommerce(response.body);
  }

  /**
   * Add order note
   */
  async addOrderNote(
    orderId: string,
    note: string,
    customerNote: boolean = false,
  ): Promise<{ id: number; note: string }> {
    const response = await this.request(
      "POST",
      `/orders/${orderId}/notes`,
      {
        note,
        customer_note: customerNote,
      },
    ) as { body: { id: number; note: string }; headers: Headers };
    return response.body;
  }

  /**
   * List product categories
   */
  async listCategories(options?: { limit?: number; page?: number }): Promise<Array<{ id: number; name: string }>> {
    const params = new URLSearchParams({
      per_page: String(options?.limit || 100),
      page: String(options?.page || 1),
    });

    const response = await this.request("GET", `/products/categories?${params}`, null) as { body: Array<{ id: number; name: string }>; headers: Headers };
    return response.body;
  }

  /**
   * List products
   */
  async listProducts(options?: {
    status?: string;
    limit?: number;
    page?: number;
    category?: number;
    orderby?: string;
    order?: "asc" | "desc";
  }): Promise<{ products: ECommerceProduct[]; total: number; totalPages: number }> {
    const params = new URLSearchParams({
      per_page: String(options?.limit || 50),
      page: String(options?.page || 1),
      orderby: options?.orderby || "date",
      order: options?.order || "desc",
    });

    if (options?.status) {
      params.append("status", options.status);
    }
    if (options?.category) {
      params.append("category", String(options.category));
    }

    const response = await this.request(
      "GET",
      `/products?${params}`,
      null,
    ) as { body: WooCommerceProductResponse[]; headers: Headers };

    return {
      products: response.body.map((product: WooCommerceProductResponse) =>
        this.mapWooCommerceProductToECommerce(product),
      ),
      total: Number(response.headers.get("x-wp-total")) || response.body.length,
      totalPages: Number(response.headers.get("x-wp-totalpages")) || 1,
    };
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<ECommerceProduct> {
    const response = await this.request("GET", `/products/${productId}`, null) as { body: WooCommerceProductResponse; headers: Headers };
    return this.mapWooCommerceProductToECommerce(response.body);
  }

  /**
   * Create product
   */
  async createProduct(data: {
    name: string;
    description?: string;
    short_description?: string;
    regular_price?: string;
    sku?: string;
    manage_stock?: boolean;
    stock_quantity?: number;
    categories?: Array<{ id: number }>;
  }): Promise<ECommerceProduct> {
    const response = await this.request("POST", "/products", data) as { body: WooCommerceProductResponse; headers: Headers };
    return this.mapWooCommerceProductToECommerce(response.body);
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    data: Record<string, unknown>,
  ): Promise<ECommerceProduct> {
    const response = await this.request(
      "PUT",
      `/products/${productId}`,
      data,
    ) as { body: WooCommerceProductResponse; headers: Headers };
    return this.mapWooCommerceProductToECommerce(response.body);
  }

  /**
   * Delete product
   */
  async deleteProduct(productId: string, force: boolean = true): Promise<void> {
    await this.request("DELETE", `/products/${productId}?force=${force}`, null);
  }

  /**
   * Create product variation
   */
  async createVariation(
    productId: string,
    data: {
      sku?: string;
      regular_price?: string;
      sale_price?: string;
      manage_stock?: boolean;
      stock_quantity?: number;
      attributes?: Array<{ id: number; option: string }>;
    },
  ): Promise<WooCommerceVariation> {
    const response = await this.request(
      "POST",
      `/products/${productId}/variations`,
      data,
    ) as { body: WooCommerceVariation; headers: Headers };
    return response.body;
  }

  /**
   * Update product variation
   */
  async updateVariation(
    productId: string,
    variationId: string,
    data: Record<string, unknown>,
  ): Promise<WooCommerceVariation> {
    const response = await this.request(
      "PUT",
      `/products/${productId}/variations/${variationId}`,
      data,
    ) as { body: WooCommerceVariation; headers: Headers };
    return response.body;
  }

  /**
   * List product variations
   */
  async listVariations(
    productId: string,
    options?: { limit?: number; page?: number },
  ): Promise<WooCommerceVariation[]> {
    const params = new URLSearchParams({
      per_page: String(options?.limit || 100),
      page: String(options?.page || 1),
    });

    const response = await this.request(
      "GET",
      `/products/${productId}/variations?${params}`,
      null,
    ) as { body: WooCommerceVariation[]; headers: Headers };
    return response.body;
  }

  /**
   * List customers
   */
  async listCustomers(options?: {
    limit?: number;
    page?: number;
    orderby?: string;
    order?: "asc" | "desc";
  }): Promise<{ customers: ECommerceCustomer[]; total: number; totalPages: number }> {
    const params = new URLSearchParams({
      per_page: String(options?.limit || 50),
      page: String(options?.page || 1),
      orderby: options?.orderby || "date",
      order: options?.order || "desc",
    });

    const response = await this.request(
      "GET",
      `/customers?${params}`,
      null,
    ) as { body: WooCommerceCustomerResponse[]; headers: Headers };

    return {
      customers: response.body.map((customer: WooCommerceCustomerResponse) =>
        this.mapWooCommerceCustomerToECommerce(customer),
      ),
      total: Number(response.headers.get("x-wp-total")) || response.body.length,
      totalPages: Number(response.headers.get("x-wp-totalpages")) || 1,
    };
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<ECommerceCustomer> {
    const response = await this.request("GET", `/customers/${customerId}`, null) as { body: WooCommerceCustomerResponse; headers: Headers };
    return this.mapWooCommerceCustomerToECommerce(response.body);
  }

  /**
   * Create customer
   */
  async createCustomer(data: {
    email: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    password?: string;
    billing?: Record<string, string>;
    shipping?: Record<string, string>;
  }): Promise<ECommerceCustomer> {
    const response = await this.request("POST", "/customers", data) as { body: WooCommerceCustomerResponse; headers: Headers };
    return this.mapWooCommerceCustomerToECommerce(response.body);
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    data: Record<string, unknown>,
  ): Promise<ECommerceCustomer> {
    const response = await this.request(
      "PUT",
      `/customers/${customerId}`,
      data,
    ) as { body: WooCommerceCustomerResponse; headers: Headers };
    return this.mapWooCommerceCustomerToECommerce(response.body);
  }

  /**
   * Update inventory/stock
   */
  async updateInventory(
    request: InventoryUpdateRequest,
  ): Promise<ECommerceInventory> {
    // WooCommerce uses product variations for stock
    const data = {
      stock_quantity: request.quantity,
    };

    const response = await this.request(
      "PUT",
      `/products/${request.variantId}`,
      data,
    ) as { body: { stock_quantity: number; manage_stock: boolean; backorders_allowed: boolean }; headers: Headers };

    return {
      variantId: request.variantId,
      quantity: response.body.stock_quantity,
      trackQuantity: response.body.manage_stock,
      allowNegativeStock: !response.body.backorders_allowed === false,
      updatedAt: new Date(),
    };
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(threshold: number = 10): Promise<ECommerceProduct[]> {
    const response = await this.request(
      "GET",
      `/reports/low_stock?limit=${threshold}`,
      null,
    ) as { body: Array<{ product_id: number; name: string; stock: number }>; headers: Headers };

    return response.body.map((item: { product_id: number; name: string; stock: number }) => ({
      id: String(item.product_id),
      title: item.name,
      variants: [
        {
          id: String(item.product_id),
          sku: "",
          price: 0,
          inventory: {
            variantId: String(item.product_id),
            quantity: item.stock,
            trackQuantity: true,
            allowNegativeStock: false,
            updatedAt: new Date(),
          },
        },
      ],
      status: "active" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  /**
   * List shipping zones
   */
  async listShippingZones(): Promise<Array<{ id: number; name: string }>> {
    const response = await this.request("GET", "/shipping/zones", null) as { body: Array<{ id: number; name: string }>; headers: Headers };
    return response.body;
  }

  /**
   * List shipping methods for a zone
   */
  async listShippingMethods(zoneId: string): Promise<Array<{ id: number; title: string; method_id: string }>> {
    const response = await this.request(
      "GET",
      `/shipping/zones/${zoneId}/methods`,
      null,
    ) as { body: Array<{ id: number; title: string; method_id: string }>; headers: Headers };
    return response.body;
  }

  /**
   * List shipping classes
   */
  async listShippingClasses(): Promise<Array<{ id: number; name: string; description: string }>> {
    const response = await this.request(
      "GET",
      "/products/shipping_classes",
      null,
    ) as { body: Array<{ id: number; name: string; description: string }>; headers: Headers };
    return response.body;
  }

  /**
   * Create webhook
   */
  async createWebhook(
    topic: string,
    deliveryUrl: string,
  ): Promise<WooCommerceWebhook> {
    const response = await this.request("POST", "/webhooks", {
      topic,
      delivery_url: deliveryUrl,
    }) as { body: WooCommerceWebhook; headers: Headers };
    return response.body;
  }

  /**
   * List webhooks
   */
  async listWebhooks(): Promise<WooCommerceWebhook[]> {
    const response = await this.request("GET", "/webhooks", null) as { body: WooCommerceWebhook[]; headers: Headers };
    return response.body;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string, force: boolean = true): Promise<void> {
    await this.request(
      "DELETE",
      `/webhooks/${webhookId}?force=${force}`,
      null,
    );
  }

  /**
   * Batch operations (max 100 items per request)
   */
  async batch(requests: BatchRequestItem[]): Promise<BatchResponseItem[]> {
    if (requests.length > 100) {
      throw new Error("Batch operations limited to 100 items per request");
    }

    const response = await this.request("POST", "/batch", {
      requests,
    }) as { body: BatchResponseItem[]; headers: Headers };

    return response.body;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: unknown,
    signature: string,
  ): boolean {
    if (!this.config.webhookSecret) {
      return false;
    }

    const payloadStr =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    const computed = createHmac("sha256", this.config.webhookSecret)
      .update(payloadStr)
      .digest("base64");

    return computed === signature;
  }

  /**
   * Make HTTP request with OAuth1 signature
   */
  private async request(
    method: string,
    path: string,
    body: unknown,
  ): Promise<unknown> {
    // Handle rate limiting (25 requests per 10 seconds)
    await this.handleRateLimit();

    const url = `${this.baseUrl}${path}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = this.generateNonce();

    // Generate OAuth1 signature
    const signature = this.generateOAuth1Signature(
      method,
      url,
      this.config.consumerKey,
      this.config.consumerSecret,
      timestamp,
      nonce,
    );

    const authHeader = `OAuth oauth_consumer_key="${this.config.consumerKey}", oauth_nonce="${nonce}", oauth_signature="${signature}", oauth_signature_method="HMAC-SHA256", oauth_timestamp="${timestamp}", oauth_version="1.0"`;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `WooCommerce API error: ${response.status} ${JSON.stringify(data)}`,
      );
    }

    return { body: data, headers: response.headers };
  }

  /**
   * Handle rate limiting (25 requests per 10 seconds)
   */
  private async handleRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceWindowStart = now - this.requestWindowStart;

    if (timeSinceWindowStart >= 10000) {
      // Reset window
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    if (this.requestCount >= this.MAX_REQUESTS_PER_10S) {
      const waitTime =
        10000 - timeSinceWindowStart + 100;
      await new Promise((resolve) =>
        setTimeout(resolve, waitTime),
      );
      this.requestCount = 0;
      this.requestWindowStart = Date.now();
    }

    this.requestCount++;
  }

  /**
   * Generate OAuth1 signature
   */
  private generateOAuth1Signature(
    method: string,
    url: string,
    consumerKey: string,
    consumerSecret: string,
    timestamp: number,
    nonce: string,
  ): string {
    const baseString = [
      method,
      encodeURIComponent(url),
      encodeURIComponent(
        `oauth_consumer_key=${consumerKey}&oauth_nonce=${nonce}&oauth_signature_method=HMAC-SHA256&oauth_timestamp=${timestamp}&oauth_version=1.0`,
      ),
    ]
      .join("&");

    const signingKey = `${encodeURIComponent(consumerSecret)}&`;
    const signature = createHmac("sha256", signingKey)
      .update(baseString)
      .digest("base64");

    return signature;
  }

  /**
   * Generate random nonce
   */
  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  }

  /**
   * Map WooCommerce order to ECommerce order
   */
  private mapWooCommerceOrderToECommerce(
    order: WooCommerceOrderResponse,
  ): ECommerceOrder {
    return {
      id: String(order.id),
      externalId: order.order_number,
      status: this.mapWooCommerceOrderStatus(order.status),
      paymentStatus: "captured" as const,
      fulfillmentStatus: "pending" as const,
      currency: order.currency,
      totalAmount: parseFloat(order.total),
      subtotalAmount: parseFloat(order.subtotal),
      taxAmount: parseFloat(order.total_tax),
      shippingAmount: parseFloat(order.shipping_total),
      discountAmount: parseFloat(order.discount_total),
      customer: {
        id: String(order.customer_id),
        email: order.billing.email,
        firstName: order.billing.first_name,
        lastName: order.billing.last_name,
        phone: order.billing.phone,
        acceptsMarketing: false,
        createdAt: new Date(order.date_created),
        updatedAt: new Date(order.date_modified),
      },
      billingAddress: this.mapWooCommerceAddress(order.billing),
      shippingAddress: this.mapWooCommerceAddress(order.shipping),
      lineItems: order.line_items.map((item) => ({
        id: String(item.id),
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        price: parseFloat(item.price),
        taxAmount: parseFloat(item.total_tax),
        discountAmount: 0,
        totalAmount: parseFloat(item.total),
        variantId: String(item.variation_id || item.product_id),
      })),
      paymentMethod: order.payment_method_title,
      notes: order.customer_note,
      createdAt: new Date(order.date_created),
      updatedAt: new Date(order.date_modified),
    };
  }

  /**
   * Map WooCommerce product to ECommerce product
   */
  private mapWooCommerceProductToECommerce(
    product: WooCommerceProductResponse,
  ): ECommerceProduct {
    return {
      id: String(product.id),
      title: product.name,
      description: product.description?.replace(/<[^>]*>/g, ""),
      status: product.status as "active" | "draft" | "archived",
      productType: product.type,
      variants: product.variations.length > 0
        ? product.variations.map((varId) => ({
            id: String(varId),
            sku: "",
            price: parseFloat(product.price),
            inventory: {
              variantId: String(varId),
              quantity: product.stock_quantity,
              trackQuantity: product.manage_stock,
              allowNegativeStock: false,
              updatedAt: new Date(),
            },
          }))
        : [
            {
              id: String(product.id),
              sku: product.sku,
              price: parseFloat(product.price),
              inventory: {
                variantId: String(product.id),
                quantity: product.stock_quantity,
                trackQuantity: product.manage_stock,
                allowNegativeStock: false,
                updatedAt: new Date(),
              },
            },
          ],
      images: product.images.map((img) => ({
        url: img.src,
        altText: img.alt,
      })),
      category: product.categories.length > 0
        ? {
            id: String(product.categories[0].id),
            name: product.categories[0].name,
          }
        : undefined,
      createdAt: new Date(product.date_created),
      updatedAt: new Date(product.date_modified),
    };
  }

  /**
   * Map WooCommerce customer to ECommerce customer
   */
  private mapWooCommerceCustomerToECommerce(
    customer: WooCommerceCustomerResponse,
  ): ECommerceCustomer {
    return {
      id: String(customer.id),
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      acceptsMarketing: false,
      defaultAddress: this.mapWooCommerceAddress(customer.billing),
      addresses: [
        this.mapWooCommerceAddress(customer.billing),
        this.mapWooCommerceAddress(customer.shipping),
      ],
      createdAt: new Date(customer.date_created),
      updatedAt: new Date(customer.date_modified),
    };
  }

  /**
   * Map WooCommerce address
   */
  private mapWooCommerceAddress(addr: WooCommerceAddress): {
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
      address1: addr.address_1,
      address2: addr.address_2,
      city: addr.city,
      province: addr.state,
      postalCode: addr.postcode,
      country: addr.country,
      phone: addr.phone,
      email: addr.email,
    };
  }

  /**
   * Map WooCommerce order status
   */
  private mapWooCommerceOrderStatus(status: string): "pending" | "confirmed" | "processing" | "dispatched" | "out_for_delivery" | "delivered" | "cancelled" | "refunded" | "failed" {
    const mapping: Record<string, "pending" | "confirmed" | "processing" | "dispatched" | "out_for_delivery" | "delivered" | "cancelled" | "refunded" | "failed"> = {
      pending: "pending",
      processing: "processing",
      "on-hold": "confirmed",
      completed: "delivered",
      cancelled: "cancelled",
      refunded: "refunded",
      failed: "failed",
    };
    return mapping[status] || "pending";
  }
}

/**
 * Factory function to create WooCommerce client
 */
export function createWooCommerceClient(config: WooCommerceConfig): WooCommerceClient {
  return new WooCommerceClient(config);
}
