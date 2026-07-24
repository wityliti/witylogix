"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import { useApiList } from "@/hooks/use-api";
import {
  Truck,
  Package,
  RefreshCw,
  MapPin,
  LayoutList,
  Map,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  User,
} from "lucide-react";
import type { DeliveryMapShipment } from "./components/delivery-map-view";

// ── Types ─────────────────────────────────────────────────────

interface Shipment {
  id: string;
  shipmentNumber: string;
  trackingNumber?: string | null;
  status: string;
  deliveryMethod?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
  deliveryLocation?: { lat: number; lng: number } | null;
  deliveryDate?: string | null;
  estimatedArrival?: string | null;
  actualDelivery?: string | null;
  attemptCount?: number;
  order?: {
    id: string;
    externalOrderNumber?: string | null;
    customerName?: string | null;
  } | null;
  driver?: {
    id: string;
    name: string;
    phone: string;
  } | null;
  createdAt: string;
}

// ── Status helpers ────────────────────────────────────────────

const API_TO_DISPLAY: Record<string, string> = {
  PENDING: "pending",
  PROCESSING: "pending",
  READY_FOR_PICKUP: "pending",
  PICKED_UP: "in-transit",
  IN_TRANSIT: "in-transit",
  OUT_FOR_DELIVERY: "in-transit",
  ARRIVED: "in-transit",
  DELIVERED: "delivered",
  FAILED: "failed",
  FAILED_ATTEMPT: "failed",
  RETURNED: "failed",
  CANCELLED: "failed",
};

const STATUS_FILTER_MAP: Record<string, string | undefined> = {
  all: undefined,
  pending: "PENDING",
  "in-transit": "IN_TRANSIT",
  delivered: "DELIVERED",
  failed: "FAILED",
};

function displayStatus(s: string): string {
  return API_TO_DISPLAY[s] ?? s.toLowerCase();
}

function statusVariant(
  s: string,
): "success" | "primary" | "warning" | "danger" | "default" {
  switch (displayStatus(s)) {
    case "delivered":
      return "success";
    case "in-transit":
      return "primary";
    case "pending":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "default";
  }
}

function formatAddress(s: Shipment): string {
  const parts = [s.addressLine1, s.city, s.province].filter(Boolean);
  return parts.join(", ") || "—";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Lazy-load map to avoid SSR issues ─────────────────────────

const DeliveryMapView = dynamic(
  () => import("./components/delivery-map-view"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-600 border-t-white animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Loading map…</p>
        </div>
      </div>
    ),
  },
);

// ── Skeleton ──────────────────────────────────────────────────

function DeliverySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl bg-wl-bg-surface border border-wl-border-default p-4 h-24 animate-pulse"
        />
      ))}
    </div>
  );
}

// ── Selected shipment detail panel ────────────────────────────

