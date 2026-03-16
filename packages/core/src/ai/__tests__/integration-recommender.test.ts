/**
 * Tests for Integration Recommender
 *
 * Tests industry detection, provider scoring, workflow detection,
 * dependency graphs, and category gap analysis.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  IntegrationRecommender,
  IntegrationDependencyGraph,
  analyzeCategoryGaps,
  type TenantIntegrationProfile,
  type IndustryType,
} from '../integration-recommender.js';

describe('IntegrationRecommender', () => {
  let recommender: IntegrationRecommender;

  beforeEach(() => {
    const dependencyGraph = new IntegrationDependencyGraph();
    recommender = new IntegrationRecommender(undefined, dependencyGraph);
  });

  describe('Industry Detection', () => {
    it('should detect restaurant industry from company name', () => {
      const industry = recommender.detectIndustry('Olive Garden', '');
      expect(industry).toBe('restaurant');
    });

    it('should detect ecommerce from description', () => {
      const industry = recommender.detectIndustry(
        'Tech Shop',
        'Online retail store for electronics and gadgets'
      );
      expect(industry).toBe('ecommerce');
    });

    it('should detect logistics from multiple keywords', () => {
      const industry = recommender.detectIndustry(
        'QuickTruck Logistics',
        'Freight and trucking services for nationwide delivery'
      );
      expect(industry).toBe('logistics_trucking');
    });

    it('should detect healthcare delivery', () => {
      const industry = recommender.detectIndustry(
        'MediCare Dispatch',
        'Healthcare delivery and telemedicine services'
      );
      expect(industry).toBe('healthcare_delivery');
    });

    it('should detect field service industry', () => {
      const industry = recommender.detectIndustry(
        'PlumbTech Solutions',
        'HVAC and plumbing contractor services'
      );
      expect(industry).toBe('field_service');
    });

    it('should default to general for unknown industry', () => {
      const industry = recommender.detectIndustry(
        'XYZ Corporation',
        'We do things'
      );
      expect(industry).toBe('general');
    });
  });

  describe('Workflow Detection', () => {
    it('should detect routing workflow from connected providers', () => {
      const workflows = recommender.detectWorkflows(['valhalla']);
      expect(workflows).toContain('routing');
    });

    it('should detect payments workflow', () => {
      const workflows = recommender.detectWorkflows(['stripe']);
      expect(workflows).toContain('payments');
    });

    it('should detect multiple workflows', () => {
      const workflows = recommender.detectWorkflows(['stripe', 'valhalla', 'samsara']);
      expect(workflows).toContain('payments');
      expect(workflows).toContain('routing');
      expect(workflows).toContain('telematics');
    });

    it('should return empty array for no connected providers', () => {
      const workflows = recommender.detectWorkflows([]);
      expect(workflows.length).toBe(0);
    });
  });

  describe('Personalized Recommendations', () => {
    it('should return recommendations for restaurant tenant', () => {
      const profile: TenantIntegrationProfile = {
        tenantId: 'tenant-1',
        industry: 'restaurant',
        businessSize: 'growth',
        detectedWorkflows: [],
        connectedProviderIds: [],
      };

      const recommendations = recommender.getRecommendations(profile, 5);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.length).toBeLessThanOrEqual(5);
      expect(recommendations[0].relevanceScore).toBeGreaterThan(0);
    });

    it('should exclude already connected providers', () => {
      const profile: TenantIntegrationProfile = {
        tenantId: 'tenant-1',
        industry: 'restaurant',
        businessSize: 'growth',
        detectedWorkflows: [],
        connectedProviderIds: ['stripe', 'shopify'],
      };

      const recommendations = recommender.getRecommendations(profile, 10);
      const providerIds = recommendations.map((r) => r.providerId);

      expect(providerIds).not.toContain('stripe');
      expect(providerIds).not.toContain('shopify');
    });

    it('should score based on industry match', () => {
      const profile: TenantIntegrationProfile = {
        tenantId: 'tenant-1',
        industry: 'restaurant',
        businessSize: 'growth',
        detectedWorkflows: [],
        connectedProviderIds: [],
      };

      const recommendations = recommender.getRecommendations(profile, 10);

      // Toast POS should score highly for restaurants
      const toastRec = recommendations.find((r) => r.providerId === 'toast-pos');
      expect(toastRec).toBeDefined();
      if (toastRec) {
        expect(toastRec.industryMatch).toBeGreaterThan(70);
      }
    });

    it('should score based on workflow complement', () => {
      const profile: TenantIntegrationProfile = {
        tenantId: 'tenant-1',
        industry: 'general',
        businessSize: 'growth',
        detectedWorkflows: ['payments'],
        connectedProviderIds: [],
      };

      const recommendations = recommender.getRecommendations(profile, 10);

      // Accounting software should score higher if payments workflow is detected
      const qbRec = recommendations.find((r) => r.providerId === 'quickbooks');
      if (qbRec) {
        expect(qbRec.workflowComplement).toBeGreaterThan(30);
      }
    });

    it('should have relevance score between 0-100', () => {
      const profile: TenantIntegrationProfile = {
        tenantId: 'tenant-1',
        industry: 'ecommerce',
        businessSize: 'growth',
        detectedWorkflows: ['inventory'],
        connectedProviderIds: [],
      };

      const recommendations = recommender.getRecommendations(profile, 10);

      recommendations.forEach((rec) => {
        expect(rec.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(rec.relevanceScore).toBeLessThanOrEqual(100);
        expect(rec.industryMatch).toBeGreaterThanOrEqual(0);
        expect(rec.industryMatch).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Industry-Specific Recommendations', () => {
    it('should recommend restaurant providers for restaurant industry', () => {
      const recommendations = recommender.getIndustryRecommendations('restaurant', []);

      expect(recommendations.length).toBeGreaterThan(0);
      const providerIds = recommendations.map((r) => r.providerId);

      expect(providerIds).toContain('toast-pos');
    });

    it('should recommend ecommerce providers for ecommerce industry', () => {
      const recommendations = recommender.getIndustryRecommendations('ecommerce', []);

      expect(recommendations.length).toBeGreaterThan(0);
      const providerIds = recommendations.map((r) => r.providerId);

      expect(providerIds).toContain('shopify');
    });

    it('should exclude already connected providers', () => {
      const recommendations = recommender.getIndustryRecommendations(
        'logistics_trucking',
        ['samsara']
      );

      const providerIds = recommendations.map((r) => r.providerId);
      expect(providerIds).not.toContain('samsara');
    });
  });

  describe('Setup Time Estimation', () => {
    it('should estimate setup time based on auth method and features', () => {
      const profile: TenantIntegrationProfile = {
        tenantId: 'tenant-1',
        industry: 'general',
        businessSize: 'growth',
        detectedWorkflows: [],
        connectedProviderIds: [],
      };

      const recommendations = recommender.getRecommendations(profile, 10);

      recommendations.forEach((rec) => {
        expect(rec.setupEstimateMinutes).toBeGreaterThan(0);
        expect(rec.setupEstimateMinutes).toBeLessThan(60);
      });
    });

    it('should mark OAuth integrations as moderate or complex', () => {
      const profile: TenantIntegrationProfile = {
        tenantId: 'tenant-1',
        industry: 'general',
        businessSize: 'growth',
        detectedWorkflows: [],
        connectedProviderIds: [],
      };

      const recommendations = recommender.getRecommendations(profile, 10);
      const oauthRec = recommendations.find((r) => r.providerId === 'shopify');

      if (oauthRec) {
        expect(['moderate', 'complex']).toContain(oauthRec.setupComplexity);
      }
    });
  });

  describe('Recommendation Reasons', () => {
    it('should generate human-readable reasons', () => {
      const profile: TenantIntegrationProfile = {
        tenantId: 'tenant-1',
        industry: 'restaurant',
        businessSize: 'growth',
        detectedWorkflows: [],
        connectedProviderIds: [],
      };

      const recommendations = recommender.getRecommendations(profile, 10);

      recommendations.forEach((rec) => {
        expect(rec.reason).toBeTruthy();
        expect(rec.reason.length).toBeGreaterThan(10);
      });
    });
  });
});

describe('IntegrationDependencyGraph', () => {
  let graph: IntegrationDependencyGraph;

  beforeEach(() => {
    graph = new IntegrationDependencyGraph();
  });

  describe('Complementary Providers', () => {
    it('should return complementary providers', () => {
      const complementary = graph.getComplementaryProviders('valhalla');

      expect(complementary.length).toBeGreaterThan(0);
      expect(complementary).toContain('google-maps');
    });

    it('should exclude specified provider IDs', () => {
      const complementary = graph.getComplementaryProviders('valhalla', ['google-maps']);

      expect(complementary).not.toContain('valhalla');
      expect(complementary).not.toContain('google-maps');
    });

    it('should return max 3 complementary providers', () => {
      const complementary = graph.getComplementaryProviders('stripe');

      expect(complementary.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Synergy Scoring', () => {
    it('should calculate synergy score for connected providers', () => {
      const score = graph.getSynergyScore('stripe', ['shopify']);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return 0 for unrelated providers', () => {
      const score = graph.getSynergyScore('stripe', ['unknown-provider']);

      expect(score).toBe(0);
    });

    it('should increase score for multiple synergistic providers', () => {
      const score1 = graph.getSynergyScore('stripe', ['shopify']);
      const score2 = graph.getSynergyScore('stripe', ['shopify', 'sendgrid']);

      expect(score2).toBeGreaterThanOrEqual(score1);
    });
  });

  describe('Graph Visualization Data', () => {
    it('should generate graph data with nodes and edges', () => {
      const graphData = graph.getGraphData(['stripe', 'shopify']);

      expect(graphData.nodes).toBeDefined();
      expect(graphData.edges).toBeDefined();
      expect(graphData.nodes.length).toBeGreaterThan(0);
    });

    it('should include selected nodes in graph', () => {
      const graphData = graph.getGraphData(['stripe', 'shopify']);

      const nodeIds = graphData.nodes.map((n) => n.id);
      expect(nodeIds).toContain('stripe');
      expect(nodeIds).toContain('shopify');
    });

    it('should include edges between nodes', () => {
      const graphData = graph.getGraphData(['stripe', 'shopify']);

      // Stripe and Shopify should have an edge
      const hasEdge = graphData.edges.some(
        (e: any) =>
          (e.from === 'stripe' && e.to === 'shopify') ||
          (e.from === 'shopify' && e.to === 'stripe')
      );

      expect(hasEdge).toBe(true);
    });
  });
});

describe('Category Gap Analysis', () => {
  it('should detect gaps in critical categories', () => {
    const coverage = analyzeCategoryGaps(['stripe'], 'restaurant');

    expect(coverage.gaps.length).toBeGreaterThan(0);
    expect(coverage.gaps).toContain('pos-restaurant');
  });

  it('should provide recommendations to fill gaps', () => {
    const coverage = analyzeCategoryGaps(['stripe'], 'ecommerce');

    expect(coverage.recommendations.length).toBeGreaterThan(0);
  });

  it('should calculate overall coverage percentage', () => {
    const coverage = analyzeCategoryGaps(['stripe', 'shipstation'], 'ecommerce');

    expect(coverage.overallCoverage).toBeGreaterThanOrEqual(0);
    expect(coverage.overallCoverage).toBeLessThanOrEqual(100);
  });

  it('should have full coverage with all providers', () => {
    const allProviders = [
      'stripe',
      'shopify',
      'shipstation',
      'sendgrid',
      'easypost',
    ];
    const coverage = analyzeCategoryGaps(allProviders, 'ecommerce');

    expect(coverage.overallCoverage).toBe(100);
    expect(coverage.gaps.length).toBe(0);
  });

  it('should mark critical categories correctly', () => {
    const coverage = analyzeCategoryGaps([], 'logistics_trucking');

    expect(coverage.gaps).toContain('telematics');
    expect(coverage.gaps).toContain('eld');
  });
});

describe('Recommendation Determinism', () => {
  it('should return consistent results for same input', () => {
    const profile: TenantIntegrationProfile = {
      tenantId: 'tenant-1',
      industry: 'restaurant',
      businessSize: 'growth',
      detectedWorkflows: ['payments'],
      connectedProviderIds: ['stripe'],
    };

    const recommender1 = new IntegrationRecommender();
    const recommender2 = new IntegrationRecommender();

    const recs1 = recommender1.getRecommendations(profile, 5);
    const recs2 = recommender2.getRecommendations(profile, 5);

    expect(recs1.map((r) => r.providerId)).toEqual(recs2.map((r) => r.providerId));
    expect(recs1.map((r) => r.relevanceScore)).toEqual(recs2.map((r) => r.relevanceScore));
  });
});
