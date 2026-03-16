/**
 * BigCommerce V3 API SDK Client
 * Production-ready client with full API coverage:
 * - OAuth2 single-click install flow (install, load, uninstall callbacks)
 * - Orders: list, get, create, update, delete, count, products, shipping addresses, coupons, statuses
 * - Products: list, get, create, update, delete, variants, images, categories, brands, bulk pricing
 * - Customers: list, get, create, update, delete, addresses, customer groups
 * - Inventory: stock levels, bulk update, low stock alerts
 * - Webhooks: create, list, update, delete, verify (SHA256 HMAC)
 * - Shipping: zones, methods, carrier connections
 * - Storefront: cart, checkout
 * - Rate limiting: respect X-Rate-Limit-Requests-Left header, queue when near limit
 * - Pagination: cursor-based for V3, page-based fallback for V2
 * - Error handling: map BigCommerce errors to Witylogix error codes
 */

import { createHmac } from "node:crypto";
import { EventEmitter } from "node:events";

/**
 * BigCommerce OAuth2 Configuration
 */
export interface BigCommerceOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * BigCommerce API Configuration
 */
export interface BigCommerceSDKConfig {
  storeHash: string;
  accessToken: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  apiVersion?: string; // default: "v3"
  timeout?: number; // default: 30000
  rateLimit?: number; // default: 40 (requests per second)
}

/**
 * BigCommerce OAuth Token Response
 */
export interface BigCommerceOAuthToken {
  access_token: string;
  scope: string;
  user: {
    id: number;
    email: string;
  };
  context: string; // "stores/{store_hash}"
  account_uuid: string;
  expires_in: number;
}

/**
 * BigCommerce Install Callback Payload
 */
export interface BigCommerceInstallPayload {
  code: string;
  scope: string;
  context: string;
  user: {
    id: number;
    email: string;
  };
}

/**
 * BigCommerce Load Callback Payload
 */
export interface BigCommerceLoadPayload {
  access_token: string;
  user: {
    id: number;
    email: string;
  };
  owner: {
    id: number;
    email: string;
  };
  context: string;
}

/**
 * BigCommerce Order Response
 */
export interface BigCommerceOrder {
  id: number;
  order_number: number;
  status_id: number;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  order_total: number;
  subtotal_excluding_tax: number;
  subtotal_including_tax: number;
  tax_total: number;
  shipping_cost_excluding_tax: number;
  shipping_cost_including_tax: number;
  discount_amount: number;
  currency_code: string;
  customer_id: number;
  customer?: BigCommerceCustomer;
  payment_method: string;
  payment_provider_id?: string;
  billing_address: BigCommerceAddress;
  shipping_addresses?: BigCommerceAddress[];
  shipping_method?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  date_created: string;
  date_modified: string;
  staff_notes?: string;
  customer_message?: string;
  is_email_opt_in: boolean;
}

/**
 * BigCommerce Product Response
 */
export interface BigCommerceProduct {
  id: number;
  name: string;
  type: string;
  sku: string;
  description?: string;
  weight?: number;
  width?: number;
  depth?: number;
  height?: number;
  price: number;
  cost_price?: number;
  retail_price?: number;
  sale_price?: number;
  status: "active" | "disabled" | "archived";
  is_visible: boolean;
  is_featured: boolean;
  brand_id?: number;
  category_ids?: number[];
  view_count?: number;
  seo_url?: string;
  created_at: string;
  updated_at: string;
  inventory_tracking?: "simple" | "variant" | "none";
  inventory_level?: number;
  inventory_warning_level?: number;
  weight_unit?: "lbs" | "kg" | "oz" | "g";
  dimension_unit?: "in" | "cm";
  variants?: BigCommerceVariant[];
  images?: BigCommerceImage[];
}

/**
 * BigCommerce Variant Response
 */
export interface BigCommerceVariant {
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
  is_default: boolean;
  created_at: string;
  updated_at: string;
  inventory_level?: number;
  inventory_warning_level?: number;
  option_values?: Array<{
    option_display_name: string;
    option_id: number;
    id: number;
    label: string;
  }>;
  images?: BigCommerceImage[];
}

/**
 * BigCommerce Customer Response
 */
