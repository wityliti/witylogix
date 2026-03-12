"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  MapPin,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ZoneData {
  id: string;
  name: string;
  predictedVolume: number;
  actualVolume: number;
  confidence: number;
  trend: "up" | "down" | "stable";
  anomalies: number;
}

interface AnomalyAlert {
  id: string;
  type: "spike" | "drop" | "trend_shift" | "seasonal_break";
  zone: string;
  severity: "low" | "medium" | "high";
  description: string;
  timestamp: Date;
}

interface DemandMetrics {
  totalPredicted: number;
  totalActual: number;
  avgConfidence: number;
  anomalyCount: number;
}

/**
 * Demand Forecast Overview Page
 *
 * Features:
 * - Zone selector dropdown for filtering
 * - Date range picker (today, this week, next week, custom)
 * - Demand forecast chart (predicted vs actual) using SVG
 * - Zone heatmap showing predicted demand intensity
 * - Key metrics: predicted volume, confidence %, trend direction
 * - Anomaly alerts section
 */
export default function DemandPage() {
  // State
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"today" | "week" | "nextweek" | "custom">("week");
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [metrics, setMetrics] = useState<DemandMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAnomalies, setExpandedAnomalies] = useState<Set<string>>(new Set());

  // Mock data loading
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Simulate API call
        const mockZones: ZoneData[] = [
          {
            id: "zone-1",
            name: "Downtown",
            predictedVolume: 1250,
            actualVolume: 1180,
            confidence: 92,
            trend: "up",
            anomalies: 0,
          },
          {
            id: "zone-2",
            name: "Midtown",
            predictedVolume: 980,
            actualVolume: 1050,
            confidence: 87,
            trend: "up",
            anomalies: 1,
          },
          {
            id: "zone-3",
            name: "Uptown",
            predictedVolume: 650,
            actualVolume: 620,
            confidence: 89,
            trend: "stable",
            anomalies: 0,
          },
          {
            id: "zone-4",
            name: "Riverside",
            predictedVolume: 520,
            actualVolume: 485,
            confidence: 84,
            trend: "down",
            anomalies: 1,
          },
          {
            id: "zone-5",
            name: "Westside",
            predictedVolume: 780,
            actualVolume: 820,
            confidence: 90,
            trend: "up",
            anomalies: 0,
          },
          {
            id: "zone-6",
            name: "Eastside",
            predictedVolume: 620,
            actualVolume: 580,
            confidence: 85,
            trend: "stable",
            anomalies: 2,
          },
        ];

        const mockAnomalies: AnomalyAlert[] = [
          {
            id: "anom-1",
            type: "spike",
            zone: "Midtown",
            severity: "high",
            description: "Unusual spike in demand detected at 2:00 PM",
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          },
          {
            id: "anom-2",
            type: "trend_shift",
            zone: "Riverside",
            severity: "medium",
            description: "Demand trend shifted downward - 15% below forecast",
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
          },
          {
            id: "anom-3",
            type: "seasonal_break",
            zone: "Eastside",
            severity: "medium",
            description: "Seasonal pattern disrupted - new competitor activity detected",
            timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
          },
        ];

        setZones(mockZones);
        setAnomalies(mockAnomalies);

        const totalPredicted = mockZones.reduce((sum, z) => sum + z.predictedVolume, 0);
        const totalActual = mockZones.reduce((sum, z) => sum + z.actualVolume, 0);
        const avgConfidence = Math.round(
          mockZones.reduce((sum, z) => sum + z.confidence, 0) / mockZones.length
        );

        setMetrics({
          totalPredicted,
          totalActual,
          avgConfidence,
          anomalyCount: mockAnomalies.length,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load demand data";
        setError(errorMessage);
        console.error("Demand error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [dateRange]);

  // Filter zones based on selection
  const filteredZones = useMemo(() => {
    if (selectedZone === "all") return zones;
    return zones.filter((z) => z.id === selectedZone);
  }, [zones, selectedZone]);

  // Toggle anomaly expansion
  const toggleAnomalyExpansion = useCallback((anomalyId: string) => {
    setExpandedAnomalies((prev) => {
      const next = new Set(prev);
      if (next.has(anomalyId)) {
        next.delete(anomalyId);
      } else {
        next.add(anomalyId);
      }
      return next;
    });
  }, []);

  // Render demand forecast chart using SVG
  const renderForecastChart = () => {
    if (filteredZones.length === 0) return null;

    const chartHeight = 280;
    const chartWidth = 700;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const maxVolume = Math.max(
      ...filteredZones.map((z) => Math.max(z.predictedVolume, z.actualVolume)) || 1000
    );

    const barWidth = innerWidth / (filteredZones.length * 2 + filteredZones.length - 1);
    const barGap = barWidth;

    return (
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto"
        role="img"
        aria-label="Demand forecast chart showing predicted vs actual volumes"
      >
        {/* Y-axis gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + innerHeight - ratio * innerHeight;
          return (
            <line
              key={`gridline-${ratio}`}
              x1={padding.left}
              y1={y}
              x2={chartWidth - padding.right}
              y2={y}
              stroke="var(--wl-border-default)"
              strokeDasharray="4,4"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + innerHeight - ratio * innerHeight;
          const value = Math.round(maxVolume * ratio);
          return (
            <text
              key={`ylabel-${ratio}`}
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              className="text-xs"
              fill="var(--wl-text-secondary)"
            >
              {value}
            </text>
          );
        })}

        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={chartHeight - padding.bottom}
          stroke="var(--wl-border-strong)"
          vectorEffect="non-scaling-stroke"
        />

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={chartHeight - padding.bottom}
          x2={chartWidth - padding.right}
          y2={chartHeight - padding.bottom}
          stroke="var(--wl-border-strong)"
          vectorEffect="non-scaling-stroke"
        />

        {/* Bars and labels */}
        {filteredZones.map((zone, idx) => {
          const xStart = padding.left + idx * (barWidth * 2 + barGap);
          const predictedHeight = (zone.predictedVolume / maxVolume) * innerHeight;
          const actualHeight = (zone.actualVolume / maxVolume) * innerHeight;
          const predictedY = chartHeight - padding.bottom - predictedHeight;
          const actualY = chartHeight - padding.bottom - actualHeight;

          return (
            <g key={zone.id}>
              {/* Predicted bar */}
              <rect
                x={xStart}
                y={predictedY}
                width={barWidth}
                height={predictedHeight}
                fill="var(--wl-primary-500)"
                opacity="0.7"
              />
              {/* Actual bar */}
              <rect
                x={xStart + barWidth}
                y={actualY}
                width={barWidth}
                height={actualHeight}
                fill="var(--wl-success-500)"
                opacity="0.7"
              />
              {/* X-axis label */}
              <text
                x={xStart + barWidth}
                y={chartHeight - padding.bottom + 20}
                textAnchor="middle"
                className="text-xs"
                fill="var(--wl-text-secondary)"
              >
                {zone.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  // Render heatmap
  const renderHeatmap = () => {
    const cellSize = 60;
    const cols = Math.ceil(Math.sqrt(zones.length));

    const getHeatmapColor = (intensity: number): string => {
      if (intensity > 0.8) return "var(--wl-danger-500)";
      if (intensity > 0.6) return "var(--wl-warning-500)";
      if (intensity > 0.4) return "var(--wl-primary-500)";
      return "var(--wl-info-500)";
    };

    return (
      <div className="grid grid-cols-3 gap-3">
        {zones.map((zone) => {
          const intensity = zone.predictedVolume / 1300;
          return (
            <div
              key={zone.id}
              className="relative overflow-hidden rounded-md border border-wl-border-default p-3 text-center"
              style={{
                background: `linear-gradient(135deg, ${getHeatmapColor(intensity)}22 0%, transparent 100%)`,
                borderColor: `${getHeatmapColor(intensity)}44`,
              }}
            >
              <p className="text-xs font-medium text-wl-text-secondary">{zone.name}</p>
              <p className="text-sm font-semibold text-wl-text-primary mt-1">
                {Math.round(intensity * 100)}%
              </p>
              <p className="text-xs text-wl-text-tertiary">{zone.predictedVolume} predicted</p>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-wl-bg-primary">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-wl-primary-500/20 border-t-wl-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-wl-text-secondary">Loading demand forecast...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-wl-bg-primary">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-wl-danger-500 mx-auto mb-4" />
          <p className="text-wl-text-primary font-medium">Error loading demand data</p>
          <p className="text-wl-text-secondary text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const volumeDeviation = metrics
    ? Math.round(((metrics.totalActual - metrics.totalPredicted) / metrics.totalPredicted) * 100)
    : 0;

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">Demand Forecast</h1>
              <p className="text-sm text-wl-text-secondary mt-1">Real-time demand predictions and analytics</p>
            </div>
            <Button variant="primary" size="md">
              <Calendar className="w-4 h-4" />
              Export Report
            </Button>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-4 mt-6">
            {/* Zone Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="zone-select" className="text-sm font-medium text-wl-text-secondary">
                <MapPin className="w-4 h-4 inline mr-2" />
                Zone
              </label>
              <select
                id="zone-select"
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium",
                  "bg-wl-bg-overlay border border-wl-border-default",
                  "text-wl-text-primary",
                  "focus:outline-none focus:ring-2 focus:ring-wl-primary-500",
                  "cursor-pointer"
                )}
              >
                <option value="all">All Zones</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="date-range" className="text-sm font-medium text-wl-text-secondary">
                <Calendar className="w-4 h-4 inline mr-2" />
                Period
              </label>
              <select
                id="date-range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium",
                  "bg-wl-bg-overlay border border-wl-border-default",
                  "text-wl-text-primary",
                  "focus:outline-none focus:ring-2 focus:ring-wl-primary-500",
                  "cursor-pointer"
                )}
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="nextweek">Next Week</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-7xl">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">Total Predicted</p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {metrics?.totalPredicted.toLocaleString()}
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">Volume for selected period</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">Current Actual</p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {metrics?.totalActual.toLocaleString()}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {volumeDeviation >= 0 ? (
                  <>
                    <ArrowUpRight className="w-4 h-4 text-wl-success-500" />
                    <span className="text-xs text-wl-success-400">+{volumeDeviation}%</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-4 h-4 text-wl-danger-500" />
                    <span className="text-xs text-wl-danger-400">{volumeDeviation}%</span>
                  </>
                )}
              </div>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">Avg Confidence</p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">{metrics?.avgConfidence}%</p>
              <p className="text-xs text-wl-text-secondary mt-2">Model prediction accuracy</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">Anomalies</p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">{metrics?.anomalyCount}</p>
              <Badge variant="warning" className="mt-2 text-xs">
                Active Alerts
              </Badge>
            </Card>
          </div>

          {/* Chart Section */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">Predicted vs Actual Volume</h2>
            <div className="flex items-end gap-6">
              <div className="flex-1 overflow-x-auto">{renderForecastChart()}</div>
              <div className="flex flex-col gap-3 text-sm min-w-max">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ background: "var(--wl-primary-500)" }}
                  />
                  <span className="text-wl-text-secondary">Predicted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ background: "var(--wl-success-500)" }}
                  />
                  <span className="text-wl-text-secondary">Actual</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Heatmap Section */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">Demand Intensity by Zone</h2>
            {renderHeatmap()}
          </Card>

          {/* Zone Details Table */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default overflow-hidden">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">Zone Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Zone</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Predicted</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Actual</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Confidence</th>
                    <th className="text-center px-4 py-3 font-semibold text-wl-text-secondary">Trend</th>
                    <th className="text-center px-4 py-3 font-semibold text-wl-text-secondary">Anomalies</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredZones.map((zone, idx) => (
                    <tr
                      key={zone.id}
                      className={cn(
                        "border-b border-wl-border-default hover:bg-wl-bg-overlay transition-colors",
                        idx % 2 === 0 ? "bg-wl-bg-surface" : "bg-transparent"
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-wl-text-primary">{zone.name}</td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">
                        {zone.predictedVolume.toLocaleString()}
                      </td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">
                        {zone.actualVolume.toLocaleString()}
                      </td>
                      <td className="text-right px-4 py-3">
                        <Badge
                          variant={zone.confidence >= 90 ? "success" : "info"}
                        >
                          {zone.confidence}%
                        </Badge>
                      </td>
                      <td className="text-center px-4 py-3">
                        {zone.trend === "up" ? (
                          <TrendingUp className="w-4 h-4 text-wl-success-500 mx-auto" />
                        ) : zone.trend === "down" ? (
                          <TrendingDown className="w-4 h-4 text-wl-danger-500 mx-auto" />
                        ) : (
                          <div className="w-4 h-4 border-l-2 border-wl-neutral-500 mx-auto" />
                        )}
                      </td>
                      <td className="text-center px-4 py-3">
                        {zone.anomalies > 0 ? (
                          <Badge variant="warning">{zone.anomalies}</Badge>
                        ) : (
                          <span className="text-wl-text-tertiary">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Anomaly Alerts */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-wl-warning-500" />
              Anomaly Alerts
            </h2>

            {anomalies.length === 0 ? (
              <p className="text-wl-text-secondary text-sm">No anomalies detected</p>
            ) : (
              <div className="space-y-3">
                {anomalies.map((anomaly) => {
                  const isExpanded = expandedAnomalies.has(anomaly.id);

                  const severityColor =
                    anomaly.severity === "high"
                      ? "border-wl-danger-500/50 bg-wl-danger-500/5"
                      : anomaly.severity === "medium"
                      ? "border-wl-warning-500/50 bg-wl-warning-500/5"
                      : "border-wl-info-500/50 bg-wl-info-500/5";

                  const severityBadgeVariant =
                    anomaly.severity === "high"
                      ? "danger"
                      : anomaly.severity === "medium"
                      ? "warning"
                      : ("info" as const);

                  return (
                    <div
                      key={anomaly.id}
                      className={cn(
                        "border rounded-md p-4 cursor-pointer transition-colors",
                        severityColor,
                        "hover:border-opacity-75"
                      )}
                      onClick={() => toggleAnomalyExpansion(anomaly.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant={severityBadgeVariant}>{anomaly.severity}</Badge>
                            <span className="text-sm font-medium text-wl-text-primary capitalize">
                              {anomaly.type.replace(/_/g, " ")}
                            </span>
                            <span className="text-xs text-wl-text-tertiary">in {anomaly.zone}</span>
                          </div>
                          <p className="text-sm text-wl-text-secondary">{anomaly.description}</p>

                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-wl-border-default/30 text-xs text-wl-text-tertiary">
                              <p>Detected: {anomaly.timestamp.toLocaleString()}</p>
                              <div className="mt-2 flex gap-2">
                                <Button variant="ghost" size="sm">
                                  <Eye className="w-4 h-4" />
                                  Investigate
                                </Button>
                                <Button variant="ghost" size="sm">
                                  Acknowledge
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-wl-text-tertiary whitespace-nowrap">
                          {Math.round((Date.now() - anomaly.timestamp.getTime()) / 60000)}m ago
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
