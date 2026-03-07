"use client";

import { type ReactNode, type CSSProperties } from "react";
import { cn } from "../../lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: { value: number; label: string };
  icon?: ReactNode;
  accentColor?: string;
  style?: CSSProperties;
  className?: string;
  index?: number;
}

export function StatCard({
  label,
  value,
  change,
  icon,
  accentColor = "var(--wl-primary-500)",
  style,
  className,
  index = 0,
}: StatCardProps) {
  const isPositive = change && change.value >= 0;

  return (
    <div
      className={cn(
        "wl-animate-in bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5",
        "relative overflow-hidden",
        className
      )}
      style={{
        animationDelay: `${index * 80}ms`,
        ...style,
      }}
    >
      {/* Accent top line */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        }}
      />

      <div className="flex items-start justify-between mb-3">
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

      <div className="text-3xl font-bold text-wl-text-primary leading-tight font-mono -tracking-wider">
        {value}
      </div>

      {change && (
        <div className="flex items-center gap-1 mt-2">
          <span
            className={cn(
              "text-xs font-semibold font-mono",
              isPositive ? "text-wl-success-400" : "text-wl-danger-400"
            )}
          >
            {isPositive ? "+" : ""}
            {change.value}%
          </span>
          <span className="text-xs text-wl-text-tertiary">
            {change.label}
          </span>
        </div>
      )}
    </div>
  );
}
