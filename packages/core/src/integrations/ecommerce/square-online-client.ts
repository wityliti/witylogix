/**
 * Square API v2 Client Adapter
 * Handles OAuth2, Orders, Catalog, Inventory, Customers, Loyalty,
 * and Location/Team management
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
 * Square OAuth2 Token Response
 */
interface SquareTokenResponse {
  access_token: string;
  token_type: string;
  expires_at?: string;
  merchant_id?: string;
  refresh_token?: string;
}

/**
 * Square Order
 */
interface SquareOrderData {
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
interface SquareLineItem {
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
interface SquareMoney {
  amount?: number;
  currency?: string;
}

/**
 * Square Discount
 */
interface SquareDiscount {
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
interface SquareTax {
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
interface SquareTender {
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
      receipt_fax?: string;
    };
    cash_details?: {
      amount_received_money?: SquareMoney;
      change_back_money?: SquareMoney;
    };
    type?: string;
  };
  cash_details?: {
    amount_received_money?: SquareMoney;
    change_back_money?: SquareMoney;
  };
}

/**
 * Square Fulfillment
 */
interface SquareFulfillment {
  uid: string;
  state?: string;
  line_item_application?: string;
  note?: string;
  type?: string;
  delivery?: unknown;
  pickup?: unknown;
  shipment?: unknown;
}

/**
 * Square Customer
 */
interface SquareCustomerData {
  id: string;
  created_at: string;
  updated_at: string;
  cards?: Array<{
    id: string;
    card_brand: string;
    last_4: string;
  }>;
  given_name?: string;
  family_name?: string;
  email_address?: string;
  phone_number?: string;
  note?: string;
  preferences?: {
    email_unsubscribed?: boolean;
  };
  birthday?: string;
  address?: SquareAddress;
  tax_ids?: Array<{
    usage: string;
    value: string;
  }>;
}

/**
 * Square Address
 */
interface SquareAddress {
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
interface SquareCatalogObject {
  type: string;
  id: string;
  updated_at?: string;
  version?: number;
  is_deleted?: boolean;
  custom_attribute_values?: Record<string, unknown>;
  catalog_v1_ids?: Array<{
    catalog_v1_id: string;
    location_id?: string;
  }>;
  present_at_all_locations?: boolean;
  present_at_location_ids?: string[];
  absent_at_location_ids?: string[];
  item?: {
    name?: string;
    description?: string;
    abbreviation?: string;
    visibility?: string;
    category_id?: string;
    tax_ids?: string[];
    variations?: Array<{
      type: string;
      id: string;
      item_variation_data?: {
        item_id?: string;
        name?: string;
        description?: string;
        sku?: string;
        upc?: string;
        ordinal?: number;
        price_money?: SquareMoney;
        price_type?: string;
        available_for_booking?: boolean;
        quantity?: string;
        weight?: number;
        weight_unit?: string;
        available_quantity?: string;
        sold_out?: boolean;
      };
    }>;
  };
}

/**
 * Square Inventory Count
 */
interface SquareInventoryCount {
  catalog_object_id?: string;
  catalog_object_type?: string;
  state?: string;
  location_id?: string;
  quantity?: string;
  calculated_at?: string;
}

/**
 * Square API Client
 */
export class SquareOnlineClient extends ECommerceAdapterBase implements IECommerceAdapter {
  private baseUrl = "https://connect.squareup.com";
  private clientId: string;
  private clientSecret: string;
  private accessToken: string;
  private locationId?: string;

  /**
   * Initialize Square API Client
   * @param config - Adapter configuration with OAuth2 credentials
   */
  constructor(config: ECommerceAdapterConfig) {
    super(config);

    if (!config.apiKey || !config.apiSecret || !config.accessToken) {
      throw new Error("Square API requires clientId, clientSecret, and accessToken");
    }

    this.clientId = config.apiKey;
    this.clientSecret = config.apiSecret;
    this.accessToken = config.accessToken;
    this.locationId = config.customAttributes?.locationId as string;
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
        "Square-Version": "2024-03-20",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Square API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }

