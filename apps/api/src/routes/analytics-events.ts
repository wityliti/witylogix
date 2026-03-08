/**
 * Analytics V2 Routes — Dashboard KPIs, Metrics, Comparisons, Export
 *
 * RESTful API endpoints for analytics queries and dashboard data.
 * All routes require authentication and tenant context.
 *
 * Routes:
 *   GET /analytics/dashboard        — Dashboard summary with all widgets
 *   GET /analytics/events           — Event stream/pagination
 *   GET /analytics/metrics/:metric  — Specific metric with time range
 *   GET /analytics/compare          — Period comparison (vs previous period)
 *   GET /analytics/export           — CSV/JSON export of analytics data
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";

// ─── Query Parameter Schemas ──────────────────────────────────────────

const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const dashboardQuerySchema = dateRangeSchema.extend({
  includeCache: z.boolean().optional().default(true),
});

const metricsQuerySchema = dateRangeSchema.extend({
  granularity: z
    .enum(["hourly", "daily", "weekly", "monthly"])
    .optional()
    .default("daily"),
  groupBy: z.string().optional(), // comma-separated dimensions
  filters: z.string().optional(), // JSON-encoded filters
});

const compareQuerySchema = dateRangeSchema.extend({
  metric: z.string(),
  previousPeriodDays: z.number().int().positive().optional().default(30),
});

const exportQuerySchema = dateRangeSchema.extend({
  format: z.enum(["csv", "json"]).optional().default("csv"),
  metric: z.string(),
  limit: z.number().int().positive().max(50000).optional().default(10000),
});

const eventStreamQuerySchema = z.object({
  limit: z.number().int().positive().max(1000).optional().default(100),
  offset: z.number().int().nonnegative().optional().default(0),
  eventType: z.string().optional(),
  userId: z.string().optional(),
});

// ─── Helper Functions ──────────────────────────────────────────────────

/**
 * Parse date range from query parameters.
 * Defaults to last 30 days if not specified.
 */
function parseDateRange(from?: string, to?: string) {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from
    ? new Date(from)
    : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  return { from: fromDate.toISOString(), to: toDate.toISOString() };
}

/**
 * Build error response.
 */
function errorResponse(message: string, statusCode: number = 400) {
  return {
    error: true,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  };
}

// ─── Route Plugin ──────────────────────────────────────────────────────

/**
 * Register analytics v2 routes.
 * Requires FastifyInstance and provider/aggregator instances injected.
 */
