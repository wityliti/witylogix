/**
 * AI-Powered Smart Integration Recommender
 *
 * Provides intelligent, personalized integration recommendations based on:
 * - Industry detection (restaurant, ecommerce, logistics, healthcare, field-service, etc.)
 * - Workflow analysis (payments, routing, telematics, etc.)
 * - Integration dependency graph (which integrations synergize)
 * - Tenant's existing connections
 * - Popularity & relevance scoring
 *
 * Core algorithm: Relevance Score = (Industry Match × 40) + (Workflow Complement × 35) + (Popularity × 20) + (Synergy Score × 5)
 * Deterministic & testable — no external LLM calls.
 */

import type { IntegrationProvider } from '../integrations/registry/integration-registry.js';
import { integrationRegistry } from '../integrations/registry/integration-registry.js';

// ─── TYPES ──────────────────────────────────────────────────────────────

export type IndustryType =
  | 'restaurant'
  | 'ecommerce'
  | 'logistics_trucking'
  | 'healthcare_delivery'
  | 'field_service'
  | 'wholesale_distribution'
  | 'general';

export type WorkflowType =
  | 'routing'
  | 'payments'
  | 'telematics'
  | 'fulfillment'
  | 'customer_communication'
  | 'accounting'
  | 'inventory'
  | 'order_management';

export interface IntegrationRecommendation {
  providerId: string;
  providerName: string;
  category: string;
  relevanceScore: number; // 0-100
  industryMatch: number; // 0-100
  workflowComplement: number; // 0-100
  popularityScore: number; // 0-100
  reason: string;
  setupEstimateMinutes: number;
  setupComplexity: 'simple' | 'moderate' | 'complex';
  synergiesWithConnected: string[]; // IDs of tenant's providers that this synergizes with
}

export interface TenantIntegrationProfile {
  tenantId: string;
  industry: IndustryType;
  businessSize: 'starter' | 'growth' | 'enterprise';
  detectedWorkflows: WorkflowType[];
  connectedProviderIds: string[];
  companyDescription?: string;
}

// ─── INDUSTRY ↔ PROVIDER MAPPING ────────────────────────────────────────

const INDUSTRY_PROVIDER_MAP: Record<IndustryType, { providers: string[]; weights: Record<string, number> }> = {
  restaurant: {
    providers: ['toast-pos', 'square-for-restaurants', 'doordash-drive', 'uber-eats', 'stripe', 'twilio', 'square-payments'],
    weights: {
      'toast-pos': 0.95,
      'square-for-restaurants': 0.90,
      'doordash-drive': 0.85,
      'uber-eats': 0.80,
      'stripe': 0.75,
      'square-payments': 0.72,
      'twilio': 0.70,
      'sendgrid': 0.55,
      'quickbooks': 0.65,
    },
  },
  ecommerce: {
    providers: ['shopify', 'stripe', 'shipstation', 'sendgrid', 'easypost', 'amazon-seller-central'],
    weights: {
      'shopify': 0.95,
      'stripe': 0.90,
      'shipstation': 0.85,
      'sendgrid': 0.80,
      'easypost': 0.78,
      'amazon-seller-central': 0.75,
      'quickbooks': 0.70,
      'google-analytics': 0.65,
    },
  },
  logistics_trucking: {
    providers: ['samsara', 'motive-eld', 'dat-load-board', 'fedex', 'geotab'],
    weights: {
      'samsara': 0.95,
      'motive-eld': 0.92,
      'dat-load-board': 0.88,
      'geotab': 0.85,
      'verizon-connect': 0.82,
      'omnitracs': 0.80,
      'quickbooks': 0.70,
      'google-maps': 0.68,
      'twilio': 0.60,
    },
  },
  healthcare_delivery: {
    providers: ['epic', 'docusign', 'twilio', 'google-maps', 'hl7-fhir'],
    weights: {
      'epic': 0.95,
      'hl7-fhir': 0.90,
      'docusign': 0.85,
      'twilio': 0.80,
      'google-maps': 0.75,
      'cerner': 0.80,
      'quickbooks': 0.65,
    },
  },
  field_service: {
    providers: ['servicetitan', 'jobber', 'stripe', 'twilio', 'google-maps'],
    weights: {
      'servicetitan': 0.95,
      'jobber': 0.92,
      'stripe': 0.88,
      'twilio': 0.85,
      'google-maps': 0.80,
      'housecall-pro': 0.85,
      'quickbooks': 0.75,
      'slack': 0.70,
    },
  },
  wholesale_distribution: {
    providers: ['sap', 'oracle-netsuite', 'manhattan-associates', 'quickbooks', 'salesforce'],
    weights: {
      'sap': 0.95,
      'oracle-netsuite': 0.92,
      'manhattan-associates': 0.90,
      'quickbooks': 0.85,
      'salesforce': 0.80,
      'microsoft-dynamics-365': 0.85,
      'amazon-seller-central': 0.60,
    },
  },
  general: {
    providers: [],
    weights: {},
  },
};

