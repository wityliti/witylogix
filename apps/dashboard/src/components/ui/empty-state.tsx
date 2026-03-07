"use client";

import { type ReactNode, type CSSProperties } from "react";
import { Button } from "./button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  style?: CSSProperties;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  style,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--wl-space-12)",
        minHeight: "300px",
        textAlign: "center",
        ...style,
      }}
    >
      {icon && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "64px",
            height: "64px",
            borderRadius: "var(--wl-radius-lg)",
            background: "var(--wl-bg-surface)",
            color: "var(--wl-text-secondary)",
            marginBottom: "var(--wl-space-4)",
            fontSize: "32px",
          }}
        >
          {icon}
        </div>
      )}

      <h3
        style={{
          fontSize: "var(--wl-text-lg)",
          fontWeight: 600,
          color: "var(--wl-text-primary)",
          margin: "0 0 var(--wl-space-2) 0",
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            fontSize: "var(--wl-text-sm)",
            color: "var(--wl-text-secondary)",
            margin: "0 0 var(--wl-space-4) 0",
            maxWidth: "400px",
          }}
        >
          {description}
        </p>
      )}

      {action && (
        <Button
          onClick={action.onClick}
          variant="primary"
          size="md"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
