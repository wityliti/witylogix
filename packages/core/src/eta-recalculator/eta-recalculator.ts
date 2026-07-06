/**
 * ETA Recalculator Service
 *
 * Real-time ETA recalculation engine that:
 * 1. Accepts driver GPS updates
 * 2. Computes base ETA from remaining distance + driver speed (OSRM-style estimate)
 * 3. Applies LightGBM residual correction for the zone/time context
 * 4. Compares against last-sent ETA — fires SMS/push notification if delta > 5 min
 * 5. Logs ETA change history per delivery
 *
 * Performance target: p95 single recalculation ≤ 500ms (typical: <5ms).
 */

import { LightGBMResidualModel } from "../ai-eta/lightgbm-residual-model.js";
import type {
  DriverLocationUpdate,
  ActiveDelivery,
  RecalculationResult,
  ETAHistoryEntry,
  NotificationTrigger,
  NotificationChannel,
  ETARecalculatorConfig,
} from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────────

const DEFAULT_DELTA_THRESHOLD_MINUTES = 5;
const DEFAULT_SPEED_KMH = 30;

// ─── Haversine distance ────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── ETA Recalculator ─────────────────────────────────────────────────────

export class ETARecalculator {
  private readonly onNotify: (trigger: NotificationTrigger) => Promise<void>;
  private readonly deltaThreshold: number;
  private readonly defaultSpeed: number;
  private readonly residualModel: LightGBMResidualModel;

  constructor(config: ETARecalculatorConfig) {
    this.onNotify = config.onNotify;
    this.deltaThreshold =
      config.deltaThresholdMinutes ?? DEFAULT_DELTA_THRESHOLD_MINUTES;
    this.defaultSpeed = config.defaultSpeedKmh ?? DEFAULT_SPEED_KMH;

    // Initialize the residual model (can be pre-trained via trainResidualModel)
    this.residualModel = new LightGBMResidualModel({
      numTrees: 20,
      learningRate: 0.1,
      maxDepth: 3,
      minSamplesLeaf: 3,
    });
  }

  /**
   * Recalculate ETA for a single active delivery given a fresh GPS update.
   */
  async recalculate(
    update: DriverLocationUpdate,
    delivery: ActiveDelivery,
  ): Promise<RecalculationResult> {
    // 1. Compute remaining distance via Haversine
    const distanceRemainingKm = haversineKm(
      update.lat,
      update.lng,
      delivery.destination.lat,
      delivery.destination.lng,
    );

    // 2. Base ETA from speed (use default if speed is 0 or falsy)
    const effectiveSpeedKmh =
      update.speedKmh && update.speedKmh > 0
        ? update.speedKmh
        : this.defaultSpeed;
    const baseEtaMinutes = (distanceRemainingKm / effectiveSpeedKmh) * 60;

    // 3. LightGBM residual correction
    const hour = update.timestamp.getUTCHours();
    const dayOfWeek = update.timestamp.getUTCDay();
    const residual = this.residualModel.predict({
      distanceKm: distanceRemainingKm,
      hour,
      dayOfWeek,
      numStopsRemaining: delivery.numStopsRemaining ?? 1,
      driverSpeedKmh: effectiveSpeedKmh,
      zoneType: delivery.zoneType ?? "urban",
    });

    const newEtaMinutes = Math.max(0, baseEtaMinutes + residual);

    // 4. Confidence: inversely proportional to remaining distance uncertainty
    //    Higher confidence when driver is closer and speed is known
    const hasSpeed = update.speedKmh > 0;
    const proximityFactor = Math.min(1, 1 / (1 + distanceRemainingKm / 10));
    const confidence = hasSpeed
      ? Math.min(0.95, 0.6 + proximityFactor * 0.35)
      : Math.min(0.75, 0.4 + proximityFactor * 0.3);

    // 5. Compute delta vs last-sent ETA
    const previousEtaMinutes = delivery.currentEtaMinutes;
    const etaDeltaMinutes =
      previousEtaMinutes !== null ? newEtaMinutes - previousEtaMinutes : null;

    // 6. ETA history entry
    const etaHistory: ETAHistoryEntry = {
      calculatedAt: new Date(),
      newEtaMinutes,
      previousEtaMinutes,
      deltaMinutes: etaDeltaMinutes,
      distanceRemainingKm,
      notificationFired: false,
    };

    // 7. Decide whether to fire a notification
    let notificationFired = false;
    const shouldNotify =
      delivery.lastSentEtaAt !== null && // not the first calculation
      previousEtaMinutes !== null &&
      etaDeltaMinutes !== null &&
      Math.abs(etaDeltaMinutes) > this.deltaThreshold;

    if (shouldNotify) {
      const channels: NotificationChannel[] = ["sms"];
      if (delivery.customerPushToken) {
        channels.push("push");
      }

      const trigger: NotificationTrigger = {
        deliveryId: delivery.deliveryId,
        shopId: delivery.shopId,
        customerPhone: delivery.customerPhone,
        customerPushToken: delivery.customerPushToken,
        newEtaMinutes,
        previousEtaMinutes: previousEtaMinutes!,
        deltaMinutes: etaDeltaMinutes!,
        channels,
      };

      await this.onNotify(trigger);
      notificationFired = true;
      etaHistory.notificationFired = true;
    }

    return {
      deliveryId: delivery.deliveryId,
      newEtaMinutes,
      previousEtaMinutes,
      etaDeltaMinutes,
      distanceRemainingKm,
      confidence,
      notificationFired,
      etaHistory,
    };
  }

  /**
   * Recalculate ETAs for multiple deliveries served by the same driver in one GPS update.
   * All deliveries are processed in parallel for performance.
   */
  async recalculateBatch(
    update: DriverLocationUpdate,
    deliveries: ActiveDelivery[],
  ): Promise<RecalculationResult[]> {
    return Promise.all(deliveries.map((d) => this.recalculate(update, d)));
  }

  /**
   * Train the internal LightGBM residual model from historical delivery data.
   * Call this periodically (e.g. every 1000 deliveries) to keep the model accurate.
   */
  trainResidualModel(
    points: import("../ai-eta/lightgbm-residual-model.js").TrainingPoint[],
  ): void {
    this.residualModel.fit(points);
  }

  /** Export the residual model state for persistence in Redis/DB. */
  exportModelState(): import("../ai-eta/lightgbm-residual-model.js").ModelState {
    return this.residualModel.exportState();
  }

  /** Restore the residual model from a previously exported state. */
  importModelState(
    state: import("../ai-eta/lightgbm-residual-model.js").ModelState,
  ): void {
    this.residualModel.importState(state);
  }

  /** Get feature importance from the residual model. */
  getModelFeatureImportance(): Record<string, number> {
    return this.residualModel.getFeatureImportance();
  }
}
