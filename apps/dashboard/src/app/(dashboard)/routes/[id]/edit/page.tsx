"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Stop {
  id: string;
  orderId: string;
  address: string;
  timeWindow: { start: string; end: string };
  priority: "low" | "medium" | "high";
}

interface RouteFormData {
  name: string;
  date: string;
  driverId: string;
  vehicleId: string;
  stops: Stop[];
}

const mockDrivers = [
  { id: "D001", name: "John Martinez" },
  { id: "D002", name: "Sarah Chen" },
  { id: "D003", name: "Marcus Johnson" },
  { id: "D004", name: "Elena Rodriguez" },
];

const mockVehicles = [
  { id: "V001", name: "Van-01", capacity: "1000kg" },
  { id: "V002", name: "Truck-02", capacity: "5000kg" },
  { id: "V003", name: "Van-03", capacity: "1200kg" },
];

const mockAvailableOrders = [
  {
    id: "ORD-2024-007",
    address: "111 Market St, Shopping District",
    timeWindow: { start: "15:00", end: "17:00" },
    priority: "medium" as const,
  },
  {
    id: "ORD-2024-008",
    address: "222 Park Ave, Riverside",
    timeWindow: { start: "15:30", end: "17:30" },
    priority: "low" as const,
  },
  {
    id: "ORD-2024-009",
    address: "333 Harbor Rd, Port Area",
    timeWindow: { start: "14:00", end: "16:00" },
    priority: "high" as const,
  },
];

const initialRoute: RouteFormData = {
  name: "Downtown Delivery Route A",
  date: "2024-03-06",
  driverId: "D001",
  vehicleId: "V001",
  stops: [
    {
      id: "stop_1",
      orderId: "ORD-2024-001",
      address: "123 Main St, Downtown",
      timeWindow: { start: "09:00", end: "11:00" },
      priority: "high",
    },
    {
      id: "stop_2",
      orderId: "ORD-2024-002",
      address: "456 Oak Ave, Midtown",
      timeWindow: { start: "10:00", end: "12:00" },
      priority: "medium",
    },
    {
      id: "stop_3",
      orderId: "ORD-2024-003",
      address: "789 Elm Rd, North District",
      timeWindow: { start: "11:00", end: "13:00" },
      priority: "low",
    },
    {
      id: "stop_4",
      orderId: "ORD-2024-004",
      address: "321 Pine St, Uptown",
      timeWindow: { start: "13:00", end: "15:00" },
      priority: "medium",
    },
  ],
};

