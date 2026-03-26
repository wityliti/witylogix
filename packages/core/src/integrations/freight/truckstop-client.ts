/**
 * Truckstop.com API Client
 *
 * Integration with Truckstop.com for load posting, carrier onboarding,
 * document management, and rate negotiation workflows.
 */

// Node 22+ has global fetch
const nodeFetch = globalThis.fetch;

import { FreightAdapter } from "./freight-adapter";
import type {
  FreightConfig,
  LoadPosting,
  FreightQuote,
  CarrierProfile,
  LaneRate,
  BookingConfirmation,
  ShipmentTracking,
  FreightInvoice,
  ComplianceDocument,
  EquipmentType,
} from "./types";

/**
 * Truckstop API response structure
 */
interface TruckstopResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

/**
 * Truckstop OAuth token response
 */
interface TruckstopTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Truckstop load posting response
 */
interface TruckstopLoadResponse {
  postId: string;
  origin: {
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  destination: {
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  shipmentDetails: {
    equipment: string;
    weight: number;
    length: number;
    commodity: string;
    hazmat: boolean;
  };
  pricing: {
    rate: number;
    currency: string;
  };
  dates: {
    pickupDate: string;
    deliveryDate: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Truckstop safety score data
 */
interface SafetyScore {
  overall: number;
  safetyFitness: number;
  driverFitness: number;
  vehicleMaintenance: number;
  hazmatCompliance: number;
  inspectionRatio: number;
}

/**
 * Truckstop client implementation
 */
export class TruckstopClient extends FreightAdapter {
  /** OAuth access token */
  private accessToken: string = "";

  /** Token expiration timestamp */
  private tokenExpiresAt: number = 0;

  /**
   * Initialize Truckstop client
   *
   * @param config - Truckstop configuration
   */
  constructor(config: FreightConfig) {
    super(config);
    this.validateConfig();
  }

  /**
   * Validate Truckstop-specific configuration
   *
   * @throws Error if configuration is invalid
   */
  protected validateConfig(): void {
    super.validateConfig();

    if (!this.config.clientId) {
      throw new Error("Truckstop requires clientId");
    }

    if (!this.config.clientSecret) {
      throw new Error("Truckstop requires clientSecret");
    }

    if (!this.config.tokenUrl) {
      throw new Error("Truckstop requires tokenUrl");
    }
  }

  /**
   * Authenticate and obtain access token
   *
   * @returns Access token
   * @throws Error if authentication fails
   */
  async authenticate(): Promise<string> {
    // Return cached token if valid
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await this.retryHandler.execute(
        () =>
          nodeFetch(this.config.tokenUrl!, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "client_credentials",
              client_id: this.config.clientId!,
              client_secret: this.config.clientSecret!,
              scope: "loadboard trucks",
            }).toString(),
          }),
        "Truckstop authentication"
      );

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = (await response.json()) as TruckstopTokenResponse;
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000;

      this.circuitBreaker.recordSuccess();
      return this.accessToken;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw new Error(
        `Truckstop authentication error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Make authenticated API request
   *
   * @param endpoint - API endpoint path
   * @param method - HTTP method
   * @param body - Request body
   * @returns Response data
   * @throws Error if request fails
   */
  private async apiRequest<T>(
    endpoint: string,
    method: string = "GET",
    body?: unknown
  ): Promise<T> {
    await this.preRequestCheck();

    const token = await this.authenticate();
    const url = new URL(endpoint, this.config.baseUrl).toString();

    try {
      const response = (await this.retryHandler.execute(
        () =>
          nodeFetch(url, {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              ...this.config.customHeaders,
            },
            body: body ? JSON.stringify(body) : undefined,
          }),
        `Truckstop ${method} ${endpoint}`
      )) as Response;

      if (!response.ok) {
        const error = new Error(`API error: ${response.statusText}`);
        this.handleResponse(response, error);
        throw error;
      }

      const data = (await response.json()) as TruckstopResponse<T>;

      if (!data.success) {
        throw new Error(data.message || "Truckstop API error");
      }

      this.handleResponse(response);
      return data.data as T;
    } catch (error) {
      this.handleResponse(undefined, error as Error);
      throw error;
    }
  }

  /**
   * Post a load to Truckstop.com
   *
   * @param load - Load posting data
   * @returns Created load posting
   */
  async postLoad(load: Partial<LoadPosting>): Promise<LoadPosting> {
    if (!load.origin || !load.destination) {
      throw new Error("Origin and destination are required");
    }

    const response = await this.apiRequest<TruckstopLoadResponse>(
      "/api/v1/loads",
      "POST",
      {
        origin: load.origin,
        destination: load.destination,
        shipmentDetails: {
          equipment: load.equipmentType,
          weight: load.weight,
          length: load.length,
          commodity: load.commodity,
          hazmat: load.isHazmat,
        },
        pricing: {
          rate: load.rate,
          currency: load.currency || "USD",
        },
        dates: {
          pickupDate: load.pickupDate?.toISOString(),
          deliveryDate: load.deliveryDate?.toISOString(),
        },
      }
    );

    return this.mapTruckstopLoadToLoadPosting(response);
  }

  /**
   * Search for available loads on Truckstop
   *
   * @param criteria - Search criteria
   * @returns Array of matching loads
   */
  async searchLoads(criteria: Record<string, unknown>): Promise<LoadPosting[]> {
    const params = new URLSearchParams();

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const endpoint = `/api/v1/loads/search?${params.toString()}`;
    const responses = await this.apiRequest<TruckstopLoadResponse[]>(endpoint);

    return responses.map((response) =>
      this.mapTruckstopLoadToLoadPosting(response)
    );
  }

  /**
   * Delete a load from Truckstop
   *
   * @param loadId - Load identifier
   * @returns Success status
   */
  async unpostLoad(loadId: string): Promise<boolean> {
    try {
      await this.apiRequest(`/api/v1/loads/${loadId}`, "DELETE");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Request a rate quote from a carrier
   *
   * @param loadId - Load identifier
   * @param carrierId - Carrier identifier
   * @returns Rate quote
   */
  async requestQuote(loadId: string, carrierId: string): Promise<FreightQuote> {
    const quote = await this.apiRequest(
      `/api/v1/loads/${loadId}/quotes`,
      "POST",
      {
        carrierId,
      }
    );

    return quote as FreightQuote;
  }

  /**
   * Get all quotes for a load
   *
   * @param loadId - Load identifier
   * @returns Array of quotes
   */
  async getQuotes(loadId: string): Promise<FreightQuote[]> {
    const quotes = await this.apiRequest<FreightQuote[]>(
      `/api/v1/loads/${loadId}/quotes`
    );

    return quotes;
  }

  /**
   * Accept a rate quote and create booking
   *
   * @param quoteId - Quote identifier
   * @returns Booking confirmation
   */
  async acceptQuote(quoteId: string): Promise<BookingConfirmation> {
    const confirmation = await this.apiRequest(
      `/api/v1/quotes/${quoteId}/accept`,
      "POST",
      {}
    );

    return confirmation as BookingConfirmation;
  }

  /**
   * Look up carrier information
   *
   * @param carrierId - Carrier identifier (USDOT number)
   * @returns Carrier profile
   */
  async getCarrier(carrierId: string): Promise<CarrierProfile> {
    const carrier = await this.apiRequest(
      `/api/v1/carriers/${carrierId}`
    );

    return carrier as CarrierProfile;
  }

  /**
   * Search for carriers
   *
   * @param criteria - Search criteria
   * @returns Array of carrier profiles
   */
  async searchCarriers(criteria: Record<string, unknown>): Promise<CarrierProfile[]> {
    const params = new URLSearchParams();

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const endpoint = `/api/v1/carriers/search?${params.toString()}`;
    const carriers = await this.apiRequest<CarrierProfile[]>(endpoint);

    return carriers;
  }

  /**
   * Score carrier using Truckstop safety data
   *
   * @param carrierId - Carrier identifier
   * @returns Carrier profile with ratings
   */
  async scoreCarrier(carrierId: string): Promise<CarrierProfile> {
    const carrier = await this.apiRequest(
      `/api/v1/carriers/${carrierId}/score`,
      "POST",
      {}
    );

    return carrier as CarrierProfile;
  }

  /**
   * Get safety score for a carrier
   *
   * @param usdotNumber - USDOT number
   * @returns Safety score data
   */
  async getCarrierSafetyScore(usdotNumber: string): Promise<SafetyScore> {
    const safetyScore = await this.apiRequest(
      `/api/v1/safety-scores/${usdotNumber}`
    );

    return safetyScore as SafetyScore;
  }

  /**
   * Get rate data for a lane
   *
   * @param origin - Origin state/city code
   * @param destination - Destination state/city code
   * @returns Lane rate information
   */
  async getLaneRate(origin: string, destination: string): Promise<LaneRate> {
    const laneRate = await this.apiRequest(
      `/api/v1/rates/lane?origin=${origin}&destination=${destination}`
    );

    return laneRate as LaneRate;
  }

  /**
   * Get tracking information for a shipment
   *
   * @param trackingNumber - Tracking number
   * @returns Shipment tracking data
   */
  async getTracking(trackingNumber: string): Promise<ShipmentTracking> {
    const tracking = await this.apiRequest(
      `/api/v1/shipments/${trackingNumber}/tracking`
    );

    return tracking as ShipmentTracking;
  }

  /**
   * Get invoice for a shipment
   *
   * @param loadId - Load identifier
   * @returns Freight invoice
   */
  async getInvoice(loadId: string): Promise<FreightInvoice> {
    const invoice = await this.apiRequest(
      `/api/v1/loads/${loadId}/invoice`
    );

    return invoice as FreightInvoice;
  }

  /**
   * Get compliance documents for a carrier
   *
   * @param carrierId - Carrier identifier
   * @returns Array of compliance documents
   */
  async getComplianceDocuments(carrierId: string): Promise<ComplianceDocument[]> {
    const documents = await this.apiRequest<ComplianceDocument[]>(
      `/api/v1/carriers/${carrierId}/documents`
    );

    return documents;
  }

  /**
   * Onboard a carrier to Truckstop
   *
   * @param carrierData - Carrier information
   * @returns Created carrier profile
   */
  async onboardCarrier(carrierData: Record<string, unknown>): Promise<CarrierProfile> {
    const carrier = await this.apiRequest(
      `/api/v1/carriers/onboard`,
      "POST",
      carrierData
    );

    return carrier as CarrierProfile;
  }

  /**
   * Upload compliance document for a carrier
   *
   * @param carrierId - Carrier identifier
   * @param document - Document data
   * @returns Uploaded document
   */
  async uploadComplianceDocument(
    carrierId: string,
    document: Record<string, unknown>
  ): Promise<ComplianceDocument> {
    const uploaded = await this.apiRequest(
      `/api/v1/carriers/${carrierId}/documents`,
      "POST",
      document
    );

    return uploaded as ComplianceDocument;
  }

  /**
   * Manage rate negotiation for a quote
   *
   * @param quoteId - Quote identifier
   * @param negotiationData - Negotiation details
   * @returns Updated quote
   */
  async negotiateRate(
    quoteId: string,
    negotiationData: Record<string, unknown>
  ): Promise<FreightQuote> {
    const quote = await this.apiRequest(
      `/api/v1/quotes/${quoteId}/negotiate`,
      "POST",
      negotiationData
    );

    return quote as FreightQuote;
  }

  /**
   * Accept rate negotiation for a quote
   *
   * @param quoteId - Quote identifier
   * @returns Updated quote
   */
  async acceptNegotiatedRate(quoteId: string): Promise<FreightQuote> {
    const quote = await this.apiRequest(
      `/api/v1/quotes/${quoteId}/accept-negotiation`,
      "POST",
      {}
    );

    return quote as FreightQuote;
  }

  /**
   * Map Truckstop API response to LoadPosting
   *
   * @param response - Truckstop load response
   * @returns LoadPosting object
   */
  private mapTruckstopLoadToLoadPosting(
    response: TruckstopLoadResponse
  ): LoadPosting {
    return {
      loadId: response.postId,
      origin: {
        city: response.origin.city,
        state: response.origin.state,
        postalCode: response.origin.zip,
        country: response.origin.country,
        address: "",
      },
      destination: {
        city: response.destination.city,
        state: response.destination.state,
        postalCode: response.destination.zip,
        country: response.destination.country,
        address: "",
      },
      equipmentType: response.shipmentDetails.equipment as EquipmentType,
      weight: response.shipmentDetails.weight,
      length: response.shipmentDetails.length,
      pickupDate: new Date(response.dates.pickupDate),
      deliveryDate: new Date(response.dates.deliveryDate),
      rate: response.pricing.rate,
      currency: response.pricing.currency,
      commodity: response.shipmentDetails.commodity,
      isHazmat: response.shipmentDetails.hazmat,
      status: response.status as any,
      createdAt: new Date(response.createdAt),
      updatedAt: new Date(response.updatedAt),
      shipper: {
        name: "",
        email: "",
        phone: "",
      },
      receiver: {
        name: "",
        email: "",
        phone: "",
      },
    };
  }
}
