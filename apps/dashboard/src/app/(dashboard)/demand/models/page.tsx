"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Zap,
  BarChart3,
  TrendingUp,
  RefreshCw,
  Info,
  BrainCircuit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";

interface ModelMetric {
  name: string;
  description: string;
  mae: number;
  rmse: number;
  mape: number;
  accuracy: number;
  weight: number;
  lastUpdated: string;
  trend: "improving" | "stable" | "degrading";
  zones: Record<string, { mae: number; rmse: number; mape: number }>;
}

/**
 * Model Performance Dashboard
 *
 * Features:
 * - Model accuracy cards (seasonal, zone-regression, pattern-matcher, anomaly-detector)
 * - MAE, RMSE, MAPE per model per zone
 * - Model weight distribution chart
 * - Recent prediction accuracy trend
 */
export default function ModelsPage() {
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const {
    data: rawData,
    loading,
    error,
  } = useApiQuery<{ items: ModelMetric[]; total: number }>(
    "/api/v4/analytics/demand-models",
  );
  const models = rawData?.items ?? [];

  const stats = useMemo(() => {
    return {
      totalModels: models.length,
      avgAccuracy: Math.round(
        models.reduce((sum, m) => sum + m.accuracy, 0) / (models.length || 1),
      ),
      improvingModels: models.filter((m) => m.trend === "improving").length,
      degradingModels: models.filter((m) => m.trend === "degrading").length,
    };
  }, [models]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "improving":
        return "text-wl-success-500";
      case "degrading":
        return "text-wl-danger-500";
      default:
        return "text-wl-warning-500";
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
                Model Performance
              </h1>
              <p className="text-sm text-wl-text-secondary mt-1">
                Demand forecast model analytics
              </p>
            </div>
            <Button variant="primary" size="md">
              <RefreshCw className="w-4 h-4" />
              Retrain Models
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-7xl">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                Total Models
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {stats.totalModels}
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">
                Active models
              </p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                Avg Accuracy
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {stats.avgAccuracy}%
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">
                Across all models
              </p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                Improving
              </p>
              <p className="text-2xl font-bold text-wl-success-500 mt-2">
                {stats.improvingModels}
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">
                Models trending up
              </p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                Degrading
              </p>
              <p className="text-2xl font-bold text-wl-danger-500 mt-2">
                {stats.degradingModels}
              </p>
              <Badge variant="danger" className="mt-2 text-xs">
                Needs Attention
              </Badge>
            </Card>
          </div>

          {/* Model Cards */}
          <div className="space-y-4">
            {models.length === 0 ? (
              <Card className="p-12 bg-wl-bg-surface border-wl-border-default text-center">
                <BrainCircuit className="w-12 h-12 text-wl-text-tertiary mx-auto mb-4" />
                <p className="text-wl-text-primary font-medium mb-1">
                  No models available
                </p>
                <p className="text-sm text-wl-text-secondary max-w-xs mx-auto">
                  Demand forecast models will appear here once training is
                  complete.
                </p>
                <Button variant="primary" size="sm" className="mt-4">
                  <RefreshCw className="w-4 h-4" />
                  Retrain Models
                </Button>
              </Card>
            ) : (
              models.map((model) => {
                const isExpanded = expandedModel === model.name;
                return (
                  <Card
                    key={model.name}
                    className="p-6 bg-wl-bg-surface border-wl-border-default cursor-pointer hover:border-wl-border-strong transition-colors"
                    onClick={() =>
                      setExpandedModel(isExpanded ? null : model.name)
                    }
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-wl-text-primary">
                            {model.name}
                          </h3>
                          <Badge
                            variant={
                              model.trend === "improving"
                                ? "success"
                                : model.trend === "degrading"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {model.trend}
                          </Badge>
                          <span className="text-xs text-wl-text-tertiary">
                            Weight: {Math.round(model.weight * 100)}%
                          </span>
                        </div>
                        <p className="text-sm text-wl-text-secondary">
                          {model.description}
                        </p>

                        {isExpanded && (
                          <div className="mt-6 pt-6 border-t border-wl-border-default/30 space-y-4">
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                                  Accuracy
                                </p>
                                <p className="text-2xl font-bold text-wl-text-primary mt-1">
                                  {model.accuracy}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                                  MAE
                                </p>
                                <p className="text-2xl font-bold text-wl-text-primary mt-1">
                                  {Math.round(model.mae)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                                  RMSE
                                </p>
                                <p className="text-2xl font-bold text-wl-text-primary mt-1">
                                  {Math.round(model.rmse)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                                  MAPE
                                </p>
                                <p className="text-2xl font-bold text-wl-text-primary mt-1">
                                  {Math.round(model.mape)}%
                                </p>
                              </div>
                            </div>

                            <div>
                              <p className="text-sm font-medium text-wl-text-secondary mb-3">
                                Zone Performance
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {Object.entries(model.zones).map(
                                  ([zone, metrics]) => (
                                    <div
                                      key={zone}
                                      className="p-3 bg-wl-bg-overlay rounded border border-wl-border-default"
                                    >
                                      <p className="font-medium text-wl-text-primary">
                                        {zone}
                                      </p>
                                      <p className="text-xs text-wl-text-tertiary mt-1">
                                        MAE: {Math.round(metrics.mae)}
                                      </p>
                                      <p className="text-xs text-wl-text-tertiary">
                                        RMSE: {Math.round(metrics.rmse)}
                                      </p>
                                      <p className="text-xs text-wl-text-tertiary">
                                        MAPE: {Math.round(metrics.mape)}%
                                      </p>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>

                            <p className="text-xs text-wl-text-tertiary">
                              Last Updated:{" "}
                              {new Date(model.lastUpdated).toLocaleString()}
                            </p>
                          </div>
                        )}
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
