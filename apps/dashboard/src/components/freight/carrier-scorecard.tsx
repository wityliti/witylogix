"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface CarrierScore {
  onTimePercentage: number;
  tenderAcceptance: number;
  claimsRatio: number;
  costEfficiency: number;
  safetyScore: number;
}

interface QuarterlyTrend {
  q: string;
  score: number;
}

export interface CarrierScorecardProps {
  name: string;
  carrierId: string;
  scores: CarrierScore;
  quarterlyTrends?: QuarterlyTrend[];
  onViewDetails?: (carrierId: string) => void;
  onSendReview?: (carrierId: string) => void;
  onAdjustAllocation?: (carrierId: string) => void;
  className?: string;
}

/**
 * Carrier Scorecard Component
 * Displays carrier performance with radar chart, grade, and trends
 */
export function CarrierScorecard({
  name,
  carrierId,
  scores,
  quarterlyTrends = [],
  onViewDetails,
  onSendReview,
  onAdjustAllocation,
  className,
}: CarrierScorecardProps) {
  // Calculate overall grade
  const overallScore = useMemo(() => {
    return Math.round(
      (scores.onTimePercentage * 0.25 +
        scores.tenderAcceptance * 0.25 +
        (100 - scores.claimsRatio) * 0.2 +
        scores.costEfficiency * 0.2 +
        scores.safetyScore * 0.1) /
        1
    );
  }, [scores]);

  const getGrade = (score: number): { letter: string; color: string } => {
    if (score >= 90) return { letter: "A", color: "text-wl-success-400" };
    if (score >= 80) return { letter: "B", color: "text-wl-success-400" };
    if (score >= 70) return { letter: "C", color: "text-wl-warning-400" };
    if (score >= 60) return { letter: "D", color: "text-wl-danger-400" };
    return { letter: "F", color: "text-wl-danger-500" };
  };

  const getGradeBg = (score: number): string => {
    if (score >= 90) return "bg-wl-success-500/20";
    if (score >= 80) return "bg-wl-success-500/15";
    if (score >= 70) return "bg-wl-warning-500/20";
    if (score >= 60) return "bg-wl-danger-500/20";
    return "bg-wl-danger-600/20";
  };

  const grade = getGrade(overallScore);

  // Trend indicator helper
  const getTrendIndicator = (current: number, previous: number) => {
    const diff = current - previous;
    if (Math.abs(diff) < 1) return { arrow: "→", color: "text-wl-text-secondary" };
    return diff > 0
      ? { arrow: "↑", color: "text-wl-success-400" }
      : { arrow: "↓", color: "text-wl-danger-400" };
  };

  // SVG Radar Chart
  const renderRadarChart = () => {
    const size = 200;
    const center = size / 2;
    const radius = 70;
    const maxScore = 100;

    const metrics = [
      { label: "On-Time %", value: scores.onTimePercentage, angle: -Math.PI / 2 },
      { label: "Tender Accept", value: scores.tenderAcceptance, angle: -Math.PI / 2 + (Math.PI * 2) / 5 },
      { label: "Claims Ratio", value: 100 - scores.claimsRatio, angle: -Math.PI / 2 + (Math.PI * 4) / 5 },
      { label: "Cost Efficiency", value: scores.costEfficiency, angle: -Math.PI / 2 + (Math.PI * 6) / 5 },
      { label: "Safety", value: scores.safetyScore, angle: -Math.PI / 2 + (Math.PI * 8) / 5 },
    ];

    // Generate web polygon points
    const webPoints = metrics
      .map((m) => {
        const r = (m.value / maxScore) * radius;
        const x = center + r * Math.cos(m.angle);
        const y = center + r * Math.sin(m.angle);
        return `${x},${y}`;
      })
      .join(" ");

    // Generate background web
    const webLevels = [20, 40, 60, 80, 100];
    const webPaths = webLevels.map((level) => {
      const levelPoints = metrics
        .map((m) => {
          const r = ((level / 100) * radius);
          const x = center + r * Math.cos(m.angle);
          const y = center + r * Math.sin(m.angle);
          return `${x},${y}`;
        })
        .join(" ");
      return levelPoints;
    });

    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto"
      >
        {/* Background web */}
        {webPaths.map((path, i) => (
          <polygon
            key={`web-${i}`}
            points={path}
            fill="none"
            stroke="var(--wl-border-subtle)"
            strokeWidth="0.5"
            opacity="0.5"
          />
        ))}

        {/* Axes */}
        {metrics.map((m, i) => (
          <line
            key={`axis-${i}`}
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(m.angle)}
            y2={center + radius * Math.sin(m.angle)}
            stroke="var(--wl-border-subtle)"
            strokeWidth="0.5"
            opacity="0.3"
          />
        ))}

        {/* Score polygon */}
        <polygon
          points={webPoints}
          fill="rgb(59, 130, 246, 0.2)"
          stroke="rgb(59, 130, 246)"
          strokeWidth="2"
        />

        {/* Data points */}
        {metrics.map((m, i) => {
          const r = (m.value / maxScore) * radius;
          const x = center + r * Math.cos(m.angle);
          const y = center + r * Math.sin(m.angle);
          return (
            <circle
              key={`point-${i}`}
              cx={x}
              cy={y}
              r="3"
              fill="rgb(59, 130, 246)"
              stroke="var(--wl-bg-primary)"
              strokeWidth="1"
            />
          );
        })}

        {/* Labels */}
        {metrics.map((m, i) => {
          const labelDistance = radius + 30;
          const x = center + labelDistance * Math.cos(m.angle);
          const y = center + labelDistance * Math.sin(m.angle);
          return (
            <text
              key={`label-${i}`}
              x={x}
              y={y}
              textAnchor="middle"
              dy="0.3em"
              fontSize="10"
              fill="var(--wl-text-secondary)"
            >
              {m.label}
            </text>
          );
        })}
      </svg>
    );
  };

  const previousQuarterScore = quarterlyTrends.length >= 2
    ? quarterlyTrends[quarterlyTrends.length - 2]?.score || overallScore
    : overallScore;

  const trend = getTrendIndicator(overallScore, previousQuarterScore);

  return (
    <div
      className={cn(
        "rounded-lg border border-wl-border-default bg-wl-bg-elevated p-6 space-y-6",
        className
      )}
    >
      {/* Header with Grade */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-wl-text-primary">{name}</h3>
          <p className="text-xs text-wl-text-secondary mt-1">ID: {carrierId}</p>
        </div>

        <div className="flex items-end gap-4 flex-shrink-0 ml-4">
          {/* Overall Grade Badge */}
          <div className="text-center">
            <div
              className={cn(
                "w-20 h-20 rounded-lg flex items-center justify-center font-bold text-4xl",
                getGradeBg(overallScore)
              )}
            >
              <span className={grade.color}>{grade.letter}</span>
            </div>
            <p className="text-xs text-wl-text-secondary mt-2">Score</p>
            <p className="text-sm font-semibold text-wl-text-primary">
              {overallScore}/100
            </p>
          </div>

          {/* Trend Indicator */}
          <div className="text-center pb-2">
            <span className={cn("text-2xl", trend.color)}>{trend.arrow}</span>
            <p className="text-xs text-wl-text-secondary mt-1">QoQ Trend</p>
          </div>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="flex justify-center border-y border-wl-border-default py-4">
        {renderRadarChart()}
      </div>

      {/* Detailed Metrics */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-wl-text-secondary uppercase">
          Performance Metrics
        </h4>

        <div className="space-y-2">
          {[
            {
              label: "On-Time %",
              value: scores.onTimePercentage,
              color: "wl-primary-400",
            },
            {
              label: "Tender Acceptance",
              value: scores.tenderAcceptance,
              color: "wl-primary-400",
            },
            {
              label: "Claims Ratio",
              value: `${scores.claimsRatio.toFixed(2)}%`,
              color: "wl-warning-400",
            },
            {
              label: "Cost Efficiency",
              value: scores.costEfficiency,
              color: "wl-primary-400",
            },
            {
              label: "Safety Score",
              value: scores.safetyScore,
              color: "wl-success-400",
            },
          ].map((metric) => (
            <div key={metric.label} className="flex items-center justify-between">
              <span className="text-xs text-wl-text-secondary">{metric.label}</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 bg-wl-bg-secondary rounded-full w-20">
                  <div
                    className={cn("h-full rounded-full", `bg-${metric.color}`)}
                    style={{
                      width: `${typeof metric.value === 'string' ? 50 : Math.min(metric.value, 100)}%`,
                    }}
                  />
                </div>
                <span className={cn("text-xs font-semibold text-${metric.color}")}>
                  {metric.value}
                  {typeof metric.value === 'number' ? '%' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quarterly Comparison */}
      {quarterlyTrends.length > 0 && (
        <div className="border-t border-wl-border-default pt-4">
          <h4 className="text-xs font-semibold text-wl-text-secondary uppercase mb-3">
            Quarterly Trend
          </h4>
          <div className="flex items-end gap-2">
            {quarterlyTrends.slice(-4).map((q, i) => (
              <div key={q.q} className="flex-1 text-center">
                <div className="h-12 bg-wl-bg-secondary rounded flex items-end justify-center mb-2">
                  <div
                    className="w-2/3 rounded-t bg-wl-primary-500"
                    style={{ height: `${(q.score / 100) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-wl-text-secondary">{q.q}</p>
                <p className="text-xs font-semibold text-wl-text-primary">
                  {q.score}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="border-t border-wl-border-default pt-4 flex gap-2 flex-wrap">
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(carrierId)}
            className="text-xs px-3 py-1.5 rounded bg-wl-bg-secondary text-wl-text-primary hover:bg-wl-border-default transition-colors font-medium"
          >
            View Details
          </button>
        )}
        {onSendReview && (
          <button
            onClick={() => onSendReview(carrierId)}
            className="text-xs px-3 py-1.5 rounded bg-wl-primary-500/20 text-wl-primary-400 hover:bg-wl-primary-500/30 transition-colors font-medium"
          >
            Send Review
          </button>
        )}
        {onAdjustAllocation && (
          <button
            onClick={() => onAdjustAllocation(carrierId)}
            className="text-xs px-3 py-1.5 rounded bg-wl-warning-500/20 text-wl-warning-400 hover:bg-wl-warning-500/30 transition-colors font-medium ml-auto"
          >
            Adjust Allocation
          </button>
        )}
      </div>
    </div>
  );
}
