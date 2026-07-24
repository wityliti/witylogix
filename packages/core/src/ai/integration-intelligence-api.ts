/**
 * Integration Intelligence REST API
 *
 * Fastify endpoints for AI-powered integration monitoring:
 * - 12+ REST endpoints with Zod validation
 * - Anomaly detection, remediation, capacity planning, SLA prediction
 * - Real-time monitoring and predictive insights
 */

import { z } from "zod";
import type { FastifyRequest, FastifyReply } from "fastify";
import {
  MultiSignalAnalyzer,
  LatencyAnomalyDetector,
  ErrorPatternRecognizer,
  VolumeAnomalyDetector,
  AnomalyCorrelator,
  type IntegrationMetric,
  type CompositeAnomalyScore,
} from "./integration-anomaly-detector.js";
import {
  RemediationRecommender,
  AutoRemediationEngine,
  RemediationPlaybook,
  IncidentPredictor,
  type RemediationRecommendation,
  type RemediationExecution,
  type RemediationRule,
} from "./integration-auto-remediation.js";
import {
  GrowthProjector,
  ProviderLimitForecaster,
  CostOptimizer,
  CapacityPlanner,
  SLAPredictor,
  type ProviderCapacity,
  type CostMetrics,
  type CapacitySimulation,
  type SLAMetrics,
  type CapacityAlert,
} from "./integration-capacity-planner.js";

// ─── ZOD SCHEMAS ────────────────────────────────────────────────────────────

const MetricInputSchema = z.object({
  providerId: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  errorRate: z.number().min(0).max(1),
  requestCount: z.number().nonnegative(),
  responseSizeBytes: z.number().nonnegative(),
  successCount: z.number().nonnegative(),
  failureCount: z.number().nonnegative(),
  category: z.string().optional(),
});

const AnomalyDetectionRequestSchema = z.object({
  providerId: z.string().min(1),
  metrics: MetricInputSchema.array().min(1),
  category: z.string().optional(),
});

const RemediationExecuteRequestSchema = z.object({
  actionType: z.enum([
    "circuit_break",
    "failover",
    "throttle",
    "retry_config_change",
    "cache_enable",
    "alert_ops",
    "credential_rotate",
    "provider_restart",
  ]),
  providerId: z.string().min(1),
  description: z.string().optional(),
  requiresApproval: z.boolean().default(false),
});

const CapacityForecastRequestSchema = z.object({
  providerId: z.string().min(1),
  days: z.number().int().min(1).max(365).default(30),
  projectionType: z.enum(["linear", "exponential"]).default("linear"),
});

const CostAnalysisRequestSchema = z.object({
  providerId: z.string().min(1).optional(),
  period: z.enum(["daily", "monthly", "yearly"]).default("monthly"),
});

const CapacitySimulationRequestSchema = z.object({
  scenarioName: z.string().min(1),
  additionalAPICallsPercent: z.number().min(0).max(500),
  additionalDataTransferPercent: z.number().min(0).max(500),
  timeframeMonths: z.number().int().min(1).max(36),
});

const SLAPredictionRequestSchema = z.object({
  providerId: z.string().min(1),
  commitmentPercentage: z.number().min(99).max(99.999).default(99.9),
});

const IncidentPredictionRequestSchema = z.object({
  providerId: z.string().min(1),
});

// ─── RESPONSE TYPES ─────────────────────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  requestId?: string;
}

// ─── SINGLETON INSTANCES ────────────────────────────────────────────────────

const analyzer = new MultiSignalAnalyzer();
const latencyDetector = new LatencyAnomalyDetector();
const errorRecognizer = new ErrorPatternRecognizer();
const volumeDetector = new VolumeAnomalyDetector();
const correlator = new AnomalyCorrelator();

const recommender = new RemediationRecommender();
const remediationEngine = new AutoRemediationEngine();
const playbookEngine = new RemediationPlaybook();
const incidentPredictor = new IncidentPredictor();

const growthProjector = new GrowthProjector();
const limitForecaster = new ProviderLimitForecaster();
const costOptimizer = new CostOptimizer();
const capacityPlanner = new CapacityPlanner();
const slaPredictor = new SLAPredictor();

// ─── API HANDLERS ───────────────────────────────────────────────────────────

/**
 * GET /ai/integration/anomalies
 * Get recent anomalies across all providers
 */
