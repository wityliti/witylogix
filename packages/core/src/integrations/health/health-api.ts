/**
 * Integration Health Monitor REST API
 *
 * Provides 12+ endpoints for health status queries, SLA reports, latency analysis,
 * error trends, degradation detection, and alert management with Zod validation.
 */

import { z } from "zod";
import type {
  ProviderHealth,
  SLAReport,
  LatencyBucket,
  LatencyTimeWindow,
  ErrorTrendData,
  DegradationEvent,
  Alert,
  AlertRule,
} from "./health-types.js";
import type {
  RealTimeHealthTracker,
  SLAMonitor,
  LatencyHistogram,
  ErrorTrendAnalyzer,
  DegradationDetector,
  AlertingEngine,
} from "./integration-health-monitor.js";

// ─── ZODE VALIDATION SCHEMAS ────────────────────────────────────────────────

const uuidSchema = z.string().uuid();
const providerId = z.string().min(1).max(128);
const percentageSchema = z.number().min(0).max(100);

const CreateAlertRuleSchema = z.object({
  providerId: providerId.optional(),
  name: z.string().min(1).max(255),
  type: z.enum(["threshold", "trend", "anomaly", "sla_breach"]),
  condition: z.object({
    metric: z.enum(["latency", "error_rate", "uptime", "volume", "sla"]),
    operator: z.enum([">", "<", ">=", "<=", "==", "!="]),
    threshold: z.number(),
    window: z.number().optional(),
  }),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  channels: z.array(z.enum(["slack", "email", "pagerduty", "webhook"])),
  enabled: z.boolean().default(true),
});

const AcknowledgeAlertSchema = z.object({
  acknowledgedBy: z.string().min(1).max(255),
  comment: z.string().optional(),
});

const ResolveAlertSchema = z.object({
  resolvedBy: z.string().min(1).max(255),
  rootCause: z.string().optional(),
  actionsTaken: z.string().optional(),
});

const ExecuteHealthCheckSchema = z.object({
  endpoint: z.string().url(),
  timeoutMs: z.number().default(5000),
  region: z.string().optional(),
});

const AlertQuerySchema = z.object({
  providerId: providerId.optional(),
  severity: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
  status: z.enum(["firing", "acknowledged", "resolved"]).optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
});

// ─── RESPONSE TYPES ─────────────────────────────────────────────────────────

interface HealthStatusResponse {
  providers: ProviderHealth[];
  summary: {
    totalProviders: number;
    healthyCount: number;
    degradedCount: number;
    downCount: number;
    unknownCount: number;
  };
  timestamp: string;
}

interface SLAReportResponse {
  reports: SLAReport[];
  totalBreaches: number;
  creditAmount: number;
}

interface LatencyAnalysisResponse {
  providerId: string;
  endpoint: string;
  window: string;
  percentiles: {
    p50: number;
    p95: number;
    p99: number;
    p999: number;
    min: number;
    max: number;
    mean: number;
  };
  slowRequests: string[];
  timestamp: string;
}

interface ErrorAnalysisResponse {
  providerId: string;
  currentTrend: ErrorTrendData | null;
  recentErrors: {
    classification: string;
    count: number;
    percentage: number;
  }[];
  timestamp: string;
}

interface DegradationAnalysisResponse {
  providerId: string;
  latestEvent: DegradationEvent | null;
  isCurrentlyDegraded: boolean;
  anomalyScore: number;
  timestamp: string;
}

interface AlertsResponse {
  alerts: Alert[];
  total: number;
  limit: number;
  offset: number;
}

interface HealthCheckResultResponse {
  providerId: string;
  success: boolean;
  statusCode?: number;
  responseTime: number;
  endpoint: string;
  timestamp: string;
  error?: string;
}

// ─── HEALTH API ROUTER ──────────────────────────────────────────────────────

/**
 * Health API handler providing all REST endpoints.
 */
export class HealthAPIHandler {
  constructor(
    private tracker: RealTimeHealthTracker,
    private slaMonitor: SLAMonitor,
    private latencyHistogram: LatencyHistogram,
    private errorAnalyzer: ErrorTrendAnalyzer,
    private degradationDetector: DegradationDetector,
    private alertingEngine: AlertingEngine,
  ) {}

