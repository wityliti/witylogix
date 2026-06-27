"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useApiList, useApiMutation } from '@/hooks/use-api';
import { WLMap } from '@/components/map/wl-map';
import { RoutePolylineLayer } from '@/components/map/route-polyline-layer';
import { RouteStopMarkersLayer, type StopMarker } from '@/components/map/route-stop-markers-layer';
import { MapPin } from 'lucide-react';

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

interface ApiDriver {
  id: string;
  name: string;
  status?: string;
}

interface ApiVehicle {
  id: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  type?: string;
}

interface ApiOrder {
  id: string;
  orderNumber?: string;
  deliveryAddress?: string;
  shippingAddress?: { line1?: string; city?: string };
  priority?: string;
  status?: string;
}

const DEFAULT_CENTER: [number, number] = [0, 20];

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

  const { items: drivers } = useApiList<ApiDriver>('/api/v4/drivers');
  const { items: vehicles } = useApiList<ApiVehicle>('/api/v4/fleet/vehicles');
  const { items: orders } = useApiList<ApiOrder>('/api/v4/orders', { limit: 50 });
  const createRoute = useApiMutation<{ id: string }>('POST', '/api/v4/routes');

  const getOrderAddress = (order: ApiOrder): string => {
    if (order.deliveryAddress) return order.deliveryAddress;
    if (order.shippingAddress) {
      return [order.shippingAddress.line1, order.shippingAddress.city].filter(Boolean).join(', ');
    }
    return order.id;
  };

  const getOrderLabel = (order: ApiOrder): string => order.orderNumber ?? order.id;

  const filteredOrders = orders.filter(
    (order) =>
      !formData.stops.some((stop) => stop.orderId === order.id) &&
      (getOrderLabel(order).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getOrderAddress(order).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddStop = (order: ApiOrder) => {
    const newStop: Stop = {
      id: `stop_${Date.now()}`,
      orderId: order.id,
      address: getOrderAddress(order),
      timeWindow: { start: "09:00", end: "17:00" },
      priority: (order.priority as "low" | "medium" | "high") ?? "medium",
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

  const getPriorityClass = (priority: string): string => {
    switch (priority) {
      case "high":   return "bg-wl-danger-400";
      case "medium": return "bg-wl-warning-400";
      case "low":    return "bg-wl-success-400";
      default:       return "bg-wl-neutral-400";
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case "high":   return "#ef4444";
      case "medium": return "#f59e0b";
      case "low":    return "#22c55e";
      default:       return "#6b7280";
    }
  };

  const estimatedDistance = formData.stops.length * 3.5;
  const estimatedDuration = formData.stops.length * 15 + 30;

  // Build map data from stops that have lat/lng embedded in address (from order data)
  // Orders with deliveryLocation JSON will be the source of truth for coordinates.
  // For the create flow, we don't have geocoords from API, so the map shows a no-data state.
  const previewStopMarkers = useMemo<StopMarker[]>(() => [], []);
  const previewPolyline: Array<[number, number]> = [];

  const canProceed =
    step === 1
      ? formData.name && formData.date && formData.driverId && formData.vehicleId
      : step === 2
        ? formData.stops.length > 0
        : true;

  const handleDispatch = async () => {
    await createRoute.execute({
      name: formData.name,
      date: formData.date,
      driverId: formData.driverId || undefined,
      orderIds: formData.stops.map((s) => s.orderId),
    });
  };

  const selectedDriver = drivers.find((d) => d.id === formData.driverId);
  const selectedVehicle = vehicles.find((v) => v.id === formData.vehicleId);

  return (
    <div className="min-h-screen bg-wl-bg-root p-6 text-white">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Create New Route</h1>
        <p className="text-sm text-wl-text-secondary">Set up a new delivery route with multiple stops</p>
      </div>

      <div className="flex gap-3 mb-8 max-w-4xl">
        {["Route Basics", "Add Stops", "Map Preview", "Optimization"].map((name, idx) => (
          <div
            key={idx}
            className={cn(
              "flex-1 p-3 rounded-lg border text-center text-sm font-semibold cursor-pointer transition-all",
              step === idx + 1
                ? "bg-blue-500 text-white border-blue-500"
                : step > idx + 1
                  ? "bg-wl-bg-surface text-wl-text-secondary border-wl-border-default"
                  : "bg-wl-bg-surface text-wl-text-secondary border-wl-border-default"
            )}
            onClick={() => step > idx + 1 && setStep(idx + 1)}
          >
            {name}
          </div>
        ))}
      </div>

      <Card className="max-w-4xl mb-6 bg-wl-bg-surface border border-wl-border-default">
        <CardHeader>
          <CardTitle className="text-white">
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
                  <label className="block text-white text-sm font-semibold mb-2">Route Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Downtown Delivery Route A"
                    className="w-full px-3 py-2.5 rounded-md bg-wl-bg-root border border-wl-border-default text-white text-sm box-border"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm font-semibold mb-2">Delivery Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 rounded-md bg-wl-bg-root border border-wl-border-default text-white text-sm box-border"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white text-sm font-semibold mb-2">Assign Driver</label>
                  <select
                    name="driverId"
                    value={formData.driverId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 rounded-md bg-wl-bg-root border border-wl-border-default text-white text-sm box-border"
                  >
                    <option value="">Select a driver</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white text-sm font-semibold mb-2">Vehicle</label>
                  <select
                    name="vehicleId"
                    value={formData.vehicleId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 rounded-md bg-wl-bg-root border border-wl-border-default text-white text-sm box-border"
                  >
                    <option value="">Select a vehicle</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.year} {vehicle.make} {vehicle.model} ({vehicle.licensePlate})
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
                <label className="block text-white text-sm font-semibold mb-2">Search & Add Orders</label>
                <input
                  type="text"
                  placeholder="Search by order ID or address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md bg-wl-bg-root border border-wl-border-default text-white text-sm mb-4 box-border"
                />
              </div>

              {filteredOrders.length > 0 && (
                <>
                  <h3 className="text-white text-sm font-semibold mb-3">
                    Available Orders ({filteredOrders.length})
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 mb-6">
                    {filteredOrders.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 rounded-lg bg-wl-bg-surface border border-wl-border-default cursor-pointer transition-all hover:border-blue-500 hover:bg-wl-bg-surface"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-white font-semibold text-sm">
                            {getOrderLabel(order)}
                          </span>
                          {order.priority && <Badge>{order.priority.toUpperCase()}</Badge>}
                        </div>
                        <p className="text-wl-text-secondary text-xs mb-2">
                          {getOrderAddress(order)}
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
                  <h3 className="text-white text-sm font-semibold mt-8 mb-3">
                    Route Stops ({formData.stops.length})
                  </h3>
                  <div className="flex flex-col gap-2 mt-4">
                    {formData.stops.map((stop, idx) => (
                      <div
                        key={stop.id}
                        className="p-3 rounded-md bg-wl-bg-surface border border-wl-border-default flex items-center gap-3 cursor-grab transition-all"
                        style={{
                          backgroundColor: draggedStop === idx ? "#2563eb" : "#12121a",
                          borderColor: draggedStop === idx ? "#2563eb" : "#1e1e2e",
                          opacity: draggedStop === idx ? 0.7 : 1,
                        }}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(idx)}
                      >
                        <div className="flex flex-col gap-0.5 text-wl-text-secondary text-xs">
                          <span>::::</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-white text-sm font-semibold">
                            {stop.orderId}
                          </div>
                          <div className="text-wl-text-secondary text-xs">{stop.address}</div>
                          <div className="text-wl-text-secondary text-xs mt-1">
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
                    <div className="p-4 rounded-lg bg-wl-bg-surface border border-wl-border-default text-center">
                      <div className="text-lg font-bold text-blue-500 mb-1">{formData.stops.length}</div>
                      <div className="text-xs text-wl-text-secondary">Total Stops</div>
                    </div>
                    <div className="p-4 rounded-lg bg-wl-bg-surface border border-wl-border-default text-center">
                      <div className="text-lg font-bold text-blue-500 mb-1">{estimatedDistance.toFixed(1)}km</div>
                      <div className="text-xs text-wl-text-secondary">Est. Distance</div>
                    </div>
                    <div className="p-4 rounded-lg bg-wl-bg-surface border border-wl-border-default text-center">
                      <div className="text-lg font-bold text-blue-500 mb-1">{estimatedDuration}min</div>
                      <div className="text-xs text-wl-text-secondary">Est. Duration</div>
                    </div>
                    <div className="p-4 rounded-lg bg-wl-bg-surface border border-wl-border-default text-center">
                      <div className="text-lg font-bold text-blue-500 mb-1">850kg</div>
                      <div className="text-xs text-wl-text-secondary">Est. Capacity</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="max-w-4xl">
              <div className="w-full h-96 rounded-lg mb-6 overflow-hidden relative border border-wl-border-default">
                {previewStopMarkers.length > 0 ? (
                  <WLMap
                    center={DEFAULT_CENTER}
                    zoom={12}
                    className="w-full h-full"
                    interactive
                  >
                    {previewPolyline.length >= 2 && (
                      <RoutePolylineLayer
                        coordinates={previewPolyline}
                        variant="planned"
                        fitBounds
                        fitPadding={60}
                      />
                    )}
                    <RouteStopMarkersLayer
                      stops={previewStopMarkers}
                      fitBounds
                      fitPadding={60}
                    />
                  </WLMap>
                ) : (
                  <div className="w-full h-full bg-wl-bg-surface flex flex-col items-center justify-center text-gray-500 gap-3">
                    <MapPin className="w-10 h-10 opacity-20" />
                    <div className="text-sm font-medium">Map Preview</div>
                    <div className="text-xs text-gray-600 text-center max-w-xs">
                      {formData.stops.length === 0
                        ? 'Add stops in step 2 to see them on the map.'
                        : `${formData.stops.length} stop${formData.stops.length > 1 ? 's' : ''} added. The map will show coordinates once orders have delivery location data.`}
                    </div>
                    {/* Fallback: numbered stop list as visual indicator */}
                    {formData.stops.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap justify-center max-w-md">
                        {formData.stops.map((stop, idx) => (
                          <div
                            key={stop.id}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ backgroundColor: getPriorityColor(stop.priority) }}
                          >
                            {idx + 1}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="absolute bottom-3 right-3 bg-wl-bg-root/80 backdrop-blur-sm text-xs text-wl-text-secondary px-2 py-1 rounded border border-wl-border-default">
                  {formData.stops.length} stop{formData.stops.length !== 1 ? 's' : ''}
                </div>
              </div>

              <div>
                <h3 className="text-white text-sm font-semibold mb-3">Stop Details</h3>
                <div className="flex flex-col gap-2">
                  {formData.stops.map((stop, idx) => (
                    <div
                      key={stop.id}
                      className="p-4 rounded-md bg-wl-bg-surface border border-wl-border-default grid gap-3 items-center"
                      style={{
                        gridTemplateColumns: "30px 1fr auto",
                      }}
                    >
                      <div
                        className={cn("w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold", getPriorityClass(stop.priority))}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-white text-sm font-semibold">
                          {stop.orderId}
                        </div>
                        <div className="text-wl-text-secondary text-xs mt-0.5">
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
              <h3 className="text-white text-sm font-semibold mb-4">Route Optimization Strategy</h3>
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
                      formData.optimizationMode === (option.id as RouteFormData['optimizationMode'])
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-wl-bg-surface text-white border-wl-border-default"
                    )}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        optimizationMode: option.id as RouteFormData['optimizationMode'],
                      }))
                    }
                  >
                    <div className="font-semibold mb-1">{option.name}</div>
                    <div className="text-xs opacity-80">{option.desc}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-lg bg-wl-bg-surface border border-wl-border-default">
                <h4 className="text-white text-sm font-semibold mb-2">Summary</h4>
                <div className="text-wl-text-secondary text-sm leading-relaxed">
                  <p>
                    <strong>Route:</strong> {formData.name}
                  </p>
                  <p>
                    <strong>Driver:</strong> {selectedDriver?.name ?? "Not assigned"}
                  </p>
                  <p>
                    <strong>Vehicle:</strong> {selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : "Not assigned"}
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
                {createRoute.error && (
                  <p className="text-red-400 text-sm mt-2">{createRoute.error.message}</p>
                )}
                {createRoute.success && (
                  <p className="text-green-400 text-sm mt-2">Route created successfully!</p>
                )}
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
              <Button variant="primary" onClick={handleDispatch} disabled={createRoute.loading}>
                {createRoute.loading ? 'Dispatching...' : 'Dispatch Route'}
              </Button>
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
