/**
 * ShipStation API v2 SDK Type Definitions
 *
 * Complete type definitions for ShipStation's REST API v2:
 * - Order management (list, get, create, update, delete, assign tag, add note, mark as shipped)
 * - Shipment management (create label, void label, get rates)
 * - Carrier operations (list carriers, list services, list packages)
 * - Warehouse management (list, create)
 * - Store management (list, refresh)
 * - Product management (list, get, update)
 * - Webhook management (subscribe, unsubscribe)
 * - Batch operations (create batch, get batch status)
 * - Pagination and rate limiting support
 */

// ─── Authentication ─────────────────────────────────────────────────

/**
 * ShipStation API credentials configuration
 */
export interface SSAuthConfig {
  /** API Key for Basic Auth */
  apiKey?: string;

  /** API Secret for Basic Auth */
  apiSecret?: string;

  /** OAuth2 Access Token for partner apps */
  oauthToken?: string;

  /** Base URL override (e.g., for testing) */
  baseUrl?: string;
}

// ─── Orders ─────────────────────────────────────────────────────────

/**
 * ShipStation Order (v2 API)
 */
export interface SSOrder {
  orderId: string;
  orderNumber: string;
  externalOrderId?: string;
  customerId: string;
  customerUsername?: string;
  orderDate: string;
  shipDate?: string;
  status:
    | "awaiting_payment"
    | "awaiting_shipment"
    | "shipped"
    | "on_hold"
    | "cancelled";
  shippingStatus?: "pending" | "completed" | "voided";

  source: {
    sourceId: string;
    sourceName: string;
  };

  shipTo: SSAddress;
  billTo?: SSAddress;

  items: SSOrderItem[];
  weights: {
    weightUnits: "pounds" | "ounces" | "grams" | "kilograms";
    weight: number;
  };

  amountPaid?: number;
  totalWeight?: number;
  customerEmail?: string;
  customerNotes?: string;
  internalNotes?: string;

  customFields?: Record<string, string>;
  tags?: string[];
  advancedOptions?: SSAdvancedOptions;
}

/**
 * ShipStation Order Item
 */
export interface SSOrderItem {
  lineItemId: string;
  productId: string;
  variantId?: string;
  title: string;
  quantity: number;
  quantityShipped?: number;
  sku?: string;
  unitPrice: number;
  warehouseLocation?: string;
  options?: Array<{
    name: string;
    value: string;
  }>;
  imageUrl?: string;
}

/**
 * ShipStation Address
 */
export interface SSAddress {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  street3?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  residential?: boolean;
  addressVerified?: "verified" | "unverified" | "error";
}

/**
 * Advanced options for orders/shipments
 */
export interface SSAdvancedOptions {
  warehouseId?: string;
  nonMachinable?: boolean;
  saturdayDelivery?: boolean;
  containsAlcohol?: boolean;
  mergedOrSplit?: boolean;
  parentOrderId?: string;
  billToParty?: "shipper" | "recipient" | "thirdparty" | "collect";
  billToAccount?: string;
  billToPostalCode?: string;
  billToCountryCode?: string;
  customsDescription?: string;
  customsValue?: number;
  source?: string;
  storeId?: string;
  carrierCode?: string;
  serviceCode?: string;
  packageCode?: string;
}

/**
 * Request to create or update an order
 */
export interface SSCreateOrderRequest {
  orderNumber: string;
  externalOrderId?: string;
  customerId?: string;
  orderDate: string;
  shipTo: SSAddress;
  billTo?: SSAddress;
  items: SSOrderItem[];
  customerEmail?: string;
  customerNotes?: string;
  internalNotes?: string;
  customFields?: Record<string, string>;
  advancedOptions?: SSAdvancedOptions;
}

// ─── Shipments & Labels ─────────────────────────────────────────────

/**
 * ShipStation Shipment
 */
export interface SSShipment {
  shipmentId: string;
  orderId: string;
  shipDate: string;
  status: "pending" | "shipped" | "voided" | "cancelled";

  shipTo: SSAddress;
  shipFrom: SSAddress;
  returnTo?: SSAddress;

  weight: {
    value: number;
    units: "pounds" | "ounces" | "grams" | "kilograms";
  };

