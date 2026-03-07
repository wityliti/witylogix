"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   ORDERS PAGE — Full order management with filtering + detail
   ═══════════════════════════════════════════════════════════ */

type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "OUT_FOR_DELIVERY"
  | "ARRIVED"
  | "DELIVERED"
  | "FAILED"
  | "RETURNED"
  | "CANCELLED";

interface Order {
  id: string;
  shopifyOrderNumber: string;
  customer: string;
  email: string;
  phone: string;
  status: OrderStatus;
  driver: string | null;
  address: string;
  amount: number;
  items: number;
  deliveryDate: string;
  timeSlot: string | null;
  eta: string | null;
  createdAt: string;
  tags: string[];
}

const STATUS_FILTERS: { key: OrderStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All Orders" },
  { key: "PENDING", label: "Pending" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "OUT_FOR_DELIVERY", label: "In Transit" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "FAILED", label: "Failed" },
  { key: "CANCELLED", label: "Cancelled" },
];

const statusVariant = (s: string): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const map: Record<string, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    DELIVERED: "success", OUT_FOR_DELIVERY: "primary", PICKED_UP: "primary",
    ASSIGNED: "info", ACCEPTED: "info", PENDING: "warning", ARRIVED: "success",
    FAILED: "danger", RETURNED: "danger", CANCELLED: "default",
  };
  return map[s] ?? "default";
};

