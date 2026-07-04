"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { formatCurrency, formatRelativeTime, cn } from "@/lib/utils";
import { useApiList } from "@/hooks/use-api";
import {
  statusVariant,
  type Shipment,
  type ShipmentStatus,
  type DeliveryMethod,
} from "@/components/shipments/shipment-utils";
import dynamic from "next/dynamic";

// ── Dynamic map import (avoids SSR issues with maplibre-gl) ─────────────────
const ShipmentsMapView = dynamic(
  () => import("@/components/shipments/shipments-map-view"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full bg-wl-bg-surface rounded-xl border border-wl-border-default animate-pulse flex items-center justify-center">
        <p className="text-sm text-wl-text-tertiary">Loading map…</p>
      </div>
    ),
  },
);

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { key: ShipmentStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
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
  { key: "ALL", label: "All Methods", icon: "P" },
  { key: "SAME_DAY", label: "Same Day", icon: "S" },
  { key: "EXPRESS_SHIPPING", label: "Express", icon: "E" },
  { key: "STANDARD_SHIPPING", label: "Standard", icon: "T" },
  { key: "LOCAL_DELIVERY", label: "Local", icon: "L" },
  { key: "STORE_PICKUP", label: "Pickup", icon: "K" },
];

const DELIVERY_METHOD_ICONS: Record<DeliveryMethod, string> = {
  SAME_DAY: "⚡",
  EXPRESS_SHIPPING: "🚀",
  STANDARD_SHIPPING: "📬",
  LOCAL_DELIVERY: "🚗",
  STORE_PICKUP: "🏪",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function deliveryMethodIcon(method: DeliveryMethod): string {
  return DELIVERY_METHOD_ICONS[method] ?? "📦";
}

// ── Loading skeleton ───────────────────────────────────────────────────────

function ShipmentsTableSkeleton() {
  return (
    <Card className="bg-wl-bg-surface border-wl-border-default overflow-hidden p-0">
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
                  className="text-left p-4 text-xs font-semibold text-wl-text-secondary uppercase tracking-wider border-b border-wl-border-default bg-wl-bg-elevated sticky top-0 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-wl-border-default">
                {Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="p-4">
                    <Skeleton variant="text" className="h-4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Map Legend ─────────────────────────────────────────────────────────────

function MapLegend() {
  const items = [
    { label: "Pending / Processing", colorClass: "bg-blue-400" },
    { label: "Picked Up / In Transit", colorClass: "bg-amber-400" },
    { label: "Out for Delivery / Arrived", colorClass: "bg-emerald-400" },
    { label: "Delivered", colorClass: "bg-emerald-500" },
    { label: "Failed / Cancelled", colorClass: "bg-red-500" },
  ];
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
        Map Legend
      </p>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <div
            className={cn(
              "w-3 h-3 rounded-full flex-shrink-0",
              item.colorClass,
            )}
          />
          <span className="text-xs text-wl-text-secondary">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Map sidebar shipment card ──────────────────────────────────────────────

interface MapShipmentCardProps {
  shipment: Shipment;
  onClose: () => void;
  onView: () => void;
}

function MapShipmentCard({ shipment, onClose, onView }: MapShipmentCardProps) {
  return (
    <Card className="bg-wl-bg-surface border-wl-border-default">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-mono font-bold text-blue-400 text-sm">
              {shipment.trackingNumber ?? shipment.shipmentNumber}
            </div>
            <div className="text-xs text-wl-text-tertiary mt-0.5">
              {shipment.shipmentNumber}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-wl-text-tertiary hover:text-white transition-colors flex-shrink-0 text-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <Badge variant={statusVariant(shipment.status)}>
          {shipment.status.replace(/_/g, " ")}
        </Badge>

        <div className="space-y-3">
          <div>
            <div className="text-xs text-wl-text-tertiary mb-0.5">
              Recipient
            </div>
            <div className="text-sm font-semibold text-white">
              {shipment.recipientName ?? "—"}
            </div>
          </div>

          <div>
            <div className="text-xs text-wl-text-tertiary mb-0.5">
              Delivery Address
            </div>
            <div className="text-xs text-wl-text-secondary leading-snug">
              {[shipment.addressLine1, shipment.city, shipment.province]
                .filter(Boolean)
                .join(", ")}
            </div>
          </div>

          {shipment.driver?.name && (
            <div>
              <div className="text-xs text-wl-text-tertiary mb-0.5">Driver</div>
              <div className="text-xs text-wl-neutral-300">
                {shipment.driver.name}
              </div>
            </div>
          )}

          {shipment.estimatedArrival && (
            <div>
              <div className="text-xs text-wl-text-tertiary mb-0.5">ETA</div>
              <div className="text-xs text-blue-400 font-mono">
                {formatRelativeTime(shipment.estimatedArrival)}
              </div>
            </div>
          )}
        </div>

        <Button variant="primary" size="sm" className="w-full" onClick={onView}>
          View Full Details
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function ShipmentsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "ALL">(
    "ALL",
  );
  const [methodFilter, setMethodFilter] = useState<DeliveryMethod | "ALL">(
    "ALL",
  );
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const {
    items: shipments,
    loading,
    error,
    refetch,
    pagination,
    setPage,
  } = useApiList<Shipment>("/api/v4/shipments", { limit: 50 });

  // Client-side filter on top of server-fetched batch
  const filtered = useMemo(() => {
    return shipments.filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (methodFilter !== "ALL" && s.deliveryMethod !== methodFilter)
        return false;
      if (search) {
        const q = search.toLowerCase();
        const orderNum =
          s.order?.externalOrderNumber ?? s.order?.shopifyOrderNumber;
        return (
          s.shipmentNumber.toLowerCase().includes(q) ||
          (orderNum?.toLowerCase().includes(q) ?? false) ||
          (s.recipientName?.toLowerCase().includes(q) ?? false) ||
          (s.addressLine1?.toLowerCase().includes(q) ?? false) ||
          (s.city?.toLowerCase().includes(q) ?? false) ||
          (s.trackingNumber?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [shipments, statusFilter, methodFilter, search]);

  // Only shipments with valid coords can appear on the map
  const mappableShipments = useMemo(
    () =>
      filtered.filter(
        (s) =>
          s.deliveryLocation != null &&
          typeof s.deliveryLocation.lat === "number" &&
          typeof s.deliveryLocation.lng === "number",
      ),
    [filtered],
  );

  const stats = useMemo(() => {
    const total = pagination.total;
    const inTransit = shipments.filter(
      (s) => s.status === "IN_TRANSIT" || s.status === "OUT_FOR_DELIVERY",
    ).length;
    const delivered = shipments.filter((s) => s.status === "DELIVERED").length;
    const failed = shipments.filter((s) => s.status === "FAILED").length;
    const revenue =
      Math.round(
        shipments.reduce((sum, s) => sum + (Number(s.shippingCost) || 0), 0) *
          100,
      ) / 100;
    return { total, inTransit, delivered, failed, revenue };
  }, [shipments, pagination.total]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleShipmentClick = (id: string) => {
    setSelectedShipmentId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <Header
        title="Shipments"
        subtitle={`${stats.total} total · ${stats.inTransit} in transit`}
        actions={
          <div className="flex items-center gap-3">
            {/* List / Map toggle */}
            <div className="flex items-center rounded-lg border border-wl-border-default overflow-hidden bg-wl-bg-surface">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold transition-all",
                  viewMode === "list"
                    ? "bg-blue-500 text-white"
                    : "text-wl-text-secondary hover:text-white",
                )}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1",
                  viewMode === "map"
                    ? "bg-blue-500 text-white"
                    : "text-wl-text-secondary hover:text-white",
                )}
              >
                Map
                {mappableShipments.length > 0 && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 rounded-full leading-tight py-0.5",
                      viewMode === "map"
                        ? "bg-white/25 text-white"
                        : "bg-blue-500/20 text-blue-400",
                    )}
                  >
                    {mappableShipments.length}
                  </span>
                )}
              </button>
            </div>
            <Button variant="primary" size="md">
              + New Shipment
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6 bg-wl-bg-root min-h-[calc(100vh-var(--header-height))]">
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
              placeholder="Search shipments, tracking, recipient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full p-2 px-4 bg-wl-bg-surface border border-wl-border-default rounded-md",
                "text-white text-sm font-sans outline-none",
                "focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20",
                "placeholder:text-wl-text-tertiary transition-colors",
              )}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
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
                      : "bg-transparent text-wl-text-secondary border-wl-border-default hover:border-wl-border-strong",
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
        <div className="flex gap-2 flex-wrap">
          {DELIVERY_METHODS.map((m) => {
            const count =
              m.key === "ALL"
                ? shipments.length
                : shipments.filter((s) => s.deliveryMethod === m.key).length;
            const iconMap: Record<string, string> = {
              ALL: "📦",
              SAME_DAY: "⚡",
              EXPRESS_SHIPPING: "🚀",
              STANDARD_SHIPPING: "📬",
              LOCAL_DELIVERY: "🚗",
              STORE_PICKUP: "🏪",
            };
            return (
              <button
                key={m.key}
                onClick={() => setMethodFilter(m.key)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 rounded border text-xs font-semibold cursor-pointer transition-all",
                  methodFilter === m.key
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-transparent text-wl-text-secondary border-wl-border-default hover:border-wl-border-strong",
                )}
              >
                <span>{iconMap[m.key]}</span>
                {m.label}
                <span className="text-xs opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Error State */}
        {error && <ErrorState message={error.message} onRetry={refetch} />}

        {/* ── MAP VIEW ─────────────────────────────────────── */}
        {!error && viewMode === "map" && (
          <>
            {loading ? (
              <div className="h-[560px] bg-wl-bg-surface rounded-xl border border-wl-border-default animate-pulse flex items-center justify-center">
                <p className="text-sm text-wl-text-tertiary">Loading map…</p>
              </div>
            ) : mappableShipments.length === 0 ? (
              <Card className="bg-wl-bg-surface border-wl-border-default">
                <CardContent className="h-[480px] flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="text-3xl">🗺️</div>
                    <p className="text-sm font-semibold text-wl-text-secondary">
                      No mappable shipments
                    </p>
                    <p className="text-xs text-wl-text-tertiary max-w-xs">
                      {filtered.length === 0
                        ? "No shipments match the current filters."
                        : `${filtered.length} shipment(s) matched but none have delivery coordinates.`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
                <div className="h-[560px]">
                  <ShipmentsMapView
                    shipments={mappableShipments}
                    selectedId={selectedShipmentId}
                    onShipmentClick={handleShipmentClick}
                  />
                </div>
                {/* Map sidebar */}
                <div className="h-[560px] overflow-y-auto space-y-3">
                  {selectedShipmentId ? (
                    (() => {
                      const s = mappableShipments.find(
                        (x) => x.id === selectedShipmentId,
                      );
                      if (!s) return null;
                      return (
                        <MapShipmentCard
                          shipment={s}
                          onClose={() => setSelectedShipmentId(null)}
                          onView={() => router.push(`/shipments/${s.id}`)}
                        />
                      );
                    })()
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
                      <div>
                        <p className="text-sm font-semibold text-wl-text-secondary mb-1">
                          {mappableShipments.length} shipments on map
                        </p>
                        <p className="text-xs text-wl-text-tertiary">
                          Click a marker to see details
                        </p>
                      </div>
                      <MapLegend />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── LIST VIEW ────────────────────────────────────── */}
        {!error && viewMode === "list" && (
          <>
            {loading ? (
              <ShipmentsTableSkeleton />
            ) : (
              <Card className="bg-wl-bg-surface border-wl-border-default overflow-hidden p-0">
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
                              "text-left p-4 text-xs font-semibold text-wl-text-secondary",
                              "uppercase tracking-wider border-b border-wl-border-default",
                              "bg-wl-bg-elevated sticky top-0 whitespace-nowrap",
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
                            router.push(`/shipments/${shipment.id}`)
                          }
                          className="border-b border-wl-border-default cursor-pointer transition-all hover:bg-wl-bg-elevated"
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

                          <td className="p-4 font-mono font-medium text-white">
                            {shipment.shipmentNumber}
                          </td>

                          <td className="p-4 text-white font-medium max-w-40 truncate">
                            {shipment.recipientName ?? "—"}
                          </td>

                          <td className="p-4">
                            <Badge variant={statusVariant(shipment.status)}>
                              {shipment.status.replace(/_/g, " ")}
                            </Badge>
                          </td>

                          <td className="p-4 text-wl-text-secondary text-sm whitespace-nowrap">
                            <span className="mr-1">
                              {deliveryMethodIcon(shipment.deliveryMethod)}
                            </span>
                            {shipment.deliveryMethod.replace(/_/g, " ")}
                          </td>

                          <td
                            className={cn(
                              "p-4 text-xs whitespace-nowrap",
                              shipment.driver?.name || shipment.location?.name
                                ? "text-wl-text-secondary"
                                : "text-wl-text-tertiary italic",
                            )}
                          >
                            {shipment.driver?.name ??
                              shipment.location?.name ??
                              "—"}
                          </td>

                          <td className="p-4 font-mono text-xs text-wl-text-secondary text-center">
                            {shipment.itemCount}
                          </td>

                          <td className="p-4 font-mono font-semibold text-white">
                            {shipment.shippingCost
                              ? formatCurrency(Number(shipment.shippingCost))
                              : "—"}
                          </td>

                          <td
                            className={cn(
                              "p-4 font-mono text-xs",
                              shipment.estimatedArrival &&
                                new Date(shipment.estimatedArrival) > new Date()
                                ? "text-blue-400"
                                : "text-wl-text-tertiary",
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
                            className="p-12 text-center text-wl-text-tertiary text-sm"
                          >
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-2xl">📦</span>
                              <span>No shipments found</span>
                              {(statusFilter !== "ALL" ||
                                methodFilter !== "ALL" ||
                                search) && (
                                <button
                                  onClick={() => {
                                    setStatusFilter("ALL");
                                    setMethodFilter("ALL");
                                    setSearch("");
                                  }}
                                  className="text-xs text-blue-400 hover:underline mt-1"
                                >
                                  Clear filters
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

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
                <span className="text-sm text-wl-text-secondary self-center">
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
          </>
        )}
      </div>
    </>
  );
}
