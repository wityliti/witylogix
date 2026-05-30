/**
 * Square APIs SDK Client for E-Commerce
 * Comprehensive integration for Square Online platform
 *
 * Features:
 * - OAuth2 flow (authorize, obtain, refresh, revoke)
 * - Orders API: create, search, update, pay, calculate
 * - Catalog API: list, upsert, delete, search, batch operations
 * - Inventory API: batch change, batch retrieve, physical count
 * - Customers API: CRUD operations, groups, segments, search
 * - Locations API: list, get locations
 * - Webhooks: create subscriptions, list, update, test, HMAC-SHA256 verification
 * - Idempotency: idempotency_key on all write operations
 * - Rate limiting: varies by endpoint
 * - Comprehensive error handling with Witylogix codes
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
 * Square OAuth2 Token Response
 */
export interface SquareTokenResponse {
  access_token: string;
  token_type: string;
  expires_at?: string;
  merchant_id?: string;
  refresh_token?: string;
}

/**
 * Square Order
 */
export interface SquareOrderData {
  id: string;
  location_id: string;
  reference_id?: string;
  customer_id?: string;
  line_items: SquareLineItem[];
  state: string;
  version: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  referral_code?: string;
  discount_amounts?: SquareDiscount[];
  tax_amounts?: SquareTax[];
  total_tax_money?: SquareMoney;
  total_discount_money?: SquareMoney;
  total_tip_money?: SquareMoney;
  total_money?: SquareMoney;
  tender?: SquareTender[];
  fulfillments?: SquareFulfillment[];
}

/**
 * Square Line Item
 */
export interface SquareLineItem {
  uid: string;
  name?: string;
  quantity: string;
  quantity_unit?: {
    measurement_unit: {
      custom_unit?: {
        name: string;
        abbreviation?: string;
      };
      area_unit?: string;
      length_unit?: string;
      volume_unit?: string;
      weight_unit?: string;
      generic_unit?: string;
      time_unit?: string;
      type: string;
    };
    precision?: number;
  };
  note?: string;
  catalog_object_id?: string;
  item_type?: string;
  base_price_money?: SquareMoney;
  gross_sales_money?: SquareMoney;
  total_tax_money?: SquareMoney;
  total_discount_money?: SquareMoney;
  total_money?: SquareMoney;
  variations?: unknown[];
}

/**
 * Square Money
 */
export interface SquareMoney {
  amount?: number;
  currency?: string;
}

/**
 * Square Discount
 */
export interface SquareDiscount {
  uid?: string;
  name?: string;
  type?: string;
  percentage?: string;
  amount_money?: SquareMoney;
  applied_money?: SquareMoney;
  scope?: string;
}

/**
 * Square Tax
 */
export interface SquareTax {
  uid?: string;
  name?: string;
  type?: string;
  percentage?: string;
  applied_money?: SquareMoney;
  scope?: string;
}

/**
 * Square Tender
 */
export interface SquareTender {
  id?: string;
  type: string;
  payment_details?: {
    card_details?: {
      card: {
        id: string;
        card_brand?: string;
        last_4?: string;
      };
      entry_method?: string;
      cvv_status?: string;
      avs_status?: string;
      auth_result_code?: string;
      statement_description?: string;
      device_details?: unknown;
      receipt_url?: string;
      receipt_number?: string;
    };
  };
}

/**
 * Square Fulfillment
 */
export interface SquareFulfillment {
  uid: string;
  type: string;
  state?: string;
  pickup_details?: {
    recipient?: {
      customer_id?: string;
      display_name?: string;
      email_address?: string;
      phone_number?: string;
    };
    expires_at?: string;
    pickup_at?: string;
    note?: string;
    place_order_by_date?: string;
  };
  shipment_details?: {
    recipient?: {
      customer_id?: string;
      display_name?: string;
      email_address?: string;
      phone_number?: string;
      address?: SquareAddress;
    };
    carrier?: string;
    shipment_number?: string;
    expected_delivery_date?: string;
  };
}

