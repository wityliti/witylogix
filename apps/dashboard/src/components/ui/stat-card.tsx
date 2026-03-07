"use client";

import { type ReactNode, type CSSProperties } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: { value: number; label: string };
  icon?: ReactNode;
  accentColor?: string;
  style?: CSSProperties;
  index?: number;
}

export function StatCard({
  label,
  value,
  change,
  icon,
  accentColor = "var(--wl-primary-500)",
  style,
  index = 0,
}: StatCardProps) {
  const isPositive = change && change.value >= 0;

  return (
    <div
      className="wl-animate-in"
      style={{
        background: "var(--wl-bg-elevated)",
        border: "1px solid var(--wl-border-subtle)",
        borderRadius: "var(--wl-radius-lg)",
        padding: "var(--wl-space-5)",
        position: "relative",
        overflow: "hidden",
        animationDelay: `${index * 80}ms`,
        ...style,
      }}
    >
      {/* Accent top line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "var(--wl-space-3)",
        }}
      >
        <span
          style={{
            fontSize: "var(--wl-text-sm)",
            fontWeight: 500,
            color: "var(--wl-text-secondary)",
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </span>
        {icon && (
          <span
            style={{
              color: accentColor,
              opacity: 0.7,
              display: "flex",
              alignItems: "center",
            }}
          >
            {icon}
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: "var(--wl-text-3xl)",
          fontWeight: 700,
          color: "var(--wl-text-primary)",
          lineHeight: 1.1,
          fontFamily: "var(--wl-font-mono)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>

      {change && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--wl-space-1)",
            marginTop: "var(--wl-space-2)",
          }}
        >
          <span
            style={{
              fontSize: "var(--wl-text-xs)",
              fontWeight: 600,
              color: isPositive ? "var(--wl-success-400)" : "var(--wl-danger-400)",
              fontFamily: "var(--wl-font-mono)",
            }}
          >
            {isPositive ? "+" : ""}
            {change.value}%
          </span>
          <span
            style={{
              fontSize: "var(--wl-text-xs)",
              color: "var(--wl-text-tertiary)",
            }}
          >
            {change.label}
          </span>
        </div>
      )}
    </div>
  );
}
