/**
 * Route Optimization API — REST endpoints for route optimization.
 *
 * Exposes the route-optimizer core module via HTTP:
 *   POST   /optimize        Optimize a set of stops into delivery routes
 *   POST   /distance-matrix Compute distance matrix between geographic points
 *   POST   /eta             Calculate ETA for a route with stops
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  RouteOptimizer,
  computeDistanceMatrix,
  calculateETAFromMatrix,
  type RouteOptimizationRequest,
  type RouteOptimizationResult,
  type DistanceMatrix,
  type Stop,
  type GeoPoint,
  type OptimizationConstraints,
} from "@witylogix/core/route-optimizer";

// ─── Validation Schemas ─────────────────────────────────────────

/**
 * Geographic point schema.
 */
const geoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Stop schema for optimization.
 */
const stopSchema = z.object({
  id: z.string().min(1),
  location: geoPointSchema,
  serviceDuration: z.number().int().nonnegative(),
  priority: z.number().int().min(1).max(10),
  weight: z.number().nonnegative().optional(),
  volume: z.number().nonnegative().optional(),
  skills: z.array(z.string()).optional(),
  shipmentId: z.string().uuid().optional(),
  timeWindow: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
});

/**
 * Optimization constraints schema.
 */
const constraintsSchema = z.object({
  maxRouteDuration: z.number().int().positive().optional(),
  maxRouteDistance: z.number().int().positive().optional(),
  respectTimeWindows: z.boolean().default(true),
  minimizeVehicles: z.boolean().default(true),
  balanceWorkload: z.boolean().default(false),
  vehicleCapacityWeight: z.number().nonnegative().optional(),
  vehicleCapacityVolume: z.number().nonnegative().optional(),
  maxStopsPerVehicle: z.number().int().positive().optional(),
});

/**
 * Optimize route request schema.
 */
const optimizeRequestSchema = z.object({
  depot: geoPointSchema,
  stops: z.array(stopSchema).min(1),
  vehicleCount: z.number().int().min(1),
  constraints: constraintsSchema,
  algorithm: z.object({
    name: z.enum(["nearest-neighbor", "nearest-neighbor-2opt", "savings"]).default("nearest-neighbor"),
    maxIterations: z.number().int().positive().optional(),
    timeLimit: z.number().int().positive().optional(),
  }).optional(),
});

/**
 * Distance matrix request schema.
 */
const distanceMatrixRequestSchema = z.object({
  points: z.array(geoPointSchema).min(2),
  speedKmh: z.number().int().positive().default(60),
  trafficFactor: z.number().nonnegative().default(1.0),
});

/**
 * ETA calculation request schema.
 */
const etaRequestSchema = z.object({
  stops: z.array(stopSchema).min(1),
  departureTime: z.string().datetime(),
  speedKmh: z.number().int().positive().default(60),
  safetyBufferPercent: z.number().min(0).max(1).default(0.15),
  trafficFactor: z.number().nonnegative().default(1.0),
});

// ─── Route Plugin ───────────────────────────────────────────────

async function routeOptimizationRoutes(app: FastifyInstance): Promise<void> {
  // All routes require authentication and tenant context
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", tenantContext);

  const optimizer = new RouteOptimizer();

  // ── POST /optimize ──────────────────────────────────────────

  /**
   * Optimize a set of stops into delivery routes.
   *
   * Accepts a list of stops with constraints and vehicle count,
   * returns optimized routes with ETAs and metrics.
   */
  app.post("/optimize", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = optimizeRequestSchema.parse(request.body);

      // Convert time windows from ISO strings to Date objects
      const stopsWithDates = body.stops.map((stop) => ({
        ...stop,
        timeWindow: stop.timeWindow ? {
          start: new Date(stop.timeWindow.start),
          end: new Date(stop.timeWindow.end),
        } : undefined,
      }));

      const optimizationRequest: RouteOptimizationRequest = {
        depot: body.depot,
        stops: stopsWithDates as Stop[],
        vehicleCount: body.vehicleCount,
        constraints: body.constraints as OptimizationConstraints,
        algorithm: body.algorithm,
      };

      const result: RouteOptimizationResult = await optimizer.optimize(optimizationRequest);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: "Validation error",
          details: error.errors,
        });
      }

      request.log.error(error, "Route optimization failed");
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ── POST /distance-matrix ───────────────────────────────────

  /**
   * Compute distance matrix between geographic points.
   *
   * Calculates distances and travel durations between all point pairs.
   * Results are cached for subsequent requests.
   */
  app.post("/distance-matrix", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = distanceMatrixRequestSchema.parse(request.body);

      const matrix: DistanceMatrix = computeDistanceMatrix(
        body.points as GeoPoint[],
        body.speedKmh,
        body.trafficFactor,
      );

      return {
        success: true,
        data: matrix,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: "Validation error",
          details: error.errors,
        });
      }

      request.log.error(error, "Distance matrix computation failed");
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ── POST /eta ───────────────────────────────────────────────

  /**
   * Calculate ETA (Estimated Time of Arrival) for a route.
   *
   * Given a list of stops in order, calculates arrival times
   * considering service duration, traffic, and safety buffers.
   */
  app.post("/eta", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = etaRequestSchema.parse(request.body);

      // Convert time fields to Date objects
      const stopsWithDates = body.stops.map((stop) => ({
        ...stop,
        timeWindow: stop.timeWindow ? {
          start: new Date(stop.timeWindow.start),
          end: new Date(stop.timeWindow.end),
        } : undefined,
      }));

      const departureTime = new Date(body.departureTime);

      // Calculate ETA for each stop in the route
      const etas = await calculateETAFromMatrix(
        stopsWithDates as Stop[],
        departureTime,
        {
          speedKmh: body.speedKmh,
          safetyBufferPercent: body.safetyBufferPercent,
          confidence: 0.85, // Default confidence
          trafficFactor: body.trafficFactor,
        },
      );

      return {
        success: true,
        data: {
          departureTime,
          stops: stopsWithDates.map((stop, index) => ({
            ...stop,
            eta: etas[index] || null,
          })),
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: "Validation error",
          details: error.errors,
        });
      }

      request.log.error(error, "ETA calculation failed");
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });
}

export default routeOptimizationRoutes;
