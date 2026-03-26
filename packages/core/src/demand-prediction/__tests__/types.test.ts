/**
 * Type validation tests for Demand Prediction module
 *
 * Ensures all interfaces are well-formed and type-safe
 * Validates type relationships and required fields
 */

import { describe, it, expect } from "vitest";

import type {
  ZoneProfile,
  ZoneDemandFeatures,
  TemporalFeatures,
  EventFeatures,
  FeatureSnapshot,
  DemandForecast,
  ForecastResponse,
  HourlyForecast,
  PredictionRequest,
  PredictionResponse,
  CapacityRecommendation,
  CapacityRecommendationResponse,
  SlotCapacityAdjustment,
  DemandAnomaly,
  AnomalyResponse,
  ModelPerformanceMetrics,
  ModelPerformanceResponse,
  IDemandPredictor,
  IFeatureStore,
  DemandPredictionConfig,
} from "../types.js";

describe("Zone Profile Types", () => {
  it("should validate ZoneProfile interface", () => {
    const profile: ZoneProfile = {
      id: "zone-001",
      orgId: "org-001",
      zoneId: "z-001",
      populationDensity: 1500,
      businessDensity: 250,
      residentialRatio: 0.75,
      commercialRatio: 0.25,
      historicalAvgVolume: 150,
      historicalPeakVolume: 300,
      avgDeliveryDistance: 8.5,
      competitorPresence: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(profile.id).toBeDefined();
    expect(profile.populationDensity).toBeGreaterThan(0);
    expect(profile.residentialRatio).toBeLessThanOrEqual(1);
  });

  it("should validate ZoneDemandFeatures interface", () => {
    const features: ZoneDemandFeatures = {
      zoneId: "z-001",
      populationDensity: 1500,
      businessDensity: 250,
      historicalAvgVolume: 150,
      historicalPeakVolume: 300,
      competitorPresence: 2,
      avgDeliveryDistance: 8.5,
      residentialRatio: 0.75,
      commercialRatio: 0.25,
    };

    expect(features.zoneId).toBeDefined();
    expect(features.populationDensity).toBeGreaterThan(0);
    expect(features.residentialRatio + features.commercialRatio).toBeLessThanOrEqual(1);
  });
});

describe("Temporal Features Types", () => {
  it("should validate TemporalFeatures interface", () => {
    const temporal: TemporalFeatures = {
      hour: 14,
      dayOfWeek: 3,
      dayOfMonth: 15,
      weekOfYear: 10,
      isHoliday: false,
      seasonalIndex: 1,
      isWeekend: false,
      isMonday: false,
      isFriday: false,
      daysUntilHoliday: 5,
    };

    expect(temporal.hour).toBeGreaterThanOrEqual(0);
    expect(temporal.hour).toBeLessThan(24);
    expect(temporal.dayOfWeek).toBeGreaterThanOrEqual(0);
    expect(temporal.dayOfWeek).toBeLessThan(7);
  });
});

describe("Event Features Types", () => {
  it("should validate EventFeatures interface", () => {
    const events: EventFeatures = {
      hasPromotion: true,
      promotionIntensity: 7.5,
      weatherCondition: "rain",
      temperatureC: 22,
      majorEventNearby: false,
      lastMileApiDown: false,
    };

    expect(["clear", "rain", "snow", "fog", "cloudy", "extreme"]).toContain(
      events.weatherCondition
    );
    expect(events.promotionIntensity).toBeGreaterThanOrEqual(0);
    expect(events.promotionIntensity).toBeLessThanOrEqual(10);
  });
});

describe("Feature Snapshot Types", () => {
  it("should validate FeatureSnapshot interface", () => {
    const snapshot: FeatureSnapshot = {
      id: "snap-001",
      zoneId: "z-001",
      timestamp: new Date(),
      populationDensity: 1500,
      businessDensity: 250,
      historicalAvgVolume: 150,
      hour: 14,
      dayOfWeek: 3,
      seasonalIndex: 1,
      isHoliday: false,
      hasPromotion: false,
      promotionIntensity: 0,
      weatherCondition: "clear",
      temperature: 22,
      observedVolume: 142,
      createdAt: new Date(),
    };

    expect(snapshot.id).toBeDefined();
    expect(snapshot.timestamp).toBeInstanceOf(Date);
    expect(snapshot.observedVolume).toBeGreaterThan(0);
  });
});

describe("Demand Forecast Types", () => {
  it("should validate DemandForecast interface", () => {
    const forecast: DemandForecast = {
      id: "fc-001",
      zoneProfileId: "zp-001",
      forecastTime: new Date(),
      generatedAt: new Date(),
      predictedVolume: 155,
      confidenceLower: 140,
      confidenceUpper: 170,
      confidence: 0.82,
      seasonalComponent: 60,
      regressionComponent: 50,
      dayOfWeekComponent: 45,
      actualVolume: 158,
      accuracy: 0.98,
      granularity: "hourly",
      modelVersion: 3,
      createdAt: new Date(),
    };

    expect(forecast.predictedVolume).toBeGreaterThan(0);
    expect(forecast.confidence).toBeGreaterThanOrEqual(0);
    expect(forecast.confidence).toBeLessThanOrEqual(1);
    expect(["hourly", "daily", "weekly"]).toContain(forecast.granularity);
  });

  it("should validate HourlyForecast interface", () => {
    const hourly: HourlyForecast = {
      hour: 14,
      predictedVolume: 155,
      confidence: 0.82,
      interval: {
        lower: 140,
        upper: 170,
        confidence: 0.8,
      },
      seasonalComponent: 60,
      regressionComponent: 50,
      dayOfWeekComponent: 45,
      anomalousFlag: false,
    };

    expect(hourly.hour).toBeGreaterThanOrEqual(0);
    expect(hourly.hour).toBeLessThan(24);
    expect(hourly.interval.lower).toBeLessThan(hourly.interval.upper);
  });

  it("should validate ForecastResponse interface", () => {
    const response: ForecastResponse = {
      zoneId: "z-001",
      forecastDate: "2026-03-11",
      granularity: "hourly",
      forecasts: [],
      summary: {
        totalExpectedVolume: 3600,
        peakHour: 14,
        peakVolume: 200,
        lowVolume: 80,
        avgConfidence: 0.85,
        anomaliesDetected: 0,
      },
    };

    expect(response.zoneId).toBeDefined();
    expect(response.summary.peakVolume).toBeGreaterThan(response.summary.lowVolume);
  });
});

describe("Capacity Recommendation Types", () => {
  it("should validate SlotCapacityAdjustment interface", () => {
    const adjustment: SlotCapacityAdjustment = {
      hour: 14,
      predictedVolume: 155,
      confidence: 0.82,
      recommendedCapacity: 52,
      currentCapacity: 40,
      capacityDelta: 12,
      confidenceLower: 140,
      confidenceUpper: 170,
      rationale: "Peak delivery hour with high confidence",
    };

    expect(adjustment.hour).toBeGreaterThanOrEqual(0);
    expect(adjustment.hour).toBeLessThan(24);
    expect(adjustment.recommendedCapacity).toBeGreaterThan(0);
  });

  it("should validate CapacityRecommendation interface", () => {
    const recommendation: CapacityRecommendation = {
      id: "cap-001",
      zoneId: "z-001",
      slotDate: new Date(),
      recommendations: [],
      recommendedDriverCount: 12,
      applied: false,
      createdAt: new Date(),
    };

    expect(recommendation.zoneId).toBeDefined();
    expect(recommendation.recommendedDriverCount).toBeGreaterThan(0);
    expect(typeof recommendation.applied).toBe("boolean");
  });

  it("should validate CapacityRecommendationResponse interface", () => {
    const response: CapacityRecommendationResponse = {
      zoneId: "z-001",
      slotDate: "2026-03-11",
      recommendations: [],
      recommendedDriverCount: 12,
      applied: false,
      totalCapacityRecommended: 500,
      totalCurrentCapacity: 450,
      capabilityGain: 11.1,
    };

    expect(response.totalCapacityRecommended).toBeGreaterThanOrEqual(
      response.totalCurrentCapacity || 0
    );
  });
});

describe("Anomaly Detection Types", () => {
  it("should validate DemandAnomaly interface", () => {
    const anomaly: DemandAnomaly = {
      id: "anom-001",
      zoneId: "z-001",
      timestamp: new Date(),
      anomalyType: "spike",
      severity: 0.8,
      observedVolume: 320,
      expectedVolume: 155,
      deviation: 1.06,
      likelyReason: "major_event",
      investigated: false,
      createdAt: new Date(),
    };

    expect(["spike", "drop", "trend_shift", "seasonal_break", "outlier"]).toContain(
      anomaly.anomalyType
    );
    expect(anomaly.severity).toBeGreaterThanOrEqual(0);
    expect(anomaly.severity).toBeLessThanOrEqual(1);
  });

  it("should validate AnomalyResponse interface", () => {
    const response: AnomalyResponse = {
      zoneId: "z-001",
      timeRange: {
        from: new Date("2026-03-01"),
        to: new Date("2026-03-11"),
      },
      anomalies: [],
      summary: {
        totalDetected: 3,
        highSeverity: 1,
        investigated: 1,
      },
    };

    expect(response.summary.highSeverity).toBeLessThanOrEqual(response.summary.totalDetected);
    expect(response.summary.investigated).toBeLessThanOrEqual(response.summary.totalDetected);
  });
});

describe("Model Performance Types", () => {
  it("should validate ModelPerformanceMetrics interface", () => {
    const metrics: ModelPerformanceMetrics = {
      mae: 12.5,
      rmse: 15.3,
      mape: 8.2,
      r2Score: 0.92,
      precision: 0.89,
      recall: 0.87,
    };

    expect(metrics.mae).toBeGreaterThanOrEqual(0);
    expect(metrics.r2Score).toBeGreaterThanOrEqual(-1);
    expect(metrics.r2Score).toBeLessThanOrEqual(1);
    expect(metrics.precision).toBeGreaterThanOrEqual(0);
    expect(metrics.precision).toBeLessThanOrEqual(1);
  });

  it("should validate ModelPerformanceResponse interface", () => {
    const response: ModelPerformanceResponse = {
      timeRange: {
        from: new Date("2026-03-01"),
        to: new Date("2026-03-11"),
      },
      overallMetrics: {
        mae: 12.5,
        rmse: 15.3,
        mape: 8.2,
        r2Score: 0.92,
        precision: 0.89,
        recall: 0.87,
      },
      byZone: [],
      modelVersionUsed: 3,
      lastRetrained: new Date(),
    };

    expect(response.modelVersionUsed).toBeGreaterThan(0);
    expect(response.lastRetrained).toBeInstanceOf(Date);
  });
});

describe("Service Interface Types", () => {
  it("should define IFeatureStore interface methods", () => {
    const iface: IFeatureStore = {
      snapshot: async () => ({} as any),
      getRecent: async () => [],
      getZoneProfile: async () => null,
      updateZoneProfile: async () => {},
    };

    expect(typeof iface.snapshot).toBe("function");
    expect(typeof iface.getRecent).toBe("function");
    expect(typeof iface.getZoneProfile).toBe("function");
    expect(typeof iface.updateZoneProfile).toBe("function");
  });

  it("should define IDemandPredictor interface methods", () => {
    const iface: IDemandPredictor = {
      forecast: async () => [],
      recommendCapacity: async () => ({} as any),
      detectAnomalies: async () => [],
      getPerformance: async () => ({} as any),
      retrain: async () => ({} as any),
    };

    expect(typeof iface.forecast).toBe("function");
    expect(typeof iface.recommendCapacity).toBe("function");
    expect(typeof iface.detectAnomalies).toBe("function");
    expect(typeof iface.getPerformance).toBe("function");
    expect(typeof iface.retrain).toBe("function");
  });
});

describe("Configuration Types", () => {
  it("should validate DemandPredictionConfig interface", () => {
    const config: DemandPredictionConfig = {
      seasonalWeight: 0.4,
      regressionWeight: 0.3,
      dayOfWeekWeight: 0.3,
      safetyFactor: 1.2,
      deliveriesPerSlot: 3,
      anomalySpikeThreshold: 0.5,
      anomalyDropThreshold: -0.3,
      anomalySeverityScale: 5,
      retrainFrequencyHours: 24,
      minHistoryDays: 30,
      minForecastsPerDay: 10,
      forecastCacheTTLMinutes: 60,
      maxForecastHorizonDays: 14,
    };

    const weightSum = config.seasonalWeight + config.regressionWeight + config.dayOfWeekWeight;
    expect(Math.abs(weightSum - 1.0)).toBeLessThan(0.01);
    expect(config.safetyFactor).toBeGreaterThan(1);
    expect(config.deliveriesPerSlot).toBeGreaterThan(0);
  });
});
