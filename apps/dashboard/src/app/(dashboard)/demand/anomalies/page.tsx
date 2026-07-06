"use client";

import { useState, useMemo, useCallback } from "react";
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
import { useApiQuery } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";

interface AnomalyEvent {
  id: string;
  type: "spike" | "drop" | "trend_shift" | "seasonal_break" | "drift";
  zone: string;
  severity: "low" | "medium" | "high";
  description: string;
  value: number;
  previousValue: number;
  timestamp: string;
  resolved: boolean;
  metadata?: Record<string, any>;
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
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [expandedAnomalies, setExpandedAnomalies] = useState<Set<string>>(
    new Set(),
  );

  const {
    data: rawData,
    loading,
    error,
  } = useApiQuery<{ items: AnomalyEvent[]; total: number }>(
    "/api/v4/analytics/demand-anomalies",
  );
  const anomalies = rawData?.items ?? [];

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a) => {
      if (selectedSeverity !== "all" && a.severity !== selectedSeverity)
        return false;
      if (selectedZone !== "all" && a.zone !== selectedZone) return false;
      return true;
    });
  }, [anomalies, selectedSeverity, selectedZone]);

  const zones = useMemo(() => {
    return Array.from(new Set(anomalies.map((a) => a.zone))).sort();
  }, [anomalies]);

  const stats = useMemo(() => {
    return {
      total: anomalies.length,
      active: anomalies.filter((a) => !a.resolved).length,
      byType: anomalies.reduce(
        (acc, a) => ({
          ...acc,
          [a.type]: (acc[a.type] || 0) + 1,
        }),
        {} as Record<string, number>,
      ),
      bySeverity: anomalies.reduce(
        (acc, a) => ({
          ...acc,
          [a.severity]: (acc[a.severity] || 0) + 1,
        }),
        {} as Record<string, number>,
      ),
    };
  }, [anomalies]);

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

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "border-wl-danger-500/50 bg-wl-danger-500/5";
      case "medium":
        return "border-wl-warning-500/50 bg-wl-warning-500/5";
      default:
        return "border-wl-info-500/50 bg-wl-info-500/5";
    }
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case "high":
        return "danger";
      case "medium":
        return "warning";
      default:
        return "info";
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">
                Anomaly Monitoring
              </h1>
              <p className="text-sm text-wl-text-secondary mt-1">
                Track and manage demand anomalies
              </p>
            </div>
            <Button variant="primary" size="md">
              <AlertTriangle className="w-4 h-4" />
              Export Report
            </Button>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div>
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                Total Anomalies
              </p>
              <p className="text-2xl font-bold text-wl-text-primary">
                {stats.total}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                Active
              </p>
              <p className="text-2xl font-bold text-wl-danger-500">
                {stats.active}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-wl-text-secondary" />
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium",
                  "bg-wl-bg-overlay border border-wl-border-default",
                  "text-wl-text-primary",
                  "focus:outline-none focus:ring-2 focus:ring-wl-primary-500",
                )}
              >
                <option value="all">All Severities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium",
                "bg-wl-bg-overlay border border-wl-border-default",
                "text-wl-text-primary",
                "focus:outline-none focus:ring-2 focus:ring-wl-primary-500",
              )}
            >
              <option value="all">All Zones</option>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-5xl">
          {/* Anomalies List */}
          {filteredAnomalies.length === 0 ? (
            <Card className="p-6 bg-wl-bg-surface border-wl-border-default text-center">
              <AlertTriangle className="w-12 h-12 text-wl-text-tertiary mx-auto mb-4" />
              <p className="text-wl-text-secondary">No anomalies found</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredAnomalies.map((anomaly) => {
                const isExpanded = expandedAnomalies.has(anomaly.id);
                const timestamp = new Date(anomaly.timestamp);

                return (
                  <Card
                    key={anomaly.id}
                    className={cn(
                      "border cursor-pointer transition-all p-4",
                      getSeverityColor(anomaly.severity),
                      "hover:border-opacity-75",
                    )}
                    onClick={() => toggleAnomalyExpansion(anomaly.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge
                            variant={
                              getSeverityBadgeVariant(anomaly.severity) as any
                            }
                          >
                            {anomaly.severity}
                          </Badge>
                          <span className="font-medium text-wl-text-primary capitalize">
                            {anomaly.type.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-wl-text-tertiary">
                            {anomaly.zone}
                          </span>
                          {anomaly.resolved && (
                            <CheckCircle className="w-4 h-4 text-wl-success-500" />
                          )}
                        </div>
                        <p className="text-sm text-wl-text-secondary">
                          {anomaly.description}
                        </p>

                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-wl-border-default/30 space-y-2 text-sm">
                            <p className="text-wl-text-tertiary">
                              <span className="font-medium">Previous:</span>{" "}
                              {anomaly.previousValue}
                            </p>
                            <p className="text-wl-text-tertiary">
                              <span className="font-medium">Current:</span>{" "}
                              {anomaly.value}
                            </p>
                            <p className="text-wl-text-tertiary">
                              <span className="font-medium">Detected:</span>{" "}
                              {timestamp.toLocaleString()}
                            </p>
                            {anomaly.metadata && (
                              <div className="mt-2">
                                <p className="font-medium text-wl-text-secondary">
                                  Metadata:
                                </p>
                                <pre className="text-xs bg-wl-bg-overlay p-2 rounded mt-1 overflow-auto">
                                  {JSON.stringify(anomaly.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 text-wl-text-tertiary transition-transform",
                            isExpanded && "rotate-180",
                          )}
                        />
                        <span className="text-xs text-wl-text-tertiary">
                          {Math.round(
                            (Date.now() - timestamp.getTime()) / 60000,
                          )}
                          m ago
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
