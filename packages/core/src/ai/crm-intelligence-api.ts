/**
 * CRM Intelligence REST API
 *
 * API endpoints for:
 * - Customer Lifetime Value prediction and segmentation
 * - CRM deal and lead scoring
 * - Sales forecasting and activity recommendations
 * - Churn prediction and relationship analysis
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import {
  createCustomerLTVPredictor,
  type CustomerContact,
  type OrderData,
  type PaymentData,
  type CustomerActivity,
  type LTVPrediction,
  type ChurnRisk,
} from "./customer-ltv-predictor.js";
import {
  createCRMIntelligence,
  type Deal,
  type Lead,
  type Contact,
  type DealScore,
  type LeadScore,
  type ActivityRecommendation,
  type SalesForecast,
} from "./crm-intelligence.js";

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface LTVPredictRequest {
  customerId: string;
  contact: CustomerContact;
  orders: OrderData[];
  payments: PaymentData[];
  activities: CustomerActivity[];
}

export interface LTVSegmentsResponse {
  segments: {
    segment: string;
    count: number;
    averageLTV: number;
    retention: number;
  }[];
  total: number;
}

export interface CohortsResponse {
  cohorts: Array<{
    month: string;
    size: number;
    averageLTV: number;
    retentionRate: number;
  }>;
}

export interface DealScoringRequest {
  deal: Deal;
}

export interface LeadScoringRequest {
  lead: Lead;
}

export interface RecommendationRequest {
  contact: Contact;
  deal?: Deal;
}

export interface ForecastRequest {
  deals: Deal[];
  period: string; // YYYY-MM or YYYY-Q
}

export interface ChurnRiskRequest {
  customerId: string;
  contact: CustomerContact;
  orders: OrderData[];
  activities: CustomerActivity[];
}

// ─── SERVICE INITIALIZATION ────────────────────────────────────────────────

const ltv = createCustomerLTVPredictor();
const crm = createCRMIntelligence();

// ─── LTV PREDICTION ENDPOINTS ──────────────────────────────────────────────

/**
 * POST /api/ai/ltv/predict
 * Predict customer lifetime value
 *
 * @example
 * POST /api/ai/ltv/predict
 * {
 *   "customerId": "cust_123",
 *   "contact": { ... },
 *   "orders": [ ... ],
 *   "payments": [ ... ],
 *   "activities": [ ... ]
 * }
 *
 * Response: LTVPrediction
 */
export async function handleLTVPredict(
  request: FastifyRequest<{ Body: LTVPredictRequest }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { customerId, contact, orders, payments, activities } = request.body;

    // Fuse customer data
    const fusedData = ltv.dataFuser.fuseCustomerData(
      contact,
      orders,
      payments,
      activities,
    );

    // Predict LTV
    const prediction = ltv.ltvPredictor.predictLTV({
      customerId,
      acquisitionDate: fusedData.acquisitionDate,
      completedOrders: fusedData.completedOrders,
      activities: fusedData.recentActivities,
    });

    const response: ApiResponse<LTVPrediction> = {
      success: true,
      data: prediction,
      timestamp: new Date().toISOString(),
    };

    reply.send(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };

    reply.status(400).send(response);
  }
}

/**
 * GET /api/ai/ltv/segments
 * Get customer segments with counts
 */
export async function handleGetSegments(
  request: FastifyRequest<{ Querystring: { period?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    // In real implementation, would fetch customers from database
    // For now return mock data structure
    const segments = [
      { segment: "CHAMPION", count: 45, averageLTV: 12500, retention: 0.95 },
      { segment: "LOYAL", count: 120, averageLTV: 8200, retention: 0.85 },
      { segment: "POTENTIAL", count: 200, averageLTV: 3500, retention: 0.65 },
      { segment: "NEW", count: 85, averageLTV: 1200, retention: 0.5 },
      { segment: "AT_RISK", count: 35, averageLTV: 4800, retention: 0.25 },
      { segment: "HIBERNATING", count: 60, averageLTV: 5200, retention: 0.1 },
      { segment: "LOST", count: 25, averageLTV: 0, retention: 0 },
    ];

    const response: ApiResponse<LTVSegmentsResponse> = {
      success: true,
      data: {
        segments,
        total: segments.reduce((sum, s) => sum + s.count, 0),
      },
      timestamp: new Date().toISOString(),
    };

    reply.send(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };

    reply.status(400).send(response);
  }
}

/**
 * GET /api/ai/ltv/cohorts
 * Get cohort analysis
 */
export async function handleGetCohorts(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    // In real implementation, would fetch customers and analyze cohorts
    // For now return mock data
    const cohorts = [
      { month: "2026-Q1", size: 150, averageLTV: 6500, retentionRate: 0.72 },
      { month: "2026-Q2", size: 200, averageLTV: 8200, retentionRate: 0.78 },
      { month: "2026-Q3", size: 180, averageLTV: 7900, retentionRate: 0.75 },
      { month: "2026-Q4", size: 160, averageLTV: 6800, retentionRate: 0.68 },
    ];

    const response: ApiResponse<CohortsResponse> = {
      success: true,
      data: { cohorts },
      timestamp: new Date().toISOString(),
    };

    reply.send(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };

    reply.status(400).send(response);
  }
}

