'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Truck,
  AlertCircle,
  Clock,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Phone,
  MessageSquare,
} from 'lucide-react';

interface MockDelivery {
  id: string;
  trackingId: string;
  driver: string;
  status: string;
  eta: string;
  progress: number;
  address: string;
  priority: string;
  position?: {
    lat: number;
    lng: number;
  };
}

interface Alert {
  id: string;
  trackingId: string;
  message: string;
  severity: "critical" | "warning" | "info";
  timestamp: string;
}

const mockActiveDeliveries: MockDelivery[] = [
  { id: "d1", trackingId: "TRK-001", driver: "John Doe", status: "out-for-delivery", eta: "2:30 PM", progress: 85, address: "123 Main St", priority: "high" },
  { id: "d2", trackingId: "TRK-002", driver: "Jane Smith", status: "in-transit", eta: "3:15 PM", progress: 60, address: "456 Oak Ave", priority: "normal" },
  { id: "d3", trackingId: "TRK-003", driver: "Bob Wilson", status: "delivering", eta: "1:45 PM", progress: 92, address: "789 Pine Rd", priority: "normal" },
];

const mockAlerts: Alert[] = [
  { id: "a1", trackingId: "TRK-001", message: "High traffic on route", severity: "warning", timestamp: "2:15 PM" },
];