// ─── WORKFLOW ↔ PROVIDER MAPPING ────────────────────────────────────────

const WORKFLOW_PROVIDER_MAP: Record<WorkflowType, string[]> = {
  routing: ['valhalla', 'vroom', 'google-routes-api', 'mapbox-directions', 'here-routing', 'route4me'],
  payments: ['stripe', 'square-payments', 'paypal', 'braintree', 'authorize-net', 'adyen'],
  telematics: ['samsara', 'geotab', 'verizon-connect', 'trimble', 'flespi', 'azuga'],
  fulfillment: ['shipstation', 'easypost', 'shippo', 'fedex', 'ups', 'usps'],
  customer_communication: ['twilio', 'sendgrid', 'mailgun', 'slack', 'whatsapp-business', 'onesignal'],
  accounting: ['quickbooks', 'xero', 'sage', 'wave', 'freshbooks'],
  inventory: ['fishbowl', 'shopify', 'woocommerce', 'magento', 'square-online'],
  order_management: ['shopify', 'woocommerce', 'square-online', 'toast-pos', 'magento'],
};

// ─── PROVIDER POPULARITY BASELINE ───────────────────────────────────────

const PROVIDER_POPULARITY: Record<string, number> = {
  'stripe': 95,
  'shopify': 92,
  'google-maps': 90,
  'twilio': 88,
  'sendgrid': 86,
  'salesforce': 84,
  'quickbooks': 82,
  'samsara': 80,
  'slack': 78,
  'amazon-seller-central': 76,
  'fedex': 75,
  'toast-pos': 72,
  'valhalla': 70,
  'mapbox': 68,
  'here-maps': 65,
};

// ─── INTEGRATION RECOMMENDER ENGINE ──────────────────────────────────────

export class IntegrationRecommender {
  constructor(
    private registry = integrationRegistry,
    private dependencyGraph?: IntegrationDependencyGraph
  ) {}

  /**
   * Generate personalized recommendations for a tenant
   */
  getRecommendations(
    profile: TenantIntegrationProfile,
    limit: number = 10
  ): IntegrationRecommendation[] {
    const allProviders = this.registry.getProduction();
    const connected = new Set(profile.connectedProviderIds);

    const recommendations: IntegrationRecommendation[] = allProviders
      .filter((p) => !connected.has(p.id))
      .map((provider) => this.scoreProvider(provider, profile))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    return recommendations;
  }

