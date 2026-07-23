"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";

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

interface Driver {
  id: string;
  name: string;
}

interface Vehicle {
  id: string;
  name: string;
  capacity: string;
}

interface AvailableOrder {
  id: string;
  address: string;
  timeWindow: { start: string; end: string };
  priority: "low" | "medium" | "high";
}

export default function EditRoutePage() {
  const params = useParams();
  const id = params.id as string;

  const { data: route, loading, error, refetch } = useApiQuery<RouteFormData>(
    id ? `/api/v4/routes/${id}` : null
  );
  const { data: drivers } = useApiQuery<Driver[]>(`/api/v4/drivers`);
  const { data: vehicles } = useApiQuery<Vehicle[]>(`/api/v4/vehicles`);
  const { data: availableOrders } = useApiQuery<AvailableOrder[]>(`/api/v4/orders?available=true`);
  const { execute: updateRoute } = useApiMutation<RouteFormData>("PATCH", `/api/v4/routes/${id}`);

  const [formData, setFormData] = useState<RouteFormData | null>(null);
  const [draggedStop, setDraggedStop] = useState<number | null>(null);
  const [showAddStop, setShowAddStop] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const currentFormData = formData || route || { name: '', date: '', driverId: '', vehicleId: '', stops: [] };
  const driversList = drivers || [];
  const vehiclesList = vehicles || [];
  const ordersList = availableOrders || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-wl-bg-root p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-wl-bg-root p-6">
        <ErrorState message={error.message} onRetry={refetch} />
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...(prev || currentFormData),
      [name]: value,
    }));
    setHasChanges(true);
  };

  const handleRemoveStop = (stopId: string) => {
    setFormData((prev) => ({
      ...(prev || currentFormData),
      stops: (prev || currentFormData).stops.filter((stop) => stop.id !== stopId),
    }));
    setHasChanges(true);
  };

  const handleAddStop = (order: AvailableOrder) => {
    const newStop: Stop = {
      id: `stop_${Date.now()}`,
      orderId: order.id,
      address: order.address,
      timeWindow: order.timeWindow,
      priority: order.priority,
    };
    setFormData((prev) => ({
      ...(prev || currentFormData),
      stops: [...(prev || currentFormData).stops, newStop],
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

    const stops = [...currentFormData.stops];
    const [draggedItem] = stops.splice(draggedStop, 1);
    stops.splice(targetIndex, 0, draggedItem);

    setFormData((prev) => ({
      ...(prev || currentFormData),
      stops,
    }));
    setDraggedStop(null);
    setHasChanges(true);
  };

  const handleReoptimize = () => {
    setFormData((prev) => ({
      ...(prev || currentFormData),
      stops: [...(prev || currentFormData).stops].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
    }));
    setHasChanges(true);
  };

  const handleCancel = () => {
    setFormData(null);
    setHasChanges(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateRoute(currentFormData);
      setHasChanges(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save route');
    } finally {
      setIsSaving(false);
    }
  };

  const estimatedDistance = currentFormData.stops.length * 3.5;
  const estimatedDuration = currentFormData.stops.length * 15 + 30;

  return (
    <div className="min-h-screen bg-wl-bg-root p-6 text-wl-text-primary">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-wl-text-primary mb-2">Edit Route</h1>
        <p className="text-sm text-wl-text-secondary">Modify route details, reorder stops, and optimize delivery sequence</p>
      </div>

      <div className="max-w-4xl mb-8">
        <div className="grid grid-cols-[2fr_1fr] gap-6">
          <div>
            <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
              <CardHeader>
                <CardTitle className="text-wl-text-primary">Route Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-wl-text-primary text-sm font-semibold mb-2">Route Name</label>
                    <input
                      type="text"
                      name="name"
                      value={currentFormData.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 rounded-md bg-wl-bg-root border border-wl-border-default text-wl-text-primary text-sm box-border"
                    />
                  </div>
                  <div>
                    <label className="block text-wl-text-primary text-sm font-semibold mb-2">Delivery Date</label>
                    <input
                      type="date"
                      name="date"
                      value={currentFormData.date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 rounded-md bg-wl-bg-root border border-wl-border-default text-wl-text-primary text-sm box-border"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-wl-text-primary text-sm font-semibold mb-2">Assign Driver</label>
                    <select
                      name="driverId"
                      value={currentFormData.driverId}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 rounded-md bg-wl-bg-root border border-wl-border-default text-wl-text-primary text-sm box-border"
                    >
                      {driversList.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-wl-text-primary text-sm font-semibold mb-2">Vehicle</label>
                    <select
                      name="vehicleId"
                      value={currentFormData.vehicleId}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 rounded-md bg-wl-bg-root border border-wl-border-default text-wl-text-primary text-sm box-border"
                    >
                      {vehiclesList.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.name} ({vehicle.capacity})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-wl-bg-surface border border-wl-border-default">
              <CardHeader>
                <CardTitle className="text-wl-text-primary">Route Stops</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="p-4 rounded-md bg-wl-bg-root border border-wl-border-default text-center">
                    <div className="text-lg font-bold text-wl-info-500 mb-0.5">{currentFormData.stops.length}</div>
                    <div className="text-xs text-wl-text-secondary">Total Stops</div>
                  </div>
                  <div className="p-4 rounded-md bg-wl-bg-root border border-wl-border-default text-center">
                    <div className="text-lg font-bold text-wl-info-500 mb-0.5">{estimatedDistance.toFixed(1)}km</div>
                    <div className="text-xs text-wl-text-secondary">Est. Distance</div>
                  </div>
                  <div className="p-4 rounded-md bg-wl-bg-root border border-wl-border-default text-center">
                    <div className="text-lg font-bold text-wl-info-500 mb-0.5">{estimatedDuration}min</div>
                    <div className="text-xs text-wl-text-secondary">Est. Duration</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  {currentFormData.stops.map((stop, idx) => (
                    <div
                      key={stop.id}
                      className={cn(
                        'p-3 rounded-md grid gap-3 items-center cursor-grab transition-all',
                        'border border-wl-border-default',
                        draggedStop === idx
                          ? 'bg-wl-info-500/20 border-wl-info-500 opacity-70'
                          : 'bg-wl-bg-surface',
                      )}
                      style={{ gridTemplateColumns: '24px 1fr auto auto' }}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(idx)}
                    >
                      <div className="flex flex-col gap-0.5 text-wl-text-secondary text-xs cursor-grab">
                        <span>⋮</span>
                        <span>⋮</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-wl-text-primary text-xs font-semibold mb-0.5">
                          {idx + 1}. {stop.orderId}
                        </div>
                        <div className="text-wl-text-secondary text-xs overflow-hidden text-ellipsis whitespace-nowrap">
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
                  <div className="mt-4 p-4 rounded-md bg-wl-bg-surface border border-wl-border-default">
                    <h4 className="text-wl-text-primary text-sm font-semibold mb-3">Available Orders</h4>
                    <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                      {ordersList.map((order) => (
                        <div
                          key={order.id}
                          className="p-3 rounded-md bg-wl-bg-root border border-wl-border-default cursor-pointer text-xs transition-all hover:bg-wl-bg-surface hover:border-wl-info-500"
                          onClick={() => handleAddStop(order)}
                        >
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="font-semibold text-wl-text-primary">{order.id}</span>
                            <Badge>{order.priority.toUpperCase()}</Badge>
                          </div>
                          <div className="text-wl-text-secondary mb-1">
                            {order.address}
                          </div>
                          <div className="text-wl-text-secondary text-xs">
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
            <Card className="bg-wl-bg-surface border border-wl-border-default">
              <CardHeader>
                <CardTitle className="text-wl-text-primary">Current Driver</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 rounded-md bg-wl-bg-root border border-wl-border-default">
                  <div className="text-wl-text-primary text-sm font-semibold mb-2">
                    {driversList.find((d) => d.id === currentFormData.driverId)?.name}
                  </div>
                  <div className="text-wl-text-secondary text-xs leading-relaxed">
                    <div>ID: {currentFormData.driverId}</div>
                    <div className="mt-2">Status: Active</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-wl-bg-surface border border-wl-border-default">
              <CardHeader>
                <CardTitle className="text-wl-text-primary">Vehicle Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 rounded-md bg-wl-bg-root border border-wl-border-default">
                  <div className="text-wl-text-primary text-sm font-semibold mb-2">
                    {vehiclesList.find((v) => v.id === currentFormData.vehicleId)?.name}
                  </div>
                  <div className="text-wl-text-secondary text-xs leading-relaxed">
                    <div>
                      Capacity: {vehiclesList.find((v) => v.id === currentFormData.vehicleId)?.capacity}
                    </div>
                    <div className="mt-2">Status: Available</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-wl-bg-surface border border-wl-border-default">
              <CardHeader>
                <CardTitle className="text-wl-text-primary">Route Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 rounded-md bg-wl-bg-root border border-wl-border-default text-wl-text-secondary text-xs leading-relaxed">
                  <div>
                    <strong>Name:</strong> {currentFormData.name}
                  </div>
                  <div>
                    <strong>Date:</strong> {currentFormData.date}
                  </div>
                  <div>
                    <strong>Stops:</strong> {currentFormData.stops.length}
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

            {saveError && (
              <div className="p-3 rounded-md bg-wl-danger-500/10 border border-wl-danger-500 text-wl-danger-500 text-xs text-center">
                {saveError}
              </div>
            )}
            {hasChanges && !saveError && (
              <div className="p-3 rounded-md bg-wl-warning-500/10 border border-wl-warning-500 text-wl-warning-400 text-xs text-center">
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
          <Button variant="primary" disabled={!hasChanges || isSaving} onClick={handleSave}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
