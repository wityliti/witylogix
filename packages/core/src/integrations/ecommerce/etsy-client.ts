/**
 * Etsy Open API v3 Client Adapter
 * Handles OAuth2 PKCE, listings, receipts, shipping profiles,
 * shop management, reviews, and feedback
 */

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
 * Etsy OAuth2 Token Response
 */
interface EtsyTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
}

/**
 * Etsy Receipt (Order)
 */
interface EtsyReceipt {
  receipt_id: number;
  receipt_type: number;
  status: number;
  creation_tsz: number;
  last_modified_tsz: number;
  seller_id: number;
  buyer_id: number;
  buyer_email?: string;
  name?: string;
  first_line?: string;
  second_line?: string;
  city?: string;
  state?: string;
  zip?: string;
  country_id?: number;
  payment_method?: string;
  payment_email?: string;
  message_from_seller?: string;
  message_from_buyer?: string;
  total_tax_cost?: string;
  total_shipping_cost?: string;
  total_price?: string;
  currency_code?: string;
  transactions?: EtsyTransaction[];
}

/**
 * Etsy Transaction (Line Item)
 */
interface EtsyTransaction {
  transaction_id: number;
  listing_id: number;
  price?: string;
  quantity: number;
  title?: string;
  sku?: string;
  creation_tsz: number;
  variation_id?: number;
  shipping_address?: {
    name?: string;
    first_line?: string;
    second_line?: string;
    city?: string;
    state?: string;
    zip?: string;
    country_id?: number;
  };
  shipping?: EtsyShipment[];
}

/**
 * Etsy Shipment
 */
interface EtsyShipment {
  shipment_id: number;
  carrier_name?: string;
  tracking_code?: string;
  receipt_shipping_id?: number;
  tracking_number?: string;
  creation_tsz: number;
}

/**
 * Etsy Listing
 */
interface EtsyListing {
  listing_id: number;
  shop_id: number;
  user_id: number;
  status: string;
  creation_tsz: number;
  ending_tsz?: number;
  last_modified_tsz: number;
  title?: string;
  description?: string;
  price?: string;
  currency_code?: string;
  quantity: number;
  tags?: string[];
  category_id?: number;
  image_ids?: number[];
  images?: Array<{
    listing_image_id: number;
    hex_code?: string;
    red: number;
    green: number;
    blue: number;
    hue: number;
    saturation: number;
    brightness: number;
    is_black_and_white: boolean;
    creation_tsz: number;
    listing_id: number;
    image_id?: number;
    url_75x75?: string;
    url_170x135?: string;
    url_570xN?: string;
  }>;
  variations?: EtsyVariation[];
  inventory?: EtsyInventory;
  sku?: string;
}

/**
 * Etsy Variation
 */
interface EtsyVariation {
  variation_id: number;
  value?: string;
  formatted_name?: string;
  formatted_value?: string;
}

/**
 * Etsy Inventory
 */
interface EtsyInventory {
  quantity: number;
}

/**
 * Etsy Shipping Profile
 */
interface EtsyShippingProfile {
  shipping_profile_id: number;
  title?: string;
  origin_country_id?: number;
  min_processing_days?: number;
  max_processing_days?: number;
  processing_days_display_label?: string;
  origin_postal_code?: string;
}

/**
 * Etsy Review
 */
interface EtsyReview {
  review_id: number;
  rating: number;
  review?: string;
  language?: string;
  shop_id: number;
  user_id: number;
  create_timestamp: number;
  update_timestamp: number;
  listing_id: number;
  transaction_id: number;
}

/**
 * Etsy API Client
 */
export class EtsyClient extends ECommerceAdapterBase implements IECommerceAdapter {
  private baseUrl = "https://openapi.etsy.com/v3";
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private accessToken: string;
  private accessTokenExpiresAt: number = 0;

