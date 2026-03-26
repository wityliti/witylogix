"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency, formatRelativeTime, cn } from "@/lib/utils";

/**
 * Shipments Page - Professional Dark Theme
 * Full shipment management with filtering, tracking timeline, status updates
 */

type ShipmentStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY_FOR_PICKUP"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "ARRIVED"
  | "DELIVERED"
  | "FAILED"
  | "RETURNED"
  | "CANCELLED";

type DeliveryMethod = "LOCAL_DELIVERY" | "STORE_PICKUP" | "STANDARD_SHIPPING" | "EXPRESS_SHIPPING" | "SAME_DAY";

interface Shipment {
  id: string;
  orderId: string;
  orderNumber: string;
  status: ShipmentStatus;
  deliveryMethod: DeliveryMethod;
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  driverName: string | null;
  locationName: string | null;
  weight: number | null;
  itemCount: number;
  shippingCost: number;
  codAmount: number | null;
  trackingNumber: string | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  estimatedDelivery: string | null;
}

const STATUS_FILTERS: { key: ShipmentStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All Shipments" },
  { key: "PENDING", label: "Pending" },
  { key: "PROCESSING", label: "Processing" },
  { key: "PICKED_UP", label: "Picked Up" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "FAILED", label: "Failed" },
];

const DELIVERY_METHODS: { key: DeliveryMethod | "ALL"; label: string; icon: string }[] = [
  { key: "ALL", label: "All Methods", icon: "📦" },
  { key: "SAME_DAY", label: "Same Day", icon: "⚡" },
  { key: "EXPRESS_SHIPPING", label: "Express", icon: "🚀" },
  { key: "STANDARD_SHIPPING", label: "Standard", icon: "📬" },
  { key: "LOCAL_DELIVERY", label: "Local", icon: "🚗" },
  { key: "STORE_PICKUP", label: "Pickup", icon: "🏪" },
];

const statusVariant = (s: string): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const map: Record<string, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    DELIVERED: "success",
    ARRIVED: "success",
    OUT_FOR_DELIVERY: "primary",
    IN_TRANSIT: "primary",
    PICKED_UP: "primary",
    PROCESSING: "info",
    READY_FOR_PICKUP: "info",
    PENDING: "warning",
    FAILED: "danger",
    RETURNED: "danger",
    CANCELLED: "default",
  };
  return map[s] ?? "default";
};

const deliveryMethodIcon = (method: DeliveryMethod): string => {
  const map: Record<DeliveryMethod, string> = {
    SAME_DAY: "⚡",
    EXPRESS_SHIPPING: "🚀",
    STANDARD_SHIPPING: "📬",
    LOCAL_DELIVERY: "🚗",
    STORE_PICKUP: "🏪",
  };
  return map[method];
};

const statusProgression: ShipmentStatus[] = [
  "PENDING",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
  "DELIVERED",
];

