/**
 * Goal-to-Feature Mapper
 *
 * Maps business goals to platform features and integrations.
 *
 * Provides:
 * - Goal → Feature mapping (which dashboard pages and features to enable)
 * - Dashboard layout suggestions based on goal combinations
 * - Integration ranking based on goal relevance
 * - Goal affinity matrix for weighted scoring
 */

import { Goal, Industry, DashboardLayout, IntegrationRecommendation } from "./types";

/**
 * Integration affinity scores for each goal.
 * Higher values (0-1) indicate stronger correlation with achieving that goal.
 */
const GOAL_INTEGRATION_AFFINITY: Record<Goal, Record<string, number>> = {
  [Goal.ROUTE_OPTIMIZATION]: {
    "valhalla-vroom": 1.0,
    "google-maps": 0.9,
    "mapbox": 0.85,
    "samsara": 0.7,
    "motive": 0.65,
  },
  [Goal.FLEET_TRACKING]: {
    "samsara": 1.0,
    "motive": 0.95,
    "flespi": 0.8,
    "google-maps": 0.75,
    "geotab": 0.7,
  },
  [Goal.LAST_MILE]: {
    "doordash": 0.95,
    "uber-eats": 0.95,
    "shipstation": 0.9,
    "easy-post": 0.85,
    "google-maps": 0.8,
    "onesignal": 0.75,
  },
  [Goal.MULTI_CARRIER]: {
    "shipstation": 1.0,
    "easy-post": 0.95,
    "shippo": 0.9,
    "stripe": 0.6,
  },
  [Goal.ORDER_MANAGEMENT]: {
    "shopify": 1.0,
    "toast": 0.9,
    "stripe": 0.85,
    "square": 0.8,
    "quickbooks": 0.7,
  },
  [Goal.CUSTOMER_NOTIFICATIONS]: {
    "twilio": 1.0,
    "mailgun": 0.95,
    "sendgrid": 0.9,
    "onesignal": 0.85,
    "firebase": 0.8,
  },
  [Goal.ANALYTICS]: {
    "snowflake": 1.0,
    "tableau": 0.95,
    "powerbi": 0.95,
    "google-analytics": 0.85,
    "datadog": 0.75,
  },
  [Goal.ERP_INTEGRATION]: {
    "sap": 1.0,
    "netsuite": 0.95,
    "quickbooks": 0.85,
    "xero": 0.8,
  },
  [Goal.DRIVER_MANAGEMENT]: {
    "samsara": 1.0,
    "motive": 0.95,
    "google-maps": 0.8,
    "twilio": 0.75,
  },
  [Goal.COMPLIANCE_ELD]: {
    "motive": 1.0,
    "omnitracs": 0.95,
    "samsara": 0.9,
  },
};

/**
 * Page/feature recommendations for each goal.
 */
const GOAL_PAGE_MAPPING: Record<Goal, string[]> = {
  [Goal.ROUTE_OPTIMIZATION]: ["routing", "maps", "vehicles"],
  [Goal.FLEET_TRACKING]: ["fleet", "vehicles", "drivers", "analytics"],
  [Goal.LAST_MILE]: ["delivery", "customers", "tracking", "driver-map"],
  [Goal.MULTI_CARRIER]: ["shipping", "carriers", "rates", "orders"],
  [Goal.ORDER_MANAGEMENT]: ["orders", "customers", "inventory", "invoicing"],
  [Goal.CUSTOMER_NOTIFICATIONS]: ["notifications", "messaging", "customers", "templates"],
  [Goal.ANALYTICS]: ["analytics", "dashboards", "reports", "kpi-tracking"],
  [Goal.ERP_INTEGRATION]: ["erp", "integrations", "inventory", "accounting"],
  [Goal.DRIVER_MANAGEMENT]: ["drivers", "teams", "vehicles", "performance-metrics"],
  [Goal.COMPLIANCE_ELD]: ["compliance", "eld", "drivers", "hos-tracking"],
};

/**
 * Map selected goals to recommended features and dashboard pages.
 *
 * @param goals - Array of selected business goals
 * @returns Array of page slugs that should be prominent in the interface
 */
export function mapGoalsToFeatures(goals: Goal[]): string[] {
  const pagesSet = new Set<string>();

  // Always include these fundamental pages
  pagesSet.add("dashboard");
  pagesSet.add("integrations");

  // Add pages based on goals
  for (const goal of goals) {
    const pages = GOAL_PAGE_MAPPING[goal];
    pages.forEach((page) => pagesSet.add(page));
  }

  return Array.from(pagesSet);
}

/**
 * Suggest the best dashboard layout based on goal combination.
 *
 * @param goals - Array of selected business goals
 * @returns Suggested DashboardLayout
 */
