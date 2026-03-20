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
   POS/RESTAURANT INTEGRATION PAGE — Multi-location menu & orders
   ═══════════════════════════════════════════════════════════ */

interface POSProvider {
  id: string;
  name: string;
  logo: string;
  status: "connected" | "disconnected" | "error";
  lastSync: string;
  locationsCount: number;
  terminalsCount: number;
  ordersToday: number;
  revenueToday: number;
}

interface Location {
  id: string;
  name: string;
  address: string;
  terminal: string;
  status: "online" | "offline" | "syncing";
  ordersToday: number;
  revenueToday: number;
  lastSyncTime: string;
}

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  status: "active" | "inactive" | "out_of_stock";
  lastOrders: number;
}

interface Order {
  id: string;
  orderId: string;
  location: string;
  customer: string;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  items: number;
  total: number;
  timestamp: string;
}

const POS_PROVIDERS: POSProvider[] = [
  {
    id: "toast",
    name: "Toast POS",
    logo: "TP",
    status: "connected",
    lastSync: "2026-03-12T14:35:00Z",
    locationsCount: 8,
    terminalsCount: 24,
    ordersToday: 487,
    revenueToday: 12450.75,
  },
  {
    id: "square",
    name: "Square for Restaurants",
    logo: "SQ",
    status: "connected",
    lastSync: "2026-03-12T14:28:00Z",
    locationsCount: 5,
    terminalsCount: 12,
    ordersToday: 312,
    revenueToday: 7890.50,
  },
];

const LOCATIONS: Location[] = [
  {
    id: "loc-001",
    name: "Downtown Flagship",
    address: "123 Main St, NY",
    terminal: "Terminal 1-4",
    status: "online",
    ordersToday: 156,
    revenueToday: 4250.00,
    lastSyncTime: "2026-03-12T14:35:22Z",
  },
  {
    id: "loc-002",
    name: "Midtown Hub",
    address: "456 Park Ave, NY",
    terminal: "Terminal 5-7",
    status: "online",
    ordersToday: 143,
    revenueToday: 3890.50,
    lastSyncTime: "2026-03-12T14:34:58Z",
  },
  {
    id: "loc-003",
    name: "Airport Express",
    address: "JFK Airport, NY",
    terminal: "Terminal 8-10",
    status: "online",
    ordersToday: 89,
    revenueToday: 2340.25,
    lastSyncTime: "2026-03-12T14:33:45Z",
  },
  {
    id: "loc-004",
    name: "Westside Café",
    address: "789 West End, NY",
    terminal: "Terminal 11-12",
    status: "syncing",
    ordersToday: 34,
    revenueToday: 890.00,
    lastSyncTime: "2026-03-12T14:30:12Z",
  },
  {
    id: "loc-005",
    name: "Brooklyn Branch",
    address: "321 Atlantic, NY",
    terminal: "Terminal 13",
    status: "offline",
    ordersToday: 0,
    revenueToday: 0,
    lastSyncTime: "2026-03-12T13:15:33Z",
  },
];

const MENU_ITEMS: MenuItem[] = [
  {
    id: "mi-001",
    name: "Classic Burger",
    category: "Main Courses",
    price: 14.99,
    quantity: 245,
    status: "active",
    lastOrders: 67,
  },
  {
    id: "mi-002",
    name: "Caesar Salad",
    category: "Salads",
    price: 12.99,
    quantity: 128,
    status: "active",
    lastOrders: 34,
  },
  {
    id: "mi-003",
    name: "Grilled Chicken",
    category: "Main Courses",
    price: 16.99,
    quantity: 0,
    status: "out_of_stock",
    lastOrders: 45,
  },
  {
    id: "mi-004",
    name: "French Fries",
    category: "Sides",
    price: 4.99,
    quantity: 450,
    status: "active",
    lastOrders: 92,
  },
  {
    id: "mi-005",
    name: "Chocolate Cake",
    category: "Desserts",
    price: 7.99,
    quantity: 35,
    status: "active",
    lastOrders: 28,
  },
  {
    id: "mi-006",
    name: "Iced Tea",
    category: "Beverages",
    price: 3.49,
    quantity: 200,
    status: "active",
    lastOrders: 156,
  },
];

