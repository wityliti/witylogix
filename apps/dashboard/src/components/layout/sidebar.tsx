"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* ─── Icon SVGs (inline for zero deps) ──────── */
function Icon({ d, size = 20 }: { d: string; size?: number }) {
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

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/",
    icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  },
  // ─── Operations
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
    label: "Drivers",
    href: "/drivers",
    icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2 M9 7a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  },
  {
    label: "Routes",
    href: "/routes",
    icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z M12 11.5A2.5 2.5 0 019.5 9 2.5 2.5 0 0112 6.5 2.5 2.5 0 0114.5 9a2.5 2.5 0 01-2.5 2.5z",
  },
  // ─── Configuration
  {
    label: "Locations",
    href: "/locations",
    icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z M12 13a2 2 0 100-4 2 2 0 000 4z",
  },
  {
    label: "Shipping Profiles",
    href: "/shipping-profiles",
    icon: "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 15a3 3 0 100-6 3 3 0 000 6z",
  },
  {
    label: "Zones",
    href: "/zones",
    icon: "M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z M8 2v16 M16 6v16",
  },
  {
    label: "Time Slots",
    href: "/time-slots",
    icon: "M12 2a10 10 0 100 20 10 10 0 000-20z M12 6v6l4 2",
  },
  // ─── Communication
  {
    label: "Notifications",
    href: "/notifications",
    icon: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  },
  // ─── Business
  {
    label: "Payments",
    href: "/payments",
    icon: "M12 1v22m7-4H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2z",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: "M18 20V10 M12 20V4 M6 20v-6",
  },
  // ─── Admin
  {
    label: "Activity Log",
    href: "/activity",
    icon: "M12 2v20m0 0l-7-7m7 7l7-7M9 4H5a2 2 0 00-2 2v10a2 2 0 002 2h4m6-14h4a2 2 0 012 2v10a2 2 0 01-2 2h-4",
  },
  {
    label: "Integrations",
    href: "/integrations",
    icon: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 15a3 3 0 100-6 3 3 0 000 6z",
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      style={{
        width: collapsed ? "var(--wl-sidebar-collapsed)" : "var(--wl-sidebar-width)",
        height: "100vh",
        background: "var(--wl-bg-sidebar)",
        borderRight: "1px solid var(--wl-border-subtle)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 50,
        transition: `width var(--wl-duration-base) var(--wl-ease-default)`,
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: "var(--wl-header-height)",
          display: "flex",
          alignItems: "center",
          padding: collapsed ? "0 var(--wl-space-4)" : "0 var(--wl-space-5)",
          gap: "var(--wl-space-3)",
          borderBottom: "1px solid var(--wl-border-subtle)",
          flexShrink: 0,
        }}
      >
        {/* Logo icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--wl-radius-md)",
            background: "linear-gradient(135deg, var(--wl-primary-500), var(--wl-primary-700))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
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
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                fontSize: "var(--wl-text-md)",
                fontWeight: 700,
                color: "var(--wl-text-primary)",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Witylogix
            </div>
            <div
              style={{
                fontSize: "var(--wl-text-xs)",
                color: "var(--wl-text-tertiary)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Delivery Hub
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          padding: "var(--wl-space-3)",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          overflowY: "auto",
        }}
      >
        {(() => {
          const sections = [
            { heading: null, items: [NAV_ITEMS[0]] },
            { heading: "Operations", items: [NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[3], NAV_ITEMS[4]] },
            { heading: "Configuration", items: [NAV_ITEMS[5], NAV_ITEMS[6], NAV_ITEMS[7], NAV_ITEMS[8]] },
            { heading: "Communication", items: [NAV_ITEMS[9]] },
            { heading: "Business", items: [NAV_ITEMS[10], NAV_ITEMS[11]] },
            { heading: "Admin", items: [NAV_ITEMS[12], NAV_ITEMS[13], NAV_ITEMS[14]] },
          ];

          return sections.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              {section.heading && !collapsed && (
                <div
                  style={{
                    padding: "var(--wl-space-3) var(--wl-space-2) var(--wl-space-1)",
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "var(--wl-text-tertiary)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {section.heading}
                </div>
              )}
              {section.items.map((item, i) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--wl-space-3)",
                      padding: collapsed
                        ? "var(--wl-space-2) var(--wl-space-3)"
                        : "var(--wl-space-2) var(--wl-space-3)",
                      borderRadius: "var(--wl-radius-md)",
                      fontSize: "var(--wl-text-sm)",
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "var(--wl-primary-400)" : "var(--wl-text-secondary)",
                      background: isActive ? "rgba(245, 166, 35, 0.08)" : "transparent",
                      textDecoration: "none",
                      transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
                      position: "relative",
                      justifyContent: collapsed ? "center" : "flex-start",
                    }}
                  >
                    {isActive && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 3,
                          height: 16,
                          borderRadius: "0 var(--wl-radius-full) var(--wl-radius-full) 0",
                          background: "var(--wl-primary-500)",
                        }}
                      />
                    )}
                    <span style={{ display: "flex", flexShrink: 0 }}>
                      <Icon d={item.icon} />
                    </span>
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ));
        })()}
      </nav>

      {/* Collapse Toggle */}
      <div
        style={{
          padding: "var(--wl-space-3)",
          borderTop: "1px solid var(--wl-border-subtle)",
        }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: "var(--wl-space-3)",
            padding: "var(--wl-space-2) var(--wl-space-3)",
            borderRadius: "var(--wl-radius-md)",
            border: "none",
            background: "transparent",
            color: "var(--wl-text-tertiary)",
            fontSize: "var(--wl-text-sm)",
            cursor: "pointer",
            fontFamily: "var(--wl-font-sans)",
            transition: `color var(--wl-duration-fast) var(--wl-ease-default)`,
          }}
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
            style={{
              transform: collapsed ? "rotate(180deg)" : "none",
              transition: `transform var(--wl-duration-base) var(--wl-ease-default)`,
            }}
          >
            <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
