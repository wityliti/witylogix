/**
 * Historical Delivery KNN-style Model
 *
 * Finds K most similar past deliveries and averages their actual times.
 * Uses weighted Euclidean distance over normalized features.
 * Adaptive K based on data density. Recency weighting for recent data.
 */

import type {
  FeatureVector,
  HistoricalDelivery,
  ModelPrediction,
  HistoricalDeliveryModelState,
} from '../types.js';
import { featureExtractor } from '../feature-extractor.js';

const DEFAULT_K = 10;
const MIN_K = 3;
const MAX_K = 50;

export class HistoricalDeliveryModel {
  private deliveries: HistoricalDelivery[];
  private deliveryFeatures: FeatureVector[];
  private adaptiveK: number;
  private recencyDecay: number; // Decay factor for older deliveries

  constructor() {
    this.deliveries = [];
    this.deliveryFeatures = [];
    this.adaptiveK = DEFAULT_K;
    this.recencyDecay = 0.95; // 5% decay per week
  }

  /**
   * Calculate recency weight for a delivery
   * Returns 1.0 for recent data, decays exponentially for older data
   */
  private getRecencyWeight(deliveryDate: Date): number {
    const now = new Date();
    const ageWeeks = (now.getTime() - deliveryDate.getTime()) / (7 * 24 * 60 * 60 * 1000);
    return Math.pow(this.recencyDecay, ageWeeks);
  }

  /**
   * Train model on historical deliveries
   */
  fit(historicalDeliveries: HistoricalDelivery[]): void {
    this.deliveries = [...historicalDeliveries];

    // Extract features from all deliveries
    this.deliveryFeatures = this.deliveries.map((delivery) =>
      featureExtractor.extractFromHistorical(delivery),
    );

    // Adaptive K: scale with data density
    // More data = higher K (but capped at MAX_K)
    this.adaptiveK = Math.min(MAX_K, Math.max(MIN_K, Math.floor(Math.sqrt(this.deliveries.length))));
  }

  /**
   * Find K nearest neighbors to a query feature vector
   */
  private findNearestNeighbors(
    queryFeatures: FeatureVector,
    k: number,
  ): Array<{ index: number; distance: number; weight: number }> {
    const neighbors: Array<{ index: number; distance: number }> = [];

    // Compute distances to all deliveries
    for (let i = 0; i < this.deliveryFeatures.length; i++) {
      const distance = featureExtractor.weightedDistance(
        queryFeatures,
        this.deliveryFeatures[i],
      );
      neighbors.push({ index: i, distance });
    }

    // Sort by distance and keep top K
    neighbors.sort((a, b) => a.distance - b.distance);
    const topK = neighbors.slice(0, Math.min(k, neighbors.length));

    // Compute weights (inverse distance + recency)
    const result = topK.map(({ index, distance }) => {
      const recencyWeight = this.getRecencyWeight(this.deliveries[index].timestamp);
      // RBF kernel: exp(-distance)
      const distanceWeight = Math.exp(-distance);
      return {
        index,
        distance,
        weight: distanceWeight * recencyWeight,
      };
    });

    // Normalize weights
    const totalWeight = result.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight > 0) {
      return result.map((item) => ({
        ...item,
        weight: item.weight / totalWeight,
      }));
    }

    return result;
  }

  /**
   * Predict delivery time using weighted average of similar historical deliveries
   */
  predict(features: FeatureVector): ModelPrediction {
    if (this.deliveries.length === 0) {
      return {
        modelName: 'historical-similarity',
        predicted_duration_minutes: 30,
        confidence: 0.2,
        lower_bound_minutes: 20,
        upper_bound_minutes: 40,
      };
    }

    const k = Math.min(this.adaptiveK, this.deliveries.length);
    const neighbors = this.findNearestNeighbors(features, k);

    if (neighbors.length === 0) {
      return {
        modelName: 'historical-similarity',
        predicted_duration_minutes: 30,
        confidence: 0.2,
        lower_bound_minutes: 20,
        upper_bound_minutes: 40,
      };
    }

    // Weighted average of actual times
    let weightedSum = 0;
    let weightSum = 0;
    const samples: number[] = [];

    for (const neighbor of neighbors) {
      const delivery = this.deliveries[neighbor.index];
      const weightedTime = delivery.actual_duration_minutes * neighbor.weight;
      weightedSum += weightedTime;
      weightSum += neighbor.weight;
      samples.push(delivery.actual_duration_minutes);
    }

    const predictedDuration = weightSum > 0 ? weightedSum / weightSum : 30;

    // Compute confidence from nearest neighbor distance and consensus
    // If neighbors are close together, confidence is higher
    const avgDistance = neighbors.reduce((sum, n) => sum + n.distance, 0) / neighbors.length;
    const confidence = Math.min(0.95, Math.exp(-avgDistance));

    // Compute percentiles from samples
    const sortedSamples = [...samples].sort((a, b) => a - b);
    const p10 = sortedSamples[Math.floor(sortedSamples.length * 0.1)];
    const p90 = sortedSamples[Math.floor(sortedSamples.length * 0.9)];

    return {
      modelName: 'historical-similarity',
      predicted_duration_minutes: Math.round(predictedDuration * 10) / 10,
      confidence,
      lower_bound_minutes: Math.round(p10 * 10) / 10,
      upper_bound_minutes: Math.round(p90 * 10) / 10,
    };
  }

  /**
   * Get state for serialization
   */
  getState(): HistoricalDeliveryModelState {
    return {
      zone_kdtrees: this.deliveries.reduce(
        (acc, delivery) => {
          const zone = delivery.zone_type;
          if (!acc[zone]) acc[zone] = [];
          acc[zone].push(delivery);
          return acc;
        },
        {} as Record<string, HistoricalDelivery[]>,
      ),
      adaptive_k: this.adaptiveK,
      recency_weight_decay: this.recencyDecay,
    };
  }

  /**
   * Restore state from serialization
   */
  setState(state: HistoricalDeliveryModelState): void {
    this.deliveries = [];
    for (const zone in state.zone_kdtrees) {
      this.deliveries.push(...state.zone_kdtrees[zone]);
    }

    this.deliveryFeatures = this.deliveries.map((delivery) =>
      featureExtractor.extractFromHistorical(delivery),
    );

    this.adaptiveK = state.adaptive_k;
    this.recencyDecay = state.recency_weight_decay;
  }

  /**
   * Get number of stored deliveries
   */
  getDeliveryCount(): number {
    return this.deliveries.length;
  }

  /**
   * Get deliveries by zone
   */
  getDeliveriesByZone(zoneType: string): number {
    return this.deliveries.filter((d) => d.zone_type === zoneType).length;
  }

  /**
   * Get feature importance for this model
   */
  getFeatureImportance(): Record<string, number> {
    return {
      distance_km: 0.9,
      zone_type: 0.85,
      hour: 0.7,
      day_of_week: 0.6,
      vehicle_type: 0.5,
      weather_condition: 0.4,
      driver_experience_score: 0.3,
      num_stops_remaining: 0.5,
    };
  }
}
