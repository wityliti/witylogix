/**
 * Custom/Self-Hosted Platform Adapter
 *
 * Implements PlatformAdapter interface for CUSTOM platform source, enabling
 * integrations with self-hosted and headless storefronts via configurable field mapping.
 *
 * This adapter differs from other platform adapters in that it doesn't assume
 * a fixed schema. Instead, merchants define field mappings via JSON configuration
 * stored in shop settings.
 *
 * Features:
 * - Configurable field mapping: Merchants define how their JSON maps to Witylogix fields
 * - Multiple authentication methods: API key, HMAC-SHA256, Bearer token
 * - Dynamic webhook event type detection via configurable header
 * - REST API calls with configurable base URL and auth
 * - JMESPath-style dot notation for nested field extraction
 *
 * Field Mapping Example:
 * ```json
 * {
 *   "order": {
 *     "externalOrderId": "id",
 *     "externalOrderNumber": "number",
 *     "status": "status",
 *     "total": "total_price",
 *     "currency": "currency_code",
 *     "customerEmail": "customer.email",
 *     "customerName": "customer.name",
 *     "shippingAddress": {
 *       "firstName": "shipping.first_name",
 *       "lastName": "shipping.last_name",
 *       "line1": "shipping.address_1",
 *       "city": "shipping.city",
 *       "country": "shipping.country"
 *     }
 *   }
 * }
 * ```
 */

import * as crypto from "crypto";
import type {
  CreateOrderInput,
  CreateProductInput,
  CreateCustomerInput,
  PlatformCredentials,
} from "../types.js";
import { PlatformSource } from "@witylogix/types";

/**
 * Custom platform field mapping configuration
 *
 * Defines how merchant's JSON schema maps to Witylogix fields.
 * Uses dot notation for nested field extraction.
 */
