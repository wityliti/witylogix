/**
 * Direct Freight API Client
 *
 * Integration with Direct Freight API for load posting, truck posting,
 * rate estimates, carrier search, and fleet management.
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
 * Direct Freight API response structure
 */
interface DirectFreightResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

/**
 * Direct Freight load posting response
 */
interface DirectFreightLoadResponse {
  loadId: string;
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
  pickupDateTime: string;
  deliveryDateTime: string;
  commodity: string;
  hazmat: boolean;
  status: string;
  postedDate: string;
  expiresDate: string;
}

/**
 * Direct Freight truck posting response
 */
interface DirectFreightTruckResponse {
  truckId: string;
  carrierName: string;
  equipment: string;
  origin: {
    city: string;
    state: string;
  };
  destination: {
    city: string;
    state: string;
  };
  rate: number;
  availableDate: string;
  status: string;
}

/**
 * Rate estimate data
 */
interface RateEstimate {
  origin: string;
  destination: string;
  equipment: string;
  weight: number;
  estimatedRate: number;
  rateRange: {
    low: number;
    high: number;
  };
}

/**
 * Direct Freight client implementation
 */
export class DirectFreightClient extends FreightAdapter {
  /**
   * Initialize Direct Freight client
   *
   * @param config - Direct Freight configuration
   */
  constructor(config: FreightConfig) {
    super(config);
    this.validateConfig();
  }

  /**
   * Validate Direct Freight-specific configuration
   *
   * @throws Error if configuration is invalid
   */
  protected validateConfig(): void {
    super.validateConfig();

    if (!this.config.apiKey) {
      throw new Error("Direct Freight requires apiKey");
    }
  }

  /**
   * Make API request with API key authentication
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
    body?: unknown,
  ): Promise<T> {
    await this.preRequestCheck();

    const url = new URL(endpoint, this.config.baseUrl).toString();

    try {
      const response = (await this.retryHandler.execute(
        () =>
          nodeFetch(url, {
            method,
            headers: {
              Authorization: `Bearer ${this.config.apiKey!}`,
              "Content-Type": "application/json",
              ...this.config.customHeaders,
            },
            body: body ? JSON.stringify(body) : undefined,
          }),
        `Direct Freight ${method} ${endpoint}`,
      )) as Response;

      if (!response.ok) {
        const error = new Error(`API error: ${response.statusText}`);
        this.handleResponse(response, error);
        throw error;
      }

      const data = (await response.json()) as DirectFreightResponse<T>;

      if (!data.ok) {
        throw new Error(data.error || "Direct Freight API error");
      }

      this.handleResponse(response);
      return data.data as T;
    } catch (error) {
      this.handleResponse(undefined, error as Error);
      throw error;
    }
  }

  /**
   * Post a load to Direct Freight
   *
   * @param load - Load posting data
   * @returns Created load posting
   */
  async postLoad(load: Partial<LoadPosting>): Promise<LoadPosting> {
    if (!load.origin || !load.destination) {
      throw new Error("Origin and destination are required");
    }

    const response = await this.apiRequest<DirectFreightLoadResponse>(
      "/api/loads",
      "POST",
      {
        origin: load.origin,
        destination: load.destination,
        equipment: load.equipmentType,
        weight: load.weight,
        length: load.length,
        rate: load.rate,
        pickupDateTime: load.pickupDate?.toISOString(),
        deliveryDateTime: load.deliveryDate?.toISOString(),
        commodity: load.commodity,
        hazmat: load.isHazmat,
      },
    );

    return this.mapDirectFreightLoadToLoadPosting(response);
  }