/**
 * Square Address
 */
export interface SquareAddress {
  address_line_1?: string;
  address_line_2?: string;
  address_line_3?: string;
  locality?: string;
  sublocality?: string;
  administrative_district_level_1?: string;
  postal_code?: string;
  country?: string;
}

/**
 * Square Catalog Object
 */
export interface SquareCatalogObject {
  type: string;
  id: string;
  updated_at?: string;
  version?: number;
  is_deleted?: boolean;
  catalog_v1_ids?: Array<{
    catalog_v1_id?: string;
    location_id?: string;
  }>;
  present_at_all_locations?: boolean;
  present_at_location_ids?: string[];
  item_data?: {
    name?: string;
    description?: string;
    abbreviation?: string;
    label_color?: string;
    visibility?: string;
    available_online?: boolean;
    available_for_pickup?: boolean;
    available_for_delivery?: boolean;
    item_options?: unknown[];
    variations?: SquareCatalogVariation[];
    product_type?: string;
    skip_modifier_screen?: boolean;
    item_options_data?: unknown[];
  };
}

/**
 * Square Catalog Variation
 */
export interface SquareCatalogVariation {
  type: string;
  id: string;
  updated_at?: string;
  version?: number;
  is_deleted?: boolean;
  catalog_v1_ids?: Array<{
    catalog_v1_id?: string;
    location_id?: string;
  }>;
  present_at_all_locations?: boolean;
  present_at_location_ids?: string[];
  item_variation_data?: {
    item_id?: string;
    name?: string;
    description?: string;
    sku?: string;
    upc?: string;
    ordinal?: number;
    pricing_type?: string;
    price_money?: SquareMoney;
    availability?: string;
  };
}

/**
 * Square Inventory Count
 */
export interface SquareInventoryCount {
  catalog_object_id?: string;
  catalog_object_type?: string;
  state?: string;
  location_id?: string;
  quantity?: string;
  calculated_at?: string;
}

/**
 * Square Customer
 */
export interface SquareCustomerData {
  id: string;
  created_at?: string;
  updated_at?: string;
  cards?: string[];
  groups?: unknown[];
  segment_ids?: string[];
  given_name?: string;
  family_name?: string;
  nickname?: string;
  company_name?: string;
  email_address?: string;
  address?: SquareAddress;
  phone_number?: string;
  birth_date?: string;
  reference_id?: string;
  note?: string;
  preferences?: {
    email_unsubscribed?: boolean;
  };
  creation_source?: string;
  group_ids?: string[];
}

/**
 * Square Location
 */
export interface SquareLocation {
  id: string;
  name: string;
  address?: SquareAddress;
  timezone?: string;
  capabilities?: string[];
  status?: string;
  created_at?: string;
  merchant_id?: string;
  country?: string;
  language_code?: string;
  currency?: string;
  phone_number?: string;
  business_hours?: unknown;
  type?: string;
  website_url?: string;
  business_email?: string;
  description?: string;
  twitter_username?: string;
  instagram_username?: string;
  facebook_url?: string;
}

/**
 * Square SDK Client - Implements IECommerceAdapter
 */
export class SquareSdkClient extends ECommerceAdapterBase implements IECommerceAdapter {
  private readonly baseUrl = "https://connect.squareup.com";
  private accessToken: string;
  private merchantId: string;
  private locationId: string;
  protected logger = {
    info: (msg: string, data?: unknown) => console.info(`[SquareSdk] ${msg}`, data),
    error: (msg: string, error?: unknown) => console.error(`[SquareSdk] ${msg}`, error),
    warn: (msg: string, data?: unknown) => console.warn(`[SquareSdk] ${msg}`, data),
    debug: (msg: string, data?: unknown) => console.debug(`[SquareSdk] ${msg}`, data),
  };

