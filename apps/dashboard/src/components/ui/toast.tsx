"use client";

import React, { type ReactNode, createContext, useContext, useState, useCallback, useEffect } from "react";
import { cn } from "../../lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const typeClasses: Record<
  ToastType,
  { bg: string; border: string; text: string; icon: string }
> = {
  success: {
    bg: "bg-wl-success-bg",
    border: "border-wl-success-400",
    text: "text-wl-success-400",
    icon: "✓",
  },
  error: {
    bg: "bg-wl-danger-bg",
    border: "border-wl-danger-400",
    text: "text-wl-danger-400",
    icon: "✕",
  },
  warning: {
    bg: "bg-wl-warning-bg",
    border: "border-wl-warning-400",
    text: "text-wl-warning-400",
    icon: "!",
  },
  info: {
    bg: "bg-wl-info-bg",
    border: "border-wl-info-400",
    text: "text-wl-info-400",
    icon: "ⓘ",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${crypto.randomUUID()}`;
    const duration = toast.duration || 5000;

    setToasts((prev) => [...prev, { ...toast, id, duration }]);

    setTimeout(() => {
      removeToast(id);
    }, duration);

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toasts }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-100 flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [progress, setProgress] = useState(100);
  const styles = typeClasses[toast.type];
  const duration = toast.duration || 5000;

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev - 100 / (duration / 50);
        return newProgress <= 0 ? 0 : newProgress;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .toast-slide-in {
          animation: slideInRight var(--wl-duration-fast) var(--wl-ease-spring) forwards;
        }
      `}</style>
      <div
        className={cn(
          "flex flex-col bg-wl-bg-elevated rounded-lg p-4 min-w-80 max-w-96",
          "shadow-lg pointer-events-auto toast-slide-in",
          "border",
          styles.border
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-start gap-3",
            toast.message && "mb-2"
          )}
        >
          {/* Icon */}
          <div
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full",
              "flex-shrink-0 text-sm font-bold",
              styles.bg,
              styles.text
            )}
          >
            {styles.icon}
          </div>

          {/* Title and Message */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-wl-text-primary">
              {toast.title}
            </div>
            {toast.message && (
              <div className="text-xs text-wl-text-secondary mt-1">
                {toast.message}
              </div>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={() => onRemove(toast.id)}
            className={cn(
              "flex items-center justify-center w-6 h-6 flex-shrink-0",
              "bg-transparent border-none text-wl-text-tertiary cursor-pointer",
              "transition-colors duration-fast ease-default",
              "hover:text-wl-text-secondary"
            )}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-0.5 bg-wl-bg-surface rounded-full overflow-hidden mt-3">
          <div
            className={cn(
              "h-full transition-all",
              styles.border.replace("border-", "bg-")
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </>
  );
}