  dimensions?: {
    length: number;
    width: number;
    height: number;
    units: "inches" | "centimeters";
  };

  trackingNumber?: string;
  labelId?: string;
  carrierCode: string;
  serviceCode: string;
  packageCode: string;

  insuranceOptions?: {
    insureShipment: boolean;
    insuredValue?: number;
    insuranceProvider?: string;
  };

  advancedOptions?: SSAdvancedOptions;
}

/**
 * Shipping Label
 */
export interface SSLabel {
  labelId: string;
  shipmentId: string;
  orderId?: string;
  shipDate: string;
  trackingNumber: string;
  status: "draft" | "purchased" | "printing" | "voided";

  carrier: {
    code: string;
    name: string;
  };

  service: {
    code: string;
    name: string;
  };

  package: {
    code: string;
    name: string;
  };

  labelFormat: "pdf" | "png" | "zpl" | "eppl";
  labelLayout: "4x6" | "4x8" | "letter";

  labelDownload: {
    pdf: string;
    png: string;
    zpl?: string;
    href: string;
  };

  insuranceOptions?: {
    insureShipment: boolean;
    insuredValue?: number;
    insuranceProvider?: string;
  };

  voided: boolean;
  voidedDate?: string;
  purchasedDate?: string;

  customsDeclaration?: {
    contentsType: string;
    customsItems: Array<{
      description: string;
      quantity: number;
      value: number;
      countryOfOrigin: string;
    }>;
  };
}

/**
 * Request to create a label
 */
export interface SSCreateLabelRequest {
  shipmentId: string;
  rateId?: string;
  labelFormat: "pdf" | "png" | "zpl" | "eppl";
  labelLayout: "4x6" | "4x8" | "letter";
  displayScheme?: string;
  testLabel?: boolean;
}

// ─── Rates ──────────────────────────────────────────────────────────

/**
 * Shipping Rate from ShipStation
 */
export interface SSRate {
  rateId: string;
  shipmentId: string;
  carrierId: string;
  carrierCode: string;
  serviceCode: string;
  serviceName: string;
  shipDate: string;
  negotiatedRate: number;
  baseRate: number;
  otherCost: number;
  insurance: number;
  confirmationAmount: number;
  zone: number;
  packageType?: string;
  deliveryDays?: number;
  guaranteedService: boolean;
  estimatedDeliveryDate?: string;
  currency: string;
}

/**
 * Request to get rates for a shipment
 */
export interface SSGetRatesRequest {
  carrierIds?: string[];
  serviceCodes?: string[];
  packages: Array<{
    weight: {
      value: number;
      units: "pounds" | "ounces" | "grams" | "kilograms";
    };
    dimensions?: {
      length: number;
      width: number;
      height: number;
      units: "inches" | "centimeters";
    };
    packageCode?: string;
  }>;
  shipFrom: SSAddress;
  shipTo: SSAddress;
  shipDate?: string;
  advancedOptions?: SSAdvancedOptions;
}

// ─── Carriers & Services ────────────────────────────────────────────

/**
 * Shipping Carrier
 */
export interface SSCarrier {
  carrierId: string;
  name: string;
  code: string;
  accountNumber?: string;
  requiresFundingAccount: boolean;
  balance: number;
  isAccount: boolean;
  nickname?: string;
}

/**
 * Service offered by a carrier
 */
export interface SSService {
  carrierId: string;
  carrierCode: string;
  code: string;
  name: string;
  domestic: boolean;
  international: boolean;
  baseCharge?: number;
}

/**
 * Package type offered by a carrier
 */
export interface SSPackage {
  carrierId: string;
  carrierCode: string;
  code: string;
  name: string;
}

// ─── Warehouses ─────────────────────────────────────────────────────

/**
 * Warehouse (origin address)
 */
export interface SSWarehouse {
  warehouseId: string;
  warehouseName: string;
  createDate: string;
  isDefault: boolean;
  returnAddress: SSAddress;
}

/**
 * Request to create a warehouse
 */
export interface SSCreateWarehouseRequest {
  warehouseName: string;
  returnAddress: SSAddress;
  isDefault?: boolean;
}

// ─── Stores ─────────────────────────────────────────────────────────

/**
 * Connected Store
 */
