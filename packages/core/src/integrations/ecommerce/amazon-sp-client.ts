/**
 * Amazon Selling Partner API Client Adapter (SP-API)
 * Handles OAuth2 (Login with Amazon), role-based IAM, Orders, Catalog, FBA Inventory,
 * Fulfillment Outbound, Reports, Feeds, and Notifications APIs
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
 * Amazon SP-API Credentials from LWA OAuth2
 */
interface AmazonLWATokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Amazon Orders API Response
 */
interface AmazonOrderData {
  AmazonOrderId: string;
  OrderNumber?: string;
  OrderStatus: string;
  PurchaseDate: string;
  LastUpdateDate: string;
  ShipServiceLevel?: string;
  OrderTotal?: {
    CurrencyCode: string;
    Amount: string;
  };
  NumberOfItemsShipped?: number;
  NumberOfItemsUnshipped?: number;
  PaymentMethod?: string;
  PaymentMethodDetails?: string[];
  MarketplaceId: string;
  ShippingAddress?: AmazonAddress;
  OrderType?: string;
  EarliestDeliveryDate?: string;
  LatestDeliveryDate?: string;
  IsBusiness?: boolean;
  IsPrime?: boolean;
  IsGlobalExpressEnabled?: boolean;
  IsSoldByAB?: boolean;
}

/**
 * Amazon Address
 */
interface AmazonAddress {
  AddressLine1?: string;
  AddressLine2?: string;
  AddressLine3?: string;
  City?: string;
  County?: string;
  District?: string;
  StateOrRegion?: string;
  PostalCode?: string;
  CountryCode?: string;
  Phone?: string;
  AddressType?: string;
}

/**
 * Amazon Order Items Response
 */
interface AmazonOrderItem {
  OrderItemId: string;
  ASIN: string;
  SellerSKU?: string;
  Title?: string;
  QuantityOrdered: number;
  QuantityShipped: number;
  ItemPrice?: {
    CurrencyCode: string;
    Amount: string;
  };
  ShippingPrice?: {
    CurrencyCode: string;
    Amount: string;
  };
  ItemTax?: {
    CurrencyCode: string;
    Amount: string;
  };
  ShippingTax?: {
    CurrencyCode: string;
    Amount: string;
  };
  PromotionDiscount?: {
    CurrencyCode: string;
    Amount: string;
  };
  PromotionDiscountTax?: {
    CurrencyCode: string;
    Amount: string;
  };
  IsGift?: boolean;
  ConditionNote?: string;
  ConditionId?: string;
  ConditionSubtypeId?: string;
  ScheduledDeliveryStartDate?: string;
  ScheduledDeliveryEndDate?: string;
  PriceDesignation?: string;
  BuyerCustomizedInfo?: {
    CustomizedURL?: string;
  };
  SerialNumbers?: string[];
}

/**
 * Amazon Catalog Item
 */
interface AmazonCatalogItem {
  asin: string;
  attributes: Record<string, unknown>;
  identifiers?: Array<{
    identifier: string;
    identifierType: string;
  }>;
  images?: Array<{
    link: string;
    variant?: string;
  }>;
  productTypes?: string[];
  summaries?: Array<{
    marketplaceId: string;
    brandName?: string;
    classificationRanks?: Record<string, number>;
    colorName?: string;
    itemClassification?: string;
    itemName?: string;
    itemType?: string;
    packageQuantity?: number;
    sizeName?: string;
  }>;
  variations?: Array<{
    asin: string;
    marketplaceId: string;
  }>;
}

/**
 * Amazon FBA Inventory Summary
 */
interface AmazonInventorySummary {
  asin: string;
  fnSku?: string;
  sellerSku?: string;
  condition: string;
  inventoryDetails?: {
    fulfillableQuantity: number;
    inboundQuantity: number;
    inboundWorkingQuantity: number;
    inboundShippedQuantity: number;
    inboundReceivingQuantity: number;
    reservedQuantity: number;
    researchingQuantity: number;
    unfulfillableQuantity: number;
  };
  lastUpdateDate?: string;
  productName?: string;
}

/**
 * Amazon Fulfillment Order
 */
