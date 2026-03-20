'use client';

import { useState, useMemo } from 'react';
import { useApiList } from '@/hooks/use-api';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════
   LAST-MILE DELIVERY INTEGRATION PAGE — Delivery aggregator
   ═══════════════════════════════════════════════════════════ */

interface DeliveryProvider {
  id: string;
  name: string;
  logo: string;
  status: "connected" | "disconnected";
  commissionsPercentage: number;
  deliveriesToday: number;
  revenueToday: number;
  averageDeliveryTime: number;
  onTimeDeliveryRate: number;
}

interface Delivery {
  id: string;
  orderId: string;
  provider: string;
  customer: string;
  destination: string;
  driver: string;
  status: "pending" | "assigned" | "in_transit" | "delivered" | "cancelled";
  fee: number;
  commission: number;
  estimatedTime: string;
  actualTime?: string;
  distance: number;
  timestamp: string;
}

interface Driver {
  id: string;
  name: string;
  provider: string;
  status: "online" | "on_delivery" | "offline";
  activeDeliveries: number;
  completedToday: number;
  rating: number;
  location: string;
}

interface PerformanceMetric {
  provider: string;
  onTimePercent: number;
  avgDeliveryTime: number;
  customerRating: number;
  costPerDelivery: number;
}

const DELIVERY_PROVIDERS: DeliveryProvider[] = [
  {
    id: "doordash",
    name: "DoorDash Drive",
    logo: "DD",
    status: "connected",
    commissionsPercentage: 15,
    deliveriesToday: 342,
    revenueToday: 2890.50,
    averageDeliveryTime: 28,
    onTimeDeliveryRate: 94.2,
  },
  {
    id: "ubereats",
    name: "Uber Eats",
    logo: "UE",
    status: "connected",
    commissionsPercentage: 18,
    deliveriesToday: 267,
    revenueToday: 1840.75,
    averageDeliveryTime: 32,
    onTimeDeliveryRate: 91.8,
  },
  {
    id: "grubhub",
    name: "Grubhub",
    logo: "GH",
    status: "connected",
    commissionsPercentage: 16,
    deliveriesToday: 189,
    revenueToday: 1320.40,
    averageDeliveryTime: 35,
    onTimeDeliveryRate: 88.5,
  },
];

const DELIVERIES: Delivery[] = [
  {
    id: "del-001",
    orderId: "#ORDER-5421",
    provider: "DoorDash Drive",
    customer: "Alice Johnson",
    destination: "123 Park Ave, Apt 4B",
    driver: "Marcus T.",
    status: "in_transit",
    fee: 8.50,
    commission: 1.28,
    estimatedTime: "15 mins",
    distance: 3.2,
    timestamp: "2026-03-12T14:22:15Z",
  },
  {
    id: "del-002",
    orderId: "#ORDER-5422",
    provider: "Uber Eats",
    customer: "Bob Smith",
    destination: "456 5th Ave",
    driver: "Jessica R.",
    status: "assigned",
    fee: 7.25,
    commission: 1.31,
    estimatedTime: "22 mins",
    distance: 4.1,
    timestamp: "2026-03-12T14:18:33Z",
  },
  {
    id: "del-003",
    orderId: "#ORDER-5423",
    provider: "Grubhub",
    customer: "Carol Davis",
    destination: "789 Broadway",
    driver: "David K.",
    status: "delivered",
    fee: 6.75,
    commission: 1.08,
    estimatedTime: "28 mins",
    actualTime: "26 mins",
    distance: 2.8,
    timestamp: "2026-03-12T14:15:22Z",
  },
  {
    id: "del-004",
    orderId: "#ORDER-5424",
    provider: "DoorDash Drive",
    customer: "Emma Wilson",
    destination: "321 Madison Ave",
    driver: "Robert P.",
    status: "delivered",
    fee: 9.00,
    commission: 1.35,
    estimatedTime: "20 mins",
    actualTime: "19 mins",
    distance: 3.8,
    timestamp: "2026-03-12T14:10:45Z",
  },
  {
    id: "del-005",
    orderId: "#ORDER-5425",
    provider: "Uber Eats",
    customer: "Frank Miller",
    destination: "654 West St",
    driver: "Sandra L.",
    status: "delivered",
    fee: 6.50,
    commission: 1.17,
    estimatedTime: "30 mins",
    actualTime: "32 mins",
    distance: 4.5,
    timestamp: "2026-03-12T14:05:08Z",
  },
  {
    id: "del-006",
    orderId: "#ORDER-5426",
    provider: "Grubhub",
    customer: "Grace Lee",
    destination: "987 Columbus Ave",
    driver: "Thomas H.",
    status: "pending",
    fee: 7.00,
    commission: 1.12,
    estimatedTime: "35 mins",
    distance: 5.2,
    timestamp: "2026-03-12T14:00:19Z",
  },
];

