/**
 * BigCommerce V3 API Client Adapter
 * Handles OAuth2 token management, API requests, and data normalization
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
} from "./types.js";
import { ECommerceAdapterBase } from "./ecommerce-adapter.js";

/**
 * BigCommerce API Response Types
 */
interface BigCommerceOrderData {
  id: number;
  order_number: number;
  status: string;
  payment_status: string;
  order_total: number;
  subtotal_excluding_tax: number;
  tax_total: number;
  shipping_cost_excluding_tax: number;
  discount_amount: number;
  payment_method: string;
  customer_id: number;
  billing_address: BigCommerceAddress;
  shipping_addresses: BigCommerceAddress[];
  products: {
    url: string;
    resource: string;
  };
  date_created: string;
  date_modified: string;
}

interface BigCommerceAddress {
  first_name: string;
  last_name: string;
  company?: string;
  street_1: string;
  street_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  email?: string;
  phone?: string;
}

interface BigCommerceProductData {
  id: number;
  name: string;
  type: string;
  sku: string;
  description: string;
  weight: number;
  price: number;
  cost_price?: number;
  retail_price?: number;
  sale_price?: number;
  status: "active" | "disabled" | "archived";
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  image_url?: string;
  variants: {
    url: string;
    resource: string;
  };
  inventory_level?: number;
  inventory_tracking?: "simple" | "variant" | "none";
}

interface BigCommerceVariantData {
  id: number;
  product_id: number;
  sku: string;
  title?: string;
  price: number;
  cost_price?: number;
  retail_price?: number;
  sale_price?: number;
  weight?: number;
  width?: number;
  depth?: number;
  height?: number;
  image_url?: string;
  created_at: string;
  updated_at: string;
  inventory_level?: number;
  option_values?: Array<{
    option_id: number;
    option_name: string;
    label: string;
  }>;
}

interface BigCommerceCustomerData {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  date_created: string;
  date_modified: string;
  accepts_marketing?: boolean;
}

interface BigCommerceShipmentData {
  id: number;
  order_id: number;
  items: Array<{
    order_product_id: number;
    quantity: number;
  }>;
  tracking_number?: string;
  carrier?: string;
  date_created: string;
  date_updated?: string;
}

/**
 * BigCommerce Client
 */
