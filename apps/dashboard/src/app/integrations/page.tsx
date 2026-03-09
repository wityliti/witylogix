"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
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
          <div className={cn("flex gap-1 bg-wl-bg-overlay rounded-md p-1")}>
            {(["marketplace", "installed"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 rounded-sm border-none text-xs font-semibold cursor-pointer capitalize",
                  view === v ? "bg-wl-primary-500 text-wl-text-inverse" : "bg-transparent text-wl-text-tertiary"
                )}
              >
                {v} {v === "installed" ? `(${installed.length})` : ""}
              </button>
            ))}
          </div>
        }
      />

      <div className={cn("p-6")}>
        {/* Search + Categories */}
        <div className={cn("flex gap-4 mb-5 flex-wrap items-center")}>
          <input
            type="text"
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn("w-80 p-2 px-4 bg-wl-bg-elevated border border-wl-border-default rounded-md text-wl-text-primary text-sm font-sans outline-none")}
          />

          <div className={cn("flex gap-1 flex-wrap")}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={cn(
                  "flex items-center gap-2 py-1 px-3 rounded-full border text-xs font-semibold cursor-pointer",
                  category === cat.key
                    ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                    : "bg-transparent text-wl-text-tertiary border-wl-border-default"
                )}
              >
                <span className="text-xs">{cat.icon}</span>
                {cat.label}
                <span className="opacity-70">{cat.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Integration Grid */}
        <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4")}>
          {filtered.map((integ, i) => {
            const isInstalled = integ.status === "INSTALLED";
            const isComingSoon = integ.status === "COMING_SOON";

            return (
              <Card
                key={integ.slug}
                className={cn(
                  "wl-animate-in relative overflow-hidden",
                  isComingSoon && "opacity-60",
                  isInstalled && "border-wl-success-400 border-opacity-30"
                )}
                style={{
                  animationDelay: `${i * 40}ms`,
                }}
              >
                {/* Installed indicator */}
                {isInstalled && (
                  <div className={cn("absolute top-0 left-0 right-0 h-0.5 bg-wl-success-400")} />
                )}

                <div className={cn("flex justify-between items-start mb-3")}>
                  <div>
                    <div className={cn("flex items-center gap-2 mb-1")}>
                      <span className={cn("text-base font-bold text-wl-text-primary")}>
                        {integ.name}
                      </span>
                      {integ.popular && (
                        <span className={cn("text-xs px-1 rounded text-wl-primary-400 font-bold uppercase tracking-wider bg-[rgba(245,166,35,0.12)]")}>
                          Popular
                        </span>
                      )}
                    </div>
                    <p className={cn("text-xs text-wl-text-tertiary m-0 leading-relaxed")}>
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
                <div className={cn("flex gap-1 mb-3")}>
                  <span className={cn("text-xs px-1.5 rounded bg-wl-bg-surface text-wl-text-tertiary font-medium uppercase tracking-wider")}>
                    {integ.category.replace(/_/g, " ")}
                  </span>
                  {integ.subcategory && (
                    <span className={cn("text-xs px-1.5 rounded bg-wl-bg-surface text-wl-text-tertiary font-medium")}>
                      {integ.subcategory}
                    </span>
                  )}
                </div>

                {/* Capabilities */}
                <div className={cn("flex gap-1 flex-wrap mb-3")}>
                  {integ.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className={cn("text-xs px-1.5 py-1 rounded border border-wl-border-subtle text-wl-text-tertiary bg-[rgba(255,255,255,0.04)]")}
                    >
                      {cap}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className={cn("flex gap-2")}>
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
          <div className={cn("text-center p-12 text-wl-text-tertiary")}>
            No integrations found matching your criteria.
          </div>
        )}
      </div>
    </>
  );
}
