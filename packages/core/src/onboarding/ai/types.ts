/**
 * AI-Powered Smart Onboarding Types
 *
 * Core types for AI features including:
 * - Industry classification and defaults
 * - Business goal definitions
 * - Industry profiles and recommendation structures
 * - Smart recommendation scoring and reasoning
 * - Onboarding analytics event tracking
 * - Completion prediction and risk factors
 *
 * These types enable intelligent defaults, personalized recommendations,
 * and analytics for onboarding flow optimization.
 */

// ─── INDUSTRY CLASSIFICATION ──────────────────────────────────────

/**
 * Supported industries for intelligent default configuration.
 * Each industry has distinct integration needs, goals, and workflows.
 */
export enum Industry {
  ECOMMERCE = "ECOMMERCE",
  FOOD_BEVERAGE = "FOOD_BEVERAGE",
  HEALTHCARE = "HEALTHCARE",
  LOGISTICS_3PL = "LOGISTICS_3PL",
  FIELD_SERVICE = "FIELD_SERVICE",
  MANUFACTURING = "MANUFACTURING",
  COURIER = "COURIER",
  GROCERY = "GROCERY",
  CUSTOM = "CUSTOM",
}

// ─── BUSINESS GOALS ───────────────────────────────────────────────

/**
 * Primary business goals that shape feature and integration recommendations.
 * Multiple goals can be selected during onboarding for a tailored experience.
 */
export enum Goal {
  ROUTE_OPTIMIZATION = "ROUTE_OPTIMIZATION",
  FLEET_TRACKING = "FLEET_TRACKING",
  LAST_MILE = "LAST_MILE",
  MULTI_CARRIER = "MULTI_CARRIER",
  ORDER_MANAGEMENT = "ORDER_MANAGEMENT",
  CUSTOMER_NOTIFICATIONS = "CUSTOMER_NOTIFICATIONS",
  ANALYTICS = "ANALYTICS",
  ERP_INTEGRATION = "ERP_INTEGRATION",
  DRIVER_MANAGEMENT = "DRIVER_MANAGEMENT",
  COMPLIANCE_ELD = "COMPLIANCE_ELD",
}

// ─── INDUSTRY PROFILE ─────────────────────────────────────────────

/**
 * Comprehensive industry profile with defaults, recommended integrations,
 * and pre-configured settings for a specific industry.
 */
export interface IndustryProfile {
  industry: Industry;
  commonGoals: Goal[];
  recommendedIntegrations: RecommendedIntegration[];
  defaultDashboardLayout: DashboardLayout;
  defaultSettings: WorkspaceDefaults;
  description: string;
  tips: string[];
}

/**
 * Integration recommendation with ranking and metadata.
 */
export interface RecommendedIntegration {
  slug: string;
  name: string;
  category: string;
  priority: number; // 1-10, higher = more important for this industry
  rationale: string;
  setupEstimateMinutes: number;
}

/**
 * Pre-configured dashboard layout structure.
 */
export interface DashboardLayout {
  name: string;
  description: string;
  gridLayout: {
    rows: number;
    cols: number;
  };
  defaultWidgets: string[]; // Widget type names
  colorScheme?: string;
}

/**
 * Default workspace settings per industry.
 */
export interface WorkspaceDefaults {
  timezone: string;
  currency: string;
  distanceUnit: "KM" | "MILES";
  weightUnit: "KG" | "LBS";
  locale: string;
  dateFormat: string;
  deliveryZoneRadiusKm?: number;
  routeOptimizationMethod?: string;
}

// ─── SMART RECOMMENDATIONS ────────────────────────────────────────

/**
 * Smart recommendation with confidence score and reasoning.
 */
export interface SmartRecommendation<T> {
  items: T[];
  confidence: number; // 0-1, higher = more confident
  reason: string;
  basedOn: string[]; // List of factors: "industry", "goals", "companySize", etc.
  metadata?: Record<string, unknown>;
}

/**
 * Integration recommendation with scoring details.
 */
export interface IntegrationRecommendation {
  slug: string;
  name: string;
  category: string;
  score: number; // 0-100
  confidenceBreakdown: {
    industryMatch: number; // 0-40
    goalRelevance: number; // 0-35
    popularity: number; // 0-15
    companySizeFit: number; // 0-10
  };
  reason: string;
}

/**
 * Dashboard widget recommendation.
 */
export interface WidgetRecommendation {
  widgetType: string;
  title: string;
  description: string;
  position?: { row: number; col: number };
  relevantToGoals: Goal[];
}

/**
 * Next step suggestion in onboarding journey.
 */
