/**
 * Route Performance Analytics — Real Prisma queries replacing random-data stubs.
 *
 * Routes:
 *   GET /route-performance               Summary metrics
 *   GET /route-performance/planned-vs-actual    Time series data
 *   GET /route-performance/drivers       Driver scorecard leaderboard
 *   GET /route-performance/efficiency    Heatmap data
 *   GET /route-performance/co2           Carbon tracking data
 *   GET /route-performance/sla-compliance SLA compliance by tier
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@witylogix/db";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { tenantContext } from "../../middleware/tenant.js";

// ─── CO2 emission factors (kg / km) ────────────────────────────────
const CO2_KG_PER_KM: Record<string, number> = {
  BICYCLE: 0,
  MOTORCYCLE: 0.07,
  CAR: 0.18,
  VAN: 0.22,
  TRUCK: 0.35,
};

// Baseline "unoptimized" factor — used to compute savings vs. if every route used an average van
const CO2_BASELINE_KG_PER_KM = 0.25;

// ─── Query Schemas ─────────────────────────────────────────────────

const dateRangeSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

const summaryQuerySchema = dateRangeSchema.extend({
  period: z.enum(["24h", "7d", "30d"]).default("30d"),
});

const trendsQuerySchema = dateRangeSchema.extend({
  period: z.enum(["24h", "7d", "30d"]).optional(),
  granularity: z.enum(["hourly", "daily", "weekly", "monthly"]).default("daily"),
});

const driverLeaderboardQuerySchema = dateRangeSchema.extend({
  period: z.enum(["24h", "7d", "30d"]).default("30d"),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const heatmapQuerySchema = dateRangeSchema.extend({
  driverId: z.string().uuid().optional(),
});

const co2QuerySchema = dateRangeSchema;

// ─── Helper Functions ──────────────────────────────────────────────

function getDateRange(period?: string, dateFrom?: string, dateTo?: string): { from: Date; to: Date } {
  if (dateFrom || dateTo) {
    return {
      from: dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: dateTo ? new Date(dateTo) : new Date(),
    };
  }
  const to = new Date();
  const days = period === "24h" ? 1 : period === "7d" ? 7 : 30;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}

/** Generate an array of date strings (YYYY-MM-DD) from `from` to `to` inclusive */
function generateDateSeries(from: Date, to: Date): string[] {
  const dates: string[] = [];
  const current = new Date(from);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(23, 59, 59, 999);
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

// ─── Routes ────────────────────────────────────────────────────────

async function routePerformanceRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── Summary KPIs ──────────────────────────────────────────────
  fastify.get("/route-performance", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = summaryQuerySchema.parse(request.query);
      const shopId = (request as any).shopId as string;
      const db = (request as any).tenantDb;
      const { from, to } = getDateRange(query.period, query.dateFrom, query.dateTo);

      const [routes, orders] = await Promise.all([
        db.route.findMany({
          where: {
            shopId,
            status: "COMPLETED",
            completedAt: { gte: from, lte: to },
          },
          select: {
            id: true,
            totalDistance: true,
            totalDuration: true,
            startedAt: true,
            completedAt: true,
            driver: { select: { vehicleType: true } },
            stops: {
              select: {
                estimatedArrival: true,
                actualArrival: true,
                status: true,
              },
            },
          },
        }),
        db.order.findMany({
          where: {
            shopId,
            status: "DELIVERED",
            actualDelivery: { gte: from, lte: to },
          },
          select: { deliveryDate: true, actualDelivery: true },
        }),
      ]);

      // On-time: stop arrived before or at estimated
      let plannedMins = 0;
      let actualMins = 0;
      let timedRoutes = 0;
      let onTimeStops = 0;
      let totalStops = 0;
      let totalDistanceKm = 0;
      let co2Actual = 0;
      let co2Baseline = 0;

      for (const r of routes) {
        if (r.startedAt && r.completedAt) {
          actualMins += minutesBetween(r.startedAt, r.completedAt);
          if (r.totalDuration) plannedMins += r.totalDuration;
          timedRoutes++;
        }
        const distKm = r.totalDistance ? parseFloat(r.totalDistance.toString()) : 0;
        totalDistanceKm += distKm;
        const factor = CO2_KG_PER_KM[(r.driver?.vehicleType ?? "VAN")] ?? CO2_KG_PER_KM.VAN;
        co2Actual += distKm * factor;
        co2Baseline += distKm * CO2_BASELINE_KG_PER_KM;

        for (const s of r.stops) {
          if (s.estimatedArrival && s.actualArrival) {
            totalStops++;
            if ((s.actualArrival as Date) <= (s.estimatedArrival as Date)) onTimeStops++;
          }
        }
      }

      // SLA: orders delivered before deliveryDate
      const slaTotal = orders.filter((o: any) => o.deliveryDate && o.actualDelivery).length;
      const slaOnTime = orders.filter(
        (o: any) => o.deliveryDate && o.actualDelivery && (o.actualDelivery as Date) <= (o.deliveryDate as Date)
      ).length;

      const db = request.tenantDb;

      // Fetch all routes in range with IN_PROGRESS or COMPLETED status, including stops and driver
      const routes = await db.route.findMany({
        where: {
          date: { gte: from, lte: to },
          status: { in: ["IN_PROGRESS", "COMPLETED"] },
        },
        include: {
          stops: true,
          driver: true,
        },
      });

      const allStops = routes.flatMap((r) => r.stops);
      const completedStops = allStops.filter((s) => s.status === "COMPLETED");

      // totalDeliveries: count of COMPLETED route stops across those routes
      const totalDeliveries = completedStops.length;

      // onTimePercentage: stops where actualArrival <= estimatedArrival
      const onTimeStops = completedStops.filter(
        (s) => s.actualArrival !== null && s.estimatedArrival !== null && s.actualArrival <= s.estimatedArrival
      );
      const onTimePercentage =
        completedStops.length > 0
          ? Math.round((onTimeStops.length / completedStops.length) * 10000) / 100
          : 0;

      // avgDeliveryTime: avg minutes between actualArrival and departedAt for COMPLETED stops
      const stopsWithDuration = completedStops.filter(
        (s) => s.actualArrival !== null && s.departedAt !== null
      );
      const avgDeliveryTime =
        stopsWithDuration.length > 0
          ? Math.round(
              stopsWithDuration.reduce((sum, s) => {
                const mins =
                  (s.departedAt!.getTime() - s.actualArrival!.getTime()) / 60000;
                return sum + mins;
              }, 0) / stopsWithDuration.length
            )
          : 0;

      // co2Savings: sum(totalDistance) * 0.05 kg/km savings vs unoptimised
      const totalDistanceKm = routes.reduce((sum, r) => {
        return sum + (r.totalDistance !== null ? Number(r.totalDistance) : 0);
      }, 0);
      const co2Savings = Math.round(totalDistanceKm * 0.05 * 100) / 100;

      // slaCompliance: stops where actualArrival <= timeWindowEnd (or estimatedArrival)
      const slaStops = allStops.filter((s) => s.actualArrival !== null);
      const slaOnTime = slaStops.filter((s) => {
        const deadline = s.timeWindowEnd ?? s.estimatedArrival;
        if (deadline === null) return false;
        return s.actualArrival! <= deadline;
      });
      const slaCompliance =
        slaStops.length > 0
          ? Math.round((slaOnTime.length / slaStops.length) * 10000) / 100
          : 0;

      return reply.send({
        data: {
          totalDeliveries,
          onTimePercentage,
          avgDeliveryTime,
          co2Savings,
          slaCompliance,
          period,
        },
        timestamp: new Date().toISOString(),
        cached: false,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: "Invalid query parameters" });
      }
      fastify.log.error(error, "route-performance summary error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // ── Planned vs Actual time-series ────────────────────────────
  fastify.get(
    "/route-performance/planned-vs-actual",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = trendsQuerySchema.parse(request.query);
        const { dateFrom, dateTo } = query;
        const { from, to } = getDateRange(dateFrom, dateTo);

        const db = request.tenantDb;

        // Raw SQL: group routes by date, compute planned/actual durations and on-time stats
        type DailyRow = {
          day: Date;
          avg_planned: number | null;
          avg_actual_minutes: number | null;
          total_stops: bigint;
          on_time_stops: bigint;
          completed_stops: bigint;
        };

        const rows = await db.$queryRaw<DailyRow[]>`
          SELECT
            r.date::date                                             AS day,
            AVG(r.total_duration)                                    AS avg_planned,
            AVG(
              EXTRACT(EPOCH FROM (r.completed_at - r.started_at)) / 60.0
            )                                                        AS avg_actual_minutes,
            COUNT(rs.id)::bigint                                     AS total_stops,
            COUNT(
              CASE
                WHEN rs.actual_arrival IS NOT NULL
                 AND rs.estimated_arrival IS NOT NULL
                 AND rs.actual_arrival <= rs.estimated_arrival
                THEN 1
              END
            )::bigint                                                AS on_time_stops,
            COUNT(
              CASE WHEN rs.status = 'COMPLETED' THEN 1 END
            )::bigint                                                AS completed_stops
          FROM routes r
          LEFT JOIN route_stops rs ON rs.route_id = r.id
          WHERE r.date >= ${from}::date
            AND r.date <= ${to}::date
            AND r.status IN ('IN_PROGRESS', 'COMPLETED')
          GROUP BY r.date::date
          ORDER BY r.date::date ASC
        `;

        // Index by date string for quick lookup
        const rowByDate = new Map<string, DailyRow>();
        for (const row of rows) {
          const dateStr = new Date(row.day).toISOString().split("T")[0];
          rowByDate.set(dateStr, row);
        }

        // Fill every date in range (zeros for missing days)
        const allDates = generateDateSeries(from, to);
        const data = allDates.map((dateStr) => {
          const row = rowByDate.get(dateStr);
          if (!row) {
            return {
              timestamp: dateStr,
              plannedDuration: 0,
              actualDuration: 0,
              variance: 0,
              onTimePercentage: 0,
              deliveryCount: 0,
            };
          }
          const plannedDuration = row.avg_planned !== null ? Math.round(Number(row.avg_planned)) : 0;
          // Fall back to stops-based estimate (20 min/stop) when route has no started/completed timestamps
          const actualDuration =
            row.avg_actual_minutes !== null
              ? Math.round(Number(row.avg_actual_minutes))
              : plannedDuration > 0
                ? plannedDuration
                : 0;
          const variance = actualDuration - plannedDuration;
          const totalStops = Number(row.total_stops);
          const onTimePercentage =
            totalStops > 0
              ? Math.round((Number(row.on_time_stops) / totalStops) * 10000) / 100
              : 0;
          return {
            timestamp: dateStr,
            plannedDuration,
            actualDuration,
            variance,
            onTimePercentage,
            deliveryCount: Number(row.completed_stops),
          };
        });

        return reply.send({
          data,
          dateRange: { from: from.toISOString(), to: to.toISOString() },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid query parameters" });
        }
        fastify.log.error(error, "route-performance planned-vs-actual error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // ── Driver leaderboard ────────────────────────────────────────
  fastify.get(
    "/route-performance/drivers",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = driverLeaderboardQuerySchema.parse(request.query);
        const shopId = (request as any).shopId as string;
        const db = (request as any).tenantDb;
        const { from, to } = getDateRange(query.period, query.dateFrom, query.dateTo);

        // Previous period for trend calculation
        const periodMs = to.getTime() - from.getTime();
        const prevFrom = new Date(from.getTime() - periodMs);
        const prevTo = new Date(from.getTime() - 1);

        const db = request.tenantDb;

        // Current period: aggregate per driver
        type DriverStatsRow = {
          driver_id: string;
          driver_name: string;
          completed: bigint;
          failed: bigint;
          on_time: bigint;
          avg_stop_minutes: number | null;
        };

        const currentRows = await db.$queryRaw<DriverStatsRow[]>`
          SELECT
            d.id                                              AS driver_id,
            d.name                                            AS driver_name,
            COUNT(CASE WHEN rs.status = 'COMPLETED' THEN 1 END)::bigint          AS completed,
            COUNT(CASE WHEN rs.status = 'FAILED'    THEN 1 END)::bigint          AS failed,
            COUNT(
              CASE
                WHEN rs.status = 'COMPLETED'
                 AND rs.actual_arrival IS NOT NULL
                 AND rs.estimated_arrival IS NOT NULL
                 AND rs.actual_arrival <= rs.estimated_arrival
                THEN 1
              END
            )::bigint                                                              AS on_time,
            AVG(
              CASE
                WHEN rs.status = 'COMPLETED'
                 AND rs.actual_arrival IS NOT NULL
                 AND rs.departed_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (rs.departed_at - rs.actual_arrival)) / 60.0
              END
            )                                                                      AS avg_stop_minutes
          FROM drivers d
          INNER JOIN route_stops rs ON rs.driver_id = d.id
          INNER JOIN routes r ON r.id = rs.route_id
          WHERE r.date >= ${from}::date
            AND r.date <= ${to}::date
            AND r.status IN ('IN_PROGRESS', 'COMPLETED')
          GROUP BY d.id, d.name
          HAVING COUNT(CASE WHEN rs.status = 'COMPLETED' THEN 1 END) > 0
          ORDER BY completed DESC
        `;

        if (currentRows.length === 0) {
          return reply.send({
            data: [],
            totalCount: 0,
            period,
            timestamp: new Date().toISOString(),
          });
        }

        // Previous period: just need completed count per driver for trend
        type PrevRow = { driver_id: string; completed: bigint };
        const driverIds = currentRows.map((r) => r.driver_id);

        const prevRows = await db.$queryRaw<PrevRow[]>`
          SELECT
            d.id                                                                   AS driver_id,
            COUNT(CASE WHEN rs.status = 'COMPLETED' THEN 1 END)::bigint           AS completed
          FROM drivers d
          INNER JOIN route_stops rs ON rs.driver_id = d.id
          INNER JOIN routes r ON r.id = rs.route_id
          WHERE d.id = ANY(${driverIds}::uuid[])
            AND r.date >= ${prevFrom}::date
            AND r.date <= ${prevTo}::date
            AND r.status IN ('IN_PROGRESS', 'COMPLETED')
          GROUP BY d.id
        `;

        const prevByDriverId = new Map<string, number>();
        for (const row of prevRows) {
          prevByDriverId.set(row.driver_id, Number(row.completed));
        }

        const totalCount = currentRows.length;
        const pageRows = currentRows.slice(offset, offset + limit);

        const data = pageRows.map((row, idx) => {
          const completed = Number(row.completed);
          const failed = Number(row.failed);
          const onTime = Number(row.on_time);

          const onTimePercentage =
            completed > 0 ? Math.round((onTime / completed) * 10000) / 100 : 0;
          const avgTimePerStop =
            row.avg_stop_minutes !== null
              ? Math.round(Number(row.avg_stop_minutes) * 10) / 10
              : 0;
          // customerRatingAvg: no rating data in schema; fixed placeholder
          const customerRatingAvg = 4.5;
          const firstAttemptRate =
            completed + failed > 0
              ? Math.round((completed / (completed + failed)) * 10000) / 100
              : 100;
          // compositeScore: on-time 40%, first-attempt 30%, fixed 30%
          const compositeScore =
            Math.round((onTimePercentage * 0.4 + firstAttemptRate * 0.3 + 100 * 0.3) * 100) / 100;

          const prevCompleted = prevByDriverId.get(row.driver_id) ?? 0;
          let trend: "up" | "neutral" | "down";
          let trendValue: number;
          if (prevCompleted === 0) {
            trend = completed > 0 ? "up" : "neutral";
            trendValue = 0;
          } else {
            const pctChange = ((completed - prevCompleted) / prevCompleted) * 100;
            trendValue = Math.round(pctChange * 100) / 100;
            trend = pctChange > 0 ? "up" : pctChange < 0 ? "down" : "neutral";
          }

          return {
            rank: offset + idx + 1,
            driverId: row.driver_id,
            driverName: row.driver_name,
            driverAvatarUrl: null,
            deliveriesCompleted: completed,
            onTimePercentage,
            avgTimePerStop,
            customerRatingAvg, // fixed — no review data in schema
            firstAttemptRate,
            compositeScore,
            trend,
            trendValue,
          };
        });

        return reply.send({
          data,
          totalCount,
          period,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid query parameters" });
        }
        fastify.log.error(error, "route-performance drivers error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  /**
   * GET /route-performance/efficiency
   * Efficiency heatmap data (7 days × 24 hours)
   */
  fastify.get(
    "/route-performance/efficiency",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = heatmapQuerySchema.parse(request.query);
        const shopId = (request as any).shopId as string;
        const db = (request as any).tenantDb;
        const { from, to } = getDateRange(undefined, query.dateFrom, query.dateTo);

        const db = request.tenantDb;

        type HeatmapRow = {
          day_of_week: number;
          hour: number;
          total_count: bigint;
          on_time_count: bigint;
          avg_variance_minutes: number | null;
        };

        const rows = await db.$queryRaw<HeatmapRow[]>`
          SELECT
            EXTRACT(DOW FROM rs.actual_arrival)::int                               AS day_of_week,
            EXTRACT(HOUR FROM rs.actual_arrival)::int                              AS hour,
            COUNT(*)::bigint                                                        AS total_count,
            COUNT(
              CASE
                WHEN rs.estimated_arrival IS NOT NULL
                 AND rs.actual_arrival <= rs.estimated_arrival
                THEN 1
              END
            )::bigint                                                               AS on_time_count,
            AVG(
              CASE
                WHEN rs.estimated_arrival IS NOT NULL
                THEN EXTRACT(EPOCH FROM (rs.actual_arrival - rs.estimated_arrival)) / 60.0
              END
            )                                                                       AS avg_variance_minutes
          FROM route_stops rs
          INNER JOIN routes r ON r.id = rs.route_id
          WHERE rs.status = 'COMPLETED'
            AND rs.actual_arrival IS NOT NULL
            AND rs.actual_arrival >= ${from}
            AND rs.actual_arrival <= ${to}
            ${driverId !== undefined ? Prisma.sql`AND rs.driver_id = ${driverId}::uuid` : Prisma.sql``}
          GROUP BY EXTRACT(DOW FROM rs.actual_arrival)::int, EXTRACT(HOUR FROM rs.actual_arrival)::int
        `;

        const dayNames = [
          "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
        ];

        // Index by day+hour for quick lookup
        const rowIndex = new Map<string, HeatmapRow>();
        for (const row of rows) {
          rowIndex.set(`${row.day_of_week}-${row.hour}`, row);
        }

        // Build full 7×24 grid; fill zeros for cells with no data
        const data: {
          dayOfWeek: number;
          dayName: string;
          hour: number;
          efficiency: number;
          deliveryCount: number;
          avgTimeVariance: number;
        }[] = [];

        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour++) {
            const row = rowIndex.get(`${day}-${hour}`);
            if (!row) {
              data.push({
                dayOfWeek: day,
                dayName: dayNames[day],
                hour,
                efficiency: 0,
                deliveryCount: 0,
                avgTimeVariance: 0,
              });
            } else {
              const total = Number(row.total_count);
              const onTime = Number(row.on_time_count);
              const efficiency = total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0;
              const avgTimeVariance =
                row.avg_variance_minutes !== null
                  ? Math.round(Number(row.avg_variance_minutes) * 10) / 10
                  : 0;
              data.push({
                dayOfWeek: day,
                dayName: dayNames[day],
                hour,
                efficiency,
                deliveryCount: total,
                avgTimeVariance,
              });
            }
          }
        }

        return reply.send({
          data,
          dateRange: { from: from.toISOString(), to: to.toISOString() },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid query parameters" });
        }
        fastify.log.error(error, "route-performance efficiency error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // ── CO2 tracking ────────────────────────────────────────────
  fastify.get(
    "/route-performance/co2",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = dateRangeSchema.parse(request.query);
        const shopId = (request as any).shopId as string;
        const db = (request as any).tenantDb;
        const { from, to } = getDateRange(undefined, query.dateFrom, query.dateTo);

        const db = request.tenantDb;

        // CO2 emission factors (kg per km)
        const CO2_FACTORS: Record<string, number> = {
          BICYCLE: 0,
          MOTORCYCLE: 0.103,
          CAR: 0.192,
          VAN: 0.247,
          TRUCK: 0.636,
        };
        const CO2_UNOPTIMISED_OVERHEAD = 1.15;

        // Fetch routes with distance and driver vehicle type
        const routes = await db.route.findMany({
          where: {
            date: { gte: from, lte: to },
            status: { in: ["IN_PROGRESS", "COMPLETED"] },
            totalDistance: { not: null },
          },
          select: {
            id: true,
            date: true,
            totalDistance: true,
            driver: {
              select: { vehicleType: true },
            },
          },
        });

        let plannedTotal = 0;
        let actualTotal = 0;

        // Per-day totals for trend
        const dailyActual = new Map<string, number>();

        // Per-vehicle-type breakdown
        const vehicleTotals = new Map<
          string,
          { planned: number; actual: number }
        >();

        for (const route of routes) {
          const distKm = Number(route.totalDistance ?? 0);
          const vehicleType = route.driver?.vehicleType ?? "CAR";
          const factor = CO2_FACTORS[vehicleType] ?? 0.192;

          const actual = distKm * factor;
          const planned = distKm * factor * CO2_UNOPTIMISED_OVERHEAD;

          plannedTotal += planned;
          actualTotal += actual;

          // Daily
          const dateStr = new Date(route.date).toISOString().split("T")[0];
          dailyActual.set(dateStr, (dailyActual.get(dateStr) ?? 0) + actual);

          // Vehicle breakdown
          const existing = vehicleTotals.get(vehicleType) ?? { planned: 0, actual: 0 };
          vehicleTotals.set(vehicleType, {
            planned: existing.planned + planned,
            actual: existing.actual + actual,
          });
        }

        const savedTotal = plannedTotal - actualTotal;
        const targetSavings = plannedTotal * 0.1;

        // Trend: fill all dates, zero for missing
        const allDates = generateDateSeries(from, to);
        const trend = allDates.map((date) => ({
          date,
          value: Math.round((dailyActual.get(date) ?? 0) * 100) / 100,
        }));

        // Vehicle breakdown
        const vehicleBreakdown = Array.from(vehicleTotals.entries()).map(
          ([type, totals]) => ({
            type,
            plannedCO2: Math.round(totals.planned * 100) / 100,
            actualCO2: Math.round(totals.actual * 100) / 100,
            savedCO2: Math.round((totals.planned - totals.actual) * 100) / 100,
          })
        );

        return reply.send({
          data: {
            plannedTotal: Math.round(plannedTotal * 100) / 100,
            actualTotal: Math.round(actualTotal * 100) / 100,
            savedTotal: Math.round(savedTotal * 100) / 100,
            targetSavings: Math.round(targetSavings * 100) / 100,
            trend,
            vehicleBreakdown,
          },
          dateRange: { from: from.toISOString(), to: to.toISOString() },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid query parameters" });
        }
        fastify.log.error(error, "route-performance co2 error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  /**
   * GET /route-performance/sla-compliance
   * SLA compliance metrics by order value tier
   *
   * Tier segmentation uses Order.totalPrice:
   *   premium:  totalPrice >= 200
   *   standard: totalPrice >= 50 and < 200
   *   economy:  totalPrice < 50 or null
   */
  fastify.get(
    "/route-performance/sla-compliance",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = dateRangeSchema.extend({
          period: z.enum(["24h", "7d", "30d"]).optional(),
        }).parse(request.query);
        const shopId = (request as any).shopId as string;
        const db = (request as any).tenantDb;
        const { from, to } = getDateRange(query.period, query.dateFrom, query.dateTo);

        const db = request.tenantDb;

        // Fetch COMPLETED stops with arrival info, join to orders for price tier
        type SLARow = {
          stop_date: Date;
          order_price: string | null;
          actual_arrival: Date;
          estimated_arrival: Date | null;
          time_window_end: Date | null;
        };

        const rows = await db.$queryRaw<SLARow[]>`
          SELECT
            r.date::date              AS stop_date,
            o.total_price             AS order_price,
            rs.actual_arrival         AS actual_arrival,
            rs.estimated_arrival      AS estimated_arrival,
            rs.time_window_end        AS time_window_end
          FROM route_stops rs
          INNER JOIN routes r ON r.id = rs.route_id
          LEFT JOIN orders o ON o.id = rs.order_id
          WHERE rs.actual_arrival IS NOT NULL
            AND rs.actual_arrival >= ${from}
            AND rs.actual_arrival <= ${to}
            AND r.status IN ('IN_PROGRESS', 'COMPLETED')
        `;

        // Helper: determine if a stop was on time
        function isOnTime(row: SLARow): boolean {
          const deadline = row.time_window_end ?? row.estimated_arrival;
          if (deadline === null) return false;
          return row.actual_arrival <= deadline;
        }

        // Helper: determine tier from order price
        function getTier(price: string | null): "premium" | "standard" | "economy" {
          if (price === null) return "economy";
          const p = parseFloat(price);
          if (p >= 200) return "premium";
          if (p >= 50) return "standard";
          return "economy";
        }

        // Accumulators for overall and per-tier
        let totalCount = 0;
        let totalOnTime = 0;
        const tierCounts = { premium: 0, standard: 0, economy: 0 };
        const tierOnTime = { premium: 0, standard: 0, economy: 0 };

        // Per-day, per-tier for trend
        type DayStats = {
          total: number;
          onTime: number;
          premium: { total: number; onTime: number };
          standard: { total: number; onTime: number };
          economy: { total: number; onTime: number };
        };
        const dailyStats = new Map<string, DayStats>();

        for (const row of rows) {
          const onTime = isOnTime(row);
          const tier = getTier(row.order_price);
          const dateStr = new Date(row.stop_date).toISOString().split("T")[0];

          totalCount++;
          if (onTime) totalOnTime++;
          tierCounts[tier]++;
          if (onTime) tierOnTime[tier]++;

          let day = dailyStats.get(dateStr);
          if (!day) {
            day = {
              total: 0,
              onTime: 0,
              premium: { total: 0, onTime: 0 },
              standard: { total: 0, onTime: 0 },
              economy: { total: 0, onTime: 0 },
            };
            dailyStats.set(dateStr, day);
          }
          day.total++;
          if (onTime) day.onTime++;
          day[tier].total++;
          if (onTime) day[tier].onTime++;
        }

        const pct = (onTime: number, total: number) =>
          total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0;

        const overall = pct(totalOnTime, totalCount);

        const byTier = {
          premium: { percentage: pct(tierOnTime.premium, tierCounts.premium), count: tierCounts.premium },
          standard: { percentage: pct(tierOnTime.standard, tierCounts.standard), count: tierCounts.standard },
          economy: { percentage: pct(tierOnTime.economy, tierCounts.economy), count: tierCounts.economy },
        };

        // Daily trend: fill all dates, zeros for missing
        const allDates = generateDateSeries(from, to);
        const trend = allDates.map((date) => {
          const day = dailyStats.get(date);
          if (!day) {
            return { date, overall: 0, premium: 0, standard: 0, economy: 0 };
          }
          return {
            date,
            overall: pct(day.onTime, day.total),
            premium: pct(day.premium.onTime, day.premium.total),
            standard: pct(day.standard.onTime, day.standard.total),
            economy: pct(day.economy.onTime, day.economy.total),
          };
        });

        return reply.send({
          data: {
            overall,
            byTier,
            trend,
          },
          dateRange: { from: from.toISOString(), to: to.toISOString() },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid query parameters" });
        }
        fastify.log.error(error, "route-performance sla-compliance error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
  /**
   * GET /route-performance/geo
   * City-level delivery efficiency for the map view
   * Returns points: { city, lat, lng, deliveryCount, onTimePercentage, avgVarianceMinutes }
   */
  fastify.get(
    "/route-performance/geo",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = co2QuerySchema.parse(request.query);
        const { dateFrom, dateTo } = query;
        const { from, to } = getDateRange(dateFrom, dateTo);

        const db = request.tenantDb;

        type CityRow = {
          city: string | null;
          delivery_count: bigint;
          on_time_count: bigint;
          avg_variance_minutes: number | null;
        };

        const rows = await db.$queryRaw<CityRow[]>`
          SELECT
            o.city,
            COUNT(rs.id)::bigint                          AS delivery_count,
            COUNT(
              CASE
                WHEN rs.actual_arrival IS NOT NULL
                 AND rs.estimated_arrival IS NOT NULL
                 AND rs.actual_arrival <= rs.estimated_arrival
                THEN 1
              END
            )::bigint                                      AS on_time_count,
            AVG(
              CASE
                WHEN rs.actual_arrival IS NOT NULL AND rs.estimated_arrival IS NOT NULL
                THEN EXTRACT(EPOCH FROM (rs.actual_arrival - rs.estimated_arrival)) / 60.0
              END
            )                                              AS avg_variance_minutes
          FROM route_stops rs
          JOIN routes r ON r.id = rs.route_id
          JOIN orders o ON o.id = rs.order_id
          WHERE r.date BETWEEN ${from} AND ${to}
            AND rs.status = 'COMPLETED'
            AND rs.actual_arrival IS NOT NULL
            AND o.city IS NOT NULL
          GROUP BY o.city
          ORDER BY delivery_count DESC
          LIMIT 60
        `;

        const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
          "New York": { lat: 40.7128, lng: -74.006 },
          "New York City": { lat: 40.7128, lng: -74.006 },
          "Los Angeles": { lat: 34.0522, lng: -118.2437 },
          "Chicago": { lat: 41.8781, lng: -87.6298 },
          "Houston": { lat: 29.7604, lng: -95.3698 },
          "Phoenix": { lat: 33.4484, lng: -112.074 },
          "Philadelphia": { lat: 39.9526, lng: -75.1652 },
          "San Antonio": { lat: 29.4241, lng: -98.4936 },
          "San Diego": { lat: 32.7157, lng: -117.1611 },
          "Dallas": { lat: 32.7767, lng: -96.797 },
          "San Francisco": { lat: 37.7749, lng: -122.4194 },
          "Austin": { lat: 30.2672, lng: -97.7431 },
          "Seattle": { lat: 47.6062, lng: -122.3321 },
          "Denver": { lat: 39.7392, lng: -104.9903 },
          "Boston": { lat: 42.3601, lng: -71.0589 },
          "Nashville": { lat: 36.1627, lng: -86.7816 },
          "Miami": { lat: 25.7617, lng: -80.1918 },
          "Atlanta": { lat: 33.749, lng: -84.388 },
          "Minneapolis": { lat: 44.9778, lng: -93.265 },
          "Portland": { lat: 45.5231, lng: -122.6765 },
          "Las Vegas": { lat: 36.1699, lng: -115.1398 },
          "Sacramento": { lat: 38.5816, lng: -121.4944 },
          "Kansas City": { lat: 39.0997, lng: -94.5786 },
          "Columbus": { lat: 39.9612, lng: -82.9988 },
          "Charlotte": { lat: 35.2271, lng: -80.8431 },
          "Indianapolis": { lat: 39.7684, lng: -86.1581 },
          "San Jose": { lat: 37.3382, lng: -121.8863 },
          "Jacksonville": { lat: 30.3322, lng: -81.6557 },
          "Fort Worth": { lat: 32.7555, lng: -97.3308 },
          "Memphis": { lat: 35.1495, lng: -90.0490 },
          "Baltimore": { lat: 39.2904, lng: -76.6122 },
          "Louisville": { lat: 38.2527, lng: -85.7585 },
          "Milwaukee": { lat: 43.0389, lng: -87.9065 },
          "Albuquerque": { lat: 35.0844, lng: -106.6504 },
          "Tucson": { lat: 32.2226, lng: -110.9747 },
          "Fresno": { lat: 36.7378, lng: -119.7871 },
          "Mesa": { lat: 33.4152, lng: -111.8315 },
          "Omaha": { lat: 41.2565, lng: -95.9345 },
          "Cleveland": { lat: 41.4993, lng: -81.6944 },
          "Raleigh": { lat: 35.7796, lng: -78.6382 },
          "Colorado Springs": { lat: 38.8339, lng: -104.8214 },
          "Oakland": { lat: 37.8044, lng: -122.2712 },
          "Tulsa": { lat: 36.154, lng: -95.9928 },
          "Tampa": { lat: 27.9506, lng: -82.4572 },
          "New Orleans": { lat: 29.9511, lng: -90.0715 },
          "Wichita": { lat: 37.6872, lng: -97.3301 },
          "Arlington": { lat: 32.7357, lng: -97.1081 },
          "Bakersfield": { lat: 35.3733, lng: -119.0187 },
          "Aurora": { lat: 39.7294, lng: -104.8319 },
          "Anaheim": { lat: 33.8366, lng: -117.9143 },
          "Santa Ana": { lat: 33.7455, lng: -117.8677 },
          "Corpus Christi": { lat: 27.8006, lng: -97.3964 },
          "Riverside": { lat: 33.9533, lng: -117.3962 },
          "Lexington": { lat: 38.0406, lng: -84.5037 },
          "Pittsburgh": { lat: 40.4406, lng: -79.9959 },
          "Anchorage": { lat: 61.2181, lng: -149.9003 },
          "Stockton": { lat: 37.9577, lng: -121.2908 },
          "Cincinnati": { lat: 39.1031, lng: -84.512 },
          "Saint Paul": { lat: 44.9537, lng: -93.09 },
          "Toronto": { lat: 43.6532, lng: -79.3832 },
          "Montreal": { lat: 45.5017, lng: -73.5673 },
          "London": { lat: 51.5074, lng: -0.1278 },
          "Paris": { lat: 48.8566, lng: 2.3522 },
          "Berlin": { lat: 52.52, lng: 13.405 },
          "Dubai": { lat: 25.2048, lng: 55.2708 },
          "Singapore": { lat: 1.3521, lng: 103.8198 },
          "Sydney": { lat: -33.8688, lng: 151.2093 },
          "Melbourne": { lat: -37.8136, lng: 144.9631 },
          "Tokyo": { lat: 35.6762, lng: 139.6503 },
          "Seoul": { lat: 37.5665, lng: 126.978 },
          "Mumbai": { lat: 19.076, lng: 72.8777 },
          "Delhi": { lat: 28.7041, lng: 77.1025 },
          "Shanghai": { lat: 31.2304, lng: 121.4737 },
          "Beijing": { lat: 39.9042, lng: 116.4074 },
          "Cairo": { lat: 30.0444, lng: 31.2357 },
          "Riyadh": { lat: 24.6877, lng: 46.7219 },
          "Istanbul": { lat: 41.0082, lng: 28.9784 },
          "Amsterdam": { lat: 52.3676, lng: 4.9041 },
          "Madrid": { lat: 40.4168, lng: -3.7038 },
          "Barcelona": { lat: 41.3851, lng: 2.1734 },
          "Rome": { lat: 41.9028, lng: 12.4964 },
        };

        const points = rows
          .filter((r) => r.city && CITY_COORDS[r.city])
          .map((r) => {
            const coords = CITY_COORDS[r.city!]!;
            const count = Number(r.delivery_count);
            const onTimeCount = Number(r.on_time_count);
            return {
              city: r.city!,
              lat: coords.lat,
              lng: coords.lng,
              deliveryCount: count,
              onTimePercentage: count > 0 ? Math.round((onTimeCount / count) * 10000) / 100 : 0,
              avgVarianceMinutes: r.avg_variance_minutes !== null ? Math.round(r.avg_variance_minutes * 10) / 10 : 0,
            };
          });

        return reply.send({
          data: points,
          dateRange: { from: from.toISOString(), to: to.toISOString() },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid query parameters" });
        }
        fastify.log.error(error, "route-performance geo error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}

export default routePerformanceRoutes;
