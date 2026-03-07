"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   SHIPMENTS PAGE — Full shipment management with filtering + detail
   ═══════════════════════════════════════════════════════════ */

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

      <div style={{ padding: "var(--wl-space-6)" }}>
        {/* KPI Stats Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-6)",
          }}
        >
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
        <div
          style={{
            display: "flex",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-5)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Search */}
          <div style={{ flex: "1 1 300px", maxWidth: 400 }}>
            <input
              type="text"
              placeholder="Search shipments, tracking, recipient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "var(--wl-space-2) var(--wl-space-4)",
                background: "var(--wl-bg-elevated)",
                border: "1px solid var(--wl-border-default)",
                borderRadius: "var(--wl-radius-md)",
                color: "var(--wl-text-primary)",
                fontSize: "var(--wl-text-sm)",
                fontFamily: "var(--wl-font-sans)",
                outline: "none",
              }}
            />
          </div>

          {/* Status Filter Pills */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {STATUS_FILTERS.map((f) => {
              const count =
                f.key === "ALL"
                  ? SHIPMENTS.length
                  : SHIPMENTS.filter((s) => s.status === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  style={{
                    padding: "var(--wl-space-1) var(--wl-space-3)",
                    borderRadius: "var(--wl-radius-full)",
                    border: "1px solid",
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--wl-font-sans)",
                    transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
                    background: statusFilter === f.key ? "var(--wl-primary-500)" : "transparent",
                    color: statusFilter === f.key ? "var(--wl-text-inverse)" : "var(--wl-text-tertiary)",
                    borderColor: statusFilter === f.key ? "var(--wl-primary-500)" : "var(--wl-border-default)",
                  }}
                >
                  {f.label}
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Delivery Method Tabs */}
        <div
          style={{
            display: "flex",
            gap: "var(--wl-space-2)",
            marginBottom: "var(--wl-space-5)",
            overflowX: "auto",
            paddingBottom: "var(--wl-space-2)",
          }}
        >
          {DELIVERY_METHODS.map((m) => {
            const count =
              m.key === "ALL"
                ? SHIPMENTS.length
                : SHIPMENTS.filter((s) => s.deliveryMethod === m.key).length;
            return (
              <button
                key={m.key}
                onClick={() => setMethodFilter(m.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--wl-space-1)",
                  padding: "var(--wl-space-2) var(--wl-space-4)",
                  borderRadius: "var(--wl-radius-md)",
                  border: "1px solid",
                  fontSize: "var(--wl-text-sm)",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "var(--wl-font-sans)",
                  transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
                  background:
                    methodFilter === m.key ? "var(--wl-bg-overlay)" : "transparent",
                  color:
                    methodFilter === m.key ? "var(--wl-text-primary)" : "var(--wl-text-secondary)",
                  borderColor:
                    methodFilter === m.key ? "var(--wl-border-default)" : "var(--wl-border-subtle)",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{m.icon}</span>
                {m.label}
                <span style={{ fontSize: "var(--wl-text-xs)", opacity: 0.7 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Shipments Table + Detail */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: selectedShipment ? "1fr 420px" : "1fr",
            gap: "var(--wl-space-5)",
          }}
        >
          {/* Shipments Table */}
          <Card style={{ overflow: "hidden", padding: 0 }}>
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
                    {["Tracking#", "Order", "Recipient", "Status", "Method", "Driver/Location", "Items", "Cost", "ETA"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "var(--wl-space-3) var(--wl-space-4)",
                            fontSize: "var(--wl-text-xs)",
                            fontWeight: 600,
                            color: "var(--wl-text-tertiary)",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            borderBottom: "1px solid var(--wl-border-subtle)",
                            background: "var(--wl-bg-surface)",
                            position: "sticky",
                            top: 0,
                            whiteSpace: "nowrap",
                          }}
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
                      style={{
                        borderBottom: "1px solid var(--wl-border-subtle)",
                        cursor: "pointer",
                        background:
                          selectedShipment?.id === shipment.id
                            ? "rgba(245, 166, 35, 0.06)"
                            : "transparent",
                        transition: `background var(--wl-duration-fast) var(--wl-ease-default)`,
                      }}
                    >
                      {/* Tracking Number */}
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          fontFamily: "var(--wl-font-mono)",
                          fontWeight: 600,
                          color: "var(--wl-primary-400)",
                          fontSize: "var(--wl-text-xs)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {shipment.trackingNumber ?? "—"}
                        {shipment.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                            {shipment.tags.map((t) => (
                              <span
                                key={t}
                                style={{
                                  fontSize: 9,
                                  padding: "1px 4px",
                                  borderRadius: 3,
                                  background:
                                    t === "priority"
                                      ? "var(--wl-danger-bg)"
                                      : t === "express"
                                        ? "rgba(245,166,35,0.12)"
                                        : "var(--wl-info-bg)",
                                  color:
                                    t === "priority"
                                      ? "var(--wl-danger-400)"
                                      : t === "express"
                                        ? "var(--wl-primary-400)"
                                        : "var(--wl-info-400)",
                                  fontWeight: 600,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.03em",
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Order Number */}
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          fontFamily: "var(--wl-font-mono)",
                          fontWeight: 500,
                          color: "var(--wl-text-primary)",
                        }}
                      >
                        {shipment.orderNumber}
                      </td>

                      {/* Recipient Name */}
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          color: "var(--wl-text-primary)",
                          fontWeight: 500,
                          maxWidth: 150,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {shipment.recipientName}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)" }}>
                        <Badge variant={statusVariant(shipment.status)} dot>
                          {shipment.status.replace(/_/g, " ")}
                        </Badge>
                      </td>

                      {/* Method */}
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          color: "var(--wl-text-secondary)",
                          fontSize: "var(--wl-text-sm)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ marginRight: "var(--wl-space-1)" }}>
                          {deliveryMethodIcon(shipment.deliveryMethod)}
                        </span>
                        {shipment.deliveryMethod.replace(/_/g, " ")}
                      </td>

                      {/* Driver/Location */}
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          color: shipment.driverName || shipment.locationName
                            ? "var(--wl-text-secondary)"
                            : "var(--wl-text-tertiary)",
                          fontStyle: shipment.driverName || shipment.locationName ? "normal" : "italic",
                          fontSize: "var(--wl-text-xs)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {shipment.driverName ?? shipment.locationName ?? "—"}
                      </td>

                      {/* Items */}
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          fontFamily: "var(--wl-font-mono)",
                          fontSize: "var(--wl-text-xs)",
                          color: "var(--wl-text-secondary)",
                          textAlign: "center",
                        }}
                      >
                        {shipment.itemCount}
                      </td>

                      {/* Cost */}
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          fontFamily: "var(--wl-font-mono)",
                          fontWeight: 600,
                          color: "var(--wl-text-primary)",
                        }}
                      >
                        {formatCurrency(shipment.shippingCost)}
                      </td>

                      {/* ETA */}
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          fontFamily: "var(--wl-font-mono)",
                          fontSize: "var(--wl-text-xs)",
                          color:
                            shipment.estimatedDelivery && new Date(shipment.estimatedDelivery) > new Date()
                              ? "var(--wl-primary-400)"
                              : "var(--wl-text-tertiary)",
                        }}
                      >
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
            <Card
              className="wl-animate-in"
              style={{
                position: "sticky",
                top: "calc(var(--wl-header-height) + var(--wl-space-6))",
                maxHeight: "calc(100vh - var(--wl-header-height) - var(--wl-space-12))",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--wl-space-4)",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "var(--wl-text-lg)",
                      fontWeight: 700,
                      fontFamily: "var(--wl-font-mono)",
                      color: "var(--wl-primary-400)",
                    }}
                  >
                    {selectedShipment.trackingNumber}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedShipment(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--wl-text-tertiary)",
                    cursor: "pointer",
                    fontSize: 18,
                    fontFamily: "var(--wl-font-sans)",
                  }}
                >
                  ✕
                </button>
              </div>

              <Badge
                variant={statusVariant(selectedShipment.status)}
                dot
                style={{ marginBottom: "var(--wl-space-4)" }}
              >
                {selectedShipment.status.replace(/_/g, " ")}
              </Badge>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-4)" }}>
                {/* Recipient Info */}
                <div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      color: "var(--wl-text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "var(--wl-space-2)",
                    }}
                  >
                    Recipient
                  </div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-base)",
                      fontWeight: 600,
                      color: "var(--wl-text-primary)",
                    }}
                  >
                    {selectedShipment.recipientName}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      color: "var(--wl-text-secondary)",
                      marginTop: 2,
                    }}
                  >
                    {selectedShipment.recipientEmail}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      color: "var(--wl-text-secondary)",
                      fontFamily: "var(--wl-font-mono)",
                    }}
                  >
                    {selectedShipment.recipientPhone}
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Delivery Details */}
                <div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      color: "var(--wl-text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "var(--wl-space-2)",
                    }}
                  >
                    Delivery Address
                  </div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-sm)",
                      color: "var(--wl-text-secondary)",
                      marginBottom: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    {selectedShipment.addressLine1}
                    <br />
                    {selectedShipment.city}, {selectedShipment.province}{" "}
                    {selectedShipment.postalCode}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--wl-space-1)",
                      fontSize: "var(--wl-text-sm)",
                      color: "var(--wl-text-secondary)",
                      marginTop: "var(--wl-space-2)",
                    }}
                  >
                    <span>{deliveryMethodIcon(selectedShipment.deliveryMethod)}</span>
                    {selectedShipment.deliveryMethod.replace(/_/g, " ")}
                  </div>
                  {(selectedShipment.driverName || selectedShipment.locationName) && (
                    <div
                      style={{
                        fontSize: "var(--wl-text-xs)",
                        color: "var(--wl-text-tertiary)",
                        marginTop: 4,
                      }}
                    >
                      {selectedShipment.driverName && `Driver: ${selectedShipment.driverName}`}
                      {selectedShipment.locationName && `Location: ${selectedShipment.locationName}`}
                    </div>
                  )}
                  {selectedShipment.estimatedDelivery && (
                    <div
                      style={{
                        fontSize: "var(--wl-text-sm)",
                        fontWeight: 600,
                        color: "var(--wl-primary-400)",
                        fontFamily: "var(--wl-font-mono)",
                        marginTop: "var(--wl-space-2)",
                      }}
                    >
                      ETA: {formatRelativeTime(selectedShipment.estimatedDelivery)}
                    </div>
                  )}
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Status Timeline */}
                <div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      color: "var(--wl-text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "var(--wl-space-3)",
                    }}
                  >
                    Progress
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--wl-space-2)",
                    }}
                  >
                    {statusProgression.map((step, idx) => {
                      const isCompleted =
                        statusProgression.indexOf(selectedShipment.status) >= idx;
                      const isCurrent = selectedShipment.status === step;
                      return (
                        <div key={step} style={{ display: "flex", gap: "var(--wl-space-2)" }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              width: "24px",
                            }}
                          >
                            <div
                              style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "50%",
                                background: isCompleted
                                  ? isCurrent
                                    ? "var(--wl-primary-500)"
                                    : "var(--wl-success-400)"
                                  : "var(--wl-border-default)",
                                flexShrink: 0,
                              }}
                            />
                            {idx < statusProgression.length - 1 && (
                              <div
                                style={{
                                  width: "2px",
                                  height: "24px",
                                  background: isCompleted
                                    ? "var(--wl-success-400)"
                                    : "var(--wl-border-default)",
                                  marginTop: "4px",
                                }}
                              />
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "var(--wl-text-xs)",
                              color: isCompleted
                                ? "var(--wl-text-primary)"
                                : "var(--wl-text-tertiary)",
                              fontWeight: isCurrent ? 600 : 500,
                              paddingTop: "2px",
                            }}
                          >
                            {step.replace(/_/g, " ")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Shipment Info */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "var(--wl-space-3)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-xs)",
                        color: "var(--wl-text-tertiary)",
                      }}
                    >
                      Items
                    </div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: "var(--wl-text-primary)",
                      }}
                    >
                      {selectedShipment.itemCount}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-xs)",
                        color: "var(--wl-text-tertiary)",
                      }}
                    >
                      Weight
                    </div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: "var(--wl-text-secondary)",
                      }}
                    >
                      {selectedShipment.weight ? `${selectedShipment.weight} kg` : "—"}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-xs)",
                        color: "var(--wl-text-tertiary)",
                      }}
                    >
                      Shipping Cost
                    </div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: "var(--wl-success-400)",
                      }}
                    >
                      {formatCurrency(selectedShipment.shippingCost)}
                    </div>
                  </div>
                  {selectedShipment.codAmount && (
                    <div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-xs)",
                          color: "var(--wl-text-tertiary)",
                        }}
                      >
                        COD Amount
                      </div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-base)",
                          fontWeight: 700,
                          fontFamily: "var(--wl-font-mono)",
                          color: "var(--wl-warning-400)",
                        }}
                      >
                        {formatCurrency(selectedShipment.codAmount)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {selectedShipment.tags.length > 0 && (
                  <>
                    <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />
                    <div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-xs)",
                          fontWeight: 600,
                          color: "var(--wl-text-tertiary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          marginBottom: "var(--wl-space-2)",
                        }}
                      >
                        Tags
                      </div>
                      <div style={{ display: "flex", gap: "var(--wl-space-1)", flexWrap: "wrap" }}>
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
                    <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />
                    <div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-xs)",
                          fontWeight: 600,
                          color: "var(--wl-text-tertiary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          marginBottom: "var(--wl-space-2)",
                        }}
                      >
                        Notes
                      </div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-xs)",
                          color: "var(--wl-text-secondary)",
                          fontStyle: "italic",
                        }}
                      >
                        {selectedShipment.notes}
                      </div>
                    </div>
                  </>
                )}

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    gap: "var(--wl-space-2)",
                    flexWrap: "wrap",
                    marginTop: "var(--wl-space-2)",
                  }}
                >
                  <Button variant="primary" size="sm">
                    Assign Driver
                  </Button>
                  <Button variant="secondary" size="sm">
                    Edit Details
                  </Button>
                  <Button variant="ghost" size="sm">
                    View Tracking
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