export interface NextStepSuggestion {
  title: string;
  description: string;
  actionUrl: string;
  priority: "high" | "medium" | "low";
  estimateMinutes: number;
}

// ─── ONBOARDING ANALYTICS ────────────────────────────────────────

/**
 * All event types tracked during onboarding for analytics.
 */
export enum OnboardingAnalyticsEventType {
  STEP_STARTED = "step_started",
  STEP_COMPLETED = "step_completed",
  STEP_SKIPPED = "step_skipped",
  INTEGRATION_TOGGLED = "integration_toggled",
  INTEGRATION_SELECTED = "integration_selected",
  FORM_ERROR = "form_error",
  FORM_SUBMITTED = "form_submitted",
  GOAL_SELECTED = "goal_selected",
  GOAL_DESELECTED = "goal_deselected",
  ONBOARDING_COMPLETED = "onboarding_completed",
  ONBOARDING_ABANDONED = "onboarding_abandoned",
  HELP_REQUESTED = "help_requested",
  RECOMMENDATION_VIEWED = "recommendation_viewed",
  RECOMMENDATION_ACCEPTED = "recommendation_accepted",
}

/**
 * Analytics event recorded during onboarding.
 */
export interface OnboardingAnalyticsEvent {
  eventType: OnboardingAnalyticsEventType;
  userId: string;
  orgId?: string;
  step: string;
  subStep?: string;
  timestamp: Date;
  data: Record<string, unknown>;
  sessionId: string;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    source?: string;
  };
}

/**
 * Step completion metrics.
 */
export interface StepCompletionMetrics {
  step: string;
  totalStarted: number;
  totalCompleted: number;
  completionRate: number; // 0-1
  averageTimeMinutes: number;
  medianTimeMinutes: number;
  abandonmentRate: number; // 0-1
}

/**
 * Conversion funnel step.
 */
export interface ConversionFunnelStep {
  step: string;
  usersReached: number;
  usersCompleted: number;
  conversionRate: number; // 0-1
  dropOffPercentage: number;
}

/**
 * Popular selections during onboarding.
 */
export interface PopularSelection {
  name: string;
  slug?: string;
  count: number;
  percentage: number; // 0-100
}

// ─── COMPLETION PREDICTION ────────────────────────────────────────

/**
 * Prediction of whether a user will complete onboarding.
 */
export interface CompletionPrediction {
  willComplete: boolean;
  dropOffRisk: "low" | "medium" | "high";
  riskScore: number; // 0-1, higher = more risk
  suggestedIntervention: InterventionSuggestion | null;
  factors: RiskFactor[];
  confidence: number; // 0-1
}

/**
 * Risk factor affecting completion prediction.
 */
export interface RiskFactor {
  name: string;
  severity: "low" | "medium" | "high";
  description: string;
  weight: number; // 0-1, contribution to overall risk
}

/**
 * Suggested intervention to help user complete onboarding.
 */
export interface InterventionSuggestion {
  type: "tooltip" | "simplify_step" | "skip_optional" | "email_reminder";
  message: string;
  actionUrl?: string;
  priority: "high" | "medium" | "low";
}

// ─── A/B TESTING ──────────────────────────────────────────────────

/**
 * A/B test variant.
 */
export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-1, traffic allocation
}

/**
 * A/B test experiment definition.
 */
export interface ABTestExperiment {
  name: string;
  description: string;
  variants: ABTestVariant[];
  createdAt: Date;
  startedAt: Date;
  endedAt?: Date;
  status: "active" | "paused" | "completed";
}

/**
 * A/B test variant statistics.
 */
export interface ABTestVariantStats {
  variantId: string;
  variantName: string;
  conversions: number;
  trials: number;
  conversionRate: number; // 0-1
  averageTimeMinutes?: number;
  confidence?: number; // Statistical confidence
}

/**
 * A/B test experiment results.
 */
export interface ABTestResults {
  experimentName: string;
  variants: ABTestVariantStats[];
  winner?: string; // Variant name
  statisticalSignificance?: number; // 0-1
  sampleSize: number;
}

// ─── ONBOARDING CONFIGURATION ────────────────────────────────────

/**
 * Complete onboarding configuration gathered during setup.
 */
export interface OnboardingConfiguration {
  industry: Industry;
  goals: Goal[];
  companySize?: "startup" | "small" | "medium" | "enterprise";
  selectedIntegrations: string[];
  workspaceDefaults: WorkspaceDefaults;
  dashboardLayout: DashboardLayout;
  createdAt: Date;
  updatedAt: Date;
}
