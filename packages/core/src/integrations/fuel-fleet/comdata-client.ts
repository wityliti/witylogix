/**
 * Comdata API Client
 *
 * Integration with Comdata for card issuance, transaction monitoring,
 * money transfer, and fleet analytics.
 */

// Node 22+ has global fetch
const nodeFetch = globalThis.fetch;

import { FuelFleetAdapter } from "./fuel-fleet-adapter";
import { FuelCardProduct } from "./types";
import type {
  FuelFleetConfig,
  FuelCard,
  FuelTransaction,
  FuelPolicy,
  StationLocation,
  PriceData,
  CardAssignment,
  FraudAlert,
  PurchaseLimit,
  FuelCardStatus,
  TransactionStatus,
} from "./types";

/**
 * Comdata API response structure
 */
interface ComdataResponse<T = unknown> {
  status: "success" | "error";
  data?: T;
  message?: string;
  errorCode?: string;
}

/**
 * Comdata card response
 */
interface ComdataCardResponse {
  cardId: string;
  cardNumber: string;
  last4: string;
  holderName: string;
  cardStatus: string;
  issueDate: string;
  expiryDate: string;
  dailyLimit?: number;
  monthlyLimit?: number;
  assignedDriverId?: string;
  assignedVehicleId?: string;
  createdDate: string;
}

/**
 * Comdata transaction response
 */
interface ComdataTransactionResponse {
  transactionId: string;
  cardId: string;
  timestamp: string;
  vendor: string;
  vendorCode?: string;
  transactionAmount: number;
  currency: string;
  gallons?: number;
  fuelGrade?: string;
  unitPrice?: number;
  odometer?: number;
  checkCode?: string;
  status: string;
  authorized: boolean;
  declineReason?: string;
}

/**
 * Comdata client implementation
 */
export class ComdataClient extends FuelFleetAdapter {
  /**
   * Initialize Comdata client
   *
   * @param config - Comdata configuration
   */
  constructor(config: FuelFleetConfig) {
    super(config);
    this.validateConfig();
  }

  /**
   * Validate Comdata-specific configuration
   *
   * @throws Error if configuration is invalid
   */
  protected validateConfig(): void {
    super.validateConfig();

    if (!this.config.token) {
      throw new Error("Comdata requires token");
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

    const url = new URL(endpoint, this.config.baseUrl).toString();

    try {
      const response = (await this.retryHandler.execute(
        () =>
          nodeFetch(url, {
            method,
            headers: {
              "X-Auth-Token": this.config.token!,
              "Content-Type": "application/json",
              ...this.config.customHeaders,
            },
            body: body ? JSON.stringify(body) : undefined,
          }),
        `Comdata ${method} ${endpoint}`
      )) as Response;

      if (!response.ok) {
        const error = new Error(`API error: ${response.statusText}`);
        this.handleResponse(response, error);
        throw error;
      }

      const data = (await response.json()) as ComdataResponse<T>;

      if (data.status !== "success") {
        throw new Error(data.message || "Comdata API error");
      }

      this.handleResponse(response);
      return data.data as T;
    } catch (error) {
      this.handleResponse(undefined, error as Error);
      throw error;
    }
  }

  /**
   * Issue a new Comdata fuel card
   *
   * @param cardData - Card data
   * @returns Created fuel card
   */
  async issueCard(cardData: Partial<FuelCard>): Promise<FuelCard> {
    const response = await this.apiRequest<ComdataCardResponse>(
      "/api/cards/issue",
      "POST",
      {
        holderName: cardData.cardholderName,
        driverId: cardData.driverId,
        vehicleId: cardData.vehicleId,
        dailyLimit: cardData.dailyLimit,
        monthlyLimit: cardData.monthlyLimit,
      }
    );

    return this.mapComdataCardToFuelCard(response);
  }

  /**
   * Activate a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  async activateCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<ComdataCardResponse>(
      `/api/cards/${cardId}/activate`,
      "POST",
      {}
    );

    return this.mapComdataCardToFuelCard(response);
  }

  /**
   * Suspend a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  async suspendCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<ComdataCardResponse>(
      `/api/cards/${cardId}/suspend`,
      "POST",
      {}
    );

    return this.mapComdataCardToFuelCard(response);
  }

  /**
   * Close a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  async closeCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<ComdataCardResponse>(
      `/api/cards/${cardId}/close`,
      "POST",
      {}
    );

    return this.mapComdataCardToFuelCard(response);
  }

  /**
   * Get card information
   *
   * @param cardId - Card identifier
   * @returns Fuel card data
   */
  async getCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<ComdataCardResponse>(
      `/api/cards/${cardId}`
    );

    return this.mapComdataCardToFuelCard(response);
  }

