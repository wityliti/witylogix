/**
 * Traffic API Routes
 *
 * Endpoints:
 * - GET /traffic/eta - Calculate traffic-aware ETA
 * - GET /traffic/route - Get route with traffic overlay
 * - GET /traffic/matrix - Distance matrix with traffic
 * - GET /traffic/conditions - Area traffic conditions
 * - GET /traffic/incidents - Traffic incidents in area
 * - POST /traffic/optimal-departure - Find best departure time
 *
 * All endpoints use Zod for request validation.
 */

import { Router } from 'express';
import { z } from 'zod';
import { TrafficProvider } from '@witylogix/core/integrations/traffic/index.js';
import type { Request, Response, NextFunction } from 'express';

/**
 * Initialize traffic routes
 */
export function initializeTrafficRoutes(router: Router, trafficProvider: TrafficProvider): void {
  // Validation schemas
  const coordinateSchema = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  });

  const etaRequestSchema = z.object({
    origin: coordinateSchema,
    destination: coordinateSchema,
    departureTime: z.string().datetime().optional(),
    alternatives: z.boolean().optional(),
    travelMode: z.enum(['driving', 'bicycling', 'transit', 'walking']).optional(),
    avoidTolls: z.boolean().optional(),
    avoidHighways: z.boolean().optional(),
    avoidFerries: z.boolean().optional(),
  });

  const boundingBoxSchema = z.object({
    ne: coordinateSchema,
    sw: coordinateSchema,
  });

  const matrixRequestSchema = z.object({
    origins: z.array(coordinateSchema),
    destinations: z.array(coordinateSchema),
    travelMode: z.enum(['driving', 'bicycling', 'transit', 'walking']).optional(),
    departureTime: z.string().datetime().optional(),
  });

  const optimalDepartureSchema = z.object({
    origin: coordinateSchema,
    destination: coordinateSchema,
    windowStart: z.string().datetime(),
    windowEnd: z.string().datetime(),
    interval: z.number().min(5).max(60).optional(),
  });

  /**
   * Validate request body against schema
   */
  const validateRequest = <T extends z.ZodSchema>(schema: T) => {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        req.body = schema.parse(req.body);
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            error: 'Invalid request',
            details: error.errors,
          });
        } else {
          res.status(400).json({ error: 'Invalid request' });
        }
      }
    };
  };

  /**
   * GET /traffic/eta
   *
   * Calculate traffic-aware ETA between two points
   *
   * Query parameters:
   * - origin: {lat, lng} - Starting location
   * - destination: {lat, lng} - Ending location
   * - departureTime: ISO 8601 - Departure time (optional, defaults to now)
   * - alternatives: boolean - Return alternative routes
   * - travelMode: string - driving|bicycling|transit|walking
   */
  router.get('/traffic/eta', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        origin: z.string().transform((str) => JSON.parse(str)),
        destination: z.string().transform((str) => JSON.parse(str)),
        departureTime: z.string().datetime().optional(),
        alternatives: z.string().transform((val) => val === 'true').optional(),
        travelMode: z.enum(['driving', 'bicycling', 'transit', 'walking']).optional(),
        avoidTolls: z.string().transform((val) => val === 'true').optional(),
        avoidHighways: z.string().transform((val) => val === 'true').optional(),
        avoidFerries: z.string().transform((val) => val === 'true').optional(),
      });

      const params = schema.parse(req.query);

      const result = await trafficProvider.getTrafficAwareETA({
        origin: params.origin as { lat: number; lng: number },
        destination: params.destination as { lat: number; lng: number },
        departureTime: params.departureTime ? new Date(params.departureTime) : undefined,
        alternatives: params.alternatives,
        travelMode: params.travelMode,
        avoidTolls: params.avoidTolls,
        avoidHighways: params.avoidHighways,
        avoidFerries: params.avoidFerries,
      });

      res.json({
        success: true,
        data: {
          route: {
            distance_km: result.route.distance_km,
            duration_min: result.route.duration_min,
            duration_in_traffic_min: result.route.duration_in_traffic_min,
            bounds: result.route.bounds,
          },
          traffic_impact: result.traffic_impact,
          provider: result.provider,
          timestamp: result.timestamp,
          confidence: result.confidence,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to calculate ETA',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /traffic/route
   *
   * Get detailed route with traffic-aware timing and polyline
   *
   * Query parameters: same as /eta
   */
  router.get('/traffic/route', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        origin: z.string().transform((str) => JSON.parse(str)),
        destination: z.string().transform((str) => JSON.parse(str)),
        departureTime: z.string().datetime().optional(),
        alternatives: z.string().transform((val) => val === 'true').optional(),
      });

      const params = schema.parse(req.query);

      const result = await trafficProvider.getTrafficAwareETA({
        origin: params.origin as { lat: number; lng: number },
        destination: params.destination as { lat: number; lng: number },
        departureTime: params.departureTime ? new Date(params.departureTime) : undefined,
        alternatives: params.alternatives,
      });

      res.json({
        success: true,
        data: {
          route: result.route,
          traffic_impact: result.traffic_impact,
          provider: result.provider,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get route',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /traffic/matrix
   *
   * Get distance matrix for multiple origins and destinations
   *
   * Query parameters:
   * - origins: JSON array of {lat, lng}
   * - destinations: JSON array of {lat, lng}
   * - departureTime: ISO 8601 (optional)
   */
  router.get('/traffic/matrix', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        origins: z.string().transform((str) => JSON.parse(str)),
        destinations: z.string().transform((str) => JSON.parse(str)),
        departureTime: z.string().datetime().optional(),
      });

      const params = schema.parse(req.query);

      // Note: TrafficProvider uses getRoute for single pairs
      // For matrix, would need to call multiple times or extend provider
      const results = [];

      for (const origin of params.origins as Array<{ lat: number; lng: number }>) {
        for (const destination of params.destinations as Array<{ lat: number; lng: number }>) {
          try {
            const result = await trafficProvider.getTrafficAwareETA({
              origin,
              destination,
              departureTime: params.departureTime ? new Date(params.departureTime) : undefined,
            });

            results.push({
              origin,
              destination,
              distance_km: result.route.distance_km,
              duration_min: result.route.duration_min,
              duration_in_traffic_min: result.route.duration_in_traffic_min,
            });
          } catch {
            results.push({
              origin,
              destination,
              error: 'Failed to calculate',
            });
          }
        }
      }

      res.json({
        success: true,
        data: {
          matrix: results,
          count: results.length,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get distance matrix',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /traffic/conditions
   *
   * Get traffic conditions for a bounding box area
   *
   * Query parameters:
   * - ne: {lat, lng} - Northeast corner
   * - sw: {lat, lng} - Southwest corner
   */
  router.get('/traffic/conditions', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        ne: z.string().transform((str) => JSON.parse(str)),
        sw: z.string().transform((str) => JSON.parse(str)),
      });

      const params = schema.parse(req.query);

      const result = await trafficProvider.getTrafficOverlay({
        ne: params.ne as { lat: number; lng: number },
        sw: params.sw as { lat: number; lng: number },
      });

      res.json({
        success: true,
        data: {
          timestamp: result.timestamp,
          flow_segments: result.flow_segments.slice(0, 100), // Limit response size
          incident_count: result.incidents.length,
          incidents: result.incidents.slice(0, 20),
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get traffic conditions',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /traffic/incidents
   *
   * Get traffic incidents in a bounding box
   *
   * Query parameters: same as /conditions
   */
  router.get('/traffic/incidents', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        ne: z.string().transform((str) => JSON.parse(str)),
        sw: z.string().transform((str) => JSON.parse(str)),
      });

      const params = schema.parse(req.query);

      const result = await trafficProvider.getTrafficOverlay({
        ne: params.ne as { lat: number; lng: number },
        sw: params.sw as { lat: number; lng: number },
      });

      res.json({
        success: true,
        data: {
          incidents: result.incidents,
          count: result.incidents.length,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get incidents',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /traffic/optimal-departure
   *
   * Find optimal departure time within a time window
   *
   * Request body:
   * {
   *   origin: {lat, lng},
   *   destination: {lat, lng},
   *   windowStart: ISO 8601,
   *   windowEnd: ISO 8601,
   *   interval: number (minutes, optional, default 15)
   * }
   */
  router.post('/traffic/optimal-departure', async (req: Request, res: Response) => {
    try {
      const params = optimalDepartureSchema.parse(req.body);

      const result = await trafficProvider.getBestDepartureTime(
        {
          origin: params.origin,
          destination: params.destination,
        },
        {
          start: new Date(params.windowStart),
          end: new Date(params.windowEnd),
          interval: params.interval,
        },
      );

      res.json({
        success: true,
        data: {
          optimal_departure: result.optimal_departure,
          expected_eta: result.expected_eta,
          expected_duration_min: result.expected_duration_min,
          traffic_delay_min: result.traffic_delay_min,
          confidence: result.confidence,
          alternatives: result.alternatives,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          error: 'Failed to calculate optimal departure',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  /**
   * GET /traffic/health
   *
   * Get provider health status
   */
  router.get('/traffic/health', (_req: Request, res: Response) => {
    const health = trafficProvider.getProviderHealth();
    res.json({
      success: true,
      data: {
        providers: health,
      },
    });
  });

  /**
   * GET /traffic/stats
   *
   * Get service statistics
   */
  router.get('/traffic/stats', (_req: Request, res: Response) => {
    const stats = trafficProvider.getStats();
    res.json({
      success: true,
      data: stats,
    });
  });
}

/**
 * Create and export traffic router
 */
export function createTrafficRouter(trafficProvider: TrafficProvider): Router {
  const router = Router();
  initializeTrafficRoutes(router, trafficProvider);
  return router;
}