// ─── CRM INTELLIGENCE ENDPOINTS ────────────────────────────────────────────

/**
 * POST /api/ai/crm/score-deal
 * Score a sales deal
 *
 * @example
 * POST /api/ai/crm/score-deal
 * {
 *   "deal": { ... }
 * }
 *
 * Response: DealScore
 */
export async function handleScoreDeal(
  request: FastifyRequest<{ Body: DealScoringRequest }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { deal } = request.body;

    const score = crm.dealScorer.scoreDeal(deal);

    const response: ApiResponse<DealScore> = {
      success: true,
      data: score,
      timestamp: new Date().toISOString(),
    };

    reply.send(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };

    reply.status(400).send(response);
  }
}

/**
 * POST /api/ai/crm/score-lead
 * Score an inbound lead
 *
 * @example
 * POST /api/ai/crm/score-lead
 * {
 *   "lead": { ... }
 * }
 *
 * Response: LeadScore
 */
export async function handleScoreLead(
  request: FastifyRequest<{ Body: LeadScoringRequest }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { lead } = request.body;

    const score = crm.leadScorer.scoreLead(lead);

    const response: ApiResponse<LeadScore> = {
      success: true,
      data: score,
      timestamp: new Date().toISOString(),
    };

    reply.send(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };

    reply.status(400).send(response);
  }
}

/**
 * GET /api/ai/crm/recommendations/:contactId
 * Get next best action recommendations for a contact
 */
export async function handleGetRecommendations(
  request: FastifyRequest<{
    Params: { contactId: string };
    Body: { contact: Contact; deal?: Deal };
  }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { contact, deal } = request.body;

    const recommendation = crm.activityRecommender.recommendActivity(
      contact,
      deal,
    );

    const response: ApiResponse<ActivityRecommendation> = {
      success: true,
      data: recommendation,
      timestamp: new Date().toISOString(),
    };

    reply.send(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };

    reply.status(400).send(response);
  }
}

/**
 * GET /api/ai/crm/forecast
 * Get sales forecast for pipeline
 */
export async function handleGetForecast(
  request: FastifyRequest<{ Body: ForecastRequest }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { deals, period } = request.body;

    const forecast = crm.salesForecaster.forecastRevenue(deals, period);

    const response: ApiResponse<SalesForecast> = {
      success: true,
      data: forecast,
      timestamp: new Date().toISOString(),
    };

    reply.send(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };

    reply.status(400).send(response);
  }
}

/**
 * POST /api/ai/crm/churn-risk
 * Predict customer churn risk
 *
 * @example
 * POST /api/ai/crm/churn-risk
 * {
 *   "customerId": "cust_123",
 *   "contact": { ... },
 *   "orders": [ ... ],
 *   "activities": [ ... ]
 * }
 *
 * Response: ChurnRisk
 */
export async function handleChurnRisk(
  request: FastifyRequest<{ Body: ChurnRiskRequest }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { customerId, contact, orders, activities } = request.body;

    // Fuse customer data
    const fusedData = ltv.dataFuser.fuseCustomerData(
      contact,
      orders,
      [],
      activities,
    );

    // Extract features
    const rfm = ltv.featureExtractor.extractRFM(
      fusedData.acquisitionDate,
      fusedData.completedOrders,
      fusedData.recentActivities,
    );

    // Predict LTV
    const ltvPrediction = ltv.ltvPredictor.predictLTV({
      customerId,
      acquisitionDate: fusedData.acquisitionDate,
      completedOrders: fusedData.completedOrders,
      activities: fusedData.recentActivities,
    });

    // Predict churn risk
    const churnRisk = ltv.churnPredictor.predictChurnRisk(ltvPrediction, rfm);

    const response: ApiResponse<ChurnRisk> = {
      success: true,
      data: churnRisk,
      timestamp: new Date().toISOString(),
    };

    reply.send(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };

    reply.status(400).send(response);
  }
}

// ─── HANDLER FACTORY ──────────────────────────────────────────────────────

/**
 * Create API handlers for CRM intelligence
 *
 * @example
 * const handlers = createCRMIntelligenceAPI();
 * fastify.post('/api/ai/ltv/predict', handlers.handleLTVPredict);
 * fastify.post('/api/ai/crm/score-deal', handlers.handleScoreDeal);
 */
export function createCRMIntelligenceAPI() {
  return {
    handleLTVPredict,
    handleGetSegments,
    handleGetCohorts,
    handleScoreDeal,
    handleScoreLead,
    handleGetRecommendations,
    handleGetForecast,
    handleChurnRisk,
  };
}