  /**
   * Retrieve transactions for a card
   *
   * @param cardId - Card identifier
   * @param criteria - Filter criteria
   * @returns Array of transactions
   */
  async getTransactions(
    cardId: string,
    criteria?: Record<string, unknown>
  ): Promise<FuelTransaction[]> {
    const params = new URLSearchParams();

    if (criteria) {
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    const endpoint = `/api/cards/${cardId}/transactions?${params.toString()}`;
    const responses = await this.apiRequest<ComdataTransactionResponse[]>(endpoint);

    return responses.map((response) =>
      this.mapComdataTransactionToFuelTransaction(response)
    );
  }

  /**
   * Get transaction details
   *
   * @param transactionId - Transaction identifier
   * @returns Transaction details
   */
  async getTransaction(transactionId: string): Promise<FuelTransaction> {
    const response = await this.apiRequest<ComdataTransactionResponse>(
      `/api/transactions/${transactionId}`
    );

    return this.mapComdataTransactionToFuelTransaction(response);
  }

  /**
   * Create or update a fuel policy
   *
   * @param policy - Policy data
   * @returns Created/updated policy
   */
  async setPolicy(policy: Partial<FuelPolicy>): Promise<FuelPolicy> {
    const response = await this.apiRequest(
      "/api/policies",
      "POST",
      policy
    );

    return response as FuelPolicy;
  }

  /**
   * Get policy information
   *
   * @param policyId - Policy identifier
   * @returns Policy data
   */
  async getPolicy(policyId: string): Promise<FuelPolicy> {
    const response = await this.apiRequest(
      `/api/policies/${policyId}`
    );

    return response as FuelPolicy;
  }

  /**
   * List fuel stations in Comdata network
   *
   * @param criteria - Filter criteria
   * @returns Array of station locations
   */
  async listStations(criteria?: Record<string, unknown>): Promise<StationLocation[]> {
    const params = new URLSearchParams();

    if (criteria) {
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    const endpoint = `/api/stations?${params.toString()}`;
    const stations = await this.apiRequest<StationLocation[]>(endpoint);

    return stations;
  }

  /**
   * Get fuel price data
   *
   * @param fuelType - Fuel type
   * @param state - State code
   * @returns Price data
   */
  async getPrices(fuelType: string, state?: string): Promise<PriceData> {
    const query = state ? `?state=${state}` : "";
    const endpoint = `/api/prices/${fuelType}${query}`;
    const priceData = await this.apiRequest<PriceData>(endpoint);

    return priceData;
  }

  /**
   * Detect fraud and return alerts
   *
   * @param cardId - Card identifier
   * @returns Array of fraud alerts
   */
  async detectFraud(cardId: string): Promise<FraudAlert[]> {
    const response = await this.apiRequest<FraudAlert[]>(
      `/api/cards/${cardId}/fraud-alerts`
    );

    return response;
  }

  /**
   * Assign card to driver or vehicle
   *
   * @param assignment - Assignment data
   * @returns Created assignment
   */
  async assignCard(assignment: Partial<CardAssignment>): Promise<CardAssignment> {
    const response = await this.apiRequest(
      "/api/assignments",
      "POST",
      assignment
    );

    return response as CardAssignment;
  }

  /**
   * Unassign card from driver or vehicle
   *
   * @param assignmentId - Assignment identifier
   * @returns Success status
   */
  async unassignCard(assignmentId: string): Promise<boolean> {
    try {
      await this.apiRequest(`/api/assignments/${assignmentId}`, "DELETE");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set purchase limit for a card
   *
   * @param limit - Limit configuration
   * @returns Created/updated limit
   */
  async setPurchaseLimit(limit: Partial<PurchaseLimit>): Promise<PurchaseLimit> {
    const response = await this.apiRequest(
      "/api/limits",
      "POST",
      limit
    );

    return response as PurchaseLimit;
  }

  /**
   * Get card purchase limits
   *
   * @param cardId - Card identifier
   * @returns Array of purchase limits
   */
  async getPurchaseLimits(cardId: string): Promise<PurchaseLimit[]> {
    const limits = await this.apiRequest<PurchaseLimit[]>(
      `/api/cards/${cardId}/limits`
    );

    return limits;
  }

  /**
   * Get check code (authorization code lookup)
   *
   * @param checkCode - Check code from transaction
   * @returns Check code details
   */
  async getCheckCode(checkCode: string): Promise<Record<string, unknown>> {
    const details = await this.apiRequest<Record<string, unknown>>(
      `/api/check-codes/${checkCode}`
    );

    return details;
  }

  /**
   * Process driver advance/money transfer
   *
   * @param cardId - Card identifier
   * @param advanceData - Advance details
   * @returns Transfer result
   */
  async processAdvance(
    cardId: string,
    advanceData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const result = await this.apiRequest<Record<string, unknown>>(
      `/api/cards/${cardId}/advance`,
      "POST",
      advanceData
    );

    return result;
  }

  /**
   * Get fleet analytics
   *
   * @param criteria - Analytics criteria
   * @returns Analytics data
   */
  async getFleetAnalytics(criteria: Record<string, unknown>): Promise<Record<string, unknown>> {
    const params = new URLSearchParams();

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const endpoint = `/api/analytics?${params.toString()}`;
    const analytics = await this.apiRequest<Record<string, unknown>>(endpoint);

    return analytics;
  }

  /**
   * Map Comdata card response to FuelCard
   *
   * @param response - Comdata card response
   * @returns FuelCard object
   */
  private mapComdataCardToFuelCard(response: ComdataCardResponse): FuelCard {
    return {
      cardId: response.cardId,
      product: FuelCardProduct.COMDATA,
      cardNumber: response.cardNumber,
      last4: response.last4,
      cardholderName: response.holderName,
      status: response.cardStatus as FuelCardStatus,
      issuedDate: new Date(response.issueDate),
      expirationDate: new Date(response.expiryDate),
      driverId: response.assignedDriverId,
      vehicleId: response.assignedVehicleId,
      dailyLimit: response.dailyLimit,
      monthlyLimit: response.monthlyLimit,
      createdAt: new Date(response.createdDate),
      updatedAt: new Date(response.createdDate),
    };
  }

  /**
   * Map Comdata transaction response to FuelTransaction
   *
   * @param response - Comdata transaction response
   * @returns FuelTransaction object
   */
  private mapComdataTransactionToFuelTransaction(
    response: ComdataTransactionResponse
  ): FuelTransaction {
    return {
      transactionId: response.transactionId,
      cardId: response.cardId,
      transactionDate: new Date(response.timestamp),
      merchantName: response.vendor,
      merchantCode: response.vendorCode,
      merchantCategory: "fuel",
      amount: response.transactionAmount,
      currency: response.currency,
      fuelQuantity: response.gallons,
      fuelType: response.fuelGrade,
      pricePerGallon: response.unitPrice,
      odometer: response.odometer,
      status: response.status as TransactionStatus,
      approved: response.authorized,
      declineReason: response.declineReason,
      referenceNumber: response.checkCode,
      createdAt: new Date(response.timestamp),
      updatedAt: new Date(response.timestamp),
    };
  }
}