export async function handleGetAnomalies(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<CompositeAnomalyScore[]>> {
  try {
    return {
      success: true,
      data: [],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    reply.status(500);
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * GET /ai/integration/anomalies/:providerId
 * Get anomalies for specific provider
 */
export async function handleGetAnomaliesByProvider(
  request: FastifyRequest<{ Params: { providerId: string } }>,
  reply: FastifyReply,
): Promise<ApiResponse<CompositeAnomalyScore>> {
  try {
    const { providerId } = request.params;
    const signals = [
      latencyDetector.detectSpikeAnomalies(providerId),
      errorRecognizer.detectErrorBurst(providerId),
      volumeDetector.detectTrafficDrop(providerId),
    ];

    const score = analyzer.analyzeSignals(signals, providerId);

    return {
      success: true,
      data: score,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    reply.status(500);
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * POST /ai/integration/anomalies/detect
 * Detect anomalies from metrics
 */
export async function handleDetectAnomalies(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<CompositeAnomalyScore>> {
  try {
    const body = AnomalyDetectionRequestSchema.parse(request.body);

    // Record metrics
    for (const metric of body.metrics) {
      const fullMetric: IntegrationMetric = {
        ...metric,
        timestamp: new Date(),
      };
      latencyDetector.addMetric(fullMetric);
      errorRecognizer.recordError(fullMetric);
      volumeDetector.recordVolume(fullMetric);
    }

    // Compute baseline and detect anomalies
    latencyDetector.computeBaseline(body.providerId);
    const signals = [
      latencyDetector.detectSpikeAnomalies(body.providerId),
      latencyDetector.detectSustainedDegradation(body.providerId),
      errorRecognizer.detectErrorBurst(body.providerId),
      errorRecognizer.detectErrorDrift(body.providerId),
      volumeDetector.detectTrafficDrop(body.providerId),
      volumeDetector.detectTrafficSpike(body.providerId),
    ];

    const score = analyzer.analyzeSignals(
      signals,
      body.providerId,
      body.category,
    );

    return {
      success: true,
      data: score,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400);
      return {
        success: false,
        error: "Validation error: " + error.errors[0].message,
        timestamp: new Date().toISOString(),
      };
    }
    reply.status(500);
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * GET /ai/integration/remediation/recommendations
 * Get remediation recommendations
 */
export async function handleGetRemediationRecommendations(
  request: FastifyRequest<{
    Querystring: { providerId: string; anomalyType: string; score: string };
  }>,
  reply: FastifyReply,
): Promise<ApiResponse<RemediationRecommendation>> {
  try {
    const { providerId, anomalyType, score } = request.query;
    const recommendation = recommender.recommend(
      anomalyType,
      parseFloat(score),
      providerId,
    );

    return {
      success: true,
      data: recommendation,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    reply.status(500);
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * POST /ai/integration/remediation/execute
 * Execute remediation action
 */
export async function handleExecuteRemediation(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<RemediationExecution>> {
  try {
    const body = RemediationExecuteRequestSchema.parse(request.body);

    const action = {
      actionId: `action_${Date.now()}`,
      actionType: body.actionType,
      providerId: body.providerId,
      description: body.description || "",
      estimatedEffectiveness: 0.7,
      estimatedImpact: "medium" as const,
      executionTime: 5000,
      isDestructive: ["circuit_break", "provider_restart"].includes(
        body.actionType,
      ),
      rollbackPossible: true,
    };

    const execution = await remediationEngine.executeAction(action);

    return {
      success: execution.status === "success",
      data: execution,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400);
      return {
        success: false,
        error: "Validation error: " + error.errors[0].message,
        timestamp: new Date().toISOString(),
      };
    }
    reply.status(500);
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * GET /ai/integration/remediation/playbooks
 * Get available remediation playbooks
 */
export async function handleGetPlaybooks(
  request: FastifyRequest<{
    Querystring: { anomalyType: string; severity: string };
  }>,
  reply: FastifyReply,
): Promise<ApiResponse<any>> {
  try {
    const { anomalyType, severity } = request.query;
    const playbook = playbookEngine.getPlaybook(anomalyType, severity);

    return {
      success: true,
      data: playbook || { message: "No playbook found" },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    reply.status(500);
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * GET /ai/integration/capacity/forecast
 * Forecast capacity and growth
 */
export async function handleGetCapacityForecast(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<any>> {
  try {
    const query = CapacityForecastRequestSchema.parse(request.query);

    let projection;
    if (query.projectionType === "linear") {
      projection = growthProjector.projectLinearGrowth(
        query.providerId,
        query.days,
      );
    } else {
      projection = growthProjector.projectExponentialGrowth(
        query.providerId,
        query.days,
      );
    }

    return {
      success: true,
      data: projection,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400);
      return {
        success: false,
        error: "Validation error: " + error.errors[0].message,
        timestamp: new Date().toISOString(),
      };
    }
    reply.status(500);
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * GET /ai/integration/capacity/costs
 * Get cost analysis
 */
export async function handleGetCostAnalysis(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<any>> {
  try {
    const query = CostAnalysisRequestSchema.parse(request.query);
    const costs = costOptimizer.analyzeProviderCosts();

    return {
      success: true,
      data: {
        period: query.period,
        providers: costs,
        totalCost: costs.reduce((sum, c) => sum + c.totalCostPerMonth, 0),
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400);
      return {
        success: false,
        error: "Validation error: " + error.errors[0].message,
        timestamp: new Date().toISOString(),
      };
    }
    reply.status(500);
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * GET /ai/integration/capacity/limits
 * Get rate limit forecasts
 */
export async function handleGetLimitForecasts(
  request: FastifyRequest<{ Querystring: { providerId: string } }>,
  reply: FastifyReply,
): Promise<ApiResponse<any>> {
  try {
    const { providerId } = request.query;
    const forecasts = [
      limitForecaster.forecastLimit(providerId, "requests"),
      limitForecaster.forecastLimit(providerId, "data_transfer"),
      limitForecaster.forecastLimit(providerId, "compute"),
    ];

    return {
      success: true,
      data: { providerId, forecasts },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    reply.status(500);
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * GET /ai/integration/sla/predictions
 * Get SLA breach predictions
 */
export async function handleGetSLAPredictions(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<SLAMetrics>> {
  try {
    const query = SLAPredictionRequestSchema.parse(request.query);
    const prediction = slaPredictor.predictSLABreach(
      query.providerId,
      query.commitmentPercentage,
    );

    return {
      success: true,
      data: prediction,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400);
      return {
        success: false,
        error: "Validation error: " + error.errors[0].message,
        timestamp: new Date().toISOString(),
      };
    }
    reply.status(500);
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * POST /ai/integration/capacity/simulate
 * Simulate capacity scenarios
 */
export async function handleSimulateCapacity(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<CapacitySimulation>> {
  try {
    const body = CapacitySimulationRequestSchema.parse(request.body);
    const simulation = capacityPlanner.simulateScenario(body);

    return {
      success: true,
      data: simulation,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400);
      return {
        success: false,
        error: "Validation error: " + error.errors[0].message,
        timestamp: new Date().toISOString(),
      };
    }
    reply.status(500);
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * GET /ai/integration/incidents/predictions
 * Predict probability of incidents
 */
export async function handleGetIncidentPredictions(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<any>> {
  try {
    const query = IncidentPredictionRequestSchema.parse(request.query);
    const prediction = incidentPredictor.predict(query.providerId);

    return {
      success: true,
      data: prediction,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400);
      return {
        success: false,
        error: "Validation error: " + error.errors[0].message,
        timestamp: new Date().toISOString(),
      };
    }
    reply.status(500);
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * GET /ai/integration/health
 * Health check endpoint
 */
export async function handleHealthCheck(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<{ status: string }>> {
  return {
    success: true,
    data: { status: "healthy" },
    timestamp: new Date().toISOString(),
  };
}

/**
 * POST /ai/integration/providers/register
 * Register a provider for monitoring
 */
export async function handleRegisterProvider(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiResponse<{ providerId: string }>> {
  try {
    const body = z
      .object({
        providerId: z.string().min(1),
        category: z.string(),
        rateLimit: z.number().positive(),
        currentTier: z.string(),
      })
      .parse(request.body);

    const capacity: ProviderCapacity = {
      providerId: body.providerId,
      currentUsage: 0,
      rateLimit: body.rateLimit,
      requestsPerSecond: 0,
      dataTransferBytesPerDay: 0,
      computeUnitsPerDay: 0,
      currentTier: body.currentTier,
      upgradeAvailable: true,
    };

    capacityPlanner.registerProvider(capacity);

    return {
      success: true,
      data: { providerId: body.providerId },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400);
      return {
        success: false,
        error: "Validation error: " + error.errors[0].message,
        timestamp: new Date().toISOString(),
      };
    }
    reply.status(500);
    return {
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── EXPORT HANDLER FACTORY ─────────────────────────────────────────────────

export function createIntegrationIntelligenceAPI() {
  return {
    handleGetAnomalies,
    handleGetAnomaliesByProvider,
    handleDetectAnomalies,
    handleGetRemediationRecommendations,
    handleExecuteRemediation,
    handleGetPlaybooks,
    handleGetCapacityForecast,
    handleGetCostAnalysis,
    handleGetLimitForecasts,
    handleGetSLAPredictions,
    handleSimulateCapacity,
    handleGetIncidentPredictions,
    handleHealthCheck,
    handleRegisterProvider,
  };
}
