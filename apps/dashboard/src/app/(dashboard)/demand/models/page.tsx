"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertTriangle,
  Zap,
  BarChart3,
  TrendingUp,
  RefreshCw,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ModelMetrics {
  name: string;
  description: string;
  mae: number;
  rmse: number;
  mape: number;
  accuracy: number;
  weight: number;
  lastUpdated: Date;
  trend: "improving" | "stable" | "degrading";
  zones: Record<string, { mae: number; rmse: number; mape: number }>;
}

interface AccuracyTrend {
  date: string;
  accuracy: number;
  mae: number;
}

interface ModelStats {
  totalModels: number;
  avgAccuracy: number;
  lastTrainTime: Date;
  nextTrainTime: Date;
}

/**
 * Model Performance Dashboard
 *
 * Features:
 * - Model accuracy cards (seasonal, zone-regression, pattern-matcher, anomaly-detector)
 * - MAE, RMSE, MAPE per model per zone
 * - Model weight distribution chart
 * - Recent prediction accuracy trend
 * - "Retrain" action button
 */
export default function ModelsPage() {
  // State
  const [models, setModels] = useState<ModelMetrics[]>([]);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [trends, setTrends] = useState<AccuracyTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetraining, setIsRetraining] = useState(false);
  const [retrainSuccess, setRetrainSuccess] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Load model data
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Mock model data
        const mockModels: ModelMetrics[] = [
          {
            name: "Seasonal Model",
            description: "SARIMA forecasting with seasonal decomposition",
            mae: 42.5,
            rmse: 58.3,
            mape: 3.2,
            accuracy: 94.2,
            weight: 0.35,
            lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            trend: "improving",
            zones: {
              Downtown: { mae: 38.2, rmse: 52.1, mape: 2.9 },
              Midtown: { mae: 45.3, rmse: 61.2, mape: 3.4 },
              Uptown: { mae: 42.1, rmse: 58.9, mape: 3.1 },
              Riverside: { mae: 48.7, rmse: 63.4, mape: 3.6 },
              Westside: { mae: 40.2, rmse: 55.8, mape: 3.0 },
              Eastside: { mae: 44.6, rmse: 60.3, mape: 3.3 },
            },
          },
          {
            name: "Zone Regression",
            description: "Multi-zone linear regression with spatial features",
            mae: 35.8,
            rmse: 48.2,
            mape: 2.8,
            accuracy: 95.1,
            weight: 0.30,
            lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            trend: "improving",
            zones: {
              Downtown: { mae: 32.5, rmse: 44.3, mape: 2.5 },
              Midtown: { mae: 38.2, rmse: 50.1, mape: 3.0 },
              Uptown: { mae: 35.6, rmse: 47.8, mape: 2.7 },
              Riverside: { mae: 39.4, rmse: 51.2, mape: 3.1 },
              Westside: { mae: 34.1, rmse: 46.2, mape: 2.6 },
              Eastside: { mae: 37.8, rmse: 49.6, mape: 2.9 },
            },
          },
          {
            name: "Pattern Matcher",
            description: "CNN with temporal pattern recognition",
            mae: 48.2,
            rmse: 65.1,
            mape: 3.8,
            accuracy: 92.8,
            weight: 0.20,
            lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            trend: "stable",
            zones: {
              Downtown: { mae: 44.3, rmse: 60.2, mape: 3.5 },
              Midtown: { mae: 50.1, rmse: 67.3, mape: 4.0 },
              Uptown: { mae: 48.5, rmse: 64.8, mape: 3.8 },
              Riverside: { mae: 52.3, rmse: 69.4, mape: 4.2 },
              Westside: { mae: 46.8, rmse: 62.7, mape: 3.7 },
              Eastside: { mae: 49.7, rmse: 66.2, mape: 3.9 },
            },
          },
          {
            name: "Anomaly Detector",
            description: "GRU network for detecting demand anomalies",
            mae: 51.3,
            rmse: 68.9,
            mape: 4.1,
            accuracy: 91.4,
            weight: 0.15,
            lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            trend: "degrading",
            zones: {
              Downtown: { mae: 47.2, rmse: 63.5, mape: 3.8 },
              Midtown: { mae: 53.4, rmse: 71.2, mape: 4.3 },
              Uptown: { mae: 51.6, rmse: 69.1, mape: 4.2 },
              Riverside: { mae: 55.2, rmse: 72.8, mape: 4.5 },
              Westside: { mae: 49.5, rmse: 66.4, mape: 4.0 },
              Eastside: { mae: 52.8, rmse: 70.3, mape: 4.2 },
            },
          },
        ];

        // Calculate stats
        const mockStats: ModelStats = {
          totalModels: mockModels.length,
          avgAccuracy: Math.round(
            mockModels.reduce((sum, m) => sum + m.accuracy, 0) / mockModels.length
          ),
          lastTrainTime: new Date(Date.now() - 48 * 60 * 60 * 1000),
          nextTrainTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        };

        // Generate accuracy trends (last 30 days)
        const mockTrends: AccuracyTrend[] = Array.from({ length: 30 }, (_, i) => {
          const daysAgo = 29 - i;
          const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
          const baseAccuracy = 92 + Math.sin(daysAgo / 5) * 2;
          const noise = (Math.random() - 0.5) * 1.5;

          return {
            date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            accuracy: Math.round((baseAccuracy + noise) * 10) / 10,
            mae: Math.round((45 - Math.sin(daysAgo / 5) * 5 + (Math.random() - 0.5) * 3) * 10) / 10,
          };
        });

        setModels(mockModels);
        setStats(mockStats);
        setTrends(mockTrends);
        setSelectedModel(mockModels[0].name);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load model data";
        setError(errorMessage);
        console.error("Model error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadModels();
  }, []);

  // Handle retrain
  const handleRetrain = useCallback(async () => {
    try {
      setIsRetraining(true);
      setRetrainSuccess(false);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 3000));

      setRetrainSuccess(true);
      setTimeout(() => setRetrainSuccess(false), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Retrain failed";
      setError(errorMessage);
    } finally {
      setIsRetraining(false);
    }
  }, []);

  // Render weight distribution chart
  const renderWeightChart = () => {
    if (models.length === 0) return null;

    const chartHeight = 200;
    const chartWidth = 400;
    const centerX = chartWidth / 2;
    const centerY = chartHeight / 2;
    const radius = 80;

    const colors = [
      "var(--wl-primary-500)",
      "var(--wl-success-500)",
      "var(--wl-warning-500)",
      "var(--wl-danger-500)",
      "var(--wl-info-500)",
    ];

    let startAngle = -Math.PI / 2;
    const slices: Array<{
      path: string;
      color: string;
      percentage: number;
      name: string;
    }> = [];

    models.forEach((model, idx) => {
      const sliceAngle = (model.weight * 2 * Math.PI);
      const endAngle = startAngle + sliceAngle;

      const x1 = centerX + radius * Math.cos(startAngle);
      const y1 = centerY + radius * Math.sin(startAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const path = `
        M ${centerX} ${centerY}
        L ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
        Z
      `;

      slices.push({
        path,
        color: colors[idx % colors.length],
        percentage: Math.round(model.weight * 100),
        name: model.name,
      });

      startAngle = endAngle;
    });

    return (
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto"
        role="img"
        aria-label="Model weight distribution pie chart"
      >
        {slices.map((slice, idx) => (
          <g key={idx}>
            <path
              d={slice.path}
              fill={slice.color}
              opacity="0.8"
            />
          </g>
        ))}
      </svg>
    );
  };

  // Render accuracy trend line
  const renderAccuracyTrend = () => {
    if (trends.length === 0) return null;

    const chartHeight = 280;
    const chartWidth = 700;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const minAccuracy = 88;
    const maxAccuracy = 97;
    const accuracyRange = maxAccuracy - minAccuracy;

    const points = trends.map((t, idx) => {
      const x = padding.left + (idx / (trends.length - 1)) * innerWidth;
      const y = padding.top + innerHeight - ((t.accuracy - minAccuracy) / accuracyRange) * innerHeight;
      return { x, y, accuracy: t.accuracy, date: t.date };
    });

    const pathD = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

    return (
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto"
        role="img"
        aria-label="Model accuracy trend over 30 days"
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
          const value = Math.round(minAccuracy + ratio * accuracyRange);
          return (
            <text
              key={`ylabel-${ratio}`}
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              className="text-xs"
              fill="var(--wl-text-secondary)"
            >
              {value}%
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

        {/* Line path */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--wl-primary-500)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />

        {/* Data points */}
        {points.map((p, idx) => (
          <circle
            key={`point-${idx}`}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="var(--wl-primary-500)"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* X-axis labels (every 5 days) */}
        {points.map((p, idx) => {
          if (idx % 5 !== 0) return null;
          return (
            <text
              key={`xlabel-${idx}`}
              x={p.x}
              y={chartHeight - padding.bottom + 20}
              textAnchor="middle"
              className="text-xs"
              fill="var(--wl-text-secondary)"
            >
              {p.date}
            </text>
          );
        })}
      </svg>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-wl-bg-primary">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-wl-primary-500/20 border-t-wl-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-wl-text-secondary">Loading model performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-wl-bg-primary">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-wl-danger-500 mx-auto mb-4" />
          <p className="text-wl-text-primary font-medium">Error loading models</p>
          <p className="text-wl-text-secondary text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const selectedModelData = models.find((m) => m.name === selectedModel);

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">Model Performance</h1>
              <p className="text-sm text-wl-text-secondary mt-1">
                Forecast accuracy and ensemble model metrics
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleRetrain}
              disabled={isRetraining}
              className={cn(isRetraining && "opacity-75")}
            >
              {isRetraining ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-white animate-spin" />
                  Retraining...
                </>
              ) : retrainSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Models Retrained
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Retrain Models
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-7xl">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Active Models
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">{stats?.totalModels || 0}</p>
              <p className="text-xs text-wl-text-secondary mt-2">In ensemble</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Avg Accuracy
              </p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">{stats?.avgAccuracy}%</p>
              <Badge variant="success" className="mt-2 text-xs">
                Excellent
              </Badge>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">
                Last Training
              </p>
              <p className="text-sm font-semibold text-wl-text-primary mt-2">
                {stats?.lastTrainTime.toLocaleDateString()}
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">
                Next: {stats?.nextTrainTime.toLocaleDateString()}
              </p>
            </Card>
          </div>

          {/* Model Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {models.map((model) => (
              <Card
                key={model.name}
                className={cn(
                  "p-4 border-wl-border-default cursor-pointer transition-all hover:border-wl-primary-500/50",
                  selectedModel === model.name && "border-wl-primary-500 bg-wl-primary-500/5"
                )}
                onClick={() => setSelectedModel(model.name)}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-semibold text-wl-text-primary">{model.name}</h3>
                    <p className="text-xs text-wl-text-secondary mt-1">{model.description}</p>
                  </div>
                  <Badge
                    variant={
                      model.trend === "improving"
                        ? "success"
                        : model.trend === "stable"
                        ? "info"
                        : "warning"
                    }
                  >
                    {model.trend}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-wl-text-tertiary mb-1">MAE</p>
                    <p className="text-sm font-semibold text-wl-text-primary">{model.mae.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-wl-text-tertiary mb-1">RMSE</p>
                    <p className="text-sm font-semibold text-wl-text-primary">{model.rmse.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-wl-text-tertiary mb-1">MAPE</p>
                    <p className="text-sm font-semibold text-wl-text-primary">{model.mape.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-wl-border-default/50">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-wl-text-secondary">Accuracy</span>
                    <span className="font-semibold text-wl-text-primary">{model.accuracy}%</span>
                  </div>
                  <div className="h-2 bg-wl-bg-overlay rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-success-500"
                      style={{ width: `${model.accuracy}%` }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Selected Model Details */}
          {selectedModelData && (
            <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
              <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
                {selectedModelData.name} - Zone Performance
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-default">
                      <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Zone</th>
                      <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">MAE</th>
                      <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">RMSE</th>
                      <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">MAPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selectedModelData.zones).map(([zone, metrics], idx) => (
                      <tr
                        key={zone}
                        className={cn(
                          "border-b border-wl-border-default hover:bg-wl-bg-overlay transition-colors",
                          idx % 2 === 0 ? "bg-wl-bg-surface" : "bg-transparent"
                        )}
                      >
                        <td className="px-4 py-3 font-medium text-wl-text-primary">{zone}</td>
                        <td className="text-right px-4 py-3 text-wl-text-secondary">
                          {metrics.mae.toFixed(1)}
                        </td>
                        <td className="text-right px-4 py-3 text-wl-text-secondary">
                          {metrics.rmse.toFixed(1)}
                        </td>
                        <td className="text-right px-4 py-3 text-wl-text-secondary">
                          {metrics.mape.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Model Weight Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-6 bg-wl-bg-surface border-wl-border-default lg:col-span-2">
              <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
                <BarChart3 className="w-5 h-5 inline mr-2" />
                Accuracy Trend (30 Days)
              </h2>
              {renderAccuracyTrend()}
            </Card>

            <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
              <h2 className="text-lg font-semibold text-wl-text-primary mb-4">Model Weights</h2>
              <div className="flex justify-center mb-6">{renderWeightChart()}</div>
              <div className="space-y-3 text-sm">
                {models.map((model, idx) => (
                  <div key={model.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: [
                            "var(--wl-primary-500)",
                            "var(--wl-success-500)",
                            "var(--wl-warning-500)",
                            "var(--wl-danger-500)",
                          ][idx % 4],
                        }}
                      />
                      <span className="text-wl-text-secondary truncate">{model.name}</span>
                    </div>
                    <span className="font-semibold text-wl-text-primary whitespace-nowrap">
                      {Math.round(model.weight * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Model Info */}
          <Card className="p-4 bg-wl-info-500/10 border border-wl-info-500/30">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-wl-info-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-wl-info-300">
                <p className="font-semibold mb-1">Ensemble Strategy</p>
                <p>
                  The system uses a weighted ensemble of 4 machine learning models. Each model is
                  automatically retrained daily to capture changing demand patterns. Model weights are
                  adjusted based on recent accuracy performance.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Placeholder for CheckCircle import if needed
const CheckCircle = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
);
