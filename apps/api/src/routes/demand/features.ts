/**
 * Demand Prediction Feature Store API Routes
 *
 * Provides endpoints for accessing demand prediction features,
 * zone profiles, and triggering feature aggregation jobs.
 */

import { Router, type Request, type Response } from 'express';
import { validateRequest } from '../../middleware/validation.js';
import { authenticateRequest } from '../../middleware/auth.js';
import { ZoneFeatureStore, VersionedFeatureStore } from '@repo/core/demand-prediction/feature-store';
import { DataAggregator } from '@repo/core/demand-prediction/data-aggregator';
import { ZoneProfiler } from '@repo/core/demand-prediction/zone-profiler';
import { HolidayCalendar } from '@repo/core/demand-prediction/holiday-calendar';
import { TimeSeriesExtractor } from '@repo/core/demand-prediction/time-series-extractor';
import type { PrismaClient } from '@repo/db';

export function createDemandFeaturesRouter(prisma: PrismaClient): Router {
  const router = Router();
  const featureStore = new VersionedFeatureStore(prisma, 3600000); // 1 hour TTL
  const aggregator = new DataAggregator(prisma);
  const profiler = new ZoneProfiler(aggregator);
  const calendar = new HolidayCalendar();
  const extractor = new TimeSeriesExtractor();

  /**
   * GET /demand/features/:zoneId
   * Get feature vector for a specific zone
   */
  router.get(
    '/demand/features/:zoneId',
    authenticateRequest,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { zoneId } = req.params;

        const features = await featureStore.getZoneFeatures(zoneId);

        if (!features) {
          res.status(404).json({ error: 'Zone not found' });
          return;
        }

        res.json({
          success: true,
          data: features,
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /demand/features
   * Get features for multiple zones (batch)
   */
  router.get(
    '/demand/features',
    authenticateRequest,
    validateRequest({
      query: {
        zoneIds: { type: 'string', required: true }, // Comma-separated IDs
      },
    }),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const zoneIds = (req.query.zoneIds as string).split(',').map(z => z.trim());

        const featureMap = await featureStore.getZoneFeaturesMultiple(zoneIds);
        const features = Array.from(featureMap.values());

        res.json({
          success: true,
          data: features,
          count: features.length,
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /demand/features/:zoneId/timeseries
   * Get time series data for a zone
   */
  router.get(
    '/demand/features/:zoneId/timeseries',
    authenticateRequest,
    validateRequest({
      query: {
        metric: { type: 'string', required: true }, // 'deliveries', 'delivery_time', etc.
        granularity: { type: 'string', default: 'daily' }, // 'hourly', 'daily', 'weekly'
        days: { type: 'integer', default: 30 },
      },
    }),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { zoneId } = req.params;
        const { metric, granularity, days } = req.query as Record<string, any>;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        let data: Array<{ timestamp: Date; value: number }> = [];

        // In production, fetch actual data from DB
        if (metric === 'deliveries') {
          data = await generateMockTimeSeries(startDate, new Date(), days);
        } else if (metric === 'delivery_time') {
          data = await generateMockDeliveryTimeTimeSeries(startDate, new Date(), days);
        }

        const timeSeries = extractor.extractTimeSeries(data, granularity as any);

        res.json({
          success: true,
          data: {
            zoneId,
            metric,
            granularity,
            timeSeries: timeSeries.map(p => ({
              timestamp: p.timestamp,
              value: p.value,
            })),
          },
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /demand/zones/profiles
   * Get profiles for all zones in shop
   */
  router.get(
    '/demand/zones/profiles',
    authenticateRequest,
    validateRequest({
      query: {
        lookbackDays: { type: 'integer', default: 90 },
      },
    }),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { lookbackDays } = req.query;
        const shopId = (req as any).user?.shopId; // From auth middleware

        if (!shopId) {
          res.status(401).json({ error: 'Shop ID not found' });
          return;
        }

        // In production, fetch actual zone IDs from DB
        const mockZoneIds = ['zone_1', 'zone_2', 'zone_3'];
        const profiles = [];

        for (const zoneId of mockZoneIds) {
          const profile = await profiler.profileZone(zoneId, lookbackDays as number);
          profiles.push(profile);
        }

        res.json({
          success: true,
          data: profiles,
          count: profiles.length,
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /demand/zones/:zoneId/profile
   * Get profile for a specific zone
   */
  router.get(
    '/demand/zones/:zoneId/profile',
    authenticateRequest,
    validateRequest({
      query: {
        lookbackDays: { type: 'integer', default: 90 },
      },
    }),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { zoneId } = req.params;
        const { lookbackDays } = req.query;

        const profile = await profiler.profileZone(zoneId, lookbackDays as number);

        res.json({
          success: true,
          data: profile,
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /demand/zones/:zoneId/similar
   * Get similar zones (for cold-start predictions)
   */
  router.get(
    '/demand/zones/:zoneId/similar',
    authenticateRequest,
    validateRequest({
      query: {
        topK: { type: 'integer', default: 5 },
        lookbackDays: { type: 'integer', default: 90 },
      },
    }),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { zoneId } = req.params;
        const { topK, lookbackDays } = req.query;

        // Mock candidate zones
        const candidateZones = ['zone_1', 'zone_2', 'zone_3', 'zone_4', 'zone_5'];

        const similarZones = await profiler.findSimilarZones(
          zoneId,
          candidateZones,
          topK as number,
          lookbackDays as number
        );

        res.json({
          success: true,
          data: {
            targetZone: zoneId,
            similarZones,
          },
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * POST /demand/features/aggregate
   * Trigger aggregation job for zone features
   */
  router.post(
    '/demand/features/aggregate',
    authenticateRequest,
    validateRequest({
      body: {
        zoneIds: { type: 'array', required: true },
        lookbackDays: { type: 'integer', default: 90 },
      },
    }),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { zoneIds, lookbackDays } = req.body as {
          zoneIds: string[];
          lookbackDays: number;
        };

        const jobId = `agg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // In production, would queue this as a background job
        // For now, process synchronously (in real scenario, would be async)
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - lookbackDays);

        for (const zoneId of zoneIds) {
          const features = await featureStore.getZoneFeatures(zoneId);
          if (features) {
            features.lastUpdatedAt = new Date();
            await featureStore.saveZoneFeatures(features);
          }
        }

        res.json({
          success: true,
          data: {
            jobId,
            status: 'completed',
            processedZones: zoneIds.length,
            completedAt: new Date(),
          },
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /demand/calendar
   * Get holiday calendar for a country
   */
  router.get(
    '/demand/calendar',
    authenticateRequest,
    validateRequest({
      query: {
        country: { type: 'string', default: 'US' },
        year: { type: 'integer', required: true },
      },
    }),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { country, year } = req.query as Record<string, any>;

        const holidays = calendar.getHolidaysForYear(country, year);

        res.json({
          success: true,
          data: {
            country,
            year,
            holidays: holidays.map(h => ({
              name: h.name,
              date: h.date,
              demandMultiplier: h.demandMultiplier,
              affectsNextDay: h.affectsNextDay,
            })),
            count: holidays.length,
          },
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * POST /demand/calendar/events
   * Register a custom special event
   */
  router.post(
    '/demand/calendar/events',
    authenticateRequest,
    validateRequest({
      body: {
        name: { type: 'string', required: true },
        startDate: { type: 'string', required: true },
        endDate: { type: 'string', required: true },
        demandMultiplier: { type: 'number', required: true },
        affectedZones: { type: 'array', default: undefined },
      },
    }),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { name, startDate, endDate, demandMultiplier, affectedZones } = req.body as any;

        const eventId = `event_${Date.now()}`;

        calendar.registerEvent({
          id: eventId,
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          demandMultiplier,
          affectedZones,
        });

        res.status(201).json({
          success: true,
          data: {
            id: eventId,
            name,
            startDate,
            endDate,
            demandMultiplier,
            affectedZones,
          },
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  /**
   * GET /demand/calendar/multiplier
   * Get demand multiplier for a specific date
   */
  router.get(
    '/demand/calendar/multiplier',
    authenticateRequest,
    validateRequest({
      query: {
        date: { type: 'string', required: true }, // ISO date string
        country: { type: 'string', default: 'US' },
        zoneId: { type: 'string', default: undefined },
      },
    }),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { date, country, zoneId } = req.query as Record<string, any>;

        const multiplier = calendar.computeDemandMultiplier(
          new Date(date),
          country,
          zoneId
        );

        const holiday = calendar.getHoliday(new Date(date), country);

        res.json({
          success: true,
          data: {
            date,
            demandMultiplier: multiplier,
            isHoliday: holiday !== null,
            holidayName: holiday?.name || null,
          },
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    }
  );

  return router;
}

/**
 * Generate mock time series data for testing
 */
async function generateMockTimeSeries(
  startDate: Date,
  endDate: Date,
  days: number
): Promise<Array<{ timestamp: Date; value: number }>> {
  const data: Array<{ timestamp: Date; value: number }> = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const baseValue = 1000 + Math.random() * 500;
    const trend = (current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) * 5;
    const seasonal = Math.sin((current.getDay() / 7) * Math.PI * 2) * 200;

    data.push({
      timestamp: new Date(current),
      value: Math.max(100, baseValue + trend + seasonal),
    });

    current.setDate(current.getDate() + 1);
  }

  return data;
}

/**
 * Generate mock delivery time series
 */
async function generateMockDeliveryTimeTimeSeries(
  startDate: Date,
  endDate: Date,
  days: number
): Promise<Array<{ timestamp: Date; value: number }>> {
  const data: Array<{ timestamp: Date; value: number }> = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const baseValue = 25 + Math.random() * 15;
    const hourEffect = Math.sin((current.getHours() / 24) * Math.PI * 2) * 5;

    data.push({
      timestamp: new Date(current),
      value: Math.max(10, baseValue + hourEffect),
    });

    current.setDate(current.getDate() + 1);
  }

  return data;
}