const ORDERS: Order[] = [
  {
    id: "ord-001",
    orderId: "#WL-10245",
    location: "Downtown Flagship",
    customer: "John Smith",
    status: "completed",
    items: 4,
    total: 48.75,
    timestamp: "2026-03-12T14:32:15Z",
  },
  {
    id: "ord-002",
    orderId: "#WL-10246",
    location: "Midtown Hub",
    customer: "Emma Johnson",
    status: "ready",
    items: 3,
    total: 35.50,
    timestamp: "2026-03-12T14:28:33Z",
  },
  {
    id: "ord-003",
    orderId: "#WL-10247",
    location: "Downtown Flagship",
    customer: "Michael Chen",
    status: "preparing",
    items: 5,
    total: 62.25,
    timestamp: "2026-03-12T14:25:22Z",
  },
  {
    id: "ord-004",
    orderId: "#WL-10248",
    location: "Airport Express",
    customer: "Sarah Lee",
    status: "pending",
    items: 2,
    total: 22.00,
    timestamp: "2026-03-12T14:20:45Z",
  },
  {
    id: "ord-005",
    orderId: "#WL-10249",
    location: "Westside Café",
    customer: "David Martinez",
    status: "completed",
    items: 6,
    total: 78.90,
    timestamp: "2026-03-12T14:15:08Z",
  },
  {
    id: "ord-006",
    orderId: "#WL-10250",
    location: "Midtown Hub",
    customer: "Lisa Wong",
    status: "completed",
    items: 3,
    total: 41.25,
    timestamp: "2026-03-12T14:10:19Z",
  },
];

const ITEM_PERFORMANCE = [
  { name: "Iced Tea", orders: 156, revenue: 544.44, trend: "up" },
  { name: "French Fries", orders: 92, revenue: 459.08, trend: "up" },
  { name: "Classic Burger", orders: 67, revenue: 1004.33, trend: "stable" },
  { name: "Grilled Chicken", orders: 45, revenue: 764.55, trend: "down" },
  { name: "Chocolate Cake", orders: 28, revenue: 223.72, trend: "up" },
];

const getStatusColor = (status: string): "success" | "danger" | "warning" | "default" | "info" => {
  switch (status) {
    case "online":
    case "completed":
    case "ready":
      return "success";
    case "offline":
    case "cancelled":
      return "danger";
    case "syncing":
      return "warning";
    case "preparing":
    case "pending":
      return "info";
    default:
      return "default";
  }
};

