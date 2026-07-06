/**
 * WEX Fleet Card API Client
 *
 * Integration with WEX Fleet Card API for card management, transaction monitoring,
 * fuel price data, and real-time alerts.
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
 * WEX API response structure
 */
interface WEXResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Array<{ code: string; message: string }>;
}

/**
 * WEX OAuth token response
 */
interface WEXTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * WEX card response
 */
interface WEXCardResponse {
  cardId: string;
  cardNumber: string;
  last4: string;
  cardholderName: string;
  status: string;
  issuedDate: string;
  expirationDate: string;
  dailyLimit?: number;
  monthlyLimit?: number;
  driverId?: string;
  vehicleId?: string;
}

/**
 * WEX transaction response
 */
interface WEXTransactionResponse {
  transactionId: string;
  cardId: string;
  transactionDate: string;
  merchantName: string;
  amount: number;
  currency: string;
  fuelQuantity?: number;
  fuelType?: string;
  pricePerGallon?: number;
  status: string;
  approved: boolean;
  authCode?: string;
}

/**
 * WEX client implementation
 */
export class WEXClient extends FuelFleetAdapter {
  /** OAuth access token */
  private accessToken: string = "";

  /** Token expiration timestamp */
  private tokenExpiresAt: number = 0;

  /**
   * Initialize WEX client
   *
   * @param config - WEX configuration
   */
  constructor(config: FuelFleetConfig) {
    super(config);
    this.validateConfig();
  }

