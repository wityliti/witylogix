/**
 * A/B Testing Framework for Onboarding
 *
 * Manages onboarding experiments:
 * - Create and configure A/B tests
 * - Deterministic variant assignment (based on user hash)
 * - Track conversions and metrics
 * - Analyze results with confidence intervals
 * - Pre-defined common experiments
 */

import {
  ABTestExperiment,
  ABTestVariant,
  ABTestResults,
  ABTestVariantStats,
} from "./types";

/**
 * A/B Test Manager for experiment lifecycle.
 */
export class ABTestManager {
  private experiments: Map<string, ABTestExperiment> = new Map();
  private variantAssignments: Map<string, Map<string, string>> = new Map(); // experimentName -> userId -> variantId
  private conversions: Map<string, Map<string, number>> = new Map(); // experimentName -> variantId -> count
  private trials: Map<string, Map<string, number>> = new Map(); // experimentName -> variantId -> count
  private conversionData: Map<
    string,
    Array<{ userId: string; variantId: string; metric: number }>
  > = new Map();

  /**
   * Create a new A/B test experiment.
   *
   * @param name - Unique experiment name
   * @param description - Human-readable description
   * @param variants - Array of variant definitions
   */
  createExperiment(
    name: string,
    description: string,
    variants: ABTestVariant[],
  ): void {
    if (this.experiments.has(name)) {
      throw new Error(`Experiment ${name} already exists`);
    }

    const experiment: ABTestExperiment = {
      name,
      description,
      variants,
      createdAt: new Date(),
      startedAt: new Date(),
      status: "active",
    };

    this.experiments.set(name, experiment);
    this.variantAssignments.set(name, new Map());
    this.conversions.set(name, new Map());
    this.trials.set(name, new Map());
    this.conversionData.set(name, []);

    // Initialize counts
    for (const variant of variants) {
      this.conversions.get(name)!.set(variant.id, 0);
      this.trials.get(name)!.set(variant.id, 0);
    }
  }

  /**
   * Assign user to a variant for an experiment.
   *
   * Uses deterministic hashing for consistent assignments across sessions.
   *
   * @param userId - User ID
   * @param experimentName - Experiment name
   * @returns Assigned variant ID
   */
  assignVariant(userId: string, experimentName: string): string {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) {
      throw new Error(`Experiment ${experimentName} not found`);
    }

    const assignments = this.variantAssignments.get(experimentName)!;

    // Return existing assignment if user already has one
    if (assignments.has(userId)) {
      const variantId = assignments.get(userId)!;
      this.trials
        .get(experimentName)
        ?.set(
          variantId,
          (this.trials.get(experimentName)?.get(variantId) ?? 0) + 1,
        );
      return variantId;
    }

    // Deterministically assign variant based on user hash
    const variantId = this.selectVariantByHash(userId, experiment.variants);
    assignments.set(userId, variantId);

    // Track trial
    this.trials
      .get(experimentName)
      ?.set(
        variantId,
        (this.trials.get(experimentName)?.get(variantId) ?? 0) + 1,
      );