export function suggestDashboardLayout(goals: Goal[]): DashboardLayout {
  // Determine primary goal (first one selected or most important)
  const primaryGoal = goals[0];

  if (!primaryGoal) {
    return {
      name: "General Purpose",
      description: "Balanced view of all operations",
      gridLayout: { rows: 3, cols: 3 },
      defaultWidgets: [
        "welcome",
        "quick_stats",
        "recent_activity",
        "team_status",
      ],
      colorScheme: "blue",
    };
  }

  // Map goals to layouts
  const layoutMap: Record<Goal, DashboardLayout> = {
    [Goal.ROUTE_OPTIMIZATION]: {
      name: "Route Optimization Hub",
      description: "Focus on route planning, vehicle efficiency, and optimization",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "route_map",
        "optimization_status",
        "vehicle_utilization",
        "cost_savings",
        "distance_metrics",
      ],
      colorScheme: "purple",
    },
    [Goal.FLEET_TRACKING]: {
      name: "Fleet Visibility Hub",
      description: "Real-time fleet status, driver locations, and vehicle health",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "live_map",
        "active_vehicles",
        "driver_status",
        "vehicle_health",
        "fuel_consumption",
      ],
      colorScheme: "blue",
    },
    [Goal.LAST_MILE]: {
      name: "Last-Mile Operations",
      description: "Delivery tracking, driver assignments, and customer satisfaction",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "active_deliveries",
        "delivery_map",
        "delivery_success_rate",
        "customer_ratings",
        "sla_compliance",
      ],
      colorScheme: "orange",
    },
    [Goal.MULTI_CARRIER]: {
      name: "Shipping & Carriers",
      description: "Multi-carrier management, rate comparison, and label generation",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "carrier_comparison",
        "shipping_volume",
        "cost_per_shipment",
        "delivery_performance",
        "tracking_status",
      ],
      colorScheme: "teal",
    },
    [Goal.ORDER_MANAGEMENT]: {
      name: "Order Management Hub",
      description: "Orders, inventory, and fulfillment tracking",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "order_volume",
        "order_status",
        "inventory_levels",
        "fulfillment_time",
        "revenue_metrics",
      ],
      colorScheme: "green",
    },
    [Goal.CUSTOMER_NOTIFICATIONS]: {
      name: "Customer Engagement",
      description: "Notification campaigns, customer communication, and engagement",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "campaign_status",
        "message_delivery",
        "customer_engagement",
        "notification_templates",
        "customer_feedback",
      ],
      colorScheme: "pink",
    },
    [Goal.ANALYTICS]: {
      name: "Analytics & Insights",
      description: "KPI tracking, trend analysis, and performance metrics",
      gridLayout: { rows: 5, cols: 3 },
      defaultWidgets: [
        "kpi_overview",
        "trend_analysis",
        "performance_metrics",
        "top_performers",
        "anomalies",
        "forecasts",
      ],
      colorScheme: "indigo",
    },
    [Goal.ERP_INTEGRATION]: {
      name: "Enterprise Operations",
      description: "ERP systems, inventory sync, and financial integration",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "erp_status",
        "inventory_sync",
        "financial_summary",
        "purchase_orders",
        "supplier_status",
      ],
      colorScheme: "gray",
    },
    [Goal.DRIVER_MANAGEMENT]: {
      name: "Driver Management",
      description: "Driver performance, safety, and team management",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "driver_roster",
        "driver_performance",
        "safety_metrics",
        "training_status",
        "team_utilization",
      ],
      colorScheme: "cyan",
    },
    [Goal.COMPLIANCE_ELD]: {
      name: "Compliance & HOS",
      description: "ELD tracking, HOS compliance, and regulatory adherence",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "hos_status",
        "eld_compliance",
        "violations_alerts",
        "inspection_status",
        "driver_certifications",
      ],
      colorScheme: "red",
    },
  };

  return layoutMap[primaryGoal];
}

/**
 * Score and rank integrations based on goal relevance and industry.
 *
 * Uses weighted scoring:
 * - 40% industry-goal affinity
 * - 35% goal relevance (how well it helps with stated goals)
 * - 15% popularity (general usage across all users)
 * - 10% company size fit
 *
 * @param goals - Selected business goals
 * @param industry - Selected industry
 * @param allIntegrations - All available integrations from the platform
 * @param companySize - Size of company (optional)
 * @returns Ranked list of integration recommendations
 */
