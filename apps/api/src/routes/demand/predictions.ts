/**
 * Demand Prediction API Routes
 *
 * Complete API endpoints for demand forecasting, anomaly detection, and smart scheduling
 */

import { Router, Request, Response } from 'express';
import { DemandEnsemble, SmartScheduler } from '@witylogix/core/demand-prediction';
import type {
  DemandPrediction,
  HistoricalDemand,
  ScheduleReport,
  WhatIfScenario,
} from '@witylogix/core/demand-prediction';

const router = Router();

// ═════════════════════════════════════════════════════════════════
// Instance Management
// ═════════════════════════════════════════════════════════════════

// Store ensembles and schedulers per organization
const ensembles = new Map<string, DemandEnsemble>();
const schedulers = new Map<string, SmartScheduler>();

function getEnsemble(orgId: string): DemandEnsemble {
  if (!ensembles.has(orgId)) {
    ensembles.set(orgId, new DemandEnsemble());
  }
  return ensembles.get(orgId)!;
}

function getScheduler(orgId: string): SmartScheduler {
  if (!schedulers.has(orgId)) {
    schedulers.set(orgId, new SmartScheduler());
  }
  return schedulers.get(orgId)!;
}

// ═════════════════════════════════════════════════════════════════
// Training Endpoints
// ═════════════════════════════════════════════════════════════════

/**
 * POST /demand/train
 * Train ensemble on historical data for a zone
 */
