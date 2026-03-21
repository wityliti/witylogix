/**
 * ML-Based Search Ranking
 *
 * Provides intelligent result ranking with:
 * - Feature extraction (text relevance, recency, popularity, user interactions)
 * - Weighted linear combination scoring
 * - Personalization via user interaction history
 * - Click-through rate tracking for learning
 * - A/B testing support for ranking experiments
 */

import { prisma, db } from "@witylogix/db";

// ─── TYPES ─────────────────────────────────────────────────────────────

export interface RankingFeatures {
  textRelevance: number; // 0-1, how well text matches query
  recency: number; // 0-1, normalized age (newer = higher)
  popularity: number; // 0-1, based on view/interaction count
  userInteractionScore: number; // 0-1, user's historical preference
  engagementRate: number; // 0-1, CTR / impressions
  entityType: string; // Entity type bonus (contextual relevance)
}

export interface RankingWeights {
  textRelevance: number;
  recency: number;
  popularity: number;
  userInteractionScore: number;
  engagementRate: number;
  entityTypeBonus: number;
}

export interface SearchInteraction {
  queryId: string;
  entityId: string;
  entityType: string;
  userId: string;
  tenantId: string;
  position: number; // Ranking position (0-indexed)
  clicked: boolean;
  actionTaken: boolean;
  dwellTime: number; // Milliseconds spent on result
  timestamp: Date;
}

export interface ABTestConfig {
  testId: string;
  name: string;
  enabled: boolean;
  weightingA: RankingWeights;
  weightingB: RankingWeights;
  splitPercentage: number; // 0-100, % of traffic to variant B
}

// ─── DEFAULT WEIGHTS ────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: RankingWeights = {
  textRelevance: 0.35,
  recency: 0.2,
  popularity: 0.2,
  userInteractionScore: 0.15,
  engagementRate: 0.08,
  entityTypeBonus: 0.02,
};

// ─── SEARCH RANKING ENGINE ──────────────────────────────────────────────

export class SearchRanker {
  private weights: RankingWeights;
  private userHistoryCache = new Map<string, Map<string, number>>();
  private entityPopularityCache = new Map<string, number>();
  private abTests: Map<string, ABTestConfig> = new Map();

  constructor(customWeights?: Partial<RankingWeights>) {
    this.weights = {
      ...DEFAULT_WEIGHTS,
      ...customWeights,
    };
  }

  /**
   * Extract ranking features from search result
   */
  async extractFeatures(
    entityId: string,
    entityType: string,
    query: string,
    contentSnippet: string,
    createdAt: Date,
    userId: string,
    tenantId: string
  ): Promise<RankingFeatures> {
    const features: RankingFeatures = {
      textRelevance: this.calculateTextRelevance(query, contentSnippet),
      recency: this.calculateRecency(createdAt),
      popularity: await this.calculatePopularity(entityId, tenantId),
      userInteractionScore: await this.getUserInteractionScore(
        userId,
        entityId,
        tenantId
      ),
      engagementRate: await this.calculateEngagementRate(entityId, tenantId),
      entityType,
    };

    return features;
  }

  /**
   * Score and rank results using weighted combination
   */
  scoreResult(
    features: RankingFeatures,
    userId?: string,
    testId?: string
  ): number {
    let weights = this.weights;

    // Apply A/B test if applicable
    if (userId && testId) {
      const test = this.abTests.get(testId);
      if (test && test.enabled) {
        const userVariant = this.getUserVariant(userId, test.splitPercentage);
        weights = userVariant === "B" ? test.weightingB : test.weightingA;
      }
    }

    const score =
      features.textRelevance * weights.textRelevance +
      features.recency * weights.recency +
      features.popularity * weights.popularity +
      features.userInteractionScore * weights.userInteractionScore +
      features.engagementRate * weights.engagementRate;

    return Math.min(1, score); // Normalize to 0-1
  }

  /**
   * Track user interaction with search result
   */
  async trackInteraction(
    interaction: SearchInteraction
  ): Promise<void> {
    // Store interaction in database for learning
    await db.searchInteraction.create({
      data: {
        queryId: interaction.queryId,
        entityId: interaction.entityId,
        entityType: interaction.entityType,
        userId: interaction.userId,
        tenantId: interaction.tenantId,
        position: interaction.position,
        clicked: interaction.clicked,
        actionTaken: interaction.actionTaken,
        dwellTime: interaction.dwellTime,
        timestamp: interaction.timestamp,
      },
    });

    // Update user history cache
    const key = `${interaction.tenantId}:${interaction.userId}`;
    if (!this.userHistoryCache.has(key)) {
      this.userHistoryCache.set(key, new Map());
    }
    const userHistory = this.userHistoryCache.get(key)!;
    const currentScore = userHistory.get(interaction.entityId) || 0;
    const boost = interaction.actionTaken ? 0.3 : interaction.clicked ? 0.1 : 0;
    userHistory.set(interaction.entityId, Math.min(1, currentScore + boost));

    // Update entity popularity
    const popKey = `${interaction.tenantId}:${interaction.entityId}`;
    const currentPop = this.entityPopularityCache.get(popKey) || 0;
    const popBoost = interaction.actionTaken ? 0.02 : interaction.clicked ? 0.005 : 0;
    this.entityPopularityCache.set(popKey, Math.min(1, currentPop + popBoost));
  }