export function rankIntegrations(
  goals: Goal[],
  industry: Industry,
  allIntegrations: Array<{ slug: string; name: string; category: string; popularity?: number }>,
  companySize?: string,
): IntegrationRecommendation[] {
  const recommendations: IntegrationRecommendation[] = [];

  for (const integration of allIntegrations) {
    let goalRelevanceScore = 0;
    let affinityCount = 0;

    // Calculate goal relevance and affinity
    for (const goal of goals) {
      const affinity = GOAL_INTEGRATION_AFFINITY[goal]?.[integration.slug] ?? 0;
      if (affinity > 0) {
        goalRelevanceScore += affinity;
        affinityCount += 1;
      }
    }

    // Normalize goal relevance by number of goals
    const normalizedGoalRelevance = goals.length > 0 ? goalRelevanceScore / goals.length : 0;

    // Industry-goal affinity (simplified — in production, would use detailed matrix)
    const industryGoalAffinity = normalizedGoalRelevance; // Proxy: reuse goal relevance

    // Popularity score (0-1)
    const popularityScore = (integration.popularity ?? 5) / 10;

    // Company size fit (simplified)
    let companySizeFitScore = 0.5; // Default neutral
    if (companySize === "startup" && integration.slug.includes("small")) {
      companySizeFitScore = 1.0;
    } else if (companySize === "enterprise" && integration.slug.includes("enterprise")) {
      companySizeFitScore = 1.0;
    }

    // Weighted scoring
    const totalScore =
      industryGoalAffinity * 0.4 +
      normalizedGoalRelevance * 0.35 +
      popularityScore * 0.15 +
      companySizeFitScore * 0.1;

    const confidenceBreakdown = {
      industryMatch: industryGoalAffinity * 40,
      goalRelevance: normalizedGoalRelevance * 35,
      popularity: popularityScore * 15,
      companySizeFit: companySizeFitScore * 10,
    };

    const score = Math.round(totalScore * 100);

    if (score > 0) {
      recommendations.push({
        slug: integration.slug,
        name: integration.name,
        category: integration.category,
        score,
        confidenceBreakdown,
        reason: generateRecommendationReason(integration.slug, goals, score),
      });
    }
  }

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  return recommendations;
}

/**
 * Generate human-readable reason for recommendation.
 */
function generateRecommendationReason(slug: string, goals: Goal[], score: number): string {
  const relevantGoals = goals
    .filter((goal) => {
      const affinity = GOAL_INTEGRATION_AFFINITY[goal]?.[slug] ?? 0;
      return affinity > 0.5;
    })
    .slice(0, 2);

  if (relevantGoals.length > 0) {
    return `Highly relevant for ${relevantGoals.join(" and ")}`;
  }

  return `Score: ${score}`;
}

/**
 * Get all pages that should be enabled based on goal selection.
 * Useful for determining which dashboard sections to show.
 *
 * @param goals - Selected business goals
 * @returns Set of enabled page slugs
 */
export function getEnabledPages(goals: Goal[]): Set<string> {
  const pages = new Set<string>(mapGoalsToFeatures(goals));
  return pages;
}

/**
 * Check if an integration is relevant to the selected goals.
 *
 * @param integrationSlug - The integration to check
 * @param goals - Selected goals
 * @returns True if integration helps with any of the goals
 */
export function isIntegrationRelevantToGoals(integrationSlug: string, goals: Goal[]): boolean {
  for (const goal of goals) {
    const affinity = GOAL_INTEGRATION_AFFINITY[goal]?.[integrationSlug];
    if (affinity && affinity > 0.3) {
      return true;
    }
  }
  return false;
}

/**
 * Get recommended integrations by category for the selected goals.
 *
 * @param category - Integration category filter
 * @param goals - Selected goals
 * @returns Integration slugs in this category relevant to goals
 */
export function getIntegrationsByCategory(category: string, goals: Goal[]): string[] {
  const integrations: string[] = [];

  // This is a simplified version — in production would query actual integration registry
  const categoryMap: Record<string, string[]> = {
    "fleet-telematics": [
      "samsara",
      "motive",
      "flespi",
      "geotab",
    ],
    "routing": ["valhalla-vroom", "google-maps", "mapbox"],
    "ecommerce": ["shopify", "woocommerce"],
    "payments": ["stripe", "square"],
    "shipping": ["shipstation", "easy-post", "shippo"],
    "sms": ["twilio", "nexmo"],
    "email": ["mailgun", "sendgrid"],
    "analytics": ["snowflake", "tableau", "powerbi", "google-analytics"],
    "erp": ["sap", "netsuite", "quickbooks"],
    "delivery-platforms": ["doordash", "uber-eats", "instacart"],
  };

  const categoryIntegrations = categoryMap[category] ?? [];

  return categoryIntegrations.filter((slug) =>
    isIntegrationRelevantToGoals(slug, goals),
  );
}
