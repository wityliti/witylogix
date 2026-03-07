"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ═══════════════════════════════════════════════════════════
   ROUTES PAGE — Route planning, optimization, and tracking
   ═══════════════════════════════════════════════════════════ */

interface Route {
  id: string;
  name: string;
  date: string;
  driver: string | null;
  status: "DRAFT" | "OPTIMIZED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  stops: number;
  completedStops: number;
  totalDistance: string;
  totalDuration: string;
  startedAt: string | null;
  completedAt: string | null;
}

const statusVariant = (s: string): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const map: Record<string, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    DRAFT: "default", OPTIMIZED: "info", ASSIGNED: "info", IN_PROGRESS: "primary", COMPLETED: "success", CANCELLED: "danger",
  };
  return map[s] ?? "default";
};

const ROUTES: Route[] = [
  { id: "rt-001", name: "Downtown Morning", date: "2026-03-06", driver: "Carlos M.", status: "IN_PROGRESS", stops: 12, completedStops: 7, totalDistance: "18.4 km", totalDuration: "2h 15m", startedAt: "8:30 AM", completedAt: null },
  { id: "rt-002", name: "Midtown Express", date: "2026-03-06", driver: "Sofia L.", status: "IN_PROGRESS", stops: 8, completedStops: 3, totalDistance: "12.1 km", totalDuration: "1h 40m", startedAt: "9:15 AM", completedAt: null },
  { id: "rt-003", name: "West Side Afternoon", date: "2026-03-06", driver: "Marcus J.", status: "ASSIGNED", stops: 15, completedStops: 0, totalDistance: "22.7 km", totalDuration: "3h 10m", startedAt: null, completedAt: null },
  { id: "rt-004", name: "Harbor Express", date: "2026-03-06", driver: null, status: "OPTIMIZED", stops: 6, completedStops: 0, totalDistance: "9.3 km", totalDuration: "55m", startedAt: null, completedAt: null },
  { id: "rt-005", name: "South District AM", date: "2026-03-06", driver: "Ahmed K.", status: "COMPLETED", stops: 10, completedStops: 10, totalDistance: "15.8 km", totalDuration: "1h 55m", startedAt: "7:00 AM", completedAt: "8:55 AM" },
  { id: "rt-006", name: "Evening Batch", date: "2026-03-06", driver: null, status: "DRAFT", stops: 20, completedStops: 0, totalDistance: "—", totalDuration: "—", startedAt: null, completedAt: null },
];

export default function RoutesPage() {
  const [view, setView] = useState<"list" | "timeline">("list");

  return (
    <>
      <Header
        title="Routes"
        subtitle="Plan, optimize, and track delivery routes"
        actions={
          <div style={{ display: "flex", gap: "var(--wl-space-2)" }}>
            <Button variant="secondary" size="md">Auto-Optimize</Button>
            <Button variant="primary" size="md">+ Create Route</Button>
          </div>
        }
      />

      <div style={{ padding: "var(--wl-space-6)" }}>
        {/* Summary Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-6)",
          }}
        >
          {[
            { label: "Total Routes", value: ROUTES.length, color: "var(--wl-primary-500)" },
            { label: "In Progress", value: ROUTES.filter((r) => r.status === "IN_PROGRESS").length, color: "var(--wl-info-400)" },
            { label: "Stops Completed", value: `${ROUTES.reduce((a, r) => a + r.completedStops, 0)}/${ROUTES.reduce((a, r) => a + r.stops, 0)}`, color: "var(--wl-success-400)" },
            { label: "Unassigned", value: ROUTES.filter((r) => !r.driver).length, color: "var(--wl-warning-400)" },
          ].map((stat, i) => (
            <Card
              key={stat.label}
              className="wl-animate-in"
              style={{ position: "relative", overflow: "hidden", animationDelay: `${i * 60}ms`, opacity: 0 }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: stat.color }} />
              <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginBottom: "var(--wl-space-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {stat.label}
              </div>
              <div style={{ fontSize: "var(--wl-text-2xl)", fontWeight: 700, fontFamily: "var(--wl-font-mono)", color: "var(--wl-text-primary)" }}>
                {stat.value}
              </div>
            </Card>
          ))}
        </div>

        {/* Route Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-4)" }}>
          {ROUTES.map((route, i) => {
            const progress = route.stops > 0 ? (route.completedStops / route.stops) * 100 : 0;

            return (
              <Card
                key={route.id}
                className="wl-animate-in"
                style={{
                  animationDelay: `${(i + 4) * 60}ms`,
                  opacity: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-5)" }}>
                  {/* Route Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-3)", marginBottom: "var(--wl-space-2)" }}>
                      <span style={{ fontSize: "var(--wl-text-md)", fontWeight: 700, color: "var(--wl-text-primary)" }}>
                        {route.name}
                      </span>
                      <Badge variant={statusVariant(route.status)} dot>
                        {route.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div style={{ display: "flex", gap: "var(--wl-space-5)", fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)" }}>
                      <span>Driver: {route.driver ?? "Unassigned"}</span>
                      <span>{route.stops} stops</span>
                      <span>{route.totalDistance}</span>
                      <span>{route.totalDuration}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ width: 200, flexShrink: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: "var(--wl-text-tertiary)" }}>Progress</span>
                      <span style={{ fontSize: 10, fontFamily: "var(--wl-font-mono)", color: "var(--wl-text-secondary)" }}>
                        {route.completedStops}/{route.stops}
                      </span>
                    </div>
                    <div style={{ height: 6, background: "var(--wl-bg-overlay)", borderRadius: "var(--wl-radius-full)", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${progress}%`,
                          height: "100%",
                          background: progress === 100
                            ? "var(--wl-success-400)"
                            : "linear-gradient(90deg, var(--wl-primary-500), var(--wl-primary-400))",
                          borderRadius: "var(--wl-radius-full)",
                          transition: `width var(--wl-duration-slow) var(--wl-ease-spring)`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "var(--wl-space-2)" }}>
                    {route.status === "DRAFT" && <Button variant="secondary" size="sm">Optimize</Button>}
                    {route.status === "OPTIMIZED" && <Button variant="primary" size="sm">Assign</Button>}
                    <Button variant="ghost" size="sm">View</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