const DRIVERS: Driver[] = [
  {
    id: "drv-001",
    name: "Marcus Thompson",
    provider: "DoorDash",
    status: "on_delivery",
    activeDeliveries: 2,
    completedToday: 8,
    rating: 4.85,
    location: "Midtown",
  },
  {
    id: "drv-002",
    name: "Jessica Rodriguez",
    provider: "Uber Eats",
    status: "on_delivery",
    activeDeliveries: 1,
    completedToday: 6,
    rating: 4.92,
    location: "Downtown",
  },
  {
    id: "drv-003",
    name: "David Kim",
    provider: "Grubhub",
    status: "online",
    activeDeliveries: 0,
    completedToday: 7,
    rating: 4.78,
    location: "Upper East",
  },
  {
    id: "drv-004",
    name: "Robert Patterson",
    provider: "DoorDash",
    status: "offline",
    activeDeliveries: 0,
    completedToday: 5,
    rating: 4.65,
    location: "—",
  },
  {
    id: "drv-005",
    name: "Sandra Lopez",
    provider: "Uber Eats",
    status: "on_delivery",
    activeDeliveries: 1,
    completedToday: 9,
    rating: 4.88,
    location: "Financial District",
  },
  {
    id: "drv-006",
    name: "Thomas Harris",
    provider: "Grubhub",
    status: "online",
    activeDeliveries: 0,
    completedToday: 4,
    rating: 4.71,
    location: "Brooklyn",
  },
];

const PERFORMANCE_METRICS: PerformanceMetric[] = [
  {
    provider: "DoorDash Drive",
    onTimePercent: 94.2,
    avgDeliveryTime: 28,
    customerRating: 4.82,
    costPerDelivery: 8.45,
  },
  {
    provider: "Uber Eats",
    onTimePercent: 91.8,
    avgDeliveryTime: 32,
    customerRating: 4.75,
    costPerDelivery: 6.88,
  },
  {
    provider: "Grubhub",
    onTimePercent: 88.5,
    avgDeliveryTime: 35,
    customerRating: 4.68,
    costPerDelivery: 7.12,
  },
];

const getStatusColor = (status: string): "success" | "warning" | "default" | "info" | "danger" => {
  switch (status) {
    case "delivered":
    case "online":
      return "success";
    case "in_transit":
    case "on_delivery":
      return "warning";
    case "assigned":
      return "info";
    case "cancelled":
    case "offline":
      return "danger";
    default:
      return "default";
  }
};

