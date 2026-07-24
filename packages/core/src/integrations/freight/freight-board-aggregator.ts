/**
 * Freight Board Aggregator
 *
 * Cross-board aggregation for unified search, rate comparison, deduplication,
 * carrier scoring, and market rate analytics across all freight boards.
 */

import { EventEmitter } from "events";

import { DATClient } from "./dat-client";
import { TruckstopClient } from "./truckstop-client";
import { LoadBoard123Client } from "./loadboard123-client";
import { DirectFreightClient } from "./direct-freight-client";
import type {
  FreightConfig,
  LoadPosting,
  FreightQuote,
  CarrierProfile,
  LaneRate,
} from "./types";

/**
 * Aggregated load posting with board information
 */
interface AggregatedLoad extends LoadPosting {
  /** Source board(s) where load is posted */
  boards: string[];

  /** Unique load signature for deduplication */
  loadSignature: string;
}

/**
 * Rate comparison result
 */
interface RateComparison {
  /** Load identifier */
  loadId: string;

  /** Best available rate */
  bestRate: number;

  /** Best rate provider */
  bestProvider: string;

  /** All quotes sorted by rate */
  quotes: Array<{
    provider: string;
    rate: number;
    carrierId: string;
  }>;

  /** Average rate across providers */
  averageRate: number;

  /** Rate variance (std dev) */
  variance: number;
}

/**
 * Market rate analytics data
 */
interface MarketRateAnalytics {
  /** Lane identifier */
  laneId: string;

  /** Origin state/city */
  origin: string;

  /** Destination state/city */
  destination: string;

  /** Average rate across all boards */
  averageRate: number;

  /** Median rate */
  medianRate: number;

  /** Rate range */
  rateRange: {
    min: number;
    max: number;
  };

  /** Supply/demand index (0-100, 50=balanced) */
  supplyDemandIndex: number;

  /** Market volatility (0-100, higher=more volatile) */
  volatility: number;

  /** Trend direction (positive=rising, negative=falling) */
  trend: number;

  /** Number of active loads */
  activeLoads: number;

  /** Aggregation timestamp */
  timestamp: Date;
}

/**
 * Aggregated carrier score from multiple sources
 */
interface AggregatedCarrierScore {
  /** Carrier identifier */
  carrierId: string;

  /** Carrier legal name */
  carrierName: string;

  /** Weighted overall rating (0-100) */
  overallRating: number;

  /** Ratings by source board */
  sourceRatings: Array<{
    source: string;
    rating: number;
    weight: number;
  }>;

  /** Rating factors breakdown */
  factors: Record<string, number>;

  /** Risk assessment score */
  riskScore: number;

  /** Trustworthiness indicator */
  trustScore: number;

  /** Aggregation timestamp */
  timestamp: Date;
}

/**
 * Freight board aggregator for unified access
 */
export class FreightBoardAggregator extends EventEmitter {
  /** DAT client instance */
  private datClient: DATClient;

  /** Truckstop client instance */
  private truckstopClient: TruckstopClient;

  /** 123Loadboard client instance */
  private loadboard123Client: LoadBoard123Client;

  /** Direct Freight client instance */
  private directFreightClient: DirectFreightClient;

  /** Load cache for deduplication */
  private loadCache: Map<string, AggregatedLoad> = new Map();

  /** Cache TTL in milliseconds */
  private readonly cacheTTL: number = 60000; // 1 minute

  /**
   * Initialize freight board aggregator
   *
   * @param configs - Configuration for each board client
   */
  constructor(configs: {
    dat: FreightConfig;
    truckstop: FreightConfig;
    loadboard123: FreightConfig;
    directFreight: FreightConfig;
  }) {
    super();

    this.datClient = new DATClient(configs.dat);
    this.truckstopClient = new TruckstopClient(configs.truckstop);
    this.loadboard123Client = new LoadBoard123Client(configs.loadboard123);
    this.directFreightClient = new DirectFreightClient(configs.directFreight);

    // Set up error event forwarding
    [
      this.datClient,
      this.truckstopClient,
      this.loadboard123Client,
      this.directFreightClient,
    ].forEach((client) => {
      client.on("error", (error) => {
        this.emit("error", {
          source: "aggregator",
          error,
          timestamp: new Date(),
        });
      });
    });
  }

  /**
   * Generate unique signature for a load to detect duplicates
   *
   * @param load - Load posting
   * @returns Load signature hash
   */
  private generateLoadSignature(load: LoadPosting): string {
    const components = [
      load.origin.city,
      load.origin.state,
      load.destination.city,
      load.destination.state,
      load.pickupDate.toISOString().split("T")[0],
      load.weight,
      load.equipmentType,
    ].join("|");

    return Buffer.from(components).toString("base64");
  }