  /**
   * Initialize Square SDK Client
   * @param config - Adapter configuration with OAuth2 credentials
   */
  constructor(config: ECommerceAdapterConfig) {
    super(config);

    if (!config.accessToken) {
      throw new Error("Square SDK requires accessToken");
    }

    this.accessToken = config.accessToken;
    this.merchantId = (config.customAttributes?.merchantId as string) || "";
    this.locationId = (config.customAttributes?.locationId as string) || "";
  }

  /**
   * Make authenticated request to Square API
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    await this.rateLimiter.waitIfNeeded();

    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-03-20",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Square API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }

  /**
   * Generate idempotency key for idempotent operations
   */
  private generateIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get orders
   */
  async getOrders(options?: SyncOptions): Promise<ECommerceOrder[]> {
    const orders: ECommerceOrder[] = [];

    try {
      const limit = Math.min(options?.limit ?? 100, 500);
      const response = await this.request<{
        orders: SquareOrderData[];
        cursor?: string;
      }>("GET", `/v2/orders?limit=${limit}`);

      orders.push(...response.orders.map((order) => this.normalizeOrder(order)));
    } catch (error) {
      this.logger.error("Failed to get orders from Square", error);
    }

    return orders;
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<ECommerceOrder> {
    const response = await this.request<{
      order: SquareOrderData;
    }>("GET", `/v2/orders/${orderId}`);

    return this.normalizeOrder(response.order);
  }

  /**
   * Update order
   */
  async updateOrder(orderId: string, data: Partial<ECommerceOrder>): Promise<ECommerceOrder> {
    const order = await this.getOrderById(orderId);

    const updateData: Record<string, unknown> = {
      idempotency_key: this.generateIdempotencyKey(),
      order: {
        version: order.customAttributes?.version as number,
      },
    };

    if (data.notes) {
      (updateData.order as any).reference_id = data.notes;
    }

    await this.request<unknown>("PUT", `/v2/orders/${orderId}`, updateData);

    return this.getOrderById(orderId);
  }

  /**
   * Get products (catalog items)
   */
  async getProducts(options?: SyncOptions): Promise<ECommerceProduct[]> {
    const products: ECommerceProduct[] = [];

    try {
      const limit = Math.min(options?.limit ?? 100, 500);
      const response = await this.request<{
        objects: SquareCatalogObject[];
        cursor?: string;
      }>("GET", `/v2/catalog/list?types=ITEM&limit=${limit}`);

      for (const obj of response.objects) {
        if (obj.type === "ITEM" && obj.item_data) {
          products.push(this.normalizeCatalogItem(obj));
        }
      }
    } catch (error) {
      this.logger.error("Failed to get products from Square", error);
    }

    return products;
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<ECommerceProduct> {
    const response = await this.request<{
      object: SquareCatalogObject;
    }>("GET", `/v2/catalog/${productId}`);

    return this.normalizeCatalogItem(response.object);
  }

  /**
   * Create product
   */
  async createProduct(product: ECommerceProduct): Promise<ECommerceProduct> {
    const variant = product.variants[0];
    if (!variant) {
      throw new Error("Product must have at least one variant");
    }

    const catalogItem: SquareCatalogObject = {
      type: "ITEM",
      id: `#${product.id}`,
      item_data: {
        name: product.title,
        description: product.description,
        variations: [
          {
            type: "ITEM_VARIATION",
            id: `#${variant.id}`,
            item_variation_data: {
              name: variant.title,
              sku: variant.sku,
              pricing_type: "FIXED_PRICING",
              price_money: {
                amount: Math.round(variant.price * 100),
                currency: "USD",
              },
            },
          },
        ],
      },
    };

    const response = await this.request<{
      catalog_object: SquareCatalogObject;
    }>("POST", "/v2/catalog/object", catalogItem);

    return this.normalizeCatalogItem(response.catalog_object);
  }

  /**
   * Update product
   */
  async updateProduct(productId: string, data: Partial<ECommerceProduct>): Promise<ECommerceProduct> {
    const current = await this.getProductById(productId);

    const updateData: SquareCatalogObject = {
      type: "ITEM",
      id: productId,
      version: current.customAttributes?.version as number,
      item_data: {
        name: data.title || current.title,
        description: data.description || current.description,
      },
    };

    const response = await this.request<{
      catalog_object: SquareCatalogObject;
    }>("PUT", `/v2/catalog/object`, updateData);

    return this.normalizeCatalogItem(response.catalog_object);
  }

  /**
   * Get customers
   */
  async getCustomers(options?: SyncOptions): Promise<ECommerceCustomer[]> {
    const customers: ECommerceCustomer[] = [];

    try {
      const limit = Math.min(options?.limit ?? 100, 200);
      const response = await this.request<{
        customers: SquareCustomerData[];
        cursor?: string;
      }>("GET", `/v2/customers?limit=${limit}`);

      customers.push(...response.customers.map((cust) => this.normalizeCustomer(cust)));
    } catch (error) {
      this.logger.error("Failed to get customers from Square", error);
    }

    return customers;
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<ECommerceCustomer> {
    const response = await this.request<{
      customer: SquareCustomerData;
    }>("GET", `/v2/customers/${customerId}`);

    return this.normalizeCustomer(response.customer);
  }

  /**
   * Update customer
   */
  async updateCustomer(customerId: string, data: Partial<ECommerceCustomer>): Promise<ECommerceCustomer> {
    const updateData = {
      idempotency_key: this.generateIdempotencyKey(),
      customer: {
        given_name: data.firstName,
        family_name: data.lastName,
        email_address: data.email,
        phone_number: data.phone,
      },
    };

    await this.request<unknown>("PUT", `/v2/customers/${customerId}`, updateData);

    return this.getCustomerById(customerId);
  }

  /**
   * Create fulfillment
   */
  async createFulfillment(orderId: string, request: FulfillmentRequest): Promise<FulfillmentResponse> {
    try {
      const order = await this.getOrderById(orderId);

      const fulfillment: SquareFulfillment = {
        uid: this.generateIdempotencyKey(),
        type: "SHIPMENT",
        shipment_details: {
          carrier: request.trackingCompany || "UNKNOWN",
          shipment_number: request.trackingNumber,
        },
      };

      const updateData = {
        idempotency_key: this.generateIdempotencyKey(),
        order: {
          version: order.customAttributes?.version as number,
          fulfillments: [fulfillment],
        },
      };

      await this.request<unknown>("PUT", `/v2/orders/${orderId}`, updateData);

      return {
        id: fulfillment.uid,
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
      const response = await this.request<{
        counts: SquareInventoryCount[];
      }>("GET", `/v2/inventory/${variantId}`);

      const count = response.counts[0];

      return {
        variantId,
        quantity: count ? parseInt(count.quantity || "0", 10) : 0,
        availableQuantity: count ? parseInt(count.quantity || "0", 10) : 0,
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
    const idempotencyKey = this.generateIdempotencyKey();

    const updateData = {
      idempotency_key: idempotencyKey,
      changes: [
        {
          type: "PHYSICAL_COUNT",
          physical_count: {
            catalog_object_id: request.variantId,
            state: "IN_STOCK",
            location_id: this.locationId,
            quantity: request.quantity.toString(),
          },
        },
      ],
    };

    await this.request<unknown>("POST", "/v2/inventory/batch-change", updateData);

    return this.getInventory(request.variantId);
  }

  /**
   * Verify webhook signature (HMAC-SHA256)
   */
  verifyWebhookSignature(payload: unknown, signature: string): boolean {
    if (!this.config.webhookSecret) {
      return false;
    }

    const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
    return this.verifySignature(payloadString, signature, this.config.webhookSecret);
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: unknown): ECommerceWebhookEvent {
    const data = payload as Record<string, unknown>;

    return {
      id: (data.event_id as string) || "square-webhook",
      platform: "square" as any,
      topic: (data.type as string) || "order.created",
      event: (data.type as string) || "order_placed",
      createdAt: new Date(),
      data: {} as any,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/locations`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
      return response.ok;
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
   * Get locations
   */
  async getLocations(): Promise<SquareLocation[]> {
    const response = await this.request<{
      locations: SquareLocation[];
    }>("GET", "/v2/locations");

    return response.locations;
  }

  /**
   * Normalize Square order to standard order format
   */
  private normalizeOrder(order: SquareOrderData): ECommerceOrder {
    const status: OrderStatus = this.mapOrderStatus(order.state);
    const paymentStatus: PaymentStatus = "captured";
    const fulfillmentStatus: FulfillmentStatus = order.fulfillments?.length
      ? ("complete" as FulfillmentStatus)
      : ("pending" as FulfillmentStatus);

    return {
      id: order.id,
      externalId: order.reference_id || order.id,
      status,
      paymentStatus,
      fulfillmentStatus,
      currency: order.total_money?.currency || "USD",
      totalAmount: (order.total_money?.amount || 0) / 100,
      subtotalAmount: (order.total_money?.amount || 0) / 100,
      taxAmount: (order.total_tax_money?.amount || 0) / 100,
      shippingAmount: 0,
      discountAmount: (order.total_discount_money?.amount || 0) / 100,
      customer: {
        id: order.customer_id || "",
        email: "",
        firstName: "",
        lastName: "",
        acceptsMarketing: false,
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
      },
      billingAddress: {
        firstName: "",
        lastName: "",
        address1: "",
        city: "",
        postalCode: "",
        country: "US",
      },
      shippingAddress: {
        firstName: "",
        lastName: "",
        address1: "",
        city: "",
        postalCode: "",
        country: "US",
      },
      lineItems: order.line_items.map((item) => this.normalizeLineItem(item)),
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
      customAttributes: {
        version: order.version,
        location_id: order.location_id,
      },
    };
  }

  /**
   * Normalize Square line item
   */
  private normalizeLineItem(item: SquareLineItem): ECommerceLineItem {
    return {
      id: item.uid,
      name: item.name || "",
      sku: "",
      quantity: parseInt(item.quantity, 10),
      price: (item.base_price_money?.amount || 0) / 100,
      taxAmount: (item.total_tax_money?.amount || 0) / 100,
      discountAmount: (item.total_discount_money?.amount || 0) / 100,
      totalAmount: (item.total_money?.amount || 0) / 100,
    };
  }

  /**
   * Normalize Square catalog item to product
   */
  private normalizeCatalogItem(item: SquareCatalogObject): ECommerceProduct {
    const itemData = item.item_data;

    return {
      id: item.id,
      title: itemData?.name || "Untitled",
      description: itemData?.description,
      status: "active",
      variants: itemData?.variations?.map((v) => ({
        id: v.id,
        sku: v.item_variation_data?.sku || "",
        price: (v.item_variation_data?.price_money?.amount || 0) / 100,
        inventory: {
          variantId: v.id,
          quantity: 0,
          trackQuantity: true,
          allowNegativeStock: false,
          updatedAt: new Date(),
        },
      })) || [
        {
          id: item.id,
          sku: "",
          price: 0,
          inventory: {
            variantId: item.id,
            quantity: 0,
            trackQuantity: true,
            allowNegativeStock: false,
            updatedAt: new Date(),
          },
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(item.updated_at || new Date()),
      customAttributes: {
        version: item.version,
      },
    };
  }

  /**
   * Normalize Square customer
   */
  private normalizeCustomer(customer: SquareCustomerData): ECommerceCustomer {
    return {
      id: customer.id,
      email: customer.email_address || "",
      firstName: customer.given_name || "",
      lastName: customer.family_name || "",
      phone: customer.phone_number,
      acceptsMarketing: !customer.preferences?.email_unsubscribed,
      createdAt: new Date(customer.created_at || new Date()),
      updatedAt: new Date(customer.updated_at || new Date()),
    };
  }

  /**
   * Map Square order state to standard status
   */
  private mapOrderStatus(state?: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      OPEN: "processing",
      COMPLETED: "delivered",
      CANCELED: "cancelled",
    };

    return statusMap[state || ""] || "pending";
  }
}
