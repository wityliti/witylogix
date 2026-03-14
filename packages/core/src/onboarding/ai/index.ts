/**
 * AI-Powered Smart Onboarding Export
 *
 * Provides intelligent onboarding features:
 * - Industry defaults and recommendations
 * - Goal-to-feature mapping
 * - Smart integration recommendations
 * - Onboarding analytics and funnel tracking
 * - Completion prediction and interventions
 * - A/B testing framework
 */

// Types
export * from "./types";

// Industry defaults
export {
  getIndustryDefaults,
  getIndustryInsights,
} from "./industry-defaults-engine";

// Goal-to-feature mapping
export {
  mapGoalsToFeatures,
  suggestDashboardLayout,
  rankIntegrations,
  getEnabledPages,
  isIntegrationRelevantToGoals,
  getIntegrationsByCategory,
} from "./goal-feature-mapper";

// Smart recommendations
export {
  recommendIntegrations,
  recommendDashboardWidgets,
  suggestNextSteps,
  getSimilarCompanyInsights,
} from "./smart-recommendations";

// Analytics
export {
  trackEvent,
  getStepCompletionRates,
  getAverageTimePerStep,
  getDropOffPoints,
  getPopularIntegrations,
  getPopularGoals,
  getConversionFunnel,
  getCohortAnalysisByIndustry,
  exportAnalyticsJSON,
  exportAnalyticsCSV,
  clearAnalytics,
  getAnalyticsEvents,
  getAnalyticsSummary,
} from "./onboarding-analytics";

// Completion prediction
export {
  predictCompletion,
  getRiskAssessment,
  shouldOfferSupport,
  estimateCompletionTime,
  getCohortCompletionPrediction,
} from "./completion-predictor";

// A/B testing
export {
  ABTestManager,
  createDefaultExperimentManager,
  getExperimentManager,
  resetExperimentManager,
} from "./ab-testing";
