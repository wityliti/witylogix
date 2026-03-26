"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface HOSGaugeProps {
  hoursRemaining: number;
  maxHours: number;
  label?: string;
  variant?: "driving" | "window" | "cycle";
  animated?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * HOS Gauge Component
 * Circular gauge for Hours of Service remaining
 * Supports driving (11h), window (14h), and cycle (70h) limits
 * Gradient fill: green → yellow → red as time depletes
 */
export function HOSGauge({
  hoursRemaining,
  maxHours,
  label = "Hours Remaining",
  variant = "driving",
  animated = true,
  size = "md",
  className,
}: HOSGaugeProps) {
  const [displayHours, setDisplayHours] = useState(hoursRemaining);
  const [animate, setAnimate] = useState(false);

  // Animate when value changes
  useEffect(() => {
    if (animated && displayHours !== hoursRemaining) {
      setAnimate(true);
      const timer = setTimeout(() => {
        setDisplayHours(hoursRemaining);
        setAnimate(false);
      }, 400);
      return () => clearTimeout(timer);
    }
    setDisplayHours(hoursRemaining);
  }, [hoursRemaining, animated, displayHours]);

  // Determine size values
  const sizeConfig = {
    sm: { gauge: 80, radius: 32, inner: 20, textSize: 16, labelSize: 10 },
    md: { gauge: 140, radius: 56, inner: 35, textSize: 32, labelSize: 12 },
    lg: { gauge: 200, radius: 80, inner: 50, textSize: 48, labelSize: 14 },
  };

  const config = sizeConfig[size];
  const percentage = (displayHours / maxHours) * 100;

  // Determine color based on remaining percentage
  const getGaugeColor = (): string => {
    if (percentage > 50) return "url(#gaugeGradientGreen)";
    if (percentage > 25) return "url(#gaugeGradientYellow)";
    return "url(#gaugeGradientRed)";
  };

  const getTextColor = (): string => {
    if (percentage > 50) return "#10b981"; // success
    if (percentage > 25) return "#f59e0b"; // warning
    return "#ef4444"; // danger
  };

  // Format display time
  const hours = Math.floor(displayHours);
  const minutes = Math.round((displayHours - hours) * 60);

  // SVG arc path helper
  const createArcPath = (
    startAngle: number,
    endAngle: number,
    radius: number,
    innerRadius: number
  ): string => {
    const start = startAngle * (Math.PI / 180);
    const end = endAngle * (Math.PI / 180);
    const centerX = config.gauge / 2;
    const centerY = config.gauge / 2;

    const x1 = centerX + radius * Math.cos(start);
    const y1 = centerY + radius * Math.sin(start);
    const x2 = centerX + radius * Math.cos(end);
    const y2 = centerY + radius * Math.sin(end);
    const x3 = centerX + innerRadius * Math.cos(end);
    const y3 = centerY + innerRadius * Math.sin(end);
    const x4 = centerX + innerRadius * Math.cos(start);
    const y4 = centerY + innerRadius * Math.sin(start);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  };

  const centerX = config.gauge / 2;
  const centerY = config.gauge / 2;
  const startAngle = -90;
  const totalAngle = 360;
  const endAngle = startAngle + (percentage / 100) * totalAngle;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2",
        className
      )}
    >
      <svg
        width={config.gauge}
        height={config.gauge}
        viewBox={`0 0 ${config.gauge} ${config.gauge}`}
        className={animate ? "animate-pulse" : ""}
      >
        <defs>
          {/* Green gradient */}
          <linearGradient
            id="gaugeGradientGreen"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#059669" stopOpacity="1" />
          </linearGradient>

          {/* Yellow gradient */}
          <linearGradient
            id="gaugeGradientYellow"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#d97706" stopOpacity="1" />
          </linearGradient>

          {/* Red gradient */}
          <linearGradient
            id="gaugeGradientRed"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Background circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={config.radius}
          fill="none"
          stroke="var(--wl-border-subtle)"
          strokeWidth="2"
        />

        {/* Background arc (full) */}
        <path
          d={createArcPath(startAngle, startAngle + totalAngle, config.radius, config.radius - 4)}
          fill="var(--wl-bg-secondary)"
          opacity="0.5"
        />

        {/* Filled arc */}
        <path
          d={createArcPath(startAngle, endAngle, config.radius, config.radius - 4)}
          fill={getGaugeColor()}
          opacity="0.9"
        />

        {/* Center circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={config.inner}
          fill="var(--wl-bg-primary)"
          stroke="var(--wl-border-default)"
          strokeWidth="1"
        />

        {/* Hours text */}
        <text
          x={centerX}
          y={centerY - 4}
          textAnchor="middle"
          fontSize={config.textSize}
          fontWeight="bold"
          fill={getTextColor()}
        >
          {hours}:{minutes.toString().padStart(2, "0")}
        </text>

        {/* Percentage text (small) */}
        <text
          x={centerX}
          y={centerY + config.textSize / 3}
          textAnchor="middle"
          fontSize={size === "sm" ? 8 : size === "md" ? 11 : 14}
          fill="var(--wl-text-secondary)"
        >
          {Math.round(percentage)}%
        </text>
      </svg>

      {/* Label below gauge */}
      <div className="text-center mt-1">
        <p className={cn(
          "text-wl-text-secondary",
          size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base"
        )}>
          {label}
        </p>
        <p className={cn(
          "font-medium",
          size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base",
          percentage <= 25
            ? "text-wl-danger-400"
            : percentage <= 50
              ? "text-wl-warning-400"
              : "text-wl-success-400"
        )}>
          {variant === "driving" && "11h limit"}
          {variant === "window" && "14h limit"}
          {variant === "cycle" && "70h limit"}
        </p>
      </div>

      {/* Thresholds (only for larger sizes) */}
      {size === "lg" && (
        <div className="mt-3 text-center text-xs text-wl-text-secondary space-y-1">
          <p>⚠️ Alert at 2 hours</p>
          <p>🚨 Violation at 0 hours</p>
        </div>
      )}
    </div>
  );
}
