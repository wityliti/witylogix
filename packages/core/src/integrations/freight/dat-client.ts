/**
 * DAT Load Board API Client
 *
 * Integration with DAT Load Board for posting, searching, and matching
 * loads with carriers. Includes rate analytics and carrier TMS integration.
 */

// Node 22+ has global fetch — resolve at call-time so tests can stub it
const nodeFetch = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);

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
 * DAT API response structure
 */
interface DATResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: string[];
}

/**
 * DAT OAuth token response
 */
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * DAT load posting response
 */
interface DATLoadResponse {
  id: string;
  origin: {
    city: string;
    state: string;
    zip: string;
  };
  destination: {
    city: string;
    state: string;
    zip: string;
  };
  equipment: string;
  weight: number;
  length: number;
  rate: number;
  pickupDate: string;
  deliveryDate: string;
  commodity: string;
  hazmat: boolean;
  status: string;
  createdAt: string;
}

/**
 * DAT client implementation
 */
export class DATClient extends FreightAdapter {
  /** OAuth access token */
  private accessToken: string = "";

  /** Token expiration timestamp */
  private tokenExpiresAt: number = 0;

  /**
   * Initialize DAT client
   *
   * @param config - DAT configuration
   */
  constructor(config: FreightConfig) {
    super(config);
    this.validateConfig();
  }