const getStatusIcon = (status: string): string => {
  switch (status) {
    case "delivered":
    case "online":
      return "●";
    case "in_transit":
    case "on_delivery":
      return "⟿";
    case "assigned":
      return "◐";
    case "cancelled":
      return "✕";
    case "offline":
      return "○";
    default:
      return "○";
  }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

const formatDateTime = (isoStr: string): string => {
  if (!isoStr) return "—";
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function LastMileIntegrationPage() {
  const [selectedProvider, setSelectedProvider] = useState<string>("doordash");
  const [deliveryFilterStatus, setDeliveryFilterStatus] = useState<"all" | "pending" | "assigned" | "in_transit" | "delivered">("all");
  const [driverFilterStatus, setDriverFilterStatus] = useState<"all" | "online" | "on_delivery" | "offline">("all");

  // Calculate stats
  const connectedCount = DELIVERY_PROVIDERS.length;
  const totalDeliveriesToday = DELIVERY_PROVIDERS.reduce((sum, p) => sum + p.deliveriesToday, 0);
  const totalRevenuToday = DELIVERY_PROVIDERS.reduce((sum, p) => sum + p.revenueToday, 0);
  const totalCommissions = DELIVERIES.reduce((sum, d) => sum + d.commission, 0);
  const avgOnTimeRate =
    PERFORMANCE_METRICS.reduce((sum, m) => sum + m.onTimePercent, 0) / PERFORMANCE_METRICS.length;

  const filteredDeliveries = useMemo(
    () =>
      DELIVERIES.filter((delivery) => {
        if (deliveryFilterStatus !== "all" && delivery.status !== deliveryFilterStatus)
          return false;
        return true;
      }),
    [deliveryFilterStatus]
  );

  const filteredDrivers = useMemo(
    () =>
      DRIVERS.filter((driver) => {
        if (driverFilterStatus !== "all" && driver.status !== driverFilterStatus) return false;
        return true;
      }),
    [driverFilterStatus]
  );

  const selectedProviderData = DELIVERY_PROVIDERS.find((p) => p.id === selectedProvider);

  return (
    <>
      <Header
        title="Last-Mile Delivery"
        subtitle={`${connectedCount} platforms · ${totalDeliveriesToday} deliveries today`}
        actions={
          <Button variant="primary" size="md">
            + New Integration
          </Button>
        }
      />

      <div className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Deliveries Today"
            value={totalDeliveriesToday}
            change={{ value: 22.5, label: "vs yesterday" }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Total Revenue"
            value={formatCurrency(totalRevenuToday)}
            change={{ value: 18.3, label: "vs yesterday" }}
            accentColor="var(--wl-success-400)"
            index={1}
          />
          <StatCard
            label="On-Time Rate"
            value={`${avgOnTimeRate.toFixed(1)}%`}
            change={{ value: 2.1, label: "vs avg" }}
            accentColor="var(--wl-warning-400)"
            index={2}
          />
          <StatCard
            label="Total Commissions"
            value={formatCurrency(totalCommissions)}
            change={{ value: -1.5, label: "vs target" }}
            accentColor="var(--wl-info-400)"
            index={3}
          />
        </div>

        {/* Delivery Platform Cards */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-wl-text-primary mb-4 uppercase tracking-wider">
            Connected Delivery Platforms
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {DELIVERY_PROVIDERS.map((provider) => (
              <Card
                key={provider.id}
                hover
                onClick={() => setSelectedProvider(provider.id)}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedProvider === provider.id && "ring-2 ring-wl-primary-500"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-wl-primary-500/20 flex items-center justify-center text-xs font-bold text-wl-primary-400">
                      {provider.logo}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-wl-text-primary">
                        {provider.name}
                      </h3>
                      <Badge variant="success">● {provider.status}</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-wl-text-secondary mb-3">
                  <div className="flex justify-between">
                    <span>Deliveries Today:</span>
                    <span className="text-wl-text-primary font-semibold">
                      {provider.deliveriesToday}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Revenue:</span>
                    <span className="text-wl-text-primary font-semibold">
                      {formatCurrency(provider.revenueToday)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Commission:</span>
                    <span className="text-wl-text-primary font-semibold">
                      {provider.commissionsPercentage}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>On-Time Rate:</span>
                    <span className="text-wl-success-400 font-semibold">
                      {provider.onTimeDeliveryRate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Delivery Time:</span>
                    <span className="text-wl-text-primary font-semibold">
                      {provider.averageDeliveryTime}m
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1">
                    Settings
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1">
                    View Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Performance Metrics */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Delivery Performance Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-subtle">
                    <th className="p-3 text-left font-semibold text-wl-text-secondary">
                      Provider
                    </th>
                    <th className="p-3 text-center font-semibold text-wl-text-secondary">
                      On-Time %
                    </th>
                    <th className="p-3 text-center font-semibold text-wl-text-secondary">
                      Avg Time (mins)
                    </th>
                    <th className="p-3 text-center font-semibold text-wl-text-secondary">
                      Rating
                    </th>
                    <th className="p-3 text-right font-semibold text-wl-text-secondary">
                      Cost per Delivery
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PERFORMANCE_METRICS.map((metric, idx) => (
                    <tr
                      key={idx}
                      className={cn(
                        "border-b border-wl-border-subtle",
                        idx % 2 === 0 ? "bg-transparent" : "bg-wl-bg-overlay/30"
                      )}
                    >
                      <td className="p-3 text-wl-text-primary font-semibold">
                        {metric.provider}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="success">{metric.onTimePercent}%</Badge>
                      </td>
                      <td className="p-3 text-center text-wl-text-primary font-semibold">
                        {metric.avgDeliveryTime}
                      </td>
                      <td className="p-3 text-center text-wl-text-primary font-semibold">
                        {metric.customerRating} ⭐
                      </td>
                      <td className="p-3 text-right text-wl-text-primary font-semibold">
                        {formatCurrency(metric.costPerDelivery)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Unified Order & Driver View */}
        <div className="grid grid-cols-[1fr_1fr] gap-6">
          {/* Delivery Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Active Deliveries</CardTitle>
              <div className="flex gap-2 ml-auto">
                {(["all", "pending", "assigned", "in_transit", "delivered"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setDeliveryFilterStatus(status)}
                    className={cn(
                      "px-2 py-1 text-xs font-semibold rounded border capitalize transition-all",
                      deliveryFilterStatus === status
                        ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                        : "bg-transparent text-wl-text-secondary border-wl-border-subtle"
                    )}
                  >
                    {status === "all" ? "All" : status === "in_transit" ? "Transit" : status}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className={cn(
                      "p-3 rounded-md border",
                      delivery.status === "delivered"
                        ? "border-wl-success-400/20 bg-wl-success-bg/20"
                        : delivery.status === "in_transit"
                        ? "border-wl-warning-400/20 bg-wl-warning-bg/20"
                        : "border-wl-info-400/20 bg-wl-info-bg/20"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-wl-text-primary">
                          {delivery.orderId}
                        </p>
                        <p className="text-xs text-wl-text-tertiary">
                          {delivery.customer} → {delivery.destination}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={getStatusColor(delivery.status)} className="text-xs">
                          {getStatusIcon(delivery.status)} {delivery.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                      <div>
                        <span className="text-wl-text-tertiary">Driver:</span>
                        <p className="font-semibold text-wl-text-primary">{delivery.driver}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-wl-text-tertiary">Distance:</span>
                        <p className="font-semibold text-wl-text-primary">
                          {delivery.distance} km
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-wl-border-subtle text-xs">
                      <span className="text-wl-text-secondary">
                        {delivery.actualTime ? `${delivery.actualTime}` : delivery.estimatedTime}
                      </span>
                      <span className="text-wl-text-tertiary">
                        Fee: {formatCurrency(delivery.fee)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Driver Status */}
          <Card>
            <CardHeader>
              <CardTitle>Driver Status</CardTitle>
              <div className="flex gap-2 ml-auto">
                {(["all", "online", "on_delivery", "offline"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setDriverFilterStatus(status)}
                    className={cn(
                      "px-2 py-1 text-xs font-semibold rounded border capitalize transition-all",
                      driverFilterStatus === status
                        ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                        : "bg-transparent text-wl-text-secondary border-wl-border-subtle"
                    )}
                  >
                    {status === "all"
                      ? "All"
                      : status === "on_delivery"
                      ? "In Delivery"
                      : status}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className={cn(
                      "p-3 rounded-md border",
                      driver.status === "online"
                        ? "border-wl-success-400/20 bg-wl-success-bg/20"
                        : driver.status === "on_delivery"
                        ? "border-wl-warning-400/20 bg-wl-warning-bg/20"
                        : "border-wl-neutral-600/20 bg-wl-bg-overlay/20"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-wl-text-primary">
                          {driver.name}
                        </p>
                        <p className="text-xs text-wl-text-tertiary">
                          {driver.provider} • {driver.location}
                        </p>
                      </div>
                      <Badge variant={getStatusColor(driver.status)}>
                        {getStatusIcon(driver.status)} {driver.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-wl-text-tertiary block mb-0.5">Active</span>
                        <p className="font-semibold text-wl-text-primary">
                          {driver.activeDeliveries}
                        </p>
                      </div>
                      <div>
                        <span className="text-wl-text-tertiary block mb-0.5">Completed</span>
                        <p className="font-semibold text-wl-text-primary">
                          {driver.completedToday}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-wl-text-tertiary block mb-0.5">Rating</span>
                        <p className="font-semibold text-wl-text-primary">
                          {driver.rating} ⭐
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
