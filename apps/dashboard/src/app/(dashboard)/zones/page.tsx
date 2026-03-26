"use client";

import { cn } from "@/lib/utils";
import { useApiList } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   ZONES PAGE — Delivery zone management with pricing
   ═══════════════════════════════════════════════════════════ */

interface Zone {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  baseRate: number;
  perKmRate: number;
  minOrder: number;
  freeAbove?: number;
  ordersToday: number;
  drivers: number;
}

const ZONES: Zone[] = [
  {
    id: "zone-001",
    name: "Downtown Core",
    color: "#3b82f6",
    isActive: true,
    baseRate: 5.99,
    perKmRate: 0.5,
    minOrder: 15,
    freeAbove: 50,
    ordersToday: 127,
    drivers: 12,
  },
  {
    id: "zone-002",
    name: "Suburban North",
    color: "#10b981",
    isActive: true,
    baseRate: 7.99,
    perKmRate: 0.75,
    minOrder: 20,
    freeAbove: 75,
    ordersToday: 89,
    drivers: 8,
  },
  {
    id: "zone-003",
    name: "Suburban South",
    color: "#f59e0b",
    isActive: true,
    baseRate: 7.99,
    perKmRate: 0.75,
    minOrder: 20,
    ordersToday: 65,
    drivers: 7,
  },
  {
    id: "zone-004",
    name: "Airport Corridor",
    color: "#8b5cf6",
    isActive: true,
    baseRate: 9.99,
    perKmRate: 1.0,
    minOrder: 25,
    freeAbove: 100,
    ordersToday: 34,
    drivers: 5,
  },
  {
    id: "zone-005",
    name: "Waterfront District",
    color: "#ec4899",
    isActive: false,
    baseRate: 8.99,
    perKmRate: 0.9,
    minOrder: 25,
    ordersToday: 0,
    drivers: 0,
  },
];

export default function ZonesPage() {
  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={`${ZONES.length} zones · ${ZONES.filter((z) => z.isActive).length} active`}
        actions={<Button variant="primary" size="md">+ Create Zone</Button>}
      />

      <div className="p-6 bg-[#0a0a0f] min-h-screen">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4">
          {ZONES.map((zone, i) => (
            <Card
              key={zone.id}
              className={cn("relative overflow-hidden bg-[#12121a] border border-[#1e1e2e] hover:border-blue-500 transition-colors", zone.isActive ? "opacity-100" : "opacity-60")}
            >
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: zone.color }} />

              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: zone.color }}
                    />
                    <span className="text-base font-bold text-white">
                      {zone.name}
                    </span>
                  </div>
                  <Badge variant={zone.isActive ? "success" : "default"} dot>
                    {zone.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Pricing Grid */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-[#1a1a2e] rounded-md mb-4">
                  <div>
                    <div className="text-[10px] text-gray-400 mb-0.5">Base Rate</div>
                    <div className="text-sm font-bold font-mono text-white">
                      {formatCurrency(zone.baseRate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 mb-0.5">Per KM</div>
                    <div className="text-sm font-bold font-mono text-white">
                      {formatCurrency(zone.perKmRate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 mb-0.5">Min Order</div>
                    <div className="text-sm font-bold font-mono text-white">
                      {formatCurrency(zone.minOrder)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 mb-0.5">Free Above</div>
                    <div className={`text-sm font-bold font-mono ${zone.freeAbove ? "text-emerald-400" : "text-gray-400"}`}>
                      {zone.freeAbove ? formatCurrency(zone.freeAbove) : "—"}
                    </div>
                  </div>
                </div>

                {/* Activity */}
                <div className="flex justify-between items-center">
                  <div className="flex gap-4">
                    <span className="text-xs text-gray-400">
                      <strong className="text-gray-300 font-mono">{zone.ordersToday}</strong> orders today
                    </span>
                    <span className="text-xs text-gray-400">
                      <strong className="text-gray-300 font-mono">{zone.drivers}</strong> drivers
                    </span>
                  </div>
                  <Button variant="ghost" size="sm">Edit</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