  /**
   * Search for available loads
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

    const endpoint = `/api/loads?${params.toString()}`;
    const responses =
      await this.apiRequest<DirectFreightLoadResponse[]>(endpoint);

    return responses.map((response) =>
      this.mapDirectFreightLoadToLoadPosting(response),
    );
  }

  /**
   * Delete a load from Direct Freight
   *
   * @param loadId - Load identifier
   * @returns Success status
   */
  async unpostLoad(loadId: string): Promise<boolean> {
    try {
      await this.apiRequest(`/api/loads/${loadId}`, "DELETE");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Post a truck to Direct Freight
   *
   * @param truck - Truck posting data
   * @returns Created truck posting
   */
  async postTruck(
    truck: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await this.apiRequest<Record<string, unknown>>(
      "/api/trucks",
      "POST",
      truck,
    );

    return response;
  }

  /**
   * Search for trucks
   *
   * @param criteria - Search criteria
   * @returns Array of truck postings
   */
  async searchTrucks(
    criteria: Record<string, unknown>,
  ): Promise<DirectFreightTruckResponse[]> {
    const params = new URLSearchParams();

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const endpoint = `/api/trucks?${params.toString()}`;
    const trucks =
      await this.apiRequest<DirectFreightTruckResponse[]>(endpoint);

    return trucks;
  }

  /**
   * Request a rate quote from a carrier
   *
   * @param loadId - Load identifier
   * @param carrierId - Carrier identifier
   * @returns Rate quote
   */
  async requestQuote(loadId: string, carrierId: string): Promise<FreightQuote> {
    const quote = await this.apiRequest(`/api/loads/${loadId}/quotes`, "POST", {
      carrierId,
    });

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
      `/api/loads/${loadId}/quotes`,
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
      `/api/quotes/${quoteId}/accept`,
      "POST",
      {},
    );

    return confirmation as BookingConfirmation;
  }

  /**
   * Get rate estimate for a lane
   *
   * @param rateParams - Rate estimate parameters
   * @returns Rate estimate data
   */
  async getRateEstimate(
    rateParams: Partial<RateEstimate>,
  ): Promise<RateEstimate> {
    const estimate = await this.apiRequest(
      "/api/rates/estimate",
      "POST",
      rateParams,
    );

    return estimate as RateEstimate;
  }

  /**
   * Look up carrier information
   *
   * @param carrierId - Carrier identifier
   * @returns Carrier profile
   */
  async getCarrier(carrierId: string): Promise<CarrierProfile> {
    const carrier = await this.apiRequest(`/api/carriers/${carrierId}`);

    return carrier as CarrierProfile;
  }

  /**
   * Search for carriers
   *
   * @param criteria - Search criteria
   * @returns Array of carrier profiles
   */
  async searchCarriers(
    criteria: Record<string, unknown>,
  ): Promise<CarrierProfile[]> {
    const params = new URLSearchParams();

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const endpoint = `/api/carriers?${params.toString()}`;
    const carriers = await this.apiRequest<CarrierProfile[]>(endpoint);

    return carriers;
  }

  /**
   * Score carrier based on available data
   *
   * @param carrierId - Carrier identifier
   * @returns Carrier profile with ratings
   */
  async scoreCarrier(carrierId: string): Promise<CarrierProfile> {
    const carrier = await this.apiRequest(
      `/api/carriers/${carrierId}/score`,
      "POST",
      {},
    );

    return carrier as CarrierProfile;
  }

  /**
   * Monitor carrier activity
   *
   * @param carrierId - Carrier identifier
   * @returns Carrier monitoring data
   */
  async monitorCarrier(carrierId: string): Promise<Record<string, unknown>> {
    const monitoring = await this.apiRequest<Record<string, unknown>>(
      `/api/carriers/${carrierId}/monitoring`,
    );

    return monitoring;
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
      `/api/rates/lane?origin=${origin}&destination=${destination}`,
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
    const tracking = await this.apiRequest(`/api/shipments/${trackingNumber}`);

    return tracking as ShipmentTracking;
  }

  /**
   * Get invoice for a shipment
   *
   * @param loadId - Load identifier
   * @returns Freight invoice
   */
  async getInvoice(loadId: string): Promise<FreightInvoice> {
    const invoice = await this.apiRequest(`/api/loads/${loadId}/invoice`);

    return invoice as FreightInvoice;
  }

  /**
   * Get compliance documents for a carrier
   *
   * @param carrierId - Carrier identifier
   * @returns Array of compliance documents
   */
  async getComplianceDocuments(
    carrierId: string,
  ): Promise<ComplianceDocument[]> {
    const documents = await this.apiRequest<ComplianceDocument[]>(
      `/api/carriers/${carrierId}/documents`,
    );

    return documents;
  }

  /**
   * Manage fleet for a carrier
   *
   * @param carrierId - Carrier identifier
   * @param fleetData - Fleet management data
   * @returns Updated fleet data
   */
  async manageFleet(
    carrierId: string,
    fleetData: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const fleet = await this.apiRequest<Record<string, unknown>>(
      `/api/carriers/${carrierId}/fleet`,
      "POST",
      fleetData,
    );

    return fleet;
  }

  /**
   * Get fleet information for a carrier
   *
   * @param carrierId - Carrier identifier
   * @returns Fleet data
   */
  async getFleet(carrierId: string): Promise<Record<string, unknown>> {
    const fleet = await this.apiRequest<Record<string, unknown>>(
      `/api/carriers/${carrierId}/fleet`,
    );

    return fleet;
  }

  /**
   * Map Direct Freight API response to LoadPosting
   *
   * @param response - Direct Freight load response
   * @returns LoadPosting object
   */
  private mapDirectFreightLoadToLoadPosting(
    response: DirectFreightLoadResponse,
  ): LoadPosting {
    return {
      loadId: response.loadId,
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
      pickupDate: new Date(response.pickupDateTime),
      deliveryDate: new Date(response.deliveryDateTime),
      rate: response.rate,
      commodity: response.commodity,
      isHazmat: response.hazmat,
      status: response.status as any,
      createdAt: new Date(response.postedDate),
      updatedAt: new Date(response.postedDate),
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
