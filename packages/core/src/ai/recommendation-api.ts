/**
 * Recommendation API
 *
 * REST API endpoint handlers for integration recommendations:
 * - GET /api/integrations/recommendations — personalized recommendations
 * - GET /api/integrations/recommendations/:industry — industry-specific
 * - GET /api/integrations/dependencies/:providerId — synergies
 * - GET /api/integrations/gaps — missing category coverage
 * - POST /api/integrations/recommendations/feedback — track accept/dismiss
 * - A/B test framework for different algorithms
 */

import type { IntegrationRecommendation, TenantIntegrationProfile, CategoryCoverageSummary } from './integration-recommender.js';
import { IntegrationRecommender, IntegrationDependencyGraph, analyzeCategoryGaps, type IndustryType } from './integration-recommender.js';

// ─── TYPES ──────────────────────────────────────────────────────────────

export type RecommendationAlgorithm = 'relevance' | 'industry-first' | 'workflow-first' | 'popularity';

export interface RecommendationResponse {
  recommendations: IntegrationRecommendation[];
  algorithm: RecommendationAlgorithm;
  timestamp: string;
  tenantId: string;
  industry?: IndustryType;
}

export interface DependencyResponse {
  providerId: string;
  providerName: string;
  complementary: Array<{ id: string; name: string; synergyType: string; weight: number }>;
  graphData: { nodes: Array<{ id: string; label: string }>; edges: any[] };
}

export interface GapAnalysisResponse {
  tenantId: string;
  industry: IndustryType;
  coverage: CategoryCoverageSummary;
  recommendations: Array<{ providerId: string; providerName: string; fillsGap: string }>;
}

export interface RecommendationFeedback {
  tenantId: string;
  userId: string;
  providerId: string;
  action: 'accepted' | 'dismissed' | 'clicked' | 'setup_started';
  timestamp: string;
  abTestVariant?: string;
  dwellTimeSeconds?: number;
}

export interface ABTestConfig {
  variant: RecommendationAlgorithm;
  weight: number; // 0-1, percentage of traffic
  enabled: boolean;
}

// ─── RECOMMENDATION SERVICE ──────────────────────────────────────────────

export class RecommendationService {
  private recommender: IntegrationRecommender;
  private dependencyGraph: IntegrationDependencyGraph;
  private feedbackStore: Map<string, RecommendationFeedback[]> = new Map();
  private abTestConfig: Map<RecommendationAlgorithm, ABTestConfig> = new Map();

  constructor() {
    this.recommender = new IntegrationRecommender();
    this.dependencyGraph = new IntegrationDependencyGraph();
    this.initializeABTests();
  }

  /**
   * GET /api/integrations/recommendations
   * Get personalized recommendations for a tenant
   */
  async getRecommendations(
    tenantId: string,
    profile: TenantIntegrationProfile,
    limit: number = 10,
    algorithm?: RecommendationAlgorithm
  ): Promise<RecommendationResponse> {
    const selectedAlgorithm = algorithm ?? this.selectABTestVariant();

    let recommendations: IntegrationRecommendation[];

    switch (selectedAlgorithm) {
      case 'industry-first':
        recommendations = this.getIndustryFirstRecommendations(profile, limit);
        break;
      case 'workflow-first':
        recommendations = this.getWorkflowFirstRecommendations(profile, limit);
        break;
      case 'popularity':
        recommendations = this.getPopularityRecommendations(profile, limit);
        break;
      case 'relevance':
      default:
        recommendations = this.recommender.getRecommendations(profile, limit);
        break;
    }

    return {
      recommendations,
      algorithm: selectedAlgorithm,
      timestamp: new Date().toISOString(),
      tenantId,
      industry: profile.industry,
    };
  }

