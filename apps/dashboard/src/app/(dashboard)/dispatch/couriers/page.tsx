"use client";

import { useState, useCallback, useMemo } from "react";
import { MapPin, Package, Zap, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DispatchLiveMap } from "@/components/dispatch/dispatch-live-map";
import { DeliveryTimeline } from "@/components/couriers/delivery-timeline";
import { CourierAssignmentPanel } from "@/components/couriers/courier-assignment-panel";
import { DispatchStatsBar } from "@/components/couriers/dispatch-stats-bar";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingSkeleton } from "@/components/ui/loading";
import { DeliveryStatus } from "@witylogix/core/integrations/couriers";
import type {
  DriverPosition,
  LocationInfo,
  PackageSpec,
  RecipientInfo,
} from "@witylogix/core/integrations/couriers";

// ── Types ────────────────────────────────────────────────────

interface Courier {
  id: string;
  name: string;
  partner: "onfleet" | "stuart" | "uber";
  status: "idle" | "en-route" | "delivering" | "returning";
  currentLoad: number;
  maxCapacity: number;
  rating: number;
  location: DriverPosition;
  currentDeliveryId?: string;
  completedToday: number;
  phone: string;
}

interface DeliveryEvent {
  id: string;
  type: "requested" | "assigned" | "pickup" | "in_transit" | "delivered";
  timestamp: Date;
  courierName?: string;
  location?: LocationInfo;
  notes?: string;
}

interface Delivery {
  id: string;
  orderId: string;
  courierId?: string;
  status: DeliveryStatus;
  pickup: LocationInfo;
  dropoff: LocationInfo;
  package?: PackageSpec;
  recipient?: RecipientInfo;
  createdAt: Date;
  assignedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  estimatedDeliveryTime?: Date;
  notes?: string;
  timeline: DeliveryEvent[];
}

// ── Helpers ──────────────────────────────────────────────────

function getStatusBadgeVariant(
  status: DeliveryStatus,
): "default" | "info" | "warning" | "success" | "danger" {
  switch (status) {
    case "pending":
      return "default";
    case "picked_up":
      return "info";
    case "in_transit":
      return "warning";
    case "delivered":
      return "success";
    case "failed":
    case "cancelled":
      return "danger";
    default:
      return "default";
  }
}

function getStatusLabel(status: DeliveryStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "picked_up":
      return "Picked Up";
    case "in_transit":
      return "In Transit";
    case "delivered":
      return "Delivered";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "returned":
      return "Returned";
    default:
      return status;
  }
}

function courierToDriverStatus(status: Courier["status"]): string {
  switch (status) {
    case "idle":
      return "offline";
    case "en-route":
      return "available";
    case "delivering":
      return "busy";
    case "returning":
      return "break";
    default:
      return "offline";
  }
}

function deliveryToOrderStatus(status: DeliveryStatus): string {
  switch (status) {
    case "pending":
      return "PENDING";
    case "picked_up":
      return "PICKED_UP";
    case "in_transit":
      return "OUT_FOR_DELIVERY";
    case "delivered":
      return "DELIVERED";
    default:
      return "PENDING";
  }
}

// ── Delivery Card ─────────────────────────────────────────────

interface DeliveryCardProps {
  delivery: Delivery;
  couriers: Courier[];
  isSelected: boolean;
  onSelect: (d: Delivery) => void;
  onAssign: () => void;
}

