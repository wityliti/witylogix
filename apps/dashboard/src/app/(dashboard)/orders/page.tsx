"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

      <div className="p-6">
        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-4 mb-5">
          {/* Search */}
          <div className="flex-1 min-w-[300px] max-w-[400px]">
            <input
              type="text"
              placeholder="Search orders, customers, addresses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-wl-text-primary text-sm font-sans outline-none"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => {
              const count = f.key === "ALL" ? ORDERS.length : ORDERS.filter((o) => o.status === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-all",
                    statusFilter === f.key
                      ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                      : "bg-transparent text-wl-text-tertiary border-wl-border-default"
                  )}
                >
                  {f.label}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders Grid + Detail */}
        <div className={cn(
          "grid gap-5",
          selectedOrder ? "grid-cols-[1fr_400px]" : "grid-cols-1"
        )}>
          {/* Orders Table */}
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["Order", "Customer", "Status", "Driver", "Address", "Items", "Amount", "ETA"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wide border-b border-wl-border-subtle bg-wl-bg-surface sticky top-0 whitespace-nowrap"
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
                      className={cn(
                        "border-b border-wl-border-subtle cursor-pointer transition-colors",
                        selectedOrder?.id === order.id
                          ? "bg-[rgba(245,166,35,0.06)]"
                          : "bg-transparent"
                      )}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-wl-primary-400 text-xs whitespace-nowrap">
                        {order.shopifyOrderNumber}
                        {order.tags.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {order.tags.map((t) => (
                              <span
                                key={t}
                                className={cn(
                                  "text-xs py-0.5 px-1 rounded font-semibold uppercase tracking-wider",
                                  t === "priority"
                                    ? "bg-[var(--wl-danger-bg)] text-wl-danger-400"
                                    : t === "express"
                                      ? "bg-[rgba(245,166,35,0.12)] text-wl-primary-400"
                                      : "bg-[var(--wl-info-bg)] text-wl-info-400"
                                )}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-wl-text-primary font-medium">
                        {order.customer}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(order.status)} dot>
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className={cn(
                        "px-4 py-3",
                        order.driver ? "text-wl-text-secondary" : "text-wl-text-tertiary italic"
                      )}>
                        {order.driver ?? "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-wl-text-secondary max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                        {order.address}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-wl-text-secondary text-center">
                        {order.items}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-wl-text-primary">
                        {formatCurrency(order.amount)}
                      </td>
                      <td className={cn("px-4 py-3 font-mono text-xs", order.eta ? "text-wl-primary-400" : "text-wl-text-tertiary")}>
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
              className="wl-animate-in sticky overflow-y-auto"
              style={{
                top: "calc(var(--wl-header-height) + var(--wl-space-6))",
                maxHeight: "calc(100vh - var(--wl-header-height) - var(--wl-space-12))",
              }}
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-lg font-bold font-mono text-wl-primary-400">
                    {selectedOrder.shopifyOrderNumber}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="bg-none border-none text-wl-text-tertiary cursor-pointer text-lg font-sans"
                >
                  ✕
                </button>
              </div>

              <Badge variant={statusVariant(selectedOrder.status)} dot className="mb-4">
                {selectedOrder.status.replace(/_/g, " ")}
              </Badge>

              <div className="flex flex-col gap-4">
                {/* Customer Info */}
                <div>
                  <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
                    Customer
                  </div>
                  <div className="text-base font-semibold text-wl-text-primary">
                    {selectedOrder.customer}
                  </div>
                  <div className="text-xs text-wl-text-secondary mt-0.5">
                    {selectedOrder.email}
                  </div>
                  <div className="text-xs text-wl-text-secondary font-mono">
                    {selectedOrder.phone}
                  </div>
                </div>

                <div className="h-px bg-wl-border-subtle" />

                {/* Delivery Details */}
                <div>
                  <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
                    Delivery
                  </div>
                  <div className="text-sm text-wl-text-secondary mb-1">
                    {selectedOrder.address}
                  </div>
                  {selectedOrder.timeSlot && (
                    <div className="text-xs text-wl-text-tertiary">
                      Time Slot: {selectedOrder.timeSlot}
                    </div>
                  )}
                  <div className="text-xs text-wl-text-tertiary">
                    Driver: {selectedOrder.driver ?? "Unassigned"}
                  </div>
                  {selectedOrder.eta && (
                    <div className="text-sm font-semibold text-wl-primary-400 font-mono mt-1">
                      ETA: {selectedOrder.eta}
                    </div>
                  )}
                </div>

                <div className="h-px bg-wl-border-subtle" />

                {/* Order Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-wl-text-tertiary">Items</div>
                    <div className="text-base font-bold font-mono text-wl-text-primary">
                      {selectedOrder.items}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-wl-text-tertiary">Total</div>
                    <div className="text-base font-bold font-mono text-wl-success-400">
                      {formatCurrency(selectedOrder.amount)}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-2">
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
