/**
 * ShipStation API v2 SDK Client
 *
 * Full-featured ShipStation REST API v2 client with:
 * - Authentication: API key + secret (Basic Auth), OAuth2 for partner apps
 * - Orders: list, get, create, update, delete, assign tag, add note, mark as shipped
 * - Shipments: create label, void label, get rates
 * - Carriers: list carriers, list services, list packages per carrier
 * - Warehouses: list, create (origin addresses)
 * - Stores: list connected stores, refresh store
 * - Products: list, get, update
 * - Webhooks: subscribe (ORDER_NOTIFY, ITEM_ORDER_NOTIFY, SHIP_NOTIFY, ITEM_SHIP_NOTIFY), unsubscribe
 * - Batch labels: create batch, get batch status
 * - Rate limiting: 40 req/min with X-Rate-Limit-Limit/Remaining/Reset header tracking
 * - Pagination: page-based with pageSize (max 500)
 * - Error handling: map ShipStation errors to Witylogix error catalog
 * - Retry: exponential backoff for 429/5xx
 *
 * API Documentation: https://shipstation.docs.apiary.io/
 */

import type {
  SSAuthConfig,
  SSOrder,
  SSCreateOrderRequest,
  SSAddress,
  SSShipment,
  SSLabel,
  SSCreateLabelRequest,
  SSRate,
  SSGetRatesRequest,
  SSCarrier,
  SSService,
  SSPackage,
  SSWarehouse,
  SSCreateWarehouseRequest,
  SSStore,
  SSProduct,
  SSUpdateProductRequest,
  SSProductVariant,
  SSWebhookSubscription,
  SSSubscribeWebhookRequest,
  SSWebhookPayload,
  SSBatchRequest,
  SSBatchStatus,
  SSPaginatedResponse,
  SSErrorResponse,
  SSRateLimitInfo,
} from "./shipstation-sdk-types.js";

// ─── Rate Limit Tracker ──────────────────────────────────────────

/**
 * Tracks rate limit state from ShipStation API responses
 */
class RateLimitTracker {
  private limit: number = 40;
  private remaining: number = 40;
  private reset: number = Date.now();

  /**
   * Update rate limit info from response headers
   */
  updateFromHeaders(headers: Record<string, string>): void {
    const limitStr = headers["x-rate-limit-limit"];
    const remainingStr = headers["x-rate-limit-remaining"];
    const resetStr = headers["x-rate-limit-reset"];

    if (limitStr) this.limit = parseInt(limitStr, 10);
    if (remainingStr) this.remaining = parseInt(remainingStr, 10);
    if (resetStr) this.reset = parseInt(resetStr, 10) * 1000; // Convert to ms
  }

  /**
   * Get current rate limit info
   */
  getInfo(): SSRateLimitInfo {
    return {
      limit: this.limit,
      remaining: this.remaining,
      reset: Math.floor(this.reset / 1000),
    };
  }

  /**
   * Check if rate limited
   */
  isRateLimited(): boolean {
    return this.remaining <= 0;
  }

  /**
   * Get time to wait before retry (milliseconds)
   */
  getRetryAfter(): number {
    return Math.max(0, this.reset - Date.now());
  }
}

// ─── Exponential Backoff Retry ──────────────────────────────────

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/**
 * Exponential backoff retry helper
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  isRetryable: (error: unknown, status?: number) => boolean = () => true,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      const status =
        error instanceof Error && error.message.match(/HTTP (\d+)/)
          ? parseInt(error.message.match(/HTTP (\d+)/)![1], 10)
          : undefined;

      const shouldRetry =
        attempt < options.maxRetries - 1 && isRetryable(error, status);

      if (shouldRetry) {
        const delayMs = Math.min(
          options.maxDelayMs,
          options.baseDelayMs * Math.pow(2, attempt),
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        break;
      }
    }
  }

  throw lastError;
}

// ─── ShipStation API Error Mapper ────────────────────────────────

/**
 * Map ShipStation API errors to standardized error messages
 */
