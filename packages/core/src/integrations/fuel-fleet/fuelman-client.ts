/**
 * Fuelman API Client
 *
 * Integration with Fuelman for card management, driver assignments,
 * purchase controls, and fuel tax reporting (IFTA).
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
 * Fuelman API response structure
 */
interface FuelmanResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/**
 * Fuelman card response
 */
interface FuelmanCardResponse {
  id: string;
  cardNumber: string;
  lastFour: string;
  driverName: string;
  status: string;
  activeDate: string;
  expiryDate: string;
  singleTransactionLimit?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
  assignedDriver?: string;
  assignedVehicle?: string;
}

/**
 * Fuelman transaction response
 */
interface FuelmanTransactionResponse {
  transactionId: string;
  cardId: string;
  transactionDateTime: string;
  productDescription: string;
  transactionAmount: number;
  currency: string;
  gallons?: number;
  fuelType?: string;
  unitPrice?: number;
  merchantName: string;
  merchantCity: string;
  merchantState: string;
  transactionStatus: string;
  approved: boolean;
  declineCode?: string;
}

/**
 * IFTA (International Fuel Tax Agreement) report
 */
interface IFTAReport {
  reportId: string;
  periodStart: string;
  periodEnd: string;
  taxableGallons: number;
  federalTax: number;
  stateTaxes: Record<string, number>;
  totalTax: number;
  reportStatus: string;
  generatedDate: string;
}

/**
 * Fuelman client implementation
 */
export class FuelmanClient extends FuelFleetAdapter {
  /**
   * Initialize Fuelman client
   *
   * @param config - Fuelman configuration
   */
  constructor(config: FuelFleetConfig) {
    super(config);
    this.validateConfig();
  }

  /**
   * Validate Fuelman-specific configuration
   *
   * @throws Error if configuration is invalid
   */
  protected validateConfig(): void {
    super.validateConfig();

    if (!this.config.apiKey) {
      throw new Error("Fuelman requires apiKey");
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
        `Fuelman ${method} ${endpoint}`,
      )) as Response;

      if (!response.ok) {
        const error = new Error(`API error: ${response.statusText}`);
        this.handleResponse(response, error);
        throw error;
      }

      const data = (await response.json()) as FuelmanResponse<T>;

      if (!data.success) {
        throw new Error(data.error || "Fuelman API error");
      }

