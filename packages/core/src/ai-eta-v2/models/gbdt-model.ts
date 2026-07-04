/**
 * Gradient Boosted Decision Trees (GBDT) for ETA Prediction
 *
 * Pure TypeScript implementation of gradient boosting with decision trees.
 * Minimizes mean squared error via gradient descent on regression trees.
 *
 * Algorithm:
 *   F_0(x) = mean(y)
 *   For m = 1..M:
 *     r_i = -∂L/∂F(x_i) = y_i - F_{m-1}(x_i)  [negative gradient = pseudo-residuals]
 *     Fit regression tree h_m on {(x_i, r_i)}
 *     F_m(x) = F_{m-1}(x) + lr * h_m(x)
 *
 * Features: shrinkage (learning rate), max depth, min samples, subsampling
 */

import type {
  FeatureVector,
  HistoricalDelivery,
  ModelPrediction,
} from "../types.js";

// ─── Decision Tree Node ───────────────────────────────────────────────────────

interface TreeNode {
  isLeaf: boolean;
  // Leaf values
  value?: number;
  // Internal node split
  featureIndex?: number;
  featureName?: string;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  sampleCount?: number;
}

// ─── Feature Encoding ─────────────────────────────────────────────────────────

const ZONE_TYPE_MAP: Record<string, number> = {
  "urban-core": 0,
  urban: 1,
  suburban: 2,
  rural: 3,
  highway: 4,
};

const WEATHER_MAP: Record<string, number> = {
  clear: 0,
  rain: 1,
  snow: 2,
  fog: 3,
  unknown: 0,
};

const TRAFFIC_MAP: Record<string, number> = {
  light: 0,
  moderate: 1,
  heavy: 2,
  unknown: 1,
};

const VEHICLE_MAP: Record<string, number> = {
  bike: 0,
  car: 1,
  van: 2,
  truck: 3,
};

const FEATURE_NAMES = [
  "distance_km",
  "zone_type",
  "hour",
  "day_of_week",
  "is_holiday",
  "is_weekend",
  "weather_condition",
  "weather_intensity",
  "traffic_condition",
  "traffic_multiplier",
  "historical_avg_minutes",
  "driver_experience_score",
  "vehicle_type",
  "num_stops_remaining",
  "temperature_celsius",
  "wind_speed_kmh",
  "precipitation_mm",
] as const;

function encodeFeatures(fv: FeatureVector): number[] {
  return [
    fv.distance_km,
    ZONE_TYPE_MAP[fv.zone_type] ?? 1,
    fv.hour,
    fv.day_of_week,
    fv.is_holiday ? 1 : 0,
    fv.is_weekend,
    WEATHER_MAP[fv.weather_condition] ?? 0,
    fv.weather_intensity,
    TRAFFIC_MAP[fv.traffic_condition] ?? 1,
    fv.traffic_multiplier,
    fv.historical_avg_minutes,
    fv.driver_experience_score,
    VEHICLE_MAP[fv.vehicle_type] ?? 1,
    fv.num_stops_remaining,
    fv.temperature_celsius,
    fv.wind_speed_kmh,
    fv.precipitation_mm,
  ];
}

function encodeHistorical(d: HistoricalDelivery): number[] {
  return [
    d.distance_km,
    ZONE_TYPE_MAP[d.zone_type] ?? 1,
    d.hour,
    d.day_of_week,
    d.is_holiday ? 1 : 0,
    d.day_of_week >= 5 ? 1 : 0, // is_weekend
    WEATHER_MAP[d.weather_condition] ?? 0,
    d.weather_intensity,
    TRAFFIC_MAP[d.traffic_condition] ?? 1,
    1.0, // traffic_multiplier not in historical
    0, // historical_avg_minutes — filled in during training
    d.driver_experience_score,
    VEHICLE_MAP[d.vehicle_type] ?? 1,
    d.num_stops,
    d.temperature_celsius,
    d.wind_speed_kmh,
    d.precipitation_mm,
  ];
}

