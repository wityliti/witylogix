/**
 * Cross-Provider Fuel Card Manager
 *
 * Unified card inventory management across all fuel card providers with
 * policy enforcement, fraud detection, cost optimization, and IFTA calculations.
 */

import { EventEmitter } from "events";

import { WEXClient } from "./wex-client";
import { ComdataClient } from "./comdata-client";
import { FuelmanClient } from "./fuelman-client";
import { EFSClient } from "./efs-client";
import type {
  FuelFleetConfig,
  FuelCard,
  FuelTransaction,
  FuelPolicy,
  FraudAlert,
  FraudAlertType,
  FraudAlertSeverity,
} from "./types";

/**
 * Unified card inventory record
 */
interface CardInventory {
  /** Inventory identifier */
  inventoryId: string;

  /** Card data from any provider */
  card: FuelCard;

  /** Provider source */
  provider: string;

  /** Cost per card */
  costPerCard: number;

  /** Last cost update */
  lastCostUpdate: Date;

  /** Card health status */
  healthStatus: "healthy" | "at_risk" | "compromised";
}

/**
 * Fraud detection context for a card
 */
interface FraudDetectionContext {
  /** Card identifier */
  cardId: string;

  /** Recent transactions count (last hour) */
  transactionsLastHour: number;

  /** Transaction amount in last hour */
  amountLastHour: number;

  /** Unique locations in last 24 hours */
  uniqueLocations24h: number;

  /** Average transaction amount */
  averageAmount: number;

  /** Largest transaction amount */
  largestAmount: number;

  /** Time since last transaction */
  minutesSinceLastTransaction: number;

  /** Current location */
  currentLocation?: {
    latitude: number;
    longitude: number;
  };

  /** Last transaction location */
  lastTransactionLocation?: {
    latitude: number;
    longitude: number;
  };

  /** Geofence radius in miles */
  geofenceRadius: number;
}

/**
 * Cost optimization recommendation
 */
interface CostOptimizationResult {
  /** Card identifier */
  cardId: string;

  /** Current provider */
  currentProvider: string;

  /** Recommended provider */
  recommendedProvider: string;

  /** Potential monthly savings */
  monthlySavings: number;

  /** Reason for recommendation */
  reason: string;

  /** Implementation cost */
  implementationCost: number;

  /** ROI in months */
  roiMonths: number;
}

/**
 * IFTA calculation result
 */
interface IFTACalculation {
  /** Period start date */
  periodStart: Date;

  /** Period end date */
  periodEnd: Date;

  /** State-by-state tax */
  taxByState: Record<string, number>;

  /** Total tax owed */
  totalTax: number;

  /** Gallons per state */
  gallonsByState: Record<string, number>;

  /** Timestamps for filing */
  filingDeadline: Date;
}

/**
 * Fuel card manager for unified access across providers
 */
export class FuelCardManager extends EventEmitter {
  /** WEX client instance */
  private wexClient: WEXClient;

  /** Comdata client instance */
  private comdataClient: ComdataClient;

  /** Fuelman client instance */
  private fuelmanClient: FuelmanClient;

  /** EFS client instance */
  private efsClient: EFSClient;

  /** Card inventory cache */
  private cardInventory: Map<string, CardInventory> = new Map();

  /** Policy cache */
  private policies: Map<string, FuelPolicy> = new Map();

  /** Fraud alert threshold (in minutes) */
  private readonly fraudAlertThreshold: number = 60;

  /**
   * Initialize fuel card manager
   *
   * @param configs - Configuration for each provider
   */
  constructor(configs: {
    wex: FuelFleetConfig;
    comdata: FuelFleetConfig;
    fuelman: FuelFleetConfig;
    efs: FuelFleetConfig;
  }) {
    super();

    this.wexClient = new WEXClient(configs.wex);
    this.comdataClient = new ComdataClient(configs.comdata);
    this.fuelmanClient = new FuelmanClient(configs.fuelman);
    this.efsClient = new EFSClient(configs.efs);

    // Set up error event forwarding
    [
      this.wexClient,
      this.comdataClient,
      this.fuelmanClient,
      this.efsClient,
    ].forEach((client) => {
      client.on("error", (error) => {
        this.emit("error", {
          source: "manager",
          error,
          timestamp: new Date(),
        });
      });
    });
  }