const StatusTimeline = () => {
  const events = [
    { status: "Order Placed", time: "10:00 AM", completed: true },
    { status: "Processing", time: "10:30 AM", completed: true },
    { status: "In Transit", time: "12:00 PM", completed: true },
    { status: "Out for Delivery", time: "1:00 PM", completed: true },
    { status: "Delivered", time: "Est. 3:00 PM", completed: false },
  ];

  return (
    <div>
      {events.map((event, index) => (
        <div key={index} className={cn("flex gap-3", index < events.length - 1 ? "mb-4" : "")}>
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center border-2",
                event.completed ? "bg-emerald-500 border-emerald-500" : "bg-[#1e1e2e] border-[#1e1e2e]"
              )}
            >
              {event.completed && <CheckCircle size={14} className="text-[#0a0a0f]" />}
            </div>
            {index < events.length - 1 && (
              <div className={cn("w-0.5 h-8 my-2", event.completed ? "bg-emerald-500" : "bg-[#1e1e2e]")} />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-white">{event.status}</p>
            <p className="text-xs text-gray-400">{event.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function LiveTracking() {
  const [deliveries, setDeliveries] = useState<MockDelivery[]>(mockActiveDeliveries);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>(mockActiveDeliveries[0].id);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
      setDeliveries((prev) =>
        prev.map((delivery) => ({
          ...delivery,
          progress: Math.min(100, delivery.progress + Math.random() * 2),
          position: {
            lat: 40.7128 + Math.random() * 0.01,
            lng: -74.006 + Math.random() * 0.01,
          },
        }))
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const selectedDelivery = deliveries.find((d) => d.id === selectedDeliveryId);
  const onTimePercentage = 92;
  const avgDeliveryTime = "42 mins";
  const totalActiveDeliveries = deliveries.length;

  const getStatusColor = (status: string) => {
    if (status === "out-for-delivery") return "#3b82f6";
    if (status === "in-transit") return "#6C63FF";
    if (status === "delivered") return "#10b981";
    return "#f59e0b";
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === "out-for-delivery" || status === "in-transit") return "primary";
    if (status === "delivered") return "success";
    return "warning";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e] p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Live Tracking Dashboard</h1>
          <p className="text-gray-400">Real-time delivery monitoring and driver tracking</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400 font-semibold uppercase">Active Deliveries</p>
                <Truck size={18} className="text-blue-500" />
              </div>
              <p className="text-4xl font-bold text-white">{totalActiveDeliveries}</p>
              <p className="text-xs text-emerald-500 mt-2">+2 from yesterday</p>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400 font-semibold uppercase">On-Time %</p>
                <TrendingUp size={18} className="text-emerald-500" />
              </div>
              <p className="text-4xl font-bold text-white">{onTimePercentage}%</p>
              <p className="text-xs text-emerald-500 mt-2">+3% improvement</p>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400 font-semibold uppercase">Avg Delivery Time</p>
                <Clock size={18} className="text-amber-500" />
              </div>
              <p className="text-4xl font-bold text-white">{avgDeliveryTime}</p>
              <p className="text-xs text-amber-500 mt-2">-2 mins from avg</p>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400 font-semibold uppercase">Alerts</p>
                <AlertCircle size={18} className="text-red-500" />
              </div>
              <p className="text-4xl font-bold text-white">{alerts.length}</p>
              <p className="text-xs text-red-500 mt-2">{alerts.filter(a => a.severity === "critical").length} critical</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-[1fr_320px] gap-6">
          {/* Deliveries List */}
          <div className="flex flex-col gap-4">
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Active Deliveries</h2>

                <div className="flex flex-col gap-3">
                  {deliveries.map((delivery) => (
                    <button
                      key={delivery.id}
                      onClick={() => setSelectedDeliveryId(delivery.id)}
                      className={cn(
                        "p-4 rounded-lg text-left transition-all border",
                        selectedDeliveryId === delivery.id
                          ? "border-blue-500 bg-[#1a1a2e]"
                          : "border-[#1e1e2e] bg-[#1a1a2e] hover:border-[#2e2e3e]"
                      )}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{delivery.trackingId}</p>
                          <p className="text-xs text-gray-400 mt-1">{delivery.driver}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={delivery.priority === "high" ? "danger" : "default"}>
                            {delivery.priority}
                          </Badge>
                          <Badge variant={getStatusBadgeVariant(delivery.status)}>
                            {delivery.status.replace("-", " ")}
                          </Badge>
                        </div>
                      </div>

                      <div className="mb-2">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs text-gray-400">Progress</p>
                          <p className="text-xs font-semibold text-gray-300">{Math.round(delivery.progress)}%</p>
                        </div>
                        <div className="h-1.5 rounded overflow-hidden bg-[#1e1e2e]">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${delivery.progress}%`,
                              backgroundColor: getStatusColor(delivery.status),
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-400">{delivery.address}</p>
                        <p className="text-xs font-semibold text-blue-500">ETA: {delivery.eta}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Alerts Panel */}
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <AlertCircle size={18} className="text-red-500" />
                  Delivery Alerts
                </h2>

                {alerts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">All deliveries on track</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={cn(
                          "p-3 rounded text-xs border",
                          alert.severity === "critical"
                            ? "border-red-600 bg-red-900/10"
                            : alert.severity === "warning"
                            ? "border-amber-600 bg-amber-900/10"
                            : "border-blue-600 bg-blue-900/10"
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-semibold text-white">{alert.trackingId}</p>
                          <span className="text-gray-400">{alert.timestamp}</span>
                        </div>
                        <p className="text-gray-300">{alert.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Selected Delivery Details */}
            {selectedDelivery && (
              <Card className="bg-[#12121a] border border-blue-500/30">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-blue-500 mb-3 uppercase">Delivery Details</p>

                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-1">Tracking ID</p>
                    <p className="text-xs font-semibold text-white">{selectedDelivery.trackingId}</p>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-1">Driver</p>
                    <p className="text-xs text-white">{selectedDelivery.driver}</p>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-1">Destination</p>
                    <p className="text-xs text-white">{selectedDelivery.address}</p>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-1">ETA</p>
                    <p className="text-xs text-white">{selectedDelivery.eta}</p>
                  </div>

                  {selectedDelivery.position && (
                    <div className="mb-4 p-3 rounded bg-[#1a1a2e] border border-[#1e1e2e]">
                      <p className="text-xs text-gray-400 mb-1">Current Location</p>
                      <p className="text-xs text-white">
                        {selectedDelivery.position.lat.toFixed(4)}, {selectedDelivery.position.lng.toFixed(4)}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" className="flex-1 flex items-center justify-center gap-1">
                      <Phone size={14} /> Call
                    </Button>
                    <Button variant="secondary" size="sm" className="flex-1 flex items-center justify-center gap-1">
                      <MessageSquare size={14} /> Message
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-white mb-4 uppercase">Delivery Timeline</p>
                <StatusTimeline />
              </CardContent>
            </Card>

            {/* Statistics */}
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-white mb-3 flex items-center gap-2 uppercase">
                  <BarChart3 size={14} /> Stats
                </p>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <p className="text-xs text-gray-400">Delivered</p>
                      <p className="text-xs font-semibold text-emerald-500">12</p>
                    </div>
                    <div className="h-1 rounded bg-[#1e1e2e]">
                      <div className="h-full w-3/5 bg-emerald-500 rounded" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <p className="text-xs text-gray-400">In Transit</p>
                      <p className="text-xs font-semibold text-blue-500">5</p>
                    </div>
                    <div className="h-1 rounded bg-[#1e1e2e]">
                      <div className="h-full w-1/4 bg-blue-500 rounded" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <p className="text-xs text-gray-400">Failed</p>
                      <p className="text-xs font-semibold text-red-500">1</p>
                    </div>
                    <div className="h-1 rounded bg-[#1e1e2e]">
                      <div className="h-full w-1/12 bg-red-500 rounded" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
