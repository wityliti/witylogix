"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Zap,
  Calendar,
  Filter,
  ChevronDown,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface AnomalyEvent {
  id: string;
  type: "spike" | "drop" | "trend_shift" | "seasonal_break" | "drift";
  zone: string;
  severity: "low" | "medium" | "high";
  description: string;
  value: number;
  previousValue: number;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

interface AnomalyStats {
  total: number;
  active: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
}

/**
 * Anomaly Monitoring Page
 *
 * Features:
 * - Real-time anomaly feed with severity badges
 * - Anomaly type classification (spike, drop, trend-shift, seasonal-break, drift)
 * - Historical anomaly timeline
 * - Zone filter, severity filter
 * - Anomaly detail expandable cards
 */
export default function AnomaliesPage() {
  // State
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [stats, setStats] = useState<AnomalyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [expandedAnomalies, setExpandedAnomalies] = useState<Set<string>>(new Set());

  // Load anomalies
  useEffect(() => {
    const loadAnomalies = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Mock anomaly data with realistic timestamps
        const mockAnomalies: AnomalyEvent[] = [
          {
            id: "anom-1",
            type: "spike",
            zone: "Downtown",
            severity: "high",
            description: "Sudden spike in demand at 2:15 PM - 45% above forecast",
            value: 1820,
            previousValue: 1250,
            timestamp: new Date(Date.now() - 45 * 60 * 1000),
            resolved: false,
            metadata: {
              confidence: 0.94,
              duration: "15 minutes",
              affectedOrders: 47,
            },
          },
          {
            id: "anom-2",
            type: "trend_shift",
            zone: "Riverside",
            severity: "medium",
            description: "Downward trend detected - demand decreasing over 3 hours",
            value: 420,
            previousValue: 520,
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            resolved: false,
            metadata: {
              confidence: 0.87,
              duration: "3 hours",
              changeRate: "-19%",
            },
          },
          {
            id: "anom-3",
            type: "seasonal_break",
            zone: "Eastside",
            severity: "medium",
            description: "Seasonal pattern disrupted - new competitor activity detected",
            value: 480,
            previousValue: 620,
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
            resolved: false,
            metadata: {
              confidence: 0.82,
              expectedValue: 590,
              deviation: "-18.6%",
            },
          },
          {
            id: "anom-4",
            type: "drop",
            zone: "Midtown",
            severity: "low",
            description: "Minor drop in demand - possibly weather related",
            value: 750,
            previousValue: 980,
            timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
            resolved: false,
            metadata: {
              confidence: 0.76,
              duration: "1 hour",
              recovery: "Recovering",
            },
          },
          {
            id: "anom-5",
            type: "drift",
            zone: "Uptown",
            severity: "low",
            description: "Gradual drift in demand pattern - minor model recalibration needed",
            value: 620,
            previousValue: 650,
            timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
            resolved: false,
            metadata: {
              confidence: 0.81,
              trend: "Stabilizing",
              impact: "Low",
            },
          },
          {
            id: "anom-6",
            type: "spike",
            zone: "Westside",
            severity: "high",
            description: "Sharp demand spike - likely event-driven",
            value: 1100,
            previousValue: 780,
            timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000),
            resolved: true,
            metadata: {
              confidence: 0.91,
              eventType: "Local Event",
              peakOrders: 92,
            },
          },
          {
            id: "anom-7",
            type: "trend_shift",
            zone: "Downtown",
            severity: "medium",
            description: "Sustained upward trend for past 2 hours",
            value: 1450,
            previousValue: 1200,
            timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
            resolved: true,
            metadata: {
              confidence: 0.88,
              duration: "2 hours",
              changeRate: "+20.8%",
            },
          },
          {
            id: "anom-8",
            type: "drift",
            zone: "Riverside",
            severity: "low",
            description: "Model accuracy declining - drift detected in prediction errors",
            value: 510,
            previousValue: 520,
            timestamp: new Date(Date.now() - 14 * 60 * 60 * 1000),
            resolved: true,
            metadata: {
              confidence: 0.79,
              errorRate: "+2.3%",
              recommendation: "Retrain model",
            },
          },
        ];

        // Calculate stats
        const stats: AnomalyStats = {
          total: mockAnomalies.length,
          active: mockAnomalies.filter((a) => !a.resolved).length,
          byType: {
            spike: 0,
            drop: 0,
            trend_shift: 0,
            seasonal_break: 0,
            drift: 0,
          },
          bySeverity: {
            high: 0,
            medium: 0,
            low: 0,
          },
        };

        mockAnomalies.forEach((a) => {
          stats.byType[a.type]++;
          stats.bySeverity[a.severity]++;
        });

        setAnomalies(mockAnomalies);
        setStats(stats);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load anomalies";
        setError(errorMessage);
        console.error("Anomaly error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnomalies();

    // Simulate real-time updates
    const interval = setInterval(loadAnomalies, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter anomalies
  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a) => {
      if (selectedZone !== "all" && a.zone !== selectedZone) return false;
      if (selectedSeverity !== "all" && a.severity !== selectedSeverity) return false;
      return true;
    });
  }, [anomalies, selectedZone, selectedSeverity]);

  // Get unique zones
  const zones = useMemo(() => {
    return [...new Set(anomalies.map((a) => a.zone))].sort();
  }, [anomalies]);

  // Toggle anomaly expansion
  const toggleExpansion = useCallback((anomalyId: string) => {
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

  // Handle anomaly resolution
  const handleResolveAnomaly = useCallback((anomalyId: string) => {
    setAnomalies((prev) =>
      prev.map((a) => (a.id === anomalyId ? { ...a, resolved: true } : a))
    );
  }, []);

  // Handle anomaly deletion
  const handleDeleteAnomaly = useCallback((anomalyId: string) => {
    setAnomalies((prev) => prev.filter((a) => a.id !== anomalyId));
  }, []);

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "spike":
        return <TrendingUp className="w-4 h-4 text-wl-danger-500" />;
      case "drop":
        return <TrendingDown className="w-4 h-4 text-wl-warning-500" />;
      case "trend_shift":
        return <Zap className="w-4 h-4 text-wl-primary-500" />;
      case "seasonal_break":
        return <Calendar className="w-4 h-4 text-wl-info-500" />;
      case "drift":
        return <AlertTriangle className="w-4 h-4 text-wl-neutral-400" />;
      default:
        return null;
    }
  };

  // Get severity styling
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return {
          badge: "danger" as const,
          border: "border-wl-danger-500/50",
          bg: "bg-wl-danger-500/5",
        };
      case "medium":
        return {
          badge: "warning" as const,
          border: "border-wl-warning-500/50",
          bg: "bg-wl-warning-500/5",
        };
      case "low":
        return {
          badge: "info" as const,
          border: "border-wl-info-500/50",
          bg: "bg-wl-info-500/5",
        };
      default:
        return {
          badge: "default" as const,
          border: "border-wl-border-default",
          bg: "bg-transparent",
        };
    }
  };

  // Format time diff
  const formatTimeDiff = (date: Date): string => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-wl-bg-primary">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-wl-primary-500/20 border-t-wl-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-wl-text-secondary">Loading anomalies...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-wl-bg-primary">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-wl-danger-500 mx-auto mb-4" />
          <p className="text-wl-text-primary font-medium">Error loading anomalies</p>
          <p className="text-wl-text-secondary text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">Anomaly Detection</h1>
              <p className="text-sm text-wl-text-secondary mt-1">Real-time demand pattern anomalies</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-5xl">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Total Anomalies
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">{stats?.total || 0}</p>
              <p className="text-xs text-wl-text-secondary mt-2">All time</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Active Alerts
              </p>
              <p className="text-2xl font-bold text-wl-danger-500 mt-2">{stats?.active || 0}</p>
              <Badge variant="danger" className="mt-2 text-xs">
                Requires attention
              </Badge>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                High Severity
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {stats?.bySeverity.high || 0}
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">Immediate action</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Resolved
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {(stats?.total || 0) - (stats?.active || 0)}
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">This month</p>
            </Card>
          </div>

          {/* Anomaly Type Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
              <h2 className="text-lg font-semibold text-wl-text-primary mb-4">By Type</h2>
              <div className="space-y-3">
                {stats &&
                  Object.entries(stats.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(type)}
                        <span className="text-sm text-wl-text-secondary capitalize">
                          {type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-wl-text-primary">{count}</span>
                    </div>
                  ))}
              </div>
            </Card>

            <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
              <h2 className="text-lg font-semibold text-wl-text-primary mb-4">By Severity</h2>
              <div className="space-y-3">
                {stats &&
                  Object.entries(stats.bySeverity).map(([severity, count]) => (
                    <div key={severity} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            severity === "high" ? "danger" : severity === "medium" ? "warning" : "info"
                          }
                        >
                          {severity}
                        </Badge>
                      </div>
                      <span className="text-sm font-semibold text-wl-text-primary">{count}</span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-wl-text-secondary" />
                <span className="text-sm font-medium text-wl-text-secondary">Filters:</span>
              </div>

              {/* Zone Filter */}
              <select
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
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>

              {/* Severity Filter */}
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium",
                  "bg-wl-bg-overlay border border-wl-border-default",
                  "text-wl-text-primary",
                  "focus:outline-none focus:ring-2 focus:ring-wl-primary-500",
                  "cursor-pointer"
                )}
              >
                <option value="all">All Severities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <span className="text-xs text-wl-text-tertiary ml-auto">
                Showing {filteredAnomalies.length} of {anomalies.length} anomalies
              </span>
            </div>
          </Card>

          {/* Anomaly Feed */}
          <div className="space-y-3">
            {filteredAnomalies.length === 0 ? (
              <Card className="p-8 bg-wl-bg-surface border-wl-border-default text-center">
                <CheckCircle className="w-12 h-12 text-wl-success-500 mx-auto mb-3 opacity-50" />
                <p className="text-wl-text-secondary">No anomalies matching filter criteria</p>
              </Card>
            ) : (
              filteredAnomalies.map((anomaly) => {
                const isExpanded = expandedAnomalies.has(anomaly.id);
                const severityColor = getSeverityColor(anomaly.severity);

                return (
                  <Card
                    key={anomaly.id}
                    className={cn(
                      "border-l-4 cursor-pointer transition-all hover:shadow-md",
                      anomaly.resolved
                        ? "opacity-60 bg-wl-bg-surface border-wl-border-default border-l-wl-success-500"
                        : cn(
                          "bg-wl-bg-surface border-wl-border-default",
                          severityColor.border,
                          severityColor.bg
                        )
                    )}
                  >
                    <div
                      className="p-4"
                      onClick={() => toggleExpansion(anomaly.id)}
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon and status */}
                        <div className="flex-shrink-0 mt-1">
                          {anomaly.resolved ? (
                            <CheckCircle className="w-5 h-5 text-wl-success-500" />
                          ) : (
                            getTypeIcon(anomaly.type)
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {!anomaly.resolved && (
                              <Badge variant={severityColor.badge}>
                                {anomaly.severity}
                              </Badge>
                            )}
                            <Badge variant="default">
                              {anomaly.type.replace(/_/g, " ")}
                            </Badge>
                            {anomaly.resolved && (
                              <Badge variant="success">Resolved</Badge>
                            )}
                            <span className="text-xs text-wl-text-tertiary">
                              {anomaly.zone}
                            </span>
                          </div>

                          <h3 className="font-semibold text-wl-text-primary mb-1">
                            {anomaly.description}
                          </h3>

                          <div className="flex items-center gap-4 text-xs text-wl-text-secondary">
                            <span>
                              Value: <span className="font-semibold text-wl-text-primary">{anomaly.value}</span>
                            </span>
                            <span>
                              Previous: <span className="font-semibold text-wl-text-primary">{anomaly.previousValue}</span>
                            </span>
                            <span className="ml-auto">{formatTimeDiff(anomaly.timestamp)}</span>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && anomaly.metadata && (
                            <div className="mt-4 pt-4 border-t border-wl-border-default space-y-2">
                              {Object.entries(anomaly.metadata).map(([key, value]) => (
                                <div
                                  key={key}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-wl-text-secondary capitalize">
                                    {key.replace(/_/g, " ")}
                                  </span>
                                  <span className="font-semibold text-wl-text-primary">
                                    {typeof value === "string" || typeof value === "number"
                                      ? value
                                      : JSON.stringify(value)}
                                  </span>
                                </div>
                              ))}

                              {/* Actions */}
                              {!anomaly.resolved && (
                                <div className="flex gap-2 mt-3 pt-3 border-t border-wl-border-default/30">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleResolveAnomaly(anomaly.id);
                                    }}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    Mark Resolved
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteAnomaly(anomaly.id);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Dismiss
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Expand indicator */}
                        <ChevronDown
                          className={cn(
                            "w-5 h-5 text-wl-text-secondary flex-shrink-0 transition-transform",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
