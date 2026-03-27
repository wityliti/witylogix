"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { formatCurrency, formatRelativeTime, cn } from "@/lib/utils";
import { useApiList } from "@/hooks/use-api";

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

type DeliveryMethod =
  | "LOCAL_DELIVERY"
  | "STORE_PICKUP"
  | "STANDARD_SHIPPING"
  | "EXPRESS_SHIPPING"
  | "SAME_DAY";

interface Shipment {
  id: string;
  shipmentNumber: string;
  orderId: string;
  status: ShipmentStatus;
  deliveryMethod: DeliveryMethod;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  addressLine1: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  driver: { id: string; name: string; phone: string } | null;
  location: { id: string; name: string; city: string } | null;
  weight: number | null;
  itemCount: number;
  shippingCost: number | null;
  codAmount: number | null;
  trackingNumber: string | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  estimatedArrival: string | null;
  order: { id: string; shopifyOrderNumber: string | null } | null;
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

const DELIVERY_METHODS: {
  key: DeliveryMethod | "ALL";
  label: string;
  icon: string;
}[] = [
  { key: "ALL", label: "All Methods", icon: "📦" },
  { key: "SAME_DAY", label: "Same Day", icon: "⚡" },
  { key: "EXPRESS_SHIPPING", label: "Express", icon: "🚀" },
  { key: "STANDARD_SHIPPING", label: "Standard", icon: "📬" },
  { key: "LOCAL_DELIVERY", label: "Local", icon: "🚗" },
  { key: "STORE_PICKUP", label: "Pickup", icon: "🏪" },
];

const statusVariant = (
  s: string,
): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const map: Record<
    string,
    "success" | "warning" | "danger" | "info" | "primary" | "default"
  > = {
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
  return map[method] ?? "📦";
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

export default function ShipmentsPage() {
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "ALL">(
    "ALL",
  );
  const [methodFilter, setMethodFilter] = useState<DeliveryMethod | "ALL">(
    "ALL",
  );
  const [search, setSearch] = useState("");
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(
    null,
  );

  const {
    items: shipments,
    loading,
    error,
    refetch,
    pagination,
    setPage,
    setSearch: setApiSearch,
  } = useApiList<Shipment>("/api/v4/shipments", { limit: 50 });

  const filtered = useMemo(() => {
    return shipments.filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (methodFilter !== "ALL" && s.deliveryMethod !== methodFilter)
        return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.shipmentNumber.toLowerCase().includes(q) ||
          (s.order?.shopifyOrderNumber?.toLowerCase().includes(q) ?? false) ||
          (s.recipientName?.toLowerCase().includes(q) ?? false) ||
          (s.addressLine1?.toLowerCase().includes(q) ?? false) ||
          (s.city?.toLowerCase().includes(q) ?? false) ||
          (s.trackingNumber?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [shipments, statusFilter, methodFilter, search]);

  const stats = useMemo(() => {
    const total = pagination.total;
    const inTransit = shipments.filter(
      (s) =>
        s.status === "IN_TRANSIT" || s.status === "OUT_FOR_DELIVERY",
    ).length;
    const delivered = shipments.filter(
      (s) => s.status === "DELIVERED",
    ).length;
    const failed = shipments.filter((s) => s.status === "FAILED").length;
    const revenue =
      Math.round(
        shipments.reduce((sum, s) => sum + (Number(s.shippingCost) || 0), 0) *
          100,
      ) / 100;

    return { total, inTransit, delivered, failed, revenue };
  }, [shipments, pagination.total]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Shipments"
        subtitle={`${stats.total} total · ${stats.inTransit} in transit`}
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
            label="Delivered"
            value={stats.delivered}
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
            label="Shipping Revenue"
            value={formatCurrency(stats.revenue)}
            accentColor="var(--wl-success-400)"
            index={4}
          />
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-4">
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
                "placeholder:text-gray-500 transition-colors",
              )}
            />
          </div>

          <div className="flex gap-4 flex-wrap">
            {STATUS_FILTERS.map((f) => {
              const count =
                f.key === "ALL"
                  ? shipments.length
                  : shipments.filter((s) => s.status === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-all",
                    statusFilter === f.key
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-transparent text-gray-400 border-[#1e1e2e] hover:border-[#2a2a3e]",
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
                ? shipments.length
                : shipments.filter((s) => s.deliveryMethod === m.key).length;
            return (
              <button
                key={m.key}
                onClick={() => setMethodFilter(m.key)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 rounded border text-xs font-semibold cursor-pointer transition-all",
                  methodFilter === m.key
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-transparent text-gray-400 border-[#1e1e2e] hover:border-[#2a2a3e]",
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
        <div
          className={cn(
            "grid gap-5",
            selectedShipment ? "grid-cols-[1fr_400px]" : "grid-cols-1",
          )}
        >
          {/* Shipments Table */}
          <Card
            className={cn(
              "bg-[#12121a] border-[#1e1e2e] overflow-hidden p-0",
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {[
                      "Tracking#",
                      "Shipment#",
                      "Recipient",
                      "Status",
                      "Method",
                      "Driver/Location",
                      "Items",
                      "Cost",
                      "ETA",
                    ].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          "text-left p-4 text-xs font-semibold text-gray-400",
                          "uppercase tracking-wider border-b border-[#1e1e2e]",
                          "bg-[#1a1a2e] sticky top-0 whitespace-nowrap",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((shipment) => (
                    <tr
                      key={shipment.id}
                      onClick={() =>
                        setSelectedShipment(
                          selectedShipment?.id === shipment.id
                            ? null
                            : shipment,
                        )
                      }
                      className={cn(
                        "border-b border-[#1e1e2e] cursor-pointer transition-all",
                        selectedShipment?.id === shipment.id
                          ? "bg-amber-500/10"
                          : "hover:bg-[#1a1a2e]",
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
                                      : "bg-blue-500/20 text-blue-400",
                                )}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Shipment Number */}
                      <td className="p-4 font-mono font-medium text-white">
                        {shipment.shipmentNumber}
                      </td>

                      {/* Recipient Name */}
                      <td className="p-4 text-white font-medium max-w-40 truncate">
                        {shipment.recipientName ?? "—"}
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
                      <td
                        className={cn(
                          "p-4 text-xs whitespace-nowrap",
                          shipment.driver?.name || shipment.location?.name
                            ? "text-gray-400"
                            : "text-gray-500 italic",
                        )}
                      >
                        {shipment.driver?.name ??
                          shipment.location?.name ??
                          "—"}
                      </td>

                      {/* Items */}
                      <td className="p-4 font-mono text-xs text-gray-400 text-center">
                        {shipment.itemCount}
                      </td>

                      {/* Cost */}
                      <td className="p-4 font-mono font-semibold text-white">
                        {shipment.shippingCost
                          ? formatCurrency(Number(shipment.shippingCost))
                          : "—"}
                      </td>

                      {/* ETA */}
                      <td
                        className={cn(
                          "p-4 font-mono text-xs",
                          shipment.estimatedArrival &&
                            new Date(shipment.estimatedArrival) > new Date()
                            ? "text-blue-400"
                            : "text-gray-500",
                        )}
                      >
                        {shipment.estimatedArrival
                          ? formatRelativeTime(shipment.estimatedArrival)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="p-8 text-center text-gray-500 text-sm"
                      >
                        No shipments found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Shipment Detail Panel */}
          {selectedShipment && (
            <Card
              className={cn(
                "bg-[#12121a] border-[#1e1e2e] sticky top-24 max-h-[calc(100vh-var(--wl-header-height)-var(--wl-space-12))] overflow-y-auto",
              )}
            >
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg font-bold font-mono text-blue-400">
                      {selectedShipment.trackingNumber ??
                        selectedShipment.shipmentNumber}
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
                      {selectedShipment.recipientName ?? "—"}
                    </div>
                    {selectedShipment.recipientEmail && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {selectedShipment.recipientEmail}
                      </div>
                    )}
                    {selectedShipment.recipientPhone && (
                      <div className="text-xs text-gray-400 font-mono">
                        {selectedShipment.recipientPhone}
                      </div>
                    )}
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
                      <span>
                        {deliveryMethodIcon(selectedShipment.deliveryMethod)}
                      </span>
                      {selectedShipment.deliveryMethod.replace(/_/g, " ")}
                    </div>
                    {(selectedShipment.driver?.name ||
                      selectedShipment.location?.name) && (
                      <div className="text-xs text-gray-500 mt-1">
                        {selectedShipment.driver?.name &&
                          `Driver: ${selectedShipment.driver.name}`}
                        {selectedShipment.location?.name &&
                          `Location: ${selectedShipment.location.name}`}
                      </div>
                    )}
                    {selectedShipment.estimatedArrival && (
                      <div className="text-xs text-gray-400 mt-2">
                        ETA:{" "}
                        {formatRelativeTime(selectedShipment.estimatedArrival)}
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
                          statusProgression.indexOf(
                            selectedShipment.status,
                          ) >= idx;
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
                                    : "bg-[#1e1e2e]",
                                )}
                              />
                              {idx < statusProgression.length - 1 && (
                                <div
                                  className={cn(
                                    "w-0.5 h-6",
                                    isCompleted
                                      ? "bg-emerald-400"
                                      : "bg-[#1e1e2e]",
                                  )}
                                />
                              )}
                            </div>
                            <div
                              className={cn(
                                "text-xs py-0.5",
                                isCompleted ? "text-white" : "text-gray-500",
                                isCurrent ? "font-semibold" : "font-medium",
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
                      <div className="text-xs text-gray-500">Items</div>
                      <div className="text-base font-bold font-mono text-white">
                        {selectedShipment.itemCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Weight</div>
                      <div className="text-base font-bold font-mono text-gray-400">
                        {selectedShipment.weight
                          ? `${selectedShipment.weight} kg`
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Shipping Cost</div>
                      <div className="text-base font-bold font-mono text-emerald-400">
                        {selectedShipment.shippingCost
                          ? formatCurrency(Number(selectedShipment.shippingCost))
                          : "—"}
                      </div>
                    </div>
                    {selectedShipment.codAmount && (
                      <div className="col-span-3">
                        <div className="text-xs text-gray-500">COD Amount</div>
                        <div className="text-base font-bold font-mono text-amber-400">
                          {formatCurrency(Number(selectedShipment.codAmount))}
                        </div>
                      </div>
                    )}
                  </div>

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

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPage(pagination.page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-400 self-center">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
