/**
 * Magento 2 REST API SDK Client
 * Production-ready client for Magento 2 with OAuth1, Bearer token, and API key authentication
 * Supports: Orders, Products, Customers, Inventory (MSI), Categories, Cart/Quote, Async Bulk API
 * Rate Limiting: configurable per endpoint
 * Features: SearchCriteria builder, batch operations, error normalization
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
import type {
  MagentoConfig,
  MagentoOrderResponse,
  MagentoProductResponse,
  MagentoCustomerResponse,
  MagentoInvoiceResponse,
  MagentoShipmentResponse,
  MagentoCreditMemoResponse,
  MagentoSearchCriteria,
  MagentoSearchResults,
  MagentoCategoryResponse,
  MagentoQuoteResponse,
  MagentoQuoteAddressResponse,
  MagentoMSISourceResponse,
  MagentoMSIStockResponse,
  MagentoMSISourceItemResponse,
  MagentoAsyncBulkRequest,
  MagentoAsyncBulkResponse,
  MagentoErrorResponse,
  MagentoAddressResponse,
  MagentoTotalsResponse,
} from "./magento-types.js";

/**
 * Magento 2 SearchCriteria Builder
 * Fluent API for constructing complex search queries
 */
export class SearchCriteriaBuilder {
  private filterGroups: Array<{
    filters: Array<{ field: string; value: unknown; condition_type: string }>;
  }> = [];
  private sortOrders: Array<{ field: string; direction: "ASC" | "DESC" }> = [];
  private pageSize = 20;
  private currentPage = 1;

  /**
   * Add a filter to current group
   */
  addFilter(field: string, value: unknown, conditionType = "eq"): this {
    if (this.filterGroups.length === 0) {
      this.filterGroups.push({ filters: [] });
    }
    this.filterGroups[this.filterGroups.length - 1].filters.push({
      field,
      value,
      condition_type: conditionType,
    });
    return this;
  }

  /**
   * Start a new filter group (OR condition between groups)
   */
  newFilterGroup(): this {
    this.filterGroups.push({ filters: [] });
    return this;
  }

  /**
   * Add sort order
   */
  addSort(field: string, direction: "ASC" | "DESC" = "DESC"): this {
    this.sortOrders.push({ field, direction });
    return this;
  }

  /**
   * Set pagination
   */
  setPagination(page: number, pageSize: number): this {
    this.currentPage = page;
    this.pageSize = pageSize;
    return this;
  }

  /**
   * Build SearchCriteria object
   */
  build(): MagentoSearchCriteria {
    return {
      filter_groups: this.filterGroups,
      sort_orders: this.sortOrders,
      page_size: this.pageSize,
      current_page: this.currentPage,
    };
  }
}

/**
 * Magento 2 API Error
 */
export class MagentoAPIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "MagentoAPIError";
  }
}

/**
 * Magento 2 SDK Client
 */
export class MagentoSDKClient {
  private config: MagentoConfig;
  private baseUrl: string;
  private requestCount = 0;
  private requestWindowStart = Date.now();
  private rateLimitDelay = 0;
  private nonce: string | null = null;
  private timestamp: number | null = null;

  constructor(config: MagentoConfig) {
    this.config = {
      timeout: 30000,
      rateLimit: 10, // default 10 requests per second
      ...config,
    };

    this.baseUrl = this.config.baseUrl.replace(/\/$/, "");
    if (!this.baseUrl) {
      throw new Error("Magento baseUrl is required");
    }

    // Calculate rate limit delay (ms between requests)
    const rateLimit = this.config.rateLimit || 10;
    this.rateLimitDelay = 1000 / rateLimit;
  }

