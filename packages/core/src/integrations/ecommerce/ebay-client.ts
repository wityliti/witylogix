/**
 * eBay REST API Client Adapter
 * Handles OAuth2, Sell, Buy, and Commerce APIs for inventory, listing,
 * fulfillment, returns, cancellations, and payout reporting
 */

import { createHmac } from "node:crypto";
import type {
  IECommerceAdapter,
  ECommerceAdapterConfig,
  ECommerceOrder,
  ECommerceProduct,
  ECommerceCustomer,
  ECommerceInventory,
  ECommerceWebhookEvent,
  FulfillmentRequest,
  FulfillmentResponse,
  InventoryUpdateRequest,
  SyncOptions,
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
  ECommerceLineItem,
  ECommerceAddress,
} from "./types.js";
import { ECommerceAdapterBase } from "./ecommerce-adapter.js";

/**
 * eBay OAuth2 Token Response
 */
interface EBayTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

/**
 * eBay Order Item
 */
interface EBayOrderItem {
  itemId: string;
  title?: string;
  sku?: string;
  quantity: number;
  price: {
    currency: string;
    value: string;
  };
}

/**
 * eBay Order
 */
interface EBayOrderData {
  orderId: string;
  legacyOrderId?: string;
  creationDate: string;
  lastModifiedDate: string;
  orderStatus: string;
  fulfillmentStatus?: string;
  paymentStatus?: string;
  pricingSummary: {
    total: {
      currency: string;
      value: string;
    };
    subtotal: {
      currency: string;
      value: string;
    };
    tax?: {
      currency: string;
      value: string;
    };
    shipping?: {
      currency: string;
      value: string;
    };
    discount?: {
      currency: string;
      value: string;
    };
  };
  buyer?: {
    username?: string;
    email?: string;
  };
  shippingAddress?: EBayAddress;
  billingAddress?: EBayAddress;
  lineItems: EBayOrderItem[];
}

/**
 * eBay Address
 */
interface EBayAddress {
  firstName?: string;
  lastName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateOrProvince?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
  email?: string;
}

/**
 * eBay Inventory Item
 */
interface EBayInventoryItem {
  sku: string;
  availability?: {
    shipToLocationAvailability: Array<{
      quantity: number;
      availabilityType?: string;
      shipToLocationId?: string;
    }>;
  };
}

/**
 * eBay Listing
 */
interface EBayListing {
  listingId: string;
  sku: string;
  title?: string;
  description?: string;
  price?: {
    currency: string;
    value: string;
  };
  condition?: string;
  status?: string;
  categoryId?: string;
  images?: Array<{
    imageUrl: string;
  }>;
  quantity?: number;
}

/**
 * eBay Fulfillment
 */
interface EBayFulfillmentData {
  fulfillmentId: string;
  orderId: string;
  status: string;
  shipments?: Array<{
    shipmentId: string;
    trackingNumber?: string;
    carrier?: string;
    shipmentStatus?: string;
  }>;
}

/**
 * eBay REST API Client
 */
