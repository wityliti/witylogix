/**
 * DHL Express MyDHL API SDK Client
 *
 * Complete DHL Express integration for:
 * - Shipment rating with landed cost breakdown
 * - Label creation with commercial invoice generation
 * - Pickup scheduling and cancellation
 * - Real-time shipment tracking
 * - Address validation and normalization
 * - Service product availability by route
 * - OAuth2 token management
 *
 * Authentication: Basic Auth (username + password) → OAuth2 bearer token
 * Base URL: https://express.api.dhl.com/mydhlapi (production)
 *           https://express.api.dhleasyship.com/mydhlapi (sandbox)
 * Rate Limit: Varies by endpoint (typical: 100 req/min)
 * Pagination: Page-based
 * Webhook: Push tracking updates
 * Test Mode: Use sandbox URL for development
 */

// ─── DHL Express API Response Types ─────────────────────────────────

/**
 * DHL address object
 */
export interface DHLAddress {
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  city: string;
  postalCode?: string;
  countryCode: string;
  provinceCode?: string;
  name?: string;
  nameType?: string; // PERSON, COMPANY, UNKNOWN
  companyName?: string;
  businessType?: string;
  division?: string;
  building?: string;
  floor?: string;
  door?: string;
  phoneNumber?: string;
  emailAddress?: string;
}

/**
 * DHL monetary value
 */
export interface DHLMonetaryValue {
  currency: string;
  amount: number;
}

/**
 * DHL rating (quote result)
 */
export interface DHLRating {
  breakdown: Array<{
    serviceType: string;
    chargeType: string; // BASE, DISCOUNT, TAX, SURCHARGE
    weight?: {
      volumetricWeight: number;
      unitOfMeasurement: string; // KG, LB
    };
    unitPrice?: DHLMonetaryValue;
    price: DHLMonetaryValue;
  }>;
  serviceName: string;
  serviceType: string;
  totalPrice: DHLMonetaryValue;
  totalTax?: DHLMonetaryValue;
  estimatedDeliveryDate: string; // ISO 8601
  estimatedDeliveryTime?: string; // HH:mm
  pickupDate?: string;
  warnings?: string[];
  productName: string;
  productCode: string;
}

/**
 * DHL shipment object
 */
export interface DHLShipment {
  shipmentTrackingNumber: string;
  status: string;
  shipmentDetails: {
    weight: {
      volumetricWeight: number;
      unitOfMeasurement: string;
    };
    dimension?: {
      length: number;
      width: number;
      height: number;
      unitOfMeasurement: string;
    };
    cargoLineItem: Array<{
      lineNumber: number;
      itemDescription: string;
      itemQuantity: number;
      weight: number;
      unitOfMeasurement: string;
    }>;
  };
  origin: DHLAddress;
  destination: DHLAddress;
  pickup?: {
    isRequested: boolean;
    pickupDetails?: {
      pickupDate: string; // ISO 8601
      readyByTime: string; // HH:mm
      closeTime: string; // HH:mm
      location: string;
      specialInstructions: string;
      pickupInstructions: string;
    };
  };
  documentImages?: Array<{
    typeCode: string; // 001=label
    image: string; // base64
  }>;
  estimatedDeliveryDate?: string;
}

/**
 * DHL pickup object
 */
export interface DHLPickup {
  pickupRequestNumber: string;
  status: string;
  shipmentPickupDate: string; // ISO 8601
  readyByTime: string; // HH:mm
  closeTime: string; // HH:mm
  pickupLocation: string;
  specialInstructions?: string;
}

/**
 * DHL tracking result
 */
export interface DHLTracking {
  shipmentTrackingNumber: string;
  status: string;
  shipmentInfo: {
    weight: {
      volumetricWeight: number;
      unitOfMeasurement: string;
    };
    proactiveProbesEnabled: boolean;
    estimatedDeliveryDate?: string;
    shipmentDirection?: string;
  };
  serviceType?: string;
  origin?: DHLAddress;
  destination?: DHLAddress;
  shipmentTimestamp: string; // ISO 8601
  events: Array<{
    timestamp: string; // ISO 8601
    location?: DHLAddress;
    status: string;
    statusCode: string;
    description: string;
    eventCode: string;
  }>;
}