  /**
   * Validate WEX-specific configuration
   *
   * @throws Error if configuration is invalid
   */
  protected validateConfig(): void {
    super.validateConfig();

    if (!this.config.clientId) {
      throw new Error("WEX requires clientId");
    }

    if (!this.config.clientSecret) {
      throw new Error("WEX requires clientSecret");
    }

    if (!this.config.tokenUrl) {
      throw new Error("WEX requires tokenUrl");
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
              scope: "fleet_cards transactions",
            }).toString(),
          }),
        "WEX authentication",
      );

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = (await response.json()) as WEXTokenResponse;
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000;

      this.circuitBreaker.recordSuccess();
      return this.accessToken;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw new Error(
        `WEX authentication error: ${error instanceof Error ? error.message : String(error)}`,
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
    body?: unknown,
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
        `WEX ${method} ${endpoint}`,
      )) as Response;

      if (!response.ok) {
        const error = new Error(`API error: ${response.statusText}`);
        this.handleResponse(response, error);
        throw error;
      }

      const data = (await response.json()) as WEXResponse<T>;

      if (!data.success) {
        throw new Error(data.error || "WEX API error");
      }

      this.handleResponse(response);
      return data.data as T;
    } catch (error) {
      this.handleResponse(undefined, error as Error);
      throw error;
    }
  }

  /**
   * Issue a new WEX fuel card
   *
   * @param cardData - Card data
   * @returns Created fuel card
   */
  async issueCard(cardData: Partial<FuelCard>): Promise<FuelCard> {
    const response = await this.apiRequest<WEXCardResponse>(
      "/api/v1/cards/issue",
      "POST",
      {
        cardholderName: cardData.cardholderName,
        driverId: cardData.driverId,
        vehicleId: cardData.vehicleId,
        dailyLimit: cardData.dailyLimit,
        monthlyLimit: cardData.monthlyLimit,
      },
    );

    return this.mapWEXCardToFuelCard(response);
  }

  /**
   * Activate a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  async activateCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<WEXCardResponse>(
      `/api/v1/cards/${cardId}/activate`,
      "POST",
      {},
    );

    return this.mapWEXCardToFuelCard(response);
  }

  /**
   * Suspend a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  async suspendCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<WEXCardResponse>(
      `/api/v1/cards/${cardId}/suspend`,
      "POST",
      {},
    );

    return this.mapWEXCardToFuelCard(response);
  }

  /**
   * Close a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  async closeCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<WEXCardResponse>(
      `/api/v1/cards/${cardId}/close`,
      "POST",
      {},
    );

    return this.mapWEXCardToFuelCard(response);
  }

  /**
   * Get card information
   *
   * @param cardId - Card identifier
   * @returns Fuel card data
   */
  async getCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<WEXCardResponse>(
      `/api/v1/cards/${cardId}`,
    );

    return this.mapWEXCardToFuelCard(response);
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
    criteria?: Record<string, unknown>,
  ): Promise<FuelTransaction[]> {
    const params = new URLSearchParams();

    if (criteria) {
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    const endpoint = `/api/v1/cards/${cardId}/transactions?${params.toString()}`;
    const responses = await this.apiRequest<WEXTransactionResponse[]>(endpoint);

    return responses.map((response) =>
      this.mapWEXTransactionToFuelTransaction(response),
    );
  }

  /**
   * Get transaction details
   *
   * @param transactionId - Transaction identifier
   * @returns Transaction details
   */
  async getTransaction(transactionId: string): Promise<FuelTransaction> {
    const response = await this.apiRequest<WEXTransactionResponse>(
      `/api/v1/transactions/${transactionId}`,
    );

    return this.mapWEXTransactionToFuelTransaction(response);
  }

  /**
   * Create or update a fuel policy
   *
   * @param policy - Policy data
   * @returns Created/updated policy
   */
  async setPolicy(policy: Partial<FuelPolicy>): Promise<FuelPolicy> {
    const response = await this.apiRequest("/api/v1/policies", "POST", policy);

    return response as FuelPolicy;
  }

  /**
   * Get policy information
   *
   * @param policyId - Policy identifier
   * @returns Policy data
   */
  async getPolicy(policyId: string): Promise<FuelPolicy> {
    const response = await this.apiRequest(`/api/v1/policies/${policyId}`);

    return response as FuelPolicy;
  }

  /**
   * List fuel stations in WEX network
   *
   * @param criteria - Filter criteria
   * @returns Array of station locations
   */
  async listStations(
    criteria?: Record<string, unknown>,
  ): Promise<StationLocation[]> {
    const params = new URLSearchParams();

    if (criteria) {
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    const endpoint = `/api/v1/stations?${params.toString()}`;
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
    const endpoint = `/api/v1/prices/${fuelType}${query}`;
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
      `/api/v1/cards/${cardId}/fraud-alerts`,
    );

    return response;
  }

  /**
   * Assign card to driver or vehicle
   *
   * @param assignment - Assignment data
   * @returns Created assignment
   */
  async assignCard(
    assignment: Partial<CardAssignment>,
  ): Promise<CardAssignment> {
    const response = await this.apiRequest(
      "/api/v1/cards/assign",
      "POST",
      assignment,
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
      await this.apiRequest(`/api/v1/assignments/${assignmentId}`, "DELETE");
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
  async setPurchaseLimit(
    limit: Partial<PurchaseLimit>,
  ): Promise<PurchaseLimit> {
    const response = await this.apiRequest("/api/v1/limits", "POST", limit);

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
      `/api/v1/cards/${cardId}/limits`,
    );

    return limits;
  }

  /**
   * Get real-time transaction alerts
   *
   * @param cardId - Card identifier
   * @returns Alert data
   */
  async getRealTimeAlerts(cardId: string): Promise<Record<string, unknown>> {
    const alerts = await this.apiRequest<Record<string, unknown>>(
      `/api/v1/cards/${cardId}/alerts/realtime`,
    );

    return alerts;
  }

  /**
   * Get fleet analytics and reporting
   *
   * @param criteria - Reporting criteria
   * @returns Analytics data
   */
  async getAnalytics(
    criteria: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const params = new URLSearchParams();

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const endpoint = `/api/v1/analytics?${params.toString()}`;
    const analytics = await this.apiRequest<Record<string, unknown>>(endpoint);

    return analytics;
  }

  /**
   * Map WEX card response to FuelCard
   *
   * @param response - WEX card response
   * @returns FuelCard object
   */
  private mapWEXCardToFuelCard(response: WEXCardResponse): FuelCard {
    return {
      cardId: response.cardId,
      product: FuelCardProduct.WEX_FLEET,
      cardNumber: response.cardNumber,
      last4: response.last4,
      cardholderName: response.cardholderName,
      status: response.status as FuelCardStatus,
      issuedDate: new Date(response.issuedDate),
      expirationDate: new Date(response.expirationDate),
      driverId: response.driverId,
      vehicleId: response.vehicleId,
      dailyLimit: response.dailyLimit,
      monthlyLimit: response.monthlyLimit,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Map WEX transaction response to FuelTransaction
   *
   * @param response - WEX transaction response
   * @returns FuelTransaction object
   */
  private mapWEXTransactionToFuelTransaction(
    response: WEXTransactionResponse,
  ): FuelTransaction {
    return {
      transactionId: response.transactionId,
      cardId: response.cardId,
      transactionDate: new Date(response.transactionDate),
      merchantName: response.merchantName,
      merchantCategory: "fuel",
      amount: response.amount,
      currency: response.currency,
      fuelQuantity: response.fuelQuantity,
      fuelType: response.fuelType,
      pricePerGallon: response.pricePerGallon,
      status: response.status as TransactionStatus,
      authCode: response.authCode,
      approved: response.approved,
      createdAt: new Date(response.transactionDate),
      updatedAt: new Date(response.transactionDate),
    };
  }
}