  /**
   * Get client for a provider
   *
   * @param provider - Provider name
   * @returns Client instance
   * @throws Error if provider is unknown
   */
  private getClient(
    provider: string,
  ): WEXClient | ComdataClient | FuelmanClient | EFSClient {
    switch (provider.toLowerCase()) {
      case "wex":
        return this.wexClient;
      case "comdata":
        return this.comdataClient;
      case "fuelman":
        return this.fuelmanClient;
      case "efs":
        return this.efsClient;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Issue a card from a specific provider
   *
   * @param provider - Provider name
   * @param cardData - Card data
   * @returns Created fuel card with inventory
   */
  async issueCard(
    provider: string,
    cardData: Record<string, unknown>,
  ): Promise<CardInventory> {
    const client = this.getClient(provider);
    const card = await client.issueCard(cardData as any);

    const inventory: CardInventory = {
      inventoryId: `${provider}-${card.cardId}`,
      card,
      provider,
      costPerCard: 0,
      lastCostUpdate: new Date(),
      healthStatus: "healthy",
    };

    this.cardInventory.set(card.cardId, inventory);
    this.emit("card-issued", inventory);

    return inventory;
  }

  /**
   * Get card from inventory by ID
   *
   * @param cardId - Card identifier
   * @returns Card inventory with provider info
   */
  getCardFromInventory(cardId: string): CardInventory | undefined {
    return this.cardInventory.get(cardId);
  }

  /**
   * Unified card status management
   *
   * @param cardId - Card identifier
   * @param action - Action to perform (activate, suspend, close)
   * @returns Updated card
   */
  async manageCardStatus(
    cardId: string,
    action: "activate" | "suspend" | "close",
  ): Promise<FuelCard> {
    const inventory = this.cardInventory.get(cardId);
    if (!inventory) {
      throw new Error(`Card not found in inventory: ${cardId}`);
    }

    const client = this.getClient(inventory.provider);

    let updatedCard: FuelCard;
    switch (action) {
      case "activate":
        updatedCard = await client.activateCard(cardId);
        break;
      case "suspend":
        updatedCard = await client.suspendCard(cardId);
        break;
      case "close":
        updatedCard = await client.closeCard(cardId);
        break;
    }

    // Update inventory
    inventory.card = updatedCard;
    this.emit("card-status-changed", {
      cardId,
      action,
      card: updatedCard,
    });

    return updatedCard;
  }

  /**
   * Enforce policy on all cards
   *
   * @param policyId - Policy identifier
   * @param cardIds - Cards to apply policy to
   * @returns Policy enforcement result
   */
  async enforcePolicyOnCards(
    policyId: string,
    cardIds: string[],
  ): Promise<{ successful: number; failed: number }> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    let successful = 0;
    let failed = 0;

    await Promise.all(
      cardIds.map(async (cardId) => {
        try {
          const inventory = this.cardInventory.get(cardId);
          if (!inventory) {
            failed += 1;
            return;
          }

          const client = this.getClient(inventory.provider);

          // Apply limits
          if (policy.limits.dailyLimit) {
            await client.setPurchaseLimit({
              cardId,
              limitType: "daily",
              amount: policy.limits.dailyLimit,
              currency: "USD",
              enforced: true,
            });
          }

          if (policy.limits.monthlyLimit) {
            await client.setPurchaseLimit({
              cardId,
              limitType: "monthly",
              amount: policy.limits.monthlyLimit,
              currency: "USD",
              enforced: true,
            });
          }

          successful += 1;
          this.emit("policy-enforced", { cardId, policyId });
        } catch {
          failed += 1;
        }
      }),
    );

    return { successful, failed };
  }

  /**
   * Detect fraud patterns across transactions
   *
   * @param cardId - Card identifier
   * @param transactions - Transactions to analyze
   * @returns Fraud alerts
   */
  async detectFraudPatterns(
    cardId: string,
    transactions: FuelTransaction[],
  ): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];
    const now = Date.now();

    if (transactions.length === 0) {
      return alerts;
    }

    // Sort transactions by date (most recent first)
    const sorted = [...transactions].sort(
      (a, b) =>
        new Date(b.transactionDate).getTime() -
        new Date(a.transactionDate).getTime(),
    );

    // Velocity check - too many transactions in short time
    const lastHourStart = now - 60 * 60 * 1000;
    const recentTransactions = sorted.filter(
      (t) => new Date(t.transactionDate).getTime() >= lastHourStart,
    );