  /**
   * GET /api/integrations/recommendations/:industry
   * Industry-specific recommendations
   */
  async getIndustryRecommendations(
    industry: IndustryType,
    connectedIds: string[] = [],
    limit: number = 10
  ): Promise<RecommendationResponse> {
    const recommendations = this.recommender
      .getIndustryRecommendations(industry, connectedIds)
      .slice(0, limit);

    return {
      recommendations,
      algorithm: 'industry-first',
      timestamp: new Date().toISOString(),
      tenantId: '',
      industry,
    };
  }

  /**
   * GET /api/integrations/dependencies/:providerId
   * Get providers that synergize with the given provider
   */
  async getDependencies(providerId: string, connectedIds: string[] = []): Promise<DependencyResponse> {
    const registry = require('../integrations/registry/integration-registry.js').integrationRegistry;
    const provider = registry.getProvider(providerId);

    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const complementary = this.dependencyGraph.getComplementaryProviders(providerId, connectedIds);
    const complementaryDetails = complementary.map((id) => {
      const p = registry.getProvider(id);
      return {
        id,
        name: p?.name ?? 'Unknown',
        synergyType: 'complement',
        weight: 0.75,
      };
    });

    const graphData = this.dependencyGraph.getGraphData([providerId, ...connectedIds]);

    return {
      providerId,
      providerName: provider.name,
      complementary: complementaryDetails,
      graphData,
    };
  }

  /**
   * GET /api/integrations/gaps
   * Detect missing integrations in critical categories
   */
  async analyzeGaps(
    tenantId: string,
    industry: IndustryType,
    connectedProviderIds: string[]
  ): Promise<GapAnalysisResponse> {
    const coverage = analyzeCategoryGaps(connectedProviderIds, industry);

    const recommendations = coverage.recommendations
      .map((id) => {
        const registry = require('../integrations/registry/integration-registry.js').integrationRegistry;
        const provider = registry.getProvider(id);
        const gap = coverage.gaps.find((g) =>
          (provider?.category ?? '').includes(g.replace(/\s/g, '-'))
        );
        return {
          providerId: id,
          providerName: provider?.name ?? 'Unknown',
          fillsGap: gap ?? 'general',
        };
      });

    return {
      tenantId,
      industry,
      coverage,
      recommendations,
    };
  }

  /**
   * POST /api/integrations/recommendations/feedback
   * Track recommendation feedback (accept, dismiss, etc.)
   */
  async recordFeedback(feedback: RecommendationFeedback): Promise<void> {
    const key = feedback.tenantId;
    if (!this.feedbackStore.has(key)) {
      this.feedbackStore.set(key, []);
    }
    this.feedbackStore.get(key)!.push(feedback);

    // Persist to database in real implementation
    this.persistFeedback(feedback);
  }

  /**
   * Get feedback analytics for a tenant
   */
  async getFeedbackAnalytics(tenantId: string): Promise<Record<string, unknown>> {
    const feedback = this.feedbackStore.get(tenantId) ?? [];

    const accepted = feedback.filter((f) => f.action === 'accepted').length;
    const dismissed = feedback.filter((f) => f.action === 'dismissed').length;
    const clicked = feedback.filter((f) => f.action === 'clicked').length;
    const setupStarted = feedback.filter((f) => f.action === 'setup_started').length;

    const acceptanceRate = feedback.length > 0 ? (accepted / feedback.length) * 100 : 0;
    const conversionRate = feedback.length > 0 ? (setupStarted / feedback.length) * 100 : 0;

    const avgDwellTime =
      feedback.filter((f) => f.dwellTimeSeconds).reduce((sum, f) => sum + (f.dwellTimeSeconds ?? 0), 0) /
      feedback.filter((f) => f.dwellTimeSeconds).length;

    const byProvider: Record<string, { accepted: number; dismissed: number; setupStarted: number }> = {};
    for (const f of feedback) {
      if (!byProvider[f.providerId]) {
        byProvider[f.providerId] = { accepted: 0, dismissed: 0, setupStarted: 0 };
      }
      if (f.action === 'accepted') byProvider[f.providerId].accepted++;
      if (f.action === 'dismissed') byProvider[f.providerId].dismissed++;
      if (f.action === 'setup_started') byProvider[f.providerId].setupStarted++;
    }

    return {
      totalFeedbackRecords: feedback.length,
      acceptanceRate: Math.round(acceptanceRate),
      dismissalRate: Math.round(100 - acceptanceRate),
      clickRate: Math.round((clicked / feedback.length) * 100),
      conversionRate: Math.round(conversionRate),
      avgDwellTimeSeconds: Math.round(avgDwellTime),
      byProvider,
    };
  }

