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
  optimizationMode: "shortest_distance" | "time_windows" | "priority_first";
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

const mockOrders = [
  {
    id: "ORD-2024-001",
    address: "123 Main St, Downtown",
    timeWindow: { start: "09:00", end: "11:00" },
    priority: "high" as const,
  },
  {
    id: "ORD-2024-002",
    address: "456 Oak Ave, Midtown",
    timeWindow: { start: "10:00", end: "12:00" },
    priority: "medium" as const,
  },
  {
    id: "ORD-2024-003",
    address: "789 Elm Rd, North District",
    timeWindow: { start: "11:00", end: "13:00" },
    priority: "low" as const,
  },
  {
    id: "ORD-2024-004",
    address: "321 Pine St, Uptown",
    timeWindow: { start: "13:00", end: "15:00" },
    priority: "medium" as const,
  },
  {
    id: "ORD-2024-005",
    address: "654 Maple Dr, East Side",
    timeWindow: { start: "14:00", end: "16:00" },
    priority: "low" as const,
  },
  {
    id: "ORD-2024-006",
    address: "987 Cedar Ln, West Side",
    timeWindow: { start: "09:30", end: "11:30" },
    priority: "high" as const,
  },
];

export default function CreateRoutePage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<RouteFormData>({
    name: "",
    date: "",
    driverId: "",
    vehicleId: "",
    stops: [],
    optimizationMode: "shortest_distance",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [draggedStop, setDraggedStop] = useState<number | null>(null);

  const filteredOrders = mockOrders.filter(
    (order) =>
      !formData.stops.some((stop) => stop.orderId === order.id) &&
      (order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddStop = (order: (typeof mockOrders)[0]) => {
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
  };

  const handleRemoveStop = (stopId: string) => {
    setFormData((prev) => ({
      ...prev,
      stops: prev.stops.filter((stop) => stop.id !== stopId),
    }));
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
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

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

  const estimatedDistance = formData.stops.length * 3.5;
  const estimatedDuration = formData.stops.length * 15 + 30;

  const canProceed =
    step === 1
      ? formData.name && formData.date && formData.driverId && formData.vehicleId
      : step === 2
        ? formData.stops.length > 0
        : true;

  return (
    <div className="min-h-screen bg-wl-bg p-6 text-wl-text">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-wl-text mb-2">Create New Route</h1>
        <p className="text-sm text-wl-muted">Set up a new delivery route with multiple stops</p>
      </div>

      <div className="flex gap-3 mb-8 max-w-4xl">
        {["Route Basics", "Add Stops", "Map Preview", "Optimization"].map((name, idx) => (
          <div
            key={idx}
            className={cn(
              "flex-1 p-3 rounded-lg border text-center text-sm font-semibold cursor-pointer transition-all",
              step === idx + 1
                ? "bg-wl-primary text-white border-wl-primary"
                : step > idx + 1
                  ? "bg-wl-surface text-wl-muted border-wl-border"
                  : "bg-wl-surface text-wl-muted border-wl-border"
            )}
            onClick={() => step > idx + 1 && setStep(idx + 1)}
          >
            {name}
          </div>
        ))}
      </div>

      <Card className="max-w-4xl mb-6">
        <CardHeader>
          <CardTitle>
            Step {step}:{" "}
            {step === 1
              ? "Route Basics"
              : step === 2
                ? "Add Stops"
                : step === 3
                  ? "Map Preview"
                  : "Optimization"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="max-w-4xl">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-wl-text text-sm font-semibold mb-2">Route Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Downtown Delivery Route A"
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
                    <option value="">Select a driver</option>
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
                    <option value="">Select a vehicle</option>
                    {mockVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} ({vehicle.capacity})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-4xl">
              <div className="mb-6">
                <label className="block text-wl-text text-sm font-semibold mb-2">Search & Add Orders</label>
                <input
                  type="text"
                  placeholder="Search by order ID or address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md bg-wl-surface border border-wl-border text-wl-text text-sm mb-4 box-border"
                />
              </div>

              {filteredOrders.length > 0 && (
                <>
                  <h3 className="text-wl-text text-sm font-semibold mb-3">
                    Available Orders ({filteredOrders.length})
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 mb-6">
                    {filteredOrders.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 rounded-lg bg-wl-surface border border-wl-border cursor-pointer transition-all hover:border-wl-primary hover:bg-wl-surface"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-wl-text font-semibold text-sm">
                            {order.id}
                          </span>
                          <Badge>{order.priority.toUpperCase()}</Badge>
                        </div>
                        <p className="text-wl-muted text-xs mb-2">
                          {order.address}
                        </p>
                        <p className="text-wl-muted text-xs mb-3">
                          {order.timeWindow.start} - {order.timeWindow.end}
                        </p>
                        <Button
                          onClick={() => handleAddStop(order)}
                          variant="primary"
                          size="sm"
                          className="w-full"
                        >
                          Add to Route
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {formData.stops.length > 0 && (
                <>
                  <h3 className="text-wl-text text-sm font-semibold mt-8 mb-3">
                    Route Stops ({formData.stops.length})
                  </h3>
                  <div className="flex flex-col gap-2 mt-4">
                    {formData.stops.map((stop, idx) => (
                      <div
                        key={stop.id}
                        className="p-3 rounded-md bg-wl-surface border border-wl-border flex items-center gap-3 cursor-grab transition-all"
                        style={{
                          // Intentional inline: dynamic backgroundColor, borderColor, and opacity
                          backgroundColor: draggedStop === idx ? "var(--wl-primary)" : "var(--wl-surface)",
                          borderColor: draggedStop === idx ? "var(--wl-primary)" : "var(--wl-border)",
                          opacity: draggedStop === idx ? 0.7 : 1,
                        }}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(idx)}
                      >
                        <div className="flex flex-col gap-0.5 text-wl-muted text-xs">
                          <span>::::</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-wl-text text-sm font-semibold">
                            {stop.orderId}
                          </div>
                          <div className="text-wl-muted text-xs">{stop.address}</div>
                          <div className="text-wl-muted text-xs mt-1">
                            {stop.timeWindow.start} - {stop.timeWindow.end}
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

                  <div className="grid grid-cols-4 gap-4 my-6">
                    <div className="p-4 rounded-lg bg-wl-surface border border-wl-border text-center">
                      <div className="text-lg font-bold text-wl-primary mb-1">{formData.stops.length}</div>
                      <div className="text-xs text-wl-muted">Total Stops</div>
                    </div>
                    <div className="p-4 rounded-lg bg-wl-surface border border-wl-border text-center">
                      <div className="text-lg font-bold text-wl-primary mb-1">{estimatedDistance.toFixed(1)}km</div>
                      <div className="text-xs text-wl-muted">Est. Distance</div>
                    </div>
                    <div className="p-4 rounded-lg bg-wl-surface border border-wl-border text-center">
                      <div className="text-lg font-bold text-wl-primary mb-1">{estimatedDuration}min</div>
                      <div className="text-xs text-wl-muted">Est. Duration</div>
                    </div>
                    <div className="p-4 rounded-lg bg-wl-surface border border-wl-border text-center">
                      <div className="text-lg font-bold text-wl-primary mb-1">850kg</div>
                      <div className="text-xs text-wl-muted">Est. Capacity</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="max-w-4xl">
              <div className="w-full h-96 bg-wl-surface border border-wl-border rounded-lg flex items-center justify-center mb-6 relative overflow-hidden">
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 800 400"
                  className="absolute top-0 left-0"
                >
                  <defs>
                    <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6C63FF" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#6C63FF" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>

                  {formData.stops.length > 1 && (
                    <polyline
                      points={formData.stops
                        .map((_, idx) => {
                          const x = 50 + (idx / (formData.stops.length - 1)) * 700;
                          const y = 150 + Math.sin(idx * 0.5) * 50;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                      fill="none"
                      stroke="#6C63FF"
                      strokeWidth="2"
                      opacity="0.5"
                    />
                  )}

                  {formData.stops.map((stop, idx) => {
                    const x = 50 + (idx / Math.max(formData.stops.length - 1, 1)) * 700;
                    const y = 150 + Math.sin(idx * 0.5) * 50;
                    return (
                      <g key={stop.id}>
                        <circle
                          cx={x}
                          cy={y}
                          r="12"
                          fill={getPriorityColor(stop.priority)}
                          opacity="0.8"
                        />
                        <text
                          x={x}
                          y={y}
                          textAnchor="middle"
                          dy="0.3em"
                          fontSize="10"
                          fontWeight="bold"
                          fill="white"
                        >
                          {idx + 1}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="absolute bottom-4 right-4 text-xs text-wl-muted">
                  Map Preview - {formData.stops.length} stops
                </div>
              </div>

              <div>
                <h3 className="text-wl-text text-sm font-semibold mb-3">Stop Details</h3>
                <div className="flex flex-col gap-2">
                  {formData.stops.map((stop, idx) => (
                    <div
                      key={stop.id}
                      className="p-4 rounded-md bg-wl-surface border border-wl-border grid gap-3 items-center"
                      style={{
                        // Intentional inline: dynamic grid template columns
                        gridTemplateColumns: "30px 1fr auto",
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                        style={{
                          // Intentional inline: dynamic background color
                          backgroundColor: getPriorityColor(stop.priority)
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-wl-text text-sm font-semibold">
                          {stop.orderId}
                        </div>
                        <div className="text-wl-muted text-xs mt-0.5">
                          {stop.address}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge>{stop.priority.toUpperCase()}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="max-w-4xl">
              <h3 className="text-wl-text text-sm font-semibold mb-4">Route Optimization Strategy</h3>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  {
                    id: "shortest_distance",
                    name: "Shortest Distance",
                    desc: "Minimize travel distance",
                  },
                  {
                    id: "time_windows",
                    name: "Time Windows",
                    desc: "Respect delivery windows",
                  },
                  {
                    id: "priority_first",
                    name: "Priority First",
                    desc: "High-priority deliveries first",
                  },
                ].map((option) => (
                  <div
                    key={option.id}
                    className={cn(
                      "p-4 rounded-lg border text-center cursor-pointer transition-all",
                      formData.optimizationMode === (option.id as any)
                        ? "bg-wl-primary text-white border-wl-primary"
                        : "bg-wl-surface text-wl-text border-wl-border"
                    )}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        optimizationMode: option.id as any,
                      }))
                    }
                  >
                    <div className="font-semibold mb-1">{option.name}</div>
                    <div className="text-xs opacity-80">{option.desc}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-lg bg-wl-surface border border-wl-border">
                <h4 className="text-wl-text text-sm font-semibold mb-2">Summary</h4>
                <div className="text-wl-muted text-sm leading-relaxed">
                  <p>
                    <strong>Route:</strong> {formData.name}
                  </p>
                  <p>
                    <strong>Driver:</strong> {mockDrivers.find((d) => d.id === formData.driverId)?.name || "Not assigned"}
                  </p>
                  <p>
                    <strong>Vehicle:</strong> {mockVehicles.find((v) => v.id === formData.vehicleId)?.name || "Not assigned"}
                  </p>
                  <p>
                    <strong>Date:</strong> {formData.date || "Not set"}
                  </p>
                  <p>
                    <strong>Stops:</strong> {formData.stops.length}
                  </p>
                  <p>
                    <strong>Est. Distance:</strong> {estimatedDistance.toFixed(1)}km
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3 max-w-4xl justify-between">
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          {step === 4 ? (
            <>
              <Button variant="secondary">Save as Draft</Button>
              <Button variant="primary">Dispatch Route</Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => setStep(4)}
              >
                Skip to Optimization
              </Button>
              <Button
                variant="primary"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed}
              >
                Next
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
