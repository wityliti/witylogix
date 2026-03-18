"use client";

import { cn } from "@/lib/utils";
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

      <div className="p-6">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4">
          {ZONES.map((zone, i) => (
            <Card
              key={zone.id}
              hover
              className={cn("wl-animate-in relative overflow-hidden", zone.isActive ? "opacity-100" : "opacity-60")}
              style={{
                animationDelay: `${i * 60}ms`,
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: zone.color }} />

              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: zone.color }}
                  />
                  <span className="text-base font-bold text-wl-text-primary">
                    {zone.name}
                  </span>
                </div>
                <Badge variant={zone.isActive ? "success" : "default"} dot>
                  {zone.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-wl-bg-surface rounded-md mb-4">
                <div>
                  <div className="text-[10px] text-wl-text-tertiary mb-0.5">Base Rate</div>
                  <div className="text-sm font-bold font-mono text-wl-text-primary">
                    {formatCurrency(zone.baseRate)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-wl-text-tertiary mb-0.5">Per KM</div>
                  <div className="text-sm font-bold font-mono text-wl-text-primary">
                    {formatCurrency(zone.perKmRate)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-wl-text-tertiary mb-0.5">Min Order</div>
                  <div className="text-sm font-bold font-mono text-wl-text-primary">
                    {formatCurrency(zone.minOrder)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-wl-text-tertiary mb-0.5">Free Above</div>
                  <div className={`text-sm font-bold font-mono ${zone.freeAbove ? "text-wl-success-400" : "text-wl-text-tertiary"}`}>
                    {zone.freeAbove ? formatCurrency(zone.freeAbove) : "—"}
                  </div>
                </div>
              </div>

              {/* Activity */}
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  <span className="text-xs text-wl-text-tertiary">
                    <strong className="text-wl-text-secondary font-mono">{zone.ordersToday}</strong> orders today
                  </span>
                  <span className="text-xs text-wl-text-tertiary">
                    <strong className="text-wl-text-secondary font-mono">{zone.drivers}</strong> drivers
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
