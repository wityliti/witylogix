"use client";

import { type ButtonHTMLAttributes, type CSSProperties } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "linear-gradient(135deg, var(--wl-primary-500), var(--wl-primary-600))",
    color: "var(--wl-text-inverse)",
    border: "1px solid var(--wl-primary-600)",
    fontWeight: 600,
  },
  secondary: {
    background: "var(--wl-bg-overlay)",
    color: "var(--wl-text-primary)",
    border: "1px solid var(--wl-border-default)",
    fontWeight: 500,
  },
  ghost: {
    background: "transparent",
    color: "var(--wl-text-secondary)",
    border: "1px solid transparent",
    fontWeight: 500,
  },
  danger: {
    background: "var(--wl-danger-bg)",
    color: "var(--wl-danger-400)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    fontWeight: 600,
  },
};

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: {
    fontSize: "var(--wl-text-xs)",
    padding: "var(--wl-space-1) var(--wl-space-3)",
    borderRadius: "var(--wl-radius-sm)",
  },
  md: {
    fontSize: "var(--wl-text-sm)",
    padding: "var(--wl-space-2) var(--wl-space-4)",
    borderRadius: "var(--wl-radius-md)",
  },
  lg: {
    fontSize: "var(--wl-text-base)",
    padding: "var(--wl-space-3) var(--wl-space-5)",
    borderRadius: "var(--wl-radius-md)",
  },
};

export function Button({
  variant = "primary",
  size = "md",
  style,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--wl-space-2)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--wl-font-sans)",
        transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
        letterSpacing: "0.01em",
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        opacity: disabled ? 0.5 : 1,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      disabled={disabled}
      {...props}
    />
  );
}
