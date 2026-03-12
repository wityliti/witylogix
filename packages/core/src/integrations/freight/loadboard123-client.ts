/**
 * 123Loadboard API Client
 *
 * Integration with 123Loadboard for load and truck posting, carrier
 * credit reports, safety scoring, and rate calculation.
 */

import { fetch as nodeFetch } from "node-fetch";
import type { Response } from "node-fetch";

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
 * 123Loadboard API response structure
 */
interface LoadBoard123Response<T = unknown> {
  status: "success" | "error";
  data?: T;
  message?: string;
  errorCode?: string;
}

/**
 * 123Loadboard load posting response
 */
interface LoadBoard123LoadResponse {
  id: string;
  pickupLocation: {
    city: string;
    state: string;
    zip: string;
  };
  deliveryLocation: {
    city: string;
    state: string;
    zip: string;
  };
  equipmentType: string;
  weight: number;
  length: number;
  rate: number;
  pickupDate: string;
  deliveryDate: string;
  commodity: string;
  hazmat: boolean;
  status: string;
  postedAt: string;
}

/**
 * Carrier credit report
 */
interface CreditReport {
  usdotNumber: string;
  companyName: string;
  creditScore: number;
  verificationStatus: string;
  issueDate: string;
  expirationDate: string;
}

/**
 * Rate calculation request/response
 */
interface RateCalculation {
  origin: string;
  destination: string;
  distance: number;
  weight: number;
  equipment: string;
  estimatedRate: number;
  ratePerMile: number;
}

/**
 * 123Loadboard client implementation
 */
export class LoadBoard123Client extends FreightAdapter {
  /**
   * Initialize 123Loadboard client
   *
   * @param config - 123Loadboard configuration
   */
  constructor(config: FreightConfig) {
    super(config);
    this.validateConfig();
  }

  /**
   * Validate 123Loadboard-specific configuration
   *
   * @throws Error if configuration is invalid
   */
  protected validateConfig(): void {
    super.validateConfig();

    if (!this.config.apiKey) {
      throw new Error("123Loadboard requires apiKey");
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
    body?: unknown
  ): Promise<T> {
    await this.preRequestCheck();

    const url = new URL(endpoint, this.config.baseUrl).toString();

    try {
      const response = (await this.retryHandler.execute(
        () =>
          nodeFetch(url, {
            method,
            headers: {
              "X-API-Key": this.config.apiKey!,
              "Content-Type": "application/json",
              ...this.config.customHeaders,
            },
            body: body ? JSON.stringify(body) : undefined,
          }),
        `123Loadboard ${method} ${endpoint}`
      )) as Response;

      if (!response.ok) {
        const error = new Error(`API error: ${response.statusText}`);
        this.handleResponse(response, error);
        throw error;
      }

      const data = (await response.json()) as LoadBoard123Response<T>;

      if (data.status !== "success") {
        throw new Error(data.message || "123Loadboard API error");
      }

      this.handleResponse(response);
      return data.data as T;
    } catch (error) {
      this.handleResponse(undefined, error as Error);
      throw error;
    }
  }

  /**
   * Post a load to 123Loadboard
   *
   * @param load - Load posting data
   * @returns Created load posting
   */
  async postLoad(load: Partial<LoadPosting>): Promise<LoadPosting> {
    if (!load.origin || !load.destination) {
      throw new Error("Origin and destination are required");
    }

    const response = await this.apiRequest<LoadBoard123LoadResponse>(
      "/api/v1/loads",
      "POST",
      {
        pickupLocation: load.origin,
        deliveryLocation: load.destination,
        equipmentType: load.equipmentType,
        weight: load.weight,
        length: load.length,
        rate: load.rate,
        pickupDate: load.pickupDate?.toISOString(),
        deliveryDate: load.deliveryDate?.toISOString(),
        commodity: load.commodity,
        hazmat: load.isHazmat,
      }
    );

    return this.mapLoadBoard123LoadToLoadPosting(response);
  }

  /**
   * Search for available loads on 123Loadboard
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

    const endpoint = `/api/v1/loads?${params.toString()}`;
    const responses = await this.apiRequest<LoadBoard123LoadResponse[]>(endpoint);

    return responses.map((response) =>
      this.mapLoadBoard123LoadToLoadPosting(response)
    );
  }

  /**
   * Delete a load from 123Loadboard
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
   * Post a truck (capacity) to 123Loadboard
   *
   * @param truck - Truck posting data
   * @returns Created truck posting
   */
  async postTruck(truck: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await this.apiRequest(
      "/api/v1/trucks",
      "POST",
      truck
    );

    return response;
  }

  /**
   * Search for available trucks
   *
   * @param criteria - Search criteria
   * @returns Array of truck postings
   */
  async searchTrucks(criteria: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    const params = new URLSearchParams();

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const endpoint = `/api/v1/trucks?${params.toString()}`;
    const trucks = await this.apiRequest<Record<string, unknown>[]>(endpoint);

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
   * @param carrierId - Carrier identifier
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

    const endpoint = `/api/v1/carriers?${params.toString()}`;
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
      `/api/v1/carriers/${carrierId}/score`,
      "POST",
      {}
    );

    return carrier as CarrierProfile;
  }

