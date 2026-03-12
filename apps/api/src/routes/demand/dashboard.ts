/**
 * Demand Dashboard API Routes
 *
 * Complete API endpoints for real-time demand monitoring, rebalancing, and alerts:
 * - GET /demand/dashboard/snapshot — current demand snapshot all zones
 * - GET /demand/dashboard/timeline/:zoneId — zone demand timeline
 * - GET /demand/dashboard/anomalies — top anomalies
 * - GET /demand/dashboard/model-accuracy — model performance
 * - GET /demand/dashboard/zone-rankings — zone rankings
 * - POST /demand/rebalance/suggest — get rebalancing suggestion
 * - POST /demand/rebalance/execute — execute rebalancing plan
 * - GET /demand/alerts — active alerts
 * - POST /demand/alerts/acknowledge/:id — acknowledge alert
 * - POST /demand/models/retrain — trigger retraining
 */

import { Router, Request, Response } from 'express';
import type { RealtimeDashboard, DemandSnapshot, ZoneRanking } from '@witylogix/core/demand-prediction';
import type { AutoRebalancer, RebalancingPlan, CapacityImbalance } from '@witylogix/core/demand-prediction';
import type { CapacityAlertSystem, Alert } from '@witylogix/core/demand-prediction';
import type { ModelRetrainer } from '@witylogix/core/demand-prediction';

const router = Router();

// ═════════════════════════════════════════════════════════════════
// Service Instances (in production, use DI container)
// ═════════════════════════════════════════════════════════════════

// Store per organization
const dashboards = new Map<string, any>(); // RealtimeDashboard instances
const rebalancers = new Map<string, any>(); // AutoRebalancer instances
const alertSystems = new Map<string, any>(); // CapacityAlertSystem instances
const retrainers = new Map<string, any>(); // ModelRetrainer instances

function getDashboard(orgId: string): any {
  if (!dashboards.has(orgId)) {
    // In production, import and instantiate properly
    dashboards.set(orgId, {
      getCurrentDemandSnapshot: () => [],
      getDemandTimeline: () => [],
      getTopAnomalies: () => [],
      getModelAccuracyDashboard: () => ({}),
      getZoneRankings: () => [],
    });
  }
  return dashboards.get(orgId);
}

function getRebalancer(orgId: string): any {
  if (!rebalancers.has(orgId)) {
    rebalancers.set(orgId, {
      detectImbalance: () => [],
      suggestRebalancing: () => null,
      executeRebalancing: (plan: any) => plan,
      getPendingApprovals: () => [],
    });
  }
  return rebalancers.get(orgId);
}

function getAlertSystem(orgId: string): any {
  if (!alertSystems.has(orgId)) {
    alertSystems.set(orgId, {
      evaluateAlerts: () => [],
      getActiveAlerts: () => [],
      getAlertDashboard: () => ({}),
      acknowledgeAlert: () => true,
      resolveAlert: () => true,
    });
  }
  return alertSystems.get(orgId);
}

function getRetrainer(orgId: string): any {
  if (!retrainers.has(orgId)) {
    retrainers.set(orgId, {
      shouldRetrain: () => false,
      collectTrainingData: () => [],
      retrain: async () => ({}),
      getActiveModel: () => null,
    });
  }
  return retrainers.get(orgId);
}

// ═════════════════════════════════════════════════════════════════
// DEMAND DASHBOARD ENDPOINTS
// ═════════════════════════════════════════════════════════════════

/**
 * GET /demand/dashboard/snapshot
 * Get current demand snapshot for all zones
 *
 * Query params:
 * - zones: comma-separated zone IDs (optional, returns all if omitted)
 */