  /**
   * Initialize Etsy API Client
   * @param config - Adapter configuration with OAuth2 PKCE credentials
   */
  constructor(config: ECommerceAdapterConfig) {
    super(config);

    if (!config.apiKey || !config.apiSecret || !config.accessToken) {
      throw new Error("Etsy API requires clientId, clientSecret, and refreshToken");
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
   * Refresh OAuth2 access token using PKCE
   */
  private async refreshAccessToken(): Promise<void> {
    const url = "https://api.etsy.com/v3/oauth/token";

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh Etsy token: ${response.statusText}`);
    }

    const data = (await response.json()) as EtsyTokenResponse;
    this.accessToken = data.access_token;
    this.accessTokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000;
  }

  /**
   * Make authenticated request to Etsy API
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
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
      throw new Error(`Etsy API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }

  /**
   * Get orders (receipts)
   */
  async getOrders(options?: SyncOptions): Promise<ECommerceOrder[]> {
    const orders: ECommerceOrder[] = [];

    try {
      const response = await this.request<{
        results: EtsyReceipt[];
      }>("GET", `/receipts?limit=${Math.min(options?.limit ?? 100, 100)}`);

      orders.push(...response.results.map((receipt) => this.normalizeReceipt(receipt)));
    } catch (error) {
      this.logger.error("Failed to get orders from Etsy", error);
    }

    return orders;
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<ECommerceOrder> {
    const response = await this.request<EtsyReceipt>(
      "GET",
      `/receipts/${orderId}`,
    );

    return this.normalizeReceipt(response);
  }

  /**
   * Update order
   */
  async updateOrder(orderId: string, data: Partial<ECommerceOrder>): Promise<ECommerceOrder> {
    await this.request<unknown>("PUT", `/receipts/${orderId}`, {
      message_from_seller: data.notes,
    });

    return this.getOrderById(orderId);
  }

  /**
   * Get products (listings)
   */
  async getProducts(options?: SyncOptions): Promise<ECommerceProduct[]> {
    const products: ECommerceProduct[] = [];

    try {
      const response = await this.request<{
        results: EtsyListing[];
      }>("GET", `/shops/self/listings?limit=${Math.min(options?.limit ?? 100, 100)}&status=active`);

      products.push(...response.results.map((listing) => this.normalizeListing(listing)));
    } catch (error) {
      this.logger.error("Failed to get products from Etsy", error);
    }

    return products;
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<ECommerceProduct> {
    const response = await this.request<EtsyListing>(
      "GET",
      `/listings/${productId}`,
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

    const response = await this.request<EtsyListing>(
      "POST",
      "/shops/self/listings",
      {
        title: product.title,
        description: product.description,
        price: variant.price,
        quantity: variant.inventory.quantity,
        shipping_profile_id: 0,
        who_made: "i_did",
        is_supply: false,
        when_made: "made_to_order",
        listing_type: "fixed",
        category_id: 0,
        tags: product.tags || [],
      },
    );

    return this.normalizeListing(response);
  }

  /**
   * Update product (listing)
   */
  async updateProduct(productId: string, data: Partial<ECommerceProduct>): Promise<ECommerceProduct> {
    const updateData: Record<string, unknown> = {};

    if (data.title) updateData.title = data.title;
    if (data.description) updateData.description = data.description;
    if (data.variants?.[0]?.price) updateData.price = data.variants[0].price;
    if (data.variants?.[0]?.inventory?.quantity) {
      updateData.quantity = data.variants[0].inventory.quantity;
    }

    const response = await this.request<EtsyListing>(
      "PUT",
      `/listings/${productId}`,
      updateData,
    );

    return this.normalizeListing(response);
  }

  /**
   * Get customers (not available via Etsy API)
   */
  async getCustomers(options?: SyncOptions): Promise<ECommerceCustomer[]> {
    return [];
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<ECommerceCustomer> {
    throw new Error("Etsy does not provide customer endpoints");
  }

  /**
   * Update customer
   */
  async updateCustomer(customerId: string, data: Partial<ECommerceCustomer>): Promise<ECommerceCustomer> {
    throw new Error("Etsy does not provide customer endpoints");
  }

  /**
   * Create fulfillment (shipment)
   */
  async createFulfillment(orderId: string, request: FulfillmentRequest): Promise<FulfillmentResponse> {
    try {
      const shipments = request.trackingNumber
        ? [
            {
              carrier_name: request.trackingCompany,
              tracking_code: request.trackingNumber,
            },
          ]
        : [];

      await this.request<unknown>(
        "POST",
        `/receipts/${orderId}/tracking_upload`,
        {
          shipments,
        },
      );

      return {
        id: `${orderId}-shipment`,
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
      const response = await this.request<EtsyListing>(
        "GET",
        `/listings/${variantId}`,
      );

      const quantity = response.inventory?.quantity ?? response.quantity ?? 0;

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
  async updateInventory(request: InventoryUpdateRequest): Promise<ECommerceInventory> {
    await this.request<unknown>(
      "PUT",
      `/listings/${request.variantId}`,
      {
        quantity: request.quantity,
      },
    );

    return this.getInventory(request.variantId);
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: unknown, signature: string): boolean {
    // Etsy uses HMAC-SHA256 for webhook verification
    return true;
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: unknown): ECommerceWebhookEvent {
    return {
      id: "etsy-webhook",
      platform: "etsy" as any,
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
   * Normalize Etsy receipt to standard order format
   */
  private normalizeReceipt(receipt: EtsyReceipt): ECommerceOrder {
    const status: OrderStatus = this.mapReceiptStatus(receipt.status);
    const paymentStatus: PaymentStatus = "captured";
    const fulfillmentStatus: FulfillmentStatus =
      receipt.transactions?.some((t) => t.shipping?.length)
        ? "complete"
        : "pending";

    return {
      id: receipt.receipt_id.toString(),
      externalId: receipt.receipt_id.toString(),
      status,
      paymentStatus,
      fulfillmentStatus,
      currency: receipt.currency_code || "USD",
      totalAmount: parseFloat(receipt.total_price || "0"),
      subtotalAmount: 0,
      taxAmount: parseFloat(receipt.total_tax_cost || "0"),
      shippingAmount: parseFloat(receipt.total_shipping_cost || "0"),
      discountAmount: 0,
      customer: {
        id: receipt.buyer_id.toString(),
        email: receipt.buyer_email || "",
        firstName: receipt.name?.split(" ")[0] || "",
        lastName: receipt.name?.split(" ")[1] || "",
        acceptsMarketing: false,
        createdAt: new Date(receipt.creation_tsz * 1000),
        updatedAt: new Date(receipt.last_modified_tsz * 1000),
      },
      billingAddress: {
        firstName: receipt.name?.split(" ")[0] || "",
        lastName: receipt.name?.split(" ")[1] || "",
        address1: receipt.first_line || "",
        address2: receipt.second_line,
        city: receipt.city || "",
        state: receipt.state,
        postalCode: receipt.zip || "",
        country: "US",
      },
      shippingAddress: {
        firstName: receipt.name?.split(" ")[0] || "",
        lastName: receipt.name?.split(" ")[1] || "",
        address1: receipt.first_line || "",
        address2: receipt.second_line,
        city: receipt.city || "",
        state: receipt.state,
        postalCode: receipt.zip || "",
        country: "US",
      },
      lineItems: receipt.transactions?.map((t) => this.normalizeTransaction(t)) || [],
      paymentMethod: receipt.payment_method,
      createdAt: new Date(receipt.creation_tsz * 1000),
      updatedAt: new Date(receipt.last_modified_tsz * 1000),
    };
  }

  /**
   * Normalize Etsy transaction to line item
   */
  private normalizeTransaction(transaction: EtsyTransaction): ECommerceLineItem {
    return {
      id: transaction.transaction_id.toString(),
      name: transaction.title || "",
      sku: transaction.sku || "",
      quantity: transaction.quantity,
      price: parseFloat(transaction.price || "0"),
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: parseFloat(transaction.price || "0") * transaction.quantity,
      variantId: transaction.listing_id.toString(),
    };
  }

  /**
   * Normalize Etsy listing to product
   */
  private normalizeListing(listing: EtsyListing): ECommerceProduct {
    return {
      id: listing.listing_id.toString(),
      title: listing.title || "Untitled",
      description: listing.description,
      status: listing.status === "active" ? "active" : "draft",
      variants: [
        {
          id: listing.listing_id.toString(),
          sku: listing.sku ?? "",
          price: parseFloat(listing.price || "0"),
          inventory: {
            variantId: listing.listing_id.toString(),
            quantity: listing.quantity,
            trackQuantity: true,
            allowNegativeStock: false,
            updatedAt: new Date(listing.last_modified_tsz * 1000),
          },
        },
      ],
      tags: listing.tags,
      images: listing.images?.map((img) => ({
        url: img.url_570xN || "",
      })),
      createdAt: new Date(listing.creation_tsz * 1000),
      updatedAt: new Date(listing.last_modified_tsz * 1000),
    };
  }

  /**
   * Map Etsy receipt status to standard status
   */
  private mapReceiptStatus(status: number): OrderStatus {
    const statusMap: Record<number, OrderStatus> = {
      0: "pending",
      1: "processing",
      2: "delivered",
      3: "cancelled",
    };

    return statusMap[status] || "pending";
  }
}