function mapSSError(error: unknown): Error {
  if (error instanceof Error) {
    // Check for HTTP status codes
    const httpMatch = error.message.match(/HTTP (\d+)/);
    if (httpMatch) {
      const status = parseInt(httpMatch[1], 10);
      switch (status) {
        case 400:
          return new Error(
            `ShipStation API Error (400 Bad Request): ${error.message}`,
          );
        case 401:
          return new Error(
            "ShipStation Authentication failed: Invalid API credentials",
          );
        case 403:
          return new Error(
            "ShipStation Access denied: Insufficient permissions",
          );
        case 404:
          return new Error("ShipStation Resource not found");
        case 429:
          return new Error(
            "ShipStation Rate limit exceeded: Please retry after delay",
          );
        case 500:
          return new Error("ShipStation API Server error: Please retry later");
        case 502:
        case 503:
        case 504:
          return new Error("ShipStation API temporarily unavailable");
      }
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}

// ─── ShipStation SDK Client ──────────────────────────────────────

/**
 * ShipStation API v2 SDK Client
 *
 * Complete client for ShipStation REST API with:
 * - Order management (CRUD, tags, notes, ship status)
 * - Shipment and label creation
 * - Rate quotes and carrier management
 * - Warehouse and store management
 * - Product catalog operations
 * - Webhook subscriptions
 * - Batch label operations
 * - Rate limiting and retry logic
 */
export class ShipStationSDKClient {
  private baseUrl: string = "https://ssapi.shipstation.com";
  private authHeader: string = "";
  private oauthToken: string = "";
  private rateLimitTracker: RateLimitTracker;
  private retryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
  };

  /**
   * Initialize ShipStation SDK client
   */
  constructor(config: SSAuthConfig) {
    this.baseUrl = config.baseUrl || this.baseUrl;
    this.rateLimitTracker = new RateLimitTracker();

    // Set authentication
    if (config.apiKey && config.apiSecret) {
      const credentials = `${config.apiKey}:${config.apiSecret}`;
      this.authHeader = `Basic ${Buffer.from(credentials).toString("base64")}`;
    } else if (config.oauthToken) {
      this.oauthToken = config.oauthToken;
    } else {
      throw new Error(
        "ShipStation SDK requires either (apiKey + apiSecret) or oauthToken",
      );
    }
  }

  /**
   * Make an HTTP request with auth, retry, and rate limit tracking
   */
  private async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    endpoint: string,
    options: {
      body?: unknown;
      query?: Record<string, string | number | boolean>;
      headers?: Record<string, string>;
    } = {},
  ): Promise<{ data: T; headers: Record<string, string> }> {
    return retryWithBackoff(
      async () => {
        const url = new URL(endpoint, this.baseUrl);

        // Add query parameters
        if (options.query) {
          Object.entries(options.query).forEach(([key, value]) => {
            url.searchParams.append(key, String(value));
          });
        }

        // Build headers
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...options.headers,
        };

        // Add authentication
        if (this.authHeader) {
          headers["Authorization"] = this.authHeader;
        } else if (this.oauthToken) {
          headers["Authorization"] = `Bearer ${this.oauthToken}`;
        }

        const response = await fetch(url.toString(), {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        // Extract response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key.toLowerCase()] = value;
        });

        // Update rate limit tracking
        this.rateLimitTracker.updateFromHeaders(responseHeaders);

        // Handle errors
        if (!response.ok) {
          const text = await response.text();
          let errorMsg = `HTTP ${response.status}`;

          try {
            const errorData = JSON.parse(text) as SSErrorResponse;
            if (errorData.errors?.[0]?.message) {
              errorMsg += `: ${errorData.errors[0].message}`;
            } else if (errorData.message) {
              errorMsg += `: ${errorData.message}`;
            }
          } catch {
            // Use response text if not JSON
            if (text) {
              errorMsg += `: ${text.substring(0, 200)}`;
            }
          }

          throw new Error(errorMsg);
        }

        const data = (await response.json()) as T;
        return { data, headers: responseHeaders };
      },
      this.retryOptions,
      (error, status) => {
        // Retry on 429 (rate limit), 500, 502, 503, 504
        if (status === 429) return true;
        if (status && status >= 500) return true;
        // Retry on network errors
        if (error instanceof TypeError) return true;
        return false;
      },
    ).catch((error) => {
      throw mapSSError(error);
    });
  }

  // ─── Orders API ──────────────────────────────────────────────

  /**
   * List orders
   *
   * @param params Query parameters (page, pageSize, orderStatus, etc.)
   * @returns Paginated list of orders
   */
  async listOrders(
    params?: Record<string, string | number | boolean>,
  ): Promise<SSPaginatedResponse<SSOrder>> {
    const { data } = await this.request<SSPaginatedResponse<SSOrder>>(
      "GET",
      "/orders",
      { query: params },
    );
    return data;
  }

  /**
   * Get a specific order by ID
   */
  async getOrder(orderId: string): Promise<SSOrder> {
    const { data } = await this.request<SSOrder>("GET", `/orders/${orderId}`);
    return data;
  }

  /**
   * Create a new order
   */
  async createOrder(order: SSCreateOrderRequest): Promise<SSOrder> {
    const { data } = await this.request<SSOrder>("POST", "/orders", {
      body: order,
    });
    return data;
  }

  /**
   * Update an existing order
   */
  async updateOrder(
    orderId: string,
    updates: Partial<SSCreateOrderRequest>,
  ): Promise<SSOrder> {
    const { data } = await this.request<SSOrder>("PUT", `/orders/${orderId}`, {
      body: updates,
    });
    return data;
  }

  /**
   * Delete an order
   */
  async deleteOrder(orderId: string): Promise<void> {
    await this.request("DELETE", `/orders/${orderId}`);
  }

  /**
   * Assign a tag to an order
   */
  async assignOrderTag(orderId: string, tagName: string): Promise<void> {
    await this.request("POST", `/orders/${orderId}/tags`, {
      body: { tagName },
    });
  }

  /**
   * Add a note to an order
   */
  async addOrderNote(orderId: string, note: string): Promise<void> {
    await this.request("POST", `/orders/${orderId}/notes`, {
      body: { note },
    });
  }

  /**
   * Mark order as shipped
   */
  async markOrderShipped(orderId: string): Promise<void> {
    await this.request("POST", `/orders/${orderId}/mark-as-shipped`);
  }

  // ─── Shipments API ───────────────────────────────────────────

  /**
   * Get rates for a shipment
   */
  async getRates(shipmentId: string): Promise<SSRate[]> {
    const { data } = await this.request<{ rates: SSRate[] }>(
      "GET",
      `/shipments/${shipmentId}/rates`,
    );
    return data.rates;
  }

  /**
   * Create a shipping label
   */
  async createLabel(request: SSCreateLabelRequest): Promise<SSLabel> {
    const { data } = await this.request<SSLabel>("POST", "/labels", {
      body: request,
    });
    return data;
  }

  /**
   * Void (cancel) a shipping label
   */
  async voidLabel(labelId: string): Promise<void> {
    await this.request("DELETE", `/labels/${labelId}`);
  }

  /**
   * Get a specific label by ID
   */
  async getLabel(labelId: string): Promise<SSLabel> {
    const { data } = await this.request<SSLabel>("GET", `/labels/${labelId}`);
    return data;
  }

  // ─── Carriers API ────────────────────────────────────────────

  /**
   * List all available carriers
   */
  async listCarriers(): Promise<SSCarrier[]> {
    const { data } = await this.request<{ carriers: SSCarrier[] }>(
      "GET",
      "/carriers",
    );
    return data.carriers;
  }

  /**
   * List services available for a carrier
   */
  async listServices(carrierId: string): Promise<SSService[]> {
    const { data } = await this.request<{ services: SSService[] }>(
      "GET",
      `/carriers/${carrierId}/services`,
    );
    return data.services;
  }

  /**
   * List package types available for a carrier
   */
  async listPackages(carrierId: string): Promise<SSPackage[]> {
    const { data } = await this.request<{ packages: SSPackage[] }>(
      "GET",
      `/carriers/${carrierId}/packages`,
    );
    return data.packages;
  }

  // ─── Warehouses API ──────────────────────────────────────────

  /**
   * List all warehouses
   */
  async listWarehouses(): Promise<SSWarehouse[]> {
    const { data } = await this.request<{ warehouses: SSWarehouse[] }>(
      "GET",
      "/warehouses",
    );
    return data.warehouses;
  }

  /**
   * Create a new warehouse
   */
  async createWarehouse(
    request: SSCreateWarehouseRequest,
  ): Promise<SSWarehouse> {
    const { data } = await this.request<SSWarehouse>("POST", "/warehouses", {
      body: request,
    });
    return data;
  }

  // ─── Stores API ──────────────────────────────────────────────

  /**
   * List all connected stores
   */
  async listStores(): Promise<SSStore[]> {
    const { data } = await this.request<{ stores: SSStore[] }>(
      "GET",
      "/stores",
    );
    return data.stores;
  }

  /**
   * Refresh a store's inventory (resync)
   */
  async refreshStore(storeId: string): Promise<void> {
    await this.request("POST", `/stores/${storeId}/refresh`);
  }

  // ─── Products API ────────────────────────────────────────────

  /**
   * List all products
   */
  async listProducts(
    params?: Record<string, string | number | boolean>,
  ): Promise<SSPaginatedResponse<SSProduct>> {
    const { data } = await this.request<SSPaginatedResponse<SSProduct>>(
      "GET",
      "/products",
      { query: params },
    );
    return data;
  }

  /**
   * Get a specific product by ID
   */
  async getProduct(productId: string): Promise<SSProduct> {
    const { data } = await this.request<SSProduct>(
      "GET",
      `/products/${productId}`,
    );
    return data;
  }

  /**
   * Update a product
   */
  async updateProduct(
    productId: string,
    updates: SSUpdateProductRequest,
  ): Promise<SSProduct> {
    const { data } = await this.request<SSProduct>(
      "PUT",
      `/products/${productId}`,
      {
        body: updates,
      },
    );
    return data;
  }

  // ─── Webhooks API ────────────────────────────────────────────

  /**
   * Subscribe to a webhook event
   */
  async subscribeWebhook(
    request: SSSubscribeWebhookRequest,
  ): Promise<SSWebhookSubscription> {
    const { data } = await this.request<SSWebhookSubscription>(
      "POST",
      "/webhooks",
      {
        body: request,
      },
    );
    return data;
  }

  /**
   * Unsubscribe from a webhook
   */
  async unsubscribeWebhook(webhookId: string): Promise<void> {
    await this.request("DELETE", `/webhooks/${webhookId}`);
  }

  /**
   * List all webhook subscriptions
   */
  async listWebhooks(): Promise<SSWebhookSubscription[]> {
    const { data } = await this.request<{ webhooks: SSWebhookSubscription[] }>(
      "GET",
      "/webhooks",
    );
    return data.webhooks;
  }

  // ─── Batch Operations ────────────────────────────────────────

  /**
   * Create a batch of labels
   */
  async createBatch(request: SSBatchRequest): Promise<SSBatchStatus> {
    const { data } = await this.request<SSBatchStatus>("POST", "/batches", {
      body: request,
    });
    return data;
  }

  /**
   * Get batch status
   */
  async getBatchStatus(batchId: string): Promise<SSBatchStatus> {
    const { data } = await this.request<SSBatchStatus>(
      "GET",
      `/batches/${batchId}`,
    );
    return data;
  }

  // ─── Rate Limit Management ──────────────────────────────────

  /**
   * Get current rate limit info
   */
  getRateLimitInfo(): SSRateLimitInfo {
    return this.rateLimitTracker.getInfo();
  }

  /**
   * Check if currently rate limited
   */
  isRateLimited(): boolean {
    return this.rateLimitTracker.isRateLimited();
  }

  /**
   * Get milliseconds to wait before next request (if rate limited)
   */
  getRetryAfterMs(): number {
    return this.rateLimitTracker.getRetryAfter();
  }

  /**
   * Wait for rate limit reset
   */
  async waitForRateLimit(): Promise<void> {
    const waitMs = this.getRetryAfterMs();
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
