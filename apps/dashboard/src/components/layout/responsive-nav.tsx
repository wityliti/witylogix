"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  useBreakpoint,
  useIsTablet,
  useIsMobile,
} from "@/hooks/use-breakpoint";

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  active?: boolean;
  badge?: string | number;
}

interface ResponsiveNavProps {
  items: NavItem[];
  onNavigate?: (item: NavItem) => void;
  className?: string;
}

/**
 * Responsive navigation component that adapts to screen size:
 * - Desktop (lg+): Full sidebar with labels and collapse toggle
 * - Tablet (md): Icon-only sidebar with tooltips
 * - Mobile (sm): Bottom tab bar with hamburger menu overlay
 *
 * @example
 * <ResponsiveNav
 *   items={navItems}
 *   onNavigate={(item) => router.push(item.href)}
 * />
 */
export function ResponsiveNav({
  items,
  onNavigate,
  className,
}: ResponsiveNavProps) {
  const breakpoint = useBreakpoint();
  const isTablet = useIsTablet();
  const isMobile = useIsMobile();

  const isDesktop = !isMobile && !isTablet;

  // Render desktop nav (sidebar)
  if (isDesktop) {
    return (
      <nav
        className={cn(
          "flex flex-col gap-1",
          "p-4",
          "bg-wl-bg-sidebar",
          "border-r border-wl-border-subtle",
          className,
        )}
      >
        {items.map((item) => (
          <NavItemDesktop key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
    );
  }

  // Render tablet nav (icon-only with tooltips)
  if (isTablet) {
    return (
      <nav
        className={cn(
          "flex flex-col gap-2",
          "p-2",
          "bg-wl-bg-sidebar",
          "border-r border-wl-border-subtle",
          "w-20",
          className,
        )}
      >
        {items.map((item) => (
          <NavItemTablet key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
    );
  }

  // Render mobile nav (bottom tab bar)
  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0",
        "flex gap-0",
        "px-2 py-3",
        "bg-wl-bg-sidebar backdrop-blur-md",
        "border-t border-wl-border-subtle",
        "z-40",
        className,
      )}
    >
      {items.map((item) => (
        <NavItemMobile key={item.id} item={item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

interface NavItemProps {
  item: NavItem;
  onNavigate?: (item: NavItem) => void;
}

/**
 * Desktop nav item with label and icon
 */
function NavItemDesktop({ item, onNavigate }: NavItemProps) {
  return (
    <button
      onClick={() => onNavigate?.(item)}
      className={cn(
        "flex items-center gap-3",
        "px-3 py-2.5",
        "rounded-md",
        "transition-colors duration-200",
        "text-sm font-medium",
        item.active
          ? cn(
              "bg-wl-bg-elevated",
              "text-wl-primary-500",
              "border border-wl-primary-500/30",
            )
          : cn(
              "text-wl-text-secondary",
              "hover:text-wl-text-primary",
              "hover:bg-wl-bg-elevated",
            ),
      )}
    >
      <span className="w-5 h-5 flex items-center justify-center">
        {item.icon}
      </span>
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge && (
        <span
          className={cn(
            "px-2 py-0.5",
            "rounded-full",
            "text-xs font-semibold",
            "bg-wl-primary-500/20 text-wl-primary-400",
          )}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
}

/**
 * Tablet nav item with icon only and tooltip
 */
function NavItemTablet({ item, onNavigate }: NavItemProps) {
  return (
    <button
      onClick={() => onNavigate?.(item)}
      title={item.label}
      className={cn(
        "flex items-center justify-center",
        "w-12 h-12",
        "rounded-md",
        "transition-colors duration-200",
        "relative",
        item.active
          ? cn("bg-wl-bg-elevated", "text-wl-primary-500", "shadow-md")
          : cn(
              "text-wl-text-secondary",
              "hover:text-wl-text-primary",
              "hover:bg-wl-bg-elevated",
            ),
      )}
    >
      <span className="w-5 h-5 flex items-center justify-center">
        {item.icon}
      </span>
      {item.badge && (
        <span
          className={cn(
            "absolute top-0 right-0",
            "px-1.5 py-0.5",
            "rounded-full",
            "text-xs font-bold",
            "bg-wl-danger-500 text-white",
            "transform translate-x-1/4 -translate-y-1/4",
          )}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
}

/**
 * Mobile nav item for bottom tab bar
 */
function NavItemMobile({ item, onNavigate }: NavItemProps) {
  return (
    <button
      onClick={() => onNavigate?.(item)}
      className={cn(
        "flex-1",
        "flex flex-col items-center gap-1",
        "py-2 px-1",
        "rounded-md",
        "transition-colors duration-200",
        "text-xs font-medium",
        item.active
          ? cn("text-wl-primary-500", "bg-wl-primary-500/10")
          : cn("text-wl-text-secondary", "hover:text-wl-text-primary"),
      )}
    >
      <span className="w-5 h-5 flex items-center justify-center">
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
      {item.badge && (
        <span
          className={cn(
            "px-1",
            "rounded-full",
            "text-xs font-bold",
            "bg-wl-danger-500 text-white",
          )}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
}
