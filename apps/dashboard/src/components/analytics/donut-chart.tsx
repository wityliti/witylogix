"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

interface DonutChartData {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutChartData[];
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  centerLabel?: string;
  animate?: boolean;
  height?: number;
}

/**
 * SVG-based donut/pie chart with animations
 * Features: configurable inner radius, legends, tooltips, animations
 */
export function DonutChart({
  data,
  innerRadius = 60,
  outerRadius = 100,
  showLegend = true,
  centerLabel,
  animate = true,
  height = 400,
}: DonutChartProps) {
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const [tooltipData, setTooltipData] = useState<any>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Default colors
  const defaultColors = [
    "var(--wl-info-500)",
    "var(--wl-success-500)",
    "var(--wl-warning-500)",
    "var(--wl-danger-500)",
    "var(--wl-chart-purple)",
    "var(--wl-chart-rose)",
    "var(--wl-chart-teal)",
    "var(--wl-chart-green)",
  ];

  const chartData = useMemo(
    () =>
      data.map((d, i) => ({
        ...d,
        color: d.color || defaultColors[i % defaultColors.length],
      })),
    [data]
  );

  const total = useMemo(
    () => chartData.reduce((sum, d) => sum + d.value, 0),
    [chartData]
  );

  // Generate SVG path for arc
  const describeArc = (
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ): string => {
    const start = {
      x: x + radius * Math.cos(startAngle),
      y: y + radius * Math.sin(startAngle),
    };
    const end = {
      x: x + radius * Math.cos(endAngle),
      y: y + radius * Math.sin(endAngle),
    };
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    return [
      `M ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    ].join(" ");
  };

  // Create donut segments
  const segments = useMemo(() => {
    const segments: { index: number; label: string; value: number; percentage: string; color: string | undefined; path: string; midAngle: number }[] = [];
    let currentAngle = -Math.PI / 2; // Start from top

    chartData.forEach((item, index) => {
      const percentage = item.value / total;
      const sliceAngle = percentage * 2 * Math.PI;
      const endAngle = currentAngle + sliceAngle;

      // Outer arc
      const outerPath = describeArc(
        150,
        150,
        outerRadius,
        currentAngle,
        endAngle
      );
      // Inner arc
      const innerPath = describeArc(
        150,
        150,
        innerRadius,
        endAngle,
        currentAngle
      );

      segments.push({
        index,
        label: item.label,
        value: item.value,
        percentage: (percentage * 100).toFixed(1),
        color: item.color,
        path: `${outerPath} ${innerPath} Z`,
        midAngle: currentAngle + sliceAngle / 2,
      });

      currentAngle = endAngle;
    });

    return segments;
  }, [chartData, total, outerRadius, innerRadius]);

  const handleSegmentMouseEnter = useCallback(
    (index: number, event: React.MouseEvent) => {
      setHoveredSegment(index);
      setTooltipData({
        label: segments[index].label,
        value: segments[index].value,
        percentage: segments[index].percentage,
      });
      setTooltipPos({ x: event.clientX, y: event.clientY });
      setTooltipVisible(true);
    },
    [segments]
  );

  const handleSegmentMouseLeave = () => {
    setHoveredSegment(null);
    setTooltipVisible(false);
  };

  // Calculate center label
  const getCenterLabel = () => {
    if (centerLabel) return centerLabel;
    return total.toLocaleString();
  };

  const viewBoxSize = 300;

  return (
    <div className="flex flex-col items-center gap-6" style={{ height }}>
      {/* Chart */}
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        preserveAspectRatio="xMidYMid meet"
        className="flex-1"
        style={{ maxWidth: 300 }}
      >
        {/* Segments */}
        {segments.map((segment) => (
          <g key={segment.index}>
            {/* Segment path */}
            <path
              d={segment.path}
              fill={segment.color}
              opacity={
                hoveredSegment === null || hoveredSegment === segment.index
                  ? 1
                  : 0.4
              }
              onMouseEnter={(e) => handleSegmentMouseEnter(segment.index, e)}
              onMouseLeave={handleSegmentMouseLeave}
              style={{
                cursor: "pointer",
                transition: "opacity 200ms, filter 200ms",
                filter:
                  hoveredSegment === segment.index
                    ? "drop-shadow(0 0 8px rgba(0, 0, 0, 0.3))"
                    : "none",
                animation: animate
                  ? `sweepAnimation 0.6s ease-out ${segment.index * 50}ms backwards`
                  : "none",
                transformOrigin: "150px 150px",
              }}
            />
          </g>
        ))}

        {/* Center circle for donut hole */}
        <circle
          cx={150}
          cy={150}
          r={innerRadius}
          fill="var(--wl-bg-elevated)"
        />

        {/* Center label */}
        <text
          x={150}
          y={150}
          textAnchor="middle"
          dy="0.3em"
          fontSize="24"
          fontWeight="bold"
          fill="var(--wl-text-primary)"
          className="pointer-events-none"
        >
          {getCenterLabel()}
        </text>
      </svg>

      {/* Tooltip */}
      <ChartTooltip
        visible={tooltipVisible}
        x={tooltipPos.x}
        y={tooltipPos.y}
        data={tooltipData}
        renderContent={(data) => (
          <div className="space-y-1">
            <p className="font-semibold text-wl-text-primary">
              {data?.label}
            </p>
            <p className="text-wl-text-secondary text-xs">
              {data?.value} ({data?.percentage}%)
            </p>
          </div>
        )}
      />

      {/* Legend */}
      {showLegend && (
        <div className="w-full flex flex-wrap gap-3 justify-center px-4">
          {chartData.map((item, index) => (
            <div
              key={item.label}
              className="flex items-center gap-2 text-xs text-wl-text-secondary"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span>
                {item.label}: {item.value}
              </span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes sweepAnimation {
          from {
            opacity: 0;
            transform: rotate(-180deg);
          }
          to {
            opacity: 1;
            transform: rotate(0deg);
          }
        }
      `}</style>
    </div>
  );
}