router.post('/train', async (req: Request, res: Response) => {
  try {
    const { orgId, zoneId, historicalData } = req.body;

    if (!orgId || !zoneId || !historicalData || !Array.isArray(historicalData)) {
      return res.status(400).json({
        error: 'Missing required fields: orgId, zoneId, historicalData',
      });
    }

    if (historicalData.length < 30) {
      return res.status(400).json({
        error: 'Insufficient training data. Need at least 30 samples.',
      });
    }

    const ensemble = getEnsemble(orgId);

    // Validate and normalize data
    const validData: HistoricalDemand[] = historicalData.map((d: any) => ({
      zoneId,
      timestamp: new Date(d.timestamp),
      value: Number(d.value),
      dayOfWeek: Number(d.dayOfWeek),
      hour: Number(d.hour),
      isHoliday: Boolean(d.isHoliday),
      weather: d.weather || 'clear',
      weather_intensity: Number(d.weather_intensity) || 0,
    }));

    await ensemble.train(zoneId, validData);

    return res.json({
      success: true,
      message: `Trained ensemble for ${zoneId}`,
      metadata: {
        zoneId,
        samples: validData.length,
        trainedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Training error:', error);
    return res.status(500).json({
      error: 'Training failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═════════════════════════════════════════════════════════════════
// Prediction Endpoints
// ═════════════════════════════════════════════════════════════════

/**
 * GET /demand/predict/:zoneId
 * Predict demand for a zone
 */
router.get('/predict/:zoneId', async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const { orgId, date, granularity = 'hourly' } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: 'Missing orgId' });
    }

    const targetDate = date ? new Date(date as string) : new Date();
    const ensemble = getEnsemble(orgId as string);

    const prediction = await ensemble.predict(
      zoneId,
      targetDate,
      granularity as 'hourly' | 'slot' | 'daily',
    );

    return res.json({
      success: true,
      prediction: formatPredictionResponse(prediction),
    });
  } catch (error) {
    console.error('Prediction error:', error);
    return res.status(500).json({
      error: 'Prediction failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /demand/predict/batch
 * Batch predictions for multiple zones
 */
router.post('/predict/batch', async (req: Request, res: Response) => {
  try {
    const { orgId, zoneIds, date, granularity = 'hourly' } = req.body;

    if (!orgId || !Array.isArray(zoneIds)) {
      return res.status(400).json({
        error: 'Missing required fields: orgId, zoneIds[]',
      });
    }

    const targetDate = date ? new Date(date) : new Date();
    const ensemble = getEnsemble(orgId);

    const predictions = await Promise.all(
      zoneIds.map((zoneId: string) =>
        ensemble
          .predict(zoneId, targetDate, granularity)
          .then((pred) => ({ success: true, prediction: formatPredictionResponse(pred) }))
          .catch((err) => ({
            success: false,
            zoneId,
            error: err.message,
          })),
      ),
    );

    const successful = predictions.filter((p) => p.success);
    const failed = predictions.filter((p) => !p.success);

    return res.json({
      success: failed.length === 0,
      total: predictions.length,
      successful: successful.length,
      failed: failed.length,
      predictions: successful,
      errors: failed,
    });
  } catch (error) {
    console.error('Batch prediction error:', error);
    return res.status(500).json({
      error: 'Batch prediction failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═════════════════════════════════════════════════════════════════
// Scheduling Endpoints
// ═════════════════════════════════════════════════════════════════

/**
 * POST /demand/schedule/recommend
 * Get schedule recommendations based on predictions
 */
router.post('/schedule/recommend', async (req: Request, res: Response) => {
  try {
    const { orgId, predictions } = req.body;

    if (!orgId || !Array.isArray(predictions)) {
      return res.status(400).json({
        error: 'Missing required fields: orgId, predictions[]',
      });
    }

    const scheduler = getScheduler(orgId);

    // Generate report
    const report = scheduler.generateScheduleReport(predictions);

    return res.json({
      success: true,
      report: formatScheduleReport(report),
    });
  } catch (error) {
    console.error('Schedule recommendation error:', error);
    return res.status(500).json({
      error: 'Schedule recommendation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /demand/schedule/optimize
 * Optimize driver schedule
 */
router.post('/schedule/optimize', async (req: Request, res: Response) => {
  try {
    const { orgId, driverCount, zoneIds, predictions, date } = req.body;

    if (!orgId || !driverCount || !Array.isArray(zoneIds) || !Array.isArray(predictions)) {
      return res.status(400).json({
        error: 'Missing required fields: orgId, driverCount, zoneIds[], predictions[]',
      });
    }

    const scheduler = getScheduler(orgId);
    const predictionMap = new Map(
      predictions.map((p: DemandPrediction) => [p.zoneId, p]),
    );

    const optimized = scheduler.optimizeSchedule(
      driverCount,
      zoneIds,
      predictionMap,
      date ? new Date(date) : new Date(),
    );

    return res.json({
      success: true,
      optimization: {
        assignments: optimized.assignments,
        totalCost: optimized.totalCost,
        expectedServiceLevel: optimized.expectedServiceLevel,
        costPerDriver: optimized.totalCost / driverCount,
      },
    });
  } catch (error) {
    console.error('Schedule optimization error:', error);
    return res.status(500).json({
      error: 'Schedule optimization failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /demand/schedule/report/:date
 * Get full day schedule report
 */
router.get('/schedule/report/:date', async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const { orgId, zoneIds } = req.query;

    if (!orgId || !zoneIds) {
      return res.status(400).json({
        error: 'Missing required fields: orgId, zoneIds',
      });
    }

    const targetDate = new Date(date);
    const zones = Array.isArray(zoneIds) ? zoneIds : [zoneIds];

    // In real implementation, fetch predictions from cache or recompute
    // For now, return template
    return res.json({
      success: true,
      date: targetDate.toISOString().split('T')[0],
      zones,
      message: 'Implement with actual predictions',
    });
  } catch (error) {
    console.error('Schedule report error:', error);
    return res.status(500).json({
      error: 'Schedule report failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /demand/schedule/what-if
 * What-if scenario analysis
 */
router.post('/schedule/what-if', async (req: Request, res: Response) => {
  try {
    const { orgId, predictions, scenario } = req.body;

    if (!orgId || !Array.isArray(predictions) || !scenario) {
      return res.status(400).json({
        error: 'Missing required fields: orgId, predictions[], scenario',
      });
    }

    const scheduler = getScheduler(orgId);

    const analysis = scheduler.analyzeWhatIf(predictions, scenario);

    return res.json({
      success: true,
      analysis: {
        scenarioName: analysis.scenario_name,
        changes: analysis.changes,
        expectedOrders: analysis.expected_orders,
        serviceLevel: (analysis.service_level * 100).toFixed(1) + '%',
        estimatedCost: analysis.estimated_cost,
        potentialSavings: analysis.potential_savings,
        impactZones: analysis.impact_zones,
        recommendation: analysis.recommendation,
      },
    });
  } catch (error) {
    console.error('What-if analysis error:', error);
    return res.status(500).json({
      error: 'What-if analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═════════════════════════════════════════════════════════════════
// Model Management Endpoints
// ═════════════════════════════════════════════════════════════════

/**
 * GET /demand/models/performance
 * Get model performance metrics
 */
router.get('/models/performance', async (req: Request, res: Response) => {
  try {
    const { orgId, zoneId } = req.query;

    if (!orgId || !zoneId) {
      return res.status(400).json({
        error: 'Missing required fields: orgId, zoneId',
      });
    }

    const ensemble = getEnsemble(orgId as string);
    const metrics = ensemble.getMetrics(zoneId as string);

    if (!metrics) {
      return res.status(404).json({
        error: 'Zone not trained or no metrics available',
      });
    }

    return res.json({
      success: true,
      metrics: {
        zoneId,
        mae: metrics.mae.toFixed(2),
        rmse: metrics.rmse.toFixed(2),
        mape: (metrics.mape * 100).toFixed(1) + '%',
        accuracy80: (metrics.accuracy_80 * 100).toFixed(1) + '%',
        sampleCount: metrics.sample_count,
        rollingAccuracy: (metrics.rolling_accuracy * 100).toFixed(1) + '%',
        lastUpdated: metrics.last_updated.toISOString(),
      },
    });
  } catch (error) {
    console.error('Performance metrics error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /demand/models/reweight
 * Trigger model reweighting
 */
router.post('/models/reweight', async (req: Request, res: Response) => {
  try {
    const { orgId, zoneId } = req.body;

    if (!orgId || !zoneId) {
      return res.status(400).json({
        error: 'Missing required fields: orgId, zoneId',
      });
    }

    const ensemble = getEnsemble(orgId);
    await ensemble.reweight(zoneId);

    return res.json({
      success: true,
      message: `Models reweighted for ${zoneId}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reweighting error:', error);
    return res.status(500).json({
      error: 'Model reweighting failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═════════════════════════════════════════════════════════════════
// Utility Functions
// ═════════════════════════════════════════════════════════════════

function formatPredictionResponse(prediction: DemandPrediction) {
  return {
    zoneId: prediction.zoneId,
    targetPeriod: prediction.targetPeriod.toISOString(),
    predictions: prediction.predictions.map((p) => Math.round(p * 10) / 10),
    confidence: (prediction.confidence * 100).toFixed(1) + '%',
    lowerBound: prediction.lower_bound.map((b) => Math.round(b * 10) / 10),
    upperBound: prediction.upper_bound.map((b) => Math.round(b * 10) / 10),
    dominantModel: prediction.dominant_model,
    explanation: {
      primaryFactors: prediction.explanation.primary_factors,
      confidenceRationale: prediction.explanation.confidence_rationale,
      anomaliesDetected: prediction.explanation.anomalies_detected.length,
    },
    generatedAt: prediction.generated_at.toISOString(),
  };
}

function formatScheduleReport(report: ScheduleReport) {
  return {
    date: report.date.toISOString().split('T')[0],
    slots: report.slots.map((s) => ({
      slotId: s.slotId,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      recommendedCapacity: s.recommendedCapacity,
      predictedDemand: Math.round(s.predictedDemand * 10) / 10,
      utilizationRate: (s.utilizationRate * 100).toFixed(1) + '%',
      confidence: (s.confidence * 100).toFixed(1) + '%',
      reasoning: s.reasoning,
    })),
    driverAllocations: report.driver_allocations.map((a) => ({
      zoneId: a.zoneId,
      totalDrivers: a.total_drivers,
      peakHour: a.peak_hour,
      peakDrivers: a.peak_drivers,
      confidence: (a.confidence * 100).toFixed(1) + '%',
    })),
    capacityGaps: report.capacity_gaps.map((g) => ({
      zoneId: g.zoneId,
      timestamp: g.timestamp.toISOString(),
      type: g.type,
      gap: g.gap,
      severity: g.severity,
      recommendedAction: g.recommended_action,
    })),
    summary: {
      estimatedServiceLevel: (report.estimated_service_level * 100).toFixed(1) + '%',
      totalExpectedOrders: report.total_expected_orders,
      recommendations: report.recommendations,
    },
  };
}

export default router;
