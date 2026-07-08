/**
 * Industry Defaults Engine
 *
 * Provides comprehensive defaults for each supported industry including:
 * - Recommended integrations ranked by relevance
 * - Pre-selected business goals
 * - Default dashboard layouts
 * - Workspace settings (timezone, currency, units)
 * - Industry best practices and tips
 *
 * Used during onboarding to provide smart, relevant defaults that accelerate
 * time-to-value for new customers in specific industries.
 */

import {
  Industry,
  Goal,
  IndustryProfile,
  RecommendedIntegration,
  DashboardLayout,
  WorkspaceDefaults,
} from "./types";

/**
 * Get comprehensive industry profile with all defaults.
 *
 * @param industry - The industry to get defaults for
 * @returns Complete IndustryProfile with integrations, layout, and settings
 */
export function getIndustryDefaults(industry: Industry): IndustryProfile {
  const profiles: Record<Industry, IndustryProfile> = {
    [Industry.ECOMMERCE]: getEcommerceProfile(),
    [Industry.FOOD_BEVERAGE]: getFoodBeverageProfile(),
    [Industry.HEALTHCARE]: getHealthcareProfile(),
    [Industry.LOGISTICS_3PL]: getLogistics3PLProfile(),
    [Industry.FIELD_SERVICE]: getFieldServiceProfile(),
    [Industry.MANUFACTURING]: getManufacturingProfile(),
    [Industry.COURIER]: getCourierProfile(),
    [Industry.GROCERY]: getGroceryProfile(),
    [Industry.CUSTOM]: getCustomProfile(),
  };

  return profiles[industry];
}

/**
 * Get industry-specific insights and best practices.
 *
 * @param industry - The industry
 * @returns Array of helpful tips and best practices
 */
export function getIndustryInsights(industry: Industry): string[] {
  const insights: Record<Industry, string[]> = {
    [Industry.ECOMMERCE]: [
      "Set up order tracking early — customers expect transparency",
      "Integrate with your shipping carriers to auto-sync tracking",
      "Use customer notifications to reduce support inquiries",
      "Analytics on conversion funnel helps identify drop-off points",
      "Multi-carrier setup gives shipping flexibility and cost optimization",
    ],
    [Industry.FOOD_BEVERAGE]: [
      "Real-time delivery tracking is critical for food orders",
      "Integrate with major platforms (DoorDash, Uber Eats) for marketplace reach",
      "Driver management ensures quality control and customer satisfaction",
      "Temperature monitoring for cold-chain compliance",
      "POS integration streamlines order flow from restaurant to delivery",
    ],
    [Industry.HEALTHCARE]: [
      "HIPAA compliance is non-negotiable — configure all security settings",
      "Epic/Cerner integration ensures patient data flows securely",
      "ELD compliance required for non-emergency medical transport",
      "Real-time tracking for time-sensitive medical deliveries",
      "Audit logging enabled by default for compliance verification",
    ],
    [Industry.LOGISTICS_3PL]: [
      "Telematics integration provides visibility across entire fleet",
      "Route optimization reduces fuel costs significantly",
      "Fleet management dashboards keep operations clear",
      "Integration with DAT/Convoy for freight matching",
      "WEX fuel card integration for expense tracking",
    ],
    [Industry.FIELD_SERVICE]: [
      "Mobile app essential for field technicians",
      "Job dispatch system reduces travel time between jobs",
      "Real-time driver location prevents customer surprises",
      "Service history tracking improves customer relationships",
      "Photo/signature proof of work critical for invoicing",
    ],
    [Industry.MANUFACTURING]: [
      "ERP integration keeps inventory and production in sync",
      "Analytics on production cycles identifies bottlenecks",
      "Supply chain visibility prevents shortages",
      "Quality control checkpoints built into workflow",
      "Demand forecasting reduces overproduction",
    ],
    [Industry.COURIER]: [
      "Driver performance metrics drive service excellence",
      "Real-time tracking is table stakes in courier business",
      "Geofencing alerts for delivery zone violations",
      "POD (proof of delivery) integration for liability",
      "Multi-carrier integration for competitive shipping rates",
    ],
    [Industry.GROCERY]: [
      "Cold-chain monitoring ensures food safety",
      "Fresh delivery tracking shows item conditions on arrival",
      "Integration with DoorDash/Instacart expands market",
      "Inventory sync prevents overselling",
      "Customer notifications for delivery windows preferred by shoppers",
    ],
    [Industry.CUSTOM]: [
      "Start with essential integrations — add more as needs grow",
      "Document your workflow to identify automation opportunities",
      "Regular analytics review reveals optimization chances",
      "Team training reduces support tickets",
      "Feedback loops with customers drive feature adoption",
    ],
  };

  return insights[industry];
}