      this.handleResponse(response);
      return data.data as T;
    } catch (error) {
      this.handleResponse(undefined, error as Error);
      throw error;
    }
  }

  /**
   * Issue a new Fuelman fuel card
   *
   * @param cardData - Card data
   * @returns Created fuel card
   */
  async issueCard(cardData: Partial<FuelCard>): Promise<FuelCard> {
    const response = await this.apiRequest<FuelmanCardResponse>(
      "/api/v2/cards/issue",
      "POST",
      {
        driverName: cardData.cardholderName,
        driverId: cardData.driverId,
        vehicleId: cardData.vehicleId,
        singleTransactionLimit: cardData.dailyLimit,
        monthlyLimit: cardData.monthlyLimit,
      },
    );

    return this.mapFuelmanCardToFuelCard(response);
  }

  /**
   * Activate a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  async activateCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<FuelmanCardResponse>(
      `/api/v2/cards/${cardId}/activate`,
      "POST",
      {},
    );

    return this.mapFuelmanCardToFuelCard(response);
  }

  /**
   * Suspend a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  async suspendCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<FuelmanCardResponse>(
      `/api/v2/cards/${cardId}/suspend`,
      "POST",
      {},
    );

    return this.mapFuelmanCardToFuelCard(response);
  }

  /**
   * Close a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  async closeCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<FuelmanCardResponse>(
      `/api/v2/cards/${cardId}/close`,
      "POST",
      {},
    );

    return this.mapFuelmanCardToFuelCard(response);
  }

  /**
   * Get card information
   *
   * @param cardId - Card identifier
   * @returns Fuel card data
   */
  async getCard(cardId: string): Promise<FuelCard> {
    const response = await this.apiRequest<FuelmanCardResponse>(
      `/api/v2/cards/${cardId}`,
    );

    return this.mapFuelmanCardToFuelCard(response);
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

    const endpoint = `/api/v2/cards/${cardId}/transactions?${params.toString()}`;
    const responses =
      await this.apiRequest<FuelmanTransactionResponse[]>(endpoint);

    return responses.map((response) =>
      this.mapFuelmanTransactionToFuelTransaction(response),
    );
  }

  /**
   * Get transaction details
   *
   * @param transactionId - Transaction identifier
   * @returns Transaction details
   */
  async getTransaction(transactionId: string): Promise<FuelTransaction> {
    const response = await this.apiRequest<FuelmanTransactionResponse>(
      `/api/v2/transactions/${transactionId}`,
    );

    return this.mapFuelmanTransactionToFuelTransaction(response);
  }

  /**
   * Create or update a fuel policy
   *
   * @param policy - Policy data
   * @returns Created/updated policy
   */
  async setPolicy(policy: Partial<FuelPolicy>): Promise<FuelPolicy> {
    const response = await this.apiRequest("/api/v2/policies", "POST", policy);

    return response as FuelPolicy;
  }

  /**
   * Get policy information
   *
   * @param policyId - Policy identifier
   * @returns Policy data
   */
  async getPolicy(policyId: string): Promise<FuelPolicy> {
    const response = await this.apiRequest(`/api/v2/policies/${policyId}`);

    return response as FuelPolicy;
  }

  /**
   * List fuel stations in Fuelman network
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

    const endpoint = `/api/v2/stations?${params.toString()}`;
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
    const endpoint = `/api/v2/prices/${fuelType}${query}`;
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
      `/api/v2/cards/${cardId}/fraud-alerts`,
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
      "/api/v2/assignments",
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
      await this.apiRequest(`/api/v2/assignments/${assignmentId}`, "DELETE");
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
    const response = await this.apiRequest("/api/v2/limits", "POST", limit);

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
      `/api/v2/cards/${cardId}/limits`,
    );

    return limits;
  }

  /**
   * Set merchant restrictions for a card
   *
   * @param cardId - Card identifier
   * @param restrictions - Merchant restrictions
   * @returns Updated card
   */
  async setMerchantRestrictions(
    cardId: string,
    restrictions: Record<string, unknown>,
  ): Promise<FuelCard> {
    const response = await this.apiRequest<FuelmanCardResponse>(
      `/api/v2/cards/${cardId}/merchant-restrictions`,
      "POST",
      restrictions,
    );

    return this.mapFuelmanCardToFuelCard(response);
  }

  /**
   * Get IFTA tax report for a period
   *
   * @param periodStart - Period start date (YYYY-MM-DD)
   * @param periodEnd - Period end date (YYYY-MM-DD)
   * @returns IFTA report
   */
  async getIFTAReport(
    periodStart: string,
    periodEnd: string,
  ): Promise<IFTAReport> {
    const endpoint = `/api/v2/ifta-report?start=${periodStart}&end=${periodEnd}`;
    const report = await this.apiRequest<IFTAReport>(endpoint);

    return report;
  }

  /**
   * Generate IFTA tax report
   *
   * @param criteria - Report generation criteria
   * @returns Generated IFTA report
   */
  async generateIFTAReport(
    criteria: Record<string, unknown>,
  ): Promise<IFTAReport> {
    const report = await this.apiRequest<IFTAReport>(
      "/api/v2/ifta-report/generate",
      "POST",
      criteria,
    );

    return report;
  }

  /**
   * Export transaction data for reporting
   *
   * @param criteria - Export criteria
   * @returns Export URL
   */
  async exportTransactionData(
    criteria: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const result = await this.apiRequest<Record<string, unknown>>(
      "/api/v2/export/transactions",
      "POST",
      criteria,
    );

    return result;
  }

  /**
   * Map Fuelman card response to FuelCard
   *
   * @param response - Fuelman card response
   * @returns FuelCard object
   */
  private mapFuelmanCardToFuelCard(response: FuelmanCardResponse): FuelCard {
    return {
      cardId: response.id,
      product: FuelCardProduct.FUELMAN,
      cardNumber: response.cardNumber,
      last4: response.lastFour,
      cardholderName: response.driverName,
      status: response.status as FuelCardStatus,
      issuedDate: new Date(response.activeDate),
      expirationDate: new Date(response.expiryDate),
      driverId: response.assignedDriver,
      vehicleId: response.assignedVehicle,
      dailyLimit: response.singleTransactionLimit,
      monthlyLimit: response.monthlyLimit,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Map Fuelman transaction response to FuelTransaction
   *
   * @param response - Fuelman transaction response
   * @returns FuelTransaction object
   */
  private mapFuelmanTransactionToFuelTransaction(
    response: FuelmanTransactionResponse,
  ): FuelTransaction {
    return {
      transactionId: response.transactionId,
      cardId: response.cardId,
      transactionDate: new Date(response.transactionDateTime),
      merchantName: response.merchantName,
      merchantCategory: "fuel",
      merchantLocation: {
        city: response.merchantCity,
        state: response.merchantState,
        address: "",
        zip: "",
      },
      amount: response.transactionAmount,
      currency: response.currency,
      fuelQuantity: response.gallons,
      fuelType: response.fuelType,
      pricePerGallon: response.unitPrice,
      status: response.transactionStatus as TransactionStatus,
      approved: response.approved,
      declineReason: response.declineCode,
      createdAt: new Date(response.transactionDateTime),
      updatedAt: new Date(response.transactionDateTime),
    };
  }
}