function ShipmentDetailPanel({
  shipment,
  onClose,
}: {
  shipment: Shipment;
  onClose: () => void;
}) {
  return (
    <Card className="mt-4 bg-wl-bg-surface border border-wl-border-default">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white text-base">
              {shipment.shipmentNumber}
            </h3>
            <p className="text-sm text-zinc-400 mt-0.5">
              {shipment.order?.customerName ??
                shipment.recipientName ??
                "Unknown recipient"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(shipment.status)}>
              {displayStatus(shipment.status).replace("-", " ")}
            </Badge>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors text-xs px-2 py-1 rounded border border-zinc-700"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
              Delivery Address
            </p>
            <p className="text-zinc-200">{formatAddress(shipment)}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
              Est. Delivery
            </p>
            <p className="text-zinc-200">
              {formatDate(shipment.estimatedArrival ?? shipment.deliveryDate)}
            </p>
          </div>
          {shipment.driver && (
            <div>
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
                Driver
              </p>
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-zinc-400" />
                <p className="text-zinc-200">{shipment.driver.name}</p>
              </div>
            </div>
          )}
          {shipment.trackingNumber && (
            <div>
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
                Tracking #
              </p>
              <p className="text-zinc-200 font-mono text-xs">
                {shipment.trackingNumber}
              </p>
            </div>
          )}
          {shipment.order?.externalOrderNumber && (
            <div>
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
                Order
              </p>
              <p className="text-zinc-200">
                #{shipment.order.externalOrderNumber}
              </p>
            </div>
          )}
          {(shipment.attemptCount ?? 0) > 0 && (
            <div>
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
                Attempts
              </p>
              <p className="text-zinc-200">{shipment.attemptCount}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────

type ViewMode = "list" | "map";

const STATUS_TABS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In Transit", value: "in-transit" },
  { label: "Delivered", value: "delivered" },
  { label: "Failed", value: "failed" },
];

export default function DeliveryPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const apiStatus = STATUS_FILTER_MAP[statusFilter];

  const {
    items: shipments,
    loading,
    error,
    refetch,
  } = useApiList<Shipment>("/api/v4/shipments", {
    limit: 100,
    ...(apiStatus ? { status: apiStatus } : {}),
  });

  // Client-side filter for sub-statuses not directly filterable by API
  const filtered = useMemo(() => {
    if (statusFilter === "all") return shipments;
    return shipments.filter((s) => displayStatus(s.status) === statusFilter);
  }, [shipments, statusFilter]);

  const selectedShipment = selectedId
    ? (shipments.find((s) => s.id === selectedId) ?? null)
    : null;

  // Stats
  const stats = useMemo(
    () => ({
      total: shipments.length,
      pending: shipments.filter((s) =>
        ["pending"].includes(displayStatus(s.status)),
      ).length,
      inTransit: shipments.filter(
        (s) => displayStatus(s.status) === "in-transit",
      ).length,
      delivered: shipments.filter(
        (s) => displayStatus(s.status) === "delivered",
      ).length,
      failed: shipments.filter((s) => displayStatus(s.status) === "failed")
        .length,
      withLocation: shipments.filter((s) => s.deliveryLocation?.lat != null)
        .length,
    }),
    [shipments],
  );

  // Map data (typed for the dynamic component)
  const mapShipments: DeliveryMapShipment[] = useMemo(
    () =>
      filtered.map((s) => ({
        id: s.id,
        shipmentNumber: s.shipmentNumber,
        status: s.status,
        recipientName: s.recipientName,
        addressLine1: s.addressLine1,
        city: s.city,
        deliveryLocation: s.deliveryLocation,
        order: s.order,
      })),
    [filtered],
  );

  return (
    <>
      <Header
        title="Deliveries"
        subtitle="Track and manage all delivery operations"
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-wl-border-subtle overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
                  viewMode === "list"
                    ? "bg-wl-primary text-white"
                    : "text-wl-text-secondary hover:text-wl-text-primary",
                )}
                aria-pressed={viewMode === "list"}
                aria-label="List view"
              >
                <LayoutList className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={cn(
                  "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
                  viewMode === "map"
                    ? "bg-wl-primary text-white"
                    : "text-wl-text-secondary hover:text-wl-text-primary",
                )}
                aria-pressed={viewMode === "map"}
                aria-label="Map view"
              >
                <Map className="w-4 h-4" />
                <span className="hidden sm:inline">Map</span>
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={refetch}
              disabled={loading}
              aria-label="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>

            <Button variant="primary" size="sm">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">New Delivery</span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* ── Stat cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="In Transit"
            value={loading ? "—" : stats.inTransit}
            icon={<Truck className="w-5 h-5" />}
            accentColor="var(--wl-primary-500)"
          />
          <StatCard
            label="Pending"
            value={loading ? "—" : stats.pending}
            icon={<Clock className="w-5 h-5" />}
            accentColor="#f59e0b"
          />
          <StatCard
            label="Delivered"
            value={loading ? "—" : stats.delivered}
            icon={<CheckCircle className="w-5 h-5" />}
            accentColor="#10b981"
          />
          <StatCard
            label="Failed"
            value={loading ? "—" : stats.failed}
            icon={<XCircle className="w-5 h-5" />}
            accentColor="#ef4444"
          />
        </div>

        {/* ── Status filter tabs ───────────────────────────────── */}
        <div
          className="flex gap-1 flex-wrap"
          role="tablist"
          aria-label="Filter by delivery status"
        >
          {STATUS_TABS.map((tab) => {
            const count =
              tab.value === "all"
                ? stats.total
                : tab.value === "pending"
                  ? stats.pending
                  : tab.value === "in-transit"
                    ? stats.inTransit
                    : tab.value === "delivered"
                      ? stats.delivered
                      : stats.failed;
            return (
              <button
                key={tab.value}
                role="tab"
                aria-selected={statusFilter === tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  statusFilter === tab.value
                    ? "bg-wl-primary text-white"
                    : "bg-wl-bg-elevated text-wl-text-secondary hover:text-wl-text-primary border border-wl-border-subtle",
                )}
              >
                {tab.label}
                {!loading && (
                  <span className="ml-1.5 text-xs opacity-70">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Content ──────────────────────────────────────────── */}
        {loading && shipments.length === 0 ? (
          <DeliverySkeleton />
        ) : error && shipments.length === 0 ? (
          <ErrorState
            title="Failed to load deliveries"
            message={error.message}
            onRetry={refetch}
          />
        ) : viewMode === "map" ? (
          /* ── MAP VIEW ─────────────────────────────────────── */
          <div>
            <div className="h-[520px]">
              <DeliveryMapView
                shipments={mapShipments}
                selectedId={selectedId}
                onSelect={(id) =>
                  setSelectedId((prev) => (prev === id ? null : id))
                }
              />
            </div>
            {selectedShipment && (
              <ShipmentDetailPanel
                shipment={selectedShipment}
                onClose={() => setSelectedId(null)}
              />
            )}
            {stats.withLocation === 0 && !loading && (
              <p className="text-center text-sm text-zinc-500 mt-4">
                No deliveries have geographic coordinates yet. Coordinates are
                set when drivers confirm delivery or when the address is
                geocoded.
              </p>
            )}
          </div>
        ) : filtered.length === 0 ? (
          /* ── EMPTY STATE ──────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-wl-border-subtle bg-wl-bg-elevated">
            <div className="w-14 h-14 rounded-full bg-wl-bg-surface flex items-center justify-center">
              <Truck className="w-7 h-7 text-wl-text-tertiary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-wl-text-secondary">
                No deliveries found
              </p>
              <p className="text-xs text-wl-text-tertiary mt-1">
                {statusFilter === "all"
                  ? "Create your first delivery to get started"
                  : `No ${statusFilter.replace("-", " ")} deliveries`}
              </p>
            </div>
            <Button variant="primary" size="sm">
              <Package className="w-4 h-4" />
              New Delivery
            </Button>
          </div>
        ) : (
          /* ── LIST VIEW ────────────────────────────────────── */
          <div className="space-y-2" role="list" aria-label="Delivery list">
            {filtered.map((shipment) => (
              <button
                key={shipment.id}
                role="listitem"
                onClick={() =>
                  setSelectedId((prev) =>
                    prev === shipment.id ? null : shipment.id,
                  )
                }
                className={cn(
                  "w-full text-left rounded-xl border transition-colors",
                  "bg-wl-bg-surface hover:bg-wl-bg-elevated",
                  selectedId === shipment.id
                    ? "border-wl-primary/60"
                    : "border-wl-border-default hover:border-wl-border-strong",
                )}
                aria-pressed={selectedId === shipment.id}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Header row */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-semibold text-white text-sm">
                          {shipment.order?.customerName ??
                            shipment.recipientName ??
                            "Unknown recipient"}
                        </span>
                        <Badge
                          variant={statusVariant(shipment.status)}
                          size="sm"
                        >
                          {displayStatus(shipment.status).replace("-", " ")}
                        </Badge>
                      </div>

                      {/* Shipment number */}
                      <p className="text-xs text-zinc-500 mb-1.5 font-mono">
                        {shipment.shipmentNumber}
                        {shipment.order?.externalOrderNumber &&
                          ` · Order #${shipment.order.externalOrderNumber}`}
                      </p>

                      {/* Address + driver */}
                      <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap">
                        {(shipment.addressLine1 || shipment.city) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {formatAddress(shipment)}
                          </span>
                        )}
                        {shipment.driver && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 flex-shrink-0" />
                            {shipment.driver.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: date + chevron */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        {(shipment.estimatedArrival ??
                        shipment.deliveryDate) ? (
                          <>
                            <p className="text-xs font-medium text-zinc-300">
                              {formatDate(
                                shipment.estimatedArrival ??
                                  shipment.deliveryDate,
                              )}
                            </p>
                            <p className="text-[10px] text-zinc-600">
                              {shipment.actualDelivery
                                ? "Delivered"
                                : "Est. delivery"}
                            </p>
                          </>
                        ) : (
                          <p className="text-[10px] text-zinc-600">No date</p>
                        )}
                      </div>
                      <ChevronRight
                        className={cn(
                          "w-4 h-4 text-zinc-600 transition-transform",
                          selectedId === shipment.id && "rotate-90",
                        )}
                      />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selected detail panel (list view) */}
        {viewMode === "list" && selectedShipment && (
          <ShipmentDetailPanel
            shipment={selectedShipment}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </>
  );
}
