/**
 * Shipping AI API Endpoints
 *
 * REST API for:
 * - POST /api/shipping/predict — predict delivery time
 * - POST /api/shipping/recommend — get carrier recommendation
 * - GET /api/shipping/analytics — get shipping analytics
 * - GET /api/shipping/analytics/cost — cost breakdown
 * - GET /api/shipping/analytics/performance — carrier performance
 * - POST /api/shipping/feedback — submit actual delivery outcome for learning
 *
 * All endpoints are tenant-scoped and require authentication
 */

import {
  DeliveryTimePrediction,
  DeliveryTimePrediction as DeliveryTimePredictor,
  PredictionFactors,
  DeliveryOutcome,
  createDeliveryTimePrediction,
} from "./delivery-time-predictor.js";

import {
  CarrierRecommendation,
  CarrierRate,
  SmartCarrierSelector,
  createSmartCarrierSelector,
} from "./smart-carrier-selector.js";

import {
  ShippingAnalytics,
  ShipmentRecord,
  ShippingAnalyticsEngine,
  createShippingAnalytics,
  CostBreakdown,
  PerformanceMetrics,
} from "./shipping-analytics.js";

// ─── TYPES ─────────────────────────────────────────────────────────────────

/**
 * Request to predict delivery time
 */
export interface PredictDeliveryRequest {
  tenantId: string;
  carrier: string; // 'ups', 'fedex', etc.
  serviceLevel: string; // 'ground', 'express', 'overnight', 'economy', 'international'
  originZip: string;
  destinationZip: string;
  shipDate: string; // ISO 8601
  weight: number; // kg
  weightCategory?: "light" | "medium" | "heavy" | "oversize";
  weatherOrigin?: string; // 'clear', 'rain', 'snow', 'fog', 'storm', 'extreme'
  weatherDestination?: string;
  weatherRoute?: string;
  isHoliday?: boolean;
  isBlackoutDate?: boolean;
}

/**
 * Response with delivery prediction
 */
export interface PredictDeliveryResponse {
  success: boolean;
  data?: {
    estimatedDays: number;
    estimatedDeliveryDate: string; // ISO 8601
    confidencePercent: number;
    confidenceInterval: {
      optimistic: number;
      realistic: number;
      pessimistic: number;
    };
    factors: {
      baseEstimate: number;
      carrierPerformanceFactor: number;
      distanceFactor: number;
      dayOfWeekFactor: number;
      weatherFactor: number;
      holidayFactor: number;
      weightFactor: number;
      finalEstimate: number;
    };
    reasoning: string[];
  };
  error?: string;
  timestamp: string;
}

/**
 * Request to get carrier recommendation
 */
export interface RecommendCarrierRequest {
  tenantId: string;
  originZip: string;
  destinationZip: string;
  shipDate: string; // ISO 8601
  weight: number; // kg
  deadlineDays?: number;
  maxBudget?: number; // USD
  prioritizeEco?: boolean;
  rates: {
    carrier: string;
    service: string;
    serviceCode: string;
    serviceLevel: string;
    cost: number;
    currency: string;
    estimatedDays: number;
    estimatedDeliveryDate: string;
  }[];
}

/**
 * Response with carrier recommendation
 */
export interface RecommendCarrierResponse {
  success: boolean;
  data?: {
    recommendedCarrier: string;
    recommendedService: string;
    recommendedServiceCode: string;
    estimatedCost: number;
    currency: string;
    estimatedDeliveryDate: string;
    estimatedDays: number;
    score: number;
    confidence: number;
    reasoning: string[];
    alternatives: {
      carrier: string;
      service: string;
      cost: number;
      estimatedDays: number;
      score: number;
    }[];
  };
  error?: string;
  timestamp: string;
}

/**
 * Request to submit delivery feedback
 */
export interface SubmitFeedbackRequest {
  tenantId: string;
  trackingNumber: string;
  carrier: string;
  serviceLevel: string;
  originZip: string;
  destinationZip: string;
  shipDate: string; // ISO 8601
  deliveryDate: string; // ISO 8601
  weight: number; // kg
  cost: number; // USD
  onTime: boolean;
  damaged: boolean;
  rating?: number; // 1-5
  comments?: string;
}

/**
 * Response to feedback submission
 */
export interface SubmitFeedbackResponse {
  success: boolean;
  message?: string;
  error?: string;
  timestamp: string;
}

/**
 * Request for shipping analytics
 */