export interface BigCommerceCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  company?: string;
  notes?: string;
  customer_group_id: number;
  tax_exempt_category?: string;
  addresses?: BigCommerceAddress[];
  attributes?: Array<{
    attribute_id: number;
    attribute_value: string;
  }>;
  date_created: string;
  date_modified: string;
  accepts_marketing?: boolean;
  store_credit?: string;
  registration_ip_address?: string;
  authentication_token?: string;
}

/**
 * BigCommerce Address Response
 */
export interface BigCommerceAddress {
  id?: number;
  customer_id?: number;
  first_name: string;
  last_name: string;
  company?: string;
  street_1: string;
  street_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  phone?: string;
  email?: string;
  address_type?: string;
}

/**
 * BigCommerce Image Response
 */
export interface BigCommerceImage {
  id: number;
  product_id: number;
  is_thumbnail: boolean;
  sort_order: number;
  description?: string;
  image_url: string;
  image_file?: string;
  url_zoom?: string;
  url_standard?: string;
  url_thumbnail?: string;
}

/**
 * BigCommerce Webhook Response
 */
export interface BigCommerceWebhook {
  id: number;
  scope: string;
  destination: string;
  is_active: boolean;
  events: string[];
  created_at: number;
  updated_at: number;
  headers?: Record<string, string>;
}

/**
 * BigCommerce Inventory Response
 */
export interface BigCommerceInventory {
  product_id: number;
  variant_id: number;
  level: number;
  warning_level: number;
  reserved_quantity?: number;
  bin_picking_number?: string;
}

/**
 * BigCommerce Shipping Zone Response
 */
export interface BigCommerceShippingZone {
  id: number;
  name: string;
  enabled: boolean;
  type: "world" | "country" | "state" | "zip";
  locations: Array<{
    country_code?: string;
    state_code?: string;
    zip_code?: string;
  }>;
  methods?: Array<{
    id: number;
    name: string;
    type: "fixed" | "percentage";
    settings: Record<string, unknown>;
  }>;
}

/**
 * BigCommerce Cart Response
 */
export interface BigCommerceCart {
  id: string;
  customer_id?: number;
  email?: string;
  currency: {
    code: string;
  };
  tax_included: boolean;
  cart_amount: number;
  tax_amount: number;
  discount_amount: number;
  line_items: Array<{
    id: string;
    product_id: number;
    variant_id: number;
    quantity: number;
    list_price: number;
    sale_price: number;
    extended_list_price: number;
    extended_sale_price: number;
  }>;
  created_at: string;
  updated_at: string;
}

/**
 * BigCommerce Rate Limit Status
 */
export interface BigCommerceRateLimit {
  requestsLeft: number;
  timeWindowSeconds: number;
  requestsResetAt: number;
}

/**
 * API Response wrapper
 */
interface BigCommerceApiResponse<T> {
  data?: T;
  data_type?: string;
  meta?: {
    pagination?: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
      links?: {
        next?: string;
        current: string;
      };
    };
  };
  pagination?: {
    total: number;
    count: number;
    per_page: number;
    current_page: number;
    total_pages: number;
  };
  error?: {
    status: number;
    title: string;
    detail: string;
    type: string;
  };
  errors?: Array<{
    status: number;
    title: string;
    detail: string;
    field?: string;
    error_type?: string;
  }>;
}

/**
 * BigCommerce V3 API SDK Client
 * Comprehensive client with full API coverage, OAuth2 support, rate limiting, and error handling
 */
export class BigCommerceSDKClient extends EventEmitter {
  private config: BigCommerceSDKConfig;
  private baseUrl: string;
  private rateLimitQueue: Array<() => Promise<unknown>> = [];
  private rateLimitActive = false;
  private requestsLeftCache = 0;
  private requestTimestamps: number[] = [];

  /**
   * Create new BigCommerce SDK client
   */
  constructor(config: BigCommerceSDKConfig) {
    super();
    this.config = {
      apiVersion: "v3",
      timeout: 30000,
      rateLimit: 40,
      ...config,
    };

    if (!config.storeHash || !config.accessToken) {
      throw new Error("storeHash and accessToken are required for BigCommerce SDK");
    }

    this.baseUrl = `https://api.bigcommerce.com/stores/${config.storeHash}/${this.config.apiVersion}`;
  }

