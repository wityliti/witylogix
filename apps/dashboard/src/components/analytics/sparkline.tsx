"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
  showDot?: boolean;
  trendColor?: boolean;
}

/**
 * Tiny inline SVG sparkline for tables and cards
 * No axes or labels - just the line
 * Optional trend-based coloring (green for up, red for down)
 */
export function Sparkline({
  data,
  width = 80,
  height = 32,
  color,
  showArea = false,
  showDot = true,
  trendColor = false,
}: SparklineProps) {
  const { points, min, max, trend, finalColor } = useMemo(() => {
    if (!data || data.length === 0) {
      return { points: [], min: 0, max: 100, trend: "flat", finalColor: "#999" };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points: Array<[number, number]> = data.map((value, i) => [
      (i / (data.length - 1 || 1)) * width,
      height - ((value - min) / range) * (height - 4),
    ]);

    const trend = data[data.length - 1] > data[0] ? "up" : "down";
    let finalColor = color;

    if (trendColor) {
      finalColor = trend === "up" ? "#10b981" : "#ef4444";
    } else if (!color) {
      finalColor = "#3b82f6";
    }

    return { points, min, max, trend, finalColor };
  }, [data, width, height, color, trendColor]);

  if (points.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-wl-text-tertiary opacity-50"
      >
        <text x={width / 2} y={height / 2} textAnchor="middle" dy="0.3em">
          No data
        </text>
      </svg>
    );
  }

  // Generate path
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i][0]} ${points[i][1]}`;
  }

  // Area path
  let areaPath = path + ` L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      {/* Area under line */}
      {showArea && (
        <path
          d={areaPath}
          fill={finalColor}
          fillOpacity={0.1}
        />
      )}

      {/* Line */}
      <path
        d={path}
        stroke={finalColor}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Last point dot */}
      {showDot && points.length > 0 && (
        <circle
          cx={points[points.length - 1][0]}
          cy={points[points.length - 1][1]}
          r={2.5}
          fill={finalColor}
        />
      )}
    </svg>
  );
}
