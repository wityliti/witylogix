/**
 * ML ETA Engine v2 API Routes
 *
 * Routes:
 *   POST   /api/ai/eta-v2/predict              Single prediction
 *   POST   /api/ai/eta-v2/batch-predict        Batch predictions
 *   POST   /api/ai/eta-v2/train                Trigger model retraining
 *   GET    /api/ai/eta-v2/model-performance   Get accuracy metrics
 *   GET    /api/ai/eta-v2/feature-importance  Get feature importance
 *   POST   /api/ai/eta-v2/calibrate           Calibrate models
 *   GET    /api/ai/eta-v2/accuracy-report     Get comprehensive accuracy report
 *   GET    /api/ai/eta-v2/health              Health check
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { tenantContext } from "../../middleware/tenant.js";
import {
  EnsemblePredictor,
  featureExtractor,
  ModelPerformanceTracker,
  type HistoricalDelivery,
  type FeatureVector,
} from "@witylogix/core/ai-eta-v2";

// ─── Global Instances ───────────────────────────────────────────
// In production, these would be stored in a database/cache
const ensemblePredictors = new Map<string, EnsemblePredictor>();
const performanceTrackers = new Map<string, ModelPerformanceTracker>();

function getEnsemble(tenantId: string): EnsemblePredictor {
  if (!ensemblePredictors.has(tenantId)) {
    ensemblePredictors.set(tenantId, new EnsemblePredictor());
  }
  return ensemblePredictors.get(tenantId)!;
}

function getTracker(tenantId: string): ModelPerformanceTracker {
  if (!performanceTrackers.has(tenantId)) {
    performanceTrackers.set(tenantId, new ModelPerformanceTracker());
  }
  return performanceTrackers.get(tenantId)!;
}

// ─── Zod Schemas ────────────────────────────────────────────

const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const predictETASchema = z.object({
  distance_km: z.number().positive(),
  departure_time: z.string().datetime(),
  driver_experience_years: z.number().min(0).default(3),
  vehicle_type: z.enum(["bike", "car", "van", "truck"]).default("car"),
  num_stops_remaining: z.number().min(0).default(1),
  historical_avg_minutes: z.number().positive().default(30),
  weather_intensity: z.number().min(0).max(10).default(0),
  traffic_multiplier: z.number().min(0.8).max(3.0).default(1.0),
  temperature_celsius: z.number().default(20),
  wind_speed_kmh: z.number().min(0).default(0),
  precipitation_mm: z.number().min(0).default(0),
  origin_lat: z.number().default(0),
  origin_lng: z.number().default(0),
});

const batchPredictSchema = z.object({
  deliveries: z.array(predictETASchema).min(1).max(1000),
});

const trainSchema = z.object({
  historical_deliveries: z.array(
    z.object({
      delivery_id: z.string(),
      distance_km: z.number(),
      zone_type: z.enum([
        "urban-core",
        "urban",
        "suburban",
        "rural",
        "highway",
      ]),
      hour: z.number().min(0).max(23),
      day_of_week: z.number().min(0).max(6),
      is_holiday: z.boolean(),
      weather_condition: z.enum(["clear", "rain", "snow", "fog", "unknown"]),
      weather_intensity: z.number().min(0).max(10),
      traffic_condition: z.enum(["light", "moderate", "heavy", "unknown"]),
      driver_experience_score: z.number().min(0).max(1),
      vehicle_type: z.enum(["bike", "car", "van", "truck"]),
      num_stops: z.number().min(0),
      actual_duration_minutes: z.number().positive(),
      temperature_celsius: z.number(),
      wind_speed_kmh: z.number().min(0),
      precipitation_mm: z.number().min(0),
    }),
  ),
});

const calibrateSchema = z.object({
  predictions: z.array(z.number().positive()),
  actuals: z.array(z.number().positive()),
});

// ─── Route Plugin ───────────────────────────────────────────

export default async function aiETAV2Routes(
  fastify: FastifyInstance,
): Promise<void> {
  // All routes require authentication + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── POST /api/ai/eta-v2/predict — Single Prediction ────────────

  fastify.post<{ Body: z.infer<typeof predictETASchema> }>(
    "/predict",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = predictETASchema.parse(request.body);
      const tenantId = (request as any).tenantId || "default";

      try {
        const ensemble = getEnsemble(tenantId);
        const tracker = getTracker(tenantId);

        const features = featureExtractor.extractFeatures(
          body.distance_km,
          new Date(body.departure_time),
          body.driver_experience_years,
          body.vehicle_type,
          body.num_stops_remaining,
          body.historical_avg_minutes,
          body.weather_intensity,
          body.traffic_multiplier,
          body.temperature_celsius,
          body.wind_speed_kmh,
          body.precipitation_mm,
          body.origin_lat,
          body.origin_lng,
        );

        const prediction = ensemble.predict(features);

        // Record this prediction for tracking
        tracker.recordResult(
          "ensemble",
          prediction.predicted_duration_minutes,
          0, // Actual unknown at prediction time
        );

        return reply.send({
          success: true,
          prediction: {
            predicted_minutes: prediction.predicted_duration_minutes,
            confidence: prediction.confidence,
            lower_bound_minutes: prediction.lower_bound_minutes,
            upper_bound_minutes: prediction.upper_bound_minutes,
            p50_minutes: prediction.p50_minutes,
            dominant_model: prediction.dominant_model,
            model_predictions: prediction.model_predictions,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Error predicting ETA:");
        return reply.status(500).send({
          error: "Failed to predict ETA",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // ── POST /api/ai/eta-v2/batch-predict — Batch Predictions ──────

  fastify.post<{ Body: z.infer<typeof batchPredictSchema> }>(
    "/batch-predict",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = batchPredictSchema.parse(request.body);
      const tenantId = (request as any).tenantId || "default";

      try {
        const ensemble = getEnsemble(tenantId);
        const tracker = getTracker(tenantId);

        const startTime = Date.now();
        const predictions = [];

        for (const delivery of body.deliveries) {
          const features = featureExtractor.extractFeatures(
            delivery.distance_km,
            new Date(delivery.departure_time),
            delivery.driver_experience_years,
            delivery.vehicle_type,
            delivery.num_stops_remaining,
            delivery.historical_avg_minutes,
            delivery.weather_intensity,
            delivery.traffic_multiplier,
            delivery.temperature_celsius,
            delivery.wind_speed_kmh,
            delivery.precipitation_mm,
            delivery.origin_lat,
            delivery.origin_lng,
          );

          const prediction = ensemble.predict(features);
          predictions.push({
            predicted_minutes: prediction.predicted_duration_minutes,
            confidence: prediction.confidence,
            lower_bound_minutes: prediction.lower_bound_minutes,
            upper_bound_minutes: prediction.upper_bound_minutes,
            dominant_model: prediction.dominant_model,
          });

          tracker.recordResult(
            "ensemble",
            prediction.predicted_duration_minutes,
            0,
          );
        }

        const processingTimeMs = Date.now() - startTime;

        return reply.send({
          success: true,
          count: predictions.length,
          predictions,
          processing_time_ms: processingTimeMs,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Error in batch ETA prediction:");
        return reply.status(500).send({
          error: "Failed to predict batch ETAs",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // ── POST /api/ai/eta-v2/train — Trigger Retraining ────────────

  fastify.post<{ Body: z.infer<typeof trainSchema> }>(
    "/train",
    {
      preHandler: [requireRole("ADMIN")],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = trainSchema.parse(request.body);
      const tenantId = (request as any).tenantId || "default";

      try {
        const ensemble = getEnsemble(tenantId);

        // Convert to proper types
        const deliveries: HistoricalDelivery[] = body.historical_deliveries.map(
          (d) => ({
            delivery_id: d.delivery_id,
            distance_km: d.distance_km,
            zone_type: d.zone_type,
            hour: d.hour,
            day_of_week: d.day_of_week,
            is_holiday: d.is_holiday,
            weather_condition: d.weather_condition,
            weather_intensity: d.weather_intensity,
            traffic_condition: d.traffic_condition,
            driver_experience_score: d.driver_experience_score,
            vehicle_type: d.vehicle_type,
            num_stops: d.num_stops,
            actual_duration_minutes: d.actual_duration_minutes,
            timestamp: new Date(),
            temperature_celsius: 20,
            wind_speed_kmh: 0,
            precipitation_mm: 0,
          }),
        );

        ensemble.fit(deliveries);

        return reply.send({
          success: true,
          samples_trained: deliveries.length,
          message: "Models trained successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Error training models:");
        return reply.status(500).send({
          error: "Failed to train models",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // ── GET /api/ai/eta-v2/model-performance — Performance Metrics ──

  fastify.get(
    "/model-performance",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = (request as any).tenantId || "default";
      const { model_name } = request.query as { model_name?: string };

      try {
        const tracker = getTracker(tenantId);
        const metrics = tracker.getModelMetrics(model_name);

        return reply.send({
          success: true,
          metrics,
          count: metrics.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Error getting model performance:");
        return reply.status(500).send({
          error: "Failed to get model performance",
        });
      }
    },
  );

  // ── GET /api/ai/eta-v2/feature-importance — Feature Importance ──

  fastify.get(
    "/feature-importance",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = (request as any).tenantId || "default";

      try {
        const ensemble = getEnsemble(tenantId);
        const importance = ensemble.getFeatureImportance();

        // Sort by importance
        const sorted = Object.entries(importance)
          .sort(([, a], [, b]) => b - a)
          .map(([feature, importance]) => ({ feature, importance }));

        return reply.send({
          success: true,
          features: sorted,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Error getting feature importance:");
        return reply.status(500).send({
          error: "Failed to get feature importance",
        });
      }
    },
  );

  // ── POST /api/ai/eta-v2/calibrate — Calibrate Models ──────────

  fastify.post<{ Body: z.infer<typeof calibrateSchema> }>(
    "/calibrate",
    {
      preHandler: [requireRole("ADMIN")],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = calibrateSchema.parse(request.body);
      const tenantId = (request as any).tenantId || "default";

      try {
        if (body.predictions.length !== body.actuals.length) {
          return reply.status(400).send({
            error: "Predictions and actuals arrays must have same length",
          });
        }

        const ensemble = getEnsemble(tenantId);
        const result = ensemble.calibrate(body.predictions, body.actuals);

        return reply.send({
          success: true,
          calibration: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Error calibrating models:");
        return reply.status(500).send({
          error: "Failed to calibrate models",
        });
      }
    },
  );

  // ── GET /api/ai/eta-v2/accuracy-report — Accuracy Report ───────

  fastify.get(
    "/accuracy-report",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = (request as any).tenantId || "default";
      const { days } = request.query as { days?: string };

      try {
        const tracker = getTracker(tenantId);
        const daysBack = parseInt(days || "7", 10);
        const now = new Date();
        const periodStart = new Date(
          now.getTime() - daysBack * 24 * 60 * 60 * 1000,
        );

        const report = tracker.generateReport(periodStart, now);

        return reply.send({
          success: true,
          report,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Error generating accuracy report:");
        return reply.status(500).send({
          error: "Failed to generate accuracy report",
        });
      }
    },
  );

  // ── GET /api/ai/eta-v2/health — Health Check ──────────────────

  fastify.get(
    "/health",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = (request as any).tenantId || "default";
        const ensemble = getEnsemble(tenantId);
        const weights = ensemble.getWeights();

        const modelWeightsOk =
          weights.timeOfDay > 0 &&
          weights.distanceDecay > 0 &&
          weights.historicalSimilarity > 0 &&
          weights.traffic > 0 &&
          weights.weather > 0;

        const healthy = modelWeightsOk;

        return reply.send({
          healthy,
          status: healthy ? "operational" : "degraded",
          models: {
            time_of_day_weight: weights.timeOfDay.toFixed(3),
            distance_decay_weight: weights.distanceDecay.toFixed(3),
            historical_similarity_weight:
              weights.historicalSimilarity.toFixed(3),
            traffic_weight: weights.traffic.toFixed(3),
            weather_weight: weights.weather.toFixed(3),
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Error checking health:");
        return reply.status(500).send({
          healthy: false,
          status: "error",
          error: "Health check failed",
        });
      }
    },
  );
}