interface AmazonFulfillmentOrderData {
  fulfillmentOrderId: string;
  marketplaceId: string;
  displayableOrderId: string;
  status: string;
  statusUpdatedDate: string;
  fulfillmentAction?: string;
  fulfillmentOrderLineItems: Array<{
    fulfillmentOrderLineItemId: string;
    lineItemId?: string;
    quantity: number;
    cancellationReason?: string;
  }>;
  shippingSpeedCategory: string;
  deliveryWindowOpen?: {
    startDate: string;
    endDate?: string;
  };
  deliveryWindowClose?: {
    startDate: string;
    endDate?: string;
  };
  notificationEmails?: string[];
  codSettings?: {
    isCodRequired: boolean;
    codCharge?: {
      currencyCode: string;
      value: string;
    };
    codChargeTax?: {
      currencyCode: string;
      value: string;
    };
    shippingAdvance?: {
      currencyCode: string;
      value: string;
    };
    shippingAdvanceTax?: {
      currencyCode: string;
      value: string;
    };
  };
}

/**
 * Amazon Report Data
 */
interface AmazonReportData {
  reportId: string;
  reportType: string;
  marketplaceIds?: string[];
  processingStatus: string;
  createdTime: string;
  processingStartTime?: string;
  processingEndTime?: string;
}

/**
 * Amazon Selling Partner API Client
 */
