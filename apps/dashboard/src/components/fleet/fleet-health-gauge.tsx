"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface HealthSegment {
  name: string;
  score: number;
  color: string;
  weight: number;
}

interface FleetHealthGaugeProps {
  vehicleHealth: number;
  fuelEfficiency: number;
  driverBehavior: number;
  maintenanceCompliance: number;
  height?: number;
  showLegend?: boolean;
  className?: string;
}

/**
 * Pure SVG radial gauge showing fleet health score
 * Features: colored segments, center score, weighted calculation
 */
export function FleetHealthGauge({
  vehicleHealth,
  fuelEfficiency,
  driverBehavior,
  maintenanceCompliance,
  height = 350,
  showLegend = true,
  className,
}: FleetHealthGaugeProps) {
  const segments: HealthSegment[] = useMemo(
    () => [
      {
        name: "Vehicle Health",
        score: vehicleHealth,
        color: "var(--wl-info-500)",
        weight: 0.3,
      },
      {
        name: "Fuel Efficiency",
        score: fuelEfficiency,
        color: "var(--wl-success-500)",
        weight: 0.25,
      },
      {
        name: "Driver Behavior",
        score: driverBehavior,
        color: "var(--wl-warning-500)",
        weight: 0.25,
      },
      {
        name: "Maintenance",
        score: maintenanceCompliance,
        color: "var(--wl-chart-purple)",
        weight: 0.2,
      },
    ],
    [vehicleHealth, fuelEfficiency, driverBehavior, maintenanceCompliance]
  );

  // Calculate weighted overall score
  const overallScore = useMemo(() => {
    return Math.round(
      segments.reduce((sum, seg) => sum + seg.score * seg.weight, 0)
    );
  }, [segments]);

  const width = height;
  const centerX = width / 2;
  const centerY = height * 0.55;
  const outerRadius = Math.min(width, height) * 0.35;
  const innerRadius = outerRadius * 0.6;
  const gaugeRadius = (outerRadius + innerRadius) / 2;

  // Calculate arc angles for each segment
  const arcStartAngle = -Math.PI * 0.7; // Start angle (-126 degrees)
  const arcEndAngle = Math.PI * 0.7;   // End angle (126 degrees)
  const totalArcAngle = arcEndAngle - arcStartAngle;

  const segmentAngles = segments.map((seg, i) => {
    const prevAngle = segments
      .slice(0, i)
      .reduce((sum, s) => sum + (totalArcAngle / segments.length), arcStartAngle);
    const angle = totalArcAngle / segments.length;
    return { start: prevAngle, end: prevAngle + angle, segment: seg };
  });

  // Create arc path
  const createArcPath = (
    startAngle: number,
    endAngle: number,
    radius: number
  ): string => {
    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Scoring color
  const getScoreColor = (score: number): string => {
    if (score >= 80) return "var(--wl-success-500)";
    if (score >= 60) return "var(--wl-warning-500)";
    return "var(--wl-danger-500)";
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="bg-transparent"
      >
        {/* Background segments */}
        {segmentAngles.map((seg, i) => (
          <path
            key={`bg-segment-${i}`}
            d={createArcPath(seg.start, seg.end, gaugeRadius)}
            stroke="var(--wl-border-subtle)"
            strokeWidth={outerRadius - innerRadius}
            fill="none"
            strokeLinecap="round"
          />
        ))}

        {/* Colored segments */}
        {segmentAngles.map((seg, i) => {
          const arcLength =
            gaugeRadius *
            (seg.segment.score / 100) *
            (seg.end - seg.start);

          return (
            <g key={`segment-${i}`}>
              {/* Score arc */}
              <path
                d={createArcPath(
                  seg.start,
                  seg.start + ((seg.end - seg.start) * seg.segment.score) / 100,
                  gaugeRadius
                )}
                stroke={seg.segment.color}
                strokeWidth={outerRadius - innerRadius}
                fill="none"
                strokeLinecap="round"
              />

              {/* Segment label */}
              {i % 2 === 0 && (
                <>
                  <text
                    x={centerX + (gaugeRadius + 30) * Math.cos((seg.start + seg.end) / 2)}
                    y={centerY + (gaugeRadius + 30) * Math.sin((seg.start + seg.end) / 2) + 4}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--wl-text-secondary)"
                  >
                    {seg.segment.score}%
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Center circle with score */}
        <circle
          cx={centerX}
          cy={centerY}
          r={innerRadius * 0.7}
          fill="var(--wl-bg-elevated)"
          stroke="var(--wl-border-subtle)"
          strokeWidth={1}
        />

        {/* Overall score text */}
        <text
          x={centerX}
          y={centerY - 8}
          textAnchor="middle"
          fontSize="48"
          fontWeight="bold"
          fill={getScoreColor(overallScore)}
        >
          {overallScore}
        </text>
        <text
          x={centerX}
          y={centerY + 16}
          textAnchor="middle"
          fontSize="12"
          fill="var(--wl-text-secondary)"
        >
          FLEET HEALTH
        </text>
      </svg>

      {/* Legend */}
      {showLegend && (
        <div className="w-full space-y-2">
          {segments.map((seg) => (
            <div
              key={seg.name}
              className="flex items-center justify-between text-xs px-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-wl-text-secondary truncate">
                  {seg.name}
                </span>
              </div>
              <span className="font-semibold text-wl-text-primary flex-shrink-0 ml-2">
                {seg.score}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Score interpretation */}
      <div className="w-full text-center">
        <p className="text-xs text-wl-text-secondary">
          {overallScore >= 80
            ? "Excellent fleet condition"
            : overallScore >= 60
              ? "Good fleet condition"
              : "Action required"}
        </p>
      </div>
    </div>
  );
}