const getStatusIcon = (status: string): string => {
  switch (status) {
    case "online":
    case "completed":
    case "ready":
      return "●";
    case "offline":
      return "○";
    case "syncing":
      return "◐";
    case "preparing":
      return "●";
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

export default function POSIntegrationPage() {
  const [selectedLocation, setSelectedLocation] = useState<string>("loc-001");
  const [menuFilterStatus, setMenuFilterStatus] = useState<"all" | "active" | "inactive" | "out_of_stock">("all");
  const [orderFilterStatus, setOrderFilterStatus] = useState<"all" | "pending" | "preparing" | "ready" | "completed">("all");
  const [menuSearchTerm, setMenuSearchTerm] = useState("");

  // Calculate stats
  const totalLocations = LOCATIONS.length;
  const onlineLocations = LOCATIONS.filter((l) => l.status === "online" || l.status === "syncing").length;
  const totalOrdersToday = LOCATIONS.reduce((sum, loc) => sum + loc.ordersToday, 0);
  const totalRevenueToday = LOCATIONS.reduce((sum, loc) => sum + loc.revenueToday, 0);

  const filteredMenuItems = useMemo(
    () =>
      MENU_ITEMS.filter((item) => {
        if (menuFilterStatus !== "all" && item.status !== menuFilterStatus) return false;
        if (menuSearchTerm) {
          const q = menuSearchTerm.toLowerCase();
          return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
        }
        return true;
      }),
    [menuFilterStatus, menuSearchTerm]
  );

  const filteredOrders = useMemo(
    () =>
      ORDERS.filter((order) => {
        if (orderFilterStatus !== "all" && order.status !== orderFilterStatus) return false;
        return true;
      }),
    [orderFilterStatus]
  );

  const selectedLocationData = LOCATIONS.find((l) => l.id === selectedLocation);

  return (
    <>
      <Header
        title="POS Integration"
        subtitle={`${onlineLocations} active locations · ${totalOrdersToday} orders today`}
        actions={
          <Button variant="primary" size="md">
            + Add Location
          </Button>
        }
      />

      <div className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Total Locations"
            value={totalLocations}
            change={{ value: 12.5, label: "vs last month" }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Orders Today"
            value={totalOrdersToday}
            change={{ value: 18.3, label: "vs yesterday" }}
            accentColor="var(--wl-success-400)"
            index={1}
          />
          <StatCard
            label="Revenue Today"
            value={formatCurrency(totalRevenueToday)}
            change={{ value: 15.7, label: "vs yesterday" }}
            accentColor="var(--wl-warning-400)"
            index={2}
          />
          <StatCard
            label="Avg Order Value"
            value={formatCurrency(totalRevenueToday / totalOrdersToday)}
            change={{ value: 3.2, label: "vs avg" }}
            accentColor="var(--wl-info-400)"
            index={3}
          />
        </div>

        {/* POS Provider Cards */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-wl-text-primary mb-4 uppercase tracking-wider">
            Connected POS Systems
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {POS_PROVIDERS.map((provider) => (
              <Card key={provider.id} hover>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-wl-primary-500/20 flex items-center justify-center text-xs font-bold text-wl-primary-400">
                      {provider.logo}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-wl-text-primary">
                        {provider.name}
                      </h3>
                      <Badge variant={provider.status === "connected" ? "success" : "danger"}>
                        {getStatusIcon(provider.status)} {provider.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-wl-bg-surface rounded p-2">
                    <p className="text-xs text-wl-text-tertiary">Locations</p>
                    <p className="text-lg font-bold text-wl-text-primary">
                      {provider.locationsCount}
                    </p>
                  </div>
                  <div className="bg-wl-bg-surface rounded p-2">
                    <p className="text-xs text-wl-text-tertiary">Terminals</p>
                    <p className="text-lg font-bold text-wl-text-primary">
                      {provider.terminalsCount}
                    </p>
                  </div>
                  <div className="bg-wl-bg-surface rounded p-2">
                    <p className="text-xs text-wl-text-tertiary">Orders Today</p>
                    <p className="text-lg font-bold text-wl-text-primary">
                      {provider.ordersToday}
                    </p>
                  </div>
                  <div className="bg-wl-bg-surface rounded p-2">
                    <p className="text-xs text-wl-text-tertiary">Revenue</p>
                    <p className="text-lg font-bold text-wl-text-primary">
                      {formatCurrency(provider.revenueToday)}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-wl-text-tertiary mb-3">
                  Last sync: {formatDateTime(provider.lastSync)}
                </p>

                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1">
                    Settings
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1">
                    Sync Now
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Location Management */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Location Terminal Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {LOCATIONS.map((location) => (
                <div
                  key={location.id}
                  onClick={() => setSelectedLocation(location.id)}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-all",
                    selectedLocation === location.id
                      ? "border-wl-primary-500 bg-wl-primary-500/10"
                      : "border-wl-border-subtle hover:border-wl-border-default"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-wl-text-primary">{location.name}</h4>
                      <p className="text-xs text-wl-text-tertiary">{location.address}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-wl-text-primary">
                        {formatCurrency(location.revenueToday)}
                      </p>
                      <p className="text-xs text-wl-text-tertiary">
                        {location.ordersToday} orders
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant={getStatusColor(location.status)}>
                        {getStatusIcon(location.status)} {location.status}
                      </Badge>
                      <span className="text-wl-text-tertiary">{location.terminal}</span>
                    </div>
                    <span className="text-xs text-wl-text-tertiary">
                      Synced {formatDateTime(location.lastSyncTime)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Menu Sync Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Menu Items & Inventory</CardTitle>
            <div className="flex gap-2 ml-auto">
              {(["all", "active", "inactive", "out_of_stock"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setMenuFilterStatus(status)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-md border capitalize transition-all",
                    menuFilterStatus === status
                      ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                      : "bg-transparent text-wl-text-secondary border-wl-border-subtle"
                  )}
                >
                  {status === "all" ? "All" : status === "out_of_stock" ? "Out of Stock" : status}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search menu items..."
                value={menuSearchTerm}
                onChange={(e) => setMenuSearchTerm(e.target.value)}
                className="w-full p-2 px-3 bg-wl-bg-surface border border-wl-border-default rounded-md text-sm text-wl-text-primary outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-subtle">
                    <th className="p-3 text-left font-semibold text-wl-text-secondary">
                      Item Name
                    </th>
                    <th className="p-3 text-left font-semibold text-wl-text-secondary">
                      Category
                    </th>
                    <th className="p-3 text-center font-semibold text-wl-text-secondary">
                      Price
                    </th>
                    <th className="p-3 text-center font-semibold text-wl-text-secondary">
                      Stock
                    </th>
                    <th className="p-3 text-center font-semibold text-wl-text-secondary">
                      Status
                    </th>
                    <th className="p-3 text-right font-semibold text-wl-text-secondary">
                      Last Orders
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMenuItems.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-wl-border-subtle",
                        idx % 2 === 0 ? "bg-transparent" : "bg-wl-bg-overlay/30"
                      )}
                    >
                      <td className="p-3 text-wl-text-primary font-medium">{item.name}</td>
                      <td className="p-3 text-wl-text-secondary text-xs">
                        <Badge variant="default">{item.category}</Badge>
                      </td>
                      <td className="p-3 text-center font-semibold text-wl-text-primary">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            item.quantity === 0
                              ? "text-wl-danger-400"
                              : item.quantity < 50
                              ? "text-wl-warning-400"
                              : "text-wl-success-400"
                          )}
                        >
                          {item.quantity}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={
                            item.status === "active"
                              ? "success"
                              : item.status === "out_of_stock"
                              ? "danger"
                              : "default"
                          }
                        >
                          {item.status === "out_of_stock" ? "Out" : item.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right text-wl-text-secondary">
                        {item.lastOrders}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Real-time Order Feed */}
        <div className="grid grid-cols-[1fr_1fr] gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Real-Time Order Feed</CardTitle>
              <div className="flex gap-2 ml-auto">
                {(["all", "pending", "preparing", "ready", "completed"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setOrderFilterStatus(status)}
                    className={cn(
                      "px-2 py-1 text-xs font-semibold rounded border capitalize transition-all",
                      orderFilterStatus === status
                        ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                        : "bg-transparent text-wl-text-secondary border-wl-border-subtle"
                    )}
                  >
                    {status === "all" ? "All" : status}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className={cn(
                      "p-3 rounded-md border",
                      order.status === "completed"
                        ? "border-wl-success-400/20 bg-wl-success-bg/20"
                        : order.status === "ready"
                        ? "border-wl-primary-400/20 bg-wl-primary-bg/20"
                        : "border-wl-warning-400/20 bg-wl-warning-bg/20"
                    )}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-wl-text-primary">
                          {order.orderId}
                        </p>
                        <p className="text-xs text-wl-text-tertiary">{order.customer}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-wl-text-primary">
                          {formatCurrency(order.total)}
                        </p>
                        <Badge variant={getStatusColor(order.status)} className="text-xs">
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-wl-text-tertiary">{order.items} items</span>
                      <span className="text-wl-text-tertiary">{formatDateTime(order.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Item Performance Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Top Item Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ITEM_PERFORMANCE.map((item, idx) => (
                  <div key={idx} className="border-b border-wl-border-subtle last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-wl-text-primary">
                          {item.name}
                        </h4>
                        <p className="text-xs text-wl-text-tertiary">
                          {item.orders} orders • {formatCurrency(item.revenue)}
                        </p>
                      </div>
                      <Badge
                        variant={item.trend === "up" ? "success" : item.trend === "down" ? "danger" : "default"}
                      >
                        {item.trend === "up" ? "↑" : item.trend === "down" ? "↓" : "→"} {item.trend}
                      </Badge>
                    </div>
                    <div className="w-full bg-wl-bg-surface rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-primary-400"
                        style={{
                          width: `${(item.orders / ITEM_PERFORMANCE[0].orders) * 100}%`,
                        }}
                      />
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
