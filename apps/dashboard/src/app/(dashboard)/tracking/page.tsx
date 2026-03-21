"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { MapPin, AlertCircle, Users, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Driver {
  id: string;
  name: string;
  status: "available" | "en-route" | "delivering" | "offline";
  location: { latitude: number; longitude: number };
  speed: number;
  phone: string;
  currentDeliveryId: string | null;
  eta: Date | null;
}

interface Delivery {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  driverId: string | null;
  status: "pending" | "en-route" | "delivering" | "completed" | "cancelled";
  pickupAddress: string;
  dropoffAddress: string;
  pickupLocation: { latitude: number; longitude: number };
  dropoffLocation: { latitude: number; longitude: number };
  eta: Date | null;
  progress: number;
  createdAt: Date;
}

/**
 * Tracking Overview Page
 *
 * Displays active shipments, delivery progress, and status breakdown.
 * Features:
 * - Key metrics: active shipments, drivers online, completion rate
 * - Status breakdown cards with live counts
 * - Recent deliveries timeline
 * - Map placeholder (70%) with sidebar (30%)
 */
export default function TrackingPage() {
  // State
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize tracking
  useEffect(() => {
    const initTracking = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const mockDrivers: Driver[] = [
          {
            id: "driver-1",
            name: "Alex Johnson",
            status: "en-route",
            location: { latitude: 40.7128, longitude: -74.006 },
            speed: 25,
            phone: "+1-555-0101",
            currentDeliveryId: "delivery-1",
            eta: new Date(Date.now() + 15 * 60000),
          },
          {
            id: "driver-2",
            name: "Maria García",
            status: "delivering",
            location: { latitude: 40.7489, longitude: -73.9680 },
            speed: 8,
            phone: "+1-555-0102",
            currentDeliveryId: "delivery-2",
            eta: new Date(Date.now() + 8 * 60000),
          },
          {
            id: "driver-3",
            name: "David Chen",
            status: "available",
            location: { latitude: 40.7614, longitude: -73.9776 },
            speed: 0,
            phone: "+1-555-0103",
            currentDeliveryId: null,
            eta: null,
          },
          {
            id: "driver-4",
            name: "James Wilson",
            status: "offline",
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
            status: "en-route",
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
            status: "delivering",
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
            status: "pending",
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
            status: "pending",
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
        setIsLoading(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load tracking data";
        setError(message);
        setIsLoading(false);
      }
    };

    initTracking();
  }, []);

  const activeDeliveriesCount = useMemo(
    () => deliveries.filter((d) => d.status !== "completed" && d.status !== "cancelled").length,
    [deliveries]
  );

  const onlineDriversCount = useMemo(
    () => drivers.filter((d) => d.status !== "offline").length,
    [drivers]
  );

  const completionRate = useMemo(() => {
    const completed = deliveries.filter((d) => d.status === "completed").length;
    return deliveries.length > 0 ? Math.round((completed / deliveries.length) * 100) : 0;
  }, [deliveries]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "en-route":
      case "delivering":
        return "primary";
      case "pending":
        return "warning";
      case "cancelled":
        return "danger";
      default:
        return "default";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e] p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Tracking Overview</h1>
          <p className="text-gray-400 text-sm">Monitor active shipments and delivery progress</p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="max-w-7xl mx-auto p-6">
          <Card className="bg-red-900/20 border border-red-800 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-400 mb-1">Tracking Error</h3>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-xs font-semibold uppercase">Active Deliveries</p>
              <Truck className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-white">{activeDeliveriesCount}</p>
            <p className="text-xs text-emerald-500 mt-2">+{Math.floor(activeDeliveriesCount * 0.25)} today</p>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-xs font-semibold uppercase">Drivers Online</p>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-white">{onlineDriversCount}</p>
            <p className="text-xs text-gray-500 mt-2">{Math.round((onlineDriversCount / drivers.length) * 100)}% available</p>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-xs font-semibold uppercase">Completion Rate</p>
              <div className="w-5 h-5 text-emerald-500">✓</div>
            </div>
            <p className="text-3xl font-bold text-white">{completionRate}%</p>
            <p className="text-xs text-emerald-500 mt-2">On schedule</p>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-xs font-semibold uppercase">Total Shipments</p>
              <MapPin className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-white">{deliveries.length}</p>
            <p className="text-xs text-gray-500 mt-2">{deliveries.filter((d) => d.status === "completed").length} completed</p>
          </Card>
        </div>

        {/* Status Breakdown */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Status Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Pending", count: deliveries.filter((d) => d.status === "pending").length, variant: "warning" },
              { label: "En-Route", count: deliveries.filter((d) => d.status === "en-route").length, variant: "primary" },
              { label: "Delivering", count: deliveries.filter((d) => d.status === "delivering").length, variant: "primary" },
              { label: "Completed", count: deliveries.filter((d) => d.status === "completed").length, variant: "success" },
              { label: "Cancelled", count: deliveries.filter((d) => d.status === "cancelled").length, variant: "danger" },
            ].map((item) => (
              <div key={item.label} className="text-center p-4 rounded-lg bg-[#1a1a2e] hover:bg-[#1a1a2e]/80 transition-colors">
                <p className="text-gray-400 text-xs font-semibold mb-2">{item.label}</p>
                <p className="text-2xl font-bold text-white">{item.count}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Deliveries */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Deliveries</h2>
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-gray-400 text-sm text-center py-8">Loading deliveries...</p>
            ) : deliveries.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No deliveries found</p>
            ) : (
              deliveries.slice(0, 5).map((delivery) => (
                <div
                  key={delivery.id}
                  className="p-3 rounded-lg bg-[#1a1a2e] hover:bg-[#1a1a2e]/80 transition-colors border border-[#1e1e2e]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{delivery.orderId}</p>
                      <p className="text-xs text-gray-400">{delivery.customerName}</p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(delivery.status) as any}>
                      {delivery.status.replace("-", " ")}
                    </Badge>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-xs text-gray-400">Progress</p>
                      <p className="text-xs font-semibold text-gray-300">{delivery.progress}%</p>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#1e1e2e] overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${delivery.progress}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{delivery.dropoffAddress}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
