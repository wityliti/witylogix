/**
 * Smart Recommendations Engine
 *
 * Provides intelligent recommendations during onboarding using rule-based scoring:
 * - Integration recommendations with confidence scores
 * - Dashboard widget suggestions
 * - Next step guidance based on company profile
 * - Collaborative filtering simulation ("companies like yours...")
 *
 * All scoring is transparent with clear reasoning for recommendations.
 */

import {
  Industry,
  Goal,
  SmartRecommendation,
  IntegrationRecommendation,
  WidgetRecommendation,
  NextStepSuggestion,
  DashboardLayout,
} from "./types";
import {
  rankIntegrations,
  isIntegrationRelevantToGoals,
} from "./goal-feature-mapper";

/**
 * Company profile for personalized recommendations.
 */
interface CompanyProfile {
  industry: Industry;
  goals: Goal[];
  companySize: "startup" | "small" | "medium" | "enterprise";
  selectedIntegrations: string[];
  region?: string;
}

/**
 * Recommend integrations based on industry, goals, and company profile.
 *
 * Uses weighted scoring:
 * - 40% industry match (how common for this industry)
 * - 35% goal relevance (how well it helps with stated goals)
 * - 15% popularity (general usage patterns)
 * - 10% company size fit (scalability and pricing fit)
 *
 * @param company - Company profile with industry, goals, size
 * @param availableIntegrations - All integrations from platform
 * @returns Smart recommendation with confidence and reasoning
 */
export function recommendIntegrations(
  company: CompanyProfile,
  availableIntegrations: Array<{
    slug: string;
    name: string;
    category: string;
    popularity?: number;
  }>,
): SmartRecommendation<IntegrationRecommendation> {
  const ranked = rankIntegrations(
    company.goals,
    company.industry,
    availableIntegrations,
    company.companySize,
  );

  // Filter out already selected and take top 10
  const recommendations = ranked
    .filter((rec) => !company.selectedIntegrations.includes(rec.slug))
    .slice(0, 10);

  // Calculate confidence based on goal clarity
  const confidence = Math.min(1, company.goals.length > 0 ? 0.9 : 0.5);

  const basedOn = [];
  if (company.goals.length > 0) basedOn.push("goals");
  basedOn.push("industry");
  basedOn.push("company_size");

  return {
    items: recommendations,
    confidence,
    reason: `Top integrations for ${company.industry} businesses focusing on ${company.goals.join(", ")}`,
    basedOn,
    metadata: {
      industryMatch: 0.4,
      goalRelevance: 0.35,
      popularity: 0.15,
      companySizeFit: 0.1,
    },
  };
}

/**
 * Recommend dashboard widgets based on selected layout and goals.
 *
 * @param layout - Selected dashboard layout
 * @param goals - Selected business goals
 * @returns List of recommended widgets with rationale
 */