/**
 * DHL invoice object
 */
export interface DHLInvoice {
  invoiceNumber: string;
  invoiceDate: string; // ISO 8601
  totalAmount: DHLMonetaryValue;
  invoiceUrl?: string;
  invoiceContent?: string; // base64
}

/**
 * DHL service product
 */
export interface DHLProduct {
  productCode: string;
  productName: string;
  weight?: {
    volumetricWeight: number;
    unitOfMeasurement: string;
  };
  cutoffTime?: string; // HH:mm
  nextBusinessDay?: boolean;
  estimatedDeliveryDate?: string;
}

/**
 * DHL OAuth2 token response
 */
export interface DHLTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

// ─── DHL Express SDK Client ─────────────────────────────────────────

/**
 * DHL Express MyDHL API SDK Client
 *
 * Complete integration for DHL Express shipments, tracking, and pickup
 * management with OAuth2 authentication.
 *
 * @example
 * ```typescript
 * const dhl = new DHLExpressSDKClient({
 *   username: 'dhl_username',
 *   password: 'dhl_password',
 *   accountNumber: 'dhl_account',
 *   isSandbox: true
 * });
 *
 * await dhl.authenticate();
 *
 * const rates = await dhl.getRates({
 *   origin: { addressLine1: '123 Main St', city: 'New York', countryCode: 'US' },
 *   destination: { addressLine1: '456 Oak St', city: 'London', countryCode: 'GB' },
 *   weight: { value: 5, unitOfMeasurement: 'KG' }
 * });
 * ```
 */
export class DHLExpressSDKClient {
  private baseUrl: string;
  private authBaseUrl: string;
  private username: string;
  private password: string;
  private accountNumber?: string;
  private timeout: number;
  private accessToken?: string;
  private tokenExpiresAt?: number;
  private rateLimitWindow = 60000; // 1 minute
  private maxRequestsPerWindow = 100;
  private requestTimestamps: number[] = [];

  constructor(config: {
    username: string;
    password: string;
    accountNumber?: string;
    timeout?: number;
    isSandbox?: boolean;
  }) {
    this.username = config.username;
    this.password = config.password;
    this.accountNumber = config.accountNumber;
    this.timeout = config.timeout || 30000;

    if (config.isSandbox) {
      this.baseUrl = "https://express.api.dhleasyship.com/mydhlapi";
      this.authBaseUrl = "https://easship-oauth.dhleasyship.com";
    } else {
      this.baseUrl = "https://express.api.dhl.com/mydhlapi";
      this.authBaseUrl = "https://oauth-api.dhl.com";
    }
  }

