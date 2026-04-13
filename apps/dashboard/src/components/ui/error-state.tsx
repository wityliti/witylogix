"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  error?: Error | null;
  icon?: ReactNode;
  onRetry?: () => void;
  onAction?: { label: string; onClick: () => void };
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  error,
  icon,
  onRetry,
  onAction,
  className,
}: ErrorStateProps) {
  const displayMessage = message ?? error?.message ?? "An unexpected error occurred.";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 min-h-80 text-center",
        className
      )}
    >
      {icon ? (
        <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-wl-danger-bg text-wl-danger-400 mb-4 text-3xl">
          {icon}
        </div>
      ) : (
        <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-wl-danger-bg text-wl-danger-400 mb-4">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
      )}

      <h3 className="text-lg font-semibold text-wl-text-primary mb-2">
        {title}
      </h3>

      <p className="text-sm text-wl-text-secondary mb-6 max-w-96">
        {displayMessage}
      </p>

      <div className="flex items-center gap-2">
        {onRetry && (
          <Button variant="primary" size="md" onClick={onRetry}>
            Try again
          </Button>
        )}
        {onAction && (
          <Button variant="secondary" size="md" onClick={onAction.onClick}>
            {onAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
