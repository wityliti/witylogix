"use client";

import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   ZONES PAGE — Delivery zone management with pricing
   ═══════════════════════════════════════════════════════════ */

const ZONES = [
  { id: "z-1", name: "Downtown Core", baseRate: 5.00, perKmRate: 1.50, minOrder: 15, freeAbove: 75, isActive: true, priority: 1, ordersToday: 45, drivers: 4, color: "var(--wl-primary-500)" },
  { id: "z-2", name: "Midtown East", baseRate: 6.00, perKmRate: 1.75, minOrder: 20, freeAbove: 100, isActive: true, priority: 2, ordersToday: 38, drivers: 3, color: "var(--wl-info-400)" },
  { id: "z-3", name: "West Side", baseRate: 7.00, perKmRate: 2.00, minOrder: 20, freeAbove: 100, isActive: true, priority: 3, ordersToday: 29, drivers: 3, color: "var(--wl-success-400)" },
  { id: "z-4", name: "South District", baseRate: 6.50, perKmRate: 1.80, minOrder: 15, freeAbove: 80, isActive: true, priority: 4, ordersToday: 22, drivers: 2, color: "var(--wl-warning-400)" },
  { id: "z-5", name: "Harbor Area", baseRate: 8.00, perKmRate: 2.25, minOrder: 25, freeAbove: 120, isActive: true, priority: 5, ordersToday: 14, drivers: 1, color: "var(--wl-danger-400)" },
  { id: "z-6", name: "Industrial Zone", baseRate: 10.00, perKmRate: 2.50, minOrder: 30, freeAbove: null, isActive: false, priority: 6, ordersToday: 0, drivers: 0, color: "var(--wl-neutral-500)" },
];

export default function ZonesPage() {
  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={`${ZONES.length} zones · ${ZONES.filter((z) => z.isActive).length} active`}
        actions={<Button variant="primary" size="md">+ Create Zone</Button>}
      />

      <div style={{ padding: "var(--wl-space-6)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "var(--wl-space-4)" }}>
          {ZONES.map((zone, i) => (
            <Card
              key={zone.id}
              hover
              className="wl-animate-in"
              style={{
                position: "relative",
                overflow: "hidden",
                opacity: zone.isActive ? 1 : 0.6,
                animationDelay: `${i * 60}ms`,
              }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: zone.color }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--wl-space-4)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-3)" }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: zone.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: "var(--wl-text-md)", fontWeight: 700, color: "var(--wl-text-primary)" }}>
                    {zone.name}
                  </span>
                </div>
                <Badge variant={zone.isActive ? "success" : "default"} dot>
                  {zone.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              {/* Pricing Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "var(--wl-space-3)",
                  padding: "var(--wl-space-3)",
                  background: "var(--wl-bg-surface)",
                  borderRadius: "var(--wl-radius-md)",
                  marginBottom: "var(--wl-space-4)",
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 2 }}>Base Rate</div>
                  <div style={{ fontSize: "var(--wl-text-sm)", fontWeight: 700, fontFamily: "var(--wl-font-mono)", color: "var(--wl-text-primary)" }}>
                    {formatCurrency(zone.baseRate)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 2 }}>Per KM</div>
                  <div style={{ fontSize: "var(--wl-text-sm)", fontWeight: 700, fontFamily: "var(--wl-font-mono)", color: "var(--wl-text-primary)" }}>
                    {formatCurrency(zone.perKmRate)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 2 }}>Min Order</div>
                  <div style={{ fontSize: "var(--wl-text-sm)", fontWeight: 700, fontFamily: "var(--wl-font-mono)", color: "var(--wl-text-primary)" }}>
                    {formatCurrency(zone.minOrder)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 2 }}>Free Above</div>
                  <div style={{ fontSize: "var(--wl-text-sm)", fontWeight: 700, fontFamily: "var(--wl-font-mono)", color: zone.freeAbove ? "var(--wl-success-400)" : "var(--wl-text-tertiary)" }}>
                    {zone.freeAbove ? formatCurrency(zone.freeAbove) : "—"}
                  </div>
                </div>
              </div>

              {/* Activity */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "var(--wl-space-4)" }}>
                  <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                    <strong style={{ color: "var(--wl-text-secondary)", fontFamily: "var(--wl-font-mono)" }}>{zone.ordersToday}</strong> orders today
                  </span>
                  <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                    <strong style={{ color: "var(--wl-text-secondary)", fontFamily: "var(--wl-font-mono)" }}>{zone.drivers}</strong> drivers
                  </span>
                </div>
                <Button variant="ghost" size="sm">Edit</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
