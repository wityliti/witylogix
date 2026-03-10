/**
 * AI Analytics API Routes
 *
 * Routes:
 *   GET    /api/ai/analytics/route-efficiency/:routeId              Route efficiency score
 *   GET    /api/ai/analytics/driver-score/:driverId                Driver performance score
 *   POST   /api/ai/analytics/predict-delivery                      Predict delivery time
 *   GET    /api/ai/analytics/anomalies/:routeId                   Route anomalies
 *   GET    /api/ai/analytics/co2/:routeId                         Route CO2 report
 *   GET    /api/ai/analytics/co2/summary/:tenantId                CO2 tenant summary
 *   GET    /api/ai/analytics/leaderboard                          Driver leaderboard
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { tenantContext } from '../../middleware/tenant.js';
import {
  calculateRouteEfficiency,
  calculateDriverScore,
  calculateDriverScoreBatch,
  predictDeliveryWindow,
  detectAnomalies,
  calculateCO2,
  getCO2Summary,
  type RouteDataPoint,
  type PlannedRouteSegment,
  type Stop,
  type DriverMetrics,
  type DeliveryContext,
} from '@witylogix/core/ai-analytics';

// ─── Zod Schemas ────────────────────────────────────────────

const coordSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const stopSchema = z.object({
  id: z.string(),
  lat: z.number(),
  lng: z.number(),
  plannedArrivalTime: z.number(),
  plannedDuration: z.number(),
  actualArrivalTime: z.number().optional(),
  actualDuration: z.number().optional(),
  orderId: z.string(),
  type: z.enum(['delivery', 'pickup', 'service']),
});

const routeDataPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  timestamp: z.number(),
  speedKmh: z.number().optional(),
});

const routeEfficiencySchema = z.object({
  routeId: z.string(),
  plannedDistance: z.number().positive(),
  plannedDuration: z.number().positive(),
  plannedStops: z.array(stopSchema),
  actualDistance: z.number().positive(),
  actualDuration: z.number().positive(),
  gpsTrace: z.array(routeDataPointSchema),
});

const driverScoreSchema = z.object({
  driverId: z.string(),
  dateStart: z.number().int(),
  dateEnd: z.number().int(),
  totalDeliveries: z.number().nonnegative(),
  onTimeDeliveries: z.number().nonnegative(),
  firstAttemptSuccessful: z.number().nonnegative(),
  averageCustomerRating: z.number().min(0).max(5),
  averageRouteEfficiency: z.number().min(0).max(100),
  percentSpeedCompliant: z.number().min(0).max(100),
  zoneId: z.string().optional(),
});

const predictDeliverySchema = z.object({
  orderId: z.string(),
  distanceRemaining: z.number().positive(),
  currentTrafficFactor: z.number().min(0.5).max(3.0),
  driverHistoricalSpeed: z.number().positive(),
  timeOfDay: z.number().min(0).max(23),
  dayOfWeek: z.number().min(0).max(6),
  stopComplexity: z.enum(['house', 'apartment', 'business', 'warehouse']),
  weather: z
    .object({
      condition: z.enum(['clear', 'rain', 'snow', 'fog']),
      temperature: z.number(),
    })
    .optional(),
});

const anomalyDetectionSchema = z.object({
  routeId: z.string(),
  stops: z.array(stopSchema),
  gpsTrace: z.array(routeDataPointSchema),
  driverHistoricalStopDurations: z.array(z.number()).optional(),
});

const co2CalculationSchema = z.object({
  routeId: z.string(),
  distance: z.number().positive(),
  duration: z.number().positive(),
  idleTime: z.number().nonnegative(),
  vehicleType: z.enum(['van', 'truck', 'bike', 'ev']),
  terrainType: z.enum(['city', 'highway', 'suburban', 'rural']).optional(),
});

// ─── Route Plugin ───────────────────────────────────────────

export default async function aiAnalyticsRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // All routes require authentication + tenant context
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── GET /api/ai/analytics/route-efficiency/:routeId ────────────

  /**
   * Calculate route efficiency score with breakdown
   */
  fastify.get<{ Params: { routeId: string } }>(
    '/route-efficiency/:routeId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { routeId } = request.params;

        // In production, fetch from database
        const mockRoute = {
          routeId,
          plannedDistance: 45000, // 45km
          plannedDuration: 120, // 120 minutes
          plannedStops: [
            {
              id: 'stop_1',
              lat: 40.7128,
              lng: -74.006,
              plannedArrivalTime: 1000,
              plannedDuration: 5,
              actualArrivalTime: 1050,
              actualDuration: 7,
              orderId: 'ord_1',
              type: 'delivery' as const,
            },
            {
              id: 'stop_2',
              lat: 40.7480,
              lng: -73.9862,
              plannedArrivalTime: 2000,
              plannedDuration: 5,
              actualArrivalTime: 2100,
              actualDuration: 8,
              orderId: 'ord_2',
              type: 'delivery' as const,
            },
          ],
          gpsTrace: [
            { lat: 40.7128, lng: -74.006, timestamp: 1000, speedKmh: 30 },
            { lat: 40.715, lng: -73.995, timestamp: 2000, speedKmh: 35 },
            { lat: 40.7480, lng: -73.9862, timestamp: 3000, speedKmh: 25 },
          ],
        };

        const efficiency = calculateRouteEfficiency(
          mockRoute.routeId,
          {
            plannedDistance: mockRoute.plannedDistance,
            plannedDuration: mockRoute.plannedDuration,
            plannedStops: mockRoute.plannedStops as Stop[],
          } as PlannedRouteSegment,
          mockRoute.gpsTrace as RouteDataPoint[],
        );

        return reply.code(200).send({
          data: efficiency,
          routeId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to calculate efficiency' });
      }
    },
  );

  // ── GET /api/ai/analytics/driver-score/:driverId ────────────────

  /**
   * Calculate driver performance score with trends and peer comparison
   */
  fastify.get<{ Params: { driverId: string } }>(
    '/driver-score/:driverId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { driverId } = request.params;

        // Mock driver metrics (in production, fetch from database)
        const mockMetrics: DriverMetrics = {
          driverId,
          dateRange: {
            start: Date.now() - 7 * 24 * 60 * 60 * 1000,
            end: Date.now(),
          },
          deliveries: {
            totalCount: 45,
            onTimeCount: 41,
            firstAttemptSuccessCount: 43,
          },
          ratings: {
            average: 4.6,
            count: 42,
          },
          routeEfficiency: {
            average: 87,
            count: 45,
          },
          speedCompliance: {
            percentWithinLimit: 92,
            averageExcessKmh: 3,
          },
          zoneId: 'zone_1',
        };

        // Mock historical scores for trend analysis
        const historicalScores = [78, 80, 82, 84, 85];

        const score = calculateDriverScore(
          mockMetrics,
          {},
          historicalScores,
        );

        return reply.code(200).send({
          data: score,
          driverId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to calculate driver score' });
      }
    },
  );

  // ── POST /api/ai/analytics/predict-delivery ──────────────────────

  /**
   * Predict delivery arrival time
   */
  fastify.post<{ Body: z.infer<typeof predictDeliverySchema> }>(
    '/predict-delivery',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = predictDeliverySchema.parse(request.body);

        const context: DeliveryContext = {
          orderId: body.orderId,
          distanceRemaining: body.distanceRemaining,
          currentTrafficFactor: body.currentTrafficFactor,
          driverHistoricalSpeed: body.driverHistoricalSpeed,
          timeOfDay: body.timeOfDay,
          dayOfWeek: body.dayOfWeek,
          stopComplexity: body.stopComplexity,
          weather: body.weather,
        };

        const prediction = predictDeliveryWindow(context);

        return reply.code(200).send({
          data: prediction,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Invalid request body' });
        }
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to predict delivery' });
      }
    },
  );

  // ── GET /api/ai/analytics/anomalies/:routeId ─────────────────────

  /**
   * Detect anomalies on a route
   */
  fastify.get<{ Params: { routeId: string } }>(
    '/anomalies/:routeId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { routeId } = request.params;

        // Mock route data
        const mockRoute = {
          routeId,
          stops: [
            {
              id: 'stop_1',
              lat: 40.7128,
              lng: -74.006,
              plannedArrivalTime: 1000000,
              plannedDuration: 5,
              actualArrivalTime: 1000050,
              actualDuration: 20, // Unusually long
              orderId: 'ord_1',
              type: 'delivery' as const,
            },
            {
              id: 'stop_2',
              lat: 40.7480,
              lng: -73.9862,
              plannedArrivalTime: 2000000,
              plannedDuration: 5,
              actualArrivalTime: 3000000, // Large gap
              actualDuration: 5,
              orderId: 'ord_2',
              type: 'delivery' as const,
            },
          ],
          gpsTrace: [
            { lat: 40.7128, lng: -74.006, timestamp: 1000000, speedKmh: 30 },
            { lat: 40.715, lng: -73.995, timestamp: 2000000, speedKmh: 35 },
            { lat: 40.7480, lng: -73.9862, timestamp: 3000000, speedKmh: 25 },
          ],
          driverHistoricalStopDurations: [3, 4, 5, 4, 3, 5, 4],
        };

        const result = detectAnomalies(mockRoute);

        return reply.code(200).send({
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to detect anomalies' });
      }
    },
  );

  // ── GET /api/ai/analytics/co2/:routeId ───────────────────────────

  /**
   * Calculate CO2 report for a route
   */
  fastify.get<{ Params: { routeId: string } }>(
    '/co2/:routeId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { routeId } = request.params;

        // Mock route data
        const report = calculateCO2(
          routeId,
          45000, // 45km
          120, // 120 minutes
          15, // 15 minutes idle
          'van',
          'suburban',
        );

        return reply.code(200).send({
          data: report,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to calculate CO2' });
      }
    },
  );

  // ── GET /api/ai/analytics/co2/summary ────────────────────────────

  /**
   * Get tenant-wide CO2 summary
   */
  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    '/co2/summary/:tenantId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = (request.params as any).tenantId || 'default';
        const startDate = request.query.startDate || '2026-03-01';
        const endDate = request.query.endDate || '2026-03-31';

        const summary = getCO2Summary(tenantId, startDate, endDate);

        return reply.code(200).send({
          data: summary,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to get CO2 summary' });
      }
    },
  );

  // ── GET /api/ai/analytics/leaderboard ────────────────────────────

  /**
   * Get driver leaderboard
   */
  fastify.get<{
    Querystring: { period?: '24h' | '7d' | '30d'; zoneId?: string };
  }>(
    '/leaderboard',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const period = (request.query.period as any) || '7d';
        const zoneId = request.query.zoneId;

        // Mock multiple drivers
        const driverIds = ['driver_1', 'driver_2', 'driver_3', 'driver_4', 'driver_5'];
        const driverMetricsArray = driverIds.map((driverId) => ({
          metrics: {
            driverId,
            dateRange: {
              start: Date.now() - 7 * 24 * 60 * 60 * 1000,
              end: Date.now(),
            },
            deliveries: {
              totalCount: 45 + Math.floor(Math.random() * 20),
              onTimeCount: 38 + Math.floor(Math.random() * 10),
              firstAttemptSuccessCount: 42 + Math.floor(Math.random() * 5),
            },
            ratings: {
              average: 4.2 + Math.random(),
              count: 42,
            },
            routeEfficiency: {
              average: 80 + Math.random() * 15,
              count: 45,
            },
            speedCompliance: {
              percentWithinLimit: 85 + Math.random() * 15,
              averageExcessKmh: 2 + Math.random() * 3,
            },
            zoneId: zoneId || 'zone_1',
          } as DriverMetrics,
          historicalScores: [75, 78, 80, 82, 85],
        }));

        const result = calculateDriverScoreBatch(driverMetricsArray);

        // Convert to leaderboard format
        const leaderboard = result.scores
          .map((score, idx) => ({
            rank: idx + 1,
            driverId: score.driverId,
            driverName: `Driver ${idx + 1}`,
            compositeScore: score.compositeScore,
            onTimePercent: score.breakdown.onTimeDeliveryRate,
            routeEfficiencyAvg: score.breakdown.routeEfficiencyAverage,
            customerRatingAvg: score.breakdown.customerRatingAverage,
            deliverySuccessPercent: score.breakdown.deliverySuccessRate,
            badge: score.badges[0],
            trend: score.trendAnalysis.direction,
            trendPercent: score.trendAnalysis.changePercent,
          }))
          .sort((a, b) => b.compositeScore - a.compositeScore);

        return reply.code(200).send({
          data: {
            period,
            entries: leaderboard,
            generatedAt: Date.now(),
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to get leaderboard' });
      }
    },
  );
}
