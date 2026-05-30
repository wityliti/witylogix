/**
 * EFS (WEX Subsidiary) API Client
 *
 * Integration with EFS for card management, money codes, transaction processing,
 * location-based controls, and driver settlement.
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
 * EFS API response structure
 */
interface EFSResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
}

/**
 * EFS token authentication response
 */
interface EFSTokenResponse {
  token: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * EFS card response
 */
interface EFSCardResponse {
  cardId: string;
  panMasked: string;
  last4: string;
  cardholderName: string;
  status: string;
  issuedDate: string;
  expirationDate: string;
  dailyLimit?: number;
  monthlyLimit?: number;
  moneyCodeValue?: number;
  moneyCodeExpiry?: string;
  assignedDriver?: string;
  assignedVehicle?: string;
}

/**
 * EFS transaction response
 */
interface EFSTransactionResponse {
  txnId: string;
  cardId: string;
  txnDateTime: string;
  vendor: string;
  vendorLocation?: {
    city: string;
    state: string;
    zip: string;
    latitude?: number;
    longitude?: number;
  };
  amount: number;
  currency: string;
  productDescription: string;
  status: string;
  authorized: boolean;
  declineCode?: string;
}

/**
 * Money code for driver settlement
 */
interface MoneyCode {
  code: string;
  cardId: string;
  amount: number;
  createdDate: string;
  expiryDate: string;
  redeemed: boolean;
  redeemedDate?: string;
  status: string;
}

/**
 * EFS client implementation
 */
export class EFSClient extends FuelFleetAdapter {
  /** Authentication token */
  private token: string = "";

  /** Token expiration timestamp */
  private tokenExpiresAt: number = 0;

  /**
   * Initialize EFS client
   *
   * @param config - EFS configuration
   */
  constructor(config: FuelFleetConfig) {
    super(config);
    this.validateConfig();
  }

  /**
   * Validate EFS-specific configuration
   *
   * @throws Error if configuration is invalid
   */
  protected validateConfig(): void {
    super.validateConfig();

    if (!this.config.token) {
      throw new Error("EFS requires token");
    }
  }

  /**
   * Authenticate and obtain token
   *
   * @returns Authentication token
   * @throws Error if authentication fails
   */
  async authenticate(): Promise<string> {
    // Return cached token if valid
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    try {
      const response = await this.retryHandler.execute(
        () =>
          nodeFetch(new URL("/api/v1/auth/token", this.config.baseUrl).toString(), {
            method: "POST",
            headers: {
              "X-API-Token": this.config.token!,
              "Content-Type": "application/json",
            },
          }),
        "EFS authentication"
      );

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = (await response.json()) as EFSTokenResponse;
      this.token = data.token;
      this.tokenExpiresAt = Date.now() + data.expiresIn * 1000 - 60000;

      this.circuitBreaker.recordSuccess();
      return this.token;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw new Error(
        `EFS authentication error: ${error instanceof Error ? error.message : String(error)}`
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
        `EFS ${method} ${endpoint}`
      )) as Response;

      if (!response.ok) {
        const error = new Error(`API error: ${response.statusText}`);
        this.handleResponse(response, error);
        throw error;
      }

      const data = (await response.json()) as EFSResponse<T>;

      if (!data.success) {
        throw new Error(data.message || "EFS API error");
      }

      this.handleResponse(response);
      return data.data as T;
    } catch (error) {
      this.handleResponse(undefined, error as Error);
      throw error;
    }
  }

  /**
   * Issue a new EFS fuel card
   *
   * @param cardData - Card data
   * @returns Created fuel card
   */
  async issueCard(cardData: Partial<FuelCard>): Promise<FuelCard> {
    const response = await this.apiRequest<EFSCardResponse>(
      "/api/v1/cards/issue",
      "POST",
      {
        cardholderName: cardData.cardholderName,
        driverId: cardData.driverId,
        vehicleId: cardData.vehicleId,
        dailyLimit: cardData.dailyLimit,
        monthlyLimit: cardData.monthlyLimit,
      }
    );

    return this.mapEFSCardToFuelCard(response);
  }

  /**
   * Activate a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  async activateCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<EFSCardResponse>(
      `/api/v1/cards/${cardId}/activate`,
      "POST",
      {}
    );

    return this.mapEFSCardToFuelCard(response);
  }

  /**
   * Suspend a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  async suspendCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<EFSCardResponse>(
      `/api/v1/cards/${cardId}/suspend`,
      "POST",
      {}
    );

    return this.mapEFSCardToFuelCard(response);
  }

  /**
   * Close a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  async closeCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<EFSCardResponse>(
      `/api/v1/cards/${cardId}/close`,
      "POST",
      {}
    );

    return this.mapEFSCardToFuelCard(response);
  }

  /**
   * Get card information
   *
   * @param cardId - Card identifier
   * @returns Fuel card data
   */
  async getCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<EFSCardResponse>(
      `/api/v1/cards/${cardId}`
    );

