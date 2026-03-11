"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { MoreVertical, MapPin, Package, Clock, AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourierLiveMap } from "@/components/couriers/courier-live-map";
import { DeliveryTimeline } from "@/components/couriers/delivery-timeline";
import { CourierAssignmentPanel } from "@/components/couriers/courier-assignment-panel";
import { DispatchStatsBar } from "@/components/couriers/dispatch-stats-bar";
import type {
  DeliveryStatus,
  DriverPosition,
  LocationInfo,
  PackageSpec,
  RecipientInfo,
} from "@witylogix/core/integrations/couriers";

// Mock types for the dispatch console
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

interface DispatchStats {
  activeCouriers: number;
  pendingDeliveries: number;
  inTransitCount: number;
  completedToday: number;
  avgDeliveryTime: number;
  onTimePercentage: number;
}

// Mock data
const MOCK_COURIERS: Courier[] = [
  {
    id: "courier-1",
    name: "Alex Johnson",
    partner: "onfleet",
    status: "en-route",
    currentLoad: 3,
    maxCapacity: 8,
    rating: 4.8,
    location: { latitude: 40.7128, longitude: -74.006, lastUpdatedAt: new Date() },
    currentDeliveryId: "delivery-1",
    completedToday: 12,
    phone: "+1-555-0101",
  },
  {
    id: "courier-2",
    name: "Maria Garcia",
    partner: "stuart",
    status: "idle",
    currentLoad: 0,
    maxCapacity: 6,
    rating: 4.9,
    location: { latitude: 40.7489, longitude: -73.9680, lastUpdatedAt: new Date() },
    completedToday: 8,
    phone: "+1-555-0102",
  },
  {
    id: "courier-3",
    name: "James Chen",
    partner: "uber",
    status: "delivering",
    currentLoad: 1,
    maxCapacity: 10,
    rating: 4.7,
    location: { latitude: 40.7505, longitude: -73.9972, lastUpdatedAt: new Date() },
    currentDeliveryId: "delivery-2",
    completedToday: 15,
    phone: "+1-555-0103",
  },
];

const MOCK_DELIVERIES: Delivery[] = [
  {
    id: "delivery-1",
    orderId: "ORD-001",
    courierId: "courier-1",
    status: "in_transit",
    pickup: {
      latitude: 40.7128,
      longitude: -74.006,
      address: "123 Main St, New York, NY",
      name: "Warehouse A",
    },
    dropoff: {
      latitude: 40.7489,
      longitude: -73.968,
      address: "456 Park Ave, New York, NY",
      name: "Customer Home",
    },
    package: { weight: 2, itemCount: 1, transportType: "car" },
    recipient: { name: "John Doe", phone: "+1-555-0201" },
    createdAt: new Date(Date.now() - 30 * 60000),
    assignedAt: new Date(Date.now() - 25 * 60000),
    pickedUpAt: new Date(Date.now() - 20 * 60000),
    estimatedDeliveryTime: new Date(Date.now() + 15 * 60000),
    timeline: [
      { id: "e1", type: "requested", timestamp: new Date(Date.now() - 30 * 60000) },
      { id: "e2", type: "assigned", timestamp: new Date(Date.now() - 25 * 60000), courierName: "Alex Johnson" },
      { id: "e3", type: "pickup", timestamp: new Date(Date.now() - 20 * 60000), courierName: "Alex Johnson" },
      { id: "e4", type: "in_transit", timestamp: new Date(Date.now() - 5 * 60000), courierName: "Alex Johnson" },
    ],
  },
  {
    id: "delivery-2",
    orderId: "ORD-002",
    courierId: "courier-3",
    status: "delivered",
    pickup: {
      latitude: 40.7128,
      longitude: -74.006,
      address: "123 Main St, New York, NY",
      name: "Warehouse A",
    },
    dropoff: {
      latitude: 40.7505,
      longitude: -73.9972,
      address: "789 Fifth Ave, New York, NY",
      name: "Office Building",
    },
    package: { weight: 1.5, itemCount: 3, transportType: "car" },
    recipient: { name: "Jane Smith", phone: "+1-555-0202" },
    createdAt: new Date(Date.now() - 120 * 60000),
    assignedAt: new Date(Date.now() - 115 * 60000),
    pickedUpAt: new Date(Date.now() - 110 * 60000),
    deliveredAt: new Date(Date.now() - 5 * 60000),
    timeline: [
      { id: "e5", type: "requested", timestamp: new Date(Date.now() - 120 * 60000) },
      { id: "e6", type: "assigned", timestamp: new Date(Date.now() - 115 * 60000), courierName: "James Chen" },
      { id: "e7", type: "pickup", timestamp: new Date(Date.now() - 110 * 60000), courierName: "James Chen" },
      { id: "e8", type: "in_transit", timestamp: new Date(Date.now() - 50 * 60000), courierName: "James Chen" },
      { id: "e9", type: "delivered", timestamp: new Date(Date.now() - 5 * 60000), courierName: "James Chen" },
    ],
  },
  {
    id: "delivery-3",
    orderId: "ORD-003",
    status: "pending",
    pickup: {
      latitude: 40.7128,
      longitude: -74.006,
      address: "123 Main St, New York, NY",
      name: "Warehouse A",
    },
    dropoff: {
      latitude: 40.7614,
      longitude: -73.9776,
      address: "999 Madison Ave, New York, NY",
      name: "Retail Store",
    },
    package: { weight: 3, itemCount: 5, transportType: "van" },
    recipient: { name: "Bob Wilson", phone: "+1-555-0203" },
    createdAt: new Date(Date.now() - 10 * 60000),
    timeline: [
      { id: "e10", type: "requested", timestamp: new Date(Date.now() - 10 * 60000) },
    ],
  },
];

