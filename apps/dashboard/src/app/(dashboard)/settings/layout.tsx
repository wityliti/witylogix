"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  User,
  Building2,
  Bell,
  Key,
  Users,
  Sliders,
  ChevronRight,
  Zap,
} from "lucide-react";

interface SettingsSidebarLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

const SIDEBAR_LINKS: SettingsSidebarLink[] = [
  {
    href: "/settings",
    label: "Settings Hub",
    icon: <Sliders className="w-4 h-4" />,
    description: "Overview of all settings",
  },
  {
    href: "/settings/profile",
    label: "Profile",
    icon: <User className="w-4 h-4" />,
    description: "Your personal information",
  },
  {
    href: "/settings/organization",
    label: "Organization",
    icon: <Building2 className="w-4 h-4" />,
    description: "Organization details",
  },
  {
    href: "/settings/notifications",
    label: "Notifications",
    icon: <Bell className="w-4 h-4" />,
    description: "Notification preferences",
  },
  {
    href: "/settings/api-keys",
    label: "API Keys",
    icon: <Key className="w-4 h-4" />,
    description: "Manage API credentials",
  },
  {
    href: "/settings/team",
    label: "Team",
    icon: <Users className="w-4 h-4" />,
    description: "Team management",
  },
  {
    href: "/settings/preferences",
    label: "Preferences",
    icon: <Sliders className="w-4 h-4" />,
    description: "Dashboard preferences",
  },
  {
    href: "/settings/webhooks",
    label: "Webhooks",
    icon: <Zap className="w-4 h-4" />,
    description: "Debug and test webhooks",
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex gap-6 min-h-screen bg-wl-bg-sunken">
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:w-64 flex-col gap-2 p-6 border-r border-wl-border-default">
        <div className="mb-8">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--wl-text-secondary)] px-3">
            Settings
          </h3>
        </div>

        <nav className="space-y-1">
          {SIDEBAR_LINKS.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-3 rounded-lg transition-all no-underline",
                  isActive
                    ? "bg-wl-primary-500/10 text-wl-primary-500 border border-wl-primary-500/30"
                    : "text-wl-text-secondary hover:bg-wl-bg-elevated hover:text-wl-text-primary"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "p-2 rounded-lg",
                    isActive
                      ? "bg-wl-primary-500 text-white"
                      : "bg-wl-bg-elevated text-[var(--wl-text-secondary)]"
                  )}>
                    {link.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{link.label}</p>
                    {link.description && (
                      <p className="text-xs text-[var(--wl-text-tertiary)]">
                        {link.description}
                      </p>
                    )}
                  </div>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 flex-shrink-0" />}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
