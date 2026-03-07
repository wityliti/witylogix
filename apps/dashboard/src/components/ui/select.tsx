"use client";

import { type CSSProperties, useState } from "react";

type SelectSize = "sm" | "md" | "lg";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  size?: SelectSize;
  style?: CSSProperties;
}

const sizeStyles: Record<SelectSize, CSSProperties> = {
  sm: {
    fontSize: "var(--wl-text-xs)",
    padding: "var(--wl-space-2) var(--wl-space-3)",
  },
  md: {
    fontSize: "var(--wl-text-sm)",
    padding: "var(--wl-space-2) var(--wl-space-4)",
  },
  lg: {
    fontSize: "var(--wl-text-base)",
    padding: "var(--wl-space-3) var(--wl-space-4)",
  },
};

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled = false,
  size = "md",
  style,
}: SelectProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-2)", ...style }}>
      {label && (
        <label
          style={{
            fontSize: "var(--wl-text-sm)",
            fontWeight: 600,
            color: "var(--wl-text-primary)",
          }}
        >
          {label}
        </label>
      )}

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            width: "100%",
            fontFamily: "var(--wl-font-sans)",
            background: "var(--wl-bg-surface)",
            color: "var(--wl-text-primary)",
            border: `1px solid ${
              error ? "var(--wl-danger-400)" : isFocused ? "var(--wl-primary-500)" : "var(--wl-border-default)"
            }`,
            borderRadius: "var(--wl-radius-md)",
            outline: "none",
            transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
            appearance: "none",
            paddingRight: "var(--wl-space-10)",
            ...sizeStyles[size],
          }}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Chevron icon */}
        <svg
          style={{
            position: "absolute",
            right: "var(--wl-space-3)",
            width: "16px",
            height: "16px",
            pointerEvents: "none",
            color: "var(--wl-text-secondary)",
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {error && (
        <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-danger-400)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
