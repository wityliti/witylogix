/**
 * eSignature + Healthcare + Analytics + Supply Chain Intelligence API
 *
 * Unified REST API exposing all 4 AI intelligence modules:
 * 1. Document Intelligence (eSignature/contracts)
 * 2. Clinical Decision Support (healthcare)
 * 3. Analytics Anomaly Detector (business analytics)
 * 4. Supply Chain Demand Forecaster
 *
 * 16+ REST endpoints covering all critical intelligence needs
 */

import {
  createDocumentIntelligence,
  type DocumentAnalysis,
  type VersionComparisonResult,
} from './document-intelligence.js';

import {
  createClinicalDecisionSupport,
  type DrugInteraction,
  type AllergyAlert,
  type LabResult,
  type DiagnosisSuggestion,
  type RiskScore,
} from './clinical-decision-support.js';

import {
  createAnomalyDetector,
  type TimeSeriesDataPoint,
  type Anomaly,
  type Forecast,
  type Alert,
  type RootCauseAnalysis,
} from './analytics-anomaly-detector.js';

import {
  createSupplyChainOptimizer,
  type DemandForecast,
  type SupplyRiskScore,
  type InventoryOptimization,
  type FulfillmentPlan,
  type NetworkOptimization,
} from './supply-chain-demand-forecaster.js';

// ─── API TYPES ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  executionTimeMs: number;
}

// DOCUMENT INTELLIGENCE API

export interface AnalyzeDocumentRequest {
  documentId?: string;
  content: string;
}

export interface AnalyzeDocumentResponse {
  analysis: DocumentAnalysis;
  executionTimeMs: number;
}

export interface CompareDocumentVersionsRequest {
  documentId: string;
  previousContent: string;
  currentContent: string;
}

export interface CompareDocumentVersionsResponse {
  comparison: VersionComparisonResult;
  executionTimeMs: number;
}

// CLINICAL DECISION SUPPORT API

export interface CheckDrugInteractionRequest {
  medications: string[];
}

export interface CheckDrugInteractionResponse {
  interactions: DrugInteraction[];
  safetyScore: number; // 0-100
  recommendations: string[];
}

export interface CheckAllergyConflictRequest {
  allergies: string[];
  proposedMedications: string[];
}

export interface CheckAllergyConflictResponse {
  alerts: AllergyAlert[];
  isSafe: boolean;
  recommendations: string[];
}

export interface InterpretLabResultRequest {
  testName: string;
  value: number;
  unit: string;
  ageYears?: number;
  isMale?: boolean;
}

export interface InterpretLabResultResponse {
  result: LabResult;
  normalRange: { min: number; max: number };
  interpretation: string;
  recommendations: string[];
}

export interface GetDiagnosisRequest {
  symptoms: string[];
  ageYears?: number;
  isMale?: boolean;
}

export interface GetDiagnosisResponse {
  diagnoses: DiagnosisSuggestion[];
  topDifferential: DiagnosisSuggestion | null;
  redFlags: string[];
  nextSteps: string[];
}

export interface CalculateRiskScoreRequest {
  scoreType: 'framingham' | 'ascvd' | 'wells_pe' | 'chads2vasc';
  parameters: Record<string, any>;
}

export interface CalculateRiskScoreResponse {
  score: RiskScore;
  interpretation: string;
  recommendations: string[];
}

// ANALYTICS ANOMALY DETECTOR API

export interface AnalyzeMetricRequest {
  metricName: string;
  timeSeries: Array<{ timestamp: string; value: number }>;
}

export interface AnalyzeMetricResponse {
  anomalies: Anomaly[];
  forecasts: Forecast[];
  alerts: Alert[];
  trend: string;
  seasonality: { detected: boolean; period: number };
  executionTimeMs: number;
}

export interface GetAnomaliesRequest {
  metricName: string;
  timeSeries: Array<{ timestamp: string; value: number }>;
  method?: 'zscore' | 'iqr' | 'isolation';
}

export interface GetAnomaliesResponse {
  anomalies: Anomaly[];
  anomalyCount: number;
  highSeverityCount: number;
}

export interface GetForecastRequest {
  metricName: string;
  timeSeries: Array<{ timestamp: string; value: number }>;
  daysAhead?: number;
}

export interface GetForecastResponse {
  forecasts: Forecast[];
  nextValue: number;
  confidenceInterval: { lower: number; upper: number };
}