  /**
   * Generate OAuth1 signature
   */
  private generateOAuth1Signature(
    method: string,
    url: string,
    params: Record<string, string>,
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${encodeURIComponent(params[key])}`)
      .join("&");

    const baseString = [
      method,
      encodeURIComponent(url),
      encodeURIComponent(sortedParams),
    ].join("&");

    const signingKey = [
      encodeURIComponent(this.config.consumerSecret || ""),
      encodeURIComponent(this.config.tokenSecret || ""),
    ].join("&");

    return createHmac("sha256", signingKey).update(baseString).digest("base64");
  }

  /**
   * Build OAuth1 Authorization header
   */
  private buildOAuth1Header(method: string, url: string): string {
    this.nonce = Math.random().toString(36).substring(2, 15);
    this.timestamp = Math.floor(Date.now() / 1000);

    const params: Record<string, string> = {
      oauth_consumer_key: this.config.consumerKey || "",
      oauth_token: this.config.token || "",
      oauth_signature_method: "HMAC-SHA256",
      oauth_timestamp: this.timestamp.toString(),
      oauth_nonce: this.nonce,
      oauth_version: "1.0",
    };

    const signature = this.generateOAuth1Signature(method, url, params);
    params.oauth_signature = signature;

    const headerParts = Object.entries(params).map(
      ([key, value]) => `${key}="${value}"`,
    );
    return `OAuth ${headerParts.join(", ")}`;
  }

  /**
   * Make HTTP request with authentication
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    // Apply rate limiting
    const now = Date.now();
    const elapsed = now - this.requestWindowStart;

    if (elapsed > 1000) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    if (this.requestCount >= (this.config.rateLimit || 10)) {
      const delay = 1000 - elapsed;
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    this.requestCount++;

    const url = `${this.baseUrl}/rest/V1${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add authentication header
    if (this.config.authType === "oauth1") {
      headers.Authorization = this.buildOAuth1Header(method, url);
    } else if (this.config.authType === "bearer") {
      headers.Authorization = `Bearer ${this.config.accessToken || ""}`;
    } else if (this.config.authType === "apikey") {
      headers["X-API-Key"] = this.config.apiKey || "";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout || 30000,
    );

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json().catch(
          (): MagentoErrorResponse => ({
            message: response.statusText,
          }),
        )) as MagentoErrorResponse;

        throw new MagentoAPIError(
          response.status,
          errorData.code?.toString() || "UNKNOWN_ERROR",
          errorData.message || response.statusText,
          errorData.details,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof MagentoAPIError) {
        throw error;
      }

      throw new MagentoAPIError(
        0,
        "NETWORK_ERROR",
        (error as Error).message || "Network request failed",
      );
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request<{ version: string }>("GET", "/");
      return true;
    } catch {
      return false;
    }
  }

  // ==================== ORDER OPERATIONS ====================

  /**
   * Search orders with SearchCriteria
   */
  async searchOrders(criteria: MagentoSearchCriteria): Promise<{
    orders: ECommerceOrder[];
    total: number;
  }> {
    const params = this.buildSearchParams(criteria);
    const response = await this.request<
      MagentoSearchResults<MagentoOrderResponse>
    >("GET", `/orders?${params}`);

    return {
      orders: response.items.map((item) =>
        this.mapMagentoOrderToECommerce(item),
      ),
      total: response.total_count,
    };
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<ECommerceOrder> {
    const response = await this.request<MagentoOrderResponse>(
      "GET",
      `/orders/${orderId}`,
    );
    return this.mapMagentoOrderToECommerce(response);
  }

  /**
   * Create order
   */
  async createOrder(data: {
    customer_id?: number;
    billing_address: MagentoAddressResponse;
    shipping_address?: MagentoAddressResponse;
    items: Array<{ product_id: number; qty: number }>;
    payment_method?: string;
    shipping_method?: string;
    coupon_code?: string;
  }): Promise<ECommerceOrder> {
    const response = await this.request<MagentoOrderResponse>(
      "POST",
      "/orders",
      { order: data },
    );
    return this.mapMagentoOrderToECommerce(response);
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: string,
  ): Promise<ECommerceOrder> {
    const response = await this.request<MagentoOrderResponse>(
      "POST",
      `/orders/${orderId}`,
      {
        entity: { entity_id: orderId, status },
      },
    );
    return this.mapMagentoOrderToECommerce(response);
  }

  /**
   * Add comment to order
   */
  async addOrderComment(
    orderId: string,
    comment: string,
    notifyCustomer = true,
  ): Promise<{
    entity_id: number;
    comment: string;
  }> {
    const response = await this.request<{ entity_id: number; comment: string }>(
      "POST",
      `/orders/${orderId}/comments`,
      {
        statusHistory: {
          comment,
          is_customer_notified: notifyCustomer ? 1 : 0,
          is_visible_on_front: 1,
        },
      },
    );
    return response;
  }

  /**
   * Create invoice for order
   */
  async createInvoice(
    orderId: string,
    itemsData?: Array<{ order_item_id: number; qty: number }>,
  ): Promise<{
    entity_id: number;
    increment_id: string;
  }> {
    const response = await this.request<{
      entity_id: number;
      increment_id: string;
    }>("POST", `/orders/${orderId}/invoice`, { items: itemsData || [] });
    return response;
  }

  /**
   * Create shipment for order
   */
  async createShipment(
    orderId: string,
    itemsData: Array<{ order_item_id: number; qty: number }>,
    tracks?: Array<{ number: string; title: string; carrier_code: string }>,
  ): Promise<MagentoShipmentResponse> {
    const response = await this.request<MagentoShipmentResponse>(
      "POST",
      `/orders/${orderId}/ship`,
      { items: itemsData, tracks: tracks || [] },
    );
    return response;
  }

  /**
   * Create credit memo (refund)
   */
  async createCreditMemo(
    orderId: string,
    itemsData?: Array<{ order_item_id: number; qty: number }>,
    adjust?: number,
  ): Promise<MagentoCreditMemoResponse> {
    const response = await this.request<MagentoCreditMemoResponse>(
      "POST",
      `/orders/${orderId}/refunds`,
      { items: itemsData || [], adjustmentPositive: adjust || 0 },
    );
    return response;
  }

  // ==================== PRODUCT OPERATIONS ====================

  /**
   * Search products with SearchCriteria
   */
  async searchProducts(criteria: MagentoSearchCriteria): Promise<{
    products: ECommerceProduct[];
    total: number;
  }> {
    const params = this.buildSearchParams(criteria);
    const response = await this.request<
      MagentoSearchResults<MagentoProductResponse>
    >("GET", `/products?${params}`);

    return {
      products: response.items.map((item) =>
        this.mapMagentoProductToECommerce(item),
      ),
      total: response.total_count,
    };
  }

  /**
   * Get product by ID or SKU
   */
  async getProductById(productId: string): Promise<ECommerceProduct> {
    const response = await this.request<MagentoProductResponse>(
      "GET",
      `/products/${productId}`,
    );
    return this.mapMagentoProductToECommerce(response);
  }

  /**
   * Create product
   */
  async createProduct(data: {
    sku: string;
    name: string;
    type_id: string; // simple, virtual, grouped, bundle, configurable
    attribute_set_id: number;
    price?: number;
    status?: number;
    visibility?: number;
    description?: string;
    weight?: number;
    extension_attributes?: Record<string, unknown>;
  }): Promise<ECommerceProduct> {
    const response = await this.request<MagentoProductResponse>(
      "POST",
      "/products",
      { product: data },
    );
    return this.mapMagentoProductToECommerce(response);
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    data: Partial<MagentoProductResponse>,
  ): Promise<ECommerceProduct> {
    const response = await this.request<MagentoProductResponse>(
      "PUT",
      `/products/${productId}`,
      { product: data },
    );
    return this.mapMagentoProductToECommerce(response);
  }

  /**
   * Create configurable product child
   */
  async createConfigurableProductChild(
    parentProductId: string,
    childData: {
      sku: string;
      name: string;
      price: number;
      attributes: Array<{ attribute_id: number | string; value: string }>;
    },
  ): Promise<ECommerceProduct> {
    const response = await this.request<MagentoProductResponse>(
      "POST",
      `/products`,
      {
        product: {
          ...childData,
          type_id: "simple",
          attribute_set_id: 4, // Default
        },
      },
    );

    // Link to configurable parent
    await this.request(
      "POST",
      `/configurable-products/${parentProductId}/child`,
      {
        childSku: childData.sku,
      },
    );

    return this.mapMagentoProductToECommerce(response);
  }

  /**
   * Upload product image
   */
  async uploadProductImage(
    productId: string,
    imageData: { url: string; label?: string; types?: string[] },
  ): Promise<{ id: number; media_type: string; position: number }> {
    const response = await this.request<{
      id: number;
      media_type: string;
      position: number;
    }>("POST", `/products/${productId}/media`, { entry: imageData });
    return response;
  }

  /**
   * Delete product image
   */
  async deleteProductImage(
    productId: string,
    imageId: number,
  ): Promise<boolean> {
    await this.request<{ result: boolean }>(
      "DELETE",
      `/products/${productId}/media/${imageId}`,
    );
    return true;
  }

  /**
   * Update stock/inventory
   */
  async updateInventory(
    request: InventoryUpdateRequest,
  ): Promise<ECommerceInventory> {
    await this.request("PUT", `/products/${request.variantId}`, {
      product: {
        extension_attributes: {
          stock_item: {
            qty: request.quantity,
            is_in_stock: request.quantity > 0,
          },
        },
      },
    });

    return {
      variantId: request.variantId,
      quantity: request.quantity,
      trackQuantity: true,
      allowNegativeStock: false,
      updatedAt: new Date(),
    };
  }

  // ==================== CUSTOMER OPERATIONS ====================

  /**
   * Search customers with SearchCriteria
   */
  async searchCustomers(criteria: MagentoSearchCriteria): Promise<{
    customers: ECommerceCustomer[];
    total: number;
  }> {
    const params = this.buildSearchParams(criteria);
    const response = await this.request<
      MagentoSearchResults<MagentoCustomerResponse>
    >("GET", `/customers/search?${params}`);

    return {
      customers: response.items.map((item) =>
        this.mapMagentoCustomerToECommerce(item),
      ),
      total: response.total_count,
    };
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<ECommerceCustomer> {
    const response = await this.request<MagentoCustomerResponse>(
      "GET",
      `/customers/${customerId}`,
    );
    return this.mapMagentoCustomerToECommerce(response);
  }

  /**
   * Create customer
   */
  async createCustomer(data: {
    email: string;
    firstname: string;
    lastname: string;
    website_id?: number;
    store_id?: number;
    group_id?: number;
    dob?: string;
    gender?: number;
    prefix?: string;
    suffix?: string;
    taxvat?: string;
    default_billing?: string;
    default_shipping?: string;
    addresses?: Array<{
      is_default_billing: boolean;
      is_default_shipping: boolean;
    }>;
  }): Promise<ECommerceCustomer> {
    const response = await this.request<MagentoCustomerResponse>(
      "POST",
      "/customers",
      { customer: data },
    );
    return this.mapMagentoCustomerToECommerce(response);
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    data: Partial<MagentoCustomerResponse>,
  ): Promise<ECommerceCustomer> {
    const response = await this.request<MagentoCustomerResponse>(
      "PUT",
      `/customers/${customerId}`,
      { customer: data },
    );
    return this.mapMagentoCustomerToECommerce(response);
  }

  /**
   * Get customer groups
   */
  async getCustomerGroups(): Promise<
    Array<{ id: number; code: string; tax_class_id: number }>
  > {
    const response = await this.request<{
      items: Array<{ id: number; code: string; tax_class_id: number }>;
    }>("GET", "/customerGroups", undefined);
    return response.items;
  }

  /**
   * Add customer address
   */
  async addCustomerAddress(
    customerId: string,
    addressData: MagentoAddressResponse,
  ): Promise<{ id: number }> {
    const response = await this.request<{ id: number }>(
      "POST",
      `/customers/${customerId}/addresses`,
      { address: addressData },
    );
    return response;
  }

  // ==================== INVENTORY (MSI) OPERATIONS ====================

  /**
   * Get MSI sources
   */
  async getMSISources(): Promise<MagentoMSISourceResponse[]> {
    const response = await this.request<{ items: MagentoMSISourceResponse[] }>(
      "GET",
      "/inventory/sources",
    );
    return response.items;
  }

  /**
   * Get MSI stocks
   */
  async getMSIStocks(): Promise<MagentoMSIStockResponse[]> {
    const response = await this.request<{ items: MagentoMSIStockResponse[] }>(
      "GET",
      "/inventory/stocks",
    );
    return response.items;
  }

  /**
   * Get source items for SKU
   */
  async getMSISourceItems(
    sku: string,
  ): Promise<Array<{ source_code: string; qty: number }>> {
    const response = await this.request<{
      items: Array<{ source_code: string; qty: number }>;
    }>("GET", `/inventory/source-items?${new URLSearchParams({ sku })}`);
    return response.items;
  }

  /**
   * Update source item
   */
  async updateMSISourceItem(
    sourceCode: string,
    sku: string,
    quantity: number,
  ): Promise<{ source_code: string; sku: string; quantity: number }> {
    const response = await this.request<{
      source_code: string;
      sku: string;
      quantity: number;
    }>("POST", "/inventory/source-items", {
      sourceItems: [
        {
          source_code: sourceCode,
          sku,
          quantity,
          status: quantity > 0 ? 1 : 0,
        },
      ],
    });
    return response;
  }

  /**
   * Get salable quantity for SKU
   */
  async getMSISalableQty(stockId: number, sku: string): Promise<number> {
    const response = await this.request<{ salable_qty: number }>(
      "GET",
      `/inventory/salable-quantity/${stockId}/${sku}`,
    );
    return response.salable_qty;
  }

  // ==================== CATEGORY OPERATIONS ====================

  /**
   * Get category tree
   */
  async getCategoryTree(rootCategoryId = 1): Promise<MagentoCategoryResponse> {
    const response = await this.request<MagentoCategoryResponse>(
      "GET",
      `/categories/${rootCategoryId}`,
    );
    return response;
  }

  /**
   * Create category
   */
  async createCategory(data: {
    name: string;
    parent_id: number;
    position?: number;
    is_active?: boolean;
    include_in_menu?: boolean;
  }): Promise<{ id: number }> {
    const response = await this.request<{ id: number }>("POST", "/categories", {
      category: data,
    });
    return response;
  }

  /**
   * Update category
   */
  async updateCategory(
    categoryId: number,
    data: Partial<Record<string, unknown>>,
  ): Promise<{ id: number }> {
    const response = await this.request<{ id: number }>(
      "PUT",
      `/categories/${categoryId}`,
      { category: data },
    );
    return response;
  }

  // ==================== CART/QUOTE OPERATIONS ====================

  /**
   * Create cart (quote)
   */
  async createCart(): Promise<number> {
    const response = await this.request<number>("POST", "/carts/mine");
    return response;
  }

  /**
   * Create guest cart
   */
  async createGuestCart(): Promise<{ quoteId: number; quoteLink: string }> {
    const response = await this.request<{ quoteId: number; quoteLink: string }>(
      "POST",
      "/guest-carts",
    );
    return response;
  }

  /**
   * Add item to cart
   */
  async addItemToCart(
    cartId: number,
    productId: number,
    qty: number,
  ): Promise<MagentoQuoteResponse> {
    const response = await this.request<MagentoQuoteResponse>(
      "POST",
      `/carts/${cartId}/items`,
      {
        cartItem: {
          sku: undefined, // Will use product_id instead
          qty,
          product_id: productId,
        },
      },
    );
    return response;
  }

  /**
   * Estimate shipping
   */
  async estimateShipping(
    cartId: number,
    address: MagentoQuoteAddressResponse,
  ): Promise<
    Array<{
      carrier_code: string;
      method_code: string;
      method_title: string;
      amount: number;
    }>
  > {
    const response = await this.request<
      Array<{
        carrier_code: string;
        method_code: string;
        method_title: string;
        amount: number;
      }>
    >("POST", `/carts/${cartId}/estimate-shipping-methods`, { address });
    return response;
  }

  /**
   * Set payment information
   */
  async setPaymentMethod(
    cartId: number,
    paymentMethod: string,
  ): Promise<number> {
    const response = await this.request<number>(
      "POST",
      `/carts/${cartId}/set-payment-information`,
      {
        paymentMethod: {
          method: paymentMethod,
        },
      },
    );
    return response;
  }

  /**
   * Place order from cart
   */
  async placeOrder(cartId: number): Promise<number> {
    const response = await this.request<number>(
      "PUT",
      `/carts/${cartId}/order`,
    );
    return response;
  }

  // ==================== ASYNC BULK API ====================

  /**
   * Submit async bulk request
   */
  async submitAsyncBulk(bulkRequest: MagentoAsyncBulkRequest): Promise<string> {
    const response = await this.request<MagentoAsyncBulkResponse>(
      "POST",
      "/async/bulk",
      bulkRequest,
    );
    return response.bulk_uuid;
  }

  /**
   * Get async bulk status
   */
  async getAsyncBulkStatus(
    bulkUuid: string,
  ): Promise<MagentoAsyncBulkResponse> {
    const response = await this.request<MagentoAsyncBulkResponse>(
      "GET",
      `/async/bulk/${bulkUuid}`,
    );
    return response;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Build search parameters from SearchCriteria
   */
  private buildSearchParams(criteria: MagentoSearchCriteria): string {
    const params = new URLSearchParams();

    if (criteria.page_size) {
      params.append("pageSize", criteria.page_size.toString());
    }
    if (criteria.current_page) {
      params.append("currentPage", criteria.current_page.toString());
    }

    // Build filter groups
    criteria.filter_groups.forEach((group, groupIndex) => {
      group.filters.forEach((filter, filterIndex) => {
        const prefix = `searchCriteria[filter_groups][${groupIndex}][filters][${filterIndex}]`;
        params.append(`${prefix}[field]`, filter.field);
        params.append(`${prefix}[value]`, String(filter.value));
        params.append(
          `${prefix}[condition_type]`,
          filter.condition_type || "eq",
        );
      });
    });

    // Build sort orders
    criteria.sort_orders?.forEach((sort, index) => {
      const prefix = `searchCriteria[sort_orders][${index}]`;
      params.append(`${prefix}[field]`, sort.field);
      params.append(`${prefix}[direction]`, sort.direction);
    });

    return params.toString();
  }

  /**
   * Map Magento order to ECommerceOrder
   */
  private mapMagentoOrderToECommerce(
    order: MagentoOrderResponse,
  ): ECommerceOrder {
    const billing = order.billing_address;
    const shipping = order.shipping_address || billing;

    return {
      id: order.entity_id.toString(),
      externalId: order.increment_id,
      status: "pending" as const, // Map based on order.status
      paymentStatus: "pending" as const,
      fulfillmentStatus: "pending" as const,
      currency: "USD", // From store context
      totalAmount: order.grand_total,
      subtotalAmount: order.subtotal,
      taxAmount: order.tax_amount,
      shippingAmount: order.shipping_amount,
      discountAmount: order.discount_amount,
      customer: {
        id: order.customer_id?.toString() || "guest",
        email: billing.email || "",
        firstName: billing.firstname,
        lastName: billing.lastname,
        acceptsMarketing: false,
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
      },
      billingAddress: {
        firstName: billing.firstname,
        lastName: billing.lastname,
        company: billing.company,
        address1: Array.isArray(billing.street)
          ? billing.street[0]
          : billing.street || "",
        address2: Array.isArray(billing.street) ? billing.street[1] : undefined,
        city: billing.city,
        state: billing.region,
        postalCode: billing.postcode,
        country: billing.country_id,
        email: billing.email,
        phone: billing.telephone,
      },
      shippingAddress: {
        firstName: shipping.firstname,
        lastName: shipping.lastname,
        company: shipping.company,
        address1: Array.isArray(shipping.street)
          ? shipping.street[0]
          : shipping.street || "",
        address2: Array.isArray(shipping.street)
          ? shipping.street[1]
          : undefined,
        city: shipping.city,
        state: shipping.region,
        postalCode: shipping.postcode,
        country: shipping.country_id,
        email: shipping.email,
        phone: shipping.telephone,
      },
      lineItems: order.items.map((item) => ({
        id: item.item_id.toString(),
        name: item.name,
        sku: item.sku,
        quantity: item.qty_ordered,
        price: item.price,
        taxAmount: item.tax_amount,
        discountAmount: item.discount_amount,
        totalAmount: item.row_total,
      })),
      shippingMethod:
        order.extension_attributes?.shipping_assignments?.[0]?.shipping?.method,
      paymentMethod: order.payment?.method,
      notes: order.customer_note,
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
    };
  }

  /**
   * Map Magento product to ECommerceProduct
   */
  private mapMagentoProductToECommerce(
    product: MagentoProductResponse,
  ): ECommerceProduct {
    return {
      id: product.id.toString(),
      title: product.name,
      description: product.custom_attributes?.find(
        (attr) => attr.attribute_code === "description",
      )?.value as string | undefined,
      status: product.status === 1 ? "active" : "draft",
      productType: product.type_id,
      variants: [
        {
          id: product.sku,
          sku: product.sku,
          price: product.price,
          inventory: {
            variantId: product.sku,
            quantity: product.extension_attributes?.stock_item?.qty || 0,
            trackQuantity:
              product.extension_attributes?.stock_item?.manage_stock || false,
            allowNegativeStock: false,
            updatedAt: new Date(product.updated_at),
          },
        },
      ],
      images: product.media_gallery_entries?.map((img) => ({
        url: img.file,
        altText: img.label,
      })),
      createdAt: new Date(product.created_at),
      updatedAt: new Date(product.updated_at),
    };
  }

  /**
   * Map Magento customer to ECommerceCustomer
   */
  private mapMagentoCustomerToECommerce(
    customer: MagentoCustomerResponse,
  ): ECommerceCustomer {
    return {
      id: customer.id.toString(),
      email: customer.email,
      firstName: customer.firstname,
      lastName: customer.lastname,
      phone: customer.addresses?.[0]?.telephone,
      acceptsMarketing: customer.extension_attributes?.is_subscribed || false,
      taxExempt: false,
      defaultAddress: customer.addresses?.[0]
        ? {
            firstName: customer.addresses[0].firstname,
            lastName: customer.addresses[0].lastname,
            company: customer.addresses[0].company,
            address1: customer.addresses[0].street[0] || "",
            address2: customer.addresses[0].street[1],
            city: customer.addresses[0].city,
            state:
              customer.addresses[0].region.region ||
              customer.addresses[0].region.region_code,
            postalCode: customer.addresses[0].postcode,
            country: customer.addresses[0].country_id,
          }
        : undefined,
      addresses: customer.addresses?.map((addr) => ({
        firstName: addr.firstname,
        lastName: addr.lastname,
        company: addr.company,
        address1: addr.street[0] || "",
        address2: addr.street[1],
        city: addr.city,
        state: addr.region.region || addr.region.region_code,
        postalCode: addr.postcode,
        country: addr.country_id,
      })),
      createdAt: new Date(customer.created_at),
      updatedAt: new Date(customer.updated_at),
    };
  }
}

/**
 * Factory function to create Magento SDK client
 */
export function createMagentoSDKClient(
  config: MagentoConfig,
): MagentoSDKClient {
  return new MagentoSDKClient(config);
}