  /**
   * Get credit report for a carrier
   *
   * @param usdotNumber - USDOT number
   * @returns Credit report data
   */
  async getCarrierCreditReport(usdotNumber: string): Promise<CreditReport> {
    const creditReport = await this.apiRequest(
      `/api/v1/credit-reports/${usdotNumber}`
    );

    return creditReport as CreditReport;
  }

  /**
   * Monitor carrier activity and status
   *
   * @param carrierId - Carrier identifier
   * @returns Carrier monitoring data
   */
  async monitorCarrier(carrierId: string): Promise<Record<string, unknown>> {
    const monitoring = await this.apiRequest(
      `/api/v1/carriers/${carrierId}/monitoring`
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
      `/api/v1/rates/lane?origin=${origin}&destination=${destination}`
    );

    return laneRate as LaneRate;
  }

  /**
   * Calculate freight rate
   *
   * @param rateParams - Rate calculation parameters
   * @returns Rate calculation result
   */
  async calculateRate(rateParams: Partial<RateCalculation>): Promise<RateCalculation> {
    const calculation = await this.apiRequest(
      "/api/v1/rates/calculate",
      "POST",
      rateParams
    );

    return calculation as RateCalculation;
  }

  /**
   * Get distance and routing information
   *
   * @param origin - Origin location
   * @param destination - Destination location
   * @returns Distance and routing data
   */
  async getRoutingInfo(
    origin: string,
    destination: string
  ): Promise<Record<string, unknown>> {
    const routing = await this.apiRequest(
      `/api/v1/routing?origin=${origin}&destination=${destination}`
    );

    return routing;
  }

  /**
   * Get tracking information for a shipment
   *
   * @param trackingNumber - Tracking number
   * @returns Shipment tracking data
   */
  async getTracking(trackingNumber: string): Promise<ShipmentTracking> {
    const tracking = await this.apiRequest(
      `/api/v1/shipments/${trackingNumber}`
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
   * Map 123Loadboard API response to LoadPosting
   *
   * @param response - 123Loadboard load response
   * @returns LoadPosting object
   */
  private mapLoadBoard123LoadToLoadPosting(
    response: LoadBoard123LoadResponse
  ): LoadPosting {
    return {
      loadId: response.id,
      origin: {
        city: response.pickupLocation.city,
        state: response.pickupLocation.state,
        postalCode: response.pickupLocation.zip,
        country: "US",
        address: "",
      },
      destination: {
        city: response.deliveryLocation.city,
        state: response.deliveryLocation.state,
        postalCode: response.deliveryLocation.zip,
        country: "US",
        address: "",
      },
      equipmentType: response.equipmentType as EquipmentType,
      weight: response.weight,
      length: response.length,
      pickupDate: new Date(response.pickupDate),
      deliveryDate: new Date(response.deliveryDate),
      rate: response.rate,
      commodity: response.commodity,
      isHazmat: response.hazmat,
      status: response.status as any,
      createdAt: new Date(response.postedAt),
      updatedAt: new Date(response.postedAt),
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
