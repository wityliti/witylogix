'use client';

import React, { type ReactNode, createContext, useContext, useState, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  position?: ToastPosition;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const typeConfig: Record<
  ToastType,
  { bg: string; border: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  success: {
    bg: 'bg-wl-success-bg',
    border: 'border-wl-success-400',
    text: 'text-wl-success-400',
    icon: CheckCircle2,
  },
  error: {
    bg: 'bg-wl-danger-bg',
    border: 'border-wl-danger-400',
    text: 'text-wl-danger-400',
    icon: AlertCircle,
  },
  warning: {
    bg: 'bg-wl-warning-bg',
    border: 'border-wl-warning-400',
    text: 'text-wl-warning-400',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-wl-info-bg',
    border: 'border-wl-info-400',
    text: 'text-wl-info-400',
    icon: Info,
  },
};

const positionClasses: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

const MAX_VISIBLE_TOASTS = 5;

/**
 * Toast provider component - wrap your app with this
 * Provides toast context to all children
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const duration = toast.duration ?? 5000;
    const position = toast.position ?? 'top-right';

    const newToast: Toast = {
      ...toast,
      id,
      duration,
      position,
    };

    setToasts((prev) => {
      const filtered = prev.filter((t) => t.position === position);
      const willExceed = filtered.length >= MAX_VISIBLE_TOASTS;
      const updated = willExceed ? [...filtered.slice(1), newToast] : [...prev, newToast];
      return updated;
    });

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

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

/**
 * Hook to use toast notifications
 * Must be used within ToastProvider
 *
 * @example
 * const { addToast } = useToast();
 * addToast({ type: 'success', title: 'Success!', message: 'Operation completed' });
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const groupedByPosition = toasts.reduce(
    (acc, toast) => {
      const pos = toast.position ?? 'top-right';
      if (!acc[pos]) acc[pos] = [];
      acc[pos].push(toast);
      return acc;
    },
    {} as Record<ToastPosition, Toast[]>
  );

  return (
    <>
      {Object.entries(groupedByPosition).map(([position, positionToasts]) => (
        <div
          key={position}
          className={cn(
            'fixed z-50 flex flex-col gap-3 pointer-events-none',
            positionClasses[position as ToastPosition],
            position.includes('center') && 'w-full max-w-sm px-4'
          )}
        >
          {positionToasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onRemove={onRemove}
            />
          ))}
        </div>
      ))}
    </>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [progress, setProgress] = useState(100);
  const config = typeConfig[toast.type];
  const Icon = config.icon;
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    if (duration <= 0) return;

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
        @keyframes slideInLeft {
          from {
            transform: translateX(-400px);
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
        .toast-slide-in-left {
          animation: slideInLeft var(--wl-duration-fast) var(--wl-ease-spring) forwards;
        }
      `}</style>
      <div
        className={cn(
          'flex flex-col bg-wl-bg-elevated rounded-lg p-4 min-w-80 max-w-96',
          'shadow-lg pointer-events-auto toast-slide-in',
          'border',
          config.border,
          'group cursor-pointer',
          'hover:shadow-xl transition-shadow duration-fast ease-default'
        )}
        onClick={() => onRemove(toast.id)}
        role="alert"
        aria-live="assertive"
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-start gap-3',
            (toast.message || toast.action) && 'mb-2'
          )}
        >
          {/* Icon */}
          <Icon className={cn(
            'w-5 h-5 flex-shrink-0 mt-0.5',
            config.text
          )} />

          {/* Title and Message */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-wl-text-primary">
              {toast.title}
            </div>
            {toast.message && (
              <div className="text-xs text-wl-text-secondary mt-1 break-words">
                {toast.message}
              </div>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(toast.id);
            }}
            className={cn(
              'flex items-center justify-center w-5 h-5 flex-shrink-0',
              'bg-transparent border-none text-wl-text-tertiary cursor-pointer',
              'transition-colors duration-fast ease-default',
              'hover:text-wl-text-secondary'
            )}
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action button */}
        {toast.action && (
          <div className="mb-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toast.action?.onClick();
                onRemove(toast.id);
              }}
              className={cn(
                'text-xs font-semibold px-3 py-1.5 rounded',
                'transition-colors duration-fast ease-default',
                config.text,
                'hover:bg-wl-bg-surface'
              )}
            >
              {toast.action.label}
            </button>
          </div>
        )}

        {/* Progress Bar */}
        {duration > 0 && (
          <div className="h-0.5 bg-wl-bg-surface rounded-full overflow-hidden mt-3">
            <div
              className={cn(
                'h-full transition-all',
                config.border.replace('border-', 'bg-')
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </>
  );
}