    return this.mapEFSCardToFuelCard(response);
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

    const endpoint = `/api/v1/cards/${cardId}/transactions?${params.toString()}`;
    const responses = await this.apiRequest<EFSTransactionResponse[]>(endpoint);

    return responses.map((response) =>
      this.mapEFSTransactionToFuelTransaction(response)
    );
  }

  /**
   * Get transaction details
   *
   * @param transactionId - Transaction identifier
   * @returns Transaction details
   */
  async getTransaction(transactionId: string): Promise<FuelTransaction> {
    const response = await this.apiRequest<EFSTransactionResponse>(
      `/api/v1/transactions/${transactionId}`
    );

    return this.mapEFSTransactionToFuelTransaction(response);
  }

  /**
   * Create or update a fuel policy
   *
   * @param policy - Policy data
   * @returns Created/updated policy
   */
  async setPolicy(policy: Partial<FuelPolicy>): Promise<FuelPolicy> {
    const response = await this.apiRequest(
      "/api/v1/policies",
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
      `/api/v1/policies/${policyId}`
    );

    return response as FuelPolicy;
  }

  /**
   * List fuel stations in EFS network
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
      `/api/v1/cards/${cardId}/fraud-alerts`
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
      "/api/v1/assignments",
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
  async setPurchaseLimit(limit: Partial<PurchaseLimit>): Promise<PurchaseLimit> {
    const response = await this.apiRequest(
      "/api/v1/limits",
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
      `/api/v1/cards/${cardId}/limits`
    );

    return limits;
  }

  /**
   * Set location-based restrictions for a card
   *
   * @param cardId - Card identifier
   * @param restrictions - Location restrictions
   * @returns Updated card
   */
  async setLocationRestrictions(
    cardId: string,
    restrictions: Record<string, unknown>
  ): Promise<FuelCard> {
    const response = await this.apiRequest<EFSCardResponse>(
      `/api/v1/cards/${cardId}/location-restrictions`,
      "POST",
      restrictions
    );

    return this.mapEFSCardToFuelCard(response);
  }

  /**
   * Issue a money code for driver settlement
   *
   * @param cardId - Card identifier
   * @param amount - Amount for money code
   * @returns Created money code
   */
  async issueMoneyCode(cardId: string, amount: number): Promise<MoneyCode> {
    const response = await this.apiRequest<MoneyCode>(
      `/api/v1/cards/${cardId}/money-codes`,
      "POST",
      { amount }
    );

    return response;
  }

  /**
   * Redeem a money code
   *
   * @param code - Money code
   * @returns Redeemed money code
   */
  async redeemMoneyCode(code: string): Promise<MoneyCode> {
    const response = await this.apiRequest<MoneyCode>(
      `/api/v1/money-codes/${code}/redeem`,
      "POST",
      {}
    );

    return response;
  }

  /**
   * Get money code details
   *
   * @param code - Money code
   * @returns Money code data
   */
  async getMoneyCode(code: string): Promise<MoneyCode> {
    const response = await this.apiRequest<MoneyCode>(
      `/api/v1/money-codes/${code}`
    );

    return response;
  }

  /**
   * Map EFS card response to FuelCard
   *
   * @param response - EFS card response
   * @returns FuelCard object
   */
  private mapEFSCardToFuelCard(response: EFSCardResponse): FuelCard {
    return {
      cardId: response.cardId,
      product: FuelCardProduct.EFS,
      cardNumber: response.panMasked,
      last4: response.last4,
      cardholderName: response.cardholderName,
      status: response.status as FuelCardStatus,
      issuedDate: new Date(response.issuedDate),
      expirationDate: new Date(response.expirationDate),
      driverId: response.assignedDriver,
      vehicleId: response.assignedVehicle,
      dailyLimit: response.dailyLimit,
      monthlyLimit: response.monthlyLimit,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Map EFS transaction response to FuelTransaction
   *
   * @param response - EFS transaction response
   * @returns FuelTransaction object
   */
  private mapEFSTransactionToFuelTransaction(
    response: EFSTransactionResponse
  ): FuelTransaction {
    return {
      transactionId: response.txnId,
      cardId: response.cardId,
      transactionDate: new Date(response.txnDateTime),
      merchantName: response.vendor,
      merchantCategory: "fuel",
      merchantLocation: response.vendorLocation
        ? {
            city: response.vendorLocation.city,
            state: response.vendorLocation.state,
            zip: response.vendorLocation.zip,
            address: "",
            latitude: response.vendorLocation.latitude,
            longitude: response.vendorLocation.longitude,
          }
        : undefined,
      amount: response.amount,
      currency: response.currency,
      status: response.status as TransactionStatus,
      approved: response.authorized,
      declineReason: response.declineCode,
      createdAt: new Date(response.txnDateTime),
      updatedAt: new Date(response.txnDateTime),
    };
  }
}