export interface AnalyticsRequest {
  tenantId: string;
  period?: string; // 'month', 'quarter', 'year' or specific date range
  startDate?: string; // ISO 8601
  endDate?: string; // ISO 8601
}

/**
 * Response with shipping analytics
 */
export interface AnalyticsResponse {
  success: boolean;
  data?: {
    period: string;
    dataPoints: number;
    summaryInsights: string[];
    costAnalysis: CostBreakdown[];
    performanceByCarrier: PerformanceMetrics[];
    volumeReport: {
      totalShipments: number;
      totalWeight: number;
      byCarrier: { carrier: string; count: number; percent: number }[];
      byServiceLevel: { service: string; count: number; percent: number }[];
      byDestinationState: { state: string; count: number; percent: number }[];
      heatMap: { dayOfWeek: number; shipmentCount: number }[];
    };
    anomalies: {
      type: string;
      severity: string;
      description: string;
      deviationPercent: number;
      recommendation: string;
    }[];
  };
  error?: string;
  timestamp: string;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// ─── SHIPPING API HANDLER ──────────────────────────────────────────────────

/**
 * Main shipping API handler
 */
export class ShippingAPIHandler {
  private predictor: DeliveryTimePredictor;
  private selector: SmartCarrierSelector;
  private analytics: ShippingAnalyticsEngine;
  private shipmentHistory: ShipmentRecord[] = [];

  constructor() {
    this.predictor = createDeliveryTimePrediction();
    this.selector = createSmartCarrierSelector();
    this.analytics = createShippingAnalytics();
  }