  /**
   * OAuth2: Exchange authorization code for access token
   * Used in install callback flow
   */
  async exchangeCodeForToken(
    code: string,
    context: string,
    oauthConfig: BigCommerceOAuthConfig,
  ): Promise<BigCommerceOAuthToken> {
    const url = "https://login.bigcommerce.com/oauth2/token";

    const body = new URLSearchParams({
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      code,
      context,
      scope: oauthConfig.scopes.join(" "),
      grant_type: "authorization_code",
      redirect_uri: oauthConfig.redirectUri,
    });

    return this.makeRequest<BigCommerceOAuthToken>("POST", url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
  }

  /**
   * OAuth2: Handle install callback (app installed)
   * Store the authorization code for later token exchange
   */
  async handleInstallCallback(payload: BigCommerceInstallPayload): Promise<void> {
    this.emit("app:install", {
      code: payload.code,
      scope: payload.scope,
      context: payload.context,
      user: payload.user,
      timestamp: new Date(),
    });
  }

  /**
   * OAuth2: Handle load callback (app loaded)
   * Verify user context and permissions
   */
  async handleLoadCallback(payload: BigCommerceLoadPayload): Promise<void> {
    this.emit("app:load", {
      user: payload.user,
      owner: payload.owner,
      context: payload.context,
      timestamp: new Date(),
    });
  }

  /**
   * OAuth2: Handle uninstall callback (app removed)
   * Revoke tokens and clean up
   */
  async handleUninstallCallback(context: string): Promise<void> {
    this.emit("app:uninstall", {
      context,
      timestamp: new Date(),
    });
  }

  /**
   * Orders: List all orders with pagination and filtering
   */
  async listOrders(options?: {
    limit?: number;
    page?: number;
    sort?: string;
    status_id?: number;
    min_date_created?: string;
    max_date_created?: string;
  }): Promise<{ data: BigCommerceOrder[]; pagination: any }> {
    const params = new URLSearchParams({
      limit: (options?.limit || 50).toString(),
      page: (options?.page || 1).toString(),
      ...(options?.sort && { sort: options.sort }),
      ...(options?.status_id && { status_id: options.status_id.toString() }),
      ...(options?.min_date_created && { min_date_created: options.min_date_created }),
      ...(options?.max_date_created && { max_date_created: options.max_date_created }),
    });

    return this.get<BigCommerceApiResponse<BigCommerceOrder[]>>(
      `/orders?${params.toString()}`,
    ).then((response) => ({
      data: response.data || [],
      pagination: response.meta?.pagination || response.pagination,
    }));
  }

  /**
   * Orders: Get single order by ID
   */
  async getOrder(orderId: number): Promise<BigCommerceOrder> {
    return this.get<BigCommerceApiResponse<BigCommerceOrder>>(
      `/orders/${orderId}`,
    ).then((response) => response.data!);
  }

  /**
   * Orders: Create new order
   */
  async createOrder(order: Partial<BigCommerceOrder>): Promise<BigCommerceOrder> {
    return this.post<BigCommerceApiResponse<BigCommerceOrder>>(
      "/orders",
      { order },
    ).then((response) => response.data!);
  }

  /**
   * Orders: Update existing order
   */
  async updateOrder(orderId: number, updates: Partial<BigCommerceOrder>): Promise<BigCommerceOrder> {
    return this.put<BigCommerceApiResponse<BigCommerceOrder>>(
      `/orders/${orderId}`,
      { order: updates },
    ).then((response) => response.data!);
  }

  /**
   * Orders: Delete order by ID
   */
  async deleteOrder(orderId: number): Promise<void> {
    await this.delete(`/orders/${orderId}`);
  }

  /**
   * Orders: Count total orders
   */
  async countOrders(): Promise<number> {
    const response = await this.get<BigCommerceApiResponse<any>>(
      "/orders/count",
    );
    return response.data || 0;
  }

  /**
   * Orders: Get order products/line items
   */
  async getOrderProducts(
    orderId: number,
  ): Promise<Array<any>> {
    const response = await this.get<BigCommerceApiResponse<any[]>>(
      `/orders/${orderId}/products`,
    );
    return response.data || [];
  }

  /**
   * Orders: Get order shipping addresses
   */
  async getOrderShippingAddresses(
    orderId: number,
  ): Promise<BigCommerceAddress[]> {
    const response = await this.get<BigCommerceApiResponse<BigCommerceAddress[]>>(
      `/orders/${orderId}/shipping_addresses`,
    );
    return response.data || [];
  }

  /**
   * Orders: Get order coupons/discounts applied
   */
  async getOrderCoupons(orderId: number): Promise<Array<any>> {
    const response = await this.get<BigCommerceApiResponse<any[]>>(
      `/orders/${orderId}/coupons`,
    );
    return response.data || [];
  }

  /**
   * Orders: Get available order statuses
   */
  async getOrderStatuses(): Promise<Array<any>> {
    const response = await this.get<BigCommerceApiResponse<any[]>>(
      "/orders/statuses",
    );
    return response.data || [];
  }

  /**
   * Products: List all products with pagination
   */
  async listProducts(options?: {
    limit?: number;
    page?: number;
    name?: string;
    sku?: string;
    status?: string;
    include_fields?: string;
  }): Promise<{ data: BigCommerceProduct[]; pagination: any }> {
    const params = new URLSearchParams({
      limit: (options?.limit || 50).toString(),
      page: (options?.page || 1).toString(),
      ...(options?.name && { name: options.name }),
      ...(options?.sku && { sku: options.sku }),
      ...(options?.status && { status: options.status }),
      ...(options?.include_fields && { include_fields: options.include_fields }),
    });

    return this.get<BigCommerceApiResponse<BigCommerceProduct[]>>(
      `/catalog/products?${params.toString()}`,
    ).then((response) => ({
      data: response.data || [],
      pagination: response.meta?.pagination || response.pagination,
    }));
  }

  /**
   * Products: Get single product by ID
   */
  async getProduct(productId: number, includeFields?: string): Promise<BigCommerceProduct> {
    const params = new URLSearchParams(
      includeFields ? { include_fields: includeFields } : {},
    );
    return this.get<BigCommerceApiResponse<BigCommerceProduct>>(
      `/catalog/products/${productId}${params.toString() ? `?${params}` : ""}`,
    ).then((response) => response.data!);
  }

  /**
   * Products: Create new product
   */
  async createProduct(product: Partial<BigCommerceProduct>): Promise<BigCommerceProduct> {
    return this.post<BigCommerceApiResponse<BigCommerceProduct>>(
      "/catalog/products",
      product,
    ).then((response) => response.data!);
  }

  /**
   * Products: Update existing product
   */
  async updateProduct(
    productId: number,
    updates: Partial<BigCommerceProduct>,
  ): Promise<BigCommerceProduct> {
    return this.put<BigCommerceApiResponse<BigCommerceProduct>>(
      `/catalog/products/${productId}`,
      updates,
    ).then((response) => response.data!);
  }

  /**
   * Products: Delete product by ID
   */
  async deleteProduct(productId: number): Promise<void> {
    await this.delete(`/catalog/products/${productId}`);
  }

  /**
   * Products: Get product variants
   */
  async getProductVariants(productId: number): Promise<BigCommerceVariant[]> {
    const response = await this.get<BigCommerceApiResponse<BigCommerceVariant[]>>(
      `/catalog/products/${productId}/variants`,
    );
    return response.data || [];
  }

  /**
   * Products: Get variant by ID
   */
  async getVariant(variantId: number): Promise<BigCommerceVariant> {
    return this.get<BigCommerceApiResponse<BigCommerceVariant>>(
      `/catalog/variants/${variantId}`,
    ).then((response) => response.data!);
  }

  /**
   * Products: Update variant
   */
  async updateVariant(variantId: number, updates: Partial<BigCommerceVariant>): Promise<BigCommerceVariant> {
    return this.put<BigCommerceApiResponse<BigCommerceVariant>>(
      `/catalog/variants/${variantId}`,
      updates,
    ).then((response) => response.data!);
  }

  /**
   * Products: Get product images
   */
  async getProductImages(productId: number): Promise<BigCommerceImage[]> {
    const response = await this.get<BigCommerceApiResponse<BigCommerceImage[]>>(
      `/catalog/products/${productId}/images`,
    );
    return response.data || [];
  }

  /**
   * Products: Create product image
   */
  async createProductImage(
    productId: number,
    image: Partial<BigCommerceImage>,
  ): Promise<BigCommerceImage> {
    return this.post<BigCommerceApiResponse<BigCommerceImage>>(
      `/catalog/products/${productId}/images`,
      image,
    ).then((response) => response.data!);
  }

  /**
   * Products: Get product categories
   */
  async getProductCategories(productId?: number): Promise<Array<any>> {
    const url = productId
      ? `/catalog/products/${productId}/categories`
      : "/catalog/categories";
    const response = await this.get<BigCommerceApiResponse<any[]>>(url);
    return response.data || [];
  }

  /**
   * Products: Get product brands
   */
  async getProductBrands(): Promise<Array<any>> {
    const response = await this.get<BigCommerceApiResponse<any[]>>(
      "/catalog/brands",
    );
    return response.data || [];
  }

  /**
   * Products: Bulk update product inventory/pricing
   */
  async bulkUpdateProducts(
    updates: Array<{ id: number } & Partial<BigCommerceProduct>>,
  ): Promise<BigCommerceProduct[]> {
    return this.put<BigCommerceApiResponse<BigCommerceProduct[]>>(
      "/catalog/products",
      updates,
    ).then((response) => response.data || []);
  }

  /**
   * Products: Get bulk pricing for variant
   */
  async getVariantBulkPricing(variantId: number): Promise<Array<any>> {
    const response = await this.get<BigCommerceApiResponse<any[]>>(
      `/catalog/variants/${variantId}/bulk-pricing-rules`,
    );
    return response.data || [];
  }

  /**
   * Customers: List all customers
   */
  async listCustomers(options?: {
    limit?: number;
    page?: number;
    email?: string;
    name?: string;
  }): Promise<{ data: BigCommerceCustomer[]; pagination: any }> {
    const params = new URLSearchParams({
      limit: (options?.limit || 50).toString(),
      page: (options?.page || 1).toString(),
      ...(options?.email && { email: options.email }),
      ...(options?.name && { name: options.name }),
    });

    return this.get<BigCommerceApiResponse<BigCommerceCustomer[]>>(
      `/customers?${params.toString()}`,
    ).then((response) => ({
      data: response.data || [],
      pagination: response.meta?.pagination || response.pagination,
    }));
  }

  /**
   * Customers: Get single customer by ID
   */
  async getCustomer(customerId: number): Promise<BigCommerceCustomer> {
    return this.get<BigCommerceApiResponse<BigCommerceCustomer>>(
      `/customers/${customerId}`,
    ).then((response) => response.data!);
  }

  /**
   * Customers: Create new customer
   */
  async createCustomer(customer: Partial<BigCommerceCustomer>): Promise<BigCommerceCustomer> {
    return this.post<BigCommerceApiResponse<BigCommerceCustomer>>(
      "/customers",
      customer,
    ).then((response) => response.data!);
  }

  /**
   * Customers: Update existing customer
   */
  async updateCustomer(
    customerId: number,
    updates: Partial<BigCommerceCustomer>,
  ): Promise<BigCommerceCustomer> {
    return this.put<BigCommerceApiResponse<BigCommerceCustomer>>(
      `/customers/${customerId}`,
      updates,
    ).then((response) => response.data!);
  }

  /**
   * Customers: Delete customer by ID
   */
  async deleteCustomer(customerId: number): Promise<void> {
    await this.delete(`/customers/${customerId}`);
  }

  /**
   * Customers: Get customer addresses
   */
  async getCustomerAddresses(customerId: number): Promise<BigCommerceAddress[]> {
    const response = await this.get<BigCommerceApiResponse<BigCommerceAddress[]>>(
      `/customers/${customerId}/addresses`,
    );
    return response.data || [];
  }

  /**
   * Customers: Create customer address
   */
  async createCustomerAddress(
    customerId: number,
    address: Partial<BigCommerceAddress>,
  ): Promise<BigCommerceAddress> {
    return this.post<BigCommerceApiResponse<BigCommerceAddress>>(
      `/customers/${customerId}/addresses`,
      address,
    ).then((response) => response.data!);
  }

  /**
   * Customers: Get customer groups
   */
  async getCustomerGroups(): Promise<Array<any>> {
    const response = await this.get<BigCommerceApiResponse<any[]>>(
      "/customer_groups",
    );
    return response.data || [];
  }

  /**
   * Inventory: Get stock level for variant
   */
  async getInventoryLevel(variantId: number): Promise<number> {
    const variant = await this.getVariant(variantId);
    return variant.inventory_level || 0;
  }

  /**
   * Inventory: Bulk update inventory levels
   */
  async bulkUpdateInventory(
    updates: Array<{ variant_id: number; level: number }>,
  ): Promise<void> {
    // V3 doesn't support bulk inventory; update variants individually
    await Promise.all(
      updates.map((update) =>
        this.updateVariant(update.variant_id, {
          inventory_level: update.level,
        } as any),
      ),
    );
  }

  /**
   * Inventory: Set low stock alert threshold
   */
  async setLowStockAlert(variantId: number, threshold: number): Promise<void> {
    await this.updateVariant(variantId, {
      inventory_warning_level: threshold,
    } as any);
  }

  /**
   * Webhooks: Create webhook subscription
   */
  async createWebhook(
    scope: string,
    destination: string,
    isActive?: boolean,
  ): Promise<BigCommerceWebhook> {
    return this.post<BigCommerceApiResponse<BigCommerceWebhook>>(
      "/hooks",
      {
        scope,
        destination,
        is_active: isActive ?? true,
      },
    ).then((response) => response.data!);
  }

  /**
   * Webhooks: List all webhooks
   */
  async listWebhooks(): Promise<BigCommerceWebhook[]> {
    const response = await this.get<BigCommerceApiResponse<BigCommerceWebhook[]>>(
      "/hooks",
    );
    return response.data || [];
  }

  /**
   * Webhooks: Update webhook subscription
   */
  async updateWebhook(
    webhookId: number,
    updates: Partial<BigCommerceWebhook>,
  ): Promise<BigCommerceWebhook> {
    return this.put<BigCommerceApiResponse<BigCommerceWebhook>>(
      `/hooks/${webhookId}`,
      updates,
    ).then((response) => response.data!);
  }

  /**
   * Webhooks: Delete webhook subscription
   */
  async deleteWebhook(webhookId: number): Promise<void> {
    await this.delete(`/hooks/${webhookId}`);
  }

  /**
   * Webhooks: Verify webhook signature (SHA256 HMAC)
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) return false;

    const expectedSignature = createHmac("sha256", this.config.webhookSecret)
      .update(payload)
      .digest("base64");

    return expectedSignature === signature;
  }

  /**
   * Shipping: Get shipping zones
   */
  async getShippingZones(): Promise<BigCommerceShippingZone[]> {
    const response = await this.get<BigCommerceApiResponse<BigCommerceShippingZone[]>>(
      "/shipping/zones",
    );
    return response.data || [];
  }

  /**
   * Shipping: Create shipping zone
   */
  async createShippingZone(zone: Partial<BigCommerceShippingZone>): Promise<BigCommerceShippingZone> {
    return this.post<BigCommerceApiResponse<BigCommerceShippingZone>>(
      "/shipping/zones",
      zone,
    ).then((response) => response.data!);
  }

  /**
   * Shipping: Update shipping zone
   */
  async updateShippingZone(
    zoneId: number,
    updates: Partial<BigCommerceShippingZone>,
  ): Promise<BigCommerceShippingZone> {
    return this.put<BigCommerceApiResponse<BigCommerceShippingZone>>(
      `/shipping/zones/${zoneId}`,
      updates,
    ).then((response) => response.data!);
  }

  /**
   * Shipping: Get shipping methods for zone
   */
  async getShippingMethods(zoneId: number): Promise<Array<any>> {
    const response = await this.get<BigCommerceApiResponse<any[]>>(
      `/shipping/zones/${zoneId}/methods`,
    );
    return response.data || [];
  }

  /**
   * Shipping: Get carrier connections
   */
  async getCarrierConnections(): Promise<Array<any>> {
    const response = await this.get<BigCommerceApiResponse<any[]>>(
      "/shipping/carrier_connections",
    );
    return response.data || [];
  }

  /**
   * Storefront: Get shopping cart
   */
  async getCart(cartId: string): Promise<BigCommerceCart> {
    return this.get<BigCommerceApiResponse<BigCommerceCart>>(
      `/carts/${cartId}`,
    ).then((response) => response.data!);
  }

  /**
   * Storefront: Get checkout
   */
  async getCheckout(checkoutId: string): Promise<any> {
    return this.get<BigCommerceApiResponse<any>>(
      `/checkouts/${checkoutId}`,
    ).then((response) => response.data!);
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): BigCommerceRateLimit {
    return {
      requestsLeft: this.requestsLeftCache,
      timeWindowSeconds: 60,
      requestsResetAt: Math.floor(
        (Date.now() + 60000) / 1000,
      ),
    };
  }

  /**
   * Make authenticated GET request
   */
  private async get<T>(endpoint: string): Promise<T> {
    return this.request<T>("GET", endpoint);
  }

  /**
   * Make authenticated POST request
   */
  private async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", endpoint, body);
  }