// ─── PROFILE BUILDERS ─────────────────────────────────────────────

function getEcommerceProfile(): IndustryProfile {
  return {
    industry: Industry.ECOMMERCE,
    commonGoals: [
      Goal.ORDER_MANAGEMENT,
      Goal.LAST_MILE,
      Goal.CUSTOMER_NOTIFICATIONS,
      Goal.ANALYTICS,
      Goal.MULTI_CARRIER,
    ],
    recommendedIntegrations: [
      {
        slug: "shopify",
        name: "Shopify",
        category: "ecommerce",
        priority: 10,
        rationale: "Market-leading platform for order management and sales",
        setupEstimateMinutes: 30,
      },
      {
        slug: "stripe",
        name: "Stripe",
        category: "payments",
        priority: 9,
        rationale: "Payment processing with recurring billing support",
        setupEstimateMinutes: 25,
      },
      {
        slug: "shipstation",
        name: "ShipStation",
        category: "shipping",
        priority: 9,
        rationale: "Multi-carrier shipping with automation",
        setupEstimateMinutes: 45,
      },
      {
        slug: "mailgun",
        name: "Mailgun",
        category: "email",
        priority: 8,
        rationale: "Reliable transactional email for order confirmations",
        setupEstimateMinutes: 20,
      },
      {
        slug: "google-analytics",
        name: "Google Analytics",
        category: "analytics",
        priority: 8,
        rationale: "Customer behavior tracking and conversion funnel analysis",
        setupEstimateMinutes: 15,
      },
      {
        slug: "easy-post",
        name: "EasyPost",
        category: "shipping",
        priority: 7,
        rationale: "Alternative carrier integration and label generation",
        setupEstimateMinutes: 30,
      },
    ],
    defaultDashboardLayout: {
      name: "Order Management Hub",
      description:
        "Focused on order volume, shipments, and customer satisfaction",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "order_volume",
        "shipment_status",
        "carrier_performance",
        "customer_satisfaction",
        "revenue_metrics",
        "top_products",
      ],
      colorScheme: "blue",
    },
    defaultSettings: {
      timezone: "America/New_York",
      currency: "USD",
      distanceUnit: "MILES",
      weightUnit: "LBS",
      locale: "en-US",
      dateFormat: "MM/DD/YYYY",
      deliveryZoneRadiusKm: 50,
    },
    description: "E-commerce and online retail",
    tips: getIndustryInsights(Industry.ECOMMERCE),
  };
}

function getFoodBeverageProfile(): IndustryProfile {
  return {
    industry: Industry.FOOD_BEVERAGE,
    commonGoals: [
      Goal.LAST_MILE,
      Goal.DRIVER_MANAGEMENT,
      Goal.CUSTOMER_NOTIFICATIONS,
      Goal.ORDER_MANAGEMENT,
    ],
    recommendedIntegrations: [
      {
        slug: "doordash",
        name: "DoorDash",
        category: "delivery-platforms",
        priority: 10,
        rationale: "Largest third-party delivery platform in North America",
        setupEstimateMinutes: 40,
      },
      {
        slug: "uber-eats",
        name: "Uber Eats",
        category: "delivery-platforms",
        priority: 10,
        rationale: "Major delivery platform with high order volume",
        setupEstimateMinutes: 40,
      },
      {
        slug: "toast",
        name: "Toast",
        category: "pos",
        priority: 9,
        rationale: "Restaurant POS system with delivery integration",
        setupEstimateMinutes: 90,
      },
      {
        slug: "square",
        name: "Square",
        category: "payments",
        priority: 8,
        rationale: "Payment processing with POS capabilities",
        setupEstimateMinutes: 30,
      },
      {
        slug: "twilio",
        name: "Twilio",
        category: "sms",
        priority: 8,
        rationale: "SMS notifications for delivery status updates",
        setupEstimateMinutes: 20,
      },
    ],
    defaultDashboardLayout: {
      name: "Last-Mile Operations",
      description: "Real-time delivery status, driver performance, and orders",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "active_deliveries",
        "driver_map",
        "order_status",
        "delivery_time_performance",
        "customer_ratings",
      ],
      colorScheme: "orange",
    },
    defaultSettings: {
      timezone: "America/Chicago",
      currency: "USD",
      distanceUnit: "MILES",
      weightUnit: "LBS",
      locale: "en-US",
      dateFormat: "MM/DD/YYYY",
      deliveryZoneRadiusKm: 15,
    },
    description: "Restaurants, cafes, and food delivery",
    tips: getIndustryInsights(Industry.FOOD_BEVERAGE),
  };
}