    return variantId;
  }

  /**
   * Track conversion for user in experiment.
   *
   * @param userId - User ID
   * @param experimentName - Experiment name
   * @param metric - Metric value (e.g., completion time)
   */
  trackConversion(
    userId: string,
    experimentName: string,
    metric: number = 1,
  ): void {
    const assignments = this.variantAssignments.get(experimentName);
    if (!assignments) {
      throw new Error(`Experiment ${experimentName} not found`);
    }

    const variantId = assignments.get(userId);
    if (!variantId) {
      throw new Error(
        `User ${userId} not assigned to experiment ${experimentName}`,
      );
    }

    // Track conversion
    this.conversions
      .get(experimentName)
      ?.set(
        variantId,
        (this.conversions.get(experimentName)?.get(variantId) ?? 0) + 1,
      );

    // Track detailed data for analysis
    this.conversionData
      .get(experimentName)
      ?.push({ userId, variantId, metric });
  }

  /**
   * Get experiment results and statistics.
   *
   * @param experimentName - Experiment name
   * @returns Experiment results with variant stats
   */
  getExperimentResults(experimentName: string): ABTestResults {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) {
      throw new Error(`Experiment ${experimentName} not found`);
    }

    const conversions = this.conversions.get(experimentName) || new Map();
    const trials = this.trials.get(experimentName) || new Map();

    const variants: ABTestVariantStats[] = experiment.variants.map(
      (variant) => ({
        variantId: variant.id,
        variantName: variant.name,
        conversions: conversions.get(variant.id) ?? 0,
        trials: trials.get(variant.id) ?? 0,
        conversionRate:
          (trials.get(variant.id) ?? 0) > 0
            ? (conversions.get(variant.id) ?? 0) / (trials.get(variant.id) ?? 0)
            : 0,
        averageTimeMinutes: this.calculateAverageMetric(
          experimentName,
          variant.id,
        ),
        confidence: this.calculateConfidence(
          conversions.get(variant.id) ?? 0,
          trials.get(variant.id) ?? 0,
        ),
      }),
    );

    // Determine winner (highest conversion rate with sufficient trials)
    let winner: string | undefined;
    if (variants.length >= 2) {
      const significant = variants.filter((v) => v.trials >= 30);
      if (significant.length >= 2) {
        winner = significant.reduce((a, b) =>
          a.conversionRate > b.conversionRate ? a : b,
        ).variantName;
      }
    }

    const totalTrials = Array.from(trials.values()).reduce((a, b) => a + b, 0);

    return {
      experimentName,
      variants,
      winner,
      statisticalSignificance: this.calculateStatisticalSignificance(variants),
      sampleSize: totalTrials,
    };
  }

  /**
   * Pause an experiment.
   */
  pauseExperiment(experimentName: string): void {
    const experiment = this.experiments.get(experimentName);
    if (experiment) {
      experiment.status = "paused";
    }
  }

  /**
   * Complete an experiment.
   */
  completeExperiment(experimentName: string): void {
    const experiment = this.experiments.get(experimentName);
    if (experiment) {
      experiment.status = "completed";
      experiment.endedAt = new Date();
    }
  }

  /**
   * Get all active experiments.
   */
  getActiveExperiments(): ABTestExperiment[] {
    return Array.from(this.experiments.values()).filter(
      (e) => e.status === "active",
    );
  }

  /**
   * Get experiment list.
   */
  listExperiments(): ABTestExperiment[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Deterministically select variant based on user hash.
   * Respects variant weights.
   */
  private selectVariantByHash(
    userId: string,
    variants: ABTestVariant[],
  ): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    const randomValue = Math.abs(hash) % 100;
    let cumulative = 0;

    for (const variant of variants) {
      cumulative += variant.weight * 100;
      if (randomValue < cumulative) {
        return variant.id;
      }
    }

    // Fallback to first variant
    return variants[0]?.id ?? "control";
  }

  /**
   * Calculate average metric (e.g., time) for a variant.
   */
  private calculateAverageMetric(
    experimentName: string,
    variantId: string,
  ): number | undefined {
    const data = this.conversionData.get(experimentName) ?? [];
    const variantData = data.filter((d) => d.variantId === variantId);

    if (variantData.length === 0) {
      return undefined;
    }

    const sum = variantData.reduce((a, d) => a + d.metric, 0);
    return sum / variantData.length;
  }

  /**
   * Calculate statistical confidence (simplified).
   */
  private calculateConfidence(conversions: number, trials: number): number {
    // Simple confidence based on sample size
    // Higher n = higher confidence
    // Uses simplified formula: min(1, sqrt(n) / 20)
    if (trials === 0) return 0;
    return Math.min(1, Math.sqrt(trials) / 20);
  }

  /**
   * Calculate statistical significance (simplified).
   */
  private calculateStatisticalSignificance(
    variants: ABTestVariantStats[],
  ): number {
    if (variants.length < 2) return 0;

    const minTrials = Math.min(...variants.map((v) => v.trials));
    if (minTrials < 30) return 0;

    const [first, second] = variants
      .slice()
      .sort((a, b) => b.conversionRate - a.conversionRate);

    // Simple significance check
    const diff = Math.abs(first.conversionRate - second.conversionRate);
    return Math.min(1, diff * 2); // Simplified formula
  }

  /**
   * Clear all data (for testing).
   */
  clear(): void {
    this.experiments.clear();
    this.variantAssignments.clear();
    this.conversions.clear();
    this.trials.clear();
    this.conversionData.clear();
  }
}

/**
 * Create and return pre-configured experiment manager with common experiments.
 */
export function createDefaultExperimentManager(): ABTestManager {
  const manager = new ABTestManager();

  // Experiment 1: Onboarding flow variants
  manager.createExperiment(
    "onboarding_steps",
    "Compare full wizard vs quick setup",
    [
      {
        id: "full_wizard",
        name: "Full Wizard",
        description: "Complete step-by-step wizard",
        weight: 0.5,
      },
      {
        id: "quick_setup",
        name: "Quick Setup",
        description: "Simplified 3-step quick setup",
        weight: 0.5,
      },
    ],
  );

  // Experiment 2: Integration display format
  manager.createExperiment(
    "integration_display",
    "Compare UI layouts for integration selection",
    [
      {
        id: "chips",
        name: "Chips",
        description: "Chip-style integration selection",
        weight: 0.33,
      },
      {
        id: "cards",
        name: "Cards",
        description: "Card-style with descriptions",
        weight: 0.33,
      },
      {
        id: "list",
        name: "List",
        description: "Simple list view",
        weight: 0.34,
      },
    ],
  );

  // Experiment 3: Goal selection UI
  manager.createExperiment(
    "goal_selection",
    "Compare goal selection UI patterns",
    [
      {
        id: "icons",
        name: "Icons",
        description: "Icon-based goal selection",
        weight: 0.33,
      },
      {
        id: "text",
        name: "Text",
        description: "Text-based checklist",
        weight: 0.33,
      },
      {
        id: "carousel",
        name: "Carousel",
        description: "Carousel/slider style",
        weight: 0.34,
      },
    ],
  );

  // Experiment 4: Default recommendations
  manager.createExperiment(
    "recommendations",
    "Compare recommendation strategies",
    [
      {
        id: "industry_only",
        name: "Industry Only",
        description: "Recommend based on industry",
        weight: 0.5,
      },
      {
        id: "industry_goals",
        name: "Industry + Goals",
        description: "Recommend based on industry and goals",
        weight: 0.5,
      },
    ],
  );

  return manager;
}

/**
 * Global experiment manager singleton.
 */
let globalManager: ABTestManager | null = null;

/**
 * Get or create global experiment manager.
 */
export function getExperimentManager(): ABTestManager {
  if (!globalManager) {
    globalManager = createDefaultExperimentManager();
  }
  return globalManager;
}

/**
 * Reset global manager (for testing).
 */
export function resetExperimentManager(): void {
  globalManager = null;
}
