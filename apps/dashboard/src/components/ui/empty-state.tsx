"use client";

import { type ReactNode, type CSSProperties } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  style?: CSSProperties;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  style,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 min-h-80 text-center",
        className,
      )}
      style={style}
    >
      {icon && (
        <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-wl-bg-surface text-wl-text-secondary mb-4 text-3xl">
          {icon}
        </div>
      )}

      <h3 className="text-lg font-semibold text-wl-text-primary mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-wl-text-secondary mb-4 max-w-96">
          {description}
        </p>
      )}

      {action && (
        <Button onClick={action.onClick} variant="primary" size="md">
          {action.label}
        </Button>
      )}
    </div>
  );
}