  /**
   * Industry-specific recommendations
   */
  getIndustryRecommendations(
    industry: IndustryType,
    connectedIds: string[] = []
  ): IntegrationRecommendation[] {
    const industryConfig = INDUSTRY_PROVIDER_MAP[industry];
    if (!industryConfig || industryConfig.providers.length === 0) {
      return [];
    }

    const connected = new Set(connectedIds);
    const profile: TenantIntegrationProfile = {
      tenantId: '',
      industry,
      businessSize: 'growth',
      detectedWorkflows: [],
      connectedProviderIds: connectedIds,
    };

    return industryConfig.providers
      .map((id) => this.registry.getProvider(id))
      .filter((p): p is IntegrationProvider => p !== undefined && !connected.has(p.id))
      .map((p) => this.scoreProvider(p, profile))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Detect industry from company description/name using keyword matching
   */
  detectIndustry(
    companyName: string,
    companyDescription: string = ''
  ): IndustryType {
    const fullText = `${companyName} ${companyDescription}`.toLowerCase();

    const keywords: Record<IndustryType, string[]> = {
      restaurant: ['restaurant', 'cafe', 'pizzeria', 'diner', 'pub', 'bar', 'food', 'catering', 'kitchen'],
      ecommerce: ['ecommerce', 'shop', 'store', 'online retail', 'marketplace', 'dropship', 'catalog', 'product'],
      logistics_trucking: ['logistics', 'trucking', 'transport', 'shipping', 'freight', 'carrier', 'fleet', 'delivery', 'dispatch'],
      healthcare_delivery: ['healthcare', 'medical', 'clinic', 'hospital', 'health delivery', 'telemedicine', 'pharmacy'],
      field_service: ['field service', 'hvac', 'plumbing', 'electrical', 'contractor', 'technician', 'home service'],
      wholesale_distribution: ['wholesale', 'distributor', 'distribution', 'b2b', 'supply', 'manufacturer'],
      general: [],
    };

    let bestMatch: IndustryType = 'general';
    let bestScore = 0;

    for (const [industry, kws] of Object.entries(keywords)) {
      const score = kws.filter((kw) => fullText.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = industry as IndustryType;
      }
    }

    return bestMatch;
  }

  /**
   * Detect workflows from tenant's current integrations
   */
  detectWorkflows(connectedProviderIds: string[]): WorkflowType[] {
    const workflows = new Set<WorkflowType>();
    const connected = new Set(connectedProviderIds);

    for (const [workflow, providerIds] of Object.entries(WORKFLOW_PROVIDER_MAP)) {
      const workflowType = workflow as WorkflowType;
      if (providerIds.some((id) => connected.has(id))) {
        workflows.add(workflowType);
      }
    }

    return Array.from(workflows);
  }

  /**
   * Score a single provider against a tenant profile
   */
  private scoreProvider(
    provider: IntegrationProvider,
    profile: TenantIntegrationProfile
  ): IntegrationRecommendation {
    const industryMatch = this.calculateIndustryMatch(provider.id, profile.industry);
    const workflowComplement = this.calculateWorkflowComplement(provider.id, profile.detectedWorkflows);
    const popularityScore = PROVIDER_POPULARITY[provider.id] ?? 50;

    // Synergy bonus: check if this provider pairs well with connected integrations
    const connected = new Set(profile.connectedProviderIds);
    const synergyScore = this.dependencyGraph
      ? this.dependencyGraph.getSynergyScore(provider.id, Array.from(connected))
      : 0;

    const synergiesWithConnected = this.dependencyGraph
      ? this.dependencyGraph.getComplementaryProviders(provider.id, Array.from(connected))
      : [];

    // Composite score: Industry (40%) + Workflow (35%) + Popularity (20%) + Synergy (5%)
    const relevanceScore = Math.min(
      100,
      (industryMatch * 0.4 + workflowComplement * 0.35 + popularityScore * 0.2 + synergyScore * 0.05)
    );

    const setupEstimate = this.estimateSetupTime(provider);
    const setupComplexity = this.determineComplexity(provider);

    return {
      providerId: provider.id,
      providerName: provider.name,
      category: provider.category,
      relevanceScore: Math.round(relevanceScore),
      industryMatch: Math.round(industryMatch),
      workflowComplement: Math.round(workflowComplement),
      popularityScore: Math.round(popularityScore),
      reason: this.generateRecommendationReason(provider, profile, { industryMatch, workflowComplement }),
      setupEstimateMinutes: setupEstimate,
      setupComplexity,
      synergiesWithConnected,
    };
  }

  /**
   * Calculate how well provider matches tenant's industry
   */
  private calculateIndustryMatch(providerId: string, industry: IndustryType): number {
    const config = INDUSTRY_PROVIDER_MAP[industry];
    if (!config) return 0;

    const weight = config.weights[providerId];
    if (!weight) return 0;

    return weight * 100;
  }

  /**
   * Calculate how well provider complements detected workflows
   */
  private calculateWorkflowComplement(providerId: string, workflows: WorkflowType[]): number {
    if (workflows.length === 0) return 25; // baseline for no detected workflows

    let matches = 0;
    for (const workflow of workflows) {
      const providers = WORKFLOW_PROVIDER_MAP[workflow];
      if (providers.includes(providerId)) {
        matches++;
      }
    }

    return (matches / workflows.length) * 100;
  }

  /**
   * Estimate setup time (API auth, webhooks, etc.)
   */
  private estimateSetupTime(provider: IntegrationProvider): number {
    let baseTime = 15; // minutes

    // OAuth adds 5 minutes
    if (provider.authMethod === 'oauth2') {
      baseTime += 5;
    }

    // Webhook support adds 10 minutes
    if (provider.webhookSupport) {
      baseTime += 10;
    }

    // Custom auth adds 10 minutes
    if (provider.authMethod === 'custom') {
      baseTime += 10;
    }

    return baseTime;
  }

  /**
   * Determine setup complexity
   */
  private determineComplexity(provider: IntegrationProvider): 'simple' | 'moderate' | 'complex' {
    if (provider.authMethod === 'custom' || provider.webhookSupport) {
      return 'complex';
    }
    if (provider.authMethod === 'oauth2') {
      return 'moderate';
    }
    return 'simple';
  }

  /**
   * Generate human-readable reason for recommendation
   */
  private generateRecommendationReason(
    provider: IntegrationProvider,
    profile: TenantIntegrationProfile,
    scores: { industryMatch: number; workflowComplement: number }
  ): string {
    const reasons: string[] = [];

    if (scores.industryMatch > 70) {
      reasons.push(`Best-in-class for ${profile.industry.replace(/_/g, ' ')}`);
    }

    if (scores.workflowComplement > 70) {
      reasons.push('Complements your existing workflows');
    }

    if (PROVIDER_POPULARITY[provider.id] && PROVIDER_POPULARITY[provider.id] > 80) {
      reasons.push('Market leader in its category');
    }

    if (reasons.length === 0) {
      reasons.push('Recommended based on your integrations');
    }

    return reasons.join('. ');
  }
}

// ─── INTEGRATION DEPENDENCY GRAPH ────────────────────────────────────────

export interface DependencyEdge {
  from: string;
  to: string;
  synergyType: 'data-flow' | 'complement' | 'required' | 'optional';
  weight: number; // 0-1, higher = stronger synergy
}

export class IntegrationDependencyGraph {
  private edges: Map<string, DependencyEdge[]> = new Map();

