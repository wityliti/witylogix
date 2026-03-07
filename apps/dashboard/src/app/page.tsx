"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatRelativeTime, statusColor } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   DASHBOARD OVERVIEW — Command center for delivery ops
   ═══════════════════════════════════════════════════════════ */

// Mock data — in production these come from the API loader
const STATS = [
  { label: "Active Orders", value: "247", change: { value: 12.3, label: "vs last week" }, accent: "var(--wl-primary-500)" },
  { label: "Deliveries Today", value: "89", change: { value: 8.1, label: "vs yesterday" }, accent: "var(--wl-success-400)" },
  { label: "Drivers Active", value: "34", change: { value: -2.0, label: "vs avg" }, accent: "var(--wl-info-400)" },
  { label: "Avg Delivery Time", value: "28m", change: { value: -5.4, label: "faster" }, accent: "var(--wl-warning-400)" },
  { label: "Revenue Today", value: "$12,480", change: { value: 18.7, label: "vs last Fri" }, accent: "var(--wl-success-500)" },
  { label: "Failed Deliveries", value: "3", change: { value: -40, label: "vs avg" }, accent: "var(--wl-danger-400)" },
];

const RECENT_ORDERS = [
  { id: "ORD-2847", customer: "Emma Watson", status: "OUT_FOR_DELIVERY", driver: "Carlos M.", eta: "12 min", amount: 67.50 },
  { id: "ORD-2846", customer: "James Chen", status: "ASSIGNED", driver: "Sofia L.", eta: "35 min", amount: 124.00 },
  { id: "ORD-2845", customer: "Maria Garcia", status: "DELIVERED", driver: "Ahmed K.", eta: "—", amount: 89.99 },
  { id: "ORD-2844", customer: "Robert Kim", status: "PENDING", driver: "Unassigned", eta: "—", amount: 45.20 },
  { id: "ORD-2843", customer: "Sarah Miller", status: "PICKED_UP", driver: "Carlos M.", eta: "22 min", amount: 156.80 },
  { id: "ORD-2842", customer: "David Brown", status: "DELIVERED", driver: "Lisa T.", eta: "—", amount: 92.30 },
  { id: "ORD-2841", customer: "Ana Lopez", status: "FAILED", driver: "Ahmed K.", eta: "—", amount: 73.10 },
];

const ACTIVE_DRIVERS = [
  { name: "Carlos M.", status: "ON_ROUTE", orders: 4, completed: 7, vehicle: "Van" },
  { name: "Sofia L.", status: "ON_ROUTE", orders: 3, completed: 5, vehicle: "Car" },
  { name: "Ahmed K.", status: "AVAILABLE", orders: 0, completed: 9, vehicle: "Motorcycle" },
  { name: "Lisa T.", status: "ON_BREAK", orders: 0, completed: 6, vehicle: "Car" },
  { name: "Marcus J.", status: "ON_ROUTE", orders: 5, completed: 3, vehicle: "Van" },
];

const DELIVERY_TIMELINE = [
  { hour: "6am", count: 2 },
  { hour: "7am", count: 5 },
  { hour: "8am", count: 12 },
  { hour: "9am", count: 18 },
  { hour: "10am", count: 15 },
  { hour: "11am", count: 22 },
  { hour: "12pm", count: 28 },
  { hour: "1pm", count: 24 },
  { hour: "2pm", count: 19 },
  { hour: "3pm", count: 16 },
  { hour: "4pm", count: 21 },
  { hour: "5pm", count: 14 },
];

const ZONE_PERFORMANCE = [
  { zone: "Downtown Core", orders: 45, avgTime: "22m", revenue: 4230, trend: 8 },
  { zone: "Midtown East", orders: 38, avgTime: "26m", revenue: 3560, trend: 12 },
  { zone: "West Side", orders: 29, avgTime: "31m", revenue: 2710, trend: -3 },
  { zone: "South District", orders: 22, avgTime: "28m", revenue: 1890, trend: 5 },
  { zone: "Harbor Area", orders: 14, avgTime: "38m", revenue: 1240, trend: -8 },
];