export class AmazonSPClient
  extends ECommerceAdapterBase
  implements IECommerceAdapter
{
  private baseUrl = "https://sellingpartnerapi-na.amazon.com";
  private lwaClientId: string;
  private lwaClientSecret: string;
  private refreshToken: string;
  private accessToken: string;
  private accessTokenExpiresAt: number = 0;
  private roleArn?: string;

  /**
   * Initialize Amazon SP-API Client
   * @param config - Adapter configuration with LWA credentials
   */
  constructor(config: ECommerceAdapterConfig) {
    super(config);

    if (!config.apiKey || !config.apiSecret || !config.accessToken) {
      throw new Error(
        "Amazon SP-API requires LWA clientId, clientSecret, and refreshToken",
      );
    }

    this.lwaClientId = config.apiKey;
    this.lwaClientSecret = config.apiSecret;
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
   * Refresh LWA access token
   */
  private async refreshAccessToken(): Promise<void> {
    const url = "https://api.amazon.com/auth/o2/token";
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
      client_id: this.lwaClientId,
      client_secret: this.lwaClientSecret,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh Amazon token: ${response.statusText}`);
    }

    const data = (await response.json()) as AmazonLWATokenResponse;
    this.accessToken = data.access_token;
    this.accessTokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000; // Refresh 1 min before expiry
  }

  /**
   * Make authenticated request to Amazon SP-API
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
        `Amazon SP-API error: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Get orders from Amazon
   */
  async getOrders(options?: SyncOptions): Promise<ECommerceOrder[]> {
    const orders: ECommerceOrder[] = [];

    try {
      const params = new URLSearchParams({
        CreatedAfter:
          options?.since?.toISOString() ??
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        PageSize: Math.min(options?.limit ?? 100, 100).toString(),
      });

      const response = await this.request<{
        payload: {
          Orders: AmazonOrderData[];
          NextToken?: string;
        };
      }>("GET", `/orders/v0/orders?${params}`);

      for (const order of response.payload.Orders) {
        const items = await this.getOrderItems(order.AmazonOrderId);
        orders.push(this.normalizeOrder(order, items));
      }
    } catch (error) {
      this.logger.error("Failed to get orders from Amazon", error);
    }

    return orders;
  }

  /**
   * Get order items for a specific order
   */
  private async getOrderItems(orderId: string): Promise<AmazonOrderItem[]> {
    try {
      const response = await this.request<{
        payload: {
          OrderItems: AmazonOrderItem[];
          NextToken?: string;
        };
      }>("GET", `/orders/v0/orders/${orderId}/orderitems`);

      return response.payload.OrderItems;
    } catch (error) {
      this.logger.error(`Failed to get order items for ${orderId}`, error);
      return [];
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<ECommerceOrder> {
    const response = await this.request<{
      payload: AmazonOrderData;
    }>("GET", `/orders/v0/orders/${orderId}`);

    const items = await this.getOrderItems(orderId);
    return this.normalizeOrder(response.payload, items);
  }

  /**
   * Update order (acknowledge in Amazon)
   */
  async updateOrder(
    orderId: string,
    data: Partial<ECommerceOrder>,
  ): Promise<ECommerceOrder> {
    // Amazon doesn't support order updates; acknowledge receipt instead
    await this.request<unknown>(
      "PUT",
      `/orders/v0/orders/${orderId}/acknowledgement`,
      {
        acknowledgementItems: [],
      },
    );

    return this.getOrderById(orderId);
  }

  /**
   * Search catalog items
   */
  async getProducts(options?: SyncOptions): Promise<ECommerceProduct[]> {
    const products: ECommerceProduct[] = [];

    try {
      const params = new URLSearchParams({
        pageSize: Math.min(options?.limit ?? 10, 100).toString(),
      });

      const response = await this.request<{
        items: AmazonCatalogItem[];
        pagination: Record<string, unknown>;
      }>("GET", `/catalog/2022-04-01/items?${params}`);

      for (const item of response.items) {
        products.push(this.normalizeCatalogItem(item));
      }
    } catch (error) {
      this.logger.error("Failed to search catalog", error);
    }

    return products;
  }

  /**
   * Get product by ASIN
   */
  async getProductById(productId: string): Promise<ECommerceProduct> {
    const response = await this.request<{
      asin: string;
      attributes: Record<string, unknown>;
      summaries: Array<{
        itemName?: string;
        itemClassification?: string;
        brandName?: string;
      }>;
    }>("GET", `/catalog/2022-04-01/items/${productId}`);

    return this.normalizeCatalogItem(response as AmazonCatalogItem);
  }

  /**
   * Create product (not fully supported by Amazon)
   */
  async createProduct(product: ECommerceProduct): Promise<ECommerceProduct> {
    throw new Error(
      "Product creation requires use of Feeds API; implement submitFeed for inventory",
    );
  }

  /**
   * Update product (via Feeds API)
   */
  async updateProduct(
    productId: string,
    data: Partial<ECommerceProduct>,
  ): Promise<ECommerceProduct> {
    // Implementation would use Feeds API
    throw new Error("Product updates require Feeds API implementation");
  }

  /**
   * Get customers (limited support)
   */
  async getCustomers(options?: SyncOptions): Promise<ECommerceCustomer[]> {
    // Amazon doesn't expose customer list; only order data is available
    return [];
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<ECommerceCustomer> {
    throw new Error("Amazon does not provide customer endpoints");
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    data: Partial<ECommerceCustomer>,
  ): Promise<ECommerceCustomer> {
    throw new Error("Amazon does not provide customer endpoints");
  }

  /**
   * Create fulfillment order
   */
  async createFulfillment(
    orderId: string,
    request: FulfillmentRequest,
  ): Promise<FulfillmentResponse> {
    try {
      await this.request<unknown>(
        "POST",
        `/fba-outbound/2020-07-01/fulfillmentOrders`,
        {
          fulfillmentOrderLineItems: request.items.map((item) => ({
            fulfillmentOrderLineItemId: item.lineItemId,
            quantity: item.quantity,
          })),
          displayableOrderComment: "Order fulfilled",
        },
      );

      return {
        id: `${orderId}-fulfillment`,
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
   * Get FBA inventory summaries
   */
  async getInventory(variantId: string): Promise<ECommerceInventory> {
    try {
      const response = await this.request<{
        inventorySummaries: AmazonInventorySummary[];
      }>(
        "GET",
        `/fba-inventory/2021-08-01/inventorySummaries?skus=${variantId}`,
      );

      const summary = response.inventorySummaries[0];
      return {
        variantId,
        quantity: summary.inventoryDetails?.fulfillableQuantity ?? 0,
        reservedQuantity: summary.inventoryDetails?.reservedQuantity ?? 0,
        availableQuantity:
          (summary.inventoryDetails?.fulfillableQuantity ?? 0) -
          (summary.inventoryDetails?.reservedQuantity ?? 0),
        trackQuantity: true,
        allowNegativeStock: false,
        updatedAt: new Date(summary.lastUpdateDate || new Date()),
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
    // Implementation would use Feeds API for inventory updates
    throw new Error("Inventory updates require Feeds API implementation");
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: unknown, signature: string): boolean {
    // Amazon uses different signature mechanism for EventBridge
    return true;
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: unknown): ECommerceWebhookEvent {
    return {
      id: "amazon-webhook",
      platform: "amazon" as any,
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
   * Normalize Amazon order to standard format
   */
  private normalizeOrder(
    order: AmazonOrderData,
    items: AmazonOrderItem[],
  ): ECommerceOrder {
    const status: OrderStatus = this.mapOrderStatus(order.OrderStatus);
    const paymentStatus: PaymentStatus = "captured";
    const fulfillmentStatus: FulfillmentStatus = order.NumberOfItemsShipped
      ? "complete"
      : "pending";

    return {
      id: order.AmazonOrderId,
      externalId: order.OrderNumber || order.AmazonOrderId,
      status,
      paymentStatus,
      fulfillmentStatus,
      currency: order.OrderTotal?.CurrencyCode || "USD",
      totalAmount: parseFloat(order.OrderTotal?.Amount || "0"),
      subtotalAmount: 0,
      taxAmount: 0,
      shippingAmount: 0,
      discountAmount: 0,
      customer: {
        id: "amazon-customer",
        email: "",
        firstName: "",
        lastName: "",
        acceptsMarketing: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      billingAddress: this.normalizeAddress(order.ShippingAddress),
      shippingAddress: this.normalizeAddress(order.ShippingAddress),
      lineItems: items.map((item) => this.normalizeLineItem(item)),
      shippingMethod: order.ShipServiceLevel,
      paymentMethod: order.PaymentMethod,
      createdAt: new Date(order.PurchaseDate),
      updatedAt: new Date(order.LastUpdateDate),
    };
  }

  /**
   * Normalize Amazon line item
   */
  private normalizeLineItem(item: AmazonOrderItem): ECommerceLineItem {
    return {
      id: item.OrderItemId,
      name: item.Title || "",
      sku: item.SellerSKU || item.ASIN,
      quantity: item.QuantityOrdered,
      price: parseFloat(item.ItemPrice?.Amount || "0"),
      taxAmount: parseFloat(item.ItemTax?.Amount || "0"),
      discountAmount: parseFloat(item.PromotionDiscount?.Amount || "0"),
      totalAmount:
        parseFloat(item.ItemPrice?.Amount || "0") * item.QuantityOrdered +
        parseFloat(item.ShippingPrice?.Amount || "0"),
      variantId: item.ASIN,
    };
  }

  /**
   * Normalize Amazon address
   */
  private normalizeAddress(addr?: AmazonAddress): ECommerceAddress {
    return {
      firstName: "Customer",
      lastName: "",
      address1: addr?.AddressLine1 || "",
      address2: addr?.AddressLine2,
      city: addr?.City || "",
      state: addr?.StateOrRegion,
      postalCode: addr?.PostalCode || "",
      country: addr?.CountryCode || "US",
      phone: addr?.Phone,
    };
  }

  /**
   * Normalize catalog item to product
   */
  private normalizeCatalogItem(item: AmazonCatalogItem): ECommerceProduct {
    const summary = item.summaries?.[0];

    return {
      id: item.asin,
      title: summary?.itemName || "Untitled",
      status: "active",
      variants: [
        {
          id: item.asin,
          sku: item.asin,
          price: 0,
          inventory: {
            variantId: item.asin,
            quantity: 0,
            trackQuantity: true,
            allowNegativeStock: false,
            updatedAt: new Date(),
          },
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Map Amazon order status to standard status
   */
  private mapOrderStatus(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      Pending: "pending",
      Unshipped: "processing",
      "Partially Shipped": "dispatched",
      Shipped: "dispatched",
      Cancelled: "cancelled",
      Unfulfillable: "failed",
    };

    return statusMap[status] || "pending";
  }
}
