import { Header } from "../../components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import Link from "next/link";
import {
  Settings,
  Key,
  Palette,
  Users,
  Bell,
  CreditCard,
  ArrowRight,
} from "lucide-react";

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
}

const settingsSections: SettingsSection[] = [
  {
    id: "general",
    title: "General Settings",
    description:
      "Configure tenant information, timezone, currency, and business hours",
    icon: <Settings className="w-6 h-6" />,
    href: "/settings/general",
  },
  {
    id: "api-keys",
    title: "API Keys",
    description: "Manage API keys, scopes, and integrate with external systems",
    icon: <Key className="w-6 h-6" />,
    href: "/settings/api-keys",
    badge: "3 Active",
  },
  {
    id: "branding",
    title: "Branding",
    description:
      "Customize colors, logo, and branded communication templates",
    icon: <Palette className="w-6 h-6" />,
    href: "/settings/branding",
  },
  {
    id: "team",
    title: "Team Members",
    description: "Invite team members, manage roles, and permissions",
    icon: <Users className="w-6 h-6" />,
    href: "/settings/team",
    badge: "5 Members",
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Configure notification channels and event preferences",
    icon: <Bell className="w-6 h-6" />,
    href: "/settings/notifications-config",
  },
  {
    id: "billing",
    title: "Billing & Plans",
    description: "Manage subscription, invoices, and payment methods",
    icon: <CreditCard className="w-6 h-6" />,
    href: "/settings/billing",
    badge: "Pro Plan",
  },
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--wl-bg-primary)] to-[var(--wl-bg-secondary)]">
      <Header title="Settings" subtitle="Manage your account and workspace configuration" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <Card className="border-l-4 border-l-[var(--wl-primary)]">
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-[var(--wl-text-secondary)]">
                Account Status
              </div>
              <div className="text-2xl font-bold text-[var(--wl-text-primary)] mt-2">
                Active
              </div>
              <p className="text-xs text-[var(--wl-text-tertiary)] mt-1">
                Pro plan active since Jan 2025
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[var(--wl-success)]">
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-[var(--wl-text-secondary)]">
                API Usage
              </div>
              <div className="text-2xl font-bold text-[var(--wl-text-primary)] mt-2">
                2.4M / 10M
              </div>
              <p className="text-xs text-[var(--wl-text-tertiary)] mt-1">
                24% of monthly quota
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[var(--wl-warning)]">
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-[var(--wl-text-secondary)]">
                Team Members
              </div>
              <div className="text-2xl font-bold text-[var(--wl-text-primary)] mt-2">
                5 / 10
              </div>
              <p className="text-xs text-[var(--wl-text-tertiary)] mt-1">
                2 pending invitations
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Settings Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {settingsSections.map((section) => (
            <Link key={section.id} href={section.href}>
              <Card className="h-full hover:border-[var(--wl-primary)] hover:shadow-lg transition-all duration-300 cursor-pointer group">
                <CardHeader>
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2 rounded-lg bg-[var(--wl-bg-tertiary)] group-hover:bg-[var(--wl-primary)] group-hover:text-white transition-colors">
                      {section.icon}
                    </div>
                    {section.badge && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--wl-primary)]/10 text-[var(--wl-primary)]">
                        {section.badge}
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[var(--wl-text-secondary)] mb-6">
                    {section.description}
                  </p>
                  <div className="flex items-center text-[var(--wl-primary)] group-hover:translate-x-1 transition-transform">
                    <span className="text-sm font-medium">Open settings</span>
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Help Section */}
        <Card className="mt-12 bg-[var(--wl-bg-tertiary)] border-0">
          <CardContent className="pt-8">
            <h3 className="text-lg font-semibold text-[var(--wl-text-primary)] mb-2">
              Need Help?
            </h3>
            <p className="text-sm text-[var(--wl-text-secondary)] mb-6">
              Can't find what you're looking for? Check our documentation or
              contact our support team.
            </p>
            <div className="flex gap-4">
              <Button
                variant="outline"
                className="border-[var(--wl-border)] hover:bg-[var(--wl-bg-secondary)]"
              >
                View Documentation
              </Button>
              <Button className="bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90">
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
