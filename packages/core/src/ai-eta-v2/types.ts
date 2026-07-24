/**
 * ML ETA Engine v2 - Complete Type Definitions
 *
 * Defines all types for the traffic-aware multi-model ETA prediction system.
 */

/**
 * Feature vector for ML models
 */
export interface FeatureVector {
  distance_km: number;
  zone_type: "urban-core" | "urban" | "suburban" | "rural" | "highway";
  hour: number; // 0-23
  day_of_week: number; // 0-6 (Sunday-Saturday)
  is_holiday: boolean;
  is_weekend: number; // 0 or 1
  weather_condition: "clear" | "rain" | "snow" | "fog" | "unknown";
  weather_intensity: number; // 0-1
  traffic_condition: "light" | "moderate" | "heavy" | "unknown";
  traffic_multiplier: number; // 1.0+
  historical_avg_minutes: number;
  driver_experience_score: number; // 0-1
  vehicle_type: "bike" | "car" | "van" | "truck";
  num_stops_remaining: number;
  temperature_celsius: number;
  wind_speed_kmh: number;
  precipitation_mm: number;
}

/**
 * ETA prediction output from a single model
 */
export interface ModelPrediction {
  modelName: string;
  predicted_duration_minutes: number;
  confidence: number; // 0-1
  lower_bound_minutes: number;
  upper_bound_minutes: number;
  error_estimate?: number;
}

/**
 * Training data point for models
 */
export interface HistoricalDelivery {
  delivery_id: string;
  distance_km: number;
  zone_type: "urban-core" | "urban" | "suburban" | "rural" | "highway";
  hour: number;
  day_of_week: number;
  is_holiday: boolean;
  weather_condition: "clear" | "rain" | "snow" | "fog" | "unknown";
  weather_intensity: number;
  traffic_condition: "light" | "moderate" | "heavy" | "unknown";
  driver_experience_score: number;
  vehicle_type: "bike" | "car" | "van" | "truck";
  num_stops: number;
  actual_duration_minutes: number;
  planned_duration_minutes?: number;
  timestamp: Date;
  temperature_celsius: number;
  wind_speed_kmh: number;
  precipitation_mm: number;
}

/**
 * Ensemble ETA prediction with confidence
 */
export interface ETAPrediction {
  predicted_duration_minutes: number;
  confidence: number; // 0-1
  lower_bound_minutes: number; // p10
  upper_bound_minutes: number; // p90
  p50_minutes: number;
  model_predictions: ModelPrediction[];
  dominant_model: string;
  ensemble_method: "weighted" | "median" | "hybrid";
  feature_vector: Partial<FeatureVector>;
  generated_at: Date;
}

/**
 * Calibration metrics for a model
 */
export interface CalibrationMetrics {
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Squared Error
  mape: number; // Mean Absolute Percentage Error
  p50_error: number; // Median error
  p90_error: number; // 90th percentile error
  sample_count: number;
  accuracy_percentage: number; // % predictions within ±5 mins
}

/**
 * Model performance metrics for tracking
 */
export interface ModelPerformanceMetrics {
  modelName: string;
  metrics: CalibrationMetrics;
  zone_metrics: Record<string, CalibrationMetrics>;
  hour_metrics: Record<number, CalibrationMetrics>;
  last_updated: Date;
  samples_since_last_update: number;
}

/**
 * Training configuration
 */
export interface TrainingConfig {
  minSamplesPerZone: number;
  minSamplesPerHour: number;
  maxDataAgeHours: number;
  validationSplit: number; // 0-1
  learningRate?: number;
  regularizationLambda?: number;
}

/**
 * Prediction context for ensemble
 */
export interface PredictionContext {
  features: FeatureVector;
  model_enabled_flags: Record<string, boolean>;
  model_weights: Record<string, number>;
  use_confidence_weighting: boolean;
  outlier_threshold: number; // standard deviations
}

/**
 * Calibration result
 */
export interface CalibrationResult {
  model_name: string;
  bias_correction_factor: number;
  scale_correction_factor: number;
  confidence_calibration: Record<string, number>;
  applied_at: Date;
}

/**
 * Model weights in ensemble
 */
export interface ModelWeights {
  timeOfDay: number;
  distanceDecay: number;
  historicalSimilarity: number;
  traffic: number;
  weather: number;
  gbdt?: number;
}

/**
 * Time-of-day model state
 */
export interface TimeOfDayModelState {
  hourly_profiles: Record<
    number,
    {
      baseline_minutes: number;
      std_dev: number;
      weekday_multiplier: number;
      weekend_multiplier: number;
      holiday_multiplier: number;
      sample_count: number;
    }
  >;
  season_factors: Record<string, number>;
}

/**
 * Traffic model state
 */
export interface TrafficModelState {
  zone_delay_factors: Record<string, Record<number, number>>; // zone -> hour -> delay factor
  condition_multipliers: {
    light: number;
    moderate: number;
    heavy: number;
  };
  calibration: CalibrationResult[];
}

/**
 * Weather model state
 */
export interface WeatherModelState {
  condition_coefficients: Record<string, number>;
  intensity_curve: Record<string, number[]>;
  interaction_effects: Record<string, number>;
}

/**
 * Distance decay model state
 */
export interface DistanceDecayModelState {
  short_range_slope: number; // < 5km
  short_range_intercept: number;
  short_range_r_squared: number;
  short_range_sample_count: number;
  medium_range_slope: number; // 5-20km
  medium_range_intercept: number;
  medium_range_r_squared: number;
  medium_range_sample_count: number;
  long_range_slope: number; // > 20km
  long_range_intercept: number;
  long_range_r_squared: number;
  long_range_sample_count: number;
  urban_multiplier: number;
  loading_unloading_baseline: number;
}

/**
 * Historical delivery model state
 */
export interface HistoricalDeliveryModelState {
  zone_kdtrees: Record<string, HistoricalDelivery[]>;
  adaptive_k: number;
  recency_weight_decay: number;
}

/**
 * Ensemble state
 */
export interface EnsembleState {
  model_weights: ModelWeights;
  calibration_data: Record<string, CalibrationResult>;
  outlier_models: Set<string>;
  last_calibration: Date;
  zone_specific_weights: Record<string, ModelWeights>;
  time_specific_weights: Record<number, ModelWeights>;
  // Sub-model states for full serialization
  sub_models?: {
    timeOfDay: TimeOfDayModelState;
    distanceDecay: DistanceDecayModelState;
    historical: HistoricalDeliveryModelState;
    traffic: TrafficModelState;
    weather: WeatherModelState;
  };
}

/**
 * Accuracy report
 */
export interface AccuracyReport {
  period_start: Date;
  period_end: Date;
  overall_metrics: CalibrationMetrics;
  by_model: Record<string, CalibrationMetrics>;
  by_zone: Record<string, CalibrationMetrics>;
  by_hour: Record<number, CalibrationMetrics>;
  degradation_alerts: Array<{
    model_name: string;
    metric: string;
    previous_value: number;
    current_value: number;
    change_percentage: number;
  }>;
}

/**
 * Feature importance
 */
export interface FeatureImportance {
  modelName: string;
  feature_importance: Record<string, number>;
  top_features: Array<{
    feature: string;
    importance: number;
  }>;
}
