"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ═══════════════════════════════════════════════════════════
   INTEGRATIONS MARKETPLACE — Enhanced version for dashboard
   ═══════════════════════════════════════════════════════════ */

type Category = "ALL" | "COMMUNICATION" | "ROUTING" | "ORDER_MANAGEMENT" | "INVENTORY" | "PAYMENT" | "ANALYTICS";

interface Integration {
  slug: string;
  name: string;
  description: string;
  category: Category;
  subcategory?: string;
  status: "AVAILABLE" | "COMING_SOON" | "BETA" | "INSTALLED";
  capabilities: string[];
  popular?: boolean;
}

const CATEGORIES: { key: Category; label: string; icon: string; count: number }[] = [
  { key: "ALL", label: "All", icon: "⬡", count: 38 },
  { key: "COMMUNICATION", label: "Communication", icon: "✉", count: 17 },
  { key: "ROUTING", label: "Routing", icon: "◈", count: 6 },
  { key: "ORDER_MANAGEMENT", label: "Orders", icon: "☰", count: 4 },
  { key: "INVENTORY", label: "Inventory", icon: "☷", count: 4 },
  { key: "PAYMENT", label: "Payment", icon: "◆", count: 3 },
  { key: "ANALYTICS", label: "Analytics", icon: "◧", count: 4 },
];

const INTEGRATIONS: Integration[] = [
  // Communication
  { slug: "sendgrid", name: "SendGrid", description: "Transactional email delivery with analytics", category: "COMMUNICATION", subcategory: "Email", status: "INSTALLED", capabilities: ["send", "templates", "analytics"], popular: true },
  { slug: "mailgun", name: "Mailgun", description: "Powerful email API for developers", category: "COMMUNICATION", subcategory: "Email", status: "AVAILABLE", capabilities: ["send", "validate", "webhooks"] },
  { slug: "resend", name: "Resend", description: "Modern email API for developers", category: "COMMUNICATION", subcategory: "Email", status: "AVAILABLE", capabilities: ["send", "react-email"] },
  { slug: "twilio", name: "Twilio", description: "Programmable SMS, voice, and WhatsApp", category: "COMMUNICATION", subcategory: "SMS", status: "INSTALLED", capabilities: ["sms", "voice", "whatsapp"], popular: true },
  { slug: "vonage", name: "Vonage", description: "Communication APIs for SMS and voice", category: "COMMUNICATION", subcategory: "SMS", status: "AVAILABLE", capabilities: ["sms", "voice", "verify"] },
  { slug: "meta-whatsapp", name: "Meta WhatsApp", description: "WhatsApp Business Cloud API", category: "COMMUNICATION", subcategory: "WhatsApp", status: "AVAILABLE", capabilities: ["messages", "templates", "media"] },
  { slug: "firebase-push", name: "Firebase Cloud Messaging", description: "Cross-platform push notifications", category: "COMMUNICATION", subcategory: "Push", status: "INSTALLED", capabilities: ["push", "topics", "analytics"], popular: true },
  { slug: "onesignal", name: "OneSignal", description: "Multi-channel notification platform", category: "COMMUNICATION", subcategory: "Push", status: "AVAILABLE", capabilities: ["push", "email", "sms"] },
  // Routing
  { slug: "mapbox", name: "Mapbox", description: "Advanced maps, routing, and optimization", category: "ROUTING", status: "INSTALLED", capabilities: ["route", "matrix", "geocode", "eta"], popular: true },
  { slug: "google-maps", name: "Google Maps", description: "Industry-standard maps and directions", category: "ROUTING", status: "AVAILABLE", capabilities: ["route", "matrix", "geocode", "places"] },
  { slug: "osrm", name: "OSRM", description: "Open source routing engine (self-hosted)", category: "ROUTING", status: "AVAILABLE", capabilities: ["route", "matrix", "table"] },
  { slug: "here", name: "HERE Maps", description: "Enterprise location services", category: "ROUTING", status: "BETA", capabilities: ["route", "matrix", "geocode", "traffic"] },
  // Order Management
  { slug: "shipstation", name: "ShipStation", description: "Multi-carrier shipping platform", category: "ORDER_MANAGEMENT", status: "AVAILABLE", capabilities: ["labels", "tracking", "rates"], popular: true },
  { slug: "easypost", name: "EasyPost", description: "Shipping API with 100+ carriers", category: "ORDER_MANAGEMENT", status: "AVAILABLE", capabilities: ["labels", "tracking", "insurance"] },
  { slug: "aftership", name: "AfterShip", description: "Shipment tracking and notifications", category: "ORDER_MANAGEMENT", status: "COMING_SOON", capabilities: ["tracking", "notifications", "analytics"] },
  // Inventory
  { slug: "stockx", name: "StockX Integration", description: "Real-time inventory sync", category: "INVENTORY", status: "AVAILABLE", capabilities: ["sync", "levels", "alerts"] },
  { slug: "cin7", name: "Cin7 Omni", description: "Connected inventory management", category: "INVENTORY", status: "COMING_SOON", capabilities: ["sync", "warehouse", "orders"] },
  // Payment
  { slug: "stripe", name: "Stripe", description: "Payment processing for internet businesses", category: "PAYMENT", status: "AVAILABLE", capabilities: ["payments", "invoices", "subscriptions"], popular: true },
  { slug: "square", name: "Square", description: "Payments and point-of-sale", category: "PAYMENT", status: "COMING_SOON", capabilities: ["payments", "pos", "invoices"] },
  // Analytics
  { slug: "google-analytics", name: "Google Analytics", description: "Website and app analytics", category: "ANALYTICS", status: "AVAILABLE", capabilities: ["tracking", "reports", "events"] },
  { slug: "mixpanel", name: "Mixpanel", description: "Product analytics for user behavior", category: "ANALYTICS", status: "AVAILABLE", capabilities: ["events", "funnels", "retention"] },
  { slug: "segment", name: "Segment", description: "Customer data platform", category: "ANALYTICS", status: "BETA", capabilities: ["events", "destinations", "warehouse"], popular: true },
];

