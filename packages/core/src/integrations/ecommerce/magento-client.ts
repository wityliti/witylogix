/**
 * Magento 2 REST API Client Adapter
 * Handles OAuth2 token management, API requests, and data normalization
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
} from "./types.js";
import { ECommerceAdapterBase } from "./ecommerce-adapter.js";

/**
 * Magento 2 API Response Types
 */
interface MagentoOrderData {
  entity_id: number;
  increment_id: string;
  status: string;
  state: string;
  grand_total: number;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  discount_description?: string;
  payment: {
    method: string;
  };
  items: Array<{
    item_id: number;
    name: string;
    sku: string;
    qty_ordered: number;
    price: number;
    tax_amount: number;
    discount_amount: number;
    row_total: number;
  }>;
  billing_address: MagentoAddress;
  shipping_address: MagentoAddress;
  customer: MagentoCustomer;
  created_at: string;
  updated_at: string;
}

interface MagentoAddress {
  firstname: string;
  lastname: string;
  company?: string;
  street?: string[] | string;
  city: string;
  region?: string;
  postcode: string;
  country_id: string;
  email?: string;
  telephone?: string;
}

interface MagentoCustomer {
  entity_id: number;
  firstname: string;
  lastname: string;
  email: string;
  taxvat?: string;
  created_at: string;
  updated_at: string;
}

interface MagentoProduct {
  id: number;
  sku: string;
  name: string;
  description?: string;
  type_id: string;
  status: number; // 1 = enabled, 2 = disabled
  visibility: number;
  price: number;
  cost?: number;
  created_at: string;
  updated_at: string;
  extension_attributes: {
    stock_item?: {
      item_id: number;
      product_id: number;
      qty: number;
      manage_stock: boolean;
      use_config_manage_stock: boolean;
      backorders: number;
      use_config_backorders: boolean;
      is_in_stock: boolean;
    };
    image_url?: string;
  };
}

interface MagentoShipment {
  entity_id: number;
  order_id: number;
  increment_id: string;
  tracks: Array<{
    track_id: number;
    title: string;
    number: string;
  }>;
  items: Array<{
    item_id: number;
    parent_item_id?: number;
    qty: number;
  }>;
  created_at: string;
  updated_at: string;
}

interface MagentoTokenResponse {
  token: string;
  expires_in?: number;
}

/**
 * Magento 2 Client
 */
export class MagentoClient extends ECommerceAdapterBase implements IECommerceAdapter {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private baseUrl: string;

  constructor(config: ECommerceAdapterConfig) {
    super(config);
    this.baseUrl = (config.storeUrl || "").replace(/\/$/, "");

    if (!this.baseUrl) {
      throw new Error("Magento store URL is required");
    }
  }

