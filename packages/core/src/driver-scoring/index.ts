/**
 * Driver Scoring Engine - Barrel Exports
 * Complete public API for driver performance scoring
 */

// Types
export type {
  DriverMetrics,
  DriverScore,
  ScoreBreakdown,
  ScoringWeights,
  DriverLeaderboardEntry,
  ScoringPeriod,
  LeaderboardResponse,
} from './types';

// Scoring Engine
export {
  calculateOnTimeScore,
  calculateCustomerRatingScore,
  calculatePodComplianceScore,
  calculateRouteEfficiencyScore,
  calculateReliabilityScore,
  determineTier,
  determineTrend,
  calculateDriverScore,
  updateScoreWithTrend,
} from './scoring-engine';

// Metrics Aggregation
export {
  aggregateDriverMetrics,
  aggregateAllDrivers,
  getLeaderboard,
} from './metrics-aggregator';

// Decay
export {
  calculateDecayFactor,
  applyDecay,
} from './decay';

// AI Predictor
export type {
  DriverFeatureVector,
  PredictedScore,
  Anomaly,
  SatisfactionPrediction,
} from './ai-predictor';

export {
  extractFeatures,
  predictFutureScore,
  detectAnomalies,
  predictCustomerSatisfaction,
} from './ai-predictor';
