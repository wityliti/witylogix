"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import { useFreightLoads, useFreightAudit, useCarrierScorecard, useLaneAnalytics } from "@/hooks/use-freight";

/* ═══════════════════════════════════════════════════════════
   FREIGHT OVERVIEW DASHBOARD
   ═══════════════════════════════════════════════════════════ */

export default function FreightPage() {
  const { loads } = useFreightLoads(100);
  const { audits, totalSavings } = useFreightAudit();
  const { carriers } = useCarrierScorecard();
  const { analytics } = useLaneAnalytics();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      // Trigger refetch in real implementation
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const booked = loads.filter((l) => l.status === "Booked").length;
    const inTransit = loads.filter((l) => l.status === "In-Transit").length;
    const delivered = loads.filter((l) => l.status === "Delivered").length;
    const exceptions = loads.filter((l) => l.status === "Exception").length;
    const avgCostPerMile = loads.length > 0 ? Math.round((loads.reduce((sum, l) => sum + l.rate, 0) / loads.length) * 100) / 100 : 0;

    return {
      booked,
      inTransit,
      delivered,
      exceptions,
      avgCostPerMile,
      totalLoadVolume: loads.length,
    };
  }, [loads]);

  // Top carriers by volume
  const topCarriers = useMemo(() => {
    const carrierVolume: Record<string, { name: string; count: number; rate: number }> = {};
    loads.forEach((load) => {
      if (load.carrier) {
        if (!carrierVolume[load.carrier]) {
          carrierVolume[load.carrier] = { name: load.carrier, count: 0, rate: 0 };
        }
        carrierVolume[load.carrier].count += 1;
        carrierVolume[load.carrier].rate += load.rate;
      }
    });

    return Object.values(carrierVolume)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((c) => ({ ...c, avgRate: Math.round(c.rate / c.count) }));
  }, [loads]);

  // Rate trend data
  const rateTrend = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      const monthLoads = loads.filter(
        (l) => new Date(l.createdAt).getMonth() === date.getMonth() && new Date(l.createdAt).getFullYear() === date.getFullYear()
      );
      const avg = monthLoads.length > 0 ? Math.round((monthLoads.reduce((sum, l) => sum + l.rate, 0) / monthLoads.length) * 100) / 100 : 0;
      return {
        month: date.toLocaleString("default", { month: "short" }),
        avgCostPerMile: avg,
      };
    });
  }, [loads]);

  return (
    <div className="p-6">
      {/* KPI Stats Row */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 mb-6">
        <StatCard label="Active Loads" value={stats.booked} accentColor="var(--wl-primary-500)" index={0} />
        <StatCard label="In-Transit" value={stats.inTransit} accentColor="var(--wl-info-400)" index={1} />
        <StatCard label="Delivered" value={stats.delivered} accentColor="var(--wl-success-400)" index={2} />
        <StatCard label="Exceptions" value={stats.exceptions} accentColor="var(--wl-danger-400)" index={3} />
        <StatCard label="Avg $/Mile" value={`$${stats.avgCostPerMile}`} accentColor="var(--wl-warning-400)" index={4} />
        <StatCard label="Total Savings" value={`$${totalSavings}`} accentColor="var(--wl-success-400)" index={5} />
      </div>

      {/* Rate Trend Chart */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4 p-6 pb-4">
          <div>
            <h3 className="text-lg font-bold text-wl-text-primary">Rate Trend (12 Months)</h3>
            <p className="text-xs text-wl-text-tertiary mt-1">Average cost per mile over time</p>
          </div>
          <div className="flex gap-2">
            <button className="px-2 py-1 text-xs rounded border border-wl-border-default text-wl-text-secondary hover:bg-wl-bg-overlay">
              CSV
            </button>
            <button className="px-2 py-1 text-xs rounded border border-wl-border-default text-wl-text-secondary hover:bg-wl-bg-overlay">
              Trend
            </button>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="h-48 bg-wl-bg-surface rounded border border-wl-border-subtle flex items-end justify-between p-4 gap-1">
            {rateTrend.map((point, idx) => {
              const maxRate = Math.max(...rateTrend.map((p) => p.avgCostPerMile));
              const height = maxRate > 0 ? (point.avgCostPerMile / maxRate) * 100 : 0;
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-1 group"
                  title={`${point.month}: $${point.avgCostPerMile}`}
                >
                  <div
                    className={cn(
                      "w-full rounded-t transition-colors duration-150",
                      height > 70 ? "bg-wl-danger-400" : height > 50 ? "bg-wl-warning-400" : "bg-wl-primary-500"
                    )}
                    style={{ minHeight: `${Math.max(height, 8)}%` }}
                  />
                  <span className="text-[10px] text-wl-text-tertiary group-hover:text-wl-text-primary font-mono">{point.month}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Carriers by Volume */}
        <Card>
          <div className="p-6 border-b border-wl-border-subtle">
            <h3 className="text-lg font-bold text-wl-text-primary">Top Carriers (by Volume)</h3>
            <p className="text-xs text-wl-text-tertiary mt-1">Performance scorecard</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Carrier", "Loads", "Avg Rate", "Rating", "Score"].map((h) => (
                    <th
                      key={h}
                      className="text-left p-4 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider border-b border-wl-border-subtle bg-wl-bg-surface whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topCarriers.map((carrier, idx) => {
                  const carrierData = carriers.find((c) => c.name === carrier.name);
                  return (
                    <tr key={idx} className="border-b border-wl-border-subtle hover:bg-wl-bg-overlay transition-colors">
                      <td className="p-4 font-semibold text-wl-text-primary">{carrier.name}</td>
                      <td className="p-4 text-wl-text-secondary font-mono">{carrier.count}</td>
                      <td className="p-4 font-mono font-semibold text-wl-primary-400">${carrier.avgRate}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-500">★</span>
                          <span className="text-xs font-semibold text-wl-text-secondary">
                            {carrierData?.rating.toFixed(1) ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={
                            carrierData && carrierData.complianceScore > 90
                              ? "success"
                              : carrierData && carrierData.complianceScore > 75
                                ? "warning"
                                : "danger"
                          }
                        >
                          {carrierData ? Math.round(carrierData.complianceScore) : "—"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-wl-border-subtle bg-wl-bg-surface">
            <a href="/freight/compliance" className="text-xs text-wl-primary-400 hover:underline font-semibold">
              View all carriers →
            </a>
          </div>
        </Card>

        {/* Recent Audit Findings */}
        <Card>
          <div className="p-6 border-b border-wl-border-subtle">
            <h3 className="text-lg font-bold text-wl-text-primary">Recent Audit Findings</h3>
            <p className="text-xs text-wl-text-tertiary mt-1">Cost and compliance issues</p>
          </div>
          <div className="divide-y divide-wl-border-subtle max-h-96 overflow-y-auto">
            {audits.slice(0, 6).map((audit) => {
              const severityColor =
                audit.severity === "High"
                  ? "text-wl-danger-400 bg-wl-danger-bg"
                  : audit.severity === "Medium"
                    ? "text-wl-warning-400 bg-wl-warning-bg"
                    : "text-wl-info-400 bg-wl-info-bg";

              return (
                <div key={audit.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn("rounded-full w-2 h-2 flex-shrink-0 mt-1.5", severityColor)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-wl-text-primary">
                          {audit.category}
                        </span>
                        <Badge variant={audit.severity === "High" ? "danger" : audit.severity === "Medium" ? "warning" : "info"} >
                          {audit.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-wl-text-secondary line-clamp-2">{audit.findings}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-wl-text-tertiary">
                          {new Date(audit.auditDate).toLocaleDateString()}
                        </span>
                        <span className="text-xs font-semibold text-wl-success-400">
                          +${audit.savings}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-4 border-t border-wl-border-subtle bg-wl-bg-surface">
            <a href="/freight/loads" className="text-xs text-wl-primary-400 hover:underline font-semibold">
              View all audits →
            </a>
          </div>
        </Card>
      </div>

      {/* Quick Actions Bar */}
      <div className="mt-6 flex gap-3">
        <Button variant="primary" size="md">
          + Post Load
        </Button>
        <Button variant="secondary" size="md">
          Get Rates
        </Button>
        <Button variant="secondary" size="md">
          Run Audit
        </Button>
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-sm text-wl-text-secondary cursor-pointer hover:text-wl-text-primary">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="w-4 h-4 rounded border border-wl-border-default cursor-pointer"
          />
          Auto-refresh (30s)
        </label>
      </div>
    </div>
  );
}
