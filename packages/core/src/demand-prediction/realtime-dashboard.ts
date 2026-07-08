/**
 * Real-Time Demand Dashboard Service
 *
 * Provides real-time demand analytics and monitoring for delivery zones:
 * - Live demand vs predicted comparison
 * - Demand timeline history
 * - Top anomalies detection
 * - Model accuracy metrics
 * - Zone performance rankings
 * - Real-time update event emitter
 */

import { EventEmitter } from "events";
import type {
  DemandForecast,
  DemandAnomaly,
  ModelPerformanceMetrics,
  ZoneProfile,
} from "./types";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Current demand snapshot for a zone
 */
export interface DemandSnapshot {
  zoneId: string;
  timestamp: Date;
  actualDemand: number; // current/recent actual deliveries
  predictedDemand: number; // what we forecasted
  demandGap: number; // actual - predicted
  demandGapPercent: number; // (actual - predicted) / predicted
  confidence: number; // 0-1 forecast confidence
  trend: "up" | "down" | "stable"; // direction of change
  capacity: number; // current allocated drivers/slots
  utilization: number; // 0-1, actual/capacity
  anomalyDetected: boolean;
  anomalySeverity: number; // 0-1 if detected
  lastUpdated: Date;
}

/**
 * Single data point in demand timeline
 */
export interface TimelinePoint {
  timestamp: Date;
  actualDemand: number;
  predictedDemand: number;
  capacity: number;
  anomalyFlag: boolean;
}

/**
 * Zone ranking by demand gap
 */
export interface ZoneRanking {
  zoneId: string;
  zoneName?: string;
  demandGap: number; // absolute gap
  demandGapPercent: number;
  severity: "critical" | "high" | "medium" | "low" | "ok";
  actualDemand: number;
  predictedDemand: number;
  capacity: number;
  utilization: number;
  recommendation: string; // e.g., "Add 2 drivers", "Reduce capacity"
}

/**
 * Model accuracy dashboard data
 */
export interface ModelAccuracyDashboard {
  overallMetrics: ModelPerformanceMetrics;
  byZone: Array<{
    zoneId: string;
    metrics: ModelPerformanceMetrics;
    forecastCount: number;
    successRate: number; // 0-1
    lastUpdated: Date;
  }>;
  modelVersion: number;
  lastRetrainedAt: Date;
  retrainSchedule: string; // cron or description
}

/**
 * Dashboard event types
 */
export interface DashboardEvent {
  type:
    | "snapshot_update"
    | "anomaly_detected"
    | "model_updated"
    | "alert_triggered";
  timestamp: Date;
  data: any;
}

// ═══════════════════════════════════════════════════════════════
// REAL-TIME DASHBOARD SERVICE
// ═══════════════════════════════════════════════════════════════

/**
 * Real-time demand dashboard data service
 * Provides live monitoring and analytics for delivery zones
 */
export class RealtimeDashboard extends EventEmitter {
  private demandSnapshots: Map<string, DemandSnapshot> = new Map();
  private demandHistory: Map<string, TimelinePoint[]> = new Map();
  private anomalyCache: Map<string, DemandAnomaly[]> = new Map();
  private modelMetrics: ModelPerformanceMetrics | null = null;
  private zoneProfiles: Map<string, ZoneProfile> = new Map();

  // Update intervals
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly updateIntervalMs: number = 60000; // 1 minute default

  // History retention
  private readonly maxHistoryPoints: number = 1440; // 24 hours at 1min granularity
  private readonly maxAnomalies: number = 100; // Keep last 100 anomalies

  constructor(updateIntervalMs?: number) {
    super();
    if (updateIntervalMs) {
      this.updateIntervalMs = updateIntervalMs;
    }
  }

  /**
   * Start real-time monitoring
   */
  startMonitoring(zoneIds: string[]): void {
    if (this.updateInterval) {
      this.stopMonitoring();
    }

    // Initialize history for each zone
    for (const zoneId of zoneIds) {
      if (!this.demandHistory.has(zoneId)) {
        this.demandHistory.set(zoneId, []);
      }
    }

    this.updateInterval = setInterval(() => {
      this.refreshSnapshots();
    }, this.updateIntervalMs);

    this.emit("monitoring_started", { zoneIds, timestamp: new Date() });
  }

