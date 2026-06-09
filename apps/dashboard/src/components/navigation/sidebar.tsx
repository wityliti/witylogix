"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { NAV_GROUPS, hasRequiredRole } from "@/config/navigation";
import type { NavGroup, NavItem, NavChild, UserRole } from "@/config/navigation";

// ─── Icon ──────────────────────────────────────────────────────────────────────

interface IconProps {
  d: string;
  size?: number;
  className?: string;
}

function Icon({ d, size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

// ─── Chevron icon ──────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(
        "transition-transform duration-200 ease-in-out flex-shrink-0",
        open ? "rotate-90" : "rotate-0"
      )}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// ─── Search box ────────────────────────────────────────────────────────────────

interface SearchBoxProps {
  value: string;
  onChange: (v: string) => void;
}

function SearchBox({ value, onChange }: SearchBoxProps) {
  return (
    <div className="relative mx-3 mb-2">
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-wl-text-tertiary pointer-events-none"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        placeholder="Search nav…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search navigation"
        className={cn(
          "w-full pl-7 pr-3 py-1.5",
          "text-xs text-wl-text-secondary placeholder:text-wl-text-tertiary",
          "bg-white/[0.05] border border-white/[0.08]",
          "rounded-md outline-none",
          "transition-colors duration-150",
          "focus:border-[rgba(245,166,35,0.4)] focus:bg-white/[0.07]"
        )}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2",
            "text-wl-text-tertiary hover:text-wl-text-secondary",
            "transition-colors duration-100"
          )}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Nav child item ────────────────────────────────────────────────────────────

interface NavChildItemProps {
  child: NavChild;
  isActive: boolean;
}

function NavChildItem({ child, isActive }: NavChildItemProps) {
  return (
    <Link
      href={child.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2",
        "pl-9 pr-3 py-1.5",
        "rounded-md text-xs font-medium no-underline",
        "transition-all duration-150",
        isActive
          ? "text-wl-primary-500 bg-wl-primary-500/[0.08]"
          : "text-wl-text-tertiary hover:text-wl-text-secondary hover:bg-white/[0.03]"
      )}
    >
      <span
        className={cn(
          "w-1 h-1 rounded-full flex-shrink-0",
          isActive ? "bg-wl-primary-500" : "bg-wl-text-tertiary/40"
        )}
        aria-hidden="true"
      />
      <span className="truncate">{child.label}</span>
    </Link>
  );
}

// ─── Nav item (with optional collapsible children) ─────────────────────────────

interface NavItemRowProps {
  item: NavItem;
  collapsed: boolean;
  isItemActive: boolean;
  isChildActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
}

