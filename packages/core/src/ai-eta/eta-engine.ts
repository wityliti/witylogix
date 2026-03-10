/**
 * ML ETA Engine
 *
 * Main entry point for traffic-aware ETA prediction.
 * Orchestrates multiple models and returns confident predictions.
 *
 * Usage:
 * ```ts
 * const engine = new ETAEngine();
 * const prediction = engine.predictETA({
 *   origin: { lat: 40.7128, lng: -74.0060 },
 *   destination: { lat: 40.7580, lng: -73.9855 },
 *   distanceKm: 5.5,
 *   departureTime: new Date(),
 * });
 * ```
 */

import { TimeOfDayModel } from './models/time-of-day-model.js';
import { DistanceModel } from './models/distance-model.js';
import { HistoricalModel } from './models/historical-model.js';
import { TrafficModel } from './models/traffic-model.js';
import { ModelEnsemble } from './model-ensemble.js';
import type {
  ETAPrediction,
  Coordinates,
  HistoricalRoute,
  TrafficZone,
  TrafficData,
  BatchETARequest,
  BatchETAResponse,
  ModelPrediction,
  AccuracyMetrics,
} from './types.js';

/**
 * ETA Engine configuration
 */
export interface ETAEngineConfig {
  enableTimeOfDay?: boolean;
  enableDistance?: boolean;
  enableHistorical?: boolean;
  enableTraffic?: boolean;
  minConfidence?: number;
}

export class ETAEngine {
  private timeOfDayModel: TimeOfDayModel;
  private distanceModel: DistanceModel;
  private historicalModel: HistoricalModel;
  private trafficModel: TrafficModel;
  private ensemble: ModelEnsemble;

  /**
   * Configuration
   */
  private config: Required<ETAEngineConfig>;

  /**
   * Zone type detection (simple heuristic)
   */
  private zoneTypes: Map<string, 'urban' | 'suburban' | 'rural'> =
    new Map();

  constructor(config?: ETAEngineConfig) {
    this.timeOfDayModel = new TimeOfDayModel();
    this.distanceModel = new DistanceModel();
    this.historicalModel = new HistoricalModel();
    this.trafficModel = new TrafficModel();
    this.ensemble = new ModelEnsemble();

    this.config = {
      enableTimeOfDay: config?.enableTimeOfDay ?? true,
      enableDistance: config?.enableDistance ?? true,
      enableHistorical: config?.enableHistorical ?? true,
      enableTraffic: config?.enableTraffic ?? true,
      minConfidence: config?.minConfidence ?? 0.3,
    };

    this.setupEnsemble();
  }

  /**
   * Setup ensemble with all models
   */
  private setupEnsemble(): void {
    this.ensemble.registerModel(
      'TimeOfDayModel',
      (params) => this.timeOfDayModel.predict(params.baseTime, params.time),
      this.config.enableTimeOfDay,
    );

    this.ensemble.registerModel(
      'DistanceModel',
      (params) =>
        this.distanceModel.predict(
          params.origin,
          params.destination,
          params.distance,
          params.zoneType,
          params.time,
        ),
      this.config.enableDistance,
    );

    this.ensemble.registerModel(
      'HistoricalModel',
      (params) =>
        this.historicalModel.predict(
          params.origin,
          params.destination,
          params.distance,
          params.zoneType,
          params.time,
          params.dayOfWeek,
        ),
      this.config.enableHistorical,
    );

    this.ensemble.registerModel(
      'TrafficModel',
      (params) =>
        this.trafficModel.predict(
          params.origin,
          params.destination,
          params.distance,
          params.baseTime,
          params.time,
          params.zoneId,
        ),
      this.config.enableTraffic,
    );
  }

  /**
   * Load historical data for training
   */
  loadHistoricalData(routes: HistoricalRoute[]): void {
    this.timeOfDayModel.addData(routes);
    this.distanceModel.addData(routes);
    this.historicalModel.addData(routes);
  }

  /**
   * Register traffic zones
   */
  registerTrafficZones(zones: TrafficZone[]): void {
    this.trafficModel.addZones(zones);

    zones.forEach((zone) => {
      this.zoneTypes.set(zone.zoneId, zone.zoneType);
    });
  }

  /**
   * Update real-time traffic data
   */
  updateTraffic(traffic: TrafficData[]): void {
    this.trafficModel.updateTraffic(traffic);
  }