function getHealthcareProfile(): IndustryProfile {
  return {
    industry: Industry.HEALTHCARE,
    commonGoals: [
      Goal.COMPLIANCE_ELD,
      Goal.FLEET_TRACKING,
      Goal.LAST_MILE,
      Goal.ANALYTICS,
    ],
    recommendedIntegrations: [
      {
        slug: "epic",
        name: "Epic EHR",
        category: "healthcare",
        priority: 10,
        rationale: "Leading EHR system with secure patient data exchange",
        setupEstimateMinutes: 120,
      },
      {
        slug: "cerner",
        name: "Cerner",
        category: "healthcare",
        priority: 10,
        rationale: "Major EHR platform with FHIR API support",
        setupEstimateMinutes: 120,
      },
      {
        slug: "motive",
        name: "Motive",
        category: "fleet-telematics",
        priority: 9,
        rationale: "Fleet tracking with driver safety monitoring",
        setupEstimateMinutes: 45,
      },
      {
        slug: "twilio",
        name: "Twilio",
        category: "sms",
        priority: 8,
        rationale: "HIPAA-compliant messaging for patient notifications",
        setupEstimateMinutes: 30,
      },
      {
        slug: "samsara",
        name: "Samsara",
        category: "fleet-telematics",
        priority: 7,
        rationale: "Alternative fleet management with compliance tools",
        setupEstimateMinutes: 40,
      },
    ],
    defaultDashboardLayout: {
      name: "Compliance & Fleet",
      description: "ELD compliance, fleet status, and delivery tracking",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "eld_status",
        "driver_hos_tracking",
        "fleet_location",
        "delivery_schedule",
        "compliance_alerts",
      ],
      colorScheme: "green",
    },
    defaultSettings: {
      timezone: "America/New_York",
      currency: "USD",
      distanceUnit: "MILES",
      weightUnit: "LBS",
      locale: "en-US",
      dateFormat: "MM/DD/YYYY",
    },
    description: "Healthcare and medical transport",
    tips: getIndustryInsights(Industry.HEALTHCARE),
  };
}

function getLogistics3PLProfile(): IndustryProfile {
  return {
    industry: Industry.LOGISTICS_3PL,
    commonGoals: [
      Goal.FLEET_TRACKING,
      Goal.ROUTE_OPTIMIZATION,
      Goal.ANALYTICS,
      Goal.COMPLIANCE_ELD,
      Goal.MULTI_CARRIER,
    ],
    recommendedIntegrations: [
      {
        slug: "samsara",
        name: "Samsara",
        category: "fleet-telematics",
        priority: 10,
        rationale: "Comprehensive fleet visibility and driver safety",
        setupEstimateMinutes: 60,
      },
      {
        slug: "dat-freight",
        name: "DAT Freight",
        category: "freight-marketplace",
        priority: 9,
        rationale: "Access to available freight loads",
        setupEstimateMinutes: 45,
      },
      {
        slug: "wex",
        name: "WEX",
        category: "fuel-fleet",
        priority: 9,
        rationale: "Fuel card integration for expense tracking",
        setupEstimateMinutes: 30,
      },
      {
        slug: "motive",
        name: "Motive",
        category: "fleet-telematics",
        priority: 8,
        rationale: "Alternative fleet management solution",
        setupEstimateMinutes: 45,
      },
      {
        slug: "valhalla-vroom",
        name: "Valhalla/VROOM",
        category: "routing",
        priority: 8,
        rationale: "Route optimization to reduce fuel costs",
        setupEstimateMinutes: 40,
      },
    ],
    defaultDashboardLayout: {
      name: "Fleet Management Hub",
      description:
        "Vehicle status, driver performance, and operational metrics",
      gridLayout: { rows: 5, cols: 3 },
      defaultWidgets: [
        "active_vehicles",
        "driver_map",
        "fuel_costs",
        "vehicle_health",
        "route_optimization_status",
        "compliance_metrics",
      ],
      colorScheme: "blue",
    },
    defaultSettings: {
      timezone: "America/Chicago",
      currency: "USD",
      distanceUnit: "MILES",
      weightUnit: "LBS",
      locale: "en-US",
      dateFormat: "MM/DD/YYYY",
      deliveryZoneRadiusKm: 500,
    },
    description: "Third-party logistics and freight",
    tips: getIndustryInsights(Industry.LOGISTICS_3PL),
  };
}