export default function EditRoutePage() {
  const [formData, setFormData] = useState<RouteFormData>(initialRoute);
  const [draggedStop, setDraggedStop] = useState<number | null>(null);
  const [showAddStop, setShowAddStop] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setHasChanges(true);
  };

  const handleRemoveStop = (stopId: string) => {
    setFormData((prev) => ({
      ...prev,
      stops: prev.stops.filter((stop) => stop.id !== stopId),
    }));
    setHasChanges(true);
  };

  const handleAddStop = (order: (typeof mockAvailableOrders)[0]) => {
    const newStop: Stop = {
      id: `stop_${Date.now()}`,
      orderId: order.id,
      address: order.address,
      timeWindow: order.timeWindow,
      priority: order.priority,
    };
    setFormData((prev) => ({
      ...prev,
      stops: [...prev.stops, newStop],
    }));
    setHasChanges(true);
    setShowAddStop(false);
  };

  const handleDragStart = (index: number) => {
    setDraggedStop(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedStop === null || draggedStop === targetIndex) return;

    const stops = [...formData.stops];
    const [draggedItem] = stops.splice(draggedStop, 1);
    stops.splice(targetIndex, 0, draggedItem);

    setFormData((prev) => ({
      ...prev,
      stops,
    }));
    setDraggedStop(null);
    setHasChanges(true);
  };

  const handleReoptimize = () => {
    setFormData((prev) => ({
      ...prev,
      stops: [...prev.stops].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
    }));
    setHasChanges(true);
  };

  const handleCancel = () => {
    setFormData(initialRoute);
    setHasChanges(false);
  };

  const estimatedDistance = formData.stops.length * 3.5;
  const estimatedDuration = formData.stops.length * 15 + 30;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "#ff6b6b";
      case "medium":
        return "#ffd93d";
      case "low":
        return "#6bcf7f";
      default:
        return "#8888a0";
    }
  };

  return (
    <div className="min-h-screen bg-wl-bg p-6 text-wl-text">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-wl-text mb-2">Edit Route</h1>
        <p className="text-sm text-wl-muted">Modify route details, reorder stops, and optimize delivery sequence</p>
      </div>

      <div className="max-w-4xl mb-8">
        <div className="grid grid-cols-[2fr_1fr] gap-6">
          <div>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Route Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-wl-text text-sm font-semibold mb-2">Route Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 rounded-md bg-wl-surface border border-wl-border text-wl-text text-sm box-border"
                    />
                  </div>
                  <div>
                    <label className="block text-wl-text text-sm font-semibold mb-2">Delivery Date</label>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 rounded-md bg-wl-surface border border-wl-border text-wl-text text-sm box-border"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-wl-text text-sm font-semibold mb-2">Assign Driver</label>
                    <select
                      name="driverId"
                      value={formData.driverId}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 rounded-md bg-wl-surface border border-wl-border text-wl-text text-sm box-border"
                    >
                      {mockDrivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-wl-text text-sm font-semibold mb-2">Vehicle</label>
                    <select
                      name="vehicleId"
                      value={formData.vehicleId}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 rounded-md bg-wl-surface border border-wl-border text-wl-text text-sm box-border"
                    >
                      {mockVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.name} ({vehicle.capacity})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Route Stops</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="p-4 rounded-md bg-wl-surface border border-wl-border text-center">
                    <div className="text-lg font-bold text-wl-primary mb-0.5">{formData.stops.length}</div>
                    <div className="text-xs text-wl-muted">Total Stops</div>
                  </div>
                  <div className="p-4 rounded-md bg-wl-surface border border-wl-border text-center">
                    <div className="text-lg font-bold text-wl-primary mb-0.5">{estimatedDistance.toFixed(1)}km</div>
                    <div className="text-xs text-wl-muted">Est. Distance</div>
                  </div>
                  <div className="p-4 rounded-md bg-wl-surface border border-wl-border text-center">
                    <div className="text-lg font-bold text-wl-primary mb-0.5">{estimatedDuration}min</div>
                    <div className="text-xs text-wl-muted">Est. Duration</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  {formData.stops.map((stop, idx) => (
                    <div
                      key={stop.id}
                      className="p-3 rounded-md bg-wl-surface border border-wl-border grid gap-3 items-center cursor-grab transition-all"
                      style={{
                        gridTemplateColumns: "24px 1fr auto auto",
                        backgroundColor: draggedStop === idx ? "var(--wl-primary)" : "var(--wl-surface)",
                        borderColor: draggedStop === idx ? "var(--wl-primary)" : "var(--wl-border)",
                        opacity: draggedStop === idx ? 0.7 : 1,
                      }}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(idx)}
                    >
                      <div className="flex flex-col gap-0.5 text-wl-muted text-xs cursor-grab">
                        <span>⋮</span>
                        <span>⋮</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-wl-text text-xs font-semibold mb-0.5">
                          {idx + 1}. {stop.orderId}
                        </div>
                        <div className="text-wl-muted text-xs overflow-hidden text-ellipsis whitespace-nowrap">
                          {stop.address}
                        </div>
                      </div>
                      <Badge>{stop.priority.toUpperCase()}</Badge>
                      <Button
                        onClick={() => handleRemoveStop(stop.id)}
                        variant="secondary"
                        size="sm"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mb-4">
                  <Button
                    variant="secondary"
                    onClick={() => setShowAddStop(!showAddStop)}
                    className="flex-1"
                  >
                    {showAddStop ? "Hide Available Orders" : "Add Stop"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleReoptimize}
                    className="flex-1"
                  >
                    Re-optimize Route
                  </Button>
                </div>

                {showAddStop && (
                  <div className="mt-4 p-4 rounded-md bg-wl-surface border border-wl-border">
                    <h4 className="text-wl-text text-sm font-semibold mb-3">Available Orders</h4>
                    <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                      {mockAvailableOrders.map((order) => (
                        <div
                          key={order.id}
                          className="p-3 rounded-md bg-wl-bg border border-wl-border cursor-pointer text-xs transition-all hover:bg-wl-surface hover:border-wl-primary"
                          onClick={() => handleAddStop(order)}
                        >
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="font-semibold text-wl-text">{order.id}</span>
                            <Badge>{order.priority.toUpperCase()}</Badge>
                          </div>
                          <div className="text-wl-muted mb-1">
                            {order.address}
                          </div>
                          <div className="text-wl-muted text-xs">
                            {order.timeWindow.start} - {order.timeWindow.end}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Driver</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 rounded-md bg-wl-surface border border-wl-border">
                  <div className="text-wl-text text-sm font-semibold mb-2">
                    {mockDrivers.find((d) => d.id === formData.driverId)?.name}
                  </div>
                  <div className="text-wl-muted text-xs leading-relaxed">
                    <div>ID: {formData.driverId}</div>
                    <div className="mt-2">Status: Active</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vehicle Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 rounded-md bg-wl-surface border border-wl-border">
                  <div className="text-wl-text text-sm font-semibold mb-2">
                    {mockVehicles.find((v) => v.id === formData.vehicleId)?.name}
                  </div>
                  <div className="text-wl-muted text-xs leading-relaxed">
                    <div>
                      Capacity: {mockVehicles.find((v) => v.id === formData.vehicleId)?.capacity}
                    </div>
                    <div className="mt-2">Status: Available</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Route Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 rounded-md bg-wl-surface border border-wl-border text-wl-muted text-xs leading-relaxed">
                  <div>
                    <strong>Name:</strong> {formData.name}
                  </div>
                  <div>
                    <strong>Date:</strong> {formData.date}
                  </div>
                  <div>
                    <strong>Stops:</strong> {formData.stops.length}
                  </div>
                  <div>
                    <strong>Distance:</strong> {estimatedDistance.toFixed(1)}km
                  </div>
                  <div>
                    <strong>Duration:</strong> {estimatedDuration}min
                  </div>
                </div>
              </CardContent>
            </Card>

            {hasChanges && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500 text-red-500 text-xs text-center">
                You have unsaved changes
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3 max-w-4xl justify-between">
        <Button variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
        <div className="flex gap-3">
          <Button variant="secondary">Save as Draft</Button>
          <Button variant="primary" disabled={!hasChanges}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