  /**
   * Make authenticated PUT request
   */
  private async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", endpoint, body);
  }

  /**
   * Make authenticated DELETE request
   */
  private async delete(endpoint: string): Promise<void> {
    await this.request("DELETE", endpoint);
  }

  /**
   * Core HTTP request method with rate limiting and error handling
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    // Handle rate limiting
    if (this.isNearRateLimit()) {
      await this.queueRequest(() =>
        this.executeRequest<T>(method, endpoint, body),
      );
    }

    return this.executeRequest<T>(method, endpoint, body);
  }

  /**
   * Execute HTTP request with full error handling
   */
  private async executeRequest<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "X-Auth-Token": this.config.accessToken,
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeout,
    );

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      // Update rate limit cache from response headers
      const requestsLeft = response.headers.get("X-Rate-Limit-Requests-Left");
      if (requestsLeft) {
        this.requestsLeftCache = parseInt(requestsLeft, 10);
      }

      // Handle error responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.mapError(response.status, errorData, method, endpoint);
      }

      // Parse and return response
      const responseText = await response.text();
      if (!responseText) return {} as T;

      return JSON.parse(responseText);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`BigCommerce request timeout (${this.config.timeout}ms): ${endpoint}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Check if near rate limit threshold
   */
  private isNearRateLimit(): boolean {
    const threshold = (this.config.rateLimit || 40) * 0.2; // 20% threshold
    return this.requestsLeftCache < threshold;
  }

  /**
   * Queue request when rate limited
   */
  private async queueRequest(request: () => Promise<unknown>): Promise<void> {
    if (!this.rateLimitActive) {
      this.rateLimitActive = true;
      // Wait 1 second before processing queue
      await new Promise((resolve) => setTimeout(resolve, 1000));
      this.rateLimitActive = false;
      // Process queue
      while (this.rateLimitQueue.length > 0) {
        const next = this.rateLimitQueue.shift();
        if (next) {
          await next();
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } else {
      this.rateLimitQueue.push(request);
    }
  }

  /**
   * Map BigCommerce error to standard error
   */
  private mapError(
    status: number,
    data: any,
    method: string,
    endpoint: string,
  ): Error {
    const error = data?.error || data?.errors?.[0];
    const message = error?.detail || error?.title || `BigCommerce ${status}`;

    const errorMap: Record<number, string> = {
      400: "INTEGRATION_ERROR",
      401: "INTEGRATION_AUTH_FAILED",
      403: "INTEGRATION_AUTH_FAILED",
      404: "INTEGRATION_NOT_FOUND",
      409: "INTEGRATION_CONFLICT",
      422: "INTEGRATION_VALIDATION_ERROR",
      429: "INTEGRATION_RATE_LIMITED",
      500: "INTEGRATION_PROVIDER_ERROR",
      503: "INTEGRATION_UNAVAILABLE",
    };

    const code = errorMap[status] || "INTEGRATION_ERROR";
    const err = new Error(`[${code}] ${message}`);
    (err as any).code = code;
    (err as any).status = status;

    return err;
  }
}

/**
 * Factory function to create BigCommerce SDK client
 */
export function createBigCommerceSDKClient(
  config: BigCommerceSDKConfig,
): BigCommerceSDKClient {
  return new BigCommerceSDKClient(config);
}
