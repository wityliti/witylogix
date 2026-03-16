/**
 * Shippo REST API SDK Client
 *
 * Complete Shippo API v1 integration with:
 * - Multi-carrier shipping label creation and tracking
 * - Address validation and standardization
 * - Parcel templates and customs declarations
 * - Manifest and batch label generation
 * - Real-time tracking with webhook support
 * - Carrier account management
 *
 * Authentication: Bearer token (ShippoToken {api_key})
 * Base URL: https://api.goshippo.com/v1
 * Rate Limit: 100 requests/minute
 * Pagination: Cursor-based
 * Webhook Events: tracking_update, transaction_created, transaction_updated, batch_created
 * Test Mode: Use test token prefix (shippo_test_)
 */

import { createHmac } from "crypto";

// ─── Shippo API Response Types ──────────────────────────────────────

/**
 * Shippo address object
 */
export interface ShippoAddress {
  object_id: string;
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
  is_residential?: boolean;
  test?: boolean;
  validation_results?: {
    is_valid: boolean;
    messages: Array<{
      text: string;
      code: string;
    }>;
  };
}

/**
 * Shippo parcel object
 */
export interface ShippoParcel {
  object_id: string;
  length: string;
  width: string;
  height: string;
  distance_unit: string;
  weight: string;
  weight_unit: string;
  template?: string;
  test?: boolean;
}

/**
 * Shippo shipment object
 */
export interface ShippoShipment {
  object_id: string;
  order: string;
  status: string;
  address_from: ShippoAddress;
  address_to: ShippoAddress;
  parcels: ShippoParcel[];
  shipment_date: string;
  extra?: Record<string, unknown>;
  metadata?: string;
  test?: boolean;
}

/**
 * Shippo service level info
 */
export interface ShippoServiceLevel {
  name: string;
  token: string;
}

/**
 * Shippo rate object
 */
export interface ShippoRate {
  object_id: string;
  shipment: string;
  carrier_account: string;
  carrier: string;
  servicelevel: ShippoServiceLevel;
  rate: string;
  currency: string;
  list_rate: string;
  list_currency: string;
  provider: string;
  estimated_days: number;
  arrives_by: string;
  duration_terms: string;
  messages: string[];
  test?: boolean;
}

/**
 * Shippo location for tracking
 */
export interface ShippoLocation {
  city: string;
  state: string;
  zip: string;
  country: string;
}

/**
 * Shippo tracking history event
 */
export interface ShippoTrackingHistory {
  status: string;
  status_date: string;
  status_details: string;
  location?: ShippoLocation;
}

/**
 * Shippo track object
 */
export interface ShippoTrack {
  carrier: string;
  tracking_number: string;
  address_from?: ShippoAddress;
  address_to?: ShippoAddress;
  eta: string;
  servicelevel?: ShippoServiceLevel;
  status: string;
  tracking_history: ShippoTrackingHistory[];
  test?: boolean;
}

/**
 * Shippo label download URLs
 */
export interface ShippoLabelDownload {
  pdf?: string;
  png?: string;
  zpl?: string;
}

/**
 * Shippo tracking status object
 */
export interface ShippoTrackingStatus {
  status: string;
  status_date: string;
  status_details: string;
}

/**
 * Shippo transaction (purchased label)
 */
export interface ShippoTransaction {
  object_id: string;
  rate: string;
  tracking_number: string;
  tracking_status: ShippoTrackingStatus;
  label_download: ShippoLabelDownload;
  commercial_invoice_url?: string;
  test?: boolean;
}

/**
 * Shippo customs item
 */
export interface ShippoCustomsItem {
  object_id?: string;
  description: string;
  quantity: number;
  net_weight: string;
  mass_unit: string;
  value_amount: string;
  value_currency: string;
  origin_country: string;
  sku?: string;
  hs_code?: string;
}

/**
 * Shippo customs declaration
 */
export interface ShippoCustomsDeclaration {
  object_id?: string;
  contents_type: string;
  contents_explanation?: string;
  invoice: string;
  items: ShippoCustomsItem[];
  non_delivery_option: string;
  certify: boolean;
  certify_signer: string;
  disclaimer: boolean;
  aes_itn?: string;
  eel_pfc?: string;
}

/**
 * Shippo manifest (end-of-day form)
 */
export interface ShippoManifest {
  object_id: string;
  carrier_account: string;
  status: string;
  shipment_date: string;
  documents: Array<{
    page_size: string;
    url: string;
  }>;
  test?: boolean;
}

/**
 * Shippo carrier account
 */
export interface ShippoCarrierAccount {
  object_id: string;
  carrier: string;
  account_id: string;
  parameters: Record<string, unknown>;
  test?: boolean;
  active?: boolean;
}