// ─── Regression Tree ──────────────────────────────────────────────────────────

class RegressionTree {
  private root: TreeNode | null = null;
  private readonly maxDepth: number;
  private readonly minSamples: number;

  constructor(maxDepth: number = 4, minSamples: number = 5) {
    this.maxDepth = maxDepth;
    this.minSamples = minSamples;
  }

  fit(X: number[][], y: number[]): void {
    const indices = X.map((_, i) => i);
    this.root = this.buildNode(X, y, indices, 0);
  }

  predict(x: number[]): number {
    if (!this.root) return 0;
    return this.traverseNode(this.root, x);
  }

  private traverseNode(node: TreeNode, x: number[]): number {
    if (node.isLeaf) return node.value ?? 0;
    const val = x[node.featureIndex!];
    if (val <= node.threshold!) {
      return this.traverseNode(node.left!, x);
    }
    return this.traverseNode(node.right!, x);
  }

  private buildNode(
    X: number[][],
    y: number[],
    indices: number[],
    depth: number,
  ): TreeNode {
    const n = indices.length;

    // Leaf conditions
    if (depth >= this.maxDepth || n < this.minSamples) {
      return { isLeaf: true, value: this.mean(y, indices), sampleCount: n };
    }

    const bestSplit = this.findBestSplit(X, y, indices);
    if (!bestSplit) {
      return { isLeaf: true, value: this.mean(y, indices), sampleCount: n };
    }

    const { featureIndex, threshold, leftIdx, rightIdx } = bestSplit;

    return {
      isLeaf: false,
      featureIndex,
      featureName: FEATURE_NAMES[featureIndex] ?? `f${featureIndex}`,
      threshold,
      sampleCount: n,
      left: this.buildNode(X, y, leftIdx, depth + 1),
      right: this.buildNode(X, y, rightIdx, depth + 1),
    };
  }

  private findBestSplit(
    X: number[][],
    y: number[],
    indices: number[],
  ): {
    featureIndex: number;
    threshold: number;
    leftIdx: number[];
    rightIdx: number[];
  } | null {
    const nFeatures = X[0].length;
    let bestGain = -Infinity;
    let bestSplit: {
      featureIndex: number;
      threshold: number;
      leftIdx: number[];
      rightIdx: number[];
    } | null = null;

    const parentMSE = this.mse(y, indices);

    for (let fi = 0; fi < nFeatures; fi++) {
      // Candidate thresholds: midpoints between sorted unique values
      const vals = indices.map((i) => X[i][fi]);
      const unique = [...new Set(vals)].sort((a, b) => a - b);

      for (let t = 0; t < unique.length - 1; t++) {
        const threshold = (unique[t] + unique[t + 1]) / 2;

        const leftIdx = indices.filter((i) => X[i][fi] <= threshold);
        const rightIdx = indices.filter((i) => X[i][fi] > threshold);

        if (
          leftIdx.length < this.minSamples ||
          rightIdx.length < this.minSamples
        ) {
          continue;
        }

        const gain =
          parentMSE -
          (leftIdx.length / indices.length) * this.mse(y, leftIdx) -
          (rightIdx.length / indices.length) * this.mse(y, rightIdx);

        if (gain > bestGain) {
          bestGain = gain;
          bestSplit = { featureIndex: fi, threshold, leftIdx, rightIdx };
        }
      }
    }

    return bestGain > 0 ? bestSplit : null;
  }

  private mse(y: number[], indices: number[]): number {
    if (indices.length === 0) return 0;
    const m = this.mean(y, indices);
    return (
      indices.reduce((sum, i) => sum + (y[i] - m) ** 2, 0) / indices.length
    );
  }

  private mean(y: number[], indices: number[]): number {
    if (indices.length === 0) return 0;
    return indices.reduce((sum, i) => sum + y[i], 0) / indices.length;
  }

  getLeafCount(): number {
    return this.root ? this.countLeaves(this.root) : 0;
  }