    if (recentTransactions.length > 5) {
      alerts.push({
        alertId: `va-${cardId}-${Date.now()}`,
        cardId,
        transactionId: sorted[0]!.transactionId,
        type: "velocity_alert" as FraudAlertType,
        severity: "medium" as FraudAlertSeverity,
        message: `High transaction velocity: ${recentTransactions.length} transactions in last hour`,
        details: {
          transactionCount: recentTransactions.length,
          timeWindow: "1 hour",
        },
        detectedAt: new Date(),
        status: "new",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Amount anomaly check
    const amounts = sorted.map((t) => t.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const maxAmount = Math.max(...amounts);
    const stdDev =
      Math.sqrt(
        amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) /
          amounts.length,
      ) || 0;

    if (maxAmount > avgAmount + 3 * stdDev && maxAmount > 200) {
      alerts.push({
        alertId: `aa-${cardId}-${Date.now()}`,
        cardId,
        transactionId: sorted.find((t) => t.amount === maxAmount)!
          .transactionId,
        type: "amount_anomaly" as FraudAlertType,
        severity: "high" as FraudAlertSeverity,
        message: `Unusual transaction amount: $${maxAmount} (avg: $${avgAmount.toFixed(2)})`,
        details: {
          amount: maxAmount,
          average: avgAmount,
          stdDev,
        },
        detectedAt: new Date(),
        status: "new",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return alerts;
  }

  /**
   * Optimize costs across provider portfolio
   *
   * @param currentCardCosts - Map of card IDs to monthly costs
   * @returns Cost optimization recommendations
   */
  optimizeCosts(
    currentCardCosts: Map<string, number>,
  ): CostOptimizationResult[] {
    const recommendations: CostOptimizationResult[] = [];

    // Analyze cost per provider
    const costByProvider: Record<string, number> = {};
    const countByProvider: Record<string, number> = {};

    currentCardCosts.forEach((cost, cardId) => {
      const inventory = this.cardInventory.get(cardId);
      if (!inventory) return;

      const provider = inventory.provider;
      costByProvider[provider] = (costByProvider[provider] || 0) + cost;
      countByProvider[provider] = (countByProvider[provider] || 0) + 1;
    });

    // Calculate average costs and identify opportunities
    const averageCostByProvider: Record<string, number> = {};
    Object.keys(costByProvider).forEach((provider) => {
      averageCostByProvider[provider] =
        costByProvider[provider] / countByProvider[provider];
    });

    // Recommend switching to cheapest provider for cards above average
    const cheapestProvider = Object.entries(averageCostByProvider).reduce(
      (a, b) => (a[1] < b[1] ? a : b),
    )[0];

    currentCardCosts.forEach((cost, cardId) => {
      const inventory = this.cardInventory.get(cardId);
      if (!inventory) return;

      const provider = inventory.provider;
      const cheapestCost = averageCostByProvider[cheapestProvider]!;

      if (cost > cheapestCost * 1.2) {
        const monthlySavings = cost - cheapestCost;
        const implementationCost = 50; // Estimate

        recommendations.push({
          cardId,
          currentProvider: provider,
          recommendedProvider: cheapestProvider,
          monthlySavings,
          reason: `Lower cost with ${cheapestProvider}`,
          implementationCost,
          roiMonths: implementationCost / monthlySavings,
        });
      }
    });

    return recommendations;
  }

  /**
   * Calculate IFTA taxes for a period
   *
   * @param transactions - Fuel transactions
   * @param startDate - Period start
   * @param endDate - Period end
   * @returns IFTA calculation
   */
  calculateIFTA(
    transactions: FuelTransaction[],
    startDate: Date,
    endDate: Date,
  ): IFTACalculation {
    const filteredTransactions = transactions.filter(
      (t) =>
        new Date(t.transactionDate) >= startDate &&
        new Date(t.transactionDate) <= endDate,
    );

    const gallonsByState: Record<string, number> = {};
    const taxByState: Record<string, number> = {};

    filteredTransactions.forEach((t) => {
      if (t.merchantLocation && t.fuelQuantity) {
        const state = t.merchantLocation.state;
        gallonsByState[state] = (gallonsByState[state] || 0) + t.fuelQuantity;
      }
    });

    // State IFTA tax rates (example rates - update with actual rates)
    const stateTaxRates: Record<string, number> = {
      AL: 0.17,
      AK: 0.08,
      AZ: 0.18,
      AR: 0.225,
      CA: 0.36,
      CO: 0.205,
      CT: 0.239,
      DE: 0.23,
      FL: 0.1485,
      GA: 0.0875,
      // ... add all states
    };

    let totalTax = 0;

    Object.entries(gallonsByState).forEach(([state, gallons]) => {
      const rate = stateTaxRates[state] || 0.2; // Default rate
      const tax = gallons * rate;
      taxByState[state] = tax;
      totalTax += tax;
    });

    // Calculate filing deadline (quarterly basis)
    const filingDeadline = new Date(endDate);
    filingDeadline.setMonth(filingDeadline.getMonth() + 1);
    filingDeadline.setDate(20); // Typical IFTA deadline

    return {
      periodStart: startDate,
      periodEnd: endDate,
      taxByState,
      totalTax,
      gallonsByState,
      filingDeadline,
    };
  }

  /**
   * Register a policy for enforcement
   *
   * @param policy - Policy configuration
   */
  registerPolicy(policy: FuelPolicy): void {
    this.policies.set(policy.policyId, policy);
    this.emit("policy-registered", { policyId: policy.policyId });
  }

  /**
   * Get manager statistics
   *
   * @returns Manager stats
   */
  getStats(): Record<string, unknown> {
    const cardsByProvider: Record<string, number> = {};
    const cardsByStatus: Record<string, number> = {};

    this.cardInventory.forEach((inventory) => {
      cardsByProvider[inventory.provider] =
        (cardsByProvider[inventory.provider] || 0) + 1;

      const status = inventory.card.status;
      cardsByStatus[status] = (cardsByStatus[status] || 0) + 1;
    });

    return {
      totalCards: this.cardInventory.size,
      cardsByProvider,
      cardsByStatus,
      policiesRegistered: this.policies.size,
    };
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.cardInventory.clear();
    this.policies.clear();
  }
}
