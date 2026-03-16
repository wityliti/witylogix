"use client";

import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  User,
  Building2,
  Bell,
  Key,
  Users,
  Sliders,
  ChevronRight,
} from "lucide-react";

interface SettingsTab {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}

const SETTINGS_TABS: SettingsTab[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Manage your personal information and preferences",
    icon: <User className="w-6 h-6" />,
    href: "/settings/profile",
  },
  {
    id: "organization",
    label: "Organization",
    description: "Manage organization details and settings",
    icon: <Building2 className="w-6 h-6" />,
    href: "/settings/organization",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Configure notification preferences and channels",
    icon: <Bell className="w-6 h-6" />,
    href: "/settings/notifications",
  },
  {
    id: "api-keys",
    label: "API Keys",
    description: "Create and manage API keys for integrations",
    icon: <Key className="w-6 h-6" />,
    href: "/settings/api-keys",
  },
  {
    id: "team",
    label: "Team",
    description: "Manage team members and their roles",
    icon: <Users className="w-6 h-6" />,
    href: "/settings/team",
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Customize your dashboard experience",
    icon: <Sliders className="w-6 h-6" />,
    href: "/settings/preferences",
  },
];

export default function SettingsHub() {
  return (
    <div className="min-h-screen bg-[var(--wl-bg-primary)]">
      <Header
        title="Settings"
        subtitle="Manage your account, organization, and preferences"
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SETTINGS_TABS.map((tab) => (
            <Link key={tab.id} href={tab.href}>
              <Card className="h-full border border-[var(--wl-border)] hover:border-[var(--wl-primary)] hover:shadow-md transition-all cursor-pointer group">
                <CardHeader>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 bg-[var(--wl-primary)]/10 rounded-lg text-[var(--wl-primary)] group-hover:bg-[var(--wl-primary)]/20 transition-colors">
                      {tab.icon}
                    </div>
                    <ChevronRight className="w-5 h-5 text-[var(--wl-text-secondary)] group-hover:text-[var(--wl-primary)] transition-colors" />
                  </div>
                  <CardTitle className="text-lg">{tab.label}</CardTitle>
                  <CardDescription className="mt-2">
                    {tab.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