/**
 * Shippo webhook event
 */
export interface ShippoWebhookEvent {
  event: string;
  data: Record<string, unknown>;
}

/**
 * Pagination result
 */
export interface ShippoPaginatedResult<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}

// ─── Shippo SDK Client ──────────────────────────────────────────────

/**
 * Shippo REST API SDK Client
 *
 * Complete implementation for Shippo shipping label creation, tracking,
 * and carrier management with full webhook and manifest support.
 *
 * @example
 * ```typescript
 * const shippo = new ShippoSDKClient({
 *   apiToken: 'shippo_test_...',
 *   baseUrl: 'https://api.goshippo.com/v1',
 *   timeout: 30000
 * });
 *
 * const shipment = await shippo.createShipment({
 *   from: fromAddress,
 *   to: toAddress,
 *   parcels: [{ weight: 1.5, dimensions: { length: 10, width: 8, height: 6 } }]
 * });
 *
 * const rates = await shippo.getRatesForShipment(shipment.object_id);
 * const label = await shippo.createTransaction(rates[0].object_id, 'pdf');
 * ```
 */
export class ShippoSDKClient {
  private baseUrl: string;
  private apiToken: string;
  private timeout: number;
  private rateLimitWindow = 60000; // 1 minute
  private maxRequestsPerWindow = 100;
  private requestTimestamps: number[] = [];

  constructor(config: {
    apiToken: string;
    baseUrl?: string;
    timeout?: number;
  }) {
    if (!config.apiToken) {
      throw new Error("Shippo API token is required");
    }
    this.apiToken = config.apiToken;
    this.baseUrl = config.baseUrl || "https://api.goshippo.com/v1";
    this.timeout = config.timeout || 30000;
  }

  /**
   * Create a new address
   *
   * @param address Address data
   * @param validate Whether to validate address (default: false)
   * @returns Created address object
   */
  async createAddress(
    address: {
      name: string;
      street1: string;
      street2?: string;
      city: string;
      state: string;
      zip: string;
      country: string;
      phone?: string;
      email?: string;
      is_residential?: boolean;
    },
    validate = false
  ): Promise<ShippoAddress> {
    const payload = {
      ...address,
      validate,
    };
    return this.request<ShippoAddress>("POST", "/addresses", payload);
  }

  /**
   * Validate an address
   *
   * @param address Address to validate
   * @returns Validation result with corrected address
   */
  async validateAddress(address: {
    street1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  }): Promise<ShippoAddress> {
    return this.request<ShippoAddress>("POST", "/addresses", {
      ...address,
      validate: true,
    });
  }

  /**
   * List addresses with pagination
   *
   * @param results Number of results (default: 25, max: 100)
   * @param cursor Pagination cursor
   * @returns Paginated address list
   */
  async listAddresses(
    results = 25,
    cursor?: string
  ): Promise<ShippoPaginatedResult<ShippoAddress>> {
    const params = new URLSearchParams();
    params.append("results", results.toString());
    if (cursor) {
      params.append("cursor", cursor);
    }
    return this.request<ShippoPaginatedResult<ShippoAddress>>(
      "GET",
      `/addresses?${params.toString()}`
    );
  }

  /**
   * Get a specific address by ID
   *
   * @param addressId Address object ID
   * @returns Address details
   */
  async getAddress(addressId: string): Promise<ShippoAddress> {
    return this.request<ShippoAddress>("GET", `/addresses/${addressId}`);
  }

  /**
   * Create a parcel with dimensions and weight
   *
   * @param parcel Parcel data
   * @returns Created parcel object
   */
  async createParcel(parcel: {
    length: number;
    width: number;
    height: number;
    distance_unit?: string; // cm, in
    weight: number;
    weight_unit?: string; // g, oz, lb, kg
    template?: string;
  }): Promise<ShippoParcel> {
    const payload = {
      length: parcel.length.toString(),
      width: parcel.width.toString(),
      height: parcel.height.toString(),
      distance_unit: parcel.distance_unit || "cm",
      weight: parcel.weight.toString(),
      weight_unit: parcel.weight_unit || "kg",
      template: parcel.template,
    };
    return this.request<ShippoParcel>("POST", "/parcels", payload);
  }

  /**
   * List parcel templates
   *
   * @returns List of available parcel templates
   */
  async listParcelTemplates(): Promise<ShippoPaginatedResult<ShippoParcel>> {
    return this.request<ShippoPaginatedResult<ShippoParcel>>(
      "GET",
      "/parcel_templates"
    );
  }