  private countLeaves(node: TreeNode): number {
    if (node.isLeaf) return 1;
    return this.countLeaves(node.left!) + this.countLeaves(node.right!);
  }
}

// ─── Feature Importance ───────────────────────────────────────────────────────

function computeImportance(trees: RegressionTree[]): number[] {
  // Use prediction variance across trees as a proxy for importance
  // A more proper approach would accumulate split gains — this is a fast approximation
  const nFeatures = FEATURE_NAMES.length;
  const importance = new Array(nFeatures).fill(0);

  // Generate synthetic range probes for each feature
  for (let fi = 0; fi < nFeatures; fi++) {
    let variance = 0;
    const probe1 = new Array(nFeatures).fill(0.5);
    const probe2 = new Array(nFeatures).fill(0.5);

    // Test at two extremes
    probe1[fi] = 0.1;
    probe2[fi] = 0.9;

    // Scale based on feature range
    const ranges = [100, 4, 23, 6, 1, 1, 3, 1, 2, 2, 120, 1, 3, 20, 40, 60, 50];
    probe1[fi] = ranges[fi] * 0.1;
    probe2[fi] = ranges[fi] * 0.9;

    for (const tree of trees) {
      const d = tree.predict(probe2) - tree.predict(probe1);
      variance += d * d;
    }
    importance[fi] = Math.sqrt(variance / trees.length);
  }

  // Normalize
  const total = importance.reduce((s, v) => s + v, 0) || 1;
  return importance.map((v) => v / total);
}

// ─── GBDT Model ───────────────────────────────────────────────────────────────

export interface GBDTConfig {
  /** Number of boosting rounds */
  nEstimators: number;
  /** Shrinkage rate (learning rate) */
  learningRate: number;
  /** Max depth of each tree */
  maxDepth: number;
  /** Min samples to split a leaf */
  minSamplesSplit: number;
  /** Fraction of samples used per tree (row subsampling) */
  subsampleRate: number;
}

const DEFAULT_CONFIG: GBDTConfig = {
  nEstimators: 60,
  learningRate: 0.1,
  maxDepth: 4,
  minSamplesSplit: 5,
  subsampleRate: 0.8,
};

export class GBDTModel {
  private trees: RegressionTree[] = [];
  private basePrediction = 0;
  private isTrained = false;
  private trainingSamples = 0;
  private trainingError = 0;
  private featureImportances: number[] = [];
  private readonly config: GBDTConfig;