export interface SSStore {
  storeId: string;
  storeName: string;
  marketplaceId: string;
  accountName: string;
  email?: string;
  integrationUrl?: string;
  active: boolean;
  createDate: string;
}

// ─── Products ───────────────────────────────────────────────────────

/**
 * Product in ShipStation
 */
export interface SSProduct {
  productId: string;
  sku: string;
  title: string;
  aliases?: string[];
  description?: string;
  length?: number;
  width?: number;
  height?: number;
  weightOz?: number;
  weightLbs?: number;
  active: boolean;
  createDate: string;
  modifyDate: string;
  imageUrl?: string;
  tags?: string[];
  customFields?: Record<string, string>;
  variants?: SSProductVariant[];
}

/**
 * Product Variant
 */
export interface SSProductVariant {
  variantId: string;
  sku: string;
  title: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  cost?: number;
  length?: number;
  width?: number;
  height?: number;
  weightOz?: number;
  active: boolean;
}

/**
 * Request to update a product
 */
export interface SSUpdateProductRequest {
  title?: string;
  aliases?: string[];
  description?: string;
  length?: number;
  width?: number;
  height?: number;
  weightOz?: number;
  active?: boolean;
  customFields?: Record<string, string>;
}

// ─── Webhooks ───────────────────────────────────────────────────────

/**
 * Webhook subscription
 */
export interface SSWebhookSubscription {
  webhookId: string;
  url: string;
  eventType:
    | "ORDER_NOTIFY"
    | "ITEM_ORDER_NOTIFY"
    | "SHIP_NOTIFY"
    | "ITEM_SHIP_NOTIFY";
  active: boolean;
  createDate: string;
}

/**
 * Webhook payload for ORDER_NOTIFY
 */
export interface SSWebhookOrderPayload {
  eventType: "ORDER_NOTIFY";
  orderId: string;
  orderNumber: string;
  orderKey: string;
  createDate: string;
  modifyDate: string;
  orderStatus: string;
  customerId: string;
  customerEmail: string;
  shipTo: SSAddress;
  items: SSOrderItem[];
}

/**
 * Webhook payload for SHIP_NOTIFY
 */
export interface SSWebhookShipPayload {
  eventType: "SHIP_NOTIFY" | "ITEM_SHIP_NOTIFY";
  orderId: string;
  orderNumber: string;
  shipmentId: string;
  trackingNumber: string;
  carrierCode: string;
  serviceCode: string;
  shipDate: string;
  shipTo: SSAddress;
  shipFrom: SSAddress;
  weight: {
    value: number;
    units: string;
  };
  labelId?: string;
}

/**
 * Generic webhook payload
 */
export type SSWebhookPayload = SSWebhookOrderPayload | SSWebhookShipPayload;

/**
 * Request to subscribe to webhook
 */
export interface SSSubscribeWebhookRequest {
  url: string;
  eventType:
    | "ORDER_NOTIFY"
    | "ITEM_ORDER_NOTIFY"
    | "SHIP_NOTIFY"
    | "ITEM_SHIP_NOTIFY";
}

// ─── Batch Operations ───────────────────────────────────────────────

/**
 * Batch label creation
 */
export interface SSBatchRequest {
  labelFormat: "pdf" | "png" | "zpl" | "eppl";
  labelLayout: "4x6" | "4x8" | "letter";
  shipmentIds: string[];
}

/**
 * Batch status
 */
export interface SSBatchStatus {
  batchId: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdDate: string;
  processedDate?: string;
  failureReason?: string;
  labelLinks?: Array<{
    shipmentId: string;
    labelId: string;
    label: string;
  }>;
}

// ─── Pagination ─────────────────────────────────────────────────────

/**
 * Paginated response from ShipStation API
 */
export interface SSPaginatedResponse<T> {
  data: T[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  pages: number;
}

// ─── Error Response ────────────────────────────────────────────────

/**
 * ShipStation API error response
 */
export interface SSErrorResponse {
  requestId?: string;
  errors?: Array<{
    errorCode: string;
    message: string;
    fieldName?: string;
  }>;
  message?: string;
}

// ─── Rate Limit Headers ────────────────────────────────────────────

/**
 * Rate limit information from response headers
 */
export interface SSRateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}
