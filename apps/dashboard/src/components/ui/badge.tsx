"use client";

import { type ReactNode, type CSSProperties } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "primary";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  style?: CSSProperties;
}

const variantStyles: Record<BadgeVariant, CSSProperties> = {
  default: {
    color: "var(--wl-neutral-300)",
    background: "rgba(255, 255, 255, 0.06)",
  },
  success: {
    color: "var(--wl-success-400)",
    background: "var(--wl-success-bg)",
  },
  warning: {
    color: "var(--wl-warning-400)",
    background: "var(--wl-warning-bg)",
  },
  danger: {
    color: "var(--wl-danger-400)",
    background: "var(--wl-danger-bg)",
  },
  info: {
    color: "var(--wl-info-400)",
    background: "var(--wl-info-bg)",
  },
  primary: {
    color: "var(--wl-primary-400)",
    background: "rgba(245, 166, 35, 0.12)",
  },
};

export function Badge({ children, variant = "default", dot, style }: BadgeProps) {
  const vs = variantStyles[variant];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--wl-space-1)",
        fontSize: "var(--wl-text-xs)",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: "var(--wl-radius-full)",
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        lineHeight: 1.6,
        whiteSpace: "nowrap",
        ...vs,
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "currentColor",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
