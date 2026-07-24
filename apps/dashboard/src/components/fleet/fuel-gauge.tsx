"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { FuelGaugeProps } from "./types";

/**
 * Fuel Gauge Component
 * SVG-based semicircle gauge with animated needle
 * Color-coded: red < 25%, yellow 25-50%, green > 50%
 */
export function FuelGauge({
  fuelLevel,
  tankCapacity = 60,
  animated = true,
  size = "md",
  className,
}: FuelGaugeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const needleRef = useRef<SVGLineElement>(null);
  const [displayLevel, setDisplayLevel] = useState(fuelLevel);

  // Animate needle on mount and when fuelLevel changes
  useEffect(() => {
    if (!animated) {
      setDisplayLevel(fuelLevel);
      return;
    }

    const startLevel = displayLevel;
    const endLevel = fuelLevel;
    const steps = 60;
    let currentStep = 0;

    const animate = () => {
      currentStep++;
      const progress = currentStep / steps;
      const newLevel = startLevel + (endLevel - startLevel) * progress;
      setDisplayLevel(newLevel);

      if (currentStep < steps) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [fuelLevel, animated]);

  // Determine color based on fuel level
  const getColor = (level: number) => {
    if (level < 25) return "#ef4444"; // red
    if (level < 50) return "#f59e0b"; // yellow
    return "#10b981"; // green
  };

  const getFillColor = (level: number) => {
    if (level < 25) return "url(#redGradient)";
    if (level < 50) return "url(#yellowGradient)";
    return "url(#greenGradient)";
  };

  // Convert fuel level (0-100) to needle angle (-90 to 90 degrees)
  const needleAngle = (displayLevel / 100) * 180 - 90;

  const sizeConfig = {
    sm: {
      width: 160,
      height: 100,
      fontSize: 12,
      labelFontSize: 10,
      radius: 60,
      strokeWidth: 3,
    },
    md: {
      width: 240,
      height: 150,
      fontSize: 16,
      labelFontSize: 12,
      radius: 90,
      strokeWidth: 4,
    },
    lg: {
      width: 320,
      height: 200,
      fontSize: 20,
      labelFontSize: 14,
      radius: 120,
      strokeWidth: 5,
    },
  };

  const config = sizeConfig[size];
  const padding = 20;
  const centerX = config.width / 2;
  const centerY = config.height;

  const needleLength = config.radius * 0.75;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <svg
        ref={svgRef}
        width={config.width}
        height={config.height}
        viewBox={`0 0 ${config.width} ${config.height}`}
        className="drop-shadow-sm"
      >
        <defs>
          <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="1" />
          </linearGradient>
          <linearGradient
            id="yellowGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#d97706" stopOpacity="1" />
          </linearGradient>
          <linearGradient
            id="greenGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#059669" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Gauge background track */}
        <path
          d={`M ${centerX - config.radius} ${centerY} A ${config.radius} ${config.radius} 0 0 1 ${centerX + config.radius} ${centerY}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
        />

        {/* Gauge filled track (color-coded) */}
        <path
          d={`M ${centerX - config.radius} ${centerY} A ${config.radius} ${config.radius} 0 0 1 ${
            centerX - config.radius + (displayLevel / 100) * config.radius * 2
          } ${centerY}`}
          fill="none"
          stroke={getFillColor(displayLevel)}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
        />

        {/* Needle base circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={4}
          fill="currentColor"
          className="text-wl-text-primary"
        />

        {/* Needle */}
        <line
          ref={needleRef}
          x1={centerX}
          y1={centerY}
          x2={centerX + needleLength * Math.cos((needleAngle * Math.PI) / 180)}
          y2={centerY + needleLength * Math.sin((needleAngle * Math.PI) / 180)}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="text-wl-text-primary"
          style={{
            transformOrigin: `${centerX}px ${centerY}px`,
            transition: animated ? "none" : "undefined",
          }}
        />

        {/* Fuel level percentage text */}
        <text
          x={centerX}
          y={centerY - 15}
          textAnchor="middle"
          fontSize={config.fontSize}
          fontWeight="bold"
          fill="currentColor"
          className="text-wl-text-primary"
        >
          {Math.round(displayLevel)}%
        </text>

        {/* Tank capacity label */}
        <text
          x={centerX}
          y={centerY + 20}
          textAnchor="middle"
          fontSize={config.labelFontSize}
          fill="currentColor"
          className="text-wl-text-secondary"
        >
          {tankCapacity}L
        </text>

        {/* Min/Max labels */}
        <text
          x={centerX - config.radius - 10}
          y={centerY + 5}
          fontSize={config.labelFontSize}
          fill="currentColor"
          className="text-wl-text-secondary opacity-70"
        >
          E
        </text>
        <text
          x={centerX + config.radius + 5}
          y={centerY + 5}
          fontSize={config.labelFontSize}
          fill="currentColor"
          className="text-wl-text-secondary opacity-70"
        >
          F
        </text>
      </svg>

      {/* Legend */}
      <div className="flex gap-4 text-xs mt-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-wl-success-400" />
          <span className="text-wl-text-secondary">&gt; 50%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-wl-warning-400" />
          <span className="text-wl-text-secondary">25-50%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-wl-danger-400" />
          <span className="text-wl-text-secondary">&lt; 25%</span>
        </div>
      </div>
    </div>
  );
}
