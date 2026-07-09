"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
  action?: ToastAction;
}

interface ToastStackProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  maxVisible?: number;
  className?: string;
}

const VARIANT_CONFIG: Record<
  ToastVariant,
  {
    icon: React.ComponentType<{ className?: string }>;
    bgColor: string;
    borderColor: string;
    iconColor: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    bgColor: "bg-[var(--wl-success)]/10",
    borderColor: "border-[var(--wl-success)]/30",
    iconColor: "text-[var(--wl-success)]",
  },
  error: {
    icon: AlertCircle,
    bgColor: "bg-[var(--wl-danger)]/10",
    borderColor: "border-[var(--wl-danger)]/30",
    iconColor: "text-[var(--wl-danger)]",
  },
  warning: {
    icon: AlertTriangle,
    bgColor: "bg-[var(--wl-warning)]/10",
    borderColor: "border-[var(--wl-warning)]/30",
    iconColor: "text-[var(--wl-warning)]",
  },
  info: {
    icon: Info,
    bgColor: "bg-[var(--wl-info)]/10",
    borderColor: "border-[var(--wl-info)]/30",
    iconColor: "text-[var(--wl-info)]",
  },
};

const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 3000,
  error: 8000,
  warning: 6000,
  info: 4000,
};

const ToastItem = React.memo(
  ({
    toast,
    onDismiss,
    isExiting,
  }: {
    toast: Toast;
    onDismiss: (id: string) => void;
    isExiting: boolean;
  }) => {
    const config = VARIANT_CONFIG[toast.variant];
    const Icon = config.icon;
    const duration =
      toast.duration ?? DEFAULT_DURATIONS[toast.variant];
    const progressBarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (duration <= 0) return;

      const startTime = Date.now();
      let animationFrameId: number;

      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);

        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${100 - progress}%`;
        }

        if (progress < 100) {
          animationFrameId = requestAnimationFrame(updateProgress);
        }
      };

      const dismissTimer = setTimeout(() => {
        onDismiss(toast.id);
      }, duration);

      animationFrameId = requestAnimationFrame(updateProgress);

      return () => {
        clearTimeout(dismissTimer);
        cancelAnimationFrame(animationFrameId);
      };
    }, [toast.id, duration, onDismiss]);

    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-md border p-4",
          "bg-[var(--wl-bg-primary)]",
          config.bgColor,
          config.borderColor,
          "transition-all duration-300",
          "animate-in slide-in-from-right-full",
          isExiting && "animate-out slide-out-to-right-full"
        )}
        role="alert"
        aria-live="polite"
      >
        <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", config.iconColor)} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--wl-text-primary)]">
            {toast.title}
          </p>
          {toast.message && (
            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">
              {toast.message}
            </p>
          )}

          {toast.action && (
            <div className="mt-3">
              <button
                onClick={toast.action.onClick}
                className={cn(
                  "text-xs font-semibold underline",
                  "transition-colors duration-200",
                  toast.variant === "error"
                    ? "text-[var(--wl-danger)] hover:text-[var(--wl-danger)]/80"
                    : toast.variant === "warning"
                      ? "text-[var(--wl-warning)] hover:text-[var(--wl-warning)]/80"
                      : toast.variant === "success"
                        ? "text-[var(--wl-success)] hover:text-[var(--wl-success)]/80"
                        : "text-[var(--wl-info)] hover:text-[var(--wl-info)]/80"
                )}
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => onDismiss(toast.id)}
          className={cn(
            "flex-shrink-0 p-1 rounded-sm",
            "text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]",
            "hover:bg-[var(--wl-bg-secondary)]",
            "transition-colors duration-200",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wl-primary)]"
          )}
          aria-label={`Dismiss: ${toast.title}`}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress bar for auto-dismiss */}
        {DEFAULT_DURATIONS[toast.variant] > 0 && (
          <div
            className={cn(
              "absolute bottom-0 left-0 h-1 rounded-b-md",
              toast.variant === "error"
                ? "bg-[var(--wl-danger)]"
                : toast.variant === "warning"
                  ? "bg-[var(--wl-warning)]"
                  : toast.variant === "success"
                    ? "bg-[var(--wl-success)]"
                    : "bg-[var(--wl-info)]"
            )}
            ref={progressBarRef}
          />
        )}
      </div>
    );
  }
);

ToastItem.displayName = "ToastItem";

export const ToastStack = React.memo(
  ({
    toasts,
    onDismiss,
    maxVisible = 5,
    className,
  }: ToastStackProps) => {
    const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());

    const visibleToasts = useMemo(
      () => toasts.slice(0, maxVisible),
      [toasts, maxVisible]
    );

    const hiddenCount = useMemo(
      () => Math.max(0, toasts.length - maxVisible),
      [toasts.length, maxVisible]
    );

    const handleDismiss = useCallback(
      (id: string) => {
        setExitingIds((prev) => new Set([...prev, id]));
        const timer = setTimeout(() => {
          onDismiss(id);
          setExitingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 300); // Match animation duration
        return () => clearTimeout(timer);
      },
      [onDismiss]
    );

    if (toasts.length === 0) {
      return null;
    }

    return (
      <div
        className={cn(
          "fixed right-4 bottom-4 flex flex-col gap-3 z-50",
          "max-w-sm pointer-events-auto",
          className
        )}
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {visibleToasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={handleDismiss}
            isExiting={exitingIds.has(toast.id)}
          />
        ))}

        {hiddenCount > 0 && (
          <div
            className={cn(
              "flex items-center justify-center px-4 py-2 rounded-md",
              "bg-[var(--wl-bg-secondary)] border border-[var(--wl-border)]",
              "text-xs font-medium text-[var(--wl-text-secondary)]"
            )}
          >
            +{hiddenCount} more notification
            {hiddenCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    );
  }
);

ToastStack.displayName = "ToastStack";

// Hook for managing toast state
export const useToastStack = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${crypto.randomUUID()}`;
    const newToast: Toast = { ...toast, id };

    setToasts((prev) => [newToast, ...prev]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    clearAll,
  };
};