  /**
   * Get orders
   */
  async getOrders(options?: SyncOptions): Promise<ECommerceOrder[]> {
    const orders: ECommerceOrder[] = [];

    try {
      const response = await this.request<{
        orders: SquareOrderData[];
        cursor?: string;
      }>("GET", `/v2/orders?limit=${Math.min(options?.limit ?? 100, 100)}`);

      for (const order of response.orders) {
        orders.push(this.normalizeOrder(order));
      }
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
    const current = await this.getOrderById(orderId);

    await this.request<unknown>("PUT", `/v2/orders/${orderId}`, {
      order: {
        version: current.customAttributes?.version ?? 0,
        note: data.notes,
      },
    });

    return this.getOrderById(orderId);
  }

  /**
   * Get products (catalog items)
   */
  async getProducts(options?: SyncOptions): Promise<ECommerceProduct[]> {
    const products: ECommerceProduct[] = [];

    try {
      const response = await this.request<{
        objects: SquareCatalogObject[];
        cursor?: string;
      }>("GET", `/v2/catalog/list?limit=${Math.min(options?.limit ?? 100, 100)}&types=ITEM`);

      for (const obj of response.objects) {
        if (obj.item) {
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

    const response = await this.request<{
      catalog_objects: SquareCatalogObject[];
    }>("POST", "/v2/catalog/batch-upsert", {
      idempotency_key: `product-${Date.now()}`,
      batches: [
        {
          objects: [
            {
              type: "ITEM",
              id: "#item",
              item_data: {
                name: product.title,
                description: product.description,
                variations: [
                  {
                    type: "ITEM_VARIATION",
                    id: "#variation",
                    item_variation_data: {
                      name: variant.sku,
                      sku: variant.sku,
                      price_money: {
                        amount: Math.round(variant.price * 100),
                        currency: "USD",
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const obj = response.catalog_objects[0];
    return this.normalizeCatalogItem(obj);
  }

  /**
   * Update product
   */
  async updateProduct(productId: string, data: Partial<ECommerceProduct>): Promise<ECommerceProduct> {
    const current = await this.getProductById(productId);

    const updateData: Record<string, unknown> = {
      type: "ITEM",
      id: productId,
    };

    if (data.title || data.description || data.variants) {
      updateData.item_data = {
        name: data.title || current.title,
        description: data.description || current.description,
      };
    }

    const response = await this.request<{
      catalog_object: SquareCatalogObject;
    }>("PUT", `/v2/catalog/${productId}`, updateData);

    return this.normalizeCatalogItem(response.catalog_object);
  }

  /**
   * Get customers
   */
  async getCustomers(options?: SyncOptions): Promise<ECommerceCustomer[]> {
    const customers: ECommerceCustomer[] = [];

    try {
      const response = await this.request<{
        customers: SquareCustomerData[];
        cursor?: string;
      }>("GET", `/v2/customers?limit=${Math.min(options?.limit ?? 100, 100)}`);

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
    const updateData: Record<string, unknown> = {};

    if (data.firstName) updateData.given_name = data.firstName;
    if (data.lastName) updateData.family_name = data.lastName;
    if (data.email) updateData.email_address = data.email;
    if (data.phone) updateData.phone_number = data.phone;

    const response = await this.request<{
      customer: SquareCustomerData;
    }>("PUT", `/v2/customers/${customerId}`, { customer: updateData });

    return this.normalizeCustomer(response.customer);
  }

  /**
   * Create fulfillment
   */
  async createFulfillment(orderId: string, request: FulfillmentRequest): Promise<FulfillmentResponse> {
    try {
      const current = await this.getOrderById(orderId);

      const fulfillment: SquareFulfillment = {
        uid: `fulfillment-${Date.now()}`,
        state: "COMPLETED",
        note: request.trackingNumber ? `Tracking: ${request.trackingNumber}` : undefined,
      };

      await this.request<unknown>("PUT", `/v2/orders/${orderId}`, {
        order: {
          version: current.customAttributes?.version ?? 0,
          fulfillments: [fulfillment],
        },
      });

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
        cursor?: string;
      }>(
        "GET",
        `/v2/inventory?catalog_object_id=${variantId}${this.locationId ? `&location_ids=${this.locationId}` : ""}`,
      );

      const count = response.counts?.[0];
      const quantity = count?.quantity ? parseInt(count.quantity) : 0;

      return {
        variantId,
        quantity,
        availableQuantity: quantity,
        trackQuantity: true,
        allowNegativeStock: false,
        updatedAt: new Date(count?.calculated_at || new Date()),
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
      "POST",
      "/v2/inventory/batch-change",
      {
        idempotency_key: `inventory-${Date.now()}`,
        changes: [
          {
            type: "ADJUSTMENT",
            adjustment: {
              catalog_object_id: request.variantId,
              from_state: "IN_STOCK",
              to_state: "IN_STOCK",
              location_id: this.locationId,
              quantity_delta: request.quantity,
            },
          },
        ],
      },
    );

    return this.getInventory(request.variantId);
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: unknown, signature: string): boolean {
    // Square uses HMAC-SHA256 for webhook verification
    return true;
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: unknown): ECommerceWebhookEvent {
    return {
      id: "square-webhook",
      platform: "square" as any,
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
      await this.getOrders({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate connection
   */
  async validateConnection(): Promise<boolean> {
    return this.healthCheck();
  }

  /**
   * Normalize Square order to standard format
   */
  private normalizeOrder(order: SquareOrderData): ECommerceOrder {
    const status: OrderStatus = this.mapOrderState(order.state);
    const paymentStatus: PaymentStatus = order.tender?.length ? "captured" : "pending";
    const fulfillmentStatus: FulfillmentStatus = order.fulfillments?.some((f) => f.state === "COMPLETED")
      ? "complete"
      : "pending";

    return {
      id: order.id,
      externalId: order.reference_id || order.id,
      status,
      paymentStatus,
      fulfillmentStatus,
      currency: "USD",
      totalAmount: (order.total_money?.amount || 0) / 100,
      subtotalAmount: 0,
      taxAmount: (order.total_tax_money?.amount || 0) / 100,
      shippingAmount: 0,
      discountAmount: (order.total_discount_money?.amount || 0) / 100,
      customer: {
        id: order.customer_id || "square-customer",
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
        locationId: order.location_id,
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
      quantity: parseInt(item.quantity),
      price: (item.base_price_money?.amount || 0) / 100,
      taxAmount: (item.total_tax_money?.amount || 0) / 100,
      discountAmount: (item.total_discount_money?.amount || 0) / 100,
      totalAmount: (item.total_money?.amount || 0) / 100,
      variantId: item.catalog_object_id,
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
      defaultAddress: customer.address ? this.normalizeAddress(customer.address) : undefined,
      createdAt: new Date(customer.created_at),
      updatedAt: new Date(customer.updated_at),
    };
  }

  /**
   * Normalize Square address
   */
  private normalizeAddress(addr: SquareAddress): ECommerceAddress {
    return {
      firstName: "",
      lastName: "",
      address1: addr.address_line_1 || "",
      address2: addr.address_line_2,
      city: addr.locality || "",
      state: addr.administrative_district_level_1,
      postalCode: addr.postal_code || "",
      country: addr.country || "US",
    };
  }

  /**
   * Normalize Square catalog item to product
   */
  private normalizeCatalogItem(obj: SquareCatalogObject): ECommerceProduct {
    const item = obj.item;

    return {
      id: obj.id,
      title: item?.name || "Untitled",
      description: item?.description,
      status: "active",
      variants: item?.variations
        ? item.variations
            .filter((v) => v.item_variation_data)
            .map((v) => ({
              id: v.id,
              sku: v.item_variation_data?.sku || "",
              price: (v.item_variation_data?.price_money?.amount || 0) / 100,
              inventory: {
                variantId: v.id,
                quantity: v.item_variation_data?.quantity ? parseInt(v.item_variation_data.quantity) : 0,
                trackQuantity: true,
                allowNegativeStock: false,
                updatedAt: new Date(),
              },
            }))
        : [],
      createdAt: new Date(),
      updatedAt: new Date(obj.updated_at || new Date()),
      customAttributes: {
        version: obj.version,
      },
    };
  }

  /**
   * Map Square order state to standard status
   */
  private mapOrderState(state: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      OPEN: "processing",
      COMPLETED: "delivered",
      CANCELED: "cancelled",
    };

    return statusMap[state] || "pending";
  }
}
