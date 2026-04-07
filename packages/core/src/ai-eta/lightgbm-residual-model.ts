/**
 * LightGBM Residual Model
 *
 * A gradient-boosted decision tree model that learns the residual error between
 * OSRM base ETA estimates and actual delivery times. Applied after the OSRM
 * estimate to produce a corrected prediction.
 *
 * Algorithm: Gradient Boosting with shallow regression trees (CART stumps).
 * Each tree is fit to the negative gradient of the MSE loss (i.e. the residuals
 * from the previous iteration). This is the standard GBDT approach used by
 * LightGBM/XGBoost.
 *
 * Zone types supported: 'urban-core' | 'urban' | 'suburban' | 'rural' | 'highway'
 */

// ─── Types ────────────────────────────────────────────────────────────────

export type ZoneType = 'urban-core' | 'urban' | 'suburban' | 'rural' | 'highway';

export interface ResidualFeatures {
  distanceKm: number;
  hour: number;           // 0–23
  dayOfWeek: number;      // 0–6 (0 = Sunday)
  numStopsRemaining: number;
  driverSpeedKmh: number;
  zoneType: ZoneType;
}

export interface TrainingPoint {
  features: ResidualFeatures;
  osrmEstimateMinutes: number;
  actualMinutes: number;
}

export interface ModelConfig {
  numTrees: number;         // number of boosting rounds (default 20)
  learningRate: number;     // shrinkage factor (default 0.1)
  maxDepth: number;         // max depth per tree (default 3)
  minSamplesLeaf?: number;  // min samples required to form a leaf (default 3)
}

/** A single node in a regression tree */
interface TreeNode {
  isLeaf: boolean;
  // Leaf
  value?: number;
  // Internal
  featureIndex?: number;
  splitValue?: number;
  left?: TreeNode;
  right?: TreeNode;
}

/** One boosting tree */
interface BoostingTree {
  root: TreeNode;
}

/** Serializable model state */
export interface ModelState {
  trees: BoostingTree[];
  featureNames: string[];
  config: ModelConfig;
  baseValue: number;
  featureImportance: Record<string, number>;
}

// ─── Feature encoding ─────────────────────────────────────────────────────

const ZONE_TYPE_ENCODE: Record<ZoneType, number> = {
  'urban-core': 0,
  'urban': 1,
  'suburban': 2,
  'rural': 3,
  'highway': 4,
};

const FEATURE_NAMES = [
  'distanceKm',
  'hour',
  'dayOfWeek',
  'numStopsRemaining',
  'driverSpeedKmh',
  'zoneType',
] as const;

function encodeFeatures(f: ResidualFeatures): number[] {
  return [
    f.distanceKm,
    f.hour,
    f.dayOfWeek,
    f.numStopsRemaining,
    f.driverSpeedKmh,
    ZONE_TYPE_ENCODE[f.zoneType] ?? 1,
  ];
}

// ─── CART tree builder ────────────────────────────────────────────────────

/** Compute mean of an array */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Compute MSE of an array relative to its mean */
function mse(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  return values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
}

/**
 * Build a single regression tree (CART) that predicts `targets` from `features`.
 */
function buildTree(
  features: number[][],
  targets: number[],
  depth: number,
  maxDepth: number,
  minSamplesLeaf: number,
  featureImportance: Record<string, number>,
): TreeNode {
  // Base cases: max depth reached, too few samples, or zero variance
  if (depth >= maxDepth || targets.length <= minSamplesLeaf * 2 || mse(targets) < 1e-10) {
    return { isLeaf: true, value: mean(targets) };
  }

  const numFeatures = features[0].length;
  let bestGain = -Infinity;
  let bestFeatureIdx = -1;
  let bestSplitValue = 0;
  let bestLeftIndices: number[] = [];
  let bestRightIndices: number[] = [];

  const parentMse = mse(targets);

  for (let fi = 0; fi < numFeatures; fi++) {
    // Get unique sorted values for this feature
    const vals = [...new Set(features.map((row) => row[fi]))].sort((a, b) => a - b);

    for (let vi = 0; vi < vals.length - 1; vi++) {
      const split = (vals[vi] + vals[vi + 1]) / 2;
      const leftIdx: number[] = [];
      const rightIdx: number[] = [];

      for (let i = 0; i < features.length; i++) {
        if (features[i][fi] <= split) {
          leftIdx.push(i);
        } else {
          rightIdx.push(i);
        }
      }

      if (leftIdx.length < minSamplesLeaf || rightIdx.length < minSamplesLeaf) continue;

      const leftTargets = leftIdx.map((i) => targets[i]);
      const rightTargets = rightIdx.map((i) => targets[i]);

      const gain =
        parentMse -
        (leftTargets.length / targets.length) * mse(leftTargets) -
        (rightTargets.length / targets.length) * mse(rightTargets);

      if (gain > bestGain) {
        bestGain = gain;
        bestFeatureIdx = fi;
        bestSplitValue = split;
        bestLeftIndices = leftIdx;
        bestRightIndices = rightIdx;
      }
    }
  }

  // No worthwhile split found
  if (bestFeatureIdx === -1) {
    return { isLeaf: true, value: mean(targets) };
  }

  // Accumulate feature importance (gain-based)
  const fname = FEATURE_NAMES[bestFeatureIdx] ?? `f${bestFeatureIdx}`;
  featureImportance[fname] = (featureImportance[fname] ?? 0) + bestGain;

  const leftFeatures = bestLeftIndices.map((i) => features[i]);
  const leftTargets = bestLeftIndices.map((i) => targets[i]);
  const rightFeatures = bestRightIndices.map((i) => features[i]);
  const rightTargets = bestRightIndices.map((i) => targets[i]);

  return {
    isLeaf: false,
    featureIndex: bestFeatureIdx,
    splitValue: bestSplitValue,
    left: buildTree(leftFeatures, leftTargets, depth + 1, maxDepth, minSamplesLeaf, featureImportance),
    right: buildTree(rightFeatures, rightTargets, depth + 1, maxDepth, minSamplesLeaf, featureImportance),
  };
}

