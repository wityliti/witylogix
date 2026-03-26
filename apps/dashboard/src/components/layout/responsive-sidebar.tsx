"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-breakpoint";
import { useSwipe } from "@/hooks/use-touch";

interface ResponsiveSidebarProps {
  children: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  overlayClassName?: string;
  contentClassName?: string;
}

/**
 * Responsive sidebar with collapse animation and swipe gestures
 * - Desktop: Persistent with collapse toggle
 * - Tablet/Mobile: Overlay with swipe to close, backdrop overlay
 *
 * Features:
 * - Smooth width/slide transitions
 * - Touch swipe to open/close on mobile
 * - Overlay backdrop on mobile
 * - Persist collapsed state in localStorage
 * - Keyboard shortcut (Cmd+B) to toggle
 *
 * @example
 * const [isOpen, setIsOpen] = useState(true);
 * <ResponsiveSidebar isOpen={isOpen} onOpenChange={setIsOpen}>
 *   <SidebarContent />
 * </ResponsiveSidebar>
 */
export function ResponsiveSidebar({
  children,
  isOpen = true,
  onOpenChange,
  className,
  overlayClassName,
  contentClassName,
}: ResponsiveSidebarProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(isOpen);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Sync prop with internal state
  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) {
      setOpen(stored === "false");
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(!open));
  }, [open]);

  const toggleSidebar = useCallback(() => {
    const newState = !open;
    setOpen(newState);
    onOpenChange?.(newState);
  }, [open, onOpenChange]);

  // Keyboard shortcut (Cmd+B or Ctrl+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  // Swipe to close on mobile
  useSwipe(sidebarRef, {
    onSwipeLeft: () => {
      if (isMobile && open) {
        toggleSidebar();
      }
    },
  });

  const handleBackdropClick = () => {
    if (isMobile && open) {
      toggleSidebar();
    }
  };

  // Mobile: overlay drawer
  if (isMobile) {
    return (
      <>
        {/* Backdrop overlay */}
        {open && (
          <div
            className={cn(
              "fixed inset-0",
              "bg-black/50 backdrop-blur-sm",
              "z-30",
              "transition-opacity duration-200",
              overlayClassName
            )}
            onClick={handleBackdropClick}
            aria-hidden="true"
          />
        )}

        {/* Sidebar drawer */}
        <aside
          ref={sidebarRef}
          className={cn(
            "fixed left-0 top-0 bottom-0",
            "w-64",
            "bg-wl-bg-sidebar",
            "border-r border-wl-border-subtle",
            "z-40",
            "transition-transform duration-300 ease-default",
            "overflow-y-auto",
            open ? "translate-x-0" : "-translate-x-full",
            className
          )}
        >
          {children}
        </aside>
      </>
    );
  }

  // Desktop/Tablet: persistent sidebar with collapse
  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "relative",
        "bg-wl-bg-sidebar",
        "border-r border-wl-border-subtle",
        "transition-all duration-300 ease-default",
        "overflow-hidden",
        open ? "w-60" : "w-0",
        className
      )}
    >
      <div
        className={cn(
          "w-60",
          "h-full",
          "overflow-y-auto",
          contentClassName
        )}
      >
        {children}
      </div>
    </aside>
  );
}

interface SidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Button component to toggle sidebar
 * Shows collapse/expand icon
 *
 * @example
 * <SidebarToggle isOpen={open} onToggle={() => setOpen(!open)} />
 */
export function SidebarToggle({
  isOpen,
  onToggle,
  className,
}: SidebarToggleProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      className={cn(
        "p-2",
        "rounded-md",
        "transition-colors duration-200",
        "text-wl-text-secondary hover:text-wl-text-primary",
        "hover:bg-wl-bg-elevated",
        className
      )}
    >
      <svg
        className={cn(
          "w-5 h-5",
          "transition-transform duration-300",
          isOpen ? "rotate-0" : "rotate-180"
        )}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {isOpen ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        )}
      </svg>
    </button>
  );
}
