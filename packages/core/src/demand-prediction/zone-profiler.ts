/**
 * Zone Profiler for Demand Prediction
 *
 * Creates comprehensive profiles of delivery zones for clustering and
 * similarity-based feature generation.
 */

import { DataAggregator, type DeliveryRecord } from "./data-aggregator.js";
import { TimeSeriesExtractor } from "./time-series-extractor.js";

/**
 * Zone profile characteristics
 */
export interface ZoneProfile {
  zoneId: string;
  name?: string;

  // Volume metrics
  averageDailyVolume: number;
  peakDailyVolume: number;
  minDailyVolume: number;
  volumeStdDev: number;

  // Time characteristics
  primaryDeliveryHours: number[]; // 0-23
  dominantDayOfWeek: number; // 0-6
  peakHour: number; // 0-23

  // Growth & stability
  growthRate: number; // Monthly growth rate
  growthClassification: "declining" | "stable" | "growing";
  volatilityScore: number; // 0-1, higher = less predictable

  // Delivery time
  averageDeliveryTime: number; // minutes
  deliveryTimeStdDev: number;

  // Seasonal patterns
  seasonalityStrength: number; // 0-1
  peakSeason: string; // e.g., "Q4"

  // Clustering
  profileVector: number[]; // For similarity scoring
}

/**
 * Cluster assignment
 */
export interface ClusterAssignment {
  zoneId: string;
  clusterId: number;
  distance: number; // Distance to cluster center
}

/**
 * Zone profiler service
 */
export class ZoneProfiler {
  private aggregator: DataAggregator;
  private extractor: TimeSeriesExtractor;

  constructor(aggregator: DataAggregator) {
    this.aggregator = aggregator;
    this.extractor = new TimeSeriesExtractor();
  }