function DeliveryCard({
  delivery,
  couriers,
  isSelected,
  onSelect,
  onAssign,
}: DeliveryCardProps) {
  const courier = couriers.find((c) => c.id === delivery.courierId);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={() => onSelect(delivery)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(delivery);
      }}
      className={cn(
        "p-4 rounded-lg border cursor-pointer transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        "hover:border-zinc-600 hover:bg-zinc-800/60",
        isSelected
          ? "bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/25"
          : "bg-zinc-800/40 border-zinc-700",
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">
            {delivery.orderId}
          </p>
          <p className="text-xs text-zinc-300 mt-0.5 truncate">
            {delivery.recipient?.name ?? "Unknown Recipient"}
          </p>
        </div>
        <Badge
          variant={getStatusBadgeVariant(delivery.status)}
          className="ml-2 flex-shrink-0 text-xs"
        >
          {getStatusLabel(delivery.status)}
        </Badge>
      </div>

      <div className="space-y-1.5 text-xs text-zinc-400 mb-3">
        <div className="flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-zinc-500" />
          <span className="line-clamp-1">{delivery.dropoff.address}</span>
        </div>
        <div className="flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-zinc-500" />
          <span>
            {delivery.package?.itemCount ?? 1} item
            {(delivery.package?.itemCount ?? 1) !== 1 ? "s" : ""}
          </span>
        </div>
        {courier && (
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex-shrink-0" />
            <span className="text-blue-300">{courier.name}</span>
          </div>
        )}
      </div>

      {delivery.status === "pending" && (
        <Button
          variant="secondary"
          size="sm"
          className="w-full text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(delivery);
            onAssign();
          }}
        >
          Assign Courier
        </Button>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────

function SkeletonCard({ height = "h-28" }: { height?: string }) {
  return <div className={cn(height, "bg-zinc-800 rounded-lg animate-pulse")} />;
}

// ── Main Page ─────────────────────────────────────────────────

export default function CourierDispatchPage() {
  const {
    items: couriers,
    loading: couriersLoading,
    error: couriersError,
    refetch: refetchCouriers,
  } = useApiList<Courier>("/api/v4/couriers");

  const {
    items: deliveries,
    loading: deliveriesLoading,
    error: deliveriesError,
    refetch: refetchDeliveries,
  } = useApiList<Delivery>("/api/v4/deliveries");

  const { execute: assignDelivery } = useApiMutation<Delivery>(
    "PATCH",
    "/api/v4/deliveries/:id/assign",
  );

  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(
    null,
  );
  const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // Stats
  const stats = useMemo(() => {
    const activeCouriers = couriers.filter((c) => c.status !== "idle").length;
    const pendingDeliveries = deliveries.filter(
      (d) => d.status === "pending",
    ).length;
    const inTransitCount = deliveries.filter(
      (d) => d.status === "in_transit",
    ).length;
    const completedToday = deliveries.filter(
      (d) => d.status === "delivered",
    ).length;
    const avgDeliveryTime =
      deliveries
        .filter((d) => d.deliveredAt && d.createdAt)
        .reduce((sum, d) => {
          const ms =
            new Date(d.deliveredAt!).getTime() -
            new Date(d.createdAt).getTime();
          return sum + ms / 60000;
        }, 0) / Math.max(1, completedToday);
    const onTimeCount = deliveries.filter(
      (d) =>
        d.status === "delivered" &&
        d.estimatedDeliveryTime &&
        d.deliveredAt &&
        new Date(d.deliveredAt) <= new Date(d.estimatedDeliveryTime),
    ).length;
    const onTimePercentage =
      completedToday > 0
        ? Math.round((onTimeCount / completedToday) * 100)
        : 100;

    return {
      activeCouriers,
      pendingDeliveries,
      inTransitCount,
      completedToday,
      avgDeliveryTime: Math.round(avgDeliveryTime),
      onTimePercentage,
    };
  }, [deliveries, couriers]);

  const pendingDeliveries = useMemo(
    () =>
      deliveries.filter(
        (d) =>
          d.status === DeliveryStatus.PENDING ||
          d.status === DeliveryStatus.PICKED_UP,
      ),
    [deliveries],
  );

  const availableCouriers = useMemo(
    () => couriers.filter((c) => c.currentLoad < c.maxCapacity),
    [couriers],
  );

  // Map data
  const mapDrivers = useMemo(
    () =>
      couriers.map((c) => ({
        id: c.id,
        name: c.name,
        status: courierToDriverStatus(c.status),
        vehicleType: "car",
        lat: c.location?.latitude ?? null,
        lng: c.location?.longitude ?? null,
        activeDeliveries: c.currentLoad,
      })),
    [couriers],
  );

  const mapOrders = useMemo(
    () =>
      deliveries
        .filter((d) => d.status !== "delivered" && d.status !== "cancelled")
        .map((d) => ({
          id: d.id,
          orderNumber: d.orderId,
          customerName: d.recipient?.name ?? "Unknown",
          address: d.dropoff.address ?? "",
          status: deliveryToOrderStatus(d.status),
          lat: d.dropoff.latitude ?? null,
          lng: d.dropoff.longitude ?? null,
        })),
    [deliveries],
  );

  const handleAutoDispatch = useCallback(async () => {
    setIsDispatching(true);
    const pendingDelivery = deliveries.find((d) => d.status === "pending");
    if (pendingDelivery && couriers.length > 0) {
      const assignedCourier =
        couriers.find((c) => c.status === "idle") ?? couriers[0];
      try {
        await assignDelivery({ courierId: assignedCourier.id });
        setSelectedDelivery(pendingDelivery);
        void refetchDeliveries();
      } catch {
        // auto-dispatch failed
      }
    }
    setIsDispatching(false);
  }, [deliveries, couriers, assignDelivery, refetchDeliveries]);

  const handleAssignDelivery = useCallback(
    async (courierId: string) => {
      if (!selectedDelivery) return;
      try {
        await assignDelivery({ courierId });
        setAssignmentPanelOpen(false);
        void refetchDeliveries();
      } catch {
        // assignment failed
      }
    },
    [selectedDelivery, assignDelivery, refetchDeliveries],
  );

  const handleRefresh = useCallback(() => {
    void refetchCouriers();
    void refetchDeliveries();
  }, [refetchCouriers, refetchDeliveries]);

  if (couriersError || deliveriesError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <ErrorState
          message={
            (couriersError ?? deliveriesError)?.message ?? "Failed to load data"
          }
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  const isLoading = couriersLoading || deliveriesLoading;

  if (isLoading) {
    return <LoadingSkeleton type="list" />;
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">
      {/* Stats Bar */}
      <DispatchStatsBar stats={stats} isLoading={isLoading} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden gap-0 min-h-0">
        {/* Left Panel — Deliveries Queue */}
        <div className="flex flex-col w-80 flex-shrink-0 bg-zinc-900 border-r border-zinc-800 overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-800/30">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">
                Pending Deliveries
              </h2>
              <Badge variant="danger" className="text-[10px] px-1.5">
                {pendingDeliveries.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                onClick={handleRefresh}
                aria-label="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAutoDispatch}
                disabled={isDispatching || stats.pendingDeliveries === 0}
                className="h-7 gap-1 text-xs px-2.5"
              >
                <Zap className="w-3 h-3" />
                {isDispatching ? "Dispatching…" : "Auto"}
              </Button>
            </div>
          </div>

          {/* Deliveries List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {couriersLoading || deliveriesLoading ? (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} height="h-28" />
                ))}
              </>
            ) : pendingDeliveries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12 text-center">
                <Package className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm font-medium">No pending deliveries</p>
              </div>
            ) : (
              pendingDeliveries.map((delivery) => (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                  couriers={couriers}
                  isSelected={selectedDelivery?.id === delivery.id}
                  onSelect={(d) =>
                    setSelectedDelivery(
                      selectedDelivery?.id === d.id ? null : d,
                    )
                  }
                  onAssign={() => setAssignmentPanelOpen(true)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right — Map + Details */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
          {/* Map area */}
          <div className="flex-1 min-h-0 relative">
            {/* Map header overlay */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-zinc-900/90 border-b border-zinc-800 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Live Courier Map
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                <span>
                  <span className="text-white font-semibold">
                    {couriers.filter((c) => c.status !== "idle").length}
                  </span>{" "}
                  active
                </span>
                <span>
                  <span className="text-white font-semibold">
                    {stats.inTransitCount}
                  </span>{" "}
                  in transit
                </span>
                {selectedDelivery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDelivery(null);
                      setAssignmentPanelOpen(false);
                    }}
                    className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>
            </div>

            <DispatchLiveMap
              drivers={mapDrivers}
              orders={mapOrders}
              selectedOrderId={selectedDelivery?.id ?? null}
              onOrderClick={(id) => {
                const d = deliveries.find((del) => del.id === id);
                if (d) {
                  setSelectedDelivery(selectedDelivery?.id === id ? null : d);
                }
              }}
              isLoading={isLoading}
              className="w-full h-full pt-10"
            />
          </div>

          {/* Selected Delivery Details */}
          {selectedDelivery && (
            <div className="flex-shrink-0 bg-zinc-900 border-t border-zinc-800 max-h-56 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Delivery Details
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {selectedDelivery.orderId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedDelivery.status === "pending" && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setAssignmentPanelOpen(true)}
                      >
                        Assign Courier
                      </Button>
                    )}
                    <button
                      type="button"
                      className="p-1 hover:bg-zinc-800 rounded-md transition-colors"
                      onClick={() => setSelectedDelivery(null)}
                      aria-label="Close delivery details"
                    >
                      <X className="w-4 h-4 text-zinc-400" />
                    </button>
                  </div>
                </div>
                <DeliveryTimeline delivery={selectedDelivery} />
              </div>
            </div>
          )}
        </div>

        {/* Assignment Panel — slide-in from right */}
        {assignmentPanelOpen && selectedDelivery && (
          <CourierAssignmentPanel
            delivery={selectedDelivery}
            couriers={availableCouriers}
            onAssign={handleAssignDelivery}
            onClose={() => setAssignmentPanelOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