  /**
   * Initialize A/B test configuration
   */
  private initializeABTests(): void {
    this.abTestConfig.set('relevance', { variant: 'relevance', weight: 0.5, enabled: true });
    this.abTestConfig.set('industry-first', { variant: 'industry-first', weight: 0.25, enabled: true });
    this.abTestConfig.set('workflow-first', { variant: 'workflow-first', weight: 0.15, enabled: true });
    this.abTestConfig.set('popularity', { variant: 'popularity', weight: 0.1, enabled: true });
  }

  /**
   * Select A/B test variant based on weights
   */
  private selectABTestVariant(): RecommendationAlgorithm {
    const enabledTests = Array.from(this.abTestConfig.values()).filter((c) => c.enabled);
    const totalWeight = enabledTests.reduce((sum, c) => sum + c.weight, 0);

    const rand = Math.random() * totalWeight;
    let cumulative = 0;

    for (const config of enabledTests) {
      cumulative += config.weight;
      if (rand <= cumulative) {
        return config.variant;
      }
    }

    return 'relevance';
  }

  /**
   * Industry-first ranking algorithm
   */
  private getIndustryFirstRecommendations(
    profile: TenantIntegrationProfile,
    limit: number
  ): IntegrationRecommendation[] {
    return this.recommender
      .getRecommendations(profile, limit * 2)
      .sort((a, b) => b.industryMatch - a.industryMatch)
      .slice(0, limit);
  }

  /**
   * Workflow-first ranking algorithm
   */
  private getWorkflowFirstRecommendations(
    profile: TenantIntegrationProfile,
    limit: number
  ): IntegrationRecommendation[] {
    return this.recommender
      .getRecommendations(profile, limit * 2)
      .sort((a, b) => b.workflowComplement - a.workflowComplement)
      .slice(0, limit);
  }

  /**
   * Popularity-first ranking algorithm
   */
  private getPopularityRecommendations(
    profile: TenantIntegrationProfile,
    limit: number
  ): IntegrationRecommendation[] {
    return this.recommender
      .getRecommendations(profile, limit * 2)
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit);
  }

  /**
   * Persist feedback to database
   */
  private persistFeedback(feedback: RecommendationFeedback): void {
    // In a real implementation, save to database:
    // await db.recommendationFeedback.create(feedback);
  }

  /**
   * Update A/B test configuration
   */
  updateABTestConfig(configs: ABTestConfig[]): void {
    for (const config of configs) {
      this.abTestConfig.set(config.variant, config);
    }
  }

  /**
   * Get current A/B test configuration
   */
  getABTestConfig(): ABTestConfig[] {
    return Array.from(this.abTestConfig.values());
  }
}

// ─── RECOMMENDATION CACHE ────────────────────────────────────────────────

export class RecommendationCache {
  private cache: Map<string, { data: RecommendationResponse; expiresAt: number }> = new Map();
  private readonly ttlMs = 1000 * 60 * 60; // 1 hour

  set(key: string, data: RecommendationResponse): void {
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  get(key: string): RecommendationResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// ─── SINGLETON INSTANCES ────────────────────────────────────────────────

export const recommendationService = new RecommendationService();
export const recommendationCache = new RecommendationCache();

// ─── EXPORTS ────────────────────────────────────────────────────────────