router.get('/snapshot', (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const zonesParam = req.query.zones as string | undefined;
    const zones = zonesParam ? zonesParam.split(',') : [];

    const dashboard = getDashboard(orgId);
    const snapshots = zones.length > 0 ? dashboard.getCurrentDemandSnapshot(zones) : dashboard.getCurrentDemandSnapshot([]);

    return res.json({
      timestamp: new Date(),
      zoneCount: snapshots.length,
      snapshots,
      summary: {
        avgUtilization: snapshots.length > 0 ? snapshots.reduce((sum: number, s: any) => sum + s.utilization, 0) / snapshots.length : 0,
        criticalZones: snapshots.filter((s: any) => Math.abs(s.demandGapPercent) > 0.3).length,
        anomaliesDetected: snapshots.filter((s: any) => s.anomalyDetected).length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /demand/dashboard/timeline/:zoneId
 * Get demand timeline for a zone
 *
 * Query params:
 * - hours: number of hours to look back (default 24, max 168)
 */
router.get('/timeline/:zoneId', (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const { zoneId } = req.params;
    const hours = Math.min(Number(req.query.hours) || 24, 168);

    const dashboard = getDashboard(orgId);
    const timeline = dashboard.getDemandTimeline(zoneId, hours);

    return res.json({
      zoneId,
      hours,
      pointCount: timeline.length,
      dataPoints: timeline,
      stats: {
        avgActual: timeline.length > 0 ? timeline.reduce((sum: number, p: any) => sum + p.actualDemand, 0) / timeline.length : 0,
        maxActual: timeline.length > 0 ? Math.max(...timeline.map((p: any) => p.actualDemand)) : 0,
        minActual: timeline.length > 0 ? Math.min(...timeline.map((p: any) => p.actualDemand)) : 0,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /demand/dashboard/anomalies
 * Get top detected anomalies
 *
 * Query params:
 * - limit: number of anomalies to return (default 10, max 50)
 */
router.get('/anomalies', (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const dashboard = getDashboard(orgId);
    const anomalies = dashboard.getTopAnomalies(limit);

    return res.json({
      limit,
      count: anomalies.length,
      anomalies,
      summary: {
        criticalAnomalies: anomalies.filter((a: any) => (a.severity ?? 0) > 0.7).length,
        totalImpact: anomalies.reduce((sum: number, a: any) => sum + Math.abs((a.deviation ?? 0)), 0),
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /demand/dashboard/model-accuracy
 * Get model accuracy and performance metrics
 */
router.get('/model-accuracy', (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const dashboard = getDashboard(orgId);
    const accuracyDashboard = dashboard.getModelAccuracyDashboard();

    return res.json(accuracyDashboard);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /demand/dashboard/zone-rankings
 * Get zone rankings by demand gap
 */
router.get('/zone-rankings', (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const dashboard = getDashboard(orgId);
    const rankings = dashboard.getZoneRankings();

    return res.json({
      timestamp: new Date(),
      zoneCount: rankings.length,
      rankings,
      summary: {
        criticalZones: rankings.filter((r: any) => r.severity === 'critical').length,
        highRiskZones: rankings.filter((r: any) => r.severity === 'high').length,
        avgDemandGap: rankings.length > 0 ? rankings.reduce((sum: number, r: any) => sum + r.demandGapPercent, 0) / rankings.length : 0,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// ═════════════════════════════════════════════════════════════════
// REBALANCING ENDPOINTS
// ═════════════════════════════════════════════════════════════════

/**
 * POST /demand/rebalance/suggest
 * Get rebalancing suggestion for imbalanced zones
 *
 * Body:
 * {
 *   zones: [
 *     { zoneId: string, demand: number, capacity: number },
 *     ...
 *   ]
 * }
 */
router.post('/rebalance/suggest', (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const { zones } = req.body;
    if (!zones || !Array.isArray(zones)) {
      return res.status(400).json({ error: 'Missing or invalid zones array' });
    }

    const rebalancer = getRebalancer(orgId);

    // Detect imbalances
    const imbalances = rebalancer.detectImbalance(zones);

    if (imbalances.length === 0) {
      return res.json({
        status: 'balanced',
        message: 'No significant imbalances detected',
        imbalances: [],
        plan: null,
      });
    }

    // Create zone capacity map
    const zoneCapacityMap = new Map(zones.map((z: any) => [z.zoneId, z.capacity]));

    // Suggest rebalancing
    const plan = rebalancer.suggestRebalancing(imbalances, zoneCapacityMap);

    return res.json({
      status: plan ? 'rebalancing_suggested' : 'no_rebalancing_possible',
      imbalanceCount: imbalances.length,
      imbalances,
      plan: plan || null,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /demand/rebalance/execute
 * Execute a rebalancing plan
 *
 * Body:
 * {
 *   planId: string,
 *   autoApprove: boolean (optional, default false)
 * }
 */
router.post('/rebalance/execute', (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const { planId, autoApprove } = req.body;
    if (!planId) {
      return res.status(400).json({ error: 'Missing planId' });
    }

    const rebalancer = getRebalancer(orgId);

    // In production, would fetch the plan from storage
    // For now, create a mock plan
    const plan = {
      id: planId,
      moves: [],
      status: 'draft' as const,
    };

    const executed = rebalancer.executeRebalancing(plan, autoApprove ?? false);

    return res.json({
      planId: executed.id,
      status: executed.status,
      requiresApproval: executed.status === 'pending_approval',
      message: executed.status === 'pending_approval' ? 'Plan pending manual approval' : 'Plan executing',
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /demand/rebalance/pending-approvals
 * Get pending rebalancing plans awaiting approval
 */
router.get('/rebalance/pending-approvals', (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const rebalancer = getRebalancer(orgId);
    const pending = rebalancer.getPendingApprovals();

    return res.json({
      count: pending.length,
      plans: pending,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// ═════════════════════════════════════════════════════════════════
// ALERT ENDPOINTS
// ═════════════════════════════════════════════════════════════════

/**
 * GET /demand/alerts
 * Get active and pending alerts
 *
 * Query params:
 * - status: 'active' | 'acknowledged' | 'resolved' (optional, returns all if omitted)
 * - zoneId: filter by zone (optional)
 */
router.get('/alerts', (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const alertSystem = getAlertSystem(orgId);
    const dashboard = alertSystem.getAlertDashboard();

    return res.json(dashboard);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /demand/alerts/acknowledge/:id
 * Acknowledge an alert
 *
 * Body:
 * {
 *   userId: string (optional)
 * }
 */
router.post('/alerts/acknowledge/:id', (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const { id } = req.params;
    const { userId } = req.body;

    const alertSystem = getAlertSystem(orgId);
    const success = alertSystem.acknowledgeAlert(id, userId);

    if (!success) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    return res.json({
      alertId: id,
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy: userId || 'system',
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /demand/alerts/resolve/:id
 * Resolve an alert
 *
 * Body:
 * {
 *   reason: string (optional)
 * }
 */
router.post('/alerts/resolve/:id', (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const alertSystem = getAlertSystem(orgId);
    const success = alertSystem.resolveAlert(id, reason);

    if (!success) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    return res.json({
      alertId: id,
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedReason: reason || undefined,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// ═════════════════════════════════════════════════════════════════
// MODEL RETRAINING ENDPOINTS
// ═════════════════════════════════════════════════════════════════

/**
 * POST /demand/models/retrain
 * Trigger model retraining
 *
 * Body:
 * {
 *   zoneId: string,
 *   modelType: 'seasonal' | 'regression' | 'pattern' | 'ensemble',
 *   reason: 'scheduled' | 'degradation_detected' | 'manual' | 'data_refresh'
 * }
 */
router.post('/models/retrain', async (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const { zoneId, modelType, reason } = req.body;

    if (!zoneId || !modelType) {
      return res.status(400).json({ error: 'Missing zoneId or modelType' });
    }

    const retrainer = getRetrainer(orgId);

    // Collect training data
    const trainingData = retrainer.collectTrainingData(zoneId);

    if (trainingData.length === 0) {
      return res.status(400).json({
        error: 'Insufficient training data collected',
      });
    }

    // Start retraining
    const job = await retrainer.retrain(zoneId, modelType, trainingData, reason || 'manual');

    return res.json({
      jobId: job.id,
      zoneId: job.zoneId,
      modelType: job.modelType,
      status: job.status,
      trainingDataSize: job.trainingDataSize,
      estimatedDurationSeconds: 120,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /demand/models/retrain/:jobId
 * Get retraining job status
 */
router.get('/models/retrain/:jobId', (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const { jobId } = req.params;

    // In production, would fetch from database
    return res.json({
      jobId,
      status: 'completed',
      message: 'Job status retrieval would be implemented with real storage',
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /demand/models/accuracy/:zoneId
 * Get model accuracy history for a zone
 */
router.get('/models/accuracy/:zoneId', (req: Request, res: Response) => {
  try {
    const orgId = req.headers['x-org-id'] as string;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing x-org-id header' });
    }

    const { zoneId } = req.params;

    const retrainer = getRetrainer(orgId);
    const history = retrainer.getRetrainingHistory(zoneId, 10);

    return res.json({
      zoneId,
      historyCount: history.length,
      history,
      stats: {
        totalRetrainings: history.length,
        successfulRetrainings: history.filter((h: any) => h.status === 'success').length,
        promotedModels: history.filter((h: any) => h.promoted).length,
        avgImprovement:
          history.length > 0
            ? history.filter((h: any) => h.promoted).reduce((sum: number, h: any) => sum + (h.improvementPercent || 0), 0) / history.length
            : 0,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
