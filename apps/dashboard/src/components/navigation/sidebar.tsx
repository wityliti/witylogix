"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";

interface SidebarItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

interface SidebarGroup {
  label?: string;
  items: SidebarItem[];
}

interface IconProps {
  d: string;
  size?: number;
}

function Icon({ d, size = 20 }: IconProps) {
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
    >
      <path d={d} />
    </svg>
  );
}

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    items: [
      {
        label: "Home",
        href: "/home",
        icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
      },
    ],
  },
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/analytics",
        icon: "M18 20V10 M12 20V4 M6 20v-6",
      },
      {
        label: "Activity",
        href: "/activity",
        icon: "M12 2v20m0 0l-7-7m7 7l7-7M9 4H5a2 2 0 00-2 2v10a2 2 0 002 2h4m6-14h4a2 2 0 012 2v10a2 2 0 01-2 2h-4",
      },
    ],
  },
  {
    label: "Orders & Deliveries",
    items: [
      {
        label: "Orders",
        href: "/orders",
        icon: "M16 3h5v5 M21 3l-7 7 M8 21H3v-5 M3 21l7-7",
      },
      {
        label: "Shipments",
        href: "/shipments",
        icon: "M3 12l9-5 9 5v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z",
      },
      {
        label: "Deliveries",
        href: "/delivery",
        icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z M12 11.5A2.5 2.5 0 019.5 9 2.5 2.5 0 0112 6.5 2.5 2.5 0 0114.5 9a2.5 2.5 0 01-2.5 2.5z",
      },
    ],
  },
  {
    label: "Fleet",
    items: [
      {
        label: "Drivers",
        href: "/drivers",
        icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2 M9 7a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
      },
      {
        label: "Locations",
        href: "/locations",
        icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z M12 13a2 2 0 100-4 2 2 0 000 4z",
      },
      {
        label: "Zones",
        href: "/zones",
        icon: "M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z M8 2v16 M16 6v16",
      },
    ],
  },
  {
    label: "Integrations",
    items: [
      {
        label: "Integrations",
        href: "/integrations",
        icon: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        label: "Settings",
        href: "/settings",
        icon: "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 15a3 3 0 100-6 3 3 0 000 6z",
      },
    ],
  },
];

interface NavSidebarProps {
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function NavSidebar({ className, collapsed: controlledCollapsed, onCollapsedChange }: NavSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = (val: boolean) => {
    setInternalCollapsed(val);
    onCollapsedChange?.(val);
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

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
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <aside
      className={cn(
        "h-screen",
        "bg-[#0a0a0e] border-r border-white/[0.06]",
        "flex flex-col",
        "fixed top-0 left-0 z-50",
        "transition-all duration-base ease-default",
        "overflow-hidden",
        collapsed ? "w-[var(--wl-sidebar-collapsed)]" : "w-[var(--wl-sidebar-width)]",
        className
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "h-[var(--wl-header-height)]",
          "flex items-center",
          "px-4 gap-3",
          "border-b border-wl-border-subtle",
          "flex-shrink-0",
          collapsed ? "justify-center" : ""
        )}
      >
        <div
          className={cn(
            "w-8 h-8 flex-shrink-0",
            "rounded-md",
            "bg-gradient-to-br from-wl-primary-500 to-wl-primary-700",
            "flex items-center justify-center"
          )}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
            <div
              className={cn(
                "text-md font-bold",
                "text-wl-text-primary",
                "tracking-tighter",
                "leading-tight"
              )}
            >
              Witylogix
            </div>
            <div
              className={cn(
                "text-xs",
                "text-wl-text-tertiary",
                "tracking-widest",
                "uppercase"
              )}
            >
              Platform
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          "flex-1",
          "p-3",
          "flex flex-col gap-1",
          "overflow-y-auto"
        )}
      >
        {SIDEBAR_GROUPS.map((group, groupIdx) => (
          <div key={groupIdx}>
            {group.label && !collapsed && (
              <div
                className={cn(
                  "px-2 py-3 pb-1",
                  "text-xs font-bold uppercase",
                  "text-wl-text-tertiary",
                  "tracking-wider"
                )}
              >
                {group.label}
              </div>
            )}

            {group.items.map((item) => {
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3",
                    "px-3 py-2",
                    "rounded-md",
                    "text-sm font-medium",
                    "no-underline",
                    "transition-all duration-fast ease-default",
                    "relative",
                    collapsed ? "justify-center" : "justify-between",
                    isActive
                      ? "text-[#f5a623] bg-[rgba(245,166,35,0.1)] border border-[rgba(245,166,35,0.15)] shadow-[0_0_12px_rgba(245,166,35,0.08)]"
                      : "text-wl-text-secondary border border-transparent hover:text-wl-text-primary hover:bg-white/[0.04]"
                  )}
                >
                  <span className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={cn("flex flex-shrink-0", isActive && "drop-shadow-[0_0_6px_rgba(245,166,35,0.5)]")}>
                      <Icon d={item.icon} />
                    </span>
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </span>

                  {isActive && (
                    <div
                      className={cn(
                        "absolute left-0",
                        "top-1/2 -translate-y-1/2",
                        "w-[3px] h-5",
                        "rounded-r-full",
                        "bg-[#f5a623]",
                        "shadow-[0_0_8px_rgba(245,166,35,0.6)]"
                      )}
                    />
                  )}

                  {item.badge && !collapsed && (
                    <Badge variant="danger" className="ml-auto flex-shrink-0">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "p-3",
          "border-t border-wl-border-subtle",
          "space-y-3"
        )}
      >
        {/* User Avatar */}
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2 rounded-md bg-wl-bg-overlay">
            <div
              className={cn(
                "w-8 h-8 rounded-full",
                "bg-gradient-to-br from-wl-primary-500 to-wl-primary-700",
                "flex items-center justify-center flex-shrink-0",
                "text-sm font-bold text-wl-text-inverse"
              )}
            >
              NK
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-wl-text-primary truncate">
                You
              </div>
              <div className="text-xs text-wl-text-tertiary truncate">
                Frontend Lead
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={cn(
            "w-full",
            "flex items-center",
            "px-3 py-2",
            "rounded-md",
            "border-none bg-transparent",
            "text-wl-text-tertiary",
            "text-sm",
            "cursor-pointer font-sans",
            "transition-colors duration-fast ease-default",
            "hover:text-red-400 hover:bg-wl-bg-overlay",
            collapsed ? "justify-center" : "justify-start",
            "gap-3"
          )}
          title="Sign out"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          {!collapsed && <span>Sign out</span>}
        </button>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full",
            "flex items-center",
            "px-3 py-2",
            "rounded-md",
            "border-none bg-transparent",
            "text-wl-text-tertiary",
            "text-sm",
            "cursor-pointer font-sans",
            "transition-colors duration-fast ease-default",
            "hover:text-wl-text-primary hover:bg-wl-bg-overlay",
            collapsed ? "justify-center" : "justify-start",
            "gap-3"
          )}
          title="Cmd+B to toggle sidebar"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "transition-transform duration-base ease-default",
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