  /**
   * Predict ETA for a single delivery
   */
  predictETA(params: {
    origin: Coordinates;
    destination: Coordinates;
    distanceKm: number;
    departureTime: Date;
    zoneId?: string;
    orderId?: string;
  }): ETAPrediction {
    const { origin, destination, distanceKm, departureTime, zoneId, orderId } =
      params;

    // Determine zone type
    const zoneType = zoneId
      ? (this.zoneTypes.get(zoneId) ?? 'urban')
      : 'urban';

    // Base time estimate: 5 minutes + 2 minutes per km
    const baseTime = 5 + distanceKm * 2;

    // Day of week
    const dayOfWeek = departureTime.getDay();

    // Collect predictions from all enabled models
    const predictions: ModelPrediction[] = [];

    // TimeOfDay model
    if (this.config.enableTimeOfDay) {
      predictions.push(
        this.timeOfDayModel.predict(baseTime, departureTime),
      );
    }

    // Distance model
    if (this.config.enableDistance) {
      predictions.push(
        this.distanceModel.predict(
          origin,
          destination,
          distanceKm,
          zoneType,
          departureTime,
        ),
      );
    }

    // Historical model
    if (this.config.enableHistorical) {
      predictions.push(
        this.historicalModel.predict(
          origin,
          destination,
          distanceKm,
          zoneType,
          departureTime,
          dayOfWeek,
        ),
      );
    }

    // Traffic model
    if (this.config.enableTraffic) {
      predictions.push(
        this.trafficModel.predict(
          origin,
          destination,
          distanceKm,
          baseTime,
          departureTime,
          zoneId,
        ),
      );
    }

    // Combine predictions
    let combined = this.ensemble.combineETAs(predictions, departureTime);

    // Add order ID if provided
    if (orderId) {
      combined.orderId = orderId;
    }

    // Add origin/destination coordinates
    combined.origin = origin;
    combined.destination = destination;

    // Add traffic condition estimation
    combined.trafficCondition = this.estimateTrafficCondition(
      combined.prediction.expected,
      departureTime,
      baseTime,
    );

    return combined;
  }

  /**
   * Batch ETA prediction
   */
  predictBatch(request: BatchETARequest): BatchETAResponse {
    const startMs = Date.now();

    const predictions = request.deliveries.map((delivery) =>
      this.predictETA({
        origin: delivery.origin,
        destination: delivery.destination,
        distanceKm: 0, // Would need to calculate
        departureTime: delivery.departureTime,
        orderId: delivery.orderId,
      }),
    );

    const processingTimeMs = Date.now() - startMs;

    return {
      predictions,
      processingTimeMs,
    };
  }

  /**
   * Record actual delivery time for model training
   */
  recordActualDelivery(
    prediction: ETAPrediction,
    actualTime: Date,
  ): void {
    this.ensemble.recordActualDelivery(prediction, actualTime);
  }

  /**
   * Get model accuracy metrics
   */
  getModelAccuracy(modelName?: string): AccuracyMetrics[] {
    if (modelName) {
      const accuracy = this.ensemble.getModelAccuracy(modelName);
      return accuracy ? [accuracy] : [];
    }

    return this.ensemble.getAllAccuracies();
  }

  /**
   * Get ensemble statistics
   */
  getStatistics(): {
    registeredModels: number;
    enabledModels: number;
    predictionsRecorded: number;
    averageAccuracy: number;
  } {
    const stats = this.ensemble.getStatistics();

    return {
      registeredModels: stats.registeredModels,
      enabledModels: stats.enabledModels,
      predictionsRecorded: stats.predictionsRecorded,
      averageAccuracy: stats.averageEnsembleAccuracy,
    };
  }

  /**
   * Estimate traffic condition from ETA
   */
  private estimateTrafficCondition(
    expected: Date,
    departure: Date,
    baselineMinutes: number,
  ): 'light' | 'moderate' | 'heavy' | 'unknown' {
    const actualMinutes =
      (expected.getTime() - departure.getTime()) / 60000;

    const ratio = actualMinutes / baselineMinutes;

    if (ratio < 1.1) return 'light';
    if (ratio < 1.3) return 'moderate';
    return 'heavy';
  }

  /**
   * Configure model weights
   */
  setModelWeight(modelName: string, weight: number): void {
    this.ensemble.setModelWeight(modelName, weight);
  }

  /**
   * Enable/disable model
   */
  setModelEnabled(modelName: string, enabled: boolean): void {
    this.ensemble.setModelEnabled(modelName, enabled);
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.ensemble.resetWeights();
    this.ensemble.clearHistory();
  }
}

/**
 * Singleton instance for global use
 */
export const etaEngine = new ETAEngine();
