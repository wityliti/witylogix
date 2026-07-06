"use client";

import { useMemo, useState } from "react";
import {
  X,
  AlertCircle,
  MapPin,
  Package,
  User,
  DollarSign,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  LocationInfo,
  PackageSpec,
  RecipientInfo,
} from "@witylogix/core/integrations/couriers";

interface Courier {
  id: string;
  name: string;
  partner: "onfleet" | "stuart" | "uber";
  status: "idle" | "en-route" | "delivering" | "returning" | "unavailable";
  currentLoad: number;
  maxCapacity: number;
  rating: number;
  completedToday: number;
  phone: string;
  serviceArea?: string;
}

interface Delivery {
  id: string;
  orderId: string;
  pickup: LocationInfo;
  dropoff: LocationInfo;
  package?: PackageSpec;
  recipient?: RecipientInfo;
}

interface CourierAssignmentPanelProps {
  delivery: Delivery;
  couriers: Courier[];
  onAssign: (courierId: string) => void;
  onClose: () => void;
}

interface CourierCost {
  courierId: string;
  baseCost: number;
  surgePricing: number;
  totalCost: number;
  estimatedMinutes: number;
}

interface ConflictWarning {
  courierId: string;
  type: "capacity" | "service_area" | "unavailable";
  message: string;
  severity: "warning" | "error";
}