async function analyticsV2Routes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET /analytics/dashboard ────────────────────────────────────────
  /**
   * Get a complete dashboard summary with all KPI widgets.
   *
   * Query Parameters:
   *   - from: ISO 8601 start date (optional, defaults to 30 days ago)
   *   - to: ISO 8601 end date (optional, defaults to now)
   *   - includeCache: whether to use cached results (optional, default: true)
   *
   * Response:
   *   {
   *     id: string,
   *     tenantId: string,
   *     timeRange: { from: string, to: string },
   *     widgets: DashboardWidget[],
   *     generatedAt: string,
   *     generationTimeMs: number
   *   }
   */
  fastify.get(
    "/dashboard",
    async (request: any, reply: FastifyReply) => {
      try {
        const query = dashboardQuerySchema.parse(request.query);
        const { from, to } = parseDateRange(query.from, query.to);
        const tenantId = request.tenantId as string;

        // Inject dashboard provider from container
        const provider = fastify.diContainer.get("dashboardDataProvider");
        const dashboard = await provider.getDashboardSummary(tenantId, {
          from,
          to,
        });

        reply.code(200).send(dashboard);
      } catch (err) {
        if (err instanceof z.ZodError) {
          reply.code(400).send(errorResponse(err.message, 400));
        } else {
          console.error("[Analytics] Dashboard error:", err);
          reply.code(500).send(errorResponse("Failed to fetch dashboard", 500));
        }
      }
    },
  );

  // ── GET /analytics/events ───────────────────────────────────────────
  /**
   * Get event stream with pagination.
   * Used for debugging and auditing analytics events.
   *
   * Query Parameters:
   *   - limit: max events per page (1-1000, default: 100)
   *   - offset: pagination offset (default: 0)
   *   - eventType: filter by event type (optional)
   *   - userId: filter by user ID (optional)
   *
   * Response:
   *   {
   *     events: AnalyticsEvent[],
   *     totalCount: number,
   *     limit: number,
   *     offset: number,
   *     hasMore: boolean
   *   }
   */
  fastify.get(
    "/events",
    async (request: any, reply: FastifyReply) => {
      try {
        const query = eventStreamQuerySchema.parse(request.query);
        const tenantId = request.tenantId as string;

        // Inject event repository from container
        const repo = fastify.diContainer.get("analyticsEventRepository");
        const { events, totalCount } = await repo.findEvents({
          tenantId,
          eventType: query.eventType,
          userId: query.userId,
          limit: query.limit,
          offset: query.offset,
        });

        reply.code(200).send({
          events,
          totalCount,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + query.limit < totalCount,
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          reply.code(400).send(errorResponse(err.message, 400));
        } else {
          console.error("[Analytics] Event stream error:", err);
          reply.code(500).send(errorResponse("Failed to fetch events", 500));
        }
      }
    },
  );

  // ── GET /analytics/metrics/:metric ──────────────────────────────────
  /**
   * Get a specific metric with time-series data and grouping.
   *
   * Path Parameters:
   *   - metric: metric identifier (e.g., "order_volume", "delivery_time")
   *
   * Query Parameters:
   *   - from: ISO 8601 start date
   *   - to: ISO 8601 end date
   *   - granularity: hourly | daily | weekly | monthly (default: daily)
   *   - groupBy: comma-separated dimension fields (e.g., "zone,status")
   *   - filters: JSON-encoded filter conditions (optional)
   *
   * Response:
   *   {
   *     metric: MetricDefinition,
   *     dataPoints: AggregationDataPoint[],
   *     eventCount: number,
   *     executionTimeMs: number,
   *     fromCache: boolean
   *   }
   */
  fastify.get(
    "/metrics/:metric",
    async (request: any, reply: FastifyReply) => {
      try {
        const { metric: metricId } = request.params;
        const query = metricsQuerySchema.parse(request.query);
        const { from, to } = parseDateRange(query.from, query.to);
        const tenantId = request.tenantId as string;

        // Parse groupBy dimensions
        const groupBy = query.groupBy
          ? query.groupBy.split(",").map((f) => ({ field: f.trim() }))
          : undefined;

        // Parse filters
        let filters;
        if (query.filters) {
          try {
            filters = JSON.parse(query.filters);
          } catch {
            return reply.code(400).send(
              errorResponse("Invalid filters JSON format", 400),
            );
          }
        }

        // Inject aggregator from container
        const aggregator = fastify.diContainer.get("analyticsAggregator");
        const result = await aggregator.aggregate({
          id: metricId,
          name: metricId,
          eventTypes: [], // Map metric ID to event types
          aggregations: ["count"],
          timeRange: { from, to },
          granularity: query.granularity,
          groupBy,
          filters,
          tenantId,
        });

        reply.code(200).send(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          reply.code(400).send(errorResponse(err.message, 400));
        } else {
          console.error("[Analytics] Metric error:", err);
          reply.code(500).send(errorResponse("Failed to fetch metric", 500));
        }
      }
    },
  );

  // ── GET /analytics/compare ──────────────────────────────────────────
  /**
   * Compare a metric across two periods (current vs previous).
   * Useful for trend analysis and KPI monitoring.
   *
   * Query Parameters:
   *   - metric: metric identifier to compare
   *   - from: ISO 8601 start date of current period
   *   - to: ISO 8601 end date of current period
   *   - previousPeriodDays: length of previous period in days (default: 30)
   *
   * Response:
   *   {
   *     metric: string,
   *     current: number,
   *     previous: number,
   *     change: number,
   *     percentChange: number,
   *     trend: "up" | "down" | "neutral"
   *   }
   */
  fastify.get(
    "/compare",
    async (request: any, reply: FastifyReply) => {
      try {
        const query = compareQuerySchema.parse(request.query);
        const { from, to } = parseDateRange(query.from, query.to);
        const tenantId = request.tenantId as string;

        // Inject aggregator from container
        const aggregator = fastify.diContainer.get("analyticsAggregator");
        const metricDef = {
          id: query.metric,
          name: query.metric,
          eventTypes: [],
          aggregations: ["count"],
          timeRange: { from, to },
          tenantId,
        };
        const result = await aggregator.comparePeriods(metricDef, query.previousPeriodDays);

        reply.code(200).send({
          metric: query.metric,
          ...result,
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          reply.code(400).send(errorResponse(err.message, 400));
        } else {
          console.error("[Analytics] Compare error:", err);
          reply.code(500).send(errorResponse("Failed to compare metrics", 500));
        }
      }
    },
  );

  // ── GET /analytics/export ───────────────────────────────────────────
  /**
   * Export analytics data in CSV or JSON format.
   * Large datasets are returned as streaming responses.
   *
   * Query Parameters:
   *   - format: csv | json (default: csv)
   *   - metric: metric identifier to export
   *   - from: ISO 8601 start date
   *   - to: ISO 8601 end date
   *   - limit: max rows to export (1-50000, default: 10000)
   *
   * Response:
   *   - Content-Type: text/csv or application/json
   *   - Content-Disposition: attachment; filename="analytics_export.csv"
   */
  fastify.get(
    "/export",
    async (request: any, reply: FastifyReply) => {
      try {
        const query = exportQuerySchema.parse(request.query);
        const { from, to } = parseDateRange(query.from, query.to);
        const tenantId = request.tenantId as string;

        // Implement export logic via event repository
        const repo = fastify.diContainer.get("analyticsEventRepository");
        const events = await repo.findEventsForExport({
          tenantId,
          timeRange: { from, to },
          limit: query.limit,
        });

        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `analytics_${query.metric}_${timestamp}.${query.format}`;

        reply.header(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );

        if (query.format === "csv") {
          reply.header("Content-Type", "text/csv");

          // CSV headers
          const headers = ["id", "type", "timestamp", "userId", "correlationId", "metadata", "statusCode", "durationMs", "errorMessage"];
          let csv = headers.join(",") + "\n";

          // CSV rows
          for (const event of events) {
            const row = [
              event.id,
              event.type,
              event.timestamp,
              event.userId || "",
              event.correlationId || "",
              JSON.stringify(event.metadata || {}),
              event.statusCode || "",
              event.durationMs || "",
              event.errorMessage || "",
            ];
            csv += row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",") + "\n";
          }

          reply.send(csv);
        } else {
          reply.header("Content-Type", "application/json");
          reply.send({
            data: events,
            totalRows: events.length,
            generatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        if (err instanceof z.ZodError) {
          reply.code(400).send(errorResponse(err.message, 400));
        } else {
          console.error("[Analytics] Export error:", err);
          reply.code(500).send(errorResponse("Failed to export data", 500));
        }
      }
    },
  );

  // ── Health check ─────────────────────────────────────────────────────
  /**
   * Simple endpoint to verify analytics API is available.
   */
  fastify.get(
    "/health",
    async (_request: any, reply: FastifyReply) => {
      reply.code(200).send({
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    },
  );
}

// Export the plugin
export default analyticsV2Routes;