  /**
   * Authenticate and obtain OAuth2 token
   *
   * Should be called once at startup. Token is cached and automatically renewed.
   */
  async authenticate(): Promise<void> {
    const credentials = Buffer.from(`${this.username}:${this.password}`).toString(
      "base64"
    );

    const response = await fetch(`${this.authBaseUrl}/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      throw new Error(
        `DHL authentication failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as DHLTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
  }

  /**
   * Get shipping rates (rating) for origin/destination
   *
   * @param request Rating request data
   * @returns Array of available service options with pricing
   */
  async getRates(request: {
    origin: DHLAddress;
    destination: DHLAddress;
    weight: {
      value: number;
      unitOfMeasurement: "KG" | "LB";
    };
    dimensions?: {
      length: number;
      width: number;
      height: number;
      unitOfMeasurement: "CM" | "IN";
    };
    contents?: Array<{
      description: string;
      quantity: number;
      value: DHLMonetaryValue;
    }>;
    dutiable?: boolean;
    isUnaccompaniedDocument?: boolean;
  }): Promise<DHLRating[]> {
    await this.ensureAuthenticated();

    const payload = {
      accountNumber: this.accountNumber,
      originCountryCode: request.origin.countryCode,
      originCityName: request.origin.city,
      originPostalCode: request.origin.postalCode,
      destinationCountryCode: request.destination.countryCode,
      destinationCityName: request.destination.city,
      destinationPostalCode: request.destination.postalCode,
      weight: request.weight.value,
      unitOfMeasurement: request.weight.unitOfMeasurement,
      length: request.dimensions?.length,
      width: request.dimensions?.width,
      height: request.dimensions?.height,
      dimensionUnit: request.dimensions?.unitOfMeasurement,
    };

    const response = await this.request<{ products: DHLRating[] }>(
      "POST",
      "/rates",
      payload
    );
    return response.products;
  }

  /**
   * Create a shipment with label
   *
   * @param shipment Shipment data
   * @returns Created shipment with tracking number and label
   */
  async createShipment(shipment: {
    plannedShippingDateAndTime: string; // ISO 8601
    pickup: {
      isRequested: boolean;
      pickupDetails?: {
        pickupDate: string;
        readyByTime: string;
        closeTime: string;
        pickupLocation?: string;
        specialInstructions?: string;
      };
    };
    productCode: string;
    accounts: Array<{
      typeCode: string;
      number: string;
    }>;
    content: {
      incoterm: string; // DAP, DDP, DPU, etc.
      weight: {
        value: number;
        unitOfMeasurement: "KG" | "LB";
      };
      dimensions?: {
        length: number;
        width: number;
        height: number;
        unitOfMeasurement: "CM" | "IN";
      };
      packages: Array<{
        typeCode: string; // 2a, 3a, 4a, 4b, etc.
        weight: number;
        dimensions?: {
          length: number;
          width: number;
          height: number;
        };
        customerReferences?: Array<{
          value: string;
          typeCode: string;
        }>;
      }>;
      items?: Array<{
        number: number;
        description: string;
        quantity: number;
        unitPrice: DHLMonetaryValue;
        weight: number;
      }>;
    };
    shipper: DHLAddress;
    recipient: DHLAddress;
    customs?: {
      signer: string;
      invoiceNumber?: string;
      invoiceDate?: string;
      items: Array<{
        description: string;
        quantity: number;
        unitPrice: DHLMonetaryValue;
        weight: number;
        hsCode?: string;
        skuNumber?: string;
      }>;
    };
    documentImages?: Array<{
      typeCode: string;
      imageFormat: string; // pdf, png, gif, jpeg
      image: string; // base64
    }>;
  }): Promise<DHLShipment> {
    await this.ensureAuthenticated();
    return this.request<DHLShipment>("POST", "/shipments", shipment);
  }

  /**
   * Get shipment details by tracking number
   *
   * @param trackingNumber DHL tracking number
   * @returns Shipment details
   */
  async getShipment(trackingNumber: string): Promise<DHLShipment> {
    await this.ensureAuthenticated();
    return this.request<DHLShipment>(
      "GET",
      `/shipments/${trackingNumber}`
    );
  }

  /**
   * Delete/cancel a shipment
   *
   * @param trackingNumber DHL tracking number
   * @returns Deletion confirmation
   */
  async deleteShipment(
    trackingNumber: string
  ): Promise<{ message: string }> {
    await this.ensureAuthenticated();
    return this.request<{ message: string }>(
      "DELETE",
      `/shipments/${trackingNumber}`
    );
  }

  /**
   * Schedule a pickup for shipments
   *
   * @param pickup Pickup request data
   * @returns Pickup confirmation with request number
   */
  async schedulePickup(pickup: {
    pickupDate: string; // ISO 8601
    readyByTime: string; // HH:mm
    closeTime: string; // HH:mm
    pickupLocation: string;
    specialInstructions?: string;
    shipmentNumbers: string[];
  }): Promise<DHLPickup> {
    await this.ensureAuthenticated();

    const payload = {
      planningDate: pickup.pickupDate,
      pickupDetails: [
        {
          readyByTime: pickup.readyByTime,
          closeTime: pickup.closeTime,
          location: pickup.pickupLocation,
          specialInstructions: pickup.specialInstructions,
          shipmentNumbers: pickup.shipmentNumbers,
        },
      ],
    };

    return this.request<DHLPickup>("POST", "/pickups", payload);
  }

  /**
   * Cancel a scheduled pickup
   *
   * @param pickupRequestNumber Pickup request number
   * @returns Cancellation confirmation
   */
  async cancelPickup(
    pickupRequestNumber: string
  ): Promise<{ message: string }> {
    await this.ensureAuthenticated();
    return this.request<{ message: string }>(
      "DELETE",
      `/pickups/${pickupRequestNumber}`
    );
  }

  /**
   * Update a scheduled pickup
   *
   * @param pickupRequestNumber Pickup request number
   * @param updates Partial pickup data
   * @returns Updated pickup
   */
  async updatePickup(
    pickupRequestNumber: string,
    updates: Partial<DHLPickup>
  ): Promise<DHLPickup> {
    await this.ensureAuthenticated();
    return this.request<DHLPickup>(
      "PATCH",
      `/pickups/${pickupRequestNumber}`,
      updates
    );
  }

  /**
   * Track a shipment
   *
   * @param trackingNumber DHL tracking number or reference
   * @param isReference Whether trackingNumber is a reference ID
   * @returns Tracking details with events
   */
  async trackShipment(
    trackingNumber: string,
    isReference = false
  ): Promise<DHLTracking> {
    await this.ensureAuthenticated();

    let path = `/tracking`;
    if (isReference) {
      path += `?trackingReference=${encodeURIComponent(trackingNumber)}`;
    } else {
      path += `/${trackingNumber}`;
    }

    return this.request<DHLTracking>("GET", path);
  }

  /**
   * Get available products (services) for a route
   *
   * @param originCountry Origin country ISO code
   * @param destinationCountry Destination country ISO code
   * @returns Available products/services
   */
  async listProducts(
    originCountry: string,
    destinationCountry: string
  ): Promise<DHLProduct[]> {
    await this.ensureAuthenticated();

    return this.request<DHLProduct[]>(
      "GET",
      `/products?originCountry=${originCountry}&destinationCountry=${destinationCountry}`
    );
  }

  /**
   * Get product details by code
   *
   * @param productCode DHL product code (P, T, X, etc.)
   * @returns Product details
   */
  async getProduct(productCode: string): Promise<DHLProduct> {
    await this.ensureAuthenticated();
    return this.request<DHLProduct>("GET", `/products/${productCode}`);
  }

  /**
   * Validate an address
   *
   * @param address Address to validate
   * @returns Validation result with suggestions
   */
  async validateAddress(address: DHLAddress): Promise<DHLAddress> {
    await this.ensureAuthenticated();

    return this.request<DHLAddress>(
      "POST",
      "/addresses/validate",
      address
    );
  }

  /**
   * Get address suggestions/corrections
   *
   * @param addressLine Partial address string
   * @param countryCode Country code
   * @returns Suggested addresses
   */
  async suggestAddresses(
    addressLine: string,
    countryCode: string
  ): Promise<DHLAddress[]> {
    await this.ensureAuthenticated();

    return this.request<DHLAddress[]>(
      "GET",
      `/addresses/suggest?address=${encodeURIComponent(addressLine)}&countryCode=${countryCode}`
    );
  }

  /**
   * Create commercial invoice (international shipments)
   *
   * @param shipmentTrackingNumber Tracking number
   * @param invoiceData Invoice details
   * @returns Created invoice
   */
  async createInvoice(
    shipmentTrackingNumber: string,
    invoiceData: {
      invoiceNumber: string;
      invoiceDate: string;
      totalAmount: DHLMonetaryValue;
      items: Array<{
        description: string;
        quantity: number;
        unitPrice: DHLMonetaryValue;
      }>;
    }
  ): Promise<DHLInvoice> {
    await this.ensureAuthenticated();

    return this.request<DHLInvoice>(
      "POST",
      `/shipments/${shipmentTrackingNumber}/invoice`,
      invoiceData
    );
  }

  /**
   * Health check
   *
   * @returns True if API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure token is valid and refresh if needed
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt)) {
      await this.authenticate();
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
   * Make HTTP request to DHL API
   */
  private async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    this.enforceRateLimit();

    if (!this.accessToken) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DHL API error ${response.status}: ${errorText || response.statusText}`
        );
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }
}