function getFieldServiceProfile(): IndustryProfile {
  return {
    industry: Industry.FIELD_SERVICE,
    commonGoals: [
      Goal.DRIVER_MANAGEMENT,
      Goal.LAST_MILE,
      Goal.ROUTE_OPTIMIZATION,
      Goal.CUSTOMER_NOTIFICATIONS,
    ],
    recommendedIntegrations: [
      {
        slug: "servicetitan",
        name: "ServiceTitan",
        category: "field-service",
        priority: 10,
        rationale: "Leading field service management platform",
        setupEstimateMinutes: 90,
      },
      {
        slug: "jobber",
        name: "Jobber",
        category: "field-service",
        priority: 9,
        rationale: "Comprehensive field service scheduling and dispatch",
        setupEstimateMinutes: 75,
      },
      {
        slug: "motive",
        name: "Motive",
        category: "fleet-telematics",
        priority: 8,
        rationale: "Vehicle tracking for field teams",
        setupEstimateMinutes: 40,
      },
      {
        slug: "stripe",
        name: "Stripe",
        category: "payments",
        priority: 7,
        rationale: "Payment processing for field invoicing",
        setupEstimateMinutes: 25,
      },
      {
        slug: "twilio",
        name: "Twilio",
        category: "sms",
        priority: 7,
        rationale: "SMS dispatch and customer notifications",
        setupEstimateMinutes: 20,
      },
    ],
    defaultDashboardLayout: {
      name: "Dispatch & Operations",
      description:
        "Job dispatch, technician locations, and customer assignments",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "dispatch_queue",
        "technician_map",
        "job_status",
        "customer_satisfaction",
        "revenue_per_job",
      ],
      colorScheme: "green",
    },
    defaultSettings: {
      timezone: "America/Denver",
      currency: "USD",
      distanceUnit: "MILES",
      weightUnit: "LBS",
      locale: "en-US",
      dateFormat: "MM/DD/YYYY",
      deliveryZoneRadiusKm: 50,
    },
    description: "HVAC, plumbing, electrical, and field services",
    tips: getIndustryInsights(Industry.FIELD_SERVICE),
  };
}

function getManufacturingProfile(): IndustryProfile {
  return {
    industry: Industry.MANUFACTURING,
    commonGoals: [Goal.ERP_INTEGRATION, Goal.ANALYTICS, Goal.ORDER_MANAGEMENT],
    recommendedIntegrations: [
      {
        slug: "sap",
        name: "SAP",
        category: "erp",
        priority: 10,
        rationale: "Enterprise resource planning with manufacturing focus",
        setupEstimateMinutes: 180,
      },
      {
        slug: "manhattan-associates",
        name: "Manhattan Associates",
        category: "wms",
        priority: 9,
        rationale: "Warehouse management system for manufacturing",
        setupEstimateMinutes: 150,
      },
      {
        slug: "blue-yonder",
        name: "Blue Yonder",
        category: "supply-chain",
        priority: 8,
        rationale: "Supply chain planning and optimization",
        setupEstimateMinutes: 120,
      },
      {
        slug: "snowflake",
        name: "Snowflake",
        category: "analytics",
        priority: 7,
        rationale: "Data warehouse for manufacturing analytics",
        setupEstimateMinutes: 90,
      },
    ],
    defaultDashboardLayout: {
      name: "Operations & Analytics",
      description: "Production metrics, supply chain status, and KPIs",
      gridLayout: { rows: 5, cols: 3 },
      defaultWidgets: [
        "production_schedule",
        "inventory_levels",
        "supply_chain_status",
        "quality_metrics",
        "demand_forecast",
      ],
      colorScheme: "gray",
    },
    defaultSettings: {
      timezone: "America/Chicago",
      currency: "USD",
      distanceUnit: "MILES",
      weightUnit: "LBS",
      locale: "en-US",
      dateFormat: "YYYY-MM-DD",
    },
    description: "Manufacturing and production",
    tips: getIndustryInsights(Industry.MANUFACTURING),
  };
}