// Mock shipments
const SHIPMENTS: Shipment[] = Array.from({ length: 30 }, (_, i) => {
  const statuses: ShipmentStatus[] = [
    "PENDING",
    "PROCESSING",
    "PICKED_UP",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "DELIVERED",
    "DELIVERED",
    "FAILED",
    "ARRIVED",
  ];
  const methods: DeliveryMethod[] = [
    "SAME_DAY",
    "EXPRESS_SHIPPING",
    "STANDARD_SHIPPING",
    "LOCAL_DELIVERY",
    "STORE_PICKUP",
  ];
  const names = [
    "Emma Watson",
    "James Chen",
    "Maria Garcia",
    "Robert Kim",
    "Sarah Miller",
    "David Brown",
    "Ana Lopez",
    "Carlos Ruiz",
    "Lisa Zhang",
    "Omar Hassan",
  ];
  const drivers = ["Carlos M.", "Sofia L.", "Ahmed K.", "Lisa T.", "Marcus J.", null];
  const locations = ["Downtown Hub", "Harbor Store", "West Side Depot", null, null];
  const cities = ["Toronto", "Vancouver", "Montreal", "Calgary", "Edmonton"];
  const provinces = ["ON", "BC", "QC", "AB", "AB"];
  const status = statuses[i % statuses.length];

  return {
    id: `ship-${3000 - i}`,
    orderId: `ord-${2847 - i}`,
    orderNumber: `#${10247 - i}`,
    status,
    deliveryMethod: methods[i % methods.length],
    recipientName: names[i % names.length],
    recipientPhone: "+1 (555) 012-" + String(3456 + i).slice(0, 4),
    recipientEmail: `${names[i % names.length].toLowerCase().replace(" ", ".")}@email.com`,
    addressLine1: `${100 + i * 10} ${["Main", "Oak", "Pine", "Elm", "Maple"][i % 5]} St`,
    city: cities[i % cities.length],
    province: provinces[i % provinces.length],
    postalCode: `${String(10000 + i).slice(0, 5)}`,
    driverName: drivers[i % drivers.length],
    locationName: locations[i % locations.length],
    weight: Math.round((0.5 + Math.random() * 15) * 10) / 10,
    itemCount: 1 + Math.floor(Math.random() * 5),
    shippingCost: Math.round((5 + Math.random() * 45) * 100) / 100,
    codAmount: i % 7 === 0 ? Math.round((50 + Math.random() * 300) * 100) / 100 : null,
    trackingNumber: `TRK${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    notes: i % 5 === 0 ? "Fragile - Handle with care" : i % 4 === 0 ? "Signature required" : null,
    tags: i % 4 === 0 ? ["priority", "fragile"] : i % 3 === 0 ? ["express"] : [],
    createdAt: new Date(Date.now() - i * 1800000).toISOString(),
    estimatedDelivery:
      status === "OUT_FOR_DELIVERY" || status === "IN_TRANSIT"
        ? new Date(Date.now() + (10 + Math.random() * 30) * 60000).toISOString()
        : new Date(Date.now() + Math.random() * 5 * 86400000).toISOString(),
  };
});

export default function ShipmentsPage() {
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "ALL">("ALL");
  const [methodFilter, setMethodFilter] = useState<DeliveryMethod | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  const filtered = useMemo(() => {
    return SHIPMENTS.filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (methodFilter !== "ALL" && s.deliveryMethod !== methodFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.id.toLowerCase().includes(q) ||
          s.orderNumber.includes(q) ||
          s.recipientName.toLowerCase().includes(q) ||
          s.addressLine1.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          (s.trackingNumber?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [statusFilter, methodFilter, search]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = SHIPMENTS.length;
    const inTransit = SHIPMENTS.filter(
      (s) => s.status === "IN_TRANSIT" || s.status === "OUT_FOR_DELIVERY"
    ).length;
    const deliveredToday = SHIPMENTS.filter(
      (s) => s.status === "DELIVERED" && new Date(s.createdAt).toDateString() === new Date().toDateString()
    ).length;
    const failed = SHIPMENTS.filter((s) => s.status === "FAILED").length;
    const avgDeliveryTime = Math.round(
      SHIPMENTS.reduce((sum, s) => sum + (s.shippingCost > 20 ? 3 : 1), 0) / SHIPMENTS.length
    );
    const revenue = Math.round(SHIPMENTS.reduce((sum, s) => sum + s.shippingCost, 0) * 100) / 100;

    return { total, inTransit, deliveredToday, failed, avgDeliveryTime, revenue };
  }, []);

  return (
    <>
      <Header
        title="Shipments"
        subtitle={`${SHIPMENTS.length} total · ${stats.inTransit} in transit`}
        actions={
          <Button variant="primary" size="md">
            + New Shipment
          </Button>
        }
      />

      <div className="p-6 space-y-6 bg-[#0a0a0f] min-h-[calc(100vh-var(--header-height))]">
        {/* KPI Stats Row */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          <StatCard
            label="Total Shipments"
            value={stats.total}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="In Transit"
            value={stats.inTransit}
            accentColor="var(--wl-info-400)"
            index={1}
          />
          <StatCard
            label="Delivered Today"
            value={stats.deliveredToday}
            accentColor="var(--wl-success-400)"
            index={2}
          />
          <StatCard
            label="Failed"
            value={stats.failed}
            accentColor="var(--wl-danger-400)"
            index={3}
          />
          <StatCard
            label="Avg Delivery (days)"
            value={stats.avgDeliveryTime}
            accentColor="var(--wl-warning-400)"
            index={4}
          />
          <StatCard
            label="Shipping Revenue"
            value={formatCurrency(stats.revenue)}
            accentColor="var(--wl-success-400)"
            index={5}
          />
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-80 max-w-96">
            <input
              type="text"
              placeholder="Search shipments, tracking, recipient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full p-2 px-4 bg-[#12121a] border border-[#1e1e2e] rounded-md",
                "text-white text-sm font-sans outline-none",
                "focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20",
                "placeholder:text-gray-500 transition-colors"
              )}
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex gap-4 flex-wrap">
            {STATUS_FILTERS.map((f) => {
              const count =
                f.key === "ALL"
                  ? SHIPMENTS.length
                  : SHIPMENTS.filter((s) => s.status === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-all",
                    statusFilter === f.key
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-transparent text-gray-400 border-[#1e1e2e] hover:border-[#2a2a3e]"
                  )}
                >
                  {f.label}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Delivery Method Tabs */}
        <div className="flex gap-4 flex-wrap">
          {DELIVERY_METHODS.map((m) => {
            const count =
              m.key === "ALL"
                ? SHIPMENTS.length
                : SHIPMENTS.filter((s) => s.deliveryMethod === m.key).length;
            return (
              <button
                key={m.key}
                onClick={() => setMethodFilter(m.key)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 rounded border text-xs font-semibold cursor-pointer transition-all",
                  methodFilter === m.key
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-transparent text-gray-400 border-[#1e1e2e] hover:border-[#2a2a3e]"
                )}
              >
                <span>{m.icon}</span>
                {m.label}
                <span className="text-xs opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Shipments Table + Detail */}
        <div className={cn(
          "grid gap-5",
          selectedShipment ? "grid-cols-[1fr_400px]" : "grid-cols-1"
        )}>
          {/* Shipments Table */}
          <Card className={cn("bg-[#12121a] border-[#1e1e2e] overflow-hidden p-0")}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["Tracking#", "Order", "Recipient", "Status", "Method", "Driver/Location", "Items", "Cost", "ETA"].map(
                      (h) => (
                        <th
                          key={h}
                          className={cn(
                            "text-left p-4 text-xs font-semibold text-gray-400",
                            "uppercase tracking-wider border-b border-[#1e1e2e]",
                            "bg-[#1a1a2e] sticky top-0 whitespace-nowrap"
                          )}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((shipment) => (
                    <tr
                      key={shipment.id}
                      onClick={() =>
                        setSelectedShipment(selectedShipment?.id === shipment.id ? null : shipment)
                      }
                      className={cn(
                        "border-b border-[#1e1e2e] cursor-pointer transition-all",
                        selectedShipment?.id === shipment.id ? "bg-amber-500/10" : "hover:bg-[#1a1a2e]"
                      )}
                    >
                      {/* Tracking Number */}
                      <td className="p-4 font-mono font-semibold text-blue-400 text-xs whitespace-nowrap">
                        {shipment.trackingNumber ?? "—"}
                        {shipment.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {shipment.tags.map((t) => (
                              <span
                                key={t}
                                className={cn(
                                  "text-[9px] px-1 py-0.5 rounded font-semibold uppercase tracking-tighter",
                                  t === "priority"
                                    ? "bg-red-500/20 text-red-400"
                                    : t === "express"
                                      ? "bg-amber-500/20 text-amber-400"
                                      : "bg-blue-500/20 text-blue-400"
                                )}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Order Number */}
                      <td className="p-4 font-mono font-medium text-white">
                        {shipment.orderNumber}
                      </td>

                      {/* Recipient Name */}
                      <td className="p-4 text-white font-medium max-w-40 truncate">
                        {shipment.recipientName}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <Badge variant={statusVariant(shipment.status)}>
                          {shipment.status.replace(/_/g, " ")}
                        </Badge>
                      </td>

                      {/* Method */}
                      <td className="p-4 text-gray-400 text-sm whitespace-nowrap">
                        <span className="mr-1">
                          {deliveryMethodIcon(shipment.deliveryMethod)}
                        </span>
                        {shipment.deliveryMethod.replace(/_/g, " ")}
                      </td>

                      {/* Driver/Location */}
                      <td className={cn(
                        "p-4 text-xs whitespace-nowrap",
                        shipment.driverName || shipment.locationName
                          ? "text-gray-400"
                          : "text-gray-500 italic"
                      )}>
                        {shipment.driverName ?? shipment.locationName ?? "—"}
                      </td>

                      {/* Items */}
                      <td className="p-4 font-mono text-xs text-gray-400 text-center">
                        {shipment.itemCount}
                      </td>

                      {/* Cost */}
                      <td className="p-4 font-mono font-semibold text-white">
                        {formatCurrency(shipment.shippingCost)}
                      </td>

                      {/* ETA */}
                      <td className={cn(
                        "p-4 font-mono text-xs",
                        shipment.estimatedDelivery && new Date(shipment.estimatedDelivery) > new Date()
                          ? "text-blue-400"
                          : "text-gray-500"
                      )}>
                        {shipment.estimatedDelivery
                          ? formatRelativeTime(shipment.estimatedDelivery)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Shipment Detail Panel */}
          {selectedShipment && (
            <Card className={cn("bg-[#12121a] border-[#1e1e2e] sticky top-24 max-h-[calc(100vh-var(--wl-header-height)-var(--wl-space-12))] overflow-y-auto")}>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg font-bold font-mono text-blue-400">
                      {selectedShipment.trackingNumber}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedShipment(null)}
                    className="bg-none border-none text-gray-400 cursor-pointer text-lg font-sans hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <Badge
                  variant={statusVariant(selectedShipment.status)}
                  className="inline-block"
                >
                  {selectedShipment.status.replace(/_/g, " ")}
                </Badge>

                <div className="flex flex-col gap-4">
                  {/* Recipient Info */}
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      Recipient
                    </div>
                    <div className="text-base font-semibold text-white">
                      {selectedShipment.recipientName}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {selectedShipment.recipientEmail}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                      {selectedShipment.recipientPhone}
                    </div>
                  </div>

                  <div className="h-px bg-[#1e1e2e]" />

                  {/* Delivery Details */}
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      Delivery Address
                    </div>
                    <div className="text-sm text-gray-400 mb-1 leading-snug">
                      {selectedShipment.addressLine1}
                      <br />
                      {selectedShipment.city}, {selectedShipment.province}{" "}
                      {selectedShipment.postalCode}
                    </div>
                    <div className="flex items-center gap-1 text-sm mt-2 text-gray-300">
                      <span>{deliveryMethodIcon(selectedShipment.deliveryMethod)}</span>
                      {selectedShipment.deliveryMethod.replace(/_/g, " ")}
                    </div>
                    {(selectedShipment.driverName || selectedShipment.locationName) && (
                      <div className="text-xs text-gray-500 mt-1">
                        {selectedShipment.driverName && `Driver: ${selectedShipment.driverName}`}
                        {selectedShipment.locationName && `Location: ${selectedShipment.locationName}`}
                      </div>
                    )}
                    {selectedShipment.estimatedDelivery && (
                      <div className="text-xs text-gray-400 mt-2">
                        ETA: {formatRelativeTime(selectedShipment.estimatedDelivery)}
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-[#1e1e2e]" />

                  {/* Status Timeline */}
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-3">
                      Progress
                    </div>
                    <div className="flex flex-col gap-0">
                      {statusProgression.map((step, idx) => {
                        const isCompleted =
                          statusProgression.indexOf(selectedShipment.status) >= idx;
                        const isCurrent = selectedShipment.status === step;
                        return (
                          <div key={step} className="flex gap-2">
                            <div className="flex flex-col items-center">
                              <div
                                className={cn(
                                  "w-3 h-3 rounded-full flex-shrink-0",
                                  isCompleted
                                    ? isCurrent
                                      ? "bg-blue-500"
                                      : "bg-emerald-400"
                                    : "bg-[#1e1e2e]"
                                )}
                              />
                              {idx < statusProgression.length - 1 && (
                                <div
                                  className={cn(
                                    "w-0.5 h-6",
                                    isCompleted
                                      ? "bg-emerald-400"
                                      : "bg-[#1e1e2e]"
                                  )}
                                />
                              )}
                            </div>
                            <div
                              className={cn(
                                "text-xs py-0.5",
                                isCompleted
                                  ? "text-white"
                                  : "text-gray-500",
                                isCurrent ? "font-semibold" : "font-medium"
                              )}
                            >
                              {step.replace(/_/g, " ")}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="h-px bg-[#1e1e2e]" />

                  {/* Shipment Info */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-gray-500">
                        Items
                      </div>
                      <div className="text-base font-bold font-mono text-white">
                        {selectedShipment.itemCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">
                        Weight
                      </div>
                      <div className="text-base font-bold font-mono text-gray-400">
                        {selectedShipment.weight ? `${selectedShipment.weight} kg` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">
                        Shipping Cost
                      </div>
                      <div className="text-base font-bold font-mono text-emerald-400">
                        {formatCurrency(selectedShipment.shippingCost)}
                      </div>
                    </div>
                    {selectedShipment.codAmount && (
                      <div className="col-span-3">
                        <div className="text-xs text-gray-500">
                          COD Amount
                        </div>
                        <div className="text-base font-bold font-mono text-amber-400">
                          {formatCurrency(selectedShipment.codAmount)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {selectedShipment.tags.length > 0 && (
                    <>
                      <div className="h-px bg-[#1e1e2e]" />
                      <div>
                        <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
                          Tags
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedShipment.tags.map((t) => (
                            <Badge
                              key={t}
                              variant={
                                t === "priority"
                                  ? "danger"
                                  : t === "express"
                                    ? "primary"
                                    : "info"
                              }
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Notes */}
                  {selectedShipment.notes && (
                    <>
                      <div className="h-px bg-[#1e1e2e]" />
                      <div>
                        <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
                          Notes
                        </div>
                        <div className="text-xs text-gray-400 italic">
                          {selectedShipment.notes}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button variant="primary" size="sm" className="flex-1">
                      Assign Driver
                    </Button>
                    <Button variant="secondary" size="sm" className="flex-1">
                      Edit Details
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1">
                      View Tracking
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
