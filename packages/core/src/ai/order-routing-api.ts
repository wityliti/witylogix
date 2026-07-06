/**
 * Order Routing & Demand Forecasting API
 *
 * REST API endpoint handlers:
 * - POST /api/routing/assign — auto-assign order to fulfillment center
 * - POST /api/routing/evaluate — evaluate all routing options without assigning
 * - GET /api/routing/rules — get routing rules
 * - PUT /api/routing/rules — update routing rules
 * - POST /api/forecast/predict — predict demand for SKU(s)
 * - GET /api/forecast/suggestions — get reorder suggestions
 * - GET /api/forecast/trends — get trend analysis
 */

import type {
  Order,
  Warehouse,
  RoutingDecision,
  WarehouseCandidate,
  FulfillmentRules,
  RoutingOptions,
} from "./intelligent-order-router.js";
import {
  IntelligentOrderRouter,
  createIntelligentOrderRouter,
  type SplitOrder,
} from "./intelligent-order-router.js";

import type {
  SalesDataPoint,
  DemandForecast,
  ReorderSuggestion,
  TrendInfo,
  ExternalFactor,
  SKUCluster,
} from "./demand-forecaster.js";
import {
  DemandForecasterService,
  createDemandForecaster,
} from "./demand-forecaster.js";

// ─── API TYPES ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface RoutingAssignRequest {
  order: Order;
  warehouses: Warehouse[];
  options?: RoutingOptions;
}

export interface RoutingAssignResponse {
  decision: RoutingDecision;
  executionTimeMs: number;
}

export interface RoutingEvaluateRequest {
  order: Order;
  warehouses: Warehouse[];
  options?: RoutingOptions;
}

export interface RoutingEvaluateResponse {
  candidates: WarehouseCandidate[];
  executionTimeMs: number;
}

export interface ForecastPredictRequest {
  skuId: string;
  historicalData: SalesDataPoint[];
  forecastDate?: string; // ISO date string, defaults to today
  externalFactors?: ExternalFactor[];
  daysAhead?: number; // if set, forecast multiple days
}

export interface ForecastPredictResponse {
  forecasts: DemandForecast[];
  executionTimeMs: number;
}

export interface ForecastSuggestionsRequest {
  skuId: string;
  currentStock: number;
  historicalData: SalesDataPoint[];
  leadTimeInDays: number;
}

export interface ForecastSuggestionsResponse {
  suggestion: ReorderSuggestion;
  executionTimeMs: number;
}

export interface ForecastTrendsRequest {
  skuId: string;
  historicalData: SalesDataPoint[];
}

export interface ForecastTrendsResponse {
  trend: TrendInfo;
  executionTimeMs: number;
}

export interface RoutingRulesUpdateRequest {
  rules: FulfillmentRules;
}

// ─── ORDER ROUTING API HANDLER ──────────────────────────────────────────────

export class OrderRoutingAPIHandler {
  private router: IntelligentOrderRouter;
  private forecaster: DemandForecasterService;

  constructor() {
    this.router = createIntelligentOrderRouter();
    this.forecaster = createDemandForecaster();
  }

