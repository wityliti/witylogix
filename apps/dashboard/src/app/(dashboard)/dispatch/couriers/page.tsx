"use client";

import { useState, useCallback, useMemo } from "react";
import { MoreVertical, MapPin, Package, Clock, AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourierLiveMap } from "@/components/couriers/courier-live-map";
import { DeliveryTimeline } from "@/components/couriers/delivery-timeline";
import { CourierAssignmentPanel } from "@/components/couriers/courier-assignment-panel";
import { DispatchStatsBar } from "@/components/couriers/dispatch-stats-bar";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { LoadingSkeleton, ErrorState } from "@/components/ui/loading";
import { DeliveryStatus } from "@witylogix/core/integrations/couriers";
import type {
  DriverPosition,
  LocationInfo,
  PackageSpec,
  RecipientInfo,
} from "@witylogix/core/integrations/couriers";

// Types for the dispatch console
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

interface DeliveryEvent {
  id: string;
  type: "requested" | "assigned" | "pickup" | "in_transit" | "delivered";
  timestamp: Date;
  courierName?: string;
  location?: LocationInfo;
  notes?: string;
}

export default function CourierDispatchPage() {
  const { items: couriers, loading: couriersLoading, error: couriersError, refetch: refetchCouriers } = useApiList<Courier>('/api/v4/couriers');
  const { items: deliveries, loading: deliveriesLoading, error: deliveriesError, refetch: refetchDeliveries } = useApiList<Delivery>('/api/v4/deliveries');
  const { execute: assignDelivery, loading: assigningLoading } = useApiMutation<Delivery>('PATCH', '/api/v4/deliveries/:id/assign');

  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false);
  const [dispatchStrategy, setDispatchStrategy] = useState<"cheapest" | "fastest" | "preferred" | "auto">("auto");
  const [isDispatching, setIsDispatching] = useState(false);

  interface DispatchStats {
    activeCouriers: number;
    pendingDeliveries: number;
    inTransitCount: number;
    completedToday: number;
    avgDeliveryTime: number;
    onTimePercentage: number;
  }

  // Calculate dispatch stats
  const stats = useMemo<DispatchStats>(() => {
    const activeCouriers = couriers.filter((c) => c.status !== "idle").length;
    const pendingDeliveries = deliveries.filter((d) => d.status === "pending").length;
    const inTransitCount = deliveries.filter((d) => d.status === "in_transit").length;
    const completedToday = deliveries.filter((d) => d.status === "delivered").length;
    const avgDeliveryTime = deliveries
      .filter((d) => d.deliveredAt && d.createdAt)
      .reduce((sum, d) => sum + ((d.deliveredAt!.getTime() - d.createdAt.getTime()) / 60000), 0) / Math.max(1, completedToday);
    const onTimeCount = deliveries.filter(
      (d) => d.status === "delivered" && d.estimatedDeliveryTime && d.deliveredAt && d.deliveredAt <= d.estimatedDeliveryTime
    ).length;
    const onTimePercentage = completedToday > 0 ? (onTimeCount / completedToday) * 100 : 100;

    return {
      activeCouriers,
      pendingDeliveries,
      inTransitCount,
      completedToday,
      avgDeliveryTime: Math.round(avgDeliveryTime),
      onTimePercentage: Math.round(onTimePercentage),
    };
  }, [deliveries, couriers]);

  // Handle auto-dispatch
  const handleAutoDispatch = useCallback(async () => {
    setIsDispatching(true);
    const pendingDelivery = deliveries.find((d) => d.status === "pending");
    if (pendingDelivery && couriers.length > 0) {
      const assignedCourier = couriers.find((c) => c.status === "idle") || couriers[0];
      try {
        await assignDelivery({ courierId: assignedCourier.id });
        setSelectedDelivery(pendingDelivery);
        refetchDeliveries();
      } catch (err) {
        console.error("Auto-dispatch failed:", err);
      }
    }
    setIsDispatching(false);
  }, [deliveries, couriers, assignDelivery, refetchDeliveries]);

  // Handle manual assignment
  const handleAssignDelivery = useCallback(async (courierId: string) => {
    if (!selectedDelivery) return;

    try {
      await assignDelivery({ courierId });
      setAssignmentPanelOpen(false);
      refetchDeliveries();
    } catch (err) {
      console.error("Assignment failed:", err);
    }
  }, [selectedDelivery, assignDelivery, refetchDeliveries]);

  // Get pending deliveries for left panel
  const pendingDeliveries = useMemo(
    () => deliveries.filter((d) => d.status === DeliveryStatus.PENDING || d.status === DeliveryStatus.PICKED_UP),
    [deliveries]
  );

  // Get active couriers for assignment
  const availableCouriers = useMemo(
    () => couriers.filter((c) => c.currentLoad < c.maxCapacity),
    [couriers]
  );

  if (couriersError || deliveriesError) {
    return <ErrorState message={(couriersError || deliveriesError)?.message ?? "Failed to load data"} onRetry={() => { refetchCouriers(); refetchDeliveries(); }} />;
  }

  const getStatusBadgeVariant = (status: DeliveryStatus) => {
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
  };

  const getStatusLabel = (status: DeliveryStatus) => {
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
  };

  const getCourierStatusColor = (status: Courier["status"]) => {
    switch (status) {
      case "idle":
        return "text-wl-text-tertiary";
      case "en-route":
        return "text-wl-info-400";
      case "delivering":
        return "text-wl-warning-400";
      case "returning":
        return "text-wl-text-secondary";
      default:
        return "text-wl-text-tertiary";
    }
  };

  if (couriersLoading || deliveriesLoading) {
    return <LoadingSkeleton type="list" />;
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f]">
      {/* Stats Bar */}
      <DispatchStatsBar stats={stats} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden gap-6 p-6">
        {/* Left Panel - Deliveries Queue */}
        <div className="flex flex-col w-96 gap-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Pending Deliveries
              <span className="ml-2 text-sm font-medium text-gray-300">
                ({pendingDeliveries.length})
              </span>
            </h2>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAutoDispatch}
              disabled={isDispatching || stats.pendingDeliveries === 0}
              className="gap-1"
            >
              <Zap className="w-4 h-4" />
              {isDispatching ? "Dispatching..." : "Auto Dispatch"}
            </Button>
          </div>

          {/* Deliveries List */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {pendingDeliveries.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <p>No pending deliveries</p>
              </div>
            ) : (
              pendingDeliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  onClick={() => {
                    setSelectedDelivery(delivery);
                    if (delivery.status === "pending") {
                      setAssignmentPanelOpen(true);
                    }
                  }}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-all duration-200",
                    "hover:border-[#1e1e2e] hover:bg-[#12121a]",
                    selectedDelivery?.id === delivery.id
                      ? "bg-blue-500/10 border-blue-400"
                      : "bg-[#12121a] border-[#1e1e2e]"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-white text-sm">
                        {delivery.orderId}
                      </p>
                      <p className="text-xs text-gray-300 mt-1">
                        {delivery.recipient?.name || "Unknown Recipient"}
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(delivery.status)} className="ml-2">
                      {getStatusLabel(delivery.status)}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs text-gray-300">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{delivery.dropoff.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      <span>{delivery.package?.itemCount || 1} items</span>
                    </div>
                    {delivery.courierId && (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-blue-500" />
                        <span>
                          {couriers.find((c) => c.id === delivery.courierId)?.name || "Unassigned"}
                        </span>
                      </div>
                    )}
                  </div>

                  {delivery.status === "pending" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full mt-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignmentPanelOpen(true);
                      }}
                    >
                      Assign Courier
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Map and Details */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Map */}
          <div className="flex-1 rounded-lg border border-[#1e1e2e] overflow-hidden bg-[#12121a]">
            <CourierLiveMap couriers={couriers} deliveries={deliveries} selectedDeliveryId={selectedDelivery?.id} />
          </div>

          {/* Selected Delivery Details */}
          {selectedDelivery && (
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white">Delivery Details</h3>
                  <p className="text-xs text-gray-300 mt-1">{selectedDelivery.orderId}</p>
                </div>
                <button className="p-1 hover:bg-[#0a0a0f] rounded-md transition-colors">
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <DeliveryTimeline delivery={selectedDelivery} />
            </div>
          )}
        </div>

        {/* Assignment Panel - Drawer on right */}
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
