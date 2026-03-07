"use client";

import { type ReactNode, type CSSProperties, useState } from "react";

type InputType = "text" | "email" | "password" | "number" | "search" | "url";
type InputSize = "sm" | "md" | "lg";

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: InputType;
  error?: string;
  hint?: string;
  disabled?: boolean;
  icon?: ReactNode;
  size?: InputSize;
  style?: CSSProperties;
}

interface TextareaProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  error?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

const sizeStyles: Record<InputSize, CSSProperties> = {
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

export function Input({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  error,
  hint,
  disabled = false,
  icon,
  size = "md",
  style,
}: InputProps) {
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
        {icon && (
          <span
            style={{
              position: "absolute",
              left: "var(--wl-space-3)",
              display: "flex",
              alignItems: "center",
              color: "var(--wl-text-secondary)",
              pointerEvents: "none",
            }}
          >
            {icon}
          </span>
        )}

        <input
          type={type}
          placeholder={placeholder}
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
            cursor: disabled ? "not-allowed" : "text",
            ...(icon ? { paddingLeft: "var(--wl-space-10)" } : {}),
            ...sizeStyles[size],
          }}
        />
      </div>

      {error && (
        <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-danger-400)" }}>
          {error}
        </span>
      )}

      {hint && !error && (
        <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}

export function Textarea({
  label,
  placeholder,
  value,
  onChange,
  rows = 4,
  error,
  disabled = false,
  style,
}: TextareaProps) {
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

      <textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        rows={rows}
        style={{
          fontFamily: "var(--wl-font-sans)",
          fontSize: "var(--wl-text-sm)",
          background: "var(--wl-bg-surface)",
          color: "var(--wl-text-primary)",
          border: `1px solid ${
            error ? "var(--wl-danger-400)" : isFocused ? "var(--wl-primary-500)" : "var(--wl-border-default)"
          }`,
          borderRadius: "var(--wl-radius-md)",
          padding: "var(--wl-space-3) var(--wl-space-4)",
          outline: "none",
          transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "text",
          resize: "vertical",
          minHeight: "80px",
        }}
      />

      {error && (
        <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-danger-400)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
