/**
 * AI Module Exports
 *
 * Exports for semantic search, smart suggestions, NL parsing, ranking,
 * and route optimization engines.
 */

// ─── Semantic Search ────────────────────────────────────────────────────

export {
  createSemanticSearch,
  SemanticSearch,
  type EmbeddingModel,
  type SearchableEntity,
  type EmbeddingConfig,
  type SearchResult,
  type HybridSearchOptions,
  type IndexEntry,
} from "./semantic-search.js";

// ─── Smart Suggestions ──────────────────────────────────────────────────

export {
  createSmartSuggestions,
  getSmartSuggestions,
  SmartSuggestions,
  type SuggestionContext,
  type TimeOfDay,
  type Suggestion,
  type SuggestionRule,
  type PageContext,
  type SuggestionMetrics,
} from "./smart-suggestions.js";

// ─── Natural Language Filter ────────────────────────────────────────────

export {
  createNLFilterParser,
  nlFilterParser,
  NaturalLanguageFilterParser,
  type Entity,
  type DateExpression,
  type AmountCondition,
  type LocationCondition,
  type StructuredFilter,
} from "./natural-language-filter.js";

// ─── Search Ranking ────────────────────────────────────────────────────

export {
  createSearchRanker,
  getSearchRanker,
  SearchRanker,
  type RankingFeatures,
  type RankingWeights,
  type SearchInteraction,
  type ABTestConfig,
} from "./search-ranking.js";

// ─── Integration Recommender ────────────────────────────────────────────

export {
  IntegrationRecommender,
  IntegrationDependencyGraph,
  analyzeCategoryGaps,
  type IntegrationRecommendation,
  type TenantIntegrationProfile,
  type IndustryType,
  type WorkflowType,
  type DependencyEdge,
  type CategoryCoverageSummary,
} from "./integration-recommender.js";

// ─── Setup Wizard Assistant ────────────────────────────────────────────

export {
  SetupWizardAssistant,
  type SetupStep,
  type ConfigSuggestion,
  type SetupWizardState,
  type SetupProgress,
  type IntegrationSetupGuide,
} from "./setup-wizard-assistant.js";

// ─── Recommendation API ────────────────────────────────────────────────

export {
  RecommendationService,
  RecommendationCache,
  recommendationService,
  recommendationCache,
  type RecommendationResponse,
  type DependencyResponse,
  type GapAnalysisResponse,
  type RecommendationFeedback,
  type RecommendationAlgorithm,
} from "./recommendation-api.js";

// ─── Route Optimization ────────────────────────────────────────────────

export {
  optimizeRoutes,
  type OptimizationMode,
  type Coordinate,
  type TimeWindow,
  type Stop,
  type Vehicle,
  type RouteSequence,
  type Break,
  type OptimizationResult,
  type OptimizationRequest,
} from "./route-optimizer.js";

// ─── ETA Prediction ────────────────────────────────────────────────────

export {
  createETAPredictor,
  getETAPredictor,
  ETAPredictor,
  type VehicleType,
  type WeatherCondition,
  type RouteSegment,
  type DeliveryEvent,
  type ETAPrediction,
  type RouteProgress,
  type HistoricalSpeedData,
} from "./eta-predictor.js";

// ─── Delivery Zone Analysis ────────────────────────────────────────────

export {
  createDeliveryZoneAnalyzer,
  DeliveryZoneAnalyzer,
  type Zone,
  type WeeklyPattern,
  type HourlyDistribution,
  type HeatMapData,
  type GeoJSONFeature,
  type GeoJSONCollection,
  type Delivery,
} from "./delivery-zone-analyzer.js";

// ─── Smart Driver Assignment ────────────────────────────────────────────

export {
  createSmartDriverAssignment,
  SmartDriverAssignment,
  type Order,
  type Driver,
  type DriverScore,
  type AssignmentResult,
  type BatchAssignmentResult,
} from "./smart-driver-assignment.js";

// ─── Optimization API ──────────────────────────────────────────────────

