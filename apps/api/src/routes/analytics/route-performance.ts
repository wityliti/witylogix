/**
 * Route Performance Analytics API Routes
 *
 * Endpoints for planned-vs-actual analytics dashboard
 *
 * Routes:
 *   GET /route-performance               Summary metrics
 *   GET /route-performance/planned-vs-actual    Time series data
 *   GET /route-performance/drivers       Driver scorecard leaderboard
 *   GET /route-performance/efficiency    Heatmap data
 *   GET /route-performance/co2           Carbon tracking data
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { tenantContext } from "../../middleware/tenant.js";

// ─── Query Schemas ─────────────────────────────────────────────────

const dateRangeSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

const summaryQuerySchema = dateRangeSchema.extend({
  period: z.enum(["24h", "7d", "30d"]).default("30d"),
});

const trendsQuerySchema = dateRangeSchema.extend({
  granularity: z.enum(["hourly", "daily", "weekly", "monthly"]).default("daily"),
});

const driverLeaderboardQuerySchema = dateRangeSchema.extend({
  period: z.enum(["24h", "7d", "30d"]).default("30d"),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

const heatmapQuerySchema = dateRangeSchema.extend({
  driverId: z.string().uuid().optional(),
});

const co2QuerySchema = dateRangeSchema;

// ─── Mock Data Generators ──────────────────────────────────────────

function generatePlannedVsActualData(
  granularity: string,
  dateFrom: Date,
  dateTo: Date
) {
  const data = [];
  let current = new Date(dateFrom);

  while (current <= dateTo) {
    const timestamp = current.toISOString().split("T")[0];

    data.push({
      timestamp,
      plannedDuration: Math.round(110 + Math.random() * 20), // 110-130 min
      actualDuration: Math.round(115 + Math.random() * 25), // 115-140 min
      variance: Math.round(5 + Math.random() * 15),
      onTimePercentage: Math.round(90 + Math.random() * 8), // 90-98%
      deliveryCount: Math.round(15 + Math.random() * 20), // 15-35 deliveries
    });

    // Increment based on granularity
    if (granularity === "weekly") {
      current.setDate(current.getDate() + 7);
    } else if (granularity === "monthly") {
      current.setMonth(current.getMonth() + 1);
    } else {
      current.setDate(current.getDate() + 1);
    }
  }

  return data;
}

function generateDriverLeaderboard(limit: number) {
  const drivers = [
    { name: "Priya Patel", avatar: "https://i.pravatar.cc/150?img=1" },
    { name: "Ahmed Khalil", avatar: "https://i.pravatar.cc/150?img=2" },
    { name: "Carlos Martinez", avatar: "https://i.pravatar.cc/150?img=3" },
    { name: "Sofia Lindberg", avatar: "https://i.pravatar.cc/150?img=4" },
    { name: "Marcus Johnson", avatar: "https://i.pravatar.cc/150?img=5" },
    { name: "Lisa Thompson", avatar: "https://i.pravatar.cc/150?img=6" },
    { name: "David Chen", avatar: "https://i.pravatar.cc/150?img=7" },
    { name: "Isabella Rodriguez", avatar: "https://i.pravatar.cc/150?img=8" },
    { name: "James O'Brien", avatar: "https://i.pravatar.cc/150?img=9" },
    { name: "Yuki Tanaka", avatar: "https://i.pravatar.cc/150?img=10" },
  ];

  return drivers.slice(0, limit).map((driver, index) => ({
    rank: index + 1,
    driverId: `driver-${index + 1}`,
    driverName: driver.name,
    driverAvatarUrl: driver.avatar,
    deliveriesCompleted: Math.round(450 - index * 20),
    onTimePercentage: Math.round(9800 - index * 150) / 100, // 98%, 97.5%, etc.
    avgTimePerStop: Math.round(19 + index * 1.2 * 10) / 10, // 19, 21.2, 23.4, etc.
    customerRatingAvg: Math.round((4.9 - index * 0.08) * 100) / 100,
    firstAttemptRate: Math.round(9750 - index * 100) / 100, // 97.5%, 97%, etc.
    compositeScore: Math.round((95 - index * 2) * 100) / 100,
    trend: ["up", "neutral", "down"][Math.floor(Math.random() * 3)] as "up" | "neutral" | "down",
    trendValue: Math.round((Math.random() - 0.5) * 10 * 100) / 100, // -5 to +5
  }));
}

function generateEfficiencyHeatmap() {
  const data = [];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      // Peak efficiency during business hours
      const baseEfficiency = hour >= 8 && hour <= 18 ? 85 : 65;
      const randomVariation = Math.round(Math.random() * 20 - 10);

      data.push({
        dayOfWeek: day as any,
        dayName: dayNames[day],
        hour,
        efficiency: Math.max(50, Math.min(100, baseEfficiency + randomVariation)),
        deliveryCount: Math.round(Math.random() * 30 + 5),
        avgTimeVariance: Math.round(Math.random() * 20 - 10),
      });
    }
  }

  return data;
}

function generateCO2Data(dateFrom: Date, dateTo: Date) {
  // Calculate days between
  const daysDiff = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));

  // Trend data
  const trend = [];
  for (let i = 0; i < daysDiff; i++) {
    const date = new Date(dateFrom);
    date.setDate(date.getDate() + i);
    trend.push({
      date: date.toISOString().split("T")[0],
      value: Math.round(450 + Math.random() * 100),
    });
  }

  return {
    plannedTotal: 12450,
    actualTotal: 12100,
    savedTotal: 350,
    targetSavings: 500,
    trend,
    vehicleBreakdown: [
      {
        type: "Van",
        plannedCO2: 7800,
        actualCO2: 7450,
        savedCO2: 350,
      },
      {
        type: "Truck (Small)",
        plannedCO2: 3200,
        actualCO2: 3100,
        savedCO2: 100,
      },
      {
        type: "Motorcycle",
        plannedCO2: 1450,
        actualCO2: 1550,
        savedCO2: -100,
      },
    ],
  };
}

function generateSLAComplianceData(dateFrom: Date, dateTo: Date) {
  const daysDiff = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
  const trend = [];

  for (let i = 0; i < daysDiff; i++) {
    const date = new Date(dateFrom);
    date.setDate(date.getDate() + i);
    trend.push({
      date: date.toISOString().split("T")[0],
      overall: Math.round(9200 + Math.random() * 600) / 100,
      premium: Math.round(9700 + Math.random() * 300) / 100,
      standard: Math.round(9300 + Math.random() * 400) / 100,
      economy: Math.round(8800 + Math.random() * 800) / 100,
    });
  }

  return {
    overall: 92.3,
    byTier: {
      premium: { percentage: 97.8, count: 1245 },
      standard: { percentage: 93.2, count: 3421 },
      economy: { percentage: 88.5, count: 2187 },
    },
    trend,
  };
}

// ─── Helper Functions ──────────────────────────────────────────────

function getDateRange(dateFrom?: string, dateTo?: string) {
  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = dateTo ? new Date(dateTo) : new Date();
  return { from, to };
}

// ─── Routes ────────────────────────────────────────────────────────

async function routePerformanceRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  /**
   * GET /route-performance
   * Summary metrics for dashboard
   */
  fastify.get("/route-performance", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = summaryQuerySchema.parse(request.query);
      const { dateFrom, dateTo, period } = query;
      const { from, to } = getDateRange(dateFrom, dateTo);

      return reply.send({
        data: {
          onTimePercentage: 94.3,
          avgDeliveryTime: 24,
          co2Savings: 1250,
          slaCompliance: 92.8,
          totalDeliveries: 3853,
          period,
        },
        timestamp: new Date().toISOString(),
        cached: false,
      });
    } catch (error) {
      return reply.status(400).send({ error: "Invalid query parameters" });
    }
  });

  /**
   * GET /route-performance/planned-vs-actual
   * Time series data for trend chart
   */
  fastify.get(
    "/route-performance/planned-vs-actual",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = trendsQuerySchema.parse(request.query);
        const { dateFrom, dateTo, granularity } = query;
        const { from, to } = getDateRange(dateFrom, dateTo);

        const data = generatePlannedVsActualData(granularity, from, to);

        return reply.send({
          data,
          dateRange: { from: from.toISOString(), to: to.toISOString() },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return reply.status(400).send({ error: "Invalid query parameters" });
      }
    }
  );

  /**
   * GET /route-performance/drivers
   * Driver leaderboard with scorecards
   */
  fastify.get(
    "/route-performance/drivers",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = driverLeaderboardQuerySchema.parse(request.query);
        const { dateFrom, dateTo, period, limit, offset } = query;
        const { from, to } = getDateRange(dateFrom, dateTo);

        const allDrivers = generateDriverLeaderboard(100);
        const paginatedDrivers = allDrivers.slice(offset, offset + limit);

        return reply.send({
          data: paginatedDrivers,
          totalCount: allDrivers.length,
          period,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return reply.status(400).send({ error: "Invalid query parameters" });
      }
    }
  );

  /**
   * GET /route-performance/efficiency
   * Efficiency heatmap data
   */
  fastify.get(
    "/route-performance/efficiency",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = heatmapQuerySchema.parse(request.query);
        const { dateFrom, dateTo, driverId } = query;
        const { from, to } = getDateRange(dateFrom, dateTo);

        const data = generateEfficiencyHeatmap();

        return reply.send({
          data,
          dateRange: { from: from.toISOString(), to: to.toISOString() },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return reply.status(400).send({ error: "Invalid query parameters" });
      }
    }
  );

  /**
   * GET /route-performance/co2
   * CO2 tracking and carbon impact data
   */
  fastify.get(
    "/route-performance/co2",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = co2QuerySchema.parse(request.query);
        const { dateFrom, dateTo } = query;
        const { from, to } = getDateRange(dateFrom, dateTo);

        const data = generateCO2Data(from, to);

        return reply.send({
          data,
          dateRange: { from: from.toISOString(), to: to.toISOString() },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return reply.status(400).send({ error: "Invalid query parameters" });
      }
    }
  );

  /**
   * GET /route-performance/sla-compliance
   * SLA compliance metrics by tier
   */
  fastify.get(
    "/route-performance/sla-compliance",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = co2QuerySchema.parse(request.query);
        const { dateFrom, dateTo } = query;
        const { from, to } = getDateRange(dateFrom, dateTo);

        const data = generateSLAComplianceData(from, to);

        return reply.send({
          data,
          dateRange: { from: from.toISOString(), to: to.toISOString() },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return reply.status(400).send({ error: "Invalid query parameters" });
      }
    }
  );
}

export default routePerformanceRoutes;
