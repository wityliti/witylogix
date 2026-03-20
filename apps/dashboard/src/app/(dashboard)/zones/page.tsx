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



export default function ZonesPage() {
  const { items: data, loading, error, refetch, pagination } = useApiList<Zone>('/api/v4/zones');

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={`${ZONES.length} zones · ${data.filter((z) => z.isActive).length} active`}
        actions={<Button variant="primary" size="md">+ Create Zone</Button>}
      />

      <div className="p-6">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4">
          {data.map((zone, i) => (
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