export {
  handleOptimizeRoutes,
  handlePredictETA,
  handleGetZoneHeatmap,
  handleAssignDrivers,
  handleCalculateSavings,
  type ApiResponse,
  type OptimizeRoutesRequest,
  type ETARequest,
  type DeliveryZoneRequest,
  type DriverAssignmentRequest,
} from "./optimization-api.js";

// ─── Delivery Time Prediction ──────────────────────────────────────────────

export {
  createDeliveryTimePrediction,
  getDeliveryTimePrediction,
  DeliveryTimePrediction,
  CarrierPerformanceTracker,
  WeatherImpactEstimator,
  HolidayCalendar,
  type CarrierPerformance,
  type WeatherImpact,
  type PredictionFactors,
  type DeliveryPrediction,
  type DeliveryOutcome,
} from "./delivery-time-predictor.js";

// ─── Smart Carrier Selector ────────────────────────────────────────────────

export {
  createSmartCarrierSelector,
  getSmartCarrierSelector,
  SmartCarrierSelector,
  CarrierScorer,
  ReliabilityTracker,
  CostOptimizer,
  SpeedOptimizer,
  GreenShippingOptimizer,
  CarrierABTestManager,
  type CarrierRate,
  type CarrierReliability,
  type EcoInfo,
  type CarrierScore,
  type ScoringWeights,
  type CarrierRecommendation,
  type ShippingPreference,
  type CarrierABTest,
  type ABTestOutcome,
} from "./smart-carrier-selector.js";

// ─── Shipping Analytics ────────────────────────────────────────────────────

export {
  createShippingAnalytics,
  getShippingAnalytics,
  ShippingAnalyticsEngine,
  CostAnalyzer,
  PerformanceAnalyzer,
  VolumeAnalyzer,
  AnomalyDetector,
  ShippingForecaster,
  type ShipmentRecord,
  type CostBreakdown,
  type PerformanceMetrics,
  type VolumeReport,
  type Anomaly,
  type Forecast,
  type ShippingAnalytics,
} from "./shipping-analytics.js";

// ─── Shipping API ──────────────────────────────────────────────────────────

export {
  createShippingAPI,
  getShippingAPI,
  ShippingAPIHandler,
  type PredictDeliveryRequest,
  type PredictDeliveryResponse,
  type RecommendCarrierRequest,
  type RecommendCarrierResponse,
  type SubmitFeedbackRequest,
  type SubmitFeedbackResponse,
  type AnalyticsRequest,
  type AnalyticsResponse,
} from "./shipping-api.js";

// ─── Intelligent Order Router ──────────────────────────────────────────────

export {
  createIntelligentOrderRouter,
  IntelligentOrderRouter,
  ProximityCalculator,
  StockChecker,
  CapacityTracker,
  CostEstimator,
  SLAScorer,
  FulfillmentScorer,
  SplitOrderDetector,
  RoutingExplainer,
  type Coordinate,
  type OrderItem,
  type Order,
  type Warehouse,
  type WarehouseCandidate,
  type FulfillmentScore,
  type RoutingDecision,
  type SplitOrder,
  type RoutingExplanation,
  type FulfillmentRule,
  type FulfillmentRules,
  type RoutingOptions,
} from "./intelligent-order-router.js";

// ─── Demand Forecaster ─────────────────────────────────────────────────────

export {
  createDemandForecaster,
  DemandForecasterService,
  TimeSeriesAnalyzer,
  SeasonalDecomposer,
  TrendDetector,
  DemandPredictor,
  ReorderSuggester,
  SKUClusterer,
  type SalesDataPoint,
  type SeasonalPattern,
  type TrendInfo,
  type DemandForecast,
  type SKUCluster,
  type ReorderSuggestion,
  type ExternalFactor,
} from "./demand-forecaster.js";

// ─── Order Routing API ────────────────────────────────────────────────────