export function recommendDashboardWidgets(
  layout: DashboardLayout,
  goals: Goal[],
): WidgetRecommendation[] {
  const widgets: WidgetRecommendation[] = [];

  // Widget recommendations based on goals
  const widgetsByGoal: Record<Goal, WidgetRecommendation[]> = {
    [Goal.ROUTE_OPTIMIZATION]: [
      {
        widgetType: "map_view",
        title: "Route Optimization Map",
        description: "Visual representation of optimized routes",
        relevantToGoals: [Goal.ROUTE_OPTIMIZATION],
      },
      {
        widgetType: "distance_saved",
        title: "Distance Saved",
        description: "Total distance reduction from optimization",
        relevantToGoals: [Goal.ROUTE_OPTIMIZATION],
      },
      {
        widgetType: "cost_savings",
        title: "Cost Savings",
        description: "Estimated fuel and labor cost savings",
        relevantToGoals: [Goal.ROUTE_OPTIMIZATION],
      },
    ],
    [Goal.FLEET_TRACKING]: [
      {
        widgetType: "live_fleet_map",
        title: "Live Fleet Map",
        description: "Real-time location of all vehicles",
        relevantToGoals: [Goal.FLEET_TRACKING],
      },
      {
        widgetType: "vehicle_health",
        title: "Vehicle Health Status",
        description: "Maintenance alerts and vehicle diagnostics",
        relevantToGoals: [Goal.FLEET_TRACKING],
      },
      {
        widgetType: "fuel_consumption",
        title: "Fuel Consumption",
        description: "Fuel usage and efficiency metrics",
        relevantToGoals: [Goal.FLEET_TRACKING],
      },
    ],
    [Goal.LAST_MILE]: [
      {
        widgetType: "delivery_status",
        title: "Active Deliveries",
        description: "Real-time delivery status and progress",
        relevantToGoals: [Goal.LAST_MILE],
      },
      {
        widgetType: "customer_satisfaction",
        title: "Customer Ratings",
        description: "Delivery satisfaction and feedback",
        relevantToGoals: [Goal.LAST_MILE],
      },
      {
        widgetType: "delivery_performance",
        title: "On-Time Delivery Rate",
        description: "Percentage of on-time deliveries",
        relevantToGoals: [Goal.LAST_MILE],
      },
    ],
    [Goal.MULTI_CARRIER]: [
      {
        widgetType: "carrier_comparison",
        title: "Carrier Comparison",
        description: "Cost and performance by carrier",
        relevantToGoals: [Goal.MULTI_CARRIER],
      },
      {
        widgetType: "shipping_volume",
        title: "Shipping Volume",
        description: "Shipments by carrier",
        relevantToGoals: [Goal.MULTI_CARRIER],
      },
      {
        widgetType: "rate_matrix",
        title: "Rate Comparison",
        description: "Real-time rate quotes from carriers",
        relevantToGoals: [Goal.MULTI_CARRIER],
      },
    ],
    [Goal.ORDER_MANAGEMENT]: [
      {
        widgetType: "order_volume",
        title: "Order Volume",
        description: "Daily/weekly order trends",
        relevantToGoals: [Goal.ORDER_MANAGEMENT],
      },
      {
        widgetType: "order_status",
        title: "Order Status Pipeline",
        description: "Orders by status (new, processing, shipped)",
        relevantToGoals: [Goal.ORDER_MANAGEMENT],
      },
      {
        widgetType: "fulfillment_time",
        title: "Fulfillment Time",
        description: "Average time from order to shipment",
        relevantToGoals: [Goal.ORDER_MANAGEMENT],
      },
    ],
    [Goal.CUSTOMER_NOTIFICATIONS]: [
      {
        widgetType: "campaign_status",
        title: "Campaign Status",
        description: "Active notification campaigns",
        relevantToGoals: [Goal.CUSTOMER_NOTIFICATIONS],
      },
      {
        widgetType: "message_delivery",
        title: "Message Delivery Rate",
        description: "Email/SMS delivery and open rates",
        relevantToGoals: [Goal.CUSTOMER_NOTIFICATIONS],
      },
      {
        widgetType: "customer_engagement",
        title: "Customer Engagement",
        description: "Click-through and interaction rates",
        relevantToGoals: [Goal.CUSTOMER_NOTIFICATIONS],
      },
    ],
    [Goal.ANALYTICS]: [
      {
        widgetType: "kpi_overview",
        title: "KPI Overview",
        description: "Key performance indicators dashboard",
        relevantToGoals: [Goal.ANALYTICS],
      },
      {
        widgetType: "trend_analysis",
        title: "Trend Analysis",
        description: "Historical trends and patterns",
        relevantToGoals: [Goal.ANALYTICS],
      },
      {
        widgetType: "anomaly_detection",
        title: "Anomaly Alerts",
        description: "Unusual patterns or values",
        relevantToGoals: [Goal.ANALYTICS],
      },
    ],
    [Goal.ERP_INTEGRATION]: [
      {
        widgetType: "erp_sync_status",
        title: "ERP Sync Status",
        description: "Data synchronization status with ERP",
        relevantToGoals: [Goal.ERP_INTEGRATION],
      },
      {
        widgetType: "inventory_levels",
        title: "Inventory Levels",
        description: "Real-time inventory from ERP",
        relevantToGoals: [Goal.ERP_INTEGRATION],
      },
      {
        widgetType: "purchase_orders",
        title: "Active POs",
        description: "Purchase orders in progress",
        relevantToGoals: [Goal.ERP_INTEGRATION],
      },
    ],
    [Goal.DRIVER_MANAGEMENT]: [
      {
        widgetType: "driver_roster",
        title: "Driver Roster",
        description: "Available and on-duty drivers",
        relevantToGoals: [Goal.DRIVER_MANAGEMENT],
      },
      {
        widgetType: "driver_performance",
        title: "Driver Performance",
        description: "Individual driver metrics and ratings",
        relevantToGoals: [Goal.DRIVER_MANAGEMENT],
      },
      {
        widgetType: "safety_metrics",
        title: "Safety Metrics",
        description: "Accidents, violations, and safety scores",
        relevantToGoals: [Goal.DRIVER_MANAGEMENT],
      },
    ],
    [Goal.COMPLIANCE_ELD]: [
      {
        widgetType: "hos_status",
        title: "HOS Status",
        description: "Hours of Service compliance",
        relevantToGoals: [Goal.COMPLIANCE_ELD],
      },
      {
        widgetType: "eld_alerts",
        title: "ELD Alerts",
        description: "Violations and violations alerts",
        relevantToGoals: [Goal.COMPLIANCE_ELD],
      },
      {
        widgetType: "inspection_readiness",
        title: "Inspection Readiness",
        description: "CVSA compliance status",
        relevantToGoals: [Goal.COMPLIANCE_ELD],
      },
    ],
  };

  // Collect all widgets for selected goals
  const widgetSet = new Set<string>();
  for (const goal of goals) {
    const goalWidgets = widgetsByGoal[goal] ?? [];
    for (const widget of goalWidgets) {
      if (!widgetSet.has(widget.widgetType)) {
        widgetSet.add(widget.widgetType);
        widgets.push(widget);
      }
    }
  }

  // Add some foundational widgets
  if (widgets.length < 5) {
    widgets.unshift({
      widgetType: "quick_stats",
      title: "Quick Stats",
      description: "Summary metrics at a glance",
      relevantToGoals: goals.slice(0, 1),
    });
  }

  return widgets;
}

