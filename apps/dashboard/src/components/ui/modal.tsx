"use client";

import { type ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils";

type ModalSize = "sm" | "md" | "lg" | "full";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "w-full max-w-sm",
  md: "w-full max-w-md",
  lg: "w-full max-w-lg",
  full: "w-[90vw] max-w-[90vw]",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50",
        "flex items-center justify-center",
        "animate-fadeIn"
      )}
      onClick={onClose}
    >
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative z-51",
          "bg-wl-bg-elevated border border-wl-border-subtle rounded-lg",
          "shadow-lg",
          "animate-slideIn",
          "max-h-[90vh] overflow-y-auto",
          sizeClasses[size]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-wl-border-subtle min-h-15">
          {title && (
            <h2 className="text-lg font-semibold text-wl-text-primary m-0">
              {title}
            </h2>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className={cn(
              "flex items-center justify-center",
              "w-8 h-8",
              "bg-transparent border-none rounded-md",
              "text-wl-text-secondary",
              "cursor-pointer transition-all duration-fast ease-default",
              "ml-auto",
              "hover:bg-wl-bg-surface hover:text-wl-text-primary"
            )}
            aria-label="Close modal"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 text-wl-text-primary">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-5 border-t border-wl-border-subtle bg-wl-bg-surface rounded-b-lg">
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideIn {
          from {
            transform: scale(0.95) translateY(-20px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn var(--wl-duration-fast) var(--wl-ease-default);
        }

        .animate-slideIn {
          animation: slideIn var(--wl-duration-fast) var(--wl-ease-spring);
        }

        .z-51 {
          z-index: 51;
        }
      `}</style>
    </div>
  );
}
