"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";
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
          <div className="flex gap-1 bg-wl-bg-overlay rounded-md p-0.5">
            {(["today", "week", "month"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={cn("px-3 py-1 rounded text-xs font-semibold cursor-pointer font-sans capitalize transition-all", {
                  "bg-wl-primary-500 text-wl-text-inverse": timeRange === t,
                  "bg-transparent text-wl-text-tertiary": timeRange !== t,
                })}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />

      <div className="p-6">
        {/* ═══ KPI Stats Grid ═══ */}
        <div
          className="grid gap-4 mb-6"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
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
          className="grid gap-5"
          style={{ gridTemplateColumns: "1fr 380px" }}
        >
          {/* Left Column */}
          <div className="flex flex-col gap-5">
            {/* Delivery Volume Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Delivery Volume</CardTitle>
                <span className="text-xs text-wl-text-tertiary">
                  Today&apos;s hourly distribution
                </span>
              </CardHeader>
              <div className="flex items-end gap-1.5 h-35 pt-2">
                {DELIVERY_TIMELINE.map((d, i) => {
                  const height = (d.count / maxCount) * 100;
                  const isCurrent = i === 6; // 12pm highlight
                  return (
                    <div
                      key={d.hour}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <span
                        className={cn("text-2xs font-mono", {
                          "text-wl-primary-400 font-semibold": isCurrent,
                          "text-wl-text-tertiary font-normal": !isCurrent,
                        })}
                      >
                        {d.count}
                      </span>
                      <div
                        className={cn("wl-animate-in w-full min-h-1 rounded-t", {
                          "bg-gradient-to-b from-wl-primary-400 to-wl-primary-600": isCurrent,
                          "bg-gradient-to-b from-wl-neutral-600 to-wl-neutral-800": !isCurrent,
                        })}
                        style={{
                          height: `${height}%`,
                          boxShadow: isCurrent ? "var(--wl-shadow-glow)" : "none",
                          animationDelay: `${i * 50}ms`,
                          transition: `height var(--wl-duration-slow) var(--wl-ease-spring)`,
                        }}
                      />
                      <span
                        className="text-2xs text-wl-text-tertiary font-mono"
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
              <div className="overflow-x-auto">
                <table
                  className="w-full border-collapse text-sm"
                >
                  <thead>
                    <tr>
                      {["Order", "Customer", "Status", "Driver", "ETA", "Amount"].map((h) => (
                        <th
                          key={h}
                          className="text-left p-2 p-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide border-b border-wl-border-subtle"
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
                        className="border-b border-wl-border-subtle"
                      >
                        <td
                          className="p-3 font-mono font-semibold text-wl-primary-400 text-xs"
                        >
                          {order.id}
                        </td>
                        <td
                          className="p-3 text-wl-text-primary"
                        >
                          {order.customer}
                        </td>
                        <td className="p-3">
                          <Badge variant={statusVariant(order.status)} dot>
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td
                          className="p-3 text-wl-text-secondary"
                        >
                          {order.driver}
                        </td>
                        <td
                          className={cn("p-3 font-mono text-xs", {
                            "text-wl-text-tertiary": order.eta === "—",
                            "text-wl-text-secondary": order.eta !== "—",
                          })}
                        >
                          {order.eta}
                        </td>
                        <td
                          className="p-3 font-mono font-semibold text-wl-text-primary"
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
                <span className="text-xs text-wl-text-tertiary">
                  Delivery metrics by zone
                </span>
              </CardHeader>
              <div className="flex flex-col gap-3">
                {ZONE_PERFORMANCE.map((zone, i) => (
                  <div
                    key={zone.zone}
                    className="wl-animate-in flex items-center gap-4 p-3 rounded-md bg-wl-bg-surface"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {/* Zone rank */}
                    <span
                      className={cn("w-7 h-7 rounded text-xs font-bold font-mono flex-shrink-0 flex items-center justify-center", {
                        "bg-orange-100 text-wl-primary-400": i === 0,
                        "bg-wl-bg-overlay text-wl-text-tertiary": i !== 0,
                      })}
                    >
                      {i + 1}
                    </span>

                    {/* Zone name + bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-semibold text-wl-text-primary">
                          {zone.zone}
                        </span>
                        <span
                          className={cn("text-xs font-mono", {
                            "text-wl-success-400": zone.trend >= 0,
                            "text-wl-danger-400": zone.trend < 0,
                          })}
                        >
                          {zone.trend >= 0 ? "+" : ""}
                          {zone.trend}%
                        </span>
                      </div>
                      <div className="h-1 bg-wl-bg-overlay rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-primary-400 rounded-full"
                          style={{
                            width: `${(zone.orders / 45) * 100}%`,
                            transition: `width var(--wl-duration-slow) var(--wl-ease-spring)`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-5 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-xs text-wl-text-tertiary">
                          Orders
                        </div>
                        <div className="text-sm font-bold font-mono text-wl-text-primary">
                          {zone.orders}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-wl-text-tertiary">
                          Avg Time
                        </div>
                        <div className="text-sm font-semibold font-mono text-wl-text-secondary">
                          {zone.avgTime}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-wl-text-tertiary">
                          Revenue
                        </div>
                        <div className="text-sm font-semibold font-mono text-wl-success-400">
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
          <div className="flex flex-col gap-5">
            {/* Active Drivers Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Active Drivers</CardTitle>
                <Badge variant="success" dot>
                  {ACTIVE_DRIVERS.filter((d) => d.status !== "OFFLINE").length} online
                </Badge>
              </CardHeader>
              <div className="flex flex-col gap-3">
                {ACTIVE_DRIVERS.map((driver, i) => (
                  <div
                    key={driver.name}
                    className={cn("wl-animate-in flex items-center gap-3 py-2", {
                      "border-b border-wl-border-subtle": i < ACTIVE_DRIVERS.length - 1,
                    })}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-md bg-wl-bg-overlay flex items-center justify-center text-xs font-bold text-wl-text-secondary relative flex-shrink-0">
                      {driver.name.split(" ").map((w) => w[0]).join("")}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-wl-bg-elevated"
                        style={{ background: statusColor(driver.status) }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-wl-text-primary">
                        {driver.name}
                      </div>
                      <div className="text-xs text-wl-text-tertiary">
                        {driver.vehicle} · {driver.completed} done
                      </div>
                    </div>

                    <div className="text-right">
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
              <div className="flex flex-col gap-2">
                {[
                  { label: "Create New Order", icon: "+" },
                  { label: "Optimize Routes", icon: "⟳" },
                  { label: "Assign Drivers", icon: "→" },
                  { label: "Send Notifications", icon: "✉" },
                  { label: "Export Report", icon: "↓" },
                ].map((action) => (
                  <button
                    key={action.label}
                    className="flex items-center gap-3 p-3 rounded-md border border-wl-border-subtle bg-wl-bg-surface text-wl-text-secondary text-sm cursor-pointer font-sans transition-all w-full text-left"
                  >
                    <span className="w-7 h-7 rounded text-sm flex items-center justify-center bg-wl-bg-overlay flex-shrink-0">
                      {action.icon}
                    </span>
                    {action.label}
                  </button>
                ))}
              </div>
            </Card>

            {/* System Health */}
            <Card
              className="bg-gradient-to-br from-wl-bg-elevated to-wl-bg-overlay"
            >
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <Badge variant="success" dot>
                  Operational
                </Badge>
              </CardHeader>
              <div className="flex flex-col gap-3">
                {[
                  { name: "API", status: "Healthy", latency: "12ms" },
                  { name: "Database", status: "Healthy", latency: "3ms" },
                  { name: "Redis", status: "Healthy", latency: "1ms" },
                  { name: "Routing Provider", status: "Healthy", latency: "89ms" },
                  { name: "Notifications", status: "Degraded", latency: "340ms" },
                ].map((service) => (
                  <div key={service.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: statusColor(service.status === "Healthy" ? "HEALTHY" : "DEGRADED") }}
                      />
                      <span className="text-sm text-wl-text-secondary">
                        {service.name}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-wl-text-tertiary">
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