  /**
   * Create or update A/B test
   */
  registerABTest(config: ABTestConfig): void {
    this.abTests.set(config.testId, config);
  }

  /**
   * Get A/B test results
   */
  async getTestResults(
    testId: string
  ): Promise<{ variantA: number; variantB: number }> {
    const test = this.abTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const interactions = await db.searchInteraction.findMany({
      where: {
        // Filter by test period/condition
      },
    });

    let variantAClicks = 0;
    let variantBClicks = 0;
    let variantAImpressions = 0;
    let variantBImpressions = 0;

    for (const interaction of interactions) {
      const variant = this.getUserVariant(
        interaction.userId,
        test.splitPercentage
      );

      if (variant === "A") {
        variantAImpressions++;
        if (interaction.clicked) variantAClicks++;
      } else {
        variantBImpressions++;
        if (interaction.clicked) variantBClicks++;
      }
    }

    return {
      variantA: variantAImpressions > 0 ? variantAClicks / variantAImpressions : 0,
      variantB: variantBImpressions > 0 ? variantBClicks / variantBImpressions : 0,
    };
  }

  /**
   * Update ranking weights based on performance
   */
  updateWeights(newWeights: Partial<RankingWeights>): void {
    this.weights = {
      ...this.weights,
      ...newWeights,
    };
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────

  private calculateTextRelevance(query: string, snippet: string): number {
    const queryTerms = query.toLowerCase().split(/\W+/).filter((t) => t);
    const snippetLower = snippet.toLowerCase();

    if (queryTerms.length === 0) return 0;

    let matches = 0;
    queryTerms.forEach((term) => {
      if (snippetLower.includes(term)) {
        matches++;
      }
    });

    // Exact phrase match boost
    const hasExactMatch = snippetLower.includes(query.toLowerCase());

    const baseScore = matches / queryTerms.length;
    return hasExactMatch ? Math.min(1, baseScore + 0.2) : baseScore;
  }

  private calculateRecency(createdAt: Date): number {
    const ageMs = Date.now() - createdAt.getTime();
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000; // 30 days

    // Exponential decay: newer items score higher
    return Math.exp(-ageMs / (maxAgeMs * 2));
  }

  private async calculatePopularity(
    entityId: string,
    tenantId: string
  ): Promise<number> {
    // Check cache first
    const cacheKey = `${tenantId}:${entityId}`;
    if (this.entityPopularityCache.has(cacheKey)) {
      return this.entityPopularityCache.get(cacheKey) || 0;
    }

    // Count interactions
    const interactions = await db.searchInteraction.findMany({
      where: { entityId, tenantId },
    });

    const clickCount = interactions.filter((i: any) => i.clicked).length;
    const actionCount = interactions.filter((i: any) => i.actionTaken).length;

    // Normalize: 5 actions = popularity 0.5, 10+ = 1.0
    const popularity = Math.min(1, (clickCount + actionCount * 2) / 20);

    // Cache for 1 hour
    this.entityPopularityCache.set(cacheKey, popularity);
    setTimeout(() => this.entityPopularityCache.delete(cacheKey), 60 * 60 * 1000);

    return popularity;
  }

  private async getUserInteractionScore(
    userId: string,
    entityId: string,
    tenantId: string
  ): Promise<number> {
    const cacheKey = `${tenantId}:${userId}`;
    const userHistory = this.userHistoryCache.get(cacheKey);

    if (userHistory) {
      return userHistory.get(entityId) || 0;
    }

    // Load from database
    const interactions = await db.searchInteraction.findMany({
      where: { userId, entityId, tenantId },
      select: { clicked: true, actionTaken: true },
    });

    let score = 0;
    interactions.forEach((i: any) => {
      score += i.actionTaken ? 0.3 : i.clicked ? 0.1 : 0;
    });

    // Cache
    if (!this.userHistoryCache.has(cacheKey)) {
      this.userHistoryCache.set(cacheKey, new Map());
    }
    this.userHistoryCache.get(cacheKey)!.set(entityId, Math.min(1, score));

    return Math.min(1, score);
  }

  private async calculateEngagementRate(
    entityId: string,
    tenantId: string
  ): Promise<number> {
    const interactions = await db.searchInteraction.findMany({
      where: { entityId, tenantId },
    });

    if (interactions.length === 0) return 0;

    const clickCount = interactions.filter((i: any) => i.clicked).length;
    return clickCount / interactions.length;
  }

  private getUserVariant(userId: string, splitPercentage: number): "A" | "B" {
    // Deterministic assignment based on user ID
    const hash = Array.from(userId).reduce(
      (h, c) => (h * 31 + c.charCodeAt(0)) | 0,
      0
    );
    return Math.abs(hash % 100) < splitPercentage ? "B" : "A";
  }
}

// ─── FACTORY ────────────────────────────────────────────────────────────

export function createSearchRanker(
  customWeights?: Partial<RankingWeights>
): SearchRanker {
  return new SearchRanker(customWeights);
}

// ─── GLOBAL INSTANCE ────────────────────────────────────────────────────

let globalRanker: SearchRanker | null = null;

export function getSearchRanker(): SearchRanker {
  if (!globalRanker) {
    globalRanker = new SearchRanker();
  }
  return globalRanker;
}