export class BigCommerceClient
  extends ECommerceAdapterBase
  implements IECommerceAdapter
{
  private baseUrl: string;
  private storeHash: string;
  private accessToken: string;

  constructor(config: ECommerceAdapterConfig) {
    super(config);

    if (!config.storeUrl || !config.accessToken) {
      throw new Error("BigCommerce store URL and access token are required");
    }

    // Extract store hash from URL if present
    const match = config.storeUrl.match(/stores\/([\w]+)/);
    this.storeHash = match ? match[1] : config.storeUrl;
    this.baseUrl = `https://api.bigcommerce.com/stores/${this.storeHash}/v3`;
    this.accessToken = config.accessToken;
  }

  /**
   * Make authenticated request to BigCommerce API
   */
  private async bigcommerceRequest<T>(
    method: string,
    endpoint: string,
    options: {
      body?: Record<string, unknown>;
      context?: string;
      query?: Record<string, string>;
    } = {},
  ): Promise<T> {
    let url = `${this.baseUrl}${endpoint}`;

    if (options.query) {
      const params = new URLSearchParams(options.query);
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      "X-Auth-Token": this.accessToken,
      Accept: "application/json",
    };

    return this.makeRequest<T>(method, url, {
      headers,
      body: options.body,
      context: options.context,
    });
  }

  /**
   * Get orders from BigCommerce
   */
  async getOrders(options?: SyncOptions): Promise<ECommerceOrder[]> {
    try {
      const query: Record<string, string> = {
        limit: (options?.limit || 100).toString(),
        include: "products",
      };

      if (options?.since) {
        query.sort = "date_modified:desc";
        // BigCommerce uses date range filters via min_date_modified
        query["min_date_modified"] = options.since.toISOString();
      }

      const response = await this.bigcommerceRequest<{
        data: BigCommerceOrderData[];
        meta: {
          pagination: {
            total: number;
            count: number;
          };
        };
      }>("GET", "/orders", {
        query,
        context: "Fetch BigCommerce orders",
      });

      const orders: ECommerceOrder[] = [];

      for (const order of response.data) {
        // Fetch shipping addresses
        const addressesResponse = await this.bigcommerceRequest<{
          data: BigCommerceAddress[];
        }>("GET", `/orders/${order.id}/shipping_addresses`);

        const shippingAddress =
          addressesResponse.data[0] || order.billing_address;

        orders.push(this.normalizeBigCommerceOrder(order, shippingAddress));
      }

      return orders;
    } catch (error) {
      console.error("Failed to fetch BigCommerce orders:", error);
      throw error;
    }
  }

  /**
   * Get single order by ID
   */
  async getOrderById(orderId: string): Promise<ECommerceOrder> {
    const order = await this.bigcommerceRequest<{
      data: BigCommerceOrderData;
    }>("GET", `/orders/${orderId}`, {
      context: `Fetch BigCommerce order ${orderId}`,
    });

    // Fetch shipping address
    const addressesResponse = await this.bigcommerceRequest<{
      data: BigCommerceAddress[];
    }>("GET", `/orders/${orderId}/shipping_addresses`);

    const shippingAddress =
      addressesResponse.data[0] || order.data.billing_address;

    return this.normalizeBigCommerceOrder(order.data, shippingAddress);
  }

  /**
   * Update order
   */
  async updateOrder(
    orderId: string,
    data: Partial<ECommerceOrder>,
  ): Promise<ECommerceOrder> {
    const updateData: Record<string, unknown> = {};

    if (data.notes) {
      updateData.comments = [
        {
          text: data.notes,
          status_id: 0,
        },
      ];
    }

    const response = await this.bigcommerceRequest<{
      data: BigCommerceOrderData;
    }>("POST", `/orders/${orderId}`, {
      body: updateData,
      context: `Update BigCommerce order ${orderId}`,
    });

    // Fetch shipping address
    const addressesResponse = await this.bigcommerceRequest<{
      data: BigCommerceAddress[];
    }>("GET", `/orders/${orderId}/shipping_addresses`);

    const shippingAddress =
      addressesResponse.data[0] || response.data.billing_address;

    return this.normalizeBigCommerceOrder(response.data, shippingAddress);
  }

  /**
   * Get products from BigCommerce
   */
  async getProducts(options?: SyncOptions): Promise<ECommerceProduct[]> {
    try {
      const query: Record<string, string> = {
        limit: (options?.limit || 100).toString(),
        include_fields:
          "id,name,type,sku,description,weight,price,cost_price,status,is_visible,image_url,created_at,updated_at",
      };

      if (options?.since) {
        query["date_modified:min"] = options.since.toISOString();
      }

      const response = await this.bigcommerceRequest<{
        data: BigCommerceProductData[];
        meta: {
          pagination: {
            total: number;
          };
        };
      }>("GET", "/catalog/products", {
        query,
        context: "Fetch BigCommerce products",
      });

      const products: ECommerceProduct[] = [];

      for (const product of response.data) {
        // Fetch variants for each product
        const variantsResponse = await this.bigcommerceRequest<{
          data: BigCommerceVariantData[];
        }>("GET", `/catalog/products/${product.id}/variants`, {
          query: { limit: "250" },
        });

        products.push(
          this.normalizeBigCommerceProduct(product, variantsResponse.data),
        );
      }

      return products;
    } catch (error) {
      console.error("Failed to fetch BigCommerce products:", error);
      throw error;
    }
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<ECommerceProduct> {
    const product = await this.bigcommerceRequest<{
      data: BigCommerceProductData;
    }>("GET", `/catalog/products/${productId}`, {
      context: `Fetch BigCommerce product ${productId}`,
    });

    // Fetch variants
    const variantsResponse = await this.bigcommerceRequest<{
      data: BigCommerceVariantData[];
    }>("GET", `/catalog/products/${productId}/variants`, {
      query: { limit: "250" },
    });

    return this.normalizeBigCommerceProduct(
      product.data,
      variantsResponse.data,
    );
  }

  /**
   * Create product
   */
  async createProduct(product: ECommerceProduct): Promise<ECommerceProduct> {
    const variant = product.variants[0];

    const response = await this.bigcommerceRequest<{
      data: BigCommerceProductData;
    }>("POST", "/catalog/products", {
      body: {
        name: product.title,
        type: "physical",
        description: product.description,
        status: product.status === "active" ? "active" : "disabled",
        variants: [
          {
            sku: variant.sku,
            price: variant.price,
            cost_price: variant.costAmount,
            inventory_level: variant.inventory.quantity,
          },
        ],
      },
      context: "Create BigCommerce product",
    });

    // Fetch variants
    const variantsResponse = await this.bigcommerceRequest<{
      data: BigCommerceVariantData[];
    }>("GET", `/catalog/products/${response.data.id}/variants`, {
      query: { limit: "250" },
    });

    return this.normalizeBigCommerceProduct(
      response.data,
      variantsResponse.data,
    );
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    data: Partial<ECommerceProduct>,
  ): Promise<ECommerceProduct> {
    const variant = data.variants?.[0];

    const updateData: Record<string, unknown> = {
      name: data.title,
      description: data.description,
      status: data.status === "active" ? "active" : "disabled",
    };

    if (variant) {
      updateData.price = variant.price;
      updateData.cost_price = variant.costAmount;
    }

    const response = await this.bigcommerceRequest<{
      data: BigCommerceProductData;
    }>("PUT", `/catalog/products/${productId}`, {
      body: updateData,
      context: `Update BigCommerce product ${productId}`,
    });

    // Fetch variants
    const variantsResponse = await this.bigcommerceRequest<{
      data: BigCommerceVariantData[];
    }>("GET", `/catalog/products/${productId}/variants`, {
      query: { limit: "250" },
    });

    return this.normalizeBigCommerceProduct(
      response.data,
      variantsResponse.data,
    );
  }

  /**
   * Get customers
   */
  async getCustomers(options?: SyncOptions): Promise<ECommerceCustomer[]> {
    try {
      const query: Record<string, string> = {
        limit: (options?.limit || 100).toString(),
      };

      const response = await this.bigcommerceRequest<{
        data: BigCommerceCustomerData[];
        meta: {
          pagination: {
            total: number;
          };
        };
      }>("GET", "/customers", {
        query,
        context: "Fetch BigCommerce customers",
      });

      return response.data.map((customer) => ({
        id: customer.id.toString(),
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
        acceptsMarketing: customer.accepts_marketing ?? false,
        createdAt: new Date(customer.date_created),
        updatedAt: new Date(customer.date_modified),
      }));
    } catch (error) {
      console.error("Failed to fetch BigCommerce customers:", error);
      throw error;
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<ECommerceCustomer> {
    const response = await this.bigcommerceRequest<{
      data: BigCommerceCustomerData;
    }>("GET", `/customers/${customerId}`, {
      context: `Fetch BigCommerce customer ${customerId}`,
    });

    return {
      id: response.data.id.toString(),
      email: response.data.email,
      firstName: response.data.first_name,
      lastName: response.data.last_name,
      phone: response.data.phone,
      acceptsMarketing: response.data.accepts_marketing ?? false,
      createdAt: new Date(response.data.date_created),
      updatedAt: new Date(response.data.date_modified),
    };
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    data: Partial<ECommerceCustomer>,
  ): Promise<ECommerceCustomer> {
    const response = await this.bigcommerceRequest<{
      data: BigCommerceCustomerData;
    }>("PUT", `/customers/${customerId}`, {
      body: {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        accepts_marketing: data.acceptsMarketing,
      },
      context: `Update BigCommerce customer ${customerId}`,
    });

    return {
      id: response.data.id.toString(),
      email: response.data.email,
      firstName: response.data.first_name,
      lastName: response.data.last_name,
      phone: response.data.phone,
      acceptsMarketing: response.data.accepts_marketing ?? false,
      createdAt: new Date(response.data.date_created),
      updatedAt: new Date(response.data.date_modified),
    };
  }

  /**
   * Create fulfillment (shipment)
   */
  async createFulfillment(
    orderId: string,
    request: FulfillmentRequest,
  ): Promise<FulfillmentResponse> {
    const response = await this.bigcommerceRequest<{
      data: BigCommerceShipmentData;
    }>("POST", `/orders/${orderId}/shipments`, {
      body: {
        line_items: request.items,
        tracking_number: request.trackingNumber,
        carrier: request.trackingCompany,
        notify_customer: request.notifyCustomer !== false,
      },
      context: `Create BigCommerce shipment for order ${orderId}`,
    });

    return {
      id: response.data.id.toString(),
      orderId: response.data.order_id.toString(),
      status: "complete",
      items: request.items,
      trackingInfo: request.trackingNumber
        ? {
            company: request.trackingCompany || "Carrier",
            number: request.trackingNumber,
          }
        : undefined,
      createdAt: new Date(response.data.date_created),
      updatedAt: new Date(
        response.data.date_updated || response.data.date_created,
      ),
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
    // BigCommerce doesn't support direct shipment updates
    // Fetch and return current data
    const response = await this.bigcommerceRequest<{
      data: BigCommerceShipmentData;
    }>("GET", `/orders/${orderId}/shipments/${fulfillmentId}`, {
      context: `Fetch BigCommerce shipment ${fulfillmentId}`,
    });

    return {
      id: response.data.id.toString(),
      orderId: response.data.order_id.toString(),
      status: "complete",
      items: response.data.items.map((item) => ({
        lineItemId: item.order_product_id.toString(),
        quantity: item.quantity,
      })),
      trackingInfo: response.data.tracking_number
        ? {
            company: response.data.carrier || "Carrier",
            number: response.data.tracking_number,
          }
        : undefined,
      createdAt: new Date(response.data.date_created),
      updatedAt: new Date(
        response.data.date_updated || response.data.date_created,
      ),
    };
  }

  /**
   * Update inventory
   */
  async updateInventory(
    request: InventoryUpdateRequest,
  ): Promise<ECommerceInventory> {
    const response = await this.bigcommerceRequest<{
      data: BigCommerceVariantData;
    }>("PUT", `/catalog/variants/${request.variantId}`, {
      body: {
        inventory_level: request.quantity,
      },
      context: `Update BigCommerce inventory for ${request.variantId}`,
    });

    return {
      variantId: request.variantId,
      quantity: response.data.inventory_level || 0,
      trackQuantity: true,
      allowNegativeStock: false,
      updatedAt: new Date(response.data.updated_at),
    };
  }

  /**
   * Get inventory
   */
  async getInventory(variantId: string): Promise<ECommerceInventory> {
    const response = await this.bigcommerceRequest<{
      data: BigCommerceVariantData;
    }>("GET", `/catalog/variants/${variantId}`, {
      context: `Fetch inventory for ${variantId}`,
    });

    return {
      variantId,
      quantity: response.data.inventory_level || 0,
      trackQuantity: true,
      allowNegativeStock: false,
      updatedAt: new Date(response.data.updated_at),
    };
  }

  /**
   * Verify webhook signature (HMAC-SHA256)
   */
  verifyWebhookSignature(payload: unknown, signature: string): boolean {
    if (!this.config.webhookSecret) return false;

    const payloadString =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    const expectedSignature = createHmac("sha256", this.config.webhookSecret)
      .update(payloadString)
      .digest("base64");

    return expectedSignature === signature;
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: unknown): ECommerceWebhookEvent {
    const raw = payload as Record<string, unknown>;

    return {
      id:
        (typeof raw["id"] === "string" ? raw["id"] : undefined) ??
        crypto.randomUUID(),
      platform: "bigcommerce",
      topic: typeof raw["scope"] === "string" ? raw["scope"] : "",
      event: typeof raw["type"] === "string" ? raw["type"] : "",
      createdAt:
        typeof raw["created_at"] === "string" ||
        typeof raw["created_at"] === "number"
          ? new Date(raw["created_at"] as string)
          : new Date(),
      data: raw["data"] as ECommerceWebhookEvent["data"],
      signature:
        typeof raw["signature"] === "string" ? raw["signature"] : undefined,
    };
  }

  /**
   * Validate connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.bigcommerceRequest<Record<string, unknown>>("GET", "/store");
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
      const response = await this.bigcommerceRequest<Record<string, unknown>>(
        "GET",
        "/store",
      );
      return !!response;
    } catch {
      return false;
    }
  }

  /**
   * Normalize BigCommerce order to internal format
   */
  private normalizeBigCommerceOrder(
    order: BigCommerceOrderData,
    shippingAddress: BigCommerceAddress,
  ): ECommerceOrder {
    const parseAddress = (
      addr: BigCommerceAddress,
    ): ECommerceOrder["billingAddress"] => ({
      firstName: addr.first_name,
      lastName: addr.last_name,
      company: addr.company,
      address1: addr.street_1,
      address2: addr.street_2,
      city: addr.city,
      state: addr.state,
      postalCode: addr.postal_code,
      country: addr.country_code,
      email: addr.email,
      phone: addr.phone,
    });

    return {
      id: order.id.toString(),
      externalId: order.order_number.toString(),
      status: this.mapBigCommerceOrderStatus(order.status),
      paymentStatus: this.mapBigCommercePaymentStatus(order.payment_status),
      fulfillmentStatus: "pending",
      currency: "USD",
      totalAmount: order.order_total,
      subtotalAmount: order.subtotal_excluding_tax,
      taxAmount: order.tax_total,
      shippingAmount: order.shipping_cost_excluding_tax,
      discountAmount: order.discount_amount,
      customer: {
        id: order.customer_id.toString(),
        email: "", // Not provided in order object
        firstName: "",
        lastName: "",
        acceptsMarketing: false,
        createdAt: new Date(order.date_created),
        updatedAt: new Date(order.date_modified),
      },
      billingAddress: parseAddress(order.billing_address),
      shippingAddress: parseAddress(shippingAddress),
      lineItems: [], // Need to fetch separately
      paymentMethod: order.payment_method,
      createdAt: new Date(order.date_created),
      updatedAt: new Date(order.date_modified),
    };
  }

  /**
   * Normalize BigCommerce product to internal format
   * Maps BigCommerce "disabled" status to "draft" to match the ECommerceProduct union.
   */
  private normalizeBigCommerceProduct(
    product: BigCommerceProductData,
    variants: BigCommerceVariantData[],
  ): ECommerceProduct {
    const status: ECommerceProduct["status"] =
      product.status === "active"
        ? "active"
        : product.status === "archived"
          ? "archived"
          : "draft";

    return {
      id: product.id.toString(),
      title: product.name,
      description: product.description,
      status,
      productType: product.type,
      variants: variants.map((variant) => ({
        id: variant.id.toString(),
        sku: variant.sku,
        title: variant.title,
        price: variant.price,
        compareAtPrice: variant.retail_price,
        costAmount: variant.cost_price,
        weight: variant.weight,
        dimensions:
          variant.width && variant.depth && variant.height
            ? {
                length: variant.depth,
                width: variant.width,
                height: variant.height,
                unit: "cm" as const,
              }
            : undefined,
        inventory: {
          variantId: variant.id.toString(),
          quantity: variant.inventory_level || 0,
          trackQuantity: true,
          allowNegativeStock: false,
          updatedAt: new Date(variant.updated_at),
        },
        image: variant.image_url ? { url: variant.image_url } : undefined,
      })),
      images: product.image_url ? [{ url: product.image_url }] : undefined,
      createdAt: new Date(product.created_at),
      updatedAt: new Date(product.updated_at),
    };
  }

  /**
   * Map BigCommerce order status to internal status
   */
  private mapBigCommerceOrderStatus(status: string): ECommerceOrder["status"] {
    const mapping: Record<string, ECommerceOrder["status"]> = {
      "0": "pending", // Pending
      "1": "dispatched", // Dispatched
      "2": "delivered", // Shipped
      "3": "cancelled", // Cancelled
      "4": "refunded", // Refunded
      "5": "processing", // Partially Shipped
      "6": "pending", // Pending Review
      "7": "confirmed", // Manually Reviewed
      "8": "processing", // Awaiting Shipment
      "9": "processing", // Awaiting Pickup
      "10": "delivered", // Complete
    };

    return mapping[status] ?? "pending";
  }

  /**
   * Map BigCommerce payment status to internal status
   */
  private mapBigCommercePaymentStatus(
    status: string,
  ): ECommerceOrder["paymentStatus"] {
    const mapping: Record<string, ECommerceOrder["paymentStatus"]> = {
      "0": "pending",
      "1": "authorized",
      "2": "captured",
      "3": "refunded",
    };

    return mapping[status] ?? "pending";
  }
}

/**
 * Factory function to create BigCommerce client
 */
export function createBigCommerceClient(
  config: ECommerceAdapterConfig,
): BigCommerceClient {
  return new BigCommerceClient(config);
}