  /**
   * Create a shipment
   *
   * @param shipment Shipment data
   * @returns Created shipment object
   */
  async createShipment(shipment: {
    address_from: string; // address object_id
    address_to: string; // address object_id
    parcels: string[]; // parcel object_ids
    shipment_date?: string; // ISO 8601
    extra?: Record<string, unknown>;
    metadata?: string;
  }): Promise<ShippoShipment> {
    return this.request<ShippoShipment>("POST", "/shipments", shipment);
  }

  /**
   * List shipments with pagination
   *
   * @param results Number of results (default: 25)
   * @param cursor Pagination cursor
   * @returns Paginated shipment list
   */
  async listShipments(
    results = 25,
    cursor?: string
  ): Promise<ShippoPaginatedResult<ShippoShipment>> {
    const params = new URLSearchParams();
    params.append("results", results.toString());
    if (cursor) {
      params.append("cursor", cursor);
    }
    return this.request<ShippoPaginatedResult<ShippoShipment>>(
      "GET",
      `/shipments?${params.toString()}`
    );
  }

  /**
   * Get a specific shipment by ID
   *
   * @param shipmentId Shipment object ID
   * @returns Shipment details
   */
  async getShipment(shipmentId: string): Promise<ShippoShipment> {
    return this.request<ShippoShipment>("GET", `/shipments/${shipmentId}`);
  }

  /**
   * Get rates for a shipment
   *
   * @param shipmentId Shipment object ID
   * @param carrierAccounts Filter by carrier accounts (optional)
   * @param serviceLevels Filter by service levels (optional)
   * @returns List of available rates
   */
  async getRatesForShipment(
    shipmentId: string,
    carrierAccounts?: string[],
    serviceLevels?: string[]
  ): Promise<ShippoRate[]> {
    const params = new URLSearchParams();
    if (carrierAccounts?.length) {
      params.append("carrier_accounts", carrierAccounts.join(","));
    }
    if (serviceLevels?.length) {
      params.append("servicelevel_tokens", serviceLevels.join(","));
    }
    const url = `/shipments/${shipmentId}/rates${params.toString() ? `?${params}` : ""}`;
    const result = await this.request<ShippoPaginatedResult<ShippoRate>>(
      "GET",
      url
    );
    return result.results;
  }

  /**
   * Get a specific rate by ID
   *
   * @param rateId Rate object ID
   * @returns Rate details
   */
  async getRate(rateId: string): Promise<ShippoRate> {
    return this.request<ShippoRate>("GET", `/rates/${rateId}`);
  }

  /**
   * Create a transaction (purchase a label)
   *
   * @param rateId Rate object ID
   * @param labelFileType Label format: pdf, png, zpl
   * @returns Created transaction with label
   */
  async createTransaction(
    rateId: string,
    labelFileType: "pdf" | "png" | "zpl" = "pdf"
  ): Promise<ShippoTransaction> {
    return this.request<ShippoTransaction>("POST", "/transactions", {
      rate: rateId,
      label_file_type: labelFileType,
    });
  }

  /**
   * Get a transaction (label) by ID
   *
   * @param transactionId Transaction object ID
   * @returns Transaction details
   */
  async getTransaction(transactionId: string): Promise<ShippoTransaction> {
    return this.request<ShippoTransaction>(
      "GET",
      `/transactions/${transactionId}`
    );
  }

  /**
   * List transactions with pagination
   *
   * @param results Number of results (default: 25)
   * @param cursor Pagination cursor
   * @returns Paginated transaction list
   */
  async listTransactions(
    results = 25,
    cursor?: string
  ): Promise<ShippoPaginatedResult<ShippoTransaction>> {
    const params = new URLSearchParams();
    params.append("results", results.toString());
    if (cursor) {
      params.append("cursor", cursor);
    }
    return this.request<ShippoPaginatedResult<ShippoTransaction>>(
      "GET",
      `/transactions?${params.toString()}`
    );
  }

  /**
   * Get tracking information
   *
   * @param carrier Carrier slug (e.g., usps, fedex, ups)
   * @param trackingNumber Tracking number
   * @returns Tracking information
   */
  async getTracking(
    carrier: string,
    trackingNumber: string
  ): Promise<ShippoTrack> {
    return this.request<ShippoTrack>(
      "GET",
      `/tracks/${carrier}/${trackingNumber}`
    );
  }

  /**
   * Register tracking webhook for a shipment
   *
   * @param trackingNumber Tracking number
   * @param carrier Carrier slug
   * @param url Webhook URL
   * @returns Webhook registration result
   */
  async registerTrackingWebhook(
    trackingNumber: string,
    carrier: string,
    url: string
  ): Promise<{ id: string; url: string }> {
    return this.request<{ id: string; url: string }>(
      "POST",
      `/tracks/${carrier}/${trackingNumber}/register`,
      { url }
    );
  }

