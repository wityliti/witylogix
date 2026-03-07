"use client";

import { type ReactNode, type CSSProperties, useEffect } from "react";

type ModalSize = "sm" | "md" | "lg" | "full";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
  style?: CSSProperties;
}

const sizeStyles: Record<ModalSize, CSSProperties> = {
  sm: {
    width: "100%",
    maxWidth: "400px",
  },
  md: {
    width: "100%",
    maxWidth: "560px",
  },
  lg: {
    width: "100%",
    maxWidth: "720px",
  },
  full: {
    width: "90vw",
    maxWidth: "90vw",
  },
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  footer,
  style,
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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn var(--wl-duration-fast) var(--wl-ease-default)",
      }}
      onClick={onClose}
    >
      {/* Backdrop with blur */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Modal Content */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          zIndex: 51,
          background: "var(--wl-bg-elevated)",
          border: "1px solid var(--wl-border-subtle)",
          borderRadius: "var(--wl-radius-lg)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          animation: "slideIn var(--wl-duration-fast) var(--wl-ease-spring)",
          maxHeight: "90vh",
          overflowY: "auto",
          ...sizeStyles[size],
          ...style,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--wl-space-5)",
            borderBottom: "1px solid var(--wl-border-subtle)",
            minHeight: "60px",
          }}
        >
          {title && (
            <h2
              style={{
                fontSize: "var(--wl-text-lg)",
                fontWeight: 600,
                color: "var(--wl-text-primary)",
                margin: 0,
              }}
            >
              {title}
            </h2>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              background: "transparent",
              border: "none",
              borderRadius: "var(--wl-radius-md)",
              color: "var(--wl-text-secondary)",
              cursor: "pointer",
              transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
              marginLeft: "auto",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--wl-bg-surface)";
              e.currentTarget.style.color = "var(--wl-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--wl-text-secondary)";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "var(--wl-space-5)",
            color: "var(--wl-text-primary)",
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: "var(--wl-space-5)",
              borderTop: "1px solid var(--wl-border-subtle)",
              background: "var(--wl-bg-surface)",
              borderRadius: "0 0 var(--wl-radius-lg) var(--wl-radius-lg)",
            }}
          >
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
      `}</style>
    </div>
  );
}