/**
 * Suggest personalized next steps based on onboarding progress.
 *
 * @param company - Company profile
 * @param completedSteps - Steps already completed
 * @returns List of next step suggestions prioritized
 */
export function suggestNextSteps(
  company: CompanyProfile,
  completedSteps: string[],
): NextStepSuggestion[] {
  const suggestions: NextStepSuggestion[] = [];

  // Check if integrations were selected
  if (
    !completedSteps.includes("integrations_configured") &&
    company.selectedIntegrations.length === 0
  ) {
    suggestions.push({
      title: "Connect Your First Integration",
      description: `Start with ${getTopIntegration(company.industry)}. Companies like yours typically set up this integration first to see immediate value.`,
      actionUrl: "/onboarding/integrations",
      priority: "high",
      estimateMinutes: 15,
    });
  }

  // Check if dashboard was customized
  if (!completedSteps.includes("dashboard_configured")) {
    suggestions.push({
      title: "Customize Your Dashboard",
      description: "Pin your most-used pages and metrics for quick access",
      actionUrl: "/dashboard/customize",
      priority: "high",
      estimateMinutes: 10,
    });
  }

  // Check if team was invited
  if (!completedSteps.includes("team_invited")) {
    suggestions.push({
      title: "Invite Team Members",
      description:
        "Bring your team aboard to collaborate and get their feedback",
      actionUrl: "/team/invite",
      priority: "medium",
      estimateMinutes: 5,
    });
  }

  // Suggest training based on goals
  if (company.goals.includes(Goal.ROUTE_OPTIMIZATION)) {
    suggestions.push({
      title: "Route Optimization Tutorial",
      description: "Learn how to set up and optimize your routes",
      actionUrl: "/help/routing-tutorial",
      priority: "medium",
      estimateMinutes: 20,
    });
  }

  if (company.goals.includes(Goal.FLEET_TRACKING)) {
    suggestions.push({
      title: "Fleet Tracking Setup",
      description: "Configure your fleet for real-time visibility",
      actionUrl: "/help/fleet-setup",
      priority: "medium",
      estimateMinutes: 15,
    });
  }

  // Suggest data import
  suggestions.push({
    title: "Import Your Data",
    description: "Bulk import existing orders, drivers, or customers",
    actionUrl: "/settings/data-import",
    priority: "low",
    estimateMinutes: 30,
  });

  // Schedule onboarding call
  suggestions.push({
    title: "Schedule Success Onboarding Call",
    description: "Discuss strategy and best practices with our team",
    actionUrl: "/support/schedule-call",
    priority: "low",
    estimateMinutes: 45,
  });

  return suggestions;
}