  constructor() {
    this.buildDefaultGraph();
  }

  /**
   * Get providers that synergize well with a given provider
   */
  getComplementaryProviders(providerId: string, excludeIds: string[] = []): string[] {
    const exclude = new Set([providerId, ...excludeIds]);
    const edges = this.edges.get(providerId) ?? [];

    return edges
      .filter((e) => e.synergyType !== 'required' && !exclude.has(e.to))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((e) => e.to);
  }

  /**
   * Calculate synergy score between provider and set of connected providers
   */
  getSynergyScore(providerId: string, connectedIds: string[]): number {
    const connected = new Set(connectedIds);
    const edges = this.edges.get(providerId) ?? [];

    let totalWeight = 0;
    for (const edge of edges) {
      if (connected.has(edge.to)) {
        totalWeight += edge.weight;
      }
    }

    return Math.min(100, totalWeight * 25); // scale to 0-100
  }

  /**
   * Get visual graph data for frontend
   */
  getGraphData(
    selectedNodeIds: string[]
  ): { nodes: Array<{ id: string; label: string }>; edges: DependencyEdge[] } {
    const registry = integrationRegistry;
    const nodeSet = new Set(selectedNodeIds);

    // Expand with synergistic providers
    for (const id of selectedNodeIds) {
      this.getComplementaryProviders(id).forEach((cid) => nodeSet.add(cid));
    }

    const nodes = Array.from(nodeSet)
      .map((id) => {
        const provider = registry.getProvider(id);
        return provider ? { id, label: provider.name } : null;
      })
      .filter((n): n is typeof n & object => n !== null);

    const edges = Array.from(nodeSet)
      .flatMap((id) => this.edges.get(id) ?? [])
      .filter((e) => nodeSet.has(e.from) && nodeSet.has(e.to));

    return { nodes, edges };
  }