export interface GetRootCauseRequest {
  metricName: string;
  anomalies: Anomaly[];
  dimensionalData?: Record<string, Array<{ timestamp: string; value: number }>>;
}

export interface GetRootCauseResponse {
  analysis: RootCauseAnalysis;
  primaryCause: string;
  contributionFactors: Array<{ factor: string; contribution: number }>;
}

// SUPPLY CHAIN API

export interface ForecastDemandRequest {
  skuId: string;
  historicalMonthlyDemand: number[];
  promotionFactor?: number;
  externalFactors?: string[];
}

export interface ForecastDemandResponse {
  forecast: DemandForecast;
  confidenceLevel: number;
  recommendations: string[];
}

export interface ScoreSupplierRiskRequest {
  supplierId: string;
  onTimeDeliveryRate: number;
  leadTimeAvgDays: number;
  leadTimeStdDevDays: number;
  geopoliticalRisk: number;
  isSingleSource: boolean;
  creditScore: number;
  yearsInBusiness: number;
}

export interface ScoreSupplierRiskResponse {
  riskScore: SupplyRiskScore;
  riskLevel: string;
  recommendations: string[];
}

export interface OptimizeInventoryRequest {
  skuId: string;
  annualDemandUnits: number;
  unitCost: number;
  holdingCostPercentage: number;
  orderingCostPerOrder: number;
  leadTimeDays: number;
  leadTimeStdDevDays: number;
  targetServiceLevel: number;
}

export interface OptimizeInventoryResponse {
  optimization: InventoryOptimization;
  annualCostSavings?: number;
  recommendations: string[];
}

export interface PlanFulfillmentRequest {
  orderId: string;
  itemQuantity: number;
  destinationZipCode: string;
  warehouses: Array<{
    warehouseId: string;
    available: number;
    location: string;
    costPerUnit: number;
    daysToDeliver: number;
  }>;
}

export interface PlanFulfillmentResponse {
  plan: FulfillmentPlan;
  totalCost: number;
  deliveryDate: string;
}

export interface AnalyzeNetworkRequest {
  warehouses: Array<{
    warehouseId: string;
    latitude: number;
    longitude: number;
    capacity: number;
    currentInventory: number;
    averageShippingCost: number;
  }>;
  shipmentHistory?: Array<{
    origin: string;
    daysToDeliver: number;
    zipCodePattern: string;
  }>;
}

export interface AnalyzeNetworkResponse {
  analysis: NetworkOptimization;
  recommendations: string[];
  warehouseScores: Array<{
    warehouseId: string;
    score: number;
    issues: string[];
  }>;
}

// ─── API HANDLER CLASS ──────────────────────────────────────────────────────

export class IntelligenceAPIHandler {
  private docIntelligence = createDocumentIntelligence();
  private clinicalSupport = createClinicalDecisionSupport();
  private anomalyDetector = createAnomalyDetector();
  private supplyChainOptimizer = createSupplyChainOptimizer();

  // ─── DOCUMENT INTELLIGENCE ENDPOINTS ─────────────────────────────────────

