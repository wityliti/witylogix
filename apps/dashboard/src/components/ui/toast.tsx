"use client";

import { type ReactNode, type CSSProperties, createContext, useContext, useState, useCallback } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
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

const typeStyles: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: "var(--wl-success-bg)",
    border: "var(--wl-success-400)",
    text: "var(--wl-success-400)",
    icon: "✓",
  },
  error: {
    bg: "var(--wl-danger-bg)",
    border: "var(--wl-danger-400)",
    text: "var(--wl-danger-400)",
    icon: "✕",
  },
  warning: {
    bg: "var(--wl-warning-bg)",
    border: "var(--wl-warning-400)",
    text: "var(--wl-warning-400)",
    icon: "!",
  },
  info: {
    bg: "var(--wl-info-bg)",
    border: "var(--wl-info-400)",
    text: "var(--wl-info-400)",
    icon: "ⓘ",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
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
    <div
      style={{
        position: "fixed",
        bottom: "var(--wl-space-4)",
        right: "var(--wl-space-4)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: "var(--wl-space-3)",
        pointerEvents: "none",
      }}
    >
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
  const styles = typeStyles[toast.type];
  const duration = toast.duration || 5000;

  // Simulate progress bar
  React.useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev - (100 / (duration / 50));
        return newProgress <= 0 ? 0 : newProgress;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  const toastStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    background: "var(--wl-bg-elevated)",
    border: `1px solid ${styles.border}`,
    borderRadius: "var(--wl-radius-lg)",
    padding: "var(--wl-space-4)",
    minWidth: "320px",
    maxWidth: "420px",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    animation: "slideInRight var(--wl-duration-fast) var(--wl-ease-spring)",
    pointerEvents: "auto",
  };

  return (
    <div style={toastStyle}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--wl-space-3)",
          marginBottom: toast.message ? "var(--wl-space-2)" : 0,
        }}
      >
        {/* Icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: styles.bg,
            color: styles.text,
            flexShrink: 0,
            fontSize: "14px",
            fontWeight: 700,
          }}
        >
          {styles.icon}
        </div>

        {/* Title and Message */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--wl-text-sm)",
              fontWeight: 600,
              color: "var(--wl-text-primary)",
              margin: 0,
            }}
          >
            {toast.title}
          </div>
          {toast.message && (
            <div
              style={{
                fontSize: "var(--wl-text-xs)",
                color: "var(--wl-text-secondary)",
                marginTop: "var(--wl-space-1)",
              }}
            >
              {toast.message}
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={() => onRemove(toast.id)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "24px",
            height: "24px",
            background: "transparent",
            border: "none",
            color: "var(--wl-text-tertiary)",
            cursor: "pointer",
            flexShrink: 0,
            transition: "color var(--wl-duration-fast) var(--wl-ease-default)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--wl-text-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--wl-text-tertiary)";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          height: "2px",
          background: "var(--wl-bg-surface)",
          borderRadius: "var(--wl-radius-full)",
          overflow: "hidden",
          marginTop: "var(--wl-space-3)",
        }}
      >
        <div
          style={{
            height: "100%",
            background: styles.border,
            width: `${progress}%`,
            transition: "width 50ms linear",
          }}
        />
      </div>

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
      `}</style>
    </div>
  );
}

// Add React import for useEffect
import React from "react";
