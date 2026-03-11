/**
 * Demand Prediction Module
 *
 * Complete AI-powered demand forecasting system for delivery zone optimization:
 * - Multi-model ensemble forecasting (seasonal, regression, day-of-week)
 * - Zone demand profiling and feature engineering
 * - Automatic slot capacity recommendations
 * - Anomaly detection for unusual demand patterns
 * - Driver allocation optimization
 *
 * Usage:
 * import {
 *   DemandForecast,
 *   CapacityRecommendation,
 *   IDemandPredictor,
 *   ZoneProfile,
 * } from '@witylogix/core/demand-prediction';
 */

// ─── TYPE EXPORTS ───────────────────────────────────────────────

export type {
  // Zone Profiles
  ZoneProfile,
  ZoneDemandFeatures,
  // Temporal Features
  TemporalFeatures,
  // Event Features
  EventFeatures,
  WeatherCondition,
  // Feature Snapshots
  FeatureSnapshot,
  // Demand Forecasts
  DemandForecast,
  ForecastResponse,
  ForecastGranularity,
  ForecastInterval,
  HourlyForecast,
  PredictionRequest,
  PredictionResponse,
  // Capacity Recommendations
  CapacityRecommendation,
  CapacityRecommendationResponse,
  SlotCapacityAdjustment,
  // Anomalies
  DemandAnomaly,
  AnomalyResponse,
  AnomalyType,
  AnomalyReason,
  // Model Performance
  ModelPerformanceMetrics,
  ModelPerformanceResponse,
  ZonePerformance,
  // Service Interfaces
  IDemandPredictor,
  IFeatureStore,
  // Config & Utility
  DemandPredictionConfig,
  BatchPredictionJob,
  BatchPredictionResult,
  // ML Types
  SeasonalDecomposition,
  MultiSeasonalDecomposition,
  ZoneCharacteristics,
  PatternFeatures,
  SimilarDay,
  Anomaly,
  ModelPrediction,
  DemandPrediction,
  ModelMetrics,
  ScheduleSlot,
  DriverAllocation,
  CapacityGap,
  ScheduleReport,
  WhatIfScenario,
  SmartSchedulerConfig,
  EnsembleConfig,
  PredictionGranularity,
  HistoricalDemand,
  DemandDataPoint,
} from "./types.js";

// ─── MODEL EXPORTS ──────────────────────────────────────────────

export {
  extractTrend,
  extractSeasonalComponent,
  forecastSeasonal,
  decomposeMultiSeasonal,
  forecastMultiSeasonal,
  getSeasonalIndices,
  getSeasonalityStrength,
  getTrendStrength,
  decomposeSeries,
} from "./models/seasonal-decomposition";

export {
  trainZoneRegression,
  predictWithRegression,
  extractFeatures,
  predictWithCrossZoneLearning,
} from "./models/zone-regression";

export {
  findSimilarDays,
  extractPatternFeatures,
  predictFromPatterns,
  matchHolidayPattern,
  getClusterAverageFallback,
  aggregateToDailyForecast,
} from "./models/pattern-matcher";

export {
  initializeStatistics,
  updateEWMA,
  CUSUMDetector,
  classifyAnomaly,
  calculateSeverity,
  detectAnomaly,
  detectAnomalies,
  calculateControlLimits,
} from "./models/anomaly-detector";

// ─── ENSEMBLE & SCHEDULER EXPORTS ──────────────────────────────

export { DemandEnsemble } from "./demand-ensemble";
export { SmartScheduler } from "./smart-scheduler";

// ─── FEATURE STORE & AGGREGATOR EXPORTS ────────────────────────

export {
  type ZoneFeatures as ZoneFeatureSnapshot,
  type TemporalFeatures as TemporalFeaturesSnapshot,
  type IFeatureStore as IFeatureStoreNew,
  ZoneFeatureStore,
  VersionedFeatureStore,
} from './feature-store.js';

export {
  type Granularity,
  type DeliveryRecord,
  type AggregationResult,
  DataAggregator,
} from './data-aggregator.js';

export {
  type TimeSeriesPoint,
  type DecompositionResult,
  type ChangePoint,
  type OutlierPoint,
  TimeSeriesExtractor,
} from './time-series-extractor.js';

export {
  type ZoneProfile as ZoneProfileCharacteristics,
  type ClusterAssignment,
  ZoneProfiler,
} from './zone-profiler.js';

export {
  type Holiday,
  type SpecialEvent,
  HolidayCalendar,
} from './holiday-calendar.js';
