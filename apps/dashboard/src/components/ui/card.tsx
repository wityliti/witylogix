"use client";

import { type ReactNode, type CSSProperties } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  hover?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

export function Card({ children, style, hover, glow, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--wl-bg-elevated)",
        border: "1px solid var(--wl-border-subtle)",
        borderRadius: "var(--wl-radius-lg)",
        padding: "var(--wl-space-5)",
        transition: `all var(--wl-duration-base) var(--wl-ease-default)`,
        cursor: onClick ? "pointer" : undefined,
        ...(hover
          ? {
              // Hover styles applied via onMouseEnter/Leave if needed
            }
          : {}),
        ...(glow ? { boxShadow: "var(--wl-shadow-glow)" } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "var(--wl-space-4)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <h3
      style={{
        fontSize: "var(--wl-text-sm)",
        fontWeight: 600,
        color: "var(--wl-text-secondary)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        margin: 0,
        ...style,
      }}
    >
      {children}
    </h3>
  );
}

export function CardContent({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardDescription({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <p
      style={{
        fontSize: "var(--wl-text-sm, 14px)",
        color: "var(--wl-text-secondary, #94a3b8)",
        margin: "4px 0 0 0",
        lineHeight: 1.5,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

export function CardFooter({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "8px",
        marginTop: "var(--wl-space-4, 16px)",
        paddingTop: "var(--wl-space-4, 16px)",
        borderTop: "1px solid var(--wl-border-subtle, #1e293b)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