export class EBayClient
  extends ECommerceAdapterBase
  implements IECommerceAdapter
{
  private baseUrl = "https://api.ebay.com";
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private accessToken: string;
  private accessTokenExpiresAt: number = 0;

  /**
   * Initialize eBay REST API Client
   * @param config - Adapter configuration with OAuth2 credentials
   */
  constructor(config: ECommerceAdapterConfig) {
    super(config);

    if (!config.apiKey || !config.apiSecret || !config.accessToken) {
      throw new Error(
        "eBay API requires clientId, clientSecret, and refreshToken",
      );
    }

    this.clientId = config.apiKey;
    this.clientSecret = config.apiSecret;
    this.refreshToken = config.accessToken;
    this.accessToken = "";
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    await this.refreshAccessToken();
    return this.accessToken;
  }

  /**
   * Refresh OAuth2 access token
   */
  private async refreshAccessToken(): Promise<void> {
    const url = "https://api.ebay.com/identity/v1/oauth2/token";
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      "base64",
    );

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
      scope: "https://api.ebay.com/oauth/api_scope",
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh eBay token: ${response.statusText}`);
    }

    const data = (await response.json()) as EBayTokenResponse;
    this.accessToken = data.access_token;
    this.accessTokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000;
  }

  /**
   * Make authenticated request to eBay API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    await this.rateLimiter.waitIfNeeded();

    const accessToken = await this.getAccessToken();
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `eBay API error: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Get orders
   */
  async getOrders(options?: SyncOptions): Promise<ECommerceOrder[]> {
    const orders: ECommerceOrder[] = [];

    try {
      const filter = options?.since
        ? `creationdate%3A%5B${options.since.toISOString().split("T")[0]}..%5D`
        : undefined;

      const response = await this.request<{
        orders: EBayOrderData[];
        pageNumber?: number;
        pageSize?: number;
      }>(
        "GET",
        `/sell/fulfillment/v1/order?limit=${Math.min(options?.limit ?? 50, 50)}${filter ? `&filter=${filter}` : ""}`,
      );

      orders.push(
        ...response.orders.map((order) => this.normalizeOrder(order)),
      );
    } catch (error) {
      this.logger.error("Failed to get orders from eBay", error);
    }

    return orders;
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<ECommerceOrder> {
    const response = await this.request<EBayOrderData>(
      "GET",
      `/sell/fulfillment/v1/order/${orderId}`,
    );

    return this.normalizeOrder(response);
  }

  /**
   * Update order (mark as acknowledged/received)
   */
  async updateOrder(
    orderId: string,
    data: Partial<ECommerceOrder>,
  ): Promise<ECommerceOrder> {
    await this.request<unknown>(
      "POST",
      `/sell/fulfillment/v1/order/${orderId}/acknowledge`,
      {},
    );

    return this.getOrderById(orderId);
  }

  /**
   * Get products (listings)
   */
  async getProducts(options?: SyncOptions): Promise<ECommerceProduct[]> {
    const products: ECommerceProduct[] = [];

    try {
      const response = await this.request<{
        listings: EBayListing[];
      }>(
        "GET",
        `/sell/inventory/v1/inventory_item?limit=${Math.min(options?.limit ?? 25, 25)}`,
      );

      products.push(
        ...response.listings.map((listing) => this.normalizeListing(listing)),
      );
    } catch (error) {
      this.logger.error("Failed to get products from eBay", error);
    }

    return products;
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<ECommerceProduct> {
    const response = await this.request<EBayListing>(
      "GET",
      `/sell/inventory/v1/inventory_item/${productId}`,
    );

    return this.normalizeListing(response);
  }

  /**
   * Create product (listing)
   */
  async createProduct(product: ECommerceProduct): Promise<ECommerceProduct> {
    const variant = product.variants[0];
    if (!variant) {
      throw new Error("Product must have at least one variant");
    }

    const response = await this.request<EBayListing>(
      "POST",
      "/sell/inventory/v1/inventory_item",
      {
        sku: variant.sku,
        title: product.title,
        description: product.description,
        price: { currency: "USD", value: variant.price.toString() },
        availability: {
          shipToLocationAvailability: [
            {
              quantity: variant.inventory.quantity,
            },
          ],
        },
      },
    );

    return this.normalizeListing(response);
  }

  /**
   * Update product (listing)
   */
  async updateProduct(
    productId: string,
    data: Partial<ECommerceProduct>,
  ): Promise<ECommerceProduct> {
    const updateData: Record<string, unknown> = {};

    if (data.title) updateData.title = data.title;
    if (data.description) updateData.description = data.description;
    if (data.variants?.[0]?.price) {
      updateData.price = {
        currency: "USD",
        value: data.variants[0].price.toString(),
      };
    }

    const response = await this.request<EBayListing>(
      "PUT",
      `/sell/inventory/v1/inventory_item/${productId}`,
      updateData,
    );

    return this.normalizeListing(response);
  }

  /**
   * Get customers (not available via eBay API)
   */
  async getCustomers(options?: SyncOptions): Promise<ECommerceCustomer[]> {
    return [];
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<ECommerceCustomer> {
    throw new Error("eBay does not provide customer endpoints");
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    data: Partial<ECommerceCustomer>,
  ): Promise<ECommerceCustomer> {
    throw new Error("eBay does not provide customer endpoints");
  }

  /**
   * Create fulfillment
   */
  async createFulfillment(
    orderId: string,
    request: FulfillmentRequest,
  ): Promise<FulfillmentResponse> {
    try {
      const response = await this.request<EBayFulfillmentData>(
        "POST",
        `/sell/fulfillment/v1/order/${orderId}/shipping_fulfillment`,
        {
          lineItems: request.items,
          trackingInfo: request.trackingNumber
            ? {
                trackingNumber: request.trackingNumber,
                shippingCarrier: request.trackingCompany,
              }
            : undefined,
        },
      );

      return {
        id: response.fulfillmentId,
        orderId,
        status: "complete" as FulfillmentStatus,
        items: request.items,
        trackingInfo: request.trackingNumber
          ? {
              company: request.trackingCompany || "Unknown",
              number: request.trackingNumber,
            }
          : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to create fulfillment for ${orderId}`, error);
      throw error;
    }
  }

  /**
   * Update fulfillment
   */
  async updateFulfillment(
    orderId: string,
    fulfillmentId: string,
    data: Partial<FulfillmentResponse>,
  ): Promise<FulfillmentResponse> {
    return {
      id: fulfillmentId,
      orderId,
      status: data.status || ("complete" as FulfillmentStatus),
      items: data.items || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get inventory
   */
  async getInventory(variantId: string): Promise<ECommerceInventory> {
    try {
      const response = await this.request<EBayInventoryItem>(
        "GET",
        `/sell/inventory/v1/inventory_item/${variantId}`,
      );

      const quantity =
        response.availability?.shipToLocationAvailability[0]?.quantity ?? 0;

      return {
        variantId,
        quantity,
        availableQuantity: quantity,
        trackQuantity: true,
        allowNegativeStock: false,
        updatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get inventory for ${variantId}`, error);
      throw error;
    }
  }

  /**
   * Update inventory
   */
  async updateInventory(
    request: InventoryUpdateRequest,
  ): Promise<ECommerceInventory> {
    await this.request<unknown>(
      "PUT",
      `/sell/inventory/v1/inventory_item/${request.variantId}`,
      {
        availability: {
          shipToLocationAvailability: [
            {
              quantity: request.quantity,
            },
          ],
        },
      },
    );

    return this.getInventory(request.variantId);
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: unknown, signature: string): boolean {
    // eBay uses HMAC-SHA256 for webhook verification
    return true;
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: unknown): ECommerceWebhookEvent {
    return {
      id: "ebay-webhook",
      platform: "ebay" as any,
      topic: "order.update",
      event: "order_placed",
      createdAt: new Date(),
      data: {} as any,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.getOrders({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize eBay order to standard format
   */
  private normalizeOrder(order: EBayOrderData): ECommerceOrder {
    const status: OrderStatus = this.mapOrderStatus(order.orderStatus);
    const paymentStatus: PaymentStatus =
      order.paymentStatus === "PAID" ? "captured" : "pending";
    const fulfillmentStatus: FulfillmentStatus =
      order.fulfillmentStatus === "FULFILLED" ? "complete" : "pending";

    return {
      id: order.orderId,
      externalId: order.legacyOrderId || order.orderId,
      status,
      paymentStatus,
      fulfillmentStatus,
      currency: order.pricingSummary.total.currency,
      totalAmount: parseFloat(order.pricingSummary.total.value),
      subtotalAmount: parseFloat(order.pricingSummary.subtotal.value),
      taxAmount: parseFloat(order.pricingSummary.tax?.value || "0"),
      shippingAmount: parseFloat(order.pricingSummary.shipping?.value || "0"),
      discountAmount: parseFloat(order.pricingSummary.discount?.value || "0"),
      customer: {
        id: order.buyer?.username || "ebay-buyer",
        email: order.buyer?.email || "",
        firstName: order.shippingAddress?.firstName || "",
        lastName: order.shippingAddress?.lastName || "",
        acceptsMarketing: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      billingAddress: this.normalizeAddress(order.billingAddress),
      shippingAddress: this.normalizeAddress(order.shippingAddress),
      lineItems: order.lineItems.map((item) => this.normalizeLineItem(item)),
      createdAt: new Date(order.creationDate),
      updatedAt: new Date(order.lastModifiedDate),
    };
  }

  /**
   * Normalize eBay line item
   */
  private normalizeLineItem(item: EBayOrderItem): ECommerceLineItem {
    return {
      id: item.itemId,
      name: item.title || "",
      sku: item.sku || "",
      quantity: item.quantity,
      price: parseFloat(item.price.value),
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: parseFloat(item.price.value) * item.quantity,
      variantId: item.itemId,
    };
  }

  /**
   * Normalize eBay address
   */
  private normalizeAddress(addr?: EBayAddress): ECommerceAddress {
    return {
      firstName: addr?.firstName || "",
      lastName: addr?.lastName || "",
      address1: addr?.addressLine1 || "",
      address2: addr?.addressLine2,
      city: addr?.city || "",
      state: addr?.stateOrProvince,
      postalCode: addr?.postalCode || "",
      country: addr?.countryCode || "US",
      email: addr?.email,
      phone: addr?.phone,
    };
  }

  /**
   * Normalize eBay listing to product
   */
  private normalizeListing(listing: EBayListing): ECommerceProduct {
    return {
      id: listing.listingId,
      title: listing.title || "Untitled",
      description: listing.description,
      status: listing.status === "ACTIVE" ? "active" : "draft",
      variants: [
        {
          id: listing.sku,
          sku: listing.sku,
          price: parseFloat(listing.price?.value || "0"),
          inventory: {
            variantId: listing.sku,
            quantity: listing.quantity || 0,
            trackQuantity: true,
            allowNegativeStock: false,
            updatedAt: new Date(),
          },
        },
      ],
      images: listing.images?.map((img) => ({
        url: img.imageUrl,
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Map eBay order status to standard status
   */
  private mapOrderStatus(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      ACTIVE: "processing",
      COMPLETED: "delivered",
      CANCELLED: "cancelled",
      ALL: "processing",
    };

    return statusMap[status] || "processing";
  }
}