const statusVariant = (s: string) => {
  const map: Record<string, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    DELIVERED: "success",
    OUT_FOR_DELIVERY: "primary",
    PICKED_UP: "primary",
    ASSIGNED: "info",
    PENDING: "warning",
    FAILED: "danger",
    ON_ROUTE: "primary",
    AVAILABLE: "success",
    ON_BREAK: "warning",
    OFFLINE: "default",
  };
  return map[s] ?? "default";
};

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month">("today");
  const maxCount = Math.max(...DELIVERY_TIMELINE.map((d) => d.count));

  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Friday, March 6, 2026"
        actions={
          <div style={{ display: "flex", gap: "var(--wl-space-1)", background: "var(--wl-bg-overlay)", borderRadius: "var(--wl-radius-md)", padding: 2 }}>
            {(["today", "week", "month"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                style={{
                  padding: "var(--wl-space-1) var(--wl-space-3)",
                  borderRadius: "var(--wl-radius-sm)",
                  border: "none",
                  fontSize: "var(--wl-text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--wl-font-sans)",
                  textTransform: "capitalize",
                  background: timeRange === t ? "var(--wl-primary-500)" : "transparent",
                  color: timeRange === t ? "var(--wl-text-inverse)" : "var(--wl-text-tertiary)",
                  transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />

      <div style={{ padding: "var(--wl-space-6)" }}>
        {/* ═══ KPI Stats Grid ═══ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-6)",
          }}
        >
          {STATS.map((stat, i) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              change={stat.change}
              accentColor={stat.accent}
              index={i}
            />
          ))}
        </div>

        {/* ═══ Main Content Grid ═══ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 380px",
            gap: "var(--wl-space-5)",
          }}
        >
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-5)" }}>
            {/* Delivery Volume Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Delivery Volume</CardTitle>
                <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                  Today&apos;s hourly distribution
                </span>
              </CardHeader>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 6,
                  height: 140,
                  paddingTop: "var(--wl-space-2)",
                }}
              >
                {DELIVERY_TIMELINE.map((d, i) => {
                  const height = (d.count / maxCount) * 100;
                  const isCurrent = i === 6; // 12pm highlight
                  return (
                    <div
                      key={d.hour}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: "var(--wl-font-mono)",
                          color: isCurrent ? "var(--wl-primary-400)" : "var(--wl-text-tertiary)",
                          fontWeight: isCurrent ? 600 : 400,
                        }}
                      >
                        {d.count}
                      </span>
                      <div
                        className="wl-animate-in"
                        style={{
                          width: "100%",
                          height: `${height}%`,
                          minHeight: 4,
                          borderRadius: "var(--wl-radius-sm) var(--wl-radius-sm) 0 0",
                          background: isCurrent
                            ? "linear-gradient(180deg, var(--wl-primary-400), var(--wl-primary-600))"
                            : "linear-gradient(180deg, var(--wl-neutral-600), var(--wl-neutral-800))",
                          boxShadow: isCurrent ? "var(--wl-shadow-glow)" : "none",
                          animationDelay: `${i * 50}ms`,
                          transition: `height var(--wl-duration-slow) var(--wl-ease-spring)`,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 9,
                          color: "var(--wl-text-tertiary)",
                          fontFamily: "var(--wl-font-mono)",
                        }}
                      >
                        {d.hour}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Recent Orders Table */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <Button variant="ghost" size="sm">
                  View all →
                </Button>
              </CardHeader>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "var(--wl-text-sm)",
                  }}
                >
                  <thead>
                    <tr>
                      {["Order", "Customer", "Status", "Driver", "ETA", "Amount"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "var(--wl-space-2) var(--wl-space-3)",
                            fontSize: "var(--wl-text-xs)",
                            fontWeight: 600,
                            color: "var(--wl-text-tertiary)",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            borderBottom: "1px solid var(--wl-border-subtle)",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_ORDERS.map((order) => (
                      <tr
                        key={order.id}
                        style={{
                          borderBottom: "1px solid var(--wl-border-subtle)",
                        }}
                      >
                        <td
                          style={{
                            padding: "var(--wl-space-3)",
                            fontFamily: "var(--wl-font-mono)",
                            fontWeight: 600,
                            color: "var(--wl-primary-400)",
                            fontSize: "var(--wl-text-xs)",
                          }}
                        >
                          {order.id}
                        </td>
                        <td
                          style={{
                            padding: "var(--wl-space-3)",
                            color: "var(--wl-text-primary)",
                          }}
                        >
                          {order.customer}
                        </td>
                        <td style={{ padding: "var(--wl-space-3)" }}>
                          <Badge variant={statusVariant(order.status)} dot>
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td
                          style={{
                            padding: "var(--wl-space-3)",
                            color: "var(--wl-text-secondary)",
                          }}
                        >
                          {order.driver}
                        </td>
                        <td
                          style={{
                            padding: "var(--wl-space-3)",
                            fontFamily: "var(--wl-font-mono)",
                            fontSize: "var(--wl-text-xs)",
                            color: order.eta === "—" ? "var(--wl-text-tertiary)" : "var(--wl-text-secondary)",
                          }}
                        >
                          {order.eta}
                        </td>
                        <td
                          style={{
                            padding: "var(--wl-space-3)",
                            fontFamily: "var(--wl-font-mono)",
                            fontWeight: 600,
                            color: "var(--wl-text-primary)",
                          }}
                        >
                          {formatCurrency(order.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Zone Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Zone Performance</CardTitle>
                <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                  Delivery metrics by zone
                </span>
              </CardHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-3)" }}>
                {ZONE_PERFORMANCE.map((zone, i) => (
                  <div
                    key={zone.zone}
                    className="wl-animate-in"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--wl-space-4)",
                      padding: "var(--wl-space-3)",
                      borderRadius: "var(--wl-radius-md)",
                      background: "var(--wl-bg-surface)",
                      animationDelay: `${i * 60}ms`,
                    }}
                  >
                    {/* Zone rank */}
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "var(--wl-radius-sm)",
                        background: i === 0 ? "rgba(245, 166, 35, 0.12)" : "var(--wl-bg-overlay)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "var(--wl-text-xs)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: i === 0 ? "var(--wl-primary-400)" : "var(--wl-text-tertiary)",
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>

                    {/* Zone name + bar */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: "var(--wl-text-sm)",
                            fontWeight: 600,
                            color: "var(--wl-text-primary)",
                          }}
                        >
                          {zone.zone}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--wl-text-xs)",
                            fontFamily: "var(--wl-font-mono)",
                            color: zone.trend >= 0 ? "var(--wl-success-400)" : "var(--wl-danger-400)",
                          }}
                        >
                          {zone.trend >= 0 ? "+" : ""}
                          {zone.trend}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: 4,
                          background: "var(--wl-bg-overlay)",
                          borderRadius: "var(--wl-radius-full)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${(zone.orders / 45) * 100}%`,
                            height: "100%",
                            background: `linear-gradient(90deg, var(--wl-primary-500), var(--wl-primary-400))`,
                            borderRadius: "var(--wl-radius-full)",
                            transition: `width var(--wl-duration-slow) var(--wl-ease-spring)`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--wl-space-5)",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "var(--wl-text-xs)",
                            color: "var(--wl-text-tertiary)",
                          }}
                        >
                          Orders
                        </div>
                        <div
                          style={{
                            fontSize: "var(--wl-text-sm)",
                            fontWeight: 700,
                            fontFamily: "var(--wl-font-mono)",
                            color: "var(--wl-text-primary)",
                          }}
                        >
                          {zone.orders}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "var(--wl-text-xs)",
                            color: "var(--wl-text-tertiary)",
                          }}
                        >
                          Avg Time
                        </div>
                        <div
                          style={{
                            fontSize: "var(--wl-text-sm)",
                            fontWeight: 600,
                            fontFamily: "var(--wl-font-mono)",
                            color: "var(--wl-text-secondary)",
                          }}
                        >
                          {zone.avgTime}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "var(--wl-text-xs)",
                            color: "var(--wl-text-tertiary)",
                          }}
                        >
                          Revenue
                        </div>
                        <div
                          style={{
                            fontSize: "var(--wl-text-sm)",
                            fontWeight: 600,
                            fontFamily: "var(--wl-font-mono)",
                            color: "var(--wl-success-400)",
                          }}
                        >
                          {formatCurrency(zone.revenue)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Column — Sidebar Panels */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-5)" }}>
            {/* Active Drivers Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Active Drivers</CardTitle>
                <Badge variant="success" dot>
                  {ACTIVE_DRIVERS.filter((d) => d.status !== "OFFLINE").length} online
                </Badge>
              </CardHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-3)" }}>
                {ACTIVE_DRIVERS.map((driver, i) => (
                  <div
                    key={driver.name}
                    className="wl-animate-in"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--wl-space-3)",
                      padding: "var(--wl-space-2) 0",
                      borderBottom:
                        i < ACTIVE_DRIVERS.length - 1
                          ? "1px solid var(--wl-border-subtle)"
                          : "none",
                      animationDelay: `${i * 60}ms`,
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--wl-radius-md)",
                        background: "var(--wl-bg-overlay)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "var(--wl-text-xs)",
                        fontWeight: 700,
                        color: "var(--wl-text-secondary)",
                        position: "relative",
                        flexShrink: 0,
                      }}
                    >
                      {driver.name.split(" ").map((w) => w[0]).join("")}
                      <span
                        style={{
                          position: "absolute",
                          bottom: -1,
                          right: -1,
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: statusColor(driver.status),
                          border: "2px solid var(--wl-bg-elevated)",
                        }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "var(--wl-text-sm)",
                          fontWeight: 600,
                          color: "var(--wl-text-primary)",
                        }}
                      >
                        {driver.name}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-xs)",
                          color: "var(--wl-text-tertiary)",
                        }}
                      >
                        {driver.vehicle} · {driver.completed} done
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <Badge variant={statusVariant(driver.status)}>
                        {driver.status === "ON_ROUTE"
                          ? `${driver.orders} active`
                          : driver.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick Actions Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-2)" }}>
                {[
                  { label: "Create New Order", icon: "+" },
                  { label: "Optimize Routes", icon: "⟳" },
                  { label: "Assign Drivers", icon: "→" },
                  { label: "Send Notifications", icon: "✉" },
                  { label: "Export Report", icon: "↓" },
                ].map((action) => (
                  <button
                    key={action.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--wl-space-3)",
                      padding: "var(--wl-space-3) var(--wl-space-3)",
                      borderRadius: "var(--wl-radius-md)",
                      border: "1px solid var(--wl-border-subtle)",
                      background: "var(--wl-bg-surface)",
                      color: "var(--wl-text-secondary)",
                      fontSize: "var(--wl-text-sm)",
                      cursor: "pointer",
                      fontFamily: "var(--wl-font-sans)",
                      transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
                      width: "100%",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "var(--wl-radius-sm)",
                        background: "var(--wl-bg-overlay)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {action.icon}
                    </span>
                    {action.label}
                  </button>
                ))}
              </div>
            </Card>

            {/* System Health */}
            <Card
              style={{
                background: "linear-gradient(135deg, var(--wl-bg-elevated), var(--wl-bg-overlay))",
              }}
            >
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <Badge variant="success" dot>
                  Operational
                </Badge>
              </CardHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-3)" }}>
                {[
                  { name: "API", status: "Healthy", latency: "12ms" },
                  { name: "Database", status: "Healthy", latency: "3ms" },
                  { name: "Redis", status: "Healthy", latency: "1ms" },
                  { name: "Routing Provider", status: "Healthy", latency: "89ms" },
                  { name: "Notifications", status: "Degraded", latency: "340ms" },
                ].map((service) => (
                  <div
                    key={service.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--wl-space-2)",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: statusColor(service.status === "Healthy" ? "HEALTHY" : "DEGRADED"),
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "var(--wl-text-sm)",
                          color: "var(--wl-text-secondary)",
                        }}
                      >
                        {service.name}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "var(--wl-text-xs)",
                        fontFamily: "var(--wl-font-mono)",
                        color: "var(--wl-text-tertiary)",
                      }}
                    >
                      {service.latency}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