  /**
   * Build the default synergy graph
   */
  private buildDefaultGraph(): void {
    const connections: DependencyEdge[] = [
      // Routing + Maps
      { from: 'valhalla', to: 'google-maps', synergyType: 'complement', weight: 0.8 },
      { from: 'vroom', to: 'mapbox', synergyType: 'complement', weight: 0.8 },
      { from: 'google-routes-api', to: 'google-maps', synergyType: 'complement', weight: 0.9 },

      // Routing + Telematics
      { from: 'valhalla', to: 'samsara', synergyType: 'data-flow', weight: 0.85 },
      { from: 'vroom', to: 'geotab', synergyType: 'data-flow', weight: 0.8 },
      { from: 'google-routes-api', to: 'samsara', synergyType: 'complement', weight: 0.75 },

      // Telematics + ELD
      { from: 'samsara', to: 'samsara-eld', synergyType: 'data-flow', weight: 0.95 },
      { from: 'geotab', to: 'geotab-drive', synergyType: 'data-flow', weight: 0.95 },
      { from: 'motive-eld', to: 'samsara', synergyType: 'complement', weight: 0.7 },

      // E-commerce + Payments
      { from: 'shopify', to: 'stripe', synergyType: 'required', weight: 1.0 },
      { from: 'shopify', to: 'square-payments', synergyType: 'complement', weight: 0.8 },
      { from: 'woocommerce', to: 'stripe', synergyType: 'complement', weight: 0.85 },
      { from: 'square-online', to: 'square-payments', synergyType: 'data-flow', weight: 0.95 },

      // E-commerce + Fulfillment
      { from: 'shopify', to: 'shipstation', synergyType: 'data-flow', weight: 0.9 },
      { from: 'shopify', to: 'easypost', synergyType: 'complement', weight: 0.75 },
      { from: 'woocommerce', to: 'shipstation', synergyType: 'complement', weight: 0.8 },

      // Fulfillment + Shipping
      { from: 'shipstation', to: 'fedex', synergyType: 'data-flow', weight: 0.9 },
      { from: 'shipstation', to: 'ups', synergyType: 'data-flow', weight: 0.9 },
      { from: 'easypost', to: 'fedex', synergyType: 'complement', weight: 0.8 },

      // Payments + Accounting
      { from: 'stripe', to: 'quickbooks', synergyType: 'data-flow', weight: 0.85 },
      { from: 'square-payments', to: 'quickbooks', synergyType: 'complement', weight: 0.75 },
      { from: 'paypal', to: 'xero', synergyType: 'data-flow', weight: 0.8 },

      // CRM + Accounting
      { from: 'salesforce', to: 'oracle-netsuite', synergyType: 'complement', weight: 0.75 },
      { from: 'hubspot', to: 'quickbooks', synergyType: 'complement', weight: 0.7 },

      // E-commerce + Email
      { from: 'shopify', to: 'sendgrid', synergyType: 'complement', weight: 0.75 },
      { from: 'square-online', to: 'sendgrid', synergyType: 'complement', weight: 0.7 },

      // Messaging
      { from: 'twilio', to: 'sendgrid', synergyType: 'complement', weight: 0.7 },
      { from: 'slack', to: 'servicetitan', synergyType: 'complement', weight: 0.75 },

      // Field Service + Payments
      { from: 'servicetitan', to: 'stripe', synergyType: 'complement', weight: 0.8 },
      { from: 'jobber', to: 'stripe', synergyType: 'complement', weight: 0.75 },

      // Field Service + Maps
      { from: 'servicetitan', to: 'google-maps', synergyType: 'complement', weight: 0.8 },
      { from: 'jobber', to: 'google-maps', synergyType: 'complement', weight: 0.8 },

      // ERP + Supply Chain
      { from: 'sap', to: 'manhattan-associates', synergyType: 'complement', weight: 0.85 },
      { from: 'oracle-netsuite', to: 'manhattan-associates', synergyType: 'complement', weight: 0.8 },

      // POS + Payments
      { from: 'toast-pos', to: 'stripe', synergyType: 'complement', weight: 0.8 },
      { from: 'square-for-restaurants', to: 'square-payments', synergyType: 'data-flow', weight: 0.95 },

      // POS + Delivery
      { from: 'toast-pos', to: 'doordash-drive', synergyType: 'complement', weight: 0.85 },
      { from: 'toast-pos', to: 'uber-eats', synergyType: 'complement', weight: 0.8 },
    ];

    for (const edge of connections) {
      if (!this.edges.has(edge.from)) {
        this.edges.set(edge.from, []);
      }
      this.edges.get(edge.from)!.push(edge);

      // Add reverse for bidirectional queries
      if (!this.edges.has(edge.to)) {
        this.edges.set(edge.to, []);
      }
      this.edges.get(edge.to)!.push({ ...edge, from: edge.to, to: edge.from });
    }
  }
}

// ─── CATEGORY COVERAGE ANALYSIS ──────────────────────────────────────────

export interface CategoryCoverageSummary {
  coverageByCategory: Record<string, { count: number; critical: boolean }>;
  overallCoverage: number; // 0-100%
  gaps: string[]; // Categories with 0 integrations
  recommendations: string[]; // IDs of high-priority providers to fill gaps
}

export function analyzeCategoryGaps(
  connectedProviderIds: string[],
  industry: IndustryType
): CategoryCoverageSummary {
  const registry = integrationRegistry;
  const connected = new Set(connectedProviderIds);

  const categoryMap = new Map<string, number>();
  const criticalCategories: Set<string> = new Set();

  // Mark critical categories by industry
  const criticalByIndustry: Record<IndustryType, string[]> = {
    restaurant: ['pos-restaurant', 'payments', 'messaging', 'last-mile'],
    ecommerce: ['e-commerce', 'payments', 'shipping', 'email'],
    logistics_trucking: ['telematics', 'eld', 'routing', 'maps', 'freight'],
    healthcare_delivery: ['healthcare', 'e-signatures', 'messaging', 'maps'],
    field_service: ['field-service', 'payments', 'maps', 'messaging'],
    wholesale_distribution: ['erp-accounting', 'supply-chain', 'crm', 'shipping'],
    general: ['e-commerce', 'payments', 'messaging', 'email'],
  };

  const critical = criticalByIndustry[industry] ?? [];
  critical.forEach((c) => criticalCategories.add(c));

  // Count providers per category
  for (const provider of registry.getProduction()) {
    if (connected.has(provider.id)) {
      categoryMap.set(provider.category, (categoryMap.get(provider.category) ?? 0) + 1);
    }
  }

  const gaps: string[] = [];
  for (const category of critical) {
    if (!categoryMap.has(category)) {
      gaps.push(category);
    }
  }

  // Find recommendations to fill gaps
  const recommendations: string[] = [];
  for (const gap of gaps) {
    const providers = registry.getByCategory(gap as any);
    const unconnected = providers.find((p) => !connected.has(p.id));
    if (unconnected) {
      recommendations.push(unconnected.id);
    }
  }

  const coverageByCategory: Record<string, { count: number; critical: boolean }> = {};
  for (const [category, count] of categoryMap) {
    coverageByCategory[category] = {
      count,
      critical: criticalCategories.has(category),
    };
  }

  const totalCritical = critical.length;
  const coveredCritical = critical.filter((c) => categoryMap.has(c)).length;
  const overallCoverage = totalCritical > 0 ? (coveredCritical / totalCritical) * 100 : 0;

  return {
    coverageByCategory,
    overallCoverage: Math.round(overallCoverage),
    gaps,
    recommendations,
  };
}