  constructor(config: Partial<GBDTConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Train GBDT on historical deliveries
   */
  fit(historicalDeliveries: HistoricalDelivery[]): void {
    if (historicalDeliveries.length < 10) return;

    const n = historicalDeliveries.length;

    // Compute zone-level historical averages for the historical_avg_minutes feature
    const zoneAvgs = new Map<string, number>();
    const zoneCounts = new Map<string, number>();
    for (const d of historicalDeliveries) {
      zoneAvgs.set(
        d.zone_type,
        (zoneAvgs.get(d.zone_type) ?? 0) + d.actual_duration_minutes,
      );
      zoneCounts.set(d.zone_type, (zoneCounts.get(d.zone_type) ?? 0) + 1);
    }
    for (const [z, sum] of zoneAvgs) {
      zoneAvgs.set(z, sum / (zoneCounts.get(z) ?? 1));
    }

    // Build feature matrix and targets
    const X: number[][] = historicalDeliveries.map((d) => {
      const enc = encodeHistorical(d);
      enc[10] = zoneAvgs.get(d.zone_type) ?? 30; // historical_avg_minutes
      return enc;
    });
    const y: number[] = historicalDeliveries.map(
      (d) => d.actual_duration_minutes,
    );

    // Initialize F_0 = mean(y)
    this.basePrediction = y.reduce((s, v) => s + v, 0) / n;
    const F = new Array(n).fill(this.basePrediction);

    this.trees = [];
    const {
      nEstimators,
      learningRate,
      maxDepth,
      minSamplesSplit,
      subsampleRate,
    } = this.config;

    for (let m = 0; m < nEstimators; m++) {
      // Compute pseudo-residuals (negative gradient of MSE = y - F)
      const residuals = F.map((f, i) => y[i] - f);

      // Row subsampling
      const sampleSize = Math.max(10, Math.floor(n * subsampleRate));
      const sampleIdx = this.sampleIndices(n, sampleSize);
      const Xsub = sampleIdx.map((i) => X[i]);
      const rsub = sampleIdx.map((i) => residuals[i]);

      // Fit regression tree on residuals
      const tree = new RegressionTree(maxDepth, minSamplesSplit);
      tree.fit(Xsub, rsub);

      // Update F with shrinkage
      for (let i = 0; i < n; i++) {
        F[i] += learningRate * tree.predict(X[i]);
      }

      this.trees.push(tree);
    }

    // Final training MSE
    this.trainingError = Math.sqrt(
      F.reduce((s, f, i) => s + (y[i] - f) ** 2, 0) / n,
    );
    this.trainingSamples = n;
    this.isTrained = true;

    // Feature importances
    this.featureImportances = computeImportance(this.trees);
  }

  /**
   * Predict ETA duration in minutes for a feature vector
   */
  predict(features: FeatureVector): ModelPrediction {
    if (!this.isTrained || this.trees.length === 0) {
      return this.fallbackPrediction(features);
    }

    const x = encodeFeatures(features);
    let pred = this.basePrediction;
    for (const tree of this.trees) {
      pred += this.config.learningRate * tree.predict(x);
    }

    // Clamp to reasonable bounds
    const clampedPred = Math.max(5, Math.min(pred, 480));

    // Confidence based on training sample size and RMSE
    const confidence = this.computeConfidence(clampedPred);

    // Uncertainty interval (±1.5 RMSE scaled by confidence)
    const halfInterval = this.trainingError * 1.5 * (2 - confidence);
    const lowerBound = Math.max(1, clampedPred - halfInterval);
    const upperBound = clampedPred + halfInterval;

    return {
      modelName: "gbdt",
      predicted_duration_minutes: clampedPred,
      confidence,
      lower_bound_minutes: lowerBound,
      upper_bound_minutes: upperBound,
      error_estimate: this.trainingError,
    };
  }

  /**
   * Get feature importance as a map {featureName: importance}
   */
  getFeatureImportance(): Record<string, number> {
    const importance: Record<string, number> = {};
    for (let i = 0; i < FEATURE_NAMES.length; i++) {
      importance[FEATURE_NAMES[i]] = this.featureImportances[i] ?? 0;
    }
    return importance;
  }

  get trained(): boolean {
    return this.isTrained;
  }

  get rmse(): number {
    return this.trainingError;
  }

  get numTrees(): number {
    return this.trees.length;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private sampleIndices(n: number, size: number): number[] {
    if (size >= n) return Array.from({ length: n }, (_, i) => i);
    const indices = new Set<number>();
    while (indices.size < size) {
      indices.add(Math.floor(Math.random() * n));
    }
    return [...indices];
  }

  private computeConfidence(predicted: number): number {
    if (this.trainingSamples < 50) return 0.55;
    if (this.trainingSamples < 200) return 0.7;

    // Higher confidence when prediction is near baseline, lower near extremes
    const deviation =
      Math.abs(predicted - this.basePrediction) / (this.trainingError || 30);
    const raw = Math.max(0.5, Math.min(0.95, 0.92 - deviation * 0.08));
    return raw;
  }

  private fallbackPrediction(features: FeatureVector): ModelPrediction {
    // Heuristic fallback when untrained
    const base = features.historical_avg_minutes || 30;
    const traffic = features.traffic_multiplier || 1;
    const weather = 1 + features.weather_intensity * 0.15;
    const pred = base * traffic * weather;

    return {
      modelName: "gbdt",
      predicted_duration_minutes: pred,
      confidence: 0.4,
      lower_bound_minutes: pred * 0.7,
      upper_bound_minutes: pred * 1.5,
    };
  }
}