export function CourierAssignmentPanel({
  delivery,
  couriers,
  onAssign,
  onClose,
}: CourierAssignmentPanelProps) {
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(
    couriers[0]?.id || null,
  );
  const [isAssigning, setIsAssigning] = useState(false);

  const distance = useMemo(() => {
    const latDiff = Math.abs(
      delivery.dropoff.latitude - delivery.pickup.latitude,
    );
    const lonDiff = Math.abs(
      delivery.dropoff.longitude - delivery.pickup.longitude,
    );
    return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111; // approx km (Euclidean)
  }, [delivery]);

  // Calculate costs per courier
  const courierCosts = useMemo<CourierCost[]>(() => {
    return couriers.map((courier) => {
      const baseCost = Math.round((distance * 1.5 + 2.5) * 100) / 100; // $1.50/km + base fee
      const surgePricing =
        courier.status === "delivering"
          ? Math.round(baseCost * 0.15 * 100) / 100
          : 0;
      const estimatedMinutes = Math.round(distance * 2.5 + 5); // 2.5 min/km + 5 min base

      return {
        courierId: courier.id,
        baseCost,
        surgePricing,
        totalCost: baseCost + surgePricing,
        estimatedMinutes,
      };
    });
  }, [couriers, distance]);

  // Identify conflicts
  const conflicts = useMemo<ConflictWarning[]>(() => {
    return couriers
      .map((courier) => {
        const warnings: ConflictWarning[] = [];

        // Capacity check
        if (courier.currentLoad >= courier.maxCapacity) {
          warnings.push({
            courierId: courier.id,
            type: "capacity",
            message: "Courier at maximum capacity",
            severity: "error",
          });
        }

        // Unavailable check
        if (courier.status === "unavailable") {
          warnings.push({
            courierId: courier.id,
            type: "unavailable",
            message: "Courier temporarily unavailable",
            severity: "error",
          });
        }

        return warnings;
      })
      .flat();
  }, [couriers]);

  const handleAssign = async (courierId: string) => {
    setIsAssigning(true);
    try {
      await onAssign(courierId);
    } finally {
      setIsAssigning(false);
    }
  };

  const getPartnerLogo = (partner: Courier["partner"]): string => {
    switch (partner) {
      case "onfleet":
        return "🟢";
      case "stuart":
        return "🟠";
      case "uber":
        return "🔵";
      default:
        return "•";
    }
  };

  const getCapacityColor = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage >= 100) return "bg-wl-danger-400";
    if (percentage >= 80) return "bg-wl-warning-400";
    return "bg-wl-success-400";
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-wl-bg-primary border-l border-wl-border-subtle shadow-lg flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-wl-border-subtle">
        <h3 className="font-semibold text-wl-text-primary">Assign Courier</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-wl-bg-overlay rounded-md transition-colors"
        >
          <X className="w-4 h-4 text-wl-text-tertiary" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {/* Delivery Summary */}
        <div className="bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-3 space-y-2">
          <h4 className="font-semibold text-sm text-wl-text-primary">
            {delivery.orderId}
          </h4>
          <div className="space-y-2 text-xs text-wl-text-secondary">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-wl-text-primary">Pickup</p>
                <p className="line-clamp-1">{delivery.pickup.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-wl-text-primary">Dropoff</p>
                <p className="line-clamp-1">{delivery.dropoff.address}</p>
              </div>
            </div>
            {delivery.package && (
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 flex-shrink-0" />
                <span>
                  {delivery.package.weight
                    ? `${delivery.package.weight}kg`
                    : ""}
                  {delivery.package.itemCount
                    ? `, ${delivery.package.itemCount} items`
                    : ""}
                </span>
              </div>
            )}
            {delivery.recipient && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 flex-shrink-0" />
                <span>{delivery.recipient.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>{distance.toFixed(1)} km away</span>
            </div>
          </div>
        </div>

        {/* Available Couriers */}
        <div>
          <h4 className="font-semibold text-sm text-wl-text-primary mb-3">
            Available Couriers
          </h4>
          <div className="space-y-2">
            {couriers.map((courier) => {
              const cost = courierCosts.find((c) => c.courierId === courier.id);
              const courierConflicts = conflicts.filter(
                (c) => c.courierId === courier.id,
              );
              const hasErrors = courierConflicts.some(
                (c) => c.severity === "error",
              );
              const isSelected = selectedCourierId === courier.id;

              return (
                <div
                  key={courier.id}
                  onClick={() => !hasErrors && setSelectedCourierId(courier.id)}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all duration-200",
                    isSelected
                      ? "bg-wl-primary-500/10 border-wl-primary-400"
                      : "bg-wl-bg-surface border-wl-border-subtle hover:border-wl-border-default",
                    hasErrors && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {/* Courier Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-lg">
                        {getPartnerLogo(courier.partner)}
                      </span>
                      <div>
                        <p className="font-semibold text-sm text-wl-text-primary">
                          {courier.name}
                        </p>
                        <p className="text-xs text-wl-text-secondary">
                          {courier.completedToday} deliveries today
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-wl-warning-400">
                        ★
                      </span>
                      <span className="text-xs font-medium text-wl-text-secondary">
                        {courier.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Status & Capacity */}
                  <div className="space-y-2 mb-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-wl-text-secondary">
                        Capacity: {courier.currentLoad}/{courier.maxCapacity}
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          getCapacityColor(
                            courier.currentLoad,
                            courier.maxCapacity,
                          ).includes("danger") && "text-wl-danger-400",
                          getCapacityColor(
                            courier.currentLoad,
                            courier.maxCapacity,
                          ).includes("warning") && "text-wl-warning-400",
                          getCapacityColor(
                            courier.currentLoad,
                            courier.maxCapacity,
                          ).includes("success") && "text-wl-success-400",
                        )}
                      >
                        {Math.round(
                          (courier.currentLoad / courier.maxCapacity) * 100,
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-wl-bg-overlay rounded-full h-2 overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          getCapacityColor(
                            courier.currentLoad,
                            courier.maxCapacity,
                          ),
                        )}
                        style={{
                          width: `${Math.min((courier.currentLoad / courier.maxCapacity) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Cost & ETA */}
                  {cost && (
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <div className="flex items-center gap-1 text-wl-text-secondary">
                        <DollarSign className="w-4 h-4" />
                        <span>${cost.totalCost.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-wl-text-secondary">
                        <Clock className="w-4 h-4" />
                        <span>{cost.estimatedMinutes} min</span>
                      </div>
                    </div>
                  )}

                  {/* Conflicts */}
                  {courierConflicts.length > 0 && (
                    <div className="space-y-1">
                      {courierConflicts.map((conflict) => (
                        <div
                          key={`${courier.id}-${conflict.type}`}
                          className={cn(
                            "flex items-start gap-2 p-2 rounded text-xs",
                            conflict.severity === "error"
                              ? "bg-wl-danger-bg text-wl-danger-400"
                              : "bg-wl-warning-bg text-wl-warning-400",
                          )}
                        >
                          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span>{conflict.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer - Actions */}
      <div className="border-t border-wl-border-subtle p-4 space-y-2">
        <Button
          variant="primary"
          className="w-full"
          disabled={!selectedCourierId || isAssigning}
          onClick={() => selectedCourierId && handleAssign(selectedCourierId)}
        >
          {isAssigning ? "Assigning..." : "Assign Courier"}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={onClose}
          disabled={isAssigning}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