/** Traverse a tree for a single feature vector */
function predictTree(node: TreeNode, features: number[]): number {
  if (node.isLeaf) return node.value ?? 0;
  const fval = features[node.featureIndex!];
  if (fval <= node.splitValue!) {
    return predictTree(node.left!, features);
  }
  return predictTree(node.right!, features);
}

// ─── LightGBMResidualModel ─────────────────────────────────────────────────

export class LightGBMResidualModel {
  private config: ModelConfig;
  private trees: BoostingTree[] = [];
  private baseValue: number = 0;
  private featureImportance: Record<string, number> = {};

  constructor(config: ModelConfig) {
    this.config = {
      minSamplesLeaf: 3,
      ...config,
    };
  }

  /**
   * Train the model on historical delivery data.
   *
   * @param points - Array of training points where `residual = actualMinutes - osrmEstimateMinutes`
   */
  fit(points: TrainingPoint[]): void {
    if (points.length === 0) return;

    const features = points.map((p) => encodeFeatures(p.features));
    const residuals = points.map((p) => p.actualMinutes - p.osrmEstimateMinutes);

    // Initialize base prediction as mean residual
    this.baseValue = mean(residuals);
    this.trees = [];
    this.featureImportance = {};

    // Working predictions (start from base)
    const predictions = new Array(points.length).fill(this.baseValue);

    for (let t = 0; t < this.config.numTrees; t++) {
      // Compute negative gradient (residual for MSE = actual - predicted)
      const negGradients = residuals.map((r, i) => r - predictions[i]);

      if (negGradients.every((g) => Math.abs(g) < 1e-6)) break; // converged

      // Build tree on negative gradients
      const treeRoot = buildTree(
        features,
        negGradients,
        0,
        this.config.maxDepth,
        this.config.minSamplesLeaf!,
        this.featureImportance,
      );

      this.trees.push({ root: treeRoot });

      // Update predictions
      for (let i = 0; i < predictions.length; i++) {
        predictions[i] += this.config.learningRate * predictTree(treeRoot, features[i]);
      }
    }
  }

  /**
   * Predict the residual correction (in minutes) for a given feature vector.
   * Add this to the OSRM base estimate to get the corrected ETA.
   */
  predict(features: ResidualFeatures): number {
    const encoded = encodeFeatures(features);
    let prediction = this.baseValue;

    for (const tree of this.trees) {
      prediction += this.config.learningRate * predictTree(tree.root, encoded);
    }

    return prediction;
  }

  /** Return gain-based feature importance (normalized to sum to 1). */
  getFeatureImportance(): Record<string, number> {
    const total = Object.values(this.featureImportance).reduce((a, b) => a + b, 0);
    if (total === 0) return { ...this.featureImportance };
    return Object.fromEntries(
      Object.entries(this.featureImportance).map(([k, v]) => [k, v / total]),
    );
  }

  /** Export model state for persistence. */
  exportState(): ModelState {
    return {
      trees: this.trees,
      featureNames: [...FEATURE_NAMES],
      config: { ...this.config },
      baseValue: this.baseValue,
      featureImportance: { ...this.featureImportance },
    };
  }

  /** Restore model from previously exported state. */
  importState(state: ModelState): void {
    this.trees = state.trees;
    this.config = state.config;
    this.baseValue = state.baseValue;
    this.featureImportance = state.featureImportance ?? {};
  }
}