  /**
   * Get or refresh OAuth2 access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiresAt > Date.now()) {
      return this.accessToken;
    }

    // Generate new token
    const tokenData = await this.makeRequest<MagentoTokenResponse>(
      "POST",
      `${this.baseUrl}/rest/V1/integration/admin/token`,
      {
        body: {
          username: this.config.apiKey,
          password: this.config.apiSecret,
        },
        context: "Magento OAuth2 token refresh",
      },
    );

    this.accessToken = tokenData.token;
    // Set expiration to 1 hour from now
    this.tokenExpiresAt = Date.now() + 3600000;

    return tokenData.token;
  }

  /**
   * Make authenticated request to Magento API
   */
  private async magentoRequest<T>(
    method: string,
    endpoint: string,
    options: {
      body?: Record<string, unknown>;
      context?: string;
    } = {},
  ): Promise<T> {
    const token = await this.getAccessToken();

    return this.makeRequest<T>(
      method,
      `${this.baseUrl}/rest/V1${endpoint}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        ...options,
      },
    );
  }

  /**
   * Get orders from Magento
   */
  async getOrders(options?: SyncOptions): Promise<ECommerceOrder[]> {
    try {
      const params = new URLSearchParams();

      if (options?.since) {
        params.append("searchCriteria[filter_groups][0][filters][0][field]", "updated_at");
        params.append("searchCriteria[filter_groups][0][filters][0][value]", options.since.toISOString());
        params.append("searchCriteria[filter_groups][0][filters][0][condition_type]", "gteq");
      }

      if (options?.limit) {
        params.append("searchCriteria[page_size]", options.limit.toString());
      } else {
        params.append("searchCriteria[page_size]", "100");
      }

      const response = await this.magentoRequest<{
        items: MagentoOrderData[];
        total_count: number;
      }>(
        "GET",
        `/orders?${params.toString()}`,
        { context: "Fetch Magento orders" },
      );

      return response.items.map((order) => this.normalizeMagentoOrder(order));
    } catch (error) {
      console.error("Failed to fetch Magento orders:", error);
      throw error;
    }
  }

  /**
   * Get single order by ID
   */
  async getOrderById(orderId: string): Promise<ECommerceOrder> {
    const order = await this.magentoRequest<MagentoOrderData>(
      "GET",
      `/orders/${orderId}`,
      { context: `Fetch Magento order ${orderId}` },
    );

    return this.normalizeMagentoOrder(order);
  }

  /**
   * Update order
   */
  async updateOrder(orderId: string, data: Partial<ECommerceOrder>): Promise<ECommerceOrder> {
    const updateData: Record<string, unknown> = {};

    if (data.notes) {
      updateData.extension_attributes = {
        customer_note: data.notes,
      };
    }

    const updated = await this.magentoRequest<MagentoOrderData>(
      "POST",
      `/orders/${orderId}`,
      {
        body: updateData,
        context: `Update Magento order ${orderId}`,
      },
    );

    return this.normalizeMagentoOrder(updated);
  }

  /**
   * Get products from Magento
   */
  async getProducts(options?: SyncOptions): Promise<ECommerceProduct[]> {
    try {
      const params = new URLSearchParams();

      if (options?.limit) {
        params.append("searchCriteria[page_size]", options.limit.toString());
      } else {
        params.append("searchCriteria[page_size]", "100");
      }

      if (options?.since) {
        params.append("searchCriteria[filter_groups][0][filters][0][field]", "updated_at");
        params.append("searchCriteria[filter_groups][0][filters][0][value]", options.since.toISOString());
        params.append("searchCriteria[filter_groups][0][filters][0][condition_type]", "gteq");
      }

      params.append("fields", "items[id,sku,name,description,type_id,status,price,extension_attributes]");

      const response = await this.magentoRequest<{
        items: MagentoProduct[];
        total_count: number;
      }>(
        "GET",
        `/products?${params.toString()}`,
        { context: "Fetch Magento products" },
      );

      return response.items.map((product) => this.normalizeMagentoProduct(product));
    } catch (error) {
      console.error("Failed to fetch Magento products:", error);
      throw error;
    }
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<ECommerceProduct> {
    const product = await this.magentoRequest<MagentoProduct>(
      "GET",
      `/products/${productId}`,
      { context: `Fetch Magento product ${productId}` },
    );

    return this.normalizeMagentoProduct(product);
  }

  /**
   * Create product
   */
  async createProduct(product: ECommerceProduct): Promise<ECommerceProduct> {
    const variant = product.variants[0];

    const created = await this.magentoRequest<MagentoProduct>(
      "POST",
      "/products",
      {
        body: {
          product: {
            name: product.title,
            sku: variant.sku,
            status: product.status === "active" ? 1 : 2,
            type_id: "simple",
            price: variant.price,
            description: product.description,
            extension_attributes: {
              stock_item: {
                qty: variant.inventory.quantity,
                is_in_stock: variant.inventory.quantity > 0,
              },
            },
          },
        },
        context: "Create Magento product",
      },
    );

    return this.normalizeMagentoProduct(created);
  }

  /**
   * Update product
   */
  async updateProduct(productId: string, data: Partial<ECommerceProduct>): Promise<ECommerceProduct> {
    const variant = data.variants?.[0];

    const updateData: Record<string, unknown> = {
      product: {
        name: data.title,
        description: data.description,
        status: data.status === "active" ? 1 : 2,
      },
    };

    if (variant) {
      (updateData.product as any).price = variant.price;
      (updateData.product as any).extension_attributes = {
        stock_item: {
          qty: variant.inventory.quantity,
          is_in_stock: variant.inventory.quantity > 0,
        },
      };
    }

    const updated = await this.magentoRequest<MagentoProduct>(
      "PUT",
      `/products/${productId}`,
      {
        body: updateData,
        context: `Update Magento product ${productId}`,
      },
    );

    return this.normalizeMagentoProduct(updated);
  }

  /**
   * Get customers
   */
  async getCustomers(options?: SyncOptions): Promise<ECommerceCustomer[]> {
    try {
      const params = new URLSearchParams();

      if (options?.limit) {
        params.append("searchCriteria[page_size]", options.limit.toString());
      } else {
        params.append("searchCriteria[page_size]", "100");
      }

      const response = await this.magentoRequest<{
        items: MagentoCustomer[];
        total_count: number;
      }>(
        "GET",
        `/customers/search?${params.toString()}`,
        { context: "Fetch Magento customers" },
      );

      return response.items.map((customer) => ({
        id: customer.entity_id.toString(),
        email: customer.email,
        firstName: customer.firstname,
        lastName: customer.lastname,
        acceptsMarketing: true,
        createdAt: new Date(customer.created_at),
        updatedAt: new Date(customer.updated_at),
      }));
    } catch (error) {
      console.error("Failed to fetch Magento customers:", error);
      throw error;
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<ECommerceCustomer> {
    const customer = await this.magentoRequest<MagentoCustomer>(
      "GET",
      `/customers/${customerId}`,
      { context: `Fetch Magento customer ${customerId}` },
    );

    return {
      id: customer.entity_id.toString(),
      email: customer.email,
      firstName: customer.firstname,
      lastName: customer.lastname,
      acceptsMarketing: true,
      createdAt: new Date(customer.created_at),
      updatedAt: new Date(customer.updated_at),
    };
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    data: Partial<ECommerceCustomer>,
  ): Promise<ECommerceCustomer> {
    const updated = await this.magentoRequest<MagentoCustomer>(
      "PUT",
      `/customers/${customerId}`,
      {
        body: {
          customer: {
            firstname: data.firstName,
            lastname: data.lastName,
            email: data.email,
          },
        },
        context: `Update Magento customer ${customerId}`,
      },
    );

    return {
      id: updated.entity_id.toString(),
      email: updated.email,
      firstName: updated.firstname,
      lastName: updated.lastname,
      acceptsMarketing: true,
      createdAt: new Date(updated.created_at),
      updatedAt: new Date(updated.updated_at),
    };
  }

  /**
   * Create fulfillment (shipment)
   */
  async createFulfillment(orderId: string, request: FulfillmentRequest): Promise<FulfillmentResponse> {
    const shipmentData: Record<string, unknown> = {
      entity: {
        items: request.items.map((item) => ({
          order_item_id: item.lineItemId,
          qty: item.quantity,
        })),
      },
    };

    if (request.trackingNumber) {
      (shipmentData.entity as any).tracks = [
        {
          track_number: request.trackingNumber,
          title: request.trackingCompany || "Carrier",
          carrier_code: request.trackingCompany?.toLowerCase() || "custom",
        },
      ];
    }

    const shipment = await this.magentoRequest<MagentoShipment>(
      "POST",
      `/orders/${orderId}/shipments`,
      {
        body: shipmentData,
        context: `Create Magento shipment for order ${orderId}`,
      },
    );

    return {
      id: shipment.entity_id.toString(),
      orderId: shipment.order_id.toString(),
      status: "complete",
      items: request.items,
      trackingInfo: request.trackingNumber
        ? {
            company: request.trackingCompany || "Carrier",
            number: request.trackingNumber,
          }
        : undefined,
      createdAt: new Date(shipment.created_at),
      updatedAt: new Date(shipment.updated_at),
    };
  }

  /**
   * Update fulfillment
   */
  async updateFulfillment(
    orderId: string,
    fulfillmentId: string,
    data: Partial<FulfillmentResponse>,
  ): Promise<FulfillmentResponse> {
    // Magento doesn't support updating shipments directly
    // Return the current data as-is
    const shipment = await this.magentoRequest<MagentoShipment>(
      "GET",
      `/orders/${orderId}/shipments/${fulfillmentId}`,
      { context: `Fetch Magento shipment ${fulfillmentId}` },
    );

    return {
      id: shipment.entity_id.toString(),
      orderId: shipment.order_id.toString(),
      status: "complete",
      items: shipment.items.map((item) => ({
        lineItemId: item.item_id.toString(),
        quantity: item.qty,
      })),
      trackingInfo:
        shipment.tracks.length > 0
          ? {
              company: shipment.tracks[0].title,
              number: shipment.tracks[0].number,
            }
          : undefined,
      createdAt: new Date(shipment.created_at),
      updatedAt: new Date(shipment.updated_at),
    };
  }

  /**
   * Update inventory
   */
  async updateInventory(request: InventoryUpdateRequest): Promise<ECommerceInventory> {
    // In Magento, inventory is managed via stock items
    const sku = request.variantId;

    const updated = await this.magentoRequest<{
      extension_attributes: {
        stock_item: {
          item_id: number;
          qty: number;
        };
      };
    }>(
      "PUT",
      `/products/${sku}/stockItems/1`,
      {
        body: {
          stockItem: {
            qty: request.quantity,
            is_in_stock: request.quantity > 0,
          },
        },
        context: `Update Magento inventory for ${sku}`,
      },
    );

    return {
      variantId: sku,
      quantity: updated.extension_attributes.stock_item.qty,
      trackQuantity: true,
      allowNegativeStock: false,
      updatedAt: new Date(),
    };
  }

  /**
   * Get inventory
   */
  async getInventory(variantId: string): Promise<ECommerceInventory> {
    const product = await this.magentoRequest<MagentoProduct>(
      "GET",
      `/products/${variantId}`,
      { context: `Fetch inventory for ${variantId}` },
    );

    const qty = product.extension_attributes?.stock_item?.qty || 0;

    return {
      variantId,
      quantity: qty,
      trackQuantity: true,
      allowNegativeStock: false,
      updatedAt: new Date(),
    };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: unknown, signature: string): boolean {
    if (!this.config.webhookSecret) return false;

    const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
    return this.verifySignature(payloadString, signature, this.config.webhookSecret);
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: unknown): ECommerceWebhookEvent {
    const raw = payload as Record<string, unknown>;

    return {
      id: typeof raw["event_id"] === "string" ? raw["event_id"] : crypto.randomUUID(),
      platform: "magento",
      topic: typeof raw["topic"] === "string" ? raw["topic"] : "",
      event: typeof raw["resource"] === "string" ? raw["resource"] : "",
      createdAt: typeof raw["created_at"] === "string" || typeof raw["created_at"] === "number"
        ? new Date(raw["created_at"] as string)
        : new Date(),
      data: raw as unknown as ECommerceWebhookEvent["data"],
    };
  }

  /**
   * Validate connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      return !!token;
    } catch {
      return false;
    }
  }

  /**
   * Normalize Magento order to internal format
   */
  private normalizeMagentoOrder(order: MagentoOrderData): ECommerceOrder {
    const parseAddress = (addr: MagentoAddress): any => ({
      firstName: addr.firstname,
      lastName: addr.lastname,
      company: addr.company,
      address1: Array.isArray(addr.street) ? addr.street[0] : addr.street,
      address2: Array.isArray(addr.street) ? addr.street[1] : undefined,
      city: addr.city,
      state: addr.region,
      postalCode: addr.postcode,
      country: addr.country_id,
      email: addr.email,
      phone: addr.telephone,
    });

    return {
      id: order.entity_id.toString(),
      externalId: order.increment_id,
      status: this.mapMagentoOrderStatus(order.status),
      paymentStatus: "captured",
      fulfillmentStatus: "pending",
      currency: "USD",
      totalAmount: order.grand_total,
      subtotalAmount: order.subtotal,
      taxAmount: order.tax_amount,
      shippingAmount: order.shipping_amount,
      discountAmount: order.discount_amount,
      customer: {
        id: order.customer.entity_id.toString(),
        email: order.customer.email,
        firstName: order.customer.firstname,
        lastName: order.customer.lastname,
        acceptsMarketing: true,
        createdAt: new Date(order.customer.created_at),
        updatedAt: new Date(order.customer.updated_at),
      },
      billingAddress: parseAddress(order.billing_address),
      shippingAddress: parseAddress(order.shipping_address),
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
      paymentMethod: order.payment.method,
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
    };
  }

  /**
   * Normalize Magento product to internal format
   */
  private normalizeMagentoProduct(product: MagentoProduct): ECommerceProduct {
    const qty = product.extension_attributes?.stock_item?.qty || 0;
    const status: ECommerceProduct["status"] = product.status === 1 ? "active" : "archived";

    return {
      id: product.id.toString(),
      title: product.name,
      description: product.description,
      status,
      variants: [
        {
          id: product.id.toString(),
          sku: product.sku,
          price: product.price,
          costAmount: product.cost,
          inventory: {
            variantId: product.id.toString(),
            quantity: qty,
            trackQuantity: product.extension_attributes?.stock_item?.manage_stock ?? true,
            allowNegativeStock: (product.extension_attributes?.stock_item?.backorders ?? 0) > 0,
            updatedAt: new Date(),
          },
        },
      ],
      createdAt: new Date(product.created_at),
      updatedAt: new Date(product.updated_at),
    };
  }

  /**
   * Map Magento order status to internal status
   */
  private mapMagentoOrderStatus(status: string): ECommerceOrder["status"] {
    const mapping: Record<string, ECommerceOrder["status"]> = {
      pending: "pending",
      processing: "processing",
      complete: "delivered",
      closed: "delivered",
      canceled: "cancelled",
      holded: "pending",
      payment_review: "pending",
    };

    return mapping[status] ?? "pending";
  }
}

/**
 * Factory function to create Magento client
 */
export function createMagentoClient(config: ECommerceAdapterConfig): MagentoClient {
  return new MagentoClient(config);
}