  /**
   * POST /api/routing/assign
   * Auto-assign order to optimal fulfillment center
   */
  async assignOrder(
    request: RoutingAssignRequest,
  ): Promise<ApiResponse<RoutingAssignResponse>> {
    const startTime = Date.now();

    try {
      const decision = this.router.routeOrder(
        request.order,
        request.warehouses,
        request.options,
      );

      return {
        success: true,
        data: {
          decision,
          executionTimeMs: Date.now() - startTime,
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
   * POST /api/routing/evaluate
   * Evaluate all routing options without assigning
   */
  async evaluateOptions(
    request: RoutingEvaluateRequest,
  ): Promise<ApiResponse<RoutingEvaluateResponse>> {
    const startTime = Date.now();

    try {
      const candidates = this.router.evaluateOptions(
        request.order,
        request.warehouses,
        request.options,
      );

      return {
        success: true,
        data: {
          candidates,
          executionTimeMs: Date.now() - startTime,
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
   * GET /api/routing/rules
   * Get current routing rules
   */
  async getRules(): Promise<ApiResponse<FulfillmentRules>> {
    try {
      const rules = this.router.getRules();

      return {
        success: true,
        data: rules,
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
   * PUT /api/routing/rules
   * Update routing rules
   */
  async updateRules(
    request: RoutingRulesUpdateRequest,
  ): Promise<ApiResponse<FulfillmentRules>> {
    try {
      this.router.setRules(request.rules);
      const rules = this.router.getRules();

      return {
        success: true,
        data: rules,
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
   * POST /api/forecast/predict
   * Predict demand for SKU(s)
   */
  async predictDemand(
    request: ForecastPredictRequest,
  ): Promise<ApiResponse<ForecastPredictResponse>> {
    const startTime = Date.now();

    try {
      const daysAhead = request.daysAhead ?? 1;
      const forecasts = this.forecaster.forecastMultipleDays(
        request.skuId,
        request.historicalData,
        daysAhead,
      );

      // If specific forecast date requested, filter to just that date
      if (request.forecastDate) {
        const targetDate = new Date(request.forecastDate);
        const filtered = forecasts.filter((f) => {
          const fDate = new Date(f.forecastedDate);
          return (
            fDate.getFullYear() === targetDate.getFullYear() &&
            fDate.getMonth() === targetDate.getMonth() &&
            fDate.getDate() === targetDate.getDate()
          );
        });

        return {
          success: true,
          data: {
            forecasts: filtered.length > 0 ? filtered : [forecasts[0]],
            executionTimeMs: Date.now() - startTime,
          },
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: {
          forecasts,
          executionTimeMs: Date.now() - startTime,
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
   * GET /api/forecast/suggestions
   * Get reorder suggestions for SKU
   */
  async getReorderSuggestions(
    request: ForecastSuggestionsRequest,
  ): Promise<ApiResponse<ForecastSuggestionsResponse>> {
    const startTime = Date.now();

    try {
      const suggestion = this.forecaster.getReorderSuggestion(
        request.skuId,
        request.currentStock,
        request.historicalData,
        request.leadTimeInDays,
      );

      return {
        success: true,
        data: {
          suggestion,
          executionTimeMs: Date.now() - startTime,
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
   * GET /api/forecast/trends
   * Get trend analysis for SKU
   */
  async getTrends(
    request: ForecastTrendsRequest,
  ): Promise<ApiResponse<ForecastTrendsResponse>> {
    const startTime = Date.now();

    try {
      const trend = this.forecaster.getTrendAnalysis(
        request.skuId,
        request.historicalData,
      );

      return {
        success: true,
        data: {
          trend,
          executionTimeMs: Date.now() - startTime,
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
   * Initialize capacity tracking for new day
   */
  initializeDayTracking(): void {
    this.router.initializeDay();
  }

  /**
   * Add external factor affecting demand
   */
  addExternalFactor(factor: ExternalFactor): void {
    this.forecaster.addExternalFactor(factor);
  }

  /**
   * Cluster SKUs for analysis
   */
  clusterSKUs(
    skuDataMap: Map<string, SalesDataPoint[]>,
    skuProperties: Map<string, { price: number; category: string }>,
  ): SKUCluster[] {
    return this.forecaster.clusterSKUs(skuDataMap, skuProperties);
  }
}

// ─── SINGLETON INSTANCES ────────────────────────────────────────────────────

let routingAPIHandler: OrderRoutingAPIHandler | null = null;

export function getOrderRoutingAPI(): OrderRoutingAPIHandler {
  if (!routingAPIHandler) {
    routingAPIHandler = new OrderRoutingAPIHandler();
  }
  return routingAPIHandler;
}

export function createOrderRoutingAPI(): OrderRoutingAPIHandler {
  return new OrderRoutingAPIHandler();
}

// ─── EXPORTED HANDLER FUNCTIONS ──────────────────────────────────────────────

/**
 * Handle POST /api/routing/assign request
 */
export async function handleAssignOrder(
  request: RoutingAssignRequest,
): Promise<ApiResponse<RoutingAssignResponse>> {
  return getOrderRoutingAPI().assignOrder(request);
}

/**
 * Handle POST /api/routing/evaluate request
 */
export async function handleEvaluateOptions(
  request: RoutingEvaluateRequest,
): Promise<ApiResponse<RoutingEvaluateResponse>> {
  return getOrderRoutingAPI().evaluateOptions(request);
}

/**
 * Handle GET /api/routing/rules request
 */
export async function handleGetRoutingRules(): Promise<
  ApiResponse<FulfillmentRules>
> {
  return getOrderRoutingAPI().getRules();
}

/**
 * Handle PUT /api/routing/rules request
 */
export async function handleUpdateRoutingRules(
  request: RoutingRulesUpdateRequest,
): Promise<ApiResponse<FulfillmentRules>> {
  return getOrderRoutingAPI().updateRules(request);
}

/**
 * Handle POST /api/forecast/predict request
 */
export async function handlePredictDemand(
  request: ForecastPredictRequest,
): Promise<ApiResponse<ForecastPredictResponse>> {
  return getOrderRoutingAPI().predictDemand(request);
}

/**
 * Handle GET /api/forecast/suggestions request
 */
export async function handleGetReorderSuggestions(
  request: ForecastSuggestionsRequest,
): Promise<ApiResponse<ForecastSuggestionsResponse>> {
  return getOrderRoutingAPI().getReorderSuggestions(request);
}

/**
 * Handle GET /api/forecast/trends request
 */
export async function handleGetTrends(
  request: ForecastTrendsRequest,
): Promise<ApiResponse<ForecastTrendsResponse>> {
  return getOrderRoutingAPI().getTrends(request);
}