// Mock orders
const ORDERS: Order[] = Array.from({ length: 24 }, (_, i) => {
  const statuses: OrderStatus[] = ["PENDING", "ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "DELIVERED", "DELIVERED", "FAILED", "PICKED_UP"];
  const names = ["Emma Watson", "James Chen", "Maria Garcia", "Robert Kim", "Sarah Miller", "David Brown", "Ana Lopez", "Carlos Ruiz", "Lisa Zhang", "Omar Hassan"];
  const drivers = ["Carlos M.", "Sofia L.", "Ahmed K.", "Lisa T.", "Marcus J.", null];
  const addresses = ["123 Main St, Downtown", "456 Oak Ave, Midtown", "789 Pine Rd, West Side", "321 Elm Dr, South District", "654 Maple Ln, Harbor Area"];
  return {
    id: `ord-${2847 - i}`,
    shopifyOrderNumber: `#${10247 - i}`,
    customer: names[i % names.length],
    email: `${names[i % names.length].toLowerCase().replace(" ", ".")}@email.com`,
    phone: "+1 (555) 012-" + String(3456 + i).slice(0, 4),
    status: statuses[i % statuses.length],
    driver: drivers[i % drivers.length],
    address: addresses[i % addresses.length],
    amount: Math.round((30 + Math.random() * 200) * 100) / 100,
    items: 1 + Math.floor(Math.random() * 5),
    deliveryDate: "2026-03-06",
    timeSlot: i % 3 === 0 ? "9:00 AM - 12:00 PM" : i % 3 === 1 ? "12:00 PM - 3:00 PM" : null,
    eta: statuses[i % statuses.length] === "OUT_FOR_DELIVERY" ? `${10 + Math.floor(Math.random() * 30)} min` : null,
    createdAt: new Date(Date.now() - i * 1800000).toISOString(),
    tags: i % 4 === 0 ? ["priority", "fragile"] : i % 3 === 0 ? ["express"] : [],
  };
});

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filtered = useMemo(() => {
    return ORDERS.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          o.id.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.shopifyOrderNumber.includes(q) ||
          o.address.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [statusFilter, search]);

  return (
    <>
      <Header
        title="Orders"
        subtitle={`${ORDERS.length} total · ${ORDERS.filter((o) => o.status === "PENDING").length} pending`}
        actions={
          <Button variant="primary" size="md">
            + New Order
          </Button>
        }
      />

      <div style={{ padding: "var(--wl-space-6)" }}>
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
              placeholder="Search orders, customers, addresses..."
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
              const count = f.key === "ALL" ? ORDERS.length : ORDERS.filter((o) => o.status === f.key).length;
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

        {/* Orders Grid + Detail */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: selectedOrder ? "1fr 400px" : "1fr",
            gap: "var(--wl-space-5)",
          }}
        >
          {/* Orders Table */}
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
                    {["Order", "Customer", "Status", "Driver", "Address", "Items", "Amount", "ETA"].map(
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
                  {filtered.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                      style={{
                        borderBottom: "1px solid var(--wl-border-subtle)",
                        cursor: "pointer",
                        background:
                          selectedOrder?.id === order.id
                            ? "rgba(245, 166, 35, 0.06)"
                            : "transparent",
                        transition: `background var(--wl-duration-fast) var(--wl-ease-default)`,
                      }}
                    >
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
                        {order.shopifyOrderNumber}
                        {order.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                            {order.tags.map((t) => (
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
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          color: "var(--wl-text-primary)",
                          fontWeight: 500,
                        }}
                      >
                        {order.customer}
                      </td>
                      <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)" }}>
                        <Badge variant={statusVariant(order.status)} dot>
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          color: order.driver ? "var(--wl-text-secondary)" : "var(--wl-text-tertiary)",
                          fontStyle: order.driver ? "normal" : "italic",
                        }}
                      >
                        {order.driver ?? "Unassigned"}
                      </td>
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          color: "var(--wl-text-secondary)",
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: "var(--wl-text-xs)",
                        }}
                      >
                        {order.address}
                      </td>
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          fontFamily: "var(--wl-font-mono)",
                          fontSize: "var(--wl-text-xs)",
                          color: "var(--wl-text-secondary)",
                          textAlign: "center",
                        }}
                      >
                        {order.items}
                      </td>
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          fontFamily: "var(--wl-font-mono)",
                          fontWeight: 600,
                          color: "var(--wl-text-primary)",
                        }}
                      >
                        {formatCurrency(order.amount)}
                      </td>
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          fontFamily: "var(--wl-font-mono)",
                          fontSize: "var(--wl-text-xs)",
                          color: order.eta ? "var(--wl-primary-400)" : "var(--wl-text-tertiary)",
                        }}
                      >
                        {order.eta ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Order Detail Panel */}
          {selectedOrder && (
            <Card
              className="wl-animate-in"
              style={{
                position: "sticky",
                top: "calc(var(--wl-header-height) + var(--wl-space-6))",
                maxHeight: "calc(100vh - var(--wl-header-height) - var(--wl-space-12))",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--wl-space-4)" }}>
                <div>
                  <span
                    style={{
                      fontSize: "var(--wl-text-lg)",
                      fontWeight: 700,
                      fontFamily: "var(--wl-font-mono)",
                      color: "var(--wl-primary-400)",
                    }}
                  >
                    {selectedOrder.shopifyOrderNumber}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
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

              <Badge variant={statusVariant(selectedOrder.status)} dot style={{ marginBottom: "var(--wl-space-4)" }}>
                {selectedOrder.status.replace(/_/g, " ")}
              </Badge>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-4)" }}>
                {/* Customer Info */}
                <div>
                  <div style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "var(--wl-space-2)" }}>
                    Customer
                  </div>
                  <div style={{ fontSize: "var(--wl-text-base)", fontWeight: 600, color: "var(--wl-text-primary)" }}>
                    {selectedOrder.customer}
                  </div>
                  <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", marginTop: 2 }}>
                    {selectedOrder.email}
                  </div>
                  <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", fontFamily: "var(--wl-font-mono)" }}>
                    {selectedOrder.phone}
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Delivery Details */}
                <div>
                  <div style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "var(--wl-space-2)" }}>
                    Delivery
                  </div>
                  <div style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-secondary)", marginBottom: 4 }}>
                    {selectedOrder.address}
                  </div>
                  {selectedOrder.timeSlot && (
                    <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                      Time Slot: {selectedOrder.timeSlot}
                    </div>
                  )}
                  <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                    Driver: {selectedOrder.driver ?? "Unassigned"}
                  </div>
                  {selectedOrder.eta && (
                    <div style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-primary-400)", fontFamily: "var(--wl-font-mono)", marginTop: 4 }}>
                      ETA: {selectedOrder.eta}
                    </div>
                  )}
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Order Info */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--wl-space-3)" }}>
                  <div>
                    <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>Items</div>
                    <div style={{ fontSize: "var(--wl-text-base)", fontWeight: 700, fontFamily: "var(--wl-font-mono)", color: "var(--wl-text-primary)" }}>
                      {selectedOrder.items}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>Total</div>
                    <div style={{ fontSize: "var(--wl-text-base)", fontWeight: 700, fontFamily: "var(--wl-font-mono)", color: "var(--wl-success-400)" }}>
                      {formatCurrency(selectedOrder.amount)}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "var(--wl-space-2)", flexWrap: "wrap", marginTop: "var(--wl-space-2)" }}>
                  <Button variant="primary" size="sm">Assign Driver</Button>
                  <Button variant="secondary" size="sm">Edit Order</Button>
                  <Button variant="ghost" size="sm">View Tracking</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