export {
  getOrderRoutingAPI,
  createOrderRoutingAPI,
  handleAssignOrder,
  handleEvaluateOptions,
  handleGetRoutingRules,
  handleUpdateRoutingRules,
  handlePredictDemand,
  handleGetReorderSuggestions,
  handleGetTrends,
  OrderRoutingAPIHandler,
  type ApiResponse,
  type RoutingAssignRequest,
  type RoutingAssignResponse,
  type RoutingEvaluateRequest,
  type RoutingEvaluateResponse,
  type ForecastPredictRequest,
  type ForecastPredictResponse,
  type ForecastSuggestionsRequest,
  type ForecastSuggestionsResponse,
  type ForecastTrendsRequest,
  type ForecastTrendsResponse,
  type RoutingRulesUpdateRequest,
} from "./order-routing-api.js";

// ─── Customer Lifetime Value Predictor ─────────────────────────────────────

export {
  createCustomerLTVPredictor,
  getCustomerLTVPredictor,
  DataFuser,
  FeatureExtractor,
  LTVPredictor,
  CohortAnalyzer,
  ChurnPredictor,
  type CustomerContact,
  type CustomerActivity,
  type OrderData,
  type PaymentData,
  type RFMFeatures,
  type CustomerProfile,
  type LTVPrediction,
  type CohortAnalysis,
  type ChurnRisk,
  type CustomerSegment,
} from "./customer-ltv-predictor.js";

// ─── CRM Intelligence Engine ──────────────────────────────────────────────

export {
  createCRMIntelligence,
  getCRMIntelligence,
  DealScoringModel,
  LeadScorer,
  ActivityRecommender,
  RelationshipStrengthCalculator,
  SalesForecaster,
  type Deal,
  type Lead,
  type Contact,
  type DealScore,
  type LeadScore,
  type ActivityRecommendation,
  type RelationshipScore,
  type SalesForecast,
  type WinLossAnalysis,
  type DealStage,
  type ActivityType,
  type NextAction,
} from "./crm-intelligence.js";

// ─── CRM Intelligence API ─────────────────────────────────────────────────

export {
  createCRMIntelligenceAPI,
  handleLTVPredict,
  handleGetSegments,
  handleGetCohorts,
  handleScoreDeal,
  handleScoreLead,
  handleGetRecommendations,
  handleGetForecast,
  handleChurnRisk,
  type ApiResponse,
  type LTVPredictRequest,
  type LTVSegmentsResponse,
  type CohortsResponse,
  type DealScoringRequest,
  type LeadScoringRequest,
  type RecommendationRequest,
  type ForecastRequest,
  type ChurnRiskRequest,
} from "./crm-intelligence-api.js";

// ─── Smart Notification Timer ─────────────────────────────────────────────

export {
  createSmartNotificationTimer,
  createBatchOptimizer,
  UserActivityTracker,
  EngagementScorer,
  OptimalTimePredictor,
  ChannelPreferenceLearner,
  SendTimeOptimizer,
  BatchOptimizer,
  type DayOfWeekActivity,
  type UserActivity,
  type EngagementScore,
  type SendTimeRecommendation,
  type ChannelPreference,
  type BatchSendSchedule,
  type NotificationOutcome,
} from "./smart-notification-timer.js";

// ─── Notification Fatigue Detector ────────────────────────────────────────

export {
  createFatigueDetector,
  createOverloadDetector,
  createThrottleRecommender,
  createImportanceRanker,
  createDigestOptimizer,
  createUnsubscribePrediction,
  FatigueScorer,
  OverloadDetector,
  ThrottleRecommender,
  ImportanceRanker,
  DigestOptimizer,
  UnsubscribePrediction,
  type FatigueSignal,
  type FatigueScore,
  type ThrottleRecommendation,
  type ImportanceScore,
  type DigestWindow,
  type UnsubscribePrediction as UnsubscribePredictionType,
} from "./notification-fatigue-detector.js";

// ─── Notification Intelligence API ────────────────────────────────────────

export {
  getOptimalTime,
  optimizeBatchSend,
  getFatigueScore,
  getEngagementMetrics,
  recommendChannel,
  recordFeedback,
  getAnalytics,
  getUnsubscribeRisk,
  type ApiResponse as NotificationApiResponse,
  type OptimalTimeRequest,
  type BatchOptimizeRequest,
  type EngagementRequest,
  type ChannelRecommendRequest,
  type FeedbackRequest,
  type NotificationAnalytics,
} from "./notification-intelligence-api.js";
