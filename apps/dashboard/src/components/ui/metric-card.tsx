"use client";

import { useEffect, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  value: number;
  label: string;
  trend?: {
    value: number;
    label: string;
  };
  icon?: ReactNode;
  accentColor?: string;
  className?: string;
  animated?: boolean;
  format?: (val: number) => string;
}

export function MetricCard({
  value,
  label,
  trend,
  icon,
  accentColor = "var(--wl-primary-500)",
  className,
  animated = true,
  format,
}: MetricCardProps) {
  const counterRef = useRef<HTMLDivElement>(null);
  const isTrendPositive = trend && trend.value >= 0;

  useEffect(() => {
    if (!animated || !counterRef.current) return;

    const target = value;
    const duration = 1000;
    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentValue = Math.floor(startValue + (target - startValue) * progress);

      if (counterRef.current) {
        counterRef.current.textContent = format ? format(currentValue) : currentValue.toString();
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [value, animated, format]);

  const formattedValue = format ? format(value) : value.toString();

  return (
    <div
      className={cn(
        "bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5",
        "relative overflow-hidden",
        className
      )}
    >
      {/* Accent top line */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        }}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <span className="text-sm font-medium text-wl-text-secondary tracking-wider">
          {label}
        </span>
        {icon && (
          <span
            className="flex items-center opacity-70"
            style={{ color: accentColor }}
          >
            {icon}
          </span>
        )}
      </div>

      {/* Main value with animation counter */}
      <div className="space-y-2">
        <div
          ref={counterRef}
          className="text-4xl font-bold text-wl-text-primary leading-tight font-mono -tracking-wider"
        >
          {formattedValue}
        </div>

        {/* Trend indicator */}
        {trend && (
          <div className="flex items-center gap-2 pt-2">
            <span
              className={cn(
                "text-sm font-semibold font-mono flex items-center gap-1",
                isTrendPositive ? "text-wl-success-500" : "text-wl-danger-500"
              )}
            >
              {isTrendPositive ? "↑" : "↓"}
              {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-wl-text-tertiary">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
