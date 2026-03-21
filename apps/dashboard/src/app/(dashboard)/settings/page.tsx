'use client';

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
  Key,
  Sliders,
  Palette,
  Map,
  CreditCard,
  Shield,
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
    description: "Manage your personal information and security",
    icon: <User className="w-6 h-6" />,
    href: "/settings/profile",
  },
  {
    id: "organization",
    label: "Organization",
    description: "Manage organization details and billing",
    icon: <Building2 className="w-6 h-6" />,
    href: "/settings/organization",
  },
  {
    id: "general",
    label: "General",
    description: "Configure company information and localization",
    icon: <Shield className="w-6 h-6" />,
    href: "/settings/general",
  },
  {
    id: "api-keys",
    label: "API Keys",
    description: "Create and manage API keys for integrations",
    icon: <Key className="w-6 h-6" />,
    href: "/settings/api-keys",
  },
  {
    id: "auth-providers",
    label: "Auth Providers",
    description: "Configure SSO and authentication settings",
    icon: <Shield className="w-6 h-6" />,
    href: "/settings/auth-providers",
  },
  {
    id: "billing",
    label: "Billing",
    description: "Manage subscription and payment methods",
    icon: <CreditCard className="w-6 h-6" />,
    href: "/settings/billing",
  },
  {
    id: "branding",
    label: "Branding",
    description: "Customize colors, logos, and branding",
    icon: <Palette className="w-6 h-6" />,
    href: "/settings/branding",
  },
  {
    id: "maps",
    label: "Maps",
    description: "Configure Google Maps API and settings",
    icon: <Map className="w-6 h-6" />,
    href: "/settings/maps",
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
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header
        title="Settings"
        subtitle="Manage your account, organization, and preferences"
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SETTINGS_TABS.map((tab) => (
            <Link key={tab.id} href={tab.href}>
              <Card className="h-full bg-[#12121a] border border-[#1e1e2e] hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer group">
                <CardHeader>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                      {tab.icon}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <CardTitle className="text-lg text-white">{tab.label}</CardTitle>
                  <CardDescription className="mt-2 text-gray-400">
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