function getCourierProfile(): IndustryProfile {
  return {
    industry: Industry.COURIER,
    commonGoals: [
      Goal.FLEET_TRACKING,
      Goal.DRIVER_MANAGEMENT,
      Goal.LAST_MILE,
      Goal.ANALYTICS,
    ],
    recommendedIntegrations: [
      {
        slug: "samsara",
        name: "Samsara",
        category: "fleet-telematics",
        priority: 10,
        rationale: "Real-time fleet visibility essential for courier ops",
        setupEstimateMinutes: 60,
      },
      {
        slug: "google-maps",
        name: "Google Maps",
        category: "mapping",
        priority: 9,
        rationale: "Route planning and real-time navigation",
        setupEstimateMinutes: 30,
      },
      {
        slug: "onesignal",
        name: "OneSignal",
        category: "push-notifications",
        priority: 8,
        rationale: "Push notifications for delivery status",
        setupEstimateMinutes: 25,
      },
      {
        slug: "datadog",
        name: "Datadog",
        category: "monitoring",
        priority: 7,
        rationale: "System monitoring and performance analytics",
        setupEstimateMinutes: 45,
      },
      {
        slug: "flespi",
        name: "Flespi",
        category: "fleet-telematics",
        priority: 6,
        rationale: "Alternative GPS tracking solution",
        setupEstimateMinutes: 40,
      },
    ],
    defaultDashboardLayout: {
      name: "Driver Performance",
      description: "Live fleet status, driver metrics, and delivery KPIs",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "active_drivers",
        "live_map",
        "delivery_rate",
        "driver_efficiency",
        "vehicle_utilization",
      ],
      colorScheme: "red",
    },
    defaultSettings: {
      timezone: "America/New_York",
      currency: "USD",
      distanceUnit: "MILES",
      weightUnit: "LBS",
      locale: "en-US",
      dateFormat: "MM/DD/YYYY",
      deliveryZoneRadiusKm: 100,
    },
    description: "Courier and same-day delivery services",
    tips: getIndustryInsights(Industry.COURIER),
  };
}

function getGroceryProfile(): IndustryProfile {
  return {
    industry: Industry.GROCERY,
    commonGoals: [
      Goal.LAST_MILE,
      Goal.CUSTOMER_NOTIFICATIONS,
      Goal.DRIVER_MANAGEMENT,
      Goal.ORDER_MANAGEMENT,
    ],
    recommendedIntegrations: [
      {
        slug: "shopify",
        name: "Shopify",
        category: "ecommerce",
        priority: 9,
        rationale: "E-commerce platform for online grocery orders",
        setupEstimateMinutes: 45,
      },
      {
        slug: "doordash",
        name: "DoorDash",
        category: "delivery-platforms",
        priority: 9,
        rationale: "Grocery delivery through major platform",
        setupEstimateMinutes: 40,
      },
      {
        slug: "instacart",
        name: "Instacart",
        category: "delivery-platforms",
        priority: 9,
        rationale: "Grocery-focused delivery platform",
        setupEstimateMinutes: 50,
      },
      {
        slug: "temperature-monitor",
        name: "Cold Chain Monitoring",
        category: "iot",
        priority: 8,
        rationale: "Temperature tracking for fresh goods",
        setupEstimateMinutes: 60,
      },
      {
        slug: "onesignal",
        name: "OneSignal",
        category: "push-notifications",
        priority: 7,
        rationale: "Delivery window and arrival notifications",
        setupEstimateMinutes: 25,
      },
    ],
    defaultDashboardLayout: {
      name: "Fresh Delivery Ops",
      description:
        "Delivery status, temperature monitoring, and freshness tracking",
      gridLayout: { rows: 4, cols: 3 },
      defaultWidgets: [
        "active_deliveries",
        "temperature_alerts",
        "delivery_times",
        "freshness_guarantee",
        "customer_satisfaction",
      ],
      colorScheme: "green",
    },
    defaultSettings: {
      timezone: "America/Los_Angeles",
      currency: "USD",
      distanceUnit: "MILES",
      weightUnit: "LBS",
      locale: "en-US",
      dateFormat: "MM/DD/YYYY",
      deliveryZoneRadiusKm: 10,
    },
    description: "Grocery and fresh food delivery",
    tips: getIndustryInsights(Industry.GROCERY),
  };
}

function getCustomProfile(): IndustryProfile {
  return {
    industry: Industry.CUSTOM,
    commonGoals: [],
    recommendedIntegrations: [],
    defaultDashboardLayout: {
      name: "Custom Layout",
      description: "Start with a blank canvas and build your perfect dashboard",
      gridLayout: { rows: 3, cols: 3 },
      defaultWidgets: [],
      colorScheme: "blue",
    },
    defaultSettings: {
      timezone: "America/New_York",
      currency: "USD",
      distanceUnit: "MILES",
      weightUnit: "LBS",
      locale: "en-US",
      dateFormat: "MM/DD/YYYY",
    },
    description: "Custom industry or use case",
    tips: getIndustryInsights(Industry.CUSTOM),
  };
}