export default function IntegrationsPage() {
  const [category, setCategory] = useState<Category>("ALL");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"marketplace" | "installed">("marketplace");

  const filtered = useMemo(() => {
    let items = view === "installed" ? INTEGRATIONS.filter((i) => i.status === "INSTALLED") : INTEGRATIONS;
    if (category !== "ALL") items = items.filter((i) => i.category === category);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.slug.includes(q));
    }
    return items;
  }, [category, search, view]);

  const installed = INTEGRATIONS.filter((i) => i.status === "INSTALLED");

  return (
    <>
      <Header
        title="Integrations"
        subtitle={`${INTEGRATIONS.length} available · ${installed.length} installed`}
        actions={
          <div style={{ display: "flex", gap: 2, background: "var(--wl-bg-overlay)", borderRadius: "var(--wl-radius-md)", padding: 2 }}>
            {(["marketplace", "installed"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "var(--wl-space-1) var(--wl-space-3)",
                  borderRadius: "var(--wl-radius-sm)",
                  border: "none",
                  fontSize: "var(--wl-text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--wl-font-sans)",
                  textTransform: "capitalize",
                  background: view === v ? "var(--wl-primary-500)" : "transparent",
                  color: view === v ? "var(--wl-text-inverse)" : "var(--wl-text-tertiary)",
                }}
              >
                {v} {v === "installed" ? `(${installed.length})` : ""}
              </button>
            ))}
          </div>
        }
      />

      <div style={{ padding: "var(--wl-space-6)" }}>
        {/* Search + Categories */}
        <div style={{ display: "flex", gap: "var(--wl-space-4)", marginBottom: "var(--wl-space-5)", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: 300,
              padding: "var(--wl-space-2) var(--wl-space-4)",
              background: "var(--wl-bg-elevated)",
              border: "1px solid var(--wl-border-default)",
              borderRadius: "var(--wl-radius-md)",
              color: "var(--wl-text-primary)",
              fontSize: "var(--wl-text-sm)",
              fontFamily: "var(--wl-font-sans)",
              outline: "none",
            }}
          />

          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--wl-space-2)",
                  padding: "var(--wl-space-1) var(--wl-space-3)",
                  borderRadius: "var(--wl-radius-full)",
                  border: "1px solid",
                  fontSize: "var(--wl-text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--wl-font-sans)",
                  background: category === cat.key ? "var(--wl-primary-500)" : "transparent",
                  color: category === cat.key ? "var(--wl-text-inverse)" : "var(--wl-text-tertiary)",
                  borderColor: category === cat.key ? "var(--wl-primary-500)" : "var(--wl-border-default)",
                }}
              >
                <span style={{ fontSize: 12 }}>{cat.icon}</span>
                {cat.label}
                <span style={{ opacity: 0.7 }}>{cat.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Integration Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "var(--wl-space-4)",
          }}
        >
          {filtered.map((integ, i) => {
            const isInstalled = integ.status === "INSTALLED";
            const isComingSoon = integ.status === "COMING_SOON";

            return (
              <Card
                key={integ.slug}
                className="wl-animate-in"
                style={{
                  position: "relative",
                  overflow: "hidden",
                  opacity: isComingSoon ? 0.6 : 1,
                  animationDelay: `${i * 40}ms`,
                  borderColor: isInstalled ? "rgba(16, 185, 129, 0.3)" : undefined,
                }}
              >
                {/* Installed indicator */}
                {isInstalled && (
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--wl-success-400)" }} />
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--wl-space-3)" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)", marginBottom: 4 }}>
                      <span style={{ fontSize: "var(--wl-text-md)", fontWeight: 700, color: "var(--wl-text-primary)" }}>
                        {integ.name}
                      </span>
                      {integ.popular && (
                        <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "rgba(245,166,35,0.12)", color: "var(--wl-primary-400)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Popular
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", margin: 0, lineHeight: 1.5 }}>
                      {integ.description}
                    </p>
                  </div>
                  <Badge
                    variant={isInstalled ? "success" : integ.status === "BETA" ? "info" : isComingSoon ? "default" : "primary"}
                    dot={isInstalled}
                  >
                    {isInstalled ? "Installed" : integ.status.replace(/_/g, " ")}
                  </Badge>
                </div>

                {/* Category + subcategory */}
                <div style={{ display: "flex", gap: 4, marginBottom: "var(--wl-space-3)" }}>
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "var(--wl-bg-surface)", color: "var(--wl-text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {integ.category.replace(/_/g, " ")}
                  </span>
                  {integ.subcategory && (
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "var(--wl-bg-surface)", color: "var(--wl-text-tertiary)", fontWeight: 500 }}>
                      {integ.subcategory}
                    </span>
                  )}
                </div>

                {/* Capabilities */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: "var(--wl-space-3)" }}>
                  {integ.capabilities.map((cap) => (
                    <span
                      key={cap}
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: "rgba(255,255,255,0.04)",
                        color: "var(--wl-text-tertiary)",
                        border: "1px solid var(--wl-border-subtle)",
                      }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "var(--wl-space-2)" }}>
                  {isInstalled ? (
                    <>
                      <Button variant="secondary" size="sm">Configure</Button>
                      <Button variant="ghost" size="sm">Test</Button>
                    </>
                  ) : isComingSoon ? (
                    <Button variant="ghost" size="sm" disabled>Coming Soon</Button>
                  ) : (
                    <Button variant="primary" size="sm">Install</Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "var(--wl-space-12)", color: "var(--wl-text-tertiary)" }}>
            No integrations found matching your criteria.
          </div>
        )}
      </div>
    </>
  );
}