function NavItemRow({
  item,
  collapsed,
  isItemActive,
  isChildActive,
  isOpen,
  onToggle,
  pathname,
}: NavItemRowProps) {
  const hasChildren = Boolean(item.children?.length);
  const isHighlighted = isItemActive || isChildActive;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={`nav-children-${item.href}`}
          title={collapsed ? item.label : undefined}
          className={cn(
            "w-full flex items-center gap-3",
            "px-3 py-2",
            "rounded-md text-sm font-medium",
            "border-none bg-transparent cursor-pointer font-sans",
            "transition-all duration-150",
            "relative",
            collapsed ? "justify-center" : "justify-between",
            isHighlighted
              ? "text-wl-primary-500 bg-wl-primary-500/10 border border-wl-primary-500/[0.15] shadow-[0_0_12px_rgba(245,166,35,0.08)]"
              : "text-wl-text-secondary border border-transparent hover:text-wl-text-primary hover:bg-white/[0.04]"
          )}
        >
          <span className="flex items-center gap-3 flex-1 min-w-0">
            <span
              className={cn(
                "flex flex-shrink-0",
                isHighlighted && "drop-shadow-[0_0_6px_rgba(245,166,35,0.5)]"
              )}
            >
              <Icon d={item.icon} />
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </span>

          {isHighlighted && (
            <div
              className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2",
                "w-[3px] h-5 rounded-r-full",
                "bg-wl-primary-500 shadow-[0_0_8px_rgba(245,166,35,0.6)]"
              )}
              aria-hidden="true"
            />
          )}

          {!collapsed && <ChevronIcon open={isOpen} />}
        </button>

        {!collapsed && isOpen && (
          <div
            id={`nav-children-${item.href}`}
            className="mt-0.5 space-y-0.5"
          >
            {item.children!.map((child) => (
              <NavChildItem
                key={child.href}
                child={child}
                isActive={pathname === child.href || pathname.startsWith(child.href + "/")}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={isItemActive ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3",
        "px-3 py-2",
        "rounded-md text-sm font-medium no-underline",
        "transition-all duration-150",
        "relative",
        collapsed ? "justify-center" : "justify-between",
        isItemActive
          ? "text-wl-primary-500 bg-wl-primary-500/10 border border-wl-primary-500/[0.15] shadow-[0_0_12px_rgba(245,166,35,0.08)]"
          : "text-wl-text-secondary border border-transparent hover:text-wl-text-primary hover:bg-white/[0.04]"
      )}
    >
      <span className="flex items-center gap-3 flex-1 min-w-0">
        <span
          className={cn(
            "flex flex-shrink-0",
            isItemActive && "drop-shadow-[0_0_6px_rgba(245,166,35,0.5)]"
          )}
        >
          <Icon d={item.icon} />
        </span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </span>

      {isItemActive && (
        <div
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2",
            "w-[3px] h-5 rounded-r-full",
            "bg-wl-primary-500 shadow-[0_0_8px_rgba(245,166,35,0.6)]"
          )}
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

// ─── Group section ──────────────────────────────────────────────────────────────

interface GroupSectionProps {
  group: NavGroup;
  collapsed: boolean;
  pathname: string;
  openItems: Set<string>;
  onToggleItem: (href: string) => void;
  openGroups: Set<string>;
  onToggleGroup: (label: string) => void;
  searchActive: boolean;
}

function GroupSection({
  group,
  collapsed,
  pathname,
  openItems,
  onToggleItem,
  openGroups,
  onToggleGroup,
  searchActive,
}: GroupSectionProps) {
  const isGroupOpen = searchActive || openGroups.has(group.label);

  return (
    <div>
      {/* Group header (click to collapse/expand) */}
      {!collapsed && (
        <button
          onClick={() => onToggleGroup(group.label)}
          aria-expanded={isGroupOpen}
          className={cn(
            "w-full flex items-center justify-between",
            "px-2 pt-4 pb-1",
            "border-none bg-transparent cursor-pointer font-sans",
            "text-xs font-bold uppercase tracking-wider",
            "text-wl-text-tertiary hover:text-wl-text-secondary",
            "transition-colors duration-150"
          )}
        >
          <span>{group.label}</span>
          <svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            aria-hidden="true"
            className={cn(
              "transition-transform duration-200",
              isGroupOpen ? "rotate-180" : "rotate-0"
            )}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}

      {/* Group items */}
      {(isGroupOpen || collapsed) && (
        <div className={cn("space-y-0.5", collapsed ? "pt-2" : "")}>
          {group.items.map((item) => {
            const isItemActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href + "/") &&
                !item.children?.some((c) => pathname.startsWith(c.href)));
            const isChildActive = Boolean(
              item.children?.some(
                (c) => pathname === c.href || pathname.startsWith(c.href + "/")
              )
            );
            const isOpen = openItems.has(item.href);

            return (
              <NavItemRow
                key={item.href}
                item={item}
                collapsed={collapsed}
                isItemActive={isItemActive}
                isChildActive={isChildActive}
                isOpen={isOpen}
                onToggle={() => onToggleItem(item.href)}
                pathname={pathname}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar state hooks ───────────────────────────────────────────────────────

function useGroupState(initialGroups: NavGroup[]) {
  // Load persisted group open/closed state
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      // Default: all non-collapsed groups start open
      return new Set(
        initialGroups.filter((g) => !g.defaultCollapsed).map((g) => g.label)
      );
    }
    try {
      const stored = localStorage.getItem("nav-open-groups");
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch {
      // ignore parse errors
    }
    return new Set(
      initialGroups.filter((g) => !g.defaultCollapsed).map((g) => g.label)
    );
  });

  const toggleGroup = useCallback((label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      try {
        localStorage.setItem("nav-open-groups", JSON.stringify([...next]));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const openGroup = useCallback((label: string) => {
    setOpenGroups((prev) => {
      if (prev.has(label)) return prev;
      const next = new Set(prev);
      next.add(label);
      try {
        localStorage.setItem("nav-open-groups", JSON.stringify([...next]));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  return { openGroups, toggleGroup, openGroup };
}

function useItemState() {
  const [openItems, setOpenItems] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("nav-open-items");
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch {
      // ignore
    }
    return new Set();
  });

  const toggleItem = useCallback((href: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      try {
        localStorage.setItem("nav-open-items", JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const openItem = useCallback((href: string) => {
    setOpenItems((prev) => {
      if (prev.has(href)) return prev;
      const next = new Set(prev);
      next.add(href);
      try {
        localStorage.setItem("nav-open-items", JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { openItems, toggleItem, openItem };
}

// ─── Main sidebar component ────────────────────────────────────────────────────

export interface NavSidebarProps {
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function NavSidebar({
  className,
  collapsed: controlledCollapsed,
  onCollapsedChange,
}: NavSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = useCallback(
    (val: boolean) => {
      setInternalCollapsed(val);
      onCollapsedChange?.(val);
    },
    [onCollapsedChange]
  );

  const userRole = user?.role as UserRole | undefined;

  // Filter groups by role
  const visibleGroups = useMemo(
    () => NAV_GROUPS.filter((g) => hasRequiredRole(userRole, g.requiredRole)),
    [userRole]
  );

  const { openGroups, toggleGroup, openGroup } = useGroupState(visibleGroups);
  const { openItems, toggleItem, openItem } = useItemState();

  // Auto-expand group + item containing active route
  useEffect(() => {
    for (const group of visibleGroups) {
      for (const item of group.items) {
        const itemMatch =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href + "/"));
        const childMatch = item.children?.some(
          (c) => pathname === c.href || pathname.startsWith(c.href + "/")
        );

        if (itemMatch || childMatch) {
          openGroup(group.label);
          if (childMatch && item.children?.length) {
            openItem(item.href);
          }
          break;
        }
      }
    }
  }, [pathname, visibleGroups, openGroup, openItem]);

  // Search filter
  const query = searchQuery.trim().toLowerCase();
  const searchActive = query.length > 0;

  const filteredGroups = useMemo(() => {
    if (!searchActive) return visibleGroups;
    return visibleGroups
      .map((group) => {
        const filteredItems = group.items.reduce<NavItem[]>((acc, item) => {
          const itemMatch = item.label.toLowerCase().includes(query);
          const matchedChildren =
            item.children?.filter((c) =>
              c.label.toLowerCase().includes(query)
            ) ?? [];
          if (itemMatch || matchedChildren.length > 0) {
            acc.push({
              ...item,
              children: itemMatch ? item.children : matchedChildren,
            });
          }
          return acc;
        }, []);
        return { ...group, items: filteredItems };
      })
      .filter((group) => group.items.length > 0);
  }, [searchActive, visibleGroups, query]);

  // Keyboard shortcut: Cmd/Ctrl+B toggles sidebar
  const handleLogout = useCallback(() => {
    logout();
    router.push("/login");
  }, [logout, router]);

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setCollapsed(!collapsed);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [collapsed, setCollapsed]);

  if (!mounted) return null;

  return (
    <aside
      className={cn(
        "h-screen",
        "bg-wl-bg-sidebar border-r border-wl-border-subtle",
        "flex flex-col",
        "fixed top-0 left-0 z-50",
        "transition-all duration-[var(--wl-duration-base,200ms)] ease-[var(--wl-ease-default,ease)]",
        "overflow-hidden",
        collapsed
          ? "w-[var(--wl-sidebar-collapsed,56px)]"
          : "w-[var(--wl-sidebar-width,240px)]",
        className
      )}
      aria-label="Main navigation"
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "h-[var(--wl-header-height,56px)]",
          "flex items-center",
          "px-4 gap-3",
          "border-b border-wl-border-subtle",
          "flex-shrink-0",
          collapsed ? "justify-center" : ""
        )}
      >
        <div
          className={cn(
            "w-8 h-8 flex-shrink-0 rounded-md",
            "bg-gradient-to-br from-wl-primary-500 to-wl-primary-700",
            "flex items-center justify-center"
          )}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="#0a0a0c"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-md font-bold text-wl-text-primary tracking-tighter leading-tight">
              Witylogix
            </div>
            <div className="text-xs text-wl-text-tertiary tracking-widest uppercase">
              Platform
            </div>
          </div>
        )}
      </div>

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="pt-3 pb-1 flex-shrink-0">
          <SearchBox value={searchQuery} onChange={setSearchQuery} />
        </div>
      )}

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav
        className={cn(
          "flex-1 p-3 flex flex-col gap-0 overflow-y-auto",
          "scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
        )}
        aria-label="Sidebar navigation"
      >
        {filteredGroups.map((group) => (
          <GroupSection
            key={group.label}
            group={group}
            collapsed={collapsed}
            pathname={pathname}
            openItems={openItems}
            onToggleItem={toggleItem}
            openGroups={openGroups}
            onToggleGroup={toggleGroup}
            searchActive={searchActive}
          />
        ))}

        {searchActive && filteredGroups.length === 0 && (
          <p className="px-3 py-4 text-xs text-wl-text-tertiary text-center">
            No pages match &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-wl-border-subtle space-y-1 flex-shrink-0">
        {/* User info */}
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2 rounded-md bg-wl-bg-overlay mb-2">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex-shrink-0",
                "bg-gradient-to-br from-wl-primary-500 to-wl-primary-700",
                "flex items-center justify-center",
                "text-sm font-bold text-wl-text-inverse"
              )}
              aria-hidden="true"
            >
              {user?.name?.slice(0, 2).toUpperCase() ?? "NK"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-wl-text-primary truncate">
                {user?.name ?? "You"}
              </div>
              <div className="text-xs text-wl-text-tertiary truncate capitalize">
                {user?.role ?? "Frontend Lead"}
              </div>
            </div>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={handleLogout}
          title="Sign out"
          className={cn(
            "w-full flex items-center",
            "px-3 py-2 rounded-md",
            "border-none bg-transparent cursor-pointer font-sans",
            "text-wl-text-tertiary text-sm",
            "transition-colors duration-150",
            "hover:text-red-400 hover:bg-wl-bg-overlay",
            collapsed ? "justify-center" : "justify-start gap-3"
          )}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          {!collapsed && <span>Sign out</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title="Cmd+B to toggle sidebar"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "w-full flex items-center",
            "px-3 py-2 rounded-md",
            "border-none bg-transparent cursor-pointer font-sans",
            "text-wl-text-tertiary text-sm",
            "transition-colors duration-150",
            "hover:text-wl-text-primary hover:bg-wl-bg-overlay",
            collapsed ? "justify-center" : "justify-start gap-3"
          )}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={cn(
              "transition-transform duration-200",
              collapsed ? "rotate-180" : ""
            )}
          >
            <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