  /**
   * Validate DAT-specific configuration
   *
   * @throws Error if configuration is invalid
   */
  protected validateConfig(): void {
    super.validateConfig();

    if (!this.config.clientId) {
      throw new Error("DAT requires clientId");
    }

    if (!this.config.clientSecret) {
      throw new Error("DAT requires clientSecret");
    }

    if (!this.config.tokenUrl) {
      throw new Error("DAT requires tokenUrl");
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
            }).toString(),
          }),
        "DAT authentication"
      );

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = (await response.json()) as TokenResponse;
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000; // Refresh 1 min early

      this.circuitBreaker.recordSuccess();
      return this.accessToken;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw new Error(
        `DAT authentication error: ${error instanceof Error ? error.message : String(error)}`
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
        `DAT ${method} ${endpoint}`
      )) as Response;

      if (!response.ok) {
        const error = new Error(`API error: ${response.statusText}`);
        this.handleResponse(response, error);
        throw error;
      }

      const data = (await response.json()) as DATResponse<T>;

      if (!data.success) {
        throw new Error(data.error || "DAT API error");
      }

      this.handleResponse(response);
      return data.data as T;
    } catch (error) {
      this.handleResponse(undefined, error as Error);
      throw error;
    }
  }

  /**
   * Post a load to DAT Load Board
   *
   * @param load - Load posting data
   * @returns Created load posting
   */
  async postLoad(load: Partial<LoadPosting>): Promise<LoadPosting> {
    if (!load.origin || !load.destination) {
      throw new Error("Origin and destination are required");
    }

    const response = await this.apiRequest<DATLoadResponse>(
      "/loads",
      "POST",
      {
        origin: load.origin,
        destination: load.destination,
        equipment: load.equipmentType,
        weight: load.weight,
        length: load.length,
        rate: load.rate,
        pickupDate: load.pickupDate?.toISOString(),
        deliveryDate: load.deliveryDate?.toISOString(),
        commodity: load.commodity,
        hazmat: load.isHazmat,
        specialInstructions: load.specialInstructions,
      }
    );

    return this.mapDATLoadToLoadPosting(response);
  }

  /**
   * Search for available loads on DAT
   *
   * @param criteria - Search criteria (origin, destination, equipmentType, etc.)
   * @returns Array of matching loads
   */
  async searchLoads(criteria: Record<string, unknown>): Promise<LoadPosting[]> {
    const params = new URLSearchParams();

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const endpoint = `/loads/search?${params.toString()}`;
    const responses = await this.apiRequest<DATLoadResponse[]>(endpoint);

    return responses.map((response) =>
      this.mapDATLoadToLoadPosting(response)
    );
  }

  /**
   * Delete a load from DAT
   *
   * @param loadId - Load identifier
   * @returns Success status
   */
  async unpostLoad(loadId: string): Promise<boolean> {
    try {
      await this.apiRequest(`/loads/${loadId}`, "DELETE");
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
      `/loads/${loadId}/quotes`,
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
      `/loads/${loadId}/quotes`
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
      `/quotes/${quoteId}/accept`,
      "POST",
      {}
    );

    return confirmation as BookingConfirmation;
  }

  /**
   * Look up carrier information on DAT
   *
   * @param carrierId - Carrier identifier (USDOT number)
   * @returns Carrier profile
   */
  async getCarrier(carrierId: string): Promise<CarrierProfile> {
    const carrier = await this.apiRequest(
      `/carriers/${carrierId}`
    );

    return carrier as CarrierProfile;
  }

  /**
   * Search for carriers on DAT
   *
   * @param criteria - Search criteria (state, equipment, safety score, etc.)
   * @returns Array of carrier profiles
   */
  async searchCarriers(criteria: Record<string, unknown>): Promise<CarrierProfile[]> {
    const params = new URLSearchParams();

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const endpoint = `/carriers/search?${params.toString()}`;
    const carriers = await this.apiRequest<CarrierProfile[]>(endpoint);

    return carriers;
  }

  /**
   * Score and rate a carrier using DAT data
   *
   * @param carrierId - Carrier identifier
   * @returns Carrier profile with ratings
   */
  async scoreCarrier(carrierId: string): Promise<CarrierProfile> {
    const carrier = await this.apiRequest(
      `/carriers/${carrierId}/score`,
      "POST",
      {}
    );

    return carrier as CarrierProfile;
  }

  /**
   * Get rate data for a lane
   *
   * @param origin - Origin state or city code
   * @param destination - Destination state or city code
   * @returns Lane rate information
   */
  async getLaneRate(origin: string, destination: string): Promise<LaneRate> {
    const laneRate = await this.apiRequest(
      `/rates/lane?origin=${origin}&destination=${destination}`
    );

    return laneRate as LaneRate;
  }

  /**
   * Get historical rate analytics for a lane
   *
   * @param origin - Origin state
   * @param destination - Destination state
   * @param days - Number of days to analyze
   * @returns Rate trend data
   */
  async getLaneRateTrend(
    origin: string,
    destination: string,
    days: number = 30
  ): Promise<Record<string, unknown>> {
    const trends = await this.apiRequest(
      `/rates/trends?origin=${origin}&destination=${destination}&days=${days}`
    );

    return trends;
  }

  /**
   * Get rate volume analytics for a lane
   *
   * @param origin - Origin state
   * @param destination - Destination state
   * @returns Volume data
   */
  async getLaneVolume(origin: string, destination: string): Promise<Record<string, unknown>> {
    const volume = await this.apiRequest(
      `/rates/volume?origin=${origin}&destination=${destination}`
    );

    return volume;
  }

  /**
   * Get tracking information for a shipment
   *
   * @param trackingNumber - DAT tracking number
   * @returns Shipment tracking data
   */
  async getTracking(trackingNumber: string): Promise<ShipmentTracking> {
    const tracking = await this.apiRequest(
      `/shipments/${trackingNumber}/tracking`
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
      `/loads/${loadId}/invoice`
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
      `/carriers/${carrierId}/compliance`
    );

    return documents;
  }

  /**
   * Integrate with carrier TMS system
   *
   * @param carrierId - Carrier identifier
   * @param tmsData - TMS system data
   * @returns Integration result
   */
  async integrateCarrierTMS(
    carrierId: string,
    tmsData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const result = await this.apiRequest(
      `/carriers/${carrierId}/tms-integration`,
      "POST",
      tmsData
    );

    return result;
  }

  /**
   * Get broker-to-carrier matching recommendations
   *
   * @param loadId - Load identifier
   * @returns Matching recommendations
   */
  async getCarrierMatches(loadId: string): Promise<CarrierProfile[]> {
    const matches = await this.apiRequest<CarrierProfile[]>(
      `/loads/${loadId}/matches`
    );

    return matches;
  }

  /**
   * Map DAT API response to LoadPosting
   *
   * @param response - DAT load response
   * @returns LoadPosting object
   */
  private mapDATLoadToLoadPosting(response: DATLoadResponse): LoadPosting {
    return {
      loadId: response.id,
      origin: {
        city: response.origin.city,
        state: response.origin.state,
        postalCode: response.origin.zip,
        country: "US",
        address: "",
      },
      destination: {
        city: response.destination.city,
        state: response.destination.state,
        postalCode: response.destination.zip,
        country: "US",
        address: "",
      },
      equipmentType: response.equipment as EquipmentType,
      weight: response.weight,
      length: response.length,
      pickupDate: new Date(response.pickupDate),
      deliveryDate: new Date(response.deliveryDate),
      rate: response.rate,
      commodity: response.commodity,
      isHazmat: response.hazmat,
      status: response.status as any,
      createdAt: new Date(response.createdAt),
      updatedAt: new Date(response.createdAt),
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