export default function CourierDispatchPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>(MOCK_DELIVERIES);
  const [couriers, setCouriers] = useState<Courier[]>(MOCK_COURIERS);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(MOCK_DELIVERIES[0]);
  const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false);
  const [dispatchStrategy, setDispatchStrategy] = useState<"cheapest" | "fastest" | "preferred" | "auto">("auto");
  const [isDispatching, setIsDispatching] = useState(false);

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
    // Simulate dispatch API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const pendingDelivery = deliveries.find((d) => d.status === "pending");
    if (pendingDelivery && couriers.length > 0) {
      const assignedCourier = couriers.find((c) => c.status === "idle") || couriers[0];
      setDeliveries((prev) =>
        prev.map((d) =>
          d.id === pendingDelivery.id
            ? {
                ...d,
                courierId: assignedCourier.id,
                status: "assigned",
                assignedAt: new Date(),
                timeline: [
                  ...d.timeline,
                  {
                    id: `e${Math.random()}`,
                    type: "assigned",
                    timestamp: new Date(),
                    courierName: assignedCourier.name,
                  },
                ],
              }
            : d
        )
      );
      setSelectedDelivery(pendingDelivery);
    }
    setIsDispatching(false);
  }, [deliveries, couriers]);

  // Handle manual assignment
  const handleAssignDelivery = useCallback((courierId: string) => {
    if (!selectedDelivery) return;

    const courier = couriers.find((c) => c.id === courierId);
    if (!courier) return;

    setDeliveries((prev) =>
      prev.map((d) =>
        d.id === selectedDelivery.id
          ? {
              ...d,
              courierId,
              status: "assigned",
              assignedAt: new Date(),
              timeline: [
                ...d.timeline,
                {
                  id: `e${Math.random()}`,
                  type: "assigned",
                  timestamp: new Date(),
                  courierName: courier.name,
                },
              ],
            }
          : d
      )
    );

    setAssignmentPanelOpen(false);
  }, [selectedDelivery, couriers]);

  // Get pending deliveries for left panel
  const pendingDeliveries = useMemo(
    () => deliveries.filter((d) => d.status === "pending" || d.status === "assigned"),
    [deliveries]
  );

  // Get active couriers for assignment
  const availableCouriers = useMemo(
    () => couriers.filter((c) => c.currentLoad < c.maxCapacity),
    [couriers]
  );

  const getStatusBadgeVariant = (status: DeliveryStatus) => {
    switch (status) {
      case "pending":
        return "default";
      case "assigned":
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

  return (
    <div className="flex flex-col h-screen bg-wl-bg-primary">
      {/* Stats Bar */}
      <DispatchStatsBar stats={stats} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden gap-6 p-6">
        {/* Left Panel - Deliveries Queue */}
        <div className="flex flex-col w-96 gap-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-wl-text-primary">
              Pending Deliveries
              <span className="ml-2 text-sm font-medium text-wl-text-secondary">
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
              <div className="flex items-center justify-center h-32 text-wl-text-tertiary">
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
                    "hover:border-wl-border-default hover:bg-wl-bg-elevated",
                    selectedDelivery?.id === delivery.id
                      ? "bg-wl-primary-500/10 border-wl-primary-400"
                      : "bg-wl-bg-surface border-wl-border-subtle"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-wl-text-primary text-sm">
                        {delivery.orderId}
                      </p>
                      <p className="text-xs text-wl-text-secondary mt-1">
                        {delivery.recipient?.name || "Unknown Recipient"}
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(delivery.status)} className="ml-2">
                      {getStatusLabel(delivery.status)}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs text-wl-text-secondary">
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
                        <div className="w-4 h-4 rounded-full bg-wl-primary-500" />
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
          <div className="flex-1 rounded-lg border border-wl-border-subtle overflow-hidden bg-wl-bg-surface">
            <CourierLiveMap couriers={couriers} deliveries={deliveries} selectedDeliveryId={selectedDelivery?.id} />
          </div>

          {/* Selected Delivery Details */}
          {selectedDelivery && (
            <div className="bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-wl-text-primary">Delivery Details</h3>
                  <p className="text-xs text-wl-text-secondary mt-1">{selectedDelivery.orderId}</p>
                </div>
                <button className="p-1 hover:bg-wl-bg-overlay rounded-md transition-colors">
                  <MoreVertical className="w-4 h-4 text-wl-text-tertiary" />
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