export interface CustomFieldMapping {
  order?: {
    externalOrderId?: string;
    externalOrderNumber?: string;
    status?: string;
    total?: string;
    currency?: string;
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
    createdAt?: string;
    shippingAddress?: {
      firstName?: string;
      lastName?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    billingAddress?: {
      firstName?: string;
      lastName?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    lineItems?: {
      externalProductId?: string;
      sku?: string;
      quantity?: string;
      price?: string;
    };
  };
  product?: {
    externalProductId?: string;
    title?: string;
    description?: string;
    sku?: string;
    price?: string;
    currency?: string;
    status?: string;
    imageUrl?: string;
  };
  customer?: {
    externalCustomerId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
}

/**
 * Custom platform authentication configuration
 *
 * Supports multiple auth methods for merchant's API.
 */
export interface CustomAuthConfig {
  method: "api_key" | "hmac" | "bearer";
  /**
   * For api_key: header name (e.g., "X-API-Key")
   * For bearer: unused (token goes in Authorization header)
   * For hmac: header name to read signature from (e.g., "X-Signature")
   */
  headerName?: string;
  /**
   * For api_key: the API key value
   * For hmac: the signing secret
   * For bearer: the access token
   */
  secret?: string;
}

/**
 * Custom platform webhook configuration
 */
export interface CustomWebhookConfig {
  auth?: CustomAuthConfig;
  /**
   * Header name for reading event type (e.g., "X-Event-Type")
   * If not provided, looks for "event_type" in payload
   */
  eventTypeHeader?: string;
  /**
   * Field path in payload for event type (e.g., "event.type" or "action")
   */
  eventTypeField?: string;
}

/**
 * Custom platform credentials
 *
 * Stores configuration for custom/headless storefronts.
 */
export interface CustomCredentials extends PlatformCredentials {
  source: PlatformSource.CUSTOM;
  data: {
    /** Base URL for API calls (e.g., "https://api.example.com") */
    baseUrl: string;
    /** Field mapping configuration */
    fieldMapping: CustomFieldMapping;
    /** Webhook configuration */
    webhookConfig?: CustomWebhookConfig;
    /** Authentication configuration for API calls */
    auth?: CustomAuthConfig;
    /** Optional: store-specific metadata */
    metadata?: Record<string, unknown>;
  };
}

/**
 * Default field mappings for common patterns
 */
export const DEFAULT_FIELD_MAPPING: CustomFieldMapping = {
  order: {
    externalOrderId: "id",
    externalOrderNumber: "number",
    status: "status",
    total: "total",
    currency: "currency",
    customerEmail: "customer.email",
    customerName: "customer.name",
    customerPhone: "customer.phone",
    createdAt: "created_at",
    shippingAddress: {
      firstName: "shipping.first_name",
      lastName: "shipping.last_name",
      line1: "shipping.address_1",
      line2: "shipping.address_2",
      city: "shipping.city",
      state: "shipping.state",
      postalCode: "shipping.postal_code",
      country: "shipping.country",
    },
    lineItems: {
      externalProductId: "product_id",
      sku: "sku",
      quantity: "quantity",
      price: "price",
    },
  },
  product: {
    externalProductId: "id",
    title: "title",
    description: "description",
    sku: "sku",
    price: "price",
    currency: "currency",
    status: "status",
    imageUrl: "image_url",
  },
  customer: {
    externalCustomerId: "id",
    email: "email",
    firstName: "first_name",
    lastName: "last_name",
    phone: "phone",
  },
};

/**
 * Extract nested field value using dot notation
 *
 * @param obj - Object to extract from
 * @param path - Dot-separated path (e.g., "customer.email", "shipping.address.line1")
 * @returns Extracted value or undefined
 *
 * @example
 * extractField({ customer: { email: 'test@example.com' } }, 'customer.email')
 * // Returns: 'test@example.com'
 */
function extractField(obj: unknown, path?: string): unknown {
  if (!path || typeof obj !== "object" || !obj) {
    return undefined;
  }

  const parts = path.split(".");
  let current: any = obj;

  for (const part of parts) {
    if (typeof current !== "object" || !current || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Custom platform adapter for self-hosted/headless storefronts
 *
 * Provides flexible field mapping and configurable authentication
 * to support arbitrary JSON schemas.
 */
export class CustomAdapter {
  public readonly source = PlatformSource.CUSTOM;

  /**
   * Validate custom webhook signature
   *
   * Supports three authentication methods:
   * 1. API Key: Validates presence of API key header
   * 2. HMAC-SHA256: Validates signature in header against payload
   * 3. Bearer Token: Validates Authorization Bearer header
   *
   * @param payload - Raw webhook body as Buffer
   * @param signature - Signature or token from header
   * @param config - Authentication configuration
   * @returns true if signature is valid, false otherwise
   *
   * @throws Error if validation fails
   *
   * @example
   * ```typescript
   * const config: CustomAuthConfig = {
   *   method: 'hmac',
   *   secret: 'my-webhook-secret',
   *   headerName: 'X-Signature'
   * };
   * const isValid = adapter.validateWebhook(payload, signature, config);
   * ```
   */
  validateWebhook(
    payload: Buffer,
    signature: string,
    config?: CustomAuthConfig,
  ): boolean {
    if (!config) {
      // No auth configured, skip validation
      return true;
    }

    try {
      switch (config.method) {
        case "api_key": {
          // Validate API key matches configured key
          return signature === config.secret;
        }

        case "hmac": {
          // Validate HMAC-SHA256 signature
          if (!config.secret) {
            return false;
          }

          const payloadString = payload.toString("utf-8");
          const computed = crypto
            .createHmac("sha256", config.secret)
            .update(payloadString, "utf-8")
            .digest("hex");

          // Timing-safe comparison
          const expectedBuffer = Buffer.from(computed, "utf-8");
          const actualBuffer = Buffer.from(signature, "utf-8");

          if (expectedBuffer.length !== actualBuffer.length) {
            return false;
          }

          return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
        }

        case "bearer": {
          // Validate Bearer token
          return signature === `Bearer ${config.secret}`;
        }

        default:
          return false;
      }
    } catch (error) {
      console.error("[CustomAdapter] Error validating webhook:", error);
      return false;
    }
  }

  /**
   * Map custom order JSON to normalized CreateOrderInput
   *
   * Uses field mapping configuration to extract and transform
   * merchant's order schema into Witylogix format.
   *
   * @param externalOrder - Raw order from merchant API
   * @param mapping - Field mapping configuration
   * @returns Normalized order input
   * @throws Error if required fields are missing
   */
  mapOrder(
    externalOrder: unknown,
    mapping?: CustomFieldMapping,
  ): CreateOrderInput {
    const fieldMapping = mapping?.order;

    if (!fieldMapping) {
      throw new Error("Order field mapping not configured");
    }

    const externalOrderId = String(
      extractField(externalOrder, fieldMapping.externalOrderId) || "",
    );
    if (!externalOrderId) {
      throw new Error("Unable to extract externalOrderId from order");
    }

    const shippingAddress = fieldMapping.shippingAddress
      ? {
          firstName: String(
            extractField(
              externalOrder,
              fieldMapping.shippingAddress.firstName,
            ) || "",
          ),
          lastName: String(
            extractField(
              externalOrder,
              fieldMapping.shippingAddress.lastName,
            ) || "",
          ),
          line1: String(
            extractField(externalOrder, fieldMapping.shippingAddress.line1) ||
              "",
          ),
          line2: extractField(externalOrder, fieldMapping.shippingAddress.line2)
            ? String(
                extractField(externalOrder, fieldMapping.shippingAddress.line2),
              )
            : undefined,
          city: String(
            extractField(externalOrder, fieldMapping.shippingAddress.city) ||
              "",
          ),
          state: extractField(externalOrder, fieldMapping.shippingAddress.state)
            ? String(
                extractField(externalOrder, fieldMapping.shippingAddress.state),
              )
            : undefined,
          postalCode: String(
            extractField(
              externalOrder,
              fieldMapping.shippingAddress.postalCode,
            ) || "",
          ),
          country: String(
            extractField(externalOrder, fieldMapping.shippingAddress.country) ||
              "",
          ),
        }
      : undefined;

    const lineItemsPath = fieldMapping.lineItems ? "line_items" : undefined;
    let lineItems:
      | Array<{
          externalProductId: string;
          sku?: string;
          quantity: number;
          price?: string;
        }>
      | undefined;

    if (fieldMapping.lineItems && lineItemsPath) {
      const rawLineItems = extractField(externalOrder, lineItemsPath) as any[];
      if (Array.isArray(rawLineItems)) {
        lineItems = rawLineItems.map((item) => ({
          externalProductId: String(
            extractField(item, fieldMapping.lineItems?.externalProductId) || "",
          ),
          sku: extractField(item, fieldMapping.lineItems?.sku)
            ? String(extractField(item, fieldMapping.lineItems?.sku))
            : undefined,
          quantity: Number(
            extractField(item, fieldMapping.lineItems?.quantity) || 1,
          ),
          price: extractField(item, fieldMapping.lineItems?.price)
            ? String(extractField(item, fieldMapping.lineItems?.price))
            : undefined,
        }));
      }
    }

    const createdAtValue = extractField(externalOrder, fieldMapping.createdAt);
    let createdAt: Date | undefined;
    if (createdAtValue) {
      const parsed = new Date(String(createdAtValue));
      if (!isNaN(parsed.getTime())) {
        createdAt = parsed;
      }
    }

    return {
      shopId: "", // Will be set by webhook handler
      source: PlatformSource.CUSTOM,
      externalOrderId,
      externalOrderNumber: extractField(
        externalOrder,
        fieldMapping.externalOrderNumber,
      )
        ? String(extractField(externalOrder, fieldMapping.externalOrderNumber))
        : undefined,
      status: extractField(externalOrder, fieldMapping.status)
        ? String(extractField(externalOrder, fieldMapping.status))
        : undefined,
      total: extractField(externalOrder, fieldMapping.total)
        ? String(extractField(externalOrder, fieldMapping.total))
        : undefined,
      currency: extractField(externalOrder, fieldMapping.currency)
        ? String(extractField(externalOrder, fieldMapping.currency))
        : undefined,
      customerEmail: extractField(externalOrder, fieldMapping.customerEmail)
        ? String(extractField(externalOrder, fieldMapping.customerEmail))
        : undefined,
      customerName: extractField(externalOrder, fieldMapping.customerName)
        ? String(extractField(externalOrder, fieldMapping.customerName))
        : undefined,
      shippingAddress,
      lineItems,
      createdAt,
      metadata: { rawOrder: externalOrder },
    };
  }

  /**
   * Map custom product JSON to normalized CreateProductInput
   *
   * @param externalProduct - Raw product from merchant API
   * @param mapping - Field mapping configuration
   * @returns Normalized product input
   * @throws Error if required fields are missing
   */
  mapProduct(
    externalProduct: unknown,
    mapping?: CustomFieldMapping,
  ): CreateProductInput {
    const fieldMapping = mapping?.product;

    if (!fieldMapping) {
      throw new Error("Product field mapping not configured");
    }

    const externalProductId = String(
      extractField(externalProduct, fieldMapping.externalProductId) || "",
    );
    if (!externalProductId) {
      throw new Error("Unable to extract externalProductId from product");
    }

    return {
      shopId: "", // Will be set by webhook handler
      source: PlatformSource.CUSTOM,
      externalProductId,
      title: extractField(externalProduct, fieldMapping.title)
        ? String(extractField(externalProduct, fieldMapping.title))
        : undefined,
      description: extractField(externalProduct, fieldMapping.description)
        ? String(extractField(externalProduct, fieldMapping.description))
        : undefined,
      sku: extractField(externalProduct, fieldMapping.sku)
        ? String(extractField(externalProduct, fieldMapping.sku))
        : undefined,
      price: extractField(externalProduct, fieldMapping.price)
        ? String(extractField(externalProduct, fieldMapping.price))
        : undefined,
      currency: extractField(externalProduct, fieldMapping.currency)
        ? String(extractField(externalProduct, fieldMapping.currency))
        : undefined,
      status: extractField(externalProduct, fieldMapping.status)
        ? String(extractField(externalProduct, fieldMapping.status))
        : undefined,
      imageUrl: extractField(externalProduct, fieldMapping.imageUrl)
        ? String(extractField(externalProduct, fieldMapping.imageUrl))
        : undefined,
      metadata: { rawProduct: externalProduct },
    };
  }

  /**
   * Map custom customer JSON to normalized CreateCustomerInput
   *
   * @param externalCustomer - Raw customer from merchant API
   * @param mapping - Field mapping configuration
   * @returns Normalized customer input
   * @throws Error if required fields are missing
   */
  mapCustomer(
    externalCustomer: unknown,
    mapping?: CustomFieldMapping,
  ): CreateCustomerInput {
    const fieldMapping = mapping?.customer;

    if (!fieldMapping) {
      throw new Error("Customer field mapping not configured");
    }

    const externalCustomerId = String(
      extractField(externalCustomer, fieldMapping.externalCustomerId) || "",
    );
    if (!externalCustomerId) {
      throw new Error("Unable to extract externalCustomerId from customer");
    }

    return {
      shopId: "", // Will be set by webhook handler
      source: PlatformSource.CUSTOM,
      externalCustomerId,
      email: extractField(externalCustomer, fieldMapping.email)
        ? String(extractField(externalCustomer, fieldMapping.email))
        : undefined,
      firstName: extractField(externalCustomer, fieldMapping.firstName)
        ? String(extractField(externalCustomer, fieldMapping.firstName))
        : undefined,
      lastName: extractField(externalCustomer, fieldMapping.lastName)
        ? String(extractField(externalCustomer, fieldMapping.lastName))
        : undefined,
      phone: extractField(externalCustomer, fieldMapping.phone)
        ? String(extractField(externalCustomer, fieldMapping.phone))
        : undefined,
      metadata: { rawCustomer: externalCustomer },
    };
  }

  /**
   * Fetch order from merchant's API using configurable base URL and auth
   *
   * @param externalOrderId - Order ID to fetch
   * @param credentials - Custom platform credentials with baseUrl and auth config
   * @returns Raw order from merchant API
   * @throws Error if API call fails
   */
  async fetchOrder(
    externalOrderId: string,
    credentials: CustomCredentials,
  ): Promise<unknown> {
    const { baseUrl, auth } = credentials.data;

    if (!baseUrl) {
      throw new Error("baseUrl not configured in credentials");
    }

    const url = `${baseUrl}/orders/${externalOrderId}`;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add authentication header
      if (auth) {
        switch (auth.method) {
          case "api_key":
            if (auth.headerName && auth.secret) {
              headers[auth.headerName] = auth.secret;
            }
            break;
          case "bearer":
            if (auth.secret) {
              headers["Authorization"] = `Bearer ${auth.secret}`;
            }
            break;
          case "hmac":
            // For HMAC, signature is computed on request body; not applicable for GET
            break;
        }
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(
          `Custom API error: ${response.status} ${response.statusText}`,
        );
      }

      return (await response.json()) as unknown;
    } catch (error) {
      console.error("[CustomAdapter] Error fetching order:", error);
      throw error;
    }
  }

  /**
   * Fetch products from merchant's API with pagination
   *
   * @param credentials - Custom platform credentials
   * @param cursor - Pagination cursor (implementation-specific)
   * @returns Products array and next cursor
   * @throws Error if API call fails
   */
  async fetchProducts(
    credentials: CustomCredentials,
    cursor?: string,
  ): Promise<{ products: unknown[]; nextCursor?: string }> {
    const { baseUrl, auth } = credentials.data;

    if (!baseUrl) {
      throw new Error("baseUrl not configured in credentials");
    }

    const url = new URL(`${baseUrl}/products`);
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add authentication header
      if (auth) {
        switch (auth.method) {
          case "api_key":
            if (auth.headerName && auth.secret) {
              headers[auth.headerName] = auth.secret;
            }
            break;
          case "bearer":
            if (auth.secret) {
              headers["Authorization"] = `Bearer ${auth.secret}`;
            }
            break;
        }
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(
          `Custom API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as any;
      const products = Array.isArray(data) ? data : data.products || [];
      const nextCursor = data.nextCursor || data.next_cursor;

      return { products, nextCursor };
    } catch (error) {
      console.error("[CustomAdapter] Error fetching products:", error);
      throw error;
    }
  }

  /**
   * Extract event type from webhook payload
   *
   * Looks for event type in configurable header or payload field.
   *
   * @param payload - Parsed webhook payload
   * @param eventTypeHeader - Header value (if event type came from header)
   * @param webhookConfig - Webhook configuration with event type settings
   * @returns Event type string or null if not found
   *
   * @example
   * ```typescript
   * const eventType = adapter.getWebhookEventType(
   *   payload,
   *   request.headers['x-event-type'],
   *   webhookConfig
   * );
   * ```
   */
  getWebhookEventType(
    payload: unknown,
    eventTypeHeader?: string,
    webhookConfig?: CustomWebhookConfig,
  ): string | null {
    // First try header value if provided
    if (eventTypeHeader && typeof eventTypeHeader === "string") {
      return eventTypeHeader;
    }

    // Try configured field path in payload
    if (
      webhookConfig?.eventTypeField &&
      typeof payload === "object" &&
      payload
    ) {
      const eventType = extractField(payload, webhookConfig.eventTypeField);
      if (eventType) {
        return String(eventType);
      }
    }

    // Default: try common field names
    const commonFields = ["event_type", "type", "action", "event"];
    for (const field of commonFields) {
      if (typeof payload === "object" && payload && field in payload) {
        const value = (payload as any)[field];
        if (value) {
          return String(value);
        }
      }
    }

    return null;
  }
}

export default CustomAdapter;
