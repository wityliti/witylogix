"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { MapPin, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeliveryMap } from "@/components/maps/delivery-map";
import { DeliverySidebar } from "@/components/maps/delivery-sidebar";
import { useMapTracking } from "@/hooks/use-map-tracking";
import type {
import { useApiList } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
  Driver,
  Delivery,
  DriverStatus,
  DeliveryStatus,
} from "@/components/maps/delivery-types";

/**
 * Live Delivery Tracking Page
 *
 * Real-time map-based delivery tracking with live driver and delivery updates.
 * Features:
 * - Full-screen Mapbox GL map with 70% width
 * - Sidebar (30% width) with active deliveries list
 * - Driver markers colored by status (green=available, blue=en-route, orange=delivering, gray=offline)
 * - Delivery point markers (pickup/dropoff/completed)
 * - Animated route polylines
 * - Driver popover with details on click
 * - Real-time position updates via WebSocket
 * - Clustering at low zoom levels
 */
export default function TrackingPage() {
  const { items, loading, error, refetch, pagination } = useApiList<TrackingInfo>('/api/v4/tracking');

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  // State
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(
    null
  );
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time tracking hook
  const { subscribe, unsubscribe, onPositionUpdate, disconnect } =
    useMapTracking();

  // Initialize tracking
  useEffect(() => {
    const initTracking = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Mock data - replace with API call in production
        const mockDrivers: Driver[] = [
          {
            id: "driver-1",
            name: "Alex Johnson",
            photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
            status: "en-route" as DriverStatus,
            location: { latitude: 40.7128, longitude: -74.006 },
            speed: 25,
            phone: "+1-555-0101",
            currentDeliveryId: "delivery-1",
            eta: new Date(Date.now() + 15 * 60000),
          },
          {
            id: "driver-2",
            name: "Maria García",
            photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
            status: "delivering" as DriverStatus,
            location: { latitude: 40.7489, longitude: -73.9680 },
            speed: 8,
            phone: "+1-555-0102",
            currentDeliveryId: "delivery-2",
            eta: new Date(Date.now() + 8 * 60000),
          },
          {
            id: "driver-3",
            name: "David Chen",
            photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
            status: "available" as DriverStatus,
            location: { latitude: 40.7614, longitude: -73.9776 },
            speed: 0,
            phone: "+1-555-0103",
            currentDeliveryId: null,
            eta: null,
          },
          {
            id: "driver-4",
            name: "James Wilson",
            photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=James",
            status: "offline" as DriverStatus,
            location: { latitude: 40.7505, longitude: -73.9972 },
            speed: 0,
            phone: "+1-555-0104",
            currentDeliveryId: null,
            eta: null,
          },
        ];

        const mockDeliveries: Delivery[] = [
          {
            id: "delivery-1",
            orderId: "ORD-2024-001",
            customerId: "cust-1",
            customerName: "John Smith",
            driverId: "driver-1",
            status: "en-route" as DeliveryStatus,
            pickupAddress: "123 Main St, New York, NY",
            dropoffAddress: "456 Park Ave, New York, NY",
            pickupLocation: { latitude: 40.7128, longitude: -74.006 },
            dropoffLocation: { latitude: 40.7489, longitude: -73.968 },
            eta: new Date(Date.now() + 15 * 60000),
            progress: 45,
            createdAt: new Date(Date.now() - 30 * 60000),
          },
          {
            id: "delivery-2",
            orderId: "ORD-2024-002",
            customerId: "cust-2",
            customerName: "Sarah Johnson",
            driverId: "driver-2",
            status: "delivering" as DeliveryStatus,
            pickupAddress: "789 Broadway, New York, NY",
            dropoffAddress: "321 5th Ave, New York, NY",
            pickupLocation: { latitude: 40.7489, longitude: -73.968 },
            dropoffLocation: { latitude: 40.7614, longitude: -73.9776 },
            eta: new Date(Date.now() + 8 * 60000),
            progress: 85,
            createdAt: new Date(Date.now() - 45 * 60000),
          },
          {
            id: "delivery-3",
            orderId: "ORD-2024-003",
            customerId: "cust-3",
            customerName: "Michael Brown",
            driverId: "driver-1",
            status: "pending" as DeliveryStatus,
            pickupAddress: "555 Madison Ave, New York, NY",
            dropoffAddress: "777 Park Ave, New York, NY",
            pickupLocation: { latitude: 40.7505, longitude: -73.9972 },
            dropoffLocation: { latitude: 40.7614, longitude: -73.9776 },
            eta: new Date(Date.now() + 45 * 60000),
            progress: 0,
            createdAt: new Date(Date.now() - 10 * 60000),
          },
          {
            id: "delivery-4",
            orderId: "ORD-2024-004",
            customerId: "cust-4",
            customerName: "Emily Davis",
            driverId: null,
            status: "pending" as DeliveryStatus,
            pickupAddress: "999 Lexington Ave, New York, NY",
            dropoffAddress: "111 Madison Ave, New York, NY",
            pickupLocation: { latitude: 40.7549, longitude: -73.975 },
            dropoffLocation: { latitude: 40.7128, longitude: -74.006 },
            eta: null,
            progress: 0,
            createdAt: new Date(Date.now() - 5 * 60000),
          },
        ];

        setDrivers(mockDrivers);
        setDeliveries(mockDeliveries);

        // Subscribe to real-time updates
        await subscribe("tracking:active");
        onPositionUpdate((driver) => {
          setDrivers((prev) =>
            prev.map((d) => (d.id === driver.id ? driver : d))
          );
        });

        setIsLoading(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load tracking data";
        setError(message);
        setIsLoading(false);
      }
    };

    initTracking();

    return () => {
      unsubscribe("tracking:active");
      disconnect();
    };
  }, [subscribe, unsubscribe, onPositionUpdate, disconnect]);

  // Handler for driver selection
  const handleSelectDriver = useCallback((driverId: string) => {
    setSelectedDriverId(driverId);

    // Auto-select current delivery if any
    const driver = drivers.find((d) => d.id === driverId);
    if (driver?.currentDeliveryId) {
      setSelectedDeliveryId(driver.currentDeliveryId);
    }
  }, [drivers]);

  // Handler for delivery selection
  const handleSelectDelivery = useCallback((deliveryId: string) => {
    setSelectedDeliveryId(deliveryId);

    // Auto-select driver if assigned
    const delivery = deliveries.find((d) => d.id === deliveryId);
    if (delivery?.driverId) {
      setSelectedDriverId(delivery.driverId);
    }
  }, [deliveries]);

  // Count active deliveries
  const activeDeliveriesCount = useMemo(
    () =>
      deliveries.filter((d) => d.status !== "completed" && d.status !== "cancelled").length,
    [deliveries]
  );

  // Count online drivers
  const onlineDriversCount = useMemo(
    () => drivers.filter((d) => d.status !== "offline").length,
    [drivers]
  );

  return (
    <div className={cn(
      "flex h-screen w-full overflow-hidden",
      "bg-wl-bg-surface"
    )}>
      {/* Error State */}
      {error && (
        <div className={cn(
          "absolute inset-0 z-50 flex items-center justify-center",
          "bg-black/50"
        )}>
          <div className={cn(
            "rounded-lg p-6 max-w-md",
            "bg-wl-bg-elevated border border-wl-border-strong"
          )}>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-wl-danger-400 mt-0.5 flex-shrink-0" />
              <div>
                <h2 className="font-semibold text-wl-text-primary mb-1">
                  Tracking Error
                </h2>
                <p className="text-sm text-wl-text-secondary">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className={cn(
        "absolute top-0 left-0 right-0 z-40",
        "bg-gradient-to-b from-wl-bg-surface to-transparent",
        "px-6 py-4 pointer-events-none"
      )}>
        <div className={cn(
          "flex gap-4 text-sm pointer-events-auto",
          "max-w-2xl"
        )}>
          <div className="flex items-center gap-2 text-wl-text-secondary">
            <MapPin className="w-4 h-4 text-wl-primary-400" />
            <span>
              <span className="text-wl-text-primary font-semibold">
                {onlineDriversCount}
              </span>
              /{drivers.length} Drivers Online
            </span>
          </div>
          <div className="flex items-center gap-2 text-wl-text-secondary">
            <span>
              <span className="text-wl-text-primary font-semibold">
                {activeDeliveriesCount}
              </span>
              /{deliveries.length} Active Deliveries
            </span>
          </div>
        </div>
      </div>

      {/* Main Content: Map (70%) + Sidebar (30%) */}
      <div className="flex flex-1 gap-4 p-4 pt-20">
        {/* Map Container */}
        <div className={cn(
          "flex-1 basis-7/10 rounded-lg overflow-hidden",
          "border border-wl-border-default",
          "shadow-lg"
        )}>
          {isLoading ? (
            <div className={cn(
              "w-full h-full flex items-center justify-center",
              "bg-wl-bg-elevated"
            )}>
              <div className="text-center">
                <div className="w-8 h-8 rounded-full border-2 border-wl-primary-400 border-t-transparent animate-spin mx-auto mb-2" />
                <p className="text-sm text-wl-text-secondary">
                  Loading tracking data...
                </p>
              </div>
            </div>
          ) : (
            <DeliveryMap
              drivers={drivers}
              deliveries={deliveries}
              selectedDriverId={selectedDriverId}
              selectedDeliveryId={selectedDeliveryId}
              onDriverSelect={handleSelectDriver}
              onDeliverySelect={handleSelectDelivery}
            />
          )}
        </div>

        {/* Sidebar Container */}
        <div className={cn(
          "flex-1 basis-3/10 rounded-lg overflow-hidden",
          "border border-wl-border-default",
          "shadow-lg"
        )}>
          <DeliverySidebar
            deliveries={deliveries}
            selectedDeliveryId={selectedDeliveryId}
            onSelectDelivery={handleSelectDelivery}
          />
        </div>
      </div>
    </div>
  );
}