/**
 * Get the top integration recommendation for an industry.
 */
function getTopIntegration(industry: Industry): string {
  const topIntegrations: Record<Industry, string> = {
    [Industry.ECOMMERCE]: "Shopify",
    [Industry.FOOD_BEVERAGE]: "DoorDash",
    [Industry.HEALTHCARE]: "Epic EHR",
    [Industry.LOGISTICS_3PL]: "Samsara",
    [Industry.FIELD_SERVICE]: "ServiceTitan",
    [Industry.MANUFACTURING]: "SAP",
    [Industry.COURIER]: "Samsara",
    [Industry.GROCERY]: "DoorDash",
    [Industry.CUSTOM]: "a popular integration in your industry",
  };

  return topIntegrations[industry];
}

/**
 * Get "companies like yours" insights.
 *
 * Simulates collaborative filtering by providing insights about similar companies.
 *
 * @param company - Company profile
 * @returns Recommendations based on similar company patterns
 */
export function getSimilarCompanyInsights(company: CompanyProfile): {
  commonIntegrations: string[];
  averageOnboardingTime: number;
  successMetrics: Record<string, number>;
} {
  // In a real system, this would query an analytics backend
  // For now, provide rule-based insights

  const insights: Record<
    Industry,
    {
      integrations: string[];
      avgTime: number;
      metrics: Record<string, number>;
    }
  > = {
    [Industry.ECOMMERCE]: {
      integrations: ["shopify", "stripe", "shipstation"],
      avgTime: 180,
      metrics: {
        order_volume_increase: 25,
        cart_abandonment_reduction: 15,
        fulfillment_speed_improvement: 40,
      },
    },
    [Industry.FOOD_BEVERAGE]: {
      integrations: ["doordash", "uber-eats", "toast"],
      avgTime: 240,
      metrics: {
        delivery_volume_increase: 35,
        preparation_time_reduction: 20,
        customer_satisfaction_improvement: 30,
      },
    },
    [Industry.HEALTHCARE]: {
      integrations: ["epic", "cerner", "motive"],
      avgTime: 360,
      metrics: {
        delivery_compliance_rate: 99,
        response_time_improvement: 45,
        patient_satisfaction_improvement: 35,
      },
    },
    [Industry.LOGISTICS_3PL]: {
      integrations: ["samsara", "dat-freight", "wex"],
      avgTime: 300,
      metrics: {
        fuel_cost_reduction: 18,
        delivery_efficiency_improvement: 22,
        fleet_utilization_increase: 30,
      },
    },
    [Industry.FIELD_SERVICE]: {
      integrations: ["servicetitan", "jobber", "motive"],
      avgTime: 240,
      metrics: {
        job_completion_time_reduction: 25,
        technician_utilization_increase: 35,
        customer_satisfaction_improvement: 40,
      },
    },
    [Industry.MANUFACTURING]: {
      integrations: ["sap", "manhattan-associates", "blue-yonder"],
      avgTime: 480,
      metrics: {
        production_efficiency_improvement: 20,
        inventory_accuracy_improvement: 35,
        supply_chain_cost_reduction: 12,
      },
    },
    [Industry.COURIER]: {
      integrations: ["samsara", "google-maps", "onesignal"],
      avgTime: 180,
      metrics: {
        delivery_volume_increase: 40,
        on_time_delivery_improvement: 15,
        cost_per_delivery_reduction: 20,
      },
    },
    [Industry.GROCERY]: {
      integrations: ["shopify", "doordash", "instacart"],
      avgTime: 240,
      metrics: {
        delivery_volume_increase: 45,
        freshness_guarantee_increase: 50,
        customer_satisfaction_improvement: 35,
      },
    },
    [Industry.CUSTOM]: {
      integrations: [],
      avgTime: 200,
      metrics: {
        operational_efficiency_improvement: 25,
        cost_reduction: 15,
      },
    },
  };

  const industry = insights[company.industry] || insights[Industry.CUSTOM];

  return {
    commonIntegrations: industry.integrations,
    averageOnboardingTime: industry.avgTime,
    successMetrics: industry.metrics,
  };
}