  /**
   * Stop real-time monitoring
   */
  stopMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      this.emit("monitoring_stopped", { timestamp: new Date() });
    }
  }

  /**
   * Get current demand snapshot for zones
   * Returns live demand vs predicted per zone
   */
  getCurrentDemandSnapshot(zoneIds: string[]): DemandSnapshot[] {
    return zoneIds
      .map((zoneId) => this.demandSnapshots.get(zoneId))
      .filter((s): s is DemandSnapshot => s !== undefined);
  }

  /**
   * Get demand timeline for a zone
   * Recent demand data points over specified hours
   */
  getDemandTimeline(zoneId: string, hours: number): TimelinePoint[] {
    const history = this.demandHistory.get(zoneId) || [];
    if (history.length === 0) return [];

    // Calculate cutoff time
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

    return history.filter((point) => point.timestamp > cutoffTime);
  }

  /**
   * Get top anomalies across all zones
   * Most significant recent anomalies
   */
  getTopAnomalies(limit: number = 10): DemandAnomaly[] {
    const allAnomalies: DemandAnomaly[] = [];

    for (const anomalies of this.anomalyCache.values()) {
      allAnomalies.push(...anomalies);
    }

    // Sort by severity descending, then by timestamp descending
    return allAnomalies
      .sort((a, b) => {
        const severityDiff = (b.severity ?? 0) - (a.severity ?? 0);
        if (severityDiff !== 0) return severityDiff;
        return b.timestamp.getTime() - a.timestamp.getTime();
      })
      .slice(0, limit);
  }

  /**
   * Get model accuracy dashboard
   * Per-model accuracy metrics and performance
   */
  getModelAccuracyDashboard(): ModelAccuracyDashboard {
    const now = new Date();
    const byZone = Array.from(this.demandSnapshots.entries()).map(
      ([zoneId, snapshot]) => ({
        zoneId,
        metrics: {
          mae: 5.2, // Mock values - would be calculated from actual vs predicted
          rmse: 7.1,
          mape: 8.3,
          r2Score: 0.87,
          precision: 0.92,
          recall: 0.89,
        } as ModelPerformanceMetrics,
        forecastCount: 24,
        successRate: 0.88,
        lastUpdated: now,
      }),
    );

    return {
      overallMetrics: this.modelMetrics || {
        mae: 5.5,
        rmse: 7.3,
        mape: 8.6,
        r2Score: 0.85,
        precision: 0.9,
        recall: 0.87,
      },
      byZone,
      modelVersion: 2,
      lastRetrainedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      retrainSchedule: "Weekly on Monday 2:00 AM UTC",
    };
  }

  /**
   * Get zone rankings by demand gap
   * Zones sorted by actual vs predicted demand gap
   */
  getZoneRankings(): ZoneRanking[] {
    const rankings: ZoneRanking[] = [];

    for (const snapshot of this.demandSnapshots.values()) {
      const severityPercent = Math.abs(snapshot.demandGapPercent);
      let severity: ZoneRanking["severity"];

      if (severityPercent > 0.5) severity = "critical";
      else if (severityPercent > 0.3) severity = "high";
      else if (severityPercent > 0.15) severity = "medium";
      else if (severityPercent > 0.05) severity = "low";
      else severity = "ok";

      // Generate recommendation based on gap
      let recommendation: string;
      if (snapshot.demandGap > 0) {
        const driverShortage = Math.ceil(snapshot.demandGap / 3); // ~3 deliveries per driver
        recommendation = `Add ${driverShortage} driver${driverShortage !== 1 ? "s" : ""} (demand exceeding capacity)`;
      } else {
        const excessCapacity = Math.ceil(Math.abs(snapshot.demandGap) / 3);
        recommendation = `Reduce capacity by ${excessCapacity} driver${excessCapacity !== 1 ? "s" : ""} (idle resources)`;
      }

      rankings.push({
        zoneId: snapshot.zoneId,
        zoneName: this.zoneProfiles.get(snapshot.zoneId)?.zoneId,
        demandGap: snapshot.demandGap,
        demandGapPercent: snapshot.demandGapPercent,
        severity,
        actualDemand: snapshot.actualDemand,
        predictedDemand: snapshot.predictedDemand,
        capacity: snapshot.capacity,
        utilization: snapshot.utilization,
        recommendation,
      });
    }

    // Sort by demand gap magnitude descending
    return rankings.sort(
      (a, b) => Math.abs(b.demandGap) - Math.abs(a.demandGap),
    );
  }

  /**
   * Update a zone's demand snapshot
   */
  updateSnapshot(
    zoneId: string,
    actualDemand: number,
    predictedDemand: number,
    capacity: number,
    options?: {
      confidence?: number;
      anomalyDetected?: boolean;
      anomalySeverity?: number;
    },
  ): DemandSnapshot {
    const timestamp = new Date();
    const demandGap = actualDemand - predictedDemand;
    const demandGapPercent =
      predictedDemand > 0 ? demandGap / predictedDemand : 0;

    // Determine trend
    const previousSnapshot = this.demandSnapshots.get(zoneId);
    let trend: "up" | "down" | "stable" = "stable";
    if (previousSnapshot) {
      const change = actualDemand - previousSnapshot.actualDemand;
      if (change > previousSnapshot.actualDemand * 0.05) trend = "up";
      else if (change < -previousSnapshot.actualDemand * 0.05) trend = "down";
    }

    const snapshot: DemandSnapshot = {
      zoneId,
      timestamp,
      actualDemand,
      predictedDemand,
      demandGap,
      demandGapPercent,
      confidence: options?.confidence ?? 0.8,
      trend,
      capacity,
      utilization: capacity > 0 ? actualDemand / capacity : 0,
      anomalyDetected: options?.anomalyDetected ?? false,
      anomalySeverity: options?.anomalySeverity ?? 0,
      lastUpdated: timestamp,
    };

    this.demandSnapshots.set(zoneId, snapshot);

    // Add to history
    const history = this.demandHistory.get(zoneId) || [];
    history.push({
      timestamp,
      actualDemand,
      predictedDemand,
      capacity,
      anomalyFlag: snapshot.anomalyDetected,
    });

    // Trim history if too large
    if (history.length > this.maxHistoryPoints) {
      history.shift();
    }
    this.demandHistory.set(zoneId, history);

    // Emit update event
    this.emit("snapshot_updated", snapshot);

    return snapshot;
  }

  /**
   * Record anomalies for a zone
   */
  recordAnomalies(zoneId: string, anomalies: DemandAnomaly[]): void {
    const current = this.anomalyCache.get(zoneId) || [];
    const updated = [...current, ...anomalies];

    // Keep only recent anomalies
    if (updated.length > this.maxAnomalies) {
      updated.splice(0, updated.length - this.maxAnomalies);
    }

    this.anomalyCache.set(zoneId, updated);

    // Emit anomaly event for each
    for (const anomaly of anomalies) {
      this.emit("anomaly_detected", anomaly);
    }
  }

  /**
   * Update model metrics
   */
  updateModelMetrics(metrics: ModelPerformanceMetrics): void {
    this.modelMetrics = metrics;
    this.emit("model_metrics_updated", metrics);
  }

  /**
   * Register zone profile
   */
  registerZoneProfile(profile: ZoneProfile): void {
    this.zoneProfiles.set(profile.zoneId, profile);
  }

  /**
   * Refresh all snapshots
   * Called by monitoring loop
   */
  private refreshSnapshots(): void {
    // In production, this would fetch actual current demand from database
    // For now, it emits a tick event for external refresh
    this.emit("refresh_tick", { timestamp: new Date() });
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.demandSnapshots.clear();
    this.demandHistory.clear();
    this.anomalyCache.clear();
    this.modelMetrics = null;
  }

  /**
   * Get current statistics
   */
  getStatistics(): {
    activeZones: number;
    totalSnapshots: number;
    totalAnomalies: number;
    uptime: number;
  } {
    let totalAnomalies = 0;
    for (const anomalies of this.anomalyCache.values()) {
      totalAnomalies += anomalies.length;
    }

    return {
      activeZones: this.demandSnapshots.size,
      totalSnapshots: this.demandSnapshots.size,
      totalAnomalies,
      uptime: this.updateInterval ? 1 : 0,
    };
  }
}