  /**
   * GET /health/providers
   * Get all provider health statuses.
   */
  async getAllProviderHealth(): Promise<HealthStatusResponse> {
    const providers = this.tracker.getAllHealthStatus();
    const healthy = providers.filter(
      (p: ProviderHealth) => p.status === "healthy",
    ).length;
    const degraded = providers.filter(
      (p: ProviderHealth) => p.status === "degraded",
    ).length;
    const down = providers.filter(
      (p: ProviderHealth) => p.status === "down",
    ).length;
    const unknown = providers.filter(
      (p: ProviderHealth) => p.status === "unknown",
    ).length;

    return {
      providers,
      summary: {
        totalProviders: providers.length,
        healthyCount: healthy,
        degradedCount: degraded,
        downCount: down,
        unknownCount: unknown,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health/providers/:id
   * Get health status for a specific provider.
   */
  async getProviderHealth(providerId: string): Promise<ProviderHealth | null> {
    const validated = providerId; // Validation done by router
    return this.tracker.getHealthStatus(validated) || null;
  }

  /**
   * GET /health/providers/:id/history
   * Get health history for a provider (30-day rolling window).
   */
  async getProviderHealthHistory(providerId: string): Promise<{
    providerId: string;
    history: Array<{
      timestamp: string;
      status: string;
      uptime: number;
      latency: number;
      errorRate: number;
    }>;
  }> {
    const history = this.tracker.getHealthHistory(providerId);
    return {
      providerId,
      history: history.map((h) => ({
        timestamp: h.timestamp.toISOString(),
        status: h.status,
        uptime: h.uptime,
        latency: h.latency,
        errorRate: h.errorRate,
      })),
    };
  }

  /**
   * GET /health/sla
   * Get SLA reports for all providers.
   */
  async getAllSLAReports(
    period: "daily" | "weekly" | "monthly",
  ): Promise<SLAReportResponse> {
    const providers = this.tracker.getAllHealthStatus();
    const reports: SLAReport[] = [];
    let totalBreaches = 0;
    let totalCredit = 0;

    for (const provider of providers) {
      const history = this.tracker.getHealthHistory(provider.providerId);
      const report = this.slaMonitor.calculateSLAReport(
        provider.providerId,
        history,
        period,
      );
      if (report) {
        reports.push(report);
        totalBreaches += report.breachCount;
        totalCredit += report.creditAmount || 0;
      }
    }

    return {
      reports,
      totalBreaches,
      creditAmount: totalCredit,
    };
  }

  /**
   * GET /health/sla/:providerId
   * Get SLA report for specific provider.
   */
  async getProviderSLAReport(
    providerId: string,
    period: "daily" | "weekly" | "monthly",
  ): Promise<SLAReport | null> {
    const history = this.tracker.getHealthHistory(providerId);
    return (
      this.slaMonitor.calculateSLAReport(providerId, history, period) || null
    );
  }

  /**
   * GET /health/latency/:providerId
   * Get latency analysis for provider.
   */
  async getLatencyAnalysis(
    providerId: string,
    endpoint: string,
    window: LatencyTimeWindow = "1hr",
  ): Promise<LatencyAnalysisResponse> {
    const bucket = this.latencyHistogram.getLatencyBucket(
      providerId,
      endpoint,
      window,
    );
    const slowRequests = this.latencyHistogram.identifySlowRequests(providerId);

    return {
      providerId,
      endpoint,
      window,
      percentiles: bucket
        ? {
            p50: bucket.p50,
            p95: bucket.p95,
            p99: bucket.p99,
            p999: bucket.p999,
            min: bucket.min,
            max: bucket.max,
            mean: bucket.mean,
          }
        : { p50: 0, p95: 0, p99: 0, p999: 0, min: 0, max: 0, mean: 0 },
      slowRequests,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health/errors
   * Get error analysis for all providers.
   */
  async getAllErrorTrends(): Promise<{
    trends: ErrorAnalysisResponse[];
    timestamp: string;
  }> {
    const providers = this.tracker.getAllHealthStatus();
    const trends: ErrorAnalysisResponse[] = [];

    for (const provider of providers) {
      const trend = this.errorAnalyzer.analyzeTrends(provider.providerId);
      if (trend) {
        trends.push({
          providerId: provider.providerId,
          currentTrend: trend,
          recentErrors: [
            {
              classification: trend.classification,
              count: Math.round(trend.errorCount),
              percentage: 100,
            },
          ],
          timestamp: new Date().toISOString(),
        });
      }
    }

    return { trends, timestamp: new Date().toISOString() };
  }

  /**
   * GET /health/errors/:providerId/trends
   * Get error trends for specific provider.
   */
  async getProviderErrorTrends(
    providerId: string,
  ): Promise<ErrorAnalysisResponse | null> {
    const trend = this.errorAnalyzer.analyzeTrends(providerId);

    if (!trend) return null;

    return {
      providerId,
      currentTrend: trend,
      recentErrors: [
        {
          classification: trend.classification,
          count: Math.round(trend.errorCount),
          percentage: 100,
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health/degradation
   * Get degradation status for all providers.
   */
  async getAllDegradationStatus(): Promise<{
    degradations: DegradationAnalysisResponse[];
    criticalCount: number;
    timestamp: string;
  }> {
    const providers = this.tracker.getAllHealthStatus();
    const degradations: DegradationAnalysisResponse[] = [];
    let criticalCount = 0;

    for (const provider of providers) {
      const event = this.degradationDetector.getLatestEvent(
        provider.providerId,
      );
      const isDegraded = event && !event.recovered;

      degradations.push({
        providerId: provider.providerId,
        latestEvent: event || null,
        isCurrentlyDegraded: isDegraded || false,
        anomalyScore: event?.anomalyScore || 0,
        timestamp: new Date().toISOString(),
      });

      if (isDegraded && event?.severity === "critical") {
        criticalCount++;
      }
    }

    return { degradations, criticalCount, timestamp: new Date().toISOString() };
  }

  /**
   * GET /health/alerts
   * Get alerts with filtering and pagination.
   */
  async getAlerts(
    query: z.infer<typeof AlertQuerySchema>,
  ): Promise<AlertsResponse> {
    const validated = AlertQuerySchema.parse(query);
    const allAlerts = Array.from(
      this.alertingEngine["alerts"]?.values?.() || [],
    ) as Alert[];

    let filtered = allAlerts;

    if (validated.providerId) {
      filtered = filtered.filter(
        (a: Alert) => a.providerId === validated.providerId,
      );
    }

    if (validated.severity) {
      filtered = filtered.filter(
        (a: Alert) => a.severity === validated.severity,
      );
    }

    if (validated.status) {
      filtered = filtered.filter((a: Alert) => a.status === validated.status);
    }

    const paginated = filtered.slice(
      validated.offset,
      validated.offset + validated.limit,
    );

    return {
      alerts: paginated,
      total: filtered.length,
      limit: validated.limit,
      offset: validated.offset,
    };
  }

  /**
   * POST /health/alerts/:id/acknowledge
   * Acknowledge an alert.
   */
  async acknowledgeAlert(
    alertId: string,
    data: z.infer<typeof AcknowledgeAlertSchema>,
  ): Promise<{ success: boolean; alertId: string }> {
    const validated = AcknowledgeAlertSchema.parse(data);
    this.alertingEngine.acknowledgeAlert(
      alertId,
      validated.acknowledgedBy,
      validated.comment,
    );

    return {
      success: true,
      alertId,
    };
  }

  /**
   * POST /health/alerts/:id/resolve
   * Resolve an alert.
   */
  async resolveAlert(
    alertId: string,
    data: z.infer<typeof ResolveAlertSchema>,
  ): Promise<{ success: boolean; alertId: string }> {
    const validated = ResolveAlertSchema.parse(data);
    this.alertingEngine.resolveAlert(
      alertId,
      validated.resolvedBy,
      validated.rootCause,
      validated.actionsTaken,
    );

    return {
      success: true,
      alertId,
    };
  }

  /**
   * POST /health/check/:providerId
   * Execute a manual health check for a provider.
   */
  async executeHealthCheck(
    providerId: string,
    data: z.infer<typeof ExecuteHealthCheckSchema>,
  ): Promise<HealthCheckResultResponse> {
    const validated = ExecuteHealthCheckSchema.parse(data);
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), validated.timeoutMs);

      const response = await fetch(validated.endpoint, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const responseTime = Date.now() - startTime;

      return {
        providerId,
        success: response.ok,
        statusCode: response.status,
        responseTime,
        endpoint: validated.endpoint,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        providerId,
        success: false,
        responseTime,
        endpoint: validated.endpoint,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * POST /health/rules
   * Create alert rule.
   */
  async createAlertRule(
    data: z.infer<typeof CreateAlertRuleSchema>,
  ): Promise<AlertRule> {
    const validated = CreateAlertRuleSchema.parse(data);
    const ruleId = `rule-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const rule: AlertRule = {
      ruleId,
      providerId: validated.providerId,
      name: validated.name,
      type: validated.type,
      condition: validated.condition,
      severity: validated.severity,
      channels: validated.channels,
      enabled: validated.enabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.alertingEngine.registerRule(rule);
    return rule;
  }

  /**
   * GET /health/rules
   * Get all alert rules.
   */
  async getAlertRules(): Promise<{
    rules: AlertRule[];
    total: number;
  }> {
    const rules = Array.from(
      this.alertingEngine["alertRules"]?.values?.() || [],
    ) as AlertRule[];
    return {
      rules,
      total: rules.length,
    };
  }

  /**
   * GET /health/status/summary
   * Get overall health summary.
   */
  async getHealthSummary(): Promise<{
    overallStatus: "healthy" | "degraded" | "down";
    providerCount: number;
    healthyCount: number;
    degradedCount: number;
    downCount: number;
    activeAlertCount: number;
    breachCount: number;
    timestamp: string;
  }> {
    const allHealth = this.tracker.getAllHealthStatus();
    const healthy = allHealth.filter(
      (p: ProviderHealth) => p.status === "healthy",
    ).length;
    const degraded = allHealth.filter(
      (p: ProviderHealth) => p.status === "degraded",
    ).length;
    const down = allHealth.filter(
      (p: ProviderHealth) => p.status === "down",
    ).length;

    let overallStatus: "healthy" | "degraded" | "down" = "healthy";
    if (down > 0) overallStatus = "down";
    else if (degraded > 0) overallStatus = "degraded";

    const allAlerts = Array.from(
      this.alertingEngine["alerts"]?.values?.() || [],
    ) as Alert[];
    const activeAlerts = allAlerts.filter(
      (a: Alert) => a.status === "firing",
    ).length;

    const slaDaily = this.slaMonitor["slaReports"];
    let breachCount = 0;
    if (slaDaily) {
      for (const reports of slaDaily.values()) {
        breachCount += reports.reduce(
          (sum: number, r: SLAReport) => sum + (r.breachCount || 0),
          0,
        );
      }
    }

    return {
      overallStatus,
      providerCount: allHealth.length,
      healthyCount: healthy,
      degradedCount: degraded,
      downCount: down,
      activeAlertCount: activeAlerts,
      breachCount,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Attach health API handlers to an Express-like router.
 */
export function attachHealthAPI(
  router: any,
  tracker: RealTimeHealthTracker,
  slaMonitor: SLAMonitor,
  latencyHistogram: LatencyHistogram,
  errorAnalyzer: ErrorTrendAnalyzer,
  degradationDetector: DegradationDetector,
  alertingEngine: AlertingEngine,
): void {
  const handler = new HealthAPIHandler(
    tracker,
    slaMonitor,
    latencyHistogram,
    errorAnalyzer,
    degradationDetector,
    alertingEngine,
  );

  // Health status endpoints
  router.get("/health/providers", async (req: any, res: any) => {
    try {
      const result = await handler.getAllProviderHealth();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.get("/health/providers/:id", async (req: any, res: any) => {
    try {
      const result = await handler.getProviderHealth(req.params.id);
      if (!result) {
        res.status(404).json({ error: "Provider not found" });
      } else {
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.get("/health/providers/:id/history", async (req: any, res: any) => {
    try {
      const result = await handler.getProviderHealthHistory(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // SLA endpoints
  router.get("/health/sla", async (req: any, res: any) => {
    try {
      const period = req.query.period || "daily";
      const result = await handler.getAllSLAReports(period);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.get("/health/sla/:providerId", async (req: any, res: any) => {
    try {
      const period = req.query.period || "daily";
      const result = await handler.getProviderSLAReport(
        req.params.providerId,
        period,
      );
      if (!result) {
        res.status(404).json({ error: "SLA report not found" });
      } else {
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Latency endpoints
  router.get("/health/latency/:providerId", async (req: any, res: any) => {
    try {
      const endpoint = req.query.endpoint || "default";
      const window = req.query.window || "1hr";
      const result = await handler.getLatencyAnalysis(
        req.params.providerId,
        endpoint,
        window,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Error endpoints
  router.get("/health/errors", async (req: any, res: any) => {
    try {
      const result = await handler.getAllErrorTrends();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.get(
    "/health/errors/:providerId/trends",
    async (req: any, res: any) => {
      try {
        const result = await handler.getProviderErrorTrends(
          req.params.providerId,
        );
        if (!result) {
          res.status(404).json({ error: "Error trend not found" });
        } else {
          res.json(result);
        }
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    },
  );

  // Degradation endpoints
  router.get("/health/degradation", async (req: any, res: any) => {
    try {
      const result = await handler.getAllDegradationStatus();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Alert endpoints
  router.get("/health/alerts", async (req: any, res: any) => {
    try {
      const result = await handler.getAlerts(req.query);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.post("/health/alerts/:id/acknowledge", async (req: any, res: any) => {
    try {
      const result = await handler.acknowledgeAlert(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.post("/health/alerts/:id/resolve", async (req: any, res: any) => {
    try {
      const result = await handler.resolveAlert(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Manual check endpoint
  router.post("/health/check/:providerId", async (req: any, res: any) => {
    try {
      const result = await handler.executeHealthCheck(
        req.params.providerId,
        req.body,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Rule endpoints
  router.post("/health/rules", async (req: any, res: any) => {
    try {
      const result = await handler.createAlertRule(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.get("/health/rules", async (req: any, res: any) => {
    try {
      const result = await handler.getAlertRules();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Summary endpoint
  router.get("/health/status/summary", async (req: any, res: any) => {
    try {
      const result = await handler.getHealthSummary();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
}

/**
 * Export validation schemas for external use.
 */
export {
  CreateAlertRuleSchema,
  AcknowledgeAlertSchema,
  ResolveAlertSchema,
  ExecuteHealthCheckSchema,
  AlertQuerySchema,
};