  /**
   * Create comprehensive profile for a zone
   */
  async profileZone(
    zoneId: string,
    lookbackDays: number = 90,
  ): Promise<ZoneProfile> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);
    const endDate = new Date();

    // Aggregate data
    const dailyAgg = await this.aggregator.aggregateDeliveries(
      zoneId,
      startDate,
      endDate,
      "daily",
    );

    const hourlyAgg = await this.aggregator.aggregateDeliveries(
      zoneId,
      startDate,
      endDate,
      "hourly",
    );

    const dailyPattern = await this.aggregator.computeDayOfWeekPattern(
      zoneId,
      startDate,
      endDate,
    );

    const hourlyDist = await this.aggregator.computeHourlyDistribution(
      zoneId,
      startDate,
      endDate,
    );

    const deliveryTimes =
      await this.aggregator.computeAverageDeliveryTimePerHour(
        zoneId,
        startDate,
        endDate,
      );

    const growthTrend = await this.aggregator.computeGrowthTrend(zoneId, 12);

    const volatility = await this.aggregator.computeVolatilityScore(
      zoneId,
      startDate,
      endDate,
    );

    const seasonalIndex = await this.aggregator.computeSeasonalIndex(zoneId);

    // Extract volume metrics
    const volumes = Object.values(dailyAgg.data);
    const avgVolume = this.mean(volumes);
    const maxVolume = Math.max(...volumes);
    const minVolume = Math.min(...volumes);
    const stdDev = this.standardDeviation(volumes);

    // Extract delivery time metrics
    const deliveryTimeValues = Object.values(deliveryTimes).filter(
      (v) => v > 0,
    );
    const avgDeliveryTime =
      deliveryTimeValues.length > 0 ? this.mean(deliveryTimeValues) : 30;
    const deliveryTimeStdDev =
      deliveryTimeValues.length > 0
        ? this.standardDeviation(deliveryTimeValues)
        : 0;

    // Find primary hours (top 25% by volume)
    const hoursSorted = Object.entries(hourlyDist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const primaryHours = hoursSorted.map((h) => parseInt(h[0]));

    // Find dominant day
    const daysSorted = Object.entries(dailyPattern).sort((a, b) => b[1] - a[1]);
    const dominantDay = parseInt(daysSorted[0][0]);

    // Find peak hour
    const peakHour = parseInt(
      Object.entries(hourlyDist).sort((a, b) => b[1] - a[1])[0][0],
    );

    // Growth classification
    const growthClassification = this.classifyGrowth(growthTrend);

    // Seasonality strength
    const seasonalValues = Object.values(seasonalIndex);
    const seasonalityStrength = this.computeSeasonalityStrength(seasonalValues);

    // Peak season
    const peakMonth = Object.entries(seasonalIndex).sort(
      (a, b) => parseFloat(b[1].toString()) - parseFloat(a[1].toString()),
    )[0][0];
    const peakSeason = this.monthToQuarter(parseInt(peakMonth));

    // Build profile vector for clustering
    const profileVector = this.buildProfileVector(
      avgVolume,
      maxVolume,
      stdDev,
      growthTrend,
      volatility,
      seasonalityStrength,
      avgDeliveryTime,
      primaryHours.length,
    );

    return {
      zoneId,
      averageDailyVolume: avgVolume,
      peakDailyVolume: maxVolume,
      minDailyVolume: minVolume,
      volumeStdDev: stdDev,
      primaryDeliveryHours: primaryHours,
      dominantDayOfWeek: dominantDay,
      peakHour,
      growthRate: growthTrend,
      growthClassification,
      volatilityScore: volatility,
      averageDeliveryTime: avgDeliveryTime,
      deliveryTimeStdDev,
      seasonalityStrength,
      peakSeason,
      profileVector,
    };
  }

  /**
   * Cluster zones using K-means
   */
  async clusterZones(
    zoneIds: string[],
    k: number = 5,
    maxIterations: number = 100,
    lookbackDays: number = 90,
  ): Promise<ClusterAssignment[]> {
    // Generate profiles for all zones
    const profiles = new Map<string, ZoneProfile>();

    for (const zoneId of zoneIds) {
      const profile = await this.profileZone(zoneId, lookbackDays);
      profiles.set(zoneId, profile);
    }

    // Initialize cluster centers randomly
    const centers: number[][] = [];
    const selectedIndices = new Set<number>();

    while (centers.length < Math.min(k, zoneIds.length)) {
      const idx = Math.floor(Math.random() * zoneIds.length);
      if (!selectedIndices.has(idx)) {
        selectedIndices.add(idx);
        const profile = profiles.get(zoneIds[idx])!;
        centers.push([...profile.profileVector]);
      }
    }

    // K-means iterations
    let assignments: ClusterAssignment[] = [];

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Assign zones to nearest center
      assignments = [];

      for (const zoneId of zoneIds) {
        const profile = profiles.get(zoneId)!;
        let minDistance = Infinity;
        let bestCluster = 0;

        for (let c = 0; c < centers.length; c++) {
          const distance = this.euclideanDistance(
            profile.profileVector,
            centers[c],
          );
          if (distance < minDistance) {
            minDistance = distance;
            bestCluster = c;
          }
        }

        assignments.push({
          zoneId,
          clusterId: bestCluster,
          distance: minDistance,
        });
      }

      // Recompute centers
      const newCenters: number[][] = [];

      for (let c = 0; c < centers.length; c++) {
        const zonesInCluster = assignments
          .filter((a) => a.clusterId === c)
          .map((a) => profiles.get(a.zoneId)!.profileVector);

        if (zonesInCluster.length > 0) {
          const newCenter = this.computeCentroid(zonesInCluster);
          newCenters.push(newCenter);
        } else {
          // Keep old center if no zones assigned
          newCenters.push([...centers[c]]);
        }
      }

      // Check convergence
      let converged = true;
      for (let c = 0; c < centers.length; c++) {
        if (this.euclideanDistance(centers[c], newCenters[c]) > 0.001) {
          converged = false;
          break;
        }
      }

      centers.length = 0;
      centers.push(...newCenters);

      if (converged) break;
    }

    return assignments;
  }

  /**
   * Compute similarity score between two zones
   */
  async computeZoneSimilarity(
    zoneA: string,
    zoneB: string,
    lookbackDays: number = 90,
  ): Promise<number> {
    const profileA = await this.profileZone(zoneA, lookbackDays);
    const profileB = await this.profileZone(zoneB, lookbackDays);

    // Normalize vectors to [0, 1]
    const normalizedA = this.normalizeVector(profileA.profileVector);
    const normalizedB = this.normalizeVector(profileB.profileVector);

    // Compute cosine similarity
    return this.cosineSimilarity(normalizedA, normalizedB);
  }

  /**
   * Find most similar zones for cold-start
   */
  async findSimilarZones(
    targetZoneId: string,
    candidateZoneIds: string[],
    topK: number = 5,
    lookbackDays: number = 90,
  ): Promise<Array<{ zoneId: string; similarity: number }>> {
    const similarities: Array<{ zoneId: string; similarity: number }> = [];

    for (const candidateId of candidateZoneIds) {
      if (candidateId === targetZoneId) continue;

      const similarity = await this.computeZoneSimilarity(
        targetZoneId,
        candidateId,
        lookbackDays,
      );

      similarities.push({
        zoneId: candidateId,
        similarity,
      });
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Classify growth rate
   */
  private classifyGrowth(
    growthRate: number,
  ): "declining" | "stable" | "growing" {
    if (growthRate < -0.01) return "declining";
    if (growthRate > 0.01) return "growing";
    return "stable";
  }

  /**
   * Compute seasonality strength
   */
  private computeSeasonalityStrength(seasonalValues: number[]): number {
    const mean = this.mean(seasonalValues);
    const deviations = seasonalValues.map((v) => Math.abs(v - mean));
    const avgDeviation = this.mean(deviations);

    // Strength is average deviation from mean (0-1 range)
    return Math.min(avgDeviation, 1);
  }

  /**
   * Convert month number to quarter string
   */
  private monthToQuarter(month: number): string {
    const quarters = [
      "Q1",
      "Q1",
      "Q1",
      "Q2",
      "Q2",
      "Q2",
      "Q3",
      "Q3",
      "Q3",
      "Q4",
      "Q4",
      "Q4",
    ];
    return quarters[month] || "Q1";
  }

  /**
   * Build normalized profile vector for clustering
   */
  private buildProfileVector(
    avgVolume: number,
    maxVolume: number,
    stdDev: number,
    growthRate: number,
    volatility: number,
    seasonality: number,
    deliveryTime: number,
    numPrimaryHours: number,
  ): number[] {
    // Normalize features to roughly [0, 1]
    return [
      Math.min(avgVolume / 5000, 1), // Assuming max ~5000 deliveries/day
      Math.min(maxVolume / 8000, 1),
      Math.min(stdDev / 2000, 1),
      Math.min(Math.abs(growthRate) / 0.1, 1), // ±10% growth
      volatility,
      seasonality,
      Math.min(deliveryTime / 50, 1), // Assuming max ~50 min
      Math.min(numPrimaryHours / 8, 1),
    ];
  }

  /**
   * Euclidean distance between two vectors
   */
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * Compute centroid of multiple vectors
   */
  private computeCentroid(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];

    const dimension = vectors[0].length;
    const centroid: number[] = new Array(dimension).fill(0);

    for (const vector of vectors) {
      for (let i = 0; i < dimension; i++) {
        centroid[i] += vector[i];
      }
    }

    for (let i = 0; i < dimension; i++) {
      centroid[i] /= vectors.length;
    }

    return centroid;
  }

  /**
   * Normalize vector to [0, 1]
   */
  private normalizeVector(vector: number[]): number[] {
    const min = Math.min(...vector);
    const max = Math.max(...vector);
    const range = max - min || 1;

    return vector.map((v) => (v - min) / range);
  }

  /**
   * Cosine similarity between normalized vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Utility: compute mean
   */
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Utility: compute standard deviation
   */
  private standardDeviation(values: number[], mean?: number): number {
    if (values.length < 2) return 0;

    const m = mean ?? this.mean(values);
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) /
      values.length;

    return Math.sqrt(variance);
  }
}