  /**
   * Unified search across all freight boards
   *
   * @param criteria - Search criteria
   * @returns Aggregated and deduplicated loads
   */
  async searchAllBoards(
    criteria: Record<string, unknown>,
  ): Promise<AggregatedLoad[]> {
    try {
      const results = await Promise.allSettled([
        this.datClient.searchLoads(criteria),
        this.truckstopClient.searchLoads(criteria),
        this.loadboard123Client.searchLoads(criteria),
        this.directFreightClient.searchLoads(criteria),
      ]);

      const allLoads: Array<LoadPosting & { board: string }> = [];
      const boards = ["DAT", "Truckstop", "123Loadboard", "DirectFreight"];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          result.value.forEach((load) => {
            allLoads.push({ ...load, board: boards[index]! });
          });
        } else {
          this.emit("warning", {
            message: `Search failed on ${boards[index]}`,
            error: result.reason,
          });
        }
      });

      // Deduplicate loads
      const deduplicatedMap = new Map<string, AggregatedLoad>();

      allLoads.forEach((load) => {
        const signature = this.generateLoadSignature(load);

        if (deduplicatedMap.has(signature)) {
          const existing = deduplicatedMap.get(signature)!;
          existing.boards.push(load.board);
        } else {
          const aggregated: AggregatedLoad = {
            ...load,
            boards: [load.board],
            loadSignature: signature,
          };

          deduplicatedMap.set(signature, aggregated);
        }
      });

      const aggregatedLoads = Array.from(deduplicatedMap.values());

      // Update cache
      aggregatedLoads.forEach((load) => {
        this.loadCache.set(load.loadSignature, load);
      });

      return aggregatedLoads;
    } catch (error) {
      throw new Error(
        `Aggregator search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Compare rates across all boards for a load
   *
   * @param loadId - Load identifier
   * @returns Rate comparison results
   */
  async compareRates(loadId: string): Promise<RateComparison> {
    try {
      const results = await Promise.allSettled([
        this.datClient.getQuotes(loadId),
        this.truckstopClient.getQuotes(loadId),
        this.loadboard123Client.getQuotes(loadId),
        this.directFreightClient.getQuotes(loadId),
      ]);

      const allQuotes: Array<FreightQuote & { provider: string }> = [];
      const providers = ["DAT", "Truckstop", "123Loadboard", "DirectFreight"];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          result.value.forEach((quote) => {
            allQuotes.push({ ...quote, provider: providers[index]! });
          });
        }
      });

      // Sort by rate
      allQuotes.sort((a, b) => a.amount - b.amount);

      // Calculate statistics
      const rates = allQuotes.map((q) => q.amount);
      const bestRate = Math.min(...rates);
      const averageRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      const variance =
        Math.sqrt(
          rates.reduce(
            (sum, rate) => sum + Math.pow(rate - averageRate, 2),
            0,
          ) / rates.length,
        ) || 0;

      return {
        loadId,
        bestRate,
        bestProvider: allQuotes[0]!.provider,
        quotes: allQuotes.map((q) => ({
          provider: q.provider,
          rate: q.amount,
          carrierId: q.carrier.carrierId,
        })),
        averageRate,
        variance,
      };
    } catch (error) {
      throw new Error(
        `Rate comparison failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get best rate across all boards for a lane
   *
   * @param origin - Origin location
   * @param destination - Destination location
   * @returns Best rate information
   */
  async getBestLaneRate(
    origin: string,
    destination: string,
  ): Promise<{ rate: LaneRate; provider: string }> {
    try {
      const results = await Promise.allSettled([
        this.datClient.getLaneRate(origin, destination),
        this.truckstopClient.getLaneRate(origin, destination),
        this.loadboard123Client.getLaneRate(origin, destination),
        this.directFreightClient.getLaneRate(origin, destination),
      ]);

      const rates: Array<LaneRate & { provider: string }> = [];
      const providers = ["DAT", "Truckstop", "123Loadboard", "DirectFreight"];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          rates.push({ ...result.value, provider: providers[index]! });
        }
      });

      if (rates.length === 0) {
        throw new Error("No rate data available from any board");
      }

      // Find best (lowest) rate
      const bestRate = rates.reduce((best, current) =>
        current.ratePerMile < best.ratePerMile ? current : best,
      );

      return { rate: bestRate, provider: bestRate.provider };
    } catch (error) {
      throw new Error(
        `Lane rate lookup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Search for carriers across all boards
   *
   * @param criteria - Search criteria
   * @returns Array of carrier profiles
   */
  async searchCarriersAllBoards(
    criteria: Record<string, unknown>,
  ): Promise<CarrierProfile[]> {
    try {
      const results = await Promise.allSettled([
        this.datClient.searchCarriers(criteria),
        this.truckstopClient.searchCarriers(criteria),
        this.loadboard123Client.searchCarriers(criteria),
        this.directFreightClient.searchCarriers(criteria),
      ]);

      const carriers: CarrierProfile[] = [];
      const seenCarriers = new Set<string>();

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          result.value.forEach((carrier) => {
            if (!seenCarriers.has(carrier.carrierId)) {
              carriers.push(carrier);
              seenCarriers.add(carrier.carrierId);
            }
          });
        }
      });

      return carriers;
    } catch (error) {
      throw new Error(
        `Carrier search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Aggregate carrier scores from all boards
   *
   * @param carrierId - Carrier identifier
   * @returns Aggregated carrier score
   */
  async aggregateCarrierScore(
    carrierId: string,
  ): Promise<AggregatedCarrierScore> {
    try {
      const results = await Promise.allSettled([
        this.datClient.scoreCarrier(carrierId),
        this.truckstopClient.scoreCarrier(carrierId),
        this.loadboard123Client.scoreCarrier(carrierId),
        this.directFreightClient.scoreCarrier(carrierId),
      ]);

      const ratings: Array<{ source: string; rating: number; weight: number }> =
        [];
      const providers = ["DAT", "Truckstop", "123Loadboard", "DirectFreight"];
      let carrierName = "";

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const carrier = result.value;
          carrierName = carrier.legalName;
          ratings.push({
            source: providers[index]!,
            rating: carrier.overallRating,
            weight: 1 / results.filter((r) => r.status === "fulfilled").length,
          });
        }
      });

      // Calculate weighted average
      const overallRating = ratings.reduce(
        (sum, r) => sum + r.rating * r.weight,
        0,
      );

      // Extract factors from first available rating
      const factors: Record<string, number> = {};
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const carrier = result.value;
          carrier.ratings.forEach((value, key) => {
            if (!factors[key]) {
              factors[key] = value;
            }
          });
        }
      });

      return {
        carrierId,
        carrierName,
        overallRating,
        sourceRatings: ratings,
        factors,
        riskScore: 100 - overallRating,
        trustScore: overallRating,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Carrier scoring failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get market rate analytics for a lane
   *
   * @param origin - Origin state/city
   * @param destination - Destination state/city
   * @returns Market rate analytics
   */
  async getMarketRateAnalytics(
    origin: string,
    destination: string,
  ): Promise<MarketRateAnalytics> {
    try {
      const laneId = `${origin}-${destination}`;

      // Get rate data from all boards
      const results = await Promise.allSettled([
        this.datClient.getLaneRate(origin, destination),
        this.truckstopClient.getLaneRate(origin, destination),
        this.loadboard123Client.getLaneRate(origin, destination),
        this.directFreightClient.getLaneRate(origin, destination),
      ]);

      const rates: number[] = [];
      let totalLoads = 0;
      let avgVolatility = 0;
      let avgTrend = 0;

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const laneRate = result.value;
          rates.push(laneRate.ratePerMile);
          totalLoads += laneRate.dailyLoadCount || 0;
          avgVolatility += laneRate.volatilityIndex;
          avgTrend += laneRate.weeklyTrend || 0;
        }
      });

      const successCount = results.filter(
        (r) => r.status === "fulfilled",
      ).length;

      if (rates.length === 0) {
        throw new Error("No rate data available");
      }

      // Calculate statistics
      rates.sort((a, b) => a - b);
      const averageRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      const medianRate =
        rates.length % 2 === 0
          ? (rates[rates.length / 2 - 1]! + rates[rates.length / 2]!) / 2
          : rates[Math.floor(rates.length / 2)]!;

      // Estimate supply/demand (50 = balanced, <50 = oversupply, >50 = undersupply)
      const supplyDemandIndex = Math.min(100, Math.max(0, 50 + avgTrend / 2));

      return {
        laneId,
        origin,
        destination,
        averageRate,
        medianRate,
        rateRange: {
          min: Math.min(...rates),
          max: Math.max(...rates),
        },
        supplyDemandIndex,
        volatility: avgVolatility / successCount,
        trend: avgTrend / successCount,
        activeLoads: totalLoads,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Market analytics failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.loadCache.clear();
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.loadCache.size,
      maxSize: 10000,
    };
  }
}