  /**
   * Handle prediction request
   */
  public async handlePredictDelivery(
    request: PredictDeliveryRequest,
  ): Promise<PredictDeliveryResponse> {
    try {
      const factors: PredictionFactors = {
        carrier: request.carrier as any,
        serviceLevel: request.serviceLevel as any,
        distance: this.estimateDistance(
          request.originZip,
          request.destinationZip,
        ),
        originZip: request.originZip,
        destinationZip: request.destinationZip,
        shipDate: new Date(request.shipDate),
        weight: request.weight,
        weightCategory:
          request.weightCategory || this.classifyWeight(request.weight),
        weatherOrigin: (request.weatherOrigin || "clear") as any,
        weatherDestination: (request.weatherDestination || "clear") as any,
        weatherRoute: (request.weatherRoute || "clear") as any,
        dayOfWeek: new Date(request.shipDate).getDay(),
        isHoliday: request.isHoliday || false,
        isBlackoutDate: request.isBlackoutDate || false,
      };

      const prediction = this.predictor.predict(factors);

      return {
        success: true,
        data: {
          estimatedDays: prediction.estimatedDays,
          estimatedDeliveryDate: prediction.estimatedDeliveryDate.toISOString(),
          confidencePercent: prediction.confidencePercent,
          confidenceInterval: prediction.confidenceInterval,
          factors: prediction.factors,
          reasoning: prediction.reasoning,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Handle carrier recommendation request
   */
  public async handleRecommendCarrier(
    request: RecommendCarrierRequest,
  ): Promise<RecommendCarrierResponse> {
    try {
      const rates: CarrierRate[] = request.rates.map((r) => ({
        carrier: r.carrier as any,
        service: r.service,
        serviceCode: r.serviceCode,
        serviceLevel: r.serviceLevel as any,
        cost: r.cost,
        currency: r.currency,
        estimatedDays: r.estimatedDays,
        estimatedDeliveryDate: new Date(r.estimatedDeliveryDate),
      }));

      const recommendation = this.selector.recommend(
        request.tenantId,
        rates,
        request.originZip,
        request.destinationZip,
        request.deadlineDays,
      );

      return {
        success: true,
        data: {
          recommendedCarrier: recommendation.recommendedCarrier,
          recommendedService: recommendation.recommendedService,
          recommendedServiceCode: recommendation.recommendedServiceCode,
          estimatedCost: recommendation.estimatedCost,
          currency: recommendation.currency,
          estimatedDeliveryDate:
            recommendation.estimatedDeliveryDate.toISOString(),
          estimatedDays: recommendation.estimatedDays,
          score: recommendation.score,
          confidence: recommendation.confidence,
          reasoning: recommendation.reasoning,
          alternatives: recommendation.alternatives,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Handle analytics request
   */
  public async handleGetAnalytics(
    request: AnalyticsRequest,
  ): Promise<AnalyticsResponse> {
    try {
      // Filter shipments by date range
      let filtered = this.shipmentHistory.filter(
        (s) => s.tenantId === request.tenantId,
      );

      if (request.startDate && request.endDate) {
        const start = new Date(request.startDate);
        const end = new Date(request.endDate);
        filtered = filtered.filter(
          (s) => s.shipDate >= start && s.shipDate <= end,
        );
      }

      if (filtered.length === 0) {
        return {
          success: false,
          error: "No shipment data available for the requested period",
          timestamp: new Date().toISOString(),
        };
      }

      // Generate report
      const report = this.analytics.generateReport(
        request.tenantId,
        filtered,
        this.shipmentHistory,
        request.period || "custom",
      );

      return {
        success: true,
        data: {
          period: report.period,
          dataPoints: report.dataPoints,
          summaryInsights: report.summaryInsights,
          costAnalysis: report.costAnalysis,
          performanceByCarrier: report.performanceByCarrier,
          volumeReport: {
            totalShipments: report.volumeReport.totalShipments,
            totalWeight: report.volumeReport.totalWeight,
            byCarrier: report.volumeReport.byCarrier,
            byServiceLevel: report.volumeReport.byServiceLevel,
            byDestinationState: report.volumeReport.byDestinationState,
            heatMap: report.volumeReport.heatMap,
          },
          anomalies: report.anomalies.map((a) => ({
            type: a.type,
            severity: a.severity,
            description: a.description,
            deviationPercent: a.deviationPercent,
            recommendation: a.recommendation,
          })),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Handle feedback submission
   */
  public async handleSubmitFeedback(
    request: SubmitFeedbackRequest,
  ): Promise<SubmitFeedbackResponse> {
    try {
      const outcome: DeliveryOutcome = {
        carrier: request.carrier as any,
        trackingNumber: request.trackingNumber,
        shipDate: new Date(request.shipDate),
        deliveryDate: new Date(request.deliveryDate),
        actualDays: Math.ceil(
          (new Date(request.deliveryDate).getTime() -
            new Date(request.shipDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
        predictedDays: 0, // would be set from prior prediction
        originZip: request.originZip,
        destinationZip: request.destinationZip,
        weight: request.weight,
        serviceLevel: request.serviceLevel as any,
        distance: this.estimateDistance(
          request.originZip,
          request.destinationZip,
        ),
        onTime: request.onTime,
      };

      // Record for model improvement
      this.predictor.recordDelivery(outcome);

      // Track for analytics
      this.shipmentHistory.push({
        trackingNumber: request.trackingNumber,
        carrier: request.carrier as any,
        serviceLevel: request.serviceLevel as any,
        shipDate: new Date(request.shipDate),
        deliveryDate: new Date(request.deliveryDate),
        cost: request.cost,
        weight: request.weight,
        destinationZip: request.destinationZip,
        destinationState: request.destinationZip.substring(0, 2),
        destinationCountry: "US",
        onTime: request.onTime,
        damaged: request.damaged,
        exceptionCount: 0,
        tenantId: request.tenantId,
      });

      return {
        success: true,
        message: "Feedback recorded successfully",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Estimate distance between two zip codes (simplified)
   * In production, would use actual geo lookup
   */
  private estimateDistance(originZip: string, destinationZip: string): number {
    // Rough estimate: state-to-state distance
    // In production, use actual zip code coordinates
    return Math.random() * 2000 + 100; // 100-2100 km estimate
  }

  /**
   * Classify package weight
   */
  private classifyWeight(
    weight: number,
  ): "light" | "medium" | "heavy" | "oversize" {
    if (weight < 5) return "light";
    if (weight < 50) return "medium";
    if (weight < 500) return "heavy";
    return "oversize";
  }

  /**
   * Get analytics engine
   */
  public getAnalyticsEngine(): ShippingAnalyticsEngine {
    return this.analytics;
  }

  /**
   * Get selector for custom scoring
   */
  public getSelector(): SmartCarrierSelector {
    return this.selector;
  }

  /**
   * Get predictor for custom predictions
   */
  public getPredictor(): DeliveryTimePredictor {
    return this.predictor;
  }
}

// ─── FACTORY FUNCTIONS ─────────────────────────────────────────────────────

let globalHandlerInstance: ShippingAPIHandler | null = null;

/**
 * Create new API handler
 */
export function createShippingAPI(): ShippingAPIHandler {
  return new ShippingAPIHandler();
}

/**
 * Get global handler instance
 */
export function getShippingAPI(): ShippingAPIHandler {
  if (!globalHandlerInstance) {
    globalHandlerInstance = new ShippingAPIHandler();
  }
  return globalHandlerInstance;
}