  /**
   * Create customs declaration
   *
   * @param declaration Customs declaration data
   * @returns Created customs declaration
   */
  async createCustomsDeclaration(
    declaration: Omit<ShippoCustomsDeclaration, "object_id">
  ): Promise<ShippoCustomsDeclaration> {
    return this.request<ShippoCustomsDeclaration>(
      "POST",
      "/customs/declarations",
      declaration
    );
  }

  /**
   * Get customs declaration by ID
   *
   * @param declarationId Declaration object ID
   * @returns Customs declaration details
   */
  async getCustomsDeclaration(
    declarationId: string
  ): Promise<ShippoCustomsDeclaration> {
    return this.request<ShippoCustomsDeclaration>(
      "GET",
      `/customs/declarations/${declarationId}`
    );
  }

  /**
   * Create a manifest (end-of-day scan form)
   *
   * @param manifest Manifest data
   * @returns Created manifest
   */
  async createManifest(manifest: {
    carrier_account: string;
    shipment_date: string;
    async?: boolean;
  }): Promise<ShippoManifest> {
    return this.request<ShippoManifest>("POST", "/manifests", manifest);
  }

  /**
   * Get manifest by ID
   *
   * @param manifestId Manifest object ID
   * @returns Manifest details
   */
  async getManifest(manifestId: string): Promise<ShippoManifest> {
    return this.request<ShippoManifest>("GET", `/manifests/${manifestId}`);
  }

  /**
   * List manifests with pagination
   *
   * @param results Number of results (default: 25)
   * @param cursor Pagination cursor
   * @returns Paginated manifest list
   */
  async listManifests(
    results = 25,
    cursor?: string
  ): Promise<ShippoPaginatedResult<ShippoManifest>> {
    const params = new URLSearchParams();
    params.append("results", results.toString());
    if (cursor) {
      params.append("cursor", cursor);
    }
    return this.request<ShippoPaginatedResult<ShippoManifest>>(
      "GET",
      `/manifests?${params.toString()}`
    );
  }

  /**
   * List carrier accounts
   *
   * @param results Number of results (default: 25)
   * @returns Paginated carrier account list
   */
  async listCarrierAccounts(
    results = 25
  ): Promise<ShippoPaginatedResult<ShippoCarrierAccount>> {
    return this.request<ShippoPaginatedResult<ShippoCarrierAccount>>(
      "GET",
      `/carrier_accounts?results=${results}`
    );
  }

  /**
   * Get carrier account by ID
   *
   * @param accountId Carrier account object ID
   * @returns Carrier account details
   */
  async getCarrierAccount(
    accountId: string
  ): Promise<ShippoCarrierAccount> {
    return this.request<ShippoCarrierAccount>(
      "GET",
      `/carrier_accounts/${accountId}`
    );
  }

  /**
   * Create carrier account
   *
   * @param account Carrier account data
   * @returns Created carrier account
   */
  async createCarrierAccount(account: {
    carrier: string;
    account_id: string;
    parameters: Record<string, unknown>;
  }): Promise<ShippoCarrierAccount> {
    return this.request<ShippoCarrierAccount>(
      "POST",
      "/carrier_accounts",
      account
    );
  }

  /**
   * Update carrier account
   *
   * @param accountId Carrier account object ID
   * @param updates Partial carrier account data
   * @returns Updated carrier account
   */
  async updateCarrierAccount(
    accountId: string,
    updates: Partial<ShippoCarrierAccount>
  ): Promise<ShippoCarrierAccount> {
    return this.request<ShippoCarrierAccount>(
      "PUT",
      `/carrier_accounts/${accountId}`,
      updates
    );
  }

  /**
   * Verify webhook signature (HMAC-SHA256)
   *
   * @param payload Raw webhook payload
   * @param signature Signature header value
   * @returns Whether signature is valid
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const hmac = createHmac("sha256", this.apiToken);
      hmac.update(payload);
      const computed = hmac.digest("hex");
      return computed === signature;
    } catch {
      return false;
    }
  }

  /**
   * Check if token is in test mode
   *
   * @returns True if using test token
   */
  isTestMode(): boolean {
    return this.apiToken.startsWith("shippo_test_");
  }

  /**
   * Health check
   *
   * @returns True if API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request<{ count: number }>("GET", "/addresses?results=1");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rate limiting helper
   */
  private enforceRateLimit(): void {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < this.rateLimitWindow
    );

    if (this.requestTimestamps.length >= this.maxRequestsPerWindow) {
      throw new Error(
        `Rate limit exceeded: ${this.maxRequestsPerWindow} requests per minute`
      );
    }

    this.requestTimestamps.push(now);
  }

  /**
   * Make HTTP request to Shippo API
   */
  private async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    this.enforceRateLimit();

    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `ShippoToken ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Shippo API error ${response.status}: ${errorText || response.statusText}`
        );
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}
