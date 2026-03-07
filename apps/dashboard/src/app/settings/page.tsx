"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Settings,
  Key,
  Palette,
  Users,
  Bell,
  CreditCard,
  Lock,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
  badgeVariant?: "default" | "success" | "warning" | "danger" | "info" | "primary";
}

const settingsSections: SettingsSection[] = [
  {
    id: "general",
    title: "General Settings",
    description: "Configure store name, domain, timezone, language, and currency",
    icon: <Settings className="w-6 h-6" />,
    href: "/settings/general",
  },
  {
    id: "auth",
    title: "Authentication",
    description: "Set up SSO providers, MFA, and security protocols",
    icon: <Lock className="w-6 h-6" />,
    href: "/settings/auth-providers",
    badge: "Connected",
    badgeVariant: "success",
  },
  {
    id: "api-keys",
    title: "API Keys",
    description: "Manage API keys, scopes, and integration credentials",
    icon: <Key className="w-6 h-6" />,
    href: "/settings/api-keys",
    badge: "3 Active",
    badgeVariant: "info",
  },
  {
    id: "branding",
    title: "Branding",
    description: "Customize logo, colors, and tracking page appearance",
    icon: <Palette className="w-6 h-6" />,
    href: "/settings/branding",
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Configure email, SMS, WhatsApp, and push notification providers",
    icon: <Bell className="w-6 h-6" />,
    href: "/settings/notifications-config",
    badge: "BYOK Ready",
    badgeVariant: "primary",
  },
  {
    id: "team",
    title: "Team Members",
    description: "Invite teammates, manage roles, and set permissions",
    icon: <Users className="w-6 h-6" />,
    href: "/settings/team",
    badge: "5 Members",
    badgeVariant: "info",
  },
  {
    id: "billing",
    title: "Billing & Plans",
    description: "View current plan, usage metrics, and upgrade options",
    icon: <CreditCard className="w-6 h-6" />,
    href: "/settings/billing",
    badge: "Pro Plan",
    badgeVariant: "success",
  },
];

const statusCards = [
  {
    label: "Account Status",
    value: "Active",
    description: "Pro plan active since Jan 2025",
    icon: <CheckCircle className="w-5 h-5" style={{ color: "var(--wl-success)" }} />,
  },
  {
    label: "API Usage",
    value: "2.4M / 10M",
    description: "24% of monthly quota",
    icon: <AlertCircle className="w-5 h-5" style={{ color: "var(--wl-warning)" }} />,
  },
  {
    label: "Team Members",
    value: "5 / 10",
    description: "2 pending invitations",
    icon: <Users className="w-5 h-5" style={{ color: "var(--wl-primary)" }} />,
  },
];

export default function SettingsHub() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-135 from-[var(--wl-bg-primary)] to-[var(--wl-bg-secondary)]">
      <Header title="Settings" subtitle="Manage your account and workspace configuration" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quick Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {statusCards.map((card, idx) => (
            <Card key={idx} className="border-l-4 border-l-[var(--wl-primary)]">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div>
                    <div className="text-sm font-medium text-[var(--wl-text-secondary)]">
                      {card.label}
                    </div>
                    <div className="text-3xl font-bold text-[var(--wl-text-primary)] mt-2">
                      {card.value}
                    </div>
                  </div>
                  {card.icon}
                </div>
                <p className="text-xs text-[var(--wl-text-tertiary)]">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Settings Sections Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--wl-text-primary)] mb-2">
            Settings Sections
          </h2>
          <p className="text-[var(--wl-text-secondary)]">
            Manage all aspects of your Witylogix workspace
          </p>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {settingsSections.map((section) => (
            <Link key={section.id} href={section.href} className="no-underline">
              <Card
                className={cn(
                  "h-full cursor-pointer transition-all",
                  expandedSection === section.id && "border-[var(--wl-primary)] shadow-lg"
                )}
                style={{
                  boxShadow: expandedSection === section.id ? "0 10px 30px rgba(0,0,0,0.1)" : "0 1px 3px rgba(0,0,0,0.05)",
                }}
                onMouseEnter={() => setExpandedSection(section.id)}
                onMouseLeave={() => setExpandedSection(null)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div
                      className={cn(
                        "p-2 rounded-lg flex items-center justify-center transition-all",
                        expandedSection === section.id
                          ? "bg-[var(--wl-primary)]"
                          : "bg-[var(--wl-bg-tertiary)]"
                      )}
                    >
                      <span className={expandedSection === section.id ? "text-white" : "text-[var(--wl-text-primary)]"}>
                        {section.icon}
                      </span>
                    </div>
                    {section.badge && (
                      <Badge variant={section.badgeVariant || "default"}>
                        {section.badge}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mb-1">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  <div
                    className={cn(
                      "flex items-center text-[var(--wl-primary)] gap-2 transition-all",
                      expandedSection === section.id && "translate-x-1"
                    )}
                  >
                    <span className="text-sm font-medium">Open settings</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Information Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Security Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Security & Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-4">
                <li className="flex gap-3 items-start">
                  <CheckCircle className="w-5 h-5 text-[var(--wl-success)] mt-0.5 flex-shrink-0" />
                  <span className="text-[var(--wl-text-secondary)] text-sm">
                    Two-factor authentication enabled
                  </span>
                </li>
                <li className="flex gap-3 items-start">
                  <CheckCircle className="w-5 h-5 text-[var(--wl-success)] mt-0.5 flex-shrink-0" />
                  <span className="text-[var(--wl-text-secondary)] text-sm">
                    SSO configured (Auth0)
                  </span>
                </li>
                <li className="flex gap-3 items-start">
                  <CheckCircle className="w-5 h-5 text-[var(--wl-success)] mt-0.5 flex-shrink-0" />
                  <span className="text-[var(--wl-text-secondary)] text-sm">
                    GDPR & SOC2 compliant
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-4">
                <li className="flex gap-3 items-start">
                  <Clock className="w-5 h-5 text-[var(--wl-info)] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm text-[var(--wl-text-primary)] font-medium">
                      API key created
                    </div>
                    <div className="text-xs text-[var(--wl-text-tertiary)]">
                      2 hours ago
                    </div>
                  </div>
                </li>
                <li className="flex gap-3 items-start">
                  <Clock className="w-5 h-5 text-[var(--wl-info)] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm text-[var(--wl-text-primary)] font-medium">
                      Team member added
                    </div>
                    <div className="text-xs text-[var(--wl-text-tertiary)]">
                      1 day ago
                    </div>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Help & Support */}
        <Card className="bg-[var(--wl-bg-tertiary)] border-0">
          <CardContent className="pt-8">
            <h3 className="text-lg font-semibold text-[var(--wl-text-primary)] mb-2">
              Need Help?
            </h3>
            <p className="text-sm text-[var(--wl-text-secondary)] mb-6">
              Can't find what you're looking for? Check our documentation or contact our support team for immediate assistance.
            </p>
            <div className="flex gap-4 flex-wrap">
              <Button variant="secondary">View Documentation</Button>
              <Button variant="primary">Contact Support</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
