"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
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
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, var(--wl-bg-primary) 0%, var(--wl-bg-secondary) 100%)" }}>
      <Header title="Settings" subtitle="Manage your account and workspace configuration" />

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem 1rem" }}>
        {/* Quick Status Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.5rem",
            marginBottom: "3rem",
          }}
        >
          {statusCards.map((card, idx) => (
            <Card key={idx} style={{ borderLeft: "4px solid var(--wl-primary)" }}>
              <CardContent style={{ paddingTop: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: "500", color: "var(--wl-text-secondary)" }}>
                      {card.label}
                    </div>
                    <div style={{ fontSize: "1.875rem", fontWeight: "700", color: "var(--wl-text-primary)", marginTop: "0.5rem" }}>
                      {card.value}
                    </div>
                  </div>
                  {card.icon}
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--wl-text-tertiary)" }}>{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Settings Sections Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--wl-text-primary)", marginBottom: "0.5rem" }}>
            Settings Sections
          </h2>
          <p style={{ color: "var(--wl-text-secondary)", fontSize: "0.95rem" }}>
            Manage all aspects of your Witylogix workspace
          </p>
        </div>

        {/* Settings Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
            gap: "1.5rem",
            marginBottom: "3rem",
          }}
        >
          {settingsSections.map((section) => (
            <Link key={section.id} href={section.href} style={{ textDecoration: "none" }}>
              <Card
                style={{
                  height: "100%",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  borderColor: expandedSection === section.id ? "var(--wl-primary)" : "var(--wl-border)",
                  boxShadow: expandedSection === section.id ? "0 10px 30px rgba(0,0,0,0.1)" : "0 1px 3px rgba(0,0,0,0.05)",
                }}
                onMouseEnter={() => setExpandedSection(section.id)}
                onMouseLeave={() => setExpandedSection(null)}
              >
                <CardHeader>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <div
                      style={{
                        padding: "0.5rem",
                        borderRadius: "0.5rem",
                        backgroundColor: "var(--wl-bg-tertiary)",
                        color: expandedSection === section.id ? "var(--wl-bg-primary)" : "var(--wl-text-primary)",
                        background: expandedSection === section.id ? "var(--wl-primary)" : "var(--wl-bg-tertiary)",
                        transition: "all 0.3s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {section.icon}
                    </div>
                    {section.badge && (
                      <Badge variant={section.badgeVariant || "default"}>
                        {section.badge}
                      </Badge>
                    )}
                  </div>
                  <CardTitle style={{ fontSize: "1.125rem", marginBottom: "0.25rem" }}>{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      color: "var(--wl-primary)",
                      gap: "0.5rem",
                      transition: "all 0.3s ease",
                      transform: expandedSection === section.id ? "translateX(4px)" : "translateX(0)",
                    }}
                  >
                    <span style={{ fontSize: "0.875rem", fontWeight: "500" }}>Open settings</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Information Sections */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
          {/* Security Info */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: "1.125rem" }}>Security & Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
                <li style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <CheckCircle className="w-5 h-5" style={{ color: "var(--wl-success)", marginTop: "2px", flexShrink: 0 }} />
                  <span style={{ color: "var(--wl-text-secondary)", fontSize: "0.9rem" }}>
                    Two-factor authentication enabled
                  </span>
                </li>
                <li style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <CheckCircle className="w-5 h-5" style={{ color: "var(--wl-success)", marginTop: "2px", flexShrink: 0 }} />
                  <span style={{ color: "var(--wl-text-secondary)", fontSize: "0.9rem" }}>
                    SSO configured (Auth0)
                  </span>
                </li>
                <li style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <CheckCircle className="w-5 h-5" style={{ color: "var(--wl-success)", marginTop: "2px", flexShrink: 0 }} />
                  <span style={{ color: "var(--wl-text-secondary)", fontSize: "0.9rem" }}>
                    GDPR & SOC2 compliant
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: "1.125rem" }}>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
                <li style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <Clock className="w-5 h-5" style={{ color: "var(--wl-info)", marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.9rem", color: "var(--wl-text-primary)", fontWeight: "500" }}>
                      API key created
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--wl-text-tertiary)" }}>
                      2 hours ago
                    </div>
                  </div>
                </li>
                <li style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <Clock className="w-5 h-5" style={{ color: "var(--wl-info)", marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.9rem", color: "var(--wl-text-primary)", fontWeight: "500" }}>
                      Team member added
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--wl-text-tertiary)" }}>
                      1 day ago
                    </div>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Help & Support */}
        <Card style={{ background: "var(--wl-bg-tertiary)", border: "none" }}>
          <CardContent style={{ paddingTop: "2rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.5rem" }}>
              Need Help?
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--wl-text-secondary)", marginBottom: "1.5rem" }}>
              Can't find what you're looking for? Check our documentation or contact our support team for immediate assistance.
            </p>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <Button variant="secondary">View Documentation</Button>
              <Button variant="primary">Contact Support</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
