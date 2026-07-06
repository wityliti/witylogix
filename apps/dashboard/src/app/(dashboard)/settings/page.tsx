"use client";

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";
import {
  User,
  Building2,
  Key,
  Sliders,
  Palette,
  Map,
  CreditCard,
  Shield,
  ArrowUpRight,
} from "lucide-react";

interface SettingsTab {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  accent: string;
}

const SETTINGS_TABS: SettingsTab[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Manage your personal information and security",
    icon: <User className="w-5 h-5" />,
    href: "/settings/profile",
    accent: "var(--wl-chart-violet)",
  },
  {
    id: "organization",
    label: "Organization",
    description: "Manage organization details and billing",
    icon: <Building2 className="w-5 h-5" />,
    href: "/settings/organization",
    accent: "var(--wl-success-400)",
  },
  {
    id: "general",
    label: "General",
    description: "Configure company information and localization",
    icon: <Shield className="w-5 h-5" />,
    href: "/settings/general",
    accent: "var(--wl-info-400)",
  },
  {
    id: "api-keys",
    label: "API Keys",
    description: "Create and manage API keys for integrations",
    icon: <Key className="w-5 h-5" />,
    href: "/settings/api-keys",
    accent: "var(--wl-warning-400)",
  },
  {
    id: "auth-providers",
    label: "Auth Providers",
    description: "Configure SSO and authentication settings",
    icon: <Shield className="w-5 h-5" />,
    href: "/settings/auth-providers",
    accent: "var(--wl-chart-purple)",
  },
  {
    id: "billing",
    label: "Billing",
    description: "Manage subscription and payment methods",
    icon: <CreditCard className="w-5 h-5" />,
    href: "/settings/billing",
    accent: "var(--wl-chart-pink)",
  },
  {
    id: "branding",
    label: "Branding",
    description: "Customize colors, logos, and branding",
    icon: <Palette className="w-5 h-5" />,
    href: "/settings/branding",
    accent: "var(--wl-chart-orange)",
  },
  {
    id: "maps",
    label: "Maps",
    description: "Configure map settings and CARTO basemaps",
    icon: <Map className="w-5 h-5" />,
    href: "/settings/maps",
    accent: "var(--wl-chart-teal)",
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Customize your dashboard experience",
    icon: <Sliders className="w-5 h-5" />,
    href: "/settings/preferences",
    accent: "var(--wl-chart-slate)",
  },
];

export default function SettingsHub() {
  return (
    <div className="min-h-screen">
      <Header
        title="Settings"
        subtitle="Manage your account, organization, and preferences"
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SETTINGS_TABS.map((tab, i) => (
            <Link
              key={tab.id}
              href={tab.href}
              className="group block no-underline"
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl p-5",
                  "bg-wl-bg-surface border border-white/[0.06]",
                  "hover:border-white/[0.14] hover:bg-wl-bg-elevated",
                  "transition-all duration-200 ease-out",
                  "h-full",
                )}
                style={{
                  animationDelay: `${i * 50}ms`,
                }}
              >
                {/* Accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] opacity-60 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: `linear-gradient(90deg, ${tab.accent}, transparent 70%)`,
                  }}
                />

                {/* Header row: icon + arrow */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
                    style={{
                      backgroundColor: `${tab.accent}15`,
                      color: tab.accent,
                    }}
                  >
                    {tab.icon}
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>

                {/* Label */}
                <h3 className="text-[15px] font-semibold text-white/90 mb-1.5">
                  {tab.label}
                </h3>

                {/* Description */}
                <p className="text-[13px] leading-relaxed text-white/40">
                  {tab.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