  /**
   * POST /api/intelligence/document/analyze
   * Analyze a document for classification, risk, completeness
   */
  async analyzeDocument(req: AnalyzeDocumentRequest): Promise<ApiResponse<AnalyzeDocumentResponse>> {
    const startTime = Date.now();

    try {
      const analysis = this.docIntelligence.analyzeDocument(req.content);

      return {
        success: true,
        data: {
          analysis,
          executionTimeMs: Date.now() - startTime,
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Document analysis failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * POST /api/intelligence/document/compare-versions
   * Compare two document versions and identify risk delta
   */
  async compareDocumentVersions(
    req: CompareDocumentVersionsRequest
  ): Promise<ApiResponse<CompareDocumentVersionsResponse>> {
    const startTime = Date.now();

    try {
      const comparison = this.docIntelligence.compareVersions(req.previousContent, req.currentContent);

      return {
        success: true,
        data: {
          comparison,
          executionTimeMs: Date.now() - startTime,
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Version comparison failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  // ─── CLINICAL DECISION SUPPORT ENDPOINTS ──────────────────────────────────

  /**
   * POST /api/intelligence/clinical/drug-interactions
   * Check for drug-drug interactions
   */
  async checkDrugInteractions(
    req: CheckDrugInteractionRequest
  ): Promise<ApiResponse<CheckDrugInteractionResponse>> {
    const startTime = Date.now();

    try {
      const interactions = this.clinicalSupport.checkDrugSafety(req.medications);
      const safetyScore = 100 - Math.min(100, interactions.length * 25);

      const recommendations = interactions.map((i) => i.managementStrategy);

      return {
        success: true,
        data: {
          interactions,
          safetyScore,
          recommendations,
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Drug interaction check failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * POST /api/intelligence/clinical/allergy-check
   * Check for allergy conflicts with proposed medications
   */
  async checkAllergyConflicts(
    req: CheckAllergyConflictRequest
  ): Promise<ApiResponse<CheckAllergyConflictResponse>> {
    const startTime = Date.now();

    try {
      const alerts = this.clinicalSupport.checkAllergyConflicts(req.allergies, req.proposedMedications);
      const isSafe = alerts.every((a) => a.severity !== 'anaphylaxis');

      const recommendations = alerts.map((a) => `Avoid ${a.allergen}: ${a.manifestations.join(', ')}`);

      return {
        success: true,
        data: {
          alerts,
          isSafe,
          recommendations,
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Allergy check failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * POST /api/intelligence/clinical/lab-interpret
   * Interpret a lab result with reference ranges
   */
  async interpretLabResult(
    req: InterpretLabResultRequest
  ): Promise<ApiResponse<InterpretLabResultResponse>> {
    const startTime = Date.now();

    try {
      const result = this.clinicalSupport.labInterpreter.interpretLab(
        req.testName,
        req.value,
        req.unit,
        req.ageYears,
        req.isMale
      );

      const recommendations: string[] = [];
      if (result.flag === 'H') {
        recommendations.push(`${req.testName} is elevated. Monitor and investigate cause.`);
      } else if (result.flag === 'L') {
        recommendations.push(`${req.testName} is low. Consider supplementation.`);
      }

      return {
        success: true,
        data: {
          result,
          normalRange: {
            min: result.refRangeMin || 0,
            max: result.refRangeMax || 1000,
          },
          interpretation: result.interpretation,
          recommendations,
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Lab interpretation failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * POST /api/intelligence/clinical/diagnoses
   * Get differential diagnosis suggestions
   */
  async getDiagnoses(req: GetDiagnosisRequest): Promise<ApiResponse<GetDiagnosisResponse>> {
    const startTime = Date.now();

    try {
      const diagnoses = this.clinicalSupport.diagnosisSuggester.suggestDiagnoses(req.symptoms);
      const topDifferential = diagnoses[0] || null;

      const redFlags = new Set<string>();
      diagnoses.slice(0, 3).forEach((d) => d.redFlags.forEach((rf) => redFlags.add(rf)));

      const nextSteps = new Set<string>();
      diagnoses.slice(0, 3).forEach((d) => d.nextSteps.forEach((ns) => nextSteps.add(ns)));

      return {
        success: true,
        data: {
          diagnoses,
          topDifferential,
          redFlags: Array.from(redFlags),
          nextSteps: Array.from(nextSteps),
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Diagnosis suggestion failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * POST /api/intelligence/clinical/risk-score
   * Calculate clinical risk scores (Framingham, ASCVD, Wells, CHADS2-VASc)
   */
  async calculateRiskScore(
    req: CalculateRiskScoreRequest
  ): Promise<ApiResponse<CalculateRiskScoreResponse>> {
    const startTime = Date.now();

    try {
      const p = req.parameters;
      let score: RiskScore;

      switch (req.scoreType) {
        case 'framingham':
          score = this.clinicalSupport.riskStratifier.calculateFraminghamRisk(
            p.age, p.isMale, p.ldl, p.hdl, p.sbp, p.smoker, p.diabetic
          );
          break;
        case 'ascvd':
          score = this.clinicalSupport.riskStratifier.calculateASCVDRisk(
            p.age, p.isMale, p.race, p.tc, p.ldl, p.hdl, p.sbp, p.treated, p.smoker, p.diabetic
          );
          break;
        case 'wells_pe':
          score = this.clinicalSupport.riskStratifier.calculateWellsPEScore(
            p.clinicalSuspicion, p.hr, p.respiratoryRate, p.o2Sat, p.dvtSigns, p.heartFailure, p.hvitPattern
          );
          break;
        case 'chads2vasc':
          score = this.clinicalSupport.riskStratifier.calculateCHADS2VASc(
            p.age, p.chf, p.hypertension, p.stroke, p.vte, p.bleeding, p.isMale, p.vascular
          );
          break;
        default:
          throw new Error('Unknown score type');
      }

      const recommendations = [
        `${score.riskCategory.toUpperCase()} RISK: ${score.interpretation}`,
      ];

      return {
        success: true,
        data: {
          score,
          interpretation: score.interpretation,
          recommendations,
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Risk score calculation failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  // ─── ANALYTICS ANOMALY DETECTOR ENDPOINTS ────────────────────────────────

  /**
   * POST /api/intelligence/analytics/analyze-metric
   * Comprehensive metric analysis (trend, anomalies, forecasts, alerts)
   */
  async analyzeMetric(req: AnalyzeMetricRequest): Promise<ApiResponse<AnalyzeMetricResponse>> {
    const startTime = Date.now();

    try {
      const data: TimeSeriesDataPoint[] = req.timeSeries.map((point) => ({
        timestamp: new Date(point.timestamp),
        value: point.value,
      }));

      const result = this.anomalyDetector.analyzeMetric(data);

      return {
        success: true,
        data: {
          anomalies: result.anomalies,
          forecasts: result.forecasts,
          alerts: result.alerts,
          trend: result.trend.direction,
          seasonality: {
            detected: result.seasonality.hasSeasonality,
            period: result.seasonality.period,
          },
          executionTimeMs: Date.now() - startTime,
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Metric analysis failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * POST /api/intelligence/analytics/anomalies
   * Detect anomalies using specified method
   */
  async getAnomalies(req: GetAnomaliesRequest): Promise<ApiResponse<GetAnomaliesResponse>> {
    const startTime = Date.now();

    try {
      const data: TimeSeriesDataPoint[] = req.timeSeries.map((point) => ({
        timestamp: new Date(point.timestamp),
        value: point.value,
      }));

      const anomalies = this.anomalyDetector.detector.detectAnomalies(
        data,
        req.method || 'zscore'
      );

      const highSeverity = anomalies.filter((a) => a.severity === 'high').length;

      return {
        success: true,
        data: {
          anomalies,
          anomalyCount: anomalies.length,
          highSeverityCount: highSeverity,
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Anomaly detection failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * POST /api/intelligence/analytics/forecast
   * Generate time series forecasts
   */
  async getForecast(req: GetForecastRequest): Promise<ApiResponse<GetForecastResponse>> {
    const startTime = Date.now();

    try {
      const data: TimeSeriesDataPoint[] = req.timeSeries.map((point) => ({
        timestamp: new Date(point.timestamp),
        value: point.value,
      }));

      const forecasts = this.anomalyDetector.forecastEngine.forecast(
        data,
        req.daysAhead || 7
      );

      const nextValue = forecasts[0]?.predictedValue || 0;

      return {
        success: true,
        data: {
          forecasts,
          nextValue,
          confidenceInterval: forecasts[0]?.confidenceInterval || { lower: 0, upper: 0 },
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Forecast generation failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * POST /api/intelligence/analytics/root-cause
   * Analyze root cause of anomalies
   */
  async getRootCause(req: GetRootCauseRequest): Promise<ApiResponse<GetRootCauseResponse>> {
    const startTime = Date.now();

    try {
      const dimensionalData: Record<string, TimeSeriesDataPoint[]> = {};

      if (req.dimensionalData) {
        Object.entries(req.dimensionalData).forEach(([key, data]) => {
          dimensionalData[key] = data.map((d: any) => ({
            timestamp: new Date(d.timestamp),
            value: d.value,
          }));
        });
      }

      const analysis = this.anomalyDetector.rootCauseAnalyzer.analyze(
        req.anomalies,
        dimensionalData
      );

      return {
        success: true,
        data: {
          analysis,
          primaryCause: analysis.primaryCause,
          contributionFactors: analysis.contributionFactors,
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Root cause analysis failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  // ─── SUPPLY CHAIN OPTIMIZATION ENDPOINTS ──────────────────────────────────

  /**
   * POST /api/intelligence/supply-chain/forecast-demand
   * Forecast demand using Holt-Winters
   */
  async forecastDemand(req: ForecastDemandRequest): Promise<ApiResponse<ForecastDemandResponse>> {
    const startTime = Date.now();

    try {
      const forecast = this.supplyChainOptimizer.forecaster.forecastDemand(
        req.skuId,
        req.historicalMonthlyDemand,
        undefined,
        req.promotionFactor,
        req.externalFactors
      );

      const recommendations = [
        `Forecast: ${forecast.forecastedQuantity} units (${forecast.confidence * 100}% confidence)`,
        `Range: ${forecast.confidenceInterval.lower}-${forecast.confidenceInterval.upper}`,
      ];

      return {
        success: true,
        data: {
          forecast,
          confidenceLevel: forecast.confidence,
          recommendations,
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Demand forecast failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * POST /api/intelligence/supply-chain/supplier-risk
   * Score supplier risk across multiple dimensions
   */
  async scoreSupplierRisk(
    req: ScoreSupplierRiskRequest
  ): Promise<ApiResponse<ScoreSupplierRiskResponse>> {
    const startTime = Date.now();

    try {
      const riskScore = this.supplyChainOptimizer.riskScorer.scoreSupplier(
        req.supplierId,
        req.onTimeDeliveryRate,
        req.leadTimeAvgDays,
        req.leadTimeStdDevDays,
        req.geopoliticalRisk,
        req.isSingleSource,
        req.creditScore,
        req.yearsInBusiness
      );

      return {
        success: true,
        data: {
          riskScore,
          riskLevel: riskScore.riskCategory,
          recommendations: riskScore.recommendations,
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Supplier risk scoring failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * POST /api/intelligence/supply-chain/inventory-optimize
   * Optimize inventory levels for service target
   */
  async optimizeInventory(
    req: OptimizeInventoryRequest
  ): Promise<ApiResponse<OptimizeInventoryResponse>> {
    const startTime = Date.now();

    try {
      const optimization = this.supplyChainOptimizer.inventoryOptimizer.optimizeInventory(
        req.skuId,
        req.annualDemandUnits,
        req.unitCost,
        req.holdingCostPercentage,
        req.orderingCostPerOrder,
        req.leadTimeDays,
        req.leadTimeStdDevDays,
        req.targetServiceLevel
      );

      const recommendations = [
        `Reorder at ${optimization.reorderPoint} units`,
        `Safety stock: ${optimization.safetyStock} units`,
        `Order quantity: ${optimization.economicOrderQuantity} units`,
        `Annual cost: $${optimization.totalAnnualCost.toLocaleString()}`,
      ];

      return {
        success: true,
        data: {
          optimization,
          recommendations,
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Inventory optimization failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * POST /api/intelligence/supply-chain/fulfillment-plan
   * Plan order fulfillment across warehouse network
   */
  async planFulfillment(req: PlanFulfillmentRequest): Promise<ApiResponse<PlanFulfillmentResponse>> {
    const startTime = Date.now();

    try {
      const plan = this.supplyChainOptimizer.fulfillmentPlanner.planFulfillment(
        req.orderId,
        req.itemQuantity,
        req.destinationZipCode,
        req.warehouses
      );

      return {
        success: true,
        data: {
          plan,
          totalCost: plan.totalShippingCost,
          deliveryDate: plan.estimatedDeliveryDate.toISOString(),
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fulfillment planning failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * POST /api/intelligence/supply-chain/network-analyze
   * Analyze warehouse network efficiency and optimization
   */
  async analyzeNetwork(req: AnalyzeNetworkRequest): Promise<ApiResponse<AnalyzeNetworkResponse>> {
    const startTime = Date.now();

    try {
      const analysis = this.supplyChainOptimizer.networkAnalyzer.analyzeNetwork(
        req.warehouses,
        req.shipmentHistory || []
      );

      const warehouseScores = analysis.warehouseScores.map((w) => ({
        warehouseId: w.warehouseId,
        score: Math.round(w.coverage * 100),
        issues: [
          w.capacityUtilization > 0.9 ? 'High utilization' : '',
          w.deliveryDaysTo95thPercentile > 3 ? 'Slow delivery' : '',
        ].filter(Boolean),
      }));

      return {
        success: true,
        data: {
          analysis,
          recommendations: analysis.recommendations,
          warehouseScores,
        },
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network analysis failed',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}

// ─── SINGLETON HANDLER ──────────────────────────────────────────────────────

let apiHandlerInstance: IntelligenceAPIHandler | null = null;

export function getIntelligenceAPI(): IntelligenceAPIHandler {
  if (!apiHandlerInstance) {
    apiHandlerInstance = new IntelligenceAPIHandler();
  }
  return apiHandlerInstance;
}

export function createIntelligenceAPI(): IntelligenceAPIHandler {
  return new IntelligenceAPIHandler();
}
